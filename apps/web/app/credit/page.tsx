import React from "react";
import {
  fetchDefaultActivePeriod,
  fetchSnapshot,
  fetchLiabilityMatrix,
  fetchCardSummary,
  fetchCardTransactions,
  fetchContracts,
  fetchInstallmentPlans,
  fetchCreditUsageLimit,
} from "@/lib/api";
import { CreditTabType } from "@/components/credit/CreditTabNav";
import { CreditPageClient } from "@/components/credit/CreditPageClient";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";
import { getDefaultPayrollPeriod } from "@/lib/utils";

interface CreditPageProps {
  searchParams: Promise<{
    month?: string;
    year?: string;
    tab?: string;
    tool?: string;
    empty?: string;
  }>;
}

export default async function CreditPage({ searchParams }: CreditPageProps) {
  const params = await searchParams;
  const fallbackPeriod = getDefaultPayrollPeriod();
  const resolvedDefault =
    params.month && params.year ? null : await fetchDefaultActivePeriod();
  const month = params.month
    ? parseInt(params.month, 10)
    : resolvedDefault?.month ?? fallbackPeriod.month;
  const year = params.year
    ? parseInt(params.year, 10)
    : resolvedDefault?.year ?? fallbackPeriod.year;

  if (year < 2026 || (year === 2026 && month < 10)) {
    return <PreBoundaryNotice month={month} year={year} />;
  }

  const validTabs: CreditTabType[] = ["matrix", "card", "contracts"];
  const currentTab: CreditTabType = validTabs.includes(params.tab as CreditTabType)
    ? (params.tab as CreditTabType)
    : params.tab === "cards"
      ? "card"
      : "matrix";

  const isEmpty = params.empty === "true";

  const [
    snapshot,
    creditUsageLimit,
    matrixData,
    cardSummary,
    fetchedCardTransactions,
    fetchedContracts,
    fetchedInstallmentPlans,
  ] = await Promise.all([
    fetchSnapshot(month, year),
    fetchCreditUsageLimit(month, year),
    fetchLiabilityMatrix(10, 2026, 12),
    fetchCardSummary(month, year),
    fetchCardTransactions(undefined, undefined, month, year),
    fetchContracts(),
    fetchInstallmentPlans(),
  ]);

  const cardTransactions = isEmpty ? [] : fetchedCardTransactions;
  const contracts = isEmpty ? [] : fetchedContracts;
  const installmentPlans = isEmpty ? [] : fetchedInstallmentPlans;

  return (
    <CreditPageClient
      initialMonth={month}
      initialYear={year}
      initialTab={currentTab}
      initialTool={params.tool}
      initialEmpty={isEmpty}
      initialData={{
        snapshot,
        creditUsageLimit,
        matrixData,
        cardSummary,
        cardTransactions,
        contracts,
        installmentPlans,
      }}
    />
  );
}
