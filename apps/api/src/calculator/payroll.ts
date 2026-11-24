export const DEFAULT_LAPTOP_ALLOWANCE = 250000;
export const DEFAULT_BPJS_RATE = 0.03;
export const DEFAULT_DECEMBER_THR_MONTHS = 8.83;

/**
 * Authoritative Indonesian National Holidays (SKB 3 Menteri) for 2025-12 through 2027-12,
 * used by the 16th-of-M-1 to 15th-of-M attendance cutoff working-day calculator.
 */
export const INDONESIAN_PUBLIC_HOLIDAYS_2026_2027: Record<string, string> = {
  // Late 2025 (for Jan 2026 cutoff: 16 Dec 2025 – 15 Jan 2026)
  '2025-12-25': 'Hari Raya Natal',
  '2025-12-26': 'Cuti Bersama Natal',

  // 2026 National Holidays
  '2026-01-01': 'Tahun Baru 2026 Masehi',
  '2026-01-16': 'Isra Mikraj Nabi Muhammad SAW',
  '2026-02-16': 'Cuti Bersama Tahun Baru Imlek 2577 Kongzili',
  '2026-02-17': 'Tahun Baru Imlek 2577 Kongzili',
  '2026-03-18': 'Cuti Bersama Hari Suci Nyepi',
  '2026-03-19': 'Hari Suci Nyepi Tahun Baru Saka 1948',
  '2026-03-20': 'Hari Raya Idul Fitri 1447 H',
  '2026-03-23': 'Cuti Bersama Idul Fitri 1447 H',
  '2026-03-24': 'Cuti Bersama Idul Fitri 1447 H',
  '2026-04-03': 'Wafat Yesus Kristus (Jumat Agung)',
  '2026-05-01': 'Hari Buruh Internasional',
  '2026-05-14': 'Kenaikan Yesus Kristus',
  '2026-05-15': 'Cuti Bersama Kenaikan Yesus Kristus',
  '2026-05-27': 'Hari Raya Idul Adha 1447 H',
  '2026-05-28': 'Cuti Bersama Idul Adha 1447 H',
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-06-16': 'Tahun Baru Islam 1448 H',
  '2026-06-17': 'Cuti Bersama Tahun Baru Islam',
  '2026-08-17': 'Hari Kemerdekaan Republik Indonesia',
  '2026-08-25': 'Maulid Nabi Muhammad SAW',
  '2026-12-25': 'Hari Raya Natal',

  // 2027 National Holidays (Full-Year Coverage)
  '2027-01-01': 'Tahun Baru 2027 Masehi',
  '2027-01-05': 'Isra Mikraj Nabi Muhammad SAW',
  '2027-02-08': 'Tahun Baru Imlek 2578 Kongzili (Observed)',
  '2027-03-08': 'Cuti Bersama Idul Fitri 1448 H',
  '2027-03-09': 'Hari Raya Idul Fitri 1448 H',
  '2027-03-10': 'Hari Raya Idul Fitri 1448 H (Hari Kedua)',
  '2027-03-11': 'Cuti Bersama Idul Fitri 1448 H',
  '2027-03-12': 'Cuti Bersama Idul Fitri 1448 H',
  '2027-03-26': 'Wafat Yesus Kristus (Jumat Agung)',
  '2027-03-29': 'Hari Suci Nyepi Tahun Baru Saka 1949',
  '2027-05-06': 'Kenaikan Yesus Kristus',
  '2027-05-17': 'Hari Raya Idul Adha 1448 H',
  '2027-05-20': 'Hari Raya Waisak 2571 BE',
  '2027-06-01': 'Hari Lahir Pancasila',
  '2027-06-07': 'Tahun Baru Islam 1449 H',
  '2027-08-16': 'Maulid Nabi Muhammad SAW',
  '2027-08-17': 'Hari Kemerdekaan Republik Indonesia',
  '2027-12-24': 'Cuti Bersama Hari Raya Natal',
  '2027-12-25': 'Hari Raya Natal',
};

const SHORT_MONTH_LABELS = [
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

export interface WorkingDaysCutoffResult {
  month: number;
  year: number;
  startDateIso: string;
  endDateIso: string;
  windowLabel: string;
  totalWeekdays: number;
  holidaysInWindow: Array<{ date: string; name: string }>;
  workingDays: number;
}

function daysInMonthUtc(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function mergeStudioHolidayMap(
  holidayDatesIso?: string[],
): Record<string, string> {
  if (!Array.isArray(holidayDatesIso) || holidayDatesIso.length === 0) {
    return INDONESIAN_PUBLIC_HOLIDAYS_2026_2027;
  }
  const merged: Record<string, string> = {
    ...INDONESIAN_PUBLIC_HOLIDAYS_2026_2027,
  };
  for (const iso of holidayDatesIso) {
    const trimmed = String(iso ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !merged[trimmed]) {
      merged[trimmed] = 'Custom Configured Holiday';
    }
  }
  return merged;
}

export interface AttendanceCutoffWindowOptions {
  startDay?: number;
  endDay?: number;
}

/**
 * Computes the attendance cutoff window (default 16th of month M-1 through 15th of month M,
 * configurable and Feb-clamped) and counts Monday–Friday working days excluding holidays.
 */
export function getWorkingDaysCutoffWindow(
  month: number,
  year: number,
  customHolidays: Record<string, string> = INDONESIAN_PUBLIC_HOLIDAYS_2026_2027,
  windowOptions?: AttendanceCutoffWindowOptions,
): WorkingDaysCutoffResult {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const rawStartDay = Math.max(1, Math.round(windowOptions?.startDay ?? 16));
  const rawEndDay = Math.max(1, Math.round(windowOptions?.endDay ?? 15));
  const startDay = Math.min(rawStartDay, daysInMonthUtc(prevMonth, prevYear));
  const endDay = Math.min(rawEndDay, daysInMonthUtc(month, year));

  const startUtc = Date.UTC(prevYear, prevMonth - 1, startDay);
  const endUtc = Date.UTC(year, month - 1, endDay);

  let totalWeekdays = 0;
  const holidaysInWindow: Array<{ date: string; name: string }> = [];

  for (let ts = startUtc; ts <= endUtc; ts += 86400000) {
    const d = new Date(ts);
    const dow = d.getUTCDay(); // 0 = Sun, 6 = Sat
    if (dow >= 1 && dow <= 5) {
      totalWeekdays++;
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const isoDate = `${yyyy}-${mm}-${dd}`;
      if (customHolidays[isoDate]) {
        holidaysInWindow.push({
          date: isoDate,
          name: customHolidays[isoDate],
        });
      }
    }
  }

  const workingDays = Math.max(0, totalWeekdays - holidaysInWindow.length);
  const prevLabel = `${startDay} ${SHORT_MONTH_LABELS[prevMonth - 1]} ${prevYear}`;
  const currLabel = `${endDay} ${SHORT_MONTH_LABELS[month - 1]} ${year}`;

  return {
    month,
    year,
    startDateIso: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`,
    endDateIso: `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
    windowLabel: `${prevLabel} – ${currLabel}`,
    totalWeekdays,
    holidaysInWindow,
    workingDays,
  };
}

export function calculateWorkingDaysForPeriod(
  month: number,
  year: number,
  customHolidays?: Record<string, string>,
  windowOptions?: AttendanceCutoffWindowOptions,
): number {
  return getWorkingDaysCutoffWindow(
    month,
    year,
    customHolidays ?? INDONESIAN_PUBLIC_HOLIDAYS_2026_2027,
    windowOptions,
  ).workingDays;
}

/**
 * Under the Consumption & Bill-Maturity Month convention (Period M is funded
 * by Payday(M-1)), payroll attendance follows the cutoff window of Month M-1.
 */
export function calculateWorkingDaysForConsumptionPeriod(
  consumptionMonth: number,
  consumptionYear: number,
  customHolidays?: Record<string, string>,
  windowOptions?: AttendanceCutoffWindowOptions,
): number {
  const prevMonth = consumptionMonth === 1 ? 12 : consumptionMonth - 1;
  const prevYear = consumptionMonth === 1 ? consumptionYear - 1 : consumptionYear;
  return calculateWorkingDaysForPeriod(prevMonth, prevYear, customHolidays, windowOptions);
}

export type PayrollAdjustmentStageType =
  | 'PRE_NET_EARNING'
  | 'PRE_NET_DEDUCTION'
  | 'POST_NET_DEDUCTION';

export interface PayrollAdjustmentItem {
  id?: number;
  templateId?: number | null;
  label: string;
  stage: PayrollAdjustmentStageType;
  amount: number;
  notes?: string | null;
}

export interface PayrollInput {
  baseSalary: number;
  salaryAdjustment?: number;
  totalWorkingDays: number;
  dailyAllowance: number;
  cafeteriaDeduction?: number;
  thrAmount?: number;
  bonusAmount?: number;
  extraIncome?: number;
  laptopAllowance?: number;
  bpjsRate?: number;
  customAdjustments?: PayrollAdjustmentItem[];
}

export interface PayrollResult {
  baseSalary: number;
  salaryAdjustment: number;
  adjustedBaseSalary: number;
  bpjsDeduction: number;
  laptopAllowance: number;
  netBasePayroll: number;
  totalWorkingDays: number;
  dailyAllowance: number;
  totalDailyAllowance: number;
  netSalaryIncome: number;
  customPayrollAdditions: number;
  customPayrollDeductions: number;
  directPayrollDeductions: number;
  bankTakeHomeSalary: number;
  customAdjustments: PayrollAdjustmentItem[];
  extraIncome: number;
  finalTotalIncome: number;
  thrAmount: number;
  bonusAmount: number;
  cafeteriaDeduction: number;
}

export function calculateAdjustedBaseSalary(
  baseSalary: number,
  salaryAdjustment: number = 0,
): number {
  return baseSalary + salaryAdjustment;
}

export function calculateBpjsDeduction(
  adjustedBaseSalary: number,
  rate: number = DEFAULT_BPJS_RATE,
): number {
  if (adjustedBaseSalary <= 0 || rate <= 0) return 0;
  return Math.round(adjustedBaseSalary * rate);
}

export function calculateNetBasePayroll(
  adjustedBaseSalary: number,
  bpjsDeduction: number,
  laptopAllowance: number = DEFAULT_LAPTOP_ALLOWANCE,
): number {
  return adjustedBaseSalary - bpjsDeduction + laptopAllowance;
}

export function calculateTotalDailyAllowance(
  totalWorkingDays: number,
  dailyAllowance: number,
): number {
  if (totalWorkingDays <= 0 || dailyAllowance <= 0) return 0;
  return totalWorkingDays * dailyAllowance;
}

export function calculateNetSalaryIncome(
  netBasePayroll: number,
  totalDailyAllowance: number,
  cafeteriaDeduction: number = 0,
): number {
  return Math.max(netBasePayroll + totalDailyAllowance - cafeteriaDeduction, 0);
}

export function calculateDecemberProratedThr(
  adjustedBaseSalary: number,
  monthsWorked: number = DEFAULT_DECEMBER_THR_MONTHS,
): number {
  if (adjustedBaseSalary <= 0 || monthsWorked <= 0) return 0;
  return Math.round((monthsWorked / 12) * adjustedBaseSalary);
}

export function sumExtraIncome(
  transactions: Array<{ type: string; sourceType?: string | null; amount: number }>,
): number {
  return transactions
    .filter((t) => t.type === 'INCOME' && t.sourceType !== 'OPERATIONAL_REFUND')
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

export function calculateFinalTotalIncome(
  netSalaryIncome: number,
  thrAmount: number = 0,
  bonusAmount: number = 0,
  extraIncome: number = 0,
): number {
  return netSalaryIncome + thrAmount + bonusAmount + extraIncome;
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const salaryAdjustment = input.salaryAdjustment ?? 0;
  const cafeteriaDeduction = input.cafeteriaDeduction ?? 0;
  const thrAmount = input.thrAmount ?? 0;
  const bonusAmount = input.bonusAmount ?? 0;
  const extraIncome = input.extraIncome ?? 0;
  const laptopAllowance = input.laptopAllowance ?? DEFAULT_LAPTOP_ALLOWANCE;
  const bpjsRate = input.bpjsRate ?? DEFAULT_BPJS_RATE;

  const normalizedAdjustments: PayrollAdjustmentItem[] = Array.isArray(
    input.customAdjustments,
  )
    ? input.customAdjustments
        .map((adj) => ({
          id: adj.id,
          templateId: adj.templateId ?? null,
          label: String(adj.label || '').trim(),
          stage: adj.stage,
          amount: Math.max(0, Math.round(Number(adj.amount) || 0)),
          notes: adj.notes ?? null,
        }))
        .filter((adj) => adj.amount > 0 && adj.label.length > 0)
    : [];

  const customPayrollAdditions = normalizedAdjustments
    .filter((a) => a.stage === 'PRE_NET_EARNING')
    .reduce((sum, a) => sum + a.amount, 0);
  const customPayrollDeductions = normalizedAdjustments
    .filter((a) => a.stage === 'PRE_NET_DEDUCTION')
    .reduce((sum, a) => sum + a.amount, 0);
  const directPayrollDeductions = normalizedAdjustments
    .filter((a) => a.stage === 'POST_NET_DEDUCTION')
    .reduce((sum, a) => sum + a.amount, 0);

  const adjustedBaseSalary = calculateAdjustedBaseSalary(
    input.baseSalary,
    salaryAdjustment,
  );
  const bpjsDeduction = calculateBpjsDeduction(adjustedBaseSalary, bpjsRate);
  const netBasePayroll = calculateNetBasePayroll(
    adjustedBaseSalary,
    bpjsDeduction,
    laptopAllowance,
  );
  const totalDailyAllowance = calculateTotalDailyAllowance(
    input.totalWorkingDays,
    input.dailyAllowance,
  );
  const netSalaryIncome = calculateNetSalaryIncome(
    netBasePayroll + customPayrollAdditions,
    totalDailyAllowance,
    cafeteriaDeduction + customPayrollDeductions,
  );
  const bankTakeHomeSalary = Math.max(
    0,
    netSalaryIncome - directPayrollDeductions,
  );
  const finalTotalIncome = calculateFinalTotalIncome(
    bankTakeHomeSalary,
    thrAmount,
    bonusAmount,
    extraIncome,
  );

  return {
    baseSalary: input.baseSalary,
    salaryAdjustment,
    adjustedBaseSalary,
    bpjsDeduction,
    laptopAllowance,
    netBasePayroll,
    totalWorkingDays: input.totalWorkingDays,
    dailyAllowance: input.dailyAllowance,
    totalDailyAllowance,
    netSalaryIncome,
    customPayrollAdditions,
    customPayrollDeductions,
    directPayrollDeductions,
    bankTakeHomeSalary,
    customAdjustments: normalizedAdjustments,
    extraIncome,
    finalTotalIncome,
    thrAmount,
    bonusAmount,
    cafeteriaDeduction,
  };
}

function parseStrictIsoDateUtc(raw: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((raw ?? '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Computes PT Indodev / DataOn SunFish calendar-day proration for a partial joining month
 * using Gross Base Salary ONLY (excluding fixed laptop/transport allowances).
 */
export function calculateProratedSalaryByDates(
  grossBaseSalary: number,
  joinDateIso: string,
  month: number,
  year: number,
): { daysWorkedInMonth: number; daysInMonth: number; proratedBaseRp: number } {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (grossBaseSalary <= 0) {
    return { daysWorkedInMonth: 0, daysInMonth, proratedBaseRp: 0 };
  }
  const join = parseStrictIsoDateUtc(joinDateIso);
  if (!join) {
    return {
      daysWorkedInMonth: daysInMonth,
      daysInMonth,
      proratedBaseRp: Math.round(grossBaseSalary),
    };
  }
  if (join.year > year || (join.year === year && join.month > month)) {
    return { daysWorkedInMonth: 0, daysInMonth, proratedBaseRp: 0 };
  }
  const daysWorkedInMonth =
    join.year < year || (join.year === year && join.month < month)
      ? daysInMonth
      : Math.max(0, daysInMonth - join.day + 1);
  return {
    daysWorkedInMonth,
    daysInMonth,
    proratedBaseRp: Math.round((daysWorkedInMonth / daysInMonth) * grossBaseSalary),
  };
}

/**
 * Computes Natal THR on Gross Base Salary ONLY (excluding laptop allowance), returning both:
 * - SunFish exact calendar-day proration (`daysInclusive / 365 * grossBaseSalary`)
 * - Permenaker No. 6/2016 statutory completed-month floor (`floorMonths / 12 * grossBaseSalary`)
 */
export function calculateDecemberProratedThrByDates(
  grossBaseSalary: number,
  joinDateIso: string,
  holidayDateIso: string,
): {
  exactCalendarDays: number;
  exactDaysAmountRp: number;
  completedMonths: number;
  completedMonthsFloorAmountRp: number;
  sunfishCutoffAmountRp: number;
} {
  if (grossBaseSalary <= 0) {
    return {
      exactCalendarDays: 0,
      exactDaysAmountRp: 0,
      completedMonths: 0,
      completedMonthsFloorAmountRp: 0,
      sunfishCutoffAmountRp: 0,
    };
  }
  const join = parseStrictIsoDateUtc(joinDateIso);
  const holiday = parseStrictIsoDateUtc(holidayDateIso);
  if (!join || !holiday) {
    return {
      exactCalendarDays: 0,
      exactDaysAmountRp: 0,
      completedMonths: 0,
      completedMonthsFloorAmountRp: 0,
      sunfishCutoffAmountRp: 0,
    };
  }
  const joinUtc = Date.UTC(join.year, join.month - 1, join.day);
  const holidayUtc = Date.UTC(holiday.year, holiday.month - 1, holiday.day);
  if (holidayUtc < joinUtc) {
    return {
      exactCalendarDays: 0,
      exactDaysAmountRp: 0,
      completedMonths: 0,
      completedMonthsFloorAmountRp: 0,
      sunfishCutoffAmountRp: 0,
    };
  }
  const exactCalendarDays = Math.floor((holidayUtc - joinUtc) / 86400000) + 1;
  const effectiveDays = Math.min(365, exactCalendarDays);
  const exactDaysAmountRp = Math.round((effectiveDays / 365) * grossBaseSalary);

  const rawMonths =
    (holiday.year - join.year) * 12 +
    (holiday.month - join.month) -
    (holiday.day < join.day ? 1 : 0);
  const completedMonths = Math.max(0, Math.min(12, rawMonths));
  const completedMonthsFloorAmountRp = Math.round((completedMonths / 12) * grossBaseSalary);

  return {
    exactCalendarDays,
    exactDaysAmountRp,
    completedMonths,
    completedMonthsFloorAmountRp,
    sunfishCutoffAmountRp: exactDaysAmountRp,
  };
}
