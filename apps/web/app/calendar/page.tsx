import React from "react";
import {
  fetchDefaultActivePeriod,
  fetchLiabilityMatrix,
  fetchPacing,
  fetchSnapshot,
} from "@/lib/api";
import { getDefaultPayrollPeriod } from "@/lib/utils";
import { CashRadarCalendarClient } from "@/components/calendar/CashRadarCalendarClient";

interface CalendarPageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
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

  const [snapshot, pacing, matrix] = await Promise.all([
    fetchSnapshot(month, year),
    fetchPacing(month, year),
    fetchLiabilityMatrix(month, year, 6),
  ]);

  return (
    <CashRadarCalendarClient
      initialMonth={month}
      initialYear={year}
      initialData={{ snapshot, pacing, matrix }}
    />
  );
}
