"use client";

import React from "react";

export interface SubModuleNavItem<T extends string> {
  key: T;
  label: string;
}

export function SubModuleNav<T extends string>({
  items,
  activeKey,
  onSelect,
}: {
  items: ReadonlyArray<SubModuleNavItem<T>>;
  activeKey: T;
  onSelect: (key: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 border-b border-border pb-3 overflow-x-auto no-scrollbar whitespace-nowrap">
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium font-sans border transition-colors shrink-0 cursor-pointer ${
              isActive
                ? "bg-surface-active text-text-primary border-border-strong"
                : "bg-transparent text-text-tertiary border-transparent hover:text-text-secondary hover:bg-surface"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
