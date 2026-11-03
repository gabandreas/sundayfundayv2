import { calculateAnalytics, AnalyticsSnapshotInput } from './analytics';
import { calculateWaterfall, calculateTotalDeductions } from './waterfall';

function buildSnapshotFromWaterfall(params: {
  month: number;
  year: number;
  status: 'DRAFT' | 'LOCKED';
  finalTotalIncome: number;
  dailyOperationalTarget: number;
  transport: number;
  internet: number;
  vape: number;
  haircut: number;
  savingsTarget: number;
  bufferPocket?: number;
  transactions: Array<{
    type: string;
    sourceType: string;
    label: string;
    amount: number;
  }>;
}): AnalyticsSnapshotInput {
  const totalDeductions = calculateTotalDeductions(params.transactions);
  const fixedExpenses =
    params.transport + params.internet + params.vape + params.haircut;
  const wf = calculateWaterfall({
    finalTotalIncome: params.finalTotalIncome,
    totalDeductions,
    savingsTarget: params.savingsTarget,
    dailyOperationalTarget: params.dailyOperationalTarget,
    fixedExpenses,
    bufferPocket: params.bufferPocket ?? 0,
  });

  return {
    month: params.month,
    year: params.year,
    status: params.status,
    finalTotalIncome: params.finalTotalIncome,
    totalDeductions,
    actualDailyOperational: wf.actualDailyOperational,
    dailyOperationalTarget: params.dailyOperationalTarget,
    transport: params.transport,
    internet: params.internet,
    vape: params.vape,
    haircut: params.haircut,
    savingsTarget: params.savingsTarget,
    actualSavings: wf.actualSavings,
    selfReward: wf.selfReward,
    bufferPocket: params.bufferPocket ?? 0,
    deficitUncovered: wf.deficitUncovered,
    survivalPocket: wf.survivalPocket,
    transactions: params.transactions,
  };
}

describe('Analytics Calculator (Pure Module)', () => {
  it('handles empty snapshot and vault lists safely without division-by-zero', () => {
    const report = calculateAnalytics({
      snapshots: [],
      savingsTransactions: [],
      scope: 'all',
    });

    expect(report.periodCount).toBe(0);
    expect(report.dateRangeLabel).toBe('No periods recorded');
    expect(report.kpis.averageMonthlyIncome).toBe(0);
    expect(report.kpis.averageMonthlySavings).toBe(0);
    expect(report.kpis.aggregateSavingsRate).toBe(0);
    expect(report.kpis.savingsRateStatus).toBe('BELOW_TARGET');
    expect(report.kpis.cumulativeVaultInflow).toBe(0);
    expect(report.kpis.vaultRealizationRatePercent).toBe(0);
    expect(report.cashflowSeries).toHaveLength(0);
    expect(report.categoryDistribution).toHaveLength(6);
    expect(
      report.categoryDistribution.every((c) => c.totalAmount === 0),
    ).toBe(true);
    expect(report.trajectorySummary.peakDebtPeriod).toBeNull();
    expect(report.trajectorySummary.debtSafeInflectionPeriod).toBeNull();
  });

  it('enforces 100% accounting conservation across macro categories when both CREDIT_BILL and manual DEDUCTION transactions exist', () => {
    const julSnapshot = buildSnapshotFromWaterfall({
      month: 7,
      year: 2026,
      status: 'LOCKED',
      finalTotalIncome: 5_891_000,
      dailyOperationalTarget: 2_850_000,
      transport: 100_000,
      internet: 150_000,
      vape: 150_000,
      haircut: 50_000,
      savingsTarget: 0,
      transactions: [
        {
          type: 'CREDIT_BILL',
          sourceType: 'BULK_BILL',
          label: 'PayLater Bill (7/2026)',
          amount: 2_400_000,
        },
        {
          type: 'DEDUCTION',
          sourceType: 'MANUAL',
          label: 'Lunch & Coffee',
          amount: 124_000,
        },
      ],
    });

    const sepSnapshot = buildSnapshotFromWaterfall({
      month: 9,
      year: 2026,
      status: 'DRAFT',
      finalTotalIncome: 5_891_000,
      dailyOperationalTarget: 991_000,
      transport: 100_000,
      internet: 139_000,
      vape: 100_000,
      haircut: 50_000,
      savingsTarget: 909_000,
      transactions: [
        {
          type: 'CREDIT_BILL',
          sourceType: 'BULK_BILL',
          label: 'PayLater Bill (9/2026)',
          amount: 2_662_073,
        },
        {
          type: 'CREDIT_BILL',
          sourceType: 'PERSONAL_DEBT',
          label: 'Personal Debt (9/2026)',
          amount: 200_000,
        },
        {
          type: 'CREDIT_BILL',
          sourceType: 'CC_TRANSACTION',
          label: 'CC Statement',
          amount: 720_564,
        },
        {
          type: 'DEDUCTION',
          sourceType: 'MANUAL',
          label: 'Clinic & Transport',
          amount: 475_000,
        },
      ],
    });

    const decSnapshot = buildSnapshotFromWaterfall({
      month: 12,
      year: 2026,
      status: 'DRAFT',
      finalTotalIncome: 9_840_917,
      dailyOperationalTarget: 2_850_000,
      transport: 150_000,
      internet: 285_000,
      vape: 150_000,
      haircut: 50_000,
      savingsTarget: 1_000_000,
      bufferPocket: 100_000,
      transactions: [
        {
          type: 'CREDIT_BILL',
          sourceType: 'BULK_BILL',
          label: 'PayLater Bill (12/2026)',
          amount: 1_088_517,
        },
        {
          type: 'CREDIT_BILL',
          sourceType: 'CC_TRANSACTION',
          label: 'CC Statement',
          amount: 542_786,
        },
      ],
    });

    const report = calculateAnalytics({
      snapshots: [sepSnapshot, decSnapshot, julSnapshot], // intentionally unsorted
      savingsTransactions: [
        { amount: 500_000, label: 'Initial Savings', date: '2026-08-01' },
      ],
      scope: 'all',
    });

    const expectedTotalIncome = 5_891_000 + 5_891_000 + 9_840_917;
    const sumOfAllMacroCategories = report.categoryDistribution.reduce(
      (sum, cat) => sum + cat.totalAmount,
      0,
    );

    expect(report.kpis.totalIncomeAcrossPeriods).toBe(expectedTotalIncome);
    // CRITICAL INVARIANT: 100% of finalTotalIncome is accounted for across the 6 macro categories with zero leakage
    expect(sumOfAllMacroCategories).toBe(expectedTotalIncome);

    // Verify Category 1 (Liabilities & Debt Bills) vs Category 2 (Operational & Day-to-Day Spend)
    const liabilitiesCat = report.categoryDistribution.find(
      (c) => c.key === 'LIABILITIES_DEBT',
    )!;
    const operationalCat = report.categoryDistribution.find(
      (c) => c.key === 'DAILY_OPERATIONAL',
    )!;

    expect(liabilitiesCat.totalAmount).toBe(
      2_400_000 + 2_662_073 + 200_000 + 720_564 + 1_088_517 + 542_786,
    );
    expect(operationalCat.totalAmount).toBe(
      2_850_000 + 991_000 + 2_850_000 + 124_000 + 475_000,
    );

    const manualSubItem = operationalCat.subItems.find(
      (s) => s.key === 'MANUAL_DEDUCTIONS',
    )!;
    expect(manualSubItem.amount).toBe(599_000);

    // Verify Period-by-Period table column sums match KPI totals 100%
    const sumSeriesIncome = report.cashflowSeries.reduce(
      (s, r) => s + r.totalIncome,
      0,
    );
    const sumSeriesLiabilities = report.cashflowSeries.reduce(
      (s, r) => s + r.totalLiabilitiesAndDeductions,
      0,
    );
    const sumSeriesEssential = report.cashflowSeries.reduce(
      (s, r) => s + r.essentialOutflow,
      0,
    );
    const sumSeriesSavings = report.cashflowSeries.reduce(
      (s, r) => s + r.actualSavings,
      0,
    );
    const sumSeriesSelfReward = report.cashflowSeries.reduce(
      (s, r) => s + r.selfRewardSurplus,
      0,
    );

    expect(sumSeriesIncome).toBe(report.kpis.totalIncomeAcrossPeriods);
    expect(sumSeriesLiabilities).toBe(report.kpis.totalLiabilitiesAcrossPeriods);
    expect(sumSeriesEssential).toBe(
      report.kpis.totalEssentialAndFixedAcrossPeriods,
    );
    expect(sumSeriesSavings).toBe(report.kpis.cumulativePlannedSavings);
    expect(sumSeriesSelfReward).toBe(report.kpis.totalSelfRewardAcrossPeriods);
    expect(
      report.kpis.totalLiabilitiesAcrossPeriods +
        report.kpis.totalEssentialAndFixedAcrossPeriods +
        report.kpis.cumulativePlannedSavings +
        report.kpis.totalSelfRewardAcrossPeriods,
    ).toBe(report.kpis.totalIncomeAcrossPeriods);

    // Verify 1:1 alignment between Period-by-Period table columns (creditBillsAmount + operationalAndFixedOutflow) and Donut categories
    const sumSeriesCreditBills = report.cashflowSeries.reduce(
      (s, r) => s + r.creditBillsAmount,
      0,
    );
    const sumSeriesOpAndFixed = report.cashflowSeries.reduce(
      (s, r) => s + r.operationalAndFixedOutflow,
      0,
    );
    expect(sumSeriesCreditBills).toBe(report.kpis.totalCreditBillsAcrossPeriods);
    expect(sumSeriesCreditBills).toBe(liabilitiesCat.totalAmount);
    expect(sumSeriesOpAndFixed).toBe(
      report.kpis.totalOperationalAndFixedAcrossPeriods,
    );
    expect(
      report.kpis.totalCreditBillsAcrossPeriods +
        report.kpis.totalOperationalAndFixedAcrossPeriods +
        report.kpis.cumulativePlannedSavings +
        report.kpis.totalSelfRewardAcrossPeriods,
    ).toBe(report.kpis.totalIncomeAcrossPeriods);
  });

  it('computes OPTIMAL savings rate status when aggregate savings rate is >= 20% and tracks vault realization', () => {
    const s1 = buildSnapshotFromWaterfall({
      month: 1,
      year: 2027,
      status: 'LOCKED',
      finalTotalIncome: 10_000_000,
      dailyOperationalTarget: 2_500_000,
      transport: 200_000,
      internet: 300_000,
      vape: 0,
      haircut: 0,
      savingsTarget: 2_500_000,
      transactions: [
        {
          type: 'CREDIT_BILL',
          sourceType: 'CONTRACT',
          label: 'Laptop Installment',
          amount: 1_000_000,
        },
      ],
    });

    const report = calculateAnalytics({
      snapshots: [s1],
      savingsTransactions: [
        { amount: 2_000_000, label: 'Vault Topup 1', date: '2027-01-28' },
        { amount: -250_000, label: 'Emergency Repair', date: '2027-02-02' },
      ],
    });

    expect(report.kpis.aggregateSavingsRate).toBe(25.0);
    expect(report.kpis.savingsRateStatus).toBe('OPTIMAL');
    expect(report.kpis.cumulativeVaultInflow).toBe(2_000_000);
    expect(report.kpis.cumulativeVaultOutflow).toBe(250_000);
    expect(report.kpis.netVaultBalance).toBe(1_750_000);
    expect(report.kpis.vaultRealizationRatePercent).toBe(80.0);
    expect(report.kpis.untransferredPlannedSavings).toBe(500_000);
  });

  it('identifies peak debt, deleveraging inflection (<=35%), and surplus crossover periods accurately', () => {
    const sep = buildSnapshotFromWaterfall({
      month: 9,
      year: 2026,
      status: 'DRAFT',
      finalTotalIncome: 5_891_000,
      dailyOperationalTarget: 991_000,
      transport: 100_000,
      internet: 139_000,
      vape: 100_000,
      haircut: 50_000,
      savingsTarget: 909_000,
      transactions: [
        {
          type: 'CREDIT_BILL',
          sourceType: 'BULK_BILL',
          label: 'Heavy Debt',
          amount: 4_057_637,
        },
      ],
    });

    const nov = buildSnapshotFromWaterfall({
      month: 11,
      year: 2026,
      status: 'DRAFT',
      finalTotalIncome: 5_916_000,
      dailyOperationalTarget: 2_850_000,
      transport: 150_000,
      internet: 285_000,
      vape: 150_000,
      haircut: 50_000,
      savingsTarget: 1_000_000,
      transactions: [
        {
          type: 'CREDIT_BILL',
          sourceType: 'BULK_BILL',
          label: 'Moderate Debt',
          amount: 2_230_811,
        },
      ],
    });

    const dec = buildSnapshotFromWaterfall({
      month: 12,
      year: 2026,
      status: 'DRAFT',
      finalTotalIncome: 9_840_917,
      dailyOperationalTarget: 2_850_000,
      transport: 150_000,
      internet: 285_000,
      vape: 150_000,
      haircut: 50_000,
      savingsTarget: 1_000_000,
      transactions: [
        {
          type: 'CREDIT_BILL',
          sourceType: 'BULK_BILL',
          label: 'Low Debt',
          amount: 1_631_303,
        },
      ],
    });

    const report = calculateAnalytics({
      snapshots: [sep, nov, dec],
      savingsTransactions: [],
    });

    expect(report.trajectorySummary.peakDebtPeriod?.periodLabel).toBe('Sep 2026');
    expect(report.trajectorySummary.peakDebtPeriod?.debtRatioPercent).toBe(68.9);
    expect(report.trajectorySummary.debtSafeInflectionPeriod?.periodLabel).toBe(
      'Dec 2026',
    );
    expect(
      report.trajectorySummary.debtSafeInflectionPeriod?.debtRatioPercent,
    ).toBe(16.6);
    expect(report.trajectorySummary.surplusCrossoverPeriod?.periodLabel).toBe(
      'Dec 2026',
    );
    expect(report.trajectorySummary.debtRatioDeltaPts).toBe(-52.3);
  });
});
