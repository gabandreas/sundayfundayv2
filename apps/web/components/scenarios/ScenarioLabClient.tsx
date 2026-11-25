"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RotateCcw, Play, TrendingUp, ShieldCheck, Activity } from "lucide-react";
import {
  ScenarioSimulationRequest,
  ScenarioSimulationResponse,
  ScenarioStressTestResponse,
  runScenarioStressTest,
  simulateScenario,
} from "@/lib/api";
import { formatCurrencyInput, formatRupiah, parseCurrencyInput } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { usePeriod } from "@/context/PeriodContext";
import { useToast } from "@/context/ToastContext";
import { PageHeader } from "@/components/primitives/PageHeader";

interface ScenarioLabClientProps {
  initialMonth: number;
  initialYear: number;
  embedded?: boolean;
}

export function ScenarioLabClient({
  initialMonth,
  initialYear,
  embedded = false,
}: ScenarioLabClientProps) {
  const { t } = useLanguage();
  const { isAmountsMasked } = usePrivacyMask();
  const { month, year, revisionTick } = usePeriod();
  const { toast } = useToast();
  const activeMonth = month || initialMonth;
  const activeYear = year || initialYear;

  const [extraMonthlySavingsRp, setExtraMonthlySavingsRp] = useState<number>(300000);
  const [oneTimeBonusRp, setOneTimeBonusRp] = useState<number>(0);
  const [monthlyLivingDeltaRp, setMonthlyLivingDeltaRp] = useState<number>(0);
  const [extraDebtPrepaymentRp, setExtraDebtPrepaymentRp] = useState<number>(0);
  const [variableShockPercent, setVariableShockPercent] = useState<number>(0);

  const [result, setResult] = useState<ScenarioSimulationResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Stress Test & Surplus Allocation Frontier states
  const [incomeVolatilityPct, setIncomeVolatilityPct] = useState<number>(12);
  const [expenseShockProbPct, setExpenseShockProbPct] = useState<number>(20);
  const [expenseShockMagnitudePct, setExpenseShockMagnitudePct] = useState<number>(25);
  const [unexpectedEmergencyCostRp, setUnexpectedEmergencyCostRp] = useState<number>(1500000);
  const [trials, setTrials] = useState<number>(2000);
  const [surplusOverrideRp, setSurplusOverrideRp] = useState<string>("");
  const [stressResult, setStressResult] = useState<ScenarioStressTestResponse | null>(null);
  const [stressLoading, setStressLoading] = useState<boolean>(true);
  const [stressError, setStressError] = useState<string | null>(null);
  const [mcHoverIdx, setMcHoverIdx] = useState<number | null>(null);

  const executeStressTest = useCallback(
    async (notify = false) => {
      setStressLoading(true);
      setStressError(null);
      const parsedOverride = surplusOverrideRp.trim()
        ? parseCurrencyInput(surplusOverrideRp)
        : undefined;
      const res = await runScenarioStressTest({
        month: activeMonth,
        year: activeYear,
        incomeVolatilityPct,
        expenseShockProbPct,
        expenseShockMagnitudePct,
        unexpectedEmergencyProbPct: 10,
        unexpectedEmergencyCostRp,
        trials,
        ...(parsedOverride !== undefined && parsedOverride >= 0
          ? { monthlySurplusOverrideRp: parsedOverride }
          : {}),
      });
      setStressLoading(false);
      if (!res.success || !res.data) {
        const msg = res.error || "Unable to run cashflow resilience simulation.";
        setStressError(msg);
        if (notify) toast({ title: "Simulation failed", description: msg, variant: "error" });
        return;
      }
      setStressResult(res.data);
      if (notify) {
        toast({
          title: "Simulation complete",
          description: `${res.data.monteCarlo.trialsRun.toLocaleString()} simulated paths computed.`,
          variant: "success",
        });
      }
    },
    [
      activeMonth,
      activeYear,
      incomeVolatilityPct,
      expenseShockProbPct,
      expenseShockMagnitudePct,
      unexpectedEmergencyCostRp,
      trials,
      surplusOverrideRp,
      toast,
    ],
  );

  useEffect(() => {
    void executeStressTest(false);
    // Re-run automatically when period or mutation revision changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth, activeYear, revisionTick]);

  const runSimulation = useCallback(
    async (overrideInputs?: Partial<ScenarioSimulationRequest>) => {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await simulateScenario({
        month: activeMonth,
        year: activeYear,
        extraMonthlySavingsRp: overrideInputs?.extraMonthlySavingsRp ?? extraMonthlySavingsRp,
        oneTimeBonusRp: overrideInputs?.oneTimeBonusRp ?? oneTimeBonusRp,
        monthlyLivingDeltaRp: overrideInputs?.monthlyLivingDeltaRp ?? monthlyLivingDeltaRp,
        extraDebtPrepaymentRp: overrideInputs?.extraDebtPrepaymentRp ?? extraDebtPrepaymentRp,
        variableShockPercent: overrideInputs?.variableShockPercent ?? variableShockPercent,
      });
      setIsLoading(false);
      if (!res.success || !res.data) {
        setErrorMsg(res.error || "Unable to compute scenario simulation.");
        return;
      }
      setResult(res.data);
    },
    [
      activeMonth,
      activeYear,
      extraMonthlySavingsRp,
      oneTimeBonusRp,
      monthlyLivingDeltaRp,
      extraDebtPrepaymentRp,
      variableShockPercent,
    ],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation();
    }, 180);
    return () => clearTimeout(timer);
  }, [runSimulation]);

  const applyPreset = (preset: "sprint" | "bonus" | "shock" | "reset") => {
    if (preset === "reset") {
      setExtraMonthlySavingsRp(0);
      setOneTimeBonusRp(0);
      setMonthlyLivingDeltaRp(0);
      setExtraDebtPrepaymentRp(0);
      setVariableShockPercent(0);
    } else if (preset === "sprint") {
      setExtraMonthlySavingsRp(500000);
      setOneTimeBonusRp(0);
      setMonthlyLivingDeltaRp(-150000);
      setExtraDebtPrepaymentRp(1000000);
      setVariableShockPercent(0);
    } else if (preset === "bonus") {
      setExtraMonthlySavingsRp(250000);
      setOneTimeBonusRp(3000000);
      setMonthlyLivingDeltaRp(0);
      setExtraDebtPrepaymentRp(1500000);
      setVariableShockPercent(0);
    } else {
      setExtraMonthlySavingsRp(0);
      setOneTimeBonusRp(0);
      setMonthlyLivingDeltaRp(0);
      setExtraDebtPrepaymentRp(0);
      setVariableShockPercent(15);
    }
  };

  // Dual-line SVG Trajectory Geometry
  const series = result?.series ?? [];
  const svgW = 740;
  const svgH = 230;
  const padL = 74;
  const padR = 24;
  const padT = 20;
  const padB = 34;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const allVals = series.flatMap((pt) => [pt.baselineWealthRp, pt.simulatedWealthRp, 0]);
  const maxVal = Math.max(...allVals, 1000000);
  const minVal = Math.min(...allVals, 0);
  const span = Math.max(1, maxVal - minVal);

  const toX = (idx: number) =>
    series.length <= 1 ? padL : padL + (idx / (series.length - 1)) * plotW;
  const toY = (val: number) =>
    padT + (1 - (val - minVal) / span) * plotH;

  const baselinePath = series
    .map((pt, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(pt.baselineWealthRp).toFixed(1)}`)
    .join(" ");
  const simulatedPath = series
    .map((pt, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(pt.simulatedWealthRp).toFixed(1)}`)
    .join(" ");

  const activePoint = hoverIdx !== null ? series[hoverIdx] : series[series.length - 1];

  return (
    <div className={`space-y-6 w-full max-w-full ${embedded ? "pb-6" : "pb-20"}`}>
      {embedded ? (
        <div className="rounded-lg border border-border bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Cashflow What-If Lab</h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              Test 12-month savings, debt prepayments, and living changes without altering your live budget.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => applyPreset("sprint")}
              className="erp-btn-secondary px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer"
            >
              Debt-Free Sprint
            </button>
            <button
              type="button"
              onClick={() => applyPreset("bonus")}
              className="erp-btn-secondary px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer"
            >
              Bonus Prepayment
            </button>
            <button
              type="button"
              onClick={() => applyPreset("shock")}
              className="erp-btn-secondary px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer"
            >
              +15% Expense Shock
            </button>
            <button
              type="button"
              onClick={() => applyPreset("reset")}
              className="erp-btn-secondary inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      ) : (
        <PageHeader
          title={t("nav.scenarios")}
          subtitle="Stress-test 12-month savings growth, extra debt payoffs, and daily living changes before altering your live budget."
          periodLabel={`${activeMonth}/${activeYear}`}
          rightActions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => applyPreset("sprint")}
                className="erp-btn-secondary px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer"
              >
                Debt-Free Sprint
              </button>
              <button
                type="button"
                onClick={() => applyPreset("bonus")}
                className="erp-btn-secondary px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer"
              >
                Bonus Prepayment
              </button>
              <button
                type="button"
                onClick={() => applyPreset("shock")}
                className="erp-btn-secondary px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer"
              >
                +15% Expense Shock
              </button>
              <button
                type="button"
                onClick={() => applyPreset("reset")}
                className="erp-btn-secondary inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          }
        />
      )}

      {errorMsg && (
        <div className="p-3 rounded erp-callout-urgency text-xs text-urgency">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left 4 Cols: Scenario Levers */}
        <div className="xl:col-span-4 rounded-lg border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Scenario Inputs</h2>
              <p className="text-[11px] text-text-tertiary mt-0.5">
                Adjust any lever to update your forward cashflow projection.
              </p>
            </div>
            <button
              type="button"
              onClick={() => runSimulation()}
              disabled={isLoading}
              className="erp-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              <span>{isLoading ? "Running..." : "Simulate"}</span>
            </button>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* Lever 1 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Extra Monthly Savings</span>
                <span className="font-mono text-delta-positive erp-tabular-currency">
                  +{formatRupiah(extraMonthlySavingsRp, isAmountsMasked)}/mo
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={3000000}
                step={100000}
                value={extraMonthlySavingsRp}
                onChange={(e) => setExtraMonthlySavingsRp(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
            </div>

            {/* Lever 2 */}
            <div className="space-y-1">
              <label className="text-text-secondary block">
                One-Time Bonus / THR Inflow (Rp)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatCurrencyInput(oneTimeBonusRp)}
                onChange={(e) => setOneTimeBonusRp(parseCurrencyInput(e.target.value))}
                className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-xs text-text-primary erp-tabular-currency"
              />
            </div>

            {/* Lever 3 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Monthly Living Adjustment</span>
                <span
                  className={`font-mono erp-tabular-currency ${
                    monthlyLivingDeltaRp <= 0 ? "text-delta-positive" : "text-caution"
                  }`}
                >
                  {monthlyLivingDeltaRp >= 0 ? "+" : ""}
                  {formatRupiah(monthlyLivingDeltaRp, isAmountsMasked)}
                </span>
              </div>
              <input
                type="range"
                min={-500000}
                max={1000000}
                step={50000}
                value={monthlyLivingDeltaRp}
                onChange={(e) => setMonthlyLivingDeltaRp(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
            </div>

            {/* Lever 4 */}
            <div className="space-y-1">
              <label className="text-text-secondary block">
                Extra Debt Prepayment Lump Sum (Rp)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatCurrencyInput(extraDebtPrepaymentRp)}
                onChange={(e) => setExtraDebtPrepaymentRp(parseCurrencyInput(e.target.value))}
                className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-xs text-text-primary erp-tabular-currency"
              />
            </div>

            {/* Lever 5 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Variable Expense Shock</span>
                <span className="font-mono text-caution">+{variableShockPercent}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={5}
                value={variableShockPercent}
                onChange={(e) => setVariableShockPercent(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right 8 Cols: KPI Impact + SVG Comparison Chart */}
        <div className="xl:col-span-8 space-y-5">
          {/* 4-Metric Impact Strip */}
          <div className="rounded-lg border border-border bg-surface grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-border-subtle">
            <div className="p-3.5 min-w-0">
              <span className="text-[11px] font-sans text-text-tertiary block">
                Baseline 12M Cash
              </span>
              <span className="erp-tabular-currency text-base font-semibold text-text-secondary mt-1 block truncate">
                {result ? formatRupiah(result.baseline.projected12MWealthRp, isAmountsMasked) : "—"}
              </span>
              <span className="text-[11px] text-text-tertiary mt-0.5 block">
                Debt-free: {result?.baseline.freedomDate ?? "—"}
              </span>
            </div>

            <div className="p-3.5 min-w-0">
              <span className="text-[11px] font-sans text-text-tertiary block">
                Simulated 12M Cash
              </span>
              <span className="font-serif text-xl text-text-primary mt-1 block erp-tabular-currency truncate">
                {result ? formatRupiah(result.simulated.projected12MWealthRp, isAmountsMasked) : "—"}
              </span>
              <span className="text-[11px] text-text-tertiary mt-0.5 block">
                Debt-free: {result?.simulated.freedomDate ?? "—"}
              </span>
            </div>

            <div className="p-3.5 min-w-0">
              <span className="text-[11px] font-sans text-text-tertiary block">
                12-Month Delta
              </span>
              <span
                className={`erp-tabular-currency text-base font-semibold mt-1 block truncate ${
                  (result?.net12MDeltaRp ?? 0) >= 0 ? "text-delta-positive" : "text-delta-negative"
                }`}
              >
                {result
                  ? `${result.net12MDeltaRp >= 0 ? "+" : ""}${formatRupiah(
                      result.net12MDeltaRp,
                      isAmountsMasked,
                    )}`
                  : "—"}
              </span>
              <span className="text-[11px] text-text-tertiary mt-0.5 block">
                Runway shift: {result ? `${result.runwayDeltaDays >= 0 ? "+" : ""}${result.runwayDeltaDays}d` : "—"}
              </span>
            </div>

            <div className="p-3.5 min-w-0">
              <span className="text-[11px] font-sans text-text-tertiary block">
                Low-DSR (&lt;15%) Date
              </span>
              <span className="font-mono text-base font-semibold text-text-primary mt-1 block">
                {result?.simulated.lowDsrDate ?? "—"}
              </span>
              <span className="text-[11px] text-text-tertiary mt-0.5 block">
                Baseline: {result?.baseline.lowDsrDate ?? "—"}
              </span>
            </div>
          </div>

          {/* Interactive SVG Dual-Curve Chart */}
          <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-delta-positive" />
                  <span>Baseline vs. Simulated 12-Month Wealth Curve</span>
                </h3>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-mono text-text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-[#8A94A6] inline-block" />
                  Baseline
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#2BB686] inline-block" />
                  Simulated
                </span>
              </div>
            </div>

            {series.length > 0 ? (
              <div className="overflow-x-auto">
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  className="w-full h-56 select-none"
                  role="img"
                  aria-label="Baseline versus simulated 12-month wealth trajectory"
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                    const y = padT + frac * plotH;
                    const tickVal = maxVal - frac * span;
                    return (
                      <g key={frac}>
                        <line
                          x1={padL}
                          x2={svgW - padR}
                          y1={y}
                          y2={y}
                          stroke="rgba(255,255,255,0.06)"
                          strokeWidth="1"
                        />
                        <text
                          x={padL - 8}
                          y={y + 3}
                          textAnchor="end"
                          className="fill-[#7c8594] text-[9px] font-mono"
                        >
                          {isAmountsMasked
                            ? "•••"
                            : `${(tickVal / 1000000).toFixed(1)}M`}
                        </text>
                      </g>
                    );
                  })}

                  <path
                    d={baselinePath}
                    fill="none"
                    stroke="#8A94A6"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />
                  <path
                    d={simulatedPath}
                    fill="none"
                    stroke="#2BB686"
                    strokeWidth="2.5"
                  />

                  {series.map((pt, idx) => {
                    const cx = toX(idx);
                    const cySim = toY(pt.simulatedWealthRp);
                    const cyBase = toY(pt.baselineWealthRp);
                    const isActive = hoverIdx === idx;
                    return (
                      <g
                        key={pt.label}
                        onMouseEnter={() => setHoverIdx(idx)}
                        onMouseLeave={() => setHoverIdx(null)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={cx - 18}
                          y={padT}
                          width={36}
                          height={plotH}
                          fill="transparent"
                        />
                        {isActive && (
                          <line
                            x1={cx}
                            x2={cx}
                            y1={padT}
                            y2={padT + plotH}
                            stroke="rgba(255,255,255,0.18)"
                            strokeDasharray="2 2"
                          />
                        )}
                        <circle
                          cx={cx}
                          cy={cyBase}
                          r={isActive ? 4 : 2.5}
                          fill="#8A94A6"
                        />
                        <circle
                          cx={cx}
                          cy={cySim}
                          r={isActive ? 5 : 3}
                          fill="#2BB686"
                        />
                        <text
                          x={cx}
                          y={svgH - 10}
                          textAnchor="middle"
                          className={`text-[9px] font-mono ${
                            isActive ? "fill-white font-semibold" : "fill-[#7c8594]"
                          }`}
                        >
                          {pt.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs font-sans text-text-tertiary">
                {isLoading ? "Calculating forward trajectory..." : "No trajectory points returned."}
              </div>
            )}

            {activePoint && (
              <div className="pt-2.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <span className="text-text-primary font-semibold">{activePoint.label}</span>
                <span>
                  Baseline:{" "}
                  <strong className="text-text-secondary erp-tabular-currency">
                    {formatRupiah(activePoint.baselineWealthRp, isAmountsMasked)}
                  </strong>
                </span>
                <span>
                  Simulated:{" "}
                  <strong className="text-delta-positive erp-tabular-currency">
                    {formatRupiah(activePoint.simulatedWealthRp, isAmountsMasked)}
                  </strong>
                </span>
                <span>
                  DSR:{" "}
                  <strong className="text-text-primary">
                    {activePoint.simulatedDsrPercent.toFixed(1)}%
                  </strong>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cashflow Resilience Stress Test & Optimal Surplus Split */}
      <section className="space-y-4 pt-2 border-t border-border-subtle">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-delta-positive" />
              <h2 className="text-base font-semibold text-text-primary tracking-tight">
                Cashflow Resilience &amp; Surplus Split Advisor
              </h2>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              12-month cashflow stress simulation under income variability and unexpected expenses, paired with optimal monthly surplus split options.
            </p>
          </div>
          {stressResult && (
            <span className="text-[11px] font-mono text-text-tertiary bg-surface border border-border-subtle rounded px-2.5 py-1 tabular-nums">
              {stressResult.monteCarlo.trialsRun.toLocaleString()} simulated paths
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Stress Parameters Controls */}
          <div className="lg:col-span-4 rounded-lg border border-border bg-surface p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
              <span className="font-semibold text-text-primary">Stress Test Parameters</span>
              <button
                type="button"
                onClick={() => {
                  setIncomeVolatilityPct(12);
                  setExpenseShockProbPct(20);
                  setExpenseShockMagnitudePct(25);
                  setUnexpectedEmergencyCostRp(1500000);
                  setTrials(2000);
                  setSurplusOverrideRp("");
                }}
                className="text-[11px] font-mono text-text-tertiary hover:text-text-primary cursor-pointer"
              >
                Reset Defaults
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="mc-vol" className="text-text-secondary">Income Volatility</label>
                <span className="font-mono text-text-primary tabular-nums">{incomeVolatilityPct}%</span>
              </div>
              <input
                id="mc-vol"
                type="range"
                min={0}
                max={40}
                value={incomeVolatilityPct}
                onChange={(e) => setIncomeVolatilityPct(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="mc-shock-prob" className="text-text-secondary">Monthly Expense Shock Risk</label>
                <span className="font-mono text-text-primary tabular-nums">{expenseShockProbPct}%</span>
              </div>
              <input
                id="mc-shock-prob"
                type="range"
                min={0}
                max={60}
                value={expenseShockProbPct}
                onChange={(e) => setExpenseShockProbPct(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="mc-shock-mag" className="text-text-secondary">Shock Spend Surge</label>
                <span className="font-mono text-text-primary tabular-nums">{expenseShockMagnitudePct}%</span>
              </div>
              <input
                id="mc-shock-mag"
                type="range"
                min={5}
                max={60}
                value={expenseShockMagnitudePct}
                onChange={(e) => setExpenseShockMagnitudePct(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="mc-emergency" className="block text-text-secondary mb-1">
                  Emergency Shock (Rp)
                </label>
                <input
                  id="mc-emergency"
                  type="text"
                  inputMode="numeric"
                  value={formatCurrencyInput(unexpectedEmergencyCostRp)}
                  onChange={(e) => setUnexpectedEmergencyCostRp(parseCurrencyInput(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded bg-canvas border border-border text-xs font-mono text-text-primary tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="mc-trials" className="block text-text-secondary mb-1">
                  Simulated Paths
                </label>
                <select
                  id="mc-trials"
                  value={trials}
                  onChange={(e) => setTrials(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded bg-canvas border border-border text-xs font-mono text-text-primary"
                >
                  <option value={1000}>1,000 trials</option>
                  <option value={2000}>2,000 trials</option>
                  <option value={5000}>5,000 trials</option>
                  <option value={10000}>10,000 trials</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="mc-surplus" className="block text-text-secondary mb-1">
                Monthly Surplus Override (Rp · Optional)
              </label>
              <input
                id="mc-surplus"
                type="text"
                inputMode="numeric"
                value={surplusOverrideRp}
                onChange={(e) => setSurplusOverrideRp(e.target.value)}
                placeholder={
                  stressResult
                    ? `Auto: ${formatRupiah(stressResult.monthlySurplusRp, isAmountsMasked)}`
                    : "Auto from snapshot"
                }
                className="w-full px-2.5 py-1.5 rounded bg-canvas border border-border text-xs font-mono text-text-primary tabular-nums"
              />
            </div>

            <button
              type="button"
              disabled={stressLoading}
              onClick={() => void executeStressTest(true)}
              className="w-full py-2 rounded erp-btn-primary text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{stressLoading ? "Simulating Paths..." : "Run Stress Test"}</span>
            </button>

            {stressError && (
              <div className="p-2.5 rounded border border-urgency/40 bg-urgency/10 text-[11px] text-urgency">
                {stressError}
              </div>
            )}
          </div>

          {/* Right Column: Confidence Metrics, Fan Chart & Optimizer Strategies */}
          <div className="lg:col-span-8 space-y-4">
            {/* 4 Confidence KPI Strip */}
            <div className="rounded-lg border border-border bg-surface grid grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 xl:divide-x divide-border-subtle">
              <div className="p-4 min-w-0">
                <div className="text-[11px] font-medium text-text-tertiary">12-Month Survival Rate</div>
                <div className="font-serif text-[26px] font-normal text-delta-positive mt-1 tabular-nums leading-none">
                  {stressResult ? `${stressResult.monteCarlo.survivalProbabilityPct.toFixed(1)}%` : "—"}
                </div>
                <div className="text-[11px] text-text-tertiary mt-1">Positive liquid floor probability</div>
              </div>

              <div className="p-4 min-w-0">
                <div className="text-[11px] font-medium text-text-tertiary">Emergency Target Hit</div>
                <div className="font-mono text-xl font-semibold text-text-primary mt-1.5 tabular-nums leading-none">
                  {stressResult ? `${stressResult.monteCarlo.emergencyGoalProbabilityPct.toFixed(1)}%` : "—"}
                </div>
                <div className="text-[11px] text-text-tertiary mt-1.5">Reserve goal achieved in 12m</div>
              </div>

              <div className="p-4 min-w-0">
                <div className="text-[11px] font-medium text-text-tertiary">Median Ending Wealth (P50)</div>
                <div className="erp-tabular-currency text-base font-semibold text-text-primary mt-1.5 leading-none truncate">
                  {stressResult ? formatRupiah(stressResult.monteCarlo.p50MedianEndingWealthRp, isAmountsMasked) : "—"}
                </div>
                <div className="text-[11px] text-text-tertiary mt-1.5">50th percentile outcome</div>
              </div>

              <div className="p-4 min-w-0">
                <div className="text-[11px] font-medium text-text-tertiary">Worst-Case Cash Floor (P5)</div>
                <div
                  className={`erp-tabular-currency text-base font-semibold mt-1.5 leading-none truncate ${
                    (stressResult?.monteCarlo.p5WorstCaseCashFloorRp ?? 0) < 0
                      ? "text-urgency"
                      : "text-caution"
                  }`}
                >
                  {stressResult ? formatRupiah(stressResult.monteCarlo.p5WorstCaseCashFloorRp, isAmountsMasked) : "—"}
                </div>
                <div className="text-[11px] text-text-tertiary mt-1.5">5th percentile liquidity stress</div>
              </div>
            </div>

            {stressResult && stressResult.monteCarlo.recommendedExtraBufferMonthlyRp > 0 && (
              <div className="rounded-md erp-callout-caution px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
                <span>
                  Suggested extra monthly resilience buffer to stabilize adverse tail risk:
                </span>
                <strong className="font-mono text-caution erp-tabular-currency">
                  +{formatRupiah(stressResult.monteCarlo.recommendedExtraBufferMonthlyRp, isAmountsMasked)} / mo
                </strong>
              </div>
            )}

            {/* P10-P50-P90 Confidence Fan Chart */}
            {stressResult && stressResult.monteCarlo.fanSeries.length > 0 && (() => {
              const fan = stressResult.monteCarlo.fanSeries;
              const fW = 740;
              const fH = 210;
              const fPadL = 70;
              const fPadR = 20;
              const fPadT = 16;
              const fPadB = 30;
              const fPlotW = fW - fPadL - fPadR;
              const fPlotH = fH - fPadT - fPadB;
              const vals = fan.flatMap((pt) => [pt.p10Rp, pt.p50Rp, pt.p90Rp, 0]);
              const fMax = Math.max(...vals, 1000000);
              const fMin = Math.min(...vals, 0);
              const fSpan = Math.max(1, fMax - fMin);
              const fx = (i: number) =>
                fan.length <= 1 ? fPadL : fPadL + (i / (fan.length - 1)) * fPlotW;
              const fy = (v: number) => fPadT + (1 - (v - fMin) / fSpan) * fPlotH;

              const p90Coords = fan.map((pt, i) => `${fx(i).toFixed(1)},${fy(pt.p90Rp).toFixed(1)}`);
              const p10RevCoords = [...fan]
                .reverse()
                .map((pt, ri) => `${fx(fan.length - 1 - ri).toFixed(1)},${fy(pt.p10Rp).toFixed(1)}`);
              const bandPolygon = [...p90Coords, ...p10RevCoords].join(" ");
              const p50Path = fan
                .map((pt, i) => `${i === 0 ? "M" : "L"}${fx(i).toFixed(1)},${fy(pt.p50Rp).toFixed(1)}`)
                .join(" ");
              const p10Path = fan
                .map((pt, i) => `${i === 0 ? "M" : "L"}${fx(i).toFixed(1)},${fy(pt.p10Rp).toFixed(1)}`)
                .join(" ");
              const hoveredFan =
                mcHoverIdx !== null ? fan[mcHoverIdx] : fan[fan.length - 1];

              return (
                <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-text-primary">
                      P10–P50–P90 Wealth Confidence Fan
                    </span>
                    <div className="flex items-center gap-4 text-[11px] font-mono">
                      <span className="inline-flex items-center gap-1.5 text-delta-positive">
                        <span className="w-3 h-0.5 bg-delta-positive inline-block" />
                        P50 Median
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-caution">
                        <span className="w-3 h-0.5 bg-caution inline-block" />
                        P10 Downside
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-text-tertiary">
                        <span className="w-3 h-2 bg-emerald-500/20 border border-emerald-500/30 inline-block" />
                        P10–P90 Band
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <svg
                      viewBox={`0 0 ${fW} ${fH}`}
                      className="w-full h-52 select-none"
                      aria-label="Cashflow P10 to P90 confidence trajectory chart"
                    >
                      <polygon points={bandPolygon} fill="rgba(16, 183, 141, 0.12)" />
                      <path
                        d={p10Path}
                        fill="none"
                        stroke="#E59B2C"
                        strokeWidth={1.6}
                        strokeDasharray="4 3"
                      />
                      <path d={p50Path} fill="none" stroke="#10B78D" strokeWidth={2.2} />
                      {fan.map((pt, i) => {
                        const cx = fx(i);
                        const isAct = mcHoverIdx === i;
                        return (
                          <g
                            key={pt.label}
                            onMouseEnter={() => setMcHoverIdx(i)}
                            onMouseLeave={() => setMcHoverIdx(null)}
                            className="cursor-pointer"
                          >
                            <rect
                              x={cx - fPlotW / Math.max(2, fan.length * 2)}
                              y={fPadT}
                              width={fPlotW / Math.max(1, fan.length)}
                              height={fPlotH}
                              fill="transparent"
                            />
                            {isAct && (
                              <line
                                x1={cx}
                                x2={cx}
                                y1={fPadT}
                                y2={fPadT + fPlotH}
                                stroke="rgba(255,255,255,0.2)"
                                strokeDasharray="2 2"
                              />
                            )}
                            <circle cx={cx} cy={fy(pt.p50Rp)} r={isAct ? 4.5 : 2.5} fill="#10B78D" />
                            <text
                              x={cx}
                              y={fH - 8}
                              textAnchor="middle"
                              className={`text-[9px] font-mono ${
                                isAct ? "fill-white font-semibold" : "fill-[#7c8594]"
                              }`}
                            >
                              {pt.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {hoveredFan && (
                    <div className="pt-2.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                      <span className="font-semibold text-text-primary">{hoveredFan.label}</span>
                      <span>
                        P10:{" "}
                        <strong className="text-caution erp-tabular-currency">
                          {formatRupiah(hoveredFan.p10Rp, isAmountsMasked)}
                        </strong>
                      </span>
                      <span>
                        P50:{" "}
                        <strong className="text-delta-positive erp-tabular-currency">
                          {formatRupiah(hoveredFan.p50Rp, isAmountsMasked)}
                        </strong>
                      </span>
                      <span>
                        P90:{" "}
                        <strong className="text-text-primary erp-tabular-currency">
                          {formatRupiah(hoveredFan.p90Rp, isAmountsMasked)}
                        </strong>
                      </span>
                      <span>
                        Shortfall Risk:{" "}
                        <strong className="text-text-secondary">
                          {hoveredFan.shortfallRiskPct.toFixed(1)}%
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Surplus Allocation Frontier (3 Optimal Split Strategies) */}
            {stressResult && stressResult.optimizer.strategies.length > 0 && (
              <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      Surplus Allocation Frontier
                    </h3>
                    <p className="text-[11px] text-text-tertiary mt-0.5">
                      Evaluated {stressResult.optimizer.combinationsEvaluated.toLocaleString()} monthly surplus splits across debt prepayment, emergency reserve, goals, and flexible spending.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 divide-y xl:divide-y-0 xl:divide-x divide-border-subtle border-t border-border-subtle pt-1">
                  {stressResult.optimizer.strategies.map((st) => {
                    const horizonBadge =
                      st.debtMonthsShaved > 0
                        ? `-${st.debtMonthsShaved}m debt`
                        : st.emergencyMonthsToTarget >= 999
                          ? "No reserve pace"
                          : `${st.emergencyMonthsToTarget}m reserve`;
                    return (
                      <div
                        key={st.code}
                        className="py-3.5 xl:px-4 first:xl:pl-0 last:xl:pr-0 space-y-2.5 text-xs min-w-0"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold text-text-primary">{st.title}</div>
                          <span className="text-[11px] font-mono text-delta-positive shrink-0 whitespace-nowrap">
                            {horizonBadge}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-[11px] font-mono border-y border-border-subtle py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-text-tertiary truncate">Debt Prepay</span>
                            <span className="text-text-primary erp-tabular-currency">
                              {formatRupiah(st.debtPrepaymentRp, isAmountsMasked)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-text-tertiary truncate">Emergency</span>
                            <span className="text-text-primary erp-tabular-currency">
                              {formatRupiah(st.emergencyFundRp, isAmountsMasked)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-text-tertiary truncate">Savings Goals</span>
                            <span className="text-text-primary erp-tabular-currency">
                              {formatRupiah(st.goalSavingsRp, isAmountsMasked)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-text-tertiary truncate">Flexible Pool</span>
                            <span className="text-text-primary erp-tabular-currency">
                              {formatRupiah(st.flexibleRp, isAmountsMasked)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 text-[11px] font-mono">
                          <span className="text-text-tertiary">12M Projected Worth</span>
                          <span className="font-semibold text-delta-positive erp-tabular-currency">
                            {formatRupiah(st.projected12MNetWorthRp, isAmountsMasked)}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-tertiary leading-relaxed">
                          {st.emergencyMonthsToTarget >= 999 || st.rationale.includes("~999")
                            ? "No monthly surplus is routed to emergency reserves under this split."
                            : st.rationale}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
