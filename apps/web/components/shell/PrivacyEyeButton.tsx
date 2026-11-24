"use client";

import React from "react";
import { Eye, EyeOff } from "lucide-react";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useLanguage } from "@/context/LanguageContext";

interface PrivacyEyeButtonProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "icon" | "sidebar";
  collapsed?: boolean;
}

export function PrivacyEyeButton({
  className = "",
  size = "md",
  variant = "icon",
  collapsed = false,
}: PrivacyEyeButtonProps) {
  const { isAmountsMasked, toggleMask } = usePrivacyMask();
  const { t } = useLanguage();

  const iconClass =
    size === "xs"
      ? "w-3.5 h-3.5"
      : size === "sm"
      ? "w-4 h-4"
      : size === "lg"
      ? "w-5 h-5"
      : "w-4.5 h-4.5";

  const ariaLabel = isAmountsMasked ? "Show amounts" : "Hide amounts";

  if (variant === "sidebar") {
    if (collapsed) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleMask();
          }}
          title={`${ariaLabel} (Alt+H)`}
          aria-label={ariaLabel}
          aria-pressed={isAmountsMasked}
          data-testid="sidebar-privacy-toggle"
          className={`h-9 w-9 mx-auto rounded-md flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer ${className}`}
        >
          {isAmountsMasked ? (
            <Eye className="w-4 h-4" strokeWidth={1.8} />
          ) : (
            <EyeOff className="w-4 h-4 text-accent" strokeWidth={1.8} />
          )}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleMask();
        }}
        title={`${ariaLabel} (Alt+H)`}
        aria-label={ariaLabel}
        aria-pressed={isAmountsMasked}
        data-testid="sidebar-privacy-toggle"
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs font-sans text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer ${className}`}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          {isAmountsMasked ? (
            <Eye className="w-3.5 h-3.5 text-text-tertiary shrink-0" strokeWidth={1.8} />
          ) : (
            <EyeOff className="w-3.5 h-3.5 text-accent shrink-0" strokeWidth={1.8} />
          )}
          <span className="truncate">
            {isAmountsMasked ? t("privacy.balancesHidden") : t("privacy.balancesVisible")}
          </span>
        </span>
        <kbd className="text-[10px] font-mono text-text-tertiary bg-canvas/70 border border-border-subtle px-1.5 py-0.5 rounded shrink-0">
          Alt+H
        </kbd>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleMask();
      }}
      title={ariaLabel}
      aria-label={ariaLabel}
      aria-pressed={isAmountsMasked}
      className={`p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-all cursor-pointer inline-flex items-center justify-center shrink-0 ${className}`}
    >
      {isAmountsMasked ? (
        <Eye className={iconClass} strokeWidth={2} />
      ) : (
        <EyeOff className={iconClass} strokeWidth={2} />
      )}
    </button>
  );
}
