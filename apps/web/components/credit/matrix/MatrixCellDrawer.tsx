"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  ArrowLeft,
  ArrowRight,
  Scissors,
  Trash2,
  Plus,
  Lock,
  CheckCircle2,
  Circle,
  CheckCheck,
} from "lucide-react";
import {
  BillSettlementState,
  CutoffSimulateResponse,
  LiabilityMatrixColumn,
  LiabilityMatrixResponse,
  LiabilityLineItemDto,
  createLineItem,
  shiftLineItem,
  deleteLineItem,
  setLineItemSettlementState,
  settleBulkLineItems,
  simulateCutoffApi,
  updateBulkBillCell,
} from "@/lib/api";
import {
  DOMAIN_CONSTANTS,
  formatRupiah,
  formatCurrencyInput,
  parseCurrencyInput,
  getJakartaDateParts,
  resolveInstrumentCutoffDayClient,
} from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePerspective } from "@/context/PerspectiveContext";
import { useToast } from "@/context/ToastContext";
import { evaluateMathExpression } from "./InlineBulkBillCell";

interface MatrixCellDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  column: LiabilityMatrixColumn | null;
  category: "PAYLATER" | "PERSONAL_DEBT" | "CREDIT_CARD" | null;
  matrix: LiabilityMatrixResponse;
  isLocked: boolean;
  safeHeadroom?: number;
}

function getNextMonthYear(month: number, year: number): { month: number; year: number } {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
}

export function MatrixCellDrawer({
  isOpen,
  onClose,
  column,
  category,
  matrix,
  isLocked,
  safeHeadroom = 0,
}: MatrixCellDrawerProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const { t } = useLanguage();
  const { studioConfig } = usePerspective();
  const { toast } = useToast();
  const activePaylaterInst = useMemo(
    () => (studioConfig?.instrumentsTable ?? []).find((i) => i.active && i.type === "PAYLATER"),
    [studioConfig],
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Instant (<15ms) optimistic settlement map & anti-double-tap synchronous locks
  const [optimisticOverrides, setOptimisticOverrides] = useState<
    Record<
      number,
      { isSettled: boolean; isAutoSettled: boolean; settlementState: BillSettlementState }
    >
  >({});
  const inFlightItemIdsRef = useRef<Set<number>>(new Set());
  const bulkLockRef = useRef<boolean>(false);

  // Split state
  const [splittingItemId, setSplittingItemId] = useState<number | null>(null);
  const [splitAmountRaw, setSplitAmountRaw] = useState("");

  // Add item form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [merchant, setMerchant] = useState(category === "PERSONAL_DEBT" ? "Personal Loan" : "PayLater");
  const [totalAmountRaw, setTotalAmountRaw] = useState("");
  const [amountMode, setAmountMode] = useState<"PRINCIPAL_SPLIT" | "FIXED_MONTHLY">(
    "PRINCIPAL_SPLIT"
  );
  const [tenorMonths, setTenorMonths] = useState<number>(1);
  const [autoRouteByCutoff, setAutoRouteByCutoff] = useState(true);
  const [purchaseDate, setPurchaseDate] = useState(() => getJakartaDateParts().isoDate);
  const [holdPastCutoff, setHoldPastCutoff] = useState(false);
  const [customDueDay, setCustomDueDay] = useState<number>(
    category === "PERSONAL_DEBT" ? 8 : 25
  );
  const [cutoffPreview, setCutoffPreview] = useState<CutoffSimulateResponse | null>(null);
  const [notes, setNotes] = useState("");

  // Drawer tab mode (Itemized Breakdown vs Manual Bill Total)
  const [drawerMode, setDrawerMode] = useState<"itemized" | "override">("itemized");

  const dynamicSpayCutoff = useMemo(() => {
    const parts = (purchaseDate || "").split("-").map(Number);
    if (!parts[0] || !parts[1]) return 15;
    const dim = new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate();
    return Math.max(1, dim - 15);
  }, [purchaseDate]);

  // Direct total override state
  const [overrideRaw, setOverrideRaw] = useState("");

  useEffect(() => {
    setMerchant(category === "PERSONAL_DEBT" ? "Personal Loan" : "PayLater");
    setCustomDueDay(category === "PERSONAL_DEBT" ? 8 : 25);
    setDrawerMode("itemized");
    setErrorMsg(null);
    setShowAddForm(false);
    setSplittingItemId(null);
    setOptimisticOverrides({});
  }, [category, column?.key, matrix]);

  useEffect(() => {
    if (!showAddForm || !isOpen || category === "CREDIT_CARD" || !column) return;
    const amt = parseCurrencyInput(totalAmountRaw);
    if (amt <= 0) {
      setCutoffPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await simulateCutoffApi({
        title: title.trim() || "Planned Liability",
        instrument: category === "PERSONAL_DEBT" ? "SPINJAM" : "SPAYLATER",
        amountMode,
        principalAmount: amountMode === "PRINCIPAL_SPLIT" ? amt : amt * tenorMonths,
        monthlyAmount: amountMode === "FIXED_MONTHLY" ? amt : undefined,
        tenorMonths,
        purchaseDate: autoRouteByCutoff ? purchaseDate : undefined,
        dueDayOverride: customDueDay,
        holdPastCutoff,
        startMonthOverride: autoRouteByCutoff ? undefined : column.month,
        startYearOverride: autoRouteByCutoff ? undefined : column.year,
      });
      if (!cancelled && res) {
        setCutoffPreview(res);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    showAddForm,
    isOpen,
    category,
    column,
    totalAmountRaw,
    amountMode,
    tenorMonths,
    autoRouteByCutoff,
    purchaseDate,
    holdPastCutoff,
    customDueDay,
    title,
  ]);

  if (!isOpen || !column || !category) return null;

  const formatRp = (val: number) => formatRupiah(val, isAmountsMasked);

  const cellAmount =
    category === "PAYLATER"
      ? matrix.payLaterRow.cells[column.key]?.amount ?? 0
      : category === "PERSONAL_DEBT"
      ? matrix.personalDebtRow.cells[column.key]?.amount ?? 0
      : matrix.creditCardRow.cells[column.key]?.amount ?? 0;

  const bulkBillId =
    category === "PAYLATER"
      ? matrix.payLaterRow.cells[column.key]?.bulkBillId
      : category === "PERSONAL_DEBT"
      ? matrix.personalDebtRow.cells[column.key]?.bulkBillId
      : undefined;

  const rawLineItems: LiabilityLineItemDto[] =
    category === "PAYLATER"
      ? (matrix.lineItemsPerMonth?.[column.key] ?? []).filter(
          (i) => i.category === "PAYLATER"
        )
      : category === "PERSONAL_DEBT"
      ? (matrix.lineItemsPerMonth?.[column.key] ?? []).filter(
          (i) => i.category === "PERSONAL_DEBT" || i.category === "P1_VAULT_REFUND"
        )
      : [];

  const lineItems: LiabilityLineItemDto[] = rawLineItems.map((item) => {
    const ov = optimisticOverrides[item.id];
    const derivedState: BillSettlementState = ov
      ? ov.settlementState
      : item.settlementState ?? (item.isSettled ? "PAID" : "UNPAID");
    return ov
      ? {
          ...item,
          isSettled: ov.isSettled,
          isAutoSettled: ov.isAutoSettled,
          settlementState: ov.settlementState,
        }
      : { ...item, settlementState: derivedState };
  });

  const ccItems =
    category === "CREDIT_CARD"
      ? matrix.creditCardRow.cells[column.key]?.items ?? []
      : [];

  const categoryTitle =
    category === "PAYLATER"
      ? "PayLater Bills"
      : category === "PERSONAL_DEBT"
      ? "Personal & Informal Debt"
      : "Credit Card Charges";

  const handleShift = async (
    itemId: number,
    direction: "EARLIER" | "LATER",
    shiftAllRemainingInContract = false,
    splitAmount?: number
  ) => {
    if (isLocked) return;
    setErrorMsg(null);
    setBusyAction(`shift-${itemId}-${direction}`);
    const res = await shiftLineItem(itemId, {
      direction,
      shiftAllRemainingInContract,
      splitAmount,
    });
    setBusyAction(null);
    if (!res.success) {
      setErrorMsg(res.error || "Failed to move item.");
      return;
    }
    setSplittingItemId(null);
    setSplitAmountRaw("");
  };

  const handleSetSettlementState = async (
    item: LiabilityLineItemDto,
    nextState: BillSettlementState
  ) => {
    if (isLocked || inFlightItemIdsRef.current.has(item.id)) return;
    inFlightItemIdsRef.current.add(item.id);
    setErrorMsg(null);
    setOptimisticOverrides((prev) => ({
      ...prev,
      [item.id]: {
        isSettled: nextState === "PAID",
        isAutoSettled: false,
        settlementState: nextState,
      },
    }));

    try {
      const res = await setLineItemSettlementState(item.id, nextState);
      if (!res.success) {
        setOptimisticOverrides((prev) => {
          const rollback = { ...prev };
          delete rollback[item.id];
          return rollback;
        });
        setErrorMsg(res.error || "Failed to update payment status.");
        return;
      }
    } finally {
      inFlightItemIdsRef.current.delete(item.id);
    }
  };

  const handleBulkSettle = async (targetState: BillSettlementState) => {
    if (
      isLocked ||
      category === "CREDIT_CARD" ||
      bulkLockRef.current ||
      lineItems.length === 0
    ) {
      return;
    }
    bulkLockRef.current = true;
    setErrorMsg(null);
    setBusyAction("bulk-settle");
    const nextMap: Record<
      number,
      { isSettled: boolean; isAutoSettled: boolean; settlementState: BillSettlementState }
    > = {};
    for (const li of lineItems) {
      nextMap[li.id] = {
        isSettled: targetState === "PAID",
        isAutoSettled: false,
        settlementState: targetState,
      };
    }
    setOptimisticOverrides(nextMap);

    try {
      const res = await settleBulkLineItems({
        month: column.month,
        year: column.year,
        category: category === "PERSONAL_DEBT" ? "PERSONAL_DEBT" : "PAYLATER",
        isSettled: targetState === "PAID",
        settlementState: targetState,
      });
      if (!res.success) {
        setOptimisticOverrides({});
        setErrorMsg(res.error || "Failed to update bulk payment status.");
        return;
      }
    } finally {
      bulkLockRef.current = false;
      setBusyAction(null);
    }
  };

  const handleDelete = async (itemId: number) => {
    if (isLocked) return;
    setErrorMsg(null);
    setBusyAction(`del-${itemId}`);
    const res = await deleteLineItem(itemId);
    setBusyAction(null);
    if (!res.success) {
      setErrorMsg(res.error || "Failed to remove item.");
      return;
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || category === "CREDIT_CARD") return;
    const totalAmount = parseCurrencyInput(totalAmountRaw);
    if (!title.trim() || totalAmount <= 0) {
      setErrorMsg("Enter a description and positive total amount.");
      return;
    }

    setErrorMsg(null);
    setBusyAction("add");

    const targetStart =
      !autoRouteByCutoff && holdPastCutoff
        ? getNextMonthYear(column.month, column.year)
        : { month: column.month, year: column.year };

    const res = await createLineItem({
      title: title.trim(),
      category: category === "PERSONAL_DEBT" ? "PERSONAL_DEBT" : "PAYLATER",
      merchantOrPlatform: merchant.trim() || (category === "PERSONAL_DEBT" ? "SPinjam" : "SPayLater"),
      totalAmount: amountMode === "PRINCIPAL_SPLIT" ? totalAmount : undefined,
      monthlyAmount: amountMode === "FIXED_MONTHLY" ? totalAmount : undefined,
      amountMode,
      tenorMonths,
      startMonth: autoRouteByCutoff ? undefined : targetStart.month,
      startYear: autoRouteByCutoff ? undefined : targetStart.year,
      purchaseDate: autoRouteByCutoff ? new Date(purchaseDate).toISOString() : undefined,
      autoRouteByCutoff,
      holdPastCutoff,
      cutoffDay:
        category === "PAYLATER"
          ? resolveInstrumentCutoffDayClient(
              activePaylaterInst,
              column.month,
              column.year,
            )
          : customDueDay,
      dueDay: customDueDay,
      notes: notes.trim() || undefined,
    });

    setBusyAction(null);
    if (!res.success) {
      const msg = res.error || "Failed to add liability item.";
      setErrorMsg(msg);
      toast({ title: "Could not add liability item", description: msg, variant: "error" });
      return;
    }

    toast({
      title: "Installment item added",
      description: title.trim(),
      variant: "success",
    });
    setTitle("");
    setTotalAmountRaw("");
    setTenorMonths(1);
    setHoldPastCutoff(false);
    setNotes("");
    setShowAddForm(false);
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || category === "CREDIT_CARD") return;
    const numericVal = evaluateMathExpression(overrideRaw, cellAmount);
    setErrorMsg(null);
    setBusyAction("override");
    const res = await updateBulkBillCell({
      id: bulkBillId,
      month: column.month,
      year: column.year,
      field: category === "PAYLATER" ? "paylaterAmount" : "personalDebtAmount",
      value: numericVal,
    });
    setBusyAction(null);
    if (!res.success) {
      const msg = res.error || "Failed to update total override.";
      setErrorMsg(msg);
      toast({ title: "Override update failed", description: msg, variant: "error" });
      return;
    }
    toast({
      title: "Monthly cell override saved",
      description: `${String(column.month).padStart(2, "0")}/${column.year} updated.`,
      variant: "success",
    });
    setDrawerMode("itemized");
    setOverrideRaw("");
  };

  const isBusy = Boolean(busyAction);
  const parsedAmount = parseCurrencyInput(totalAmountRaw);
  const baseSlice =
    parsedAmount > 0 && amountMode === "PRINCIPAL_SPLIT"
      ? Math.trunc(parsedAmount / Math.max(1, tenorMonths))
      : parsedAmount;
  const sliceRem =
    parsedAmount > 0 && amountMode === "PRINCIPAL_SPLIT"
      ? parsedAmount % Math.max(1, tenorMonths)
      : 0;
  const firstSlicePreview =
    parsedAmount > 0
      ? amountMode === "FIXED_MONTHLY"
        ? parsedAmount
        : sliceRem > 0
          ? baseSlice + 1
          : baseSlice
      : 0;

  const paidTotal = lineItems
    .filter((i) => i.settlementState === "PAID" || i.isSettled)
    .reduce((s, i) => s + Math.round(i.monthlyAmount), 0);
  const reservedTotal = lineItems
    .filter((i) => i.settlementState === "RESERVED" && !i.isSettled)
    .reduce((s, i) => s + Math.round(i.monthlyAmount), 0);
  const unpaidTotal = lineItems
    .filter((i) => i.settlementState !== "PAID" && !i.isSettled && i.settlementState !== "RESERVED")
    .reduce((s, i) => s + Math.round(i.monthlyAmount), 0);
  const settledCount = lineItems.filter((i) => i.isSettled).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <aside
        className="w-full sm:w-[520px] max-w-full h-full bg-canvas border-l border-border flex flex-col shadow-2xl pb-[env(safe-area-inset-bottom,0px)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-4 sm:px-5 py-4 border-b border-border flex items-start justify-between bg-surface">
          <div>
            <div className="text-[10px] font-mono text-text-tertiary">
              {categoryTitle} · Period {column.month}/{column.year}
            </div>
            <div className="flex items-baseline gap-2.5 mt-1">
              <h3 className="text-base font-semibold font-sans text-text-primary">
                {column.label}
              </h3>
              <span className="text-xs font-mono text-text-secondary">
                {column.cycleWindow}
              </span>
            </div>
            <div className="text-[11px] font-mono text-text-tertiary mt-0.5">
              {column.paysDueMonth}
              {!column.isPayoutConfirmed && " · Estimated cycle boundary"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cell Subtotal Strip */}
        <div className="px-5 py-3 border-b border-border-subtle bg-surface-subtle flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono text-text-tertiary">
              {t("drawer.totalScheduled")}
            </div>
            <div className="font-mono text-lg font-semibold tabular-nums text-text-primary mt-0.5">
              {formatRp(cellAmount)}
            </div>
            {category !== "CREDIT_CARD" && lineItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-mono tabular-nums text-text-tertiary mt-1">
                <span>
                  Paid: <strong className="text-delta-positive">{formatRp(paidTotal)}</strong>
                </span>
                <span>
                  Reserved: <strong className="text-caution">{formatRp(reservedTotal)}</strong>
                </span>
                <span>
                  Unpaid: <strong className="text-text-secondary">{formatRp(unpaidTotal)}</strong>
                </span>
                <span>({settledCount}/{lineItems.length})</span>
              </div>
            )}
          </div>
          <div className="text-right">
            {isLocked ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-surface text-[10px] font-mono text-text-tertiary">
                <Lock className="w-3 h-3" /> {t("drawer.periodLocked")}
              </span>
            ) : category === "PAYLATER" && safeHeadroom > 0 ? (
              <div>
                <div className="text-[10px] font-mono text-text-tertiary">{t("drawer.safeHeadroom")}</div>
                <div className="text-xs font-mono tabular-nums text-delta-positive">
                  {formatRp(safeHeadroom)}
                </div>
              </div>
            ) : (
              <span className="text-[11px] font-mono text-text-tertiary">
                {category === "CREDIT_CARD"
                  ? `${ccItems.length} card items`
                  : `${lineItems.length} itemized rows`}
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 rounded erp-callout-urgency text-xs font-sans text-urgency">
              {errorMsg}
            </div>
          )}

          {category !== "CREDIT_CARD" && (
            <div className="grid grid-cols-2 gap-1 p-1 rounded border border-border bg-surface-subtle">
              <button
                type="button"
                onClick={() => setDrawerMode("itemized")}
                className={`py-1.5 rounded text-xs font-sans font-medium transition-colors cursor-pointer ${
                  drawerMode === "itemized"
                    ? "bg-surface text-text-primary border border-border-subtle shadow-xs"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                {t("drawer.itemizedBreakdown")}
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => {
                  setDrawerMode("override");
                  setOverrideRaw(cellAmount > 0 ? String(cellAmount) : "");
                }}
                className={`py-1.5 rounded text-xs font-sans font-medium transition-colors cursor-pointer disabled:opacity-40 ${
                  drawerMode === "override"
                    ? "bg-surface text-text-primary border border-border-subtle shadow-xs"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                {t("drawer.lumpSumOverride")}
              </button>
            </div>
          )}

          {/* Line Items List (PayLater / Personal Debt) */}
          {category !== "CREDIT_CARD" && drawerMode === "itemized" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-text-tertiary">
                  {t("drawer.itemizedObligations")} ({lineItems.length})
                </span>
                {!isLocked && (
                  <div className="flex items-center gap-1.5">
                    {lineItems.length > 0 && (
                      <>
                        <button
                          type="button"
                          disabled={busyAction === "bulk-settle"}
                          onClick={() => handleBulkSettle("RESERVED")}
                          className="px-2 py-1 rounded border border-border bg-surface hover:bg-surface-hover text-[10px] font-mono text-caution transition-colors cursor-pointer disabled:opacity-40"
                          title="Mark all rows as cash reserved in bank"
                        >
                          Reserve All
                        </button>
                        <button
                          type="button"
                          disabled={busyAction === "bulk-settle"}
                          onClick={() =>
                            handleBulkSettle(settledCount < lineItems.length ? "PAID" : "UNPAID")
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-mono transition-colors cursor-pointer disabled:opacity-40 ${
                            settledCount === lineItems.length
                              ? "border-delta-positive/40 bg-[rgba(16,183,141,0.10)] text-delta-positive hover:opacity-80"
                              : "border-border bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          <CheckCheck className="w-3 h-3" />
                          {settledCount === lineItems.length ? "Reset Unpaid" : "Mark All Paid"}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowAddForm((prev) => !prev)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-surface hover:bg-surface-hover text-[11px] font-sans font-medium text-text-primary transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      {showAddForm ? t("drawer.closeForm") : t("drawer.addItem")}
                    </button>
                  </div>
                )}
              </div>

              {/* Add Item / Installment Wizard - rendered directly at top under button */}
              {showAddForm && drawerMode === "itemized" && !isLocked && (
                <form
                  onSubmit={handleAddSubmit}
                  className="p-4 rounded-lg border border-border bg-surface-subtle space-y-3"
                >
                  <div className="text-xs font-semibold font-sans text-text-primary">
                    Add Item to {categoryTitle}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-text-tertiary">
                      Description
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. 11.11 Electronics Order"
                      className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 text-xs font-sans text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-text-secondary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-text-tertiary">
                        Platform / Lender
                      </label>
                      <input
                        type="text"
                        value={merchant}
                        onChange={(e) => setMerchant(e.target.value)}
                        placeholder={category === "PERSONAL_DEBT" ? "Lender name" : "PayLater platform"}
                        className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 text-xs font-sans text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-text-secondary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-text-tertiary">
                        {amountMode === "PRINCIPAL_SPLIT"
                          ? "Total Principal (Rp)"
                          : "Monthly Slice (Rp)"}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={totalAmountRaw}
                        onChange={(e) => setTotalAmountRaw(formatCurrencyInput(e.target.value))}
                        placeholder="0"
                        className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-text-secondary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1 p-0.5 rounded border border-border bg-canvas">
                    <button
                      type="button"
                      onClick={() => setAmountMode("PRINCIPAL_SPLIT")}
                      className={`py-1 rounded text-[10px] font-mono transition-colors ${
                        amountMode === "PRINCIPAL_SPLIT"
                          ? "bg-surface-active text-text-primary font-semibold"
                          : "text-text-tertiary hover:text-text-primary"
                      }`}
                    >
                      Split Total Equally
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmountMode("FIXED_MONTHLY")}
                      className={`py-1 rounded text-[10px] font-mono transition-colors ${
                        amountMode === "FIXED_MONTHLY"
                          ? "bg-surface-active text-text-primary font-semibold"
                          : "text-text-tertiary hover:text-text-primary"
                      }`}
                    >
                      Fixed Monthly Amt
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-text-tertiary">
                      Installment Tenor
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 3, 6, 12].map((tenorOpt) => (
                        <button
                          key={tenorOpt}
                          type="button"
                          onClick={() => setTenorMonths(tenorOpt)}
                          className={`py-1.5 rounded border text-xs font-mono transition-colors ${
                            tenorMonths === tenorOpt
                              ? "bg-surface-active border-text-secondary text-text-primary font-semibold"
                              : "bg-canvas border-border text-text-secondary hover:bg-surface-hover"
                          }`}
                        >
                          {tenorOpt}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <label className="flex items-center gap-2 text-xs font-sans text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoRouteByCutoff}
                        onChange={(e) => setAutoRouteByCutoff(e.target.checked)}
                        className="rounded border-border"
                      />
                      Auto-route start cycle from purchase date (M-15d: {dynamicSpayCutoff}th cutoff)
                    </label>

                    <div className="grid grid-cols-2 gap-2.5 pl-5">
                      {autoRouteByCutoff && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-text-tertiary">
                            Purchase / Disbursed Date
                          </label>
                          <input
                            type="date"
                            value={purchaseDate}
                            onChange={(e) => setPurchaseDate(e.target.value)}
                            className="w-full bg-canvas border border-border rounded px-2.5 py-1 text-xs font-mono text-text-primary"
                          />
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-text-tertiary">
                          Due Day
                        </label>
                        <select
                          value={customDueDay}
                          onChange={(e) => setCustomDueDay(Number(e.target.value))}
                          className="w-full bg-canvas border border-border rounded px-2 py-1 text-xs font-mono text-text-primary"
                        >
                          {(category === "PERSONAL_DEBT" ? [8, 17, 23, 24, 25] : [25, 11, 8]).map(
                            (d) => (
                              <option key={d} value={d}>
                                {d}th of month
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs font-sans text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={holdPastCutoff}
                        onChange={(e) => setHoldPastCutoff(e.target.checked)}
                        className="rounded border-border"
                      />
                      Hold order completion past {dynamicSpayCutoff}th cutoff (defer +1 cycle)
                    </label>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-text-tertiary">
                      Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional reference"
                      className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 text-xs font-sans text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-text-secondary"
                    />
                  </div>

                  {firstSlicePreview > 0 && (
                    <div className="p-2.5 rounded bg-canvas border border-border-subtle space-y-1.5 text-[11px] font-mono">
                      <div className="flex items-center justify-between text-text-secondary">
                        <span>
                          Monthly slice ({tenorMonths}x {amountMode === "PRINCIPAL_SPLIT" ? "split" : "fixed"})
                        </span>
                        <span className="text-text-primary font-semibold tabular-nums">
                          {formatRupiah(firstSlicePreview, false)} / mo
                        </span>
                      </div>
                      {cutoffPreview && (
                        <div className="pt-1 border-t border-border-subtle space-y-1 text-[10px]">
                          <div className="flex items-center justify-between text-text-tertiary">
                            <span>Routed Start · Due</span>
                            <span className="text-delta-positive font-semibold">
                              {cutoffPreview.startPeriodLabel} · Due {cutoffPreview.firstDueDateIso}
                            </span>
                          </div>
                          {cutoffPreview.slices.length > 1 && (
                            <div className="text-text-tertiary truncate">
                              {cutoffPreview.slices
                                .map((s) => `${s.periodLabel}: Rp ${s.amount.toLocaleString("id-ID")}`)
                                .join(" → ")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 rounded border border-border text-xs font-sans text-text-secondary hover:bg-surface-hover"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isBusy}
                      className="px-3.5 py-1.5 rounded erp-btn-primary text-xs font-sans font-semibold hover:opacity-90 disabled:opacity-50"
                    >
                      {busyAction === "add" ? "Saving..." : "Commit Item"}
                    </button>
                  </div>
                </form>
              )}

              {lineItems.length === 0 ? (
                <div className="p-4 rounded border border-dashed border-border text-xs font-sans text-text-tertiary">
                  {cellAmount > 0
                    ? `Total ${formatRp(cellAmount)} recorded as a single baseline bill without sub-items.`
                    : "No bills scheduled in this cycle cell."}
                </div>
              ) : (
                <div className="space-y-2">
                  {lineItems.map((item) => {
                    const isSplitOpen = splittingItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg border border-border bg-surface space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-semibold font-sans text-text-primary">
                              {item.title}
                            </div>
                            <div className="text-[10px] font-mono text-text-tertiary mt-0.5">
                              {item.merchantOrPlatform}
                              {item.tenorMonths > 1
                                ? ` · Installment ${item.installmentIndex}/${item.tenorMonths}`
                                : ""}
                              {` · Due ${item.dueDateIso ?? `${item.dueDay}th`}`}
                            </div>
                            {item.notes && (
                              <div className="text-[11px] font-sans text-text-secondary mt-1">
                                {item.notes}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono text-xs font-semibold tabular-nums text-text-primary">
                              {formatRp(item.monthlyAmount)}
                            </div>
                            {item.category === "P1_VAULT_REFUND" && (
                              <div className="text-[9px] font-mono text-caution mt-0.5">
                                Savings Refund Lock
                              </div>
                            )}
                          </div>
                        </div>

                        {!isLocked && (
                          <div className="pt-2 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleShift(item.id, "EARLIER")}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border-subtle hover:bg-surface-hover text-[10px] font-mono text-text-secondary hover:text-text-primary disabled:opacity-40"
                                title="Move 1 month earlier"
                              >
                                <ArrowLeft className="w-2.5 h-2.5" /> {t("drawer.earlier")}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleShift(item.id, "LATER")}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border-subtle hover:bg-surface-hover text-[10px] font-mono text-text-secondary hover:text-text-primary disabled:opacity-40"
                                title="Hold past cutoff / move 1 month later"
                              >
                                {t("drawer.later")} <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                              {item.parentContractId && item.tenorMonths > 1 && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleShift(item.id, "LATER", true)}
                                  className="px-2 py-1 rounded border border-border-subtle hover:bg-surface-hover text-[10px] font-mono text-text-tertiary hover:text-text-primary disabled:opacity-40"
                                  title="Shift this and all later slices of this installment plan 1 month later"
                                >
                                  Shift Plan
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                            <div className="inline-flex items-center rounded border border-border-subtle bg-canvas p-0.5 text-[10px] font-mono">
                              {(["UNPAID", "RESERVED", "PAID"] as const).map((stateOpt) => {
                                const currentState =
                                  item.settlementState ?? (item.isSettled ? "PAID" : "UNPAID");
                                const isActiveState = currentState === stateOpt;
                                const activeClasses =
                                  stateOpt === "PAID"
                                    ? "bg-[rgba(16,183,141,0.14)] text-delta-positive font-semibold"
                                    : stateOpt === "RESERVED"
                                      ? "bg-caution/15 text-caution font-semibold"
                                      : "bg-surface-active text-text-primary font-semibold";
                                return (
                                  <button
                                    key={stateOpt}
                                    type="button"
                                    disabled={busyAction === "bulk-settle"}
                                    onClick={() => handleSetSettlementState(item, stateOpt)}
                                    className={`px-2 py-0.5 rounded-sm transition-colors cursor-pointer disabled:opacity-40 ${
                                      isActiveState
                                        ? activeClasses
                                        : "text-text-tertiary hover:text-text-primary"
                                    }`}
                                  >
                                    {stateOpt === "PAID"
                                      ? item.isAutoSettled
                                        ? "Auto-Paid"
                                        : "Paid"
                                      : stateOpt === "RESERVED"
                                        ? "Reserved"
                                        : "Unpaid"}
                                  </button>
                                );
                              })}
                            </div>
                              {item.monthlyAmount > 1000 && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => {
                                    setSplittingItemId(isSplitOpen ? null : item.id);
                                    setSplitAmountRaw("");
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border-subtle hover:bg-surface-hover text-[10px] font-mono text-text-secondary hover:text-text-primary disabled:opacity-40"
                                >
                                  <Scissors className="w-2.5 h-2.5" /> Split
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleDelete(item.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border-subtle hover:border-border-strong text-[10px] font-mono text-text-tertiary hover:text-urgency disabled:opacity-40"
                                title="Delete line item"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        )}

                        {isSplitOpen && !isLocked && (
                          <div className="pt-2 border-t border-border-subtle flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={splitAmountRaw}
                              onChange={(e) => setSplitAmountRaw(formatCurrencyInput(e.target.value))}
                              placeholder="Amount to move next month"
                              className="flex-1 bg-canvas border border-border rounded px-2 py-1 text-xs font-mono tabular-nums text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-text-secondary"
                            />
                            <button
                              type="button"
                              disabled={isBusy || parseCurrencyInput(splitAmountRaw) <= 0}
                              onClick={() =>
                                handleShift(
                                  item.id,
                                  "LATER",
                                  false,
                                  parseCurrencyInput(splitAmountRaw)
                                )
                              }
                              className="px-2.5 py-1 rounded bg-surface-active border border-border text-[10px] font-mono text-text-primary hover:bg-surface-hover disabled:opacity-40"
                            >
                              Move Split Later
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Read-only CC Breakdown */}
          {category === "CREDIT_CARD" && (
            <div className="space-y-2.5">
              <div className="text-[11px] font-mono text-text-tertiary">
                Billed Card Charges ({ccItems.length})
              </div>
              {ccItems.length === 0 ? (
                <div className="p-4 rounded border border-dashed border-border text-xs font-sans text-text-tertiary">
                  No credit card charges scheduled for {column.label}.
                </div>
              ) : (
                <div className="space-y-2">
                  {ccItems.map((cc) => (
                    <div
                      key={cc.id}
                      className="p-3 rounded-lg border border-border bg-surface flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-medium font-sans text-text-primary">
                          {cc.label}
                        </div>
                        <div className="text-[10px] font-mono text-text-tertiary mt-0.5">
                          {cc.chargeType}
                          {cc.sliceBadge ? ` · ${cc.sliceBadge}` : ""}
                          {cc.endedAtLabel ? ` · Ended ${cc.endedAtLabel}` : ""}
                          {` · Due ${cc.dueDateIso ?? `${DOMAIN_CONSTANTS.CC_DUE_DAY}th`}`}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-xs font-semibold tabular-nums text-text-primary">
                          {formatRp(cc.amount)}
                        </div>
                        <div
                          className={`text-[10px] font-mono mt-0.5 ${
                            cc.isSettled ? "text-delta-positive" : "text-text-tertiary"
                          }`}
                        >
                          {cc.isSettled
                            ? cc.isAutoSettled
                              ? "Auto-Paid"
                              : "Settled"
                            : "Scheduled"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] font-sans text-text-tertiary">
                To modify card charges or record early settlement, use the Credit Cards tab.
              </p>
            </div>
          )}

          {/* Manual Bill Total Override Mode */}
          {category !== "CREDIT_CARD" && drawerMode === "override" && !isLocked && (
            <form
              onSubmit={handleOverrideSubmit}
              className="p-4 rounded-lg border border-border bg-surface-subtle space-y-3"
            >
              <div>
                <div className="text-xs font-semibold font-sans text-text-primary">
                  Manual Bill Total (Override)
                </div>
                <p className="text-[11px] font-sans text-text-tertiary mt-1">
                  Enter an exact statement total or a signed delta (e.g. <span className="font-mono">+92000</span> or <span className="font-mono">-50000</span>). Multi-month contracts remain preserved and unitemized balance reconciles automatically.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-text-tertiary">
                  Target Amount or Delta Expression
                </label>
                <input
                  type="text"
                  inputMode="text"
                  value={overrideRaw}
                  onChange={(e) => setOverrideRaw(e.target.value)}
                  placeholder="e.g. 2393391 or +150000"
                  className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-text-secondary"
                />
                {overrideRaw.trim() !== "" && (
                  <div className="text-[10px] font-mono text-text-tertiary tabular-nums">
                    Evaluated Total: {formatRp(evaluateMathExpression(overrideRaw, cellAmount))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerMode("itemized")}
                  className="px-3 py-1.5 rounded border border-border text-xs font-sans text-text-secondary hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="px-3.5 py-1.5 rounded erp-btn-primary text-xs font-sans font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {busyAction === "override" ? "Saving..." : "Apply Override"}
                </button>
              </div>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}
