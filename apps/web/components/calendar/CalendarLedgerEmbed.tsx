"use client";

import React, { useEffect, useState } from "react";
import {
  DailyPacing,
  MonthlySnapshot,
  Transaction,
  fetchPacing,
  fetchSnapshot,
  fetchTransactions,
  getCached,
} from "@/lib/api";
import { usePeriod } from "@/context/PeriodContext";
import { LedgerPageClient } from "@/components/ledger/LedgerPageClient";

export function CalendarLedgerEmbed({ month, year }: { month: number; year: number }) {
  const { revisionTick } = usePeriod();
  const [loaded, setLoaded] = useState<{
    month: number;
    year: number;
    snapshot: MonthlySnapshot | null;
    transactions: Transaction[];
    pacing: DailyPacing | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const snapC = getCached<MonthlySnapshot | null>(`snapshot:${month}:${year}`);
    const txC = getCached<Transaction[]>(`transactions:${month}:${year}`);
    const pacC = getCached<DailyPacing | null>(`pacing:${month}:${year}`);
    if (revisionTick === 0 && snapC !== undefined && txC !== undefined && pacC !== undefined) {
      setLoaded({
        month,
        year,
        snapshot: snapC,
        transactions: txC,
        pacing: pacC,
      });
      return;
    }

    Promise.all([fetchSnapshot(month, year), fetchTransactions(month, year), fetchPacing(month, year)]).then(
      ([snapshot, transactions, pacing]) => {
        if (!active) return;
        setLoaded({ month, year, snapshot, transactions, pacing });
      }
    );
    return () => {
      active = false;
    };
  }, [month, year, revisionTick]);

  if (!loaded || loaded.month !== month || loaded.year !== year) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center text-xs font-sans text-text-tertiary">
        Loading transaction ledger for {month}/{year}...
      </div>
    );
  }

  return (
    <LedgerPageClient
      initialMonth={month}
      initialYear={year}
      initialData={{
        snapshot: loaded.snapshot,
        transactions: loaded.transactions,
        pacing: loaded.pacing,
      }}
    />
  );
}
