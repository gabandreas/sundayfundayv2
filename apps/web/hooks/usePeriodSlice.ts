"use client";

import { useEffect, useRef, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";
import { getLastMutationAt } from "@/lib/api";

interface UsePeriodSliceOptions<T> {
  initialMonth: number;
  initialYear: number;
  initialData: T;
  seedCache?: (month: number, year: number, data: T) => void;
  readFromCache?: (month: number, year: number, prev: T) => T | undefined;
  fetchForPeriod: (month: number, year: number) => Promise<T>;
}

function shallowEqualRecord(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Shared period-reactive state controller for Next.js Client Views.
 * Guards against stale prefetched RSC initialData after prior client mutations,
 * hydrates instant cache hits, and runs smooth background revalidation.
 */
export function usePeriodSlice<T>({
  initialMonth,
  initialYear,
  initialData,
  seedCache,
  readFromCache,
  fetchForPeriod,
}: UsePeriodSliceOptions<T>) {
  const { month, year, revisionTick } = usePeriod();
  const mountMutationAtRef = useRef<number>(getLastMutationAt());
  const needsMountRevalidateRef = useRef<boolean>(mountMutationAtRef.current > 0);
  const [data, setData] = useState<T>(() => {
    if (mountMutationAtRef.current > 0 && readFromCache) {
      const fresh = readFromCache(initialMonth, initialYear, initialData);
      if (fresh !== undefined) return fresh;
    }
    return initialData;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const dataRef = useRef<T>(data);
  dataRef.current = data;
  const renderedPeriodRef = useRef<string>(`${initialYear}-${initialMonth}`);
  const prevInitialRef = useRef<{ month: number; year: number; data: T } | null>(
    null,
  );
  const lastRevRef = useRef<number>(revisionTick);
  const reqSeqRef = useRef<number>(0);

  const seedRef = useRef(seedCache);
  seedRef.current = seedCache;
  const readRef = useRef(readFromCache);
  readRef.current = readFromCache;
  const fetchRef = useRef(fetchForPeriod);
  fetchRef.current = fetchForPeriod;

  // Sync genuinely new SSR props, but never poison cache with stale RSC payloads post-mutation
  useEffect(() => {
    const prev = prevInitialRef.current;
    const initialChanged =
      !prev ||
      prev.month !== initialMonth ||
      prev.year !== initialYear ||
      !shallowEqualRecord(prev.data, initialData);

    if (!initialChanged) return;
    prevInitialRef.current = {
      month: initialMonth,
      year: initialYear,
      data: initialData,
    };

    const staleSsrAfterMutation = prev === null && mountMutationAtRef.current > 0;
    if (!staleSsrAfterMutation) {
      seedRef.current?.(initialMonth, initialYear, initialData);
      if (month === initialMonth && year === initialYear) {
        setData(initialData);
        renderedPeriodRef.current = `${initialYear}-${initialMonth}`;
        setIsLoading(false);
      }
    }
  }, [initialMonth, initialYear, initialData, month, year]);

  useEffect(() => {
    const isPreBoundary = year < 2026 || (year === 2026 && month < 10);
    if (isPreBoundary) {
      reqSeqRef.current += 1;
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const revChanged = revisionTick !== lastRevRef.current;
    lastRevRef.current = revisionTick;
    const forceMountRevalidate = needsMountRevalidateRef.current;
    if (forceMountRevalidate) {
      needsMountRevalidateRef.current = false;
    }

    const targetKey = `${year}-${month}`;
    if (!revChanged && !forceMountRevalidate && renderedPeriodRef.current === targetKey) {
      return;
    }

    if (!revChanged && readRef.current) {
      const cached = readRef.current(month, year, dataRef.current);
      if (cached !== undefined) {
        reqSeqRef.current += 1;
        renderedPeriodRef.current = targetKey;
        setData(cached);
        setIsLoading(false);
        if (!forceMountRevalidate) {
          return;
        }
      }
    }

    const seq = ++reqSeqRef.current;
    if (!revChanged && !forceMountRevalidate) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("erp:revalidating-start"));
    }

    let cancelled = false;

    void fetchRef
      .current(month, year)
      .then((next) => {
        if (cancelled || seq !== reqSeqRef.current) return;
        renderedPeriodRef.current = targetKey;
        setData(next);
      })
      .finally(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("erp:revalidating-end"));
        }
        if (!cancelled && seq === reqSeqRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [month, year, revisionTick]);

  return {
    month,
    year,
    revisionTick,
    data,
    isLoading,
    isRefreshing,
    setData,
    isPreBoundary: year < 2026 || (year === 2026 && month < 10),
  };
}
