"use client";

import React from "react";
import {
  CustomFeatureRequest,
  EmailStatusResponse,
  GlobalConfig,
  KillSwitchNotificationConfig,
  KillSwitchResponse,
} from "@/lib/api";
import { PreferencesNav } from "./PreferencesNav";
import { usePeriod } from "@/context/PeriodContext";
import { PREFERENCES_TAB_KEYS, PreferencesTabKey } from "@/lib/tabs";
import { useSubModule } from "@/hooks/useSubModule";
import { ModuleManagerTab } from "./ModuleManagerTab";
import { PayrollFormulaTab } from "./PayrollFormulaTab";
import { AllocationBucketsTab } from "./AllocationBucketsTab";
import { FormulaSandboxTab } from "./FormulaSandboxTab";
import { RiskPolicyTab } from "./RiskPolicyTab";
import { CustomRequestStudio } from "./CustomRequestStudio";
import { SubscriptionKillSwitchTab } from "./SubscriptionKillSwitchTab";
import { MarqueeAiSettingsPanel } from "./MarqueeAiSettingsPanel";
import {
  AssetAccountsTableCard,
  InstrumentsTableCard,
  PaycycleFormulaStudioCard,
  RoutineTemplatesTableCard,
  SidebarMenuBuilderCard,
} from "./StudioTables";

interface PreferencesStudioProps {
  initialTab: PreferencesTabKey;
  config: GlobalConfig;
  activeMonth: number;
  activeYear: number;
  snapshotStatus?: string;
  initialCustomRequests: CustomFeatureRequest[];
  initialKillSwitches: KillSwitchResponse | null;
  initialKillSwitchNotificationConfig: KillSwitchNotificationConfig | null;
  initialEmailStatus: EmailStatusResponse | null;
}

const PREF_ALIASES: Record<string, PreferencesTabKey> = {
  payroll: "formula",
  sandbox: "formula",
  policy: "instruments",
  buckets: "templates",
  modules: "navigation",
  requests: "navigation",
  killswitch: "notifications",
  marquee: "ai",
  copilot: "ai",
};

export function PreferencesStudio({
  initialTab,
  config,
  activeMonth,
  activeYear,
  snapshotStatus,
  initialCustomRequests,
  initialKillSwitches,
  initialKillSwitchNotificationConfig,
  initialEmailStatus,
}: PreferencesStudioProps) {
  const [activeTab, selectTab] = useSubModule<PreferencesTabKey>(
    PREFERENCES_TAB_KEYS,
    initialTab,
    PREF_ALIASES,
  );
  const { month: periodMonth, year: periodYear } = usePeriod();
  const currentMonth = periodMonth || activeMonth;
  const currentYear = periodYear || activeYear;

  return (
    <div className="space-y-6 w-full max-w-full">
      <PreferencesNav currentTab={activeTab} onSelectTab={selectTab} />

      <div className="relative w-full">
        {activeTab === "formula" && (
          <div id="preferences-panel-formula" className="space-y-6">
            <PaycycleFormulaStudioCard initialConfig={config.studioConfig} />
            <PayrollFormulaTab config={config} />
            <FormulaSandboxTab config={config} />
          </div>
        )}

        {activeTab === "instruments" && (
          <div id="preferences-panel-instruments" className="space-y-6">
            <InstrumentsTableCard initialConfig={config.studioConfig} />
            <RiskPolicyTab config={config} />
          </div>
        )}

        {activeTab === "accounts" && (
          <div id="preferences-panel-accounts" className="space-y-6">
            <AssetAccountsTableCard initialConfig={config.studioConfig} />
          </div>
        )}

        {activeTab === "templates" && (
          <div id="preferences-panel-templates" className="space-y-6">
            <RoutineTemplatesTableCard initialConfig={config.studioConfig} />
            <AllocationBucketsTab
              config={config}
              activeMonth={currentMonth}
              activeYear={currentYear}
              snapshotStatus={snapshotStatus}
            />
          </div>
        )}

        {activeTab === "navigation" && (
          <div id="preferences-panel-navigation" className="space-y-6">
            <SidebarMenuBuilderCard initialConfig={config.studioConfig} />
            <ModuleManagerTab config={config} />
            <CustomRequestStudio initialRequests={initialCustomRequests} />
          </div>
        )}

        {activeTab === "notifications" && (
          <div id="preferences-panel-notifications" className="space-y-6">
            <SubscriptionKillSwitchTab
              config={config}
              activeMonth={currentMonth}
              activeYear={currentYear}
              initialKillSwitches={initialKillSwitches}
              initialNotificationConfig={initialKillSwitchNotificationConfig}
              initialEmailStatus={initialEmailStatus}
            />
          </div>
        )}

        {activeTab === "ai" && (
          <div id="preferences-panel-ai" className="space-y-6">
            <MarqueeAiSettingsPanel />
          </div>
        )}
      </div>
    </div>
  );
}
