"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { setGlobalAmountsMasked } from "@/lib/utils";
import { verifyAccountPassword } from "@/lib/api";
import { useAuth } from "./AuthContext";
import { VerifyPasswordModal } from "@/components/shell/VerifyPasswordModal";

interface PrivacyMaskContextType {
  isAmountsMasked: boolean;
  isSessionPasswordVerified: boolean;
  isVerifyModalOpen: boolean;
  toggleMask: () => void;
  openVerifyModal: () => void;
  closeVerifyModal: () => void;
  revealFigures: (password: string) => Promise<{ success: boolean; error?: string }>;
  hideFigures: () => void;
}

const PrivacyMaskContext = createContext<PrivacyMaskContextType | undefined>(undefined);

function getSessionPrivacyKey(token: string | null): string {
  if (!token) return "erp_privacy_session_anon";
  try {
    const parts = token.split(".");
    const sig = parts[2] ? parts[2].slice(-16) : token.slice(-16);
    return `erp_privacy_session_${sig}`;
  } catch {
    return "erp_privacy_session_fallback";
  }
}

export function PrivacyMaskProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [isAmountsMasked, setIsAmountsMasked] = useState<boolean>(true);
  const [isSessionPasswordVerified, setIsSessionPasswordVerified] = useState<boolean>(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);

  const sessionKey = useMemo(() => getSessionPrivacyKey(token), [token]);

  // Sync session-scoped privacy state from sessionStorage on mount or token change
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!token || !user) {
      setIsAmountsMasked(true);
      setIsSessionPasswordVerified(false);
      setGlobalAmountsMasked(true);
      return;
    }

    try {
      const stored = sessionStorage.getItem(sessionKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.isSessionPasswordVerified === true) {
          setIsSessionPasswordVerified(true);
          const masked = Boolean(parsed.isAmountsMasked);
          setIsAmountsMasked(masked);
          setGlobalAmountsMasked(masked);
          return;
        }
      }
      // If no valid verified session exists in sessionStorage, start strictly masked and unverified
      setIsAmountsMasked(true);
      setIsSessionPasswordVerified(false);
      setGlobalAmountsMasked(true);
    } catch {
      setIsAmountsMasked(true);
      setIsSessionPasswordVerified(false);
      setGlobalAmountsMasked(true);
    }
  }, [sessionKey, token, user]);

  // Sync with global formatter state whenever isAmountsMasked changes
  useEffect(() => {
    setGlobalAmountsMasked(isAmountsMasked);
  }, [isAmountsMasked]);

  const openVerifyModal = useCallback(() => {
    setIsVerifyModalOpen(true);
  }, []);

  const closeVerifyModal = useCallback(() => {
    setIsVerifyModalOpen(false);
  }, []);

  // First reveal in session requires account password; subsequent toggles within verified session work 1-click
  const toggleMask = useCallback(() => {
    // If currently masked and not verified in this session, prompt for password
    if (isAmountsMasked) {
      if (!isSessionPasswordVerified) {
        setIsVerifyModalOpen(true);
        return;
      }
      // Already verified in this active session: unmask immediately
      setIsAmountsMasked(false);
      setGlobalAmountsMasked(false);
      try {
        sessionStorage.setItem(
          sessionKey,
          JSON.stringify({ isSessionPasswordVerified: true, isAmountsMasked: false })
        );
      } catch {}
    } else {
      // Currently revealed: re-mask immediately without prompt
      setIsAmountsMasked(true);
      setGlobalAmountsMasked(true);
      try {
        sessionStorage.setItem(
          sessionKey,
          JSON.stringify({ isSessionPasswordVerified: true, isAmountsMasked: true })
        );
      } catch {}
    }
  }, [isAmountsMasked, isSessionPasswordVerified, sessionKey]);

  const hideFigures = useCallback(() => {
    setIsAmountsMasked(true);
    setGlobalAmountsMasked(true);
    try {
      if (isSessionPasswordVerified) {
        sessionStorage.setItem(
          sessionKey,
          JSON.stringify({ isSessionPasswordVerified: true, isAmountsMasked: true })
        );
      }
    } catch {}
  }, [isSessionPasswordVerified, sessionKey]);

  const revealFigures = useCallback(
    async (password: string) => {
      try {
        const res = await verifyAccountPassword(password);
        if (res.verified) {
          setIsAmountsMasked(false);
          setIsSessionPasswordVerified(true);
          setGlobalAmountsMasked(false);
          setIsVerifyModalOpen(false);
          try {
            sessionStorage.setItem(
              sessionKey,
              JSON.stringify({ isSessionPasswordVerified: true, isAmountsMasked: false })
            );
          } catch {}
          return { success: true };
        }
        return { success: false, error: "Password verification failed." };
      } catch (err: any) {
        return { success: false, error: err.message || "Invalid account password." };
      }
    },
    [sessionKey]
  );

  return (
    <PrivacyMaskContext.Provider
      value={{
        isAmountsMasked,
        isSessionPasswordVerified,
        isVerifyModalOpen,
        toggleMask,
        openVerifyModal,
        closeVerifyModal,
        revealFigures,
        hideFigures,
      }}
    >
      <div key={isAmountsMasked ? "masked" : "unmasked"} className="contents">
        {children}
      </div>
      <VerifyPasswordModal />
    </PrivacyMaskContext.Provider>
  );
}

export function usePrivacyMask(): PrivacyMaskContextType {
  const context = useContext(PrivacyMaskContext);
  if (!context) {
    throw new Error("usePrivacyMask must be used within a PrivacyMaskProvider");
  }
  return context;
}
