"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Plus,
  ShieldAlert,
  TrendingDown,
} from "lucide-react";
import {
  CashRadarDayPointDto,
  CashRadarEventDto,
  CashRadarResponse,
  CommitmentCategory,
  CommitmentFundingSource,
  createCommitment,
  fetchCashRadar,
  updateCommitmentStatus,
} from "@/lib/api";
import { usePeriodSlice } from "@/hooks/usePeriodSlice";
import { useSubModule } from "@/hooks/useSubModule";
import { CASHFLOW_SUB_KEYS, CashflowSubKey } from "@/lib/tabs";
import { useLanguage } from "@/context/LanguageContext";
import { usePeriod } from "@/context/PeriodContext";
import { usePerspective } from "@/context/PerspectiveContext";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { usePrivacyGuard } from "@/hooks/usePrivacyGuard";
import { useToast } from "@/context/ToastContext";
import { formatCurrencyInput, formatRupiah, parseCurrencyInput } from "@/lib/utils";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SubModuleNav } from "@/components/primitives/SubModuleNav";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";
import { CalendarLedgerEmbed } from "@/components/calendar/CalendarLedgerEmbed";
import { StatementImportClient } from "@/components/import/StatementImportClient";

export interface CashRadarCalendarData {
  radar: CashRadarResponse | null;
}

interface CashRadarCalendarClientProps {
  initialMonth: number;
  initialYear: number;
  initialData: CashRadarCalendarData;
}

type EventFilterMode = "ALL" | "INFLOW" | "BILLS" | "COMMITMENT" | "CUTOFF" | "SPENDING";

const COPY_BY_LOCALE = {
  en: {
    eyebrow: "CASH CALENDAR & BILLING SCHEDULE",
    title: "Daily Cashflow & Cutoff Calendar",
    subtitle:
      "Track payday credits, THR payouts, card and PayLater statement closings, daily living spend, individual due dates, and your running bank balance across each paycycle.",
    paydayInflows: "Payday & Inflows",
    scheduledBills: "Scheduled Bills & Routine",
    lowestTrough: "Lowest Cash Point",
    cycleBuffer: "Projected Ending Buffer",
    balanceCurve: "Cycle Running Cash Trajectory",
    selectedDayInspector: "Day Breakdown",
    noEventsDay: "No scheduled inflows, cutoffs, bills, or spending logged on this date.",
    openingCash: "Opening Cash",
    closingCash: "Closing Cash",
    inCycle: "In active paycycle",
    outsideCycle: "Outside active cycle",
    shiftedH1: "Shifted H-1 working day",
    finalSlice: "Final installment (clears next cycle)",
    insidePoolNote: "Paid from allocated living/routine pool (not double-subtracted)",
    paydayTag: "PAYDAY",
    filters: {
      ALL: "All Activity",
      INFLOW: "Inflows & THR",
      BILLS: "Bills Due",
      COMMITMENT: "Commitments",
      CUTOFF: "Cutoffs",
      SPENDING: "Daily Spend",
    },
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    loading: "Loading period schedule...",
    prevMonth: "Previous month",
    nextMonth: "Next month",
  },
  id: {
    eyebrow: "KALENDER KAS & JADWAL TAGIHAN",
    title: "Kalender Arus Kas & Tanggal Cutoff",
    subtitle:
      "Pantau tanggal gajian, pencairan THR, tanggal tutup buku kartu kredit dan PayLater, pengeluaran harian, jatuh tempo kontrak, serta saldo berjalan dalam satu siklus.",
    paydayInflows: "Masuk Gajian & Inflow",
    scheduledBills: "Tagihan & Rutin Terjadwal",
    lowestTrough: "Titik Saldo Terendah",
    cycleBuffer: "Sisa Buffer Akhir Siklus",
    balanceCurve: "Proyeksi Kurva Saldo Siklus",
    selectedDayInspector: "Rincian Tanggal",
    noEventsDay: "Tidak ada inflow, cutoff, tagihan, atau catatan belanja pada tanggal ini.",
    openingCash: "Saldo Awal",
    closingCash: "Saldo Akhir",
    inCycle: "Dalam siklus aktif",
    outsideCycle: "Di luar siklus aktif",
    shiftedH1: "Dimajukan H-1 hari kerja",
    finalSlice: "Cicilan terakhir (lunas siklus depan)",
    insidePoolNote: "Dari pos anggaran harian/rutin (tidak mengurangi saldo dua kali)",
    paydayTag: "GAJIAN",
    filters: {
      ALL: "Semua Aktivitas",
      INFLOW: "Gajian & THR",
      BILLS: "Jatuh Tempo",
      COMMITMENT: "Komitmen",
      CUTOFF: "Cutoff",
      SPENDING: "Belanja Harian",
    },
    weekdays: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
    loading: "Memuat jadwal periode...",
    prevMonth: "Periode sebelumnya",
    nextMonth: "Periode berikutnya",
  },
  zh: {
    eyebrow: "现金流日历与账单日程",
    title: "每日现金流与账单日历",
    subtitle:
      "按发薪周期完整追踪薪资与津贴入账、信用卡与分期结账日、日常消费记录、逐笔到期扣款及每日银行余额走势。",
    paydayInflows: "发薪与入账总额",
    scheduledBills: "计划账单与固定支出",
    lowestTrough: "周期最低现金点",
    cycleBuffer: "期末预计结余",
    balanceCurve: "周期每日余额走势",
    selectedDayInspector: "当日明细",
    noEventsDay: "当日无入账、结账截止、到期账单或消费记录。",
    openingCash: "期初余额",
    closingCash: "日终余额",
    inCycle: "属于当前周期",
    outsideCycle: "周期外日期",
    shiftedH1: "提前至前1个工作日",
    finalSlice: "最后一期（下月清零）",
    insidePoolNote: "由已分配生活/固定预算池支出（不重复扣减银行余额）",
    paydayTag: "发薪",
    filters: {
      ALL: "全部记录",
      INFLOW: "入账与津贴",
      BILLS: "到期账单",
      COMMITMENT: "单次承诺",
      CUTOFF: "结账日",
      SPENDING: "日常消费",
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
    case "EXTRA_INCOME":
      return {
        pill: "bg-positive/10 text-positive border border-positive/25",
        dot: "bg-positive",
        badgeText: "EXTRA",
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
        badgeText: "SAVINGS",
      };
    case "LIVING_SPEND":
      return {
        pill: "bg-surface-subtle text-text-secondary border border-border-subtle",
        dot: "bg-text-tertiary",
        badgeText: "LIVING",
      };
    case "DIRECT_DEDUCTION":
      return {
        pill: "bg-negative/10 text-negative border border-negative/20",
        dot: "bg-negative",
        badgeText: "OUTFLOW",
      };
    case "COMMITMENT":
      return {
        pill: "bg-accent/10 text-accent border border-accent/25",
        dot: "bg-accent",
        badgeText: "COMMITMENT",
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
  const { locale, t: tGlobal } = useLanguage();
  const { refreshPeriod } = usePeriod();
  const { studioConfig } = usePerspective();
  const { isAmountsMasked } = usePrivacyMask();
  const { requireUnmasked } = usePrivacyGuard();
  const { toast } = useToast();
  const [activeSub, selectSub] = useSubModule<CashflowSubKey>(CASHFLOW_SUB_KEYS, "calendar");
  const [showQuickCommit, setShowQuickCommit] = useState(false);
  const [qcTitle, setQcTitle] = useState("");
  const [qcAmount, setQcAmount] = useState("100.000");
  const [qcCategory, setQcCategory] = useState<CommitmentCategory>("EVENT_OUTING");
  const [qcSource, setQcSource] = useState<CommitmentFundingSource>("PAYCHECK_UPFRONT");
  const [qcSaving, setQcSaving] = useState(false);
  const t = COPY_BY_LOCALE[locale] ?? COPY_BY_LOCALE.en;

  const maskRp = useCallback(
    (v: number) => formatRupiah(v, isAmountsMasked),
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
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);
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
      if (filterMode === "INFLOW") return ev.category === "INFLOW" || ev.category === "EXTRA_INCOME";
      if (filterMode === "CUTOFF") return ev.category === "CUTOFF";
      if (filterMode === "COMMITMENT") return ev.category === "COMMITMENT";
      if (filterMode === "SPENDING") {
        return (
          ev.category === "LIVING_SPEND" ||
          ev.category === "DIRECT_DEDUCTION" ||
          ev.category === "LIVING" ||
          ev.category === "ROUTINE"
        );
      }
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

  // Anchor grid from Monday on/before cycleStartIso (or 1st of month) through Sunday on/after cycleEndIso (or month end)
  const calendarWeeks = useMemo(() => {
    const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastOfMonth = new Date(Date.UTC(year, month - 1, daysInMonth));

    const parseIso = (iso?: string): Date | null => {
      if (!iso || iso.length < 10) return null;
      const [y0, m0, d0] = iso.slice(0, 10).split("-").map(Number);
      if (!y0 || !m0 || !d0) return null;
      return new Date(Date.UTC(y0, m0 - 1, d0));
    };

    const cycStart = parseIso(radar?.cycleStartIso);
    const cycEnd = parseIso(radar?.cycleEndIso);

    const anchorMin =
      cycStart && cycStart.getTime() < firstOfMonth.getTime() ? cycStart : firstOfMonth;
    const anchorMax =
      cycEnd && cycEnd.getTime() > lastOfMonth.getTime() ? cycEnd : lastOfMonth;

    // Roll back to Monday (Mon=0..Sun=6) and forward to Sunday
    const startOffset = (anchorMin.getUTCDay() + 6) % 7;
    const gridStartDt = new Date(anchorMin.getTime() - startOffset * 86400000);
    const endOffset = 6 - ((anchorMax.getUTCDay() + 6) % 7);
    const gridEndDt = new Date(anchorMax.getTime() + endOffset * 86400000);

    const pointMap = new Map<string, CashRadarDayPointDto>(
      (radar?.dailySeries ?? []).map((pt) => [pt.dateIso, pt])
    );

    const cells: Array<{
      dateIso: string;
      dayNumber: number;
      monthLabel: string;
      inCalendarMonth: boolean;
      point?: CashRadarDayPointDto;
    }> = [];

    for (let ts = gridStartDt.getTime(); ts <= gridEndDt.getTime(); ts += 86400000) {
      const dt = new Date(ts);
      const iso = dt.toISOString().slice(0, 10);
      const cellMonth = dt.getUTCMonth() + 1;
      const cellYear = dt.getUTCFullYear();
      cells.push({
        dateIso: iso,
        dayNumber: dt.getUTCDate(),
        monthLabel: MONTHS_SHORT[(cellMonth - 1) % 12],
        inCalendarMonth: cellMonth === month && cellYear === year,
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

  const hoveredCoord = useMemo(() => {
    if (!hoveredIso || !chartGeometry) return null;
    return chartGeometry.coords.find((c) => c.pt.dateIso === hoveredIso) ?? null;
  }, [hoveredIso, chartGeometry]);

  const totalFilteredEvents = useMemo(() => {
    if (!radar?.events) return 0;
    return radar.events.filter(matchesFilter).length;
  }, [radar, matchesFilter]);

  if (isPreBoundary) {
    return (
      <div className="space-y-6 w-full max-w-full pb-14">
        <PreBoundaryNotice month={month} year={year} />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full pb-16">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        periodLabel={radar ? `${fmtShortDate(radar.cycleStartIso)} – ${fmtShortDate(radar.cycleEndIso)}` : undefined}
      />

      <SubModuleNav
        items={[
          { key: "calendar", label: tGlobal("sub.cashflow.calendar") },
          { key: "ledger", label: tGlobal("sub.cashflow.ledger") },
          { key: "import", label: tGlobal("sub.cashflow.import") },
        ]}
        activeKey={activeSub}
        onSelect={selectSub}
      />

      {activeSub === "ledger" && (
        <CalendarLedgerEmbed month={month} year={year} />
      )}

      {activeSub === "import" && (
        <StatementImportClient embedded={true} />
      )}

      {activeSub === "calendar" && (
        <>

      {/* Summary Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-text-tertiary">
            <span>{t.paydayInflows}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-positive" />
          </div>
          <div className="text-2xl font-semibold tracking-tight font-display text-positive tabular-nums">
            {radar ? maskRp(radar.paydayInflowsRp) : "Rp 0"}
          </div>
          <div className="text-[11px] font-sans text-text-tertiary">
            {radar ? (
              <>
                Credited <span className="font-mono tabular-nums">{fmtShortDate(radar.cycleStartIso)}</span>
              </>
            ) : (
              "-"
            )}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-text-tertiary">
            <span>{t.scheduledBills}</span>
            <ArrowDownRight className="w-3.5 h-3.5 text-negative" />
          </div>
          <div className="text-2xl font-semibold tracking-tight font-display text-text-primary tabular-nums">
            {radar ? maskRp(radar.totalScheduledBillsRp) : "Rp 0"}
          </div>
          <div className="text-[11px] font-sans text-text-tertiary">
            {radar ? (
              <>
                <span className="font-mono tabular-nums">
                  {radar.events.filter((e) => e.signedAmountRp < 0).length}
                </span>{" "}
                scheduled outflows
              </>
            ) : (
              "-"
            )}
          </div>
        </div>

        <div
          className={`bg-surface border border-border rounded-lg p-4 space-y-1.5 ${
            radar?.lowestCashPoint?.isTightOrDeficit ? "erp-callout-urgency" : ""
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-medium text-text-tertiary">
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
          <div className="text-[11px] font-sans text-text-tertiary truncate" title={radar?.lowestCashPoint.contextLabel}>
            {radar ? (
              <>
                <span className="font-mono tabular-nums">{fmtShortDate(radar.lowestCashPoint.dateIso)}</span> ·{" "}
                {radar.lowestCashPoint.contextLabel}
              </>
            ) : (
              "-"
            )}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-text-tertiary">
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
          <div className="text-[11px] font-sans text-text-tertiary">
            {radar ? (
              <>
                Cycle closes <span className="font-mono tabular-nums">{fmtShortDate(radar.cycleEndIso)}</span>
              </>
            ) : (
              "-"
            )}
          </div>
        </div>
      </div>

      {/* Interactive Synchronized SVG Cash Curve */}
      {chartGeometry && radar && (
        <div className="bg-surface border border-border rounded-lg p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-semibold font-sans text-text-primary">{t.balanceCurve}</span>
              <span className="text-[11px] font-sans text-text-tertiary">
                {tGlobal("calendar.hoverHint")}
              </span>
            </div>
            <span className="font-mono text-[11px] text-text-tertiary tabular-nums">
              {fmtShortDate(radar.cycleStartIso)} → {fmtShortDate(radar.cycleEndIso)}
            </span>
          </div>
          <div className="relative w-full">
            {hoveredCoord && (
              <div
                style={{
                  left: `${Math.max(12, Math.min(88, (hoveredCoord.x / chartGeometry.width) * 100))}%`,
                }}
                className="pointer-events-none absolute -top-2 -translate-y-full -translate-x-1/2 z-30 w-64 rounded-lg border border-border-strong bg-surface-elevated shadow-2xl p-2.5 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-1.5">
                  <span className="font-mono text-[11px] text-text-primary font-semibold">
                    {fmtShortDate(hoveredCoord.pt.dateIso)}
                  </span>
                  <span
                    className={`font-mono text-xs font-semibold tabular-nums ${
                      hoveredCoord.pt.closingBalanceRp < 0
                        ? "text-urgency"
                        : hoveredCoord.pt.closingBalanceRp === 0
                          ? "text-text-secondary"
                          : "text-positive"
                    }`}
                  >
                    {maskRp(hoveredCoord.pt.closingBalanceRp)}
                  </span>
                </div>
                {(() => {
                  const netDay = hoveredCoord.pt.inflowsRp - hoveredCoord.pt.outflowsRp;
                  return (
                    <div className="flex items-center justify-between text-[10px] font-sans text-text-tertiary">
                      <span>{tGlobal("calendar.dayDelta")}</span>
                      {netDay !== 0 ? (
                        <span
                          className={`font-mono tabular-nums font-medium ${
                            netDay > 0 ? "text-positive" : "text-negative"
                          }`}
                        >
                          {netDay > 0 ? "+" : "-"}
                          {maskRp(Math.abs(netDay))}
                        </span>
                      ) : (
                        <span>{tGlobal("calendar.noMovement")}</span>
                      )}
                    </div>
                  );
                })()}
                {hoveredCoord.pt.events.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border-subtle/70">
                    {hoveredCoord.pt.events.slice(0, 3).map((ev) => (
                      <div key={ev.id} className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="font-sans text-text-secondary truncate">{ev.label}</span>
                        {ev.signedAmountRp !== 0 && (
                          <span className="font-mono tabular-nums text-text-primary shrink-0">
                            {ev.signedAmountRp > 0 ? "+" : "-"}
                            {maskRp(Math.abs(ev.signedAmountRp))}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <svg
              viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
              className="w-full h-28 overflow-visible select-none"
              role="img"
              aria-label={t.balanceCurve}
              onMouseLeave={() => setHoveredIso(null)}
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
              {hoveredCoord && (
                <>
                  <line
                    x1={hoveredCoord.x}
                    x2={hoveredCoord.x}
                    y1={4}
                    y2={chartGeometry.height - 12}
                    stroke="#10b78d"
                    strokeOpacity="0.65"
                    strokeDasharray="2 2"
                    strokeWidth="1.25"
                  />
                  <circle
                    cx={hoveredCoord.x}
                    cy={hoveredCoord.y}
                    r={5.5}
                    fill="#0c0e14"
                    stroke={hoveredCoord.pt.closingBalanceRp < 0 ? "#ff3838" : "#10b78d"}
                    strokeWidth="2.5"
                  />
                </>
              )}
              {chartGeometry.coords.map((c) => {
                const stripW = Math.max(
                  14,
                  (chartGeometry.width - 24) / Math.max(1, chartGeometry.coords.length),
                );
                return (
                  <rect
                    key={c.pt.dateIso}
                    x={c.x - stripW / 2}
                    y={0}
                    width={stripW}
                    height={chartGeometry.height}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIso(c.pt.dateIso)}
                    onClick={() => setSelectedIso(c.pt.dateIso)}
                  />
                );
              })}
            </svg>
          </div>
          <div className="flex items-center justify-between text-[11px] font-sans text-text-tertiary">
            <span className="font-mono text-[10px] tabular-nums">{fmtShortDate(radar.cycleStartIso)}</span>
            {chartGeometry.troughCoord && (
              <span>
                Lowest:{" "}
                <span className="font-mono text-[10px] tabular-nums">
                  {fmtShortDate(radar.lowestCashPoint.dateIso)} ({maskRp(radar.lowestCashPoint.balanceRp)})
                </span>
              </span>
            )}
            <span className="font-mono text-[10px] tabular-nums">{fmtShortDate(radar.cycleEndIso)}</span>
          </div>
        </div>
      )}

      {/* Dedicated Activity Filter Toolbar (Cleanly Separated Above Calendar & Inspector) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Calendar activity filter"
          className="inline-flex items-center rounded-md border border-border bg-surface p-0.5 flex-wrap gap-0.5"
        >
          {(["ALL", "INFLOW", "BILLS", "COMMITMENT", "CUTOFF", "SPENDING"] as EventFilterMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={filterMode === mode}
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1.5 text-xs font-sans font-medium rounded-sm cursor-pointer transition-colors ${
                filterMode === mode
                  ? "bg-surface-active text-text-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {t.filters[mode]}
            </button>
          ))}
        </div>

        <div className="text-xs font-sans text-text-tertiary">
          Showing{" "}
          <span className="font-mono tabular-nums text-text-primary font-medium">
            {totalFilteredEvents}
          </span>{" "}
          scheduled events
        </div>
      </div>

      {/* Main Split: Calendar Grid + Day Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 bg-surface border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-text-secondary font-sans">{t.loading}</div>
          ) : (
            <>
              <div className="grid grid-cols-7 border-b border-border bg-surface-subtle/50">
                {t.weekdays.map((wd) => (
                  <div
                    key={wd}
                    className="py-2 px-2.5 text-[11px] font-sans font-medium text-text-tertiary border-r last:border-r-0 border-border-subtle"
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
                                  : cell.dateIso === radar?.cycleStartIso
                                    ? "px-1 py-0.5 rounded-sm bg-positive/15 text-positive font-semibold"
                                    : cell.inCalendarMonth
                                      ? "text-text-primary font-medium"
                                      : inCycle
                                        ? "text-text-secondary font-medium"
                                        : "text-text-tertiary"
                              }`}
                            >
                              {cell.dayNumber}
                              {(!cell.inCalendarMonth || cell.dayNumber === 1 || cell.dateIso === radar?.cycleStartIso) && (
                                <span className="ml-1 text-[9px] opacity-80">{cell.monthLabel}</span>
                              )}
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
                                      : ev.id === "inflow-thr"
                                        ? "THR"
                                        : ev.category === "INFLOW"
                                          ? "Payday"
                                          : ev.category === "EXTRA_INCOME"
                                            ? ev.label
                                            : ev.label.split("—")[0].trim()}
                                  </span>
                                  {ev.signedAmountRp !== 0 && (
                                    <span className="shrink-0">
                                      {isAmountsMasked ? "•••••" : formatCompactRp(ev.signedAmountRp)}
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
              <div className="text-[11px] font-sans text-text-tertiary">
                {t.selectedDayInspector}
              </div>
              <div className="text-base font-semibold text-text-primary font-mono mt-0.5">
                {effectiveSelectedIso ? fmtShortDate(effectiveSelectedIso) : "-"}
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-sm text-[11px] font-sans ${
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
                <div className="text-[11px] font-sans text-text-tertiary">
                  {t.openingCash}
                </div>
                <div className="text-xs font-mono text-text-secondary tabular-nums mt-0.5">
                  {maskRp(selectedPoint.openingBalanceRp)}
                </div>
              </div>
              <div className="rounded bg-canvas border border-border-subtle p-2.5">
                <div className="text-[11px] font-sans text-text-tertiary">
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

                    {ev.insideAllocatedPool && (
                      <div className="text-[10px] font-sans text-text-tertiary pt-0.5">
                        {t.insidePoolNote}
                      </div>
                    )}

                    {Array.isArray(ev.subItems) && ev.subItems.length > 0 && (
                      <div className="pt-2 mt-1.5 border-t border-border-subtle space-y-1">
                        {ev.subItems.map((sub, sIdx) => (
                          <div key={sIdx} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-text-secondary truncate">
                              {sub.title}
                              {sub.sliceLabel && sub.sliceLabel !== "1/1" ? (
                                <span className="ml-1 text-[10px] font-mono text-text-tertiary">
                                  ({sub.sliceLabel})
                                </span>
                              ) : null}
                            </span>
                            <span className="font-mono text-text-primary tabular-nums shrink-0">
                              {maskRp(sub.amountRp)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                        {ev.category === "COMMITMENT" && ev.id.startsWith("commitment-") && (
                          <div className="flex items-center gap-1.5 pt-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!requireUnmasked("Mark Paid")) return;
                                const cid = Number(ev.id.replace("commitment-", ""));
                                if (!Number.isFinite(cid)) return;
                                const res = await updateCommitmentStatus(cid, "PAID");
                                if (res.success) {
                                  refreshPeriod();
                                  toast({ title: ev.label, description: "Marked as paid", variant: "success" });
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-delta-positive/40 text-[10px] font-sans text-delta-positive hover:bg-delta-positive/10 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Mark Paid</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!requireUnmasked("Reserve")) return;
                                const cid = Number(ev.id.replace("commitment-", ""));
                                if (!Number.isFinite(cid)) return;
                                const res = await updateCommitmentStatus(cid, "RESERVED");
                                if (res.success) {
                                  refreshPeriod();
                                  toast({ title: ev.label, description: "Marked as reserved", variant: "success" });
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-caution/30 text-[10px] font-sans text-caution hover:bg-caution/10 cursor-pointer"
                            >
                              <Clock className="w-3 h-3" />
                              <span>Reserve</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Interactive Add Commitment for Selected Day */}
              <div className="pt-2 border-t border-border-subtle space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!requireUnmasked("One-Off Commitment")) return;
                    setShowQuickCommit((prev) => !prev);
                  }}
                  className="w-full erp-btn-secondary inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-sans font-medium cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Commitment on {effectiveSelectedIso ? fmtShortDate(effectiveSelectedIso) : "Day"}</span>
                </button>
                {showQuickCommit && effectiveSelectedIso && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!requireUnmasked("One-Off Commitment")) return;
                      const amount = parseCurrencyInput(qcAmount);
                      if (!qcTitle.trim() || amount <= 0) return;
                      setQcSaving(true);
                      try {
                        const res = await createCommitment({
                          month,
                          year,
                          title: qcTitle.trim(),
                          category: qcCategory,
                          amount,
                          dueDate: effectiveSelectedIso,
                          fundingSource: qcSource,
                        });
                        if (!res.success) {
                          toast({ title: "One-Off Commitment", description: res.error, variant: "error" });
                          return;
                        }
                        setQcTitle("");
                        setShowQuickCommit(false);
                        refreshPeriod();
                      } finally {
                        setQcSaving(false);
                      }
                    }}
                    className="rounded border border-border-subtle bg-canvas p-3 space-y-2.5"
                  >
                    <input
                      type="text"
                      value={qcTitle}
                      onChange={(e) => setQcTitle(e.target.value)}
                      placeholder="e.g. Outing bus penalty"
                      required
                      className="w-full px-2.5 py-1.5 rounded border border-border bg-surface text-xs font-sans text-text-primary"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={qcAmount}
                      onChange={(e) => setQcAmount(formatCurrencyInput(e.target.value))}
                      required
                      className="w-full px-2.5 py-1.5 rounded border border-border bg-surface text-xs font-mono tabular-nums text-text-primary"
                    />
                    <div className="flex flex-wrap gap-1">
                      {(studioConfig?.commitmentCategoriesTable?.filter((c) => c.active !== false) ?? [
                        { code: "EVENT_OUTING", label: "Outing" },
                        { code: "PENALTY_FEE", label: "Penalty" },
                        { code: "FORCE_MAJEURE", label: "Unexpected" },
                        { code: "OTHER", label: "Other" },
                      ]).slice(0, 5).map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setQcCategory(c.code)}
                          className={`px-2 py-0.5 rounded text-[10px] font-sans border cursor-pointer ${
                            qcCategory === c.code
                              ? "border-accent bg-accent/15 text-text-primary"
                              : "border-border-subtle bg-surface text-text-tertiary"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(["PAYCHECK_UPFRONT", "DISCRETIONARY"] as CommitmentFundingSource[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setQcSource(s)}
                          className={`px-2 py-0.5 rounded text-[10px] font-sans border cursor-pointer ${
                            qcSource === s
                              ? "border-accent bg-accent/15 text-text-primary"
                              : "border-border-subtle bg-surface text-text-tertiary"
                          }`}
                        >
                          {s === "PAYCHECK_UPFRONT" ? "Paycheck Upfront" : "Discretionary"}
                        </button>
                      ))}
                    </div>
                    <button
                      type="submit"
                      disabled={qcSaving}
                      className="w-full erp-btn-primary py-1.5 rounded text-xs font-sans font-medium cursor-pointer disabled:opacity-50"
                    >
                      Save Commitment
                    </button>
                  </form>
                )}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
