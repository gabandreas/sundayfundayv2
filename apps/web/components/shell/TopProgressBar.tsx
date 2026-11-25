"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/primitives/BrandMark";

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [revalCount, setRevalCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isNavigating) {
      if (timerRef.current) clearTimeout(timerRef.current);
      const doneTimer = setTimeout(() => {
        setIsNavigating(false);
      }, 140);
      return () => clearTimeout(doneTimer);
    }
  }, [pathname, searchParams, isNavigating]);

  useEffect(() => {
    const onStart = () => setRevalCount((c) => c + 1);
    const onEnd = () => setRevalCount((c) => Math.max(0, c - 1));
    window.addEventListener("erp:revalidating-start", onStart);
    window.addEventListener("erp:revalidating-end", onEnd);
    return () => {
      window.removeEventListener("erp:revalidating-start", onStart);
      window.removeEventListener("erp:revalidating-end", onEnd);
    };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("http") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.getAttribute("target") === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (href === currentUrl) return;

      setIsNavigating(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsNavigating(false);
      }, 6000);
    };

    window.addEventListener("click", handleClick, { capture: true });
    return () => {
      window.removeEventListener("click", handleClick, { capture: true });
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showTopLine = isNavigating || revalCount > 0;

  return (
    <>
      {showTopLine && (
        <div
          className="fixed top-0 left-0 right-0 z-50 h-[2px] pointer-events-none bg-accent/20 overflow-hidden"
          aria-hidden="true"
        >
          <div className="h-full w-2/5 bg-accent animate-pulse" />
        </div>
      )}
      {isNavigating && (
        <div
          className="fixed bottom-4 right-16 z-40 pointer-events-none select-none flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-default bg-surface shadow-lg text-[11px] font-sans text-text-secondary"
          aria-live="polite"
          aria-label="Loading view"
        >
          <BrandMark size={14} className="animate-pulse shrink-0" />
          <span>Loading view</span>
        </div>
      )}
    </>
  );
}
