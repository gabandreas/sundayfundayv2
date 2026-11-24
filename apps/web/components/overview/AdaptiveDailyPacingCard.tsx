"use client";

import React, { useEffect, useRef, useState } from "react";
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
  ShieldCheck,
} from "lucide-react";
import {
  DailyPacing,
  Transaction,
  WalletGuardStatusResponse,
  executeCashReconciliation,
  deleteFinanceTransaction,
  fetchWalletGuardStatus,
  evaluateWalletGuardApi,
} from "@/lib/api";
import { MiniTrendChart } from "@/components/primitives/MiniTrendChart";
import { formatRupiah, formatCurrencyInput } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePeriod } from "@/context/PeriodContext";

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
  const { isAmountsMasked } = usePrivacyMask();
  const { t } = useLanguage();
  const { revisionTick } = usePeriod();
  const formatIdr = (amount: number): string => formatRupiah(amount, isAmountsMasked);

  const remainingRoutineBillsPool =
    pacing?.fixedEssentialsRealization?.totalRemainingPool ?? 0;
  const remainingBudget = Math.max(
    0,
    pacing?.remainingBudget ?? totalOperationalBudget
  );
  const expectedTotalBankBalance = remainingBudget + remainingRoutineBillsPool;

  const [isWeightedMode, setIsWeightedMode] = useState<boolean>(true);
  const [bankBalanceInput, setBankBalanceInput] = useState<string>("");
  const [checkpointNote, setCheckpointNote] = useState<string>("");
  const [includesRoutineBills, setIncludesRoutineBills] = useState<boolean>(
    remainingRoutineBillsPool > 0
  );
  const [isSubmittingSync, setIsSubmittingSync] = useState<boolean>(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [walletGuardStatus, setWalletGuardStatus] =
    useState<WalletGuardStatusResponse | null>(null);
  const [isSavingGuard, setIsSavingGuard] = useState<boolean>(false);

  const [undoingTxId, setUndoingTxId] = useState<number | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState<boolean>(false);
  const walletInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWalletGuardStatus(month, year).then((res) => {
      if (!cancelled && res) {
        setWalletGuardStatus(res);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [month, year, revisionTick]);

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
    } catch (err: any) {
      setSyncError(err.message || "Failed to undo checkpoint");
    } finally {
      setUndoingTxId(null);
    }
  };

  const handleSaveWalletCheckIn = async () => {
    if (isLocked || isSavingGuard || parsedBankBalance === null) return;
    setIsSavingGuard(true);
    setSyncError(null);
    const res = await evaluateWalletGuardApi({
      month,
      year,
      actualWalletBalance: parsedBankBalance,
      reservedBillsTotal: includesRoutineBills
        ? walletGuardStatus?.settlementSummary.bankHoldNeeded ?? remainingRoutineBillsPool
        : 0,
      persist: true,
      note: checkpointNote.trim() || undefined,
    });
    setIsSavingGuard(false);
    if (!res) {
      setSyncError("Failed to save wallet check-in.");
      return;
    }
    setWalletGuardStatus(res);
    setSyncSuccess(true);
    setTimeout(() => setSyncSuccess(false), 2500);
  };

  const temporalState = pacing?.cycleTemporalState ?? "ACTIVE";
  const isPrePayday = temporalState === "PRE_PAYDAY";
  const isCompletedCycle = temporalState === "COMPLETED";
  const daysUntilStart = pacing?.daysUntilCycleStart ?? 0;
  const paceDeltaRp = pacing?.paceDeltaRp ?? 0;

  // Derived cycle telemetry strictly from existing snapshot/pacing inputs (updates cleanly from both manual spend and wallet balance syncs)
  const cycleDaysTotal = pacing?.daysInCycle ?? 30;
  const elapsedDays = Math.max(1, pacing?.currentDayIndex ?? 1);
  const totalSpentCycle = pacing?.totalDailySpent ?? 0;
  const cycleBudgetTotal = pacing?.totalOperationalBudget ?? totalOperationalBudget ?? 0;
  const avgDailyBurn = isPrePayday ? 0 : Math.round(totalSpentCycle / elapsedDays);
  const projectedCycleEndRemaining = isPrePayday
    ? cycleBudgetTotal
    : Math.round(cycleBudgetTotal - avgDailyBurn * cycleDaysTotal);
  const cycleUsedPct =
    cycleBudgetTotal > 0 ? Math.round((totalSpentCycle / cycleBudgetTotal) * 100) : 0;
  const cycleUsedBarPct = Math.min(100, Math.max(0, cycleUsedPct));
  const cycleElapsedPct = isPrePayday
    ? 0
    : isCompletedCycle
    ? 100
    : Math.min(100, Math.round((elapsedDays / Math.max(1, cycleDaysTotal)) * 100));
  const isBurnAheadOfSchedule = !isPrePayday && cycleUsedPct > cycleElapsedPct + 2;
  const cyclePaydayFormatted = pacing?.cycleStartDate
    ? new Date(`${pacing.cycleStartDate}T12:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      })
    : "";

  const statusVariant: "default" | "caution" | "urgency" =
    pacing?.pacingStatus === "DEFICIT_RISK" ||
    pacing?.pacingStatus === "BURNING_FAST"
      ? "urgency"
      : pacing?.pacingStatus === "CAUTION"
      ? "caution"
      : "default";

  const statusLabel = isPrePayday
    ? `${t("overview.startsInDays")} ${daysUntilStart} ${t("overview.daysUnit")} · Payday ${cyclePaydayFormatted}`
    : isCompletedCycle
    ? t("overview.cycleCompletedLabel")
    : pacing?.pacingStatus === "DEFICIT_RISK"
    ? t("overview.status.deficitRisk")
    : pacing?.pacingStatus === "BURNING_FAST"
    ? t("overview.status.burningFast")
    : pacing?.pacingStatus === "CAUTION"
    ? t("overview.status.caution")
    : t("overview.status.onTrack");

  return (
    <div className="rounded-lg border border-border bg-surface p-5 flex flex-col justify-between h-full space-y-4">
      {/* Top Header & Pacing Mode Toggle */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-text-tertiary font-sans">
              {isPrePayday
                ? t("overview.upcomingLivingPool")
                : isCompletedCycle
                ? t("overview.cycleCompletedLabel")
                : t("overview.safeToSpend")}
            </span>
            <span
              className={`whitespace-nowrap text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
 isPrePayday
 ?"bg-surface-subtle text-text-secondary border-border"
 : isCompletedCycle
 ?"bg-surface-subtle text-text-tertiary border-border-subtle"
 : statusVariant ==="urgency"
 ?"bg-urgency/15 text-urgency border-urgency/30"
 : statusVariant ==="caution"
 ?"bg-caution/15 text-caution border-caution/30"
 :"bg-positive/15 text-positive border-positive/30"
 }`}
            >
              {statusLabel}
            </span>
            {!isPrePayday && !isCompletedCycle && paceDeltaRp !== 0 && (
              <span
                className={`whitespace-nowrap text-[10px] font-mono px-2 py-0.5 rounded border ${
                  paceDeltaRp > 0
                    ? "bg-[rgba(16,183,141,0.08)] text-delta-positive border-[rgba(16,183,141,0.28)]"
                    : "bg-[rgba(229,155,44,0.08)] text-caution border-[rgba(229,155,44,0.28)]"
                }`}
              >
                {paceDeltaRp > 0 ? `+${formatIdr(paceDeltaRp)}` : `-${formatIdr(Math.abs(paceDeltaRp))}`}{" "}
                {paceDeltaRp > 0 ? t("overview.aheadOfPace") : t("overview.overPace")}
              </span>
            )}
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
        <div className="mt-2">
          <div className="whitespace-nowrap inline-flex items-baseline gap-2">
            <div className="font-serif text-[42px] leading-tight font-normal tracking-tight text-text-primary tabular-nums whitespace-nowrap">
              {isPrePayday
                ? formatIdr(pacing?.totalOperationalBudget ?? totalOperationalBudget)
                : isCompletedCycle
                ? formatIdr(remainingBudget)
                : formatIdr(displaySafeToday)}
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs font-sans text-text-tertiary">
            <span>
              {isPrePayday ? (
                <span>
                  <span className="font-mono text-text-primary tabular-nums font-semibold">
                    Day 0
                  </span>{" "}
                  of {pacing?.daysInCycle ?? 31} · {t("overview.prePaydayPlan")}
                </span>
              ) : isCompletedCycle ? (
                <span>
                  <span className="font-mono text-text-primary tabular-nums font-semibold">
                    {pacing?.daysInCycle ?? 30}
                  </span>{" "}
                  / {pacing?.daysInCycle ?? 30} days
                </span>
              ) : (
                <span>
                  <span className="font-mono text-text-primary tabular-nums font-semibold">
                    {pacing?.daysRemaining ?? 30}
                  </span>{" "}
                  {t("overview.daysLeft")}
                </span>
              )}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-text-tertiary whitespace-nowrap">
              {pacing?.cycleDateLabel || "Payday to Payday"}
            </span>
          </div>

          <div className="text-xs font-sans text-text-tertiary mt-1.5">
            {isPrePayday ? (
              <span>
                {formatIdr(pacing?.totalDailySpent ?? 0)} spent · Starts{" "}
                <strong className="text-text-secondary font-mono">{cyclePaydayFormatted || "on payday"}</strong> ·{" "}
                {t("overview.projectedDailyRate")}:{" "}
                <strong className="text-text-secondary font-mono">{formatIdr(weekdayRate)}/day</strong> weekday /{" "}
                <strong className="text-text-secondary font-mono">{formatIdr(weekendRate)}/day</strong> weekend
              </span>
            ) : isCompletedCycle ? (
              <span>
                Final remaining operational balance ({pacing?.daysInCycle ?? 30} of {pacing?.daysInCycle ?? 30} days completed)
              </span>
            ) : isWeightedMode ? (
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

        {isPrePayday && daysUntilStart > 0 && (
          <div className="mt-2.5 px-3 py-1.5 rounded border border-border-subtle bg-surface-subtle flex items-center justify-between gap-2 text-[11px] text-text-secondary">
            <span>
              <strong className="font-mono text-text-primary">{daysUntilStart}</strong>{" "}
              {t("overview.bridgeUntilPayday")}
            </span>
            <button
              type="button"
              onClick={() => walletInputRef.current?.focus()}
              className="font-mono text-[10px] text-accent hover:underline shrink-0 cursor-pointer"
            >
              Wallet Check-In -&gt;
            </button>
          </div>
        )}

        {/* 3 Runway Metric Strip */}
        <div className="grid grid-cols-3 divide-x divide-border-subtle border-y border-border-subtle py-2.5 mt-3">
          <div className="pr-2.5 min-w-0">
            <span className="text-[11px] text-text-tertiary font-sans block truncate">
              {t("overview.weekdayRate")}
            </span>
            <span className="erp-tabular-currency text-xs font-semibold text-text-primary mt-0.5 block">
              {formatIdr(weekdayRate)}
              <span className="text-[10px] font-normal text-text-tertiary">{t("overview.perDay")}</span>
            </span>
          </div>

          <div className="px-2.5 min-w-0">
            <span className="text-[11px] text-text-tertiary font-sans block truncate">
              {t("overview.weekendRate")}
            </span>
            <span className="erp-tabular-currency text-xs font-semibold text-text-primary mt-0.5 block">
              {formatIdr(weekendRate)}
              <span className="text-[10px] font-normal text-text-tertiary">{t("overview.perDay")}</span>
            </span>
          </div>

          <div className="pl-2.5 min-w-0">
            <span className="text-[11px] text-text-tertiary font-sans block truncate">
              7-Day Runway
            </span>
            <span className="erp-tabular-currency text-xs font-semibold text-accent mt-0.5 block">
              {formatIdr(rollingEnvelope)}
            </span>
          </div>
        </div>

        {/* MiniTrendChart */}
        <div className="mt-2.5">
          <MiniTrendChart
            daysInCycle={pacing?.daysInCycle ?? 30}
            currentDay={pacing?.currentDayIndex ?? 0}
            targetDailyBudget={pacing?.baselineDailyRate ?? 135000}
            statusVariant={statusVariant}
            cycleTemporalState={temporalState}
            daysUntilCycleStart={daysUntilStart}
            cycleStartDate={pacing?.cycleStartDate}
            cycleEndDate={pacing?.cycleEndDate}
          />
        </div>

        {/* Budget & Spend Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-sans text-text-secondary pt-1.5">
          <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
            <span>{t("overview.spentLabel")}:</span>
            <strong className="erp-tabular-currency text-text-primary">
              {formatIdr(totalSpentCycle)}
            </strong>
          </span>
          <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
            <span>{t("overview.remainingCash")}:</span>
            <strong className="erp-tabular-currency text-text-primary">
              {formatIdr(remainingBudget)}
            </strong>
          </span>
        </div>

        {/* Cycle Pace & Burn Forecast (Works zero-friction with both manual logs and Wallet Sync) */}
        <div
          data-testid="cycle-pace-breakdown"
          className="mt-3.5 pt-3.5 border-t border-border-subtle space-y-2.5"
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px] font-sans">
              <span className="text-text-tertiary whitespace-nowrap">
                {isPrePayday
                  ? t("overview.cycleReadiness")
                  : t("overview.cycleBudgetUsed")}
              </span>
              <span className="erp-tabular-currency text-text-primary font-medium whitespace-nowrap">
                {isPrePayday
                  ? `${formatIdr(cycleBudgetTotal)} · ${cycleDaysTotal}d`
                  : `${cycleUsedPct}% ${t("overview.usedLabel")} · ${cycleElapsedPct}% ${t("overview.elapsedLabel")}`}
              </span>
            </div>
            <div className="relative h-1.5 w-full rounded-full bg-surface-subtle">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isPrePayday
                    ? "bg-border-strong"
                    : cycleUsedPct >= 100
                    ? "bg-urgency"
                    : isBurnAheadOfSchedule
                    ? "bg-caution"
                    : "bg-delta-positive"
                }`}
                style={{
                  width: isPrePayday ? "100%" : `${cycleUsedBarPct}%`,
                }}
              />
              {!isPrePayday && !isCompletedCycle && (
                <div
                  aria-hidden="true"
                  title="Elapsed cycle timeline"
                  style={{ left: `${cycleElapsedPct}%` }}
                  className="absolute -top-0.5 -bottom-0.5 w-[2px] -ml-[1px] rounded-full bg-text-primary/80"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="min-w-0">
              <span className="text-[11px] text-text-tertiary font-sans block truncate">
                {t("overview.avgDailyBurn")}
              </span>
              <span className="erp-tabular-currency text-xs font-semibold text-text-primary mt-0.5 block">
                {formatIdr(avgDailyBurn)}
                <span className="text-[10px] font-normal text-text-tertiary">{t("overview.perDay")}</span>
              </span>
              <span className="text-[10px] font-mono text-text-tertiary truncate block">
                vs {formatIdr(pacing?.baselineDailyRate ?? 0)} {t("overview.baselineLabel")}
              </span>
            </div>

            <div className="min-w-0 text-right">
              <span className="text-[11px] text-text-tertiary font-sans block truncate">
                {t("overview.projectedCycleEnd")}
              </span>
              <span
                className={`erp-tabular-currency text-xs font-semibold mt-0.5 block ${
                  projectedCycleEndRemaining >= 0 ? "text-delta-positive" : "text-caution"
                }`}
              >
                {projectedCycleEndRemaining >= 0
                  ? `+${formatIdr(projectedCycleEndRemaining)}`
                  : `-${formatIdr(Math.abs(projectedCycleEndRemaining))}`}
              </span>
              <span className="text-[10px] font-sans text-text-tertiary truncate block">
                {t("overview.atCurrentPace")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet & Spendable Cash Reconciliation */}
      <div className="pt-3.5 border-t border-border-subtle space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-text-tertiary font-sans">
            Wallet Reconciliation
          </span>
        </div>

        {/* Expected Bank Decomposition Strip */}
        <div className="grid grid-cols-3 divide-x divide-border-subtle py-2 border-y border-border-subtle text-[11px]">
          <div className="pr-2 min-w-0">
            <span className="text-text-tertiary block font-sans truncate">Living Cash</span>
            <span className="erp-tabular-currency font-semibold text-text-primary mt-0.5 block">
              {formatIdr(remainingBudget)}
            </span>
          </div>
          <div className="px-2 min-w-0">
            <span className="text-text-tertiary block font-sans truncate">+ Unpaid Bills</span>
            <span className="erp-tabular-currency font-semibold text-delta-positive mt-0.5 block">
              {formatIdr(remainingRoutineBillsPool)}
            </span>
          </div>
          <div className="pl-2 text-right min-w-0">
            <span className="text-text-tertiary block font-sans truncate">Expected Bank</span>
            <span className="erp-tabular-currency font-semibold text-text-primary mt-0.5 block">
              {formatIdr(expectedTotalBankBalance)}
            </span>
          </div>
        </div>

        {/* Comparison Mode Toggle */}
        {remainingRoutineBillsPool > 0 && (
          <div className="grid grid-cols-2 gap-1 p-0.5 rounded bg-surface-subtle border border-border-subtle text-[10px] font-sans">
            <button
              type="button"
              onClick={() => setIncludesRoutineBills(true)}
              className={`px-2 py-1 rounded transition-colors cursor-pointer truncate ${
                includesRoutineBills
                  ? "bg-surface-hover text-text-primary font-medium"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Total Bank ({formatIdr(expectedTotalBankBalance).replace("Rp ", "")})
            </button>
            <button
              type="button"
              onClick={() => setIncludesRoutineBills(false)}
              className={`px-2 py-1 rounded transition-colors cursor-pointer truncate ${
                !includesRoutineBills
                  ? "bg-surface-hover text-text-primary font-medium"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Living Cash Only ({formatIdr(remainingBudget).replace("Rp ", "")})
            </button>
          </div>
        )}

        {syncError && (
          <div className="p-2 rounded bg-urgency/10 border border-urgency/30 text-urgency text-[11px]">
            {syncError}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Bank balance input */}
          <div className="flex-1 min-w-0">
            <input
              ref={walletInputRef}
              type="text"
              disabled={isLocked || isSubmittingSync}
              value={bankBalanceInput}
              onChange={(e) => setBankBalanceInput(formatCurrencyInput(e.target.value))}
              placeholder={
                includesRoutineBills ? "Bank Rp" : "Cash Rp"
              }
              className={`w-full px-2.5 py-1.5 rounded bg-surface-subtle border font-mono text-xs text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 disabled:opacity-50 ${
                isSpike
                  ? "border-caution focus:border-caution"
                  : "border-border-default focus:border-text-secondary"
              }`}
            />
          </div>

          {/* Sync & Wallet Guard Check-In Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isLocked || isSavingGuard || parsedBankBalance === null}
              onClick={handleSaveWalletCheckIn}
              title="Persist actual wallet check-in for Survival Guard tracking"
              className="px-2.5 py-1.5 rounded text-[11px] font-mono border border-border-default bg-canvas text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-3 h-3" />
              {isSavingGuard ? "..." : "Guard"}
            </button>
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
              className="justify-center px-2.5 py-1.5 rounded text-xs font-medium bg-surface-hover border border-border-default text-text-primary hover:border-text-secondary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {isSubmittingSync ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Syncing
                </>
              ) : syncSuccess ? (
                <>
                  <Check className="w-3 h-3 text-delta-positive" />
                  Synced
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3" />
                  {t("overview.syncBalance")}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Persisted Real-Time Survival Guard Strip */}
        {walletGuardStatus?.guard && (
          <div className="p-2.5 rounded border border-border-subtle bg-canvas/70 space-y-1 text-[11px] font-mono tabular-nums">
            <div className="flex items-center justify-between gap-2">
              <span className="text-text-tertiary">
                Free Cash: <strong className="text-text-primary">{formatIdr(walletGuardStatus.guard.freeSpendableCash)}</strong>
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-medium ${
                  walletGuardStatus.guard.guardStatus === "SURVIVAL_GUARD"
                    ? "bg-urgency/15 text-urgency"
                    : walletGuardStatus.guard.guardStatus === "WATCH"
                      ? "bg-caution/15 text-caution"
                      : "bg-delta-positive/15 text-delta-positive"
                }`}
              >
                {walletGuardStatus.guard.guardStatus === "SURVIVAL_GUARD"
                  ? "Survival Guard"
                  : walletGuardStatus.guard.guardStatus === "WATCH"
                    ? "Watch"
                    : "Safe"}
              </span>
            </div>
            <div className="text-[10px] font-sans text-text-secondary">
              {walletGuardStatus.guard.guidance}
            </div>
          </div>
        )}

        {/* Live Variance & Post-Sync Preview */}
        {balanceDiff !== null && effectiveActualCash !== null && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] px-2 py-1.5 rounded bg-surface-subtle/60 border border-border-subtle">
            <span className="font-mono text-text-secondary tabular-nums">
              New Living Cash:{" "}
              <strong className="text-text-primary">{formatIdr(effectiveActualCash)}</strong>
            </span>
            <span
              className={`font-mono text-[10px] px-2 py-0.5 rounded font-medium tabular-nums inline-flex items-center gap-1 ${
                balanceDiff === 0
                  ? "bg-delta-positive/10 text-delta-positive border border-delta-positive/30"
                  : isSpike
                  ? "bg-urgency/15 text-urgency border border-urgency/30"
                  : balanceDiff < 0
                  ? "bg-caution/10 text-caution border border-caution/30"
                  : "bg-delta-positive/10 text-delta-positive border border-delta-positive/30"
              }`}
            >
              {balanceDiff === 0 ? (
                "Matches System (Rp 0 diff)"
              ) : isSpike ? (
                <>
                  <AlertTriangle className="w-3 h-3" />
                  Spike ({spikeRatio}x limit · {formatIdr(balanceDiff)})
                </>
              ) : balanceDiff < 0 ? (
                <>
                  <ArrowDownRight className="w-3 h-3" />
                  {formatIdr(balanceDiff)}
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-3 h-3" />
                  +{formatIdr(balanceDiff)}
                </>
              )}
            </span>
          </div>
        )}

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
              className={`w-full px-2.5 py-1.5 rounded bg-surface-subtle border text-xs text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 ${
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
                                ? `Spike (${(tx.amount / (displaySafeToday || 1)).toFixed(1)}x)`
                                : tx.type === "DEDUCTION"
                                ? "Normal"
                                : "Correction"}
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
