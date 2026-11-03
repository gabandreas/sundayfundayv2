export type PacingStatus =
  | 'DEFICIT_RISK'
  | 'ON_TRACK'
  | 'CAUTION'
  | 'BURNING_FAST';

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
}

export interface PacingResult {
  periodMonth: number;
  periodYear: number;
  cycleStartDate: string; // YYYY-MM-DD
  cycleEndDate: string;   // YYYY-MM-DD
  cycleDateLabel: string; // e.g. "25 Aug – 24 Sep 2026"
  isEndDateConfirmed: boolean;
  daysInCycle: number;
  daysPassed: number;
  daysRemaining: number;
  currentDayIndex: number;
  totalOperationalBudget: number;
  totalDailySpent: number;
  remainingBudget: number;
  baselineDailyRate: number;
  safeToSpendToday: number;
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
  payoutDay: number = 25,
): { month: number; year: number } {
  const calDay = referenceDate.getDate();
  const calMonth = referenceDate.getMonth() + 1; // 1-indexed (1..12)
  const calYear = referenceDate.getFullYear();

  if (calDay >= payoutDay) {
    return {
      month: calMonth,
      year: calYear,
    };
  }

  if (calMonth === 1) {
    return {
      month: 12,
      year: calYear - 1,
    };
  }
  return {
    month: calMonth - 1,
    year: calYear,
  };
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
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
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
  defaultPayoutDay: number = 25,
): PaydayCycleWindow {
  const cycleStartDate = snapshotPayoutDate
    ? new Date(snapshotPayoutDate)
    : new Date(Date.UTC(year, month - 1, defaultPayoutDay));

  const startNorm = normalizeDate(cycleStartDate);
  const startTs = Date.UTC(startNorm.year, startNorm.month - 1, startNorm.day);

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  let nextPayoutDate: Date;
  let isEndDateConfirmed = false;

  if (nextSnapshotPayoutDate) {
    const nextNorm = normalizeDate(nextSnapshotPayoutDate);
    const candidateTs = Date.UTC(nextNorm.year, nextNorm.month - 1, nextNorm.day);
    if (candidateTs > startTs) {
      nextPayoutDate = new Date(nextSnapshotPayoutDate);
      isEndDateConfirmed = true;
    } else {
      nextPayoutDate = new Date(Date.UTC(nextYear, nextMonth - 1, defaultPayoutDay));
    }
  } else {
    nextPayoutDate = new Date(Date.UTC(nextYear, nextMonth - 1, defaultPayoutDay));
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
  const daysPassed = Math.min(Math.max(diffFromStart, 0), daysInCycle);

  const diffToEnd = Math.round((endTs - refTs) / 86400000) + 1;
  const daysRemaining = Math.min(Math.max(diffToEnd, 1), daysInCycle);

  const currentDayIndex = Math.min(Math.max(diffFromStart + 1, 1), daysInCycle);

  return {
    daysInCycle,
    daysPassed,
    daysRemaining,
    currentDayIndex,
  };
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
  const { daysInCycle, daysPassed, daysRemaining, currentDayIndex } =
    calculatePacingDays(
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

  const safeToSpendToday =
    daysRemaining > 0
      ? Math.max(Math.round(remainingBudget / daysRemaining), 0)
      : 0;

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
      : 1.5;

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
    remainingBudget > 0 && remainingWeightedUnits > 0
      ? Math.round((remainingBudget * 1.0) / remainingWeightedUnits)
      : 0;

  const weekendSafeRate =
    remainingBudget > 0 && remainingWeightedUnits > 0
      ? Math.round((remainingBudget * weekendMultiplier) / remainingWeightedUnits)
      : 0;

  const weightedSafeToSpendToday = isWeekendToday
    ? weekendSafeRate
    : weekdaySafeRate;

  // Rolling Weekly Envelope (7-Day Ahead Weighted Allowance)
  const totalRemainingDays = remainingWeekdays + remainingWeekendDays;
  const windowDaysCount = Math.min(7, totalRemainingDays);
  let windowWeekdays = 0;
  let windowWeekendDays = 0;

  if (startWindowTs <= endTs && windowDaysCount > 0) {
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
    remainingBudget > 0
      ? windowWeekdays * weekdaySafeRate + windowWeekendDays * weekendSafeRate
      : 0;
  if (remainingBudget > 0 && rollingWeeklyEnvelope > remainingBudget) {
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
    daysInCycle,
    daysPassed,
    daysRemaining,
    currentDayIndex,
    totalOperationalBudget,
    totalDailySpent,
    remainingBudget,
    baselineDailyRate,
    safeToSpendToday,
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
