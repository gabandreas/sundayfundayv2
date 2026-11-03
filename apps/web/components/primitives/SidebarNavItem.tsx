import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

export interface SidebarNavItemProps {
  label: string;
  href: string;
  icon: LucideIcon;
  isActive?: boolean;
  badge?: string;
  badgeVariant?: "neutral" | "caution" | "urgency";
  className?: string;
  onClick?: () => void;
}

export function SidebarNavItem({
  label,
  href,
  icon: Icon,
  isActive = false,
  badge,
  badgeVariant = "neutral",
  className = "",
  onClick,
}: SidebarNavItemProps) {
  const badgeStyles = {
    neutral: "bg-surface-subtle text-text-tertiary border-border-subtle",
    caution: "bg-[rgba(229,155,44,0.12)] text-caution border-[rgba(229,155,44,0.3)]",
    urgency: "bg-[rgba(255,56,56,0.14)] text-urgency border-[rgba(255,56,56,0.35)]",
  };

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors duration-100 ${
        isActive
          ? "bg-surface-active text-text-primary shadow-sm"
          : "text-text-secondary hover:text-text-primary hover:bg-surface-hover/50"
      } ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Direct, unadorned icon — strictly NO pastel circular background */}
        <Icon
          className={`w-4 h-4 shrink-0 transition-colors ${
            isActive ? "text-text-primary" : "text-text-tertiary group-hover:text-text-secondary"
          }`}
          strokeWidth={1.8}
        />
        <span className="truncate">{label}</span>
      </div>

      {badge && (
        <span
          className={`px-1.5 py-0.5 text-[10px] font-mono font-medium rounded border ${
            badgeStyles[badgeVariant]
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
