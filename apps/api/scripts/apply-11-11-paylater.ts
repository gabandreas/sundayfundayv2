import { PrismaClient } from '@prisma/client';
import { evaluateModularEngine, synthesizeRulesFromSnapshot } from '../src/calculator/modular-engine';

const cloudUrl =
  process.env.DATABASE_URL_CLOUD ||
  'postgresql://neondb_owner:npg_kLTO3alGm2RE@ep-nameless-bird-b30zfam7-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30';
const localUrl =
  process.env.DATABASE_URL_LOCAL ||
  'postgresql://postgres:password@127.0.0.1:5433/finance_erp?schema=public';

const PAYLATER_DELTA = 159904;

async function applyToDatabase(dbName: string, dbUrl: string) {
  console.log(`\n======================================================`);
  console.log(`[${dbName}] Applying 11.11 PayLater Installments (+Rp 159.904/mo)...`);
  console.log(`======================================================`);

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  try {
    // 1. Update DEC '26 (month=12, year=2026)
    const bill12 = await prisma.monthlyBulkBill.findFirst({
      where: { userId: 1, month: 12, year: 2026 },
    });
    if (!bill12) {
      throw new Error(`MonthlyBulkBill for 12/2026 not found on ${dbName}`);
    }
    const oldPaylater12 = bill12.paylaterAmount;
    const newPaylater12 = oldPaylater12 + PAYLATER_DELTA;
    const newTotal12 = newPaylater12 + bill12.personalDebtAmount;

    await prisma.monthlyBulkBill.update({
      where: { id: bill12.id },
      data: {
        paylaterAmount: newPaylater12,
        amount: newTotal12,
      },
    });
    console.log(
      `[${dbName}] DEC '26 BulkBill: paylater ${oldPaylater12.toLocaleString('id-ID')} -> ${newPaylater12.toLocaleString('id-ID')} (+${PAYLATER_DELTA}), total=${newTotal12.toLocaleString('id-ID')}`
    );

    // Update Transaction in snap 12/2026 if exists
    const snap12 = await prisma.monthlySnapshot.findFirst({
      where: { userId: 1, month: 12, year: 2026 },
      include: { budgetRevisions: { orderBy: { createdAt: 'asc' } } },
    });
    if (snap12) {
      const paylaterTx = await prisma.transaction.findFirst({
        where: {
          snapshotId: snap12.id,
          type: 'CREDIT_BILL',
          label: 'PayLater Bill',
        },
      });
      if (paylaterTx) {
        await prisma.transaction.update({
          where: { id: paylaterTx.id },
          data: { amount: newPaylater12 },
        });
        console.log(`[${dbName}] DEC '26 Snapshot Transaction "PayLater Bill" updated to Rp ${newPaylater12.toLocaleString('id-ID')}`);
      }

      // Recompute snap 12 liabilities and waterfall
      // Total CC is 628256
      const ccAmount = 628256;
      const newTotalDeductions12 = newTotal12 + ccAmount; // 1.892.392 + 628.256 = 2.520.648
      const survivalPocket12 = snap12.survivalPocket || 3385000;
      const availableFunds12 = (snap12.finalTotalIncome || 9840917) - newTotalDeductions12 - survivalPocket12; // 9.840.917 - 2.520.648 - 3.385.000 = 3.935.269
      const actualSavings12 = 1000000; // P1 core savings target is fully funded
      const selfReward12 = availableFunds12 - actualSavings12; // 2.935.269

      const updatedBuckets12 = ((snap12.bucketRealizationsJson as any[]) || []).map((b) => {
        if (b.bucketId === 'self_reward') {
          return {
            ...b,
            fundedAmount: selfReward12,
            remainingBudget: selfReward12,
          };
        }
        return b;
      });

      await prisma.monthlySnapshot.update({
        where: { id: snap12.id },
        data: {
          totalDeductions: newTotalDeductions12,
          actualSavings: actualSavings12,
          selfReward: selfReward12,
          bucketRealizationsJson: updatedBuckets12,
        },
      });
      console.log(
        `[${dbName}] DEC '26 Snapshot: totalDeductions=${newTotalDeductions12.toLocaleString('id-ID')}, actualSavings=${actualSavings12.toLocaleString('id-ID')}, selfReward=${selfReward12.toLocaleString('id-ID')}`
      );
    }

    // 2. Update JAN '27 (month=1, year=2027)
    const bill1 = await prisma.monthlyBulkBill.findFirst({
      where: { userId: 1, month: 1, year: 2027 },
    });
    if (!bill1) {
      throw new Error(`MonthlyBulkBill for 1/2027 not found on ${dbName}`);
    }
    const oldPaylater1 = bill1.paylaterAmount;
    const newPaylater1 = oldPaylater1 + PAYLATER_DELTA;
    const newTotal1 = newPaylater1 + bill1.personalDebtAmount;

    await prisma.monthlyBulkBill.update({
      where: { id: bill1.id },
      data: {
        paylaterAmount: newPaylater1,
        amount: newTotal1,
      },
    });
    console.log(
      `[${dbName}] JAN '27 BulkBill: paylater ${oldPaylater1.toLocaleString('id-ID')} -> ${newPaylater1.toLocaleString('id-ID')} (+${PAYLATER_DELTA}), total=${newTotal1.toLocaleString('id-ID')}`
    );

    // 3. Update FEB '27 (month=2, year=2027)
    const bill2 = await prisma.monthlyBulkBill.findFirst({
      where: { userId: 1, month: 2, year: 2027 },
    });
    if (!bill2) {
      throw new Error(`MonthlyBulkBill for 2/2027 not found on ${dbName}`);
    }
    const oldPaylater2 = bill2.paylaterAmount;
    const newPaylater2 = oldPaylater2 + PAYLATER_DELTA;
    const newTotal2 = newPaylater2 + bill2.personalDebtAmount;

    await prisma.monthlyBulkBill.update({
      where: { id: bill2.id },
      data: {
        paylaterAmount: newPaylater2,
        amount: newTotal2,
      },
    });
    console.log(
      `[${dbName}] FEB '27 BulkBill: paylater ${oldPaylater2.toLocaleString('id-ID')} -> ${newPaylater2.toLocaleString('id-ID')} (+${PAYLATER_DELTA}), total=${newTotal2.toLocaleString('id-ID')}`
    );

    // 4. Test Recalculation Engine Simulation for DEC '26
    if (snap12) {
      const refreshedSnap12 = await prisma.monthlySnapshot.findUnique({
        where: { id: snap12.id },
        include: { budgetRevisions: { orderBy: { createdAt: 'asc' } } },
      });
      const modularRules = synthesizeRulesFromSnapshot({
        ...refreshedSnap12!,
        dailyAllowance: 25000,
        laptopAllowance: 250000,
      });

      const evalRes = evaluateModularEngine({
        baseSalary: 5300000,
        salaryAdjustment: refreshedSnap12!.salaryAdjustment,
        totalWorkingDays: refreshedSnap12!.totalWorkingDays,
        dailyAllowance: 25000,
        cafeteriaDeduction: refreshedSnap12!.cafeteriaDeduction,
        thrAmount: refreshedSnap12!.thrAmount,
        bonusAmount: refreshedSnap12!.bonusAmount,
        extraIncome: refreshedSnap12!.extraIncome ?? undefined,
        month: 12,
        year: 2026,
        cycleDays: 30,
        totalCreditBills: refreshedSnap12!.totalDeductions || 0,
        totalDeductions: refreshedSnap12!.totalDeductions || 0,
        payrollRules: modularRules.payrollRules,
        allocationBuckets: modularRules.allocationBuckets,
        surplusSplitRules: modularRules.surplusSplitRules,
        financialPolicy: modularRules.financialPolicy,
        formulaEngineType: 'DEBT_FIRST_WATERFALL',
        budgetRevisions: refreshedSnap12!.budgetRevisions as any,
      });

      console.log(`  Engine Verification (12/2026 after 11.11 paylater):`);
      console.log(`    totalDeductions: Rp ${refreshedSnap12!.totalDeductions?.toLocaleString('id-ID')}`);
      console.log(`    survivalPocket: Rp ${evalRes.waterfall.survivalPocket.toLocaleString('id-ID')}`);
      console.log(`    actualSavings: Rp ${evalRes.waterfall.actualSavings.toLocaleString('id-ID')}`);
      console.log(`    selfReward: Rp ${evalRes.waterfall.selfReward.toLocaleString('id-ID')}`);
      console.log(`    deficitUncovered: Rp ${evalRes.waterfall.deficitUncovered.toLocaleString('id-ID')}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log('Starting 11.11 PayLater update on NEON CLOUD...');
  await applyToDatabase('NEON CLOUD', cloudUrl);

  console.log('\nStarting 11.11 PayLater update on LOCAL 5433...');
  await applyToDatabase('LOCAL 5433', localUrl);

  console.log('\n11.11 PayLater installments successfully recorded and synced across both databases.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
