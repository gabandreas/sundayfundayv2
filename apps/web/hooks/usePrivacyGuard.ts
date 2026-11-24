"use client";

import { useCallback } from "react";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useToast } from "@/context/ToastContext";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Prevents editing, adding, or revealing adjustment history while balances are hidden
 * behind the global Privacy Gate, prompting an inline Reveal action toast instead.
 */
export function usePrivacyGuard() {
  const { isAmountsMasked, toggleMask } = usePrivacyMask();
  const { toast } = useToast();
  const { t } = useLanguage();

  const requireUnmasked = useCallback(
    (contextLabel?: string): boolean => {
      if (!isAmountsMasked) {
        return true;
      }

      toast({
        title: t("privacy.guardTitle"),
        description: contextLabel
          ? `${contextLabel} · ${t("privacy.guardDesc")}`
          : t("privacy.guardDesc"),
        variant: "warning",
        action: {
          label: t("privacy.revealAction"),
          onClick: () => toggleMask(),
        },
      });
      return false;
    },
    [isAmountsMasked, toggleMask, toast, t],
  );

  return { isAmountsMasked, requireUnmasked };
}
