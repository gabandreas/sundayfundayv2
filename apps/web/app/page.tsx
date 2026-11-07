import React from "react";
import {
  fetchSnapshot,
  fetchPacing,
  fetchTransactions,
  fetchSavingsVault,
  fetchGlobalConfig,
  fetchKillSwitches,
} from "@/lib/api";
import { CashflowSummaryCard } from "@/components/overview/CashflowSummaryCard";
import { RecentTransactionsTable } from "@/components/overview/RecentTransactionsTable";
import { DeficitAlert } from "@/components/overview/DeficitAlert";
import { SubscriptionKillSwitchBanner } from "@/components/overview/SubscriptionKillSwitchBanner";
import { ClosePeriodModal } from "@/components/overview/ClosePeriodModal";
import { RoutineBillsQuotaCard } from "@/components/overview/RoutineBillsQuotaCard";
import { AdaptiveDailyPacingCard } from "@/components/overview/AdaptiveDailyPacingCard";
import { CoreSavingsCard } from "@/components/overview/CoreSavingsCard";
import { SelfRewardBufferCard } from "@/components/overview/SelfRewardBufferCard";
import { RecordExpenseCard } from "@/components/overview/RecordExpenseCard";
import { OverviewDensityWrapper } from "@/components/overview/OverviewDensityWrapper";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";
import {
  formatSnapshotStatus,
  getDefaultPayrollPeriod,
} from "@/lib/utils";

interface OverviewPageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  const params = await searchParams;
  const defaultPeriod = getDefaultPayrollPeriod();
  const month = params.month ? parseInt(params.month, 10) : defaultPeriod.month;
  const year = params.year ? parseInt(params.year, 10) : defaultPeriod.year;

  // Temporal boundary guard: tracking begins in July 2026
  if (year < 2026 || (year === 2026 && month < 7)) {
    return <PreBoundaryNotice month={month} year={year} />;
  }

  // Fetch real data in parallel from backend API
  const [snapshot, pacing, transactions, vault, config, killSwitches] =
    await Promise.all([
      fetchSnapshot(month, year),
      fetchPacing(month, year),
      fetchTransactions(month, year),
      fetchSavingsVault(),
      fetchGlobalConfig(),
      fetchKillSwitches(),
    ]);

  const isLocked = snapshot?.status === "LOCKED";
  const deficitUncovered = snapshot?.deficitUncovered ?? 0;

  // Calculate essentials & operational baseline total
  const fixedEssentialsTotal =
    (snapshot?.transport ?? 0) +
    (snapshot?.internet ?? 0) +
    (snapshot?.vape ?? 0) +
    (snapshot?.haircut ?? 0);
  const baselineTotal = fixedEssentialsTotal + (snapshot?.dailyOperational ?? 0);

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Deficit Alert — only rendered if deficitUncovered > 0 */}
      <DeficitAlert deficitUncovered={deficitUncovered} />

      {/* Subscription Kill-Switch Alert Banner — rendered strictly when action is required */}
      <SubscriptionKillSwitchBanner initialData={killSwitches} />

      {/* Snapshot Period Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 pb-2 border-b border-border-subtle">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-sm font-medium font-sans text-text-primary whitespace-nowrap">
            {pacing?.cycleDateLabel ? `Active Cycle: ${pacing.cycleDateLabel}` : `Period: ${month}/${year}`}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium border whitespace-nowrap ${
              isLocked
                ? "bg-surface-subtle text-text-tertiary border-border-subtle"
                : "bg-[rgba(16,183,141,0.10)] text-delta-positive border-[rgba(16,183,141,0.25)]"
            }`}
          >
            {formatSnapshotStatus(snapshot?.status)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <span className="text-xs font-sans text-text-tertiary whitespace-nowrap">
            {isLocked
              ? "Finalized on record · All writes rejected"
              : "Active Period · Automatic recalculation enabled"}
          </span>
          {snapshot && (
            <ClosePeriodModal
              snapshotId={snapshot.id}
              month={month}
              year={year}
              isLocked={isLocked}
              actualSavings={snapshot.actualSavings ?? 0}
              savingsTarget={snapshot.savings ?? 0}
              remainingOperational={
                pacing?.remainingBudget ?? snapshot.actualDailyOperational ?? 0
              }
              deficitUncovered={snapshot.deficitUncovered ?? 0}
              existingPeriodVaultDeposit={
                vault?.periodDepositsByPeriod?.[`${year}-${month}`] ?? 0
              }
            />
          )}
        </div>
      </div>

      {/* SECTION 1: 3-COLUMN COMMAND COCKPIT OR SIMPLE CLARITY MODE */}
      <OverviewDensityWrapper
        snapshot={snapshot}
        pacing={pacing}
        vault={vault}
        month={month}
        year={year}
        isLocked={isLocked}
        fixedEssentialsTotal={fixedEssentialsTotal}
      >
        <section className="space-y-3">
          <div className="text-[11px] font-sans tracking-wider text-text-tertiary uppercase font-semibold">
            Monthly Budget Overview
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* 1. Safe-to-Spend & 10-Second Balance Checkpoint (Mobile: 1st, Desktop: Column 1) */}
            <div className="order-1 lg:col-span-4 flex flex-col">
              <AdaptiveDailyPacingCard
                pacing={pacing}
                month={month}
                year={year}
                isLocked={isLocked}
                totalOperationalBudget={
                  pacing?.totalOperationalBudget ??
                  snapshot?.actualDailyOperational ??
                  snapshot?.dailyOperational ??
                  0
                }
                transactions={transactions}
              />
            </div>

            {/* 2. Record Expense Quick Logger (Mobile: 2nd, Desktop: Column 3 container) */}
            <div className="order-2 lg:order-3 lg:col-span-4 flex flex-col">
              {/* Desktop Column 3: Stacked Core Savings, Self-Reward & Record Expense */}
              <div className="hidden lg:flex flex-col gap-3">
                <CoreSavingsCard snapshot={snapshot} isLocked={isLocked} />
                <SelfRewardBufferCard snapshot={snapshot} isLocked={isLocked} />
                <RecordExpenseCard month={month} year={year} isLocked={isLocked} />
              </div>
              {/* Mobile Order 2: Record Expense Card */}
              <div className="lg:hidden flex flex-col">
                <RecordExpenseCard month={month} year={year} isLocked={isLocked} />
              </div>
            </div>

            {/* 3. Routine Bills & Living Pool Quota (Mobile: 3rd, Desktop: Column 2) */}
            <div className="order-3 lg:order-2 lg:col-span-4 flex flex-col">
              <RoutineBillsQuotaCard
                snapshot={snapshot}
                pacing={pacing}
                month={month}
                year={year}
                isLocked={isLocked}
                baselineTotal={baselineTotal}
              />
            </div>

            {/* 4. Core Savings & Self-Reward Buffer (Mobile: 4th, Desktop: hidden as already inside Column 3) */}
            <div className="order-4 lg:hidden flex flex-col gap-3">
              <CoreSavingsCard snapshot={snapshot} isLocked={isLocked} />
              <SelfRewardBufferCard snapshot={snapshot} isLocked={isLocked} />
            </div>
          </div>
        </section>
      </OverviewDensityWrapper>

      {/* SECTION 2: CASHFLOW BREAKDOWN & RECENT TRANSACTIONS */}
      <section className="space-y-3">
        <div className="text-[11px] font-sans tracking-wider text-text-tertiary uppercase font-semibold">
          Ledger Activity & Cashflow Breakdown
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Cashflow Summary Card */}
          <div className="col-span-1 lg:col-span-5">
            {snapshot && <CashflowSummaryCard snapshot={snapshot} pacing={pacing} />}
          </div>

          {/* Recent Transaction List */}
          <div className="col-span-1 lg:col-span-7">
            <RecentTransactionsTable
              transactions={transactions}
              isLocked={isLocked}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
