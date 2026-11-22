"use client";

import React, { useRef } from "react";
import { TranslationKey, useLanguage } from "@/context/LanguageContext";
import { handleTabListKeyDown } from "@/lib/tabs";

export type CreditTabType = "matrix" | "card" | "contracts";

interface CreditTabNavProps {
  currentTab: CreditTabType;
  onSelectTab: (tab: CreditTabType) => void;
}

const CREDIT_TABS: Array<{ id: CreditTabType; labelKey: TranslationKey }> = [
  { id: "matrix", labelKey: "credit.tab.overview" },
  { id: "card", labelKey: "credit.tab.cards" },
  { id: "contracts", labelKey: "credit.tab.contracts" },
];

export function CreditTabNav({ currentTab, onSelectTab }: CreditTabNavProps) {
  const { t } = useLanguage();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <div
      role="tablist"
      aria-label="Credit and liability sections"
      className="flex items-center gap-6 border-b border-border overflow-x-auto no-scrollbar whitespace-nowrap"
    >
      {CREDIT_TABS.map((tab, idx) => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            id={`credit-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`credit-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelectTab(tab.id)}
            onKeyDown={(e) =>
              handleTabListKeyDown(
                e,
                CREDIT_TABS.map((x) => x.id),
                idx,
                onSelectTab,
                tabRefs,
              )
            }
            className={`pb-3 text-xs font-medium font-sans transition-colors border-b-2 -mb-px shrink-0 cursor-pointer ${
              isActive
                ? "border-accent text-text-primary"
                : "border-transparent text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
