/**
 * audit.integration.spec.ts
 *
 * Integration tests for the audit domain module:
 * 1. Scorecard generation (read path): getSummary and getFullReport produce matching discipline scores (regression guard against V1 Bug #4).
 * 2. Event journal logging (retrofit): verifies all 5 retrofitted domain services write corresponding AuditLog entries with correct categories and severities.
 * 3. Log query and pagination: verifies selectors list audit logs with period and category filtering.
 *
 * Sequential execution via maxWorkers: 1.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { SnapshotsModule } from '../src/snapshots/snapshots.module';
import { SnapshotsService } from '../src/snapshots/snapshots.service';
import { SnapshotsSelectors } from '../src/snapshots/snapshots.selectors';
import { FinanceModule } from '../src/finance/finance.module';
import { FinanceService } from '../src/finance/finance.service';
import { CreditModule } from '../src/credit/credit.module';
import { CreditService } from '../src/credit/credit.service';
import { SavingsModule } from '../src/savings/savings.module';
import { SavingsService } from '../src/savings/savings.service';
import { SavingsTransactionType } from '../src/savings/dto/create-savings-transaction.dto';
import { ConfigModule } from '../src/config/config.module';
import { ConfigService } from '../src/config/config.service';
import { AuditModule } from '../src/audit/audit.module';
import { AuditService } from '../src/audit/audit.service';
import { AuditSelectors } from '../src/audit/audit.selectors';
import {
  AuditCategory,
  AuditSeverity,
  SnapshotStatus,
  TransactionType,
} from '@prisma/client';

async function cleanAll(prisma: PrismaService) {
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.creditCardTransaction.deleteMany();
  await prisma.monthlyBulkBill.deleteMany();
  await prisma.creditContract.deleteMany();
  await prisma.savingsManualTransaction.deleteMany();
  await prisma.budgetRevision.deleteMany();
  await prisma.monthlySnapshot.deleteMany();
  await prisma.globalConfig.upsert({
    where: { userId: 1 },
    update: {
      baseSalary: 10_000_000,
      dailyAllowance: 50_000,
      laptopAllowance: 250_000,
      dailyOperational: 100_000,
      transport: 200_000,
      internet: 150_000,
      vape: 100_000,
      haircut: 50_000,
      baseSavings: 500_000,
      creditLimit: 7_000_000,
      creditStatementDay: 20,
      creditDueDay: 11,
      ccUsageLimit: 0,
      paylaterUsageLimit: 0,
    },
    create: {
      id: 1,
      baseSalary: 10_000_000,
      dailyAllowance: 50_000,
      laptopAllowance: 250_000,
      dailyOperational: 100_000,
      transport: 200_000,
      internet: 150_000,
      vape: 100_000,
      haircut: 50_000,
      baseSavings: 500_000,
      creditLimit: 7_000_000,
      creditStatementDay: 20,
      creditDueDay: 11,
      ccUsageLimit: 0,
      paylaterUsageLimit: 0,
    },
  });
}

describe('Audit — integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let auditService: AuditService;
  let auditSelectors: AuditSelectors;
  let financeService: FinanceService;
  let creditService: CreditService;
  let savingsService: SavingsService;
  let configService: ConfigService;
  let snapshotsService: SnapshotsService;
  let snapshotsSelectors: SnapshotsSelectors;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        PrismaModule,
        SnapshotsModule,
        FinanceModule,
        CreditModule,
        SavingsModule,
        ConfigModule,
        AuditModule,
      ],
    }).compile();

    prisma = module.get(PrismaService);
    auditService = module.get(AuditService);
    auditSelectors = module.get(AuditSelectors);
    financeService = module.get(FinanceService);
    creditService = module.get(CreditService);
    savingsService = module.get(SavingsService);
    configService = module.get(ConfigService);
    snapshotsService = module.get(SnapshotsService);
    snapshotsSelectors = module.get(SnapshotsSelectors);

    await cleanAll(prisma);
  });

  afterAll(async () => {
    await cleanAll(prisma);
    await module.close();
  });

  afterEach(async () => {
    await cleanAll(prisma);
  });

  // ---------------------------------------------------------------------------
  // PART A — Scorecard Generation & Parity Guard (V1 Bug #4 regression check)
  // ---------------------------------------------------------------------------
  describe('PART A: Scorecard generation & formula parity guard', () => {
    it('getSummary and getFullReport produce the exact same discipline score and health status for identical data', async () => {
      // Seed 3 historical snapshots:
      // Month 7/2026: Healthy
      await prisma.monthlySnapshot.create({
        data: {
          month: 7,
          year: 2026,
          status: SnapshotStatus.LOCKED,
          totalWorkingDays: 20,
          finalTotalIncome: 10_000_000,
          dailyOperational: 3_000_000,
          actualDailyOperational: 3_000_000,
          selfRewardTarget: 500_000,
          selfReward: 500_000,
          savings: 1_000_000,
          actualSavings: 1_000_000,
          totalDeductions: 2_000_000,
          deficitUncovered: 0,
        },
      });

      // Month 8/2026: Tight living budget & missed savings
      await prisma.monthlySnapshot.create({
        data: {
          month: 8,
          year: 2026,
          status: SnapshotStatus.LOCKED,
          totalWorkingDays: 20,
          finalTotalIncome: 10_000_000,
          dailyOperational: 3_000_000,
          actualDailyOperational: 1_800_000, // tight (< 3M, but >= 1M)
          selfRewardTarget: 500_000,
          selfReward: 500_000,
          savings: 1_000_000,
          actualSavings: 500_000, // missed
          totalDeductions: 3_000_000,
          deficitUncovered: 0,
        },
      });

      // Month 9/2026: High debt ratio & zero reward streak
      await prisma.monthlySnapshot.create({
        data: {
          month: 9,
          year: 2026,
          status: SnapshotStatus.DRAFT,
          totalWorkingDays: 20,
          finalTotalIncome: 10_000_000,
          dailyOperational: 3_000_000,
          actualDailyOperational: 800_000, // critical (< 1M)
          selfRewardTarget: 500_000,
          selfReward: 0, // zero reward
          savings: 1_000_000,
          actualSavings: 0,
          totalDeductions: 5_000_000, // 50% debt ratio (> 35% is heavy)
          deficitUncovered: 500_000, // cash deficit
        },
      });

      // Also seed a savings withdrawal (drawdown red flag)
      await prisma.savingsManualTransaction.create({
        data: {
          label: 'Emergency Car Repair',
          amount: -1_500_000,
          date: new Date('2026-08-20'),
        },
      });

      const summary = await auditService.getSummary();
      const report = await auditService.getFullReport();

      // Regression guard: both must agree on the discipline score down to the integer
      expect(summary.disciplineScore).toBe(report.healthScorecard.disciplineScore);
      expect(summary.healthStatus).toBe(report.healthScorecard.healthStatus);
      expect(summary.totalGreenFlags).toBe(report.healthScorecard.totalGreenFlags);
      expect(summary.totalRedFlags).toBe(report.healthScorecard.totalRedFlags);
      expect(summary.totalChecks).toBe(report.healthScorecard.totalChecks);

      // Report must contain all 4 detailed multi-month tab audits
      expect(report.operationalAudit).toHaveLength(3);
      expect(report.selfRewardAudit).toHaveLength(3);
      expect(report.debtBurdenAudit).toHaveLength(3);
      expect(report.savingsAudit).toHaveLength(3);

      // Check operational audit statuses
      expect(report.operationalAudit[0].status).toBe('HEALTHY');
      expect(report.operationalAudit[1].status).toBe('TIGHT');
      expect(report.operationalAudit[2].status).toBe('CRITICAL');

      // Check debt burden ratio
      expect(report.debtBurdenAudit[2].debtRatio).toBe(50);
      expect(report.debtBurdenAudit[2].isHeavyBurden).toBe(true);

      // Total checks should match green + red
      expect(summary.totalChecks).toBe(summary.totalGreenFlags + summary.totalRedFlags);
      expect(summary.disciplineScore).toBe(
        Math.round((summary.totalGreenFlags / summary.totalChecks) * 100),
      );
    });

    it('listHistoricalSnapshots includes both DRAFT (non-phantom) and LOCKED snapshots ordered chronologically, while excluding phantom DRAFT snapshots', async () => {
      await prisma.monthlySnapshot.createMany({
        data: [
          { month: 11, year: 2026, status: SnapshotStatus.DRAFT, totalWorkingDays: 20 },
          { month: 8, year: 2026, status: SnapshotStatus.LOCKED, totalWorkingDays: 0 },
          { month: 3, year: 2027, status: SnapshotStatus.DRAFT, totalWorkingDays: 21 },
          { month: 9, year: 2026, status: SnapshotStatus.DRAFT, totalWorkingDays: 20 },
          // Phantom DRAFT snapshot: all-default inputs, 0 transactions, 0 budget revisions
          { month: 1, year: 2028, status: SnapshotStatus.DRAFT, totalWorkingDays: 0 },
        ],
      });

      const snapshots = await auditSelectors.listHistoricalSnapshots();
      expect(snapshots).toHaveLength(4);
      expect(snapshots.map((s) => `${s.month}/${s.year}`)).toEqual([
        '8/2026',
        '9/2026',
        '11/2026',
        '3/2027',
      ]);
    });

    it('correctness: MonthlyBulkBill with personalDebtAmount > 0 evaluates Informal Pre-Payroll Debt dimension as RED, while paylaterAmount > 0 with personalDebtAmount === 0 is NOT flagged as INFORMAL_DEBT', async () => {
      // Snapshot 9/2026 with informal personal debt
      await prisma.monthlySnapshot.create({
        data: {
          month: 9,
          year: 2026,
          status: SnapshotStatus.DRAFT,
          totalWorkingDays: 20,
          finalTotalIncome: 10_000_000,
          dailyOperational: 3_000_000,
          actualDailyOperational: 3_000_000,
          selfRewardTarget: 500_000,
          selfReward: 500_000,
          savings: 1_000_000,
          actualSavings: 1_000_000,
          totalDeductions: 1_250_000,
          deficitUncovered: 0,
        },
      });

      // Seed MonthlyBulkBill representing informal pre-payroll personal debt
      await prisma.monthlyBulkBill.create({
        data: {
          label: 'Personal Borrowing (Bridge Loan)',
          paylaterAmount: 0,
          personalDebtAmount: 1_250_000,
          amount: 1_250_000,
          month: 9,
          year: 2026,
        },
      });

      // Snapshot 10/2026 with PayLater bill ONLY (personalDebtAmount === 0)
      await prisma.monthlySnapshot.create({
        data: {
          month: 10,
          year: 2026,
          status: SnapshotStatus.DRAFT,
          totalWorkingDays: 20,
          finalTotalIncome: 10_000_000,
          dailyOperational: 3_000_000,
          actualDailyOperational: 3_000_000,
          selfRewardTarget: 500_000,
          selfReward: 500_000,
          savings: 1_000_000,
          actualSavings: 1_000_000,
          totalDeductions: 2_400_000,
          deficitUncovered: 0,
        },
      });

      await prisma.monthlyBulkBill.create({
        data: {
          label: 'Monthly Bulk Bill',
          paylaterAmount: 2_400_000,
          personalDebtAmount: 0,
          amount: 2_400_000,
          month: 10,
          year: 2026,
        },
      });

      const report = await auditService.getFullReport();
      const summary = await auditService.getSummary();

      // Find informal debt flags
      const informalFlags = report.flags.filter(
        (f) => f.category === 'INFORMAL_DEBT',
      );

      // Must haveerde exactly 1 red flag for period 9/2026 (where personalDebtAmount > 0)
      expect(informalFlags).toHaveLength(1);
      expect(informalFlags[0].type).toBe('RED');
      expect(informalFlags[0].month).toBe(9);
      expect(informalFlags[0].year).toBe(2026);
      expect(informalFlags[0].amount).toBe(1_250_000);
      expect(informalFlags[0].title).toBe('Pre-Payroll Borrowing Recorded (9/2026)');

      // Month 10/2026 (paylaterAmount = 2.4M, personalDebtAmount = 0) must NOT have an INFORMAL_DEBT flag
      const month10Informal = informalFlags.find(
        (f) => f.month === 10 && f.year === 2026,
      );
      expect(month10Informal).toBeUndefined();

      // Summary must also include this RED flag
      const summaryInformal = summary.flags.find(
        (f) => f.category === 'INFORMAL_DEBT',
      );
      expect(summaryInformal).toBeDefined();
      expect(summaryInformal?.type).toBe('RED');
      expect(summary.totalRedFlags).toBeGreaterThanOrEqual(1);
    });

    it('correctness: Debt Burden dimension classifies debt ratio correctly from stored snapshot totalDeductions', async () => {
      // Period 5/2026: Heavy debt burden (45% > 35%)
      await prisma.monthlySnapshot.create({
        data: {
          month: 5,
          year: 2026,
          status: SnapshotStatus.DRAFT,
          totalWorkingDays: 20,
          finalTotalIncome: 10_000_000,
          dailyOperational: 3_000_000,
          actualDailyOperational: 3_000_000,
          selfRewardTarget: 500_000,
          selfReward: 500_000,
          savings: 1_000_000,
          actualSavings: 1_000_000,
          totalDeductions: 4_500_000, // 45%
          deficitUncovered: 0,
        },
      });

      // Period 6/2026: Light debt burden (20% <= 25%)
      await prisma.monthlySnapshot.create({
        data: {
          month: 6,
          year: 2026,
          status: SnapshotStatus.DRAFT,
          totalWorkingDays: 20,
          finalTotalIncome: 10_000_000,
          dailyOperational: 3_000_000,
          actualDailyOperational: 3_000_000,
          selfRewardTarget: 500_000,
          selfReward: 500_000,
          savings: 1_000_000,
          actualSavings: 1_000_000,
          totalDeductions: 2_000_000, // 20%
          deficitUncovered: 0,
        },
      });

      const report = await auditService.getFullReport();

      // Check debtBurdenAudit array
      const entry5 = report.debtBurdenAudit.find(
        (d) => d.month === 5 && d.year === 2026,
      );
      expect(entry5).toBeDefined();
      expect(entry5?.totalIncome).toBe(10_000_000);
      expect(entry5?.totalBills).toBe(4_500_000);
      expect(entry5?.debtRatio).toBe(45);
      expect(entry5?.isHeavyBurden).toBe(true);

      const entry6 = report.debtBurdenAudit.find(
        (d) => d.month === 6 && d.year === 2026,
      );
      expect(entry6).toBeDefined();
      expect(entry6?.totalIncome).toBe(10_000_000);
      expect(entry6?.totalBills).toBe(2_000_000);
      expect(entry6?.debtRatio).toBe(20);
      expect(entry6?.isHeavyBurden).toBe(false);

      // Check generated flags
      const debtFlags = report.flags.filter((f) => f.category === 'DEBT_BURDEN');
      const redFlag5 = debtFlags.find(
        (f) => f.month === 5 && f.year === 2026 && f.type === 'RED',
      );
      expect(redFlag5).toBeDefined();
      expect(redFlag5?.title).toContain('High Debt Burden Squeezing Cashflow (5/2026)');
      expect(redFlag5?.amount).toBe(4_500_000);

      const greenFlag6 = debtFlags.find(
        (f) => f.month === 6 && f.year === 2026 && f.type === 'GREEN',
      );
      expect(greenFlag6).toBeDefined();
      expect(greenFlag6?.title).toContain('Debt Relief & Cashflow Expansion (6/2026)');
      expect(greenFlag6?.amount).toBe(2_000_000);
    });

    it('correctness: end-to-end syncLiabilitiesToSnapshot materialization feeds directly into Debt Burden audit evaluation', async () => {
      // 1. Create a contract with 4.2M monthly installment (>35% of total income with auto-calculated working days)
      await creditService.createContract({
        label: 'Major Motor Loan',
        principalAmount: 50_400_000,
        monthlyInstallment: 4_200_000,
        totalTenor: 12,
        startMonth: 7,
        startYear: 2026,
      });

      // 2. Sync liabilities for period 7/2026 -> materializes CREDIT_BILL transaction and recalculates snapshot
      await creditService.syncLiabilitiesToSnapshot(7, 2026);

      // 3. Verify audit service evaluates this period accurately
      const report = await auditService.getFullReport();
      const entry7 = report.debtBurdenAudit.find(
        (d) => d.month === 7 && d.year === 2026,
      );

      expect(entry7).toBeDefined();
      expect(entry7?.totalBills).toBe(4_200_000);
      expect(entry7?.isHeavyBurden).toBe(true); // 38.3% > 35% is heavy burden

      const debtFlags = report.flags.filter(
        (f) => f.category === 'DEBT_BURDEN' && f.month === 7 && f.year === 2026,
      );
      expect(debtFlags).toHaveLength(1);
      expect(debtFlags[0].type).toBe('RED');
      expect(debtFlags[0].amount).toBe(4_200_000);
    });

    it('correctness: balanced Credit Usage Limit audit flags (0 flags when unset, GREEN when respected, RED when breached)', async () => {
      // Period 7/2026: limits UNSET (0/0) -> zero credit-limit flags
      await prisma.monthlySnapshot.create({
        data: {
          month: 7,
          year: 2026,
          status: SnapshotStatus.LOCKED,
          totalWorkingDays: 20,
          finalTotalIncome: 10_000_000,
          dailyOperational: 3_000_000,
          actualDailyOperational: 3_000_000,
          savings: 1_000_000,
          actualSavings: 1_000_000,
          totalDeductions: 1_000_000,
          ccUsageLimit: 0,
          paylaterUsageLimit: 0,
        },
      });

      // Period 8/2026: limits set (CC 800k, PayLater 1.5M) and RESPECTED
      await prisma.monthlySnapshot.create({
        data: {
          month: 8,
          year: 2026,
          status: SnapshotStatus.LOCKED,
          totalWorkingDays: 20,
          finalTotalIncome: 10_000_000,
          dailyOperational: 3_000_000,
          actualDailyOperational: 3_000_000,
          savings: 1_000_000,
          actualSavings: 1_000_000,
          totalDeductions: 1_600_000,
          ccUsageLimit: 800_000,
          paylaterUsageLimit: 1_500_000,
        },
      });
      await prisma.monthlyBulkBill.create({
        data: {
          label: 'Monthly Bulk Bill',
          month: 8,
          year: 2026,
          paylaterAmount: 1_100_000,
          personalDebtAmount: 0,
          creditCardAmount: 0,
          amount: 1_100_000,
        },
      });

      // Period 9/2026: limits set (CC 600k, PayLater 1.0M) and BREACHED (PayLater 1.4M > 1.0M)
      await prisma.monthlySnapshot.create({
        data: {
          month: 9,
          year: 2026,
          status: SnapshotStatus.DRAFT,
          totalWorkingDays: 20,
          finalTotalIncome: 10_000_000,
          dailyOperational: 3_000_000,
          actualDailyOperational: 3_000_000,
          savings: 1_000_000,
          actualSavings: 1_000_000,
          totalDeductions: 1_400_000,
          ccUsageLimit: 600_000,
          paylaterUsageLimit: 1_000_000,
        },
      });
      await prisma.monthlyBulkBill.create({
        data: {
          label: 'Monthly Bulk Bill',
          month: 9,
          year: 2026,
          paylaterAmount: 1_400_000,
          personalDebtAmount: 0,
          creditCardAmount: 0,
          amount: 1_400_000,
        },
      });

      const report = await auditService.getFullReport();

      expect(
        report.flags.find(
          (f) =>
            f.id === 'credit-limit-respected-2026-7' ||
            f.id === 'credit-limit-exceeded-2026-7',
        ),
      ).toBeUndefined();

      const respectedFlag8 = report.flags.find(
        (f) => f.id === 'credit-limit-respected-2026-8',
      );
      expect(respectedFlag8).toBeDefined();
      expect(respectedFlag8?.type).toBe('GREEN');

      const exceededFlag9 = report.flags.find(
        (f) => f.id === 'credit-limit-exceeded-2026-9',
      );
      expect(exceededFlag9).toBeDefined();
      expect(exceededFlag9?.type).toBe('RED');
      expect(exceededFlag9?.amount).toBe(400_000);
    });
  });

  // ---------------------------------------------------------------------------
  // PART B — Event Journal Retrofit into 5 Existing Services
  // ---------------------------------------------------------------------------
  describe('PART B: Audit log writing retrofit into existing services', () => {
    it('1. FinanceService logs TRANSACTIONS on createTransaction and deleteTransaction', async () => {
      const tx = await financeService.createTransaction({
        month: 8,
        year: 2026,
        type: TransactionType.INCOME,
        label: 'Consulting Project',
        amount: 3_000_000,
        date: '2026-08-05',
      });

      const createLogs = await prisma.auditLog.findMany({
        where: { category: AuditCategory.TRANSACTIONS, action: 'CREATE_TRANSACTION' },
      });
      expect(createLogs).toHaveLength(1);
      expect(createLogs[0].category).toBe(AuditCategory.TRANSACTIONS);
      expect(createLogs[0].severity).toBe(AuditSeverity.INFO);
      expect(createLogs[0].summary).toContain('Consulting Project');
      expect(createLogs[0].month).toBe(8);
      expect(createLogs[0].year).toBe(2026);

      await financeService.deleteTransaction(tx.id);

      const deleteLogs = await prisma.auditLog.findMany({
        where: { category: AuditCategory.TRANSACTIONS, action: 'DELETE_TRANSACTION' },
      });
      expect(deleteLogs).toHaveLength(1);
      expect(deleteLogs[0].severity).toBe(AuditSeverity.INFO);
      expect(deleteLogs[0].summary).toContain('Consulting Project');
    });

    it('2. CreditService logs LIABILITIES on contract create/update/delete and syncLiabilitiesToSnapshot', async () => {
      // Contract create
      const contract = await creditService.createContract({
        label: 'Appliance Loan',
        principalAmount: 6_000_000,
        monthlyInstallment: 500_000,
        totalTenor: 12,
        startMonth: 8,
        startYear: 2026,
      });

      const createLogs = await prisma.auditLog.findMany({
        where: { category: AuditCategory.LIABILITIES, action: 'CREATE_CREDIT_CONTRACT' },
      });
      expect(createLogs).toHaveLength(1);
      expect(createLogs[0].category).toBe(AuditCategory.LIABILITIES);
      expect(createLogs[0].severity).toBe(AuditSeverity.INFO);
      expect(createLogs[0].summary).toContain('Appliance Loan');

      // Contract update
      await creditService.updateContract(contract.id, {
        label: 'Renamed Appliance Loan',
      });

      const updateLogs = await prisma.auditLog.findMany({
        where: { category: AuditCategory.LIABILITIES, action: 'UPDATE_CREDIT_CONTRACT' },
      });
      expect(updateLogs).toHaveLength(1);
      expect(updateLogs[0].summary).toContain('Renamed Appliance Loan');

      // syncLiabilitiesToSnapshot
      await creditService.syncLiabilitiesToSnapshot(8, 2026);

      const syncLogs = await prisma.auditLog.findMany({
        where: { category: AuditCategory.LIABILITIES, action: 'SYNC_LIABILITIES' },
      });
      expect(syncLogs.length).toBeGreaterThanOrEqual(1);
      expect(syncLogs[0].category).toBe(AuditCategory.LIABILITIES);
      expect(syncLogs[0].severity).toBe(AuditSeverity.INFO);
      expect(syncLogs[0].summary).toContain('Materialized 1 liabilities');
      expect(syncLogs[0].month).toBe(8);
      expect(syncLogs[0].year).toBe(2026);

      // Contract delete
      await creditService.deleteContract(contract.id);

      const deleteLogs = await prisma.auditLog.findMany({
        where: { category: AuditCategory.LIABILITIES, action: 'DELETE_CREDIT_CONTRACT' },
      });
      expect(deleteLogs).toHaveLength(1);
      expect(deleteLogs[0].category).toBe(AuditCategory.LIABILITIES);
    });

    it('3. SavingsService logs SAVINGS with WARNING on WITHDRAWAL and INFO on TOPUP', async () => {
      // Topup
      await savingsService.createTransaction({
        label: 'Monthly Deposit',
        amount: 1_000_000,
        date: '2026-08-10',
        type: SavingsTransactionType.TOPUP,
      });

      const topupLogs = await prisma.auditLog.findMany({
        where: { category: AuditCategory.SAVINGS, action: 'SAVINGS_TOPUP' },
      });
      expect(topupLogs).toHaveLength(1);
      expect(topupLogs[0].category).toBe(AuditCategory.SAVINGS);
      expect(topupLogs[0].severity).toBe(AuditSeverity.INFO);

      // Withdrawal -> MUST log with severity WARNING
      await savingsService.createTransaction({
        label: 'Emergency Medical Expense',
        amount: 2_000_000,
        date: '2026-08-15',
        type: SavingsTransactionType.WITHDRAWAL,
      });

      const withdrawalLogs = await prisma.auditLog.findMany({
        where: { category: AuditCategory.SAVINGS, action: 'SAVINGS_WITHDRAWAL' },
      });
      expect(withdrawalLogs).toHaveLength(1);
      expect(withdrawalLogs[0].category).toBe(AuditCategory.SAVINGS);
      expect(withdrawalLogs[0].severity).toBe(AuditSeverity.WARNING);
      expect(withdrawalLogs[0].summary).toContain('Withdrawal of Rp 2000000');
    });

    it('4. ConfigService logs SETTINGS with INFO on upsertConfig', async () => {
      await configService.upsertConfig({
        baseSalary: 12_000_000,
        dailyAllowance: 60_000,
        laptopAllowance: 250_000,
        dailyOperational: 120_000,
        transport: 250_000,
        internet: 200_000,
        vape: 100_000,
        haircut: 60_000,
        baseSavings: 600_000,
        creditLimit: 8_000_000,
        creditStatementDay: 20,
        creditDueDay: 11,
      });

      const configLogs = await prisma.auditLog.findMany({
        where: { category: AuditCategory.SETTINGS },
      });
      expect(configLogs).toHaveLength(1);
      expect(configLogs[0].category).toBe(AuditCategory.SETTINGS);
      expect(configLogs[0].severity).toBe(AuditSeverity.INFO);
      expect(configLogs[0].action).toBe('UPDATE_SETTINGS');
    });

    it('5. SnapshotsService logs BUDGET on closePeriod (INFO when healthy, DEFICIT when deficitUncovered > 0)', async () => {
      // Case A: Healthy close (deficitUncovered == 0)
      const healthySnapshot = await snapshotsSelectors.getOrCreateDraftSnapshot(8, 2026);
      await snapshotsService.closePeriod(healthySnapshot.id);

      const healthyLogs = await prisma.auditLog.findMany({
        where: { category: AuditCategory.BUDGET, month: 8, year: 2026 },
      });
      expect(healthyLogs).toHaveLength(1);
      expect(healthyLogs[0].category).toBe(AuditCategory.BUDGET);
      expect(healthyLogs[0].severity).toBe(AuditSeverity.INFO);
      expect(healthyLogs[0].action).toBe('CLOSE_PERIOD');
      expect(healthyLogs[0].summary).toContain('Closed period 8/2026');

      // Case B: Deficit close (create large deduction exceeding income)
      const deficitSnapshot = await snapshotsSelectors.getOrCreateDraftSnapshot(9, 2026);
      await prisma.transaction.create({
        data: {
          snapshotId: deficitSnapshot.id,
          type: TransactionType.DEDUCTION,
          label: 'Massive Sudden Debt',
          amount: 50_000_000, // exceeds 10M income
          date: new Date('2026-09-01'),
        },
      });

      await snapshotsService.closePeriod(deficitSnapshot.id);

      const deficitLogs = await prisma.auditLog.findMany({
        where: { category: AuditCategory.BUDGET, month: 9, year: 2026 },
      });
      expect(deficitLogs).toHaveLength(1);
      expect(deficitLogs[0].category).toBe(AuditCategory.BUDGET);
      expect(deficitLogs[0].severity).toBe(AuditSeverity.DEFICIT);
      expect(deficitLogs[0].details).toContain('Uncovered deficit: Rp');
    });
  });

  // ---------------------------------------------------------------------------
  // Audit Log Query, Filtering & Pagination
  // ---------------------------------------------------------------------------
  describe('Audit log query, filtering, and pagination', () => {
    it('filters logs by period (month, year) and category with correct pagination metadata', async () => {
      // Record several audit log entries
      await prisma.auditLog.createMany({
        data: [
          {
            action: 'TX_1',
            category: AuditCategory.TRANSACTIONS,
            summary: 'Tx 1',
            month: 8,
            year: 2026,
            severity: AuditSeverity.INFO,
          },
          {
            action: 'TX_2',
            category: AuditCategory.TRANSACTIONS,
            summary: 'Tx 2',
            month: 8,
            year: 2026,
            severity: AuditSeverity.INFO,
          },
          {
            action: 'TX_3',
            category: AuditCategory.TRANSACTIONS,
            summary: 'Tx 3',
            month: 8,
            year: 2026,
            severity: AuditSeverity.INFO,
          },
          {
            action: 'SETTING_1',
            category: AuditCategory.SETTINGS,
            summary: 'Setting update',
            month: 9,
            year: 2026,
            severity: AuditSeverity.INFO,
          },
        ],
      });

      // Query month 8 with page size 2
      const page1 = await auditSelectors.listAuditLogs({
        month: 8,
        year: 2026,
        category: AuditCategory.TRANSACTIONS,
        page: 1,
        limit: 2,
      });

      expect(page1.total).toBe(3);
      expect(page1.items).toHaveLength(2);
      expect(page1.page).toBe(1);
      expect(page1.limit).toBe(2);
      expect(page1.totalPages).toBe(2);

      const page2 = await auditSelectors.listAuditLogs({
        month: 8,
        year: 2026,
        category: AuditCategory.TRANSACTIONS,
        page: 2,
        limit: 2,
      });

      expect(page2.total).toBe(3);
      expect(page2.items).toHaveLength(1);
      expect(page2.page).toBe(2);
    });
  });
});
