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
import { OnboardingWizardModal } from "@/components/onboarding/OnboardingWizardModal";
import { CustomRuleRequestModal } from "@/components/shell/CustomRuleRequestModal";
import { ProfileSettingsModal } from "@/components/shell/ProfileSettingsModal";
import { MarqueeCoPilotDrawer } from "@/components/marquee/MarqueeCoPilotDrawer";
import { MarqueeFloatingLauncher } from "@/components/marquee/MarqueeFloatingLauncher";
import { BrandMark } from "@/components/primitives/BrandMark";
import { TopProgressBar } from "./TopProgressBar";

function AppShellProtected({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isMarqueeOpen, setIsMarqueeOpen] = useState(false);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        setIsMarqueeOpen((prev) => !prev);
      }
    };
    const onToggle = () => setIsMarqueeOpen((prev) => !prev);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("erp:marquee-toggle", onToggle);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("erp:marquee-toggle", onToggle);
    };
  }, []);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas text-text-tertiary font-mono text-xs">
        <div className="flex flex-col items-center gap-3">
          <BrandMark size={28} className="animate-pulse" />
          <span>Authenticating session...</span>
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
          {/* Persistent Left Navigation Sidebar (Desktop) */}
          <div className="hidden lg:flex w-60 h-screen shrink-0 print-hidden">
            <Suspense
              fallback={
                <div className="w-60 h-screen bg-surface-subtle border-r border-border shrink-0" />
              }
            >
              <Sidebar />
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
              <div className="relative w-72 max-w-[85vw] h-full bg-surface-subtle shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <BrandMark size={18} />
                    <span className="text-xs font-semibold tracking-wide text-text-primary uppercase font-sans">
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
            <main className="flex-1 overflow-y-auto overflow-x-hidden print:overflow-visible print:p-0 p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:p-6 lg:p-8">
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

  if (pathname === "/login") {
    return (
      <LanguageProvider>
        <AuthProvider>
          <div className="min-h-screen w-full overflow-y-auto overflow-x-hidden bg-canvas text-text-primary">
            {children}
          </div>
        </AuthProvider>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <AuthProvider>
        <AppShellProtected>{children}</AppShellProtected>
      </AuthProvider>
    </LanguageProvider>
  );
}
