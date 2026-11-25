"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, CheckCircle2, Clock, Pencil } from "lucide-react";
import {
  CommitmentCategory,
  CommitmentFundingSource,
  CommitmentStatus,
  CommitmentsResponse,
  PeriodCommitmentDto,
  createCommitment,
  deleteCommitment,
  fetchCommitments,
  updateCommitment,
  updateCommitmentStatus,
} from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { usePeriod } from "@/context/PeriodContext";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { usePrivacyGuard } from "@/hooks/usePrivacyGuard";
import { useConfirmDialog } from "@/context/ConfirmDialogContext";
import { useToast } from "@/context/ToastContext";
import { ErpDatePicker } from "@/components/primitives/ErpDatePicker";
import { formatCurrencyInput, formatRupiah, getJakartaDateParts, parseCurrencyInput } from "@/lib/utils";

interface OneOffCommitmentsPanelProps {
  month: number;
  year: number;
  isLocked?: boolean;
}

const CATEGORIES: CommitmentCategory[] = [
  "OUTING",
  "PENALTY",
  "EVENT",
  "FAMILY",
  "MEDICAL",
  "TRAVEL",
  "OTHER",
];

const FUNDING_SOURCES: Array<{
  key: CommitmentFundingSource;
  en: string;
  id: string;
  zh: string;
}> = [
  {
    key: "PAYCHECK_UPFRONT",
    en: "Paycheck Upfront",
    id: "Potong di Awal Gajian",
    zh: "发薪优先预扣",
  },
  {
    key: "DISCRETIONARY",
    en: "Discretionary Pool",
    id: "Sisa Alokasi Bebas",
    zh: "自由支配资金池",
  },
  {
    key: "EMERGENCY_BUFFER",
    en: "Emergency Buffer",
    id: "Dana Darurat",
    zh: "应急缓冲金",
  },
];

const CATEGORY_LABELS: Record<CommitmentCategory, { en: string; id: string; zh: string }> = {
  OUTING: { en: "Outing", id: "Acara / Outing", zh: "团建出游" },
  PENALTY: { en: "Penalty / Fee", id: "Penalti / Biaya", zh: "违约金/手续费" },
  EVENT: { en: "Event", id: "Acara", zh: "活动" },
  FAMILY: { en: "Family", id: "Keluarga", zh: "家庭支出" },
  MEDICAL: { en: "Medical", id: "Kesehatan", zh: "医疗健康" },
  TRAVEL: { en: "Travel", id: "Perjalanan", zh: "交通出行" },
  OTHER: { en: "Other", id: "Lainnya", zh: "其他" },
};

const COPY = {
  en: {
    title: "One-Off Commitments",
    subtitle:
      "Period-scoped single bills, penalties, or post-payday obligations (for example: outing bus penalty after payday). Carries 0% Debt / DSR impact.",
    addBtn: "Add Commitment",
    cancel: "Cancel",
    save: "Save Commitment",
    saveEdit: "Update Commitment",
    totalPlanned: "Total Commitments",
    paycheckUpfront: "Paycheck Upfront",
    unpaidPending: "Pending Settlement",
    zeroDsrNote: "0% Debt / DSR impact",
    fieldTitle: "Title",
    fieldTitlePlaceholder: "e.g. Outing bus penalty",
    fieldAmount: "Amount (Rp)",
    fieldDueDate: "Target Payment Date",
    fieldCategory: "Category",
    fieldSource: "Funding Source",
    fieldNotes: "Notes (optional)",
    empty: "No one-off commitments logged for this cycle.",
    paid: "Paid",
    reserved: "Reserved",
    unpaid: "Unpaid",
    deleteTitle: "Delete One-Off Commitment",
    deleteDesc: "Remove this one-off commitment from the selected period?",
    deleteConfirm: "Delete",
  },
  id: {
    title: "Komitmen Sekali Bayar",
    subtitle:
      "Kewajiban satu kali pada siklus ini seperti penalti pembatalan bus outing atau acara setelah gajian. Tidak dihitung sebagai cicilan utang (0% DSR).",
    addBtn: "Tambah Komitmen",
    cancel: "Batal",
    save: "Simpan Komitmen",
    saveEdit: "Perbarui Komitmen",
    totalPlanned: "Total Komitmen",
    paycheckUpfront: "Potong Awal Gajian",
    unpaidPending: "Belum Lunas",
    zeroDsrNote: "0% dampak rasio utang",
    fieldTitle: "Nama Keperluan",
    fieldTitlePlaceholder: "contoh: Penalti batal bus outing",
    fieldAmount: "Nominal (Rp)",
    fieldDueDate: "Tanggal Bayar",
    fieldCategory: "Kategori",
    fieldSource: "Sumber Dana",
    fieldNotes: "Catatan (opsional)",
    empty: "Belum ada komitmen sekali bayar pada siklus ini.",
    paid: "Lunas",
    reserved: "Disisihkan",
    unpaid: "Belum Bayar",
    deleteTitle: "Hapus Komitmen",
    deleteDesc: "Hapus catatan komitmen sekali bayar ini dari periode terpilih?",
    deleteConfirm: "Hapus",
  },
  zh: {
    title: "单次承诺支出",
    subtitle:
      "适用于本发薪周期的单次刚性支出，如团建取消违约金或一次性费用，不计入债务分期与负债率（0% DSR）。",
    addBtn: "新增单次承诺",
    cancel: "取消",
    save: "保存承诺支出",
    saveEdit: "更新承诺支出",
    totalPlanned: "本周期承诺总额",
    paycheckUpfront: "发薪优先预扣",
    unpaidPending: "待支付金额",
    zeroDsrNote: "不计入负债率 (0% DSR)",
    fieldTitle: "项目名称",
    fieldTitlePlaceholder: "例如：团建大巴取消违约金",
    fieldAmount: "金额 (Rp)",
    fieldDueDate: "计划付款日期",
    fieldCategory: "类别",
    fieldSource: "资金来源",
    fieldNotes: "备注（可选）",
    empty: "本周期暂无单次承诺支出。",
    paid: "已支付",
    reserved: "已预留",
    unpaid: "未支付",
    deleteTitle: "删除单次承诺",
    deleteDesc: "确定要从当前周期移除这笔单次承诺支出吗？",
    deleteConfirm: "删除",
  },
};

export function OneOffCommitmentsPanel({
  month,
  year,
  isLocked = false,
}: OneOffCommitmentsPanelProps) {
  const { locale } = useLanguage();
  const { revisionTick, refreshPeriod } = usePeriod();
  const { isAmountsMasked } = usePrivacyMask();
  const { requireUnmasked } = usePrivacyGuard();
  const { confirmDialog } = useConfirmDialog();
  const { toast } = useToast();

  const t = COPY[locale] ?? COPY.en;
  const formatRp = (n: number) => formatRupiah(n, isAmountsMasked);

  const [data, setData] = useState<CommitmentsResponse>({
    items: [],
    summary: {
      totalRp: 0,
      paycheckUpfrontRp: 0,
      discretionaryRp: 0,
      bufferRp: 0,
      paidRp: 0,
      reservedRp: 0,
      unpaidRp: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const defaultDue = `${year}-${String(month).padStart(2, "0")}-${String(
    Math.min(28, getJakartaDateParts().day || 25)
  ).padStart(2, "0")}`;

  const [title, setTitle] = useState("");
  const [amountInput, setAmountInput] = useState("100.000");
  const [dueDate, setDueDate] = useState(defaultDue);
  const [category, setCategory] = useState<CommitmentCategory>("OUTING");
  const [fundingSource, setFundingSource] =
    useState<CommitmentFundingSource>("PAYCHECK_UPFRONT");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCommitments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCommitments(month, year);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void loadCommitments();
  }, [loadCommitments, revisionTick]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setAmountInput("100.000");
    setDueDate(defaultDue);
    setCategory("OUTING");
    setFundingSource("PAYCHECK_UPFRONT");
    setNotes("");
    setShowForm(false);
  };

  const handleOpenEdit = (item: PeriodCommitmentDto) => {
    if (!requireUnmasked(t.title)) return;
    setEditingId(item.id);
    setTitle(item.title);
    setAmountInput(formatCurrencyInput(String(item.amount)));
    setDueDate(String(item.dueDate).slice(0, 10));
    setCategory(item.category);
    setFundingSource(item.fundingSource);
    setNotes(item.notes ?? "");
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireUnmasked(t.title)) return;
    const amount = parseCurrencyInput(amountInput);
    if (!title.trim() || amount <= 0) return;

    setSaving(true);
    try {
      const res = editingId
        ? await updateCommitment(editingId, {
            title: title.trim(),
            category,
            amount,
            dueDate,
            fundingSource,
            notes: notes.trim() || undefined,
          })
        : await createCommitment({
            month,
            year,
            title: title.trim(),
            category,
            amount,
            dueDate,
            fundingSource,
            notes: notes.trim() || undefined,
          });
      if (!res.success) {
        toast({ title: t.title, description: res.error, variant: "error" });
        return;
      }
      resetForm();
      refreshPeriod();
      await loadCommitments();
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: number, status: CommitmentStatus) => {
    if (!requireUnmasked(t.title)) return;
    const res = await updateCommitmentStatus(id, status);
    if (!res.success) {
      toast({ title: t.title, description: res.error, variant: "error" });
      return;
    }
    refreshPeriod();
    await loadCommitments();
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
    const res = await deleteCommitment(id);
    if (!res.success) {
      toast({ title: t.title, description: res.error, variant: "error" });
      return;
    }
    refreshPeriod();
    await loadCommitments();
  };

  const getFundingLabel = (src: CommitmentFundingSource) => {
    const found = FUNDING_SOURCES.find((f) => f.key === src);
    if (!found) return src;
    return found[locale] ?? found.en;
  };

  return (
    <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-semibold font-sans text-text-primary">
              {t.title}
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-subtle border border-border-subtle text-delta-positive">
              {t.zeroDsrNote}
            </span>
          </div>
          <p className="text-xs font-sans text-text-secondary mt-1 max-w-2xl">
            {t.subtitle}
          </p>
        </div>
        {!isLocked && (
          <button
            type="button"
            onClick={() => {
              if (!requireUnmasked(t.addBtn)) return;
              if (showForm && editingId) {
                resetForm();
              } else {
                setShowForm((prev) => !prev);
              }
            }}
            className="erp-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-sans font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showForm ? t.cancel : t.addBtn}</span>
          </button>
        )}
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded border border-border-subtle bg-canvas px-3.5 py-2.5">
          <div className="text-[11px] font-sans text-text-tertiary">
            {t.totalPlanned}
          </div>
          <div className="text-base font-mono font-semibold tabular-nums text-text-primary mt-0.5">
            {formatRp(data.summary.totalRp)}
          </div>
        </div>
        <div className="rounded border border-border-subtle bg-canvas px-3.5 py-2.5">
          <div className="text-[11px] font-sans text-text-tertiary">
            {t.paycheckUpfront}
          </div>
          <div className="text-base font-mono font-semibold tabular-nums text-accent mt-0.5">
            {formatRp(data.summary.paycheckUpfrontRp)}
          </div>
        </div>
        <div className="rounded border border-border-subtle bg-canvas px-3.5 py-2.5">
          <div className="text-[11px] font-sans text-text-tertiary">
            {t.unpaidPending}
          </div>
          <div
            className={`text-base font-mono font-semibold tabular-nums mt-0.5 ${
              data.summary.unpaidRp > 0 ? "text-caution" : "text-delta-positive"
            }`}
          >
            {formatRp(data.summary.unpaidRp + data.summary.reservedRp)}
          </div>
        </div>
      </div>

      {/* Add / Edit Inline Form */}
      {showForm && !isLocked && (
        <form
          onSubmit={handleSave}
          className="rounded-lg border border-border bg-canvas p-4 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-sans text-text-secondary mb-1">
                {t.fieldTitle}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.fieldTitlePlaceholder}
                required
                className="w-full px-3 py-2 rounded border border-border bg-surface text-xs font-sans text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[11px] font-sans text-text-secondary mb-1">
                {t.fieldAmount}
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={amountInput}
                onChange={(e) => setAmountInput(formatCurrencyInput(e.target.value))}
                required
                className="w-full px-3 py-2 rounded border border-border bg-surface text-xs font-mono tabular-nums text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-[11px] font-sans text-text-secondary mb-1">
                {t.fieldDueDate}
              </label>
              <ErpDatePicker
                value={dueDate}
                onChange={setDueDate}
                ariaLabel={t.fieldDueDate}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] font-sans text-text-secondary mb-1.5">
                {t.fieldCategory}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-2.5 py-1 rounded text-[11px] font-sans border transition-colors cursor-pointer ${
                      category === cat
                        ? "border-accent bg-accent/15 text-text-primary font-medium"
                        : "border-border-subtle bg-surface text-text-tertiary hover:text-text-primary"
                    }`}
                  >
                    {CATEGORY_LABELS[cat][locale] ?? CATEGORY_LABELS[cat].en}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-sans text-text-secondary mb-1.5">
                {t.fieldSource}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FUNDING_SOURCES.map((src) => (
                  <button
                    key={src.key}
                    type="button"
                    onClick={() => setFundingSource(src.key)}
                    className={`px-2.5 py-1 rounded text-[11px] font-sans border transition-colors cursor-pointer ${
                      fundingSource === src.key
                        ? "border-accent bg-accent/15 text-text-primary font-medium"
                        : "border-border-subtle bg-surface text-text-tertiary hover:text-text-primary"
                    }`}
                  >
                    {src[locale] ?? src.en}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.fieldNotes}
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded border border-border bg-surface text-xs font-sans text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus:border-accent"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="erp-btn-secondary px-3 py-1.5 rounded text-xs font-sans cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="erp-btn-primary px-4 py-1.5 rounded text-xs font-sans font-medium cursor-pointer disabled:opacity-50"
              >
                {editingId ? t.saveEdit : t.save}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* List */}
      {loading && data.items.length === 0 ? (
        <div className="py-6 text-center text-xs font-sans text-text-tertiary">
          ...
        </div>
      ) : data.items.length === 0 ? (
        <div className="rounded border border-dashed border-border-subtle py-6 text-center text-xs font-sans text-text-tertiary">
          {t.empty}
        </div>
      ) : (
        <div className="divide-y divide-border-subtle border border-border-subtle rounded-lg">
          {data.items.map((item) => (
            <div
              key={item.id}
              className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-surface-hover/20"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold font-sans text-text-primary">
                    {item.title}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-surface-subtle border border-border-subtle text-text-secondary">
                    {CATEGORY_LABELS[item.category]?.[locale] ?? item.category}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-canvas border border-border-subtle text-text-tertiary">
                    {getFundingLabel(item.fundingSource)}
                  </span>
                </div>
                <div className="text-[11px] font-mono tabular-nums text-text-tertiary">
                  {String(item.dueDate).slice(0, 10)}
                  {item.notes ? ` · ${item.notes}` : ""}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                <span className="text-xs font-mono font-semibold tabular-nums text-text-primary">
                  {formatRp(item.amount)}
                </span>

                <div className="inline-flex items-center rounded border border-border bg-canvas p-0.5 text-[11px] font-sans">
                  {(["UNPAID", "RESERVED", "PAID"] as const).map((st) => {
                    const active = item.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleStatusChange(item.id, st)}
                        className={`px-2 py-0.5 rounded-sm transition-colors cursor-pointer disabled:opacity-40 inline-flex items-center gap-1 ${
                          active
                            ? st === "PAID"
                              ? "bg-[rgba(16,183,141,0.14)] text-delta-positive font-medium"
                              : st === "RESERVED"
                                ? "bg-caution/15 text-caution font-medium"
                                : "bg-surface-active text-text-primary font-medium"
                            : "text-text-tertiary hover:text-text-primary"
                        }`}
                      >
                        {st === "PAID" && <CheckCircle2 className="w-3 h-3" />}
                        {st === "RESERVED" && <Clock className="w-3 h-3" />}
                        <span>
                          {st === "PAID" ? t.paid : st === "RESERVED" ? t.reserved : t.unpaid}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {!isLocked && (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-subtle cursor-pointer"
                      aria-label={`Edit ${item.title}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded text-text-tertiary hover:text-urgency hover:bg-surface-subtle cursor-pointer"
                      aria-label={`Delete ${item.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
