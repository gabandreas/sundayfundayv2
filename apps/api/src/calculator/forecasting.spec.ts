import {
  calculateLiquidityForecast,
  LiquidityForecastInput,
} from './forecasting';

describe('calculateLiquidityForecast (3-Month Forward Liquidity Projection)', () => {
  const baseInput: LiquidityForecastInput = {
    baseMonth: 10,
    baseYear: 2026,
    horizonMonths: 3,
    config: {
      baseSalary: 5000000,
      dailyAllowance: 40000,
      laptopAllowance: 250000,
      dailyOperational: 1000000,
      transport: 250000,
      internet: 150000,
      vape: 260000,
      haircut: 100000,
      baseSavings: 1000000,
      payrollPayoutDay: 25,
    },
    snapshots: [
      {
        month: 10,
        year: 2026,
        status: 'DRAFT',
        salaryAdjustment: 0,
        totalWorkingDays: 21,
        cafeteriaDeduction: 0,
        thrAmount: 0,
        bonusAmount: 0,
        dailyOperational: 1000000,
        transport: 250000,
        internet: 150000,
        vape: 260000,
        haircut: 100000,
        savings: 1000000,
        selfRewardTarget: 300000,
        bufferPocket: 0,
      },
      {
        month: 11,
        year: 2026,
        status: 'DRAFT',
        salaryAdjustment: 0,
        totalWorkingDays: 21,
        cafeteriaDeduction: 0,
        thrAmount: 0,
        bonusAmount: 0,
        dailyOperational: 1000000,
        transport: 250000,
        internet: 150000,
        vape: 260000,
        haircut: 100000,
        savings: 1000000,
        selfRewardTarget: 300000,
        bufferPocket: 0,
      },
    ],
    contracts: [
      {
        id: 1,
        label: 'Kredivo Laptop',
        monthlyInstallment: 500000,
        totalTenor: 6,
        remainingTenor: 3, // Active in 10/2026 (4/6), 11/2026 (5/6), 12/2026 (6/6 final!), 0 in 1/2027
        isActive: true,
        startMonth: 7,
        startYear: 2026,
      },
    ],
    scheduledBills: [
      {
        id: 1,
        label: 'IndiHome Fiber',
        amount: 350000,
        dueDayOfMonth: 15,
        isActive: true,
      },
    ],
    creditCards: [
      {
        id: 10,
        label: 'Netflix Premium',
        amount: 186000,
        chargeType: 'RECURRING',
        billingMonth: 7,
        billingYear: 2026,
        endedAtMonth: 11,
        endedAtYear: 2026, // Ends in Nov 2026 -> Rp 0 in Dec 2026 & Jan 2027
        status: 'ACTIVE',
      },
      {
        id: 11,
        label: 'Tokopedia Gadget',
        amount: 400000,
        monthlyAmount: 400000,
        totalAmount: 1200000,
        chargeType: 'INSTALLMENT',
        tenor: 3,
        billingMonth: 10,
        billingYear: 2026, // Active in Oct (1/3), Nov (2/3), Dec (3/3), 0 in Jan 2027
        status: 'ACTIVE',
      },
    ],
    bulkBills: [
      {
        month: 11,
        year: 2026,
        paylaterAmount: 2400000, // Heavy PayLater bill in Nov 2026 causing a Liquidity Squeeze!
        personalDebtAmount: 0,
        creditCardAmount: 0,
        amount: 2400000,
      },
    ],
  };

  it('projects M+1 (Nov 2026), M+2 (Dec 2026), and M+3 (Jan 2027) and flags Liquidity Squeeze with exact Recommended P1 Savings Reduction', () => {
    const forecast = calculateLiquidityForecast(baseInput);

    expect(forecast.months).toHaveLength(3);
    expect(forecast.months.map((m) => m.periodLabel)).toEqual([
      'Nov 2026',
      'Dec 2026',
      'Jan 2027',
    ]);

    const [nov, dec, jan] = forecast.months;

    // Nov 2026 (M+1):
    // Income = 5,940,000; Upfront essentials + op = 1,760,000
    // Liabilities = 500k contract + 350k scheduled + (186k + 400k = 586k CC) + 2,400k bulk = 3,836,000
    // Available before waterfall = 5,940,000 - 1,760,000 - 3,836,000 = 344,000 (< 1,000,000 P1 Savings target!)
    expect(nov.liabilities.projectedTotalDeductions).toBe(3836000);
    expect(nov.waterfall.projectedFundedSavings).toBe(344000);
    expect(nov.isLiquiditySqueeze).toBe(true);
    expect(nov.liquidityStatus).toBe('SAVINGS_COMPRESSED');
    expect(nov.recommendedP1SavingsReduction).toBe(656000);
    expect(nov.squeezeBannerText).toContain(
      'Liquidity Squeeze Predicted — Recommended P1 Savings Reduction: Rp 656.000',
    );
    expect(nov.liabilities.endingSubscriptions).toHaveLength(1);
    expect(nov.liabilities.endingSubscriptions[0].label).toBe('Netflix Premium');

    // Dec 2026 (M+2):
    // Netflix ended in Nov 2026 -> CC due is only 400k (Tokopedia Gadget 3/3)
    // Kredivo Laptop is at 6/6 (final slice)
    expect(dec.liabilities.creditCardsTotal).toBe(400000);
    expect(dec.liabilities.contractsTotal).toBe(500000);
    expect(dec.isLiquiditySqueeze).toBe(false);
    expect(dec.liquidityStatus).toBe('HEALTHY_SURPLUS');

    // Jan 2027 (M+3):
    // Both Kredivo Laptop and Tokopedia Gadget have finished! Only IndiHome Fiber (350k) remains
    expect(jan.liabilities.contractsTotal).toBe(0);
    expect(jan.liabilities.creditCardsTotal).toBe(0);
    expect(jan.liabilities.projectedTotalDeductions).toBe(350000);

    // Summary reflects 1 squeeze month and 3 expiring items (Kredivo 500k, Tokopedia 400k, Netflix 186k = 1,086,000 relief)
    expect(forecast.summary.squeezeMonthsCount).toBe(1);
    expect(forecast.summary.maxRecommendedSavingsReduction).toBe(656000);
    expect(forecast.summary.expiringInstallmentsNext3M).toBe(3);
    expect(forecast.summary.monthlyCashflowReliefFromExpiring).toBe(1086000);
  });
});
