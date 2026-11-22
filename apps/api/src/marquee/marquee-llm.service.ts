import { Injectable, Logger } from '@nestjs/common';
import { MarqueeParsedIntent, MarqueeToolName } from './marquee-nlu';

export type MarqueeAiProvider =
  | 'TIER1_ONLY'
  | 'GEMINI'
  | 'GROQ'
  | 'DEEPSEEK'
  | 'OPENCODE'
  | 'AUTO';

export interface LlmIntentResolution {
  usedProvider: MarqueeAiProvider;
  model: string;
  tool: MarqueeToolName;
  args: Record<string, any>;
  assistantPrefix?: string;
}

export const MARQUEE_TOOL_DEFS = [
  {
    name: 'get_paycycle_pulse',
    description:
      'Get current cycle temporal state (PRE_PAYDAY/ACTIVE/COMPLETED), safe-to-spend today, projected daily rate, remaining living cash, and budget shortfall.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'number', description: 'Optional month 1-12' },
        year: { type: 'number', description: 'Optional year' },
      },
    },
  },
  {
    name: 'simulate_purchase_cutoff',
    description:
      'Simulate SPayLater (15th cutoff -> 25th due) or Credit Card (20th cutoff -> 11th due) billing cycle landing and post-purchase DSR impact.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        amountRp: { type: 'number' },
        instrument: { type: 'string', enum: ['CASH', 'PAYLATER', 'CREDIT_CARD'] },
        tenorMonths: { type: 'number' },
      },
      required: ['amountRp'],
    },
  },
  {
    name: 'optimize_payday_thr_split',
    description:
      'Recommend how to split a THR, religious holiday bonus, or payday surplus across shortfall coverage, P1 Core Vault, high-cost debt prepayment, and holiday living buffer.',
    parameters: {
      type: 'object',
      properties: {
        bonusRp: { type: 'number', description: 'THR or bonus amount in Rupiah' },
      },
    },
  },
  {
    name: 'analyze_debt_burndown',
    description:
      'Analyze active installment plans, remaining principal, monthly commitment, and payoff milestones (JAN 27, FEB 27 SPinjam freedom, SEP 27 final maturity).',
    parameters: {
      type: 'object',
      properties: {
        lumpSumRp: { type: 'number' },
      },
    },
  },
  {
    name: 'evaluate_custom_formula',
    description:
      'Evaluate a custom financial formula expression over live cycle tokens (net_income, total_debt, living_pool, shortfall, p1_savings, p2_buffer, daily_rate).',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Arithmetic expression e.g. net_income - total_debt - living_pool',
        },
      },
      required: ['expression'],
    },
  },
  {
    name: 'prepare_quick_transaction',
    description:
      'Preview or stage an expense or credit charge (CASH, PAYLATER, CREDIT_CARD) behind a confirmation gate with Rupiah amount and optional installment tenor.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Merchant or expense item label' },
        amountRp: { type: 'number', description: 'Total Rupiah amount (integer)' },
        instrument: { type: 'string', enum: ['CASH', 'PAYLATER', 'CREDIT_CARD'] },
        tenorMonths: { type: 'number', description: 'Installment months (default 1)' },
      },
      required: ['title', 'amountRp'],
    },
  },
  {
    name: 'prepare_wallet_checkin',
    description:
      'Evaluate free spendable wallet cash after deducting unpaid bill holds.',
    parameters: {
      type: 'object',
      properties: {
        actualWalletBalance: { type: 'number', description: 'Actual Rupiah balance in wallet' },
      },
      required: ['actualWalletBalance'],
    },
  },
  {
    name: 'explain_period_variance',
    description:
      'Compare two paycycle snapshots (e.g. 11/2026 vs 12/2026) and explain income, debt, living pool, and shortfall deltas.',
    parameters: {
      type: 'object',
      properties: {
        compareMonth: { type: 'number' },
        compareYear: { type: 'number' },
      },
    },
  },
  // Legacy tool aliases accepted from LLM tool calls
  {
    name: 'get_financial_pulse',
    description: 'Alias for get_paycycle_pulse.',
    parameters: { type: 'object', properties: { month: { type: 'number' }, year: { type: 'number' } } },
  },
  {
    name: 'log_quick_expense',
    description: 'Alias for prepare_quick_transaction.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        amountRp: { type: 'number' },
        instrument: { type: 'string', enum: ['CASH', 'PAYLATER', 'CREDIT_CARD'] },
        tenorMonths: { type: 'number' },
      },
      required: ['title', 'amountRp'],
    },
  },
  {
    name: 'evaluate_affordability',
    description: 'Alias for simulate_purchase_cutoff.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        amountRp: { type: 'number' },
        instrument: { type: 'string', enum: ['CASH', 'PAYLATER', 'CREDIT_CARD'] },
        tenorMonths: { type: 'number' },
      },
      required: ['amountRp'],
    },
  },
  {
    name: 'get_upcoming_bills',
    description: 'Retrieve PayLater, Credit Card, and Personal Debt totals due in the active period.',
    parameters: { type: 'object', properties: { month: { type: 'number' }, year: { type: 'number' } } },
  },
  {
    name: 'wallet_checkin_guard',
    description: 'Alias for prepare_wallet_checkin.',
    parameters: {
      type: 'object',
      properties: { actualWalletBalance: { type: 'number' } },
      required: ['actualWalletBalance'],
    },
  },
  {
    name: 'get_debt_burndown',
    description: 'Alias for analyze_debt_burndown.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_savings_and_goals',
    description: 'Inspect P1 Core Savings vault balance (RDPU + liquid) and active goals.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'simulate_debt_payoff',
    description: 'Simulate Snowball vs Avalanche early prepayment impact for a Rupiah lump sum.',
    parameters: { type: 'object', properties: { lumpSumRp: { type: 'number' } } },
  },
];

@Injectable()
export class MarqueeLlmService {
  private readonly logger = new Logger(MarqueeLlmService.name);

  async resolveWithProvider(params: {
    provider: MarqueeAiProvider;
    geminiApiKey?: string;
    groqApiKey?: string;
    deepseekApiKey?: string;
    deepseekModel?: string;
    opencodeApiKey?: string;
    opencodeBaseUrl?: string;
    opencodeModel?: string;
    systemContextPrompt?: string;
    message: string;
    tier1Fallback: MarqueeParsedIntent;
  }): Promise<LlmIntentResolution | null> {
    const {
      provider,
      geminiApiKey,
      groqApiKey,
      deepseekApiKey,
      deepseekModel,
      opencodeApiKey,
      opencodeBaseUrl,
      opencodeModel,
      systemContextPrompt,
      message,
      tier1Fallback,
    } = params;

    if (provider === 'TIER1_ONLY') return null;

    const tryProvider = async (target: MarqueeAiProvider): Promise<LlmIntentResolution | null> => {
      if (target === 'DEEPSEEK' && deepseekApiKey) {
        try {
          return await this.callOpenAiCompatible({
            usedProvider: 'DEEPSEEK',
            endpointUrl: 'https://api.deepseek.com/v1/chat/completions',
            apiKey: deepseekApiKey,
            model: deepseekModel || 'deepseek-chat',
            message,
            systemContextPrompt,
          });
        } catch (err: any) {
          this.logger.warn(`DeepSeek Tier-2 fallback: ${err?.message || err}`);
        }
      }

      if (target === 'OPENCODE' && opencodeApiKey) {
        const cleanBase = String(opencodeBaseUrl || 'https://api.opencode.ai/v1').replace(/\/+$/, '');
        try {
          return await this.callOpenAiCompatible({
            usedProvider: 'OPENCODE',
            endpointUrl: `${cleanBase}/chat/completions`,
            apiKey: opencodeApiKey,
            model: opencodeModel || 'opencode-chat',
            message,
            systemContextPrompt,
          });
        } catch (err: any) {
          this.logger.warn(`OpenCode Tier-2 fallback: ${err?.message || err}`);
        }
      }

      if (target === 'GEMINI' && geminiApiKey) {
        try {
          return await this.callGemini(geminiApiKey, message, systemContextPrompt);
        } catch (err: any) {
          this.logger.warn(`Gemini Tier-2 fallback: ${err?.message || err}`);
        }
      }

      if (target === 'GROQ' && groqApiKey) {
        try {
          return await this.callOpenAiCompatible({
            usedProvider: 'GROQ',
            endpointUrl: 'https://api.groq.com/openai/v1/chat/completions',
            apiKey: groqApiKey,
            model: 'llama-3.3-70b-versatile',
            message,
            systemContextPrompt,
          });
        } catch (err: any) {
          this.logger.warn(`Groq Tier-2 fallback: ${err?.message || err}`);
        }
      }

      return null;
    };

    const order: MarqueeAiProvider[] =
      provider === 'AUTO'
        ? ['DEEPSEEK', 'OPENCODE', 'GEMINI', 'GROQ']
        : [
            provider,
            ...(['DEEPSEEK', 'OPENCODE', 'GEMINI', 'GROQ'] as MarqueeAiProvider[]).filter(
              (p) => p !== provider,
            ),
          ];

    for (const candidate of order) {
      const res = await tryProvider(candidate);
      if (res) return res;
    }

    return {
      usedProvider: 'TIER1_ONLY',
      model: 'tier1-deterministic-nlu',
      tool: tier1Fallback.tool,
      args: {
        title: tier1Fallback.title,
        amountRp: tier1Fallback.amountRp,
        instrument: tier1Fallback.instrument,
        tenorMonths: tier1Fallback.tenorMonths,
        expression: tier1Fallback.expression,
      },
    };
  }

  private async callGemini(
    apiKey: string,
    message: string,
    systemContextPrompt?: string,
  ): Promise<LlmIntentResolution | null> {
    const genaiMod = await (new Function('s', 'return import(s)')('@google/genai') as Promise<any>);
    const GoogleGenAI = genaiMod.GoogleGenAI;
    const ai = new GoogleGenAI({ apiKey });

    const sys = systemContextPrompt
      ? `${systemContextPrompt}\n\nAlways invoke one matching deterministic tool rather than inventing Rupiah figures.`
      : `You are Marquee, a deterministic Indonesian personal finance ERP assistant (IDR). Always invoke one financial tool matching the user's message rather than inventing Rupiah figures.`;

    const response = await ai.interactions.create({
      model: 'gemini-3.8-flash',
      input: `${sys}\n\nUser message: ${message}`,
      tools: MARQUEE_TOOL_DEFS.map((t) => ({
        type: 'function',
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    });

    const outputs: any[] = Array.isArray(response?.outputs) ? response.outputs : [];
    const fnCall = outputs.find((o) => o?.type === 'function_call' && o?.name);
    if (fnCall) {
      const validTool = MARQUEE_TOOL_DEFS.some((t) => t.name === fnCall.name);
      if (validTool) {
        return {
          usedProvider: 'GEMINI',
          model: 'gemini-3.8-flash',
          tool: fnCall.name as MarqueeToolName,
          args: typeof fnCall.arguments === 'object' && fnCall.arguments ? fnCall.arguments : {},
        };
      }
    }

    return null;
  }

  private async callOpenAiCompatible(params: {
    usedProvider: 'GROQ' | 'DEEPSEEK' | 'OPENCODE';
    endpointUrl: string;
    apiKey: string;
    model: string;
    message: string;
    systemContextPrompt?: string;
  }): Promise<LlmIntentResolution | null> {
    const { usedProvider, endpointUrl, apiKey, model, message, systemContextPrompt } = params;
    const sys =
      systemContextPrompt ||
      'You are Marquee, a deterministic Indonesian personal finance ERP co-pilot. Pick one financial tool and extract structured IDR parameters.';

    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: sys,
          },
          { role: 'user', content: message },
        ],
        tools: MARQUEE_TOOL_DEFS.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
        tool_choice: 'auto',
      }),
    });

    if (!res.ok) {
      throw new Error(`${usedProvider} HTTP ${res.status}`);
    }
    const payload: any = await res.json();
    const msg = payload?.choices?.[0]?.message;
    const call = msg?.tool_calls?.[0]?.function;
    if (call?.name && MARQUEE_TOOL_DEFS.some((t) => t.name === call.name)) {
      let parsedArgs: Record<string, any> = {};
      try {
        parsedArgs = call.arguments ? JSON.parse(call.arguments) : {};
      } catch {
        parsedArgs = {};
      }
      const assistantPrefix =
        typeof msg?.content === 'string' && msg.content.trim().length > 0
          ? msg.content.trim()
          : undefined;
      return {
        usedProvider,
        model,
        tool: call.name as MarqueeToolName,
        args: parsedArgs,
        assistantPrefix,
      };
    }

    return null;
  }
}
