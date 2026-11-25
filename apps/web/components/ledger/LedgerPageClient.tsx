"use client";

import React from "react";
import {
  DailyPacing,
  MonthlySnapshot,
  Transaction,
  fetchPacing,
  fetchSnapshot,
  fetchTransactions,
  getCached,
  setCached,
} from "@/lib/api";
import { usePeriodSlice } from "@/hooks/usePeriodSlice";
import { LedgerSummaryStrip } from "@/components/ledger/LedgerSummaryStrip";
import { LedgerClientView } from "@/components/ledger/LedgerClientView";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";
import { useLanguage } from "@/context/LanguageContext";
import { formatHumanStatus } from "@/lib/format-labels";

export interface LedgerPeriodData {
  snapshot: MonthlySnapshot | null;
  transactions: Transaction[];
  pacing: DailyPacing | null;
}

interface LedgerPageClientProps {
  initialMonth: number;
  initialYear: number;
  initialData: LedgerPeriodData;
  embedded?: boolean;
}

export function LedgerPageClient({
  initialMonth,
  initialYear,
  initialData,
  embedded = false,
}: LedgerPageClientProps) {
  const { locale } = useLanguage();
  const { month, year, data, isPreBoundary } =
    usePeriodSlice<LedgerPeriodData>({
      initialMonth,
      initialYear,
      initialData,
      seedCache: (m, y, d) => {
        if (d.snapshot) setCached(`snapshot:${m}:${y}`, d.snapshot);
        setCached(`transactions:${m}:${y}`, d.transactions);
        if (d.pacing) setCached(`pacing:${m}:${y}`, d.pacing);
      },
      readFromCache: (m, y) => {
        const snapshot = getCached<MonthlySnapshot | null>(`snapshot:${m}:${y}`);
        const transactions = getCached<Transaction[]>(`transactions:${m}:${y}`);
        const pacing = getCached<DailyPacing | null>(`pacing:${m}:${y}`);
        if (
          snapshot === undefined ||
          transactions === undefined ||
          pacing === undefined
        ) {
          return undefined;
        }
        return { snapshot, transactions, pacing };
      },
      fetchForPeriod: async (m, y) => {
        const [snapshot, transactions, pacing] = await Promise.all([
          fetchSnapshot(m, y),
          fetchTransactions(m, y),
          fetchPacing(m, y),
        ]);
        return { snapshot, transactions, pacing };
      },
    });

  if (isPreBoundary) {
    return <PreBoundaryNotice month={month} year={year} />;
  }

  const { snapshot, transactions, pacing } = data;
  const isLocked = snapshot?.status === "LOCKED";

  return (
    <div className="space-y-6 w-full max-w-full">
      {!embedded && (
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
              Period:{" "}
              <span className="font-mono text-text-secondary">
                {month}/{year}
              </span>
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium border ${
                isLocked
                  ? "border-border-strong text-text-secondary bg-surface-subtle"
                  : "border-[rgba(16,183,141,0.25)] text-delta-positive bg-[rgba(16,183,141,0.10)]"
              }`}
            >
              {formatHumanStatus(snapshot?.status ?? "DRAFT", locale)}
            </span>
          </div>
        </div>
      )}

      {/* Category Breakdown Summary */}
      <LedgerSummaryStrip transactions={transactions} snapshot={snapshot} />

      {/* Interactive Table View with Filters & Excel Export */}
      <LedgerClientView
        transactions={transactions}
        month={month}
        year={year}
        isLocked={isLocked}
        snapshotStatus={snapshot?.status ?? "DRAFT"}
        snapshot={snapshot}
        pacing={pacing}
      />
    </div>
  );
}
