"use client";

import React from "react";
import { CreditCardSummary } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { InlinePrivacyEye } from "@/components/shell/InlinePrivacyEye";

interface CreditCardOverviewCardProps {
  summary: CreditCardSummary;
}

export function CreditCardOverviewCard({ summary }: CreditCardOverviewCardProps) {
  const { isAmountsMasked, openVerifyModal } = usePrivacyMask();
  const {
    creditLimit,
    statementCutoffDay,
    paymentDueDay,
    currentCycleDue,
    totalOutstandingBalance,
    utilizationPercent,
  } = summary;

  const getMeterColor = (pct: number) => {
    if (pct >= 80) return "bg-urgency";
    if (pct >= 50) return "bg-caution";
    return "bg-delta-positive";
  };

  const getStatusBadge = (pct: number) => {
    if (pct >= 80) {
      return (
        <span className="px-1.5 py-0.5 rounded border border-[rgba(255,56,56,0.35)] text-urgency bg-[rgba(255,56,56,0.1)] text-[10px] font-mono font-medium">
          High Utilization
        </span>
      );
    }
    if (pct >= 50) {
      return (
        <span className="px-1.5 py-0.5 rounded border border-[rgba(229,155,44,0.35)] text-caution bg-[rgba(229,155,44,0.1)] text-[10px] font-mono font-medium">
          Moderate
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded border border-[rgba(16,183,141,0.25)] text-delta-positive bg-[rgba(16,183,141,0.1)] text-[10px] font-mono font-medium">
        Healthy
      </span>
    );
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            Credit Facility & Utilization
          </span>
          <h2 className="text-base font-semibold font-sans text-text-primary mt-0.5">
            BCA Everyday Card & Active Lines
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(utilizationPercent)}
          <span className="text-xs font-mono text-text-secondary">
            {utilizationPercent}% of Limit
          </span>
        </div>
      </div>

      {/* Metric Rows */}
      <div className="grid grid-cols-3 gap-6">
        {/* Centerpiece / Focus: Current Cycle Due */}
        <div className="space-y-1 border-r border-border-subtle pr-4">
          <div className="text-[11px] font-sans font-medium text-text-tertiary">
            CURRENT STATEMENT DUE
          </div>
          <div className="flex items-center gap-1.5 my-1.5">
            <span
              onClick={isAmountsMasked ? openVerifyModal : undefined}
              title={
                isAmountsMasked
                  ? "Click to verify password & reveal figures"
                  : undefined
              }
              className={`font-display text-[28px] font-normal leading-none tracking-tight text-text-primary ${
                isAmountsMasked
                  ? "cursor-pointer hover:text-emerald-300 transition-colors"
                  : ""
              }`}
            >
              {formatRupiah(currentCycleDue)}
            </span>
            {isAmountsMasked && <InlinePrivacyEye size="md" />}
          </div>
          <div className="text-[11px] font-sans text-text-tertiary">
            Due on the <span className="font-mono font-semibold text-text-secondary">{paymentDueDay}th</span> of this month
          </div>
        </div>

        {/* Total Outstanding Balance */}
        <div className="space-y-1 border-r border-border-subtle pr-4">
          <div className="text-[11px] font-sans font-medium text-text-tertiary">
            TOTAL OUTSTANDING BALANCE
          </div>
          <div className="font-mono text-[22px] font-semibold leading-none tracking-tight text-text-primary my-1.5 tabular-nums">
            {formatRupiah(totalOutstandingBalance)}
          </div>
          <div className="text-[11px] font-sans text-text-tertiary">
            Includes multi-month 0% installments
          </div>
        </div>

        {/* Facility Limit & Parameters */}
        <div className="space-y-1">
          <div className="text-[11px] font-sans font-medium text-text-tertiary">
            CREDIT LIMIT & CYCLES
          </div>
          <div className="font-mono text-[22px] font-semibold leading-none tracking-tight text-text-primary my-1.5 tabular-nums">
            {formatRupiah(creditLimit)}
          </div>
          <div className="text-[11px] font-sans text-text-tertiary flex items-center gap-3">
            <span>Cutoff: <strong className="font-mono text-text-secondary">{statementCutoffDay}th</strong></span>
            <span>Due: <strong className="font-mono text-text-secondary">{paymentDueDay}th</strong></span>
          </div>
        </div>
      </div>

      {/* Utilization Progress Meter */}
      <div className="pt-2">
        <div className="flex justify-between text-[11px] font-sans mb-1.5">
          <span className="text-text-tertiary">Facility Utilization Meter</span>
          <span className="font-mono text-text-secondary tabular-nums">
            {formatRupiah(totalOutstandingBalance)} / {formatRupiah(creditLimit)}
          </span>
        </div>
        <div className="h-2 w-full bg-surface-subtle rounded-full overflow-hidden border border-border-subtle">
          <div
            className={`h-full transition-all duration-300 rounded-full ${getMeterColor(
              utilizationPercent
            )}`}
            style={{ width: `${Math.min(100, Math.max(0, utilizationPercent))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
