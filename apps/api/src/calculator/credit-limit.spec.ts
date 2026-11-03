import {
  calculateCreditUsageLimit,
  evaluateInstrumentLimit,
} from './credit-limit';

describe('Credit Usage Limit & Safe Ceiling Calculator (Pure Module)', () => {
  it('evaluates UNSET, OK, APPROACHING_LIMIT (>=85%), and EXCEEDED (>100%) states accurately', () => {
    expect(evaluateInstrumentLimit(500_000, 0).status).toBe('UNSET');
    expect(evaluateInstrumentLimit(800_000, 1_000_000)).toEqual({
      usage: 800_000,
      limit: 1_000_000,
      utilizationPercent: 80.0,
      remainingBeforeLimit: 200_000,
      exceededBy: 0,
      status: 'OK',
    });
    expect(evaluateInstrumentLimit(850_000, 1_000_000)).toEqual({
      usage: 850_000,
      limit: 1_000_000,
      utilizationPercent: 85.0,
      remainingBeforeLimit: 150_000,
      exceededBy: 0,
      status: 'APPROACHING_LIMIT',
    });
    expect(evaluateInstrumentLimit(1_250_000, 1_000_000)).toEqual({
      usage: 1_250_000,
      limit: 1_000_000,
      utilizationPercent: 125.0,
      remainingBeforeLimit: 0,
      exceededBy: 250_000,
      status: 'EXCEEDED',
    });
  });

  it('bounds recommended ceilings by 20%/35% debt ratio when cashflow is ample', () => {
    // Income: 10,000,000. 20% = 2,000,000; 35% = 3,500,000
    // Essentials + Op: 3,000,000. Savings: 1,000,000. FixedLockedDebt: 500,000.
    // Ratio-based Optimal Revolving = 2,000,000 - 500,000 = 1,500,000
    // Ratio-based Safe Revolving = 3,500,000 - 500,000 = 3,000,000
    // Cashflow before savings slash = 10,000,000 - 3,000,000 - 1,000,000 - 500,000 = 5,500,000
    // Cashflow before deficit = 10,000,000 - 3,000,000 - 500,000 = 6,500,000
    const res = calculateCreditUsageLimit({
      month: 12,
      year: 2026,
      isSnapshotPersisted: true,
      snapshotStatus: 'DRAFT',
      totalIncome: 10_000_000,
      dailyOperationalTarget: 2_500_000,
      fixedExpenses: 500_000,
      bufferPocket: 0,
      savingsTarget: 1_000_000,
      manualDeductions: 0,
      contractInstallments: 500_000,
      personalDebtAmount: 0,
      currentCcUsage: 600_000,
      currentPaylaterUsage: 400_000,
      bankCreditLimit: 7_000_000,
      ccUsageLimit: 1_000_000,
      paylaterUsageLimit: 500_000,
    });

    expect(res.ceilingBreakdown.recommendedOptimalCombinedCeiling).toBe(
      1_500_000,
    );
    expect(res.ceilingBreakdown.optimalBindingConstraint).toBe('DEBT_RATIO_20');
    expect(res.ceilingBreakdown.recommendedSafeCombinedCeiling).toBe(3_000_000);
    expect(res.ceilingBreakdown.safeBindingConstraint).toBe('DEBT_RATIO_35');
    expect(res.ceilingBreakdown.remainingSafeHeadroomForCc).toBe(2_600_000);
    expect(res.ceilingBreakdown.remainingSafeHeadroomForPaylater).toBe(
      2_400_000,
    );
    expect(res.isSafeCeilingExceeded).toBe(false);
    expect(res.isAnyConfiguredLimitExceeded).toBe(false);
  });

  it('bounds recommended ceilings by remaining waterfall cashflow when high essentials/savings make cashflow tighter than 20%/35% debt ratio', () => {
    // Income: 6,000,000. 20% = 1,200,000; 35% = 2,100,000.
    // Daily Op (3,500,000) + Fixed (800,000) = 4,300,000.
    // Savings Target = 1,000,000. Manual Deductions = 200,000.
    // Cashflow before savings slash = 6,000,000 - 4,300,000 - 1,000,000 - 200,000 = 500,000 (< 1,200,000!)
    // Cashflow before deficit = 6,000,000 - 4,300,000 - 200,000 = 1,500,000 (< 2,100,000!)
    const res = calculateCreditUsageLimit({
      month: 11,
      year: 2026,
      isSnapshotPersisted: true,
      snapshotStatus: 'DRAFT',
      totalIncome: 6_000_000,
      dailyOperationalTarget: 3_500_000,
      fixedExpenses: 800_000,
      bufferPocket: 0,
      savingsTarget: 1_000_000,
      manualDeductions: 200_000,
      contractInstallments: 0,
      personalDebtAmount: 0,
      currentCcUsage: 900_000,
      currentPaylaterUsage: 800_000,
      bankCreditLimit: 7_000_000,
      ccUsageLimit: 800_000,
      paylaterUsageLimit: 1_000_000,
    });

    expect(res.ceilingBreakdown.ratioBasedOptimalRevolvingCeiling).toBe(
      1_200_000,
    );
    expect(res.ceilingBreakdown.maxCashflowBeforeSavingsSlash).toBe(500_000);
    expect(res.ceilingBreakdown.recommendedOptimalCombinedCeiling).toBe(
      500_000,
    );
    expect(res.ceilingBreakdown.optimalBindingConstraint).toBe(
      'CASHFLOW_SAVINGS_PROTECTION',
    );

    expect(res.ceilingBreakdown.ratioBasedSafeRevolvingCeiling).toBe(2_100_000);
    expect(res.ceilingBreakdown.maxCashflowBeforeDeficit).toBe(1_500_000);
    expect(res.ceilingBreakdown.recommendedSafeCombinedCeiling).toBe(1_500_000);
    expect(res.ceilingBreakdown.safeBindingConstraint).toBe(
      'CASHFLOW_DEFICIT_PROTECTION',
    );

    expect(res.ccEvaluation.status).toBe('EXCEEDED');
    expect(res.ccEvaluation.exceededBy).toBe(100_000);
    expect(res.paylaterEvaluation.status).toBe('OK');
    expect(res.isSafeCeilingExceeded).toBe(true); // 1,700,000 > 1,500,000
    expect(res.isAnyConfiguredLimitExceeded).toBe(true);
  });
});
