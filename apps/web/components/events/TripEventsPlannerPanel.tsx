"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  X,
  Trash2,
  Compass,
  CheckCircle2,
  Users,
  ArrowRight,
  AlertCircle,
  CalendarClock,
} from "lucide-react";
import {
  EventCategoryConfigRow,
  TripEventPlanDto,
  TripEventType,
  TripExpenseItemDto,
  TripOptimizeResult,
  TripTierAllocation,
  TripTierCode,
  closeSweepTripEvent,
  createTripEvent,
  createTripExpense,
  deleteTripEvent,
  deleteTripExpense,
  fetchTripEvents,
  optimizeTripEvent,
  updateTripExpense,
} from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { usePeriod } from "@/context/PeriodContext";
import { usePerspective } from "@/context/PerspectiveContext";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { usePrivacyGuard } from "@/hooks/usePrivacyGuard";
import { useConfirmDialog } from "@/context/ConfirmDialogContext";
import { useToast } from "@/context/ToastContext";
import { ErpDatePicker } from "@/components/primitives/ErpDatePicker";
import {
  formatCurrencyInput,
  formatRupiah,
  getJakartaDateParts,
  parseCurrencyInput,
} from "@/lib/utils";
import {
  formatEventExpenseCategoryLabel,
  formatEventTierLabel,
  formatHumanStatus,
  titleCaseCode,
} from "@/lib/format-labels";

const DEFAULT_EVENT_CATEGORIES: EventCategoryConfigRow[] = [
  {
    id: "evt_day_outing",
    code: "DAY_OUTING",
    label: "Day Outing",
    foodPct: 45,
    transportPct: 20,
    activitiesPct: 20,
    contingencyPct: 15,
    weekendWeightPct: 120,
    active: true,
  },
  {
    id: "evt_weekend_trip",
    code: "WEEKEND_TRIP",
    label: "Weekend Trip",
    foodPct: 38,
    transportPct: 22,
    activitiesPct: 28,
    contingencyPct: 12,
    weekendWeightPct: 135,
    active: true,
  },
  {
    id: "evt_vacation",
    code: "VACATION",
    label: "Vacation",
    foodPct: 34,
    transportPct: 24,
    activitiesPct: 30,
    contingencyPct: 12,
    weekendWeightPct: 135,
    active: true,
  },
  {
    id: "evt_dining",
    code: "DINING_GATHERING",
    label: "Dining & Gathering",
    foodPct: 60,
    transportPct: 15,
    activitiesPct: 15,
    contingencyPct: 10,
    weekendWeightPct: 115,
    active: true,
  },
  {
    id: "evt_concert",
    code: "CONCERT_EVENT",
    label: "Concert & Ticketed Event",
    foodPct: 25,
    transportPct: 20,
    activitiesPct: 45,
    contingencyPct: 10,
    weekendWeightPct: 120,
    active: true,
  },
  {
    id: "evt_general",
    code: "GENERAL_EVENT",
    label: "Other Occasion",
    foodPct: 40,
    transportPct: 20,
    activitiesPct: 25,
    contingencyPct: 15,
    weekendWeightPct: 115,
    active: true,
  },
];

const EXPENSE_CATEGORIES = [
  "FOOD_DRINK",
  "LOCAL_TRANSPORT",
  "ACTIVITIES",
  "CONTINGENCY",
] as const;

const COPY = {
  en: {
    title: "Event & Activity Budgets",
    subtitle:
      "Separate outings, trips, and special events from your everyday allowance while tracking shared friend advances.",
    newEvent: "Plan Event",
    cancel: "Cancel",
    createEvent: "Save Event Budget",
    fieldTitle: "Event Name",
    fieldTitlePlaceholder: "e.g. Bandung Team Outing",
    fieldType: "Activity Category",
    customTypePlaceholder: "Custom category...",
    addCustomType: "Add",
    fieldStart: "Start Date",
    fieldEnd: "End Date",
    fieldCap: "Event Budget Cap (Rp)",
    fieldPrepaid: "Prepaid Deposit / Ticket (Rp)",
    createCommitmentCheck: "Also reserve deposit from Paycheck Upfront",
    budgetOptionsTitle: "Suggested Budget Tiers",
    calculatingRec: "Calculating safe discretionary room...",
    tierRecommended: "Recommended",
    dailyAvg: "Daily avg",
    varCap: "On-trip pool",
    headroomLabel: "safe room",
    startsTodayBadge: "Starts today · Activated immediately in current cycle",
    upcomingPrefix: "Starts in",
    upcomingDaysUnit: "days",
    cycleFundingPrefix: "Funded from",
    prepSetAside: "Prep set-aside",
    shortfallNotePrefix: "Current cycle has a shortfall of",
    shortfallNoteSuffix: "Keep caps modest or defer until the next paycheck.",
    backdateError: "Start date cannot be in the past. Choose today or a future date.",
    endBeforeStartError: "End date cannot be earlier than start date.",
    empty: "No event budgets scheduled yet.",
    grossSpent: "Total Paid",
    friendReimbursed: "Reimbursed",
    pendingAdvance: "Pending Friend Share",
    netPersonal: "Your Net Share",
    remainingCap: "Remaining Cap",
    logExpense: "Log Event Expense",
    expenseLabel: "Description",
    expenseLabelPlaceholder: "e.g. Group dinner / split bill",
    expenseAmount: "Amount Paid (Rp)",
    sharedAdvanceToggle: "Paid for friend / group (expecting payback)",
    counterpartyPlaceholder: "Who owes you? (e.g. Andi)",
    markReimbursed: "Mark Paid Back",
    closeSweepBtn: "Close & Move Unused",
    sweepCoreSavings: "Move Unused to Core Savings",
    sweepDiscretionary: "Return Unused to Discretionary",
    completedBadge: "Closed & Swept",
    deleteEventTitle: "Delete Event Budget",
    deleteEventDesc: "Delete this event budget and its logged expenses?",
    deleteConfirm: "Delete",
    splitPrefix: "Split",
  },
  id: {
    title: "Anggaran Acara & Kegiatan",
    subtitle:
      "Pisahkan pengeluaran liburan, outing, atau acara khusus dari jatah makan harian sekaligus mencatat talangan teman.",
    newEvent: "Buat Anggaran Acara",
    cancel: "Batal",
    createEvent: "Simpan Anggaran Acara",
    fieldTitle: "Nama Acara / Kegiatan",
    fieldTitlePlaceholder: "contoh: Outing Tim Bandung",
    fieldType: "Kategori Acara",
    customTypePlaceholder: "Kategori baru...",
    addCustomType: "Tambah",
    fieldStart: "Tanggal Mulai",
    fieldEnd: "Tanggal Selesai",
    fieldCap: "Batas Anggaran Acara (Rp)",
    fieldPrepaid: "DP / Tiket Dibayar Awal (Rp)",
    createCommitmentCheck: "Sisihkan juga DP ini di Komitmen Awal Gajian",
    budgetOptionsTitle: "Opsi Batas Anggaran Aman",
    calculatingRec: "Menghitung ruang anggaran aman...",
    tierRecommended: "Direkomendasikan",
    dailyAvg: "Rata-rata/hari",
    varCap: "Dana saat acara",
    headroomLabel: "ruang aman",
    startsTodayBadge: "Mulai hari ini · Langsung aktif di siklus berjalan",
    upcomingPrefix: "Mulai dalam",
    upcomingDaysUnit: "hari",
    cycleFundingPrefix: "Menggunakan dana siklus",
    prepSetAside: "Sisihkan persiapan",
    shortfallNotePrefix: "Siklus ini sedang defisit",
    shortfallNoteSuffix: "Pilih batas hemat atau jadwalkan setelah gajian berikutnya.",
    backdateError: "Tanggal mulai tidak boleh lewat dari hari ini.",
    endBeforeStartError: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.",
    empty: "Belum ada rencana anggaran acara.",
    grossSpent: "Total Dibayar",
    friendReimbursed: "Sudah Diganti",
    pendingAdvance: "Talangan Belum Diganti",
    netPersonal: "Beban Pribadi Bersih",
    remainingCap: "Sisa Batas Anggaran",
    logExpense: "Catat Pengeluaran Acara",
    expenseLabel: "Keterangan",
    expenseLabelPlaceholder: "contoh: Makan malam rombongan",
    expenseAmount: "Nominal Dibayar (Rp)",
    sharedAdvanceToggle: "Talangan grup / bayari teman dulu",
    counterpartyPlaceholder: "Nama teman (mis. Andi)",
    markReimbursed: "Tandai Lunas",
    closeSweepBtn: "Tutup & Pindahkan Sisa",
    sweepCoreSavings: "Pindahkan Sisa ke Tabungan Inti",
    sweepDiscretionary: "Kembalikan ke Dana Bebas",
    completedBadge: "Selesai & Ditutup",
    deleteEventTitle: "Hapus Anggaran Acara",
    deleteEventDesc: "Hapus rencana acara beserta daftar pengeluarannya?",
    deleteConfirm: "Hapus",
    splitPrefix: "Pembagian",
  },
  zh: {
    title: "活动与专项预算",
    subtitle:
      "将出游、聚会及专项活动支出与日常餐费隔离记账，并追踪朋友AA代垫回款。",
    newEvent: "新建活动预算",
    cancel: "取消",
    createEvent: "保存活动预算",
    fieldTitle: "活动名称",
    fieldTitlePlaceholder: "例如：周末团队出游",
    fieldType: "活动分类",
    customTypePlaceholder: "自定义分类...",
    addCustomType: "添加",
    fieldStart: "开始日期",
    fieldEnd: "结束日期",
    fieldCap: "活动预算上限 (Rp)",
    fieldPrepaid: "已预付定金或门票 (Rp)",
    createCommitmentCheck: "同步从发薪优先预扣该定金",
    budgetOptionsTitle: "三档安全预算建议",
    calculatingRec: "正在测算本周期可用空间...",
    tierRecommended: "推荐方案",
    dailyAvg: "日均限额",
    varCap: "活动期可用",
    headroomLabel: "可用安全空间",
    startsTodayBadge: "今日开始 · 立即生效为进行中",
    upcomingPrefix: "距离开始还有",
    upcomingDaysUnit: "天",
    cycleFundingPrefix: "预算归属周期",
    prepSetAside: "每日提前留存",
    shortfallNotePrefix: "当前周期存在资金缺口",
    shortfallNoteSuffix: "建议采用稳健档或延后至下一发薪周期。",
    backdateError: "开始日期不能早于今天。",
    endBeforeStartError: "结束日期不能早于开始日期。",
    empty: "暂未创建活动预算计划。",
    grossSpent: "累计实付",
    friendReimbursed: "朋友已还",
    pendingAdvance: "待收回代垫",
    netPersonal: "个人净支出",
    remainingCap: "剩余活动预算",
    logExpense: "记录活动消费",
    expenseLabel: "消费说明",
    expenseLabelPlaceholder: "例如：团队聚餐",
    expenseAmount: "实付金额 (Rp)",
    sharedAdvanceToggle: "代朋友垫付 / AA 聚餐",
    counterpartyPlaceholder: "垫付对象（例如 Andi）",
    markReimbursed: "标为已结清",
    closeSweepBtn: "结束活动并归集结余",
    sweepCoreSavings: "结余转入核心储蓄",
    sweepDiscretionary: "结余退回弹性支配",
    completedBadge: "已结束归档",
    deleteEventTitle: "删除活动预算",
    deleteEventDesc: "确定删除该活动预算及其明细流水？",
    deleteConfirm: "删除",
    splitPrefix: "预算分配",
  },
};

function countDurationDays(startIso: string, endIso: string): number {
  const s = new Date(`${startIso.slice(0, 10)}T00:00:00Z`).getTime();
  const e = new Date(`${endIso.slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 1;
  return Math.max(1, Math.min(30, Math.round((e - s) / 86400000) + 1));
}

export function TripEventsPlannerPanel({
  month,
  year,
  isLocked = false,
}: {
  month: number;
  year: number;
  isLocked?: boolean;
}) {
  const { locale } = useLanguage();
  const { revisionTick, refreshPeriod } = usePeriod();
  const { studioConfig, updateStudioConfig } = usePerspective();
  const { isAmountsMasked } = usePrivacyMask();
  const { requireUnmasked } = usePrivacyGuard();
  const { confirmDialog } = useConfirmDialog();
  const { toast } = useToast();

  const t = COPY[locale] ?? COPY.en;
  const formatRp = (n: number) => formatRupiah(n, isAmountsMasked);
  const todayIso = getJakartaDateParts().isoDate;

  const eventCategoryList = useMemo(() => {
    const raw = studioConfig?.eventCategoriesTable;
    const activeRows =
      Array.isArray(raw) && raw.length > 0
        ? raw.filter((r) => r.active !== false)
        : DEFAULT_EVENT_CATEGORIES;
    return activeRows.length > 0 ? activeRows : DEFAULT_EVENT_CATEGORIES;
  }, [studioConfig?.eventCategoriesTable]);

  const categoryLabelByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of studioConfig?.eventCategoriesTable ?? DEFAULT_EVENT_CATEGORIES) {
      map.set(String(r.code).toUpperCase(), r.label);
    }
    return map;
  }, [studioConfig?.eventCategoriesTable]);

  const [events, setEvents] = useState<TripEventPlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<TripEventType>(
    () => eventCategoryList[0]?.code ?? "DAY_OUTING",
  );
  const [startDate, setStartDate] = useState<string>(todayIso);
  const [endDate, setEndDate] = useState<string>(todayIso);
  const [capInput, setCapInput] = useState("0");
  const [prepaidInput, setPrepaidInput] = useState("0");
  const [createPrepaidCommit, setCreatePrepaidCommit] = useState(false);
  const [selectedTier, setSelectedTier] = useState<TripTierCode>("BALANCED");
  const [optResult, setOptResult] = useState<TripOptimizeResult | null>(null);
  const [optError, setOptError] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);

  const [addingCustomType, setAddingCustomType] = useState(false);
  const [customTypeLabel, setCustomTypeLabel] = useState("");

  // Expense form state
  const [expDate, setExpDate] = useState<string>(todayIso);
  const [expLabel, setExpLabel] = useState("");
  const [expCategory, setExpCategory] = useState<string>("FOOD_DRINK");
  const [expAmountInput, setExpAmountInput] = useState("100.000");
  const [isSharedAdvance, setIsSharedAdvance] = useState(false);
  const [counterpartyName, setCounterpartyName] = useState("");
  const [savingExp, setSavingExp] = useState(false);

  const [sweepOpenForId, setSweepOpenForId] = useState<number | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchTripEvents(month, year);
      setEvents(list);
      setSelectedEventId((cur) =>
        cur && list.some((e) => e.id === cur) ? cur : list[0]?.id ?? null,
      );
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents, revisionTick]);

  // Live debounced budget tier calculator when creating an event
  useEffect(() => {
    if (!showCreate) return;
    if (startDate < todayIso) {
      setOptError(t.backdateError);
      return;
    }
    if (endDate < startDate) {
      setOptError(t.endBeforeStartError);
      return;
    }
    const durationDays = countDurationDays(startDate, endDate);
    const prepaidCommittedRp = parseCurrencyInput(prepaidInput);
    const timer = setTimeout(async () => {
      setOptimizing(true);
      setOptError(null);
      try {
        const res = await optimizeTripEvent({
          month,
          year,
          eventType,
          durationDays,
          startDateIso: startDate,
          prepaidCommittedRp,
        });
        if (res.success && res.data) {
          setOptResult(res.data);
          setSelectedTier(res.data.recommendedTier);
          const recTier =
            res.data.recommendedTier === "CONSERVATIVE"
              ? res.data.conservative
              : res.data.recommendedTier === "MAX_SAFE"
                ? res.data.maxSafe
                : res.data.balanced;
          setCapInput(formatCurrencyInput(String(recTier.totalCapRp)));
        } else {
          setOptResult(null);
          setOptError(res.error || "Unable to compute budget recommendation.");
        }
      } finally {
        setOptimizing(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [showCreate, month, year, eventType, startDate, endDate, prepaidInput, todayIso, t.backdateError, t.endBeforeStartError]);

  const activeEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? events[0] ?? null,
    [events, selectedEventId],
  );

  useEffect(() => {
    if (activeEvent) {
      const sIso = String(activeEvent.startDate).slice(0, 10);
      setExpDate(sIso >= todayIso ? sIso : todayIso);
    }
  }, [activeEvent?.id]);

  const handleApplyTier = (tier: TripTierAllocation) => {
    setSelectedTier(tier.tierCode);
    setCapInput(formatCurrencyInput(String(tier.totalCapRp)));
  };

  const handleSaveCustomCategory = async () => {
    const clean = customTypeLabel.trim();
    if (!clean) return;
    const code =
      clean
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 32) || `EVENT_${Date.now()}`;
    const current = studioConfig?.eventCategoriesTable?.length
      ? studioConfig.eventCategoriesTable
      : DEFAULT_EVENT_CATEGORIES;
    if (!current.some((r) => r.code === code)) {
      const next: EventCategoryConfigRow[] = [
        ...current,
        {
          id: `evt_${Date.now()}`,
          code,
          label: clean,
          foodPct: 40,
          transportPct: 20,
          activitiesPct: 25,
          contingencyPct: 15,
          weekendWeightPct: 120,
          active: true,
        },
      ];
      await updateStudioConfig({ eventCategoriesTable: next });
    }
    setEventType(code);
    setCustomTypeLabel("");
    setAddingCustomType(false);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireUnmasked(t.title)) return;
    if (startDate < todayIso) {
      toast({ title: t.title, description: t.backdateError, variant: "error" });
      return;
    }
    if (endDate < startDate) {
      toast({ title: t.title, description: t.endBeforeStartError, variant: "error" });
      return;
    }
    const plannedCapRp = parseCurrencyInput(capInput);
    const prepaidAmountRp = parseCurrencyInput(prepaidInput);
    if (!title.trim() || plannedCapRp <= 0) return;

    setSavingEvent(true);
    try {
      const res = await createTripEvent({
        month,
        year,
        title: title.trim(),
        eventType,
        startDate,
        endDate,
        plannedCapRp,
        recommendedTier: selectedTier,
        fundingSource: "DISCRETIONARY",
        prepaidAmountRp,
        createPrepaidCommitment: createPrepaidCommit && prepaidAmountRp > 0,
      });
      if (!res.success || !res.data) {
        toast({ title: t.title, description: res.error, variant: "error" });
        return;
      }
      setShowCreate(false);
      setTitle("");
      setPrepaidInput("0");
      setCreatePrepaidCommit(false);
      setSelectedEventId(res.data.id);
      setExpDate(startDate);
      refreshPeriod();
      await loadEvents();
    } finally {
      setSavingEvent(false);
    }
  };

  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent) return;
    if (!requireUnmasked(t.logExpense)) return;
    const amountRp = parseCurrencyInput(expAmountInput);
    if (!expLabel.trim() || amountRp <= 0) return;

    setSavingExp(true);
    try {
      const res = await createTripExpense(activeEvent.id, {
        date: expDate,
        label: expLabel.trim(),
        category: expCategory,
        amountRp,
        isSharedAdvance,
        counterpartyName: isSharedAdvance ? counterpartyName.trim() || undefined : undefined,
      });
      if (!res.success) {
        toast({ title: t.logExpense, description: res.error, variant: "error" });
        return;
      }
      setExpLabel("");
      setExpAmountInput("100.000");
      setIsSharedAdvance(false);
      setCounterpartyName("");
      refreshPeriod();
      await loadEvents();
    } finally {
      setSavingExp(false);
    }
  };

  const handleMarkAdvanceSettled = async (exp: TripExpenseItemDto) => {
    if (!activeEvent) return;
    if (!requireUnmasked(t.markReimbursed)) return;
    const res = await updateTripExpense(activeEvent.id, exp.id, {
      reimbursedAmountRp: exp.amountRp,
      isSettled: true,
    });
    if (!res.success) {
      toast({ title: t.title, description: res.error, variant: "error" });
      return;
    }
    refreshPeriod();
    await loadEvents();
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (!activeEvent) return;
    if (!requireUnmasked(t.title)) return;
    const res = await deleteTripExpense(activeEvent.id, expenseId);
    if (!res.success) {
      toast({ title: t.title, description: res.error, variant: "error" });
      return;
    }
    refreshPeriod();
    await loadEvents();
  };

  const handleSweep = async (destination: "CORE_SAVINGS" | "DISCRETIONARY") => {
    if (!activeEvent) return;
    if (!requireUnmasked(t.closeSweepBtn)) return;
    const res = await closeSweepTripEvent(activeEvent.id, destination);
    if (!res.success) {
      toast({ title: t.closeSweepBtn, description: res.error, variant: "error" });
      return;
    }
    setSweepOpenForId(null);
    refreshPeriod();
    await loadEvents();
  };

  const handleDeleteEvent = async (id: number) => {
    if (!requireUnmasked(t.deleteEventTitle)) return;
    const ok = await confirmDialog({
      title: t.deleteEventTitle,
      description: t.deleteEventDesc,
      confirmLabel: t.deleteConfirm,
      variant: "danger",
    });
    if (!ok) return;
    const res = await deleteTripEvent(id);
    if (!res.success) {
      toast({ title: t.title, description: res.error, variant: "error" });
      return;
    }
    refreshPeriod();
    await loadEvents();
  };

  const formatEventTypeHuman = (code: string) => {
    const hit = categoryLabelByCode.get(String(code || "").toUpperCase());
    return hit || titleCaseCode(code);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold font-sans text-text-primary">
            {t.title}
          </h2>
          <p className="text-xs font-sans text-text-secondary mt-1 max-w-3xl">
            {t.subtitle}
          </p>
        </div>
        {!isLocked && (
          <button
            type="button"
            onClick={() => {
              if (!requireUnmasked(t.newEvent)) return;
              setShowCreate((prev) => !prev);
            }}
            className="erp-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-sans font-medium cursor-pointer"
          >
            {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{showCreate ? t.cancel : t.newEvent}</span>
          </button>
        )}
      </div>

      {showCreate && !isLocked && (
        <form
          onSubmit={handleCreateEvent}
          className="rounded-lg border border-border bg-surface p-5 space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-sans text-text-secondary mb-1">
                {t.fieldTitle}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.fieldTitlePlaceholder}
                required
                className="w-full px-3 py-2 rounded border border-border bg-canvas text-xs font-sans text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[11px] font-sans text-text-secondary mb-1">
                {t.fieldStart}
              </label>
              <ErpDatePicker
                value={startDate}
                min={todayIso}
                onChange={(iso) => {
                  setStartDate(iso);
                  if (endDate < iso) setEndDate(iso);
                }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-sans text-text-secondary mb-1">
                {t.fieldEnd}
              </label>
              <ErpDatePicker value={endDate} min={startDate} onChange={setEndDate} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-sans text-text-secondary mr-1">
              {t.fieldType}:
            </span>
            {eventCategoryList.map((cat) => (
              <button
                key={cat.code}
                type="button"
                onClick={() => setEventType(cat.code)}
                className={`px-2.5 py-1 rounded text-[11px] font-sans border cursor-pointer transition-colors ${
                  eventType === cat.code
                    ? "border-accent bg-accent/15 text-text-primary font-medium"
                    : "border-border-subtle bg-canvas text-text-tertiary hover:text-text-primary"
                }`}
              >
                {cat.label}
              </button>
            ))}
            {addingCustomType ? (
              <div className="inline-flex items-center gap-1.5">
                <input
                  type="text"
                  value={customTypeLabel}
                  onChange={(e) => setCustomTypeLabel(e.target.value)}
                  placeholder={t.customTypePlaceholder}
                  className="px-2 py-1 rounded border border-border bg-canvas text-[11px] font-sans text-text-primary w-36"
                />
                <button
                  type="button"
                  onClick={handleSaveCustomCategory}
                  className="px-2 py-1 rounded erp-btn-secondary text-[11px] font-sans cursor-pointer"
                >
                  {t.addCustomType}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingCustomType(true)}
                className="px-2 py-1 rounded text-[11px] font-sans border border-dashed border-border text-text-tertiary hover:text-text-primary cursor-pointer"
              >
                + {t.addCustomType}
              </button>
            )}
          </div>

          <div className="rounded-lg border border-border-subtle bg-canvas p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold font-sans text-text-primary">
                <Compass className="w-3.5 h-3.5 text-accent" />
                <span>{t.budgetOptionsTitle}</span>
              </div>
              {optResult && (
                <span className="text-[11px] font-mono tabular-nums text-text-tertiary">
                  {optResult.durationDays}d · {formatRp(optResult.availableHeadroomRp)}{" "}
                  {t.headroomLabel}
                </span>
              )}
            </div>

            {optResult && !optError && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-sans text-text-secondary bg-surface/60 border border-border-subtle rounded px-3 py-2">
                <CalendarClock className="w-3.5 h-3.5 text-accent shrink-0" />
                {optResult.timingMode === "TODAY" ? (
                  <span>
                    {t.startsTodayBadge}
                    {optResult.targetPeriodLabel
                      ? ` (${optResult.targetPeriodLabel})`
                      : ""}
                    .
                  </span>
                ) : (
                  <span>
                    {t.upcomingPrefix} {optResult.daysUntilEvent ?? 0} {t.upcomingDaysUnit} ·{" "}
                    {t.cycleFundingPrefix} {optResult.targetPeriodLabel ?? `${month}/${year}`}
                    {(optResult.prepDailySetAsideRp ?? 0) > 0
                      ? ` · ${t.prepSetAside}: ${formatRp(optResult.prepDailySetAsideRp ?? 0)}/day`
                      : ""}
                  </span>
                )}
              </div>
            )}

            {optResult && (optResult.cycleShortfallRp ?? 0) > 0 && !optError && (
              <div className="flex items-center gap-2 text-[11px] font-sans text-caution bg-caution/10 border border-caution/30 rounded px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {t.shortfallNotePrefix} {formatRp(optResult.cycleShortfallRp ?? 0)}.{" "}
                  {t.shortfallNoteSuffix}
                </span>
              </div>
            )}

            {optError ? (
              <div className="flex items-center gap-2 text-xs font-sans text-urgency bg-urgency/10 border border-urgency/30 rounded px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{optError}</span>
              </div>
            ) : optimizing && !optResult ? (
              <div className="text-xs font-sans text-text-tertiary py-3">
                {t.calculatingRec}
              </div>
            ) : optResult ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[optResult.conservative, optResult.balanced, optResult.maxSafe].map((tier) => {
                  const isSel = selectedTier === tier.tierCode;
                  const isRec = optResult.recommendedTier === tier.tierCode;
                  return (
                    <button
                      key={tier.tierCode}
                      type="button"
                      onClick={() => handleApplyTier(tier)}
                      className={`text-left rounded-lg border p-3.5 space-y-2 transition-colors cursor-pointer ${
                        isSel
                          ? "border-accent bg-accent/10"
                          : "border-border-subtle bg-surface hover:border-border-strong"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold font-sans text-text-primary">
                          {formatEventTierLabel(tier.tierCode, locale)}
                        </span>
                        {isRec && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-delta-positive/15 text-delta-positive">
                            {t.tierRecommended}
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-mono font-semibold tabular-nums text-text-primary">
                        {formatRp(tier.totalCapRp)}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-text-tertiary">
                        {t.dailyAvg}: {formatRp(tier.dailyAverageCapRp)} · {t.varCap}:{" "}
                        {formatRp(tier.variableSpendCapRp)}
                      </div>
                      {Array.isArray(tier.categorySplit) && tier.categorySplit.length > 0 && (
                        <div className="text-[11px] font-sans text-text-secondary leading-relaxed">
                          {t.splitPrefix}:{" "}
                          {tier.categorySplit
                            .slice(0, 3)
                            .map((s) => `${s.label} ${formatRp(s.amountRp)}`)
                            .join(" · ")}
                        </div>
                      )}
                      <div className="text-[10px] font-sans text-text-tertiary leading-snug">
                        {tier.guidance}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-sans text-text-secondary mb-1">
                {t.fieldCap}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={capInput}
                onChange={(e) => setCapInput(formatCurrencyInput(e.target.value))}
                required
                className="w-full px-3 py-2 rounded border border-border bg-canvas text-xs font-mono tabular-nums text-text-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-sans text-text-secondary mb-1">
                {t.fieldPrepaid}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={prepaidInput}
                onChange={(e) => setPrepaidInput(formatCurrencyInput(e.target.value))}
                className="w-full px-3 py-2 rounded border border-border bg-canvas text-xs font-mono tabular-nums text-text-primary"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-sans text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={createPrepaidCommit}
                onChange={(e) => setCreatePrepaidCommit(e.target.checked)}
                className="rounded border-border"
              />
              <span>{t.createCommitmentCheck}</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="erp-btn-secondary px-3 py-1.5 rounded text-xs font-sans cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={savingEvent || Boolean(optError)}
                className="erp-btn-primary px-4 py-1.5 rounded text-xs font-sans font-medium cursor-pointer disabled:opacity-50"
              >
                {t.createEvent}
              </button>
            </div>
          </div>
        </form>
      )}

      {loading && events.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-xs font-sans text-text-tertiary">
          ...
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-xs font-sans text-text-tertiary">
          {t.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-4 space-y-2.5">
            {events.map((ev) => {
              const selected = activeEvent?.id === ev.id;
              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  className={`rounded-lg border p-4 space-y-2 cursor-pointer transition-colors ${
                    selected
                      ? "border-accent bg-surface"
                      : "border-border-subtle bg-surface/60 hover:border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold font-sans text-text-primary">
                        {ev.title}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-text-tertiary mt-0.5">
                        {String(ev.startDate).slice(0, 10)} -&gt; {String(ev.endDate).slice(0, 10)}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-sans ${
                        ev.status === "COMPLETED"
                          ? "bg-delta-positive/15 text-delta-positive"
                          : "bg-surface-subtle text-text-secondary border border-border-subtle"
                      }`}
                    >
                      {ev.status === "COMPLETED"
                        ? t.completedBadge
                        : formatEventTypeHuman(ev.eventType)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-text-secondary">{formatRp(ev.metrics.netPersonalSpentRp)}</span>
                    <span className="text-text-primary font-semibold">/ {formatRp(ev.plannedCapRp)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {activeEvent && (
            <div className="lg:col-span-8 rounded-lg border border-border bg-surface p-5 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-4">
                <div>
                  <h3 className="text-base font-semibold font-sans text-text-primary">
                    {activeEvent.title}
                  </h3>
                  <div className="text-xs font-sans text-text-tertiary mt-0.5">
                    {formatEventTierLabel(activeEvent.recommendedTier, locale)} ·{" "}
                    {formatHumanStatus(activeEvent.status, locale)} ·{" "}
                    <span className="font-mono tabular-nums">
                      {String(activeEvent.startDate).slice(0, 10)} to{" "}
                      {String(activeEvent.endDate).slice(0, 10)}
                    </span>{" "}
                    · Cycle {String(activeEvent.month).padStart(2, "0")}/{activeEvent.year}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeEvent.status !== "COMPLETED" && !isLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!requireUnmasked(t.closeSweepBtn)) return;
                        setSweepOpenForId((cur) =>
                          cur === activeEvent.id ? null : activeEvent.id,
                        );
                      }}
                      className="erp-btn-secondary px-3 py-1.5 rounded text-xs font-sans font-medium cursor-pointer"
                    >
                      {t.closeSweepBtn}
                    </button>
                  )}
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(activeEvent.id)}
                      className="p-1.5 rounded border border-border-subtle text-text-tertiary hover:text-urgency cursor-pointer"
                      aria-label={`Delete ${activeEvent.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {sweepOpenForId === activeEvent.id && activeEvent.status !== "COMPLETED" && (
                <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-sans text-text-primary">
                    Unused balance:{" "}
                    <span className="font-mono font-semibold tabular-nums">
                      {formatRp(Math.max(0, activeEvent.metrics.remainingCapRp))}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSweep("CORE_SAVINGS")}
                      className="erp-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-sans font-medium cursor-pointer"
                    >
                      <span>{t.sweepCoreSavings}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSweep("DISCRETIONARY")}
                      className="erp-btn-secondary px-3 py-1.5 rounded text-xs font-sans cursor-pointer"
                    >
                      {t.sweepDiscretionary}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded border border-border-subtle bg-canvas p-3">
                  <div className="text-[11px] font-sans text-text-tertiary">{t.grossSpent}</div>
                  <div className="text-sm font-mono font-semibold tabular-nums text-text-primary mt-0.5">
                    {formatRp(activeEvent.metrics.totalGrossSpentRp)}
                  </div>
                </div>
                <div className="rounded border border-border-subtle bg-canvas p-3">
                  <div className="text-[11px] font-sans text-text-tertiary">{t.pendingAdvance}</div>
                  <div className="text-sm font-mono font-semibold tabular-nums text-caution mt-0.5">
                    {formatRp(activeEvent.metrics.pendingAdvanceRp)}
                  </div>
                </div>
                <div className="rounded border border-border-subtle bg-canvas p-3">
                  <div className="text-[11px] font-sans text-text-tertiary">{t.netPersonal}</div>
                  <div className="text-sm font-mono font-semibold tabular-nums text-text-primary mt-0.5">
                    {formatRp(activeEvent.metrics.netPersonalSpentRp)}
                  </div>
                </div>
                <div className="rounded border border-border-subtle bg-canvas p-3">
                  <div className="text-[11px] font-sans text-text-tertiary">{t.remainingCap}</div>
                  <div
                    className={`text-sm font-mono font-semibold tabular-nums mt-0.5 ${
                      activeEvent.metrics.remainingCapRp < 0
                        ? "text-urgency"
                        : "text-delta-positive"
                    }`}
                  >
                    {formatRp(activeEvent.metrics.remainingCapRp)}
                  </div>
                </div>
              </div>

              {activeEvent.status !== "COMPLETED" && !isLocked && (
                <form
                  onSubmit={handleLogExpense}
                  className="rounded-lg border border-border-subtle bg-canvas p-4 space-y-3"
                >
                  <div className="text-xs font-semibold font-sans text-text-primary">
                    {t.logExpense}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <input
                        type="text"
                        value={expLabel}
                        onChange={(e) => setExpLabel(e.target.value)}
                        placeholder={t.expenseLabelPlaceholder}
                        required
                        className="w-full px-3 py-1.5 rounded border border-border bg-surface text-xs font-sans text-text-primary"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={expAmountInput}
                        onChange={(e) => setExpAmountInput(formatCurrencyInput(e.target.value))}
                        required
                        className="w-full px-3 py-1.5 rounded border border-border bg-surface text-xs font-mono tabular-nums text-text-primary"
                      />
                    </div>
                    <div>
                      <ErpDatePicker
                        value={expDate}
                        min={String(activeEvent.startDate).slice(0, 10)}
                        max={String(activeEvent.endDate).slice(0, 10)}
                        onChange={setExpDate}
                        compact
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setExpCategory(cat)}
                          className={`px-2 py-0.5 rounded text-[11px] font-sans border cursor-pointer ${
                            expCategory === cat
                              ? "border-accent bg-accent/15 text-text-primary"
                              : "border-border-subtle bg-surface text-text-tertiary"
                          }`}
                        >
                          {formatEventExpenseCategoryLabel(cat, locale)}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 text-xs font-sans text-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSharedAdvance}
                          onChange={(e) => setIsSharedAdvance(e.target.checked)}
                        />
                        <Users className="w-3.5 h-3.5 text-caution" />
                        <span>{t.sharedAdvanceToggle}</span>
                      </label>
                      {isSharedAdvance && (
                        <input
                          type="text"
                          value={counterpartyName}
                          onChange={(e) => setCounterpartyName(e.target.value)}
                          placeholder={t.counterpartyPlaceholder}
                          className="px-2.5 py-1 rounded border border-border bg-surface text-xs font-sans text-text-primary"
                        />
                      )}
                      <button
                        type="submit"
                        disabled={savingExp}
                        className="erp-btn-primary px-3.5 py-1.5 rounded text-xs font-sans font-medium cursor-pointer disabled:opacity-50"
                      >
                        {t.logExpense}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="divide-y divide-border-subtle border border-border-subtle rounded-lg">
                {activeEvent.expenses.length === 0 ? (
                  <div className="py-5 text-center text-xs font-sans text-text-tertiary">
                    No event expenses recorded yet.
                  </div>
                ) : (
                  activeEvent.expenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-sans font-medium text-text-primary">
                            {exp.label}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-surface-subtle text-text-tertiary">
                            {formatEventExpenseCategoryLabel(exp.category, locale)}
                          </span>
                          {exp.isSharedAdvance && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-caution/15 text-caution">
                              {exp.counterpartyName || "Friend"} advance
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-text-tertiary">
                          {String(exp.date).slice(0, 10)}
                          {exp.reimbursedAmountRp > 0
                            ? ` · ${t.friendReimbursed}: ${formatRp(exp.reimbursedAmountRp)}`
                            : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold tabular-nums text-text-primary">
                          {formatRp(exp.amountRp)}
                        </span>
                        {exp.isSharedAdvance && !exp.isSettled && !isLocked && (
                          <button
                            type="button"
                            onClick={() => handleMarkAdvanceSettled(exp)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-delta-positive/40 text-[11px] font-sans text-delta-positive hover:bg-delta-positive/10 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{t.markReimbursed}</span>
                          </button>
                        )}
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1 text-text-tertiary hover:text-urgency cursor-pointer"
                            aria-label={`Delete ${exp.label}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
