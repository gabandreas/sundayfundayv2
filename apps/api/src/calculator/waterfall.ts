export type FixedEssentialCategoryKey =
  | 'TRANSPORT'
  | 'INTERNET'
  | 'VAPE'
  | 'HAIRCUT';

export type FormulaEngineType =
  | 'DEBT_FIRST_WATERFALL'
  | 'SAVINGS_FIRST_LOCK'
  | 'PERCENTAGE_SPLIT'
  | 'RETIREMENT_DRAWDOWN';

export interface CustomIncomeDeductionRow {
  id: string;
  label: string;
  amount: number;
  direction: 'INCOME' | 'DEDUCTION';
}

export interface FormulaParams {
  // SAVINGS_FIRST_LOCK parameters
  savingsLockMode?: 'FIXED' | 'PERCENT';
  savingsLockPercent?: number;
  savingsLockFixedIdr?: number;

  // PERCENTAGE_SPLIT parameters (e.g. 50 / 30 / 20)
  needsPercent?: number;
  wantsPercent?: number;
  savingsPercent?: number;

  // RETIREMENT_DRAWDOWN parameters
  monthlyVaultDrawdown?: number;
  healthcareReserveTarget?: number;

  // Dynamic Custom Payroll Income & Deduction rows
  customPayrollRows?: CustomIncomeDeductionRow[];
}

export interface FixedEssentialTargets {
  transport?: number;
  internet?: number;
  vape?: number;
  haircut?: number;
}

export interface FixedEssentialTransactionLike {
  type: string;
  sourceType?: string | null;
  fixedEssentialCategory?: string | null;
  amount: number;
}

export interface FixedEssentialItemRealization {
  category: FixedEssentialCategoryKey;
  label: string;
  target: number;
  spent: number;
  coveredByPool: number;
  overage: number;
  remainingPool: number;
  utilizationPercent: number;
}

export interface FixedEssentialsRealizationSummary {
  items: FixedEssentialItemRealization[];
  totalTarget: number;
  totalSpent: number;
  totalCoveredByPool: number;
  totalOverage: number;
  totalRemainingPool: number;
}

export interface WaterfallInput {
  finalTotalIncome: number;
  totalDeductions: number;
  savingsTarget: number;
  selfRewardTarget?: number;
  dailyOperationalTarget: number;
  fixedExpenses?: number;
  bufferPocket?: number;
  formulaEngineType?: FormulaEngineType;
  formulaParams?: FormulaParams | null;
}

export interface WaterfallResult {
  availableFunds: number;
  deficitUncovered: number;
  actualSavings: number;
  actualSelfReward: number;
  selfReward: number;
  actualDailyOperational: number;
  survivalPocket: number;
  isDeficit: boolean;
  formulaEngineType?: FormulaEngineType;
}

const FIXED_ESSENTIAL_DEFINITIONS: Array<{
  category: FixedEssentialCategoryKey;
  label: string;
  key: keyof FixedEssentialTargets;
}> = [
  { category: 'TRANSPORT', label: 'Transport', key: 'transport' },
  { category: 'INTERNET', label: 'Internet & Connectivity', key: 'internet' },
  { category: 'VAPE', label: 'Vape Supplies', key: 'vape' },
  { category: 'HAIRCUT', label: 'Haircut & Grooming', key: 'haircut' },
];

export function calculateFixedEssentialsRealization(
  transactions: FixedEssentialTransactionLike[],
  targets: FixedEssentialTargets = {},
): FixedEssentialsRealizationSummary {
  const items: FixedEssentialItemRealization[] =
    FIXED_ESSENTIAL_DEFINITIONS.map((def) => {
      const target = Math.max(0, Number(targets[def.key] ?? 0));
      const spent = transactions
        .filter(
          (t) =>
            t.type === 'DEDUCTION' &&
            t.fixedEssentialCategory === def.category,
        )
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const coveredByPool = Math.min(spent, target);
      const overage = Math.max(0, spent - target);
      const remainingPool = Math.max(0, target - spent);
      const utilizationPercent =
        target > 0
          ? Math.round((spent / target) * 1000) / 10
          : spent > 0
            ? 100
            : 0;

      return {
        category: def.category,
        label: def.label,
        target,
        spent,
        coveredByPool,
        overage,
        remainingPool,
        utilizationPercent,
      };
    });

  return {
    items,
    totalTarget: items.reduce((sum, i) => sum + i.target, 0),
    totalSpent: items.reduce((sum, i) => sum + i.spent, 0),
    totalCoveredByPool: items.reduce((sum, i) => sum + i.coveredByPool, 0),
    totalOverage: items.reduce((sum, i) => sum + i.overage, 0),
    totalRemainingPool: items.reduce((sum, i) => sum + i.remainingPool, 0),
  };
}

export function sumOperationalRefunds(
  transactions: FixedEssentialTransactionLike[],
): number {
  return transactions
    .filter((t) => t.sourceType === 'OPERATIONAL_REFUND')
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

export function calculateOperationalDailySpent(
  transactions: FixedEssentialTransactionLike[],
  fixedTargets?: FixedEssentialTargets,
): number {
  const generalDailySpent = transactions
    .filter(
      (t) =>
        t.type === 'DEDUCTION' &&
        (t.sourceType === 'MANUAL' || !t.sourceType) &&
        !t.fixedEssentialCategory,
    )
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const fixedOverage = fixedTargets
    ? calculateFixedEssentialsRealization(transactions, fixedTargets)
        .totalOverage
    : 0;

  const operationalRefunds = sumOperationalRefunds(transactions);

  return Math.max(0, generalDailySpent + fixedOverage - operationalRefunds);
}

export function calculateTotalDeductions(
  transactions: FixedEssentialTransactionLike[],
  fixedTargets?: FixedEssentialTargets,
  dailyOperationalTarget?: number,
): number {
  const creditBills = transactions
    .filter((t) => t.type === 'CREDIT_BILL')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const generalManualDeductions = transactions
    .filter((t) => t.type === 'DEDUCTION' && !t.fixedEssentialCategory)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const fixedEssentialOverage = fixedTargets
    ? calculateFixedEssentialsRealization(transactions, fixedTargets)
        .totalOverage
    : 0;

  const operationalRefunds = sumOperationalRefunds(transactions);
  const netGeneralManualSpend = Math.max(
    0,
    generalManualDeductions - operationalRefunds,
  );

  const dailyOperationalOverage =
    dailyOperationalTarget !== undefined
      ? Math.max(0, netGeneralManualSpend - dailyOperationalTarget)
      : netGeneralManualSpend;

  const netManualDeductions = dailyOperationalOverage + fixedEssentialOverage;

  return creditBills + netManualDeductions;
}

export function calculateWaterfall(input: WaterfallInput): WaterfallResult {
  const fixedExpenses = Math.max(0, input.fixedExpenses ?? 0);
  const bufferPocket = Math.max(0, input.bufferPocket ?? 0);
  const savingsTarget = Math.max(0, input.savingsTarget ?? 0);
  const dailyOperationalTarget = Math.max(0, input.dailyOperationalTarget ?? 0);
  const totalDeductions = Math.max(0, input.totalDeductions ?? 0);
  const engine = input.formulaEngineType || 'DEBT_FIRST_WATERFALL';
  const params = input.formulaParams || {};

  // ── Engine 2: SAVINGS_FIRST_LOCK (Pay-Yourself-First / Aggressive Wealth Builder)
  if (engine === 'SAVINGS_FIRST_LOCK') {
    const desiredSavings =
      params.savingsLockMode === 'PERCENT' && params.savingsLockPercent !== undefined
        ? Math.round(input.finalTotalIncome * (Math.max(0, params.savingsLockPercent) / 100))
        : params.savingsLockFixedIdr !== undefined
          ? Math.max(0, params.savingsLockFixedIdr)
          : savingsTarget;

    const afterDebt = input.finalTotalIncome - totalDeductions - bufferPocket;
    const lockedSavings =
      afterDebt > fixedExpenses
        ? Math.min(afterDebt - fixedExpenses, desiredSavings)
        : 0;
    const remainingAfterSavingsAndRoutine =
      afterDebt - lockedSavings - fixedExpenses;

    if (remainingAfterSavingsAndRoutine < 0) {
      const shortfall = Math.abs(
        afterDebt - fixedExpenses - dailyOperationalTarget,
      );
      return {
        availableFunds: remainingAfterSavingsAndRoutine,
        deficitUncovered: shortfall,
        actualSavings: 0,
        actualSelfReward: 0,
        selfReward: 0,
        actualDailyOperational: 0,
        survivalPocket: fixedExpenses + dailyOperationalTarget,
        isDeficit: true,
        formulaEngineType: engine,
      };
    }

    const actualDailyOperational =
      dailyOperationalTarget > 0
        ? Math.min(remainingAfterSavingsAndRoutine, dailyOperationalTarget)
        : remainingAfterSavingsAndRoutine;
    const selfReward = Math.max(
      0,
      remainingAfterSavingsAndRoutine - actualDailyOperational,
    );

    return {
      availableFunds: lockedSavings + selfReward,
      deficitUncovered: 0,
      actualSavings: lockedSavings,
      actualSelfReward: selfReward,
      selfReward,
      actualDailyOperational,
      survivalPocket: actualDailyOperational + fixedExpenses,
      isDeficit: false,
      formulaEngineType: engine,
    };
  }

  // ── Engine 3: PERCENTAGE_SPLIT (50/30/20 or Custom % Split)
  if (engine === 'PERCENTAGE_SPLIT') {
    const needsPct = Math.max(0, Number(params.needsPercent ?? 50));
    const wantsPct = Math.max(0, Number(params.wantsPercent ?? 30));
    const savingsPct = Math.max(0, Number(params.savingsPercent ?? 20));
    const totalPct = needsPct + wantsPct + savingsPct || 100;

    const needsPool = Math.round(
      input.finalTotalIncome * (needsPct / totalPct),
    );
    const wantsPool = Math.round(
      input.finalTotalIncome * (wantsPct / totalPct),
    );
    const savingsPool = Math.max(
      0,
      input.finalTotalIncome - needsPool - wantsPool,
    );

    const mandatoryCommitments = totalDeductions + fixedExpenses + bufferPocket;
    if (input.finalTotalIncome < mandatoryCommitments) {
      const deficit =
        mandatoryCommitments + dailyOperationalTarget - input.finalTotalIncome;
      return {
        availableFunds: input.finalTotalIncome - mandatoryCommitments - dailyOperationalTarget,
        deficitUncovered: Math.max(0, deficit),
        actualSavings: 0,
        actualSelfReward: 0,
        selfReward: 0,
        actualDailyOperational: 0,
        survivalPocket: fixedExpenses + dailyOperationalTarget,
        isDeficit: true,
        formulaEngineType: engine,
      };
    }

    let actualDailyOperational: number;
    let actualSavings: number;
    let selfReward: number;

    if (needsPool >= mandatoryCommitments) {
      actualDailyOperational = needsPool - mandatoryCommitments;
      actualSavings = savingsPool;
      selfReward = wantsPool;
    } else {
      const remainingAfterMandatory =
        input.finalTotalIncome - mandatoryCommitments;
      actualDailyOperational =
        dailyOperationalTarget > 0
          ? Math.min(remainingAfterMandatory, dailyOperationalTarget)
          : Math.round(remainingAfterMandatory * 0.5);
      const afterLiving = Math.max(
        0,
        remainingAfterMandatory - actualDailyOperational,
      );
      actualSavings = Math.min(afterLiving, savingsPool);
      selfReward = Math.max(0, afterLiving - actualSavings);
    }

    return {
      availableFunds: actualSavings + selfReward,
      deficitUncovered: 0,
      actualSavings,
      actualSelfReward: selfReward,
      selfReward,
      actualDailyOperational,
      survivalPocket: actualDailyOperational + fixedExpenses,
      isDeficit: false,
      formulaEngineType: engine,
    };
  }

  // ── Engine 4: RETIREMENT_DRAWDOWN (Golden Age / Passive Income + Vault Drawdown)
  if (engine === 'RETIREMENT_DRAWDOWN') {
    const monthlyVaultDrawdown = Math.max(
      0,
      Number(params.monthlyVaultDrawdown ?? 0),
    );
    const healthcareReserve = Math.max(
      0,
      Number(params.healthcareReserveTarget ?? 0),
    );
    const totalCashflow = input.finalTotalIncome + monthlyVaultDrawdown;
    const priorityHealthcareAndFixed =
      fixedExpenses + healthcareReserve + totalDeductions + bufferPocket;

    const remainingForLiving = totalCashflow - priorityHealthcareAndFixed;
    if (remainingForLiving < 0) {
      return {
        availableFunds: remainingForLiving - dailyOperationalTarget,
        deficitUncovered: Math.abs(remainingForLiving - dailyOperationalTarget),
        actualSavings: 0,
        actualSelfReward: 0,
        selfReward: 0,
        actualDailyOperational: 0,
        survivalPocket: fixedExpenses + healthcareReserve + dailyOperationalTarget,
        isDeficit: true,
        formulaEngineType: engine,
      };
    }

    const actualDailyOperational =
      dailyOperationalTarget > 0
        ? Math.min(remainingForLiving, dailyOperationalTarget)
        : remainingForLiving;
    const postLivingSurplus = Math.max(
      0,
      remainingForLiving - actualDailyOperational,
    );
    const effectiveSavingsTarget = savingsTarget + healthcareReserve;
    const actualSavings = Math.min(postLivingSurplus, effectiveSavingsTarget);
    const selfReward = Math.max(0, postLivingSurplus - actualSavings);

    return {
      availableFunds: postLivingSurplus,
      deficitUncovered: 0,
      actualSavings,
      actualSelfReward: selfReward,
      selfReward,
      actualDailyOperational,
      survivalPocket: actualDailyOperational + fixedExpenses + healthcareReserve,
      isDeficit: false,
      formulaEngineType: engine,
    };
  }

  // ── Engine 1 (Default): DEBT_FIRST_WATERFALL (100% Untouched Canonical Logic)
  // 1. Upfront non-negotiable essentials & daily operational living budget
  const essentialAndOperational = fixedExpenses + dailyOperationalTarget;

  // Available funds after upfront non-negotiable commitments & debt deductions
  const availableFunds =
    input.finalTotalIncome -
    essentialAndOperational -
    bufferPocket -
    totalDeductions;

  // 2. Deficit branch (availableFunds < 0)
  if (availableFunds < 0) {
    return {
      availableFunds,
      deficitUncovered: Math.abs(availableFunds),
      actualSavings: 0,
      actualSelfReward: 0,
      selfReward: 0,
      actualDailyOperational: 0,
      survivalPocket: essentialAndOperational, // Reflects the NEED, not what was actually available
      isDeficit: true,
    };
  }

  // 3. Surplus branch (availableFunds >= 0)
  // Daily Operational is guaranteed in full — no longer competes in the waterfall
  const actualDailyOperational = dailyOperationalTarget;

  // Priority 1: Core Savings Target
  const actualSavings = Math.min(availableFunds, savingsTarget);

  // Priority 2: Self-Reward Surplus (uncapped — absorbs normal self-reward allocation and surplus overflow)
  const selfReward = availableFunds - actualSavings;

  // Survival pocket represents actual daily operational + fixed essentials
  const survivalPocket = actualDailyOperational + fixedExpenses;

  return {
    availableFunds,
    deficitUncovered: 0,
    actualSavings,
    actualSelfReward: selfReward,
    selfReward,
    actualDailyOperational,
    survivalPocket,
    isDeficit: false,
  };
}
