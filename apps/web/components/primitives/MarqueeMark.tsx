import React from "react";

interface MarqueeMarkProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
}

/**
 * Bespoke geometric vector monogram for Marquee AI Co-Pilot.
 * Architectural ledger frame with precision double-chevron M & baseline pulse stroke.
 */
export function MarqueeMark({
  className = "w-4 h-4",
  size,
  strokeWidth = 1.65,
}: MarqueeMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3.25 5.25L5.25 3.25H14.75L16.75 5.25V14.75L14.75 16.75H5.25L3.25 14.75V5.25Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeOpacity="0.45"
      />
      <path
        d="M6.25 13.25V7.25L10 11L13.75 7.25V13.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.25 14.5H13.75"
        stroke="var(--color-accent, #10b78d)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}
