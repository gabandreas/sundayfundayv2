"use client";

import React from "react";
import { MarqueeMark } from "@/components/primitives/MarqueeMark";

interface MarqueeFloatingLauncherProps {
  isOpen: boolean;
  onToggle: () => void;
  hasReminder?: boolean;
}

/**
 * Icon-only floating bottom-right launcher for the Marquee Financial Co-Pilot drawer.
 * Features the bespoke geometric <MarqueeMark /> vector emblem, clean dark-slate border contrast,
 * native hover tooltip ("Marquee Financial Co-Pilot (Alt+M)"), and a subtle static indicator dot.
 */
export function MarqueeFloatingLauncher({
  isOpen,
  onToggle,
  hasReminder = true,
}: MarqueeFloatingLauncherProps) {
  return (
    <button
      type="button"
      data-testid="marquee-floating-launcher"
      onClick={onToggle}
      aria-label="Toggle Marquee Financial Co-Pilot (Alt+M)"
      title="Marquee Financial Co-Pilot (Alt+M)"
      className={`fixed bottom-5 right-5 z-40 print-hidden inline-flex items-center justify-center w-11 h-11 rounded-full border shadow-xl transition-colors cursor-pointer ${
        isOpen
          ? "bg-text-primary text-canvas border-text-primary"
          : "bg-surface hover:bg-surface-hover text-text-primary border-border-strong"
      }`}
    >
      <MarqueeMark
        className={`w-5 h-5 shrink-0 ${
          isOpen ? "text-canvas" : "text-delta-positive"
        }`}
      />
      {!isOpen && hasReminder && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-delta-positive border border-canvas"
        />
      )}
    </button>
  );
}
