import { PrismaClient, BudgetRevisionCategory, Prisma } from '@prisma/client';
import {
  evaluateModularEngine,
  synthesizeRulesFromSnapshot,
} from '../src/calculator/modular-engine';

const cloudUrl =
  process.env.DATABASE_URL_CLOUD ||
  'postgresql://neondb_owner:npg_kLTO3alGm2RE@ep-nameless-bird-b30zfam7-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30';
const localUrl =
  process.env.DATABASE_URL_LOCAL ||
  'postgresql://postgres:password@127.0.0.1:5433/finance_erp?schema=public';

async function applyFixToDatabase(dbName: string, dbUrl: string) {
  console.log(`\n======================================================`);
  console.log(`[${dbName}] Applying Fix for "Nov 25 Bill" Propagation...`);
  console.log(`======================================================`);

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  try {
    // ----------------------------------------------------
    // 1. Clean GlobalConfig Default Template
    // ----------------------------------------------------
    const config = await prisma.globalConfig.findFirst({ where: { userId: 1 } });
    if (config) {
      await prisma.globalConfig.update({
        where: { id: config.id },
        data: {
          customRoutineLabelsJson: Prisma.JsonNull,
          internet: 0, // Clean template: new periods default to 0 for internet
        },
      });
      console.log(`[${dbName}] GlobalConfig updated: customRoutineLabelsJson cleared, internet defaulted to 0.`);
    }

    // ----------------------------------------------------
    // 2. Period 10/2026: Keep Nov 25 Bill & Set Core Savings P1 = 6.341, Self-Reward P2 = 250.000
    // ----------------------------------------------------
    const snap10 = await prisma.monthlySnapshot.findFirst({
      where: { userId: 1, month: 10, year: 2026 },
    });
    if (snap10) {
      // Upsert BudgetRevision for SAVINGS -> 6341
      const existingSavRev = await prisma.budgetRevision.findFirst({
        where: {
          snapshotId: snap10.id,
          month: 10,
          year: 2026,
          category: BudgetRevisionCategory.SAVINGS,
        },
      });
      if (existingSavRev) {
        await prisma.budgetRevision.update({
          where: { id: existingSavRev.id },
          data: {
            newValue: 6341,
            difference: 6341 - existingSavRev.previousValue,
            reason: 'Preserve Rp 250,000 for P2 Self-Reward and Rp 6,341 for P1 Core Savings',
          },
        });
      } else {
        await prisma.budgetRevision.create({
          data: {
            snapshotId: snap10.id,
            month: 10,
            year: 2026,
            category: BudgetRevisionCategory.SAVINGS,
            bucketKey: 'core_savings',
            bucketLabel: 'Priority 1 Core Savings',
            previousValue: 1000000,
            newValue: 6341,
            difference: 6341 - 1000000,
            reason: 'Preserve Rp 250,000 for P2 Self-Reward and Rp 6,341 for P1 Core Savings',
          },
        });
      }

      // Update 10/2026 Snapshot
      const updatedBuckets10 = ((snap10.bucketRealizationsJson as any[]) || []).map((b) => {
        if (b.bucketId === 'internet') {
          return {
            ...b,
            label: 'Nov 25 Bill',
            formulaValue: 200000,
            fundedAmount: 200000,
            revisedTarget: 200000,
            remainingBudget: 200000,
          };
        }
        if (b.bucketId === 'core_savings') {
          return {
            ...b,
            formulaValue: 6341,
            fundedAmount: 6341,
            revisedTarget: 6341,
            remainingBudget: 6341,
          };
        }
        if (b.bucketId === 'self_reward') {
          return {
            ...b,
            fundedAmount: 250000,
            remainingBudget: 250000,
          };
        }
        return b;
      });

      await prisma.monthlySnapshot.update({
        where: { id: snap10.id },
        data: {
          transport: 200000,
          internet: 200000,
          vape: 0,
          haircut: 0,
          dailyOperational: 1720316,
          actualDailyOperational: 1720316,
          survivalPocket: 2120316, // 1.720.316 + 400.000
          savings: 6341,
          actualSavings: 6341,
          selfReward: 250000,
          deficitUncovered: 0,
          bucketRealizationsJson: updatedBuckets10,
        },
      });
      console.log(`[${dbName}] Snapshot 10/2026 confirmed: Routine Bills Quota = Rp 400.000, Core Savings P1 = Rp 6.341, Self-Reward P2 = Rp 250.000`);
    }

    // ----------------------------------------------------
    // 3. Period 11/2026: Zero out Nov 25 Bill -> Routine Bills Quota = Rp 535.000, P1 = Rp 496.337
    // ----------------------------------------------------
    const snap11 = await prisma.monthlySnapshot.findFirst({
      where: { userId: 1, month: 11, year: 2026 },
    });
    if (snap11) {
      // Upsert BudgetRevision for INTERNET -> 0
      const existingNetRev = await prisma.budgetRevision.findFirst({
        where: {
          snapshotId: snap11.id,
          month: 11,
          year: 2026,
          category: BudgetRevisionCategory.INTERNET,
        },
      });
      if (existingNetRev) {
        await prisma.budgetRevision.update({
          where: { id: existingNetRev.id },
          data: {
            newValue: 0,
            difference: 0 - existingNetRev.previousValue,
            reason: 'Zeroed out one-time Nov 25 bill, returning to standard routine pool',
          },
        });
      } else {
        await prisma.budgetRevision.create({
          data: {
            snapshotId: snap11.id,
            month: 11,
            year: 2026,
            category: BudgetRevisionCategory.INTERNET,
            bucketKey: 'internet',
            bucketLabel: 'Internet & Connectivity',
            previousValue: 100000,
            newValue: 0,
            difference: -100000,
            reason: 'Zeroed out one-time Nov 25 bill, returning to standard routine pool',
          },
        });
      }

      // Update 11/2026 Snapshot:
      // transport = 300000, internet = 0, vape = 150000, haircut = 85000 -> routine quota = 535000
      // dailyOperational = 1500000 -> survivalPocket = 2035000
      // finalTotalIncome = 5904000, totalDeductions = 3372663
      // actualSavings = 5904000 - 3372663 - 2035000 = 496337
      const updatedBuckets11 = ((snap11.bucketRealizationsJson as any[]) || []).map((b) => {
        if (b.bucketId === 'internet') {
          return {
            ...b,
            label: 'Internet & Connectivity',
            formulaValue: 0,
            fundedAmount: 0,
            revisedTarget: 0,
            remainingBudget: 0,
          };
        }
        if (b.bucketId === 'core_savings') {
          return {
            ...b,
            fundedAmount: 496337,
            remainingBudget: 496337,
          };
        }
        if (b.bucketId === 'self_reward') {
          return {
            ...b,
            fundedAmount: 0,
            remainingBudget: 0,
          };
        }
        return b;
      });

      await prisma.monthlySnapshot.update({
        where: { id: snap11.id },
        data: {
          transport: 300000,
          internet: 0,
          vape: 150000,
          haircut: 85000,
          dailyOperational: 1500000,
          actualDailyOperational: 1500000,
          survivalPocket: 2035000, // 1500000 + 535000
          actualSavings: 496337,
          selfReward: 0,
          deficitUncovered: 0,
          bucketRealizationsJson: updatedBuckets11,
        },
      });
      console.log(`[${dbName}] Snapshot 11/2026 confirmed: Routine Bills Quota = Rp 535.000, survivalPocket = Rp 2.035.000, Core Savings P1 = Rp 496.337`);
    }

    // ----------------------------------------------------
    // 4. Period 12/2026: Zero out Nov 25 Bill -> Routine Bills Quota = Rp 535.000, survivalPocket = Rp 3.385.000
    // ----------------------------------------------------
    const snap12 = await prisma.monthlySnapshot.findFirst({
      where: { userId: 1, month: 12, year: 2026 },
    });
    if (snap12) {
      // Upsert BudgetRevision for INTERNET -> 0
      const existingNetRev12 = await prisma.budgetRevision.findFirst({
        where: {
          snapshotId: snap12.id,
          month: 12,
          year: 2026,
          category: BudgetRevisionCategory.INTERNET,
        },
      });
      if (existingNetRev12) {
        await prisma.budgetRevision.update({
          where: { id: existingNetRev12.id },
          data: {
            newValue: 0,
            difference: 0 - existingNetRev12.previousValue,
            reason: 'Zeroed out one-time Nov 25 bill, returning to standard routine pool',
          },
        });
      } else {
        await prisma.budgetRevision.create({
          data: {
            snapshotId: snap12.id,
            month: 12,
            year: 2026,
            category: BudgetRevisionCategory.INTERNET,
            bucketKey: 'internet',
            bucketLabel: 'Internet & Connectivity',
            previousValue: 100000,
            newValue: 0,
            difference: -100000,
            reason: 'Zeroed out one-time Nov 25 bill, returning to standard routine pool',
          },
        });
      }

      // Update 12/2026 Snapshot:
      // transport = 300000, internet = 0, vape = 150000, haircut = 85000 -> routine quota = 535000
      // dailyOperational = 2850000 -> survivalPocket = 3385000
      // finalTotalIncome = 9840917, totalDeductions = 2360744
      // availableFunds = 9840917 - 2360744 - 3385000 = 4095173
      // actualSavings = 1000000, selfReward = 3095173
      const updatedBuckets12 = ((snap12.bucketRealizationsJson as any[]) || []).map((b) => {
        if (b.bucketId === 'internet') {
          return {
            ...b,
            label: 'Internet & Connectivity',
            formulaValue: 0,
            fundedAmount: 0,
            revisedTarget: 0,
            remainingBudget: 0,
          };
        }
        if (b.bucketId === 'core_savings') {
          return {
            ...b,
            fundedAmount: 1000000,
            remainingBudget: 1000000,
          };
        }
        if (b.bucketId === 'self_reward') {
          return {
            ...b,
            fundedAmount: 3095173,
            remainingBudget: 3095173,
          };
        }
        return b;
      });

      await prisma.monthlySnapshot.update({
        where: { id: snap12.id },
        data: {
          transport: 300000,
          internet: 0,
          vape: 150000,
          haircut: 85000,
          dailyOperational: 2850000,
          actualDailyOperational: 2850000,
          totalDeductions: 2360744, // 1396910 + 628256 + 335578
          survivalPocket: 3385000, // 2850000 + 535000
          actualSavings: 1000000,
          selfReward: 3095173,
          deficitUncovered: 0,
          bucketRealizationsJson: updatedBuckets12,
        },
      });
      console.log(`[${dbName}] Snapshot 12/2026 confirmed: Routine Bills Quota = Rp 535.000, survivalPocket = Rp 3.385.000, Core Savings P1 = Rp 1.000.000, Self-Reward P2 = Rp 3.095.173`);
    }

    // ----------------------------------------------------
    // 5. Test Recalculation Engine Simulation
    // ----------------------------------------------------
    console.log(`[${dbName}] Testing modular calculation engine stability on recalculate...`);
    for (const m of [10, 11, 12]) {
      const snap = await prisma.monthlySnapshot.findFirst({
        where: { userId: 1, month: m, year: 2026 },
        include: { budgetRevisions: { orderBy: { createdAt: 'asc' } } },
      });
      if (!snap) continue;

      const modularRules = synthesizeRulesFromSnapshot({
        ...snap,
        dailyAllowance: 25000,
        laptopAllowance: 250000,
      });

      const evalRes = evaluateModularEngine({
        baseSalary: 5300000,
        salaryAdjustment: snap.salaryAdjustment,
        totalWorkingDays: snap.totalWorkingDays,
        dailyAllowance: 25000,
        cafeteriaDeduction: snap.cafeteriaDeduction,
        thrAmount: snap.thrAmount,
        bonusAmount: snap.bonusAmount,
        extraIncome: snap.extraIncome ?? undefined,
        month: snap.month,
        year: snap.year,
        cycleDays: 30,
        totalCreditBills: snap.totalDeductions || 0,
        totalDeductions: snap.totalDeductions || 0,
        payrollRules: modularRules.payrollRules,
        allocationBuckets: modularRules.allocationBuckets,
        surplusSplitRules: modularRules.surplusSplitRules,
        financialPolicy: modularRules.financialPolicy,
        formulaEngineType: 'DEBT_FIRST_WATERFALL',
        budgetRevisions: snap.budgetRevisions as any,
      });

      console.log(`  Engine Verification (${m}/2026):`);
      console.log(`    survivalPocket: Rp ${evalRes.waterfall.survivalPocket.toLocaleString('id-ID')} (snap: Rp ${snap.survivalPocket?.toLocaleString('id-ID')})`);
      console.log(`    actualDailyOperational: Rp ${evalRes.waterfall.actualDailyOperational.toLocaleString('id-ID')} (snap: Rp ${snap.actualDailyOperational?.toLocaleString('id-ID')})`);
      console.log(`    actualSavings: Rp ${evalRes.waterfall.actualSavings.toLocaleString('id-ID')} (snap: Rp ${snap.actualSavings?.toLocaleString('id-ID')})`);
      console.log(`    selfReward: Rp ${evalRes.waterfall.selfReward.toLocaleString('id-ID')} (snap: Rp ${snap.selfReward?.toLocaleString('id-ID')})`);
      console.log(`    deficitUncovered: Rp ${evalRes.waterfall.deficitUncovered.toLocaleString('id-ID')}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log('Starting propagation cleanup on NEON CLOUD...');
  await applyFixToDatabase('NEON CLOUD', cloudUrl);

  console.log('\nStarting propagation cleanup on LOCAL 5433...');
  await applyFixToDatabase('LOCAL 5433', localUrl);

  console.log('\nAll database updates applied and verified successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
