import React from "react";
import {
  fetchDefaultActivePeriod,
  fetchSnapshot,
  fetchPacing,
  fetchTransactions,
  fetchSavingsVault,
  fetchGlobalConfig,
  fetchKillSwitches,
} from "@/lib/api";
import { OverviewClientView } from "@/components/overview/OverviewClientView";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";
import { getDefaultPayrollPeriod } from "@/lib/utils";

interface OverviewPageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function OverviewPage({ searchParams }: OverviewPageProps) {
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

  const [snapshot, pacing, transactions, vault, config, killSwitches] =
    await Promise.all([
      fetchSnapshot(month, year),
      fetchPacing(month, year),
      fetchTransactions(month, year),
      fetchSavingsVault(),
      fetchGlobalConfig(),
      fetchKillSwitches(),
    ]);

  return (
    <OverviewClientView
      initialMonth={month}
      initialYear={year}
      initialData={{
        snapshot,
        pacing,
        transactions,
        vault,
        config,
        killSwitches,
      }}
    />
  );
}
