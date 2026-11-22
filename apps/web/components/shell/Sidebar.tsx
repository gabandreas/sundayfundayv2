"use client";

import React, { useEffect, useState } from "react";
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
  ChevronRight,
  TrendingDown,
  Bookmark,
  Compass,
  Calculator,
  CalendarDays,
  ListChecks,
} from "lucide-react";
import { SidebarNavItem } from "@/components/primitives/SidebarNavItem";
import { MarqueeMark } from "@/components/primitives/MarqueeMark";

interface SubModuleDef {
  key: string;
  labelKey: TranslationKey;
  defaultSub?: boolean;
  aliases?: string[];
}

interface RouteItem {
  labelKey: TranslationKey;
  href: string;
  icon: typeof LayoutDashboard;
  moduleKey?: ModuleKey;
  subModules?: SubModuleDef[];
}

export const SUBMODULES_BY_ROUTE: Record<string, SubModuleDef[]> = {
  "/payroll": [
    { key: "payslip", labelKey: "sub.payroll.payslip", defaultSub: true },
    { key: "timeline", labelKey: "sub.payroll.timeline" },
    { key: "lifeenergy", labelKey: "sub.payroll.lifeenergy" },
  ],
  "/allocations": [
    { key: "waterfall", labelKey: "sub.allocations.waterfall", defaultSub: true },
    { key: "envelopes", labelKey: "sub.allocations.envelopes" },
    { key: "revisions", labelKey: "sub.allocations.revisions" },
  ],
  "/credit": [
    { key: "matrix", labelKey: "sub.credit.matrix", defaultSub: true, aliases: ["overview"] },
    { key: "contracts", labelKey: "sub.credit.contracts", aliases: ["cards"] },
    { key: "simulator", labelKey: "sub.credit.simulator" },
    { key: "reconciler", labelKey: "sub.credit.reconciler", aliases: ["kill-switches"] },
  ],
  "/savings": [
    { key: "networth", labelKey: "sub.savings.networth" },
    { key: "forecaster", labelKey: "sub.savings.forecaster" },
    { key: "vault", labelKey: "sub.savings.vault", defaultSub: true },
  ],
  "/reports": [
    { key: "executive", labelKey: "sub.reports.executive", defaultSub: true },
    { key: "variance", labelKey: "sub.reports.variance" },
    { key: "audit", labelKey: "sub.reports.audit" },
    { key: "export", labelKey: "sub.reports.export" },
  ],
  "/preferences": [
    { key: "formula", labelKey: "sub.preferences.formula", defaultSub: true, aliases: ["payroll"] },
    { key: "instruments", labelKey: "sub.preferences.instruments", aliases: ["policy"] },
    { key: "accounts", labelKey: "sub.preferences.accounts", aliases: ["sandbox"] },
    { key: "templates", labelKey: "sub.preferences.templates", aliases: ["buckets"] },
    { key: "navigation", labelKey: "sub.preferences.navigation", aliases: ["modules", "requests"] },
    { key: "notifications", labelKey: "sub.preferences.notifications", aliases: ["killswitch"] },
    { key: "ai", labelKey: "sub.preferences.ai", aliases: ["marquee", "copilot"] },
  ],
};

const PRIMARY_ROUTES: RouteItem[] = [
  { labelKey: "nav.overview", href: "/", icon: LayoutDashboard, moduleKey: "overview" },
  { labelKey: "nav.paydayWizard", href: "/payday-wizard", icon: ListChecks },
  { labelKey: "nav.cashRadar", href: "/calendar", icon: CalendarDays },
  {
    labelKey: "nav.payroll",
    href: "/payroll",
    icon: Wallet,
    moduleKey: "corporate_payroll",
    subModules: SUBMODULES_BY_ROUTE["/payroll"],
  },
  {
    labelKey: "nav.allocations",
    href: "/allocations",
    icon: ArrowDownNarrowWide,
    moduleKey: "allocations",
    subModules: SUBMODULES_BY_ROUTE["/allocations"],
  },
  {
    labelKey: "nav.credit",
    href: "/credit",
    icon: CreditCard,
    moduleKey: "credit_liabilities",
    subModules: SUBMODULES_BY_ROUTE["/credit"],
  },
  {
    labelKey: "nav.savings",
    href: "/savings",
    icon: PiggyBank,
    moduleKey: "savings_vault",
    subModules: SUBMODULES_BY_ROUTE["/savings"],
  },
];

const ANALYSIS_ROUTES: RouteItem[] = [
  {
    labelKey: "nav.analytics",
    href: "/analytics",
    icon: BarChart3,
    moduleKey: "analytics",
  },
  {
    labelKey: "nav.reports",
    href: "/reports",
    icon: FileSpreadsheet,
    moduleKey: "executive_reports",
    subModules: SUBMODULES_BY_ROUTE["/reports"],
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

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { isModuleEnabled, lifeStagePreset, uiDensityMode, studioConfig } = usePerspective();
  const { t } = useLanguage();
  const { month, year } = usePeriod();

  const [liveSub, setLiveSub] = useState<string>("");
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>({});

  // Track URL sub / tab + custom events for <15ms sub switching
  useEffect(() => {
    const syncFromUrl = () => {
      const params =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : searchParams;
      const raw = params.get("sub") || params.get("tab") || "";
      setLiveSub(raw);
    };
    syncFromUrl();
    if (typeof window !== "undefined") {
      window.addEventListener("popstate", syncFromUrl);
      return () => window.removeEventListener("popstate", syncFromUrl);
    }
  }, [searchParams, pathname]);

  useEffect(() => {
    if (SUBMODULES_BY_ROUTE[pathname]) {
      setExpandedRoutes((prev) => ({ ...prev, [pathname]: true }));
    }
  }, [pathname]);

  useEffect(() => {
    const onSubEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ sub?: string; pathname?: string }>).detail;
      if (detail?.sub) {
        setLiveSub(detail.sub);
      }
    };
    window.addEventListener("erp:sub-change", onSubEvent);
    return () => window.removeEventListener("erp:sub-change", onSubEvent);
  }, []);

  const navCfg = studioConfig?.sidebarNavigationConfig;
  const overrides = navCfg?.moduleOverrides ?? {};
  const customShortcuts = navCfg?.customShortcuts ?? [];

  const isRouteHidden = (href: string) => Boolean(overrides[href]?.hidden);
  const getRouteLabel = (href: string, labelKey: TranslationKey) =>
    overrides[href]?.label?.trim() || t(labelKey);

  const visiblePrimaryRoutes = PRIMARY_ROUTES.filter((route) => {
    if (isRouteHidden(route.href)) return false;
    if (!route.moduleKey) return true;
    return route.moduleKey === "corporate_payroll"
      ? isModuleEnabled("corporate_payroll") || isModuleEnabled("income")
      : isModuleEnabled(route.moduleKey);
  });

  const visibleAnalysisRoutes = ANALYSIS_ROUTES.filter((route) => {
    if (isRouteHidden(route.href)) return false;
    if (!route.moduleKey) return true;
    return isModuleEnabled(route.moduleKey);
  });

  const rawSystemRoutes: RouteItem[] = [
    { labelKey: "nav.subscriptions", href: "/subscriptions", icon: Repeat },
    {
      labelKey: "nav.preferences",
      href: "/preferences",
      icon: Sliders,
      subModules: SUBMODULES_BY_ROUTE["/preferences"],
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

  const resolveActiveSubKey = (routeHref: string, subs: SubModuleDef[]): string => {
    if (pathname !== routeHref) return "";
    if (liveSub) {
      const direct = subs.find((s) => s.key === liveSub || s.aliases?.includes(liveSub));
      if (direct) return direct.key;
    }
    return subs.find((s) => s.defaultSub)?.key ?? subs[0]?.key ?? "";
  };

  const renderRouteGroup = (routes: RouteItem[], sectionShortcuts: CustomSidebarShortcut[]) => (
    <div className="space-y-0.5">
      {routes.map((route) => {
        const active = isRouteActive(route.href);
        const subs = route.subModules;
        const label = getRouteLabel(route.href, route.labelKey);

        if (!subs || subs.length === 0) {
          return (
            <SidebarNavItem
              key={route.href}
              label={label}
              href={getHrefWithParams(route.href)}
              icon={route.icon}
              isActive={active}
              onClick={onNavigate}
            />
          );
        }

        const isExpanded = Boolean(expandedRoutes[route.href] ?? active);
        const activeSubKey = resolveActiveSubKey(route.href, subs);
        const Icon = route.icon;

        return (
          <div key={route.href} className="space-y-0.5">
            <div className="flex items-center">
              <Link
                href={getHrefWithParams(route.href)}
                prefetch={true}
                onClick={() => {
                  setExpandedRoutes((prev) => ({ ...prev, [route.href]: true }));
                  onNavigate?.();
                }}
                className={`group flex-1 flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors min-w-0 ${
                  active
                    ? "bg-surface-active text-text-primary font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-hover/70"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? "text-text-primary" : "text-text-tertiary group-hover:text-text-secondary"
                  }`}
                  strokeWidth={1.8}
                />
                <span className="truncate">{label}</span>
              </Link>
              <button
                type="button"
                aria-label={`Toggle ${label} sub-modules`}
                onClick={() =>
                  setExpandedRoutes((prev) => ({
                    ...prev,
                    [route.href]: !(prev[route.href] ?? active),
                  }))
                }
                className="p-1.5 mr-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-transform cursor-pointer"
              >
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
              </button>
            </div>

            {isExpanded && (
              <div className="ml-4 pl-2.5 border-l border-border-subtle space-y-0.5 py-0.5">
                {subs.map((sub) => {
                  const subActive = active && activeSubKey === sub.key;
                  return (
                    <Link
                      key={sub.key}
                      href={getHrefWithParams(route.href, sub.key)}
                      prefetch={true}
                      onClick={(e) => {
                        if (pathname === route.href) {
                          e.preventDefault();
                          syncSubInUrl(sub.key, route.href);
                        }
                        onNavigate?.();
                      }}
                      className={`block px-2.5 py-1.5 rounded text-[11px] font-sans transition-colors truncate ${
                        subActive
                          ? "bg-surface-active/80 text-text-primary font-medium"
                          : "text-text-tertiary hover:text-text-secondary hover:bg-surface-hover/50"
                      }`}
                    >
                      {t(sub.labelKey)}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

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
            onClick={(e) => {
              if (pathname === baseTarget && targetSub) {
                e.preventDefault();
                syncSubInUrl(targetSub, baseTarget);
              }
              onNavigate?.();
            }}
            className={`group flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
              isCurrentShortcut
                ? "bg-surface-active text-text-primary font-semibold"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-hover/70"
            }`}
          >
            <ScIcon className="w-4 h-4 shrink-0 text-accent" strokeWidth={1.8} />
            <span className="truncate">{sc.label}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <aside className="w-60 h-screen bg-surface-subtle border-r border-border flex flex-col justify-between shrink-0 select-none">
      {/* Top Section: App Branding & Navigation Links */}
      <div className="flex flex-col min-h-0 flex-1">
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-border-subtle">
          <div className="font-sans text-sm font-semibold tracking-tight text-text-primary">
            {t("app.title")}
          </div>
          <div className="text-[11px] text-text-tertiary font-sans mt-0.5 flex items-center justify-between">
            <span>{t("app.subtitle")}</span>
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
              {t("nav.section.engine")}
            </div>
            {renderRouteGroup(
              visiblePrimaryRoutes,
              customShortcuts.filter((s) => s.sectionGroup === "FINANCIAL_ENGINE"),
            )}
          </div>

          {/* Analysis & Simulation */}
          {(visibleAnalysisRoutes.length > 0 ||
            customShortcuts.some((s) => s.sectionGroup === "AUDIT_DECISION")) && (
            <div>
              <div className="px-3 pb-1.5 text-[10px] font-sans tracking-wider font-semibold text-text-tertiary uppercase">
                {t("nav.section.audit")}
              </div>
              {renderRouteGroup(
                visibleAnalysisRoutes,
                customShortcuts.filter((s) => s.sectionGroup === "AUDIT_DECISION"),
              )}
            </div>
          )}

          {/* System & Configuration */}
          <div>
            <div className="px-3 pb-1.5 text-[10px] font-sans tracking-wider font-semibold text-text-tertiary uppercase">
              {t("nav.section.system")}
            </div>
            {renderRouteGroup(
              systemRoutes,
              customShortcuts.filter((s) => s.sectionGroup === "SYSTEM"),
            )}
          </div>
        </div>

        {/* Mobile Language Switcher inside Drawer + Bottom Module Manager Shortcut */}
        <div className="sm:hidden px-4 py-2.5 border-t border-border-subtle flex items-center justify-between">
          <span className="text-[11px] font-mono text-text-tertiary">Locale</span>
          <LanguageSwitcher compact />
        </div>
        <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-tertiary">
          <span className="truncate font-mono text-[10px]">
            {({
              SUPERADMIN_BESPOKE: "Personal Workspace",
              EARLY_CAREER: "Early Career",
              DEBT_PAYOFF: "Debt Payoff Focus",
              SAVINGS_GROWTH: "Savings Growth",
              VARIABLE_INCOME: "Variable Income",
            } as Record<string, string>)[lifeStagePreset] ??
              lifeStagePreset.replace(/_/g, " ")}
          </span>
          <Link
            href="/preferences?sub=navigation"
            onClick={onNavigate}
            className="text-text-secondary hover:text-text-primary underline underline-offset-2 shrink-0 ml-2"
          >
            {t("nav.modules")}
          </Link>
        </div>
      </div>
    </aside>
  );
}
