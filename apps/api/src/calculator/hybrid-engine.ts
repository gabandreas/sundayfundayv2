import {
  addHybridMonths,
  daysInMonthCalendarUtc,
  resolveCutoffDayForMonthTs,
} from './formula-dsl';
export { addHybridMonths, daysInMonthCalendarUtc, resolveCutoffDayForMonthTs };

export type HybridInstrument =
  | 'SPAYLATER'
  | 'CREDIT_CARD'
  | 'SPINJAM'
  | 'PERSONAL_DEBT'
  | 'CASH';

export type HybridAmountMode = 'PRINCIPAL_SPLIT' | 'FIXED_MONTHLY';

export interface CutoffSimulateRequest {
  title?: string;
  instrument: HybridInstrument;
  amountMode?: HybridAmountMode;
  principalAmount: number;
  monthlyAmount?: number;
  tenorMonths: number;
  purchaseDate?: string; // YYYY-MM-DD
  dueDayOverride?: number;
  cutoffFormula?: string;
  cutoffBoundaryInclusive?: boolean;
  preCutoffOffsetMonths?: number;
  postCutoffOffsetMonths?: number;
  dueShiftRule?: string;
  anchorDay?: number;
  holdPastCutoff?: boolean;
  startMonthOverride?: number;
  startYearOverride?: number;
  periodNetIncome?: number;
  currentPeriodObligations?: number;
  nextPeriodObligations?: number;
  nextPeriodNetIncome?: number;
  safeHeadroom?: number;
}

export interface CutoffScheduleSlice {
  index: number;
  totalTenor: number;
  sliceBadge: string;
  periodMonth: number;
  periodYear: number;
  periodLabel: string;
  dueMonth: number;
  dueYear: number;
  dueDay: number;
  dueDateIso: string;
  amount: number;
}

export interface CutoffSimulateResult {
  instrument: HybridInstrument;
  amountMode: HybridAmountMode;
  totalPrincipal: number;
  monthlySliceFirst: number;
  monthlySliceLast: number;
  tenorMonths: number;
  cutoffDay: number;
  dueDay: number;
  crossedCutoff: boolean;
  startPeriodMonth: number;
  startPeriodYear: number;
  startPeriodLabel: string;
  firstDueMonth: number;
  firstDueYear: number;
  firstDueDateIso: string;
  endPeriodMonth: number;
  endPeriodYear: number;
  endPeriodLabel: string;
  dsrBeforePercent: number;
  dsrAfterPercent: number;
  nextDsrAfterPercent: number;
  safeHeadroomRemaining: number;
  daysUntilCutoff: number;
  verdict: 'SAFE' | 'CAUTION' | 'WAIT_PAST_CUTOFF' | 'OVER_LIMIT';
  advice: string;
  routingSummary: string;
  slices: CutoffScheduleSlice[];
}

export interface CashflowWaveInput {
  dateIso: string;
  label: string;
  category: 'INFLOW' | 'LIABILITY' | 'ROUTINE' | 'LIVING' | 'SAVINGS';
  amount: number;
  isConfirmed?: boolean;
}

export interface TimelineSimulateRequest {
  periodMonth: number;
  periodYear: number;
  paycheckDateIso: string;
  paycheckAmount: number;
  thrDateIso?: string;
  thrAmount?: number;
  nextPaycheckDateIso?: string;
  nextPaycheckAmount?: number;
  totalPaylaterDue: number;
  paylaterDueDateIso: string;
  totalCreditCardDue: number;
  creditCardDueDateIso: string;
  totalPersonalDebtDue: number;
  personalDebtDueDateIso: string;
  personalDebtItems?: CashflowWaveInput[];
  dailyLivingPool: number;
  routineBillsPool: number;
  coreSavingsTarget: number;
  spaylaterEarlyPayAmount?: number;
  customEvents?: CashflowWaveInput[];
}

export interface TimelineEvent {
  sequence: number;
  dateIso: string;
  label: string;
  category: string;
  waveGroup: string;
  signedAmount: number;
  runningBalance: number;
  isBridgeWindow: boolean;
  notes: string;
}

export interface TimelineSimulateResult {
  events: TimelineEvent[];
  wave1AvailableCash: number;
  preThrBridgeMinimumBalance: number;
  postThrBalance: number;
  postPaylaterRemainingBalance: number;
  spaylaterEarlyPayApplied: number;
  spaylaterRemainingAfterEarly: number;
  bridgeSafe: boolean;
  bridgeRiskMessage: string;
}

export interface WalletGuardRequest {
  remainingLivingCash: number;
  actualWalletBalance: number;
  reservedBillsTotal: number;
  daysRemaining: number;
  remainingWeekdays: number;
  remainingWeekendDays: number;
  weekendMultiplier?: number;
  isWeekendToday?: boolean;
}

export interface WalletGuardResult {
  remainingLivingCash: number;
  actualWalletBalance: number;
  reservedBillsTotal: number;
  freeSpendableCash: number;
  varianceVsLedger: number;
  guardStatus: 'OPTIMAL' | 'WATCH' | 'SURVIVAL_GUARD';
  effectiveLivingBase: number;
  dailySafeFlat: number;
  dailySafeWeekday: number;
  dailySafeWeekend: number;
  safeToSpendToday: number;
  guidance: string;
}

export interface HorizonPeriodMetricInput {
  month: number;
  year: number;
  periodLabel: string;
  finalTotalIncome: number;
  totalDebt: number;
  fixedEssentials: number;
  actualDailyOperational: number;
  bufferPocket: number;
  actualSavings: number;
  selfReward: number;
  deficitUncovered: number;
  daysInCycle: number;
}

export interface HorizonContractSummaryInput {
  id: string;
  title: string;
  category: string;
  merchantOrPlatform: string;
  monthlyInstallment: number;
  principalAmount: number;
  remainingPrincipal: number;
  remainingSlices: number;
  totalTenor: number;
  payoffMonth: number;
  payoffYear: number;
  payoffDateLabel: string;
}

export interface CashRadarSubItem {
  title: string;
  amountRp: number;
  sliceLabel: string;
}

export interface CashRadarTxInput {
  id: number;
  dateIso: string;
  label: string;
  type: string;
  sourceType: string;
  amountRp: number;
  insideAllocatedPool: boolean;
}

export interface CashRadarItemInput {
  dateIso: string;
  title: string;
  category: string;
  amountRp: number;
  dueDay: number;
  sliceLabel?: string;
  isFinalSlice?: boolean;
}

export interface CashRadarRequest {
  periodMonth: number;
  periodYear: number;
  paydayDateIso: string;
  livingEndDateIso: string;
  nextPaydayIso: string;
  paycheckAmountRp: number;
  thrDateIso?: string;
  thrAmountRp?: number;
  dailyLivingPoolRp: number;
  routineBillsPoolRp: number;
  coreSavingsTargetRp: number;
  paylaterDueRp: number;
  creditCardDueRp: number;
  personalDebtItems?: CashRadarItemInput[];
  loggedTransactions?: CashRadarTxInput[];
  paylaterBreakdown?: CashRadarSubItem[];
  creditCardBreakdown?: CashRadarSubItem[];
  holidaysIso?: string[];
  referenceDateIso?: string;
}

export interface CashRadarEvent {
  id: string;
  dateIso: string;
  nominalDateIso: string;
  isBusinessDayShifted: boolean;
  label: string;
  category: string;
  signedAmountRp: number;
  sliceLabel: string;
  isFinalSlice: boolean;
  notes: string;
  insideAllocatedPool: boolean;
  subItems: CashRadarSubItem[];
}

export interface CashRadarDayPoint {
  dateIso: string;
  dayOfMonth: number;
  inActiveCycle: boolean;
  isToday: boolean;
  isWeekend: boolean;
  openingBalanceRp: number;
  inflowsRp: number;
  outflowsRp: number;
  closingBalanceRp: number;
  events: CashRadarEvent[];
}

export interface CashRadarTrough {
  dateIso: string;
  balanceRp: number;
  contextLabel: string;
  isTightOrDeficit: boolean;
}

export interface CashRadarResult {
  periodMonth: number;
  periodYear: number;
  cycleStartIso: string;
  cycleEndIso: string;
  nextPaydayIso: string;
  paydayInflowsRp: number;
  totalScheduledBillsRp: number;
  endingCashBufferRp: number;
  lowestCashPoint: CashRadarTrough;
  events: CashRadarEvent[];
  dailySeries: CashRadarDayPoint[];
}

export interface ExecutiveHorizonRequest {
  selectedMonth: number;
  selectedYear: number;
  periods: HorizonPeriodMetricInput[];
  contracts: HorizonContractSummaryInput[];
}

export interface FreedCashflowMilestone {
  month: number;
  year: number;
  periodLabel: string;
  freedMonthlyRp: number;
  cumulativeFreedRp: number;
  endingContracts: string[];
}

export interface HorizonPeriodDriver {
  month: number;
  year: number;
  periodLabel: string;
  dsrPercent: number;
  netSavingsRatePct: number;
  effectiveDailyRate: number;
  momDebtDelta: number;
  momIncomeDelta: number;
  narrativeDriver: string;
}

export interface ExecutiveHorizonResult {
  selectedPeriodLabel: string;
  dsrPercent: number;
  netSavingsRatePercent: number;
  debtBurnDownVelocityRp: number;
  effectiveDailyLivingRate: number;
  totalActiveContracts: number;
  totalRemainingPrincipalRp: number;
  nextMilestoneLabel: string;
  freedUpMilestones: FreedCashflowMilestone[];
  periodDrivers: HorizonPeriodDriver[];
}

const MONTH_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

export function formatHybridPeriodLabel(m: number, y: number): string {
  if (m < 1 || m > 12) return `${String(m).padStart(2, '0')}/${y}`;
  return `${MONTH_SHORT[m - 1]} '${String(y % 100).padStart(2, '0')}`;
}

function daysInMonthUtc(m: number, y: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function parseDateParts(iso?: string): { year: number; month: number; day: number; ok: boolean } {
  if (!iso) return { year: 0, month: 0, day: 0, ok: false };
  const datePart = iso.trim().split('T')[0];
  const parts = datePart.split('-').map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return { year: 0, month: 0, day: 0, ok: false };
  }
  const [y, m, d] = parts;
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return { year: 0, month: 0, day: 0, ok: false };
  }
  return { year: y, month: m, day: d, ok: true };
}

export function computeLosslessSlices(
  principalInput: number,
  monthlyInput: number,
  tenorInput: number,
  mode: HybridAmountMode,
): { slices: number[]; totalPrincipal: number } {
  const tenor = Math.max(1, Math.min(60, Math.round(tenorInput || 1)));
  const monthly = Math.max(0, Math.round(monthlyInput || 0));
  const principal = Math.max(0, Math.round(principalInput || 0));

  if (mode === 'FIXED_MONTHLY' && monthly > 0) {
    return {
      slices: Array.from({ length: tenor }, () => monthly),
      totalPrincipal: monthly * tenor,
    };
  }
  if (principal <= 0 && monthly > 0) {
    return {
      slices: Array.from({ length: tenor }, () => monthly),
      totalPrincipal: monthly * tenor,
    };
  }

  const base = Math.trunc(principal / tenor);
  const rem = principal % tenor;
  const slices = Array.from({ length: tenor }, (_, i) => (i < rem ? base + 1 : base));
  return { slices, totalPrincipal: principal };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function isIndonesianHolidayIsoTs(iso: string): boolean {
  return iso === '2026-12-25' || iso === '2027-01-01';
}

export function resolvePreviousBusinessDayIsoTs(
  y: number,
  m: number,
  d: number,
  customHolidays?: Set<string>,
): { earlyIso: string; shifted: boolean } {
  const maxD = daysInMonthUtc(m, y);
  const clampedD = Math.min(Math.max(1, d), maxD);
  let dt = new Date(Date.UTC(y, m - 1, clampedD));
  const fmt = (val: Date) =>
    `${String(val.getUTCFullYear()).padStart(4, '0')}-${String(val.getUTCMonth() + 1).padStart(2, '0')}-${String(val.getUTCDate()).padStart(2, '0')}`;
  const isHol = (isoStr: string) =>
    Boolean(customHolidays?.has(isoStr)) || isIndonesianHolidayIsoTs(isoStr);
  const iso = fmt(dt);
  const dow = dt.getUTCDay();
  if (dow !== 0 && dow !== 6 && !isHol(iso)) {
    return { earlyIso: iso, shifted: false };
  }
  while (true) {
    dt = new Date(dt.getTime() - 86400000);
    const candIso = fmt(dt);
    const candDow = dt.getUTCDay();
    if (candDow !== 0 && candDow !== 6 && !isHol(candIso)) {
      return { earlyIso: candIso, shifted: true };
    }
  }
}

export function simulateCutoffTs(req: CutoffSimulateRequest): CutoffSimulateResult {
  const tenor = Math.max(1, Math.min(60, Math.round(req.tenorMonths || 1)));
  const inst: HybridInstrument = req.instrument || 'SPAYLATER';
  const mode: HybridAmountMode =
    req.amountMode || (req.principalAmount > 0 ? 'PRINCIPAL_SPLIT' : 'FIXED_MONTHLY');

  const { slices: rawAmounts, totalPrincipal } = computeLosslessSlices(
    req.principalAmount,
    req.monthlyAmount ?? 0,
    tenor,
    mode,
  );
  const firstSlice = rawAmounts[0];
  const lastSlice = rawAmounts[tenor - 1];

  const parsed = parseDateParts(req.purchaseDate);
  const pY = parsed.ok ? parsed.year : 2026;
  const pM = parsed.ok ? parsed.month : 11;
  const pD = parsed.ok ? parsed.day : 18;

  let cutoffFormula = '';
  let fallbackCutoff = daysInMonthUtc(pM, pY) - 15;
  let dueDay = 25;
  let inclusive = false;
  let preOffset = 0;
  let postOffset = 1;

  if (inst === 'CREDIT_CARD') {
    cutoffFormula = '25';
    fallbackCutoff = 25;
    inclusive = false;
    preOffset = 1;
    postOffset = 2;
    dueDay = 11;
  } else if (inst === 'SPINJAM' || inst === 'PERSONAL_DEBT') {
    cutoffFormula = '';
    fallbackCutoff = pD;
    inclusive = false;
    preOffset = 1;
    postOffset = 1;
    dueDay = pD;
  } else if (inst === 'CASH') {
    cutoffFormula = '';
    fallbackCutoff = 0;
    inclusive = false;
    preOffset = 0;
    postOffset = 0;
    dueDay = pD;
  } else {
    cutoffFormula = 'DAYS_IN_MONTH - 15';
    fallbackCutoff = daysInMonthUtc(pM, pY) - 15;
    inclusive = true;
    preOffset = 0;
    postOffset = 1;
    dueDay = 25;
  }

  if (req.dueDayOverride && req.dueDayOverride >= 1 && req.dueDayOverride <= 31) {
    dueDay = req.dueDayOverride;
  }
  if (typeof req.cutoffFormula === 'string' && req.cutoffFormula.trim() !== '') {
    cutoffFormula = req.cutoffFormula.trim();
  }
  if (typeof req.cutoffBoundaryInclusive === 'boolean') {
    inclusive = req.cutoffBoundaryInclusive;
  }
  if (typeof req.preCutoffOffsetMonths === 'number') {
    preOffset = req.preCutoffOffsetMonths;
  }
  if (typeof req.postCutoffOffsetMonths === 'number') {
    postOffset = req.postCutoffOffsetMonths;
  }

  const paydayAnchor = req.anchorDay && req.anchorDay > 0 ? req.anchorDay : 27;

  let cutoffDay = fallbackCutoff;
  let crossedCutoff = false;
  let startPeriodM = pM;
  let startPeriodY = pY;
  let daysUntilCutoff = 0;

  if (inst === 'SPINJAM' || inst === 'PERSONAL_DEBT' || inst === 'CASH') {
    const shifted = addHybridMonths(pM, pY, preOffset);
    startPeriodM = shifted.month;
    startPeriodY = shifted.year;
    daysUntilCutoff = 0;
  } else {
    cutoffDay = resolveCutoffDayForMonthTs(
      cutoffFormula,
      fallbackCutoff,
      pD,
      pM,
      pY,
      dueDay,
      paydayAnchor,
    ).cutoffDay;
    crossedCutoff = inclusive ? pD >= cutoffDay : pD > cutoffDay;
    if (crossedCutoff) {
      const shifted = addHybridMonths(pM, pY, postOffset);
      startPeriodM = shifted.month;
      startPeriodY = shifted.year;
      const nextM = addHybridMonths(pM, pY, 1);
      const nextCutoff = resolveCutoffDayForMonthTs(
        cutoffFormula,
        fallbackCutoff,
        1,
        nextM.month,
        nextM.year,
        dueDay,
        paydayAnchor,
      ).cutoffDay;
      daysUntilCutoff = daysInMonthUtc(pM, pY) - pD + nextCutoff;
    } else {
      const shifted = addHybridMonths(pM, pY, preOffset);
      startPeriodM = shifted.month;
      startPeriodY = shifted.year;
      daysUntilCutoff = cutoffDay - pD;
    }
  }

  if (
    req.startMonthOverride &&
    req.startYearOverride &&
    req.startMonthOverride >= 1 &&
    req.startMonthOverride <= 12 &&
    req.startYearOverride >= 2000
  ) {
    startPeriodM = req.startMonthOverride;
    startPeriodY = req.startYearOverride;
  }

  if (req.holdPastCutoff) {
    const shifted = addHybridMonths(startPeriodM, startPeriodY, 1);
    startPeriodM = shifted.month;
    startPeriodY = shifted.year;
    crossedCutoff = true;
  }

  const slices: CutoffScheduleSlice[] = rawAmounts.map((amt, i) => {
    const p = addHybridMonths(startPeriodM, startPeriodY, i);
    const d = p;
    const clampedDay = Math.min(dueDay, daysInMonthUtc(d.month, d.year));
    const dueDateIso = `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    return {
      index: i + 1,
      totalTenor: tenor,
      sliceBadge: `${i + 1}/${tenor}`,
      periodMonth: p.month,
      periodYear: p.year,
      periodLabel: formatHybridPeriodLabel(p.month, p.year),
      dueMonth: d.month,
      dueYear: d.year,
      dueDay: clampedDay,
      dueDateIso,
      amount: amt,
    };
  });

  const firstSliceInfo = slices[0];
  const lastSliceInfo = slices[tenor - 1];

  const netIncome = Math.max(0, Math.round(req.periodNetIncome ?? 0));
  const curObl = Math.max(0, Math.round(req.currentPeriodObligations ?? 0));
  const nextObl = Math.max(0, Math.round(req.nextPeriodObligations ?? 0));
  const nextIncome =
    req.nextPeriodNetIncome && req.nextPeriodNetIncome > 0
      ? Math.round(req.nextPeriodNetIncome)
      : netIncome;

  const dsrBeforePercent = netIncome > 0 ? round1((curObl / netIncome) * 100) : 0;
  const dsrAfterPercent =
    netIncome > 0 ? round1(((curObl + firstSlice) / netIncome) * 100) : 0;
  const nextDsrAfterPercent =
    nextIncome > 0 ? round1(((nextObl + firstSlice) / nextIncome) * 100) : 0;

  const safeHeadroom = Math.round(req.safeHeadroom ?? 0);
  const safeHeadroomRemaining = safeHeadroom - firstSlice;

  let verdict: CutoffSimulateResult['verdict'] = 'SAFE';
  let advice = 'Fits within current period safe debt envelope.';

  if (inst !== 'CASH' && firstSlice > 0) {
    const waitDays =
      inclusive && daysUntilCutoff > 0 ? daysUntilCutoff : daysUntilCutoff + 1;
    const waitAvailable = !crossedCutoff && waitDays > 0 && waitDays <= 5;
    if (safeHeadroom > 0 && firstSlice > safeHeadroom) {
      if (waitAvailable && nextObl + firstSlice < curObl) {
        const nextP = addHybridMonths(
          firstSliceInfo.periodMonth,
          firstSliceInfo.periodYear,
          1,
        );
        verdict = 'WAIT_PAST_CUTOFF';
        advice = `Wait ${waitDays} day(s) past the ${cutoffDay}th cutoff to defer billing into ${formatHybridPeriodLabel(nextP.month, nextP.year)}.`;
      } else {
        verdict = 'OVER_LIMIT';
        advice = `Exceeds safe headroom by Rp ${(firstSlice - safeHeadroom).toLocaleString('id-ID')}. Defer or extend tenor.`;
      }
    } else if (dsrAfterPercent >= 45) {
      if (waitAvailable) {
        const nextP = addHybridMonths(
          firstSliceInfo.periodMonth,
          firstSliceInfo.periodYear,
          1,
        );
        verdict = 'WAIT_PAST_CUTOFF';
        advice = `DSR reaches ${dsrAfterPercent.toFixed(1)}%. Waiting ${waitDays} day(s) past the ${cutoffDay}th cutoff shifts 1st charge to ${formatHybridPeriodLabel(nextP.month, nextP.year)}.`;
      } else {
        verdict = 'CAUTION';
        advice = `First slice lifts DSR to ${dsrAfterPercent.toFixed(1)}% in ${firstSliceInfo.periodLabel}.`;
      }
    } else if (dsrAfterPercent >= 32) {
      verdict = 'CAUTION';
      advice = `Manageable, lifts ${firstSliceInfo.periodLabel} DSR from ${dsrBeforePercent.toFixed(1)}% to ${dsrAfterPercent.toFixed(1)}%.`;
    } else if (crossedCutoff) {
      verdict = 'SAFE';
      advice = `Post-${cutoffDay}th cutoff purchase: bills in ${firstSliceInfo.periodLabel} (due ${firstSliceInfo.dueDateIso}).`;
    }
    const shouldShiftWeekend =
      req.dueShiftRule === 'SHIFT_PREVIOUS_FRIDAY' ||
      (!req.dueShiftRule && inst === 'CREDIT_CARD');
    if (shouldShiftWeekend) {
      const early = resolvePreviousBusinessDayIsoTs(
        firstSliceInfo.dueYear,
        firstSliceInfo.dueMonth,
        firstSliceInfo.dueDay,
      );
      if (early.shifted) {
        advice = `${advice} Pay H-1 business day earlier by ${early.earlyIso} (due ${firstSliceInfo.dueDateIso} falls on a weekend/holiday) to keep 0% interest.`;
      }
    }
  }

  const routingSummary =
    tenor > 1
      ? `${tenor}x slices (${firstSliceInfo.periodLabel} -> ${lastSliceInfo.periodLabel}), 1st due ${firstSliceInfo.dueDateIso}`
      : `${firstSliceInfo.periodLabel} (${firstSliceInfo.sliceBadge}) · ${formatHybridPeriodLabel(pM, pY)} -> ${firstSliceInfo.periodLabel} (due ${firstSliceInfo.dueDateIso})`;

  return {
    instrument: inst,
    amountMode: mode,
    totalPrincipal,
    monthlySliceFirst: firstSlice,
    monthlySliceLast: lastSlice,
    tenorMonths: tenor,
    cutoffDay,
    dueDay,
    crossedCutoff,
    startPeriodMonth: firstSliceInfo.periodMonth,
    startPeriodYear: firstSliceInfo.periodYear,
    startPeriodLabel: firstSliceInfo.periodLabel,
    firstDueMonth: firstSliceInfo.dueMonth,
    firstDueYear: firstSliceInfo.dueYear,
    firstDueDateIso: firstSliceInfo.dueDateIso,
    endPeriodMonth: lastSliceInfo.periodMonth,
    endPeriodYear: lastSliceInfo.periodYear,
    endPeriodLabel: lastSliceInfo.periodLabel,
    dsrBeforePercent,
    dsrAfterPercent,
    nextDsrAfterPercent,
    safeHeadroomRemaining,
    daysUntilCutoff,
    verdict,
    advice,
    routingSummary,
    slices,
  };
}

export function simulateTimelineTs(req: TimelineSimulateRequest): TimelineSimulateResult {
  const earlyPayRaw = Math.round(req.spaylaterEarlyPayAmount ?? 0);
  const earlyApplied = Math.max(0, Math.min(earlyPayRaw, Math.round(req.totalPaylaterDue)));
  const remPaylater = Math.round(req.totalPaylaterDue) - earlyApplied;

  const events: CashflowWaveInput[] =
    req.customEvents && req.customEvents.length > 0
      ? [...req.customEvents]
      : [
          {
            dateIso: req.paycheckDateIso,
            label: 'Wave 1: Monthly Salary Payroll',
            category: 'INFLOW',
            amount: Math.round(req.paycheckAmount),
            isConfirmed: true,
          },
          ...(req.routineBillsPool > 0
            ? [
                {
                  dateIso: req.paycheckDateIso,
                  label: 'Reserve Routine Bills Pool',
                  category: 'ROUTINE' as const,
                  amount: -Math.round(req.routineBillsPool),
                },
              ]
            : []),
          ...(req.dailyLivingPool > 0
            ? [
                {
                  dateIso: req.paycheckDateIso,
                  label: 'Allocate 21-Day Living Bridge Allowance',
                  category: 'LIVING' as const,
                  amount: -Math.round(req.dailyLivingPool),
                },
              ]
            : []),
          ...(earlyApplied > 0
            ? [
                {
                  dateIso: req.paycheckDateIso,
                  label: 'Split-Pay Wave 1: Early SPayLater Set-Aside',
                  category: 'LIABILITY' as const,
                  amount: -earlyApplied,
                },
              ]
            : []),
          ...(req.personalDebtItems && req.personalDebtItems.length > 0
            ? req.personalDebtItems
            : req.totalPersonalDebtDue > 0
              ? [
                  {
                    dateIso: req.personalDebtDueDateIso,
                    label: 'Personal Debt & SPinjam Maturities',
                    category: 'LIABILITY' as const,
                    amount: -Math.round(req.totalPersonalDebtDue),
                  },
                ]
              : []),
          ...(req.totalCreditCardDue > 0
            ? [
                {
                  dateIso: req.creditCardDueDateIso,
                  label: 'Credit Card Statement Due (11th)',
                  category: 'LIABILITY' as const,
                  amount: -Math.round(req.totalCreditCardDue),
                },
              ]
            : []),
          ...(req.thrAmount && req.thrAmount > 0 && req.thrDateIso
            ? [
                {
                  dateIso: req.thrDateIso,
                  label: 'Wave 2: December Natal THR / Windfall',
                  category: 'INFLOW' as const,
                  amount: Math.round(req.thrAmount),
                },
              ]
            : []),
          ...(remPaylater > 0
            ? [
                {
                  dateIso: req.paylaterDueDateIso,
                  label: 'SPayLater Final Settlement (25th)',
                  category: 'LIABILITY' as const,
                  amount: -remPaylater,
                },
              ]
            : []),
          ...(req.coreSavingsTarget > 0
            ? [
                {
                  dateIso: req.thrDateIso || req.paylaterDueDateIso,
                  label: 'Core Savings Transfer',
                  category: 'SAVINGS' as const,
                  amount: -Math.round(req.coreSavingsTarget),
                },
              ]
            : []),
          ...(req.nextPaycheckAmount && req.nextPaycheckAmount > 0 && req.nextPaycheckDateIso
            ? [
                {
                  dateIso: req.nextPaycheckDateIso,
                  label: 'Next Cycle Paycheck Arrival',
                  category: 'INFLOW' as const,
                  amount: Math.round(req.nextPaycheckAmount),
                },
              ]
            : []),
        ];

  events.sort((a, b) => {
    if (a.dateIso === b.dateIso) return b.amount - a.amount;
    return a.dateIso < b.dateIso ? -1 : 1;
  });

  let running = 0;
  let minBridge = Number.MAX_SAFE_INTEGER;
  let postThr = 0;
  let postPaylater = 0;

  const out: TimelineEvent[] = events.map((ev, idx) => {
    running += ev.amount;
    const inBridge = Boolean(req.thrDateIso && ev.dateIso <= req.thrDateIso);
    if (inBridge && running < minBridge) minBridge = running;
    if (ev.dateIso === req.thrDateIso && ev.amount > 0) postThr = running;
    if (ev.dateIso === req.paylaterDueDateIso) postPaylater = running;

    let waveGroup = 'WAVE_1';
    if (req.thrDateIso && ev.dateIso >= req.thrDateIso) waveGroup = 'WAVE_2';
    if (req.nextPaycheckDateIso && ev.dateIso >= req.nextPaycheckDateIso) {
      waveGroup = 'NEXT_CYCLE';
    }

    return {
      sequence: idx + 1,
      dateIso: ev.dateIso,
      label: ev.label,
      category: ev.category,
      waveGroup,
      signedAmount: ev.amount,
      runningBalance: running,
      isBridgeWindow: inBridge,
      notes: `Running cash: Rp ${running.toLocaleString('id-ID')}`,
    };
  });

  if (minBridge === Number.MAX_SAFE_INTEGER) minBridge = running;
  const bridgeSafe = minBridge >= 0;

  return {
    events: out,
    wave1AvailableCash: Math.round(req.paycheckAmount),
    preThrBridgeMinimumBalance: minBridge,
    postThrBalance: postThr,
    postPaylaterRemainingBalance: postPaylater,
    spaylaterEarlyPayApplied: earlyApplied,
    spaylaterRemainingAfterEarly: Math.round(req.totalPaylaterDue) - earlyApplied,
    bridgeSafe,
    bridgeRiskMessage: bridgeSafe
      ? `21-day bridge stays liquid with minimum cash cushion Rp ${minBridge.toLocaleString('id-ID')}.`
      : `Bridge shortage of Rp ${Math.abs(minBridge).toLocaleString('id-ID')} detected before THR wave. Reduce Wave 1 early PayLater paydown.`,
  };
}

export function evaluateWalletGuardTs(req: WalletGuardRequest): WalletGuardResult {
  const remainingLiving = Math.round(req.remainingLivingCash);
  const actualWallet = Math.round(req.actualWalletBalance);
  const reserved = Math.round(req.reservedBillsTotal);
  const freeCash = actualWallet - reserved;
  const variance = freeCash - remainingLiving;

  let effectiveBase = remainingLiving;
  if (actualWallet > 0 && freeCash < effectiveBase) {
    effectiveBase = freeCash;
  }
  if (effectiveBase < 0) effectiveBase = 0;

  const days = Math.max(1, Math.round(req.daysRemaining || 1));
  const mult = req.weekendMultiplier && req.weekendMultiplier > 0 ? req.weekendMultiplier : 1.5;
  const flat = Math.trunc(effectiveBase / days);
  const weightedUnits =
    req.remainingWeekdays + req.remainingWeekendDays * mult > 0
      ? req.remainingWeekdays + req.remainingWeekendDays * mult
      : days;

  const weekdaySafe = Math.round(effectiveBase / weightedUnits);
  const weekendSafe = Math.round((effectiveBase * mult) / weightedUnits);
  const todaySafe = req.isWeekendToday ? weekendSafe : weekdaySafe;

  let guardStatus: WalletGuardResult['guardStatus'] = 'OPTIMAL';
  let guidance = 'Actual free cash aligns with your planned living runway.';

  if (freeCash < 0) {
    guardStatus = 'SURVIVAL_GUARD';
    guidance = `Free spendable cash is Rp ${Math.abs(freeCash).toLocaleString('id-ID')} below reserved bills. Pause discretionary spending immediately.`;
  } else if (remainingLiving > 0) {
    const ratio = freeCash / remainingLiving;
    if (ratio < 0.75 || variance <= -(todaySafe * 2)) {
      guardStatus = 'SURVIVAL_GUARD';
      guidance = `Wallet is Rp ${Math.abs(variance).toLocaleString('id-ID')} behind ledger plan. Cap daily spend at Rp ${todaySafe.toLocaleString('id-ID')}.`;
    } else if (ratio < 0.92 || variance < 0) {
      guardStatus = 'WATCH';
      guidance = `Slight slippage of Rp ${Math.abs(variance).toLocaleString('id-ID')} vs ledger plan. Target <= Rp ${todaySafe.toLocaleString('id-ID')} today.`;
    } else if (variance > 0) {
      guardStatus = 'OPTIMAL';
      guidance = `Surplus Rp ${variance.toLocaleString('id-ID')} above plan after bill reservations.`;
    }
  }

  return {
    remainingLivingCash: remainingLiving,
    actualWalletBalance: actualWallet,
    reservedBillsTotal: reserved,
    freeSpendableCash: freeCash,
    varianceVsLedger: variance,
    guardStatus,
    effectiveLivingBase: effectiveBase,
    dailySafeFlat: flat,
    dailySafeWeekday: weekdaySafe,
    dailySafeWeekend: weekendSafe,
    safeToSpendToday: todaySafe,
    guidance,
  };
}

export function buildExecutiveHorizonTs(req: ExecutiveHorizonRequest): ExecutiveHorizonResult {
  const periods = req.periods ?? [];
  const contracts = req.contracts ?? [];
  const sel =
    periods.find(
      (p) => p.month === req.selectedMonth && p.year === req.selectedYear,
    ) ?? periods[0];

  const selectedPeriodLabel = sel?.periodLabel ?? formatHybridPeriodLabel(req.selectedMonth, req.selectedYear);
  const dsrPercent =
    sel && sel.finalTotalIncome > 0
      ? round1((sel.totalDebt / sel.finalTotalIncome) * 100)
      : 0;
  const netSavingsRatePercent =
    sel && sel.finalTotalIncome > 0
      ? round1(((sel.actualSavings + sel.selfReward) / sel.finalTotalIncome) * 100)
      : 0;
  const days = sel && sel.daysInCycle > 0 ? sel.daysInCycle : 30;
  const effectiveDailyLivingRate = sel ? Math.trunc(sel.actualDailyOperational / days) : 0;

  let debtBurnDownVelocityRp = 0;
  const selIdx = sel
    ? periods.findIndex((p) => p.month === sel.month && p.year === sel.year)
    : -1;
  if (selIdx >= 0 && periods.length - selIdx > 1) {
    const endIdx = Math.min(periods.length - 1, selIdx + 3);
    const steps = endIdx - selIdx;
    if (steps > 0) {
      debtBurnDownVelocityRp = Math.trunc(
        (periods[selIdx].totalDebt - periods[endIdx].totalDebt) / steps,
      );
    }
  }

  const periodDrivers: HorizonPeriodDriver[] = periods.map((p, i) => {
    const pDsr = p.finalTotalIncome > 0 ? round1((p.totalDebt / p.finalTotalIncome) * 100) : 0;
    const pSave =
      p.finalTotalIncome > 0
        ? round1(((p.actualSavings + p.selfReward) / p.finalTotalIncome) * 100)
        : 0;
    const pDays = p.daysInCycle > 0 ? p.daysInCycle : 30;
    let momDebtDelta = 0;
    let momIncomeDelta = 0;
    let narrativeDriver = 'Baseline cycle structure';
    if (i > 0) {
      const prev = periods[i - 1];
      momDebtDelta = p.totalDebt - prev.totalDebt;
      momIncomeDelta = p.finalTotalIncome - prev.finalTotalIncome;
      if (momDebtDelta < 0 && momIncomeDelta > 0) {
        narrativeDriver = `Income +Rp ${momIncomeDelta.toLocaleString('id-ID')} & debt -Rp ${Math.abs(momDebtDelta).toLocaleString('id-ID')}`;
      } else if (momDebtDelta < 0) {
        narrativeDriver = `Debt step-down (-Rp ${Math.abs(momDebtDelta).toLocaleString('id-ID')} vs ${prev.periodLabel})`;
      } else if (momDebtDelta > 0) {
        narrativeDriver = `Debt step-up (+Rp ${momDebtDelta.toLocaleString('id-ID')} vs ${prev.periodLabel})`;
      } else if (momIncomeDelta !== 0) {
        narrativeDriver = `Income shift (${momIncomeDelta >= 0 ? '+' : ''}${momIncomeDelta} vs ${prev.periodLabel})`;
      }
    }

    return {
      month: p.month,
      year: p.year,
      periodLabel: p.periodLabel,
      dsrPercent: pDsr,
      netSavingsRatePct: pSave,
      effectiveDailyRate: Math.trunc(p.actualDailyOperational / pDays),
      momDebtDelta,
      momIncomeDelta,
      narrativeDriver,
    };
  });

  const freedMap = new Map<string, FreedCashflowMilestone>();
  let totalRemainingPrincipalRp = 0;
  for (const c of contracts) {
    totalRemainingPrincipalRp += Math.round(c.remainingPrincipal);
    if (c.payoffMonth >= 1 && c.payoffMonth <= 12 && c.payoffYear >= 2000) {
      const freed = addHybridMonths(c.payoffMonth, c.payoffYear, 1);
      const key = `${freed.year}-${String(freed.month).padStart(2, '0')}`;
      const existing = freedMap.get(key) ?? {
        month: freed.month,
        year: freed.year,
        periodLabel: formatHybridPeriodLabel(freed.month, freed.year),
        freedMonthlyRp: 0,
        cumulativeFreedRp: 0,
        endingContracts: [],
      };
      existing.freedMonthlyRp += Math.round(c.monthlyInstallment);
      existing.endingContracts.push(c.title);
      freedMap.set(key, existing);
    }
  }

  const ordered = Array.from(freedMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, val]) => val);

  let cumulative = 0;
  let nextMilestoneLabel = 'Debt-Free / All Settled';
  ordered.forEach((m, idx) => {
    cumulative += m.freedMonthlyRp;
    m.cumulativeFreedRp = cumulative;
    if (idx === 0) {
      nextMilestoneLabel = `+Rp ${m.freedMonthlyRp.toLocaleString('id-ID')}/mo freed in ${m.periodLabel}`;
    }
  });

  return {
    selectedPeriodLabel,
    dsrPercent,
    netSavingsRatePercent,
    debtBurnDownVelocityRp,
    effectiveDailyLivingRate,
    totalActiveContracts: contracts.length,
    totalRemainingPrincipalRp,
    nextMilestoneLabel,
    freedUpMilestones: ordered,
    periodDrivers,
  };
}

export function buildCashRadarTs(req: CashRadarRequest): CashRadarResult {
  const m = req.periodMonth >= 1 && req.periodMonth <= 12 ? req.periodMonth : 11;
  const y = req.periodYear >= 2020 ? req.periodYear : 2026;
  const holidays = new Set<string>(
    (req.holidaysIso ?? []).map((h) => String(h).trim().slice(0, 10)).filter((h) => h.length === 10),
  );

  const fmtUtc = (dt: Date) =>
    `${String(dt.getUTCFullYear()).padStart(4, '0')}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
  const parseRadarDate = (raw?: string): Date | null => {
    const p = parseDateParts(raw);
    if (!p.ok) return null;
    return new Date(Date.UTC(p.year, p.month - 1, p.day));
  };

  const monthFirst = new Date(Date.UTC(y, m - 1, 1));
  const monthLast = new Date(Date.UTC(y, m - 1, daysInMonthUtc(m, y)));
  const cycleStart = parseRadarDate(req.paydayDateIso) ?? monthFirst;
  const parsedEnd = parseRadarDate(req.livingEndDateIso);
  const cycleEnd = parsedEnd && parsedEnd.getTime() >= cycleStart.getTime() ? parsedEnd : monthLast;

  const cycleStartIso = fmtUtc(cycleStart);
  const cycleEndIso = fmtUtc(cycleEnd);
  const gridStart = cycleStart.getTime() < monthFirst.getTime() ? cycleStart : monthFirst;
  const gridEnd = cycleEnd.getTime() > monthLast.getTime() ? cycleEnd : monthLast;
  const gridStartIso = fmtUtc(gridStart);
  const gridEndIso = fmtUtc(gridEnd);

  const refIso = (req.referenceDateIso ?? '').trim().slice(0, 10);
  const events: CashRadarEvent[] = [];

  if (req.paycheckAmountRp > 0) {
    events.push({
      id: 'inflow-payday',
      dateIso: cycleStartIso,
      nominalDateIso: '',
      isBusinessDayShifted: false,
      label: 'Cycle Funded · Net Payroll',
      category: 'INFLOW',
      signedAmountRp: Math.round(req.paycheckAmountRp),
      sliceLabel: '',
      isFinalSlice: false,
      notes: 'Corporate payday credit',
      insideAllocatedPool: false,
      subItems: [],
    });
  }
  if (req.routineBillsPoolRp > 0) {
    events.push({
      id: 'routine-bills',
      dateIso: cycleStartIso,
      nominalDateIso: '',
      isBusinessDayShifted: false,
      label: 'Routine Bills Reserve',
      category: 'ROUTINE',
      signedAmountRp: -Math.round(req.routineBillsPoolRp),
      sliceLabel: '',
      isFinalSlice: false,
      notes: 'Transport, internet & routine essentials',
      insideAllocatedPool: false,
      subItems: [],
    });
  }
  if (req.dailyLivingPoolRp > 0) {
    events.push({
      id: 'living-pool',
      dateIso: cycleStartIso,
      nominalDateIso: '',
      isBusinessDayShifted: false,
      label: 'Daily Living Cash Pool',
      category: 'LIVING',
      signedAmountRp: -Math.round(req.dailyLivingPoolRp),
      sliceLabel: '',
      isFinalSlice: false,
      notes: 'Dedicated day-by-day living runway',
      insideAllocatedPool: false,
      subItems: [],
    });
  }
  const thrAmt = Math.round(req.thrAmountRp ?? 0);
  const thrRaw = (req.thrDateIso ?? '').trim();
  if (thrAmt > 0 && thrRaw.length >= 10) {
    events.push({
      id: 'inflow-thr',
      dateIso: thrRaw.slice(0, 10),
      nominalDateIso: '',
      isBusinessDayShifted: false,
      label: 'December Natal THR Inflow',
      category: 'INFLOW',
      signedAmountRp: thrAmt,
      sliceLabel: '',
      isFinalSlice: false,
      notes: 'Pro-rated statutory allowance',
      insideAllocatedPool: false,
      subItems: [],
    });
  }

  let cm = gridStart.getUTCMonth() + 1;
  let cy = gridStart.getUTCFullYear();
  const endYm = gridEnd.getUTCFullYear() * 12 + gridEnd.getUTCMonth();
  while (cy * 12 + (cm - 1) <= endYm) {
    const dim = daysInMonthUtc(cm, cy);
    const spayCutoffDay = dim - 15;
    const spayCutIso = `${String(cy).padStart(4, '0')}-${String(cm).padStart(2, '0')}-${String(spayCutoffDay).padStart(2, '0')}`;
    if (spayCutIso >= gridStartIso && spayCutIso <= gridEndIso) {
      events.push({
        id: `cutoff-spay-${String(cy).padStart(4, '0')}-${String(cm).padStart(2, '0')}`,
        dateIso: spayCutIso,
        nominalDateIso: '',
        isBusinessDayShifted: false,
        label: `SPayLater Statement Cutoff (${spayCutoffDay}th of ${dim}d mo)`,
        category: 'CUTOFF',
        signedAmountRp: 0,
        sliceLabel: '',
        isFinalSlice: false,
        notes: 'Charges after today defer to M+2 (due 25th)',
        insideAllocatedPool: false,
        subItems: [],
      });
    }
    const ccCutIso = `${String(cy).padStart(4, '0')}-${String(cm).padStart(2, '0')}-25`;
    if (ccCutIso >= gridStartIso && ccCutIso <= gridEndIso) {
      events.push({
        id: `cutoff-permata-${String(cy).padStart(4, '0')}-${String(cm).padStart(2, '0')}`,
        dateIso: ccCutIso,
        nominalDateIso: '',
        isBusinessDayShifted: false,
        label: 'Bank Permata CC Statement Closing (25th)',
        category: 'CUTOFF',
        signedAmountRp: 0,
        sliceLabel: '',
        isFinalSlice: false,
        notes: 'Swipes from 26th onward bill due 11th of M+2',
        insideAllocatedPool: false,
        subItems: [],
      });
    }
    const nxt = addHybridMonths(cm, cy, 1);
    cm = nxt.month;
    cy = nxt.year;
  }

  let totalPersonalDebtRp = 0;
  (req.personalDebtItems ?? []).forEach((item, idx) => {
    const amt = Math.round(item.amountRp ?? 0);
    if (amt <= 0) return;
    totalPersonalDebtRp += amt;
    const cat = item.category || 'PERSONAL_DEBT';
    const rawDate = (item.dateIso ?? '').trim();
    let dIso = '';
    if (rawDate.length >= 10) {
      dIso = rawDate.slice(0, 10);
    } else {
      const clampedD = Math.min(Math.max(1, item.dueDay || 8), daysInMonthUtc(m, y));
      dIso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(clampedD).padStart(2, '0')}`;
    }
    events.push({
      id: `pd-${idx + 1}-${dIso}`,
      dateIso: dIso,
      nominalDateIso: '',
      isBusinessDayShifted: false,
      label: item.title,
      category: cat,
      signedAmountRp: -amt,
      sliceLabel: item.sliceLabel ?? '',
      isFinalSlice: Boolean(item.isFinalSlice),
      notes: item.isFinalSlice
        ? 'Final installment — monthly commitment clears after payment'
        : 'Scheduled installment payment',
      insideAllocatedPool: false,
      subItems: [],
    });
  });

  if (req.creditCardDueRp > 0) {
    const nominalCcIso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-11`;
    const ccShift = resolvePreviousBusinessDayIsoTs(y, m, 11, holidays);
    events.push({
      id: 'bill-permata-cc',
      dateIso: ccShift.earlyIso,
      nominalDateIso: ccShift.shifted ? nominalCcIso : '',
      isBusinessDayShifted: ccShift.shifted,
      label: 'Bank Permata Credit Card Due (11th)',
      category: 'CREDIT_CARD',
      signedAmountRp: -Math.round(req.creditCardDueRp),
      sliceLabel: '',
      isFinalSlice: false,
      notes: ccShift.shifted
        ? `Nominal due ${nominalCcIso} falls on weekend/holiday — settle H-1 working day early by ${ccShift.earlyIso}`
        : 'Bank Permata full statement settlement (0% retail interest)',
      insideAllocatedPool: false,
      subItems: (req.creditCardBreakdown ?? []).map((s) => ({
        title: s.title,
        amountRp: Math.round(s.amountRp),
        sliceLabel: s.sliceLabel ?? '',
      })),
    });
  }

  if (req.paylaterDueRp > 0) {
    events.push({
      id: 'bill-spaylater',
      dateIso: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-25`,
      nominalDateIso: '',
      isBusinessDayShifted: false,
      label: 'SPayLater Monthly Due (25th)',
      category: 'PAYLATER',
      signedAmountRp: -Math.round(req.paylaterDueRp),
      sliceLabel: '',
      isFinalSlice: false,
      notes: 'Consolidated Shopee SPayLater cycle due',
      insideAllocatedPool: false,
      subItems: (req.paylaterBreakdown ?? []).map((s) => ({
        title: s.title,
        amountRp: Math.round(s.amountRp),
        sliceLabel: s.sliceLabel ?? '',
      })),
    });
  }

  if (req.coreSavingsTargetRp > 0) {
    const saveIso = thrAmt > 0 && thrRaw.length >= 10 ? thrRaw.slice(0, 10) : cycleEndIso;
    events.push({
      id: 'savings-p1',
      dateIso: saveIso,
      nominalDateIso: '',
      isBusinessDayShifted: false,
      label: 'Core Savings Transfer',
      category: 'SAVINGS',
      signedAmountRp: -Math.round(req.coreSavingsTargetRp),
      sliceLabel: '',
      isFinalSlice: false,
      notes: 'Scheduled Core Savings transfer',
      insideAllocatedPool: false,
      subItems: [],
    });
  }

  let extraIncomeSum = 0;
  let directOutflows = 0;
  (req.loggedTransactions ?? []).forEach((tx, idx) => {
    const amt = Math.round(tx.amountRp ?? 0);
    if (amt <= 0) return;
    const rawDate = (tx.dateIso ?? '').trim();
    if (rawDate.length < 10) return;
    const dIso = rawDate.slice(0, 10);
    if (dIso < gridStartIso || dIso > gridEndIso) return;
    const txType = String(tx.type ?? '').trim().toUpperCase();
    const srcType = String(tx.sourceType ?? '').trim().toUpperCase();
    if (txType === 'INCOME') {
      extraIncomeSum += amt;
      const note =
        srcType === 'OPERATIONAL_REFUND'
          ? 'Balance adjustment or operational credit'
          : 'Additional income logged in cycle';
      events.push({
        id: `tx-inc-${idx + 1}-${tx.id}`,
        dateIso: dIso,
        nominalDateIso: '',
        isBusinessDayShifted: false,
        label: tx.label,
        category: 'EXTRA_INCOME',
        signedAmountRp: amt,
        sliceLabel: srcType,
        isFinalSlice: false,
        notes: note,
        insideAllocatedPool: false,
        subItems: [],
      });
    } else {
      const inPool = Boolean(tx.insideAllocatedPool);
      let cat = 'LIVING_SPEND';
      let note = 'Drawn from Daily Living Cash Pool (no double-subtraction)';
      const lowerLbl = String(tx.label ?? '').toLowerCase();
      if (!inPool) {
        cat = 'DIRECT_DEDUCTION';
        note = 'Direct unpooled deduction outside living envelope';
        directOutflows += amt;
      } else if (srcType === 'CHECKPOINT' || lowerLbl.includes('checkpoint') || lowerLbl.includes('unitemized')) {
        note = 'Reconciled balance checkpoint (within living cash pool)';
      }
      events.push({
        id: `tx-exp-${idx + 1}-${tx.id}`,
        dateIso: dIso,
        nominalDateIso: '',
        isBusinessDayShifted: false,
        label: tx.label,
        category: cat,
        signedAmountRp: -amt,
        sliceLabel: srcType,
        isFinalSlice: false,
        notes: note,
        insideAllocatedPool: inPool,
        subItems: [],
      });
    }
  });

  events.sort((a, b) => {
    if (a.dateIso !== b.dateIso) return a.dateIso < b.dateIso ? -1 : 1;
    if (a.signedAmountRp !== b.signedAmountRp) return b.signedAmountRp - a.signedAmountRp;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const eventsByDate = new Map<string, CashRadarEvent[]>();
  for (const ev of events) {
    const list = eventsByDate.get(ev.dateIso) ?? [];
    list.push(ev);
    eventsByDate.set(ev.dateIso, list);
  }

  const dailySeries: CashRadarDayPoint[] = [];
  let running = 0;
  let minBal = Number.MAX_SAFE_INTEGER;
  let minDate = cycleStartIso;
  let minCtx = 'Payday Start';

  for (let ts = gridStart.getTime(); ts <= gridEnd.getTime(); ts += 86400000) {
    const dt = new Date(ts);
    const dIso = fmtUtc(dt);
    const inCycle = dIso >= cycleStartIso && dIso <= cycleEndIso;
    const dow = dt.getUTCDay();
    const isWknd = dow === 0 || dow === 6;

    const opening = running;
    const dayEvents = eventsByDate.get(dIso) ?? [];
    let inflows = 0;
    let outflows = 0;
    for (const ev of dayEvents) {
      if (ev.insideAllocatedPool) continue;
      if (ev.signedAmountRp > 0) inflows += ev.signedAmountRp;
      else if (ev.signedAmountRp < 0) outflows += -ev.signedAmountRp;
      running += ev.signedAmountRp;
    }
    const closing = running;

    if ((inCycle || dIso >= cycleStartIso) && closing < minBal) {
      minBal = closing;
      minDate = dIso;
      minCtx = dayEvents.length > 0 ? dayEvents[dayEvents.length - 1].label : 'Post-Outflow Trough';
    }

    dailySeries.push({
      dateIso: dIso,
      dayOfMonth: dt.getUTCDate(),
      inActiveCycle: inCycle,
      isToday: refIso !== '' && dIso === refIso,
      isWeekend: isWknd,
      openingBalanceRp: opening,
      inflowsRp: inflows,
      outflowsRp: outflows,
      closingBalanceRp: closing,
      events: dayEvents,
    });
  }

  if (minBal === Number.MAX_SAFE_INTEGER) {
    minBal = running;
  }

  const paydayInflows = Math.round(req.paycheckAmountRp) + thrAmt + extraIncomeSum;
  const totalScheduledBills =
    totalPersonalDebtRp +
    Math.round(req.creditCardDueRp) +
    Math.round(req.paylaterDueRp) +
    Math.round(req.routineBillsPoolRp) +
    directOutflows;
  const endingBuffer =
    paydayInflows -
    totalScheduledBills -
    Math.round(req.dailyLivingPoolRp) -
    Math.round(req.coreSavingsTargetRp);

  return {
    periodMonth: m,
    periodYear: y,
    cycleStartIso,
    cycleEndIso,
    nextPaydayIso: req.nextPaydayIso,
    paydayInflowsRp: paydayInflows,
    totalScheduledBillsRp: totalScheduledBills,
    endingCashBufferRp: endingBuffer,
    lowestCashPoint: {
      dateIso: minDate,
      balanceRp: minBal,
      contextLabel: minCtx,
      isTightOrDeficit: minBal <= 0,
    },
    events,
    dailySeries,
  };
}

export * from './erp-engines';
