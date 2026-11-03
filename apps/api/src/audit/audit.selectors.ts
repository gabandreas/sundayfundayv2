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
  async listHistoricalSnapshots(): Promise<HistoricalSnapshotWithRelations[]> {
    const snapshots = await this.prisma.monthlySnapshot.findMany({
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
      include: { transactions: true, budgetRevisions: true },
    });

    return snapshots.filter((s) => {
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
  async listSavingsWithdrawals(): Promise<SavingsManualTransaction[]> {
    return this.prisma.savingsManualTransaction.findMany({
      where: {
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
  ): Promise<MonthlyBulkBill[]> {
    return this.prisma.monthlyBulkBill.findMany({
      where: {
        ...(month !== undefined ? { month } : {}),
        ...(year !== undefined ? { year } : {}),
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
  }

  async getGlobalConfig() {
    return this.prisma.globalConfig.findFirst();
  }

  /**
   * Paginated read of AuditLog entries, optionally filtered by period (month, year), category, and severity.
   */
  async listAuditLogs(query?: QueryAuditLogDto): Promise<PaginatedAuditLogs> {
    const page = query?.page && query.page > 0 ? query.page : 1;
    const limit = query?.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

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
