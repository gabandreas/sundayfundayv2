import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SnapshotStatus } from '@prisma/client';

describe('Reports & Cash Reconciliation Integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.budgetRevision.deleteMany({});
    await prisma.transaction.deleteMany({});
    await prisma.monthlyBulkBill.deleteMany({});
    await prisma.creditCardTransaction.deleteMany({});
    await prisma.creditContract.deleteMany({});
    await prisma.savingsManualTransaction.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.monthlySnapshot.deleteMany({});
    await app.close();
  });

  beforeEach(async () => {
    await prisma.budgetRevision.deleteMany({});
    await prisma.transaction.deleteMany({});
    await prisma.monthlyBulkBill.deleteMany({});
    await prisma.creditCardTransaction.deleteMany({});
    await prisma.creditContract.deleteMany({});
    await prisma.savingsManualTransaction.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.monthlySnapshot.deleteMany({});
    await prisma.globalConfig.deleteMany({});

    await prisma.globalConfig.create({
      data: {
        baseSalary: 5000000,
        dailyAllowance: 40000,
        laptopAllowance: 250000,
        dailyOperational: 1000000,
        transport: 250000,
        internet: 150000,
        vape: 260000,
        haircut: 100000,
        baseSavings: 1000000,
        creditLimit: 7000000,
        payrollPayoutDay: 25,
      },
    });
  });

  it('GET /api/reports returns all 4 statement sections with exact payroll fields and never creates a snapshot for uninitialized months', async () => {
    // 1. Query uninitialized month 6/2027 -> must not create a MonthlySnapshot row
    const uninitRes = await request(app.getHttpServer())
      .get('/api/reports?month=6&year=2027&scope=all')
      .expect(200);

    expect(uninitRes.body.closingStatement.status).toBe('UNINITIALIZED');
    expect(uninitRes.body.closingStatement.workingDaysWindowLabel).toBe(
      '16 May 2027 – 15 Jun 2027',
    );
    expect(uninitRes.body.closingStatement.payroll.baseSalary).toBe(5000000);
    expect(uninitRes.body.closingStatement.payroll.bpjsDeduction).toBe(150000);
    expect(uninitRes.body.closingStatement.payroll.laptopAllowance).toBe(250000);
    expect(uninitRes.body.closingStatement.payroll.totalWorkingDays).toBe(18);
    expect(uninitRes.body.closingStatement.payroll.dailyAllowance).toBe(40000);
    expect(uninitRes.body.closingStatement.payroll.totalDailyAllowance).toBe(
      720000,
    );
    expect(uninitRes.body.closingStatement.payroll.finalTotalIncome).toBe(
      5820000,
    );
    expect(uninitRes.body.closingStatement.moneyCycle.kpis.totalMoneyIn).toBe(
      5820000,
    );

    const persistedAfterRead = await prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId: 1, month: 6, year: 2027 } },
    });
    expect(persistedAfterRead).toBeNull();

    // 2. Initialize 10/2026, add a budget revision, and verify 3-column allocationDiffRows
    const snapRes = await request(app.getHttpServer())
      .get('/api/snapshots?month=10&year=2026')
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/snapshots/${snapRes.body.id}/budget-revision`)
      .send({
        category: 'SAVINGS',
        newValue: 800000,
        reason: 'Rebalance target for October obligations',
      })
      .expect(201);

    const reportRes = await request(app.getHttpServer())
      .get('/api/reports?month=10&year=2026&scope=all')
      .expect(200);

    const savingsDiff =
      reportRes.body.closingStatement.upfrontAndWaterfall.allocationDiffRows.find(
        (r: { categoryKey: string }) => r.categoryKey === 'SAVINGS',
      );
    expect(savingsDiff.baselineTarget).toBe(1000000);
    expect(savingsDiff.revisedTarget).toBe(800000);
    expect(savingsDiff.revisionDelta).toBe(-200000);
    expect(savingsDiff.revisionCount).toBe(1);
    expect(savingsDiff.actualOutcome).toBe(800000);
    expect(reportRes.body.dossier.revisions).toHaveLength(1);
  });

  it('POST /api/finance/reconcile-balance/preview & /reconcile-balance handle shortfall, deficit trap warning, bi-directional surplus, and LOCKED rejection', async () => {
    const snapRes = await request(app.getHttpServer())
      .get('/api/snapshots?month=10&year=2026')
      .expect(200);
    const snapshotId = snapRes.body.id;

    // Log Rp 200,000 manual expense so remainingBudget = Rp 800,000
    await request(app.getHttpServer())
      .post('/api/finance/transactions')
      .send({
        month: 10,
        year: 2026,
        type: 'DEDUCTION',
        label: 'Groceries',
        amount: 200000,
        date: '2026-10-10',
      })
      .expect(201);

    // 1. Preview shortfall (actualRealBalance = Rp 650,000 -> -Rp 150,000 variance)
    const previewShortfall = await request(app.getHttpServer())
      .post('/api/finance/reconcile-balance/preview')
      .send({
        month: 10,
        year: 2026,
        actualRealBalance: 650000,
      })
      .expect(201);

    expect(previewShortfall.body.systemRemainingBudget).toBe(800000);
    expect(previewShortfall.body.varianceAmount).toBe(-150000);
    expect(previewShortfall.body.resolvedActionType).toBe(
      'RECORD_DEDUCTION_ADJUSTMENT',
    );
    expect(previewShortfall.body.projected.remainingBudget).toBe(650000);

    // Verify preview did not write a transaction
    const txsBefore = await prisma.transaction.findMany({
      where: { snapshotId },
    });
    expect(txsBefore).toHaveLength(1);

    // 2. Execute shortfall reconciliation
    const execShortfall = await request(app.getHttpServer())
      .post('/api/finance/reconcile-balance')
      .send({
        month: 10,
        year: 2026,
        actualRealBalance: 650000,
        note: 'Unrecorded cash coffee & parking',
      })
      .expect(201);

    expect(execShortfall.body.appliedActionType).toBe(
      'RECORD_DEDUCTION_ADJUSTMENT',
    );
    expect(execShortfall.body.transaction.amount).toBe(150000);

    // Now systemRemainingBudget is 650,000. Test SURPLUS Mode A (INCREASE_OPERATIONAL_TARGET -> 750,000)
    const execSurplusOp = await request(app.getHttpServer())
      .post('/api/finance/reconcile-balance')
      .send({
        month: 10,
        year: 2026,
        actualRealBalance: 750000,
        surplusResolutionMode: 'INCREASE_OPERATIONAL_TARGET',
        note: 'Split bill reimbursement',
      })
      .expect(201);

    expect(execSurplusOp.body.appliedActionType).toBe(
      'REVISE_OPERATIONAL_TARGET',
    );
    expect(execSurplusOp.body.snapshot.dailyOperational).toBe(1100000);

    // Test SURPLUS Mode B (RECORD_INCOME_ADJUSTMENT -> 800,000)
    const execSurplusInc = await request(app.getHttpServer())
      .post('/api/finance/reconcile-balance')
      .send({
        month: 10,
        year: 2026,
        actualRealBalance: 800000,
        surplusResolutionMode: 'RECORD_INCOME_ADJUSTMENT',
        note: 'Bank cashback',
      })
      .expect(201);

    expect(execSurplusInc.body.appliedActionType).toBe(
      'RECORD_INCOME_ADJUSTMENT',
    );
    expect(execSurplusInc.body.transaction.type).toBe('INCOME');
    expect(execSurplusInc.body.transaction.amount).toBe(50000);

    // 3. Lock the snapshot and verify reconciliation is rejected with 400
    await prisma.monthlySnapshot.update({
      where: { id: snapshotId },
      data: { status: SnapshotStatus.LOCKED },
    });

    await request(app.getHttpServer())
      .post('/api/finance/reconcile-balance')
      .send({
        month: 10,
        year: 2026,
        actualRealBalance: 500000,
      })
      .expect(400);
  });

  it('Fixed Essentials realization avoids double-counting until pool is exceeded, Operational Refund restores operational budget without inflating income, and Global Search returns cross-period matches', async () => {
    await request(app.getHttpServer())
      .get('/api/snapshots?month=10&year=2026')
      .expect(200);

    // 1. Log Rp 200,000 Transport expense (Transport pool is Rp 250,000) -> 0 overage, 0 daily spent
    await request(app.getHttpServer())
      .post('/api/finance/transactions')
      .send({
        month: 10,
        year: 2026,
        type: 'DEDUCTION',
        label: 'Shell V-Power Fuel',
        amount: 200000,
        date: '2026-10-05',
        fixedEssentialCategory: 'TRANSPORT',
      })
      .expect(201);

    const pacingAfterPoolCovered = await request(app.getHttpServer())
      .get('/api/finance/pacing?month=10&year=2026')
      .expect(200);

    expect(pacingAfterPoolCovered.body.totalDailySpent).toBe(0);
    expect(pacingAfterPoolCovered.body.remainingBudget).toBe(1000000);
    expect(
      pacingAfterPoolCovered.body.fixedEssentialsRealization.totalSpent,
    ).toBe(200000);
    expect(
      pacingAfterPoolCovered.body.fixedEssentialsRealization.totalOverage,
    ).toBe(0);

    // 2. Log another Rp 90,000 Transport expense -> total Rp 290,000 vs Rp 250,000 pool -> Rp 40,000 overage
    await request(app.getHttpServer())
      .post('/api/finance/transactions')
      .send({
        month: 10,
        year: 2026,
        type: 'DEDUCTION',
        label: 'Toll & Grab Overflow',
        amount: 90000,
        date: '2026-10-12',
        fixedEssentialCategory: 'TRANSPORT',
      })
      .expect(201);

    // 3. Log Rp 300,000 normal operational spend + Rp 100,000 operational refund (patungan)
    await request(app.getHttpServer())
      .post('/api/finance/transactions')
      .send({
        month: 10,
        year: 2026,
        type: 'DEDUCTION',
        label: 'Team Dinner Split',
        amount: 300000,
        date: '2026-10-14',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/finance/transactions')
      .send({
        month: 10,
        year: 2026,
        type: 'INCOME',
        label: 'Patungan Reimbursement',
        amount: 100000,
        date: '2026-10-15',
        isOperationalRefund: true,
      })
      .expect(201);

    const pacingAfterRefund = await request(app.getHttpServer())
      .get('/api/finance/pacing?month=10&year=2026')
      .expect(200);

    // Net daily spent = 300,000 (manual) + 40,000 (transport overage) - 100,000 (refund) = 240,000
    expect(pacingAfterRefund.body.totalDailySpent).toBe(240000);
    expect(pacingAfterRefund.body.remainingBudget).toBe(760000);
    expect(pacingAfterRefund.body.operationalRefundsTotal).toBe(100000);

    // Verify payroll extraIncome was NOT inflated by the operational refund
    const payrollRes = await request(app.getHttpServer())
      .get('/api/finance/payroll?month=10&year=2026')
      .expect(200);
    expect(payrollRes.body.extraIncome).toBe(0);

    // 4. Verify Global Cross-Period Search (GET /api/finance/search)
    const searchRes = await request(app.getHttpServer())
      .get('/api/finance/search?q=Patungan')
      .expect(200);
    expect(searchRes.body.totalMatches).toBe(1);
    expect(searchRes.body.items[0].sourceType).toBe('OPERATIONAL_REFUND');
  });

  it('RECURRING credit card endedAtMonth/endedAtYear stops future billing and INSTALLMENT settle-early accelerates remaining principal', async () => {
    // 1. Create a RECURRING charge starting 9/2026 and ending 10/2026
    const recRes = await request(app.getHttpServer())
      .post('/api/credit/cards')
      .send({
        label: 'Netflix Premium',
        amount: 186000,
        chargeType: 'RECURRING',
        category: 'SUBSCRIPTION',
        transactionDate: '2026-08-25',
        billingMonth: 9,
        billingYear: 2026,
        endedAtMonth: 10,
        endedAtYear: 2026,
      })
      .expect(201);

    expect(recRes.body.endedAtMonth).toBe(10);
    expect(recRes.body.endedAtYear).toBe(2026);

    // 2. Create a 6-month INSTALLMENT charge starting 10/2026 (Rp 1,200,000 total, Rp 200,000/mo)
    const instRes = await request(app.getHttpServer())
      .post('/api/credit/cards')
      .send({
        label: 'Monitor 4K',
        amount: 1200000,
        chargeType: 'INSTALLMENT',
        category: 'ELECTRONICS',
        tenor: 6,
        monthlyAmount: 200000,
        transactionDate: '2026-09-25',
        billingMonth: 10,
        billingYear: 2026,
      })
      .expect(201);

    // Check 11/2026 card list -> Netflix should be Rp 0 (ended 10/2026), Monitor should be slice "2/6"
    const cardsNovBefore = await request(app.getHttpServer())
      .get('/api/credit/cards?contextMonth=11&contextYear=2026')
      .expect(200);

    const netflixNov = cardsNovBefore.body.find(
      (c: { id: number }) => c.id === recRes.body.id,
    );
    const monitorNov = cardsNovBefore.body.find(
      (c: { id: number }) => c.id === instRes.body.id,
    );
    expect(netflixNov.dueInPeriod).toBe(0);
    expect(monitorNov.dueInPeriod).toBe(200000);
    expect(monitorNov.installmentProgress.badgeLabel).toBe('2/6');
    expect(
      monitorNov.installmentProgress.remainingPrincipalIncludingTarget,
    ).toBe(1000000);

    // 3. Settle Monitor early in 11/2026 with LUMP_SUM_CURRENT_PERIOD (accelerates Rp 1,000,000 into 11/2026 and zeroes 12/2026+)
    const settleRes = await request(app.getHttpServer())
      .post(`/api/credit/cards/${instRes.body.id}/settle-early`)
      .send({
        month: 11,
        year: 2026,
        mode: 'LUMP_SUM_CURRENT_PERIOD',
      })
      .expect(201);

    expect(settleRes.body.card.status).toBe('SETTLED');
    expect(settleRes.body.lumpSumMaterialized).toBe(1000000);

    // Verify 11/2026 due is Rp 1,000,000 and 12/2026 due is Rp 0
    const matrixRes = await request(app.getHttpServer())
      .get('/api/credit/matrix?startMonth=10&startYear=2026')
      .expect(200);

    expect(matrixRes.body.totalsPerMonth['2026-10']).toBe(386000); // 186k Netflix + 200k Monitor
    expect(matrixRes.body.totalsPerMonth['2026-11']).toBe(1000000); // 0 Netflix + 1,000k Lump Sum Monitor
    expect(matrixRes.body.totalsPerMonth['2026-12']).toBe(0); // Both ended/settled
  });

  it('Savings Vault rebalance, 3-Month Forward Liquidity Forecast, and Full ERP Backup & Restore operate atomically', async () => {
    // 1. Deposit Rp 3,000,000 into LIQUID_CASH and rebalance Rp 1,200,000 into INVESTMENT_RDPU
    await request(app.getHttpServer())
      .post('/api/savings')
      .send({
        type: 'TOPUP',
        instrumentType: 'LIQUID_CASH',
        amount: 3000000,
        label: 'Initial Emergency Reserve',
        date: '2026-10-01T00:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/savings/rebalance')
      .send({
        fromInstrument: 'LIQUID_CASH',
        toInstrument: 'INVESTMENT_RDPU',
        amount: 1200000,
        note: 'Allocate to Bibit RDPU',
      })
      .expect(201);

    const vaultRes = await request(app.getHttpServer())
      .get('/api/savings?month=10&year=2026')
      .expect(200);

    expect(vaultRes.body.balance).toBe(3000000);
    expect(vaultRes.body.liquidCashBalance).toBe(1800000);
    expect(vaultRes.body.investmentRdpuBalance).toBe(1200000);
    expect(vaultRes.body.liquidSharePercent).toBe(60);
    expect(vaultRes.body.rdpuSharePercent).toBe(40);

    // 2. Verify 3-Month Forward Liquidity Forecast (GET /api/reports/forecast)
    const forecastRes = await request(app.getHttpServer())
      .get('/api/reports/forecast?month=10&year=2026')
      .expect(200);

    expect(forecastRes.body.horizonMonths).toBe(3);
    expect(forecastRes.body.months).toHaveLength(3);
    expect(forecastRes.body.months[0].periodLabel).toBe('Nov 2026');

    // 3. Export Full ERP Backup and Restore atomically
    const backupRes = await request(app.getHttpServer())
      .get('/api/config/backup')
      .expect(200);

    expect(backupRes.body.schemaVersion).toBe('2.0');
    expect(backupRes.body.counts.savingsManualTransactions).toBe(3);

    // Wipe savings transactions, then restore from backup
    await prisma.savingsManualTransaction.deleteMany({});
    const restoreRes = await request(app.getHttpServer())
      .post('/api/config/restore')
      .send({
        confirmPhrase: 'RESTORE_ALL_DATA',
        backup: backupRes.body,
      })
      .expect(201);

    expect(restoreRes.body.success).toBe(true);
    expect(restoreRes.body.restoredCounts.savingsManualTransactions).toBe(3);
  });
});
