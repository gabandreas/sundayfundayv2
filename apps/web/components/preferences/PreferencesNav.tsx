"use client";

import React, { useRef } from "react";
import { PreferencesTabKey, handleTabListKeyDown } from "@/lib/tabs";

const PREFERENCES_TABS: Array<{ id: PreferencesTabKey; label: string }> = [
  { id: "formula", label: "Formula & Priority" },
  { id: "instruments", label: "Methods & Accounts" },
  { id: "templates", label: "Routine & Buckets" },
  { id: "display", label: "Display, Account & AI" },
  { id: "notifications", label: "Alerts & Email" },
  { id: "backup", label: "Backup & Restore" },
];

interface PreferencesNavProps {
  currentTab: PreferencesTabKey;
  onSelectTab: (tab: PreferencesTabKey) => void;
}

export function PreferencesNav({ currentTab, onSelectTab }: PreferencesNavProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <div
      role="tablist"
      aria-label="Configuration sections"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border"
    >
      {PREFERENCES_TABS.map((tab, idx) => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            id={`preferences-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`preferences-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelectTab(tab.id)}
            onKeyDown={(e) =>
              handleTabListKeyDown(
                e,
                PREFERENCES_TABS.map((t) => t.id),
                idx,
                onSelectTab,
                tabRefs,
              )
            }
            className={`pb-3 text-xs font-medium font-sans transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
              isActive
                ? "border-accent text-text-primary"
                : "border-transparent text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
