"use client";

import React, { useState } from "react";
import { usePerspective } from "@/context/PerspectiveContext";
import { X, Send, CheckCircle2, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { createCustomRequest } from "@/lib/api";
import Link from "next/link";

export function CustomRuleRequestModal() {
  const { isCustomRequestModalOpen, setIsCustomRequestModalOpen } = usePerspective();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<
    | "CUSTOM_PAYROLL_FORMULA"
    | "CUSTOM_WATERFALL_RULE"
    | "BANK_EXPORT_INTEGRATION"
    | "BESPOKE_MODULE"
  >("CUSTOM_PAYROLL_FORMULA");
  const [currentWorkflow, setCurrentWorkflow] = useState("");
  const [desiredBehavior, setDesiredBehavior] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH_BUSINESS_CRITICAL">("NORMAL");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  React.useEffect(() => {
    if (!isCustomRequestModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsCustomRequestModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCustomRequestModalOpen, setIsCustomRequestModalOpen]);

  if (!isCustomRequestModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !desiredBehavior.trim()) {
      setError("Please provide a title and specification of the desired behavior.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await createCustomRequest({
      title: title.trim(),
      category,
      currentWorkflowDescription: currentWorkflow.trim() || "Standard workflow",
      desiredBehavior: desiredBehavior.trim(),
      priority,
    });

    setIsSubmitting(false);

    if (result.success) {
      setSubmittedSuccess(true);
    } else {
      setError(result.error || "Failed to submit request.");
    }
  };

  const handleClose = () => {
    setIsCustomRequestModalOpen(false);
    // Reset state after transition
    setTimeout(() => {
      setSubmittedSuccess(false);
      setTitle("");
      setCurrentWorkflow("");
      setDesiredBehavior("");
      setPriority("NORMAL");
      setError(null);
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-xl border border-border bg-surface p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-accent">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold font-sans text-text-primary tracking-tight">
                Request Bespoke Rule or Module
              </h2>
              <p className="text-xs font-sans text-text-tertiary mt-0.5">
                Submit architectural rules, formula adjustments, or custom views to the Superadmin.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-subtle cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submittedSuccess ? (
          <div className="py-6 space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-[rgba(16,183,141,0.12)] border border-[rgba(16,183,141,0.25)] flex items-center justify-center text-delta-positive">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold font-sans text-text-primary">
                Rule Request Submitted
              </h3>
              <p className="text-xs font-sans text-text-secondary mt-1 max-w-md mx-auto leading-relaxed">
                Your request has been routed to the Superadmin Client Request Inbox. You can track status, review quotes, and verify deployment in Preferences.
              </p>
            </div>

            <div className="pt-4 flex items-center justify-center gap-3">
              <Link
                href="/preferences?tab=requests"
                onClick={handleClose}
                className="h-8 px-4 rounded text-xs font-sans font-medium bg-surface-active hover:bg-surface-hover text-text-primary border border-border transition-colors flex items-center gap-2"
              >
                <span>View Request Inbox</span>
              </Link>
              <button
                type="button"
                onClick={handleClose}
                className="h-8 px-4 rounded text-xs font-sans font-medium bg-accent text-white hover:bg-accent/90 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] flex items-center gap-2 text-xs text-delta-negative font-sans">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-sans font-medium text-text-secondary mb-1">
                Request Title / Short Summary
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Add 10% Withholding Tax deduction on freelance invoices"
                className="w-full h-9 px-3 rounded border border-border bg-surface-subtle text-xs text-text-primary focus:border-accent focus:outline-hidden"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-sans font-medium text-text-secondary mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full h-9 px-3 rounded border border-border bg-surface-subtle text-xs text-text-primary focus:border-accent focus:outline-hidden"
                >
                  <option value="CUSTOM_PAYROLL_FORMULA">Custom Payroll Formula</option>
                  <option value="CUSTOM_WATERFALL_RULE">Waterfall Priority / Quota Rule</option>
                  <option value="BANK_EXPORT_INTEGRATION">Bank / CSV Export Integration</option>
                  <option value="BESPOKE_MODULE">Bespoke ERP Module / New Section</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-sans font-medium text-text-secondary mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full h-9 px-3 rounded border border-border bg-surface-subtle text-xs text-text-primary focus:border-accent focus:outline-hidden"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH_BUSINESS_CRITICAL">High (Business Critical)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-sans font-medium text-text-secondary mb-1">
                Current Workflow / Limitation
              </label>
              <textarea
                value={currentWorkflow}
                onChange={(e) => setCurrentWorkflow(e.target.value)}
                rows={2}
                placeholder="Describe what you currently do manually or how the default system behaves..."
                className="w-full p-2.5 rounded border border-border bg-surface-subtle text-xs text-text-primary focus:border-accent focus:outline-hidden resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-sans font-medium text-text-secondary mb-1">
                Desired Formula or Architecture Specification
              </label>
              <textarea
                value={desiredBehavior}
                onChange={(e) => setDesiredBehavior(e.target.value)}
                rows={4}
                placeholder="Detail exact math formulas, trigger rules, or database fields needed..."
                className="w-full p-2.5 rounded border border-border bg-surface-subtle text-xs text-text-primary focus:border-accent focus:outline-hidden resize-none"
                required
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={handleClose}
                className="h-9 px-4 rounded text-xs font-sans font-medium text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-9 px-4 rounded text-xs font-sans font-medium bg-accent text-white hover:bg-accent/90 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

