"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, ExternalLink, Plus, RotateCcw, Search, ShieldAlert, X } from "lucide-react";
import {
  CreditCardSummary,
  CreditCardTransaction,
  IntelligenceBundleResponse,
  KillSwitchResponse,
  MonthlySnapshot,
  RoutineCategoryConfig,
  createCardCharge,
  createKillSwitch,
  fetchCardSummary,
  fetchCardTransactions,
  fetchIntelligenceBundle,
  fetchKillSwitches,
  fetchRoutineCategories,
  fetchSnapshot,
  getCached,
  resumeRecurringCardSubscription,
  setCached,
  stopRecurringCardSubscription,
} from "@/lib/api";
import { usePeriodSlice } from "@/hooks/usePeriodSlice";
import {
  DOMAIN_CONSTANTS,
  formatCurrencyInput,
  formatDate,
  formatRupiah,
  getJakartaDateParts,
  parseCurrencyInput,
} from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useLanguage } from "@/context/LanguageContext";
import { handleTabListKeyDown } from "@/lib/tabs";

type SubscriptionFilter = "all" | "recurring" | "oneoff" | "stopped";

const FILTER_ORDER: SubscriptionFilter[] = ["all", "recurring", "oneoff", "stopped"];

const MONTH_ABBR = [
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

function formatPeriodCode(month: number, year: number): string {
  const m = MONTH_ABBR[Math.max(0, Math.min(11, month - 1))] || String(month);
  return `${m} '${String(year).slice(-2)}`;
}

function getDaysUntilDayOfMonth(
  targetDay: number,
  ref: { year: number; month: number; day: number },
): { days: number; nextDateLabel: string } {
  const refUtc = Date.UTC(ref.year, ref.month - 1, ref.day);
  let targetYear = ref.year;
  let targetMonth = ref.month;

  if (ref.day > targetDay) {
    targetMonth = ref.month === 12 ? 1 : ref.month + 1;
    targetYear = ref.month === 12 ? ref.year + 1 : ref.year;
  }

  const maxDayInMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const clampedDay = Math.min(targetDay, maxDayInMonth);
  const targetUtc = Date.UTC(targetYear, targetMonth - 1, clampedDay);
  const days = Math.round((targetUtc - refUtc) / 86_400_000);
  const nextDateLabel = `${String(clampedDay).padStart(2, "0")} ${MONTH_ABBR[targetMonth - 1]} ${targetYear}`;
  return { days, nextDateLabel };
}

interface SubscriptionsStudioProps {
  activeMonth: number;
  activeYear: number;
  initialTransactions: CreditCardTransaction[];
  initialCardSummary: CreditCardSummary | null;
  initialKillSwitches: KillSwitchResponse | null;
  initialRoutineCategories: RoutineCategoryConfig[];
  initialSnapshot: MonthlySnapshot | null;
}

const COPY = {
  en: {
    subtitle:
      "Consolidated ledger of recurring card subscriptions, one-off AI and software charges, routine category envelopes, and billing cycle cutoffs.",
    addAction: "Add Charge / Subscription",
    killSwitchLink: "Kill-Switch & SMTP Panel",
    monthlyRecurringLabel: "Active Monthly Recurring",
    monthlyRecurringSub: "CC recurring + fixed routine envelopes",
    annualizedLabel: "Annualized Run-Rate",
    annualizedSub: "12-month projected recurring spend",
    oneOffCycleLabel: "One-Off Digital & Card Charges",
    cutoffCardLabel: "Upcoming Cycle Cutoffs",
    searchPlaceholder: "Filter merchant, category, or notes...",
    allTab: "All Tracked",
    recurringTab: "Recurring",
    oneOffTab: "One-Off Charges",
    stoppedTab: "Stopped / Settled",
    colMerchant: "Merchant / Label",
    colMode: "Mode",
    colBilling: "Billing Period",
    colAmount: "Amount",
    colKillSwitch: "Kill-Switch Guard",
    colAction: "Control",
    routineHeading: "Fixed Monthly Routine Envelopes",
    routineManage: "Edit Routine Quotas",
    emptyRows: "No subscription or one-off card entries match the active filter.",
    periodLockedNote: "Active period is locked; stop/resume changes are disabled.",
  },
  id: {
    subtitle:
      "Daftar terpusat untuk langganan kartu kredit rutin, tagihan AI/digital sekali bayar, kuota rutin bulanan, dan jadwal tanggal cetak tagihan.",
    addAction: "Tambah Tagihan / Langganan",
    killSwitchLink: "Panel Kill-Switch & SMTP",
    monthlyRecurringLabel: "Beban Rutin Bulanan Aktif",
    monthlyRecurringSub: "Langganan KK aktif + kuota rutin tetap",
    annualizedLabel: "Proyeksi Tahunan (12 Bulan)",
    annualizedSub: "Total estimasi pengeluaran berulang 12 bulan",
    oneOffCycleLabel: "Tagihan Sekali Bayar & Digital",
    cutoffCardLabel: "Jadwal Cetak & Jatuh Tempo",
    searchPlaceholder: "Cari merchant, kategori, atau catatan...",
    allTab: "Semua",
    recurringTab: "Berulang",
    oneOffTab: "Sekali Bayar",
    stoppedTab: "Dihentikan",
    colMerchant: "Merchant / Keterangan",
    colMode: "Tipe",
    colBilling: "Periode Tagihan",
    colAmount: "Nominal",
    colKillSwitch: "Penjaga Kill-Switch",
    colAction: "Kontrol",
    routineHeading: "Amplop Kuota Rutin Bulanan",
    routineManage: "Ubah Kuota Rutin",
    emptyRows: "Tidak ada transaksi langganan atau tagihan yang cocok dengan filter.",
    periodLockedNote: "Periode aktif terkunci; kontrol hentikan/lanjutkan dinonaktifkan.",
  },
  zh: {
    subtitle:
      "集中管理信用卡定期订阅、一次性 AI 与数字服务账单、每月固定例行额度以及账单日与还款日倒计时。",
    addAction: "新增账单 / 订阅",
    killSwitchLink: "Kill-Switch 与邮件面板",
    monthlyRecurringLabel: "当前每月固定与订阅支出",
    monthlyRecurringSub: "活跃信用卡订阅 + 例行固定额度",
    annualizedLabel: "年度预测支出 (12个月)",
    annualizedSub: "12个月持续性固定与订阅总额",
    oneOffCycleLabel: "一次性数字与单笔卡消费",
    cutoffCardLabel: "近期账单截止与还款日",
    searchPlaceholder: "筛选商户、类别或备注...",
    allTab: "全部记录",
    recurringTab: "定期订阅",
    oneOffTab: "一次性消费",
    stoppedTab: "已停用",
    colMerchant: "商户 / 项目",
    colMode: "模式",
    colBilling: "账单周期",
    colAmount: "金额",
    colKillSwitch: "Kill-Switch 预警",
    colAction: "操作",
    routineHeading: "每月固定例行预算额度",
    routineManage: "编辑例行额度",
    emptyRows: "当前筛选条件下暂无匹配的订阅或卡账单记录。",
    periodLockedNote: "当前周期已锁定，停用或恢复订阅操作已禁用。",
  },
} as const;

export function SubscriptionsStudio({
  activeMonth: initialMonth,
  activeYear: initialYear,
  initialTransactions,
  initialCardSummary,
  initialKillSwitches,
  initialRoutineCategories,
  initialSnapshot,
}: SubscriptionsStudioProps) {
  const router = useRouter();
  const { isAmountsMasked } = usePrivacyMask();
  const { locale } = useLanguage();
  const copy = COPY[locale] ?? COPY.en;

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const filterButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const {
    month: activeMonth,
    year: activeYear,
    data: periodSlice,
    setData: setPeriodSlice,
  } = usePeriodSlice<{
    snapshot: MonthlySnapshot | null;
    cardSummary: CreditCardSummary | null;
    transactions: CreditCardTransaction[];
    killSwitches: KillSwitchResponse | null;
    routineCategories: RoutineCategoryConfig[];
  }>({
    initialMonth,
    initialYear,
    initialData: {
      snapshot: initialSnapshot,
      cardSummary: initialCardSummary,
      transactions: initialTransactions,
      killSwitches: initialKillSwitches,
      routineCategories: initialRoutineCategories,
    },
    seedCache: (m, y, d) => {
      if (d.snapshot) setCached(`snapshot:${m}:${y}`, d.snapshot);
      if (d.cardSummary) setCached(`cardSummary:${m}:${y}`, d.cardSummary);
      setCached("cardTransactions:all", d.transactions);
      if (d.killSwitches) setCached("killSwitches", d.killSwitches);
      setCached("routineCategories:all", d.routineCategories);
    },
    readFromCache: (m, y, prev) => {
      const snapshot = getCached<MonthlySnapshot | null>(`snapshot:${m}:${y}`);
      const cardSummary = getCached<CreditCardSummary | null>(`cardSummary:${m}:${y}`);
      if (snapshot === undefined || cardSummary === undefined) return undefined;
      return {
        snapshot,
        cardSummary,
        transactions:
          getCached<CreditCardTransaction[]>("cardTransactions:all") ??
          prev.transactions,
        killSwitches:
          getCached<KillSwitchResponse | null>("killSwitches") ??
          prev.killSwitches,
        routineCategories:
          getCached<RoutineCategoryConfig[]>("routineCategories:all") ??
          prev.routineCategories,
      };
    },
    fetchForPeriod: async (m, y) => {
      const [
        snapshot,
        cardSummary,
        fetchedTransactions,
        fetchedKillSwitches,
        fetchedRoutineCategories,
      ] = await Promise.all([
        fetchSnapshot(m, y),
        fetchCardSummary(m, y),
        fetchCardTransactions(),
        fetchKillSwitches(),
        fetchRoutineCategories(),
      ]);
      setCached("cardTransactions:all", fetchedTransactions);
      if (fetchedKillSwitches) setCached("killSwitches", fetchedKillSwitches);
      setCached("routineCategories:all", fetchedRoutineCategories);
      return {
        snapshot,
        cardSummary,
        transactions: fetchedTransactions,
        killSwitches: fetchedKillSwitches,
        routineCategories: fetchedRoutineCategories,
      };
    },
  });

  const transactions = periodSlice.transactions;
  const killSwitches = periodSlice.killSwitches;
  const [intel, setIntel] = useState<IntelligenceBundleResponse | null>(null);

  useEffect(() => {
    let active = true;
    const cached = getCached<IntelligenceBundleResponse | null>(`intelligence:${activeMonth}:${activeYear}:0`);
    if (cached) {
      setIntel(cached);
    } else {
      fetchIntelligenceBundle(activeMonth, activeYear).then((res) => {
        if (active && res) setIntel(res);
      });
    }
    return () => {
      active = false;
    };
  }, [activeMonth, activeYear]);

  const trueWage = intel?.lifeenergy?.trueNetHourlyWageRp ?? 0;
  const setTransactions = (
    updater: (prev: CreditCardTransaction[]) => CreditCardTransaction[],
  ) =>
    setPeriodSlice((prev) => ({
      ...prev,
      transactions: updater(prev.transactions),
    }));
  const setKillSwitches = (
    updater: (prev: KillSwitchResponse | null) => KillSwitchResponse | null,
  ) =>
    setPeriodSlice((prev) => ({
      ...prev,
      killSwitches: updater(prev.killSwitches),
    }));
  const [filter, setFilter] = useState<SubscriptionFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [busyRowId, setBusyRowId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  // Quick-Add Native <dialog> State
  const jakartaNow = getJakartaDateParts();
  const defaultTxDate = jakartaNow.isoDate;

  const [formLabel, setFormLabel] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("Subscription");
  const [formChargeType, setFormChargeType] = useState<"FULL" | "RECURRING">("RECURRING");
  const [formTxDate, setFormTxDate] = useState(defaultTxDate);
  const [formNotes, setFormNotes] = useState("");
  const [armKillSwitch, setArmKillSwitch] = useState(false);
  const [promoLabel, setPromoLabel] = useState("Intro Promo Rate");
  const [promoEndDate, setPromoEndDate] = useState("");
  const [postPromoAmount, setPostPromoAmount] = useState("");
  const [cancelUrl, setCancelUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isPeriodLocked = periodSlice.snapshot?.status === "LOCKED";
  const statementCutoffDay =
    periodSlice.cardSummary?.statementCutoffDay ?? DOMAIN_CONSTANTS.CC_CUTOFF_DAY;
  const paymentDueDay =
    periodSlice.cardSummary?.paymentDueDay ?? DOMAIN_CONSTANTS.CC_DUE_DAY;

  const isRowStopped = (tx: CreditCardTransaction): boolean =>
    tx.isActive === false || tx.status === "CANCELLED" || tx.stoppedAtMonth != null;

  // Include all RECURRING charges + all FULL one-off charges (excludes retail INSTALLMENT tenors)
  const trackedEntries = useMemo(() => {
    return transactions.filter(
      (tx) => tx.isRecurring || tx.chargeType === "RECURRING" || tx.chargeType === "FULL",
    );
  }, [transactions]);

  const activeRecurringEntries = useMemo(
    () =>
      trackedEntries.filter(
        (tx) => (tx.isRecurring || tx.chargeType === "RECURRING") && !isRowStopped(tx),
      ),
    [trackedEntries],
  );

  const oneOffFullEntries = useMemo(
    () => trackedEntries.filter((tx) => !tx.isRecurring && tx.chargeType === "FULL"),
    [trackedEntries],
  );

  const routineCategories = useMemo(
    () => periodSlice.routineCategories.filter((cat) => !cat.hidden),
    [periodSlice.routineCategories],
  );

  const totalRoutineMonthly = useMemo(
    () => routineCategories.reduce((sum, cat) => sum + (cat.target || 0), 0),
    [routineCategories],
  );

  const activeRecurringCcMonthly = useMemo(
    () => activeRecurringEntries.reduce((sum, tx) => sum + (tx.monthlyAmount ?? tx.amount), 0),
    [activeRecurringEntries],
  );

  const totalMonthlyRecurring = activeRecurringCcMonthly + totalRoutineMonthly;
  const annualizedRunRate = totalMonthlyRecurring * 12;

  const totalOneOffFullAmount = useMemo(
    () => oneOffFullEntries.reduce((sum, tx) => sum + tx.amount, 0),
    [oneOffFullEntries],
  );

  const currentPeriodOneOffAmount = useMemo(
    () =>
      oneOffFullEntries
        .filter((tx) => tx.billingMonth === activeMonth && tx.billingYear === activeYear)
        .reduce((sum, tx) => sum + tx.amount, 0),
    [oneOffFullEntries, activeMonth, activeYear],
  );

  const activeKillSwitchItems = useMemo(
    () => (killSwitches?.items ?? []).filter((item) => item.killSwitchEnabled && item.isActive),
    [killSwitches],
  );

  const killSwitchExposureDelta = useMemo(
    () =>
      activeKillSwitchItems.reduce((sum, item) => sum + Math.max(0, item.monthlyPenaltyDelta || 0), 0),
    [activeKillSwitchItems],
  );

  const ccCutoffCountdown = getDaysUntilDayOfMonth(statementCutoffDay, jakartaNow);
  const ccDueCountdown = getDaysUntilDayOfMonth(paymentDueDay, jakartaNow);
  const spayCutoffCountdown = getDaysUntilDayOfMonth(
    DOMAIN_CONSTANTS.SPAYLATER_CUTOFF_DAY,
    jakartaNow,
  );
  const spayDueCountdown = getDaysUntilDayOfMonth(DOMAIN_CONSTANTS.SPAYLATER_DUE_DAY, jakartaNow);

  const killSwitchByLabel = useMemo(() => {
    const map = new Map<string, KillSwitchResponse["items"][number]>();
    for (const item of killSwitches?.items ?? []) {
      map.set(item.label.trim().toLowerCase(), item);
    }
    return map;
  }, [killSwitches]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return trackedEntries.filter((tx) => {
      const recurring = tx.isRecurring || tx.chargeType === "RECURRING";
      const stopped = isRowStopped(tx);

      if (filter === "recurring" && (!recurring || stopped)) return false;
      if (filter === "oneoff" && (recurring || tx.status === "CANCELLED")) return false;
      if (filter === "stopped" && !stopped && tx.status !== "SETTLED") return false;

      if (!q) return true;
      const haystack = `${tx.label} ${tx.category} ${tx.notes ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [trackedEntries, filter, searchQuery]);

  // Billing month preview inside Quick-Add dialog
  const previewBillingPeriod = useMemo(() => {
    const parts = formTxDate.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      return { month: activeMonth, year: activeYear };
    }
    const [txYear, txMonth, txDay] = parts;
    if (txDay > statementCutoffDay) {
      return {
        month: txMonth === 12 ? 1 : txMonth + 1,
        year: txMonth === 12 ? txYear + 1 : txYear,
      };
    }
    return { month: txMonth, year: txYear };
  }, [formTxDate, statementCutoffDay, activeMonth, activeYear]);

  const openDialog = () => {
    setFormError(null);
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  };

  const closeDialog = () => {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  };

  const handleToggleStopResume = async (tx: CreditCardTransaction) => {
    if (isPeriodLocked) return;
    setBusyRowId(tx.id);
    setRowError(null);

    const stopped = isRowStopped(tx);
    if (stopped) {
      const res = await resumeRecurringCardSubscription(tx.id);
      setBusyRowId(null);
      if (!res.success) {
        setRowError(res.error || "Unable to resume subscription.");
        return;
      }
      setTransactions((prev) =>
        prev.map((row) =>
          row.id === tx.id
            ? { ...row, isActive: true, stoppedAtMonth: null, stoppedAtYear: null, status: "ACTIVE" }
            : row,
        ),
      );
      router.refresh();
    } else {
      const res = await stopRecurringCardSubscription(tx.id, activeMonth, activeYear);
      setBusyRowId(null);
      if (!res.success) {
        setRowError(res.error || "Unable to stop subscription.");
        return;
      }
      setTransactions((prev) =>
        prev.map((row) =>
          row.id === tx.id
            ? {
                ...row,
                isActive: false,
                stoppedAtMonth: activeMonth,
                stoppedAtYear: activeYear,
              }
            : row,
        ),
      );
      router.refresh();
    }
  };

  const handleCreateCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedAmount = parseCurrencyInput(formAmount);
    if (!formLabel.trim()) {
      setFormError("Merchant or service label is required.");
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setFormError("Amount must be greater than Rp 0.");
      return;
    }
    if (formChargeType === "RECURRING" && armKillSwitch && !promoEndDate) {
      setFormError("Promo end date is required when arming a Kill-Switch guard.");
      return;
    }

    setSubmitting(true);
    const isRecurring = formChargeType === "RECURRING";
    const res = await createCardCharge({
      label: formLabel.trim(),
      amount: parsedAmount,
      chargeType: formChargeType,
      isRecurring,
      category: formCategory,
      transactionDate: `${formTxDate}T12:00:00.000Z`,
      notes: formNotes.trim() || undefined,
    });

    if (!res.success || !res.data) {
      setSubmitting(false);
      setFormError(res.error || "Failed to record card charge.");
      return;
    }

    const createdTx = res.data;

    if (isRecurring && armKillSwitch && promoEndDate) {
      const normalAmt = parseCurrencyInput(postPromoAmount) || parsedAmount;
      const ksRes = await createKillSwitch({
        label: formLabel.trim(),
        amount: parsedAmount,
        promoLabel: promoLabel.trim() || "Promo Period",
        promoEndDate,
        postPromoNormalAmount: normalAmt,
        killSwitchEnabled: true,
        providerCancelUrl: cancelUrl.trim() || undefined,
        billingMonth: createdTx.billingMonth,
        billingYear: createdTx.billingYear,
      });

      if (ksRes.success && ksRes.data) {
        const ksItem = ksRes.data;
        setKillSwitches((prev) => ({
          config: prev?.config ?? { killSwitchLeadDays: 14, killSwitchBannerEnabled: true },
          items: [ksItem, ...(prev?.items ?? [])],
        }));
      }
    }

    setTransactions((prev) => [createdTx, ...prev]);
    setSubmitting(false);
    setFormLabel("");
    setFormAmount("");
    setFormNotes("");
    setArmKillSwitch(false);
    setPromoEndDate("");
    setPostPromoAmount("");
    setCancelUrl("");
    closeDialog();
    router.refresh();
  };

  const countByFilter: Record<SubscriptionFilter, number> = {
    all: trackedEntries.length,
    recurring: activeRecurringEntries.length,
    oneoff: oneOffFullEntries.filter((tx) => tx.status !== "CANCELLED").length,
    stopped: trackedEntries.filter((tx) => isRowStopped(tx) || tx.status === "SETTLED").length,
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header & Top Action Bar */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold font-sans text-text-primary tracking-tight">
              Subscriptions &amp; Recurring
            </h1>
            <span className="text-[11px] font-mono text-text-tertiary border border-border rounded px-2 py-0.5 tabular-nums">
              Cycle {formatPeriodCode(activeMonth, activeYear)}
            </span>
          </div>
          <p className="text-xs font-sans text-text-tertiary mt-1">{copy.subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={`/preferences?tab=killswitch&month=${activeMonth}&year=${activeYear}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-surface hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-caution" />
            {copy.killSwitchLink}
          </Link>
          <button
            type="button"
            onClick={openDialog}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-medium bg-text-primary text-canvas hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {copy.addAction}
          </button>
        </div>
      </div>

      {/* Top Asymmetric KPI Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Card A: Monthly Recurring Total (Centerpiece Display Face) */}
        <section className="col-span-5 rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
              {copy.monthlyRecurringLabel}
            </div>
            <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-text-primary tabular-nums">
              {formatRupiah(totalMonthlyRecurring, isAmountsMasked)}
            </div>
            <div className="mt-1 text-xs font-sans text-text-tertiary">
              {copy.monthlyRecurringSub}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-subtle grid grid-cols-2 gap-3 text-xs font-mono tabular-nums">
            <div>
              <div className="text-[10px] uppercase text-text-tertiary">CC Subscriptions</div>
              <div className="text-text-primary mt-0.5">
                {formatRupiah(activeRecurringCcMonthly, isAmountsMasked)}
                <span className="text-text-tertiary ml-1">({activeRecurringEntries.length})</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-text-tertiary">Routine Envelopes</div>
              <div className="text-text-primary mt-0.5">
                {formatRupiah(totalRoutineMonthly, isAmountsMasked)}
                <span className="text-text-tertiary ml-1">({routineCategories.length})</span>
              </div>
            </div>
          </div>
        </section>

        {/* Card B: Annualized Run-Rate */}
        <section className="col-span-4 rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
              {copy.annualizedLabel}
            </div>
            <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-text-primary tabular-nums">
              {formatRupiah(annualizedRunRate, isAmountsMasked)}
            </div>
            <div className="mt-1 text-xs font-sans text-text-tertiary">{copy.annualizedSub}</div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="text-text-tertiary">{copy.oneOffCycleLabel}</span>
            <span className="text-text-primary">
              {formatRupiah(currentPeriodOneOffAmount, isAmountsMasked)} /{" "}
              <span className="text-text-tertiary">
                {formatRupiah(totalOneOffFullAmount, isAmountsMasked)} all
              </span>
            </span>
          </div>
        </section>

        {/* Card C: Billing Cutoff Countdowns & Kill-Switch Exposure */}
        <section className="col-span-3 rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
              {copy.cutoffCardLabel}
            </div>
            <div className="mt-2.5 space-y-2 text-xs font-mono tabular-nums">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">CC Cutoff ({statementCutoffDay}th)</span>
                <span className="text-text-primary">
                  {ccCutoffCountdown.days === 0 ? "Today" : `${ccCutoffCountdown.days}d`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">CC Due ({paymentDueDay}th)</span>
                <span className="text-text-primary">
                  {ccDueCountdown.days === 0 ? "Today" : `${ccDueCountdown.days}d`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">
                  SPayLater Cutoff (M-15d: {Math.max(1, new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0)).getUTCDate() - 15)}th)
                </span>
                <span className="text-text-tertiary">
                  {spayCutoffCountdown.days === 0 ? "Today" : `${spayCutoffCountdown.days}d`} · Due{" "}
                  {spayDueCountdown.days}d
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="text-text-tertiary">Promo Escalation Risk</span>
            <Link
              href="/preferences?tab=killswitch"
              className={
                killSwitchExposureDelta > 0
                  ? "text-caution hover:underline"
                  : "text-text-secondary hover:text-text-primary"
              }
            >
              +{formatRupiah(killSwitchExposureDelta, isAmountsMasked)}/mo
            </Link>
          </div>
        </section>
      </div>

      {/* Main Split: Card Subscriptions & One-Offs (8 cols) + Routine Envelopes (4 cols) */}
      <div className="grid grid-cols-12 gap-5 items-start">
        <section className="col-span-8 rounded-lg border border-border bg-surface overflow-hidden">
          <div className="p-4 border-b border-border-subtle flex flex-wrap items-center justify-between gap-3">
            {/* Instant Client Filter Tabs */}
            <div
              role="tablist"
              aria-label="Filter card subscriptions and one-off charges"
              className="flex items-center gap-1"
            >
              {(
                [
                  { id: "all", label: copy.allTab },
                  { id: "recurring", label: copy.recurringTab },
                  { id: "oneoff", label: copy.oneOffTab },
                  { id: "stopped", label: copy.stoppedTab },
                ] as const
              ).map((tab, idx) => {
                const selected = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      filterButtonRefs.current[idx] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`sub-filter-${tab.id}`}
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setFilter(tab.id)}
                    onKeyDown={(e) =>
                      handleTabListKeyDown(
                        e,
                        FILTER_ORDER,
                        idx,
                        setFilter,
                        filterButtonRefs,
                      )
                    }
                    className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                      selected
                        ? "bg-surface-elevated text-text-primary border border-border"
                        : "text-text-tertiary hover:text-text-secondary border border-transparent"
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1.5 text-[11px] font-mono tabular-nums text-text-tertiary">
                      {countByFilter[tab.id]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Instant Search */}
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={copy.searchPlaceholder}
                aria-label="Filter subscriptions and one-off card charges"
                className="w-full pl-8 pr-3 py-1.5 rounded bg-canvas border border-border text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-strong"
              />
            </div>
          </div>

          {(rowError || isPeriodLocked) && (
            <div className="px-4 py-2 border-b border-border-subtle bg-surface-subtle text-[11px] font-mono text-text-secondary">
              {rowError ?? copy.periodLockedNote}
            </div>
          )}

          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-tertiary">{copy.emptyRows}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-[11px] font-mono uppercase tracking-wider text-text-tertiary bg-surface-subtle">
                    <th className="py-2.5 px-4 font-medium">{copy.colMerchant}</th>
                    <th className="py-2.5 px-3 font-medium">{copy.colMode}</th>
                    <th className="py-2.5 px-3 font-medium">{copy.colBilling}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{copy.colAmount}</th>
                    <th className="py-2.5 px-3 font-medium">{copy.colKillSwitch}</th>
                    <th className="py-2.5 px-4 font-medium text-right">{copy.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-xs">
                  {filteredEntries.map((tx) => {
                    const recurring = tx.isRecurring || tx.chargeType === "RECURRING";
                    const stopped = isRowStopped(tx);
                    const amountVal = recurring ? tx.monthlyAmount ?? tx.amount : tx.amount;
                    const linkedKs = killSwitchByLabel.get(tx.label.trim().toLowerCase());

                    return (
                      <tr key={tx.id} className="hover:bg-surface-subtle/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-text-primary">{tx.label}</div>
                          <div className="text-[11px] font-mono text-text-tertiary mt-0.5">
                            {tx.category} · {formatDate(tx.transactionDate)}
                            {tx.notes ? ` · ${tx.notes}` : ""}
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px]">
                          {stopped ? (
                            <span className="text-text-tertiary">Stopped</span>
                          ) : recurring ? (
                            <span className="text-delta-positive">Recurring</span>
                          ) : (
                            <span className="text-text-secondary">One-Off Full</span>
                          )}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] tabular-nums text-text-secondary">
                          {formatPeriodCode(tx.billingMonth, tx.billingYear)}
                          {tx.stoppedAtMonth && tx.stoppedAtYear && (
                            <span className="text-text-tertiary ml-1">
                              → {formatPeriodCode(tx.stoppedAtMonth, tx.stoppedAtYear)}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap text-right font-mono tabular-nums font-medium text-text-primary">
                          <div>{formatRupiah(amountVal, isAmountsMasked)}</div>
                          {trueWage > 0 && amountVal > 0 && (
                            <div className="text-[10px] font-normal text-text-tertiary">
                              ~{(amountVal / trueWage).toFixed(1)}h work
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap text-[11px] font-mono">
                          {linkedKs ? (
                            <Link
                              href="/preferences?tab=killswitch"
                              className={`inline-flex items-center gap-1 hover:underline ${
                                linkedKs.statusLabel === "CRITICAL"
                                  ? "text-urgency"
                                  : linkedKs.statusLabel === "SAFE"
                                    ? "text-delta-positive"
                                    : "text-caution"
                              }`}
                            >
                              {linkedKs.statusLabel === "SAFE"
                                ? "Cancelled safely"
                                : linkedKs.daysUntilExpiry != null
                                  ? `Promo ends in ${linkedKs.daysUntilExpiry}d`
                                  : "Guard active"}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span className="text-text-tertiary">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          {recurring ? (
                            <button
                              type="button"
                              disabled={isPeriodLocked || busyRowId === tx.id}
                              onClick={() => handleToggleStopResume(tx)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border border-border bg-canvas hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              {stopped ? (
                                <>
                                  <RotateCcw className="w-3 h-3" />
                                  Resume
                                </>
                              ) : (
                                <>
                                  <Ban className="w-3 h-3" />
                                  Stop
                                </>
                              )}
                            </button>
                          ) : (
                            <Link
                              href={`/credit?tab=card&month=${tx.billingMonth}&year=${tx.billingYear}`}
                              className="text-[11px] font-mono text-text-tertiary hover:text-text-primary hover:underline"
                            >
                              Inspect in Card
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right Column: Fixed Monthly Routine Quotas */}
        <section className="col-span-4 rounded-lg border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider font-mono text-text-secondary">
                {copy.routineHeading}
              </h2>
              <p className="text-[11px] text-text-tertiary mt-0.5">
                Deducted upfront before discretionary savings
              </p>
            </div>
            <Link
              href="/preferences?tab=buckets"
              className="text-[11px] font-mono text-text-secondary hover:text-text-primary hover:underline"
            >
              {copy.routineManage}
            </Link>
          </div>

          <div className="space-y-3">
            {routineCategories.map((cat) => {
              const share =
                totalRoutineMonthly > 0
                  ? Math.round((cat.target / totalRoutineMonthly) * 100)
                  : 0;
              return (
                <div key={cat.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-sans text-text-primary">{cat.label}</span>
                    <span className="font-mono tabular-nums text-text-primary">
                      {formatRupiah(cat.target, isAmountsMasked)}
                      {trueWage > 0 && cat.target > 0 && (
                        <span className="text-[10px] text-text-tertiary ml-1.5">
                          ({(cat.target / trueWage).toFixed(1)}h)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-sm bg-canvas overflow-hidden">
                    <div
                      className="h-full bg-text-secondary/50"
                      style={{ width: `${Math.min(100, Math.max(2, share))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-border-subtle flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="text-text-tertiary">Total Routine Monthly</span>
            <span className="font-semibold text-text-primary">
              {formatRupiah(totalRoutineMonthly, isAmountsMasked)}
            </span>
          </div>
        </section>
      </div>

      {/* Native <dialog> Quick-Add Modal */}
      <dialog
        ref={dialogRef}
        aria-labelledby="sub-quickadd-title"
        onClick={(e) => {
          if (e.target === dialogRef.current) {
            closeDialog();
          }
        }}
        className="erp-dialog shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-surface-subtle">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
              Credit Card Billing Cutoff: {statementCutoffDay}th of Month
            </div>
            <h3 id="sub-quickadd-title" className="text-sm font-semibold text-text-primary mt-0.5">
              {copy.addAction}
            </h3>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close modal"
            className="p-1.5 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreateCharge} className="p-5 space-y-4">
          {formError && (
            <div className="rounded border border-urgency/40 bg-[rgba(255,56,56,0.08)] px-3 py-2 text-xs text-urgency">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <label htmlFor="sub-charge-mode" className="block text-xs font-medium text-text-secondary">
                Charge Mode
              </label>
              <select
                id="sub-charge-mode"
                value={formChargeType}
                onChange={(e) => setFormChargeType(e.target.value as "FULL" | "RECURRING")}
                className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-xs text-text-primary focus:outline-none focus:border-border-strong"
              >
                <option value="RECURRING">Recurring Monthly Subscription</option>
                <option value="FULL">One-Off Charge (Single Cycle)</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1 space-y-1">
              <label htmlFor="sub-charge-category" className="block text-xs font-medium text-text-secondary">
                Category
              </label>
              <select
                id="sub-charge-category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-xs text-text-primary focus:outline-none focus:border-border-strong"
              >
                <option value="Subscription">Subscription</option>
                <option value="Shopping">Shopping</option>
                <option value="Electronics">Electronics</option>
                <option value="General">General</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="sub-charge-label" className="block text-xs font-medium text-text-secondary">
                Merchant / Service Name
              </label>
              <input
                id="sub-charge-label"
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g. Google AI Pro / JetBrains"
                className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-xs text-text-primary focus:outline-none focus:border-border-strong"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="sub-charge-amount" className="block text-xs font-medium text-text-secondary">
                Amount (IDR)
              </label>
              <input
                id="sub-charge-amount"
                type="text"
                inputMode="numeric"
                value={formAmount}
                onChange={(e) => setFormAmount(formatCurrencyInput(e.target.value))}
                placeholder="309.000"
                className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-xs font-mono tabular-nums text-right text-text-primary focus:outline-none focus:border-border-strong"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="sub-charge-date" className="block text-xs font-medium text-text-secondary">
                Transaction Date
              </label>
              <input
                id="sub-charge-date"
                type="date"
                value={formTxDate}
                onChange={(e) => setFormTxDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-xs font-mono text-text-primary focus:outline-none focus:border-border-strong"
              />
              <span className="block text-[11px] font-mono text-text-tertiary">
                Routes to statement period {formatPeriodCode(previewBillingPeriod.month, previewBillingPeriod.year)}
              </span>
            </div>

            <div className="space-y-1">
              <label htmlFor="sub-charge-notes" className="block text-xs font-medium text-text-secondary">
                Notes (Optional)
              </label>
              <input
                id="sub-charge-notes"
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Plan tier or invoice reference"
                className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-xs text-text-primary focus:outline-none focus:border-border-strong"
              />
            </div>
          </div>

          {formChargeType === "RECURRING" && (
            <div className="rounded border border-border-subtle bg-canvas p-3 space-y-3">
              <label className="flex items-center gap-2 text-xs font-medium text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={armKillSwitch}
                  onChange={(e) => setArmKillSwitch(e.target.checked)}
                />
                Arm Promo Kill-Switch Deadline Guard
              </label>

              {armKillSwitch && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="block text-[11px] text-text-tertiary">Promo End Date</label>
                    <input
                      type="date"
                      value={promoEndDate}
                      onChange={(e) => setPromoEndDate(e.target.value)}
                      className="w-full px-2.5 py-1 rounded bg-surface border border-border text-xs font-mono text-text-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] text-text-tertiary">
                      Post-Promo Monthly Rate (IDR)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={postPromoAmount}
                      onChange={(e) => setPostPromoAmount(formatCurrencyInput(e.target.value))}
                      placeholder={formAmount || "309.000"}
                      className="w-full px-2.5 py-1 rounded bg-surface border border-border text-xs font-mono text-right text-text-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] text-text-tertiary">Promo Label</label>
                    <input
                      type="text"
                      value={promoLabel}
                      onChange={(e) => setPromoLabel(e.target.value)}
                      className="w-full px-2.5 py-1 rounded bg-surface border border-border text-xs text-text-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] text-text-tertiary">
                      Cancellation URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={cancelUrl}
                      onChange={(e) => setCancelUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-2.5 py-1 rounded bg-surface border border-border text-xs font-mono text-text-primary"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={closeDialog}
              className="px-3 py-1.5 rounded text-xs font-medium text-text-secondary hover:text-text-primary border border-border cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded text-xs font-medium bg-text-primary text-canvas hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Saving..." : "Save Entry"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
