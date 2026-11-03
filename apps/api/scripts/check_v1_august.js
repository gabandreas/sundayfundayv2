const { PrismaClient } = require('@prisma/client');
const v1 = new PrismaClient({
  datasources: { db: { url: 'postgresql://admin:rootpassword@127.0.0.1:5440/finance_tracker' } },
});

async function main() {
  const rows = await v1.$queryRawUnsafe('SELECT "periodMonth", "periodYear", "transport", "internet", "vape", "haircut", "dailyOperational", "savings", "totalIncome" FROM "MonthlySnapshot" WHERE "periodYear" = 2026 ORDER BY "periodMonth" ASC;');
  console.log('V1 2026 Snapshot baselines:');
  console.log(rows);
}

main().finally(() => v1.$disconnect());
