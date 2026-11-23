import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  decryptSecret,
  encryptSecret,
  generateMarqueeToken,
  hashSecretToken,
  maskSecretPreview,
  verifySecretToken,
} from '../common/crypto.util';
import { MarqueeToolName, parseMarqueeIntent } from './marquee-nlu';
import {
  MARQUEE_TOOL_DEFS,
  MarqueeAiProvider,
  MarqueeLlmService,
} from './marquee-llm.service';

const MCP_EXPOSED_TOOLS = new Set<string>([
  'get_paycycle_pulse',
  'simulate_purchase_cutoff',
  'optimize_payday_thr_split',
  'analyze_debt_burndown',
  'evaluate_custom_formula',
  'prepare_quick_transaction',
  'prepare_wallet_checkin',
  'explain_period_variance',
  'manage_liability_item',
  'revise_budget_or_quota',
  'manage_savings_pocket_or_goal',
  'manage_wishlist_or_subscription',
  'run_what_if_scenario',
  'manage_user_memory',
  'search_financial_history',
]);
import {
  MarqueePendingAction,
  MarqueeToolResult,
  MarqueeToolsService,
} from './marquee-tools.service';
import {
  MarqueeContextHydrator,
  MarqueeFinancialContext,
  MarqueeProactiveReminder,
} from './marquee-context.service';

const HUMAN_TOOL_LABELS: Record<string, string> = {
  log_quick_expense: 'Log expense entry',
  get_paycycle_pulse: 'Checked active paycycle balance and daily safe-to-spend',
  get_due_schedule: 'Checked scheduled bill maturities and due dates',
  explain_period_variance: 'Compared income, bills, and savings across periods',
  simulate_cutoff: 'Simulated statement cutoff and monthly billing period',
  simulate_purchase_cutoff: 'Simulated statement cutoff and monthly billing period',
  prepare_quick_transaction: 'Prepared expense entry with statement cutoff routing',
  manage_liability_item: 'Prepared liability schedule adjustment',
  revise_budget_or_quota: 'Prepared monthly budget allocation revision',
  manage_savings_pocket_or_goal: 'Prepared savings allocation adjustment',
  manage_wishlist_or_subscription: 'Prepared wishlist or recurring item update',
  run_what_if_scenario: 'Ran debt payoff and cashflow projection',
  evaluate_formula: 'Evaluated custom formula expression',
  calculate_life_energy: 'Calculated real hourly wage and work-hours cost',
  manage_user_memory: 'Updated personal financial preference memory',
  search_financial_history: 'Searched historical ledger & card archive',
  refuse_out_of_scope: 'Enforced Sunday Funday financial domain boundary',
};

const TOOL_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bprepare_quick_transaction\b/g, 'the expense staging helper'],
  [/\bsimulate_purchase_cutoff\b/g, 'the cutoff simulator'],
  [/\bsimulate_cutoff\b/g, 'the cutoff simulator'],
  [/\blog_quick_expense\b/g, 'expense entry'],
  [/\bget_paycycle_pulse\b/g, 'paycycle balance check'],
  [/\bget_due_schedule\b/g, 'due-date schedule lookup'],
  [/\bexplain_period_variance\b/g, 'cycle variance comparison'],
  [/\bmanage_liability_item\b/g, 'liability schedule editor'],
  [/\brevise_budget_or_quota\b/g, 'quota revision helper'],
  [/\bmanage_savings_pocket_or_goal\b/g, 'savings allocation helper'],
  [/\bmanage_wishlist_or_subscription\b/g, 'wishlist and recurring helper'],
  [/\brun_what_if_scenario\b/g, 'what-if scenario simulator'],
  [/\bmanage_user_memory\b/g, 'preference memory helper'],
  [/\bsearch_financial_history\b/g, 'historical archive search'],
  [/\brefuse_out_of_scope\b/g, 'domain boundary guard'],
  [/\bpurchaseDate\b/g, 'purchase date'],
  [/\bdaysInMonth\b/g, 'days in month'],
];

function sanitizeReasoningForUi(text?: string): string | undefined {
  if (!text) return undefined;
  let cleaned = text;
  for (const [rx, replacement] of TOOL_TEXT_REPLACEMENTS) {
    cleaned = cleaned.replace(rx, replacement);
  }
  return cleaned;
}

const HUMAN_ACTION_LABELS: Record<string, string> = {
  RECORD_TRANSACTION: 'Ready to record expense entry',
  MUTATE_LIABILITY_ITEM: 'Ready to update liability schedule',
  REVISE_BUDGET: 'Ready to update monthly allocation',
  MUTATE_SAVINGS: 'Ready to update savings allocation',
  MUTATE_WISHLIST: 'Ready to update wishlist or subscription',
};

function describeToolAction(toolName: string): string {
  return HUMAN_TOOL_LABELS[toolName] ?? 'Verified financial ledger calculation';
}

export interface StoredMarqueeConfig {
  provider?: MarqueeAiProvider;
  geminiApiKeyEnc?: string;
  geminiKeyPreview?: string;
  groqApiKeyEnc?: string;
  groqKeyPreview?: string;
  deepseekApiKeyEnc?: string;
  deepseekKeyPreview?: string;
  deepseekModel?: 'deepseek-chat' | 'deepseek-flash' | 'deepseek-reasoner';
  opencodeApiKeyEnc?: string;
  opencodeKeyPreview?: string;
  opencodeBaseUrl?: string;
  opencodeModel?: string;
  webhookTokenHash?: string;
  webhookTokenPreview?: string;
  webhookEnabled?: boolean;
  updatedAt?: string;
}

export interface MarqueeConfigResponse {
  provider: MarqueeAiProvider;
  hasGeminiKey: boolean;
  geminiKeyPreview: string;
  hasGroqKey: boolean;
  groqKeyPreview: string;
  hasDeepseekKey: boolean;
  deepseekKeyPreview: string;
  deepseekModel: 'deepseek-chat' | 'deepseek-flash' | 'deepseek-reasoner';
  hasOpencodeKey: boolean;
  opencodeKeyPreview: string;
  opencodeBaseUrl: string;
  opencodeModel: string;
  hasWebhookToken: boolean;
  webhookTokenPreview: string;
  webhookEnabled: boolean;
  geminiModel: string;
  groqModel: string;
}

export interface MarqueeChatRequestDto {
  message: string;
  confirm?: boolean;
  pendingAction?: MarqueePendingAction;
  month?: number;
  year?: number;
  locale?: 'en' | 'id' | 'zh';
  activeRoute?: string;
  activeSubTab?: string | null;
}

export interface MarqueeAgentStep {
  id: string;
  label: string;
  detail: string;
  status: 'done' | 'active';
  durationMs?: number;
}

export interface MarqueeStreamStatusEvent {
  type: 'status';
  phase: 'THINKING' | 'HYDRATING' | 'ANALYZING' | 'STAGING';
  label: string;
  detail: string;
  timestamp: string;
}

export interface MarqueeChatResponse extends MarqueeToolResult {
  tierUsed:
    | 'TIER1_NLU'
    | 'TIER2_GEMINI'
    | 'TIER2_GROQ'
    | 'TIER2_DEEPSEEK'
    | 'TIER2_OPENCODE'
    | 'CONFIRMED_EXECUTION';
  model: string;
  locale: 'en' | 'id' | 'zh';
  assistantPrefix?: string;
  reasoning?: string;
  agentSteps?: MarqueeAgentStep[];
  proactiveReminders?: MarqueeProactiveReminder[];
  hydratedContext?: {
    periodTag: string;
    cycleTemporalState: 'PRE_PAYDAY' | 'ACTIVE' | 'COMPLETED';
    cycleDateLabel: string;
    activeRoute: string;
    activeSubTab: string | null;
    canonicalDueDays: number[];
  };
}

@Injectable()
export class MarqueeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly toolsService: MarqueeToolsService,
    private readonly llmService: MarqueeLlmService,
    @Optional() private readonly contextHydrator?: MarqueeContextHydrator,
  ) {}

  private extractStoredConfig(financialPolicyJson: any): StoredMarqueeConfig {
    if (!financialPolicyJson || typeof financialPolicyJson !== 'object') return {};
    const m = (financialPolicyJson as Record<string, any>).marqueeAi;
    return m && typeof m === 'object' ? (m as StoredMarqueeConfig) : {};
  }

  async getConfig(userId: number): Promise<MarqueeConfigResponse> {
    const cfg = await this.prisma.globalConfig.findFirst({ where: { userId } });
    const stored = this.extractStoredConfig(cfg?.financialPolicyJson);
    return {
      provider: stored.provider ?? 'TIER1_ONLY',
      hasGeminiKey: Boolean(stored.geminiApiKeyEnc),
      geminiKeyPreview: stored.geminiKeyPreview ?? '',
      hasGroqKey: Boolean(stored.groqApiKeyEnc),
      groqKeyPreview: stored.groqKeyPreview ?? '',
      hasDeepseekKey: Boolean(stored.deepseekApiKeyEnc),
      deepseekKeyPreview: stored.deepseekKeyPreview ?? '',
      deepseekModel: stored.deepseekModel ?? 'deepseek-chat',
      hasOpencodeKey: Boolean(stored.opencodeApiKeyEnc),
      opencodeKeyPreview: stored.opencodeKeyPreview ?? '',
      opencodeBaseUrl: stored.opencodeBaseUrl || 'https://opencode.ai/zen/v1',
      opencodeModel: stored.opencodeModel || 'deepseek-v4.1-flash-free',
      hasWebhookToken: Boolean(stored.webhookTokenHash),
      webhookTokenPreview: stored.webhookTokenPreview ?? '',
      webhookEnabled: stored.webhookEnabled ?? true,
      geminiModel: 'gemini-3.8-flash',
      groqModel: 'llama-3.3-70b-versatile',
    };
  }

  async updateConfig(
    userId: number,
    dto: {
      provider?: MarqueeAiProvider;
      geminiApiKey?: string | null;
      groqApiKey?: string | null;
      deepseekApiKey?: string | null;
      deepseekModel?: 'deepseek-chat' | 'deepseek-flash' | 'deepseek-reasoner';
      opencodeApiKey?: string | null;
      opencodeBaseUrl?: string | null;
      opencodeModel?: string | null;
      webhookEnabled?: boolean;
    },
  ): Promise<MarqueeConfigResponse> {
    const cfg = await this.prisma.globalConfig.findFirst({ where: { userId } });
    const policy =
      cfg?.financialPolicyJson && typeof cfg.financialPolicyJson === 'object'
        ? { ...(cfg.financialPolicyJson as Record<string, any>) }
        : {};
    const nextStored: StoredMarqueeConfig = {
      ...this.extractStoredConfig(policy),
      updatedAt: new Date().toISOString(),
    };

    if (dto.provider) {
      nextStored.provider = dto.provider;
    }
    if (dto.webhookEnabled !== undefined) {
      nextStored.webhookEnabled = Boolean(dto.webhookEnabled);
    }
    if (
      dto.deepseekModel === 'deepseek-chat' ||
      dto.deepseekModel === 'deepseek-flash' ||
      dto.deepseekModel === 'deepseek-reasoner'
    ) {
      nextStored.deepseekModel = dto.deepseekModel;
    }
    if (dto.opencodeBaseUrl !== undefined) {
      const cleanUrl = String(dto.opencodeBaseUrl ?? '').trim();
      nextStored.opencodeBaseUrl = cleanUrl || 'https://api.opencode.ai/v1';
    }
    if (dto.opencodeModel !== undefined) {
      const cleanModel = String(dto.opencodeModel ?? '').trim();
      nextStored.opencodeModel = cleanModel || 'opencode-chat';
    }

    if (dto.geminiApiKey !== undefined) {
      const clean = String(dto.geminiApiKey ?? '').trim();
      if (!clean) {
        delete nextStored.geminiApiKeyEnc;
        delete nextStored.geminiKeyPreview;
      } else {
        nextStored.geminiApiKeyEnc = encryptSecret(clean);
        nextStored.geminiKeyPreview = maskSecretPreview(clean);
      }
    }

    if (dto.groqApiKey !== undefined) {
      const clean = String(dto.groqApiKey ?? '').trim();
      if (!clean) {
        delete nextStored.groqApiKeyEnc;
        delete nextStored.groqKeyPreview;
      } else {
        nextStored.groqApiKeyEnc = encryptSecret(clean);
        nextStored.groqKeyPreview = maskSecretPreview(clean);
      }
    }

    if (dto.deepseekApiKey !== undefined) {
      const clean = String(dto.deepseekApiKey ?? '').trim();
      if (!clean) {
        delete nextStored.deepseekApiKeyEnc;
        delete nextStored.deepseekKeyPreview;
      } else {
        nextStored.deepseekApiKeyEnc = encryptSecret(clean);
        nextStored.deepseekKeyPreview = maskSecretPreview(clean);
      }
    }

    if (dto.opencodeApiKey !== undefined) {
      const clean = String(dto.opencodeApiKey ?? '').trim();
      if (!clean) {
        delete nextStored.opencodeApiKeyEnc;
        delete nextStored.opencodeKeyPreview;
      } else {
        nextStored.opencodeApiKeyEnc = encryptSecret(clean);
        nextStored.opencodeKeyPreview = maskSecretPreview(clean);
      }
    }

    policy.marqueeAi = nextStored;

    if (cfg) {
      await this.prisma.globalConfig.update({
        where: { id: cfg.id },
        data: { financialPolicyJson: policy as any },
      });
    }

    return this.getConfig(userId);
  }

  async rotateWebhookToken(userId: number): Promise<{
    token: string;
    webhookTokenPreview: string;
  }> {
    const rawToken = generateMarqueeToken();
    const tokenHash = hashSecretToken(rawToken);
    const preview = `mrq_...${rawToken.slice(-6)}`;

    const cfg = await this.prisma.globalConfig.findFirst({ where: { userId } });
    if (cfg) {
      const policy =
        cfg.financialPolicyJson && typeof cfg.financialPolicyJson === 'object'
          ? { ...(cfg.financialPolicyJson as Record<string, any>) }
          : {};
      const nextStored: StoredMarqueeConfig = {
        ...this.extractStoredConfig(policy),
        webhookTokenHash: tokenHash,
        webhookTokenPreview: preview,
        webhookEnabled: true,
        updatedAt: new Date().toISOString(),
      };
      policy.marqueeAi = nextStored;
      await this.prisma.globalConfig.update({
        where: { id: cfg.id },
        data: { financialPolicyJson: policy as any },
      });
    }

    return {
      token: rawToken,
      webhookTokenPreview: preview,
    };
  }

  /**
   * Authenticates an external quick-capture request strictly via X-Marquee-Token header.
   * Never trusts spoofed x-user-id headers.
   */
  async resolveUserIdFromWebhookToken(rawToken: string | undefined): Promise<number> {
    const candidate = String(rawToken ?? '').trim();
    if (!candidate) {
      throw new UnauthorizedException('Missing X-Marquee-Token authentication header.');
    }

    const configs = await this.prisma.globalConfig.findMany({
      select: {
        userId: true,
        financialPolicyJson: true,
      },
    });

    for (const row of configs) {
      const stored = this.extractStoredConfig(row.financialPolicyJson);
      if (stored.webhookEnabled === false) continue;
      if (stored.webhookTokenHash && verifySecretToken(candidate, stored.webhookTokenHash)) {
        return row.userId;
      }
    }

    throw new UnauthorizedException('Invalid or revoked X-Marquee-Token.');
  }

  async getMemoryRules(userId: number) {
    return this.toolsService.getUserMemoryRules(userId);
  }

  async deleteMemoryRule(userId: number, memoryId: string) {
    return this.toolsService.deleteUserMemoryRule(userId, memoryId);
  }

  async chat(userId: number, dto: MarqueeChatRequestDto): Promise<MarqueeChatResponse> {
    return this.chatWithProgress(userId, dto);
  }

  async chatWithProgress(
    userId: number,
    dto: MarqueeChatRequestDto,
    onProgress?: (event: MarqueeStreamStatusEvent) => void,
  ): Promise<MarqueeChatResponse> {
    const message = String(dto.message ?? '').trim();
    const t0 = Date.now();
    const emit = (
      phase: MarqueeStreamStatusEvent['phase'],
      label: string,
      detail: string,
    ) => {
      onProgress?.({
        type: 'status',
        phase,
        label,
        detail,
        timestamp: new Date().toISOString(),
      });
    };

    const actionToolMap: Record<string, any> = {
      CONFIRM_EXPENSE: 'prepare_quick_transaction',
      CONFIRM_SHIFT_LIABILITY: 'manage_liability_item',
      CONFIRM_SETTLE_LIABILITY: 'manage_liability_item',
      CONFIRM_BUDGET_REVISION: 'revise_budget_or_quota',
      CONFIRM_SAVINGS_ACTION: 'manage_savings_pocket_or_goal',
      CONFIRM_WISHLIST_ADD: 'manage_wishlist_or_subscription',
      CONFIRM_SUBSCRIPTION_ACTION: 'manage_wishlist_or_subscription',
    };

    if (dto.confirm && dto.pendingAction && actionToolMap[dto.pendingAction.type]) {
      emit('ANALYZING', 'Executing confirmed action...', dto.pendingAction.type);
      const p = dto.pendingAction.payload ?? {};
      const toolName = actionToolMap[dto.pendingAction.type];
      const result = await this.toolsService.executeTool(toolName, p, {
        userId,
        confirm: true,
        month: dto.month ?? p.month,
        year: dto.year ?? p.year,
      });
      return {
        ...result,
        tierUsed: 'CONFIRMED_EXECUTION',
        model: 'deterministic-commit',
        locale: dto.locale ?? 'en',
        agentSteps: [
          {
            id: 'step_confirm',
            label: 'Executed confirmed action',
            detail: `${toolName} persisted cleanly`,
            status: 'done',
            durationMs: Math.max(1, Date.now() - t0),
          },
        ],
      };
    }

    emit('THINKING', 'Thinking...', 'Reading prompt intent & period context');
    const parsedTier1 = parseMarqueeIntent(message || 'financial pulse');
    const locale = dto.locale ?? parsedTier1.locale;
    const steps: MarqueeAgentStep[] = [
      {
        id: 'step_intent',
        label: 'Understood request',
        detail: `${describeToolAction(parsedTier1.tool)}${parsedTier1.amountRp ? ` · Rp ${parsedTier1.amountRp.toLocaleString('id-ID')}` : ''}`,
        status: 'done',
      },
    ];

    emit('HYDRATING', 'Reading ERP ledger...', 'Checking cards, cutoffs, wishlist & balances');
    let hydrated: MarqueeFinancialContext | undefined;
    if (this.contextHydrator && typeof this.contextHydrator.hydrateForUser === 'function') {
      try {
        hydrated = await this.contextHydrator.hydrateForUser(userId, {
          month: dto.month,
          year: dto.year,
          activeRoute: dto.activeRoute,
          activeSubTab: dto.activeSubTab,
          locale,
        });
      } catch {
        hydrated = undefined;
      }
    }
    if (hydrated) {
      steps.push({
        id: 'step_hydrate',
        label: `Loaded ${hydrated.activePeriod?.periodTag ?? 'active'} live ledger`,
        detail: `${hydrated.dueDayCalendar?.activeCycleItems?.length ?? 0} cycle items · ${hydrated.creditCardsAndContracts?.length ?? 0} card plans · ${hydrated.wishlistItems?.length ?? 0} wishlist`,
        status: 'done',
      });
    }

    const cfg = await this.prisma.globalConfig.findFirst({ where: { userId } });
    const stored = this.extractStoredConfig(cfg?.financialPolicyJson);

    let geminiApiKey = process.env.GEMINI_API_KEY || undefined;
    let groqApiKey = process.env.GROQ_API_KEY || undefined;
    let deepseekApiKey = process.env.DEEPSEEK_API_KEY || undefined;
    let opencodeApiKey = process.env.OPENCODE_API_KEY || undefined;

    if (stored.geminiApiKeyEnc) {
      try {
        geminiApiKey = decryptSecret(stored.geminiApiKeyEnc);
      } catch {
        geminiApiKey = process.env.GEMINI_API_KEY || undefined;
      }
    }
    if (stored.groqApiKeyEnc) {
      try {
        groqApiKey = decryptSecret(stored.groqApiKeyEnc);
      } catch {
        groqApiKey = process.env.GROQ_API_KEY || undefined;
      }
    }
    if (stored.deepseekApiKeyEnc) {
      try {
        deepseekApiKey = decryptSecret(stored.deepseekApiKeyEnc);
      } catch {
        deepseekApiKey = process.env.DEEPSEEK_API_KEY || undefined;
      }
    }
    if (stored.opencodeApiKeyEnc) {
      try {
        opencodeApiKey = decryptSecret(stored.opencodeApiKeyEnc);
      } catch {
        opencodeApiKey = process.env.OPENCODE_API_KEY || undefined;
      }
    }

    const provider: MarqueeAiProvider =
      stored.provider ??
      (deepseekApiKey
        ? 'DEEPSEEK'
        : opencodeApiKey
          ? 'OPENCODE'
          : geminiApiKey
            ? 'GEMINI'
            : groqApiKey
              ? 'GROQ'
              : 'TIER1_ONLY');

    let selectedTool = parsedTier1.tool;
    let selectedArgs: Record<string, any> = {
      title: parsedTier1.title,
      amountRp: parsedTier1.amountRp,
      instrument: parsedTier1.instrument,
      tenorMonths: parsedTier1.tenorMonths,
      expression: parsedTier1.expression,
      action: parsedTier1.action,
      itemQuery: parsedTier1.itemQuery,
      category: parsedTier1.category,
      purchaseDate: parsedTier1.purchaseDateIso,
      ruleText: parsedTier1.ruleText,
      merchantPattern: parsedTier1.merchantPattern,
      defaultInstrument: parsedTier1.defaultInstrument,
      searchQuery: parsedTier1.searchQuery,
      reasonQuery: message,
      locale,
    };

    // Apply user memory defaults (e.g. remembered merchant -> defaultInstrument) when prompt leaves method implicit
    const explicitInstMention =
      /\b(cash|tunai|spaylater|paylater|pay later|cc|credit\s*card|kartu\s*kredit|permata|shopee)\b/i.test(
        message,
      );
    let memoryDefaultInstrument: 'CASH' | 'PAYLATER' | 'CREDIT_CARD' | undefined;
    if (!explicitInstMention && hydrated?.memoryRules?.length) {
      const lowerMsg = message.toLowerCase();
      const matchedMem = hydrated.memoryRules.find(
        (m) =>
          m.merchantPattern &&
          m.defaultInstrument &&
          lowerMsg.includes(m.merchantPattern.toLowerCase()),
      );
      if (matchedMem?.defaultInstrument) {
        memoryDefaultInstrument = matchedMem.defaultInstrument;
        selectedArgs.instrument = matchedMem.defaultInstrument;
      }
    }
    let tierUsed: MarqueeChatResponse['tierUsed'] = 'TIER1_NLU';
    let model = 'tier1-deterministic-nlu';
    let assistantPrefix: string | undefined;
    let reasoning: string | undefined;
    let llmResolution: Awaited<ReturnType<MarqueeLlmService['resolveWithProvider']>> = null;

    const hasAnyKey = Boolean(
      geminiApiKey || groqApiKey || deepseekApiKey || opencodeApiKey,
    );

    const buildHydratedMeta = () =>
      hydrated
        ? {
            periodTag: hydrated.activePeriod.periodTag,
            cycleTemporalState: hydrated.activePeriod.cycleTemporalState,
            cycleDateLabel: hydrated.activePeriod.cycleDateLabel,
            activeRoute: hydrated.uiContext?.activeRoute ?? '/',
            activeSubTab: hydrated.uiContext?.activeSubTab ?? null,
            canonicalDueDays: hydrated.dueDayCalendar?.canonicalDueDays ?? [8, 11, 17, 23, 24, 25],
          }
        : undefined;

    if (provider !== 'TIER1_ONLY' && hasAnyKey) {
      emit('ANALYZING', 'Reasoning with co-pilot...', `Provider: ${provider}`);
      const resolved = await this.llmService.resolveWithProvider({
        provider,
        geminiApiKey,
        groqApiKey,
        deepseekApiKey,
        deepseekModel:
          stored.deepseekModel ??
          (process.env.DEEPSEEK_MODEL as any) ??
          'deepseek-flash',
        opencodeApiKey,
        opencodeBaseUrl:
          stored.opencodeBaseUrl ||
          process.env.OPENCODE_BASE_URL ||
          'https://opencode.ai/zen/v1',
        opencodeModel:
          stored.opencodeModel ||
          process.env.OPENCODE_MODEL ||
          'deepseek-v4.1-flash-free',
        systemContextPrompt: hydrated?.systemPrompt,
        message,
        tier1Fallback: parsedTier1,
        executeTool: async (hopTool, hopArgs) => {
          emit('ANALYZING', 'Running ledger check...', describeToolAction(hopTool));
          const mergedArgs = {
            ...hopArgs,
            ...(hopTool === 'prepare_quick_transaction' &&
            !hopArgs?.instrument &&
            memoryDefaultInstrument
              ? { instrument: memoryDefaultInstrument }
              : {}),
            ...(hopTool === 'refuse_out_of_scope' && !hopArgs?.reasonQuery
              ? { reasonQuery: message, locale }
              : {}),
          };
          return this.toolsService.executeTool(hopTool, mergedArgs, {
            userId,
            confirm: Boolean(dto.confirm),
            month: dto.month,
            year: dto.year,
          });
        },
      });

      if (resolved && resolved.usedProvider !== 'TIER1_ONLY') {
        llmResolution = resolved;
        model = resolved.model;
        assistantPrefix = resolved.assistantPrefix;
        reasoning = resolved.reasoning;
        if (resolved.usedProvider === 'DEEPSEEK') tierUsed = 'TIER2_DEEPSEEK';
        else if (resolved.usedProvider === 'OPENCODE') tierUsed = 'TIER2_OPENCODE';
        else if (resolved.usedProvider === 'GEMINI') tierUsed = 'TIER2_GEMINI';
        else if (resolved.usedProvider === 'GROQ') tierUsed = 'TIER2_GROQ';

        // Direct conversational LLM answer (e.g. greetings or ledger Q&A) — do NOT force Tier 1 tool boilerplate
        if (!resolved.didCallTool && resolved.tool === null && resolved.assistantPrefix) {
          steps.push({
            id: 'step_llm_reply',
            label: `Verified ledger via ${model}`,
            detail: 'Answered directly from hydrated ERP state',
            status: 'done',
            durationMs: Math.max(1, Date.now() - t0),
          });
          return {
            ok: true,
            tool: 'conversational' as any,
            summary: resolved.assistantPrefix,
            cards: [],
            tierUsed,
            model,
            locale,
            assistantPrefix: resolved.assistantPrefix,
            ...(reasoning ? { reasoning: sanitizeReasoningForUi(reasoning) } : {}),
            agentSteps: steps,
            ...(hydrated?.proactiveReminders
              ? { proactiveReminders: hydrated.proactiveReminders }
              : {}),
            hydratedContext: buildHydratedMeta(),
          };
        }

        if (resolved.tool) {
          selectedTool = resolved.tool;
          selectedArgs = { ...selectedArgs, ...resolved.args };
        }
      }
    }

    let result: MarqueeToolResult;
    if (llmResolution?.finalToolResult) {
      result = { ...llmResolution.finalToolResult };
      const hops = llmResolution.executedHops ?? [];
      hops.forEach((hop, idx) => {
        steps.push({
          id: `step_hop_${idx + 1}`,
          label: describeToolAction(hop.tool),
          detail: hop.result?.pendingAction
            ? `${HUMAN_ACTION_LABELS[hop.result.pendingAction.type] ?? 'Staged ledger update'} awaiting confirmation`
            : `${hop.result?.cards?.length ?? 0} summary metrics verified`,
          status: 'done',
          durationMs: hop.durationMs,
        });
      });
      if (llmResolution.synthesizedInLoop && assistantPrefix) {
        result.summary = assistantPrefix;
      }
    } else {
      const actionSummary = describeToolAction(selectedTool);
      emit('ANALYZING', 'Running ledger check...', actionSummary);
      result = await this.toolsService.executeTool(selectedTool, selectedArgs, {
        userId,
        confirm: Boolean(dto.confirm),
        month: dto.month,
        year: dto.year,
      });
      steps.push({
        id: 'step_tool',
        label: actionSummary,
        detail: result.pendingAction
          ? `${HUMAN_ACTION_LABELS[result.pendingAction.type] ?? 'Staged ledger update'} awaiting confirmation`
          : `${result.cards?.length ?? 0} summary metrics verified`,
        status: 'done',
        durationMs: Math.max(1, Date.now() - t0),
      });
    }
    if (result.pendingAction) {
      emit(
        'STAGING',
        'Preparing confirmation...',
        HUMAN_ACTION_LABELS[result.pendingAction.type] ?? 'Confirmation card ready',
      );
    }

    if (
      llmResolution?.didCallTool &&
      !llmResolution.synthesizedInLoop &&
      !result.pendingAction &&
      llmResolution.endpointUrlUsed &&
      llmResolution.apiKeyUsed &&
      typeof this.llmService?.synthesizeToolResult === 'function'
    ) {
      const pacingObj = (result.data?.pacing ?? null) as Record<string, any> | null;
      const compactToolPayload = {
        ok: result.ok,
        tool: result.tool,
        summary: result.summary,
        cards: result.cards,
        data: {
          ...(result.data?.sim ? { sim: result.data.sim } : {}),
          ...(pacingObj
            ? {
                pacing: {
                  remainingBudget: pacingObj.remainingBudget,
                  weightedSafeToSpendToday: pacingObj.weightedSafeToSpendToday,
                  weekdaySafeRate: pacingObj.weekdaySafeRate,
                  weekendSafeRate: pacingObj.weekendSafeRate,
                  daysRemaining: pacingObj.daysRemaining,
                  cycleTemporalState: pacingObj.cycleTemporalState,
                  cycleDateLabel: pacingObj.cycleDateLabel,
                },
              }
            : {}),
        },
      };
      const synth = await this.llmService.synthesizeToolResult({
        endpointUrl: llmResolution.endpointUrlUsed,
        apiKey: llmResolution.apiKeyUsed,
        model: llmResolution.model,
        message,
        systemContextPrompt: hydrated?.systemPrompt,
        toolCallId: llmResolution.toolCallId || 'call_marquee_1',
        toolName: String(selectedTool),
        toolArgs: selectedArgs,
        toolPayload: compactToolPayload,
      });
      if (synth?.reply) {
        result.summary = synth.reply;
        assistantPrefix = synth.reply;
        reasoning = [reasoning, synth.reasoning].filter(Boolean).join('\n\n') || undefined;
      }
    }

    const cleanedReasoning = sanitizeReasoningForUi(reasoning);
    return {
      ...result,
      tierUsed,
      model,
      locale,
      ...(assistantPrefix ? { assistantPrefix } : {}),
      ...(cleanedReasoning ? { reasoning: cleanedReasoning } : {}),
      agentSteps: steps,
      ...(hydrated?.proactiveReminders ? { proactiveReminders: hydrated.proactiveReminders } : {}),
      hydratedContext: buildHydratedMeta(),
    };
  }

  /**
   * Model Context Protocol (MCP) JSON-RPC 2.0 handler exposing strictly curated
   * Sunday Funday ERP business functions scoped to the authenticated userId.
   */
  async handleMcpRpc(
    userId: number,
    rpc: {
      jsonrpc?: string;
      id?: string | number | null;
      method?: string;
      params?: Record<string, any>;
    },
  ) {
    const id = rpc?.id ?? null;
    const method = String(rpc?.method ?? '').trim();

    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'sundayfunday-erp', version: '4.0.0' },
          instructions:
            'Sunday Funday ERP financial MCP server. Only curated ERP financial functions are allowed; raw SQL, shell, filesystem, and external downloads are restricted.',
        },
      };
    }

    if (method === 'notifications/initialized' || method === 'ping') {
      return { jsonrpc: '2.0', id, result: {} };
    }

    if (method === 'tools/list') {
      const tools = MARQUEE_TOOL_DEFS.filter((t) => MCP_EXPOSED_TOOLS.has(t.name)).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: {
          type: 'object',
          properties: {
            ...(t.parameters?.properties ?? {}),
            confirm: {
              type: 'boolean',
              description: 'Set true to persist state-mutating actions; defaults to safe staging preview',
            },
            month: { type: 'number', description: 'Optional target billing/budget month 1-12' },
            year: { type: 'number', description: 'Optional target billing/budget year' },
          },
          ...(Array.isArray((t.parameters as any)?.required)
            ? { required: (t.parameters as any).required }
            : {}),
        },
      }));
      return { jsonrpc: '2.0', id, result: { tools } };
    }

    if (method === 'tools/call') {
      const toolName = String(rpc?.params?.name ?? '').trim();
      const args =
        rpc?.params?.arguments && typeof rpc.params.arguments === 'object'
          ? (rpc.params.arguments as Record<string, any>)
          : {};

      if (!MCP_EXPOSED_TOOLS.has(toolName)) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Domain restriction: "${toolName}" is not a permitted Sunday Funday financial business function. Only registered ERP tools may be executed.`,
              },
            ],
          },
        };
      }

      const out = await this.toolsService.executeTool(toolName as MarqueeToolName, args, {
        userId,
        confirm: Boolean(args.confirm),
        month: Number(args.month || 0) || undefined,
        year: Number(args.year || 0) || undefined,
      });

      return {
        jsonrpc: '2.0',
        id,
        result: {
          isError: !out.ok,
          content: [{ type: 'text', text: out.summary }],
          structuredContent: out,
        },
      };
    }

    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Unsupported MCP method: ${method || '(empty)'}`,
      },
    };
  }
}
