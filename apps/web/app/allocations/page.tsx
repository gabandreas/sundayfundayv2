import React from "react";
import { fetchDefaultActivePeriod, fetchSnapshot } from "@/lib/api";
import { AllocationsClientView } from "@/components/allocations/AllocationsClientView";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";
import { getDefaultPayrollPeriod } from "@/lib/utils";

interface AllocationsPageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function AllocationsPage({ searchParams }: AllocationsPageProps) {
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

  const next1Month = month === 12 ? 1 : month + 1;
  const next1Year = month === 12 ? year + 1 : year;
  const next2Month = next1Month === 12 ? 1 : next1Month + 1;
  const next2Year = next1Month === 12 ? next1Year + 1 : next1Year;

  const [snapshot, next1Snapshot, next2Snapshot] = await Promise.all([
    fetchSnapshot(month, year),
    fetchSnapshot(next1Month, next1Year),
    fetchSnapshot(next2Month, next2Year),
  ]);

  return (
    <AllocationsClientView
      initialMonth={month}
      initialYear={year}
      initialData={{ snapshot, next1Snapshot, next2Snapshot }}
    />
  );
}
