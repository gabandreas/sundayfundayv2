"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  FileSpreadsheet,
  Printer,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { ExecutiveReportPayload, ReportScope } from "@/lib/api";
import { formatIDR, formatDate } from "@/lib/utils";
import { MetricCard } from "@/components/primitives/MetricCard";
import { exportExecutiveReportToExcel } from "@/lib/exportReportsExcel";

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

const TABS: Array<{ id: ReportTab; label: string }> = [
  { id: "statement", label: "Monthly Money Cycle" },
  { id: "comparative", label: "Month-to-Month Comparison" },
  { id: "amortization", label: "Debt & Installment Payoff Schedule" },
  { id: "dossier", label: "Budget Edits & Audit History" },
  { id: "forecast", label: "Next 3 Months Forecast" },
];

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
  report,
  activeTab,
}: ReportsClientViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const cs = report.closingStatement;
  const p = cs.payroll;
  const uw = cs.upfrontAndWaterfall;
  const gov = cs.governance;
  const mc = cs.moneyCycle;
  const comp = report.comparativeStatement;
  const amort = report.amortizationSchedule;
  const dos = report.dossier;

  const updateUrlParam = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      params.set(k, v);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleScopeChange = (nextScope: ReportScope) => {
    if (nextScope === report.scope) return;
    updateUrlParam({ scope: nextScope });
  };

  const handleTabChange = (nextTab: ReportTab) => {
    if (nextTab === activeTab) return;
    updateUrlParam({ tab: nextTab });
  };

  return (
    <div className="space-y-6 pb-10 print:space-y-4 print:pb-0">
      {/* Top Header & Action Controls */}
      <div className="flex items-start justify-between gap-6 border-b border-border pb-5 print:pb-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-text-primary">
              Monthly Money Cycle & Financial Statement
            </h2>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono ${
                cs.status === "LOCKED"
                  ? "bg-surface-elevated text-text-secondary border border-border"
                  : cs.status === "DRAFT"
                  ? "bg-emerald-500/10 text-positive border border-emerald-500/20"
                  : "bg-surface text-text-tertiary border border-border-subtle"
              }`}
            >
              {cs.periodLabel} · {formatSnapshotStatusLabel(cs.status)}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            End-to-end breakdown of what came in, what went to debt and routine bills, what you spent day-to-day, and what you kept.
          </p>
        </div>

        {/* Controls: Scope Filter + Print / PDF + 5-Sheet Excel Export */}
        <div className="flex items-center gap-2.5 print-hidden">
          <div className="inline-flex items-center rounded bg-surface p-0.5 border border-border">
            <button
              type="button"
              onClick={() => handleScopeChange("all")}
              disabled={isPending}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors cursor-pointer ${
                report.scope === "all"
                  ? "bg-surface-elevated text-text-primary shadow-xs"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              All Months ({comp.periodCount})
            </button>
            <button
              type="button"
              onClick={() => handleScopeChange("locked")}
              disabled={isPending}
              className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors cursor-pointer ${
                report.scope === "locked"
                  ? "bg-surface-elevated text-text-primary shadow-xs"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Closed Months Only
            </button>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save as PDF
          </button>

          <button
            type="button"
            onClick={() => exportExecutiveReportToExcel(report, report.profileMode)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-medium bg-text-primary text-canvas hover:opacity-90 transition-opacity cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export 5-Sheet Workbook (.xlsx)
          </button>
        </div>
      </div>

      {/* Top Summary Strip (4 Plain-Language KPI Cards — ONLY Card 4 uses Centerpiece Newsreader serif) */}
      <div className="grid grid-cols-4 gap-4 print:grid-cols-4 print-avoid-break">
        <MetricCard
          label="Total Money In"
          value={formatIDR(mc.kpis.totalMoneyIn)}
          isCenterpiece={false}
          footer={`Take-home pay ${formatIDR(mc.kpis.netPaycheck)}${mc.kpis.extraInflow > 0 ? ` + Extra ${formatIDR(mc.kpis.extraInflow)}` : " · No extra income"}`}
        />

        <MetricCard
          label="Total Debt & Bills Paid"
          value={formatIDR(mc.kpis.totalDebtAndBillsPaid)}
          isCenterpiece={false}
          footer={`${mc.kpis.debtShareOfIncomePercent}% of Money In (PayLater, CC & Personal Debt)`}
        />

        <MetricCard
          label="Living & Routine Spend"
          value={formatIDR(mc.kpis.livingAndRoutineSpend)}
          isCenterpiece={false}
          footer={`Routine bills ${formatIDR(uw.fixedEssentialsActual)} + Daily living ${formatIDR(uw.actualDailyOperational)}${uw.manualDeductions > 0 ? ` + Logged spend ${formatIDR(uw.manualDeductions)}` : ""}`}
        />

        <MetricCard
          label={`Net Saved & Leftover (${cs.periodLabel})`}
          value={
            uw.isDeficit
              ? `-${formatIDR(uw.deficitUncovered)}`
              : formatIDR(mc.kpis.netSavedAndLeftover)
          }
          isCenterpiece={true}
          footer={
            uw.isDeficit
              ? "Uncovered deficit after upfront debt & living bills"
              : `Saved (P1): ${formatIDR(uw.actualSavings)} · Leftover (P2): ${formatIDR(uw.actualSelfReward)}`
          }
        />
      </div>

      {/* Tab Navigation Bar */}
      <div className="flex items-center justify-between border-b border-border print-hidden">
        <div className="flex items-center gap-6">
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTabChange(t.id)}
                className={`pb-3 text-xs font-medium transition-colors border-b-2 -mb-px cursor-pointer ${
                  active
                    ? "border-text-primary text-text-primary"
                    : "border-transparent text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {isPending && (
          <span className="text-[11px] font-mono text-text-tertiary pb-2">
            Updating view...
          </span>
        )}
      </div>

      {/* =====================================================================
          TAB 1 (MAIN VIEW): MONTHLY MONEY CYCLE
         ===================================================================== */}
      {activeTab === "statement" && (
        <div className="space-y-6">
          {/* 2. "Where Your Money Went & Why This Month Changed" (Deterministic Driver & Spike Callout) */}
          <section className="bg-surface border border-border rounded-lg overflow-hidden print-avoid-break">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface-subtle/40">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
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
                Discipline Score: {gov.disciplineScore}/100
              </span>
            </div>

            <div className="p-5 grid grid-cols-12 gap-6 text-xs">
              {/* Left: Biggest Cost Drivers */}
              <div className="col-span-6 space-y-3 pr-2 border-r border-border-subtle">
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
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
              <div className="col-span-6 space-y-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
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
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
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

            <div className="grid grid-cols-4 divide-x divide-border text-xs">
              {/* Checklist 1 */}
              <div className="p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
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
                  <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
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
                    <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                      3. Transfer to Savings Vault (P1)
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        mc.paydayChecklist.step3TransferToSavingsVault
                          .transferStatus === "TRANSFERRED"
                          ? "border-emerald-500/30 text-positive bg-emerald-500/10"
                          : mc.paydayChecklist.step3TransferToSavingsVault
                              .transferStatus === "PENDING" ||
                            mc.paydayChecklist.step3TransferToSavingsVault
                              .transferStatus === "PARTIAL"
                          ? "border-amber-500/30 text-caution bg-amber-500/10"
                          : "border-border text-text-tertiary"
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
                    <span>Deposited to Vault</span>
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
                      Open Vault
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Checklist 4 */}
              <div className="p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                    4. Free / Self-Reward Allowance (P2)
                  </div>
                  <div className="font-mono text-base font-semibold text-text-primary">
                    {formatIDR(
                      mc.paydayChecklist.step4FreeSelfRewardAllowance
                        .fundedP2Allowance
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary">
                    Guilt-free personal reward money after all bills and P1 savings are funded.
                  </p>
                </div>
                <div className="pt-2.5 border-t border-border-subtle text-[11px] font-mono text-text-tertiary">
                  {mc.paydayChecklist.step4FreeSelfRewardAllowance
                    .fundedP2Allowance > 0
                    ? "100% discretionary — safe to enjoy or sweep to Vault"
                    : "Paused at Rp 0 this month so upfront bills & P1 savings come first"}
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
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
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

            <div className="grid grid-cols-12 divide-x divide-border text-xs">
              <div className="col-span-7 divide-y divide-border-subtle">
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

              <div className="col-span-5 flex flex-col justify-between divide-y divide-border-subtle">
                <div className="p-5 space-y-2.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
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
                  <span className="font-semibold text-text-primary uppercase tracking-wider text-[11px]">
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
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
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
            <div className="grid grid-cols-4 divide-x divide-border-subtle border-b border-border bg-surface-subtle/30 text-xs">
              <div className="px-5 py-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
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
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
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
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
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
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
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
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
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
                      <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-tertiary bg-surface-subtle/40">
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
                            {cc.sliceBadge ?? "—"}
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
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
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
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-tertiary bg-surface-subtle/30">
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
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
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
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                  Initial Plan
                </div>
                <div className="font-mono font-medium text-text-secondary mt-0.5">
                  {formatIDR(mc.dailyLiving.initialPlan)}
                </div>
              </div>
              <div className="p-3.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                  Current Monthly Cap
                </div>
                <div className="font-mono font-semibold text-text-primary mt-0.5">
                  {formatIDR(mc.dailyLiving.currentMonthlyCap)}
                </div>
              </div>
              <div className="p-3.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                  Funded Amount
                </div>
                <div className="font-mono font-semibold text-text-primary mt-0.5">
                  {formatIDR(mc.dailyLiving.fundedAmount)}
                </div>
              </div>
              <div className="p-3.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
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
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                  Remaining Cash
                </div>
                <div className="font-mono font-semibold text-text-primary mt-0.5">
                  {formatIDR(mc.dailyLiving.remainingOperationalCash)}
                </div>
              </div>
              <div className="p-3.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
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
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
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
                      <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-tertiary bg-surface-subtle/40">
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
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                  Step 5 · Savings & Bottom Line (What You Kept)
                </h3>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Core Savings (Priority 1), Self-Reward Surplus (Priority 2), Savings Vault sub-allocation, and Period Verdict.
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

            <div className="p-5 grid grid-cols-12 gap-6 text-xs">
              <div className="col-span-7 space-y-3 pr-2 border-r border-border-subtle">
                <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                  Period Savings & Surplus Allocation
                </div>

                <div className="divide-y divide-border-subtle border border-border rounded">
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-text-primary">
                        Core Savings (Priority 1)
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
                        Vault Realized:{" "}
                        {formatIDR(mc.savingsBottomLine.realizedInVaultTotal)}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-text-primary">
                        Self-Reward / Surplus (Priority 2)
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
                        Guilt-free overflow after P1
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

              <div className="col-span-5 flex flex-col justify-between space-y-3">
                <div className="space-y-2.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
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
                      <span className="font-sans">Investment RDPU (Bibit)</span>
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
          TAB 2: MONTH-TO-MONTH COMPARISON
         ===================================================================== */}
      {activeTab === "comparative" && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                Month-to-Month Comparison ({comp.periodCount} Months)
              </h3>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Side-by-side comparison of Money In, Debt Bills, Routine & Daily Living, Saved (P1), Leftover (P2), and Change vs Last Month.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-tertiary bg-surface-subtle/30">
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
                    Saved (P1)
                  </th>
                  <th className="py-2.5 px-4 text-right font-medium">
                    Leftover (P2)
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
                      className={
                        isSelected
                          ? "bg-surface-elevated/60"
                          : "hover:bg-surface-subtle/30"
                      }
                    >
                      <td className="py-2.5 px-4 font-mono font-medium text-text-primary">
                        {row.periodLabel}
                      </td>
                      <td className="py-2.5 px-3 text-text-secondary">
                        {row.status === "LOCKED" ? "Closed" : "Draft"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-text-primary">
                        {formatIDR(row.finalTotalIncome)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-text-primary">
                        {formatIDR(row.creditBillsAmount)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono ${
                          row.creditDebtRatioPercent > 35
                            ? "text-negative"
                            : row.creditDebtRatioPercent > 20
                            ? "text-caution"
                            : "text-positive"
                        }`}
                      >
                        {row.creditDebtRatioPercent}%
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-text-secondary">
                        {formatIDR(row.routineAndDailyLivingAmount)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-positive">
                        {formatIDR(row.actualSavings)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-text-secondary">
                        {formatIDR(row.selfReward)}
                      </td>
                      <td className="py-2.5 px-5 font-mono text-[11px] text-text-secondary">
                        {row.changeVsLastMonthSummary}
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
      )}

      {/* =====================================================================
          TAB 3: DEBT & INSTALLMENT PAYOFF SCHEDULE
         ===================================================================== */}
      {activeTab === "amortization" && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
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
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
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
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
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
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                12-Month Debt & Installment Payoff Schedule
              </h3>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Shows monthly amounts due alongside exact X/Y installment countdowns and which debts finish after each month.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-tertiary bg-surface-subtle/30">
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
                              <span className="text-text-tertiary">—</span>
                            )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-positive">
                        {m.droppingOffAfterThisMonth.length > 0
                          ? m.droppingOffAfterThisMonth.join(", ")
                          : "—"}
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
      )}

      {/* =====================================================================
          TAB 4: BUDGET EDITS & AUDIT HISTORY
         ===================================================================== */}
      {activeTab === "dossier" && (
        <div className="space-y-6">
          {/* Chronological Mid-Month Budget Edits Log */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
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
                    <tr className="border-b border-border text-[10px] uppercase tracking-wider text-text-tertiary bg-surface-subtle/30">
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
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
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
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
          TAB 5: NEXT 3 MONTHS FORECAST
         ===================================================================== */}
      {activeTab === "forecast" && report.liquidityForecast && (
        <div className="space-y-6">
          <div
            className={`p-4 rounded-lg border flex items-start justify-between gap-4 ${
              report.liquidityForecast.summary.squeezeMonthsCount > 0
                ? "bg-[rgba(217,142,43,0.10)] border-[rgba(217,142,43,0.35)]"
                : "bg-surface border-border"
            }`}
          >
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-text-primary flex items-center gap-2">
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
                <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                  3M Money In
                </div>
                <div className="text-text-primary font-semibold mt-0.5">
                  {formatIDR(
                    report.liquidityForecast.summary.totalProjectedIncome3M
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                  3M Debt Bills
                </div>
                <div className="text-negative font-semibold mt-0.5">
                  {formatIDR(
                    report.liquidityForecast.summary.totalProjectedDeductions3M
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                  3M Funded P1 Savings
                </div>
                <div className="text-positive font-semibold mt-0.5">
                  {formatIDR(
                    report.liquidityForecast.summary.totalProjectedSavings3M
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
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
                        Projected Saved (P1 Target:{" "}
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
                        Projected Leftover (P2)
                      </span>
                      <span className="font-mono text-text-primary">
                        {formatIDR(m.waterfall.projectedSelfRewardSurplus)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-border-subtle bg-surface-subtle/30 space-y-1.5 text-[11px]">
                  <div className="font-mono uppercase tracking-wider text-[10px] text-text-tertiary">
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
  );
}
