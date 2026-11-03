"use client";

import React, { useState } from "react";
import { KillSwitchResponse, KillSwitchItem, updateKillSwitch } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface SubscriptionKillSwitchBannerProps {
  initialData: KillSwitchResponse | null;
}

export function SubscriptionKillSwitchBanner({
  initialData,
}: SubscriptionKillSwitchBannerProps) {
  const [data, setData] = useState<KillSwitchResponse | null>(initialData);
  const [processingId, setProcessingId] = useState<number | null>(null);

  if (!data || !data.config?.killSwitchBannerEnabled) {
    return null;
  }

  const actionRequiredItems = data.items.filter(
    (item) => item.alertState === "ACTION_REQUIRED"
  );

  if (actionRequiredItems.length === 0) {
    return null;
  }

  const handleConfirmCancel = async (item: KillSwitchItem) => {
    setProcessingId(item.id);
    const res = await updateKillSwitch(item.id, {
      providerCancelConfirmed: true,
      autoStopAfterPromo: true,
    });
    setProcessingId(null);

    if (res.success) {
      // Disarm banner immediately in local state
      setData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  providerCancelConfirmed: true,
                  alertState: "CONFIRMED_SAFE",
                  statusLabel: "SAFE",
                }
              : i
          ),
        };
      });
    }
  };

  return (
    <div className="space-y-3">
      {actionRequiredItems.map((item) => {
        const daysLeft = item.daysUntilExpiry;
        const isProcessing = processingId === item.id;
        const postPromoAmount = item.postPromoNormalAmount || 0;

        return (
          <div
            key={item.id}
            className="rounded-lg border border-[rgba(224,108,117,0.35)] bg-[rgba(224,108,117,0.06)] p-4 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[rgba(224,108,117,0.2)] text-[#e06c75] border border-[rgba(224,108,117,0.35)]">
                    Kill-Switch Alert
                  </span>
                  <span className="text-xs font-semibold font-sans text-text-primary">
                    {item.label}
                    {item.promoLabel ? ` (${item.promoLabel})` : ""}
                  </span>
                  <span className="text-[11px] font-mono text-[#e06c75] font-semibold">
                    {daysLeft !== null
                      ? daysLeft < 0
                        ? `${Math.abs(daysLeft)}d overdue`
                        : daysLeft === 0
                        ? "Expires Today"
                        : `${daysLeft} days until auto-renewal`
                      : ""}
                  </span>
                </div>

                <div className="text-xs font-sans text-text-secondary">
                  Action required: Cancel before{" "}
                  <span className="font-mono text-text-primary font-medium">
                    {item.promoEndDate ? item.promoEndDate.split("T")[0] : "deadline"}
                  </span>{" "}
                  to avoid a{" "}
                  <span className="font-mono text-[#e06c75] font-semibold">
                    {formatRupiah(postPromoAmount)}/mo
                  </span>{" "}
                  normal recurring charge
                  {item.monthlyPenaltyDelta > 0 && (
                    <>
                      {" "}
                      (+<span className="font-mono font-semibold">{formatRupiah(item.monthlyPenaltyDelta)}/mo</span> price jump)
                    </>
                  )}
                  .
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {item.providerCancelUrl && (
                  <a
                    href={item.providerCancelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded text-xs font-medium bg-[#1a1f2c] text-text-primary hover:bg-[#282e3d] border border-[#282e3d] transition-colors"
                  >
                    Open Provider Settings ↗
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => handleConfirmCancel(item)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-[#e06c75] hover:bg-[#cf5c65] text-white transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isProcessing ? "Disarming..." : "I Have Canceled It (Disarm)"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
