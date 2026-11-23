"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { UserRole } from "@/lib/api";
import {
  BookOpen,
  ShieldCheck,
  RotateCcw,
  LogOut,
  User as UserIcon,
} from "lucide-react";

function getCompactRoleLabel(role?: UserRole): string {
  switch (role) {
    case "SUPERADMIN":
      return "Superadmin";
    case "USER":
      return "Personal ERP";
    case "BESPOKE_CLIENT":
      return "Bespoke Client";
    case "STANDARD_MEMBER":
      return "Standard Edition";
    case "DEMO_SANDBOX":
    default:
      return "Demo Sandbox";
  }
}

function getInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AccountHeaderBadge() {
  const { user, logout, resetDemo, openProfileModal, isSigningOut } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const cleanName = (
    user?.fullName ||
    user?.username ||
    "Account"
  ).replace(/\s*\([^)]*\)$/, "");
  const initials = getInitials(cleanName);
  const roleLabel = getCompactRoleLabel(user?.role);

  const closePopover = () => {
    const pop = popoverRef.current as (HTMLDivElement & { hidePopover?: () => void }) | null;
    if (pop && typeof pop.hidePopover === "function") {
      try {
        pop.hidePopover();
      } catch {
        // ignore if already closed
      }
    }
    setIsOpen(false);
  };

  useEffect(() => {
    const pop = popoverRef.current;
    if (!pop) return;

    const handleBeforeToggle = (e: Event) => {
      const toggleEvent = e as Event & { newState?: string };
      if (toggleEvent.newState === "open") {
        const supportsAnchor =
          typeof CSS !== "undefined" &&
          typeof CSS.supports === "function" &&
          CSS.supports("position-area", "block-end");

        if (!supportsAnchor && triggerRef.current) {
          const rect = triggerRef.current.getBoundingClientRect();
          const menuWidth = 240;
          const margin = 8;
          const clampedLeft = Math.max(
            margin,
            Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - margin),
          );
          const clampedTop = Math.min(rect.bottom + 6, window.innerHeight - margin - 220);
          pop.style.position = "fixed";
          pop.style.left = `${Math.round(clampedLeft)}px`;
          pop.style.top = `${Math.round(clampedTop)}px`;
          pop.style.right = "auto";
          pop.style.margin = "0";
        } else {
          pop.style.left = "";
          pop.style.top = "";
          pop.style.right = "";
          pop.style.margin = "";
        }
      }
    };

    const handleToggle = (e: Event) => {
      const toggleEvent = e as Event & { newState?: string };
      const open = toggleEvent.newState === "open";
      setIsOpen(open);
      if (open) {
        const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
        requestAnimationFrame(() => firstItem?.focus());
      }
    };

    pop.addEventListener("beforetoggle", handleBeforeToggle);
    pop.addEventListener("toggle", handleToggle);
    return () => {
      pop.removeEventListener("beforetoggle", handleBeforeToggle);
      pop.removeEventListener("toggle", handleToggle);
    };
  }, []);

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    if (items.length === 0) return;

    const currentIdx = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = items[(currentIdx + 1) % items.length];
      next?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = items[(currentIdx - 1 + items.length) % items.length];
      prev?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePopover();
      triggerRef.current?.focus();
    }
  };

  const handleResetDemo = async () => {
    try {
      setIsResetting(true);
      await resetDemo();
      closePopover();
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        id="account-menu-trigger"
        type="button"
        popoverTarget="account-menu-popover"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="account-menu-popover"
        aria-label={`${cleanName} account menu`}
        title={cleanName}
        style={{ anchorName: "--account-menu-trigger" } as React.CSSProperties}
        className="w-8 h-8 rounded-full bg-surface-subtle hover:bg-surface-hover border border-border-subtle hover:border-border-strong flex items-center justify-center text-xs font-mono font-semibold text-text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      >
        {initials}
      </button>

      <div
        ref={popoverRef}
        id="account-menu-popover"
        popover="auto"
        className="erp-account-menu-popover w-60 rounded-lg border border-border bg-surface shadow-xl p-1.5 text-xs text-text-primary"
      >
        <div className="px-3 py-2.5 border-b border-border-subtle mb-1">
          <div className="font-medium text-text-primary truncate">{cleanName}</div>
          <div className="text-[11px] text-text-tertiary truncate mt-0.5">
            {user?.email || user?.username || roleLabel}
          </div>
          <div className="text-[10px] font-mono text-text-disabled mt-1">
            {roleLabel}
          </div>
        </div>

        <div
          ref={menuRef}
          focusgroup="menu nomemory"
          role="menu"
          aria-labelledby="account-menu-trigger"
          onKeyDown={handleMenuKeyDown}
          className="space-y-0.5"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closePopover();
              openProfileModal();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs text-text-primary hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none transition-colors text-left cursor-pointer"
          >
            <UserIcon className="w-3.5 h-3.5 text-text-secondary shrink-0" />
            <span>Account Settings</span>
          </button>

          <Link
            href="/guide"
            role="menuitem"
            onClick={closePopover}
            className="flex items-center gap-2.5 px-3 py-2 rounded text-xs text-text-primary hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-text-secondary shrink-0" />
            <span>{t("nav.guide")}</span>
          </Link>

          {user?.role === "SUPERADMIN" && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={closePopover}
              className="flex items-center gap-2.5 px-3 py-2 rounded text-xs text-text-primary hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-text-secondary shrink-0" />
              <span>Platform Admin</span>
            </Link>
          )}

          {user?.role === "DEMO_SANDBOX" && (
            <button
              type="button"
              role="menuitem"
              disabled={isResetting}
              onClick={() => void handleResetDemo()}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs text-caution hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none transition-colors text-left cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 shrink-0 ${isResetting ? "animate-spin" : ""}`} />
              <span>{isResetting ? "Resetting Demo..." : "Reset Demo Sandbox"}</span>
            </button>
          )}

          <div className="my-1 border-t border-border-subtle" role="separator" />

          <button
            type="button"
            role="menuitem"
            disabled={isSigningOut}
            onClick={() => {
              closePopover();
              void logout();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs text-negative hover:bg-negative/10 focus-visible:bg-negative/10 focus-visible:outline-none transition-colors text-left cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5 text-negative shrink-0" />
            <span>{isSigningOut ? t("auth.signingOut") : t("auth.signOutBtn")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
