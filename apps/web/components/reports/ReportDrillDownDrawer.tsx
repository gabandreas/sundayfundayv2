"use client";

import React from "react";
import Link from "next/link";
import { X, ArrowUpRight } from "lucide-react";
import { ComparativePeriodRow, ExecutiveReportPayload } from "@/lib/api";
import { formatIDR } from "@/lib/utils";

export type DrillDownCategoryFilter =
  | "ALL"
  | "INCOME"
  | "DEBT"
  | "LIVING"
  | "SAVINGS"
  | "SELF_REWARD";

interface ReportDrillDownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  periodRow: ComparativePeriodRow | null;
  categoryFilter: DrillDownCategoryFilter;
  report: ExecutiveReportPayload;
}

export function ReportDrillDownDrawer({
  isOpen,
  onClose,
  periodRow,
  categoryFilter,
  report,
}: ReportDrillDownDrawerProps) {
  const [activeFilter, setActiveFilter] =
    React.useState<DrillDownCategoryFilter>(categoryFilter);

  React.useEffect(() => {
    setActiveFilter(categoryFilter);
  }, [categoryFilter, periodRow?.month, periodRow?.year, isOpen]);

  if (!isOpen || !periodRow) return null;

  const lineItems = (report.liabilityLineItems ?? []).filter(
    (li) => li.month === periodRow.month && li.year === periodRow.year
  );
  const ccItems = (report.creditCardScheduleItems ?? []).filter(
    (cc) => cc.periodMonth === periodRow.month && cc.periodYear === periodRow.year
  );
  const driver = report.horizonMetrics?.periodDrivers.find(
    (d) => d.month === periodRow.month && d.year === periodRow.year
  );

  const isSelectedPeriod =
    periodRow.month === report.selectedMonth && periodRow.year === report.selectedYear;
  const selectedIncome = isSelectedPeriod ? report.closingStatement.payroll.incomeTransactions : [];
  const selectedExpenses = isSelectedPeriod
    ? report.closingStatement.moneyCycle.dailyLiving.itemizedDailyExpenses
    : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <aside
        className="w-full sm:w-[540px] max-w-full h-full bg-canvas border-l border-border flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border bg-surface flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
              Executive Period Drill-Down · {activeFilter}
            </div>
            <h3 className="text-base font-semibold font-sans text-text-primary mt-0.5">
              {periodRow.periodLabel} ({periodRow.status === "LOCKED" ? "Closed" : "Draft"})
            </h3>
            {driver && (
              <p className="text-xs font-mono text-text-secondary mt-0.5">
                {driver.narrativeDriver} · DSR {driver.dsrPercent}% · Net Savings{" "}
                {driver.netSavingsRatePct}%
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer"
            aria-label="Close drill-down drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-2 border-b border-border-subtle bg-surface-subtle/50 flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "ALL", label: "All Details" },
              { id: "DEBT", label: "Liabilities & Cards" },
              { id: "INCOME", label: "Income" },
              { id: "LIVING", label: "Routine & Living" },
            ] as Array<{ id: DrillDownCategoryFilter; label: string }>
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFilter(f.id)}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                activeFilter === f.id
                  ? "bg-surface text-text-primary border border-border font-semibold"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Waterfall Summary KPIs */}
          <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
            <div className="p-3 rounded border border-border bg-surface">
              <div className="text-[10px] uppercase text-text-tertiary">Money In</div>
              <div className="text-sm font-semibold text-text-primary mt-0.5">
                {formatIDR(periodRow.finalTotalIncome)}
              </div>
            </div>
            <div className="p-3 rounded border border-border bg-surface">
              <div className="text-[10px] uppercase text-text-tertiary">Debt Bills</div>
              <div className="text-sm font-semibold text-text-primary mt-0.5">
                {formatIDR(periodRow.creditBillsAmount)} ({periodRow.creditDebtRatioPercent}%)
              </div>
            </div>
            <div className="p-3 rounded border border-border bg-surface">
              <div className="text-[10px] uppercase text-text-tertiary">Routine + Daily Ops</div>
              <div className="text-sm font-semibold text-text-primary mt-0.5">
                {formatIDR(periodRow.routineAndDailyLivingAmount)}
              </div>
            </div>
            <div className="p-3 rounded border border-border bg-surface">
              <div className="text-[10px] uppercase text-text-tertiary">Core Savings / Flexible Surplus</div>
              <div className="text-sm font-semibold text-positive mt-0.5">
                {formatIDR(periodRow.actualSavings)} / {formatIDR(periodRow.selfReward)}
              </div>
            </div>
          </div>

          {/* Itemized Obligations */}
          {(activeFilter === "ALL" || activeFilter === "DEBT") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
                  Liabilities &amp; Card Schedule ({lineItems.length + ccItems.length} items)
                </span>
                <Link
                  href={`/credit?month=${periodRow.month}&year=${periodRow.year}`}
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-text-secondary hover:text-text-primary"
                >
                  Open Matrix <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              {lineItems.length === 0 && ccItems.length === 0 ? (
                <div className="p-3 rounded border border-dashed border-border text-text-tertiary">
                  Total scheduled debt {formatIDR(periodRow.creditBillsAmount)} recorded as bulk total.
                </div>
              ) : (
                <div className="divide-y divide-border-subtle border border-border rounded-lg bg-surface">
                  {lineItems.map((li) => (
                    <div key={li.id} className="px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-sans font-medium text-text-primary truncate">
                          {li.title}
                        </div>
                        <div className="text-[10px] font-mono text-text-tertiary">
                          {li.category} · {li.merchantOrPlatform} · Due {li.dueDateIso}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono tabular-nums">
                        <div className="text-text-primary font-semibold">
                          {formatIDR(li.monthlyAmount)}
                        </div>
                        <div
                          className={`text-[10px] ${
                            li.settlementState === "PAID"
                              ? "text-positive"
                              : li.settlementState === "RESERVED"
                                ? "text-caution"
                                : "text-text-tertiary"
                          }`}
                        >
                          {li.settlementState}
                        </div>
                      </div>
                    </div>
                  ))}
                  {ccItems.map((cc) => (
                    <div key={`cc-${cc.id}`} className="px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-sans font-medium text-text-primary truncate">
                          {cc.label}
                        </div>
                        <div className="text-[10px] font-mono text-text-tertiary">
                          CREDIT CARD · {cc.chargeType}
                          {cc.sliceBadge ? ` · ${cc.sliceBadge}` : ""} · Due {cc.dueDateIso}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono tabular-nums">
                        <div className="text-text-primary font-semibold">
                          {formatIDR(cc.amount)}
                        </div>
                        <div className="text-[10px] text-text-tertiary">{cc.settlementState}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selected Period Income & Daily Spend Details */}
          {(activeFilter === "ALL" ||
            activeFilter === "INCOME" ||
            activeFilter === "LIVING") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
                  {isSelectedPeriod
                    ? "Selected Period Inflows & Daily Ledger"
                    : `Period Ledger (${periodRow.periodLabel})`}
                </span>
                <Link
                  href={`/ledger?month=${periodRow.month}&year=${periodRow.year}`}
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-text-secondary hover:text-text-primary"
                >
                  Open Ledger <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              {isSelectedPeriod ? (
                <div className="divide-y divide-border-subtle border border-border rounded-lg bg-surface">
                  {selectedIncome.map((inc) => (
                    <div key={`inc-${inc.id}`} className="px-3 py-2 flex items-center justify-between">
                      <div>
                        <div className="font-sans text-text-primary">{inc.label}</div>
                        <div className="text-[10px] font-mono text-text-tertiary">
                          {inc.date.slice(0, 10)} · Extra Inflow
                        </div>
                      </div>
                      <div className="font-mono font-semibold text-positive tabular-nums">
                        +{formatIDR(inc.amount)}
                      </div>
                    </div>
                  ))}
                  {selectedExpenses.map((exp) => (
                    <div key={`exp-${exp.id}`} className="px-3 py-2 flex items-center justify-between">
                      <div>
                        <div className="font-sans text-text-primary">{exp.label}</div>
                        <div className="text-[10px] font-mono text-text-tertiary">
                          {exp.date.slice(0, 10)} · {exp.fixedEssentialCategoryLabel || exp.kindLabel}
                        </div>
                      </div>
                      <div className="font-mono font-semibold text-text-primary tabular-nums">
                        {formatIDR(exp.signedAmount)}
                      </div>
                    </div>
                  ))}
                  {selectedIncome.length === 0 && selectedExpenses.length === 0 && (
                    <div className="p-3 text-text-tertiary">
                      Baseline salary and fixed allowances only (no extra entries logged).
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded border border-border-subtle bg-surface text-text-secondary">
                  Select {periodRow.periodLabel} in the top period header or click Open Ledger to inspect all transactions for that period.
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
