"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RotateCcw, Play, TrendingUp, ShieldCheck } from "lucide-react";
import {
  ScenarioSimulationRequest,
  ScenarioSimulationResponse,
  simulateScenario,
} from "@/lib/api";
import { formatCurrencyInput, formatRupiah, parseCurrencyInput } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { usePeriod } from "@/context/PeriodContext";
import { PageHeader } from "@/components/primitives/PageHeader";

interface ScenarioLabClientProps {
  initialMonth: number;
  initialYear: number;
}

export function ScenarioLabClient({
  initialMonth,
  initialYear,
}: ScenarioLabClientProps) {
  const { t } = useLanguage();
  const { isAmountsMasked } = usePrivacyMask();
  const { month, year } = usePeriod();
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
    <div className="space-y-6 w-full max-w-full pb-20">
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
              +15% Burn Shock
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
                Adjust any lever to recalculate Go forward trajectory.
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
          {/* 4-Metric Impact Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-surface p-3.5">
              <span className="text-[10px] font-mono uppercase text-text-tertiary block">
                Baseline 12M Cash
              </span>
              <span className="font-mono text-base font-semibold text-text-secondary mt-1 block erp-tabular-currency">
                {result ? formatRupiah(result.baseline.projected12MWealthRp, isAmountsMasked) : "—"}
              </span>
              <span className="text-[11px] text-text-tertiary mt-0.5 block">
                Debt-free: {result?.baseline.freedomDate ?? "—"}
              </span>
            </div>

            <div className="rounded-lg border border-border bg-surface p-3.5">
              <span className="text-[10px] font-mono uppercase text-text-tertiary block">
                Simulated 12M Cash
              </span>
              <span className="font-serif text-xl text-text-primary mt-1 block erp-tabular-currency">
                {result ? formatRupiah(result.simulated.projected12MWealthRp, isAmountsMasked) : "—"}
              </span>
              <span className="text-[11px] text-text-tertiary mt-0.5 block">
                Debt-free: {result?.simulated.freedomDate ?? "—"}
              </span>
            </div>

            <div className="rounded-lg border border-border bg-surface p-3.5">
              <span className="text-[10px] font-mono uppercase text-text-tertiary block">
                12-Month Delta
              </span>
              <span
                className={`font-mono text-base font-semibold mt-1 block erp-tabular-currency ${
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

            <div className="rounded-lg border border-border bg-surface p-3.5">
              <span className="text-[10px] font-mono uppercase text-text-tertiary block">
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
              <div className="h-44 flex items-center justify-center text-xs font-mono text-text-tertiary">
                {isLoading ? "Running Go scenario projection..." : "No trajectory points returned."}
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

          {/* Debt Strategy Comparison */}
          {result && result.debtStrategies.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-delta-positive" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Debt Prepayment Allocation Comparison
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {result.debtStrategies.map((st) => (
                  <div
                    key={st.strategy}
                    className="p-3.5 rounded border border-border-subtle bg-surface-subtle/40 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-text-primary">
                      <span>{st.strategy}</span>
                      <span className="font-mono text-delta-positive erp-tabular-currency">
                        +{formatRupiah(st.immediateFreedMonthlyRp, isAmountsMasked)}/mo
                      </span>
                    </div>
                    <p className="text-[11px] text-text-tertiary leading-relaxed">{st.summary}</p>
                    <div className="pt-1.5 border-t border-border-subtle flex items-center justify-between text-[11px] font-mono">
                      <span className="text-text-secondary">Interest Saved</span>
                      <span className="text-delta-positive font-semibold erp-tabular-currency">
                        {formatRupiah(st.estimatedInterestSavedRp, isAmountsMasked)} ({st.monthsShaved}m)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
