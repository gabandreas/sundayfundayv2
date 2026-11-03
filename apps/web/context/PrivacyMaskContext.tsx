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
    }
  }, [user]);

  const toggleMask = useCallback(() => {
    if (isAmountsMasked) {
      setIsVerifyModalOpen(true);
    } else {
      setIsAmountsMasked(true);
      setGlobalAmountsMasked(true);
    }
  }, [isAmountsMasked]);

  const hideFigures = useCallback(() => {
    setIsAmountsMasked(true);
    setGlobalAmountsMasked(true);
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
