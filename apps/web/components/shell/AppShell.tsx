"use client";

import React, { Suspense, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { AppHeader } from "./AppHeader";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { PerspectiveProvider } from "@/context/PerspectiveContext";
import { PrivacyMaskProvider } from "@/context/PrivacyMaskContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { PeriodProvider } from "@/context/PeriodContext";
import { ToastProvider } from "@/context/ToastContext";
import { ToastViewport } from "@/components/primitives/ToastViewport";
import { OnboardingWizardModal } from "@/components/onboarding/OnboardingWizardModal";
import { CustomRuleRequestModal } from "@/components/shell/CustomRuleRequestModal";
import { ProfileSettingsModal } from "@/components/shell/ProfileSettingsModal";
import { MarqueeCoPilotDrawer } from "@/components/marquee/MarqueeCoPilotDrawer";
import { MarqueeFloatingLauncher } from "@/components/marquee/MarqueeFloatingLauncher";
import { BrandMark } from "@/components/primitives/BrandMark";
import { WorkspaceSkeleton } from "@/components/primitives/WorkspaceSkeleton";
import { TopProgressBar } from "./TopProgressBar";
import { useLanguage } from "@/context/LanguageContext";

const AUTH_SHELLLESS_ROUTES = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/change-password",
]);

function AppShellProtected({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isSigningOut } = useAuth();
  const { t } = useLanguage();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMarqueeOpen, setIsMarqueeOpen] = useState(false);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem("erp_sidebar_collapsed");
      if (saved === "true") setIsSidebarCollapsed(true);
    } catch {
      // ignore storage unavailable
    }
  }, []);

  const toggleSidebarCollapse = React.useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("erp_sidebar_collapsed", String(next));
      } catch {
        // ignore storage unavailable
      }
      return next;
    });
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        setIsMarqueeOpen((prev) => !prev);
        return;
      }
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (!inInput && !e.metaKey && !e.ctrlKey && !e.altKey && e.key === "[") {
        e.preventDefault();
        toggleSidebarCollapse();
      }
    };
    const onToggle = () => setIsMarqueeOpen((prev) => !prev);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("erp:marquee-toggle", onToggle);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("erp:marquee-toggle", onToggle);
    };
  }, [toggleSidebarCollapse]);

  if (isSigningOut) {
    return (
      <div className="min-h-screen w-screen bg-canvas text-text-primary flex flex-col items-center justify-center gap-3">
        <BrandMark size={24} />
        <p className="text-xs font-mono text-text-secondary">{t("auth.signingOut")}</p>
      </div>
    );
  }

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-canvas text-text-primary">
        <div className="hidden lg:flex w-64 h-screen bg-surface-subtle border-r border-border shrink-0 p-5 flex-col gap-4 animate-pulse">
          <div className="flex items-center gap-2.5">
            <BrandMark size={20} />
            <div className="h-4 w-28 rounded bg-surface-elevated" />
          </div>
          <div className="space-y-2 pt-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-7 w-full rounded bg-surface" />
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-14 border-b border-border bg-canvas/95 px-6 flex items-center justify-between animate-pulse">
            <div className="h-4 w-40 rounded bg-surface" />
            <div className="h-7 w-48 rounded bg-surface" />
          </div>
          <div className="p-6 lg:p-8 flex-1 overflow-hidden">
            <WorkspaceSkeleton rows={4} cards={4} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <PerspectiveProvider>
      <PrivacyMaskProvider>
        <Suspense fallback={null}>
          <PeriodProvider>
            <div className="print-hidden">
          <Suspense fallback={null}>
            <TopProgressBar />
          </Suspense>
        </div>
        <div className="flex h-screen w-screen overflow-hidden print:h-auto print:w-auto print:overflow-visible bg-canvas text-text-primary">
          <a href="#main-content" className="erp-skip-link">
            Skip to main content
          </a>

          {/* Persistent Left Navigation Sidebar (Desktop Collapsible Rail) */}
          <div
            className={`erp-sidebar-rail hidden lg:flex h-screen shrink-0 print-hidden transition-[width] duration-150 ease-out ${
              isSidebarCollapsed ? "w-[60px]" : "w-[228px]"
            }`}
          >
            <Suspense
              fallback={
                <div
                  className={`h-screen bg-surface-subtle border-r border-border shrink-0 ${
                    isSidebarCollapsed ? "w-[60px]" : "w-[228px]"
                  }`}
                />
              }
            >
              <Sidebar
                collapsed={isSidebarCollapsed}
                onToggleCollapse={toggleSidebarCollapse}
              />
            </Suspense>
          </div>

          {/* Slide-over Navigation Drawer (Mobile & Tablet < lg) */}
          {isMobileDrawerOpen && (
            <div className="fixed inset-0 z-50 lg:hidden flex print-hidden">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/75 transition-opacity"
                onClick={() => setIsMobileDrawerOpen(false)}
                aria-hidden="true"
              />
              {/* Drawer Content */}
              <div className="relative w-72 max-w-[85vw] h-full bg-surface-subtle shadow-2xl flex flex-col z-10">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <BrandMark size={18} />
                    <span className="text-xs font-semibold tracking-wide text-text-primary font-sans">
                      Navigation
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
                    aria-label="Close navigation menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <Suspense
                    fallback={
                      <div className="w-full h-full bg-surface-subtle" />
                    }
                  >
                    <Sidebar onNavigate={() => setIsMobileDrawerOpen(false)} />
                  </Suspense>
                </div>
              </div>
            </div>
          )}

          {/* Main Content Surface */}
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden print:h-auto print:overflow-visible">
            {/* Integrated Content Header with Account Header Badge + Month/Year Switcher + Hamburger */}
            <AppHeader onToggleMobileDrawer={() => setIsMobileDrawerOpen((prev) => !prev)} />

            {/* Scrollable View Area */}
            <main
              id="main-content"
              tabIndex={-1}
              className="flex-1 overflow-y-auto overflow-x-hidden print:overflow-visible print:p-0 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-7 lg:pb-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
            >
              {children}
            </main>
          </div>
        </div>

            {/* Global Perspective & Profile Modals */}
            <OnboardingWizardModal />
            <CustomRuleRequestModal />
            <ProfileSettingsModal />
            <MarqueeFloatingLauncher
              isOpen={isMarqueeOpen}
              onToggle={() => setIsMarqueeOpen((prev) => !prev)}
            />
            <MarqueeCoPilotDrawer
              isOpen={isMarqueeOpen}
              onClose={() => setIsMarqueeOpen(false)}
            />
          </PeriodProvider>
        </Suspense>
      </PrivacyMaskProvider>
    </PerspectiveProvider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (AUTH_SHELLLESS_ROUTES.has(pathname)) {
    return (
      <ToastProvider>
        <LanguageProvider>
          <AuthProvider>
            <div className="min-h-screen w-full overflow-y-auto overflow-x-hidden bg-canvas text-text-primary">
              {children}
            </div>
            <ToastViewport />
          </AuthProvider>
        </LanguageProvider>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <LanguageProvider>
        <AuthProvider>
          <AppShellProtected>{children}</AppShellProtected>
          <ToastViewport />
        </AuthProvider>
      </LanguageProvider>
    </ToastProvider>
  );
}
