"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePerspective } from "@/context/PerspectiveContext";
import {
  Wand2,
  X,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  updateGlobalConfig,
  PayrollMode,
  LifeStagePreset,
  LIFE_STAGE_PRESET_CATALOG,
  FormulaEngineType,
  UiDensityMode,
  ModuleKey,
} from "@/lib/api";

export function OnboardingWizardModal() {
  const { user } = useAuth();
  const {
    isOnboardingOpen,
    setIsOnboardingOpen,
    customRoutineLabels,
    saveCustomRoutineLabels,
    setPayrollMode,
    setLifeStagePreset,
    setEnabledModules,
    setUiDensityMode,
    setFormulaEngine,
  } = usePerspective();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Life-Stage Preset (Ages 20 to 70) + Income & Rhythm
  const [selectedPreset, setSelectedPreset] = useState<LifeStagePreset>(
    "CORPORATE_PROFESSIONAL"
  );
  const [selectedFormula, setSelectedFormula] = useState<FormulaEngineType>(
    "DEBT_FIRST_WATERFALL"
  );
  const [selectedDensity, setSelectedDensity] =
    useState<UiDensityMode>("COMMAND_COCKPIT");
  const [selectedModules, setSelectedModules] = useState<ModuleKey[]>(
    LIFE_STAGE_PRESET_CATALOG[1].enabledModules
  );

  const [incomeType, setIncomeType] = useState<PayrollMode>("SIMPLE_FIXED_SALARY");
  const [netIncomeStr, setNetIncomeStr] = useState("10000000");
  const [paydayAnchor, setPaydayAnchor] = useState(25);

  // Step 2: Routine Envelopes & Daily Living
  const [slot1Name, setSlot1Name] = useState(
    customRoutineLabels.transport || "Housing & Utilities"
  );
  const [slot1AmountStr, setSlot1AmountStr] = useState("2000000");

  const [slot2Name, setSlot2Name] = useState(
    customRoutineLabels.internet || "Commute & Fuel"
  );
  const [slot2AmountStr, setSlot2AmountStr] = useState("600000");

  const [slot3Name, setSlot3Name] = useState(
    customRoutineLabels.vape || "Internet & Subscriptions"
  );
  const [slot3AmountStr, setSlot3AmountStr] = useState("400000");

  const [slot4Name, setSlot4Name] = useState(
    customRoutineLabels.haircut || "Personal Care & Grooming"
  );
  const [slot4AmountStr, setSlot4AmountStr] = useState("250000");

  const [dailyLivingStr, setDailyLivingStr] = useState("3000000");

  // Step 3: Priority & Savings
  const [savingsTargetStr, setSavingsTargetStr] = useState("1500000");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOnboardingOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOnboardingOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOnboardingOpen, setIsOnboardingOpen]);

  if (!isOnboardingOpen) return null;

  const handleSelectLifeStage = (presetId: LifeStagePreset) => {
    const meta = LIFE_STAGE_PRESET_CATALOG.find((p) => p.id === presetId);
    if (!meta) return;
    setSelectedPreset(presetId);
    setSelectedFormula(meta.formulaEngineType);
    setSelectedDensity(meta.uiDensityMode);
    setSelectedModules(meta.enabledModules);
    setNetIncomeStr(String(meta.defaultSalary));
    setDailyLivingStr(String(meta.defaultDailyLiving));
    setSavingsTargetStr(String(meta.defaultSavings));

    if (meta.routineCategories[0]) {
      setSlot1Name(meta.routineCategories[0].label);
      setSlot1AmountStr(String(meta.routineCategories[0].target));
    }
    if (meta.routineCategories[1]) {
      setSlot2Name(meta.routineCategories[1].label);
      setSlot2AmountStr(String(meta.routineCategories[1].target));
    }
    if (meta.routineCategories[2]) {
      setSlot3Name(meta.routineCategories[2].label);
      setSlot3AmountStr(String(meta.routineCategories[2].target));
    }
    if (meta.routineCategories[3]) {
      setSlot4Name(meta.routineCategories[3].label);
      setSlot4AmountStr(String(meta.routineCategories[3].target));
    }

    if (presetId === "FREELANCER_VARIABLE") {
      setIncomeType("VARIABLE_FREELANCE");
    } else if (presetId === "RETIREE_GOLDEN_AGE") {
      setIncomeType("PENSION_PASSIVE");
    } else {
      setIncomeType("SIMPLE_FIXED_SALARY");
    }
  };

  const parseNum = (s: string) => {
    const val = parseInt(s.replace(/\D/g, ""), 10);
    return isNaN(val) ? 0 : val;
  };

  const netIncome = parseNum(netIncomeStr);
  const slot1Amount = parseNum(slot1AmountStr);
  const slot2Amount = parseNum(slot2AmountStr);
  const slot3Amount = parseNum(slot3AmountStr);
  const slot4Amount = parseNum(slot4AmountStr);
  const dailyLiving = parseNum(dailyLivingStr);
  const savingsTarget = parseNum(savingsTargetStr);

  const totalFixedRoutine =
    slot1Amount + slot2Amount + slot3Amount + slot4Amount;
  const totalCommitted = totalFixedRoutine + dailyLiving + savingsTarget;
  const projectedBuffer = Math.max(0, netIncome - totalCommitted);

  const isOwnerProtected = user?.id === 1 && user?.role === "PLATFORM_OWNER";

  const handleFinish = async (applyToSnapshots: boolean) => {
    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      const labels = {
        transport: slot1Name.trim() || "Transport & Fuel",
        internet: slot2Name.trim() || "Internet & Utilities",
        vape: slot3Name.trim() || "Subscriptions & Lifestyle",
        haircut: slot4Name.trim() || "Personal Care & Health",
      };

      const canMutateFinancialBaseline = applyToSnapshots && !isOwnerProtected;

      await saveCustomRoutineLabels(labels);
      await setPayrollMode(incomeType);
      await setLifeStagePreset(selectedPreset);
      await setEnabledModules(selectedModules);
      await setUiDensityMode(selectedDensity);

      if (!isOwnerProtected) {
        await setFormulaEngine(selectedFormula);
      }

      await updateGlobalConfig({
        payrollMode: incomeType,
        payrollPayoutDay: paydayAnchor,
        lifeStagePreset: selectedPreset,
        uiDensityMode: selectedDensity,
        enabledModulesJson: selectedModules,
        ...(isOwnerProtected ? {} : { formulaEngineType: selectedFormula }),
        customRoutineLabelsJson: labels,
        onboardingCompleted: true,
        ...(canMutateFinancialBaseline
          ? {
              baseSalary: netIncome,
              dailyOperational: dailyLiving,
              transport: slot1Amount,
              internet: slot2Amount,
              vape: slot3Amount,
              haircut: slot4Amount,
              baseSavings: savingsTarget,
              recalculateDrafts: true,
            }
          : {}),
      });

      setSuccessMessage(
        canMutateFinancialBaseline
          ? `Applied "${selectedPreset.replace(/_/g, " ")}" preset, active modules, and ${selectedFormula} engine to workspace.`
          : "Preset preferences & module visibility configured safely without altering protected owner snapshots."
      );

      setTimeout(() => {
        setIsOnboardingOpen(false);
        setSuccessMessage(null);
        setStep(1);
      }, 1500);
    } catch (e: any) {
      console.error("Onboarding submission error", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-lg border border-border bg-surface p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-surface-subtle border border-border-strong flex items-center justify-center text-text-primary">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold font-sans text-text-primary tracking-tight">
                60-Second Life-Stage Financial Setup Wizard (Ages 20–70)
              </h2>
              <p className="text-xs font-sans text-text-tertiary mt-0.5">
                Step {step} of 3 — Select your life-stage blueprint, active modules, and allocation formula.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOnboardingOpen(false)}
            className="p-1 rounded text-text-tertiary hover:text-text-primary cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { num: 1, title: "1. Life-Stage Preset (Ages 20–70)" },
            { num: 2, title: "2. Routine Envelopes & Living" },
            { num: 3, title: "3. Formula Engine & Summary" },
          ].map((s) => (
            <div key={s.num} className="space-y-1">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  step >= s.num ? "bg-delta-positive" : "bg-surface-subtle"
                }`}
              />
              <div className="text-[10px] font-mono text-text-tertiary">
                {s.title}
              </div>
            </div>
          ))}
        </div>

        {successMessage && (
          <div className="p-3 rounded bg-[rgba(16,183,141,0.10)] border border-[rgba(16,183,141,0.3)] text-xs font-mono text-delta-positive flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* STEP 1: 5 Life-Stage Presets (Ages 20 to 70) */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary block mb-2">
                Select Your Life-Stage Preset (Auto-Configures Modules, Formula & UI Density)
              </label>
              <div className="space-y-2">
                {LIFE_STAGE_PRESET_CATALOG.map((preset) => {
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectLifeStage(preset.id)}
                      className={`w-full p-3 rounded border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "bg-surface-subtle border-text-primary text-text-primary"
                          : "bg-surface border-border-subtle text-text-secondary hover:border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-primary">
                            {preset.title}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-text-tertiary">
                            {preset.ageRange}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-text-secondary">
                            {preset.formulaEngineType}
                          </span>
                          {preset.uiDensityMode === "SIMPLE_CLARITY" && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400">
                              SIMPLE CLARITY UI
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-text-tertiary mt-1">
                        {preset.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-subtle">
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary block mb-1.5">
                  Estimated Net Monthly Inflow / Pension
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-text-tertiary">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={
                      netIncomeStr
                        ? parseInt(netIncomeStr.replace(/\D/g, ""), 10).toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) => setNetIncomeStr(e.target.value)}
                    placeholder="10.000.000"
                    className="w-full pl-8 pr-3 py-1.5 rounded bg-surface-subtle border border-border text-xs font-mono text-text-primary outline-none focus:border-border-strong"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary block mb-1.5">
                  Monthly Payday / Pension Anchor Date
                </label>
                <select
                  value={paydayAnchor}
                  onChange={(e) => setPaydayAnchor(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-1.5 rounded bg-surface-subtle border border-border text-xs font-mono text-text-primary outline-none focus:border-border-strong"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}th of every month
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Envelopes & Daily Living */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs font-sans text-text-secondary leading-relaxed">
              Pre-filled for <strong>{selectedPreset.replace(/_/g, " ")}</strong>. Customize the names and monthly target budgets for your 4 primary routine envelopes:
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* Envelope 1 */}
              <div className="p-3 rounded bg-surface-subtle border border-border-subtle space-y-2">
                <input
                  type="text"
                  value={slot1Name}
                  onChange={(e) => setSlot1Name(e.target.value)}
                  className="w-full text-xs font-sans font-semibold text-text-primary bg-transparent border-b border-border-subtle pb-1 outline-none"
                />
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-text-tertiary">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={
                      slot1AmountStr
                        ? parseInt(slot1AmountStr.replace(/\D/g, ""), 10).toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) => setSlot1AmountStr(e.target.value)}
                    className="w-full pl-8 pr-2 py-1 rounded bg-surface border border-border-subtle text-xs font-mono text-text-primary outline-none"
                  />
                </div>
              </div>

              {/* Envelope 2 */}
              <div className="p-3 rounded bg-surface-subtle border border-border-subtle space-y-2">
                <input
                  type="text"
                  value={slot2Name}
                  onChange={(e) => setSlot2Name(e.target.value)}
                  className="w-full text-xs font-sans font-semibold text-text-primary bg-transparent border-b border-border-subtle pb-1 outline-none"
                />
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-text-tertiary">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={
                      slot2AmountStr
                        ? parseInt(slot2AmountStr.replace(/\D/g, ""), 10).toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) => setSlot2AmountStr(e.target.value)}
                    className="w-full pl-8 pr-2 py-1 rounded bg-surface border border-border-subtle text-xs font-mono text-text-primary outline-none"
                  />
                </div>
              </div>

              {/* Envelope 3 */}
              <div className="p-3 rounded bg-surface-subtle border border-border-subtle space-y-2">
                <input
                  type="text"
                  value={slot3Name}
                  onChange={(e) => setSlot3Name(e.target.value)}
                  className="w-full text-xs font-sans font-semibold text-text-primary bg-transparent border-b border-border-subtle pb-1 outline-none"
                />
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-text-tertiary">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={
                      slot3AmountStr
                        ? parseInt(slot3AmountStr.replace(/\D/g, ""), 10).toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) => setSlot3AmountStr(e.target.value)}
                    className="w-full pl-8 pr-2 py-1 rounded bg-surface border border-border-subtle text-xs font-mono text-text-primary outline-none"
                  />
                </div>
              </div>

              {/* Envelope 4 */}
              <div className="p-3 rounded bg-surface-subtle border border-border-subtle space-y-2">
                <input
                  type="text"
                  value={slot4Name}
                  onChange={(e) => setSlot4Name(e.target.value)}
                  className="w-full text-xs font-sans font-semibold text-text-primary bg-transparent border-b border-border-subtle pb-1 outline-none"
                />
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-text-tertiary">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={
                      slot4AmountStr
                        ? parseInt(slot4AmountStr.replace(/\D/g, ""), 10).toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) => setSlot4AmountStr(e.target.value)}
                    className="w-full pl-8 pr-2 py-1 rounded bg-surface border border-border-subtle text-xs font-mono text-text-primary outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Daily Operational Pool */}
            <div className="p-3.5 rounded border border-border bg-surface-subtle space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary block">
                Monthly Food & General Daily Living Target
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-text-tertiary">
                  Rp
                </span>
                <input
                  type="text"
                  value={
                    dailyLivingStr
                      ? parseInt(dailyLivingStr.replace(/\D/g, ""), 10).toLocaleString("id-ID")
                      : ""
                  }
                  onChange={(e) => setDailyLivingStr(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded bg-surface border border-border text-xs font-mono text-text-primary outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Formula Engine, UI Density & Savings */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary block mb-1.5">
                  Allocation Formula Engine
                </label>
                <select
                  value={selectedFormula}
                  onChange={(e) =>
                    setSelectedFormula(e.target.value as FormulaEngineType)
                  }
                  className="w-full px-3 py-2 rounded bg-surface-subtle border border-border text-xs font-mono text-text-primary"
                >
                  <option value="DEBT_FIRST_WATERFALL">
                    DEBT_FIRST_WATERFALL (Bills -&gt; Living -&gt; P1 Savings)
                  </option>
                  <option value="SAVINGS_FIRST_LOCK">
                    SAVINGS_FIRST_LOCK (Pay Yourself First)
                  </option>
                  <option value="PERCENTAGE_SPLIT">
                    PERCENTAGE_SPLIT (50/30/20 Proportional)
                  </option>
                  <option value="RETIREMENT_DRAWDOWN">
                    RETIREMENT_DRAWDOWN (Pension + Vault Drawdown)
                  </option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary block mb-1.5">
                  Dashboard UI Density Mode
                </label>
                <select
                  value={selectedDensity}
                  onChange={(e) =>
                    setSelectedDensity(e.target.value as UiDensityMode)
                  }
                  className="w-full px-3 py-2 rounded bg-surface-subtle border border-border text-xs font-mono text-text-primary"
                >
                  <option value="COMMAND_COCKPIT">
                    COMMAND_COCKPIT (Full 3-Column ERP)
                  </option>
                  <option value="SIMPLE_CLARITY">
                    SIMPLE_CLARITY (Senior / High-Contrast 4-Card)
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary block mb-1.5">
                Target Monthly Core Savings / Reserve
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-text-tertiary">
                  Rp
                </span>
                <input
                  type="text"
                  value={
                    savingsTargetStr
                      ? parseInt(savingsTargetStr.replace(/\D/g, ""), 10).toLocaleString("id-ID")
                      : ""
                  }
                  onChange={(e) => setSavingsTargetStr(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded bg-surface-subtle border border-border text-xs font-mono text-text-primary outline-none"
                />
              </div>
            </div>

            {/* Cashflow Feasibility Preview */}
            <div className="p-3.5 rounded bg-surface-subtle border border-border-subtle space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-[10px] uppercase text-text-tertiary tracking-wider font-semibold">
                <span>Projected Monthly Cashflow Summary</span>
                <span>{selectedModules.length} Modules Active</span>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1 border-t border-border-subtle/50 text-[11px]">
                <div>
                  <span className="text-text-tertiary block">Net Inflow:</span>
                  <span className="font-semibold text-text-primary">
                    {formatRupiah(netIncome)}
                  </span>
                </div>
                <div>
                  <span className="text-text-tertiary block">Routine Envelopes:</span>
                  <span className="font-semibold text-text-primary">
                    {formatRupiah(totalFixedRoutine)}
                  </span>
                </div>
                <div>
                  <span className="text-text-tertiary block">Daily Living:</span>
                  <span className="font-semibold text-text-primary">
                    {formatRupiah(dailyLiving)}
                  </span>
                </div>
                <div>
                  <span className="text-text-tertiary block">Uncommitted Buffer:</span>
                  <span
                    className={`font-semibold ${
                      projectedBuffer > 0 ? "text-delta-positive" : "text-caution"
                    }`}
                  >
                    {formatRupiah(projectedBuffer)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="px-3 py-1.5 rounded text-xs font-sans text-text-secondary hover:text-text-primary border border-border-subtle transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as any)}
                className="px-4 py-1.5 rounded text-xs font-sans font-medium bg-accent text-white hover:bg-accent/90 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFinish(false)}
                  className="px-3 py-1.5 rounded text-xs font-sans font-medium text-text-primary bg-surface-subtle hover:bg-surface-active border border-border transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Preview Configuration (Safe Demo)</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFinish(true)}
                  className="px-3.5 py-1.5 rounded text-xs font-sans font-medium bg-delta-positive text-black hover:bg-delta-positive/90 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Apply to Workspace</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
