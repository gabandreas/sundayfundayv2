import {
  calculatePayroll,
  sumExtraIncome,
  calculateWorkingDaysForPeriod,
} from './payroll';
import { calculateWaterfall } from './waterfall';
import { evaluateInstallmentRiskTier } from './wishlist';
import { formatCycleDateLabel, normalizeDate } from './pacing';
import {
  calculateCardDueAmountForMonth,
  calculateCardInstallmentProgress,
  CreditCardDueLike,
} from '../credit/credit.utils';

export type ForecastLiquidityStatus =
  | 'HEALTHY_SURPLUS'
  | 'SAVINGS_COMPRESSED'
  | 'DEFICIT_SQUEEZE';

export interface ForecastSnapshotLike {
  month: number;
  year: number;
  status: string;
  salaryAdjustment: number;
  totalWorkingDays: number;
  cafeteriaDeduction: number;
  thrAmount: number;
  bonusAmount: number;
  dailyOperational: number;
  transport: number;
  internet: number;
  vape: number;
  haircut: number;
  savings: number;
  selfRewardTarget: number;
  bufferPocket: number;
  payrollPayoutDate?: Date | null;
  isPayoutDateConfirmed?: boolean;
  transactions?: Array<{
    type: string;
    sourceType?: string | null;
    amount: number;
  }>;
}

export interface ForecastContractLike {
  id: number;
  label: string;
  monthlyInstallment: number;
  totalTenor: number;
  remainingTenor: number;
  isActive: boolean;
  startMonth: number;
  startYear: number;
}

export interface ForecastScheduledBillLike {
  id: number;
  label: string;
  amount: number;
  dueDayOfMonth: number;
  isActive: boolean;
}

export interface ForecastCardLike extends CreditCardDueLike {
  id: number;
  label: string;
  category?: string;
}

export interface ForecastBulkBillLike {
  month: number;
  year: number;
  paylaterAmount: number;
  personalDebtAmount: number;
  creditCardAmount: number;
  amount: number;
}

export interface LiquidityForecastInput {
  baseMonth: number;
  baseYear: number;
  horizonMonths?: number;
  config: {
    baseSalary: number;
    dailyAllowance: number;
    laptopAllowance: number;
    dailyOperational: number;
    transport: number;
    internet: number;
    vape: number;
    haircut: number;
    baseSavings: number;
    payrollPayoutDay: number;
  };
  snapshots: ForecastSnapshotLike[];
  contracts: ForecastContractLike[];
  scheduledBills: ForecastScheduledBillLike[];
  creditCards: ForecastCardLike[];
  bulkBills: ForecastBulkBillLike[];
}

export interface ProjectedMonthLiquidity {
  monthOffset: number;
  month: number;
  year: number;
  periodLabel: string;
  sourceMode: 'EXISTING_SNAPSHOT' | 'MASTER_BASELINE_PROJECTION';
  expectedPaydayDateIso: string;
  expectedPaydayLabel: string;
  cycleDateLabel: string;
  projectedNetSalaryIncome: number;
  projectedExtraIncome: number;
  projectedFinalTotalIncome: number;
  projectedFixedEssentials: number;
  projectedDailyOperationalTarget: number;
  projectedBufferPocket: number;
  liabilities: {
    contractsTotal: number;
    scheduledBillsTotal: number;
    creditCardsTotal: number;
    bulkBillsTotal: number;
    projectedTotalDeductions: number;
    debtRatioPercent: number;
    debtStatus: string;
    activeInstallmentItems: Array<{
      label: string;
      amount: number;
      sliceBadge: string;
      isFinalSlice: boolean;
    }>;
    endingSubscriptions: Array<{
      label: string;
      amount: number;
      endedAtLabel: string;
    }>;
  };
  waterfall: {
    availableFundsBeforeWaterfall: number;
    p1SavingsTarget: number;
    projectedFundedSavings: number;
    projectedSelfRewardSurplus: number;
    projectedDailyOperational: number;
    projectedDeficitUncovered: number;
    isDeficit: boolean;
  };
  liquidityStatus: ForecastLiquidityStatus;
  isLiquiditySqueeze: boolean;
  recommendedP1SavingsReduction: number;
  squeezeBannerText: string | null;
}

export interface ExecutiveLiquidityForecastReport {
  basePeriod: {
    month: number;
    year: number;
    periodLabel: string;
  };
  horizonMonths: number;
  months: ProjectedMonthLiquidity[];
  summary: {
    totalProjectedIncome3M: number;
    totalProjectedDeductions3M: number;
    totalProjectedSavings3M: number;
    totalProjectedFreeCashflow3M: number;
    squeezeMonthsCount: number;
    maxRecommendedSavingsReduction: number;
    expiringInstallmentsNext3M: number;
    monthlyCashflowReliefFromExpiring: number;
    headlineAdvisory: string;
  };
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatPeriodLabel(month: number, year: number): string {
  return `${SHORT_MONTHS[month - 1] ?? String(month)} ${year}`;
}

function formatIdrPlain(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

function formatDateLabelUtc(date: Date): string {
  const day = date.getUTCDate();
  const mon = SHORT_MONTHS[date.getUTCMonth()] ?? '';
  const yr = date.getUTCFullYear();
  return `${day} ${mon} ${yr}`;
}

export function calculateLiquidityForecast(
  input: LiquidityForecastInput,
): ExecutiveLiquidityForecastReport {
  const horizonMonths = Math.max(1, input.horizonMonths ?? 3);
  const snapshotMap = new Map<string, ForecastSnapshotLike>();
  for (const s of input.snapshots) {
    snapshotMap.set(`${s.year}-${s.month}`, s);
  }
  const bulkMap = new Map<string, ForecastBulkBillLike>();
  for (const b of input.bulkBills) {
    bulkMap.set(`${b.year}-${b.month}`, b);
  }

  // Find current active period (earliest DRAFT snapshot or baseMonth/baseYear) to anchor contract remainingTenor offsets
  const draftSnapshots = input.snapshots
    .filter((s) => s.status === 'DRAFT')
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
  const anchorSerial =
    draftSnapshots.length > 0
      ? draftSnapshots[0].year * 12 + draftSnapshots[0].month
      : input.baseYear * 12 + input.baseMonth;

  const baseSerial = input.baseYear * 12 + input.baseMonth;
  const months: ProjectedMonthLiquidity[] = [];

  for (let offset = 1; offset <= horizonMonths; offset++) {
    const targetSerial = baseSerial + offset;
    const year = Math.floor((targetSerial - 1) / 12);
    const month = targetSerial - year * 12;
    const nextSerial = targetSerial + 1;
    const nextYear = Math.floor((nextSerial - 1) / 12);
    const nextMonth = nextSerial - nextYear * 12;

    const existingSnap = snapshotMap.get(`${year}-${month}`);
    const nextSnap = snapshotMap.get(`${nextYear}-${nextMonth}`);

    const defaultPayoutDay = input.config.payrollPayoutDay || 25;
    const rawStart =
      existingSnap?.payrollPayoutDate ??
      new Date(Date.UTC(year, month - 1, defaultPayoutDay));
    const startNorm = normalizeDate(rawStart);
    const cycleStartDate = new Date(
      Date.UTC(startNorm.year, startNorm.month - 1, startNorm.day),
    );
    const rawNext =
      nextSnap?.payrollPayoutDate ??
      new Date(Date.UTC(nextYear, nextMonth - 1, defaultPayoutDay));
    const nextNorm = normalizeDate(rawNext);
    const nextPayoutTs = Date.UTC(
      nextNorm.year,
      nextNorm.month - 1,
      nextNorm.day,
    );
    const cycleEndDate = new Date(nextPayoutTs - 86400000);
    const cycleDateLabel = formatCycleDateLabel(cycleStartDate, cycleEndDate);

    // 1. Projected Payroll & Income (auto-calculates 16th M-1 to 15th M working days with 2026–2027 Indonesian holidays when uninitialized)
    const totalWorkingDays =
      existingSnap && existingSnap.totalWorkingDays > 0
        ? existingSnap.totalWorkingDays
        : calculateWorkingDaysForPeriod(month, year);
    const salaryAdjustment = existingSnap ? existingSnap.salaryAdjustment : 0;
    const cafeteriaDeduction = existingSnap
      ? existingSnap.cafeteriaDeduction
      : 0;
    const thrAmount = existingSnap ? existingSnap.thrAmount : 0;
    const bonusAmount = existingSnap ? existingSnap.bonusAmount : 0;
    const extraIncome =
      existingSnap && existingSnap.transactions
        ? sumExtraIncome(existingSnap.transactions)
        : 0;

    const payroll = calculatePayroll({
      baseSalary: input.config.baseSalary,
      salaryAdjustment,
      totalWorkingDays,
      dailyAllowance: input.config.dailyAllowance,
      cafeteriaDeduction,
      thrAmount,
      bonusAmount,
      extraIncome,
      laptopAllowance: input.config.laptopAllowance,
    });

    // 2. Projected Fixed Essentials & Targets
    const transport = existingSnap
      ? existingSnap.transport
      : input.config.transport;
    const internet = existingSnap
      ? existingSnap.internet
      : input.config.internet;
    const vape = existingSnap ? existingSnap.vape : input.config.vape;
    const haircut = existingSnap ? existingSnap.haircut : input.config.haircut;
    const projectedFixedEssentials =
      Math.max(0, transport) +
      Math.max(0, internet) +
      Math.max(0, vape) +
      Math.max(0, haircut);

    const projectedDailyOperationalTarget = existingSnap
      ? existingSnap.dailyOperational
      : input.config.dailyOperational;
    const projectedBufferPocket = existingSnap ? existingSnap.bufferPocket : 0;
    const p1SavingsTarget = existingSnap
      ? existingSnap.savings
      : input.config.baseSavings;
    const selfRewardTarget = existingSnap ? existingSnap.selfRewardTarget : 0;

    // 3. Projected Liabilities for (month, year)
    const activeInstallmentItems: ProjectedMonthLiquidity['liabilities']['activeInstallmentItems'] =
      [];
    const endingSubscriptions: ProjectedMonthLiquidity['liabilities']['endingSubscriptions'] =
      [];

    let contractsTotal = 0;
    const offsetFromAnchor = targetSerial - anchorSerial;
    for (const c of input.contracts) {
      if (!c.isActive || c.remainingTenor <= 0) continue;
      const startSerial = c.startYear * 12 + c.startMonth;
      if (targetSerial < startSerial) continue;
      const effectiveOffset = Math.max(0, offsetFromAnchor);
      if (effectiveOffset < c.remainingTenor) {
        contractsTotal += c.monthlyInstallment;
        const paidPrior = Math.max(0, c.totalTenor - c.remainingTenor);
        const sliceNum = Math.min(c.totalTenor, paidPrior + effectiveOffset + 1);
        activeInstallmentItems.push({
          label: c.label,
          amount: c.monthlyInstallment,
          sliceBadge: `${sliceNum}/${c.totalTenor}`,
          isFinalSlice: sliceNum === c.totalTenor,
        });
      }
    }

    let scheduledBillsTotal = 0;
    for (const sb of input.scheduledBills) {
      if (sb.isActive) {
        scheduledBillsTotal += sb.amount;
      }
    }

    let creditCardsTotal = 0;
    for (const card of input.creditCards) {
      const due = calculateCardDueAmountForMonth(card, month, year);
      if (due > 0) {
        creditCardsTotal += due;
        if (card.chargeType === 'INSTALLMENT') {
          const prog = calculateCardInstallmentProgress(card, month, year);
          activeInstallmentItems.push({
            label: card.label,
            amount: due,
            sliceBadge: prog.badgeLabel ?? `1/${prog.totalTenor}`,
            isFinalSlice: prog.remainingSlicesAfterTarget === 0,
          });
        } else if (
          card.chargeType === 'RECURRING' &&
          card.endedAtMonth != null &&
          card.endedAtYear != null
        ) {
          if (card.endedAtMonth === month && card.endedAtYear === year) {
            endingSubscriptions.push({
              label: card.label,
              amount: due,
              endedAtLabel: formatPeriodLabel(
                card.endedAtMonth,
                card.endedAtYear,
              ),
            });
          }
        }
      }
    }

    const bulk = bulkMap.get(`${year}-${month}`);
    const bulkBillsTotal = bulk
      ? Math.max(
          0,
          (bulk.paylaterAmount ?? 0) +
            (bulk.personalDebtAmount ?? 0) +
            (bulk.creditCardAmount ?? 0) ||
            bulk.amount ||
            0,
        )
      : 0;

    const projectedTotalDeductions =
      contractsTotal + scheduledBillsTotal + creditCardsTotal + bulkBillsTotal;

    const debtRatioPercent =
      payroll.finalTotalIncome > 0
        ? Math.round(
            (projectedTotalDeductions / payroll.finalTotalIncome) * 1000,
          ) / 10
        : 0;
    const debtStatus = evaluateInstallmentRiskTier(debtRatioPercent);

    const wf = calculateWaterfall({
      finalTotalIncome: payroll.finalTotalIncome,
      totalDeductions: projectedTotalDeductions,
      savingsTarget: p1SavingsTarget,
      selfRewardTarget,
      dailyOperationalTarget: projectedDailyOperationalTarget,
      fixedExpenses: projectedFixedEssentials,
      bufferPocket: projectedBufferPocket,
    });

    let liquidityStatus: ForecastLiquidityStatus = 'HEALTHY_SURPLUS';
    let isLiquiditySqueeze = false;
    let recommendedP1SavingsReduction = 0;
    let squeezeBannerText: string | null = null;

    if (wf.isDeficit) {
      liquidityStatus = 'DEFICIT_SQUEEZE';
      isLiquiditySqueeze = true;
      recommendedP1SavingsReduction = p1SavingsTarget;
      squeezeBannerText = `Liquidity Squeeze Predicted — Recommended P1 Savings Reduction: ${formatIdrPlain(recommendedP1SavingsReduction)} (Uncovered Deficit: ${formatIdrPlain(wf.deficitUncovered)})`;
    } else if (wf.actualSavings < p1SavingsTarget) {
      liquidityStatus = 'SAVINGS_COMPRESSED';
      isLiquiditySqueeze = true;
      recommendedP1SavingsReduction = Math.max(
        0,
        p1SavingsTarget - wf.actualSavings,
      );
      squeezeBannerText = `Liquidity Squeeze Predicted — Recommended P1 Savings Reduction: ${formatIdrPlain(recommendedP1SavingsReduction)}`;
    }

    months.push({
      monthOffset: offset,
      month,
      year,
      periodLabel: formatPeriodLabel(month, year),
      sourceMode: existingSnap
        ? 'EXISTING_SNAPSHOT'
        : 'MASTER_BASELINE_PROJECTION',
      expectedPaydayDateIso: cycleStartDate.toISOString(),
      expectedPaydayLabel: formatDateLabelUtc(cycleStartDate),
      cycleDateLabel,
      projectedNetSalaryIncome: payroll.netSalaryIncome,
      projectedExtraIncome: payroll.extraIncome,
      projectedFinalTotalIncome: payroll.finalTotalIncome,
      projectedFixedEssentials,
      projectedDailyOperationalTarget,
      projectedBufferPocket,
      liabilities: {
        contractsTotal,
        scheduledBillsTotal,
        creditCardsTotal,
        bulkBillsTotal,
        projectedTotalDeductions,
        debtRatioPercent,
        debtStatus,
        activeInstallmentItems,
        endingSubscriptions,
      },
      waterfall: {
        availableFundsBeforeWaterfall: wf.availableFunds,
        p1SavingsTarget,
        projectedFundedSavings: wf.actualSavings,
        projectedSelfRewardSurplus: wf.selfReward,
        projectedDailyOperational: wf.actualDailyOperational,
        projectedDeficitUncovered: wf.deficitUncovered,
        isDeficit: wf.isDeficit,
      },
      liquidityStatus,
      isLiquiditySqueeze,
      recommendedP1SavingsReduction,
      squeezeBannerText,
    });
  }

  const totalProjectedIncome3M = months.reduce(
    (s, m) => s + m.projectedFinalTotalIncome,
    0,
  );
  const totalProjectedDeductions3M = months.reduce(
    (s, m) => s + m.liabilities.projectedTotalDeductions,
    0,
  );
  const totalProjectedSavings3M = months.reduce(
    (s, m) => s + m.waterfall.projectedFundedSavings,
    0,
  );
  const totalProjectedFreeCashflow3M = months.reduce(
    (s, m) =>
      s + m.waterfall.projectedFundedSavings + m.waterfall.projectedSelfRewardSurplus,
    0,
  );
  const squeezeMonths = months.filter((m) => m.isLiquiditySqueeze);
  const maxRecommendedSavingsReduction = months.reduce(
    (max, m) => Math.max(max, m.recommendedP1SavingsReduction),
    0,
  );

  // Count unique final slices or ending subscriptions across the 3-month window
  const expiringMap = new Map<string, number>();
  for (const m of months) {
    for (const item of m.liabilities.activeInstallmentItems) {
      if (item.isFinalSlice) {
        expiringMap.set(item.label, item.amount);
      }
    }
    for (const sub of m.liabilities.endingSubscriptions) {
      expiringMap.set(sub.label, sub.amount);
    }
  }
  const expiringInstallmentsNext3M = expiringMap.size;
  const monthlyCashflowReliefFromExpiring = Array.from(
    expiringMap.values(),
  ).reduce((s, v) => s + v, 0);

  const headlineAdvisory =
    squeezeMonths.length > 0
      ? `${squeezeMonths.length} of ${horizonMonths} forward periods show a projected liquidity squeeze (${squeezeMonths.map((m) => m.periodLabel).join(', ')}) — Peak recommended P1 Savings reduction: ${formatIdrPlain(maxRecommendedSavingsReduction)}.`
      : `All ${horizonMonths} forward periods project healthy liquidity with 100% P1 Core Savings coverage (${formatIdrPlain(totalProjectedSavings3M)} cumulative savings).`;

  return {
    basePeriod: {
      month: input.baseMonth,
      year: input.baseYear,
      periodLabel: formatPeriodLabel(input.baseMonth, input.baseYear),
    },
    horizonMonths,
    months,
    summary: {
      totalProjectedIncome3M,
      totalProjectedDeductions3M,
      totalProjectedSavings3M,
      totalProjectedFreeCashflow3M,
      squeezeMonthsCount: squeezeMonths.length,
      maxRecommendedSavingsReduction,
      expiringInstallmentsNext3M,
      monthlyCashflowReliefFromExpiring,
      headlineAdvisory,
    },
  };
}
