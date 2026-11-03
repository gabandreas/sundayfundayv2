"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  AdminUserSummary,
  SecuritySettings,
  GlobalConfig,
  CustomFeatureRequest,
  UserRole,
  BlueprintType,
  LifeStagePreset,
  FormulaEngineType,
  UiDensityMode,
  ModuleKey,
  ALL_MODULE_KEYS,
  LIFE_STAGE_PRESET_CATALOG,
  MODULE_REGISTRY_CATALOG,
  fetchAdminUsers,
  createAdminClient,
  updateAdminClient,
  fetchAdminUserConfig,
  updateAdminUserConfig,
  fetchAdminFeatureRequests,
  updateAdminFeatureRequest,
  fetchAdminSecuritySettings,
  addAdminTrustedIp,
  removeAdminTrustedIp,
  updateAdminSecuritySettings,
  getAdminBackupDownloadUrl,
  restoreAdminBackup,
  updateAdminCredentials,
  RestoreDryRunSummary,
} from "@/lib/api";
import {
  ShieldCheck,
  Users,
  SlidersHorizontal,
  Inbox,
  Lock,
  Download,
  Upload,
  FileText,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Terminal,
} from "lucide-react";

type AdminTab = "ACCOUNTS" | "BLUEPRINT" | "REQUESTS" | "SECURITY";

export default function AdminConsolePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("ACCOUNTS");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Data states
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserConfig, setSelectedUserConfig] = useState<GlobalConfig | null>(null);
  const [featureRequests, setFeatureRequests] = useState<CustomFeatureRequest[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings | null>(null);

  // Modals & form states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    accountName: "",
    username: "",
    fullName: "",
    email: "",
    role: "BESPOKE_CLIENT" as UserRole,
    blueprintType: "STANDARD_GENERAL" as BlueprintType,
    lifeStagePreset: "CORPORATE_PROFESSIONAL" as LifeStagePreset,
    tempPassword: "Password#2026",
    initializeFirstPeriod: true,
    initialSalary: "12000000",
  });

  // Request editing state
  const [editingRequest, setEditingRequest] = useState<CustomFeatureRequest | null>(null);
  const [requestUpdateForm, setRequestUpdateForm] = useState({
    status: "IN_REVIEW" as any,
    estimatedSetupFee: "",
    adminNotes: "",
  });

  // Security editing state
  const [newIpAddress, setNewIpAddress] = useState("");
  const [newIpLabel, setNewIpLabel] = useState("");
  const [newSecurityPin, setNewSecurityPin] = useState("");

  // Backup Restore state
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupJson, setBackupJson] = useState<any | null>(null);
  const [isDryRunValidating, setIsDryRunValidating] = useState(false);
  const [dryRunSummary, setDryRunSummary] = useState<RestoreDryRunSummary | null>(null);
  const [restoreConfirmationText, setRestoreConfirmationText] = useState("");
  const [restoreSecurityPin, setRestoreSecurityPin] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccessCounts, setRestoreSuccessCounts] = useState<RestoreDryRunSummary | null>(null);

  // Owner Credentials Update state
  const [credentialForm, setCredentialForm] = useState({
    currentPassword: "",
    newEmail: "",
    newPassword: "",
    newSecurityPin: "",
  });
  const [isUpdatingCredentials, setIsUpdatingCredentials] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const [usersList, requestsList, sec] = await Promise.all([
        fetchAdminUsers(),
        fetchAdminFeatureRequests(),
        fetchAdminSecuritySettings(),
      ]);
      setUsers(usersList);
      setFeatureRequests(requestsList);
      setSecuritySettings(sec);
      if (usersList.length > 0 && !selectedUserId) {
        setSelectedUserId(usersList[0].id);
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to load platform administration records",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When selected user changes in Blueprint Studio
  useEffect(() => {
    if (!selectedUserId) return;
    fetchAdminUserConfig(selectedUserId)
      .then((cfg) => setSelectedUserConfig(cfg))
      .catch(() => setSelectedUserConfig(null));
  }, [selectedUserId]);

  // Keyboard ergonomics: Escape key closes open modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isCreateModalOpen) setIsCreateModalOpen(false);
        if (editingRequest) setEditingRequest(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCreateModalOpen, editingRequest]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await createAdminClient({
        accountName: createForm.accountName.trim() || undefined,
        username: createForm.username.trim() || undefined,
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        blueprintType: createForm.blueprintType,
        lifeStagePreset: createForm.lifeStagePreset,
        tempPassword: createForm.tempPassword,
        initializeFirstPeriod: createForm.initializeFirstPeriod,
        initialSalary: parseInt(createForm.initialSalary, 10) || 10_000_000,
      } as any);
      setIsCreateModalOpen(false);
      setStatusMessage({
        type: "success",
        text: `Created client account for ${createForm.fullName}`,
      });
      await loadData();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to create client" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveUserConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !selectedUserConfig) return;
    setIsLoading(true);
    try {
      await updateAdminUserConfig(selectedUserId, selectedUserConfig);
      setStatusMessage({
        type: "success",
        text: `Updated configuration blueprint for User #${selectedUserId}`,
      });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to update blueprint" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveFeatureRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest) return;
    setIsLoading(true);
    try {
      await updateAdminFeatureRequest(editingRequest.id, {
        status: requestUpdateForm.status,
        estimatedSetupFee: requestUpdateForm.estimatedSetupFee
          ? parseInt(requestUpdateForm.estimatedSetupFee, 10)
          : null,
        adminNotes: requestUpdateForm.adminNotes.trim() || null,
      });
      setEditingRequest(null);
      setStatusMessage({
        type: "success",
        text: `Updated assessment for Request #${editingRequest.id}`,
      });
      const updatedList = await fetchAdminFeatureRequests();
      setFeatureRequests(updatedList);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to update request" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleIpWhitelist = async (enforce: boolean) => {
    setIsLoading(true);
    try {
      await updateAdminSecuritySettings({ ipWhitelistEnforced: enforce });
      setSecuritySettings((prev) =>
        prev ? { ...prev, ipWhitelistEnforced: enforce } : null
      );
      setStatusMessage({
        type: "success",
        text: `Strict IP whitelist enforcement ${enforce ? "ENABLED" : "DISABLED"}`,
      });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTrustedIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIpAddress.trim()) return;
    setIsLoading(true);
    try {
      await addAdminTrustedIp({
        ipAddress: newIpAddress.trim(),
        label: newIpLabel.trim() || `Trusted IP (${newIpAddress.trim()})`,
      });
      setNewIpAddress("");
      setNewIpLabel("");
      const sec = await fetchAdminSecuritySettings();
      setSecuritySettings(sec);
      setStatusMessage({ type: "success", text: "Whitelisted IP address successfully." });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveTrustedIp = async (id: number) => {
    setIsLoading(true);
    try {
      await removeAdminTrustedIp(id);
      const sec = await fetchAdminSecuritySettings();
      setSecuritySettings(sec);
      setStatusMessage({ type: "success", text: "Removed IP from whitelist." });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSecurityPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newSecurityPin.length !== 6) {
      setStatusMessage({ type: "error", text: "Security PIN must be exactly 6 digits." });
      return;
    }
    setIsLoading(true);
    try {
      await updateAdminSecuritySettings({ newSecurityPin });
      setNewSecurityPin("");
      setStatusMessage({ type: "success", text: "Updated Superadmin Security PIN." });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackupFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBackupFile(file);
    setIsDryRunValidating(true);
    setDryRunSummary(null);
    setRestoreSuccessCounts(null);
    setStatusMessage(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setBackupJson(parsed);

      const res = await restoreAdminBackup({
        mode: "VALIDATE_DRY_RUN",
        backup: parsed,
      });

      if (res.summary) {
        setDryRunSummary(res.summary);
        setStatusMessage({
          type: "success",
          text: `Backup file verified: ${res.message || "Valid schema with recognizable tables."}`,
        });
      }
    } catch (err: any) {
      setBackupJson(null);
      setDryRunSummary(null);
      setStatusMessage({
        type: "error",
        text: `Backup validation failed: ${err.message || "Invalid JSON or schema."}`,
      });
    } finally {
      setIsDryRunValidating(false);
    }
  };

  const handleExecuteRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupJson) {
      setStatusMessage({ type: "error", text: "Please select and validate a backup file first." });
      return;
    }
    if (restoreConfirmationText !== "CONFIRM RESTORE") {
      setStatusMessage({ type: "error", text: 'You must type "CONFIRM RESTORE" exactly to proceed.' });
      return;
    }
    if (!restoreSecurityPin || restoreSecurityPin.length !== 6) {
      setStatusMessage({ type: "error", text: "Valid 6-digit Security PIN is required." });
      return;
    }

    setIsRestoring(true);
    setStatusMessage(null);
    try {
      const res = await restoreAdminBackup({
        mode: "RESTORE_OVERWRITE",
        confirmationText: restoreConfirmationText,
        securityPin: restoreSecurityPin,
        backup: backupJson,
      });

      if (res.restoredCounts) {
        setRestoreSuccessCounts(res.restoredCounts);
      }
      setRestoreConfirmationText("");
      setRestoreSecurityPin("");
      setStatusMessage({
        type: "success",
        text: "Database restored successfully inside an atomic transaction. Auto-increment sequences reset.",
      });
      await loadData();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: `Restore failed: ${err.message}` });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleUpdateOwnerCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialForm.currentPassword) {
      setStatusMessage({ type: "error", text: "Current password is required to update credentials." });
      return;
    }

    setIsUpdatingCredentials(true);
    setStatusMessage(null);
    try {
      const res = await updateAdminCredentials({
        currentPassword: credentialForm.currentPassword,
        newEmail: credentialForm.newEmail || undefined,
        newPassword: credentialForm.newPassword || undefined,
        newSecurityPin: credentialForm.newSecurityPin || undefined,
      });

      setStatusMessage({ type: "success", text: res.message || "Credentials updated successfully." });
      setCredentialForm({
        currentPassword: "",
        newEmail: "",
        newPassword: "",
        newSecurityPin: "",
      });
      const sec = await fetchAdminSecuritySettings();
      setSecuritySettings(sec);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to update credentials." });
    } finally {
      setIsUpdatingCredentials(false);
    }
  };

  const handleDownloadBackup = () => {
    const url = getAdminBackupDownloadUrl();
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Restrict access to Platform Owner only
  if (user && user.role !== "PLATFORM_OWNER") {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 rounded-lg border border-negative/30 bg-surface text-center">
        <ShieldCheck className="w-10 h-10 text-negative mx-auto mb-3" />
        <h2 className="text-lg font-medium text-text-primary">Access Restricted</h2>
        <p className="text-xs text-text-secondary mt-2">
          The Platform Admin Console is strictly reserved for PLATFORM_OWNER accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner / Executive Title */}
      <div className="flex items-center justify-between border-b border-border pb-5">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
            System Administration
          </div>
          <h1 className="text-2xl font-serif text-text-primary tracking-tight mt-1">
            Platform Admin Console
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Multi-tenant SaaS client management, custom blueprint engine, feature quoting, and security controls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border bg-surface hover:bg-surface-subtle text-text-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded border border-border-strong bg-text-primary text-canvas hover:opacity-95 transition-opacity cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Full Backup (.json)</span>
          </button>
        </div>
      </div>

      {/* Global Status Notice */}
      {statusMessage && (
        <div
          className={`p-3 rounded-md border flex items-center justify-between text-xs ${
            statusMessage.type === "success"
              ? "border-positive/30 bg-positive/10 text-positive"
              : "border-negative/30 bg-negative/10 text-negative"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-[11px] font-mono uppercase underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-border bg-surface">
          <div className="text-[10px] font-mono text-text-tertiary uppercase">Total Accounts</div>
          <div className="text-2xl font-serif font-medium text-text-primary mt-1">
            {users.length}
          </div>
          <div className="text-[11px] text-text-secondary mt-1">
            {users.filter((u) => u.role === "BESPOKE_CLIENT").length} Bespoke Clients
          </div>
        </div>

        <div className="p-4 rounded-lg border border-border bg-surface">
          <div className="text-[10px] font-mono text-text-tertiary uppercase">Active Snapshots</div>
          <div className="text-2xl font-serif font-medium text-text-primary mt-1">
            {users.reduce((sum, u) => sum + (u.snapshotCount || 0), 0)}
          </div>
          <div className="text-[11px] text-text-secondary mt-1">Stored across all tenants</div>
        </div>

        <div className="p-4 rounded-lg border border-border bg-surface">
          <div className="text-[10px] font-mono text-text-tertiary uppercase">Pending Requests</div>
          <div className="text-2xl font-serif font-medium text-text-primary mt-1">
            {featureRequests.filter((r) => r.status === "SUBMITTED" || r.status === "IN_REVIEW").length}
          </div>
          <div className="text-[11px] text-text-secondary mt-1">Awaiting review or quotation</div>
        </div>

        <div className="p-4 rounded-lg border border-border bg-surface">
          <div className="text-[10px] font-mono text-text-tertiary uppercase">IP Whitelist</div>
          <div className="text-2xl font-serif font-medium text-text-primary mt-1">
            {securitySettings?.ipWhitelistEnforced ? "STRICT" : "PERMISSIVE"}
          </div>
          <div className="text-[11px] text-text-secondary mt-1">
            {securitySettings?.trustedIps?.length || 0} whitelisted IP addresses
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="w-full">
        <nav
          className="bg-[#0B0F19] border border-slate-800/80 p-1 rounded-lg flex items-center gap-1 overflow-x-auto no-scrollbar"
          aria-label="Admin Navigation Tabs"
        >
          <button
            type="button"
            onClick={() => setActiveTab("ACCOUNTS")}
            className={`whitespace-nowrap text-xs font-medium px-3.5 py-2 rounded-md transition-all duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === "ACCOUNTS"
                ? "bg-slate-800/90 text-white shadow-sm border border-slate-700/60"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Clients & Accounts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("BLUEPRINT")}
            className={`whitespace-nowrap text-xs font-medium px-3.5 py-2 rounded-md transition-all duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === "BLUEPRINT"
                ? "bg-slate-800/90 text-white shadow-sm border border-slate-700/60"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Client Blueprint Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("REQUESTS")}
            className={`whitespace-nowrap text-xs font-medium px-3.5 py-2 rounded-md transition-all duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === "REQUESTS"
                ? "bg-slate-800/90 text-white shadow-sm border border-slate-700/60"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Feature Requests ({featureRequests.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SECURITY")}
            className={`whitespace-nowrap text-xs font-medium px-3.5 py-2 rounded-md transition-all duration-150 flex items-center gap-2 cursor-pointer ${
              activeTab === "SECURITY"
                ? "bg-slate-800/90 text-white shadow-sm border border-slate-700/60"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Security, IP Whitelist & Backup</span>
          </button>

          <Link
            href="/admin/sql"
            className="whitespace-nowrap text-xs font-medium px-3.5 py-2 rounded-md transition-all duration-150 flex items-center gap-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 border border-emerald-500/30"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>SQL Query Studio &rarr;</span>
          </Link>
        </nav>
      </div>

      {/* TAB 1: CLIENTS & ACCOUNTS */}
      {activeTab === "ACCOUNTS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">Registered Tenants & Users</h3>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border-strong bg-text-primary text-canvas hover:opacity-95 transition-opacity font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Provision Client Account</span>
            </button>
          </div>

          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-subtle border-b border-border text-[10px] font-mono uppercase text-text-tertiary">
                <tr>
                  <th className="px-4 py-3">ID / User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Blueprint</th>
                  <th className="px-4 py-3">Snapshots</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-sans">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-subtle/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-text-primary">{u.fullName}</div>
                      <div className="text-[11px] font-mono text-text-tertiary mt-0.5">
                        <span className="text-emerald-400/80">{u.accountName || "default"}</span> /{" "}
                        <span className="text-text-secondary">{u.username || "—"}</span> · {u.email}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded border border-border bg-surface-subtle">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-mono text-[11px] text-text-primary">
                        {u.lifeStagePreset || u.blueprintType}
                      </div>
                      <div className="font-mono text-[10px] text-text-tertiary mt-0.5">
                        {u.blueprintType} · {u.uiDensityMode || "COMMAND_COCKPIT"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-text-primary">
                      {u.snapshotCount}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                          u.status === "ACTIVE"
                            ? "bg-positive/10 text-positive border border-positive/20"
                            : "bg-negative/10 text-negative border border-negative/20"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUserId(u.id);
                          setActiveTab("BLUEPRINT");
                        }}
                        className="px-2 py-1 text-[11px] rounded border border-border hover:bg-surface-subtle text-text-secondary"
                      >
                        Blueprint
                      </button>
                      {u.id !== 1 && (
                        <button
                          type="button"
                          onClick={async () => {
                            const nextStatus = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
                            await updateAdminClient(u.id, { status: nextStatus });
                            await loadData();
                          }}
                          className="px-2 py-1 text-[11px] rounded border border-border hover:bg-surface-subtle text-text-tertiary hover:text-text-primary"
                        >
                          {u.status === "ACTIVE" ? "Suspend" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CLIENT BLUEPRINT STUDIO */}
      {activeTab === "BLUEPRINT" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-text-primary">Client Configuration Blueprint</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Customize payroll parameters, living envelopes, and budget policies for the selected tenant.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-text-tertiary">Select Client:</label>
              <select
                value={selectedUserId || ""}
                onChange={(e) => setSelectedUserId(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 text-xs rounded border border-border bg-surface text-text-primary font-mono focus:outline-none focus:border-border-strong"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    #{u.id} — {u.fullName} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedUserConfig ? (
            <form onSubmit={handleSaveUserConfig} className="p-6 rounded-lg border border-border bg-surface space-y-6">
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Life-Stage Preset (Ages 20–70)
                  </label>
                  <select
                    value={selectedUserConfig.lifeStagePreset || "CORPORATE_PROFESSIONAL"}
                    onChange={(e) => {
                      const preset = e.target.value as LifeStagePreset;
                      const found = LIFE_STAGE_PRESET_CATALOG.find((p) => p.id === preset);
                      setSelectedUserConfig({
                        ...selectedUserConfig,
                        lifeStagePreset: preset,
                        ...(found
                          ? {
                              uiDensityMode: found.uiDensityMode,
                              formulaEngineType: found.formulaEngineType,
                              enabledModulesJson: found.enabledModules,
                            }
                          : {}),
                      });
                    }}
                    className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                  >
                    <option value="SUPERADMIN_BESPOKE">SUPERADMIN_BESPOKE (Owner ERP)</option>
                    {LIFE_STAGE_PRESET_CATALOG.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.ageRange})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Allocation Formula Engine
                  </label>
                  <select
                    value={selectedUserConfig.formulaEngineType || "DEBT_FIRST_WATERFALL"}
                    onChange={(e) =>
                      setSelectedUserConfig({
                        ...selectedUserConfig,
                        formulaEngineType: e.target.value as FormulaEngineType,
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                  >
                    <option value="DEBT_FIRST_WATERFALL">DEBT_FIRST_WATERFALL (Priority Debt & Living)</option>
                    <option value="SAVINGS_FIRST_LOCK">SAVINGS_FIRST_LOCK (Pay Yourself First)</option>
                    <option value="PERCENTAGE_SPLIT">PERCENTAGE_SPLIT (50/30/20 Ratio)</option>
                    <option value="RETIREMENT_DRAWDOWN">RETIREMENT_DRAWDOWN (Pension & Healthcare)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    UI Density Mode
                  </label>
                  <select
                    value={selectedUserConfig.uiDensityMode || "COMMAND_COCKPIT"}
                    onChange={(e) =>
                      setSelectedUserConfig({
                        ...selectedUserConfig,
                        uiDensityMode: e.target.value as UiDensityMode,
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                  >
                    <option value="COMMAND_COCKPIT">COMMAND_COCKPIT (Full 3-Col ERP)</option>
                    <option value="SIMPLE_CLARITY">SIMPLE_CLARITY (Minimalist / Senior 4-Card)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-5 border-t border-border pt-5">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Payroll Mode
                  </label>
                  <select
                    value={selectedUserConfig.payrollMode || "SIMPLE_FIXED_SALARY"}
                    onChange={(e) =>
                      setSelectedUserConfig({
                        ...selectedUserConfig,
                        payrollMode: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                  >
                    <option value="SIMPLE_FIXED_SALARY">SIMPLE_FIXED_SALARY (Fixed Net Salary)</option>
                    <option value="BESPOKE_ATTENDANCE">BESPOKE_ATTENDANCE (Attendance & Allowances)</option>
                    <option value="PRO_RATA_HOURLY">PRO_RATA_HOURLY (Hourly Timesheet)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Profile Blueprint
                  </label>
                  <select
                    value={selectedUserConfig.profileMode || "STANDARD_GENERAL"}
                    onChange={(e) =>
                      setSelectedUserConfig({
                        ...selectedUserConfig,
                        profileMode: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                  >
                    <option value="STANDARD_GENERAL">STANDARD_GENERAL (Commercial)</option>
                    <option value="SUPERADMIN_BESPOKE">SUPERADMIN_BESPOKE (Bespoke)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Auto-Close Days After Payday
                  </label>
                  <input
                    type="number"
                    value={selectedUserConfig.autoCloseAfterDays ?? 3}
                    onChange={(e) =>
                      setSelectedUserConfig({
                        ...selectedUserConfig,
                        autoCloseAfterDays: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                  />
                </div>
              </div>

              {/* Remote Module Registry Checkboxes */}
              <div className="border-t border-border pt-5">
                <div className="text-xs font-mono uppercase text-text-tertiary mb-3">
                  Enabled ERP Modules (Odoo-Style Tenant Module Registry)
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {MODULE_REGISTRY_CATALOG.map((mod) => {
                    const currentList = Array.isArray(selectedUserConfig.enabledModulesJson)
                      ? selectedUserConfig.enabledModulesJson
                      : [...ALL_MODULE_KEYS];
                    const isChecked = mod.isCore || currentList.includes(mod.key);
                    return (
                      <label
                        key={mod.key}
                        className={`flex items-start gap-2.5 p-2.5 rounded border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? "border-border-strong bg-surface-subtle text-text-primary"
                            : "border-border bg-surface text-text-tertiary"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={mod.isCore}
                          checked={isChecked}
                          onChange={(e) => {
                            if (mod.isCore) return;
                            const next = e.target.checked
                              ? Array.from(new Set([...currentList, mod.key]))
                              : currentList.filter((k) => k !== mod.key);
                            setSelectedUserConfig({
                              ...selectedUserConfig,
                              enabledModulesJson: next,
                            });
                          }}
                          className="mt-0.5 rounded border-border"
                        />
                        <div>
                          <div className="font-medium leading-tight">{mod.label}</div>
                          <div className="text-[10px] font-mono text-text-tertiary mt-0.5">
                            {mod.route}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Envelopes */}
              <div className="border-t border-border pt-5">
                <div className="text-xs font-mono uppercase text-text-tertiary mb-3">
                  Monthly Baseline Allocation Envelopes (IDR)
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] text-text-secondary mb-1">Daily Living</label>
                    <input
                      type="number"
                      value={selectedUserConfig.dailyOperational ?? 0}
                      onChange={(e) =>
                        setSelectedUserConfig({
                          ...selectedUserConfig,
                          dailyOperational: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-secondary mb-1">Transport / Fuel</label>
                    <input
                      type="number"
                      value={selectedUserConfig.transport ?? 0}
                      onChange={(e) =>
                        setSelectedUserConfig({
                          ...selectedUserConfig,
                          transport: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-secondary mb-1">Internet / Utilities</label>
                    <input
                      type="number"
                      value={selectedUserConfig.internet ?? 0}
                      onChange={(e) =>
                        setSelectedUserConfig({
                          ...selectedUserConfig,
                          internet: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-secondary mb-1">Priority 1 Savings</label>
                    <input
                      type="number"
                      value={selectedUserConfig.baseSavings ?? 0}
                      onChange={(e) =>
                        setSelectedUserConfig({
                          ...selectedUserConfig,
                          baseSavings: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 text-xs font-medium rounded border border-border-strong bg-text-primary text-canvas hover:opacity-95 transition-opacity"
                >
                  Save Blueprint Configuration
                </button>
              </div>
            </form>
          ) : (
            <div className="p-8 text-center text-xs text-text-tertiary border border-border rounded-lg bg-surface">
              Select a client account to load and configure their workspace blueprint.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FEATURE REQUESTS INBOX */}
      {activeTab === "REQUESTS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-text-primary">Bespoke Feature Request Tickets</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Review architectural extension proposals submitted by clients, quote delivery fees, and update status.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-subtle border-b border-border text-[10px] font-mono uppercase text-text-tertiary">
                <tr>
                  <th className="px-4 py-3">ID / Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Quote (IDR)</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-sans">
                {featureRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-tertiary">
                      No custom feature requests submitted yet.
                    </td>
                  </tr>
                ) : (
                  featureRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-surface-subtle/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-text-primary">{req.title}</div>
                        <div className="text-[11px] text-text-secondary mt-0.5 line-clamp-1">
                          {req.desiredBehavior}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[10px] text-text-secondary px-2 py-0.5 rounded border border-border">
                          {req.category}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[10px] text-text-tertiary">
                          {req.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded border border-border bg-surface-subtle text-text-primary">
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-text-primary">
                        {req.estimatedSetupFee
                          ? `Rp ${req.estimatedSetupFee.toLocaleString("id-ID")}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRequest(req);
                            setRequestUpdateForm({
                              status: req.status as any,
                              estimatedSetupFee: req.estimatedSetupFee ? String(req.estimatedSetupFee) : "",
                              adminNotes: req.adminNotes || "",
                            });
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium rounded border border-border hover:bg-surface-subtle text-text-primary"
                        >
                          Review & Quote
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SECURITY, IP WHITELIST & FULL BACKUP */}
      {activeTab === "SECURITY" && (
        <div className="space-y-6">
          {/* SECTION 1: DATABASE BACKUP & TRANSACTIONAL RESTORE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export Card */}
            <div className="p-6 rounded-lg border border-border bg-surface flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 text-text-primary font-medium text-sm">
                  <Download className="w-4 h-4 text-text-secondary" />
                  <h3>Export Database Backup</h3>
                </div>
                <p className="text-xs text-text-secondary mt-1">
                  Download a complete, portable JSON snapshot of all 15 relational tables (Users, Snapshots, Credit Cards, Contracts, Transactions, Savings Vault, Goals & Settings).
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded border border-border-strong bg-text-primary text-canvas hover:opacity-95 transition-opacity cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Full Backup (.json)</span>
                </button>
              </div>
            </div>

            {/* Restore Card */}
            <div className="p-6 rounded-lg border border-border bg-surface space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-text-primary font-medium text-sm">
                  <Upload className="w-4 h-4 text-text-secondary" />
                  <h3>Restore / Import Backup (.json)</h3>
                </div>
                {dryRunSummary && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-positive/30 bg-positive/10 text-positive">
                    Dry Run Validated
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary">
                Upload an exported JSON backup file. Step 1 executes a non-destructive Dry Run validation. Step 2 atomically restores data and resets sequence keys.
              </p>

              {/* Step 1: File Upload */}
              <div className="space-y-2">
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleBackupFileChange}
                  disabled={isDryRunValidating || isRestoring}
                  className="w-full text-xs text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-border file:text-xs file:font-medium file:bg-surface-subtle file:text-text-primary hover:file:bg-surface file:cursor-pointer"
                />
                {isDryRunValidating && (
                  <div className="text-[11px] text-text-tertiary flex items-center gap-1.5 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Validating schema integrity (Dry Run)...</span>
                  </div>
                )}
              </div>

              {/* Dry Run Summary Table */}
              {dryRunSummary && (
                <div className="mt-3 p-3.5 rounded border border-border-subtle bg-surface-subtle space-y-3">
                  <div className="text-[11px] font-semibold text-text-primary flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-positive" />
                    <span>Dry-Run Record Inspection Table</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[10px] font-mono">
                    <div className="p-1.5 rounded bg-surface border border-border/60">
                      <div className="text-text-tertiary">Users</div>
                      <div className="text-text-primary font-semibold">{dryRunSummary.users}</div>
                    </div>
                    <div className="p-1.5 rounded bg-surface border border-border/60">
                      <div className="text-text-tertiary">Snapshots</div>
                      <div className="text-text-primary font-semibold">{dryRunSummary.monthlySnapshots}</div>
                    </div>
                    <div className="p-1.5 rounded bg-surface border border-border/60">
                      <div className="text-text-tertiary">CC Rows</div>
                      <div className="text-text-primary font-semibold">{dryRunSummary.creditCardTransactions}</div>
                    </div>
                    <div className="p-1.5 rounded bg-surface border border-border/60">
                      <div className="text-text-tertiary">Transactions</div>
                      <div className="text-text-primary font-semibold">{dryRunSummary.transactions}</div>
                    </div>
                    <div className="p-1.5 rounded bg-surface border border-border/60">
                      <div className="text-text-tertiary">Bulk Bills</div>
                      <div className="text-text-primary font-semibold">{dryRunSummary.monthlyBulkBills}</div>
                    </div>
                    <div className="p-1.5 rounded bg-surface border border-border/60">
                      <div className="text-text-tertiary">Savings Tx</div>
                      <div className="text-text-primary font-semibold">{dryRunSummary.savingsDeposits}</div>
                    </div>
                    <div className="p-1.5 rounded bg-surface border border-border/60">
                      <div className="text-text-tertiary">Goals</div>
                      <div className="text-text-primary font-semibold">{dryRunSummary.savingsGoals}</div>
                    </div>
                    <div className="p-1.5 rounded bg-surface border border-border/60">
                      <div className="text-text-tertiary">Wishlist</div>
                      <div className="text-text-primary font-semibold">{dryRunSummary.wishlistItems}</div>
                    </div>
                  </div>

                  {/* Step 2: Confirmation & PIN for RESTORE_OVERWRITE */}
                  <form onSubmit={handleExecuteRestore} className="pt-2 border-t border-border/60 space-y-3">
                    <div className="text-[11px] text-caution font-medium flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-caution shrink-0" />
                      <span>Type &quot;CONFIRM RESTORE&quot; + 6-digit PIN to overwrite database:</span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={restoreConfirmationText}
                        onChange={(e) => setRestoreConfirmationText(e.target.value)}
                        placeholder='Type "CONFIRM RESTORE"'
                        className="flex-1 px-2.5 py-1 text-xs rounded border border-border bg-surface text-text-primary font-mono focus:outline-none focus:border-border-strong"
                      />
                      <input
                        type="password"
                        required
                        maxLength={6}
                        value={restoreSecurityPin}
                        onChange={(e) => setRestoreSecurityPin(e.target.value)}
                        placeholder="6-Digit PIN"
                        className="w-28 px-2 py-1 text-xs rounded border border-border bg-surface text-text-primary font-mono tracking-widest text-center focus:outline-none focus:border-border-strong"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isRestoring || restoreConfirmationText !== "CONFIRM RESTORE"}
                      className="w-full py-1.5 text-xs font-semibold rounded border border-negative/40 bg-negative/15 text-negative hover:bg-negative/25 disabled:opacity-50 transition-colors"
                    >
                      {isRestoring ? "Executing Atomic Restore..." : "Execute Restore Overwrite"}
                    </button>
                  </form>
                </div>
              )}

              {restoreSuccessCounts && (
                <div className="p-3 rounded border border-positive/30 bg-positive/10 text-positive text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Database Restored Successfully!</span>
                  </div>
                  <div className="text-[11px] opacity-90">
                    Restored {restoreSuccessCounts.monthlySnapshots} snapshots, {restoreSuccessCounts.creditCardTransactions} credit cards, and {restoreSuccessCounts.transactions} transactions. PostgreSQL sequence primary keys reset.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: OWNER CREDENTIALS & SECURITY PIN CARD */}
          <div className="p-6 rounded-lg border border-border bg-surface space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-text-secondary" />
                  <h3 className="text-sm font-medium text-text-primary">
                    Platform Owner Credentials & Security Hardening
                  </h3>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  Update your Superadmin sign-in email, password, and 6-digit emergency Security PIN.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {securitySettings?.isDefaultPassword && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-caution/30 bg-caution/10 text-caution">
                    Default Password Active
                  </span>
                )}
                {securitySettings?.isDefaultPin && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-caution/30 bg-caution/10 text-caution">
                    Default PIN (123456)
                  </span>
                )}
                {!securitySettings?.isDefaultPassword && !securitySettings?.isDefaultPin && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-positive/30 bg-positive/10 text-positive flex items-center gap-1">
                    <Check className="w-3 h-3" /> Credentials Hardened
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleUpdateOwnerCredentials} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Current Password <span className="text-negative">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={credentialForm.currentPassword}
                    onChange={(e) => setCredentialForm({ ...credentialForm, currentPassword: e.target.value })}
                    placeholder="Enter current password to verify identity"
                    className="w-full px-3 py-1.5 text-xs rounded border border-border bg-surface-subtle text-text-primary focus:outline-none focus:border-border-strong"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Owner Email (Optional update)
                  </label>
                  <input
                    type="email"
                    value={credentialForm.newEmail}
                    onChange={(e) => setCredentialForm({ ...credentialForm, newEmail: e.target.value })}
                    placeholder={securitySettings?.ownerEmail || "owner@sundayfunday.id"}
                    className="w-full px-3 py-1.5 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono focus:outline-none focus:border-border-strong"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    New Password (Optional, min 8 characters)
                  </label>
                  <input
                    type="password"
                    minLength={8}
                    value={credentialForm.newPassword}
                    onChange={(e) => setCredentialForm({ ...credentialForm, newPassword: e.target.value })}
                    placeholder="Leave blank to keep existing password"
                    className="w-full px-3 py-1.5 text-xs rounded border border-border bg-surface-subtle text-text-primary focus:outline-none focus:border-border-strong"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    New 6-Digit Security PIN (Optional)
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={credentialForm.newSecurityPin}
                    onChange={(e) => setCredentialForm({ ...credentialForm, newSecurityPin: e.target.value })}
                    placeholder="Leave blank to keep existing PIN"
                    className="w-full px-3 py-1.5 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono tracking-widest focus:outline-none focus:border-border-strong"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isUpdatingCredentials || !credentialForm.currentPassword}
                  className="px-4 py-2 text-xs font-medium rounded border border-border-strong bg-text-primary text-canvas hover:opacity-95 disabled:opacity-50 transition-opacity"
                >
                  {isUpdatingCredentials ? "Updating Credentials..." : "Update Owner Credentials"}
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 3: IP WHITELIST CONTROL */}
          <div className="p-6 rounded-lg border border-border bg-surface space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-sm font-medium text-text-primary">
                  Strict IP Whitelist Guard
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  When enabled, Platform Owner logins from untrusted IPs strictly require the 6-digit Security PIN.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-text-tertiary">
                  Current Status:{" "}
                  <strong className="text-text-primary">
                    {securitySettings?.ipWhitelistEnforced ? "ENABLED" : "DISABLED"}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleToggleIpWhitelist(!securitySettings?.ipWhitelistEnforced)
                  }
                  className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                    securitySettings?.ipWhitelistEnforced
                      ? "border-positive/30 bg-positive/10 text-positive hover:bg-positive/20"
                      : "border-border bg-surface-subtle text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {securitySettings?.ipWhitelistEnforced ? "Disable Enforcement" : "Enable Strict Whitelist"}
                </button>
              </div>
            </div>

            {/* Current Client IP Detected */}
            <div className="flex items-center justify-between p-3 rounded-md bg-surface-subtle border border-border">
              <div>
                <div className="text-[10px] font-mono uppercase text-text-tertiary">
                  Your Current Detected IP
                </div>
                <div className="text-sm font-mono text-text-primary font-medium mt-0.5">
                  {securitySettings?.detectedClientIp || "127.0.0.1"}
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (!securitySettings?.detectedClientIp) return;
                  await addAdminTrustedIp({
                    ipAddress: securitySettings.detectedClientIp,
                    label: `Admin Session (${securitySettings.detectedClientIp})`,
                  });
                  const sec = await fetchAdminSecuritySettings();
                  setSecuritySettings(sec);
                  setStatusMessage({ type: "success", text: "Whitelisted your current IP address." });
                }}
                className="px-3 py-1.5 text-xs font-medium rounded border border-border bg-surface hover:bg-surface-subtle text-text-primary transition-colors"
              >
                + Whitelist My Current IP
              </button>
            </div>

            {/* Whitelisted IPs Table */}
            <div>
              <div className="text-xs font-mono uppercase text-text-tertiary mb-2">
                Trusted Network Addresses
              </div>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface-subtle text-[10px] font-mono uppercase text-text-tertiary border-b border-border">
                    <tr>
                      <th className="px-4 py-2.5">IP Address</th>
                      <th className="px-4 py-2.5">Label</th>
                      <th className="px-4 py-2.5">Created</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-sans">
                    {(securitySettings?.trustedIps || []).map((ip) => (
                      <tr key={ip.id} className="hover:bg-surface-subtle/50">
                        <td className="px-4 py-2.5 font-mono text-text-primary">{ip.ipAddress}</td>
                        <td className="px-4 py-2.5 text-text-secondary">{ip.label}</td>
                        <td className="px-4 py-2.5 text-[11px] text-text-tertiary">
                          {ip.createdAt ? new Date(ip.createdAt).toISOString().split("T")[0] : ""}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveTrustedIp(ip.id)}
                            className="text-text-tertiary hover:text-negative transition-colors"
                            title="Remove IP"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add IP Manually */}
            <form onSubmit={handleAddTrustedIp} className="flex gap-2 items-center pt-2">
              <input
                type="text"
                placeholder="IP Address (e.g. 192.168.1.50)"
                value={newIpAddress}
                onChange={(e) => setNewIpAddress(e.target.value)}
                className="px-3 py-1.5 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono focus:outline-none focus:border-border-strong"
              />
              <input
                type="text"
                placeholder="Label (e.g. Office Router)"
                value={newIpLabel}
                onChange={(e) => setNewIpLabel(e.target.value)}
                className="px-3 py-1.5 text-xs rounded border border-border bg-surface-subtle text-text-primary font-sans focus:outline-none focus:border-border-strong flex-1"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs rounded border border-border hover:bg-surface-subtle text-text-primary font-medium"
              >
                + Add IP
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PROVISION CLIENT ACCOUNT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-canvas/85 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-medium text-text-primary">Provision New Client Account</h3>
            <p className="text-xs text-text-secondary mt-1">
              Create an isolated tenant workspace with tailored blueprint defaults.
            </p>

            <form onSubmit={handleCreateClient} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Account Name (Tenant)
                  </label>
                  <input
                    type="text"
                    value={createForm.accountName}
                    onChange={(e) => setCreateForm({ ...createForm, accountName: e.target.value })}
                    placeholder="e.g. acme (defaults to client)"
                    className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    placeholder="e.g. jdoe (defaults to email)"
                    className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    placeholder="e.g. John Client"
                    className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="client@domain.com"
                    className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Role</label>
                  <select
                    value={createForm.role}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, role: e.target.value as UserRole })
                    }
                    className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                  >
                    <option value="BESPOKE_CLIENT">BESPOKE_CLIENT</option>
                    <option value="STANDARD_MEMBER">STANDARD_MEMBER</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Initial Blueprint
                  </label>
                  <select
                    value={createForm.blueprintType}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        blueprintType: e.target.value as BlueprintType,
                      })
                    }
                    className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                  >
                    <option value="STANDARD_GENERAL">STANDARD_GENERAL (Commercial)</option>
                    <option value="SUPERADMIN_BESPOKE">SUPERADMIN_BESPOKE (Bespoke)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Life-Stage Preset (Ages 20–70)
                </label>
                <select
                  value={createForm.lifeStagePreset}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      lifeStagePreset: e.target.value as LifeStagePreset,
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                >
                  {LIFE_STAGE_PRESET_CATALOG.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.ageRange})
                    </option>
                  ))}
                  <option value="SUPERADMIN_BESPOKE">SUPERADMIN_BESPOKE (Bespoke)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Initial Monthly Base Salary (IDR)
                </label>
                <input
                  type="number"
                  value={createForm.initialSalary}
                  onChange={(e) => setCreateForm({ ...createForm, initialSalary: e.target.value })}
                  placeholder="12000000"
                  className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="initSnapshot"
                  checked={createForm.initializeFirstPeriod}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, initializeFirstPeriod: e.target.checked })
                  }
                  className="rounded border-border text-text-primary"
                />
                <label htmlFor="initSnapshot" className="text-xs text-text-secondary cursor-pointer">
                  Auto-initialize first period snapshot (10/2026) with baseline envelopes
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-2 text-xs rounded border border-border hover:bg-surface-subtle text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 text-xs font-medium rounded border border-border-strong bg-text-primary text-canvas hover:opacity-95"
                >
                  Provision Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW & QUOTE FEATURE REQUEST DRAWER */}
      {editingRequest && (
        <div className="fixed inset-0 bg-canvas/85 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-medium text-text-primary">
              Review Request #{editingRequest.id}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">{editingRequest.title}</p>

            <form onSubmit={handleSaveFeatureRequest} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Status
                </label>
                <select
                  value={requestUpdateForm.status}
                  onChange={(e) =>
                    setRequestUpdateForm({ ...requestUpdateForm, status: e.target.value as any })
                  }
                  className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                >
                  <option value="SUBMITTED">SUBMITTED</option>
                  <option value="IN_REVIEW">IN_REVIEW</option>
                  <option value="APPROVED_QUOTED">APPROVED_QUOTED</option>
                  <option value="IMPLEMENTED">IMPLEMENTED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Quoted Setup Fee (IDR)
                </label>
                <input
                  type="number"
                  value={requestUpdateForm.estimatedSetupFee}
                  onChange={(e) =>
                    setRequestUpdateForm({
                      ...requestUpdateForm,
                      estimatedSetupFee: e.target.value,
                    })
                  }
                  placeholder="2500000"
                  className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Assessment & Engineering Notes
                </label>
                <textarea
                  rows={3}
                  value={requestUpdateForm.adminNotes}
                  onChange={(e) =>
                    setRequestUpdateForm({ ...requestUpdateForm, adminNotes: e.target.value })
                  }
                  placeholder="Technical scope, delivery milestones, or architecture notes for the client..."
                  className="w-full px-3 py-2 text-xs rounded border border-border bg-surface-subtle text-text-primary font-sans focus:outline-none focus:border-border-strong"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingRequest(null)}
                  className="px-3.5 py-2 text-xs rounded border border-border hover:bg-surface-subtle text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 text-xs font-medium rounded border border-border-strong bg-text-primary text-canvas hover:opacity-95"
                >
                  Save Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
