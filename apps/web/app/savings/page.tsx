import React from "react";
import { fetchSavingsVault, fetchSnapshot } from "@/lib/api";
import { SavingsBalanceCard } from "@/components/savings/SavingsBalanceCard";
import { WealthTargetPlannerCard } from "@/components/savings/WealthTargetPlannerCard";
import { SavingsAccumulationTable } from "@/components/savings/SavingsAccumulationTable";
import { SavingsGoalsCard } from "@/components/savings/SavingsGoalsCard";
import { ManualSavingsForm } from "@/components/savings/ManualSavingsForm";
import { SavingsTransactionsTable } from "@/components/savings/SavingsTransactionsTable";
import { getDefaultPayrollPeriod } from "@/lib/utils";

interface SavingsPageProps {
  searchParams: Promise<{ month?: string; year?: string; empty?: string }>;
}

export default async function SavingsPage({ searchParams }: SavingsPageProps) {
  const params = await searchParams;
  const defaultPeriod = getDefaultPayrollPeriod();
  const month = params.month ? parseInt(params.month, 10) : defaultPeriod.month;
  const year = params.year ? parseInt(params.year, 10) : defaultPeriod.year;

  const [vault] = await Promise.all([
    fetchSavingsVault(month, year),
    fetchSnapshot(month, year),
  ]);

  const fallbackVault = {
    balance: 0,
    monthlyLivingExpenseBaseline: 4200000,
    runwayMonths: 0,
    milestones: [
      { months: 3, targetAmount: 12600000, progressPercent: 0, isAchieved: false },
      { months: 6, targetAmount: 25200000, progressPercent: 0, isAchieved: false },
      { months: 12, targetAmount: 50400000, progressPercent: 0, isAchieved: false },
    ],
    transactions: [],
    periodDepositsByPeriod: {},
    untransferredLockedPeriods: [],
    overview: {
      kpi: {
        totalVaultBalance: 0,
        liquidCashBalance: 0,
        investmentRdpuBalance: 0,
        liquidSharePercent: 100,
        rdpuSharePercent: 0,
        totalPlanned2026P1: 2557107,
        avgMonthlySavingsP1: 426185,
        averageMonthlySavingsRatePercent: 7.3,
      },
      accumulationLedger: [],
      goals: [],
    },
  };

  const activeVault = params.empty === "true" ? fallbackVault : (vault || fallbackVault);
  const ledger = activeVault.overview?.accumulationLedger ?? [];
  const goals = activeVault.overview?.goals ?? [];
  const avgMonthlySavings = activeVault.overview?.kpi.avgMonthlySavingsP1 ?? 426185;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div>
          <h1 className="text-xl font-bold font-sans tracking-tight text-text-primary">
            Savings Vault & Emergency Runway
          </h1>
          <p className="text-xs font-sans text-text-secondary mt-1">
            Liquid emergency reserves, snapshot-to-vault accumulation reconciliation, and target goal projections.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-sans text-text-tertiary">
            Baseline Period: <span className="font-mono text-text-secondary">{month}/{year}</span>
          </span>
        </div>
      </div>

      {/* Top 3 KPI Cards & Sub-Allocation */}
      <SavingsBalanceCard vault={activeVault} />

      {/* Target Wealth & Income Feasibility Guard */}
      <WealthTargetPlannerCard
        vault={activeVault}
        baselineMonth={month}
        baselineYear={year}
      />

      {/* Monthly Savings Accumulation & Reconciliation Table */}
      <SavingsAccumulationTable ledger={ledger} />

      {/* Target Savings Goals & Projections */}
      <SavingsGoalsCard goals={goals} avgMonthlySavings={avgMonthlySavings} />

      {/* Manual Vault Adjustment Form (with Retroactive Locked Period P1 Pre-fill) */}
      <ManualSavingsForm
        untransferredLockedPeriods={activeVault.untransferredLockedPeriods ?? []}
      />

      {/* Transaction History Table */}
      <SavingsTransactionsTable transactions={activeVault.transactions} />
    </div>
  );
}
