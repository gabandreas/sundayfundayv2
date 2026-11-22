import { PrismaClient } from '../apps/api/node_modules/@prisma/client';

const NEON_URL =
  process.env.NEON_DATABASE_URL ||
  'postgresql://neondb_owner:npg_kLTO3alGm2RE@ep-nameless-bird-b30zfam7-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30';

function addOneMonth(month: number, year: number): { month: number; year: number } {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
}

async function migrateDb(dbUrl: string, label: string) {
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    await prisma.$connect();
  } catch (err: any) {
    console.log(`[${label}] Skipping unreachable DB: ${err.message}`);
    return;
  }

  try {
    const snapshots = await prisma.monthlySnapshot.findMany({
      where: { userId: 1 },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const oct28Snap = snapshots.find(
      (s) =>
        s.payrollPayoutDate &&
        s.payrollPayoutDate.toISOString().slice(0, 10) === '2026-10-28',
    );

    const needsPeriodShift = oct28Snap?.month === 10 && oct28Snap?.year === 2026;
    console.log(
      `[${label}] Found ${snapshots.length} snapshots for userId=1. oct28Snap=${oct28Snap?.month}/${oct28Snap?.year} (needsPeriodShift=${needsPeriodShift})`,
    );

    await prisma.$transaction(
      async (tx) => {
        if (needsPeriodShift) {
          // 1. Shift MonthlySnapshot in DESC order to avoid (userId, month, year) unique constraint collision
          for (const s of snapshots) {
            const next = addOneMonth(s.month, s.year);
            await tx.monthlySnapshot.update({
              where: { id: s.id },
              data: { month: next.month, year: next.year },
            });
          }

          // 2. Shift MonthlyBulkBill in DESC order
          const bulkBills = await tx.monthlyBulkBill.findMany({
            where: { userId: 1 },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
          });
          for (const b of bulkBills) {
            const next = addOneMonth(b.month, b.year);
            await tx.monthlyBulkBill.update({
              where: { id: b.id },
              data: { month: next.month, year: next.year },
            });
          }

          // 3. Shift LiabilityLineItem
          const lineItems = await tx.liabilityLineItem.findMany({
            where: { userId: 1 },
          });
          for (const li of lineItems) {
            const next = addOneMonth(li.month, li.year);
            await tx.liabilityLineItem.update({
              where: { id: li.id },
              data: { month: next.month, year: next.year },
            });
          }

          // 4. Shift BudgetRevision
          const revisions = await tx.budgetRevision.findMany({
            where: { snapshot: { userId: 1 } },
          });
          for (const rev of revisions) {
            const next = addOneMonth(rev.month, rev.year);
            await tx.budgetRevision.update({
              where: { id: rev.id },
              data: { month: next.month, year: next.year },
            });
          }

          // 5. Shift CreditCardTransaction billingMonth/Year, stoppedAtMonth/Year, endedAtMonth/Year
          const cards = await tx.creditCardTransaction.findMany({
            where: { userId: 1 },
          });
          for (const c of cards) {
            const nextBill = addOneMonth(c.billingMonth, c.billingYear);
            const nextStop =
              c.stoppedAtMonth != null && c.stoppedAtYear != null
                ? addOneMonth(c.stoppedAtMonth, c.stoppedAtYear)
                : null;
            const nextEnd =
              c.endedAtMonth != null && c.endedAtYear != null
                ? addOneMonth(c.endedAtMonth, c.endedAtYear)
                : null;
            await tx.creditCardTransaction.update({
              where: { id: c.id },
              data: {
                billingMonth: nextBill.month,
                billingYear: nextBill.year,
                ...(nextStop
                  ? { stoppedAtMonth: nextStop.month, stoppedAtYear: nextStop.year }
                  : {}),
                ...(nextEnd
                  ? { endedAtMonth: nextEnd.month, endedAtYear: nextEnd.year }
                  : {}),
              },
            });
          }

          // 6. Update SavingsManualTransaction label
          await tx.savingsManualTransaction.updateMany({
            where: { userId: 1, label: 'P1 Savings Transfer (10/2026)' },
            data: { label: 'P1 Savings Transfer (11/2026)' },
          });
        }

        // 7. Ensure historical 07/2026..10/2026 are LOCKED
        await tx.monthlySnapshot.updateMany({
          where: {
            userId: 1,
            year: 2026,
            month: { in: [7, 8, 9, 10] },
          },
          data: { status: 'LOCKED' },
        });

        // 8. Forensically restore 11/2026 (28 Oct – 26 Nov 2026 — ACTIVE TODAY on Nov 22: Day 26 of 30)
        const nov26 = await tx.monthlySnapshot.findUniqueOrThrow({
          where: { userId_month_year: { userId: 1, month: 11, year: 2026 } },
          include: { transactions: true, budgetRevisions: true },
        });

        // Remove corrupted 461,147 budget revision if present
        await tx.budgetRevision.deleteMany({
          where: {
            snapshotId: nov26.id,
            newValue: 461147,
          },
        });

        // Ensure Nov 25 Bill (Rp 200,000, fixedEssentialCategory = 'INTERNET') transaction exists
        const hasNov25BillTx = nov26.transactions.some(
          (t) =>
            t.type === 'DEDUCTION' &&
            t.fixedEssentialCategory === 'INTERNET' &&
            Math.round(t.amount) === 200000,
        );
        if (!hasNov25BillTx) {
          await tx.transaction.create({
            data: {
              snapshotId: nov26.id,
              label: 'Nov 25 Bill',
              amount: 200000,
              type: 'DEDUCTION',
              sourceType: 'MANUAL',
              fixedEssentialCategory: 'INTERNET',
              bucketKey: 'internet',
              date: new Date('2026-11-15T00:00:00.000Z'),
            },
          });
        }

        // Ensure Balance Checkpoint: Unitemized Daily Spend (Rp 291,000) exists so Spent = 1,420,316 and Remaining = 300,000
        const hasCheckpoint291 = nov26.transactions.some(
          (t) =>
            t.type === 'DEDUCTION' &&
            !t.fixedEssentialCategory &&
            Math.round(t.amount) === 291000,
        );
        if (!hasCheckpoint291) {
          await tx.transaction.create({
            data: {
              snapshotId: nov26.id,
              label: 'Balance Checkpoint: Unitemized Daily Spend',
              amount: 291000,
              type: 'DEDUCTION',
              sourceType: 'MANUAL',
              fixedEssentialCategory: null,
              date: new Date('2026-11-16T00:00:00.000Z'),
            },
          });
        }

        await tx.monthlySnapshot.update({
          where: { id: nov26.id },
          data: {
            status: 'DRAFT',
            payrollPayoutDate: new Date('2026-10-28T00:00:00.000Z'),
            isPayoutDateConfirmed: true,
            totalWorkingDays: 20,
            salaryAdjustment: 0,
            cafeteriaDeduction: 0,
            thrAmount: 0,
            bonusAmount: 0,
            extraIncome: 0,
            netSalaryIncome: 5891000,
            finalTotalIncome: 5891000,
            bridgeInflowAmount: 900000,
            totalDeductions: 4522976,
            transport: 200000,
            internet: 200000,
            vape: 0,
            haircut: 0,
            oneOffBillsJson: [{ slot: 'INTERNET', label: 'Nov 25 Bill' }] as any,
            dailyOperational: 1720316,
            actualDailyOperational: 1720316,
            savings: 6341,
            actualSavings: 6341,
            lockedP1: 6341,
            selfRewardTarget: 250000,
            selfReward: 250000,
            lockedP2: 250000,
            survivalPocket: 2120316,
            bufferPocket: 0,
            isManualOverride: true,
            deficitUncovered: 0,
          },
        });

        // 9. Update GlobalConfig for userId=1
        const cfg = await tx.globalConfig.findFirst({ where: { userId: 1 } });
        if (cfg) {
          const fp: any =
            cfg.formulaParamsJson && typeof cfg.formulaParamsJson === 'object'
              ? { ...(cfg.formulaParamsJson as any) }
              : {};
          fp.paycycleFormulaConfig = {
            ...(fp.paycycleFormulaConfig || {}),
            ledgerEpochMonth: 11,
            ledgerEpochYear: 2026,
            periodOverrides: {
              '11/2026': {
                payslipDateIso: '2026-10-23',
                paydayDateIso: '2026-10-28',
                note: 'Oct 28 Payday',
              },
              '01/2027': {
                payslipDateIso: '2026-12-23',
                paydayDateIso: '2026-12-28',
                note: 'Holiday Schedule',
              },
            },
          };

          const finPol: any =
            cfg.financialPolicyJson && typeof cfg.financialPolicyJson === 'object'
              ? { ...(cfg.financialPolicyJson as any) }
              : {};
          if (finPol.walletCheckins && finPol.walletCheckins['2026-10']) {
            finPol.walletCheckins['2026-11'] = finPol.walletCheckins['2026-10'];
            delete finPol.walletCheckins['2026-10'];
          }

          await tx.globalConfig.update({
            where: { id: cfg.id },
            data: {
              activeTrackingStartMonth: 11,
              activeTrackingStartYear: 2026,
              formulaParamsJson: fp,
              financialPolicyJson: finPol,
            },
          });
        }
      },
      { maxWait: 20000, timeout: 60000 },
    );

    console.log(`[${label}] Successfully migrated and restored User #1 Golden Ledger!`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await migrateDb(NEON_URL, 'NEON_CLOUD');
  const localUrl =
    process.env.LOCAL_DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:5433/mondaymondayv2?schema=public&connect_timeout=3';
  await migrateDb(localUrl, 'LOCAL_PG');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
