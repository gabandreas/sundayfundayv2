"use client";

import React, { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { MonthYearSwitcher } from "./MonthYearSwitcher";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { AccountHeaderBadge } from "./AccountHeaderBadge";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { BrandMark } from "@/components/primitives/BrandMark";
import { TranslationKey, useLanguage } from "@/context/LanguageContext";

const ROUTE_TITLE_KEYS: Record<string, { titleKey: TranslationKey; catKey: TranslationKey }> = {
  "/": { titleKey: "nav.overview", catKey: "cat.dashboard" },
  "/payday-wizard": { titleKey: "nav.paydayWizard", catKey: "cat.engine" },
  "/calendar": { titleKey: "nav.cashRadar", catKey: "cat.engine" },
  "/payroll": { titleKey: "nav.payroll", catKey: "cat.engine" },
  "/allocations": { titleKey: "nav.allocations", catKey: "cat.engine" },
  "/credit": { titleKey: "nav.credit", catKey: "cat.engine" },
  "/savings": { titleKey: "nav.savings", catKey: "cat.engine" },
  "/import": { titleKey: "nav.import", catKey: "cat.engine" },
  "/scenarios": { titleKey: "nav.scenarios", catKey: "cat.audit" },
  "/ledger": { titleKey: "nav.ledger", catKey: "cat.engine" },
  "/marquee": { titleKey: "nav.marquee", catKey: "cat.decision" },
  "/wishlist": { titleKey: "nav.wishlist", catKey: "cat.decision" },
  "/audit": { titleKey: "nav.audit", catKey: "cat.audit" },
  "/analytics": { titleKey: "nav.analytics", catKey: "cat.audit" },
  "/reports": { titleKey: "nav.reports", catKey: "cat.audit" },
  "/subscriptions": { titleKey: "nav.subscriptions", catKey: "cat.system" },
  "/guide": { titleKey: "nav.guide", catKey: "cat.system" },
  "/preferences": { titleKey: "nav.preferences", catKey: "cat.system" },
  "/admin": { titleKey: "nav.admin", catKey: "cat.system" },
  "/admin/sql": { titleKey: "header.adminSql", catKey: "cat.system" },
};

export function AppHeader({ onToggleMobileDrawer }: { onToggleMobileDrawer?: () => void }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const keys = ROUTE_TITLE_KEYS[pathname];
  const category = keys ? t(keys.catKey) : t("cat.view");
  const title = keys ? t(keys.titleKey) : pathname.replace("/", "");
  const showParentBreadcrumb = pathname !== "/";

  return (
    <header className="print-hidden relative z-30 h-12 border-b border-border-subtle bg-canvas px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0 select-none">
      {/* Left Zone: Clean Route Context */}
      <div className="flex items-center gap-2 text-xs font-sans min-w-0 shrink pr-2">
        {onToggleMobileDrawer && (
          <button
            type="button"
            onClick={onToggleMobileDrawer}
            className="lg:hidden p-1.5 -ml-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer shrink-0"
            title={t("header.openMenu")}
            aria-label={t("header.openMenu")}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <span className="lg:hidden shrink-0 inline-flex items-center">
          <BrandMark size={20} />
        </span>
        {showParentBreadcrumb && (
          <>
            <span className="hidden sm:inline text-text-tertiary font-normal shrink-0">
              {category}
            </span>
            <span className="hidden sm:inline text-border-strong select-none shrink-0">/</span>
          </>
        )}
        <h1 className="text-[13px] font-semibold text-text-primary tracking-tight truncate">
          {title}
        </h1>
      </div>

      {/* Center Zone: Command Search */}
      <div className="hidden md:flex flex-1 justify-center px-2 min-w-0">
        <GlobalSearchModal />
      </div>

      {/* Right Zone: Period Switcher · Compact Locale Popover · Monogram Account Menu */}
      <div className="flex items-center gap-2 justify-end min-w-0 shrink-0">
        <Suspense
          fallback={
            <div className="h-8 w-28 sm:w-36 rounded-md bg-surface animate-pulse" />
          }
        >
          <MonthYearSwitcher />
        </Suspense>

        <LanguageSwitcher compact />

        <AccountHeaderBadge />
      </div>
    </header>
  );
}
