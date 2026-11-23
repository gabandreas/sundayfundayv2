import React from "react";
import { X } from "lucide-react";

export type StatusBannerVariant = "info" | "success" | "warning" | "error";

interface StatusBannerProps {
  variant?: StatusBannerVariant;
  title: string;
  description?: string;
  onDismiss?: () => void;
  className?: string;
}

const STYLES: Record<StatusBannerVariant, string> = {
  info: "border-border border-l-2 border-l-border-strong bg-surface text-text-primary",
  success:
    "border-delta-positive/30 border-l-2 border-l-delta-positive bg-[rgba(16,183,141,0.06)] text-text-primary",
  warning: "erp-callout-caution border-l-2 border-l-caution text-caution",
  error:
    "border-urgency/40 border-l-2 border-l-urgency bg-[rgba(255,56,56,0.08)] text-text-primary",
};

export function StatusBanner({
  variant = "info",
  title,
  description,
  onDismiss,
  className = "",
}: StatusBannerProps) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`rounded-md border px-3.5 py-2.5 text-xs flex items-start justify-between gap-3 ${STYLES[variant]} ${className}`}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="font-medium text-text-primary">{title}</div>
        {description && (
          <div className="text-[11px] text-text-secondary leading-relaxed">
            {description}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="p-0.5 rounded text-text-tertiary hover:text-text-primary cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
