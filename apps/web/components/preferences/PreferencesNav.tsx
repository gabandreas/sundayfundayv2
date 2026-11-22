"use client";

import React, { useRef } from "react";
import { handleTabListKeyDown } from "@/lib/tabs";
import type { PreferencesTabKey } from "@/lib/tabs";
import { TranslationKey, useLanguage } from "@/context/LanguageContext";

export type { PreferencesTabKey };

interface PreferencesTabItem {
  key: PreferencesTabKey;
  labelKey: TranslationKey;
}

export const PREFERENCES_TABS: PreferencesTabItem[] = [
  { key: "formula", labelKey: "sub.preferences.formula" },
  { key: "instruments", labelKey: "sub.preferences.instruments" },
  { key: "accounts", labelKey: "sub.preferences.accounts" },
  { key: "templates", labelKey: "sub.preferences.templates" },
  { key: "navigation", labelKey: "sub.preferences.navigation" },
  { key: "notifications", labelKey: "sub.preferences.notifications" },
  { key: "ai", labelKey: "sub.preferences.ai" },
];

interface PreferencesNavProps {
  currentTab: PreferencesTabKey;
  onSelectTab: (tab: PreferencesTabKey) => void;
}

export function PreferencesNav({ currentTab, onSelectTab }: PreferencesNavProps) {
  const { t } = useLanguage();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <div
      role="tablist"
      aria-label="Configuration studio sections"
      className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto no-scrollbar whitespace-nowrap"
    >
      {PREFERENCES_TABS.map((tab, idx) => {
        const isActive = currentTab === tab.key;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            id={`preferences-tab-${tab.key}`}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`preferences-panel-${tab.key}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelectTab(tab.key)}
            onKeyDown={(e) =>
              handleTabListKeyDown(
                e,
                PREFERENCES_TABS.map((x) => x.key),
                idx,
                onSelectTab,
                tabRefs,
              )
            }
            className={`px-3 py-1.5 rounded-md text-xs font-medium font-sans transition-colors border shrink-0 cursor-pointer ${
              isActive
                ? "bg-surface-active text-text-primary border-border-strong"
                : "bg-transparent text-text-tertiary border-transparent hover:text-text-secondary hover:bg-surface"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
