"use client";

import React, { useEffect, useState } from "react";
import { Check, KeyRound, EyeOff, Globe } from "lucide-react";
import {
  DisplayPreferencesConfig,
  ModularStudioConfig,
  PrivacyPreferencesConfig,
  changeAccountPassword,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePerspective } from "@/context/PerspectiveContext";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

export function AccountDisplayPanel({ initialConfig }: { initialConfig?: ModularStudioConfig }) {
  const { user } = useAuth();
  const { locale, setLocale } = useLanguage();
  const { studioConfig, updateStudioConfig } = usePerspective();
  const { isAmountsMasked, toggleMask, hideFigures } = usePrivacyMask();

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
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (active?.displayPreferences) {
      setDisplayPrefs(active.displayPreferences);
    }
    if (active?.privacyPreferences) {
      setPrivacyPrefs(active.privacyPreferences);
    }
  }, [active]);

  const handleSaveDisplayAndPrivacy = async () => {
    setSavingPrefs(true);
    setPrefsMsg(null);
    await updateStudioConfig({
      displayPreferences: displayPrefs,
      privacyPreferences: privacyPrefs,
    });
    if (displayPrefs.defaultLanguage === "en" || displayPrefs.defaultLanguage === "id" || displayPrefs.defaultLanguage === "zh") {
      setLocale(displayPrefs.defaultLanguage);
    }
    if (privacyPrefs.maskBalancesByDefault) {
      hideFigures();
    } else if (isAmountsMasked) {
      toggleMask();
    }
    setSavingPrefs(false);
    setPrefsMsg({ ok: true, text: "Display & privacy defaults saved." });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (!currentPassword || !newPassword) {
      setPasswordMsg({ ok: false, text: "Enter both your current password and a new password." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ ok: false, text: "New password must be at least 8 characters long." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, text: "New password and confirmation do not match." });
      return;
    }
    setSavingPassword(true);
    const res = await changeAccountPassword({ currentPassword, newPassword });
    setSavingPassword(false);
    if (!res.success) {
      setPasswordMsg({ ok: false, text: res.error || "Failed to update password." });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMsg({ ok: true, text: res.message || "Password updated cleanly." });
  };

  const isDemoSandbox = user?.id === 2;

  return (
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
              <span>{isAmountsMasked ? "Currently Masked — Click to Reveal" : "Currently Visible — Click to Mask"}</span>
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
              Signed in as <span className="font-mono text-text-secondary">{user?.email || "Active User"}</span>
            </p>
          </div>
        </div>

        {isDemoSandbox ? (
          <div className="p-3 rounded erp-callout-caution text-xs text-caution">
            Demo Sandbox password changes are disabled so public evaluators can continue signing in cleanly.
          </div>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
            {passwordMsg && (
              <div
                className={`px-3 py-2 rounded border text-xs ${
                  passwordMsg.ok
                    ? "border-delta-positive/40 bg-[rgba(16,183,141,0.08)] text-delta-positive"
                    : "border-delta-negative/40 bg-[rgba(224,108,83,0.08)] text-delta-negative"
                }`}
              >
                {passwordMsg.text}
              </div>
            )}

            <label className="space-y-1 block">
              <span className="text-text-secondary font-medium block">Current Password</span>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-canvas border border-border text-text-primary font-mono"
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-text-secondary font-medium block">New Password (min 8 chars)</span>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-canvas border border-border text-text-primary font-mono"
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-text-secondary font-medium block">Confirm New Password</span>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-canvas border border-border text-text-primary font-mono"
              />
            </label>

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
  );
}
