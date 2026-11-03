import React from "react";
import {
  fetchSnapshot,
  fetchLiabilityMatrix,
  fetchCardSummary,
  fetchCardTransactions,
  fetchContracts,
  fetchCreditUsageLimit,
} from "@/lib/api";
import { CreditTabNav, CreditTabType } from "@/components/credit/CreditTabNav";
import { CreditUsageLimitPanel } from "@/components/credit/CreditUsageLimitPanel";
import { LiabilityMatrixTable } from "@/components/credit/matrix/LiabilityMatrixTable";
import { CreditCardOverviewCard } from "@/components/credit/card/CreditCardOverviewCard";
import { CreditCardTransactionsTable } from "@/components/credit/card/CreditCardTransactionsTable";
import { AddCardChargeForm } from "@/components/credit/card/AddCardChargeForm";
import { DebtFreedomTimeline } from "@/components/credit/contracts/DebtFreedomTimeline";
import { CreditContractsTable } from "@/components/credit/contracts/CreditContractsTable";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";
import { getDefaultPayrollPeriod } from "@/lib/utils";

interface CreditPageProps {
  searchParams: Promise<{ month?: string; year?: string; tab?: string; empty?: string }>;
}

export default async function CreditPage({ searchParams }: CreditPageProps) {
  const params = await searchParams;
  const defaultPeriod = getDefaultPayrollPeriod();
  const month = params.month ? parseInt(params.month, 10) : defaultPeriod.month;
  const year = params.year ? parseInt(params.year, 10) : defaultPeriod.year;

  // Temporal boundary guard: tracking begins in July 2026
  if (year < 2026 || (year === 2026 && month < 7)) {
    return <PreBoundaryNotice month={month} year={year} />;
  }

  const validTabs: CreditTabType[] = ["matrix", "card", "contracts"];
  const currentTab: CreditTabType = validTabs.includes(params.tab as CreditTabType)
    ? (params.tab as CreditTabType)
    : "matrix";

  // Parallel fetch: snapshot and usage-limit are always fetched to determine lock state and period credit ceiling context
  const [
    snapshot,
    creditUsageLimit,
    matrixData,
    cardSummary,
    fetchedCardTransactions,
    fetchedContracts,
  ] = await Promise.all([
    fetchSnapshot(month, year),
    fetchCreditUsageLimit(month, year),
    currentTab === "matrix" ? fetchLiabilityMatrix(7, 2026, 12) : Promise.resolve(null),
    currentTab === "card" ? fetchCardSummary(month, year) : Promise.resolve(null),
    currentTab === "card"
      ? fetchCardTransactions(undefined, undefined, month, year)
      : Promise.resolve([]),
    currentTab === "contracts" ? fetchContracts() : Promise.resolve([]),
  ]);

  const cardTransactions = params.empty === "true" ? [] : fetchedCardTransactions;
  const contracts = params.empty === "true" ? [] : fetchedContracts;
  const isLocked = snapshot?.status === "LOCKED";

  // Data consistency guarantee: when zero active card charges are present, statement due and outstanding balance must also be Rp 0
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
    <div className="space-y-6 max-w-7xl">
      {/* Header & Period Status */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div>
          <h1 className="text-xl font-bold font-sans tracking-tight text-text-primary">
            Liabilities & Debt
          </h1>
          <p className="text-xs font-sans text-text-secondary mt-1">
            Rolling liability schedule, credit card facility utilization, and financing contracts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-sans text-text-tertiary">
            Period: <span className="font-mono text-text-secondary">{month}/{year}</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
              isLocked
                ? "bg-surface-subtle text-text-tertiary border-border-subtle"
                : "bg-[rgba(16,183,141,0.10)] text-delta-positive border-[rgba(16,183,141,0.25)]"
            }`}
          >
            {snapshot?.status ?? "DRAFT"}
          </span>
        </div>
      </div>

      {/* Per-Period Credit Usage Limit & Waterfall-Bounded Safe Recommendation */}
      {creditUsageLimit && <CreditUsageLimitPanel limitData={creditUsageLimit} />}

      {/* URL-driven Tab Navigation */}
      <CreditTabNav currentTab={currentTab} month={month} year={year} />

      <div className="animate-in fade-in duration-150">
        {/* Tab 1: 12-Month Matrix */}
        {currentTab === "matrix" && (
          <section className="space-y-4">
            {matrixData ? (
              <LiabilityMatrixTable
                matrix={matrixData}
                currentMonth={month}
                currentYear={year}
                isCurrentPeriodLocked={isLocked}
                currentPeriodLimitData={creditUsageLimit}
              />
            ) : (
              <div className="rounded-lg border border-border bg-surface p-8 text-center text-xs font-sans text-text-tertiary">
                Failed to load liability matrix data.
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Credit Cards */}
        {currentTab === "card" && (
          <section className="space-y-6">
            {activeCardSummary ? (
              <CreditCardOverviewCard summary={activeCardSummary} />
            ) : (
              <div className="rounded-lg border border-border bg-surface p-8 text-center text-xs font-sans text-text-tertiary">
                Failed to load credit facility summary.
              </div>
            )}

            {/* Transactions Ledger */}
            <CreditCardTransactionsTable
              transactions={cardTransactions}
              currentMonth={month}
              currentYear={year}
              isLocked={isLocked}
            />

            {/* Add Charge Form */}
            <AddCardChargeForm
              currentMonth={month}
              currentYear={year}
              statementCutoffDay={cardSummary?.statementCutoffDay ?? 20}
              currentPeriodLimitData={creditUsageLimit}
            />
          </section>
        )}

        {/* Tab 3: Active Financing Contracts */}
        {currentTab === "contracts" && (
          <section className="space-y-6">
            <p className="text-xs font-sans text-text-tertiary">
              Fixed-tenor installment financing (e.g. a specific 0% card installment or PayLater purchase plan) — for flat monthly PayLater or personal debt figures, use the Matrix tab instead.
            </p>

            {/* Server-Side Debt Freedom Timeline */}
            <DebtFreedomTimeline contracts={contracts} />

            {/* Contracts List Table */}
            <CreditContractsTable contracts={contracts} />
          </section>
        )}
      </div>
    </div>
  );
}
