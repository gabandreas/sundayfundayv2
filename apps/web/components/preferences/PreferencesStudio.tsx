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
import { usePerspective } from "@/context/PerspectiveContext";
import { PREFERENCES_TAB_KEYS, PreferencesTabKey } from "@/lib/tabs";
import { useSubModule } from "@/hooks/useSubModule";
import { ModuleManagerTab } from "./ModuleManagerTab";
import { PayrollFormulaTab } from "./PayrollFormulaTab";
import { AllocationBucketsTab } from "./AllocationBucketsTab";
import { FormulaSandboxTab } from "./FormulaSandboxTab";
import { RiskPolicyTab } from "./RiskPolicyTab";
import { CustomRequestStudio } from "./CustomRequestStudio";
import { SubscriptionKillSwitchTab } from "./SubscriptionKillSwitchTab";
import { SmtpControlPanel } from "./SmtpControlPanel";
import { MarqueeAiSettingsPanel } from "./MarqueeAiSettingsPanel";
import { AccountDisplayPanel } from "./AccountDisplayPanel";
import { PriorityTiersEditor } from "./PriorityTiersEditor";
import { DatabaseBackupRestoreCard } from "./DatabaseBackupRestoreCard";
import { CategoryMasterTableCard } from "./CategoryMasterTableCard";
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
  accounts: "instruments",
  policy: "instruments",
  buckets: "templates",
  navigation: "display",
  modules: "display",
  requests: "display",
  marquee: "display",
  copilot: "display",
  ai: "display",
  account: "display",
  privacy: "display",
  killswitch: "notifications",
  smtp: "notifications",
  email: "notifications",
  database: "backup",
  restore: "backup",
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
  const { isBespokeWorkspace } = usePerspective();
  const [activeTab, selectTab] = useSubModule<PreferencesTabKey>(
    PREFERENCES_TAB_KEYS,
    initialTab,
    PREF_ALIASES,
  );
  const effectiveTab: PreferencesTabKey =
    !isBespokeWorkspace && activeTab === "formula" ? "display" : activeTab;
  const { month: periodMonth, year: periodYear } = usePeriod();
  const currentMonth = periodMonth || activeMonth;
  const currentYear = periodYear || activeYear;

  const samplePromoTemplate =
    initialKillSwitchNotificationConfig?.killSwitchCustomMessageTemplate ||
    "Notice: Promotional pricing for {{name}} expires on {{deadline}} ({{daysLeft}} remaining). To prevent automatic renewal at the standard rate of Rp {{normalPrice}}/month, cancel through your provider portal prior to cutoff: {{cancelUrl}}";

  return (
    <div className="space-y-6 w-full max-w-full pb-16">
      <PreferencesNav
        currentTab={effectiveTab}
        onSelectTab={selectTab}
        hideFormula={!isBespokeWorkspace}
      />

      <div className="relative w-full">
        {effectiveTab === "formula" && isBespokeWorkspace && (
          <div id="preferences-panel-formula" className="space-y-6">
            <PriorityTiersEditor initialConfig={config.studioConfig} />
            <PaycycleFormulaStudioCard initialConfig={config.studioConfig} />
            <PayrollFormulaTab config={config} />
            <FormulaSandboxTab config={config} />
          </div>
        )}

        {effectiveTab === "instruments" && (
          <div id="preferences-panel-instruments" className="space-y-6">
            <InstrumentsTableCard initialConfig={config.studioConfig} />
            <AssetAccountsTableCard initialConfig={config.studioConfig} />
            <RiskPolicyTab config={config} />
          </div>
        )}

        {effectiveTab === "templates" && (
          <div id="preferences-panel-templates" className="space-y-6">
            <RoutineTemplatesTableCard initialConfig={config.studioConfig} />
            <CategoryMasterTableCard initialConfig={config.studioConfig} />
            <AllocationBucketsTab
              config={config}
              activeMonth={currentMonth}
              activeYear={currentYear}
              snapshotStatus={snapshotStatus}
            />
          </div>
        )}

        {effectiveTab === "display" && (
          <div id="preferences-panel-display" className="space-y-6">
            <AccountDisplayPanel initialConfig={config.studioConfig} />
            <MarqueeAiSettingsPanel />
            <SidebarMenuBuilderCard initialConfig={config.studioConfig} />
            <ModuleManagerTab config={config} />
            <CustomRequestStudio initialRequests={initialCustomRequests} />
          </div>
        )}

        {effectiveTab === "notifications" && (
          <div id="preferences-panel-notifications" className="space-y-6">
            <SubscriptionKillSwitchTab
              config={config}
              activeMonth={currentMonth}
              activeYear={currentYear}
              initialKillSwitches={initialKillSwitches}
              initialNotificationConfig={initialKillSwitchNotificationConfig}
              initialEmailStatus={initialEmailStatus}
              hideSmtpPanel={true}
            />
            <SmtpControlPanel
              initialNotifConfig={initialKillSwitchNotificationConfig}
              initialEmailStatus={initialEmailStatus}
              customTemplate={samplePromoTemplate}
              activeMonth={currentMonth}
              activeYear={currentYear}
            />
          </div>
        )}

        {effectiveTab === "backup" && (
          <div id="preferences-panel-backup" className="space-y-6">
            <DatabaseBackupRestoreCard />
          </div>
        )}
      </div>
    </div>
  );
}
