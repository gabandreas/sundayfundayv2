"use client";

import React, { useEffect, useState } from "react";
import { X, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  CutoffSimulateResponse,
  LiabilityMatrixResponse,
  CreditLimitCalculationResult,
  createLineItem,
  createCardCharge,
  simulateCutoffApi,
} from "@/lib/api";
import {
  formatRupiah,
  formatCurrencyInput,
  parseCurrencyInput,
  getJakartaDateParts,
} from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

interface SafeSpendSimulatorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  matrix: LiabilityMatrixResponse;
  currentMonth: number;
  currentYear: number;
  limitData?: CreditLimitCalculationResult | null;
}

export function SafeSpendSimulatorPanel({
  isOpen,
  onClose,
  matrix,
  currentMonth,
  currentYear,
  limitData = null,
}: SafeSpendSimulatorPanelProps) {
  const { isAmountsMasked } = usePrivacyMask();

  const currentColIdx = Math.max(
    0,
    matrix.columns.findIndex((c) => c.month === currentMonth && c.year === currentYear)
  );
  const horizonCols = matrix.columns.slice(currentColIdx, currentColIdx + 4);

  const [description, setDescription] = useState("Planned Purchase");
  const [principalRaw, setPrincipalRaw] = useState("500.000");
  const [instrument, setInstrument] = useState<"PAYLATER" | "CREDIT_CARD" | "SPINJAM" | "CASH">(
    "PAYLATER"
  );
  const [tenor, setTenor] = useState<number>(3);
  const [purchaseDate, setPurchaseDate] = useState(() => getJakartaDateParts().isoDate);
  const [holdPastCutoff, setHoldPastCutoff] = useState(false);
  const [windfallRaw, setWindfallRaw] = useState("0");
  const [windfallColKey, setWindfallColKey] = useState(
    horizonCols[1]?.key ?? horizonCols[0]?.key ?? ""
  );
  const [cutoffAdvice, setCutoffAdvice] = useState<CutoffSimulateResponse | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);

  const principal = parseCurrencyInput(principalRaw);
  const windfall = parseCurrencyInput(windfallRaw);

  useEffect(() => {
    if (!isOpen || principal <= 0) {
      setCutoffAdvice(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const apiInst =
        instrument === "PAYLATER"
          ? "SPAYLATER"
          : instrument === "CREDIT_CARD"
            ? "CREDIT_CARD"
            : instrument === "SPINJAM"
              ? "SPINJAM"
              : "CASH";
      const res = await simulateCutoffApi({
        title: description.trim() || "Planned Purchase",
        instrument: apiInst,
        amountMode: "PRINCIPAL_SPLIT",
        principalAmount: principal,
        tenorMonths: instrument === "CASH" ? 1 : tenor,
        purchaseDate,
        holdPastCutoff,
      });
      if (!cancelled && res) {
        setCutoffAdvice(res);
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, description, principal, instrument, tenor, purchaseDate, holdPastCutoff]);

  if (!isOpen) return null;

  const formatRp = (val: number) => formatRupiah(val, isAmountsMasked);
  const startOffset =
    cutoffAdvice !== null
      ? Math.max(
          0,
          horizonCols.findIndex(
            (c) =>
              c.month === cutoffAdvice.startPeriodMonth &&
              c.year === cutoffAdvice.startPeriodYear
          )
        )
      : holdPastCutoff
        ? 1
        : 0;

  const incomeBaseline = limitData?.ceilingBreakdown.totalIncome ?? 0;

  const projectedRows = horizonCols.map((col) => {
    const baseline = matrix.totalsPerMonth[col.key] ?? 0;
    const matchedSlice = cutoffAdvice?.slices.find(
      (s) => s.periodMonth === col.month && s.periodYear === col.year
    );
    const fallbackMonthly =
      instrument === "CASH" || principal <= 0
        ? 0
        : Math.round(principal / Math.max(1, tenor));
    const purchaseImpact =
      instrument === "CASH"
        ? 0
        : matchedSlice
          ? matchedSlice.amount
          : 0;
    const windfallOffset = col.key === windfallColKey && windfall > 0 ? windfall : 0;
    const simulatedTotal = Math.max(
      0,
      baseline + (cutoffAdvice ? purchaseImpact : fallbackMonthly > 0 ? purchaseImpact : 0) - windfallOffset
    );
    const estRatio =
      incomeBaseline > 0 ? Math.round((simulatedTotal / incomeBaseline) * 1000) / 10 : null;

    return {
      col,
      baseline,
      purchaseImpact,
      windfallOffset,
      simulatedTotal,
      estRatio,
      sliceBadge: matchedSlice?.sliceBadge,
    };
  });

  const handleCommit = async () => {
    if (principal <= 0 || instrument === "CASH") return;
    const targetM = cutoffAdvice?.startPeriodMonth ?? horizonCols[startOffset]?.month ?? currentMonth;
    const targetY = cutoffAdvice?.startPeriodYear ?? horizonCols[startOffset]?.year ?? currentYear;

    setIsCommitting(true);
    setCommitMessage(null);

    if (instrument === "PAYLATER" || instrument === "SPINJAM") {
      const res = await createLineItem({
        title: description.trim() || "Simulated Purchase",
        category: instrument === "SPINJAM" ? "PERSONAL_DEBT" : "PAYLATER",
        merchantOrPlatform: instrument === "SPINJAM" ? "SPinjam" : "SPayLater",
        totalAmount: principal,
        amountMode: "PRINCIPAL_SPLIT",
        tenorMonths: tenor,
        startMonth: targetM,
        startYear: targetY,
        purchaseDate: new Date(purchaseDate).toISOString(),
        autoRouteByCutoff: true,
        holdPastCutoff,
        cutoffDay: instrument === "PAYLATER" ? 15 : 8,
        dueDay: instrument === "PAYLATER" ? 25 : 8,
      });
      setIsCommitting(false);
      if (!res.success) {
        setCommitMessage(res.error || "Failed to commit item.");
        return;
      }
      setCommitMessage(`Committed to matrix starting ${cutoffAdvice?.startPeriodLabel ?? `${targetM}/${targetY}`}.`);
    } else {
      const res = await createCardCharge({
        label: description.trim() || "Simulated Card Purchase",
        amount: principal,
        chargeType: tenor > 1 ? "INSTALLMENT" : "FULL",
        category: "Planned Spend",
        tenor,
        monthlyAmount: cutoffAdvice?.monthlySliceFirst ?? Math.round(principal / tenor),
        transactionDate: new Date(purchaseDate).toISOString(),
      });
      setIsCommitting(false);
      if (!res.success) {
        setCommitMessage(res.error || "Failed to commit Credit Card charge.");
        return;
      }
      setCommitMessage(`Committed card charge starting ${cutoffAdvice?.startPeriodLabel ?? `${targetM}/${targetY}`}.`);
    }
  };

  const verdictStyle =
    cutoffAdvice?.verdict === "OVER_LIMIT"
      ? "border-urgency/50 bg-urgency/10 text-urgency"
      : cutoffAdvice?.verdict === "WAIT_PAST_CUTOFF" || cutoffAdvice?.verdict === "CAUTION"
        ? "border-caution/50 bg-caution/10 text-caution"
        : "border-delta-positive/40 bg-[rgba(16,183,141,0.08)] text-delta-positive";

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex items-start justify-between pb-3 border-b border-border-subtle">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary">
            Can I Afford This? · Pre-Purchase Cutoff Simulator
          </h3>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Simulates SPayLater 15th &amp; Credit Card 20th cutoffs, DSR impact, and optimal buy timing before committing.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded border border-border-subtle text-text-tertiary hover:text-text-primary hover:bg-surface-hover cursor-pointer"
          aria-label="Close simulator"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        <div className="lg:col-span-3 space-y-1">
          <label className="text-[10px] font-mono uppercase text-text-tertiary">
            Planned Item
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 text-xs font-sans text-text-primary"
          />
        </div>

        <div className="lg:col-span-2 space-y-1">
          <label className="text-[10px] font-mono uppercase text-text-tertiary">
            Amount (Rp)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={principalRaw}
            onChange={(e) => setPrincipalRaw(formatCurrencyInput(e.target.value))}
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-text-primary"
          />
        </div>

        <div className="lg:col-span-3 space-y-1">
          <label className="text-[10px] font-mono uppercase text-text-tertiary">
            Instrument
          </label>
          <div className="grid grid-cols-4 gap-1">
            {(["PAYLATER", "CREDIT_CARD", "SPINJAM", "CASH"] as const).map((inst) => (
              <button
                key={inst}
                type="button"
                onClick={() => setInstrument(inst)}
                className={`py-1.5 rounded border text-[10px] font-mono transition-colors cursor-pointer ${
                  instrument === inst
                    ? "bg-surface-active border-text-secondary text-text-primary font-semibold"
                    : "bg-canvas border-border text-text-secondary hover:bg-surface-hover"
                }`}
              >
                {inst === "PAYLATER"
                  ? "SPay"
                  : inst === "CREDIT_CARD"
                    ? "CC"
                    : inst === "SPINJAM"
                      ? "Loan"
                      : "Cash"}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-1">
          <label className="text-[10px] font-mono uppercase text-text-tertiary">Tenor</label>
          <div className="grid grid-cols-4 gap-1">
            {[1, 3, 6, 12].map((t) => (
              <button
                key={t}
                type="button"
                disabled={instrument === "CASH"}
                onClick={() => setTenor(t)}
                className={`py-1.5 rounded border text-[10px] font-mono transition-colors cursor-pointer disabled:opacity-40 ${
                  tenor === t
                    ? "bg-surface-active border-text-secondary text-text-primary font-semibold"
                    : "bg-canvas border-border text-text-secondary hover:bg-surface-hover"
                }`}
              >
                {t}x
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-1">
          <label className="text-[10px] font-mono uppercase text-text-tertiary">
            Purchase Date
          </label>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="w-full bg-canvas border border-border rounded px-2 py-1 text-xs font-mono text-text-primary"
          />
        </div>
      </div>

      {/* Live Cutoff Advice Banner */}
      {cutoffAdvice && (
        <div className={`p-3 rounded-lg border flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${verdictStyle}`}>
          <div className="flex items-start gap-2.5">
            {cutoffAdvice.verdict === "WAIT_PAST_CUTOFF" ? (
              <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            ) : cutoffAdvice.verdict === "OVER_LIMIT" ? (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <div className="text-xs font-mono font-semibold flex flex-wrap items-center gap-2">
                <span>VERDICT: {cutoffAdvice.verdict.replace(/_/g, " ")}</span>
                <span>·</span>
                <span>{cutoffAdvice.routingSummary}</span>
              </div>
              <div className="text-xs font-sans">{cutoffAdvice.advice}</div>
              <div className="text-[10px] font-mono opacity-85 tabular-nums">
                DSR: {cutoffAdvice.dsrBeforePercent}% → {cutoffAdvice.dsrAfterPercent}% (Next cycle: {cutoffAdvice.nextDsrAfterPercent}%) · First Slice: {formatRp(cutoffAdvice.monthlySliceFirst)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setHoldPastCutoff((prev) => !prev)}
              className="px-2.5 py-1 rounded border border-current/40 bg-canvas/50 text-[11px] font-mono hover:bg-canvas transition-colors cursor-pointer"
            >
              {holdPastCutoff ? "Revert to Purchase Date" : "Simulate Hold Past Cutoff (+1 Cycle)"}
            </button>
          </div>
        </div>
      )}

      {/* Windfall / THR Prepayment Offset */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-3 rounded border border-border-subtle bg-surface-subtle">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <span className="text-[10px] font-mono uppercase text-text-tertiary whitespace-nowrap">
            Windfall / THR Offset:
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={windfallRaw}
            onChange={(e) => setWindfallRaw(formatCurrencyInput(e.target.value))}
            placeholder="0"
            className="w-32 bg-canvas border border-border rounded px-2 py-1 text-xs font-mono tabular-nums text-text-primary"
          />
          <select
            value={windfallColKey}
            onChange={(e) => setWindfallColKey(e.target.value)}
            className="bg-canvas border border-border rounded px-2 py-1 text-xs font-mono text-text-primary"
          >
            {horizonCols.map((c) => (
              <option key={c.key} value={c.key}>
                Apply to {c.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={isCommitting || principal <= 0 || instrument === "CASH"}
          onClick={handleCommit}
          className="w-full lg:w-auto px-3.5 py-1.5 rounded bg-text-primary text-canvas text-xs font-sans font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40"
        >
          {isCommitting ? "Committing..." : "Commit Purchase to Matrix"}
        </button>
      </div>

      {commitMessage && (
        <div className="text-xs font-mono text-delta-positive">{commitMessage}</div>
      )}

      {/* Horizon Projection Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {projectedRows.map((row) => {
          const isOverSafe = row.estRatio !== null && row.estRatio > 35;
          const isOverOptimal = row.estRatio !== null && row.estRatio > 20 && !isOverSafe;
          return (
            <div
              key={row.col.key}
              className="p-3 rounded border border-border bg-canvas space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-semibold text-text-primary">
                  {row.col.label}
                </span>
                {row.estRatio !== null && (
                  <span
                    className={`text-[10px] font-mono tabular-nums ${
                      isOverSafe
                        ? "text-urgency"
                        : isOverOptimal
                        ? "text-caution"
                        : "text-delta-positive"
                    }`}
                  >
                    {row.estRatio}% ratio
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-text-tertiary">
                <span>{row.col.paysDueMonth}</span>
                {row.sliceBadge && (
                  <span className="text-text-secondary font-semibold">{row.sliceBadge}</span>
                )}
              </div>
              <div className="pt-1 border-t border-border-subtle space-y-0.5 text-[11px] font-mono tabular-nums">
                <div className="flex justify-between text-text-tertiary">
                  <span>Baseline</span>
                  <span>{formatRp(row.baseline)}</span>
                </div>
                {row.purchaseImpact > 0 && (
                  <div className="flex justify-between text-delta-negative">
                    <span>Simulated</span>
                    <span>+{formatRp(row.purchaseImpact)}</span>
                  </div>
                )}
                {row.windfallOffset > 0 && (
                  <div className="flex justify-between text-delta-positive">
                    <span>Windfall</span>
                    <span>-{formatRp(row.windfallOffset)}</span>
                  </div>
                )}
                <div className="flex justify-between text-text-primary font-semibold pt-0.5">
                  <span>Projected Due</span>
                  <span>{formatRp(row.simulatedTotal)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
