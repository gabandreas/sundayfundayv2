"use client";

import React, { useEffect, useState } from "react";
import {
  ActiveInstallmentPlanDto,
  CreditCardSummary,
  CreditCardTransaction,
  CreditContract,
  CreditLimitCalculationResult,
  LiabilityMatrixResponse,
} from "@/lib/api";
import { syncTabInUrl } from "@/lib/tabs";
import { CreditTabNav, CreditTabType } from "./CreditTabNav";
import { LiabilityMatrixTable } from "./matrix/LiabilityMatrixTable";
import { CreditCardOverviewCard } from "./card/CreditCardOverviewCard";
import { CreditCardTransactionsTable } from "./card/CreditCardTransactionsTable";
import { AddCardChargeForm } from "./card/AddCardChargeForm";
import { DebtFreedomTimeline } from "./contracts/DebtFreedomTimeline";
import { CreditContractsTable } from "./contracts/CreditContractsTable";

interface CreditStudioProps {
  month: number;
  year: number;
  initialTab: CreditTabType;
  initialTool?: string;
  isLocked: boolean;
  creditUsageLimit: CreditLimitCalculationResult | null;
  matrixData: LiabilityMatrixResponse | null;
  cardSummary: CreditCardSummary | null;
  cardTransactions: CreditCardTransaction[];
  contracts: CreditContract[];
  installmentPlans: ActiveInstallmentPlanDto[];
}

export function CreditStudio({
  month,
  year,
  initialTab,
  initialTool,
  isLocked,
  creditUsageLimit,
  matrixData,
  cardSummary,
  cardTransactions,
  contracts,
  installmentPlans,
}: CreditStudioProps) {
  const [activeTab, setActiveTab] = useState<CreditTabType>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleSelectTab = (nextTab: CreditTabType) => {
    if (nextTab === activeTab) return;
    setActiveTab(nextTab);
    syncTabInUrl(nextTab, ["tool"]);
  };

  return (
    <div className="space-y-6">
      <CreditTabNav currentTab={activeTab} onSelectTab={handleSelectTab} />

      <div className="relative">
        {/* Tab 1: 12-Month Matrix */}
        <section
          role="tabpanel"
          id="credit-panel-matrix"
          aria-labelledby="credit-tab-matrix"
          data-active={activeTab === "matrix" ? "true" : "false"}
          aria-hidden={activeTab !== "matrix"}
          inert={activeTab !== "matrix"}
          className="tab-panel space-y-4"
        >
          {matrixData ? (
            <LiabilityMatrixTable
              matrix={matrixData}
              currentMonth={month}
              currentYear={year}
              isCurrentPeriodLocked={isLocked}
              currentPeriodLimitData={creditUsageLimit}
              initialTool={initialTool}
            />
          ) : (
            <div className="rounded-lg border border-border bg-surface p-8 text-center text-xs font-sans text-text-tertiary">
              Failed to load liability matrix data.
            </div>
          )}
        </section>

        {/* Tab 2: Credit Cards */}
        <section
          role="tabpanel"
          id="credit-panel-card"
          aria-labelledby="credit-tab-card"
          data-active={activeTab === "card" ? "true" : "false"}
          aria-hidden={activeTab !== "card"}
          inert={activeTab !== "card"}
          className="tab-panel space-y-6"
        >
          {cardSummary ? (
            <CreditCardOverviewCard summary={cardSummary} />
          ) : (
            <div className="rounded-lg border border-border bg-surface p-8 text-center text-xs font-sans text-text-tertiary">
              Failed to load credit facility summary.
            </div>
          )}

          <CreditCardTransactionsTable
            transactions={cardTransactions}
            currentMonth={month}
            currentYear={year}
            isLocked={isLocked}
          />

          <AddCardChargeForm
            currentMonth={month}
            currentYear={year}
            statementCutoffDay={cardSummary?.statementCutoffDay ?? 20}
            currentPeriodLimitData={creditUsageLimit}
          />
        </section>

        {/* Tab 3: Active Financing Contracts */}
        <section
          role="tabpanel"
          id="credit-panel-contracts"
          aria-labelledby="credit-tab-contracts"
          data-active={activeTab === "contracts" ? "true" : "false"}
          aria-hidden={activeTab !== "contracts"}
          inert={activeTab !== "contracts"}
          className="tab-panel space-y-6"
        >
          <p className="text-xs font-sans text-text-tertiary">
            Fixed-tenor installment financing (e.g. a specific 0% card installment or PayLater purchase plan) — for flat monthly PayLater or personal debt figures, use the Matrix tab instead.
          </p>

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
        </section>
      </div>
    </div>
  );
}
