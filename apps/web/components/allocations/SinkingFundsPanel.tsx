"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, PiggyBank } from "lucide-react";
import {
  SinkingFundItemDto,
  SinkingFundsResponse,
  contributeSinkingFund,
  createSinkingFund,
  deleteSinkingFund,
  fetchSinkingFunds,
} from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { usePeriod } from "@/context/PeriodContext";
import { usePerspective } from "@/context/PerspectiveContext";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { usePrivacyGuard } from "@/hooks/usePrivacyGuard";
import { useConfirmDialog } from "@/context/ConfirmDialogContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrencyInput, formatRupiah, parseCurrencyInput } from "@/lib/utils";
import { titleCaseCode } from "@/lib/format-labels";

const DEFAULT_SF_CATEGORIES = [
  { code: "TRAVEL", label: "Travel & Holiday" },
  { code: "EMERGENCY", label: "Emergency Reserve" },
  { code: "GADGET", label: "Device & Gear" },
  { code: "VEHICLE", label: "Vehicle Service / Tax" },
  { code: "EDUCATION", label: "Course & Education" },
  { code: "GENERAL", label: "General Reserve" },
];

const COPY = {
  en: {
    title: "Active Sinking Funds",
    subtitle: "Ring-fenced periodic savings targets with automatic monthly set-aside tracking.",
    addBtn: "New Sinking Fund",
    cancel: "Cancel",
    save: "Create Target",
    contribute: "+ Contribute",
    confirmContribute: "Add Contribution",
    monthlySetAside: "Monthly Set-Aside",
    totalSaved: "Total Saved",
    targetTotal: "Total Targets",
    remaining: "Remaining",
    monthsLeft: "mo left",
    namePlaceholder: "e.g. Year-end trip reserve",
    targetRp: "Target Amount (Rp)",
    initialSavedRp: "Already Saved (Rp)",
    targetMonth: "Target Month",
    targetYear: "Target Year",
    category: "Category",
    empty: "No active sinking funds yet.",
    deleteTitle: "Delete Sinking Fund",
    deleteDesc: "Remove this sinking fund target?",
    deleteConfirm: "Delete",
  },
  id: {
    title: "Dana Cadangan Berkala",
    subtitle: "Target tabungan khusus untuk kebutuhan berkala lengkap dengan hitungan setoran bulanan otomatis.",
    addBtn: "Buat Dana Cadangan",
    cancel: "Batal",
    save: "Simpan Target",
    contribute: "+ Setor Dana",
    confirmContribute: "Catat Setoran",
    monthlySetAside: "Setoran Bulanan",
    totalSaved: "Terkumpul",
    targetTotal: "Total Target",
    remaining: "Kurang",
    monthsLeft: "bln lagi",
    namePlaceholder: "contoh: Dana libur akhir tahun",
    targetRp: "Nominal Target (Rp)",
    initialSavedRp: "Saldo Awal (Rp)",
    targetMonth: "Bulan Target",
    targetYear: "Tahun Target",
    category: "Kategori",
    empty: "Belum ada dana cadangan berkala aktif.",
    deleteTitle: "Hapus Dana Cadangan",
    deleteDesc: "Hapus target dana cadangan ini?",
    deleteConfirm: "Hapus",
  },
  zh: {
    title: "专项备用金目标",
    subtitle: "按目标日期自动拆解每月应存金额，集中管理旅行、换机或年缴项目储备金。",
    addBtn: "新建备用金目标",
    cancel: "取消",
    save: "创建目标",
    contribute: "+ 存入一笔",
    confirmContribute: "确认存入",
    monthlySetAside: "每月应存合计",
    totalSaved: "累计已存",
    targetTotal: "目标总额",
    remaining: "距离目标",
    monthsLeft: "个月到期",
    namePlaceholder: "例如：年末出行备用金",
    targetRp: "目标金额 (Rp)",
    initialSavedRp: "已存金额 (Rp)",
    targetMonth: "目标月份",
    targetYear: "目标年份",
    category: "类别",
    empty: "暂无进行中的专项备用金。",
    deleteTitle: "删除备用金目标",
    deleteDesc: "确定要移除这项备用金目标吗？",
    deleteConfirm: "删除",
  },
};

export function SinkingFundsPanel({ isLocked = false }: { isLocked?: boolean }) {
  const { locale } = useLanguage();
  const { month, year, revisionTick, refreshPeriod } = usePeriod();
  const { studioConfig, updateStudioConfig } = usePerspective();
  const { isAmountsMasked } = usePrivacyMask();
  const { requireUnmasked } = usePrivacyGuard();
  const { confirmDialog } = useConfirmDialog();
  const { toast } = useToast();

  const t = COPY[locale] ?? COPY.en;
  const formatRp = (n: number) => formatRupiah(n, isAmountsMasked);
  const categories = React.useMemo(() => {
    const table = studioConfig?.sinkingFundCategoriesTable;
    const rows = Array.isArray(table) && table.length > 0 ? table.filter((r) => r.active !== false) : DEFAULT_SF_CATEGORIES;
    return rows.length > 0 ? rows : DEFAULT_SF_CATEGORIES;
  }, [studioConfig?.sinkingFundCategoriesTable]);
  const labelByCode = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of studioConfig?.sinkingFundCategoriesTable ?? DEFAULT_SF_CATEGORIES) {
      map.set(String(c.code).toUpperCase(), c.label);
    }
    return map;
  }, [studioConfig?.sinkingFundCategoriesTable]);

  const [data, setData] = useState<SinkingFundsResponse>({
    items: [],
    totalMonthlySetAsideRp: 0,
    totalTargetRp: 0,
    totalSavedRp: 0,
  });
  const [showAdd, setShowAdd] = useState(false);
  const [contributingId, setContributingId] = useState<number | null>(null);
  const [contribInput, setContribInput] = useState("250.000");

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("TRAVEL");
  const [targetInput, setTargetInput] = useState("2.000.000");
  const [savedInput, setSavedInput] = useState("0");
  const [targetMonth, setTargetMonth] = useState<number>(Math.min(12, month === 12 ? 12 : month + 3));
  const [targetYear, setTargetYear] = useState<number>(month > 9 ? year + 1 : year);
  const [saving, setSaving] = useState(false);

  const loadFunds = useCallback(async () => {
    const res = await fetchSinkingFunds();
    setData(res);
  }, []);

  useEffect(() => {
    void loadFunds();
  }, [loadFunds, revisionTick]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireUnmasked(t.title)) return;
    const targetAmountRp = parseCurrencyInput(targetInput);
    const savedAmountRp = parseCurrencyInput(savedInput);
    if (!name.trim() || targetAmountRp <= 0) return;

    setSaving(true);
    try {
      const res = await createSinkingFund({
        name: name.trim(),
        category,
        targetAmountRp,
        savedAmountRp,
        targetMonth,
        targetYear,
      });
      if (!res.success) {
        toast({ title: t.title, description: res.error, variant: "error" });
        return;
      }
      setName("");
      setTargetInput("2.000.000");
      setSavedInput("0");
      setShowAdd(false);
      refreshPeriod();
      await loadFunds();
    } finally {
      setSaving(false);
    }
  };

  const handleContribute = async (fund: SinkingFundItemDto) => {
    if (!requireUnmasked(t.contribute)) return;
    const amountRp = parseCurrencyInput(contribInput);
    if (amountRp <= 0) return;
    const res = await contributeSinkingFund(fund.id, amountRp);
    if (!res.success) {
      toast({ title: t.title, description: res.error, variant: "error" });
      return;
    }
    setContributingId(null);
    setContribInput("250.000");
    refreshPeriod();
    await loadFunds();
  };

  const handleDelete = async (id: number) => {
    if (!requireUnmasked(t.title)) return;
    const ok = await confirmDialog({
      title: t.deleteTitle,
      description: t.deleteDesc,
      confirmLabel: t.deleteConfirm,
      variant: "danger",
    });
    if (!ok) return;
    const res = await deleteSinkingFund(id);
    if (!res.success) {
      toast({ title: t.title, description: res.error, variant: "error" });
      return;
    }
    refreshPeriod();
    await loadFunds();
  };

  return (
    <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-delta-positive" />
            <span>{t.title}</span>
          </h3>
          <p className="text-xs font-sans text-text-secondary mt-0.5">{t.subtitle}</p>
        </div>
        {!isLocked && (
          <button
            type="button"
            onClick={() => {
              if (!requireUnmasked(t.addBtn)) return;
              setShowAdd((prev) => !prev);
            }}
            className="erp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-sans font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showAdd ? t.cancel : t.addBtn}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded border border-border-subtle bg-canvas px-3.5 py-2.5">
          <div className="text-[11px] font-sans text-text-tertiary">{t.monthlySetAside}</div>
          <div className="text-base font-mono font-semibold tabular-nums text-accent mt-0.5">
            {formatRp(data.totalMonthlySetAsideRp)}
          </div>
        </div>
        <div className="rounded border border-border-subtle bg-canvas px-3.5 py-2.5">
          <div className="text-[11px] font-sans text-text-tertiary">{t.totalSaved}</div>
          <div className="text-base font-mono font-semibold tabular-nums text-delta-positive mt-0.5">
            {formatRp(data.totalSavedRp)}
          </div>
        </div>
        <div className="rounded border border-border-subtle bg-canvas px-3.5 py-2.5">
          <div className="text-[11px] font-sans text-text-tertiary">{t.targetTotal}</div>
          <div className="text-base font-mono font-semibold tabular-nums text-text-primary mt-0.5">
            {formatRp(data.totalTargetRp)}
          </div>
        </div>
      </div>

      {showAdd && !isLocked && (
        <form onSubmit={handleCreate} className="rounded-lg border border-border bg-canvas p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-sans text-text-secondary mb-1">
                {t.title}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.namePlaceholder}
                required
                className="w-full px-3 py-1.5 rounded border border-border bg-surface text-xs font-sans text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[11px] font-sans text-text-secondary mb-1">
                {t.targetRp}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={targetInput}
                onChange={(e) => setTargetInput(formatCurrencyInput(e.target.value))}
                required
                className="w-full px-3 py-1.5 rounded border border-border bg-surface text-xs font-mono tabular-nums text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[11px] font-sans text-text-secondary mb-1">
                {t.initialSavedRp}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={savedInput}
                onChange={(e) => setSavedInput(formatCurrencyInput(e.target.value))}
                className="w-full px-3 py-1.5 rounded border border-border bg-surface text-xs font-mono tabular-nums text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus:border-accent"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat.code}
                  type="button"
                  onClick={() => setCategory(cat.code)}
                  className={`px-2 py-1 rounded text-[11px] font-sans border cursor-pointer ${
                    category === cat.code
                      ? "border-accent bg-accent/15 text-text-primary font-medium"
                      : "border-border-subtle bg-surface text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setTargetMonth((m) => (m === 1 ? 12 : m - 1))}
                  className="px-2 py-1 rounded border border-border bg-surface cursor-pointer"
                >
                  -
                </button>
                <span className="px-2 tabular-nums text-text-primary">
                  {String(targetMonth).padStart(2, "0")}/{targetYear}
                </span>
                <button
                  type="button"
                  onClick={() => setTargetMonth((m) => (m === 12 ? 1 : m + 1))}
                  className="px-2 py-1 rounded border border-border bg-surface cursor-pointer"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-1 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setTargetYear((y) => Math.max(2026, y - 1))}
                  className="px-2 py-1 rounded border border-border bg-surface cursor-pointer"
                >
                  Y-
                </button>
                <button
                  type="button"
                  onClick={() => setTargetYear((y) => Math.min(2035, y + 1))}
                  className="px-2 py-1 rounded border border-border bg-surface cursor-pointer"
                >
                  Y+
                </button>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="erp-btn-primary px-4 py-1.5 rounded text-xs font-sans font-medium cursor-pointer disabled:opacity-50"
              >
                {t.save}
              </button>
            </div>
          </div>
        </form>
      )}

      {data.items.length === 0 ? (
        <div className="rounded border border-dashed border-border-subtle py-5 text-center text-xs font-sans text-text-tertiary">
          {t.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border-subtle bg-canvas p-4 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold font-sans text-text-primary">
                    {item.name}
                  </div>
                  <div className="text-[11px] font-sans text-text-tertiary mt-0.5">
                    {labelByCode.get(String(item.category).toUpperCase()) ?? titleCaseCode(item.category)} ·{" "}
                    <span className="font-mono tabular-nums">
                      {String(item.targetMonth).padStart(2, "0")}/{item.targetYear} · {item.monthsRemaining}{" "}
                      {t.monthsLeft}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!requireUnmasked(t.contribute)) return;
                        setContributingId((cur) => (cur === item.id ? null : item.id));
                      }}
                      className="px-2 py-1 rounded text-[11px] font-sans border border-border bg-surface text-text-primary hover:border-accent cursor-pointer"
                    >
                      {t.contribute}
                    </button>
                  )}
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded text-text-tertiary hover:text-urgency cursor-pointer"
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="h-1.5 w-full rounded bg-surface-subtle overflow-hidden">
                <div
                  className="h-full bg-delta-positive transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, item.progressPct))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                <span className="text-text-secondary">
                  {formatRp(item.savedAmountRp)} / {formatRp(item.targetAmountRp)}
                </span>
                <span className="text-text-primary font-semibold">
                  {formatRp(item.monthlySetAsideRp)}/mo
                </span>
              </div>

              {contributingId === item.id && (
                <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={contribInput}
                    onChange={(e) => setContribInput(formatCurrencyInput(e.target.value))}
                    className="flex-1 px-2.5 py-1 rounded border border-border bg-surface text-xs font-mono tabular-nums text-text-primary"
                  />
                  <button
                    type="button"
                    onClick={() => handleContribute(item)}
                    className="erp-btn-primary px-3 py-1 rounded text-xs font-sans font-medium cursor-pointer"
                  >
                    {t.confirmContribute}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
