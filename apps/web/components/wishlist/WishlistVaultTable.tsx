"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  WishlistItem,
  WishlistStatus,
  deleteWishlistItem,
  updateWishlistItem,
  trackWishlistAsSavingsGoal,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { ConvertToContractModal } from "./ConvertToContractModal";
import { Trash2, ArrowRightCircle, Sparkles, Target, Loader2 } from "lucide-react";

interface WishlistVaultTableProps {
  items: WishlistItem[];
  onSelectItemForAnalysis?: (item: WishlistItem) => void;
}

export function WishlistVaultTable({
  items,
  onSelectItemForAnalysis,
}: WishlistVaultTableProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [contractModalItem, setContractModalItem] = useState<WishlistItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [trackingId, setTrackingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    if (statusFilter === "ALL") return true;
    return item.status === statusFilter;
  });

  const handleTrackAsSavingsGoal = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setTrackingId(id);
    setErrorMessage(null);
    try {
      const res = await trackWishlistAsSavingsGoal(id);
      if (res.success) {
        startTransition(() => {
          router.refresh();
        });
      } else {
        setErrorMessage(res.error || "Failed to link item to savings goals.");
      }
    } catch {
      setErrorMessage("Failed to link item to savings goals.");
    } finally {
      setTrackingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number, name: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${name}" from your wishlist?`)) {
      return;
    }

    setDeletingId(id);
    setErrorMessage(null);

    try {
      const res = await deleteWishlistItem(id);
      if (res.success) {
        startTransition(() => {
          router.refresh();
        });
      } else {
        setErrorMessage(res.error || "Failed to delete wishlist item.");
      }
    } catch {
      setErrorMessage("Failed to delete wishlist item.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusChange = async (
    e: React.MouseEvent,
    item: WishlistItem,
    newStatus: WishlistStatus
  ) => {
    e.stopPropagation();
    if (item.status === newStatus || item.status === "PURCHASED") return;

    try {
      const res = await updateWishlistItem(item.id, { status: newStatus });
      if (res.success) {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      setErrorMessage("Failed to update status.");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      {/* Header & Status Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border-subtle">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary tracking-tight">
            Wishlist Vault
          </h3>
          <p className="text-xs font-sans text-text-tertiary mt-0.5">
            Catalogued capital targets, savings goals, and planned financing items.
          </p>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 p-0.5 rounded bg-surface-subtle border border-border-subtle text-xs font-sans">
          {[
            { id: "ALL", label: "All Items", count: items.length },
            {
              id: "PLANNING",
              label: "Planning",
              count: items.filter((i) => i.status === "PLANNING").length,
            },
            {
              id: "READY",
              label: "Ready",
              count: items.filter((i) => i.status === "READY").length,
            },
            {
              id: "PURCHASED",
              label: "Purchased",
              count: items.filter((i) => i.status === "PURCHASED").length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-surface-active text-text-primary font-medium shadow-sm"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              <span>{tab.label}</span>
              <span className="font-mono text-[10px] text-text-tertiary">
                ({tab.count})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-2.5 rounded bg-[rgba(255,56,56,0.08)] border border-[rgba(255,56,56,0.25)] text-xs text-delta-negative">
          {errorMessage}
        </div>
      )}

      {/* Table */}
      <div className="border border-border-subtle rounded-md overflow-hidden">
        {/* Custom Header with Dedicated Action Column */}
        <div className="flex items-center justify-between py-2 px-3 border-b border-border text-[10px] font-mono tracking-wider font-semibold text-text-tertiary bg-surface-subtle/50 uppercase">
          <div className="w-24 shrink-0">TARGET</div>
          <div className="flex-1 pr-4">ITEM / DETAILS</div>
          <div className="w-28 shrink-0 hidden md:block">FUNDING</div>
          <div className="w-24 shrink-0 text-center">STATUS</div>
          <div className="w-36 shrink-0 text-right pr-4">EST. PRICE</div>
          <div className="w-64 shrink-0 text-right pr-1">ACTIONS</div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="py-12 text-center text-xs font-sans text-text-tertiary">
            No wishlist items found under this filter.
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {filteredItems.map((item) => {
              const targetDate =
                item.targetMonth && item.targetYear
                  ? `${String(item.targetMonth).padStart(2, "0")}/${item.targetYear}`
                  : "Flexible";

              const isReady = item.status === "READY";
              const isPurchased = item.status === "PURCHASED";

              const fundingCategory =
                item.fundingType === "INSTALLMENT"
                  ? `Installment (${item.tenor || 1}m)`
                  : "Cash";

              const isInstallmentPending =
                item.fundingType === "INSTALLMENT" && !isPurchased;

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2.5 px-3 hover:bg-surface-hover/40 transition-colors text-xs"
                >
                  {/* Col 1: Target Date */}
                  <div className="w-24 shrink-0 font-mono text-text-tertiary text-[11px] tabular-nums">
                    {targetDate}
                  </div>

                  {/* Col 2: Title & Details */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text-primary truncate">
                        {item.name}
                      </span>
                    </div>
                    {(item.provider || item.notes) && (
                      <div className="text-[11px] text-text-tertiary truncate mt-0.5">
                        {item.provider ? `${item.provider}` : ""}
                        {item.provider && item.notes ? " · " : ""}
                        {item.notes || ""}
                      </div>
                    )}
                  </div>

                  {/* Col 3: Funding Type */}
                  <div className="w-28 shrink-0 hidden md:block">
                    <span className="font-mono text-[10px] uppercase text-text-tertiary px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle">
                      {fundingCategory}
                    </span>
                  </div>

                  {/* Col 4: Status Badge */}
                  <div className="w-24 shrink-0 flex justify-center">
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-medium ${
                        isReady
                          ? "bg-[rgba(16,183,141,0.10)] text-delta-positive border-[rgba(16,183,141,0.25)]"
                          : isPurchased
                          ? "bg-surface-active/60 text-text-secondary border-border-subtle"
                          : "bg-surface-active/40 text-text-tertiary border-border-subtle"
                      }`}
                    >
                      {isReady ? "Ready" : isPurchased ? "Purchased" : "Planning"}
                    </span>
                  </div>

                  {/* Col 5: Price */}
                  <div className="w-36 shrink-0 text-right pr-4 font-mono text-[13px] tabular-nums font-semibold text-text-primary">
                    {formatRupiah(item.price)}
                  </div>

                  {/* Col 6: Dedicated Actions Slot (w-64) */}
                  <div className="w-64 shrink-0 flex items-center justify-end gap-1.5 pr-1">
                    {/* Track as Savings Goal (CASH and not PURCHASED) */}
                    {item.fundingType === "CASH" && !isPurchased && (
                      item.savingsGoalId ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-delta-positive bg-[rgba(16,183,141,0.10)] border border-[rgba(16,183,141,0.25)] shrink-0">
                          In Savings
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleTrackAsSavingsGoal(e, item.id)}
                          disabled={trackingId === item.id}
                          title="Track as target goal in /savings"
                          className="px-2 py-0.5 rounded text-[10px] font-sans font-medium text-text-primary bg-surface-subtle border border-border hover:border-border-strong hover:bg-surface-active transition-colors flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          {trackingId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-text-tertiary" />
                          ) : (
                            <Target className="w-3 h-3 text-text-tertiary" />
                          )}
                          <span>Track in Savings</span>
                        </button>
                      )
                    )}

                    {/* Simulate / Analyze button */}
                    {onSelectItemForAnalysis && (
                      <button
                        type="button"
                        onClick={() => onSelectItemForAnalysis(item)}
                        title="Load into Simulator"
                        className="p-1 rounded text-text-tertiary hover:text-accent hover:bg-surface-active transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Convert to Contract Button (INSTALLMENT and not PURCHASED) */}
                    {isInstallmentPending && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContractModalItem(item);
                        }}
                        title="Convert to Active Credit Contract"
                        className="px-2 py-0.5 rounded text-[10px] font-sans font-medium text-caution bg-[rgba(229,155,44,0.10)] border border-[rgba(229,155,44,0.30)] hover:bg-[rgba(229,155,44,0.20)] transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <ArrowRightCircle className="w-3 h-3" />
                        <span>Convert</span>
                      </button>
                    )}

                    {/* Status Toggle (Planning <-> Ready) */}
                    {!isPurchased && (
                      <button
                        type="button"
                        onClick={(e) =>
                          handleStatusChange(
                            e,
                            item,
                            item.status === "PLANNING" ? "READY" : "PLANNING"
                          )
                        }
                        title={
                          item.status === "PLANNING"
                            ? "Mark as Ready"
                            : "Mark as Planning"
                        }
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono text-text-tertiary hover:text-text-secondary hover:bg-surface-subtle transition-colors cursor-pointer shrink-0"
                      >
                        {item.status === "PLANNING" ? "Set Ready" : "Set Plan"}
                      </button>
                    )}

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, item.id, item.name)}
                      disabled={deletingId === item.id}
                      title="Delete wishlist item"
                      className="p-1 rounded text-text-tertiary hover:text-delta-negative hover:bg-[rgba(255,56,56,0.1)] transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Convert to Contract Modal */}
      <ConvertToContractModal
        isOpen={contractModalItem !== null}
        onClose={() => setContractModalItem(null)}
        item={contractModalItem}
      />
    </div>
  );
}
