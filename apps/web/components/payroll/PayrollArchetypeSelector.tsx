"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePerspective } from "@/context/PerspectiveContext";
import {
  PayrollMode,
  CustomIncomeDeductionRow,
  FormulaParams,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { Building2, Calendar, Briefcase, Plus, Trash2 } from "lucide-react";

export function PayrollArchetypeSelector() {
  const { user } = useAuth();
  const {
    profileMode,
    payrollMode,
    setPayrollMode,
    formulaEngineType,
    formulaParamsJson,
    setFormulaEngine,
  } = usePerspective();

  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState<number>(1000000);
  const [newDirection, setNewDirection] = useState<"INCOME" | "DEDUCTION">(
    "INCOME"
  );
  const [isSaving, setIsSaving] = useState(false);

  const isOwnerProtected = user?.id === 1 && profileMode === "SUPERADMIN_BESPOKE";
  if (isOwnerProtected) {
    return null;
  }

  const customRows: CustomIncomeDeductionRow[] =
    formulaParamsJson?.customPayrollRows || [];

  const handleAddCustomRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || newAmount <= 0) return;

    setIsSaving(true);
    try {
      const nextRow: CustomIncomeDeductionRow = {
        id: `custom_${Date.now()}`,
        label: newLabel.trim(),
        amount: Math.round(newAmount),
        direction: newDirection,
      };
      const nextParams: FormulaParams = {
        ...(formulaParamsJson || {}),
        customPayrollRows: [...customRows, nextRow],
      };
      await setFormulaEngine(formulaEngineType, nextParams);
      setNewLabel("");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveCustomRow = async (id: string) => {
    setIsSaving(true);
    try {
      const nextParams: FormulaParams = {
        ...(formulaParamsJson || {}),
        customPayrollRows: customRows.filter((r) => r.id !== id),
      };
      await setFormulaEngine(formulaEngineType, nextParams);
    } finally {
      setIsSaving(false);
    }
  };

  const archetypes: Array<{
    key: PayrollMode;
    label: string;
    description: string;
    icon: typeof Building2;
  }> = [
    {
      key: "SIMPLE_FIXED_SALARY",
      label: "Fixed Monthly Salary",
      description: "Predictable take-home pay, payday anchor & holiday bonus (THR).",
      icon: Building2,
    },
    {
      key: "BESPOKE_ATTENDANCE",
      label: "Attendance / Shift-Based",
      description: "Daily office allowance with 16–15 attendance cutoff tracking.",
      icon: Calendar,
    },
    {
      key: "VARIABLE_FREELANCE",
      label: "Variable / Freelance / Pension",
      description: "Custom multi-stream project payouts, pension inflows & tax deductions.",
      icon: Briefcase,
    },
  ];

  return (
    <div className="rounded-md border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
            Income Archetype & Custom Streams
          </span>
          <h3 className="text-xs font-semibold font-sans text-text-primary mt-0.5">
            Select Your Payroll Model & Custom Income / Deduction Rows
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[rgba(16,183,141,0.08)] border border-[rgba(16,183,141,0.2)] text-delta-positive">
          Modular Income Engine
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {archetypes.map((arch) => {
          const isActive = payrollMode === arch.key;
          const Icon = arch.icon;

          return (
            <button
              key={arch.key}
              type="button"
              onClick={() => setPayrollMode(arch.key)}
              className={`p-3 rounded border text-left transition-all cursor-pointer ${
                isActive
                  ? "bg-surface-subtle border-text-primary text-text-primary"
                  : "bg-surface border-border-subtle text-text-secondary hover:text-text-primary hover:border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? "text-text-primary" : "text-text-tertiary"
                    }`}
                  />
                  <span className="text-xs font-semibold font-sans">
                    {arch.label}
                  </span>
                </div>
              </div>
              <p className="text-[11px] font-sans text-text-tertiary mt-1.5 leading-snug">
                {arch.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Dynamic Custom Income & Deduction Rows */}
      <div className="pt-3 border-t border-border-subtle space-y-3">
        <div className="text-xs font-semibold text-text-primary">
          Custom Recurring Income & Deduction Streams
        </div>

        {customRows.length > 0 && (
          <div className="space-y-1.5">
            {customRows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between px-3 py-2 rounded border border-border-subtle bg-surface-subtle/50 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-mono rounded border ${
                      row.direction === "INCOME"
                        ? "border-positive/30 text-positive bg-positive/10"
                        : "border-negative/30 text-negative bg-negative/10"
                    }`}
                  >
                    {row.direction}
                  </span>
                  <span className="font-medium text-text-primary">
                    {row.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-text-primary">
                    {row.direction === "INCOME" ? "+" : "-"}
                    {formatRupiah(row.amount)}
                  </span>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleRemoveCustomRow(row.id)}
                    className="text-text-tertiary hover:text-negative transition-colors"
                    title="Remove custom stream"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleAddCustomRow}
          className="flex items-center gap-2 pt-1"
        >
          <select
            value={newDirection}
            onChange={(e) =>
              setNewDirection(e.target.value as "INCOME" | "DEDUCTION")
            }
            className="px-2.5 py-1.5 text-xs font-mono rounded border border-border bg-surface text-text-primary"
          >
            <option value="INCOME">+ INCOME STREAM</option>
            <option value="DEDUCTION">- DEDUCTION</option>
          </select>
          <input
            type="text"
            placeholder="e.g., Freelance Retainer, Pension Payout, Tax Withholding"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs rounded border border-border bg-surface text-text-primary"
          />
          <input
            type="number"
            min={10000}
            step={50000}
            value={newAmount}
            onChange={(e) => setNewAmount(Number(e.target.value))}
            className="w-32 px-2.5 py-1.5 text-xs font-mono rounded border border-border bg-surface text-text-primary"
          />
          <button
            type="submit"
            disabled={isSaving || !newLabel.trim()}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-text-primary text-background hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>
        </form>
      </div>
    </div>
  );
}
