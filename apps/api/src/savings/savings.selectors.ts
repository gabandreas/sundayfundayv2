import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SnapshotStatus } from '@prisma/client';
import {
  extractPeriodTagFromLabel,
  calculateWealthTargetPlan,
  WealthTargetPlanResult,
} from './savings.utils';
import { buildDefaultSandboxState } from '../config/sandbox.defaults';
import { resolveStudioConfig } from '../config/studio.defaults';

export interface SavingsMilestone {
  months: number;
  targetAmount: number;
  progressPercent: number;
  isAchieved: boolean;
}

export interface UntransferredLockedPeriod {
  month: number;
  year: number;
  actualSavings: number;
  transferredAmount: number;
  untransferredAmount: number;
  suggestedLabel: string;
}

export interface SavingsPeriodLedgerItem {
  month: number;
  year: number;
  status: SnapshotStatus;
  monthlyTarget: number;
  actualSavings: number;
  depositedAmount: number;
  pendingTransfer: number;
  isFullyDeposited: boolean;
}

export interface EnrichedSavingsGoal {
  id: number;
  name: string;
  targetAmount: number;
  currentAllocatedAmount: number;
  targetMonth: number;
  targetYear: number;
  category: string;
  wishlistItemId?: number | null;
  isCompleted: boolean;
  isReadyToBuy?: boolean;
  linkedWishlistItem?: {
    id: number;
    name: string;
    price: number;
    status: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  progressPercent: number;
  remainingNeeded: number;
  monthsUntilTarget: number;
  requiredMonthlyContribution: number;
  projectedMonthsAtPace: number | null;
  projectedCompletionDate: string | null;
}

export interface SavingsOverviewResult {
  kpi: {
    totalVaultBalance: number;
    liquidCashBalance: number;
    investmentRdpuBalance: number;
    liquidSharePercent: number;
    rdpuSharePercent: number;
    totalPlanned2026P1: number;
    avgMonthlySavingsP1: number;
    averageMonthlySavingsRatePercent: number;
  };
  accumulationLedger: SavingsPeriodLedgerItem[];
  goals: EnrichedSavingsGoal[];
  wealthTargetPlan?: WealthTargetPlanResult;
  wealthTargetConfig?: {
    targetBalance: number;
    targetMonth: number;
    targetYear: number;
    base: string;
  };
  financialCapacity?: {
    currentPeriodNetIncome: number;
    maxMonthlySavableCapacity: number;
    avgMonthlySavingsP1: number;
  };
  pocketsSummary?: {
    totalConfirmedSavingsRp: number;
    totalAllocatedRp: number;
    unallocatedPoolRp: number;
    pockets: any[];
  };
}

export interface SavingsVaultResult {
  balance: number;
  liquidCashBalance: number;
  investmentRdpuBalance: number;
  liquidSharePercent: number;
  rdpuSharePercent: number;
  monthlyLivingExpenseBaseline: number;
  runwayMonths: number;
  milestones: SavingsMilestone[];
  transactions: any[];
  periodDepositsByPeriod: Record<string, number>;
  untransferredLockedPeriods: UntransferredLockedPeriod[];
  overview: SavingsOverviewResult;
}

@Injectable()
export class SavingsSelectors {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns complete Savings Vault view with liquid cash vs RDPU investment breakdown,
   * running vault balance, and 100% user-defined milestones.
   */
  async getVault(
    referenceMonth?: number,
    referenceYear?: number,
    userId: number = 1,
  ): Promise<SavingsVaultResult> {
    const [config, transactions, lockedSnapshots, overview] = await Promise.all([
      this.prisma.globalConfig.findFirst({ where: { userId } }),
      this.prisma.savingsManualTransaction.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      }),
      this.prisma.monthlySnapshot.findMany({
        where: { userId, status: SnapshotStatus.LOCKED },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
      this.getOverview(new Date(), userId),
    ]);

    const rawBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
    const studioConfig = resolveStudioConfig(userId, config?.formulaParamsJson, config);
    const epochYm =
      (studioConfig.paycycleFormulaConfig.ledgerEpochYear ?? 2026) * 12 +
      (studioConfig.paycycleFormulaConfig.ledgerEpochMonth ?? 10);
    const scopedLockedSnapshots = lockedSnapshots.filter(
      (s) => s.year * 12 + s.month >= epochYm,
    );
    const hasP1Override =
      studioConfig.actualP1VaultBalanceRp !== null &&
      studioConfig.actualP1VaultBalanceRp !== undefined &&
      !Number.isNaN(Number(studioConfig.actualP1VaultBalanceRp));
    const balance = hasP1Override
      ? Math.max(0, Math.round(Number(studioConfig.actualP1VaultBalanceRp)))
      : rawBalance;
    const investmentRdpuBalanceRaw = transactions
      .filter((t) => t.instrumentType === 'INVESTMENT_RDPU')
      .reduce((sum, t) => sum + t.amount, 0);
    const liquidCashBalance = hasP1Override
      ? Math.max(0, balance - Math.max(0, investmentRdpuBalanceRaw))
      : transactions
          .filter((t) => (t.instrumentType ?? 'LIQUID_CASH') === 'LIQUID_CASH')
          .reduce((sum, t) => sum + t.amount, 0);
    const investmentRdpuBalance = investmentRdpuBalanceRaw;

    const positivePoolTotal =
      Math.max(0, liquidCashBalance) + Math.max(0, investmentRdpuBalance);
    const liquidSharePercent =
      positivePoolTotal > 0
        ? Math.round(
            (Math.max(0, liquidCashBalance) / positivePoolTotal) * 1000,
          ) / 10
        : 100;
    const rdpuSharePercent =
      positivePoolTotal > 0
        ? Math.round((100 - liquidSharePercent) * 10) / 10
        : 0;

    const periodDepositsByPeriod: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.amount <= 0) continue;
      const tag = extractPeriodTagFromLabel(tx.label);
      if (tag) {
        const key = `${tag.year}-${tag.month}`;
        periodDepositsByPeriod[key] =
          (periodDepositsByPeriod[key] ?? 0) + tx.amount;
      }
    }

    const untransferredLockedPeriods: UntransferredLockedPeriod[] = [];
    for (const s of scopedLockedSnapshots) {
      const actualSavings = s.actualSavings ?? 0;
      if (actualSavings <= 0) continue;

      const key = `${s.year}-${s.month}`;
      const transferredAmount = periodDepositsByPeriod[key] ?? 0;
      const untransferredAmount = Math.max(0, actualSavings - transferredAmount);

      if (untransferredAmount > 0) {
        untransferredLockedPeriods.push({
          month: s.month,
          year: s.year,
          actualSavings,
          transferredAmount,
          untransferredAmount,
          suggestedLabel: `P1 Savings Transfer (${s.month}/${s.year})`,
        });
      }
    }

    let monthlyLivingExpenseBaseline = 1_500_000;
    if (config) {
      monthlyLivingExpenseBaseline =
        config.dailyOperational < 500_000
          ? config.dailyOperational * 30
          : config.dailyOperational;
    }

    const runwayMonths =
      monthlyLivingExpenseBaseline > 0
        ? Math.round((balance / monthlyLivingExpenseBaseline) * 10) / 10
        : 0;

    // Hardcoded milestones removed per user requirement: all targets/milestones are user-defined.
    const milestones: SavingsMilestone[] = [];

    return {
      balance,
      liquidCashBalance,
      investmentRdpuBalance,
      liquidSharePercent,
      rdpuSharePercent,
      monthlyLivingExpenseBaseline,
      runwayMonths,
      milestones,
      transactions,
      periodDepositsByPeriod,
      untransferredLockedPeriods,
      overview,
    };
  }

  /**
   * Monthly Savings Accumulation & Reconciliation Overview
   * Bridges snapshots with vault deposits, master wealth target feasibility, and goal projections.
   */
  async getOverview(
    referenceDate: Date = new Date(),
    userId: number = 1,
  ): Promise<SavingsOverviewResult> {
    const [config, snapshots, transactions, goals, wishlistItems] =
      await Promise.all([
        this.prisma.globalConfig.findFirst({ where: { userId } }),
        this.prisma.monthlySnapshot.findMany({
          where: { userId },
          orderBy: [{ year: 'asc' }, { month: 'asc' }],
        }),
        this.prisma.savingsManualTransaction.findMany({
          where: { userId },
          orderBy: { date: 'asc' },
        }),
        this.prisma.savingsGoal.findMany({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.wishlistItem.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    const rawBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
    const studioConfig = resolveStudioConfig(userId, config?.formulaParamsJson, config);
    const epochYm =
      (studioConfig.paycycleFormulaConfig.ledgerEpochYear ?? 2026) * 12 +
      (studioConfig.paycycleFormulaConfig.ledgerEpochMonth ?? 10);
    const scopedSnapshots = snapshots.filter(
      (s) => s.year * 12 + s.month >= epochYm,
    );
    const hasP1Override =
      studioConfig.actualP1VaultBalanceRp !== null &&
      studioConfig.actualP1VaultBalanceRp !== undefined &&
      !Number.isNaN(Number(studioConfig.actualP1VaultBalanceRp));
    const balance = hasP1Override
      ? Math.max(0, Math.round(Number(studioConfig.actualP1VaultBalanceRp)))
      : rawBalance;
    const investmentRdpuBalanceRaw = transactions
      .filter((t) => t.instrumentType === 'INVESTMENT_RDPU')
      .reduce((sum, t) => sum + t.amount, 0);
    const liquidCashBalance = hasP1Override
      ? Math.max(0, balance - Math.max(0, investmentRdpuBalanceRaw))
      : transactions
          .filter((t) => (t.instrumentType ?? 'LIQUID_CASH') === 'LIQUID_CASH')
          .reduce((sum, t) => sum + t.amount, 0);
    const investmentRdpuBalance = investmentRdpuBalanceRaw;

    const positivePoolTotal =
      Math.max(0, liquidCashBalance) + Math.max(0, investmentRdpuBalance);
    const liquidSharePercent =
      positivePoolTotal > 0
        ? Math.round(
            (Math.max(0, liquidCashBalance) / positivePoolTotal) * 1000,
          ) / 10
        : 100;
    const rdpuSharePercent =
      positivePoolTotal > 0
        ? Math.round((100 - liquidSharePercent) * 10) / 10
        : 0;

    // Period attribution
    const periodDepositsByPeriod: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.amount <= 0) continue;
      const tag = extractPeriodTagFromLabel(tx.label);
      if (tag) {
        const key = `${tag.year}-${tag.month}`;
        periodDepositsByPeriod[key] =
          (periodDepositsByPeriod[key] ?? 0) + tx.amount;
      }
    }

    const accumulationLedger: SavingsPeriodLedgerItem[] = [];
    let totalPlanned2026P1 = 0;
    let totalActualIncome2026 = 0;
    let p1PositivePeriodsCount = 0;

    for (const s of scopedSnapshots) {
      const actualSavings = s.actualSavings ?? 0;
      const key = `${s.year}-${s.month}`;
      const depositedAmount = periodDepositsByPeriod[key] ?? 0;
      const pendingTransfer = Math.max(0, actualSavings - depositedAmount);

      if (s.year === 2026) {
        totalPlanned2026P1 += actualSavings;
        totalActualIncome2026 += s.finalTotalIncome ?? 0;
      }

      if (actualSavings > 0) {
        p1PositivePeriodsCount++;
      }

      accumulationLedger.push({
        month: s.month,
        year: s.year,
        status: s.status,
        monthlyTarget: s.savings,
        actualSavings,
        depositedAmount,
        pendingTransfer,
        isFullyDeposited: actualSavings > 0 && depositedAmount >= actualSavings,
      });
    }

    const avgMonthlySavingsP1 =
      p1PositivePeriodsCount > 0
        ? Math.round(totalPlanned2026P1 / p1PositivePeriodsCount)
        : totalPlanned2026P1 > 0
          ? Math.round(totalPlanned2026P1 / Math.max(1, scopedSnapshots.length))
          : 0;

    const averageMonthlySavingsRatePercent =
      totalActualIncome2026 > 0
        ? Math.round((totalPlanned2026P1 / totalActualIncome2026) * 1000) / 10
        : 0;

    // Temporal markers
    const refYear = referenceDate.getUTCFullYear();
    const refMonth = referenceDate.getUTCMonth() + 1;
    const curSerial = refYear * 12 + refMonth;

    // Enriched Goals Projection & Wishlist Linkage
    const enrichedGoals: EnrichedSavingsGoal[] = goals.map((g) => {
      const remainingNeeded = Math.max(0, g.targetAmount - g.currentAllocatedAmount);
      const targetSerial = g.targetYear * 12 + g.targetMonth;
      const monthsUntilTarget = Math.max(1, targetSerial - curSerial);
      const requiredMonthlyContribution =
        remainingNeeded > 0
          ? Math.round(remainingNeeded / monthsUntilTarget)
          : 0;
      const progressPercent =
        g.targetAmount > 0
          ? Math.min(100, Math.round((g.currentAllocatedAmount / g.targetAmount) * 100))
          : 100;
      const isReadyToBuy =
        g.currentAllocatedAmount >= g.targetAmount && g.targetAmount > 0;

      const linkedWishlist = g.wishlistItemId
        ? wishlistItems.find((w) => w.id === g.wishlistItemId)
        : null;

      const projectedMonthsAtPace =
        avgMonthlySavingsP1 > 0 && remainingNeeded > 0
          ? Math.ceil(remainingNeeded / avgMonthlySavingsP1)
          : remainingNeeded === 0
            ? 0
            : null;

      let projectedCompletionDate: string | null = null;
      if (projectedMonthsAtPace !== null) {
        const projSerial = curSerial + projectedMonthsAtPace;
        const pYear = Math.floor((projSerial - 1) / 12);
        const pMonth = ((projSerial - 1) % 12) + 1;
        projectedCompletionDate = `${pMonth}/${pYear}`;
      }

      return {
        ...g,
        progressPercent,
        remainingNeeded,
        monthsUntilTarget,
        requiredMonthlyContribution,
        projectedMonthsAtPace,
        projectedCompletionDate,
        isReadyToBuy,
        linkedWishlistItem: linkedWishlist
          ? {
              id: linkedWishlist.id,
              name: linkedWishlist.name,
              price: linkedWishlist.price,
              status: linkedWishlist.status,
            }
          : null,
      };
    });

    // Current period financial capacity for Master Wealth Feasibility Guard
    const activePeriodSnapshot =
      snapshots.find((s) => s.month === refMonth && s.year === refYear) ??
      snapshots[snapshots.length - 1];

    const currentPeriodNetIncome =
      activePeriodSnapshot?.finalTotalIncome ?? config?.baseSalary ?? 5_891_000;
    const routineBills =
      (activePeriodSnapshot?.transport ?? 0) +
      (activePeriodSnapshot?.internet ?? 0) +
      (activePeriodSnapshot?.vape ?? 0) +
      (activePeriodSnapshot?.haircut ?? 0);
    const dailyOp = activePeriodSnapshot?.dailyOperational ?? 0;
    const deductions = activePeriodSnapshot?.totalDeductions ?? 0;
    const maxMonthlySavableCapacity = Math.max(
      0,
      currentPeriodNetIncome - deductions - routineBills - dailyOp,
    );

    const configuredTargetWealth = config?.targetWealthAmount ?? 15_000_000;
    const configuredTargetMonth = config?.targetWealthMonth ?? 10;
    const configuredTargetYear = config?.targetWealthYear ?? (refYear + 1);
    const configuredTargetBase = config?.targetWealthBase ?? 'CONFIRMED_VAULT';

    const baseBalanceForPlan =
      configuredTargetBase === 'PLANNED_P1' ? totalPlanned2026P1 : balance;

    const wealthTargetPlan = calculateWealthTargetPlan({
      targetBalance: configuredTargetWealth,
      targetMonth: configuredTargetMonth,
      targetYear: configuredTargetYear,
      currentBaseBalance: baseBalanceForPlan,
      currentMonth: refMonth,
      currentYear: refYear,
      finalTotalIncome: currentPeriodNetIncome,
      avgMonthlySavingsP1,
      maxMonthlySavableCapacity,
    });

    const pockets = studioConfig.savingsPockets ?? [];
    const totalConfirmedSavingsRp = Math.max(0, Math.round(balance));
    const totalAllocatedRp = pockets.reduce((s, p) => s + Math.max(0, Math.round(p.allocatedRp || 0)), 0);

    return {
      kpi: {
        totalVaultBalance: balance,
        liquidCashBalance,
        investmentRdpuBalance,
        liquidSharePercent,
        rdpuSharePercent,
        totalPlanned2026P1,
        avgMonthlySavingsP1,
        averageMonthlySavingsRatePercent,
      },
      accumulationLedger,
      goals: enrichedGoals,
      wealthTargetPlan,
      wealthTargetConfig: {
        targetBalance: configuredTargetWealth,
        targetMonth: configuredTargetMonth,
        targetYear: configuredTargetYear,
        base: configuredTargetBase,
      },
      financialCapacity: {
        currentPeriodNetIncome,
        maxMonthlySavableCapacity,
        avgMonthlySavingsP1,
      },
      pocketsSummary: {
        totalConfirmedSavingsRp,
        totalAllocatedRp,
        unallocatedPoolRp: Math.max(0, totalConfirmedSavingsRp - totalAllocatedRp),
        pockets,
      },
    };
  }

  async getGoals(referenceDate?: Date, userId: number = 1): Promise<EnrichedSavingsGoal[]> {
    const overview = await this.getOverview(referenceDate, userId);
    return overview.goals;
  }
}
