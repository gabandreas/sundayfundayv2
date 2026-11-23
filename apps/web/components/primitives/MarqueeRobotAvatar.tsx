"use client";

import React from "react";

export type MarqueeRobotState = "idle" | "thinking" | "analyzing" | "confirmed";

interface MarqueeRobotAvatarProps {
  state?: MarqueeRobotState;
  size?: number;
  className?: string;
}

/**
 * Custom geometric mecha co-pilot vector emblem for Marquee.
 * Built intentionally for Sunday Funday ERP's dark-slate aesthetic:
 * animated antenna radar pulse, horizontal scanning visor beam on active
 * thinking/analyzing states, and articulated optical iris alignment.
 */
export function MarqueeRobotAvatar({
  state = "idle",
  size = 24,
  className = "",
}: MarqueeRobotAvatarProps) {
  const isBusy = state === "thinking" || state === "analyzing";
  const eyeColor =
    state === "analyzing"
      ? "#e59b2c"
      : state === "thinking"
        ? "#38bdf8"
        : "#10b78d";

  return (
    <span
      data-marquee-state={state}
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        {/* Antenna stem & signal beacon */}
        <line
          x1="16"
          y1="7"
          x2="16"
          y2="3"
          stroke={isBusy ? eyeColor : "#6b7280"}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle
          cx="16"
          cy="2.5"
          r="1.8"
          fill={isBusy ? eyeColor : "#10b78d"}
          className={isBusy ? "marquee-antenna-pulse" : ""}
        />

        {/* Chamfered chassis head */}
        <path
          d="M7 9.5L9.5 7H22.5L25 9.5V22.5L22.5 25H9.5L7 22.5V9.5Z"
          fill="#11141c"
          stroke={isBusy ? eyeColor : "#384054"}
          strokeWidth="1.4"
        />

        {/* Side ear actuator plates */}
        <rect x="4.5" y="12.5" width="2" height="7" rx="0.8" fill="#282e3d" />
        <rect x="25.5" y="12.5" width="2" height="7" rx="0.8" fill="#282e3d" />

        {/* Optical visor aperture */}
        <rect
          x="9.5"
          y="11"
          width="13"
          height="6.5"
          rx="1.5"
          fill="#0c0e14"
          stroke="#282e3d"
          strokeWidth="1"
        />

        {/* Scanning beam when thinking/analyzing */}
        {isBusy && (
          <rect
            x="10.2"
            y="12"
            width="3.2"
            height="4.5"
            rx="0.7"
            fill={eyeColor}
            fillOpacity="0.45"
            className="marquee-visor-scan"
          />
        )}

        {/* Dual optical eyes */}
        <rect
          x="11.5"
          y="13"
          width="2.6"
          height="2.5"
          rx="0.6"
          fill={eyeColor}
          className={state === "idle" ? "marquee-eye-blink" : ""}
        />
        <rect
          x="17.9"
          y="13"
          width="2.6"
          height="2.5"
          rx="0.6"
          fill={eyeColor}
          className={state === "idle" ? "marquee-eye-blink" : ""}
        />

        {/* Lower telemetry equalizer mouth */}
        <rect
          x="11.5"
          y="20.2"
          width="2.2"
          height="1.8"
          rx="0.5"
          fill={isBusy ? eyeColor : "#4b5563"}
          className={isBusy ? "marquee-eq-bar-1" : ""}
        />
        <rect
          x="14.9"
          y="20.2"
          width="2.2"
          height="1.8"
          rx="0.5"
          fill={isBusy ? eyeColor : "#6b7280"}
          className={isBusy ? "marquee-eq-bar-2" : ""}
        />
        <rect
          x="18.3"
          y="20.2"
          width="2.2"
          height="1.8"
          rx="0.5"
          fill={isBusy ? eyeColor : "#4b5563"}
          className={isBusy ? "marquee-eq-bar-3" : ""}
        />
      </svg>
    </span>
  );
}
