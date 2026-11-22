"use client";

import React, { useRef } from "react";
import { handleTabListKeyDown } from "@/lib/tabs";

export type WishlistTabType = "planner" | "vault";

interface WishlistTabNavProps {
  currentTab: WishlistTabType;
  vaultCount: number;
  onSelectTab: (tab: WishlistTabType) => void;
}

export function WishlistTabNav({
  currentTab,
  vaultCount,
  onSelectTab,
}: WishlistTabNavProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs: Array<{ id: WishlistTabType; label: string; count?: number }> = [
    { id: "planner", label: "Simulator & Planner" },
    { id: "vault", label: "Wishlist Vault", count: vaultCount },
  ];

  return (
    <div
      role="tablist"
      aria-label="Wishlist workspace views"
      className="flex items-center gap-6 border-b border-border overflow-x-auto no-scrollbar whitespace-nowrap"
    >
      {tabs.map((tab, idx) => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            id={`wishlist-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`wishlist-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelectTab(tab.id)}
            onKeyDown={(e) =>
              handleTabListKeyDown(
                e,
                tabs.map((x) => x.id),
                idx,
                onSelectTab,
                tabRefs,
              )
            }
            className={`pb-3 text-xs font-medium font-sans transition-colors border-b-2 -mb-px flex items-center gap-2 shrink-0 cursor-pointer ${
              isActive
                ? "border-accent text-text-primary"
                : "border-transparent text-text-tertiary hover:text-text-secondary"
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums ${
                  isActive
                    ? "bg-surface-active text-text-primary"
                    : "bg-surface-subtle text-text-tertiary"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
