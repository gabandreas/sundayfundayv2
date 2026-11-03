"use strict";
"use client";

import React, { useState } from "react";
import {
  GlobalConfig,
  PayrollComponentRule,
  PayrollFormulaType,
  updateGlobalConfig,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface PayrollFormulaTabProps {
  config: GlobalConfig;
}

const DEFAULT_PAYROLL_RULES: PayrollComponentRule[] = [
  {
    id: "bpjs",
    label: "BPJS Deduction (3%)",
    direction: "DEDUCTION",
    formulaType: "PERCENT_OF_BASE",
    value: 3,
    isActive: true,
  },
  {
    id: "laptop_allowance",
    label: "Laptop Allowance",
    direction: "ADDITION",
    formulaType: "FIXED_AMOUNT",
    value: 250000,
    isActive: true,
  },
  {
    id: "daily_attendance",
    label: "Attendance Daily Allowance",
    direction: "ADDITION",
    formulaType: "RATE_PER_WORKING_DAY",
    value: 20000,
    isActive: true,
  },
  {
    id: "december_thr",
    label: "December Pro-rated THR",
    direction: "ADDITION",
    formulaType: "PRORATED_MONTHS_OF_BASE",
    value: 8.83,
    isActive: true,
  },
];

export function PayrollFormulaTab({ config }: PayrollFormulaTabProps) {
  const [baseSalary, setBaseSalary] = useState<number>(config.baseSalary || 5891000);
  const [dailyAllowance, setDailyAllowance] = useState<number>(config.dailyAllowance || 20000);
  const [laptopAllowance, setLaptopAllowance] = useState<number>(config.laptopAllowance || 250000);
  const [payrollPayoutDay, setPayrollPayoutDay] = useState<number>(config.payrollPayoutDay || 25);

  const initialRules: PayrollComponentRule[] =
    config.payrollRules && config.payrollRules.length > 0
      ? config.payrollRules
      : DEFAULT_PAYROLL_RULES;

  const [rules, setRules] = useState<PayrollComponentRule[]>(initialRules);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  // New rule form modal/inline
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [newRuleLabel, setNewRuleLabel] = useState("");
  const [newRuleDirection, setNewRuleDirection] = useState<"ADDITION" | "DEDUCTION">("ADDITION");
  const [newRuleFormulaType, setNewRuleFormulaType] =
    useState<PayrollFormulaType>("FIXED_AMOUNT");
  const [newRuleValue, setNewRuleValue] = useState<number>(0);

  const handleToggleRule = (index: number) => {
    const updated = [...rules];
    updated[index].isActive = !updated[index].isActive;
    setRules(updated);
  };

  const handleUpdateRuleValue = (index: number, val: number) => {
    const updated = [...rules];
    updated[index].value = val;
    setRules(updated);
  };

  const handleDeleteRule = (index: number) => {
    const updated = rules.filter((_, i) => i !== index);
    setRules(updated);
  };

  const handleAddCustomRule = () => {
    if (!newRuleLabel.trim()) return;
    const slug = newRuleLabel.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const newRule: PayrollComponentRule = {
      id: `custom_${slug}_${Date.now().toString().slice(-4)}`,
      label: newRuleLabel.trim(),
      direction: newRuleDirection,
      formulaType: newRuleFormulaType,
      value: newRuleValue,
      isActive: true,
    };
    setRules([...rules, newRule]);
    setNewRuleLabel("");
    setNewRuleValue(0);
    setIsAddingRule(false);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await updateGlobalConfig({
        baseSalary,
        dailyAllowance,
        laptopAllowance,
        payrollPayoutDay,
        payrollRulesJson: rules,
      });
      if (res.success) {
        setFeedback({
          type: "success",
          message: "Payroll formula configuration saved successfully.",
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to save payroll configuration.",
        });
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Network error" });
    } finally {
      setIsSaving(false);
    }
  };

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

      {/* Salary & Attendance Baselines */}
      <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-5">
        <h2 className="text-sm font-semibold text-text-primary tracking-tight mb-4">
          Base Salary & Payday Governance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Base Monthly Salary
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-text-tertiary">Rp</span>
              <input
                type="number"
                value={baseSalary}
                onChange={(e) => setBaseSalary(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
              />
            </div>
            <p className="text-[10px] text-text-tertiary mt-1 font-mono">
              {formatRupiah(baseSalary)}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Attendance Daily Rate
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-text-tertiary">Rp</span>
              <input
                type="number"
                value={dailyAllowance}
                onChange={(e) => setDailyAllowance(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
              />
            </div>
            <p className="text-[10px] text-text-tertiary mt-1 font-mono">
              {formatRupiah(dailyAllowance)} / day
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Laptop Allowance
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-text-tertiary">Rp</span>
              <input
                type="number"
                value={laptopAllowance}
                onChange={(e) => setLaptopAllowance(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
              />
            </div>
            <p className="text-[10px] text-text-tertiary mt-1 font-mono">
              {formatRupiah(laptopAllowance)}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary uppercase tracking-wider mb-1.5">
              Default Payday Cutoff
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={payrollPayoutDay}
              onChange={(e) => setPayrollPayoutDay(Number(e.target.value))}
              className="w-full px-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
            />
            <p className="text-[10px] text-text-tertiary mt-1">
              Every {payrollPayoutDay}th of the month
            </p>
          </div>
        </div>
      </div>

      {/* Payroll Component Formulas Table */}
      <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary tracking-tight">
              Modular Payroll Additions & Deductions
            </h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              Rules evaluated to construct the gross-to-net salary paycheck.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddingRule(true)}
            className="px-2.5 py-1.5 bg-[#1f2430] hover:bg-[#282e3d] text-text-primary rounded text-xs border border-[#282e3d] transition-colors"
          >
            + Add Line-Item
          </button>
        </div>

        {/* Modal / Add Line */}
        {isAddingRule && (
          <div className="mb-4 p-3 bg-[#0c0e14] border border-[#282e3d] rounded space-y-3">
            <div className="text-xs font-semibold text-text-primary">Add Custom Payroll Line-Item</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] text-text-tertiary mb-1">Label</label>
                <input
                  type="text"
                  placeholder="e.g. Parking Subsidy"
                  value={newRuleLabel}
                  onChange={(e) => setNewRuleLabel(e.target.value)}
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs text-text-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-tertiary mb-1">Direction</label>
                <select
                  value={newRuleDirection}
                  onChange={(e) => setNewRuleDirection(e.target.value as any)}
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs text-text-primary focus:outline-none"
                >
                  <option value="ADDITION">+ Addition</option>
                  <option value="DEDUCTION">- Deduction</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-text-tertiary mb-1">Formula Mode</label>
                <select
                  value={newRuleFormulaType}
                  onChange={(e) => setNewRuleFormulaType(e.target.value as any)}
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs text-text-primary focus:outline-none"
                >
                  <option value="FIXED_AMOUNT">Fixed Nominal (Rp)</option>
                  <option value="PERCENT_OF_BASE">% of Base Salary</option>
                  <option value="RATE_PER_WORKING_DAY">Rate × Working Days</option>
                  <option value="PRORATED_MONTHS_OF_BASE">Prorated Months / 12</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-text-tertiary mb-1">Formula Value</label>
                <input
                  type="number"
                  value={newRuleValue}
                  onChange={(e) => setNewRuleValue(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingRule(false)}
                className="px-2.5 py-1 bg-[#161922] text-text-tertiary rounded text-xs hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCustomRule}
                className="px-2.5 py-1 bg-accent-primary text-[#0c0e14] font-medium rounded text-xs hover:opacity-90"
              >
                Confirm Add
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#282e3d] text-text-tertiary uppercase text-[10px] tracking-wider">
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Line-Item</th>
                <th className="py-2 px-3">Direction</th>
                <th className="py-2 px-3">Formula Mode</th>
                <th className="py-2 px-3">Value / Rate</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#282e3d]">
              {rules.map((rule, idx) => (
                <tr key={rule.id} className={rule.isActive ? "" : "opacity-40"}>
                  <td className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => handleToggleRule(idx)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                        rule.isActive
                          ? "bg-[#16231c] border-[#204e35] text-[#4ade80]"
                          : "bg-[#1f2430] border-[#282e3d] text-text-tertiary"
                      }`}
                    >
                      {rule.isActive ? "ACTIVE" : "OFF"}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-text-primary">{rule.label}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[11px] font-mono font-medium ${
                        rule.direction === "ADDITION" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {rule.direction === "ADDITION" ? "+ Addition" : "- Deduction"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-text-secondary font-mono text-[11px]">
                    {rule.formulaType === "FIXED_AMOUNT" && "Fixed Nominal"}
                    {rule.formulaType === "PERCENT_OF_BASE" && "% of Base Salary"}
                    {rule.formulaType === "RATE_PER_WORKING_DAY" && "Rate × Working Days"}
                    {rule.formulaType === "PRORATED_MONTHS_OF_BASE" && "Pro-rated (Months/12)"}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="number"
                        value={rule.value}
                        onChange={(e) => handleUpdateRuleValue(idx, Number(e.target.value))}
                        className="w-28 px-2 py-1 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus:outline-none"
                      />
                      <span className="text-[11px] text-text-tertiary font-mono">
                        {rule.formulaType === "PERCENT_OF_BASE" && "%"}
                        {rule.formulaType === "PRORATED_MONTHS_OF_BASE" && "mos"}
                        {rule.formulaType === "RATE_PER_WORKING_DAY" && "Rp/day"}
                        {rule.formulaType === "FIXED_AMOUNT" && "Rp"}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {rule.id.startsWith("custom_") && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(idx)}
                        className="text-rose-400 hover:text-rose-300 text-xs transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveAll}
            className="px-4 py-2 bg-[#282e3d] hover:bg-[#343b4e] text-text-primary font-medium rounded text-xs border border-[#3b4356] transition-colors disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Payroll Formulas"}
          </button>
        </div>
      </div>
    </div>
  );
}
