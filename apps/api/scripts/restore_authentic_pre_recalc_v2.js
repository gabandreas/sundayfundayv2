const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let v = (m[2] || '').trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Authentic pre-recalculation V2 stored snapshot values (under original 4-priority formula,
// with V2's CC billing cutoff bugfix of Rp 173,470 already applied to September).
const authenticV2PreRecalc = [
  {
    month: 7,
    year: 2026,
    transport: 300000,
    internet: 0,
    vape: 150000,
    haircut: 0,
    dailyOperational: 2850000,
    savings: 0,
    selfRewardTarget: 615000,
    actualDailyOperational: 2302000,
    actualSavings: 0,
    selfReward: 615000,
    survivalPocket: 2752000,
    deficitUncovered: 0,
  },
  {
    month: 8,
    year: 2026,
    transport: 200000,
    internet: 0,
    vape: 150000,
    haircut: 0,
    dailyOperational: 2500000,
    savings: 2000000,
    selfRewardTarget: 85000,
    actualDailyOperational: 695296,
    actualSavings: 2000000,
    selfReward: 85000,
    survivalPocket: 1045296,
    deficitUncovered: 0,
  },
  {
    month: 9,
    year: 2026,
    transport: 300000,
    internet: 100000,
    vape: 150000,
    haircut: 85000,
    dailyOperational: 2850000,
    savings: 1000000,
    selfRewardTarget: 0,
    actualDailyOperational: 1728530, // Correct V2 pre-recalc value (with Rp 173,470 CC bill included)
    actualSavings: 1000000,
    selfReward: 0,
    survivalPocket: 2363530, // 635,000 fixed + 1,728,530 funded DailyOp
    deficitUncovered: 0,
  },
  {
    month: 10,
    year: 2026,
    transport: 300000,
    internet: 100000,
    vape: 150000,
    haircut: 85000,
    dailyOperational: 2850000,
    savings: 1000000,
    selfRewardTarget: 0,
    actualDailyOperational: 2400530,
    actualSavings: 1000000,
    selfReward: 0,
    survivalPocket: 3035530,
    deficitUncovered: 0,
  },
  {
    month: 11,
    year: 2026,
    transport: 300000,
    internet: 100000,
    vape: 150000,
    haircut: 85000,
    dailyOperational: 2850000,
    savings: 1000000,
    selfRewardTarget: 0,
    actualDailyOperational: 2850000,
    actualSavings: 1000000,
    selfReward: 245530,
    survivalPocket: 3485000,
    deficitUncovered: 0,
  },
  {
    month: 12,
    year: 2026,
    transport: 300000,
    internet: 100000,
    vape: 150000,
    haircut: 85000,
    dailyOperational: 2850000,
    savings: 1000000,
    selfRewardTarget: 0,
    actualDailyOperational: 2850000,
    actualSavings: 1000000,
    selfReward: 4255447,
    survivalPocket: 3485000,
    deficitUncovered: 0,
  },
];

const CONFIRMATION_FLAG = '--i-understand-this-wipes-live-data';

async function main() {
  if (!process.argv.includes(CONFIRMATION_FLAG)) {
    console.error(`\n[FATAL] restore_authentic_pre_recalc_v2.js overwrites snapshot values!`);
    console.error(`To run this script, you MUST pass the explicit flag: ${CONFIRMATION_FLAG}\n`);
    process.exit(1);
  }

  console.log('Restoring authentic pre-recalculation V2 state in MonthlySnapshot...');
  for (const snap of authenticV2PreRecalc) {
    await prisma.monthlySnapshot.update({
      where: { month_year: { month: snap.month, year: snap.year } },
      data: {
        transport: snap.transport,
        internet: snap.internet,
        vape: snap.vape,
        haircut: snap.haircut,
        dailyOperational: snap.dailyOperational,
        savings: snap.savings,
        selfRewardTarget: snap.selfRewardTarget,
        actualDailyOperational: snap.actualDailyOperational,
        actualSavings: snap.actualSavings,
        selfReward: snap.selfReward,
        survivalPocket: snap.survivalPocket,
        deficitUncovered: snap.deficitUncovered,
      },
    });
    console.log(`- Period ${snap.month}/${snap.year}: actualDailyOp=${snap.actualDailyOperational}, actualSavings=${snap.actualSavings}, selfReward=${snap.selfReward}, survival=${snap.survivalPocket}`);
  }
  console.log('Successfully restored authentic pre-recalculation V2 state for all 6 periods.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
