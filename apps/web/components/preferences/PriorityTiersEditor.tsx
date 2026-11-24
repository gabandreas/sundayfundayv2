"use client";

import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Save } from "lucide-react";
import { ModularStudioConfig, PriorityTierConfig } from "@/lib/api";
import { usePerspective } from "@/context/PerspectiveContext";

const DEFAULT_TIERS: PriorityTierConfig[] = [
  { key: "SAVINGS", label: "Core Savings Reserve", order: 1, enabled: true },
  { key: "DISCRETIONARY", label: "Flexible Surplus", order: 2, enabled: true },
];

export function PriorityTiersEditor({ initialConfig }: { initialConfig?: ModularStudioConfig }) {
  const { studioConfig, updateStudioConfig } = usePerspective();
  const active = studioConfig ?? initialConfig;

  const [tiers, setTiers] = useState<PriorityTierConfig[]>(() =>
    active?.priorityTiers && active.priorityTiers.length > 0
      ? [...active.priorityTiers].sort((a, b) => a.order - b.order)
      : DEFAULT_TIERS,
  );
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (active?.priorityTiers && active.priorityTiers.length > 0) {
      setTiers([...active.priorityTiers].sort((a, b) => a.order - b.order));
    }
  }, [active]);

  const moveTier = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= tiers.length) return;
    const copy = [...tiers];
    const tmp = copy[idx];
    copy[idx] = copy[nextIdx];
    copy[nextIdx] = tmp;
    setTiers(copy.map((t, i) => ({ ...t, order: i + 1 })));
    setSavedMsg(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg(null);
    const cleaned = tiers.map((t, i) => ({
      ...t,
      order: i + 1,
      label: t.label.trim() || (t.key === "SAVINGS" ? "Core Savings Reserve" : "Flexible Surplus"),
    }));
    await updateStudioConfig({ priorityTiers: cleaned });
    setTiers(cleaned);
    setSaving(false);
    setSavedMsg("Priority labels and order saved.");
  };

  return (
    <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border-subtle">
        <div>
          <h3 className="text-sm font-semibold text-text-primary font-sans">
            Allocation Priority Order &amp; Naming
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            Rename or reorder how surplus is labeled across Overview, Monthly Plan, and Savings after mandatory bills are funded.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="erp-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium cursor-pointer disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? "Saving..." : "Save Priority Labels"}</span>
        </button>
      </div>

      {savedMsg && (
        <div className="px-3 py-2 rounded border border-delta-positive/40 bg-[rgba(16,183,141,0.08)] text-xs text-delta-positive flex items-center gap-2">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      <div className="divide-y divide-border-subtle border border-border-subtle rounded-md overflow-hidden">
        {tiers.map((tier, idx) => (
          <div
            key={tier.key}
            className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-canvas/40"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-subtle border border-border-subtle text-text-secondary">
                #{idx + 1}
              </span>
              <input
                type="text"
                value={tier.label}
                onChange={(e) => {
                  setSavedMsg(null);
                  setTiers((prev) =>
                    prev.map((row, i) => (i === idx ? { ...row, label: e.target.value } : row)),
                  );
                }}
                className="w-full max-w-sm px-2.5 py-1.5 rounded bg-surface border border-border text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-accent"
              />
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <label className="inline-flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={tier.enabled}
                  onChange={(e) => {
                    setSavedMsg(null);
                    setTiers((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, enabled: e.target.checked } : row,
                      ),
                    );
                  }}
                />
                <span>Active</span>
              </label>

              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveTier(idx, -1)}
                  aria-label="Move up"
                  className="p-1.5 rounded border border-border-subtle text-text-tertiary hover:text-text-primary disabled:opacity-30 cursor-pointer"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={idx === tiers.length - 1}
                  onClick={() => moveTier(idx, 1)}
                  aria-label="Move down"
                  className="p-1.5 rounded border border-border-subtle text-text-tertiary hover:text-text-primary disabled:opacity-30 cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
