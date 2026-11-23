"use client";

import React, { useEffect, useState } from "react";
import { KeyRound, RefreshCw, ShieldCheck, Copy, Check } from "lucide-react";
import {
  MarqueeAiProvider,
  MarqueeConfigResponse,
  fetchMarqueeConfig,
  rotateMarqueeWebhookToken,
  updateMarqueeConfig,
} from "@/lib/api";

export function MarqueeAiSettingsPanel() {
  const [config, setConfig] = useState<MarqueeConfigResponse | null>(null);
  const [provider, setProvider] = useState<MarqueeAiProvider>("TIER1_ONLY");
  const [geminiKey, setGeminiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [deepseekModel, setDeepseekModel] = useState<"deepseek-chat" | "deepseek-flash" | "deepseek-reasoner">("deepseek-flash");
  const [opencodeKey, setOpencodeKey] = useState("");
  const [opencodeBaseUrl, setOpencodeBaseUrl] = useState("https://api.opencode.ai/v1");
  const [opencodeModel, setOpencodeModel] = useState("opencode-chat");
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [rawTokenOnce, setRawTokenOnce] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    void fetchMarqueeConfig().then((res) => {
      if (res) {
        setConfig(res);
        setProvider(res.provider);
        setWebhookEnabled(res.webhookEnabled);
        if (res.deepseekModel) setDeepseekModel(res.deepseekModel);
        if (res.opencodeBaseUrl) setOpencodeBaseUrl(res.opencodeBaseUrl);
        if (res.opencodeModel) setOpencodeModel(res.opencodeModel);
      }
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    const res = await updateMarqueeConfig({
      provider,
      webhookEnabled,
      deepseekModel,
      opencodeBaseUrl: opencodeBaseUrl.trim() || "https://api.opencode.ai/v1",
      opencodeModel: opencodeModel.trim() || "opencode-chat",
      ...(geminiKey.trim() ? { geminiApiKey: geminiKey.trim() } : {}),
      ...(groqKey.trim() ? { groqApiKey: groqKey.trim() } : {}),
      ...(deepseekKey.trim() ? { deepseekApiKey: deepseekKey.trim() } : {}),
      ...(opencodeKey.trim() ? { opencodeApiKey: opencodeKey.trim() } : {}),
    });
    setSaving(false);
    if (res) {
      setConfig(res);
      setGeminiKey("");
      setGroqKey("");
      setDeepseekKey("");
      setOpencodeKey("");
      setFeedback("Marquee AI configuration encrypted with AES-256-GCM and saved.");
    } else {
      setFeedback("Failed to save Marquee AI configuration.");
    }
  };

  const handleRotateToken = async () => {
    setRotating(true);
    setFeedback(null);
    const res = await rotateMarqueeWebhookToken();
    setRotating(false);
    if (res) {
      setRawTokenOnce(res.token);
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              hasWebhookToken: true,
              webhookTokenPreview: res.webhookTokenPreview,
              webhookEnabled: true,
            }
          : prev,
      );
      setFeedback("New headless X-Marquee-Token generated. Copy it now - only its SHA-256 hash is stored.");
    }
  };

  const copyToken = async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 1800);
    } catch {}
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSave}
        className="rounded-lg border border-border bg-surface p-5 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Marquee AI Provider &amp; Encrypted BYOK Storage
            </h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              Tier 1 deterministic NLU always runs in-process; enable DeepSeek, OpenCode, Gemini 3.8 Flash, or Groq Llama 3.3 70B with AES-256-GCM encrypted keys.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-delta-positive">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>AES-256-GCM Encrypted at Rest</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {(
            [
              {
                key: "DEEPSEEK",
                title: "Tier 2 · DeepSeek (V3 / R1)",
                desc: "Native DeepSeek tool calling (deepseek-flash, deepseek-chat, or deepseek-reasoner) with full ledger hydration.",
              },
              {
                key: "OPENCODE",
                title: "Tier 2 · OpenCode Compatible",
                desc: "OpenCode Zen / OpenAI-compatible tool router with configurable base endpoint and model.",
              },
              {
                key: "GEMINI",
                title: "Tier 2 · Gemini 3.8 Flash",
                desc: "Uses @google/genai interactions API with strict function tools.",
              },
              {
                key: "GROQ",
                title: "Tier 2 · Groq Llama 3.3 70B",
                desc: "Low-latency llama-3.3-70b-versatile tool calling with Tier 1 fallback.",
              },
              {
                key: "AUTO",
                title: "Auto Cascade (Multi-Provider)",
                desc: "Tries DeepSeek -> OpenCode -> Gemini -> Groq -> Tier 1 NLU automatically.",
              },
              {
                key: "TIER1_ONLY",
                title: "Tier 1 Deterministic NLU",
                desc: "Zero-latency offline EN/ID/ZH parser. Zero external API calls.",
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setProvider(opt.key)}
              className={`text-left rounded p-3.5 cursor-pointer transition-colors ${
                provider === opt.key
                  ? "erp-surface-selected"
                  : "border border-border-subtle bg-canvas/50 hover:border-border-strong"
              }`}
            >
              <div className="font-semibold text-text-primary">{opt.title}</div>
              <div className="text-[11px] text-text-tertiary mt-1">{opt.desc}</div>
            </button>
          ))}
        </div>

        {/* DeepSeek & OpenCode Credentials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2 border-t border-border-subtle">
          <div className="space-y-2">
            <label htmlFor="marquee-deepseek-key" className="block font-medium text-text-secondary">
              DeepSeek API Key ({config?.hasDeepseekKey ? `Saved: ${config.deepseekKeyPreview}` : "Not set"})
            </label>
            <input
              id="marquee-deepseek-key"
              type="password"
              value={deepseekKey}
              onChange={(e) => setDeepseekKey(e.target.value)}
              placeholder={config?.hasDeepseekKey ? "Enter new key to replace saved key" : "sk-..."}
              className="w-full bg-canvas border border-border rounded px-3 py-2 font-mono text-xs text-text-primary"
            />
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-mono text-text-tertiary">Model:</span>
              <select
                aria-label="DeepSeek Model"
                value={deepseekModel}
                onChange={(e) =>
                  setDeepseekModel(
                    e.target.value as "deepseek-chat" | "deepseek-flash" | "deepseek-reasoner"
                  )
                }
                className="bg-canvas border border-border rounded px-2 py-1 font-mono text-[11px] text-text-primary"
              >
                <option value="deepseek-flash">deepseek-flash (DeepSeek-V4.1-Flash)</option>
                <option value="deepseek-chat">deepseek-chat (DeepSeek-V4.1 Alias)</option>
                <option value="deepseek-reasoner">deepseek-reasoner (DeepSeek-R1)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="marquee-opencode-key" className="block font-medium text-text-secondary">
              OpenCode API Key ({config?.hasOpencodeKey ? `Saved: ${config.opencodeKeyPreview}` : "Not set"})
            </label>
            <input
              id="marquee-opencode-key"
              type="password"
              value={opencodeKey}
              onChange={(e) => setOpencodeKey(e.target.value)}
              placeholder={config?.hasOpencodeKey ? "Enter new key to replace saved key" : "oc-..."}
              className="w-full bg-canvas border border-border rounded px-3 py-2 font-mono text-xs text-text-primary"
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <input
                type="text"
                aria-label="OpenCode Base URL"
                value={opencodeBaseUrl}
                onChange={(e) => setOpencodeBaseUrl(e.target.value)}
                placeholder="https://api.opencode.ai/v1"
                className="bg-canvas border border-border rounded px-2 py-1 font-mono text-[11px] text-text-primary"
              />
              <input
                type="text"
                aria-label="OpenCode Model"
                value={opencodeModel}
                onChange={(e) => setOpencodeModel(e.target.value)}
                placeholder="opencode-chat"
                className="bg-canvas border border-border rounded px-2 py-1 font-mono text-[11px] text-text-primary"
              />
            </div>
          </div>
        </div>

        {/* Gemini & Groq Credentials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2 border-t border-border-subtle">
          <div className="space-y-1.5">
            <label htmlFor="marquee-gemini-key" className="block font-medium text-text-secondary">
              Gemini API Key ({config?.hasGeminiKey ? `Saved: ${config.geminiKeyPreview}` : "Not set"})
            </label>
            <input
              id="marquee-gemini-key"
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder={config?.hasGeminiKey ? "Enter new key to replace saved key" : "AIza..."}
              className="w-full bg-canvas border border-border rounded px-3 py-2 font-mono text-xs text-text-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="marquee-groq-key" className="block font-medium text-text-secondary">
              Groq API Key ({config?.hasGroqKey ? `Saved: ${config.groqKeyPreview}` : "Not set"})
            </label>
            <input
              id="marquee-groq-key"
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder={config?.hasGroqKey ? "Enter new key to replace saved key" : "gsk_..."}
              className="w-full bg-canvas border border-border rounded px-3 py-2 font-mono text-xs text-text-primary"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border-subtle">
          <label className="inline-flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={webhookEnabled}
              onChange={(e) => setWebhookEnabled(e.target.checked)}
              className="rounded border-border"
            />
            <span>Enable headless quick-capture webhook (POST /api/marquee/webhook)</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded erp-btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Encrypting & Saving..." : "Save AI Configuration"}
          </button>
        </div>

        {feedback && (
          <div className="px-3 py-2 rounded border border-delta-positive/40 bg-[rgba(16,183,141,0.08)] text-xs font-mono text-delta-positive">
            {feedback}
          </div>
        )}
      </form>

      {/* Tier 3 Webhook Token Manager */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <KeyRound className="w-4 h-4 text-text-tertiary" />
              <span>Headless Quick-Capture Webhook (Tier 3 · X-Marquee-Token)</span>
            </div>
            <p className="text-xs text-text-tertiary mt-0.5">
              Trigger Marquee from iOS Shortcuts, Telegram, or terminal scripts using a per-user SHA-256 hashed bearer secret.
            </p>
          </div>
          <button
            type="button"
            disabled={rotating}
            onClick={() => void handleRotateToken()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-canvas hover:bg-surface-hover text-xs font-mono text-text-primary cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rotating ? "animate-spin" : ""}`} />
            <span>{config?.hasWebhookToken ? "Rotate Token" : "Generate Token"}</span>
          </button>
        </div>

        <div className="text-xs font-mono text-text-secondary">
          Active Token:{" "}
          <span className="text-text-primary">
            {config?.hasWebhookToken ? config.webhookTokenPreview : "None generated"}
          </span>
        </div>

        {rawTokenOnce && (
          <div className="rounded erp-callout-caution p-3 space-y-2 text-xs">
            <div className="font-mono text-caution font-semibold">
              Copy this token now (displayed once only):
            </div>
            <div className="flex items-center justify-between gap-2 bg-canvas border border-border rounded px-3 py-2 font-mono text-text-primary">
              <span className="truncate">{rawTokenOnce}</span>
              <button
                type="button"
                onClick={() => void copyToken(rawTokenOnce)}
                className="inline-flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary shrink-0 cursor-pointer"
              >
                {copiedToken ? <Check className="w-3.5 h-3.5 text-delta-positive" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedToken ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
        )}

        <pre className="p-3 rounded border border-border-subtle bg-canvas text-[11px] font-mono text-text-secondary overflow-x-auto">
{`curl -X POST https://sundayfunday-api.vercel.app/api/marquee/webhook \\
  -H "Content-Type: application/json" \\
  -H "X-Marquee-Token: ${rawTokenOnce || "<YOUR_MRQ_TOKEN>"}" \\
  -d '{"message":"log kopi 32k","autoConfirm":true}'`}
        </pre>
      </div>

      {/* Model Context Protocol (MCP) Server */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <div>
            <div className="text-sm font-semibold text-text-primary">
              Sunday Funday MCP Server (JSON-RPC 2.0 · Business Functions Only)
            </div>
            <p className="text-xs text-text-tertiary mt-0.5">
              Connect Claude Desktop, Cursor, or Antigravity via Streamable HTTP or the local stdio bridge using your{" "}
              <code className="font-mono text-text-secondary">X-Marquee-Token</code>. Exposes strictly curated financial functions with zero shell or raw SQL access.
            </p>
          </div>
          <span className="px-2 py-0.5 rounded border border-border bg-canvas text-[10px] font-mono text-delta-positive">
            15 Curated ERP Tools · Isolated per userId
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="rounded border border-border-subtle bg-canvas/70 p-3 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
              Streamable HTTP MCP Endpoint
            </div>
            <div className="font-mono text-text-primary break-all">
              https://sundayfunday-api.vercel.app/api/marquee/mcp
            </div>
          </div>
          <div className="rounded border border-border-subtle bg-canvas/70 p-3 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
              Authentication Header
            </div>
            <div className="font-mono text-text-primary">
              X-Marquee-Token: {rawTokenOnce || config?.webhookTokenPreview || "<Generate token above>"}
            </div>
          </div>
        </div>

        <pre className="p-3 rounded border border-border-subtle bg-canvas text-[11px] font-mono text-text-secondary overflow-x-auto">
{`{
  "mcpServers": {
    "sundayfunday-erp": {
      "command": "npx",
      "args": ["tsx", "scripts/sundayfunday-mcp.ts"],
      "env": {
        "SUNDAYFUNDAY_API_URL": "https://sundayfunday-api.vercel.app",
        "SUNDAYFUNDAY_MARQUEE_TOKEN": "${rawTokenOnce || "<YOUR_MRQ_TOKEN>"}"
      }
    }
  }
}`}
        </pre>
      </div>
    </div>
  );
}
