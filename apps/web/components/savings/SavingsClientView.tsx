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
import { SubModuleNav } from "@/components/primitives/SubModuleNav";
import {
  NetWorthReservoirsPanel,
  WealthForecaster12MPanel,
} from "@/components/finance/ModuleGoPanels";
import { SavingsBalanceCard } from "@/components/savings/SavingsBalanceCard";
import { WealthTargetPlannerCard } from "@/components/savings/WealthTargetPlannerCard";
import { SavingsAccumulationTable } from "@/components/savings/SavingsAccumulationTable";
import { SavingsGoalsCard } from "@/components/savings/SavingsGoalsCard";
import { ManualSavingsForm } from "@/components/savings/ManualSavingsForm";
import { SavingsTransactionsTable } from "@/components/savings/SavingsTransactionsTable";
import { usePerspective } from "@/context/PerspectiveContext";
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
  const { studioConfig, updateStudioConfig } = usePerspective();
  const [activeSub, selectSub] = useSubModule<SavingsSubKey>(SAVINGS_SUB_KEYS, "vault");
  const [intel, setIntel] = useState<IntelligenceBundleResponse | null>(null);
  const [p1OverrideInput, setP1OverrideInput] = useState<string>(
    studioConfig?.actualP1VaultBalanceRp !== null &&
      studioConfig?.actualP1VaultBalanceRp !== undefined
      ? String(studioConfig.actualP1VaultBalanceRp)
      : "",
  );
  const [savingP1Override, setSavingP1Override] = useState(false);

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
  const { month, year, data } = usePeriodSlice<SavingsPeriodData>({
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
    if (cached) {
      setIntel(cached);
    } else {
      fetchIntelligenceBundle(month, year).then((res) => {
        if (active && res) setIntel(res);
      });
    }
    return () => {
      active = false;
    };
  }, [month, year]);

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div>
          <h1 className="text-xl font-bold font-sans tracking-tight text-text-primary">
            {t("nav.savings")}
          </h1>
          <p className="text-xs font-sans text-text-secondary mt-1">
            Cash, debt, and P1 vault balances, 12-month wealth &amp; runway forecaster, and forward-borrow reconciliation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-sans text-text-tertiary">
            Baseline Period:{" "}
            <span className="font-mono text-text-secondary">
              {month}/{year}
            </span>
          </span>
        </div>
      </div>

      <SubModuleNav
        items={[
          { key: "networth", label: t("sub.savings.networth") },
          { key: "forecaster", label: t("sub.savings.forecaster") },
          { key: "vault", label: t("sub.savings.vault") },
        ]}
        activeKey={activeSub}
        onSelect={selectSub}
      />

      {activeSub === "networth" && <NetWorthReservoirsPanel intel={intel} />}

      {activeSub === "forecaster" && (
        <div className="space-y-6">
          <WealthForecaster12MPanel intel={intel} />
          <WealthTargetPlannerCard
            vault={activeVault}
            baselineMonth={month}
            baselineYear={year}
          />
        </div>
      )}

      {activeSub === "vault" && (
        <div className="space-y-6">
          {/* 3-Second Reserve & P1 Reconciliation Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border-default bg-surface p-3.5">
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-text-tertiary block">
                Physical Vault Reserve
              </span>
              <span className="font-mono text-lg font-semibold text-text-primary tabular-nums mt-1 block">
                {formatRupiah(activeVault.balance ?? 0)}
              </span>
              <span className="text-[11px] font-sans text-text-tertiary mt-0.5 block">
                {runwayCoveragePct}% of 3-month floor ({formatRupiah(threeMonthRunwayTarget)})
              </span>
            </div>

            <div className="rounded-lg border border-border-default bg-surface p-3.5">
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-text-tertiary block">
                Active P1 Allocation ({month}/{year})
              </span>
              <span className="font-mono text-lg font-semibold text-delta-positive tabular-nums mt-1 block">
                {formatRupiah(activePeriodP1)}
              </span>
              <span className="text-[11px] font-sans text-text-tertiary mt-0.5 block">
                Locked in period waterfall pending close
              </span>
            </div>

            <div className="rounded-lg border border-border-default bg-surface p-3.5">
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-text-tertiary block">
                Scheduled P1 Vault Refunds
              </span>
              <span className="font-mono text-lg font-semibold text-caution tabular-nums mt-1 block">
                {formatRupiah(scheduledP1RefundTotal)}
              </span>
              <span className="text-[11px] font-sans text-text-tertiary mt-0.5 block">
                {p1RefundItems.filter((i) => !i.isSettled).length} forward-borrow repayment(s) due
              </span>
            </div>

            <div className="rounded-lg border border-border-default bg-surface p-3.5">
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-text-tertiary block">
                2026 P1 Trajectory
              </span>
              <span className="font-mono text-lg font-semibold text-text-primary tabular-nums mt-1 block">
                {formatRupiah(activeVault.overview?.kpi.totalPlanned2026P1 ?? 0)}
              </span>
              <span className="text-[11px] font-sans text-text-tertiary mt-0.5 block">
                Avg {formatRupiah(avgMonthlySavings)} / cycle
              </span>
            </div>
          </div>

          <SavingsBalanceCard vault={activeVault} />

          {/* Actual Core Savings (P1) Closed-Cycles Vault Balance Override */}
          <div className="rounded-lg border border-border-default bg-surface p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold font-sans text-text-primary">
                Actual Core Savings (P1) Closed-Cycles Vault Balance
              </div>
              <p className="text-[11px] font-sans text-text-tertiary mt-0.5">
                Optional real-world override for your realized closed-cycle P1 bank vault balance (leave blank to derive strictly from verified vault transactions).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <input
                type="number"
                min={0}
                step={10000}
                placeholder="Auto (from ledger)"
                value={p1OverrideInput}
                onChange={(e) => setP1OverrideInput(e.target.value)}
                className="w-40 px-2.5 py-1.5 rounded bg-canvas border border-border text-xs font-mono text-text-primary tabular-nums focus:outline-none"
              />
              <button
                type="button"
                disabled={savingP1Override}
                onClick={() => handleSaveP1Override(false)}
                className="px-3 py-1.5 rounded bg-text-primary text-canvas text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
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
          <WealthTargetPlannerCard
            vault={activeVault}
            baselineMonth={month}
            baselineYear={year}
          />
          <SavingsAccumulationTable ledger={ledger} />
          <SavingsGoalsCard goals={goals} avgMonthlySavings={avgMonthlySavings} />
          <ManualSavingsForm
            untransferredLockedPeriods={
              activeVault.untransferredLockedPeriods ?? []
            }
          />
          <SavingsTransactionsTable transactions={activeVault.transactions} />
        </div>
      )}
    </div>
  );
}
