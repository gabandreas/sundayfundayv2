"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { usePerspective } from "@/context/PerspectiveContext";
import { TranslationKey, useLanguage } from "@/context/LanguageContext";
import { usePeriod } from "@/context/PeriodContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { CustomSidebarShortcut, ModuleKey } from "@/lib/api";
import { syncSubInUrl } from "@/lib/tabs";
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
  Repeat,
  Sliders,
  TrendingDown,
  Bookmark,
  Compass,
  Calculator,
  CalendarDays,
  ListChecks,
  FileUp,
  FlaskConical,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { SidebarNavItem } from "@/components/primitives/SidebarNavItem";
import { BrandMark } from "@/components/primitives/BrandMark";

interface SubModuleDef {
  key: string;
  labelKey: TranslationKey;
  defaultSub?: boolean;
  aliases?: string[];
}

interface RouteItem {
  labelKey: TranslationKey;
  standardLabelKey?: TranslationKey;
  href: string;
  icon: typeof LayoutDashboard;
  moduleKey?: ModuleKey;
  standardOnly?: boolean;
}

export const SUBMODULES_BY_ROUTE: Record<string, SubModuleDef[]> = {
  "/payroll": [
    { key: "payslip", labelKey: "sub.payroll.payslip", defaultSub: true },
    { key: "timeline", labelKey: "sub.payroll.timeline" },
    { key: "lifeenergy", labelKey: "sub.payroll.lifeenergy" },
  ],
  "/allocations": [
    { key: "waterfall", labelKey: "sub.allocations.waterfall", defaultSub: true },
    { key: "envelopes", labelKey: "sub.allocations.envelopes", aliases: ["revisions"] },
  ],
  "/credit": [
    { key: "matrix", labelKey: "sub.credit.matrix", defaultSub: true, aliases: ["overview", "cards"] },
    { key: "simulator", labelKey: "sub.credit.simulator", aliases: ["contracts", "reconciler"] },
  ],
  "/savings": [
    { key: "pockets", labelKey: "sub.savings.vault", defaultSub: true, aliases: ["vault"] },
    { key: "runway", labelKey: "sub.savings.networth", aliases: ["networth", "forecaster"] },
  ],
  "/reports": [
    { key: "executive", labelKey: "sub.reports.executive", defaultSub: true },
    { key: "variance", labelKey: "sub.reports.variance" },
    { key: "export", labelKey: "sub.reports.export", aliases: ["audit"] },
  ],
  "/preferences": [
    { key: "formula", labelKey: "sub.preferences.formula", defaultSub: true, aliases: ["payroll", "sandbox"] },
    { key: "instruments", labelKey: "sub.preferences.instruments", aliases: ["policy"] },
    { key: "templates", labelKey: "sub.preferences.templates", aliases: ["buckets", "accounts"] },
    { key: "display", labelKey: "sub.preferences.display", aliases: ["navigation", "modules", "requests", "ai", "marquee", "copilot"] },
    { key: "notifications", labelKey: "sub.preferences.notifications", aliases: ["killswitch"] },
    { key: "backup", labelKey: "sub.preferences.backup" },
  ],
};

const PRIMARY_ROUTES: RouteItem[] = [
  {
    labelKey: "nav.overview",
    standardLabelKey: "nav.standard.overview",
    href: "/",
    icon: LayoutDashboard,
    moduleKey: "overview",
  },
  {
    labelKey: "nav.ledger",
    standardLabelKey: "nav.standard.transactions",
    href: "/ledger",
    icon: ReceiptText,
    moduleKey: "ledger",
    standardOnly: true,
  },
  {
    labelKey: "nav.paydayWizard",
    href: "/payday-wizard",
    icon: ListChecks,
    moduleKey: "payday_wizard",
  },
  {
    labelKey: "nav.cashRadar",
    standardLabelKey: "nav.standard.bills",
    href: "/calendar",
    icon: CalendarDays,
    moduleKey: "cash_radar",
  },
  {
    labelKey: "nav.payroll",
    standardLabelKey: "nav.standard.income",
    href: "/payroll",
    icon: Wallet,
    moduleKey: "corporate_payroll",
  },
  {
    labelKey: "nav.allocations",
    standardLabelKey: "nav.standard.budgets",
    href: "/allocations",
    icon: ArrowDownNarrowWide,
    moduleKey: "allocations",
  },
  {
    labelKey: "nav.credit",
    href: "/credit",
    icon: CreditCard,
    moduleKey: "credit_liabilities",
  },
  {
    labelKey: "nav.savings",
    standardLabelKey: "nav.standard.accounts",
    href: "/savings",
    icon: PiggyBank,
    moduleKey: "savings_vault",
  },
  {
    labelKey: "nav.import",
    href: "/import",
    icon: FileUp,
    moduleKey: "statement_import",
  },
];

const ANALYSIS_ROUTES: RouteItem[] = [
  {
    labelKey: "nav.scenarios",
    standardLabelKey: "nav.standard.planner",
    href: "/scenarios",
    icon: FlaskConical,
    moduleKey: "scenarios",
  },
  {
    labelKey: "nav.analytics",
    href: "/analytics",
    icon: BarChart3,
    moduleKey: "advanced_analytics",
  },
  {
    labelKey: "nav.reports",
    standardLabelKey: "nav.standard.reports",
    href: "/reports",
    icon: FileSpreadsheet,
    moduleKey: "executive_reports",
  },
];

const SHORTCUT_ICONS: Record<string, typeof LayoutDashboard> = {
  TrendingDown,
  Bookmark,
  Compass,
  Calculator,
  Wallet,
  CreditCard,
  PiggyBank,
};

export function Sidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
} = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { isModuleEnabled, isBespokeWorkspace, studioConfig } = usePerspective();
  const { t } = useLanguage();
  const { month, year } = usePeriod();

  const liveSub = searchParams.get("sub") || searchParams.get("tab") || "";
  const navCfg = studioConfig?.sidebarNavigationConfig;
  const overrides = navCfg?.moduleOverrides ?? {};
  const customShortcuts = navCfg?.customShortcuts ?? [];

  const isRouteHidden = (href: string) => Boolean(overrides[href]?.hidden);
  const getRouteLabel = (route: RouteItem) => {
    const customLabel = overrides[route.href]?.label?.trim();
    if (customLabel) return customLabel;
    if (!isBespokeWorkspace && route.standardLabelKey) {
      return t(route.standardLabelKey);
    }
    return t(route.labelKey);
  };

  const visiblePrimaryRoutes = PRIMARY_ROUTES.filter((route) => {
    if (isRouteHidden(route.href)) return false;
    if (route.standardOnly && isBespokeWorkspace) return false;
    if (!route.moduleKey) return true;
    if (route.moduleKey === "corporate_payroll") {
      return isBespokeWorkspace
        ? isModuleEnabled("corporate_payroll") || isModuleEnabled("income")
        : isModuleEnabled("income") || isModuleEnabled("corporate_payroll");
    }
    return isModuleEnabled(route.moduleKey);
  });

  const visibleAnalysisRoutes = ANALYSIS_ROUTES.filter((route) => {
    if (isRouteHidden(route.href)) return false;
    if (!route.moduleKey) return true;
    return isModuleEnabled(route.moduleKey);
  });

  const rawSystemRoutes: RouteItem[] = [
    ...(!isBespokeWorkspace && isModuleEnabled("wishlist_simulator")
      ? [{ labelKey: "nav.wishlist" as TranslationKey, href: "/wishlist", icon: BookmarkCheck }]
      : []),
    { labelKey: "nav.subscriptions", href: "/subscriptions", icon: Repeat },
    {
      labelKey: "nav.preferences",
      href: "/preferences",
      icon: Sliders,
    },
    ...(user?.role === "SUPERADMIN"
      ? [{ labelKey: "nav.admin" as TranslationKey, href: "/admin", icon: ShieldCheck }]
      : []),
  ];
  const systemRoutes: RouteItem[] = rawSystemRoutes.filter((r) => !isRouteHidden(r.href));

  const getHrefWithParams = (href: string, subKey?: string) => {
    const joiner = href.includes("?") ? "&" : "?";
    return subKey
      ? `${href}${joiner}sub=${encodeURIComponent(subKey)}&month=${month}&year=${year}`
      : `${href}${joiner}month=${month}&year=${year}`;
  };

  const isRouteActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const renderRouteGroup = (routes: RouteItem[], sectionShortcuts: CustomSidebarShortcut[]) => (
    <div className="space-y-0.5">
      {routes.map((route) => (
        <SidebarNavItem
          key={route.href}
          label={getRouteLabel(route)}
          href={getHrefWithParams(route.href)}
          icon={route.icon}
          isActive={isRouteActive(route.href)}
          collapsed={collapsed}
          onClick={onNavigate}
        />
      ))}

      {sectionShortcuts.map((sc) => {
        const ScIcon = SHORTCUT_ICONS[sc.icon] || Bookmark;
        const targetParts = sc.targetHref.split("?");
        const baseTarget = targetParts[0] || "/";
        const qs = new URLSearchParams(targetParts[1] || "");
        const targetSub = qs.get("sub");
        const href = getHrefWithParams(baseTarget, targetSub || undefined);
        const isCurrentShortcut =
          pathname === baseTarget && (!targetSub || liveSub === targetSub);

        return (
          <Link
            key={sc.id}
            href={href}
            prefetch={true}
            aria-current={isCurrentShortcut ? "page" : undefined}
            title={collapsed ? sc.label : undefined}
            onClick={(e) => {
              if (pathname === baseTarget && targetSub) {
                e.preventDefault();
                syncSubInUrl(targetSub, baseTarget);
              }
              onNavigate?.();
            }}
            className={`group flex items-center rounded-md text-xs font-medium transition-colors ${
              collapsed ? "justify-center h-9 w-9 mx-auto px-0" : "gap-2.5 px-3 py-1.5"
            } ${
              isCurrentShortcut
                ? "bg-surface-active text-text-primary font-semibold border-l-2 border-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-hover/70 border-l-2 border-transparent"
            }`}
          >
            <ScIcon className="w-4 h-4 shrink-0 text-accent" strokeWidth={1.8} aria-hidden="true" />
            {!collapsed && <span className="truncate">{sc.label}</span>}
          </Link>
        );
      })}
    </div>
  );

  return (
    <aside
      className={`erp-sidebar-rail h-screen bg-surface-subtle border-r border-border-subtle flex flex-col justify-between shrink-0 select-none transition-[width] duration-150 ease-out ${
        collapsed ? "w-[60px]" : "w-full"
      }`}
    >
      <div className="flex flex-col min-h-0 flex-1">
        {/* Brand Header aligned with 48px AppHeader hairline */}
        <div
          className={`h-12 border-b border-border-subtle flex items-center shrink-0 ${
            collapsed ? "justify-center px-2" : "justify-between px-3.5"
          }`}
        >
          <Link
            href={getHrefWithParams("/")}
            className="flex items-center gap-2.5 min-w-0 rounded"
            title={t("app.title")}
          >
            <BrandMark size={20} className="shrink-0" />
            {!collapsed && (
              <span className="font-sans text-[13px] font-semibold tracking-tight text-text-primary truncate">
                {t("app.title")}
              </span>
            )}
          </Link>
        </div>

        {/* Single Semantic Navigation Landmark */}
        <nav
          aria-label="Primary"
          className={`flex-1 overflow-y-auto py-3 ${collapsed ? "px-1.5 space-y-3" : "px-2.5 space-y-4"}`}
        >
          <div>
            {!collapsed && (
              <div className="px-3 pb-1 text-[11px] font-sans font-medium text-text-tertiary">
                {t("nav.section.engine")}
              </div>
            )}
            {renderRouteGroup(
              visiblePrimaryRoutes,
              customShortcuts.filter((s) => s.sectionGroup === "FINANCIAL_ENGINE"),
            )}
          </div>

          {(visibleAnalysisRoutes.length > 0 ||
            customShortcuts.some((s) => s.sectionGroup === "AUDIT_DECISION")) && (
            <div className={collapsed ? "pt-2 border-t border-border-subtle" : ""}>
              {!collapsed && (
                <div className="px-3 pb-1 text-[11px] font-sans font-medium text-text-tertiary">
                  {t("nav.section.audit")}
                </div>
              )}
              {renderRouteGroup(
                visibleAnalysisRoutes,
                customShortcuts.filter((s) => s.sectionGroup === "AUDIT_DECISION"),
              )}
            </div>
          )}

          <div className={collapsed ? "pt-2 border-t border-border-subtle" : ""}>
            {!collapsed && (
              <div className="px-3 pb-1 text-[11px] font-sans font-medium text-text-tertiary">
                {t("nav.section.system")}
              </div>
            )}
            {renderRouteGroup(
              systemRoutes,
              customShortcuts.filter((s) => s.sectionGroup === "SYSTEM"),
            )}
          </div>
        </nav>

        {/* Mobile Locale Switcher */}
        {!collapsed && (
          <div className="sm:hidden px-3.5 py-2 border-t border-border-subtle flex items-center justify-between">
            <span className="text-[11px] font-mono text-text-tertiary">Locale</span>
            <LanguageSwitcher compact />
          </div>
        )}

        {/* Restrained Sidebar Footer: Module Link + Collapse Toggle */}
        <div
          className={`h-10 border-t border-border-subtle flex items-center shrink-0 ${
            collapsed ? "justify-center px-1" : "justify-between px-3"
          }`}
        >
          {!collapsed && (
            <Link
              href="/preferences?sub=navigation"
              onClick={onNavigate}
              className="text-[11px] font-sans text-text-tertiary hover:text-text-primary transition-colors truncate"
            >
              {t("nav.modules")}
            </Link>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              data-testid="sidebar-collapse-toggle"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar ([)" : "Collapse sidebar ([)"}
              className="p-1.5 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            >
              {collapsed ? (
                <PanelLeftOpen className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
