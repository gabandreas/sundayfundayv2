"use client";

import React, { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { ComparativePeriodRow } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

interface ReportsEquityChartProps {
  periods: ComparativePeriodRow[];
  selectedMonth: number;
  selectedYear: number;
}

type ChartMode = "equity" | "cashflow";

export function ReportsEquityChart({
  periods,
  selectedMonth,
  selectedYear,
}: ReportsEquityChartProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const [mode, setMode] = useState<ChartMode>("equity");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const ordered = useMemo(() => {
    const sorted = [...periods].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month,
    );
    let runningNet = 0;
    return sorted.map((p) => {
      const cycleRetained = (p.actualSavings ?? 0) + (p.selfReward ?? 0);
      runningNet += cycleRetained;
      const totalOutflow =
        (p.creditBillsAmount ?? 0) + (p.routineAndDailyLivingAmount ?? 0);
      return {
        ...p,
        cycleRetained,
        runningNet,
        totalOutflow,
      };
    });
  }, [periods]);

  if (ordered.length === 0) {
    return null;
  }

  const defaultIdx = Math.max(
    0,
    ordered.findIndex((p) => p.month === selectedMonth && p.year === selectedYear),
  );
  const activeIdx =
    hoverIdx !== null && ordered[hoverIdx] ? hoverIdx : defaultIdx >= 0 ? defaultIdx : ordered.length - 1;
  const active = ordered[activeIdx];

  const svgW = 860;
  const svgH = 230;
  const padL = 70;
  const padR = 24;
  const padT = 18;
  const padB = 34;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const seriesValues = ordered.flatMap((p) =>
    mode === "equity"
      ? [p.runningNet, p.cycleRetained, 0]
      : [p.finalTotalIncome, p.totalOutflow, p.cycleRetained, 0],
  );
  const maxVal = Math.max(...seriesValues, 1000000);
  const minVal = Math.min(...seriesValues, 0);
  const span = Math.max(1, maxVal - minVal);

  const toX = (i: number) =>
    ordered.length <= 1 ? padL + plotW / 2 : padL + (i / (ordered.length - 1)) * plotW;
  const toY = (v: number) => padT + (1 - (v - minVal) / span) * plotH;

  const equityPath = ordered
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.runningNet).toFixed(1)}`)
    .join(" ");
  const equityAreaPath =
    ordered.length > 1
      ? `${equityPath} L${toX(ordered.length - 1).toFixed(1)},${toY(0).toFixed(1)} L${toX(0).toFixed(1)},${toY(0).toFixed(1)} Z`
      : "";

  const incomePath = ordered
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.finalTotalIncome).toFixed(1)}`)
    .join(" ");
  const outflowPath = ordered
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.totalOutflow).toFixed(1)}`)
    .join(" ");
  const savedPath = ordered
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.cycleRetained).toFixed(1)}`)
    .join(" ");

  const firstNet = ordered[0].runningNet;
  const lastNet = ordered[ordered.length - 1].runningNet;
  const netDelta = lastNet - firstNet;

  return (
    <section className="rounded-lg border border-border bg-surface p-5 space-y-4 print-avoid-break">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle pb-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-delta-positive shrink-0" />
            <h3 className="text-sm font-semibold text-text-primary">
              {mode === "equity"
                ? "Cumulative Retained Capital Curve"
                : "Cycle-by-Cycle Cashflow Trajectory"}
            </h3>
            <span
              className={`font-mono text-xs font-semibold erp-tabular-currency ${
                netDelta >= 0 ? "text-delta-positive" : "text-delta-negative"
              }`}
            >
              {netDelta >= 0 ? "+" : ""}
              {formatRupiah(netDelta, isAmountsMasked)} across {ordered.length} periods
            </span>
          </div>
          <p className="text-xs text-text-tertiary mt-0.5">
            Track cumulative capital retained across closed and active cycles, or switch to income vs. total outflow curves.
          </p>
        </div>

        <div className="inline-flex rounded border border-border bg-canvas p-0.5 text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setMode("equity")}
            className={`px-2.5 py-1 rounded-sm cursor-pointer transition-colors ${
              mode === "equity"
                ? "bg-surface-active text-text-primary font-semibold"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Equity Curve
          </button>
          <button
            type="button"
            onClick={() => setMode("cashflow")}
            className={`px-2.5 py-1 rounded-sm cursor-pointer transition-colors ${
              mode === "cashflow"
                ? "bg-surface-active text-text-primary font-semibold"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Income vs Outflow
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-56 select-none"
          role="img"
          aria-label="Financial cashflow and cumulative capital curve"
        >
          <defs>
            <linearGradient id="erpEquityFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2BB686" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#2BB686" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = padT + frac * plotH;
            const tick = maxVal - frac * span;
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
                  {isAmountsMasked ? "•••" : `${(tick / 1000000).toFixed(1)}M`}
                </text>
              </g>
            );
          })}

          {mode === "equity" ? (
            <>
              {equityAreaPath && <path d={equityAreaPath} fill="url(#erpEquityFill)" />}
              <path
                d={equityPath}
                fill="none"
                stroke="#2BB686"
                strokeWidth="2.5"
              />
            </>
          ) : (
            <>
              <path
                d={incomePath}
                fill="none"
                stroke="#8A94A6"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
              <path
                d={outflowPath}
                fill="none"
                stroke="#E06C53"
                strokeWidth="2"
              />
              <path
                d={savedPath}
                fill="none"
                stroke="#2BB686"
                strokeWidth="2.5"
              />
            </>
          )}

          {ordered.map((pt, idx) => {
            const cx = toX(idx);
            const isSelected = idx === activeIdx;
            const primaryVal = mode === "equity" ? pt.runningNet : pt.cycleRetained;
            const cy = toY(primaryVal);
            return (
              <g
                key={`${pt.year}-${pt.month}`}
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
                className="cursor-pointer"
              >
                <rect
                  x={cx - 20}
                  y={padT}
                  width={40}
                  height={plotH}
                  fill="transparent"
                />
                {isSelected && (
                  <line
                    x1={cx}
                    x2={cx}
                    y1={padT}
                    y2={padT + plotH}
                    stroke="rgba(255,255,255,0.22)"
                    strokeDasharray="2 2"
                  />
                )}
                {mode === "cashflow" && (
                  <>
                    <circle cx={cx} cy={toY(pt.finalTotalIncome)} r={2.5} fill="#8A94A6" />
                    <circle cx={cx} cy={toY(pt.totalOutflow)} r={2.5} fill="#E06C53" />
                  </>
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 5 : 3}
                  fill="#2BB686"
                  stroke="#0f141c"
                  strokeWidth="1.5"
                />
                <text
                  x={cx}
                  y={svgH - 10}
                  textAnchor="middle"
                  className={`text-[9px] font-mono ${
                    isSelected ? "fill-white font-semibold" : "fill-[#7c8594]"
                  }`}
                >
                  {pt.periodLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Crosshair Readout Bar */}
      {active && (
        <div className="pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary">{active.periodLabel}</span>
            <span className="text-[10px] text-text-tertiary">
              ({active.status === "LOCKED" ? "Closed" : "Draft"})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <span>
              Inflow:{" "}
              <strong className="text-text-primary erp-tabular-currency">
                {formatRupiah(active.finalTotalIncome, isAmountsMasked)}
              </strong>
            </span>
            <span>
              Debt + Living:{" "}
              <strong className="text-delta-negative erp-tabular-currency">
                {formatRupiah(active.totalOutflow, isAmountsMasked)}
              </strong>
            </span>
            <span>
              Cycle Saved:{" "}
              <strong className="text-delta-positive erp-tabular-currency">
                {formatRupiah(active.cycleRetained, isAmountsMasked)}
              </strong>
            </span>
            <span>
              Cumulative:{" "}
              <strong className="text-text-primary erp-tabular-currency">
                {formatRupiah(active.runningNet, isAmountsMasked)}
              </strong>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
