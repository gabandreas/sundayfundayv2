import {
  formatPeriodVaultLabel,
  extractPeriodTagFromLabel,
  calculateWealthTargetPlan,
} from './savings.utils';

describe('savings.utils — deterministic period attribution', () => {
  it('appends canonical (M/YYYY) suffix when user customizes label without period tag', () => {
    expect(formatPeriodVaultLabel('BCA Tahapan Transfer', 7, 2026)).toBe(
      'BCA Tahapan Transfer (7/2026)',
    );
  });

  it('does not duplicate (M/YYYY) suffix when already present in label', () => {
    expect(
      formatPeriodVaultLabel('P1 Savings Transfer (7/2026)', 7, 2026),
    ).toBe('P1 Savings Transfer (7/2026)');
    expect(formatPeriodVaultLabel('Swept P1 + Operational (07/2026)', 7, 2026)).toBe(
      'Swept P1 + Operational (07/2026)',
    );
  });

  it('extracts period month and year deterministically from label', () => {
    expect(
      extractPeriodTagFromLabel('BCA Tahapan Transfer (7/2026)'),
    ).toEqual({ month: 7, year: 2026 });
    expect(
      extractPeriodTagFromLabel('P1 Savings Transfer (12/2026)'),
    ).toEqual({ month: 12, year: 2026 });
    expect(extractPeriodTagFromLabel('Manual Emergency Deposit')).toBeNull();
  });
});

describe('savings.utils — calculateWealthTargetPlan feasibility guard', () => {
  it('returns FEASIBLE with 0 required when current balance already reaches or exceeds target', () => {
    const plan = calculateWealthTargetPlan({
      targetBalance: 5_000_000,
      targetMonth: 12,
      targetYear: 2027,
      currentBaseBalance: 6_000_000,
      currentMonth: 10,
      currentYear: 2026,
      finalTotalIncome: 5_900_000,
      avgMonthlySavingsP1: 500_000,
      maxMonthlySavableCapacity: 1_800_000,
    });

    expect(plan.shortfallAmount).toBe(0);
    expect(plan.requiredMonthlySaving).toBe(0);
    expect(plan.status).toBe('FEASIBLE');
    expect(plan.statusLabel).toBe('Goal Reached (100% Funded)');
  });

  it('returns FEASIBLE when required monthly saving is within normal bounds', () => {
    // Shortfall: 10M - 4M = 6M over 12 months = 500k/mo (8.5% of 5.9M income, <= avg P1)
    const plan = calculateWealthTargetPlan({
      targetBalance: 10_000_000,
      targetMonth: 10,
      targetYear: 2027,
      currentBaseBalance: 4_000_000,
      currentMonth: 10,
      currentYear: 2026,
      finalTotalIncome: 5_900_000,
      avgMonthlySavingsP1: 500_000,
      maxMonthlySavableCapacity: 1_800_000,
    });

    expect(plan.monthsRemaining).toBe(12);
    expect(plan.shortfallAmount).toBe(6_000_000);
    expect(plan.requiredMonthlySaving).toBe(500_000);
    expect(plan.status).toBe('FEASIBLE');
    expect(plan.statusLabel).toBe('Realistic & On Track');
  });

  it('returns STRETCH when required monthly saving exceeds 1.5x average P1 pace or 25% of net income', () => {
    // Shortfall: 15M - 3M = 12M over 12 months = 1M/mo (2x avg P1 pace of 500k, 16.9% of income)
    const plan = calculateWealthTargetPlan({
      targetBalance: 15_000_000,
      targetMonth: 10,
      targetYear: 2027,
      currentBaseBalance: 3_000_000,
      currentMonth: 10,
      currentYear: 2026,
      finalTotalIncome: 5_900_000,
      avgMonthlySavingsP1: 450_000,
      maxMonthlySavableCapacity: 1_800_000,
    });

    expect(plan.requiredMonthlySaving).toBe(1_000_000);
    expect(plan.status).toBe('STRETCH');
    expect(plan.statusLabel).toContain('Stretch Target');
    expect(plan.realisticCompletionMonthYear).toBeDefined();
    expect(plan.realisticReachableAmount).toBeGreaterThan(3_000_000);
  });

  it('returns UNREALISTIC when required monthly saving exceeds max monthly savable capacity', () => {
    // Shortfall: 20M - 2M = 18M over 6 months = 3M/mo (exceeds 1.8M max capacity and 50% of income)
    const plan = calculateWealthTargetPlan({
      targetBalance: 20_000_000,
      targetMonth: 4,
      targetYear: 2027,
      currentBaseBalance: 2_000_000,
      currentMonth: 10,
      currentYear: 2026,
      finalTotalIncome: 5_900_000,
      avgMonthlySavingsP1: 500_000,
      maxMonthlySavableCapacity: 1_800_000,
    });

    expect(plan.monthsRemaining).toBe(6);
    expect(plan.requiredMonthlySaving).toBe(3_000_000);
    expect(plan.status).toBe('UNREALISTIC');
    expect(plan.statusLabel).toBe('Unrealistic for Current Income & Obligations');
    expect(plan.explanation).toContain('Exceeds contractual uncommitted cashflow');
  });
});
