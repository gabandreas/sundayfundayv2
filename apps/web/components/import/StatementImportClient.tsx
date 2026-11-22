"use client";

import React, { useRef, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { usePeriod } from "@/context/PeriodContext";
import { PageHeader } from "@/components/primitives/PageHeader";
import { BulkStatementReconcilerPanel } from "@/components/finance/ModuleGoPanels";

const STATEMENT_PRESETS: Array<{ id: string; label: string; sample: string }> = [
  {
    id: "bank",
    label: "Bank / QRIS Mix",
    sample: [
      "2026-11-16, Daily Lunch & Coffee QRIS, Rp 48.000",
      "2026-11-18, Commuter Ride, Rp 28.500",
      "2026-11-20, Grocery Mini-Market, Rp 94.000",
    ].join("\n"),
  },
  {
    id: "paylater",
    label: "PayLater Cutoff Mix",
    sample: [
      "2026-11-14, Pharmacy Supplies PayLater, Rp 85.000",
      "2026-11-19, Wireless Charger PayLater, Rp 165.000",
      "2026-11-22, Cloud AI Plan Credit Card, Rp 149.000",
    ].join("\n"),
  },
];

export function StatementImportClient() {
  const { t } = useLanguage();
  const { month, year, refreshPeriod } = usePeriod();
  const [presetState, setPresetState] = useState<{ text?: string; version: number }>({
    version: 0,
  });
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadSample = (sample: string, label: string) => {
    setPresetState((prev) => ({ text: sample, version: prev.version + 1 }));
    setUploadNote(`Loaded preset: ${label}`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setPresetState((prev) => ({ text: text.trim(), version: prev.version + 1 }));
    setUploadNote(`Loaded file: ${file.name} (${file.size.toLocaleString("en-US")} bytes)`);
    e.target.value = "";
  };

  return (
    <div className="space-y-6 w-full max-w-full pb-20">
      <PageHeader
        title={t("nav.import")}
        subtitle="Parse CSV or bank, e-wallet, PayLater, and credit card statement rows into their exact paycycle cutoff before writing to your ledger."
        periodLabel={`${month}/${year}`}
        rightActions={
          <div className="flex flex-wrap items-center gap-2">
            {STATEMENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => loadSample(preset.sample, preset.label)}
                className="erp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{preset.label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="erp-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload CSV / TXT</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        }
      />

      {uploadNote && (
        <div className="px-3.5 py-2 rounded border border-border-subtle bg-surface-subtle/50 text-xs font-mono text-text-secondary">
          {uploadNote}
        </div>
      )}

      <BulkStatementReconcilerPanel
        externalText={presetState.text}
        externalVersion={presetState.version}
        onCommitted={() => {
          window.dispatchEvent(new Event("erp:data-mutated"));
          refreshPeriod();
        }}
      />
    </div>
  );
}
