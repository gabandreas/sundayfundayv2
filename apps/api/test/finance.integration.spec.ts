/**
 * finance.integration.spec.ts
 *
 * Integration tests for the finance domain module.
 * Runs against a real PostgreSQL instance (sequential execution via maxWorkers: 1).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { SnapshotsModule } from '../src/snapshots/snapshots.module';
import { FinanceService } from '../src/finance/finance.service';
import { FinanceSelectors } from '../src/finance/finance.selectors';
import { SnapshotStatus, TransactionType, TransactionSourceType } from '@prisma/client';
import { calculatePayroll } from '../src/calculator/payroll';
import { calculateDailyPacing } from '../src/calculator/pacing';
import { AuditModule } from '../src/audit/audit.module';

async function cleanAll(prisma: PrismaService) {
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.monthlySnapshot.deleteMany();
  await prisma.globalConfig.upsert({
    where: { userId: 1 },
    update: {},
    create: {
      userId: 1,
      baseSalary: 10_000_000,
      dailyAllowance: 50_000,
      laptopAllowance: 250_000,
      dailyOperational: 100_000,
      transport: 200_000,
      internet: 150_000,
      vape: 100_000,
      haircut: 50_000,
      baseSavings: 500_000,
    },
  });
}

describe('Finance — integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let service: FinanceService;
  let selectors: FinanceSelectors;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule, SnapshotsModule, AuditModule],
      providers: [FinanceService, FinanceSelectors],
    }).compile();

    prisma = module.get(PrismaService);
    service = module.get(FinanceService);
    selectors = module.get(FinanceSelectors);

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
  // 1. Snapshot Lock Enforcement on Transaction Mutations
  // ---------------------------------------------------------------------------
  describe('Snapshot lock enforcement', () => {
    it('creates a transaction on a DRAFT snapshot and recalculates derived fields', async () => {
      const snapshot = await prisma.monthlySnapshot.create({
        data: {
          month: 7,
          year: 2026,
          status: SnapshotStatus.DRAFT,
          totalWorkingDays: 20,
        },
      });

      const tx = await service.createTransaction({
        month: 7,
        year: 2026,
        type: TransactionType.INCOME,
        label: 'Freelance Design',
        amount: 2_000_000,
        date: '2026-07-15',
      });

      expect(tx.sourceType).toBe(TransactionSourceType.MANUAL);
      expect(tx.sourceId).toBeNull();
      expect(tx.amount).toBe(2_000_000);

      const refreshed = await prisma.monthlySnapshot.findUniqueOrThrow({
        where: { id: snapshot.id },
      });

      // Extra income was recalculated and added to finalTotalIncome
      expect(refreshed.extraIncome).toBe(2_000_000);
      expect(refreshed.finalTotalIncome).toBeGreaterThan(0);
    });

    it('rejects creating a transaction on a LOCKED snapshot', async () => {
      await prisma.monthlySnapshot.create({
        data: {
          month: 7,
          year: 2026,
          status: SnapshotStatus.LOCKED,
        },
      });

      await expect(
        service.createTransaction({
          month: 7,
          year: 2026,
          type: TransactionType.DEDUCTION,
          label: 'Dinner',
          amount: 100_000,
          date: '2026-07-15',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deletes a transaction on a DRAFT snapshot and recalculates derived fields', async () => {
      const snapshot = await prisma.monthlySnapshot.create({
        data: {
          month: 7,
          year: 2026,
          status: SnapshotStatus.DRAFT,
        },
      });

      const tx = await prisma.transaction.create({
        data: {
          snapshotId: snapshot.id,
          type: TransactionType.DEDUCTION,
          sourceType: TransactionSourceType.MANUAL,
          sourceId: null,
          label: 'Concert Ticket',
          amount: 500_000,
          date: new Date('2026-07-10'),
        },
      });

      await service.deleteTransaction(tx.id);

      const remaining = await prisma.transaction.findMany({
        where: { snapshotId: snapshot.id },
      });
      expect(remaining).toHaveLength(0);

      const refreshed = await prisma.monthlySnapshot.findUniqueOrThrow({
        where: { id: snapshot.id },
      });
      expect(refreshed.totalDeductions).toBe(0);
    });

    it('successfully updates transaction label and amount and recalculates snapshot', async () => {
      const snapshot = await prisma.monthlySnapshot.create({
        data: {
          month: 7,
          year: 2026,
          status: SnapshotStatus.DRAFT,
          totalWorkingDays: 21,
          cafeteriaDeduction: 0,
        },
      });

      const tx = await prisma.transaction.create({
        data: {
          snapshotId: snapshot.id,
          type: TransactionType.DEDUCTION,
          sourceType: TransactionSourceType.MANUAL,
          sourceId: null,
          label: 'Original Label',
          amount: 250_000,
          date: new Date('2026-07-10'),
        },
      });

      const updated = await service.updateTransaction(tx.id, {
        label: 'Updated Label',
        amount: 400_000,
      });

      expect(updated.label).toBe('Updated Label');
      expect(updated.amount).toBe(400_000);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'TRANSACTION_UPDATED' },
      });
      expect(audit).toBeDefined();
    });

    it('rejects deleting a transaction when parent snapshot is LOCKED', async () => {
      const snapshot = await prisma.monthlySnapshot.create({
        data: {
          month: 7,
          year: 2026,
          status: SnapshotStatus.LOCKED,
        },
      });

      const tx = await prisma.transaction.create({
        data: {
          snapshotId: snapshot.id,
          type: TransactionType.DEDUCTION,
          sourceType: TransactionSourceType.MANUAL,
          sourceId: null,
          label: 'Concert Ticket',
          amount: 500_000,
          date: new Date('2026-07-10'),
        },
      });

      await expect(service.deleteTransaction(tx.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects deleting non-MANUAL transactions (e.g. CONTRACT, CC_TRANSACTION, BULK_BILL)', async () => {
      const snapshot = await prisma.monthlySnapshot.create({
        data: {
          month: 7,
          year: 2026,
          status: SnapshotStatus.DRAFT,
        },
      });

      const tx = await prisma.transaction.create({
        data: {
          snapshotId: snapshot.id,
          type: TransactionType.DEDUCTION,
          sourceType: TransactionSourceType.CONTRACT,
          sourceId: 1,
          label: 'Laptop Amortization',
          amount: 1_250_000,
          date: new Date('2026-07-01'),
        },
      });

      await expect(service.deleteTransaction(tx.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Pure Calculator Wiring for Payroll & Pacing
  // ---------------------------------------------------------------------------
  describe('Calculator pure function wiring', () => {
    it('getPayroll returns values matching calculatePayroll for equivalent inputs', async () => {
      const snapshot = await prisma.monthlySnapshot.create({
        data: {
          month: 8,
          year: 2026,
          status: SnapshotStatus.DRAFT,
          totalWorkingDays: 21,
          salaryAdjustment: 500_000,
          cafeteriaDeduction: 120_000,
          thrAmount: 0,
          bonusAmount: 1_000_000,
        },
      });

      // Add one INCOME transaction
      await prisma.transaction.create({
        data: {
          snapshotId: snapshot.id,
          type: TransactionType.INCOME,
          sourceType: TransactionSourceType.MANUAL,
          sourceId: null,
          label: 'Dividend',
          amount: 750_000,
          date: new Date('2026-08-10'),
        },
      });

      const config = await prisma.globalConfig.findFirstOrThrow();

      // Expected calculation from pure function
      const expectedPayroll = calculatePayroll({
        baseSalary: config.baseSalary,
        salaryAdjustment: 500_000,
        totalWorkingDays: 21,
        dailyAllowance: config.dailyAllowance,
        cafeteriaDeduction: 120_000,
        thrAmount: 0,
        bonusAmount: 1_000_000,
        extraIncome: 750_000,
        laptopAllowance: config.laptopAllowance,
      });

      const actualPayroll = await selectors.getPayroll(8, 2026);

      expect(actualPayroll).toEqual(expectedPayroll);
      expect(actualPayroll.finalTotalIncome).toBe(expectedPayroll.finalTotalIncome);
      expect(actualPayroll.netSalaryIncome).toBe(expectedPayroll.netSalaryIncome);
      expect(actualPayroll.bpjsDeduction).toBe(expectedPayroll.bpjsDeduction);
    });

    it('correctly reads an existing snapshot with prior data without re-initializing or losing fields', async () => {
      // 1. Create existing snapshot with prior custom inputs
      const existing = await prisma.monthlySnapshot.create({
        data: {
          month: 9,
          year: 2026,
          status: SnapshotStatus.DRAFT,
          totalWorkingDays: 20,
          salaryAdjustment: 250_000,
          cafeteriaDeduction: 100_000,
          bonusAmount: 500_000,
        },
      });

      // 2. Add an INCOME transaction to snapshot
      await prisma.transaction.create({
        data: {
          snapshotId: existing.id,
          type: TransactionType.INCOME,
          sourceType: TransactionSourceType.MANUAL,
          label: 'Consulting',
          amount: 1_500_000,
          date: new Date('2026-09-12'),
        },
      });

      // 3. Call getPayroll for existing snapshot period
      const payroll = await selectors.getPayroll(9, 2026);

      const config = await prisma.globalConfig.findFirstOrThrow();
      expect(payroll.totalWorkingDays).toBe(20);
      expect(payroll.salaryAdjustment).toBe(250_000);
      expect(payroll.cafeteriaDeduction).toBe(100_000);
      expect(payroll.bonusAmount).toBe(500_000);
      expect(payroll.extraIncome).toBe(1_500_000);
      expect(payroll.baseSalary).toBe(config.baseSalary);
      expect(payroll.laptopAllowance).toBe(config.laptopAllowance);

      // Verify no duplicate snapshot was created
      const count = await prisma.monthlySnapshot.count({
        where: { month: 9, year: 2026 },
      });
      expect(count).toBe(1);
    });

    it('getPacing returns values matching calculateDailyPacing for equivalent inputs', async () => {
      const snapshot = await prisma.monthlySnapshot.create({
        data: {
          month: 8,
          year: 2026,
          status: SnapshotStatus.DRAFT,
          dailyOperational: 100_000,
          actualDailyOperational: 3_000_000,
        },
      });

      // Add two DEDUCTION transactions
      await prisma.transaction.create({
        data: {
          snapshotId: snapshot.id,
          type: TransactionType.DEDUCTION,
          sourceType: TransactionSourceType.MANUAL,
          sourceId: null,
          label: 'Groceries',
          amount: 400_000,
          date: new Date('2026-08-05'),
        },
      });
      await prisma.transaction.create({
        data: {
          snapshotId: snapshot.id,
          type: TransactionType.DEDUCTION,
          sourceType: TransactionSourceType.MANUAL,
          sourceId: null,
          label: 'Fuel',
          amount: 200_000,
          date: new Date('2026-08-12'),
        },
      });

      const fixedRefDate = new Date(2026, 8, 15); // Sept 15, 2026 (consumption month M+1)

      const expectedPacing = calculateDailyPacing({
        periodMonth: 8,
        periodYear: 2026,
        cycleStartDate: new Date(Date.UTC(2026, 7, 25)),
        cycleEndDate: new Date(Date.UTC(2026, 8, 24)),
        isEndDateConfirmed: false,
        actualDailyOperational: 3_000_000,
        dailyOperationalTarget: 100_000,
        totalDailySpent: 600_000, // 400k + 200k
        referenceDate: fixedRefDate,
      });

      const actualPacing = await selectors.getPacing(8, 2026, fixedRefDate);

      expect(actualPacing).toEqual(expect.objectContaining(expectedPacing));
      expect(actualPacing.safeToSpendToday).toBe(expectedPacing.safeToSpendToday);
      expect(actualPacing.pacingStatus).toBe(expectedPacing.pacingStatus);
    });

    it('executeCashReconciliation creates unitemized deduction transaction and writes structured BALANCE_CHECKPOINT_SYNCED audit log', async () => {
      const snapshot = await prisma.monthlySnapshot.create({
        data: {
          month: 10,
          year: 2026,
          status: SnapshotStatus.DRAFT,
          dailyOperational: 1_000_000,
          actualDailyOperational: 1_000_000,
          transport: 200_000,
          haircut: 85_000,
          internet: 0,
          vape: 0,
        },
      });

      // System has 1,000,000 remaining operational budget
      // User syncs bank balance of 1,085,000 including unspent routine bills (285,000)
      // Effective operational cash = 1,085,000 - 285,000 = 800,000
      // Shortfall = 200,000 unitemized burn
      const result = await service.executeCashReconciliation({
        month: 10,
        year: 2026,
        actualRealBalance: 1_085_000,
        includesUnspentRoutinePool: true,
        note: 'Futsal and food weekend burn',
      });

      expect(result.preview.discrepancyDirection).toBe('SHORTFALL');
      expect(result.preview.adjustmentAmount).toBe(200_000);
      expect(result.appliedActionType).toBe('RECORD_DEDUCTION_ADJUSTMENT');

      // Verify unitemized transaction was created
      const txs = await prisma.transaction.findMany({
        where: { snapshotId: snapshot.id },
      });
      expect(txs).toHaveLength(1);
      expect(txs[0].amount).toBe(200_000);
      expect(txs[0].type).toBe(TransactionType.DEDUCTION);
      expect(txs[0].label).toBe('Futsal and food weekend burn');

      // Verify AuditLog was recorded with BALANCE_CHECKPOINT_SYNCED and structured details
      const auditLogs = await prisma.auditLog.findMany({
        where: { action: 'BALANCE_CHECKPOINT_SYNCED', month: 10, year: 2026 },
      });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].summary).toContain('Reconciled cash shortfall');
      expect(auditLogs[0].severity).toBe('WARNING');
      const details = JSON.parse(auditLogs[0].details || '{}');
      expect(details.reportedBankBalance).toBe(1_085_000);
      expect(details.unspentRoutineOffset).toBe(285_000);
      expect(details.effectiveOperationalCash).toBe(800_000);
      expect(details.delta).toBe(-200_000);
      expect(details.note).toBe('Futsal and food weekend burn');
    });
  });
});
