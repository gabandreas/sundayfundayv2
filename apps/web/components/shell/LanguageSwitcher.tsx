"use client";

import React from "react";
import { Languages } from "lucide-react";
import { LocaleCode, useLanguage } from "@/context/LanguageContext";

const LOCALE_OPTIONS: Array<{ code: LocaleCode; short: string; label: string }> = [
  { code: "en", short: "EN", label: "English" },
  { code: "id", short: "ID", label: "Bahasa Indonesia" },
  { code: "zh", short: "中文", label: "中文 (简体)" },
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLanguage();

  return (
    <div
      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface p-0.5 shrink-0"
      role="group"
      aria-label="Language switcher"
    >
      {!compact && <Languages className="w-3.5 h-3.5 text-text-tertiary ml-1.5 mr-0.5 hidden sm:block" />}
      {LOCALE_OPTIONS.map((opt) => {
        const active = locale === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => setLocale(opt.code)}
            title={opt.label}
            aria-pressed={active}
            className={`px-1.5 py-1 text-[10px] font-mono rounded transition-colors cursor-pointer ${
              active
                ? "bg-surface-strong text-text-primary font-semibold border border-border-strong"
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
