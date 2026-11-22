"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { syncSubInUrl } from "@/lib/tabs";

export function useSubModule<T extends string>(
  validKeys: readonly T[],
  defaultKey: T,
  aliasMap?: Record<string, T>,
): [T, (next: T) => void] {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const validKeysRef = useRef(validKeys);
  const defaultKeyRef = useRef(defaultKey);
  const aliasMapRef = useRef(aliasMap);
  validKeysRef.current = validKeys;
  defaultKeyRef.current = defaultKey;
  aliasMapRef.current = aliasMap;

  const searchParamsKey = searchParams.toString();

  const resolveParam = useCallback((): T => {
    const params =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams(searchParamsKey);
    const rawSub = params.get("sub") || params.get("tab") || "";
    const curValid = validKeysRef.current;
    const curDefault = defaultKeyRef.current;
    const curAlias = aliasMapRef.current;
    if (rawSub && (curValid as readonly string[]).includes(rawSub)) {
      return rawSub as T;
    }
    if (rawSub && curAlias && curAlias[rawSub]) {
      return curAlias[rawSub];
    }
    return curDefault;
  }, [searchParamsKey]);

  const [activeSub, setActiveSub] = useState<T>(resolveParam);

  useEffect(() => {
    setActiveSub(resolveParam());
  }, [pathname, resolveParam]);

  useEffect(() => {
    const onSubChange = (e: Event) => {
      const detail = (e as CustomEvent<{ pathname?: string; sub?: string }>).detail;
      if (!detail?.sub) return;
      if (detail.pathname && detail.pathname !== pathname) return;
      const candidate = detail.sub;
      const curValid = validKeysRef.current;
      const curAlias = aliasMapRef.current;
      if ((curValid as readonly string[]).includes(candidate)) {
        setActiveSub(candidate as T);
      } else if (curAlias && curAlias[candidate]) {
        setActiveSub(curAlias[candidate]);
      }
    };
    const onPopState = () => {
      setActiveSub(resolveParam());
    };
    window.addEventListener("erp:sub-change", onSubChange);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("erp:sub-change", onSubChange);
      window.removeEventListener("popstate", onPopState);
    };
  }, [pathname, resolveParam]);

  const selectSub = useCallback(
    (next: T) => {
      setActiveSub(next);
      syncSubInUrl(next, pathname);
    },
    [pathname],
  );

  return [activeSub, selectSub];
}
