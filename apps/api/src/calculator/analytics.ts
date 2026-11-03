export type AnalyticsScope = 'all' | 'locked';

export interface AnalyticsTransactionInput {
  type: string; // 'INCOME' | 'DEDUCTION' | 'CREDIT_BILL'
  sourceType: string; // 'MANUAL' | 'CONTRACT' | 'CC_TRANSACTION' | 'BULK_BILL' | 'PERSONAL_DEBT'
  label: string;
  amount: number;
}

export interface AnalyticsSnapshotInput {
  month: number;
  year: number;
  status: string; // 'DRAFT' | 'LOCKED'
  finalTotalIncome: number;
  totalDeductions: number;
  actualDailyOperational: number;
  dailyOperationalTarget: number;
  transport: number;
  internet: number;
  vape: number;
  haircut: number;
  savingsTarget: number;
  actualSavings: number;
  selfReward: number;
  bufferPocket: number;
  deficitUncovered: number;
  survivalPocket: number;
  transactions?: AnalyticsTransactionInput[];
}

export interface AnalyticsSavingsTransactionInput {
  amount: number;
  label: string;
  date: Date | string;
}

export interface AnalyticsCalculationInput {
  snapshots: AnalyticsSnapshotInput[];
  savingsTransactions: AnalyticsSavingsTransactionInput[];
  scope?: AnalyticsScope;
  totalAvailableSnapshotsCount?: number;
  lockedSnapshotsCount?: number;
}

export interface AnalyticsKpis {
  averageMonthlyIncome: number;
  averageMonthlySavings: number;
  aggregateSavingsRate: number;
  savingsRateTarget: number;
  savingsRateStatus: 'OPTIMAL' | 'BELOW_TARGET';
  cumulativeVaultInflow: number;
  cumulativeVaultOutflow: number;
  netVaultBalance: number;
  cumulativePlannedSavings: number;
  cumulativeSavingsTarget: number;
  vaultRealizationRatePercent: number;
  untransferredPlannedSavings: number;
  totalIncomeAcrossPeriods: number;
  totalOutflowAcrossPeriods: number;
  totalLiabilitiesAcrossPeriods: number;
  totalCreditBillsAcrossPeriods: number;
  totalEssentialAndFixedAcrossPeriods: number;
  totalOperationalAndFixedAcrossPeriods: number;
  totalSelfRewardAcrossPeriods: number;
  totalRetainedAndSurplusAcrossPeriods: number;
  overallDebtRatioPercent: number;
  overallCreditDebtRatioPercent: number;
}

export interface CashflowPeriodEntry {
  month: number;
  year: number;
  periodLabel: string;
  status: 'DRAFT' | 'LOCKED';
  totalIncome: number;
  totalLiabilitiesAndDeductions: number;
  creditBillsAmount: number;
  manualDeductionsAmount: number;
  essentialOutflow: number;
  operationalAndFixedOutflow: number;
  actualDailyOperational: number;
  fixedExpenses: number;
  bufferPocket: number;
  totalOutflow: number;
  actualSavings: number;
  savingsTarget: number;
  selfRewardSurplus: number;
  totalRetainedAndSurplus: number;
  deficitUncovered: number;
  savingsRatePercent: number;
  debtRatioPercent: number;
  creditDebtRatioPercent: number;
}

export interface CategorySubItem {
  key: string;
  label: string;
  amount: number;
  shareOfCategoryPercent: number;
  shareOfIncomePercent: number;
}

export type MacroCategoryKey =
  | 'LIABILITIES_DEBT'
  | 'DAILY_OPERATIONAL'
  | 'FIXED_ESSENTIALS'
  | 'CORE_SAVINGS'
  | 'SELF_REWARD_SURPLUS'
  | 'BUFFER_POCKET';

export interface CategoryDistributionEntry {
  key: MacroCategoryKey;
  label: string;
  totalAmount: number;
  monthlyAverage: number;
  shareOfIncomePercent: number;
  shareOfOutflowPercent: number;
  subItems: CategorySubItem[];
}

export interface TrajectoryMilestone {
  month: number;
  year: number;
  periodLabel: string;
  debtRatioPercent: number;
  savingsRatePercent: number;
  totalLiabilitiesAndDeductions: number;
  totalRetainedAndSurplus: number;
}

export interface TrajectorySummary {
  peakDebtPeriod: TrajectoryMilestone | null;
  lowestDebtPeriod: TrajectoryMilestone | null;
  debtSafeInflectionPeriod: TrajectoryMilestone | null;
  surplusCrossoverPeriod: TrajectoryMilestone | null;
  firstPeriodDebtRatioPercent: number;
  lastPeriodDebtRatioPercent: number;
  debtRatioDeltaPts: number;
}

export interface AnalyticsReportResult {
  scope: AnalyticsScope;
  periodCount: number;
  lockedCount: number;
  draftCount: number;
  totalAvailableSnapshotsCount: number;
  lockedSnapshotsCount: number;
  dateRangeLabel: string;
  kpis: AnalyticsKpis;
  cashflowSeries: CashflowPeriodEntry[];
  categoryDistribution: CategoryDistributionEntry[];
  trajectorySummary: TrajectorySummary;
}

const MONTH_SHORT_NAMES = [
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

export function formatPeriodShortLabel(month: number, year: number): string {
  const name = MONTH_SHORT_NAMES[month - 1] ?? `M${month}`;
  return `${name} ${year}`;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculateAnalytics(
  input: AnalyticsCalculationInput,
): AnalyticsReportResult {
  const scope: AnalyticsScope = input.scope === 'locked' ? 'locked' : 'all';

  // Sort chronologically
  const sortedSnapshots = [...input.snapshots].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  );

  const periodCount = sortedSnapshots.length;
  const lockedCount = sortedSnapshots.filter((s) => s.status === 'LOCKED').length;
  const draftCount = periodCount - lockedCount;

  const totalAvailableSnapshotsCount =
    input.totalAvailableSnapshotsCount ?? periodCount;
  const lockedSnapshotsCount = input.lockedSnapshotsCount ?? lockedCount;

  const dateRangeLabel =
    periodCount === 0
      ? 'No periods recorded'
      : periodCount === 1
        ? formatPeriodShortLabel(sortedSnapshots[0].month, sortedSnapshots[0].year)
        : `${formatPeriodShortLabel(sortedSnapshots[0].month, sortedSnapshots[0].year)} – ${formatPeriodShortLabel(sortedSnapshots[periodCount - 1].month, sortedSnapshots[periodCount - 1].year)}`;

  // Vault transactions aggregation
  let cumulativeVaultInflow = 0;
  let cumulativeVaultOutflow = 0;
  for (const tx of input.savingsTransactions) {
    const amt = Number(tx.amount) || 0;
    if (amt > 0) {
      cumulativeVaultInflow += amt;
    } else if (amt < 0) {
      cumulativeVaultOutflow += Math.abs(amt);
    }
  }
  const netVaultBalance = cumulativeVaultInflow - cumulativeVaultOutflow;

  // Sub-bucket accumulators for Category 1 (Liabilities & Debt)
  let paylaterTotal = 0;
  let creditCardTotal = 0;
  let personalDebtTotal = 0;
  let contractAndOtherBillsTotal = 0;

  // Sub-bucket accumulators for Category 2 (Operational & Day-to-Day Spend)
  let totalActualDailyOperational = 0;
  let totalManualDeductions = 0;

  // Sub-bucket accumulators for Category 3 (Fixed Essentials)
  let transportTotal = 0;
  let internetTotal = 0;
  let vapeTotal = 0;
  let haircutTotal = 0;

  // Accumulators for Categories 4, 5, 6 and totals
  let totalIncomeAcrossPeriods = 0;
  let totalLiabilitiesAcrossPeriods = 0;
  let totalFixedExpensesAcrossPeriods = 0;
  let totalActualSavingsAcrossPeriods = 0;
  let totalSavingsTargetAcrossPeriods = 0;
  let totalSelfRewardAcrossPeriods = 0;
  let totalBufferAcrossPeriods = 0;

  const cashflowSeries: CashflowPeriodEntry[] = sortedSnapshots.map((s) => {
    const totalIncome = Math.max(0, Number(s.finalTotalIncome) || 0);
    const totalDeductions = Math.max(0, Number(s.totalDeductions) || 0);
    const actualDailyOperational = Math.max(0, Number(s.actualDailyOperational) || 0);
    const transport = Math.max(0, Number(s.transport) || 0);
    const internet = Math.max(0, Number(s.internet) || 0);
    const vape = Math.max(0, Number(s.vape) || 0);
    const haircut = Math.max(0, Number(s.haircut) || 0);
    const fixedExpenses = transport + internet + vape + haircut;
    const bufferPocket = Math.max(0, Number(s.bufferPocket) || 0);
    const actualSavings = Math.max(0, Number(s.actualSavings) || 0);
    const savingsTarget = Math.max(0, Number(s.savingsTarget) || 0);
    const selfRewardSurplus = Math.max(0, Number(s.selfReward) || 0);
    const deficitUncovered = Math.max(0, Number(s.deficitUncovered) || 0);

    const txs = s.transactions ?? [];
    let periodPaylater = 0;
    let periodCreditCard = 0;
    let periodPersonalDebt = 0;
    let periodContractAndOther = 0;
    let periodManualDeductions = 0;

    for (const tx of txs) {
      const amt = Math.max(0, Number(tx.amount) || 0);
      if (tx.type === 'CREDIT_BILL') {
        if (tx.sourceType === 'BULK_BILL') {
          periodPaylater += amt;
        } else if (tx.sourceType === 'CC_TRANSACTION') {
          periodCreditCard += amt;
        } else if (tx.sourceType === 'PERSONAL_DEBT') {
          periodPersonalDebt += amt;
        } else {
          periodContractAndOther += amt;
        }
      } else if (tx.type === 'DEDUCTION') {
        periodManualDeductions += amt;
      }
    }

    const txCreditBillsSum =
      periodPaylater + periodCreditCard + periodPersonalDebt + periodContractAndOther;
    const txDeductionsSum = txCreditBillsSum + periodManualDeductions;

    // Ensure 100% conservation with stored totalDeductions even if synthetic fixtures omit transaction rows
    if (totalDeductions > txDeductionsSum) {
      const residual = totalDeductions - txDeductionsSum;
      periodContractAndOther += residual;
    }

    const creditBillsAmount =
      periodPaylater + periodCreditCard + periodPersonalDebt + periodContractAndOther;
    const manualDeductionsAmount = periodManualDeductions;

    paylaterTotal += periodPaylater;
    creditCardTotal += periodCreditCard;
    personalDebtTotal += periodPersonalDebt;
    contractAndOtherBillsTotal += periodContractAndOther;

    totalActualDailyOperational += actualDailyOperational;
    totalManualDeductions += manualDeductionsAmount;

    transportTotal += transport;
    internetTotal += internet;
    vapeTotal += vape;
    haircutTotal += haircut;

    const essentialOutflow = actualDailyOperational + fixedExpenses + bufferPocket;
    const operationalAndFixedOutflow = essentialOutflow + manualDeductionsAmount;
    const totalOutflow = totalDeductions + essentialOutflow;
    const totalRetainedAndSurplus = actualSavings + selfRewardSurplus;

    totalIncomeAcrossPeriods += totalIncome;
    totalLiabilitiesAcrossPeriods += totalDeductions;
    totalFixedExpensesAcrossPeriods += fixedExpenses;
    totalActualSavingsAcrossPeriods += actualSavings;
    totalSavingsTargetAcrossPeriods += savingsTarget;
    totalSelfRewardAcrossPeriods += selfRewardSurplus;
    totalBufferAcrossPeriods += bufferPocket;

    const savingsRatePercent =
      totalIncome > 0 ? roundOneDecimal((actualSavings / totalIncome) * 100) : 0;
    const debtRatioPercent =
      totalIncome > 0 ? roundOneDecimal((totalDeductions / totalIncome) * 100) : 0;
    const creditDebtRatioPercent =
      totalIncome > 0
        ? roundOneDecimal((creditBillsAmount / totalIncome) * 100)
        : 0;

    return {
      month: s.month,
      year: s.year,
      periodLabel: formatPeriodShortLabel(s.month, s.year),
      status: s.status === 'LOCKED' ? 'LOCKED' : 'DRAFT',
      totalIncome,
      totalLiabilitiesAndDeductions: totalDeductions,
      creditBillsAmount,
      manualDeductionsAmount,
      essentialOutflow,
      operationalAndFixedOutflow,
      actualDailyOperational,
      fixedExpenses,
      bufferPocket,
      totalOutflow,
      actualSavings,
      savingsTarget,
      selfRewardSurplus,
      totalRetainedAndSurplus,
      deficitUncovered,
      savingsRatePercent,
      debtRatioPercent,
      creditDebtRatioPercent,
    };
  });

  const averageMonthlyIncome =
    periodCount > 0 ? Math.round(totalIncomeAcrossPeriods / periodCount) : 0;
  const averageMonthlySavings =
    periodCount > 0 ? Math.round(totalActualSavingsAcrossPeriods / periodCount) : 0;
  const aggregateSavingsRate =
    totalIncomeAcrossPeriods > 0
      ? roundOneDecimal(
          (totalActualSavingsAcrossPeriods / totalIncomeAcrossPeriods) * 100,
        )
      : 0;
  const savingsRateTarget = 20.0;
  const savingsRateStatus: 'OPTIMAL' | 'BELOW_TARGET' =
    aggregateSavingsRate >= savingsRateTarget ? 'OPTIMAL' : 'BELOW_TARGET';

  const vaultRealizationRatePercent =
    totalActualSavingsAcrossPeriods > 0
      ? roundOneDecimal(
          (cumulativeVaultInflow / totalActualSavingsAcrossPeriods) * 100,
        )
      : 0;
  const untransferredPlannedSavings = Math.max(
    0,
    totalActualSavingsAcrossPeriods - cumulativeVaultInflow,
  );

  const totalCreditBillsCategory =
    paylaterTotal + creditCardTotal + personalDebtTotal + contractAndOtherBillsTotal;
  const totalOperationalCategory =
    totalActualDailyOperational + totalManualDeductions;

  const totalOutflowAcrossPeriods =
    totalCreditBillsCategory +
    totalOperationalCategory +
    totalFixedExpensesAcrossPeriods +
    totalBufferAcrossPeriods;

  const overallDebtRatioPercent =
    totalIncomeAcrossPeriods > 0
      ? roundOneDecimal(
          (totalLiabilitiesAcrossPeriods / totalIncomeAcrossPeriods) * 100,
        )
      : 0;
  const overallCreditDebtRatioPercent =
    totalIncomeAcrossPeriods > 0
      ? roundOneDecimal(
          (totalCreditBillsCategory / totalIncomeAcrossPeriods) * 100,
        )
      : 0;

  const buildSubItems = (
    rawItems: Array<{ key: string; label: string; amount: number }>,
    categoryTotal: number,
  ): CategorySubItem[] =>
    rawItems.map((item) => ({
      key: item.key,
      label: item.label,
      amount: item.amount,
      shareOfCategoryPercent:
        categoryTotal > 0 ? roundOneDecimal((item.amount / categoryTotal) * 100) : 0,
      shareOfIncomePercent:
        totalIncomeAcrossPeriods > 0
          ? roundOneDecimal((item.amount / totalIncomeAcrossPeriods) * 100)
          : 0,
    }));

  const buildCategory = (
    key: MacroCategoryKey,
    label: string,
    totalAmount: number,
    isOutflowCategory: boolean,
    rawSubItems: Array<{ key: string; label: string; amount: number }>,
  ): CategoryDistributionEntry => ({
    key,
    label,
    totalAmount,
    monthlyAverage: periodCount > 0 ? Math.round(totalAmount / periodCount) : 0,
    shareOfIncomePercent:
      totalIncomeAcrossPeriods > 0
        ? roundOneDecimal((totalAmount / totalIncomeAcrossPeriods) * 100)
        : 0,
    shareOfOutflowPercent:
      isOutflowCategory && totalOutflowAcrossPeriods > 0
        ? roundOneDecimal((totalAmount / totalOutflowAcrossPeriods) * 100)
        : 0,
    subItems: buildSubItems(rawSubItems, totalAmount),
  });

  const categoryDistribution: CategoryDistributionEntry[] = [
    buildCategory(
      'LIABILITIES_DEBT',
      'Liabilities & Debt Bills',
      totalCreditBillsCategory,
      true,
      [
        { key: 'PAYLATER', label: 'PayLater Bills', amount: paylaterTotal },
        { key: 'CREDIT_CARD', label: 'Credit Card Charges', amount: creditCardTotal },
        {
          key: 'PERSONAL_DEBT',
          label: 'Personal & Informal Debt',
          amount: personalDebtTotal,
        },
        {
          key: 'CONTRACTS',
          label: 'Installment Contracts',
          amount: contractAndOtherBillsTotal,
        },
      ],
    ),
    buildCategory(
      'DAILY_OPERATIONAL',
      'Operational & Day-to-Day Spend',
      totalOperationalCategory,
      true,
      [
        {
          key: 'OPERATIONAL_ALLOCATION',
          label: 'Daily Operational Allocation',
          amount: totalActualDailyOperational,
        },
        {
          key: 'MANUAL_DEDUCTIONS',
          label: 'Logged Manual Expenses',
          amount: totalManualDeductions,
        },
      ],
    ),
    buildCategory(
      'FIXED_ESSENTIALS',
      'Fixed Essentials',
      totalFixedExpensesAcrossPeriods,
      true,
      [
        { key: 'TRANSPORT', label: 'Transport', amount: transportTotal },
        { key: 'INTERNET', label: 'Internet', amount: internetTotal },
        { key: 'VAPE', label: 'Vape', amount: vapeTotal },
        { key: 'HAIRCUT', label: 'Haircut', amount: haircutTotal },
      ],
    ),
    buildCategory(
      'CORE_SAVINGS',
      'Core Savings (P1)',
      totalActualSavingsAcrossPeriods,
      false,
      [
        {
          key: 'FUNDED_P1_SAVINGS',
          label: 'Funded P1 Savings',
          amount: totalActualSavingsAcrossPeriods,
        },
      ],
    ),
    buildCategory(
      'SELF_REWARD_SURPLUS',
      'Self-Reward & Surplus (P2)',
      totalSelfRewardAcrossPeriods,
      false,
      [
        {
          key: 'FUNDED_P2_SURPLUS',
          label: 'Funded P2 Surplus',
          amount: totalSelfRewardAcrossPeriods,
        },
      ],
    ),
    buildCategory(
      'BUFFER_POCKET',
      'Buffer Reserve',
      totalBufferAcrossPeriods,
      true,
      [
        {
          key: 'BUFFER_RESERVE',
          label: 'Allocated Buffer Reserve',
          amount: totalBufferAcrossPeriods,
        },
      ],
    ),
  ];

  // Trajectory & Inflection calculation
  const toMilestone = (entry: CashflowPeriodEntry): TrajectoryMilestone => ({
    month: entry.month,
    year: entry.year,
    periodLabel: entry.periodLabel,
    debtRatioPercent: entry.debtRatioPercent,
    savingsRatePercent: entry.savingsRatePercent,
    totalLiabilitiesAndDeductions: entry.totalLiabilitiesAndDeductions,
    totalRetainedAndSurplus: entry.totalRetainedAndSurplus,
  });

  let peakDebtPeriod: TrajectoryMilestone | null = null;
  let lowestDebtPeriod: TrajectoryMilestone | null = null;
  let debtSafeInflectionPeriod: TrajectoryMilestone | null = null;
  let surplusCrossoverPeriod: TrajectoryMilestone | null = null;

  let seenHeavyDebt = false;
  for (const entry of cashflowSeries) {
    const milestone = toMilestone(entry);
    if (
      !peakDebtPeriod ||
      entry.debtRatioPercent > peakDebtPeriod.debtRatioPercent
    ) {
      peakDebtPeriod = milestone;
    }
    if (
      !lowestDebtPeriod ||
      entry.debtRatioPercent < lowestDebtPeriod.debtRatioPercent
    ) {
      lowestDebtPeriod = milestone;
    }
    if (entry.debtRatioPercent > 35.0) {
      seenHeavyDebt = true;
    } else if (seenHeavyDebt && !debtSafeInflectionPeriod && entry.totalIncome > 0) {
      debtSafeInflectionPeriod = milestone;
    }
    if (
      !surplusCrossoverPeriod &&
      entry.totalRetainedAndSurplus > entry.totalLiabilitiesAndDeductions &&
      entry.totalRetainedAndSurplus > 0
    ) {
      surplusCrossoverPeriod = milestone;
    }
  }

  // Fallback if all periods were already <= 35% and at least 1 period exists
  if (!debtSafeInflectionPeriod && cashflowSeries.length > 0 && !seenHeavyDebt) {
    debtSafeInflectionPeriod = toMilestone(cashflowSeries[0]);
  }

  const firstPeriodDebtRatioPercent =
    cashflowSeries.length > 0 ? cashflowSeries[0].debtRatioPercent : 0;
  const lastPeriodDebtRatioPercent =
    cashflowSeries.length > 0
      ? cashflowSeries[cashflowSeries.length - 1].debtRatioPercent
      : 0;
  const debtRatioDeltaPts = roundOneDecimal(
    lastPeriodDebtRatioPercent - firstPeriodDebtRatioPercent,
  );

  return {
    scope,
    periodCount,
    lockedCount,
    draftCount,
    totalAvailableSnapshotsCount,
    lockedSnapshotsCount,
    dateRangeLabel,
    kpis: {
      averageMonthlyIncome,
      averageMonthlySavings,
      aggregateSavingsRate,
      savingsRateTarget,
      savingsRateStatus,
      cumulativeVaultInflow,
      cumulativeVaultOutflow,
      netVaultBalance,
      cumulativePlannedSavings: totalActualSavingsAcrossPeriods,
      cumulativeSavingsTarget: totalSavingsTargetAcrossPeriods,
      vaultRealizationRatePercent,
      untransferredPlannedSavings,
      totalIncomeAcrossPeriods,
      totalOutflowAcrossPeriods,
      totalLiabilitiesAcrossPeriods,
      totalCreditBillsAcrossPeriods: totalCreditBillsCategory,
      totalEssentialAndFixedAcrossPeriods:
        totalActualDailyOperational +
        totalFixedExpensesAcrossPeriods +
        totalBufferAcrossPeriods,
      totalOperationalAndFixedAcrossPeriods:
        totalOperationalCategory +
        totalFixedExpensesAcrossPeriods +
        totalBufferAcrossPeriods,
      totalSelfRewardAcrossPeriods,
      totalRetainedAndSurplusAcrossPeriods:
        totalActualSavingsAcrossPeriods + totalSelfRewardAcrossPeriods,
      overallDebtRatioPercent,
      overallCreditDebtRatioPercent,
    },
    cashflowSeries,
    categoryDistribution,
    trajectorySummary: {
      peakDebtPeriod,
      lowestDebtPeriod,
      debtSafeInflectionPeriod,
      surplusCrossoverPeriod,
      firstPeriodDebtRatioPercent,
      lastPeriodDebtRatioPercent,
      debtRatioDeltaPts,
    },
  };
}
