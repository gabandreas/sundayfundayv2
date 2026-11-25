"use client";

import React, { useEffect, useState } from "react";
import {
  IntelligenceBundleResponse,
  LiabilityLineItemDto,
  MonthlySnapshot,
  SavingsVault,
  fetchIntelligenceBundle,
  fetchLineItems,
  fetchSavingsVault,
  fetchSnapshot,
  getCached,
  setCached,
} from "@/lib/api";
import { usePeriodSlice } from "@/hooks/usePeriodSlice";
import { useSubModule } from "@/hooks/useSubModule";
import { SAVINGS_SUB_KEYS, SavingsSubKey } from "@/lib/tabs";
import { useLanguage } from "@/context/LanguageContext";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SubModuleNav } from "@/components/primitives/SubModuleNav";
import {
  NetWorthReservoirsPanel,
  WealthForecaster12MPanel,
} from "@/components/finance/ModuleGoPanels";
import { SavingsBalanceCard } from "@/components/savings/SavingsBalanceCard";
import { SavingsPocketsCard } from "@/components/savings/SavingsPocketsCard";
import { SavingsMilestonesCard } from "@/components/savings/SavingsMilestonesCard";
import { WealthTargetPlannerCard } from "@/components/savings/WealthTargetPlannerCard";
import { SavingsAccumulationTable } from "@/components/savings/SavingsAccumulationTable";
import { SavingsGoalsCard } from "@/components/savings/SavingsGoalsCard";
import { ManualSavingsForm } from "@/components/savings/ManualSavingsForm";
import { SavingsTransactionsTable } from "@/components/savings/SavingsTransactionsTable";
import { usePerspective } from "@/context/PerspectiveContext";
import { resolvePriorityTierLabel } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

export interface SavingsPeriodData {
  vault: SavingsVault | null;
  snapshot: MonthlySnapshot | null;
  p1RefundItems: LiabilityLineItemDto[];
}

interface SavingsClientViewProps {
  initialMonth: number;
  initialYear: number;
  initialEmpty?: boolean;
  initialData: SavingsPeriodData;
}

const FALLBACK_VAULT: SavingsVault = {
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

export function SavingsClientView({
  initialMonth,
  initialYear,
  initialEmpty = false,
  initialData,
}: SavingsClientViewProps) {
  const { t } = useLanguage();
  const { isAmountsMasked } = usePrivacyMask();
  const { studioConfig, updateStudioConfig } = usePerspective();
  const savingsTierLabel = resolvePriorityTierLabel(studioConfig, "SAVINGS", "Core Savings");
  const [activeSub, selectSub] = useSubModule<SavingsSubKey>(
    SAVINGS_SUB_KEYS,
    "pockets",
    {
      vault: "pockets",
      overview: "pockets",
      splits: "pockets",
      ledger: "pockets",
      goals: "pockets",
      networth: "runway",
      forecaster: "runway",
      projections: "runway",
    },
  );
  const [intel, setIntel] = useState<IntelligenceBundleResponse | null>(null);
  const [p1OverrideInput, setP1OverrideInput] = useState<string>(
    studioConfig?.actualP1VaultBalanceRp !== null &&
      studioConfig?.actualP1VaultBalanceRp !== undefined
      ? String(studioConfig.actualP1VaultBalanceRp)
      : "",
  );
  const [savingP1Override, setSavingP1Override] = useState(false);
  const [ledgerView, setLedgerView] = useState<"transactions" | "accumulation">("transactions");

  useEffect(() => {
    setP1OverrideInput(
      studioConfig?.actualP1VaultBalanceRp !== null &&
        studioConfig?.actualP1VaultBalanceRp !== undefined
        ? String(studioConfig.actualP1VaultBalanceRp)
        : "",
    );
  }, [studioConfig?.actualP1VaultBalanceRp]);

  const handleSaveP1Override = async (clear: boolean) => {
    setSavingP1Override(true);
    const cleaned = p1OverrideInput.replace(/\D/g, "");
    const nextVal = clear ? null : cleaned ? Number(cleaned) : null;
    await updateStudioConfig({ actualP1VaultBalanceRp: nextVal });
    window.dispatchEvent(new Event("erp:data-mutated"));
    setSavingP1Override(false);
  };
  const { month, year, revisionTick, data } = usePeriodSlice<SavingsPeriodData>({
    initialMonth,
    initialYear,
    initialData,
    seedCache: (m, y, d) => {
      if (d.vault) setCached(`savings:${m}:${y}`, d.vault);
      if (d.snapshot) setCached(`snapshot:${m}:${y}`, d.snapshot);
      setCached("p1RefundItems", d.p1RefundItems);
    },
    readFromCache: (m, y, prev) => {
      const vault = getCached<SavingsVault | null>(`savings:${m}:${y}`);
      const snapshot = getCached<MonthlySnapshot | null>(`snapshot:${m}:${y}`);
      if (vault === undefined || snapshot === undefined) return undefined;
      return {
        vault,
        snapshot,
        p1RefundItems:
          getCached<LiabilityLineItemDto[]>("p1RefundItems") ??
          prev.p1RefundItems,
      };
    },
    fetchForPeriod: async (m, y) => {
      const [vault, snapshot, p1RefundItems] = await Promise.all([
        fetchSavingsVault(m, y),
        fetchSnapshot(m, y),
        fetchLineItems({ category: "P1_VAULT_REFUND" }),
      ]);
      setCached("p1RefundItems", p1RefundItems);
      return { vault, snapshot, p1RefundItems };
    },
  });

  const activeVault = initialEmpty
    ? FALLBACK_VAULT
    : data.vault || FALLBACK_VAULT;
  const activeSnapshot = data.snapshot;
  const p1RefundItems = data.p1RefundItems;

  const ledger = activeVault.overview?.accumulationLedger ?? [];
  const goals = activeVault.overview?.goals ?? [];
  const avgMonthlySavings = activeVault.overview?.kpi.avgMonthlySavingsP1 ?? 426185;
  const activePeriodP1 = activeSnapshot?.actualSavings ?? 0;
  const scheduledP1RefundTotal = (p1RefundItems || [])
    .filter((i) => !i.isSettled)
    .reduce((sum, i) => sum + Math.round(i.monthlyAmount), 0);
  const threeMonthRunwayTarget =
    (activeVault.monthlyLivingExpenseBaseline || 4200000) * 3;
  const runwayCoveragePct = Math.min(
    100,
    Math.round(
      ((activeVault.balance || 0) / Math.max(1, threeMonthRunwayTarget)) * 100,
    ),
  );

  useEffect(() => {
    let active = true;
    const cached = getCached<IntelligenceBundleResponse | null>(`intelligence:${month}:${year}:0`);
    if (cached && revisionTick === 0) {
      setIntel(cached);
    } else {
      fetchIntelligenceBundle(month, year).then((res) => {
        if (active && res) setIntel(res);
      });
    }
    return () => {
      active = false;
    };
  }, [month, year, revisionTick]);

  return (
    <div className="space-y-6 w-full max-w-full">
      <PageHeader
        title={t("nav.savings")}
        subtitle="Divide confirmed savings into dedicated pockets, reconcile deposits, and model your survival runway."
        periodLabel={`${month}/${year}`}
      />

      <SubModuleNav
        items={[
          { key: "pockets", label: t("sub.savings.pockets") },
          { key: "runway", label: t("sub.savings.runway") },
        ]}
        activeKey={activeSub}
        onSelect={selectSub}
      />

      {activeSub === "pockets" && (
        <div className="space-y-5">
          {/* Reserve Summary Card + Cycle Metrics */}
          <SavingsBalanceCard vault={activeVault} />

          <div className="rounded-lg border border-border-default bg-surface grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border-subtle">
            <div className="p-3.5 min-w-0">
              <span className="text-[11px] font-sans font-medium text-text-tertiary block">
                Active {savingsTierLabel} ({month}/{year})
              </span>
              <span className="font-mono text-lg font-semibold text-delta-positive erp-tabular-currency mt-1 block">
                {formatRupiah(activePeriodP1, isAmountsMasked)}
              </span>
              <span className="text-[11px] font-sans text-text-tertiary mt-0.5 block">
                Allocated in active cycle pending close
              </span>
            </div>

            <div className="p-3.5 min-w-0">
              <span className="text-[11px] font-sans font-medium text-text-tertiary block">
                Scheduled Savings Repayments
              </span>
              <span className="font-mono text-lg font-semibold text-caution erp-tabular-currency mt-1 block">
                {formatRupiah(scheduledP1RefundTotal, isAmountsMasked)}
              </span>
              <span className="text-[11px] font-sans text-text-tertiary mt-0.5 block">
                {p1RefundItems.filter((i) => !i.isSettled).length} internal repayment(s) due
              </span>
            </div>

            <div className="p-3.5 min-w-0">
              <span className="text-[11px] font-sans font-medium text-text-tertiary block">
                Planned Savings Trajectory
              </span>
              <span className="font-mono text-lg font-semibold text-text-primary erp-tabular-currency mt-1 block">
                {formatRupiah(activeVault.overview?.kpi.totalPlanned2026P1 ?? 0, isAmountsMasked)}
              </span>
              <span className="text-[11px] font-sans text-text-tertiary mt-0.5 block">
                Avg {formatRupiah(avgMonthlySavings, isAmountsMasked)} / cycle ({runwayCoveragePct}% of 3-month floor)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-7 space-y-5">
              <SavingsPocketsCard
                totalConfirmedSavingsRp={
                  activeVault.pocketsSummary?.totalConfirmedSavingsRp ?? activeVault.balance ?? 0
                }
                initialPockets={activeVault.pocketsSummary?.pockets ?? studioConfig?.savingsPockets}
                onSaved={(saved) => {
                  updateStudioConfig({ savingsPockets: saved.pockets });
                  window.dispatchEvent(new Event("erp:data-mutated"));
                }}
              />

              <SavingsGoalsCard goals={goals} avgMonthlySavings={avgMonthlySavings} />
            </div>

            <div className="xl:col-span-5 space-y-5">
              <ManualSavingsForm
                untransferredLockedPeriods={
                  activeVault.untransferredLockedPeriods ?? []
                }
              />

              {(activeVault.milestones?.length ?? 0) > 0 && (
                <SavingsMilestonesCard
                  milestones={activeVault.milestones ?? []}
                  currentBalance={activeVault.balance ?? 0}
                  monthlyPace={avgMonthlySavings}
                />
              )}

              {/* Closed-Cycles Balance Override */}
              <div className="rounded-lg border border-border-default bg-surface p-4 space-y-3">
                <div>
                  <div className="text-xs font-semibold font-sans text-text-primary">
                    Actual Closed-Cycles Savings Balance
                  </div>
                  <p className="text-[11px] font-sans text-text-tertiary mt-0.5">
                    Optional balance override for past closed cycles (blank uses verified ledger entries).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    placeholder="Auto (from ledger)"
                    value={p1OverrideInput}
                    onChange={(e) => setP1OverrideInput(e.target.value)}
                    className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded bg-canvas border border-border text-xs font-mono text-text-primary tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                  />
                  <button
                    type="button"
                    disabled={savingP1Override}
                    onClick={() => handleSaveP1Override(false)}
                    className="px-3 py-1.5 rounded erp-btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    {savingP1Override ? "Saving..." : "Apply Override"}
                  </button>
                  {studioConfig?.actualP1VaultBalanceRp !== null &&
                    studioConfig?.actualP1VaultBalanceRp !== undefined && (
                      <button
                        type="button"
                        disabled={savingP1Override}
                        onClick={() => handleSaveP1Override(true)}
                        className="px-2.5 py-1.5 rounded border border-border text-xs font-mono text-text-secondary hover:bg-surface-hover cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div
              role="tablist"
              aria-label="Savings history views"
              className="inline-flex rounded-md border border-border bg-surface p-0.5 text-xs font-sans"
            >
              <button
                type="button"
                role="tab"
                aria-selected={ledgerView === "transactions"}
                onClick={() => setLedgerView("transactions")}
                className={`px-3.5 py-1.5 rounded transition-colors cursor-pointer ${
                  ledgerView === "transactions"
                    ? "bg-surface-active text-text-primary font-medium"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Deposit &amp; Withdrawal Ledger
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={ledgerView === "accumulation"}
                onClick={() => setLedgerView("accumulation")}
                className={`px-3.5 py-1.5 rounded transition-colors cursor-pointer ${
                  ledgerView === "accumulation"
                    ? "bg-surface-active text-text-primary font-medium"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Monthly Accumulation
              </button>
            </div>

            {ledgerView === "transactions" ? (
              <SavingsTransactionsTable transactions={activeVault.transactions} />
            ) : (
              <SavingsAccumulationTable ledger={ledger} />
            )}
          </div>
        </div>
      )}

      {activeSub === "runway" && (
        <div className="space-y-6">
          <NetWorthReservoirsPanel intel={intel} />
          <WealthForecaster12MPanel intel={intel} />
          <WealthTargetPlannerCard
            vault={activeVault}
            baselineMonth={month}
            baselineYear={year}
          />
        </div>
      )}
    </div>
  );
}
