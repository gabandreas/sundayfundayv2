"use client";

import React, { useEffect, useRef } from "react";
import { AlertTriangle, HelpCircle, X } from "lucide-react";
import { useConfirmDialog } from "@/context/ConfirmDialogContext";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Native top-layer modal confirmation dialog replacing browser confirm().
 * Uses semantic modal attributes natively without duplicate ARIA modal roles,
 * backdrop click handling via closedby="any" + pointerdown/up Safari fallback,
 * returnValue reset on close, and initial focus on the safe action for danger flows.
 */
export function ConfirmDialogHost() {
  const { activeRequest, resolveActive } = useConfirmDialog();
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const resolvedForIdRef = useRef<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (activeRequest) {
      resolvedForIdRef.current = null;
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          // Safe guard in jsdom environments
        }
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [activeRequest]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      const accepted = dialog.returnValue === "confirm";
      dialog.returnValue = "";
      if (activeRequest && resolvedForIdRef.current !== activeRequest.id) {
        resolvedForIdRef.current = activeRequest.id;
        resolveActive(accepted);
      }
    };

    dialog.addEventListener("close", handleClose);

    let cleanupPointer: (() => void) | undefined;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      const onDown = (e: PointerEvent) => {
        pressedOutside = outside(e);
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && outside(e)) {
          dialog.close("cancel");
        }
      };
      dialog.addEventListener("pointerdown", onDown);
      dialog.addEventListener("pointerup", onUp);
      cleanupPointer = () => {
        dialog.removeEventListener("pointerdown", onDown);
        dialog.removeEventListener("pointerup", onUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      cleanupPointer?.();
    };
  }, [activeRequest, resolveActive]);

  const isDanger = activeRequest?.variant !== "default";
  const cancelText = activeRequest?.cancelLabel || t("dialog.cancel", "Cancel");
  const confirmText =
    activeRequest?.confirmLabel || (isDanger ? t("dialog.remove", "Confirm Removal") : t("dialog.confirm", "Confirm"));

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="erp-confirm-dialog-title"
      aria-describedby={activeRequest?.description ? "erp-confirm-dialog-desc" : undefined}
      className="erp-dialog erp-confirm-dialog max-w-md w-full shadow-2xl overflow-hidden"
    >
      {activeRequest && (
        <form method="dialog" className="flex flex-col">
          <div className="px-5 py-4 border-b border-border-subtle flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              {isDanger ? (
                <AlertTriangle className="w-4 h-4 text-delta-negative shrink-0 mt-0.5" strokeWidth={1.8} />
              ) : (
                <HelpCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={1.8} />
              )}
              <div className="space-y-1 min-w-0">
                <h2
                  id="erp-confirm-dialog-title"
                  className="text-sm font-semibold font-sans text-text-primary leading-snug"
                >
                  {activeRequest.title}
                </h2>
                {activeRequest.description && (
                  <p
                    id="erp-confirm-dialog-desc"
                    className="text-xs font-sans text-text-secondary leading-relaxed"
                  >
                    {activeRequest.description}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              value="cancel"
              aria-label={cancelText}
              className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-3.5 bg-surface-subtle/60 flex items-center justify-end gap-2">
            <button
              type="submit"
              value="cancel"
              autoFocus={isDanger}
              className="px-3 py-1.5 rounded text-xs font-sans font-medium bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              type="submit"
              value="confirm"
              autoFocus={!isDanger}
              className={`px-3.5 py-1.5 rounded text-xs font-sans font-medium transition-colors cursor-pointer ${
                isDanger
                  ? "bg-urgency/15 border border-urgency/45 text-urgency hover:bg-urgency/25"
                  : "erp-btn-primary"
              }`}
            >
              {confirmText}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
