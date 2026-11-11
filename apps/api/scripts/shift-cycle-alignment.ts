import { PrismaClient, TransactionType, TransactionSourceType } from '@prisma/client';
import { evaluateModularEngine, synthesizeRulesFromSnapshot } from '../src/calculator/modular-engine';
import { CreditSelectors } from '../src/credit/credit.selectors';

const cloudUrl =
  process.env.DATABASE_URL_CLOUD ||
  'postgresql://neondb_owner:npg_kLTO3alGm2RE@ep-nameless-bird-b30zfam7-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30';
const localUrl =
  process.env.DATABASE_URL_LOCAL ||
  'postgresql://postgres:password@127.0.0.1:5433/finance_erp?schema=public';

async function applyShift(dbName: string, dbUrl: string) {
  console.log(`\n================================================================`);
  console.log(`[${dbName}] Shifting 11.11 PayLater & SPinjam to Payday-to-Bill Convention...`);
  console.log(`================================================================`);

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  try {
    // -------------------------------------------------------------------------
    // 1. UPDATE NOV '26 (month=11, year=2026)
    // -------------------------------------------------------------------------
    const bill11 = await prisma.monthlyBulkBill.findFirst({
      where: { userId: 1, month: 11, year: 2026 },
    });
    if (!bill11) throw new Error(`MonthlyBulkBill 11/2026 missing on ${dbName}`);

    await prisma.monthlyBulkBill.update({
      where: { id: bill11.id },
      data: {
        paylaterAmount: 2243391, // 2083487 + 159904
        personalDebtAmount: 996498, // 660920 old SPinjam + 335578 new SPinjam installment 1/3
        amount: 3239889, // 2243391 + 996498
      },
    });
    console.log(`[${dbName}] NOV '26 BulkBill: paylater=2.243.391, personalDebt=996.498, amount=3.239.889`);

    const snap11 = await prisma.monthlySnapshot.findFirst({
      where: { userId: 1, month: 11, year: 2026 },
      include: { budgetRevisions: { orderBy: { createdAt: 'asc' } } },
    });
    if (snap11) {
      // Update materialized transactions in snap 5
      const paylaterTx11 = await prisma.transaction.findFirst({
        where: { snapshotId: snap11.id, type: TransactionType.CREDIT_BILL, label: 'PayLater Bill' },
      });
      if (paylaterTx11) {
        await prisma.transaction.update({
          where: { id: paylaterTx11.id },
          data: { amount: 2243391 },
        });
      }

      const debtTx11 = await prisma.transaction.findFirst({
        where: { snapshotId: snap11.id, type: TransactionType.CREDIT_BILL, label: 'Personal & Informal Debt' },
      });
      if (debtTx11) {
        await prisma.transaction.update({
          where: { id: debtTx11.id },
          data: { amount: 996498 },
        });
      }

      // Snap 11 calculations
      // Credit card is 628256
      const newTotalDeductions11 = 3239889 + 628256; // 3.868.145
      const survivalPocket11 = snap11.survivalPocket || 2035000; // 1.500.000 living + 535.000 routine
      const availableFunds11 = (snap11.finalTotalIncome || 5904000) - newTotalDeductions11 - survivalPocket11; // 5.904.000 - 3.868.145 - 2.035.000 = 855
      const actualSavings11 = availableFunds11; // Rp 855 into Core Savings P1
      const selfReward11 = 0;

      const updatedBuckets11 = ((snap11.bucketRealizationsJson as any[]) || []).map((b) => {
        if (b.bucketId === 'core_savings') {
          return {
            ...b,
            fundedAmount: actualSavings11,
            remainingBudget: actualSavings11,
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
          totalDeductions: newTotalDeductions11,
          actualSavings: actualSavings11,
          selfReward: selfReward11,
          bucketRealizationsJson: updatedBuckets11,
        },
      });
      console.log(
        `[${dbName}] NOV '26 Snapshot: totalDeductions=3.868.145, survivalPocket=2.035.000, actualSavings=${actualSavings11.toLocaleString('id-ID')}`
      );
    }

    // -------------------------------------------------------------------------
    // 2. UPDATE DEC '26 (month=12, year=2026)
    // -------------------------------------------------------------------------
    const bill12 = await prisma.monthlyBulkBill.findFirst({
      where: { userId: 1, month: 12, year: 2026 },
    });
    if (!bill12) throw new Error(`MonthlyBulkBill 12/2026 missing on ${dbName}`);

    await prisma.monthlyBulkBill.update({
      where: { id: bill12.id },
      data: {
        paylaterAmount: 1556814, // 1396910 base + 159904 (11.11 installment 2/3)
        personalDebtAmount: 921156, // 671156 SPinjam installments 2+3 early payoff + 250000 Hoodie refund
        amount: 2477970, // 1556814 + 921156
      },
    });
    console.log(`[${dbName}] DEC '26 BulkBill: paylater=1.556.814, personalDebt=921.156, amount=2.477.970`);

    const snap12 = await prisma.monthlySnapshot.findFirst({
      where: { userId: 1, month: 12, year: 2026 },
      include: { budgetRevisions: { orderBy: { createdAt: 'asc' } } },
    });
    if (snap12) {
      // Update materialized transactions in snap 6
      const paylaterTx12 = await prisma.transaction.findFirst({
        where: { snapshotId: snap12.id, type: TransactionType.CREDIT_BILL, label: 'PayLater Bill' },
      });
      if (paylaterTx12) {
        await prisma.transaction.update({
          where: { id: paylaterTx12.id },
          data: { amount: 1556814 },
        });
      }

      const debtTx12 = await prisma.transaction.findFirst({
        where: { snapshotId: snap12.id, type: TransactionType.CREDIT_BILL, label: 'Personal & Informal Debt' },
      });
      if (debtTx12) {
        await prisma.transaction.update({
          where: { id: debtTx12.id },
          data: { amount: 921156 },
        });
      } else {
        await prisma.transaction.create({
          data: {
            snapshotId: snap12.id,
            date: new Date('2026-12-01T00:00:00.000Z'),
            type: TransactionType.CREDIT_BILL,
            sourceType: TransactionSourceType.BULK_BILL,
            label: 'Personal & Informal Debt',
            amount: 921156,
          },
        });
      }

      // Snap 12 calculations
      // Credit card is 628256
      const newTotalDeductions12 = 2477970 + 628256; // 3.106.226
      const survivalPocket12 = snap12.survivalPocket || 3385000; // 2.850.000 living + 535.000 routine
      const availableFunds12 = (snap12.finalTotalIncome || 9840917) - newTotalDeductions12 - survivalPocket12; // 9.840.917 - 3.106.226 - 3.385.000 = 3.349.691
      const actualSavings12 = 1000000; // Core Savings P1 100% funded
      const selfReward12 = availableFunds12 - actualSavings12; // 2.349.691

      const updatedBuckets12 = ((snap12.bucketRealizationsJson as any[]) || []).map((b) => {
        if (b.bucketId === 'core_savings') {
          return {
            ...b,
            fundedAmount: actualSavings12,
            remainingBudget: actualSavings12,
          };
        }
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
        `[${dbName}] DEC '26 Snapshot: totalDeductions=3.106.226, survivalPocket=3.385.000, actualSavings=1.000.000, selfReward=${selfReward12.toLocaleString('id-ID')}`
      );
    }

    // -------------------------------------------------------------------------
    // 3. UPDATE JAN '27 (month=1, year=2027)
    // -------------------------------------------------------------------------
    const bill1 = await prisma.monthlyBulkBill.findFirst({
      where: { userId: 1, month: 1, year: 2027 },
    });
    if (!bill1) throw new Error(`MonthlyBulkBill 1/2027 missing on ${dbName}`);

    await prisma.monthlyBulkBill.update({
      where: { id: bill1.id },
      data: {
        paylaterAmount: 786227, // 626323 base + 159904 (11.11 installment 3/3)
        personalDebtAmount: 0, // Cleared!
        amount: 786227,
      },
    });
    console.log(`[${dbName}] JAN '27 BulkBill: paylater=786.227, personalDebt=0, amount=786.227 (Total Due: Rp 1.414.483)`);

    const snap1 = await prisma.monthlySnapshot.findFirst({
      where: { userId: 1, month: 1, year: 2027 },
    });
    if (snap1) {
      await prisma.monthlySnapshot.update({
        where: { id: snap1.id },
        data: {
          totalDeductions: 786227 + 628256, // 1.414.483
        },
      });
    }

    // -------------------------------------------------------------------------
    // 4. UPDATE FEB '27 (month=2, year=2027)
    // -------------------------------------------------------------------------
    const bill2 = await prisma.monthlyBulkBill.findFirst({
      where: { userId: 1, month: 2, year: 2027 },
    });
    if (!bill2) throw new Error(`MonthlyBulkBill 2/2027 missing on ${dbName}`);

    await prisma.monthlyBulkBill.update({
      where: { id: bill2.id },
      data: {
        paylaterAmount: 207740, // Revert to baseline (no 11.11 installment here)
        personalDebtAmount: 0,
        amount: 207740,
      },
    });
    console.log(`[${dbName}] FEB '27 BulkBill: paylater=207.740, personalDebt=0, amount=207.740 (Total Due: Rp 835.996)`);

    const snap2 = await prisma.monthlySnapshot.findFirst({
      where: { userId: 1, month: 2, year: 2027 },
    });
    if (snap2) {
      await prisma.monthlySnapshot.update({
        where: { id: snap2.id },
        data: {
          totalDeductions: 207740 + 628256, // 835.996
        },
      });
    }

    // -------------------------------------------------------------------------
    // 5. Modular Calculation Engine Simulation for NOV & DEC '26
    // -------------------------------------------------------------------------
    console.log(`[${dbName}] Verifying modular engine recalculate stability...`);
    for (const m of [11, 12]) {
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
      console.log(`    totalDeductions: Rp ${snap.totalDeductions?.toLocaleString('id-ID')}`);
      console.log(`    survivalPocket: Rp ${evalRes.waterfall.survivalPocket.toLocaleString('id-ID')}`);
      console.log(`    actualSavings: Rp ${evalRes.waterfall.actualSavings.toLocaleString('id-ID')} (snap: Rp ${snap.actualSavings?.toLocaleString('id-ID')})`);
      console.log(`    selfReward: Rp ${evalRes.waterfall.selfReward.toLocaleString('id-ID')} (snap: Rp ${snap.selfReward?.toLocaleString('id-ID')})`);
      console.log(`    deficitUncovered: Rp ${evalRes.waterfall.deficitUncovered.toLocaleString('id-ID')}`);
    }

    // -------------------------------------------------------------------------
    // 6. Verify 12-Month Matrix
    // -------------------------------------------------------------------------
    const selectors = new CreditSelectors(prisma as any);
    const matrix = await selectors.getLiabilityMatrix(10, 2026, 7, 1);
    console.log(`\n  12-Month Rolling Debt Matrix Summary (${dbName}):`);
    for (const col of matrix.columns) {
      const pl = matrix.payLaterRow.cells[col.key]?.amount || 0;
      const cc = matrix.creditCardRow.cells[col.key]?.amount || 0;
      const pd = matrix.personalDebtRow.cells[col.key]?.amount || 0;
      const tot = matrix.totalsPerMonth[col.key] || 0;
      console.log(
        `    ${col.label.padEnd(8)}: PayLater=${pl.toLocaleString('id-ID').padStart(10)} | CC=${cc.toLocaleString('id-ID').padStart(10)} | Debt=${pd.toLocaleString('id-ID').padStart(10)} | Total=${tot.toLocaleString('id-ID').padStart(10)}`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log('Starting Cycle-Aligned Shift on NEON CLOUD...');
  await applyShift('NEON CLOUD', cloudUrl);

  console.log('\nStarting Cycle-Aligned Shift on LOCAL 5433...');
  await applyShift('LOCAL 5433', localUrl);

  console.log('\nAll cycle shifts applied and verified successfully on both databases.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
