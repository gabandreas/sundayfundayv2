"use strict";
"use client";

import React, { useEffect, useState } from "react";
import {
  GlobalConfig,
  OverviewPreferencesConfig,
  PayrollAdjustmentCalcType,
  PayrollAdjustmentStage,
  PayrollAdjustmentTemplateDto,
  PayrollComponentRule,
  PayrollFormulaType,
  ThrConfig,
  createPayrollTemplateApi,
  deletePayrollTemplateApi,
  fetchPayrollTemplatesApi,
  updateGlobalConfig,
  updatePayrollTemplateApi,
  updateStudioConfigApi,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { ErpDatePicker } from "@/components/primitives/ErpDatePicker";
import { useToast } from "@/context/ToastContext";

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
  const { toast } = useToast();
  const [baseSalary, setBaseSalary] = useState<number>(config.baseSalary ?? 0);
  const [dailyAllowance, setDailyAllowance] = useState<number>(config.dailyAllowance ?? 0);
  const [laptopAllowance, setLaptopAllowance] = useState<number>(config.laptopAllowance ?? 0);
  const [payrollPayoutDay, setPayrollPayoutDay] = useState<number>(config.payrollPayoutDay ?? 25);

  const initialRules: PayrollComponentRule[] =
    config.payrollRules && config.payrollRules.length > 0
      ? config.payrollRules
      : DEFAULT_PAYROLL_RULES;

  const [rules, setRules] = useState<PayrollComponentRule[]>(initialRules);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  // Recurring & Direct Payroll Adjustment Templates (PostgreSQL table)
  const [templates, setTemplates] = useState<PayrollAdjustmentTemplateDto[]>(
    config.payrollAdjustmentTemplates ?? [],
  );
  const [isAddingTpl, setIsAddingTpl] = useState(false);
  const [tplLabel, setTplLabel] = useState("");
  const [tplStage, setTplStage] = useState<PayrollAdjustmentStage>("POST_NET_DEDUCTION");
  const [tplCalcType, setTplCalcType] = useState<PayrollAdjustmentCalcType>("FIXED");
  const [tplAmount, setTplAmount] = useState<number>(0);
  const [tplRecurring, setTplRecurring] = useState<boolean>(true);
  const [tplNotes, setTplNotes] = useState<string>("");
  const [isMutatingTpl, setIsMutatingTpl] = useState(false);

  // Conditional Holiday Bonus (THR) & Overview Preferences (studioConfig)
  const existingThr: ThrConfig = config.studioConfig?.thrConfig ?? {
    enabled: true,
    label: "THR / Holiday Bonus",
    payoutMonth: 12,
    calculationMode: "EXACT_DAYS_365",
    includeFixedAllowances: false,
  };
  const [thrEnabled, setThrEnabled] = useState<boolean>(existingThr.enabled ?? true);
  const [thrLabel, setThrLabel] = useState<string>(existingThr.label ?? "THR / Holiday Bonus");
  const [thrPayoutMonth, setThrPayoutMonth] = useState<number>(existingThr.payoutMonth ?? 12);
  const [thrCalcMode, setThrCalcMode] = useState<NonNullable<ThrConfig["calculationMode"]>>(
    existingThr.calculationMode ?? "EXACT_DAYS_365",
  );
  const [thrJoinDateIso, setThrJoinDateIso] = useState<string>(existingThr.joinDateIso ?? "");
  const [thrHolidayDateIso, setThrHolidayDateIso] = useState<string>(existingThr.holidayDateIso ?? "");
  const [thrIncludeFixed, setThrIncludeFixed] = useState<boolean>(
    existingThr.includeFixedAllowances ?? false,
  );

  const existingOverviewPrefs: OverviewPreferencesConfig =
    config.studioConfig?.overviewPreferences ?? {
      defaultPacingMode: "FLAT",
      showDiscretionaryCard: true,
    };
  const [defaultPacingMode, setDefaultPacingMode] = useState<"FLAT" | "WEIGHTED_1_5X">(
    existingOverviewPrefs.defaultPacingMode ?? "FLAT",
  );
  const [showDiscretionaryCard, setShowDiscretionaryCard] = useState<boolean>(
    existingOverviewPrefs.showDiscretionaryCard ?? true,
  );
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPayrollTemplatesApi().then((list) => {
      if (active && Array.isArray(list) && list.length > 0) {
        setTemplates(list);
      }
    });
    return () => {
      active = false;
    };
  }, []);

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
        const msg = "Payroll formula configuration saved successfully.";
        setFeedback({ type: "success", message: msg });
        toast({ title: "Payroll Saved", description: msg, variant: "success" });
      } else {
        const err = res.error || "Failed to save payroll configuration.";
        setFeedback({ type: "error", message: err });
        toast({ title: "Save Failed", description: err, variant: "error" });
      }
    } catch (e: any) {
      const err = e.message || "Network error";
      setFeedback({ type: "error", message: err });
      toast({ title: "Save Failed", description: err, variant: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!tplLabel.trim() || isMutatingTpl) return;
    setIsMutatingTpl(true);
    const res = await createPayrollTemplateApi({
      label: tplLabel.trim(),
      stage: tplStage,
      calcType: tplCalcType,
      defaultAmount: Math.max(0, Number(tplAmount) || 0),
      isRecurring: tplRecurring,
      isActive: true,
      notes: tplNotes.trim() || undefined,
    });
    setIsMutatingTpl(false);
    if (res.success && res.data) {
      setTemplates((prev) => [...prev, res.data!]);
      setTplLabel("");
      setTplAmount(0);
      setTplNotes("");
      setIsAddingTpl(false);
      toast({
        title: "Payroll Template Saved",
        description: `Created "${res.data.label}".`,
        variant: "success",
      });
    } else {
      toast({
        title: "Template Failed",
        description: res.error || "Failed to create template.",
        variant: "error",
      });
    }
  };

  const handleToggleTemplateField = async (
    tpl: PayrollAdjustmentTemplateDto,
    field: "isActive" | "isRecurring",
  ) => {
    if (isMutatingTpl) return;
    setIsMutatingTpl(true);
    const nextVal = !tpl[field];
    const res = await updatePayrollTemplateApi(tpl.id, { [field]: nextVal });
    setIsMutatingTpl(false);
    if (res.success && res.data) {
      setTemplates((prev) => prev.map((item) => (item.id === tpl.id ? res.data! : item)));
    } else {
      toast({
        title: "Update Failed",
        description: res.error || "Failed to update template.",
        variant: "error",
      });
    }
  };

  const handleDeleteTemplate = async (tpl: PayrollAdjustmentTemplateDto) => {
    if (isMutatingTpl) return;
    setIsMutatingTpl(true);
    const res = await deletePayrollTemplateApi(tpl.id);
    setIsMutatingTpl(false);
    if (res.success) {
      setTemplates((prev) => prev.filter((item) => item.id !== tpl.id));
      toast({
        title: "Template Deleted",
        description: `Removed "${tpl.label}".`,
        variant: "info",
      });
    } else {
      toast({
        title: "Delete Failed",
        description: res.error || "Failed to delete template.",
        variant: "error",
      });
    }
  };

  const handleSaveModulePreferences = async () => {
    setIsSavingPrefs(true);
    const updated = await updateStudioConfigApi({
      thrConfig: {
        enabled: thrEnabled,
        label: thrLabel.trim() || "THR / Holiday Bonus",
        payoutMonth: Math.min(12, Math.max(1, Number(thrPayoutMonth) || 12)),
        calculationMode: thrCalcMode,
        joinDateIso: thrJoinDateIso.trim() || undefined,
        holidayDateIso: thrHolidayDateIso.trim() || undefined,
        includeFixedAllowances: thrIncludeFixed,
      },
      overviewPreferences: {
        defaultPacingMode,
        showDiscretionaryCard,
      },
    });
    setIsSavingPrefs(false);
    if (updated) {
      toast({
        title: "Preferences Updated",
        description: "Saved Holiday Bonus (THR) and Overview display settings.",
        variant: "success",
      });
    } else {
      toast({
        title: "Save Failed",
        description: "Unable to save module preferences.",
        variant: "error",
      });
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
            <label className="block text-[11px] font-sans text-text-tertiary mb-1.5">
              Base Monthly Salary
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-text-tertiary">Rp</span>
              <input
                type="number"
                value={baseSalary}
                onChange={(e) => setBaseSalary(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-accent-primary"
              />
            </div>
            <p className="text-[10px] text-text-tertiary mt-1 font-mono">
              {formatRupiah(baseSalary)}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary mb-1.5">
              Attendance Daily Rate
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-text-tertiary">Rp</span>
              <input
                type="number"
                value={dailyAllowance}
                onChange={(e) => setDailyAllowance(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-accent-primary"
              />
            </div>
            <p className="text-[10px] text-text-tertiary mt-1 font-mono">
              {formatRupiah(dailyAllowance)} / day
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary mb-1.5">
              Laptop Allowance
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs text-text-tertiary">Rp</span>
              <input
                type="number"
                value={laptopAllowance}
                onChange={(e) => setLaptopAllowance(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-accent-primary"
              />
            </div>
            <p className="text-[10px] text-text-tertiary mt-1 font-mono">
              {formatRupiah(laptopAllowance)}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-sans text-text-tertiary mb-1.5">
              Default Payday Cutoff
            </label>
            <input
              type="number"
              min={1}
              max={31}
              value={payrollPayoutDay}
              onChange={(e) => setPayrollPayoutDay(Number(e.target.value))}
              className="w-full px-3 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-accent-primary"
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
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-tertiary mb-1">Direction</label>
                <select
                  value={newRuleDirection}
                  onChange={(e) => setNewRuleDirection(e.target.value as any)}
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
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
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
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
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
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
              <tr className="border-b border-[#282e3d] text-text-tertiary text-[10px]">
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
                        className="w-28 px-2 py-1 bg-[#0c0e14] border border-[#282e3d] rounded text-xs font-mono text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
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

      {/* Direct Payroll Deductions & Adjustment Templates */}
      <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-text-primary tracking-tight">
              Direct Payroll Deductions &amp; Employer Templates
            </h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              Define recurring salary advance clawbacks, post-net deductions (such as Benefit by GreatDay), or custom employer stipends without changing core code.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddingTpl((prev) => !prev)}
            className="px-2.5 py-1.5 bg-[#1f2430] hover:bg-[#282e3d] text-text-primary rounded text-xs border border-[#282e3d] transition-colors cursor-pointer"
          >
            {isAddingTpl ? "Close Form" : "+ Add Direct Deduction Template"}
          </button>
        </div>

        {isAddingTpl && (
          <div className="p-3.5 rounded border border-[#282e3d] bg-[#0c0e14] space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] text-text-tertiary mb-1">Label</label>
                <input
                  type="text"
                  placeholder="e.g. Benefit by GreatDay: Cash Advance Repayment"
                  value={tplLabel}
                  onChange={(e) => setTplLabel(e.target.value)}
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs text-text-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-tertiary mb-1">Payroll Stage</label>
                <select
                  value={tplStage}
                  onChange={(e) => setTplStage(e.target.value as PayrollAdjustmentStage)}
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs text-text-primary"
                >
                  <option value="POST_NET_DEDUCTION">Direct Deduction (Post-Net)</option>
                  <option value="PRE_NET_DEDUCTION">Pre-Net Deduction</option>
                  <option value="PRE_NET_EARNING">Pre-Net Earning (+)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-text-tertiary mb-1">Calculation Type</label>
                <select
                  value={tplCalcType}
                  onChange={(e) => setTplCalcType(e.target.value as PayrollAdjustmentCalcType)}
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs text-text-primary"
                >
                  <option value="FIXED">Fixed Nominal (Rp)</option>
                  <option value="PERCENT_OF_BASE">% of Base Salary</option>
                  <option value="PER_WORKING_DAY">Per Working Day</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-text-tertiary mb-1">Default Amount / Rate</label>
                <input
                  type="number"
                  value={tplAmount}
                  onChange={(e) => setTplAmount(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs font-mono text-text-primary"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <input
                type="text"
                placeholder="Optional note (e.g. Deducted directly before bank transfer)"
                value={tplNotes}
                onChange={(e) => setTplNotes(e.target.value)}
                className="w-full px-2 py-1 bg-[#161922] border border-[#282e3d] rounded text-xs text-text-primary"
              />
              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tplRecurring}
                    onChange={(e) => setTplRecurring(e.target.checked)}
                    className="rounded border-[#282e3d]"
                  />
                  <span>Auto-seed on new draft months</span>
                </label>
                <button
                  type="button"
                  disabled={isMutatingTpl || !tplLabel.trim()}
                  onClick={() => void handleCreateTemplate()}
                  className="px-3 py-1 bg-accent-primary text-[#0c0e14] font-medium rounded text-xs hover:opacity-90 disabled:opacity-40 cursor-pointer"
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        )}

        {templates.length === 0 ? (
          <div className="text-xs text-text-tertiary py-3">
            No custom payroll templates configured yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#282e3d] text-text-tertiary text-[10px]">
                  <th className="py-2 px-3">Active</th>
                  <th className="py-2 px-3">Template Label</th>
                  <th className="py-2 px-3">Stage</th>
                  <th className="py-2 px-3">Default</th>
                  <th className="py-2 px-3">Auto-Seed</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#282e3d]">
                {templates.map((tpl) => (
                  <tr key={tpl.id} className={tpl.isActive ? "" : "opacity-50"}>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        disabled={isMutatingTpl}
                        onClick={() => void handleToggleTemplateField(tpl, "isActive")}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                          tpl.isActive
                            ? "bg-[#16231c] border-[#204e35] text-[#4ade80]"
                            : "bg-[#1f2430] border-[#282e3d] text-text-tertiary"
                        }`}
                      >
                        {tpl.isActive ? "Active" : "Paused"}
                      </button>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-text-primary">{tpl.label}</div>
                      {tpl.notes && <div className="text-[10px] text-text-tertiary">{tpl.notes}</div>}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-text-secondary">
                      {tpl.stage === "POST_NET_DEDUCTION"
                        ? "Direct Deduction (Post-Net)"
                        : tpl.stage === "PRE_NET_DEDUCTION"
                          ? "Pre-Net Deduction"
                          : "Pre-Net Earning"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-text-primary tabular-nums">
                      {tpl.calcType === "PERCENT_OF_BASE"
                        ? `${tpl.defaultAmount}%`
                        : tpl.calcType === "PER_WORKING_DAY"
                          ? `${formatRupiah(tpl.defaultAmount)}/d`
                          : formatRupiah(tpl.defaultAmount)}
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        disabled={isMutatingTpl}
                        onClick={() => void handleToggleTemplateField(tpl, "isRecurring")}
                        className="px-2 py-0.5 rounded text-[10px] font-mono border border-[#282e3d] bg-[#0c0e14] text-text-secondary cursor-pointer"
                      >
                        {tpl.isRecurring ? "Recurring" : "Manual Only"}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        disabled={isMutatingTpl}
                        onClick={() => void handleDeleteTemplate(tpl)}
                        className="text-rose-400 hover:text-rose-300 text-xs cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Holiday Bonus (THR) & Overview Preferences */}
      <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-5 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-text-primary tracking-tight">
            Seasonal Bonus (THR) &amp; Overview Preferences
          </h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            Control when the holiday bonus estimator appears and choose your default daily pacing display on Overview.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-xs text-text-primary font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={thrEnabled}
                onChange={(e) => setThrEnabled(e.target.checked)}
                className="rounded border-[#282e3d]"
              />
              <span>Enable Holiday Bonus (THR) Estimator</span>
            </label>
            <input
              type="text"
              value={thrLabel}
              onChange={(e) => setThrLabel(e.target.value)}
              placeholder="Holiday Bonus (THR)"
              className="w-full px-2.5 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs text-text-primary"
            />
          </div>

          <div>
            <label className="block text-[11px] text-text-tertiary mb-1.5">
              Expected Payout Month
            </label>
            <select
              value={thrPayoutMonth}
              onChange={(e) => setThrPayoutMonth(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs text-text-primary"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>
                  Month {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-text-tertiary mb-1.5">
              Proration Formula Mode
            </label>
            <select
              value={thrCalcMode}
              onChange={(e) =>
                setThrCalcMode(e.target.value as NonNullable<ThrConfig["calculationMode"]>)
              }
              className="w-full px-2.5 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs text-text-primary"
            >
              <option value="EXACT_DAYS_365">Exact Service Days / 365</option>
              <option value="STATUTORY_MONTHS_12">Completed Months / 12</option>
              <option value="FULL_MONTH">Full 1 Month Base</option>
              <option value="MANUAL">Manual Entry Only</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-[11px] text-text-tertiary mb-1.5">
              Employment Start Date (Optional)
            </label>
            <ErpDatePicker
              value={thrJoinDateIso}
              onChange={setThrJoinDateIso}
              ariaLabel="Employment Start Date"
            />
          </div>
          <div>
            <label className="block text-[11px] text-text-tertiary mb-1.5">
              Holiday Cutoff Date (Optional)
            </label>
            <ErpDatePicker
              value={thrHolidayDateIso}
              onChange={setThrHolidayDateIso}
              ariaLabel="Holiday Cutoff Date"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-text-secondary pb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={thrIncludeFixed}
              onChange={(e) => setThrIncludeFixed(e.target.checked)}
              className="rounded border-[#282e3d]"
            />
            <span>Include fixed allowances in THR base</span>
          </label>
        </div>

        <div className="pt-4 border-t border-[#282e3d] grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <label className="block text-[11px] text-text-tertiary mb-1.5">
              Default Overview Spending Pace Mode
            </label>
            <select
              value={defaultPacingMode}
              onChange={(e) =>
                setDefaultPacingMode(e.target.value as "FLAT" | "WEIGHTED_1_5X")
              }
              className="w-full px-2.5 py-1.5 bg-[#0c0e14] border border-[#282e3d] rounded text-xs text-text-primary"
            >
              <option value="FLAT">Flat Daily Rate (Recommended)</option>
              <option value="WEIGHTED_1_5X">Weekend 1.5x Split</option>
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-text-secondary md:pt-5 cursor-pointer">
            <input
              type="checkbox"
              checked={showDiscretionaryCard}
              onChange={(e) => setShowDiscretionaryCard(e.target.checked)}
              className="rounded border-[#282e3d]"
            />
            <span>Show Discretionary &amp; Reserve card on Overview</span>
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={isSavingPrefs}
            onClick={() => void handleSaveModulePreferences()}
            className="px-4 py-2 bg-[#282e3d] hover:bg-[#343b4e] text-text-primary font-medium rounded text-xs border border-[#3b4356] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSavingPrefs ? "Saving..." : "Save THR & Overview Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
