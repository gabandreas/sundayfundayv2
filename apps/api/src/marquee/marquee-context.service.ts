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
              where: { userId, month, year },
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
        event: '11.11 Promo Checkout (3x) and 11.11 Early Settlement Batch (3x) complete final 3/3 installment.',
      },
      {
        periodLabel: "FEB '27",
        month: 2,
        year: 2027,
        event: 'SPinjam personal loan installments reach Rp 0 (full SPinjam freedom).',
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
      `1. Use concrete nouns and active verbs.`,
      `2. Cite exact Rupiah figures and calendar dates from the ledger context below.`,
      `3. Use everyday human words (say "Vault" and "Installment Plan", never stiff banking jargon).`,
      `4. Never use robotic academic transition openers or concluding summaries.`,
      `5. Never use sycophantic praise, exclamation-mark filler, or emojis.`,
      `6. Keep sentences direct and rhythmic.`,
      ``,
      `ACTIVE UI CONTEXT: route=${activeRoute}${activeSubTab ? `?sub=${activeSubTab}` : ''}, locale=${locale}`,
      `ACTIVE PAYCYCLE: ${periodTag} (${state}) · Window: ${p.cycleDateLabel ?? periodTag} · Days until start: ${p.daysUntilCycleStart ?? 0}`,
      `PAYDAY RULE: 25th attendance & payslip cutoff + H+2 working days bank transfer.`,
      `DUE-DAY CALENDAR: Canonical due days are 8th, 11th (Credit Card), 17th, 23rd, 24th, and 25th (SPayLater). Cutoffs: SPayLater 15th, Credit Card 20th.`,
      activeSnap
        ? `ACTIVE SNAPSHOT (${periodTag}): Income ${formatRp(activeSnap.finalTotalIncome)}, Debt ${formatRp(activeSnap.totalDeductions)}, Funded Living Pool ${formatRp(activeSnap.actualDailyOperational)}, Shortfall ${formatRp(activeSnap.deficitUncovered)}, P1 ${formatRp(activeSnap.actualSavings)}, P2 ${formatRp(activeSnap.selfReward)}.`
        : `ACTIVE SNAPSHOT (${periodTag}): Projected daily rate ${formatRp(p.baselineDailyRate ?? 0)}/day, remaining living cash ${formatRp(p.remainingBudget ?? 0)}.`,
      `MULTI-CYCLE HORIZON:\n${snapshotLines || '- No snapshots loaded'}`,
      `PAYOFF MILESTONES: JAN '27 (11.11 3x plans retire), FEB '27 (SPinjam debt freedom), SEP '27 (final 12x card installment matures).`,
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
        safeToSpendToday: Math.round(Number(p.safeToSpendToday ?? 0)),
        remainingLivingCash: Math.round(
          Number(p.remainingBudget ?? activeSnap?.actualDailyOperational ?? 0),
        ),
        paydayRules: '25th attendance & payslip cutoff + H+2 working days bank transfer',
      },
      multiCycleSnapshots,
      dueDayCalendar: {
        canonicalDueDays: [8, 11, 17, 23, 24, 25],
        cutoffRules: 'SPayLater 15th cutoff (due 25th next month) · Credit Card 20th cutoff (due 11th next month)',
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
      systemPrompt,
    };
  }
}
