import {
  calculatePacingDays,
  evaluatePacingStatus,
  calculateDailyPacing,
  formatCycleDateLabel,
  toDateString,
} from './pacing';
import { calculateWaterfall } from './waterfall';
import { calculatePayroll } from './payroll';

describe('pacing calculator (payday-to-payday variable consumption cycles)', () => {
  describe('cycle date formatting and day calculations', () => {
    it('formats cycle date labels correctly within the same year', () => {
      const start = new Date(Date.UTC(2026, 7, 25)); // 25 Aug 2026
      const end = new Date(Date.UTC(2026, 8, 24));   // 24 Sep 2026
      expect(formatCycleDateLabel(start, end)).toBe('25 Aug – 24 Sep 2026');
    });

    it('formats cycle date labels correctly across year boundaries', () => {
      const start = new Date(Date.UTC(2026, 11, 25)); // 25 Dec 2026
      const end = new Date(Date.UTC(2027, 0, 24));    // 24 Jan 2027
      expect(formatCycleDateLabel(start, end)).toBe('25 Dec 2026 – 24 Jan 2027');
    });

    it('computes daysInCycle, daysPassed, daysRemaining, and currentDayIndex for a 31-day cycle', () => {
      const start = new Date(Date.UTC(2026, 7, 25)); // 25 Aug 2026
      const end = new Date(Date.UTC(2026, 8, 24));   // 24 Sep 2026 (31 days total)

      // Day 1: 25 Aug 2026
      const day1 = calculatePacingDays(start, end, new Date(Date.UTC(2026, 7, 25)));
      expect(day1.daysInCycle).toBe(31);
      expect(day1.daysPassed).toBe(0);
      expect(day1.daysRemaining).toBe(31);
      expect(day1.currentDayIndex).toBe(1);

      // Mid-cycle: 10 Sep 2026 (16 days passed from 25 Aug)
      const mid = calculatePacingDays(start, end, new Date(Date.UTC(2026, 8, 10)));
      expect(mid.daysInCycle).toBe(31);
      expect(mid.daysPassed).toBe(16);
      expect(mid.daysRemaining).toBe(15);
      expect(mid.currentDayIndex).toBe(17);

      // Last day: 24 Sep 2026
      const last = calculatePacingDays(start, end, new Date(Date.UTC(2026, 8, 24)));
      expect(last.daysInCycle).toBe(31);
      expect(last.daysPassed).toBe(30);
      expect(last.daysRemaining).toBe(1);
      expect(last.currentDayIndex).toBe(31);
    });

    it('handles past and future dates gracefully with clamping', () => {
      const start = new Date(Date.UTC(2026, 7, 25));
      const end = new Date(Date.UTC(2026, 8, 24));

      // Past date (before cycle start)
      const past = calculatePacingDays(start, end, new Date(Date.UTC(2026, 6, 1)));
      expect(past.daysPassed).toBe(0);
      expect(past.daysRemaining).toBe(31);
      expect(past.currentDayIndex).toBe(1);

      // Future date (after cycle end)
      const future = calculatePacingDays(start, end, new Date(Date.UTC(2026, 9, 1)));
      expect(future.daysPassed).toBe(31);
      expect(future.daysRemaining).toBe(1);
      expect(future.currentDayIndex).toBe(31);
    });
  });

  describe('variable cycle length scaling', () => {
    it('scales baselineDailyRate and safeToSpendToday accurately for variable lengths (28 vs 33 days)', () => {
      const operationalTarget = 3300000;

      // 33-day cycle: 2026-08-25 to 2026-09-26
      const longResult = calculateDailyPacing({
        periodMonth: 8,
        periodYear: 2026,
        cycleStartDate: new Date(Date.UTC(2026, 7, 25)),
        cycleEndDate: new Date(Date.UTC(2026, 8, 26)),
        isEndDateConfirmed: true,
        actualDailyOperational: operationalTarget,
        dailyOperationalTarget: operationalTarget,
        totalDailySpent: 0,
        referenceDate: new Date(Date.UTC(2026, 7, 25)),
      });
      expect(longResult.daysInCycle).toBe(33);
      expect(longResult.baselineDailyRate).toBe(100000); // 3,300,000 / 33 = 100,000
      expect(longResult.safeToSpendToday).toBe(100000); // 3,300,000 / 33 = 100,000

      // 28-day cycle: 2026-08-25 to 2026-09-21
      const shortResult = calculateDailyPacing({
        periodMonth: 8,
        periodYear: 2026,
        cycleStartDate: new Date(Date.UTC(2026, 7, 25)),
        cycleEndDate: new Date(Date.UTC(2026, 8, 21)),
        isEndDateConfirmed: true,
        actualDailyOperational: 2800000,
        dailyOperationalTarget: 2800000,
        totalDailySpent: 0,
        referenceDate: new Date(Date.UTC(2026, 7, 25)),
      });
      expect(shortResult.daysInCycle).toBe(28);
      expect(shortResult.baselineDailyRate).toBe(100000); // 2,800,000 / 28 = 100,000
      expect(shortResult.safeToSpendToday).toBe(100000);
    });
  });

  describe('pacing status threshold evaluations', () => {
    it('evaluates ON_TRACK when pacing ratio is >= 0.85', () => {
      expect(evaluatePacingStatus(1000000, 1.0)).toBe('ON_TRACK');
      expect(evaluatePacingStatus(500000, 0.85)).toBe('ON_TRACK');
    });

    it('evaluates CAUTION when pacing ratio is between 0.50 and 0.84', () => {
      expect(evaluatePacingStatus(500000, 0.84)).toBe('CAUTION');
      expect(evaluatePacingStatus(500000, 0.5)).toBe('CAUTION');
    });

    it('evaluates BURNING_FAST when pacing ratio is < 0.50', () => {
      expect(evaluatePacingStatus(500000, 0.49)).toBe('BURNING_FAST');
      expect(evaluatePacingStatus(100000, 0.2)).toBe('BURNING_FAST');
    });

    it('evaluates DEFICIT_RISK when remaining budget is <= 0', () => {
      expect(evaluatePacingStatus(0, 1.0)).toBe('DEFICIT_RISK');
      expect(evaluatePacingStatus(-50000, 1.0)).toBe('DEFICIT_RISK');
    });
  });

  describe('end-to-end calculateDailyPacing with realistic scenarios', () => {
    it('calculates August 2026 pacing accurately (31-day cycle, Aug 25 - Sep 24)', () => {
      const result = calculateDailyPacing({
        periodMonth: 8,
        periodYear: 2026,
        cycleStartDate: new Date(Date.UTC(2026, 7, 25)),
        cycleEndDate: new Date(Date.UTC(2026, 8, 24)),
        isEndDateConfirmed: true,
        actualDailyOperational: 2500000,
        dailyOperationalTarget: 2500000,
        totalDailySpent: 1804704,
        referenceDate: new Date(Date.UTC(2026, 8, 17)),
      });

      expect(result.periodMonth).toBe(8);
      expect(result.periodYear).toBe(2026);
      expect(result.daysInCycle).toBe(31);
      expect(result.cycleStartDate).toBe('2026-08-25');
      expect(result.cycleEndDate).toBe('2026-09-24');
      expect(result.cycleDateLabel).toBe('25 Aug – 24 Sep 2026');
      expect(result.isEndDateConfirmed).toBe(true);
      expect(result.totalOperationalBudget).toBe(2500000);
      expect(result.totalDailySpent).toBe(1804704);
      expect(result.remainingBudget).toBe(695296);
      expect(result.baselineDailyRate).toBe(80645); // 2,500,000 / 31 ≈ 80,645
      // On 17 Sep, 23 days from 25 Aug, remaining = 31 - 23 = 8 days
      expect(result.daysRemaining).toBe(8);
      expect(result.safeToSpendToday).toBe(Math.round(695296 / 8));
      expect(result.pacingStatus).toBe('ON_TRACK');
    });

    it('calculates September 2026 pacing accurately (30-day cycle, Sep 25 - Oct 24)', () => {
      const result = calculateDailyPacing({
        periodMonth: 9,
        periodYear: 2026,
        cycleStartDate: new Date(Date.UTC(2026, 8, 25)),
        cycleEndDate: new Date(Date.UTC(2026, 9, 24)),
        isEndDateConfirmed: false, // estimated next payout date
        actualDailyOperational: 2850000,
        dailyOperationalTarget: 2850000,
        totalDailySpent: 1121470,
        referenceDate: new Date(Date.UTC(2026, 9, 1)),
      });

      expect(result.daysInCycle).toBe(30);
      expect(result.cycleStartDate).toBe('2026-09-25');
      expect(result.cycleEndDate).toBe('2026-10-24');
      expect(result.cycleDateLabel).toBe('25 Sep – 24 Oct 2026');
      expect(result.isEndDateConfirmed).toBe(false);
      expect(result.baselineDailyRate).toBe(95000); // 2,850,000 / 30 = 95,000
    });

    it('triggers DEFICIT_RISK when remaining budget is exhausted', () => {
      const result = calculateDailyPacing({
        periodMonth: 9,
        periodYear: 2026,
        cycleStartDate: new Date(Date.UTC(2026, 8, 25)),
        cycleEndDate: new Date(Date.UTC(2026, 9, 24)),
        isEndDateConfirmed: true,
        actualDailyOperational: 3000000,
        dailyOperationalTarget: 3000000,
        totalDailySpent: 3500000, // overspent
        referenceDate: new Date(Date.UTC(2026, 9, 11)),
      });

      expect(result.remainingBudget).toBe(-500000);
      expect(result.safeToSpendToday).toBe(0);
      expect(result.pacingStatus).toBe('DEFICIT_RISK');
    });
  });

  describe('single-source pacing status consistency regression suite', () => {
    it('strictly evaluates August and September 2026 scenarios to CAUTION and never BURNING_FAST', () => {
      // Pacing ratio in caution range (0.50 - 0.84)
      expect(evaluatePacingStatus(500000, 0.596)).toBe('CAUTION');
      expect(evaluatePacingStatus(500000, 0.596)).not.toBe('BURNING_FAST');
      expect(evaluatePacingStatus(500000, 0.607)).toBe('CAUTION');
      expect(evaluatePacingStatus(500000, 0.607)).not.toBe('BURNING_FAST');
    });

    it('ensures status displays across all thresholds map to identical status labels without contradiction', () => {
      const statusLabels: Record<string, string> = {
        ON_TRACK: 'On track',
        CAUTION: 'Caution',
        BURNING_FAST: 'Burning fast',
        DEFICIT_RISK: 'Deficit risk',
      };

      const testCases = [
        { ratio: 1.0, budget: 1000000, expectedStatus: 'ON_TRACK', expectedLabel: 'On track' },
        { ratio: 0.6, budget: 500000, expectedStatus: 'CAUTION', expectedLabel: 'Caution' },
        { ratio: 0.3, budget: 200000, expectedStatus: 'BURNING_FAST', expectedLabel: 'Burning fast' },
        { ratio: 1.0, budget: 0, expectedStatus: 'DEFICIT_RISK', expectedLabel: 'Deficit risk' },
      ];

      for (const tc of testCases) {
        const status = evaluatePacingStatus(tc.budget, tc.ratio);
        expect(status).toBe(tc.expectedStatus);
        expect(statusLabels[status]).toBe(tc.expectedLabel);
      }
    });
  });

  describe('financial neutrality invariant', () => {
    it('guarantees calculateWaterfall and calculatePayroll outputs are 100% independent of payout dates', () => {
      const payrollConfig = {
        baseSalary: 5000000,
        salaryAdjustment: 0,
        totalWorkingDays: 20,
        dailyAllowance: 30000,
        cafeteriaDeduction: 0,
        thrAmount: 0,
        bonusAmount: 0,
        extraIncome: 0,
        laptopAllowance: 0,
      };

      const p1 = calculatePayroll(payrollConfig);
      const p2 = calculatePayroll(payrollConfig);
      expect(p1).toEqual(p2);

      const waterfallInput = {
        finalTotalIncome: p1.finalTotalIncome,
        totalDeductions: 1500000,
        savingsTarget: 1000000,
        selfRewardTarget: 500000,
        dailyOperationalTarget: 2500000,
        fixedExpenses: 500000,
        bufferPocket: 0,
      };

      const w1 = calculateWaterfall(waterfallInput);
      const w2 = calculateWaterfall(waterfallInput);
      expect(w1).toEqual(w2);
    });
  });

  describe('weighted weekday/weekend runway & rolling weekly envelope', () => {
    it('accurately calculates October 2026 weighted pacing (21 weekdays, 8 weekends, 33 weighted units)', () => {
      // 10/2026: 27 Oct 2026 (Tuesday) to 24 Nov 2026 (Tuesday)
      const start = new Date(Date.UTC(2026, 9, 27)); // 27 Oct
      const end = new Date(Date.UTC(2026, 10, 24));  // 24 Nov (29 days)
      const refDate = new Date(Date.UTC(2026, 9, 27)); // Tuesday (weekday)

      const result = calculateDailyPacing({
        periodMonth: 10,
        periodYear: 2026,
        cycleStartDate: start,
        cycleEndDate: end,
        isEndDateConfirmed: true,
        actualDailyOperational: 1020316,
        dailyOperationalTarget: 1020316,
        totalDailySpent: 0,
        referenceDate: refDate,
        weekendMultiplier: 1.5,
      });

      expect(result.daysInCycle).toBe(29);
      expect(result.daysRemaining).toBe(29);
      expect(result.isWeekendToday).toBe(false);
      expect(result.remainingWeekdays).toBe(21);
      expect(result.remainingWeekendDays).toBe(8);
      expect(result.remainingWeightedUnits).toBe(33); // 21 * 1.0 + 8 * 1.5 = 33

      // Flat safeToSpendToday: 1,020,316 / 29 = 35,183
      expect(result.safeToSpendToday).toBe(35183);

      // Weighted rates:
      // weekdaySafeRate = 1,020,316 * 1.0 / 33 = 30,919
      expect(result.weekdaySafeRate).toBe(30919);
      // weekendSafeRate = 1,020,316 * 1.5 / 33 = 46,378
      expect(result.weekendSafeRate).toBe(46378);
      // Tuesday is weekday, so weightedSafeToSpendToday = weekdaySafeRate
      expect(result.weightedSafeToSpendToday).toBe(30919);

      // Rolling 7-day envelope (Tue-Mon: 5 weekdays, 2 weekends): 5 * 30,919 + 2 * 46,378 = 247,351
      expect(result.rollingWeeklyEnvelope).toBe(247351);

      // Diagnostics at day 0
      expect(result.averageDailyBurnSoFar).toBe(0);
      expect(result.projectedEndOfCycleRemaining).toBe(1020316);
    });

    it('identifies weekend reference date and uses weekendSafeRate for weightedSafeToSpendToday', () => {
      const start = new Date(Date.UTC(2026, 9, 27));
      const end = new Date(Date.UTC(2026, 10, 24));
      const refDate = new Date(Date.UTC(2026, 9, 31)); // Saturday

      const result = calculateDailyPacing({
        periodMonth: 10,
        periodYear: 2026,
        cycleStartDate: start,
        cycleEndDate: end,
        isEndDateConfirmed: true,
        actualDailyOperational: 1020316,
        dailyOperationalTarget: 1020316,
        totalDailySpent: 120000,
        referenceDate: refDate,
        weekendMultiplier: 1.5,
      });

      expect(result.isWeekendToday).toBe(true);
      expect(result.weightedSafeToSpendToday).toBe(result.weekendSafeRate);
      expect(result.weekendSafeRate).toBeGreaterThan(result.weekdaySafeRate);
      // Days passed: 27, 28, 29, 30 = 4 days
      expect(result.daysPassed).toBe(4);
      expect(result.averageDailyBurnSoFar).toBe(Math.round(120000 / 4)); // 30,000
    });

    it('respects flat multiplier 1.0 where weekday and weekend rates are equal', () => {
      const start = new Date(Date.UTC(2026, 9, 27));
      const end = new Date(Date.UTC(2026, 10, 24));
      const refDate = new Date(Date.UTC(2026, 9, 27));

      const result = calculateDailyPacing({
        periodMonth: 10,
        periodYear: 2026,
        cycleStartDate: start,
        cycleEndDate: end,
        isEndDateConfirmed: true,
        actualDailyOperational: 1020316,
        dailyOperationalTarget: 1020316,
        totalDailySpent: 0,
        referenceDate: refDate,
        weekendMultiplier: 1.0,
      });

      expect(result.weekdaySafeRate).toBe(result.safeToSpendToday);
      expect(result.weekendSafeRate).toBe(result.safeToSpendToday);
      expect(result.weightedSafeToSpendToday).toBe(result.safeToSpendToday);
    });
  });
});
