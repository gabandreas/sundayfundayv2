export type CreditLimitStatus =
  | 'UNSET'
  | 'OK'
  | 'APPROACHING_LIMIT'
  | 'EXCEEDED';

export type OptimalBindingConstraint =
  | 'DEBT_RATIO_20'
  | 'CASHFLOW_SAVINGS_PROTECTION';

export type SafeBindingConstraint =
  | 'DEBT_RATIO_35'
  | 'CASHFLOW_DEFICIT_PROTECTION';

export interface CreditLimitCalculationInput {
  month: number;
  year: number;
  isSnapshotPersisted: boolean;
  snapshotStatus: 'DRAFT' | 'LOCKED' | 'UNINITIALIZED';
  totalIncome: number;
  dailyOperationalTarget: number;
  fixedExpenses: number;
  bufferPocket: number;
  savingsTarget: number;
  manualDeductions: number;
  contractInstallments: number;
  personalDebtAmount: number;
  currentCcUsage: number;
  currentPaylaterUsage: number;
  bankCreditLimit: number;
  ccUsageLimit: number;
  paylaterUsageLimit: number;
  optimalDebtRatioPercent?: number;
  maxSafeDebtRatioPercent?: number;
}

export interface InstrumentLimitEvaluation {
  usage: number;
  limit: number;
  utilizationPercent: number;
  remainingBeforeLimit: number;
  exceededBy: number;
  status: CreditLimitStatus;
}

export interface CreditCeilingBreakdown {
  totalIncome: number;
  upfrontEssentialsAndOperational: number;
  dailyOperationalTarget: number;
  fixedExpenses: number;
  bufferPocket: number;
  savingsTarget: number;
  manualDeductions: number;
  contractInstallments: number;
  personalDebtAmount: number;
  fixedLockedDebt: number;
  optimalTotalDebtCeiling: number;
  manageableTotalDebtCeiling: number;
  ratioBasedOptimalRevolvingCeiling: number;
  ratioBasedSafeRevolvingCeiling: number;
  maxCashflowBeforeSavingsSlash: number;
  maxCashflowBeforeDeficit: number;
  recommendedOptimalCombinedCeiling: number;
  recommendedSafeCombinedCeiling: number;
  optimalBindingConstraint: OptimalBindingConstraint;
  safeBindingConstraint: SafeBindingConstraint;
  remainingSafeHeadroomForCc: number;
  remainingSafeHeadroomForPaylater: number;
  remainingOptimalHeadroomForCc: number;
  remainingOptimalHeadroomForPaylater: number;
}

export interface CreditLimitCalculationResult {
  month: number;
  year: number;
  isSnapshotPersisted: boolean;
  snapshotStatus: 'DRAFT' | 'LOCKED' | 'UNINITIALIZED';
  bankCreditLimit: number;
  ccEvaluation: InstrumentLimitEvaluation;
  paylaterEvaluation: InstrumentLimitEvaluation;
  currentCombinedRevolvingUsage: number;
  totalPeriodDebt: number;
  currentDebtRatioPercent: number;
  isSafeCeilingExceeded: boolean;
  isOptimalCeilingExceeded: boolean;
  isAnyConfiguredLimitExceeded: boolean;
  ceilingBreakdown: CreditCeilingBreakdown;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function evaluateInstrumentLimit(
  usageInput: number,
  limitInput: number,
): InstrumentLimitEvaluation {
  const usage = Math.max(0, Math.round(Number(usageInput) || 0));
  const limit = Math.max(0, Math.round(Number(limitInput) || 0));

  if (limit <= 0) {
    return {
      usage,
      limit: 0,
      utilizationPercent: 0,
      remainingBeforeLimit: 0,
      exceededBy: 0,
      status: 'UNSET',
    };
  }

  const utilizationPercent = roundOneDecimal((usage / limit) * 100);
  const remainingBeforeLimit = Math.max(0, limit - usage);
  const exceededBy = Math.max(0, usage - limit);

  let status: CreditLimitStatus = 'OK';
  if (usage > limit) {
    status = 'EXCEEDED';
  } else if (usage >= limit * 0.85) {
    status = 'APPROACHING_LIMIT';
  }

  return {
    usage,
    limit,
    utilizationPercent,
    remainingBeforeLimit,
    exceededBy,
    status,
  };
}

export function calculateCreditUsageLimit(
  input: CreditLimitCalculationInput,
): CreditLimitCalculationResult {
  const totalIncome = Math.max(0, Math.round(Number(input.totalIncome) || 0));
  const dailyOperationalTarget = Math.max(
    0,
    Math.round(Number(input.dailyOperationalTarget) || 0),
  );
  const fixedExpenses = Math.max(
    0,
    Math.round(Number(input.fixedExpenses) || 0),
  );
  const bufferPocket = Math.max(0, Math.round(Number(input.bufferPocket) || 0));
  const savingsTarget = Math.max(
    0,
    Math.round(Number(input.savingsTarget) || 0),
  );
  const manualDeductions = Math.max(
    0,
    Math.round(Number(input.manualDeductions) || 0),
  );
  const contractInstallments = Math.max(
    0,
    Math.round(Number(input.contractInstallments) || 0),
  );
  const personalDebtAmount = Math.max(
    0,
    Math.round(Number(input.personalDebtAmount) || 0),
  );
  const currentCcUsage = Math.max(
    0,
    Math.round(Number(input.currentCcUsage) || 0),
  );
  const currentPaylaterUsage = Math.max(
    0,
    Math.round(Number(input.currentPaylaterUsage) || 0),
  );
  const bankCreditLimit = Math.max(
    0,
    Math.round(Number(input.bankCreditLimit) || 0),
  );

  const upfrontEssentialsAndOperational =
    dailyOperationalTarget + fixedExpenses;
  const fixedLockedDebt = contractInstallments + personalDebtAmount;

  // 1. Ratio-based ceilings (Configurable Optimal %, Max Manageable Debt Ratio %)
  const optimalRatio = ((input.optimalDebtRatioPercent ?? 20) / 100);
  const safeRatio = ((input.maxSafeDebtRatioPercent ?? 35) / 100);
  const optimalTotalDebtCeiling = Math.round(totalIncome * optimalRatio);
  const manageableTotalDebtCeiling = Math.round(totalIncome * safeRatio);

  const ratioBasedOptimalRevolvingCeiling = Math.max(
    0,
    optimalTotalDebtCeiling - fixedLockedDebt,
  );
  const ratioBasedSafeRevolvingCeiling = Math.max(
    0,
    manageableTotalDebtCeiling - fixedLockedDebt,
  );

  // 2. Cashflow-based ceilings (True Income-vs-Outgo Waterfall Protection)
  const maxCashflowBeforeSavingsSlash = Math.max(
    0,
    totalIncome -
      upfrontEssentialsAndOperational -
      bufferPocket -
      savingsTarget -
      fixedLockedDebt -
      manualDeductions,
  );

  const maxCashflowBeforeDeficit = Math.max(
    0,
    totalIncome -
      upfrontEssentialsAndOperational -
      bufferPocket -
      fixedLockedDebt -
      manualDeductions,
  );

  // 3. Effective Bounded Ceilings = min(ratioCeiling, cashflowCeiling)
  const recommendedOptimalCombinedCeiling = Math.min(
    ratioBasedOptimalRevolvingCeiling,
    maxCashflowBeforeSavingsSlash,
  );
  const recommendedSafeCombinedCeiling = Math.min(
    ratioBasedSafeRevolvingCeiling,
    maxCashflowBeforeDeficit,
  );

  const optimalBindingConstraint: OptimalBindingConstraint =
    maxCashflowBeforeSavingsSlash < ratioBasedOptimalRevolvingCeiling
      ? 'CASHFLOW_SAVINGS_PROTECTION'
      : 'DEBT_RATIO_20';

  const safeBindingConstraint: SafeBindingConstraint =
    maxCashflowBeforeDeficit < ratioBasedSafeRevolvingCeiling
      ? 'CASHFLOW_DEFICIT_PROTECTION'
      : 'DEBT_RATIO_35';

  // 4. Instrument-specific remaining headroom
  const remainingSafeHeadroomForCc = Math.min(
    bankCreditLimit,
    Math.max(0, recommendedSafeCombinedCeiling - currentPaylaterUsage),
  );
  const remainingSafeHeadroomForPaylater = Math.max(
    0,
    recommendedSafeCombinedCeiling - currentCcUsage,
  );

  const remainingOptimalHeadroomForCc = Math.min(
    bankCreditLimit,
    Math.max(0, recommendedOptimalCombinedCeiling - currentPaylaterUsage),
  );
  const remainingOptimalHeadroomForPaylater = Math.max(
    0,
    recommendedOptimalCombinedCeiling - currentCcUsage,
  );

  // 5. Per-instrument evaluations
  const ccEvaluation = evaluateInstrumentLimit(
    currentCcUsage,
    input.ccUsageLimit,
  );
  const paylaterEvaluation = evaluateInstrumentLimit(
    currentPaylaterUsage,
    input.paylaterUsageLimit,
  );

  const currentCombinedRevolvingUsage = currentCcUsage + currentPaylaterUsage;
  const totalPeriodDebt =
    currentCombinedRevolvingUsage + fixedLockedDebt + manualDeductions;
  const currentDebtRatioPercent =
    totalIncome > 0 ? roundOneDecimal((totalPeriodDebt / totalIncome) * 100) : 0;

  return {
    month: input.month,
    year: input.year,
    isSnapshotPersisted: input.isSnapshotPersisted,
    snapshotStatus: input.snapshotStatus,
    bankCreditLimit,
    ccEvaluation,
    paylaterEvaluation,
    currentCombinedRevolvingUsage,
    totalPeriodDebt,
    currentDebtRatioPercent,
    isSafeCeilingExceeded:
      currentCombinedRevolvingUsage > recommendedSafeCombinedCeiling,
    isOptimalCeilingExceeded:
      currentCombinedRevolvingUsage > recommendedOptimalCombinedCeiling,
    isAnyConfiguredLimitExceeded:
      ccEvaluation.status === 'EXCEEDED' ||
      paylaterEvaluation.status === 'EXCEEDED',
    ceilingBreakdown: {
      totalIncome,
      upfrontEssentialsAndOperational,
      dailyOperationalTarget,
      fixedExpenses,
      bufferPocket,
      savingsTarget,
      manualDeductions,
      contractInstallments,
      personalDebtAmount,
      fixedLockedDebt,
      optimalTotalDebtCeiling,
      manageableTotalDebtCeiling,
      ratioBasedOptimalRevolvingCeiling,
      ratioBasedSafeRevolvingCeiling,
      maxCashflowBeforeSavingsSlash,
      maxCashflowBeforeDeficit,
      recommendedOptimalCombinedCeiling,
      recommendedSafeCombinedCeiling,
      optimalBindingConstraint,
      safeBindingConstraint,
      remainingSafeHeadroomForCc,
      remainingSafeHeadroomForPaylater,
      remainingOptimalHeadroomForCc,
      remainingOptimalHeadroomForPaylater,
    },
  };
}
