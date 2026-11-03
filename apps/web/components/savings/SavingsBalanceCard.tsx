"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, TrendingUp, ShieldCheck } from "lucide-react";
import {
  SavingsVault,
  SavingsInstrumentType,
  rebalanceSavingsInstrument,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePerspective } from "@/context/PerspectiveContext";

interface SavingsBalanceCardProps {
  vault: SavingsVault;
}

export function SavingsBalanceCard({ vault }: SavingsBalanceCardProps) {
  const router = useRouter();
  const { profileMode, getVaultLabels } = usePerspective();
  const isStandard = profileMode === "STANDARD_GENERAL";
  const vaultLabels = getVaultLabels();

  const [showRebalance, setShowRebalance] = useState(false);
  const [direction, setDirection] = useState<"CASH_TO_RDPU" | "RDPU_TO_CASH">(
    "CASH_TO_RDPU"
  );
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liquidBalance = vault.liquidCashBalance ?? vault.balance;
  const rdpuBalance = vault.investmentRdpuBalance ?? 0;
  const liquidShare = vault.liquidSharePercent ?? (vault.balance > 0 ? 100 : 0);
  const rdpuShare = vault.rdpuSharePercent ?? 0;

  const totalPlanned2026P1 = vault.overview?.kpi.totalPlanned2026P1 ?? 2557107;
  const avgMonthlySavingsP1 = vault.overview?.kpi.avgMonthlySavingsP1 ?? 426185;
  const avgSavingsRatePercent = vault.overview?.kpi.averageMonthlySavingsRatePercent ?? 7.3;

  const handleRebalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseInt(amount.replace(/\D/g, ""), 10);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError("Rebalance amount must be greater than Rp 0");
      return;
    }

    const fromInstrument: SavingsInstrumentType =
      direction === "CASH_TO_RDPU" ? "LIQUID_CASH" : "INVESTMENT_RDPU";
    const toInstrument: SavingsInstrumentType =
      direction === "CASH_TO_RDPU" ? "INVESTMENT_RDPU" : "LIQUID_CASH";

    setError(null);
    setSubmitting(true);
    const res = await rebalanceSavingsInstrument({
      fromInstrument,
      toInstrument,
      amount: numericAmount,
      note: note.trim() || undefined,
    });
    setSubmitting(false);

    if (!res.success) {
      setError(res.error || "Failed to rebalance instruments");
      return;
    }

    setAmount("");
    setNote("");
    setShowRebalance(false);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* 3 TOP KPI CARDS */}
      <div className="grid grid-cols-12 gap-4">
        {/* Card 1: Total Accumulated in Vault */}
        <div className="col-span-5 rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
                TOTAL ACCUMULATED IN VAULT
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowRebalance((prev) => !prev);
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-surface-subtle hover:bg-surface-hover border border-border text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <ArrowLeftRight className="w-3 h-3" />
                <span>Rebalance</span>
              </button>
            </div>

            <div className="my-2.5">
              <div className="font-serif text-[34px] font-normal leading-none tracking-tight text-text-primary">
                {formatRupiah(vault.balance)}
              </div>
              <p className="text-xs font-sans text-text-secondary mt-1.5">
                {isStandard
                  ? "Confirmed capital across Liquid Emergency Fund and Investment Portfolio."
                  : "Confirmed vault capital across Liquid Cash and Money Market (RDPU)."}
              </p>
            </div>
          </div>

          <div className="pt-2.5 border-t border-border-subtle grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded bg-surface-subtle/60 border border-border-subtle">
              <div className="flex items-center justify-between text-[10px] uppercase text-text-tertiary">
                <span title={vaultLabels.liquid}>{isStandard ? "Liquid (Cash/HYSA)" : "Cash"} ({liquidShare}%)</span>
              </div>
              <div className="text-xs font-semibold text-text-primary mt-0.5 tabular-nums">
                {formatRupiah(liquidBalance)}
              </div>
            </div>

            <div className="p-2 rounded bg-surface-subtle/60 border border-border-subtle">
              <div className="flex items-center justify-between text-[10px] uppercase text-text-tertiary">
                <span title={vaultLabels.investment}>{isStandard ? "Portfolio (Invest)" : "RDPU"} ({rdpuShare}%)</span>
              </div>
              <div className="text-xs font-semibold text-delta-positive mt-0.5 tabular-nums">
                {formatRupiah(rdpuBalance)}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Total Planned Across Active Year (2026 P1 Sum) */}
        <div className="col-span-4 rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
                PLANNED 2026 SAVINGS (P1)
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[rgba(16,183,141,0.08)] text-delta-positive border border-[rgba(16,183,141,0.2)]">
                Jul–Dec 2026
              </span>
            </div>

            <div className="my-2.5">
              <div className="font-mono text-[28px] font-semibold leading-none tracking-tight text-text-primary tabular-nums">
                {formatRupiah(totalPlanned2026P1)}
              </div>
              <p className="text-xs font-sans text-text-secondary mt-1.5">
                Total Priority 1 salary allocations funded across all 6 active 2026 periods.
              </p>
            </div>
          </div>

          <div className="pt-2.5 border-t border-border-subtle flex items-center justify-between text-xs font-mono">
            <span className="text-text-tertiary">P1 Monthly Pace:</span>
            <span className="font-semibold text-text-primary tabular-nums">
              {formatRupiah(avgMonthlySavingsP1)}/mo
            </span>
          </div>
        </div>

        {/* Card 3: Average Savings Rate & Emergency Runway */}
        <div className="col-span-3 rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
                SAVINGS RATE & RUNWAY
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-delta-positive" />
            </div>

            <div className="my-2.5">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[28px] font-semibold leading-none tracking-tight text-text-primary tabular-nums">
                  {avgSavingsRatePercent}%
                </span>
                <span className="text-xs font-mono text-text-secondary">
                  of net income
                </span>
              </div>
              <p className="text-xs font-sans text-text-secondary mt-1.5">
                Average proportion of net payroll directed into Priority 1 capital reserves.
              </p>
            </div>
          </div>

          <div className="pt-2.5 border-t border-border-subtle flex items-center justify-between text-xs font-mono">
            <span className="text-text-tertiary">Survival Runway:</span>
            <span className="font-semibold text-text-primary tabular-nums">
              {vault.runwayMonths} months
            </span>
          </div>
        </div>
      </div>

      {/* Inline Instrument Rebalance Form */}
      {showRebalance && (
        <form
          onSubmit={handleRebalance}
          className="rounded-lg border border-border bg-surface p-4 space-y-3"
        >
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                Sub-Allocation Instrument Rebalance
              </h4>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Atomically shift capital between Liquid Emergency Cash and Investment — RDPU without altering total Vault balance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRebalance(false)}
              className="text-text-tertiary hover:text-text-primary text-xs"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-4">
              <label className="text-[10px] font-mono uppercase text-text-tertiary block mb-1">
                Direction
              </label>
              <select
                value={direction}
                onChange={(e) =>
                  setDirection(e.target.value as "CASH_TO_RDPU" | "RDPU_TO_CASH")
                }
                className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border text-xs text-text-primary font-sans focus:outline-none focus:border-border-strong"
              >
                <option value="CASH_TO_RDPU">Liquid Cash → Investment RDPU</option>
                <option value="RDPU_TO_CASH">Investment RDPU → Liquid Cash</option>
              </select>
            </div>

            <div className="col-span-3">
              <label className="text-[10px] font-mono uppercase text-text-tertiary block mb-1">
                Amount (Rp)
              </label>
              <input
                type="text"
                placeholder="e.g. 500.000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border text-xs font-mono tabular-nums text-text-primary focus:outline-none focus:border-border-strong"
              />
            </div>

            <div className="col-span-3">
              <label className="text-[10px] font-mono uppercase text-text-tertiary block mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Monthly yield rebalance"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border text-xs text-text-primary font-sans focus:outline-none focus:border-border-strong"
              />
            </div>

            <div className="col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-1.5 rounded text-xs font-sans font-medium bg-surface-active hover:bg-surface-hover border border-border hover:border-border-strong text-text-primary transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? "Rebalancing..." : "Rebalance"}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs font-sans text-delta-negative bg-[rgba(235,87,87,0.1)] p-2 rounded border border-[rgba(235,87,87,0.2)]">
              {error}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
