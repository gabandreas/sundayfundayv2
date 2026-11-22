import React from "react";
import {
  GlobalConfig,
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

export const dynamic = "force-dynamic";

const FALLBACK_CONFIG: GlobalConfig = {
  id: 1,
  baseSalary: 5300000,
  dailyAllowance: 25000,
  laptopAllowance: 250000,
  dailyOperational: 1500000,
  transport: 300000,
  internet: 0,
  vape: 150000,
  haircut: 85000,
  baseSavings: 1000000,
  creditLimit: 7000000,
  creditStatementDay: 25,
  creditDueDay: 11,
  payrollPayoutDay: 27,
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
    criticalOperationalFloorRp: 1000000,
    runwayMilestoneMonths: [3, 6, 12],
  },
  lifeStagePreset: "SUPERADMIN_BESPOKE",
  enabledModulesJson: [
    "overview",
    "corporate_payroll",
    "allocations",
    "credit_liabilities",
    "savings_vault",
    "ledger",
    "wishlist_simulator",
    "discipline_audit",
    "advanced_analytics",
    "executive_reports",
  ],
  uiDensityMode: "COMMAND_COCKPIT",
  profileMode: "SUPERADMIN_BESPOKE",
  killSwitchLeadDays: 14,
  killSwitchBannerEnabled: true,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

const TAB_ALIASES: Record<string, PreferencesTabKey> = {
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

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams?: Promise<{ sub?: string; tab?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const raw = sp.sub || sp.tab || "";
  const currentTab: PreferencesTabKey = isValidPreferencesTab(raw)
    ? raw
    : TAB_ALIASES[raw] ?? "formula";

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

  return (
    <div className="space-y-6 w-full max-w-full">
      <div>
        <h1 className="text-xl font-semibold font-sans text-text-primary tracking-tight">
          Modular ERP Configuration Studio
        </h1>
        <p className="text-xs font-sans text-text-tertiary mt-1">
          Table-driven paycycle &amp; waterfall formulas, payment instrument cutoffs, cash &amp; savings accounts, routine rollover templates, sidebar shortcut builder, and SMTP guard.
        </p>
      </div>

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
