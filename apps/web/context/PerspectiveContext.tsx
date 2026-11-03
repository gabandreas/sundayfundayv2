"use client";

import React, { createContext, useContext, useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  ProfileMode,
  PayrollMode,
  LifeStagePreset,
  UiDensityMode,
  FormulaEngineType,
  FormulaParams,
  ModuleKey,
  ALL_MODULE_KEYS,
  CustomRoutineLabels,
  fetchGlobalConfig,
  updateGlobalConfig,
} from "@/lib/api";
import { getRoutineEnvelopeLabel, getSavingsVaultLabels } from "@/lib/utils";

interface PerspectiveContextType {
  profileMode: ProfileMode;
  payrollMode: PayrollMode;
  lifeStagePreset: LifeStagePreset;
  uiDensityMode: UiDensityMode;
  enabledModules: ModuleKey[];
  formulaEngineType: FormulaEngineType;
  formulaParamsJson: FormulaParams | null;
  customRoutineLabels: CustomRoutineLabels;
  isOnboardingOpen: boolean;
  isCustomRequestModalOpen: boolean;
  isModuleEnabled: (key: ModuleKey) => boolean;
  setProfileMode: (mode: ProfileMode) => Promise<void>;
  toggleProfileMode: () => Promise<void>;
  setPayrollMode: (mode: PayrollMode) => Promise<void>;
  setEnabledModules: (modules: ModuleKey[]) => Promise<void>;
  setUiDensityMode: (mode: UiDensityMode) => Promise<void>;
  setLifeStagePreset: (preset: LifeStagePreset) => Promise<void>;
  setFormulaEngine: (engine: FormulaEngineType, params?: FormulaParams) => Promise<void>;
  setCustomRoutineLabel: (slot: string, label: string) => Promise<void>;
  saveCustomRoutineLabels: (labels: CustomRoutineLabels) => Promise<void>;
  setIsOnboardingOpen: (open: boolean) => void;
  setIsCustomRequestModalOpen: (open: boolean) => void;
  getRoutineLabel: (slot: string) => string;
  getVaultLabels: () => { liquid: string; investment: string };
}

const PerspectiveContext = createContext<PerspectiveContextType | undefined>(undefined);

export function PerspectiveProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { user } = useAuth();

  const [profileMode, setProfileModeState] = useState<ProfileMode>("SUPERADMIN_BESPOKE");
  const [payrollMode, setPayrollModeState] = useState<PayrollMode>("BESPOKE_ATTENDANCE");
  const [lifeStagePreset, setLifeStagePresetState] = useState<LifeStagePreset>("SUPERADMIN_BESPOKE");
  const [uiDensityMode, setUiDensityModeState] = useState<UiDensityMode>("COMMAND_COCKPIT");
  const [enabledModules, setEnabledModulesState] = useState<ModuleKey[]>([...ALL_MODULE_KEYS]);
  const [formulaEngineType, setFormulaEngineTypeState] = useState<FormulaEngineType>("DEBT_FIRST_WATERFALL");
  const [formulaParamsJson, setFormulaParamsJsonState] = useState<FormulaParams | null>(null);
  const [customRoutineLabels, setCustomRoutineLabelsState] = useState<CustomRoutineLabels>({});
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isCustomRequestModalOpen, setIsCustomRequestModalOpen] = useState(false);

  useEffect(() => {
    if (user?.blueprintType) {
      setProfileModeState(user.blueprintType);
    }
    if (user?.lifeStagePreset) {
      setLifeStagePresetState(user.lifeStagePreset);
    }
    if (user?.uiDensityMode) {
      setUiDensityModeState(user.uiDensityMode);
    }
  }, [user?.blueprintType, user?.lifeStagePreset, user?.uiDensityMode]);

  // Sync initial config from server whenever user changes
  useEffect(() => {
    let isMounted = true;
    fetchGlobalConfig().then((config) => {
      if (!isMounted || !config) return;
      if (config.profileMode) {
        setProfileModeState(config.profileMode);
      }
      if (config.payrollMode) {
        setPayrollModeState(config.payrollMode);
      }
      if (config.lifeStagePreset) {
        setLifeStagePresetState(config.lifeStagePreset);
      }
      if (config.uiDensityMode) {
        setUiDensityModeState(config.uiDensityMode);
      }
      if (Array.isArray(config.enabledModulesJson) && config.enabledModulesJson.length > 0) {
        setEnabledModulesState(config.enabledModulesJson as ModuleKey[]);
      } else {
        setEnabledModulesState([...ALL_MODULE_KEYS]);
      }
      if (config.formulaEngineType) {
        setFormulaEngineTypeState(config.formulaEngineType);
      }
      if (config.formulaParamsJson) {
        setFormulaParamsJsonState(config.formulaParamsJson);
      }
      if (config.customRoutineLabelsJson) {
        setCustomRoutineLabelsState(config.customRoutineLabelsJson);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const isModuleEnabled = (key: ModuleKey): boolean => {
    const coreModules: ModuleKey[] = ["overview", "income", "allocations", "ledger", "preferences"];
    if (coreModules.includes(key)) return true;
    if (!enabledModules || enabledModules.length === 0) return true;
    return enabledModules.includes(key);
  };

  const setEnabledModules = async (modules: ModuleKey[]) => {
    const coreModules: ModuleKey[] = ["overview", "income", "allocations", "ledger", "preferences"];
    const merged = Array.from(new Set([...coreModules, ...modules]));
    setEnabledModulesState(merged);
    try {
      await updateGlobalConfig({ enabledModulesJson: merged });
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      console.error("Failed to persist enabledModulesJson", e);
    }
  };

  const setUiDensityMode = async (mode: UiDensityMode) => {
    setUiDensityModeState(mode);
    try {
      await updateGlobalConfig({ uiDensityMode: mode });
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      console.error("Failed to persist uiDensityMode", e);
    }
  };

  const setLifeStagePreset = async (preset: LifeStagePreset) => {
    setLifeStagePresetState(preset);
    try {
      await updateGlobalConfig({ lifeStagePreset: preset });
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      console.error("Failed to persist lifeStagePreset", e);
    }
  };

  const setFormulaEngine = async (engine: FormulaEngineType, params?: FormulaParams) => {
    setFormulaEngineTypeState(engine);
    if (params !== undefined) {
      setFormulaParamsJsonState(params);
    }
    try {
      await updateGlobalConfig({
        formulaEngineType: engine,
        ...(params !== undefined ? { formulaParamsJson: params } : {}),
        recalculateDrafts: true,
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      console.error("Failed to persist formulaEngineType", e);
    }
  };

  const setProfileMode = async (newMode: ProfileMode) => {
    setProfileModeState(newMode);
    try {
      await updateGlobalConfig({ profileMode: newMode });
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      console.error("Failed to persist profileMode", e);
    }
  };

  const toggleProfileMode = async () => {
    const nextMode: ProfileMode =
      profileMode === "SUPERADMIN_BESPOKE" ? "STANDARD_GENERAL" : "SUPERADMIN_BESPOKE";
    await setProfileMode(nextMode);
  };

  const setPayrollMode = async (newMode: PayrollMode) => {
    setPayrollModeState(newMode);
    try {
      await updateGlobalConfig({ payrollMode: newMode });
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      console.error("Failed to persist payrollMode", e);
    }
  };

  const setCustomRoutineLabel = async (slot: string, label: string) => {
    const updated = {
      ...customRoutineLabels,
      [slot.toLowerCase()]: label.trim(),
    };
    setCustomRoutineLabelsState(updated);
    try {
      await updateGlobalConfig({ customRoutineLabelsJson: updated });
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      console.error("Failed to persist customRoutineLabels", e);
    }
  };

  const saveCustomRoutineLabels = async (labels: CustomRoutineLabels) => {
    setCustomRoutineLabelsState(labels);
    try {
      await updateGlobalConfig({ customRoutineLabelsJson: labels });
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      console.error("Failed to persist customRoutineLabels", e);
    }
  };

  const getRoutineLabel = (slot: string): string => {
    if (
      user?.role === "PLATFORM_OWNER" ||
      user?.lifeStagePreset === "SUPERADMIN_BESPOKE" ||
      profileMode === "SUPERADMIN_BESPOKE"
    ) {
      switch (slot.toLowerCase()) {
        case "transport":
          return "Transport";
        case "internet":
          return "Internet";
        case "vape":
          return "Vape";
        case "haircut":
          return "Haircut";
        default:
          return slot.charAt(0).toUpperCase() + slot.slice(1);
      }
    }
    return getRoutineEnvelopeLabel(slot, profileMode, customRoutineLabels);
  };

  const getVaultLabels = () => {
    return getSavingsVaultLabels(profileMode);
  };

  return (
    <PerspectiveContext.Provider
      value={{
        profileMode,
        payrollMode,
        lifeStagePreset,
        uiDensityMode,
        enabledModules,
        formulaEngineType,
        formulaParamsJson,
        customRoutineLabels,
        isOnboardingOpen,
        isCustomRequestModalOpen,
        isModuleEnabled,
        setProfileMode,
        toggleProfileMode,
        setPayrollMode,
        setEnabledModules,
        setUiDensityMode,
        setLifeStagePreset,
        setFormulaEngine,
        setCustomRoutineLabel,
        saveCustomRoutineLabels,
        setIsOnboardingOpen,
        setIsCustomRequestModalOpen,
        getRoutineLabel,
        getVaultLabels,
      }}
    >
      {children}
    </PerspectiveContext.Provider>
  );
}

export function usePerspective() {
  const context = useContext(PerspectiveContext);
  if (!context) {
    throw new Error("usePerspective must be used within a PerspectiveProvider");
  }
  return context;
}

