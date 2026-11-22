"use client";

import React, { useRef, useState } from "react";
import {
  EmailDispatchResult,
  EmailStatusResponse,
  KillSwitchNotificationConfig,
  UpdateKillSwitchNotificationConfigInput,
  fetchEmailStatus,
  previewEmailTemplate,
  sendCutoffDigestEmail,
  sendLedgerBackupEmail,
  sendMonthlyStatementEmail,
  sendTestEmailDispatch,
  updateKillSwitchNotificationConfig,
  verifySmtpConnection,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { usePeriod } from "@/context/PeriodContext";
import {
  Eye,
  FileSpreadsheet,
  HardDriveDownload,
  Mail,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";

type EmailTemplateKey =
  | "kill-switch"
  | "monthly-statement"
  | "cutoff-digest"
  | "ledger-backup"
  | "test-dispatch";

interface SmtpControlPanelProps {
  initialNotifConfig?: KillSwitchNotificationConfig | null;
  initialEmailStatus?: EmailStatusResponse | null;
  customTemplate: string;
  defaultLocale?: "EN" | "ID" | "ZH";
  activeMonth: number;
  activeYear: number;
  onSyncExternalTemplate?: (tpl: string) => void;
}

export function SmtpControlPanel({
  initialNotifConfig,
  initialEmailStatus,
  customTemplate,
  defaultLocale = "EN",
  activeMonth,
  activeYear,
}: SmtpControlPanelProps) {
  const { user, openProfileModal } = useAuth();
  const { month: periodMonth, year: periodYear } = usePeriod();
  const targetMonth = periodMonth || activeMonth;
  const targetYear = periodYear || activeYear;

  const previewDialogRef = useRef<HTMLDialogElement | null>(null);

  const [emailStatus, setEmailStatus] = useState<EmailStatusResponse | null>(
    initialEmailStatus ?? null,
  );
  const [smtpUser, setSmtpUser] = useState<string>(
    initialNotifConfig?.killSwitchSmtpUser ||
      initialEmailStatus?.smtpUser ||
      user?.email ||
      "",
  );

  const effectiveRecipient =
    user?.email ||
    emailStatus?.profileEmail ||
    emailStatus?.recipientEmail ||
    emailStatus?.configuredRecipient ||
    initialNotifConfig?.killSwitchNotifyEmail ||
    "Not configured";
  const platformFromDisplay =
    emailStatus?.platformFrom ||
    '"Sunday Funday ERP" <sundayfundayerp@gmail.com>';
  const [smtpAppPassword, setSmtpAppPassword] = useState("");
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [hasSmtpPassword, setHasSmtpPassword] = useState<boolean>(
    Boolean(initialNotifConfig?.hasSmtpPassword || initialEmailStatus?.hasAppPassword),
  );

  const [webhookUrl, setWebhookUrl] = useState<string>(
    initialNotifConfig?.killSwitchWebhookUrl || "",
  );
  const [waPhone, setWaPhone] = useState<string>(initialNotifConfig?.killSwitchWaPhone || "");
  const [waApiKey, setWaApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasWaApiKey, setHasWaApiKey] = useState<boolean>(
    Boolean(initialNotifConfig?.hasWaApiKey),
  );

  const [previewLocale, setPreviewLocale] = useState<"EN" | "ID" | "ZH">(defaultLocale);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateKey>("kill-switch");

  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [busyAction, setBusyAction] = useState<
    "test" | "statement" | "digest" | "backup" | "preview" | null
  >(null);
  const [lastFailedOp, setLastFailedOp] = useState<
    "test" | "statement" | "digest" | "backup" | null
  >(null);
  const [statusFeedback, setStatusFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [previewPayload, setPreviewPayload] = useState<EmailDispatchResult | null>(null);

  const isLiveVerified =
    emailStatus?.mode === "LIVE_SMTP" && (emailStatus.verified ?? true) && hasSmtpPassword;
  const isAuthError = emailStatus?.mode === "AUTH_ERROR";
  const hostDisplay = emailStatus?.host || "smtp.gmail.com";
  const portDisplay = emailStatus?.port || 465;

  const openPreviewDialog = (payload: EmailDispatchResult) => {
    setPreviewPayload(payload);
    if (previewDialogRef.current && !previewDialogRef.current.open) {
      previewDialogRef.current.showModal();
    }
  };

  const closePreviewDialog = () => {
    if (previewDialogRef.current?.open) {
      previewDialogRef.current.close();
    }
  };

  const handleSaveChannelSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusFeedback(null);
    setLastFailedOp(null);

    const payload: UpdateKillSwitchNotificationConfigInput = {
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
    setSaving(false);

    if (res.success && res.data) {
      setSmtpAppPassword("");
      setWaApiKey("");
      setHasSmtpPassword(res.data.hasSmtpPassword);
      setHasWaApiKey(res.data.hasWaApiKey);

      const nextStatus = await fetchEmailStatus();
      if (nextStatus) setEmailStatus(nextStatus);

      const v = res.data.smtpVerification;
      if (v && !v.ok) {
        setStatusFeedback({
          ok: false,
          message: [
            `Settings saved, but SMTP verification failed: ${v.summary || ""}`,
            v.guidance || "",
          ]
            .filter(Boolean)
            .join(" "),
        });
      } else if (v && v.ok) {
        setStatusFeedback({
          ok: true,
          message: `SMTP connection verified (${v.host}:${v.port}${v.fallbackUsed ? " STARTTLS" : ""}) and channel settings saved.`,
        });
      } else {
        setStatusFeedback({
          ok: true,
          message: "Notification channel settings saved (Dry-Run Mode).",
        });
      }
    } else {
      setStatusFeedback({
        ok: false,
        message: res.error || "Failed to persist SMTP configuration.",
      });
    }
  };

  const handleVerifyConnection = async () => {
    if (verifying || saving || clearing) return;
    setVerifying(true);
    setStatusFeedback(null);
    setLastFailedOp(null);
    const nextStatus = await verifySmtpConnection();
    setVerifying(false);

    if (!nextStatus) {
      setStatusFeedback({
        ok: false,
        message: "Unable to reach the verification endpoint. Check network connectivity.",
      });
      return;
    }

    setEmailStatus(nextStatus);
    setHasSmtpPassword(nextStatus.hasAppPassword);

    if (!nextStatus.configured) {
      setStatusFeedback({
        ok: true,
        message: "No App Password configured. System is operating in Dry-Run Preview Mode.",
      });
    } else if (nextStatus.verified) {
      setStatusFeedback({
        ok: true,
        message: `Verified SMTP handshake for ${nextStatus.smtpUser} on ${nextStatus.host}:${nextStatus.port}${nextStatus.fallbackUsed ? " (STARTTLS fallback)" : ""}.`,
      });
    } else {
      setStatusFeedback({
        ok: false,
        message: [nextStatus.verificationError, nextStatus.verificationGuidance]
          .filter(Boolean)
          .join(" "),
      });
    }
  };

  const handleClearSavedPassword = async () => {
    if (clearing || saving || verifying) return;
    setClearing(true);
    setStatusFeedback(null);
    setLastFailedOp(null);

    const res = await updateKillSwitchNotificationConfig({ clearSmtpPassword: true });
    setClearing(false);

    if (!res.success || !res.data) {
      setStatusFeedback({
        ok: false,
        message: res.error || "Failed to clear saved SMTP password.",
      });
      return;
    }

    setSmtpAppPassword("");
    setHasSmtpPassword(false);
    const nextStatus = await fetchEmailStatus();
    if (nextStatus) setEmailStatus(nextStatus);
    setStatusFeedback({
      ok: true,
      message: "Saved App Password removed. Channel reverted to Preview / Dry-Run Mode.",
    });
  };

  const handlePreviewTemplate = async (template: EmailTemplateKey = selectedTemplate) => {
    if (busyAction) return;
    setBusyAction("preview");
    setStatusFeedback(null);
    setLastFailedOp(null);
    const res = await previewEmailTemplate({
      template,
      month: targetMonth,
      year: targetYear,
      scope: "all",
      locale: previewLocale,
    });
    setBusyAction(null);
    if (res.success && res.data) {
      openPreviewDialog(res.data);
    } else {
      setStatusFeedback({
        ok: false,
        message: res.error || "Unable to render email template preview.",
      });
    }
  };

  const handleDispatchEmailWorkflow = async (
    op: "test" | "statement" | "digest" | "backup",
    dryRunOverride = false,
  ) => {
    if (busyAction) return;
    setBusyAction(op);
    setStatusFeedback(null);
    if (dryRunOverride) {
      setLastFailedOp(null);
    }

    const res =
      op === "test"
        ? await sendTestEmailDispatch({
            locale: previewLocale,
            dryRun: dryRunOverride || undefined,
          })
        : op === "statement"
          ? await sendMonthlyStatementEmail({
              month: targetMonth,
              year: targetYear,
              scope: "all",
              locale: previewLocale,
              dryRun: dryRunOverride || undefined,
            })
          : op === "digest"
            ? await sendCutoffDigestEmail({
                month: targetMonth,
                year: targetYear,
                locale: previewLocale,
                dryRun: dryRunOverride || undefined,
              })
            : await sendLedgerBackupEmail({
                month: targetMonth,
                year: targetYear,
                locale: previewLocale,
                dryRun: dryRunOverride || undefined,
              });

    setBusyAction(null);
    if (!res.success || !res.data) {
      setLastFailedOp(op);
      const nextStatus = await fetchEmailStatus();
      if (nextStatus) setEmailStatus(nextStatus);
      setStatusFeedback({
        ok: false,
        message: res.error || "Email workflow execution failed.",
      });
      return;
    }

    setLastFailedOp(null);
    const d = res.data;
    const attachSummary =
      d.attachmentNames.length > 0 ? ` · Attachments: ${d.attachmentNames.join(", ")}` : "";
    const activeHost = d.host || hostDisplay;
    const activePort = d.port || portDisplay;
    setStatusFeedback({
      ok: true,
      message:
        d.status === "SENT"
          ? `Dispatched via ${activeHost}:${activePort}${d.fallbackUsed ? " (STARTTLS)" : ""} to ${d.recipientEmail}${attachSummary}`
          : `Rendered dry-run preview for ${d.recipientEmail}${attachSummary}`,
    });
    openPreviewDialog(d);
  };

  const passiveVerificationError =
    !statusFeedback && isAuthError && emailStatus?.verificationError
      ? [emailStatus.verificationError, emailStatus.verificationGuidance]
          .filter(Boolean)
          .join(" ")
      : null;

  return (
    <section className="rounded-lg border border-border bg-surface p-5 space-y-5">
      <div className="border-b border-border-subtle pb-3.5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-sm font-semibold font-sans text-text-primary">
                SMTP &amp; Email Delivery Control Panel
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                  isLiveVerified
                    ? "erp-callout-positive text-delta-positive"
                    : isAuthError
                      ? "erp-callout-urgency text-urgency"
                      : "erp-callout-caution text-caution"
                }`}
              >
                {isLiveVerified
                  ? `Verified Live SMTP (${hostDisplay}:${portDisplay}${emailStatus?.fallbackUsed ? " STARTTLS" : ""})`
                  : isAuthError
                    ? `SMTP Auth / Connection Error (${hostDisplay}:${portDisplay})`
                    : "Preview / Dry-Run Mode — App Password Unset"}
              </span>
            </div>
            <p className="text-xs font-sans text-text-tertiary mt-1">
              Pre-configured transport: <code className="font-mono text-text-secondary">{hostDisplay}</code>{" "}
              port <code className="font-mono text-text-secondary">{portDisplay}</code> (SSL/STARTTLS 587 fallback)
              via <code className="font-mono text-text-secondary">{smtpUser}</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleVerifyConnection}
              disabled={verifying || saving || clearing || busyAction !== null}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-surface-subtle hover:bg-surface-elevated text-text-primary border border-border transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${verifying ? "animate-spin" : ""}`} />
              {verifying ? "Verifying..." : "Verify Connection"}
            </button>
            {hasSmtpPassword && (
              <button
                type="button"
                onClick={handleClearSavedPassword}
                disabled={clearing || saving || verifying || busyAction !== null}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-surface-subtle hover:bg-surface-elevated text-urgency border border-urgency/30 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                {clearing ? "Clearing..." : "Clear Saved Password"}
              </button>
            )}
          </div>
        </div>

        {(statusFeedback || passiveVerificationError) && (
          <div
            className={`text-xs font-mono px-3 py-2 rounded border flex flex-wrap items-center justify-between gap-2 ${
              statusFeedback?.ok
                ? "border-delta-positive/30 bg-[rgba(16,183,141,0.08)] text-delta-positive"
                : "border-urgency/35 bg-[rgba(255,56,56,0.08)] text-urgency"
            }`}
          >
            <span className="leading-relaxed">
              {statusFeedback ? statusFeedback.message : passiveVerificationError}
            </span>
            {statusFeedback && !statusFeedback.ok && lastFailedOp && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => handleDispatchEmailWorkflow(lastFailedOp, true)}
                className="shrink-0 px-2.5 py-1 rounded text-[11px] font-sans font-medium bg-canvas text-text-primary border border-border-strong hover:bg-surface-elevated transition-colors cursor-pointer"
              >
                Run in Dry-Run Fallback
              </button>
            )}
          </div>
        )}
      </div>

      {/* Persistent SMTP Credentials & Delivery Targets */}
      <form onSubmit={handleSaveChannelSettings} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium font-sans text-text-secondary block">
                Recipient (To): User Profile Email
              </span>
              <button
                type="button"
                onClick={openProfileModal}
                className="text-[11px] font-sans font-medium text-accent hover:underline cursor-pointer"
              >
                Edit Profile Email
              </button>
            </div>
            <div
              id="smtp-target-recipient"
              className="w-full px-3 py-1.5 rounded bg-canvas/70 border border-border text-text-primary text-xs font-mono truncate"
              title={effectiveRecipient}
            >
              {effectiveRecipient}
            </div>
            <span className="text-[11px] text-text-tertiary block leading-snug">
              Sender (From): <span className="font-mono text-text-secondary">{platformFromDisplay}</span>. Receives statements, digests, backups, and security notices.
            </span>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="smtp-sender-user"
              className="text-xs font-medium font-sans text-text-secondary block"
            >
              SMTP Auth Login (Gmail)
            </label>
            <input
              id="smtp-sender-user"
              type="email"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="you@gmail.com"
              className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-text-primary text-xs font-mono focus:outline-none focus:border-border-strong"
            />
            <span className="text-[11px] text-text-tertiary block leading-snug">
              Google account that owns your 16-digit App Password (emails still show From: sundayfundayerp@gmail.com). Host {hostDisplay} · Port {portDisplay}.
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="smtp-app-password"
                className="text-xs font-medium font-sans text-text-secondary block"
              >
                16-Digit Google App Password
              </label>
              <button
                type="button"
                onClick={() => setShowAppPassword((v) => !v)}
                className="text-[11px] text-text-tertiary hover:text-text-primary font-mono cursor-pointer"
              >
                {showAppPassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
              id="smtp-app-password"
              type={showAppPassword ? "text" : "password"}
              value={smtpAppPassword}
              onChange={(e) => setSmtpAppPassword(e.target.value)}
              placeholder={
                hasSmtpPassword
                  ? "Configured (leave blank to retain current secret)"
                  : "xxxx xxxx xxxx xxxx"
              }
              autoComplete="off"
              className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-text-primary text-xs font-mono focus:outline-none focus:border-border-strong"
            />
            <span className="text-[11px] text-text-tertiary block">
              Leave empty when updating other fields to preserve any saved App Password.{" "}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Google App Passwords
              </a>
            </span>
          </div>
        </div>

        {/* Optional Webhook / WhatsApp Relay */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-border-subtle">
          <div className="space-y-1">
            <label
              htmlFor="wa-phone-input"
              className="text-xs font-medium font-sans text-text-secondary block"
            >
              WhatsApp Number (Optional)
            </label>
            <input
              id="wa-phone-input"
              type="text"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              placeholder="6281234567890"
              className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-text-primary text-xs font-mono focus:outline-none focus:border-border-strong"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="wa-webhook-input"
              className="text-xs font-medium font-sans text-text-secondary block"
            >
              Webhook Relay URL (Optional)
            </label>
            <input
              id="wa-webhook-input"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://api.fonnte.com/send"
              className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-text-primary text-xs font-mono focus:outline-none focus:border-border-strong"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="wa-api-key-input"
                className="text-xs font-medium font-sans text-text-secondary block"
              >
                Webhook Token (Optional)
              </label>
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="text-[11px] text-text-tertiary hover:text-text-primary font-mono cursor-pointer"
              >
                {showApiKey ? "Hide" : "Show"}
              </button>
            </div>
            <input
              id="wa-api-key-input"
              type={showApiKey ? "text" : "password"}
              value={waApiKey}
              onChange={(e) => setWaApiKey(e.target.value)}
              placeholder={hasWaApiKey ? "Configured (leave blank to keep)" : "Bearer or gateway token"}
              autoComplete="off"
              className="w-full px-3 py-1.5 rounded bg-canvas border border-border text-text-primary text-xs font-mono focus:outline-none focus:border-border-strong"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-[11px] font-mono text-text-tertiary">
            Fallback environment keys: SMTP_HOST · SMTP_PORT · SMTP_USER · SMTP_PASS
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 rounded text-xs font-medium bg-text-primary text-canvas hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving Configuration..." : "Save SMTP & Channel Settings"}
          </button>
        </div>
      </form>

      {/* Automated Mailer Dispatch & Live Template Preview Toolbar */}
      <div className="pt-4 border-t border-border-subtle space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Email Workflows &amp; Template Inspection
            </h3>
            <p className="text-[11px] text-text-tertiary mt-0.5">
              Inspect exact corporate HTML payloads in EN / ID / ZH or execute live SMTP delivery.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="smtp-preview-locale" className="text-[11px] font-mono text-text-tertiary">
              Locale
            </label>
            <select
              id="smtp-preview-locale"
              value={previewLocale}
              onChange={(e) => setPreviewLocale(e.target.value as "EN" | "ID" | "ZH")}
              className="px-2 py-1 rounded bg-canvas border border-border text-xs font-mono text-text-primary"
            >
              <option value="EN">EN (English)</option>
              <option value="ID">ID (Indonesia)</option>
              <option value="ZH">ZH (Chinese)</option>
            </select>

            <label htmlFor="smtp-preview-template" className="sr-only">
              Preview Template
            </label>
            <select
              id="smtp-preview-template"
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value as EmailTemplateKey)}
              className="px-2 py-1 rounded bg-canvas border border-border text-xs font-sans text-text-primary"
            >
              <option value="kill-switch">Kill-Switch Cancellation Notice</option>
              <option value="monthly-statement">Monthly .xlsx Executive Statement</option>
              <option value="cutoff-digest">Cutoff &amp; Due-Date Digest</option>
              <option value="ledger-backup">Off-Site JSON + Excel Backup</option>
              <option value="test-dispatch">SMTP Diagnostic Ping</option>
            </select>

            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handlePreviewTemplate(selectedTemplate)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-surface-elevated hover:bg-surface-active text-text-primary border border-border-strong transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              {busyAction === "preview" ? "Rendering..." : "Preview HTML"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => handleDispatchEmailWorkflow("test")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-surface-subtle hover:bg-surface-elevated text-text-primary border border-border transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-accent" />
            {busyAction === "test" ? "Dispatching..." : "Send Test Email"}
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => handleDispatchEmailWorkflow("statement")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-surface-subtle hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border transition-colors disabled:opacity-50 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {busyAction === "statement"
              ? "Building Statement..."
              : `Monthly .xlsx Statement (${targetMonth}/${targetYear})`}
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => handleDispatchEmailWorkflow("digest")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-surface-subtle hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            {busyAction === "digest" ? "Generating Digest..." : "Cutoff & Due-Date Digest"}
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => handleDispatchEmailWorkflow("backup")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-surface-subtle hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border transition-colors disabled:opacity-50 cursor-pointer"
          >
            <HardDriveDownload className="w-3.5 h-3.5" />
            {busyAction === "backup" ? "Packaging Backup..." : "Off-Site JSON + Excel Backup"}
          </button>
        </div>
      </div>

      {/* Native <dialog> Top-Layer Email Preview Modal */}
      <dialog
        ref={previewDialogRef}
        aria-labelledby="smtp-preview-dialog-title"
        onClick={(e) => {
          if (e.target === previewDialogRef.current) {
            closePreviewDialog();
          }
        }}
        className="erp-dialog shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-surface-subtle">
          <div className="min-w-0 pr-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
              {previewPayload?.status === "SENT" ? "Dispatched Email Record" : "Dry-Run Email Preview"} ·{" "}
              {previewPayload?.locale ?? previewLocale}
            </div>
            <h3
              id="smtp-preview-dialog-title"
              className="text-sm font-semibold text-text-primary truncate mt-0.5"
            >
              {previewPayload?.subject || "Email Template Preview"}
            </h3>
          </div>
          <button
            type="button"
            onClick={closePreviewDialog}
            aria-label="Close email preview"
            className="p-1.5 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {previewPayload && (
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono bg-canvas border border-border-subtle rounded p-3">
              <div>
                <span className="text-text-tertiary">From: </span>
                <span className="text-text-primary">{platformFromDisplay}</span>
              </div>
              <div>
                <span className="text-text-tertiary">To: </span>
                <span className="text-text-primary">{previewPayload.recipientEmail}</span>
              </div>
              <div>
                <span className="text-text-tertiary">Transport: </span>
                <span
                  className={
                    previewPayload.status === "SENT" ? "text-delta-positive" : "text-caution"
                  }
                >
                  {previewPayload.status === "SENT"
                    ? `Live SMTP (${previewPayload.host || hostDisplay}:${previewPayload.port || portDisplay}${previewPayload.fallbackUsed ? " STARTTLS" : ""})`
                    : previewPayload.configured
                      ? "Dry-Run Preview (Bypassed Live SMTP Send)"
                      : "Dry-Run Preview (App Password Unset)"}
                </span>
              </div>
              {previewPayload.attachmentNames.length > 0 && (
                <div className="sm:col-span-2 text-text-secondary">
                  <span className="text-text-tertiary">Attachments: </span>
                  {previewPayload.attachmentNames.map((name, i) => (
                    <span key={name} className="mr-3">
                      {name} ({(previewPayload.attachmentSizesBytes[i] ?? 0).toLocaleString("en-US")} bytes)
                    </span>
                  ))}
                </div>
              )}
            </div>

            <iframe
              title="Email HTML Preview"
              sandbox=""
              srcDoc={previewPayload.htmlPreview}
              className="w-full h-[460px] rounded border border-border-subtle bg-[#F1F5F9]"
            />

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={closePreviewDialog}
                className="px-3.5 py-1.5 rounded text-xs font-medium bg-surface-elevated hover:bg-surface-active text-text-primary border border-border cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
