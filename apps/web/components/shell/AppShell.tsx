"use client";

import React, { Suspense, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { AppHeader } from "./AppHeader";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { PerspectiveProvider } from "@/context/PerspectiveContext";
import { PrivacyMaskProvider } from "@/context/PrivacyMaskContext";
import { OnboardingWizardModal } from "@/components/onboarding/OnboardingWizardModal";
import { CustomRuleRequestModal } from "@/components/shell/CustomRuleRequestModal";

function AppShellProtected({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas text-text-tertiary font-mono text-xs">
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span>Authenticating session...</span>
        </div>
      </div>
    );
  }

  return (
    <PerspectiveProvider>
      <PrivacyMaskProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-canvas text-text-primary">
          {/* Persistent Left Navigation Sidebar (Desktop) */}
          <div className="hidden lg:flex w-60 h-screen shrink-0">
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
            <div className="fixed inset-0 z-50 lg:hidden flex">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
                onClick={() => setIsMobileDrawerOpen(false)}
                aria-hidden="true"
              />
              {/* Drawer Content */}
              <div className="relative w-72 max-w-[85vw] h-full bg-surface-subtle shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-xs font-semibold tracking-wide text-text-primary uppercase font-sans">
                    Navigation
                  </span>
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
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
            {/* Integrated Content Header with Account Header Badge + Month/Year Switcher + Hamburger */}
            <AppHeader onToggleMobileDrawer={() => setIsMobileDrawerOpen((prev) => !prev)} />

            {/* Scrollable View Area */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
          </div>
        </div>

        {/* Global Perspective Modals */}
        <OnboardingWizardModal />
        <CustomRuleRequestModal />
      </PrivacyMaskProvider>
    </PerspectiveProvider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return (
      <AuthProvider>
        <div className="h-screen w-screen overflow-y-auto bg-canvas text-text-primary">
          {children}
        </div>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <AppShellProtected>{children}</AppShellProtected>
    </AuthProvider>
  );
}
