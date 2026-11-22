import React from "react";
import { fetchDefaultActivePeriod, fetchSavingsVault, fetchSnapshot, fetchLineItems } from "@/lib/api";
import { SavingsClientView } from "@/components/savings/SavingsClientView";
import { getDefaultPayrollPeriod } from "@/lib/utils";

interface SavingsPageProps {
  searchParams: Promise<{ month?: string; year?: string; empty?: string }>;
}

export default async function SavingsPage({ searchParams }: SavingsPageProps) {
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

  const [vault, snapshot, p1RefundItems] = await Promise.all([
    fetchSavingsVault(month, year),
    fetchSnapshot(month, year),
    fetchLineItems({ category: "P1_VAULT_REFUND" }),
  ]);

  return (
    <SavingsClientView
      initialMonth={month}
      initialYear={year}
      initialEmpty={params.empty === "true"}
      initialData={{ vault, snapshot, p1RefundItems }}
    />
  );
}
