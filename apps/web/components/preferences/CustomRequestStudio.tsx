"use client";

import React, { useState, useEffect } from "react";
import { usePerspective } from "@/context/PerspectiveContext";
import {
  CustomFeatureRequest,
  fetchCustomRequests,
  createCustomRequest,
  updateCustomRequest,
  deleteCustomRequest,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import {
  Sparkles,
  ShieldCheck,
  Send,
  Loader2,
  Trash2,
  CheckCircle2,
  Clock,
  Check,
  XCircle,
  FileCode2,
} from "lucide-react";

export function CustomRequestStudio() {
  const { profileMode } = usePerspective();
  const isSuperadmin = profileMode === "SUPERADMIN_BESPOKE";

  const [requests, setRequests] = useState<CustomFeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Form state for creating request
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
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit states for Superadmin inbox
  const [editStates, setEditStates] = useState<
    Record<
      number,
      {
        status: "SUBMITTED" | "IN_REVIEW" | "APPROVED_QUOTED" | "IMPLEMENTED";
        adminNotes: string;
        estimatedSetupFee: string;
      }
    >
  >({});

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await fetchCustomRequests();
      setRequests(data);
      const initialEdits: Record<
        number,
        {
          status: "SUBMITTED" | "IN_REVIEW" | "APPROVED_QUOTED" | "IMPLEMENTED";
          adminNotes: string;
          estimatedSetupFee: string;
        }
      > = {};
      data.forEach((r) => {
        initialEdits[r.id] = {
          status: r.status,
          adminNotes: r.adminNotes || "",
          estimatedSetupFee: r.estimatedSetupFee ? r.estimatedSetupFee.toString() : "",
        };
      });
      setEditStates(initialEdits);
    } catch (e) {
      console.error("Failed to load custom requests", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !desiredBehavior.trim()) {
      setFormMessage({ type: "error", text: "Please enter a title and desired formula specification." });
      return;
    }

    setFormSubmitting(true);
    setFormMessage(null);

    const res = await createCustomRequest({
      title: title.trim(),
      category,
      currentWorkflowDescription: currentWorkflow.trim() || "Standard workflow",
      desiredBehavior: desiredBehavior.trim(),
      priority,
    });

    setFormSubmitting(false);

    if (res.success) {
      setFormMessage({ type: "success", text: "Custom rule request submitted to Superadmin successfully!" });
      setTitle("");
      setCurrentWorkflow("");
      setDesiredBehavior("");
      loadRequests();
    } else {
      setFormMessage({ type: "error", text: res.error || "Failed to submit request" });
    }
  };

  const handleUpdate = async (id: number) => {
    const edit = editStates[id];
    if (!edit) return;

    setActionLoading(id);
    const parsedFee = edit.estimatedSetupFee.trim() ? parseInt(edit.estimatedSetupFee.replace(/\D/g, ""), 10) : 0;

    const res = await updateCustomRequest(id, {
      status: edit.status,
      adminNotes: edit.adminNotes.trim() || undefined,
      estimatedSetupFee: isNaN(parsedFee) ? 0 : parsedFee,
    });

    setActionLoading(null);
    if (res.success) {
      loadRequests();
    } else {
      alert(res.error || "Failed to update request");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this custom request?")) return;
    setActionLoading(id);
    const res = await deleteCustomRequest(id);
    setActionLoading(null);
    if (res.success) {
      loadRequests();
    } else {
      alert(res.error || "Failed to delete request");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-surface-subtle border border-border text-text-tertiary">
            <Clock className="w-3 h-3" />
            <span>SUBMITTED</span>
          </span>
        );
      case "IN_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[rgba(229,155,44,0.1)] border border-[rgba(229,155,44,0.3)] text-caution">
            <Clock className="w-3 h-3" />
            <span>IN REVIEW</span>
          </span>
        );
      case "APPROVED_QUOTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[rgba(16,183,141,0.1)] border border-[rgba(16,183,141,0.25)] text-delta-positive">
            <Check className="w-3 h-3" />
            <span>QUOTED / APPROVED</span>
          </span>
        );
      case "IMPLEMENTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-accent/15 border border-accent/30 text-accent">
            <CheckCircle2 className="w-3 h-3" />
            <span>DEPLOYED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-surface-subtle border border-border text-text-secondary">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Perspective Info Header */}
      <div className="p-4 rounded-lg border border-border bg-surface flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-accent">
            {isSuperadmin ? <ShieldCheck className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold font-sans text-text-primary">
              {isSuperadmin
                ? "Superadmin Client Request Inbox"
                : "Bespoke Rule & Module Request Studio"}
            </h3>
            <p className="text-xs font-sans text-text-tertiary mt-0.5">
              {isSuperadmin
                ? "Review custom calculation requests from Standard Edition users, quote setup fees, and approve rules for rollout."
                : "Request custom math formulas, non-standard waterfall sequences, or tailored export modules from the engineering team."}
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border-subtle bg-surface-subtle text-text-tertiary uppercase">
          {profileMode}
        </span>
      </div>

      {/* Non-Superadmin (Standard Mode): Form to submit request */}
      {!isSuperadmin && (
        <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div>
              <h4 className="text-sm font-semibold font-sans text-text-primary">
                Submit New Rule or Feature Request
              </h4>
              <p className="text-xs font-sans text-text-tertiary mt-0.5">
                Every request receives engineer review, setup quote, and isolated test sandbox verification.
              </p>
            </div>
            <FileCode2 className="w-4 h-4 text-text-tertiary" />
          </div>

          {formMessage && (
            <div
              className={`p-3 rounded text-xs font-sans border ${
                formMessage.type === "success"
                  ? "bg-[rgba(16,183,141,0.08)] border-[rgba(16,183,141,0.25)] text-delta-positive"
                  : "bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.3)] text-delta-negative"
              }`}
            >
              {formMessage.text}
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-sans font-medium text-text-secondary mb-1">
                Summary / Rule Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Freelance Withholding Tax 2.5% deduction on variable invoice intake"
                className="w-full h-9 px-3 rounded border border-border bg-surface-subtle text-xs text-text-primary focus:border-accent focus:outline-hidden"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                  Urgency / Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full h-9 px-3 rounded border border-border bg-surface-subtle text-xs text-text-primary focus:border-accent focus:outline-hidden"
                >
                  <option value="NORMAL">Normal Priority</option>
                  <option value="HIGH_BUSINESS_CRITICAL">High (Business Critical)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-sans font-medium text-text-secondary mb-1">
                Current Limitation
              </label>
              <input
                type="text"
                value={currentWorkflow}
                onChange={(e) => setCurrentWorkflow(e.target.value)}
                placeholder="e.g. Standard mode currently splits evenly across days without accounting for project retainer"
                className="w-full h-9 px-3 rounded border border-border bg-surface-subtle text-xs text-text-primary focus:border-accent focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-sans font-medium text-text-secondary mb-1">
                Detailed Formula or Workflow Specification
              </label>
              <textarea
                value={desiredBehavior}
                onChange={(e) => setDesiredBehavior(e.target.value)}
                rows={3}
                placeholder="Detail exact math formulas, condition rules, or UI requirements..."
                className="w-full p-2.5 rounded border border-border bg-surface-subtle text-xs text-text-primary focus:border-accent focus:outline-hidden resize-none"
                required
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={formSubmitting}
                className="h-8 px-4 rounded text-xs font-sans font-medium bg-accent text-white hover:bg-accent/90 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {formSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit to Superadmin</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests Ledger / Inbox */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div>
            <h4 className="text-sm font-semibold font-sans text-text-primary">
              {isSuperadmin ? "All Registered Client Requests" : "Your Rule Requests & Engineering Status"}
            </h4>
            <p className="text-xs font-sans text-text-tertiary mt-0.5">
              {requests.length} total request{requests.length === 1 ? "" : "s"} recorded.
            </p>
          </div>
          <button
            type="button"
            onClick={loadRequests}
            className="text-xs font-sans text-text-secondary hover:text-text-primary hover:underline cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-text-tertiary font-sans">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading requests...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-tertiary font-sans">
            No custom feature requests found.
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => {
              const edit = editStates[req.id] || {
                status: req.status,
                adminNotes: req.adminNotes || "",
                estimatedSetupFee: req.estimatedSetupFee ? req.estimatedSetupFee.toString() : "",
              };
              const isActioning = actionLoading === req.id;

              return (
                <div
                  key={req.id}
                  className="p-4 rounded-lg border border-border bg-surface-subtle/50 space-y-3"
                >
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs font-sans text-text-primary">
                          {req.title}
                        </span>
                        {getStatusBadge(req.status)}
                        {req.priority === "HIGH_BUSINESS_CRITICAL" && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-urgency/15 text-urgency border border-urgency/30">
                            URGENT
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-text-tertiary mt-1 block">
                        Category: {req.category.replace(/_/g, " ")} • Created:{" "}
                        {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="text-right">
                      {(req.estimatedSetupFee ?? 0) > 0 && (
                        <div className="text-xs font-mono font-semibold text-text-primary tabular-nums">
                          Setup Quote: {formatRupiah(req.estimatedSetupFee!)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Specification Text */}
                  <div className="p-3 rounded bg-surface border border-border-subtle text-xs font-sans text-text-secondary space-y-1">
                    <div className="text-[10px] uppercase font-mono text-text-tertiary">
                      Specification:
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{req.desiredBehavior}</p>
                    {req.currentWorkflowDescription && (
                      <div className="text-[11px] text-text-tertiary mt-1">
                        Current constraint: {req.currentWorkflowDescription}
                      </div>
                    )}
                  </div>

                  {/* Superadmin Response / Notes */}
                  {req.adminNotes && !isSuperadmin && (
                    <div className="p-3 rounded bg-[rgba(16,183,141,0.05)] border border-[rgba(16,183,141,0.2)] text-xs font-sans text-text-primary space-y-1">
                      <div className="text-[10px] uppercase font-mono text-delta-positive font-semibold">
                        Superadmin Roadmap Response:
                      </div>
                      <p className="text-text-secondary">{req.adminNotes}</p>
                    </div>
                  )}

                  {/* Superadmin Management Controls */}
                  {isSuperadmin && (
                    <div className="pt-3 border-t border-border-subtle grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-3">
                        <label className="block text-[10px] font-mono uppercase text-text-tertiary mb-1">
                          Review Status
                        </label>
                        <select
                          value={edit.status}
                          onChange={(e) =>
                            setEditStates((prev) => ({
                              ...prev,
                              [req.id]: { ...edit, status: e.target.value as any },
                            }))
                          }
                          className="w-full h-8 px-2 rounded border border-border bg-surface text-xs text-text-primary focus:border-accent focus:outline-hidden"
                        >
                          <option value="SUBMITTED">SUBMITTED</option>
                          <option value="IN_REVIEW">IN REVIEW</option>
                          <option value="APPROVED_QUOTED">APPROVED / QUOTED</option>
                          <option value="IMPLEMENTED">IMPLEMENTED (DEPLOYED)</option>
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="block text-[10px] font-mono uppercase text-text-tertiary mb-1">
                          Setup Fee Quote (IDR)
                        </label>
                        <input
                          type="text"
                          value={edit.estimatedSetupFee}
                          onChange={(e) =>
                            setEditStates((prev) => ({
                              ...prev,
                              [req.id]: { ...edit, estimatedSetupFee: e.target.value },
                            }))
                          }
                          placeholder="e.g. 500000"
                          className="w-full h-8 px-2 rounded border border-border bg-surface text-xs font-mono text-text-primary focus:border-accent focus:outline-hidden tabular-nums"
                        />
                      </div>

                      <div className="col-span-4">
                        <label className="block text-[10px] font-mono uppercase text-text-tertiary mb-1">
                          Admin Roadmap Notes
                        </label>
                        <input
                          type="text"
                          value={edit.adminNotes}
                          onChange={(e) =>
                            setEditStates((prev) => ({
                              ...prev,
                              [req.id]: { ...edit, adminNotes: e.target.value },
                            }))
                          }
                          placeholder="Response notes or planned release..."
                          className="w-full h-8 px-2 rounded border border-border bg-surface text-xs text-text-primary focus:border-accent focus:outline-hidden"
                        />
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdate(req.id)}
                          disabled={isActioning}
                          className="h-8 px-3 rounded text-xs font-sans font-medium bg-surface-active hover:bg-surface-hover text-text-primary border border-border transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(req.id)}
                          disabled={isActioning}
                          className="h-8 px-2 rounded text-xs text-urgency hover:bg-urgency/10 transition-colors cursor-pointer disabled:opacity-50"
                          title="Delete request"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

