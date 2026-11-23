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
  FileUp,
  FlaskConical,
} from "lucide-react";
import { SidebarNavItem } from "@/components/primitives/SidebarNavItem";
import { BrandMark } from "@/components/primitives/BrandMark";
import { MarqueeMark } from "@/components/primitives/MarqueeMark";

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
    subModules: SUBMODULES_BY_ROUTE["/payroll"],
  },
  {
    labelKey: "nav.allocations",
    standardLabelKey: "nav.standard.budgets",
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
    standardLabelKey: "nav.standard.accounts",
    href: "/savings",
    icon: PiggyBank,
    moduleKey: "savings_vault",
    subModules: SUBMODULES_BY_ROUTE["/savings"],
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
  const { isModuleEnabled, isBespokeWorkspace, uiDensityMode, studioConfig } = usePerspective();
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
      subModules: isBespokeWorkspace
        ? SUBMODULES_BY_ROUTE["/preferences"]
        : SUBMODULES_BY_ROUTE["/preferences"]
            .filter((s) => s.key !== "formula")
            .map((s) => ({ ...s, defaultSub: s.key === "display" })),
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
        const subs =
          !isBespokeWorkspace && route.href === "/payroll" && !isModuleEnabled("corporate_payroll")
            ? undefined
            : route.subModules;
        const label = getRouteLabel(route);

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
    <aside className="w-64 h-screen bg-surface-subtle border-r border-border flex flex-col justify-between shrink-0 select-none">
      {/* Top Section: App Branding & Navigation Links */}
      <div className="flex flex-col min-h-0 flex-1">
        {/* Brand Header */}
        <div className="px-4 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <BrandMark size={22} className="shrink-0" />
            <div className="min-w-0">
              <div className="font-sans text-sm font-semibold tracking-tight text-text-primary truncate">
                {t("app.title")}
              </div>
              <div className="text-[11px] text-text-tertiary font-sans mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate">{t("app.subtitle")}</span>
                {uiDensityMode === "SIMPLE_CLARITY" && (
                  <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-border text-text-secondary shrink-0">
                    Simple
                  </span>
                )}
              </div>
            </div>
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
            {isBespokeWorkspace ? "Personal Workspace" : "Standard Workspace"}
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
