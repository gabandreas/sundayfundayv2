/**
 * snapshots.integration.spec.ts
 *
 * Integration tests for the snapshots module. These run against a real PostgreSQL
 * instance (host port 5433 — see PROGRESS.md). Docker must be up before running:
 *
 *   docker compose up -d
 *   npm run test:e2e --workspace=apps/api -- --testPathPattern=snapshots.integration
 *
 * All tests share one PrismaService connection; each test suite cleans its own
 * data via afterEach to avoid ordering dependencies between test files.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaModule } from '../src/prisma/prisma.module';
import { SnapshotsService } from '../src/snapshots/snapshots.service';
import { SnapshotsSelectors } from '../src/snapshots/snapshots.selectors';
import { AuditModule } from '../src/audit/audit.module';
import { CreditModule } from '../src/credit/credit.module';
import {
  SnapshotStatus,
  TransactionType,
  BudgetRevisionCategory,
  AuditCategory,
  AuditSeverity,
} from '@prisma/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal GlobalConfig row — the selectors require one to exist. */
async function seedConfig(prisma: PrismaService) {
  return prisma.globalConfig.upsert({
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

/** Seed a MonthlySnapshot with the given status (defaults DRAFT). */
async function seedSnapshot(
  prisma: PrismaService,
  month: number,
  year: number,
  status: SnapshotStatus = SnapshotStatus.DRAFT,
) {
  return prisma.monthlySnapshot.create({
    data: {
      month,
      year,
      status,
      totalWorkingDays: 22,
      dailyOperational: 100_000,
      transport: 200_000,
      internet: 150_000,
      vape: 100_000,
      haircut: 50_000,
      savings: 500_000,
    },
  });
}

/** Delete all rows that could interfere between test blocks. */
async function cleanAll(prisma: PrismaService) {
  await prisma.auditLog.deleteMany();
  await prisma.budgetRevision.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.monthlySnapshot.deleteMany();
  await prisma.monthlyBulkBill.deleteMany();
  await prisma.creditCardTransaction.deleteMany();
  await prisma.creditContract.deleteMany();
  await prisma.globalConfig.deleteMany();
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

describe('Snapshots — integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let service: SnapshotsService;
  let selectors: SnapshotsSelectors;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule, AuditModule, CreditModule],
      providers: [SnapshotsService, SnapshotsSelectors],
    }).compile();

    prisma = module.get(PrismaService);
    service = module.get(SnapshotsService);
    selectors = module.get(SnapshotsSelectors);
  });

  afterAll(async () => {
    await module.close();
  });

  afterEach(async () => {
    await cleanAll(prisma);
  });

  // -------------------------------------------------------------------------
  // getOrCreateDraftSnapshot
  // -------------------------------------------------------------------------

  describe('getOrCreateDraftSnapshot', () => {
    it('creates a new DRAFT snapshot when none exists for (month, year)', async () => {
      await seedConfig(prisma);

      const snap = await selectors.getOrCreateDraftSnapshot(9, 2025);

      expect(snap.month).toBe(9);
      expect(snap.year).toBe(2025);
      expect(snap.status).toBe(SnapshotStatus.DRAFT);
    });

    it('returns the existing snapshot without creating a duplicate', async () => {
      await seedConfig(prisma);
      const first = await selectors.getOrCreateDraftSnapshot(9, 2025);
      const second = await selectors.getOrCreateDraftSnapshot(9, 2025);

      expect(second.id).toBe(first.id);
      const count = await prisma.monthlySnapshot.count({
        where: { month: 9, year: 2025 },
      });
      expect(count).toBe(1);
    });

    it('returns a LOCKED snapshot as-is (does not reset its status)', async () => {
      await seedConfig(prisma);
      const locked = await seedSnapshot(prisma, 9, 2025, SnapshotStatus.LOCKED);

      const result = await selectors.getOrCreateDraftSnapshot(9, 2025);

      expect(result.id).toBe(locked.id);
      expect(result.status).toBe(SnapshotStatus.LOCKED);
    });

    it('idempotently auto-syncs due liabilities on first view without duplicating transactions or modifying contract remainingTenor on repeated views', async () => {
      await seedConfig(prisma);

      // 1. Seed an active CreditContract with 12 months tenor
      const contract = await prisma.creditContract.create({
        data: {
          label: 'Laptop Cicilan',
          principalAmount: 12_000_000,
          monthlyInstallment: 1_000_000,
          totalTenor: 12,
          remainingTenor: 12,
          startMonth: 1,
          startYear: 2028,
          isActive: true,
        },
      });

      // 2. Seed a MonthlyBulkBill for a never-before-seen future period (5, 2028)
      await prisma.monthlyBulkBill.create({
        data: {
          month: 5,
          year: 2028,
          amount: 1_500_000,
          paylaterAmount: 1_000_000,
          personalDebtAmount: 500_000,
        },
      });

      // Confirm snapshot does NOT exist initially
      const preCheck = await prisma.monthlySnapshot.findUnique({
        where: { userId_month_year: { userId: 1, month: 5, year: 2028 } },
      });
      expect(preCheck).toBeNull();

      // FIRST VIEW (initial provisioning):
      const firstView = await selectors.getOrCreateDraftSnapshot(5, 2028);

      expect(firstView).toBeDefined();
      expect(firstView.status).toBe(SnapshotStatus.DRAFT);
      expect(firstView.month).toBe(5);
      expect(firstView.year).toBe(2028);

      // Should have materialized exactly 3 CREDIT_BILL transactions:
      // 1 from contract (1,000,000) + 1 from PayLater (1,000,000) + 1 from Personal Debt (500,000)
      const firstViewTxs = await prisma.transaction.findMany({
        where: { snapshotId: firstView.id },
      });
      expect(firstViewTxs).toHaveLength(3);
      expect(firstViewTxs.every((t) => t.type === TransactionType.CREDIT_BILL)).toBe(true);

      // Stored totalDeductions recalculated on snapshot: 2,500,000
      expect(firstView.totalDeductions).toBe(2_500_000);

      // CRITICAL REGRESSION GUARD: CreditContract.remainingTenor MUST NOT BE MODIFIED!
      const contractAfterFirst = await prisma.creditContract.findUniqueOrThrow({
        where: { id: contract.id },
      });
      expect(contractAfterFirst.remainingTenor).toBe(12);

      // SECOND VIEW (immediate repeated GET on the same period):
      const secondView = await selectors.getOrCreateDraftSnapshot(5, 2028);

      expect(secondView.id).toBe(firstView.id);

      // Transactions count must STILL be exactly 3 (ZERO duplicates created!)
      const secondViewTxs = await prisma.transaction.findMany({
        where: { snapshotId: secondView.id },
      });
      expect(secondViewTxs).toHaveLength(3);
      expect(secondView.totalDeductions).toBe(2_500_000);

      // CRITICAL REGRESSION GUARD: CreditContract.remainingTenor MUST STILL BE 12!
      const contractAfterSecond = await prisma.creditContract.findUniqueOrThrow({
        where: { id: contract.id },
      });
      expect(contractAfterSecond.remainingTenor).toBe(12);
    });
  });

  // -------------------------------------------------------------------------
  // assertSnapshotUnlocked
  // -------------------------------------------------------------------------

  describe('assertSnapshotUnlocked', () => {
    it('returns the snapshot when it is DRAFT', async () => {
      await seedConfig(prisma);
      const snap = await seedSnapshot(prisma, 9, 2025);

      await expect(service.assertSnapshotUnlocked(snap.id)).resolves.toMatchObject({
        id: snap.id,
        status: SnapshotStatus.DRAFT,
      });
    });

    it('throws BadRequestException when snapshot is LOCKED', async () => {
      await seedConfig(prisma);
      const snap = await seedSnapshot(prisma, 9, 2025, SnapshotStatus.LOCKED);

      await expect(service.assertSnapshotUnlocked(snap.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('recalculateSnapshot also rejects when snapshot is LOCKED', async () => {
      await seedConfig(prisma);
      const snap = await seedSnapshot(prisma, 9, 2025);

      // Recalculate succeeds while DRAFT
      await expect(service.recalculateSnapshot(snap.id)).resolves.toBeDefined();

      // Lock it
      await prisma.monthlySnapshot.update({
        where: { id: snap.id },
        data: { status: SnapshotStatus.LOCKED },
      });

      // Both guards must now reject
      await expect(service.recalculateSnapshot(snap.id)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.assertSnapshotUnlocked(snap.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updateSnapshot updates draft fields and recalculates derived figures', async () => {
      await seedConfig(prisma);
      const snap = await seedSnapshot(prisma, 9, 2025);

      const updated = await service.updateSnapshot(snap.id, {
        totalWorkingDays: 20,
        cafeteriaDeduction: 150_000,
        bonusAmount: 500_000,
        salaryAdjustment: 200_000,
      });

      expect(updated.totalWorkingDays).toBe(20);
      expect(updated.cafeteriaDeduction).toBe(150_000);
      expect(updated.bonusAmount).toBe(500_000);
      expect(updated.salaryAdjustment).toBe(200_000);
      expect(updated.netSalaryIncome).toBeGreaterThan(0);
      expect(updated.finalTotalIncome).toBeGreaterThan(0);
    });

    it('updateSnapshot calculates pro-rated December THR server-side', async () => {
      await seedConfig(prisma);
      const snap = await seedSnapshot(prisma, 12, 2025);

      const withThr = await service.updateSnapshot(snap.id, {
        useDecemberProratedThr: true,
      });

      // 10,000,000 * (8.83 / 12) = 7,358,333
      expect(withThr.thrAmount).toBe(7358333);

      const withoutThr = await service.updateSnapshot(snap.id, {
        useDecemberProratedThr: false,
      });

      expect(withoutThr.thrAmount).toBe(0);
    });

    it('updateSnapshot rejects when snapshot is LOCKED', async () => {
      await seedConfig(prisma);
      const snap = await seedSnapshot(prisma, 9, 2025, SnapshotStatus.LOCKED);

      await expect(
        service.updateSnapshot(snap.id, { totalWorkingDays: 20 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // closePeriod — basic transition
  // -------------------------------------------------------------------------

  describe('closePeriod — basic transition', () => {
    it('transitions a DRAFT snapshot to LOCKED and never auto-writes to Savings Vault when vaultTopupAmount is omitted or 0', async () => {
      await seedConfig(prisma);
      const snap = await seedSnapshot(prisma, 9, 2025);

      const result = await service.closePeriod(snap.id);

      expect(result.snapshot.status).toBe(SnapshotStatus.LOCKED);
      expect(result.vaultTransfer).toBeNull();

      const vaultTxs = await prisma.savingsManualTransaction.findMany();
      expect(vaultTxs).toHaveLength(0);
    });

    it('atomically creates a period-tagged Savings Vault TOPUP and SAVINGS_TOPUP audit log when vaultTopupAmount > 0 is confirmed', async () => {
      await seedConfig(prisma);
      const snap = await seedSnapshot(prisma, 9, 2025);

      // Even if user customizes the label without (9/2025), backend deterministically preserves (9/2025)
      const result = await service.closePeriod(snap.id, {
        vaultTopupAmount: 650_000,
        vaultTopupLabel: 'Swept P1 + Operational Surplus',
      });

      expect(result.snapshot.status).toBe(SnapshotStatus.LOCKED);
      expect(result.vaultTransfer).toBeDefined();
      expect(result.vaultTransfer?.amount).toBe(650_000);
      expect(result.vaultTransfer?.label).toBe(
        'Swept P1 + Operational Surplus (9/2025)',
      );

      const vaultTxs = await prisma.savingsManualTransaction.findMany();
      expect(vaultTxs).toHaveLength(1);
      expect(vaultTxs[0].amount).toBe(650_000);

      const savingsLogs = await prisma.auditLog.findMany({
        where: { action: 'SAVINGS_TOPUP', month: 9, year: 2025 },
      });
      expect(savingsLogs).toHaveLength(1);
    });

    it('throws BadRequestException when closing an already-LOCKED snapshot', async () => {
      await seedConfig(prisma);
      const snap = await seedSnapshot(prisma, 9, 2025, SnapshotStatus.LOCKED);

      await expect(service.closePeriod(snap.id)).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // closePeriod — CreditContract.remainingTenor decrement
  // -------------------------------------------------------------------------

  describe('closePeriod — remainingTenor decrement', () => {
    it('decrements remainingTenor by 1 for each active contract on close', async () => {
      await seedConfig(prisma);
      const snap = await seedSnapshot(prisma, 9, 2025);

      const contract = await prisma.creditContract.create({
        data: {
          label: 'Phone installment',
          principalAmount: 5_000_000,
          monthlyInstallment: 500_000,
          totalTenor: 12,
          remainingTenor: 6,
          isActive: true,
          startMonth: 4,
          startYear: 2025,
        },
      });

      await service.closePeriod(snap.id);

      const updated = await prisma.creditContract.findUniqueOrThrow({
        where: { id: contract.id },
      });
      expect(updated.remainingTenor).toBe(5);
      expect(updated.isActive).toBe(true);
    });

    it('sets isActive = false when remainingTenor reaches 0', async () => {
      await seedConfig(prisma);
      const snap = await seedSnapshot(prisma, 9, 2025);

      const contract = await prisma.creditContract.create({
        data: {
          label: 'Last installment',
          principalAmount: 1_000_000,
          monthlyInstallment: 1_000_000,
          totalTenor: 1,
          remainingTenor: 1,
          isActive: true,
          startMonth: 9,
          startYear: 2025,
        },
      });

      await service.closePeriod(snap.id);

      const updated = await prisma.creditContract.findUniqueOrThrow({
        where: { id: contract.id },
      });
      expect(updated.remainingTenor).toBe(0);
      expect(updated.isActive).toBe(false);
    });

    it('decrements all active contracts and reports the correct count', async () => {
      await seedConfig(prisma);
      const snap = await seedSnapshot(prisma, 9, 2025);

      // Contract A: 3 months left -> 2, still active
      const contractA = await prisma.creditContract.create({
        data: {
          label: 'Phone installment',
          principalAmount: 6_000_000,
          monthlyInstallment: 1_000_000,
          totalTenor: 6,
          remainingTenor: 3,
          isActive: true,
          startMonth: 1,
          startYear: 2025,
        },
      });

      // Contract B: 1 month left -> 0, deactivated
      const contractB = await prisma.creditContract.create({
        data: {
          label: 'Gym membership',
          principalAmount: 1_200_000,
          monthlyInstallment: 100_000,
          totalTenor: 12,
          remainingTenor: 1,
          isActive: true,
          startMonth: 1,
          startYear: 2025,
        },
      });

      const result = await service.closePeriod(snap.id);

      expect(result.decrementedContractsCount).toBe(2);

      const updatedA = await prisma.creditContract.findUniqueOrThrow({
        where: { id: contractA.id },
      });
      expect(updatedA.remainingTenor).toBe(2);
      expect(updatedA.isActive).toBe(true);

      const updatedB = await prisma.creditContract.findUniqueOrThrow({
        where: { id: contractB.id },
      });
      expect(updatedB.remainingTenor).toBe(0);
      expect(updatedB.isActive).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // closePeriod — chronological order enforcement
  // -------------------------------------------------------------------------

  describe('closePeriod — chronological order', () => {
    it('allows closing periods in strict chronological order (Jul -> Aug -> Sep)', async () => {
      await seedConfig(prisma);

      const contract = await prisma.creditContract.create({
        data: {
          label: 'Multi-month contract',
          principalAmount: 3_000_000,
          monthlyInstallment: 1_000_000,
          totalTenor: 3,
          remainingTenor: 3,
          isActive: true,
          startMonth: 7,
          startYear: 2025,
        },
      });

      const jul = await seedSnapshot(prisma, 7, 2025);
      const aug = await seedSnapshot(prisma, 8, 2025);
      const sep = await seedSnapshot(prisma, 9, 2025);

      // Close July — must succeed
      await expect(service.closePeriod(jul.id)).resolves.toMatchObject({
        snapshot: { status: SnapshotStatus.LOCKED },
        decrementedContractsCount: 1,
      });

      // Close August — must succeed
      await expect(service.closePeriod(aug.id)).resolves.toMatchObject({
        snapshot: { status: SnapshotStatus.LOCKED },
        decrementedContractsCount: 1,
      });

      // Close September — must succeed
      await expect(service.closePeriod(sep.id)).resolves.toMatchObject({
        snapshot: { status: SnapshotStatus.LOCKED },
        decrementedContractsCount: 1,
      });

      // Contract should be exhausted after three closes
      const updated = await prisma.creditContract.findUniqueOrThrow({
        where: { id: contract.id },
      });
      expect(updated.remainingTenor).toBe(0);
      expect(updated.isActive).toBe(false);
    });

    it('rejects closing Oct while Sep is still DRAFT', async () => {
      await seedConfig(prisma);

      const sep = await seedSnapshot(prisma, 9, 2025); // DRAFT — not yet closed
      const oct = await seedSnapshot(prisma, 10, 2025);

      const err = await service.closePeriod(oct.id).catch((e: Error) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).message).toContain(`snapshot #${sep.id}`);
      expect((err as BadRequestException).message).toContain('9/2025');

      // Oct must still be DRAFT — the rejection must be atomic
      const octAfter = await prisma.monthlySnapshot.findUniqueOrThrow({
        where: { id: oct.id },
      });
      expect(octAfter.status).toBe(SnapshotStatus.DRAFT);
    });

    it('allows closing Oct after Sep is closed first', async () => {
      await seedConfig(prisma);

      const sep = await seedSnapshot(prisma, 9, 2025);
      const oct = await seedSnapshot(prisma, 10, 2025);

      await service.closePeriod(sep.id);

      await expect(service.closePeriod(oct.id)).resolves.toMatchObject({
        snapshot: { status: SnapshotStatus.LOCKED },
      });
    });

    it('does not treat a LOCKED earlier snapshot as a blocker', async () => {
      await seedConfig(prisma);

      // Aug is already LOCKED (closed in a previous session)
      await seedSnapshot(prisma, 8, 2025, SnapshotStatus.LOCKED);
      const sep = await seedSnapshot(prisma, 9, 2025);

      // Sep should close without issue — Aug is LOCKED, not DRAFT
      await expect(service.closePeriod(sep.id)).resolves.toMatchObject({
        snapshot: { status: SnapshotStatus.LOCKED },
      });
    });

    it('rejects closing a later year while an earlier year has a DRAFT snapshot', async () => {
      await seedConfig(prisma);

      const dec2024 = await seedSnapshot(prisma, 12, 2024); // DRAFT
      const jan2025 = await seedSnapshot(prisma, 1, 2025);

      const err = await service.closePeriod(jan2025.id).catch((e: Error) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).message).toContain(`snapshot #${dec2024.id}`);
    });
  });

  // -------------------------------------------------------------------------
  // Budget Revisions
  // -------------------------------------------------------------------------

  describe('Budget Revisions', () => {
    it('strictly rejects budget revision when snapshot is LOCKED', async () => {
      await seedConfig(prisma);
      const locked = await seedSnapshot(prisma, 9, 2026, SnapshotStatus.LOCKED);

      await expect(
        service.createBudgetRevision(locked.id, {
          category: BudgetRevisionCategory.DAILY_OPERATIONAL,
          newValue: 2_500_000,
          reason: 'Attempted edit on closed period',
        }),
      ).rejects.toThrow('Snapshot is locked and cannot be modified');
    });

    it('revises DAILY_OPERATIONAL target, logs audit trail, and recalculates snapshot', async () => {
      await seedConfig(prisma);
      const draft = await seedSnapshot(prisma, 9, 2026, SnapshotStatus.DRAFT);

      // Initial dailyOperational from seedSnapshot is 100_000 (copied from config in tests or set to 100_000)
      const result = await service.createBudgetRevision(draft.id, {
        category: BudgetRevisionCategory.DAILY_OPERATIONAL,
        newValue: 2_800_000,
        reason: 'Adjusting operational budget mid-month',
      });

      expect(result.revision).toBeDefined();
      expect(result.revision.category).toBe(BudgetRevisionCategory.DAILY_OPERATIONAL);
      expect(result.revision.previousValue).toBe(100_000);
      expect(result.revision.newValue).toBe(2_800_000);
      expect(result.revision.difference).toBe(2_700_000);
      expect(result.revision.reason).toBe('Adjusting operational budget mid-month');
      expect(result.revision.month).toBe(9);
      expect(result.revision.year).toBe(2026);

      // Verify updated snapshot
      expect(result.snapshot.dailyOperational).toBe(2_800_000);
      expect(result.snapshot.actualDailyOperational).toBeDefined();

      // Verify stored in DB
      const dbSnapshot = await prisma.monthlySnapshot.findUniqueOrThrow({
        where: { id: draft.id },
      });
      expect(dbSnapshot.dailyOperational).toBe(2_800_000);

      // Verify AuditLog record
      const auditLogs = await prisma.auditLog.findMany({
        where: { action: 'BUDGET_TARGET_REVISED', month: 9, year: 2026 },
      });
      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].category).toBe(AuditCategory.BUDGET);
      expect(auditLogs[0].severity).toBe(AuditSeverity.ADJUSTMENT);
      expect(auditLogs[0].details).toContain('Changed from 100000 to 2800000');
      expect(auditLogs[0].details).toContain('Adjusting operational budget mid-month');
    });

    it('supports revising SAVINGS, SELF_REWARD, and BUFFER', async () => {
      await seedConfig(prisma);
      const draft = await seedSnapshot(prisma, 10, 2026, SnapshotStatus.DRAFT);

      await service.createBudgetRevision(draft.id, {
        category: BudgetRevisionCategory.SAVINGS,
        newValue: 1_200_000,
        reason: 'Higher savings commitment',
      });

      await service.createBudgetRevision(draft.id, {
        category: BudgetRevisionCategory.SELF_REWARD,
        newValue: 500_000,
        reason: 'Bonus celebration buffer',
      });

      await service.createBudgetRevision(draft.id, {
        category: BudgetRevisionCategory.BUFFER,
        newValue: 300_000,
        reason: 'Extra emergency buffer',
      });

      const updated = await prisma.monthlySnapshot.findUniqueOrThrow({
        where: { id: draft.id },
      });
      expect(updated.savings).toBe(1_200_000);
      expect(updated.selfRewardTarget).toBe(500_000);
      expect(updated.bufferPocket).toBe(300_000);

      const revisions = await selectors.listBudgetRevisions(draft.id);
      expect(revisions.length).toBe(3);
      expect(revisions.map((r) => r.category)).toEqual([
        BudgetRevisionCategory.SAVINGS,
        BudgetRevisionCategory.SELF_REWARD,
        BudgetRevisionCategory.BUFFER,
      ]);
    });

    it('supports revising TRANSPORT, INTERNET, VAPE, and HAIRCUT with recalculation and audit logging', async () => {
      await seedConfig(prisma);
      const draft = await seedSnapshot(prisma, 11, 2026, SnapshotStatus.DRAFT);

      // 1. Revise TRANSPORT
      const transportRes = await service.createBudgetRevision(draft.id, {
        category: BudgetRevisionCategory.TRANSPORT,
        newValue: 450_000,
        reason: 'Fuel price surge and extra office commutes',
      });
      expect(transportRes.revision.category).toBe(BudgetRevisionCategory.TRANSPORT);
      expect(transportRes.revision.newValue).toBe(450_000);
      expect(transportRes.snapshot.transport).toBe(450_000);

      // 2. Revise INTERNET
      const internetRes = await service.createBudgetRevision(draft.id, {
        category: BudgetRevisionCategory.INTERNET,
        newValue: 350_000,
        reason: 'Upgraded home fiber bandwidth tier',
      });
      expect(internetRes.revision.category).toBe(BudgetRevisionCategory.INTERNET);
      expect(internetRes.revision.newValue).toBe(350_000);
      expect(internetRes.snapshot.internet).toBe(350_000);

      // 3. Revise VAPE
      const vapeRes = await service.createBudgetRevision(draft.id, {
        category: BudgetRevisionCategory.VAPE,
        newValue: 150_000,
        reason: 'Stocked up on pods for two months',
      });
      expect(vapeRes.revision.category).toBe(BudgetRevisionCategory.VAPE);
      expect(vapeRes.revision.newValue).toBe(150_000);
      expect(vapeRes.snapshot.vape).toBe(150_000);

      // 4. Revise HAIRCUT
      const haircutRes = await service.createBudgetRevision(draft.id, {
        category: BudgetRevisionCategory.HAIRCUT,
        newValue: 80_000,
        reason: 'Barbershop price adjustment',
      });
      expect(haircutRes.revision.category).toBe(BudgetRevisionCategory.HAIRCUT);
      expect(haircutRes.revision.newValue).toBe(80_000);
      expect(haircutRes.snapshot.haircut).toBe(80_000);

      // Verify all 4 fields persisted in database
      const dbSnapshot = await prisma.monthlySnapshot.findUniqueOrThrow({
        where: { id: draft.id },
      });
      expect(dbSnapshot.transport).toBe(450_000);
      expect(dbSnapshot.internet).toBe(350_000);
      expect(dbSnapshot.vape).toBe(150_000);
      expect(dbSnapshot.haircut).toBe(80_000);

      // Verify audit logs recorded for each
      const auditLogs = await prisma.auditLog.findMany({
        where: { action: 'BUDGET_TARGET_REVISED', month: 11, year: 2026 },
      });
      expect(auditLogs.length).toBe(4);
      expect(auditLogs.some((l) => l.summary.includes('TRANSPORT'))).toBe(true);
      expect(auditLogs.some((l) => l.summary.includes('INTERNET'))).toBe(true);
      expect(auditLogs.some((l) => l.summary.includes('VAPE'))).toBe(true);
      expect(auditLogs.some((l) => l.summary.includes('HAIRCUT'))).toBe(true);
    });

    it('rejects revising TRANSPORT, INTERNET, VAPE, or HAIRCUT when snapshot is LOCKED', async () => {
      await seedConfig(prisma);
      const locked = await seedSnapshot(prisma, 9, 2026, SnapshotStatus.LOCKED);

      for (const cat of [
        BudgetRevisionCategory.TRANSPORT,
        BudgetRevisionCategory.INTERNET,
        BudgetRevisionCategory.VAPE,
        BudgetRevisionCategory.HAIRCUT,
      ]) {
        await expect(
          service.createBudgetRevision(locked.id, {
            category: cat,
            newValue: 200_000,
            reason: 'Attempted edit on locked snapshot',
          }),
        ).rejects.toThrow('Snapshot is locked and cannot be modified');
      }
    });
  });

  describe('previewBudgetRevision', () => {
    it('returns accurate projections with ZERO DB mutations, zero BudgetRevision rows, and zero audit logs', async () => {
      await seedConfig(prisma);
      const draft = await seedSnapshot(prisma, 9, 2026, SnapshotStatus.DRAFT);
      const initialDailyOperational = draft.dailyOperational;

      const auditCountBefore = await prisma.auditLog.count();
      const revisionsCountBefore = await prisma.budgetRevision.count();

      const preview = await service.previewBudgetRevision(draft.id, {
        category: BudgetRevisionCategory.DAILY_OPERATIONAL,
        newValue: 1_200_000,
      });

      expect(preview.category).toBe(BudgetRevisionCategory.DAILY_OPERATIONAL);
      expect(preview.previousValue).toBe(initialDailyOperational);
      expect(preview.newValue).toBe(1_200_000);
      expect(preview.difference).toBe(1_200_000 - initialDailyOperational);
      expect(preview.projected).toBeDefined();
      expect(preview.projected.actualDailyOperational).toBe(1_200_000);
      expect(preview.projected.safeToSpendToday).toBeGreaterThan(0);

      // Verify ZERO database mutations on snapshot
      const dbSnapshot = await prisma.monthlySnapshot.findUniqueOrThrow({
        where: { id: draft.id },
      });
      expect(dbSnapshot.dailyOperational).toBe(initialDailyOperational);

      // Verify ZERO new BudgetRevision rows
      const revisionsCountAfter = await prisma.budgetRevision.count();
      expect(revisionsCountAfter).toBe(revisionsCountBefore);

      // Verify ZERO new audit log entries
      const auditCountAfter = await prisma.auditLog.count();
      expect(auditCountAfter).toBe(auditCountBefore);
    });

    it('rejects previewBudgetRevision when snapshot is LOCKED', async () => {
      await seedConfig(prisma);
      const locked = await seedSnapshot(prisma, 9, 2026, SnapshotStatus.LOCKED);

      await expect(
        service.previewBudgetRevision(locked.id, {
          category: BudgetRevisionCategory.SAVINGS,
          newValue: 500_000,
        }),
      ).rejects.toThrow('Snapshot is locked and cannot be modified');
    });
  });

  // -------------------------------------------------------------------------
  // reopenSnapshot & evaluateAutoClosePeriods
  // -------------------------------------------------------------------------

  describe('reopenSnapshot', () => {
    it('successfully reverts a LOCKED snapshot back to DRAFT and records an AuditLog', async () => {
      await seedConfig(prisma);
      const locked = await seedSnapshot(prisma, 8, 2026, SnapshotStatus.LOCKED);

      const reopened = await service.reopenSnapshot(locked.id);
      expect(reopened.status).toBe(SnapshotStatus.DRAFT);

      const dbRow = await prisma.monthlySnapshot.findUniqueOrThrow({
        where: { id: locked.id },
      });
      expect(dbRow.status).toBe(SnapshotStatus.DRAFT);

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'REOPEN_PERIOD', month: 8, year: 2026 },
      });
      expect(audit).toBeDefined();
      expect(audit?.summary).toContain('Reopened period 8/2026');
    });

    it('rejects reopening a snapshot that is already in DRAFT status', async () => {
      await seedConfig(prisma);
      const draft = await seedSnapshot(prisma, 10, 2026, SnapshotStatus.DRAFT);

      await expect(service.reopenSnapshot(draft.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('evaluateAutoClosePeriods', () => {
    it('automatically locks expired cycles past the grace window while leaving active cycles intact', async () => {
      await seedConfig(prisma);

      // Create an expired draft period (e.g. payout 2026-08-25, cycle end 2026-09-24)
      const expiredPayout = new Date(Date.UTC(2026, 7, 25));
      const expiredDraft = await prisma.monthlySnapshot.create({
        data: {
          month: 8,
          year: 2026,
          status: SnapshotStatus.DRAFT,
          payrollPayoutDate: expiredPayout,
          isPayoutDateConfirmed: true,
          totalWorkingDays: 21,
          cafeteriaDeduction: 0,
          dailyOperational: 100_000,
          transport: 200_000,
          internet: 150_000,
          vape: 100_000,
          haircut: 50_000,
          savings: 500_000,
          selfRewardTarget: 200_000,
          bufferPocket: 0,
        },
      });

      // Create an active draft period (e.g. payout 2026-10-27, cycle end 2026-11-26)
      const activePayout = new Date(Date.UTC(2026, 9, 27));
      const activeDraft = await prisma.monthlySnapshot.create({
        data: {
          month: 10,
          year: 2026,
          status: SnapshotStatus.DRAFT,
          payrollPayoutDate: activePayout,
          isPayoutDateConfirmed: true,
          totalWorkingDays: 21,
          cafeteriaDeduction: 0,
          dailyOperational: 100_000,
          transport: 200_000,
          internet: 150_000,
          vape: 100_000,
          haircut: 50_000,
          savings: 500_000,
          selfRewardTarget: 200_000,
          bufferPocket: 0,
        },
      });

      // Reference date: 2026-10-28 (more than 14 days after expiredDraft cycle end)
      const refDate = new Date(Date.UTC(2026, 9, 28));

      // Set global config with autoCloseEnabled: true, autoCloseAfterDays: 14, activeTrackingStartMonth: 8
      await prisma.globalConfig.updateMany({
        data: {
          autoCloseEnabled: true,
          autoCloseAfterDays: 14,
          activeTrackingStartMonth: 8,
          activeTrackingStartYear: 2026,
        },
      });

      const evalResult = await service.evaluateAutoClosePeriods(refDate);

      expect(evalResult.autoClosedCount).toBe(1);
      expect(evalResult.autoClosedPeriods).toEqual([
        { id: expiredDraft.id, month: 8, year: 2026 },
      ]);

      const expiredDb = await prisma.monthlySnapshot.findUniqueOrThrow({
        where: { id: expiredDraft.id },
      });
      expect(expiredDb.status).toBe(SnapshotStatus.LOCKED);

      const activeDb = await prisma.monthlySnapshot.findUniqueOrThrow({
        where: { id: activeDraft.id },
      });
      expect(activeDb.status).toBe(SnapshotStatus.DRAFT);
    });

    it('does nothing when autoCloseEnabled is false', async () => {
      await seedConfig(prisma);
      await prisma.globalConfig.updateMany({
        data: { autoCloseEnabled: false },
      });

      const evalResult = await service.evaluateAutoClosePeriods();
      expect(evalResult.autoClosedCount).toBe(0);
    });
  });
});
