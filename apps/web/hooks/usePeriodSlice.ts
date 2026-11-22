"use client";

import { useEffect, useRef, useState } from "react";
import { usePeriod } from "@/context/PeriodContext";

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
 * Seeds initial SSR payloads into the client cache, renders synchronous cache hits
 * in <2ms on header period clicks, and guards out-of-order responses with a sequence counter.
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
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(false);

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

  // Keep local state aligned when Next.js delivers genuinely new SSR props
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
    seedRef.current?.(initialMonth, initialYear, initialData);

    if (month === initialMonth && year === initialYear) {
      setData(initialData);
      renderedPeriodRef.current = `${initialYear}-${initialMonth}`;
      setIsLoading(false);
    }
  }, [initialMonth, initialYear, initialData, month, year]);

  useEffect(() => {
    const isPreBoundary = year < 2026 || (year === 2026 && month < 10);
    if (isPreBoundary) {
      reqSeqRef.current += 1;
      setIsLoading(false);
      return;
    }

    const revChanged = revisionTick !== lastRevRef.current;
    lastRevRef.current = revisionTick;

    const targetKey = `${year}-${month}`;
    if (!revChanged && renderedPeriodRef.current === targetKey) {
      return;
    }

    if (!revChanged && readRef.current) {
      const cached = readRef.current(month, year, dataRef.current);
      if (cached !== undefined) {
        reqSeqRef.current += 1;
        renderedPeriodRef.current = targetKey;
        setData(cached);
        setIsLoading(false);
        return;
      }
    }

    const seq = ++reqSeqRef.current;
    // Only indicate loading when switching to an uncached period; background
    // mutation refreshes keep rendered data visible without dimming the screen.
    if (!revChanged) {
      setIsLoading(true);
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
        if (!cancelled && seq === reqSeqRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [month, year, revisionTick]);

  return {
    month,
    year,
    data,
    isLoading,
    setData,
    isPreBoundary: year < 2026 || (year === 2026 && month < 10),
  };
}
