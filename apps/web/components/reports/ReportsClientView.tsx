"use client";

import React from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Mail,
  Printer,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import {
  ComparativePeriodRow,
  ExecutiveReportPayload,
  ReportScope,
  fetchExecutiveReport,
  getCached,
  setCached,
  sendMonthlyStatementEmail,
} from "@/lib/api";
import { formatIDR, formatDate } from "@/lib/utils";
import { MetricCard } from "@/components/primitives/MetricCard";
import { AnalyticsGoTelemetryStrip } from "@/components/analytics/AnalyticsGoTelemetryStrip";
import { ReportsAuditEmbed } from "@/components/reports/ReportsAuditEmbed";
import { ReportsInsightsTrendEmbed } from "@/components/reports/ReportsInsightsTrendEmbed";
import { exportExecutiveReportToExcel } from "@/lib/exportReportsExcel";
import { PageHeader } from "@/components/primitives/PageHeader";
import { BrandMark } from "@/components/primitives/BrandMark";
import { SubModuleNav } from "@/components/primitives/SubModuleNav";
import { useSubModule } from "@/hooks/useSubModule";
import { REPORTS_SUB_KEYS, ReportsSubKey } from "@/lib/tabs";
import { ReportsEquityChart } from "@/components/reports/ReportsEquityChart";
import { ReportsSpendingBreakdown } from "@/components/reports/ReportsSpendingBreakdown";
import { useLanguage } from "@/context/LanguageContext";
import { usePeriod } from "@/context/PeriodContext";
import {
  DrillDownCategoryFilter,
  ReportDrillDownDrawer,
} from "@/components/reports/ReportDrillDownDrawer";

export type ReportTab =
  | "statement"
  | "comparative"
  | "amortization"
  | "dossier"
  | "forecast";

interface ReportsClientViewProps {
  report: ExecutiveReportPayload;
  activeTab: ReportTab;
}

function formatSnapshotStatusLabel(status: string): string {
  if (status === "LOCKED") return "Closed & Locked";
  if (status === "DRAFT") return "Active Period";
  return "Forecast Preview";
}

function formatPacingStatusLabel(status: string): string {
  switch (status) {
    case "ON_TRACK":
      return "On Track";
    case "CAUTION":
      return "Watch Pace";
    case "BURNING_FAST":
      return "Spending Fast";
    case "DEFICIT_RISK":
      return "Deficit Risk";
    default:
      return "On Track";
  }
}

export function ReportsClientView({
  report: initialReport,
  activeTab,
}: ReportsClientViewProps) {
  const { month: periodMonth, year: periodYear, revisionTick } = usePeriod();
  const [report, setReport] = React.useState<ExecutiveReportPayload>(initialReport);
  const [scope, setScope] = React.useState<ReportScope>(initialReport.scope);
  const [isLoadingReport, setIsLoadingReport] = React.useState(false);
  const reportRef = React.useRef<ExecutiveReportPayload>(initialReport);
  reportRef.current = report;
  const lastRevRef = React.useRef<number>(revisionTick);
  const reqSeqRef = React.useRef<number>(0);

  const initialSubMode: ReportsSubKey =
    activeTab === "comparative" || activeTab === "dossier"
      ? "insights"
      : activeTab === "amortization" || activeTab === "forecast"
        ? "export"
        : "summary";
  const [activeSubMode, selectSubMode] = useSubModule<ReportsSubKey>(
    REPORTS_SUB_KEYS,
    initialSubMode,
    {
      statement: "summary",
      executive: "summary",
      comparative: "insights",
      variance: "insights",
      audit: "insights",
      trend: "insights",
      analytics: "insights",
      amortization: "export",
      forecast: "export",
    },
  );
  const [isExportingExcel, setIsExportingExcel] = React.useState(false);
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
  const [emailFeedback, setEmailFeedback] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [drillDownTarget, setDrillDownTarget] = React.useState<{
    row: ComparativePeriodRow;
    filter: DrillDownCategoryFilter;
  } | null>(null);

  React.useEffect(() => {
    setCached(
      `executiveReport:${initialReport.closingStatement.month}:${initialReport.closingStatement.year}:${initialReport.scope}`,
      initialReport,
    );
  }, [initialReport]);

  React.useEffect(() => {
    const revChanged = revisionTick !== lastRevRef.current;
    lastRevRef.current = revisionTick;

    const targetM = periodMonth;
    const targetY = periodYear;
    const current = reportRef.current;

    if (
      !revChanged &&
      current.closingStatement.month === targetM &&
      current.closingStatement.year === targetY &&
      current.scope === scope
    ) {
      return;
    }

    const cacheKey = `executiveReport:${targetM}:${targetY}:${scope}`;
    if (!revChanged) {
      const cached = getCached<ExecutiveReportPayload>(cacheKey);
      if (cached) {
        reqSeqRef.current += 1;
        setReport(cached);
        setIsLoadingReport(false);
        return;
      }
    }

    const seq = ++reqSeqRef.current;
    setIsLoadingReport(true);
    let cancelled = false;
    void fetchExecutiveReport(targetM, targetY, scope)
      .then((next) => {
        if (cancelled || seq !== reqSeqRef.current) return;
        if (next) {
          setReport(next);
        }
      })
      .finally(() => {
        if (!cancelled && seq === reqSeqRef.current) {
          setIsLoadingReport(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [periodMonth, periodYear, scope, revisionTick]);

  const { locale, t } = useLanguage();

  const cs = report.closingStatement;
  const p = cs.payroll;
  const uw = cs.upfrontAndWaterfall;
  const gov = cs.governance;
  const mc = cs.moneyCycle;
  const comp = report.comparativeStatement;
  const amort = report.amortizationSchedule;
  const dos = report.dossier;
  const horizon = report.horizonMetrics;

  const handleScopeChange = (nextScope: ReportScope) => {
    if (nextScope === scope) return;
    setScope(nextScope);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("scope", nextScope);
      const nextUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  };

  const isExecutiveTab = activeSubMode === "summary";
  const isVarianceTab = activeSubMode === "insights";
  const isExportTab = activeSubMode === "export";

  const totalInDenominator = Math.max(1, mc.kpis.totalMoneyIn);
  const debtRatioPct = Math.min(100, Math.round((mc.kpis.totalDebtAndBillsPaid / totalInDenominator) * 1000) / 10);
  const livingRatioPct = Math.min(100, Math.round((mc.kpis.livingAndRoutineSpend / totalInDenominator) * 1000) / 10);
  const savedRatioPct = uw.isDeficit
    ? 0
    : Math.max(0, Math.round((mc.kpis.netSavedAndLeftover / totalInDenominator) * 1000) / 10);

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      await exportExecutiveReportToExcel(report, report.profileMode);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleSendStatementEmail = async () => {
    if (isSendingEmail) return;
    setIsSendingEmail(true);
    setEmailFeedback(null);
    try {
      const apiLocale = (locale?.toUpperCase() || "EN") as "EN" | "ID" | "ZH";
      const res = await sendMonthlyStatementEmail({
        month: cs.month,
        year: cs.year,
        scope: report.scope,
        locale: apiLocale,
      });
      if (!res.success || !res.data) {
        const msgParts = [res.error || "Failed to dispatch executive statement email."];
        if (res.errorCode) {
          msgParts.push(`[${res.errorCode}] Check SMTP settings in Preferences -> Kill Switch & SMTP.`);
        }
        setEmailFeedback({
          ok: false,
          message: msgParts.join(" "),
        });
        return;
      }
      const d = res.data;
      setEmailFeedback({
        ok: true,
        message:
          d.status === "SENT"
            ? `Statement (${d.attachmentNames[0] || ".xlsx"}) sent to ${d.recipientEmail}.`
            : `Preview generated for ${d.recipientEmail} (SMTP password unconfigured; ${d.attachmentNames[0] || ".xlsx"} prepared: ${(d.attachmentSizesBytes[0] ?? 0).toLocaleString("en-US")} bytes).`,
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6 pb-10 print:space-y-4 print:pb-0">
      {/* Executive A4 Print Masthead (visible only when printing / saving PDF) */}
      <div className="hidden print:flex items-end justify-between border-b-2 border-[#111827] pb-3 mb-2">
        <div className="flex items-center gap-3">
          <BrandMark size={24} className="shrink-0" />
          <div>
            <div className="text-[10px] font-mono tracking-normal text-[#4b5563]">
              Sunday Funday · Personal Financial Statement
            </div>
            <h1 className="font-display text-2xl font-normal text-[#111827] leading-tight">
              {cs.periodLabel} Executive Cashflow &amp; Ledger Statement
            </h1>
          </div>
        </div>
        <div className="text-right font-mono text-[10px] text-[#374151] space-y-0.5 tabular-nums">
          <div>
            Account: <span className="font-semibold">Gabriel · Personal Workspace</span>
          </div>
          <div>
            Period Status: <span className="font-semibold">{formatSnapshotStatusLabel(cs.status)}</span>
          </div>
          <div>
            Statement Scope: <span className="font-semibold">{report.scope === "locked" ? "Closed Periods" : `All Periods (${comp.periodCount})`}</span>
          </div>
        </div>
      </div>

      <div className="print-hidden space-y-2">
        <PageHeader
          title={t("reports.title")}
          subtitle={t("reports.subtitle")}
          periodLabel={cs.periodLabel}
          status={cs.status}
          statusLabel={formatSnapshotStatusLabel(cs.status)}
          rightActions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded bg-surface p-0.5 border border-border">
                <button
                  type="button"
                  onClick={() => handleScopeChange("all")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors cursor-pointer whitespace-nowrap ${
                    scope === "all"
                      ? "bg-surface-elevated text-text-primary shadow-xs"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  All Months ({comp.periodCount})
                </button>
                <button
                  type="button"
                  onClick={() => handleScopeChange("locked")}
                  className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors cursor-pointer whitespace-nowrap ${
                    scope === "locked"
                      ? "bg-surface-elevated text-text-primary shadow-xs"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  Closed Only
                </button>
              </div>
              {isLoadingReport && (
                <span className="text-[11px] font-mono text-text-tertiary whitespace-nowrap">
                  Updating...
                </span>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                className="erp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                {t("reports.printPdf")}
              </button>
              <button
                type="button"
                onClick={handleSendStatementEmail}
                disabled={isSendingEmail}
                title="Send 4-sheet .xlsx statement to your profile email"
                className="erp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <Mail className="w-3.5 h-3.5" />
                {isSendingEmail ? "Sending..." : "Email (.xlsx)"}
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExportingExcel}
                className="erp-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {isExportingExcel ? t("reports.exportingExcel") : t("reports.downloadExcel")}
              </button>
            </div>
          }
        />
        {emailFeedback && (
          <div
            className={`text-[11px] font-mono px-3 py-1.5 rounded border inline-block ${
              emailFeedback.ok
                ? "border-delta-positive/40 bg-[rgba(16,183,141,0.08)] text-delta-positive"
                : "border-urgency/40 bg-[rgba(255,56,56,0.08)] text-urgency"
            }`}
          >
            {emailFeedback.message}
          </div>
        )}
      </div>

      {/* Top Export Callout when Exports tab selected */}
      {isExportTab && (
        <div className="rounded-lg border border-delta-positive/40 bg-[rgba(16,183,141,0.06)] p-4 flex flex-wrap items-center justify-between gap-4 print-hidden">
          <div>
            <div className="text-xs font-semibold text-text-primary">
              4-Sheet Executive Excel (.xlsx) &amp; Live Gmail Statement Dispatch
            </div>
            <div className="text-[11px] text-text-secondary mt-0.5">
              Includes Executive Summary, Due-Date &amp; Settlement Schedule, Active Contracts Burn-Down, and Line-Item Audit Ledger with live SUM/IF formulas.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendStatementEmail}
              disabled={isSendingEmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-surface hover:bg-surface-elevated text-text-primary border border-border cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              {isSendingEmail ? "Sending..." : "Email Statement (.xlsx)"}
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-medium erp-btn-primary hover:opacity-90 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {isExportingExcel ? t("reports.exportingExcel") : t("reports.downloadExcel")}
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:grid-cols-4 print-avoid-break">
        <MetricCard
          label={t("reports.kpi.moneyIn")}
          value={formatIDR(mc.kpis.totalMoneyIn)}
          isCenterpiece={false}
          footer={`Take-home pay ${formatIDR(mc.kpis.netPaycheck)}${mc.kpis.extraInflow > 0 ? ` + Extra ${formatIDR(mc.kpis.extraInflow)}` : " · No extra income"}`}
        />

        <MetricCard
          label={t("reports.kpi.debtBills")}
          value={formatIDR(mc.kpis.totalDebtAndBillsPaid)}
          isCenterpiece={false}
          footer={`${mc.kpis.debtShareOfIncomePercent}% of Money In (PayLater, CC & Personal Debt)`}
        />

        <MetricCard
          label={t("reports.kpi.livingCash")}
          value={formatIDR(mc.kpis.livingAndRoutineSpend)}
          isCenterpiece={false}
          footer={`Routine bills ${formatIDR(uw.fixedEssentialsActual)} + Daily living ${formatIDR(uw.actualDailyOperational)}${uw.manualDeductions > 0 ? ` + Logged spend ${formatIDR(uw.manualDeductions)}` : ""}`}
        />

        <MetricCard
          label={`${t("reports.kpi.netSaved")} · ${cs.periodLabel}`}
          value={
            uw.isDeficit
              ? `-${formatIDR(uw.deficitUncovered)}`
              : formatIDR(mc.kpis.netSavedAndLeftover)
          }
          isCenterpiece={true}
          footer={
            uw.isDeficit
              ? "Uncovered deficit after upfront debt & living bills"
              : `Core Savings: ${formatIDR(uw.actualSavings)} · Discretionary: ${formatIDR(uw.actualSelfReward)}`
          }
        />
      </div>

      {/* Paycheck Allocation Ratio Breakdown Strip */}
      <div className="rounded-lg border border-border bg-surface p-3.5 sm:p-4 space-y-2.5 print-avoid-break">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-text-primary">
            {t("reports.allocationStrip")} ({cs.periodLabel})
          </span>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono tabular-nums text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-delta-negative" />
              Debt {debtRatioPct}%
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-caution" />
              Living {livingRatioPct}%
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-delta-positive" />
              Saved {savedRatioPct}%
            </span>
          </div>
        </div>
        <div className="h-2.5 w-full rounded bg-surface-subtle overflow-hidden flex">
          {debtRatioPct > 0 && (
            <div
              className="h-full bg-delta-negative"
              style={{ width: `${debtRatioPct}%` }}
              title={`Debt & Bills: ${debtRatioPct}%`}
            />
          )}
          {livingRatioPct > 0 && (
            <div
              className="h-full bg-caution"
              style={{ width: `${livingRatioPct}%` }}
              title={`Living & Routine Bills: ${livingRatioPct}%`}
            />
          )}
          {savedRatioPct > 0 && (
            <div
              className="h-full bg-delta-positive"
              style={{ width: `${savedRatioPct}%` }}
              title={`Net Saved: ${savedRatioPct}%`}
            />
          )}
        </div>

        {/* Executive Health Ratios & Burn-Down Velocity */}
        {horizon && (
          <div className="pt-2.5 border-t border-border-subtle grid grid-cols-2 lg:grid-cols-5 gap-3 text-xs font-mono tabular-nums">
            <div>
              <div className="text-[10px] text-text-tertiary">DSR Ratio</div>
              <div className="font-semibold text-text-primary mt-0.5">
                {horizon.dsrPercent}%
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-tertiary">Net Savings Rate</div>
              <div className="font-semibold text-delta-positive mt-0.5">
                {horizon.netSavingsRatePercent}%
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-tertiary">Debt Paydown</div>
              <div className="font-semibold text-text-primary mt-0.5">
                {formatIDR(horizon.debtBurnDownVelocityRp)}/mo
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-tertiary">Effective Living / Day</div>
              <div className="font-semibold text-text-primary mt-0.5">
                {formatIDR(horizon.effectiveDailyLivingRate)}
              </div>
            </div>
            <div className="col-span-2 lg:col-span-1">
              <div className="text-[10px] text-text-tertiary">Next Payoff Relief</div>
              <div className="font-semibold text-delta-positive mt-0.5 truncate" title={horizon.nextMilestoneLabel}>
                {horizon.nextMilestoneLabel}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="print-hidden">
        <SubModuleNav
          items={[
            { key: "summary", label: t("sub.reports.summary") },
            { key: "insights", label: t("sub.reports.insights") },
            { key: "export", label: t("sub.reports.export") },
          ]}
          activeKey={activeSubMode}
          onSelect={selectSubMode}
        />
      </div>

      <div className="relative space-y-6">
      {/* =====================================================================
          TAB 1 (MAIN VIEW): EXECUTIVE & TRADING CURVE
         ===================================================================== */}
      {isExecutiveTab && (
        <div className="space-y-6">
          <ReportsEquityChart
            periods={comp.periods}
            selectedMonth={cs.month}
            selectedYear={cs.year}
          />
          <ReportsSpendingBreakdown statement={cs} />
          {/* 2. "Where Your Money Went & Why This Month Changed" (Deterministic Driver & Spike Callout) */}
          <section className="bg-surface border border-border rounded-lg overflow-hidden print-avoid-break">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface-subtle/40">
              <div>
                <h3 className="text-xs font-semibold text-text-primary">
                  Where Your Money Went & Why This Month Changed
                </h3>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Plain-language diagnostic comparing {cs.periodLabel} against your initial budget plan
                  {mc.driversAndSpikes.previousPeriodLabel
                    ? ` and last month (${mc.driversAndSpikes.previousPeriodLabel})`
                    : ""}
                  .
                </p>
              </div>
              <span className="text-[11px] font-mono text-text-secondary">
                Discipline Score: {gov.overallDisciplineScore ?? gov.disciplineScore}/100
              </span>
            </div>

            <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
              {/* Left: Biggest Cost Drivers */}
              <div className="col-span-1 lg:col-span-6 space-y-3 lg:pr-4 lg:border-r border-border-subtle">
                <div className="text-[10px] font-mono text-text-tertiary">
                  Biggest Cost Drivers in {cs.periodLabel}
                </div>
                <p className="text-xs text-text-primary leading-relaxed font-medium">
                  {mc.driversAndSpikes.biggestCostDriversHeadline}
                </p>
                <div className="space-y-2 pt-1">
                  {mc.driversAndSpikes.costDrivers.map((d) => (
                    <div
                      key={d.key}
                      className="flex items-center justify-between py-1.5 px-3 rounded bg-surface-subtle/50 border border-border-subtle"
                    >
                      <div>
                        <div className="font-medium text-text-primary">
                          {d.label}
                        </div>
                        <div className="text-[11px] text-text-tertiary">
                          {d.detail}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-semibold text-text-primary">
                          {formatIDR(d.amount)}
                        </div>
                        <div className="text-[11px] text-text-secondary">
                          {d.shareOfIncomePercent}% of Money In
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Month-over-Month Spikes & Mid-Month Budget Edits */}
              <div className="col-span-1 lg:col-span-6 space-y-3">
                <div className="text-[10px] font-mono text-text-tertiary">
                  What Changed vs.{" "}
                  {mc.driversAndSpikes.previousPeriodLabel ?? "Baseline Plan"}
                </div>
                <p className="text-xs text-text-primary leading-relaxed font-medium">
                  {mc.driversAndSpikes.monthOverMonthHeadline}
                </p>

                {mc.driversAndSpikes.spikes.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {mc.driversAndSpikes.spikes.map((s) => (
                      <div
                        key={s.key}
                        className="py-1.5 px-3 rounded bg-surface-subtle/50 border border-border-subtle space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-text-primary">
                            {s.label}
                          </span>
                          <span
                            className={`font-mono font-semibold ${
                              s.deltaAmount > 0
                                ? "text-negative"
                                : s.deltaAmount < 0
                                ? "text-positive"
                                : "text-text-secondary"
                            }`}
                          >
                            {s.deltaAmount > 0 ? "+" : ""}
                            {formatIDR(s.deltaAmount)} (
                            {formatIDR(s.previousAmount)} →{" "}
                            {formatIDR(s.currentAmount)})
                          </span>
                        </div>
                        <div className="text-[11px] text-text-secondary">
                          {s.explanation}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {mc.driversAndSpikes.budgetRevisionSummaryText && (
                  <div className="p-3 rounded bg-surface-subtle border border-border text-[11px] text-text-secondary leading-relaxed">
                    <span className="font-semibold text-text-primary">
                      How You Adjusted Your Budget Mid-Month:{" "}
                    </span>
                    {mc.driversAndSpikes.budgetRevisionSummaryText}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 3. Actionable "Payday Execution Checklist" (Transfer & Payment Guide) */}
          <section className="bg-surface border border-border rounded-lg overflow-hidden print-avoid-break">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface-subtle/40">
              <div>
                <h3 className="text-xs font-semibold text-text-primary">
                  Payday Execution Checklist (Transfer & Payment Guide)
                </h3>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Follow these 4 steps on payday so every bill is covered and your spending cash matches your plan.
                </p>
              </div>
              <span className="text-[11px] font-mono text-text-secondary">
                Total Distributed: {formatIDR(mc.kpis.totalMoneyIn)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border text-xs">
              {/* Checklist 1 */}
              <div className="p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono text-text-tertiary">
                    1. Set Aside for Debt & Bills
                  </div>
                  <div className="font-mono text-base font-semibold text-text-primary">
                    {formatIDR(
                      mc.paydayChecklist.step1SetAsideForDebt.totalAmount
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary">
                    Reserve immediately for upcoming statement due dates.
                  </p>
                </div>
                <div className="pt-2.5 border-t border-border-subtle space-y-1 text-[11px] font-mono text-text-secondary">
                  <div className="flex justify-between">
                    <span>PayLater (due {mc.paydayChecklist.paylaterDueDay}th)</span>
                    <span>
                      {formatIDR(
                        mc.paydayChecklist.step1SetAsideForDebt.paylaterAmount
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Credit Card (due {mc.paydayChecklist.creditDueDay}th)</span>
                    <span>
                      {formatIDR(
                        mc.paydayChecklist.step1SetAsideForDebt.creditCardAmount
                      )}
                    </span>
                  </div>
                  {mc.paydayChecklist.step1SetAsideForDebt.personalDebtAmount >
                    0 && (
                    <div className="flex justify-between">
                      <span>Personal Debt</span>
                      <span>
                        {formatIDR(
                          mc.paydayChecklist.step1SetAsideForDebt
                            .personalDebtAmount
                        )}
                      </span>
                    </div>
                  )}
                  {mc.paydayChecklist.step1SetAsideForDebt
                    .contractInstallmentsAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Active Contracts</span>
                      <span>
                        {formatIDR(
                          mc.paydayChecklist.step1SetAsideForDebt
                            .contractInstallmentsAmount
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Checklist 2 */}
              <div className="p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono text-text-tertiary">
                    2. Keep in Operational Account
                  </div>
                  <div className="font-mono text-base font-semibold text-text-primary">
                    {formatIDR(
                      mc.paydayChecklist.step2KeepInOperationalAccount
                        .totalAmount
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary">
                    Leave in your daily bank/e-wallet for routine bills and food.
                  </p>
                </div>
                <div className="pt-2.5 border-t border-border-subtle space-y-1 text-[11px] font-mono text-text-secondary">
                  <div className="flex justify-between">
                    <span>Monthly Routine Bills Pool</span>
                    <span>
                      {formatIDR(
                        mc.paydayChecklist.step2KeepInOperationalAccount
                          .fixedRoutinePoolAmount
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Funded Daily Living Pool</span>
                    <span>
                      {formatIDR(
                        mc.paydayChecklist.step2KeepInOperationalAccount
                          .fundedDailyLivingAmount
                      )}
                    </span>
                  </div>
                  {mc.paydayChecklist.step2KeepInOperationalAccount
                    .bufferPocketAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Emergency Buffer</span>
                      <span>
                        {formatIDR(
                          mc.paydayChecklist.step2KeepInOperationalAccount
                            .bufferPocketAmount
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Checklist 3 */}
              <div className="p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-text-tertiary">
                      3. Transfer to Savings Reserve
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        mc.paydayChecklist.step3TransferToSavingsVault
                          .transferStatus === "TRANSFERRED"
                          ? "erp-callout-positive text-positive"
                          : mc.paydayChecklist.step3TransferToSavingsVault
                              .transferStatus === "PENDING" ||
                            mc.paydayChecklist.step3TransferToSavingsVault
                              .transferStatus === "PARTIAL"
                          ? "erp-callout-caution text-caution"
                          : "border border-border text-text-tertiary"
                      }`}
                    >
                      {
                        mc.paydayChecklist.step3TransferToSavingsVault
                          .statusLabel
                      }
                    </span>
                  </div>
                  <div className="font-mono text-base font-semibold text-positive">
                    {formatIDR(
                      mc.paydayChecklist.step3TransferToSavingsVault
                        .fundedP1Savings
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary">
                    Move to your dedicated Savings / Bibit RDPU account.
                  </p>
                </div>
                <div className="pt-2.5 border-t border-border-subtle space-y-1.5 text-[11px]">
                  <div className="flex justify-between font-mono text-text-secondary">
                    <span>Deposited to Savings</span>
                    <span>
                      {formatIDR(
                        mc.paydayChecklist.step3TransferToSavingsVault
                          .realizedInVault
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-text-tertiary">
                      Pending:{" "}
                      {formatIDR(
                        mc.paydayChecklist.step3TransferToSavingsVault
                          .pendingTransferAmount
                      )}
                    </span>
                    <Link
                      href={`/savings?month=${cs.month}&year=${cs.year}`}
                      className="inline-flex items-center gap-0.5 text-text-primary hover:underline font-medium print-hidden"
                    >
                      Open Savings
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Checklist 4 */}
              <div className="p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono text-text-tertiary">
                    4. Discretionary Allowance
                  </div>
                  <div className="font-mono text-base font-semibold text-text-primary">
                    {formatIDR(
                      mc.paydayChecklist.step4FreeSelfRewardAllowance
                        .fundedP2Allowance
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary">
                    Discretionary spending money after all bills and core savings are funded.
                  </p>
                </div>
                <div className="pt-2.5 border-t border-border-subtle text-[11px] font-mono text-text-tertiary">
                  {mc.paydayChecklist.step4FreeSelfRewardAllowance
                    .fundedP2Allowance > 0
                    ? "100% discretionary, safe to spend or allocate to savings"
                    : "Paused at Rp 0 this month so upfront bills & core savings come first"}
                </div>
              </div>
            </div>
          </section>

          {/* =================================================================
              4. THE 5-STEP END-TO-END MONEY CYCLE BREAKDOWN
             ================================================================= */}

          {/* STEP 1: MONEY IN (PAYROLL & EXTRA INFLOW) */}
          <section className="bg-surface border border-border rounded-lg overflow-hidden print-avoid-break">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface-subtle/40">
              <div>
                <h3 className="text-xs font-semibold text-text-primary">
                  Step 1 · Money In (Payroll & Extra Inflow)
                </h3>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Attendance cutoff window: <span className="font-mono">{cs.workingDaysWindowLabel}</span> ({p.totalWorkingDays} working days)
                </p>
              </div>
              <span className="font-mono text-sm font-semibold text-positive">
                {formatIDR(p.finalTotalIncome)}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border text-xs">
              <div className="col-span-1 lg:col-span-7 divide-y divide-border-subtle">
                <div className="px-5 py-2.5 flex items-center justify-between">
                  <span className="text-text-secondary">Base Salary</span>
                  <span className="font-mono text-text-primary">
                    {formatIDR(p.baseSalary)}
                  </span>
                </div>
                {p.salaryAdjustment !== 0 && (
                  <div className="px-5 py-2.5 flex items-center justify-between">
                    <span className="text-text-secondary">Salary Adjustment</span>
                    <span className="font-mono text-text-primary">
                      {p.salaryAdjustment > 0 ? "+" : ""}
                      {formatIDR(p.salaryAdjustment)}
                    </span>
                  </div>
                )}
                <div className="px-5 py-2.5 flex items-center justify-between">
                  <span className="text-text-secondary">
                    Attendance Allowance ({p.totalWorkingDays} days ×{" "}
                    {formatIDR(p.dailyAllowance)} · {cs.workingDaysWindowLabel})
                  </span>
                  <span className="font-mono text-positive">
                    +{formatIDR(p.totalDailyAllowance)}
                  </span>
                </div>
                <div className="px-5 py-2.5 flex items-center justify-between">
                  <span className="text-text-secondary">Laptop Allowance</span>
                  <span className="font-mono text-positive">
                    +{formatIDR(p.laptopAllowance)}
                  </span>
                </div>
                <div className="px-5 py-2.5 flex items-center justify-between">
                  <span className="text-text-secondary">
                    Minus: BPJS Kesehatan & TK Deduction (3%)
                  </span>
                  <span className="font-mono text-negative">
                    -{formatIDR(p.bpjsDeduction)}
                  </span>
                </div>
                <div className="px-5 py-2.5 flex items-center justify-between">
                  <span className="text-text-secondary">
                    Minus: Office Cafeteria Deduction
                  </span>
                  <span className="font-mono text-negative">
                    -{formatIDR(p.cafeteriaDeduction)}
                  </span>
                </div>
                <div className="px-5 py-3 flex items-center justify-between bg-surface-subtle/60 font-medium">
                  <span className="text-text-primary">
                    Net Paycheck (Take-Home Salary)
                  </span>
                  <span className="font-mono text-text-primary">
                    {formatIDR(p.netSalaryIncome)}
                  </span>
                </div>
              </div>

              <div className="col-span-1 lg:col-span-5 flex flex-col justify-between divide-y divide-border-subtle">
                <div className="p-5 space-y-2.5">
                  <div className="text-[10px] font-mono text-text-tertiary">
                    Bonus, THR & Extra Income
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">
                      Holiday Allowance (THR)
                    </span>
                    <span className="font-mono text-text-primary">
                      +{formatIDR(p.thrAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">
                      Performance / Spot Bonus
                    </span>
                    <span className="font-mono text-text-primary">
                      +{formatIDR(p.bonusAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">
                      Extra Income ({p.incomeTransactions.length} entries)
                    </span>
                    <span className="font-mono text-positive">
                      +{formatIDR(p.extraIncome)}
                    </span>
                  </div>
                </div>

                <div className="px-5 py-3.5 bg-surface-elevated flex items-center justify-between">
                  <span className="font-semibold text-text-primary text-[11px]">
                    Total Money In
                  </span>
                  <span className="font-mono text-sm font-semibold text-positive">
                    {formatIDR(p.finalTotalIncome)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* STEP 2: DEBT & CREDIT BILLS (DEDUCTED FIRST) */}
          <section className="bg-surface border border-border rounded-lg overflow-hidden print-avoid-break">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface-subtle/40">
              <div>
                <h3 className="text-xs font-semibold text-text-primary">
                  Step 2 · Debt & Credit Bills (Deducted First)
                </h3>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Upfront obligations paid off the top of your paycheck before routine bills, daily living, or savings.
                </p>
              </div>
              <span className="font-mono text-sm font-semibold text-negative">
                -{formatIDR(uw.totalCreditBills)} ({mc.kpis.debtShareOfIncomePercent}% of Money In)
              </span>
            </div>

            {/* 4 Debt Buckets Summary Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border-subtle border-b border-border bg-surface-subtle/30 text-xs">
              <div className="px-5 py-3">
                <div className="text-[10px] font-mono text-text-tertiary">
                  PayLater Statement (Due {mc.paydayChecklist.paylaterDueDay}th)
                </div>
                <div className="font-mono text-sm font-semibold text-text-primary mt-0.5">
                  {formatIDR(uw.paylaterBills)}
                </div>
                <div className="text-[11px] text-text-tertiary mt-0.5">
                  {gov.paylaterUsageLimit > 0
                    ? `Period cap: ${formatIDR(gov.paylaterUsageLimit)}`
                    : "Deducted on payday"}
                </div>
              </div>

              <div className="px-5 py-3">
                <div className="text-[10px] font-mono text-text-tertiary">
                  Credit Card Statement (Due {mc.paydayChecklist.creditDueDay}th)
                </div>
                <div className="font-mono text-sm font-semibold text-text-primary mt-0.5">
                  {formatIDR(uw.creditCardBills)}
                </div>
                <div className="text-[11px] text-text-tertiary mt-0.5">
                  {mc.itemizedCreditCardCharges.length} active card charges below
                </div>
              </div>

              <div className="px-5 py-3">
                <div className="text-[10px] font-mono text-text-tertiary">
                  Personal / Pre-Payday Debt
                </div>
                <div className="font-mono text-sm font-semibold text-text-primary mt-0.5">
                  {formatIDR(uw.personalDebtBills)}
                </div>
                <div className="text-[11px] text-text-tertiary mt-0.5">
                  Informal borrowing settled on payday
                </div>
              </div>

              <div className="px-5 py-3">
                <div className="text-[10px] font-mono text-text-tertiary">
                  Fixed Installment Contracts
                </div>
                <div className="font-mono text-sm font-semibold text-text-primary mt-0.5">
                  {formatIDR(uw.contractInstallments)}
                </div>
                <div className="text-[11px] text-text-tertiary mt-0.5">
                  Multi-month loan contracts
                </div>
              </div>
            </div>

            {/* Inline Itemized Credit Card Sub-Table */}
            <div className="p-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold text-text-secondary">
                  Itemized Credit Card Statement ({mc.itemizedCreditCardCharges.length} Charges Billed in {cs.periodLabel})
                </div>
                <span className="text-[11px] font-mono text-text-secondary">
                  Statement Subtotal: {formatIDR(uw.creditCardBills)}
                </span>
              </div>

              {mc.itemizedCreditCardCharges.length === 0 ? (
                <div className="py-4 text-xs text-text-tertiary">
                  No credit card charges billed in {cs.periodLabel}.
                </div>
              ) : (
                <div className="overflow-x-auto border border-border rounded">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border text-[10px] text-text-tertiary bg-surface-subtle/40">
                        <th className="py-2 px-4 text-left font-medium">
                          Card Transaction / Subscription
                        </th>
                        <th className="py-2 px-3 text-left font-medium">
                          Charge Type
                        </th>
                        <th className="py-2 px-3 text-left font-medium">
                          Installment Progress
                        </th>
                        <th className="py-2 px-4 text-right font-medium">
                          Original Total
                        </th>
                        <th className="py-2 px-4 text-right font-medium">
                          Billed This Month
                        </th>
                        <th className="py-2 px-4 text-right font-medium">
                          Remaining Principal After {cs.periodLabel}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {mc.itemizedCreditCardCharges.map((cc) => (
                        <tr
                          key={cc.id}
                          className="hover:bg-surface-subtle/30"
                        >
                          <td className="py-2 px-4 font-medium text-text-primary">
                            <span>{cc.label}</span>
                            {cc.isNewThisPeriod && (
                              <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-text-secondary">
                                New in {cs.periodLabel}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-text-secondary">
                            {cc.chargeTypeLabel}
                          </td>
                          <td className="py-2 px-3 font-mono text-text-secondary">
                            {cc.sliceBadge ?? "-"}
                            {cc.endedAtLabel
                              ? ` · Ends ${cc.endedAtLabel}`
                              : ""}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-text-secondary">
                            {formatIDR(cc.totalAmount)}
                          </td>
                          <td className="py-2 px-4 text-right font-mono font-semibold text-text-primary">
                            {formatIDR(cc.dueAmount)}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-text-secondary">
                            {cc.remainingPrincipalAfterPeriod > 0
                              ? formatIDR(cc.remainingPrincipalAfterPeriod)
                              : "Rp 0 (Complete)"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* STEP 3: MONTHLY ROUTINE BILLS (TRANSPORT, INTERNET, VAPE, HAIRCUT) */}
          <section className="bg-surface border border-border rounded-lg overflow-hidden print-avoid-break">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface-subtle/40">
              <div>
                <h3 className="text-xs font-semibold text-text-primary">
                  Step 3 · Monthly Routine Bills (Transport, Internet, Vape, Haircut)
                </h3>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  4-column view showing your initial plan, any mid-month budget edits, actual logged expenses, and remaining pool.
                </p>
              </div>
              <span className="font-mono text-sm font-semibold text-text-primary">
                Funded Pool: {formatIDR(uw.fixedEssentialsActual)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-[10px] text-text-tertiary bg-surface-subtle/30">
                    <th className="py-2.5 px-5 text-left font-medium">
                      Routine Bill Category
                    </th>
                    <th className="py-2.5 px-4 text-right font-medium">
                      1. Initial Plan
                    </th>
                    <th className="py-2.5 px-4 text-right font-medium">
                      2. Revised Budget
                    </th>
                    <th className="py-2.5 px-4 text-right font-medium">
                      3. Logged Realization
                    </th>
                    <th className="py-2.5 px-4 text-right font-medium">
                      4. Remaining Pool / Overage
                    </th>
                    <th className="py-2.5 px-5 text-right font-medium">
                      Pool Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {mc.routineBillsRealization.rows.map((r) => (
                    <tr
                      key={r.categoryKey}
                      className="hover:bg-surface-subtle/30"
                    >
                      <td className="py-2.5 px-5 font-medium text-text-primary">
                        {r.label}
                        {r.revisionCount > 0 && (
                          <span className="ml-2 text-[10px] font-mono text-text-tertiary">
                            ({r.revisionDelta >= 0 ? "+" : ""}
                            {formatIDR(r.revisionDelta)} edited)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-text-secondary">
                        {formatIDR(r.initialPlan)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium text-text-primary">
                        {formatIDR(r.revisedBudget)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-text-primary">
                        {formatIDR(r.loggedRealization)}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono ${
                          r.overage > 0 ? "text-negative" : "text-text-secondary"
                        }`}
                      >
                        {r.overage > 0
                          ? `-${formatIDR(r.overage)} Overage`
                          : `${formatIDR(r.remainingPool)} left`}
                      </td>
                      <td className="py-2.5 px-5 text-right font-mono text-text-secondary">
                        {r.statusLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-surface-subtle/60 font-mono text-xs font-semibold">
                    <td className="py-2.5 px-5 text-text-primary">
                      Total Routine Bills Pool
                    </td>
                    <td className="py-2.5 px-4 text-right text-text-secondary">
                      {formatIDR(mc.routineBillsRealization.totalInitialPlan)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-text-primary">
                      {formatIDR(mc.routineBillsRealization.totalRevisedBudget)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-text-primary">
                      {formatIDR(
                        mc.routineBillsRealization.totalLoggedRealization
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right text-text-secondary">
                      {formatIDR(mc.routineBillsRealization.totalRemainingPool)}{" "}
                      left
                    </td>
                    <td className="py-2.5 px-5 text-right text-text-secondary">
                      {mc.routineBillsRealization.totalOverage > 0
                        ? `Exceeded by ${formatIDR(mc.routineBillsRealization.totalOverage)}`
                        : "Covered by Pool"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* STEP 4: DAILY LIVING & FOOD BUDGET (DAILY OPERATIONAL) */}
          <section className="bg-surface border border-border rounded-lg overflow-hidden print-avoid-break">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface-subtle/40">
              <div>
                <h3 className="text-xs font-semibold text-text-primary">
                  Step 4 · Daily Living & Food Budget (Daily Operational)
                </h3>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Payday-to-payday consumption window:{" "}
                  <span className="font-mono">{mc.dailyLiving.cycleDateLabel}</span>{" "}
                  ({mc.dailyLiving.daysInCycle} days ·{" "}
                  {mc.dailyLiving.isEndDateConfirmed
                    ? "Confirmed next payday"
                    : "Projected next payday"}
                  )
                </p>
              </div>
              <span className="text-xs font-mono text-text-secondary">
                Pace: {formatPacingStatusLabel(mc.dailyLiving.pacingStatus)} · Safe Today:{" "}
                <strong className="text-positive">
                  {formatIDR(mc.dailyLiving.safeToSpendToday)}/day
                </strong>
              </span>
            </div>

            {/* 6 Summary Metrics for Daily Living */}
            <div className="grid grid-cols-6 divide-x divide-border-subtle border-b border-border bg-surface-subtle/30 text-xs">
              <div className="p-3.5">
                <div className="text-[10px] font-mono text-text-tertiary">
                  Initial Plan
                </div>
                <div className="font-mono font-medium text-text-secondary mt-0.5">
                  {formatIDR(mc.dailyLiving.initialPlan)}
                </div>
              </div>
              <div className="p-3.5">
                <div className="text-[10px] font-mono text-text-tertiary">
                  Current Monthly Cap
                </div>
                <div className="font-mono font-semibold text-text-primary mt-0.5">
                  {formatIDR(mc.dailyLiving.currentMonthlyCap)}
                </div>
              </div>
              <div className="p-3.5">
                <div className="text-[10px] font-mono text-text-tertiary">
                  Funded Amount
                </div>
                <div className="font-mono font-semibold text-text-primary mt-0.5">
                  {formatIDR(mc.dailyLiving.fundedAmount)}
                </div>
              </div>
              <div className="p-3.5">
                <div className="text-[10px] font-mono text-text-tertiary">
                  Net Daily Spend Used
                </div>
                <div className="font-mono font-semibold text-negative mt-0.5">
                  -{formatIDR(mc.dailyLiving.netDailySpendUsed)}
                </div>
                {mc.dailyLiving.operationalRefundsOffset > 0 && (
                  <div className="text-[10px] font-mono text-positive">
                    Includes +{formatIDR(mc.dailyLiving.operationalRefundsOffset)} refund
                  </div>
                )}
              </div>
              <div className="p-3.5">
                <div className="text-[10px] font-mono text-text-tertiary">
                  Remaining Cash
                </div>
                <div className="font-mono font-semibold text-text-primary mt-0.5">
                  {formatIDR(mc.dailyLiving.remainingOperationalCash)}
                </div>
              </div>
              <div className="p-3.5">
                <div className="text-[10px] font-mono text-text-tertiary">
                  Safe-to-Spend / Day
                </div>
                <div className="font-mono font-semibold text-positive mt-0.5">
                  {formatIDR(mc.dailyLiving.safeToSpendToday)}
                </div>
                <div className="text-[10px] font-mono text-text-tertiary">
                  {mc.dailyLiving.daysRemaining} days remaining
                </div>
              </div>
            </div>

            {/* Inline Table of Actual Manual Daily Expenses & Refunds Logged in Period */}
            <div className="p-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold text-text-secondary">
                  Logged Daily Expenses, Routine Realizations & Refunds ({mc.dailyLiving.itemizedDailyExpenses.length} Entries)
                </div>
                <span className="text-[11px] font-mono text-text-secondary">
                  Gross Logged: {formatIDR(mc.dailyLiving.grossDailyExpensesLogged)} · Refunds: -{formatIDR(mc.dailyLiving.operationalRefundsOffset)} · Net Used: {formatIDR(mc.dailyLiving.netDailySpendUsed)}
                </span>
              </div>

              {mc.dailyLiving.itemizedDailyExpenses.length === 0 ? (
                <div className="py-3 text-xs text-text-tertiary">
                  No manual daily expenses or refunds logged in {cs.periodLabel}.
                </div>
              ) : (
                <div className="overflow-x-auto border border-border rounded">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border text-[10px] text-text-tertiary bg-surface-subtle/40">
                        <th className="py-2 px-4 text-left font-medium">Date</th>
                        <th className="py-2 px-4 text-left font-medium">
                          Description
                        </th>
                        <th className="py-2 px-4 text-left font-medium">
                          Pool / Category
                        </th>
                        <th className="py-2 px-4 text-right font-medium">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {mc.dailyLiving.itemizedDailyExpenses.map((exp) => (
                        <tr
                          key={exp.id}
                          className="hover:bg-surface-subtle/30"
                        >
                          <td className="py-2 px-4 font-mono text-text-secondary">
                            {formatDate(exp.date)}
                          </td>
                          <td className="py-2 px-4 font-medium text-text-primary">
                            {exp.label}
                          </td>
                          <td className="py-2 px-4 text-text-secondary">
                            {exp.kindLabel}
                            {exp.fixedEssentialCategoryLabel
                              ? ` · ${exp.fixedEssentialCategoryLabel}`
                              : ""}
                          </td>
                          <td
                            className={`py-2 px-4 text-right font-mono font-medium ${
                              exp.kind === "OPERATIONAL_REFUND"
                                ? "text-positive"
                                : "text-text-primary"
                            }`}
                          >
                            {exp.kind === "OPERATIONAL_REFUND" ? "+" : "-"}
                            {formatIDR(exp.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* STEP 5: SAVINGS & BOTTOM LINE (WHAT YOU KEPT) */}
          <section className="bg-surface border border-border rounded-lg overflow-hidden print-avoid-break">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface-subtle/40">
              <div>
                <h3 className="text-xs font-semibold text-text-primary">
                  Step 5 · Savings &amp; Bottom Line (What You Kept)
                </h3>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Core Savings Reserve, Discretionary, Savings Pockets, and Period Verdict.
                </p>
              </div>
              <span
                className={`font-mono text-sm font-semibold ${
                  mc.savingsBottomLine.isDeficit
                    ? "text-negative"
                    : "text-positive"
                }`}
              >
                {mc.savingsBottomLine.verdictHeadline}
              </span>
            </div>

            <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
              <div className="col-span-1 lg:col-span-7 space-y-3 lg:pr-4 lg:border-r border-border-subtle">
                <div className="text-[10px] font-mono text-text-tertiary">
                  Period Savings & Surplus Allocation
                </div>

                <div className="divide-y divide-border-subtle border border-border rounded">
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-text-primary">
                        Core Savings Reserve
                      </div>
                      <div className="text-[11px] text-text-tertiary">
                        Initial Plan: {formatIDR(mc.savingsBottomLine.p1Baseline)} · Target:{" "}
                        {formatIDR(mc.savingsBottomLine.p1Target)}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-semibold text-positive">
                        {formatIDR(mc.savingsBottomLine.p1Funded)} Funded
                      </div>
                      <div className="text-[11px] text-text-secondary">
                        Confirmed Savings:{" "}
                        {formatIDR(mc.savingsBottomLine.realizedInVaultTotal)}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-text-primary">
                        Discretionary
                      </div>
                      <div className="text-[11px] text-text-tertiary">
                        Target: {formatIDR(mc.savingsBottomLine.p2Target)}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-semibold text-text-primary">
                        {formatIDR(mc.savingsBottomLine.p2Funded)} Funded
                      </div>
                      <div className="text-[11px] text-text-tertiary">
                        Discretionary overflow after Core Savings
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-3 flex items-center justify-between bg-surface-subtle/60">
                    <span className="font-semibold text-text-primary">
                      Net Saved & Leftover ({cs.periodLabel})
                    </span>
                    <span
                      className={`font-mono text-sm font-semibold ${
                        mc.savingsBottomLine.isDeficit
                          ? "text-negative"
                          : "text-positive"
                      }`}
                    >
                      {mc.savingsBottomLine.isDeficit
                        ? `-${formatIDR(mc.savingsBottomLine.deficitUncovered)}`
                        : formatIDR(mc.savingsBottomLine.netSavedAndLeftover)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="col-span-1 lg:col-span-5 flex flex-col justify-between space-y-3">
                <div className="space-y-2.5">
                  <div className="text-[10px] font-mono text-text-tertiary">
                    Savings Vault Sub-Allocation (Cumulative Balance)
                  </div>
                  <div className="p-3.5 rounded border border-border bg-surface-subtle/40 space-y-2 font-mono">
                    <div className="flex justify-between text-xs">
                      <span className="font-sans text-text-secondary">
                        Total Savings Vault
                      </span>
                      <span className="font-semibold text-text-primary">
                        {formatIDR(mc.savingsBottomLine.vaultTotalBalance)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-text-secondary">
                      <span className="font-sans">Liquid Cash (Bank / SeaBank)</span>
                      <span>
                        {formatIDR(mc.savingsBottomLine.vaultLiquidCashBalance)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-text-secondary">
                      <span className="font-sans">Yield / Investment Portfolio</span>
                      <span>
                        {formatIDR(
                          mc.savingsBottomLine.vaultInvestmentRdpuBalance
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded border border-border bg-surface-subtle text-[11px] text-text-secondary leading-relaxed">
                  <strong className="text-text-primary">Period Verdict: </strong>
                  {mc.savingsBottomLine.verdictDescription}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          TAB 2: MONTH-TO-MONTH COMPARISON & HEALTH CHECK
         ===================================================================== */}
      {isVarianceTab && (
        <div className="space-y-6">
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-text-primary">
                Month-to-Month Comparison ({comp.periodCount} Months)
              </h3>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Side-by-side comparison of Money In, Debt Bills, Routine &amp; Daily Living, Core Savings, Discretionary, and Change vs Last Month.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-[10px] text-text-tertiary bg-surface-subtle/30">
                  <th className="py-2.5 px-4 text-left font-medium">Month</th>
                  <th className="py-2.5 px-3 text-left font-medium">Status</th>
                  <th className="py-2.5 px-4 text-right font-medium">Money In</th>
                  <th className="py-2.5 px-4 text-right font-medium">
                    Debt Bills
                  </th>
                  <th className="py-2.5 px-3 text-right font-medium">
                    Debt %
                  </th>
                  <th className="py-2.5 px-4 text-right font-medium">
                    Routine & Daily Living
                  </th>
                  <th className="py-2.5 px-4 text-right font-medium">
                    Core Savings
                  </th>
                  <th className="py-2.5 px-4 text-right font-medium">
                    Discretionary
                  </th>
                  <th className="py-2.5 px-5 text-left font-medium">
                    Change vs Last Month
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {comp.periods.map((row) => {
                  const isSelected =
                    row.month === report.selectedMonth &&
                    row.year === report.selectedYear;
                  return (
                    <tr
                      key={`${row.month}-${row.year}`}
                      onClick={() => setDrillDownTarget({ row, filter: "ALL" })}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-surface-elevated/60"
                          : "hover:bg-surface-subtle/50"
                      }`}
                      title="Click any period row or category cell to inspect itemized drill-down"
                    >
                      <td className="py-2.5 px-4 font-mono font-medium text-text-primary underline decoration-dotted underline-offset-4 whitespace-nowrap">
                        {row.periodLabel}
                      </td>
                      <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
                        {row.status === "LOCKED" ? "Closed" : "Draft"}
                      </td>
                      <td
                        className="py-2.5 px-4 text-right font-mono text-text-primary hover:underline whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrillDownTarget({ row, filter: "INCOME" });
                        }}
                      >
                        {formatIDR(row.finalTotalIncome)}
                      </td>
                      <td
                        className="py-2.5 px-4 text-right font-mono text-text-primary hover:underline whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrillDownTarget({ row, filter: "DEBT" });
                        }}
                      >
                        {formatIDR(row.creditBillsAmount)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono whitespace-nowrap ${
                          row.creditDebtRatioPercent > 35
                            ? "text-negative"
                            : row.creditDebtRatioPercent > 20
                            ? "text-caution"
                            : "text-positive"
                        }`}
                      >
                        {row.creditDebtRatioPercent}%
                      </td>
                      <td
                        className="py-2.5 px-4 text-right font-mono text-text-secondary hover:underline whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrillDownTarget({ row, filter: "LIVING" });
                        }}
                      >
                        {formatIDR(row.routineAndDailyLivingAmount)}
                      </td>
                      <td
                        className="py-2.5 px-4 text-right font-mono text-positive hover:underline whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrillDownTarget({ row, filter: "SAVINGS" });
                        }}
                      >
                        {formatIDR(row.actualSavings)}
                      </td>
                      <td
                        className="py-2.5 px-4 text-right font-mono text-text-secondary hover:underline whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrillDownTarget({ row, filter: "SELF_REWARD" });
                        }}
                      >
                        {formatIDR(row.selfReward)}
                      </td>
                      <td className="py-2.5 px-5 font-mono text-[11px] text-text-secondary">
                        {horizon?.periodDrivers.find(
                          (d) => d.month === row.month && d.year === row.year
                        )?.narrativeDriver ?? row.changeVsLastMonthSummary}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-elevated font-mono text-xs font-semibold">
                  <td className="py-3 px-4 text-text-primary" colSpan={2}>
                    Total / Average ({comp.periodCount} Months)
                  </td>
                  <td className="py-3 px-4 text-right text-text-primary">
                    {formatIDR(comp.totals.totalIncome)}
                  </td>
                  <td className="py-3 px-4 text-right text-text-primary">
                    {formatIDR(comp.totals.totalCreditBills)}
                  </td>
                  <td className="py-3 px-3 text-right text-text-primary">
                    {comp.totals.averageCreditDebtRatioPercent}%
                  </td>
                  <td className="py-3 px-4 text-right text-text-primary">
                    {formatIDR(
                      comp.totals.totalFixedEssentials +
                        comp.totals.totalDailyOperational +
                        comp.totals.totalBufferPocket +
                        comp.totals.totalManualDeductions
                    )}
                  </td>
                  <td className="py-3 px-4 text-right text-positive">
                    {formatIDR(comp.totals.totalSavings)}
                  </td>
                  <td className="py-3 px-4 text-right text-text-primary">
                    {formatIDR(comp.totals.totalSelfReward)}
                  </td>
                  <td className="py-3 px-5 text-left text-text-secondary">
                    Avg Savings Rate: {comp.totals.averageSavingsRatePercent}% · Avg Score: {comp.totals.averageDisciplineScore}/100
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <ReportsInsightsTrendEmbed scope={scope} />
      </div>
      )}

      {/* =====================================================================
          TAB 3: FORWARD OUTLOOK & INSTALLMENT SCHEDULE
         ===================================================================== */}
      {isExportTab && (
        <div className="space-y-6">
          <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[10px] text-text-tertiary">
                12-Month Forward Debt Total
              </div>
              <div className="font-mono text-lg font-semibold text-text-primary mt-1">
                {formatIDR(amort.summary.total12MonthObligations)}
              </div>
              <div className="text-[11px] text-text-tertiary mt-1">
                Starts with {formatIDR(amort.months[0]?.totalLiabilityDue ?? 0)} in{" "}
                {amort.months[0]?.periodLabel}
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[10px] text-text-tertiary">
                Heaviest Debt Month
              </div>
              <div className="font-mono text-lg font-semibold text-negative mt-1">
                {amort.summary.peakMonthLabel}
              </div>
              <div className="text-[11px] font-mono text-text-secondary mt-1">
                {formatIDR(amort.summary.peakMonthAmount)} due
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[10px] text-text-tertiary">
                PayLater vs. Credit Card (12M)
              </div>
              <div className="font-mono text-sm font-semibold text-text-primary mt-1.5">
                {formatIDR(amort.summary.totalPaylater12M)} /{" "}
                {formatIDR(amort.summary.totalCreditCard12M)}
              </div>
              <div className="text-[11px] text-text-tertiary mt-1">
                Personal Debt 12M: {formatIDR(amort.summary.totalPersonalDebt12M)}
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[10px] text-text-tertiary">
                First Debt-Free Month
              </div>
              <div className="font-mono text-lg font-semibold text-positive mt-1">
                {amort.summary.firstDebtFreeMonthLabel ?? "Ongoing Subscriptions"}
              </div>
              <div className="text-[11px] text-text-tertiary mt-1">
                Tracks installment & subscription drop-offs
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <h3 className="text-xs font-semibold text-text-primary">
                12-Month Debt & Installment Payoff Schedule
              </h3>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Shows monthly amounts due alongside exact X/Y installment countdowns and which debts finish after each month.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-[10px] text-text-tertiary bg-surface-subtle/30">
                    <th className="py-2.5 px-4 text-left font-medium">Month</th>
                    <th className="py-2.5 px-3 text-right font-medium">
                      PayLater Bill
                    </th>
                    <th className="py-2.5 px-3 text-right font-medium">
                      Credit Card
                    </th>
                    <th className="py-2.5 px-3 text-right font-medium">
                      Personal Debt
                    </th>
                    <th className="py-2.5 px-4 text-right font-medium">
                      Total Due
                    </th>
                    <th className="py-2.5 px-4 text-left font-medium">
                      Active Installment Slices (X/Y) & Subscriptions
                    </th>
                    <th className="py-2.5 px-4 text-left font-medium">
                      Dropping Off After This Month
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {amort.months.map((m) => (
                    <tr
                      key={`${m.month}-${m.year}`}
                      className="hover:bg-surface-subtle/30 align-top"
                    >
                      <td className="py-2.5 px-4 font-mono font-medium text-text-primary whitespace-nowrap">
                        {m.periodLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-text-secondary">
                        {formatIDR(m.paylaterAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-text-secondary">
                        {formatIDR(m.creditCardAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-text-secondary">
                        {formatIDR(m.personalDebtAmount)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-text-primary">
                        {formatIDR(m.totalLiabilityDue)}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {m.activeInstallmentSlices.map((s, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-subtle border border-border-subtle text-[11px] font-mono text-text-primary"
                            >
                              <span>{s.label}</span>
                              <span className="text-text-secondary">
                                [{s.sliceBadge}]
                              </span>
                            </span>
                          ))}
                          {m.activeSubscriptions.map((sub, idx) => (
                            <span
                              key={`sub-${idx}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-subtle/50 border border-border-subtle text-[11px] text-text-secondary"
                            >
                              <span>{sub.label}</span>
                              <span className="font-mono text-[10px] text-text-tertiary">
                                {sub.endedAtLabel
                                  ? `(until ${sub.endedAtLabel})`
                                  : "(recurring)"}
                              </span>
                            </span>
                          ))}
                          {m.activeInstallmentSlices.length === 0 &&
                            m.activeSubscriptions.length === 0 && (
                              <span className="text-text-tertiary">-</span>
                            )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-positive">
                        {m.droppingOffAfterThisMonth.length > 0
                          ? m.droppingOffAfterThisMonth.join(", ")
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-surface-elevated font-mono text-xs font-semibold">
                    <td className="py-3 px-4 text-text-primary">12-Month Total</td>
                    <td className="py-3 px-3 text-right text-text-primary">
                      {formatIDR(amort.summary.totalPaylater12M)}
                    </td>
                    <td className="py-3 px-3 text-right text-text-primary">
                      {formatIDR(amort.summary.totalCreditCard12M)}
                    </td>
                    <td className="py-3 px-3 text-right text-text-primary">
                      {formatIDR(amort.summary.totalPersonalDebt12M)}
                    </td>
                    <td className="py-3 px-4 text-right text-negative">
                      {formatIDR(amort.summary.total12MonthObligations)}
                    </td>
                    <td className="py-3 px-4 text-left text-text-secondary" colSpan={2}>
                      Contracts 12M: {formatIDR(amort.summary.totalContracts12M)} · Peak Month: {amort.summary.peakMonthLabel}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Audit Trail & Health Check Section (shown inside Variance tab) */}
      {isVarianceTab && (
      <div className="space-y-6 pt-2">
          <ReportsAuditEmbed />

          {/* Chronological Mid-Month Budget Edits Log */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-text-primary">
                  Mid-Month Budget Edits Log ({dos.revisions.length} Edits)
                </h3>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Plain-language history of every target adjustment showing What Changed, Before, After, Difference, and Reason.
                </p>
              </div>
            </div>

            {dos.revisions.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-tertiary">
                No mid-month budget edits recorded in the selected scope.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[10px] text-text-tertiary bg-surface-subtle/30">
                      <th className="py-2.5 px-5 text-left font-medium">Month</th>
                      <th className="py-2.5 px-4 text-left font-medium">
                        What Changed
                      </th>
                      <th className="py-2.5 px-4 text-right font-medium">
                        Before
                      </th>
                      <th className="py-2.5 px-4 text-right font-medium">
                        After
                      </th>
                      <th className="py-2.5 px-4 text-right font-medium">
                        Difference
                      </th>
                      <th className="py-2.5 px-5 text-left font-medium">Reason</th>
                      <th className="py-2.5 px-5 text-right font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {dos.revisions.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-subtle/30">
                        <td className="py-2.5 px-5 font-mono text-text-primary">
                          {r.periodLabel}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-text-primary">
                          {r.categoryLabel}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-text-secondary">
                          {formatIDR(r.previousValue)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-text-primary">
                          {formatIDR(r.newValue)}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-mono ${
                            r.difference >= 0 ? "text-caution" : "text-positive"
                          }`}
                        >
                          {r.difference >= 0 ? "+" : ""}
                          {formatIDR(r.difference)}
                        </td>
                        <td className="py-2.5 px-5 text-text-secondary">
                          {r.reason}
                        </td>
                        <td className="py-2.5 px-5 text-right font-mono text-text-tertiary">
                          {formatDate(r.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Per-Period Discipline Scorecard Summary */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border">
              <h3 className="text-xs font-semibold text-text-primary">
                Monthly Financial Health Check & Audit History
              </h3>
              <p className="text-[11px] text-text-secondary mt-0.5">
                7-rule discipline evaluation for each active month.
              </p>
            </div>

            <div className="divide-y divide-border-subtle">
              {dos.periodAudits.map((pa) => (
                <div
                  key={`${pa.month}-${pa.year}`}
                  className="px-5 py-3.5 flex items-start justify-between gap-6"
                >
                  <div className="min-w-[160px]">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-text-primary">
                        {pa.periodLabel}
                      </span>
                      <span className="text-[11px] text-text-tertiary">
                        {pa.status === "LOCKED" ? "Closed" : "Draft"}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-text-secondary mt-1">
                      Score:{" "}
                      <strong className="text-text-primary">
                        {pa.disciplineScore}/100
                      </strong>{" "}
                      ({pa.greenCount} Passed / {pa.redCount} Attention)
                    </div>
                  </div>

                  <div className="flex-1 flex flex-wrap gap-1.5">
                    {pa.flags.map((f) => (
                      <span
                        key={f.id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border ${
                          f.type === "GREEN"
                            ? "bg-emerald-500/5 text-positive border-emerald-500/20"
                            : "bg-red-500/5 text-negative border-red-500/20"
                        }`}
                      >
                        {f.type === "GREEN" ? (
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                        )}
                        {f.title}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Governance & Cash Reconciliation Log */}
          {dos.recentGovernanceLogs.length > 0 && (
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <h3 className="text-xs font-semibold text-text-primary">
                  Recent System Actions, Reconciliations & Cap Alerts
                </h3>
              </div>
              <div className="divide-y divide-border-subtle text-xs">
                {dos.recentGovernanceLogs.slice(0, 12).map((l) => (
                  <div
                    key={l.id}
                    className="px-5 py-2.5 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">
                          {l.actionLabel}
                        </span>
                        <span className="text-[11px] text-text-tertiary">
                          · {l.categoryLabel}
                        </span>
                      </div>
                      <div className="text-text-secondary">{l.summary}</div>
                    </div>
                    <span className="font-mono text-[11px] text-text-tertiary shrink-0">
                      {formatDate(l.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          FORWARD 3-MONTH OUTLOOK (inside Export & Outlook tab)
         ===================================================================== */}
      {isExportTab && (
      <div className="pt-2">
        {report.liquidityForecast && (
        <div className="space-y-6">
          <div
            className={`p-4 rounded-lg border flex items-start justify-between gap-4 ${
              report.liquidityForecast.summary.squeezeMonthsCount > 0
                ? "bg-[rgba(217,142,43,0.10)] border-[rgba(217,142,43,0.35)]"
                : "bg-surface border-border"
            }`}
          >
            <div className="space-y-1">
              <div className="text-xs font-semibold text-text-primary flex items-center gap-2">
                {report.liquidityForecast.summary.squeezeMonthsCount > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-caution shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-positive shrink-0" />
                )}
                <span>
                  Next 3 Months Cashflow & Debt Forecast (From{" "}
                  {report.liquidityForecast.basePeriod.periodLabel})
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                {report.liquidityForecast.summary.headlineAdvisory}
              </p>
            </div>

            <div className="flex items-center gap-5 shrink-0 text-right font-mono text-xs">
              <div>
                <div className="text-[10px] text-text-tertiary">
                  3M Money In
                </div>
                <div className="text-text-primary font-semibold mt-0.5">
                  {formatIDR(
                    report.liquidityForecast.summary.totalProjectedIncome3M
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-text-tertiary">
                  3M Debt Bills
                </div>
                <div className="text-negative font-semibold mt-0.5">
                  {formatIDR(
                    report.liquidityForecast.summary.totalProjectedDeductions3M
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-text-tertiary">
                  3M Funded Core Savings
                </div>
                <div className="text-positive font-semibold mt-0.5">
                  {formatIDR(
                    report.liquidityForecast.summary.totalProjectedSavings3M
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {report.liquidityForecast.months.map((m) => (
              <div
                key={`${m.year}-${m.month}`}
                className={`rounded-lg border bg-surface overflow-hidden flex flex-col justify-between ${
                  m.isLiquiditySqueeze
                    ? "border-[rgba(217,142,43,0.45)]"
                    : "border-border"
                }`}
              >
                <div>
                  <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface-subtle/40">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-text-primary">
                          Month +{m.monthOffset} · {m.periodLabel}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-text-tertiary">
                          {m.sourceMode === "EXISTING_SNAPSHOT"
                            ? "Saved Draft"
                            : "Baseline Forecast"}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-text-tertiary mt-0.5">
                        Payday: {m.expectedPaydayLabel} · Cycle:{" "}
                        {m.cycleDateLabel}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-mono font-medium ${
                        m.liquidityStatus === "DEFICIT_SQUEEZE"
                          ? "text-negative"
                          : m.liquidityStatus === "SAVINGS_COMPRESSED"
                          ? "text-caution"
                          : "text-positive"
                      }`}
                    >
                      {m.liquidityStatus === "DEFICIT_SQUEEZE"
                        ? "Deficit Squeeze"
                        : m.liquidityStatus === "SAVINGS_COMPRESSED"
                        ? "Savings Compressed"
                        : "Healthy Surplus"}
                    </span>
                  </div>

                  {m.isLiquiditySqueeze && m.squeezeBannerText && (
                    <div className="px-5 py-2.5 bg-[rgba(217,142,43,0.12)] border-b border-[rgba(217,142,43,0.30)] text-[11px] font-mono text-caution">
                      {m.squeezeBannerText}
                    </div>
                  )}

                  <div className="p-5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">
                        Projected Money In
                      </span>
                      <span className="font-mono font-semibold text-text-primary">
                        {formatIDR(m.projectedFinalTotalIncome)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">
                        Committed Debt Bills ({m.liabilities.debtRatioPercent}%)
                      </span>
                      <span className="font-mono text-negative">
                        -{formatIDR(m.liabilities.projectedTotalDeductions)}
                      </span>
                    </div>

                    <div className="pl-3 border-l border-border-subtle space-y-1 text-[11px] text-text-tertiary">
                      <div className="flex justify-between">
                        <span>Credit Card Statement</span>
                        <span className="font-mono">
                          {formatIDR(m.liabilities.creditCardsTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>PayLater & Personal Debt</span>
                        <span className="font-mono">
                          {formatIDR(m.liabilities.bulkBillsTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Contracts & Scheduled</span>
                        <span className="font-mono">
                          {formatIDR(
                            m.liabilities.contractsTotal +
                              m.liabilities.scheduledBillsTotal
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                      <span className="text-text-secondary">
                        Routine Bills + Daily Living
                      </span>
                      <span className="font-mono text-text-primary">
                        -
                        {formatIDR(
                          m.projectedFixedEssentials +
                            m.projectedBufferPocket +
                            m.waterfall.projectedDailyOperational
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                      <span className="text-text-secondary">
                        Projected Core Savings (Target:{" "}
                        {formatIDR(m.waterfall.p1SavingsTarget)})
                      </span>
                      <span
                        className={`font-mono font-semibold ${
                          m.waterfall.projectedFundedSavings <
                          m.waterfall.p1SavingsTarget
                            ? "text-caution"
                            : "text-positive"
                        }`}
                      >
                        {formatIDR(m.waterfall.projectedFundedSavings)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">
                        Projected Discretionary
                      </span>
                      <span className="font-mono text-text-primary">
                        {formatIDR(m.waterfall.projectedSelfRewardSurplus)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-border-subtle bg-surface-subtle/30 space-y-1.5 text-[11px]">
                  <div className="font-mono text-[10px] text-text-tertiary">
                    Active Installments ({m.liabilities.activeInstallmentItems.length})
                  </div>
                  {m.liabilities.activeInstallmentItems.length === 0 ? (
                    <div className="text-text-tertiary">
                      No active installment slices in this period.
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {m.liabilities.activeInstallmentItems.map((inst, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between font-mono text-text-secondary"
                        >
                          <span className="truncate max-w-[180px]">
                            {inst.label}{" "}
                            <span className="text-text-tertiary">
                              ({inst.sliceBadge}
                              {inst.isFinalSlice ? " · Final" : ""})
                            </span>
                          </span>
                          <span>{formatIDR(inst.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
      )}
      </div>

      <ReportDrillDownDrawer
        isOpen={Boolean(drillDownTarget)}
        onClose={() => setDrillDownTarget(null)}
        periodRow={drillDownTarget?.row ?? null}
        categoryFilter={drillDownTarget?.filter ?? "ALL"}
        report={report}
      />
    </div>
  );
}
