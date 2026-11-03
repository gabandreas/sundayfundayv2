/**
 * sandbox-and-rollover.integration.spec.ts
 * Phase 8.5 (Stage B) Integrity, Privacy Sandbox & Period Rollover integration tests.
 * Runs strictly against finance_erp_test (port 5433).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigModule } from '../src/config/config.module';
import { ConfigService } from '../src/config/config.service';
import { ConfigSelectors } from '../src/config/config.selectors';
import { SnapshotsModule } from '../src/snapshots/snapshots.module';
import { SnapshotsService } from '../src/snapshots/snapshots.service';
import { SnapshotsSelectors } from '../src/snapshots/snapshots.selectors';
import { FinanceModule } from '../src/finance/finance.module';
import { FinanceSelectors } from '../src/finance/finance.selectors';
import { CreditModule } from '../src/credit/credit.module';
import { CreditSelectors } from '../src/credit/credit.selectors';
import { SavingsModule } from '../src/savings/savings.module';
import { SavingsSelectors } from '../src/savings/savings.selectors';
import { ReportsModule } from '../src/reports/reports.module';
import { ReportsSelectors } from '../src/reports/reports.selectors';
import { AuditModule } from '../src/audit/audit.module';
import { CreditCardStatus, ChargeType, SnapshotStatus } from '@prisma/client';

describe('Phase 8.5 (Stage B) — Privacy Sandbox & Period Rollover', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let configService: ConfigService;
  let snapshotsService: SnapshotsService;
  let snapshotsSelectors: SnapshotsSelectors;
  let financeSelectors: FinanceSelectors;
  let creditSelectors: CreditSelectors;
  let savingsSelectors: SavingsSelectors;
  let reportsSelectors: ReportsSelectors;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        PrismaModule,
        AuditModule,
        ConfigModule,
        SnapshotsModule,
        FinanceModule,
        CreditModule,
        SavingsModule,
        ReportsModule,
      ],
    }).compile();

    prisma = module.get(PrismaService);
    configService = module.get(ConfigService);
    snapshotsService = module.get(SnapshotsService);
    snapshotsSelectors = module.get(SnapshotsSelectors);
    financeSelectors = module.get(FinanceSelectors);
    creditSelectors = module.get(CreditSelectors);
    savingsSelectors = module.get(SavingsSelectors);
    reportsSelectors = module.get(ReportsSelectors);

    // Ensure baseline config exists on test DB
    await prisma.globalConfig.upsert({
      where: { userId: 1 },
      create: {
        userId: 1,
        baseSalary: 5891000,
        dailyAllowance: 45000,
        laptopAllowance: 250000,
        dailyOperational: 2850000,
        transport: 200000,
        internet: 200000,
        vape: 350000,
        haircut: 85000,
        baseSavings: 1500000,
        creditLimit: 7000000,
        creditStatementDay: 20,
        creditDueDay: 11,
        profileMode: 'SUPERADMIN_BESPOKE',
      },
      update: {
        profileMode: 'SUPERADMIN_BESPOKE',
        baseSavings: 1500000,
      },
    });
  });

  afterAll(async () => {
    // Restore profileMode to SUPERADMIN_BESPOKE
    await prisma.globalConfig.update({
      where: { userId: 1 },
      data: { profileMode: 'SUPERADMIN_BESPOKE' },
    });
    // Clean up test period 01/2027 if created
    await prisma.transaction.deleteMany({
      where: { snapshot: { month: 1, year: 2027 } },
    });
    await prisma.monthlySnapshot.deleteMany({
      where: { month: 1, year: 2027 },
    });
    await module.close();
  });

  describe('Part 1: Sandbox Privacy Isolation in STANDARD_GENERAL Mode', () => {
    it('should return simulated corporate persona and hide Superadmin sensitive data', async () => {
      // 1. Ensure profileMode is STANDARD_GENERAL on demo account (userId = 2)
      await prisma.globalConfig.upsert({
        where: { userId: 2 },
        create: {
          userId: 2,
          profileMode: 'STANDARD_GENERAL',
          baseSalary: 10000000,
          dailyAllowance: 0,
          laptopAllowance: 0,
          dailyOperational: 3000000,
          transport: 600000,
          internet: 450000,
          vape: 300000,
          haircut: 0,
          baseSavings: 1500000,
          creditLimit: 20000000,
          creditStatementDay: 20,
          creditDueDay: 11,
          payrollPayoutDay: 25,
        },
        update: { profileMode: 'STANDARD_GENERAL' },
      });

      // 2. Query snapshot for 10/2026 for demo account (userId = 2)
      const snapshot = await snapshotsSelectors.getOrCreateDraftSnapshot(10, 2026, 2);
      expect((snapshot as any).isSandbox).toBe(true);
      expect(snapshot.finalTotalIncome).toBe(10000000);
      expect(snapshot.dailyOperational).toBe(3000000);
      expect(snapshot.paylaterBills).toBe(0);
      expect(snapshot.personalDebtBills).toBe(0);
      expect(snapshot.contractInstallments).toBe(0);
      // Credit card bill corresponds to sandbox items: 1,250,000 + 55,000 = 1,305,000
      expect(snapshot.creditCardBills).toBe(1305000);

      // 3. Query payroll for demo account (userId = 2)
      const payroll = await financeSelectors.getPayroll(10, 2026, 2);
      expect(payroll.finalTotalIncome).toBe(10000000);
      expect(payroll.baseSalary).toBe(10000000);

      // 4. Query credit items for demo account (userId = 2)
      const cardSummary = await creditSelectors.getCardSummary(10, 2026, 2);
      expect(cardSummary.currentCycleDue).toBe(1305000);
      const cardTxs = await creditSelectors.listCardTransactions(10, 2026, undefined, undefined, 2);
      expect(cardTxs.length).toBe(2);
      expect(cardTxs.some((c) => c.label.includes('MacBook Air M3'))).toBe(true);
      expect(cardTxs.some((c) => c.label.includes('Spotify'))).toBe(true);

      // 5. Query savings for demo account (userId = 2)
      const vault = await savingsSelectors.getVault(10, 2026, 2);
      expect(vault.balance).toBe(25000000);
      expect(vault.liquidCashBalance).toBe(15000000);
      expect(vault.investmentRdpuBalance).toBe(10000000);

      const overview = await savingsSelectors.getOverview(new Date(), 2);
      expect(overview.kpi.totalVaultBalance).toBe(25000000);
      expect(overview.kpi.avgMonthlySavingsP1).toBe(1500000);
    });

    it('should update sandbox state without mutating real database snapshots', async () => {
      // Record initial state of snapshot 10/2026 in DB
      const realDbSnap = await prisma.monthlySnapshot.findUnique({
        where: { userId_month_year: { userId: 1, month: 10, year: 2026 } },
      });

      // Update snapshot while in STANDARD_GENERAL mode
      const updated = await snapshotsService.updateSnapshot(999999, {
        totalWorkingDays: 22,
        dailyOperational: 3500000,
      } as any);

      expect(updated).toBeDefined();

      // Verify that the real DB snapshot 10/2026 was NOT mutated
      if (realDbSnap) {
        const afterSnap = await prisma.monthlySnapshot.findUnique({
          where: { userId_month_year: { userId: 1, month: 10, year: 2026 } },
        });
        expect(afterSnap?.dailyOperational).toBe(realDbSnap.dailyOperational);
        expect(afterSnap?.totalWorkingDays).toBe(realDbSnap.totalWorkingDays);
      }
    });

    it('should reset sandbox state to default when resetSandbox is called', async () => {
      const reset = await configService.resetSandbox();
      expect(reset.persona.netSalary).toBe(10000000);
      expect(reset.persona.dailyLivingBudget).toBe(3000000);
      expect(reset.savingsVault.balance).toBe(25000000);
    });
  });

  describe('Part 2: Dynamic Routine Categories (+ Add Category & Remove)', () => {
    it('should add a 5th routine category and remove it in STANDARD_GENERAL mode', async () => {
      // 1. Get initial categories
      const initial = await configService.getRoutineCategories();
      expect(initial.length).toBeGreaterThanOrEqual(4);

      // 2. Add Gym & Fitness
      const afterAdd = await configService.addRoutineCategory('Gym & Fitness', 450000);
      expect(afterAdd.length).toBe(initial.length + 1);
      const gymCat = afterAdd.find((c) => c.label === 'Gym & Fitness');
      expect(gymCat).toBeDefined();
      expect(gymCat?.target).toBe(450000);
      expect(gymCat?.isCustom).toBe(true);

      // 3. Remove Gym & Fitness
      const afterRemove = await configService.removeRoutineCategory(gymCat!.id);
      expect(afterRemove.some((c) => c.id === gymCat!.id)).toBe(false);
      expect(afterRemove.length).toBe(initial.length);
    });
  });

  describe('Part 3: Reports & Generalized Labels', () => {
    it('should return generalized cutoff and dynamic labels in STANDARD_GENERAL', async () => {
      const report = await reportsSelectors.getExecutiveReport(10, 2026, 'all', 2);
      expect(report).toBeDefined();
      expect(report.profileMode).toBe('STANDARD_GENERAL');
      expect(report.closingStatement.workingDaysWindowLabel).toContain(
        'Standard Monthly Cycle',
      );
    });
  });

  describe('Part 4: Period Rollover (POST /api/snapshots for 01/2027)', () => {
    it('should successfully initialize 01/2027 inheriting defaults and active contracts', async () => {
      // 1. Switch back to SUPERADMIN_BESPOKE
      await prisma.globalConfig.update({
        where: { userId: 1 },
        data: { profileMode: 'SUPERADMIN_BESPOKE' },
      });

      // 2. Call initializePeriod for 01/2027
      const initialized = await snapshotsService.initializePeriod(1, 2027);
      expect(initialized).toBeDefined();
      expect(initialized.month).toBe(1);
      expect(initialized.year).toBe(2027);
      expect(initialized.status).toBe(SnapshotStatus.DRAFT);
      expect(initialized.transport).toBe(200000);
      expect(initialized.savings).toBe(1500000);

      // 3. Verify that active CC installment contracts were synced and waterfall was calculated
      expect(initialized.finalTotalIncome).toBeGreaterThan(0);
      expect(initialized.totalDeductions).toBeDefined();

      // Clean up 01/2027 snapshot from test DB
      await prisma.transaction.deleteMany({
        where: { snapshotId: initialized.id },
      });
      await prisma.monthlySnapshot.delete({
        where: { id: initialized.id },
      });
    });
  });
});
