/**
 * config.integration.spec.ts
 * Integration tests for GET /api/config and POST /api/config.
 * Requires the Postgres container to be running (port 5433).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '../src/config/config.service';
import { ConfigSelectors } from '../src/config/config.selectors';
import { AuditModule } from '../src/audit/audit.module';
import { SnapshotsModule } from '../src/snapshots/snapshots.module';
import { CreditModule } from '../src/credit/credit.module';

import { SnapshotsService } from '../src/snapshots/snapshots.service';
import { SnapshotsSelectors } from '../src/snapshots/snapshots.selectors';

async function cleanConfig(prisma: PrismaService) {
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany({ where: { snapshot: { year: 2030 } } });
  await prisma.monthlySnapshot.deleteMany({ where: { year: 2030 } });
  await prisma.customFeatureRequest.deleteMany();
  await prisma.globalConfig.deleteMany();
}

describe('Config — integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let service: ConfigService;
  let selectors: ConfigSelectors;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule, AuditModule, SnapshotsModule, CreditModule],
      providers: [ConfigService, ConfigSelectors],
    }).compile();

    prisma = module.get(PrismaService);
    service = module.get(ConfigService);
    selectors = module.get(ConfigSelectors);

    await cleanConfig(prisma);
  });

  afterAll(async () => {
    await module.close();
  });

  afterEach(async () => {
    await cleanConfig(prisma);
  });

  // -------------------------------------------------------------------------
  // getConfig — auto-create behaviour
  // -------------------------------------------------------------------------

  describe('getConfig', () => {
    it('returns a default row when no config exists yet', async () => {
      const config = await selectors.getConfig();

      expect(config).toBeDefined();
      expect(config.userId).toBe(1);
      expect(config.baseSalary).toBe(0);
      expect(config.laptopAllowance).toBe(250000);
    });

    it('returns the existing row without creating a duplicate', async () => {
      await selectors.getConfig(); // creates default
      await selectors.getConfig(); // must return same row

      const count = await prisma.globalConfig.count();
      expect(count).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // upsertConfig — write path
  // -------------------------------------------------------------------------

  describe('upsertConfig', () => {
    const validPayload = {
      baseSalary: 12_000_000,
      dailyAllowance: 50_000,
      laptopAllowance: 250_000,
      dailyOperational: 3_000_000,
      transport: 500_000,
      internet: 300_000,
      vape: 200_000,
      haircut: 100_000,
      baseSavings: 2_000_000,
    };

    it('creates a new config when none exists', async () => {
      const result = await service.upsertConfig(validPayload);

      expect(result.baseSalary).toBe(12_000_000);
      expect(result.dailyAllowance).toBe(50_000);
      expect(result.baseSavings).toBe(2_000_000);
    });

    it('updates the existing config on a second call', async () => {
      await service.upsertConfig(validPayload);
      const updated = await service.upsertConfig({
        ...validPayload,
        baseSalary: 15_000_000,
      });

      expect(updated.baseSalary).toBe(15_000_000);
      const count = await prisma.globalConfig.count();
      expect(count).toBe(1);
    });

    it('getConfig reflects the upserted values', async () => {
      await service.upsertConfig(validPayload);
      const config = await selectors.getConfig();

      expect(config.baseSalary).toBe(validPayload.baseSalary);
      expect(config.transport).toBe(validPayload.transport);
    });
  });

  // -------------------------------------------------------------------------
  // Modular Formula, Dynamic Bucket & Policy Engine Integration Tests
  // -------------------------------------------------------------------------

  describe('Modular Formula, Dynamic Bucket & Policy Engine', () => {
    it('a. Default modular rules produce 100% byte-identical Rupiah outputs to pre-refactor engine on snapshot', async () => {
      // Create baseline config
      await service.upsertConfig({
        baseSalary: 5_891_000,
        dailyAllowance: 20_000,
        laptopAllowance: 250_000,
        dailyOperational: 2_850_000,
        transport: 300_000,
        internet: 250_000,
        vape: 350_000,
        haircut: 91_000,
        baseSavings: 1_000_000,
        creditLimit: 7_000_000,
      });

      const snapshotsService = module.get(SnapshotsService);
      const snapshotsSelectors = module.get(SnapshotsSelectors);

      // Create snapshot for 10/2030 (isolated period)
      const snapshot = await snapshotsSelectors.getOrCreateDraftSnapshot(10, 2030);

      // 5,891,000 - 3% BPJS (176,730) + 250,000 Laptop + (22 working days * 20,000 = 440,000) = 6,404,270
      expect(snapshot.finalTotalIncome).toBe(6_404_270);
      expect(snapshot.dailyOperational).toBe(2_850_000);
      expect(snapshot.actualDailyOperational).toBe(2_850_000);
      expect(snapshot.transport).toBe(300_000);
      expect(snapshot.internet).toBe(250_000);
      expect(snapshot.vape).toBe(350_000);
      expect(snapshot.haircut).toBe(91_000);
      expect(snapshot.savings).toBe(1_000_000);

      // Verify bucket realizations are automatically populated
      expect(Array.isArray(snapshot.bucketRealizationsJson)).toBe(true);
      const realizations = snapshot.bucketRealizationsJson as any[];
      expect(realizations.length).toBeGreaterThanOrEqual(8);
      const transportRealization = realizations.find((b) => b.bucketId === 'transport');
      expect(transportRealization?.baselineTarget).toBe(300_000);
      expect(transportRealization?.fundedAmount).toBe(300_000);
    });

    it('b. Configuring % of Net Income, Daily Rate x Cycle Days, custom FIXED_ESSENTIAL, and 50/50 split persists exact expected waterfall', async () => {
      const customBuckets = [
        {
          id: 'custom_gym',
          label: 'Gym & Crossfit',
          group: 'FIXED_ESSENTIAL',
          priorityTier: 0,
          formulaType: 'FIXED_AMOUNT',
          value: 400_000,
          isActive: true,
        },
        {
          id: 'daily_pacing',
          label: 'Daily Living Pacing',
          group: 'DAILY_OPERATIONAL',
          priorityTier: 0,
          formulaType: 'DAILY_RATE_TIMES_CYCLE_DAYS',
          value: 70_000, // 70k * 30 days = 2,100,000
          isActive: true,
        },
        {
          id: 'core_savings',
          label: 'P1 Savings',
          group: 'SAVINGS_P1',
          priorityTier: 1,
          formulaType: 'PERCENT_OF_NET_INCOME',
          value: 20, // 20% of 6,000,000 = 1,200,000
          isActive: true,
        },
        {
          id: 'self_reward',
          label: 'P2 Self-Reward',
          group: 'SELF_REWARD_P2',
          priorityTier: 2,
          formulaType: 'REMAINDER_OVERFLOW',
          value: 0,
          isActive: true,
        },
      ];

      const surplusSplit = {
        splits: [
          { bucketId: 'core_savings', percent: 50 },
          { bucketId: 'self_reward', percent: 50 },
        ],
      };

      await service.upsertConfig({
        baseSalary: 6_000_000,
        dailyAllowance: 0,
        laptopAllowance: 0,
        dailyOperational: 2_100_000,
        transport: 0,
        internet: 0,
        vape: 0,
        haircut: 0,
        baseSavings: 1_200_000,
        payrollRulesJson: [
          {
            id: 'base',
            label: 'Base Paycheck',
            direction: 'ADDITION',
            formulaType: 'FIXED_AMOUNT',
            value: 0,
            isActive: false,
          },
        ],
        allocationBucketsJson: customBuckets,
        surplusSplitRulesJson: surplusSplit,
      });

      const snapshotsService = module.get(SnapshotsService);
      const snapshotsSelectors = module.get(SnapshotsSelectors);

      // Create snapshot for 11/2030
      const snapshot = await snapshotsSelectors.getOrCreateDraftSnapshot(11, 2030);

      // Income = 6,000,000
      // Tier 0 Essentials: Gym (400,000) + Daily Living (2,100,000) = 2,500,000
      // Available after Tier 0 = 6,000,000 - 2,500,000 = 3,500,000
      // P1 Savings Target: 20% of 6,000,000 = 1,200,000 (fully funded)
      // Remainder surplus = 3,500,000 - 1,200,000 = 2,300,000
      // 50% surplus to Savings: 1,150,000 -> actualSavings = 1,200,000 + 1,150,000 = 2,350,000
      // 50% surplus to Self Reward: 1,150,000 -> selfReward = 1,150,000
      expect(snapshot.actualDailyOperational).toBe(2_100_000);
      expect(snapshot.actualSavings).toBe(2_350_000);
      expect(snapshot.selfReward).toBe(1_150_000);
      expect(snapshot.survivalPocket).toBe(2_500_000); // 2.1m living + 400k gym

      const realizations = snapshot.bucketRealizationsJson as any[];
      const gym = realizations.find((b) => b.bucketId === 'custom_gym');
      expect(gym?.fundedAmount).toBe(400_000);
      const living = realizations.find((b) => b.bucketId === 'daily_pacing');
      expect(living?.baselineTarget).toBe(2_100_000);
    });

    it('c. LOCKED snapshots remain 100% immutable when global modular rules change', async () => {
      await service.upsertConfig({
        baseSalary: 6_000_000,
        dailyAllowance: 20_000,
        laptopAllowance: 250_000,
        dailyOperational: 2_000_000,
        transport: 300_000,
        internet: 250_000,
        vape: 350_000,
        haircut: 100_000,
        baseSavings: 1_000_000,
      });

      const snapshotsService = module.get(SnapshotsService);
      const snapshotsSelectors = module.get(SnapshotsSelectors);

      // Create snapshot for 12/2030 and lock it
      const snapshot = await snapshotsSelectors.getOrCreateDraftSnapshot(12, 2030);
      const lockedSnapshot = await prisma.monthlySnapshot.update({
        where: { id: snapshot.id },
        data: { status: 'LOCKED' },
      });

      const initialActualSavings = lockedSnapshot.actualSavings;
      const initialDailyOperational = lockedSnapshot.actualDailyOperational;

      // Now change global modular rules drastically
      await service.upsertConfig({
        baseSalary: 10_000_000,
        dailyAllowance: 100_000,
        laptopAllowance: 500_000,
        dailyOperational: 5_000_000,
        transport: 1_000_000,
        internet: 1_000_000,
        vape: 1_000_000,
        haircut: 1_000_000,
        baseSavings: 4_000_000,
      });

      // Attempting to sync or recalculate the locked snapshot must throw BadRequestException
      await expect(
        snapshotsService.resyncSnapshotRules(lockedSnapshot.id),
      ).rejects.toThrow(BadRequestException);

      await expect(
        snapshotsService.recalculateSnapshot(lockedSnapshot.id),
      ).rejects.toThrow(BadRequestException);

      // Verify locked snapshot record is unchanged in DB
      const verified = await prisma.monthlySnapshot.findUniqueOrThrow({
        where: { id: lockedSnapshot.id },
      });
      expect(verified.actualSavings).toBe(initialActualSavings);
      expect(verified.actualDailyOperational).toBe(initialDailyOperational);
      expect(verified.status).toBe('LOCKED');
    });
  });

  // -------------------------------------------------------------------------
  // Phase 8.5: Dual-Mode Commercial Architecture & Custom Feature Requests
  // -------------------------------------------------------------------------

  describe('Phase 8.5 — Dual-Mode & Custom Feature Requests', () => {
    it('persists profileMode, onboardingCompleted, customRoutineLabelsJson, and payrollMode', async () => {
      const config = await service.upsertConfig({
        profileMode: 'STANDARD_GENERAL',
        onboardingCompleted: true,
        payrollMode: 'SIMPLE_FIXED_SALARY',
        customRoutineLabelsJson: {
          transport: 'Fuel & Commute',
          internet: 'Home Utilities',
          vape: 'Digital Subs',
          haircut: 'Wellness & Barber',
        },
      });

      expect(config.profileMode).toBe('STANDARD_GENERAL');
      expect(config.onboardingCompleted).toBe(true);
      expect(config.payrollMode).toBe('SIMPLE_FIXED_SALARY');
      expect((config.customRoutineLabelsJson as any).transport).toBe('Fuel & Commute');

      const fetched = await selectors.getConfig();
      expect(fetched.profileMode).toBe('STANDARD_GENERAL');
      expect(fetched.onboardingCompleted).toBe(true);
      expect(fetched.payrollMode).toBe('SIMPLE_FIXED_SALARY');
    });

    it('performs full lifecycle CRUD for custom feature requests', async () => {
      // 1. Create
      const created = await service.createCustomRequest({
        title: 'Freelance Invoicing Withholding Tax (PPh 23)',
        category: 'CUSTOM_PAYROLL_FORMULA',
        currentWorkflowDescription: 'Manual manual deduction entered per invoice',
        desiredBehavior: 'Auto deduct 2% PPh 23 at gross contract intake',
        priority: 'HIGH_BUSINESS_CRITICAL',
      });

      expect(created.id).toBeDefined();
      expect(created.title).toBe('Freelance Invoicing Withholding Tax (PPh 23)');
      expect(created.status).toBe('SUBMITTED');
      expect(created.priority).toBe('HIGH_BUSINESS_CRITICAL');

      // 2. List
      const list = await service.listCustomRequests();
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(created.id);

      // 3. Update (Superadmin review, quote & admin notes)
      const updated = await service.updateCustomRequest(created.id, {
        status: 'APPROVED_QUOTED',
        estimatedSetupFee: 750000,
        adminNotes: 'Rule scheduled for Phase 9 implementation.',
      });

      expect(updated.status).toBe('APPROVED_QUOTED');
      expect(updated.estimatedSetupFee).toBe(750000);
      expect(updated.adminNotes).toBe('Rule scheduled for Phase 9 implementation.');

      // 4. Delete
      const deleted = await service.deleteCustomRequest(created.id);
      expect(deleted.id).toBe(created.id);

      const emptyList = await service.listCustomRequests();
      expect(emptyList.length).toBe(0);
    });
  });
});
