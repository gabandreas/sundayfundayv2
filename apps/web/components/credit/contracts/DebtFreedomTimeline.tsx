"use client";

import React, { useMemo } from "react";
import { ActiveInstallmentPlanDto, CreditContract, LiabilityMatrixResponse } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

const MONTH_SHORT = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

function nextPeriod(month: number, year: number) {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
}

interface DebtFreedomTimelineProps {
  contracts: CreditContract[];
  installmentPlans?: ActiveInstallmentPlanDto[];
  currentMonth?: number;
  currentYear?: number;
  matrixData?: LiabilityMatrixResponse | null;
}

export function DebtFreedomTimeline({
  contracts,
  installmentPlans = [],
  currentMonth = 11,
  currentYear = 2026,
  matrixData = null,
}: DebtFreedomTimelineProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const formatRp = (val: number) => formatRupiah(val, isAmountsMasked);
  const currentKey = `${currentYear}-${currentMonth}`;
  const selectedYmVal = currentYear * 12 + currentMonth;

  const normalizedPlans =
    installmentPlans.length > 0
      ? installmentPlans
          .filter(
            (p) =>
              (p.totalTenor ?? 1) > 1 &&
              p.category !== "P1_VAULT_REFUND" &&
              (p.cells?.[currentKey]?.amount ?? 0) > 0
          )
          .map((p) => {
            const sliceBadge = p.cells?.[currentKey]?.sliceBadge ?? null;
            let remainingMonths = Math.max(
              1,
              (p.payoffYear ?? currentYear) * 12 + (p.payoffMonth ?? currentMonth) - selectedYmVal + 1
            );
            let paidMonths = Math.max(0, p.totalTenor - remainingMonths);
            if (sliceBadge && sliceBadge.includes("/")) {
              const [cStr, tStr] = sliceBadge.split("/");
              const cNum = parseInt(cStr, 10);
              const tNum = parseInt(tStr, 10);
              if (!Number.isNaN(cNum) && !Number.isNaN(tNum) && tNum >= cNum) {
                remainingMonths = tNum - cNum + 1;
                paidMonths = Math.max(0, cNum - 1);
              }
            }
            const progressPct =
              p.totalTenor > 0 ? Math.round((paidMonths / p.totalTenor) * 100) : 0;
            const activeSliceAmount = p.cells?.[currentKey]?.amount ?? p.monthlyInstallment;
            return {
              id: p.id,
              label: p.title,
              merchant: p.merchantOrPlatform,
              sliceBadge,
              monthlyInstallment: activeSliceAmount,
              remainingPrincipal: Math.round(activeSliceAmount * remainingMonths),
              remainingTenor: remainingMonths,
              totalTenor: p.totalTenor,
              payoffMonth: p.payoffMonth,
              payoffYear: p.payoffYear,
              payoffDateLabel: p.payoffDateLabel,
              tenorProgressPercent: progressPct,
            };
          })
      : contracts
          .filter((c) => (c.totalTenor ?? 1) > 1)
          .map((c) => ({
            id: String(c.id),
            label: c.label,
            merchant: "Contract",
            sliceBadge: null as string | null,
            monthlyInstallment: c.monthlyInstallment,
            remainingPrincipal: c.remainingPrincipal ?? c.remainingTenor * c.monthlyInstallment,
            remainingTenor: c.remainingTenor,
            totalTenor: c.totalTenor,
            payoffMonth: c.payoffMonth ?? 12,
            payoffYear: c.payoffYear ?? 2026,
            payoffDateLabel: c.payoffDateLabel ?? "-",
            tenorProgressPercent: c.tenorProgressPercent ?? 0,
          }));

  const singlePeriodItems = useMemo(() => {
    if (!matrixData) return [];
    const items: Array<{ id: string; title: string; badge: string; amount: number }> = [];
    for (const li of matrixData.payLaterRow?.cells?.[currentKey]?.items ?? []) {
      if ((li.tenorMonths ?? 1) <= 1 && Math.round(li.monthlyAmount ?? 0) > 0) {
        items.push({
          id: `pl-${li.id}`,
          title: li.title,
          badge: `${li.merchantOrPlatform || "SPayLater"} · 1/1`,
          amount: Math.round(li.monthlyAmount),
        });
      }
    }
    for (const li of matrixData.personalDebtRow?.cells?.[currentKey]?.items ?? []) {
      if (((li.tenorMonths ?? 1) <= 1 || li.category === "P1_VAULT_REFUND") && Math.round(li.monthlyAmount ?? 0) > 0) {
        items.push({
          id: `pd-${li.id}`,
          title: li.title,
          badge: li.category === "P1_VAULT_REFUND" ? "P1 Vault Refund · 1/1" : `${li.merchantOrPlatform || "Personal Debt"} · 1/1`,
          amount: Math.round(li.monthlyAmount),
        });
      }
    }
    for (const ci of matrixData.creditCardRow?.cells?.[currentKey]?.items ?? []) {
      if (!ci.sliceBadge && Math.round(ci.amount ?? 0) > 0) {
        items.push({
          id: `cc-${ci.id}`,
          title: ci.label,
          badge: "Credit Card · 1/1",
          amount: Math.round(ci.amount),
        });
      }
    }
    return items;
  }, [matrixData, currentKey]);

  const totalMonthlyInstallment = normalizedPlans.reduce(
    (sum, p) => sum + p.monthlyInstallment,
    0
  );
  const totalRemainingDebt = normalizedPlans.reduce(
    (sum, p) => sum + p.remainingPrincipal,
    0
  );

  let latestPlan: (typeof normalizedPlans)[number] | null = null;
  for (const p of normalizedPlans) {
    if (
      !latestPlan ||
      p.payoffYear > latestPlan.payoffYear ||
      (p.payoffYear === latestPlan.payoffYear && p.payoffMonth > latestPlan.payoffMonth)
    ) {
      latestPlan = p;
    }
  }

  const finalFreedomDate = latestPlan?.payoffDateLabel ?? "Debt Free";

  const freedUpMilestones = useMemo(() => {
    const map = new Map<
      string,
      {
        month: number;
        year: number;
        label: string;
        freedMonthly: number;
        contracts: string[];
      }
    >();
    for (const p of normalizedPlans) {
      if (!p.payoffMonth || !p.payoffYear) continue;
      const nxt = nextPeriod(p.payoffMonth, p.payoffYear);
      const key = `${nxt.year}-${String(nxt.month).padStart(2, "0")}`;
      const existing = map.get(key) ?? {
        month: nxt.month,
        year: nxt.year,
        label: `${MONTH_SHORT[(nxt.month - 1) % 12]} '${String(nxt.year).slice(2)}`,
        freedMonthly: 0,
        contracts: [],
      };
      existing.freedMonthly += Math.round(p.monthlyInstallment);
      existing.contracts.push(p.label);
      map.set(key, existing);
    }
    const ordered = Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, val]) => val);

    let cumulative = 0;
    return ordered.map((item) => {
      cumulative += item.freedMonthly;
      return { ...item, cumulative };
    });
  }, [normalizedPlans]);

  return (
    <div className="space-y-6">
      {freedUpMilestones.length > 0 && (
        <div className="rounded-lg border border-delta-positive/30 bg-[rgba(16,183,141,0.06)] p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-delta-positive font-semibold">
                CASHFLOW FREED UP HORIZON
              </div>
              <p className="text-xs font-sans text-text-secondary mt-0.5">
                Monthly debt drop-offs automatically expand your available cashflow starting the cycle after each payoff.
              </p>
            </div>
            <div className="text-xs font-mono tabular-nums text-delta-positive font-semibold">
              Next Relief: {freedUpMilestones[0].label} (+{formatRp(freedUpMilestones[0].freedMonthly)}/mo)
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {freedUpMilestones.slice(0, 4).map((m) => (
              <div
                key={m.label}
                className="rounded border border-border-subtle bg-surface px-3 py-2 space-y-1"
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="font-semibold text-text-primary">{m.label}</span>
                  <span className="text-delta-positive font-semibold tabular-nums">
                    +{formatRp(m.freedMonthly)}/mo
                  </span>
                </div>
                <div className="text-[10px] font-sans text-text-tertiary truncate" title={m.contracts.join(", ")}>
                  {m.contracts.join(" · ")}
                </div>
                <div className="text-[10px] font-mono text-text-secondary tabular-nums">
                  Cumulative: +{formatRp(m.cumulative)}/mo
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 rounded-lg border border-border bg-surface p-4 sm:p-5 flex flex-col justify-between">
          <div className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            DEBT FREEDOM HORIZON
          </div>
          <div className="my-2">
            <div className="font-display text-[32px] font-normal leading-none tracking-tight text-text-primary">
              {finalFreedomDate}
            </div>
            <div className="text-xs font-sans text-text-tertiary mt-2">
              Projected cycle when all active installment plans reach 100% payoff
            </div>
          </div>
          <div className="text-[11px] font-mono text-text-secondary pt-2 border-t border-border-subtle">
            {normalizedPlans.length} active plans scheduled
          </div>
        </div>

        <div className="lg:col-span-4 rounded-lg border border-border bg-surface p-4 sm:p-5 flex flex-col justify-between">
          <div className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            MONTHLY INSTALLMENT COMMITMENT
          </div>
          <div className="my-2">
            <div className="font-mono text-[24px] font-semibold leading-none tracking-tight text-text-primary tabular-nums">
              {formatRp(totalMonthlyInstallment)}
            </div>
            <div className="text-xs font-sans text-text-tertiary mt-2">
              Sum of active PayLater, Credit Card, and Personal installment slices
            </div>
          </div>
          <div className="text-[11px] font-mono text-text-secondary pt-2 border-t border-border-subtle">
            Synced with 12-Month Debt Matrix (not double-counted)
          </div>
        </div>

        <div className="lg:col-span-3 rounded-lg border border-border bg-surface p-4 sm:p-5 flex flex-col justify-between">
          <div className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            OUTSTANDING PRINCIPAL
          </div>
          <div className="my-2">
            <div className="font-mono text-[24px] font-semibold leading-none tracking-tight text-text-primary tabular-nums">
              {formatRp(totalRemainingDebt)}
            </div>
            <div className="text-xs font-sans text-text-tertiary mt-2">
              Unpaid balance across active multi-month plans
            </div>
          </div>
          <div className="text-[11px] font-mono text-text-secondary pt-2 border-t border-border-subtle">
            Excludes one-time non-installment bills
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary">
            Active Installment Plans
          </h3>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Track installment progress and final payoff month across PayLater, Credit Card, and SPinjam plans.
          </p>
        </div>

        {normalizedPlans.length === 0 ? (
          <div className="py-8 text-center text-xs font-sans text-text-tertiary">
            No active multi-month repayment lanes in {MONTH_SHORT[(currentMonth - 1) % 12]} &apos;{String(currentYear).slice(2)}.
          </div>
        ) : (
          <div className="space-y-4 divide-y divide-border-subtle">
            {normalizedPlans.map((p) => (
              <div key={p.id} className="pt-4 first:pt-0 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <span className="font-medium text-xs font-sans text-text-primary">
                      {p.label}
                    </span>
                    <span className="text-[11px] font-mono text-text-tertiary ml-2">
                      {p.merchant}{p.sliceBadge ? ` · ${p.sliceBadge}` : ""} · ({formatRp(p.monthlyInstallment)} / mo)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-text-secondary">
                      Maturity: <strong className="text-text-primary font-semibold">{p.payoffDateLabel}</strong>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle text-text-tertiary">
                      {p.remainingTenor} mo remaining
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="h-2 w-full bg-surface-subtle rounded-full overflow-hidden border border-border-subtle">
                    <div
                      className="h-full bg-delta-positive transition-all duration-300 rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, p.tenorProgressPercent))}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-text-tertiary">
                    <span>Total Tenor: {p.totalTenor} mo</span>
                    <span>{p.tenorProgressPercent}% completed</span>
                    <span>Matures {p.payoffDateLabel}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {singlePeriodItems.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold font-sans text-text-primary">
                Single-Period Charges &amp; Vault Adjustments ({MONTH_SHORT[(currentMonth - 1) % 12]} &apos;{String(currentYear).slice(2)})
              </h3>
              <p className="text-xs font-sans text-text-secondary mt-0.5">
                One-time bills, recurring subscriptions, and period-scoped P1 vault refunds due strictly inside this cycle.
              </p>
            </div>
            <span className="text-xs font-mono text-text-secondary tabular-nums whitespace-nowrap">
              {formatRp(singlePeriodItems.reduce((s, i) => s + i.amount, 0))}
            </span>
          </div>
          <div className="divide-y divide-border-subtle">
            {singlePeriodItems.map((item) => (
              <div key={item.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium font-sans text-text-primary">
                    {item.title}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle text-text-tertiary whitespace-nowrap">
                    {item.badge}
                  </span>
                </div>
                <span className="text-xs font-mono font-semibold tabular-nums text-text-primary whitespace-nowrap">
                  {formatRp(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
