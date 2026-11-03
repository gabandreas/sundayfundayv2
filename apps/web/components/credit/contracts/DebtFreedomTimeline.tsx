"use client";

import React from "react";
import { CreditContract } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface DebtFreedomTimelineProps {
  contracts: CreditContract[];
}

export function DebtFreedomTimeline({ contracts }: DebtFreedomTimelineProps) {
  // Derive aggregate milestones purely for display
  const totalMonthlyInstallment = contracts.reduce((sum, c) => sum + c.monthlyInstallment, 0);
  const totalRemainingDebt = contracts.reduce(
    (sum, c) => sum + (c.remainingPrincipal ?? c.remainingTenor * c.monthlyInstallment),
    0
  );

  // Furthest payoff date directly taken from server-computed payoffDateLabel / payoffYear / payoffMonth
  let latestContract: CreditContract | null = null;
  for (const c of contracts) {
    if (
      !latestContract ||
      (c.payoffYear ?? 0) > (latestContract.payoffYear ?? 0) ||
      ((c.payoffYear ?? 0) === (latestContract.payoffYear ?? 0) &&
        (c.payoffMonth ?? 0) > (latestContract.payoffMonth ?? 0))
    ) {
      latestContract = c;
    }
  }

  const finalFreedomDate = latestContract?.payoffDateLabel ?? "Debt Free";

  return (
    <div className="space-y-6">
      {/* Top Metrics Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Centerpiece: Debt Freedom Target */}
        <div className="col-span-5 rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
          <div className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            DEBT FREEDOM HORIZON
          </div>
          <div className="my-2">
            <div className="font-display text-[32px] font-normal leading-none tracking-tight text-text-primary">
              {finalFreedomDate}
            </div>
            <div className="text-xs font-sans text-text-tertiary mt-2">
              Projected date all active installment contracts reach 100% payoff
            </div>
          </div>
          <div className="text-[11px] font-mono text-text-secondary pt-2 border-t border-border-subtle">
            {contracts.length} active contracts scheduled
          </div>
        </div>

        {/* Total Monthly Installment Burden */}
        <div className="col-span-4 rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
          <div className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            MONTHLY INSTALLMENT COMMITMENT
          </div>
          <div className="my-2">
            <div className="font-mono text-[24px] font-semibold leading-none tracking-tight text-text-primary tabular-nums">
              {formatRupiah(totalMonthlyInstallment)}
            </div>
            <div className="text-xs font-sans text-text-tertiary mt-2">
              Fixed deduction locked into payroll waterfall each period
            </div>
          </div>
          <div className="text-[11px] font-mono text-text-secondary pt-2 border-t border-border-subtle">
            Billed on payroll cutoff (1st of month)
          </div>
        </div>

        {/* Total Remaining Debt */}
        <div className="col-span-3 rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
          <div className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            OUTSTANDING PRINCIPAL
          </div>
          <div className="my-2">
            <div className="font-mono text-[24px] font-semibold leading-none tracking-tight text-text-primary tabular-nums">
              {formatRupiah(totalRemainingDebt)}
            </div>
            <div className="text-xs font-sans text-text-tertiary mt-2">
              Total debt to extinguish
            </div>
          </div>
          <div className="text-[11px] font-mono text-text-secondary pt-2 border-t border-border-subtle">
            Excludes revolving card balance
          </div>
        </div>
      </div>

      {/* Progress Lanes by Contract */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary">
            Amortization & Payoff Progress Lanes
          </h3>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Individual amortization timelines based on server-computed remaining tenors.
          </p>
        </div>

        {contracts.length === 0 ? (
          <div className="py-8 text-center text-xs font-sans text-text-tertiary">
            No active repayment lanes to track.
          </div>
        ) : (
          <div className="space-y-4 divide-y divide-border-subtle">
            {contracts.map((c) => (
              <div key={c.id} className="pt-4 first:pt-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-xs font-sans text-text-primary">{c.label}</span>
                    <span className="text-[11px] font-mono text-text-tertiary ml-2">
                      ({formatRupiah(c.monthlyInstallment)} / mo)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-text-secondary">
                      Payoff: <strong className="text-text-primary font-semibold">{c.payoffDateLabel}</strong>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle text-text-tertiary">
                      {c.remainingTenor} mo remaining
                    </span>
                  </div>
                </div>

                {/* Progress Bar with start and target markers */}
                <div className="space-y-1">
                  <div className="h-2 w-full bg-surface-subtle rounded-full overflow-hidden border border-border-subtle">
                    <div
                      className="h-full bg-delta-positive transition-all duration-300 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, c.tenorProgressPercent ?? 0))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-text-tertiary">
                    <span>Start: {c.startMonth ?? 7}/{c.startYear ?? 2026}</span>
                    <span>{c.tenorProgressPercent ?? 0}% completed</span>
                    <span>Goal: {c.payoffDateLabel}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
