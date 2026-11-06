"use client";

import React from "react";
import { Eye, EyeOff } from "lucide-react";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

interface PrivacyEyeButtonProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

export function PrivacyEyeButton({ className = "", size = "md" }: PrivacyEyeButtonProps) {
  const { isAmountsMasked, toggleMask } = usePrivacyMask();

  const iconClass =
    size === "xs"
      ? "w-3.5 h-3.5"
      : size === "sm"
      ? "w-4 h-4"
      : size === "lg"
      ? "w-5 h-5"
      : "w-4.5 h-4.5";

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
          ? "Amounts hidden. Click to reveal."
          : "Amounts visible. Click to hide."
      }
      aria-label={isAmountsMasked ? "Reveal amounts" : "Hide amounts"}
      className={`p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-elevated active:scale-95 transition-all cursor-pointer inline-flex items-center justify-center shrink-0 ${className}`}
    >
      {isAmountsMasked ? (
        <Eye className={iconClass} strokeWidth={2} />
      ) : (
        <EyeOff className={iconClass} strokeWidth={2} />
      )}
    </button>
  );
}
