import 'reflect-metadata';
import * as assert from 'node:assert/strict';

const NEON_URL =
  process.env.NEON_DATABASE_URL ||
  'postgresql://neondb_owner:npg_kLTO3alGm2RE@ep-nameless-bird-b30zfam7-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30';

process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = NEON_URL;

const USER_ID = 1;

const STAGE2_PAYDAY_MAP: Record<string, string> = {
  '1/2027': '2026-12-28',
  '2/2027': '2027-01-27',
  '3/2027': '2027-02-26',
  '4/2027': '2027-03-29',
  '5/2027': '2027-04-27',
  '6/2027': '2027-05-27',
  '7/2027': '2027-06-25',
  '8/2027': '2027-07-26',
  '9/2027': '2027-08-26',
};

async function main() {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../apps/api/dist/src/app.module');
  const { PrismaService } = await import('../apps/api/dist/src/prisma/prisma.service');
  const { SnapshotsService } = await import('../apps/api/dist/src/snapshots/snapshots.service');
  const { SnapshotsSelectors } = await import('../apps/api/dist/src/snapshots/snapshots.selectors');
  const { buildDefaultAllocationBuckets } = await import('../apps/api/dist/src/calculator/modular-engine');
  const { buildDefaultStudioConfig } = await import('../apps/api/dist/src/config/studio.defaults');
  const { SnapshotStatus } = await import('../apps/api/node_modules/@prisma/client');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  try {
    const prisma = app.get(PrismaService);
    const snapshotsService = app.get(SnapshotsService);
    const snapshotsSelectors = app.get(SnapshotsSelectors);

    const cfg = await prisma.globalConfig.findUniqueOrThrow({
      where: { userId: USER_ID },
    });

    console.log('=== BEFORE REPAIR (GlobalConfig userId=1) ===');
    console.log({
      dailyOperational: cfg.dailyOperational,
      transport: cfg.transport,
      internet: cfg.internet,
      vape: cfg.vape,
      haircut: cfg.haircut,
      creditStatementDay: cfg.creditStatementDay,
      creditDueDay: cfg.creditDueDay,
      payrollPayoutDay: cfg.payrollPayoutDay,
    });

    const newAllocBuckets = buildDefaultAllocationBuckets({
      transport: 300000,
      internet: 0,
      vape: 150000,
      haircut: 85000,
      dailyOperational: 1500000,
      savings: cfg.baseSavings,
      bufferPocket: 0,
    });

    const existingFormulaParams = (cfg.formulaParamsJson as any) || {};
    const defaultStudio = buildDefaultStudioConfig(USER_ID, {
      payrollPayoutDay: 27,
      baseSavings: cfg.baseSavings,
      dailyOperational: 1500000,
      transport: 300000,
      internet: 0,
      vape: 150000,
      haircut: 85000,
      creditLimit: cfg.creditLimit,
      creditStatementDay: 25,
      creditDueDay: 11,
      paylaterUsageLimit: cfg.paylaterUsageLimit,
      ccUsageLimit: cfg.ccUsageLimit,
    });

    const curStudio = existingFormulaParams.studioConfig || {};
    const mergedStudio = {
      ...defaultStudio,
      ...curStudio,
      paycycleFormulaConfig: {
        ...defaultStudio.paycycleFormulaConfig,
        ...(curStudio.paycycleFormulaConfig || {}),
        paydayAnchorDay: 27,
        defaultDailyFoodBaselineRp: 1500000,
        periodOverrides: {
          ...defaultStudio.paycycleFormulaConfig.periodOverrides,
        },
      },
      instrumentsTable: defaultStudio.instrumentsTable.map((defInst: any) => {
        const existingInst = Array.isArray(curStudio.instrumentsTable)
          ? curStudio.instrumentsTable.find((i: any) => i?.id === defInst.id)
          : null;
        return existingInst
          ? {
              ...existingInst,
              name: defInst.name,
              cutoffDay: defInst.cutoffDay,
              dueDay: defInst.dueDay,
            }
          : defInst;
      }),
    };

    const nextFormulaParams = {
      ...existingFormulaParams,
      studioConfig: mergedStudio,
    };

    // Preserve financialPolicyJson (SMTP encrypted credentials + Marquee AI config)
    await prisma.globalConfig.update({
      where: { userId: USER_ID },
      data: {
        dailyOperational: 1500000,
        transport: 300000,
        internet: 0,
        vape: 150000,
        haircut: 85000,
        creditStatementDay: 25,
        creditDueDay: 11,
        payrollPayoutDay: 27,
        allocationBucketsJson: newAllocBuckets as any,
        formulaParamsJson: nextFormulaParams as any,
      },
    });
    console.log('Updated GlobalConfig (dailyOperational=1500000, creditStatementDay=25, routine=535000, studioConfig overrides synced).');

    // Clean any stale 2.85M DAILY_OPERATIONAL revision in 2027 and align allocationBuckets + payday dates on 01/2027..08/2027
    const existing2027 = await prisma.monthlySnapshot.findMany({
      where: { userId: USER_ID, year: 2027, month: { gte: 1, lte: 8 } },
      include: { budgetRevisions: true },
      orderBy: { month: 'asc' },
    });

    for (const s of existing2027) {
      assert.equal(s.status, SnapshotStatus.DRAFT, `${s.month}/${s.year} must remain DRAFT`);
      for (const r of s.budgetRevisions) {
        if (
          (r.category === 'DAILY_OPERATIONAL' || r.bucketKey?.toLowerCase() === 'daily_operational') &&
          Math.round(r.newValue) === 2850000
        ) {
          await prisma.budgetRevision.delete({ where: { id: r.id } });
          console.log(`Removed stale 2,850,000 revision #${r.id} on ${s.month}/${s.year}`);
        }
      }
      const paydayIso = STAGE2_PAYDAY_MAP[`${s.month}/${s.year}`];
      const curFrozen: any = (s.frozenRulesJson as any) || {};
      await prisma.monthlySnapshot.update({
        where: { id: s.id },
        data: {
          dailyOperational: 1500000,
          transport: 300000,
          internet: 0,
          vape: 150000,
          haircut: 85000,
          payrollPayoutDate: new Date(`${paydayIso}T00:00:00.000Z`),
          isPayoutDateConfirmed: true,
          frozenRulesJson: {
            ...curFrozen,
            allocationBuckets: newAllocBuckets,
          } as any,
        },
      });
    }

    // Provision 09/2027 cleanly via authoritative SnapshotsSelectors
    const sep27 = await snapshotsSelectors.getOrCreateDraftSnapshot(9, 2027, USER_ID);
    await prisma.monthlySnapshot.update({
      where: { id: sep27.id },
      data: {
        payrollPayoutDate: new Date(`${STAGE2_PAYDAY_MAP['9/2027']}T00:00:00.000Z`),
        isPayoutDateConfirmed: true,
      },
    });

    // Recalculate 01/2027..09/2027 using authoritative SnapshotsService.recalculateSnapshot
    const all2027 = await prisma.monthlySnapshot.findMany({
      where: { userId: USER_ID, year: 2027, month: { gte: 1, lte: 9 } },
      orderBy: { month: 'asc' },
    });

    for (const s of all2027) {
      const updated = await snapshotsService.recalculateSnapshot(s.id, undefined, USER_ID);
      console.log(
        `Repaired ${String(updated.month).padStart(2, '0')}/${updated.year}: wd=${updated.totalWorkingDays} | payday=${new Date(updated.payrollPayoutDate!).toISOString().slice(0, 10)} | income=${updated.finalTotalIncome} | debt=${updated.totalDeductions} | dailyOps=${updated.dailyOperational} | actualDailyOps=${updated.actualDailyOperational} | P1=${updated.actualSavings} | P2=${updated.selfReward} | deficit=${updated.deficitUncovered}`,
      );
    }

    // Assert 11/2026 & 12/2026 remain untouched
    const nov26 = await prisma.monthlySnapshot.findUniqueOrThrow({
      where: { userId_month_year: { userId: USER_ID, month: 11, year: 2026 } },
    });
    const dec26 = await prisma.monthlySnapshot.findUniqueOrThrow({
      where: { userId_month_year: { userId: USER_ID, month: 12, year: 2026 } },
    });
    assert.equal(Math.round(nov26.finalTotalIncome), 5891000);
    assert.equal(Math.round(nov26.totalDeductions), 4522976);
    assert.equal(Math.round(nov26.actualDailyOperational), 1720316);
    assert.equal(Math.round(nov26.actualSavings), 6341);
    assert.equal(Math.round(nov26.selfReward), 250000);
    assert.equal(Math.round(nov26.deficitUncovered), 0);

    assert.equal(Math.round(dec26.finalTotalIncome), 5904000);
    assert.equal(Math.round(dec26.totalDeductions), 4187341);
    assert.equal(Math.round(dec26.actualDailyOperational), 1416659);
    assert.equal(Math.round(dec26.actualSavings), 0);
    assert.equal(Math.round(dec26.deficitUncovered), 83341);
    console.log('Verified 11/2026 and 12/2026 remain 100% untouched.');
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
