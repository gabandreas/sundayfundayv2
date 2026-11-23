"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { User, ArrowLeft, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { forgotPasswordApi } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
import { BrandMark } from "@/components/primitives/BrandMark";

function ForgotPasswordForm() {
  const { t, locale } = useLanguage();
  const [identifier, setIdentifier] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    setSubmittedMessage(null);

    const clean = identifier.trim();
    if (!clean) {
      setErrorMessage(t("auth.usernamePlaceholder"));
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPasswordApi({ identifier: clean, locale });
      setSubmittedMessage(t("auth.resetEmailSent"));
    } catch (err: any) {
      setErrorMessage(err?.message || "Unable to submit password reset request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 sm:p-8 shadow-2xl">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-mono tracking-wider text-text-tertiary uppercase">
            <BrandMark size={20} />
            <span>{t("auth.eyebrow")}</span>
          </div>
          <LanguageSwitcher compact />
        </div>
        <h1 className="text-2xl font-serif text-text-primary font-normal tracking-tight mt-3">
          {t("auth.forgotTitle")}
        </h1>
        <p className="text-xs text-text-secondary mt-1 leading-relaxed">
          {t("auth.forgotSubtitle")}
        </p>
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

      {submittedMessage ? (
        <div className="space-y-5">
          <div
            role="status"
            aria-live="polite"
            className="p-3.5 rounded-md erp-callout-positive flex items-start gap-2.5 text-xs text-delta-positive"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{submittedMessage}</div>
          </div>

          <Link
            href="/login"
            className="w-full py-2.5 px-4 rounded font-medium text-xs erp-btn-secondary flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("auth.backToLogin")}</span>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="forgot-identifier"
              className="block text-xs font-medium text-text-secondary mb-1.5"
            >
              {t("auth.username")}
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-2.5 text-text-tertiary pointer-events-none" />
              <input
                id="forgot-identifier"
                type="text"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                autoFocus
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t("auth.usernamePlaceholder")}
                className="w-full pl-9 pr-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary focus:outline-none focus:border-border-strong font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded font-medium text-xs erp-btn-primary flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            <span>{isSubmitting ? t("auth.authenticating") : t("auth.sendResetLink")}</span>
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5" />
            )}
          </button>

          <div className="pt-2 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t("auth.backToLogin")}</span>
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen w-full bg-canvas flex flex-col justify-center items-center p-4 sm:p-6">
      <Suspense fallback={<div className="text-text-tertiary text-xs">Loading...</div>}>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
