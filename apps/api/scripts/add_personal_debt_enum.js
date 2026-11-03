const { PrismaClient } = require('@prisma/client');

async function main() {
  const prismaLive = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/finance_erp' } }
  });
  const prismaTest = new PrismaClient({
    datasources: { db: { url: 'postgresql://postgres:password@localhost:5433/finance_erp_test' } }
  });

  try {
    await prismaLive.$executeRawUnsafe(`ALTER TYPE "TransactionSourceType" ADD VALUE IF NOT EXISTS 'PERSONAL_DEBT';`);
    console.log('Added PERSONAL_DEBT enum to finance_erp successfully');
  } catch (err) {
    console.log('finance_erp alter enum:', err.message);
  }

  try {
    await prismaTest.$executeRawUnsafe(`ALTER TYPE "TransactionSourceType" ADD VALUE IF NOT EXISTS 'PERSONAL_DEBT';`);
    console.log('Added PERSONAL_DEBT enum to finance_erp_test successfully');
  } catch (err) {
    console.log('finance_erp_test alter enum:', err.message);
  }

  await prismaLive.$disconnect();
  await prismaTest.$disconnect();
}

main();
