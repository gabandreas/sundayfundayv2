"use client";

import React, { useState } from "react";
import { Lock, Eye, EyeOff, AlertCircle, X, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

export function VerifyPasswordModal() {
  const { user } = useAuth();
  const { isVerifyModalOpen, closeVerifyModal, revealFigures } = usePrivacyMask();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isVerifyModalOpen) return null;

  const isDemoUser = user?.role === "DEMO_SANDBOX" || user?.id === 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setIsLoading(true);
    setErrorMessage(null);

    const res = await revealFigures(password);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || "Invalid account password.");
    } else {
      setPassword("");
    }
  };

  const handleClose = () => {
    setPassword("");
    setErrorMessage(null);
    closeVerifyModal();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
        {/* Modal Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Financial Privacy Gate</span>
            </div>
            <h3 className="text-base font-medium text-text-primary">
              Verify Account Password
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Enter your account password to reveal financial figures.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-subtle transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* General Sandbox Demo Helper Note */}
        {isDemoUser && (
          <div className="p-2.5 rounded border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300 font-mono leading-relaxed">
            <span className="font-semibold">Sandbox Demo Password:</span>{" "}
            <code className="text-amber-200 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-400/20">
              Sandbox2026!
            </code>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-2.5 rounded border border-negative/30 bg-negative/10 flex items-start gap-2 text-xs text-negative">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Account Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-text-tertiary" />
              <input
                type={showPassword ? "text" : "password"}
                autoFocus
                required
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

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 text-xs rounded border border-border text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !password}
              className="px-3.5 py-1.5 text-xs font-medium rounded border border-border-strong bg-text-primary text-canvas hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              {isLoading ? "Verifying..." : "Verify & Reveal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
