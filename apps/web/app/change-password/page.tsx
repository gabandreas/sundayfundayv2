"use client";

import React, { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, AlertCircle, ArrowRight, LogOut, Loader2 } from "lucide-react";
import { completeFirstLoginPasswordApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
import { BrandMark } from "@/components/primitives/BrandMark";

function checkPasswordStrength(password: string): boolean {
  return (
    password.length >= 10 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

function FirstLoginPasswordForm() {
  const router = useRouter();
  const { user, applySessionBundle, logout, isLoading } = useAuth();
  const { t, locale } = useLanguage();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    if (!checkPasswordStrength(newPassword)) {
      setErrorMessage(t("auth.passwordRules"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage(t("auth.passwordMismatch"));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await completeFirstLoginPasswordApi({
        newPassword,
        confirmPassword,
        locale,
      });
      if (res.accessToken && res.user) {
        applySessionBundle(res);
      }
      router.replace("/");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center text-xs text-text-tertiary font-mono">
        {t("auth.authenticating")}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 sm:p-8 shadow-2xl">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-mono text-text-tertiary">
            <BrandMark size={20} />
            <span>{t("auth.eyebrow")}</span>
          </div>
          <LanguageSwitcher compact />
        </div>
        <h1 className="text-2xl font-serif text-text-primary font-normal tracking-tight mt-3">
          {t("auth.firstLoginTitle")}
        </h1>
        <p className="text-xs text-text-secondary mt-1 leading-relaxed">
          {t("auth.firstLoginSubtitle")}
        </p>
        {user?.email && (
          <div className="mt-2.5 text-[11px] font-mono text-text-tertiary">
            {user.fullName} · {user.email}
          </div>
        )}
      </div>

      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-5 p-3 rounded-md border border-negative/30 bg-negative/10 flex items-start gap-2.5 text-xs text-negative"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="first-login-new-password"
            className="block text-xs font-medium text-text-secondary mb-1.5"
          >
            {t("auth.newPassword")}
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-2.5 text-text-tertiary pointer-events-none" />
            <input
              id="first-login-new-password"
              name="new-password"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              enterKeyHint="next"
              minLength={10}
              required
              autoFocus
              aria-describedby="first-login-password-rules"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="w-full pl-9 pr-10 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-border-strong font-sans"
            />
            <button
              type="button"
              aria-pressed={showNew}
              aria-label={showNew ? t("auth.hidePassword") : t("auth.showPassword")}
              onClick={() => setShowNew((prev) => !prev)}
              className="absolute right-2.5 top-2 text-text-tertiary hover:text-text-primary p-0.5 cursor-pointer"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p id="first-login-password-rules" className="text-[11px] text-text-tertiary mt-1.5">
            {t("auth.passwordRules")}
          </p>
        </div>

        <div>
          <label
            htmlFor="first-login-confirm-password"
            className="block text-xs font-medium text-text-secondary mb-1.5"
          >
            {t("auth.confirmPassword")}
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-2.5 text-text-tertiary pointer-events-none" />
            <input
              id="first-login-confirm-password"
              name="confirm-password"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              enterKeyHint="done"
              minLength={10}
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="w-full pl-9 pr-10 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-border-strong font-sans"
            />
            <button
              type="button"
              aria-pressed={showConfirm}
              aria-label={showConfirm ? t("auth.hidePassword") : t("auth.showPassword")}
              onClick={() => setShowConfirm((prev) => !prev)}
              className="absolute right-2.5 top-2 text-text-tertiary hover:text-text-primary p-0.5 cursor-pointer"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 rounded font-medium text-xs erp-btn-primary flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
        >
          <span>{isSubmitting ? t("auth.authenticating") : t("auth.savePermanentPassword")}</span>
          {isSubmitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ArrowRight className="w-3.5 h-3.5" />
          )}
        </button>

        <div className="pt-2 border-t border-border-subtle flex justify-center">
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-negative transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t("auth.signOutBtn")}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <div className="min-h-screen w-full bg-canvas flex flex-col justify-center items-center p-4 sm:p-6">
      <Suspense fallback={<div className="text-text-tertiary text-xs">Loading...</div>}>
        <FirstLoginPasswordForm />
      </Suspense>
    </div>
  );
}
