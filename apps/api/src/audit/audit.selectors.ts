import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MonthlySnapshot,
  SavingsManualTransaction,
  MonthlyBulkBill,
  AuditLog,
  Transaction,
  BudgetRevision,
  Prisma,
} from '@prisma/client';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { resolveStudioConfig } from '../config/studio.defaults';

export type HistoricalSnapshotWithRelations = MonthlySnapshot & {
  transactions: Transaction[];
  budgetRevisions: BudgetRevision[];
};

export interface PaginatedAuditLogs {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AuditSelectors {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves all MonthlySnapshot records ordered chronologically (year asc, month asc).
   * Both LOCKED and DRAFT snapshots are included, since discipline evaluation evaluates all existing historical data.
   */
  async listHistoricalSnapshots(
    userId: number = 1,
  ): Promise<HistoricalSnapshotWithRelations[]> {
    const [config, snapshots] = await Promise.all([
      this.prisma.globalConfig.findFirst({ where: { userId } }),
      this.prisma.monthlySnapshot.findMany({
        where: { userId },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
        include: { transactions: true, budgetRevisions: true },
      }),
    ]);

    const studioConfig = resolveStudioConfig(userId, config?.formulaParamsJson, config);
    const epochYm =
      (studioConfig.paycycleFormulaConfig.ledgerEpochYear ?? 2026) * 12 +
      (studioConfig.paycycleFormulaConfig.ledgerEpochMonth ?? 10);

    return snapshots.filter((s) => {
      if (s.year * 12 + s.month < epochYm) return false;
      if (s.status === 'LOCKED') return true;
      const hasInputs =
        s.totalWorkingDays > 0 ||
        s.salaryAdjustment !== 0 ||
        s.cafeteriaDeduction > 0 ||
        s.thrAmount > 0 ||
        s.bonusAmount > 0 ||
        s.isPayoutDateConfirmed;
      const hasTransactions = s.transactions && s.transactions.length > 0;
      const hasRevisions = s.budgetRevisions && s.budgetRevisions.length > 0;
      return hasInputs || hasTransactions || hasRevisions;
    });
  }

  /**
   * Retrieves all savings withdrawals (SavingsManualTransaction where amount < 0) ordered by date asc.
   */
  async listSavingsWithdrawals(
    userId: number = 1,
  ): Promise<SavingsManualTransaction[]> {
    return this.prisma.savingsManualTransaction.findMany({
      where: {
        userId,
        amount: { lt: 0 },
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Retrieves MonthlyBulkBill records (which represent PayLater and informal personal debt),
   * optionally filtered by month and year.
   */
  async listBulkBills(
    month?: number,
    year?: number,
    userId: number = 1,
  ): Promise<MonthlyBulkBill[]> {
    return this.prisma.monthlyBulkBill.findMany({
      where: {
        userId,
        ...(month !== undefined ? { month } : {}),
        ...(year !== undefined ? { year } : {}),
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
  }

  async getGlobalConfig(userId: number = 1) {
    return this.prisma.globalConfig.findFirst({
      where: { userId },
    });
  }

  /**
   * Paginated read of AuditLog entries, optionally filtered by period (month, year), category, and severity.
   */
  async listAuditLogs(
    query?: QueryAuditLogDto,
    userId: number = 1,
  ): Promise<PaginatedAuditLogs> {
    const page = query?.page && query.page > 0 ? query.page : 1;
    const limit = query?.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = { userId };

    if (query?.month !== undefined) {
      where.month = query.month;
    }
    if (query?.year !== undefined) {
      where.year = query.year;
    }
    if (query?.category !== undefined) {
      where.category = query.category;
    }
    if (query?.severity !== undefined) {
      where.severity = query.severity;
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
