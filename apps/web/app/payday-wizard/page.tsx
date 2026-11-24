import React from "react";
import {
  fetchDefaultActivePeriod,
  fetchGlobalConfig,
  fetchLineItems,
  fetchPayroll,
  fetchSavingsOverview,
  fetchSnapshot,
} from "@/lib/api";
import { getDefaultPayrollPeriod } from "@/lib/utils";
import { PaydayWizardClient } from "@/components/payday/PaydayWizardClient";

interface PaydayWizardPageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

function getPreviousPeriod(month: number, year: number): { month: number; year: number } {
  return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };
}

export default async function PaydayWizardPage({ searchParams }: PaydayWizardPageProps) {
  const params = await searchParams;
  const fallbackPeriod = getDefaultPayrollPeriod();
  const smartDefault =
    !params.month || !params.year ? await fetchDefaultActivePeriod() : null;
  const month = params.month
    ? parseInt(params.month, 10)
    : smartDefault?.month ?? fallbackPeriod.month;
  const year = params.year
    ? parseInt(params.year, 10)
    : smartDefault?.year ?? fallbackPeriod.year;

  const prev = getPreviousPeriod(month, year);

  const [snapshot, prevSnapshot, payroll, lineItems, savingsOverview, config] = await Promise.all([
    fetchSnapshot(month, year),
    fetchSnapshot(prev.month, prev.year),
    fetchPayroll(month, year),
    fetchLineItems({ month, year }),
    fetchSavingsOverview(),
    fetchGlobalConfig(),
  ]);

  return (
    <PaydayWizardClient
      initialMonth={month}
      initialYear={year}
      initialData={{
        snapshot,
        prevSnapshot,
        payroll,
        lineItems: Array.isArray(lineItems) ? lineItems : [],
        savingsOverview,
        config,
      }}
    />
  );
}
