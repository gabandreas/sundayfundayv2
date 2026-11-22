"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Mail, User as UserIcon, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function ProfileSettingsModal() {
  const { user, isProfileModalOpen, closeProfileModal, updateUserProfile } = useAuth();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isProfileModalOpen) {
      setFullName(user?.fullName || "");
      setEmail(user?.email || "");
      setFeedback(null);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isProfileModalOpen, user?.fullName, user?.email]);

  const handleClose = () => {
    closeProfileModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) {
      setFeedback({ ok: false, message: "Display name cannot be empty." });
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFeedback({ ok: false, message: "Please enter a valid email address." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    const res = await updateUserProfile({
      fullName: trimmedName,
      email: trimmedEmail,
    });
    setSaving(false);

    if (!res.success) {
      setFeedback({
        ok: false,
        message: res.error || "Unable to save profile changes.",
      });
      return;
    }

    setFeedback({
      ok: true,
      message: `Profile saved. Outgoing transactional emails now deliver To ${trimmedEmail}.`,
    });
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="profile-settings-modal-title"
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          handleClose();
        }
      }}
      className="erp-dialog shadow-2xl max-w-md w-full"
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-surface-subtle">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
            Account Identity &amp; Email Routing
          </div>
          <h2
            id="profile-settings-modal-title"
            className="text-sm font-semibold text-text-primary mt-0.5"
          >
            Profile &amp; Account Settings
          </h2>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close profile settings"
          className="p-1.5 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3 p-3 rounded border border-border-subtle bg-canvas text-xs font-mono">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary block">
              Username
            </span>
            <span className="text-text-primary mt-0.5 block">
              {user?.username || user?.accountName || "cheeseburger"}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary block">
              Account ID
            </span>
            <span className="text-text-primary mt-0.5 block">#{user?.id ?? 1}</span>
          </div>
          <div className="col-span-2 pt-2 border-t border-border-subtle">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary block">
              Platform System Sender (From)
            </span>
            <span className="text-delta-positive mt-0.5 block">
              Sunday Funday ERP &lt;sundayfundayerp@gmail.com&gt;
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="profile-fullname-input"
            className="text-xs font-medium text-text-secondary flex items-center gap-1.5"
          >
            <UserIcon className="w-3.5 h-3.5 text-text-tertiary" />
            <span>Display Name</span>
          </label>
          <input
            id="profile-fullname-input"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={120}
            className="w-full px-3 py-2 rounded bg-canvas border border-border text-sm text-text-primary focus:outline-none focus:border-border-strong"
            placeholder="Your display name"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="profile-email-input"
            className="text-xs font-medium text-text-secondary flex items-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5 text-text-tertiary" />
            <span>Profile Email (Transactional Recipient To)</span>
          </label>
          <input
            id="profile-email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={160}
            className="w-full px-3 py-2 rounded bg-canvas border border-border text-sm font-mono text-text-primary focus:outline-none focus:border-border-strong"
            placeholder="you@gmail.com"
          />
          <p className="text-[11px] text-text-tertiary leading-relaxed">
            Monthly .xlsx statements, cutoff digests, off-site backups, kill-switch notices, and security alerts are routed automatically to this address.
          </p>
        </div>

        {user?.role === "DEMO_SANDBOX" && (
          <div className="px-3 py-2 rounded border border-caution/30 bg-[rgba(229,155,44,0.08)] text-[11px] text-caution">
            Demo Sandbox account: profile edits take effect immediately for testing and revert to demo@sundayfunday.id on Demo Reset.
          </div>
        )}

        {feedback && (
          <div
            className={`px-3 py-2 rounded border text-xs flex items-start gap-2 ${
              feedback.ok
                ? "border-delta-positive/30 bg-[rgba(16,183,141,0.08)] text-delta-positive"
                : "border-urgency/35 bg-[rgba(255,56,56,0.08)] text-urgency"
            }`}
          >
            {feedback.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 py-1.5 rounded text-xs font-medium bg-surface-subtle hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border cursor-pointer"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 rounded text-xs font-medium bg-text-primary text-canvas hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
