import React from "react";
import {
  GlobalConfig,
  SUNDAY_FUNDAY_STANDARD_MODULES,
  fetchCustomRequests,
  fetchEmailStatus,
  fetchGlobalConfig,
  fetchKillSwitchNotificationConfig,
  fetchKillSwitches,
  fetchSnapshot,
} from "@/lib/api";
import { getDefaultPeriodFromNow } from "@/lib/utils";
import { isValidPreferencesTab, PreferencesTabKey } from "@/lib/tabs";
import { PreferencesStudio } from "@/components/preferences/PreferencesStudio";
import { PageHeader } from "@/components/primitives/PageHeader";

export const dynamic = "force-dynamic";

const FALLBACK_CONFIG: GlobalConfig = {
  id: 0,
  baseSalary: 0,
  dailyAllowance: 0,
  laptopAllowance: 0,
  dailyOperational: 0,
  transport: 0,
  internet: 0,
  vape: 0,
  haircut: 0,
  baseSavings: 0,
  creditLimit: 0,
  creditStatementDay: 20,
  creditDueDay: 11,
  payrollPayoutDay: 1,
  ccUsageLimit: 0,
  paylaterUsageLimit: 0,
  payrollRules: [],
  allocationBuckets: [],
  surplusSplitRules: {
    splits: [],
  },
  financialPolicy: {
    optimalDebtRatioPercent: 20,
    maxSafeDebtRatioPercent: 35,
    targetSavingsRatePercent: 20,
    criticalOperationalFloorRp: 0,
    runwayMilestoneMonths: [3, 6, 12],
  },
  lifeStagePreset: "STANDARD_GENERAL",
  enabledModulesJson: [...SUNDAY_FUNDAY_STANDARD_MODULES],
  uiDensityMode: "COMMAND_COCKPIT",
  profileMode: "STANDARD_GENERAL",
  killSwitchLeadDays: 14,
  killSwitchBannerEnabled: true,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

const TAB_ALIASES: Record<string, PreferencesTabKey> = {
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

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams?: Promise<{ sub?: string; tab?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const raw = sp.sub || sp.tab || "";

  const activePeriod = getDefaultPeriodFromNow();

  const [
    config,
    activeSnapshot,
    customRequests,
    killSwitches,
    notifConfig,
    emailStatus,
  ] = await Promise.all([
    fetchGlobalConfig(),
    fetchSnapshot(activePeriod.month, activePeriod.year),
    fetchCustomRequests(),
    fetchKillSwitches(),
    fetchKillSwitchNotificationConfig(),
    fetchEmailStatus(),
  ]);

  const resolvedConfig = config ?? FALLBACK_CONFIG;
  const currentTab: PreferencesTabKey = isValidPreferencesTab(raw)
    ? raw
    : TAB_ALIASES[raw] ??
      (resolvedConfig.profileMode === "SUPERADMIN_BESPOKE" ? "formula" : "display");

  return (
    <div className="space-y-6 w-full max-w-full">
      <PageHeader
        title="Workspace Preferences"
        subtitle="Payment methods & accounts, budget categories, display & password controls, notifications, and backups."
      />

      <PreferencesStudio
        initialTab={currentTab}
        config={resolvedConfig}
        activeMonth={activePeriod.month}
        activeYear={activePeriod.year}
        snapshotStatus={activeSnapshot?.status}
        initialCustomRequests={customRequests}
        initialKillSwitches={killSwitches}
        initialKillSwitchNotificationConfig={notifConfig}
        initialEmailStatus={emailStatus}
      />
    </div>
  );
}
