"use client";

import React from "react";
import {
  LiabilityMatrixResponse,
  CreditLimitCalculationResult,
} from "@/lib/api";
import { InlineBulkBillCell } from "./InlineBulkBillCell";
import { formatRupiah } from "@/lib/utils";

interface LiabilityMatrixTableProps {
  matrix: LiabilityMatrixResponse;
  currentMonth: number;
  currentYear: number;
  isCurrentPeriodLocked?: boolean;
  currentPeriodLimitData?: CreditLimitCalculationResult | null;
}

export function LiabilityMatrixTable({
  matrix,
  currentMonth,
  currentYear,
  isCurrentPeriodLocked = false,
  currentPeriodLimitData = null,
}: LiabilityMatrixTableProps) {
  const currentKey = `${currentYear}-${currentMonth}`;

  // 12-month average for purposeful intensity emphasis on the Total row
  const monthlyTotals = matrix.columns.map((col) => matrix.totalsPerMonth[col.key] ?? 0);
  const sumTotals = monthlyTotals.reduce((a, b) => a + b, 0);
  const averageTotal = matrix.columns.length > 0 ? sumTotals / matrix.columns.length : 0;

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      {/* Top Header info */}
      <div className="p-4 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold font-sans text-text-primary">
            12-Month Rolling Debt Matrix
          </h2>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Temporal horizon beginning July 2026. Click empty or populated PayLater/Personal Debt cells to edit.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] font-sans text-text-tertiary">
            <span className="w-2 h-2 rounded-full bg-accent" />
            Current Period: <strong className="font-mono text-text-primary">{currentMonth}/{currentYear}</strong>
          </span>
        </div>
      </div>

      {/* Dense 12-Month Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead>
            <tr className="border-b border-border bg-surface-subtle/70 text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
              <th className="py-3 px-4 font-semibold w-52 sticky left-0 bg-surface-subtle z-10 whitespace-nowrap">
                LIABILITY SOURCE
              </th>
              {matrix.columns.map((col) => {
                const isCurrent = col.key === currentKey;
                return (
                  <th
                    key={col.key}
                    className={`py-2.5 px-2 text-right font-semibold tabular-nums border-l border-border-subtle whitespace-nowrap min-w-[76px] transition-colors ${
                      isCurrent
                        ? "bg-surface-active/50 text-text-primary border-t-2 border-t-accent"
                        : ""
                    }`}
                  >
                    <div className="flex flex-col items-end">
                      <span className={isCurrent ? "text-text-primary font-bold" : ""}>{col.label}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle text-xs">
            {/* 1. PayLater Bills Row (Editable) */}
            <tr className="hover:bg-surface-hover/30 transition-colors">
              <td className="py-2.5 px-4 sticky left-0 bg-surface z-10 font-sans">
                <div className="font-medium text-text-primary">PayLater Bills</div>
                <div className="text-[10px] font-mono text-text-tertiary">Due 25th of month</div>
              </td>
              {matrix.columns.map((col) => {
                const isCurrent = col.key === currentKey;
                const cellData = matrix.payLaterRow.cells[col.key];
                return (
                  <td
                    key={col.key}
                    className={`p-1 border-l border-border-subtle ${
                      isCurrent ? "bg-surface-active/20" : ""
                    }`}
                  >
                    <InlineBulkBillCell
                      bulkBillId={cellData?.bulkBillId}
                      month={col.month}
                      year={col.year}
                      field="paylaterAmount"
                      initialAmount={cellData?.amount ?? 0}
                      isCurrentMonth={isCurrent}
                      disabled={isCurrent && isCurrentPeriodLocked}
                      periodLimit={
                        isCurrent
                          ? (currentPeriodLimitData?.paylaterEvaluation.limit ?? 0)
                          : 0
                      }
                      safeHeadroom={
                        isCurrent
                          ? (currentPeriodLimitData?.ceilingBreakdown
                              .remainingSafeHeadroomForPaylater ?? 0)
                          : 0
                      }
                    />
                  </td>
                );
              })}
            </tr>

            {/* 2. Credit Card Balance Row (Read-only derived) */}
            <tr className="hover:bg-surface-hover/30 transition-colors">
              <td className="py-2.5 px-4 sticky left-0 bg-surface z-10 font-sans">
                <div className="font-medium text-text-primary">Credit Card Charges</div>
                <div className="text-[10px] font-mono text-text-tertiary">Due 11th (cutoff day 20)</div>
              </td>
              {matrix.columns.map((col) => {
                const isCurrent = col.key === currentKey;
                const cell = matrix.creditCardRow.cells[col.key];
                const amount = cell?.amount ?? 0;
                const items = cell?.items ?? [];
                const installmentBadges = items
                  .filter((i) => i.sliceBadge)
                  .map((i) => `${i.label}: ${i.sliceBadge}`);
                return (
                  <td
                    key={col.key}
                    title={
                      items.length > 0
                        ? items
                            .map(
                              (i) =>
                                `${i.label}: ${formatRupiah(i.amount)}${i.sliceBadge ? ` (${i.sliceBadge})` : ""}${i.endedAtLabel ? ` [Ends ${i.endedAtLabel}]` : ""}`
                            )
                            .join("\n")
                        : undefined
                    }
                    className={`py-2 px-2 text-right border-l border-border-subtle ${
                      isCurrent ? "bg-surface-active/20" : ""
                    }`}
                  >
                    {amount > 0 ? (
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-[11px] tabular-nums whitespace-nowrap text-text-primary font-medium">
                          {formatRupiah(amount)}
                        </span>
                        {installmentBadges.length > 0 && (
                          <span className="text-[9px] font-mono text-text-tertiary tabular-nums">
                            {items
                              .filter((i) => i.sliceBadge)
                              .map((i) => i.sliceBadge)
                              .join(" · ")}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="font-mono text-[11px] text-text-tertiary/40 select-none">
                        —
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* 3. Personal & Informal Debt Row (Editable) */}
            <tr className="hover:bg-surface-hover/30 transition-colors">
              <td className="py-2.5 px-4 sticky left-0 bg-surface z-10 font-sans">
                <div className="font-medium text-text-primary">Personal & Informal Debt</div>
                <div className="text-[10px] font-mono text-text-tertiary">Family / peer obligations</div>
              </td>
              {matrix.columns.map((col) => {
                const isCurrent = col.key === currentKey;
                const cellData = matrix.personalDebtRow.cells[col.key];
                return (
                  <td
                    key={col.key}
                    className={`p-1 border-l border-border-subtle ${
                      isCurrent ? "bg-surface-active/20" : ""
                    }`}
                  >
                    <InlineBulkBillCell
                      bulkBillId={cellData?.bulkBillId}
                      month={col.month}
                      year={col.year}
                      field="personalDebtAmount"
                      initialAmount={cellData?.amount ?? 0}
                      isCurrentMonth={isCurrent}
                      disabled={isCurrent && isCurrentPeriodLocked}
                    />
                  </td>
                );
              })}
            </tr>

            {/* Section Header: Contract Installments */}
            <tr className="bg-surface-subtle/50 text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
              <td colSpan={matrix.columns.length + 1} className="py-1.5 px-4 font-semibold">
                Active Installment Contracts
              </td>
            </tr>

            {/* Contract Rows (Read-only projections) */}
            {matrix.contractRows.length === 0 ? (
              <tr>
                <td
                  colSpan={matrix.columns.length + 1}
                  className="py-4 px-4 text-center text-xs font-sans text-text-tertiary"
                >
                  No active installment contracts found.
                </td>
              </tr>
            ) : (
              matrix.contractRows.map((contract) => (
                <tr key={contract.id} className="hover:bg-surface-hover/30 transition-colors">
                  <td className="py-2.5 px-4 sticky left-0 bg-surface z-10 font-sans">
                    <div className="font-medium text-text-primary truncate max-w-[220px]" title={contract.label}>
                      {contract.label}
                    </div>
                    <div className="text-[10px] font-mono text-text-tertiary">
                      {formatRupiah(contract.monthlyInstallment)} / mo
                    </div>
                  </td>
                  {matrix.columns.map((col) => {
                    const isCurrent = col.key === currentKey;
                    const cell = contract.cells[col.key];
                    const amount = cell?.amount ?? 0;
                    const sliceBadge = cell?.sliceBadge;
                    return (
                      <td
                        key={col.key}
                        className={`py-2 px-2 text-right border-l border-border-subtle ${
                          isCurrent ? "bg-surface-active/20" : ""
                        }`}
                      >
                        {amount > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="font-mono text-[11px] tabular-nums whitespace-nowrap text-text-primary font-medium">
                              {formatRupiah(amount)}
                            </span>
                            {sliceBadge && (
                              <span className="text-[9px] font-mono text-text-tertiary tabular-nums">
                                {sliceBadge}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono text-[11px] text-text-tertiary/40 select-none">
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}

            {/* 5. Total Monthly Liabilities Row with purposeful intensity emphasis */}
            <tr className="border-t-2 border-border bg-surface-subtle/90 font-bold">
              <td className="py-3 px-4 sticky left-0 bg-surface-subtle z-10 font-sans text-xs text-text-primary">
                <div>TOTAL LIABILITIES DUE</div>
                <div className="text-[10px] font-mono text-text-tertiary font-normal">
                  Avg: {formatRupiah(Math.round(averageTotal))}
                </div>
              </td>
              {matrix.columns.map((col) => {
                const isCurrent = col.key === currentKey;
                const total = matrix.totalsPerMonth[col.key] ?? 0;
                const isSignificantlyHigh = total > 0 && total >= averageTotal * 1.18;
                const isModeratelyHigh = total > 0 && total >= averageTotal * 1.06 && !isSignificantlyHigh;

                // Intensity tint within existing muted terracotta/rust (delta-negative) and amber (caution)
                let cellTint = "";
                let textColor = "text-text-primary";

                if (isSignificantlyHigh) {
                  cellTint = "bg-[rgba(224,108,83,0.12)]";
                  textColor = "text-delta-negative";
                } else if (isModeratelyHigh) {
                  cellTint = "bg-[rgba(229,155,44,0.08)]";
                  textColor = "text-caution";
                }

                const pctAbove =
                  averageTotal > 0 && total > averageTotal
                    ? Math.round(((total - averageTotal) / averageTotal) * 100)
                    : 0;
                const tooltip =
                  pctAbove > 0 ? `${pctAbove}% above 12-month average` : undefined;

                return (
                  <td
                    key={col.key}
                    title={tooltip}
                    className={`py-3 px-2 text-right border-l border-border-subtle transition-colors ${cellTint} ${
                      isCurrent ? "bg-surface-active/20" : ""
                    }`}
                  >
                    <span className={`font-mono text-xs font-bold tabular-nums whitespace-nowrap ${textColor}`}>
                      {formatRupiah(total)}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
