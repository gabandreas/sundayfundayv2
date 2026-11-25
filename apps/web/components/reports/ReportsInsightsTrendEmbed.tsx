"use client";

import React, { useEffect, useState } from "react";
import { AnalyticsReportResult, AnalyticsScope, fetchAnalytics } from "@/lib/api";
import { usePeriod } from "@/context/PeriodContext";
import { CashflowComparisonChart } from "@/components/analytics/CashflowComparisonChart";
import { CategoryDistributionPanel } from "@/components/analytics/CategoryDistributionPanel";
import { AnalyticsGoTelemetryStrip } from "@/components/analytics/AnalyticsGoTelemetryStrip";

export function ReportsInsightsTrendEmbed({ scope }: { scope: AnalyticsScope }) {
  const { revisionTick } = usePeriod();
  const [report, setReport] = useState<AnalyticsReportResult | null>(null);

  useEffect(() => {
    let active = true;
    fetchAnalytics(scope).then((res) => {
      if (active && res) setReport(res);
    });
    return () => {
      active = false;
    };
  }, [scope, revisionTick]);

  if (!report) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center text-xs font-sans text-text-tertiary">
        Loading multi-period cashflow trajectory...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CashflowComparisonChart
        series={report.cashflowSeries}
        trajectory={report.trajectorySummary}
      />
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
