"use client";

import React, { useState, useEffect } from "react";
import {
  GlobalConfig,
  KillSwitchItem,
  KillSwitchResponse,
  KillSwitchNotificationConfig,
  UpdateKillSwitchNotificationConfigInput,
  fetchKillSwitches,
  createKillSwitch,
  updateKillSwitch,
  updateGlobalConfig,
  fetchKillSwitchNotificationConfig,
  updateKillSwitchNotificationConfig,
  sendKillSwitchReminder,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

const DEFAULT_KILL_SWITCH_TEMPLATE =
  "Woi Gab, inget batalin langganan {{name}} sebelum {{deadline}} ({{daysLeft}} hari lagi) biar CC lu ga ke-charge normal Rp {{normalPrice}}/bln! Langsung klik cancel sekarang di: {{cancelUrl}}";

interface SubscriptionKillSwitchTabProps {
  config: GlobalConfig;
}

function getHMinus3Dates(promoEndDateStr: string) {
  const datePart = promoEndDateStr.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  // H-3 at 19:00 WIB (12:00:00 UTC)
  const h3Date = new Date(Date.UTC(y, m - 1, d - 3, 12, 0, 0));
  const endDate = new Date(Date.UTC(y, m - 1, d - 3, 12, 30, 0));

  const pad = (n: number) => String(n).padStart(2, "0");
  const formatIsoUtc = (date: Date) =>
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
      date.getUTCHours()
    )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;

  return {
    startUtc: formatIsoUtc(h3Date),
    endUtc: formatIsoUtc(endDate),
    deadlineStr: datePart,
  };
}

function buildGoogleCalendarUrl(item: KillSwitchItem): string | null {
  if (!item.promoEndDate) return null;
  const { startUtc, endUtc, deadlineStr } = getHMinus3Dates(item.promoEndDate);
  const title = `[Kill-Switch] Batalin Langganan ${item.label}`;
  const normalPrice = (item.postPromoNormalAmount || item.amount).toLocaleString("id-ID");
  const details = `Woi Gab, inget batalin langganan ${item.label} sebelum ${deadlineStr} biar CC lu ga ke-charge normal Rp ${normalPrice}/bln!\n\nLink Cancel: ${
    item.providerCancelUrl || "N/A"
  }`;
  const location = item.providerCancelUrl || "";

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${startUtc}/${endUtc}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(
    location
  )}`;
}

function downloadIcsFile(item: KillSwitchItem) {
  if (!item.promoEndDate) return;
  const { startUtc, endUtc, deadlineStr } = getHMinus3Dates(item.promoEndDate);
  const nowUtc = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const title = `[Kill-Switch] Batalin Langganan ${item.label}`;
  const normalPrice = (item.postPromoNormalAmount || item.amount).toLocaleString("id-ID");
  const details = `Woi Gab, inget batalin langganan ${item.label} sebelum ${deadlineStr} biar CC lu ga ke-charge normal Rp ${normalPrice}/bln!\\n\\nLink Cancel: ${
    item.providerCancelUrl || "N/A"
  }`;
  const location = item.providerCancelUrl || "";

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MondayMonday ERP//Kill-Switch Reminder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:killswitch-${item.id}@mondaymonday.local`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${details}`,
    `LOCATION:${location}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT0M",
    "ACTION:DISPLAY",
    `DESCRIPTION:Reminder: Batalin ${item.label} sekarang!`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

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

function renderMessagePreview(template: string, sampleItem?: KillSwitchItem | null): string {
  const tpl = template && template.trim().length > 0 ? template.trim() : DEFAULT_KILL_SWITCH_TEMPLATE;
  const name = sampleItem?.label || "Gemini AI Pro";
  const deadline = sampleItem?.promoEndDate
    ? sampleItem.promoEndDate.split("T")[0]
    : "2027-01-27";
  const daysLeft =
    sampleItem?.daysUntilExpiry !== undefined && sampleItem.daysUntilExpiry !== null
      ? sampleItem.daysUntilExpiry <= 0
        ? "HARI INI"
        : `${sampleItem.daysUntilExpiry}`
      : "14";
  const normalPrice = (sampleItem?.postPromoNormalAmount || 309000).toLocaleString("id-ID");
  const cancelUrl = sampleItem?.providerCancelUrl || "https://one.google.com/settings";
  const currentPrice = (sampleItem?.amount || 0).toLocaleString("id-ID");

  return tpl
    .replace(/\{\{\s*name\s*\}\}/g, name)
    .replace(/\{\{\s*deadline\s*\}\}/g, deadline)
    .replace(/\{\{\s*daysLeft\s*\}\}/g, daysLeft)
    .replace(/\{\{\s*normalPrice\s*\}\}/g, normalPrice)
    .replace(/\{\{\s*cancelUrl\s*\}\}/g, cancelUrl)
    .replace(/\{\{\s*currentPrice\s*\}\}/g, currentPrice);
}

export function SubscriptionKillSwitchTab({ config }: SubscriptionKillSwitchTabProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<KillSwitchResponse | null>(null);

  // Card A: Global Alert Settings
  const [bannerEnabled, setBannerEnabled] = useState(config.killSwitchBannerEnabled ?? true);
  const [leadDays, setLeadDays] = useState(config.killSwitchLeadDays ?? 14);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState<string | null>(null);

  // Card C: External Notification Channels State
  const [notifyEmail, setNotifyEmail] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpAppPassword, setSmtpAppPassword] = useState("");
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [hasSmtpPassword, setHasSmtpPassword] = useState(false);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [waApiKey, setWaApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasWaApiKey, setHasWaApiKey] = useState(false);

  const [customTemplate, setCustomTemplate] = useState("");

  const [savingChannels, setSavingChannels] = useState(false);
  const [channelSuccessMsg, setChannelSuccessMsg] = useState<string | null>(null);
  const [channelErrorMsg, setChannelErrorMsg] = useState<string | null>(null);

  // Per-row reminders & actions feedback
  const [remindingId, setRemindingId] = useState<number | null>(null);
  const [reminderFeedback, setReminderFeedback] = useState<{
    id: number;
    success: boolean;
    text: string;
  } | null>(null);
  const [actionProcessingId, setActionProcessingId] = useState<number | null>(null);

  // Modal State for Add / Edit
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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
      setNotifyEmail(notifRes.killSwitchNotifyEmail || "");
      setSmtpUser(notifRes.killSwitchSmtpUser || "");
      setHasSmtpPassword(notifRes.hasSmtpPassword);
      setWebhookUrl(notifRes.killSwitchWebhookUrl || "");
      setWaPhone(notifRes.killSwitchWaPhone || "");
      setHasWaApiKey(notifRes.hasWaApiKey);
      setCustomTemplate(notifRes.killSwitchCustomMessageTemplate || "");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Keyboard ergonomics: Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAddModalOpen) {
        setIsAddModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAddModalOpen]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsSavedMessage(null);
    const res = await updateGlobalConfig({
      killSwitchBannerEnabled: bannerEnabled,
      killSwitchLeadDays: leadDays,
    });
    setSavingSettings(false);
    if (res.success) {
      setSettingsSavedMessage("Alert preferences saved.");
      setTimeout(() => setSettingsSavedMessage(null), 3000);
      loadData();
    }
  };

  const handleSaveChannelSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingChannels(true);
    setChannelSuccessMsg(null);
    setChannelErrorMsg(null);

    const payload: UpdateKillSwitchNotificationConfigInput = {
      killSwitchNotifyEmail: notifyEmail.trim() || undefined,
      killSwitchSmtpUser: smtpUser.trim() || undefined,
      killSwitchWebhookUrl: webhookUrl.trim() || undefined,
      killSwitchWaPhone: waPhone.trim() || undefined,
      killSwitchCustomMessageTemplate: customTemplate.trim() || undefined,
    };

    if (smtpAppPassword.trim()) {
      payload.killSwitchSmtpAppPassword = smtpAppPassword.trim();
    }
    if (waApiKey.trim()) {
      payload.killSwitchWaApiKey = waApiKey.trim();
    }

    const res = await updateKillSwitchNotificationConfig(payload);
    setSavingChannels(false);

    if (res.success) {
      setChannelSuccessMsg("Notification channel settings saved.");
      setSmtpAppPassword("");
      setWaApiKey("");
      if (res.data) {
        setHasSmtpPassword(res.data.hasSmtpPassword);
        setHasWaApiKey(res.data.hasWaApiKey);
      }
      setTimeout(() => setChannelSuccessMsg(null), 3500);
    } else {
      setChannelErrorMsg(res.error || "Failed to save notification settings.");
    }
  };

  const handleSendReminderRow = async (item: KillSwitchItem) => {
    setRemindingId(item.id);
    setReminderFeedback(null);
    const res = await sendKillSwitchReminder(item.id);
    setRemindingId(null);

    if (res.success) {
      const parts: string[] = [];
      if (res.channels.email) parts.push("Email sent");
      if (res.channels.webhook) parts.push("Webhook dispatched");
      if (parts.length === 0 && !res.whatsappUrl) {
        parts.push("Dispatched (channels unconfigured)");
      }

      setReminderFeedback({
        id: item.id,
        success: true,
        text: parts.join(", ") || "Reminder sent",
      });

      // Update lastKillSwitchNotifiedAt in local state
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) =>
                i.id === item.id
                  ? { ...i, lastKillSwitchNotifiedAt: new Date().toISOString() }
                  : i
              ),
            }
          : prev
      );

      // Open WhatsApp direct link if present
      if (res.whatsappUrl) {
        window.open(res.whatsappUrl, "_blank", "noopener,noreferrer");
      }

      setTimeout(() => {
        setReminderFeedback((cur) => (cur?.id === item.id ? null : cur));
      }, 5000);
    } else {
      setReminderFeedback({
        id: item.id,
        success: false,
        text: res.error || "Failed to dispatch reminder",
      });
      setTimeout(() => {
        setReminderFeedback((cur) => (cur?.id === item.id ? null : cur));
      }, 5000);
    }
  };

  const handleInsertToken = (token: string) => {
    setCustomTemplate((prev) => {
      const base = prev.length > 0 ? prev : DEFAULT_KILL_SWITCH_TEMPLATE;
      return `${base} ${token}`;
    });
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormLabel("");
    setFormAmount(0);
    setFormPromoLabel("");
    setFormPromoEndDate("");
    setFormNormalAmount(309000);
    setFormCancelUrl("");
    setFormKillSwitchEnabled(true);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: KillSwitchItem) => {
    setEditingItem(item);
    setFormLabel(item.label);
    setFormAmount(item.amount);
    setFormPromoLabel(item.promoLabel || "");
    setFormPromoEndDate(item.promoEndDate ? item.promoEndDate.split("T")[0] : "");
    setFormNormalAmount(item.postPromoNormalAmount || item.amount);
    setFormCancelUrl(item.providerCancelUrl || "");
    setFormKillSwitchEnabled(item.killSwitchEnabled);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formLabel.trim()) {
      setFormError("Subscription label is required");
      return;
    }
    if (!formPromoEndDate) {
      setFormError("Promo expiration deadline date is required");
      return;
    }
    if (formNormalAmount <= 0) {
      setFormError("Post-promo normal price must be greater than 0");
      return;
    }

    setSubmittingForm(true);

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
        setIsAddModalOpen(false);
        loadData();
      } else {
        setFormError(res.error || "Failed to update kill-switch item");
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
        setIsAddModalOpen(false);
        loadData();
      } else {
        setFormError(res.error || "Failed to create subscription kill-switch");
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

  const items = data?.items || [];
  const actionRequiredCount = items.filter((i) => i.alertState === "ACTION_REQUIRED").length;
  const totalPenaltyExposure = items.reduce((sum, i) => sum + i.monthlyPenaltyDelta, 0);
  const sampleItemForPreview = items.length > 0 ? items[0] : null;

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-4">
          <div className="text-[11px] font-sans font-medium text-text-tertiary uppercase tracking-wider">
            Tracked Promo Subscriptions
          </div>
          <div className="text-2xl font-mono font-bold text-text-primary mt-1">
            {items.length}
          </div>
          <div className="text-xs font-sans text-text-secondary mt-1">
            Monitored for unexpected renewals
          </div>
        </div>

        <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-4">
          <div className="text-[11px] font-sans font-medium text-text-tertiary uppercase tracking-wider">
            Critical Action Required
          </div>
          <div
            className={`text-2xl font-mono font-bold mt-1 ${
              actionRequiredCount > 0 ? "text-[#e06c75]" : "text-[#10b78d]"
            }`}
          >
            {actionRequiredCount}
          </div>
          <div className="text-xs font-sans text-text-secondary mt-1">
            {actionRequiredCount > 0
              ? `Within H-${leadDays} deadline window`
              : "All promotional deadlines safe"}
          </div>
        </div>

        <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-4">
          <div className="text-[11px] font-sans font-medium text-text-tertiary uppercase tracking-wider">
            Monthly Renewal Jump Protected
          </div>
          <div className="text-2xl font-mono font-bold text-text-primary mt-1">
            {formatRupiah(totalPenaltyExposure)}
            <span className="text-xs font-sans font-normal text-text-tertiary">/mo</span>
          </div>
          <div className="text-xs font-sans text-text-secondary mt-1">
            Total recurring price delta after promos
          </div>
        </div>
      </div>

      {/* Card A: Global Alert Behavior Settings */}
      <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-5 space-y-4">
        <div className="border-b border-[#282e3d] pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold font-sans text-text-primary">
              Anti-Fatigue Alert Behavior & Timing
            </h2>
            <p className="text-xs font-sans text-text-tertiary mt-0.5">
              Prevent notification fatigue by keeping alerts strictly silent until actionable deadline windows.
            </p>
          </div>
          {settingsSavedMessage && (
            <span className="text-xs font-sans text-[#10b78d] bg-[rgba(16,183,141,0.1)] px-2.5 py-1 rounded border border-[rgba(16,183,141,0.25)]">
              {settingsSavedMessage}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
          {/* Toggle Banner */}
          <div className="space-y-2">
            <label className="text-xs font-medium font-sans text-text-secondary block">
              Overview Dashboard Alert Banner
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBannerEnabled(!bannerEnabled)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  bannerEnabled ? "bg-[#10b78d]" : "bg-[#282e3d]"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    bannerEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-xs font-sans text-text-primary">
                {bannerEnabled
                  ? "Enabled (Shows banner only when within deadline)"
                  : "Disabled (Zero banners on dashboard)"}
              </span>
            </div>
            <p className="text-[11px] font-sans text-text-tertiary">
              When enabled, a high-contrast action banner appears on Overview only if a subscription is within its lead-time window and unconfirmed.
            </p>
          </div>

          {/* Lead Days Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium font-sans text-text-secondary block">
              Alert Lead-Time Window
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { days: 7, label: "7 Days", desc: "Short window" },
                { days: 14, label: "14 Days", desc: "Recommended" },
                { days: 30, label: "30 Days", desc: "Early warning" },
              ].map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setLeadDays(opt.days)}
                  className={`px-3 py-2 rounded text-left border transition-colors ${
                    leadDays === opt.days
                      ? "border-[#10b78d] bg-[rgba(16,183,141,0.08)] text-text-primary"
                      : "border-[#282e3d] bg-[#1a1f2c] text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <div className="text-xs font-semibold font-mono">{opt.label}</div>
                  <div className="text-[10px] text-text-tertiary">{opt.desc}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] font-sans text-text-tertiary">
              Subscriptions outside this window will stay completely silent (no banners, no alerts).
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="px-4 py-1.5 rounded text-xs font-medium bg-[#282e3d] hover:bg-[#32394c] text-text-primary border border-border-subtle transition-colors disabled:opacity-50"
          >
            {savingSettings ? "Saving..." : "Save Alert Settings"}
          </button>
        </div>
      </div>

      {/* Card B: Tracked Promotional Subscriptions Table */}
      <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-5 space-y-4">
        <div className="border-b border-[#282e3d] pb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold font-sans text-text-primary">
              Tracked Promotional Subscriptions & Kill-Switches
            </h2>
            <p className="text-xs font-sans text-text-tertiary mt-0.5">
              Armed with automatic expiry warnings, loss jump deltas, 1-click external calendar sync, and provider cancellation shortcuts.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="px-3 py-1.5 rounded text-xs font-medium bg-[#10b78d] hover:bg-[#0ea27c] text-white transition-colors"
          >
            Track Promo Subscription
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs font-sans text-text-tertiary">
            Loading subscriptions...
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-xs font-sans text-text-tertiary">
              No promotional subscriptions currently armed.
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="text-xs text-[#10b78d] hover:underline"
            >
              Add your first promo subscription (e.g., Gemini AI, Coursera, Free Trials)
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto lg:overflow-x-visible">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#282e3d] text-[11px] font-sans font-medium text-text-tertiary uppercase">
                  <th className="py-2.5 px-2.5">Subscription / Promo</th>
                  <th className="py-2.5 px-2.5">Current Rate</th>
                  <th className="py-2.5 px-2.5">Post-Promo Rate</th>
                  <th className="py-2.5 px-2.5">Loss Jump Delta</th>
                  <th className="py-2.5 px-2.5">Renewal Deadline</th>
                  <th className="py-2.5 px-2.5">Status</th>
                  <th className="py-2.5 px-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#282e3d]/60 text-xs font-sans">
                {items.map((item) => {
                  const isProcessing = actionProcessingId === item.id;
                  const isReminding = remindingId === item.id;
                  const daysLeft = item.daysUntilExpiry;
                  const gCalUrl = buildGoogleCalendarUrl(item);
                  const itemFeedback = reminderFeedback?.id === item.id ? reminderFeedback : null;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-[#1a1f2c]/50 transition-colors ${
                        item.alertState === "ACTION_REQUIRED"
                          ? "bg-[rgba(224,108,117,0.04)]"
                          : ""
                      }`}
                    >
                      {/* Name & Promo Label */}
                      <td className="py-2.5 px-2.5">
                        <div className="font-medium text-text-primary whitespace-nowrap">{item.label}</div>
                        {item.promoLabel && (
                          <div className="text-[11px] text-text-tertiary mt-0.5 truncate max-w-[190px]" title={item.promoLabel}>
                            {item.promoLabel}
                          </div>
                        )}
                      </td>

                      {/* Current Amount */}
                      <td className="py-2.5 px-2.5 font-mono text-text-secondary whitespace-nowrap">
                        {item.amount === 0 ? "Rp 0 (Trial)" : formatRupiah(item.amount)}
                        <span className="text-[10px] text-text-tertiary">/mo</span>
                      </td>

                      {/* Post Promo Normal Amount */}
                      <td className="py-2.5 px-2.5 font-mono text-text-primary whitespace-nowrap">
                        {item.postPromoNormalAmount
                          ? formatRupiah(item.postPromoNormalAmount)
                          : "-"}
                        <span className="text-[10px] text-text-tertiary">/mo</span>
                      </td>

                      {/* Penalty Jump Delta */}
                      <td className="py-2.5 px-2.5 font-mono whitespace-nowrap">
                        {item.monthlyPenaltyDelta > 0 ? (
                          <span className="text-[#e06c75] font-medium">
                            +{formatRupiah(item.monthlyPenaltyDelta)}
                            <span className="text-[10px] text-text-tertiary">/mo</span>
                          </span>
                        ) : (
                          <span className="text-text-tertiary">No Jump</span>
                        )}
                      </td>

                      {/* Deadline & Days Left */}
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        {item.promoEndDate ? (
                          <div>
                            <div className="font-mono text-text-primary">
                              {item.promoEndDate.split("T")[0]}
                            </div>
                            <div
                              className={`text-[10px] font-mono mt-0.5 ${
                                daysLeft !== null && daysLeft <= leadDays
                                  ? "text-[#e06c75] font-semibold"
                                  : "text-text-tertiary"
                              }`}
                            >
                              {daysLeft === null
                                ? ""
                                : daysLeft < 0
                                ? `${Math.abs(daysLeft)}d overdue`
                                : daysLeft === 0
                                ? "Expires Today"
                                : `${daysLeft} days remaining`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-text-tertiary font-mono">Unscheduled</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        {item.statusLabel === "SAFE" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium border bg-[rgba(16,183,141,0.12)] text-[#10b78d] border-[rgba(16,183,141,0.25)]">
                            SAFE
                          </span>
                        ) : item.statusLabel === "CRITICAL" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium border bg-[rgba(224,108,117,0.15)] text-[#e06c75] border-[rgba(224,108,117,0.3)]">
                            CRITICAL
                          </span>
                        ) : item.statusLabel === "INACTIVE" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium border bg-[#1a1f2c] text-text-tertiary border-[#282e3d]">
                            INACTIVE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium border bg-[#1a1f2c] text-text-secondary border-[#282e3d]">
                            ARMED
                          </span>
                        )}
                      </td>

                      {/* Compact Unified Actions Cluster */}
                      <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.providerCancelUrl && (
                              <a
                                href={item.providerCancelUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open provider cancellation page"
                                className="px-2 py-1 rounded text-[11px] font-medium bg-[#1a1f2c] hover:bg-[#282e3d] text-text-secondary hover:text-text-primary border border-[#282e3d] transition-colors active:scale-[0.99]"
                              >
                                Open ↗
                              </a>
                            )}

                            {gCalUrl ? (
                              <a
                                href={gCalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Add 3-day reminder to Google Calendar (19:00 WIB)"
                                className="px-2 py-1 rounded text-[10px] font-mono font-medium bg-[#1a1f2c] hover:bg-[#282e3d] text-text-secondary hover:text-text-primary border border-[#282e3d] transition-colors active:scale-[0.99]"
                              >
                                + GCal
                              </a>
                            ) : null}

                            {item.promoEndDate ? (
                              <button
                                type="button"
                                onClick={() => downloadIcsFile(item)}
                                title="Download .ics event file"
                                className="px-1.5 py-1 rounded text-[10px] font-mono font-medium bg-[#1a1f2c] hover:bg-[#282e3d] text-text-secondary hover:text-text-primary border border-[#282e3d] transition-colors active:scale-[0.99]"
                              >
                                .ics
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleSendReminderRow(item)}
                              disabled={isReminding}
                              title="Send test alert via Gmail SMTP / WhatsApp Webhook"
                              className="px-2 py-1 rounded text-[10px] font-mono font-medium bg-[#1a1f2c] hover:bg-[#282e3d] text-text-secondary hover:text-text-primary border border-[#282e3d] transition-colors active:scale-[0.99] disabled:opacity-50"
                            >
                              {isReminding ? "..." : "Remind"}
                            </button>

                            {!item.providerCancelConfirmed ? (
                              <button
                                type="button"
                                onClick={() => handleConfirmCancel(item)}
                                disabled={isProcessing}
                                title="Mark subscription as canceled with provider"
                                className="px-2 py-1 rounded text-[11px] font-medium bg-[#282e3d] hover:bg-[#363e52] text-text-primary border border-border-subtle transition-colors active:scale-[0.99] disabled:opacity-50"
                              >
                                {isProcessing ? "..." : "Canceled"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRearm(item)}
                                disabled={isProcessing}
                                title="Rearm kill-switch alert guard"
                                className="px-2 py-1 rounded text-[11px] font-medium bg-[#1a1f2c] hover:bg-[#282e3d] text-text-tertiary hover:text-text-primary border border-[#282e3d] transition-colors active:scale-[0.99] disabled:opacity-50"
                              >
                                Rearm
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              title="Edit subscription details"
                              className="px-2 py-1 rounded text-[11px] font-medium text-text-tertiary hover:text-text-primary hover:bg-[#1a1f2c] transition-colors active:scale-[0.99]"
                            >
                              Edit
                            </button>
                          </div>

                          {itemFeedback && (
                            <div
                              className={`text-[10px] font-mono ${
                                itemFeedback.success ? "text-[#10b78d]" : "text-[#e06c75]"
                              }`}
                            >
                              {itemFeedback.text}
                            </div>
                          )}

                          {!itemFeedback && item.lastKillSwitchNotifiedAt && (
                            <div className="text-[10px] font-mono text-text-tertiary">
                              Notified:{" "}
                              {new Date(item.lastKillSwitchNotifiedAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
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

      {/* Card C: External Multi-Channel Dispatcher (Gmail SMTP & WhatsApp) */}
      <div className="rounded-lg border border-[#282e3d] bg-[#161922] p-5 space-y-5">
        <div className="border-b border-[#282e3d] pb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold font-sans text-text-primary">
              External Multi-Channel Dispatcher (Gmail SMTP & WhatsApp)
            </h2>
            <p className="text-xs font-sans text-text-tertiary mt-0.5">
              Configure external notification channels to dispatch urgent reminder messages directly to your inbox or phone before promo renewal deadlines.
            </p>
          </div>
          {channelSuccessMsg && (
            <span className="text-xs font-sans text-[#10b78d] bg-[rgba(16,183,141,0.1)] px-2.5 py-1 rounded border border-[rgba(16,183,141,0.25)]">
              {channelSuccessMsg}
            </span>
          )}
          {channelErrorMsg && (
            <span className="text-xs font-sans text-[#e06c75] bg-[rgba(224,108,117,0.1)] px-2.5 py-1 rounded border border-[rgba(224,108,117,0.25)]">
              {channelErrorMsg}
            </span>
          )}
        </div>

        <form onSubmit={handleSaveChannelSettings} className="space-y-5">
          {/* Section 1: Email Channel */}
          <div className="space-y-3">
            <div className="text-xs font-semibold font-sans text-text-primary uppercase tracking-wider text-text-secondary">
              Email Notifications (Gmail SMTP)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium font-sans text-text-secondary block">
                  Target Notification Email
                </label>
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="e.g. your-email@gmail.com"
                  className="w-full px-3 py-1.5 rounded bg-[#1a1f2c] border border-[#282e3d] text-text-primary text-xs focus:outline-none focus:border-[#10b78d]"
                />
                <span className="text-[10px] text-text-tertiary block">
                  Inbox that receives reminder alerts
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium font-sans text-text-secondary block">
                  SMTP Sender Gmail
                </label>
                <input
                  type="email"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="e.g. sender-bot@gmail.com"
                  className="w-full px-3 py-1.5 rounded bg-[#1a1f2c] border border-[#282e3d] text-text-primary text-xs focus:outline-none focus:border-[#10b78d]"
                />
                <span className="text-[10px] text-text-tertiary block">
                  Gmail address used to send alerts
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium font-sans text-text-secondary block">
                    Google App Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAppPassword(!showAppPassword)}
                    className="text-[10px] text-text-tertiary hover:text-text-primary font-mono"
                  >
                    {showAppPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showAppPassword ? "text" : "password"}
                  value={smtpAppPassword}
                  onChange={(e) => setSmtpAppPassword(e.target.value)}
                  placeholder={
                    hasSmtpPassword
                      ? "•••••••••••••••• (Saved - type to change)"
                      : "16-char Google App Password"
                  }
                  className="w-full px-3 py-1.5 rounded bg-[#1a1f2c] border border-[#282e3d] text-text-primary text-xs font-mono focus:outline-none focus:border-[#10b78d]"
                />
                <span className="text-[10px] text-text-tertiary block">
                  Generate in{" "}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#10b78d] hover:underline"
                  >
                    Google Account Security
                  </a>
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: WhatsApp & Webhook Channel */}
          <div className="space-y-3 pt-2 border-t border-[#282e3d]">
            <div className="text-xs font-semibold font-sans text-text-primary uppercase tracking-wider text-text-secondary">
              WhatsApp & Webhook Notifications (Fonnte / n8n)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium font-sans text-text-secondary block">
                  WhatsApp Phone Number
                </label>
                <input
                  type="text"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="e.g. 6281234567890"
                  className="w-full px-3 py-1.5 rounded bg-[#1a1f2c] border border-[#282e3d] text-text-primary text-xs font-mono focus:outline-none focus:border-[#10b78d]"
                />
                <span className="text-[10px] text-text-tertiary block">
                  Target phone with country code (e.g. 628...)
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium font-sans text-text-secondary block">
                  Webhook URL (Optional)
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="e.g. https://api.fonnte.com/send"
                  className="w-full px-3 py-1.5 rounded bg-[#1a1f2c] border border-[#282e3d] text-text-primary text-xs focus:outline-none focus:border-[#10b78d]"
                />
                <span className="text-[10px] text-text-tertiary block">
                  Fonnte or automated workflow URL
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium font-sans text-text-secondary block">
                    Webhook API Key / Token
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="text-[10px] text-text-tertiary hover:text-text-primary font-mono"
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showApiKey ? "text" : "password"}
                  value={waApiKey}
                  onChange={(e) => setWaApiKey(e.target.value)}
                  placeholder={
                    hasWaApiKey
                      ? "•••••••••••• (Saved - type to change)"
                      : "Fonnte token or bearer token"
                  }
                  className="w-full px-3 py-1.5 rounded bg-[#1a1f2c] border border-[#282e3d] text-text-primary text-xs font-mono focus:outline-none focus:border-[#10b78d]"
                />
                <span className="text-[10px] text-text-tertiary block">
                  Passed in Authorization header
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Indonesian Message Template & Tokens */}
          <div className="space-y-2 pt-2 border-t border-[#282e3d]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold font-sans text-text-primary uppercase tracking-wider text-text-secondary">
                Human Message Template (Indonesian)
              </label>
              <button
                type="button"
                onClick={() => setCustomTemplate("")}
                className="text-[11px] font-mono text-text-tertiary hover:text-text-primary transition-colors"
              >
                Reset to Default Template
              </button>
            </div>

            <textarea
              rows={3}
              value={customTemplate}
              onChange={(e) => setCustomTemplate(e.target.value)}
              placeholder={DEFAULT_KILL_SWITCH_TEMPLATE}
              className="w-full px-3 py-2 rounded bg-[#1a1f2c] border border-[#282e3d] text-text-primary text-xs font-sans focus:outline-none focus:border-[#10b78d] leading-relaxed resize-y"
            />

            {/* Token Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-text-tertiary mr-1">Insert variable:</span>
              {[
                "{{name}}",
                "{{deadline}}",
                "{{daysLeft}}",
                "{{normalPrice}}",
                "{{cancelUrl}}",
                "{{currentPrice}}",
              ].map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => handleInsertToken(token)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1a1f2c] hover:bg-[#282e3d] text-text-secondary hover:text-text-primary border border-[#282e3d] transition-colors"
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: Live Message Preview */}
          <div className="space-y-2 pt-2 border-t border-[#282e3d]">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold font-sans text-text-primary uppercase tracking-wider text-text-secondary">
                Live Message Preview
              </div>
              <span className="text-[10px] font-mono text-text-tertiary">
                Sample preview: {sampleItemForPreview?.label || "Gemini AI Pro"}
              </span>
            </div>

            <div className="rounded border border-[#282e3d] bg-[#12151e] p-3 text-xs font-mono text-text-primary leading-relaxed whitespace-pre-wrap select-all">
              {renderMessagePreview(customTemplate, sampleItemForPreview)}
            </div>
          </div>

          {/* Card C Actions */}
          <div className="pt-3 border-t border-[#282e3d] flex flex-wrap items-center justify-between gap-3">
            <div>
              {sampleItemForPreview ? (
                <button
                  type="button"
                  onClick={() => handleSendReminderRow(sampleItemForPreview)}
                  disabled={remindingId === sampleItemForPreview.id}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-[#1a1f2c] hover:bg-[#282e3d] text-text-secondary hover:text-text-primary border border-[#282e3d] transition-colors disabled:opacity-50"
                >
                  {remindingId === sampleItemForPreview.id
                    ? "Dispatching Test..."
                    : `Send Test Alert (${sampleItemForPreview.label})`}
                </button>
              ) : (
                <span className="text-xs text-text-tertiary font-sans">
                  Add a promo subscription above to enable test dispatch.
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={savingChannels}
              className="px-4 py-1.5 rounded text-xs font-medium bg-[#10b78d] hover:bg-[#0ea27c] text-white transition-colors disabled:opacity-50"
            >
              {savingChannels ? "Saving Settings..." : "Save Channel Settings"}
            </button>
          </div>
        </form>
      </div>

      {/* Add / Edit Subscription Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-lg border border-[#282e3d] bg-[#161922] p-5 shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="border-b border-[#282e3d] pb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold font-sans text-text-primary">
                {editingItem ? "Edit Subscription Kill-Switch" : "Track Promotional Subscription"}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-text-tertiary hover:text-text-primary text-sm font-mono"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded bg-[rgba(224,108,117,0.12)] border border-[rgba(224,108,117,0.25)] text-xs text-[#e06c75]">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitModal} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-text-secondary block font-medium">
                    Subscription Name *
                  </label>
                  <input
                    type="text"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="e.g. Gemini AI Pro #1"
                    className="w-full px-3 py-1.5 rounded bg-[#1a1f2c] border border-[#282e3d] text-text-primary focus:outline-none focus:border-[#10b78d]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-text-secondary block font-medium">
                    Promo Tag / Description
                  </label>
                  <input
                    type="text"
                    value={formPromoLabel}
                    onChange={(e) => setFormPromoLabel(e.target.value)}
                    placeholder="e.g. 1-Year Free Trial or 3-Month Promo"
                    className="w-full px-3 py-1.5 rounded bg-[#1a1f2c] border border-[#282e3d] text-text-primary focus:outline-none focus:border-[#10b78d]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-text-secondary block font-medium">
                    Current Monthly / Promo Price (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formAmount}
                    onChange={(e) => setFormAmount(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-1.5 rounded bg-[#1a1f2c] border border-[#282e3d] text-text-primary font-mono focus:outline-none focus:border-[#10b78d]"
                  />
                  <span className="text-[10px] text-text-tertiary">
                    Set 0 for free trials, or discounted monthly rate
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-text-secondary block font-medium">
                    Post-Promo Normal Price (Rp) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formNormalAmount}
                    onChange={(e) => setFormNormalAmount(Number(e.target.value))}
                    placeholder="309000"
                    className="w-full px-3 py-1.5 rounded bg-[#1a1f2c] border border-[#282e3d] text-text-primary font-mono focus:outline-none focus:border-[#10b78d]"
                    required
                  />
                  <span className="text-[10px] text-text-tertiary">
                    Normal price charged if not canceled
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-text-secondary block font-medium">
                    Promo Expiration Deadline Date *
                  </label>
                  <input
                    type="date"
                    value={formPromoEndDate}
                    onChange={(e) => setFormPromoEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-[#1a1f2c] border border-[#282e3d] text-text-primary font-mono focus:outline-none focus:border-[#10b78d]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-text-secondary block font-medium">
                    Provider Cancellation Direct URL
                  </label>
                  <input
                    type="url"
                    value={formCancelUrl}
                    onChange={(e) => setFormCancelUrl(e.target.value)}
                    placeholder="https://one.google.com/settings"
                    className="w-full px-3 py-1.5 rounded bg-[#1a1f2c] border border-[#282e3d] text-text-primary focus:outline-none focus:border-[#10b78d]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="enableKillSwitch"
                  checked={formKillSwitchEnabled}
                  onChange={(e) => setFormKillSwitchEnabled(e.target.checked)}
                  className="rounded border-[#282e3d] bg-[#1a1f2c] text-[#10b78d] focus:ring-0"
                />
                <label htmlFor="enableKillSwitch" className="text-xs text-text-secondary select-none">
                  Enable Kill-Switch auto-renew alert guard
                </label>
              </div>

              <div className="pt-3 border-t border-[#282e3d] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-[#1a1f2c] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingForm}
                  className="px-4 py-1.5 rounded text-xs font-medium bg-[#10b78d] hover:bg-[#0ea27c] text-white transition-colors disabled:opacity-50"
                >
                  {submittingForm
                    ? "Saving..."
                    : editingItem
                    ? "Update Subscription"
                    : "Arm Kill-Switch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
