"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  ShieldAlert,
  TrendingDown,
} from "lucide-react";
import {
  CashRadarDayPointDto,
  CashRadarEventDto,
  CashRadarResponse,
  fetchCashRadar,
} from "@/lib/api";
import { usePeriodSlice } from "@/hooks/usePeriodSlice";
import { usePeriod } from "@/context/PeriodContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { formatRupiah } from "@/lib/utils";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";

export interface CashRadarCalendarData {
  radar: CashRadarResponse | null;
}

interface CashRadarCalendarClientProps {
  initialMonth: number;
  initialYear: number;
  initialData: CashRadarCalendarData;
}

type EventFilterMode = "ALL" | "INFLOW" | "BILLS" | "CUTOFF";

const COPY_BY_LOCALE = {
  en: {
    eyebrow: "CASH RADAR & BILLING SCHEDULE",
    title: "Daily Cashflow & Cutoff Radar",
    subtitle:
      "Track payday credits, card and PayLater statement closings, individual due dates, and your projected running bank balance across each paycycle.",
    paydayInflows: "Payday & Inflows",
    scheduledBills: "Scheduled Bills & Routine",
    lowestTrough: "Lowest Cash Point",
    cycleBuffer: "Projected Ending Buffer",
    balanceCurve: "Cycle Running Cash Trajectory",
    selectedDayInspector: "Day Breakdown",
    noEventsDay: "No scheduled inflows, cutoffs, or bills on this date.",
    openingCash: "Opening Cash",
    closingCash: "Closing Cash",
    inCycle: "In active paycycle",
    outsideCycle: "Outside active cycle",
    shiftedH1: "Shifted H-1 working day",
    finalSlice: "Final installment (clears next cycle)",
    filters: {
      ALL: "All Events",
      INFLOW: "Inflows",
      BILLS: "Bills Due",
      CUTOFF: "Cutoffs",
    },
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    loading: "Loading period schedule...",
    prevMonth: "Previous month",
    nextMonth: "Next month",
  },
  id: {
    eyebrow: "RADAR KAS & JADWAL TAGIHAN",
    title: "Radar Arus Kas & Tanggal Cutoff",
    subtitle:
      "Pantau tanggal gajian, tanggal tutup buku kartu kredit dan PayLater, jatuh tempo per kontrak, serta proyeksi saldo harian dalam satu siklus.",
    paydayInflows: "Masuk Gajian & Inflow",
    scheduledBills: "Tagihan & Rutin Terjadwal",
    lowestTrough: "Titik Saldo Terendah",
    cycleBuffer: "Sisa Buffer Akhir Siklus",
    balanceCurve: "Proyeksi Kurva Saldo Siklus",
    selectedDayInspector: "Rincian Tanggal",
    noEventsDay: "Tidak ada inflow, cutoff, atau tagihan jatuh tempo pada tanggal ini.",
    openingCash: "Saldo Awal",
    closingCash: "Saldo Akhir",
    inCycle: "Dalam siklus aktif",
    outsideCycle: "Di luar siklus aktif",
    shiftedH1: "Dimajukan H-1 hari kerja",
    finalSlice: "Cicilan terakhir (lunas siklus depan)",
    filters: {
      ALL: "Semua",
      INFLOW: "Pemasukan",
      BILLS: "Jatuh Tempo",
      CUTOFF: "Cutoff",
    },
    weekdays: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
    loading: "Memuat jadwal periode...",
    prevMonth: "Periode sebelumnya",
    nextMonth: "Periode berikutnya",
  },
  zh: {
    eyebrow: "现金流雷达与账单日程",
    title: "每日现金流与结账日雷达",
    subtitle:
      "按发薪周期追踪薪资入账、信用卡与分期结账日、逐笔到期扣款以及每日银行余额最低点。",
    paydayInflows: "发薪与入账总额",
    scheduledBills: "计划账单与固定支出",
    lowestTrough: "周期最低现金点",
    cycleBuffer: "期末预计结余",
    balanceCurve: "周期每日余额走势",
    selectedDayInspector: "当日明细",
    noEventsDay: "当日无入账、结账截止或到期账单。",
    openingCash: "期初余额",
    closingCash: "日终余额",
    inCycle: "属于当前周期",
    outsideCycle: "周期外日期",
    shiftedH1: "提前至前1个工作日",
    finalSlice: "最后一期（下月清零）",
    filters: {
      ALL: "全部",
      INFLOW: "入账",
      BILLS: "到期账单",
      CUTOFF: "结账日",
    },
    weekdays: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    loading: "正在加载周期日程...",
    prevMonth: "上一周期",
    nextMonth: "下一周期",
  },
} as const;

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtShortDate(iso: string): string {
  if (!iso || iso.length < 10) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS_SHORT[(m || 1) - 1]} ${y}`;
}

function formatCompactRp(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return `${sign}${abs}`;
}

function eventCategoryTone(cat: string): {
  pill: string;
  dot: string;
  badgeText: string;
} {
  switch (cat) {
    case "INFLOW":
      return {
        pill: "bg-positive/10 text-positive border border-positive/25",
        dot: "bg-positive",
        badgeText: "INFLOW",
      };
    case "CUTOFF":
      return {
        pill: "bg-caution/10 text-caution border border-caution/25",
        dot: "bg-caution",
        badgeText: "CUTOFF",
      };
    case "CREDIT_CARD":
      return {
        pill: "bg-surface-elevated text-text-primary border border-border-strong",
        dot: "bg-negative",
        badgeText: "CC DUE",
      };
    case "PAYLATER":
      return {
        pill: "bg-negative/10 text-negative border border-negative/25",
        dot: "bg-negative",
        badgeText: "PAYLATER",
      };
    case "PERSONAL_DEBT":
    case "P1_VAULT_REFUND":
      return {
        pill: "bg-negative/10 text-negative border border-negative/20",
        dot: "bg-negative",
        badgeText: "LOAN",
      };
    case "SAVINGS":
      return {
        pill: "bg-positive/10 text-positive border border-positive/20",
        dot: "bg-positive",
        badgeText: "VAULT",
      };
    default:
      return {
        pill: "bg-surface-subtle text-text-secondary border border-border-subtle",
        dot: "bg-text-tertiary",
        badgeText: cat,
      };
  }
}

export function CashRadarCalendarClient({
  initialMonth,
  initialYear,
  initialData,
}: CashRadarCalendarClientProps) {
  const { locale } = useLanguage();
  const { isAmountsMasked } = usePrivacyMask();
  const { setPeriod } = usePeriod();
  const t = COPY_BY_LOCALE[locale] ?? COPY_BY_LOCALE.en;

  const maskRp = useCallback(
    (v: number) => (isAmountsMasked ? "Rp ••••••" : formatRupiah(v)),
    [isAmountsMasked]
  );

  const fetchForPeriod = useCallback(
    async (m: number, y: number): Promise<CashRadarCalendarData> => {
      const radar = await fetchCashRadar(m, y);
      return { radar };
    },
    []
  );

  const { month, year, data, isLoading, isPreBoundary } =
    usePeriodSlice<CashRadarCalendarData>({
      initialMonth,
      initialYear,
      initialData,
      fetchForPeriod,
    });

  const radar = data?.radar ?? null;
  const [filterMode, setFilterMode] = useState<EventFilterMode>("ALL");
  const [selectedIso, setSelectedIso] = useState<string>(() => {
    if (!initialData.radar?.dailySeries?.length) return "";
    const todayPt = initialData.radar.dailySeries.find((d) => d.isToday);
    if (todayPt) return todayPt.dateIso;
    const firstBill = initialData.radar.events.find((e) => e.signedAmountRp < 0 && e.category !== "LIVING" && e.category !== "ROUTINE");
    return firstBill?.dateIso ?? initialData.radar.cycleStartIso;
  });

  const matchesFilter = useCallback(
    (ev: CashRadarEventDto) => {
      if (filterMode === "ALL") return true;
      if (filterMode === "INFLOW") return ev.category === "INFLOW";
      if (filterMode === "CUTOFF") return ev.category === "CUTOFF";
      return (
        ev.category === "PAYLATER" ||
        ev.category === "CREDIT_CARD" ||
        ev.category === "PERSONAL_DEBT" ||
        ev.category === "P1_VAULT_REFUND" ||
        ev.category === "ROUTINE"
      );
    },
    [filterMode]
  );

  // Build calendar cells for selected (month, year) + any leading/trailing days needed for a clean Mon-Sun grid
  const calendarWeeks = useMemo(() => {
    const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    // Convert Sunday=0..Saturday=6 into Monday=0..Sunday=6
    const startOffset = (firstOfMonth.getUTCDay() + 6) % 7;

    const pointMap = new Map<string, CashRadarDayPointDto>(
      (radar?.dailySeries ?? []).map((pt) => [pt.dateIso, pt])
    );

    const cells: Array<{
      dateIso: string;
      dayNumber: number;
      inCalendarMonth: boolean;
      point?: CashRadarDayPointDto;
    }> = [];

    // Pre-fill leading days from previous month (using actual Radar data if cycle started in M-1!)
    for (let i = startOffset; i > 0; i--) {
      const dt = new Date(Date.UTC(year, month - 1, 1 - i));
      const iso = dt.toISOString().slice(0, 10);
      cells.push({
        dateIso: iso,
        dayNumber: dt.getUTCDate(),
        inCalendarMonth: false,
        point: pointMap.get(iso),
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({
        dateIso: iso,
        dayNumber: d,
        inCalendarMonth: true,
        point: pointMap.get(iso),
      });
    }

    while (cells.length % 7 !== 0) {
      const tailOffset = cells.length - startOffset - daysInMonth + 1;
      const dt = new Date(Date.UTC(year, month, tailOffset));
      const iso = dt.toISOString().slice(0, 10);
      cells.push({
        dateIso: iso,
        dayNumber: dt.getUTCDate(),
        inCalendarMonth: false,
        point: pointMap.get(iso),
      });
    }

    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }, [month, year, radar]);

  // Also ensure any earlier paycycle days from M-1 prior to grid start (unlikely with leading row, but guaranteed via cycleSeries) render cleanly in curve
  const activeCycleSeries = useMemo(() => {
    if (!radar?.dailySeries) return [];
    return radar.dailySeries.filter((d) => d.inActiveCycle);
  }, [radar]);

  const effectiveSelectedIso = useMemo(() => {
    if (selectedIso && (radar?.dailySeries ?? []).some((d) => d.dateIso === selectedIso)) {
      return selectedIso;
    }
    const todayPt = radar?.dailySeries.find((d) => d.isToday);
    if (todayPt) return todayPt.dateIso;
    return radar?.lowestCashPoint?.dateIso || radar?.cycleStartIso || "";
  }, [selectedIso, radar]);

  const selectedPoint = useMemo(
    () => (radar?.dailySeries ?? []).find((d) => d.dateIso === effectiveSelectedIso) ?? null,
    [radar, effectiveSelectedIso]
  );

  // Synced SVG curve points across active cycle
  const chartGeometry = useMemo(() => {
    if (activeCycleSeries.length === 0) return null;
    const width = 760;
    const height = 112;
    const padX = 12;
    const padTop = 14;
    const padBottom = 18;
    const plotW = width - padX * 2;
    const plotH = height - padTop - padBottom;

    const vals = activeCycleSeries.map((p) => p.closingBalanceRp);
    const minVal = Math.min(0, ...vals);
    const maxVal = Math.max(1_000_000, ...vals);
    const range = Math.max(1, maxVal - minVal);

    const coords = activeCycleSeries.map((pt, idx) => {
      const x =
        activeCycleSeries.length === 1
          ? padX + plotW / 2
          : padX + (idx / (activeCycleSeries.length - 1)) * plotW;
      const y = padTop + ((maxVal - pt.closingBalanceRp) / range) * plotH;
      return { x, y, pt };
    });

    const zeroY = padTop + ((maxVal - 0) / range) * plotH;
    const linePath = coords
      .map((c, idx) => `${idx === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(" ");
    const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${coords[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`;

    const selectedCoord = coords.find((c) => c.pt.dateIso === effectiveSelectedIso) ?? null;
    const troughCoord =
      coords.find((c) => c.pt.dateIso === radar?.lowestCashPoint.dateIso) ?? null;

    return {
      width,
      height,
      zeroY,
      linePath,
      areaPath,
      coords,
      selectedCoord,
      troughCoord,
    };
  }, [activeCycleSeries, effectiveSelectedIso, radar]);

  const handleShiftPeriod = (delta: number) => {
    const idx = year * 12 + (month - 1) + delta;
    const nextY = Math.floor(idx / 12);
    const nextM = (idx % 12) + 1;
    setPeriod(nextM, nextY);
    setSelectedIso("");
  };

  if (isPreBoundary) {
    return (
      <div className="space-y-6 w-full max-w-full pb-14">
        <PreBoundaryNotice month={month} year={year} />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full pb-16">
      {/* Header Row */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
            <CalendarIcon className="w-3.5 h-3.5 text-positive" />
            <span>{t.eyebrow}</span>
            {radar && (
              <span className="text-text-secondary">
                · {fmtShortDate(radar.cycleStartIso)} – {fmtShortDate(radar.cycleEndIso)}
              </span>
            )}
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">{t.title}</h1>
          <p className="text-xs text-text-secondary max-w-2xl leading-relaxed">{t.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded border border-border bg-surface p-0.5">
            {(["ALL", "INFLOW", "BILLS", "CUTOFF"] as EventFilterMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterMode(mode)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-sm cursor-pointer transition-colors ${
                  filterMode === mode
                    ? "bg-surface-active text-text-primary"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {t.filters[mode]}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center rounded border border-border bg-surface">
            <button
              type="button"
              onClick={() => handleShiftPeriod(-1)}
              aria-label={t.prevMonth}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-xs font-mono text-text-primary tabular-nums">
              {String(month).padStart(2, "0")}/{year}
            </span>
            <button
              type="button"
              onClick={() => handleShiftPeriod(1)}
              aria-label={t.nextMonth}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
            <span>{t.paydayInflows}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-positive" />
          </div>
          <div className="text-2xl font-semibold tracking-tight font-display text-positive tabular-nums">
            {radar ? maskRp(radar.paydayInflowsRp) : "Rp 0"}
          </div>
          <div className="text-[11px] font-mono text-text-tertiary">
            {radar ? `Credited ${fmtShortDate(radar.cycleStartIso)}` : "-"}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
            <span>{t.scheduledBills}</span>
            <ArrowDownRight className="w-3.5 h-3.5 text-negative" />
          </div>
          <div className="text-2xl font-semibold tracking-tight font-display text-text-primary tabular-nums">
            {radar ? maskRp(radar.totalScheduledBillsRp) : "Rp 0"}
          </div>
          <div className="text-[11px] font-mono text-text-tertiary">
            {radar
              ? `${radar.events.filter((e) => e.signedAmountRp < 0).length} scheduled outflows`
              : "-"}
          </div>
        </div>

        <div
          className={`bg-surface border border-border rounded-lg p-4 space-y-1.5 ${
            radar?.lowestCashPoint?.isTightOrDeficit ? "erp-callout-urgency" : ""
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
            <span>{t.lowestTrough}</span>
            <TrendingDown
              className={`w-3.5 h-3.5 ${
                radar?.lowestCashPoint?.isTightOrDeficit ? "text-urgency" : "text-caution"
              }`}
            />
          </div>
          <div
            className={`text-2xl font-semibold tracking-tight font-display tabular-nums ${
              radar?.lowestCashPoint?.isTightOrDeficit ? "text-urgency" : "text-text-primary"
            }`}
          >
            {radar ? maskRp(radar.lowestCashPoint.balanceRp) : "Rp 0"}
          </div>
          <div className="text-[11px] font-mono text-text-tertiary truncate">
            {radar
              ? `${fmtShortDate(radar.lowestCashPoint.dateIso)} · ${radar.lowestCashPoint.contextLabel}`
              : "-"}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
            <span>{t.cycleBuffer}</span>
            <Clock className="w-3.5 h-3.5 text-text-secondary" />
          </div>
          <div
            className={`text-2xl font-semibold tracking-tight font-display tabular-nums ${
              (radar?.endingCashBufferRp ?? 0) >= 0 ? "text-positive" : "text-negative"
            }`}
          >
            {radar ? maskRp(radar.endingCashBufferRp) : "Rp 0"}
          </div>
          <div className="text-[11px] font-mono text-text-tertiary">
            {radar ? `Cycle closes ${fmtShortDate(radar.cycleEndIso)}` : "-"}
          </div>
        </div>
      </div>

      {/* Synchronized SVG Cash Curve */}
      {chartGeometry && radar && (
        <div className="bg-surface border border-border rounded-lg p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-text-primary">{t.balanceCurve}</span>
            <span className="font-mono text-[11px] text-text-tertiary">
              {fmtShortDate(radar.cycleStartIso)} → {fmtShortDate(radar.cycleEndIso)}
            </span>
          </div>
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
              className="w-full h-28 overflow-visible"
              role="img"
              aria-label={t.balanceCurve}
            >
              <line
                x1={12}
                x2={chartGeometry.width - 12}
                y1={chartGeometry.zeroY}
                y2={chartGeometry.zeroY}
                stroke="rgba(107, 114, 128, 0.35)"
                strokeDasharray="3 4"
                strokeWidth="1"
              />
              <path d={chartGeometry.areaPath} fill="rgba(16, 183, 141, 0.08)" />
              <path
                d={chartGeometry.linePath}
                fill="none"
                stroke="#10b78d"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {chartGeometry.troughCoord && (
                <circle
                  cx={chartGeometry.troughCoord.x}
                  cy={chartGeometry.troughCoord.y}
                  r={4}
                  fill={radar.lowestCashPoint.isTightOrDeficit ? "#ff3838" : "#e59b2c"}
                />
              )}
              {chartGeometry.selectedCoord && (
                <>
                  <line
                    x1={chartGeometry.selectedCoord.x}
                    x2={chartGeometry.selectedCoord.x}
                    y1={8}
                    y2={chartGeometry.height - 14}
                    stroke="#384054"
                    strokeDasharray="2 2"
                    strokeWidth="1"
                  />
                  <circle
                    cx={chartGeometry.selectedCoord.x}
                    cy={chartGeometry.selectedCoord.y}
                    r={4.5}
                    fill="#f3f4f6"
                    stroke="#10b78d"
                    strokeWidth="2"
                  />
                </>
              )}
            </svg>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-text-tertiary">
            <span>{fmtShortDate(radar.cycleStartIso)}</span>
            {chartGeometry.troughCoord && (
              <span>
                Lowest: {fmtShortDate(radar.lowestCashPoint.dateIso)} (
                {maskRp(radar.lowestCashPoint.balanceRp)})
              </span>
            )}
            <span>{fmtShortDate(radar.cycleEndIso)}</span>
          </div>
        </div>
      )}

      {/* Main Split: Calendar Grid + Day Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 bg-surface border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-text-secondary font-mono">{t.loading}</div>
          ) : (
            <>
              <div className="grid grid-cols-7 border-b border-border bg-surface-subtle/50">
                {t.weekdays.map((wd) => (
                  <div
                    key={wd}
                    className="py-2 px-2.5 text-[10px] font-mono uppercase tracking-wider text-text-tertiary border-r last:border-r-0 border-border-subtle"
                  >
                    {wd}
                  </div>
                ))}
              </div>

              <div className="divide-y divide-border-subtle">
                {calendarWeeks.map((week, wIdx) => (
                  <div key={wIdx} className="grid grid-cols-7">
                    {week.map((cell) => {
                      const pt = cell.point;
                      const filteredEvents = (pt?.events ?? []).filter(matchesFilter);
                      const isSelected = cell.dateIso === effectiveSelectedIso;
                      const inCycle = pt?.inActiveCycle ?? false;
                      const isTroughDay =
                        radar?.lowestCashPoint.dateIso === cell.dateIso &&
                        radar.lowestCashPoint.isTightOrDeficit;

                      return (
                        <button
                          key={cell.dateIso}
                          type="button"
                          onClick={() => setSelectedIso(cell.dateIso)}
                          className={`min-h-[96px] p-2 text-left border-r last:border-r-0 border-border-subtle flex flex-col justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? "erp-surface-selected"
                              : isTroughDay
                                ? "erp-callout-urgency"
                                : inCycle
                                  ? "bg-canvas hover:bg-surface-hover"
                                  : "bg-surface-subtle/30 opacity-60 hover:opacity-85 hover:bg-surface-hover/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 w-full">
                            <span
                              className={`text-xs font-mono tabular-nums ${
                                pt?.isToday
                                  ? "px-1.5 py-0.5 rounded-sm bg-accent/15 text-accent font-semibold"
                                  : cell.inCalendarMonth
                                    ? "text-text-primary font-medium"
                                    : "text-text-tertiary"
                              }`}
                            >
                              {cell.dayNumber}
                            </span>

                            {inCycle && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  pt && pt.events.some((e) => e.category === "CUTOFF")
                                    ? "bg-caution"
                                    : pt && pt.events.some((e) => e.category === "INFLOW")
                                      ? "bg-positive"
                                      : "bg-border-strong"
                                }`}
                              />
                            )}
                          </div>

                          <div className="space-y-1 my-1 w-full">
                            {filteredEvents.slice(0, 3).map((ev) => {
                              const tone = eventCategoryTone(ev.category);
                              return (
                                <div
                                  key={ev.id}
                                  className={`px-1.5 py-0.5 rounded-sm text-[9px] font-mono truncate flex items-center justify-between gap-1 ${tone.pill}`}
                                  title={ev.label}
                                >
                                  <span className="truncate">
                                    {ev.category === "CUTOFF"
                                      ? "Cutoff"
                                      : ev.category === "INFLOW"
                                        ? "Payday"
                                        : ev.label.split("—")[0].trim()}
                                  </span>
                                  {ev.signedAmountRp !== 0 && (
                                    <span className="shrink-0">
                                      {formatCompactRp(ev.signedAmountRp)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {filteredEvents.length > 3 && (
                              <div className="text-[9px] font-mono text-text-tertiary pl-0.5">
                                +{filteredEvents.length - 3} more
                              </div>
                            )}
                          </div>

                          <div className="text-right w-full">
                            {pt && inCycle ? (
                              <span
                                className={`text-[10px] font-mono tabular-nums ${
                                  pt.closingBalanceRp < 0
                                    ? "text-urgency font-medium"
                                    : pt.closingBalanceRp === 0
                                      ? "text-text-tertiary"
                                      : "text-text-secondary"
                                }`}
                              >
                                {isAmountsMasked ? "•••" : formatCompactRp(pt.closingBalanceRp)}
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono text-text-disabled">·</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right Rail: Interactive Day Inspector */}
        <aside className="lg:col-span-4 bg-surface border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
                {t.selectedDayInspector}
              </div>
              <div className="text-base font-semibold text-text-primary font-mono mt-0.5">
                {effectiveSelectedIso ? fmtShortDate(effectiveSelectedIso) : "-"}
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-sm text-[10px] font-mono ${
                selectedPoint?.inActiveCycle
                  ? "bg-positive/10 text-positive border border-positive/20"
                  : "bg-surface-subtle text-text-tertiary border border-border-subtle"
              }`}
            >
              {selectedPoint?.inActiveCycle ? t.inCycle : t.outsideCycle}
            </span>
          </div>

          {selectedPoint && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded bg-canvas border border-border-subtle p-2.5">
                <div className="text-[10px] font-mono uppercase text-text-tertiary">
                  {t.openingCash}
                </div>
                <div className="text-xs font-mono text-text-secondary tabular-nums mt-0.5">
                  {maskRp(selectedPoint.openingBalanceRp)}
                </div>
              </div>
              <div className="rounded bg-canvas border border-border-subtle p-2.5">
                <div className="text-[10px] font-mono uppercase text-text-tertiary">
                  {t.closingCash}
                </div>
                <div
                  className={`text-xs font-mono font-semibold tabular-nums mt-0.5 ${
                    selectedPoint.closingBalanceRp < 0
                      ? "text-urgency"
                      : "text-text-primary"
                  }`}
                >
                  {maskRp(selectedPoint.closingBalanceRp)}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            {(selectedPoint?.events ?? []).length === 0 ? (
              <div className="rounded bg-surface-subtle/50 border border-border-subtle p-3.5 text-xs text-text-tertiary leading-relaxed flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-text-tertiary" />
                <span>{t.noEventsDay}</span>
              </div>
            ) : (
              selectedPoint!.events.map((ev) => {
                const tone = eventCategoryTone(ev.category);
                return (
                  <div
                    key={ev.id}
                    className={`rounded p-3 space-y-1.5 border border-border-subtle bg-canvas ${
                      ev.isBusinessDayShifted
                        ? "erp-callout-caution"
                        : ev.category === "CUTOFF"
                          ? "erp-callout-caution"
                          : ev.isFinalSlice
                            ? "erp-callout-positive"
                            : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-text-primary leading-snug">
                        {ev.label}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-mono shrink-0 ${tone.pill}`}>
                        {tone.badgeText}
                      </span>
                    </div>

                    {ev.signedAmountRp !== 0 && (
                      <div
                        className={`text-sm font-mono font-semibold tabular-nums ${
                          ev.signedAmountRp > 0 ? "text-positive" : "text-text-primary"
                        }`}
                      >
                        {ev.signedAmountRp > 0 ? "+" : "-"}
                        {maskRp(Math.abs(ev.signedAmountRp))}
                      </div>
                    )}

                    {(ev.sliceLabel || ev.isFinalSlice || ev.isBusinessDayShifted) && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {ev.sliceLabel && (
                          <span className="px-1.5 py-0.5 rounded-sm bg-surface text-[10px] font-mono text-text-secondary border border-border-subtle">
                            Slice {ev.sliceLabel}
                          </span>
                        )}
                        {ev.isFinalSlice && (
                          <span className="px-1.5 py-0.5 rounded-sm bg-positive/10 text-[10px] font-mono text-positive">
                            {t.finalSlice}
                          </span>
                        )}
                        {ev.isBusinessDayShifted && (
                          <span className="px-1.5 py-0.5 rounded-sm bg-caution/10 text-[10px] font-mono text-caution inline-flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" />
                            <span>{t.shiftedH1}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {ev.notes && (
                      <p className="text-[11px] text-text-secondary leading-relaxed">{ev.notes}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
