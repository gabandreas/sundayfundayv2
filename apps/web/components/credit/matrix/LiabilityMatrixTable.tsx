"use client";

import React, { useState, useMemo } from "react";
import { SlidersHorizontal, Banknote, FastForward } from "lucide-react";
import {
  LiabilityMatrixColumn,
  LiabilityMatrixResponse,
  CreditLimitCalculationResult,
  accelerateBridgeLoan,
} from "@/lib/api";
import { DOMAIN_CONSTANTS, formatRupiah, getJakartaDateParts, getSpaylaterCutoffDay } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useLanguage } from "@/context/LanguageContext";
import { MatrixCellDrawer } from "./MatrixCellDrawer";
import { InlineBulkBillCell } from "./InlineBulkBillCell";
import { SafeSpendSimulatorPanel } from "./SafeSpendSimulatorPanel";
import { BridgeLoanModal } from "./BridgeLoanModal";

interface LiabilityMatrixTableProps {
  matrix: LiabilityMatrixResponse;
  currentMonth: number;
  currentYear: number;
  isCurrentPeriodLocked?: boolean;
  currentPeriodLimitData?: CreditLimitCalculationResult | null;
  initialTool?: string;
}

function daysUntilDayOfMonth(targetDay: number): number {
  const { year: y, month: m, day: d } = getJakartaDateParts();
  const todayUtc = Date.UTC(y, m - 1, d);
  let targetUtc = Date.UTC(y, m - 1, targetDay);
  if (targetUtc < todayUtc) {
    targetUtc = Date.UTC(y, m, targetDay);
  }
  return Math.max(0, Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24)));
}

export function LiabilityMatrixTable({
  matrix,
  currentMonth,
  currentYear,
  isCurrentPeriodLocked = false,
  currentPeriodLimitData = null,
  initialTool,
}: LiabilityMatrixTableProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const { t } = useLanguage();

  const [drawerTarget, setDrawerTarget] = useState<{
    column: LiabilityMatrixColumn;
    category: "PAYLATER" | "PERSONAL_DEBT" | "CREDIT_CARD";
  } | null>(null);

  const [isSimulatorOpen, setIsSimulatorOpen] = useState(initialTool === "simulator");
  const [isBridgeModalOpen, setIsBridgeModalOpen] = useState(initialTool === "bridge");

  const [accelerateContractId, setAccelerateContractId] = useState<string | null>(null);
  const [accelerateTargetKey, setAccelerateTargetKey] = useState<string>("");
  const [isAccelerating, setIsAccelerating] = useState(false);

  const currentKey = `${currentYear}-${currentMonth}`;
  const formatRp = (val: number) => formatRupiah(val, isAmountsMasked);

  const currentCol = useMemo(
    () =>
      matrix.columns.find((c) => c.key === currentKey) ?? {
        month: currentMonth,
        year: currentYear,
        key: currentKey,
        label: `${currentMonth}/${currentYear}`,
        cycleWindow: "",
        paysDueMonth: "",
        isPayoutConfirmed: false,
      },
    [matrix.columns, currentKey, currentMonth, currentYear]
  );

  const activePeriodPlans = useMemo(() => {
    return matrix.contractRows
      .filter((c) => {
        if ((c.totalTenor ?? 1) <= 1 || c.category === "P1_VAULT_REFUND") return false;
        const amt = c.cells?.[currentKey]?.amount ?? 0;
        return amt > 0;
      })
      .map((c) => {
        const sliceBadge = c.cells?.[currentKey]?.sliceBadge ?? null;
        let remainingSteps = 1;
        if (sliceBadge && sliceBadge.includes("/")) {
          const [curStr, totStr] = sliceBadge.split("/");
          const curNum = parseInt(curStr, 10);
          const totNum = parseInt(totStr, 10);
          if (!Number.isNaN(curNum) && !Number.isNaN(totNum) && totNum >= curNum) {
            remainingSteps = totNum - curNum + 1;
          }
        }
        const activeAmount = c.cells?.[currentKey]?.amount ?? c.monthlyInstallment;
        const remainingFromPeriod = Math.round(activeAmount * remainingSteps);
        return {
          ...c,
          sliceBadge,
          remainingSteps,
          remainingFromPeriod,
          activeAmount,
        };
      });
  }, [matrix.contractRows, currentKey]);

  const singlePeriodItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      sourceBadge: string;
      dueLabel: string;
      amount: number;
      settled: boolean;
      categoryType: "PAYLATER" | "PERSONAL_DEBT" | "CREDIT_CARD";
    }> = [];
    const plItems = matrix.payLaterRow.cells?.[currentKey]?.items ?? [];
    for (const li of plItems) {
      if ((li.tenorMonths ?? 1) <= 1 && Math.round(li.monthlyAmount ?? 0) > 0) {
        items.push({
          id: `pl-single-${li.id}`,
          title: li.title,
          sourceBadge: `${li.merchantOrPlatform || "SPayLater"} · 1/1`,
          dueLabel: li.dueDateIso ? `Due ${li.dueDateIso}` : `Due ${li.dueDay}th`,
          amount: Math.round(li.monthlyAmount),
          settled: Boolean(li.isSettled || li.isAutoSettled),
          categoryType: "PAYLATER",
        });
      }
    }
    const pdItems = matrix.personalDebtRow.cells?.[currentKey]?.items ?? [];
    for (const li of pdItems) {
      if (
        ((li.tenorMonths ?? 1) <= 1 || li.category === "P1_VAULT_REFUND") &&
        Math.round(li.monthlyAmount ?? 0) > 0
      ) {
        items.push({
          id: `pd-single-${li.id}`,
          title: li.title,
          sourceBadge:
            li.category === "P1_VAULT_REFUND"
              ? "P1 Repayment · 1/1"
              : `${li.merchantOrPlatform || "Personal Debt"} · 1/1`,
          dueLabel: li.dueDateIso ? `Due ${li.dueDateIso}` : `Due ${li.dueDay}th`,
          amount: Math.round(li.monthlyAmount),
          settled: Boolean(li.isSettled || li.isAutoSettled),
          categoryType: "PERSONAL_DEBT",
        });
      }
    }
    const ccItems = matrix.creditCardRow.cells?.[currentKey]?.items ?? [];
    for (const ci of ccItems) {
      if (!ci.sliceBadge && Math.round(ci.amount ?? 0) > 0) {
        items.push({
          id: `cc-single-${ci.id}`,
          title: ci.label,
          sourceBadge:
            ci.chargeType === "RECURRING"
              ? "Recurring Card · 1/1"
              : "Card Charge · 1/1",
          dueLabel: ci.dueDateIso ? `Due ${ci.dueDateIso}` : "Due 11th",
          amount: Math.round(ci.amount),
          settled: Boolean(ci.isSettled || ci.isAutoSettled),
          categoryType: "CREDIT_CARD",
        });
      }
    }
    return items;
  }, [matrix, currentKey]);

  const activeSpaylaterCutoffDay = useMemo(
    () => getSpaylaterCutoffDay(currentMonth, currentYear),
    [currentMonth, currentYear]
  );

  const cutoffCountdown = useMemo(
    () => ({
      paylaterDays: daysUntilDayOfMonth(activeSpaylaterCutoffDay),
      ccDays: daysUntilDayOfMonth(DOMAIN_CONSTANTS.CC_CUTOFF_DAY),
    }),
    [activeSpaylaterCutoffDay]
  );

  // 12-month average for purposeful intensity emphasis on the Total row
  const monthlyTotals = matrix.columns.map((col) => matrix.totalsPerMonth[col.key] ?? 0);
  const sumTotals = monthlyTotals.reduce((a, b) => a + b, 0);
  const averageTotal = matrix.columns.length > 0 ? sumTotals / matrix.columns.length : 0;

  const isPeriodLockedForColumn = (col: LiabilityMatrixColumn) =>
    col.key === currentKey && isCurrentPeriodLocked;

  const handleConfirmAccelerate = async (parentContractId: string) => {
    const col =
      matrix.columns.find((c) => c.key === accelerateTargetKey) ??
      matrix.columns.find((c) => c.month === currentMonth && c.year === currentYear);
    if (!col) return;
    setIsAccelerating(true);
    const res = await accelerateBridgeLoan({
      parentContractId,
      targetMonth: col.month,
      targetYear: col.year,
    });
    setIsAccelerating(false);
    if (res.success) {
      setAccelerateContractId(null);
    }
  };

  return (
    <div className="space-y-4">
      <SafeSpendSimulatorPanel
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        matrix={matrix}
        currentMonth={currentMonth}
        currentYear={currentYear}
        limitData={currentPeriodLimitData}
      />

      <BridgeLoanModal
        isOpen={isBridgeModalOpen}
        onClose={() => setIsBridgeModalOpen(false)}
        columns={matrix.columns}
        currentMonth={currentMonth}
        currentYear={currentYear}
      />

      <MatrixCellDrawer
        isOpen={Boolean(drawerTarget)}
        onClose={() => setDrawerTarget(null)}
        column={drawerTarget?.column ?? null}
        category={drawerTarget?.category ?? null}
        matrix={matrix}
        isLocked={drawerTarget ? isPeriodLockedForColumn(drawerTarget.column) : false}
        safeHeadroom={
          drawerTarget && drawerTarget.column.key === currentKey
            ? currentPeriodLimitData?.ceilingBreakdown.remainingSafeHeadroomForPaylater ?? 0
            : 0
        }
      />

      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        {matrix.settlementSummaryPerMonth?.[currentKey] && (
          <div className="px-4 py-2 border-b border-border-subtle bg-canvas/50 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-text-tertiary uppercase">Bank Reservation Checklist ({currentMonth}/{currentYear}):</span>
              <span>
                Paid:{" "}
                <strong className="text-delta-positive">
                  {formatRp(matrix.settlementSummaryPerMonth[currentKey].paidAmount)}
                </strong>
              </span>
              <span>
                Reserved:{" "}
                <strong className="text-caution">
                  {formatRp(matrix.settlementSummaryPerMonth[currentKey].reservedAmount)}
                </strong>
              </span>
              <span>
                Unpaid:{" "}
                <strong className="text-text-secondary">
                  {formatRp(matrix.settlementSummaryPerMonth[currentKey].unpaidAmount)}
                </strong>
              </span>
            </div>
            <div>
              Bank Hold Needed:{" "}
              <strong className="text-text-primary">
                {formatRp(matrix.settlementSummaryPerMonth[currentKey].bankHoldNeeded)}
              </strong>
            </div>
          </div>
        )}
        {/* Top Header info & Self-Service Actions */}
        <div className="p-4 border-b border-border-subtle flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold font-sans text-text-primary">
              {t("credit.matrix.title")}
            </h2>
            <p className="text-xs font-sans text-text-secondary mt-0.5">
              {t("credit.matrix.subtitle")}
            </p>
            <div className="mt-1.5 text-[10px] font-mono text-text-tertiary tabular-nums">
              Next Due: {DOMAIN_CONSTANTS.SPAYLATER_DUE_DAY}th (SPayLater) · {DOMAIN_CONSTANTS.CC_DUE_DAY}th (Permata CC) | Cutoffs: SPayLater {activeSpaylaterCutoffDay}th / M-15d ({cutoffCountdown.paylaterDays}d) · Permata CC {DOMAIN_CONSTANTS.CC_CUTOFF_DAY}th ({cutoffCountdown.ccDays}d)
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsSimulatorOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-sans font-medium transition-colors cursor-pointer ${
                isSimulatorOpen
                  ? "bg-surface-active border-text-secondary text-text-primary"
                  : "bg-surface-subtle border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t("credit.matrix.simulator")}
            </button>
            <button
              type="button"
              onClick={() => setIsBridgeModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-surface-subtle hover:bg-surface-hover text-xs font-sans font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <Banknote className="w-3.5 h-3.5" />
              {t("credit.matrix.bridgeLoan")}
            </button>
          </div>
        </div>

        {/* Dense 12-Month Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1040px]">
            <thead>
              <tr className="border-b border-border bg-surface-subtle/70 text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                <th className="py-2.5 px-3 sm:px-4 font-semibold w-36 sm:w-48 lg:w-56 sticky left-0 bg-surface-subtle z-10 whitespace-normal sm:whitespace-nowrap align-bottom">
                  <div>{t("credit.matrix.sourceCol")}</div>
                  <div className="text-[9px] font-normal normal-case text-text-tertiary mt-0.5">
                    Payday Cycle -&gt; Due Horizon
                  </div>
                </th>
                {matrix.columns.map((col) => {
                  const isCurrent = col.key === currentKey;
                  return (
                    <th
                      key={col.key}
                      title={
                        col.isPayoutConfirmed
                          ? `${col.label}: ${col.cycleWindow} (${col.paysDueMonth})`
                          : `${col.label}: Estimated ${col.cycleWindow} (${col.paysDueMonth})`
                      }
                      className={`py-2 px-2 text-right font-semibold tabular-nums border-l border-border-subtle whitespace-nowrap min-w-[88px] transition-colors ${
                        isCurrent
                          ? "bg-surface-active/50 text-text-primary border-t-2 border-t-accent"
                          : ""
                      }`}
                    >
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={isCurrent ? "text-text-primary font-bold" : "text-text-secondary"}>
                          {col.label}
                        </span>
                        <span className="text-[9px] font-normal normal-case tracking-normal text-text-tertiary">
                          {col.cycleWindow}
                        </span>
                        <span className="text-[9px] font-normal normal-case tracking-normal text-text-disabled">
                          {col.paysDueMonth}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-xs">
              {/* 1. PayLater Bills Row (Dual-Mode: Inline Edit + Itemized Drawer) */}
              <tr className="hover:bg-surface-hover/20 transition-colors">
                <td className="py-2.5 px-3 sm:px-4 sticky left-0 bg-surface z-10 font-sans w-36 sm:w-48 lg:w-56">
                  <div className="font-medium text-text-primary">{t("credit.matrix.paylater")}</div>
                  <div className="text-[10px] font-mono text-text-tertiary">
                    {t("credit.matrix.paylaterSub")}
                  </div>
                </td>
                {matrix.columns.map((col) => {
                  const isCurrent = col.key === currentKey;
                  const cellData = matrix.payLaterRow.cells[col.key];
                  const items = (cellData?.items ?? []).filter((i) => i.category === "PAYLATER");
                  const unpaidAmount = items
                    .filter((i) => !i.isSettled)
                    .reduce((s, i) => s + Math.round(i.monthlyAmount), 0);
                  const settledCount = items.filter((i) => i.isSettled).length;

                  return (
                    <td
                      key={col.key}
                      className={`p-1 border-l border-border-subtle align-top ${
                        isCurrent ? "bg-surface-active/20" : ""
                      }`}
                    >
                      <InlineBulkBillCell
                        bulkBillId={cellData?.bulkBillId}
                        month={col.month}
                        year={col.year}
                        field="paylaterAmount"
                        initialAmount={cellData?.amount ?? 0}
                        itemCount={items.length}
                        unpaidAmount={unpaidAmount}
                        settledCount={settledCount}
                        isCurrentMonth={isCurrent}
                        disabled={isPeriodLockedForColumn(col)}
                        safeHeadroom={
                          isCurrent
                            ? currentPeriodLimitData?.ceilingBreakdown.remainingSafeHeadroomForPaylater ?? 0
                            : 0
                        }
                        onOpenDrawer={() => setDrawerTarget({ column: col, category: "PAYLATER" })}
                      />
                    </td>
                  );
                })}
              </tr>

              {/* 2. Credit Card Balance Row (Inspectable Drawer) */}
              <tr className="hover:bg-surface-hover/20 transition-colors">
                <td className="py-2.5 px-3 sm:px-4 sticky left-0 bg-surface z-10 font-sans w-36 sm:w-48 lg:w-56">
                  <div className="font-medium text-text-primary">{t("credit.matrix.cc")}</div>
                  <div className="text-[10px] font-mono text-text-tertiary">
                    {t("credit.matrix.ccSub")}
                  </div>
                </td>
                {matrix.columns.map((col) => {
                  const isCurrent = col.key === currentKey;
                  const cell = matrix.creditCardRow.cells[col.key];
                  const amount = cell?.amount ?? 0;
                  const items = cell?.items ?? [];
                  const installmentBadges = items
                    .filter((i) => i.sliceBadge)
                    .map((i) => i.sliceBadge);
                  return (
                    <td
                      key={col.key}
                      className={`p-1 text-right border-l border-border-subtle ${
                        isCurrent ? "bg-surface-active/20" : ""
                      }`}
                    >
                      {amount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setDrawerTarget({ column: col, category: "CREDIT_CARD" })}
                          className="w-full py-1 px-1.5 text-right rounded border border-transparent hover:bg-surface-hover/80 hover:border-border transition-colors cursor-pointer"
                        >
                          <div className="flex flex-col items-end">
                            <span className="font-mono text-[11px] tabular-nums whitespace-nowrap text-text-primary font-medium">
                              {formatRp(amount)}
                            </span>
                            {installmentBadges.length > 0 && (
                              <span className="text-[9px] font-mono text-text-tertiary tabular-nums">
                                {installmentBadges.join(" · ")}
                              </span>
                            )}
                          </div>
                        </button>
                      ) : (
                        <div className="py-1 px-1.5">
                          <span className="font-mono text-[11px] text-text-tertiary/40 select-none">
                            —
                          </span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* 3. Personal & Informal Debt Row (Dual-Mode: Inline Edit + Itemized Drawer) */}
              <tr className="hover:bg-surface-hover/20 transition-colors">
                <td className="py-2.5 px-3 sm:px-4 sticky left-0 bg-surface z-10 font-sans w-36 sm:w-48 lg:w-56">
                  <div className="font-medium text-text-primary">{t("credit.matrix.personal")}</div>
                  <div className="text-[10px] font-mono text-text-tertiary">
                    {t("credit.matrix.personalSub")}
                  </div>
                </td>
                {matrix.columns.map((col) => {
                  const isCurrent = col.key === currentKey;
                  const cellData = matrix.personalDebtRow.cells[col.key];
                  const items = (cellData?.items ?? []).filter(
                    (i) => i.category === "PERSONAL_DEBT" || i.category === "P1_VAULT_REFUND"
                  );
                  const unpaidAmount = items
                    .filter((i) => !i.isSettled)
                    .reduce((s, i) => s + Math.round(i.monthlyAmount), 0);
                  const settledCount = items.filter((i) => i.isSettled).length;

                  return (
                    <td
                      key={col.key}
                      className={`p-1 border-l border-border-subtle align-top ${
                        isCurrent ? "bg-surface-active/20" : ""
                      }`}
                    >
                      <InlineBulkBillCell
                        bulkBillId={cellData?.bulkBillId}
                        month={col.month}
                        year={col.year}
                        field="personalDebtAmount"
                        initialAmount={cellData?.amount ?? 0}
                        itemCount={items.length}
                        unpaidAmount={unpaidAmount}
                        settledCount={settledCount}
                        isCurrentMonth={isCurrent}
                        disabled={isPeriodLockedForColumn(col)}
                        onOpenDrawer={() =>
                          setDrawerTarget({ column: col, category: "PERSONAL_DEBT" })
                        }
                      />
                    </td>
                  );
                })}
              </tr>

              {/* 5. Total Monthly Liabilities Row with purposeful intensity emphasis */}
              <tr className="border-t-2 border-border bg-surface-subtle/90 font-bold">
                <td className="py-3 px-3 sm:px-4 sticky left-0 bg-surface-subtle z-10 font-sans text-xs text-text-primary w-36 sm:w-48 lg:w-56">
                  <div>{t("credit.matrix.totalDue")}</div>
                  <div className="text-[10px] font-mono text-text-tertiary font-normal">
                    Avg: {formatRp(Math.round(averageTotal))}
                  </div>
                </td>
                {matrix.columns.map((col) => {
                  const isCurrent = col.key === currentKey;
                  const total = matrix.totalsPerMonth[col.key] ?? 0;
                  const isSignificantlyHigh = total > 0 && total >= averageTotal * 1.18;
                  const isModeratelyHigh =
                    total > 0 && total >= averageTotal * 1.06 && !isSignificantlyHigh;

                  let cellTint = "";
                  let textColor = "text-text-primary";

                  if (isSignificantlyHigh) {
                    cellTint = "bg-[rgba(224,108,83,0.12)]";
                    textColor = "text-delta-negative";
                  } else if (isModeratelyHigh) {
                    cellTint = "bg-[rgba(229,155,44,0.08)]";
                    textColor = "text-caution";
                  }

                  const pctAbove =
                    averageTotal > 0 && total > averageTotal
                      ? Math.round(((total - averageTotal) / averageTotal) * 100)
                      : 0;
                  const tooltip =
                    pctAbove > 0 ? `${pctAbove}% above 12-month average` : undefined;

                  return (
                    <td
                      key={col.key}
                      title={tooltip}
                      className={`py-3 px-2 text-right border-l border-border-subtle transition-colors ${cellTint} ${
                        isCurrent ? "bg-surface-active/20" : ""
                      }`}
                    >
                      <span
                        className={`font-mono text-xs font-bold tabular-nums whitespace-nowrap ${textColor}`}
                      >
                        {formatRp(total)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Period-Scoped Breakdown Section 1: Active Multi-Month Installment Plans */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2 bg-surface-subtle/50">
          <div>
            <h3 className="text-xs font-semibold font-sans text-text-primary">
              Active Multi-Month Installment Plans in {currentCol.label} ({activePeriodPlans.length})
            </h3>
            <p className="text-[11px] font-sans text-text-tertiary mt-0.5">
              Only installment schedules carrying an active slice in {currentCol.label} — already included in totals above.
            </p>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-text-secondary whitespace-nowrap">
            Slice Total: {formatRp(activePeriodPlans.reduce((s, p) => s + p.activeAmount, 0))}
          </span>
        </div>

        {activePeriodPlans.length === 0 ? (
          <div className="py-5 px-4 text-center text-xs font-sans text-text-tertiary">
            No multi-month installment slices active in {currentCol.label}.
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {activePeriodPlans.map((contract) => {
              const isAccelOpen = accelerateContractId === String(contract.id);
              const catTag =
                contract.category === "CREDIT_CARD"
                  ? "Card Installment"
                  : contract.category === "PERSONAL_DEBT"
                    ? "SPinjam Loan"
                    : "PayLater Plan";
              return (
                <div
                  key={contract.id}
                  className="px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-surface-hover/20 transition-colors"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium font-sans text-text-primary">
                        {contract.label}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border-subtle bg-canvas text-text-secondary whitespace-nowrap">
                        {contract.merchantOrPlatform || catTag} · {contract.sliceBadge ?? `${contract.totalTenor} mo`}
                      </span>
                      {contract.payoffDateLabel && (
                        <span className="text-[10px] font-mono text-text-tertiary whitespace-nowrap">
                          Matures {contract.payoffDateLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-text-tertiary tabular-nums">
                      {contract.remainingSteps} {contract.remainingSteps === 1 ? "step" : "steps"} remaining from {currentCol.label} · Remaining {formatRp(contract.remainingFromPeriod)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-mono font-semibold tabular-nums text-text-primary whitespace-nowrap">
                        {formatRp(contract.activeAmount)} <span className="text-[10px] font-normal text-text-tertiary">/ mo</span>
                      </div>
                    </div>

                    {contract.canAccelerate && contract.parentContractId && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isAccelOpen) {
                            setAccelerateContractId(null);
                          } else {
                            setAccelerateContractId(String(contract.id));
                            setAccelerateTargetKey(
                              matrix.columns.find(
                                (c) =>
                                  (c.year === currentYear && c.month > currentMonth) ||
                                  c.year > currentYear
                              )?.key ?? currentKey
                            );
                          }
                        }}
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-border-subtle hover:border-border text-[10px] font-mono text-text-secondary hover:text-text-primary whitespace-nowrap"
                        title="Consolidate all remaining slices into one month"
                      >
                        <FastForward className="w-3 h-3" /> Payoff
                      </button>
                    )}
                  </div>

                  {isAccelOpen && contract.parentContractId && (
                    <div className="w-full lg:w-auto flex items-center gap-1.5 pt-1 lg:pt-0">
                      <select
                        value={accelerateTargetKey}
                        onChange={(e) => setAccelerateTargetKey(e.target.value)}
                        className="bg-canvas border border-border rounded px-1.5 py-0.5 text-[10px] font-mono text-text-primary"
                      >
                        {matrix.columns
                          .filter(
                            (c) =>
                              c.year > currentYear ||
                              (c.year === currentYear && c.month >= currentMonth)
                          )
                          .map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={isAccelerating}
                        onClick={() => handleConfirmAccelerate(contract.parentContractId!)}
                        className="px-2 py-0.5 rounded bg-text-primary text-canvas text-[10px] font-mono font-semibold disabled:opacity-50"
                      >
                        {isAccelerating ? "..." : "Settle"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Period-Scoped Breakdown Section 2: Single-Period Charges & P1 Repayments */}
      {singlePeriodItems.length > 0 && (
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2 bg-surface-subtle/40">
            <div>
              <h3 className="text-xs font-semibold font-sans text-text-primary">
                Single-Period Bills &amp; P1 Repayments in {currentCol.label} ({singlePeriodItems.length})
              </h3>
              <p className="text-[11px] font-sans text-text-tertiary mt-0.5">
                One-time charges, recurring subscriptions, and period-specific P1 repayments due strictly inside {currentCol.label}.
              </p>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-text-secondary whitespace-nowrap">
              Period Total: {formatRp(singlePeriodItems.reduce((s, i) => s + i.amount, 0))}
            </span>
          </div>

          <div className="divide-y divide-border-subtle">
            {singlePeriodItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setDrawerTarget({ column: currentCol, category: item.categoryType })}
                className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-surface-hover/20 cursor-pointer transition-colors"
              >
                <div className="min-w-0 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium font-sans text-text-primary">
                    {item.title}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border-subtle bg-canvas text-text-tertiary whitespace-nowrap">
                    {item.sourceBadge}
                  </span>
                  <span className="text-[10px] font-mono text-text-tertiary whitespace-nowrap">
                    {item.dueLabel}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[10px] font-mono whitespace-nowrap ${
                      item.settled ? "text-delta-positive" : "text-text-tertiary"
                    }`}
                  >
                    {item.settled ? "Settled" : "Scheduled"}
                  </span>
                  <span className="font-mono text-xs font-semibold tabular-nums text-text-primary whitespace-nowrap">
                    {formatRp(item.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
