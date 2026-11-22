import React from "react";
import {
  fetchCardSummary,
  fetchCardTransactions,
  fetchKillSwitches,
  fetchRoutineCategories,
  fetchSnapshot,
} from "@/lib/api";
import { getDefaultPeriodFromNow } from "@/lib/utils";
import { SubscriptionsStudio } from "@/components/subscriptions/SubscriptionsStudio";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string; year?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const fallback = getDefaultPeriodFromNow();

  const parsedMonth = Number(sp.month);
  const parsedYear = Number(sp.year);
  const activeMonth =
    Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : fallback.month;
  const activeYear =
    Number.isInteger(parsedYear) && parsedYear >= 2026 ? parsedYear : fallback.year;

  const [
    transactions,
    cardSummary,
    killSwitches,
    routineCategories,
    snapshot,
  ] = await Promise.all([
    fetchCardTransactions(),
    fetchCardSummary(activeMonth, activeYear),
    fetchKillSwitches(),
    fetchRoutineCategories(),
    fetchSnapshot(activeMonth, activeYear),
  ]);

  return (
    <SubscriptionsStudio
      activeMonth={activeMonth}
      activeYear={activeYear}
      initialTransactions={transactions}
      initialCardSummary={cardSummary}
      initialKillSwitches={killSwitches}
      initialRoutineCategories={routineCategories}
      initialSnapshot={snapshot}
    />
  );
}
