"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { usePerspective } from "@/context/PerspectiveContext";
import {
  UserRole,
} from "@/lib/api";
import {
  ShieldCheck,
  RotateCcw,
  LogOut,
  SlidersHorizontal,
  ChevronDown,
  User as UserIcon,
  Eye,
} from "lucide-react";

function getRoleBadge(role?: UserRole) {
  switch (role) {
    case "PLATFORM_OWNER":
      return {
        label: "PLATFORM OWNER",
        classes: "border-border-strong text-text-primary bg-surface-subtle",
      };
    case "BESPOKE_CLIENT":
      return {
        label: "BESPOKE CLIENT",
        classes: "border-positive/30 text-positive bg-positive/10",
      };
    case "STANDARD_MEMBER":
      return {
        label: "STANDARD EDITION",
        classes: "border-border text-text-secondary bg-surface",
      };
    case "DEMO_SANDBOX":
    default:
      return {
        label: "DEMO SANDBOX",
        classes: "border-amber-500/30 text-amber-400 bg-amber-500/10",
      };
  }
}

function getCompactRoleLabel(role?: UserRole) {
  switch (role) {
    case "PLATFORM_OWNER":
      return "Owner";
    case "BESPOKE_CLIENT":
      return "Bespoke";
    case "STANDARD_MEMBER":
      return "Standard";
    case "DEMO_SANDBOX":
    default:
      return "Demo";
  }
}

export function AccountHeaderBadge() {
  const router = useRouter();
  const { user, logout, resetDemo } = useAuth();
  const { lifeStagePreset, uiDensityMode, setUiDensityMode } = usePerspective();
  const [isOpen, setIsOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const roleMeta = getRoleBadge(user?.role);
  const cleanName = (user?.fullName || "Account").replace(/\s*\([^)]*\)$/, "");

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleResetDemo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsResetting(true);
      await resetDemo();
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        {/* If DEMO_SANDBOX, provide an instant 1-click Reset Demo pill */}
        {user?.role === "DEMO_SANDBOX" && (
          <button
            type="button"
            onClick={handleResetDemo}
            disabled={isResetting}
            title="Reset demo sandbox to original sample values"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <RotateCcw
              className={`w-3 h-3 ${isResetting ? "animate-spin" : ""}`}
            />
            <span>{isResetting ? "Resetting..." : "Reset Demo"}</span>
          </button>
        )}

        {/* User Account Trigger Pill */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded border border-border bg-surface hover:bg-surface-subtle transition-all active:scale-[0.98] text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          {/* Avatar Initials */}
          <div className="w-5 h-5 rounded-sm bg-surface-subtle border border-border-strong flex items-center justify-center text-[10px] font-mono font-medium text-text-primary shrink-0">
            {getInitials(cleanName)}
          </div>

          {/* Mobile Compact View (< 640px) */}
          <div className="flex sm:hidden items-center gap-1.5">
            <span className="text-[10px] font-mono font-medium text-text-secondary">
              {getCompactRoleLabel(user?.role)}
            </span>
          </div>

          {/* Desktop Clean Expanded View (>= 640px) */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs font-medium text-text-primary whitespace-nowrap">
              {cleanName}
            </span>
            <span
              className={`px-1.5 py-0.5 text-[9px] font-mono font-medium tracking-wide rounded border ${roleMeta.classes}`}
            >
              {roleMeta.label}
            </span>
          </div>

          <ChevronDown
            className={`w-3 h-3 text-text-tertiary transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* Account Context Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-md border border-border bg-surface shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-100">
          {/* Account Profile Header */}
          <div className="px-3 py-2 border-b border-border mb-1">
            <div className="text-xs font-medium text-text-primary truncate">
              {cleanName}
            </div>
            <div className="text-[11px] font-mono text-text-tertiary truncate">
              {user?.email || "Signed in"}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className={`px-1.5 py-0.2 text-[9px] font-mono rounded border ${roleMeta.classes}`}
              >
                {roleMeta.label}
              </span>
              <span className="px-1.5 py-0.2 text-[9px] font-mono rounded border border-border text-text-secondary">
                {(user?.lifeStagePreset || lifeStagePreset).replace(/_/g, " ")}
              </span>
              <span className="text-[10px] text-text-tertiary font-mono">
                ID #{user?.id ?? 1}
              </span>
            </div>
          </div>

          {/* Menu Actions */}
          <div className="space-y-0.5">
            {/* Platform Admin Console (Platform Owner only) */}
            {user?.role === "PLATFORM_OWNER" && (
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-surface-subtle rounded transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-text-secondary" />
                <span>Platform Admin Console</span>
              </Link>
            )}

            <Link
              href="/preferences?tab=modules"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-surface-subtle rounded transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-text-secondary" />
              <span>Modules & Preferences</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                const nextMode =
                  uiDensityMode === "COMMAND_COCKPIT"
                    ? "SIMPLE_CLARITY"
                    : "COMMAND_COCKPIT";
                setUiDensityMode(nextMode);
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-text-primary hover:bg-surface-subtle rounded transition-colors text-left"
            >
              <span className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-text-secondary" />
                <span>UI Density</span>
              </span>
              <span className="text-[10px] font-mono text-text-tertiary">
                {uiDensityMode === "SIMPLE_CLARITY" ? "Simple Clarity" : "Command Cockpit"}
              </span>
            </button>

            {/* Switch Account */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push("/login");
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-surface-subtle rounded transition-colors text-left"
            >
              <UserIcon className="w-3.5 h-3.5 text-text-secondary" />
              <span>Switch Account</span>
            </button>

            {/* Sign Out */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-negative hover:bg-negative/10 rounded transition-colors text-left"
            >
              <LogOut className="w-3.5 h-3.5 text-negative" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

