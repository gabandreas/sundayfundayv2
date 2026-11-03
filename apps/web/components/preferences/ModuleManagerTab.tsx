"use client";

import React, { useState } from "react";
import { usePerspective } from "@/context/PerspectiveContext";
import {
  GlobalConfig,
  MODULE_REGISTRY_CATALOG,
  LIFE_STAGE_PRESET_CATALOG,
  ModuleKey,
  LifeStagePreset,
  UiDensityMode,
  updateGlobalConfig,
} from "@/lib/api";

interface ModuleManagerTabProps {
  config: GlobalConfig;
}

export function ModuleManagerTab({ config }: ModuleManagerTabProps) {
  const {
    enabledModules,
    uiDensityMode,
    lifeStagePreset,
    setEnabledModules,
    setUiDensityMode,
    setLifeStagePreset,
    setIsOnboardingOpen,
  } = usePerspective();

  const [savingMessage, setSavingMessage] = useState<string | null>(null);

  const handleToggleModule = async (key: ModuleKey, isCore: boolean) => {
    if (isCore) return;
    const exists = enabledModules.includes(key);
    const next = exists
      ? enabledModules.filter((m) => m !== key)
      : [...enabledModules, key];
    await setEnabledModules(next);
    setSavingMessage("Active modules updated. Sidebar navigation synced.");
    setTimeout(() => setSavingMessage(null), 2500);
  };

  const handleSelectDensity = async (mode: UiDensityMode) => {
    await setUiDensityMode(mode);
    setSavingMessage(
      mode === "SIMPLE_CLARITY"
        ? "Switched to Simple Clarity Mode (Senior / Minimalist)."
        : "Switched to Command Cockpit Mode (Full ERP)."
    );
    setTimeout(() => setSavingMessage(null), 2500);
  };

  const handleApplyPresetModules = async (presetId: LifeStagePreset) => {
    const presetMeta = LIFE_STAGE_PRESET_CATALOG.find((p) => p.id === presetId);
    if (!presetMeta) return;
    await setLifeStagePreset(presetId);
    await setEnabledModules(presetMeta.enabledModules);
    await setUiDensityMode(presetMeta.uiDensityMode);
    await updateGlobalConfig({
      lifeStagePreset: presetId,
      enabledModulesJson: presetMeta.enabledModules,
      uiDensityMode: presetMeta.uiDensityMode,
      formulaEngineType: presetMeta.formulaEngineType,
    });
    setSavingMessage(`Applied "${presetMeta.title}" module & formula preset.`);
    setTimeout(() => setSavingMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      {savingMessage && (
        <div className="px-4 py-2.5 rounded border border-positive/30 bg-positive/10 text-positive text-xs font-mono">
          {savingMessage}
        </div>
      )}

      {/* Section 1: UI Density Mode Switcher */}
      <div className="bg-surface border border-border rounded-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              UI Density & Accessibility Mode
            </h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              Choose between the dense 3-column financial command cockpit or the high-contrast 4-card layout designed for quick clarity and senior accessibility.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOnboardingOpen(true)}
            className="px-3 py-1.5 text-xs font-medium rounded border border-border-strong bg-surface-subtle text-text-primary hover:bg-surface transition-colors"
          >
            Launch 60-Second Life-Stage Wizard
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleSelectDensity("COMMAND_COCKPIT")}
            className={`text-left p-4 rounded border transition-colors ${
              uiDensityMode === "COMMAND_COCKPIT"
                ? "border-text-primary bg-surface-subtle"
                : "border-border bg-surface hover:bg-surface-subtle/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">
                Command Cockpit (Default ERP)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border text-text-secondary">
                {uiDensityMode === "COMMAND_COCKPIT" ? "ACTIVE" : "SELECT"}
              </span>
            </div>
            <p className="text-xs text-text-tertiary mt-1.5">
              Full 3-column Overview dashboard, granular pacing telemetry, 12-month liability matrix, and modular bucket breakdowns.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSelectDensity("SIMPLE_CLARITY")}
            className={`text-left p-4 rounded border transition-colors ${
              uiDensityMode === "SIMPLE_CLARITY"
                ? "border-text-primary bg-surface-subtle"
                : "border-border bg-surface hover:bg-surface-subtle/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">
                Simple Clarity (Senior / Minimalist Mode)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border text-text-secondary">
                {uiDensityMode === "SIMPLE_CLARITY" ? "ACTIVE" : "SELECT"}
              </span>
            </div>
            <p className="text-xs text-text-tertiary mt-1.5">
              Enlarged 16px–18px typography, high-contrast 4-card Overview (Monthly Income, Safe Daily Spend, Routine Bills, Savings), and simplified controls.
            </p>
          </button>
        </div>
      </div>

      {/* Section 2: Odoo-Style Pluggable Module Registry */}
      <div className="bg-surface border border-border rounded-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Odoo-Style Modular App Registry
            </h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              Toggle pluggable ERP modules ON or OFF. Disabled modules are hidden from the Sidebar navigation without deleting any underlying historical records.
            </p>
          </div>
          <span className="text-xs font-mono text-text-secondary">
            {enabledModules.length} Modules Enabled
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {MODULE_REGISTRY_CATALOG.map((mod) => {
            const isEnabled = mod.isCore || enabledModules.includes(mod.key);
            return (
              <div
                key={mod.key}
                className={`p-3.5 rounded border flex items-start justify-between gap-3 ${
                  isEnabled
                    ? "border-border bg-surface-subtle/60"
                    : "border-border-subtle bg-surface opacity-70"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text-primary">
                      {mod.label}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-border text-text-tertiary">
                      {mod.isCore ? "CORE" : "PLUGGABLE"}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-1 leading-relaxed">
                    {mod.description}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isEnabled}
                  aria-label={`Toggle ${mod.label}`}
                  disabled={mod.isCore}
                  onClick={() => handleToggleModule(mod.key, mod.isCore)}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-medium border shrink-0 transition-colors ${
                    mod.isCore
                      ? "border-border-subtle bg-surface text-text-tertiary cursor-not-allowed"
                      : isEnabled
                        ? "border-positive/40 bg-positive/15 text-positive hover:bg-positive/25"
                        : "border-border bg-surface text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {mod.isCore ? "ALWAYS ON" : isEnabled ? "ENABLED" : "DISABLED"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Quick Apply Life-Stage Preset (Ages 20 to 70) */}
      <div className="bg-surface border border-border rounded-md p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Life-Stage Blueprint Presets (Ages 20–70)
          </h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            One-click preset bundles that configure active modules, default formula engine, and UI density for your current life stage.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {LIFE_STAGE_PRESET_CATALOG.map((preset) => {
            const isCurrent = lifeStagePreset === preset.id;
            return (
              <div
                key={preset.id}
                className={`p-3.5 rounded border flex items-center justify-between gap-4 ${
                  isCurrent
                    ? "border-text-primary bg-surface-subtle"
                    : "border-border bg-surface"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text-primary">
                      {preset.title}
                    </span>
                    <span className="text-[10px] font-mono text-text-tertiary px-1.5 py-0.5 rounded border border-border">
                      {preset.ageRange}
                    </span>
                    <span className="text-[10px] font-mono text-text-secondary">
                      {preset.formulaLabel}
                    </span>
                  </div>
                  <p className="text-xs text-text-tertiary">{preset.subtitle}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyPresetModules(preset.id)}
                  className="px-3 py-1.5 rounded text-xs font-medium border border-border bg-surface-subtle hover:bg-surface text-text-primary shrink-0 transition-colors"
                >
                  {isCurrent ? "Re-Apply Preset" : "Apply Preset"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

