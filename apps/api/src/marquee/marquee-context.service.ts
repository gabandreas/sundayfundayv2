import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SnapshotsSelectors } from '../snapshots/snapshots.selectors';
import { FinanceSelectors } from '../finance/finance.selectors';
import { SavingsSelectors } from '../savings/savings.selectors';

export interface MarqueePayoffMilestone {
  periodLabel: string;
  month: number;
  year: number;
  event: string;
}

export interface MarqueeProactiveReminder {
  id: string;
  tone: 'default' | 'caution' | 'positive';
  text: string;
  prompt: string;
}

export interface MarqueeHydratedSnapshotSummary {
  periodTag: string;
  month: number;
  year: number;
  status: string;
  finalTotalIncome: number;
  totalDeductions: number;
  actualDailyOperational: number;
  deficitUncovered: number;
  actualSavings: number;
  selfReward: number;
  payoutDateIso: string | null;
}

export interface MarqueeFinancialContext {
  userId: number;
  activePeriod: {
    month: number;
    year: number;
    periodTag: string;
    cycleTemporalState: 'PRE_PAYDAY' | 'ACTIVE' | 'COMPLETED';
    daysUntilCycleStart: number;
    cycleStartDate: string | null;
    cycleEndDate: string | null;
    cycleDateLabel: string;
    baselineDailyRate: number;
    safeToSpendToday: number;
    remainingLivingCash: number;
    paydayRules: string;
  };
  multiCycleSnapshots: MarqueeHydratedSnapshotSummary[];
  dueDayCalendar: {
    canonicalDueDays: number[];
    cutoffRules: string;
    activeCycleItems: Array<{
      id: number;
      category: string;
      title: string;
      monthlyAmount: number;
      isSettled: boolean;
    }>;
  };
  payoffMilestones: MarqueePayoffMilestone[];
  vaultSummary: {
    totalVaultBalanceRp: number;
    rdpuBalanceRp: number;
  };
  recentTransactions: Array<{
    id: number;
    label: string;
    amount: number;
    paymentMethod: string;
  }>;
  uiContext: {
    activeRoute: string;
    activeSubTab: string | null;
    locale: 'en' | 'id' | 'zh';
  };
  proactiveReminders: MarqueeProactiveReminder[];
  systemPrompt: string;
}

function formatRp(amount: number): string {
  const abs = Math.round(Math.abs(amount));
  const sign = amount < 0 ? '-' : '';
  return `${sign}Rp ${abs.toLocaleString('id-ID')}`;
}

@Injectable()
export class MarqueeContextHydrator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotsSelectors: SnapshotsSelectors,
    private readonly financeSelectors: FinanceSelectors,
    private readonly savingsSelectors: SavingsSelectors,
  ) {}

  async hydrateForUser(
    userId: number,
    options?: {
      month?: number;
      year?: number;
      activeRoute?: string;
      activeSubTab?: string | null;
      locale?: 'en' | 'id' | 'zh';
    },
  ): Promise<MarqueeFinancialContext> {
    let month = options?.month;
    let year = options?.year;

    if (!month || !year) {
      const def = await this.snapshotsSelectors.getDefaultActivePeriod(userId);
      month = def.month;
      year = def.year;
    }

    const periodTag = `${String(month).padStart(2, '0')}/${year}`;
    const [pacing, snapshotsRaw, lineItemsRaw, recentTxsRaw, savingsOv] = await Promise.all([
      this.financeSelectors
        .getPacing(month, year, undefined, undefined, userId)
        .catch(() => ({
          cycleTemporalState: 'ACTIVE',
          daysUntilCycleStart: 0,
          cycleStartDate: null,
          cycleEndDate: null,
          cycleDateLabel: periodTag,
          baselineDailyRate: 0,
          safeToSpendToday: 0,
          remainingBudget: 0,
        })),
      this.prisma.monthlySnapshot
        ? this.prisma.monthlySnapshot
            .findMany({
              where: { userId },
              orderBy: [{ year: 'asc' }, { month: 'asc' }],
              take: 12,
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.liabilityLineItem
        ? this.prisma.liabilityLineItem
            .findMany({
              where: { userId, month, year },
              orderBy: { monthlyAmount: 'desc' },
              take: 20,
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.transaction
        ? this.prisma.transaction
            .findMany({
              where: { snapshot: { userId, month, year } },
              orderBy: { id: 'desc' },
              take: 8,
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.savingsSelectors.getOverview(undefined, userId).catch(() => ({
        totalBalance: 0,
        rdpuBalance: 0,
      })),
    ]);

    const p: any = pacing ?? {};
    const state = (p.cycleTemporalState ?? 'ACTIVE') as 'PRE_PAYDAY' | 'ACTIVE' | 'COMPLETED';

    const multiCycleSnapshots: MarqueeHydratedSnapshotSummary[] = (
      Array.isArray(snapshotsRaw) ? snapshotsRaw : []
    ).map((s: any) => ({
      periodTag: `${String(s.month).padStart(2, '0')}/${s.year}`,
      month: Number(s.month),
      year: Number(s.year),
      status: String(s.status ?? 'DRAFT'),
      finalTotalIncome: Math.round(Number(s.finalTotalIncome ?? 0)),
      totalDeductions: Math.round(Number(s.totalDeductions ?? 0)),
      actualDailyOperational: Math.round(Number(s.actualDailyOperational ?? 0)),
      deficitUncovered: Math.round(Number(s.deficitUncovered ?? 0)),
      actualSavings: Math.round(Number(s.actualSavings ?? 0)),
      selfReward: Math.round(Number(s.selfReward ?? 0)),
      payoutDateIso: s.payrollPayoutDate
        ? new Date(s.payrollPayoutDate).toISOString().slice(0, 10)
        : null,
    }));

    const activeSnap = multiCycleSnapshots.find(
      (s) => s.month === month && s.year === year,
    );

    const activeCycleItems = (Array.isArray(lineItemsRaw) ? lineItemsRaw : []).map(
      (item: any) => ({
        id: Number(item.id),
        category: String(item.category ?? 'PAYLATER'),
        title: String(item.title ?? 'Bill'),
        monthlyAmount: Math.round(Number(item.monthlyAmount ?? 0)),
        isSettled: Boolean(item.isSettled),
      }),
    );

    const recentTransactions = (Array.isArray(recentTxsRaw) ? recentTxsRaw : []).map(
      (tx: any) => ({
        id: Number(tx.id),
        label: String(tx.label ?? 'Expense'),
        amount: Math.round(Number(tx.amount ?? 0)),
        paymentMethod: String(tx.paymentMethod ?? 'CASH'),
      }),
    );

    const payoffMilestones: MarqueePayoffMilestone[] = [
      {
        periodLabel: "JAN '27",
        month: 1,
        year: 2027,
        event: 'SPinjam Oct 23 & Oct 24 loans complete final 3/3 installment (+Rp 147.960/mo freed) and Natal THR arrives.',
      },
      {
        periodLabel: "FEB '27",
        month: 2,
        year: 2027,
        event: '11.11 Promo Checkout (3x) and Nov 08 / Nov 17 SPinjam loans complete final 3/3 installment (+Rp 522.010/mo freed).',
      },
      {
        periodLabel: "MAR '27",
        month: 3,
        year: 2027,
        event: 'SPinjam personal loan obligations reach Rp 0 (full SPinjam freedom) and Anthropic Claude 6/6 finishes.',
      },
      {
        periodLabel: "SEP '27",
        month: 9,
        year: 2027,
        event: 'Final 12-month credit card installment matures (zero installment overhang).',
      },
    ];

    const ov: any = savingsOv ?? {};
    const totalVaultBalanceRp = Math.round(Number(ov.totalBalance ?? ov.totalNetSavings ?? 0));
    const rdpuBalanceRp = Math.round(Number(ov.rdpuBalance ?? ov.investmentBalance ?? 0));

    const activeRoute = options?.activeRoute || '/';
    const activeSubTab = options?.activeSubTab ?? null;
    const locale = options?.locale ?? 'en';

    const remainingCashRp = Math.round(
      Number(p.remainingBudget ?? activeSnap?.actualDailyOperational ?? 0),
    );
    const daysLeft = Math.round(Number(p.daysRemaining ?? 0));
    const daysToStart = Math.round(Number(p.daysUntilCycleStart ?? 0));
    const shortfallRp = Math.round(Number(activeSnap?.deficitUncovered ?? 0));
    const unsettledItemsCount = activeCycleItems.filter((i) => !i.isSettled).length;

    const proactiveReminders: MarqueeProactiveReminder[] = [];
    if (state === 'PRE_PAYDAY') {
      proactiveReminders.push({
        id: 'pre-payday-countdown',
        tone: shortfallRp > 0 ? 'caution' : 'default',
        text: `${periodTag} starts in ${daysToStart}d · Living pool ${formatRp(activeSnap?.actualDailyOperational ?? remainingCashRp)}${shortfallRp > 0 ? ` (${formatRp(shortfallRp)} shortfall)` : ''}`,
        prompt: `How is my ${periodTag} paycycle looking?`,
      });
    } else if (state === 'ACTIVE') {
      proactiveReminders.push({
        id: 'active-paycycle-runway',
        tone: daysLeft <= 7 ? 'caution' : 'positive',
        text: `${daysLeft}d until next payday · ${formatRp(remainingCashRp)} living cash left (${formatRp(p.weightedSafeToSpendToday ?? p.safeToSpendToday ?? 0)} today)`,
        prompt: 'Safe to spend today?',
      });
    }
    if (unsettledItemsCount > 0) {
      proactiveReminders.push({
        id: 'upcoming-due-dates',
        tone: 'default',
        text: `${unsettledItemsCount} unpaid obligations in ${periodTag} (due 8th, 11th, 17th, 23rd-25th)`,
        prompt: 'Upcoming bills due this cycle',
      });
    }
    proactiveReminders.push({
      id: 'cutoff-check',
      tone: 'default',
      text: 'SPayLater (daysInMonth - 15) & Permata CC (25th closing -> 11th due) cutoffs active',
      prompt: 'Can I afford 350k on SPayLater?',
    });

    const snapshotLines = multiCycleSnapshots
      .slice(0, 6)
      .map(
        (s) =>
          `- ${s.periodTag} (${s.status}): Income ${formatRp(s.finalTotalIncome)}, Debt ${formatRp(s.totalDeductions)}, Living Pool ${formatRp(s.actualDailyOperational)}, Shortfall ${formatRp(s.deficitUncovered)}, P1 Vault ${formatRp(s.actualSavings)}, P2 Buffer ${formatRp(s.selfReward)}`,
      )
      .join('\n');

    const systemPrompt = [
      `You are Marquee, the financial co-pilot inside Sunday Funday ERP for user #${userId}.`,
      `Write like a sharp human financial advisor obeying 6 strict rules:`,
      `1. Eliminate AI writing patterns (no repetitive sentence templates, filler, or predictable transitions).`,
      `2. Natural conversational flow (speak like a smart friend looking at the same ledger; vary sentence length).`,
      `3. First-hand practitioner perspective (cite exact Rupiah figures, due dates, and cutoffs from the ledger below).`,
      `4. Convincing & practical detail (concrete numbers and realistic trade-offs, never promotional fluff).`,
      `5. Strong personality & clear conviction (direct point of view, zero corporate or flat robot tone).`,
      `6. Human thinking process (weigh real trade-offs, dilemmas, and observations naturally).`,
      ``,
      `ERP MODULE & ROUTE MAP (for guiding the user across the app):`,
      `- Overview (/): Daily safe-to-spend, 10-second wallet reconciliation, routine bills pool, quick expense logger.`,
      `- Payday Activation (/payday-wizard): 4-step payday checklist (confirm income, lock bill holds, fund living pool, sweep P1).`,
      `- Cash & Bill Radar (/calendar): Day-by-day running cash timeline and lowest-cash bridge point before THR or payday.`,
      `- Payroll & Cashflow (/payroll): Corporate payslip rules (25th cutoff + H+2 transfer), workday calculator, life-energy hourly wage.`,
      `- Budget & Envelopes (/allocations): Priority waterfall (Debt -> Routine -> Proportional Living Cash -> P1 -> P2) & mid-month revisions.`,
      `- Credit & Debt Matrix (/credit): 12-month debt matrix (?sub=matrix), active installment plans & Snowball/Avalanche optimizer (?sub=contracts), purchase cutoff simulator (?sub=simulator), statement reconciler (?sub=reconciler).`,
      `- Savings & Vaults (/savings): P1 Core Vault (?sub=vault), net worth breakdown (?sub=networth), 12-month wealth forecaster (?sub=forecaster).`,
      `- Spending & Trend Review (/analytics): Multi-period cashflow trends, category allocation breakdown, daily burn pace & anomaly check.`,
      `- Reports & Statements (/reports): Executive horizon (?sub=executive), variance diff (?sub=variance), discipline scorecard (?sub=audit), XLSX/PDF export (?sub=export).`,
      `- Subscriptions (/subscriptions) & Preferences (/preferences): Recurring kill-switches, formula studio, instruments, and AI settings.`,
      ``,
      `ACTIVE UI CONTEXT: route=${activeRoute}${activeSubTab ? `?sub=${activeSubTab}` : ''}, locale=${locale}`,
      `CONSUMPTION & BILL-MATURITY MONTH CONVENTION: Period M is funded by Payday(M-1), runs from Payday(M-1) through Day before Payday(M), and pays all Month M bill maturities.`,
      `ACTIVE PAYCYCLE: ${periodTag} (${state}) · Day ${p.currentDayIndex ?? 0} of ${p.daysInCycle ?? 30} (${p.daysRemaining ?? 0} days remaining) · Window: ${p.cycleDateLabel ?? periodTag} · Days until start: ${p.daysUntilCycleStart ?? 0} · Weighted Safe-to-Spend Today: ${formatRp(p.weightedSafeToSpendToday ?? p.safeToSpendToday ?? 0)} (Weekday ${formatRp(p.weekdaySafeRate ?? p.safeToSpendToday ?? 0)}/day, Weekend ${formatRp(p.weekendSafeRate ?? p.safeToSpendToday ?? 0)}/day)`,
      `PAYDAY RULE: 25th attendance & payslip cutoff + H+2 working days bank transfer (same-month clamped).`,
      `DUE-DAY & CUTOFF LAW: Canonical due days are 8th, 11th (Bank Permata CC), 17th, 23rd, 24th, and 25th (SPayLater). SPayLater cutoff = daysInMonth(M) - 15 (15th in 30d months, 16th in 31d months; day <= cutoff due 25th M+1, day > cutoff due 25th M+2). Bank Permata Credit Card closes every 25th -> due every 11th of following month (day <= 25th M due 11th M+1, day >= 26th M due 11th M+2), with H-1 business-day early-payment advisory if the 11th falls on a weekend or holiday.`,
      activeSnap
        ? `ACTIVE SNAPSHOT (${periodTag}): Income ${formatRp(activeSnap.finalTotalIncome)}, Debt ${formatRp(activeSnap.totalDeductions)}, Funded Living Pool ${formatRp(activeSnap.actualDailyOperational)}, Shortfall ${formatRp(activeSnap.deficitUncovered)}, P1 ${formatRp(activeSnap.actualSavings)}, P2 ${formatRp(activeSnap.selfReward)}.`
        : `ACTIVE SNAPSHOT (${periodTag}): Projected daily rate ${formatRp(p.baselineDailyRate ?? 0)}/day, remaining living cash ${formatRp(p.remainingBudget ?? 0)}.`,
      `MULTI-CYCLE HORIZON:\n${snapshotLines || '- No snapshots loaded'}`,
      `PAYOFF MILESTONES: JAN '27 (Oct SPinjam 3/3 retires +Rp 147.960/mo), FEB '27 (11.11 3x & Nov SPinjam 3/3 retire +Rp 522.010/mo), MAR '27 (SPinjam = Rp 0), SEP '27 (final 12x card installment matures).`,
    ].join('\n');

    return {
      userId,
      activePeriod: {
        month,
        year,
        periodTag,
        cycleTemporalState: state,
        daysUntilCycleStart: Number(p.daysUntilCycleStart ?? 0),
        cycleStartDate: p.cycleStartDate ?? null,
        cycleEndDate: p.cycleEndDate ?? null,
        cycleDateLabel: String(p.cycleDateLabel ?? periodTag),
        baselineDailyRate: Math.round(Number(p.baselineDailyRate ?? 0)),
        safeToSpendToday: Math.round(
          Number(p.weightedSafeToSpendToday ?? p.safeToSpendToday ?? 0),
        ),
        remainingLivingCash: Math.round(
          Number(p.remainingBudget ?? activeSnap?.actualDailyOperational ?? 0),
        ),
        paydayRules: '25th attendance & payslip cutoff + H+2 working days bank transfer',
      },
      multiCycleSnapshots,
      dueDayCalendar: {
        canonicalDueDays: [8, 11, 17, 23, 24, 25],
        cutoffRules:
          'SPayLater daysInMonth - 15 cutoff (due 25th) · Bank Permata CC 25th closing cutoff (due 11th next month + H-1 business day advisory)',
        activeCycleItems,
      },
      payoffMilestones,
      vaultSummary: {
        totalVaultBalanceRp,
        rdpuBalanceRp,
      },
      recentTransactions,
      uiContext: {
        activeRoute,
        activeSubTab,
        locale,
      },
      proactiveReminders,
      systemPrompt,
    };
  }
}
