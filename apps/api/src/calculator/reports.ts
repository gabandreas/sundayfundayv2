import { PayrollResult } from './payroll';
import { PacingResult } from './pacing';
import { AuditFlag } from './discipline';
import { ExecutiveLiquidityForecastReport } from './forecasting';
import { FixedEssentialsRealizationSummary } from './waterfall';

export type ReportScope = 'all' | 'locked';

export interface AllocationDiffRow {
  categoryKey:
    | 'DAILY_OPERATIONAL'
    | 'TRANSPORT'
    | 'INTERNET'
    | 'VAPE'
    | 'HAIRCUT'
    | 'BUFFER'
    | 'SAVINGS'
    | 'SELF_REWARD';
  label: string;
  tier:
    | 'UPFRONT_OPERATIONAL'
    | 'UPFRONT_FIXED'
    | 'UPFRONT_BUFFER'
    | 'P1_SAVINGS'
    | 'P2_REWARD';
  baselineTarget: number;
  revisedTarget: number;
  revisionDelta: number;
  revisionCount: number;
  actualOutcome: number;
  fundingVariance: number;
}

export interface ItemizedReportCreditCardCharge {
  id: number;
  label: string;
  category: string;
  chargeType: 'FULL' | 'INSTALLMENT' | 'RECURRING';
  chargeTypeLabel: string;
  sliceBadge: string | null;
  totalAmount: number;
  dueAmount: number;
  remainingPrincipalAfterPeriod: number;
  billingMonth: number;
  billingYear: number;
  isNewThisPeriod: boolean;
  endedAtLabel: string | null;
  transactionDate: string;
}

export interface ItemizedReportDailyExpense {
  id: number;
  label: string;
  amount: number;
  signedAmount: number;
  date: string;
  kind:
    | 'OPERATIONAL_EXPENSE'
    | 'FIXED_ESSENTIAL_EXPENSE'
    | 'OPERATIONAL_REFUND';
  kindLabel: string;
  fixedEssentialCategory: string | null;
  fixedEssentialCategoryLabel: string | null;
}

export interface RoutineBillRealizationRow {
  categoryKey: 'TRANSPORT' | 'INTERNET' | 'VAPE' | 'HAIRCUT';
  label: string;
  initialPlan: number;
  revisedBudget: number;
  revisionDelta: number;
  revisionCount: number;
  loggedRealization: number;
  coveredByPool: number;
  remainingPool: number;
  overage: number;
  statusLabel: string;
}

export interface CostDriverItem {
  key: string;
  label: string;
  amount: number;
  shareOfIncomePercent: number;
  detail: string;
}

export interface MonthSpikeItem {
  key: string;
  label: string;
  previousAmount: number;
  currentAmount: number;
  deltaAmount: number;
  deltaPercent: number | null;
  explanation: string;
}

export interface MoneyDriversAndSpikes {
  previousPeriodLabel: string | null;
  biggestCostDriversHeadline: string;
  costDrivers: CostDriverItem[];
  monthOverMonthHeadline: string;
  spikes: MonthSpikeItem[];
  budgetRevisionSummaryText: string | null;
}

export interface PaydayExecutionChecklist {
  creditDueDay: number;
  paylaterDueDay: number;
  step1SetAsideForDebt: {
    totalAmount: number;
    paylaterAmount: number;
    creditCardAmount: number;
    personalDebtAmount: number;
    contractInstallmentsAmount: number;
  };
  step2KeepInOperationalAccount: {
    totalAmount: number;
    fixedRoutinePoolAmount: number;
    fundedDailyLivingAmount: number;
    bufferPocketAmount: number;
  };
  step3TransferToSavingsVault: {
    fundedP1Savings: number;
    realizedInVault: number;
    pendingTransferAmount: number;
    transferStatus: 'TRANSFERRED' | 'PARTIAL' | 'PENDING' | 'NO_SAVINGS_FUNDED';
    statusLabel: string;
  };
  step4FreeSelfRewardAllowance: {
    fundedP2Allowance: number;
  };
}

export interface MoneyCycleStep4DailyLiving {
  initialPlan: number;
  currentMonthlyCap: number;
  fundedAmount: number;
  grossDailyExpensesLogged: number;
  fixedEssentialOverage: number;
  operationalRefundsOffset: number;
  netDailySpendUsed: number;
  remainingOperationalCash: number;
  safeToSpendToday: number;
  baselineDailyRate: number;
  daysInCycle: number;
  daysPassed: number;
  daysRemaining: number;
  cycleDateLabel: string;
  isEndDateConfirmed: boolean;
  pacingStatus: string;
  itemizedDailyExpenses: ItemizedReportDailyExpense[];
}

export interface MoneyCycleStep5SavingsBottomLine {
  p1Target: number;
  p1Baseline: number;
  p1Funded: number;
  realizedInVaultTotal: number;
  realizedInVaultLiquidCash: number;
  realizedInVaultInvestmentRdpu: number;
  untransferredP1Savings: number;
  vaultTotalBalance: number;
  vaultLiquidCashBalance: number;
  vaultInvestmentRdpuBalance: number;
  p2Target: number;
  p2Funded: number;
  netSavedAndLeftover: number;
  isDeficit: boolean;
  deficitUncovered: number;
  verdictStatus: 'SURPLUS' | 'BREAKEVEN' | 'DEFICIT';
  verdictHeadline: string;
  verdictDescription: string;
}

export interface MonthlyClosingStatement {
  month: number;
  year: number;
  periodLabel: string;
  workingDaysWindowLabel: string;
  status: 'DRAFT' | 'LOCKED' | 'UNINITIALIZED';
  generatedAtIso: string;
  payroll: PayrollResult & {
    incomeTransactions: Array<{
      id: number;
      label: string;
      amount: number;
      date: string;
    }>;
  };
  upfrontAndWaterfall: {
    paylaterBills: number;
    creditCardBills: number;
    personalDebtBills: number;
    contractInstallments: number;
    totalCreditBills: number;
    manualDeductions: number;
    totalDeductions: number;
    fixedEssentialsBaseline: number;
    fixedEssentialsRevised: number;
    fixedEssentialsActual: number;
    dailyOperationalBaseline: number;
    dailyOperationalRevised: number;
    actualDailyOperational: number;
    bufferPocketBaseline: number;
    bufferPocketRevised: number;
    actualBufferPocket: number;
    savingsBaseline: number;
    savingsRevised: number;
    actualSavings: number;
    selfRewardBaseline: number;
    selfRewardRevised: number;
    actualSelfReward: number;
    availableFunds: number;
    deficitUncovered: number;
    isDeficit: boolean;
    netRetainedSurplus: number; // actualSavings + actualSelfReward - deficitUncovered
    allocationDiffRows: AllocationDiffRow[];
  };
  pacing: PacingResult;
  governance: {
    disciplineScore: number;
    greenCount: number;
    yellowCount: number;
    redCount: number;
    ccUsage: number;
    ccUsageLimit: number;
    paylaterUsage: number;
    paylaterUsageLimit: number;
    budgetRevisionCount: number;
    realizedVaultDeposit: number;
    untransferredP1Savings: number;
  };
  moneyCycle: {
    kpis: {
      totalMoneyIn: number;
      netPaycheck: number;
      extraInflow: number;
      totalDebtAndBillsPaid: number;
      debtShareOfIncomePercent: number;
      livingAndRoutineSpend: number;
      livingShareOfIncomePercent: number;
      netSavedAndLeftover: number;
    };
    driversAndSpikes: MoneyDriversAndSpikes;
    paydayChecklist: PaydayExecutionChecklist;
    itemizedCreditCardCharges: ItemizedReportCreditCardCharge[];
    routineBillsRealization: {
      rows: RoutineBillRealizationRow[];
      totalInitialPlan: number;
      totalRevisedBudget: number;
      totalLoggedRealization: number;
      totalRemainingPool: number;
      totalOverage: number;
    };
    dailyLiving: MoneyCycleStep4DailyLiving;
    savingsBottomLine: MoneyCycleStep5SavingsBottomLine;
  };
}

export interface ComparativePeriodRow {
  month: number;
  year: number;
  periodLabel: string;
  status: 'DRAFT' | 'LOCKED';
  finalTotalIncome: number;
  creditBillsAmount: number;
  manualDeductionsAmount: number;
  fixedEssentialsAmount: number;
  actualDailyOperational: number;
  bufferPocketAmount: number;
  routineAndDailyLivingAmount: number;
  actualSavings: number;
  selfReward: number;
  deficitUncovered: number;
  creditDebtRatioPercent: number;
  savingsRatePercent: number;
  disciplineScore: number;
  realizedVaultAmount: number;
  incomeMoMDelta: number | null;
  incomeMoMPercent: number | null;
  creditBillsMoMDelta: number | null;
  savingsMoMDelta: number | null;
  disciplineMoMDelta: number | null;
  changeVsLastMonthSummary: string;
}

export interface MultiPeriodComparativeStatement {
  scope: ReportScope;
  periodCount: number;
  periods: ComparativePeriodRow[];
  totals: {
    totalIncome: number;
    totalCreditBills: number;
    totalManualDeductions: number;
    totalFixedEssentials: number;
    totalDailyOperational: number;
    totalBufferPocket: number;
    totalSavings: number;
    totalSelfReward: number;
    totalRealizedVault: number;
    averageCreditDebtRatioPercent: number;
    averageSavingsRatePercent: number;
    averageDisciplineScore: number;
  };
}

export interface AmortizationSliceDetail {
  label: string;
  amount: number;
  sliceBadge: string;
  isFinalSlice: boolean;
  sourceKind: 'CC_INSTALLMENT' | 'CONTRACT';
}

export interface AmortizationSubscriptionDetail {
  label: string;
  amount: number;
  endedAtLabel: string | null;
  isFinalMonth: boolean;
}

export interface AmortizationMonthRow {
  month: number;
  year: number;
  periodLabel: string;
  paylaterAmount: number;
  creditCardAmount: number;
  personalDebtAmount: number;
  contractInstallmentsAmount: number;
  totalLiabilityDue: number;
  cumulativeSettledPercent: number;
  activeInstallmentSlices: AmortizationSliceDetail[];
  activeSubscriptions: AmortizationSubscriptionDetail[];
  droppingOffAfterThisMonth: string[];
}

export interface LiabilityAmortizationSchedule {
  startMonth: number;
  startYear: number;
  months: AmortizationMonthRow[];
  summary: {
    total12MonthObligations: number;
    totalPaylater12M: number;
    totalCreditCard12M: number;
    totalPersonalDebt12M: number;
    totalContracts12M: number;
    peakMonthLabel: string;
    peakMonthAmount: number;
    firstDebtFreeMonthLabel: string | null;
  };
}

export interface DossierRevisionItem {
  id: number;
  month: number;
  year: number;
  periodLabel: string;
  category: string;
  categoryLabel: string;
  previousValue: number;
  newValue: number;
  difference: number;
  reason: string;
  createdAt: string;
}

export interface DossierPeriodAuditItem {
  month: number;
  year: number;
  periodLabel: string;
  status: 'DRAFT' | 'LOCKED';
  disciplineScore: number;
  greenCount: number;
  redCount: number;
  flags: AuditFlag[];
}

export interface DossierGovernanceLogItem {
  id: number;
  action: string;
  actionLabel: string;
  category: string;
  categoryLabel: string;
  severity: string;
  summary: string;
  details: string | null;
  month: number | null;
  year: number | null;
  createdAt: string;
}

export interface BudgetRevisionAndDisciplineDossier {
  revisions: DossierRevisionItem[];
  periodAudits: DossierPeriodAuditItem[];
  recentGovernanceLogs: DossierGovernanceLogItem[];
}

export interface ExecutiveReportPayload {
  selectedMonth: number;
  selectedYear: number;
  scope: ReportScope;
  profileMode?: 'SUPERADMIN_BESPOKE' | 'STANDARD_GENERAL';
  closingStatement: MonthlyClosingStatement;
  comparativeStatement: MultiPeriodComparativeStatement;
  amortizationSchedule: LiabilityAmortizationSchedule;
  dossier: BudgetRevisionAndDisciplineDossier;
  liquidityForecast: ExecutiveLiquidityForecastReport;
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatIdrPlain(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return amount < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export function formatReportPeriodLabel(month: number, year: number): string {
  const m = SHORT_MONTHS[Math.max(0, Math.min(11, month - 1))] ?? String(month);
  return `${m} ${year}`;
}

export function formatRevisionCategoryLabel(
  category: string,
  customLabels?: Record<string, string>,
): string {
  const defaultLabels: Record<string, string> = {
    DAILY_OPERATIONAL: 'Daily Living & Food Budget',
    SAVINGS: 'Core Savings (P1)',
    SELF_REWARD: 'Self-Reward / Surplus (P2)',
    BUFFER: 'Emergency Buffer Pocket',
    TRANSPORT: 'Routine Bill: Transport',
    INTERNET: 'Routine Bill: Internet',
    VAPE: 'Routine Bill: Vape',
    HAIRCUT: 'Routine Bill: Haircut',
  };
  const labels = { ...defaultLabels, ...customLabels };
  return labels[category] ?? category;
}

export function formatGovernanceActionLabel(action: string): string {
  const labels: Record<string, string> = {
    BUDGET_TARGET_REVISED: 'Budget Target Edited',
    REVISE_BUDGET_TARGET: 'Budget Target Edited',
    CREDIT_LIMIT_EXCEEDED: 'Credit Usage Cap Breached',
    CASH_RECONCILIATION: 'Real Cash Balance Reconciled',
    RECONCILE_CASH_BALANCE: 'Real Cash Balance Reconciled',
    CLOSE_PERIOD: 'Period Closed & Locked',
    SAVINGS_TOPUP: 'Savings Vault Deposit',
    SETTLE_CC_INSTALLMENT_EARLY: 'Installment Settled Early',
    REBALANCE_SAVINGS_INSTRUMENT: 'Savings Vault Rebalanced',
    RESTORE_DATABASE_BACKUP: 'Database Backup Restored',
  };
  return labels[action] ?? action.replace(/_/g, ' ');
}

export function formatGovernanceCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    OPERATIONAL_BUDGET: 'Daily Living Budget',
    SELF_REWARD: 'Self-Reward (P2)',
    DEBT_BURDEN: 'Debt & Credit Bills',
    LIABILITIES: 'Debt & Credit Bills',
    SAVINGS: 'Core Savings (P1)',
    SAVINGS_VAULT: 'Savings Vault',
    INFORMAL_DEBT: 'Personal & Informal Debt',
    DEFICIT: 'Deficit Protection',
    SETTINGS: 'System Configuration',
  };
  return labels[category] ?? category.replace(/_/g, ' ');
}

export interface BuildAllocationDiffInput {
  globalDefaults: {
    dailyOperational: number;
    transport: number;
    internet: number;
    vape: number;
    haircut: number;
    bufferPocket: number;
    savings: number;
    selfRewardTarget: number;
  };
  currentTargets: {
    dailyOperational: number;
    transport: number;
    internet: number;
    vape: number;
    haircut: number;
    bufferPocket: number;
    savings: number;
    selfRewardTarget: number;
  };
  actuals: {
    actualDailyOperational: number;
    actualSavings: number;
    actualSelfReward: number;
    isDeficit: boolean;
  };
  revisions: Array<{
    category: string;
    previousValue: number;
    newValue: number;
    createdAt: Date | string;
  }>;
  customLabels?: Record<string, string>;
}

export function buildAllocationDiffRows(
  input: BuildAllocationDiffInput,
): AllocationDiffRow[] {
  const sortedRevs = [...input.revisions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  function resolveBaselineAndCount(
    categoryKey: AllocationDiffRow['categoryKey'],
    currentTarget: number,
  ): { baseline: number; count: number } {
    const matching = sortedRevs.filter((r) => r.category === categoryKey);
    if (matching.length > 0) {
      return {
        baseline: matching[0].previousValue,
        count: matching.length,
      };
    }
    return {
      baseline: currentTarget,
      count: 0,
    };
  }

  const custom = input.customLabels ?? {};

  const rows: Array<{
    categoryKey: AllocationDiffRow['categoryKey'];
    label: string;
    tier: AllocationDiffRow['tier'];
    revisedTarget: number;
    actualOutcome: number;
  }> = [
    {
      categoryKey: 'DAILY_OPERATIONAL',
      label: custom.DAILY_OPERATIONAL ?? 'Daily Living & Food Budget',
      tier: 'UPFRONT_OPERATIONAL',
      revisedTarget: input.currentTargets.dailyOperational,
      actualOutcome: input.actuals.actualDailyOperational,
    },
    {
      categoryKey: 'TRANSPORT',
      label: custom.TRANSPORT ?? 'Routine Bill: Transport',
      tier: 'UPFRONT_FIXED',
      revisedTarget: input.currentTargets.transport,
      actualOutcome: input.actuals.isDeficit
        ? 0
        : input.currentTargets.transport,
    },
    {
      categoryKey: 'INTERNET',
      label: custom.INTERNET ?? 'Routine Bill: Internet',
      tier: 'UPFRONT_FIXED',
      revisedTarget: input.currentTargets.internet,
      actualOutcome: input.actuals.isDeficit
        ? 0
        : input.currentTargets.internet,
    },
    {
      categoryKey: 'VAPE',
      label: custom.VAPE ?? 'Routine Bill: Vape',
      tier: 'UPFRONT_FIXED',
      revisedTarget: input.currentTargets.vape,
      actualOutcome: input.actuals.isDeficit ? 0 : input.currentTargets.vape,
    },
    {
      categoryKey: 'HAIRCUT',
      label: custom.HAIRCUT ?? 'Routine Bill: Haircut',
      tier: 'UPFRONT_FIXED',
      revisedTarget: input.currentTargets.haircut,
      actualOutcome: input.actuals.isDeficit ? 0 : input.currentTargets.haircut,
    },
    {
      categoryKey: 'BUFFER',
      label: 'Emergency Buffer Pocket',
      tier: 'UPFRONT_BUFFER',
      revisedTarget: input.currentTargets.bufferPocket,
      actualOutcome: input.actuals.isDeficit
        ? 0
        : input.currentTargets.bufferPocket,
    },
    {
      categoryKey: 'SAVINGS',
      label: 'Core Savings (Priority 1)',
      tier: 'P1_SAVINGS',
      revisedTarget: input.currentTargets.savings,
      actualOutcome: input.actuals.actualSavings,
    },
    {
      categoryKey: 'SELF_REWARD',
      label: 'Self-Reward / Surplus (Priority 2)',
      tier: 'P2_REWARD',
      revisedTarget: input.currentTargets.selfRewardTarget,
      actualOutcome: input.actuals.actualSelfReward,
    },
  ];

  return rows.map((r) => {
    const { baseline, count } = resolveBaselineAndCount(
      r.categoryKey,
      r.revisedTarget,
    );
    return {
      categoryKey: r.categoryKey,
      label: r.label,
      tier: r.tier,
      baselineTarget: baseline,
      revisedTarget: r.revisedTarget,
      revisionDelta: r.revisedTarget - baseline,
      revisionCount: count,
      actualOutcome: r.actualOutcome,
      fundingVariance: r.actualOutcome - r.revisedTarget,
    };
  });
}

export function buildRoutineBillsRealizationRows(
  allocationDiffRows: AllocationDiffRow[],
  realizationSummary: FixedEssentialsRealizationSummary,
  customLabels?: Record<string, string>,
): {
  rows: RoutineBillRealizationRow[];
  totalInitialPlan: number;
  totalRevisedBudget: number;
  totalLoggedRealization: number;
  totalRemainingPool: number;
  totalOverage: number;
} {
  const fixedKeys: Array<'TRANSPORT' | 'INTERNET' | 'VAPE' | 'HAIRCUT'> = [
    'TRANSPORT',
    'INTERNET',
    'VAPE',
    'HAIRCUT',
  ];
  const defaultLabelMap: Record<
    'TRANSPORT' | 'INTERNET' | 'VAPE' | 'HAIRCUT',
    string
  > = {
    TRANSPORT: 'Transport & Fuel',
    INTERNET: 'Internet & Data Package',
    VAPE: 'Vape Supplies',
    HAIRCUT: 'Haircut & Grooming',
  };
  const labelMap = { ...defaultLabelMap, ...customLabels };

  const rows: RoutineBillRealizationRow[] = fixedKeys.map((key) => {
    const diffRow = allocationDiffRows.find((r) => r.categoryKey === key);
    const realItem = realizationSummary.items.find((i) => i.category === key);
    const initialPlan = diffRow?.baselineTarget ?? realItem?.target ?? 0;
    const revisedBudget = diffRow?.revisedTarget ?? realItem?.target ?? 0;
    const revisionDelta = diffRow?.revisionDelta ?? revisedBudget - initialPlan;
    const revisionCount = diffRow?.revisionCount ?? 0;
    const loggedRealization = realItem?.spent ?? 0;
    const coveredByPool = realItem?.coveredByPool ?? 0;
    const remainingPool = realItem?.remainingPool ?? revisedBudget;
    const overage = realItem?.overage ?? 0;

    let statusLabel = 'Within Pool';
    if (revisedBudget === 0 && loggedRealization === 0) {
      statusLabel = 'Zeroed Out';
    } else if (overage > 0) {
      statusLabel = `Exceeded by ${formatIdrPlain(overage)}`;
    } else if (loggedRealization === 0) {
      statusLabel = 'Reserved in Pool';
    } else if (remainingPool === 0) {
      statusLabel = '100% Used';
    }

    return {
      categoryKey: key,
      label: labelMap[key],
      initialPlan,
      revisedBudget,
      revisionDelta,
      revisionCount,
      loggedRealization,
      coveredByPool,
      remainingPool,
      overage,
      statusLabel,
    };
  });

  return {
    rows,
    totalInitialPlan: rows.reduce((s, r) => s + r.initialPlan, 0),
    totalRevisedBudget: rows.reduce((s, r) => s + r.revisedBudget, 0),
    totalLoggedRealization: rows.reduce((s, r) => s + r.loggedRealization, 0),
    totalRemainingPool: rows.reduce((s, r) => s + r.remainingPool, 0),
    totalOverage: rows.reduce((s, r) => s + r.overage, 0),
  };
}

export function buildMoneyDriversAndSpikes(input: {
  periodLabel: string;
  finalTotalIncome: number;
  paylaterBills: number;
  creditCardBills: number;
  personalDebtBills: number;
  contractInstallments: number;
  totalCreditBills: number;
  fixedEssentialsRevised: number;
  dailyOperationalBaseline: number;
  dailyOperationalRevised: number;
  actualDailyOperational: number;
  manualDeductions: number;
  actualSavings: number;
  savingsRevised: number;
  isDeficit: boolean;
  deficitUncovered: number;
  newCreditCardChargesInPeriod: Array<{ label: string; dueAmount: number }>;
  allocationDiffRows: AllocationDiffRow[];
  previousPeriod: {
    periodLabel: string;
    finalTotalIncome: number;
    paylaterBills: number;
    creditCardBills: number;
    personalDebtBills: number;
    contractInstallments: number;
    totalCreditBills: number;
    dailyOperational: number;
    manualDeductions: number;
    actualSavings: number;
  } | null;
}): MoneyDriversAndSpikes {
  const inc = Math.max(1, input.finalTotalIncome);
  const debtPct = Math.round((input.totalCreditBills / inc) * 1000) / 10;
  const livingTotal =
    input.fixedEssentialsRevised +
    input.actualDailyOperational +
    input.manualDeductions;
  const livingPct = Math.round((livingTotal / inc) * 1000) / 10;

  const costDrivers: CostDriverItem[] = [
    {
      key: 'PAYLATER',
      label: 'PayLater Statement',
      amount: input.paylaterBills,
      shareOfIncomePercent: Math.round((input.paylaterBills / inc) * 1000) / 10,
      detail: 'Deducted upfront on payday (25th)',
    },
    {
      key: 'CREDIT_CARD',
      label: 'Credit Card Statement',
      amount: input.creditCardBills,
      shareOfIncomePercent:
        Math.round((input.creditCardBills / inc) * 1000) / 10,
      detail:
        input.newCreditCardChargesInPeriod.length > 0
          ? `Includes ${input.newCreditCardChargesInPeriod.length} new charges billed in ${input.periodLabel}`
          : 'Active installment slices & recurring subscriptions',
    },
    {
      key: 'DAILY_LIVING',
      label: 'Daily Living & Routine Bills',
      amount: livingTotal,
      shareOfIncomePercent: livingPct,
      detail: `Routine bills ${formatIdrPlain(input.fixedEssentialsRevised)} + Daily living ${formatIdrPlain(input.actualDailyOperational)} + Logged spend ${formatIdrPlain(input.manualDeductions)}`,
    },
    {
      key: 'PERSONAL_DEBT',
      label: 'Personal & Pre-Payday Debt',
      amount: input.personalDebtBills + input.contractInstallments,
      shareOfIncomePercent:
        Math.round(
          ((input.personalDebtBills + input.contractInstallments) / inc) * 1000,
        ) / 10,
      detail: 'Informal borrowing & fixed contract installments',
    },
  ].sort((a, b) => b.amount - a.amount);

  const biggestCostDriversHeadline =
    input.totalCreditBills >= livingTotal
      ? `Total Debt & Credit Bills consumed ${debtPct}% of your Money In (${formatIdrPlain(input.totalCreditBills)} of ${formatIdrPlain(input.finalTotalIncome)}) — driven by PayLater (${formatIdrPlain(input.paylaterBills)}), Credit Card Statement (${formatIdrPlain(input.creditCardBills)}), and Personal Debt (${formatIdrPlain(input.personalDebtBills)}).`
      : `Living & Routine Spend consumed ${livingPct}% of your Money In (${formatIdrPlain(livingTotal)} of ${formatIdrPlain(input.finalTotalIncome)}), while Debt & Credit Bills took ${debtPct}% (${formatIdrPlain(input.totalCreditBills)}).`;

  const spikes: MonthSpikeItem[] = [];
  let monthOverMonthHeadline = `No prior month snapshot before ${input.periodLabel} for month-over-month spike comparison.`;

  if (input.previousPeriod) {
    const prev = input.previousPeriod;
    const ccDelta = input.creditCardBills - prev.creditCardBills;
    const plDelta = input.paylaterBills - prev.paylaterBills;
    const pdDelta = input.personalDebtBills - prev.personalDebtBills;
    const totalDebtDelta = input.totalCreditBills - prev.totalCreditBills;

    const newChargeNames = input.newCreditCardChargesInPeriod
      .slice(0, 4)
      .map((c) => `${c.label} (${formatIdrPlain(c.dueAmount)})`)
      .join(', ');

    spikes.push({
      key: 'CREDIT_CARD_DELTA',
      label: 'Credit Card Statement vs Last Month',
      previousAmount: prev.creditCardBills,
      currentAmount: input.creditCardBills,
      deltaAmount: ccDelta,
      deltaPercent:
        prev.creditCardBills > 0
          ? Math.round((ccDelta / prev.creditCardBills) * 1000) / 10
          : null,
      explanation:
        ccDelta > 0 && newChargeNames
          ? `Increased due to new charges in ${input.periodLabel}: ${newChargeNames}`
          : ccDelta < 0
            ? `Decreased after one-time charges from ${prev.periodLabel} dropped off`
            : 'Unchanged from last month',
    });

    spikes.push({
      key: 'PAYLATER_DELTA',
      label: 'PayLater Bill vs Last Month',
      previousAmount: prev.paylaterBills,
      currentAmount: input.paylaterBills,
      deltaAmount: plDelta,
      deltaPercent:
        prev.paylaterBills > 0
          ? Math.round((plDelta / prev.paylaterBills) * 1000) / 10
          : null,
      explanation:
        plDelta > 0
          ? `PayLater obligations grew by +${formatIdrPlain(plDelta)} compared to ${prev.periodLabel}`
          : plDelta < 0
            ? `PayLater obligations decreased by ${formatIdrPlain(Math.abs(plDelta))} compared to ${prev.periodLabel}`
            : 'Unchanged from last month',
    });

    spikes.push({
      key: 'PERSONAL_DEBT_DELTA',
      label: 'Personal Debt vs Last Month',
      previousAmount: prev.personalDebtBills,
      currentAmount: input.personalDebtBills,
      deltaAmount: pdDelta,
      deltaPercent:
        prev.personalDebtBills > 0
          ? Math.round((pdDelta / prev.personalDebtBills) * 1000) / 10
          : null,
      explanation:
        pdDelta > 0
          ? `Pre-payday personal debt rose by +${formatIdrPlain(pdDelta)}`
          : pdDelta < 0
            ? `Personal debt reduced by ${formatIdrPlain(Math.abs(pdDelta))} vs ${prev.periodLabel}`
            : 'Unchanged from last month',
    });

    monthOverMonthHeadline =
      totalDebtDelta > 0
        ? `Compared to ${prev.periodLabel}, total Debt & Credit Bills rose by +${formatIdrPlain(totalDebtDelta)} (${formatIdrPlain(prev.totalCreditBills)} → ${formatIdrPlain(input.totalCreditBills)}).`
        : totalDebtDelta < 0
          ? `Compared to ${prev.periodLabel}, total Debt & Credit Bills dropped by ${formatIdrPlain(Math.abs(totalDebtDelta))} (${formatIdrPlain(prev.totalCreditBills)} → ${formatIdrPlain(input.totalCreditBills)}).`
          : `Total Debt & Credit Bills remained steady vs ${prev.periodLabel} at ${formatIdrPlain(input.totalCreditBills)}.`;
  }

  const revisedRows = input.allocationDiffRows.filter(
    (r) => r.revisionDelta !== 0,
  );
  let budgetRevisionSummaryText: string | null = null;
  if (revisedRows.length > 0) {
    const parts = revisedRows.map(
      (r) =>
        `${r.label} (${formatIdrPlain(r.baselineTarget)} → ${formatIdrPlain(r.revisedTarget)}, ${r.revisionDelta > 0 ? '+' : ''}${formatIdrPlain(r.revisionDelta)})`,
    );
    budgetRevisionSummaryText = `Mid-month budget edits applied in ${input.periodLabel}: ${parts.join('; ')}.${input.isDeficit ? ` Despite reducing targets, total bills & spend still exceed Money In by ${formatIdrPlain(input.deficitUncovered)}.` : ' These target adjustments kept the period balanced.'}`;
  }

  return {
    previousPeriodLabel: input.previousPeriod?.periodLabel ?? null,
    biggestCostDriversHeadline,
    costDrivers,
    monthOverMonthHeadline,
    spikes,
    budgetRevisionSummaryText,
  };
}

export function buildComparativeStatement(
  scope: ReportScope,
  rawRows: Array<{
    month: number;
    year: number;
    status: 'DRAFT' | 'LOCKED';
    finalTotalIncome: number;
    creditBillsAmount: number;
    manualDeductionsAmount: number;
    fixedEssentialsAmount: number;
    actualDailyOperational: number;
    bufferPocketAmount: number;
    actualSavings: number;
    selfReward: number;
    deficitUncovered: number;
    disciplineScore: number;
    realizedVaultAmount: number;
  }>,
): MultiPeriodComparativeStatement {
  const sorted = [...rawRows].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  );

  const periods: ComparativePeriodRow[] = sorted.map((row, idx) => {
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const creditDebtRatioPercent =
      row.finalTotalIncome > 0
        ? Math.round((row.creditBillsAmount / row.finalTotalIncome) * 1000) / 10
        : 0;
    const savingsRatePercent =
      row.finalTotalIncome > 0
        ? Math.round((row.actualSavings / row.finalTotalIncome) * 1000) / 10
        : 0;

    const incomeMoMDelta = prev
      ? row.finalTotalIncome - prev.finalTotalIncome
      : null;
    const incomeMoMPercent =
      prev && prev.finalTotalIncome > 0
        ? Math.round(
            ((row.finalTotalIncome - prev.finalTotalIncome) /
              prev.finalTotalIncome) *
              1000,
          ) / 10
        : null;
    const creditBillsMoMDelta = prev
      ? row.creditBillsAmount - prev.creditBillsAmount
      : null;
    const savingsMoMDelta = prev ? row.actualSavings - prev.actualSavings : null;
    const routineAndDailyLivingAmount =
      row.fixedEssentialsAmount +
      row.actualDailyOperational +
      row.bufferPocketAmount +
      row.manualDeductionsAmount;

    let changeVsLastMonthSummary = 'First recorded period';
    if (prev) {
      const debtDiff = row.creditBillsAmount - prev.creditBillsAmount;
      const saveDiff = row.actualSavings - prev.actualSavings;
      const debtStr =
        debtDiff === 0
          ? 'Debt flat'
          : `Debt ${debtDiff > 0 ? '+' : ''}${formatIdrPlain(debtDiff)}`;
      const saveStr =
        saveDiff === 0
          ? 'Saved flat'
          : `Saved ${saveDiff > 0 ? '+' : ''}${formatIdrPlain(saveDiff)}`;
      changeVsLastMonthSummary = `${debtStr} · ${saveStr}`;
    }

    return {
      month: row.month,
      year: row.year,
      periodLabel: formatReportPeriodLabel(row.month, row.year),
      status: row.status,
      finalTotalIncome: row.finalTotalIncome,
      creditBillsAmount: row.creditBillsAmount,
      manualDeductionsAmount: row.manualDeductionsAmount,
      fixedEssentialsAmount: row.fixedEssentialsAmount,
      actualDailyOperational: row.actualDailyOperational,
      bufferPocketAmount: row.bufferPocketAmount,
      routineAndDailyLivingAmount,
      actualSavings: row.actualSavings,
      selfReward: row.selfReward,
      deficitUncovered: row.deficitUncovered,
      creditDebtRatioPercent,
      savingsRatePercent,
      disciplineScore: row.disciplineScore,
      realizedVaultAmount: row.realizedVaultAmount,
      incomeMoMDelta,
      incomeMoMPercent,
      creditBillsMoMDelta,
      savingsMoMDelta,
      disciplineMoMDelta: prev
        ? row.disciplineScore - prev.disciplineScore
        : null,
      changeVsLastMonthSummary,
    };
  });

  const totalIncome = periods.reduce((s, p) => s + p.finalTotalIncome, 0);
  const totalCreditBills = periods.reduce((s, p) => s + p.creditBillsAmount, 0);
  const totalManualDeductions = periods.reduce(
    (s, p) => s + p.manualDeductionsAmount,
    0,
  );
  const totalFixedEssentials = periods.reduce(
    (s, p) => s + p.fixedEssentialsAmount,
    0,
  );
  const totalDailyOperational = periods.reduce(
    (s, p) => s + p.actualDailyOperational,
    0,
  );
  const totalBufferPocket = periods.reduce(
    (s, p) => s + p.bufferPocketAmount,
    0,
  );
  const totalSavings = periods.reduce((s, p) => s + p.actualSavings, 0);
  const totalSelfReward = periods.reduce((s, p) => s + p.selfReward, 0);
  const totalRealizedVault = periods.reduce(
    (s, p) => s + p.realizedVaultAmount,
    0,
  );

  const averageCreditDebtRatioPercent =
    totalIncome > 0
      ? Math.round((totalCreditBills / totalIncome) * 1000) / 10
      : 0;
  const averageSavingsRatePercent =
    totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 1000) / 10 : 0;
  const averageDisciplineScore =
    periods.length > 0
      ? Math.round(
          periods.reduce((s, p) => s + p.disciplineScore, 0) / periods.length,
        )
      : 0;

  return {
    scope,
    periodCount: periods.length,
    periods,
    totals: {
      totalIncome,
      totalCreditBills,
      totalManualDeductions,
      totalFixedEssentials,
      totalDailyOperational,
      totalBufferPocket,
      totalSavings,
      totalSelfReward,
      totalRealizedVault,
      averageCreditDebtRatioPercent,
      averageSavingsRatePercent,
      averageDisciplineScore,
    },
  };
}

export function buildAmortizationSchedule(
  startMonth: number,
  startYear: number,
  rawMonths: Array<{
    month: number;
    year: number;
    paylaterAmount: number;
    creditCardAmount: number;
    personalDebtAmount: number;
    contractInstallmentsAmount: number;
    activeInstallmentSlices?: AmortizationSliceDetail[];
    activeSubscriptions?: AmortizationSubscriptionDetail[];
  }>,
): LiabilityAmortizationSchedule {
  const total12MonthObligations = rawMonths.reduce(
    (s, m) =>
      s +
      m.paylaterAmount +
      m.creditCardAmount +
      m.personalDebtAmount +
      m.contractInstallmentsAmount,
    0,
  );

  let runningCumulative = 0;
  let peakMonthLabel = '—';
  let peakMonthAmount = 0;
  let firstDebtFreeMonthLabel: string | null = null;

  const months: AmortizationMonthRow[] = rawMonths.map((m) => {
    const totalLiabilityDue =
      m.paylaterAmount +
      m.creditCardAmount +
      m.personalDebtAmount +
      m.contractInstallmentsAmount;
    runningCumulative += totalLiabilityDue;
    const periodLabel = formatReportPeriodLabel(m.month, m.year);

    if (totalLiabilityDue > peakMonthAmount) {
      peakMonthAmount = totalLiabilityDue;
      peakMonthLabel = periodLabel;
    }

    if (totalLiabilityDue === 0 && firstDebtFreeMonthLabel === null) {
      firstDebtFreeMonthLabel = periodLabel;
    }

    const cumulativeSettledPercent =
      total12MonthObligations > 0
        ? Math.round((runningCumulative / total12MonthObligations) * 1000) / 10
        : 100;

    const activeInstallmentSlices = m.activeInstallmentSlices ?? [];
    const activeSubscriptions = m.activeSubscriptions ?? [];
    const droppingOffAfterThisMonth = [
      ...activeInstallmentSlices
        .filter((s) => s.isFinalSlice)
        .map((s) => `${s.label} (${s.sliceBadge} final)`),
      ...activeSubscriptions
        .filter((sub) => sub.isFinalMonth)
        .map((sub) => `${sub.label} (ends ${periodLabel})`),
    ];

    return {
      month: m.month,
      year: m.year,
      periodLabel,
      paylaterAmount: m.paylaterAmount,
      creditCardAmount: m.creditCardAmount,
      personalDebtAmount: m.personalDebtAmount,
      contractInstallmentsAmount: m.contractInstallmentsAmount,
      totalLiabilityDue,
      cumulativeSettledPercent,
      activeInstallmentSlices,
      activeSubscriptions,
      droppingOffAfterThisMonth,
    };
  });

  return {
    startMonth,
    startYear,
    months,
    summary: {
      total12MonthObligations,
      totalPaylater12M: rawMonths.reduce((s, m) => s + m.paylaterAmount, 0),
      totalCreditCard12M: rawMonths.reduce((s, m) => s + m.creditCardAmount, 0),
      totalPersonalDebt12M: rawMonths.reduce(
        (s, m) => s + m.personalDebtAmount,
        0,
      ),
      totalContracts12M: rawMonths.reduce(
        (s, m) => s + m.contractInstallmentsAmount,
        0,
      ),
      peakMonthLabel,
      peakMonthAmount,
      firstDebtFreeMonthLabel,
    },
  };
}
