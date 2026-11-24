"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { getJakartaDateParts } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

interface ErpDatePickerProps {
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  allowClear?: boolean;
}

function parseIsoDate(iso: string): { year: number; month: number; day: number } | null {
  const clean = (iso || "").slice(0, 10);
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function formatDisplayDate(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return "";
  return `${String(parsed.day).padStart(2, "0")} ${SHORT_MONTHS[parsed.month - 1]} ${parsed.year}`;
}

export function ErpDatePicker({
  value,
  onChange,
  disabled = false,
  compact = false,
  className = "",
  placeholder = "Select date",
  ariaLabel = "Select date",
  id,
  name,
  min,
  max,
  allowClear = false,
}: ErpDatePickerProps) {
  const { t } = useLanguage();
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<(HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null>(null);

  const todayIso = getJakartaDateParts().isoDate;
  const parsedValue = parseIsoDate(value) ?? parseIsoDate(todayIso)!;

  const [viewYear, setViewYear] = useState<number>(parsedValue.year);
  const [viewMonth, setViewMonth] = useState<number>(parsedValue.month);
  const [showYearGrid, setShowYearGrid] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    const p = parseIsoDate(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  const computeAndApplyPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || typeof window === "undefined") return;
    const rect = trigger.getBoundingClientRect();
    if (rect.width === 0 || rect.bottom < 52 || rect.top > window.innerHeight - 16) {
      try {
        if (panel?.matches(":popover-open")) {
          panel.hidePopover?.();
        }
      } catch {}
      return;
    }

    const panelWidth = 264;
    const panelHeight = 296;
    const gap = 6;

    const fitsBelow = rect.bottom + gap + panelHeight <= window.innerHeight - 12;
    const top = fitsBelow
      ? rect.bottom + gap
      : Math.max(12, rect.top - gap - panelHeight);

    const left = Math.max(
      12,
      Math.min(rect.left, window.innerWidth - panelWidth - 12),
    );
    setPanelPos({ top: Math.round(top), left: Math.round(left) });
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onBeforeToggle = (ev: Event) => {
      const toggleEv = ev as ToggleEvent;
      if (toggleEv.newState === "open") {
        setShowYearGrid(false);
        computeAndApplyPosition();
      }
    };
    const onToggle = (ev: Event) => {
      const toggleEv = ev as ToggleEvent;
      const open = toggleEv.newState === "open";
      setIsOpen(open);
      if (open) {
        computeAndApplyPosition();
      } else {
        setShowYearGrid(false);
      }
    };
    panel.addEventListener("beforetoggle", onBeforeToggle);
    panel.addEventListener("toggle", onToggle);
    return () => {
      panel.removeEventListener("beforetoggle", onBeforeToggle);
      panel.removeEventListener("toggle", onToggle);
    };
  }, [computeAndApplyPosition]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    let rafId = 0;
    const scheduleSync = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        computeAndApplyPosition();
      });
    };
    window.addEventListener("scroll", scheduleSync, { capture: true, passive: true });
    window.addEventListener("resize", scheduleSync, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", scheduleSync, { capture: true });
      window.removeEventListener("resize", scheduleSync);
    };
  }, [isOpen, computeAndApplyPosition]);

  const calendarDays = useMemo(() => {
    const firstUtc = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
    const firstWeekdayMon0 = (firstUtc.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
    const prevMonthYear = viewMonth === 1 ? viewYear - 1 : viewYear;
    const prevMonthNum = viewMonth === 1 ? 12 : viewMonth - 1;
    const prevMonthDays = new Date(Date.UTC(prevMonthYear, prevMonthNum, 0)).getUTCDate();

    const cells: Array<{
      iso: string;
      day: number;
      inCurrentMonth: boolean;
      disabled: boolean;
    }> = [];

    for (let i = firstWeekdayMon0 - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const iso = `${prevMonthYear}-${String(prevMonthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({
        iso,
        day,
        inCurrentMonth: false,
        disabled: Boolean((min && iso < min) || (max && iso > max)),
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({
        iso,
        day,
        inCurrentMonth: true,
        disabled: Boolean((min && iso < min) || (max && iso > max)),
      });
    }

    const trailingNeeded = (7 - (cells.length % 7)) % 7;
    const nextMonthYear = viewMonth === 12 ? viewYear + 1 : viewYear;
    const nextMonthNum = viewMonth === 12 ? 1 : viewMonth + 1;
    for (let day = 1; day <= trailingNeeded; day++) {
      const iso = `${nextMonthYear}-${String(nextMonthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({
        iso,
        day,
        inCurrentMonth: false,
        disabled: Boolean((min && iso < min) || (max && iso > max)),
      });
    }

    return cells;
  }, [viewYear, viewMonth, min, max]);

  const stepMonth = (delta: number) => {
    const total = viewYear * 12 + (viewMonth - 1) + delta;
    setViewYear(Math.floor(total / 12));
    setViewMonth((total % 12) + 1);
  };

  const selectDate = (iso: string) => {
    onChange(iso);
    try {
      panelRef.current?.hidePopover?.();
    } catch {}
  };

  const displayStr = formatDisplayDate(value);
  const yearChoices = useMemo(() => {
    const arr: number[] = [];
    for (let y = viewYear - 3; y <= viewYear + 4; y++) {
      arr.push(y);
    }
    return arr;
  }, [viewYear]);

  return (
    <div className="relative w-full">
      {name && <input type="hidden" name={name} value={value} />}

      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        popoverTarget={disabled ? undefined : popoverId}
        onClick={(e) => e.stopPropagation()}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        data-testid="erp-date-picker-trigger"
        className={`w-full flex items-center justify-between gap-2 rounded border border-border text-text-primary font-mono tabular-nums transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 ${
          compact
            ? "h-7 px-2 text-[10px] bg-canvas hover:border-border-strong"
            : "h-8 px-3 text-xs bg-surface-subtle hover:border-border-strong"
        } ${className}`}
      >
        <span className={`truncate ${displayStr ? "text-text-primary" : "text-text-disabled"}`}>
          {displayStr || placeholder}
        </span>
        <Calendar className="w-3.5 h-3.5 text-text-tertiary shrink-0" strokeWidth={1.8} />
      </button>

      <div
        ref={panelRef}
        id={popoverId}
        popover="auto"
        role="group"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        style={{
          top: `${panelPos.top}px`,
          left: `${panelPos.left}px`,
        }}
        className="erp-popover-panel w-[264px] rounded-lg border border-border-strong bg-surface shadow-2xl p-2.5 text-text-primary select-none"
      >
        {/* Month / Year Controls */}
        <div className="flex items-center justify-between gap-1 pb-2 mb-2 border-b border-border-subtle">
          <button
            type="button"
            onClick={() => stepMonth(-1)}
            aria-label="Previous month"
            className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowYearGrid((prev) => !prev)}
            className="px-2 py-1 rounded text-xs font-sans font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          >
            {SHORT_MONTHS[viewMonth - 1]} <span className="font-mono text-text-secondary">{viewYear}</span>
          </button>

          <button
            type="button"
            onClick={() => stepMonth(1)}
            aria-label="Next month"
            className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {showYearGrid ? (
          <div className="space-y-2 py-1">
            <div className="grid grid-cols-4 gap-1">
              {yearChoices.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setViewYear(y)}
                  className={`py-1 rounded text-[11px] font-mono tabular-nums cursor-pointer transition-colors ${
                    y === viewYear
                      ? "bg-surface-active text-text-primary border border-border font-semibold"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-border-subtle">
              {SHORT_MONTHS.map((mLabel, idx) => {
                const mNum = idx + 1;
                return (
                  <button
                    key={mLabel}
                    type="button"
                    onClick={() => {
                      setViewMonth(mNum);
                      setShowYearGrid(false);
                    }}
                    className={`py-1 rounded text-[11px] font-sans cursor-pointer transition-colors ${
                      mNum === viewMonth
                        ? "bg-accent/15 text-accent border border-accent/40 font-semibold"
                        : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    }`}
                  >
                    {mLabel}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {WEEKDAY_HEADERS.map((wd) => (
                <div
                  key={wd}
                  className="text-center text-[10px] font-sans font-medium text-text-tertiary py-0.5"
                >
                  {wd}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map((cell) => {
                const isSelected = cell.iso === (value || "").slice(0, 10);
                const isToday = cell.iso === todayIso;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    disabled={cell.disabled}
                    onClick={() => selectDate(cell.iso)}
                    className={`h-7 w-full rounded text-[11px] font-mono tabular-nums transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed ${
                      isSelected
                        ? "bg-accent/20 text-accent border border-accent/60 font-semibold"
                        : isToday
                        ? "border border-border-strong text-text-primary hover:bg-surface-hover"
                        : cell.inCurrentMonth
                        ? "text-text-primary hover:bg-surface-hover border border-transparent"
                        : "text-text-disabled hover:bg-surface-hover/50 border border-transparent"
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Footer Actions */}
        <div className="mt-2 pt-2 border-t border-border-subtle flex items-center justify-between gap-2 text-[11px] font-sans">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => selectDate(todayIso)}
              className="px-2 py-0.5 rounded text-delta-positive hover:bg-surface-hover transition-colors cursor-pointer font-medium"
            >
              {t("datePicker.today", "Today")}
            </button>
            {allowClear && value && (
              <button
                type="button"
                onClick={() => selectDate("")}
                className="px-2 py-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
              >
                {t("datePicker.clear", "Clear")}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => panelRef.current?.hidePopover?.()}
            className="px-2 py-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
          >
            {t("datePicker.close", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
