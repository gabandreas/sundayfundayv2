"use client";

import React, { useState } from "react";
import { Plus, Trash2, Save, Check } from "lucide-react";
import {
  EventCategoryConfigRow,
  ModularStudioConfig,
  SimpleCategoryConfigRow,
} from "@/lib/api";
import { usePerspective } from "@/context/PerspectiveContext";
import { useToast } from "@/context/ToastContext";

type MasterTab = "events" | "commitments" | "sinking";

const FALLBACK_EVENTS: EventCategoryConfigRow[] = [
  {
    id: "evt_day_outing",
    code: "DAY_OUTING",
    label: "Day Outing",
    foodPct: 45,
    transportPct: 20,
    activitiesPct: 20,
    contingencyPct: 15,
    weekendWeightPct: 120,
    active: true,
  },
  {
    id: "evt_weekend_trip",
    code: "WEEKEND_TRIP",
    label: "Weekend Trip",
    foodPct: 38,
    transportPct: 22,
    activitiesPct: 28,
    contingencyPct: 12,
    weekendWeightPct: 135,
    active: true,
  },
  {
    id: "evt_vacation",
    code: "VACATION",
    label: "Vacation",
    foodPct: 34,
    transportPct: 24,
    activitiesPct: 30,
    contingencyPct: 12,
    weekendWeightPct: 135,
    active: true,
  },
  {
    id: "evt_dining",
    code: "DINING_GATHERING",
    label: "Dining & Gathering",
    foodPct: 60,
    transportPct: 15,
    activitiesPct: 15,
    contingencyPct: 10,
    weekendWeightPct: 115,
    active: true,
  },
  {
    id: "evt_concert",
    code: "CONCERT_EVENT",
    label: "Concert & Ticketed Event",
    foodPct: 25,
    transportPct: 20,
    activitiesPct: 45,
    contingencyPct: 10,
    weekendWeightPct: 120,
    active: true,
  },
  {
    id: "evt_general",
    code: "GENERAL_EVENT",
    label: "Other Occasion",
    foodPct: 40,
    transportPct: 20,
    activitiesPct: 25,
    contingencyPct: 15,
    weekendWeightPct: 115,
    active: true,
  },
];

const FALLBACK_COMMITMENTS: SimpleCategoryConfigRow[] = [
  { id: "cmt_outing", code: "EVENT_OUTING", label: "Event / Outing", active: true },
  { id: "cmt_penalty", code: "PENALTY_FEE", label: "Penalty / Cancellation", active: true },
  { id: "cmt_force", code: "FORCE_MAJEURE", label: "Unexpected Expense", active: true },
  { id: "cmt_tax", code: "ANNUAL_TAX", label: "Annual Tax / Licensing", active: true },
  { id: "cmt_med", code: "MEDICAL", label: "Medical / Health", active: true },
  { id: "cmt_gift", code: "GIFT", label: "Gift / Contribution", active: true },
  { id: "cmt_other", code: "OTHER", label: "Other", active: true },
];

const FALLBACK_SINKING: SimpleCategoryConfigRow[] = [
  { id: "sf_travel", code: "TRAVEL", label: "Travel & Holiday", active: true },
  { id: "sf_emergency", code: "EMERGENCY", label: "Emergency Reserve", active: true },
  { id: "sf_gadget", code: "GADGET", label: "Device & Gear", active: true },
  { id: "sf_vehicle", code: "VEHICLE", label: "Vehicle Service / Tax", active: true },
  { id: "sf_edu", code: "EDUCATION", label: "Course & Education", active: true },
  { id: "sf_gen", code: "GENERAL", label: "General Reserve", active: true },
];

function slugCode(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

export function CategoryMasterTableCard({
  initialConfig,
}: {
  initialConfig?: ModularStudioConfig;
}) {
  const { updateStudioConfig } = usePerspective();
  const { toast } = useToast();

  const [tab, setTab] = useState<MasterTab>("events");
  const [eventRows, setEventRows] = useState<EventCategoryConfigRow[]>(() =>
    initialConfig?.eventCategoriesTable?.length
      ? initialConfig.eventCategoriesTable
      : FALLBACK_EVENTS,
  );
  const [commitmentRows, setCommitmentRows] = useState<SimpleCategoryConfigRow[]>(() =>
    initialConfig?.commitmentCategoriesTable?.length
      ? initialConfig.commitmentCategoriesTable
      : FALLBACK_COMMITMENTS,
  );
  const [sinkingRows, setSinkingRows] = useState<SimpleCategoryConfigRow[]>(() =>
    initialConfig?.sinkingFundCategoriesTable?.length
      ? initialConfig.sinkingFundCategoriesTable
      : FALLBACK_SINKING,
  );
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAddRow = () => {
    const clean = newLabel.trim();
    if (!clean) return;
    const code = slugCode(clean) || `CUSTOM_${Date.now()}`;
    if (tab === "events") {
      if (eventRows.some((r) => r.code === code)) return;
      setEventRows((prev) => [
        ...prev,
        {
          id: `evt_${Date.now()}`,
          code,
          label: clean,
          foodPct: 40,
          transportPct: 20,
          activitiesPct: 25,
          contingencyPct: 15,
          weekendWeightPct: 120,
          active: true,
        },
      ]);
    } else if (tab === "commitments") {
      if (commitmentRows.some((r) => r.code === code)) return;
      setCommitmentRows((prev) => [
        ...prev,
        { id: `cmt_${Date.now()}`, code, label: clean, active: true },
      ]);
    } else {
      if (sinkingRows.some((r) => r.code === code)) return;
      setSinkingRows((prev) => [
        ...prev,
        { id: `sf_${Date.now()}`, code, label: clean, active: true },
      ]);
    }
    setNewLabel("");
  };

  const handleSave = async () => {
    const badEvent = eventRows.find(
      (r) =>
        Math.round(r.foodPct + r.transportPct + r.activitiesPct + r.contingencyPct) !== 100,
    );
    if (badEvent) {
      toast({
        title: "Split weights must total 100%",
        description: `Check percentages for "${badEvent.label}".`,
        variant: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const updated = await updateStudioConfig({
        eventCategoriesTable: eventRows,
        commitmentCategoriesTable: commitmentRows,
        sinkingFundCategoriesTable: sinkingRows,
      });
      if (updated) {
        toast({
          title: "Category master data saved",
          description: "Changes apply immediately across Event Budgets, One-Off Bills, and Sinking Funds.",
          variant: "success",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary">
            Modular Category Master Data
          </h3>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Customize event types and budget split weights, one-off commitment tags, and sinking fund labels.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="erp-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-sans font-medium cursor-pointer disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? "Saving..." : "Save Categories"}</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-border bg-canvas p-0.5 gap-0.5">
          {(
            [
              { key: "events", label: "Event Types" },
              { key: "commitments", label: "One-Off Categories" },
              { key: "sinking", label: "Sinking Fund Categories" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`px-3 py-1 rounded text-xs font-sans cursor-pointer transition-colors ${
                tab === item.key
                  ? "bg-surface-active text-text-primary font-medium"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="New category label..."
            className="px-2.5 py-1 rounded border border-border bg-canvas text-xs font-sans text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          />
          <button
            type="button"
            onClick={handleAddRow}
            className="erp-btn-secondary inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-sans cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {tab === "events" ? (
        <div className="overflow-x-auto border border-border-subtle rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-surface-subtle/50 text-[10px] font-sans font-semibold text-text-tertiary border-b border-border-subtle">
              <tr>
                <th className="px-3 py-2">Label</th>
                <th className="px-2 py-2 text-right">Food %</th>
                <th className="px-2 py-2 text-right">Transport %</th>
                <th className="px-2 py-2 text-right">Activities %</th>
                <th className="px-2 py-2 text-right">Contingency %</th>
                <th className="px-2 py-2 text-right">Weekend Boost %</th>
                <th className="px-3 py-2 text-center">Active</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {eventRows.map((row, idx) => {
                const totalPct =
                  Math.round(row.foodPct + row.transportPct + row.activitiesPct + row.contingencyPct);
                return (
                  <tr key={row.id} className="hover:bg-surface-subtle/30">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.label}
                        onChange={(e) =>
                          setEventRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, label: e.target.value } : r)),
                          )
                        }
                        className="w-44 px-2 py-1 rounded border border-border-subtle bg-canvas text-xs font-sans text-text-primary"
                      />
                    </td>
                    {(
                      ["foodPct", "transportPct", "activitiesPct", "contingencyPct"] as const
                    ).map((field) => (
                      <td key={field} className="px-2 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={row[field]}
                          onChange={(e) =>
                            setEventRows((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, [field]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : r,
                              ),
                            )
                          }
                          className={`w-14 px-1.5 py-1 rounded border bg-canvas text-right font-mono tabular-nums ${
                            totalPct !== 100 ? "border-urgency text-urgency" : "border-border-subtle text-text-primary"
                          }`}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min={100}
                        max={250}
                        value={row.weekendWeightPct}
                        onChange={(e) =>
                          setEventRows((prev) =>
                            prev.map((r, i) =>
                              i === idx
                                ? { ...r, weekendWeightPct: Math.max(100, Math.min(250, Number(e.target.value) || 120)) }
                                : r,
                            ),
                          )
                        }
                        className="w-16 px-1.5 py-1 rounded border border-border-subtle bg-canvas text-right font-mono tabular-nums text-text-primary"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setEventRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, active: !r.active } : r)),
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-sans border cursor-pointer ${
                          row.active
                            ? "border-delta-positive/40 bg-delta-positive/10 text-delta-positive"
                            : "border-border-subtle bg-canvas text-text-tertiary"
                        }`}
                      >
                        {row.active && <Check className="w-3 h-3" />}
                        <span>{row.active ? "On" : "Off"}</span>
                      </button>
                    </td>
                    <td className="px-2 py-2 text-right">
                      {eventRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEventRows((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-text-tertiary hover:text-urgency cursor-pointer"
                          aria-label={`Remove ${row.label}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {(tab === "commitments" ? commitmentRows : sinkingRows).map((row, idx, arr) => {
            const setTarget = tab === "commitments" ? setCommitmentRows : setSinkingRows;
            return (
              <div
                key={row.id}
                className="flex items-center justify-between gap-2 rounded border border-border-subtle bg-canvas px-3 py-2"
              >
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) =>
                    setTarget((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, label: e.target.value } : r)),
                    )
                  }
                  className="flex-1 min-w-0 bg-transparent text-xs font-sans text-text-primary focus-visible:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setTarget((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, active: !r.active } : r)),
                    )
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-sans border cursor-pointer ${
                    row.active
                      ? "border-delta-positive/40 bg-delta-positive/10 text-delta-positive"
                      : "border-border-subtle text-text-tertiary"
                  }`}
                >
                  {row.active ? "On" : "Off"}
                </button>
                {arr.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setTarget((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1 text-text-tertiary hover:text-urgency cursor-pointer"
                    aria-label={`Remove ${row.label}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
