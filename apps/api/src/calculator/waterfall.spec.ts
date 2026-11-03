import {
  calculateFixedEssentialsRealization,
  calculateOperationalDailySpent,
  calculateTotalDeductions,
  calculateWaterfall,
} from './waterfall';
import { calculateDailyPacing } from './pacing';

describe('waterfall calculator (2-priority structure)', () => {
  describe('normal surplus case with 2-priority allocation and surplus overflow', () => {
    it('should fund daily operational upfront in full, then allocate between savings (P1) and self-reward (P2)', () => {
      const input = {
        finalTotalIncome: 12000000,
        fixedExpenses: 1500000, // transport + internet + vape + haircut
        dailyOperationalTarget: 3500000,
        bufferPocket: 500000,
        totalDeductions: 2000000,
        savingsTarget: 2000000,
      };

      // essentialAndOperational = 1,500,000 + 3,500,000 = 5,000,000
      // availableFunds = 12,000,000 - 5,000,000 - 500,000 - 2,000,000 = 4,500,000
      const result = calculateWaterfall(input);

      expect(result.availableFunds).toBe(4500000);
      expect(result.isDeficit).toBe(false);
      expect(result.deficitUncovered).toBe(0);

      // Daily Operational is guaranteed in full upfront
      expect(result.actualDailyOperational).toBe(3500000);

      // Priority 1: Savings (Target 2,000,000) -> fully funded
      expect(result.actualSavings).toBe(2000000);

      // Priority 2: Self-Reward absorbs all remaining surplus: 4,500,000 - 2,000,000 = 2,500,000
      expect(result.selfReward).toBe(2500000);
      expect(result.actualSelfReward).toBe(2500000);

      // survivalPocket = actualDailyOperational + fixedExpenses = 3,500,000 + 1,500,000 = 5,000,000
      expect(result.survivalPocket).toBe(5000000);
    });
  });

  describe('daily operational upfront guarantee behavior', () => {
    it('guarantees daily operational in full even when available funds are insufficient for savings target', () => {
      const input = {
        finalTotalIncome: 6000000,
        fixedExpenses: 1000000,
        dailyOperationalTarget: 3000000,
        bufferPocket: 0,
        totalDeductions: 1500000,
        savingsTarget: 1000000,
      };

      // essentialAndOperational = 1,000,000 + 3,000,000 = 4,000,000
      // availableFunds = 6,000,000 - 4,000,000 - 1,500,000 = 500,000
      const result = calculateWaterfall(input);

      // Operational gets 100% of its target
      expect(result.actualDailyOperational).toBe(3000000);
      expect(result.availableFunds).toBe(500000);
      expect(result.isDeficit).toBe(false);

      // Priority 1: Savings gets all 500,000 of remaining available funds (partial funding)
      expect(result.actualSavings).toBe(500000);

      // Priority 2: Self-Reward gets 0
      expect(result.selfReward).toBe(0);
      expect(result.survivalPocket).toBe(4000000);
    });
  });

  describe('exact affordability boundaries', () => {
    it('exact zero boundary: funds exactly cover upfront essentials + operational with 0 available', () => {
      const result = calculateWaterfall({
        finalTotalIncome: 5000000,
        fixedExpenses: 1000000,
        dailyOperationalTarget: 2500000,
        bufferPocket: 0,
        totalDeductions: 1500000,
        savingsTarget: 1000000,
      });

      // essentialAndOperational = 3,500,000
      // available = 5,000,000 - 3,500,000 - 1,500,000 = 0
      expect(result.availableFunds).toBe(0);
      expect(result.isDeficit).toBe(false);
      expect(result.deficitUncovered).toBe(0);
      expect(result.actualDailyOperational).toBe(2500000);
      expect(result.actualSavings).toBe(0);
      expect(result.selfReward).toBe(0);
      expect(result.survivalPocket).toBe(3500000);
    });

    it('exact savings target boundary: funds exactly cover upfront commitments and savings target with 0 self-reward', () => {
      const result = calculateWaterfall({
        finalTotalIncome: 6000000,
        fixedExpenses: 1000000,
        dailyOperationalTarget: 2500000,
        bufferPocket: 0,
        totalDeductions: 1500000,
        savingsTarget: 1000000,
      });

      // available = 6,000,000 - 3,500,000 - 1,500,000 = 1,000,000
      expect(result.availableFunds).toBe(1000000);
      expect(result.isDeficit).toBe(false);
      expect(result.actualDailyOperational).toBe(2500000);
      expect(result.actualSavings).toBe(1000000);
      expect(result.selfReward).toBe(0);
      expect(result.survivalPocket).toBe(3500000);
    });
  });

  describe('deficit branch (availableFunds < 0)', () => {
    it('flags deficit, zeroes waterfall allocations, and sets survivalPocket to essentialAndOperational (need)', () => {
      const input = {
        finalTotalIncome: 5000000,
        fixedExpenses: 1000000,
        dailyOperationalTarget: 3000000,
        bufferPocket: 0,
        totalDeductions: 2000000,
        savingsTarget: 1000000,
      };

      // essentialAndOperational = 1,000,000 + 3,000,000 = 4,000,000
      // availableFunds = 5,000,000 - 4,000,000 - 0 - 2,000,000 = -1,000,000
      const result = calculateWaterfall(input);

      expect(result.availableFunds).toBe(-1000000);
      expect(result.isDeficit).toBe(true);
      expect(result.deficitUncovered).toBe(1000000);

      // Waterfall allocations fail
      expect(result.actualDailyOperational).toBe(0);
      expect(result.actualSavings).toBe(0);
      expect(result.selfReward).toBe(0);
      expect(result.actualSelfReward).toBe(0);

      // survivalPocket reflects essentialAndOperational (baseline NEED)
      expect(result.survivalPocket).toBe(4000000);
    });
  });

  describe('V1 Bug #1 regression guard: Single-source deductions vs double-counted contract installments', () => {
    it('should sum ONLY transaction records and reject separate contract summing', () => {
      const contractMonthlyInstallment = 1500000;
      const transactions = [
        { type: 'CREDIT_BILL', amount: 1500000 },
        { type: 'CREDIT_BILL', amount: 500000 },
        { type: 'DEDUCTION', amount: 250000 },
        { type: 'INCOME', amount: 3000000 }, // Ignored
      ];

      const authoritativeDeductions = calculateTotalDeductions(transactions);
      expect(authoritativeDeductions).toBe(2250000);

      const buggedDoubleCountedDeductions =
        authoritativeDeductions + contractMonthlyInstallment;
      expect(buggedDoubleCountedDeductions).toBe(3750000);

      const waterfallResult = calculateWaterfall({
        finalTotalIncome: 7000000,
        fixedExpenses: 1000000,
        dailyOperationalTarget: 2000000,
        totalDeductions: authoritativeDeductions,
        savingsTarget: 1000000,
      });

      // essentialAndOperational = 1,000,000 + 2,000,000 = 3,000,000
      // available = 7,000,000 - 3,000,000 - 2,250,000 = 1,750,000
      expect(waterfallResult.availableFunds).toBe(1750000);
      expect(waterfallResult.actualDailyOperational).toBe(2000000);
      expect(waterfallResult.actualSavings).toBe(1000000);
      expect(waterfallResult.selfReward).toBe(750000);
      expect(waterfallResult.isDeficit).toBe(false);

      // If double-counted: available would be 7,000,000 - 3,000,000 - 3,750,000 = 250,000
      const buggedAvailableFunds = 7000000 - 3000000 - buggedDoubleCountedDeductions;
      expect(buggedAvailableFunds).toBe(250000);
      expect(waterfallResult.availableFunds).not.toBe(buggedAvailableFunds);
    });
  });

  describe('Fixed Essentials realization vs Daily Operational disambiguation & Operational Refunds', () => {
    it('absorbs Fixed Essential categorized expenses inside the upfront pool unless the category target is exceeded', () => {
      const fixedTargets = {
        transport: 300000,
        internet: 200000,
        vape: 150000,
        haircut: 50000,
      };
      const transactions = [
        { type: 'CREDIT_BILL', sourceType: 'CONTRACT', amount: 1000000 },
        { type: 'DEDUCTION', sourceType: 'MANUAL', amount: 120000 }, // Normal food/coffee
        {
          type: 'DEDUCTION',
          sourceType: 'MANUAL',
          fixedEssentialCategory: 'TRANSPORT',
          amount: 250000, // Within 300,000 transport pool -> 0 overage
        },
        {
          type: 'DEDUCTION',
          sourceType: 'MANUAL',
          fixedEssentialCategory: 'VAPE',
          amount: 190000, // Exceeds 150,000 vape pool by 40,000 -> 40,000 overage
        },
      ];

      const realization = calculateFixedEssentialsRealization(
        transactions,
        fixedTargets,
      );
      expect(realization.totalTarget).toBe(700000);
      expect(realization.totalSpent).toBe(440000);
      expect(realization.totalCoveredByPool).toBe(400000); // 250k transport + 150k vape
      expect(realization.totalOverage).toBe(40000); // 40k vape overage

      // Daily operational spent = 120,000 normal + 40,000 vape overage = 160,000 (NOT 120k + 250k + 190k = 560k!)
      expect(calculateOperationalDailySpent(transactions, fixedTargets)).toBe(
        160000,
      );

      // Total deductions = 1,000,000 credit bill + 160,000 net manual deductions = 1,160,000
      expect(calculateTotalDeductions(transactions, fixedTargets)).toBe(
        1160000,
      );
    });

    it('offsets manual daily spent and total deductions when an OPERATIONAL_REFUND transaction is logged', () => {
      const transactions = [
        { type: 'CREDIT_BILL', sourceType: 'CONTRACT', amount: 1000000 },
        { type: 'DEDUCTION', sourceType: 'MANUAL', amount: 300000 }, // Paid group dinner Rp 300,000
        { type: 'INCOME', sourceType: 'OPERATIONAL_REFUND', amount: 200000 }, // Friends reimbursed Rp 200,000
      ];

      // Net daily spent = 300,000 - 200,000 = 100,000
      expect(calculateOperationalDailySpent(transactions)).toBe(100000);
      // Total deductions = 1,000,000 + 100,000 = 1,100,000
      expect(calculateTotalDeductions(transactions)).toBe(1100000);
    });
  });

  describe('Routine Daily Operational Pool Absorption vs Waterfall Deductions (No Double-Counting)', () => {
    const fixedTargets = {
      transport: 100000,
      internet: 100000,
      vape: 50000,
      haircut: 35000,
    };
    const fixedExpenses = 285000;
    const dailyOperationalTarget = 1020316;
    const finalTotalIncome = 5891000;
    const creditBills = 4185684;
    const savingsTarget = 400000;

    it('absorbs routine daily expenses within dailyOperationalTarget: pacing decreases by Rp 35k while waterfall totalDeductions and actualSavings remain 100% invariant', () => {
      const baselineTransactions = [
        { type: 'CREDIT_BILL', sourceType: 'BULK_BILL', amount: creditBills },
      ];

      const baselineDeductions = calculateTotalDeductions(
        baselineTransactions,
        fixedTargets,
        dailyOperationalTarget,
      );
      expect(baselineDeductions).toBe(4185684);

      const baselineWaterfall = calculateWaterfall({
        finalTotalIncome,
        totalDeductions: baselineDeductions,
        savingsTarget,
        dailyOperationalTarget,
        fixedExpenses,
      });
      expect(baselineWaterfall.actualDailyOperational).toBe(1020316);
      expect(baselineWaterfall.actualSavings).toBe(400000);
      expect(baselineWaterfall.deficitUncovered).toBe(0);

      // User logs a Rp 35,000 lunch (routine MANUAL DEDUCTION, no fixedEssentialCategory)
      const transactionsWithLunch = [
        ...baselineTransactions,
        {
          type: 'DEDUCTION',
          sourceType: 'MANUAL',
          amount: 35000,
          label: 'Lunch',
        },
      ];

      // 1. In waterfall: totalDeductions does NOT increase by Rp 35,000 because it is absorbed in the pool
      const totalDeductionsWithLunch = calculateTotalDeductions(
        transactionsWithLunch,
        fixedTargets,
        dailyOperationalTarget,
      );
      expect(totalDeductionsWithLunch).toBe(4185684); // 100% UNCHANGED

      const waterfallWithLunch = calculateWaterfall({
        finalTotalIncome,
        totalDeductions: totalDeductionsWithLunch,
        savingsTarget,
        dailyOperationalTarget,
        fixedExpenses,
      });
      expect(waterfallWithLunch.actualDailyOperational).toBe(1020316);
      expect(waterfallWithLunch.actualSavings).toBe(400000); // 100% UNCHANGED
      expect(waterfallWithLunch.deficitUncovered).toBe(0);

      // 2. In pacing: operational daily spent reflects the Rp 35,000 spend
      const dailySpent = calculateOperationalDailySpent(
        transactionsWithLunch,
        fixedTargets,
      );
      expect(dailySpent).toBe(35000);

      const pacing = calculateDailyPacing({
        periodMonth: 10,
        periodYear: 2026,
        cycleStartDate: new Date(Date.UTC(2026, 9, 27)),
        cycleEndDate: new Date(Date.UTC(2026, 10, 24)),
        isEndDateConfirmed: true,
        actualDailyOperational: waterfallWithLunch.actualDailyOperational,
        dailyOperationalTarget,
        totalDailySpent: dailySpent,
        referenceDate: new Date(Date.UTC(2026, 9, 28)),
      });

      // remainingBudget is reduced by exactly Rp 35,000: 1,020,316 - 35,000 = 985,316
      expect(pacing.remainingBudget).toBe(985316);
    });

    it('penalizes waterfall and reduces P1 Savings only when cumulative daily spend exceeds dailyOperationalTarget', () => {
      // User spends Rp 1,120,316 (Rp 100,000 over target of Rp 1,020,316)
      const overspentTransactions = [
        { type: 'CREDIT_BILL', sourceType: 'BULK_BILL', amount: creditBills },
        {
          type: 'DEDUCTION',
          sourceType: 'MANUAL',
          amount: 1120316,
          label: 'Cumulative living spend',
        },
      ];

      const deductionsWithOverage = calculateTotalDeductions(
        overspentTransactions,
        fixedTargets,
        dailyOperationalTarget,
      );
      // Total deductions increases by exactly the Rp 100,000 overage: 4,185,684 + 100,000 = 4,285,684
      expect(deductionsWithOverage).toBe(4285684);

      const waterfall = calculateWaterfall({
        finalTotalIncome,
        totalDeductions: deductionsWithOverage,
        savingsTarget,
        dailyOperationalTarget,
        fixedExpenses,
      });

      // Available funds reduced by Rp 100,000 from 400,000 to 300,000
      expect(waterfall.availableFunds).toBe(300000);
      // P1 Savings reduced from Rp 400,000 to Rp 300,000
      expect(waterfall.actualSavings).toBe(300000);
      expect(waterfall.deficitUncovered).toBe(0);
    });
  });

  describe('Phase 9 Multi-Formula Allocation Engine (4 Selectable Engines)', () => {
    it('Engine 1 (DEBT_FIRST_WATERFALL): matches canonical bespoke waterfall 1:1', () => {
      const result = calculateWaterfall({
        finalTotalIncome: 10000000,
        totalDeductions: 2000000,
        fixedExpenses: 1500000,
        dailyOperationalTarget: 3000000,
        savingsTarget: 1500000,
        formulaEngineType: 'DEBT_FIRST_WATERFALL',
      });

      expect(result.actualDailyOperational).toBe(3000000);
      expect(result.actualSavings).toBe(1500000);
      expect(result.selfReward).toBe(2000000);
      expect(result.isDeficit).toBe(false);
    });

    it('Engine 2 (SAVINGS_FIRST_LOCK): locks Core Savings first right after mandatory debt/bills, then funds daily living and self-reward', () => {
      const result = calculateWaterfall({
        finalTotalIncome: 8000000,
        totalDeductions: 1000000,
        fixedExpenses: 1500000,
        dailyOperationalTarget: 4000000,
        savingsTarget: 2000000,
        formulaEngineType: 'SAVINGS_FIRST_LOCK',
        formulaParams: {
          savingsLockMode: 'PERCENT',
          savingsLockPercent: 25, // 25% of 8,000,000 = 2,000,000 locked first!
        },
      });

      // After debt (1M) = 7M. Routine (1.5M) + Locked Savings (2M) = 3.5M -> Remaining for daily living = 3.5M
      // Notice that in DEBT_FIRST_WATERFALL, daily living would get 4M and savings would be squeezed to 1.5M.
      // In SAVINGS_FIRST_LOCK, savings gets its full 2,000,000 lock and daily living gets the remaining 3,500,000!
      expect(result.actualSavings).toBe(2000000);
      expect(result.actualDailyOperational).toBe(3500000);
      expect(result.selfReward).toBe(0);
      expect(result.isDeficit).toBe(false);
    });

    it('Engine 3 (PERCENTAGE_SPLIT): splits net income by 50/30/20 (or custom %)', () => {
      const result = calculateWaterfall({
        finalTotalIncome: 10000000,
        totalDeductions: 1000000,
        fixedExpenses: 1500000,
        dailyOperationalTarget: 2500000,
        savingsTarget: 2000000,
        formulaEngineType: 'PERCENTAGE_SPLIT',
        formulaParams: {
          needsPercent: 50, // 5,000,000 Needs pool (absorbs 1M debt + 1.5M routine -> 2.5M daily operational)
          wantsPercent: 30, // 3,000,000 Wants / Self-Reward
          savingsPercent: 20, // 2,000,000 Core Savings
        },
      });

      expect(result.actualDailyOperational).toBe(2500000);
      expect(result.selfReward).toBe(3000000);
      expect(result.actualSavings).toBe(2000000);
      expect(result.isDeficit).toBe(false);
    });

    it('Engine 4 (RETIREMENT_DRAWDOWN): combines pension/passive income with planned monthly vault drawdown and prioritizes healthcare & utility envelopes', () => {
      const result = calculateWaterfall({
        finalTotalIncome: 4000000, // Monthly pension
        totalDeductions: 0,
        fixedExpenses: 1500000, // Utilities & routine medical
        dailyOperationalTarget: 3000000,
        savingsTarget: 500000,
        formulaEngineType: 'RETIREMENT_DRAWDOWN',
        formulaParams: {
          monthlyVaultDrawdown: 2000000, // +2M planned vault drawdown -> 6M total cashflow
          healthcareReserveTarget: 500000, // 500k healthcare priority buffer
        },
      });

      // Total cashflow = 6,000,000. Priority healthcare + fixed = 2,000,000.
      // Remaining = 4,000,000 -> funds 3,000,000 daily living + 1,000,000 reserve/savings!
      expect(result.actualDailyOperational).toBe(3000000);
      expect(result.actualSavings).toBe(1000000);
      expect(result.selfReward).toBe(0);
      expect(result.isDeficit).toBe(false);
    });
  });
});
