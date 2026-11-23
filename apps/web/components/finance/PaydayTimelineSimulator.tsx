"use client";

import React, { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { TimelineSimulateResponse, simulateTimelineApi } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

interface PaydayTimelineSimulatorProps {
  month: number;
  year: number;
}

const SPLIT_PRESETS = [0, 500_000, 1_000_000, 1_500_000];

export function PaydayTimelineSimulator({ month, year }: PaydayTimelineSimulatorProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const formatRp = (v: number) => formatRupiah(v, isAmountsMasked);

  const [earlyPayAmount, setEarlyPayAmount] = useState<number>(1_500_000);
  const [timeline, setTimeline] = useState<TimelineSimulateResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(async () => {
      const res = await simulateTimelineApi({
        month,
        year,
        spaylaterEarlyPayAmount: earlyPayAmount,
      });
      if (!cancelled) {
        if (res) {
          setTimeline(res);
        }
        setIsLoading(false);
      }
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [month, year, earlyPayAmount]);

  const maxPaylater = timeline?.baseline.paylaterDue ?? 0;
  const effectiveMaxSlider = Math.max(1_500_000, maxPaylater);

  return (
    <section className="rounded-lg border border-border bg-surface p-5 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-3 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-text-secondary" />
            <h3 className="text-sm font-semibold font-sans text-text-primary">
              Payday &amp; THR Split-Bill Planner
            </h3>
          </div>
          <p className="text-xs font-sans text-text-secondary mt-1">
            Stress-test Wave 1 salary arrival through the 21-day holiday bridge to Wave 2 THR and SPayLater maturity.
          </p>
        </div>

        {/* Early Split-Pay Simulator Controls */}
        <div className="flex flex-col items-start lg:items-end gap-1.5 shrink-0">
          <div className="text-[10px] font-mono text-text-tertiary">
            SPayLater Wave 1 Early Split-Pay
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {SPLIT_PRESETS.map((preset) => {
              const clamped = maxPaylater > 0 ? Math.min(preset, maxPaylater) : preset;
              const active = earlyPayAmount === clamped;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEarlyPayAmount(clamped)}
                  className={`px-2 py-1 rounded border text-[11px] font-mono tabular-nums transition-colors cursor-pointer ${
                    active
                      ? "bg-surface-active border-text-secondary text-text-primary font-semibold"
                      : "bg-canvas border-border text-text-secondary hover:bg-surface-hover"
                  }`}
                >
                  {preset === 0 ? "Rp 0" : `${(preset / 1000).toLocaleString("id-ID")}k`}
                </button>
              );
            })}
            {maxPaylater > 0 && (
              <button
                type="button"
                onClick={() => setEarlyPayAmount(maxPaylater)}
                className={`px-2 py-1 rounded border text-[11px] font-mono transition-colors cursor-pointer ${
                  earlyPayAmount === maxPaylater
                    ? "bg-surface-active border-text-secondary text-text-primary font-semibold"
                    : "bg-canvas border-border text-text-secondary hover:bg-surface-hover"
                }`}
              >
                Full
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Slider bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-text-secondary tabular-nums">
          <span>
            Early Set-Aside on Wave 1:{" "}
            <strong className="text-text-primary">
              {formatRp(timeline?.spaylaterEarlyPayApplied ?? earlyPayAmount)}
            </strong>
          </span>
          <span>
            Deferred to Wave 2 (25th):{" "}
            <strong className="text-text-primary">
              {formatRp(timeline?.spaylaterRemainingAfterEarly ?? Math.max(0, maxPaylater - earlyPayAmount))}
            </strong>
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={effectiveMaxSlider}
          step={50_000}
          value={Math.min(earlyPayAmount, effectiveMaxSlider)}
          onChange={(e) => setEarlyPayAmount(Number(e.target.value))}
          className="w-full accent-[#10b78d] cursor-pointer"
        />
      </div>

      {isLoading && !timeline ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs font-mono text-text-tertiary">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Simulating multi-wave liquidity timeline...
        </div>
      ) : timeline ? (
        <>
          {/* Bridge KPI Strip */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-3 rounded border border-border-subtle bg-canvas p-3 space-y-1">
              <div className="text-[10px] font-mono text-text-tertiary">
                Wave 1 Paycheck Inflow
              </div>
              <div className="font-mono text-base font-semibold tabular-nums text-text-primary">
                {formatRp(timeline.baseline.paycheckAmount)}
              </div>
              <div className="text-[10px] font-mono text-text-tertiary">
                {timeline.baseline.thrAmount > 0
                  ? `+ Wave 2 THR: ${formatRp(timeline.baseline.thrAmount)}`
                  : "Single payroll wave"}
              </div>
            </div>

            <div className="lg:col-span-3 rounded border border-border-subtle bg-canvas p-3 space-y-1">
              <div className="text-[10px] font-mono text-text-tertiary">
                21-Day Bridge Min Cash
              </div>
              <div
                className={`font-mono text-base font-semibold tabular-nums ${
                  timeline.bridgeSafe ? "text-delta-positive" : "text-urgency"
                }`}
              >
                {formatRp(timeline.preThrBridgeMinimumBalance)}
              </div>
              <div className="text-[10px] font-mono text-text-tertiary">
                Lowest cash point before Dec 18
              </div>
            </div>

            <div className="lg:col-span-3 rounded border border-border-subtle bg-canvas p-3 space-y-1">
              <div className="text-[10px] font-mono text-text-tertiary">
                Post-THR Liquidity
              </div>
              <div className="font-mono text-base font-semibold tabular-nums text-text-primary">
                {formatRp(timeline.postThrBalance)}
              </div>
              <div className="text-[10px] font-mono text-text-tertiary">
                Post-PayLater (25th): {formatRp(timeline.postPaylaterRemainingBalance)}
              </div>
            </div>

            <div
              className={`lg:col-span-3 rounded border p-3 flex items-start gap-2 ${
                timeline.bridgeSafe
                  ? "border-delta-positive/30 bg-[rgba(16,183,141,0.06)] text-delta-positive"
                  : "border-urgency/40 bg-urgency/10 text-urgency"
              }`}
            >
              {timeline.bridgeSafe ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div className="text-[11px] font-sans leading-snug">
                {timeline.bridgeRiskMessage}
              </div>
            </div>
          </div>

          {timeline.baseline.thrAmount > 0 && (
            <div className="rounded border border-border-subtle bg-canvas px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-mono text-text-tertiary">
                  Net Remaining THR for Dec/Jan Cycle (12/2026)
                </div>
                <div className="text-xs font-sans text-text-secondary mt-0.5">
                  Total Dec 18 THR ({formatRp(timeline.baseline.thrAmount)}) minus Dec 25 deferred SPayLater settlement ({formatRp(timeline.spaylaterRemainingAfterEarly)}) — no cross-cycle double counting.
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-base font-semibold tabular-nums text-delta-positive whitespace-nowrap">
                  {formatRp(Math.max(0, timeline.baseline.thrAmount - timeline.spaylaterRemainingAfterEarly))}
                </div>
                <div className="text-[10px] font-mono text-text-tertiary whitespace-nowrap">
                  Net carry-forward to 12/2026 Savings &amp; Surplus
                </div>
              </div>
            </div>
          )}

          {/* Chronological Wave Ledger Table */}
          <div className="overflow-x-auto border border-border-subtle rounded-lg">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-subtle/60 text-[10px] font-mono text-text-tertiary">
                  <th className="py-2 px-3 text-left">Date</th>
                  <th className="py-2 px-3 text-left">Wave</th>
                  <th className="py-2 px-3 text-left">Event</th>
                  <th className="py-2 px-3 text-right">Cash Delta</th>
                  <th className="py-2 px-3 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle font-mono text-[11px] tabular-nums">
                {timeline.events.map((ev) => {
                  const isNegBal = ev.runningBalance < 0;
                  return (
                    <tr
                      key={`${ev.sequence}-${ev.dateIso}-${ev.label}`}
                      className={ev.isBridgeWindow ? "bg-surface-active/10" : "hover:bg-surface-hover/20"}
                    >
                      <td className="py-2 px-3 text-text-secondary whitespace-nowrap">
                        {ev.dateIso}
                      </td>
                      <td className="py-2 px-3 text-[10px] text-text-tertiary whitespace-nowrap">
                        {ev.waveGroup.replace("_", " ")}
                      </td>
                      <td className="py-2 px-3 font-sans text-xs text-text-primary">
                        {ev.label}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-medium ${
                          ev.signedAmount >= 0 ? "text-delta-positive" : "text-text-secondary"
                        }`}
                      >
                        {ev.signedAmount >= 0 ? "+" : "-"}
                        {formatRp(Math.abs(ev.signedAmount))}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-semibold ${
                          isNegBal ? "text-urgency" : "text-text-primary"
                        }`}
                      >
                        {formatRp(ev.runningBalance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
