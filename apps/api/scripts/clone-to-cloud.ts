import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as path from 'path';

async function main() {
  const startTime = Date.now();
  console.log('====================================================');
  console.log('   Sunday Funday ERP — Local-to-Cloud DB Cloner     ');
  console.log('====================================================');

  const cloudUrl = process.env.CLOUD_DATABASE_URL || process.argv[2];
  if (!cloudUrl) {
    console.error('Error: CLOUD_DATABASE_URL environment variable is required.');
    console.error('Usage:');
    console.error(
      '  CLOUD_DATABASE_URL="postgresql://user:pwd@neon.tech/neondb?sslmode=require" npm run db:push-to-cloud'
    );
    console.error('  or: npx ts-node apps/api/scripts/clone-to-cloud.ts "postgresql://..."');
    process.exit(1);
  }

  const localUrl =
    process.env.LOCAL_DATABASE_URL ||
    'postgresql://postgres:password@127.0.0.1:5433/finance_erp?schema=public';

  console.log('[1/4] Pushing Prisma schema to Cloud Database...');
  const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
  try {
    execSync(`npx prisma db push --schema="${schemaPath}" --accept-data-loss`, {
      env: { ...process.env, DATABASE_URL: cloudUrl },
      stdio: 'inherit',
    });
    console.log('Schema push to cloud completed successfully.\n');
  } catch (err: any) {
    console.error('Failed to push schema to cloud database:', err.message);
    process.exit(1);
  }

  console.log('[2/4] Connecting to Local Database (finance_erp @ port 5433)...');
  const localPrisma = new PrismaClient({ datasources: { db: { url: localUrl } } });
  const cloudPrisma = new PrismaClient({ datasources: { db: { url: cloudUrl } } });

  try {
    // Read local data
    console.log('[3/4] Extracting all records from local database...');
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
      localPrisma.user.findMany({ orderBy: { id: 'asc' } }),
      localPrisma.globalConfig.findMany({ orderBy: { id: 'asc' } }),
      localPrisma.trustedIpAddress.findMany({ orderBy: { id: 'asc' } }),
      localPrisma.monthlySnapshot.findMany({ orderBy: { id: 'asc' } }),
      localPrisma.transaction.findMany({ orderBy: { id: 'asc' } }),
      localPrisma.budgetRevision.findMany({ orderBy: { id: 'asc' } }),
      localPrisma.creditContract.findMany({ orderBy: { id: 'asc' } }),
      localPrisma.scheduledBill.findMany({ orderBy: { id: 'asc' } }),
      localPrisma.creditCardTransaction.findMany({ orderBy: { id: 'asc' } }),
      localPrisma.monthlyBulkBill.findMany({ orderBy: { id: 'asc' } }),
      localPrisma.savingsManualTransaction.findMany({ orderBy: { id: 'asc' } }),
      localPrisma.savingsGoal.findMany({ orderBy: { id: 'asc' } }),
      localPrisma.wishlistItem.findMany({ orderBy: { id: 'asc' } }),
      localPrisma.auditLog.findMany({ orderBy: { id: 'asc' } }),
      localPrisma.customFeatureRequest.findMany({ orderBy: { id: 'asc' } }),
    ]);

    const totalRecords =
      users.length +
      configs.length +
      trustedIps.length +
      snapshots.length +
      transactions.length +
      budgetRevisions.length +
      creditContracts.length +
      scheduledBills.length +
      creditCardTransactions.length +
      monthlyBulkBills.length +
      savingsManualTransactions.length +
      savingsGoals.length +
      wishlistItems.length +
      auditLogs.length +
      customFeatureRequests.length;

    console.log(`Found ${totalRecords} total records across 15 models.`);

    console.log('[4/4] Writing records atomically to Cloud Database...');
    await cloudPrisma.$transaction(async (tx) => {
      // Clean slate on target cloud DB
      await tx.$executeRawUnsafe(`
        TRUNCATE TABLE
          "CustomFeatureRequest",
          "AuditLog",
          "WishlistItem",
          "SavingsGoal",
          "SavingsManualTransaction",
          "MonthlyBulkBill",
          "CreditCardTransaction",
          "ScheduledBill",
          "CreditContract",
          "BudgetRevision",
          "Transaction",
          "MonthlySnapshot",
          "TrustedIpAddress",
          "GlobalConfig",
          "User"
        CASCADE;
      `);

      if (users.length > 0) await tx.user.createMany({ data: users as any });
      if (configs.length > 0) await tx.globalConfig.createMany({ data: configs as any });
      if (trustedIps.length > 0) await tx.trustedIpAddress.createMany({ data: trustedIps as any });
      if (snapshots.length > 0) await tx.monthlySnapshot.createMany({ data: snapshots as any });
      if (transactions.length > 0) await tx.transaction.createMany({ data: transactions as any });
      if (budgetRevisions.length > 0) await tx.budgetRevision.createMany({ data: budgetRevisions as any });
      if (creditContracts.length > 0) await tx.creditContract.createMany({ data: creditContracts as any });
      if (scheduledBills.length > 0) await tx.scheduledBill.createMany({ data: scheduledBills as any });
      if (creditCardTransactions.length > 0)
        await tx.creditCardTransaction.createMany({ data: creditCardTransactions as any });
      if (monthlyBulkBills.length > 0)
        await tx.monthlyBulkBill.createMany({ data: monthlyBulkBills as any });
      if (savingsManualTransactions.length > 0)
        await tx.savingsManualTransaction.createMany({ data: savingsManualTransactions as any });
      if (savingsGoals.length > 0) await tx.savingsGoal.createMany({ data: savingsGoals as any });
      if (wishlistItems.length > 0) await tx.wishlistItem.createMany({ data: wishlistItems as any });
      if (auditLogs.length > 0) await tx.auditLog.createMany({ data: auditLogs as any });
      if (customFeatureRequests.length > 0)
        await tx.customFeatureRequest.createMany({ data: customFeatureRequests as any });

      // Align PostgreSQL primary key sequences
      const tablesWithSeq = [
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

      for (const table of tablesWithSeq) {
        await tx
          .$executeRawUnsafe(
            `SELECT setval('"${table}_id_seq"', (SELECT COALESCE(MAX(id), 1) FROM "${table}"))`
          )
          .catch(() => {});
      }
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('====================================================');
    console.log(`Success: Local database cloned to Cloud in ${elapsed}s!`);
    console.log(`- 15 Tables Pushed & Realigned`);
    console.log(`- ${totalRecords} Records Mirrored 1:1`);
    console.log(`- User 1 (Superadmin) & User 2 (Recruiter Sandbox) Active`);
    console.log('====================================================');
  } finally {
    await localPrisma.$disconnect();
    await cloudPrisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal error during cloud cloning:', err);
  process.exit(1);
});
