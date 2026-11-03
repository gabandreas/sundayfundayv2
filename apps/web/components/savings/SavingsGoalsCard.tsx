"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Target, Calendar, Trash2, Edit2, CheckCircle2, Loader2 } from "lucide-react";
import {
  EnrichedSavingsGoal,
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface SavingsGoalsCardProps {
  goals: EnrichedSavingsGoal[];
  avgMonthlySavings: number;
}

export function SavingsGoalsCard({
  goals,
  avgMonthlySavings,
}: SavingsGoalsCardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<EnrichedSavingsGoal | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetMonth, setTargetMonth] = useState("12");
  const [targetYear, setTargetYear] = useState("2027");
  const [category, setCategory] = useState("EMERGENCY_FUND");
  const [currentAllocated, setCurrentAllocated] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingGoal(null);
    setName("");
    setTargetAmount("");
    setTargetMonth("12");
    setTargetYear("2027");
    setCategory("EMERGENCY_FUND");
    setCurrentAllocated("0");
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (goal: EnrichedSavingsGoal) => {
    setEditingGoal(goal);
    setName(goal.name);
    setTargetAmount(goal.targetAmount.toString());
    setTargetMonth(goal.targetMonth.toString());
    setTargetYear(goal.targetYear.toString());
    setCategory(goal.category || "GENERAL");
    setCurrentAllocated(goal.currentAllocatedAmount.toString());
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tAmount = parseInt(targetAmount.replace(/\D/g, ""), 10);
    const cAllocated = parseInt(currentAllocated.replace(/\D/g, ""), 10) || 0;
    const tMonth = parseInt(targetMonth, 10);
    const tYear = parseInt(targetYear, 10);

    if (!name.trim()) {
      setError("Goal name is required");
      return;
    }
    if (isNaN(tAmount) || tAmount <= 0) {
      setError("Target amount must be greater than Rp 0");
      return;
    }

    setSubmitting(true);
    setError(null);

    let res;
    if (editingGoal) {
      res = await updateSavingsGoal(editingGoal.id, {
        name: name.trim(),
        targetAmount: tAmount,
        targetMonth: tMonth,
        targetYear: tYear,
        category,
        currentAllocatedAmount: cAllocated,
      });
    } else {
      res = await createSavingsGoal({
        name: name.trim(),
        targetAmount: tAmount,
        targetMonth: tMonth,
        targetYear: tYear,
        category,
        currentAllocatedAmount: cAllocated,
      });
    }

    setSubmitting(false);

    if (!res.success) {
      setError(res.error || "Failed to save savings goal");
      return;
    }

    setIsModalOpen(false);
    startTransition(() => {
      router.refresh();
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this savings goal?")) return;
    const res = await deleteSavingsGoal(id);
    if (res.success) {
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const handleToggleComplete = async (goal: EnrichedSavingsGoal) => {
    const res = await updateSavingsGoal(goal.id, {
      isCompleted: !goal.isCompleted,
    });
    if (res.success) {
      startTransition(() => {
        router.refresh();
      });
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            Target Savings Goals & Projections
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Forward goal trajectories calculated against target dates and your average monthly P1 savings pace ({formatRupiah(avgMonthlySavings)}/month).
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-sans font-medium bg-surface-active hover:bg-surface-hover border border-border text-text-primary transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Goal</span>
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-border-subtle rounded-md">
          <Target className="w-8 h-8 text-text-tertiary mx-auto mb-2 opacity-60" />
          <h3 className="text-sm font-medium text-text-secondary">No Savings Goals Set</h3>
          <p className="text-xs text-text-tertiary mt-1 max-w-sm mx-auto">
            Create your first savings goal (e.g. Emergency Fund Rp 10.000.000 by Dec 2027) to calculate monthly required contributions and completion projections.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-surface-subtle hover:bg-surface-hover border border-border text-text-primary cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Goal</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal) => {
            return (
              <div
                key={goal.id}
                className={`p-4 rounded-lg border transition-all ${
                  goal.isCompleted
                    ? "bg-surface-subtle/40 border-border-subtle opacity-70"
                    : "bg-surface border-border hover:border-border-strong"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-text-primary">
                        {goal.name}
                      </h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle text-text-tertiary">
                        {goal.category}
                      </span>
                      {goal.linkedWishlistItem && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle border border-border text-text-secondary">
                          Linked from Wishlist
                        </span>
                      )}
                      {(goal.isReadyToBuy || goal.progressPercent >= 100) && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[rgba(16,183,141,0.12)] border border-[rgba(16,183,141,0.3)] text-delta-positive font-medium">
                          Ready to Buy (100% Funded)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-text-secondary mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-text-tertiary" />
                        Target: {goal.targetMonth}/{goal.targetYear} ({goal.monthsUntilTarget} mo left)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(goal)}
                      title={goal.isCompleted ? "Mark Incomplete" : "Mark Completed"}
                      className={`p-1 rounded cursor-pointer ${
                        goal.isCompleted
                          ? "text-delta-positive hover:text-text-primary"
                          : "text-text-tertiary hover:text-delta-positive"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(goal)}
                      className="p-1 rounded text-text-tertiary hover:text-text-primary cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(goal.id)}
                      className="p-1 rounded text-text-tertiary hover:text-delta-negative cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-baseline justify-between text-xs font-mono">
                    <span className="text-text-secondary">
                      {formatRupiah(goal.currentAllocatedAmount)}{" "}
                      <span className="text-text-tertiary">/ {formatRupiah(goal.targetAmount)}</span>
                    </span>
                    <span className="font-semibold text-text-primary">{goal.progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 rounded bg-surface-subtle overflow-hidden">
                    <div
                      className={`h-full rounded transition-all duration-300 ${
                        goal.isCompleted || goal.progressPercent >= 100
                          ? "bg-delta-positive"
                          : "bg-surface-active"
                      }`}
                      style={{ width: `${goal.progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Projections row */}
                <div className="mt-3 pt-2.5 border-t border-border-subtle grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-text-tertiary uppercase block">
                      Required Monthly
                    </span>
                    <span className="text-text-primary font-medium">
                      {goal.remainingNeeded > 0
                        ? `${formatRupiah(goal.requiredMonthlyContribution)}/mo`
                        : "Goal Met"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-text-tertiary uppercase block">
                      Projected Date
                    </span>
                    <span className="text-text-primary font-medium">
                      {goal.projectedCompletionDate
                        ? `${goal.projectedCompletionDate} (${goal.projectedMonthsAtPace} mo)`
                        : goal.remainingNeeded === 0
                          ? "Completed"
                          : "P1 Savings Needed"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Goal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <h3 className="text-sm font-semibold text-text-primary">
                {editingGoal ? "Edit Savings Goal" : "Create New Savings Goal"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-text-tertiary hover:text-text-primary text-xs"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs font-sans">
              <div>
                <label className="text-[11px] font-mono uppercase text-text-tertiary block mb-1">
                  Goal Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Emergency Fund (6 Months)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-surface-subtle border border-border text-text-primary focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-mono uppercase text-text-tertiary block mb-1">
                    Target Amount (Rp)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10.000.000"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-surface-subtle border border-border text-text-primary font-mono focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-text-tertiary block mb-1">
                    Current Allocated (Rp)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2.000.000"
                    value={currentAllocated}
                    onChange={(e) => setCurrentAllocated(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-surface-subtle border border-border text-text-primary font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-mono uppercase text-text-tertiary block mb-1">
                    Target Month
                  </label>
                  <select
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    className="w-full px-2 py-1.5 rounded bg-surface-subtle border border-border text-text-primary font-mono focus:outline-none"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {m} ({new Date(2026, m - 1, 1).toLocaleString("en-US", { month: "short" })})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-text-tertiary block mb-1">
                    Target Year
                  </label>
                  <select
                    value={targetYear}
                    onChange={(e) => setTargetYear(e.target.value)}
                    className="w-full px-2 py-1.5 rounded bg-surface-subtle border border-border text-text-primary font-mono focus:outline-none"
                  >
                    {[2026, 2027, 2028, 2029, 2030].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-text-tertiary block mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-2 py-1.5 rounded bg-surface-subtle border border-border text-text-primary text-[11px] focus:outline-none"
                  >
                    <option value="EMERGENCY_FUND">Emergency Fund</option>
                    <option value="DEVICE_UPGRADE">Device Upgrade</option>
                    <option value="TRAVEL">Travel / Holiday</option>
                    <option value="INVESTMENT">Capital / Investment</option>
                    <option value="GENERAL">General Goal</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="text-xs text-delta-negative bg-[rgba(235,87,87,0.1)] p-2 rounded border border-[rgba(235,87,87,0.2)]">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded text-xs text-text-tertiary hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-surface-active hover:bg-surface-hover text-text-primary border border-border transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingGoal ? "Save Changes" : "Create Goal"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
