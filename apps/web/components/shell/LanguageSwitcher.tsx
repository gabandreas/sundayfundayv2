"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe, Languages } from "lucide-react";
import { LocaleCode, useLanguage } from "@/context/LanguageContext";

const LOCALE_OPTIONS: Array<{ code: LocaleCode; short: string; label: string }> = [
  { code: "en", short: "EN", label: "English" },
  { code: "id", short: "ID", label: "Bahasa Indonesia" },
  { code: "zh", short: "中文", label: "中文 (简体)" },
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLanguage();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<(HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number }>({ top: 52, left: 0 });

  const currentOpt = LOCALE_OPTIONS.find((o) => o.code === locale) ?? LOCALE_OPTIONS[0];

  const computePos = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;
    const rect = trigger.getBoundingClientRect();
    const width = 176;
    const top = rect.bottom + 6;
    const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
    setPanelPos({ top, left });
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onToggle = (ev: Event) => {
      if ((ev as ToggleEvent).newState === "open") {
        computePos();
      }
    };
    panel.addEventListener("toggle", onToggle);
    return () => panel.removeEventListener("toggle", onToggle);
  }, [computePos]);

  if (compact) {
    const handleToggle = () => {
      const panel = panelRef.current;
      if (!panel) return;
      try {
        if (panel.matches(":popover-open")) {
          panel.hidePopover?.();
          return;
        }
        computePos();
        panel.showPopover?.();
      } catch {
        computePos();
      }
    };

    return (
      <div className="relative shrink-0">
        <button
          ref={triggerRef}
          id="locale-menu-trigger"
          type="button"
          onClick={handleToggle}
          title={currentOpt.label}
          aria-label={`Language: ${currentOpt.label}`}
          className="h-8 px-2 rounded-md border border-border-subtle bg-surface/60 hover:bg-surface hover:border-border inline-flex items-center gap-1.5 text-[11px] font-mono text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-text-tertiary shrink-0" strokeWidth={1.8} />
          <span className="font-medium text-text-primary">{currentOpt.short}</span>
          <ChevronDown className="w-3 h-3 text-text-tertiary shrink-0" strokeWidth={1.8} />
        </button>

        <div
          ref={panelRef}
          id="locale-menu-popover"
          popover="auto"
          role="group"
          aria-label="Language options"
          style={{
            top: `${panelPos.top}px`,
            left: `${panelPos.left}px`,
          }}
          className="erp-popover-panel w-44 rounded-lg border border-border-strong bg-surface shadow-2xl p-1 text-xs font-sans text-text-primary"
        >
          {LOCALE_OPTIONS.map((opt) => {
            const active = locale === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setLocale(opt.code);
                  try {
                    panelRef.current?.hidePopover?.();
                  } catch {}
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-left transition-colors cursor-pointer ${
                  active
                    ? "bg-surface-active text-text-primary font-medium"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                <span className="inline-flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono text-text-tertiary">{opt.short}</span>
                  {active && <Check className="w-3.5 h-3.5 text-accent" strokeWidth={2} />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-md bg-transparent p-0.5 shrink-0"
      role="group"
      aria-label="Language switcher"
    >
      <Languages className="w-3.5 h-3.5 text-text-tertiary ml-1 mr-0.5 hidden sm:block" />
      {LOCALE_OPTIONS.map((opt) => {
        const active = locale === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => setLocale(opt.code)}
            title={opt.label}
            aria-pressed={active}
            className={`px-2 py-1 text-[11px] font-mono rounded transition-colors cursor-pointer ${
              active
                ? "bg-surface text-text-primary font-semibold border border-border-subtle"
                : "text-text-tertiary hover:text-text-secondary border border-transparent"
            }`}
          >
            {opt.short}
          </button>
        );
      })}
    </div>
  );
}
