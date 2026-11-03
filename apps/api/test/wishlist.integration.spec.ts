/**
 * wishlist.integration.spec.ts
 *
 * Integration tests for the wishlist domain module:
 * 1. CRUD: WishlistItem creation, filtering by status, priority sorting, update, deletion.
 * 2. Pre-purchase simulation (analyzePurchase):
 *    - Cash strategy: INSTANT_EXECUTION when selfReward balance >= price vs SAVING_REQUIRED shortfall with monthsToSave.
 *    - Installment strategy boundary tests across 3 tiers:
 *      * OPTIMAL (peak debt ratio <= 20%)
 *      * MANAGEABLE (peak debt ratio > 20% and <= 35%)
 *      * HIGH_RISK (peak debt ratio > 35%)
 *    - monthlyPayment precedence over interestPercent (interestPercent is informational only).
 *    - Fallback to price / tenor when monthlyPayment is omitted.
 * 3. convertToContract:
 *    - Atomic creation of CreditContract and status update to PURCHASED.
 *    - AuditLog journal recording (action: WISHLIST_CONVERTED, category: LIABILITIES).
 *    - Rejection of CASH items and already-PURCHASED items.
 *
 * Sequential execution via maxWorkers: 1.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { WishlistModule } from '../src/wishlist/wishlist.module';
import { WishlistService } from '../src/wishlist/wishlist.service';
import { WishlistSelectors } from '../src/wishlist/wishlist.selectors';
import { SnapshotsModule } from '../src/snapshots/snapshots.module';
import { SnapshotsSelectors } from '../src/snapshots/snapshots.selectors';
import { ConfigModule } from '../src/config/config.module';
import { AuditModule } from '../src/audit/audit.module';
import {
  WishlistFundingType,
  WishlistStatus,
  AuditCategory,
  AuditSeverity,
} from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

async function cleanAll(prisma: PrismaService) {
  await prisma.wishlistItem.deleteMany();
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
    },
  });
}

describe('Wishlist — integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let wishlistService: WishlistService;
  let wishlistSelectors: WishlistSelectors;
  let snapshotsSelectors: SnapshotsSelectors;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        PrismaModule,
        ConfigModule,
        SnapshotsModule,
        AuditModule,
        WishlistModule,
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    wishlistService = module.get<WishlistService>(WishlistService);
    wishlistSelectors = module.get<WishlistSelectors>(WishlistSelectors);
    snapshotsSelectors = module.get<SnapshotsSelectors>(SnapshotsSelectors);
  });

  beforeEach(async () => {
    await cleanAll(prisma);
  });

  afterAll(async () => {
    await cleanAll(prisma);
    await module.close();
  });

  describe('CRUD operations', () => {
    it('creates a wishlist item with all fields and retrieves it', async () => {
      const item = await wishlistService.createItem({
        name: 'Mechanical Keyboard',
        price: 1_800_000,
        fundingType: WishlistFundingType.INSTALLMENT,
        provider: 'Tokopedia Card',
        tenor: 6,
        monthlyPayment: 300_000,
        interestPercent: 0,
        targetMonth: 10,
        targetYear: 2026,
        status: WishlistStatus.PLANNING,
        notes: 'Wireless 75%',
        priority: 2,
      });

      expect(item.id).toBeDefined();
      expect(item.name).toBe('Mechanical Keyboard');
      expect(item.price).toBe(1_800_000);
      expect(item.fundingType).toBe(WishlistFundingType.INSTALLMENT);
      expect(item.monthlyPayment).toBe(300_000);
      expect(item.priority).toBe(2);

      const found = await wishlistSelectors.getItemById(item.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Mechanical Keyboard');
    });

    it('filters items by status and orders by priority descending', async () => {
      await wishlistService.createItem({
        name: 'Item Low Priority',
        price: 500_000,
        priority: 1,
        status: WishlistStatus.PLANNING,
      });

      await wishlistService.createItem({
        name: 'Item High Priority',
        price: 1_000_000,
        priority: 5,
        status: WishlistStatus.PLANNING,
      });

      await wishlistService.createItem({
        name: 'Item Ready',
        price: 2_000_000,
        priority: 3,
        status: WishlistStatus.READY,
      });

      const planningItems = await wishlistSelectors.listItems(
        WishlistStatus.PLANNING,
      );
      expect(planningItems).toHaveLength(2);
      expect(planningItems[0].name).toBe('Item High Priority');
      expect(planningItems[1].name).toBe('Item Low Priority');

      const readyItems = await wishlistSelectors.listItems(WishlistStatus.READY);
      expect(readyItems).toHaveLength(1);
      expect(readyItems[0].name).toBe('Item Ready');
    });

    it('updates an existing item and deletes it', async () => {
      const item = await wishlistService.createItem({
        name: 'Desk Mat',
        price: 250_000,
        fundingType: WishlistFundingType.CASH,
      });

      const updated = await wishlistService.updateItem(item.id, {
        price: 300_000,
        status: WishlistStatus.READY,
      });
      expect(updated.price).toBe(300_000);
      expect(updated.status).toBe(WishlistStatus.READY);

      const deleted = await wishlistService.deleteItem(item.id);
      expect(deleted.id).toBe(item.id);

      const found = await wishlistSelectors.getItemById(item.id);
      expect(found).toBeNull();
    });
  });

  describe('analyzePurchase — simulation engine', () => {
    it('returns INSTANT_EXECUTION for cash item when self-reward balance exceeds price', async () => {
      // Create draft snapshot for Oct 2026 with selfReward = 2,500,000
      const snapshot = await snapshotsSelectors.getOrCreateDraftSnapshot(
        10,
        2026,
      );
      await prisma.monthlySnapshot.update({
        where: { id: snapshot.id },
        data: {
          selfReward: 2_500_000,
          selfRewardTarget: 500_000,
          netSalaryIncome: 10_000_000,
        },
      });

      const analysis = await wishlistService.analyzePurchase(
        {
          price: 1_500_000,
          fundingType: WishlistFundingType.CASH,
        },
        10,
        2026,
      );

      expect(analysis.cashStrategy.tier).toBe('INSTANT_EXECUTION');
      expect(analysis.cashStrategy.shortfall).toBe(0);
      expect(analysis.cashStrategy.estimatedMonthsToSave).toBe(0);
      expect(analysis.cashStrategy.currentSelfReward).toBe(2_500_000);
      expect(analysis.installmentStrategy).toBeUndefined();
    });

    it('returns SAVING_REQUIRED with shortfall when cash is insufficient without installment projection', async () => {
      const snapshot = await snapshotsSelectors.getOrCreateDraftSnapshot(
        10,
        2026,
      );
      await prisma.monthlySnapshot.update({
        where: { id: snapshot.id },
        data: {
          selfReward: 500_000,
          selfRewardTarget: 500_000,
          netSalaryIncome: 10_000_000,
        },
      });

      const analysis = await wishlistService.analyzePurchase(
        {
          price: 3_000_000,
          fundingType: WishlistFundingType.CASH,
          tenor: 6,
        },
        10,
        2026,
      );

      expect(analysis.cashStrategy.tier).toBe('SAVING_REQUIRED');
      expect(analysis.cashStrategy.shortfall).toBe(2_500_000);
      expect(analysis.cashStrategy.estimatedMonthsToSave).toBe(5); // 2.5M / 500k
      expect(analysis.installmentStrategy).toBeUndefined();
    });

    it('classifies exact boundary value of 20.00% peak debt ratio as OPTIMAL (not MANAGEABLE)', async () => {
      const snapshot = await snapshotsSelectors.getOrCreateDraftSnapshot(
        10,
        2026,
      );
      await prisma.monthlySnapshot.update({
        where: { id: snapshot.id },
        data: { netSalaryIncome: 10_000_000, finalTotalIncome: 10_000_000 },
      });

      // Existing active contract: 1,000,000 / month (10.00% debt ratio)
      await prisma.creditContract.create({
        data: {
          label: 'Existing Contract',
          principalAmount: 12_000_000,
          monthlyInstallment: 1_000_000,
          totalTenor: 12,
          remainingTenor: 10,
          startMonth: 1,
          startYear: 2026,
          isActive: true,
        },
      });

      // New payment: 1,000,000 -> Total debt: 2,000,000 -> EXACTLY 20.00%
      const analysis = await wishlistService.analyzePurchase(
        {
          price: 6_000_000,
          fundingType: WishlistFundingType.INSTALLMENT,
          tenor: 6,
          monthlyPayment: 1_000_000,
        },
        10,
        2026,
      );

      expect(analysis.installmentStrategy?.peakDebtRatio).toBe(20);
      expect(analysis.installmentStrategy?.tier).toBe('OPTIMAL');
    });

    it('classifies 20.01% peak debt ratio as MANAGEABLE (strictly above 20.00% boundary)', async () => {
      const snapshot = await snapshotsSelectors.getOrCreateDraftSnapshot(
        10,
        2026,
      );
      await prisma.monthlySnapshot.update({
        where: { id: snapshot.id },
        data: { netSalaryIncome: 10_000_000, finalTotalIncome: 10_000_000 },
      });

      await prisma.creditContract.create({
        data: {
          label: 'Existing Contract',
          principalAmount: 12_000_000,
          monthlyInstallment: 1_000_000,
          totalTenor: 12,
          remainingTenor: 10,
          startMonth: 1,
          startYear: 2026,
          isActive: true,
        },
      });

      // New payment: 1,001,000 -> Total debt: 2,001,000 -> EXACTLY 20.01%
      const analysis = await wishlistService.analyzePurchase(
        {
          price: 6_006_000,
          fundingType: WishlistFundingType.INSTALLMENT,
          tenor: 6,
          monthlyPayment: 1_001_000,
        },
        10,
        2026,
      );

      expect(analysis.installmentStrategy?.peakDebtRatio).toBe(20.01);
      expect(analysis.installmentStrategy?.tier).toBe('MANAGEABLE');
    });

    it('classifies exact boundary value of 35.00% peak debt ratio as MANAGEABLE (not HIGH_RISK)', async () => {
      const snapshot = await snapshotsSelectors.getOrCreateDraftSnapshot(
        10,
        2026,
      );
      await prisma.monthlySnapshot.update({
        where: { id: snapshot.id },
        data: { netSalaryIncome: 10_000_000, finalTotalIncome: 10_000_000 },
      });

      await prisma.creditContract.create({
        data: {
          label: 'Existing Contract',
          principalAmount: 12_000_000,
          monthlyInstallment: 1_000_000,
          totalTenor: 12,
          remainingTenor: 10,
          startMonth: 1,
          startYear: 2026,
          isActive: true,
        },
      });

      // New payment: 2,500,000 -> Total debt: 3,500,000 -> EXACTLY 35.00%
      const analysis = await wishlistService.analyzePurchase(
        {
          price: 15_000_000,
          fundingType: WishlistFundingType.INSTALLMENT,
          tenor: 6,
          monthlyPayment: 2_500_000,
        },
        10,
        2026,
      );

      expect(analysis.installmentStrategy?.peakDebtRatio).toBe(35);
      expect(analysis.installmentStrategy?.tier).toBe('MANAGEABLE');
    });

    it('classifies 35.01% peak debt ratio as HIGH_RISK (strictly above 35.00% boundary)', async () => {
      const snapshot = await snapshotsSelectors.getOrCreateDraftSnapshot(
        10,
        2026,
      );
      await prisma.monthlySnapshot.update({
        where: { id: snapshot.id },
        data: { netSalaryIncome: 10_000_000, finalTotalIncome: 10_000_000 },
      });

      await prisma.creditContract.create({
        data: {
          label: 'Existing Contract',
          principalAmount: 12_000_000,
          monthlyInstallment: 1_000_000,
          totalTenor: 12,
          remainingTenor: 10,
          startMonth: 1,
          startYear: 2026,
          isActive: true,
        },
      });

      // New payment: 2,501,000 -> Total debt: 3,501,000 -> EXACTLY 35.01%
      const analysis = await wishlistService.analyzePurchase(
        {
          price: 15_006_000,
          fundingType: WishlistFundingType.INSTALLMENT,
          tenor: 6,
          monthlyPayment: 2_501_000,
        },
        10,
        2026,
      );

      expect(analysis.installmentStrategy?.peakDebtRatio).toBe(35.01);
      expect(analysis.installmentStrategy?.tier).toBe('HIGH_RISK');
    });

    it('respects monthlyPayment precedence: user-provided monthlyPayment is authoritative and interestPercent is informational', async () => {
      const snapshot = await snapshotsSelectors.getOrCreateDraftSnapshot(
        10,
        2026,
      );
      await prisma.monthlySnapshot.update({
        where: { id: snapshot.id },
        data: { netSalaryIncome: 10_000_000, finalTotalIncome: 10_000_000 },
      });

      // User enters monthlyPayment = 850,000 even though price=5M and tenor=6 and interestPercent=2.5%
      // 850,000 must be used directly without recalculation.
      const analysis = await wishlistService.analyzePurchase(
        {
          price: 5_000_000,
          fundingType: WishlistFundingType.INSTALLMENT,
          tenor: 6,
          monthlyPayment: 850_000,
          interestPercent: 2.5,
        },
        10,
        2026,
      );

      expect(analysis.installmentStrategy?.newMonthlyInstallment).toBe(850_000);
      expect(analysis.installmentStrategy?.peakDebtRatio).toBe(8.5); // 850k / 10M = 8.5%
    });

    it('falls back to price / tenor when monthlyPayment is omitted', async () => {
      const snapshot = await snapshotsSelectors.getOrCreateDraftSnapshot(
        10,
        2026,
      );
      await prisma.monthlySnapshot.update({
        where: { id: snapshot.id },
        data: { netSalaryIncome: 10_000_000, finalTotalIncome: 10_000_000 },
      });

      const analysis = await wishlistService.analyzePurchase(
        {
          price: 6_000_000,
          fundingType: WishlistFundingType.INSTALLMENT,
          tenor: 3,
        },
        10,
        2026,
      );

      // 6M / 3 = 2,000,000
      expect(analysis.installmentStrategy?.newMonthlyInstallment).toBe(2_000_000);
      expect(analysis.installmentStrategy?.peakDebtRatio).toBe(20);
    });
  });

  describe('convertToContract', () => {
    it('atomically creates CreditContract, marks item PURCHASED, and records AuditLog', async () => {
      const item = await wishlistService.createItem({
        name: 'Ergonomic Chair',
        price: 4_200_000,
        fundingType: WishlistFundingType.INSTALLMENT,
        provider: 'BCA CC',
        tenor: 6,
        monthlyPayment: 700_000,
        targetMonth: 10,
        targetYear: 2026,
        status: WishlistStatus.PLANNING,
      });

      const conversion = await wishlistService.convertToContract(item.id);

      expect(conversion.contract.id).toBeDefined();
      expect(conversion.contract.label).toBe('Ergonomic Chair');
      expect(conversion.contract.principalAmount).toBe(4_200_000);
      expect(conversion.contract.monthlyInstallment).toBe(700_000);
      expect(conversion.contract.totalTenor).toBe(6);
      expect(conversion.contract.remainingTenor).toBe(6);
      expect(conversion.contract.startMonth).toBe(10);
      expect(conversion.contract.startYear).toBe(2026);
      expect(conversion.contract.isActive).toBe(true);

      // WishlistItem status updated to PURCHASED
      const updatedItem = await wishlistSelectors.getItemById(item.id);
      expect(updatedItem?.status).toBe(WishlistStatus.PURCHASED);

      // AuditLog recorded
      const logs = await prisma.auditLog.findMany({
        where: { action: 'WISHLIST_CONVERTED' },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].category).toBe(AuditCategory.LIABILITIES);
      expect(logs[0].severity).toBe(AuditSeverity.INFO);
      expect(logs[0].summary).toContain('Ergonomic Chair');
    });

    it('enforces atomicity: if wishlistItem update fails after contract creation, rolls back transaction leaving no orphaned CreditContract and keeping WishlistItem status unchanged', async () => {
      const item = await wishlistService.createItem({
        name: '4K Monitor',
        price: 8_500_000,
        fundingType: WishlistFundingType.INSTALLMENT,
        provider: 'Tokopedia Card',
        tenor: 6,
        monthlyPayment: 1_450_000,
        status: WishlistStatus.PLANNING,
      });

      // Intercept the real interactive transaction to simulate failure after contract creation
      const realTransaction = prisma.$transaction.bind(prisma);
      jest
        .spyOn(prisma, '$transaction')
        .mockImplementationOnce(async (callback: any) => {
          return realTransaction(async (tx) => {
            // Mock tx.wishlistItem.update to throw an unexpected database error
            tx.wishlistItem.update = jest.fn().mockImplementation(() => {
              throw new Error(
                'Simulated database error during wishlistItem update',
              );
            });
            return callback(tx);
          });
        });

      await expect(
        wishlistService.convertToContract(item.id),
      ).rejects.toThrow('Simulated database error during wishlistItem update');

      // 1. WishlistItem.status remains unchanged (PLANNING, NOT PURCHASED)
      const freshItem = await wishlistSelectors.getItemById(item.id);
      expect(freshItem?.status).toBe(WishlistStatus.PLANNING);

      // 2. No orphaned CreditContract was persisted (rolled back by Postgres)
      const contracts = await prisma.creditContract.findMany({
        where: { label: '4K Monitor' },
      });
      expect(contracts).toHaveLength(0);

      // 3. No AuditLog entry was recorded
      const logs = await prisma.auditLog.findMany({
        where: { action: 'WISHLIST_CONVERTED' },
      });
      expect(logs).toHaveLength(0);
    });

    it('enforces atomicity: if creditContract creation fails, rolls back transaction and keeps WishlistItem status unchanged', async () => {
      const item = await wishlistService.createItem({
        name: 'Noise Cancelling Headphones',
        price: 4_000_000,
        fundingType: WishlistFundingType.INSTALLMENT,
        provider: 'BCA CC',
        tenor: 12,
        monthlyPayment: 350_000,
        status: WishlistStatus.PLANNING,
      });

      const realTransaction = prisma.$transaction.bind(prisma);
      jest
        .spyOn(prisma, '$transaction')
        .mockImplementationOnce(async (callback: any) => {
          return realTransaction(async (tx) => {
            tx.creditContract.create = jest.fn().mockImplementation(() => {
              throw new Error(
                'Simulated database constraint violation during contract creation',
              );
            });
            return callback(tx);
          });
        });

      await expect(
        wishlistService.convertToContract(item.id),
      ).rejects.toThrow(
        'Simulated database constraint violation during contract creation',
      );

      // 1. WishlistItem.status remains unchanged
      const freshItem = await wishlistSelectors.getItemById(item.id);
      expect(freshItem?.status).toBe(WishlistStatus.PLANNING);

      // 2. No CreditContract was created
      const contracts = await prisma.creditContract.findMany({
        where: { label: 'Noise Cancelling Headphones' },
      });
      expect(contracts).toHaveLength(0);

      // 3. No AuditLog entry was recorded
      const logs = await prisma.auditLog.findMany({
        where: { action: 'WISHLIST_CONVERTED' },
      });
      expect(logs).toHaveLength(0);
    });

    it('rejects conversion if item has fundingType CASH', async () => {
      const cashItem = await wishlistService.createItem({
        name: 'Coffee Grinder',
        price: 800_000,
        fundingType: WishlistFundingType.CASH,
      });

      await expect(
        wishlistService.convertToContract(cashItem.id),
      ).rejects.toThrow(BadRequestException);

      // Ensure item is not altered
      const item = await wishlistSelectors.getItemById(cashItem.id);
      expect(item?.status).toBe(WishlistStatus.PLANNING);
    });

    it('rejects conversion if item is already PURCHASED', async () => {
      const purchasedItem = await wishlistService.createItem({
        name: 'Standing Desk',
        price: 3_500_000,
        fundingType: WishlistFundingType.INSTALLMENT,
        status: WishlistStatus.PURCHASED,
        tenor: 6,
      });

      await expect(
        wishlistService.convertToContract(purchasedItem.id),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if item does not exist', async () => {
      await expect(wishlistService.convertToContract(999999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // trackAsSavingsGoal
  // -------------------------------------------------------------------------

  describe('trackAsSavingsGoal', () => {
    it('creates a linked SavingsGoal and links savingsGoalId on the WishlistItem', async () => {
      const item = await wishlistService.createItem({
        name: '4K Monitor 27 inch',
        price: 4_500_000,
        fundingType: WishlistFundingType.CASH,
        targetMonth: 12,
        targetYear: 2026,
      });

      const goal = await wishlistService.trackAsSavingsGoal(item.id);

      expect(goal).toBeDefined();
      expect(goal.name).toBe('4K Monitor 27 inch');
      expect(goal.targetAmount).toBe(4_500_000);
      expect(goal.wishlistItemId).toBe(item.id);

      const refreshedItem = await prisma.wishlistItem.findUniqueOrThrow({
        where: { id: item.id },
      });
      expect(refreshedItem.savingsGoalId).toBe(goal.id);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'WISHLIST_TRACKED_AS_SAVINGS_GOAL' },
      });
      expect(audit).toBeDefined();
      expect(audit?.summary).toContain('Linked wishlist item');
    });

    it('rejects tracking non-existent wishlist item', async () => {
      await expect(wishlistService.trackAsSavingsGoal(999999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
