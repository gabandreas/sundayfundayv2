"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setGlobalAmountsMasked } from "@/lib/utils";
import { verifyAccountPassword } from "@/lib/api";
import { useAuth } from "./AuthContext";
import { VerifyPasswordModal } from "@/components/shell/VerifyPasswordModal";

interface PrivacyMaskContextType {
  isAmountsMasked: boolean;
  isVerifyModalOpen: boolean;
  toggleMask: () => void;
  openVerifyModal: () => void;
  closeVerifyModal: () => void;
  revealFigures: (password: string) => Promise<{ success: boolean; error?: string }>;
  hideFigures: () => void;
}

const PrivacyMaskContext = createContext<PrivacyMaskContextType | undefined>(undefined);

export function PrivacyMaskProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Default to true on initial load and page load
  const [isAmountsMasked, setIsAmountsMasked] = useState<boolean>(true);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);

  // Sync from localStorage on initial mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("erp_privacy_masked");
      if (stored !== null) {
        const val = stored === "1";
        setIsAmountsMasked(val);
        setGlobalAmountsMasked(val);
      }
    } catch {}
  }, []);

  // Sync with global formatter state on mount and change
  useEffect(() => {
    setGlobalAmountsMasked(isAmountsMasked);
  }, [isAmountsMasked]);

  // Reset to masked when user logs out or session changes
  useEffect(() => {
    if (!user) {
      setIsAmountsMasked(true);
      setGlobalAmountsMasked(true);
      setIsVerifyModalOpen(false);
      try {
        localStorage.removeItem("erp_privacy_masked");
      } catch {}
    }
  }, [user]);

  // m-Banking style instant privacy toggle
  const toggleMask = useCallback(() => {
    setIsAmountsMasked((prev) => {
      const next = !prev;
      setGlobalAmountsMasked(next);
      if (typeof window !== "undefined") {
        const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `erp_privacy_masked=${next ? "1" : "0"}; path=/; max-age=2592000; SameSite=Lax${secureFlag}`;
        try {
          localStorage.setItem("erp_privacy_masked", next ? "1" : "0");
        } catch {}
      }
      return next;
    });
  }, []);

  const hideFigures = useCallback(() => {
    setIsAmountsMasked(true);
    setGlobalAmountsMasked(true);
    try {
      localStorage.setItem("erp_privacy_masked", "1");
    } catch {}
  }, []);

  const openVerifyModal = useCallback(() => {
    setIsVerifyModalOpen(true);
  }, []);

  const closeVerifyModal = useCallback(() => {
    setIsVerifyModalOpen(false);
  }, []);

  const revealFigures = useCallback(async (password: string) => {
    try {
      const res = await verifyAccountPassword(password);
      if (res.verified) {
        setIsAmountsMasked(false);
        setGlobalAmountsMasked(false);
        setIsVerifyModalOpen(false);
        return { success: true };
      }
      return { success: false, error: "Password verification failed." };
    } catch (err: any) {
      return { success: false, error: err.message || "Invalid account password." };
    }
  }, []);

  return (
    <PrivacyMaskContext.Provider
      value={{
        isAmountsMasked,
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
