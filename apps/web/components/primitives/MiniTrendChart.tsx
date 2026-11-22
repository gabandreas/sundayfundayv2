import React from "react";

export interface MiniTrendChartProps {
  daysInCycle?: number;
  currentDay?: number;
  dailySpend?: number[];
  targetDailyBudget?: number;
  statusVariant?: "default" | "caution" | "urgency";
  cycleTemporalState?: "PRE_PAYDAY" | "ACTIVE" | "COMPLETED";
  daysUntilCycleStart?: number;
}

export function MiniTrendChart({
  daysInCycle = 30,
  currentDay = 11,
  dailySpend,
  targetDailyBudget = 150000,
  statusVariant = "default",
  cycleTemporalState = "ACTIVE",
  daysUntilCycleStart = 0,
}: MiniTrendChartProps) {
  const safeDays = Math.max(daysInCycle || 30, 1);
  const isPrePayday = cycleTemporalState === "PRE_PAYDAY";
  const isCompleted = cycleTemporalState === "COMPLETED";
  const safeCurrentDay = isPrePayday
    ? 0
    : Math.min(Math.max(currentDay ?? 1, 0), safeDays);

  // Generate realistic spending pattern if none provided (0 spending when pre-payday)
  const data =
    dailySpend ||
    Array.from({ length: safeDays }, (_, i) => {
      const day = i + 1;
      if (isPrePayday || day > safeCurrentDay) return 0;
      const variance = [0.6, 1.1, 0.4, 1.4, 0.9, 0.8, 1.6, 0.5, 1.0, 1.3, 0.7][
        (day - 1) % 11
      ];
      return Math.round(targetDailyBudget * variance);
    });

  const maxSpend = Math.max(...data, targetDailyBudget * 1.5, 1);
  const chartHeight = 36;
  const chartWidth = 240;
  const barWidth = Math.max(chartWidth / safeDays - 1.5, 1);

  const getBarColor = (spend: number, day: number) => {
    if (isPrePayday || day > safeCurrentDay) return "fill-border-subtle/40";
    if (!isCompleted && day === safeCurrentDay) {
      if (statusVariant === "urgency") return "fill-urgency";
      if (statusVariant === "caution") return "fill-caution";
      return "fill-delta-positive";
    }
    if (spend > targetDailyBudget * 1.25) return "fill-caution/80";
    return "fill-border-strong";
  };

  const todayX = !isPrePayday && safeCurrentDay > 0
    ? (safeCurrentDay - 1) * (chartWidth / safeDays) + barWidth / 2
    : NaN;
  const isTodayValid = !isNaN(todayX) && isFinite(todayX);

  const centerCaption = isPrePayday
    ? `DAY 0 OF ${safeDays} · PRE-PAYDAY PLAN${
        daysUntilCycleStart > 0 ? ` (STARTS IN ${daysUntilCycleStart}D)` : ""
      }`
    : isCompleted
      ? `CYCLE COMPLETED (${safeDays} OF ${safeDays})`
      : `TODAY (DAY ${Math.max(1, safeCurrentDay)} OF ${safeDays})`;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[10px] font-mono text-text-tertiary mb-1.5">
        <span>DAY 1</span>
        <span className="text-text-secondary font-medium">{centerCaption}</span>
        <span>DAY {safeDays}</span>
      </div>

      <div className="relative w-full h-9">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          {/* Target baseline indicator */}
          <line
            x1="0"
            y1={chartHeight - (targetDailyBudget / maxSpend) * chartHeight}
            x2={chartWidth}
            y2={chartHeight - (targetDailyBudget / maxSpend) * chartHeight}
            stroke="var(--color-border-strong)"
            strokeWidth="0.75"
            strokeDasharray="2 2"
          />

          {/* Daily spending bars */}
          {data.map((spend, index) => {
            const day = index + 1;
            const height = spend > 0 ? (spend / maxSpend) * (chartHeight - 4) : 2;
            const x = index * (chartWidth / safeDays);
            const y = chartHeight - height;

            return (
              <rect
                key={day}
                x={x}
                y={y}
                width={Math.max(barWidth, 1)}
                height={Math.max(height, 2)}
                rx={0.5}
                className={`transition-colors ${getBarColor(spend, day)}`}
              />
            );
          })}

          {/* Single dashed vertical marker for "today" / "now" */}
          {isTodayValid && (
            <line
              x1={todayX}
              y1="0"
              x2={todayX}
              y2={chartHeight}
              stroke={
                statusVariant === "urgency"
                  ? "var(--color-urgency)"
                  : statusVariant === "caution"
                  ? "var(--color-caution)"
                  : "var(--color-delta-positive)"
              }
              strokeWidth="1.2"
              strokeDasharray="2 2"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
