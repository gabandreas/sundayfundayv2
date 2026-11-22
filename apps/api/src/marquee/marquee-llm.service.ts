import { Injectable, Logger } from '@nestjs/common';
import { MarqueeParsedIntent, MarqueeToolName } from './marquee-nlu';

export type MarqueeAiProvider = 'TIER1_ONLY' | 'GEMINI' | 'GROQ';

export interface LlmIntentResolution {
  usedProvider: MarqueeAiProvider;
  model: string;
  tool: MarqueeToolName;
  args: Record<string, any>;
  assistantPrefix?: string;
}

const MARQUEE_TOOL_DEFS = [
  {
    name: 'get_financial_pulse',
    description:
      'Get current cycle temporal state (PRE_PAYDAY/ACTIVE/COMPLETED), safe-to-spend today, remaining living cash, and budget shortfall.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'number', description: 'Optional month 1-12' },
        year: { type: 'number', description: 'Optional year' },
      },
    },
  },
  {
    name: 'log_quick_expense',
    description:
      'Preview or log an expense or credit charge (CASH, PAYLATER, CREDIT_CARD) with Rupiah amount and optional installment tenor.',
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
    name: 'evaluate_affordability',
    description:
      'Simulate cutoff billing cycle and DSR impact of a planned purchase.',
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
    description:
      'Retrieve PayLater, Credit Card, and Personal Debt totals due in the active period.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'number' },
        year: { type: 'number' },
      },
    },
  },
  {
    name: 'wallet_checkin_guard',
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
    name: 'get_debt_burndown',
    description:
      'Summarize active installment contracts, monthly commitment, and debt freedom horizon.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_savings_and_goals',
    description:
      'Inspect P1 Core Savings vault balance (RDPU + liquid) and active goals.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'simulate_debt_payoff',
    description:
      'Simulate Snowball vs Avalanche early prepayment impact for a Rupiah lump sum (defaults to 1000000).',
    parameters: {
      type: 'object',
      properties: {
        lumpSumRp: { type: 'number' },
      },
    },
  },
];

@Injectable()
export class MarqueeLlmService {
  private readonly logger = new Logger(MarqueeLlmService.name);

  async resolveWithProvider(params: {
    provider: MarqueeAiProvider;
    geminiApiKey?: string;
    groqApiKey?: string;
    message: string;
    tier1Fallback: MarqueeParsedIntent;
  }): Promise<LlmIntentResolution | null> {
    const { provider, geminiApiKey, groqApiKey, message, tier1Fallback } = params;

    if (provider === 'GEMINI' && geminiApiKey) {
      try {
        const res = await this.callGemini(geminiApiKey, message);
        if (res) return res;
      } catch (err: any) {
        this.logger.warn(`Gemini Tier-2 fallback to Tier-1 NLU: ${err?.message || err}`);
      }
    }

    if (provider === 'GROQ' && groqApiKey) {
      try {
        const res = await this.callGroq(groqApiKey, message);
        if (res) return res;
      } catch (err: any) {
        this.logger.warn(`Groq Tier-2 fallback to Tier-1 NLU: ${err?.message || err}`);
      }
    }

    // Secondary cross-provider fallback if configured
    if (provider === 'TIER1_ONLY') return null;
    if (provider === 'GEMINI' && groqApiKey) {
      try {
        const res = await this.callGroq(groqApiKey, message);
        if (res) return res;
      } catch {
        // Ignore and use Tier 1
      }
    }
    if (provider === 'GROQ' && geminiApiKey) {
      try {
        const res = await this.callGemini(geminiApiKey, message);
        if (res) return res;
      } catch {
        // Ignore and use Tier 1
      }
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
      },
    };
  }

  private async callGemini(apiKey: string, message: string): Promise<LlmIntentResolution | null> {
    // Dynamic ESM-safe import compatible with CommonJS NestJS compilation
    const genaiMod = await (new Function('s', 'return import(s)')('@google/genai') as Promise<any>);
    const GoogleGenAI = genaiMod.GoogleGenAI;
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.interactions.create({
      model: 'gemini-3.8-flash',
      input:
        `You are Marquee, a deterministic Indonesian personal finance ERP assistant (IDR). Always invoke exactly one financial tool matching the user's message rather than inventing any Rupiah figures.\n\nUser message: ${message}`,
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

  private async callGroq(apiKey: string, message: string): Promise<LlmIntentResolution | null> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0,
        messages: [
          {
            role: 'system',
            content:
              'You are Marquee, a deterministic Indonesian personal finance ERP router. Pick exactly one financial tool and extract structured IDR parameters.',
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
      throw new Error(`Groq HTTP ${res.status}`);
    }
    const payload: any = await res.json();
    const call = payload?.choices?.[0]?.message?.tool_calls?.[0]?.function;
    if (call?.name && MARQUEE_TOOL_DEFS.some((t) => t.name === call.name)) {
      let parsedArgs: Record<string, any> = {};
      try {
        parsedArgs = call.arguments ? JSON.parse(call.arguments) : {};
      } catch {
        parsedArgs = {};
      }
      return {
        usedProvider: 'GROQ',
        model: 'llama-3.3-70b-versatile',
        tool: call.name as MarqueeToolName,
        args: parsedArgs,
      };
    }

    return null;
  }
}
