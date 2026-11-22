"use client";

import React from "react";
import {
  ActiveInstallmentPlanDto,
  CreditCardSummary,
  CreditCardTransaction,
  CreditContract,
  CreditLimitCalculationResult,
  LiabilityMatrixResponse,
} from "@/lib/api";
import { CreditTabType } from "./CreditTabNav";
import { LiabilityMatrixTable } from "./matrix/LiabilityMatrixTable";
import { CreditCardOverviewCard } from "./card/CreditCardOverviewCard";
import { CreditCardTransactionsTable } from "./card/CreditCardTransactionsTable";
import { AddCardChargeForm } from "./card/AddCardChargeForm";

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
  initialTool,
  isLocked,
  creditUsageLimit,
  matrixData,
  cardSummary,
  cardTransactions,
}: CreditStudioProps) {
  return (
    <div className="space-y-6">
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
          Failed to load bill schedule data.
        </div>
      )}

      <section className="space-y-4 pt-2 border-t border-border-subtle">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold font-sans text-text-primary">
              Credit Card Statements &amp; Charges
            </h3>
            <p className="text-xs font-sans text-text-tertiary mt-0.5">
              Statement utilization, individual card charges, and new purchase logging.
            </p>
          </div>
        </div>

        {cardSummary ? (
          <CreditCardOverviewCard summary={cardSummary} />
        ) : (
          <div className="rounded-lg border border-border bg-surface p-6 text-center text-xs font-sans text-text-tertiary">
            Credit facility summary unavailable for this cycle.
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-7">
            <CreditCardTransactionsTable
              transactions={cardTransactions}
              currentMonth={month}
              currentYear={year}
              isLocked={isLocked}
            />
          </div>
          <div className="xl:col-span-5">
            <AddCardChargeForm
              currentMonth={month}
              currentYear={year}
              statementCutoffDay={cardSummary?.statementCutoffDay ?? 20}
              currentPeriodLimitData={creditUsageLimit}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
