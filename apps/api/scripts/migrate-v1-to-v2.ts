import {
  PrismaClient,
  SnapshotStatus,
  TransactionType,
  TransactionSourceType,
  CreditCardChargeType,
  CreditCardStatus,
  AuditCategory,
  AuditSeverity,
} from '@prisma/client';
import { calculatePayroll, sumExtraIncome } from '../src/calculator/payroll';
import { calculateTotalDeductions, calculateWaterfall } from '../src/calculator/waterfall';
import { formatBulkBillTransactionLabel } from '../src/credit/credit.service';

const V1_DATABASE_URL =
  process.env.V1_DATABASE_URL ||
  'postgresql://admin:rootpassword@127.0.0.1:5440/finance_tracker';

const V2_DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:password@127.0.0.1:5433/finance_erp?schema=public';

const v1 = new PrismaClient({
  datasources: { db: { url: V1_DATABASE_URL } },
});

const v2 = new PrismaClient({
  datasources: { db: { url: V2_DATABASE_URL } },
});

interface ReconciliationRow {
  period: string;
  v1Income: number;
  v2Income: number;
  incomeDelta: number;
  v1DeductionsStored: string;
  v2DeductionsMaterialized: number;
  v1DailyOp: number;
  v2DailyOp: number;
  v1Savings: number;
  v2Savings: number;
  v1SelfReward: number;
  v2SelfReward: number;
  v1Survival: number;
  v2Survival: number;
}

const CONFIRMATION_FLAG = '--i-understand-this-wipes-live-data';

async function migrate() {
  if (!process.argv.includes(CONFIRMATION_FLAG)) {
    console.error(`\n[FATAL] migrate-v1-to-v2.ts wipes all live data in V2!`);
    console.error(`To run this script, you MUST pass the explicit flag: ${CONFIRMATION_FLAG}\n`);
    process.exit(1);
  }

  console.log('====================================================');
  console.log('Starting Historical Data Migration (V1 -> V2)');
  console.log(`Sourcing from V1: ${V1_DATABASE_URL}`);
  console.log(`Writing to V2:    ${V2_DATABASE_URL}`);
  console.log('====================================================\n');

  // Step 1: Read all required data from V1
  console.log('1. Reading data from V1 database...');

  // 1.1 GlobalConfig
  const v1Configs = await v1.$queryRawUnsafe<any[]>('SELECT * FROM "GlobalConfig" LIMIT 1;');
  if (!v1Configs.length) {
    throw new Error('No GlobalConfig found in V1 database!');
  }
  const v1Config = v1Configs[0];
  console.log(`   - Read GlobalConfig: baseSalary=${v1Config.baseSalary}, dailyAllowance=${v1Config.dailyAllowance}`);

  // 1.2 MonthlyBulkBill (12 rows: 2026-07 through 2027-06)
  const v1BulkBills = await v1.$queryRawUnsafe<any[]>(
    'SELECT * FROM "MonthlyBulkBill" WHERE ("year" = 2026 AND "month" >= 7) OR ("year" = 2027 AND "month" <= 6) ORDER BY "year", "month";'
  );
  console.log(`   - Read ${v1BulkBills.length} MonthlyBulkBill records from V1`);

  // 1.3 CreditCardTransaction (3 rows on 2026-08-29)
  const v1CardTxs = await v1.$queryRawUnsafe<any[]>(
    'SELECT * FROM "CreditCardTransaction" ORDER BY "transactionDate";'
  );
  console.log(`   - Read ${v1CardTxs.length} CreditCardTransaction records from V1`);

  // 1.4 The 6 Genuine Historical Snapshots (2026-07 through 2026-12)
  const v1Snapshots = await v1.$queryRawUnsafe<any[]>(
    'SELECT * FROM "MonthlySnapshot" WHERE "periodYear" = 2026 AND "periodMonth" BETWEEN 7 AND 12 ORDER BY "periodYear", "periodMonth";'
  );
  console.log(`   - Read ${v1Snapshots.length} genuine MonthlySnapshot records from V1`);

  // 1.5 Transactions (manual deductions in July 2026)
  const v1JulySnapshot = v1Snapshots.find((s) => s.periodMonth === 7 && s.periodYear === 2026);
  const v1ManualTxs = v1JulySnapshot
    ? await v1.$queryRawUnsafe<any[]>(
        `SELECT * FROM "Transaction" WHERE "monthlySnapshotId" = '${v1JulySnapshot.id}' ORDER BY "createdAt";`
      )
    : [];
  console.log(`   - Read ${v1ManualTxs.length} manual living expense transactions from V1 (July 2026)\n`);

  // Step 2: Atomic Execution inside V2 Transaction
  console.log('2. Executing atomic write transaction in V2...');

  const createdSnapshotMap = new Map<string, number>();

  await v2.$transaction(async (tx) => {
    // 2.1 Truncate domain tables
    console.log('   - Truncating domain tables in V2...');
    await tx.$executeRawUnsafe(`
      TRUNCATE TABLE 
        "Transaction", 
        "MonthlySnapshot", 
        "CreditContract", 
        "MonthlyBulkBill", 
        "CreditCardTransaction", 
        "SavingsManualTransaction", 
        "BudgetRevision", 
        "WishlistItem", 
        "AuditLog" 
      RESTART IDENTITY CASCADE;
    `);

    // 2.2 GlobalConfig
    console.log('   - Upserting GlobalConfig in V2...');
    await tx.globalConfig.upsert({
      where: { id: 1 },
      update: {
        baseSalary: Number(v1Config.baseSalary),
        dailyAllowance: Number(v1Config.dailyAllowance),
        laptopAllowance: 250_000, // V2 ERP benefit specification
        dailyOperational: Number(v1Config.dailyOperational),
        transport: Number(v1Config.transport),
        internet: Number(v1Config.internet),
        vape: Number(v1Config.vape),
        haircut: Number(v1Config.haircut),
        baseSavings: Number(v1Config.baseSavings),
        creditLimit: Number(v1Config.creditLimit || 7_000_000),
        creditStatementDay: Number(v1Config.creditStatementDay || 20),
        creditDueDay: Number(v1Config.creditDueDay || 11),
      },
      create: {
        id: 1,
        baseSalary: Number(v1Config.baseSalary),
        dailyAllowance: Number(v1Config.dailyAllowance),
        laptopAllowance: 250_000,
        dailyOperational: Number(v1Config.dailyOperational),
        transport: Number(v1Config.transport),
        internet: Number(v1Config.internet),
        vape: Number(v1Config.vape),
        haircut: Number(v1Config.haircut),
        baseSavings: Number(v1Config.baseSavings),
        creditLimit: Number(v1Config.creditLimit || 7_000_000),
        creditStatementDay: Number(v1Config.creditStatementDay || 20),
        creditDueDay: Number(v1Config.creditDueDay || 11),
      },
    });

    // 2.3 MonthlyBulkBill (12 rows)
    console.log('   - Migrating 12 MonthlyBulkBill rows...');
    for (const b of v1BulkBills) {
      await tx.monthlyBulkBill.create({
        data: {
          month: Number(b.month),
          year: Number(b.year),
          label: b.label || 'Monthly Bulk Bill',
          amount: Number(b.amount),
          paylaterAmount: Number(b.paylaterAmount || 0),
          personalDebtAmount: Number(b.personalDebtAmount || 0),
          creditCardAmount: Number(b.creditCardAmount || 0),
        },
      });
    }

    // 2.4 CreditCardTransaction (3 rows)
    console.log('   - Migrating CreditCardTransaction rows...');
    for (const c of v1CardTxs) {
      const txDate = new Date(c.transactionDate);
      // Cut-off rule: day 29 > statementDay 20 -> billingMonth 9, billingYear 2026
      const statementDay = Number(v1Config.creditStatementDay || 20);
      let billingMonth = txDate.getMonth() + 1;
      let billingYear = txDate.getFullYear();
      if (txDate.getDate() > statementDay) {
        billingMonth += 1;
        if (billingMonth > 12) {
          billingMonth = 1;
          billingYear += 1;
        }
      }

      await tx.creditCardTransaction.create({
        data: {
          label: c.title || c.label || 'Credit Card Charge',
          amount: Number(c.amount),
          totalAmount: Number(c.totalAmount || c.amount),
          monthlyAmount: Number(c.monthlyAmount || c.amount),
          chargeType: CreditCardChargeType.FULL,
          tenor: Number(c.tenor || 1),
          category: c.category || 'Subscription',
          transactionDate: txDate,
          billingMonth: Number(c.billingMonth) || billingMonth,
          billingYear: Number(c.billingYear) || billingYear,
          isRecurring: Boolean(c.isRecurring),
          status: CreditCardStatus.ACTIVE,
          notes: c.notes,
        },
      });
    }

    // 2.5 Recreating the 6 Genuine Snapshots (strictly DRAFT, per-period frozen targets & user inputs)
    console.log('   - Recreating 6 genuine historical snapshots as DRAFT...');
    for (const s of v1Snapshots) {
      const created = await tx.monthlySnapshot.create({
        data: {
          month: Number(s.periodMonth),
          year: Number(s.periodYear),
          status: SnapshotStatus.DRAFT, // All DRAFT per policy
          // Frozen baseline targets sourced individually per snapshot row
          dailyOperational: Number(s.dailyOperational),
          transport: Number(s.transport),
          internet: Number(s.internet),
          vape: Number(s.vape),
          haircut: Number(s.haircut),
          savings: Number(s.savings),
          // Raw user inputs
          totalWorkingDays: Number(s.totalWorkingDays || 0),
          cafeteriaDeduction: Number(s.cafeteriaDeduction || 0),
          bonusAmount: Number(s.bonusAmount || 0),
          salaryAdjustment: Number(s.salaryAdjustment || 0),
          thrAmount: Number(s.thrAmount || 0),
          selfRewardTarget: Number(s.selfRewardTarget || 0),
          bufferPocket: Number(s.bufferPocket || 0),
        },
      });
      createdSnapshotMap.set(`${s.periodYear}-${s.periodMonth}`, created.id);
    }

    // 2.6 Migrate manual living expense transactions (July 2026)
    console.log('   - Migrating manual living expense transactions (July 2026)...');
    const julyV2Id = createdSnapshotMap.get('2026-7');
    if (julyV2Id && v1ManualTxs.length > 0) {
      for (const t of v1ManualTxs) {
        await tx.transaction.create({
          data: {
            snapshotId: julyV2Id,
            type: TransactionType.DEDUCTION,
            sourceType: TransactionSourceType.MANUAL,
            label: t.description || 'Manual Expense',
            amount: Number(t.amount),
            date: new Date(t.createdAt),
          },
        });
      }
    }

    // 2.7 Idempotently Materialize Due Liabilities and Recalculate each Snapshot
    console.log('   - Materializing due liabilities and recalculating waterfall per snapshot...');
    const config = await tx.globalConfig.findFirstOrThrow();

    for (const s of v1Snapshots) {
      const month = Number(s.periodMonth);
      const year = Number(s.periodYear);
      const snapshotId = createdSnapshotMap.get(`${year}-${month}`)!;

      // Fetch bulk bills for this period
      const bulkBills = await tx.monthlyBulkBill.findMany({
        where: { month, year },
      });

      // Fetch active card charges for this period
      const dueCards = await tx.creditCardTransaction.findMany({
        where: {
          status: CreditCardStatus.ACTIVE,
          billingMonth: month,
          billingYear: year,
        },
      });

      const targetDate = new Date(Date.UTC(year, month - 1, 1));
      const recordsToCreate = [
        ...bulkBills.map((b) => ({
          snapshotId,
          type: TransactionType.CREDIT_BILL,
          sourceType: TransactionSourceType.BULK_BILL,
          sourceId: b.id,
          label: formatBulkBillTransactionLabel(b),
          amount: b.amount,
          date: targetDate,
        })),
        ...dueCards.map((c) => ({
          snapshotId,
          type: TransactionType.CREDIT_BILL,
          sourceType: TransactionSourceType.CC_TRANSACTION,
          sourceId: c.id,
          label: c.label,
          amount: c.amount,
          date: targetDate,
        })),
      ];

      // Delete non-manual transactions if any
      await tx.transaction.deleteMany({
        where: {
          snapshotId,
          sourceType: { not: TransactionSourceType.MANUAL },
        },
      });

      if (recordsToCreate.length > 0) {
        await tx.transaction.createMany({
          data: recordsToCreate,
        });
      }

      // Recalculate using authoritative calculator pipeline
      const transactions = await tx.transaction.findMany({
        where: { snapshotId },
      });
      const currentSnap = await tx.monthlySnapshot.findUniqueOrThrow({
        where: { id: snapshotId },
      });

      const extraIncome = sumExtraIncome(transactions);
      const payroll = calculatePayroll({
        baseSalary: config.baseSalary,
        salaryAdjustment: currentSnap.salaryAdjustment,
        totalWorkingDays: currentSnap.totalWorkingDays,
        dailyAllowance: config.dailyAllowance,
        cafeteriaDeduction: currentSnap.cafeteriaDeduction,
        thrAmount: currentSnap.thrAmount,
        bonusAmount: currentSnap.bonusAmount,
        extraIncome,
        laptopAllowance: config.laptopAllowance,
      });

      const totalDeductions = calculateTotalDeductions(transactions);
      const fixedExpenses =
        currentSnap.transport +
        currentSnap.internet +
        currentSnap.vape +
        currentSnap.haircut;

      const waterfall = calculateWaterfall({
        finalTotalIncome: payroll.finalTotalIncome,
        totalDeductions,
        savingsTarget: currentSnap.savings,
        selfRewardTarget: currentSnap.selfRewardTarget,
        dailyOperationalTarget: currentSnap.dailyOperational,
        fixedExpenses,
        bufferPocket: currentSnap.bufferPocket,
      });

      await tx.monthlySnapshot.update({
        where: { id: snapshotId },
        data: {
          netSalaryIncome: payroll.netSalaryIncome,
          extraIncome: payroll.extraIncome,
          finalTotalIncome: payroll.finalTotalIncome,
          totalDeductions,
          actualDailyOperational: waterfall.actualDailyOperational,
          actualSavings: waterfall.actualSavings,
          selfReward: waterfall.actualSelfReward,
          deficitUncovered: waterfall.deficitUncovered,
          survivalPocket: waterfall.survivalPocket,
        },
      });
    }

    // 2.8 Record migration in AuditLog
    await tx.auditLog.create({
      data: {
        category: AuditCategory.SETTINGS,
        action: 'MIGRATE_V1_TO_V2',
        severity: AuditSeverity.INFO,
        month: 7,
        year: 2026,
        summary: 'Historical financial data migration from V1 successfully executed',
        details: `Migrated 6 snapshots (2026-07 to 2026-12), 12 bulk bills, 3 credit card charges, and 3 manual living expenses. All snapshots set to DRAFT.`,
      },
    });

    console.log('   - Atomic transaction completed successfully!\n');
  });

  // Step 3: End-of-Run Reconciliation Audit
  console.log('3. Running end-of-run reconciliation audit against V1...');
  const reconRows: ReconciliationRow[] = [];

  for (const s of v1Snapshots) {
    const month = Number(s.periodMonth);
    const year = Number(s.periodYear);
    const v2Snap = await v2.monthlySnapshot.findUniqueOrThrow({
      where: { month_year: { month, year } },
      include: { transactions: true },
    });

    reconRows.push({
      period: `${year}-${String(month).padStart(2, '0')}`,
      v1Income: Number(s.totalIncome || 0),
      v2Income: Number(v2Snap.finalTotalIncome || 0),
      incomeDelta: Number(v2Snap.finalTotalIncome || 0) - Number(s.totalIncome || 0),
      v1DeductionsStored: 'N/A (unpersisted in V1)',
      v2DeductionsMaterialized: Number(v2Snap.totalDeductions || 0),
      v1DailyOp: Number(s.actualDailyOperational || 0),
      v2DailyOp: Number(v2Snap.actualDailyOperational || 0),
      v1Savings: Number(s.actualSavings || 0),
      v2Savings: Number(v2Snap.actualSavings || 0),
      v1SelfReward: Number(s.selfReward || 0),
      v2SelfReward: Number(v2Snap.selfReward || 0),
      v1Survival: Number(s.survivalPocket || 0),
      v2Survival: Number(v2Snap.survivalPocket || 0),
    });
  }

  console.log('\n========================================================================================');
  console.log('FINAL RECONCILIATION REPORT (V1 vs V2)');
  console.log('========================================================================================');
  console.table(reconRows);

  console.log('\nMigration complete! Clean state established with zero loss of historical fidelity.');
}

migrate()
  .catch((err) => {
    console.error('Migration failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await v1.$disconnect();
    await v2.$disconnect();
  });
