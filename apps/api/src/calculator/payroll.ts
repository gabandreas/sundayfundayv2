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

/**
 * Computes the attendance cutoff window (16th of month M-1 through 15th of month M)
 * and counts Monday–Friday working days excluding Indonesian public holidays.
 */
export function getWorkingDaysCutoffWindow(
  month: number,
  year: number,
  customHolidays: Record<string, string> = INDONESIAN_PUBLIC_HOLIDAYS_2026_2027,
): WorkingDaysCutoffResult {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const startUtc = Date.UTC(prevYear, prevMonth - 1, 16);
  const endUtc = Date.UTC(year, month - 1, 15);

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
  const prevLabel = `${16} ${SHORT_MONTH_LABELS[prevMonth - 1]} ${prevYear}`;
  const currLabel = `${15} ${SHORT_MONTH_LABELS[month - 1]} ${year}`;

  return {
    month,
    year,
    startDateIso: `${prevYear}-${String(prevMonth).padStart(2, '0')}-16`,
    endDateIso: `${year}-${String(month).padStart(2, '0')}-15`,
    windowLabel: `${prevLabel} – ${currLabel}`,
    totalWeekdays,
    holidaysInWindow,
    workingDays,
  };
}

export function calculateWorkingDaysForPeriod(
  month: number,
  year: number,
): number {
  return getWorkingDaysCutoffWindow(month, year).workingDays;
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

  const adjustedBaseSalary = calculateAdjustedBaseSalary(
    input.baseSalary,
    salaryAdjustment,
  );
  const bpjsDeduction = calculateBpjsDeduction(adjustedBaseSalary);
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
    netBasePayroll,
    totalDailyAllowance,
    cafeteriaDeduction,
  );
  const finalTotalIncome = calculateFinalTotalIncome(
    netSalaryIncome,
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
    extraIncome,
    finalTotalIncome,
    thrAmount,
    bonusAmount,
    cafeteriaDeduction,
  };
}
