const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[match[1]] = val;
  }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const snapshots = await prisma.monthlySnapshot.findMany({
    where: { year: 2026, month: { gte: 7 } },
    orderBy: { month: 'asc' },
  });

  const summary = snapshots.map((x) => ({
    id: x.id,
    month: x.month,
    year: x.year,
    status: x.status,
    finalTotalIncome: x.finalTotalIncome,
    totalDeductions: x.totalDeductions,
    transport: x.transport,
    internet: x.internet,
    vape: x.vape,
    haircut: x.haircut,
    dailyOperational: x.dailyOperational,
    actualDailyOperational: x.actualDailyOperational,
    savings: x.savings,
    actualSavings: x.actualSavings,
    selfRewardTarget: x.selfRewardTarget,
    selfReward: x.selfReward,
    bufferPocket: x.bufferPocket,
    deficitUncovered: x.deficitUncovered,
    survivalPocket: x.survivalPocket,
  }));

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
