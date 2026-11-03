import {
  calculateCashStrategy,
  calculateInstallmentStrategy,
  calculateWishlistAnalysis,
  evaluateInstallmentRiskTier,
} from './wishlist';

describe('Wishlist Calculator', () => {
  describe('calculateCashStrategy', () => {
    it('returns INSTANT_EXECUTION when price is less than current self-reward balance', () => {
      const result = calculateCashStrategy(500000, 1000000, 300000, 10000000);
      expect(result.tier).toBe('INSTANT_EXECUTION');
      expect(result.shortfall).toBe(0);
      expect(result.estimatedMonthsToSave).toBe(0);
      expect(result.currentSelfReward).toBe(1000000);
    });

    it('returns INSTANT_EXECUTION on exact balance match (price === currentSelfReward)', () => {
      const result = calculateCashStrategy(1000000, 1000000, 300000, 10000000);
      expect(result.tier).toBe('INSTANT_EXECUTION');
      expect(result.shortfall).toBe(0);
      expect(result.estimatedMonthsToSave).toBe(0);
    });

    it('returns SAVING_REQUIRED with shortfall and monthsToSave based on selfRewardTarget', () => {
      const result = calculateCashStrategy(2500000, 500000, 500000, 10000000);
      expect(result.tier).toBe('SAVING_REQUIRED');
      expect(result.shortfall).toBe(2000000);
      expect(result.estimatedMonthsToSave).toBe(4);
      expect(result.monthlySavingsRate).toBe(500000);
    });

    it('falls back to 10% of base THP when selfRewardTarget is zero or omitted', () => {
      const result = calculateCashStrategy(3000000, 500000, 0, 10000000);
      expect(result.tier).toBe('SAVING_REQUIRED');
      expect(result.shortfall).toBe(2500000);
      expect(result.monthlySavingsRate).toBe(1000000); // 10% of 10M
      expect(result.estimatedMonthsToSave).toBe(3); // ceil(2.5M / 1M)
    });

    it('handles zero or negative self-reward balance safely', () => {
      const result = calculateCashStrategy(1000000, -100000, 500000, 10000000);
      expect(result.tier).toBe('SAVING_REQUIRED');
      expect(result.currentSelfReward).toBe(0);
      expect(result.shortfall).toBe(1000000);
      expect(result.estimatedMonthsToSave).toBe(2);
    });
  });

  describe('evaluateInstallmentRiskTier', () => {
    it('returns OPTIMAL when peak debt ratio is <= 20%', () => {
      expect(evaluateInstallmentRiskTier(0)).toBe('OPTIMAL');
      expect(evaluateInstallmentRiskTier(15)).toBe('OPTIMAL');
      expect(evaluateInstallmentRiskTier(20.0)).toBe('OPTIMAL');
    });

    it('returns MANAGEABLE when peak debt ratio is > 20% and <= 35%', () => {
      expect(evaluateInstallmentRiskTier(20.01)).toBe('MANAGEABLE');
      expect(evaluateInstallmentRiskTier(28.5)).toBe('MANAGEABLE');
      expect(evaluateInstallmentRiskTier(35.0)).toBe('MANAGEABLE');
    });

    it('returns HIGH_RISK when peak debt ratio is > 35%', () => {
      expect(evaluateInstallmentRiskTier(35.01)).toBe('HIGH_RISK');
      expect(evaluateInstallmentRiskTier(50.0)).toBe('HIGH_RISK');
    });
  });

  describe('calculateInstallmentStrategy', () => {
    const emptyProjection = [
      { month: 10, year: 2026, amount: 1000000 },
      { month: 11, year: 2026, amount: 1000000 },
      { month: 12, year: 2026, amount: 1000000 },
      { month: 1, year: 2027, amount: 500000 },
      { month: 2, year: 2027, amount: 500000 },
      { month: 3, year: 2027, amount: 0 },
    ];

    it('uses user-provided monthlyPayment directly without overriding or interest calculation', () => {
      // Base THP = 10,000,000. Existing = 1,000,000 (10%).
      // Quoted monthlyPayment = 800,000. Total = 1,800,000 -> 18% -> OPTIMAL
      const result = calculateInstallmentStrategy(
        4000000,
        6,
        800000,
        10000000,
        emptyProjection,
      );

      expect(result.newMonthlyInstallment).toBe(800000);
      expect(result.peakDebtRatio).toBe(18);
      expect(result.tier).toBe('OPTIMAL');
      expect(result.projectedMonths[0].totalDebt).toBe(1800000);
      expect(result.projectedMonths[0].debtRatio).toBe(18);
    });

    it('falls back to price / tenor when monthlyPayment is omitted', () => {
      // price: 6,000,000, tenor: 3. monthly installment = 2,000,000
      // Month 1-3 total: 1M + 2M = 3M -> 30% -> MANAGEABLE
      // Month 4: 500k + 0 = 500k -> 5%
      const result = calculateInstallmentStrategy(
        6000000,
        3,
        undefined,
        10000000,
        emptyProjection,
      );

      expect(result.newMonthlyInstallment).toBe(2000000);
      expect(result.peakDebtRatio).toBe(30);
      expect(result.tier).toBe('MANAGEABLE');
      // After tenor ends (month index 3 = 4th month), newDebt is 0
      expect(result.projectedMonths[3].newDebt).toBe(0);
      expect(result.projectedMonths[3].totalDebt).toBe(500000);
    });

    it('flags HIGH_RISK when peak debt ratio exceeds 35%', () => {
      // Base THP = 10,000,000. Existing = 1,000,000.
      // monthlyPayment = 3,000,000. Total = 4,000,000 -> 40% -> HIGH_RISK
      const result = calculateInstallmentStrategy(
        9000000,
        3,
        3000000,
        10000000,
        emptyProjection,
      );

      expect(result.peakDebtRatio).toBe(40);
      expect(result.tier).toBe('HIGH_RISK');
    });
  });

  describe('calculateWishlistAnalysis', () => {
    const sampleLiabilities = [
      { month: 10, year: 2026, amount: 500000 },
      { month: 11, year: 2026, amount: 500000 },
      { month: 12, year: 2026, amount: 500000 },
      { month: 1, year: 2027, amount: 0 },
      { month: 2, year: 2027, amount: 0 },
      { month: 3, year: 2027, amount: 0 },
    ];

    it('for CASH item that can be bought immediately, returns cash instant execution', () => {
      const result = calculateWishlistAnalysis({
        price: 500000,
        fundingType: 'CASH',
        currentSelfReward: 1000000,
        selfRewardTarget: 250000,
        baseThp: 10000000,
        existingLiabilities: sampleLiabilities,
      });

      expect(result.cashStrategy.tier).toBe('INSTANT_EXECUTION');
      expect(result.installmentStrategy).toBeUndefined();
    });

    it('for CASH item with shortfall, provides only cash savings plan and NO installment simulation', () => {
      const result = calculateWishlistAnalysis({
        price: 3000000,
        fundingType: 'CASH',
        currentSelfReward: 500000,
        selfRewardTarget: 500000,
        baseThp: 10000000,
        tenor: 6,
        existingLiabilities: sampleLiabilities,
      });

      expect(result.cashStrategy.tier).toBe('SAVING_REQUIRED');
      expect(result.cashStrategy.shortfall).toBe(2500000);
      expect(result.cashStrategy.estimatedMonthsToSave).toBe(5);
      expect(result.installmentStrategy).toBeUndefined();
    });

    it('for INSTALLMENT item, evaluates installment strategy even if cash balance is sufficient', () => {
      const result = calculateWishlistAnalysis({
        price: 3000000,
        fundingType: 'INSTALLMENT',
        tenor: 6,
        monthlyPayment: 550000,
        currentSelfReward: 5000000,
        selfRewardTarget: 500000,
        baseThp: 10000000,
        existingLiabilities: sampleLiabilities,
      });

      expect(result.cashStrategy.tier).toBe('INSTANT_EXECUTION');
      expect(result.installmentStrategy).toBeDefined();
      expect(result.installmentStrategy?.newMonthlyInstallment).toBe(550000);
    });

    it('uses per-month baseIncome for each period in installment projection when provided', () => {
      const liabilitiesWithPerMonthIncome = [
        { month: 10, year: 2026, amount: 1000000, baseIncome: 10000000 },
        { month: 11, year: 2026, amount: 1000000, baseIncome: 10000000 },
        { month: 12, year: 2026, amount: 1000000, baseIncome: 20000000 }, // Bonus month, double income
      ];

      const result = calculateInstallmentStrategy(
        6000000,
        6,
        1000000,
        10000000,
        liabilitiesWithPerMonthIncome,
      );

      // Month 10: total debt 2,000,000 / 10,000,000 = 20%
      expect(result.projectedMonths[0].debtRatio).toBe(20);
      // Month 12: total debt 2,000,000 / 20,000,000 = 10%
      expect(result.projectedMonths[2].debtRatio).toBe(10);
    });
  });
});
