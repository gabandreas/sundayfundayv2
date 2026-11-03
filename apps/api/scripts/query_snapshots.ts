import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSnapshots() {
  const snapshots = await prisma.monthlySnapshot.findMany({
    orderBy: [{ year: 'asc' }, { month: 'asc' }]
  });

  console.log("=== RAW SNAPSHOTS AUDIT ===");
  for (const s of snapshots) {
    console.log(`Period: ${s.month}/${s.year} (ID: ${s.id})`);
    console.log(`  finalTotalIncome:       ${s.finalTotalIncome}`);
    console.log(`  dailyOperational (Target): ${s.dailyOperational}`);
    console.log(`  actualDailyOperational: ${s.actualDailyOperational}`);
    console.log(`  selfRewardTarget:       ${s.selfRewardTarget}`);
    console.log(`  selfReward (Actual):    ${s.selfReward}`);
    console.log(`  actualSavings:          ${s.actualSavings}`);
    console.log(`  deficitUncovered:       ${s.deficitUncovered}`);
    console.log(`  status:                 ${s.status}`);
    console.log("-----------------------------------------");
  }
}

checkSnapshots().catch(console.error).finally(() => prisma.$disconnect());
