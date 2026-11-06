"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Pencil, X, Trash2 } from "lucide-react";
import {
  MonthlySnapshot,
  DailyPacing,
  FixedEssentialCategory,
  createExpenseTransaction,
  fetchRoutineCategories,
  addRoutineCategory,
  removeRoutineCategory,
  RoutineCategoryConfig,
} from "@/lib/api";
import { EditableTarget } from "./EditableTarget";
import { usePerspective } from "@/context/PerspectiveContext";
import { useAuth } from "@/context/AuthContext";
import { formatRupiah } from "@/lib/utils";
import { PrivacyEyeButton } from "@/components/shell/PrivacyEyeButton";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

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
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { user } = useAuth();
  const { isAmountsMasked } = usePrivacyMask();
  const formatIdr = (amount: number): string => formatRupiah(amount, isAmountsMasked);
  const { profileMode, getRoutineLabel, setCustomRoutineLabel } = usePerspective();
  const isOwnerBespoke =
    user?.role === "PLATFORM_OWNER" ||
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inline rename state for Standard Edition
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);

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
            label: getRoutineLabel("TRANSPORT"),
            target: snapshot?.transport ?? 0,
          },
          {
            key: "INTERNET",
            label: getRoutineLabel("INTERNET"),
            target: snapshot?.internet ?? 0,
          },
          {
            key: "VAPE",
            label: getRoutineLabel("VAPE"),
            target: snapshot?.vape ?? 0,
          },
          {
            key: "HAIRCUT",
            label: getRoutineLabel("HAIRCUT"),
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
        startTransition(() => router.refresh());
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
          startTransition(() => router.refresh());
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
    spendAmount: number
  ) => {
    if (isLocked || submittingCategory || spendAmount <= 0) return;

    setSubmittingCategory(categoryKey);
    setErrorMessage(null);

    try {
      const res = await createExpenseTransaction({
        month,
        year,
        label: `${categoryLabel} Quota`,
        amount: Math.round(spendAmount),
        date: new Date().toISOString(),
        fixedEssentialCategory: categoryKey as any,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to record transaction");
        setSubmittingCategory(null);
        return;
      }

      setSuccessCategory(categoryKey);
      setActiveCustomCategory(null);
      setCustomAmount("");
      setTimeout(() => setSuccessCategory(null), 1800);

      startTransition(() => {
        router.refresh();
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit expense");
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
          <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            LIVING & ROUTINE BILLS
          </span>
          <span className="text-[10px] font-mono text-accent tabular-nums font-medium">
            Remaining Bills Quota: {formatIdr(totalRoutinePoolRemaining)}
          </span>
        </div>

        <div className="flex items-baseline justify-between my-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[24px] font-semibold leading-none tracking-tight text-text-primary tabular-nums">
              {formatIdr(baselineTotal)}
            </span>
            <PrivacyEyeButton size="sm" />
          </div>
          <span className="text-xs font-sans text-text-tertiary">
            Total Monthly Budget
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
          <div className="p-2.5 rounded bg-surface-subtle border border-border-subtle flex items-center justify-between">
            <div>
              <span className="text-[10px] text-text-tertiary uppercase font-semibold font-sans block">
                Daily Food & Living Budget
              </span>
              <span className="text-[10px] text-text-tertiary font-sans">
                Monthly allowance
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-semibold tabular-nums text-text-primary inline-flex items-center gap-1">
                {formatIdr(snapshot?.dailyOperational ?? 0)}
                {(snapshot?.deficitUncovered ?? 0) > 0 && (
                  <span
                    title={`Target ${formatIdr(snapshot?.dailyOperational ?? 0)} was unfunded due to uncovered deficit of ${formatIdr(snapshot?.deficitUncovered ?? 0)}`}
                    className="text-[9px] font-mono px-1 py-0.2 rounded border border-[rgba(229,155,44,0.30)] text-caution bg-[rgba(229,155,44,0.08)] font-normal"
                  >
                    Unfunded
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
                  className={`p-2.5 rounded border transition-colors ${
                    isUnbudgeted
                      ? "bg-[rgba(229,155,44,0.06)] border-[rgba(229,155,44,0.3)]"
                      : "bg-surface-subtle/50 border-border-subtle"
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

                    <div className="flex items-center gap-2 text-right">
                      <span className="font-mono text-xs tabular-nums text-text-primary">
                        {formatIdr(spent)}
                        <span className="text-text-tertiary"> / {formatIdr(target)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isUnbudgeted || overage > 0 ? "bg-caution" : "bg-accent"
                      }`}
                      style={{ width: `${utilPercent}%` }}
                    />
                  </div>

                  {/* Sub-label: Remaining Pool / Unbudgeted Spend Callout */}
                  <div className="flex items-center justify-between text-[10px] font-mono mt-1 text-text-tertiary">
                    {isUnbudgeted ? (
                      <span className="text-caution font-medium">
                        Unbudgeted Spend: {formatIdr(spent)} / Budget Rp 0 (Covered from Surplus/Savings)
                      </span>
                    ) : (
                      <>
                        <span>
                          {remainingPool > 0 ? (
                            <span className="text-text-secondary">
                              Remaining: <strong className="font-medium text-text-primary">{formatIdr(remainingPool)}</strong>
                            </span>
                          ) : (
                            <span className="text-caution">Remaining: Rp 0 (Quota used)</span>
                          )}
                        </span>
                        {overage > 0 && (
                          <span className="text-caution">
                            +{formatIdr(overage)} overage
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* 1-Click Quota Presets */}
                  {!isLocked && (
                    <div className="mt-2 flex flex-wrap items-center gap-1 pt-1 border-t border-border-subtle/60">
                      {PRESET_AMOUNTS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          disabled={isSubmittingThis}
                          onClick={() =>
                            handleQuickSpend(cat.key, cat.label, p.value)
                          }
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors cursor-pointer disabled:opacity-50"
                        >
                          +{p.label}
                        </button>
                      ))}

                      {remainingPool > 0 && (
                        <button
                          type="button"
                          disabled={isSubmittingThis}
                          onClick={() =>
                            handleQuickSpend(cat.key, cat.label, remainingPool)
                          }
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface border border-accent/40 text-accent hover:bg-accent/10 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Mark Full ({formatIdr(remainingPool).replace("Rp ", "")})
                        </button>
                      )}

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
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface border border-border text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
                      >
                        {isCustomOpen ? "Cancel" : "Custom"}
                      </button>

                      {isSubmittingThis && (
                        <span className="text-[10px] text-text-tertiary inline-flex items-center gap-1 ml-1 font-mono">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Logging...
                        </span>
                      )}

                      {isSuccessThis && (
                        <span className="text-[10px] text-positive inline-flex items-center gap-1 ml-1 font-mono">
                          <Check className="w-2.5 h-2.5" />
                          Logged
                        </span>
                      )}
                    </div>
                  )}

                  {/* Inline Custom Input Drawer */}
                  {isCustomOpen && (
                    <div className="mt-2 flex items-center gap-1.5 pt-1">
                      <input
                        type="number"
                        min={1000}
                        step={1000}
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="Amount (IDR)..."
                        className="w-28 px-2 py-1 rounded bg-surface border border-border font-mono text-xs text-text-primary focus:outline-none focus:border-text-secondary"
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
                        className="px-2.5 py-1 rounded text-xs font-medium bg-surface-elevated border border-border text-text-primary hover:border-text-secondary cursor-pointer disabled:opacity-40"
                      >
                        Log
                      </button>
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

          {/* Zeroed / Prepaid Categories: Compact Muted Footer Line with + Log Spend */}
          {zeroCategories.length > 0 && (
            <div className="pt-2.5 border-t border-border-subtle/60 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] font-sans text-text-tertiary">
              <span className="text-text-tertiary">No Budget Set This Month (Rp 0):</span>
              {zeroCategories.map((zc) => {
                const isCustomThis = activeCustomCategory === zc.key;
                return (
                  <div
                    key={zc.key}
                    className="inline-flex items-center gap-1 bg-surface-subtle px-2 py-1 rounded border border-border-subtle text-[10px] font-mono text-text-secondary"
                  >
                    <span>{zc.label} (Rp 0)</span>
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
      </div>
    </div>
  );
}
