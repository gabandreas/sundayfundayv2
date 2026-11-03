import React from "react";
import { fetchSnapshot, fetchTransactions, fetchPacing } from "@/lib/api";
import { LedgerSummaryStrip } from "@/components/ledger/LedgerSummaryStrip";
import { LedgerClientView } from "@/components/ledger/LedgerClientView";
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

  // Temporal boundary guard: tracking begins in July 2026
  if (year < 2026 || (year === 2026 && month < 7)) {
    return <PreBoundaryNotice month={month} year={year} />;
  }

  const [snapshot, transactions, pacing] = await Promise.all([
    fetchSnapshot(month, year),
    fetchTransactions(month, year),
    fetchPacing(month, year),
  ]);

  const isLocked = snapshot?.status === "LOCKED";
  const statusLabel = isLocked ? "Locked" : "Draft";

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div>
          <h1 className="text-xl font-bold font-sans tracking-tight text-text-primary">
            General Ledger
          </h1>
          <p className="text-xs font-sans text-text-secondary mt-1">
            Complete record of upfront debt bills, balance checkpoints, routine quota usage, and manual adjustments for this period.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-sans text-text-tertiary">
            Period: <span className="font-mono text-text-secondary">{month}/{year}</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
              isLocked
                ? "border-border-strong text-text-secondary bg-surface-subtle"
                : "border-[rgba(16,183,141,0.3)] text-delta-positive bg-[rgba(16,183,141,0.06)]"
            }`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Summary Strip */}
      <LedgerSummaryStrip transactions={transactions} snapshot={snapshot} />

      {/* Interactive Table View with Filters & Excel Export */}
      <LedgerClientView
        transactions={transactions}
        month={month}
        year={year}
        isLocked={isLocked}
        snapshotStatus={snapshot?.status || "DRAFT"}
        snapshot={snapshot}
        pacing={pacing}
      />
    </div>
  );
}
