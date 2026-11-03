import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditSelectors } from '../audit/audit.selectors';
import {
  calculateAnalytics,
  AnalyticsReportResult,
  AnalyticsScope,
  AnalyticsSnapshotInput,
} from '../calculator/analytics';

@Injectable()
export class AnalyticsSelectors {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditSelectors: AuditSelectors,
  ) {}

  /**
   * Read-only multi-period analytics aggregation.
   * Uses AuditSelectors.listHistoricalSnapshots() as the single authoritative source of non-phantom periods,
   * then delegates all math to calculator/analytics.ts.
   */
  async getAnalyticsReport(
    scope: AnalyticsScope = 'all',
  ): Promise<AnalyticsReportResult> {
    const normalizedScope: AnalyticsScope =
      scope === 'locked' ? 'locked' : 'all';

    const [allNonPhantomSnapshots, savingsTransactions] = await Promise.all([
      this.auditSelectors.listHistoricalSnapshots(),
      this.prisma.savingsManualTransaction.findMany({
        orderBy: { date: 'asc' },
      }),
    ]);

    const totalAvailableSnapshotsCount = allNonPhantomSnapshots.length;
    const lockedSnapshotsCount = allNonPhantomSnapshots.filter(
      (s) => s.status === 'LOCKED',
    ).length;

    const filteredSnapshots =
      normalizedScope === 'locked'
        ? allNonPhantomSnapshots.filter((s) => s.status === 'LOCKED')
        : allNonPhantomSnapshots;

    const snapshotInputs: AnalyticsSnapshotInput[] = filteredSnapshots.map(
      (s) => ({
        month: s.month,
        year: s.year,
        status: s.status,
        finalTotalIncome: s.finalTotalIncome ?? 0,
        totalDeductions: s.totalDeductions ?? 0,
        actualDailyOperational: s.actualDailyOperational ?? 0,
        dailyOperationalTarget: s.dailyOperational ?? 0,
        transport: s.transport ?? 0,
        internet: s.internet ?? 0,
        vape: s.vape ?? 0,
        haircut: s.haircut ?? 0,
        savingsTarget: s.savings ?? 0,
        actualSavings: s.actualSavings ?? 0,
        selfReward: s.selfReward ?? 0,
        bufferPocket: s.bufferPocket ?? 0,
        deficitUncovered: s.deficitUncovered ?? 0,
        survivalPocket: s.survivalPocket ?? 0,
        transactions: (s.transactions ?? []).map((t) => ({
          type: t.type,
          sourceType: t.sourceType,
          label: t.label,
          amount: t.amount,
        })),
      }),
    );

    return calculateAnalytics({
      snapshots: snapshotInputs,
      savingsTransactions: savingsTransactions.map((tx) => ({
        amount: tx.amount,
        label: tx.label,
        date: tx.date,
      })),
      scope: normalizedScope,
      totalAvailableSnapshotsCount,
      lockedSnapshotsCount,
    });
  }
}
