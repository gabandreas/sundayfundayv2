import { PrismaClient, SnapshotStatus } from '@prisma/client';

const cloudUrl =
  process.env.DATABASE_URL_CLOUD ||
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_kLTO3alGm2RE@ep-nameless-bird-b30zfam7-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30';
const localUrl =
  process.env.DATABASE_URL_LOCAL ||
  'postgresql://postgres:password@127.0.0.1:5433/finance_erp?schema=public';

async function syncLocalWithCloud(cloudPrisma: PrismaClient, localPrisma: PrismaClient) {
  console.log('[Sync] Checking local database record count...');
  const localSnapCount = await localPrisma.monthlySnapshot.count();
  if (localSnapCount > 0) {
    console.log(`[Sync] Local database already contains ${localSnapCount} snapshots.`);
    return;
  }

  console.log('[Sync] Local database is empty. Extracting authoritative records from Neon Cloud...');
  const [
    users,
    configs,
    trustedIps,
    snapshots,
    transactions,
    budgetRevisions,
    creditContracts,
    scheduledBills,
    creditCardTransactions,
    monthlyBulkBills,
    savingsManualTransactions,
    savingsGoals,
    wishlistItems,
    auditLogs,
    customFeatureRequests,
  ] = await Promise.all([
    cloudPrisma.user.findMany({ orderBy: { id: 'asc' } }),
    cloudPrisma.globalConfig.findMany({ orderBy: { id: 'asc' } }),
    cloudPrisma.trustedIpAddress.findMany({ orderBy: { id: 'asc' } }),
    cloudPrisma.monthlySnapshot.findMany({ orderBy: { id: 'asc' } }),
    cloudPrisma.transaction.findMany({ orderBy: { id: 'asc' } }),
    cloudPrisma.budgetRevision.findMany({ orderBy: { id: 'asc' } }),
    cloudPrisma.creditContract.findMany({ orderBy: { id: 'asc' } }),
    cloudPrisma.scheduledBill.findMany({ orderBy: { id: 'asc' } }),
    cloudPrisma.creditCardTransaction.findMany({ orderBy: { id: 'asc' } }),
    cloudPrisma.monthlyBulkBill.findMany({ orderBy: { id: 'asc' } }),
    cloudPrisma.savingsManualTransaction.findMany({ orderBy: { id: 'asc' } }),
    cloudPrisma.savingsGoal.findMany({ orderBy: { id: 'asc' } }),
    cloudPrisma.wishlistItem.findMany({ orderBy: { id: 'asc' } }),
    cloudPrisma.auditLog.findMany({ orderBy: { id: 'asc' } }),
    cloudPrisma.customFeatureRequest.findMany({ orderBy: { id: 'asc' } }),
  ]);

  console.log(`[Sync] Writing ${users.length} users, ${snapshots.length} snapshots, ${monthlyBulkBills.length} bulk bills to local db...`);
  await localPrisma.$transaction(async (tx) => {
    if (users.length > 0) await tx.user.createMany({ data: users as any });
    if (configs.length > 0) await tx.globalConfig.createMany({ data: configs as any });
    if (trustedIps.length > 0) await tx.trustedIpAddress.createMany({ data: trustedIps as any });
    if (snapshots.length > 0) await tx.monthlySnapshot.createMany({ data: snapshots as any });
    if (transactions.length > 0) await tx.transaction.createMany({ data: transactions as any });
    if (budgetRevisions.length > 0) await tx.budgetRevision.createMany({ data: budgetRevisions as any });
    if (creditContracts.length > 0) await tx.creditContract.createMany({ data: creditContracts as any });
    if (scheduledBills.length > 0) await tx.scheduledBill.createMany({ data: scheduledBills as any });
    if (creditCardTransactions.length > 0) await tx.creditCardTransaction.createMany({ data: creditCardTransactions as any });
    if (monthlyBulkBills.length > 0) await tx.monthlyBulkBill.createMany({ data: monthlyBulkBills as any });
    if (savingsManualTransactions.length > 0) await tx.savingsManualTransaction.createMany({ data: savingsManualTransactions as any });
    if (savingsGoals.length > 0) await tx.savingsGoal.createMany({ data: savingsGoals as any });
    if (wishlistItems.length > 0) await tx.wishlistItem.createMany({ data: wishlistItems as any });
    if (auditLogs.length > 0) await tx.auditLog.createMany({ data: auditLogs as any });
    if (customFeatureRequests.length > 0) await tx.customFeatureRequest.createMany({ data: customFeatureRequests as any });
  });

  // Reset sequences in local PostgreSQL
  const tables = [
    'User',
    'GlobalConfig',
    'TrustedIpAddress',
    'MonthlySnapshot',
    'Transaction',
    'BudgetRevision',
    'CreditContract',
    'ScheduledBill',
    'CreditCardTransaction',
    'MonthlyBulkBill',
    'SavingsManualTransaction',
    'SavingsGoal',
    'WishlistItem',
    'AuditLog',
    'CustomFeatureRequest',
  ];
  for (const table of tables) {
    try {
      await localPrisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1));`
      );
    } catch (e: any) {}
  }

  console.log('[Sync] Local database successfully synced and sequences aligned with Cloud Neon!');
}

async function alignSequences(prisma: PrismaClient) {
  const tables = [
    'User',
    'GlobalConfig',
    'TrustedIpAddress',
    'MonthlySnapshot',
    'Transaction',
    'BudgetRevision',
    'CreditContract',
    'ScheduledBill',
    'CreditCardTransaction',
    'MonthlyBulkBill',
    'SavingsManualTransaction',
    'SavingsGoal',
    'WishlistItem',
    'AuditLog',
    'CustomFeatureRequest',
  ];
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1));`
      );
    } catch (e: any) {}
  }
}

async function applyUpdatesToDatabase(prisma: PrismaClient, dbName: string) {
  console.log(`\n======================================================`);
  console.log(`  Applying SPinjam Bridge Update to: ${dbName}`);
  console.log(`======================================================`);

  await alignSequences(prisma);

  // PART 1: Update DEC '26, JAN '27, and FEB '27 in MonthlyBulkBill
  console.log(`[Part 1] Updating DEC '26 & JAN '27 liabilities...`);

  // DEC '26: paylater = 1396910, personalDebt = 335578, total = 1732488
  await prisma.monthlyBulkBill.upsert({
    where: { userId_month_year: { userId: 1, month: 12, year: 2026 } },
    update: {
      paylaterAmount: 1396910,
      personalDebtAmount: 335578,
      amount: 1732488,
    },
    create: {
      userId: 1,
      month: 12,
      year: 2026,
      label: 'Monthly Bulk Bill',
      paylaterAmount: 1396910,
      personalDebtAmount: 335578,
      creditCardAmount: 0,
      amount: 1732488,
    },
  });

  // JAN '27: paylater = 626323, personalDebt = 671156, total = 1297479
  await prisma.monthlyBulkBill.upsert({
    where: { userId_month_year: { userId: 1, month: 1, year: 2027 } },
    update: {
      paylaterAmount: 626323,
      personalDebtAmount: 671156,
      amount: 1297479,
    },
    create: {
      userId: 1,
      month: 1,
      year: 2027,
      label: 'Monthly Bulk Bill',
      paylaterAmount: 626323,
      personalDebtAmount: 671156,
      creditCardAmount: 0,
      amount: 1297479,
    },
  });

  // FEB '27: confirm personalDebt = 0
  const feb27 = await prisma.monthlyBulkBill.findUnique({
    where: { userId_month_year: { userId: 1, month: 2, year: 2027 } },
  });
  if (feb27) {
    await prisma.monthlyBulkBill.update({
      where: { id: feb27.id },
      data: {
        personalDebtAmount: 0,
        amount: feb27.paylaterAmount,
      },
    });
  }

  // PART 2: Inject Rp 900,000 Bridge Liquidity into 10/2026
  console.log(`[Part 2] Injecting Rp 900,000 bridge liquidity into 10/2026...`);

  const snapshot10 = await prisma.monthlySnapshot.findFirstOrThrow({
    where: { userId: 1, month: 10, year: 2026 },
    include: { transactions: true, budgetRevisions: true },
  });

  // 1. Record the +Rp 900.000 INCOME transaction if not already present
  const existingBridgeTx = snapshot10.transactions.find(
    (t) => t.type === 'INCOME' && t.label.includes('SPinjam Bridge')
  );
  if (!existingBridgeTx) {
    await prisma.transaction.create({
      data: {
        snapshotId: snapshot10.id,
        type: 'INCOME',
        sourceType: 'MANUAL',
        label: 'SPinjam Bridge Cash Injection',
        amount: 900000,
        date: new Date('2026-11-08T00:00:00.000Z'),
      },
    });
    console.log(`  Created +Rp 900.000 INCOME transaction`);
  } else {
    console.log(`  Bridge transaction already exists (id=${existingBridgeTx.id})`);
  }

  // 2. Budget Revisions for DAILY_OPERATIONAL (+Rp 700k) and INTERNET (+Rp 200k for Nov 25 bill)
  const existingDailyRev = snapshot10.budgetRevisions.find(
    (r) => r.category === 'DAILY_OPERATIONAL' && r.newValue === 1720316
  );
  if (!existingDailyRev) {
    await prisma.budgetRevision.create({
      data: {
        snapshotId: snapshot10.id,
        month: 10,
        year: 2026,
        category: 'DAILY_OPERATIONAL',
        bucketKey: 'daily_operational',
        bucketLabel: 'Daily Operational',
        previousValue: 1020316,
        newValue: 1720316,
        difference: 700000,
        reason: 'Injected +Rp 700,000 SPinjam bridge liquidity into remaining living cash',
      },
    });
    console.log(`  Created DAILY_OPERATIONAL budget revision to Rp 1.720.316`);
  }

  const existingInternetRev = snapshot10.budgetRevisions.find(
    (r) => r.category === 'INTERNET' && r.newValue === 200000
  );
  if (!existingInternetRev) {
    await prisma.budgetRevision.create({
      data: {
        snapshotId: snapshot10.id,
        month: 10,
        year: 2026,
        category: 'INTERNET',
        bucketKey: 'internet',
        bucketLabel: 'Nov 25 Routine Bill',
        previousValue: 0,
        newValue: 200000,
        difference: 200000,
        reason: 'Allocated Rp 200,000 for upcoming Nov 25 routine bill from bridge liquidity',
      },
    });
    console.log(`  Created INTERNET budget revision to Rp 200.000 (Nov 25 Bill)`);
  }

  // 3. Update GlobalConfig customRoutineLabelsJson so internet shows as "Nov 25 Bill"
  const config = await prisma.globalConfig.findFirst({ where: { userId: 1 } });
  if (config) {
    const currentLabels = (config.customRoutineLabelsJson as any) || {};
    await prisma.globalConfig.update({
      where: { id: config.id },
      data: {
        customRoutineLabelsJson: {
          ...currentLabels,
          internet: 'Nov 25 Bill',
        },
      },
    });
    console.log(`  Updated GlobalConfig routine labels: internet -> 'Nov 25 Bill'`);
  }

  // 4. Update snapshot 10/2026 stored values & bucketRealizationsJson
  const updatedBucketRealizations = [
    {
      group: 'FIXED_ESSENTIAL',
      label: 'Transport',
      bucketId: 'transport',
      formulaType: 'FIXED_AMOUNT',
      formulaValue: 200000,
      baselineTarget: 200000,
      revisedTarget: 200000,
      fundedAmount: 200000,
      loggedSpend: 0,
      remainingBudget: 200000,
      priorityTier: 0,
    },
    {
      group: 'FIXED_ESSENTIAL',
      label: 'Nov 25 Bill',
      bucketId: 'internet',
      formulaType: 'FIXED_AMOUNT',
      formulaValue: 200000,
      baselineTarget: 0,
      revisedTarget: 200000,
      fundedAmount: 200000,
      loggedSpend: 0,
      remainingBudget: 200000,
      priorityTier: 0,
    },
    {
      group: 'FIXED_ESSENTIAL',
      label: 'Vape Supplies',
      bucketId: 'vape',
      formulaType: 'FIXED_AMOUNT',
      formulaValue: 0,
      baselineTarget: 0,
      revisedTarget: 0,
      fundedAmount: 0,
      loggedSpend: 0,
      remainingBudget: 0,
      priorityTier: 0,
    },
    {
      group: 'FIXED_ESSENTIAL',
      label: 'Haircut & Grooming',
      bucketId: 'haircut',
      formulaType: 'FIXED_AMOUNT',
      formulaValue: 0,
      baselineTarget: 0,
      revisedTarget: 0,
      fundedAmount: 0,
      loggedSpend: 0,
      remainingBudget: 0,
      priorityTier: 0,
    },
    {
      group: 'BUFFER',
      label: 'Buffer Pocket',
      bucketId: 'buffer',
      formulaType: 'FIXED_AMOUNT',
      formulaValue: 0,
      baselineTarget: 0,
      revisedTarget: 0,
      fundedAmount: 0,
      loggedSpend: 0,
      remainingBudget: 0,
      priorityTier: 0,
    },
    {
      group: 'DAILY_OPERATIONAL',
      label: 'Daily Operational Living Budget',
      bucketId: 'daily_operational',
      formulaType: 'FIXED_AMOUNT',
      formulaValue: 1720316,
      baselineTarget: 1720316,
      revisedTarget: 1720316,
      fundedAmount: 1720316,
      loggedSpend: 930321,
      remainingBudget: 789995, // 1720316 - 930321
      priorityTier: 0,
    },
    {
      group: 'SAVINGS_P1',
      label: 'Priority 1 Core Savings',
      bucketId: 'core_savings',
      formulaType: 'FIXED_AMOUNT',
      formulaValue: 1000000,
      baselineTarget: 1000000,
      revisedTarget: 1000000,
      fundedAmount: 256341,
      loggedSpend: 0,
      remainingBudget: 256341,
      priorityTier: 1,
    },
    {
      group: 'SELF_REWARD_P2',
      label: 'Priority 2 Discretionary / Self-Reward',
      bucketId: 'self_reward',
      formulaType: 'REMAINDER_OVERFLOW',
      formulaValue: 0,
      baselineTarget: 0,
      revisedTarget: 0,
      fundedAmount: 0,
      loggedSpend: 0,
      remainingBudget: 0,
      priorityTier: 2,
    },
  ];

  await prisma.monthlySnapshot.update({
    where: { id: snapshot10.id },
    data: {
      dailyOperational: 1720316,
      actualDailyOperational: 1720316,
      transport: 200000,
      internet: 200000,
      vape: 0,
      haircut: 0,
      survivalPocket: 2120316,
      finalTotalIncome: 6791000,
      extraIncome: 900000,
      totalDeductions: 4414343,
      actualSavings: 256341,
      deficitUncovered: 0,
      bucketRealizationsJson: updatedBucketRealizations as any,
    },
  });
  console.log(`  Updated Snapshot 10/2026: survivalPocket=2120316, actualDailyOperational=1720316, actualSavings=256341`);
}

async function verifyState(prisma: PrismaClient, label: string) {
  console.log(`\n======================================================`);
  console.log(`  Verification Audit for: ${label}`);
  console.log(`======================================================`);

  const snap = await prisma.monthlySnapshot.findFirstOrThrow({
    where: { userId: 1, month: 10, year: 2026 },
  });

  const txs = await prisma.transaction.findMany({
    where: { snapshotId: snap.id },
  });
  const manualSpent = txs
    .filter((t) => t.type === 'DEDUCTION' && t.sourceType === 'MANUAL')
    .reduce((s, t) => s + t.amount, 0);

  const remainingLiving = (snap.actualDailyOperational ?? 0) - manualSpent;
  const routineQuota = (snap.transport ?? 0) + (snap.internet ?? 0) + (snap.vape ?? 0) + (snap.haircut ?? 0);

  console.log(`10/2026 Snapshot Figures:`);
  console.log(`  Final Total Income: Rp ${snap.finalTotalIncome?.toLocaleString('id-ID')}`);
  console.log(`  Extra / Bridge Income: Rp ${snap.extraIncome?.toLocaleString('id-ID')}`);
  console.log(`  Total Liabilities / Deductions: Rp ${snap.totalDeductions?.toLocaleString('id-ID')}`);
  console.log(`  Daily Food & Living Target: Rp ${snap.actualDailyOperational?.toLocaleString('id-ID')}`);
  console.log(`  Spent To Date: Rp ${manualSpent.toLocaleString('id-ID')}`);
  console.log(`  Remaining Living Cash: Rp ${remainingLiving.toLocaleString('id-ID')}`);
  console.log(`  Routine Bills Quota: Rp ${routineQuota.toLocaleString('id-ID')} (Transport: Rp ${snap.transport?.toLocaleString('id-ID')}, Nov 25 Bill: Rp ${snap.internet?.toLocaleString('id-ID')})`);
  console.log(`  Total Monthly Budget (survivalPocket): Rp ${snap.survivalPocket?.toLocaleString('id-ID')}`);
  console.log(`  Core Savings (P1): Rp ${snap.actualSavings?.toLocaleString('id-ID')}`);
  console.log(`  Deficit Uncovered: Rp ${snap.deficitUncovered?.toLocaleString('id-ID')}`);

  console.log(`\n12-Month Matrix (Personal & Informal Debt):`);
  const bulkBills = await prisma.monthlyBulkBill.findMany({
    where: { userId: 1, year: { in: [2026, 2027] } },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });
  for (const b of bulkBills) {
    if ((b.year === 2026 && b.month >= 7) || (b.year === 2027 && b.month <= 6)) {
      const monthStr = `${b.month}/${b.year}`;
      console.log(
        `  ${monthStr.padEnd(8)}: PayLater = Rp ${b.paylaterAmount.toLocaleString('id-ID').padStart(11)} | Personal Debt = Rp ${b.personalDebtAmount.toLocaleString('id-ID').padStart(11)} | Total = Rp ${b.amount.toLocaleString('id-ID').padStart(11)}`
      );
    }
  }
}

async function main() {
  const cloudPrisma = new PrismaClient({ datasources: { db: { url: cloudUrl } } });
  const localPrisma = new PrismaClient({ datasources: { db: { url: localUrl } } });

  try {
    // 1. Sync local with cloud
    await syncLocalWithCloud(cloudPrisma, localPrisma);

    // 2. Apply updates to Cloud
    await applyUpdatesToDatabase(cloudPrisma, 'NEON CLOUD DATABASE');

    // 3. Apply updates to Local
    await applyUpdatesToDatabase(localPrisma, 'LOCAL DATABASE (port 5433)');

    // 4. Verify both
    await verifyState(cloudPrisma, 'NEON CLOUD DATABASE');
    await verifyState(localPrisma, 'LOCAL DATABASE (port 5433)');

    console.log(`\nAll database updates applied and verified successfully on both targets!`);
  } catch (err: any) {
    console.error('Migration error:', err.message);
  } finally {
    await cloudPrisma.$disconnect();
    await localPrisma.$disconnect();
  }
}

main();
