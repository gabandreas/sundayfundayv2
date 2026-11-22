"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import {
  DailyPacing,
  LiabilityMatrixResponse,
  MonthlySnapshot,
  fetchLiabilityMatrix,
  fetchPacing,
  fetchSnapshot,
  getCached,
  setCached,
} from "@/lib/api";
import { usePeriodSlice } from "@/hooks/usePeriodSlice";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { formatRupiah } from "@/lib/utils";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";

export interface CashRadarCalendarData {
  snapshot: MonthlySnapshot | null;
  pacing: DailyPacing | null;
  matrix: LiabilityMatrixResponse | null;
}

interface CashRadarCalendarClientProps {
  initialMonth: number;
  initialYear: number;
  initialData: CashRadarCalendarData;
}

type EventKind = "PAYDAY" | "CUTOFF" | "DUE" | "ROUTINE";

interface CalendarDayEvent {
  id: string;
  kind: EventKind;
  label: string;
  amountRp: number;
  settled?: boolean;
}

interface ProjectedDayNode {
  isoDate: string;
  dayOfMonth: number;
  monthLabel: string;
  events: CalendarDayEvent[];
  endOfDayCashRp: number;
  isToday: boolean;
  isLowestPoint: boolean;
}

const MONTH_SHORT = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

function parseIsoDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function formatUtcIso(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function CashRadarCalendarClient({
  initialMonth,
  initialYear,
  initialData,
}: CashRadarCalendarClientProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const formatRp = (val: number) => formatRupiah(val, isAmountsMasked);

  const { month, year, data, isPreBoundary } = usePeriodSlice<CashRadarCalendarData>({
    initialMonth,
    initialYear,
    initialData,
    seedCache: (m, y, d) => {
      if (d.snapshot) setCached(`snapshot:${m}:${y}`, d.snapshot);
      if (d.pacing) setCached(`pacing:${m}:${y}`, d.pacing);
      if (d.matrix) setCached(`matrix:${m}:${y}:6`, d.matrix);
    },
    readFromCache: (m, y) => {
      const snapshot = getCached<MonthlySnapshot | null>(`snapshot:${m}:${y}`);
      const pacing = getCached<DailyPacing | null>(`pacing:${m}:${y}`);
      const matrix = getCached<LiabilityMatrixResponse | null>(`matrix:${m}:${y}:6`);
      if (snapshot === undefined || pacing === undefined || matrix === undefined) {
        return undefined;
      }
      return { snapshot, pacing, matrix };
    },
    fetchForPeriod: async (m, y) => {
      const [snapshot, pacing, matrix] = await Promise.all([
        fetchSnapshot(m, y),
        fetchPacing(m, y),
        fetchLiabilityMatrix(m, y, 6),
      ]);
      return { snapshot, pacing, matrix };
    },
  });

  if (isPreBoundary) {
    return <PreBoundaryNotice month={month} year={year} />;
  }

  const { snapshot, pacing, matrix } = data;
  const periodKey = `${year}-${month}`;
  const periodLabel = `${MONTH_SHORT[(month - 1) % 12]} '${String(year).slice(2)}`;

  const radarProjection = useMemo(() => {
    const startIso =
      pacing?.cycleStartDate?.slice(0, 10) ??
      snapshot?.payrollPayoutDate?.slice(0, 10) ??
      `${year}-${String(month).padStart(2, "0")}-25`;
    const endIso =
      pacing?.cycleEndDate?.slice(0, 10) ??
      (() => {
        const nm = month === 12 ? 1 : month + 1;
        const ny = month === 12 ? year + 1 : year;
        return `${ny}-${String(nm).padStart(2, "0")}-24`;
      })();

    const startDt = parseIsoDay(startIso);
    const endDt = parseIsoDay(endIso);
    const totalDays = Math.max(
      1,
      Math.min(45, Math.round((endDt.getTime() - startDt.getTime()) / 86400000) + 1),
    );

    // Build Liability events for this cycle's Due Horizon (Month M+1)
    const payLaterCell = matrix?.payLaterRow?.cells?.[periodKey];
    const ccCell = matrix?.creditCardRow?.cells?.[periodKey];
    const personalCell = matrix?.personalDebtRow?.cells?.[periodKey];

    const payLaterAmount = Math.round(payLaterCell?.amount ?? 0);
    const ccAmount = Math.round(ccCell?.amount ?? 0);
    const personalAmount = Math.round(personalCell?.amount ?? 0);

    const payLaterSettled =
      (payLaterCell?.items?.length ?? 0) > 0 &&
      payLaterCell!.items!.every((i) => i.isSettled);
    const ccSettled =
      (ccCell?.items?.length ?? 0) > 0 &&
      ccCell!.items!.every((i) => i.isSettled || i.isAutoSettled);
    const personalSettled =
      (personalCell?.items?.length ?? 0) > 0 &&
      personalCell!.items!.every((i) => i.isSettled);

    const netIncome = Math.round(snapshot?.finalTotalIncome ?? 0);
    const routineTotal = Math.round(
      (snapshot?.transport ?? 0) +
        (snapshot?.internet ?? 0) +
        (snapshot?.vape ?? 0) +
        (snapshot?.haircut ?? 0),
    );
    const baselineDaily = Math.round(pacing?.baselineDailyRate ?? 0);

    const nowUtc = new Date();
    const jktIso = new Date(nowUtc.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);

    const days: ProjectedDayNode[] = [];
    let runningCash = 0;

    for (let i = 0; i < totalDays; i++) {
      const dt = new Date(startDt.getTime() + i * 86400000);
      const isoDate = formatUtcIso(dt);
      const dayOfMonth = dt.getUTCDate();
      const monthIdx = dt.getUTCMonth();
      const events: CalendarDayEvent[] = [];

      if (i === 0 && netIncome > 0) {
        events.push({
          id: `payday-${isoDate}`,
          kind: "PAYDAY",
          label: `Payday Inflow (${periodLabel})`,
          amountRp: netIncome,
        });
        runningCash += netIncome;

        if (routineTotal > 0) {
          events.push({
            id: `routine-${isoDate}`,
            kind: "ROUTINE",
            label: "Routine Envelopes Reserve",
            amountRp: -routineTotal,
          });
          runningCash -= routineTotal;
        }
      }

      // Cutoff markers
      if (dayOfMonth === 15) {
        events.push({
          id: `cutoff-spl-${isoDate}`,
          kind: "CUTOFF",
          label: "SPayLater Cutoff (15th)",
          amountRp: 0,
        });
      }
      if (dayOfMonth === 20) {
        events.push({
          id: `cutoff-cc-${isoDate}`,
          kind: "CUTOFF",
          label: "Credit Card Statement Cutoff (20th)",
          amountRp: 0,
        });
      }

      // Due dates
      if (dayOfMonth === 11 && ccAmount > 0 && i > 0) {
        events.push({
          id: `due-cc-${isoDate}`,
          kind: "DUE",
          label: "Credit Card Due (11th)",
          amountRp: -ccAmount,
          settled: ccSettled,
        });
        runningCash -= ccAmount;
      }

      if (dayOfMonth === 25 && i > 0) {
        if (payLaterAmount > 0) {
          events.push({
            id: `due-spl-${isoDate}`,
            kind: "DUE",
            label: "PayLater Bills Due (25th)",
            amountRp: -payLaterAmount,
            settled: payLaterSettled,
          });
          runningCash -= payLaterAmount;
        }
        if (personalAmount > 0) {
          events.push({
            id: `due-pers-${isoDate}`,
            kind: "DUE",
            label: "Personal Debt / SPinjam Due",
            amountRp: -personalAmount,
            settled: personalSettled,
          });
          runningCash -= personalAmount;
        }
      }

      runningCash -= baselineDaily;

      days.push({
        isoDate,
        dayOfMonth,
        monthLabel: MONTH_SHORT[monthIdx],
        events,
        endOfDayCashRp: runningCash,
        isToday: isoDate === jktIso,
        isLowestPoint: false,
      });
    }

    let minIdx = 0;
    let maxCashRp = days[0]?.endOfDayCashRp ?? 0;
    for (let i = 0; i < days.length; i++) {
      if (days[i].endOfDayCashRp <= (days[minIdx]?.endOfDayCashRp ?? 0)) {
        minIdx = i;
      }
      if (days[i].endOfDayCashRp > maxCashRp) {
        maxCashRp = days[i].endOfDayCashRp;
      }
    }
    if (days[minIdx]) {
      days[minIdx].isLowestPoint = true;
    }

    const lowestDay = days[minIdx] ?? null;
    const totalOutflows = ccAmount + payLaterAmount + personalAmount + routineTotal;

    return {
      startIso,
      endIso,
      days,
      lowestDay,
      maxCashRp,
      netIncome,
      totalOutflows,
    };
  }, [snapshot, pacing, matrix, periodKey, periodLabel, month, year]);

  const upcomingEvents = useMemo(
    () =>
      radarProjection.days.flatMap((d) =>
        d.events.map((ev) => ({
          ...ev,
          isoDate: d.isoDate,
          dayLabel: `${d.monthLabel} ${d.dayOfMonth}`,
          endOfDayCashRp: d.endOfDayCashRp,
        })),
      ),
    [radarProjection.days],
  );

  return (
    <div className="space-y-6 w-full max-w-full pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
            Cash Radar &amp; Payday Horizon · {periodLabel}
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary mt-0.5">
            Inflows, Cutoffs, Due Dates &amp; Lowest Cash Point
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Cycle window {pacing?.cycleDateLabel ?? `${radarProjection.startIso} -> ${radarProjection.endIso}`} · Temporal State:{" "}
            <strong className="font-mono text-text-primary">
              {pacing?.cycleTemporalState ?? "ACTIVE"}
            </strong>
          </p>
        </div>

        <Link
          href={`/credit?sub=matrix&month=${month}&year=${year}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-border bg-surface hover:bg-surface-hover text-xs font-medium text-text-primary"
        >
          <span>Inspect Liability Matrix</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Lowest Cash Point & Cycle Liquidity KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
            Lowest Cash Point (Before Next Payday)
          </div>
          <div
            className={`font-display text-3xl font-normal tracking-tight mt-2 tabular-nums ${
              (radarProjection.lowestDay?.endOfDayCashRp ?? 0) < 0
                ? "text-urgency"
                : "text-text-primary"
            }`}
          >
            {formatRp(radarProjection.lowestDay?.endOfDayCashRp ?? 0)}
          </div>
          <div className="text-xs text-text-tertiary mt-2 font-mono">
            {radarProjection.lowestDay
              ? `Trough projected on ${radarProjection.lowestDay.monthLabel} ${radarProjection.lowestDay.dayOfMonth} (${radarProjection.lowestDay.isoDate})`
              : "Awaiting payout window"}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
            Payday Inflow vs Scheduled Bills
          </div>
          <div className="font-mono text-xl font-semibold text-delta-positive mt-2 tabular-nums">
            +{formatRp(radarProjection.netIncome)}
          </div>
          <div className="text-xs text-text-secondary mt-2 font-mono tabular-nums">
            Outflows &amp; Routine Reserve: -{formatRp(radarProjection.totalOutflows)}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
            Daily Safe Pacing Drain
          </div>
          <div className="font-mono text-xl font-semibold text-text-primary mt-2 tabular-nums">
            -{formatRp(pacing?.baselineDailyRate ?? 0)} / day
          </div>
          <div className="text-xs text-text-tertiary mt-2 font-mono tabular-nums">
            {radarProjection.days.length}-day cycle span · Peak cash {formatRp(radarProjection.maxCashRp)}
          </div>
        </div>
      </div>

      {/* Payday-to-Payday Calendar Grid */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-text-tertiary" />
            <h2 className="text-sm font-semibold text-text-primary">
              Paycycle Horizon Calendar ({radarProjection.startIso} to {radarProjection.endIso})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-text-tertiary">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-delta-positive" /> Payday
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-caution" /> Cutoff (15th/20th)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-delta-negative" /> Bill Due (11th/25th)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-urgency" /> Lowest Cash Day
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
          {radarProjection.days.map((d) => (
            <div
              key={d.isoDate}
              className={`rounded border p-2.5 min-h-[104px] flex flex-col justify-between text-xs ${
                d.isLowestPoint
                  ? "border-urgency/60 bg-[rgba(255,56,56,0.06)]"
                  : d.isToday
                    ? "border-text-primary bg-surface-subtle/80"
                    : d.events.length > 0
                      ? "border-border bg-surface-subtle/40"
                      : "border-border-subtle bg-canvas/50"
              }`}
            >
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="font-semibold text-text-primary">
                  {d.monthLabel} {d.dayOfMonth}
                </span>
                {d.isToday && (
                  <span className="text-[9px] uppercase text-text-primary">Today</span>
                )}
                {!d.isToday && d.isLowestPoint && (
                  <span className="text-[9px] uppercase text-urgency">Trough</span>
                )}
              </div>

              <div className="space-y-1 my-1.5">
                {d.events.map((ev) => (
                  <div
                    key={ev.id}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono leading-tight ${
                      ev.kind === "PAYDAY"
                        ? "bg-[rgba(16,183,141,0.12)] text-delta-positive"
                        : ev.kind === "CUTOFF"
                          ? "bg-[rgba(245,158,11,0.12)] text-caution"
                          : ev.kind === "DUE"
                            ? ev.settled
                              ? "bg-[rgba(16,183,141,0.10)] text-delta-positive"
                              : "bg-[rgba(255,56,56,0.12)] text-delta-negative"
                            : "bg-surface text-text-secondary"
                    }`}
                  >
                    <div className="truncate" title={ev.label}>
                      {ev.label}
                    </div>
                    {ev.amountRp !== 0 && (
                      <div className="tabular-nums font-semibold">
                        {ev.amountRp > 0 ? `+${formatRp(ev.amountRp)}` : formatRp(ev.amountRp)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-1 border-t border-border-subtle flex items-center justify-between text-[10px] font-mono tabular-nums text-text-tertiary">
                <span>Est.</span>
                <span className={d.endOfDayCashRp < 0 ? "text-urgency font-semibold" : ""}>
                  {formatRp(d.endOfDayCashRp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chronological Event Ledger */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">
            Chronological Cash &amp; Cutoff Milestones ({upcomingEvents.length})
          </h3>
        </div>
        <div className="divide-y divide-border-subtle">
          {upcomingEvents.map((ev) => (
            <div
              key={ev.id}
              className="px-5 py-2.5 flex items-center justify-between gap-4 text-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-text-tertiary w-16 shrink-0">{ev.dayLabel}</span>
                <span className="font-medium text-text-primary truncate">{ev.label}</span>
                {ev.settled && (
                  <span className="text-[10px] font-mono text-delta-positive">Settled</span>
                )}
              </div>
              <div className="flex items-center gap-6 shrink-0 font-mono tabular-nums">
                <span
                  className={
                    ev.amountRp > 0
                      ? "text-delta-positive font-semibold"
                      : ev.amountRp < 0
                        ? "text-delta-negative"
                        : "text-caution"
                  }
                >
                  {ev.amountRp === 0
                    ? "Cutoff Trigger"
                    : ev.amountRp > 0
                      ? `+${formatRp(ev.amountRp)}`
                      : formatRp(ev.amountRp)}
                </span>
                <span className="text-text-tertiary w-28 text-right">
                  Bal: {formatRp(ev.endOfDayCashRp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
