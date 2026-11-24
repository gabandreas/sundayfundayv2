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
  calculateWorkingDaysForConsumptionPeriod,
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

    it('maps consumption period M to Payday(M-1) attendance working days for provisioning', () => {
      // 09/2027 consumption cycle is funded by Payday(08/2027), whose attendance cutoff is 16 Jul – 15 Aug 2027 (21 working days)
      expect(calculateWorkingDaysForConsumptionPeriod(9, 2027)).toBe(21);
      expect(calculateWorkingDaysForConsumptionPeriod(2, 2027)).toBe(20);
      expect(calculateWorkingDaysForConsumptionPeriod(4, 2027)).toBe(15);
      expect(calculateWorkingDaysForConsumptionPeriod(8, 2027)).toBe(22);
      expect(calculateWorkingDaysForConsumptionPeriod(1, 2027)).toBe(22);
    });
  });

  describe('PT Indodev / DataOn SunFish Exact Proration & Gross Base THR (2026-04-06 join date)', () => {
    it('proves April 2026 first payslip proration (25/30 * Rp 5.300.000 = Rp 4.416.667 gross base only)', () => {
      const { calculateProratedSalaryByDates, calculateDecemberProratedThrByDates } = require('./payroll');
      const aprilSalary = calculateProratedSalaryByDates(5300000, '2026-04-06', 4, 2026);
      expect(aprilSalary.daysWorkedInMonth).toBe(25);
      expect(aprilSalary.daysInMonth).toBe(30);
      expect(aprilSalary.proratedBaseRp).toBe(4416667);

      // Natal THR (paid H-7 Dec 18 into 12/2026): gross base Rp 5.300.000 ONLY (no laptop allowance) * 264/365 days = Rp 3.833.425
      const natalThr = calculateDecemberProratedThrByDates(5300000, '2026-04-06', '2026-12-25');
      expect(natalThr.exactCalendarDays).toBe(264);
      expect(natalThr.exactDaysAmountRp).toBe(3833425);
      expect(natalThr.completedMonthsFloorAmountRp).toBe(3533333);
    });
  });

  describe('Modular Attendance Window, Feb Clamping & Configurable BPJS/Laptop Rates', () => {
    it('clamps attendanceCutoffStartDay/EndDay cleanly in February (non-leap 2027 -> 28, leap 2028 -> 29) and respects configurable bpjsRate', () => {
      const feb27Window = (getWorkingDaysCutoffWindow as any)(2, 2027, undefined, {
        startDay: 30,
        endDay: 31,
      });
      expect(feb27Window.startDateIso).toBe('2027-01-30');
      expect(feb27Window.endDateIso).toBe('2027-02-28');

      const feb28Leap = (getWorkingDaysCutoffWindow as any)(2, 2028, undefined, {
        startDay: 16,
        endDay: 31,
      });
      expect(feb28Leap.startDateIso).toBe('2028-01-16');
      expect(feb28Leap.endDateIso).toBe('2028-02-29');

      const customPayroll = calculatePayroll({
        baseSalary: 5300000,
        totalWorkingDays: 20,
        dailyAllowance: 25000,
        laptopAllowance: 300000,
        bpjsRate: 0.04,
      } as any);
      expect(customPayroll.bpjsDeduction).toBe(212000);
      expect(customPayroll.netBasePayroll).toBe(5388000);
    });
  });

  describe('Modular Period Adjustments & Post-Net Direct Payroll Deductions (Benefit by GreatDay)', () => {
    it('keeps 0 adjustments byte-identical while deducting POST_NET_DEDUCTION only from bankTakeHomeSalary & finalTotalIncome', () => {
      const noAdj = calculatePayroll({
        baseSalary: 5300000,
        totalWorkingDays: 21,
        dailyAllowance: 25000,
        cafeteriaDeduction: 12000,
        thrAmount: 3833425,
        laptopAllowance: 250000,
        bpjsRate: 0.03,
      });
      expect(noAdj.netSalaryIncome).toBe(5904000);
      expect(noAdj.directPayrollDeductions).toBe(0);
      expect(noAdj.bankTakeHomeSalary).toBe(5904000);
      expect(noAdj.finalTotalIncome).toBe(9737425);

      const withBenefit = calculatePayroll({
        baseSalary: 5300000,
        totalWorkingDays: 21,
        dailyAllowance: 25000,
        cafeteriaDeduction: 12000,
        thrAmount: 3833425,
        laptopAllowance: 250000,
        bpjsRate: 0.03,
        customAdjustments: [
          {
            id: 1,
            label: 'Benefit Deduction for Cash Advance Repayment',
            stage: 'POST_NET_DEDUCTION',
            amount: 350000,
          },
          {
            id: 2,
            label: 'Benefit Deduction for Monthly Fee',
            stage: 'POST_NET_DEDUCTION',
            amount: 10500,
          },
        ],
      });

      // Slip Net Pay matches IDR 5,904,000.00 verbatim
      expect(withBenefit.netSalaryIncome).toBe(5904000);
      expect(withBenefit.directPayrollDeductions).toBe(360500);
      // Permata Transfer matches IDR 5,543,500.00 verbatim
      expect(withBenefit.bankTakeHomeSalary).toBe(5543500);
      expect(withBenefit.finalTotalIncome).toBe(9376925);
    });

    it('applies PRE_NET_EARNING and PRE_NET_DEDUCTION before computing netSalaryIncome and POST_NET_DEDUCTION', () => {
      const result = calculatePayroll({
        baseSalary: 5300000,
        totalWorkingDays: 20,
        dailyAllowance: 25000,
        laptopAllowance: 250000,
        bpjsRate: 0.03,
        customAdjustments: [
          { label: 'Overtime Allowance', stage: 'PRE_NET_EARNING', amount: 200000 },
          { label: 'Medical Copay', stage: 'PRE_NET_DEDUCTION', amount: 50000 },
          { label: 'GreatDay Advance', stage: 'POST_NET_DEDUCTION', amount: 300000 },
        ],
      });

      // Base Net = 5,300,000 - 159,000 + 250,000 + 500,000 = 5,891,000
      // + 200,000 - 50,000 = 6,041,000
      expect(result.customPayrollAdditions).toBe(200000);
      expect(result.customPayrollDeductions).toBe(50000);
      expect(result.netSalaryIncome).toBe(6041000);
      expect(result.directPayrollDeductions).toBe(300000);
      expect(result.bankTakeHomeSalary).toBe(5741000);
      expect(result.finalTotalIncome).toBe(5741000);
    });
  });
});
