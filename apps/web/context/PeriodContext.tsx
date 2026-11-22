"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getDefaultPayrollPeriod } from "@/lib/utils";
import {
  fetchDefaultActivePeriod,
  prefetchHorizonData,
  prefetchPeriodData,
} from "@/lib/api";

interface PeriodContextValue {
  month: number;
  year: number;
  periodKey: string;
  revisionTick: number;
  setPeriod: (nextMonth: number, nextYear: number) => void;
  refreshPeriod: () => void;
}

const PeriodContext = createContext<PeriodContextValue | undefined>(undefined);

function parsePositiveInt(val: string | null): number | null {
  if (!val) return null;
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const defaults = getDefaultPayrollPeriod();
  const urlMonth = parsePositiveInt(searchParams.get("month"));
  const urlYear = parsePositiveInt(searchParams.get("year"));

  const [month, setMonth] = useState<number>(
    urlMonth && urlMonth >= 1 && urlMonth <= 12 ? urlMonth : defaults.month
  );
  const [year, setYear] = useState<number>(
    urlYear && urlYear >= 2020 ? urlYear : defaults.year
  );
  const [revisionTick, setRevisionTick] = useState<number>(0);

  const prefetchedForUserRef = useRef<number | null>(null);
  const resolvedDefaultForUserRef = useRef<number | null>(null);
  const monthRef = useRef<number>(month);
  const yearRef = useRef<number>(year);
  monthRef.current = month;
  yearRef.current = year;

  // Smart default active period resolution when landing without explicit URL ?month=&year=
  useEffect(() => {
    if (!user?.id) return;
    if (resolvedDefaultForUserRef.current === user.id) return;
    resolvedDefaultForUserRef.current = user.id;

    const sp =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : searchParams;
    const explicitM = parsePositiveInt(sp.get("month"));
    const explicitY = parsePositiveInt(sp.get("year"));
    if (explicitM && explicitY) return;

    let cancelled = false;
    fetchDefaultActivePeriod().then((resolved) => {
      if (cancelled || !resolved) return;
      if (resolved.month !== monthRef.current || resolved.year !== yearRef.current) {
        setMonth(resolved.month);
        setYear(resolved.year);
        if (typeof window !== "undefined") {
          const nextSp = new URLSearchParams(window.location.search);
          nextSp.set("month", String(resolved.month));
          nextSp.set("year", String(resolved.year));
          const qs = nextSp.toString();
          const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
          window.history.replaceState(window.history.state, "", nextUrl);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, searchParams]);

  // Synchronize context when Next.js navigation changes URL query params
  useEffect(() => {
    const sp =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : searchParams;
    const m = parsePositiveInt(sp.get("month"));
    const y = parsePositiveInt(sp.get("year"));
    if (m && m >= 1 && m <= 12 && y && y >= 2020) {
      setMonth((prev) => (prev === m ? prev : m));
      setYear((prev) => (prev === y ? prev : y));
    }
  }, [searchParams, pathname]);

  // Synchronize context on browser Back/Forward (popstate after replaceState)
  useEffect(() => {
    const onPopState = () => {
      const sp = new URLSearchParams(window.location.search);
      const m = parsePositiveInt(sp.get("month"));
      const y = parsePositiveInt(sp.get("year"));
      if (m && m >= 1 && m <= 12 && y && y >= 2020) {
        setMonth(m);
        setYear(y);
      } else {
        const d = getDefaultPayrollPeriod();
        setMonth(d.month);
        setYear(d.year);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Re-notify reactive period views and re-warm horizon whenever client cache invalidates after a mutation
  useEffect(() => {
    const onMutated = () => {
      setRevisionTick((t) => t + 1);
      if (user?.id) {
        setTimeout(() => {
          void prefetchHorizonData(monthRef.current, yearRef.current);
        }, 120);
      }
    };
    window.addEventListener("erp:data-mutated", onMutated);
    return () => window.removeEventListener("erp:data-mutated", onMutated);
  }, [user?.id]);

  // Preload 12-month horizon (07/2026–06/2027) and adjacent months once per session/user
  useEffect(() => {
    if (!user?.id) return;
    if (prefetchedForUserRef.current === user.id) return;
    prefetchedForUserRef.current = user.id;
    void prefetchHorizonData(month, year);
  }, [user?.id, month, year]);

  const setPeriod = useCallback(
    (nextMonth: number, nextYear: number) => {
      const safeMonth = Math.min(12, Math.max(1, Math.round(nextMonth)));
      const safeYear = Math.max(2026, Math.round(nextYear));

      setMonth(safeMonth);
      setYear(safeYear);

      if (typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        sp.set("month", String(safeMonth));
        sp.set("year", String(safeYear));
        const qs = sp.toString();
        const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
        window.history.replaceState(window.history.state, "", nextUrl);

        // Quietly warm up adjacent periods around the newly focused period
        const prevM = safeMonth === 1 ? 12 : safeMonth - 1;
        const prevY = safeMonth === 1 ? safeYear - 1 : safeYear;
        const nextM = safeMonth === 12 ? 1 : safeMonth + 1;
        const nextY = safeMonth === 12 ? safeYear + 1 : safeYear;
        void prefetchPeriodData(prevM, prevY);
        void prefetchPeriodData(nextM, nextY);
      }
    },
    []
  );

  const refreshPeriod = useCallback(() => {
    setRevisionTick((t) => t + 1);
  }, []);

  return (
    <PeriodContext.Provider
      value={{
        month,
        year,
        periodKey: `${year}-${month}`,
        revisionTick,
        setPeriod,
        refreshPeriod,
      }}
    >
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod(): PeriodContextValue {
  const ctx = useContext(PeriodContext);
  if (!ctx) {
    throw new Error("usePeriod must be used within a PeriodProvider");
  }
  return ctx;
}
