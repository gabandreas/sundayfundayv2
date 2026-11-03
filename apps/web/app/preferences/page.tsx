import React from "react";
import { fetchGlobalConfig, fetchSnapshot, GlobalConfig } from "@/lib/api";
import { getDefaultPayrollPeriod } from "@/lib/utils";
import { PreferencesNav, PreferencesTabKey } from "@/components/preferences/PreferencesNav";
import { PayrollFormulaTab } from "@/components/preferences/PayrollFormulaTab";
import { AllocationBucketsTab } from "@/components/preferences/AllocationBucketsTab";
import { FormulaSandboxTab } from "@/components/preferences/FormulaSandboxTab";
import { RiskPolicyTab } from "@/components/preferences/RiskPolicyTab";
import { CustomRequestStudio } from "@/components/preferences/CustomRequestStudio";
import { ModuleManagerTab } from "@/components/preferences/ModuleManagerTab";
import { SubscriptionKillSwitchTab } from "@/components/preferences/SubscriptionKillSwitchTab";

export const metadata = {
  title: "Preferences & Modular Studio | Sunday Funday ERP",
  description: "Modular payroll formulas, dynamic budget buckets, formula sandbox, and financial risk policies.",
};

const fallbackConfig: GlobalConfig = {
  id: 1,
  baseSalary: 5891000,
  dailyAllowance: 20000,
  laptopAllowance: 250000,
  dailyOperational: 2850000,
  transport: 300000,
  internet: 250000,
  vape: 350000,
  haircut: 85000,
  baseSavings: 1000000,
  creditLimit: 7000000,
  creditStatementDay: 20,
  creditDueDay: 11,
  payrollPayoutDay: 25,
  ccUsageLimit: 0,
  paylaterUsageLimit: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface PreferencesPageProps {
  searchParams?: Promise<{ tab?: string }>;
}

export default async function PreferencesPage(props: PreferencesPageProps) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const currentTab = (searchParams.tab as PreferencesTabKey) || "payroll";
  const activePeriod = getDefaultPayrollPeriod();

  const [config, activeSnapshot] = await Promise.all([
    fetchGlobalConfig(),
    fetchSnapshot(activePeriod.month, activePeriod.year),
  ]);

  const resolvedConfig = config || fallbackConfig;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold font-sans text-text-primary tracking-tight">
          Modular ERP Configuration Studio
        </h1>
        <p className="text-xs font-sans text-text-tertiary mt-1">
          Rule-driven gross-to-net payroll formulas, dynamic budget priority tiers, interactive formula sandbox, and risk policy thresholds.
        </p>
      </div>

      {/* Tabs Navigation */}
      <PreferencesNav />

      {/* Tab Panels */}
      <div className="animate-in fade-in duration-150">
        {currentTab === "modules" && <ModuleManagerTab config={resolvedConfig} />}

        {currentTab === "payroll" && <PayrollFormulaTab config={resolvedConfig} />}

        {currentTab === "buckets" && (
          <AllocationBucketsTab
            config={resolvedConfig}
            activeMonth={activePeriod.month}
            activeYear={activePeriod.year}
            snapshotStatus={activeSnapshot?.status}
          />
        )}

        {currentTab === "sandbox" && <FormulaSandboxTab config={resolvedConfig} />}

        {currentTab === "policy" && <RiskPolicyTab config={resolvedConfig} />}

        {currentTab === "requests" && <CustomRequestStudio />}

        {currentTab === "killswitch" && <SubscriptionKillSwitchTab config={resolvedConfig} />}
      </div>
    </div>
  );
}
