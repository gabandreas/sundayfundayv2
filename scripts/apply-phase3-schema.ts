import * as fs from 'node:fs';
import * as path from 'node:path';

const API_DIR = path.resolve(__dirname, '..', 'apps', 'api');
const ENV_PATH = path.join(API_DIR, '.env');
if (fs.existsSync(ENV_PATH)) {
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

const TARGET_URL =
  process.env.NEON_DATABASE_URL ||
  'postgresql://neondb_owner:npg_kLTO3alGm2RE@ep-nameless-bird-b30zfam7-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30';

process.env.DATABASE_URL = TARGET_URL;

const DDL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "TripEventPlan" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'DAY_OUTING',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "plannedCapRp" DOUBLE PRECISION NOT NULL,
    "recommendedTier" TEXT NOT NULL DEFAULT 'BALANCED',
    "fundingSource" TEXT NOT NULL DEFAULT 'DISCRETIONARY',
    "prepaidAmountRp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "sweptAmountRp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sweptDestination" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TripEventPlan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TripEventPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "TripEventPlan_userId_year_month_idx" ON "TripEventPlan"("userId", "year", "month")`,

  `CREATE TABLE IF NOT EXISTS "PeriodCommitment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'FORCE_MAJEURE',
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "fundingSource" TEXT NOT NULL DEFAULT 'PAYCHECK_UPFRONT',
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "tripEventId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PeriodCommitment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PeriodCommitment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PeriodCommitment_tripEventId_fkey" FOREIGN KEY ("tripEventId") REFERENCES "TripEventPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "PeriodCommitment_userId_year_month_idx" ON "PeriodCommitment"("userId", "year", "month")`,

  `CREATE TABLE IF NOT EXISTS "TripExpenseItem" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tripEventId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'FOOD_DRINK',
    "amountRp" DOUBLE PRECISION NOT NULL,
    "isSharedAdvance" BOOLEAN NOT NULL DEFAULT false,
    "counterpartyName" TEXT,
    "reimbursedAmountRp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TripExpenseItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TripExpenseItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TripExpenseItem_tripEventId_fkey" FOREIGN KEY ("tripEventId") REFERENCES "TripEventPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "TripExpenseItem_userId_tripEventId_idx" ON "TripExpenseItem"("userId", "tripEventId")`,

  `CREATE TABLE IF NOT EXISTS "SinkingFundItem" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'ANNUAL_TAX',
    "targetAmountRp" DOUBLE PRECISION NOT NULL,
    "savedAmountRp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetMonth" INTEGER NOT NULL,
    "targetYear" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SinkingFundItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SinkingFundItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "SinkingFundItem_userId_isActive_idx" ON "SinkingFundItem"("userId", "isActive")`,
];

async function main() {
  const { createRequire } = await import('node:module');
  const req = createRequire(__filename);
  const { PrismaClient } = req(path.join(API_DIR, 'node_modules', '@prisma', 'client'));
  const prisma = new PrismaClient();
  try {
    for (const stmt of DDL_STATEMENTS) {
      await prisma.$executeRawUnsafe(stmt);
    }
    const counts = await Promise.all([
      prisma.periodCommitment.count(),
      prisma.tripEventPlan.count(),
      prisma.tripExpenseItem.count(),
      prisma.sinkingFundItem.count(),
    ]);
    console.log(
      `Phase 3 additive schema applied cleanly (counts: commitments=${counts[0]}, events=${counts[1]}, expenses=${counts[2]}, sinkingFunds=${counts[3]}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Phase 3 additive schema migration failed:', err);
  process.exit(1);
});
