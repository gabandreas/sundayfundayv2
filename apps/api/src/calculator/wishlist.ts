export type CashStrategyTier = 'INSTANT_EXECUTION' | 'SAVING_REQUIRED';
export type InstallmentRiskTier = 'OPTIMAL' | 'MANAGEABLE' | 'HIGH_RISK';

export interface CashStrategyAnalysis {
  tier: CashStrategyTier;
  currentSelfReward: number;
  shortfall: number;
  estimatedMonthsToSave: number;
  monthlySavingsRate: number;
}

export interface MonthlyDebtProjection {
  month: number;
  year: number;
  existingDebt: number;
  newDebt: number;
  totalDebt: number;
  debtRatio: number;
}

export interface InstallmentStrategyAnalysis {
  tier: InstallmentRiskTier;
  peakDebtRatio: number;
  newMonthlyInstallment: number;
  projectedMonths: MonthlyDebtProjection[];
}

export interface WishlistAnalysisResult {
  cashStrategy: CashStrategyAnalysis;
  installmentStrategy?: InstallmentStrategyAnalysis;
}

export interface ExistingLiabilityPeriod {
  month: number;
  year: number;
  amount: number;
  baseIncome?: number;
}

export interface CalculateWishlistAnalysisParams {
  price: number;
  fundingType: 'CASH' | 'INSTALLMENT';
  tenor?: number | null;
  monthlyPayment?: number | null;
  currentSelfReward: number;
  selfRewardTarget?: number | null;
  baseThp: number;
  existingLiabilities: ExistingLiabilityPeriod[];
}

/**
 * Calculates cash purchasing strategy.
 * If price <= currentSelfReward, instant execution is possible.
 * Otherwise, calculates shortfall and estimated months to save.
 */
export function calculateCashStrategy(
  price: number,
  currentSelfReward: number,
  selfRewardTarget: number | null | undefined,
  baseThp: number,
): CashStrategyAnalysis {
  const safeRewardBalance = Math.max(0, currentSelfReward || 0);

  if (price <= safeRewardBalance) {
    return {
      tier: 'INSTANT_EXECUTION',
      currentSelfReward: safeRewardBalance,
      shortfall: 0,
      estimatedMonthsToSave: 0,
      monthlySavingsRate: selfRewardTarget && selfRewardTarget > 0 ? selfRewardTarget : Math.max(0, 0.1 * baseThp),
    };
  }

  const shortfall = price - safeRewardBalance;
  const effectiveMonthlySavings =
    selfRewardTarget && selfRewardTarget > 0 ? selfRewardTarget : Math.max(0, 0.1 * baseThp);

  const estimatedMonthsToSave =
    effectiveMonthlySavings > 0 ? Math.ceil(shortfall / effectiveMonthlySavings) : Infinity;

  return {
    tier: 'SAVING_REQUIRED',
    currentSelfReward: safeRewardBalance,
    shortfall: Math.round(shortfall * 100) / 100,
    estimatedMonthsToSave,
    monthlySavingsRate: Math.round(effectiveMonthlySavings * 100) / 100,
  };
}

/**
 * Evaluates installment debt risk tier based on peak debt ratio:
 * - <= 20%: OPTIMAL (healthy)
 * - > 20% and <= 35%: MANAGEABLE (caution)
 * - > 35%: HIGH_RISK (deficit danger)
 */
export function evaluateInstallmentRiskTier(peakDebtRatio: number): InstallmentRiskTier {
  if (peakDebtRatio <= 20) {
    return 'OPTIMAL';
  }
  if (peakDebtRatio <= 35) {
    return 'MANAGEABLE';
  }
  return 'HIGH_RISK';
}

/**
 * Calculates installment strategy analysis across next 6 months.
 * Note: monthlyPayment when provided is authoritative (per V1 spec).
 * If omitted, fallback is price / tenor (noted as an assumption beyond V1).
 */
export function calculateInstallmentStrategy(
  price: number,
  tenor: number | null | undefined,
  monthlyPayment: number | null | undefined,
  baseThp: number,
  existingLiabilities: ExistingLiabilityPeriod[],
): InstallmentStrategyAnalysis {
  const effectiveTenor = tenor && tenor > 0 ? tenor : 1;
  const effectiveMonthlyInstallment =
    monthlyPayment !== null && monthlyPayment !== undefined
      ? monthlyPayment
      : price / effectiveTenor;

  const projectedMonths: MonthlyDebtProjection[] = existingLiabilities.slice(0, 6).map((item, index) => {
    // Installment applies for the duration of the item's tenor
    const newDebt = index < effectiveTenor ? effectiveMonthlyInstallment : 0;
    const existingDebt = item.amount || 0;
    const totalDebt = existingDebt + newDebt;
    const effectiveIncome = item.baseIncome && item.baseIncome > 0 ? item.baseIncome : baseThp;
    const debtRatio =
      effectiveIncome > 0
        ? Math.round((totalDebt / effectiveIncome) * 10000) / 100
        : totalDebt > 0
          ? 100
          : 0;

    return {
      month: item.month,
      year: item.year,
      existingDebt: Math.round(existingDebt * 100) / 100,
      newDebt: Math.round(newDebt * 100) / 100,
      totalDebt: Math.round(totalDebt * 100) / 100,
      debtRatio,
    };
  });

  const peakDebtRatio =
    projectedMonths.length > 0
      ? Math.max(...projectedMonths.map((p) => p.debtRatio))
      : 0;

  const tier = evaluateInstallmentRiskTier(peakDebtRatio);

  return {
    tier,
    peakDebtRatio: Math.round(peakDebtRatio * 100) / 100,
    newMonthlyInstallment: Math.round(effectiveMonthlyInstallment * 100) / 100,
    projectedMonths,
  };
}

/**
 * Pure calculation entry point for wishlist analysis.
 * Always produces cashStrategy.
 * Produces installmentStrategy ONLY if fundingType is INSTALLMENT.
 */
export function calculateWishlistAnalysis(
  params: CalculateWishlistAnalysisParams,
): WishlistAnalysisResult {
  const cashStrategy = calculateCashStrategy(
    params.price,
    params.currentSelfReward,
    params.selfRewardTarget,
    params.baseThp,
  );

  const shouldEvaluateInstallment = params.fundingType === 'INSTALLMENT';

  let installmentStrategy: InstallmentStrategyAnalysis | undefined;

  if (shouldEvaluateInstallment) {
    installmentStrategy = calculateInstallmentStrategy(
      params.price,
      params.tenor,
      params.monthlyPayment,
      params.baseThp,
      params.existingLiabilities,
    );
  }

  return {
    cashStrategy,
    installmentStrategy,
  };
}
