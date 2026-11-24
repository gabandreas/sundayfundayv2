import {
  addHybridMonths,
  daysInMonthCalendarUtc,
  evaluateFormulaSuiteTs,
  FormulaSuiteRequest,
  FormulaSuiteResult,
  resolveCutoffDayForMonthTs,
} from './formula-dsl';

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

const daysInMonthUtc = daysInMonthCalendarUtc;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Engine 1: Paycycle Horizon & Waterfall Formula Engine
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface InstrumentCutoffRule {
  id: string;
  name: string;
  type: 'PAYLATER' | 'CREDIT_CARD' | 'CASH_LOAN' | string;
  cutoffDay: number;
  cutoffFormula?: string;
  cutoffBoundaryInclusive?: boolean;
  preCutoffOffsetMonths?: number;
  postCutoffOffsetMonths?: number;
  dueDay: number;
  dueRule?: 'FIXED_DAY' | 'DISBURSEMENT_DAY' | string;
  dueShiftRule?: 'EXACT_DAY' | 'SHIFT_PREVIOUS_FRIDAY' | string;
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

function addWorkingDaysClampedToMonthUtc(start: Date, lag: number, holidays: Set<string>): Date {
  const d = addWorkingDaysUtc(start, lag, holidays);
  if (lag > 0 && (d.getUTCFullYear() !== start.getUTCFullYear() || d.getUTCMonth() !== start.getUTCMonth())) {
    let lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    while (!isWorkingDayUtc(lastDay, holidays) && lastDay.getTime() > start.getTime()) {
      lastDay = new Date(lastDay.getTime() - 86400000);
    }
    return lastDay;
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
    payday = addWorkingDaysClampedToMonthUtc(payslipDrop, lagDays, holidays);
    shifted = payslipShifted;

    const nextStage1 = resolvePayslipUtc(m, y, pAnchor, shiftRule, holidays);
    nextPayday = addWorkingDaysClampedToMonthUtc(nextStage1.date, lagDays, holidays);
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

  let matched: InstrumentCutoffRule | undefined;
  const activeRules = (req.rules ?? []).filter((r) => r.active);
  if (req.instrumentName) {
    const nameLower = req.instrumentName.toLowerCase();
    matched = activeRules.find((r) => r.name.toLowerCase() === nameLower);
  }
  if (!matched) {
    matched = activeRules.find((r) => {
      const rt = r.type.toUpperCase();
      return (
        rt === instUpper ||
        ((instUpper === 'SPAYLATER' || instUpper === 'PAYLATER') && rt === 'PAYLATER') ||
        ((instUpper === 'CC' || instUpper === 'CREDIT_CARD') && rt === 'CREDIT_CARD') ||
        ((instUpper === 'SPINJAM' || instUpper === 'CASH_LOAN') && rt === 'CASH_LOAN')
      );
    });
  }

  let dueRule = 'FIXED_DAY';
  let cutoffFormula = '';
  let fallbackCutoff = 0;
  let inclusive = false;
  let preOffset = 1;
  let postOffset = 2;
  let dueDay = 0;

  if (instUpper === 'CREDIT_CARD' || instUpper === 'CC') {
    cutoffFormula = '25';
    fallbackCutoff = 25;
    inclusive = false;
    preOffset = 1;
    postOffset = 2;
    dueDay = 11;
  } else if (instUpper === 'CASH_LOAN' || instUpper === 'SPINJAM') {
    dueRule = 'DISBURSEMENT_DAY';
    dueDay = day;
    preOffset = 1;
    postOffset = 1;
  } else {
    cutoffFormula = 'DAYS_IN_MONTH - 15';
    fallbackCutoff = daysInMonthUtc(m, y) - 15;
    inclusive = true;
    preOffset = 0;
    postOffset = 1;
    dueDay = 25;
  }

  if (matched) {
    if (matched.dueRule) dueRule = matched.dueRule;
    if (matched.dueDay > 0) dueDay = matched.dueDay;
    if ((matched.cutoffFormula ?? '').trim() !== '') {
      cutoffFormula = matched.cutoffFormula!.trim();
    } else if (matched.cutoffDay > 0) {
      if ((instUpper === 'PAYLATER' || instUpper === 'SPAYLATER') && matched.cutoffDay === 15) {
        cutoffFormula = 'DAYS_IN_MONTH - 15';
        fallbackCutoff = daysInMonthUtc(m, y) - 15;
      } else {
        cutoffFormula = '';
        fallbackCutoff = matched.cutoffDay;
      }
    }
    if (typeof matched.cutoffBoundaryInclusive === 'boolean') {
      inclusive = matched.cutoffBoundaryInclusive;
    }
    if (typeof matched.preCutoffOffsetMonths === 'number') {
      preOffset = matched.preCutoffOffsetMonths;
    }
    if (typeof matched.postCutoffOffsetMonths === 'number') {
      postOffset = matched.postCutoffOffsetMonths;
    }
  }

  const anchor = !req.anchorDay || req.anchorDay <= 0 ? 27 : req.anchorDay;

  if (instUpper === 'CASH') {
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
    const firstDue = addHybridMonths(m, y, preOffset);
    const dim = daysInMonthUtc(firstDue.month, firstDue.year);
    const clampedDue = Math.min(dueDay, dim);
    return {
      targetPeriodMonth: firstDue.month,
      targetPeriodYear: firstDue.year,
      targetPeriodCode: `${String(firstDue.month).padStart(2, '0')}/${firstDue.year}`,
      maturityMonth: firstDue.month,
      maturityYear: firstDue.year,
      dueDay: clampedDue,
      cutoffDay: 0,
      crossedCutoff: false,
      explanation: `Disbursement-day loan on day ${day} matures ${String(firstDue.month).padStart(2, '0')}/${firstDue.year} on day ${clampedDue} -> Period ${String(firstDue.month).padStart(2, '0')}/${firstDue.year}.`,
    };
  }

  const { cutoffDay } = resolveCutoffDayForMonthTs(
    cutoffFormula,
    fallbackCutoff,
    day,
    m,
    y,
    dueDay,
    anchor,
  );
  const crossed = inclusive ? day >= cutoffDay : day > cutoffDay;
  const offset = crossed ? postOffset : preOffset;
  const target = addHybridMonths(m, y, offset);
  const dim = daysInMonthUtc(target.month, target.year);
  const clampedDue = Math.min(dueDay, dim);
  const label = instUpper === 'CREDIT_CARD' || instUpper === 'CC' ? 'Credit Card' : 'PayLater';
  return {
    targetPeriodMonth: target.month,
    targetPeriodYear: target.year,
    targetPeriodCode: `${String(target.month).padStart(2, '0')}/${target.year}`,
    maturityMonth: target.month,
    maturityYear: target.year,
    dueDay: clampedDue,
    cutoffDay,
    crossedCutoff: crossed,
    explanation: `${label} tx on day ${day} (cutoff ${cutoffDay}) matures ${clampedDue}/${String(target.month).padStart(2, '0')}/${target.year} -> Period ${String(target.month).padStart(2, '0')}/${target.year}.`,
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Engine 2: Double-Entry Net Worth & Asset Reservoirs Engine
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Engine 3: 12-Month Deterministic & Stress-Test Wealth Forecaster
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Engine 4: Spending Velocity, Anomaly & Post-Cutoff Creep Detector
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Engine 5: Zero-Based Envelope Rollover, Sinking Funds & Age of Money
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Engine 6: Debt Payoff Strategy Optimizer
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Engine 7: True Hourly Wage & Life-Energy Work-Hours Translator
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Engine 8: Statement / Mutation Bulk Parser & Auto-Reconciler
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  skippedCreditCount: number;
  totalAmountRp: number;
  rows: ReconcilerParsedRow[];
}

function inferInst(line: string, defInst: string): string {
  const lower = line.toLowerCase();
  if (lower.includes('spaylater') || lower.includes('paylater') || lower.includes('bnpl')) {
    return 'PAYLATER';
  }
  if (
    lower.includes('permata credit') ||
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
    lower.includes('permata') ||
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
    lower.includes('listrik') ||
    lower.includes('pln') ||
    lower.includes('pdam') ||
    lower.includes('token')
  ) {
    return 'UTILITIES';
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

const MAX_RECONCILER_ROWS = 500;
const RECON_ISO_DATE_RX = /\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/;
const RECON_DMY_DATE_RX = /\b(\d{1,2})[-/](\d{1,2})(?:[-/](20\d{2}))?\b/;
const RECON_AMOUNT_RX =
  /(?:Rp\.?\s*|IDR\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{4,9}(?:[.,]\d{2})?)\b(?:\s*(?:DB|CR))?/g;
const RECON_RP_PREFIX_RX = /\b(?:rp|idr)\.?\s*[\d.,]+/gi;
const RECON_CREDIT_MARKER_RX =
  /(?:^\s*(?:rp\.?\s*|idr\s*)?\d[\d.,]*\s*(?:CR|KREDIT|CREDIT)\s*$|\d\s*CR\b|\bCR\s*$|\bTRSF E-BANKING CR\b|\bBI-FAST CR\b|\bMUTASI KREDIT\b)/i;
const RECON_DEBIT_CELL_RX = /^\s*(?:rp\.?\s*|idr\s*)?\d[\d.,]*\s*(?:DB|DEBET|DEBIT)\s*$/i;
const RECON_ACCOUNT_MASK_RX = /\b\d{10,16}\b/g;
const RECON_TRAILING_CENTS_RX = /[.,]\d{2}$/;
const RECON_BRANCH_ZERO_RX = /^\d{4}$/;

function maskAccountNumbersTs(text: string): string {
  return text.replace(RECON_ACCOUNT_MASK_RX, (m) => `****${m.slice(-4)}`);
}

function parseAmountRpTs(token: string): number {
  let upper = token.trim().toUpperCase();
  upper = upper.replace(/(?:DB|CR)$/i, '').trim();
  upper = upper.replace(/^(?:IDR|RP)\.?/i, '').trim();
  if (RECON_TRAILING_CENTS_RX.test(upper)) {
    upper = upper.slice(0, -3);
  }
  const clean = upper.replace(/\D/g, '');
  return clean ? parseInt(clean, 10) : 0;
}

function splitLogicalRecordsTs(rawText: string): string[] {
  const normalized = (rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      cur += ch;
      continue;
    }
    if (ch === '\n') {
      if (inQuotes) {
        cur += ' ';
      } else {
        records.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0) records.push(cur);
  return records;
}

function parseCsvCellsTs(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function splitRowCellsTs(line: string): { cells: string[]; formatKind: string } {
  if (line.includes('|')) {
    return { cells: line.split('|').map((c) => c.trim()), formatKind: 'PIPE' };
  }
  if (line.includes('\t')) {
    return { cells: line.split('\t').map((c) => c.trim()), formatKind: 'TSV' };
  }
  if (line.includes(',')) {
    const cells = parseCsvCellsTs(line);
    if (cells.length >= 2) return { cells, formatKind: 'CSV' };
  }
  return { cells: [], formatKind: 'PLAIN' };
}

function isMetadataOrFooterRowTs(line: string, cells: string[]): boolean {
  const lower = line.trim().toLowerCase();
  const firstCell =
    cells.length > 0 ? cells[0].trim().replace(/^["']+|["']+$/g, '').toLowerCase() : lower;
  const prefixes = [
    '#',
    'date,',
    'tanggal',
    'no. rekening',
    'no rekening',
    'account number',
    'account no',
    'nama',
    'periode',
    'mata uang',
    'currency',
    'saldo awal',
    'mutasi kredit',
    'mutasi debet',
    'mutasi debit',
    'saldo akhir',
    'starting balance',
    'ending balance',
    'total debet',
    'total debit',
    'total kredit',
    'total credit',
  ];
  return prefixes.some((p) => lower.startsWith(p) || firstCell.startsWith(p));
}

function extractDateIsoTs(text: string, defYear: number): { dateIso: string; dateMatchStr: string } {
  const cleaned = text.trim().replace(/^'+/, '');
  const mIso = RECON_ISO_DATE_RX.exec(cleaned);
  if (mIso) {
    return {
      dateIso: `${String(Number(mIso[1])).padStart(4, '0')}-${String(Number(mIso[2])).padStart(2, '0')}-${String(Number(mIso[3])).padStart(2, '0')}`,
      dateMatchStr: mIso[0],
    };
  }
  const mDmy = RECON_DMY_DATE_RX.exec(cleaned);
  if (mDmy) {
    const dy = Number(mDmy[1]);
    const mo = Number(mDmy[2]);
    const yr = mDmy[3] ? Number(mDmy[3]) : defYear;
    if (mo >= 1 && mo <= 12 && dy >= 1 && dy <= 31) {
      return {
        dateIso: `${String(yr).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(dy).padStart(2, '0')}`,
        dateMatchStr: mDmy[0],
      };
    }
  }
  return { dateIso: new Date().toISOString().slice(0, 10), dateMatchStr: '' };
}

export function parseStatementBatchTs(req: ReconcilerParseRequest): ReconcilerParseResult {
  const defYear = req.defaultYear < 2020 ? new Date().getFullYear() : req.defaultYear;
  const anchor = req.anchorDay <= 0 ? 27 : req.anchorDay;
  const defMethod = (req.defaultMethod || '').trim().toUpperCase() || 'CASH';

  const lockedSet = new Set<string>(
    (req.lockedPeriodCodes ?? []).map((c) => c.trim()).filter(Boolean),
  );
  let maxLockedSerial = 0;
  for (const code of lockedSet) {
    const parts = code.split('/');
    if (parts.length === 2) {
      const lm = parseInt(parts[0], 10);
      const ly = parseInt(parts[1], 10);
      if (Number.isFinite(lm) && Number.isFinite(ly) && lm >= 1 && lm <= 12) {
        const ser = ly * 12 + lm;
        if (ser > maxLockedSerial) maxLockedSerial = ser;
      }
    }
  }

  const lines = splitLogicalRecordsTs(req.rawText);
  const rows: ReconcilerParsedRow[] = [];
  let totalAmt = 0;
  let newCount = 0;
  let dupCount = 0;
  let skippedCreditCount = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    if (rows.length >= MAX_RECONCILER_ROWS) break;
    const line = lines[idx].trim();
    if (!line) continue;

    const { cells, formatKind } = splitRowCellsTs(line);
    if (isMetadataOrFooterRowTs(line, cells)) continue;

    let dateIso = '';
    let dateMatchStr = '';
    let amountRp = 0;
    let desc = '';
    let isCreditInflow = false;

    if (formatKind !== 'PLAIN' && cells.length >= 2) {
      let dateColIdx = -1;
      for (let ci = 0; ci < cells.length; ci++) {
        const cClean = cells[ci].trim().replace(/^'+/, '');
        if (cClean.toUpperCase() === 'PEND') {
          dateColIdx = ci;
          dateIso = new Date().toISOString().slice(0, 10);
          break;
        }
        const extracted = extractDateIsoTs(cClean, defYear);
        if (extracted.dateMatchStr) {
          dateColIdx = ci;
          dateIso = extracted.dateIso;
          dateMatchStr = extracted.dateMatchStr;
          break;
        }
      }
      if (dateColIdx === -1) {
        dateIso = new Date().toISOString().slice(0, 10);
      }

      let amountColIdx = -1;
      for (let ci = 0; ci < cells.length; ci++) {
        if (ci === dateColIdx) continue;
        const cellTrim = cells[ci].trim();
        if (RECON_CREDIT_MARKER_RX.test(cellTrim)) {
          isCreditInflow = true;
          amountColIdx = ci;
          break;
        }
        if (RECON_DEBIT_CELL_RX.test(cellTrim)) {
          const matches = Array.from(cellTrim.matchAll(RECON_AMOUNT_RX));
          if (matches.length > 0) {
            const parsed = parseAmountRpTs(matches[matches.length - 1][1] || '');
            if (parsed > 0) {
              amountRp = parsed;
              amountColIdx = ci;
              break;
            }
          }
        }
      }

      if (isCreditInflow) {
        skippedCreditCount++;
        continue;
      }

      if (amountColIdx === -1) {
        for (let ci = cells.length - 1; ci >= 0; ci--) {
          if (ci === dateColIdx) continue;
          const cellTrim = cells[ci].trim();
          if (RECON_BRANCH_ZERO_RX.test(cellTrim)) continue;
          const matches = Array.from(cellTrim.matchAll(RECON_AMOUNT_RX));
          if (matches.length > 0) {
            const parsed = parseAmountRpTs(matches[matches.length - 1][1] || '');
            if (parsed > 0) {
              amountRp = parsed;
              amountColIdx = ci;
              break;
            }
          }
        }
      }

      if (amountRp <= 0) continue;

      const descParts: string[] = [];
      for (let ci = 0; ci < cells.length; ci++) {
        if (ci === dateColIdx || ci === amountColIdx) continue;
        const trimmedCell = cells[ci].trim();
        if (
          amountColIdx !== -1 &&
          ci > amountColIdx &&
          new RegExp(RECON_AMOUNT_RX.source).test(trimmedCell)
        ) {
          continue;
        }
        if (RECON_BRANCH_ZERO_RX.test(trimmedCell)) continue;
        if (trimmedCell) descParts.push(trimmedCell);
      }
      desc = maskAccountNumbersTs(descParts.join(' ')).replace(/\s+/g, ' ').trim();
      if (!desc) desc = 'Imported Statement Entry';
    } else {
      if (RECON_CREDIT_MARKER_RX.test(line)) {
        skippedCreditCount++;
        continue;
      }
      const extracted = extractDateIsoTs(line, defYear);
      dateIso = extracted.dateIso;
      dateMatchStr = extracted.dateMatchStr;

      const cleanedForAmount = maskAccountNumbersTs(
        dateMatchStr ? line.replace(dateMatchStr, ' ') : line,
      );
      const matches = Array.from(cleanedForAmount.matchAll(RECON_AMOUNT_RX));
      let amtToken = '';
      if (matches.length > 0) {
        const last = matches[matches.length - 1];
        amountRp = parseAmountRpTs(last[1] || '');
        amtToken = last[0];
      }
      if (amountRp <= 0) continue;

      desc = cleanedForAmount;
      if (amtToken) {
        desc = desc.replace(RECON_RP_PREFIX_RX, ' ').replace(amtToken, ' ');
      }
      desc = desc.replace(/[,;|\t]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!desc) desc = 'Imported Statement Entry';
    }

    const safeRawLine = maskAccountNumbersTs(line);
    const inst = inferInst(safeRawLine, defMethod);
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
    const isBeforeOrAtMaxLocked = maxLockedSerial > 0 && targetY * 12 + targetM <= maxLockedSerial;

    if (lockedSet.has(targetCode) || isBeforeEarliest || isBeforeOrAtMaxLocked) {
      originalPeriodCode = targetCode;
      advancedFromLocked = true;
      if (
        isBeforeEarliest &&
        !(maxLockedSerial > 0 && earliestY * 12 + earliestM <= maxLockedSerial)
      ) {
        targetM = earliestM;
        targetY = earliestY;
      }
      for (
        let steps = 0;
        steps < 24 &&
        (lockedSet.has(`${String(targetM).padStart(2, '0')}/${targetY}`) ||
          (maxLockedSerial > 0 && targetY * 12 + targetM <= maxLockedSerial));
        steps++
      ) {
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
      rawLine: safeRawLine,
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
    skippedCreditCount,
    totalAmountRp: totalAmt,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Engine 10: Concurrent Monte Carlo Cashflow Stress Test (Go <-> TS Parity)
// ---------------------------------------------------------------------------

export interface MonteCarloPeriodInput {
  label: string;
  incomeRp: number;
  debtDueRp: number;
  fixedBillsRp: number;
  livingTargetRp: number;
  savingsTargetRp: number;
}

export interface MonteCarloRequest {
  startingLiquidAssetsRp: number;
  startingSavingsRp: number;
  emergencyFundTargetRp: number;
  incomeVolatilityPct: number;
  expenseShockProbPct: number;
  expenseShockMagnitudePct: number;
  unexpectedEmergencyProbPct: number;
  unexpectedEmergencyCostRp: number;
  trials?: number;
  seed?: number;
  periods: MonteCarloPeriodInput[];
}

export interface MonteCarloFanPoint {
  label: string;
  p10Rp: number;
  p50Rp: number;
  p90Rp: number;
  shortfallRiskPct: number;
}

export interface MonteCarloResult {
  trialsRun: number;
  workerGoroutines: number;
  computeDurationUs: number;
  survivalProbabilityPct: number;
  emergencyGoalProbabilityPct: number;
  p5WorstCaseCashFloorRp: number;
  p10EndingWealthRp: number;
  p50MedianEndingWealthRp: number;
  p90EndingWealthRp: number;
  recommendedExtraBufferMonthlyRp: number;
  fanSeries: MonteCarloFanPoint[];
}

const MC_MASK_64 = (1n << 64n) - 1n;
const MC_STEP = 0x9e3779b97f4a7c15n;
const MC_MUL1 = 0xbf58476d1ce4e5b9n;
const MC_MUL2 = 0x94d049bb133111ebn;
const MC_POW53 = 9007199254740992;

function nextU64(state: { v: bigint }): bigint {
  state.v = (state.v + MC_STEP) & MC_MASK_64;
  let z = state.v;
  z = ((z ^ (z >> 30n)) * MC_MUL1) & MC_MASK_64;
  z = ((z ^ (z >> 27n)) * MC_MUL2) & MC_MASK_64;
  return (z ^ (z >> 31n)) & MC_MASK_64;
}

function nextUnit(state: { v: bigint }): number {
  return Number(nextU64(state) >> 11n) / MC_POW53;
}

function quantileSorted(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  let idx = Math.trunc((sorted.length - 1) * pct);
  if (idx < 0) idx = 0;
  if (idx >= sorted.length) idx = sorted.length - 1;
  return sorted[idx];
}

export function runMonteCarloTs(req: MonteCarloRequest): MonteCarloResult {
  const startedUs = Date.now() * 1000;
  let trials = req.trials ?? 2000;
  if (trials <= 0) trials = 2000;
  if (trials < 200) trials = 200;
  if (trials > 10000) trials = 10000;

  const seed = BigInt(req.seed && req.seed > 0 ? req.seed : 20261123) & MC_MASK_64;
  const periods: MonteCarloPeriodInput[] =
    req.periods && req.periods.length > 0
      ? req.periods
      : [{ label: 'M1', incomeRp: 0, debtDueRp: 0, fixedBillsRp: 0, livingTargetRp: 0, savingsTargetRp: 0 }];

  const volPct = Math.max(0, Math.min(40, Number(req.incomeVolatilityPct) || 0));
  const shockProb = Math.max(0, Math.min(50, Number(req.expenseShockProbPct) || 0));
  const shockMag = Math.max(0, Math.min(50, Number(req.expenseShockMagnitudePct) || 0));
  const emProb = Math.max(0, Math.min(25, Number(req.unexpectedEmergencyProbPct) || 0));
  const emCost = Math.max(0, Math.trunc(Number(req.unexpectedEmergencyCostRp) || 0));
  const numMonths = periods.length;

  const wealthByMonth: number[][] = Array.from({ length: numMonths }, () => new Array(trials).fill(0));
  const shortfallCounts: number[][] = Array.from({ length: numMonths }, () => new Array(trials).fill(0));
  const cashFloors = new Array<number>(trials).fill(0);
  let survCount = 0;
  let emCount = 0;
  const sqrt3 = 1.7320508075688772;

  for (let t = 0; t < trials; t++) {
    const state = {
      v: (seed ^ ((BigInt(t + 1) * MC_STEP) & MC_MASK_64)) & MC_MASK_64,
    };
    let liquid = Math.trunc(Number(req.startingLiquidAssetsRp) || 0);
    let savings = Math.trunc(Number(req.startingSavingsRp) || 0);
    let minCashFloor = liquid;
    let hadDeficit = false;

    for (let m = 0; m < numMonths; m++) {
      const p = periods[m];
      const z = (nextUnit(state) + nextUnit(state) + nextUnit(state) + nextUnit(state) - 2.0) * sqrt3;
      let mult = 1.0 + z * (volPct / 100.0);
      if (mult < 0.25) mult = 0.25;
      else if (mult > 1.75) mult = 1.75;
      const simIncome = Math.max(0, goRound(p.incomeRp * mult));

      const livingRoll = nextUnit(state);
      let shockMult = 1.0;
      if (shockProb > 0 && livingRoll < shockProb / 100.0) {
        const magDraw = nextUnit(state);
        shockMult = 1.0 + (shockMag / 100.0) * (0.5 + 0.5 * magDraw);
      }
      const simLiving = goRound(p.livingTargetRp * shockMult);

      const emRoll = nextUnit(state);
      const emergencyHit = emProb > 0 && emRoll < emProb / 100.0 ? emCost : 0;

      liquid = liquid + simIncome - p.debtDueRp - p.fixedBillsRp - simLiving - emergencyHit;
      if (p.savingsTargetRp > 0 && liquid >= p.savingsTargetRp) {
        savings += p.savingsTargetRp;
        liquid -= p.savingsTargetRp;
      }
      if (liquid < 0) {
        const need = -liquid;
        const draw = Math.min(savings, need);
        if (draw > 0) {
          savings -= draw;
          liquid += draw;
        }
      }
      if (liquid < 0) {
        hadDeficit = true;
        shortfallCounts[m][t] = 1;
      }
      if (liquid < minCashFloor) {
        minCashFloor = liquid;
      }
      wealthByMonth[m][t] = liquid + savings;
    }

    if (!hadDeficit) survCount++;
    if (req.emergencyFundTargetRp > 0) {
      if (savings >= req.emergencyFundTargetRp) emCount++;
    } else if (liquid + savings >= 0) {
      emCount++;
    }
    cashFloors[t] = minCashFloor;
  }

  const fanSeries: MonteCarloFanPoint[] = [];
  for (let m = 0; m < numMonths; m++) {
    const sorted = [...wealthByMonth[m]].sort((a, b) => a - b);
    let sfSum = 0;
    for (let t = 0; t < trials; t++) sfSum += shortfallCounts[m][t];
    fanSeries.push({
      label: periods[m].label,
      p10Rp: quantileSorted(sorted, 0.10),
      p50Rp: quantileSorted(sorted, 0.50),
      p90Rp: quantileSorted(sorted, 0.90),
      shortfallRiskPct: round1((sfSum / trials) * 100),
    });
  }

  cashFloors.sort((a, b) => a - b);
  const p5Floor = quantileSorted(cashFloors, 0.05);
  const lastMonth = fanSeries[numMonths - 1];
  const survPct = round1((survCount / trials) * 100);
  const emPct = round1((emCount / trials) * 100);

  let recBuffer = 0;
  if (survPct < 95 && p5Floor < 0) {
    recBuffer = Math.ceil(-p5Floor / numMonths / 10000) * 10000;
    if (recBuffer < 50000) recBuffer = 50000;
  } else if (survPct < 95) {
    recBuffer = 100000;
  }

  return {
    trialsRun: trials,
    workerGoroutines: 1,
    computeDurationUs: Math.max(1, Date.now() * 1000 - startedUs),
    survivalProbabilityPct: survPct,
    emergencyGoalProbabilityPct: emPct,
    p5WorstCaseCashFloorRp: p5Floor,
    p10EndingWealthRp: lastMonth.p10Rp,
    p50MedianEndingWealthRp: lastMonth.p50Rp,
    p90EndingWealthRp: lastMonth.p90Rp,
    recommendedExtraBufferMonthlyRp: recBuffer,
    fanSeries,
  };
}

// ---------------------------------------------------------------------------
// Engine 11: Pareto Surplus Allocation Frontier Optimizer (Go <-> TS Parity)
// ---------------------------------------------------------------------------

export interface OptimizerDebtSlice {
  title: string;
  remainingRp: number;
  monthlyInstallmentRp: number;
  monthlyInterestPct: number;
  remainingMonths: number;
}

export interface OptimizerGoalSlice {
  title: string;
  targetRp: number;
  allocatedRp: number;
}

export interface AllocationOptRequest {
  monthlySurplusRp: number;
  currentSavingsRp: number;
  emergencyFundTargetRp: number;
  monthlyEssentialsRp: number;
  debts: OptimizerDebtSlice[];
  goals: OptimizerGoalSlice[];
}

export interface OptimalAllocationStrategy {
  code: string;
  title: string;
  debtPrepaymentRp: number;
  emergencyFundRp: number;
  goalSavingsRp: number;
  flexibleRp: number;
  projected12MNetWorthRp: number;
  estimatedInterestSavedRp: number;
  debtMonthsShaved: number;
  emergencyMonthsToTarget: number;
  rationale: string;
}

export interface AllocationOptResult {
  combinationsEvaluated: number;
  workerGoroutines: number;
  computeDurationUs: number;
  strategies: OptimalAllocationStrategy[];
}

function simulateDebtHorizonOpt(
  debts: OptimizerDebtSlice[],
  extraMonthlyPrepayRp: number,
): { monthsToZero: number; totalInterestRp: number; debtAfter12MRp: number } {
  if (!debts || debts.length === 0) {
    return { monthsToZero: 0, totalInterestRp: 0, debtAfter12MRp: 0 };
  }
  const active = debts
    .filter((d) => d.remainingRp > 0)
    .map((d) => {
      let inst = Number(d.monthlyInstallmentRp);
      if (inst <= 0 && d.remainingMonths > 0) {
        inst = d.remainingRp / d.remainingMonths;
      }
      return {
        bal: Number(d.remainingRp),
        inst,
        ratePct: Math.max(0, Number(d.monthlyInterestPct)),
      };
    });
  if (active.length === 0) {
    return { monthsToZero: 0, totalInterestRp: 0, debtAfter12MRp: 0 };
  }
  active.sort((a, b) => {
    if (a.ratePct === b.ratePct) return a.bal - b.bal;
    return b.ratePct - a.ratePct;
  });

  let totalInterest = 0;
  let monthsToZero = 0;
  let debtAfter12MRp = 0;
  const maxMonths = 60;
  for (let m = 1; m <= maxMonths; m++) {
    let totalRem = 0;
    for (let i = 0; i < active.length; i++) {
      if (active[i].bal <= 0.5) {
        active[i].bal = 0;
        continue;
      }
      const interest = active[i].bal * (active[i].ratePct / 100.0);
      totalInterest += interest;
      active[i].bal += interest;
      let pay = active[i].inst;
      if (pay > active[i].bal) pay = active[i].bal;
      active[i].bal -= pay;
    }
    let extra = extraMonthlyPrepayRp;
    for (let i = 0; i < active.length; i++) {
      if (extra <= 0) break;
      if (active[i].bal > 0) {
        const apply = Math.min(extra, active[i].bal);
        active[i].bal -= apply;
        extra -= apply;
      }
    }
    for (let i = 0; i < active.length; i++) totalRem += active[i].bal;
    if (m === 12) debtAfter12MRp = Math.round(totalRem);
    if (totalRem <= 1.0 && monthsToZero === 0) {
      monthsToZero = m;
      if (m <= 12) debtAfter12MRp = 0;
      break;
    }
  }
  if (monthsToZero === 0) monthsToZero = maxMonths;
  return {
    monthsToZero,
    totalInterestRp: Math.round(totalInterest),
    debtAfter12MRp,
  };
}

export function optimizeAllocationFrontierTs(req: AllocationOptRequest): AllocationOptResult {
  const startedUs = Date.now() * 1000;
  const surplus = Math.max(0, Math.trunc(Number(req.monthlySurplusRp) || 0));
  const debts = req.debts ?? [];
  const goals = req.goals ?? [];
  const hasDebt = debts.some((d) => d.remainingRp > 0);

  const grid: Array<{ dPct: number; ePct: number; gPct: number; fPct: number }> = [];
  if (hasDebt) {
    const step = 5;
    for (let d = 0; d <= 100; d += step) {
      for (let e = 0; e <= 100 - d; e += step) {
        for (let g = 0; g <= 100 - d - e; g += step) {
          grid.push({ dPct: d, ePct: e, gPct: g, fPct: 100 - d - e - g });
        }
      }
    }
  } else {
    const step = 2;
    for (let e = 0; e <= 100; e += step) {
      for (let g = 0; g <= 100 - e; g += step) {
        grid.push({ dPct: 0, ePct: e, gPct: g, fPct: 100 - e - g });
      }
    }
  }

  const baseHorizon = simulateDebtHorizonOpt(debts, 0);
  const emergGap = Math.max(0, Math.trunc((req.emergencyFundTargetRp || 0) - (req.currentSavingsRp || 0)));
  let goalGap = 0;
  for (const g of goals) {
    const rem = (g.targetRp || 0) - (g.allocatedRp || 0);
    if (rem > 0) goalGap += rem;
  }

  const evals = grid.map((wt) => {
    const debtRp = Math.trunc((surplus * wt.dPct) / 100);
    const emergRp = Math.trunc((surplus * wt.ePct) / 100);
    const goalRp = Math.trunc((surplus * wt.gPct) / 100);
    const flexRp = surplus - debtRp - emergRp - goalRp;

    const sim = simulateDebtHorizonOpt(debts, debtRp);
    const intSaved = Math.max(0, baseHorizon.totalInterestRp - sim.totalInterestRp);
    const shaved = Math.max(0, baseHorizon.monthsToZero - sim.monthsToZero);

    let emergMonths = 0;
    if (emergGap > 0) {
      emergMonths = emergRp <= 0 ? 999 : Math.ceil(emergGap / emergRp);
    }

    const accumSavings = Math.trunc(req.currentSavingsRp || 0) + 12 * (emergRp + goalRp + flexRp);
    const netWorth12M = accumSavings - sim.debtAfter12MRp;

    const flexScore = Math.min(1.0, wt.fPct / 20.0) * 15.0;
    const emergScore =
      emergGap > 0
        ? Math.min(1.0, (12 * emergRp) / emergGap) * 40.0
        : Math.min(1.0, wt.ePct / 30.0) * 20.0;
    const debtScore =
      hasDebt && baseHorizon.totalInterestRp > 0
        ? (intSaved / baseHorizon.totalInterestRp) * 45.0
        : hasDebt
          ? (shaved / Math.max(1, baseHorizon.monthsToZero)) * 35.0
          : 0;
    const goalScore =
      goalGap > 0
        ? Math.min(1.0, (12 * goalRp) / goalGap) * 30.0
        : Math.min(1.0, wt.gPct / 40.0) * 25.0;

    return {
      debtRp,
      emergRp,
      goalRp,
      flexRp,
      netWorth12MRp: netWorth12M,
      interestSavedRp: intSaved,
      monthsShaved: shaved,
      emergMonths,
      compositeScore: debtScore + emergScore + goalScore + flexScore,
      dPct: wt.dPct,
      ePct: wt.ePct,
      gPct: wt.gPct,
    };
  });

  let bestBalanced = evals[0];
  let bestDebt = evals[0];
  let bestReserve = evals[0];
  for (const c of evals) {
    if (c.compositeScore > bestBalanced.compositeScore) bestBalanced = c;
    if (hasDebt) {
      if (
        c.monthsShaved > bestDebt.monthsShaved ||
        (c.monthsShaved === bestDebt.monthsShaved && c.interestSavedRp > bestDebt.interestSavedRp) ||
        (c.monthsShaved === bestDebt.monthsShaved &&
          c.interestSavedRp === bestDebt.interestSavedRp &&
          c.dPct < bestDebt.dPct)
      ) {
        bestDebt = c;
      }
    } else if (c.goalRp > bestDebt.goalRp || (c.goalRp === bestDebt.goalRp && c.emergRp > bestDebt.emergRp)) {
      bestDebt = c;
    }
    if (
      c.emergMonths < bestReserve.emergMonths ||
      (c.emergMonths === bestReserve.emergMonths && c.emergRp > bestReserve.emergRp)
    ) {
      bestReserve = c;
    }
  }

  const balancedRationale =
    hasDebt && emergGap > 0
      ? `Balances ${bestBalanced.dPct}% debt reduction with ${bestBalanced.ePct}% emergency reserve funding and flexible headroom.`
      : hasDebt
        ? `Combines ${bestBalanced.dPct}% interest-saving prepayment with steady goal accumulation.`
        : `Splits surplus across ${bestBalanced.ePct}% reserve protection and ${bestBalanced.gPct}% personal goals.`;

  const secondStrategy: OptimalAllocationStrategy = hasDebt
    ? {
        code: 'FASTEST_DEBT_FREE',
        title: 'Fastest Debt Payoff',
        debtPrepaymentRp: bestDebt.debtRp,
        emergencyFundRp: bestDebt.emergRp,
        goalSavingsRp: bestDebt.goalRp,
        flexibleRp: bestDebt.flexRp,
        projected12MNetWorthRp: bestDebt.netWorth12MRp,
        estimatedInterestSavedRp: bestDebt.interestSavedRp,
        debtMonthsShaved: bestDebt.monthsShaved,
        emergencyMonthsToTarget: bestDebt.emergMonths,
        rationale: `Directs ${bestDebt.dPct}% of monthly surplus to highest-rate debt, cutting ${bestDebt.monthsShaved} months off payoff.`,
      }
    : {
        code: 'GOAL_ACCELERATOR',
        title: 'Goal Accelerator',
        debtPrepaymentRp: bestDebt.debtRp,
        emergencyFundRp: bestDebt.emergRp,
        goalSavingsRp: bestDebt.goalRp,
        flexibleRp: bestDebt.flexRp,
        projected12MNetWorthRp: bestDebt.netWorth12MRp,
        estimatedInterestSavedRp: 0,
        debtMonthsShaved: 0,
        emergencyMonthsToTarget: bestDebt.emergMonths,
        rationale: `Debt-free allocation channeling ${bestDebt.gPct}% directly toward active savings goals.`,
      };

  const reserveRationale =
    emergGap <= 0
      ? 'Emergency fund target already met; keeps liquidity topped up while compounding net savings.'
      : `Closes your emergency fund gap in ~${bestReserve.emergMonths} months at ${bestReserve.ePct}% reserve allocation.`;

  return {
    combinationsEvaluated: grid.length,
    workerGoroutines: 1,
    computeDurationUs: Math.max(1, Date.now() * 1000 - startedUs),
    strategies: [
      {
        code: 'BALANCED_RESILIENCE',
        title: 'Balanced Resilience',
        debtPrepaymentRp: bestBalanced.debtRp,
        emergencyFundRp: bestBalanced.emergRp,
        goalSavingsRp: bestBalanced.goalRp,
        flexibleRp: bestBalanced.flexRp,
        projected12MNetWorthRp: bestBalanced.netWorth12MRp,
        estimatedInterestSavedRp: bestBalanced.interestSavedRp,
        debtMonthsShaved: bestBalanced.monthsShaved,
        emergencyMonthsToTarget: bestBalanced.emergMonths,
        rationale: balancedRationale,
      },
      secondStrategy,
      {
        code: 'FASTEST_RESERVE',
        title: 'Fastest Emergency Reserve',
        debtPrepaymentRp: bestReserve.debtRp,
        emergencyFundRp: bestReserve.emergRp,
        goalSavingsRp: bestReserve.goalRp,
        flexibleRp: bestReserve.flexRp,
        projected12MNetWorthRp: bestReserve.netWorth12MRp,
        estimatedInterestSavedRp: bestReserve.interestSavedRp,
        debtMonthsShaved: bestReserve.monthsShaved,
        emergencyMonthsToTarget: bestReserve.emergMonths,
        rationale: reserveRationale,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Batch Dispatcher: 8-Engine Parallel Intelligence Bundle
// ---------------------------------------------------------------------------

export interface IntelligenceBatchRequest {
  paycycle: PaycycleHorizonRequest;
  networth: NetWorthRequest;
  forecaster: ForecasterRequest;
  anomaly: AnomalyRequest;
  envelopes: EnvelopesRequest;
  debtopt: DebtOptRequest;
  lifeenergy: LifeEnergyRequest;
  formula: FormulaSuiteRequest;
}

export interface IntelligenceBatchResult {
  paycycle: PaycycleHorizonResult;
  networth: NetWorthResult;
  forecaster: ForecasterResult;
  anomaly: AnomalyResult;
  envelopes: EnvelopesResult;
  debtopt: DebtOptResult;
  lifeenergy: LifeEnergyResult;
  formula: FormulaSuiteResult;
  workerGoroutines: number;
  computeDurationUs: number;
}

export function runIntelligenceBatchTs(req: IntelligenceBatchRequest): IntelligenceBatchResult {
  const startedUs = Date.now() * 1000;
  return {
    paycycle: computePaycycleHorizonTs(req.paycycle),
    networth: computeNetWorthTs(req.networth),
    forecaster: runForecastTs(req.forecaster),
    anomaly: evaluateAnomaliesTs(req.anomaly),
    envelopes: evaluateEnvelopesTs(req.envelopes),
    debtopt: optimizeDebtPayoffTs(req.debtopt),
    lifeenergy: computeLifeEnergyTs(req.lifeenergy),
    formula: evaluateFormulaSuiteTs(req.formula),
    workerGoroutines: 1,
    computeDurationUs: Math.max(1, Date.now() * 1000 - startedUs),
  };
}

export * from './formula-dsl';
