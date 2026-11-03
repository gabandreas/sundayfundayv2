import {
  buildAllocationDiffRows,
  buildRoutineBillsRealizationRows,
  buildMoneyDriversAndSpikes,
  buildComparativeStatement,
  buildAmortizationSchedule,
  formatReportPeriodLabel,
  formatRevisionCategoryLabel,
} from './reports';

describe('reports calculator', () => {
  describe('buildAllocationDiffRows (3-Column Baseline vs Revised vs Actual)', () => {
    it('reconstructs pre-revision baseline from the earliest BudgetRevision and computes revisionDelta and fundingVariance', () => {
      const rows = buildAllocationDiffRows({
        globalDefaults: {
          dailyOperational: 1000000,
          transport: 250000,
          internet: 150000,
          vape: 260000,
          haircut: 100000,
          bufferPocket: 0,
          savings: 1000000,
          selfRewardTarget: 300000,
        },
        currentTargets: {
          dailyOperational: 800000,
          transport: 250000,
          internet: 150000,
          vape: 260000,
          haircut: 100000,
          bufferPocket: 0,
          savings: 820231,
          selfRewardTarget: 300000,
        },
        actuals: {
          actualDailyOperational: 800000,
          actualSavings: 500397,
          actualSelfReward: 0,
          isDeficit: false,
        },
        revisions: [
          {
            category: 'SAVINGS',
            previousValue: 1000000,
            newValue: 900000,
            createdAt: '2026-10-05T10:00:00.000Z',
          },
          {
            category: 'SAVINGS',
            previousValue: 900000,
            newValue: 820231,
            createdAt: '2026-10-12T10:00:00.000Z',
          },
          {
            category: 'DAILY_OPERATIONAL',
            previousValue: 1000000,
            newValue: 800000,
            createdAt: '2026-10-06T10:00:00.000Z',
          },
        ],
      });

      const savingsRow = rows.find((r) => r.categoryKey === 'SAVINGS')!;
      expect(savingsRow.baselineTarget).toBe(1000000);
      expect(savingsRow.revisedTarget).toBe(820231);
      expect(savingsRow.revisionDelta).toBe(-179769);
      expect(savingsRow.revisionCount).toBe(2);
      expect(savingsRow.actualOutcome).toBe(500397);
      expect(savingsRow.fundingVariance).toBe(500397 - 820231);

      const opRow = rows.find((r) => r.categoryKey === 'DAILY_OPERATIONAL')!;
      expect(opRow.baselineTarget).toBe(1000000);
      expect(opRow.revisedTarget).toBe(800000);
      expect(opRow.revisionDelta).toBe(-200000);
      expect(opRow.revisionCount).toBe(1);
      expect(opRow.actualOutcome).toBe(800000);
      expect(opRow.fundingVariance).toBe(0);
    });
  });

  describe('buildComparativeStatement', () => {
    it('sorts periods chronologically and computes MoM deltas and aggregate ratios', () => {
      const result = buildComparativeStatement('all', [
        {
          month: 9,
          year: 2026,
          status: 'DRAFT',
          finalTotalIncome: 5891000,
          creditBillsAmount: 3607655,
          manualDeductionsAmount: 475000,
          fixedEssentialsAmount: 391000,
          actualDailyOperational: 989000,
          bufferPocketAmount: 0,
          actualSavings: 428345,
          selfReward: 0,
          deficitUncovered: 0,
          disciplineScore: 76,
          realizedVaultAmount: 0,
        },
        {
          month: 8,
          year: 2026,
          status: 'LOCKED',
          finalTotalIncome: 5881400,
          creditBillsAmount: 2985684,
          manualDeductionsAmount: 0,
          fixedEssentialsAmount: 760000,
          actualDailyOperational: 1000000,
          bufferPocketAmount: 0,
          actualSavings: 500000,
          selfReward: 635716,
          deficitUncovered: 0,
          disciplineScore: 76,
          realizedVaultAmount: 0,
        },
      ]);

      expect(result.periodCount).toBe(2);
      expect(result.periods[0].periodLabel).toBe('Aug 2026');
      expect(result.periods[0].incomeMoMDelta).toBeNull();
      expect(result.periods[1].periodLabel).toBe('Sep 2026');
      expect(result.periods[1].incomeMoMDelta).toBe(9600);
      expect(result.periods[1].creditBillsMoMDelta).toBe(3607655 - 2985684);
      expect(result.periods[1].savingsMoMDelta).toBe(428345 - 500000);
      expect(result.totals.totalIncome).toBe(5881400 + 5891000);
      expect(result.totals.totalSavings).toBe(928345);
    });
  });

  describe('buildAmortizationSchedule', () => {
    it('computes 12-month totals, peak month, cumulative settlement percentage, and first debt-free month', () => {
      const schedule = buildAmortizationSchedule(10, 2026, [
        {
          month: 10,
          year: 2026,
          paylaterAmount: 2776139,
          creditCardAmount: 1119900,
          personalDebtAmount: 220000,
          contractInstallmentsAmount: 0,
        },
        {
          month: 11,
          year: 2026,
          paylaterAmount: 1817993,
          creditCardAmount: 728900,
          personalDebtAmount: 0,
          contractInstallmentsAmount: 0,
        },
        {
          month: 12,
          year: 2026,
          paylaterAmount: 0,
          creditCardAmount: 0,
          personalDebtAmount: 0,
          contractInstallmentsAmount: 0,
        },
      ]);

      expect(schedule.summary.peakMonthLabel).toBe('Oct 2026');
      expect(schedule.summary.peakMonthAmount).toBe(4116039);
      expect(schedule.summary.firstDebtFreeMonthLabel).toBe('Dec 2026');
      expect(schedule.months[2].cumulativeSettledPercent).toBe(100);
      expect(formatReportPeriodLabel(10, 2026)).toBe('Oct 2026');
      expect(formatRevisionCategoryLabel('DAILY_OPERATIONAL')).toBe(
        'Daily Living & Food Budget',
      );
    });
  });

  describe('buildMoneyDriversAndSpikes & buildRoutineBillsRealizationRows', () => {
    it('computes biggest cost drivers, MoM debt spikes, and routine bill 4-column realization rows', () => {
      const diffRows = buildAllocationDiffRows({
        globalDefaults: {
          dailyOperational: 2850000,
          transport: 300000,
          internet: 100000,
          vape: 260000,
          haircut: 100000,
          bufferPocket: 0,
          savings: 500000,
          selfRewardTarget: 0,
        },
        currentTargets: {
          dailyOperational: 562000,
          transport: 200000,
          internet: 0,
          vape: 260000,
          haircut: 100000,
          bufferPocket: 0,
          savings: 500000,
          selfRewardTarget: 0,
        },
        actuals: {
          actualDailyOperational: 562000,
          actualSavings: 171316,
          actualSelfReward: 0,
          isDeficit: false,
        },
        revisions: [
          {
            category: 'DAILY_OPERATIONAL',
            previousValue: 2850000,
            newValue: 562000,
            createdAt: '2026-10-10T00:00:00.000Z',
          },
          {
            category: 'TRANSPORT',
            previousValue: 300000,
            newValue: 200000,
            createdAt: '2026-10-10T00:00:00.000Z',
          },
          {
            category: 'INTERNET',
            previousValue: 100000,
            newValue: 0,
            createdAt: '2026-10-10T00:00:00.000Z',
          },
        ],
      });

      const routine = buildRoutineBillsRealizationRows(diffRows, {
        items: [
          {
            category: 'TRANSPORT',
            label: 'Transport',
            target: 200000,
            spent: 150000,
            coveredByPool: 150000,
            overage: 0,
            remainingPool: 50000,
            utilizationPercent: 75,
          },
          {
            category: 'INTERNET',
            label: 'Internet & Connectivity',
            target: 0,
            spent: 0,
            coveredByPool: 0,
            overage: 0,
            remainingPool: 0,
            utilizationPercent: 0,
          },
          {
            category: 'VAPE',
            label: 'Vape Supplies',
            target: 260000,
            spent: 0,
            coveredByPool: 0,
            overage: 0,
            remainingPool: 260000,
            utilizationPercent: 0,
          },
          {
            category: 'HAIRCUT',
            label: 'Haircut & Grooming',
            target: 100000,
            spent: 0,
            coveredByPool: 0,
            overage: 0,
            remainingPool: 100000,
            utilizationPercent: 0,
          },
        ],
        totalTarget: 560000,
        totalSpent: 150000,
        totalCoveredByPool: 150000,
        totalOverage: 0,
        totalRemainingPool: 410000,
      });

      expect(routine.totalInitialPlan).toBe(760000);
      expect(routine.totalRevisedBudget).toBe(560000);
      expect(routine.totalLoggedRealization).toBe(150000);
      expect(routine.totalRemainingPool).toBe(410000);

      const drivers = buildMoneyDriversAndSpikes({
        periodLabel: 'Oct 2026',
        finalTotalIncome: 5891000,
        paylaterBills: 2874824,
        creditCardBills: 1162900,
        personalDebtBills: 147960,
        contractInstallments: 0,
        totalCreditBills: 4185684,
        fixedEssentialsRevised: 560000,
        dailyOperationalBaseline: 2850000,
        dailyOperationalRevised: 562000,
        actualDailyOperational: 562000,
        manualDeductions: 412000,
        actualSavings: 171316,
        savingsRevised: 500000,
        isDeficit: false,
        deficitUncovered: 0,
        newCreditCardChargesInPeriod: [
          { label: 'New Balance 740 Grey Blue', dueAmount: 316500 },
          { label: 'Thrifting T-Shirt Rolling Stones', dueAmount: 180000 },
        ],
        allocationDiffRows: diffRows,
        previousPeriod: {
          periodLabel: 'Sep 2026',
          finalTotalIncome: 5891000,
          paylaterBills: 2523604,
          creditCardBills: 623315,
          personalDebtBills: 0,
          contractInstallments: 0,
          totalCreditBills: 3146919,
          dailyOperational: 989000,
          manualDeductions: 475000,
          actualSavings: 428345,
        },
      });

      expect(drivers.biggestCostDriversHeadline).toContain('71.1%');
      expect(drivers.spikes[0].deltaAmount).toBe(1162900 - 623315);
      expect(drivers.budgetRevisionSummaryText).toContain('Daily Living & Food Budget');
    });
  });
});
