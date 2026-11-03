import {
  calculatePayroll,
  sumExtraIncome,
} from './payroll';
import {
  calculateFixedEssentialsRealization,
  calculateOperationalDailySpent,
  calculateTotalDeductions,
  calculateWaterfall,
} from './waterfall';
import {
  calculateDailyPacing,
  PacingStatus,
} from './pacing';

export type SurplusResolutionMode =
  | 'INCREASE_OPERATIONAL_TARGET'
  | 'RECORD_INCOME_ADJUSTMENT'
  | 'RECORD_OPERATIONAL_REFUND';

export type DiscrepancyDirection = 'MATCHED' | 'SHORTFALL' | 'SURPLUS';

export type ReconciliationActionType =
  | 'NO_OP'
  | 'RECORD_DEDUCTION_ADJUSTMENT'
  | 'REVISE_OPERATIONAL_TARGET'
  | 'RECORD_INCOME_ADJUSTMENT'
  | 'RECORD_OPERATIONAL_REFUND';

export interface ReconciliationSimulationInput {
  periodMonth: number;
  periodYear: number;
  actualRealBalance: number;
  surplusResolutionMode?: SurplusResolutionMode;
  includesUnspentRoutinePool?: boolean;
  baseSalary: number;
  salaryAdjustment: number;
  totalWorkingDays: number;
  dailyAllowance: number;
  cafeteriaDeduction: number;
  thrAmount: number;
  bonusAmount: number;
  laptopAllowance?: number;
  savingsTarget: number;
  selfRewardTarget: number;
  dailyOperationalTarget: number;
  transportTarget: number;
  internetTarget: number;
  vapeTarget: number;
  haircutTarget: number;
  bufferPocketTarget: number;
  transactions: Array<{
    type: string;
    sourceType: string;
    fixedEssentialCategory?: string | null;
    amount: number;
  }>;
  cycleStartDate: Date;
  cycleEndDate: Date;
  isEndDateConfirmed: boolean;
  referenceDate?: Date;
}

export interface ReconciliationStateMetrics {
  finalTotalIncome: number;
  totalDeductions: number;
  dailyOperationalTarget: number;
  actualDailyOperational: number;
  totalDailySpent: number;
  remainingBudget: number;
  safeToSpendToday: number;
  baselineDailyRate: number;
  pacingStatus: PacingStatus;
  actualSavings: number;
  selfReward: number;
  deficitUncovered: number;
  isDeficit: boolean;
}

export interface CashReconciliationPreview {
  periodMonth: number;
  periodYear: number;
  systemRemainingBudget: number;
  actualRealBalance: number;
  includesUnspentRoutinePool: boolean;
  remainingRoutineBillsPool: number;
  effectiveOperationalCashBalance: number;
  varianceAmount: number;
  adjustmentAmount: number;
  discrepancyDirection: DiscrepancyDirection;
  surplusResolutionMode: SurplusResolutionMode;
  resolvedActionType: ReconciliationActionType;
  daysRemaining: number;
  cycleDateLabel: string;
  current: ReconciliationStateMetrics;
  projected: ReconciliationStateMetrics;
  impact: {
    triggersWaterfallDeficit: boolean;
    worsensWaterfallDeficit: boolean;
    reducesPriority1Savings: boolean;
    savingsReductionAmount: number;
    reducesPriority2SelfReward: boolean;
    selfRewardReductionAmount: number;
    warnings: string[];
  };
}

function formatIdrPlain(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

export function calculateCashReconciliation(
  input: ReconciliationSimulationInput,
): CashReconciliationPreview {
  const surplusResolutionMode: SurplusResolutionMode =
    input.surplusResolutionMode ?? 'INCREASE_OPERATIONAL_TARGET';

  const fixedExpenses =
    Math.max(0, input.transportTarget) +
    Math.max(0, input.internetTarget) +
    Math.max(0, input.vapeTarget) +
    Math.max(0, input.haircutTarget);

  // 1. Current Baseline State
  const currentExtraIncome = sumExtraIncome(input.transactions);
  const currentPayroll = calculatePayroll({
    baseSalary: input.baseSalary,
    salaryAdjustment: input.salaryAdjustment,
    totalWorkingDays: input.totalWorkingDays,
    dailyAllowance: input.dailyAllowance,
    cafeteriaDeduction: input.cafeteriaDeduction,
    thrAmount: input.thrAmount,
    bonusAmount: input.bonusAmount,
    extraIncome: currentExtraIncome,
    laptopAllowance: input.laptopAllowance,
  });

  const fixedTargets = {
    transport: input.transportTarget,
    internet: input.internetTarget,
    vape: input.vapeTarget,
    haircut: input.haircutTarget,
  };

  const currentTotalDeductions = calculateTotalDeductions(
    input.transactions,
    fixedTargets,
    input.dailyOperationalTarget,
  );
  const currentWaterfall = calculateWaterfall({
    finalTotalIncome: currentPayroll.finalTotalIncome,
    totalDeductions: currentTotalDeductions,
    savingsTarget: input.savingsTarget,
    selfRewardTarget: input.selfRewardTarget,
    dailyOperationalTarget: input.dailyOperationalTarget,
    fixedExpenses,
    bufferPocket: input.bufferPocketTarget,
  });

  const currentDailySpent = calculateOperationalDailySpent(
    input.transactions,
    fixedTargets,
  );

  const currentPacing = calculateDailyPacing({
    periodMonth: input.periodMonth,
    periodYear: input.periodYear,
    cycleStartDate: input.cycleStartDate,
    cycleEndDate: input.cycleEndDate,
    isEndDateConfirmed: input.isEndDateConfirmed,
    actualDailyOperational: currentWaterfall.actualDailyOperational,
    dailyOperationalTarget: input.dailyOperationalTarget,
    totalDailySpent: currentDailySpent,
    referenceDate: input.referenceDate,
  });

  const fixedRealization = calculateFixedEssentialsRealization(
    input.transactions,
    fixedTargets,
  );
  const remainingRoutineBillsPool = fixedRealization.totalRemainingPool;

  const includesUnspentRoutinePool = input.includesUnspentRoutinePool === true;
  const systemRemainingBudget = Math.max(0, currentPacing.remainingBudget);
  const actualRealBalance = Math.max(0, Math.round(input.actualRealBalance));

  const effectiveOperationalCashBalance = includesUnspentRoutinePool
    ? Math.max(0, actualRealBalance - remainingRoutineBillsPool)
    : actualRealBalance;

  const varianceAmount = effectiveOperationalCashBalance - systemRemainingBudget;
  const adjustmentAmount = Math.abs(varianceAmount);

  const discrepancyDirection: DiscrepancyDirection =
    varianceAmount === 0
      ? 'MATCHED'
      : varianceAmount < 0
        ? 'SHORTFALL'
        : 'SURPLUS';

  let resolvedActionType: ReconciliationActionType = 'NO_OP';
  if (discrepancyDirection === 'SHORTFALL') {
    resolvedActionType = 'RECORD_DEDUCTION_ADJUSTMENT';
  } else if (discrepancyDirection === 'SURPLUS') {
    if (surplusResolutionMode === 'RECORD_INCOME_ADJUSTMENT') {
      resolvedActionType = 'RECORD_INCOME_ADJUSTMENT';
    } else if (surplusResolutionMode === 'RECORD_OPERATIONAL_REFUND') {
      resolvedActionType = 'RECORD_OPERATIONAL_REFUND';
    } else {
      resolvedActionType = 'REVISE_OPERATIONAL_TARGET';
    }
  }

  // 2. Simulated Post-Reconciliation State
  const simulatedTransactions = [...input.transactions];
  let simulatedDailyOperationalTarget = input.dailyOperationalTarget;

  if (resolvedActionType === 'RECORD_DEDUCTION_ADJUSTMENT') {
    simulatedTransactions.push({
      type: 'DEDUCTION',
      sourceType: 'MANUAL',
      amount: adjustmentAmount,
    });
  } else if (resolvedActionType === 'RECORD_INCOME_ADJUSTMENT') {
    simulatedTransactions.push({
      type: 'INCOME',
      sourceType: 'MANUAL',
      amount: adjustmentAmount,
    });
  } else if (resolvedActionType === 'RECORD_OPERATIONAL_REFUND') {
    simulatedTransactions.push({
      type: 'INCOME',
      sourceType: 'OPERATIONAL_REFUND',
      amount: adjustmentAmount,
    });
  } else if (resolvedActionType === 'REVISE_OPERATIONAL_TARGET') {
    simulatedDailyOperationalTarget =
      input.dailyOperationalTarget + adjustmentAmount;
  }

  const projectedExtraIncome = sumExtraIncome(simulatedTransactions);
  const projectedPayroll = calculatePayroll({
    baseSalary: input.baseSalary,
    salaryAdjustment: input.salaryAdjustment,
    totalWorkingDays: input.totalWorkingDays,
    dailyAllowance: input.dailyAllowance,
    cafeteriaDeduction: input.cafeteriaDeduction,
    thrAmount: input.thrAmount,
    bonusAmount: input.bonusAmount,
    extraIncome: projectedExtraIncome,
    laptopAllowance: input.laptopAllowance,
  });

  const projectedTotalDeductions = calculateTotalDeductions(
    simulatedTransactions,
    fixedTargets,
    simulatedDailyOperationalTarget,
  );
  const projectedWaterfall = calculateWaterfall({
    finalTotalIncome: projectedPayroll.finalTotalIncome,
    totalDeductions: projectedTotalDeductions,
    savingsTarget: input.savingsTarget,
    selfRewardTarget: input.selfRewardTarget,
    dailyOperationalTarget: simulatedDailyOperationalTarget,
    fixedExpenses,
    bufferPocket: input.bufferPocketTarget,
  });

  const projectedDailySpent = calculateOperationalDailySpent(
    simulatedTransactions,
    fixedTargets,
  );

  const projectedPacing = calculateDailyPacing({
    periodMonth: input.periodMonth,
    periodYear: input.periodYear,
    cycleStartDate: input.cycleStartDate,
    cycleEndDate: input.cycleEndDate,
    isEndDateConfirmed: input.isEndDateConfirmed,
    actualDailyOperational: projectedWaterfall.actualDailyOperational,
    dailyOperationalTarget: simulatedDailyOperationalTarget,
    totalDailySpent: projectedDailySpent,
    referenceDate: input.referenceDate,
  });

  const triggersWaterfallDeficit =
    !currentWaterfall.isDeficit && projectedWaterfall.isDeficit;
  const worsensWaterfallDeficit =
    currentWaterfall.isDeficit &&
    projectedWaterfall.deficitUncovered > currentWaterfall.deficitUncovered;
  const reducesPriority1Savings =
    projectedWaterfall.actualSavings < currentWaterfall.actualSavings;
  const savingsReductionAmount = Math.max(
    0,
    currentWaterfall.actualSavings - projectedWaterfall.actualSavings,
  );
  const reducesPriority2SelfReward =
    projectedWaterfall.selfReward < currentWaterfall.selfReward;
  const selfRewardReductionAmount = Math.max(
    0,
    currentWaterfall.selfReward - projectedWaterfall.selfReward,
  );

  const warnings: string[] = [];
  if (triggersWaterfallDeficit) {
    warnings.push(
      `Waterfall Deficit Trap: Recording this ${formatIdrPlain(adjustmentAmount)} adjustment pushes total upfront commitments past net income, triggering an uncovered deficit of ${formatIdrPlain(projectedWaterfall.deficitUncovered)} and collapsing the funded Daily Operational allocation to Rp 0.`,
    );
  } else if (worsensWaterfallDeficit) {
    warnings.push(
      `Deficit Escalation: This adjustment increases the uncovered Waterfall Deficit from ${formatIdrPlain(currentWaterfall.deficitUncovered)} to ${formatIdrPlain(projectedWaterfall.deficitUncovered)}.`,
    );
  }

  if (reducesPriority1Savings) {
    warnings.push(
      `Priority 1 Savings Impact: This adjustment reduces funded P1 Core Savings by ${formatIdrPlain(savingsReductionAmount)} (from ${formatIdrPlain(currentWaterfall.actualSavings)} to ${formatIdrPlain(projectedWaterfall.actualSavings)}).`,
    );
  }

  if (resolvedActionType === 'RECORD_INCOME_ADJUSTMENT') {
    warnings.push(
      `Income Waterfall Routing: Recording surplus cash as Extra Income increases Total Net Income by ${formatIdrPlain(adjustmentAmount)} and flows into P1 Savings / P2 Self-Reward. It does not change the Daily Operational pocket (${formatIdrPlain(projectedPacing.remainingBudget)} remaining).`,
    );
  }

  return {
    periodMonth: input.periodMonth,
    periodYear: input.periodYear,
    systemRemainingBudget,
    actualRealBalance,
    includesUnspentRoutinePool,
    remainingRoutineBillsPool,
    effectiveOperationalCashBalance,
    varianceAmount,
    adjustmentAmount,
    discrepancyDirection,
    surplusResolutionMode,
    resolvedActionType,
    daysRemaining: currentPacing.daysRemaining,
    cycleDateLabel: currentPacing.cycleDateLabel,
    current: {
      finalTotalIncome: currentPayroll.finalTotalIncome,
      totalDeductions: currentTotalDeductions,
      dailyOperationalTarget: input.dailyOperationalTarget,
      actualDailyOperational: currentWaterfall.actualDailyOperational,
      totalDailySpent: currentDailySpent,
      remainingBudget: currentPacing.remainingBudget,
      safeToSpendToday: currentPacing.safeToSpendToday,
      baselineDailyRate: currentPacing.baselineDailyRate,
      pacingStatus: currentPacing.pacingStatus,
      actualSavings: currentWaterfall.actualSavings,
      selfReward: currentWaterfall.selfReward,
      deficitUncovered: currentWaterfall.deficitUncovered,
      isDeficit: currentWaterfall.isDeficit,
    },
    projected: {
      finalTotalIncome: projectedPayroll.finalTotalIncome,
      totalDeductions: projectedTotalDeductions,
      dailyOperationalTarget: simulatedDailyOperationalTarget,
      actualDailyOperational: projectedWaterfall.actualDailyOperational,
      totalDailySpent: projectedDailySpent,
      remainingBudget: projectedPacing.remainingBudget,
      safeToSpendToday: projectedPacing.safeToSpendToday,
      baselineDailyRate: projectedPacing.baselineDailyRate,
      pacingStatus: projectedPacing.pacingStatus,
      actualSavings: projectedWaterfall.actualSavings,
      selfReward: projectedWaterfall.selfReward,
      deficitUncovered: projectedWaterfall.deficitUncovered,
      isDeficit: projectedWaterfall.isDeficit,
    },
    impact: {
      triggersWaterfallDeficit,
      worsensWaterfallDeficit,
      reducesPriority1Savings,
      savingsReductionAmount,
      reducesPriority2SelfReward,
      selfRewardReductionAmount,
      warnings,
    },
  };
}
