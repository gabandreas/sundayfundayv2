import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SnapshotStatus } from '@prisma/client';
import {
  extractPeriodTagFromLabel,
  calculateWealthTargetPlan,
  WealthTargetPlanResult,
} from './savings.utils';
import { buildDefaultSandboxState } from '../config/sandbox.defaults';

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
    if (userId === 2) {
      const config = await this.prisma.globalConfig.findFirst({
        where: { userId },
      });
      const sandbox =
        (config?.sandboxStateJson as any) ||
        buildDefaultSandboxState(referenceMonth, referenceYear);
        const vault = sandbox.savingsVault ?? {
          balance: 25_000_000,
          liquidCashBalance: 15_000_000,
          investmentRdpuBalance: 10_000_000,
          liquidSharePercent: 60,
          rdpuSharePercent: 40,
        };

        const monthlyLivingExpenseBaseline =
          sandbox.persona?.dailyLivingBudget ?? 3_000_000;
        const runwayMonths =
          monthlyLivingExpenseBaseline > 0
            ? Math.round((vault.balance / monthlyLivingExpenseBaseline) * 10) / 10
            : 8.3;

        const transactions = [
          {
            id: 9001,
            date: new Date('2026-10-01T00:00:00.000Z'),
            label: 'Liquid Emergency Reserve Deposit',
            amount: 15_000_000,
            instrumentType: 'LIQUID_CASH',
            notes: 'Standard Edition Initial Liquid Reserve',
          },
          {
            id: 9002,
            date: new Date('2026-10-01T00:00:00.000Z'),
            label: 'Core Investment Fund Allocation',
            amount: 10_000_000,
            instrumentType: 'INVESTMENT_RDPU',
            notes: 'Standard Edition Initial Investment Allocation',
          },
        ];

        const periodDepositsByPeriod: Record<string, number> = {
          '2026-10': sandbox.persona?.coreSavingsTarget ?? 1_500_000,
        };

        const overview = await this.getOverview(new Date(), userId);

        return {
          balance: vault.balance,
          liquidCashBalance: vault.liquidCashBalance,
          investmentRdpuBalance: vault.investmentRdpuBalance,
          liquidSharePercent: vault.liquidSharePercent,
          rdpuSharePercent: vault.rdpuSharePercent,
          monthlyLivingExpenseBaseline,
          runwayMonths,
          milestones: [],
          transactions,
          periodDepositsByPeriod,
          untransferredLockedPeriods: [],
          overview,
        };
      }

    const [config, transactions, lockedSnapshots, overview] = await Promise.all([
      (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
        (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } })),
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

    const balance = transactions.reduce((sum, t) => sum + t.amount, 0);
    const liquidCashBalance = transactions
      .filter((t) => (t.instrumentType ?? 'LIQUID_CASH') === 'LIQUID_CASH')
      .reduce((sum, t) => sum + t.amount, 0);
    const investmentRdpuBalance = transactions
      .filter((t) => t.instrumentType === 'INVESTMENT_RDPU')
      .reduce((sum, t) => sum + t.amount, 0);

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
    for (const s of lockedSnapshots) {
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

    let monthlyLivingExpenseBaseline = 2_850_000;
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
    if (userId === 2) {
      const config = await this.prisma.globalConfig.findFirst({
        where: { userId },
      });
      const sandbox =
        (config?.sandboxStateJson as any) || buildDefaultSandboxState();
        const vault = sandbox.savingsVault ?? {
          balance: 25_000_000,
          liquidCashBalance: 15_000_000,
          investmentRdpuBalance: 10_000_000,
          liquidSharePercent: 60,
          rdpuSharePercent: 40,
        };
        const p1Target = sandbox.persona?.coreSavingsTarget ?? 1_500_000;
        const netSalary = sandbox.persona?.netSalary ?? 10_000_000;

        const accumulationLedger: SavingsPeriodLedgerItem[] = [
          {
            month: 10,
            year: 2026,
            status: SnapshotStatus.DRAFT,
            monthlyTarget: p1Target,
            actualSavings: p1Target,
            depositedAmount: p1Target,
            pendingTransfer: 0,
            isFullyDeposited: true,
          },
        ];

        const goals: EnrichedSavingsGoal[] = [
          {
            id: 901,
            name: 'Emergency Fund Buffer',
            targetAmount: 30_000_000,
            currentAllocatedAmount: 25_000_000,
            targetMonth: 12,
            targetYear: 2026,
            category: 'EMERGENCY_FUND',
            isCompleted: false,
            isReadyToBuy: false,
            linkedWishlistItem: null,
            createdAt: new Date('2026-10-01T00:00:00.000Z'),
            updatedAt: new Date('2026-10-01T00:00:00.000Z'),
            progressPercent: 83,
            remainingNeeded: 5_000_000,
            monthsUntilTarget: 2,
            requiredMonthlyContribution: 2_500_000,
            projectedMonthsAtPace: 4,
            projectedCompletionDate: '2/2027',
          },
        ];

        return {
          kpi: {
            totalVaultBalance: vault.balance,
            liquidCashBalance: vault.liquidCashBalance,
            investmentRdpuBalance: vault.investmentRdpuBalance,
            liquidSharePercent: vault.liquidSharePercent,
            rdpuSharePercent: vault.rdpuSharePercent,
            totalPlanned2026P1: p1Target,
            avgMonthlySavingsP1: p1Target,
            averageMonthlySavingsRatePercent:
              Math.round((p1Target / netSalary) * 1000) / 10,
          },
          accumulationLedger,
          goals,
          wealthTargetConfig: {
            targetBalance: 50_000_000,
            targetMonth: 12,
            targetYear: 2027,
            base: 'CUSTOM',
          },
          financialCapacity: {
            currentPeriodNetIncome: netSalary,
            maxMonthlySavableCapacity: 3_500_000,
            avgMonthlySavingsP1: p1Target,
          },
        };
      }

    const [config, snapshots, transactions, goals, wishlistItems] =
      await Promise.all([
        (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
          (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } })),
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

    const balance = transactions.reduce((sum, t) => sum + t.amount, 0);
    const liquidCashBalance = transactions
      .filter((t) => (t.instrumentType ?? 'LIQUID_CASH') === 'LIQUID_CASH')
      .reduce((sum, t) => sum + t.amount, 0);
    const investmentRdpuBalance = transactions
      .filter((t) => t.instrumentType === 'INVESTMENT_RDPU')
      .reduce((sum, t) => sum + t.amount, 0);

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

    for (const s of snapshots) {
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
          ? Math.round(totalPlanned2026P1 / Math.max(1, snapshots.length))
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
    };
  }

  async getGoals(referenceDate?: Date, userId: number = 1): Promise<EnrichedSavingsGoal[]> {
    const overview = await this.getOverview(referenceDate, userId);
    return overview.goals;
  }
}
