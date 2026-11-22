import React from "react";
import { fetchDefaultActivePeriod } from "@/lib/api";
import { getDefaultPayrollPeriod } from "@/lib/utils";
import { ScenarioLabClient } from "@/components/scenarios/ScenarioLabClient";

interface ScenariosPageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function ScenariosPage({ searchParams }: ScenariosPageProps) {
  const params = await searchParams;
  const fallback = getDefaultPayrollPeriod();
  const resolvedDefault =
    params.month && params.year ? null : await fetchDefaultActivePeriod();

  const month = params.month
    ? parseInt(params.month, 10)
    : resolvedDefault?.month ?? fallback.month;
  const year = params.year
    ? parseInt(params.year, 10)
    : resolvedDefault?.year ?? fallback.year;

  return <ScenarioLabClient initialMonth={month} initialYear={year} />;
}
