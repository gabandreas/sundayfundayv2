"use client";

import React, { useState } from "react";
import { formatRupiah } from "@/lib/utils";

export interface AllocationSlice {
  id: string;
  label: string;
  amount: number;
  color: string;
  priority: string;
}

interface AllocationsDonutChartProps {
  totalIncome: number;
  slices: AllocationSlice[];
  bufferPocket?: number;
}

export function AllocationsDonutChart({
  totalIncome,
  slices,
  bufferPocket = 0,
}: AllocationsDonutChartProps) {
  const [hoveredSlice, setHoveredSlice] = useState<AllocationSlice | null>(null);

  const validTotal = totalIncome > 0 ? totalIncome : 1;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  // Filter out zero-amount slices for the SVG rendering
  const activeSlices = slices.filter((s) => s.amount > 0);

  let accumulatedPercent = 0;

  return (
    <div className="bg-surface border border-border-subtle rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-8">
      {/* SVG Donut Visual */}
      <div className="relative flex items-center justify-center shrink-0">
        <svg
          width="220"
          height="220"
          viewBox="0 0 200 200"
          className="transform -rotate-90"
        >
          {/* Background track circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#1c202b"
            strokeWidth="20"
          />

          {/* Slices */}
          {activeSlices.map((slice) => {
            const slicePercent = slice.amount / validTotal;
            const strokeDasharray = `${slicePercent * circumference} ${circumference}`;
            const strokeDashoffset = -(accumulatedPercent * circumference);
            accumulatedPercent += slicePercent;

            const isHovered = hoveredSlice?.id === slice.id;

            return (
              <circle
                key={slice.id}
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={isHovered ? 24 : 20}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="butt"
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredSlice(slice)}
                onMouseLeave={() => setHoveredSlice(null)}
              />
            );
          })}
        </svg>

        {/* Centerpiece Text Inside Donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
          <span className="text-[10px] font-sans font-medium text-text-tertiary uppercase tracking-wider">
            {hoveredSlice ? hoveredSlice.label : "Total Allocated"}
          </span>
          <span className="font-display text-lg font-normal text-text-primary tracking-tight mt-0.5">
            {hoveredSlice ? formatRupiah(hoveredSlice.amount) : formatRupiah(totalIncome)}
          </span>
          <span className="text-[10px] font-mono text-text-tertiary mt-0.5">
            {hoveredSlice
              ? `${((hoveredSlice.amount / validTotal) * 100).toFixed(1)}% of total`
              : "100% Accounted"}
          </span>
        </div>
      </div>

      {/* Slices Legend Table alongside the Donut */}
      <div className="flex-1 w-full space-y-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-border-subtle text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
          <span>Priority & Pocket</span>
          <div className="flex items-center gap-6">
            <span>Share</span>
            <span className="w-28 text-right">Amount</span>
          </div>
        </div>

        {slices.map((slice) => {
          const percent = totalIncome > 0 ? (slice.amount / totalIncome) * 100 : 0;
          const isHovered = hoveredSlice?.id === slice.id;

          return (
            <div
              key={slice.id}
              onMouseEnter={() => setHoveredSlice(slice)}
              onMouseLeave={() => setHoveredSlice(null)}
              className={`flex items-center justify-between py-1.5 px-2 rounded cursor-pointer transition-colors text-xs font-sans ${
                isHovered ? "bg-surface-subtle" : "hover:bg-surface-subtle/50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <div>
                  <span className="font-medium text-text-primary block">
                    {slice.label}
                  </span>
                  <span className="text-[10px] text-text-tertiary block">
                    {slice.priority}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <span className="text-xs font-mono text-text-secondary tabular-nums">
                  {percent.toFixed(1)}%
                </span>
                <span className="w-28 text-right font-mono font-medium text-text-primary tabular-nums">
                  {formatRupiah(slice.amount)}
                </span>
              </div>
            </div>
          );
        })}

        {/* Emergency buffer status line alongside (mirroring V1) */}
        <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-xs font-sans text-text-tertiary">
          <span>Emergency Buffer Pocket:</span>
          <span className="font-mono text-text-secondary">
            {formatRupiah(bufferPocket)}
          </span>
        </div>
      </div>
    </div>
  );
}
