import type React from "react";

export type PreferencesTabKey =
  | "formula"
  | "instruments"
  | "accounts"
  | "templates"
  | "navigation"
  | "notifications"
  | "ai";

export const PREFERENCES_TAB_KEYS: readonly PreferencesTabKey[] = [
  "formula",
  "instruments",
  "accounts",
  "templates",
  "navigation",
  "notifications",
  "ai",
];

export const PAYROLL_SUB_KEYS = ["payslip", "timeline", "lifeenergy"] as const;
export type PayrollSubKey = (typeof PAYROLL_SUB_KEYS)[number];

export const ALLOCATIONS_SUB_KEYS = ["waterfall", "envelopes", "revisions"] as const;
export type AllocationsSubKey = (typeof ALLOCATIONS_SUB_KEYS)[number];

export const CREDIT_SUB_KEYS = ["matrix", "contracts", "simulator", "reconciler"] as const;
export type CreditSubKey = (typeof CREDIT_SUB_KEYS)[number];

export const SAVINGS_SUB_KEYS = ["networth", "forecaster", "vault"] as const;
export type SavingsSubKey = (typeof SAVINGS_SUB_KEYS)[number];

export const REPORTS_SUB_KEYS = ["executive", "variance", "audit", "export"] as const;
export type ReportsSubKey = (typeof REPORTS_SUB_KEYS)[number];

export function isValidPreferencesTab(val: string | undefined): val is PreferencesTabKey {
  return typeof val === "string" && (PREFERENCES_TAB_KEYS as readonly string[]).includes(val);
}

/**
 * Shallow-updates the `?tab=` URL query parameter without triggering a Next.js
 * Server Component (`_rsc`) roundtrip.
 */
export function syncTabInUrl(tabKey: string, removeParams: string[] = []): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tabKey);
  for (const param of removeParams) {
    url.searchParams.delete(param);
  }
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) {
    window.history.replaceState(null, "", nextUrl);
  }
}

/**
 * Shallow-updates the `?sub=` query parameter cleanly without a Next.js `_rsc` server roundtrip,
 * and notifies active client views for instant <15ms switching from either Sidebar or inline sub-bars.
 */
export function syncSubInUrl(subKey: string, pathnameOverride?: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("sub", subKey);
  url.searchParams.delete("tab");
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
  window.dispatchEvent(
    new CustomEvent("erp:sub-change", {
      detail: {
        pathname: pathnameOverride ?? window.location.pathname,
        sub: subKey,
      },
    }),
  );
}

/**
 * WAI-ARIA roving tabindex keyboard handler for horizontal tablists
 * (ArrowLeft, ArrowRight, Home, End).
 */
export function handleTabListKeyDown<T extends string>(
  e: React.KeyboardEvent<HTMLButtonElement>,
  tabIds: readonly T[],
  currentIndex: number,
  onSelect: (tab: T) => void,
  buttonRefs?: React.MutableRefObject<Array<HTMLButtonElement | null>>,
): void {
  let nextIdx = -1;
  if (e.key === "ArrowRight") {
    nextIdx = (currentIndex + 1) % tabIds.length;
  } else if (e.key === "ArrowLeft") {
    nextIdx = (currentIndex - 1 + tabIds.length) % tabIds.length;
  } else if (e.key === "Home") {
    nextIdx = 0;
  } else if (e.key === "End") {
    nextIdx = tabIds.length - 1;
  } else {
    return;
  }

  e.preventDefault();
  const nextTab = tabIds[nextIdx];
  onSelect(nextTab);
  buttonRefs?.current[nextIdx]?.focus();
}
