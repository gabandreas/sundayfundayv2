"use client";

import React, { useState } from "react";
import { usePerspective } from "@/context/PerspectiveContext";
import { useToast } from "@/context/ToastContext";
import {
  GlobalConfig,
  MODULE_REGISTRY_CATALOG,
  LIFE_STAGE_PRESET_CATALOG,
  ModuleKey,
  LifeStagePreset,
  updateGlobalConfig,
} from "@/lib/api";

interface ModuleManagerTabProps {
  config: GlobalConfig;
}

export function ModuleManagerTab({ config }: ModuleManagerTabProps) {
  const {
    enabledModules,
    lifeStagePreset,
    setEnabledModules,
    setUiDensityMode,
    setLifeStagePreset,
    setIsOnboardingOpen,
  } = usePerspective();

  const { toast } = useToast();
  const [savingMessage, setSavingMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (!savingMessage) return;
    toast({
      title: "Modules & layout updated",
      description: savingMessage,
      variant: "success",
    });
  }, [savingMessage, toast]);

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

      {/* Modular App Registry */}
      <div className="bg-surface border border-border rounded-md p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Modular App Registry
            </h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              Toggle pluggable modules ON or OFF. Disabled modules are hidden from the Sidebar navigation without deleting historical records. Display density lives under General &amp; Display.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono text-text-secondary">
              {enabledModules.length} Modules Enabled
            </span>
            <button
              type="button"
              onClick={() => setIsOnboardingOpen(true)}
              className="px-3 py-1.5 text-xs font-medium rounded border border-border-strong bg-surface-subtle text-text-primary hover:bg-surface transition-colors cursor-pointer"
            >
              Launch Workspace Setup
            </button>
          </div>
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

      {/* Section 3: Quick Apply Workspace Blueprint Presets */}
      <div className="bg-surface border border-border rounded-md p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Workspace Blueprint Presets
          </h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            One-click preset bundles that configure active modules, default formula engine, and UI density based on your cashflow structure.
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
                    ? "border-accent/50 bg-accent/[0.06] ring-1 ring-accent/20"
                    : "border-border bg-surface"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text-primary">
                      {preset.title}
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

