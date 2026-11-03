"use strict";
"use client";

import React, { useState } from "react";
import {
  GlobalConfig,
  AllocationBucketRule,
  BucketFormulaType,
  BucketGroup,
  SurplusSplitRules,
  updateGlobalConfig,
  restoreDefaultRules,
  syncConfigToPeriod,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface AllocationBucketsTabProps {
  config: GlobalConfig;
  activeMonth?: number;
  activeYear?: number;
  snapshotStatus?: string;
}

const DEFAULT_ALLOCATION_BUCKETS: AllocationBucketRule[] = [
  {
    id: "transport",
    label: "Transport & Fuel",
    group: "FIXED_ESSENTIAL",
    priorityTier: 0,
    formulaType: "FIXED_AMOUNT",
    value: 300000,
    isActive: true,
  },
  {
    id: "internet",
    label: "Internet & Connectivity",
    group: "FIXED_ESSENTIAL",
    priorityTier: 0,
    formulaType: "FIXED_AMOUNT",
    value: 250000,
    isActive: true,
  },
  {
    id: "vape",
    label: "Vape Supplies",
    group: "FIXED_ESSENTIAL",
    priorityTier: 0,
    formulaType: "FIXED_AMOUNT",
    value: 350000,
    isActive: true,
  },
  {
    id: "haircut",
    label: "Haircut & Grooming",
    group: "FIXED_ESSENTIAL",
    priorityTier: 0,
    formulaType: "FIXED_AMOUNT",
    value: 85000,
    isActive: true,
  },
  {
    id: "buffer",
    label: "Buffer Pocket",
    group: "BUFFER",
    priorityTier: 0,
    formulaType: "FIXED_AMOUNT",
    value: 0,
    isActive: true,
  },
  {
    id: "daily_operational",
    label: "Daily Operational Living Budget",
    group: "DAILY_OPERATIONAL",
    priorityTier: 0,
    formulaType: "FIXED_AMOUNT",
    value: 2850000,
    isActive: true,
  },
  {
    id: "core_savings",
    label: "Priority 1 Core Savings",
    group: "SAVINGS_P1",
    priorityTier: 1,
    formulaType: "FIXED_AMOUNT",
    value: 1000000,
    isActive: true,
  },
  {
    id: "self_reward",
    label: "Priority 2 Discretionary / Self-Reward",
    group: "SELF_REWARD_P2",
    priorityTier: 2,
    formulaType: "REMAINDER_OVERFLOW",
    value: 0,
    isActive: true,
  },
];

const DEFAULT_SURPLUS_SPLIT: SurplusSplitRules = {
  splits: [{ bucketId: "self_reward", percent: 100 }],
};

export function AllocationBucketsTab({
  config,
  activeMonth,
  activeYear,
  snapshotStatus,
}: AllocationBucketsTabProps) {
  const initialBuckets: AllocationBucketRule[] =
    config.allocationBuckets && config.allocationBuckets.length > 0
      ? config.allocationBuckets
      : DEFAULT_ALLOCATION_BUCKETS;

  const initialSurplus: SurplusSplitRules =
    config.surplusSplitRules && config.surplusSplitRules.splits.length > 0
      ? config.surplusSplitRules
      : DEFAULT_SURPLUS_SPLIT;

  const [buckets, setBuckets] = useState<AllocationBucketRule[]>(initialBuckets);
  const [surplusSplit, setSurplusSplit] = useState<SurplusSplitRules>(initialSurplus);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  // New Bucket form
  const [isAddingBucket, setIsAddingBucket] = useState(false);
  const [newBucketLabel, setNewBucketLabel] = useState("");
  const [newBucketGroup, setNewBucketGroup] = useState<BucketGroup>("FIXED_ESSENTIAL");
  const [newBucketTier, setNewBucketTier] = useState<number>(0);
  const [newBucketFormula, setNewBucketFormula] = useState<BucketFormulaType>("FIXED_AMOUNT");
  const [newBucketValue, setNewBucketValue] = useState<number>(0);

  const handleToggleBucket = (index: number) => {
    const updated = [...buckets];
    updated[index].isActive = !updated[index].isActive;
    setBuckets(updated);
  };

  const handleUpdateBucketField = (index: number, field: keyof AllocationBucketRule, val: any) => {
    const updated = [...buckets];
    (updated[index] as any)[field] = val;
    setBuckets(updated);
  };

  const handleDeleteBucket = (index: number) => {
    const updated = buckets.filter((_, i) => i !== index);
    setBuckets(updated);
  };

  const handleAddCustomBucket = () => {
    if (!newBucketLabel.trim()) return;
    const slug = newBucketLabel.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const newBucket: AllocationBucketRule = {
      id: `custom_${slug}_${Date.now().toString().slice(-4)}`,
      label: newBucketLabel.trim(),
      group: newBucketGroup,
      priorityTier: newBucketTier,
      formulaType: newBucketFormula,
      value: newBucketValue,
      isActive: true,
    };
    setBuckets([...buckets, newBucket]);
    setNewBucketLabel("");
    setNewBucketValue(0);
    setIsAddingBucket(false);
  };

  // Surplus Split management
  const handleUpdateSplitPercent = (bucketId: string, percent: number) => {
    const updated = surplusSplit.splits.map((s) =>
      s.bucketId === bucketId ? { ...s, percent } : s
    );
    setSurplusSplit({ splits: updated });
  };

  const handleAddSplitItem = (bucketId: string) => {
    if (surplusSplit.splits.some((s) => s.bucketId === bucketId)) return;
    setSurplusSplit({
      splits: [...surplusSplit.splits, { bucketId, percent: 0 }],
    });
  };

  const handleRemoveSplitItem = (bucketId: string) => {
    if (surplusSplit.splits.length <= 1) return;
    setSurplusSplit({
      splits: surplusSplit.splits.filter((s) => s.bucketId !== bucketId),
    });
  };

  const totalSplitPercent = surplusSplit.splits.reduce((sum, s) => sum + (s.percent || 0), 0);

  const handleSaveAll = async () => {
    if (Math.round(totalSplitPercent) !== 100) {
      setFeedback({
        type: "error",
        message: `Surplus overflow split percentages must sum exactly to 100% (currently ${totalSplitPercent}%).`,
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await updateGlobalConfig({
        allocationBucketsJson: buckets,
        surplusSplitRulesJson: surplusSplit,
      });
      if (res.success) {
        setFeedback({
          type: "success",
          message: "Allocation bucket rules and surplus split saved successfully.",
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to save configuration.",
        });
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Network error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreDefaults = async () => {
    if (!confirm("Reset all allocation buckets and surplus rules to factory defaults?")) return;
    setIsSaving(true);
    try {
      const res = await restoreDefaultRules();
      if (res.success) {
        setBuckets(DEFAULT_ALLOCATION_BUCKETS);
        setSurplusSplit(DEFAULT_SURPLUS_SPLIT);
        setFeedback({
          type: "success",
          message: "Restored factory defaults successfully.",
        });
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to restore defaults" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncToDraftPeriod = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await syncConfigToPeriod(activeMonth, activeYear);
      if (res.success) {
        setFeedback({
          type: "success",
          message: `Synchronized modular rules to period ${activeMonth}/${activeYear} successfully.`,
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to sync to draft period.",
        });
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Network error" });
    } finally {
      setIsSyncing(false);
    }
  };

  const sortedBuckets = [...buckets].sort((a, b) => a.priorityTier - b.priorityTier);

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-3 rounded text-xs border ${
            feedback.type === "success"
              ? "bg-[#16231c] border-[#204e35] text-[#4ade80]"
              : "bg-[#271719] border-[#5e272b] text-[#f87171]"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Sync Period Banner */}
      <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-text-primary">
            Sync Rules to Draft Period ({activeMonth}/{activeYear})
          </div>
          <div className="text-[11px] text-text-tertiary mt-0.5">
            Applies the latest modular formula rules and bucket definitions to the active draft period.
            {snapshotStatus === "LOCKED" && " (Current period is locked; syncing disabled)"}
          </div>
        </div>
        <button
          type="button"
          disabled={isSyncing || snapshotStatus === "LOCKED"}
          onClick={handleSyncToDraftPeriod}
          className="px-3 py-1.5 bg-[#1f2430] hover:bg-[#282e3d] text-text-primary rounded text-xs border border-[#282e3d] transition-colors disabled:opacity-50 shrink-0 font-medium"
        >
          {isSyncing ? "Syncing..." : "Sync Rules to Current Draft Period"}
        </button>
      </div>

      {/* Dynamic Buckets Table */}
      <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary tracking-tight">
              Modular Budget Buckets & Priority Tiers
            </h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              Each bucket specifies its waterfall priority tier and formula target calculation mode.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="px-2.5 py-1.5 text-text-tertiary hover:text-text-primary rounded text-xs border border-[#282e3d] transition-colors"
            >
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={() => setIsAddingBucket(true)}
              className="px-2.5 py-1.5 bg-[#1f2430] hover:bg-[#282e3d] text-text-primary rounded text-xs border border-[#282e3d] transition-colors"
            >
              + Add Custom Bucket
            </button>
          </div>
        </div>

        {/* Add Bucket Inline Form */}
        {isAddingBucket && (
          <div className="mb-4 p-3 bg-[#0c0e14] border border-[#282e3d] rounded space-y-3">
            <div className="text-xs font-semibold text-text-primary">Add Custom Budget Bucket</div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-[10px] text-text-tertiary mb-1">Bucket Name</label>
                <input
                  type="text"
                  placeholder="e.g. Gym Membership"
                  value={newBucketLabel}
                  onChange={(e) => setNewBucketLabel(e.target.value)}
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs text-text-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-tertiary mb-1">Group</label>
                <select
                  value={newBucketGroup}
                  onChange={(e) => setNewBucketGroup(e.target.value as any)}
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs text-text-primary focus:outline-none"
                >
                  <option value="FIXED_ESSENTIAL">Fixed Essential</option>
                  <option value="DAILY_OPERATIONAL">Daily Operational</option>
                  <option value="BUFFER">Buffer</option>
                  <option value="SAVINGS_P1">Savings P1</option>
                  <option value="SELF_REWARD_P2">Self-Reward P2</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-text-tertiary mb-1">Priority Tier</label>
                <select
                  value={newBucketTier}
                  onChange={(e) => setNewBucketTier(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs text-text-primary focus:outline-none"
                >
                  <option value={0}>Tier 0: Upfront Essential</option>
                  <option value={1}>Tier 1: Core Savings</option>
                  <option value={2}>Tier 2: Discretionary / Surplus</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-text-tertiary mb-1">Formula Mode</label>
                <select
                  value={newBucketFormula}
                  onChange={(e) => setNewBucketFormula(e.target.value as any)}
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs text-text-primary focus:outline-none"
                >
                  <option value="FIXED_AMOUNT">Fixed Nominal (Rp)</option>
                  <option value="PERCENT_OF_NET_INCOME">% of Net Income</option>
                  <option value="PERCENT_OF_DISPOSABLE_AFTER_DEBT">% After Debt Bills</option>
                  <option value="DAILY_RATE_TIMES_CYCLE_DAYS">Daily Rate × Cycle Days</option>
                  <option value="REMAINDER_OVERFLOW">Remainder Overflow</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-text-tertiary mb-1">Formula Value</label>
                <input
                  type="number"
                  value={newBucketValue}
                  onChange={(e) => setNewBucketValue(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingBucket(false)}
                className="px-2.5 py-1 bg-[#161922] text-text-tertiary rounded text-xs hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomBucket}
                className="px-2.5 py-1 bg-accent-primary text-[#0c0e14] font-medium rounded text-xs hover:opacity-90"
              >
                Add Bucket
              </button>
            </div>
          </div>
        )}

        {/* Buckets Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#282e3d] text-text-tertiary uppercase text-[10px] tracking-wider">
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Tier</th>
                <th className="py-2 px-3">Bucket Label</th>
                <th className="py-2 px-3">Group</th>
                <th className="py-2 px-3">Formula Mode</th>
                <th className="py-2 px-3">Value</th>
                <th className="py-2 px-3">Floor / Cap (Optional)</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#282e3d]">
              {sortedBuckets.map((bucket) => {
                const realIdx = buckets.findIndex((b) => b.id === bucket.id);
                return (
                  <tr key={bucket.id} className={bucket.isActive ? "" : "opacity-40"}>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => handleToggleBucket(realIdx)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                          bucket.isActive
                            ? "bg-[#16231c] border-[#204e35] text-[#4ade80]"
                            : "bg-[#1f2430] border-[#282e3d] text-text-tertiary"
                        }`}
                      >
                        {bucket.isActive ? "ACTIVE" : "OFF"}
                      </button>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-[#282e3d] bg-[#0c0e14] text-text-secondary">
                        Tier {bucket.priorityTier}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-text-primary">
                      <input
                        type="text"
                        value={bucket.label}
                        onChange={(e) => handleUpdateBucketField(realIdx, "label", e.target.value)}
                        className="bg-transparent border-b border-transparent hover:border-[#282e3d] focus:border-accent-primary px-1 py-0.5 text-xs text-text-primary focus:outline-none w-full"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-text-tertiary text-[11px] font-mono">
                      {bucket.group}
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={bucket.formulaType}
                        onChange={(e) =>
                          handleUpdateBucketField(realIdx, "formulaType", e.target.value)
                        }
                        className="bg-[#0c0e14] border border-[#282e3d] rounded px-1.5 py-0.5 text-[11px] text-text-secondary focus:outline-none"
                      >
                        <option value="FIXED_AMOUNT">Fixed Nominal</option>
                        <option value="PERCENT_OF_NET_INCOME">% of Net Income</option>
                        <option value="PERCENT_OF_DISPOSABLE_AFTER_DEBT">% After Debt Bills</option>
                        <option value="DAILY_RATE_TIMES_CYCLE_DAYS">Daily Rate × Cycle Days</option>
                        <option value="REMAINDER_OVERFLOW">Remainder Overflow</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          value={bucket.value}
                          onChange={(e) =>
                            handleUpdateBucketField(realIdx, "value", Number(e.target.value))
                          }
                          className="w-24 px-1.5 py-0.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none"
                        />
                        <span className="text-[10px] text-text-tertiary font-mono">
                          {bucket.formulaType.includes("PERCENT")
                            ? "%"
                            : bucket.formulaType === "DAILY_RATE_TIMES_CYCLE_DAYS"
                            ? "/day"
                            : "Rp"}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center space-x-1 text-[10px] font-mono text-text-tertiary">
                        <span>Min:</span>
                        <input
                          type="number"
                          placeholder="—"
                          value={bucket.minFloorRp ?? ""}
                          onChange={(e) =>
                            handleUpdateBucketField(
                              realIdx,
                              "minFloorRp",
                              e.target.value ? Number(e.target.value) : undefined
                            )
                          }
                          className="w-16 px-1 py-0.5 bg-[#0c0e14] border border-[#282e3d] rounded text-[11px] font-mono text-text-primary focus:outline-none"
                        />
                        <span>Max:</span>
                        <input
                          type="number"
                          placeholder="—"
                          value={bucket.maxCapRp ?? ""}
                          onChange={(e) =>
                            handleUpdateBucketField(
                              realIdx,
                              "maxCapRp",
                              e.target.value ? Number(e.target.value) : undefined
                            )
                          }
                          className="w-16 px-1 py-0.5 bg-[#0c0e14] border border-[#282e3d] rounded text-[11px] font-mono text-text-primary focus:outline-none"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {bucket.id.startsWith("custom_") && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBucket(realIdx)}
                          className="text-rose-400 hover:text-rose-300 text-xs transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Remainder Overflow Split Card */}
      <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary tracking-tight">
              Surplus / Remainder Overflow Split
            </h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              Defines how uncommitted cash leftover after all priority tier targets are met is distributed.
            </p>
          </div>
          <div className="text-right">
            <span
              className={`text-xs font-mono font-medium ${
                Math.round(totalSplitPercent) === 100 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              Total: {totalSplitPercent}% {Math.round(totalSplitPercent) === 100 ? "(Valid)" : "(Must equal 100%)"}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {surplusSplit.splits.map((split) => {
            const matchedBucket = buckets.find((b) => b.id === split.bucketId);
            return (
              <div
                key={split.bucketId}
                className="flex items-center justify-between p-2.5 bg-[#0c0e14] border border-[#282e3d] rounded"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-text-primary">
                    {matchedBucket ? matchedBucket.label : split.bucketId}
                  </span>
                  <span className="text-[10px] font-mono text-text-tertiary">
                    (Tier {matchedBucket?.priorityTier ?? 2})
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={split.percent}
                      onChange={(e) =>
                        handleUpdateSplitPercent(split.bucketId, Number(e.target.value))
                      }
                      className="w-16 px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs font-mono text-text-primary text-right focus:outline-none"
                    />
                    <span className="text-xs text-text-tertiary">%</span>
                  </div>
                  {surplusSplit.splits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSplitItem(split.bucketId)}
                      className="text-text-tertiary hover:text-rose-400 text-xs px-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Split Target */}
        <div className="mt-3 flex items-center space-x-2">
          <span className="text-xs text-text-tertiary">Add surplus destination:</span>
          {buckets
            .filter((b) => !surplusSplit.splits.some((s) => s.bucketId === b.id))
            .map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleAddSplitItem(b.id)}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#1f2430] hover:bg-[#282e3d] text-text-secondary border border-[#282e3d]"
              >
                + {b.label}
              </button>
            ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveAll}
            className="px-4 py-2 bg-[#282e3d] hover:bg-[#343b4e] text-text-primary font-medium rounded text-xs border border-[#3b4356] transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Bucket & Split Rules"}
          </button>
        </div>
      </div>
    </div>
  );
}
