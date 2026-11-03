"use client";

import React from "react";
import { formatRupiah } from "@/lib/utils";
import { usePerspective } from "@/context/PerspectiveContext";

interface FixedEssentialsTableProps {
  transport: number;
  internet: number;
  vape: number;
  haircut: number;
  dailyOperational: number;
  actualDailyOperational?: number | null;
  deficitUncovered?: number;
}

export function FixedEssentialsTable({
  transport,
  internet,
  vape,
  haircut,
  dailyOperational,
  actualDailyOperational,
  deficitUncovered = 0,
}: FixedEssentialsTableProps) {
  const { profileMode, getRoutineLabel } = usePerspective();
  const isStandard = profileMode === "STANDARD_GENERAL";

  const fixedTotal = transport + internet + vape + haircut;
  const isDeficit = deficitUncovered > 0;
  const operationalBudget = dailyOperational;
  const combinedSurvivalBase = fixedTotal + operationalBudget;

  const items = [
    {
      label: isStandard ? getRoutineLabel("transport") : "Transport",
      amount: transport,
      note: isStandard ? "Transit, commute & fuel envelope" : "Fuel & transit baseline",
    },
    {
      label: isStandard ? getRoutineLabel("internet") : "Internet & Telecom",
      amount: internet,
      note: isStandard ? "Broadband, cellular & essential utilities" : "Fiber broadband & cellular",
    },
    {
      label: isStandard ? getRoutineLabel("vape") : "Vape / Consumables",
      amount: vape,
      note: isStandard ? "Recurring lifestyle & digital subscriptions" : "Discretionary routine items",
    },
    {
      label: isStandard ? getRoutineLabel("haircut") : "Personal Care & Grooming",
      amount: haircut,
      note: isStandard ? "Personal grooming, health & wellness" : "Routine haircut",
    },
  ];

  return (
    <div className="bg-surface border border-border-subtle rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary tracking-tight">
            Fixed Essentials & Operational Baseline
          </h3>
          <p className="text-xs font-sans text-text-tertiary mt-0.5">
            Non-negotiable monthly cost targets comprising the Survival Pocket.
          </p>
        </div>
        <span className="text-[10px] font-mono uppercase text-text-tertiary px-2 py-0.5 rounded bg-surface-subtle border border-border-subtle">
          Upfront Non-Negotiable
        </span>
      </div>

      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between py-2 px-2 border-b border-border-subtle/70 text-xs font-sans"
          >
            <div>
              <span className="font-medium text-text-secondary block">
                {item.label}
              </span>
              <span className="text-[10px] text-text-tertiary block">
                {item.note}
              </span>
            </div>
            <span className="font-mono text-text-primary tabular-nums font-medium">
              {formatRupiah(item.amount)}
            </span>
          </div>
        ))}

        {/* Subtotal: Fixed Essentials */}
        <div className="flex items-center justify-between py-2 px-2.5 rounded bg-surface-subtle border border-border-subtle my-1">
          <span className="text-xs font-sans font-semibold text-text-primary">
            Total Fixed Essentials
          </span>
          <span className="text-xs font-mono font-bold text-text-primary">
            {formatRupiah(fixedTotal)}
          </span>
        </div>

        {/* Daily Operational Allocation */}
        <div className="flex items-center justify-between py-2 px-2 border-b border-border-subtle/70 text-xs font-sans">
          <div>
            <span className="font-medium text-text-secondary block">
              Daily Operational Living Budget
            </span>
            <span className="text-[10px] text-text-tertiary block">
              {isDeficit
                ? "Target need — Rp 0 funded in deficit"
                : "Pacing consumption pool for everyday meals & transit"}
            </span>
          </div>
          <span className="font-mono text-text-primary tabular-nums font-medium">
            {formatRupiah(operationalBudget)}
          </span>
        </div>

        {/* Total Survival Pocket */}
        <div className="pt-2">
          <div className="flex items-center justify-between py-2.5 px-3 rounded bg-[rgba(16,183,141,0.06)] border border-[rgba(16,183,141,0.2)]">
            <div>
              <span className="text-xs font-sans font-semibold text-text-primary block">
                {isDeficit ? "Combined Survival Baseline Need" : "Combined Survival Pocket Base"}
              </span>
              <span className="text-[10px] font-sans text-text-tertiary">
                {isDeficit
                  ? "Fixed essentials + daily operational baseline need"
                  : "Fixed essentials + daily operational budget"}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-delta-positive">
              {formatRupiah(combinedSurvivalBase)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
