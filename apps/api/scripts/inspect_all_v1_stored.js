const { PrismaClient } = require('@prisma/client');
const v1 = new PrismaClient({
  datasources: { db: { url: 'postgresql://admin:rootpassword@127.0.0.1:5440/finance_tracker' } },
});

async function main() {
  const rows = await v1.$queryRawUnsafe(`
    SELECT 
      "periodMonth", "periodYear", 
      "transport", "internet", "vape", "haircut", "dailyOperational", "savings", "selfRewardTarget",
      "actualDailyOperational", "actualSavings", "selfReward", "survivalPocket", "deficitUncovered",
      "totalWorkingDays", "cafeteriaDeduction", "totalIncome"
    FROM "MonthlySnapshot" 
    WHERE "periodYear" = 2026 AND "periodMonth" >= 7 
    ORDER BY "periodMonth" ASC;
  `);
  console.log('ALL V1 2026 HISTORICAL SNAPSHOTS:');
  console.log(JSON.stringify(rows, null, 2));
}

main().finally(() => v1.$disconnect());
