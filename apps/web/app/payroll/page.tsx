import React from "react";
import { fetchDefaultActivePeriod, fetchSnapshot, fetchPayroll, fetchGlobalConfig } from "@/lib/api";
import { PayrollClientView } from "@/components/payroll/PayrollClientView";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";
import { getDefaultPayrollPeriod } from "@/lib/utils";

interface PayrollPageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function PayrollPage({ searchParams }: PayrollPageProps) {
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

  const [snapshot, payroll, config] = await Promise.all([
    fetchSnapshot(month, year),
    fetchPayroll(month, year),
    fetchGlobalConfig(),
  ]);

  return (
    <PayrollClientView
      initialMonth={month}
      initialYear={year}
      initialData={{ snapshot, payroll, config }}
    />
  );
}
