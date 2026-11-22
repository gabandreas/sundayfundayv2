"use client";

import React, { useState } from "react";
import {
  WishlistItem,
  WishlistStatus,
  deleteWishlistItem,
  updateWishlistItem,
  trackWishlistAsSavingsGoal,
} from "@/lib/api";
import { formatRupiah, formatCurrencyInput, parseCurrencyInput } from "@/lib/utils";
import { ConvertToContractModal } from "./ConvertToContractModal";
import { Trash2, ArrowRightCircle, Target, Loader2, Pencil, Check, X, CheckCircle2 } from "lucide-react";

interface WishlistVaultTableProps {
  items: WishlistItem[];
  trueHourlyWageRp?: number;
  hoursPerWorkday?: number;
  onSelectItemForAnalysis?: (item: WishlistItem) => void;
}

export function WishlistVaultTable({
  items,
  trueHourlyWageRp,
  hoursPerWorkday = 10,
  onSelectItemForAnalysis,
}: WishlistVaultTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [contractModalItem, setContractModalItem] = useState<WishlistItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [trackingId, setTrackingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [editPriceStr, setEditPriceStr] = useState<string>("");
  const [editTargetMonth, setEditTargetMonth] = useState<string>("");
  const [editTargetYear, setEditTargetYear] = useState<string>("");
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [markingPurchasedId, setMarkingPurchasedId] = useState<number | null>(null);
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
      if (!res.success) {
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
      if (!res.success) {
        setErrorMessage(res.error || "Failed to delete wishlist item.");
      }
    } catch {
      setErrorMessage("Failed to delete wishlist item.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartEdit = (e: React.MouseEvent, item: WishlistItem) => {
    e.stopPropagation();
    setErrorMessage(null);
    setEditingId(item.id);
    setEditName(item.name);
    setEditPriceStr(formatCurrencyInput(String(item.price)));
    setEditTargetMonth(item.targetMonth ? String(item.targetMonth) : "");
    setEditTargetYear(item.targetYear ? String(item.targetYear) : "");
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleSaveEdit = async (e: React.MouseEvent, itemId: number) => {
    e.stopPropagation();
    const parsedPrice = parseCurrencyInput(editPriceStr);
    if (!editName.trim() || parsedPrice <= 0) {
      setErrorMessage("Item name and positive price are required.");
      return;
    }
    const parsedMonth = editTargetMonth ? parseInt(editTargetMonth, 10) : undefined;
    const parsedYear = editTargetYear ? parseInt(editTargetYear, 10) : undefined;
    if (parsedMonth && (parsedMonth < 1 || parsedMonth > 12)) {
      setErrorMessage("Target month must be between 1 and 12.");
      return;
    }

    setIsSavingEdit(true);
    setErrorMessage(null);
    try {
      const res = await updateWishlistItem(itemId, {
        name: editName.trim(),
        price: parsedPrice,
        ...(parsedMonth ? { targetMonth: parsedMonth } : {}),
        ...(parsedYear ? { targetYear: parsedYear } : {}),
      });
      if (res.success) {
        setEditingId(null);
      } else {
        setErrorMessage(res.error || "Failed to update wishlist item.");
      }
    } catch {
      setErrorMessage("Failed to update wishlist item.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleStatusChange = async (
    e: React.MouseEvent,
    item: WishlistItem,
    newStatus: WishlistStatus
  ) => {
    e.stopPropagation();
    if (item.status === newStatus || item.status === "PURCHASED") return;

    if (newStatus === "PURCHASED") {
      setMarkingPurchasedId(item.id);
    }
    setErrorMessage(null);
    try {
      const res = await updateWishlistItem(item.id, { status: newStatus });
      if (!res.success) {
        setErrorMessage(res.error || "Failed to update status.");
      }
    } catch {
      setErrorMessage("Failed to update status.");
    } finally {
      setMarkingPurchasedId(null);
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
          <div className="w-72 shrink-0 text-right pr-1">ACTIONS</div>
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
              const isEditing = editingId === item.id;

              const fundingCategory =
                item.fundingType === "INSTALLMENT"
                  ? `Installment (${item.tenor || 1}m)`
                  : "Cash";

              const isInstallmentPending =
                item.fundingType === "INSTALLMENT" && !isPurchased;

              if (isEditing) {
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 px-3 bg-surface-subtle/60 text-xs"
                  >
                    <div className="flex items-center gap-1.5 w-28 shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={12}
                        placeholder="MM"
                        value={editTargetMonth}
                        onChange={(e) => setEditTargetMonth(e.target.value)}
                        aria-label="Target Month"
                        className="w-11 px-1.5 py-1 rounded bg-surface border border-border-default font-mono text-[11px] text-text-primary tabular-nums focus:outline-none focus:border-accent"
                      />
                      <span className="text-text-tertiary font-mono">/</span>
                      <input
                        type="number"
                        min={2024}
                        max={2035}
                        placeholder="YYYY"
                        value={editTargetYear}
                        onChange={(e) => setEditTargetYear(e.target.value)}
                        aria-label="Target Year"
                        className="w-14 px-1.5 py-1 rounded bg-surface border border-border-default font-mono text-[11px] text-text-primary tabular-nums focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div className="flex-1 min-w-[160px] pr-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        aria-label="Wishlist item name"
                        className="w-full px-2 py-1 rounded bg-surface border border-border-default font-sans text-xs text-text-primary focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div className="w-36 shrink-0 pr-2">
                      <input
                        type="text"
                        value={editPriceStr}
                        onChange={(e) => setEditPriceStr(formatCurrencyInput(e.target.value))}
                        aria-label="Estimated price"
                        className="w-full px-2 py-1 rounded bg-surface border border-border-default font-mono text-xs text-right text-text-primary tabular-nums focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleSaveEdit(e, item.id)}
                        disabled={isSavingEdit}
                        className="px-2.5 py-1 rounded text-[11px] font-medium bg-delta-positive/15 text-delta-positive border border-delta-positive/30 hover:bg-delta-positive/25 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isSavingEdit ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        <span>Save</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-2 py-1 rounded text-[11px] font-medium text-text-secondary bg-surface border border-border-default hover:text-text-primary transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                );
              }

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
                      {trueHourlyWageRp && trueHourlyWageRp > 0 && (
                        <span className="inline-flex items-center whitespace-nowrap font-mono text-[10px] text-caution px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle">
                          {(item.price / trueHourlyWageRp).toFixed(1)}h ({((item.price / trueHourlyWageRp) / Math.max(1, hoursPerWorkday)).toFixed(1)}d)
                        </span>
                      )}
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
                  <div className="min-w-[110px] shrink-0 hidden md:flex items-center pr-2">
                    <span className="inline-flex items-center whitespace-nowrap font-sans text-[11px] font-medium text-text-secondary px-2 py-0.5 rounded bg-surface-subtle border border-border-subtle">
                      {fundingCategory === "UNASSIGNED"
                        ? "Unassigned"
                        : fundingCategory === "INSTALLMENT"
                          ? "Installment"
                          : fundingCategory}
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

                  {/* Col 6: Dedicated Actions Slot (w-72) */}
                  <div className="w-72 shrink-0 flex items-center justify-end gap-1.5 pr-1">
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
                        <ArrowRightCircle className="w-3.5 h-3.5" />
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

                    {/* Inline Edit button */}
                    {!isPurchased && (
                      <button
                        type="button"
                        onClick={(e) => handleStartEdit(e, item)}
                        title="Edit item name, price, or target date"
                        className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-active transition-colors cursor-pointer shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5" />
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

                    {/* Mark Purchased button */}
                    {!isPurchased && (
                      <button
                        type="button"
                        onClick={(e) => handleStatusChange(e, item, "PURCHASED")}
                        disabled={markingPurchasedId === item.id}
                        title="Mark item as Purchased"
                        className="p-1 rounded text-text-tertiary hover:text-delta-positive hover:bg-[rgba(16,183,141,0.10)] transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {markingPurchasedId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
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
