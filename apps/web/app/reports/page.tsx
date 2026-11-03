import React from "react";
import { fetchExecutiveReport, ReportScope } from "@/lib/api";
import { getDefaultPeriodFromNow } from "@/lib/utils";
import {
  ReportsClientView,
  ReportTab,
} from "@/components/reports/ReportsClientView";

interface ReportsPageProps {
  searchParams: Promise<{
    month?: string;
    year?: string;
    scope?: string;
    tab?: string;
  }>;
}

const VALID_TABS: ReportTab[] = [
  "statement",
  "comparative",
  "amortization",
  "dossier",
  "forecast",
];

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const defaults = getDefaultPeriodFromNow();

  const month = params.month ? parseInt(params.month, 10) : defaults.month;
  const year = params.year ? parseInt(params.year, 10) : defaults.year;
  const validMonth =
    !Number.isNaN(month) && month >= 1 && month <= 12 ? month : defaults.month;
  const validYear =
    !Number.isNaN(year) && year >= 2000 && year <= 2100 ? year : defaults.year;

  const scope: ReportScope = params.scope === "locked" ? "locked" : "all";
  const activeTab: ReportTab = VALID_TABS.includes(params.tab as ReportTab)
    ? (params.tab as ReportTab)
    : "statement";

  const report = await fetchExecutiveReport(validMonth, validYear, scope);

  if (!report) {
    return (
      <div className="space-y-6 max-w-7xl pb-20">
        <div className="pb-3 border-b border-border-subtle">
          <h1 className="text-xl font-bold font-sans tracking-tight text-text-primary">
            Executive Financial Reports & Statements
          </h1>
          <p className="text-xs font-sans text-text-secondary mt-1">
            Formal period closing statement, comparative variance matrix, 12-month debt schedule, and governance dossier.
          </p>
        </div>
        <div className="p-8 border border-border-subtle border-dashed rounded-lg text-center text-text-secondary text-sm">
          Executive report data is currently unavailable.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <ReportsClientView report={report} activeTab={activeTab} />
    </div>
  );
}
