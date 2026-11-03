import {
  buildDefaultPayrollRules,
  buildDefaultAllocationBuckets,
  buildDefaultSurplusSplitRules,
  buildDefaultFinancialPolicy,
  evaluateModularPayroll,
  resolveBucketTarget,
  evaluateModularEngine,
  validateModularRules,
  synthesizeRulesFromSnapshot,
} from './modular-engine';

describe('Modular Formula, Dynamic Bucket & Policy Engine', () => {
  describe('Dynamic Payroll Formula Engine', () => {
    it('evaluates default payroll rules to exact canonical figures', () => {
      const res = evaluateModularPayroll({
        baseSalary: 5000000,
        salaryAdjustment: 0,
        totalWorkingDays: 20,
        dailyAllowance: 20000,
        cafeteriaDeduction: 0,
        bonusAmount: 0,
        extraIncome: 0,
        month: 10,
        payrollRules: buildDefaultPayrollRules(20000, 250000),
      });

      // Adjusted Base: 5,000,000
      // BPJS 3%: 150,000
      // Laptop: 250,000
      // Net Base: 5,000,000 - 150,000 + 250,000 = 5,100,000
      // Attendance: 20 * 20,000 = 400,000
      // Net Salary Income: 5,500,000
      expect(res.adjustedBaseSalary).toBe(5000000);
      expect(res.bpjsDeduction).toBe(150000);
      expect(res.laptopAllowance).toBe(250000);
      expect(res.totalDailyAllowance).toBe(400000);
      expect(res.netSalaryIncome).toBe(5500000);
      expect(res.finalTotalIncome).toBe(5500000);
    });

    it('supports custom percentage, daily rate, and fixed payroll additions/deductions', () => {
      const customRules = [
        {
          id: 'custom_tax',
          label: 'PPh 21 Tax Deduction',
          direction: 'DEDUCTION' as const,
          formulaType: 'PERCENT_OF_BASE' as const,
          value: 5, // 5% of base
          isActive: true,
        },
        {
          id: 'parking_subsidy',
          label: 'Parking Subsidy',
          direction: 'ADDITION' as const,
          formulaType: 'RATE_PER_WORKING_DAY' as const,
          value: 15000, // 15k / day
          isActive: true,
        },
        {
          id: 'cert_bonus',
          label: 'Certification Bonus',
          direction: 'ADDITION' as const,
          formulaType: 'FIXED_AMOUNT' as const,
          value: 750000,
          isActive: true,
        },
      ];

      const res = evaluateModularPayroll({
        baseSalary: 10000000,
        totalWorkingDays: 20,
        month: 10,
        payrollRules: customRules,
      });

      // Base 10,000,000 - 5% tax (500,000) + fixed cert (750,000) = netBase 10,250,000
      // Parking 20 * 15,000 = 300,000
      // Net Salary = 10,550,000
      expect(res.netSalaryIncome).toBe(10550000);
      expect(res.componentBreakdown).toHaveLength(3);
      expect(res.componentBreakdown[0].nominal).toBe(500000);
      expect(res.componentBreakdown[1].nominal).toBe(300000);
      expect(res.componentBreakdown[2].nominal).toBe(750000);
    });

    it('evaluates pro-rated December THR correctly', () => {
      const resDec = evaluateModularPayroll({
        baseSalary: 6000000,
        totalWorkingDays: 20,
        month: 12,
        payrollRules: [
          {
            id: 'december_thr',
            label: 'December THR',
            direction: 'ADDITION' as const,
            formulaType: 'PRORATED_MONTHS_OF_BASE' as const,
            value: 8.83,
            isActive: true,
          },
        ],
      });

      // (8.83 / 12) * 6,000,000 = 4,415,000
      expect(resDec.thrAmount).toBe(4415000);
      expect(resDec.finalTotalIncome).toBe(6000000 + 4415000);
    });
  });

  describe('Dynamic Bucket Target Resolver & Formula Modes', () => {
    const context = {
      finalTotalIncome: 6000000,
      totalCreditBills: 2000000,
      cycleDays: 31,
    };

    it('resolves FIXED_AMOUNT', () => {
      const res = resolveBucketTarget(
        {
          id: 'gym',
          label: 'Gym Membership',
          group: 'FIXED_ESSENTIAL',
          priorityTier: 0,
          formulaType: 'FIXED_AMOUNT',
          value: 350000,
          isActive: true,
        },
        context,
      );
      expect(res.target).toBe(350000);
    });

    it('resolves PERCENT_OF_NET_INCOME', () => {
      const res = resolveBucketTarget(
        {
          id: 'savings',
          label: 'Savings',
          group: 'SAVINGS_P1',
          priorityTier: 1,
          formulaType: 'PERCENT_OF_NET_INCOME',
          value: 20, // 20% of 6,000,000 = 1,200,000
          isActive: true,
        },
        context,
      );
      expect(res.target).toBe(1200000);
    });

    it('resolves PERCENT_OF_DISPOSABLE_AFTER_DEBT against pure credit bills only', () => {
      // Disposable after debt = 6,000,000 - 2,000,000 = 4,000,000
      // 25% of 4,000,000 = 1,000,000
      const res = resolveBucketTarget(
        {
          id: 'daily_operational',
          label: 'Living',
          group: 'DAILY_OPERATIONAL',
          priorityTier: 0,
          formulaType: 'PERCENT_OF_DISPOSABLE_AFTER_DEBT',
          value: 25,
          isActive: true,
        },
        context,
      );
      expect(res.target).toBe(1000000);
    });

    it('resolves DAILY_RATE_TIMES_CYCLE_DAYS', () => {
      // 85,000 * 31 = 2,635,000
      const res = resolveBucketTarget(
        {
          id: 'daily_pacing',
          label: 'Daily Operational Pacing',
          group: 'DAILY_OPERATIONAL',
          priorityTier: 0,
          formulaType: 'DAILY_RATE_TIMES_CYCLE_DAYS',
          value: 85000,
          isActive: true,
        },
        context,
      );
      expect(res.target).toBe(2635000);
    });

    it('enforces minFloorRp and maxCapRp clamps', () => {
      const clampedLow = resolveBucketTarget(
        {
          id: 'savings_low',
          label: 'Savings Low',
          group: 'SAVINGS_P1',
          priorityTier: 1,
          formulaType: 'PERCENT_OF_NET_INCOME',
          value: 5, // 5% of 6,000,000 = 300,000
          minFloorRp: 500000,
          isActive: true,
        },
        context,
      );
      expect(clampedLow.target).toBe(500000);
      expect(clampedLow.capHit).toBe('MIN_FLOOR');

      const clampedHigh = resolveBucketTarget(
        {
          id: 'savings_high',
          label: 'Savings High',
          group: 'SAVINGS_P1',
          priorityTier: 1,
          formulaType: 'PERCENT_OF_NET_INCOME',
          value: 50, // 50% of 6,000,000 = 3,000,000
          maxCapRp: 2000000,
          isActive: true,
        },
        context,
      );
      expect(clampedHigh.target).toBe(2000000);
      expect(clampedHigh.capHit).toBe('MAX_CAP');
    });
  });

  describe('Waterfall Allocation, Priority Tiers & Surplus Split', () => {
    it('executes priority waterfall with 50/50 remainder split', () => {
      const customBuckets = [
        {
          id: 'transport',
          label: 'Transport',
          group: 'FIXED_ESSENTIAL' as const,
          priorityTier: 0,
          formulaType: 'FIXED_AMOUNT' as const,
          value: 300000,
          isActive: true,
        },
        {
          id: 'daily_operational',
          label: 'Daily Living',
          group: 'DAILY_OPERATIONAL' as const,
          priorityTier: 0,
          formulaType: 'FIXED_AMOUNT' as const,
          value: 2000000,
          isActive: true,
        },
        {
          id: 'core_savings',
          label: 'Priority 1 Savings',
          group: 'SAVINGS_P1' as const,
          priorityTier: 1,
          formulaType: 'FIXED_AMOUNT' as const,
          value: 500000,
          isActive: true,
        },
        {
          id: 'self_reward',
          label: 'Self-Reward',
          group: 'SELF_REWARD_P2' as const,
          priorityTier: 2,
          formulaType: 'REMAINDER_OVERFLOW' as const,
          value: 0,
          isActive: true,
        },
      ];

      const res = evaluateModularEngine({
        baseSalary: 5891000,
        totalWorkingDays: 0,
        month: 10,
        year: 2026,
        cycleDays: 30,
        totalCreditBills: 1500000,
        totalDeductions: 1500000,
        payrollRules: [
          {
            id: 'net_fixed',
            label: 'Net Fixed Paycheck',
            direction: 'ADDITION',
            formulaType: 'FIXED_AMOUNT',
            value: 0,
            isActive: false,
          },
        ],
        allocationBuckets: customBuckets,
        surplusSplitRules: {
          splits: [
            { bucketId: 'core_savings', percent: 50 },
            { bucketId: 'self_reward', percent: 50 },
          ],
        },
      });

      // Income: 5,891,000
      // Tier 0: 300,000 + 2,000,000 = 2,300,000
      // Deductions: 1,500,000
      // Available after Tier 0: 5,891,000 - 2,300,000 - 1,500,000 = 2,091,000
      // Tier 1 Savings Target: 500,000 -> fully funded
      // Remainder surplus: 2,091,000 - 500,000 = 1,591,000
      // Surplus 50% extra to Savings: 795,500 -> total actualSavings = 1,295,500
      // Surplus 50% to Self Reward: 795,500 -> total selfReward = 795,500
      expect(res.waterfall.isDeficit).toBe(false);
      expect(res.canonicalSnapshotColumns.actualDailyOperational).toBe(2000000);
      expect(res.canonicalSnapshotColumns.actualSavings).toBe(1295500);
      expect(res.canonicalSnapshotColumns.selfReward).toBe(795500);
    });

    it('respects mid-month budget revision overrides over formula baseline', () => {
      const res = evaluateModularEngine({
        baseSalary: 6000000,
        totalWorkingDays: 0,
        month: 10,
        year: 2026,
        cycleDays: 30,
        totalCreditBills: 1000000,
        totalDeductions: 1000000,
        payrollRules: [
          {
            id: 'net_fixed',
            label: 'Net Fixed Paycheck',
            direction: 'ADDITION',
            formulaType: 'FIXED_AMOUNT',
            value: 0,
            isActive: false,
          },
        ],
        allocationBuckets: [
          {
            id: 'daily_operational',
            label: 'Daily Living',
            group: 'DAILY_OPERATIONAL',
            priorityTier: 0,
            formulaType: 'PERCENT_OF_NET_INCOME',
            value: 30, // Formula baseline: 30% of 6,000,000 = 1,800,000
            isActive: true,
          },
        ],
        budgetRevisions: [
          {
            bucketKey: 'daily_operational',
            newValue: 2200000, // Mid-month override to 2,200,000
          },
        ],
      });

      const opRealization = res.bucketRealizations.find(
        (b) => b.bucketId === 'daily_operational',
      );
      expect(opRealization?.baselineTarget).toBe(1800000);
      expect(opRealization?.revisedTarget).toBe(2200000);
      expect(opRealization?.fundedAmount).toBe(2200000);
    });

    it('correctly tracks custom fixed essential buckets and rolls them into survivalPocket', () => {
      const res = evaluateModularEngine({
        baseSalary: 6000000,
        totalWorkingDays: 0,
        month: 10,
        year: 2026,
        cycleDays: 30,
        totalCreditBills: 1000000,
        totalDeductions: 1000000,
        payrollRules: [
          {
            id: 'net_fixed',
            label: 'Net Fixed Paycheck',
            direction: 'ADDITION',
            formulaType: 'FIXED_AMOUNT',
            value: 0,
            isActive: false,
          },
        ],
        allocationBuckets: [
          {
            id: 'custom_gym',
            label: 'Gym & Fitness',
            group: 'FIXED_ESSENTIAL',
            priorityTier: 0,
            formulaType: 'FIXED_AMOUNT',
            value: 400000,
            isActive: true,
          },
          {
            id: 'daily_operational',
            label: 'Daily Living',
            group: 'DAILY_OPERATIONAL',
            priorityTier: 0,
            formulaType: 'FIXED_AMOUNT',
            value: 2000000,
            isActive: true,
          },
        ],
        transactions: [
          {
            type: 'DEDUCTION',
            bucketKey: 'custom_gym',
            amount: 250000,
          },
        ],
      });

      // survivalPocket = daily_operational (2,000,000) + custom_gym (400,000) = 2,400,000
      expect(res.canonicalSnapshotColumns.survivalPocket).toBe(2400000);

      const gymRealization = res.bucketRealizations.find(
        (b) => b.bucketId === 'custom_gym',
      );
      expect(gymRealization?.fundedAmount).toBe(400000);
      expect(gymRealization?.loggedSpend).toBe(250000);
      expect(gymRealization?.remainingBudget).toBe(150000);
    });
  });

  describe('Validation & Rule Synthesis', () => {
    it('validates surplus split and rejects non-100% total', () => {
      const invalid = validateModularRules(null, null, {
        splits: [
          { bucketId: 'a', percent: 60 },
          { bucketId: 'b', percent: 30 },
        ],
      });
      expect(invalid.isValid).toBe(false);
      expect(invalid.errors[0]).toContain('must sum exactly to 100%');
    });

    it('synthesizes rules from snapshot preserving exact stored figures', () => {
      const snap = {
        baseSalary: 5891000,
        transport: 300000,
        internet: 250000,
        vape: 350000,
        haircut: 91000,
        dailyOperational: 2850000,
        savings: 1000000,
        selfRewardTarget: 200000,
        bufferPocket: 100000,
      };

      const synthesized = synthesizeRulesFromSnapshot(snap);
      expect(synthesized.allocationBuckets).toHaveLength(8);

      const transport = synthesized.allocationBuckets.find(
        (b) => b.id === 'transport',
      );
      expect(transport?.value).toBe(300000);
      expect(transport?.formulaType).toBe('FIXED_AMOUNT');
    });
  });

  describe('Routine Daily Operational Pool Absorption in Modular Engine (No Double-Counting)', () => {
    const fixedExpenses = 285000;
    const dailyOperationalTarget = 1020316;
    const creditBills = 4185684;

    const baseSnapshotInput = {
      baseSalary: 5891000,
      totalWorkingDays: 0,
      dailyAllowance: 0,
      cafeteriaDeduction: 0,
      thrAmount: 0,
      bonusAmount: 0,
      extraIncome: 0,
      month: 10,
      year: 2026,
      cycleDays: 29,
      totalCreditBills: creditBills,
      payrollRules: [
        {
          id: 'base_salary',
          label: 'Base Salary',
          direction: 'ADDITION' as const,
          formulaType: 'PERCENT_OF_BASE' as const,
          value: 0, // 0 delta from adjustedBaseSalary
          isActive: true,
        },
      ],
      allocationBuckets: [
        {
          id: 'transport',
          label: 'Transport',
          group: 'FIXED_ESSENTIAL' as const,
          priorityTier: 0,
          formulaType: 'FIXED_AMOUNT' as const,
          value: 100000,
          isActive: true,
        },
        {
          id: 'internet',
          label: 'Internet',
          group: 'FIXED_ESSENTIAL' as const,
          priorityTier: 0,
          formulaType: 'FIXED_AMOUNT' as const,
          value: 100000,
          isActive: true,
        },
        {
          id: 'vape',
          label: 'Vape',
          group: 'FIXED_ESSENTIAL' as const,
          priorityTier: 0,
          formulaType: 'FIXED_AMOUNT' as const,
          value: 50000,
          isActive: true,
        },
        {
          id: 'haircut',
          label: 'Haircut',
          group: 'FIXED_ESSENTIAL' as const,
          priorityTier: 0,
          formulaType: 'FIXED_AMOUNT' as const,
          value: 35000,
          isActive: true,
        },
        {
          id: 'daily_operational',
          label: 'Daily Living',
          group: 'DAILY_OPERATIONAL' as const,
          priorityTier: 0,
          formulaType: 'FIXED_AMOUNT' as const,
          value: dailyOperationalTarget,
          isActive: true,
        },
        {
          id: 'core_savings',
          label: 'Priority 1 Savings',
          group: 'SAVINGS_P1' as const,
          priorityTier: 1,
          formulaType: 'FIXED_AMOUNT' as const,
          value: 400000,
          isActive: true,
        },
      ],
    };

    it('absorbs routine daily spend into daily_operational bucket: remaining budget drops by Rp 35k while waterfall savings remains 100% invariant', () => {
      // Baseline run without transactions
      const baseline = evaluateModularEngine({
        ...baseSnapshotInput,
        totalDeductions: creditBills,
      });
      expect(baseline.waterfall.actualDailyOperational).toBe(1020316);
      expect(baseline.waterfall.actualSavings).toBe(400000);
      expect(baseline.waterfall.deficitUncovered).toBe(0);

      // Now add a Rp 35,000 lunch transaction
      const transactions = [
        {
          type: 'CREDIT_BILL',
          sourceType: 'BULK_BILL',
          amount: creditBills,
        },
        {
          type: 'DEDUCTION',
          sourceType: 'MANUAL',
          amount: 35000,
          label: 'Lunch',
        },
      ];

      const withLunch = evaluateModularEngine({
        ...baseSnapshotInput,
        transactions,
        // When totalDeductions is computed with dailyOperationalTarget absorption, it remains creditBills
      });

      // 1. In waterfall: savings remains 100% invariant at 400,000!
      expect(withLunch.waterfall.actualDailyOperational).toBe(1020316);
      expect(withLunch.waterfall.actualSavings).toBe(400000);
      expect(withLunch.waterfall.deficitUncovered).toBe(0);

      // 2. In bucket realizations: daily_operational loggedSpend is 35k and remainingBudget drops by 35k
      const dailyOpBucket = withLunch.bucketRealizations.find(
        (b) => b.bucketId === 'daily_operational',
      );
      expect(dailyOpBucket?.fundedAmount).toBe(1020316);
      expect(dailyOpBucket?.loggedSpend).toBe(35000);
      expect(dailyOpBucket?.remainingBudget).toBe(985316);
    });

    it('penalizes waterfall and reduces actualSavings when cumulative daily spend exceeds daily_operational target', () => {
      const overspentTransactions = [
        {
          type: 'CREDIT_BILL',
          sourceType: 'BULK_BILL',
          amount: creditBills,
        },
        {
          type: 'DEDUCTION',
          sourceType: 'MANUAL',
          amount: 1120316, // Rp 100,000 over target of Rp 1,020,316
          label: 'Overspent living expenses',
        },
      ];

      const overspentResult = evaluateModularEngine({
        ...baseSnapshotInput,
        transactions: overspentTransactions,
      });

      // Waterfall available funds reduced by Rp 100k: actualSavings reduced from 400k to 300k
      expect(overspentResult.waterfall.availableFunds).toBe(300000);
      expect(overspentResult.waterfall.actualSavings).toBe(300000);
      expect(overspentResult.waterfall.deficitUncovered).toBe(0);

      // Bucket realization reflects overspend
      const dailyOpBucket = overspentResult.bucketRealizations.find(
        (b) => b.bucketId === 'daily_operational',
      );
      expect(dailyOpBucket?.fundedAmount).toBe(1020316);
      expect(dailyOpBucket?.loggedSpend).toBe(1120316);
      expect(dailyOpBucket?.remainingBudget).toBe(-100000);
    });
  });
});
