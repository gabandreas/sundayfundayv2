import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SnapshotsSelectors } from '../snapshots/snapshots.selectors';
import {
  Transaction,
  TransactionType,
  TransactionSourceType,
} from '@prisma/client';
import { calculatePayroll, sumExtraIncome, PayrollResult } from '../calculator/payroll';
import {
  calculateDailyPacing,
  PacingResult,
  normalizeDate,
  getPaydayCycleWindow,
} from '../calculator/pacing';
import {
  calculateCashReconciliation,
  CashReconciliationPreview,
  SurplusResolutionMode,
} from '../calculator/reconciliation';
import {
  calculateFixedEssentialsRealization,
  calculateOperationalDailySpent,
  FixedEssentialsRealizationSummary,
  sumOperationalRefunds,
} from '../calculator/waterfall';
import { buildDefaultSandboxState } from '../config/sandbox.defaults';

export type EnrichedPacingResult = PacingResult & {
  fixedEssentialsRealization: FixedEssentialsRealizationSummary;
  operationalRefundsTotal: number;
};

@Injectable()
export class FinanceSelectors {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotsSelectors: SnapshotsSelectors,
  ) {}

  async listTransactions(
    month: number,
    year: number,
    userId: number = 1,
  ): Promise<Transaction[]> {
    if (userId === 2) {
      const config = await this.prisma.globalConfig.findFirst({
        where: { userId },
      });
      const sandbox =
        (config?.sandboxStateJson as any) ||
        buildDefaultSandboxState(month, year);
      return (sandbox.transactions || []).map((t: any) => ({
        ...t,
        snapshotId: 999999,
        createdAt: new Date().toISOString(),
      }));
    }

    const snapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });

    if (!snapshot) {
      return [];
    }

    return this.prisma.transaction.findMany({
      where: { snapshotId: snapshot.id },
      orderBy: { date: 'asc' },
    });
  }

  async getPayroll(
    month: number,
    year: number,
    userId: number = 1,
  ): Promise<PayrollResult> {
    if (userId === 2) {
      const config = await this.prisma.globalConfig.findFirst({
        where: { userId },
      });
      const sandbox =
        (config?.sandboxStateJson as any) ||
        buildDefaultSandboxState(month, year);
      const salary = sandbox.persona?.netSalary ?? 10_000_000;
      return {
        baseSalary: salary,
        salaryAdjustment: 0,
        adjustedBaseSalary: salary,
        totalWorkingDays: 21,
        dailyAllowance: 0,
        totalDailyAllowance: 0,
        laptopAllowance: 0,
        cafeteriaDeduction: 0,
        bpjsDeduction: 0,
        netBasePayroll: salary,
        netSalaryIncome: salary,
        thrAmount: 0,
        bonusAmount: 0,
        extraIncome: 0,
        finalTotalIncome: salary,
      };
    }

    const config =
      (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } }));

    let snapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });

    if (!snapshot) {
      snapshot = await this.snapshotsSelectors.getOrCreateDraftSnapshot(
        month,
        year,
        userId,
      );
    }

    if (!snapshot) {
      throw new NotFoundException(`Snapshot for ${month}/${year} not found`);
    }

    if (!config) {
      throw new NotFoundException('Global configuration not found');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: { snapshotId: snapshot.id },
    });

    const extraIncome = sumExtraIncome(transactions);

    return calculatePayroll({
      baseSalary: config.baseSalary,
      salaryAdjustment: snapshot.salaryAdjustment,
      totalWorkingDays: snapshot.totalWorkingDays,
      dailyAllowance: config.dailyAllowance,
      cafeteriaDeduction: snapshot.cafeteriaDeduction,
      thrAmount: snapshot.thrAmount,
      bonusAmount: snapshot.bonusAmount,
      extraIncome,
      laptopAllowance: config.laptopAllowance,
    });
  }

  async getPacing(
    month: number,
    year: number,
    referenceDate?: Date,
    weekendMultiplier?: number,
    userId: number = 1,
  ): Promise<EnrichedPacingResult> {
    if (userId === 2) {
      const config = await this.prisma.globalConfig.findFirst({
        where: { userId },
      });
      const sandbox =
        (config?.sandboxStateJson as any) ||
        buildDefaultSandboxState(month, year);
        const snap = this.snapshotsSelectors.buildSandboxSnapshot(
          sandbox,
          month,
          year,
        );
        const defaultPayoutDay = sandbox.persona?.paydayAnchor ?? 25;
        const cycleWindow = getPaydayCycleWindow(
          month,
          year,
          snap.payrollPayoutDate,
          null,
          defaultPayoutDay,
        );
        const transactions = snap.transactions;
        const fixedTargets = {
          transport: snap.transport,
          internet: snap.internet,
          vape: snap.vape,
          haircut: snap.haircut,
        };
        const totalDailySpent = calculateOperationalDailySpent(
          transactions,
          fixedTargets,
        );
        const pacing = calculateDailyPacing({
          periodMonth: month,
          periodYear: year,
          cycleStartDate: cycleWindow.cycleStartDate,
          cycleEndDate: cycleWindow.cycleEndDate,
          isEndDateConfirmed: false,
          actualDailyOperational: snap.actualDailyOperational,
          dailyOperationalTarget: snap.dailyOperational,
          totalDailySpent,
          referenceDate,
          weekendMultiplier,
        });
        const fixedEssentialsRealization = calculateFixedEssentialsRealization(
          transactions,
          fixedTargets,
        );
        return {
          ...pacing,
          fixedEssentialsRealization,
          operationalRefundsTotal: 0,
        };
      }

    const config =
      (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } }));

    let snapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });

    if (!snapshot) {
      snapshot = await this.snapshotsSelectors.getOrCreateDraftSnapshot(
        month,
        year,
        userId,
      );
    }

    if (!snapshot) {
      throw new NotFoundException(`Snapshot for ${month}/${year} not found`);
    }

    const defaultPayoutDay = config?.payrollPayoutDay ?? 25;

    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;

    const nextSnapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month: nextMonth, year: nextYear } },
    });

    const cycleWindow = getPaydayCycleWindow(
      month,
      year,
      snapshot.payrollPayoutDate,
      nextSnapshot?.isPayoutDateConfirmed ? nextSnapshot.payrollPayoutDate : null,
      defaultPayoutDay,
    );
    const { cycleStartDate, cycleEndDate, isEndDateConfirmed } = cycleWindow;

    const transactions = await this.prisma.transaction.findMany({
      where: { snapshotId: snapshot.id },
    });

    const fixedTargets = {
      transport: snapshot.transport,
      internet: snapshot.internet,
      vape: snapshot.vape,
      haircut: snapshot.haircut,
    };

    const fixedEssentialsRealization = calculateFixedEssentialsRealization(
      transactions,
      fixedTargets,
    );
    const operationalRefundsTotal = sumOperationalRefunds(transactions);
    const totalDailySpent = calculateOperationalDailySpent(
      transactions,
      fixedTargets,
    );

    const actualDailyOperational =
      snapshot.actualDailyOperational ?? snapshot.dailyOperational;

    const pacing = calculateDailyPacing({
      periodMonth: month,
      periodYear: year,
      cycleStartDate,
      cycleEndDate,
      isEndDateConfirmed,
      actualDailyOperational,
      dailyOperationalTarget: snapshot.dailyOperational,
      totalDailySpent,
      referenceDate,
      weekendMultiplier,
    });

    return {
      ...pacing,
      fixedEssentialsRealization,
      operationalRefundsTotal,
    };
  }

  /**
   * Read-only simulation of Cash Balance Reconciliation ("Cash Opname").
   * Never creates or modifies database rows.
   */
  async previewCashReconciliation(params: {
    month: number;
    year: number;
    actualRealBalance: number;
    surplusResolutionMode?: SurplusResolutionMode;
    referenceDate?: Date;
    includesUnspentRoutinePool?: boolean;
    userId?: number;
  }): Promise<CashReconciliationPreview & { snapshotStatus: 'DRAFT' | 'LOCKED' | 'UNINITIALIZED' }> {
    const {
      month,
      year,
      actualRealBalance,
      surplusResolutionMode,
      referenceDate,
      includesUnspentRoutinePool,
      userId = 1,
    } = params;

    const config =
      (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } }));
    if (!config) {
      throw new NotFoundException('Global configuration not found');
    }

    const snapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });

    const defaultPayoutDay = config.payrollPayoutDay ?? 25;
    const cycleStartDate =
      snapshot?.payrollPayoutDate ??
      new Date(Date.UTC(year, month - 1, defaultPayoutDay));

    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextSnapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month: nextMonth, year: nextYear } },
    });

    const startNorm = normalizeDate(cycleStartDate);
    const startTs = Date.UTC(startNorm.year, startNorm.month - 1, startNorm.day);

    let nextPayoutDate: Date;
    let isEndDateConfirmed = false;

    if (
      nextSnapshot &&
      nextSnapshot.isPayoutDateConfirmed &&
      nextSnapshot.payrollPayoutDate
    ) {
      const nextNorm = normalizeDate(nextSnapshot.payrollPayoutDate);
      const candidateTs = Date.UTC(nextNorm.year, nextNorm.month - 1, nextNorm.day);
      if (candidateTs > startTs) {
        nextPayoutDate = nextSnapshot.payrollPayoutDate;
        isEndDateConfirmed = true;
      } else {
        nextPayoutDate = new Date(Date.UTC(nextYear, nextMonth - 1, defaultPayoutDay));
      }
    } else {
      nextPayoutDate = new Date(Date.UTC(nextYear, nextMonth - 1, defaultPayoutDay));
    }

    const nextNorm = normalizeDate(nextPayoutDate);
    let nextTs = Date.UTC(nextNorm.year, nextNorm.month - 1, nextNorm.day);
    if (nextTs <= startTs) {
      nextTs = startTs + 30 * 86400000;
    }
    const cycleEndDate = new Date(nextTs - 86400000);

    const transactions = snapshot
      ? await this.prisma.transaction.findMany({
          where: { snapshotId: snapshot.id },
        })
      : [];

    const preview = calculateCashReconciliation({
      periodMonth: month,
      periodYear: year,
      actualRealBalance,
      surplusResolutionMode,
      includesUnspentRoutinePool,
      baseSalary: config.baseSalary,
      salaryAdjustment: snapshot?.salaryAdjustment ?? 0,
      totalWorkingDays: snapshot?.totalWorkingDays ?? 21,
      dailyAllowance: config.dailyAllowance,
      cafeteriaDeduction: snapshot?.cafeteriaDeduction ?? 0,
      thrAmount: snapshot?.thrAmount ?? 0,
      bonusAmount: snapshot?.bonusAmount ?? 0,
      laptopAllowance: config.laptopAllowance,
      savingsTarget: snapshot?.savings ?? config.baseSavings,
      selfRewardTarget: snapshot?.selfRewardTarget ?? 0,
      dailyOperationalTarget:
        snapshot?.dailyOperational ?? config.dailyOperational,
      transportTarget: snapshot?.transport ?? config.transport,
      internetTarget: snapshot?.internet ?? config.internet,
      vapeTarget: snapshot?.vape ?? config.vape,
      haircutTarget: snapshot?.haircut ?? config.haircut,
      bufferPocketTarget: snapshot?.bufferPocket ?? 0,
      transactions,
      cycleStartDate,
      cycleEndDate,
      isEndDateConfirmed,
      referenceDate,
    });

    return {
      ...preview,
      snapshotStatus: snapshot
        ? (snapshot.status as 'DRAFT' | 'LOCKED')
        : 'UNINITIALIZED',
    };
  }

  /**
   * Cross-period Global Ledger Search (`Ctrl+K`).
   * Strictly read-only: searches across all historical and active snapshots.
   */
  async searchTransactions(params: {
    q?: string;
    type?: string;
    sourceType?: string;
    fixedEssentialCategory?: string;
    limit?: number;
    userId?: number;
  }) {
    const q = (params.q ?? '').trim();
    const limit = Math.min(Math.max(1, params.limit ?? 50), 200);
    const qLower = q.toLowerCase();
    const numericCandidate = Number(q.replace(/[^0-9]/g, ''));
    const hasNumericQuery =
      q.replace(/[^0-9]/g, '').length >= 3 && !Number.isNaN(numericCandidate);

    const userId = params.userId || 1;
    if (userId === 2) {
      const config = await this.prisma.globalConfig.findFirst({
        where: { userId },
      });
      const sandbox =
        (config?.sandboxStateJson as any) || buildDefaultSandboxState();
      let txs = (sandbox.transactions || []).map((t: any) => ({
        ...t,
        snapshotId: 999999,
        snapshot: {
          id: 999999,
          month: sandbox.month,
          year: sandbox.year,
          status: 'DRAFT',
        },
      }));
      if (params.type) txs = txs.filter((t: any) => t.type === params.type);
      if (params.sourceType)
        txs = txs.filter((t: any) => t.sourceType === params.sourceType);
      if (q) {
        txs = txs.filter((t: any) => t.label.toLowerCase().includes(qLower));
      }
      return txs.slice(0, limit);
    }

    const allRows = await this.prisma.transaction.findMany({
      where: {
        snapshot: {
          userId,
        },
      },
      include: {
        snapshot: {
          select: {
            id: true,
            month: true,
            year: true,
            status: true,
          },
        },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });

    const filtered = allRows.filter((row) => {
      if (params.type && row.type !== params.type) {
        return false;
      }
      if (params.sourceType && row.sourceType !== params.sourceType) {
        return false;
      }
      if (
        params.fixedEssentialCategory &&
        row.fixedEssentialCategory !== params.fixedEssentialCategory
      ) {
        return false;
      }
      if (!q) {
        return true;
      }

      const labelMatch = row.label.toLowerCase().includes(qLower);
      const sourceMatch = row.sourceType.toLowerCase().includes(qLower);
      const typeMatch = row.type.toLowerCase().includes(qLower);
      const fixedMatch = (row.fixedEssentialCategory ?? '')
        .toLowerCase()
        .includes(qLower);
      const periodMatch = `${row.snapshot.month}/${row.snapshot.year}`.includes(
        qLower,
      );
      const amountMatch =
        hasNumericQuery &&
        (Math.round(row.amount) === numericCandidate ||
          String(Math.round(row.amount)).includes(q.replace(/[^0-9]/g, '')));

      return (
        labelMatch ||
        sourceMatch ||
        typeMatch ||
        fixedMatch ||
        periodMatch ||
        amountMatch
      );
    });

    const totalDeductionsMatched = filtered
      .filter((r) => r.type === TransactionType.DEDUCTION || r.type === TransactionType.CREDIT_BILL)
      .reduce((s, r) => s + r.amount, 0);
    const totalIncomeMatched = filtered
      .filter((r) => r.type === TransactionType.INCOME)
      .reduce((s, r) => s + r.amount, 0);

    return {
      query: q,
      totalMatches: filtered.length,
      totalDeductionsMatched,
      totalIncomeMatched,
      items: filtered.slice(0, limit).map((r) => ({
        id: r.id,
        snapshotId: r.snapshotId,
        month: r.snapshot.month,
        year: r.snapshot.year,
        snapshotStatus: r.snapshot.status,
        type: r.type,
        sourceType: r.sourceType,
        fixedEssentialCategory: r.fixedEssentialCategory,
        label: r.label,
        amount: r.amount,
        date: r.date.toISOString(),
      })),
    };
  }
}
