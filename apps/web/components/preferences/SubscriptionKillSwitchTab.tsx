"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  EmailStatusResponse,
  GlobalConfig,
  KillSwitchItem,
  KillSwitchNotificationConfig,
  KillSwitchResponse,
  createKillSwitch,
  fetchKillSwitchNotificationConfig,
  fetchKillSwitches,
  sendKillSwitchReminder,
  updateGlobalConfig,
  updateKillSwitch,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useLanguage } from "@/context/LanguageContext";
import { Copy, ExternalLink, Eye, Plus, X } from "lucide-react";
import { SmtpControlPanel } from "./SmtpControlPanel";
import { ErpDatePicker } from "@/components/primitives/ErpDatePicker";

interface SubscriptionKillSwitchTabProps {
  config: GlobalConfig;
  activeMonth: number;
  activeYear: number;
  initialKillSwitches?: KillSwitchResponse | null;
  initialNotificationConfig?: KillSwitchNotificationConfig | null;
  initialEmailStatus?: EmailStatusResponse | null;
  hideSmtpPanel?: boolean;
}

const DEFAULT_KILL_SWITCH_TEMPLATE =
  "Notice: Promotional pricing for {{name}} expires on {{deadline}} ({{daysLeft}} remaining). To prevent automatic renewal at the standard rate of Rp {{normalPrice}}/month, cancel through your provider portal prior to cutoff: {{cancelUrl}}";

function getHMinus3Dates(promoEndDateStr: string): {
  startUtc: string;
  endUtc: string;
  deadlineStr: string;
} {
  const datePart = promoEndDateStr.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 3);

  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  // 19:00 WIB = 12:00 UTC -> 12:30 UTC
  const startUtc = `${yyyy}${mm}${dd}T120000Z`;
  const endUtc = `${yyyy}${mm}${dd}T123000Z`;
  return { startUtc, endUtc, deadlineStr: datePart };
}

function formatFormalDaysRemaining(daysLeft: number | null | undefined): string {
  if (daysLeft === null || daysLeft === undefined) return "Pending schedule";
  if (daysLeft < 0) {
    const abs = Math.abs(daysLeft);
    return `${abs} day${abs === 1 ? "" : "s"} overdue`;
  }
  if (daysLeft === 0) return "due today (0 days)";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
}

function buildGoogleCalendarUrl(item: KillSwitchItem): string | null {
  if (!item.promoEndDate) return null;
  const { startUtc, endUtc, deadlineStr } = getHMinus3Dates(item.promoEndDate);
  const title = `[Renewal Notice] Subscription Cancellation Deadline: ${item.label}`;
  const normalPrice = (item.postPromoNormalAmount || item.amount).toLocaleString("id-ID");
  const details =
    `Notice: Cancel ${item.label} prior to ${deadlineStr} to avoid automatic renewal at the standard rate of Rp ${normalPrice}/month.\n\n` +
    `Cancellation Portal: ${item.providerCancelUrl || "Provider Account Settings"}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${startUtc}/${endUtc}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function downloadIcsFile(item: KillSwitchItem) {
  if (!item.promoEndDate) return;
  const { startUtc, endUtc, deadlineStr } = getHMinus3Dates(item.promoEndDate);
  const normalPrice = (item.postPromoNormalAmount || item.amount).toLocaleString("id-ID");
  const summary = `[Renewal Notice] Subscription Cancellation: ${item.label}`;
  const description =
    `Promotional period expires ${deadlineStr}. Cancel before cutoff to prevent standard billing at Rp ${normalPrice}/mo. Portal: ${item.providerCancelUrl || "Provider Account Settings"}`;

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sunday Funday ERP//Renewal Alert//EN",
    "BEGIN:VEVENT",
    `UID:killswitch-${item.id}@sundayfunday-erp.local`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    item.providerCancelUrl ? `URL:${item.providerCancelUrl}` : "",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:Cancellation deadline for ${item.label}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  const blob = new Blob([icsLines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = item.label.toLowerCase().replace(/[^a-z0-9]/g, "-");
  a.download = `killswitch-${safeName}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderFormalNoticeText(template: string, item?: KillSwitchItem | null): string {
  const trimmed = template.trim();
  const tpl =
    trimmed.length > 0 && !trimmed.toLowerCase().startsWith("woi gab")
      ? trimmed
      : DEFAULT_KILL_SWITCH_TEMPLATE;
  const name = item?.label || "Sample Subscription";
  const deadline = item?.promoEndDate ? item.promoEndDate.split("T")[0] : "2027-01-27";
  const daysLeft = formatFormalDaysRemaining(item?.daysUntilExpiry ?? 14);
  const normalPrice = (item?.postPromoNormalAmount || item?.amount || 309000).toLocaleString("id-ID");
  const cancelUrl = item?.providerCancelUrl || "Provider Account Settings";
  const currentPrice = (item?.amount || 0).toLocaleString("id-ID");

  return tpl
    .replace(/\{\{\s*name\s*\}\}/g, name)
    .replace(/\{\{\s*deadline\s*\}\}/g, deadline)
    .replace(/\{\{\s*daysLeft\s*\}\}/g, daysLeft)
    .replace(/\{\{\s*normalPrice\s*\}\}/g, normalPrice)
    .replace(/\{\{\s*cancelUrl\s*\}\}/g, cancelUrl)
    .replace(/\{\{\s*currentPrice\s*\}\}/g, currentPrice);
}

export function SubscriptionKillSwitchTab({
  config,
  activeMonth,
  activeYear,
  initialKillSwitches,
  initialNotificationConfig,
  initialEmailStatus,
  hideSmtpPanel = false,
}: SubscriptionKillSwitchTabProps) {
  const { locale } = useLanguage();
  const { isAmountsMasked } = usePrivacyMask();
  const formDialogRef = useRef<HTMLDialogElement | null>(null);
  const noticeDialogRef = useRef<HTMLDialogElement | null>(null);

  const [loading, setLoading] = useState(initialKillSwitches === undefined);
  const [data, setData] = useState<KillSwitchResponse | null>(initialKillSwitches ?? null);

  // Global Renewal Alert Guard Settings
  const [bannerEnabled, setBannerEnabled] = useState(
    initialKillSwitches?.config.killSwitchBannerEnabled ??
      config.killSwitchBannerEnabled ??
      true,
  );
  const [leadDays, setLeadDays] = useState(
    initialKillSwitches?.config.killSwitchLeadDays ?? config.killSwitchLeadDays ?? 14,
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState<string | null>(null);

  // Formal Notice Template State
  const [customTemplate, setCustomTemplate] = useState<string>(() => {
    const raw = initialNotificationConfig?.killSwitchCustomMessageTemplate?.trim() ?? "";
    return raw.length > 0 && !raw.toLowerCase().startsWith("woi gab") ? raw : "";
  });
  const [copiedNoticeId, setCopiedNoticeId] = useState<number | null>(null);
  const [previewingNoticeItem, setPreviewingNoticeItem] = useState<KillSwitchItem | null>(null);

  // Per-row reminder / action feedback
  const [remindingId, setRemindingId] = useState<number | null>(null);
  const [reminderFeedback, setReminderFeedback] = useState<{
    id: number;
    success: boolean;
    text: string;
  } | null>(null);
  const [actionProcessingId, setActionProcessingId] = useState<number | null>(null);

  // Add / Edit Native Dialog Form State
  const [editingItem, setEditingItem] = useState<KillSwitchItem | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formPromoLabel, setFormPromoLabel] = useState("");
  const [formPromoEndDate, setFormPromoEndDate] = useState("");
  const [formNormalAmount, setFormNormalAmount] = useState<number>(0);
  const [formCancelUrl, setFormCancelUrl] = useState("");
  const [formKillSwitchEnabled, setFormKillSwitchEnabled] = useState(true);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [res, notifRes] = await Promise.all([
      fetchKillSwitches(),
      fetchKillSwitchNotificationConfig(),
    ]);
    if (res) {
      setData(res);
      setBannerEnabled(res.config.killSwitchBannerEnabled);
      setLeadDays(res.config.killSwitchLeadDays);
    }
    if (notifRes) {
      const raw = notifRes.killSwitchCustomMessageTemplate?.trim() ?? "";
      if (raw.length > 0 && !raw.toLowerCase().startsWith("woi gab")) {
        setCustomTemplate(raw);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (initialKillSwitches === undefined) {
      loadData();
    }
  }, [initialKillSwitches]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsSavedMessage(null);
    const res = await updateGlobalConfig({
      killSwitchBannerEnabled: bannerEnabled,
      killSwitchLeadDays: leadDays,
    });
    setSavingSettings(false);
    if (res.success) {
      setSettingsSavedMessage("Alert guard thresholds updated.");
      setTimeout(() => setSettingsSavedMessage(null), 3000);
      loadData();
    }
  };

  const openAddDialog = () => {
    setEditingItem(null);
    setFormLabel("");
    setFormAmount(0);
    setFormPromoLabel("");
    setFormPromoEndDate("2027-01-27");
    setFormNormalAmount(309000);
    setFormCancelUrl("");
    setFormKillSwitchEnabled(true);
    setFormError(null);
    formDialogRef.current?.showModal();
  };

  const openEditDialog = (item: KillSwitchItem) => {
    setEditingItem(item);
    setFormLabel(item.label);
    setFormAmount(item.amount);
    setFormPromoLabel(item.promoLabel || "");
    setFormPromoEndDate(item.promoEndDate ? item.promoEndDate.split("T")[0] : "");
    setFormNormalAmount(item.postPromoNormalAmount || item.amount || 0);
    setFormCancelUrl(item.providerCancelUrl || "");
    setFormKillSwitchEnabled(item.killSwitchEnabled);
    setFormError(null);
    formDialogRef.current?.showModal();
  };

  const closeFormDialog = () => {
    if (formDialogRef.current?.open) {
      formDialogRef.current.close();
    }
  };

  const openNoticePreviewDialog = (item: KillSwitchItem) => {
    setPreviewingNoticeItem(item);
    noticeDialogRef.current?.showModal();
  };

  const closeNoticeDialog = () => {
    if (noticeDialogRef.current?.open) {
      noticeDialogRef.current.close();
    }
  };

  const handleCopyFormalNotice = async (item: KillSwitchItem) => {
    const notice = renderFormalNoticeText(customTemplate, item);
    try {
      await navigator.clipboard.writeText(notice);
      setCopiedNoticeId(item.id);
      setTimeout(() => setCopiedNoticeId(null), 2000);
    } catch {
      openNoticePreviewDialog(item);
    }
  };

  const handleSubmitKillSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabel.trim()) {
      setFormError("Service label is required.");
      return;
    }
    if (!formPromoEndDate) {
      setFormError("Cancellation deadline date is required.");
      return;
    }
    setSubmittingForm(true);
    setFormError(null);

    if (editingItem) {
      const res = await updateKillSwitch(editingItem.id, {
        label: formLabel.trim(),
        amount: Number(formAmount),
        promoLabel: formPromoLabel.trim() || undefined,
        promoEndDate: formPromoEndDate,
        postPromoNormalAmount: Number(formNormalAmount),
        providerCancelUrl: formCancelUrl.trim() || undefined,
        killSwitchEnabled: formKillSwitchEnabled,
      });
      setSubmittingForm(false);
      if (res.success) {
        closeFormDialog();
        loadData();
      } else {
        setFormError(res.error || "Failed to update monitored subscription.");
      }
    } else {
      const res = await createKillSwitch({
        label: formLabel.trim(),
        amount: Number(formAmount),
        promoLabel: formPromoLabel.trim() || undefined,
        promoEndDate: formPromoEndDate,
        postPromoNormalAmount: Number(formNormalAmount),
        providerCancelUrl: formCancelUrl.trim() || undefined,
        killSwitchEnabled: formKillSwitchEnabled,
      });
      setSubmittingForm(false);
      if (res.success) {
        closeFormDialog();
        loadData();
      } else {
        setFormError(res.error || "Failed to arm subscription kill-switch.");
      }
    }
  };

  const handleConfirmCancel = async (item: KillSwitchItem) => {
    setActionProcessingId(item.id);
    const res = await updateKillSwitch(item.id, {
      providerCancelConfirmed: true,
      autoStopAfterPromo: true,
    });
    setActionProcessingId(null);
    if (res.success) {
      loadData();
    }
  };

  const handleRearm = async (item: KillSwitchItem) => {
    setActionProcessingId(item.id);
    const res = await updateKillSwitch(item.id, {
      providerCancelConfirmed: false,
      killSwitchEnabled: true,
    });
    setActionProcessingId(null);
    if (res.success) {
      loadData();
    }
  };

  const handleSendReminderRow = async (item: KillSwitchItem) => {
    setRemindingId(item.id);
    setReminderFeedback(null);
    const res = await sendKillSwitchReminder(item.id);
    setRemindingId(null);

    if (res.success) {
      const sentChannels: string[] = [];
      if (res.channels?.email) sentChannels.push("Email");
      if (res.channels?.webhook) sentChannels.push("Webhook");
      const text =
        sentChannels.length > 0
          ? `Notice sent via ${sentChannels.join(" & ")}`
          : "Notice generated (preview mode - add Gmail App Password below to dispatch SMTP)";
      setReminderFeedback({ id: item.id, success: true, text });
      loadData();
    } else {
      setReminderFeedback({
        id: item.id,
        success: false,
        text:
          res.channels?.emailError ||
          res.channels?.webhookError ||
          res.error ||
          "Unable to dispatch cancellation notice.",
      });
    }
  };

  const items = data?.items || [];
  const activeRecurringItems = items.filter((i) => !i.providerCancelConfirmed && i.isActive);
  const actionRequiredCount = items.filter((i) => i.alertState === "ACTION_REQUIRED").length;
  const monthlyRecurringBurn = activeRecurringItems.reduce((sum, i) => sum + i.amount, 0);
  const monthlyPenaltyExposure = activeRecurringItems.reduce(
    (sum, i) => sum + Math.max(i.monthlyPenaltyDelta, i.postPromoNormalAmount ?? i.amount),
    0,
  );
  const annualizedExposure = monthlyPenaltyExposure * 12;
  const sampleItemForPreview = items.length > 0 ? items[0] : null;
  const formatRp = (val: number) => formatRupiah(val, isAmountsMasked);
  const apiLocale = (locale?.toUpperCase() || "EN") as "EN" | "ID" | "ZH";

  return (
    <div className="space-y-6">
      {/* Executive Burn & Exposure Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4 flex flex-col justify-between">
          <div className="text-[11px] font-sans text-text-tertiary">
            Active Recurring Guards
          </div>
          <div className="text-2xl font-mono font-semibold tabular-nums text-text-primary mt-1.5">
            {activeRecurringItems.length}
            <span className="text-xs font-normal text-text-tertiary ml-1.5">
              / {items.length} tracked
            </span>
          </div>
          <div className="text-[11px] font-sans text-text-secondary mt-1">
            {actionRequiredCount > 0
              ? `${actionRequiredCount} inside H-${leadDays} cancellation window`
              : "All promo cutoffs clear"}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 flex flex-col justify-between">
          <div className="text-[11px] font-sans text-text-tertiary">
            Monthly Promo Cost
          </div>
          <div className="text-2xl font-mono font-semibold tabular-nums text-text-primary mt-1.5">
            {formatRp(monthlyRecurringBurn)}
          </div>
          <div className="text-[11px] font-sans text-text-secondary mt-1">
            Current discounted / trial billing rate
          </div>
        </div>

        <div className="rounded-lg border border-border-strong bg-surface p-4 flex flex-col justify-between">
          <div className="text-[11px] font-sans text-text-tertiary">
            Post-Promo Monthly Exposure
          </div>
          <div className="text-3xl font-display font-normal text-text-primary mt-1">
            {formatRp(monthlyPenaltyExposure)}
          </div>
          <div className="text-[11px] font-sans text-text-secondary mt-1">
            Unmitigated standard monthly charge
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 flex flex-col justify-between">
          <div className="text-[11px] font-sans text-text-tertiary">
            Annualized Liability Exposure
          </div>
          <div className="text-2xl font-mono font-semibold tabular-nums text-caution mt-1.5">
            {formatRp(annualizedExposure)}
          </div>
          <div className="text-[11px] font-sans text-text-secondary mt-1">
            12-month cost if promos lapse uncanceled
          </div>
        </div>
      </div>

      {/* Global Renewal Alert Threshold Configuration */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold font-sans text-text-primary">
              Renewal Alert Window &amp; Banner Policy
            </h2>
            <p className="text-xs font-sans text-text-tertiary mt-0.5">
              Escalates monitored trials and promotional charges onto the Overview banner prior to automatic provider renewal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bannerEnabled}
                onChange={(e) => setBannerEnabled(e.target.checked)}
                className="rounded border-border bg-canvas text-accent focus:ring-0"
              />
              Overview escalation banner enabled
            </label>

            <div className="flex items-center gap-2">
              <label htmlFor="ks-lead-days" className="text-xs text-text-tertiary">
                Lead window
              </label>
              <select
                id="ks-lead-days"
                value={leadDays}
                onChange={(e) => setLeadDays(Number(e.target.value))}
                className="px-2.5 py-1 rounded bg-canvas border border-border text-text-primary text-xs font-mono"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={21}>21 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>

            <button
              type="button"
              disabled={savingSettings}
              onClick={handleSaveSettings}
              className="px-3 py-1.5 rounded text-xs font-medium bg-surface-elevated hover:bg-surface-active text-text-primary border border-border-strong transition-colors disabled:opacity-50 cursor-pointer"
            >
              {savingSettings ? "Saving..." : "Apply Policy"}
            </button>
          </div>
        </div>
        {settingsSavedMessage && (
          <div className="mt-3 text-xs font-mono text-delta-positive">{settingsSavedMessage}</div>
        )}
      </div>

      {/* Monitored Promotional & Recurring Commitments Ledger */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-subtle flex flex-wrap items-center justify-between gap-3 bg-surface-subtle/40">
          <div>
            <h2 className="text-sm font-semibold font-sans text-text-primary">
              Promotional &amp; Auto-Renew Watchlist
            </h2>
            <p className="text-xs font-sans text-text-tertiary mt-0.5">
              Review upcoming expiration cutoffs, inspect generated cancellation notices, or record provider confirmation.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddDialog}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium erp-btn-primary hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Track Promotional Guard
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs font-sans text-text-tertiary">
            Loading monitored promotional commitments...
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-xs font-sans text-text-tertiary">
            No promotional trials or auto-renew subscriptions are currently armed for renewal tracking.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-subtle text-[11px] font-sans font-medium text-text-tertiary">
                  <th className="py-2.5 px-4">Service &amp; Plan</th>
                  <th className="py-2.5 px-3">Current Rate</th>
                  <th className="py-2.5 px-3">Post-Promo Rate</th>
                  <th className="py-2.5 px-3">Monthly Risk</th>
                  <th className="py-2.5 px-3">Cutoff Deadline</th>
                  <th className="py-2.5 px-3">Guard State</th>
                  <th className="py-2.5 px-4 text-right">Cancellation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {items.map((item) => {
                  const isProcessing = actionProcessingId === item.id;
                  const isReminding = remindingId === item.id;
                  const daysLeft = item.daysUntilExpiry;
                  const gCalUrl = buildGoogleCalendarUrl(item);
                  const itemFeedback = reminderFeedback?.id === item.id ? reminderFeedback : null;

                  return (
                    <tr key={item.id} className="hover:bg-surface-subtle/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-text-primary">{item.label}</div>
                        <div className="text-[11px] text-text-tertiary mt-0.5">
                          {item.promoLabel || "Promotional Billing"}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono tabular-nums text-text-secondary whitespace-nowrap">
                        {item.amount === 0 ? "Rp 0 (Trial)" : formatRp(item.amount)}/mo
                      </td>

                      <td className="py-3 px-3 font-mono tabular-nums text-text-primary whitespace-nowrap">
                        {item.postPromoNormalAmount ? `${formatRp(item.postPromoNormalAmount)}/mo` : "-"}
                      </td>

                      <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                        {item.monthlyPenaltyDelta > 0 ? (
                          <span className="text-delta-negative">
                            +{formatRp(item.monthlyPenaltyDelta)}/mo
                          </span>
                        ) : (
                          <span className="text-text-tertiary">None</span>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.promoEndDate ? (
                          <div>
                            <div className="font-mono tabular-nums text-text-primary">
                              {item.promoEndDate.split("T")[0]}
                            </div>
                            <div
                              className={`text-[11px] font-mono tabular-nums ${
                                daysLeft !== null && daysLeft <= leadDays
                                  ? "text-urgency"
                                  : "text-text-tertiary"
                              }`}
                            >
                              {formatFormalDaysRemaining(daysLeft)}
                            </div>
                          </div>
                        ) : (
                          <span className="font-mono text-text-tertiary">Unscheduled</span>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                            item.statusLabel === "SAFE"
                              ? "border-delta-positive/30 bg-[rgba(16,183,141,0.10)] text-delta-positive"
                              : item.statusLabel === "CRITICAL"
                                ? "border-urgency/35 bg-[rgba(255,56,56,0.10)] text-urgency"
                                : "border-border bg-surface-subtle text-text-secondary"
                          }`}
                        >
                          {item.statusLabel}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openNoticePreviewDialog(item)}
                              title="Inspect formal cancellation notice"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-sans bg-surface-subtle hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              Notice
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyFormalNotice(item)}
                              title="Copy formal English cancellation notice"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-sans bg-surface-subtle hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                              {copiedNoticeId === item.id ? "Copied" : "Copy"}
                            </button>

                            {item.providerCancelUrl && (
                              <a
                                href={item.providerCancelUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-sans bg-surface-subtle hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border"
                              >
                                Portal
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}

                            {gCalUrl && (
                              <a
                                href={gCalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 rounded text-[10px] font-mono bg-surface-subtle hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border"
                              >
                                + GCal
                              </a>
                            )}

                            {item.promoEndDate && (
                              <button
                                type="button"
                                onClick={() => downloadIcsFile(item)}
                                className="px-2 py-1 rounded text-[10px] font-mono bg-surface-subtle hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border cursor-pointer"
                              >
                                .ics
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleSendReminderRow(item)}
                              disabled={isReminding}
                              className="px-2 py-1 rounded text-[11px] font-medium bg-surface-elevated hover:bg-surface-active text-text-primary border border-border-strong disabled:opacity-50 cursor-pointer"
                            >
                              {isReminding ? "Sending..." : "Send Notice"}
                            </button>

                            {!item.providerCancelConfirmed ? (
                              <button
                                type="button"
                                onClick={() => handleConfirmCancel(item)}
                                disabled={isProcessing}
                                className="px-2 py-1 rounded text-[11px] font-medium bg-surface-active text-text-primary border border-border-strong hover:opacity-90 disabled:opacity-50 cursor-pointer"
                              >
                                {isProcessing ? "..." : "Mark Canceled"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRearm(item)}
                                disabled={isProcessing}
                                className="px-2 py-1 rounded text-[11px] font-medium bg-surface-subtle text-text-tertiary hover:text-text-primary border border-border disabled:opacity-50 cursor-pointer"
                              >
                                Rearm
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openEditDialog(item)}
                              className="px-2 py-1 rounded text-[11px] font-sans text-text-tertiary hover:text-text-primary hover:bg-surface-subtle cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>

                          {itemFeedback && (
                            <div
                              className={`text-[11px] font-mono ${
                                itemFeedback.success ? "text-delta-positive" : "text-urgency"
                              }`}
                            >
                              {itemFeedback.text}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formal Cancellation Notice Template Configuration */}
      <section className="rounded-lg border border-border bg-surface p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-text-secondary">
              Formal Cancellation Notice Template (English Business Copy)
            </h3>
            <p className="text-[11px] text-text-tertiary mt-0.5">
              Supported tokens: <code className="font-mono">{"{{name}}"}</code>,{" "}
              <code className="font-mono">{"{{deadline}}"}</code>,{" "}
              <code className="font-mono">{"{{daysLeft}}"}</code>,{" "}
              <code className="font-mono">{"{{normalPrice}}"}</code>,{" "}
              <code className="font-mono">{"{{cancelUrl}}"}</code>. Saved together with SMTP settings below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCustomTemplate("")}
            className="text-[11px] font-mono text-text-tertiary hover:text-text-primary cursor-pointer"
          >
            Reset to Standard English Template
          </button>
        </div>

        <textarea
          rows={3}
          value={customTemplate}
          onChange={(e) => setCustomTemplate(e.target.value)}
          placeholder={DEFAULT_KILL_SWITCH_TEMPLATE}
          className="w-full px-3 py-2 rounded bg-canvas border border-border text-text-primary text-xs font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-border-strong"
        />

        <div className="rounded border border-border-subtle bg-canvas px-3.5 py-2.5 text-xs text-text-secondary">
          <div className="text-[10px] font-mono text-text-tertiary mb-1">
            Rendered Preview ({sampleItemForPreview?.label || "Sample Subscription"})
          </div>
          {renderFormalNoticeText(customTemplate, sampleItemForPreview)}
        </div>
      </section>

      {/* Dedicated SMTP & Email Delivery Control Panel */}
      {!hideSmtpPanel && (
        <SmtpControlPanel
          initialNotifConfig={initialNotificationConfig}
          initialEmailStatus={initialEmailStatus}
          customTemplate={customTemplate}
          defaultLocale={apiLocale}
          activeMonth={activeMonth}
          activeYear={activeYear}
        />
      )}

      {/* Native <dialog>: Add / Edit Renewal Alert Form */}
      <dialog
        ref={formDialogRef}
        aria-labelledby="ks-form-dialog-title"
        onClick={(e) => {
          if (e.target === formDialogRef.current) {
            closeFormDialog();
          }
        }}
        className="erp-dialog max-w-lg shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-surface-subtle">
          <h3 id="ks-form-dialog-title" className="text-sm font-semibold text-text-primary">
            {editingItem ? "Edit Promotional Guard" : "Track Promotional Subscription"}
          </h3>
          <button
            type="button"
            onClick={closeFormDialog}
            aria-label="Close subscription modal"
            className="p-1.5 rounded text-text-tertiary hover:text-text-primary cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmitKillSwitch} className="p-5 space-y-4 text-xs">
          {formError && (
            <div className="p-2.5 rounded border border-urgency/30 bg-[rgba(255,56,56,0.08)] text-urgency">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-text-secondary font-medium block">Service Name *</label>
              <input
                type="text"
                required
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g. Gemini AI Pro"
                className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-text-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-text-secondary font-medium block">Plan / Promo Tier</label>
              <input
                type="text"
                value={formPromoLabel}
                onChange={(e) => setFormPromoLabel(e.target.value)}
                placeholder="e.g. 3-Month Trial Guard"
                className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-text-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-text-secondary font-medium block">Current Rate (Rp)</label>
              <input
                type="number"
                min="0"
                value={formAmount}
                onChange={(e) => setFormAmount(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-text-primary font-mono tabular-nums"
              />
            </div>

            <div className="space-y-1">
              <label className="text-text-secondary font-medium block">
                Post-Promo Standard Rate (Rp) *
              </label>
              <input
                type="number"
                min="0"
                required
                value={formNormalAmount}
                onChange={(e) => setFormNormalAmount(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-text-primary font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-text-secondary font-medium block">Deadline Date *</label>
              <ErpDatePicker
                value={formPromoEndDate}
                onChange={setFormPromoEndDate}
                ariaLabel="Deadline Date"
              />
            </div>

            <div className="space-y-1">
              <label className="text-text-secondary font-medium block">
                Cancellation Portal URL
              </label>
              <input
                type="url"
                value={formCancelUrl}
                onChange={(e) => setFormCancelUrl(e.target.value)}
                placeholder="https://one.google.com/settings"
                className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-text-primary font-mono"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-text-secondary select-none cursor-pointer">
            <input
              type="checkbox"
              checked={formKillSwitchEnabled}
              onChange={(e) => setFormKillSwitchEnabled(e.target.checked)}
              className="rounded border-border bg-canvas text-accent focus:ring-0"
            />
            Arm automated renewal escalation
          </label>

          <div className="pt-3 border-t border-border-subtle flex justify-end gap-2">
            <button
              type="button"
              onClick={closeFormDialog}
              className="px-3 py-1.5 rounded border border-border bg-surface-subtle text-text-secondary hover:text-text-primary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingForm}
              className="px-4 py-1.5 rounded erp-btn-primary font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {submittingForm
                ? "Saving..."
                : editingItem
                  ? "Update Subscription"
                  : "Set Renewal Alert"}
            </button>
          </div>
        </form>
      </dialog>

      {/* Native <dialog>: Formal Notice Preview Modal */}
      <dialog
        ref={noticeDialogRef}
        aria-labelledby="ks-notice-dialog-title"
        onClick={(e) => {
          if (e.target === noticeDialogRef.current) {
            closeNoticeDialog();
          }
        }}
        className="erp-dialog max-w-xl shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-surface-subtle">
          <h3 id="ks-notice-dialog-title" className="text-sm font-semibold text-text-primary">
            Cancellation Notice - {previewingNoticeItem?.label || "Subscription"}
          </h3>
          <button
            type="button"
            onClick={closeNoticeDialog}
            aria-label="Close notice preview"
            className="p-1.5 rounded text-text-tertiary hover:text-text-primary cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {previewingNoticeItem && (
          <div className="p-5 space-y-4 text-xs">
            <div className="rounded border border-border-subtle bg-canvas p-3.5 font-sans text-text-primary leading-relaxed">
              {renderFormalNoticeText(customTemplate, previewingNoticeItem)}
            </div>
            <div className="grid grid-cols-2 gap-3 font-mono text-[11px] text-text-secondary">
              <div>
                Deadline: {previewingNoticeItem.promoEndDate?.split("T")[0] || "Unscheduled"}
              </div>
              <div>
                Standard Rate:{" "}
                {formatRp(
                  previewingNoticeItem.postPromoNormalAmount ?? previewingNoticeItem.amount,
                )}
                /mo
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => handleCopyFormalNotice(previewingNoticeItem)}
                className="px-3 py-1.5 rounded border border-border bg-surface-elevated text-text-primary cursor-pointer"
              >
                {copiedNoticeId === previewingNoticeItem.id ? "Copied" : "Copy Notice Text"}
              </button>
              <button
                type="button"
                onClick={closeNoticeDialog}
                className="px-3 py-1.5 rounded erp-btn-primary font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
