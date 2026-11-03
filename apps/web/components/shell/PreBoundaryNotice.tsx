import React from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

interface PreBoundaryNoticeProps {
  month: number;
  year: number;
}

export function PreBoundaryNotice({ month, year }: PreBoundaryNoticeProps) {
  return (
    <div className="max-w-xl mx-auto py-16 text-center space-y-4">
      <div className="rounded-lg border border-border bg-surface p-8 space-y-4">
        <div className="flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-caution" strokeWidth={1.8} />
        </div>
        <h2 className="text-base font-semibold font-sans text-text-primary">
          Pre-Tracking Boundary ({month}/{year})
        </h2>
        <p className="text-xs font-sans text-text-secondary leading-relaxed">
          Financial tracking begins in <strong className="text-text-primary">July 2026</strong>. Historical periods prior to July 2026 are before the tracking start date.
        </p>
        <div className="pt-2">
          <Link
            href="/?month=7&year=2026"
            className="inline-flex items-center px-4 py-2 rounded text-xs font-sans font-medium bg-text-primary text-surface hover:opacity-90 transition-opacity"
          >
            Go to Initial Period (July 2026)
          </Link>
        </div>
      </div>
    </div>
  );
}
