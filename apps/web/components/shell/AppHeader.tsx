"use client";

import React, { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Menu, Eye, EyeOff } from "lucide-react";
import { MonthYearSwitcher } from "./MonthYearSwitcher";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { AccountHeaderBadge } from "./AccountHeaderBadge";
import { useAuth } from "@/context/AuthContext";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

const ROUTE_TITLES: Record<string, { title: string; category: string }> = {
  "/": { title: "Overview", category: "Dashboard" },
  "/payroll": { title: "Payroll & Income", category: "Engine" },
  "/allocations": { title: "Waterfall Allocations", category: "Engine" },
  "/credit": { title: "Liabilities & Credit", category: "Engine" },
  "/savings": { title: "Savings & Reservoirs", category: "Engine" },
  "/ledger": { title: "Transaction Ledger", category: "Engine" },
  "/wishlist": { title: "Wishlist Simulator", category: "Decision" },
  "/audit": { title: "Discipline Audit", category: "Audit" },
  "/analytics": { title: "Analytics", category: "Audit" },
  "/reports": { title: "Reports & Statements", category: "Audit" },
  "/preferences": { title: "Preferences", category: "System" },
  "/admin": { title: "Platform Admin Console", category: "System" },
  "/admin/sql": { title: "Superadmin SQL Query Studio", category: "System" },
  "/dev/components": { title: "Design System Primitives", category: "Spec" },
};

export function AppHeader({ onToggleMobileDrawer }: { onToggleMobileDrawer?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isAmountsMasked, toggleMask } = usePrivacyMask();

  const routeInfo = ROUTE_TITLES[pathname] || {
    title: pathname.replace("/", ""),
    category: "View",
  };

  return (
    <header className="h-14 border-b border-border bg-canvas/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 select-none">
      {/* Route breadcrumb + Mobile Drawer Trigger */}
      <div className="flex items-center gap-2.5 text-xs font-sans">
        {onToggleMobileDrawer && (
          <button
            type="button"
            onClick={onToggleMobileDrawer}
            className="lg:hidden p-1.5 -ml-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
            title="Open navigation menu"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <span className="hidden sm:inline text-text-tertiary font-normal">
          {routeInfo.category}
        </span>
        <span className="hidden sm:inline text-border-strong select-none">/</span>
        <h1 className="font-medium text-text-primary tracking-tight">
          {routeInfo.title}
        </h1>
      </div>

      {/* Global Controls: Search + Period Context + Privacy Eye + Profile Badge */}
      <div className="flex items-center gap-2 sm:gap-3">
        <GlobalSearchModal />
        <Suspense
          fallback={
            <div className="h-8 w-28 sm:w-44 rounded-md bg-surface border border-border animate-pulse" />
          }
        >
          <MonthYearSwitcher />
        </Suspense>

        {/* Unified Global Privacy Eye Toggle */}
        {user && (
          <button
            type="button"
            onClick={toggleMask}
            title={
              isAmountsMasked
                ? "Privacy Mask Active: Click to reveal financial figures across workspace (password required)"
                : "Financial Figures Visible: Click to mask figures globally"
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all border cursor-pointer shadow-sm ${
              isAmountsMasked
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25"
                : "bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25"
            }`}
          >
            {isAmountsMasked ? (
              <>
                <Eye className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Reveal Figures</span>
                <span className="sm:hidden">Reveal</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Hide Figures</span>
                <span className="sm:hidden">Hide</span>
              </>
            )}
          </button>
        )}

        <AccountHeaderBadge />
      </div>
    </header>
  );
}
