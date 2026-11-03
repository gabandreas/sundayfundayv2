import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, AlertOctagon } from "lucide-react";

export type DeltaVariant = "positive" | "negative" | "caution" | "urgency" | "neutral";

export interface DeltaBadgeProps {
  variant: DeltaVariant;
  value: string;
  period?: string;
  direction?: "up" | "down" | "flat";
  className?: string;
}

const variantStyles: Record<DeltaVariant, { badge: string; text: string; icon: string }> = {
  positive: {
    badge: "bg-[rgba(16,183,141,0.10)] border-[rgba(16,183,141,0.25)]",
    text: "text-delta-positive",
    icon: "text-delta-positive",
  },
  negative: {
    badge: "bg-[rgba(224,108,83,0.10)] border-[rgba(224,108,83,0.25)]",
    text: "text-delta-negative",
    icon: "text-delta-negative",
  },
  caution: {
    badge: "bg-[rgba(229,155,44,0.10)] border-[rgba(229,155,44,0.25)]",
    text: "text-caution",
    icon: "text-caution",
  },
  urgency: {
    badge: "bg-[rgba(255,56,56,0.12)] border-[rgba(255,56,56,0.35)]",
    text: "text-urgency",
    icon: "text-urgency",
  },
  neutral: {
    badge: "bg-surface-active/50 border-border-subtle",
    text: "text-text-secondary",
    icon: "text-text-tertiary",
  },
};

export function DeltaBadge({
  variant,
  value,
  period,
  direction,
  className = "",
}: DeltaBadgeProps) {
  const styles = variantStyles[variant];

  // Resolve icon directly (unadorned, never in a pastel circular wrapper)
  const renderIcon = () => {
    if (variant === "urgency") {
      return <AlertOctagon className={`w-3 h-3 ${styles.icon} shrink-0`} strokeWidth={2.2} />;
    }
    if (variant === "caution") {
      return <AlertTriangle className={`w-3 h-3 ${styles.icon} shrink-0`} strokeWidth={2.2} />;
    }
    if (direction === "up") {
      return <ArrowUpRight className={`w-3 h-3 ${styles.icon} shrink-0`} strokeWidth={2.2} />;
    }
    if (direction === "down") {
      return <ArrowDownRight className={`w-3 h-3 ${styles.icon} shrink-0`} strokeWidth={2.2} />;
    }
    return <Minus className={`w-3 h-3 ${styles.icon} shrink-0`} strokeWidth={2.2} />;
  };

  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-mono leading-tight tracking-tight ${styles.badge} ${className}`}
    >
      {renderIcon()}
      <span className={`font-medium ${styles.text}`}>{value}</span>
      {period && (
        <span className="text-text-tertiary font-sans text-[11px] ml-0.5 tracking-normal">
          {period}
        </span>
      )}
    </div>
  );
}
