export type FlagType = 'GREEN' | 'RED';
export type AuditCategory =
  | 'OPERATIONAL_BUDGET'
  | 'SELF_REWARD'
  | 'DEBT_BURDEN'
  | 'SAVINGS'
  | 'INFORMAL_DEBT'
  | 'DEFICIT'
  | 'SAVINGS_VAULT';

export type HealthStatus = 'EXCELLENT' | 'GOOD' | 'CAUTION' | 'CRITICAL';
export type OperationalBudgetStatus = 'HEALTHY' | 'TIGHT' | 'CRITICAL';

export interface AuditFlag {
  id: string;
  category: AuditCategory;
  type: FlagType;
  title: string;
  description: string;
  amount?: number;
  month?: number;
  year?: number;
}

export interface OperationalAuditEntry {
  month: number;
  year: number;
  targetAmount: number;
  actualAmount: number;
  shortfall: number;
  isDeficit: boolean;
  status: OperationalBudgetStatus;
}

export interface SelfRewardAuditEntry {
  month: number;
  year: number;
  targetAmount: number;
  actualAmount: number;
  isAchieved: boolean;
  streakWithoutReward: number;
}

export interface DebtBurdenAuditEntry {
  month: number;
  year: number;
  totalIncome: number;
  totalBills: number;
  debtRatio: number;
  isHeavyBurden: boolean;
  ccUsage: number;
  ccUsageLimit: number;
  paylaterUsage: number;
  paylaterUsageLimit: number;
  isCreditLimitConfigured: boolean;
  isCreditLimitExceeded: boolean;
}

export interface SavingsAuditEntry {
  month: number;
  year: number;
  targetSavings: number;
  actualSavings: number;
  isMet: boolean;
}

export interface SnapshotAuditInput {
  id?: string | number;
  month: number;
  year: number;
  totalIncome: number;
  actualDailyOperational: number;
  targetDailyOperational: number;
  selfReward: number;
  targetSelfReward: number;
  actualSavings: number;
  targetSavings: number;
  totalBills: number;
  personalDebt?: number;
  deficitUncovered?: number;
  ccUsage?: number;
  ccUsageLimit?: number;
  paylaterUsage?: number;
  paylaterUsageLimit?: number;
}

export interface WithdrawalAuditInput {
  id?: string | number;
  amount: number;
  remark?: string;
  date?: string | Date;
}

export interface AuditEvaluationResult {
  healthScorecard: {
    disciplineScore: number;
    healthStatus: HealthStatus;
    totalGreenFlags: number;
    totalRedFlags: number;
    totalChecks: number;
  };
  operationalAudit: OperationalAuditEntry[];
  selfRewardAudit: SelfRewardAuditEntry[];
  debtBurdenAudit: DebtBurdenAuditEntry[];
  savingsAudit: SavingsAuditEntry[];
  flags: AuditFlag[];
}

export function calculateDisciplineScore(
  totalGreenFlags: number,
  totalRedFlags: number,
): number {
  const total = totalGreenFlags + totalRedFlags;
  if (total <= 0) return 100;
  return Math.round((totalGreenFlags / total) * 100);
}

export function getHealthStatus(disciplineScore: number): HealthStatus {
  if (disciplineScore < 50) return 'CRITICAL';
  if (disciplineScore < 75) return 'CAUTION';
  if (disciplineScore < 90) return 'GOOD';
  return 'EXCELLENT';
}

export function evaluateAuditDimensions(
  snapshots: SnapshotAuditInput[],
  withdrawals: WithdrawalAuditInput[] = [],
  policy?: Partial<{
    optimalDebtRatioPercent: number;
    maxSafeDebtRatioPercent: number;
    targetSavingsRatePercent: number;
    criticalOperationalFloorRp: number;
  }>,
): AuditEvaluationResult {
  const flags: AuditFlag[] = [];
  const operationalAudit: OperationalAuditEntry[] = [];
  const selfRewardAudit: SelfRewardAuditEntry[] = [];
  const debtBurdenAudit: DebtBurdenAuditEntry[] = [];
  const savingsAudit: SavingsAuditEntry[] = [];

  let totalGreenFlags = 0;
  let totalRedFlags = 0;
  let consecutiveZeroRewardStreak = 0;

  // Sort snapshots chronologically
  const sortedSnapshots = [...snapshots].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  for (const s of sortedSnapshots) {
    const personalDebt = s.personalDebt ?? 0;
    const deficitUncovered = s.deficitUncovered ?? 0;
    const snapshotKey = `${s.year}-${s.month}`;

    // 1. OPERATIONAL & LIVING BUDGET AUDIT
    const operationalShortfall = Math.max(
      0,
      s.targetDailyOperational - s.actualDailyOperational,
    );
    const isOperationalDeficit =
      s.actualDailyOperational < s.targetDailyOperational;

    let opStatus: OperationalBudgetStatus = 'HEALTHY';
    if (isOperationalDeficit) {
      opStatus =
        s.actualDailyOperational <
        (policy?.criticalOperationalFloorRp ?? 1000000)
          ? 'CRITICAL'
          : 'TIGHT';
      totalRedFlags++;
      flags.push({
        id: `op-deficit-${snapshotKey}`,
        category: 'OPERATIONAL_BUDGET',
        type: 'RED',
        title: `Living Budget Shortfall (${s.month}/${s.year})`,
        description: `Daily living funds dropped to Rp ${s.actualDailyOperational.toLocaleString('id-ID')} (Rp ${operationalShortfall.toLocaleString('id-ID')} below target Rp ${s.targetDailyOperational.toLocaleString('id-ID')}).`,
        amount: operationalShortfall,
        month: s.month,
        year: s.year,
      });
    } else {
      totalGreenFlags++;
      flags.push({
        id: `op-healthy-${snapshotKey}`,
        category: 'OPERATIONAL_BUDGET',
        type: 'GREEN',
        title: `Living Budget Fully Funded (${s.month}/${s.year})`,
        description: `Daily living pocket is healthy at Rp ${s.actualDailyOperational.toLocaleString('id-ID')}.`,
        amount: s.actualDailyOperational,
        month: s.month,
        year: s.year,
      });
    }

    operationalAudit.push({
      month: s.month,
      year: s.year,
      targetAmount: s.targetDailyOperational,
      actualAmount: s.actualDailyOperational,
      shortfall: operationalShortfall,
      isDeficit: isOperationalDeficit,
      status: opStatus,
    });

    // 2. SELF REWARD AUDIT
    const hasSelfReward = s.selfReward > 0;
    if (hasSelfReward) {
      consecutiveZeroRewardStreak = 0;
      totalGreenFlags++;
      flags.push({
        id: `reward-achieved-${snapshotKey}`,
        category: 'SELF_REWARD',
        type: 'GREEN',
        title: `Self-Reward Unlocked (${s.month}/${s.year})`,
        description: `Full self-reward allocation of Rp ${s.selfReward.toLocaleString('id-ID')} funded successfully.`,
        amount: s.selfReward,
        month: s.month,
        year: s.year,
      });
    } else {
      consecutiveZeroRewardStreak++;
      if (consecutiveZeroRewardStreak >= 2) {
        totalRedFlags++;
        flags.push({
          id: `reward-streak-${snapshotKey}`,
          category: 'SELF_REWARD',
          type: 'RED',
          title: `Self-Reward Deprived (${s.month}/${s.year})`,
          description: `Zero self-reward funded for ${consecutiveZeroRewardStreak} consecutive months due to high debt obligations.`,
          amount: s.targetSelfReward,
          month: s.month,
          year: s.year,
        });
      }
    }

    selfRewardAudit.push({
      month: s.month,
      year: s.year,
      targetAmount: s.targetSelfReward,
      actualAmount: s.selfReward,
      isAchieved: s.selfReward >= s.targetSelfReward,
      streakWithoutReward: consecutiveZeroRewardStreak,
    });

    // 3. DEBT & LIABILITIES BURDEN AUDIT (+ CONFIGURED CREDIT USAGE LIMIT AUDIT)
    const rawDebtRatio =
      s.totalIncome > 0 ? (s.totalBills / s.totalIncome) * 100 : 0;
    const debtRatio = Math.round(rawDebtRatio);
    const maxSafeDebt = policy?.maxSafeDebtRatioPercent ?? 35;
    const optimalDebt = policy?.optimalDebtRatioPercent ?? 25;
    const isHighDebt = rawDebtRatio > maxSafeDebt;

    if (isHighDebt) {
      totalRedFlags++;
      flags.push({
        id: `debt-pressure-${snapshotKey}`,
        category: 'DEBT_BURDEN',
        type: 'RED',
        title: `High Debt Burden Squeezing Cashflow (${s.month}/${s.year})`,
        description: `Monthly liabilities consumed ${debtRatio}% of total income (Rp ${s.totalBills.toLocaleString('id-ID')} of Rp ${s.totalIncome.toLocaleString('id-ID')}).`,
        amount: s.totalBills,
        month: s.month,
        year: s.year,
      });
    } else if (rawDebtRatio > 0 && rawDebtRatio <= optimalDebt) {
      totalGreenFlags++;
      flags.push({
        id: `debt-relief-${snapshotKey}`,
        category: 'DEBT_BURDEN',
        type: 'GREEN',
        title: `Debt Relief & Cashflow Expansion (${s.month}/${s.year})`,
        description: `Liabilities dropped to a light ${debtRatio}% of income (Rp ${s.totalBills.toLocaleString('id-ID')}).`,
        amount: s.totalBills,
        month: s.month,
        year: s.year,
      });
    }

    const ccUsage = Math.max(0, Math.round(s.ccUsage ?? 0));
    const ccUsageLimit = Math.max(0, Math.round(s.ccUsageLimit ?? 0));
    const paylaterUsage = Math.max(0, Math.round(s.paylaterUsage ?? 0));
    const paylaterUsageLimit = Math.max(
      0,
      Math.round(s.paylaterUsageLimit ?? 0),
    );
    const isCreditLimitConfigured = ccUsageLimit > 0 || paylaterUsageLimit > 0;
    const isCcBreached = ccUsageLimit > 0 && ccUsage > ccUsageLimit;
    const isPaylaterBreached =
      paylaterUsageLimit > 0 && paylaterUsage > paylaterUsageLimit;
    const isCreditLimitExceeded = isCcBreached || isPaylaterBreached;

    if (isCreditLimitConfigured) {
      if (isCreditLimitExceeded) {
        totalRedFlags++;
        const breachParts: string[] = [];
        let exceededTotal = 0;
        if (isCcBreached) {
          const diff = ccUsage - ccUsageLimit;
          exceededTotal += diff;
          breachParts.push(
            `Credit Card Rp ${ccUsage.toLocaleString('id-ID')} / Rp ${ccUsageLimit.toLocaleString('id-ID')} (+Rp ${diff.toLocaleString('id-ID')})`,
          );
        }
        if (isPaylaterBreached) {
          const diff = paylaterUsage - paylaterUsageLimit;
          exceededTotal += diff;
          breachParts.push(
            `PayLater Rp ${paylaterUsage.toLocaleString('id-ID')} / Rp ${paylaterUsageLimit.toLocaleString('id-ID')} (+Rp ${diff.toLocaleString('id-ID')})`,
          );
        }
        flags.push({
          id: `credit-limit-exceeded-${snapshotKey}`,
          category: 'DEBT_BURDEN',
          type: 'RED',
          title: `Credit Usage Limit Exceeded (${s.month}/${s.year})`,
          description: `Period credit cap breached: ${breachParts.join('; ')}.`,
          amount: exceededTotal,
          month: s.month,
          year: s.year,
        });
      } else {
        totalGreenFlags++;
        const respectedParts: string[] = [];
        let trackedUsageTotal = 0;
        if (ccUsageLimit > 0) {
          trackedUsageTotal += ccUsage;
          respectedParts.push(
            `Credit Card Rp ${ccUsage.toLocaleString('id-ID')} / Rp ${ccUsageLimit.toLocaleString('id-ID')}`,
          );
        }
        if (paylaterUsageLimit > 0) {
          trackedUsageTotal += paylaterUsage;
          respectedParts.push(
            `PayLater Rp ${paylaterUsage.toLocaleString('id-ID')} / Rp ${paylaterUsageLimit.toLocaleString('id-ID')}`,
          );
        }
        flags.push({
          id: `credit-limit-respected-${snapshotKey}`,
          category: 'DEBT_BURDEN',
          type: 'GREEN',
          title: `Credit Usage Within Limit (${s.month}/${s.year})`,
          description: `Configured period credit cap respected: ${respectedParts.join('; ')}.`,
          amount: trackedUsageTotal,
          month: s.month,
          year: s.year,
        });
      }
    }

    debtBurdenAudit.push({
      month: s.month,
      year: s.year,
      totalIncome: s.totalIncome,
      totalBills: s.totalBills,
      debtRatio,
      isHeavyBurden: isHighDebt,
      ccUsage,
      ccUsageLimit,
      paylaterUsage,
      paylaterUsageLimit,
      isCreditLimitConfigured,
      isCreditLimitExceeded,
    });

    // 4. SAVINGS TARGET AUDIT
    const isSavingsMet = s.actualSavings >= s.targetSavings;
    if (isSavingsMet) {
      totalGreenFlags++;
      flags.push({
        id: `savings-met-${snapshotKey}`,
        category: 'SAVINGS',
        type: 'GREEN',
        title: `Savings Target Met (${s.month}/${s.year})`,
        description: `Successfully preserved full monthly savings of Rp ${s.actualSavings.toLocaleString('id-ID')}.`,
        amount: s.actualSavings,
        month: s.month,
        year: s.year,
      });
    } else {
      totalRedFlags++;
      flags.push({
        id: `savings-missed-${snapshotKey}`,
        category: 'SAVINGS',
        type: 'RED',
        title: `Savings Target Slashed (${s.month}/${s.year})`,
        description: `Only saved Rp ${s.actualSavings.toLocaleString('id-ID')} out of target Rp ${s.targetSavings.toLocaleString('id-ID')}.`,
        amount: s.targetSavings - s.actualSavings,
        month: s.month,
        year: s.year,
      });
    }

    savingsAudit.push({
      month: s.month,
      year: s.year,
      targetSavings: s.targetSavings,
      actualSavings: s.actualSavings,
      isMet: isSavingsMet,
    });

    // 5. PRE-PAYROLL INFORMAL BORROWING AUDIT
    if (personalDebt > 0) {
      totalRedFlags++;
      flags.push({
        id: `personal-debt-${snapshotKey}`,
        category: 'INFORMAL_DEBT',
        type: 'RED',
        title: `Pre-Payroll Borrowing Recorded (${s.month}/${s.year})`,
        description: `Borrowed Rp ${personalDebt.toLocaleString('id-ID')} before payday to bridge cash shortfall.`,
        amount: personalDebt,
        month: s.month,
        year: s.year,
      });
    }

    // 6. UNCOVERED CASHFLOW DEFICIT AUDIT
    if (deficitUncovered > 0) {
      totalRedFlags++;
      flags.push({
        id: `cash-deficit-${snapshotKey}`,
        category: 'DEFICIT',
        type: 'RED',
        title: `Uncovered Cashflow Deficit (${s.month}/${s.year})`,
        description: `Expenses and debt exceeded total income by -Rp ${deficitUncovered.toLocaleString('id-ID')}.`,
        amount: deficitUncovered,
        month: s.month,
        year: s.year,
      });
    }
  }

  // 7. SAVINGS VAULT DRAWDOWN AUDIT
  for (const w of withdrawals) {
    const amount = Math.abs(w.amount);
    totalRedFlags++;
    flags.push({
      id: `vault-wd-${w.id ?? Math.random().toString(36).substring(2, 9)}`,
      category: 'SAVINGS_VAULT',
      type: 'RED',
      title: 'Emergency Vault Drawdown',
      description: `Withdrew Rp ${amount.toLocaleString('id-ID')} from savings vault.${w.remark ? ` Reason: "${w.remark}".` : ''}`,
      amount,
    });
  }

  const totalChecks = totalGreenFlags + totalRedFlags;
  const disciplineScore = calculateDisciplineScore(
    totalGreenFlags,
    totalRedFlags,
  );
  const healthStatus = getHealthStatus(disciplineScore);

  return {
    healthScorecard: {
      disciplineScore,
      healthStatus,
      totalGreenFlags,
      totalRedFlags,
      totalChecks,
    },
    operationalAudit,
    selfRewardAudit,
    debtBurdenAudit,
    savingsAudit,
    flags,
  };
}
