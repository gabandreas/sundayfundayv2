import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PeriodTarget {
  month: number;
  year: number;
  targetPayoutDate: Date;
  nextPayoutDate: Date;
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function main() {
  const isCommit = process.argv.includes('--commit');

  console.log('='.repeat(90));
  console.log('HISTORICAL BACKFILL: PAYROLL PAYOUT DATES & CONSUMPTION CYCLES');
  console.log(`MODE: ${isCommit ? '*** COMMIT (WRITING TO DATABASE) ***' : 'DRY RUN (NO CHANGES APPLIED)'}`);
  console.log('='.repeat(90));

  const config = await prisma.globalConfig.findFirst();
  const payoutDay = config?.payrollPayoutDay ?? 25;
  console.log(`Using configured GlobalConfig.payrollPayoutDay: ${payoutDay}`);

  // 6 historical periods: July to December 2026
  const targetPeriods: PeriodTarget[] = [
    {
      month: 7,
      year: 2026,
      targetPayoutDate: new Date(Date.UTC(2026, 6, payoutDay)), // 2026-07-25
      nextPayoutDate: new Date(Date.UTC(2026, 7, payoutDay)),   // 2026-08-25
    },
    {
      month: 8,
      year: 2026,
      targetPayoutDate: new Date(Date.UTC(2026, 7, payoutDay)), // 2026-08-25
      nextPayoutDate: new Date(Date.UTC(2026, 8, payoutDay)),   // 2026-09-25
    },
    {
      month: 9,
      year: 2026,
      targetPayoutDate: new Date(Date.UTC(2026, 8, payoutDay)), // 2026-09-25
      nextPayoutDate: new Date(Date.UTC(2026, 9, payoutDay)),   // 2026-10-25
    },
    {
      month: 10,
      year: 2026,
      targetPayoutDate: new Date(Date.UTC(2026, 9, payoutDay)), // 2026-10-25
      nextPayoutDate: new Date(Date.UTC(2026, 10, payoutDay)),  // 2026-11-25
    },
    {
      month: 11,
      year: 2026,
      targetPayoutDate: new Date(Date.UTC(2026, 10, payoutDay)), // 2026-11-25
      nextPayoutDate: new Date(Date.UTC(2026, 11, payoutDay)),  // 2026-12-25
    },
    {
      month: 12,
      year: 2026,
      targetPayoutDate: new Date(Date.UTC(2026, 11, payoutDay)), // 2026-12-25
      nextPayoutDate: new Date(Date.UTC(2027, 0, payoutDay)),   // 2027-01-25
    },
  ];

interface PlanItem {
  id: number;
  month: number;
  year: number;
  status: string;
  currentPayoutDate: string;
  targetPayoutDate: Date;
  targetPayoutDateStr: string;
  cycleStartDateStr: string;
  cycleEndDateStr: string;
  daysInCycle: number;
  finalTotalIncome: number | null;
  totalDeductions: number | null;
  actualDailyOperational: number | null;
  actualSavings: number | null;
  selfReward: number | null;
  deficitUncovered: number | null;
  survivalPocket: number | null;
}

  console.log('\nEvaluating target periods:');
  console.log('-'.repeat(90));

  const plan: PlanItem[] = [];

  for (const target of targetPeriods) {
    const snapshot = await prisma.monthlySnapshot.findUnique({
      where: {
        month_year: {
          month: target.month,
          year: target.year,
        },
      },
    });

    if (!snapshot) {
      console.log(`[SKIPPED] Period ${target.month}/${target.year}: No snapshot found in database.`);
      continue;
    }

    const cycleStartDate = target.targetPayoutDate;
    const cycleEndDate = new Date(target.nextPayoutDate.getTime() - 86400000);
    const daysInCycle = Math.round((cycleEndDate.getTime() - cycleStartDate.getTime()) / 86400000) + 1;

    plan.push({
      id: snapshot.id,
      month: snapshot.month,
      year: snapshot.year,
      status: snapshot.status,
      currentPayoutDate: snapshot.payrollPayoutDate ? formatDate(snapshot.payrollPayoutDate) : 'NULL',
      targetPayoutDate: target.targetPayoutDate,
      targetPayoutDateStr: formatDate(target.targetPayoutDate),
      cycleStartDateStr: formatDate(cycleStartDate),
      cycleEndDateStr: formatDate(cycleEndDate),
      daysInCycle,
      // Stored financial figures to prove invariant preservation
      finalTotalIncome: snapshot.finalTotalIncome,
      totalDeductions: snapshot.totalDeductions,
      actualDailyOperational: snapshot.actualDailyOperational,
      actualSavings: snapshot.actualSavings,
      selfReward: snapshot.selfReward,
      deficitUncovered: snapshot.deficitUncovered,
      survivalPocket: snapshot.survivalPocket,
    });
  }

  // Print table of planned changes
  console.log(
    'Period'.padEnd(10) +
    'Status'.padEnd(10) +
    'Current Date'.padEnd(15) +
    'Target Date'.padEnd(15) +
    'Cycle Range'.padEnd(28) +
    'Days'.padEnd(6) +
    'LOCKED-Bypass'
  );
  console.log('-'.repeat(90));

  for (const item of plan) {
    const periodStr = `${item.month}/${item.year}`;
    const rangeStr = `${item.cycleStartDateStr} -> ${item.cycleEndDateStr}`;
    const bypassNote = item.status === 'LOCKED' ? 'YES (Direct Prisma)' : 'N/A';

    console.log(
      periodStr.padEnd(10) +
      item.status.padEnd(10) +
      item.currentPayoutDate.padEnd(15) +
      item.targetPayoutDateStr.padEnd(15) +
      rangeStr.padEnd(28) +
      String(item.daysInCycle).padEnd(6) +
      bypassNote
    );
  }

  console.log('-'.repeat(90));

  // Financial Invariant Verification
  console.log('\nFINANCIAL INVARIANT VERIFICATION (Pre-Backfill Snapshot Values):');
  console.log(
    'Period'.padEnd(10) +
    'Income'.padEnd(14) +
    'Deductions'.padEnd(14) +
    'Daily Oper'.padEnd(14) +
    'Savings'.padEnd(14) +
    'Self-Reward'.padEnd(14) +
    'Deficit'
  );
  console.log('-'.repeat(90));

  for (const item of plan) {
    console.log(
      `${item.month}/${item.year}`.padEnd(10) +
      String(item.finalTotalIncome ?? 0).padEnd(14) +
      String(item.totalDeductions ?? 0).padEnd(14) +
      String(item.actualDailyOperational ?? 0).padEnd(14) +
      String(item.actualSavings ?? 0).padEnd(14) +
      String(item.selfReward ?? 0).padEnd(14) +
      String(item.deficitUncovered ?? 0)
    );
  }
  console.log('-'.repeat(90));

  if (!isCommit) {
    console.log('\nDRY RUN COMPLETE: No database records were modified.');
    console.log('To apply these changes directly via Prisma transaction, execute:');
    console.log('  npx ts-node scripts/backfill_payroll_payout_dates.ts --commit');
    await prisma.$disconnect();
    return;
  }

  console.log('\nCOMMITTING CHANGES TO DATABASE (Single Atomic Transaction)...');

  await prisma.$transaction(async (tx) => {
    for (const item of plan) {
      await tx.monthlySnapshot.update({
        where: { id: item.id },
        data: {
          payrollPayoutDate: item.targetPayoutDate,
          isPayoutDateConfirmed: true,
        },
      });
      console.log(`  Updated snapshot id=${item.id} (${item.month}/${item.year}) [Status: ${item.status}]`);
    }
  });

  console.log('\nVerifying post-commit database state and financial invariants:');
  console.log('-'.repeat(90));
  let allMatch = true;

  for (const item of plan) {
    const updated = await prisma.monthlySnapshot.findUniqueOrThrow({
      where: { id: item.id },
    });

    const incomeMatch = updated.finalTotalIncome === item.finalTotalIncome;
    const dedMatch = updated.totalDeductions === item.totalDeductions;
    const operMatch = updated.actualDailyOperational === item.actualDailyOperational;
    const savMatch = updated.actualSavings === item.actualSavings;
    const rewardMatch = updated.selfReward === item.selfReward;
    const defMatch = updated.deficitUncovered === item.deficitUncovered;
    const surMatch = updated.survivalPocket === item.survivalPocket;

    const matched = incomeMatch && dedMatch && operMatch && savMatch && rewardMatch && defMatch && surMatch;
    if (!matched) allMatch = false;

    console.log(
      `Period ${item.month}/${item.year}: payoutDate=${formatDate(updated.payrollPayoutDate!)} ` +
      `isConfirmed=${updated.isPayoutDateConfirmed} status=${updated.status} ` +
      `[Financial Invariants: ${matched ? '100% IDENTICAL' : 'MISMATCH DETECTED'}]`
    );
  }

  console.log('-'.repeat(90));
  if (allMatch) {
    console.log('SUCCESS: All 6 historical snapshots backfilled. All financial invariants 100% preserved.');
  } else {
    console.error('ERROR: Financial mismatch detected after backfill!');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Backfill script error:', err);
  prisma.$disconnect();
  process.exit(1);
});
