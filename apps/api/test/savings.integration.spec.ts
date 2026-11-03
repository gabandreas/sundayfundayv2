/**
 * savings.integration.spec.ts
 * Integration tests for the savings module (vault balance + CRUD).
 * Requires the Postgres container to be running (port 5433).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SavingsService } from '../src/savings/savings.service';
import { SavingsSelectors } from '../src/savings/savings.selectors';
import { SavingsTransactionType } from '../src/savings/dto/create-savings-transaction.dto';
import { AuditModule } from '../src/audit/audit.module';

async function cleanSavings(prisma: PrismaService) {
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.savingsGoal.deleteMany();
  await prisma.savingsManualTransaction.deleteMany();
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
      profileMode: 'SUPERADMIN_BESPOKE',
    },
  });
}

describe('Savings — integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let service: SavingsService;
  let selectors: SavingsSelectors;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule, AuditModule],
      providers: [SavingsService, SavingsSelectors],
    }).compile();

    prisma = module.get(PrismaService);
    service = module.get(SavingsService);
    selectors = module.get(SavingsSelectors);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    await cleanSavings(prisma);
  });

  afterEach(async () => {
    await cleanSavings(prisma);
  });

  // -------------------------------------------------------------------------
  // getVault
  // -------------------------------------------------------------------------

  describe('getVault', () => {
    it('returns balance=0 and empty list when no transactions exist', async () => {
      const vault = await selectors.getVault();

      expect(vault.balance).toBe(0);
      expect(vault.transactions).toHaveLength(0);
    });

    it('calculates vault balance as sum of signed amounts', async () => {
      await service.createTransaction({
        type: SavingsTransactionType.TOPUP,
        amount: 1_000_000,
        label: 'Initial deposit',
        date: '2025-09-01',
      });
      await service.createTransaction({
        type: SavingsTransactionType.WITHDRAWAL,
        amount: 200_000,
        label: 'Emergency',
        date: '2025-09-10',
      });

      const vault = await selectors.getVault();

      // 1_000_000 - 200_000 = 800_000
      expect(vault.balance).toBe(800_000);
      expect(vault.transactions).toHaveLength(2);
      expect(vault.monthlyLivingExpenseBaseline).toBeGreaterThan(0);
      expect(vault.runwayMonths).toBeDefined();
      expect(vault.milestones).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // createTransaction
  // -------------------------------------------------------------------------

  describe('createTransaction', () => {
    it('stores TOPUP as a positive amount', async () => {
      const tx = await service.createTransaction({
        type: SavingsTransactionType.TOPUP,
        amount: 500_000,
        label: 'Top-up',
        date: '2025-09-01',
      });

      expect(tx.amount).toBe(500_000);
    });

    it('stores WITHDRAWAL as a negative amount', async () => {
      const tx = await service.createTransaction({
        type: SavingsTransactionType.WITHDRAWAL,
        amount: 300_000,
        label: 'Withdrawal',
        date: '2025-09-05',
      });

      expect(tx.amount).toBe(-300_000);
    });

    it('multiple TOPUPs accumulate correctly in vault balance', async () => {
      await service.createTransaction({
        type: SavingsTransactionType.TOPUP,
        amount: 2_000_000,
        label: 'Salary transfer',
        date: '2025-09-01',
      });
      await service.createTransaction({
        type: SavingsTransactionType.TOPUP,
        amount: 500_000,
        label: 'Bonus',
        date: '2025-09-15',
      });

      const vault = await selectors.getVault();
      expect(vault.balance).toBe(2_500_000);
    });
  });

  // -------------------------------------------------------------------------
  // deleteTransaction
  // -------------------------------------------------------------------------

  describe('deleteTransaction', () => {
    it('deletes an existing transaction and updates vault balance', async () => {
      const tx = await service.createTransaction({
        type: SavingsTransactionType.TOPUP,
        amount: 1_000_000,
        label: 'To delete',
        date: '2025-09-01',
      });

      await service.deleteTransaction(tx.id);

      const vault = await selectors.getVault();
      expect(vault.balance).toBe(0);
      expect(vault.transactions).toHaveLength(0);
    });

    it('throws NotFoundException when deleting a non-existent transaction', async () => {
      await expect(service.deleteTransaction(999_999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('retroactive locked period P1 savings reconciliation & deterministic attribution', () => {
    it('detects untransferredLockedPeriods and reconciles them even when user customizes label with periodMonth/periodYear', async () => {
      // Seed a LOCKED snapshot for 7/2026 with actualSavings = 500,000
      await prisma.monthlySnapshot.create({
        data: {
          month: 7,
          year: 2026,
          status: 'LOCKED',
          totalWorkingDays: 20,
          finalTotalIncome: 5_891_000,
          savings: 500_000,
          actualSavings: 500_000,
        },
      });

      const vaultBefore = await selectors.getVault();
      expect(vaultBefore.untransferredLockedPeriods).toHaveLength(1);
      expect(vaultBefore.untransferredLockedPeriods[0]).toMatchObject({
        month: 7,
        year: 2026,
        actualSavings: 500_000,
        transferredAmount: 0,
        untransferredAmount: 500_000,
      });

      // User reconciles 7/2026 with a customized label that omits "(7/2026)"
      const created = await service.createTransaction({
        type: SavingsTransactionType.TOPUP,
        amount: 500_000,
        label: 'Retroactive July Savings Sweep',
        date: '2026-10-25',
        periodMonth: 7,
        periodYear: 2026,
      });

      // Deterministic attribution tag (7/2026) is preserved automatically
      expect(created.label).toBe('Retroactive July Savings Sweep (7/2026)');

      const vaultAfter = await selectors.getVault();
      expect(vaultAfter.periodDepositsByPeriod['2026-7']).toBe(500_000);
      expect(vaultAfter.untransferredLockedPeriods).toHaveLength(0);
    });
  });

  describe('Savings Overview & Accumulation Ledger', () => {
    it('computes accumulation ledger across snapshots and handles 1-click confirmPeriodDeposit', async () => {
      // Seed snapshots for 7/2026 and 8/2026
      await prisma.monthlySnapshot.create({
        data: {
          month: 7,
          year: 2026,
          status: 'LOCKED',
          totalWorkingDays: 20,
          finalTotalIncome: 5_891_000,
          savings: 500_000,
          actualSavings: 500_000,
        },
      });

      await prisma.monthlySnapshot.create({
        data: {
          month: 8,
          year: 2026,
          status: 'LOCKED',
          totalWorkingDays: 20,
          finalTotalIncome: 5_881_400,
          savings: 500_000,
          actualSavings: 500_000,
        },
      });

      const overviewBefore = await selectors.getOverview();
      expect(overviewBefore.accumulationLedger).toHaveLength(2);
      expect(overviewBefore.kpi.totalPlanned2026P1).toBe(1_000_000);
      expect(overviewBefore.kpi.totalVaultBalance).toBe(0);
      expect(overviewBefore.accumulationLedger[0].isFullyDeposited).toBe(false);
      expect(overviewBefore.accumulationLedger[0].pendingTransfer).toBe(500_000);

      // 1-Click deposit confirmation into Liquid Emergency Cash
      const depositResult = await service.confirmPeriodDeposit({
        periodMonth: 7,
        periodYear: 2026,
        amount: 500_000,
        destination: 'EMERGENCY_CASH',
        note: 'July P1 Allocation Sweep',
      });

      expect(depositResult.amount).toBe(500_000);
      expect(depositResult.label).toContain('(7/2026)');

      const overviewAfter = await selectors.getOverview();
      expect(overviewAfter.kpi.totalVaultBalance).toBe(500_000);
      const julyItem = overviewAfter.accumulationLedger.find((l) => l.month === 7 && l.year === 2026);
      expect(julyItem?.isFullyDeposited).toBe(true);
      expect(julyItem?.depositedAmount).toBe(500_000);
      expect(julyItem?.pendingTransfer).toBe(0);
    });
  });

  describe('Savings Goals CRUD & Projections', () => {
    it('creates, updates, calculates projections, and deletes a savings goal', async () => {
      // Create a savings goal (e.g. MacBook Pro M4: Rp 24,000,000 target by Dec 2026)
      const goal = await service.createGoal({
        name: 'MacBook Pro M4',
        targetAmount: 24_000_000,
        currentAllocatedAmount: 6_000_000,
        targetMonth: 12,
        targetYear: 2026,
        category: 'Tech Upgrade',
      });

      expect(goal.id).toBeDefined();
      expect(goal.targetAmount).toBe(24_000_000);
      expect(goal.currentAllocatedAmount).toBe(6_000_000);

      // Verify enriched projections in getGoals()
      const goals = await selectors.getGoals();
      expect(goals).toHaveLength(1);
      const enriched = goals[0];
      expect(enriched.remainingNeeded).toBe(18_000_000);
      expect(enriched.progressPercent).toBe(25);
      expect(enriched.monthsUntilTarget).toBeGreaterThanOrEqual(1);
      expect(enriched.requiredMonthlyContribution).toBeGreaterThan(0);

      // Update goal allocated amount
      const updated = await service.updateGoal(goal.id, {
        currentAllocatedAmount: 12_000_000,
      });
      expect(updated.currentAllocatedAmount).toBe(12_000_000);

      const goalsAfterUpdate = await selectors.getGoals();
      expect(goalsAfterUpdate[0].remainingNeeded).toBe(12_000_000);
      expect(goalsAfterUpdate[0].progressPercent).toBe(50);

      // Delete goal
      await service.deleteGoal(goal.id);
      const goalsAfterDelete = await selectors.getGoals();
      expect(goalsAfterDelete).toHaveLength(0);
    });
  });
});
