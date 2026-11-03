/**
 * Modular Formula, Dynamic Bucket & Policy Engine
 * Pure, zero-I/O calculator providing dynamic payroll formulas, customizable
 * waterfall priority tiers, arbitrary budget buckets, surplus overflow distribution,
 * and financial risk policy thresholds.
 */

import {
  calculateTotalDeductions,
  calculateWaterfall,
  FixedEssentialTargets,
  FormulaEngineType,
  FormulaParams,
  CustomIncomeDeductionRow,
} from './waterfall';

export type PayrollFormulaType =
  | 'FIXED_AMOUNT'
  | 'PERCENT_OF_BASE'
  | 'RATE_PER_WORKING_DAY'
  | 'PRORATED_MONTHS_OF_BASE';

export interface PayrollComponentRule {
  id: string;
  label: string;
  direction: 'ADDITION' | 'DEDUCTION';
  formulaType: PayrollFormulaType;
  value: number; // nominal amount, percent, daily rate, or months numerator
  isActive: boolean;
}

export type BucketFormulaType =
  | 'FIXED_AMOUNT'
  | 'PERCENT_OF_NET_INCOME'
  | 'PERCENT_OF_DISPOSABLE_AFTER_DEBT'
  | 'DAILY_RATE_TIMES_CYCLE_DAYS'
  | 'REMAINDER_OVERFLOW';

export type BucketGroup =
  | 'FIXED_ESSENTIAL'
  | 'DAILY_OPERATIONAL'
  | 'BUFFER'
  | 'SAVINGS_P1'
  | 'SELF_REWARD_P2';

export interface AllocationBucketRule {
  id: string; // e.g. 'transport', 'internet', 'vape', 'haircut', 'daily_operational', 'core_savings', 'self_reward', 'buffer', or 'custom_<slug>'
  label: string;
  group: BucketGroup;
  priorityTier: number; // 0 = Upfront Essential / Operational, 1 = Priority 1 Savings, 2 = Priority 2 Self-Reward / Surplus
  formulaType: BucketFormulaType;
  value: number; // nominal amount, percent, daily rate
  minFloorRp?: number;
  maxCapRp?: number;
  isActive: boolean;
}

export interface SurplusSplitItem {
  bucketId: string;
  percent: number; // 0 to 100
}

export interface SurplusSplitRules {
  splits: SurplusSplitItem[];
}

export interface FinancialPolicyConfig {
  optimalDebtRatioPercent: number; // default 20
  maxSafeDebtRatioPercent: number; // default 35
  targetSavingsRatePercent: number; // default 20
  criticalOperationalFloorRp: number; // default 1000000
  runwayMilestoneMonths: number[]; // default [3, 6, 12]
}

export interface BucketRealization {
  bucketId: string;
  label: string;
  group: BucketGroup;
  priorityTier: number;
  formulaType: BucketFormulaType;
  formulaValue: number;
  baselineTarget: number;
  revisedTarget: number;
  fundedAmount: number;
  loggedSpend: number;
  remainingBudget: number;
  capHit?: 'MIN_FLOOR' | 'MAX_CAP';
}

export interface ModularEngineSnapshotInput {
  baseSalary: number;
  salaryAdjustment?: number;
  totalWorkingDays: number;
  dailyAllowance?: number;
  cafeteriaDeduction?: number;
  thrAmount?: number;
  bonusAmount?: number;
  extraIncome?: number;
  month: number;
  year: number;
  cycleDays: number;
  totalCreditBills: number;
  totalDeductions?: number;
  payrollRules?: PayrollComponentRule[] | null;
  allocationBuckets?: AllocationBucketRule[] | null;
  surplusSplitRules?: SurplusSplitRules | null;
  financialPolicy?: FinancialPolicyConfig | null;
  formulaEngineType?: FormulaEngineType;
  formulaParams?: FormulaParams | null;
  budgetRevisions?: Array<{
    bucketKey?: string | null;
    category?: string | null;
    newValue: number;
  }>;
  transactions?: Array<{
    type: string;
    sourceType?: string | null;
    fixedEssentialCategory?: string | null;
    bucketKey?: string | null;
    amount: number;
  }>;
}

export interface ModularEngineCalculationResult {
  payroll: {
    adjustedBaseSalary: number;
    bpjsDeduction: number;
    laptopAllowance: number;
    totalDailyAllowance: number;
    netSalaryIncome: number;
    finalTotalIncome: number;
    componentBreakdown: Array<{
      id: string;
      label: string;
      direction: 'ADDITION' | 'DEDUCTION';
      formulaType: PayrollFormulaType;
      nominal: number;
    }>;
  };
  waterfall: {
    availableFunds: number;
    deficitUncovered: number;
    actualDailyOperational: number;
    actualSavings: number;
    actualSelfReward: number;
    selfReward: number;
    survivalPocket: number;
    isDeficit: boolean;
  };
  canonicalSnapshotColumns: {
    transport: number;
    internet: number;
    vape: number;
    haircut: number;
    dailyOperational: number;
    actualDailyOperational: number;
    savings: number;
    actualSavings: number;
    selfRewardTarget: number;
    selfReward: number;
    bufferPocket: number;
    survivalPocket: number;
    deficitUncovered: number;
  };
  bucketRealizations: BucketRealization[];
  policySummary: {
    debtRatio: number;
    isOptimalDebt: boolean;
    isHighDebt: boolean;
    savingsRatePercent: number;
    isSavingsTargetMet: boolean;
    isOperationalFloorMet: boolean;
  };
}

// ─────────────────────────────────────────────
// Default Rule Builders (100% Backward Compatible)
// ─────────────────────────────────────────────

export const DEFAULT_FINANCIAL_POLICY: FinancialPolicyConfig = {
  optimalDebtRatioPercent: 20,
  maxSafeDebtRatioPercent: 35,
  targetSavingsRatePercent: 20,
  criticalOperationalFloorRp: 1000000,
  runwayMilestoneMonths: [3, 6, 12],
};

export function buildDefaultPayrollRules(
  dailyAllowance: number = 20000,
  laptopAllowance: number = 250000,
): PayrollComponentRule[] {
  return [
    {
      id: 'bpjs',
      label: 'BPJS Deduction (3%)',
      direction: 'DEDUCTION',
      formulaType: 'PERCENT_OF_BASE',
      value: 3,
      isActive: true,
    },
    {
      id: 'laptop_allowance',
      label: 'Laptop Allowance',
      direction: 'ADDITION',
      formulaType: 'FIXED_AMOUNT',
      value: laptopAllowance,
      isActive: true,
    },
    {
      id: 'daily_attendance',
      label: 'Daily Attendance Allowance',
      direction: 'ADDITION',
      formulaType: 'RATE_PER_WORKING_DAY',
      value: dailyAllowance,
      isActive: true,
    },
    {
      id: 'december_thr',
      label: 'December Pro-rated THR',
      direction: 'ADDITION',
      formulaType: 'PRORATED_MONTHS_OF_BASE',
      value: 8.83,
      isActive: true,
    },
  ];
}

export function buildDefaultAllocationBuckets(
  defaults?: Partial<{
    transport: number;
    internet: number;
    vape: number;
    haircut: number;
    dailyOperational: number;
    savings: number;
    selfRewardTarget: number;
    bufferPocket: number;
  }>,
): AllocationBucketRule[] {
  return [
    {
      id: 'transport',
      label: 'Transport',
      group: 'FIXED_ESSENTIAL',
      priorityTier: 0,
      formulaType: 'FIXED_AMOUNT',
      value: defaults?.transport ?? 0,
      isActive: true,
    },
    {
      id: 'internet',
      label: 'Internet & Connectivity',
      group: 'FIXED_ESSENTIAL',
      priorityTier: 0,
      formulaType: 'FIXED_AMOUNT',
      value: defaults?.internet ?? 0,
      isActive: true,
    },
    {
      id: 'vape',
      label: 'Vape Supplies',
      group: 'FIXED_ESSENTIAL',
      priorityTier: 0,
      formulaType: 'FIXED_AMOUNT',
      value: defaults?.vape ?? 0,
      isActive: true,
    },
    {
      id: 'haircut',
      label: 'Haircut & Grooming',
      group: 'FIXED_ESSENTIAL',
      priorityTier: 0,
      formulaType: 'FIXED_AMOUNT',
      value: defaults?.haircut ?? 0,
      isActive: true,
    },
    {
      id: 'buffer',
      label: 'Buffer Pocket',
      group: 'BUFFER',
      priorityTier: 0,
      formulaType: 'FIXED_AMOUNT',
      value: defaults?.bufferPocket ?? 0,
      isActive: true,
    },
    {
      id: 'daily_operational',
      label: 'Daily Operational Living Budget',
      group: 'DAILY_OPERATIONAL',
      priorityTier: 0,
      formulaType: 'FIXED_AMOUNT',
      value: defaults?.dailyOperational ?? 0,
      isActive: true,
    },
    {
      id: 'core_savings',
      label: 'Priority 1 Core Savings',
      group: 'SAVINGS_P1',
      priorityTier: 1,
      formulaType: 'FIXED_AMOUNT',
      value: defaults?.savings ?? 0,
      isActive: true,
    },
    {
      id: 'self_reward',
      label: 'Priority 2 Discretionary / Self-Reward',
      group: 'SELF_REWARD_P2',
      priorityTier: 2,
      formulaType: 'REMAINDER_OVERFLOW',
      value: defaults?.selfRewardTarget ?? 0,
      isActive: true,
    },
  ];
}

export function buildDefaultSurplusSplitRules(): SurplusSplitRules {
  return {
    splits: [{ bucketId: 'self_reward', percent: 100 }],
  };
}

export function buildDefaultFinancialPolicy(): FinancialPolicyConfig {
  return { ...DEFAULT_FINANCIAL_POLICY };
}

// ─────────────────────────────────────────────
// Validation Guardrails
// ─────────────────────────────────────────────

export function validateModularRules(
  payrollRules?: PayrollComponentRule[] | null,
  allocationBuckets?: AllocationBucketRule[] | null,
  surplusSplitRules?: SurplusSplitRules | null,
  financialPolicy?: FinancialPolicyConfig | null,
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (surplusSplitRules?.splits) {
    const totalPercent = surplusSplitRules.splits.reduce(
      (sum, s) => sum + (Number(s.percent) || 0),
      0,
    );
    if (Math.round(totalPercent) !== 100) {
      errors.push(
        `Surplus split percentages must sum exactly to 100% (currently ${totalPercent}%).`,
      );
    }
    for (const split of surplusSplitRules.splits) {
      if (split.percent < 0 || split.percent > 100) {
        errors.push(
          `Surplus split for bucket "${split.bucketId}" must be between 0% and 100%.`,
        );
      }
    }
  }

  if (allocationBuckets) {
    const ids = new Set<string>();
    for (const b of allocationBuckets) {
      if (!b.id || typeof b.id !== 'string') {
        errors.push(`Every allocation bucket must have a non-empty string id.`);
      } else if (ids.has(b.id)) {
        errors.push(`Duplicate allocation bucket id found: "${b.id}".`);
      } else {
        ids.add(b.id);
      }

      if (b.priorityTier < 0) {
        errors.push(
          `Priority tier for "${b.label}" must be non-negative (received ${b.priorityTier}).`,
        );
      }

      if (
        (b.formulaType === 'PERCENT_OF_NET_INCOME' ||
          b.formulaType === 'PERCENT_OF_DISPOSABLE_AFTER_DEBT') &&
        (b.value < 0 || b.value > 100)
      ) {
        errors.push(
          `Percentage value for "${b.label}" must be between 0 and 100.`,
        );
      }

      if (
        b.minFloorRp !== undefined &&
        b.maxCapRp !== undefined &&
        b.minFloorRp > b.maxCapRp
      ) {
        errors.push(
          `Min floor (Rp ${b.minFloorRp}) cannot exceed max cap (Rp ${b.maxCapRp}) for "${b.label}".`,
        );
      }
    }
  }

  if (financialPolicy) {
    if (
      financialPolicy.optimalDebtRatioPercent < 0 ||
      financialPolicy.optimalDebtRatioPercent > 100
    ) {
      errors.push(`Optimal debt ratio must be between 0% and 100%.`);
    }
    if (
      financialPolicy.maxSafeDebtRatioPercent < 0 ||
      financialPolicy.maxSafeDebtRatioPercent > 100
    ) {
      errors.push(`Max safe debt ratio must be between 0% and 100%.`);
    }
    if (
      financialPolicy.optimalDebtRatioPercent >
      financialPolicy.maxSafeDebtRatioPercent
    ) {
      errors.push(`Optimal debt ratio cannot exceed max safe debt ratio.`);
    }
    if (
      financialPolicy.targetSavingsRatePercent < 0 ||
      financialPolicy.targetSavingsRatePercent > 100
    ) {
      errors.push(`Target savings rate must be between 0% and 100%.`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────
// Synthesize Rules from Legacy Snapshot
// ─────────────────────────────────────────────

export function synthesizeRulesFromSnapshot(snapshot: {
  baseSalary?: number;
  dailyAllowance?: number;
  laptopAllowance?: number;
  transport?: number;
  internet?: number;
  vape?: number;
  haircut?: number;
  dailyOperational?: number;
  savings?: number;
  selfRewardTarget?: number;
  bufferPocket?: number;
}): {
  payrollRules: PayrollComponentRule[];
  allocationBuckets: AllocationBucketRule[];
  surplusSplitRules: SurplusSplitRules;
  financialPolicy: FinancialPolicyConfig;
} {
  return {
    payrollRules: buildDefaultPayrollRules(
      snapshot.dailyAllowance ?? 20000,
      snapshot.laptopAllowance ?? 250000,
    ),
    allocationBuckets: buildDefaultAllocationBuckets({
      transport: snapshot.transport ?? 0,
      internet: snapshot.internet ?? 0,
      vape: snapshot.vape ?? 0,
      haircut: snapshot.haircut ?? 0,
      dailyOperational: snapshot.dailyOperational ?? 0,
      savings: snapshot.savings ?? 0,
      selfRewardTarget: snapshot.selfRewardTarget ?? 0,
      bufferPocket: snapshot.bufferPocket ?? 0,
    }),
    surplusSplitRules: buildDefaultSurplusSplitRules(),
    financialPolicy: buildDefaultFinancialPolicy(),
  };
}

// ─────────────────────────────────────────────
// Dynamic Payroll Evaluator
// ─────────────────────────────────────────────

export function evaluateModularPayroll(params: {
  baseSalary: number;
  salaryAdjustment?: number;
  totalWorkingDays: number;
  dailyAllowance?: number;
  cafeteriaDeduction?: number;
  thrAmount?: number;
  bonusAmount?: number;
  extraIncome?: number;
  month: number;
  payrollRules?: PayrollComponentRule[] | null;
  customPayrollRows?: CustomIncomeDeductionRow[] | null;
}): {
  adjustedBaseSalary: number;
  bpjsDeduction: number;
  laptopAllowance: number;
  totalDailyAllowance: number;
  netSalaryIncome: number;
  finalTotalIncome: number;
  thrAmount: number;
  bonusAmount: number;
  componentBreakdown: Array<{
    id: string;
    label: string;
    direction: 'ADDITION' | 'DEDUCTION';
    formulaType: PayrollFormulaType;
    nominal: number;
  }>;
} {
  const baseSalary = Math.max(0, Number(params.baseSalary) || 0);
  const salaryAdjustment = Number(params.salaryAdjustment) || 0;
  const adjustedBaseSalary = Math.max(0, baseSalary + salaryAdjustment);
  const totalWorkingDays = Math.max(0, Number(params.totalWorkingDays) || 0);
  const cafeteriaDeduction = Math.max(0, Number(params.cafeteriaDeduction) || 0);
  const bonusAmount = Math.max(0, Number(params.bonusAmount) || 0);
  const extraIncome = Math.max(0, Number(params.extraIncome) || 0);

  const rules =
    params.payrollRules && params.payrollRules.length > 0
      ? params.payrollRules
      : buildDefaultPayrollRules(params.dailyAllowance ?? 20000);

  let bpjsDeduction = 0;
  let laptopAllowance = 0;
  let totalDailyAllowance = 0;
  let thrAmount = Math.max(0, Number(params.thrAmount) || 0);

  const componentBreakdown: Array<{
    id: string;
    label: string;
    direction: 'ADDITION' | 'DEDUCTION';
    formulaType: PayrollFormulaType;
    nominal: number;
  }> = [];

  let netBasePayroll = adjustedBaseSalary;

  for (const rule of rules) {
    if (!rule.isActive) continue;

    let nominal = 0;
    switch (rule.formulaType) {
      case 'FIXED_AMOUNT':
        nominal = Math.round(Number(rule.value) || 0);
        break;
      case 'PERCENT_OF_BASE':
        nominal = Math.round(adjustedBaseSalary * ((Number(rule.value) || 0) / 100));
        break;
      case 'RATE_PER_WORKING_DAY':
        nominal = Math.round((Number(rule.value) || 0) * totalWorkingDays);
        break;
      case 'PRORATED_MONTHS_OF_BASE':
        if (params.month === 12 || thrAmount > 0) {
          nominal = Math.round(
            ((Number(rule.value) || 0) / 12) * adjustedBaseSalary,
          );
        }
        break;
    }

    if (rule.id === 'bpjs') {
      bpjsDeduction = nominal;
      netBasePayroll -= nominal;
    } else if (rule.id === 'laptop_allowance') {
      laptopAllowance = nominal;
      netBasePayroll += nominal;
    } else if (rule.id === 'daily_attendance') {
      totalDailyAllowance = nominal;
    } else if (rule.id === 'december_thr') {
      if (params.month === 12 && thrAmount === 0) {
        thrAmount = nominal;
      }
    } else {
      if (rule.direction === 'ADDITION') {
        netBasePayroll += nominal;
      } else {
        netBasePayroll -= nominal;
      }
    }

    componentBreakdown.push({
      id: rule.id,
      label: rule.label,
      direction: rule.direction,
      formulaType: rule.formulaType,
      nominal,
    });
  }

  if (Array.isArray(params.customPayrollRows)) {
    for (const customRow of params.customPayrollRows) {
      const amount = Math.max(0, Math.round(Number(customRow.amount) || 0));
      if (amount <= 0) continue;
      if (customRow.direction === 'INCOME') {
        netBasePayroll += amount;
        componentBreakdown.push({
          id: customRow.id,
          label: customRow.label,
          direction: 'ADDITION',
          formulaType: 'FIXED_AMOUNT',
          nominal: amount,
        });
      } else {
        netBasePayroll -= amount;
        componentBreakdown.push({
          id: customRow.id,
          label: customRow.label,
          direction: 'DEDUCTION',
          formulaType: 'FIXED_AMOUNT',
          nominal: amount,
        });
      }
    }
  }

  const netSalaryIncome = Math.max(
    0,
    netBasePayroll + totalDailyAllowance - cafeteriaDeduction,
  );
  const finalTotalIncome =
    netSalaryIncome + thrAmount + bonusAmount + extraIncome;

  return {
    adjustedBaseSalary,
    bpjsDeduction,
    laptopAllowance,
    totalDailyAllowance,
    netSalaryIncome,
    finalTotalIncome,
    thrAmount,
    bonusAmount,
    componentBreakdown,
  };
}

// ─────────────────────────────────────────────
// Dynamic Bucket Target Resolver
// ─────────────────────────────────────────────

export function resolveBucketTarget(
  rule: AllocationBucketRule,
  context: {
    finalTotalIncome: number;
    totalCreditBills: number;
    cycleDays: number;
  },
): { target: number; capHit?: 'MIN_FLOOR' | 'MAX_CAP' } {
  let raw = 0;
  switch (rule.formulaType) {
    case 'FIXED_AMOUNT':
      raw = Math.max(0, Math.round(Number(rule.value) || 0));
      break;
    case 'PERCENT_OF_NET_INCOME':
      raw = Math.max(
        0,
        Math.round(context.finalTotalIncome * ((Number(rule.value) || 0) / 100)),
      );
      break;
    case 'PERCENT_OF_DISPOSABLE_AFTER_DEBT':
      // CRITICAL INVARIANT: Evaluates against pure totalCreditBills only (never general operational deductions)
      const disposableAfterDebt = Math.max(
        0,
        context.finalTotalIncome - context.totalCreditBills,
      );
      raw = Math.max(
        0,
        Math.round(disposableAfterDebt * ((Number(rule.value) || 0) / 100)),
      );
      break;
    case 'DAILY_RATE_TIMES_CYCLE_DAYS':
      raw = Math.max(
        0,
        Math.round((Number(rule.value) || 0) * Math.max(1, context.cycleDays)),
      );
      break;
    case 'REMAINDER_OVERFLOW':
      // Remainder overflow uses rule.value as baseline target; actual allocation happens via surplus split
      raw = Math.max(0, Math.round(Number(rule.value) || 0));
      break;
  }

  let capHit: 'MIN_FLOOR' | 'MAX_CAP' | undefined;
  if (rule.minFloorRp !== undefined && raw < rule.minFloorRp) {
    raw = rule.minFloorRp;
    capHit = 'MIN_FLOOR';
  }
  if (rule.maxCapRp !== undefined && raw > rule.maxCapRp) {
    raw = rule.maxCapRp;
    capHit = 'MAX_CAP';
  }

  return { target: raw, capHit };
}

// ─────────────────────────────────────────────
// End-to-End Modular Engine Evaluator
// ─────────────────────────────────────────────

export function evaluateModularEngine(
  input: ModularEngineSnapshotInput,
): ModularEngineCalculationResult {
  // 1. Evaluate Dynamic Payroll
  const payroll = evaluateModularPayroll({
    baseSalary: input.baseSalary,
    salaryAdjustment: input.salaryAdjustment,
    totalWorkingDays: input.totalWorkingDays,
    dailyAllowance: input.dailyAllowance,
    cafeteriaDeduction: input.cafeteriaDeduction,
    thrAmount: input.thrAmount,
    bonusAmount: input.bonusAmount,
    extraIncome: input.extraIncome,
    month: input.month,
    payrollRules: input.payrollRules,
    customPayrollRows: input.formulaParams?.customPayrollRows,
  });

  const finalTotalIncome = payroll.finalTotalIncome;
  const totalCreditBills = Math.max(0, Number(input.totalCreditBills) || 0);
  const cycleDays = Math.max(1, Number(input.cycleDays) || 30);

  const buckets =
    input.allocationBuckets && input.allocationBuckets.length > 0
      ? input.allocationBuckets
      : buildDefaultAllocationBuckets();

  const surplusSplit =
    input.surplusSplitRules && input.surplusSplitRules.splits.length > 0
      ? input.surplusSplitRules
      : buildDefaultSurplusSplitRules();

  const policy = input.financialPolicy || DEFAULT_FINANCIAL_POLICY;

  // 2. Resolve Targets & Apply Budget Revision Precedence
  // Budget revision map: keyed by bucketKey or canonical category lowercase
  const revisionMap = new Map<string, number>();
  if (input.budgetRevisions) {
    for (const rev of input.budgetRevisions) {
      if (rev.bucketKey) {
        revisionMap.set(rev.bucketKey.toLowerCase(), rev.newValue);
      }
      if (rev.category) {
        const catKey = rev.category.toLowerCase();
        revisionMap.set(catKey, rev.newValue);
        if (catKey === 'daily_operational') revisionMap.set('daily_operational', rev.newValue);
        if (catKey === 'savings') revisionMap.set('core_savings', rev.newValue);
        if (catKey === 'self_reward') revisionMap.set('self_reward', rev.newValue);
        if (catKey === 'buffer') revisionMap.set('buffer', rev.newValue);
      }
    }
  }

  interface BucketEvalIntermediate {
    rule: AllocationBucketRule;
    baselineTarget: number;
    revisedTarget: number;
    capHit?: 'MIN_FLOOR' | 'MAX_CAP';
    fundedAmount: number;
    loggedSpend: number;
  }

  const activeBuckets: BucketEvalIntermediate[] = [];
  for (const rule of buckets) {
    if (!rule.isActive) continue;

    const { target: baselineTarget, capHit } = resolveBucketTarget(rule, {
      finalTotalIncome,
      totalCreditBills,
      cycleDays,
    });

    const override =
      revisionMap.get(rule.id.toLowerCase()) ??
      revisionMap.get(rule.group.toLowerCase());
    const revisedTarget = override !== undefined ? override : baselineTarget;

    activeBuckets.push({
      rule,
      baselineTarget,
      revisedTarget,
      capHit,
      fundedAmount: 0,
      loggedSpend: 0,
    });
  }

  // 3. Waterfall Allocation Execution (Priority Tier 0 -> Tier 1 -> Tier 2 & Remainder)
  const tier0 = activeBuckets.filter((b) => b.rule.priorityTier === 0);
  const tier1 = activeBuckets.filter((b) => b.rule.priorityTier === 1);
  const tier2 = activeBuckets.filter((b) => b.rule.priorityTier >= 2);

  const fixedEssentialsTier0 = tier0.filter(
    (b) => b.rule.group === 'FIXED_ESSENTIAL',
  );
  const bufferTier0 = tier0.filter((b) => b.rule.group === 'BUFFER');
  const dailyOpTier0 = tier0.filter(
    (b) => b.rule.group === 'DAILY_OPERATIONAL',
  );

  const totalFixedEssentialsTarget = fixedEssentialsTier0.reduce(
    (s, b) => s + b.revisedTarget,
    0,
  );
  const totalBufferTarget = bufferTier0.reduce((s, b) => s + b.revisedTarget, 0);
  const totalDailyOpTarget = dailyOpTier0.reduce(
    (s, b) => s + b.revisedTarget,
    0,
  );

  const fixedTargets: FixedEssentialTargets = {
    transport:
      fixedEssentialsTier0.find((b) => b.rule.id === 'transport')
        ?.revisedTarget ?? 0,
    internet:
      fixedEssentialsTier0.find((b) => b.rule.id === 'internet')
        ?.revisedTarget ?? 0,
    vape:
      fixedEssentialsTier0.find((b) => b.rule.id === 'vape')?.revisedTarget ??
      0,
    haircut:
      fixedEssentialsTier0.find((b) => b.rule.id === 'haircut')
        ?.revisedTarget ?? 0,
  };

  const totalDeductions =
    input.totalDeductions !== undefined
      ? Math.max(0, Number(input.totalDeductions) || 0)
      : calculateTotalDeductions(
          (input.transactions || []) as any,
          fixedTargets,
          totalDailyOpTarget,
        );

  const upfrontEssentialAndOperational =
    totalFixedEssentialsTarget + totalDailyOpTarget;

  // Available funds after Upfront Tier 0 and Debt Deductions
  let availableFunds =
    finalTotalIncome -
    upfrontEssentialAndOperational -
    totalBufferTarget -
    totalDeductions;

  let deficitUncovered = 0;
  let isDeficit = false;
  let engineOverrideResult: ReturnType<typeof calculateWaterfall> | null = null;

  if (
    input.formulaEngineType &&
    input.formulaEngineType !== 'DEBT_FIRST_WATERFALL'
  ) {
    const tier1TargetSum = tier1.reduce((s, b) => s + b.revisedTarget, 0);
    const tier2TargetSum = tier2.reduce((s, b) => s + b.revisedTarget, 0);
    engineOverrideResult = calculateWaterfall({
      finalTotalIncome,
      totalDeductions,
      savingsTarget: tier1TargetSum,
      selfRewardTarget: tier2TargetSum,
      dailyOperationalTarget: totalDailyOpTarget,
      fixedExpenses: totalFixedEssentialsTarget,
      bufferPocket: totalBufferTarget,
      formulaEngineType: input.formulaEngineType,
      formulaParams: input.formulaParams,
    });

    availableFunds = engineOverrideResult.availableFunds;
    deficitUncovered = engineOverrideResult.deficitUncovered;
    isDeficit = engineOverrideResult.isDeficit;

    for (const b of fixedEssentialsTier0) {
      b.fundedAmount = b.revisedTarget;
    }
    for (const b of bufferTier0) {
      b.fundedAmount = isDeficit ? 0 : b.revisedTarget;
    }
    if (dailyOpTier0.length > 0) {
      dailyOpTier0[0].fundedAmount = engineOverrideResult.actualDailyOperational;
    }
    if (tier1.length > 0) {
      tier1[0].fundedAmount = engineOverrideResult.actualSavings;
    }
    if (tier2.length > 0) {
      tier2[0].fundedAmount = engineOverrideResult.selfReward;
    }
  } else if (availableFunds < 0) {
    // Deficit state
    isDeficit = true;
    deficitUncovered = Math.abs(availableFunds);

    for (const b of fixedEssentialsTier0) {
      b.fundedAmount = b.revisedTarget;
    }
    for (const b of bufferTier0) {
      b.fundedAmount = 0;
    }
    for (const b of dailyOpTier0) {
      b.fundedAmount = 0;
    }
    for (const b of tier1) {
      b.fundedAmount = 0;
    }
    for (const b of tier2) {
      b.fundedAmount = 0;
    }
  } else {
    // Surplus / Balanced state
    isDeficit = false;
    deficitUncovered = 0;

    // Tier 0 is funded in full
    for (const b of tier0) {
      b.fundedAmount = b.revisedTarget;
    }

    // Tier 1 (Core Savings)
    const tier1TargetSum = tier1.reduce((s, b) => s + b.revisedTarget, 0);
    const tier1FundedTotal = Math.min(availableFunds, tier1TargetSum);

    if (tier1TargetSum > 0) {
      let allocatedTier1 = 0;
      for (let i = 0; i < tier1.length; i++) {
        const b = tier1[i];
        if (i === tier1.length - 1) {
          b.fundedAmount = tier1FundedTotal - allocatedTier1;
        } else {
          const share = Math.round(
            (b.revisedTarget / tier1TargetSum) * tier1FundedTotal,
          );
          b.fundedAmount = share;
          allocatedTier1 += share;
        }
      }
    }

    // Surplus remaining after Tier 1
    const surplusRemaining = availableFunds - tier1FundedTotal;

    // Priority Tier 2 & Surplus Remainder Split
    if (surplusRemaining > 0 && surplusSplit.splits.length > 0) {
      let allocatedSurplus = 0;
      for (let i = 0; i < surplusSplit.splits.length; i++) {
        const item = surplusSplit.splits[i];
        const matchBucket = activeBuckets.find(
          (b) => b.rule.id.toLowerCase() === item.bucketId.toLowerCase(),
        );

        const share =
          i === surplusSplit.splits.length - 1
            ? surplusRemaining - allocatedSurplus
            : Math.round(surplusRemaining * ((item.percent || 0) / 100));

        allocatedSurplus += share;

        if (matchBucket) {
          // If the matchBucket is already a Tier 2 remainder bucket, set or add to fundedAmount
          if (matchBucket.rule.priorityTier >= 2) {
            matchBucket.fundedAmount += share;
          } else {
            // e.g. Extra P1 Savings surplus share
            matchBucket.fundedAmount += share;
          }
        }
      }
    }
  }

  // 4. Calculate Logged Spend per Bucket from Transactions
  if (input.transactions && input.transactions.length > 0) {
    for (const tx of input.transactions) {
      if (tx.type !== 'DEDUCTION' || tx.sourceType === 'OPERATIONAL_REFUND') {
        continue;
      }

      const txAmount = Number(tx.amount) || 0;

      // 1) Match by explicit bucketKey
      if (tx.bucketKey) {
        const matched = activeBuckets.find(
          (b) => b.rule.id.toLowerCase() === tx.bucketKey!.toLowerCase(),
        );
        if (matched) {
          matched.loggedSpend += txAmount;
          continue;
        }
      }

      // 2) Match by fixedEssentialCategory
      if (tx.fixedEssentialCategory) {
        const catKey = tx.fixedEssentialCategory.toLowerCase();
        const matched = activeBuckets.find(
          (b) => b.rule.id.toLowerCase() === catKey,
        );
        if (matched) {
          matched.loggedSpend += txAmount;
          continue;
        }
      }

      // 3) General manual deduction maps to daily_operational
      const dailyOpBucket = activeBuckets.find(
        (b) => b.rule.group === 'DAILY_OPERATIONAL',
      );
      if (dailyOpBucket) {
        dailyOpBucket.loggedSpend += txAmount;
      }
    }
  }

  // 5. Construct Bucket Realizations
  const bucketRealizations: BucketRealization[] = activeBuckets.map((b) => ({
    bucketId: b.rule.id,
    label: b.rule.label,
    group: b.rule.group,
    priorityTier: b.rule.priorityTier,
    formulaType: b.rule.formulaType,
    formulaValue: b.rule.value,
    baselineTarget: b.baselineTarget,
    revisedTarget: b.revisedTarget,
    fundedAmount: b.fundedAmount,
    loggedSpend: b.loggedSpend,
    remainingBudget: b.fundedAmount - b.loggedSpend,
    capHit: b.capHit,
  }));

  // 6. Map to Canonical MonthlySnapshot Columns
  const getBucketTarget = (id: string, group?: BucketGroup) => {
    const found = activeBuckets.find((b) => b.rule.id === id);
    if (found) return found.revisedTarget;
    if (group) {
      const gFound = activeBuckets.find((b) => b.rule.group === group);
      if (gFound) return gFound.revisedTarget;
    }
    return 0;
  };

  const getBucketFunded = (id: string, group?: BucketGroup) => {
    const found = activeBuckets.find((b) => b.rule.id === id);
    if (found) return found.fundedAmount;
    if (group) {
      const gFound = activeBuckets.find((b) => b.rule.group === group);
      if (gFound) return gFound.fundedAmount;
    }
    return 0;
  };

  const actualDailyOperational = engineOverrideResult
    ? engineOverrideResult.actualDailyOperational
    : isDeficit
      ? 0
      : totalDailyOpTarget;
  const actualSavings = engineOverrideResult
    ? engineOverrideResult.actualSavings
    : getBucketFunded('core_savings', 'SAVINGS_P1');
  const selfReward = engineOverrideResult
    ? engineOverrideResult.selfReward
    : getBucketFunded('self_reward', 'SELF_REWARD_P2');
  const survivalPocket = engineOverrideResult
    ? engineOverrideResult.survivalPocket
    : isDeficit
      ? upfrontEssentialAndOperational
      : actualDailyOperational + totalFixedEssentialsTarget;

  const canonicalSnapshotColumns = {
    transport: getBucketTarget('transport'),
    internet: getBucketTarget('internet'),
    vape: getBucketTarget('vape'),
    haircut: getBucketTarget('haircut'),
    dailyOperational: totalDailyOpTarget,
    actualDailyOperational,
    savings: getBucketTarget('core_savings', 'SAVINGS_P1'),
    actualSavings,
    selfRewardTarget: getBucketTarget('self_reward', 'SELF_REWARD_P2'),
    selfReward,
    bufferPocket: totalBufferTarget,
    survivalPocket,
    deficitUncovered,
  };

  // 7. Policy Summary
  const rawDebtRatio =
    finalTotalIncome > 0 ? (totalCreditBills / finalTotalIncome) * 100 : 0;
  const savingsRatePercent =
    finalTotalIncome > 0 ? (actualSavings / finalTotalIncome) * 100 : 0;

  const policySummary = {
    debtRatio: Math.round(rawDebtRatio * 10) / 10,
    isOptimalDebt: rawDebtRatio <= policy.optimalDebtRatioPercent,
    isHighDebt: rawDebtRatio > policy.maxSafeDebtRatioPercent,
    savingsRatePercent: Math.round(savingsRatePercent * 10) / 10,
    isSavingsTargetMet: savingsRatePercent >= policy.targetSavingsRatePercent,
    isOperationalFloorMet:
      actualDailyOperational >= policy.criticalOperationalFloorRp,
  };

  return {
    payroll: {
      adjustedBaseSalary: payroll.adjustedBaseSalary,
      bpjsDeduction: payroll.bpjsDeduction,
      laptopAllowance: payroll.laptopAllowance,
      totalDailyAllowance: payroll.totalDailyAllowance,
      netSalaryIncome: payroll.netSalaryIncome,
      finalTotalIncome: payroll.finalTotalIncome,
      componentBreakdown: payroll.componentBreakdown,
    },
    waterfall: {
      availableFunds,
      deficitUncovered,
      actualDailyOperational,
      actualSavings,
      actualSelfReward: selfReward,
      selfReward,
      survivalPocket,
      isDeficit,
    },
    canonicalSnapshotColumns,
    bucketRealizations,
    policySummary,
  };
}
