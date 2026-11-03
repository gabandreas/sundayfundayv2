import React from "react";
import { fetchSnapshot } from "@/lib/api";
import { MetricCard } from "@/components/primitives/MetricCard";
import { AllocationsDonutChart, AllocationSlice } from "@/components/allocations/AllocationsDonutChart";
import { FixedEssentialsTable } from "@/components/allocations/FixedEssentialsTable";
import { FormulaEngineSelectorCard } from "@/components/allocations/FormulaEngineSelectorCard";
import { DeficitAlert } from "@/components/overview/DeficitAlert";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";
import { formatRupiah, getDefaultPayrollPeriod } from "@/lib/utils";

interface AllocationsPageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function AllocationsPage({ searchParams }: AllocationsPageProps) {
  const params = await searchParams;
  const defaultPeriod = getDefaultPayrollPeriod();
  const month = params.month ? parseInt(params.month, 10) : defaultPeriod.month;
  const year = params.year ? parseInt(params.year, 10) : defaultPeriod.year;

  // Temporal boundary guard: tracking begins in July 2026
  if (year < 2026 || (year === 2026 && month < 7)) {
    return <PreBoundaryNotice month={month} year={year} />;
  }

  const snapshot = await fetchSnapshot(month, year);

  const isLocked = snapshot?.status === "LOCKED";
  const finalTotalIncome = snapshot?.finalTotalIncome ?? 0;
  const totalDeductions = snapshot?.totalDeductions ?? 0;
  const survivalPocket = snapshot?.survivalPocket ?? 0;
  const actualSavings = snapshot?.actualSavings ?? 0;
  const selfReward = snapshot?.selfReward ?? 0;
  const bufferPocket = snapshot?.bufferPocket ?? 0;
  const deficitUncovered = snapshot?.deficitUncovered ?? 0;

  // Build slices using shifted delta theme palette
  const slices: AllocationSlice[] = [
    {
      id: "deductions",
      label: "Liabilities & Deductions",
      amount: totalDeductions,
      color: "#e06c53", // delta-negative terracotta
      priority: "Upfront — Debt & Card Bills",
    },
    {
      id: "survival",
      label: deficitUncovered > 0 ? "Survival Baseline Need" : "Survival Pocket",
      amount: survivalPocket,
      color: "#10b78d", // delta-positive emerald-teal
      priority:
        deficitUncovered > 0
          ? "Upfront — Baseline Living Need"
          : "Upfront — Essentials + Living Base",
    },
    {
      id: "savings",
      label: "Locked Core Savings",
      amount: actualSavings,
      color: "#4f5b75", // slate-blue
      priority: "Priority 1 — Locked Core Savings",
    },
    {
      id: "self-reward",
      label: "Self-Reward Surplus",
      amount: selfReward,
      color: "#e59b2c", // caution amber
      priority: "Priority 2 — Discretionary Surplus",
    },
  ];

  if (bufferPocket > 0) {
    slices.push({
      id: "buffer",
      label: "Emergency Buffer Pocket",
      amount: bufferPocket,
      color: "#384054", // dark muted slate
      priority: "Reserve Buffer Allocation",
    });
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Deficit Alert if any deficit exists */}
      <DeficitAlert deficitUncovered={deficitUncovered} />

      {/* Header & Status Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div>
          <h1 className="text-xl font-bold font-sans tracking-tight text-text-primary">
            Waterfall Allocations
          </h1>
          <p className="text-xs font-sans text-text-secondary mt-1">
            Algorithmic 2-priority cashflow allocation, pocket distribution, and fixed essentials baseline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-sans text-text-tertiary">
            Period: <span className="font-mono text-text-secondary">{month}/{year}</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
              isLocked
                ? "bg-surface-subtle text-text-tertiary border-border-subtle"
                : "bg-[rgba(16,183,141,0.10)] text-delta-positive border-[rgba(16,183,141,0.25)]"
            }`}
          >
            {snapshot?.status ?? "DRAFT"}
          </span>
        </div>
      </div>

      {/* Multi-Formula Allocation Engine Selector */}
      <FormulaEngineSelectorCard />

      {/* SECTION 1: Donut Visualization & Pocket Proportions */}
      <section className="space-y-3">
        <div className="text-[11px] font-sans font-medium text-text-tertiary uppercase tracking-wider">
          Allocation Architecture & Distribution
        </div>

        <AllocationsDonutChart
          totalIncome={finalTotalIncome}
          slices={slices}
          bufferPocket={bufferPocket}
        />
      </section>

      {/* SECTION 2: Exact Metric Cards for Precision */}
      <section className="space-y-3">
        <div className="text-[11px] font-sans font-medium text-text-tertiary uppercase tracking-wider">
          Exact Pocket Distributions
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Liabilities / Deductions */}
          <div className="col-span-3">
            <MetricCard
              label="Liabilities / Deductions"
              value={formatRupiah(totalDeductions)}
              footer="Upfront: KPR, installments & bills"
              statusVariant="default"
            />
          </div>

          {/* Survival Pocket */}
          <div className="col-span-3">
            <MetricCard
              label={deficitUncovered > 0 ? "Survival Baseline Need" : "Survival Pocket"}
              value={formatRupiah(survivalPocket)}
              footer={
                deficitUncovered > 0
                  ? `Baseline need (${formatRupiah(deficitUncovered)} shortfall)`
                  : "Upfront: Essentials & daily operational"
              }
              statusVariant={deficitUncovered > 0 ? "urgency" : "default"}
              statusLabel={deficitUncovered > 0 ? "DEFICIT RISK" : undefined}
            />
          </div>

          {/* Locked Savings (Priority 1) */}
          <div className="col-span-3">
            <MetricCard
              label="Locked Core Savings"
              value={formatRupiah(actualSavings)}
              footer={`Priority 1: Target ${formatRupiah(snapshot?.savings ?? 0)}`}
              statusVariant="default"
            />
          </div>

          {/* Self-Reward Surplus (Priority 2) */}
          <div className="col-span-3">
            <MetricCard
              label="Self-Reward Surplus"
              value={formatRupiah(selfReward)}
              footer="Priority 2: Unallocated surplus"
              statusVariant="default"
            />
          </div>
        </div>
      </section>

      {/* SECTION 3: Detailed Breakdown Tables */}
      <section className="grid grid-cols-12 gap-6 items-start">
        {/* Left: Fixed Essentials Breakdown Table */}
        <div className="col-span-7">
          <FixedEssentialsTable
            transport={snapshot?.transport ?? 0}
            internet={snapshot?.internet ?? 0}
            vape={snapshot?.vape ?? 0}
            haircut={snapshot?.haircut ?? 0}
            dailyOperational={snapshot?.dailyOperational ?? 0}
            actualDailyOperational={snapshot?.actualDailyOperational}
            deficitUncovered={deficitUncovered}
          />
        </div>

        {/* Right: Waterfall Priority Sequence Explanation */}
        <div className="col-span-5 bg-surface border border-border-subtle rounded-lg p-5 space-y-4">
          <div className="pb-3 border-b border-border-subtle">
            <h3 className="text-sm font-semibold font-sans text-text-primary tracking-tight">
              Waterfall Execution Order
            </h3>
            <p className="text-xs font-sans text-text-tertiary mt-0.5">
              Strict sequential capital distribution rules governed by ERP core.
            </p>
          </div>

          <div className="space-y-3 text-xs font-sans">
            <div className="flex gap-3 items-start">
              <span className="font-mono text-[10px] font-bold text-delta-negative bg-[rgba(224,108,83,0.1)] px-1.5 py-0.5 rounded shrink-0">
                UPFRONT
              </span>
              <div>
                <span className="font-medium text-text-primary block">
                  Liabilities & Essential Living Baseline
                </span>
                <span className="text-[11px] text-text-tertiary leading-relaxed">
                  First claim on take-home pay: debt contracts, card bills, fixed routine bills & envelopes, and the daily operational living budget.
                </span>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <span className="font-mono text-[10px] font-bold text-text-primary bg-surface-subtle px-1.5 py-0.5 rounded shrink-0 border border-border-subtle">
                P1
              </span>
              <div>
                <span className="font-medium text-text-primary block">
                  Locked Core Savings Target
                </span>
                <span className="text-[11px] text-text-tertiary leading-relaxed">
                  Monthly wealth preservation target funded immediately from available surplus once all upfront commitments are satisfied.
                </span>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <span className="font-mono text-[10px] font-bold text-caution bg-[rgba(229,155,44,0.1)] px-1.5 py-0.5 rounded shrink-0">
                P2
              </span>
              <div>
                <span className="font-medium text-text-primary block">
                  Self-Reward Discretionary Surplus
                </span>
                <span className="text-[11px] text-text-tertiary leading-relaxed">
                  All residual cashflow overflows into the Self-Reward pocket for guilt-free discretionary luxury and wishlist funding.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
