"use client";

import React, { useEffect, useState } from "react";
import {
  CreditCardSummary,
  CreditCardTransaction,
  KillSwitchResponse,
  MonthlySnapshot,
  RoutineCategoryConfig,
  fetchKillSwitches,
  fetchRoutineCategories,
  getCached,
} from "@/lib/api";
import { usePeriod } from "@/context/PeriodContext";
import { SubscriptionsStudio } from "@/components/subscriptions/SubscriptionsStudio";

export function CreditCommitmentsEmbed({
  month,
  year,
  snapshot,
  cardSummary,
  cardTransactions,
}: {
  month: number;
  year: number;
  snapshot: MonthlySnapshot | null;
  cardSummary: CreditCardSummary | null;
  cardTransactions: CreditCardTransaction[];
}) {
  const { revisionTick } = usePeriod();
  const [state, setState] = useState<{
    killSwitches: KillSwitchResponse | null;
    routineCategories: RoutineCategoryConfig[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    const ksCached = getCached<KillSwitchResponse | null>("killSwitches");
    const rcCached = getCached<RoutineCategoryConfig[]>("routineCategories:all");
    if (revisionTick === 0 && ksCached !== undefined && rcCached !== undefined) {
      setState({ killSwitches: ksCached, routineCategories: rcCached });
      return;
    }

    Promise.all([fetchKillSwitches(), fetchRoutineCategories()]).then(
      ([killSwitches, routineCategories]) => {
        if (!active) return;
        setState({
          killSwitches,
          routineCategories: Array.isArray(routineCategories) ? routineCategories : [],
        });
      }
    );
    return () => {
      active = false;
    };
  }, [month, year, revisionTick]);

  if (!state) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center text-xs font-sans text-text-tertiary">
        Loading recurring commitments and subscriptions...
      </div>
    );
  }

  return (
    <SubscriptionsStudio
      activeMonth={month}
      activeYear={year}
      initialTransactions={cardTransactions}
      initialCardSummary={cardSummary}
      initialKillSwitches={state.killSwitches}
      initialRoutineCategories={state.routineCategories}
      initialSnapshot={snapshot}
    />
  );
}
