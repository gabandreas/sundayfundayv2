"use client";

import React, { useEffect, useState } from "react";
import {
  GlobalConfig,
  LiabilityLineItemDto,
  MonthlySnapshot,
  PayrollResult,
  SavingsOverviewResult,
  fetchLineItems,
  fetchSavingsOverview,
  fetchSnapshot,
  getCached,
} from "@/lib/api";
import { usePeriod } from "@/context/PeriodContext";
import { PaydayWizardClient } from "@/components/payday/PaydayWizardClient";

function getPrevPeriod(m: number, y: number) {
  return m === 1 ? { month: 12, year: y - 1 } : { month: m - 1, year: y };
}

export function PaydayClosingEmbed({
  month,
  year,
  snapshot,
  payroll,
  config,
}: {
  month: number;
  year: number;
  snapshot: MonthlySnapshot | null;
  payroll: PayrollResult | null;
  config: GlobalConfig | null;
}) {
  const { revisionTick } = usePeriod();
  const [extra, setExtra] = useState<{
    month: number;
    year: number;
    prevSnapshot: MonthlySnapshot | null;
    lineItems: LiabilityLineItemDto[];
    savingsOverview: SavingsOverviewResult | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const prev = getPrevPeriod(month, year);
    const cachedPrev = getCached<MonthlySnapshot | null>(`snapshot:${prev.month}:${prev.year}`);
    const cachedLines = getCached<LiabilityLineItemDto[]>(`lineItems:${month}:${year}`);
    const cachedSav = getCached<SavingsOverviewResult | null>("savingsOverview");
    if (
      revisionTick === 0 &&
      cachedPrev !== undefined &&
      cachedLines !== undefined &&
      cachedSav !== undefined
    ) {
      setExtra({
        month,
        year,
        prevSnapshot: cachedPrev,
        lineItems: cachedLines,
        savingsOverview: cachedSav,
      });
      return;
    }

    Promise.all([
      fetchSnapshot(prev.month, prev.year),
      fetchLineItems({ month, year }),
      fetchSavingsOverview(),
    ]).then(([prevSnapshot, lineItems, savingsOverview]) => {
      if (!active) return;
      setExtra({
        month,
        year,
        prevSnapshot,
        lineItems: Array.isArray(lineItems) ? lineItems : [],
        savingsOverview,
      });
    });
    return () => {
      active = false;
    };
  }, [month, year, revisionTick]);

  if (!extra || extra.month !== month || extra.year !== year) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center text-xs font-sans text-text-tertiary">
        Loading payday closing checklist for {month}/{year}...
      </div>
    );
  }

  return (
    <PaydayWizardClient
      initialMonth={month}
      initialYear={year}
      initialData={{
        snapshot,
        prevSnapshot: extra.prevSnapshot,
        payroll,
        lineItems: extra.lineItems,
        savingsOverview: extra.savingsOverview,
        config,
      }}
    />
  );
}
