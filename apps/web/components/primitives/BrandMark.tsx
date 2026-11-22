import React from "react";

interface BrandMarkProps {
  size?: number;
  className?: string;
  monochrome?: boolean;
}

/**
 * Minimalist geometric identity mark representing Sunday Funday ERP's
 * 3-tier waterfall capital discipline (Obligations -> Living Baseline -> Vault).
 */
export function BrandMark({
  size = 22,
  className = "",
  monochrome = false,
}: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Precision architectural outer frame */}
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="4.5"
        fill={monochrome ? "none" : "#11141c"}
        stroke={monochrome ? "currentColor" : "#282e3d"}
        strokeWidth="1.25"
      />
      {/* Upper Datum Plane (Capital Inflow) */}
      <polygon
        points="6,6.5 18,6.5 15.5,9.5 6,9.5"
        fill={monochrome ? "currentColor" : "#f3f4f6"}
      />
      {/* Center Waterfall Step (Active Allocation Pivot) */}
      <polygon
        points="8.5,10.75 18,10.75 15.5,13.75 6,13.75"
        fill={monochrome ? "currentColor" : "#10b78d"}
      />
      {/* Lower Settlement Anchor (Reserves / Zero-Drift Ledger) */}
      <polygon
        points="6,15 15.5,15 13,18 6,18"
        fill={monochrome ? "currentColor" : "#9ca3af"}
      />
    </svg>
  );
}
