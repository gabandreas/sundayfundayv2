import { Injectable, UnauthorizedException } from '@nestjs/common';
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

export interface StoredMarqueeConfig {
  provider?: MarqueeAiProvider;
  geminiApiKeyEnc?: string;
  geminiKeyPreview?: string;
  groqApiKeyEnc?: string;
  groqKeyPreview?: string;
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
}

export interface MarqueeChatResponse extends MarqueeToolResult {
  tierUsed: 'TIER1_NLU' | 'TIER2_GEMINI' | 'TIER2_GROQ' | 'CONFIRMED_EXECUTION';
  model: string;
  locale: 'en' | 'id' | 'zh';
}

@Injectable()
export class MarqueeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly toolsService: MarqueeToolsService,
    private readonly llmService: MarqueeLlmService,
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

    // Direct confirmation execution bypasses ambiguity and commits the previewed action deterministically
    if (dto.confirm && dto.pendingAction?.type === 'CONFIRM_EXPENSE') {
      const p = dto.pendingAction.payload;
      const result = await this.toolsService.executeTool('log_quick_expense', p, {
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

    const cfg = await this.prisma.globalConfig.findFirst({ where: { userId } });
    const stored = this.extractStoredConfig(cfg?.financialPolicyJson);
    const provider: MarqueeAiProvider = stored.provider ?? 'TIER1_ONLY';

    let geminiApiKey = process.env.GEMINI_API_KEY || undefined;
    let groqApiKey = process.env.GROQ_API_KEY || undefined;

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

    let selectedTool = parsedTier1.tool;
    let selectedArgs: Record<string, any> = {
      title: parsedTier1.title,
      amountRp: parsedTier1.amountRp,
      instrument: parsedTier1.instrument,
      tenorMonths: parsedTier1.tenorMonths,
    };
    let tierUsed: MarqueeChatResponse['tierUsed'] = 'TIER1_NLU';
    let model = 'tier1-deterministic-nlu';

    if (provider !== 'TIER1_ONLY' && (geminiApiKey || groqApiKey)) {
      const resolved = await this.llmService.resolveWithProvider({
        provider,
        geminiApiKey,
        groqApiKey,
        message,
        tier1Fallback: parsedTier1,
      });

      if (resolved && resolved.usedProvider === 'GEMINI') {
        selectedTool = resolved.tool;
        selectedArgs = { ...selectedArgs, ...resolved.args };
        tierUsed = 'TIER2_GEMINI';
        model = resolved.model;
      } else if (resolved && resolved.usedProvider === 'GROQ') {
        selectedTool = resolved.tool;
        selectedArgs = { ...selectedArgs, ...resolved.args };
        tierUsed = 'TIER2_GROQ';
        model = resolved.model;
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
    };
  }
}
