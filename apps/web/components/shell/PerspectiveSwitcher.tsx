"use client";

import React, { useState } from "react";
import { usePerspective } from "@/context/PerspectiveContext";
import { ShieldCheck, Store, Wand2, Send, ChevronDown, Check, RotateCcw } from "lucide-react";
import { resetDemoSandbox } from "@/lib/api";

export function PerspectiveSwitcher() {
  const {
    profileMode,
    setProfileMode,
    setIsOnboardingOpen,
    setIsCustomRequestModalOpen,
  } = usePerspective();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const isStandard = profileMode === "STANDARD_GENERAL";

  const handleResetSandbox = async () => {
    if (window.confirm("Reset Demo Sandbox to clean corporate defaults?")) {
      setIsResetting(true);
      try {
        await resetDemoSandbox();
        window.location.reload();
      } catch (e) {
        console.error("Failed to reset sandbox", e);
        setIsResetting(false);
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Quick Launch & Sandbox Indicator when in Standard Edition */}
      {isStandard && (
        <div className="flex items-center gap-2 animate-fadeIn">
          {/* Topbar Sandbox Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[rgba(229,155,44,0.12)] border border-[rgba(229,155,44,0.30)] text-caution text-[11px] font-sans font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-caution animate-pulse" />
            <span>Sandbox Workspace (Personal Superadmin Data Hidden)</span>
          </div>

          <button
            type="button"
            disabled={isResetting}
            onClick={handleResetSandbox}
            className="h-8 px-2.5 rounded text-[11px] font-sans font-medium bg-surface-subtle hover:bg-surface-active text-text-primary border border-border transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Reset Sandbox back to initial pristine corporate template"
          >
            <RotateCcw className={`w-3 h-3 text-text-tertiary ${isResetting ? "animate-spin" : ""}`} />
            <span>{isResetting ? "Resetting..." : "Reset Demo Sandbox"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsOnboardingOpen(true)}
            className="h-8 px-2.5 rounded text-[11px] font-sans font-medium bg-accent text-white hover:bg-accent/90 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Launch 60-Second Onboarding Wizard"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Setup Wizard</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCustomRequestModalOpen(true)}
            className="h-8 px-2.5 rounded text-[11px] font-sans font-medium bg-surface-subtle hover:bg-surface-active text-text-primary border border-border transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Request Bespoke Rule or Module from Superadmin"
          >
            <Send className="w-3 h-3 text-text-tertiary" />
            <span>Request Rule</span>
          </button>
        </div>
      )}

      {/* Mode Switcher Pill Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={`h-8 px-2.5 rounded border text-xs font-sans font-medium flex items-center gap-2 transition-colors cursor-pointer ${
            isStandard
              ? "bg-[rgba(16,183,141,0.08)] border-[rgba(16,183,141,0.25)] text-delta-positive hover:bg-[rgba(16,183,141,0.12)]"
              : "bg-surface border-border text-text-primary hover:border-border-strong hover:bg-surface-active"
          }`}
        >
          {isStandard ? (
            <Store className="w-3.5 h-3.5 text-delta-positive" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
          )}
          <span>
            {isStandard ? "Standard Edition" : "Superadmin (Bespoke)"}
          </span>
          <ChevronDown className="w-3 h-3 text-text-tertiary" />
        </button>

        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setDropdownOpen(false)}
            />
            <div className="absolute right-0 top-9 z-50 w-64 rounded-lg border border-border bg-surface p-1.5 shadow-xl space-y-1">
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-text-tertiary border-b border-border-subtle">
                Application Perspective
              </div>

              <button
                type="button"
                onClick={async () => {
                  setDropdownOpen(false);
                  await setProfileMode("SUPERADMIN_BESPOKE");
                }}
                className={`w-full px-2.5 py-2 rounded text-xs font-sans text-left flex items-start justify-between gap-2 transition-colors cursor-pointer ${
                  !isStandard
                    ? "bg-surface-active text-text-primary font-medium"
                    : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                    <span>Superadmin (Bespoke)</span>
                  </div>
                  <p className="text-[10px] font-sans text-text-tertiary mt-0.5 leading-snug">
                    Owner mode: attendance 16–15 cutoff, bespoke routine slots (Vape/Haircut), and full admin controls.
                  </p>
                </div>
                {!isStandard && <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />}
              </button>

              <button
                type="button"
                onClick={async () => {
                  setDropdownOpen(false);
                  await setProfileMode("STANDARD_GENERAL");
                }}
                className={`w-full px-2.5 py-2 rounded text-xs font-sans text-left flex items-start justify-between gap-2 transition-colors cursor-pointer ${
                  isStandard
                    ? "bg-surface-active text-text-primary font-medium"
                    : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-delta-positive" />
                    <span>Standard Edition</span>
                  </div>
                  <p className="text-[10px] font-sans text-text-tertiary mt-0.5 leading-snug">
                    Commercial general user mode: streamlined salary, universal routine bills, and custom rule request studio.
                  </p>
                </div>
                {isStandard && <Check className="w-3.5 h-3.5 text-delta-positive shrink-0 mt-0.5" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

