"use client";

import React, { useEffect, useState } from "react";
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
import { DebtFreedomTimeline } from "@/components/credit/contracts/DebtFreedomTimeline";
import { CreditContractsTable } from "@/components/credit/contracts/CreditContractsTable";
import { CreditWishlistEmbed } from "@/components/credit/CreditWishlistEmbed";
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
      reconciler: "simulator",
    },
  );
  const [intel, setIntel] = useState<IntelligenceBundleResponse | null>(null);
  const { refreshPeriod } = usePeriod();
  const { month, year, data, setData, isPreBoundary } =
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

      {activeSub === "simulator" && (
        <div className="space-y-6">
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

          {matrixData ? (
            <SafeSpendSimulatorPanel
              isOpen={true}
              onClose={() => selectSub("matrix")}
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

          <DebtFreedomTimeline
            contracts={contracts}
            installmentPlans={installmentPlans}
            currentMonth={month}
            currentYear={year}
            matrixData={matrixData}
          />

          <CreditContractsTable
            contracts={contracts}
            installmentPlans={installmentPlans}
            currentMonth={month}
            currentYear={year}
          />

          <CreditWishlistEmbed month={month} year={year} />
        </div>
      )}
    </div>
  );
}
