"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Lock,
  Unlock,
  RefreshCw,
  ArrowRight,
  Wallet,
} from "lucide-react";
import {
  GlobalConfig,
  LiabilityLineItemDto,
  MonthlySnapshot,
  PayrollResult,
  SavingsInstrumentType,
  SavingsOverviewResult,
  closeSnapshot,
  confirmPeriodDeposit,
  fetchGlobalConfig,
  fetchLineItems,
  fetchPayroll,
  fetchSavingsOverview,
  fetchSnapshot,
  getCached,
  recalculateSnapshot,
  setCached,
  settleBulkLineItems,
  toggleLineItemSettled,
} from "@/lib/api";
import { usePeriodSlice } from "@/hooks/usePeriodSlice";
import { usePeriod } from "@/context/PeriodContext";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useToast } from "@/context/ToastContext";
import { formatRupiah } from "@/lib/utils";
import { PageHeader } from "@/components/primitives/PageHeader";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";

export interface PaydayWizardData {
  snapshot: MonthlySnapshot | null;
  prevSnapshot: MonthlySnapshot | null;
  payroll: PayrollResult | null;
  lineItems: LiabilityLineItemDto[];
  savingsOverview: SavingsOverviewResult | null;
  config: GlobalConfig | null;
}

interface PaydayWizardClientProps {
  initialMonth: number;
  initialYear: number;
  initialData: PaydayWizardData;
}

const MONTH_SHORT = [
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

function getPreviousPeriod(month: number, year: number): { month: number; year: number } {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

export function PaydayWizardClient({
  initialMonth,
  initialYear,
  initialData,
}: PaydayWizardClientProps) {
  const { refreshPeriod } = usePeriod();
  const { isAmountsMasked } = usePrivacyMask();
  const { toast } = useToast();
  const formatRp = (val: number) => formatRupiah(val, isAmountsMasked);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [localConfirmedByPeriod, setLocalConfirmedByPeriod] = useState<Record<string, number>>({});

  const { month, year, data, isPreBoundary } = usePeriodSlice<PaydayWizardData>({
    initialMonth,
    initialYear,
    initialData,
    seedCache: (m, y, d) => {
      if (d.snapshot) setCached(`snapshot:${m}:${y}`, d.snapshot);
      if (d.payroll) setCached(`payroll:${m}:${y}`, d.payroll);
      if (d.savingsOverview) setCached("savings:overview", d.savingsOverview);
      if (d.config) setCached("globalConfig", d.config);
      setCached(`lineItems:${m}:${y}`, d.lineItems);
    },
    readFromCache: (m, y) => {
      const prev = getPreviousPeriod(m, y);
      const snapshot = getCached<MonthlySnapshot | null>(`snapshot:${m}:${y}`);
      const prevSnapshot = getCached<MonthlySnapshot | null>(`snapshot:${prev.month}:${prev.year}`);
      const payroll = getCached<PayrollResult | null>(`payroll:${m}:${y}`);
      const savingsOverview = getCached<SavingsOverviewResult | null>("savings:overview");
      const config = getCached<GlobalConfig | null>("globalConfig");
      const lineItems = getCached<LiabilityLineItemDto[]>(`lineItems:${m}:${y}`);
      if (
        snapshot === undefined ||
        prevSnapshot === undefined ||
        payroll === undefined ||
        savingsOverview === undefined ||
        config === undefined ||
        lineItems === undefined
      ) {
        return undefined;
      }
      return { snapshot, prevSnapshot, payroll, lineItems, savingsOverview, config };
    },
    fetchForPeriod: async (m, y) => {
      const prev = getPreviousPeriod(m, y);
      const [snapshot, prevSnapshot, payroll, lineItems, savingsOverview, config] =
        await Promise.all([
          fetchSnapshot(m, y),
          fetchSnapshot(prev.month, prev.year),
          fetchPayroll(m, y),
          fetchLineItems({ month: m, year: y }),
          fetchSavingsOverview(),
          fetchGlobalConfig(),
        ]);
      return {
        snapshot,
        prevSnapshot,
        payroll,
        lineItems: Array.isArray(lineItems) ? lineItems : [],
        savingsOverview,
        config,
      };
    },
  });

  if (isPreBoundary) {
    return <PreBoundaryNotice month={month} year={year} />;
  }

  const { snapshot, prevSnapshot, payroll, lineItems, savingsOverview, config } = data;
  const periodKey = `${year}-${month}`;
  const periodLabel = `${MONTH_SHORT[(month - 1) % 12]} '${String(year).slice(2)}`;
  const prevPeriod = getPreviousPeriod(month, year);
  const prevLabel = `${MONTH_SHORT[(prevPeriod.month - 1) % 12]} '${String(prevPeriod.year).slice(2)}`;

  const totalLineItemsRp = useMemo(
    () => lineItems.reduce((s, li) => s + Number(li.monthlyAmount ?? 0), 0),
    [lineItems],
  );
  const settledLineItemsRp = useMemo(
    () => lineItems.filter((li) => li.isSettled).reduce((s, li) => s + Number(li.monthlyAmount ?? 0), 0),
    [lineItems],
  );
  const unsettledCount = lineItems.filter((li) => !li.isSettled).length;
  const isCycleLocked = snapshot?.status === "LOCKED";

  // 4-step readiness checks (deposit status hydrated from persisted DB accumulationLedger)
  const step1Done = Boolean(snapshot && (snapshot.finalTotalIncome ?? 0) > 0);
  const step2Done = !prevSnapshot || prevSnapshot.status === "LOCKED";
  const step3Done = lineItems.length === 0 || unsettledCount === 0;
  const plannedP1Savings = Math.max(0, Math.round(snapshot?.actualSavings ?? 0));
  const ledgerRow = savingsOverview?.accumulationLedger?.find(
    (item) => item.month === month && item.year === year,
  );
  const persistedConfirmed = Boolean(
    ledgerRow &&
      plannedP1Savings > 0 &&
      (ledgerRow.isFullyDeposited || ledgerRow.depositedAmount >= plannedP1Savings),
  );
  const localConfirmedAmount = localConfirmedByPeriod[periodKey];
  const recordedDepositRp = Math.max(
    localConfirmedAmount ?? 0,
    ledgerRow?.depositedAmount ?? 0,
  );
  const isDepositConfirmed =
    plannedP1Savings === 0 ||
    isCycleLocked ||
    persistedConfirmed ||
    localConfirmedAmount !== undefined;
  const step4Done = isDepositConfirmed;
  const completedSteps = [step1Done, step2Done, step3Done, step4Done].filter(Boolean).length;
  const depositInstrument: SavingsInstrumentType =
    config?.studioConfig?.enableExternalAssetPortfolio ? "INVESTMENT_RDPU" : "LIQUID_CASH";

  const notifyAction = (ok: boolean, text: string) => {
    setStatusMessage({ ok, text });
    toast({
      title: ok ? "Payday & Closing" : "Payday Action Failed",
      description: text,
      variant: ok ? "success" : "error",
    });
  };

  const handleRecalculate = async () => {
    if (!snapshot) return;
    setBusyAction("recalc");
    setStatusMessage(null);
    const res = await recalculateSnapshot(snapshot.id);
    setBusyAction(null);
    if (res.success) {
      notifyAction(true, `${periodLabel} payroll & budget allocation recalculated.`);
      refreshPeriod();
    } else {
      notifyAction(false, res.error || "Failed to recalculate period.");
    }
  };

  const handleLockPrevious = async () => {
    if (!prevSnapshot) return;
    setBusyAction("lock-prev");
    setStatusMessage(null);
    const res = await closeSnapshot(prevSnapshot.id);
    setBusyAction(null);
    if (res.success) {
      notifyAction(true, `Previous cycle ${prevLabel} closed and locked.`);
      refreshPeriod();
    } else {
      notifyAction(false, res.error || `Failed to lock ${prevLabel}.`);
    }
  };

  const handleToggleItem = async (item: LiabilityLineItemDto) => {
    setBusyAction(`item:${item.id}`);
    setStatusMessage(null);
    const res = await toggleLineItemSettled(item.id, !item.isSettled);
    setBusyAction(null);
    if (res.success) {
      notifyAction(
        true,
        `${item.title} marked as ${!item.isSettled ? "settled" : "unsettled"}.`,
      );
      refreshPeriod();
    } else {
      notifyAction(false, res.error || "Failed to update bill status.");
    }
  };

  const handleSettleAll = async () => {
    setBusyAction("settle-all");
    setStatusMessage(null);
    const res = await settleBulkLineItems({ month, year, isSettled: true });
    setBusyAction(null);
    if (res.success) {
      notifyAction(
        true,
        `Marked all ${periodLabel} liability items as settled (${res.data?.updatedCount ?? 0} updated).`,
      );
      refreshPeriod();
    } else {
      notifyAction(false, res.error || "Failed to settle bills.");
    }
  };

  const handleConfirmP1Deposit = async () => {
    if (plannedP1Savings <= 0 || isDepositConfirmed) return;
    setBusyAction("confirm-p1");
    setStatusMessage(null);
    const res = await confirmPeriodDeposit({
      month,
      year,
      amount: plannedP1Savings,
      instrumentType: depositInstrument,
    });
    setBusyAction(null);
    if (res.success) {
      const confirmedRp = res.confirmedAmount ?? plannedP1Savings;
      setLocalConfirmedByPeriod((prev) => ({ ...prev, [periodKey]: confirmedRp }));
      const msg = res.alreadyConfirmed
        ? `Savings deposit already recorded for ${periodLabel} (${formatRp(confirmedRp)}).`
        : `Confirmed ${formatRp(confirmedRp)} savings deposit for ${periodLabel}.`;
      notifyAction(true, msg);
      refreshPeriod();
    } else {
      notifyAction(false, res.error || "Failed to confirm savings deposit.");
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full pb-16">
      <PageHeader
        title="4-Step Paycycle Activation Checklist"
        subtitle="Confirm take-home pay, lock the prior cycle, settle fixed obligations, and release daily living cashflow."
        periodLabel={periodLabel}
        rightActions={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] font-mono text-text-tertiary">
                Checklist Progress
              </div>
              <div className="font-display text-2xl text-text-primary tabular-nums">
                {completedSteps} / 4 Steps
              </div>
            </div>
            <Link
              href={`/?month=${month}&year=${year}`}
              className="erp-btn-secondary inline-flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium"
            >
              <span>Open Overview</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        }
      />

      {statusMessage && (
        <div
          className={`px-4 py-2.5 rounded border text-xs font-mono ${
            statusMessage.ok
              ? "border-delta-positive/40 bg-[rgba(16,183,141,0.08)] text-delta-positive"
              : "border-urgency/40 bg-[rgba(255,56,56,0.08)] text-urgency"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* 4 Guided Steps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* STEP 1: CONFIRM PAYCHECK & WORKING DAYS */}
        <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              {step1Done ? (
                <CheckCircle2 className="w-4 h-4 text-delta-positive shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-text-tertiary shrink-0" />
              )}
              <div>
                <div className="text-[10px] font-mono text-text-tertiary">Step 1</div>
                <h2 className="text-sm font-semibold text-text-primary">
                  Confirm Paycheck &amp; Working Days ({periodLabel})
                </h2>
              </div>
            </div>
            <Link
              href={`/payroll?month=${month}&year=${year}`}
              className="text-[11px] font-mono text-text-secondary hover:text-text-primary hover:underline"
            >
              Edit Payroll
            </Link>
          </div>

          <div className="grid grid-cols-2 divide-x divide-border-subtle border-y border-border-subtle py-2.5 text-xs">
            <div className="pr-3">
              <div className="text-[10px] font-mono text-text-tertiary">Final Net Income</div>
              <div className="font-mono text-base font-semibold text-text-primary mt-1 tabular-nums">
                {formatRp(snapshot?.finalTotalIncome ?? 0)}
              </div>
            </div>
            <div className="pl-3">
              <div className="text-[10px] font-mono text-text-tertiary">Working Days &amp; Payout</div>
              <div className="font-mono text-base font-semibold text-text-primary mt-1 tabular-nums">
                {snapshot?.totalWorkingDays ?? payroll?.totalWorkingDays ?? 0}d ·{" "}
                {snapshot?.payrollPayoutDate
                  ? snapshot.payrollPayoutDate.slice(0, 10)
                  : "Scheduled"}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-text-tertiary">
              {isCycleLocked
                ? "Cycle locked - calculations frozen."
                : "Verify attendance days and THR/bonus adjustments before paying bills."}
            </span>
            <button
              type="button"
              disabled={!snapshot || isCycleLocked || busyAction === "recalc"}
              onClick={() => void handleRecalculate()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-canvas hover:bg-surface-hover text-xs font-mono text-text-primary disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${busyAction === "recalc" ? "animate-spin" : ""}`} />
              <span>Recalculate</span>
            </button>
          </div>
        </section>

        {/* STEP 2: LOCK PREVIOUS PERIOD */}
        <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              {step2Done ? (
                <Lock className="w-4 h-4 text-delta-positive shrink-0" />
              ) : (
                <Unlock className="w-4 h-4 text-caution shrink-0" />
              )}
              <div>
                <div className="text-[10px] font-mono text-text-tertiary">Step 2</div>
                <h2 className="text-sm font-semibold text-text-primary">
                  Close &amp; Lock Prior Cycle ({prevLabel})
                </h2>
              </div>
            </div>
            <span className="text-[11px] font-mono text-text-tertiary">
              {prevSnapshot ? prevSnapshot.status : "PRE-HISTORY"}
            </span>
          </div>

          {prevSnapshot ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 divide-x divide-border-subtle border-y border-border-subtle py-2.5 text-xs">
                <div className="pr-3">
                  <div className="text-[10px] font-mono text-text-tertiary">{prevLabel} Funded P1</div>
                  <div className="font-mono text-sm font-semibold text-delta-positive mt-1 tabular-nums">
                    {formatRp(prevSnapshot.actualSavings ?? 0)}
                  </div>
                </div>
                <div className="pl-3">
                  <div className="text-[10px] font-mono text-text-tertiary">{prevLabel} Living Pool</div>
                  <div className="font-mono text-sm font-semibold text-text-primary mt-1 tabular-nums">
                    {formatRp(prevSnapshot.actualDailyOperational ?? 0)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-text-tertiary">
                  {prevSnapshot.status === "LOCKED"
                    ? `${prevLabel} is cleanly finalized and archived.`
                    : `Lock ${prevLabel} to freeze historical numbers and roll surplus forward.`}
                </span>
                {prevSnapshot.status !== "LOCKED" && (
                  <button
                    type="button"
                    disabled={busyAction === "lock-prev"}
                    onClick={() => void handleLockPrevious()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded erp-btn-primary text-xs font-mono font-medium hover:opacity-90 disabled:opacity-40 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{busyAction === "lock-prev" ? "Locking..." : `Lock ${prevLabel}`}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-text-tertiary py-4">
              No prior open snapshot before {periodLabel}. Prior cycle closing step complete.
            </div>
          )}
        </section>

        {/* STEP 3: SETTLE MANDATORY DUE-DATE BILLS */}
        <section className="rounded-lg border border-border bg-surface p-5 space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              {step3Done ? (
                <CheckCircle2 className="w-4 h-4 text-delta-positive shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-caution shrink-0" />
              )}
              <div>
                <div className="text-[10px] font-mono text-text-tertiary">Step 3</div>
                <h2 className="text-sm font-semibold text-text-primary">
                  Settle Mandatory Due-Date Bills ({lineItems.length - unsettledCount}/{lineItems.length} settled)
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs font-mono text-text-secondary tabular-nums">
                Settled: <strong className="text-text-primary">{formatRp(settledLineItemsRp)}</strong> /{" "}
                {formatRp(totalLineItemsRp)}
              </div>
              {unsettledCount > 0 && !isCycleLocked && (
                <button
                  type="button"
                  disabled={busyAction === "settle-all"}
                  onClick={() => void handleSettleAll()}
                  className="px-3 py-1.5 rounded erp-btn-primary text-xs font-mono font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {busyAction === "settle-all" ? "Settling..." : `Settle All (${unsettledCount})`}
                </button>
              )}
            </div>
          </div>

          {lineItems.length === 0 ? (
            <div className="text-xs text-text-tertiary py-4">
              No itemized PayLater or Personal Debt line items recorded for {periodLabel}.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
              {lineItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded border text-xs ${
                    item.isSettled
                      ? "border-delta-positive/30 bg-[rgba(16,183,141,0.05)]"
                      : "border-border-subtle bg-surface-subtle/30"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-text-primary truncate">{item.title}</div>
                    <div className="text-[10px] font-mono text-text-tertiary mt-0.5">
                      {item.category.replace(/_/g, " ")}
                      {item.dueDateIso ? ` · Due ${item.dueDateIso.slice(0, 10)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono font-semibold text-text-primary tabular-nums">
                      {formatRp(item.monthlyAmount)}
                    </span>
                    <button
                      type="button"
                      disabled={isCycleLocked || busyAction === `item:${item.id}`}
                      onClick={() => void handleToggleItem(item)}
                      className={`px-2 py-1 rounded border text-[11px] font-mono cursor-pointer disabled:opacity-40 ${
                        item.isSettled
                          ? "border-delta-positive/50 text-delta-positive bg-canvas"
                          : "border-border text-text-secondary hover:text-text-primary bg-canvas"
                      }`}
                    >
                      {item.isSettled ? "Settled" : "Settle"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* STEP 4: ACTIVATE DAILY LIVING POOL & CONFIRM P1 SAVINGS */}
        <section className="rounded-lg border border-border bg-surface p-5 space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2">
              {step4Done ? (
                <CheckCircle2 className="w-4 h-4 text-delta-positive shrink-0" />
              ) : (
                <Wallet className="w-4 h-4 text-text-secondary shrink-0" />
              )}
              <div>
                <div className="text-[10px] font-mono text-text-tertiary">Step 4</div>
                <h2 className="text-sm font-semibold text-text-primary">
                  Activate Daily Living Pool &amp; Confirm Core Savings Deposit
                </h2>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-border-subtle border-y border-border-subtle py-3 text-xs">
            <div className="md:col-span-5 md:pr-4 pb-3 md:pb-0">
              <div className="text-[10px] font-mono text-text-tertiary">
                Funded Daily Living Pool
              </div>
              <div className="font-display text-2xl text-text-primary mt-1 tabular-nums">
                {formatRp(snapshot?.actualDailyOperational ?? 0)}
              </div>
              {(snapshot?.deficitUncovered ?? 0) > 0 && (
                <div className="text-[11px] font-mono text-urgency mt-1">
                  Budget Shortfall: {formatRp(snapshot?.deficitUncovered ?? 0)}
                </div>
              )}
            </div>

            <div className="md:col-span-3 md:px-4 py-3 md:py-0">
              <div className="text-[10px] font-mono text-text-tertiary">
                Routine Envelopes Funded
              </div>
              <div className="font-mono text-lg font-semibold text-text-primary mt-1 tabular-nums">
                {formatRp(
                  (snapshot?.transport ?? 0) +
                    (snapshot?.internet ?? 0) +
                    (snapshot?.vape ?? 0) +
                    (snapshot?.haircut ?? 0),
                )}
              </div>
              <div className="text-[11px] text-text-tertiary mt-1">
                Pre-ringfenced alongside Debt &amp; Living
              </div>
            </div>

            <div className="md:col-span-4 md:pl-4 pt-3 md:pt-0 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-mono text-text-tertiary">
                  Core Savings Transfer
                </div>
                <div className="font-mono text-lg font-semibold text-delta-positive mt-1 tabular-nums">
                  {formatRp(plannedP1Savings)}
                </div>
                {isDepositConfirmed && plannedP1Savings > 0 && (
                  <div className="text-[11px] font-sans text-delta-positive mt-1">
                    Recorded {formatRp(recordedDepositRp > 0 ? recordedDepositRp : plannedP1Savings)} in Savings.
                  </div>
                )}
              </div>
              <div className="pt-2">
                {plannedP1Savings > 0 ? (
                  <button
                    type="button"
                    disabled={busyAction === "confirm-p1" || isDepositConfirmed}
                    onClick={() => void handleConfirmP1Deposit()}
                    className="w-full px-3 py-1.5 rounded erp-btn-primary text-xs font-mono font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    {isDepositConfirmed
                      ? "Deposit Confirmed"
                      : busyAction === "confirm-p1"
                        ? "Confirming..."
                        : "Confirm Savings Deposit"}
                  </button>
                ) : (
                  <span className="text-[11px] font-mono text-text-tertiary">
                    Core savings funded surplus is Rp 0 this cycle (debt &amp; essentials prioritized first).
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
