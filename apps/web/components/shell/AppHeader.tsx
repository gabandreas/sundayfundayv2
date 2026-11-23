"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Menu } from "lucide-react";
import { MonthYearSwitcher } from "./MonthYearSwitcher";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { AccountHeaderBadge } from "./AccountHeaderBadge";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { PrivacyEyeButton } from "./PrivacyEyeButton";
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

  return (
    <header className="print-hidden relative z-30 h-14 border-b border-border bg-canvas/95 px-3 sm:px-4 lg:px-5 flex items-center justify-between gap-2 shrink-0 select-none">
      {/* Left Zone: Route breadcrumb + Mobile Drawer Trigger + Mobile BrandMark */}
      <div className="flex items-center gap-1.5 text-xs font-sans min-w-0 shrink pr-2">
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
        <span className="hidden sm:inline text-text-tertiary font-normal shrink-0">
          {category}
        </span>
        <span className="hidden sm:inline text-border-strong select-none shrink-0">/</span>
        <h1 className="font-medium text-text-primary tracking-tight truncate">
          {title}
        </h1>
      </div>

      {/* Center Zone: Quick Global Search Input */}
      <div className="hidden md:flex flex-1 justify-center px-1 lg:px-2 min-w-0">
        <GlobalSearchModal />
      </div>

      {/* Right Zone: Privacy Toggle + Language + Guide + Period Capsule Navigator + Account Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 justify-end min-w-0 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5">
          <PrivacyEyeButton
            size="sm"
            className="h-8 w-8 rounded border border-border bg-surface hover:border-border-strong"
          />
          <LanguageSwitcher compact />
          <Link
            href="/guide"
            title={t("nav.guide")}
            aria-label={t("nav.guide")}
            className={`h-8 w-8 rounded border flex items-center justify-center transition-colors ${
              pathname === "/guide"
                ? "border-accent/50 bg-accent/[0.08] text-text-primary"
                : "border-border bg-surface text-text-tertiary hover:text-text-primary hover:border-border-strong"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
          </Link>
        </div>
        <Suspense
          fallback={
            <div className="h-8 w-24 sm:w-40 rounded-md bg-surface border border-border animate-pulse" />
          }
        >
          <MonthYearSwitcher />
        </Suspense>

        <AccountHeaderBadge />
      </div>
    </header>
  );
}
