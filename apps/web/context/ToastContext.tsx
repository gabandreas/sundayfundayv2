"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
  action?: ToastAction;
}

export interface ToastRecord extends ToastOptions {
  id: string;
  variant: ToastVariant;
  createdAt: number;
  durationMs: number;
}

interface ToastContextValue {
  toasts: ToastRecord[];
  toast: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
  pauseAll: () => void;
  resumeAll: () => void;
}

const DEFAULT_DURATION_BY_VARIANT: Record<ToastVariant, number> = {
  info: 4500,
  success: 4500,
  warning: 6000,
  error: 8000,
};

const NOOP_CONTEXT: ToastContextValue = {
  toasts: [],
  toast: () => "",
  dismiss: () => {},
  pauseAll: () => {},
  resumeAll: () => {},
};

const ToastContext = createContext<ToastContextValue>(NOOP_CONTEXT);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pausedRef = useRef<boolean>(false);

  const clearTimer = useCallback((id: string) => {
    const existing = timersRef.current.get(id);
    if (existing) {
      clearTimeout(existing);
      timersRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((item) => item.id !== id));
    },
    [clearTimer],
  );

  const scheduleTimer = useCallback(
    (record: ToastRecord) => {
      if (pausedRef.current || record.durationMs <= 0) return;
      clearTimer(record.id);
      const timer = setTimeout(() => {
        timersRef.current.delete(record.id);
        setToasts((prev) => prev.filter((item) => item.id !== record.id));
      }, record.durationMs);
      timersRef.current.set(record.id, timer);
    },
    [clearTimer],
  );

  const toast = useCallback(
    (opts: ToastOptions): string => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const variant: ToastVariant = opts.variant ?? "info";
      const durationMs =
        typeof opts.durationMs === "number"
          ? opts.durationMs
          : DEFAULT_DURATION_BY_VARIANT[variant];

      const record: ToastRecord = {
        ...opts,
        id,
        variant,
        createdAt: Date.now(),
        durationMs,
      };

      setToasts((prev) => {
        const dropped = prev.length >= 3 ? prev.slice(0, prev.length - 2) : [];
        for (const d of dropped) clearTimer(d.id);
        return [...prev.slice(-2), record];
      });

      scheduleTimer(record);
      return id;
    },
    [clearTimer, scheduleTimer],
  );

  const pauseAll = useCallback(() => {
    pausedRef.current = true;
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
  }, []);

  const resumeAll = useCallback(() => {
    pausedRef.current = false;
    setToasts((current) => {
      for (const record of current) {
        scheduleTimer(record);
      }
      return current;
    });
  }, [scheduleTimer]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) {
        clearTimeout(t);
      }
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider
      value={{ toasts, toast, dismiss, pauseAll, resumeAll }}
    >
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
