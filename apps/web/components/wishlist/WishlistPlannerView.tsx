"use client";

import React, { useState } from "react";
import { WishlistAnalysisResult } from "@/lib/api";
import { WishlistPlannerForm } from "./WishlistPlannerForm";
import { WishlistAnalysisResults } from "./WishlistAnalysisResults";

interface WishlistPlannerViewProps {
  currentMonth: number;
  currentYear: number;
}

export function WishlistPlannerView({
  currentMonth,
  currentYear,
}: WishlistPlannerViewProps) {
  const [analysis, setAnalysis] = useState<WishlistAnalysisResult | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Purchase Parameters Form (5 cols) */}
      <div className="lg:col-span-5">
        <WishlistPlannerForm
          currentMonth={currentMonth}
          currentYear={currentYear}
          onAnalysisResult={setAnalysis}
          setIsLoadingAnalysis={setIsLoadingAnalysis}
          setAnalysisError={setAnalysisError}
        />
      </div>

      {/* Right Column: Simulation & Leverage Analysis Results (7 cols) */}
      <div className="lg:col-span-7">
        <WishlistAnalysisResults
          analysis={analysis}
          isLoading={isLoadingAnalysis}
          errorMessage={analysisError}
        />
      </div>
    </div>
  );
}
