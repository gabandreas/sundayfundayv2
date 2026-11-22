import React from "react";
import Link from "next/link";
import { fetchAnalytics, AnalyticsScope } from "@/lib/api";
import { MetricCard } from "@/components/primitives/MetricCard";
import { AnalyticsScopeToggle } from "@/components/analytics/AnalyticsScopeToggle";
import { CashflowComparisonChart } from "@/components/analytics/CashflowComparisonChart";
import { CategoryDistributionPanel } from "@/components/analytics/CategoryDistributionPanel";
import { AnalyticsGoTelemetryStrip } from "@/components/analytics/AnalyticsGoTelemetryStrip";
import { PageHeader } from "@/components/primitives/PageHeader";
import { formatRupiah } from "@/lib/utils";

interface AnalyticsPageProps {
  searchParams: Promise<{ scope?: string; month?: string; year?: string }>;
}

function formatRp(amount: number): string {
  return formatRupiah(amount);
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const params = await searchParams;
  const currentScope: AnalyticsScope =
    params.scope === "locked" ? "locked" : "all";

  const report = await fetchAnalytics(currentScope);

  if (!report) {
    return (
      <div className="space-y-6 w-full max-w-full pb-20">
        <PageHeader
          title="Spending & Cashflow Trend"
          subtitle="Multi-period cashflow aggregation, category conservation, and savings trajectory."
        />
        <div className="p-8 border border-border-subtle border-dashed rounded-lg text-center text-text-secondary text-sm">
          Analytics data is currently unavailable.
        </div>
      </div>
    );
  }

  const { kpis } = report;
  const isOptimalSavings = kpis.savingsRateStatus === "OPTIMAL";

  return (
    <div className="space-y-6 w-full max-w-full pb-20">
      <PageHeader
        title="Spending & Cashflow Trend"
        periodLabel={report.dateRangeLabel}
        subtitle={`Multi-period cashflow aggregation, 100% income allocation breakdown, and deleveraging trajectory across ${report.periodCount} ${
          report.periodCount === 1 ? "period" : "periods"
        } (${report.lockedCount} closed, ${report.draftCount} active draft).`}
        rightActions={
          <div className="flex items-center gap-3">
            <Link href="/reports?sub=variance" className="text-xs font-mono text-text-secondary hover:text-text-primary hover:underline">
              Open in Reports
            </Link>
            <AnalyticsScopeToggle
              currentScope={currentScope}
              totalAvailableCount={report.totalAvailableSnapshotsCount}
              lockedCount={report.lockedSnapshotsCount}
            />
          </div>
        }
      />

      {/* Top KPI Row: 4 MetricCards (Centerpiece serif strictly on Card 1 & Card 3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Average Monthly Income (Centerpiece) */}
        <MetricCard
          label="Average Monthly Income"
          amount={kpis.averageMonthlyIncome}
          value={formatRp(kpis.averageMonthlyIncome)}
          isCenterpiece={true}
          footer={`Total ${formatRp(kpis.totalIncomeAcrossPeriods)} across ${report.periodCount} ${
            report.periodCount === 1 ? "period" : "periods"
          }`}
        />

        {/* Card 2: Average Monthly Savings (Tabular Mono) */}
        <MetricCard
          label="Average Monthly Savings"
          amount={kpis.averageMonthlySavings}
          value={formatRp(kpis.averageMonthlySavings)}
          isCenterpiece={false}
          footer={`Funded total: ${formatRp(kpis.cumulativePlannedSavings)} (target ${formatRp(
            kpis.cumulativeSavingsTarget
          )})`}
        />

        {/* Card 3: Aggregate Savings Rate (Centerpiece) */}
        <MetricCard
          label="Aggregate Savings Rate"
          value={`${kpis.aggregateSavingsRate.toFixed(1)}%`}
          subvalue={`/ ${kpis.savingsRateTarget.toFixed(0)}% target`}
          isCenterpiece={true}
          statusVariant={isOptimalSavings ? "default" : "caution"}
          footer={`Credit & liability burden: ${kpis.overallCreditDebtRatioPercent.toFixed(1)}% of income`}
        />

        {/* Card 4: Cumulative Savings Deposited (Tabular Mono) */}
        <MetricCard
          label="Cumulative Savings Deposited"
          amount={kpis.cumulativeVaultInflow}
          value={formatRp(kpis.cumulativeVaultInflow)}
          isCenterpiece={false}
          footer={`Realized deposits: ${kpis.vaultRealizationRatePercent.toFixed(1)}% of Core Savings (${formatRp(
            kpis.untransferredPlannedSavings
          )} pending transfer)`}
        />
      </div>

      {/* Section 1: Multi-Period Cashflow & Deleveraging Trajectory */}
      <CashflowComparisonChart
        series={report.cashflowSeries}
        trajectory={report.trajectorySummary}
      />

      {/* Sections 2 & 3: 100%-Accounted Category Distribution & Period-by-Period Ledger */}
      <CategoryDistributionPanel
        categories={report.categoryDistribution}
        series={report.cashflowSeries}
        kpis={report.kpis}
        periodCount={report.periodCount}
      />

      <AnalyticsGoTelemetryStrip />
    </div>
  );
}
