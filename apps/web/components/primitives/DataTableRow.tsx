import React from "react";

export interface DataTableRowProps {
  date: string;
  title: string;
  subtitle?: string;
  category?: string;
  badge?: {
    text: string;
    variant?: "default" | "positive" | "negative" | "caution" | "urgency";
  };
  hideStatusColumn?: boolean;
  amount: string;
  type?: "income" | "expense" | "deduction" | "neutral";
  tenorInfo?: string;
  isHeader?: boolean;
  action?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const badgeVariantStyles = {
  default: "bg-surface-active/60 text-text-secondary border-border-subtle",
  positive: "bg-[rgba(16,183,141,0.10)] text-delta-positive border-[rgba(16,183,141,0.25)]",
  negative: "bg-[rgba(224,108,83,0.10)] text-delta-negative border-[rgba(224,108,83,0.25)]",
  caution: "bg-[rgba(229,155,44,0.10)] text-caution border-[rgba(229,155,44,0.25)]",
  urgency: "bg-[rgba(255,56,56,0.12)] text-urgency border-[rgba(255,56,56,0.35)]",
};

export function DataTableRow({
  date,
  title,
  subtitle,
  category,
  badge,
  hideStatusColumn = false,
  amount,
  type = "neutral",
  tenorInfo,
  action,
  className = "",
  onClick,
}: DataTableRowProps) {
  const getAmountColor = () => {
    switch (type) {
      case "income":
        return "text-delta-positive font-medium";
      case "expense":
      case "deduction":
        return "text-text-primary";
      default:
        return "text-text-primary";
    }
  };

  return (
    <div
      onClick={onClick}
      className={`group flex items-center justify-between py-2.5 px-3 border-b border-border-subtle text-xs transition-colors duration-100 ${
        onClick ? "cursor-pointer hover:bg-surface-hover/70" : "hover:bg-surface-hover/40"
      } ${className}`}
    >
      {/* Col 1: Date (tabular monospace) */}
      <div className="w-20 sm:w-24 shrink-0 font-mono text-text-tertiary text-[11px] tabular-nums">
        {date}
      </div>

      {/* Col 2: Title & optional subtitle */}
      <div className="flex-1 min-w-0 pr-2 sm:pr-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary truncate">{title}</span>
          {tenorInfo && (
            <span className="font-mono text-[10px] text-text-tertiary shrink-0 tabular-nums">
              ({tenorInfo})
            </span>
          )}
        </div>
        {subtitle && (
          <div className="text-[11px] text-text-tertiary truncate mt-0.5">{subtitle}</div>
        )}
      </div>

      {/* Col 3: Category / Tag */}
      {category && (
        <div className="min-w-[160px] max-w-[260px] shrink-0 hidden md:flex items-center pr-3">
          <span className="inline-flex items-center whitespace-nowrap truncate font-sans text-[11px] font-medium text-text-secondary px-2 py-0.5 rounded bg-surface-subtle border border-border-subtle">
            {category}
          </span>
        </div>
      )}

      {/* Col 4: Status / Flag badge */}
      {!hideStatusColumn && (
        <div className="w-24 sm:w-28 shrink-0 hidden sm:flex justify-center">
          {badge ? (
            <span
              className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded border text-[11px] font-sans font-medium ${
                badgeVariantStyles[badge.variant || "default"]
              }`}
            >
              {badge.text}
            </span>
          ) : null}
        </div>
      )}

      {/* Col 5: Numeric Amount (strictly tabular monospace) & optional Action */}
      <div className="w-auto sm:w-44 shrink-0 flex items-center justify-end gap-1.5 sm:gap-2">
        <span className={`font-mono text-xs sm:text-[13px] tabular-nums ${getAmountColor()}`}>
          {amount}
        </span>
        {action ? (
          <div className="shrink-0 flex items-center justify-end gap-1">{action}</div>
        ) : (
          <div className="w-0 shrink-0" />
        )}
      </div>
    </div>
  );
}

export function DataTableHeader({
  dateLabel = "DATE",
  titleLabel = "DESCRIPTION",
  categoryLabel = "CATEGORY",
  statusLabel = "STATUS",
  amountLabel = "AMOUNT",
  className = "",
}: {
  dateLabel?: string;
  titleLabel?: string;
  categoryLabel?: string;
  statusLabel?: string;
  amountLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 px-3 border-b border-border text-[10px] font-mono tracking-wider font-semibold text-text-tertiary bg-surface-subtle/50 uppercase ${className}`}
    >
      <div className="w-20 sm:w-24 shrink-0">{dateLabel}</div>
      <div className="flex-1 min-w-0 pr-2 sm:pr-4">{titleLabel}</div>
      {categoryLabel ? (
        <div className="min-w-[160px] max-w-[260px] shrink-0 hidden md:block pr-3">{categoryLabel}</div>
      ) : null}
      {statusLabel ? (
        <div className="w-24 sm:w-28 shrink-0 hidden sm:block text-center">{statusLabel}</div>
      ) : null}
      <div className="w-auto sm:w-44 shrink-0 text-right">{amountLabel}</div>
    </div>
  );
}
