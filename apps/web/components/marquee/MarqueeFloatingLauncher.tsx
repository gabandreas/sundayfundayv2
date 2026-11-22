"use client";

import React from "react";
import { MarqueeMark } from "@/components/primitives/MarqueeMark";

interface MarqueeFloatingLauncherProps {
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * Floating bottom-right launcher for the Marquee AI Co-Pilot drawer.
 * Features the bespoke geometric <MarqueeMark /> vector emblem, clean dark-slate border contrast,
 * and zero pulsing/bouncing animations.
 */
export function MarqueeFloatingLauncher({
  isOpen,
  onToggle,
}: MarqueeFloatingLauncherProps) {
  return (
    <button
      type="button"
      data-testid="marquee-floating-launcher"
      onClick={onToggle}
      aria-label="Toggle Marquee Financial Co-Pilot (Alt+M)"
      title="Marquee Financial Co-Pilot (Alt+M)"
      className={`fixed bottom-5 right-5 z-40 print-hidden inline-flex items-center gap-2.5 h-10 px-3.5 rounded-md border shadow-xl transition-colors cursor-pointer ${
        isOpen
          ? "bg-text-primary text-canvas border-text-primary"
          : "bg-surface hover:bg-surface-hover text-text-primary border-border-strong"
      }`}
    >
      <MarqueeMark
        className={`w-4 h-4 shrink-0 ${
          isOpen ? "text-canvas" : "text-delta-positive"
        }`}
      />
      <span className="text-xs font-sans font-medium tracking-tight">
        Marquee
      </span>
      <kbd
        className={`hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono border ${
          isOpen
            ? "border-canvas/30 text-canvas/90"
            : "border-border text-text-tertiary bg-canvas"
        }`}
      >
        Alt+M
      </kbd>
    </button>
  );
}
