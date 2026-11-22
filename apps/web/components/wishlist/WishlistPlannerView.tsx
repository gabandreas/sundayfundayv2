"use client";

import React, { useEffect, useState } from "react";
import {
  IntelligenceBundleResponse,
  MonthlySnapshot,
  WishlistAnalysisResult,
  WishlistItem,
  fetchIntelligenceBundle,
  getCached,
} from "@/lib/api";
import { formatRupiah, formatCurrencyInput, parseCurrencyInput } from "@/lib/utils";
import { WishlistPlannerForm } from "./WishlistPlannerForm";
import { WishlistAnalysisResults } from "./WishlistAnalysisResults";

interface WishlistPlannerViewProps {
  currentMonth: number;
  currentYear: number;
  forwardSnapshots?: MonthlySnapshot[];
  items?: WishlistItem[];
}

function formatSnapLabel(snap: MonthlySnapshot | undefined, fallbackMonth: number, fallbackYear: number): string {
  if (!snap) return `${String(fallbackMonth).padStart(2, "0")}/${fallbackYear}`;
  return `${String(snap.month).padStart(2, "0")}/${snap.year}`;
}

export function WishlistPlannerView({
  currentMonth,
  currentYear,
  forwardSnapshots = [],
  items = [],
}: WishlistPlannerViewProps) {
  const [analysis, setAnalysis] = useState<WishlistAnalysisResult | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [intel, setIntel] = useState<IntelligenceBundleResponse | null>(null);

  useEffect(() => {
    let active = true;
    const cached = getCached<IntelligenceBundleResponse | null>(`intelligence:${currentMonth}:${currentYear}:0`);
    if (cached) {
      setIntel(cached);
    } else {
      fetchIntelligenceBundle(currentMonth, currentYear).then((res) => {
        if (active && res) setIntel(res);
      });
    }
    return () => {
      active = false;
    };
  }, [currentMonth, currentYear]);

  const activeVaultItems = items.filter((item) => item.status !== "PURCHASED");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [quickPriceInput, setQuickPriceInput] = useState<string>("900.000");
  const [purchaseTiming, setPurchaseTiming] = useState<"BEFORE_CUTOFF" | "AFTER_CUTOFF">("BEFORE_CUTOFF");
  const [paylaterTenor, setPaylaterTenor] = useState<1 | 3 | 6>(3);
  const [ccTenor, setCcTenor] = useState<3 | 6 | 12>(6);

  const quickPrice = Math.max(0, parseCurrencyInput(quickPriceInput));
  const trueWage = intel?.lifeenergy?.trueNetHourlyWageRp ?? 0;
  const hrsPerDay =
    (intel?.studioConfig?.paycycleFormulaConfig?.workHoursPerDay ?? 8) +
    (intel?.studioConfig?.paycycleFormulaConfig?.dailyCommuteHours ?? 0);
  const fullWorkHours = trueWage > 0 ? Math.round((quickPrice / trueWage) * 10) / 10 : 0;
  const fullWorkDays = hrsPerDay > 0 ? Math.round((fullWorkHours / hrsPerDay) * 10) / 10 : 0;

  const handleSelectVaultItem = (idStr: string) => {
    setSelectedItemId(idStr);
    if (!idStr) return;
    const found = activeVaultItems.find((i) => String(i.id) === idStr);
    if (found) {
      setQuickPriceInput(formatCurrencyInput(String(found.price)));
    }
  };

  const activeSnap = forwardSnapshots[0];
  const nextSnap = forwardSnapshots[1] ?? forwardSnapshots[0];
  const thirdSnap = forwardSnapshots[2] ?? forwardSnapshots[forwardSnapshots.length - 1] ?? nextSnap;

  const targetInstallmentSnap =
    purchaseTiming === "BEFORE_CUTOFF" ? activeSnap : nextSnap;
  const targetSnapLabel = formatSnapLabel(targetInstallmentSnap, currentMonth, currentYear);

  const activeP2 = activeSnap?.selfReward ?? 0;
  const nextP2 = nextSnap?.selfReward ?? 0;
  const totalForwardP2 = forwardSnapshots.reduce((s, x) => s + (x.selfReward ?? 0), 0);
  const cashShortfallVsActive = Math.max(0, quickPrice - activeP2);
  const cashShortfallVs3Cycle = Math.max(0, quickPrice - totalForwardP2);

  // SPayLater (25th due, 15th cutoff)
  const paylaterMonthly = Math.round(quickPrice / paylaterTenor);
  const targetIncome = Number(targetInstallmentSnap?.finalTotalIncome ?? 0);
  const targetDeductions = Number(targetInstallmentSnap?.totalDeductions ?? 0);
  const targetP1 = Number(targetInstallmentSnap?.actualSavings ?? 0);
  const targetP2 = Number(targetInstallmentSnap?.selfReward ?? 0);

  const paylaterDebtRatio =
    targetIncome > 0
      ? Math.round(((targetDeductions + paylaterMonthly) / targetIncome) * 1000) / 10
      : null;
  const paylaterP1Erosion = Math.max(0, paylaterMonthly - targetP2);
  const paylaterResultingP1 = Math.max(0, targetP1 - paylaterP1Erosion);

  // Permata Credit Card (25th cutoff -> 11th due)
  const ccMonthly = Math.round(quickPrice / ccTenor);
  const ccDebtRatio =
    targetIncome > 0
      ? Math.round(((targetDeductions + ccMonthly) / targetIncome) * 1000) / 10
      : null;
  const ccP1Erosion = Math.max(0, ccMonthly - targetP2);
  const ccResultingP1 = Math.max(0, targetP1 - ccP1Erosion);

  const getRatioColorClass = (ratio: number | null) => {
    if (ratio === null) return "text-text-tertiary";
    if (ratio > 50) return "text-urgency";
    if (ratio > 35) return "text-caution";
    return "text-delta-positive";
  };

  return (
    <div className="space-y-6">
      {/* Side-by-Side Feasibility Comparator */}
      {forwardSnapshots.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border-subtle pb-4">
            <div>
              <h3 className="text-sm font-semibold font-sans text-text-primary">
                Purchase Feasibility Comparator
              </h3>
              <p className="text-xs font-sans text-text-tertiary mt-0.5">
                Compare upfront P2 cash against SPayLater (daysInMonth-15 cutoff) and Bank Permata CC (25th cutoff) across forward periods.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {activeVaultItems.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono text-text-tertiary">Saved Item:</span>
                  <select
                    value={selectedItemId}
                    onChange={(e) => handleSelectVaultItem(e.target.value)}
                    aria-label="Load Saved Wishlist item"
                    className="max-w-[180px] px-2.5 py-1.5 rounded bg-surface-subtle border border-border-default font-sans text-xs text-text-primary focus:outline-none focus:border-text-secondary cursor-pointer"
                  >
                    <option value="">Custom amount...</option>
                    {activeVaultItems.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.name} ({formatRupiah(item.price)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-text-tertiary">Price (IDR):</span>
                <input
                  type="text"
                  value={quickPriceInput}
                  onChange={(e) => {
                    setSelectedItemId("");
                    setQuickPriceInput(formatCurrencyInput(e.target.value));
                  }}
                  placeholder="900.000"
                  className="w-32 px-2.5 py-1.5 rounded bg-surface-subtle border border-border-default font-mono text-xs text-text-primary tabular-nums focus:outline-none focus:border-text-secondary"
                />
                {trueWage > 0 && (
                  <span className="inline-flex items-center whitespace-nowrap px-2 py-1 rounded bg-surface-subtle border border-border-subtle font-mono text-[11px] text-caution tabular-nums">
                    {fullWorkHours}h work ({fullWorkDays}d)
                  </span>
                )}
              </div>

              <div className="flex items-center rounded border border-border-default bg-surface-subtle p-0.5 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setPurchaseTiming("BEFORE_CUTOFF")}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                    purchaseTiming === "BEFORE_CUTOFF"
                      ? "bg-surface-active text-text-primary font-medium"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  &le;15th/16th · &le;25th
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseTiming("AFTER_CUTOFF")}
                  className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                    purchaseTiming === "AFTER_CUTOFF"
                      ? "bg-surface-active text-text-primary font-medium"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  &gt;15th/16th · &gt;25th
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Path A: Cash from P2 Surplus */}
            <div className="p-4 rounded-md border border-border-subtle bg-surface-subtle space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-sans">
                  <span className="font-semibold text-text-secondary">Path A: Cash (P2 Surplus)</span>
                  <span
                    className={`font-mono text-[10px] font-semibold ${
                      quickPrice <= activeP2
                        ? "text-delta-positive"
                        : quickPrice <= totalForwardP2
                        ? "text-caution"
                        : "text-urgency"
                    }`}
                  >
                    {quickPrice <= activeP2
                      ? "Funded in Active P2"
                      : quickPrice <= totalForwardP2
                      ? "Save Over 3 Cycles"
                      : "Exceeds 3-Cycle P2"}
                  </span>
                </div>
                <div className="font-mono text-lg font-semibold text-text-primary tabular-nums">
                  {formatRupiah(quickPrice)} upfront
                </div>
              </div>

              <div className="pt-2 border-t border-border-subtle space-y-1 text-[11px] font-mono text-text-tertiary tabular-nums">
                <div className="flex justify-between">
                  <span>Active P2 ({formatSnapLabel(activeSnap, currentMonth, currentYear)}):</span>
                  <span className="text-text-secondary">{formatRupiah(activeP2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>3-Cycle Cumulative P2:</span>
                  <span className="text-text-secondary">{formatRupiah(totalForwardP2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>P1 Core Savings Impact:</span>
                  <span className={cashShortfallVs3Cycle > 0 ? "text-caution" : "text-delta-positive"}>
                    {cashShortfallVsActive === 0
                      ? "Rp 0 (Protected)"
                      : cashShortfallVs3Cycle === 0
                      ? `Save ${formatRupiah(nextP2 > 0 ? cashShortfallVsActive : quickPrice)}`
                      : `-${formatRupiah(cashShortfallVs3Cycle)} gap`}
                  </span>
                </div>
              </div>
            </div>

            {/* Path B: SPayLater (1x / 3x / 6x) */}
            <div className="p-4 rounded-md border border-border-subtle bg-surface-subtle space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-sans gap-2">
                  <span className="font-semibold text-text-secondary">Path B: SPayLater</span>
                  <div className="flex items-center gap-1">
                    {([1, 3, 6] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPaylaterTenor(t)}
                        className={`px-1.5 py-0.5 rounded font-mono text-[10px] border transition-colors cursor-pointer ${
                          paylaterTenor === t
                            ? "border-accent/50 bg-accent/[0.08] text-text-primary"
                            : "border-border-subtle text-text-tertiary hover:text-text-secondary"
                        }`}
                      >
                        {t}x
                      </button>
                    ))}
                  </div>
                </div>
                <div className="font-mono text-lg font-semibold text-text-primary tabular-nums">
                  {formatRupiah(paylaterMonthly)} <span className="text-xs font-normal text-text-tertiary">/ mo</span>
                  {trueWage > 0 && (
                    <span className="ml-2 text-[11px] font-normal text-caution">
                      ({(paylaterMonthly / trueWage).toFixed(1)}h/mo)
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-border-subtle space-y-1 text-[11px] font-mono text-text-tertiary tabular-nums">
                <div className="flex justify-between">
                  <span>First Billing Period:</span>
                  <span className="text-text-secondary">{targetSnapLabel} (Due 25th)</span>
                </div>
                <div className="flex justify-between">
                  <span>Projected Debt Ratio:</span>
                  <span className={`font-semibold ${getRatioColorClass(paylaterDebtRatio)}`}>
                    {paylaterDebtRatio !== null ? `${paylaterDebtRatio.toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Target Period P1 After:</span>
                  <span className={paylaterP1Erosion > 0 ? "text-caution" : "text-delta-positive"}>
                    {formatRupiah(paylaterResultingP1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Path C: Credit Card (3x / 6x / 12x) */}
            <div className="p-4 rounded-md border border-border-subtle bg-surface-subtle space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-sans gap-2">
                  <span className="font-semibold text-text-secondary">Path C: Credit Card</span>
                  <div className="flex items-center gap-1">
                    {([3, 6, 12] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCcTenor(t)}
                        className={`px-1.5 py-0.5 rounded font-mono text-[10px] border transition-colors cursor-pointer ${
                          ccTenor === t
                            ? "border-accent/50 bg-accent/[0.08] text-text-primary"
                            : "border-border-subtle text-text-tertiary hover:text-text-secondary"
                        }`}
                      >
                        {t}x
                      </button>
                    ))}
                  </div>
                </div>
                <div className="font-mono text-lg font-semibold text-text-primary tabular-nums">
                  {formatRupiah(ccMonthly)} <span className="text-xs font-normal text-text-tertiary">/ mo</span>
                  {trueWage > 0 && (
                    <span className="ml-2 text-[11px] font-normal text-caution">
                      ({(ccMonthly / trueWage).toFixed(1)}h/mo)
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-border-subtle space-y-1 text-[11px] font-mono text-text-tertiary tabular-nums">
                <div className="flex justify-between">
                  <span>First Billing Period:</span>
                  <span className="text-text-secondary">{targetSnapLabel} (Due 11th)</span>
                </div>
                <div className="flex justify-between">
                  <span>Projected Debt Ratio:</span>
                  <span className={`font-semibold ${getRatioColorClass(ccDebtRatio)}`}>
                    {ccDebtRatio !== null ? `${ccDebtRatio.toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Target Period P1 After:</span>
                  <span className={ccP1Erosion > 0 ? "text-caution" : "text-delta-positive"}>
                    {formatRupiah(ccResultingP1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {thirdSnap && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] font-mono text-text-tertiary">
              <span>
                Cutoff Advisor:{" "}
                <span className="text-delta-positive">
                  {purchaseTiming === "BEFORE_CUTOFF"
                    ? `On/Before Cutoff (<=15th/16th SPayLater · <=25th Permata CC) -> Bills in ${formatSnapLabel(activeSnap, currentMonth, currentYear)}`
                    : `After Cutoff (>15th/16th SPayLater · >25th Permata CC) -> Deferred 1 cycle to ${formatSnapLabel(nextSnap, currentMonth, currentYear)}`}
                </span>
              </span>
              <span>
                Horizon Income Benchmark ({formatSnapLabel(thirdSnap, currentMonth, currentYear)}):{" "}
                <span className="text-text-secondary">{formatRupiah(thirdSnap.finalTotalIncome)}</span>
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Purchase Parameters Form (5 cols) */}
        <div className="lg:col-span-5">
          <WishlistPlannerForm
            currentMonth={currentMonth}
            currentYear={currentYear}
            onAnalysisResult={setAnalysis}
            setIsLoadingAnalysis={setIsLoadingAnalysis}
            setAnalysisError={setAnalysisError}
          />
        </div>

        {/* Right Column: Simulation & Leverage Analysis Results (7 cols) */}
        <div className="lg:col-span-7">
          <WishlistAnalysisResults
            analysis={analysis}
            isLoading={isLoadingAnalysis}
            errorMessage={analysisError}
          />
        </div>
      </div>
    </div>
  );
}
