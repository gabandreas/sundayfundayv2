"use client";

import React from "react";
import { MarqueeRobotAvatar } from "@/components/primitives/MarqueeRobotAvatar";

interface MarqueeFloatingLauncherProps {
  isOpen: boolean;
  onToggle: () => void;
  hasReminder?: boolean;
}

/**
 * Icon-only floating bottom-right launcher for the Marquee Financial Co-Pilot drawer.
 * Features the custom animated <MarqueeRobotAvatar /> vector emblem and clean dark-slate styling.
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
          ? "bg-surface-active border-accent/60"
          : "bg-surface hover:bg-surface-hover text-text-primary border-border-strong"
      }`}
    >
      <MarqueeRobotAvatar state={isOpen ? "thinking" : "idle"} size={24} />
      {!isOpen && hasReminder && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-delta-positive border border-canvas"
        />
      )}
    </button>
  );
}
