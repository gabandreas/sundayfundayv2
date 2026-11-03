/**
 * credit.integration.spec.ts
 *
 * Integration tests for the credit domain module.
 * Runs against a real PostgreSQL instance (sequential execution via maxWorkers: 1).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { SnapshotsModule } from '../src/snapshots/snapshots.module';
import { AuditModule } from '../src/audit/audit.module';
import { AuditSelectors } from '../src/audit/audit.selectors';
import { CreditService } from '../src/credit/credit.service';
import { CreditSelectors } from '../src/credit/credit.selectors';
import {
  SnapshotStatus,
  CreditCardChargeType,
  CreditCardStatus,
  TransactionType,
  TransactionSourceType,
} from '@prisma/client';

async function cleanAll(prisma: PrismaService) {
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.creditCardTransaction.deleteMany();
  await prisma.monthlyBulkBill.deleteMany();
  await prisma.creditContract.deleteMany();
  await prisma.monthlySnapshot.deleteMany();
  await prisma.globalConfig.deleteMany();
  await prisma.globalConfig.create({
    data: {
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
      creditStatementDay: 20,
    },
  });
}

describe('Credit — integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let service: CreditService;
  let selectors: CreditSelectors;
  let auditSelectors: AuditSelectors;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule, SnapshotsModule, AuditModule],
      providers: [CreditService, CreditSelectors],
    }).compile();

    prisma = module.get(PrismaService);
    service = module.get(CreditService);
    selectors = module.get(CreditSelectors);
    auditSelectors = module.get(AuditSelectors);

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
  // 1. Billing Cycle Cut-off Rule (§3.4)
  // ---------------------------------------------------------------------------
  describe('calculateBillingCycle', () => {
    it('assigns billingMonth = txMonth for transactionDate.day <= 20 (paid from same month payroll)', () => {
      // 15th of August 2026 -> August 2026
      const cycle = service.calculateBillingCycle('2026-08-15', 20);
      expect(cycle.billingMonth).toBe(8);
      expect(cycle.billingYear).toBe(2026);
    });

    it('assigns billingMonth = txMonth on exactly the 20th', () => {
      // 20th of August 2026 -> August 2026
      const cycle = service.calculateBillingCycle('2026-08-20', 20);
      expect(cycle.billingMonth).toBe(8);
      expect(cycle.billingYear).toBe(2026);
    });

    it('assigns billingMonth = txMonth + 1 for transactionDate.day > 20 (paid from next month payroll)', () => {
      // 21st of August 2026 -> September 2026
      const cycle = service.calculateBillingCycle('2026-08-21', 20);
      expect(cycle.billingMonth).toBe(9);
      expect(cycle.billingYear).toBe(2026);
    });

    it('rolls over to January of next year when past cut-off in December', () => {
      // 25th of December 2026 -> January 2027
      const cycle = service.calculateBillingCycle('2026-12-25', 20);
      expect(cycle.billingMonth).toBe(1);
      expect(cycle.billingYear).toBe(2027);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. CreditContract CRUD & Tenor Invariance
  // ---------------------------------------------------------------------------
  describe('CreditContract — tenor invariance', () => {
    it('initializes remainingTenor to totalTenor on creation', async () => {
      const contract = await service.createContract({
        label: 'MacBook M3',
        principalAmount: 24_000_000,
        monthlyInstallment: 2_000_000,
        totalTenor: 12,
        startMonth: 1,
        startYear: 2026,
      });

      expect(contract.remainingTenor).toBe(12);
      expect(contract.totalTenor).toBe(12);
      expect(contract.isActive).toBe(true);
    });

    it('updateContract does not allow modifying remainingTenor', async () => {
      const contract = await service.createContract({
        label: 'Phone',
        principalAmount: 12_000_000,
        monthlyInstallment: 1_000_000,
        totalTenor: 12,
        startMonth: 1,
        startYear: 2026,
      });

      const updated = await service.updateContract(contract.id, {
        label: 'iPhone 16 Pro',
        monthlyInstallment: 1_100_000,
      });

      expect(updated.label).toBe('iPhone 16 Pro');
      expect(updated.monthlyInstallment).toBe(1_100_000);
      expect(updated.remainingTenor).toBe(12); // untouched
    });
  });

  // ---------------------------------------------------------------------------
  // 3. CreditCardTransaction CRUD & Creation
  // ---------------------------------------------------------------------------
  describe('CreditCardTransaction CRUD', () => {
    it('creates a FULL charge with computed billingMonth based on cut-off', async () => {
      const cardTx = await service.createCardTransaction({
        label: 'Dinner',
        amount: 300_000,
        transactionDate: '2026-08-15',
        chargeType: CreditCardChargeType.FULL,
      });

      expect(cardTx.billingMonth).toBe(8);
      expect(cardTx.billingYear).toBe(2026);
      expect(cardTx.status).toBe(CreditCardStatus.ACTIVE);
    });

    it('creates an INSTALLMENT charge setting monthlyAmount and billing cycle', async () => {
      const cardTx = await service.createCardTransaction({
        label: 'Camera',
        amount: 6_000_000,
        totalAmount: 6_000_000,
        monthlyAmount: 1_000_000,
        tenor: 6,
        transactionDate: '2026-08-25', // post-cutoff
        chargeType: CreditCardChargeType.INSTALLMENT,
      });

      expect(cardTx.billingMonth).toBe(9); // shifted to Sept
      expect(cardTx.billingYear).toBe(2026);
      expect(cardTx.monthlyAmount).toBe(1_000_000);
      expect(cardTx.totalAmount).toBe(6_000_000);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Idempotent Liability Materialization (syncLiabilitiesToSnapshot)
  // ---------------------------------------------------------------------------
  describe('syncLiabilitiesToSnapshot', () => {
    it('materializes MonthlyBulkBill with paylaterAmount into BULK_BILL transaction labeled "PayLater Bill"', async () => {
      const bill = await service.createBulkBill({
        label: 'Tokopedia PayLater',
        paylaterAmount: 850_000,
        month: 9,
        year: 2026,
      });

      const result = await service.syncLiabilitiesToSnapshot(9, 2026);
      expect(result.materializedCount).toBe(1);

      const txs = await prisma.transaction.findMany({
        where: { snapshotId: result.snapshotId },
      });

      expect(txs).toHaveLength(1);
      expect(txs[0].type).toBe(TransactionType.CREDIT_BILL);
      expect(txs[0].sourceType).toBe(TransactionSourceType.BULK_BILL);
      expect(txs[0].sourceId).toBe(bill.id);
      expect(txs[0].amount).toBe(850_000);
      expect(txs[0].label).toBe('PayLater Bill');
    });

    it('materializes distinct transactions for PayLater and Personal Debt from a single bulk bill', async () => {
      const bill = await service.createBulkBill({
        label: 'Combined Bill',
        paylaterAmount: 600_000,
        personalDebtAmount: 250_000,
        month: 9,
        year: 2026,
      });

      const result = await service.syncLiabilitiesToSnapshot(9, 2026);
      expect(result.materializedCount).toBe(2);

      const txs = await prisma.transaction.findMany({
        where: { snapshotId: result.snapshotId },
      });

      expect(txs).toHaveLength(2);

      const paylaterTx = txs.find((t) => t.sourceType === TransactionSourceType.BULK_BILL);
      expect(paylaterTx).toBeDefined();
      expect(paylaterTx?.amount).toBe(600_000);
      expect(paylaterTx?.label).toBe('PayLater Bill');
      expect(paylaterTx?.sourceId).toBe(bill.id);

      const personalDebtTx = txs.find((t) => t.sourceType === TransactionSourceType.PERSONAL_DEBT);
      expect(personalDebtTx).toBeDefined();
      expect(personalDebtTx?.amount).toBe(250_000);
      expect(personalDebtTx?.label).toBe('Personal & Informal Debt');
      expect(personalDebtTx?.sourceId).toBe(bill.id);
    });

    it('materializes ZERO transactions when MonthlyBulkBill has paylaterAmount=0, personalDebtAmount=0, but legacy creditCardAmount>0', async () => {
      // Directly seed a bulk bill with legacy creditCardAmount and legacy b.amount
      await prisma.monthlyBulkBill.create({
        data: {
          label: 'Legacy CC Bulk Bill',
          amount: 500_000,
          paylaterAmount: 0,
          personalDebtAmount: 0,
          creditCardAmount: 500_000,
          month: 9,
          year: 2026,
        },
      });

      const result = await service.syncLiabilitiesToSnapshot(9, 2026);
      expect(result.materializedCount).toBe(0);

      const txs = await prisma.transaction.findMany({
        where: { snapshotId: result.snapshotId },
      });
      expect(txs).toHaveLength(0);
    });

    it('does not duplicate transactions on repeated sync calls', async () => {
      await service.createBulkBill({
        label: 'Shopee PayLater',
        paylaterAmount: 500_000,
        month: 9,
        year: 2026,
      });

      // Sync once
      await service.syncLiabilitiesToSnapshot(9, 2026);
      let txs = await prisma.transaction.findMany({
        where: { sourceType: TransactionSourceType.BULK_BILL },
      });
      expect(txs).toHaveLength(1);

      // Sync second time
      await service.syncLiabilitiesToSnapshot(9, 2026);
      txs = await prisma.transaction.findMany({
        where: { sourceType: TransactionSourceType.BULK_BILL },
      });
      expect(txs).toHaveLength(1);
    });

    it('materializes authoritative amounts for FULL, INSTALLMENT, and RECURRING CC charges', async () => {
      // 1. FULL charge: due Aug 2026 (day 10 <= 20)
      await service.createCardTransaction({
        label: 'Supermarket',
        amount: 400_000,
        transactionDate: '2026-08-10',
        chargeType: CreditCardChargeType.FULL,
      });

      // 2. INSTALLMENT: total 3_000_000, monthlyAmount 500_000, tenor 6, billed from Aug 2026 (day 15 <= 20)
      await service.createCardTransaction({
        label: 'Desk Chair',
        amount: 3_000_000,
        totalAmount: 3_000_000,
        monthlyAmount: 500_000,
        tenor: 6,
        transactionDate: '2026-08-15',
        chargeType: CreditCardChargeType.INSTALLMENT,
      });

      // 3. RECURRING: 150_000 / month, starting Aug 2026
      await service.createCardTransaction({
        label: 'Cloud Storage',
        amount: 150_000,
        transactionDate: '2026-08-01',
        chargeType: CreditCardChargeType.RECURRING,
      });

      // 4. Contract: 1_200_000 / month
      await service.createContract({
        label: 'Motorcycle',
        principalAmount: 14_400_000,
        monthlyInstallment: 1_200_000,
        totalTenor: 12,
        startMonth: 8,
        startYear: 2026,
      });

      const { snapshotId, materializedCount } =
        await service.syncLiabilitiesToSnapshot(8, 2026);

      // 1 Full (400k) + 1 Installment (500k) + 1 Recurring (150k) + 1 Contract (1.2M) = 4
      expect(materializedCount).toBe(4);

      const txs = await prisma.transaction.findMany({
        where: { snapshotId },
      });

      const chairTx = txs.find((t) => t.label === 'Desk Chair');
      expect(chairTx).toBeDefined();
      // Crucial: INSTALLMENT uses monthlyAmount (500k), not total amount (3M)
      expect(chairTx?.amount).toBe(500_000);

      const supermarketTx = txs.find((t) => t.label === 'Supermarket');
      expect(supermarketTx?.amount).toBe(400_000);

      const cloudTx = txs.find((t) => t.label === 'Cloud Storage');
      expect(cloudTx?.amount).toBe(150_000);

      const contractTx = txs.find((t) => t.label === 'Motorcycle');
      expect(contractTx?.amount).toBe(1_200_000);

      // Verify recalculation was triggered and totalDeductions on snapshot reflects the sum
      const snapshot = await prisma.monthlySnapshot.findUniqueOrThrow({
        where: { id: snapshotId },
      });
      expect(snapshot.totalDeductions).toBe(400_000 + 500_000 + 150_000 + 1_200_000);
    });

    it('preserves pre-existing MANUAL transactions when syncing liabilities', async () => {
      const snapshot = await prisma.monthlySnapshot.create({
        data: {
          month: 8,
          year: 2026,
          status: SnapshotStatus.DRAFT,
        },
      });

      // Manually added transaction
      const manualTx = await prisma.transaction.create({
        data: {
          snapshotId: snapshot.id,
          type: TransactionType.DEDUCTION,
          sourceType: TransactionSourceType.MANUAL,
          sourceId: null,
          label: 'Special Tax',
          amount: 150_000,
          date: new Date('2026-08-10'),
        },
      });

      await service.createBulkBill({
        label: 'PayLater',
        paylaterAmount: 300_000,
        month: 8,
        year: 2026,
      });

      await service.syncLiabilitiesToSnapshot(8, 2026);

      const txs = await prisma.transaction.findMany({
        where: { snapshotId: snapshot.id },
      });

      expect(txs).toHaveLength(2);
      expect(txs.some((t) => t.id === manualTx.id && t.label === 'Special Tax')).toBe(true);
      expect(txs.some((t) => t.sourceType === TransactionSourceType.BULK_BILL)).toBe(true);
    });

    it('rejects syncLiabilitiesToSnapshot when target snapshot is LOCKED', async () => {
      await prisma.monthlySnapshot.create({
        data: {
          month: 8,
          year: 2026,
          status: SnapshotStatus.LOCKED,
        },
      });

      await expect(service.syncLiabilitiesToSnapshot(8, 2026)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('preserves sibling fields when editing PayLater and atomically recomputes total amount', async () => {
      // Create bulk bill with initial Personal Debt
      const created = await service.createBulkBill({
        label: 'Monthly Obligations',
        month: 9,
        year: 2026,
        personalDebtAmount: 500_000,
      });

      expect(created.personalDebtAmount).toBe(500_000);
      expect(created.paylaterAmount).toBe(0);
      expect(created.amount).toBe(500_000);

      // Now edit ONLY paylaterAmount via updateBulkBill
      const updated = await service.updateBulkBill(created.id, {
        paylaterAmount: 750_000,
      });

      // Assert personalDebtAmount is strictly preserved and amount is recomputed atomically
      expect(updated.personalDebtAmount).toBe(500_000);
      expect(updated.paylaterAmount).toBe(750_000);
      expect(updated.amount).toBe(1_250_000);

      // Verify in database
      const inDb = await prisma.monthlyBulkBill.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(inDb.personalDebtAmount).toBe(500_000);
      expect(inDb.paylaterAmount).toBe(750_000);
      expect(inDb.amount).toBe(1_250_000);
    });

    it('rejects CC transaction creation when post-cutoff target billing month is LOCKED', async () => {
      // Current month 8/2026 is DRAFT
      await prisma.monthlySnapshot.create({
        data: {
          month: 8,
          year: 2026,
          status: SnapshotStatus.DRAFT,
        },
      });

      // Target billing month (9/2026, due to transactionDate > day 20) is LOCKED
      await prisma.monthlySnapshot.create({
        data: {
          month: 9,
          year: 2026,
          status: SnapshotStatus.LOCKED,
        },
      });

      // Transaction dated 2026-08-25 (> day 20) bills into 9/2026
      await expect(
        service.createCardTransaction({
          label: 'Dinner Out',
          amount: 250_000,
          transactionDate: '2026-08-25',
          chargeType: CreditCardChargeType.FULL,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects deleteCardTransaction when target billing period is LOCKED', async () => {
      // 1. Create card transaction for period 8/2026
      const card = await prisma.creditCardTransaction.create({
        data: {
          label: 'Old Subscription',
          amount: 50_000,
          billingMonth: 8,
          billingYear: 2026,
          transactionDate: new Date('2026-08-10'),
          chargeType: CreditCardChargeType.FULL,
          status: CreditCardStatus.ACTIVE,
        },
      });

      // 2. Lock the snapshot for 8/2026
      await prisma.monthlySnapshot.create({
        data: {
          month: 8,
          year: 2026,
          status: SnapshotStatus.LOCKED,
        },
      });

      // 3. Attempt to delete should reject outright
      await expect(service.deleteCardTransaction(card.id)).rejects.toThrow(BadRequestException);
    });

    it('rejects createBulkBill, updateBulkBill, and deleteBulkBill when target period is LOCKED', async () => {
      // 1. Seed a bulk bill for 7/2026 before locking
      const bill = await prisma.monthlyBulkBill.create({
        data: {
          label: 'July Bill',
          month: 7,
          year: 2026,
          paylaterAmount: 100_000,
          personalDebtAmount: 0,
          creditCardAmount: 0,
          amount: 100_000,
        },
      });

      // 2. Lock period 7/2026
      await prisma.monthlySnapshot.create({
        data: {
          month: 7,
          year: 2026,
          status: SnapshotStatus.LOCKED,
        },
      });

      // 3. Attempt create on locked period
      await expect(
        service.createBulkBill({
          label: 'Another Bill',
          month: 7,
          year: 2026,
          paylaterAmount: 50_000,
        }),
      ).rejects.toThrow(BadRequestException);

      // 4. Attempt update on locked period
      await expect(
        service.updateBulkBill(bill.id, {
          paylaterAmount: 200_000,
        }),
      ).rejects.toThrow(BadRequestException);

      // 5. Attempt delete on locked period
      await expect(service.deleteBulkBill(bill.id)).rejects.toThrow(BadRequestException);
    });

    it('logs to AuditLogService with category LIABILITIES on bulk bill create and update', async () => {
      const bill = await service.createBulkBill({
        label: 'PayLater August',
        month: 8,
        year: 2026,
        paylaterAmount: 300_000,
      });

      await service.updateBulkBill(bill.id, {
        personalDebtAmount: 200_000,
      });

      const auditLogs = await prisma.auditLog.findMany({
        where: { category: 'LIABILITIES' },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLogs.some((l) => l.action === 'CREATE_BULK_BILL')).toBe(true);
      expect(auditLogs.some((l) => l.action === 'UPDATE_BULK_BILL')).toBe(true);
    });

    it('computes contract timeline and projected payoff date server-side in selectors', async () => {
      await prisma.creditContract.create({
        data: {
          label: 'MacBook Installment',
          principalAmount: 24_000_000,
          monthlyInstallment: 2_000_000,
          totalTenor: 12,
          remainingTenor: 8,
          startMonth: 1,
          startYear: 2026,
          isActive: true,
        },
      });

      const contracts = await selectors.listContracts(true);
      const macbook = contracts.find((c) => c.label === 'MacBook Installment');

      expect(macbook).toBeDefined();
      expect(macbook!.elapsedTenor).toBe(4);
      expect(macbook!.tenorProgressPercent).toBe(33); // 4 / 12 = 33%
      expect(macbook!.payoffMonth).toBe(12);
      expect(macbook!.payoffYear).toBe(2026);
      expect(macbook!.payoffDateLabel).toBe('Dec 2026');
      expect(macbook!.remainingPrincipal).toBe(16_000_000); // 8 * 2_000_000
    });

    it('materializes MonthlyBulkBill with breakdown description when multiple components are non-zero', async () => {
      const snapshot = await prisma.monthlySnapshot.create({
        data: {
          month: 11,
          year: 2026,
          status: SnapshotStatus.DRAFT,
        },
      });

      await service.createBulkBill({
        label: 'Monthly Bulk Bill',
        paylaterAmount: 1_150_000,
        personalDebtAmount: 453_000,
        month: 11,
        year: 2026,
      });

      await service.syncLiabilitiesToSnapshot(11, 2026);

      const paylaterTx = await prisma.transaction.findFirst({
        where: {
          snapshotId: snapshot.id,
          sourceType: TransactionSourceType.BULK_BILL,
        },
      });

      expect(paylaterTx).toBeDefined();
      expect(paylaterTx?.label).toBe('PayLater Bill');
      expect(paylaterTx?.amount).toBe(1_150_000);

      const personalDebtTx = await prisma.transaction.findFirst({
        where: {
          snapshotId: snapshot.id,
          sourceType: TransactionSourceType.PERSONAL_DEBT,
        },
      });

      expect(personalDebtTx).toBeDefined();
      expect(personalDebtTx?.label).toBe('Personal & Informal Debt');
      expect(personalDebtTx?.amount).toBe(453_000);
    });

    it('prevents double-counting: counts credit card from CreditCardTransaction only, ignoring legacy MonthlyBulkBill.creditCardAmount', async () => {
      // 1. Create a DRAFT snapshot for period 9/2026
      const snapshot = await prisma.monthlySnapshot.create({
        data: {
          month: 9,
          year: 2026,
          status: SnapshotStatus.DRAFT,
        },
      });

      // 2. Seed a MonthlyBulkBill with non-zero creditCardAmount (e.g. PayLater 2,173,545 + legacy CC 384,000 = amount 2,557,545)
      await prisma.monthlyBulkBill.create({
        data: {
          label: 'Monthly Bulk Bill',
          month: 9,
          year: 2026,
          paylaterAmount: 2_173_545,
          personalDebtAmount: 0,
          creditCardAmount: 384_000,
          amount: 2_557_545,
        },
      });

      // 3. Seed a separate CreditCardTransaction for the same billing period (e.g. 503,241)
      await prisma.creditCardTransaction.create({
        data: {
          label: 'Credit Card Charges',
          amount: 503_241,
          totalAmount: 503_241,
          monthlyAmount: 503_241,
          chargeType: CreditCardChargeType.FULL,
          tenor: 1,
          billingMonth: 9,
          billingYear: 2026,
          transactionDate: new Date('2026-09-01'),
          status: CreditCardStatus.ACTIVE,
        },
      });

      // 4. Call syncLiabilitiesToSnapshot
      await service.syncLiabilitiesToSnapshot(9, 2026);

      // 5. Query all materialized CREDIT_BILL transactions for this snapshot
      const txs = await prisma.transaction.findMany({
        where: {
          snapshotId: snapshot.id,
          type: TransactionType.CREDIT_BILL,
        },
      });

      // Assertions:
      // - The bulk bill transaction should only materialize PayLater (2,173,545)
      const bulkBillTx = txs.find((t) => t.sourceType === TransactionSourceType.BULK_BILL);
      expect(bulkBillTx).toBeDefined();
      expect(bulkBillTx?.amount).toBe(2_173_545);
      expect(bulkBillTx?.label).not.toContain('CC');

      // - The credit card transaction should materialize 503,241
      const ccTx = txs.find((t) => t.sourceType === TransactionSourceType.CC_TRANSACTION);
      expect(ccTx).toBeDefined();
      expect(ccTx?.amount).toBe(503_241);

      // - Total deductions must be 2,173,545 + 503,241 = 2,676,786 (NEVER 3,060,786)
      const totalDeductions = txs.reduce((sum, t) => sum + t.amount, 0);
      expect(totalDeductions).toBe(2_676_786);

      const updatedSnapshot = await prisma.monthlySnapshot.findUnique({
        where: { id: snapshot.id },
      });
      expect(updatedSnapshot?.totalDeductions).toBe(2_676_786);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Per-Period Credit Usage Limit & Safe Recommendation (Step 3)
  // ---------------------------------------------------------------------------
  describe('Per-period credit usage limit & safe recommendation', () => {
    it('getCreditUsageLimit is strictly read-only and NEVER creates a MonthlySnapshot row for an uninitialized future period', async () => {
      // Seed scheduled PayLater bill for 3/2027 without a MonthlySnapshot
      await prisma.monthlyBulkBill.create({
        data: {
          label: 'Future PayLater',
          month: 3,
          year: 2027,
          paylaterAmount: 1_200_000,
          personalDebtAmount: 0,
          creditCardAmount: 0,
          amount: 1_200_000,
        },
      });

      const report = await selectors.getCreditUsageLimit(3, 2027);

      expect(report.isSnapshotPersisted).toBe(false);
      expect(report.snapshotStatus).toBe('UNINITIALIZED');
      expect(report.paylaterEvaluation.usage).toBe(1_200_000);
      expect(report.ceilingBreakdown.totalIncome).toBeGreaterThan(0);

      // Verify zero MonthlySnapshot rows were materialized by the read-only selector
      const snapshotInDb = await prisma.monthlySnapshot.findUnique({
        where: { userId_month_year: { userId: 1, month: 3, year: 2027 } },
      });
      expect(snapshotInDb).toBeNull();
    });

    it('updateCreditUsageLimit on an uninitialized future period saves the limit without polluting Discipline Audit history', async () => {
      const updated = await service.updateCreditUsageLimit({
        month: 4,
        year: 2027,
        ccUsageLimit: 900_000,
        paylaterUsageLimit: 1_500_000,
        saveAsGlobalDefault: true,
      });

      expect(updated.isSnapshotPersisted).toBe(true);
      expect(updated.snapshotStatus).toBe('DRAFT');
      expect(updated.ccEvaluation.limit).toBe(900_000);
      expect(updated.paylaterEvaluation.limit).toBe(1_500_000);

      // Verify GlobalConfig was also updated because saveAsGlobalDefault = true
      const config = await prisma.globalConfig.findFirstOrThrow();
      expect(config.ccUsageLimit).toBe(900_000);
      expect(config.paylaterUsageLimit).toBe(1_500_000);

      // Crucial: AuditSelectors.listHistoricalSnapshots must NOT include 4/2027 yet
      // because it has totalWorkingDays === 0 and zero transactions/revisions
      const historical = await auditSelectors.listHistoricalSnapshots();
      expect(historical.find((s) => s.month === 4 && s.year === 2027)).toBeUndefined();
    });

    it('rejects updateCreditUsageLimit when target period is LOCKED and prevents retroactive GlobalConfig inheritance on LOCKED snapshots', async () => {
      // Create a LOCKED snapshot for 7/2026 with frozen limits (0 / 0)
      await prisma.monthlySnapshot.create({
        data: {
          month: 7,
          year: 2026,
          status: SnapshotStatus.LOCKED,
          totalWorkingDays: 20,
          finalTotalIncome: 10_000_000,
          ccUsageLimit: 0,
          paylaterUsageLimit: 0,
        },
      });

      // 1. Attempting to mutate a LOCKED snapshot's credit limits must throw BadRequestException
      await expect(
        service.updateCreditUsageLimit({
          month: 7,
          year: 2026,
          ccUsageLimit: 500_000,
        }),
      ).rejects.toThrow(BadRequestException);

      // 2. Updating GlobalConfig credit limits (via another period with saveAsGlobalDefault)
      // must NOT retroactively change 7/2026's frozen limits
      await service.updateCreditUsageLimit({
        month: 10,
        year: 2026,
        ccUsageLimit: 800_000,
        paylaterUsageLimit: 1_200_000,
        saveAsGlobalDefault: true,
      });

      const lockedReport = await selectors.getCreditUsageLimit(7, 2026);
      expect(lockedReport.snapshotStatus).toBe('LOCKED');
      expect(lockedReport.ccEvaluation.limit).toBe(0);
      expect(lockedReport.paylaterEvaluation.limit).toBe(0);
      expect(lockedReport.ccEvaluation.status).toBe('UNSET');
      expect(lockedReport.paylaterEvaluation.status).toBe('UNSET');
    });

    it('records a WARNING CREDIT_LIMIT_EXCEEDED AuditLog entry when a new CC charge or BulkBill breaches the configured period limit', async () => {
      // Configure a Rp 500,000 CC limit and Rp 1,000,000 PayLater limit on 9/2026
      await service.updateCreditUsageLimit({
        month: 9,
        year: 2026,
        ccUsageLimit: 500_000,
        paylaterUsageLimit: 1_000_000,
      });

      // Log a CC charge of Rp 650,000 billing into 9/2026 (breaches 500k limit)
      await service.createCardTransaction({
        label: 'Flight Ticket',
        amount: 650_000,
        transactionDate: '2026-09-10',
        chargeType: CreditCardChargeType.FULL,
      });

      // Log a PayLater bulk bill of Rp 1,300,000 for 9/2026 (breaches 1M limit)
      await service.createBulkBill({
        label: 'Monthly Bulk Bill',
        month: 9,
        year: 2026,
        paylaterAmount: 1_300_000,
      });

      const breachLogs = await prisma.auditLog.findMany({
        where: {
          action: 'CREDIT_LIMIT_EXCEEDED',
          month: 9,
          year: 2026,
        },
      });

      expect(breachLogs).toHaveLength(2);
      expect(breachLogs.every((l) => l.severity === 'WARNING')).toBe(true);
    });
  });

  describe('Recurring Subscription — Stop & Resume Controls', () => {
    it('stops recurring subscription from a future month, zeroing future billings while preserving prior months', async () => {
      // Create a recurring monthly subscription (e.g. Netflix Rp 186,000)
      const sub = await service.createCardTransaction({
        label: 'Netflix Premium',
        amount: 186_000,
        transactionDate: '2026-08-15',
        chargeType: CreditCardChargeType.RECURRING,
      });

      expect(sub.isActive).toBe(true);
      expect(sub.stoppedAtMonth).toBeNull();
      expect(sub.stoppedAtYear).toBeNull();

      // Check due amount across months 9, 10, 11, 12 before stop
      const dueM9Before = await selectors.getCardSummary(9, 2026);
      const dueM10Before = await selectors.getCardSummary(10, 2026);
      const dueM11Before = await selectors.getCardSummary(11, 2026);
      expect(dueM9Before.currentCycleDue).toBe(186_000);
      expect(dueM10Before.currentCycleDue).toBe(186_000);
      expect(dueM11Before.currentCycleDue).toBe(186_000);

      // Stop subscription starting from month 11/2026
      const stopped = await service.stopRecurringSubscription(sub.id, 11, 2026);
      expect(stopped.isActive).toBe(false);
      expect(stopped.stoppedAtMonth).toBe(11);
      expect(stopped.stoppedAtYear).toBe(2026);

      // Verify prior months (9 & 10) still calculate Rp 186,000
      const dueM9After = await selectors.getCardSummary(9, 2026);
      const dueM10After = await selectors.getCardSummary(10, 2026);
      expect(dueM9After.currentCycleDue).toBe(186_000);
      expect(dueM10After.currentCycleDue).toBe(186_000);

      // Verify stopped month (11) and future month (12) drop to Rp 0
      const dueM11After = await selectors.getCardSummary(11, 2026);
      const dueM12After = await selectors.getCardSummary(12, 2026);
      expect(dueM11After.currentCycleDue).toBe(0);
      expect(dueM12After.currentCycleDue).toBe(0);

      // Resume subscription
      const resumed = await service.resumeRecurringSubscription(sub.id);
      expect(resumed.isActive).toBe(true);
      expect(resumed.stoppedAtMonth).toBeNull();
      expect(resumed.stoppedAtYear).toBeNull();

      // Verify months 11 & 12 calculate Rp 186,000 again
      const dueM11Resumed = await selectors.getCardSummary(11, 2026);
      const dueM12Resumed = await selectors.getCardSummary(12, 2026);
      expect(dueM11Resumed.currentCycleDue).toBe(186_000);
      expect(dueM12Resumed.currentCycleDue).toBe(186_000);
    });
  });
});
