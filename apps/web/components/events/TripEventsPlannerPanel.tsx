"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Compass, CheckCircle2, Users, ArrowRight } from "lucide-react";
import {
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
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { usePrivacyGuard } from "@/hooks/usePrivacyGuard";
import { useConfirmDialog } from "@/context/ConfirmDialogContext";
import { useToast } from "@/context/ToastContext";
import { ErpDatePicker } from "@/components/primitives/ErpDatePicker";
import { formatCurrencyInput, formatRupiah, parseCurrencyInput } from "@/lib/utils";

const EVENT_TYPES: TripEventType[] = [
  "OUTING",
  "VACATION",
  "WEEKEND",
  "DINNER",
  "CONCERT",
  "OTHER",
];

const EXPENSE_CATEGORIES = ["TRANSPORT", "FOOD", "STAY", "ACTIVITIES", "OTHER"] as const;

const COPY = {
  en: {
    title: "Trip & Event Budget Planner",
    subtitle:
      "Ring-fenced outing, travel, or event budget powered by the Go 3-tier cap optimizer. Isolates trip spend and shared friend advances so your daily living rate stays accurate.",
    newEvent: "Plan New Event",
    cancel: "Cancel",
    createEvent: "Save Event Plan",
    fieldTitle: "Event Name",
    fieldTitlePlaceholder: "e.g. Bandung Team Outing",
    fieldType: "Event Type",
    fieldStart: "Start Date",
    fieldEnd: "End Date",
    fieldCap: "Event Budget Cap (Rp)",
    fieldPrepaid: "Prepaid Deposit / Fee (Rp)",
    createCommitmentCheck: "Also create Paycheck Upfront commitment for this deposit",
    goRecommendation: "Go Engine Budget Recommendation",
    calculatingGo: "Calculating safe discretionary headroom...",
    tierRecommended: "Recommended",
    dailyCap: "Daily cap",
    freshNeeded: "Fresh cash needed",
    empty: "No trip or event budgets planned for this period.",
    grossSpent: "Gross Spent",
    friendReimbursed: "Friend Reimbursed",
    pendingAdvance: "Friend Advance Pending",
    netPersonal: "Net Personal Spend",
    remainingCap: "Remaining Event Cap",
    logExpense: "Log Event Expense",
    expenseLabel: "Description",
    expenseLabelPlaceholder: "e.g. Group dinner / split bill",
    expenseAmount: "Amount Paid (Rp)",
    sharedAdvanceToggle: "Paid for group / friend advance (expecting reimbursement)",
    counterpartyPlaceholder: "Who owes you? (e.g. Andi)",
    reimbursedRp: "Reimbursed (Rp)",
    markReimbursed: "Mark Settled",
    closeSweepBtn: "Close & Sweep Unused",
    sweepCoreSavings: "Sweep Unused to Core Savings",
    sweepDiscretionary: "Keep Unused in Discretionary",
    completedBadge: "Closed & Swept",
    deleteEventTitle: "Delete Event Plan",
    deleteEventDesc: "Delete this event plan and its expense ledger?",
    deleteConfirm: "Delete",
    categorySplitLabel: "Suggested Split",
  },
  id: {
    title: "Perencana Anggaran Acara & Liburan",
    subtitle:
      "Pos anggaran khusus untuk outing atau liburan dengan kalkulator 3 opsi dari Go Engine. Memisahkan talangan teman agar anggaran makan harian Anda tetap akurat.",
    newEvent: "Buat Rencana Acara",
    cancel: "Batal",
    createEvent: "Simpan Rencana Acara",
    fieldTitle: "Nama Acara / Liburan",
    fieldTitlePlaceholder: "contoh: Outing Kantor 5 Des",
    fieldType: "Jenis Acara",
    fieldStart: "Tanggal Mulai",
    fieldEnd: "Tanggal Selesai",
    fieldCap: "Batas Anggaran Acara (Rp)",
    fieldPrepaid: "DP / Biaya Awal Dibayar Dulu (Rp)",
    createCommitmentCheck: "Buat juga catatan Komitmen Potong Gaji untuk biaya awal ini",
    goRecommendation: "Rekomendasi Anggaran Aman (Go Engine)",
    calculatingGo: "Menghitung ruang anggaran aman...",
    tierRecommended: "Direkomendasikan",
    dailyCap: "Batas harian",
    freshNeeded: "Dana baru dibutuhkan",
    empty: "Belum ada rencana liburan atau acara di periode ini.",
    grossSpent: "Total Belanja Kotor",
    friendReimbursed: "Sudah Diganti Teman",
    pendingAdvance: "Talangan Belum Lunas",
    netPersonal: "Beban Pribadi Bersih",
    remainingCap: "Sisa Anggaran Acara",
    logExpense: "Catat Pengeluaran Acara",
    expenseLabel: "Keterangan",
    expenseLabelPlaceholder: "contoh: Makan malam rombongan",
    expenseAmount: "Nominal Dibayar (Rp)",
    sharedAdvanceToggle: "Bayari teman / talangan grup (akan diganti)",
    counterpartyPlaceholder: "Nama teman (mis. Andi)",
    reimbursedRp: "Sudah Diganti (Rp)",
    markReimbursed: "Tandai Lunas",
    closeSweepBtn: "Tutup & Sapu Sisa Dana",
    sweepCoreSavings: "Kirim Sisa ke Tabungan Inti",
    sweepDiscretionary: "Kembalikan ke Alokasi Bebas",
    completedBadge: "Selesai & Ditutup",
    deleteEventTitle: "Hapus Rencana Acara",
    deleteEventDesc: "Hapus rencana acara beserta daftar pengeluarannya?",
    deleteConfirm: "Hapus",
    categorySplitLabel: "Pembagian Disarankan",
  },
  zh: {
    title: "出行与活动预算规划",
    subtitle:
      "由 Go 引擎测算三档安全预算上限，独立记账并追踪代垫回款，确保日常餐饮限额不被活动消费打乱。",
    newEvent: "新建活动预算",
    cancel: "取消",
    createEvent: "保存活动计划",
    fieldTitle: "活动名称",
    fieldTitlePlaceholder: "例如：12月团队出游",
    fieldType: "活动类型",
    fieldStart: "开始日期",
    fieldEnd: "结束日期",
    fieldCap: "活动预算上限 (Rp)",
    fieldPrepaid: "已预付定金或费用 (Rp)",
    createCommitmentCheck: "同步生成发薪优先预扣的单次承诺记录",
    goRecommendation: "Go 引擎三档预算建议",
    calculatingGo: "正在测算本周期可用空间...",
    tierRecommended: "推荐方案",
    dailyCap: "日均上限",
    freshNeeded: "还需准备现金",
    empty: "本周期暂无出行或活动预算。",
    grossSpent: "垫付总额",
    friendReimbursed: "朋友已还回款",
    pendingAdvance: "待收回代垫",
    netPersonal: "个人实际净支出",
    remainingCap: "剩余活动预算",
    logExpense: "记录活动消费",
    expenseLabel: "消费描述",
    expenseLabelPlaceholder: "例如：团队聚餐",
    expenseAmount: "支付金额 (Rp)",
    sharedAdvanceToggle: "代人垫付 / AA 聚餐待回收",
    counterpartyPlaceholder: "垫付对象（例如 Andi）",
    reimbursedRp: "已收回金额 (Rp)",
    markReimbursed: "标为已结清",
    closeSweepBtn: "结束活动并归集结余",
    sweepCoreSavings: "结余转入核心储蓄",
    sweepDiscretionary: "结余退回自由支配",
    completedBadge: "已结束归档",
    deleteEventTitle: "删除活动计划",
    deleteEventDesc: "确定删除该活动计划及其名下消费流水？",
    deleteConfirm: "删除",
    categorySplitLabel: "建议分类拆分",
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
  const { isAmountsMasked } = usePrivacyMask();
  const { requireUnmasked } = usePrivacyGuard();
  const { confirmDialog } = useConfirmDialog();
  const { toast } = useToast();

  const t = COPY[locale] ?? COPY.en;
  const formatRp = (n: number) => formatRupiah(n, isAmountsMasked);

  const [events, setEvents] = useState<TripEventPlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const padM = String(month).padStart(2, "0");
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<TripEventType>("OUTING");
  const [startDate, setStartDate] = useState(`${year}-${padM}-05`);
  const [endDate, setEndDate] = useState(`${year}-${padM}-05`);
  const [capInput, setCapInput] = useState("600.000");
  const [prepaidInput, setPrepaidInput] = useState("0");
  const [createPrepaidCommit, setCreatePrepaidCommit] = useState(false);
  const [selectedTier, setSelectedTier] = useState<TripTierCode>("BALANCED");
  const [optResult, setOptResult] = useState<TripOptimizeResult | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);

  // Expense form state
  const [expDate, setExpDate] = useState(`${year}-${padM}-05`);
  const [expLabel, setExpLabel] = useState("");
  const [expCategory, setExpCategory] = useState<string>("FOOD");
  const [expAmountInput, setExpAmountInput] = useState("100.000");
  const [isSharedAdvance, setIsSharedAdvance] = useState(false);
  const [counterpartyName, setCounterpartyName] = useState("");
  const [savingExp, setSavingExp] = useState(false);

  // Close & sweep panel
  const [sweepOpenForId, setSweepOpenForId] = useState<number | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchTripEvents(month, year);
      setEvents(list);
      setSelectedEventId((cur) =>
        cur && list.some((e) => e.id === cur) ? cur : list[0]?.id ?? null
      );
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents, revisionTick]);

  // Live debounced Go 3-tier optimizer when planning a new event
  useEffect(() => {
    if (!showCreate) return;
    const durationDays = countDurationDays(startDate, endDate);
    const prepaidCommittedRp = parseCurrencyInput(prepaidInput);
    const timer = setTimeout(async () => {
      setOptimizing(true);
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
        }
      } finally {
        setOptimizing(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [showCreate, month, year, eventType, startDate, endDate, prepaidInput]);

  const activeEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? events[0] ?? null,
    [events, selectedEventId]
  );

  const handleApplyTier = (tier: TripTierAllocation) => {
    setSelectedTier(tier.tier);
    setCapInput(formatCurrencyInput(String(tier.totalCapRp)));
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireUnmasked(t.title)) return;
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

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <Plus className="w-3.5 h-3.5" />
            <span>{showCreate ? t.cancel : t.newEvent}</span>
          </button>
        )}
      </div>

      {/* Create Event + Go 3-Tier Optimizer Drawer */}
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
            {EVENT_TYPES.map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => setEventType(tp)}
                className={`px-2.5 py-1 rounded text-[11px] font-sans border cursor-pointer ${
                  eventType === tp
                    ? "border-accent bg-accent/15 text-text-primary font-medium"
                    : "border-border-subtle bg-canvas text-text-tertiary hover:text-text-primary"
                }`}
              >
                {tp}
              </button>
            ))}
          </div>

          {/* Go 3-Tier Recommendation Panel */}
          <div className="rounded-lg border border-border-subtle bg-canvas p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold font-sans text-text-primary">
                <Compass className="w-3.5 h-3.5 text-accent" />
                <span>{t.goRecommendation}</span>
                {optResult?.engineSource && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-text-tertiary">
                    {optResult.engineSource}
                  </span>
                )}
              </div>
              {optResult && (
                <span className="text-[11px] font-mono tabular-nums text-text-tertiary">
                  {optResult.durationDays}d · {formatRp(optResult.availableHeadroomRp)} headroom
                </span>
              )}
            </div>

            {optimizing && !optResult ? (
              <div className="text-xs font-sans text-text-tertiary py-3">
                {t.calculatingGo}
              </div>
            ) : optResult ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[optResult.conservative, optResult.balanced, optResult.maxSafe].map((tier) => {
                  const isSel = selectedTier === tier.tier;
                  const isRec = optResult.recommendedTier === tier.tier;
                  return (
                    <button
                      key={tier.tier}
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
                          {tier.tier}
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
                        {t.dailyCap}: {formatRp(tier.dailyCapRp)} · {t.freshNeeded}:{" "}
                        {formatRp(tier.freshBudgetNeededRp)}
                      </div>
                      <div className="text-[11px] font-sans text-text-secondary">
                        {t.categorySplitLabel}: Transport {formatRp(tier.categorySplit.transportRp)} ·
                        Food {formatRp(tier.categorySplit.foodRp)}
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
                disabled={savingEvent}
                className="erp-btn-primary px-4 py-1.5 rounded text-xs font-sans font-medium cursor-pointer disabled:opacity-50"
              >
                {t.createEvent}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Event Selector + Active Event Workspace */}
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
          {/* Event List */}
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
                      {ev.status === "COMPLETED" ? t.completedBadge : ev.eventType}
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

          {/* Selected Event Details */}
          {activeEvent && (
            <div className="lg:col-span-8 rounded-lg border border-border bg-surface p-5 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-4">
                <div>
                  <h3 className="text-base font-semibold font-sans text-text-primary">
                    {activeEvent.title}
                  </h3>
                  <div className="text-xs font-mono tabular-nums text-text-tertiary mt-0.5">
                    {activeEvent.recommendedTier} · {String(activeEvent.startDate).slice(0, 10)} to{" "}
                    {String(activeEvent.endDate).slice(0, 10)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeEvent.status !== "COMPLETED" && !isLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!requireUnmasked(t.closeSweepBtn)) return;
                        setSweepOpenForId((cur) =>
                          cur === activeEvent.id ? null : activeEvent.id
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

              {/* Metrics Grid */}
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

              {/* Log Event Expense */}
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
                      <ErpDatePicker value={expDate} onChange={setExpDate} compact />
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
                          {cat}
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

              {/* Expenses Table */}
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
                            {exp.category}
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
