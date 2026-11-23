"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Check,
  KeyRound,
  EyeOff,
  Eye,
  Globe,
  MonitorSmartphone,
  LogOut,
  Trash2,
} from "lucide-react";
import {
  ActiveSessionRecord,
  DisplayPreferencesConfig,
  ModularStudioConfig,
  PrivacyPreferencesConfig,
  changeAccountPassword,
  listActiveSessionsApi,
  revokeSessionApi,
  logoutAllDevicesApi,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePerspective } from "@/context/PerspectiveContext";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useToast } from "@/context/ToastContext";

function meetsPasswordPolicy(password: string): boolean {
  return (
    password.length >= 10 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

export function AccountDisplayPanel({ initialConfig }: { initialConfig?: ModularStudioConfig }) {
  const { user, applySessionBundle, logout } = useAuth();
  const { locale, setLocale } = useLanguage();
  const { studioConfig, updateStudioConfig } = usePerspective();
  const { isAmountsMasked, toggleMask, hideFigures } = usePrivacyMask();
  const { toast } = useToast();

  const active = studioConfig ?? initialConfig;

  const [displayPrefs, setDisplayPrefs] = useState<DisplayPreferencesConfig>(() => ({
    defaultLanguage: active?.displayPreferences?.defaultLanguage ?? (locale as "en" | "id" | "zh") ?? "en",
    numberFormat: active?.displayPreferences?.numberFormat ?? "id-ID",
    uiDensity: active?.displayPreferences?.uiDensity ?? "COMMAND_COCKPIT",
    hidePriorityCodesInUi: active?.displayPreferences?.hidePriorityCodesInUi ?? true,
  }));

  const [privacyPrefs, setPrivacyPrefs] = useState<PrivacyPreferencesConfig>(() => ({
    maskBalancesByDefault: active?.privacyPreferences?.maskBalancesByDefault ?? false,
    requirePasswordToReveal: active?.privacyPreferences?.requirePasswordToReveal ?? false,
  }));

  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [sessions, setSessions] = useState<ActiveSessionRecord[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (active?.displayPreferences) {
      setDisplayPrefs(active.displayPreferences);
    }
    if (active?.privacyPreferences) {
      setPrivacyPrefs(active.privacyPreferences);
    }
  }, [active]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const list = await listActiveSessionsApi();
      setSessions(Array.isArray(list) ? list : []);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id && user.id !== 2) {
      void loadSessions();
    }
  }, [user?.id, loadSessions]);

  const handleSaveDisplayAndPrivacy = async () => {
    setSavingPrefs(true);
    setPrefsMsg(null);
    await updateStudioConfig({
      displayPreferences: displayPrefs,
      privacyPreferences: privacyPrefs,
    });
    if (
      displayPrefs.defaultLanguage === "en" ||
      displayPrefs.defaultLanguage === "id" ||
      displayPrefs.defaultLanguage === "zh"
    ) {
      setLocale(displayPrefs.defaultLanguage);
    }
    if (privacyPrefs.maskBalancesByDefault) {
      hideFigures();
    } else if (isAmountsMasked) {
      toggleMask();
    }
    setSavingPrefs(false);
    setPrefsMsg({ ok: true, text: "Display & privacy defaults saved." });
    toast({
      title: "Display preferences saved",
      description: "Language and masking defaults updated.",
      variant: "success",
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (!currentPassword || !newPassword) {
      setPasswordMsg({ ok: false, text: "Enter both your current password and a new password." });
      return;
    }
    if (!meetsPasswordPolicy(newPassword)) {
      setPasswordMsg({
        ok: false,
        text: "New password must be at least 10 characters with uppercase, lowercase, and a number.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, text: "New password and confirmation do not match." });
      return;
    }

    setSavingPassword(true);
    const res = await changeAccountPassword({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    setSavingPassword(false);

    if (!res.success) {
      setPasswordMsg({ ok: false, text: res.error || "Failed to update password." });
      return;
    }

    if (res.accessToken && res.user) {
      applySessionBundle({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      });
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMsg({ ok: true, text: res.message || "Password updated cleanly." });
    void loadSessions();
  };

  const handleRevokeSession = async (sessionId: string) => {
    setSessionNotice(null);
    try {
      await revokeSessionApi(sessionId);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      setSessionNotice("Device session revoked.");
    } catch (err: any) {
      setSessionNotice(err?.message || "Failed to revoke session.");
    }
  };

  const handleSignOutAllDevices = async () => {
    setSessionNotice(null);
    try {
      await logoutAllDevicesApi();
      await logout(false);
    } catch (err: any) {
      setSessionNotice(err?.message || "Failed to sign out all devices.");
    }
  };

  const isDemoSandbox = user?.id === 2;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 7 Cols: Language, Display & Privacy Defaults */}
        <section className="lg:col-span-7 rounded-lg border border-border bg-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-delta-positive shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-text-primary font-sans">
                  Display, Language &amp; Privacy Defaults
                </h3>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Configure interface language, density mode, and startup balance masking behavior.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={savingPrefs}
              onClick={handleSaveDisplayAndPrivacy}
              className="erp-btn-primary px-3 py-1.5 rounded text-xs font-medium cursor-pointer disabled:opacity-50"
            >
              {savingPrefs ? "Saving..." : "Save Defaults"}
            </button>
          </div>

          {prefsMsg && (
            <div className="px-3 py-2 rounded border border-delta-positive/40 bg-[rgba(16,183,141,0.08)] text-xs text-delta-positive flex items-center gap-2">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{prefsMsg.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <label className="space-y-1.5">
              <span className="text-text-secondary font-medium block">Interface Language</span>
              <select
                value={displayPrefs.defaultLanguage}
                onChange={(e) =>
                  setDisplayPrefs({
                    ...displayPrefs,
                    defaultLanguage: e.target.value as "en" | "id" | "zh",
                  })
                }
                className="w-full px-2.5 py-1.5 rounded bg-canvas border border-border text-text-primary"
              >
                <option value="en">English (EN)</option>
                <option value="id">Bahasa Indonesia (ID)</option>
                <option value="zh">简体中文 (ZH)</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-text-secondary font-medium block">Number Grouping Format</span>
              <select
                value={displayPrefs.numberFormat}
                onChange={(e) =>
                  setDisplayPrefs({
                    ...displayPrefs,
                    numberFormat: e.target.value as "id-ID" | "en-US",
                  })
                }
                className="w-full px-2.5 py-1.5 rounded bg-canvas border border-border text-text-primary"
              >
                <option value="id-ID">Indonesian (Rp 1.500.000)</option>
                <option value="en-US">International (Rp 1,500,000)</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-text-secondary font-medium block">Workspace Density</span>
              <select
                value={displayPrefs.uiDensity}
                onChange={(e) =>
                  setDisplayPrefs({
                    ...displayPrefs,
                    uiDensity: e.target.value as "COMMAND_COCKPIT" | "SIMPLE_CLARITY",
                  })
                }
                className="w-full px-2.5 py-1.5 rounded bg-canvas border border-border text-text-primary"
              >
                <option value="COMMAND_COCKPIT">Detailed ERP Tables</option>
                <option value="SIMPLE_CLARITY">Focused Clarity</option>
              </select>
            </label>

            <div className="space-y-2 pt-1">
              <span className="text-text-secondary font-medium block">Active Balance Mask</span>
              <button
                type="button"
                onClick={() => toggleMask()}
                className="erp-btn-secondary inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>
                  {isAmountsMasked
                    ? "Currently Masked — Click to Reveal"
                    : "Currently Visible — Click to Mask"}
                </span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-border-subtle space-y-2 text-xs">
            <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={privacyPrefs.maskBalancesByDefault}
                onChange={(e) =>
                  setPrivacyPrefs({ ...privacyPrefs, maskBalancesByDefault: e.target.checked })
                }
              />
              <span>Mask currency amounts automatically when a new browser session opens</span>
            </label>
            <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={displayPrefs.hidePriorityCodesInUi}
                onChange={(e) =>
                  setDisplayPrefs({ ...displayPrefs, hidePriorityCodesInUi: e.target.checked })
                }
              />
              <span>Use plain financial labels across cards and tables</span>
            </label>
          </div>
        </section>

        {/* Right 5 Cols: Account Password Change */}
        <section className="lg:col-span-5 rounded-lg border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
            <KeyRound className="w-4 h-4 text-caution shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-text-primary font-sans">
                Account Security &amp; Password
              </h3>
              <p className="text-xs text-text-tertiary mt-0.5">
                {user?.email || "Active Account"}
              </p>
            </div>
          </div>

          {isDemoSandbox ? (
            <div className="p-3 rounded erp-callout-caution text-xs text-caution">
              Demo Sandbox password changes are disabled so evaluators can continue signing in cleanly.
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
              {passwordMsg && (
                <div
                  role={passwordMsg.ok ? "status" : "alert"}
                  className={`px-3 py-2 rounded border text-xs ${
                    passwordMsg.ok
                      ? "border-delta-positive/40 bg-[rgba(16,183,141,0.08)] text-delta-positive"
                      : "border-delta-negative/40 bg-[rgba(224,108,83,0.08)] text-delta-negative"
                  }`}
                >
                  {passwordMsg.text}
                </div>
              )}

              <div>
                <label
                  htmlFor="acct-current-password"
                  className="text-text-secondary font-medium block mb-1"
                >
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="acct-current-password"
                    name="current-password"
                    type={showCurrent ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-2.5 pr-9 py-1.5 rounded bg-canvas border border-border text-text-primary font-mono"
                  />
                  <button
                    type="button"
                    aria-pressed={showCurrent}
                    aria-label={showCurrent ? "Hide current password" : "Show current password"}
                    onClick={() => setShowCurrent((p) => !p)}
                    className="absolute right-2 top-1.5 text-text-tertiary hover:text-text-primary p-0.5 cursor-pointer"
                  >
                    {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="acct-new-password"
                  className="text-text-secondary font-medium block mb-1"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="acct-new-password"
                    name="new-password"
                    type={showNew ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={10}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-2.5 pr-9 py-1.5 rounded bg-canvas border border-border text-text-primary font-mono"
                  />
                  <button
                    type="button"
                    aria-pressed={showNew}
                    aria-label={showNew ? "Hide new password" : "Show new password"}
                    onClick={() => setShowNew((p) => !p)}
                    className="absolute right-2 top-1.5 text-text-tertiary hover:text-text-primary p-0.5 cursor-pointer"
                  >
                    {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-text-tertiary mt-1">
                  Minimum 10 characters with uppercase, lowercase, and a number.
                </p>
              </div>

              <div>
                <label
                  htmlFor="acct-confirm-password"
                  className="text-text-secondary font-medium block mb-1"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="acct-confirm-password"
                    name="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={10}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-2.5 pr-9 py-1.5 rounded bg-canvas border border-border text-text-primary font-mono"
                  />
                  <button
                    type="button"
                    aria-pressed={showConfirm}
                    aria-label={showConfirm ? "Hide confirmation password" : "Show confirmation password"}
                    onClick={() => setShowConfirm((p) => !p)}
                    className="absolute right-2 top-1.5 text-text-tertiary hover:text-text-primary p-0.5 cursor-pointer"
                  >
                    {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                className="erp-btn-primary w-full py-2 rounded text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                {savingPassword ? "Updating Password..." : "Update Password"}
              </button>
            </form>
          )}
        </section>
      </div>

      {/* Active Sessions & Devices */}
      {!isDemoSandbox && (
        <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="w-4 h-4 text-text-secondary shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-text-primary font-sans">
                  Active Sessions &amp; Devices
                </h3>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Review active browser and mobile sessions and sign out unfamiliar devices immediately.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOutAllDevices}
              className="erp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-negative cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out All Devices</span>
            </button>
          </div>

          {sessionNotice && (
            <div className="px-3 py-2 rounded border border-border bg-surface-subtle text-xs text-text-secondary">
              {sessionNotice}
            </div>
          )}

          {sessionsLoading ? (
            <div className="text-xs font-mono text-text-tertiary py-2">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="text-xs text-text-tertiary py-2">
              No active refresh-tracked sessions recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {sessions.map((s) => (
                <div
                  key={s.sessionId}
                  className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 font-medium text-text-primary">
                      <span>{s.deviceName}</span>
                      <span className="px-1.5 py-0.5 rounded border border-border text-[10px] font-mono text-text-tertiary">
                        {s.platform}
                      </span>
                      {s.isCurrent && (
                        <span className="px-1.5 py-0.5 rounded border border-delta-positive/30 bg-[rgba(16,183,141,0.08)] text-[10px] font-mono text-delta-positive">
                          Current Session
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-text-tertiary mt-0.5">
                      IP: {s.clientIp || "Unknown"} · Last active{" "}
                      {new Date(s.lastUsedAt).toLocaleString()}
                    </div>
                  </div>
                  {!s.isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(s.sessionId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border text-[11px] text-text-secondary hover:text-negative hover:border-negative/40 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Revoke</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
