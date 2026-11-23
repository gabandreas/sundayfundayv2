"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2, Check, AlertTriangle } from "lucide-react";
import {
  SavingsPocketConfig,
  SavingsPocketsSaveResponse,
  saveSavingsPockets,
} from "@/lib/api";
import { formatCurrencyInput, formatRupiah, parseCurrencyInput } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useToast } from "@/context/ToastContext";

const POCKET_CATEGORY_OPTIONS: Array<{
  value: SavingsPocketConfig["category"];
  label: string;
}> = [
  { value: "EMERGENCY_FUND", label: "Emergency Fund" },
  { value: "WISHLIST", label: "Wishlist Reserve" },
  { value: "SINKING_RESERVE", label: "Annual & Sinking" },
  { value: "CUSTOM", label: "Custom Pocket" },
];

function getDefaultPockets(): SavingsPocketConfig[] {
  return [
    {
      id: "pocket_emergency",
      key: "emergency",
      name: "Emergency Fund",
      category: "EMERGENCY_FUND",
      allocatedRp: 0,
      targetRp: 12000000,
      notes: "Unplanned emergencies and job safety runway",
    },
    {
      id: "pocket_wishlist",
      key: "wishlist",
      name: "Wishlist Reserve",
      category: "WISHLIST",
      allocatedRp: 0,
      targetRp: 3000000,
      notes: "Planned upgrades paid in cash",
    },
    {
      id: "pocket_sinking",
      key: "sinking",
      name: "Annual & Sinking Reserve",
      category: "SINKING_RESERVE",
      allocatedRp: 0,
      targetRp: 2400000,
      notes: "Yearly taxes, maintenance, and renewals",
    },
  ];
}

interface SavingsPocketsCardProps {
  totalConfirmedSavingsRp: number;
  initialPockets?: SavingsPocketConfig[];
  onSaved?: (saved: SavingsPocketsSaveResponse) => void;
}

export function SavingsPocketsCard({
  totalConfirmedSavingsRp,
  initialPockets,
  onSaved,
}: SavingsPocketsCardProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const { toast } = useToast();
  const [pockets, setPockets] = useState<SavingsPocketConfig[]>(() =>
    initialPockets && initialPockets.length > 0 ? initialPockets : getDefaultPockets(),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (initialPockets && initialPockets.length > 0) {
      setPockets(initialPockets);
    }
  }, [initialPockets]);

  const poolTotal = Math.max(0, Math.round(totalConfirmedSavingsRp || 0));
  const totalAllocated = useMemo(
    () => pockets.reduce((sum, p) => sum + Math.max(0, Math.round(p.allocatedRp || 0)), 0),
    [pockets],
  );
  const unallocatedPool = poolTotal - totalAllocated;
  const isOverAllocated = unallocatedPool < 0;

  const updatePocket = (idx: number, patch: Partial<SavingsPocketConfig>) => {
    setFeedback(null);
    setPockets((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    );
  };

  const handleAssignRemainder = (idx: number) => {
    if (unallocatedPool <= 0) return;
    setFeedback(null);
    setPockets((prev) =>
      prev.map((row, i) =>
        i === idx
          ? { ...row, allocatedRp: Math.max(0, Math.round(row.allocatedRp) + unallocatedPool) }
          : row,
      ),
    );
  };

  const handleAddPocket = () => {
    setFeedback(null);
    const uid = `pocket_${Date.now()}`;
    setPockets((prev) => [
      ...prev,
      {
        id: uid,
        key: uid,
        name: "New Custom Pocket",
        category: "CUSTOM",
        allocatedRp: 0,
        targetRp: 1000000,
        notes: "",
      },
    ]);
  };

  const handleRemovePocket = (idx: number) => {
    if (pockets.length <= 1) return;
    setFeedback(null);
    setPockets((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (isOverAllocated) {
      setFeedback({
        type: "err",
        text: `Allocated pockets exceed confirmed savings by ${formatRupiah(Math.abs(unallocatedPool), false)}.`,
      });
      return;
    }
    setIsSaving(true);
    setFeedback(null);
    const cleaned = pockets.map((p, idx) => ({
      ...p,
      id: p.id || `pocket_${idx}`,
      key: p.key || p.id || `pocket_${idx}`,
      name: p.name.trim() || `Savings Pocket ${idx + 1}`,
      allocatedRp: Math.max(0, Math.round(Number(p.allocatedRp) || 0)),
      targetRp: Math.max(0, Math.round(Number(p.targetRp) || 0)),
    }));
    const res = await saveSavingsPockets(cleaned);
    setIsSaving(false);
    if (!res.success || !res.data) {
      const msg = res.error || "Could not save pocket split.";
      setFeedback({ type: "err", text: msg });
      toast({ title: "Pocket split failed", description: msg, variant: "error" });
      return;
    }
    setPockets(res.data.pockets);
    setFeedback({ type: "ok", text: "Pocket split saved." });
    toast({ title: "Pocket split saved", description: "Savings pockets updated cleanly.", variant: "success" });
    onSaved?.(res.data);
  };

  return (
    <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-border-subtle">
        <div>
          <h2 className="text-sm font-semibold font-sans text-text-primary">
            Savings Pocket Split
          </h2>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Divide your raw confirmed savings balance into earmarked pockets without changing your actual bank total.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAddPocket}
            className="erp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Pocket</span>
          </button>
          <button
            type="button"
            disabled={isSaving || isOverAllocated}
            onClick={handleSave}
            className="erp-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-medium disabled:opacity-40 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? "Saving..." : "Save Split"}</span>
          </button>
        </div>
      </div>

      {/* Pool Conservation Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-md border border-border-subtle bg-surface-subtle/50 p-3.5">
        <div>
          <div className="text-[10px] font-mono text-text-tertiary">
            Confirmed Savings Pool
          </div>
          <div className="font-mono text-base font-semibold text-text-primary mt-0.5 erp-tabular-currency">
            {formatRupiah(poolTotal, isAmountsMasked)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-text-tertiary">
            Earmarked Across Pockets
          </div>
          <div className="font-mono text-base font-semibold text-delta-positive mt-0.5 erp-tabular-currency">
            {formatRupiah(totalAllocated, isAmountsMasked)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-text-tertiary">
            Unallocated Raw Pool
          </div>
          <div
            className={`font-mono text-base font-semibold mt-0.5 erp-tabular-currency ${
              isOverAllocated
                ? "text-urgency"
                : unallocatedPool > 0
                  ? "text-caution"
                  : "text-text-secondary"
            }`}
          >
            {formatRupiah(unallocatedPool, isAmountsMasked)}
          </div>
        </div>
      </div>

      {isOverAllocated && (
        <div className="p-3 rounded erp-callout-urgency text-xs text-urgency flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Pocket total exceeds confirmed savings by{" "}
            <strong className="font-mono erp-tabular-currency">
              {formatRupiah(Math.abs(unallocatedPool), isAmountsMasked)}
            </strong>
            . Reduce an allocation before saving.
          </span>
        </div>
      )}

      {feedback && (
        <div
          className={`px-3 py-2 rounded border text-xs flex items-center gap-2 ${
            feedback.type === "ok"
              ? "border-delta-positive/40 bg-[rgba(16,183,141,0.08)] text-delta-positive"
              : "border-delta-negative/40 bg-[rgba(224,108,83,0.08)] text-delta-negative"
          }`}
        >
          {feedback.type === "ok" && <Check className="w-3.5 h-3.5 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Pockets Editor List */}
      <div className="space-y-3">
        {pockets.map((pocket, idx) => {
          const pct =
            pocket.targetRp > 0
              ? Math.min(100, Math.round((pocket.allocatedRp / pocket.targetRp) * 100))
              : 0;
          return (
            <div
              key={pocket.id || idx}
              className="rounded-md border border-border-subtle bg-canvas/50 p-3.5 space-y-2.5"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                <div className="lg:col-span-4 space-y-1">
                  <label className="text-[10px] font-mono text-text-tertiary block">
                    Pocket Name
                  </label>
                  <input
                    type="text"
                    value={pocket.name}
                    onChange={(e) => updatePocket(idx, { name: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded bg-surface border border-border text-xs text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="lg:col-span-2 space-y-1">
                  <label className="text-[10px] font-mono text-text-tertiary block">
                    Purpose
                  </label>
                  <select
                    value={pocket.category}
                    onChange={(e) =>
                      updatePocket(idx, {
                        category: e.target.value as SavingsPocketConfig["category"],
                      })
                    }
                    className="w-full px-2 py-1.5 rounded bg-surface border border-border text-xs text-text-primary focus:outline-none focus:border-accent"
                  >
                    {POCKET_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-mono text-text-tertiary">
                      Allocated (Rp)
                    </label>
                    {unallocatedPool > 0 && (
                      <button
                        type="button"
                        onClick={() => handleAssignRemainder(idx)}
                        className="text-[10px] font-mono text-delta-positive hover:underline cursor-pointer whitespace-nowrap"
                      >
                        + Fill unallocated
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      isAmountsMasked
                        ? "•••••"
                        : formatCurrencyInput(pocket.allocatedRp || 0)
                    }
                    readOnly={isAmountsMasked}
                    onChange={(e) =>
                      updatePocket(idx, { allocatedRp: parseCurrencyInput(e.target.value) })
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-surface border border-border text-xs font-mono erp-tabular-currency text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="lg:col-span-2 space-y-1">
                  <label className="text-[10px] font-mono text-text-tertiary block">
                    Target (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      isAmountsMasked
                        ? "•••••"
                        : formatCurrencyInput(pocket.targetRp || 0)
                    }
                    readOnly={isAmountsMasked}
                    onChange={(e) =>
                      updatePocket(idx, { targetRp: parseCurrencyInput(e.target.value) })
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-surface border border-border text-xs font-mono erp-tabular-currency text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="lg:col-span-1 flex justify-end">
                  <button
                    type="button"
                    disabled={pockets.length <= 1}
                    onClick={() => handleRemovePocket(idx)}
                    aria-label={`Remove ${pocket.name}`}
                    className="p-2 rounded border border-border-subtle text-text-tertiary hover:text-delta-negative hover:border-delta-negative/40 disabled:opacity-30 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-surface-subtle overflow-hidden border border-border-subtle">
                  <div
                    className="h-full bg-delta-positive transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-text-tertiary whitespace-nowrap erp-tabular-currency">
                  {pct}% of target
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
