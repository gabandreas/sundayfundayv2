import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SnapshotStatus, TransactionType, TransactionSourceType } from '@prisma/client';

async function cleanDatabase(prisma: PrismaService) {
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.creditCardTransaction.deleteMany();
  await prisma.monthlyBulkBill.deleteMany();
  await prisma.creditContract.deleteMany();
  await prisma.savingsManualTransaction.deleteMany();
  await prisma.budgetRevision.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.monthlySnapshot.deleteMany();
}

describe('Analytics E2E & Integration (GET /api/analytics)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('returns empty analytics report when no snapshots exist', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/analytics')
      .expect(200);

    expect(res.body.periodCount).toBe(0);
    expect(res.body.kpis.averageMonthlyIncome).toBe(0);
    expect(res.body.kpis.aggregateSavingsRate).toBe(0);
    expect(res.body.cashflowSeries).toHaveLength(0);
  });

  it('excludes phantom DRAFT snapshots, supports scope=all vs scope=locked, and enforces 100% category conservation', async () => {
    // 1. Create LOCKED snapshot (7/2026) with both CREDIT_BILL and manual DEDUCTION
    const jul = await prisma.monthlySnapshot.create({
      data: {
        month: 7,
        year: 2026,
        status: SnapshotStatus.LOCKED,
        totalWorkingDays: 23,
        finalTotalIncome: 5_891_000,
        totalDeductions: 2_524_000,
        dailyOperational: 2_850_000,
        actualDailyOperational: 2_850_000,
        transport: 100_000,
        internet: 150_000,
        vape: 150_000,
        haircut: 50_000,
        savings: 0,
        actualSavings: 0,
        selfRewardTarget: 0,
        selfReward: 67_000,
        bufferPocket: 0,
        deficitUncovered: 0,
        survivalPocket: 3_300_000,
      },
    });

    await prisma.transaction.createMany({
      data: [
        {
          snapshotId: jul.id,
          type: TransactionType.CREDIT_BILL,
          sourceType: TransactionSourceType.BULK_BILL,
          label: 'PayLater Bill (7/2026)',
          amount: 2_400_000,
          date: new Date('2026-07-05T00:00:00Z'),
        },
        {
          snapshotId: jul.id,
          type: TransactionType.DEDUCTION,
          sourceType: TransactionSourceType.MANUAL,
          label: 'Office Lunch',
          amount: 124_000,
          date: new Date('2026-07-10T00:00:00Z'),
        },
      ],
    });

    // 2. Create genuine DRAFT snapshot (9/2026) with working days + transactions
    const sep = await prisma.monthlySnapshot.create({
      data: {
        month: 9,
        year: 2026,
        status: SnapshotStatus.DRAFT,
        totalWorkingDays: 21,
        finalTotalIncome: 5_891_000,
        totalDeductions: 4_057_637,
        dailyOperational: 991_000,
        actualDailyOperational: 991_000,
        transport: 100_000,
        internet: 139_000,
        vape: 100_000,
        haircut: 50_000,
        savings: 909_000,
        actualSavings: 453_363,
        selfRewardTarget: 0,
        selfReward: 0,
        bufferPocket: 0,
        deficitUncovered: 0,
        survivalPocket: 1_380_000,
      },
    });

    await prisma.transaction.createMany({
      data: [
        {
          snapshotId: sep.id,
          type: TransactionType.CREDIT_BILL,
          sourceType: TransactionSourceType.BULK_BILL,
          label: 'PayLater Bill (9/2026)',
          amount: 2_662_073,
          date: new Date('2026-09-05T00:00:00Z'),
        },
        {
          snapshotId: sep.id,
          type: TransactionType.CREDIT_BILL,
          sourceType: TransactionSourceType.PERSONAL_DEBT,
          label: 'Personal Debt (9/2026)',
          amount: 200_000,
          date: new Date('2026-09-05T00:00:00Z'),
        },
        {
          snapshotId: sep.id,
          type: TransactionType.CREDIT_BILL,
          sourceType: TransactionSourceType.CC_TRANSACTION,
          label: 'CC Bill (9/2026)',
          amount: 720_564,
          date: new Date('2026-09-11T00:00:00Z'),
        },
        {
          snapshotId: sep.id,
          type: TransactionType.DEDUCTION,
          sourceType: TransactionSourceType.MANUAL,
          label: 'Medical Expense',
          amount: 475_000,
          date: new Date('2026-09-15T00:00:00Z'),
        },
      ],
    });

    // 3. Create untouched phantom DRAFT snapshot (1/2028) — must be excluded!
    await prisma.monthlySnapshot.create({
      data: {
        month: 1,
        year: 2028,
        status: SnapshotStatus.DRAFT,
        totalWorkingDays: 0,
        finalTotalIncome: 5_449_000,
        totalDeductions: 0,
        dailyOperational: 2_850_000,
        actualDailyOperational: 2_850_000,
        transport: 150_000,
        internet: 285_000,
        vape: 150_000,
        haircut: 50_000,
        savings: 1_000_000,
        actualSavings: 1_000_000,
        selfReward: 964_000,
        bufferPocket: 0,
        deficitUncovered: 0,
        survivalPocket: 3_485_000,
      },
    });

    // 4. Create Vault top-up transaction
    await prisma.savingsManualTransaction.create({
      data: {
        amount: 500_000,
        label: 'Initial Vault Deposit',
        date: new Date('2026-08-01T00:00:00Z'),
      },
    });

    // Query scope=all
    const allRes = await request(app.getHttpServer())
      .get('/api/analytics?scope=all')
      .expect(200);

    expect(allRes.body.scope).toBe('all');
    expect(allRes.body.periodCount).toBe(2); // 7/2026 and 9/2026 only; phantom 1/2028 excluded
    expect(allRes.body.lockedCount).toBe(1);
    expect(allRes.body.draftCount).toBe(1);
    expect(allRes.body.kpis.cumulativeVaultInflow).toBe(500_000);

    const totalCategorySum = allRes.body.categoryDistribution.reduce(
      (sum: number, c: { totalAmount: number }) => sum + c.totalAmount,
      0,
    );
    expect(totalCategorySum).toBe(allRes.body.kpis.totalIncomeAcrossPeriods);
    expect(totalCategorySum).toBe(5_891_000 + 5_891_000);

    // Query scope=locked
    const lockedRes = await request(app.getHttpServer())
      .get('/api/analytics?scope=locked')
      .expect(200);

    expect(lockedRes.body.scope).toBe('locked');
    expect(lockedRes.body.periodCount).toBe(1); // Only 7/2026
    expect(lockedRes.body.totalAvailableSnapshotsCount).toBe(2);
    expect(lockedRes.body.lockedSnapshotsCount).toBe(1);
    expect(lockedRes.body.cashflowSeries[0].periodLabel).toBe('Jul 2026');
  });
});
