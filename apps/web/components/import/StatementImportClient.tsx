"use client";

import React, { useRef, useState } from "react";
import { Upload, FileText, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { usePeriod } from "@/context/PeriodContext";
import { PageHeader } from "@/components/primitives/PageHeader";
import { BulkStatementReconcilerPanel } from "@/components/finance/ModuleGoPanels";
import { useToast } from "@/context/ToastContext";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const STATEMENT_PRESETS: Array<{
  id: string;
  label: string;
  defaultMethod: "CASH" | "PAYLATER" | "CREDIT_CARD";
  sample: string;
}> = [
  {
    id: "klikbca",
    label: "KlikBCA CSV",
    defaultMethod: "CASH",
    sample: [
      'No. Rekening,"1234567890"',
      'Periode,"01/11/2026 - 30/11/2026"',
      "Tanggal Transaksi,Keterangan,Cabang,Jumlah,Saldo",
      '\'18/11,"TRSF E-BANKING DB\n18/11 QRIS KOPI KENANGAN",0000,"48,000.00 DB","1,250,000.00"',
      '\'19/11,"BYR E-BANKING DB 19/11 TOKEN PLN LISTRIK",0000,"102.500,00 DB","1,147,500.00"',
      '\'25/11,"TRSF E-BANKING CR 25/11 GAJI BULANAN",0000,"5,543,500.00 CR","6,691,000.00"',
      'Saldo Akhir,"6,691,000.00"',
    ].join("\n"),
  },
  {
    id: "mybca_permata",
    label: "myBCA / Permata Paste",
    defaultMethod: "CASH",
    sample: [
      "16/11/2026\tQRIS WARUNG NASI\t35.000 DB",
      "18/11/2026\tCOMMUTER LINE QRIS\t12.000 DB",
      "25/11/2026\tPAYROLL CREDIT INFLOW\t5.543.500 CR",
    ].join("\n"),
  },
  {
    id: "paylater",
    label: "PayLater & Credit Card",
    defaultMethod: "PAYLATER",
    sample: [
      "2026-11-14, Pharmacy Supplies PayLater, Rp 85.000",
      "2026-11-19, Wireless Charger PayLater, Rp 165.000",
      "2026-11-22, Cloud AI Plan Permata Credit Card, Rp 149.000",
    ].join("\n"),
  },
];

export function StatementImportClient() {
  const { t } = useLanguage();
  const { month, year, refreshPeriod } = usePeriod();
  const { toast } = useToast();
  const [presetState, setPresetState] = useState<{
    text?: string;
    defaultMethod?: "CASH" | "PAYLATER" | "CREDIT_CARD";
    version: number;
  }>({
    version: 0,
  });
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadSample = (
    sample: string,
    label: string,
    defaultMethod: "CASH" | "PAYLATER" | "CREDIT_CARD",
  ) => {
    setPresetState((prev) => ({
      text: sample,
      defaultMethod,
      version: prev.version + 1,
    }));
    setUploadNote(`Loaded template: ${label}`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".txt")) {
      toast({
        title: "Unsupported File Format",
        description: "Upload an exported .csv or .txt statement file.",
        variant: "error",
      });
      e.target.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({
        title: "File Too Large",
        description: "Statement files are capped at 2 MB for safe local parsing.",
        variant: "error",
      });
      e.target.value = "";
      return;
    }

    const text = await file.text();
    const isKlikBca = /tanggal transaksi/i.test(text) || /mutasi\s+(?:debet|kredit)/i.test(text);
    setPresetState((prev) => ({
      text: text.trim(),
      defaultMethod: isKlikBca ? "CASH" : prev.defaultMethod,
      version: prev.version + 1,
    }));
    setUploadNote(
      `Loaded file: ${file.name} (${file.size.toLocaleString("en-US")} bytes). Maximum 500 transaction rows per batch.`,
    );
    e.target.value = "";
  };

  return (
    <div className="space-y-6 w-full max-w-full pb-20">
      <PageHeader
        title={t("nav.import")}
        subtitle="Import KlikBCA CSV exports or copied myBCA, Permata, PayLater, and Credit Card statements safely without linking banking credentials."
        periodLabel={`${month}/${year}`}
        rightActions={
          <div className="flex flex-wrap items-center gap-2">
            {STATEMENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => loadSample(preset.sample, preset.label, preset.defaultMethod)}
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

      <div className="rounded-lg border border-border-subtle bg-surface p-4 flex flex-wrap items-start justify-between gap-4 text-xs">
        <div className="flex items-start gap-2.5 max-w-3xl">
          <ShieldCheck className="w-4 h-4 text-delta-positive shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-text-primary">
              Offline Export Workflow (No Bank Login Required)
            </div>
            <p className="text-text-tertiary leading-relaxed">
              Export from KlikBCA via <span className="font-mono text-text-secondary">Informasi Rekening -&gt; Mutasi Rekening -&gt; Download CSV</span>, or copy/paste rows from myBCA &amp; PermataMobile X. Credit inflows (<span className="font-mono text-text-secondary">CR</span>), running balance columns (<span className="font-mono text-text-secondary">Saldo</span>), and 10 to 16 digit account numbers are filtered or masked automatically.
            </p>
          </div>
        </div>
        <span className="font-mono text-[11px] text-text-tertiary whitespace-nowrap">
          Limit: 2 MB / 500 rows
        </span>
      </div>

      {uploadNote && (
        <div className="px-3.5 py-2 rounded border border-border-subtle bg-surface-subtle/50 text-xs font-mono text-text-secondary">
          {uploadNote}
        </div>
      )}

      <BulkStatementReconcilerPanel
        externalText={presetState.text}
        externalDefaultMethod={presetState.defaultMethod}
        externalVersion={presetState.version}
        onCommitted={() => {
          window.dispatchEvent(new Event("erp:data-mutated"));
          refreshPeriod();
        }}
      />
    </div>
  );
}
