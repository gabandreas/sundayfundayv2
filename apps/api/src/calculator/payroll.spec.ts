import {
  calculateAdjustedBaseSalary,
  calculateBpjsDeduction,
  calculateNetBasePayroll,
  calculateTotalDailyAllowance,
  calculateNetSalaryIncome,
  calculateDecemberProratedThr,
  sumExtraIncome,
  calculateFinalTotalIncome,
  calculatePayroll,
  getWorkingDaysCutoffWindow,
  calculateWorkingDaysForPeriod,
  DEFAULT_LAPTOP_ALLOWANCE,
} from './payroll';

describe('payroll calculator', () => {
  describe('individual formula step functions', () => {
    it('calculates adjustedBaseSalary', () => {
      expect(calculateAdjustedBaseSalary(10000000, 500000)).toBe(10500000);
      expect(calculateAdjustedBaseSalary(10000000)).toBe(10000000);
    });

    it('calculates bpjsDeduction with rounding', () => {
      expect(calculateBpjsDeduction(10500000)).toBe(315000);
      expect(calculateBpjsDeduction(0)).toBe(0);
      expect(calculateBpjsDeduction(-100)).toBe(0);
    });

    it('calculates netBasePayroll with laptop allowance', () => {
      expect(calculateNetBasePayroll(10500000, 315000)).toBe(10435000);
      expect(calculateNetBasePayroll(10500000, 315000, 300000)).toBe(10485000);
    });

    it('calculates totalDailyAllowance', () => {
      expect(calculateTotalDailyAllowance(21, 50000)).toBe(1050000);
      expect(calculateTotalDailyAllowance(0, 50000)).toBe(0);
      expect(calculateTotalDailyAllowance(21, 0)).toBe(0);
    });

    it('calculates netSalaryIncome with floor at 0', () => {
      expect(calculateNetSalaryIncome(10435000, 1050000, 150000)).toBe(
        11335000,
      );
      expect(calculateNetSalaryIncome(1000000, 100000, 2000000)).toBe(0);
    });

    it('calculates finalTotalIncome summing net salary, thr, bonus, and extra income', () => {
      expect(
        calculateFinalTotalIncome(11335000, 7726250, 500000, 1000000),
      ).toBe(20561250);
    });
  });

  describe('normal case with realistic Indonesian figures', () => {
    it('should compute exact formula chain correctly', () => {
      const input = {
        baseSalary: 10000000,
        salaryAdjustment: 500000,
        totalWorkingDays: 21,
        dailyAllowance: 50000,
        cafeteriaDeduction: 150000,
        bonusAmount: 500000,
        thrAmount: 0,
        extraIncome: 1000000,
        laptopAllowance: DEFAULT_LAPTOP_ALLOWANCE,
      };

      const result = calculatePayroll(input);

      // adjustedBaseSalary = 10,000,000 + 500,000 = 10,500,000
      expect(result.adjustedBaseSalary).toBe(10500000);

      // bpjsDeduction = round(10,500,000 * 0.03) = 315,000
      expect(result.bpjsDeduction).toBe(315000);

      // netBasePayroll = 10,500,000 - 315,000 + 250,000 = 10,435,000
      expect(result.netBasePayroll).toBe(10435000);

      // totalDailyAllowance = 21 * 50,000 = 1,050,000
      expect(result.totalDailyAllowance).toBe(1050000);

      // netSalaryIncome = max(10,435,000 + 1,050,000 - 150,000, 0) = 11,335,000
      expect(result.netSalaryIncome).toBe(11335000);

      // finalTotalIncome = 11,335,000 + 0 + 500,000 + 1,000,000 = 12,835,000
      expect(result.finalTotalIncome).toBe(12835000);
    });
  });

  describe('December pro-rated THR calculation', () => {
    it('should calculate pro-rated THR for 8.83 months accurately', () => {
      const adjustedBaseSalary = 10500000;
      const thr = calculateDecemberProratedThr(adjustedBaseSalary);
      // Math.round((8.83 / 12) * 10,500,000) = Math.round(7726250)
      expect(thr).toBe(7726250);
    });

    it('should calculate pro-rated THR for custom months worked', () => {
      const adjustedBaseSalary = 12000000;
      const thr6Months = calculateDecemberProratedThr(adjustedBaseSalary, 6);
      expect(thr6Months).toBe(6000000);

      const thr12Months = calculateDecemberProratedThr(adjustedBaseSalary, 12);
      expect(thr12Months).toBe(12000000);
    });

    it('should return 0 when base salary or months is 0 or negative', () => {
      expect(calculateDecemberProratedThr(0)).toBe(0);
      expect(calculateDecemberProratedThr(-1000000)).toBe(0);
      expect(calculateDecemberProratedThr(10000000, 0)).toBe(0);
      expect(calculateDecemberProratedThr(10000000, -1)).toBe(0);
    });

    it('should toggle December THR on and off in final total income', () => {
      const baseInput = {
        baseSalary: 10000000,
        totalWorkingDays: 20,
        dailyAllowance: 50000,
      };

      const resultThrOff = calculatePayroll({
        ...baseInput,
        thrAmount: 0,
      });

      const thrAmount = calculateDecemberProratedThr(
        resultThrOff.adjustedBaseSalary,
      );
      const resultThrOn = calculatePayroll({
        ...baseInput,
        thrAmount,
      });

      expect(resultThrOn.finalTotalIncome - resultThrOff.finalTotalIncome).toBe(
        thrAmount,
      );
    });
  });

  describe('V1 Bug #3 regression guard: Windfall / Extra Income double-counting', () => {
    it('includes extra income directly in finalTotalIncome and does not require manual addition', () => {
      const transactions = [
        { type: 'INCOME', amount: 1500000 },
        { type: 'INCOME', amount: 500000 },
        { type: 'DEDUCTION', amount: 200000 },
      ];

      const extraIncome = sumExtraIncome(transactions);
      expect(extraIncome).toBe(2000000);

      const payroll = calculatePayroll({
        baseSalary: 10000000,
        totalWorkingDays: 20,
        dailyAllowance: 50000,
        extraIncome,
      });

      // finalTotalIncome must already contain extraIncome
      expect(payroll.finalTotalIncome).toBe(
        payroll.netSalaryIncome + extraIncome,
      );

      // Regression check: If a consumer were to erroneously do finalTotalIncome + extraIncome,
      // it would be strictly greater than payroll.finalTotalIncome
      const buggedDoubleCountedIncome = payroll.finalTotalIncome + extraIncome;
      expect(payroll.finalTotalIncome).not.toBe(buggedDoubleCountedIncome);
    });

    it('excludes OPERATIONAL_REFUND inflows from extraIncome so reimbursements do not inflate finalTotalIncome', () => {
      const transactions = [
        { type: 'INCOME', sourceType: 'MANUAL', amount: 1000000 },
        { type: 'INCOME', sourceType: 'OPERATIONAL_REFUND', amount: 150000 },
        { type: 'DEDUCTION', sourceType: 'MANUAL', amount: 300000 },
      ];

      expect(sumExtraIncome(transactions)).toBe(1000000);
    });
  });

  describe('edge cases', () => {
    it('should clamp netSalaryIncome to 0 when cafeteria deduction exceeds earnings', () => {
      const result = calculatePayroll({
        baseSalary: 3000000,
        totalWorkingDays: 10,
        dailyAllowance: 20000,
        cafeteriaDeduction: 10000000, // exceeds salary
      });

      expect(result.netSalaryIncome).toBe(0);
      expect(result.finalTotalIncome).toBe(0);
    });

    it('should handle zero base salary and zero working days', () => {
      const result = calculatePayroll({
        baseSalary: 0,
        totalWorkingDays: 0,
        dailyAllowance: 50000,
      });

      expect(result.adjustedBaseSalary).toBe(0);
      expect(result.bpjsDeduction).toBe(0);
      expect(result.netBasePayroll).toBe(DEFAULT_LAPTOP_ALLOWANCE);
      expect(result.totalDailyAllowance).toBe(0);
      expect(result.netSalaryIncome).toBe(DEFAULT_LAPTOP_ALLOWANCE);
      expect(result.finalTotalIncome).toBe(DEFAULT_LAPTOP_ALLOWANCE);
    });

    it('should handle negative salary adjustments correctly', () => {
      const result = calculateAdjustedBaseSalary(10000000, -2000000);
      expect(result).toBe(8000000);
    });
  });

  describe('2026–2027 Indonesian Public Holidays & Working-Days Cutoff Calculator (16th M-1 to 15th M)', () => {
    it('calculates cross-year cutoff for January 2027 (16 Dec 2026 – 15 Jan 2027) excluding Christmas, New Year, and Isra Mikraj', () => {
      const jan2027 = getWorkingDaysCutoffWindow(1, 2027);
      expect(jan2027.startDateIso).toBe('2026-12-16');
      expect(jan2027.endDateIso).toBe('2027-01-15');
      expect(jan2027.totalWeekdays).toBe(23);
      expect(jan2027.holidaysInWindow.map((h) => h.date)).toEqual([
        '2026-12-25',
        '2027-01-01',
        '2027-01-05',
      ]);
      expect(jan2027.workingDays).toBe(20);
      expect(calculateWorkingDaysForPeriod(1, 2027)).toBe(20);
    });

    it('calculates 2026 and full-year 2027 periods accurately across holiday windows', () => {
      // July 2026 (16 Jun 2026 – 15 Jul 2026): 22 weekdays - 2 Muharram holidays = 20 days
      expect(calculateWorkingDaysForPeriod(7, 2026)).toBe(20);
      // September 2026 (16 Aug 2026 – 15 Sep 2026): 22 weekdays - 2 (17 Aug, 25 Aug) = 20 days
      expect(calculateWorkingDaysForPeriod(9, 2026)).toBe(20);
      // December 2026 (16 Nov 2026 – 15 Dec 2026): 22 weekdays - 0 holidays = 22 days
      expect(calculateWorkingDaysForPeriod(12, 2026)).toBe(22);
      // March 2027 (16 Feb 2027 – 15 Mar 2027): includes Idul Fitri 1448 H week
      const mar2027 = getWorkingDaysCutoffWindow(3, 2027);
      expect(mar2027.holidaysInWindow.length).toBe(5);
      expect(mar2027.workingDays).toBe(mar2027.totalWeekdays - 5);
    });
  });
});
