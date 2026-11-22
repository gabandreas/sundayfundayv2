import React from "react";
import Link from "next/link";
import { fetchSnapshot, fetchTransactions, fetchPacing } from "@/lib/api";
import { LedgerPageClient } from "@/components/ledger/LedgerPageClient";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";
import { getDefaultPayrollPeriod } from "@/lib/utils";

interface LedgerPageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function LedgerPage({ searchParams }: LedgerPageProps) {
  const params = await searchParams;
  const defaultPeriod = getDefaultPayrollPeriod();
  const month = params.month ? parseInt(params.month, 10) : defaultPeriod.month;
  const year = params.year ? parseInt(params.year, 10) : defaultPeriod.year;

  if (year < 2026 || (year === 2026 && month < 10)) {
    return <PreBoundaryNotice month={month} year={year} />;
  }

  const [snapshot, transactions, pacing] = await Promise.all([
    fetchSnapshot(month, year),
    fetchTransactions(month, year),
    fetchPacing(month, year),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-4 py-2 rounded border border-border bg-surface text-xs text-text-secondary">
        <span>Daily cash and bill ledger entries are managed directly inside Overview.</span>
        <Link href={`/?month=${month}&year=${year}`} className="font-mono text-text-primary hover:underline">
          Open Overview
        </Link>
      </div>
      <LedgerPageClient
        initialMonth={month}
        initialYear={year}
        initialData={{ snapshot, transactions, pacing }}
      />
    </div>
  );
}
