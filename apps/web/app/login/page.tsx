"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldCheck,
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Clock,
} from "lucide-react";

function LoginForm() {
  const { login, demoLogin } = useAuth();
  const searchParams = useSearchParams();
  const isExpired = searchParams.get("expired") === "1";

  const [lockedIdentity, setLockedIdentity] = useState<{
    accountName: string;
    username: string;
    fullName: string;
    role: string;
  } | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Security PIN states when untrusted IP is detected
  const [requiresPin, setRequiresPin] = useState(false);
  const [detectedIp, setDetectedIp] = useState<string | null>(null);
  const [securityPin, setSecurityPin] = useState("");
  const [trustIp, setTrustIp] = useState(true);
  const [ipLabel, setIpLabel] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("erp_locked_identity");
      if (stored) {
        setLockedIdentity(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const targetUsername = lockedIdentity ? lockedIdentity.username : username.trim();

    try {
      const res = await login({
        username: targetUsername,
        password,
        securityPin: requiresPin ? securityPin : undefined,
        trustIp: requiresPin ? trustIp : undefined,
        ipLabel: requiresPin ? ipLabel : undefined,
      });

      if (res.requiresPin) {
        setRequiresPin(true);
        setDetectedIp(res.detectedIp || null);
        setErrorMessage(
          res.message ||
            "Untrusted network IP detected. Enter your 6-digit Security PIN to verify this session."
        );
      } else {
        localStorage.removeItem("erp_locked_identity");
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || "Authentication failed. Check your credentials."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await demoLogin();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to launch General Demo Sandbox.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchAccount = () => {
    try {
      localStorage.removeItem("erp_locked_identity");
    } catch {}
    setLockedIdentity(null);
    setPassword("");
    setErrorMessage(null);
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-2xl">
      {/* Brand Header */}
      <div className="mb-6">
        <div className="text-[11px] font-mono tracking-wider text-text-tertiary uppercase">
          Sunday Funday ERP
        </div>
        <h1 className="text-2xl font-serif text-text-primary font-normal tracking-tight mt-1">
          {requiresPin
            ? "Security PIN Verification"
            : lockedIdentity
            ? `Session Locked — ${lockedIdentity.fullName}`
            : "Sign in to ERP Workspace"}
        </h1>
        <p className="text-xs text-text-secondary mt-1 font-mono">
          {requiresPin
            ? `Client IP: ${detectedIp || "Unknown"}`
            : lockedIdentity
            ? `User: ${lockedIdentity.fullName || lockedIdentity.username}`
            : "Enterprise financial workspace access"}
        </p>
      </div>

      {/* Session Expired Alert */}
      {isExpired && !errorMessage && (
        <div className="mb-5 p-3 rounded-md border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5 text-xs text-amber-300">
          <Clock className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            Session expired due to inactivity. Enter your password to unlock.
          </div>
        </div>
      )}

      {/* Error / Alert Notice */}
      {errorMessage && (
        <div className="mb-5 p-3 rounded-md border border-negative/30 bg-negative/10 flex items-start gap-2.5 text-xs text-negative">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!requiresPin && (
          <>
            {/* Show Username ONLY if NOT locked */}
            {!lockedIdentity && (
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-text-tertiary" />
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    autoFocus
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary focus:outline-none focus:border-border-strong font-mono"
                  />
                </div>
              </div>
            )}

            {/* Field: Password (Always shown, autofocused in locked mode) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-text-secondary">
                  Password
                </label>
                {lockedIdentity && (
                  <span className="text-[11px] font-mono text-emerald-400">
                    Quick Re-Auth
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-text-tertiary" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  required
                  autoFocus={Boolean(lockedIdentity)}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-9 pr-10 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary focus:outline-none focus:border-border-strong font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-text-tertiary hover:text-text-primary transition-colors"
                  tabIndex={-1}
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
        )}

        {/* Untrusted IP Security PIN Challenge */}
        {requiresPin && (
          <div className="p-4 rounded-lg border border-border-strong bg-surface-subtle space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1.5">
                6-Digit Security PIN
              </label>
              <input
                type="password"
                maxLength={6}
                autoFocus
                required
                value={securityPin}
                onChange={(e) => setSecurityPin(e.target.value)}
                placeholder="••••••"
                className="w-full px-3 py-2 text-center tracking-[0.5em] text-sm font-mono rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-border-strong"
              />
              <p className="text-[11px] text-text-tertiary mt-1">
                Enter the 6-digit PIN configured for this workspace.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Device / Location Label
              </label>
              <input
                type="text"
                value={ipLabel}
                onChange={(e) => setIpLabel(e.target.value)}
                placeholder="e.g. Office Remote IP"
                className="w-full px-3 py-1.5 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none focus:border-border-strong font-sans"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={trustIp}
                onChange={(e) => setTrustIp(e.target.checked)}
                className="rounded border-border text-text-primary focus:ring-0"
              />
              <span>Trust and permanently whitelist this IP address</span>
            </label>

            <button
              type="button"
              onClick={() => {
                setRequiresPin(false);
                setSecurityPin("");
                setErrorMessage(null);
              }}
              className="text-[11px] text-text-tertiary hover:text-text-secondary underline"
            >
              Back to credential login
            </button>
          </div>
        )}

        {/* Submit Action */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 py-2.5 px-4 rounded font-medium text-xs bg-text-primary text-canvas hover:opacity-95 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <span>
            {isLoading
              ? "Authenticating..."
              : requiresPin
              ? "Verify PIN & Access Workspace"
              : lockedIdentity
              ? "Unlock Session"
              : "Sign in to Workspace"}
          </span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        {/* Locked Session Switch Account Link */}
        {lockedIdentity && !requiresPin && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={handleSwitchAccount}
              className="text-xs text-text-tertiary hover:text-text-secondary underline cursor-pointer transition-colors"
            >
              Sign in with a different account
            </button>
          </div>
        )}
      </form>

      {/* General Sandbox Entry */}
      <div className="mt-6 pt-5 border-t border-border space-y-2">
        <div className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider text-center">
          Interactive Evaluation & Demo Sandbox
        </div>
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={isLoading}
          className="w-full py-2 px-3 text-xs rounded border border-emerald-500/30 bg-surface-subtle hover:bg-emerald-950/20 text-text-secondary hover:text-emerald-300 transition-colors flex items-center justify-center gap-1.5 font-mono cursor-pointer disabled:opacity-50"
        >
          <span>Explore General Sandbox (Demo) &rarr;</span>
        </button>
      </div>

      {/* Security Footer Note */}
      <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-[11px] text-text-tertiary font-mono">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-text-secondary" />
          <span>Scrypt + 30-min JWT Gate</span>
        </div>
        <span>Phase 12 Enterprise</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-canvas flex flex-col justify-center items-center p-6 select-none">
      <Suspense fallback={<div className="text-text-tertiary text-xs">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
