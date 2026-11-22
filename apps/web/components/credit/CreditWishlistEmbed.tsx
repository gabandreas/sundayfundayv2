"use client";

import React, { useEffect, useState } from "react";
import {
  MonthlySnapshot,
  WishlistItem,
  fetchSnapshot,
  fetchWishlistItems,
  getCached,
} from "@/lib/api";
import { WishlistStudio } from "@/components/wishlist/WishlistStudio";

interface CreditWishlistEmbedProps {
  month: number;
  year: number;
}

export function CreditWishlistEmbed({ month, year }: CreditWishlistEmbedProps) {
  const [items, setItems] = useState<WishlistItem[] | null>(() => {
    return getCached<WishlistItem[]>("wishlistItems") ?? null;
  });
  const [forwardSnapshots, setForwardSnapshots] = useState<MonthlySnapshot[]>([]);
  const [loading, setLoading] = useState<boolean>(items === null);

  useEffect(() => {
    let active = true;
    const next1M = month === 12 ? 1 : month + 1;
    const next1Y = month === 12 ? year + 1 : year;
    const next2M = next1M === 12 ? 1 : next1M + 1;
    const next2Y = next1M === 12 ? next1Y + 1 : next1Y;

    Promise.all([
      fetchWishlistItems(),
      fetchSnapshot(month, year),
      fetchSnapshot(next1M, next1Y),
      fetchSnapshot(next2M, next2Y),
    ])
      .then(([wishlistRows, snap0, snap1, snap2]) => {
        if (!active) return;
        setItems(Array.isArray(wishlistRows) ? wishlistRows : []);
        setForwardSnapshots(
          [snap0, snap1, snap2].filter(
            (s): s is MonthlySnapshot => s !== null && s !== undefined,
          ),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [month, year]);

  if (loading && !items) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-xs text-text-tertiary">
        Loading purchase &amp; installment wishlist planner...
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2 border-t border-border">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">
          Planned Purchase &amp; Wishlist Affordability Vault
        </h3>
        <p className="text-xs text-text-tertiary mt-0.5">
          Compare cash purchases vs multi-month installments against forward net cashflow and work-hour cost.
        </p>
      </div>
      <WishlistStudio
        month={month}
        year={year}
        initialTab="planner"
        items={items ?? []}
        forwardSnapshots={forwardSnapshots}
      />
    </div>
  );
}
