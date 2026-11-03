"use client";

import React from "react";
import { Eye } from "lucide-react";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

interface InlinePrivacyEyeProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function InlinePrivacyEye({
  className = "",
  size = "md",
}: InlinePrivacyEyeProps) {
  const { isAmountsMasked, openVerifyModal } = usePrivacyMask();

  if (!isAmountsMasked) return null;

  const iconSizeClass =
    size === "sm" ? "w-3 h-3" : size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openVerifyModal();
      }}
      title="Click to verify password & reveal figures"
      aria-label="Click to verify password and reveal figures"
      className={`inline-flex items-center justify-center p-1 rounded hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer border border-emerald-500/40 bg-emerald-500/10 shadow-xs shrink-0 ${className}`}
    >
      <Eye className={iconSizeClass} />
    </button>
  );
}
