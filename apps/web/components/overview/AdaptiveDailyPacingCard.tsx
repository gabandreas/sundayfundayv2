"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  DailyPacing,
  Transaction,
  executeCashReconciliation,
  deleteFinanceTransaction,
} from "@/lib/api";
import { MiniTrendChart } from "@/components/primitives/MiniTrendChart";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { InlinePrivacyEye } from "../shell/InlinePrivacyEye";

interface AdaptiveDailyPacingCardProps {
  pacing: DailyPacing | null;
  month: number;
  year: number;
  isLocked: boolean;
  totalOperationalBudget: number;
  transactions?: Transaction[];
}

function formatIdr(amount: number): string {
  return formatRupiah(amount);
}

function formatTimestamp(dateStr?: string | Date): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const day = d.getDate();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthName = months[d.getMonth()];
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${monthName}, ${hours}:${mins}`;
}

export function AdaptiveDailyPacingCard({
  pacing,
  month,
  year,
  isLocked,
  totalOperationalBudget,
  transactions = [],
}: AdaptiveDailyPacingCardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { isAmountsMasked, openVerifyModal } = usePrivacyMask();

  const [isWeightedMode, setIsWeightedMode] = useState<boolean>(true);
  const [bankBalanceInput, setBankBalanceInput] = useState<string>("");
  const [checkpointNote, setCheckpointNote] = useState<string>("");
  const [includesRoutineBills, setIncludesRoutineBills] = useState<boolean>(false);
  const [isSubmittingSync, setIsSubmittingSync] = useState<boolean>(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [undoingTxId, setUndoingTxId] = useState<number | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState<boolean>(false);

  const remainingRoutineBillsPool =
    pacing?.fixedEssentialsRealization?.totalRemainingPool ?? 0;
  const remainingBudget = pacing?.remainingBudget ?? totalOperationalBudget;

  const parsedBankBalance = bankBalanceInput
    ? Math.max(0, parseInt(bankBalanceInput.replace(/\D/g, ""), 10) || 0)
    : null;

  const effectiveActualCash =
    parsedBankBalance !== null
      ? includesRoutineBills
        ? Math.max(0, parsedBankBalance - remainingRoutineBillsPool)
        : parsedBankBalance
      : null;

  const balanceDiff =
    effectiveActualCash !== null ? effectiveActualCash - remainingBudget : null;

  const displaySafeToday = isWeightedMode
    ? pacing?.weightedSafeToSpendToday ?? pacing?.safeToSpendToday ?? 0
    : pacing?.safeToSpendToday ?? 0;

  const weekdayRate = pacing?.weekdaySafeRate ?? pacing?.safeToSpendToday ?? 0;
  const weekendRate =
    pacing?.weekendSafeRate ?? Math.round((pacing?.safeToSpendToday ?? 0) * 1.5);
  const rollingEnvelope = pacing?.rollingWeeklyEnvelope ?? displaySafeToday * 7;

  // Spike Detector Logic
  const isSpike =
    balanceDiff !== null &&
    balanceDiff < 0 &&
    displaySafeToday > 0 &&
    Math.abs(balanceDiff) > 2 * displaySafeToday;

  const spikeRatio =
    balanceDiff !== null && displaySafeToday > 0
      ? (Math.abs(balanceDiff) / displaySafeToday).toFixed(1)
      : "1.0";

  // Checkpoint Transactions in this Cycle
  const checkpointTransactions = transactions
    .filter(
      (t) =>
        t.label?.includes("Balance Checkpoint") ||
        t.label?.includes("Cash Balance Reconciliation") ||
        t.label?.includes("Unitemized daily operational spend") ||
        t.label?.includes("Operational wallet correction") ||
        t.label?.includes("Operational Balance Correction")
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt || b.date).getTime() -
        new Date(a.createdAt || a.date).getTime()
    );

  const spikesCount = checkpointTransactions.filter(
    (t) =>
      t.type === "DEDUCTION" &&
      displaySafeToday > 0 &&
      t.amount > 2 * displaySafeToday
  ).length;

  const netUnitemizedBurn = checkpointTransactions.reduce((acc, t) => {
    if (t.type === "DEDUCTION") return acc + t.amount;
    if (t.type === "INCOME") return acc - t.amount;
    return acc;
  }, 0);

  const handleSyncWallet = async () => {
    if (
      isLocked ||
      isSubmittingSync ||
      parsedBankBalance === null ||
      balanceDiff === null ||
      balanceDiff === 0
    ) {
      return;
    }

    setIsSubmittingSync(true);
    setSyncError(null);

    const defaultNote =
      balanceDiff < 0
        ? isSpike
          ? `High Burn Spike (${spikeRatio}x daily limit)`
          : "Unitemized daily operational spend"
        : "Operational wallet correction";

    const noteToSubmit = checkpointNote.trim() || defaultNote;

    try {
      const res = await executeCashReconciliation({
        month,
        year,
        actualRealBalance: parsedBankBalance,
        includesUnspentRoutinePool: includesRoutineBills,
        surplusResolutionMode: "RECORD_OPERATIONAL_REFUND",
        note: noteToSubmit,
      });

      if (!res.success) {
        setSyncError(res.error || "Failed to synchronize balance");
        setIsSubmittingSync(false);
        return;
      }

      setSyncSuccess(true);
      setBankBalanceInput("");
      setCheckpointNote("");
      setTimeout(() => setSyncSuccess(false), 2500);

      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setSyncError(err.message || "Failed to synchronize balance");
    } finally {
      setIsSubmittingSync(false);
    }
  };

  const handleUndoCheckpoint = async (txId: number) => {
    if (isLocked || undoingTxId !== null) return;

    setUndoingTxId(txId);
    setSyncError(null);

    try {
      const res = await deleteFinanceTransaction(txId);
      if (!res.success) {
        setSyncError(res.error || "Failed to undo balance checkpoint");
        setUndoingTxId(null);
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setSyncError(err.message || "Failed to undo checkpoint");
    } finally {
      setUndoingTxId(null);
    }
  };

  const statusVariant: "default" | "caution" | "urgency" =
    pacing?.pacingStatus === "DEFICIT_RISK" ||
    pacing?.pacingStatus === "BURNING_FAST"
      ? "urgency"
      : pacing?.pacingStatus === "CAUTION"
      ? "caution"
      : "default";

  const statusLabel =
    pacing?.pacingStatus === "DEFICIT_RISK"
      ? "DEFICIT RISK"
      : pacing?.pacingStatus === "BURNING_FAST"
      ? "BURNING FAST"
      : pacing?.pacingStatus === "CAUTION"
      ? "CAUTION"
      : "ON TRACK";

  return (
    <div className="rounded-lg border border-border bg-surface p-5 flex flex-col justify-between h-full space-y-4">
      {/* Top Header & Pacing Mode Toggle */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
              SAFE-TO-SPEND TODAY
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
                statusVariant === "urgency"
                  ? "bg-urgency/15 text-urgency border border-urgency/30"
                  : statusVariant === "caution"
                  ? "bg-caution/15 text-caution border border-caution/30"
                  : "bg-positive/15 text-positive border border-positive/30"
              }`}
            >
              {statusLabel}
            </span>
          </div>

          {/* Mode Switcher */}
          <div className="inline-flex items-center p-0.5 rounded bg-surface-subtle border border-border-subtle text-[10px] font-medium font-sans">
            <button
              type="button"
              onClick={() => setIsWeightedMode(true)}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                isWeightedMode
                  ? "bg-surface-elevated text-text-primary shadow-xs font-semibold"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Weighted 1.5x
            </button>
            <button
              type="button"
              onClick={() => setIsWeightedMode(false)}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                !isWeightedMode
                  ? "bg-surface-elevated text-text-primary shadow-xs font-semibold"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Flat Daily
            </button>
          </div>
        </div>

        {/* Centerpiece Number (Newsreader Serif Display Signature) */}
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div
                onClick={isAmountsMasked ? openVerifyModal : undefined}
                title={
                  isAmountsMasked
                    ? "Click to verify password & reveal figures"
                    : undefined
                }
                className={`font-serif text-[42px] leading-tight font-normal tracking-tight text-text-primary tabular-nums ${
                  isAmountsMasked
                    ? "cursor-pointer hover:text-emerald-300 transition-colors"
                    : ""
                }`}
              >
                {formatIdr(displaySafeToday)}
              </div>
              {isAmountsMasked && <InlinePrivacyEye size="lg" />}
            </div>
            <div className="text-xs font-sans text-text-tertiary mt-0.5">
              {isWeightedMode ? (
                pacing?.isWeekendToday ? (
                  <span>
                    Sat–Sun rate:{" "}
                    <strong className="text-text-secondary font-mono">
                      {formatIdr(weekendRate)}/day
                    </strong>{" "}
                    (1.5x weekend)
                  </span>
                ) : (
                  <span>
                    Mon–Fri rate:{" "}
                    <strong className="text-text-secondary font-mono">
                      {formatIdr(weekdayRate)}/day
                    </strong>{" "}
                    (standard weekday)
                  </span>
                )
              ) : (
                <span>
                  Target:{" "}
                  <strong className="text-text-secondary font-mono">
                    {formatIdr(pacing?.baselineDailyRate ?? 0)}/day
                  </strong>{" "}
                  (flat baseline)
                </span>
              )}
            </div>
          </div>

          <div className="text-right text-xs font-sans text-text-tertiary">
            <div>
              <span className="font-mono text-text-primary tabular-nums font-semibold">
                {pacing?.daysRemaining ?? 30}
              </span>{" "}
              days left
            </div>
            <div className="text-[11px] font-mono tabular-nums text-text-tertiary mt-0.5">
              Cycle: {pacing?.cycleDateLabel || "Payday to Payday"}
            </div>
          </div>
        </div>

        {/* 3 Runway Metric Badges */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-border-subtle">
          <div className="p-2 rounded bg-surface-subtle border border-border-subtle">
            <span className="text-[10px] text-text-tertiary uppercase font-sans block">
              Weekday Safe Rate
            </span>
            <span className="font-mono text-xs font-semibold text-text-primary tabular-nums mt-0.5 block">
              {formatIdr(weekdayRate)}
              <span className="text-[10px] font-normal text-text-tertiary">
                /day
              </span>
            </span>
          </div>

          <div className="p-2 rounded bg-surface-subtle border border-border-subtle">
            <span className="text-[10px] text-text-tertiary uppercase font-sans block">
              Weekend Safe Rate
            </span>
            <span className="font-mono text-xs font-semibold text-text-primary tabular-nums mt-0.5 block">
              {formatIdr(weekendRate)}
              <span className="text-[10px] font-normal text-text-tertiary">
                /day
              </span>
            </span>
          </div>

          <div className="p-2 rounded bg-surface-subtle border border-border-subtle">
            <span className="text-[10px] text-text-tertiary uppercase font-sans block">
              7-Day Runway
            </span>
            <span className="font-mono text-xs font-semibold text-accent tabular-nums mt-0.5 block">
              {formatIdr(rollingEnvelope)}
            </span>
          </div>
        </div>

        {/* MiniTrendChart */}
        <div className="mt-2.5">
          <MiniTrendChart
            daysInCycle={pacing?.daysInCycle ?? 30}
            currentDay={pacing?.currentDayIndex ?? 1}
            targetDailyBudget={pacing?.baselineDailyRate ?? 135000}
            statusVariant={statusVariant}
          />
        </div>

        {/* Budget & Spend Summary */}
        <div className="flex items-center justify-between text-xs font-sans text-text-secondary pt-1.5">
          <span>
            Spent:{" "}
            <strong className="font-mono text-text-primary tabular-nums">
              {formatIdr(pacing?.totalDailySpent ?? 0)}
            </strong>
          </span>
          <span>
            Remaining Living Cash:{" "}
            <strong className="font-mono text-text-primary tabular-nums">
              {formatIdr(remainingBudget)}
            </strong>
          </span>
        </div>
      </div>

      {/* 10-Second Balance Checkpoint with Live Behavioral Spike Detector */}
      <div className="pt-3.5 border-t border-border-subtle space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            10-Second Balance Checkpoint
          </span>
          <span className="text-[10px] text-text-tertiary font-sans">
            Instant wallet sync
          </span>
        </div>

        {syncError && (
          <div className="p-2 rounded bg-urgency/10 border border-urgency/30 text-urgency text-[11px]">
            {syncError}
          </div>
        )}

        <div className="grid grid-cols-12 gap-2 items-center">
          {/* Bank balance input */}
          <div className="col-span-6">
            <input
              type="text"
              disabled={isLocked || isSubmittingSync}
              value={bankBalanceInput}
              onChange={(e) => setBankBalanceInput(e.target.value)}
              placeholder="Bank balance (IDR)..."
              className={`w-full px-2.5 py-1.5 rounded bg-surface-subtle border font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none disabled:opacity-50 ${
                isSpike
                  ? "border-caution focus:border-caution"
                  : "border-border focus:border-text-secondary"
              }`}
            />
          </div>

          {/* Sync Button */}
          <div className="col-span-6 flex items-center gap-1.5 justify-end">
            <button
              type="button"
              disabled={
                isLocked ||
                isSubmittingSync ||
                parsedBankBalance === null ||
                balanceDiff === null ||
                balanceDiff === 0
              }
              onClick={handleSyncWallet}
              className="px-3 py-1.5 rounded text-xs font-medium bg-surface-elevated border border-border text-text-primary hover:border-text-secondary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 shrink-0"
            >
              {isSubmittingSync ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Syncing...
                </>
              ) : syncSuccess ? (
                <>
                  <Check className="w-3 h-3 text-positive" />
                  Synced!
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3" />
                  Sync Balance
                </>
              )}
            </button>
          </div>
        </div>

        {/* Checkbox for unspent routine pool */}
        <div className="flex items-center justify-between text-[11px]">
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-text-secondary">
            <input
              type="checkbox"
              checked={includesRoutineBills}
              onChange={(e) => setIncludesRoutineBills(e.target.checked)}
              className="rounded border-border bg-surface-subtle text-accent focus:ring-0"
            />
            <span>
              My bank balance includes remaining Routine Bills (+{formatIdr(remainingRoutineBillsPool)})
            </span>
          </label>

          {/* Live Diff Pill */}
          {balanceDiff !== null && (
            <span
              className={`font-mono text-[10px] px-2 py-0.5 rounded font-medium tabular-nums inline-flex items-center gap-1 ${
                balanceDiff === 0
                  ? "bg-positive/10 text-positive border border-positive/30"
                  : isSpike
                  ? "bg-urgency/15 text-urgency border border-urgency/30"
                  : balanceDiff < 0
                  ? "bg-caution/10 text-caution border border-caution/30"
                  : "bg-positive/10 text-positive border border-positive/30"
              }`}
            >
              {balanceDiff === 0 ? (
                "Matches System (Rp 0 diff)"
              ) : isSpike ? (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  HIGH BURN SPIKE ({spikeRatio}x daily limit)
                </>
              ) : balanceDiff < 0 ? (
                <>
                  <ArrowDownRight className="w-3 h-3" />
                  NORMAL BURN (-{formatIdr(Math.abs(balanceDiff))})
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-3 h-3" />
                  UPWARD CORRECTION (+{formatIdr(balanceDiff)})
                </>
              )}
            </span>
          )}
        </div>

        {/* Context-Aware Note Input for Spike or Correction */}
        {balanceDiff !== null && balanceDiff !== 0 && (
          <div className="pt-1">
            <input
              type="text"
              value={checkpointNote}
              onChange={(e) => setCheckpointNote(e.target.value)}
              placeholder={
                isSpike
                  ? "What caused this spike? (e.g. Futsal, Weekend Hangout, GrabFood)..."
                  : balanceDiff > 0
                  ? "Reason for upward adjustment (e.g. Typo fix, Refund, Transfer in)..."
                  : "Optional note (e.g. Unrecorded coffee / snacks)..."
              }
              className={`w-full px-2.5 py-1.5 rounded bg-surface-subtle border text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none ${
                isSpike
                  ? "border-caution focus:border-caution"
                  : "border-border focus:border-text-secondary"
              }`}
            />
          </div>
        )}

        {/* Collapsible Checkpoint & Burn Audit Trail */}
        <div className="pt-2 border-t border-border-subtle/70">
          <button
            type="button"
            onClick={() => setShowAuditTrail((prev) => !prev)}
            className="w-full flex items-center justify-between text-[11px] text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer py-1"
          >
            <span className="font-sans font-medium">
              Checkpoint & Burn Audit Trail ({checkpointTransactions.length})
            </span>
            <div className="flex items-center gap-1">
              <span className="font-mono text-[10px]">
                Burn: {formatIdr(netUnitemizedBurn)}
              </span>
              {showAuditTrail ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </div>
          </button>

          {showAuditTrail && (
            <div className="mt-2 space-y-2 pt-1 border-t border-border-subtle/50 text-[11px]">
              <div className="text-[10px] text-text-tertiary font-mono flex items-center justify-between">
                <span>Checkpoints: {checkpointTransactions.length}</span>
                <span>Spikes (&gt;2x): {spikesCount}</span>
                <span>Net Burn: {formatIdr(netUnitemizedBurn)}</span>
              </div>

              {checkpointTransactions.length === 0 ? (
                <div className="text-[11px] text-text-tertiary py-2 text-center font-sans">
                  No balance checkpoints recorded this cycle.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {checkpointTransactions.map((tx, idx) => {
                    const isTxSpike =
                      tx.type === "DEDUCTION" &&
                      displaySafeToday > 0 &&
                      tx.amount > 2 * displaySafeToday;
                    const cleanNote = tx.label
                      .replace(/^Balance Checkpoint:\s*/i, "")
                      .replace(/^Cash Balance Reconciliation:\s*/i, "");

                    const isMostRecent = idx === 0;

                    return (
                      <div
                        key={tx.id}
                        className="p-2 rounded bg-surface-subtle border border-border-subtle flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-text-tertiary">
                              {formatTimestamp(tx.createdAt || tx.date)}
                            </span>
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-medium ${
                                isTxSpike
                                  ? "bg-urgency/15 text-urgency border border-urgency/30"
                                  : tx.type === "DEDUCTION"
                                  ? "bg-surface text-text-secondary border border-border"
                                  : "bg-positive/15 text-positive border border-positive/30"
                              }`}
                            >
                              {isTxSpike
                                ? `SPIKE (${(tx.amount / (displaySafeToday || 1)).toFixed(1)}x)`
                                : tx.type === "DEDUCTION"
                                ? "NORMAL"
                                : "CORRECTION"}
                            </span>
                          </div>
                          <div className="text-[11px] text-text-primary truncate font-sans mt-0.5">
                            {cleanNote}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`font-mono text-xs font-semibold tabular-nums ${
                              tx.type === "DEDUCTION"
                                ? "text-text-primary"
                                : "text-positive"
                            }`}
                          >
                            {tx.type === "DEDUCTION" ? "-" : "+"}
                            {formatIdr(tx.amount)}
                          </span>

                          {!isLocked && isMostRecent && (
                            <button
                              type="button"
                              disabled={undoingTxId === tx.id}
                              onClick={() => handleUndoCheckpoint(tx.id)}
                              title="Undo last checkpoint"
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-border hover:border-urgency text-text-tertiary hover:text-urgency transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                            >
                              {undoingTxId === tx.id ? (
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <RotateCcw className="w-2.5 h-2.5" />
                              )}
                              Undo
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
