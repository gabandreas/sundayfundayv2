"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

export interface SidebarNavItemProps {
  label: string;
  href: string;
  icon: LucideIcon;
  isActive?: boolean;
  collapsed?: boolean;
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
  collapsed = false,
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
      prefetch={false}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={`group relative flex items-center rounded-md text-xs font-medium transition-colors duration-150 cursor-pointer select-none ${
        collapsed ? "justify-center h-9 w-9 mx-auto px-0" : "justify-between px-3 py-1.5"
      } ${
        isActive
          ? "bg-surface-active text-text-primary font-semibold border-l-2 border-accent"
          : "text-text-secondary hover:text-text-primary hover:bg-surface-hover/70 border-l-2 border-transparent"
      } ${className}`}
    >
      <div className={`flex items-center min-w-0 ${collapsed ? "" : "gap-2.5"}`}>
        <Icon
          aria-hidden="true"
          className={`w-4 h-4 shrink-0 transition-colors ${
            isActive
              ? "text-accent"
              : "text-text-tertiary group-hover:text-text-secondary"
          }`}
          strokeWidth={1.8}
        />
        {!collapsed && <span className="truncate">{label}</span>}
      </div>

      {!collapsed && badge && (
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
