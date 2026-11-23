import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SnapshotsSelectors } from '../snapshots/snapshots.selectors';
import { FinanceSelectors } from '../finance/finance.selectors';
import { SavingsSelectors } from '../savings/savings.selectors';
import { resolveStudioConfig } from '../config/studio.defaults';

export interface MarqueePayoffMilestone {
  periodLabel: string;
  month: number;
  year: number;
  event: string;
}

export interface MarqueeMemoryRule {
  id: string;
  ruleText: string;
  merchantPattern?: string;
  defaultInstrument?: 'CASH' | 'PAYLATER' | 'CREDIT_CARD';
  createdAt: string;
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
  creditCardsAndContracts?: Array<{
    id: number;
    label: string;
    monthlyAmount: number;
    tenor: number;
    chargeType: string;
    billingPeriod: string;
  }>;
  wishlistItems?: Array<{
    id: number;
    name: string;
    targetPriceRp: number;
    status: string;
  }>;
  savingsGoals?: Array<{
    id: number;
    title: string;
    targetAmountRp: number;
    allocatedRp: number;
  }>;
  activeSubscriptions?: Array<{
    id: number;
    label: string;
    amountRp: number;
    promoEndDateIso: string | null;
    killSwitchEnabled: boolean;
  }>;
  instrumentsConfig?: Array<{
    id: string;
    name: string;
    type: string;
    cutoffFormula: string;
    cutoffBoundaryInclusive: boolean;
    preCutoffOffsetMonths: number;
    postCutoffOffsetMonths: number;
    dueDay: number;
  }>;
  uiContext: {
    activeRoute: string;
    activeSubTab: string | null;
    locale: 'en' | 'id' | 'zh';
  };
  memoryRules?: MarqueeMemoryRule[];
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
    const [
      pacing,
      snapshotsRaw,
      lineItemsRaw,
      recentTxsRaw,
      savingsOv,
      cardTxsRaw,
      contractsRaw,
      wishlistRaw,
      goalsRaw,
      globalConfigRaw,
    ] = await Promise.all([
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
              where: { userId },
              orderBy: [{ year: 'asc' }, { month: 'asc' }, { monthlyAmount: 'desc' }],
              take: 40,
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.transaction
        ? this.prisma.transaction
            .findMany({
              where: { snapshot: { userId, month, year } },
              orderBy: { id: 'desc' },
              take: 10,
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.savingsSelectors.getOverview(undefined, userId).catch(() => ({
        totalBalance: 0,
        rdpuBalance: 0,
      })),
      (this.prisma as any).creditCardTransaction
        ? (this.prisma as any).creditCardTransaction
            .findMany({
              where: { userId, isActive: true },
              orderBy: { id: 'desc' },
              take: 25,
            })
            .catch(() => [])
        : Promise.resolve([]),
      (this.prisma as any).creditContract
        ? (this.prisma as any).creditContract
            .findMany({ where: { userId, isActive: true }, take: 15 })
            .catch(() => [])
        : Promise.resolve([]),
      (this.prisma as any).wishlistItem
        ? (this.prisma as any).wishlistItem
            .findMany({
              where: { userId },
              orderBy: { priority: 'asc' },
              take: 15,
            })
            .catch(() => [])
        : Promise.resolve([]),
      (this.prisma as any).savingsGoal
        ? (this.prisma as any).savingsGoal
            .findMany({
              where: { userId },
              orderBy: { id: 'asc' },
              take: 15,
            })
            .catch(() => [])
        : Promise.resolve([]),
      (this.prisma as any).globalConfig
        ? (this.prisma as any).globalConfig
            .findFirst({ where: { userId } })
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    const studioConfig = resolveStudioConfig(
      userId,
      globalConfigRaw?.formulaParamsJson,
      globalConfigRaw,
    );
    const policyObj =
      (globalConfigRaw as any)?.financialPolicyJson &&
      typeof (globalConfigRaw as any).financialPolicyJson === 'object'
        ? ((globalConfigRaw as any).financialPolicyJson as Record<string, any>)
        : {};
    const memoryRules: MarqueeMemoryRule[] = Array.isArray(policyObj.marqueeMemory)
      ? policyObj.marqueeMemory
          .filter((r: any) => r && typeof r.ruleText === 'string')
          .map((r: any) => ({
            id: String(r.id || ''),
            ruleText: String(r.ruleText),
            ...(r.merchantPattern ? { merchantPattern: String(r.merchantPattern) } : {}),
            ...(r.defaultInstrument ? { defaultInstrument: r.defaultInstrument } : {}),
            createdAt: String(r.createdAt || ''),
          }))
      : [];
    const isBespokeOwner = userId === 1;
    const spayCfg = studioConfig.instrumentsTable.find(
      (i) => i.active && i.type === 'PAYLATER',
    );
    const ccCfg = studioConfig.instrumentsTable.find(
      (i) => i.active && i.type === 'CREDIT_CARD',
    );
    const spayFormulaLabel = spayCfg?.cutoffFormula || 'DAYS_IN_MONTH - 15';
    const ccCutoffLabel = ccCfg?.cutoffFormula || `${ccCfg?.cutoffDay ?? 25}th`;

    const allItemsList = Array.isArray(lineItemsRaw) ? lineItemsRaw : [];
    const activePeriodItemsRaw = allItemsList.filter(
      (i: any) => Number(i.month) === month && Number(i.year) === year,
    );
    const currentCycleRaw =
      activePeriodItemsRaw.length > 0 ? activePeriodItemsRaw : allItemsList.slice(0, 15);

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

    const activeCycleItems = currentCycleRaw.map(
      (item: any) => ({
        id: Number(item.id),
        category: String(item.category ?? 'PAYLATER'),
        title: String(item.title ?? 'Bill'),
        monthlyAmount: Math.round(Number(item.monthlyAmount ?? 0)),
        isSettled: Boolean(item.isSettled),
      }),
    );

    const creditCardsAndContracts = [
      ...(Array.isArray(cardTxsRaw) ? cardTxsRaw : []).map((c: any) => ({
        id: Number(c.id),
        label: String(c.label ?? 'Card Charge'),
        monthlyAmount: Math.round(Number(c.monthlyAmount ?? c.amount ?? 0)),
        tenor: Number(c.totalTenor ?? c.tenor ?? 1),
        chargeType: String(c.chargeType ?? 'FULL'),
        billingPeriod: `${String(c.billingMonth ?? c.startMonth ?? month).padStart(2, '0')}/${c.billingYear ?? c.startYear ?? year}`,
      })),
      ...(Array.isArray(contractsRaw) ? contractsRaw : []).map((ct: any) => ({
        id: Number(ct.id),
        label: String(ct.label ?? 'Contract'),
        monthlyAmount: Math.round(Number(ct.monthlyInstallment ?? 0)),
        tenor: Number(ct.totalTenor ?? 1),
        chargeType: 'CONTRACT',
        billingPeriod: `${String(ct.startMonth ?? month).padStart(2, '0')}/${ct.startYear ?? year}`,
      })),
    ];

    const wishlistItems = (Array.isArray(wishlistRaw) ? wishlistRaw : []).map((w: any) => ({
      id: Number(w.id),
      name: String(w.name ?? w.title ?? 'Wishlist Target'),
      targetPriceRp: Math.round(Number(w.targetPrice ?? w.price ?? 0)),
      status: String(w.status ?? (w.isPurchased ? 'PURCHASED' : 'PLANNING')),
    }));

    const savingsGoals = (Array.isArray(goalsRaw) ? goalsRaw : []).map((g: any) => ({
      id: Number(g.id),
      title: String(g.title ?? 'Savings Goal'),
      targetAmountRp: Math.round(Number(g.targetAmount ?? 0)),
      allocatedRp: Math.round(Number(g.currentAllocatedAmount ?? 0)),
    }));

    const activeSubscriptions = (Array.isArray(cardTxsRaw) ? cardTxsRaw : [])
      .filter((c: any) => Boolean(c.isRecurring || c.killSwitchEnabled))
      .map((c: any) => ({
        id: Number(c.id),
        label: String(c.label ?? 'Subscription'),
        amountRp: Math.round(Number(c.amount ?? 0)),
        promoEndDateIso: c.promoEndDate
          ? new Date(c.promoEndDate).toISOString().slice(0, 10)
          : null,
        killSwitchEnabled: Boolean(c.killSwitchEnabled),
      }));

    const instrumentsConfig = studioConfig.instrumentsTable
      .filter((inst) => inst.active)
      .map((inst) => ({
        id: inst.id,
        name: inst.name,
        type: inst.type,
        cutoffFormula: inst.cutoffFormula ?? String(inst.cutoffDay || 15),
        cutoffBoundaryInclusive: Boolean(inst.cutoffBoundaryInclusive),
        preCutoffOffsetMonths: inst.preCutoffOffsetMonths ?? 0,
        postCutoffOffsetMonths: inst.postCutoffOffsetMonths ?? 1,
        dueDay: inst.dueDay,
      }));

    const recentTransactions = (Array.isArray(recentTxsRaw) ? recentTxsRaw : []).map(
      (tx: any) => ({
        id: Number(tx.id),
        label: String(tx.label ?? 'Expense'),
        amount: Math.round(Number(tx.amount ?? 0)),
        paymentMethod: String(tx.paymentMethod ?? 'CASH'),
      }),
    );

    const payoffMilestones: MarqueePayoffMilestone[] = isBespokeOwner
      ? [
          {
            periodLabel: "JAN '27",
            month: 1,
            year: 2027,
            event:
              'SPinjam Oct 23 & Oct 24 loans complete final 3/3 installment (+Rp 147.960/mo freed) and Natal THR arrives.',
          },
          {
            periodLabel: "FEB '27",
            month: 2,
            year: 2027,
            event:
              '11.11 Promo Checkout (3x) and Nov 08 / Nov 17 SPinjam loans complete final 3/3 installment (+Rp 522.010/mo freed).',
          },
          {
            periodLabel: "MAR '27",
            month: 3,
            year: 2027,
            event:
              'SPinjam personal loan obligations reach Rp 0 (full SPinjam freedom) and Anthropic Claude 6/6 finishes.',
          },
          {
            periodLabel: "SEP '27",
            month: 9,
            year: 2027,
            event:
              'Final 12-month credit card installment matures (zero installment overhang).',
          },
        ]
      : [];

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
        text: isBespokeOwner
          ? `${unsettledItemsCount} unpaid obligations in ${periodTag} (due 8th, 11th, 17th, 23rd-25th)`
          : `${unsettledItemsCount} unpaid obligations in ${periodTag}`,
        prompt: 'Upcoming bills due this cycle',
      });
    }
    if (isBespokeOwner) {
      proactiveReminders.push({
        id: 'cutoff-check',
        tone: 'default',
        text: `SPayLater (${spayFormulaLabel}, due ${spayCfg?.dueDay ?? 25}th) & CC (${ccCutoffLabel} -> ${ccCfg?.dueDay ?? 11}th due) active`,
        prompt: 'Can I afford 350k on SPayLater?',
      });
    } else if (spayCfg || ccCfg) {
      const activeParts = [
        spayCfg ? `${spayCfg.name} (${spayFormulaLabel}, due ${spayCfg.dueDay}th)` : null,
        ccCfg ? `${ccCfg.name} (${ccCutoffLabel} -> ${ccCfg.dueDay}th due)` : null,
      ]
        .filter(Boolean)
        .join(' & ');
      proactiveReminders.push({
        id: 'cutoff-check',
        tone: 'default',
        text: `${activeParts} active`,
        prompt: 'Check upcoming statement cutoff schedule',
      });
    }

    const snapshotLines = multiCycleSnapshots
      .slice(0, 6)
      .map(
        (s) =>
          `- ${s.periodTag} (${s.status}): Income ${formatRp(s.finalTotalIncome)}, Debt ${formatRp(s.totalDeductions)}, Living Pool ${formatRp(s.actualDailyOperational)}, Shortfall ${formatRp(s.deficitUncovered)}, P1 Savings ${formatRp(s.actualSavings)}, P2 Buffer ${formatRp(s.selfReward)}`,
      )
      .join('\n');

    const ccSummaryLines =
      creditCardsAndContracts.length > 0
        ? creditCardsAndContracts
            .slice(0, 10)
            .map(
              (c) =>
                `- ${c.label} (${c.chargeType} ${c.tenor}x, billing ${c.billingPeriod}): ${formatRp(c.monthlyAmount)}/mo`,
            )
            .join('\n')
        : '- No active card installments';

    const wishlistLines =
      wishlistItems.length > 0
        ? wishlistItems
            .slice(0, 8)
            .map((w) => `- ${w.name} (${w.status}): target ${formatRp(w.targetPriceRp)}`)
            .join('\n')
        : '- No wishlist items';

    const savingsGoalLines = [
      ...savingsGoals.map(
        (g) =>
          `- Goal "${g.title}": ${formatRp(g.allocatedRp)} / ${formatRp(g.targetAmountRp)}`,
      ),
      ...studioConfig.savingsPockets.map(
        (pk) =>
          `- Pocket "${pk.name}" (${pk.category}): allocated ${formatRp(pk.allocatedRp)} / target ${formatRp(pk.targetRp ?? 0)}`,
      ),
    ].join('\n');

    const instrumentLines = instrumentsConfig
      .map(
        (i) =>
          `- ${i.name} (${i.type}): cutoff formula "${i.cutoffFormula}" (${i.cutoffBoundaryInclusive ? '>= cutoff' : '> cutoff'}), pre-offset +${i.preCutoffOffsetMonths}m, post-offset +${i.postCutoffOffsetMonths}m, due day ${i.dueDay || 'disbursement-day'}`,
      )
      .join('\n');

    const routineLines = studioConfig.routineTemplatesTable
      .filter((r) => r.active)
      .map((r) => `- ${r.name}: ${formatRp(r.monthlyQuotaRp)}/mo (due ${r.targetDueDay}th)`)
      .join('\n');

    const systemPrompt = [
      `You are Marquee, the financial co-pilot and execution assistant inside Sunday Funday ERP for user #${userId}.`,
      `Write like a crisp human financial engineer obeying 5 communication rules:`,
      `1. Eliminate AI filler, repetitive intros, or generic cheerleading.`,
      `2. Speak naturally and directly, citing exact Rupiah numbers, dates, and cutoff formulas from the ERP context.`,
      `3. Never use buzzwords like Vault, Forward-Borrow, Outlook, or emojis. Use Emergency Fund, Savings Reserve, and Temporary Savings Advance.`,
      `4. Offer actionable help: when the user asks to record, shift, settle, adjust budgets, or add wishlist targets, invoke the matching tool so it stages a 1-click confirmation card.`,
      ``,
      ...(isBespokeOwner
        ? [
            `ERP MODULE & ROUTE MAP:`,
            `- Overview (/): Daily safe-to-spend, wallet reconciliation, routine bills, expense logger.`,
            `- Payday Activation (/payday-wizard): 4-step payday checklist.`,
            `- Cash & Bill Radar (/calendar): Day-by-day running balance and low-cash bridge dates.`,
            `- Payroll & Cashflow (/payroll): Attendance cutoff window (${studioConfig.paycycleFormulaConfig.attendanceCutoffStartDay ?? 16}th -> ${studioConfig.paycycleFormulaConfig.attendanceCutoffEndDay ?? 15}th), BPJS (${studioConfig.paycycleFormulaConfig.bpjsRatePercent ?? 3}%), payslip rules.`,
            `- Allocations (/allocations): Priority waterfall and quota revisions.`,
            `- Credit & Liabilities (/credit): 12-month debt schedule (?sub=matrix), installment plans (?sub=contracts), cutoff simulator (?sub=simulator), reconciler (?sub=reconciler).`,
            `- Savings & Emergency Fund (/savings): P1 reserve (?sub=vault), net worth (?sub=networth), 12-month forecaster (?sub=forecaster).`,
            `- Analytics (/analytics), Reports (/reports), Preferences (/preferences?sub=instruments).`,
          ]
        : [
            `ERP MODULE & ROUTE MAP (US Personal Finance Standard):`,
            `- Overview (/): Safe-to-spend balance, daily pace, routine expenses, and cashflow summary.`,
            `- Transactions (/ledger): Categorized income and expense activity.`,
            `- Budgets & Envelopes (/allocations): Priority allocations and category targets.`,
            `- Income & Cash Flow (/payroll): Monthly net income and payday schedule (anchor day ${studioConfig.paycycleFormulaConfig.paydayAnchorDay ?? 1}).`,
            `- Accounts & Goals (/savings): Savings reserve, net worth, goals (?sub=vault, ?sub=networth, ?sub=forecaster).`,
            `- Bills & Recurring (/calendar), Subscriptions (/subscriptions), Reports (/reports), Planner (/scenarios), Wishlist (/wishlist), Preferences (/preferences).`,
          ]),
      ``,
      `ACTIVE UI CONTEXT: route=${activeRoute}${activeSubTab ? `?sub=${activeSubTab}` : ''}, locale=${locale}`,
      `CONSUMPTION & BILL-MATURITY MONTH CONVENTION: Period M is funded by Payday(M-1), runs from Payday(M-1) through Day before Payday(M), and pays all Month M bill maturities.`,
      `ACTIVE PAYCYCLE: ${periodTag} (${state}) · Day ${p.currentDayIndex ?? 0} of ${p.daysInCycle ?? 30} (${p.daysRemaining ?? 0} days remaining) · Window: ${p.cycleDateLabel ?? periodTag} · Days until start: ${p.daysUntilCycleStart ?? 0} · Weighted Safe-to-Spend Today: ${formatRp(p.weightedSafeToSpendToday ?? p.safeToSpendToday ?? 0)} (Weekday ${formatRp(p.weekdaySafeRate ?? p.safeToSpendToday ?? 0)}/day, Weekend ${formatRp(p.weekendSafeRate ?? p.safeToSpendToday ?? 0)}/day)`,
      `ACTIVE INSTRUMENTS & CUTOFF FORMULAS:\n${instrumentLines}`,
      ...(isBespokeOwner
        ? [
            `CANONICAL CUTOFF LAW: SPayLater uses dynamic daysInMonth(M) - 15 (${spayFormulaLabel}, due 25th): day < cutoff bills Month M (25th M); day >= cutoff bills Month M+1 (25th M+1). Permata CC closes 25th (day <= 25th bills 11th M+1; day >= 26th bills 11th M+2, shifted H-1 business day if weekend/holiday).`,
          ]
        : []),
      activeSnap
        ? `ACTIVE SNAPSHOT (${periodTag}): Income ${formatRp(activeSnap.finalTotalIncome)}, Debt ${formatRp(activeSnap.totalDeductions)}, Funded Living Pool ${formatRp(activeSnap.actualDailyOperational)}, Shortfall ${formatRp(activeSnap.deficitUncovered)}, P1 ${formatRp(activeSnap.actualSavings)}, P2 ${formatRp(activeSnap.selfReward)}.`
        : `ACTIVE SNAPSHOT (${periodTag}): Projected daily rate ${formatRp(p.baselineDailyRate ?? 0)}/day, remaining living cash ${formatRp(p.remainingBudget ?? 0)}.`,
      `MULTI-CYCLE HORIZON:\n${snapshotLines || '- No snapshots loaded'}`,
      `${isBespokeOwner ? 'ACTIVE CYCLE & UPCOMING PAYLATER/SPINJAM ITEMS' : 'ACTIVE CYCLE & UPCOMING SCHEDULED OBLIGATIONS'}:\n${allItemsList.slice(0, 15).map((i: any) => `- #${i.id} [${String(i.month).padStart(2, '0')}/${i.year}] ${i.title} (${i.category}): ${formatRp(i.monthlyAmount)} ${i.isSettled ? '[PAID]' : '[UNPAID]'}`).join('\n') || '- None'}`,
      `CREDIT CARD CHARGES & CONTRACTS:\n${ccSummaryLines}`,
      `WISHLIST TARGETS:\n${wishlistLines}`,
      `SAVINGS RESERVE (${formatRp(totalVaultBalanceRp)} total, ${formatRp(rdpuBalanceRp)} RDPU) & GOALS:\n${savingsGoalLines || '- No goals configured'}`,
      `ROUTINE QUOTA TEMPLATES:\n${routineLines || '- None'}`,
      `SAVED USER PREFERENCES & MEMORY RULES:\n${
        memoryRules.length > 0
          ? memoryRules
              .map(
                (r) =>
                  `- [${r.id}] ${r.ruleText}${r.merchantPattern ? ` (keyword="${r.merchantPattern}" -> ${r.defaultInstrument || 'NOTE'})` : ''}`,
              )
              .join('\n')
          : '- No saved custom preferences yet.'
      }`,
      `DOMAIN BOUNDARY GUARDRAIL: You only execute Sunday Funday ERP financial tools. You have NO terminal, shell, OS filesystem, web downloader, or raw ExecuteSQL access. Politely refuse non-financial or system requests.`,
      ...(isBespokeOwner
        ? [
            `PAYOFF MILESTONES: JAN '27 (Oct SPinjam 3/3 retires +Rp 147.960/mo), FEB '27 (11.11 3x & Nov SPinjam 3/3 retire +Rp 522.010/mo), MAR '27 (SPinjam = Rp 0), SEP '27 (final 12x card installment matures).`,
          ]
        : []),
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
        paydayRules: isBespokeOwner
          ? '25th attendance & payslip cutoff + H+2 working days bank transfer'
          : `Monthly payday anchor on day ${studioConfig.paycycleFormulaConfig.paydayAnchorDay ?? 1}`,
      },
      multiCycleSnapshots,
      dueDayCalendar: {
        canonicalDueDays: isBespokeOwner ? [8, 11, 17, 23, 24, 25] : [1, 15, 25],
        cutoffRules: isBespokeOwner
          ? `SPayLater ${spayFormulaLabel} (due ${spayCfg?.dueDay ?? 25}th) · Permata CC ${ccCutoffLabel} closing (due ${ccCfg?.dueDay ?? 11}th + H-1 business day shift)`
          : spayCfg || ccCfg
            ? [
                spayCfg ? `${spayCfg.name} ${spayFormulaLabel} (due ${spayCfg.dueDay}th)` : null,
                ccCfg ? `${ccCfg.name} ${ccCutoffLabel} closing (due ${ccCfg.dueDay}th)` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'Standard monthly cashflow cycle (no credit instruments configured)',
        activeCycleItems,
      },
      payoffMilestones,
      vaultSummary: {
        totalVaultBalanceRp,
        rdpuBalanceRp,
      },
      recentTransactions,
      creditCardsAndContracts,
      wishlistItems,
      savingsGoals,
      activeSubscriptions,
      instrumentsConfig,
      uiContext: {
        activeRoute,
        activeSubTab,
        locale,
      },
      memoryRules,
      proactiveReminders,
      systemPrompt,
    };
  }
}
