import { addHybridMonths } from './hybrid-engine';

function goRound(v: number): number {
  return v < 0 ? -Math.round(-v) : Math.round(v);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function formatRpId(n: number): string {
  const neg = n < 0;
  const absStr = String(Math.trunc(Math.abs(n)));
  const withDots = absStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return neg ? `-${withDots}` : withDots;
}

function daysInMonthUtc(m: number, y: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// ───────────────────────────────────────────────────────────────────────────
// Engine 1: Paycycle Horizon & Waterfall Formula Engine
// ───────────────────────────────────────────────────────────────────────────

export interface InstrumentCutoffRule {
  id: string;
  name: string;
  type: 'PAYLATER' | 'CREDIT_CARD' | 'CASH_LOAN' | string;
  cutoffDay: number;
  dueDay: number;
  dueRule?: 'FIXED_DAY' | 'DISBURSEMENT_DAY' | string;
  monthlyInterestPct: number;
  adminFeePct: number;
  active: boolean;
}

export interface PaycycleHorizonRequest {
  month: number;
  year: number;
  anchorDay: number;
  shiftWeekendToFriday: boolean;
  explicitStartIso?: string;
  explicitNextPaydayIso?: string;
  weekendMultiplier: number;
  remainingBudgetRp: number;
  referenceDateIso?: string;
  payslipAnchorDay?: number;
  payslipShiftRule?: 'SHIFT_PREVIOUS_FRIDAY' | 'SHIFT_NEXT_WEEKDAY' | 'EXACT_DAY' | string;
  reviewLagWorkingDays?: number;
  holidaysIso?: string[];
  explicitPayslipIso?: string;
  overrideNote?: string;
}

export interface PaycycleHorizonResult {
  periodMonth: number;
  periodYear: number;
  periodCode: string;
  payslipDropIso: string;
  payslipShifted: boolean;
  reviewLagWorkingDays: number;
  shiftRule: string;
  overrideApplied: boolean;
  overrideNote?: string;
  paydayIso: string;
  paydayShiftedFromWeekend: boolean;
  livingStartIso: string;
  livingEndIso: string;
  nextPaydayIso: string;
  cycleTemporalState: 'PRE_PAYDAY' | 'ACTIVE' | 'COMPLETED';
  daysUntilCycleStart: number;
  currentDayIndex: number;
  maturityMonth: number;
  maturityYear: number;
  totalCycleDays: number;
  remainingDays: number;
  elapsedDays: number;
  remainingWeekdays: number;
  remainingWeekends: number;
  weekdaySafeRateRp: number;
  weekendSafeRateRp: number;
  flatDailyRateRp: number;
  weekendMultiplier: number;
}

export interface WaterfallConfigRequest {
  finalTotalIncomeRp: number;
  totalDebtObligationsRp: number;
  routineQuotasTotalRp: number;
  dailyLivingTargetRp: number;
  bufferTargetRp: number;
  coreSavingsP1TargetRp: number;
  selfRewardP2TargetRp: number;
  priorityOrder?: string[];
}

export interface WaterfallConfigResult {
  finalTotalIncomeRp: number;
  debtObligationsFundedRp: number;
  routineQuotasFundedRp: number;
  dailyLivingFundedRp: number;
  bufferFundedRp: number;
  coreSavingsP1FundedRp: number;
  selfRewardP2FundedRp: number;
  uncoveredDeficitRp: number;
  availableAfterEssentialRp: number;
}

export interface RouteTxRequest {
  txDateIso: string;
  instrumentType: string;
  instrumentName?: string;
  anchorDay?: number;
  rules?: InstrumentCutoffRule[];
}

export interface RouteTxResult {
  targetPeriodMonth: number;
  targetPeriodYear: number;
  targetPeriodCode: string;
  maturityMonth: number;
  maturityYear: number;
  dueDay: number;
  cutoffDay: number;
  crossedCutoff: boolean;
  explanation: string;
}

function parseIsoUtc(iso?: string): Date | null {
  if (!iso) return null;
  const trimmed = iso.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!m) return null;
  const yr = Number(m[1]);
  const mo = Number(m[2]);
  const dy = Number(m[3]);
  if (mo < 1 || mo > 12 || dy < 1 || dy > 31) return null;
  return new Date(Date.UTC(yr, mo - 1, dy));
}

function fmtIsoUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function resolvePaydayUtc(
  month: number,
  year: number,
  anchorDay: number,
  shiftWeekend: boolean,
): { date: Date; shifted: boolean } {
  const anchor = anchorDay <= 0 || anchorDay > 31 ? 27 : anchorDay;
  const day = Math.min(anchor, daysInMonthUtc(month, year));
  let d = new Date(Date.UTC(year, month - 1, day));
  let shifted = false;
  if (shiftWeekend) {
    const wd = d.getUTCDay();
    if (wd === 6) {
      d = new Date(d.getTime() - 86400000);
      shifted = true;
    } else if (wd === 0) {
      d = new Date(d.getTime() - 2 * 86400000);
      shifted = true;
    }
  }
  return { date: d, shifted };
}

function isWorkingDayUtc(d: Date, holidays: Set<string>): boolean {
  const wd = d.getUTCDay();
  if (wd === 0 || wd === 6) return false;
  if (holidays.size > 0 && holidays.has(fmtIsoUtc(d))) return false;
  return true;
}

function resolvePayslipUtc(
  month: number,
  year: number,
  anchorDay: number,
  shiftRule: string,
  holidays: Set<string>,
): { date: Date; shifted: boolean } {
  const anchor = anchorDay <= 0 || anchorDay > 31 ? 25 : anchorDay;
  const day = Math.min(anchor, daysInMonthUtc(month, year));
  let d = new Date(Date.UTC(year, month - 1, day));
  let shifted = false;
  const rule = (shiftRule || '').trim().toUpperCase();
  if (rule === 'EXACT_DAY') {
    return { date: d, shifted: false };
  }
  if (rule === 'SHIFT_NEXT_WEEKDAY') {
    while (!isWorkingDayUtc(d, holidays)) {
      d = new Date(d.getTime() + 86400000);
      shifted = true;
    }
    return { date: d, shifted };
  }
  while (!isWorkingDayUtc(d, holidays)) {
    d = new Date(d.getTime() - 86400000);
    shifted = true;
  }
  return { date: d, shifted };
}

function addWorkingDaysUtc(start: Date, lag: number, holidays: Set<string>): Date {
  let d = start;
  if (lag > 0) {
    let remaining = lag;
    while (remaining > 0) {
      d = new Date(d.getTime() + 86400000);
      if (isWorkingDayUtc(d, holidays)) remaining--;
    }
  } else if (lag < 0) {
    let remaining = -lag;
    while (remaining > 0) {
      d = new Date(d.getTime() - 86400000);
      if (isWorkingDayUtc(d, holidays)) remaining--;
    }
  }
  return d;
}

export function computePaycycleHorizonTs(req: PaycycleHorizonRequest): PaycycleHorizonResult {
  const m = req.month < 1 || req.month > 12 ? 11 : req.month;
  const y = req.year < 2020 ? 2026 : req.year;
  const anchor = req.anchorDay <= 0 ? 27 : req.anchorDay;
  const mult = req.weekendMultiplier <= 0 ? 1.5 : req.weekendMultiplier;

  const holidays = new Set<string>();
  for (const h of req.holidaysIso ?? []) {
    const parsedH = parseIsoUtc(h);
    if (parsedH) holidays.add(fmtIsoUtc(parsedH));
  }

  let shiftRule = (req.payslipShiftRule || '').trim().toUpperCase();
  if (!shiftRule) {
    shiftRule = req.shiftWeekendToFriday ? 'SHIFT_PREVIOUS_FRIDAY' : 'EXACT_DAY';
  }

  const useTwoStage =
    (req.payslipAnchorDay ?? 0) > 0 ||
    (req.reviewLagWorkingDays ?? 0) > 0 ||
    Boolean(req.explicitPayslipIso) ||
    Boolean(req.payslipShiftRule);
  let lagDays = req.reviewLagWorkingDays ?? 0;

  let payslipDrop: Date;
  let payday: Date;
  let nextPayday: Date;
  let payslipShifted = false;
  let shifted = false;
  let overrideApplied = false;

  const prevYm = addHybridMonths(m, y, -1);
  if (useTwoStage) {
    const pAnchor = (req.payslipAnchorDay ?? 0) > 0 ? req.payslipAnchorDay! : 25;
    const stage1 = resolvePayslipUtc(prevYm.month, prevYm.year, pAnchor, shiftRule, holidays);
    payslipDrop = stage1.date;
    payslipShifted = stage1.shifted;
    const expPayslip = parseIsoUtc(req.explicitPayslipIso);
    if (expPayslip) {
      payslipDrop = expPayslip;
      overrideApplied = true;
    }
    payday = addWorkingDaysUtc(payslipDrop, lagDays, holidays);
    shifted = payslipShifted;

    const nextStage1 = resolvePayslipUtc(m, y, pAnchor, shiftRule, holidays);
    nextPayday = addWorkingDaysUtc(nextStage1.date, lagDays, holidays);
  } else {
    const leg = resolvePaydayUtc(prevYm.month, prevYm.year, anchor, req.shiftWeekendToFriday);
    payday = leg.date;
    shifted = leg.shifted;
    payslipDrop = addWorkingDaysUtc(payday, -2, holidays);
    payslipShifted = shifted;
    lagDays = 2;
    nextPayday = resolvePaydayUtc(m, y, anchor, req.shiftWeekendToFriday).date;
  }

  const expStart = parseIsoUtc(req.explicitStartIso);
  if (expStart) {
    payday = expStart;
    overrideApplied = true;
  }

  const expNext = parseIsoUtc(req.explicitNextPaydayIso);
  if (expNext && expNext.getTime() > payday.getTime()) {
    nextPayday = expNext;
  }

  const livingStart = payday;
  const livingEnd = new Date(nextPayday.getTime() - 86400000);
  const totalDays = Math.max(1, Math.trunc((nextPayday.getTime() - payday.getTime()) / 86400000));

  const parsedRef = parseIsoUtc(req.referenceDateIso);
  const now = new Date();
  const refDate =
    parsedRef ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  let elapsedDays = 0;
  let remDays = totalDays;
  let cycleTemporalState: 'PRE_PAYDAY' | 'ACTIVE' | 'COMPLETED' = 'ACTIVE';
  let daysUntilCycleStart = 0;
  let currentDayIndex = 0;

  if (refDate.getTime() < payday.getTime()) {
    cycleTemporalState = 'PRE_PAYDAY';
    daysUntilCycleStart = Math.trunc((payday.getTime() - refDate.getTime()) / 86400000);
    elapsedDays = 0;
    remDays = totalDays;
    currentDayIndex = 0;
  } else if (refDate.getTime() > livingEnd.getTime()) {
    cycleTemporalState = 'COMPLETED';
    daysUntilCycleStart = 0;
    elapsedDays = totalDays;
    remDays = 0;
    currentDayIndex = totalDays;
  } else {
    cycleTemporalState = 'ACTIVE';
    daysUntilCycleStart = 0;
    currentDayIndex = Math.min(
      totalDays,
      Math.max(1, Math.trunc((refDate.getTime() - payday.getTime()) / 86400000) + 1),
    );
    elapsedDays = Math.max(0, currentDayIndex - 1);
    remDays = Math.max(0, totalDays - elapsedDays);
  }

  const cursorStart =
    refDate.getTime() >= livingStart.getTime() && refDate.getTime() <= livingEnd.getTime()
      ? refDate
      : livingStart;

  let remWeekdays = 0;
  let remWeekends = 0;
  if (refDate.getTime() <= livingEnd.getTime()) {
    for (let ts = cursorStart.getTime(); ts <= livingEnd.getTime(); ts += 86400000) {
      const wd = new Date(ts).getUTCDay();
      if (wd === 0 || wd === 6) remWeekends++;
      else remWeekdays++;
    }
  }

  const budget = Math.max(0, Math.trunc(req.remainingBudgetRp || 0));
  let flatRate = 0;
  let weekdayRate = 0;
  let weekendRate = 0;
  if (remDays > 0) {
    flatRate = goRound(budget / remDays);
    const weightedUnits = remWeekdays * 1.0 + remWeekends * mult;
    if (weightedUnits > 0) {
      weekdayRate = goRound(budget / weightedUnits);
      weekendRate = goRound(weekdayRate * mult);
    }
  }

  return {
    periodMonth: m,
    periodYear: y,
    periodCode: `${String(m).padStart(2, '0')}/${y}`,
    payslipDropIso: fmtIsoUtc(payslipDrop),
    payslipShifted,
    reviewLagWorkingDays: lagDays,
    shiftRule,
    overrideApplied,
    ...(req.overrideNote ? { overrideNote: req.overrideNote } : {}),
    paydayIso: fmtIsoUtc(payday),
    paydayShiftedFromWeekend: shifted,
    livingStartIso: fmtIsoUtc(livingStart),
    livingEndIso: fmtIsoUtc(livingEnd),
    nextPaydayIso: fmtIsoUtc(nextPayday),
    cycleTemporalState,
    daysUntilCycleStart,
    currentDayIndex,
    maturityMonth: m,
    maturityYear: y,
    totalCycleDays: totalDays,
    remainingDays: remDays,
    elapsedDays,
    remainingWeekdays: remWeekdays,
    remainingWeekends: remWeekends,
    weekdaySafeRateRp: weekdayRate,
    weekendSafeRateRp: weekendRate,
    flatDailyRateRp: flatRate,
    weekendMultiplier: mult,
  };
}

export function evaluateConfiguredWaterfallTs(req: WaterfallConfigRequest): WaterfallConfigResult {
  const income = Math.max(0, Math.trunc(req.finalTotalIncomeRp || 0));
  const debt = Math.max(0, Math.trunc(req.totalDebtObligationsRp || 0));
  const routine = Math.max(0, Math.trunc(req.routineQuotasTotalRp || 0));
  const dailyTarget = Math.max(0, Math.trunc(req.dailyLivingTargetRp || 0));
  const bufferTarget = Math.max(0, Math.trunc(req.bufferTargetRp || 0));
  const p1Target = Math.max(0, Math.trunc(req.coreSavingsP1TargetRp || 0));

  const availableForLiving = Math.max(0, income - debt - routine);
  const dailyFunded = Math.min(dailyTarget, availableForLiving);
  const remainingAfterLiving = Math.max(0, availableForLiving - dailyFunded);
  const bufferFunded = Math.min(bufferTarget, remainingAfterLiving);
  const surplus = Math.max(0, remainingAfterLiving - bufferFunded);

  const mandatory = debt + routine + dailyTarget + bufferTarget;
  const available = income - mandatory;

  let deficit = 0;
  let p1Funded = 0;
  let p2Funded = 0;
  if (available < 0) {
    deficit = -available;
  } else if (surplus >= p1Target) {
    p1Funded = p1Target;
    p2Funded = surplus - p1Target;
  } else {
    p1Funded = surplus;
    p2Funded = 0;
  }

  return {
    finalTotalIncomeRp: income,
    debtObligationsFundedRp: debt,
    routineQuotasFundedRp: routine,
    dailyLivingFundedRp: dailyFunded,
    bufferFundedRp: bufferFunded,
    coreSavingsP1FundedRp: p1Funded,
    selfRewardP2FundedRp: p2Funded,
    uncoveredDeficitRp: deficit,
    availableAfterEssentialRp: available,
  };
}

export function routeTransactionToPaycycleTs(req: RouteTxRequest): RouteTxResult {
  const now = new Date();
  const txDate =
    parseIsoUtc(req.txDateIso) ??
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = txDate.getUTCDate();
  const m = txDate.getUTCMonth() + 1;
  const y = txDate.getUTCFullYear();
  const instUpper = (req.instrumentType || '').trim().toUpperCase();

  let cutoffDay = 0;
  let dueDay = 0;
  let dueRule = 'FIXED_DAY';
  for (const r of req.rules ?? []) {
    if (!r.active) continue;
    if (
      r.type.toUpperCase() === instUpper ||
      (req.instrumentName && r.name.toLowerCase() === req.instrumentName.toLowerCase())
    ) {
      cutoffDay = r.cutoffDay;
      dueDay = r.dueDay;
      if (r.dueRule) dueRule = r.dueRule;
      break;
    }
  }
  if (cutoffDay === 0 && dueDay === 0) {
    if (instUpper === 'PAYLATER' || instUpper === 'SPAYLATER') {
      cutoffDay = daysInMonthUtc(m, y) - 15;
      dueDay = 25;
    } else if (instUpper === 'CREDIT_CARD' || instUpper === 'CC') {
      cutoffDay = 25;
      dueDay = 11;
    } else if (instUpper === 'CASH_LOAN' || instUpper === 'SPINJAM') {
      dueRule = 'DISBURSEMENT_DAY';
      dueDay = day;
    }
  } else if ((instUpper === 'PAYLATER' || instUpper === 'SPAYLATER') && cutoffDay === 15) {
    cutoffDay = daysInMonthUtc(m, y) - 15;
  }

  if (instUpper === 'CASH') {
    const anchor = !req.anchorDay || req.anchorDay <= 0 ? 27 : req.anchorDay;
    const target = day >= anchor ? addHybridMonths(m, y, 1) : { month: m, year: y };
    return {
      targetPeriodMonth: target.month,
      targetPeriodYear: target.year,
      targetPeriodCode: `${String(target.month).padStart(2, '0')}/${target.year}`,
      maturityMonth: target.month,
      maturityYear: target.year,
      dueDay: day,
      cutoffDay: 0,
      crossedCutoff: false,
      explanation: `Cash transaction on ${fmtIsoUtc(txDate)} falls inside Paycycle ${String(target.month).padStart(2, '0')}/${target.year}.`,
    };
  }

  if (dueRule === 'DISBURSEMENT_DAY' || instUpper === 'CASH_LOAN' || instUpper === 'SPINJAM') {
    const firstDue = addHybridMonths(m, y, 1);
    return {
      targetPeriodMonth: firstDue.month,
      targetPeriodYear: firstDue.year,
      targetPeriodCode: `${String(firstDue.month).padStart(2, '0')}/${firstDue.year}`,
      maturityMonth: firstDue.month,
      maturityYear: firstDue.year,
      dueDay,
      cutoffDay: 0,
      crossedCutoff: false,
      explanation: `Disbursement-day loan on day ${day} matures ${String(firstDue.month).padStart(2, '0')}/${firstDue.year} on day ${dueDay} -> Period ${String(firstDue.month).padStart(2, '0')}/${firstDue.year}.`,
    };
  }

  if (instUpper === 'CREDIT_CARD' || instUpper === 'CC') {
    const crossed = day > cutoffDay;
    const target = addHybridMonths(m, y, crossed ? 2 : 1);
    return {
      targetPeriodMonth: target.month,
      targetPeriodYear: target.year,
      targetPeriodCode: `${String(target.month).padStart(2, '0')}/${target.year}`,
      maturityMonth: target.month,
      maturityYear: target.year,
      dueDay,
      cutoffDay,
      crossedCutoff: crossed,
      explanation: `Credit Card tx on day ${day} (cutoff ${cutoffDay}) matures ${dueDay}/${String(target.month).padStart(2, '0')}/${target.year} -> Period ${String(target.month).padStart(2, '0')}/${target.year}.`,
    };
  }

  const crossed = day > cutoffDay;
  const target = addHybridMonths(m, y, crossed ? 2 : 1);
  return {
    targetPeriodMonth: target.month,
    targetPeriodYear: target.year,
    targetPeriodCode: `${String(target.month).padStart(2, '0')}/${target.year}`,
    maturityMonth: target.month,
    maturityYear: target.year,
    dueDay,
    cutoffDay,
    crossedCutoff: crossed,
    explanation: `PayLater tx on day ${day} (cutoff ${cutoffDay}) matures ${dueDay}/${String(target.month).padStart(2, '0')}/${target.year} -> Period ${String(target.month).padStart(2, '0')}/${target.year}.`,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Engine 2: Double-Entry Net Worth & Asset Reservoirs Engine
// ───────────────────────────────────────────────────────────────────────────

export interface AssetAccountInput {
  id: string;
  name: string;
  institution: string;
  accountType: string;
  balanceRp: number;
  annualYieldPct: number;
  includeInRunway: boolean;
  isPrimaryPayroll?: boolean;
}

export interface NetWorthPeriodFlow {
  month: number;
  year: number;
  label: string;
  projectedSavingsP1Rp: number;
  projectedSurplusP2Rp: number;
  totalDebtDueRp: number;
  payLaterDueRp: number;
  creditCardDueRp: number;
  personalDebtDueRp: number;
}

export interface NetWorthRequest {
  accounts: AssetAccountInput[];
  upcomingPeriods: NetWorthPeriodFlow[];
}

export interface NetWorthTrajectoryPoint {
  month: number;
  year: number;
  label: string;
  projectedAssetsRp: number;
  remainingDebtRp: number;
  netWorthRp: number;
  monthlyYieldRp: number;
}

export interface NetWorthResult {
  liquidAssetsRp: number;
  totalAssetsRp: number;
  totalUnpaidDebtRp: number;
  currentCycleDebtRp: number;
  futureInstallmentPrincipalRp: number;
  payLaterPrincipalRp: number;
  creditCardPrincipalRp: number;
  personalDebtPrincipalRp: number;
  liquidNetWorthRp: number;
  totalNetWorthRp: number;
  assetToDebtCoveragePct: number;
  debtToAssetLeveragePct: number;
  monthlyRdpuYieldRp: number;
  trajectory: NetWorthTrajectoryPoint[];
}

export function computeNetWorthTs(req: NetWorthRequest): NetWorthResult {
  let liquidAssets = 0;
  let totalAssets = 0;
  let monthlyYield = 0;
  let weightedYieldSum = 0;
  let yieldEligibleBalance = 0;

  for (const acc of req.accounts ?? []) {
    const bal = Math.max(0, Math.trunc(acc.balanceRp || 0));
    totalAssets += bal;
    if (
      acc.includeInRunway ||
      acc.accountType === 'OPERATIONAL_BANK' ||
      acc.accountType === 'MONEY_MARKET_RDPU' ||
      acc.accountType === 'CASH_WALLET'
    ) {
      liquidAssets += bal;
    }
    if (acc.annualYieldPct > 0 && bal > 0) {
      monthlyYield += goRound((bal * (acc.annualYieldPct / 100.0)) / 12.0);
      weightedYieldSum += (bal * (acc.annualYieldPct / 100.0)) / 12.0;
      yieldEligibleBalance += bal;
    }
  }

  let plTotal = 0;
  let ccTotal = 0;
  let pdTotal = 0;
  let totalDebt = 0;
  let currentCycleDebt = 0;
  let futureInstallmentPrincipal = 0;
  const upcoming = req.upcomingPeriods ?? [];
  for (let idx = 0; idx < upcoming.length; idx++) {
    const p = upcoming[idx];
    plTotal += Math.max(0, Math.trunc(p.payLaterDueRp || 0));
    ccTotal += Math.max(0, Math.trunc(p.creditCardDueRp || 0));
    pdTotal += Math.max(0, Math.trunc(p.personalDebtDueRp || 0));
    const periodDebt =
      p.totalDebtDueRp > 0
        ? Math.trunc(p.totalDebtDueRp)
        : Math.max(0, Math.trunc(p.payLaterDueRp || 0)) +
          Math.max(0, Math.trunc(p.creditCardDueRp || 0)) +
          Math.max(0, Math.trunc(p.personalDebtDueRp || 0));
    totalDebt += periodDebt;
    if (idx === 0) currentCycleDebt += periodDebt;
    else futureInstallmentPrincipal += periodDebt;
  }

  let avgMonthlyRate = yieldEligibleBalance > 0 ? weightedYieldSum / yieldEligibleBalance : 0;
  if (avgMonthlyRate < 0) avgMonthlyRate = 0;

  const coveragePct = totalDebt > 0 ? round1((totalAssets / totalDebt) * 100.0) : 100.0;
  let leveragePct = 0.0;
  if (totalAssets > 0) leveragePct = round1((totalDebt / totalAssets) * 100.0);
  else if (totalDebt > 0) leveragePct = 100.0;

  let runningAssets = totalAssets;
  let remainingDebt = totalDebt;
  const trajectory: NetWorthTrajectoryPoint[] = [];
  const limit = Math.min(12, (req.upcomingPeriods ?? []).length);
  for (let i = 0; i < limit; i++) {
    const p = req.upcomingPeriods[i];
    const periodYield = runningAssets > 0 ? goRound(runningAssets * avgMonthlyRate) : 0;
    runningAssets +=
      Math.max(0, Math.trunc(p.projectedSavingsP1Rp || 0)) +
      Math.max(0, Math.trunc(p.projectedSurplusP2Rp || 0)) +
      periodYield;
    const debtPaid =
      p.totalDebtDueRp > 0
        ? Math.trunc(p.totalDebtDueRp)
        : Math.max(0, Math.trunc(p.payLaterDueRp || 0)) +
          Math.max(0, Math.trunc(p.creditCardDueRp || 0)) +
          Math.max(0, Math.trunc(p.personalDebtDueRp || 0));
    remainingDebt = Math.max(0, remainingDebt - debtPaid);
    trajectory.push({
      month: p.month,
      year: p.year,
      label: p.label || `${String(p.month).padStart(2, '0')}/${p.year}`,
      projectedAssetsRp: runningAssets,
      remainingDebtRp: remainingDebt,
      netWorthRp: runningAssets - remainingDebt,
      monthlyYieldRp: periodYield,
    });
  }

  return {
    liquidAssetsRp: liquidAssets,
    totalAssetsRp: totalAssets,
    totalUnpaidDebtRp: totalDebt,
    currentCycleDebtRp: currentCycleDebt,
    futureInstallmentPrincipalRp: futureInstallmentPrincipal,
    payLaterPrincipalRp: plTotal,
    creditCardPrincipalRp: ccTotal,
    personalDebtPrincipalRp: pdTotal,
    liquidNetWorthRp: liquidAssets - totalDebt,
    totalNetWorthRp: totalAssets - totalDebt,
    assetToDebtCoveragePct: coveragePct,
    debtToAssetLeveragePct: leveragePct,
    monthlyRdpuYieldRp: monthlyYield,
    trajectory,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Engine 3: 12-Month Deterministic & Stress-Test Wealth Forecaster
// ───────────────────────────────────────────────────────────────────────────

export interface ForecastPeriodInput {
  month: number;
  year: number;
  label: string;
  totalIncomeRp: number;
  totalDebtDueRp: number;
  personalDebtDueRp: number;
  dailyLivingRp: number;
  routineBillsRp: number;
  coreSavingsP1Rp: number;
  selfRewardP2Rp: number;
  dsrPercent?: number;
}

export interface ForecasterRequest {
  startingLiquidAssetsRp: number;
  startingP1VaultRp: number;
  emergencyFundTargetRp: number;
  baselineDailyBurnRp: number;
  rdpuAnnualYieldPct: number;
  variableShockPercent: number;
  periods: ForecastPeriodInput[];
}

export interface ScenarioMonthPoint {
  month: number;
  year: number;
  label: string;
  baselineWealthRp: number;
  disciplinedWealthRp: number;
  shockWealthRp: number;
  dsrPercent: number;
  remainingPersonalDebtRp: number;
}

export interface ForecasterResult {
  spinjamFreedomDate: string;
  lowDsrMilestoneDate: string;
  emergencyFundCompletionDate: string;
  pureSurvivalRunwayDays: number;
  projected6MWealthBaselineRp: number;
  projected12MWealthBaselineRp: number;
  projected6MWealthZeroLeakRp: number;
  projected12MWealthZeroLeakRp: number;
  projected12MWealthShockRp: number;
  series: ScenarioMonthPoint[];
}

const SHORT_MON_TITLE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtTitleDateLabel(m: number, y: number): string {
  return m >= 1 && m <= 12 ? `${SHORT_MON_TITLE[m - 1]} ${y}` : `${String(m).padStart(2, '0')}/${y}`;
}

export function runForecastTs(req: ForecasterRequest): ForecasterResult {
  const monthlyYieldRate = Math.max(0, (req.rdpuAnnualYieldPct || 0) / 100.0 / 12.0);
  const shockFactor = req.variableShockPercent > 0 ? req.variableShockPercent / 100.0 : 0.15;
  const efTarget = req.emergencyFundTargetRp > 0 ? req.emergencyFundTargetRp : 15000000;
  const dailyBurn = req.baselineDailyBurnRp > 0 ? req.baselineDailyBurnRp : 95000;
  const runwayDays =
    req.startingLiquidAssetsRp > 0 ? Math.trunc(req.startingLiquidAssetsRp / dailyBurn) : 0;

  let baseWealth = Math.trunc(req.startingLiquidAssetsRp || 0);
  let discWealth = baseWealth;
  let shockWealth = baseWealth;

  let totalPersonalDebtRemaining = 0;
  for (const p of req.periods ?? []) {
    if (p.personalDebtDueRp > 0) totalPersonalDebtRemaining += p.personalDebtDueRp;
  }

  let spinjamFreedom = totalPersonalDebtRemaining > 0 ? 'Beyond 12M' : 'Paid Off';
  let lowDsrDate = 'Already <15%';
  let hasHighDsr = false;
  for (const p of req.periods ?? []) {
    const dsr =
      p.dsrPercent && p.dsrPercent > 0
        ? p.dsrPercent
        : p.totalIncomeRp > 0
          ? (p.totalDebtDueRp / p.totalIncomeRp) * 100.0
          : 0;
    if (dsr >= 15.0) {
      hasHighDsr = true;
      lowDsrDate = 'Beyond 12M';
      break;
    }
  }

  let efDate = baseWealth >= efTarget ? 'Funded Now' : 'Beyond 12M';
  const series: ScenarioMonthPoint[] = [];
  let p6Base = baseWealth;
  let p12Base = baseWealth;
  let p6Disc = discWealth;
  let p12Disc = discWealth;
  let p12Shock = shockWealth;
  let seenPersonalDebt = false;

  for (let i = 0; i < Math.min(12, (req.periods ?? []).length); i++) {
    const p = req.periods[i];
    const dsr =
      p.dsrPercent && p.dsrPercent > 0
        ? p.dsrPercent
        : p.totalIncomeRp > 0
          ? round1((p.totalDebtDueRp / p.totalIncomeRp) * 100.0)
          : 0;

    if (p.personalDebtDueRp > 0) {
      seenPersonalDebt = true;
      totalPersonalDebtRemaining = Math.max(0, totalPersonalDebtRemaining - p.personalDebtDueRp);
      if (totalPersonalDebtRemaining === 0) {
        const next = addHybridMonths(p.month, p.year, 1);
        spinjamFreedom = fmtTitleDateLabel(next.month, next.year);
      }
    } else if (seenPersonalDebt && spinjamFreedom === 'Beyond 12M') {
      spinjamFreedom = fmtTitleDateLabel(p.month, p.year);
    }

    if (hasHighDsr && lowDsrDate === 'Beyond 12M' && dsr < 15.0) {
      lowDsrDate = fmtTitleDateLabel(p.month, p.year);
    }

    const baseYield = goRound(Math.max(0, baseWealth) * monthlyYieldRate);
    baseWealth +=
      Math.max(0, p.coreSavingsP1Rp) + goRound(Math.max(0, p.selfRewardP2Rp) * 0.5) + baseYield;

    const discYield = goRound(Math.max(0, discWealth) * monthlyYieldRate);
    const foodSweep = goRound(Math.max(0, p.dailyLivingRp) * 0.1);
    discWealth += Math.max(0, p.coreSavingsP1Rp) + Math.max(0, p.selfRewardP2Rp) + foodSweep + discYield;

    const shockCost = goRound((Math.max(0, p.dailyLivingRp) + Math.max(0, p.routineBillsRp)) * shockFactor);
    const shockNet =
      Math.max(0, p.coreSavingsP1Rp) + goRound(Math.max(0, p.selfRewardP2Rp) * 0.25) - shockCost;
    const shockYield = goRound(Math.max(0, shockWealth) * monthlyYieldRate);
    shockWealth = Math.max(0, shockWealth + shockNet + shockYield);

    if (efDate === 'Beyond 12M' && discWealth >= efTarget) {
      efDate = fmtTitleDateLabel(p.month, p.year);
    }

    if (i === 5) {
      p6Base = baseWealth;
      p6Disc = discWealth;
    }
    p12Base = baseWealth;
    p12Disc = discWealth;
    p12Shock = shockWealth;

    series.push({
      month: p.month,
      year: p.year,
      label: p.label || fmtTitleDateLabel(p.month, p.year),
      baselineWealthRp: baseWealth,
      disciplinedWealthRp: discWealth,
      shockWealthRp: shockWealth,
      dsrPercent: dsr,
      remainingPersonalDebtRp: totalPersonalDebtRemaining,
    });
  }

  if (series.length > 0 && series.length < 6) {
    p6Base = baseWealth;
    p6Disc = discWealth;
  }

  return {
    spinjamFreedomDate: spinjamFreedom,
    lowDsrMilestoneDate: lowDsrDate,
    emergencyFundCompletionDate: efDate,
    pureSurvivalRunwayDays: runwayDays,
    projected6MWealthBaselineRp: p6Base,
    projected12MWealthBaselineRp: p12Base,
    projected6MWealthZeroLeakRp: p6Disc,
    projected12MWealthZeroLeakRp: p12Disc,
    projected12MWealthShockRp: p12Shock,
    series,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Engine 4: Spending Velocity, Anomaly & Post-Cutoff Creep Detector
// ───────────────────────────────────────────────────────────────────────────

export interface CashTxSample {
  id: number;
  label: string;
  category: string;
  amountRp: number;
  dateIso: string;
}

export interface PostCutoffItemInput {
  title: string;
  instrument: string;
  purchaseDay: number;
  amountRp: number;
  nextPeriodLabel?: string;
}

export interface RecurringChargeInput {
  label: string;
  category: string;
  amountRp: number;
  prevAmountRp?: number;
}

export interface AnomalyRequest {
  periodLabel: string;
  totalCycleDays: number;
  elapsedDays: number;
  dailyLivingBudgetRp: number;
  dailyLivingSpentRp: number;
  baselineDailyRateRp: number;
  cashTransactions?: CashTxSample[];
  postCutoffItems?: PostCutoffItemInput[];
  recurringCharges?: RecurringChargeInput[];
}

export interface AnomalyAlert {
  code: string;
  severity: string;
  title: string;
  description: string;
  amountRp: number;
}

export interface AnomalyResult {
  burnVelocityIndex: number;
  pctBudgetConsumed: number;
  pctCycleElapsed: number;
  velocityStatus: string;
  postCutoffCreepRp: number;
  subscriptionCreepRp: number;
  alertCount: number;
  alerts: AnomalyAlert[];
}

export function evaluateAnomaliesTs(req: AnomalyRequest): AnomalyResult {
  const totalDays = req.totalCycleDays > 0 ? req.totalCycleDays : 30;
  const elapsed = Math.min(totalDays, Math.max(1, req.elapsedDays || 1));
  const pctElapsed = (elapsed / totalDays) * 100.0;
  const pctConsumed =
    req.dailyLivingBudgetRp > 0 ? (req.dailyLivingSpentRp / req.dailyLivingBudgetRp) * 100.0 : 0;

  const velocity = pctElapsed > 0 ? round2(pctConsumed / pctElapsed) : 0;
  const status = velocity > 1.25 ? 'BURNING_FAST' : velocity > 1.05 ? 'CAUTION' : 'SAFE';

  const alerts: AnomalyAlert[] = [];
  const dailyRate =
    req.baselineDailyRateRp > 0
      ? req.baselineDailyRateRp
      : req.dailyLivingBudgetRp > 0
        ? Math.trunc(req.dailyLivingBudgetRp / totalDays)
        : 0;

  if (status === 'BURNING_FAST' && req.dailyLivingSpentRp > 0) {
    alerts.push({
      code: 'DAILY_BURN_SPIKE',
      severity: 'CRITICAL',
      title: 'Daily Burn Exceeding Cycle Pace',
      description: `Living cash consumed ${pctConsumed.toFixed(1)}% of budget with ${pctElapsed.toFixed(1)}% of cycle elapsed (${velocity.toFixed(2)}x pace).`,
      amountRp: req.dailyLivingSpentRp,
    });
  } else if (status === 'CAUTION') {
    alerts.push({
      code: 'DAILY_BURN_SPIKE',
      severity: 'CAUTION',
      title: 'Elevated Living Spend Pace',
      description: `Living spend velocity is ${velocity.toFixed(2)}x above even daily pace.`,
      amountRp: req.dailyLivingSpentRp,
    });
  }

  if (dailyRate > 0) {
    for (const tx of req.cashTransactions ?? []) {
      if (tx.amountRp > dailyRate * 2 && tx.amountRp >= 100000) {
        alerts.push({
          code: 'DAILY_BURN_SPIKE',
          severity: 'CAUTION',
          title: `Single-Day Spend Spike: ${tx.label}`,
          description: `Transaction of Rp ${formatRpId(tx.amountRp)} exceeds 2x daily baseline (Rp ${formatRpId(dailyRate)}).`,
          amountRp: tx.amountRp,
        });
      }
    }
  }

  let postCutoffTotal = 0;
  for (const item of req.postCutoffItems ?? []) {
    const instU = (item.instrument || '').toUpperCase();
    const isPost =
      (instU === 'SPAYLATER' && item.purchaseDay >= 15) ||
      (instU === 'CREDIT_CARD' && item.purchaseDay > 20);
    if (isPost && item.amountRp > 0) postCutoffTotal += item.amountRp;
  }
  if (postCutoffTotal > 0) {
    alerts.push({
      code: 'POST_CUTOFF_DEBT_CREEP',
      severity: 'CAUTION',
      title: 'Post-Cutoff BNPL / Card Creep',
      description: `Rp ${formatRpId(postCutoffTotal)} of post-cutoff charges silently stacked into upcoming due horizon.`,
      amountRp: postCutoffTotal,
    });
  }

  const catCounts = new Map<string, number>();
  const catSums = new Map<string, number>();
  let subCreepTotal = 0;
  for (const rc of req.recurringCharges ?? []) {
    const cat = (rc.category || '').trim().toLowerCase() || 'general';
    catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
    catSums.set(cat, (catSums.get(cat) ?? 0) + rc.amountRp);
    if (rc.prevAmountRp && rc.prevAmountRp > 0 && rc.amountRp > rc.prevAmountRp) {
      subCreepTotal += rc.amountRp - rc.prevAmountRp;
    }
  }
  for (const [cat, cnt] of catCounts.entries()) {
    if (cnt >= 2 && cat !== 'general') {
      const sum = catSums.get(cat) ?? 0;
      alerts.push({
        code: 'SUBSCRIPTION_CREEP',
        severity: 'INFO',
        title: `Multiple Recurring Charges (${cat[0].toUpperCase()}${cat.slice(1)})`,
        description: `${cnt} active charges totaling Rp ${formatRpId(sum)} in the same category this cycle.`,
        amountRp: sum,
      });
    }
  }
  if (subCreepTotal > 0) {
    alerts.push({
      code: 'SUBSCRIPTION_CREEP',
      severity: 'CAUTION',
      title: 'Recurring Price / Tier Creep',
      description: `Recurring bills increased by +Rp ${formatRpId(subCreepTotal)} versus prior cycle.`,
      amountRp: subCreepTotal,
    });
  }

  return {
    burnVelocityIndex: velocity,
    pctBudgetConsumed: round1(pctConsumed),
    pctCycleElapsed: round1(pctElapsed),
    velocityStatus: status,
    postCutoffCreepRp: postCutoffTotal,
    subscriptionCreepRp: subCreepTotal,
    alertCount: alerts.length,
    alerts,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Engine 5: Zero-Based Envelope Rollover, Sinking Funds & Age of Money
// ───────────────────────────────────────────────────────────────────────────

export interface EnvelopeQuotaInput {
  id: string;
  name: string;
  allocatedRp: number;
  spentRp: number;
  rolloverPolicy: string;
}

export interface SinkingFundInput {
  id: string;
  name: string;
  targetAmountRp: number;
  currentSavedRp: number;
  monthsRemaining: number;
}

export interface EnvelopesRequest {
  liquidCashTotalRp: number;
  dailyAverageBurnRp: number;
  monthlyInflowRp?: number;
  cycleElapsedDays: number;
  cycleTotalDays: number;
  envelopes: EnvelopeQuotaInput[];
  sinkingFunds: SinkingFundInput[];
}

export interface EnvelopeRolloverEval {
  id: string;
  name: string;
  allocatedRp: number;
  spentRp: number;
  unspentRp: number;
  rolloverPolicy: string;
  sweptToP1Rp: number;
  rolledNextCycleRp: number;
}

export interface SinkingFundSchedule {
  id: string;
  name: string;
  targetAmountRp: number;
  currentSavedRp: number;
  remainingTargetRp: number;
  monthsRemaining: number;
  monthlySetAsideRp: number;
  dailySetAsideRp: number;
  progressPercent: number;
}

export interface EnvelopesResult {
  ageOfMoneyDays: number;
  bufferDays: number;
  totalUnspentSweepToP1Rp: number;
  totalUnspentRollForwardRp: number;
  totalSinkingMonthlyRp: number;
  envelopeEvaluations: EnvelopeRolloverEval[];
  sinkingSchedules: SinkingFundSchedule[];
}

export function evaluateEnvelopesTs(req: EnvelopesRequest): EnvelopesResult {
  const burn = req.dailyAverageBurnRp > 0 ? req.dailyAverageBurnRp : 65000;
  const cash = Math.max(0, Math.trunc(req.liquidCashTotalRp || 0));
  const bufferDays = Math.trunc(cash / burn);
  const ageOfMoney = bufferDays;

  let sweepP1 = 0;
  let rollNext = 0;
  const envelopeEvaluations: EnvelopeRolloverEval[] = (req.envelopes ?? []).map((env) => {
    const alloc = Math.max(0, Math.trunc(env.allocatedRp || 0));
    const spent = Math.max(0, Math.trunc(env.spentRp || 0));
    const unspent = Math.max(0, alloc - spent);
    const policy = env.rolloverPolicy || 'SWEEP_TO_P1';
    let sP1 = 0;
    let rNext = 0;
    if (policy === 'ROLLOVER_NEXT_MONTH') {
      rNext = unspent;
      rollNext += unspent;
    } else {
      sP1 = unspent;
      sweepP1 += unspent;
    }
    return {
      id: env.id,
      name: env.name,
      allocatedRp: alloc,
      spentRp: spent,
      unspentRp: unspent,
      rolloverPolicy: policy,
      sweptToP1Rp: sP1,
      rolledNextCycleRp: rNext,
    };
  });

  let totalSinkingMonthly = 0;
  const sinkingSchedules: SinkingFundSchedule[] = (req.sinkingFunds ?? []).map((sf) => {
    const target = Math.max(0, Math.trunc(sf.targetAmountRp || 0));
    const saved = Math.max(0, Math.trunc(sf.currentSavedRp || 0));
    const rem = Math.max(0, target - saved);
    const months = sf.monthsRemaining > 0 ? sf.monthsRemaining : 1;
    const monthly = goRound(rem / months);
    const daily = goRound(monthly / 30.0);
    totalSinkingMonthly += monthly;
    const pct = target > 0 ? Math.min(100.0, round1((saved / target) * 100.0)) : 100.0;
    return {
      id: sf.id,
      name: sf.name,
      targetAmountRp: target,
      currentSavedRp: saved,
      remainingTargetRp: rem,
      monthsRemaining: months,
      monthlySetAsideRp: monthly,
      dailySetAsideRp: daily,
      progressPercent: pct,
    };
  });

  return {
    ageOfMoneyDays: ageOfMoney,
    bufferDays,
    totalUnspentSweepToP1Rp: sweepP1,
    totalUnspentRollForwardRp: rollNext,
    totalSinkingMonthlyRp: totalSinkingMonthly,
    envelopeEvaluations,
    sinkingSchedules,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Engine 6: Debt Payoff Strategy Optimizer
// ───────────────────────────────────────────────────────────────────────────

export interface DebtContractOptInput {
  id: string;
  name: string;
  instrument: string;
  monthlyInstallmentRp: number;
  remainingMonths: number;
  remainingBalanceRp: number;
  monthlyInterestPct: number;
  payoffMonth: number;
  payoffYear: number;
  payoffLabel: string;
}

export interface DebtOptRequest {
  contracts: DebtContractOptInput[];
  extraLumpSumRp: number;
}

export interface CashflowUnlockMilestone {
  unlockMonth: number;
  unlockYear: number;
  unlockLabel: string;
  freedMonthlyRp: number;
  spinjamOnlyFreedRp: number;
  cumulativeFreedRp: number;
  finishedContracts: string[];
}

export interface StrategyPlan {
  strategy: string;
  priorityOrderNames: string[];
  estimatedInterestSavedRp: number;
  monthsShaved: number;
  immediateFreedMonthlyRp: number;
  summary: string;
}

export interface DebtOptResult {
  totalRemainingBalanceRp: number;
  totalCurrentMonthlyRp: number;
  extraLumpSumRp: number;
  strategies: StrategyPlan[];
  unlockMilestones: CashflowUnlockMilestone[];
  spinjamMonthlyTotalRp: number;
  spinjamFreedomLabel: string;
}

function simulateLumpSumTs(
  ordered: DebtContractOptInput[],
  lumpSum: number,
  strategy: string,
): StrategyPlan {
  let rem = lumpSum;
  let interestSaved = 0;
  let freedMonthly = 0;
  let monthsShaved = 0;
  const names: string[] = [];

  for (const c of ordered) {
    names.push(c.name);
    const bal =
      c.remainingBalanceRp > 0
        ? c.remainingBalanceRp
        : c.monthlyInstallmentRp * c.remainingMonths;
    if (rem > 0 && bal > 0) {
      const applied = Math.min(bal, rem);
      rem -= applied;
      const ratio = applied / bal;
      interestSaved += goRound(
        bal * (c.monthlyInterestPct / 100.0) * c.remainingMonths * 0.55 * ratio,
      );
      if (applied >= bal) {
        freedMonthly += c.monthlyInstallmentRp;
        monthsShaved += c.remainingMonths;
      } else if (c.monthlyInstallmentRp > 0) {
        monthsShaved += Math.trunc(applied / c.monthlyInstallmentRp);
      }
    }
  }

  let summary = 'Follows exact contractual maturity dates without prepaying principal.';
  if (strategy === 'AVALANCHE') {
    summary =
      'Prioritizes highest monthly APR contracts (SPinjam ~3.95%/mo) to minimize cumulative interest charges.';
  } else if (strategy === 'SNOWBALL') {
    summary =
      'Targets smallest remaining balances first to unlock immediate monthly cashflow relief fastest.';
  }

  return {
    strategy,
    priorityOrderNames: names,
    estimatedInterestSavedRp: interestSaved,
    monthsShaved,
    immediateFreedMonthlyRp: freedMonthly,
    summary,
  };
}

export function optimizeDebtPayoffTs(req: DebtOptRequest): DebtOptResult {
  let totalBal = 0;
  let totalMonthly = 0;
  let spinjamMonthly = 0;
  let latestSpinjamYM = 0;
  let latestSpinjamLabel = 'Paid Off';
  const unlockMap = new Map<string, CashflowUnlockMilestone>();
  const eligible: DebtContractOptInput[] = [];

  for (const c of req.contracts ?? []) {
    if (c.instrument === 'P1_VAULT_REFUND') continue;
    const bal =
      c.remainingBalanceRp > 0
        ? c.remainingBalanceRp
        : c.monthlyInstallmentRp * c.remainingMonths;
    if (bal <= 0) continue;
    eligible.push(c);
    totalBal += bal;
    totalMonthly += c.monthlyInstallmentRp;
    const isSpinjamOrPersonal = c.instrument === 'SPINJAM' || c.instrument === 'PERSONAL_DEBT';
    if (isSpinjamOrPersonal) {
      spinjamMonthly += c.monthlyInstallmentRp;
      const ym = c.payoffYear * 12 + c.payoffMonth;
      if (ym > latestSpinjamYM) {
        latestSpinjamYM = ym;
        latestSpinjamLabel = c.payoffLabel;
      }
    }
    if (c.payoffYear > 0 && c.payoffMonth > 0 && c.monthlyInstallmentRp > 0) {
      const key = `${String(c.payoffYear).padStart(4, '0')}-${String(c.payoffMonth).padStart(2, '0')}`;
      const existing = unlockMap.get(key) ?? {
        unlockMonth: c.payoffMonth,
        unlockYear: c.payoffYear,
        unlockLabel: c.payoffLabel || `${String(c.payoffMonth).padStart(2, '0')}/${c.payoffYear}`,
        freedMonthlyRp: 0,
        spinjamOnlyFreedRp: 0,
        cumulativeFreedRp: 0,
        finishedContracts: [],
      };
      existing.freedMonthlyRp += c.monthlyInstallmentRp;
      if (isSpinjamOrPersonal) {
        existing.spinjamOnlyFreedRp += c.monthlyInstallmentRp;
      }
      existing.finishedContracts.push(c.name);
      unlockMap.set(key, existing);
    }
  }

  const orderedKeys = Array.from(unlockMap.keys()).sort();
  let cumulative = 0;
  const unlockMilestones: CashflowUnlockMilestone[] = orderedKeys.map((k) => {
    const ms = unlockMap.get(k)!;
    cumulative += ms.freedMonthlyRp;
    ms.cumulativeFreedRp = cumulative;
    return ms;
  });

  const avalancheOrder = [...eligible].sort((a, b) => {
    if (a.monthlyInterestPct !== b.monthlyInterestPct) {
      return b.monthlyInterestPct - a.monthlyInterestPct;
    }
    return b.monthlyInstallmentRp - a.monthlyInstallmentRp;
  });

  const snowballOrder = [...eligible].sort((a, b) => {
    const bi =
      a.remainingBalanceRp > 0
        ? a.remainingBalanceRp
        : a.monthlyInstallmentRp * a.remainingMonths;
    const bj =
      b.remainingBalanceRp > 0
        ? b.remainingBalanceRp
        : b.monthlyInstallmentRp * b.remainingMonths;
    return bi - bj;
  });

  return {
    totalRemainingBalanceRp: totalBal,
    totalCurrentMonthlyRp: totalMonthly,
    extraLumpSumRp: req.extraLumpSumRp,
    strategies: [
      simulateLumpSumTs(eligible, 0, 'CONTRACTUAL'),
      simulateLumpSumTs(avalancheOrder, req.extraLumpSumRp, 'AVALANCHE'),
      simulateLumpSumTs(snowballOrder, req.extraLumpSumRp, 'SNOWBALL'),
    ],
    unlockMilestones,
    spinjamMonthlyTotalRp: spinjamMonthly,
    spinjamFreedomLabel: latestSpinjamLabel,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Engine 7: True Hourly Wage & Life-Energy Work-Hours Translator
// ───────────────────────────────────────────────────────────────────────────

export interface LifeEnergyRequest {
  netMonthlyIncomeRp: number;
  workdaysPerMonth: number;
  workHoursPerDay: number;
  dailyCommuteHours: number;
  monthlyWorkExpenseRp: number;
  sampleAmountsRp?: number[];
}

export interface AmountConversion {
  amountRp: number;
  workHoursRequired: number;
  workDaysRequired: number;
  pctOfMonthlyLifePct: number;
}

export interface LifeEnergyResult {
  nominalHourlyWageRp: number;
  trueNetHourlyWageRp: number;
  totalMonthlyWorkHours: number;
  totalMonthlyCommuteHours: number;
  totalLifeEnergyHours: number;
  netIncomeAfterWorkCostRp: number;
  conversions: AmountConversion[];
}

export function computeLifeEnergyTs(req: LifeEnergyRequest): LifeEnergyResult {
  const days = req.workdaysPerMonth > 0 ? req.workdaysPerMonth : 20;
  const hrsPerDay = req.workHoursPerDay > 0 ? req.workHoursPerDay : 8;
  const commute = req.dailyCommuteHours >= 0 ? req.dailyCommuteHours : 0;

  const workHrs = days * hrsPerDay;
  const commuteHrs = days * commute;
  const totalLifeHrs = workHrs + commuteHrs > 0 ? workHrs + commuteHrs : 160;
  const netAfterWork = Math.max(0, req.netMonthlyIncomeRp - req.monthlyWorkExpenseRp);

  const nominalHourly = goRound(Math.max(0, req.netMonthlyIncomeRp) / workHrs);
  const trueHourly = goRound(netAfterWork / totalLifeHrs);

  const hoursPerDayInclCommute = hrsPerDay + commute;
  const samples =
    req.sampleAmountsRp && req.sampleAmountsRp.length > 0
      ? req.sampleAmountsRp
      : [35000, 150000, 350000, 1000000, 4017341];

  const conversions: AmountConversion[] = samples.map((amt) => {
    let hReq = 0;
    let dReq = 0;
    let pct = 0;
    if (trueHourly > 0 && amt > 0) {
      hReq = round1(amt / trueHourly);
      dReq = round1(hReq / hoursPerDayInclCommute);
      pct = round1((hReq / totalLifeHrs) * 100.0);
    }
    return {
      amountRp: amt,
      workHoursRequired: hReq,
      workDaysRequired: dReq,
      pctOfMonthlyLifePct: pct,
    };
  });

  return {
    nominalHourlyWageRp: nominalHourly,
    trueNetHourlyWageRp: trueHourly,
    totalMonthlyWorkHours: workHrs,
    totalMonthlyCommuteHours: commuteHrs,
    totalLifeEnergyHours: totalLifeHrs,
    netIncomeAfterWorkCostRp: netAfterWork,
    conversions,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Engine 8: Statement / Mutation Bulk Parser & Auto-Reconciler
// ───────────────────────────────────────────────────────────────────────────

export interface ExistingLedgerItemInput {
  id: number;
  label: string;
  amountRp: number;
  dateIso: string;
  instrument: string;
}

export interface ReconcilerParseRequest {
  rawText: string;
  defaultMethod: string;
  anchorDay: number;
  cutoffRules?: InstrumentCutoffRule[];
  existingItems?: ExistingLedgerItemInput[];
  defaultYear: number;
  lockedPeriodCodes?: string[];
  earliestOpenMonth?: number;
  earliestOpenYear?: number;
}

export interface ReconcilerParsedRow {
  lineNumber: number;
  rawLine: string;
  dateIso: string;
  description: string;
  amountRp: number;
  instrument: string;
  inferredCategory: string;
  targetPeriodMonth: number;
  targetPeriodYear: number;
  targetPeriodCode: string;
  originalPeriodCode?: string;
  advancedFromLocked: boolean;
  crossedCutoff: boolean;
  duplicateStatus: 'NEW_ENTRY' | 'AMOUNT_DATE_MATCH' | 'EXACT_MATCH';
  matchedItemId?: number;
  matchedItemLabel?: string;
}

export interface ReconcilerParseResult {
  totalLines: number;
  parsedCount: number;
  newEntryCount: number;
  duplicateCount: number;
  totalAmountRp: number;
  rows: ReconcilerParsedRow[];
}

function inferInst(line: string, defInst: string): string {
  const lower = line.toLowerCase();
  if (lower.includes('spaylater') || lower.includes('paylater') || lower.includes('bnpl')) {
    return 'PAYLATER';
  }
  if (
    lower.includes('permata') ||
    lower.includes('credit card') ||
    lower.includes('kartu kredit') ||
    lower.includes(' cc ')
  ) {
    return 'CREDIT_CARD';
  }
  if (lower.includes('spinjam')) return 'CASH_LOAN';
  if (
    lower.includes('qris') ||
    lower.includes('bca') ||
    lower.includes('cash') ||
    lower.includes('transfer')
  ) {
    return defInst || 'CASH';
  }
  return defInst || 'CASH';
}

function inferCat(desc: string): string {
  const lower = desc.toLowerCase();
  if (
    lower.includes('kopi') ||
    lower.includes('coffee') ||
    lower.includes('sate') ||
    lower.includes('nasi') ||
    lower.includes('grabfood') ||
    lower.includes('gofood')
  ) {
    return 'FOOD_DINING';
  }
  if (
    lower.includes('krl') ||
    lower.includes('commuter') ||
    lower.includes('gojek') ||
    lower.includes('grab') ||
    lower.includes('transport')
  ) {
    return 'TRANSPORT';
  }
  if (
    lower.includes('vape') ||
    lower.includes('liquid') ||
    lower.includes('rokok') ||
    lower.includes('cigar')
  ) {
    return 'LIFESTYLE_VAPE';
  }
  if (
    lower.includes('telkomsel') ||
    lower.includes('kuota') ||
    lower.includes('internet') ||
    lower.includes('data')
  ) {
    return 'INTERNET';
  }
  if (lower.includes('haircut') || lower.includes('cukur') || lower.includes('barber')) {
    return 'HAIRCUT';
  }
  if (
    lower.includes('claude') ||
    lower.includes('gemini') ||
    lower.includes('apple') ||
    lower.includes('vidio')
  ) {
    return 'SUBSCRIPTION';
  }
  return 'GENERAL';
}

export function parseStatementBatchTs(req: ReconcilerParseRequest): ReconcilerParseResult {
  const defYear = req.defaultYear < 2020 ? new Date().getFullYear() : req.defaultYear;
  const anchor = req.anchorDay <= 0 ? 27 : req.anchorDay;
  const defMethod = (req.defaultMethod || '').trim().toUpperCase() || 'CASH';

  const isoDateRx = /\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/;
  const dmyDateRx = /\b(\d{1,2})[-/](\d{1,2})(?:[-/](20\d{2}))?\b/;
  const amountRx = /(?:Rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{4,9})\b/g;
  const rpPrefixRx = /\brp\.?\s*[\d.,]+/gi;

  const lockedSet = new Set<string>(
    (req.lockedPeriodCodes ?? []).map((c) => c.trim()).filter(Boolean),
  );

  const lines = (req.rawText || '').split(/\r?\n/);
  const rows: ReconcilerParsedRow[] = [];
  let totalAmt = 0;
  let newCount = 0;
  let dupCount = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    const lowerLine = line.toLowerCase();
    if (
      !line ||
      line.startsWith('#') ||
      lowerLine.startsWith('date,') ||
      lowerLine.startsWith('tanggal')
    ) {
      continue;
    }

    let dateIso = new Date().toISOString().slice(0, 10);
    let dateMatchStr = '';
    const mIso = isoDateRx.exec(line);
    if (mIso) {
      dateIso = `${String(Number(mIso[1])).padStart(4, '0')}-${String(Number(mIso[2])).padStart(2, '0')}-${String(Number(mIso[3])).padStart(2, '0')}`;
      dateMatchStr = mIso[0];
    } else {
      const mDmy = dmyDateRx.exec(line);
      if (mDmy) {
        const dy = Number(mDmy[1]);
        const mo = Number(mDmy[2]);
        const yr = mDmy[3] ? Number(mDmy[3]) : defYear;
        if (mo >= 1 && mo <= 12 && dy >= 1 && dy <= 31) {
          dateIso = `${String(yr).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(dy).padStart(2, '0')}`;
          dateMatchStr = mDmy[0];
        }
      }
    }

    const cleanedForAmount = dateMatchStr ? line.replace(dateMatchStr, ' ') : line;
    const matches = Array.from(cleanedForAmount.matchAll(amountRx));
    let amountRp = 0;
    let amtToken = '';
    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      const digits = (last[1] || '').replace(/\D/g, '');
      amountRp = digits ? parseInt(digits, 10) : 0;
      amtToken = last[0];
    }
    if (amountRp <= 0) continue;

    let desc = cleanedForAmount;
    if (amtToken) {
      desc = desc.replace(rpPrefixRx, ' ').replace(amtToken, ' ');
    }
    desc = desc.replace(/[,;|\t]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!desc) desc = 'Imported Statement Entry';

    const inst = inferInst(line, defMethod);
    const cat = inferCat(desc);
    const routed = routeTransactionToPaycycleTs({
      txDateIso: dateIso,
      instrumentType: inst,
      anchorDay: anchor,
      rules: req.cutoffRules,
    });

    let targetM = routed.targetPeriodMonth;
    let targetY = routed.targetPeriodYear;
    let targetCode = routed.targetPeriodCode;
    let advancedFromLocked = false;
    let originalPeriodCode = '';

    const earliestM = req.earliestOpenMonth ?? 0;
    const earliestY = req.earliestOpenYear ?? 0;
    const isBeforeEarliest =
      earliestY > 0 && earliestM > 0 && targetY * 12 + targetM < earliestY * 12 + earliestM;

    if (lockedSet.has(targetCode) || isBeforeEarliest) {
      originalPeriodCode = targetCode;
      advancedFromLocked = true;
      if (isBeforeEarliest) {
        targetM = earliestM;
        targetY = earliestY;
      }
      for (let steps = 0; steps < 24 && lockedSet.has(`${String(targetM).padStart(2, '0')}/${targetY}`); steps++) {
        targetM++;
        if (targetM > 12) {
          targetM = 1;
          targetY++;
        }
      }
      targetCode = `${String(targetM).padStart(2, '0')}/${targetY}`;
    }

    let dupStatus: ReconcilerParsedRow['duplicateStatus'] = 'NEW_ENTRY';
    let matchedItemId: number | undefined;
    let matchedItemLabel: string | undefined;
    for (const ex of req.existingItems ?? []) {
      const sameAmt = ex.amountRp === amountRp;
      const sameDate = (ex.dateIso || '').slice(0, 10) === dateIso;
      if (sameAmt && ex.label.toLowerCase().includes(desc.toLowerCase())) {
        dupStatus = 'EXACT_MATCH';
        matchedItemId = ex.id;
        matchedItemLabel = ex.label;
        break;
      }
      if (sameAmt && sameDate) {
        dupStatus = 'AMOUNT_DATE_MATCH';
        matchedItemId = ex.id;
        matchedItemLabel = ex.label;
        break;
      }
    }

    if (dupStatus === 'NEW_ENTRY') newCount++;
    else dupCount++;
    totalAmt += amountRp;

    rows.push({
      lineNumber: idx + 1,
      rawLine: line,
      dateIso,
      description: desc,
      amountRp,
      instrument: inst,
      inferredCategory: cat,
      targetPeriodMonth: targetM,
      targetPeriodYear: targetY,
      targetPeriodCode: targetCode,
      ...(originalPeriodCode ? { originalPeriodCode } : {}),
      advancedFromLocked,
      crossedCutoff: routed.crossedCutoff,
      duplicateStatus: dupStatus,
      ...(matchedItemId !== undefined ? { matchedItemId } : {}),
      ...(matchedItemLabel !== undefined ? { matchedItemLabel } : {}),
    });
  }

  return {
    totalLines: lines.length,
    parsedCount: rows.length,
    newEntryCount: newCount,
    duplicateCount: dupCount,
    totalAmountRp: totalAmt,
    rows,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Engine 9: Safe Formula DSL & Reserved Words Evaluator
// ───────────────────────────────────────────────────────────────────────────

export const RESERVED_WORDS_CATALOG = new Set<string>([
  'BASE_SALARY',
  'WORK_DAYS',
  'DAILY_ALLOWANCE',
  'TRANSPORT_ALLOWANCE',
  'FIXED_ADDITIONS',
  'GROSS_PAY',
  'TAX_AND_BPJS',
  'NET_SALARY',
  'TENURE_MONTHS',
  'THR_MULTIPLIER',
  'THR_AMOUNT',
  'NET_INCOME',
  'PAYLATER_DEBT',
  'CC_DEBT',
  'SPINJAM_DEBT',
  'OTHER_DEBT',
  'TOTAL_DEBT',
  'ROUTINE_BILLS',
  'LIVING_BUDGET',
  'P1_FLOOR',
  'P1_SAVINGS',
  'P2_REWARD',
  'ELAPSED_DAYS',
  'CYCLE_DAYS',
  'REMAINING_DAYS',
  'WEEKEND_WEIGHT',
  'WORK_DAYS_PER_WEEK',
  'WORK_HOURS_PER_DAY',
  'COMMUTE_HOURS_PER_DAY',
  'OPTIMAL_DSR_PCT',
  'MAX_SAFE_DSR_PCT',
]);

export interface FormulaEvalResult {
  expression: string;
  valid: boolean;
  valueRp: number;
  valueFloat: number;
  usedTokens: string[];
  error?: string;
}

export interface FormulaSuiteRequest {
  variables: Record<string, number>;
  formulas: Record<string, string>;
}

export interface FormulaSuiteResult {
  allValid: boolean;
  results: Record<string, FormulaEvalResult>;
}

interface DslToken {
  kind:
    | 'EOF'
    | 'NUM'
    | 'VAR'
    | 'IDENT'
    | 'PLUS'
    | 'MINUS'
    | 'MUL'
    | 'DIV'
    | 'LPAREN'
    | 'RPAREN'
    | 'COMMA'
    | 'GT'
    | 'LT'
    | 'GTE'
    | 'LTE'
    | 'EQ'
    | 'NEQ';
  text: string;
  num?: number;
}

function tokenizeDsl(expr: string): DslToken[] {
  const out: DslToken[] = [];
  let i = 0;
  const n = expr.length;
  while (i < n) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '+') {
      out.push({ kind: 'PLUS', text: '+' });
      i++;
    } else if (ch === '-') {
      out.push({ kind: 'MINUS', text: '-' });
      i++;
    } else if (ch === '*') {
      out.push({ kind: 'MUL', text: '*' });
      i++;
    } else if (ch === '/') {
      out.push({ kind: 'DIV', text: '/' });
      i++;
    } else if (ch === '(') {
      out.push({ kind: 'LPAREN', text: '(' });
      i++;
    } else if (ch === ')') {
      out.push({ kind: 'RPAREN', text: ')' });
      i++;
    } else if (ch === ',') {
      out.push({ kind: 'COMMA', text: ',' });
      i++;
    } else if (ch === '>') {
      if (i + 1 < n && expr[i + 1] === '=') {
        out.push({ kind: 'GTE', text: '>=' });
        i += 2;
      } else {
        out.push({ kind: 'GT', text: '>' });
        i++;
      }
    } else if (ch === '<') {
      if (i + 1 < n && expr[i + 1] === '=') {
        out.push({ kind: 'LTE', text: '<=' });
        i += 2;
      } else {
        out.push({ kind: 'LT', text: '<' });
        i++;
      }
    } else if (ch === '=') {
      if (i + 1 < n && expr[i + 1] === '=') {
        out.push({ kind: 'EQ', text: '==' });
        i += 2;
      } else {
        throw new Error(`unexpected '=' at position ${i} (use '==')`);
      }
    } else if (ch === '!') {
      if (i + 1 < n && expr[i + 1] === '=') {
        out.push({ kind: 'NEQ', text: '!=' });
        i += 2;
      } else {
        throw new Error(`unexpected '!' at position ${i}`);
      }
    } else if (ch === '{') {
      const end = expr.indexOf('}', i);
      if (end <= i + 1) {
        throw new Error(`unterminated or empty token at position ${i}`);
      }
      const varName = expr.slice(i + 1, end).trim().toUpperCase();
      out.push({ kind: 'VAR', text: varName });
      i = end + 1;
    } else if (/[0-9.]/.test(ch)) {
      const start = i;
      let seenDot = false;
      while (i < n && /[0-9.]/.test(expr[i])) {
        if (expr[i] === '.') {
          if (seenDot) throw new Error(`invalid number literal near position ${start}`);
          seenDot = true;
        }
        i++;
      }
      const val = Number(expr.slice(start, i));
      if (!Number.isFinite(val)) throw new Error(`invalid number '${expr.slice(start, i)}'`);
      out.push({ kind: 'NUM', text: expr.slice(start, i), num: val });
    } else if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      while (i < n && /[a-zA-Z0-9_]/.test(expr[i])) i++;
      out.push({ kind: 'IDENT', text: expr.slice(start, i).toUpperCase() });
    } else {
      throw new Error(`unexpected character '${ch}' at position ${i}`);
    }
  }
  out.push({ kind: 'EOF', text: '' });
  return out;
}

function evalDslFunc(name: string, args: number[]): number {
  switch (name) {
    case 'ROUND':
      if (args.length === 1) return goRound(args[0]);
      if (args.length === 2) {
        const scale = Math.pow(10, args[1]);
        return goRound(args[0] * scale) / scale;
      }
      throw new Error('ROUND expects 1 or 2 arguments');
    case 'FLOOR':
      if (args.length !== 1) throw new Error('FLOOR expects 1 argument');
      return Math.floor(args[0]);
    case 'CEIL':
      if (args.length !== 1) throw new Error('CEIL expects 1 argument');
      return Math.ceil(args[0]);
    case 'MIN':
      if (args.length < 1) throw new Error('MIN expects at least 1 argument');
      return Math.min(...args);
    case 'MAX':
      if (args.length < 1) throw new Error('MAX expects at least 1 argument');
      return Math.max(...args);
    case 'CLAMP':
      if (args.length !== 3) throw new Error('CLAMP(x, min, max) expects 3 arguments');
      return Math.max(args[1], Math.min(args[2], args[0]));
    case 'IF':
      if (args.length !== 3) throw new Error('IF(cond, thenVal, elseVal) expects 3 arguments');
      return args[0] !== 0 ? args[1] : args[2];
    case 'PCT':
      if (args.length !== 2) throw new Error('PCT(base, pct) expects 2 arguments');
      return args[0] * (args[1] / 100.0);
    default:
      throw new Error(`unsupported function '${name}'`);
  }
}

export function evaluateFormulaDslTs(
  expr: string,
  vars: Record<string, number>,
): FormulaEvalResult {
  const trimmed = (expr || '').trim();
  if (!trimmed) {
    return {
      expression: expr,
      valid: false,
      valueRp: 0,
      valueFloat: 0,
      usedTokens: [],
      error: 'formula expression cannot be empty',
    };
  }
  try {
    const tokens = tokenizeDsl(trimmed);
    const normVars: Record<string, number> = {};
    for (const [k, v] of Object.entries(vars ?? {})) {
      normVars[k.trim().toUpperCase()] = Number(v) || 0;
    }
    const used = new Set<string>();
    let pos = 0;
    const peek = (): DslToken => tokens[pos] ?? { kind: 'EOF', text: '' };
    const next = (): DslToken => tokens[pos++] ?? { kind: 'EOF', text: '' };

    const parsePrimary = (): number => {
      const t = next();
      if (t.kind === 'NUM') return t.num ?? 0;
      if (t.kind === 'VAR') {
        if (!RESERVED_WORDS_CATALOG.has(t.text) && !(t.text in normVars)) {
          throw new Error(`unknown reserved word {${t.text}}`);
        }
        used.add(t.text);
        return normVars[t.text] ?? 0;
      }
      if (t.kind === 'IDENT') {
        if (peek().kind !== 'LPAREN') {
          throw new Error(`unexpected identifier '${t.text}' (wrap reserved words in {...})`);
        }
        next();
        const args: number[] = [];
        if (peek().kind !== 'RPAREN') {
          while (true) {
            args.push(parseComparison());
            if (peek().kind === 'COMMA') {
              next();
              continue;
            }
            break;
          }
        }
        if (next().kind !== 'RPAREN') {
          throw new Error(`missing closing ')' after ${t.text}(`);
        }
        return evalDslFunc(t.text, args);
      }
      if (t.kind === 'LPAREN') {
        const v = parseComparison();
        if (next().kind !== 'RPAREN') throw new Error("missing closing ')'");
        return v;
      }
      throw new Error(`unexpected token '${t.text}'`);
    };

    const parseUnary = (): number => {
      const k = peek().kind;
      if (k === 'PLUS') {
        next();
        return parseUnary();
      }
      if (k === 'MINUS') {
        next();
        return -parseUnary();
      }
      return parsePrimary();
    };

    const parseMulDiv = (): number => {
      let left = parseUnary();
      while (true) {
        const k = peek().kind;
        if (k === 'MUL') {
          next();
          left *= parseUnary();
        } else if (k === 'DIV') {
          next();
          const right = parseUnary();
          if (right === 0) throw new Error('division by zero');
          left /= right;
        } else {
          return left;
        }
      }
    };

    const parseAddSub = (): number => {
      let left = parseMulDiv();
      while (true) {
        const k = peek().kind;
        if (k === 'PLUS') {
          next();
          left += parseMulDiv();
        } else if (k === 'MINUS') {
          next();
          left -= parseMulDiv();
        } else {
          return left;
        }
      }
    };

    const parseComparison = (): number => {
      let left = parseAddSub();
      while (true) {
        const k = peek().kind;
        if (
          k === 'GT' ||
          k === 'LT' ||
          k === 'GTE' ||
          k === 'LTE' ||
          k === 'EQ' ||
          k === 'NEQ'
        ) {
          next();
          const right = parseAddSub();
          let ok = false;
          if (k === 'GT') ok = left > right;
          else if (k === 'LT') ok = left < right;
          else if (k === 'GTE') ok = left >= right;
          else if (k === 'LTE') ok = left <= right;
          else if (k === 'EQ') ok = Math.abs(left - right) < 1e-9;
          else ok = Math.abs(left - right) >= 1e-9;
          left = ok ? 1 : 0;
        } else {
          return left;
        }
      }
    };

    const val = parseComparison();
    if (peek().kind !== 'EOF') {
      throw new Error(`unexpected trailing token '${peek().text}'`);
    }
    if (!Number.isFinite(val)) {
      throw new Error('result is undefined');
    }
    return {
      expression: expr,
      valid: true,
      valueRp: goRound(val),
      valueFloat: round2(val),
      usedTokens: Array.from(used).sort(),
    };
  } catch (err: any) {
    return {
      expression: expr,
      valid: false,
      valueRp: 0,
      valueFloat: 0,
      usedTokens: [],
      error: err?.message || 'invalid formula expression',
    };
  }
}

export function evaluateFormulaSuiteTs(req: FormulaSuiteRequest): FormulaSuiteResult {
  const results: Record<string, FormulaEvalResult> = {};
  let allValid = true;
  for (const [k, expr] of Object.entries(req.formulas ?? {})) {
    const r = evaluateFormulaDslTs(expr, req.variables ?? {});
    if (!r.valid) allValid = false;
    results[k] = r;
  }
  return { allValid, results };
}
