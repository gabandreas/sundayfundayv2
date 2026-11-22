import { PrismaClient, Prisma } from '../apps/api/node_modules/@prisma/client';
import {
  evaluateModularEngine,
  buildDefaultPayrollRules,
  buildDefaultAllocationBuckets,
  buildDefaultSurplusSplitRules,
  buildDefaultFinancialPolicy,
} from '../apps/api/src/calculator/modular-engine';
import { calculateCardDueAmountForMonth } from '../apps/api/src/credit/credit.utils';

const NEON_URL =
  process.env.NEON_DATABASE_URL ||
  'postgresql://neondb_owner:npg_kLTO3alGm2RE@ep-nameless-bird-b30zfam7-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30';

const LOCAL_URL =
  process.env.LOCAL_DATABASE_URL ||
  'postgresql://postgres:password@127.0.0.1:5433/finance_erp?schema=public';

const USER_ID = 1;
const applyChanges = process.argv.includes('--apply');

function toJsonInput(
  val: Prisma.JsonValue | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (val === undefined || val === null) return Prisma.JsonNull;
  return val as Prisma.InputJsonValue;
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
  nextSnap?: { payrollPayoutDate: Date | null } | null,
): number {
  if (year < 2026 || (year === 2026 && month <= 9)) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }
  const start = currentSnap?.payrollPayoutDate
    ? new Date(currentSnap.payrollPayoutDate)
    : defaultPayoutDate(month, year, payoutDay);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endNext = nextSnap?.payrollPayoutDate
    ? new Date(nextSnap.payrollPayoutDate)
    : defaultPayoutDate(nextMonth, nextYear, payoutDay);

  const utcStart = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const utcEnd = Date.UTC(
    endNext.getUTCFullYear(),
    endNext.getUTCMonth(),
    endNext.getUTCDate(),
  );
  return Math.max(1, Math.round((utcEnd - utcStart) / (1000 * 60 * 60 * 24)));
}

async function runForDatabase(label: string, url: string) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    console.log(`\n=== [${label}] (${applyChanges ? 'APPLY' : 'DRY-RUN'}) ===`);

    const [snapOct, snapNov, snapDec, globalConfig, cardTxs] = await Promise.all([
      prisma.monthlySnapshot.findUnique({
        where: { userId_month_year: { userId: USER_ID, month: 10, year: 2026 } },
        include: {
          budgetRevisions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
          transactions: { orderBy: [{ id: 'asc' }] },
        },
      }),
      prisma.monthlySnapshot.findUnique({
        where: { userId_month_year: { userId: USER_ID, month: 11, year: 2026 } },
        include: {
          budgetRevisions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
          transactions: { orderBy: [{ id: 'asc' }] },
        },
      }),
      prisma.monthlySnapshot.findUnique({
        where: { userId_month_year: { userId: USER_ID, month: 12, year: 2026 } },
      }),
      prisma.globalConfig.findFirst({ where: { userId: USER_ID } }),
      prisma.creditCardTransaction.findMany({ where: { userId: USER_ID } }),
    ]);

    if (!snapOct || !snapNov || !globalConfig) {
      throw new Error(`[${label}] Missing 10/2026, 11/2026 snapshot, or globalConfig`);
    }

    console.log('10/2026 BudgetRevisions:', snapOct.budgetRevisions.map((r) => ({
      id: r.id,
      cat: r.category,
      bucket: r.bucketKey,
      prev: r.previousValue,
      next: r.newValue,
      reason: r.reason,
    })));
    console.log('11/2026 BudgetRevisions:', snapNov.budgetRevisions.map((r) => ({
      id: r.id,
      cat: r.category,
      bucket: r.bucketKey,
      prev: r.previousValue,
      next: r.newValue,
      reason: r.reason,
    })));
    console.log('10/2026 Manual Transactions:', snapOct.transactions
      .filter((t) => t.sourceType === 'MANUAL')
      .map((t) => ({ id: t.id, label: t.label, amount: t.amount, cat: t.fixedEssentialCategory, type: t.type })));

    // Unauthorized revisions to remove:
    // - On 10/2026: revisions that reduced daily_operational from 1,720,316 or zeroed core_savings from 6,341 due to PayLater shifts (#48, #49, #51)
    const unauthorizedOctIds = snapOct.budgetRevisions
      .filter((r) => r.id === 48 || r.id === 49 || r.id === 51 || (r.reason && r.reason.includes('PayLater') && (r.bucketKey === 'daily_operational' || r.bucketKey === 'core_savings')))
      .map((r) => r.id);

    // - On 11/2026: revision #50 zeroing Vape from 150,000 -> 0 for deleted Dec 25 shift
    const unauthorizedNovIds = snapNov.budgetRevisions
      .filter((r) => r.id === 50 || (r.bucketKey === 'vape' && r.newValue === 0 && r.reason?.includes('PayLater')))
      .map((r) => r.id);

    console.log('Unauthorized Oct Revision IDs to delete:', unauthorizedOctIds);
    console.log('Unauthorized Nov Revision IDs to delete:', unauthorizedNovIds);

    if (!applyChanges) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      if (unauthorizedOctIds.length > 0) {
        await tx.budgetRevision.deleteMany({
          where: { id: { in: unauthorizedOctIds }, snapshotId: snapOct.id },
        });
      }
      if (unauthorizedNovIds.length > 0) {
        await tx.budgetRevision.deleteMany({
          where: { id: { in: unauthorizedNovIds }, snapshotId: snapNov.id },
        });
      }

      // 1. Delete erroneous 10/2026 transactions (#794 manual bridge income + #809/#810 erroneous refunds)
      await tx.transaction.deleteMany({
        where: {
          snapshotId: snapOct.id,
          OR: [
            { id: { in: [794, 809, 810] } },
            {
              type: 'INCOME',
              sourceType: 'MANUAL',
              label: { contains: 'Bridge Cash Injection' },
            },
            {
              type: 'INCOME',
              sourceType: 'OPERATIONAL_REFUND',
              amount: 300000,
            },
          ],
        },
      });

      // Ensure accurate Rp 291,000 shortfall reconciliation deduction exists (591,000 -> 300,000 Remaining Living Cash)
      const existingCheckpoint = await tx.transaction.findFirst({
        where: {
          snapshotId: snapOct.id,
          type: 'DEDUCTION',
          sourceType: 'MANUAL',
          label: 'Balance Checkpoint: Unitemized Daily Spend',
          amount: 291000,
        },
      });
      if (!existingCheckpoint) {
        await tx.transaction.create({
          data: {
            snapshotId: snapOct.id,
            type: 'DEDUCTION',
            sourceType: 'MANUAL',
            label: 'Balance Checkpoint: Unitemized Daily Spend',
            amount: 291000,
            date: new Date('2026-11-15T05:00:00.000Z'),
          },
        });
      }

      // 2. Ensure two one-off Nov 2026 Google AI Pro CC charges exist idempotently (pre-Nov 20 cutoff -> 11/2026 ONLY)
      const oneOffCcCharges = [
        {
          label: 'Google AI Pro (One-Off Nov 12)',
          amount: 29000,
          category: 'AI & Cloud',
          chargeType: 'FULL' as const,
          totalAmount: 29000,
          monthlyAmount: 29000,
          tenor: 1,
          billingMonth: 11,
          billingYear: 2026,
          transactionDate: new Date('2026-11-12T12:00:00.000Z'),
          isRecurring: false,
          isActive: true,
          status: 'ACTIVE' as const,
          notes: 'One-off purchase before Nov 20 CC statement cutoff',
        },
        {
          label: 'Google AI Pro (One-Off Nov 15)',
          amount: 77000,
          category: 'AI & Cloud',
          chargeType: 'FULL' as const,
          totalAmount: 77000,
          monthlyAmount: 77000,
          tenor: 1,
          billingMonth: 11,
          billingYear: 2026,
          transactionDate: new Date('2026-11-15T12:00:00.000Z'),
          isRecurring: false,
          isActive: true,
          status: 'ACTIVE' as const,
          notes: 'One-off purchase before Nov 20 CC statement cutoff',
        },
      ];

      for (const ccInput of oneOffCcCharges) {
        const existingCc = await tx.creditCardTransaction.findFirst({
          where: {
            userId: USER_ID,
            label: ccInput.label,
            billingMonth: ccInput.billingMonth,
            billingYear: ccInput.billingYear,
          },
        });
        if (!existingCc) {
          await tx.creditCardTransaction.create({
            data: {
              userId: USER_ID,
              ...ccInput,
            },
          });
        } else {
          await tx.creditCardTransaction.update({
            where: { id: existingCc.id },
            data: {
              amount: ccInput.amount,
              totalAmount: ccInput.totalAmount,
              monthlyAmount: ccInput.monthlyAmount,
              chargeType: ccInput.chargeType,
              tenor: ccInput.tenor,
              isActive: ccInput.isActive,
              status: ccInput.status,
              transactionDate: ccInput.transactionDate,
            },
          });
        }
      }

      const freshCardTxs = await tx.creditCardTransaction.findMany({
        where: { userId: USER_ID },
      });

      // 3. Move 5 November-due PayLater LiabilityLineItems (IDs 20, 21, 23, 24, 25 = Rp 499,000) from 10/2026 to 11/2026
      await tx.liabilityLineItem.updateMany({
        where: {
          userId: USER_ID,
          id: { in: [20, 21, 23, 24, 25] },
          month: 10,
          year: 2026,
        },
        data: { month: 11, year: 2026 },
      });

      // Recompute MonthlyBulkBill & CREDIT_BILL transactions for both 10/2026 and 11/2026
      for (const m of [10, 11] as const) {
        const snapId = m === 10 ? snapOct.id : snapNov.id;
        const mItems = await tx.liabilityLineItem.findMany({
          where: { userId: USER_ID, month: m, year: 2026 },
        });
        const plSum = mItems
          .filter((i) => i.category === 'PAYLATER')
          .reduce((s, i) => s + Math.round(i.monthlyAmount), 0);
        const pdSum = mItems
          .filter(
            (i) =>
              i.category === 'PERSONAL_DEBT' || i.category === 'P1_VAULT_REFUND',
          )
          .reduce((s, i) => s + Math.round(i.monthlyAmount), 0);
        const ccSum = freshCardTxs.reduce(
          (s, t) => s + calculateCardDueAmountForMonth(t as any, m, 2026),
          0,
        );

        const bulkBill = await tx.monthlyBulkBill.upsert({
          where: { userId_month_year: { userId: USER_ID, month: m, year: 2026 } },
          create: {
            userId: USER_ID,
            month: m,
            year: 2026,
            label: `Monthly Liabilities ${m}/2026`,
            paylaterAmount: plSum,
            personalDebtAmount: pdSum,
            creditCardAmount: 0,
            amount: plSum + pdSum,
          },
          update: {
            paylaterAmount: plSum,
            personalDebtAmount: pdSum,
            creditCardAmount: 0,
            amount: plSum + pdSum,
          },
        });

        await tx.transaction.deleteMany({
          where: {
            snapshotId: snapId,
            type: 'CREDIT_BILL',
            sourceType: { in: ['BULK_BILL', 'PERSONAL_DEBT', 'CC_TRANSACTION'] },
          },
        });

        const creditTxsToInsert: Prisma.TransactionCreateManyInput[] = [];
        if (plSum > 0) {
          creditTxsToInsert.push({
            snapshotId: snapId,
            type: 'CREDIT_BILL',
            sourceType: 'BULK_BILL',
            sourceId: bulkBill.id,
            label: 'PayLater Bills',
            amount: plSum,
            date: new Date(Date.UTC(2026, m - 1, 25, 12, 0, 0)),
          });
        }
        if (pdSum > 0) {
          creditTxsToInsert.push({
            snapshotId: snapId,
            type: 'CREDIT_BILL',
            sourceType: 'PERSONAL_DEBT',
            sourceId: bulkBill.id,
            label: 'Personal & Informal Debt',
            amount: pdSum,
            date: new Date(Date.UTC(2026, m - 1, 25, 12, 0, 0)),
          });
        }
        if (ccSum > 0) {
          creditTxsToInsert.push({
            snapshotId: snapId,
            type: 'CREDIT_BILL',
            sourceType: 'CC_TRANSACTION',
            sourceId: null,
            label: 'Credit Card Statement',
            amount: ccSum,
            date: new Date(Date.UTC(2026, m - 1, 11, 12, 0, 0)),
          });
        }
        if (creditTxsToInsert.length > 0) {
          await tx.transaction.createMany({ data: creditTxsToInsert });
        }
      }

      // Restore 10/2026 frozenRulesJson buckets & targets
      const octFrozen: any = (snapOct.frozenRulesJson as any) || {
        payrollRules: buildDefaultPayrollRules(),
        allocationBuckets: buildDefaultAllocationBuckets(),
        surplusSplitRules: buildDefaultSurplusSplitRules(),
        financialPolicy: buildDefaultFinancialPolicy(),
      };
      if (Array.isArray(octFrozen.allocationBuckets)) {
        octFrozen.allocationBuckets = octFrozen.allocationBuckets.map((b: any) => {
          if (b.id === 'daily_operational') {
            return { ...b, formulaType: 'FIXED_AMOUNT', value: 1720316 };
          }
          if (b.id === 'core_savings') {
            return { ...b, formulaType: 'FIXED_AMOUNT', value: 6341 };
          }
          if (b.id === 'transport') {
            return { ...b, value: 200000 };
          }
          if (b.id === 'internet') {
            return { ...b, label: 'Nov 25 Bill', value: 200000 };
          }
          if (b.id === 'vape') {
            return { ...b, value: 0 };
          }
          if (b.id === 'haircut') {
            return { ...b, value: 0 };
          }
          if (b.id === 'self_reward') {
            return { ...b, value: 250000 };
          }
          return b;
        });
      }

      const freshOctTxs = await tx.transaction.findMany({
        where: { snapshotId: snapOct.id },
        orderBy: [{ id: 'asc' }],
      });
      const octBulkBill = await tx.monthlyBulkBill.findUnique({
        where: { userId_month_year: { userId: USER_ID, month: 10, year: 2026 } },
      });
      const octCcTotal = freshCardTxs.reduce(
        (s, t) => s + calculateCardDueAmountForMonth(t as any, 10, 2026),
        0,
      );
      const octCreditBills =
        (octBulkBill?.paylaterAmount ?? 0) +
        (octBulkBill?.personalDebtAmount ?? 0) +
        octCcTotal;

      const remainingOctRevs = snapOct.budgetRevisions.filter(
        (r) => !unauthorizedOctIds.includes(r.id),
      );
      const octExtraIncome = freshOctTxs
        .filter((t) => t.type === 'INCOME' && t.sourceType !== 'OPERATIONAL_REFUND')
        .reduce((s, t) => s + Number(t.amount), 0);

      const octDailyRule = Array.isArray(octFrozen.payrollRules)
        ? octFrozen.payrollRules.find((r: any) => r?.id === 'daily_attendance')
        : null;
      const octDailyAllowance =
        octDailyRule?.value !== undefined
          ? Number(octDailyRule.value)
          : globalConfig.dailyAllowance;

      const octBridgeInflow = 900000;
      const octCalc = evaluateModularEngine({
        baseSalary: globalConfig.baseSalary,
        salaryAdjustment: snapOct.salaryAdjustment,
        totalWorkingDays: snapOct.totalWorkingDays,
        dailyAllowance: octDailyAllowance,
        cafeteriaDeduction: snapOct.cafeteriaDeduction,
        thrAmount: snapOct.thrAmount,
        bonusAmount: snapOct.bonusAmount,
        extraIncome: octExtraIncome,
        bridgeInflowAmount: octBridgeInflow,
        month: 10,
        year: 2026,
        cycleDays: computeCycleDays(10, 2026, globalConfig.payrollPayoutDay, snapOct, snapNov),
        totalCreditBills: octCreditBills,
        totalDeductions: octCreditBills,
        payrollRules: octFrozen.payrollRules,
        allocationBuckets: octFrozen.allocationBuckets,
        surplusSplitRules: octFrozen.surplusSplitRules,
        financialPolicy: octFrozen.financialPolicy,
        formulaEngineType: 'DEBT_FIRST_WATERFALL',
        budgetRevisions: remainingOctRevs.map((r) => ({
          bucketKey: r.bucketKey,
          category: r.category,
          newValue: r.newValue,
        })),
        isManualOverride: true,
        lockedP1: 6341,
        lockedP2: 250000,
        oneOffBills: Array.isArray(snapOct.oneOffBillsJson)
          ? (snapOct.oneOffBillsJson as any)
          : [{ slot: 'INTERNET', label: 'Nov 25 Bill' }],
        transactions: freshOctTxs.map((t) => ({
          type: t.type,
          sourceType: t.sourceType,
          fixedEssentialCategory: t.fixedEssentialCategory,
          bucketKey: t.bucketKey,
          amount: t.amount,
        })),
      });

      await tx.monthlySnapshot.update({
        where: { id: snapOct.id },
        data: {
          transport: 200000,
          internet: 200000,
          vape: 0,
          haircut: 0,
          dailyOperational: 1720316,
          actualDailyOperational: octCalc.waterfall.actualDailyOperational,
          savings: 6341,
          actualSavings: octCalc.waterfall.actualSavings,
          lockedP1: 6341,
          selfReward: octCalc.waterfall.actualSelfReward,
          lockedP2: 250000,
          isManualOverride: true,
          deficitUncovered: octCalc.waterfall.deficitUncovered,
          survivalPocket: octCalc.waterfall.survivalPocket,
          totalDeductions: octCreditBills,
          extraIncome: octExtraIncome,
          bridgeInflowAmount: octBridgeInflow,
          netSalaryIncome: octCalc.payroll.netSalaryIncome,
          finalTotalIncome: octCalc.payroll.finalTotalIncome + octBridgeInflow,
          frozenRulesJson: toJsonInput(octFrozen as any),
          bucketRealizationsJson: octCalc.bucketRealizations as any,
          oneOffBillsJson: toJsonInput([{ slot: 'INTERNET', label: 'Nov 25 Bill' }]),
        },
      });

      // Restore 11/2026: Transport Rp 300,000, Internet Rp 0, Vape Rp 0, Haircut Rp 0, Daily Ops Rp 1,500,000 locked (P1=0, P2=0, Deficit=Rp 369,145)
      const novFrozen: any = (snapNov.frozenRulesJson as any) || {
        payrollRules: buildDefaultPayrollRules(),
        allocationBuckets: buildDefaultAllocationBuckets(),
        surplusSplitRules: buildDefaultSurplusSplitRules(),
        financialPolicy: buildDefaultFinancialPolicy(),
      };
      if (Array.isArray(novFrozen.payrollRules)) {
        novFrozen.payrollRules = novFrozen.payrollRules.map((r: any) =>
          r.id === 'daily_attendance' ? { ...r, value: globalConfig.dailyAllowance } : r,
        );
      }
      if (Array.isArray(novFrozen.allocationBuckets)) {
        novFrozen.allocationBuckets = novFrozen.allocationBuckets.map((b: any) => {
          if (b.id === 'transport') return { ...b, formulaType: 'FIXED_AMOUNT', value: 300000 };
          if (b.id === 'internet') return { ...b, formulaType: 'FIXED_AMOUNT', value: 0 };
          if (b.id === 'vape') return { ...b, formulaType: 'FIXED_AMOUNT', value: 0 };
          if (b.id === 'haircut') return { ...b, formulaType: 'FIXED_AMOUNT', value: 0 };
          if (b.id === 'daily_operational') return { ...b, formulaType: 'FIXED_AMOUNT', value: 1500000 };
          if (b.id === 'core_savings') return { ...b, formulaType: 'FIXED_AMOUNT', value: 1000000 };
          if (b.id === 'self_reward') return { ...b, formulaType: 'REMAINDER_OVERFLOW', value: 0 };
          return b;
        });
      }

      const freshNovTxs = await tx.transaction.findMany({
        where: { snapshotId: snapNov.id },
        orderBy: [{ id: 'asc' }],
      });
      const novBulkBill = await tx.monthlyBulkBill.findUnique({
        where: { userId_month_year: { userId: USER_ID, month: 11, year: 2026 } },
      });
      const novCcTotal = freshCardTxs.reduce(
        (s, t) => s + calculateCardDueAmountForMonth(t as any, 11, 2026),
        0,
      );
      const novCreditBills =
        (novBulkBill?.paylaterAmount ?? 0) +
        (novBulkBill?.personalDebtAmount ?? 0) +
        novCcTotal;

      const remainingNovRevs = snapNov.budgetRevisions.filter(
        (r) => !unauthorizedNovIds.includes(r.id),
      );
      const novExtraIncome = freshNovTxs
        .filter((t) => t.type === 'INCOME' && t.sourceType !== 'OPERATIONAL_REFUND')
        .reduce((s, t) => s + Number(t.amount), 0);

      const novDailyAllowance = globalConfig.dailyAllowance;
      const novBridgeInflow = Math.round(snapNov.bridgeInflowAmount ?? 0);

      const novCalc = evaluateModularEngine({
        baseSalary: globalConfig.baseSalary,
        salaryAdjustment: snapNov.salaryAdjustment,
        totalWorkingDays: snapNov.totalWorkingDays,
        dailyAllowance: novDailyAllowance,
        cafeteriaDeduction: snapNov.cafeteriaDeduction,
        thrAmount: snapNov.thrAmount,
        bonusAmount: snapNov.bonusAmount,
        extraIncome: novExtraIncome,
        bridgeInflowAmount: novBridgeInflow,
        month: 11,
        year: 2026,
        cycleDays: computeCycleDays(11, 2026, globalConfig.payrollPayoutDay, snapNov, snapDec),
        totalCreditBills: novCreditBills,
        totalDeductions: novCreditBills,
        payrollRules: novFrozen.payrollRules,
        allocationBuckets: novFrozen.allocationBuckets,
        surplusSplitRules: novFrozen.surplusSplitRules,
        financialPolicy: novFrozen.financialPolicy,
        formulaEngineType: 'DEBT_FIRST_WATERFALL',
        budgetRevisions: remainingNovRevs.map((r) => ({
          bucketKey: r.bucketKey,
          category: r.category,
          newValue: r.newValue,
        })),
        isManualOverride: true,
        lockedP1: 0,
        lockedP2: 0,
        oneOffBills: Array.isArray(snapNov.oneOffBillsJson)
          ? (snapNov.oneOffBillsJson as any)
          : null,
        transactions: freshNovTxs.map((t) => ({
          type: t.type,
          sourceType: t.sourceType,
          fixedEssentialCategory: t.fixedEssentialCategory,
          bucketKey: t.bucketKey,
          amount: t.amount,
        })),
      });

      await tx.monthlySnapshot.update({
        where: { id: snapNov.id },
        data: {
          transport: 300000,
          internet: 0,
          vape: 0,
          haircut: 0,
          dailyOperational: 1500000,
          actualDailyOperational: novCalc.waterfall.actualDailyOperational,
          savings: novCalc.canonicalSnapshotColumns.savings,
          actualSavings: novCalc.waterfall.actualSavings,
          lockedP1: 0,
          selfReward: novCalc.waterfall.actualSelfReward,
          lockedP2: 0,
          isManualOverride: true,
          deficitUncovered: novCalc.waterfall.deficitUncovered,
          survivalPocket: novCalc.waterfall.survivalPocket,
          totalDeductions: novCreditBills,
          extraIncome: novExtraIncome,
          netSalaryIncome: novCalc.payroll.netSalaryIncome,
          finalTotalIncome: novCalc.payroll.finalTotalIncome + novBridgeInflow,
          frozenRulesJson: toJsonInput(novFrozen as any),
          bucketRealizationsJson: novCalc.bucketRealizations as any,
        },
      });

      console.log('Restored 10/2026 ->', {
        debt: octCreditBills,
        dailyOperational: octCalc.waterfall.actualDailyOperational,
        routine: 400000,
        survivalPocket: octCalc.waterfall.survivalPocket,
        actualSavings: octCalc.waterfall.actualSavings,
        selfReward: octCalc.waterfall.actualSelfReward,
        deficitUncovered: octCalc.waterfall.deficitUncovered,
        finalTotalIncome: octCalc.payroll.finalTotalIncome + octBridgeInflow,
      });
      console.log('Restored 11/2026 ->', {
        debt: novCreditBills,
        routine: 300000,
        dailyOperational: novCalc.waterfall.actualDailyOperational,
        survivalPocket: novCalc.waterfall.survivalPocket,
        actualSavings: novCalc.waterfall.actualSavings,
        selfReward: novCalc.waterfall.actualSelfReward,
        deficitUncovered: novCalc.waterfall.deficitUncovered,
        finalTotalIncome: novCalc.payroll.finalTotalIncome + novBridgeInflow,
      });
    }, { maxWait: 15000, timeout: 30000 });
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await runForDatabase('Neon Cloud', NEON_URL);
  if (applyChanges) {
    await runForDatabase('Local DB (5433)', LOCAL_URL);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
