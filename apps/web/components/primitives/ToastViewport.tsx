"use client";

import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useToast, ToastVariant } from "@/context/ToastContext";

const VARIANT_ACCENT: Record<ToastVariant, string> = {
  success: "border-l-delta-positive",
  warning: "border-l-caution",
  error: "border-l-urgency",
  info: "border-l-border-strong",
};

export function ToastViewport() {
  const { toasts, dismiss, pauseAll, resumeAll } = useToast();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const announcedIdsRef = useRef<Set<string>>(new Set());
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => {
    const el = viewportRef.current as
      | (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void })
      | null;
    if (!el) return;

    if (toasts.length > 0) {
      try {
        if (!el.matches(":popover-open")) {
          el.showPopover?.();
        }
      } catch {
        // Fallback when Popover API is unavailable in tests
      }

      const newest = toasts[toasts.length - 1];
      if (newest && !announcedIdsRef.current.has(newest.id)) {
        announcedIdsRef.current.add(newest.id);
        const announcement = newest.description
          ? `${newest.title}. ${newest.description}`
          : newest.title;
        setLiveMessage(announcement);
        const nav = navigator as unknown as {
          ariaNotify?: (msg: string, opts?: { priority?: "normal" | "high" }) => void;
        };
        if (typeof nav.ariaNotify === "function") {
          nav.ariaNotify(announcement, {
            priority: newest.variant === "error" ? "high" : "normal",
          });
        }
      }
    } else {
      try {
        if (el.matches(":popover-open")) {
          el.hidePopover?.();
        }
      } catch {
        // ignore
      }
    }
  }, [toasts]);

  return (
    <>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </span>

      <div
        ref={viewportRef}
        popover="manual"
        role="region"
        aria-label="Notifications"
        onMouseEnter={pauseAll}
        onMouseLeave={resumeAll}
        onFocusCapture={pauseAll}
        onBlurCapture={resumeAll}
        className="erp-toast-viewport"
      >
        {toasts.length > 0 && (
          <div className="flex flex-col gap-2 w-full">
            {toasts.map((item) => (
              <div
                key={item.id}
                role={item.variant === "error" ? "alert" : "status"}
                className={`rounded-md border border-border border-l-2 ${VARIANT_ACCENT[item.variant]} bg-surface px-3.5 py-2.5 shadow-xl flex items-start justify-between gap-3 text-xs pointer-events-auto`}
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="font-medium text-text-primary leading-snug">
                    {item.title}
                  </div>
                  {item.description && (
                    <div className="text-[11px] text-text-secondary leading-relaxed">
                      {item.description}
                    </div>
                  )}
                  {item.action && (
                    <button
                      type="button"
                      onClick={() => {
                        item.action?.onClick();
                        dismiss(item.id);
                      }}
                      className="mt-1 inline-block text-[11px] font-mono text-delta-positive hover:underline cursor-pointer"
                    >
                      {item.action.label}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="Close"
                  title="Close"
                  className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
