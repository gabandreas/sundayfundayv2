"use client";

import React from "react";
import { MonthlyClosingStatement } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

interface ReportsSpendingBreakdownProps {
  statement: MonthlyClosingStatement;
}

export function ReportsSpendingBreakdown({
  statement,
}: ReportsSpendingBreakdownProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const { upfrontAndWaterfall: uw, moneyCycle: mc, governance: gov } = statement;

  const totalIn = Math.max(1, mc.kpis.totalMoneyIn);
  const debtAmt = uw.totalCreditBills ?? 0;
  const routineAmt = uw.fixedEssentialsActual ?? 0;
  const livingAmt = uw.actualDailyOperational ?? 0;
  const bufferAmt = uw.actualBufferPocket ?? 0;
  const savedAmt = uw.actualSavings ?? 0;
  const surplusAmt = uw.actualSelfReward ?? 0;

  const buckets = [
    {
      key: "debt",
      label: "Bills & Debt Obligations",
      amount: debtAmt,
      color: "#E06C53",
      detail: `PayLater ${formatRupiah(uw.paylaterBills, isAmountsMasked)} · Card ${formatRupiah(uw.creditCardBills, isAmountsMasked)} · Loan ${formatRupiah(uw.personalDebtBills, isAmountsMasked)}`,
    },
    {
      key: "routine",
      label: "Routine Envelopes",
      amount: routineAmt,
      color: "#94A3B8",
      detail: mc.routineBillsRealization.rows
        .filter((r) => r.revisedBudget > 0 || r.loggedRealization > 0)
        .slice(0, 4)
        .map((r) => `${r.label} ${formatRupiah(r.loggedRealization || r.revisedBudget, isAmountsMasked)}`)
        .join(" · ") || "Configured monthly routine slots",
    },
    {
      key: "living",
      label: "Daily Food & Living",
      amount: livingAmt,
      color: "#E59B2C",
      detail: `Spent ${formatRupiah(mc.dailyLiving.netDailySpendUsed, isAmountsMasked)} · Leftover ${formatRupiah(mc.dailyLiving.remainingOperationalCash, isAmountsMasked)}`,
    },
    {
      key: "saved",
      label: "Core Savings & Buffer",
      amount: savedAmt + bufferAmt,
      color: "#2BB686",
      detail: `Deposited ${formatRupiah(mc.savingsBottomLine.realizedInVaultTotal, isAmountsMasked)} · Target ${formatRupiah(uw.savingsRevised, isAmountsMasked)}`,
    },
    {
      key: "surplus",
      label: "Flexible Surplus",
      amount: surplusAmt,
      color: "#38BDF8",
      detail: surplusAmt > 0 ? "Unallocated discretionary cashflow" : "Absorbed by debt & savings priority",
    },
  ];

  const cycleScore = gov.disciplineScore;
  const overallScore = gov.overallDisciplineScore ?? gov.disciplineScore;

  return (
    <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start print-avoid-break">
      {/* Left 7 Cols: Where Your Money Went This Cycle */}
      <div className="xl:col-span-7 rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Where Your Money Went ({statement.periodLabel})
            </h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              100% decomposition of {formatRupiah(mc.kpis.totalMoneyIn, isAmountsMasked)} cycle inflow.
            </p>
          </div>
          <span className="font-mono text-xs text-text-secondary erp-tabular-currency">
            Total Inflow: {formatRupiah(mc.kpis.totalMoneyIn, isAmountsMasked)}
          </span>
        </div>

        {/* Proportional Segmented Allocation Strip */}
        <div className="h-3 w-full rounded overflow-hidden flex bg-surface-subtle border border-border-subtle">
          {buckets.map((b) => {
            const pct = Math.max(0, Math.min(100, (b.amount / totalIn) * 100));
            if (pct <= 0.2) return null;
            return (
              <div
                key={b.key}
                style={{ width: `${pct}%`, backgroundColor: b.color }}
                title={`${b.label}: ${pct.toFixed(1)}%`}
              />
            );
          })}
        </div>

        <div className="divide-y divide-border-subtle">
          {buckets.map((b) => {
            const pct = Math.max(0, (b.amount / totalIn) * 100);
            return (
              <div key={b.key} className="py-2.5 space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: b.color }}
                    />
                    <span className="font-medium text-text-primary truncate">{b.label}</span>
                  </div>
                  <div className="flex items-baseline gap-3 font-mono shrink-0">
                    <span className="font-semibold text-text-primary erp-tabular-currency">
                      {formatRupiah(b.amount, isAmountsMasked)}
                    </span>
                    <span className="text-[11px] text-text-tertiary w-11 text-right">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="pl-4.5 text-[11px] text-text-tertiary font-mono truncate">
                  {b.detail}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right 5 Cols: Key Cycle Drivers + Unified Health Score */}
      <div className="xl:col-span-5 space-y-4">
        <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
            <h3 className="text-sm font-semibold text-text-primary">
              Unified Discipline &amp; Health Check
            </h3>
            <span className="text-[10px] font-mono text-text-tertiary">
              {gov.greenCount} Passed / {gov.redCount} Attention
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded border border-border-subtle bg-surface-subtle/50">
              <div className="text-[10px] font-mono text-text-tertiary">
                Cycle Check ({statement.periodLabel})
              </div>
              <div
                className={`font-serif text-2xl mt-1 tabular-nums ${
                  cycleScore >= 80
                    ? "text-delta-positive"
                    : cycleScore >= 55
                      ? "text-caution"
                      : "text-delta-negative"
                }`}
              >
                {cycleScore}
                <span className="text-xs font-mono text-text-tertiary"> / 100</span>
              </div>
            </div>

            <div className="p-3 rounded border border-border-subtle bg-surface-subtle/50">
              <div className="text-[10px] font-mono text-text-tertiary">
                Overall Health Average
              </div>
              <div
                className={`font-serif text-2xl mt-1 tabular-nums ${
                  overallScore >= 80
                    ? "text-delta-positive"
                    : overallScore >= 55
                      ? "text-caution"
                      : "text-delta-negative"
                }`}
              >
                {overallScore}
                <span className="text-xs font-mono text-text-tertiary"> / 100</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
            <h3 className="text-sm font-semibold text-text-primary">
              Key Movers vs. {mc.driversAndSpikes.previousPeriodLabel ?? "Baseline"}
            </h3>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            {mc.driversAndSpikes.monthOverMonthHeadline}
          </p>
          {mc.driversAndSpikes.spikes.length > 0 && (
            <div className="space-y-2 pt-1">
              {mc.driversAndSpikes.spikes.slice(0, 3).map((sp) => (
                <div
                  key={sp.key}
                  className="p-2.5 rounded border border-border-subtle bg-surface-subtle/40 flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-text-secondary truncate">{sp.label}</span>
                  <span
                    className={`font-mono font-semibold shrink-0 erp-tabular-currency ${
                      sp.deltaAmount > 0 ? "text-delta-negative" : "text-delta-positive"
                    }`}
                  >
                    {sp.deltaAmount > 0 ? "+" : ""}
                    {formatRupiah(sp.deltaAmount, isAmountsMasked)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
