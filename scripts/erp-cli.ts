import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  Prisma,
  PrismaClient,
  LiabilityCategory,
  TransactionSourceType,
} from '../apps/api/node_modules/@prisma/client';
import {
  evaluateModularEngine,
  buildDefaultPayrollRules,
  buildDefaultAllocationBuckets,
  buildDefaultSurplusSplitRules,
  buildDefaultFinancialPolicy,
} from '../apps/api/src/calculator/modular-engine';
import { calculateCardDueAmountForMonth } from '../apps/api/src/credit/credit.utils';
import { AuditLogService } from '../apps/api/src/audit/audit-log.service';
import { AuditSelectors } from '../apps/api/src/audit/audit.selectors';
import { AuditService } from '../apps/api/src/audit/audit.service';
import { CreditSelectors } from '../apps/api/src/credit/credit.selectors';
import { ReportsSelectors } from '../apps/api/src/reports/reports.selectors';
import { EmailService, EmailLocale } from '../apps/api/src/email/email.service';

const REPO_ROOT = path.resolve(__dirname, '..');

const NEON_URL =
  process.env.NEON_DATABASE_URL ||
  'postgresql://neondb_owner:npg_kLTO3alGm2RE@ep-nameless-bird-b30zfam7-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30';

const LOCAL_URL =
  process.env.LOCAL_DATABASE_URL ||
  'postgresql://postgres:password@127.0.0.1:5433/finance_erp?schema=public';

const USER_ID = 1;

function fmtRp(val: number | null | undefined): string {
  const n = Math.round(val ?? 0);
  const sign = n < 0 ? '-' : '';
  return `${sign}Rp ${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function parseFlags(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eqIdx = arg.indexOf('=');
    if (eqIdx !== -1) {
      out[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
    } else {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function addMonths(month: number, year: number, delta: number): { month: number; year: number } {
  const total = year * 12 + (month - 1) + delta;
  return {
    month: (total % 12) + 1,
    year: Math.floor(total / 12),
  };
}

function monthLabel(month: number, year: number): string {
  const names = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${names[month - 1] ?? month} '${String(year).slice(2)}`;
}

function defaultPayoutDate(month: number, year: number, payoutDay: number): Date {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clamped = Math.min(Math.max(1, payoutDay), lastDay);
  return new Date(Date.UTC(year, month - 1, clamped, 12, 0, 0));
}

function computeCycleDays(
  month: number,
  year: number,
  payoutDay: number,
  currentSnap?: { payrollPayoutDate: Date | null } | null,
  nextSnap?: { payrollPayoutDate: Date | null } | null
): number {
  if (year < 2026 || (year === 2026 && month <= 9)) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }
  const start = currentSnap?.payrollPayoutDate
    ? new Date(currentSnap.payrollPayoutDate)
    : defaultPayoutDate(month, year, payoutDay);
  const next = addMonths(month, year, 1);
  const endNext = nextSnap?.payrollPayoutDate
    ? new Date(nextSnap.payrollPayoutDate)
    : defaultPayoutDate(next.month, next.year, payoutDay);

  const utcStart = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const utcEnd = Date.UTC(endNext.getUTCFullYear(), endNext.getUTCMonth(), endNext.getUTCDate());
  return Math.max(1, Math.round((utcEnd - utcStart) / (1000 * 60 * 60 * 24)));
}

function runDryEngineForSnapshot(
  snap: any,
  nextSnap: any,
  globalConfig: any,
  totalCreditBills: number
) {
  const payoutDay = globalConfig?.payrollPayoutDay ?? 27;
  const cycleDays = computeCycleDays(snap.month, snap.year, payoutDay, snap, nextSnap);
  const frozen: any = snap.frozenRulesJson || {};

  const payrollRules =
    frozen.payrollRules ??
    globalConfig?.payrollRulesJson ??
    buildDefaultPayrollRules(
      globalConfig?.dailyAllowance ?? 25000,
      globalConfig?.laptopAllowance ?? 250000
    );

  const attendanceRule = Array.isArray(payrollRules)
    ? payrollRules.find((r: any) => r.id === 'daily_attendance')
    : null;
  const resolvedDailyAllowance = attendanceRule?.value ?? globalConfig?.dailyAllowance ?? 25000;

  const allocationBuckets =
    frozen.allocationBuckets ??
    globalConfig?.allocationBucketsJson ??
    buildDefaultAllocationBuckets({
      transport: snap.transport,
      internet: snap.internet,
      vape: snap.vape,
      haircut: snap.haircut,
      dailyOperational: snap.dailyOperational,
      savings: snap.savings,
      bufferPocket: snap.bufferPocket,
    });

  const extraIncome = (snap.transactions ?? [])
    .filter((t: any) => t.type === 'INCOME' && t.sourceType !== 'OPERATIONAL_REFUND')
    .reduce((s: number, t: any) => s + t.amount, 0);

  const trackStartYear = globalConfig?.activeTrackingStartYear ?? 2026;
  const trackStartMonth = globalConfig?.activeTrackingStartMonth ?? 10;
  const isPreTracking =
    snap.year < trackStartYear || (snap.year === trackStartYear && snap.month < trackStartMonth);
  const manualDeductions = isPreTracking
    ? (snap.transactions ?? [])
        .filter(
          (t: any) =>
            t.type === 'DEDUCTION' &&
            t.sourceType === 'MANUAL' &&
            !t.fixedEssentialCategory &&
            !t.bucketKey
        )
        .reduce((s: number, t: any) => s + t.amount, 0)
    : 0;
  const effectiveTotalDeductions = Math.round(totalCreditBills) + manualDeductions;

  const bridgeInflow = Math.max(0, Math.round(snap.bridgeInflowAmount ?? 0));

  return {
    extraIncome,
    bridgeInflow,
    effectiveTotalDeductions,
    ...evaluateModularEngine({
      baseSalary: globalConfig?.baseSalary ?? 4000000,
      salaryAdjustment: snap.salaryAdjustment,
      totalWorkingDays: snap.totalWorkingDays,
      dailyAllowance: resolvedDailyAllowance,
      cafeteriaDeduction: snap.cafeteriaDeduction,
      thrAmount: snap.thrAmount,
      bonusAmount: snap.bonusAmount,
      extraIncome,
      bridgeInflowAmount: bridgeInflow,
      month: snap.month,
      year: snap.year,
      cycleDays,
      totalCreditBills: Math.round(totalCreditBills),
      totalDeductions: effectiveTotalDeductions,
      payrollRules,
      allocationBuckets,
      surplusSplitRules: frozen.surplusSplitRules ?? buildDefaultSurplusSplitRules(),
      financialPolicy: frozen.financialPolicy ?? buildDefaultFinancialPolicy(),
      budgetRevisions: (snap.budgetRevisions ?? []).map((r: any) => ({
        bucketKey: r.bucketKey,
        category: r.category,
        newValue: r.newValue,
      })),
      isManualOverride: Boolean(snap.isManualOverride),
      lockedP1: snap.lockedP1 ?? null,
      lockedP2: snap.lockedP2 ?? null,
      oneOffBills: Array.isArray(snap.oneOffBillsJson) ? snap.oneOffBillsJson : null,
      transactions: (snap.transactions ?? []).map((t: any) => ({
        type: t.type,
        sourceType: t.sourceType,
        fixedEssentialCategory: t.fixedEssentialCategory,
        bucketKey: t.bucketKey,
        amount: t.amount,
      })),
    }),
  };
}

function toJsonInput(
  val: Prisma.JsonValue | null | undefined
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (val === undefined || val === null) return Prisma.JsonNull;
  return val as Prisma.InputJsonValue;
}

async function recomputeBulkAndDraftForMonth(
  prisma: PrismaClient,
  month: number,
  year: number
) {
  const items = await prisma.liabilityLineItem.findMany({
    where: { userId: USER_ID, month, year },
  });
  const paylaterAmount = items
    .filter((i) => i.category === LiabilityCategory.PAYLATER)
    .reduce((s, i) => s + Math.round(i.monthlyAmount), 0);
  const personalDebtAmount = items
    .filter(
      (i) =>
        i.category === LiabilityCategory.PERSONAL_DEBT ||
        i.category === LiabilityCategory.P1_VAULT_REFUND
    )
    .reduce((s, i) => s + Math.round(i.monthlyAmount), 0);

  const existing = await prisma.monthlyBulkBill.findUnique({
    where: { userId_month_year: { userId: USER_ID, month, year } },
  });
  const ccAmount = existing?.creditCardAmount ?? 0;

  const bill = await prisma.monthlyBulkBill.upsert({
    where: { userId_month_year: { userId: USER_ID, month, year } },
    create: {
      userId: USER_ID,
      month,
      year,
      label: `Monthly Liabilities ${month}/${year}`,
      paylaterAmount,
      personalDebtAmount,
      creditCardAmount: ccAmount,
      amount: paylaterAmount + personalDebtAmount + ccAmount,
    },
    update: {
      paylaterAmount,
      personalDebtAmount,
      amount: paylaterAmount + personalDebtAmount + ccAmount,
    },
  });

  const snap = await prisma.monthlySnapshot.findUnique({
    where: { userId_month_year: { userId: USER_ID, month, year } },
    include: {
      transactions: true,
      budgetRevisions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    },
  });

  if (snap && snap.status === 'DRAFT') {
    await prisma.transaction.deleteMany({
      where: {
        snapshotId: snap.id,
        type: 'CREDIT_BILL',
        sourceType: {
          in: [
            TransactionSourceType.BULK_BILL,
            TransactionSourceType.PERSONAL_DEBT,
            TransactionSourceType.CC_TRANSACTION,
          ],
        },
      },
    });

    const cardTxs = await prisma.creditCardTransaction.findMany({
      where: { userId: USER_ID },
    });
    const ccTotal = cardTxs.reduce(
      (s, t) => s + calculateCardDueAmountForMonth(t as any, month, year),
      0
    );

    const newTxs: Array<{
      snapshotId: number;
      type: 'CREDIT_BILL';
      sourceType: TransactionSourceType;
      sourceId: number | null;
      label: string;
      amount: number;
      date: Date;
    }> = [];
    if (paylaterAmount > 0) {
      newTxs.push({
        snapshotId: snap.id,
        type: 'CREDIT_BILL',
        sourceType: TransactionSourceType.BULK_BILL,
        sourceId: bill.id,
        label: 'PayLater Bills',
        amount: paylaterAmount,
        date: new Date(Date.UTC(year, month - 1, 25, 12, 0, 0)),
      });
    }
    if (personalDebtAmount > 0) {
      newTxs.push({
        snapshotId: snap.id,
        type: 'CREDIT_BILL',
        sourceType: TransactionSourceType.PERSONAL_DEBT,
        sourceId: bill.id,
        label: 'Personal & Informal Debt',
        amount: personalDebtAmount,
        date: new Date(Date.UTC(year, month - 1, 25, 12, 0, 0)),
      });
    }
    if (ccTotal > 0) {
      newTxs.push({
        snapshotId: snap.id,
        type: 'CREDIT_BILL',
        sourceType: TransactionSourceType.CC_TRANSACTION,
        sourceId: null,
        label: 'Credit Card Statement',
        amount: ccTotal,
        date: new Date(Date.UTC(year, month - 1, 11, 12, 0, 0)),
      });
    }
    if (newTxs.length > 0) {
      await prisma.transaction.createMany({ data: newTxs });
    }

    const refreshedSnap = await prisma.monthlySnapshot.findUniqueOrThrow({
      where: { id: snap.id },
      include: {
        transactions: true,
        budgetRevisions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    });
    const nextYm = addMonths(month, year, 1);
    const nextSnap = await prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId: USER_ID, month: nextYm.month, year: nextYm.year } },
    });
    const globalConfig = await prisma.globalConfig.findFirst({ where: { userId: USER_ID } });
    const totalCreditBills = paylaterAmount + personalDebtAmount + ccTotal;
    const calc = runDryEngineForSnapshot(refreshedSnap, nextSnap, globalConfig, totalCreditBills);

    await prisma.monthlySnapshot.update({
      where: { id: snap.id },
      data: {
        netSalaryIncome: calc.payroll.netSalaryIncome,
        extraIncome: calc.extraIncome,
        finalTotalIncome: calc.payroll.finalTotalIncome,
        totalDeductions: calc.effectiveTotalDeductions,
        actualDailyOperational: calc.waterfall.actualDailyOperational,
        actualSavings: calc.waterfall.actualSavings,
        selfReward: calc.waterfall.actualSelfReward,
        deficitUncovered: calc.waterfall.deficitUncovered,
        survivalPocket: calc.waterfall.survivalPocket,
        bucketRealizationsJson: calc.bucketRealizations as any,
      },
    });
  }

  return bill;
}

async function generateReport(writeToDocs: boolean) {
  const neon = new PrismaClient({ datasources: { db: { url: NEON_URL } } });
  try {
    const config = await neon.globalConfig.findFirst({ where: { userId: USER_ID } });
    const snapshots = await neon.monthlySnapshot.findMany({
      where: { userId: USER_ID },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
      include: { transactions: true, budgetRevisions: true },
    });
    const bulkBills = await neon.monthlyBulkBill.findMany({
      where: { userId: USER_ID },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
    const lineItems = await neon.liabilityLineItem.findMany({
      where: { userId: USER_ID },
      orderBy: [{ year: 'asc' }, { month: 'asc' }, { id: 'asc' }],
    });
    const cardTxs = await neon.creditCardTransaction.findMany({
      where: { userId: USER_ID },
      orderBy: [{ id: 'asc' }],
    });
    const savingsTxs = await neon.savingsManualTransaction.findMany({
      where: { userId: USER_ID },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    });

    const lines: string[] = [];
    lines.push('# Live Ledger State (`userId = 1` / Gabriel)');
    lines.push('');
    lines.push(`Generated from Neon PostgreSQL Cloud at ${new Date().toISOString()}.`);
    lines.push('Regenerate anytime via `npm run erp:report -- --write`.');
    lines.push('');
    lines.push('## Global Configuration');
    lines.push('');
    lines.push(`- Base Salary: ${fmtRp(config?.baseSalary ?? 4000000)}`);
    lines.push(`- Daily Attendance Rate: ${fmtRp(config?.dailyAllowance ?? 25000)}/day`);
    lines.push(`- Laptop Allowance: ${fmtRp(config?.laptopAllowance ?? 250000)}/mo`);
    lines.push(`- Default Payroll Payout Day: ${config?.payrollPayoutDay ?? 27}th`);
    lines.push(`- Credit Statement Cutoff / Due: ${config?.creditStatementDay ?? 20}th / ${config?.creditDueDay ?? 11}th`);
    lines.push('');
    lines.push('## Monthly Snapshots (`MonthlySnapshot`)');
    lines.push('');
    lines.push(
      '| Period | Status | Override | Total Income | Debt Bills | Daily Ops | Core Savings (P1) | Self-Reward (P2) | Deficit | Payout Date |'
    );
    lines.push('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
    for (const s of snapshots) {
      const payoutStr = s.payrollPayoutDate
        ? s.payrollPayoutDate.toISOString().slice(0, 10)
        : '-';
      lines.push(
        `| ${String(s.month).padStart(2, '0')}/${s.year} | ${s.status} | ${s.isManualOverride ? 'YES' : 'NO'} | ${fmtRp(s.finalTotalIncome)} | ${fmtRp(s.totalDeductions)} | ${fmtRp(s.actualDailyOperational)} | ${fmtRp(s.actualSavings)} | ${fmtRp(s.selfReward)} | ${fmtRp(s.deficitUncovered)} | ${payoutStr} |`
      );
    }

    lines.push('');
    lines.push('## 12-Month Debt Matrix (`AUG \'26` - `JUL \'27`)');
    lines.push('');
    lines.push('| Column | PayLater | Credit Card | Personal Debt | Total Due |');
    lines.push('| --- | ---: | ---: | ---: | ---: |');
    for (let i = 0; i < 12; i++) {
      const ym = addMonths(8, 2026, i);
      const bulk = bulkBills.find((b) => b.month === ym.month && b.year === ym.year);
      const pl = bulk?.paylaterAmount ?? 0;
      const pd = bulk?.personalDebtAmount ?? 0;
      const cc = cardTxs.reduce(
        (s, t) => s + calculateCardDueAmountForMonth(t as any, ym.month, ym.year),
        0
      );
      lines.push(
        `| ${monthLabel(ym.month, ym.year)} (${ym.month}/${ym.year}) | ${fmtRp(pl)} | ${fmtRp(cc)} | ${fmtRp(pd)} | ${fmtRp(pl + cc + pd)} |`
      );
    }

    lines.push('');
    lines.push('## Itemized Liability Sub-Ledger (`LiabilityLineItem`)');
    lines.push('');
    lines.push('| ID | Period | Category | Title | Platform | Slice | Amount | Settled |');
    lines.push('| ---: | --- | --- | --- | --- | --- | ---: | --- |');
    for (const li of lineItems) {
      lines.push(
        `| ${li.id} | ${monthLabel(li.month, li.year)} | ${li.category} | ${li.title} | ${li.merchantOrPlatform} | ${li.installmentIndex}/${li.tenorMonths} | ${fmtRp(li.monthlyAmount)} | ${li.isSettled ? 'YES' : 'NO'} |`
      );
    }

    lines.push('');
    lines.push('## Credit Card Charges & Installments (`CreditCardTransaction`)');
    lines.push('');
    lines.push('| ID | Label | Type | Start Billing | Monthly/Amount | Tenor | Active |');
    lines.push('| ---: | --- | --- | --- | ---: | ---: | --- |');
    for (const t of cardTxs) {
      lines.push(
        `| ${t.id} | ${t.label} | ${t.chargeType} | ${t.billingMonth}/${t.billingYear} | ${fmtRp(t.monthlyAmount ?? t.amount)} | ${t.tenor} | ${t.isActive ? 'YES' : 'NO'} |`
      );
    }

    const totalManualSavings = savingsTxs.reduce((s, t) => s + t.amount, 0);
    lines.push('');
    lines.push('## Manual Savings Deposits (`SavingsManualTransaction`)');
    lines.push('');
    lines.push(`- Count: ${savingsTxs.length} entries`);
    lines.push(`- Cumulative Manual Balance: ${fmtRp(totalManualSavings)}`);
    lines.push('');

    const reportText = lines.join('\n');
    console.log(reportText);

    if (writeToDocs) {
      const targetPath = path.join(REPO_ROOT, 'docs', 'LIVE_LEDGER_STATE.md');
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, reportText, 'utf8');
      console.log(`\nWrote live ledger snapshot to ${targetPath}`);
    }
  } finally {
    await neon.$disconnect();
  }
}

async function syncNeonToLocal() {
  const neon = new PrismaClient({ datasources: { db: { url: NEON_URL } } });
  const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } });

  try {
    console.log('Reading userId=1 state from Neon Cloud...');
    const [
      user,
      globalConfig,
      snapshots,
      bulkBills,
      lineItems,
      cardTxs,
      savingsTxs,
      savingsGoals,
      wishlistItems,
      auditLogs,
    ] = await Promise.all([
      neon.user.findUnique({ where: { id: USER_ID } }),
      neon.globalConfig.findFirst({ where: { userId: USER_ID } }),
      neon.monthlySnapshot.findMany({ where: { userId: USER_ID }, orderBy: { id: 'asc' } }),
      neon.monthlyBulkBill.findMany({ where: { userId: USER_ID }, orderBy: { id: 'asc' } }),
      neon.liabilityLineItem.findMany({ where: { userId: USER_ID }, orderBy: { id: 'asc' } }),
      neon.creditCardTransaction.findMany({ where: { userId: USER_ID }, orderBy: { id: 'asc' } }),
      neon.savingsManualTransaction.findMany({ where: { userId: USER_ID }, orderBy: { id: 'asc' } }),
      neon.savingsGoal.findMany({ where: { userId: USER_ID }, orderBy: { id: 'asc' } }),
      neon.wishlistItem.findMany({ where: { userId: USER_ID }, orderBy: { id: 'asc' } }),
      neon.auditLog.findMany({ where: { userId: USER_ID }, orderBy: { id: 'asc' } }),
    ]);

    if (!user) throw new Error('Neon Cloud userId=1 not found');
    const snapIds = snapshots.map((s) => s.id);
    const [transactions, budgetRevisions] = await Promise.all([
      neon.transaction.findMany({
        where: { snapshotId: { in: snapIds } },
        orderBy: { id: 'asc' },
      }),
      neon.budgetRevision.findMany({
        where: { snapshotId: { in: snapIds } },
        orderBy: { id: 'asc' },
      }),
    ]);

    console.log(
      `Fetched ${snapshots.length} snapshots, ${transactions.length} transactions, ${bulkBills.length} bulk bills, ${lineItems.length} line items, ${cardTxs.length} card txs.`
    );

    await local.$transaction(async (tx) => {
      // Ensure User #1 exists locally
      await tx.user.upsert({
        where: { id: USER_ID },
        create: user,
        update: {
          email: user.email,
          fullName: user.fullName,
          passwordHash: user.passwordHash,
          role: user.role,
          status: user.status,
        },
      });

      const localSnaps = await tx.monthlySnapshot.findMany({
        where: { userId: USER_ID },
        select: { id: true },
      });
      const localSnapIds = localSnaps.map((s) => s.id);

      // Delete child tables first
      if (localSnapIds.length > 0) {
        await tx.budgetRevision.deleteMany({ where: { snapshotId: { in: localSnapIds } } });
        await tx.transaction.deleteMany({ where: { snapshotId: { in: localSnapIds } } });
      }
      await tx.monthlySnapshot.deleteMany({ where: { userId: USER_ID } });
      await tx.liabilityLineItem.deleteMany({ where: { userId: USER_ID } });
      await tx.monthlyBulkBill.deleteMany({ where: { userId: USER_ID } });
      await tx.creditCardTransaction.deleteMany({ where: { userId: USER_ID } });
      await tx.savingsManualTransaction.deleteMany({ where: { userId: USER_ID } });
      await tx.wishlistItem.deleteMany({ where: { userId: USER_ID } });
      await tx.savingsGoal.deleteMany({ where: { userId: USER_ID } });
      await tx.auditLog.deleteMany({ where: { userId: USER_ID } });
      await tx.globalConfig.deleteMany({ where: { userId: USER_ID } });

      // Insert parent tables first
      if (globalConfig) {
        await tx.globalConfig.create({
          data: {
            ...globalConfig,
            payrollRulesJson: toJsonInput(globalConfig.payrollRulesJson),
            allocationBucketsJson: toJsonInput(globalConfig.allocationBucketsJson),
            surplusSplitRulesJson: toJsonInput(globalConfig.surplusSplitRulesJson),
            financialPolicyJson: toJsonInput(globalConfig.financialPolicyJson),
            customRoutineLabelsJson: toJsonInput(globalConfig.customRoutineLabelsJson),
            customRoutineCategoriesJson: toJsonInput(globalConfig.customRoutineCategoriesJson),
            sandboxStateJson: toJsonInput(globalConfig.sandboxStateJson),
            enabledModulesJson: toJsonInput(globalConfig.enabledModulesJson),
            formulaParamsJson: toJsonInput(globalConfig.formulaParamsJson),
          },
        });
      }

      if (snapshots.length > 0) {
        await tx.monthlySnapshot.createMany({
          data: snapshots.map((s) => ({
            ...s,
            frozenRulesJson: toJsonInput(s.frozenRulesJson),
            bucketRealizationsJson: toJsonInput(s.bucketRealizationsJson),
            oneOffBillsJson: toJsonInput(s.oneOffBillsJson),
          })),
        });
      }

      if (transactions.length > 0) {
        await tx.transaction.createMany({ data: transactions });
      }
      if (budgetRevisions.length > 0) {
        await tx.budgetRevision.createMany({ data: budgetRevisions });
      }
      if (bulkBills.length > 0) {
        await tx.monthlyBulkBill.createMany({ data: bulkBills });
      }
      if (lineItems.length > 0) {
        await tx.liabilityLineItem.createMany({ data: lineItems });
      }
      if (cardTxs.length > 0) {
        await tx.creditCardTransaction.createMany({ data: cardTxs });
      }
      if (savingsTxs.length > 0) {
        await tx.savingsManualTransaction.createMany({ data: savingsTxs });
      }
      if (savingsGoals.length > 0) {
        await tx.savingsGoal.createMany({ data: savingsGoals });
      }
      if (wishlistItems.length > 0) {
        await tx.wishlistItem.createMany({ data: wishlistItems });
      }
      if (auditLogs.length > 0) {
        await tx.auditLog.createMany({ data: auditLogs });
      }
    });

    // Sync serial sequences so local inserts never collide
    const tablesWithId = [
      'GlobalConfig',
      'MonthlySnapshot',
      'Transaction',
      'BudgetRevision',
      'MonthlyBulkBill',
      'LiabilityLineItem',
      'CreditCardTransaction',
      'SavingsManualTransaction',
      'SavingsGoal',
      'WishlistItem',
      'AuditLog',
    ];
    for (const tbl of tablesWithId) {
      await local.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${tbl}"', 'id'), COALESCE((SELECT MAX(id) FROM "${tbl}"), 1), true);`
      );
    }

    console.log('Successfully synced Neon Cloud userId=1 -> Local 127.0.0.1:5433.');
  } finally {
    await neon.$disconnect();
    await local.$disconnect();
  }
}

async function cliAddItem(flags: Record<string, string | boolean>) {
  const title = String(flags.title || '');
  const category = String(flags.category || 'PAYLATER').toUpperCase() as LiabilityCategory;
  const totalAmount = Number(flags.amount || 0);
  const tenor = Math.max(1, Number(flags.tenor || 1));
  const baseMonth = Number(flags.month || 11);
  const baseYear = Number(flags.year || 2026);
  const merchant = String(flags.merchant || (category === 'PERSONAL_DEBT' ? 'SPinjam' : 'SPayLater'));
  const holdPastCutoff = flags['hold-past-cutoff'] === 'true' || flags['hold-past-cutoff'] === true;

  if (!title || totalAmount <= 0 || !Object.values(LiabilityCategory).includes(category)) {
    throw new Error(
      'Usage: npm run erp:item:add -- --title "Name" --category PAYLATER|PERSONAL_DEBT|P1_VAULT_REFUND --amount 479712 --month 11 --year 2026 [--tenor 3] [--hold-past-cutoff true|false]'
    );
  }

  const perSlice = Math.round(totalAmount / tenor);
  const offset = holdPastCutoff ? 1 : 0;
  const parentContractId = tenor > 1 ? `plan_${crypto.randomUUID().slice(0, 8)}` : null;

  for (const [label, url] of [
    ['Neon Cloud', NEON_URL],
    ['Local DB', LOCAL_URL],
  ] as const) {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const touched = new Set<string>();
      for (let i = 0; i < tenor; i++) {
        const ym = addMonths(baseMonth, baseYear, offset + i);
        const sliceAmount =
          i === tenor - 1 ? Math.round(totalAmount - perSlice * (tenor - 1)) : perSlice;
        await prisma.liabilityLineItem.create({
          data: {
            userId: USER_ID,
            month: ym.month,
            year: ym.year,
            category,
            title,
            merchantOrPlatform: merchant,
            principalAmount: totalAmount,
            monthlyAmount: sliceAmount,
            tenorMonths: tenor,
            installmentIndex: i + 1,
            cutoffDay: category === LiabilityCategory.PAYLATER ? 15 : 1,
            dueDay: category === LiabilityCategory.PAYLATER ? 25 : 8,
            isSettled: false,
            parentContractId,
          },
        });
        touched.add(`${ym.year}-${ym.month}`);
      }
      for (const k of touched) {
        const [y, m] = k.split('-').map(Number);
        const bill = await recomputeBulkAndDraftForMonth(prisma, m, y);
        console.log(
          `[${label}] Added "${title}" -> ${m}/${y}: PayLater=${fmtRp(bill.paylaterAmount)}, Personal=${fmtRp(bill.personalDebtAmount)}`
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  }
}

async function cliShiftItem(flags: Record<string, string | boolean>) {
  const id = Number(flags.id || 0);
  const direction = String(flags.dir || 'LATER').toUpperCase();
  const splitAmount = flags.split ? Number(flags.split) : 0;

  if (!id || (direction !== 'EARLIER' && direction !== 'LATER')) {
    throw new Error(
      'Usage: npm run erp:item:shift -- --id 12 --dir LATER|EARLIER [--split 150000]'
    );
  }

  const delta = direction === 'EARLIER' ? -1 : 1;
  for (const [label, url] of [
    ['Neon Cloud', NEON_URL],
    ['Local DB', LOCAL_URL],
  ] as const) {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const item = await prisma.liabilityLineItem.findUnique({ where: { id } });
      if (!item || item.userId !== USER_ID) {
        throw new Error(`[${label}] LiabilityLineItem #${id} not found for userId=1`);
      }
      const nextYm = addMonths(item.month, item.year, delta);
      if (splitAmount > 0 && splitAmount < item.monthlyAmount) {
        await prisma.liabilityLineItem.update({
          where: { id: item.id },
          data: { monthlyAmount: Math.round(item.monthlyAmount - splitAmount) },
        });
        await prisma.liabilityLineItem.create({
          data: {
            userId: USER_ID,
            month: nextYm.month,
            year: nextYm.year,
            category: item.category,
            title: `${item.title} (Split)`,
            merchantOrPlatform: item.merchantOrPlatform,
            principalAmount: splitAmount,
            monthlyAmount: Math.round(splitAmount),
            tenorMonths: 1,
            installmentIndex: 1,
            cutoffDay: item.cutoffDay,
            dueDay: item.dueDay,
            isSettled: false,
            notes: `Split from #${item.id} (${item.month}/${item.year})`,
          },
        });
      } else {
        await prisma.liabilityLineItem.update({
          where: { id: item.id },
          data: { month: nextYm.month, year: nextYm.year },
        });
      }

      const b1 = await recomputeBulkAndDraftForMonth(prisma, item.month, item.year);
      const b2 = await recomputeBulkAndDraftForMonth(prisma, nextYm.month, nextYm.year);
      console.log(
        `[${label}] Shifted #${id} (${item.month}/${item.year} -> ${nextYm.month}/${nextYm.year}). Old total=${fmtRp(b1.paylaterAmount + b1.personalDebtAmount)}, New total=${fmtRp(b2.paylaterAmount + b2.personalDebtAmount)}`
      );
    } finally {
      await prisma.$disconnect();
    }
  }
}

async function verifyDbIntegrity(prisma: PrismaClient, label: string): Promise<string[]> {
  const errors: string[] = [];
  const config = await prisma.globalConfig.findFirst({ where: { userId: USER_ID } });
  const snapshots = await prisma.monthlySnapshot.findMany({
    where: { userId: USER_ID },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
    include: {
      transactions: true,
      budgetRevisions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    },
  });
  const bulkBills = await prisma.monthlyBulkBill.findMany({ where: { userId: USER_ID } });
  const lineItems = await prisma.liabilityLineItem.findMany({ where: { userId: USER_ID } });
  const cardTxs = await prisma.creditCardTransaction.findMany({ where: { userId: USER_ID } });

  // 1. Sub-ledger parity
  for (const b of bulkBills) {
    const items = lineItems.filter((li) => li.month === b.month && li.year === b.year);
    const pl = items
      .filter((li) => li.category === LiabilityCategory.PAYLATER)
      .reduce((s, li) => s + Math.round(li.monthlyAmount), 0);
    const pd = items
      .filter(
        (li) =>
          li.category === LiabilityCategory.PERSONAL_DEBT ||
          li.category === LiabilityCategory.P1_VAULT_REFUND
      )
      .reduce((s, li) => s + Math.round(li.monthlyAmount), 0);
    if (Math.round(b.paylaterAmount) !== pl || Math.round(b.personalDebtAmount) !== pd) {
      errors.push(
        `[${label}] Sub-ledger mismatch ${b.month}/${b.year}: Bulk(${b.paylaterAmount}/${b.personalDebtAmount}) vs Items(${pl}/${pd})`
      );
    }
  }

  // 2. Engine zero-drift on active period snapshots (>= 10/2026)
  for (const s of snapshots) {
    if (s.year === 2026 && s.month < 10) continue;
    const bulk = bulkBills.find((b) => b.month === s.month && b.year === s.year);
    const cc = cardTxs.reduce(
      (sum, t) => sum + calculateCardDueAmountForMonth(t as any, s.month, s.year),
      0
    );
    const totalCreditBills =
      (bulk?.paylaterAmount ?? 0) + (bulk?.personalDebtAmount ?? 0) + cc;
    const nextYm = addMonths(s.month, s.year, 1);
    const nextSnap = snapshots.find((ns) => ns.month === nextYm.month && ns.year === nextYm.year);
    const calc = runDryEngineForSnapshot(s, nextSnap, config, totalCreditBills);

    const pairs: Array<[string, number | null, number]> = [
      [
        'finalTotalIncome',
        s.finalTotalIncome,
        calc.payroll.finalTotalIncome,
      ],
      ['totalDeductions', s.totalDeductions, calc.effectiveTotalDeductions],
      ['actualDailyOperational', s.actualDailyOperational, calc.waterfall.actualDailyOperational],
      ['actualSavings', s.actualSavings, calc.waterfall.actualSavings],
      ['selfReward', s.selfReward, calc.waterfall.actualSelfReward],
      ['deficitUncovered', s.deficitUncovered, calc.waterfall.deficitUncovered],
    ];
    for (const [field, stored, computed] of pairs) {
      if (Math.round(stored ?? 0) !== Math.round(computed ?? 0)) {
        errors.push(
          `[${label}] Drift in ${s.month}/${s.year}.${field}: stored=${stored} vs engine=${computed}`
        );
      }
    }
  }

  return errors;
}

async function runDoctor() {
  const neon = new PrismaClient({ datasources: { db: { url: NEON_URL } } });
  const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } });
  try {
    const neonErrors = await verifyDbIntegrity(neon, 'Neon Cloud');
    const localErrors = await verifyDbIntegrity(local, 'Local DB');
    const allErrors = [...neonErrors, ...localErrors];

    // Cross-DB parity check
    const [nUser, lUser, nSnaps, lSnaps, nBulks, lBulks, nItems, lItems] = await Promise.all([
      neon.user.findUnique({ where: { id: USER_ID }, select: { email: true, fullName: true } }),
      local.user.findUnique({ where: { id: USER_ID }, select: { email: true, fullName: true } }),
      neon.monthlySnapshot.findMany({ where: { userId: USER_ID }, orderBy: [{ year: 'asc' }, { month: 'asc' }] }),
      local.monthlySnapshot.findMany({ where: { userId: USER_ID }, orderBy: [{ year: 'asc' }, { month: 'asc' }] }),
      neon.monthlyBulkBill.findMany({ where: { userId: USER_ID }, orderBy: [{ year: 'asc' }, { month: 'asc' }] }),
      local.monthlyBulkBill.findMany({ where: { userId: USER_ID }, orderBy: [{ year: 'asc' }, { month: 'asc' }] }),
      neon.liabilityLineItem.count({ where: { userId: USER_ID } }),
      local.liabilityLineItem.count({ where: { userId: USER_ID } }),
    ]);

    if (!nUser || !lUser || nUser.email !== lUser.email || nUser.fullName !== lUser.fullName) {
      allErrors.push(
        `Cross-DB User #${USER_ID} profile mismatch: Neon=${nUser?.email}/${nUser?.fullName} Local=${lUser?.email}/${lUser?.fullName}`
      );
    }

    if (nSnaps.length !== lSnaps.length) {
      allErrors.push(`Cross-DB snapshot count mismatch: Neon=${nSnaps.length} Local=${lSnaps.length}`);
    }
    if (nBulks.length !== lBulks.length) {
      allErrors.push(`Cross-DB bulk bill count mismatch: Neon=${nBulks.length} Local=${lBulks.length}`);
    }
    if (nItems !== lItems) {
      allErrors.push(`Cross-DB LiabilityLineItem count mismatch: Neon=${nItems} Local=${lItems}`);
    }

    for (const nb of nBulks) {
      const lb = lBulks.find((b) => b.month === nb.month && b.year === nb.year);
      if (
        !lb ||
        Math.round(lb.paylaterAmount) !== Math.round(nb.paylaterAmount) ||
        Math.round(lb.personalDebtAmount) !== Math.round(nb.personalDebtAmount)
      ) {
        allErrors.push(`Cross-DB MonthlyBulkBill mismatch at ${nb.month}/${nb.year}`);
      }
    }

    if (allErrors.length > 0) {
      console.error('ERP DOCTOR FAILED:');
      for (const e of allErrors) console.error(' -', e);
      process.exit(1);
    }

    console.log(
      `ERP DOCTOR PASSED: 0 Rp engine drift across ${nSnaps.length} snapshots, 100% LiabilityLineItem (${nItems} rows) <-> MonthlyBulkBill (${nBulks.length} rows) parity, and 100% Neon <-> Local sync.`
    );
  } finally {
    await neon.$disconnect();
    await local.$disconnect();
  }
}

async function cliBackupEmail(flags: Record<string, string | boolean>) {
  const neon = new PrismaClient({ datasources: { db: { url: NEON_URL } } });
  try {
    const prismaLike = neon as any;
    const auditLogService = new AuditLogService(prismaLike);
    const auditSelectors = new AuditSelectors(prismaLike);
    const auditService = new AuditService(auditSelectors);
    const creditSelectors = new CreditSelectors(prismaLike);
    const reportsSelectors = new ReportsSelectors(
      prismaLike,
      auditSelectors,
      auditService,
      creditSelectors,
    );
    const emailService = new EmailService(
      prismaLike,
      auditLogService,
      reportsSelectors,
      creditSelectors,
    );

    const localeFlag = String(flags.locale || 'EN').toUpperCase();
    const locale: EmailLocale =
      localeFlag === 'ID' || localeFlag === 'ZH' ? (localeFlag as EmailLocale) : 'EN';
    const recipientEmail = typeof flags.to === 'string' ? flags.to : undefined;

    const result = await emailService.sendOffsiteBackup({
      userId: USER_ID,
      locale,
      recipientEmail,
    });

    console.log(
      `OFF-SITE BACKUP COMPLETE [${result.status}] -> ${result.recipientEmail} | Attachments: ${result.attachmentNames.join(', ')} | SHA-256: ${result.checksumSha256}`,
    );
  } finally {
    await neon.$disconnect();
  }
}

async function fetchFullUser1Dump(prisma: PrismaClient) {
  const [
    globalConfig,
    snapshots,
    bulkBills,
    lineItems,
    cardTxs,
    savingsGoals,
    savingsTxs,
    wishlistItems,
    auditLogs,
  ] = await Promise.all([
    prisma.globalConfig.findFirst({ where: { userId: USER_ID } }),
    prisma.monthlySnapshot.findMany({
      where: { userId: USER_ID },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
      include: {
        transactions: { orderBy: [{ date: 'asc' }, { id: 'asc' }] },
        budgetRevisions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
    }),
    prisma.monthlyBulkBill.findMany({
      where: { userId: USER_ID },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    }),
    prisma.liabilityLineItem.findMany({
      where: { userId: USER_ID },
      orderBy: [{ year: 'asc' }, { month: 'asc' }, { id: 'asc' }],
    }),
    prisma.creditCardTransaction.findMany({
      where: { userId: USER_ID },
      orderBy: [{ id: 'asc' }],
    }),
    prisma.savingsGoal.findMany({
      where: { userId: USER_ID },
      orderBy: [{ id: 'asc' }],
    }),
    prisma.savingsManualTransaction.findMany({
      where: { userId: USER_ID },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    }),
    prisma.wishlistItem.findMany({
      where: { userId: USER_ID },
      orderBy: [{ id: 'asc' }],
    }),
    prisma.auditLog.findMany({
      where: { userId: USER_ID },
      orderBy: [{ id: 'desc' }],
      take: 25,
    }),
  ]);

  return {
    globalConfig,
    snapshots,
    bulkBills,
    lineItems,
    cardTxs,
    savingsGoals,
    savingsTxs,
    wishlistItems,
    auditLogs,
  };
}

async function auditUser1() {
  const neon = new PrismaClient({ datasources: { db: { url: NEON_URL } } });
  const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } });
  try {
    const [n, l] = await Promise.all([fetchFullUser1Dump(neon), fetchFullUser1Dump(local)]);

    console.log('=== USER #1 FORENSIC AUDIT (NEON CLOUD vs LOCAL 5433) ===\n');

    console.log('--- GlobalConfig ---');
    console.log('Neon :', {
      baseSalary: n.globalConfig?.baseSalary,
      dailyAllowance: n.globalConfig?.dailyAllowance,
      laptopAllowance: n.globalConfig?.laptopAllowance,
      payrollPayoutDay: n.globalConfig?.payrollPayoutDay,
      creditStatementDay: n.globalConfig?.creditStatementDay,
      creditDueDay: n.globalConfig?.creditDueDay,
      activeTracking: `${n.globalConfig?.activeTrackingStartMonth}/${n.globalConfig?.activeTrackingStartYear}`,
      killSwitchLeadDays: n.globalConfig?.killSwitchLeadDays,
      killSwitchBannerEnabled: n.globalConfig?.killSwitchBannerEnabled,
      killSwitchNotifyEmail: n.globalConfig?.killSwitchNotifyEmail,
      killSwitchSmtpUser: n.globalConfig?.killSwitchSmtpUser,
      hasSmtpPass: Boolean(n.globalConfig?.killSwitchSmtpAppPassword),
      sandboxStateJson: n.globalConfig?.sandboxStateJson,
    });
    console.log('Local:', {
      baseSalary: l.globalConfig?.baseSalary,
      dailyAllowance: l.globalConfig?.dailyAllowance,
      laptopAllowance: l.globalConfig?.laptopAllowance,
      payrollPayoutDay: l.globalConfig?.payrollPayoutDay,
      killSwitchNotifyEmail: l.globalConfig?.killSwitchNotifyEmail,
      killSwitchSmtpUser: l.globalConfig?.killSwitchSmtpUser,
      hasSmtpPass: Boolean(l.globalConfig?.killSwitchSmtpAppPassword),
    });

    console.log('\n--- MonthlySnapshots (Neon) ---');
    for (const s of n.snapshots) {
      const dedManual = s.transactions
        .filter((t) => t.type === 'DEDUCTION' && t.sourceType === TransactionSourceType.MANUAL)
        .reduce((acc, t) => acc + t.amount, 0);
      const dedRoutine = s.transactions
        .filter((t) => t.type === 'DEDUCTION' && t.fixedEssentialCategory !== null)
        .reduce((acc, t) => acc + t.amount, 0);
      console.log(
        `[${s.id}] ${String(s.month).padStart(2, '0')}/${s.year} status=${s.status} days=${s.totalWorkingDays} salAdj=${s.salaryAdjustment} netSal=${s.netSalaryIncome} extra=${s.extraIncome} bridge=${s.bridgeInflowAmount} finalInc=${s.finalTotalIncome} ded=${s.totalDeductions} targetOps=${s.dailyOperational} actualOps=${s.actualDailyOperational} routines(T=${s.transport},I=${s.internet},V=${s.vape},H=${s.haircut}) p1=${s.actualSavings} p2=${s.selfReward} def=${s.deficitUncovered} | manualDedSum=${dedManual} (routineCatSum=${dedRoutine}) | revs=${s.budgetRevisions.length}`
      );
      for (const tx of s.transactions) {
        console.log(
          `   TX #${tx.id} ${tx.date.toISOString().slice(0, 10)} [${tx.type}/${tx.sourceType}] cat=${tx.fixedEssentialCategory ?? '-'} bucket=${tx.bucketKey ?? '-'} amt=${tx.amount} label="${tx.label}"`
        );
      }
      for (const rev of s.budgetRevisions) {
        console.log(
          `   REV #${rev.id} (${rev.createdAt.toISOString()}) [${rev.category ?? rev.bucketKey ?? 'CUSTOM'}] ${rev.previousValue}->${rev.newValue} (diff=${rev.difference}) reason="${rev.reason}"`
        );
      }
    }

    console.log('\n--- MonthlyBulkBill (Neon) ---');
    for (const b of n.bulkBills) {
      console.log(
        `[${b.id}] ${String(b.month).padStart(2, '0')}/${b.year} paylater=${b.paylaterAmount} personal=${b.personalDebtAmount} cc=${b.creditCardAmount}`
      );
    }

    console.log('\n--- LiabilityLineItem (Neon) ---');
    for (const li of n.lineItems) {
      console.log(
        `[${li.id}] ${String(li.month).padStart(2, '0')}/${li.year} cat=${li.category} "${li.title}" plat="${li.merchantOrPlatform}" slice=${li.installmentIndex}/${li.tenorMonths} cutoff=${li.cutoffDay} due=${li.dueDay} amt=${li.monthlyAmount} settled=${li.isSettled} created=${li.createdAt.toISOString().slice(0, 10)}`
      );
    }

    console.log('\n--- CreditCardTransaction (Neon) ---');
    for (const cc of n.cardTxs) {
      console.log(
        `[${cc.id}] "${cc.label}" type=${cc.chargeType} cat=${cc.category} start=${cc.billingMonth}/${cc.billingYear} amt=${cc.amount} monthly=${cc.monthlyAmount} tenor=${cc.tenor} active=${cc.isActive} status=${cc.status} killSwitch=${cc.killSwitchEnabled}`
      );
    }

    console.log('\n--- WishlistItem (Neon vs Local) ---');
    console.log(`Neon count=${n.wishlistItems.length}, Local count=${l.wishlistItems.length}`);
    for (const w of n.wishlistItems) {
      console.log(
        `[Neon #${w.id}] "${w.name}" price=${w.price} target=${w.targetMonth}/${w.targetYear} status=${w.status} created=${w.createdAt.toISOString()}`
      );
    }
    for (const w of l.wishlistItems) {
      console.log(
        `[Local #${w.id}] "${w.name}" price=${w.price} target=${w.targetMonth}/${w.targetYear} status=${w.status}`
      );
    }

    console.log('\n--- SavingsGoal & SavingsManualTransaction (Neon) ---');
    console.log('Goals:', n.savingsGoals.map((g) => ({ id: g.id, name: g.name, target: g.targetAmount, current: g.currentAllocatedAmount })));
    console.log('ManualTxs:', n.savingsTxs.map((t) => ({ id: t.id, label: t.label, instrument: t.instrumentType, amount: t.amount, date: t.date.toISOString().slice(0, 10) })));

    console.log('\n--- Recent 15 AuditLogs (Neon) ---');
    for (const a of n.auditLogs.slice(0, 15)) {
      console.log(`[#${a.id}] ${a.createdAt.toISOString()} [${a.severity}] ${a.action}: ${a.summary} | ${a.details ?? ''}`);
    }

    // Cross-DB summary comparison
    console.log('\n--- Cross-DB Table Counts (Neon vs Local 5433) ---');
    console.log({
      snapshots: [n.snapshots.length, l.snapshots.length],
      transactions: [
        n.snapshots.reduce((s, x) => s + x.transactions.length, 0),
        l.snapshots.reduce((s, x) => s + x.transactions.length, 0),
      ],
      budgetRevisions: [
        n.snapshots.reduce((s, x) => s + x.budgetRevisions.length, 0),
        l.snapshots.reduce((s, x) => s + x.budgetRevisions.length, 0),
      ],
      bulkBills: [n.bulkBills.length, l.bulkBills.length],
      lineItems: [n.lineItems.length, l.lineItems.length],
      cardTxs: [n.cardTxs.length, l.cardTxs.length],
      wishlistItems: [n.wishlistItems.length, l.wishlistItems.length],
      savingsGoals: [n.savingsGoals.length, l.savingsGoals.length],
      savingsTxs: [n.savingsTxs.length, l.savingsTxs.length],
    });
  } finally {
    await neon.$disconnect();
    await local.$disconnect();
  }
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const flags = parseFlags(rest);

  switch (cmd) {
    case 'report':
      await generateReport(Boolean(flags.write));
      break;
    case 'sync':
      await syncNeonToLocal();
      break;
    case 'item:add':
      await cliAddItem(flags);
      break;
    case 'item:shift':
      await cliShiftItem(flags);
      break;
    case 'doctor':
      await runDoctor();
      break;
    case 'backup:email':
      await cliBackupEmail(flags);
      break;
    case 'audit:u1':
      await auditUser1();
      break;
    case 'wishlist:clean-test':
      await cleanWishlistTestArtifact();
      break;
    default:
      console.log('Available commands: report [--write], sync, item:add, item:shift, doctor, backup:email [--locale=EN|ID|ZH] [--to=email], audit:u1, wishlist:clean-test');
      process.exit(cmd ? 1 : 0);
  }
}

async function cleanWishlistTestArtifact() {
  for (const [label, url] of [
    ['Neon Cloud', NEON_URL],
    ['Local DB', LOCAL_URL],
  ] as const) {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const target = await prisma.wishlistItem.findUnique({ where: { id: 6 } });
      if (!target) {
        console.log(`[${label}] WishlistItem #6 already absent.`);
        continue;
      }
      if (target.userId !== USER_ID || Math.round(target.price) !== 28000000) {
        throw new Error(`[${label}] Safety abort: WishlistItem #6 unexpected row: ${JSON.stringify(target)}`);
      }
      await prisma.wishlistItem.delete({ where: { id: 6 } });
      console.log(`[${label}] Deleted test artifact WishlistItem #6 ("${target.name}", price=${target.price}).`);
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
