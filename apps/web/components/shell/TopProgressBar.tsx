"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/primitives/BrandMark";

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
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

  if (!isNavigating) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 pointer-events-none select-none flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-default bg-surface/95 shadow-lg text-[11px] font-mono text-text-secondary animate-in fade-in duration-150"
      aria-live="polite"
      aria-label="Loading view"
    >
      <BrandMark size={14} className="animate-pulse shrink-0" />
      <span>Loading view</span>
    </div>
  );
}
