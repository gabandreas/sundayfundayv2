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
import { parseMarqueeIntent } from './marquee-nlu';
import { MarqueeAiProvider, MarqueeLlmService } from './marquee-llm.service';
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

export interface StoredMarqueeConfig {
  provider?: MarqueeAiProvider;
  geminiApiKeyEnc?: string;
  geminiKeyPreview?: string;
  groqApiKeyEnc?: string;
  groqKeyPreview?: string;
  deepseekApiKeyEnc?: string;
  deepseekKeyPreview?: string;
  deepseekModel?: 'deepseek-chat' | 'deepseek-reasoner';
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
  deepseekModel: 'deepseek-chat' | 'deepseek-reasoner';
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
      deepseekModel?: 'deepseek-chat' | 'deepseek-reasoner';
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
    if (dto.deepseekModel === 'deepseek-chat' || dto.deepseekModel === 'deepseek-reasoner') {
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

  async chat(userId: number, dto: MarqueeChatRequestDto): Promise<MarqueeChatResponse> {
    const message = String(dto.message ?? '').trim();

    if (dto.confirm && dto.pendingAction?.type === 'CONFIRM_EXPENSE') {
      const p = dto.pendingAction.payload;
      const result = await this.toolsService.executeTool('prepare_quick_transaction', p, {
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
      };
    }

    const parsedTier1 = parseMarqueeIntent(message || 'financial pulse');
    const locale = dto.locale ?? parsedTier1.locale;

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

    const cfg = await this.prisma.globalConfig.findFirst({ where: { userId } });
    const stored = this.extractStoredConfig(cfg?.financialPolicyJson);
    const provider: MarqueeAiProvider = stored.provider ?? 'TIER1_ONLY';

    let geminiApiKey = process.env.GEMINI_API_KEY || undefined;
    let groqApiKey = process.env.GROQ_API_KEY || undefined;
    let deepseekApiKey = process.env.DEEPSEEK_API_KEY || undefined;
    let opencodeApiKey = process.env.OPENCODE_API_KEY || undefined;

    if (stored.geminiApiKeyEnc) {
      try {
        geminiApiKey = decryptSecret(stored.geminiApiKeyEnc);
      } catch {
        geminiApiKey = undefined;
      }
    }
    if (stored.groqApiKeyEnc) {
      try {
        groqApiKey = decryptSecret(stored.groqApiKeyEnc);
      } catch {
        groqApiKey = undefined;
      }
    }
    if (stored.deepseekApiKeyEnc) {
      try {
        deepseekApiKey = decryptSecret(stored.deepseekApiKeyEnc);
      } catch {
        deepseekApiKey = undefined;
      }
    }
    if (stored.opencodeApiKeyEnc) {
      try {
        opencodeApiKey = decryptSecret(stored.opencodeApiKeyEnc);
      } catch {
        opencodeApiKey = undefined;
      }
    }

    let selectedTool = parsedTier1.tool;
    let selectedArgs: Record<string, any> = {
      title: parsedTier1.title,
      amountRp: parsedTier1.amountRp,
      instrument: parsedTier1.instrument,
      tenorMonths: parsedTier1.tenorMonths,
      expression: parsedTier1.expression,
    };
    let tierUsed: MarqueeChatResponse['tierUsed'] = 'TIER1_NLU';
    let model = 'tier1-deterministic-nlu';
    let assistantPrefix: string | undefined;
    let reasoning: string | undefined;

    const hasAnyKey = Boolean(
      geminiApiKey || groqApiKey || deepseekApiKey || opencodeApiKey,
    );

    if (provider !== 'TIER1_ONLY' && hasAnyKey) {
      const resolved = await this.llmService.resolveWithProvider({
        provider,
        geminiApiKey,
        groqApiKey,
        deepseekApiKey,
        deepseekModel: stored.deepseekModel ?? 'deepseek-chat',
        opencodeApiKey,
        opencodeBaseUrl: stored.opencodeBaseUrl || 'https://opencode.ai/zen/v1',
        opencodeModel: stored.opencodeModel || 'deepseek-v4.1-flash-free',
        systemContextPrompt: hydrated?.systemPrompt,
        message,
        tier1Fallback: parsedTier1,
      });

      if (resolved && resolved.usedProvider !== 'TIER1_ONLY') {
        selectedTool = resolved.tool;
        selectedArgs = { ...selectedArgs, ...resolved.args };
        model = resolved.model;
        assistantPrefix = resolved.assistantPrefix;
        reasoning = resolved.reasoning;
        if (resolved.usedProvider === 'DEEPSEEK') tierUsed = 'TIER2_DEEPSEEK';
        else if (resolved.usedProvider === 'OPENCODE') tierUsed = 'TIER2_OPENCODE';
        else if (resolved.usedProvider === 'GEMINI') tierUsed = 'TIER2_GEMINI';
        else if (resolved.usedProvider === 'GROQ') tierUsed = 'TIER2_GROQ';
      }
    }

    const result = await this.toolsService.executeTool(selectedTool, selectedArgs, {
      userId,
      confirm: Boolean(dto.confirm),
      month: dto.month,
      year: dto.year,
    });

    return {
      ...result,
      tierUsed,
      model,
      locale,
      ...(assistantPrefix ? { assistantPrefix } : {}),
      ...(reasoning ? { reasoning } : {}),
      ...(hydrated?.proactiveReminders ? { proactiveReminders: hydrated.proactiveReminders } : {}),
      hydratedContext: hydrated
        ? {
            periodTag: hydrated.activePeriod.periodTag,
            cycleTemporalState: hydrated.activePeriod.cycleTemporalState,
            cycleDateLabel: hydrated.activePeriod.cycleDateLabel,
            activeRoute: hydrated.uiContext.activeRoute,
            activeSubTab: hydrated.uiContext.activeSubTab,
            canonicalDueDays: hydrated.dueDayCalendar.canonicalDueDays,
          }
        : undefined,
    };
  }
}
