"use client";

import React from "react";
import { Eye, EyeOff } from "lucide-react";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

interface PrivacyEyeButtonProps {
  className?: string;
  size?: "sm" | "md";
}

export function PrivacyEyeButton({ className = "", size = "sm" }: PrivacyEyeButtonProps) {
  const { isAmountsMasked, toggleMask } = usePrivacyMask();

  const iconClass = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleMask();
      }}
      title={
        isAmountsMasked
          ? "Figures are hidden for privacy. Click to reveal (password required)."
          : "Figures are visible. Click to hide figures."
      }
      aria-label={isAmountsMasked ? "Reveal figures" : "Hide figures"}
      className={`p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer inline-flex items-center justify-center shrink-0 ${className}`}
    >
      {isAmountsMasked ? (
        <Eye className={iconClass} />
      ) : (
        <EyeOff className={iconClass} />
      )}
    </button>
  );
}
