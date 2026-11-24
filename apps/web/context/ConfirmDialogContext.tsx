"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";

export interface ConfirmDialogOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}

export interface ActiveConfirmRequest extends ConfirmDialogOptions {
  id: string;
}

interface ConfirmDialogContextValue {
  activeRequest: ActiveConfirmRequest | null;
  confirmDialog: (options: ConfirmDialogOptions) => Promise<boolean>;
  resolveActive: (accepted: boolean) => void;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue>({
  activeRequest: null,
  confirmDialog: async () => false,
  resolveActive: () => {},
});

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [activeRequest, setActiveRequest] = useState<ActiveConfirmRequest | null>(null);
  const queueRef = useRef<Array<{ req: ActiveConfirmRequest; resolve: (val: boolean) => void }>>([]);
  const activeResolveRef = useRef<((val: boolean) => void) | null>(null);

  const pumpQueue = useCallback(() => {
    if (activeResolveRef.current || queueRef.current.length === 0) return;
    const next = queueRef.current.shift();
    if (!next) return;
    activeResolveRef.current = next.resolve;
    setActiveRequest(next.req);
  }, []);

  const confirmDialog = useCallback(
    (options: ConfirmDialogOptions): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        const req: ActiveConfirmRequest = {
          ...options,
          id: `cd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          variant: options.variant ?? "danger",
        };
        queueRef.current.push({ req, resolve });
        pumpQueue();
      });
    },
    [pumpQueue],
  );

  const resolveActive = useCallback(
    (accepted: boolean) => {
      const resolver = activeResolveRef.current;
      activeResolveRef.current = null;
      setActiveRequest(null);
      if (resolver) resolver(accepted);
      setTimeout(pumpQueue, 0);
    },
    [pumpQueue],
  );

  return (
    <ConfirmDialogContext.Provider value={{ activeRequest, confirmDialog, resolveActive }}>
      {children}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  return useContext(ConfirmDialogContext);
}
