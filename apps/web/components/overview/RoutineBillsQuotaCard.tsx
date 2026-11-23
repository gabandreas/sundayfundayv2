"use client";

import React, { useState, useEffect } from "react";
import { Check, Loader2, Plus, Pencil, X, Trash2 } from "lucide-react";
import {
  MonthlySnapshot,
  DailyPacing,
  FixedEssentialCategory,
  createExpenseTransaction,
  dispatchOptimisticRoutineSpend,
  fetchRoutineCategories,
  addRoutineCategory,
  invalidateCache,
  removeRoutineCategory,
  RoutineCategoryConfig,
} from "@/lib/api";
import { EditableTarget } from "./EditableTarget";
import { usePerspective } from "@/context/PerspectiveContext";
import { useAuth } from "@/context/AuthContext";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";

interface RoutineBillsQuotaCardProps {
  snapshot: MonthlySnapshot | null;
  pacing: DailyPacing | null;
  month: number;
  year: number;
  isLocked: boolean;
  baselineTotal: number;
}

const PRESET_AMOUNTS = [
  { label: "25k", value: 25000 },
  { label: "50k", value: 50000 },
  { label: "100k", value: 100000 },
];

function formatIdr(amount: number): string {
  return formatRupiah(amount);
}

export function RoutineBillsQuotaCard({
  snapshot,
  pacing,
  month,
  year,
  isLocked,
  baselineTotal,
}: RoutineBillsQuotaCardProps) {
  const { user } = useAuth();
  const { isAmountsMasked } = usePrivacyMask();
  const { t } = useLanguage();
  const formatIdr = (amount: number): string => formatRupiah(amount, isAmountsMasked);
  const { profileMode, getRoutineLabel, setCustomRoutineLabel } = usePerspective();
  const isOwnerBespoke =
    user?.blueprintType === "SUPERADMIN_BESPOKE" ||
    user?.lifeStagePreset === "SUPERADMIN_BESPOKE" ||
    profileMode === "SUPERADMIN_BESPOKE";
  const isStandard = !isOwnerBespoke && profileMode === "STANDARD_GENERAL";

  const [dynamicCategories, setDynamicCategories] = useState<RoutineCategoryConfig[]>([]);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [newCategoryTarget, setNewCategoryTarget] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  useEffect(() => {
    if (isStandard) {
      fetchRoutineCategories().then((cats) => {
        if (cats && cats.length > 0) {
          setDynamicCategories(cats);
        }
      });
    }
  }, [isStandard]);

  const [submittingCategory, setSubmittingCategory] =
    useState<string | null>(null);
  const [successCategory, setSuccessCategory] =
    useState<string | null>(null);
  const [activeCustomCategory, setActiveCustomCategory] =
    useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [showInactiveQuotas, setShowInactiveQuotas] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  // Inline rename state for Standard Edition
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);

  const getCategoryLabel = (slot: string): string => {
    const oneOffMatch = snapshot?.oneOffBillsJson?.find(
      (b) => b.slot?.toLowerCase() === slot.toLowerCase()
    );
    if (oneOffMatch?.label) {
      return oneOffMatch.label;
    }
    if (
      user?.id === 1 &&
      snapshot?.month === 10 &&
      snapshot?.year === 2026 &&
      slot.toUpperCase() === "INTERNET"
    ) {
      return "Nov 25 Bill";
    }
    const bucket = (snapshot?.bucketRealizationsJson as any[])?.find(
      (b) => b.bucketId?.toLowerCase() === slot.toLowerCase()
    );
    if (bucket?.label && bucket.label !== "Internet & Connectivity" && bucket.label !== "Internet") {
      return bucket.label;
    }
    return getRoutineLabel(slot);
  };

  const categories: Array<{
    id?: string;
    key: string;
    label: string;
    target: number;
    isCustom?: boolean;
  }> =
    isStandard && dynamicCategories.length > 0
      ? dynamicCategories.map((c) => ({
          id: c.id,
          key: (c.id === "housing"
            ? "HOUSING"
            : c.id === "transport"
            ? "TRANSPORT"
            : c.id === "internet"
            ? "INTERNET"
            : c.id === "vape"
            ? "VAPE"
            : c.id === "haircut"
            ? "HAIRCUT"
            : c.id.toUpperCase()),
          label: c.label,
          target:
            c.id === "transport"
              ? snapshot?.transport ?? c.target
              : c.id === "internet"
              ? snapshot?.internet ?? c.target
              : c.id === "vape"
              ? snapshot?.vape ?? c.target
              : c.id === "haircut"
              ? snapshot?.haircut ?? c.target
              : c.target,
          isCustom: c.isCustom ?? false,
        }))
      : [
          {
            key: "TRANSPORT",
            label: getCategoryLabel("TRANSPORT"),
            target: snapshot?.transport ?? 0,
          },
          {
            key: "INTERNET",
            label: getCategoryLabel("INTERNET"),
            target: snapshot?.internet ?? 0,
          },
          {
            key: "VAPE",
            label: getCategoryLabel("VAPE"),
            target: snapshot?.vape ?? 0,
          },
          {
            key: "HAIRCUT",
            label: getCategoryLabel("HAIRCUT"),
            target: snapshot?.haircut ?? 0,
          },
        ];

  // A category is promoted to active list if target > 0 OR spent > 0
  const realItems = pacing?.fixedEssentialsRealization?.items ?? [];
  const activeCategories = categories.filter((c) => {
    const item = realItems.find((i) => i.category === c.key);
    const spent = item?.spent ?? 0;
    return c.target > 0 || spent > 0;
  });

  const zeroCategories = categories.filter((c) => {
    const item = realItems.find((i) => i.category === c.key);
    const spent = item?.spent ?? 0;
    return c.target === 0 && spent === 0;
  });

  const handleAddCategorySubmit = async () => {
    if (!newCategoryLabel.trim()) return;
    setIsAddingCategory(true);
    try {
      const parsedTarget = parseInt(newCategoryTarget.replace(/\D/g, ""), 10) || 0;
      const res = await addRoutineCategory({
        label: newCategoryLabel.trim(),
        target: parsedTarget,
      });
      if (res.success && res.data) {
        setDynamicCategories(res.data);
        setIsAddCategoryOpen(false);
        setNewCategoryLabel("");
        setNewCategoryTarget("");
      }
    } catch (e) {
      console.error("Failed to add routine category", e);
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleRemoveCategory = async (id?: string) => {
    if (!id) return;
    if (window.confirm("Remove this routine category?")) {
      try {
        const res = await removeRoutineCategory(id);
        if (res.success && res.data) {
          setDynamicCategories(res.data);
        }
      } catch (e) {
        console.error("Failed to remove routine category", e);
      }
    }
  };

  const handleSaveRename = async (categoryKey: string) => {
    if (!renameValue.trim()) return;
    setRenameSaving(true);
    try {
      await setCustomRoutineLabel(categoryKey as FixedEssentialCategory, renameValue.trim());
      setRenamingCategory(null);
    } catch (e) {
      console.error("Failed to rename category", e);
    } finally {
      setRenameSaving(false);
    }
  };

  const handleQuickSpend = async (
    categoryKey: string,
    categoryLabel: string,
    spendAmount: number,
    paymentMethod: "CASH" | "PAYLATER" = "CASH"
  ) => {
    if (isLocked || submittingCategory || spendAmount <= 0) return;

    const rounded = Math.round(spendAmount);
    setErrorMessage(null);
    setActiveCustomCategory(null);
    setCustomAmount("");

    if (paymentMethod === "CASH") {
      dispatchOptimisticRoutineSpend({
        month,
        year,
        category: categoryKey,
        label: categoryLabel,
        amount: rounded,
      });
      setSuccessCategory(categoryKey);
      setTimeout(() => setSuccessCategory(null), 1400);
    } else {
      setSubmittingCategory(categoryKey);
    }

    try {
      const res = await createExpenseTransaction({
        month,
        year,
        label:
          paymentMethod === "PAYLATER"
            ? `${categoryLabel} (PayLater Rollover)`
            : `${categoryLabel} Quota`,
        amount: rounded,
        date: new Date().toISOString(),
        fixedEssentialCategory: categoryKey as any,
        paymentMethod,
        paylaterTenor: paymentMethod === "PAYLATER" ? 1 : undefined,
      });

      if (!res.success) {
        if (paymentMethod === "CASH") invalidateCache();
        setSuccessCategory(null);
        const msg = res.error || "Failed to record transaction";
        setErrorMessage(msg);
        toast({ title: "Bill entry failed", description: msg, variant: "error" });
        return;
      }

      if (paymentMethod !== "CASH") {
        setSuccessCategory(categoryKey);
        setTimeout(() => setSuccessCategory(null), 1400);
      }
      toast({
        title: paymentMethod === "PAYLATER" ? "Rolled to PayLater" : "Routine bill logged",
        description: `${categoryLabel} · ${formatIdr(rounded)}`,
        variant: "success",
      });
    } catch (err: any) {
      if (paymentMethod === "CASH") invalidateCache();
      setSuccessCategory(null);
      const msg = err.message || "Failed to submit expense";
      setErrorMessage(msg);
      toast({ title: "Bill entry failed", description: msg, variant: "error" });
    } finally {
      setSubmittingCategory(null);
    }
  };

  const handleCustomSubmit = (
    categoryKey: string,
    categoryLabel: string
  ) => {
    const parsed = parseInt(customAmount.replace(/\D/g, ""), 10);
    if (!parsed || parsed <= 0) return;
    handleQuickSpend(categoryKey, categoryLabel, parsed);
  };

  const totalRoutinePoolRemaining =
    pacing?.fixedEssentialsRealization?.totalRemainingPool ??
    activeCategories.reduce((sum, c) => sum + c.target, 0);

  return (
    <div className="rounded-lg border border-border bg-surface p-5 flex flex-col justify-between h-full">
      <div>
        {/* Header — Plain-English Financial Terminology */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-semibold text-text-tertiary font-sans">
            {t("overview.routineBills")}
          </span>
          <span className="text-[10px] font-mono text-accent tabular-nums font-medium">
            {t("overview.remainingBillsQuota")}: {formatIdr(totalRoutinePoolRemaining)}
          </span>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-2 my-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[24px] font-semibold leading-none tracking-tight text-text-primary tabular-nums whitespace-nowrap">
              {formatIdr(baselineTotal)}
            </span>
          </div>
          <span className="text-xs font-sans text-text-tertiary">
            {t("overview.totalMonthlyBudget")}
          </span>
        </div>

        {errorMessage && (
          <div className="mt-2 p-2 rounded bg-urgency/10 border border-urgency/30 text-urgency text-[11px]">
            {errorMessage}
          </div>
        )}

        {/* Categories Breakdown with 1-Click Quota Pills */}
        <div className="mt-4 pt-3 border-t border-border-subtle space-y-3.5">
          {/* Daily Food & Living Budget (Top Line Item) */}
          <div className="p-2.5 rounded bg-surface-subtle border border-border-subtle space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-text-tertiary font-semibold font-sans">
                {t("overview.dailyFoodLiving")}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-mono text-xs font-semibold tabular-nums text-text-primary inline-flex items-center gap-1.5 whitespace-nowrap">
                  {formatIdr(snapshot?.dailyOperational ?? 0)}
                  {snapshot &&
                    snapshot.dailyOperational > 0 &&
                    (snapshot.actualDailyOperational ?? snapshot.dailyOperational) <
                      snapshot.dailyOperational && (
                    <span
                      title={`${t("overview.fundedOfTarget")}: ${formatIdr(
                        snapshot.actualDailyOperational ?? 0
                      )} / ${formatIdr(snapshot.dailyOperational)}`}
                      className="whitespace-nowrap shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border border-[rgba(229,155,44,0.30)] text-caution bg-[rgba(229,155,44,0.08)] font-normal"
                    >
                      {(snapshot.actualDailyOperational ?? 0) > 0
                        ? t("overview.partiallyFunded")
                        : t("overview.unfunded")}
                    </span>
                  )}
                </span>
                {snapshot && (
                  <EditableTarget
                    snapshotId={snapshot.id}
                    category="DAILY_OPERATIONAL"
                    categoryLabel="Daily Operational"
                    currentValue={snapshot.dailyOperational}
                    isLocked={isLocked}
                    revisions={snapshot.budgetRevisions}
                  />
                )}
              </div>
            </div>
            <div className="text-[10px] text-text-tertiary font-sans tabular-nums">
              {snapshot &&
              snapshot.dailyOperational > 0 &&
              (snapshot.actualDailyOperational ?? snapshot.dailyOperational) <
                snapshot.dailyOperational
                ? `${t("overview.fundedOfTarget")}: ${formatIdr(
                    snapshot.actualDailyOperational ?? 0
                  )} / ${formatIdr(snapshot.dailyOperational)}`
                : "Monthly allowance"}
            </div>
          </div>

          {/* Active Fixed Essential Categories with Quota Progress & 1-Click Presets */}
          <div className="space-y-3">
            {activeCategories.map((cat) => {
              const realItem = pacing?.fixedEssentialsRealization?.items.find(
                (i) => i.category === cat.key
              );
              const target = cat.target;
              const spent = realItem?.spent ?? 0;
              const isUnbudgeted = target === 0 && spent > 0;
              const remainingPool =
                realItem?.remainingPool ?? Math.max(0, target - spent);
              const overage = realItem?.overage ?? Math.max(0, spent - target);
              const utilPercent =
                target > 0
                  ? Math.min(100, Math.round((spent / target) * 100))
                  : 100;

              const isSubmittingThis = submittingCategory === cat.key;
              const isSuccessThis = successCategory === cat.key;
              const isCustomOpen = activeCustomCategory === cat.key;

              return (
                <div
                  key={cat.key}
                  className={`p-2.5 rounded transition-colors ${
                    isUnbudgeted
                      ? "erp-callout-caution"
                      : "border bg-surface-subtle/50 border-border-subtle"
                  }`}
                >
                  {/* Category Top Info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {renamingCategory === cat.key ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveRename(cat.key);
                              } else if (e.key === "Escape") {
                                setRenamingCategory(null);
                              }
                            }}
                            className="h-6 px-1.5 text-xs font-semibold rounded bg-surface border border-accent text-text-primary focus:outline-hidden"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(cat.key)}
                            disabled={renameSaving}
                            className="p-1 rounded text-delta-positive hover:bg-surface cursor-pointer"
                            title="Save name"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingCategory(null)}
                            className="p-1 rounded text-text-tertiary hover:bg-surface cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs font-semibold text-text-secondary">
                            {cat.label}
                          </span>
                          {isStandard && (
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingCategory(cat.key);
                                setRenameValue(cat.label);
                              }}
                              className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
                              title={`Rename ${cat.label}`}
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                          )}
                          {isStandard && cat.isCustom && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCategory(cat.id)}
                              className="p-0.5 rounded text-text-tertiary hover:text-urgency hover:bg-surface-elevated transition-colors cursor-pointer"
                              title={`Remove ${cat.label}`}
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </>
                      )}
                      {snapshot && (
                        <EditableTarget
                          snapshotId={snapshot.id}
                          category={cat.key as any}
                          categoryLabel={cat.label}
                          currentValue={cat.target}
                          isLocked={isLocked}
                          revisions={snapshot.budgetRevisions}
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-right shrink-0">
                      <span className="font-mono text-xs tabular-nums text-text-primary whitespace-nowrap">
                        {formatIdr(spent)}
                        <span className="text-text-tertiary whitespace-nowrap"> / {formatIdr(target)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-2 h-1 w-full rounded-full bg-surface-hover overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isUnbudgeted || overage > 0 ? "bg-caution" : "bg-delta-positive"
                      }`}
                      style={{ width: `${utilPercent}%` }}
                    />
                  </div>

                  {/* Sub-label: Remaining Pool / Unbudgeted Spend Callout */}
                  <div className="flex items-center justify-between text-[11px] font-mono mt-1.5 text-text-tertiary">
                    {isUnbudgeted ? (
                      <span className="text-caution font-medium">
                        Unbudgeted Spend: {formatIdr(spent)} / Budget Rp 0 (Covered from Surplus)
                      </span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-2">
                          {remainingPool > 0 ? (
                            <span className="text-text-secondary">
                              Remaining:{" "}
                              <strong className="font-medium text-text-primary tabular-nums">
                                {formatIdr(remainingPool)}
                              </strong>
                            </span>
                          ) : (
                            <>
                              <span className="text-delta-positive">Settled in full</span>
                              {!isLocked && (
                                <button
                                  type="button"
                                  disabled={isSubmittingThis}
                                  onClick={() => {
                                    if (isCustomOpen) {
                                      setActiveCustomCategory(null);
                                      setCustomAmount("");
                                    } else {
                                      setActiveCustomCategory(cat.key);
                                      setCustomAmount("");
                                    }
                                  }}
                                  className="text-[10px] font-mono text-text-tertiary hover:text-text-primary underline-offset-2 hover:underline cursor-pointer"
                                >
                                  {isCustomOpen ? "Close" : "+ Extra"}
                                </button>
                              )}
                            </>
                          )}
                        </span>
                        {overage > 0 && (
                          <span className="text-caution tabular-nums">
                            +{formatIdr(overage)} overage
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Clean Action Bar — shown when quota remains open; hidden on settled rows */}
                  {!isLocked && remainingPool > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isSubmittingThis}
                          onClick={() =>
                            handleQuickSpend(cat.key, cat.label, remainingPool, "CASH")
                          }
                          className="px-2.5 py-1 rounded text-[11px] font-mono bg-delta-positive/10 border border-delta-positive/30 text-delta-positive hover:bg-delta-positive/15 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Pay Full · {formatIdr(remainingPool).replace("Rp ", "")}
                        </button>
                        <button
                          type="button"
                          disabled={isSubmittingThis}
                          onClick={() =>
                            handleQuickSpend(cat.key, cat.label, remainingPool, "PAYLATER")
                          }
                          title="Move remaining quota onto the PayLater Debt Matrix without spending cash today"
                          className="px-2 py-1 rounded text-[11px] font-sans bg-surface border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Roll to PayLater
                        </button>

                        <button
                          type="button"
                          disabled={isSubmittingThis}
                          onClick={() => {
                            if (isCustomOpen) {
                              setActiveCustomCategory(null);
                              setCustomAmount("");
                            } else {
                              setActiveCustomCategory(cat.key);
                              setCustomAmount("");
                            }
                          }}
                          className="px-2 py-1 rounded text-[11px] font-sans bg-surface border border-border-subtle text-text-tertiary hover:text-text-primary hover:border-border-default transition-colors cursor-pointer"
                        >
                          {isCustomOpen ? "Close" : "Log Partial"}
                        </button>
                      </div>

                      {isSubmittingThis && (
                        <span className="text-[10px] text-text-tertiary inline-flex items-center gap-1 font-mono">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Logging
                        </span>
                      )}

                      {isSuccessThis && (
                        <span className="text-[10px] text-delta-positive inline-flex items-center gap-1 font-mono">
                          <Check className="w-2.5 h-2.5" />
                          Logged
                        </span>
                      )}
                    </div>
                  )}

                  {/* Collapsible Partial Amount + Quick Preset Drawer */}
                  {isCustomOpen && (
                    <div className="mt-2 pt-2 border-t border-border-subtle space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {PRESET_AMOUNTS.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            disabled={isSubmittingThis}
                            onClick={() =>
                              handleQuickSpend(cat.key, cat.label, p.value)
                            }
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50"
                          >
                            +{p.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1000}
                          step={1000}
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          placeholder="Custom amount (IDR)"
                          className="w-36 px-2 py-1 rounded bg-surface border border-border-default font-mono text-xs text-text-primary focus:outline-none focus:border-text-secondary"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCustomSubmit(cat.key, cat.label);
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={isSubmittingThis || !customAmount}
                          onClick={() => handleCustomSubmit(cat.key, cat.label)}
                          className="px-2.5 py-1 rounded text-xs font-medium bg-surface-hover border border-border-default text-text-primary hover:border-border-strong cursor-pointer disabled:opacity-40"
                        >
                          Log Spend
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Dynamic Category Button in Standard General Mode */}
          {isStandard && (
            <div className="pt-1">
              {!isAddCategoryOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddCategoryOpen(true);
                    setNewCategoryLabel("");
                    setNewCategoryTarget("");
                  }}
                  className="w-full py-1.5 px-3 rounded border border-dashed border-border-subtle hover:border-border text-xs font-sans text-text-tertiary hover:text-text-primary flex items-center justify-center gap-1.5 transition-colors cursor-pointer bg-surface/40 hover:bg-surface"
                >
                  <Plus className="w-3.5 h-3.5 text-accent" />
                  <span>Add Routine Category</span>
                </button>
              ) : (
                <div className="p-3 rounded border border-border bg-surface-subtle space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-sans font-medium text-text-primary">
                      Add New Routine Category
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddCategoryOpen(false)}
                      className="text-text-tertiary hover:text-text-primary p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Category name (e.g. Gym)"
                      value={newCategoryLabel}
                      onChange={(e) => setNewCategoryLabel(e.target.value)}
                      className="px-2 py-1 rounded bg-surface border border-border text-xs font-sans text-text-primary focus:outline-none focus:border-accent"
                    />
                    <input
                      type="number"
                      placeholder="Monthly Target (IDR)"
                      value={newCategoryTarget}
                      onChange={(e) => setNewCategoryTarget(e.target.value)}
                      className="px-2 py-1 rounded bg-surface border border-border text-xs font-mono tabular-nums text-text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddCategoryOpen(false)}
                      className="px-2.5 py-1 rounded text-xs text-text-tertiary hover:text-text-primary border border-border cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isAddingCategory || !newCategoryLabel.trim()}
                      onClick={handleAddCategorySubmit}
                      className="px-3 py-1 rounded text-xs font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                    >
                      {isAddingCategory ? "Adding..." : "Add Category"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Inactive Rp 0 Categories: Collapsed behind explicit + Enable / Adjust toggle */}
          {zeroCategories.length > 0 && (
            <div className="pt-2.5 border-t border-border-subtle/60 space-y-2">
              <button
                type="button"
                onClick={() => setShowInactiveQuotas((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-[11px] font-mono text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>
                  {showInactiveQuotas
                    ? "Hide Inactive Routine Quotas"
                    : `Enable / Adjust Routine Quota (${zeroCategories.length})`}
                </span>
              </button>

              {showInactiveQuotas && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] font-sans text-text-tertiary">
                  {zeroCategories.map((zc) => {
                    const isCustomThis = activeCustomCategory === zc.key;
                    return (
                      <div
                        key={zc.key}
                        className="inline-flex items-center gap-1 bg-surface-subtle px-2 py-1 rounded border border-border-subtle text-[10px] font-mono text-text-secondary"
                      >
                        <span>{zc.label}</span>
                        {snapshot && (
                          <EditableTarget
                            snapshotId={snapshot.id}
                            category={zc.key as any}
                            categoryLabel={zc.label}
                            currentValue={0}
                            isLocked={isLocked}
                            revisions={snapshot.budgetRevisions}
                          />
                        )}
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveCustomCategory(isCustomThis ? null : zc.key)
                            }
                            className="inline-flex items-center gap-0.5 text-text-tertiary hover:text-text-primary ml-1 cursor-pointer"
                            title={`Log spend for ${zc.label}`}
                          >
                            <Plus className="w-3 h-3" />
                            <span>Spend</span>
                          </button>
                        )}
                        {isCustomThis && (
                          <div className="inline-flex items-center gap-1 ml-1">
                            <input
                              type="number"
                              placeholder="Rp..."
                              value={customAmount}
                              onChange={(e) => setCustomAmount(e.target.value)}
                              className="w-16 px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-mono text-text-primary focus:outline-none"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleCustomSubmit(zc.key, zc.label);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleCustomSubmit(zc.key, zc.label)}
                              className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-[10px] text-text-primary cursor-pointer"
                            >
                              Log
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
        </div>
      </div>
    </div>
  );
}
