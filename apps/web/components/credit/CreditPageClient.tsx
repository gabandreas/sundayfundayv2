"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  ActiveInstallmentPlanDto,
  CreditCardSummary,
  CreditCardTransaction,
  CreditContract,
  CreditLimitCalculationResult,
  IntelligenceBundleResponse,
  LiabilityMatrixResponse,
  MonthlySnapshot,
  OptimisticMatrixBulkPayload,
  applyOptimisticMatrixBulkPatch,
  fetchCardSummary,
  fetchCardTransactions,
  fetchContracts,
  fetchCreditUsageLimit,
  fetchInstallmentPlans,
  fetchIntelligenceBundle,
  fetchLiabilityMatrix,
  fetchSnapshot,
  getCached,
  setCached,
} from "@/lib/api";
import { usePeriodSlice } from "@/hooks/usePeriodSlice";
import { useSubModule } from "@/hooks/useSubModule";
import { CREDIT_SUB_KEYS, CreditSubKey } from "@/lib/tabs";
import { useLanguage } from "@/context/LanguageContext";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SubModuleNav } from "@/components/primitives/SubModuleNav";
import { CreditTabType } from "@/components/credit/CreditTabNav";
import { CreditStudio } from "@/components/credit/CreditStudio";
import { CreditUsageLimitPanel } from "@/components/credit/CreditUsageLimitPanel";
import { SafeSpendSimulatorPanel } from "@/components/credit/matrix/SafeSpendSimulatorPanel";
import { ActiveContractsHub } from "@/components/credit/contracts/ActiveContractsHub";
import { CreditContractsTable } from "@/components/credit/contracts/CreditContractsTable";
import { CreditCommitmentsEmbed } from "@/components/credit/CreditCommitmentsEmbed";
import { OneOffCommitmentsPanel } from "@/components/commitments/OneOffCommitmentsPanel";
import { usePeriod } from "@/context/PeriodContext";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";

export interface CreditPeriodData {
  snapshot: MonthlySnapshot | null;
  creditUsageLimit: CreditLimitCalculationResult | null;
  matrixData: LiabilityMatrixResponse | null;
  cardSummary: CreditCardSummary | null;
  cardTransactions: CreditCardTransaction[];
  contracts: CreditContract[];
  installmentPlans: ActiveInstallmentPlanDto[];
}

interface CreditPageClientProps {
  initialMonth: number;
  initialYear: number;
  initialTab: CreditTabType;
  initialTool?: string;
  initialEmpty?: boolean;
  initialData: CreditPeriodData;
}

export function CreditPageClient({
  initialMonth,
  initialYear,
  initialTab,
  initialTool,
  initialEmpty = false,
  initialData,
}: CreditPageClientProps) {
  const { t } = useLanguage();
  const [activeSub, selectSub] = useSubModule<CreditSubKey>(
    CREDIT_SUB_KEYS,
    initialTab === "contracts" ? "simulator" : "matrix",
    {
      overview: "matrix",
      card: "matrix",
      cards: "matrix",
      contracts: "simulator",
      subscriptions: "commitments",
      recurring: "commitments",
      bills: "commitments",
      wishlist: "simulator",
      cutoff: "simulator",
      reconciler: "simulator",
    },
  );
  const [intel, setIntel] = useState<IntelligenceBundleResponse | null>(null);
  const [simulatorMode, setSimulatorMode] = useState<"strategy" | "safespend">(
    initialTool === "cutoff" || initialTool === "safespend" ? "safespend" : "strategy",
  );
  const { refreshPeriod } = usePeriod();
  const { month, year, revisionTick, data, setData, isPreBoundary } =
    usePeriodSlice<CreditPeriodData>({
      initialMonth,
      initialYear,
      initialData,
      seedCache: (m, y, d) => {
        if (d.snapshot) setCached(`snapshot:${m}:${y}`, d.snapshot);
        if (d.creditUsageLimit)
          setCached(`creditUsageLimit:${m}:${y}`, d.creditUsageLimit);
        if (d.matrixData) setCached("matrix:10:2026:12", d.matrixData);
        if (d.cardSummary) setCached(`cardSummary:${m}:${y}`, d.cardSummary);
        setCached(`cardTransactions:all:all:${m}:${y}`, d.cardTransactions);
        setCached("creditContracts:active", d.contracts);
        setCached("installmentPlans:all", d.installmentPlans);
      },
      readFromCache: (m, y, prev) => {
        const snapshot = getCached<MonthlySnapshot | null>(`snapshot:${m}:${y}`);
        const creditUsageLimit = getCached<CreditLimitCalculationResult | null>(
          `creditUsageLimit:${m}:${y}`,
        );
        const cardSummary = getCached<CreditCardSummary | null>(
          `cardSummary:${m}:${y}`,
        );
        const cardTransactions = getCached<CreditCardTransaction[]>(
          `cardTransactions:all:all:${m}:${y}`,
        );
        if (
          snapshot === undefined ||
          creditUsageLimit === undefined ||
          cardSummary === undefined ||
          cardTransactions === undefined
        ) {
          return undefined;
        }
        return {
          snapshot,
          creditUsageLimit,
          matrixData:
            getCached<LiabilityMatrixResponse | null>("matrix:10:2026:12") ??
            prev.matrixData,
          cardSummary,
          cardTransactions,
          contracts:
            getCached<CreditContract[]>("creditContracts:active") ??
            prev.contracts,
          installmentPlans:
            getCached<ActiveInstallmentPlanDto[]>("installmentPlans:all") ??
            prev.installmentPlans,
        };
      },
      fetchForPeriod: async (m, y) => {
        const [
          snapshot,
          creditUsageLimit,
          matrixData,
          cardSummary,
          fetchedCardTransactions,
          fetchedContracts,
          fetchedInstallmentPlans,
        ] = await Promise.all([
          fetchSnapshot(m, y),
          fetchCreditUsageLimit(m, y),
          fetchLiabilityMatrix(10, 2026, 12),
          fetchCardSummary(m, y),
          fetchCardTransactions(undefined, undefined, m, y),
          fetchContracts(),
          fetchInstallmentPlans(),
        ]);
        const cardTransactions = initialEmpty ? [] : fetchedCardTransactions;
        const contracts = initialEmpty ? [] : fetchedContracts;
        const installmentPlans = initialEmpty ? [] : fetchedInstallmentPlans;
        setCached(`cardTransactions:all:all:${m}:${y}`, cardTransactions);
        setCached("creditContracts:active", contracts);
        setCached("installmentPlans:all", installmentPlans);
        return {
          snapshot,
          creditUsageLimit,
          matrixData,
          cardSummary,
          cardTransactions,
          contracts,
          installmentPlans,
        };
      },
    });

  useEffect(() => {
    const handleOptimisticBulk = (e: Event) => {
      const payload = (e as CustomEvent<OptimisticMatrixBulkPayload>).detail;
      if (!payload) return;
      setData((prev) => {
        const nextMatrix = applyOptimisticMatrixBulkPatch(prev.matrixData, payload);
        if (nextMatrix) {
          setCached("matrix:10:2026:12", nextMatrix);
        }
        return {
          ...prev,
          matrixData: nextMatrix,
        };
      });
    };
    window.addEventListener("erp:optimistic-matrix-bulk", handleOptimisticBulk);
    return () =>
      window.removeEventListener("erp:optimistic-matrix-bulk", handleOptimisticBulk);
  }, [setData]);

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

  if (isPreBoundary) {
    return <PreBoundaryNotice month={month} year={year} />;
  }

  const {
    snapshot,
    creditUsageLimit,
    matrixData,
    cardSummary,
    cardTransactions,
    contracts,
    installmentPlans,
  } = data;

  const isLocked = snapshot?.status === "LOCKED";

  const activeCardSummary =
    cardTransactions.length === 0 && cardSummary
      ? {
          ...cardSummary,
          currentCycleDue: 0,
          totalOutstandingBalance: 0,
          utilizationPercent: 0,
        }
      : cardSummary;

  return (
    <div className="space-y-6 w-full max-w-full">
      <PageHeader
        title={t("nav.credit")}
        subtitle="Monthly bill schedule, card charges, payoff strategy optimizer, and cutoff timing check."
        periodLabel={`${month}/${year}`}
        status={snapshot?.status ?? "DRAFT"}
        statusLabel={isLocked ? "Closed" : "Active Draft"}
      />

      <SubModuleNav
        items={[
          { key: "matrix", label: t("sub.credit.matrix") },
          { key: "commitments", label: t("sub.credit.commitments") },
          { key: "simulator", label: t("sub.credit.simulator") },
        ]}
        activeKey={activeSub}
        onSelect={selectSub}
      />

      {activeSub === "matrix" && (
        <div className="space-y-6">
          {creditUsageLimit && <CreditUsageLimitPanel limitData={creditUsageLimit} />}
          <CreditStudio
            month={month}
            year={year}
            initialTab="matrix"
            initialTool={initialTool}
            isLocked={isLocked}
            creditUsageLimit={creditUsageLimit}
            matrixData={matrixData}
            cardSummary={activeCardSummary}
            cardTransactions={cardTransactions}
            contracts={contracts}
            installmentPlans={installmentPlans}
          />
        </div>
      )}

      {activeSub === "commitments" && (
        <div className="space-y-6">
          <OneOffCommitmentsPanel month={month} year={year} isLocked={isLocked} />
          <CreditCommitmentsEmbed
            month={month}
            year={year}
            snapshot={snapshot}
            cardSummary={activeCardSummary}
            cardTransactions={cardTransactions}
          />
        </div>
      )}

      {activeSub === "simulator" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Payoff strategy and safe-spend tools"
              className="inline-flex rounded-md border border-border bg-surface p-0.5 text-xs font-sans"
            >
              <button
                type="button"
                role="tab"
                aria-selected={simulatorMode === "strategy"}
                onClick={() => setSimulatorMode("strategy")}
                className={`px-3.5 py-1.5 rounded transition-colors cursor-pointer ${
                  simulatorMode === "strategy"
                    ? "bg-surface-active text-text-primary font-medium"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Payoff Strategy &amp; Contracts
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={simulatorMode === "safespend"}
                onClick={() => setSimulatorMode("safespend")}
                className={`px-3.5 py-1.5 rounded transition-colors cursor-pointer ${
                  simulatorMode === "safespend"
                    ? "bg-surface-active text-text-primary font-medium"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Safe-Spend &amp; Cutoff Check
              </button>
            </div>

            <Link
              href={`/allocations?month=${month}&year=${year}&sub=scenarios&tool=wishlist`}
              className="inline-flex items-center gap-1.5 text-xs font-sans text-text-secondary hover:text-text-primary transition-colors"
            >
              <span>Purchase Wishlist in Allocations</span>
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>

          {simulatorMode === "strategy" ? (
            <div className="space-y-5">
              <ActiveContractsHub
                contracts={contracts}
                installmentPlans={installmentPlans}
                matrixData={matrixData}
                currentMonth={month}
                currentYear={year}
                initialIntel={intel}
                onSelectSub={(s) => selectSub(s === "matrix" ? "matrix" : "simulator")}
                onMutated={refreshPeriod}
              />

              <details className="rounded-lg border border-border-subtle bg-surface overflow-hidden">
                <summary className="px-5 py-3.5 cursor-pointer flex items-center justify-between text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-subtle/40 transition-colors">
                  <span>All Active Installment &amp; Credit Contracts ({contracts.length + installmentPlans.length})</span>
                  <span className="font-mono text-[10px] text-text-tertiary">Expand full contract list</span>
                </summary>
                <div className="border-t border-border-subtle p-4">
                  <CreditContractsTable
                    contracts={contracts}
                    installmentPlans={installmentPlans}
                    currentMonth={month}
                    currentYear={year}
                  />
                </div>
              </details>
            </div>
          ) : matrixData ? (
            <SafeSpendSimulatorPanel
              isOpen={true}
              onClose={() => setSimulatorMode("strategy")}
              matrix={matrixData}
              currentMonth={month}
              currentYear={year}
              limitData={creditUsageLimit}
            />
          ) : (
            <div className="rounded-lg border border-border bg-surface p-8 text-center text-xs text-text-tertiary">
              Loading schedule context for cutoff timing check...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
