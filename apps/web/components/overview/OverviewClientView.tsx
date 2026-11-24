"use client";

import React, { useEffect } from "react";
import {
  DailyPacing,
  GlobalConfig,
  IntelligenceBundleResponse,
  KillSwitchResponse,
  MonthlySnapshot,
  OptimisticRoutineSpendPayload,
  SavingsVault,
  Transaction,
  applyOptimisticRoutineSpendPatch,
  fetchGlobalConfig,
  fetchIntelligenceBundle,
  fetchKillSwitches,
  fetchPacing,
  fetchSavingsVault,
  fetchSnapshot,
  fetchTransactions,
  getCached,
  setCached,
} from "@/lib/api";
import {
  OverviewExecutiveRibbon,
  OverviewIntelligenceStrip,
} from "@/components/finance/OverviewGoWidgets";
import { usePeriodSlice } from "@/hooks/usePeriodSlice";
import { useLanguage } from "@/context/LanguageContext";
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
import { BillSettlementChecklistCard } from "@/components/overview/BillSettlementChecklistCard";
import { OverviewDensityWrapper } from "@/components/overview/OverviewDensityWrapper";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";
import { formatSnapshotStatus } from "@/lib/utils";

export interface OverviewPeriodData {
  snapshot: MonthlySnapshot | null;
  pacing: DailyPacing | null;
  transactions: Transaction[];
  vault: SavingsVault | null;
  config: GlobalConfig | null;
  killSwitches: KillSwitchResponse | null;
  intelligence?: IntelligenceBundleResponse | null;
}

interface OverviewClientViewProps {
  initialMonth: number;
  initialYear: number;
  initialData: OverviewPeriodData;
}

export function OverviewClientView({
  initialMonth,
  initialYear,
  initialData,
}: OverviewClientViewProps) {
  const { t } = useLanguage();
  const { month, year, data, setData, isPreBoundary } =
    usePeriodSlice<OverviewPeriodData>({
      initialMonth,
      initialYear,
      initialData,
      seedCache: (m, y, d) => {
        if (d.snapshot) setCached(`snapshot:${m}:${y}`, d.snapshot);
        if (d.pacing) setCached(`pacing:${m}:${y}`, d.pacing);
        setCached(`transactions:${m}:${y}`, d.transactions);
        if (d.vault) setCached("savings:all:all", d.vault);
        if (d.config) setCached("globalConfig", d.config);
        if (d.killSwitches) setCached("killSwitches", d.killSwitches);
        if (d.intelligence) setCached(`intelligence:${m}:${y}:0`, d.intelligence);
      },
      readFromCache: (m, y, prev) => {
        const snapshot = getCached<MonthlySnapshot | null>(`snapshot:${m}:${y}`);
        const pacing = getCached<DailyPacing | null>(`pacing:${m}:${y}`);
        const transactions = getCached<Transaction[]>(`transactions:${m}:${y}`);
        if (
          snapshot === undefined ||
          pacing === undefined ||
          transactions === undefined
        ) {
          return undefined;
        }
        return {
          snapshot,
          pacing,
          transactions,
          vault: getCached<SavingsVault | null>("savings:all:all") ?? prev.vault,
          config: getCached<GlobalConfig | null>("globalConfig") ?? prev.config,
          killSwitches:
            getCached<KillSwitchResponse | null>("killSwitches") ??
            prev.killSwitches,
          intelligence:
            getCached<IntelligenceBundleResponse | null>(`intelligence:${m}:${y}:0`) ??
            null,
        };
      },
      fetchForPeriod: async (m, y) => {
        const [snapshot, pacing, transactions, vault, config, killSwitches, intelligence] =
          await Promise.all([
            fetchSnapshot(m, y),
            fetchPacing(m, y),
            fetchTransactions(m, y),
            fetchSavingsVault(),
            fetchGlobalConfig(),
            fetchKillSwitches(),
            fetchIntelligenceBundle(m, y),
          ]);
        if (config) setCached("globalConfig", config);
        if (killSwitches) setCached("killSwitches", killSwitches);
        return { snapshot, pacing, transactions, vault, config, killSwitches, intelligence };
      },
    });

  useEffect(() => {
    const handleOptimisticRoutine = (e: Event) => {
      const payload = (e as CustomEvent<OptimisticRoutineSpendPayload>).detail;
      if (!payload || payload.month !== month || payload.year !== year) return;
      setData((prev) => {
        const patched = applyOptimisticRoutineSpendPatch(
          prev.pacing,
          prev.transactions,
          payload
        );
        if (patched.pacing) setCached(`pacing:${month}:${year}`, patched.pacing);
        setCached(`transactions:${month}:${year}`, patched.transactions);
        return {
          ...prev,
          pacing: patched.pacing,
          transactions: patched.transactions,
        };
      });
    };
    window.addEventListener("erp:optimistic-routine-spend", handleOptimisticRoutine);
    return () =>
      window.removeEventListener(
        "erp:optimistic-routine-spend",
        handleOptimisticRoutine
      );
  }, [month, year, setData]);

  if (isPreBoundary) {
    return <PreBoundaryNotice month={month} year={year} />;
  }

  const { snapshot, pacing, transactions, vault, killSwitches, intelligence } = data;
  const trueHourlyWageRp = intelligence?.lifeenergy?.trueNetHourlyWageRp;
  const isLocked = snapshot?.status === "LOCKED";
  const deficitUncovered = snapshot?.deficitUncovered ?? 0;

  const fixedEssentialsTotal =
    (snapshot?.transport ?? 0) +
    (snapshot?.internet ?? 0) +
    (snapshot?.vape ?? 0) +
    (snapshot?.haircut ?? 0);
  const baselineTotal =
    fixedEssentialsTotal + (snapshot?.dailyOperational ?? 0);

  return (
    <div className="space-y-5 w-full max-w-full">
      {/* SECTION A: Top Executive Ribbon */}
      <OverviewExecutiveRibbon intel={intelligence ?? null} />

      {/* Snapshot Period Status Bar (Primary Context Leads) */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 pb-2.5 border-b border-border-subtle">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-medium font-sans text-text-primary whitespace-nowrap">
            {pacing?.cycleDateLabel
              ? `Active Cycle: ${pacing.cycleDateLabel}`
              : `Period: ${month}/${year}`}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-sans font-medium border whitespace-nowrap ${
              isLocked
                ? "bg-surface-subtle text-text-tertiary border-border-subtle"
                : "bg-[rgba(16,183,141,0.10)] text-delta-positive border-[rgba(16,183,141,0.25)]"
            }`}
          >
            {formatSnapshotStatus(snapshot?.status)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {snapshot && (
            <ClosePeriodModal
              snapshotId={snapshot.id}
              month={month}
              year={year}
              isLocked={isLocked}
              actualSavings={snapshot.actualSavings ?? 0}
              savingsTarget={snapshot.savings ?? 0}
              remainingOperational={
                pacing?.remainingBudget ??
                snapshot.actualDailyOperational ??
                0
              }
              deficitUncovered={snapshot.deficitUncovered ?? 0}
              existingPeriodVaultDeposit={
                vault?.periodDepositsByPeriod?.[`${year}-${month}`] ?? 0
              }
            />
          )}
        </div>
      </div>

      {/* Compact Shortfall Notice (single-line strip only when deficitUncovered > 0) */}
      <DeficitAlert deficitUncovered={deficitUncovered} month={month} year={year} />

      {/* Subscription Kill-Switch Alert Banner (rendered strictly when action is required) */}
      <SubscriptionKillSwitchBanner initialData={killSwitches} />

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
          <div className="text-[11px] font-sans text-text-tertiary font-semibold">
            Monthly Budget Overview
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* 1. Safe-to-Spend & 10-Second Balance Checkpoint */}
            <div className="order-1 lg:col-span-4 flex flex-col">
              <AdaptiveDailyPacingCard
                pacing={pacing}
                month={month}
                year={year}
                isLocked={isLocked}
                totalOperationalBudget={
                  pacing?.totalOperationalBudget ??
                  snapshot?.actualDailyOperational ??
                  0
                }
                transactions={transactions}
              />
            </div>

            {/* 2. Record Expense Quick Logger */}
            <div className="order-2 lg:order-3 lg:col-span-4 flex flex-col">
              <div className="hidden lg:flex flex-col gap-3">
                <CoreSavingsCard snapshot={snapshot} isLocked={isLocked} />
                <SelfRewardBufferCard snapshot={snapshot} isLocked={isLocked} />
                <RecordExpenseCard
                  month={month}
                  year={year}
                  isLocked={isLocked}
                  trueHourlyWageRp={trueHourlyWageRp}
                />
              </div>
              <div className="lg:hidden flex flex-col">
                <RecordExpenseCard
                  month={month}
                  year={year}
                  isLocked={isLocked}
                  trueHourlyWageRp={trueHourlyWageRp}
                />
              </div>
            </div>

            {/* 3. Routine Bills & Living Pool Quota */}
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

            {/* 4. Core Savings & Self-Reward Buffer (Mobile) */}
            <div className="order-4 lg:hidden flex flex-col gap-3">
              <CoreSavingsCard snapshot={snapshot} isLocked={isLocked} />
              <SelfRewardBufferCard snapshot={snapshot} isLocked={isLocked} />
            </div>
          </div>
        </section>
      </OverviewDensityWrapper>

      {/* SECTION C: FINANCIAL OUTLOOK & DEBT PAYOFF TRAJECTORY */}
      <section className="space-y-3">
        <div className="text-[11px] font-sans text-text-tertiary font-semibold">
          {t("intel.outlookTitle")}
        </div>
        <OverviewIntelligenceStrip intel={intelligence ?? null} />
      </section>

      {/* Section D: Cashflow breakdown, bill reservation checklist, and recent transactions */}
      <section className="space-y-4">
        <div className="text-[11px] font-sans text-text-tertiary font-semibold">
          Ledger Activity &amp; Cashflow Breakdown
        </div>

        <BillSettlementChecklistCard
          month={month}
          year={year}
          isLocked={isLocked}
          remainingLivingCash={
            pacing?.remainingBudget ?? snapshot?.actualDailyOperational ?? 0
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="col-span-1 lg:col-span-5">
            {snapshot && <CashflowSummaryCard snapshot={snapshot} pacing={pacing} />}
          </div>

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
