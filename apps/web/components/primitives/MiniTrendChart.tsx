import React from "react";

export interface MiniTrendChartProps {
  daysInCycle?: number;
  currentDay?: number;
  dailySpend?: number[];
  targetDailyBudget?: number;
  statusVariant?: "default" | "caution" | "urgency";
}

export function MiniTrendChart({
  daysInCycle = 30,
  currentDay = 11,
  dailySpend,
  targetDailyBudget = 150000,
  statusVariant = "default",
}: MiniTrendChartProps) {
  // Defensive normalization so 0 or NaN or negative values never propagate to layout/coordinates
  const safeDays = Math.max(daysInCycle || 30, 1);
  const safeCurrentDay = Math.min(Math.max(currentDay || 1, 1), safeDays);

  // Generate realistic spending pattern if none provided
  const data =
    dailySpend ||
    Array.from({ length: safeDays }, (_, i) => {
      const day = i + 1;
      if (day > safeCurrentDay) return 0;
      // Realistic variance around target
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
    if (day > safeCurrentDay) return "fill-border-subtle/40";
    if (day === safeCurrentDay) {
      if (statusVariant === "urgency") return "fill-urgency";
      if (statusVariant === "caution") return "fill-caution";
      return "fill-delta-positive";
    }
    if (spend > targetDailyBudget * 1.25) return "fill-caution/80";
    return "fill-border-strong";
  };

  const todayX = (safeCurrentDay - 1) * (chartWidth / safeDays) + barWidth / 2;
  const isTodayValid = !isNaN(todayX) && isFinite(todayX);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[10px] font-mono text-text-tertiary mb-1.5">
        <span>DAY 1</span>
        <span className="text-text-secondary font-medium">TODAY (DAY {safeCurrentDay})</span>
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
