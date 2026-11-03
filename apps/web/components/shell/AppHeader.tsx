"use client";

import React, { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Menu, Clock, RefreshCw, Eye, EyeOff } from "lucide-react";
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

function formatSessionTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function AppHeader({ onToggleMobileDrawer }: { onToggleMobileDrawer?: () => void }) {
  const pathname = usePathname();
  const { user, remainingSeconds, isSessionExpiring, refreshSession } = useAuth();
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

      {/* Account Header Badge + Session Timer + Global Search + Month/Year Context Switcher */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Live ERP Session Timer Pill */}
        {user && (
          <button
            type="button"
            onClick={refreshSession}
            title={`Session expires in ${formatSessionTime(remainingSeconds)}. Click to extend session.`}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-colors border cursor-pointer ${
              isSessionExpiring
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                : "border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-subtle"
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${isSessionExpiring ? "text-amber-400 animate-pulse" : "text-text-tertiary"}`} />
            <span>Session: {formatSessionTime(remainingSeconds)}</span>
            <RefreshCw className="w-2.5 h-2.5 text-text-tertiary opacity-70 hover:opacity-100" />
          </button>
        )}

        {/* Privacy Mask Eye Toggle */}
        {user && (
          <button
            type="button"
            onClick={toggleMask}
            title={
              isAmountsMasked
                ? "Privacy Mask Active: Click to reveal financial figures (password required)"
                : "Financial Figures Visible: Click to mask figures"
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
        <GlobalSearchModal />
        <Suspense
          fallback={
            <div className="h-8 w-28 sm:w-44 rounded-md bg-surface border border-border animate-pulse" />
          }
        >
          <MonthYearSwitcher />
        </Suspense>
      </div>
    </header>
  );
}
