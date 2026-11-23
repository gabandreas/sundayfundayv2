"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, AlertCircle, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { resetPasswordApi, validateResetTokenApi } from "@/lib/api";
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

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useLanguage();
  const token = searchParams.get("token") || "";

  const [checkingToken, setCheckingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!token.trim()) {
      setCheckingToken(false);
      setTokenValid(false);
      return;
    }

    validateResetTokenApi(token)
      .then((res) => {
        if (!active) return;
        setTokenValid(Boolean(res?.valid));
      })
      .catch(() => {
        if (!active) return;
        setTokenValid(false);
      })
      .finally(() => {
        if (active) setCheckingToken(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

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
      await resetPasswordApi({ token, newPassword, confirmPassword, locale });
      router.replace("/login?reset=1");
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update password.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
          {t("auth.resetTitle")}
        </h1>
        <p className="text-xs text-text-secondary mt-1 leading-relaxed">
          {t("auth.resetSubtitle")}
        </p>
      </div>

      {checkingToken ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs text-text-secondary font-mono">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t("auth.authenticating")}</span>
        </div>
      ) : !tokenValid ? (
        <div className="space-y-4">
          <div
            role="alert"
            className="p-3.5 rounded-md border border-negative/30 bg-negative/10 flex items-start gap-2.5 text-xs text-negative"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{t("auth.resetInvalidToken")}</div>
          </div>

          <Link
            href="/forgot-password"
            className="w-full py-2.5 px-4 rounded font-medium text-xs erp-btn-primary flex items-center justify-center gap-2"
          >
            <span>{t("auth.requestNewLink")}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t("auth.backToLogin")}</span>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3 rounded-md border border-negative/30 bg-negative/10 flex items-start gap-2.5 text-xs text-negative"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <div>
            <label
              htmlFor="reset-new-password"
              className="block text-xs font-medium text-text-secondary mb-1.5"
            >
              {t("auth.newPassword")}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-text-tertiary pointer-events-none" />
              <input
                id="reset-new-password"
                name="new-password"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                enterKeyHint="next"
                minLength={10}
                required
                aria-describedby="reset-password-rules"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="w-full pl-9 pr-10 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary focus:outline-none focus:border-border-strong font-sans"
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
            <p id="reset-password-rules" className="text-[11px] text-text-tertiary mt-1.5">
              {t("auth.passwordRules")}
            </p>
          </div>

          <div>
            <label
              htmlFor="reset-confirm-password"
              className="block text-xs font-medium text-text-secondary mb-1.5"
            >
              {t("auth.confirmPassword")}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-text-tertiary pointer-events-none" />
              <input
                id="reset-confirm-password"
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
                className="w-full pl-9 pr-10 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary focus:outline-none focus:border-border-strong font-sans"
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
            <span>{isSubmitting ? t("auth.authenticating") : t("auth.saveNewPassword")}</span>
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen w-full bg-canvas flex flex-col justify-center items-center p-4 sm:p-6">
      <Suspense fallback={<div className="text-text-tertiary text-xs">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
