"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageSwitcher } from "@/components/shell/LanguageSwitcher";
import { BrandMark } from "@/components/primitives/BrandMark";
import {
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";

function LoginForm() {
  const { login, demoLogin } = useAuth();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const isExpired = searchParams.get("expired") === "1";
  const isSignedOut = searchParams.get("signedOut") === "1";
  const isPasswordReset = searchParams.get("reset") === "1";
  const nextPath = searchParams.get("next");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [requiresPin, setRequiresPin] = useState(false);
  const [detectedIp, setDetectedIp] = useState<string | null>(null);
  const [securityPin, setSecurityPin] = useState("");
  const [trustIp, setTrustIp] = useState(true);
  const [ipLabel, setIpLabel] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || isDemoLoading) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await login({
        username: username.trim(),
        password,
        securityPin: requiresPin ? securityPin.trim() : undefined,
        trustIp: requiresPin ? trustIp : undefined,
        ipLabel: requiresPin ? ipLabel.trim() || undefined : undefined,
        nextPath,
      });

      if (res.requiresPin) {
        setRequiresPin(true);
        setDetectedIp(res.detectedIp || null);
        setErrorMessage(
          res.message ||
            "Unrecognized network IP. Enter your 6-digit Security PIN to continue.",
        );
      } else {
        setIsTransitioning(true);
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || "Invalid username or password.",
      );
      setIsTransitioning(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    if (isLoading || isDemoLoading) return;
    setIsDemoLoading(true);
    setErrorMessage(null);
    try {
      await demoLogin();
      setIsTransitioning(true);
    } catch (err: any) {
      setIsTransitioning(false);
      setErrorMessage(err.message || "Failed to launch Demo Sandbox.");
    } finally {
      setIsDemoLoading(false);
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
          {requiresPin ? t("auth.pinTitle") : t("auth.signInTitle")}
        </h1>
        <p className="text-xs text-text-secondary mt-1">
          {requiresPin
            ? `IP: ${detectedIp || "Unknown"}`
            : t("auth.signInSubtitle")}
        </p>
      </div>

      {isPasswordReset && !errorMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-5 p-3 rounded-md erp-callout-positive flex items-start gap-2.5 text-xs text-delta-positive"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{t("auth.resetSuccessNotice")}</div>
        </div>
      )}

      {isSignedOut && !errorMessage && !isPasswordReset && (
        <div
          role="status"
          aria-live="polite"
          className="mb-5 p-3 rounded-md border border-border bg-surface-subtle flex items-start gap-2.5 text-xs text-text-secondary"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-delta-positive" />
          <div className="leading-relaxed">{t("auth.signedOutNotice")}</div>
        </div>
      )}

      {isExpired && !errorMessage && !isSignedOut && !isPasswordReset && (
        <div
          role="status"
          aria-live="polite"
          className="mb-5 p-3 rounded-md erp-callout-caution flex items-start gap-2.5 text-xs text-caution"
        >
          <Clock className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{t("auth.sessionExpired")}</div>
        </div>
      )}

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
        {!requiresPin ? (
          <>
            <div>
              <label
                htmlFor="signin-username"
                className="block text-xs font-medium text-text-secondary mb-1.5"
              >
                {t("auth.username")}
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-2.5 text-text-tertiary pointer-events-none" />
                <input
                  id="signin-username"
                  type="text"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  autoFocus
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("auth.usernamePlaceholder")}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-border-strong font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="signin-password"
                  className="block text-xs font-medium text-text-secondary"
                >
                  {t("auth.password")}
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-text-tertiary hover:text-text-primary transition-colors"
                >
                  {t("auth.forgotPassword")}
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-text-tertiary pointer-events-none" />
                <input
                  id="signin-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  enterKeyHint="done"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.passwordPlaceholder")}
                  className="w-full pl-9 pr-10 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-border-strong font-sans"
                />
                <button
                  type="button"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-2 text-text-tertiary hover:text-text-primary transition-colors p-0.5 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-4 rounded-lg border border-border-strong bg-surface-subtle space-y-4">
            <div>
              <label
                htmlFor="signin-security-pin"
                className="block text-xs font-medium text-text-primary mb-1.5"
              >
                {t("auth.securityPin")}
              </label>
              <input
                id="signin-security-pin"
                name="securityPin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                enterKeyHint="done"
                maxLength={6}
                pattern="\d{6}"
                autoFocus
                required
                value={securityPin}
                onChange={(e) => setSecurityPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                className="w-full px-3 py-2 text-center tracking-[0.5em] text-sm font-mono rounded border border-border bg-surface text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-border-strong"
              />
              <p className="text-[11px] text-text-tertiary mt-1">
                {t("auth.securityPinHint")}
              </p>
            </div>

            <div>
              <label
                htmlFor="signin-device-label"
                className="block text-xs font-medium text-text-secondary mb-1"
              >
                {t("auth.deviceLabel")}
              </label>
              <input
                id="signin-device-label"
                name="ipLabel"
                type="text"
                value={ipLabel}
                onChange={(e) => setIpLabel(e.target.value)}
                placeholder={t("auth.devicePlaceholder")}
                className="w-full px-3 py-1.5 text-xs rounded border border-border bg-surface text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-border-strong font-sans"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={trustIp}
                onChange={(e) => setTrustIp(e.target.checked)}
                className="rounded border-border text-text-primary focus:ring-0"
              />
              <span>{t("auth.trustIp")}</span>
            </label>

            <button
              type="button"
              onClick={() => {
                setRequiresPin(false);
                setSecurityPin("");
                setErrorMessage(null);
              }}
              className="text-[11px] text-text-tertiary hover:text-text-secondary underline cursor-pointer"
            >
              {t("auth.backToLogin")}
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || isDemoLoading || (isTransitioning && !isDemoLoading)}
          className="w-full mt-2 py-2.5 px-4 rounded font-medium text-xs erp-btn-primary flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
        >
          <span>
            {isTransitioning && !isDemoLoading
              ? t("auth.transitioning")
              : isLoading
              ? t("auth.authenticating")
              : requiresPin
              ? t("auth.verifyPin")
              : t("auth.signInBtn")}
          </span>
          {isLoading || (isTransitioning && !isDemoLoading) ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ArrowRight className="w-3.5 h-3.5" />
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-border space-y-2">
        <div className="text-[10px] font-mono text-text-tertiary text-center">
          {t("auth.demoEyebrow")}
        </div>
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={isLoading || isDemoLoading}
          className="w-full py-2 px-3 text-xs rounded erp-btn-secondary flex items-center justify-center gap-1.5 font-mono cursor-pointer disabled:opacity-50"
        >
          <span>
            {isDemoLoading ? t("auth.transitioning") : `${t("auth.demoBtn")} \u2192`}
          </span>
          {isDemoLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-canvas flex flex-col justify-center items-center p-4 sm:p-6">
      <Suspense fallback={<div className="text-text-tertiary text-xs">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
