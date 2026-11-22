export const ASIA_JAKARTA_TZ = 'Asia/Jakarta';
export const DEFAULT_PAYOUT_DAY = 25;
export const PAYDAY_CYCLE_START_DAY = 27;
export const SPAYLATER_CUTOFF_DAY = 15;
export const SPAYLATER_DUE_DAY = 25;
export const CC_CUTOFF_DAY = 25;
export const CC_DUE_DAY = 11;
export const PERSONAL_DEBT_DUE_DAY = 8;

export function getSpaylaterCutoffDay(month: number, year: number): number {
  const daysInM = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.max(1, daysInM - 15);
}
export const DEFAULT_WEEKEND_MULTIPLIER = 1.5;
export const LAUNCH_YEAR = 2026;
export const LAUNCH_MONTH = 7;
export const ERP_NOTIFICATION_EMAIL = 'sundayfundayerp@gmail.com';

export interface JakartaDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  isoDate: string; // YYYY-MM-DD
  dateUtcMidnight: Date;
}

const JAKARTA_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: ASIA_JAKARTA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Resolves the calendar date and weekday explicitly in Asia/Jakarta (WIB / UTC+7),
 * ensuring serverless UTC hosts evaluate cutoff days, weekend rates, due dates,
 * and active payday periods identically to the user's wall clock.
 */
export function getJakartaDateParts(
  referenceDate: Date = new Date(),
): JakartaDateParts {
  const isoDate = JAKARTA_DATE_FORMATTER.format(referenceDate);
  const [year, month, day] = isoDate.split('-').map(Number);
  const dateUtcMidnight = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = dateUtcMidnight.getUTCDay();

  return {
    year,
    month,
    day,
    dayOfWeek,
    isoDate,
    dateUtcMidnight,
  };
}

export type PacingStatus =
  | 'DEFICIT_RISK'
  | 'ON_TRACK'
  | 'CAUTION'
  | 'BURNING_FAST';

export type CycleTemporalState = 'PRE_PAYDAY' | 'ACTIVE' | 'COMPLETED';

export type DefaultPeriodStrategy = 'EARLIEST_OPEN_ACTIVE' | 'CALENDAR_WINDOW';

export interface DefaultPeriodSnapshotSummary {
  month: number;
  year: number;
  status: string;
}

export interface PacingInput {
  periodMonth: number;
  periodYear: number;
  cycleStartDate: Date;
  cycleEndDate: Date;
  isEndDateConfirmed: boolean;
  actualDailyOperational: number;
  dailyOperationalTarget: number;
  totalDailySpent: number;
  referenceDate?: Date;
  weekendMultiplier?: number;
}

export interface PacingDaysResult {
  daysInCycle: number;
  daysPassed: number;
  daysRemaining: number;
  currentDayIndex: number;
  cycleTemporalState: CycleTemporalState;
  daysUntilCycleStart: number;
}

export interface PacingResult {
  periodMonth: number;
  periodYear: number;
  cycleStartDate: string; // YYYY-MM-DD
  cycleEndDate: string;   // YYYY-MM-DD
  cycleDateLabel: string; // e.g. "25 Aug – 24 Sep 2026"
  isEndDateConfirmed: boolean;
  cycleTemporalState: CycleTemporalState;
  daysUntilCycleStart: number;
  daysInCycle: number;
  daysPassed: number;
  daysRemaining: number;
  currentDayIndex: number;
  totalOperationalBudget: number;
  totalDailySpent: number;
  remainingBudget: number;
  baselineDailyRate: number;
  safeToSpendToday: number;
  paceDeltaRp: number;
  pacingRatio: number;
  pacingPercentage: number;
  pacingStatus: PacingStatus;
  isWeekendToday: boolean;
  weekendMultiplier: number;
  remainingWeekdays: number;
  remainingWeekendDays: number;
  remainingWeightedUnits: number;
  weekdaySafeRate: number;
  weekendSafeRate: number;
  weightedSafeToSpendToday: number;
  rollingWeeklyEnvelope: number;
  averageDailyBurnSoFar: number;
  projectedEndOfCycleRemaining: number;
}

const MONTH_NAMES = [
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

export function getPayrollPeriodForDate(
  referenceDate: Date = new Date(),
  cycleTransitionDay: number = PAYDAY_CYCLE_START_DAY,
): { month: number; year: number } {
  const { year: calYear, month: calMonth, day: calDay } =
    referenceDate.toISOString().endsWith('T00:00:00.000Z')
      ? {
          year: referenceDate.getUTCFullYear(),
          month: referenceDate.getUTCMonth() + 1,
          day: referenceDate.getUTCDate(),
        }
      : getJakartaDateParts(referenceDate);

  let month: number;
  let year: number;

  if (calDay >= cycleTransitionDay) {
    if (calMonth === 12) {
      month = 1;
      year = calYear + 1;
    } else {
      month = calMonth + 1;
      year = calYear;
    }
  } else {
    month = calMonth;
    year = calYear;
  }

  if (year < LAUNCH_YEAR || (year === LAUNCH_YEAR && month < LAUNCH_MONTH)) {
    return { month: LAUNCH_MONTH, year: LAUNCH_YEAR };
  }

  return { month, year };
}

export function normalizeDate(d: Date): {
  year: number;
  month: number;
  day: number;
} {
  const iso = d.toISOString();
  if (iso.endsWith('T00:00:00.000Z')) {
    const [y, m, day] = iso.slice(0, 10).split('-').map(Number);
    return { year: y, month: m, day };
  }
  const jkt = getJakartaDateParts(d);
  return {
    year: jkt.year,
    month: jkt.month,
    day: jkt.day,
  };
}

export function toDateString(d: Date): string {
  const { year, month, day } = normalizeDate(d);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export interface PaydayCycleWindow {
  cycleStartDate: Date;
  cycleEndDate: Date;
  cycleDateLabel: string;
  isEndDateConfirmed: boolean;
}

export function getPaydayCycleWindow(
  month: number,
  year: number,
  snapshotPayoutDate?: Date | null,
  nextSnapshotPayoutDate?: Date | null,
  defaultPayoutDay: number = DEFAULT_PAYOUT_DAY,
): PaydayCycleWindow {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const cycleStartDate = snapshotPayoutDate
    ? new Date(snapshotPayoutDate)
    : new Date(Date.UTC(prevYear, prevMonth - 1, defaultPayoutDay));

  const startNorm = normalizeDate(cycleStartDate);
  const startTs = Date.UTC(startNorm.year, startNorm.month - 1, startNorm.day);

  let nextPayoutDate: Date;
  let isEndDateConfirmed = false;

  if (nextSnapshotPayoutDate) {
    const nextNorm = normalizeDate(nextSnapshotPayoutDate);
    const candidateTs = Date.UTC(nextNorm.year, nextNorm.month - 1, nextNorm.day);
    if (candidateTs > startTs) {
      nextPayoutDate = new Date(nextSnapshotPayoutDate);
      isEndDateConfirmed = true;
    } else {
      nextPayoutDate = new Date(Date.UTC(year, month - 1, defaultPayoutDay));
    }
  } else {
    nextPayoutDate = new Date(Date.UTC(year, month - 1, defaultPayoutDay));
  }

  const nextNorm = normalizeDate(nextPayoutDate);
  let nextTs = Date.UTC(nextNorm.year, nextNorm.month - 1, nextNorm.day);
  if (nextTs <= startTs) {
    nextTs = startTs + 30 * 86400000;
  }
  const cycleEndDate = new Date(nextTs - 86400000);
  const cycleDateLabel = formatCycleDateLabel(cycleStartDate, cycleEndDate);

  return {
    cycleStartDate,
    cycleEndDate,
    cycleDateLabel,
    isEndDateConfirmed,
  };
}

export function formatCycleDateLabel(
  startDate: Date,
  endDate: Date,
): string {
  const s = normalizeDate(startDate);
  const e = normalizeDate(endDate);
  const sMonth = MONTH_NAMES[s.month - 1];
  const eMonth = MONTH_NAMES[e.month - 1];

  if (s.year === e.year) {
    if (s.month === e.month) {
      return `${s.day}–${e.day} ${sMonth} ${s.year}`;
    }
    return `${s.day} ${sMonth} – ${e.day} ${eMonth} ${s.year}`;
  }
  return `${s.day} ${sMonth} ${s.year} – ${e.day} ${eMonth} ${e.year}`;
}

function toUtcTimestamp(d: Date): number {
  const { year, month, day } = normalizeDate(d);
  return Date.UTC(year, month - 1, day);
}

export function calculatePacingDays(
  cycleStartDate: Date,
  cycleEndDate: Date,
  referenceDate: Date = new Date(),
): PacingDaysResult {
  const startTs = toUtcTimestamp(cycleStartDate);
  const endTs = toUtcTimestamp(cycleEndDate);
  const refTs = toUtcTimestamp(referenceDate);

  const daysInCycle = Math.max(1, Math.round((endTs - startTs) / 86400000) + 1);
  const diffFromStart = Math.round((refTs - startTs) / 86400000);

  if (refTs < startTs) {
    return {
      daysInCycle,
      daysPassed: 0,
      daysRemaining: daysInCycle,
      currentDayIndex: 0,
      cycleTemporalState: 'PRE_PAYDAY',
      daysUntilCycleStart: Math.round((startTs - refTs) / 86400000),
    };
  }

  if (refTs > endTs) {
    return {
      daysInCycle,
      daysPassed: daysInCycle,
      daysRemaining: 0,
      currentDayIndex: daysInCycle,
      cycleTemporalState: 'COMPLETED',
      daysUntilCycleStart: 0,
    };
  }

  const daysPassed = Math.min(Math.max(diffFromStart, 0), daysInCycle);
  const daysRemaining = Math.min(Math.max(daysInCycle - diffFromStart, 1), daysInCycle);
  const currentDayIndex = Math.min(Math.max(diffFromStart + 1, 1), daysInCycle);

  return {
    daysInCycle,
    daysPassed,
    daysRemaining,
    currentDayIndex,
    cycleTemporalState: 'ACTIVE',
    daysUntilCycleStart: 0,
  };
}

export function resolveDefaultActivePeriod(params: {
  referenceDate?: Date;
  cycleTransitionDay?: number;
  strategy?: DefaultPeriodStrategy;
  snapshots?: DefaultPeriodSnapshotSummary[];
}): { month: number; year: number; skippedLockedPeriod: boolean } {
  const calendarPeriod = getPayrollPeriodForDate(
    params.referenceDate ?? new Date(),
    params.cycleTransitionDay ?? PAYDAY_CYCLE_START_DAY,
  );
  const strategy = params.strategy ?? 'EARLIEST_OPEN_ACTIVE';
  if (strategy === 'CALENDAR_WINDOW' || !params.snapshots || params.snapshots.length === 0) {
    return { ...calendarPeriod, skippedLockedPeriod: false };
  }

  const statusMap = new Map<string, string>();
  for (const s of params.snapshots) {
    statusMap.set(`${s.year}-${s.month}`, String(s.status || '').toUpperCase());
  }

  let m = calendarPeriod.month;
  let y = calendarPeriod.year;
  for (let i = 0; i < 12; i++) {
    const st = statusMap.get(`${y}-${m}`);
    if (st !== 'LOCKED') {
      return {
        month: m,
        year: y,
        skippedLockedPeriod: m !== calendarPeriod.month || y !== calendarPeriod.year,
      };
    }
    if (m === 12) {
      m = 1;
      y += 1;
    } else {
      m += 1;
    }
  }

  return { ...calendarPeriod, skippedLockedPeriod: false };
}

export function evaluatePacingStatus(
  remainingBudget: number,
  pacingRatio: number,
): PacingStatus {
  if (remainingBudget <= 0) {
    return 'DEFICIT_RISK';
  }
  if (pacingRatio >= 0.85) {
    return 'ON_TRACK';
  }
  if (pacingRatio >= 0.5) {
    return 'CAUTION';
  }
  return 'BURNING_FAST';
}

export function calculateDailyPacing(input: PacingInput): PacingResult {
  const {
    daysInCycle,
    daysPassed,
    daysRemaining,
    currentDayIndex,
    cycleTemporalState,
    daysUntilCycleStart,
  } = calculatePacingDays(
    input.cycleStartDate,
    input.cycleEndDate,
    input.referenceDate,
  );

  const totalOperationalBudget = Math.max(0, input.actualDailyOperational);
  const totalDailySpent = Math.max(0, input.totalDailySpent);
  const remainingBudget = totalOperationalBudget - totalDailySpent;

  const baselineDailyRate =
    input.dailyOperationalTarget > 0
      ? Math.round(input.dailyOperationalTarget / daysInCycle)
      : 0;

  const isCompleted = cycleTemporalState === 'COMPLETED';

  const safeToSpendToday =
    !isCompleted && daysRemaining > 0
      ? Math.max(Math.round(remainingBudget / daysRemaining), 0)
      : 0;

  const expectedSpentAtPace =
    cycleTemporalState === 'PRE_PAYDAY'
      ? 0
      : Math.round((totalOperationalBudget * daysPassed) / daysInCycle);
  const paceDeltaRp =
    cycleTemporalState === 'PRE_PAYDAY' ? 0 : expectedSpentAtPace - totalDailySpent;

  const pacingRatio =
    baselineDailyRate > 0 ? safeToSpendToday / baselineDailyRate : 1;

  const pacingStatus = evaluatePacingStatus(remainingBudget, pacingRatio);

  const cycleStartDate = toDateString(input.cycleStartDate);
  const cycleEndDate = toDateString(input.cycleEndDate);
  const cycleDateLabel = formatCycleDateLabel(
    input.cycleStartDate,
    input.cycleEndDate,
  );

  // Calendar Day-of-Week Breakdown & Weighted Runway
  const refDate = input.referenceDate ?? new Date();
  const { year: refY, month: refM, day: refD } = normalizeDate(refDate);
  const refUtcDate = new Date(Date.UTC(refY, refM - 1, refD));
  const refDow = refUtcDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const isWeekendToday = refDow === 0 || refDow === 6;

  const weekendMultiplier =
    typeof input.weekendMultiplier === 'number' && input.weekendMultiplier > 0
      ? input.weekendMultiplier
      : DEFAULT_WEEKEND_MULTIPLIER;

  const startNorm = normalizeDate(input.cycleStartDate);
  const endNorm = normalizeDate(input.cycleEndDate);
  const startTs = Date.UTC(startNorm.year, startNorm.month - 1, startNorm.day);
  const endTs = Date.UTC(endNorm.year, endNorm.month - 1, endNorm.day);
  const refTs = Date.UTC(refY, refM - 1, refD);

  const startWindowTs = Math.max(refTs, startTs);
  let remainingWeekdays = 0;
  let remainingWeekendDays = 0;

  if (startWindowTs <= endTs) {
    for (let t = startWindowTs; t <= endTs; t += 86400000) {
      const dow = new Date(t).getUTCDay();
      if (dow === 0 || dow === 6) {
        remainingWeekendDays++;
      } else {
        remainingWeekdays++;
      }
    }
  }

  const remainingWeightedUnits =
    Math.round((remainingWeekdays * 1.0 + remainingWeekendDays * weekendMultiplier) * 100) / 100;

  const weekdaySafeRate =
    !isCompleted && remainingBudget > 0 && remainingWeightedUnits > 0
      ? Math.round((remainingBudget * 1.0) / remainingWeightedUnits)
      : 0;

  const weekendSafeRate =
    !isCompleted && remainingBudget > 0 && remainingWeightedUnits > 0
      ? Math.round((remainingBudget * weekendMultiplier) / remainingWeightedUnits)
      : 0;

  const weightedSafeToSpendToday = isCompleted
    ? 0
    : isWeekendToday
      ? weekendSafeRate
      : weekdaySafeRate;

  // Rolling Weekly Envelope (7-Day Ahead Weighted Allowance)
  const totalRemainingDays = remainingWeekdays + remainingWeekendDays;
  const windowDaysCount = Math.min(7, totalRemainingDays);
  let windowWeekdays = 0;
  let windowWeekendDays = 0;

  if (!isCompleted && startWindowTs <= endTs && windowDaysCount > 0) {
    for (let i = 0; i < windowDaysCount; i++) {
      const t = startWindowTs + i * 86400000;
      const dow = new Date(t).getUTCDay();
      if (dow === 0 || dow === 6) {
        windowWeekendDays++;
      } else {
        windowWeekdays++;
      }
    }
  }

  let rollingWeeklyEnvelope =
    !isCompleted && remainingBudget > 0
      ? windowWeekdays * weekdaySafeRate + windowWeekendDays * weekendSafeRate
      : 0;
  if (!isCompleted && remainingBudget > 0 && rollingWeeklyEnvelope > remainingBudget) {
    rollingWeeklyEnvelope = remainingBudget;
  }

  // Pacing Diagnostics
  const averageDailyBurnSoFar =
    daysPassed > 0 ? Math.round(totalDailySpent / daysPassed) : 0;

  const projectedEndOfCycleRemaining = Math.round(
    totalOperationalBudget - averageDailyBurnSoFar * daysInCycle,
  );

  return {
    periodMonth: input.periodMonth,
    periodYear: input.periodYear,
    cycleStartDate,
    cycleEndDate,
    cycleDateLabel,
    isEndDateConfirmed: input.isEndDateConfirmed,
    cycleTemporalState,
    daysUntilCycleStart,
    daysInCycle,
    daysPassed,
    daysRemaining,
    currentDayIndex,
    totalOperationalBudget,
    totalDailySpent,
    remainingBudget,
    baselineDailyRate,
    safeToSpendToday,
    paceDeltaRp,
    pacingRatio,
    pacingPercentage: Math.round(pacingRatio * 100),
    pacingStatus,
    isWeekendToday,
    weekendMultiplier,
    remainingWeekdays,
    remainingWeekendDays,
    remainingWeightedUnits,
    weekdaySafeRate,
    weekendSafeRate,
    weightedSafeToSpendToday,
    rollingWeeklyEnvelope,
    averageDailyBurnSoFar,
    projectedEndOfCycleRemaining,
  };
}
