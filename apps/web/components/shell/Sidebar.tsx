"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { usePerspective } from "@/context/PerspectiveContext";
import { ModuleKey } from "@/lib/api";
import {
  LayoutDashboard,
  Wallet,
  ArrowDownNarrowWide,
  CreditCard,
  PiggyBank,
  ReceiptText,
  BookmarkCheck,
  ShieldCheck,
  BarChart3,
  FileSpreadsheet,
  Sliders,
} from "lucide-react";
import { SidebarNavItem } from "@/components/primitives/SidebarNavItem";

interface RouteItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  moduleKey: ModuleKey;
  badge?: string;
  badgeVariant?: "neutral" | "caution" | "urgency";
}

const PRIMARY_ROUTES: RouteItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard, moduleKey: "overview" },
  { label: "Payroll & Income", href: "/payroll", icon: Wallet, moduleKey: "corporate_payroll" },
  { label: "Allocations", href: "/allocations", icon: ArrowDownNarrowWide, moduleKey: "allocations" },
  { label: "Credit & Liabilities", href: "/credit", icon: CreditCard, moduleKey: "credit_liabilities" },
  { label: "Savings & Reservoirs", href: "/savings", icon: PiggyBank, moduleKey: "savings_vault" },
  { label: "Ledger", href: "/ledger", icon: ReceiptText, moduleKey: "ledger" },
];

const ANALYSIS_ROUTES: RouteItem[] = [
  { label: "Wishlist Simulator", href: "/wishlist", icon: BookmarkCheck, moduleKey: "wishlist_simulator" },
  { label: "Discipline Audit", href: "/audit", icon: ShieldCheck, moduleKey: "discipline_audit" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, moduleKey: "advanced_analytics" },
  { label: "Reports & Statements", href: "/reports", icon: FileSpreadsheet, moduleKey: "executive_reports" },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { isModuleEnabled, lifeStagePreset, uiDensityMode } = usePerspective();

  const visiblePrimaryRoutes = PRIMARY_ROUTES.filter(
    (route) => route.moduleKey === "corporate_payroll" ? (isModuleEnabled("corporate_payroll") || isModuleEnabled("income")) : isModuleEnabled(route.moduleKey)
  );
  const visibleAnalysisRoutes = ANALYSIS_ROUTES.filter((route) =>
    isModuleEnabled(route.moduleKey)
  );

  const systemRoutes = [
    { label: "Preferences", href: "/preferences", icon: Sliders },
    ...(user?.role === "PLATFORM_OWNER"
      ? [{ label: "Platform Admin", href: "/admin", icon: ShieldCheck }]
      : []),
  ];

  // Helper to append current search params (?month=X&year=Y) to navigation targets
  const getHrefWithParams = (href: string) => {
    const paramsStr = searchParams.toString();
    if (!paramsStr) return href;
    return `${href}?${paramsStr}`;
  };

  const isRouteActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="w-60 h-screen bg-surface-subtle border-r border-border flex flex-col justify-between shrink-0 select-none">
      {/* Top Section: App Branding & Navigation Links */}
      <div className="flex flex-col min-h-0 flex-1">
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-border-subtle">
          <div className="font-sans text-sm font-semibold tracking-tight text-text-primary">
            Sunday Funday
          </div>
          <div className="text-[11px] text-text-tertiary font-sans mt-0.5 flex items-center justify-between">
            <span>Personal Finance ERP</span>
            {uiDensityMode === "SIMPLE_CLARITY" && (
              <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-border text-text-secondary">
                Simple
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {/* Main Financial Modules */}
          <div>
            <div className="px-3 pb-1.5 text-[10px] font-sans tracking-wider font-semibold text-text-tertiary uppercase">
              Financial Engine
            </div>
            <div className="space-y-0.5">
              {visiblePrimaryRoutes.map((route) => (
                <SidebarNavItem
                  key={route.href}
                  label={route.label}
                  href={getHrefWithParams(route.href)}
                  icon={route.icon}
                  isActive={isRouteActive(route.href)}
                  badge={route.badge}
                  badgeVariant={route.badgeVariant}
                  onClick={onNavigate}
                />
              ))}
            </div>
          </div>

          {/* Analysis & Simulation */}
          {visibleAnalysisRoutes.length > 0 && (
            <div>
              <div className="px-3 pb-1.5 text-[10px] font-sans tracking-wider font-semibold text-text-tertiary uppercase">
                Audit & Decision
              </div>
              <div className="space-y-0.5">
                {visibleAnalysisRoutes.map((route) => (
                  <SidebarNavItem
                    key={route.href}
                    label={route.label}
                    href={getHrefWithParams(route.href)}
                    icon={route.icon}
                    isActive={isRouteActive(route.href)}
                    badge={route.badge}
                    badgeVariant={route.badgeVariant}
                    onClick={onNavigate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* System & Configuration */}
          <div>
            <div className="px-3 pb-1.5 text-[10px] font-sans tracking-wider font-semibold text-text-tertiary uppercase">
              System
            </div>
            <div className="space-y-0.5">
              {systemRoutes.map((route) => (
                <SidebarNavItem
                  key={route.href}
                  label={route.label}
                  href={getHrefWithParams(route.href)}
                  icon={route.icon}
                  isActive={isRouteActive(route.href)}
                  onClick={onNavigate}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Module Manager Shortcut */}
        <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-tertiary">
          <span className="truncate font-mono text-[10px]">
            {lifeStagePreset.replace(/_/g, " ")}
          </span>
          <Link
            href="/preferences?tab=modules"
            onClick={onNavigate}
            className="text-text-secondary hover:text-text-primary underline underline-offset-2 shrink-0 ml-2"
          >
            Modules
          </Link>
        </div>
      </div>
    </aside>
  );
}
