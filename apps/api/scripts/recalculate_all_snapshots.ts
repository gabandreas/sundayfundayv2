import * as fs from 'fs';
import * as path from 'path';

// Load .env explicitly
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || '').trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  }
}

import { PrismaClient, AuditCategory, AuditSeverity } from '@prisma/client';
import { calculatePayroll } from '../src/calculator/payroll';
import { calculateTotalDeductions, calculateWaterfall } from '../src/calculator/waterfall';

const prisma = new PrismaClient();

function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
  const isNegative = amount < 0;
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export interface ReconciliationRow {
  period: string;
  finalTotalIncome: number;
  totalDeductions: number;
  fixedExpenses: number;
  dailyOperationalTarget: number;
  savingsTarget: number;
  bufferPocket: number;
  availableFunds: number;
  // Before
  oldActualDailyOperational: number;
  oldActualSavings: number;
  oldSelfReward: number;
  oldDeficitUncovered: number;
  oldSurvivalPocket: number;
  // After
  newActualDailyOperational: number;
  newActualSavings: number;
  newSelfReward: number;
  newDeficitUncovered: number;
  newSurvivalPocket: number;
  statusShift: string;
}

export async function runRecalculation(isCommit = false) {
  const isDryRun = !isCommit;
  console.log(`\n================================================================================`);
  console.log(`HISTORICAL SNAPSHOT RECALCULATION PIPELINE (${isDryRun ? 'DRY-RUN / PREVIEW' : 'COMMIT MODE'})`);
  console.log(`New 2-Priority Waterfall Formula (Daily Operational Upfront, P1 Savings, P2 Self-Reward)`);
  console.log(`================================================================================\n`);

  const config = await prisma.globalConfig.findFirst();
  if (!config) {
    throw new Error('GlobalConfig record (id=1) not found');
  }

  const snapshots = await prisma.monthlySnapshot.findMany({
    where: { year: 2026, month: { gte: 7 } },
    include: { transactions: true },
    orderBy: { month: 'asc' },
  });

  const reconciliationRows: ReconciliationRow[] = [];

  const updateOperations: Array<() => Promise<any>> = [];

  for (const snap of snapshots) {
    const period = `${snap.month}/${snap.year}`;

    // Payroll inputs
    const extraIncome = snap.transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const payroll = calculatePayroll({
      baseSalary: config.baseSalary,
      salaryAdjustment: snap.salaryAdjustment,
      totalWorkingDays: snap.totalWorkingDays,
      dailyAllowance: config.dailyAllowance,
      cafeteriaDeduction: snap.cafeteriaDeduction,
      thrAmount: snap.thrAmount,
      bonusAmount: snap.bonusAmount,
      extraIncome,
      laptopAllowance: config.laptopAllowance,
    });

    const totalDeductions = calculateTotalDeductions(snap.transactions);

    // Frozen per-snapshot targets
    const fixedExpenses = snap.transport + snap.internet + snap.vape + snap.haircut;
    const dailyOperationalTarget = snap.dailyOperational;
    const savingsTarget = snap.savings;
    const bufferPocket = snap.bufferPocket;

    const waterfall = calculateWaterfall({
      finalTotalIncome: payroll.finalTotalIncome,
      totalDeductions,
      savingsTarget,
      selfRewardTarget: snap.selfRewardTarget,
      dailyOperationalTarget,
      fixedExpenses,
      bufferPocket,
    });

    // Authentic Old stored figures (sourced strictly from V2's currently stored pre-recalculation state)
    const oldActualDailyOperational = snap.actualDailyOperational ?? 0;
    const oldActualSavings = snap.actualSavings ?? 0;
    const oldSelfReward = snap.selfReward ?? 0;
    const oldDeficitUncovered = snap.deficitUncovered ?? 0;
    const oldSurvivalPocket = snap.survivalPocket ?? 0;

    // New calculated figures
    const newActualDailyOperational = waterfall.actualDailyOperational;
    const newActualSavings = waterfall.actualSavings;
    const newSelfReward = waterfall.actualSelfReward;
    const newDeficitUncovered = waterfall.deficitUncovered;
    const newSurvivalPocket = waterfall.survivalPocket;

    let statusShift = 'SURPLUS -> SURPLUS';
    if (oldDeficitUncovered === 0 && newDeficitUncovered > 0) {
      statusShift = `SURPLUS -> DEFICIT (-${formatRupiah(newDeficitUncovered)})`;
    } else if (oldDeficitUncovered > 0 && newDeficitUncovered === 0) {
      statusShift = 'DEFICIT -> SURPLUS';
    }

    reconciliationRows.push({
      period,
      finalTotalIncome: payroll.finalTotalIncome,
      totalDeductions,
      fixedExpenses,
      dailyOperationalTarget,
      savingsTarget,
      bufferPocket,
      availableFunds: waterfall.availableFunds,
      oldActualDailyOperational,
      oldActualSavings,
      oldSelfReward,
      oldDeficitUncovered,
      oldSurvivalPocket,
      newActualDailyOperational,
      newActualSavings,
      newSelfReward,
      newDeficitUncovered,
      newSurvivalPocket,
      statusShift,
    });

    updateOperations.push(() =>
      prisma.monthlySnapshot.update({
        where: { id: snap.id },
        data: {
          netSalaryIncome: payroll.netSalaryIncome,
          extraIncome: payroll.extraIncome,
          finalTotalIncome: payroll.finalTotalIncome,
          totalDeductions,
          actualDailyOperational: newActualDailyOperational,
          actualSavings: newActualSavings,
          selfReward: newSelfReward,
          deficitUncovered: newDeficitUncovered,
          survivalPocket: newSurvivalPocket,
        },
      })
    );
  }

  // 1. Term-by-Term Computation Breakdown
  console.log(`TERM-BY-TERM COMPUTATION BREAKDOWN (Frozen Snapshot Targets):`);
  console.log(`Formula: essentialAndOperational = fixedExpenses + dailyOperationalTarget`);
  console.log(`         availableFunds = finalTotalIncome - essentialAndOperational - bufferPocket - totalDeductions\n`);

  console.log(
    `| Period  | Income (THP) | Deductions   | Fixed (4)    | DailyOp Target | Total Upfront | Buffer | Available Funds | Status |`
  );
  console.log(
    `|---------|--------------|--------------|--------------|----------------|---------------|--------|-----------------|--------|`
  );

  for (const r of reconciliationRows) {
    const totalUpfront = r.fixedExpenses + r.dailyOperationalTarget;
    console.log(
      `| ${r.period.padEnd(7)} | ${formatRupiah(r.finalTotalIncome).padStart(12)} | ${formatRupiah(r.totalDeductions).padStart(12)} | ${formatRupiah(r.fixedExpenses).padStart(12)} | ${formatRupiah(r.dailyOperationalTarget).padStart(14)} | ${formatRupiah(totalUpfront).padStart(13)} | ${formatRupiah(r.bufferPocket).padStart(6)} | ${formatRupiah(r.availableFunds).padStart(15)} | ${(r.availableFunds < 0 ? 'DEFICIT' : 'SURPLUS').padEnd(6)} |`
    );
  }

  // 2. Before / After Comparison Table
  console.log(`\nBEFORE / AFTER RECONCILIATION REPORT (Per Period):`);
  console.log(
    `| Period  | Metric                  | Old Value (4-Priority) | New Value (2-Priority) | Delta Shift | Note |`
  );
  console.log(
    `|---------|-------------------------|------------------------|------------------------|-------------|------|`
  );

  for (const r of reconciliationRows) {
    const printRow = (metric: string, oldVal: number, newVal: number, note = '') => {
      const delta = newVal - oldVal;
      const deltaStr = delta === 0 ? 'Rp 0' : (delta > 0 ? `+${formatRupiah(delta)}` : formatRupiah(delta));
      console.log(
        `| ${r.period.padEnd(7)} | ${metric.padEnd(23)} | ${formatRupiah(oldVal).padStart(22)} | ${formatRupiah(newVal).padStart(22)} | ${deltaStr.padStart(11)} | ${note} |`
      );
    };

    printRow('actualDailyOperational', r.oldActualDailyOperational, r.newActualDailyOperational, r.newActualDailyOperational === 0 && r.availableFunds < 0 ? 'Deficit: 0 funded' : 'Guaranteed in full');
    printRow('actualSavings (P1)', r.oldActualSavings, r.newActualSavings, r.newActualSavings < r.savingsTarget ? 'Partial/zero funding' : 'Fully funded');
    printRow('selfReward (P2)', r.oldSelfReward, r.newSelfReward, 'Absorbs remaining surplus');
    printRow('survivalPocket (Need)', r.oldSurvivalPocket, r.newSurvivalPocket, 'Essentials + DailyOp Target');
    printRow('deficitUncovered', r.oldDeficitUncovered, r.newDeficitUncovered, r.newDeficitUncovered > 0 ? 'Truthful deficit flagged' : 'Balanced');
    console.log(`|---------|-------------------------|------------------------|------------------------|-------------|------|`);
  }

  if (isDryRun) {
    console.log(`\n>>> [DRY RUN COMPLETE] Zero database records were modified.`);
    console.log(`>>> To commit these recalculations, run with --commit.`);
    return { success: true, isCommitted: false, rows: reconciliationRows };
  }

  // Transaction Commit
  console.log(`\n>>> EXECUTING DATABASE TRANSACTION...`);
  await prisma.$transaction(async (tx) => {
    for (const snap of snapshots) {
      const r = reconciliationRows.find((x) => x.period === `${snap.month}/${snap.year}`)!;
      await tx.monthlySnapshot.update({
        where: { id: snap.id },
        data: {
          finalTotalIncome: r.finalTotalIncome,
          totalDeductions: r.totalDeductions,
          actualDailyOperational: r.newActualDailyOperational,
          actualSavings: r.newActualSavings,
          selfReward: r.newSelfReward,
          deficitUncovered: r.newDeficitUncovered,
          survivalPocket: r.newSurvivalPocket,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        action: 'RECALCULATE_HISTORICAL_WATERFALL_V2',
        category: AuditCategory.SETTINGS,
        summary: 'Recalculated historical snapshots (2026-07 to 2026-12) under 2-priority waterfall formula',
        details: JSON.stringify(reconciliationRows),
        severity: AuditSeverity.INFO,
      },
    });
  });

  console.log(`>>> [TRANSACTION COMMITTED] All 6 snapshots updated atomically in database.\n`);
  return { success: true, isCommitted: true, rows: reconciliationRows };
}

if (require.main === module) {
  const isCommit = process.argv.includes('--commit');
  runRecalculation(isCommit)
    .catch((err) => {
      console.error('Recalculation error:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
