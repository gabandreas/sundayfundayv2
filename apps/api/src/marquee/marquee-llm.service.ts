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
  tool: MarqueeToolName | null;
  args: Record<string, any>;
  assistantPrefix?: string;
  reasoning?: string;
  didCallTool?: boolean;
  toolCallId?: string;
  endpointUrlUsed?: string;
  apiKeyUsed?: string;
}

export function stripReasoningBlocks(rawText?: string | null): {
  cleanText: string;
  reasoning?: string;
} {
  if (!rawText || typeof rawText !== 'string') {
    return { cleanText: '' };
  }
  const reasonParts: string[] = [];
  const cleaned = rawText
    .replace(/<think>([\s\S]*?)<\/think>/gi, (_match, inner) => {
      const trimmed = String(inner ?? '').trim();
      if (trimmed) reasonParts.push(trimmed);
      return '';
    })
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+\./g, '.')
    .trim();
  return {
    cleanText: cleaned,
    ...(reasonParts.length > 0 ? { reasoning: reasonParts.join('\n\n') } : {}),
  };
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
      'Simulate SPayLater (dynamic daysInMonth(M) - 15 cutoff -> 25th due) or Bank Permata Credit Card (25th closing cutoff -> 11th due + H-1 business day shift) billing cycle landing and post-purchase DSR impact.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        amountRp: { type: 'number' },
        instrument: { type: 'string', enum: ['CASH', 'PAYLATER', 'CREDIT_CARD'] },
        tenorMonths: { type: 'number' },
        purchaseDate: {
          type: 'string',
          description: 'Optional purchase date in YYYY-MM-DD (defaults to today)',
        },
      },
      required: [],
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
      'Preview or stage an expense or credit charge (CASH, PAYLATER, CREDIT_CARD) behind a confirmation gate with Rupiah amount, optional purchaseDate (YYYY-MM-DD), optional billingStartMonth/billingStartYear, and installment tenor.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Merchant or expense item label' },
        amountRp: { type: 'number', description: 'Total Rupiah amount (integer)' },
        instrument: { type: 'string', enum: ['CASH', 'PAYLATER', 'CREDIT_CARD'] },
        tenorMonths: { type: 'number', description: 'Installment months (default 1)' },
        purchaseDate: { type: 'string', description: 'Optional purchase date YYYY-MM-DD' },
        billingStartMonth: { type: 'number', description: 'Optional explicit billing cycle month 1-12' },
        billingStartYear: { type: 'number', description: 'Optional explicit billing cycle year' },
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
  {
    name: 'manage_liability_item',
    description:
      'Shift a PayLater or SPinjam liability item to an earlier/later cycle, split, or mark settled behind a 1-click confirmation gate.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['SHIFT_EARLIER', 'SHIFT_LATER', 'SETTLE', 'UNSETTLE'] },
        itemId: { type: 'number', description: 'Optional exact LiabilityLineItem ID if known' },
        itemQuery: { type: 'string', description: 'Search substring e.g. Americano or SPinjam' },
        splitAmount: { type: 'number' },
      },
      required: ['action'],
    },
  },
  {
    name: 'revise_budget_or_quota',
    description:
      'Update a cycle budget or routine quota (DAILY_OPERATIONAL, SAVINGS, TRANSPORT, INTERNET, VAPE, HAIRCUT) behind a confirmation gate.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['DAILY_OPERATIONAL', 'SAVINGS', 'SELF_REWARD', 'BUFFER', 'TRANSPORT', 'INTERNET', 'VAPE', 'HAIRCUT'],
        },
        newValueRp: { type: 'number' },
        month: { type: 'number' },
        year: { type: 'number' },
        reason: { type: 'string' },
      },
      required: ['category', 'newValueRp'],
    },
  },
  {
    name: 'manage_savings_pocket_or_goal',
    description:
      'Record a savings top-up/withdrawal or update savings goals/allocations behind a confirmation gate.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['TOPUP', 'WITHDRAWAL', 'CREATE_GOAL'] },
        label: { type: 'string' },
        amountRp: { type: 'number' },
        instrumentType: { type: 'string', enum: ['LIQUID_CASH', 'RDPU', 'BANK_SAVINGS'] },
      },
      required: ['action', 'amountRp'],
    },
  },
  {
    name: 'manage_wishlist_or_subscription',
    description:
      'Add a wishlist target or toggle a subscription/promo kill-switch behind a confirmation gate.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['ADD_WISHLIST', 'TOGGLE_KILL_SWITCH'] },
        title: { type: 'string' },
        amountRp: { type: 'number' },
        itemId: { type: 'number' },
        confirmCancel: { type: 'boolean' },
      },
      required: ['action'],
    },
  },
  {
    name: 'run_what_if_scenario',
    description:
      'Simulate a 12-month what-if scenario (extra monthly savings, bonus, or debt reduction) and return net worth delta.',
    parameters: {
      type: 'object',
      properties: {
        extraMonthlySavingsRp: { type: 'number' },
        oneTimeBonusRp: { type: 'number' },
        reduceMonthlyDebtRp: { type: 'number' },
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
            model: deepseekModel || 'deepseek-flash',
            message,
            systemContextPrompt,
            tier1Fallback,
          });
        } catch (err: any) {
          this.logger.warn(`DeepSeek Tier-2 fallback: ${err?.message || err}`);
        }
      }

      if (target === 'OPENCODE' && opencodeApiKey) {
        const cleanBase = String(opencodeBaseUrl || 'https://opencode.ai/zen/v1').replace(/\/+$/, '');
        try {
          return await this.callOpenAiCompatible({
            usedProvider: 'OPENCODE',
            endpointUrl: `${cleanBase}/chat/completions`,
            apiKey: opencodeApiKey,
            model: opencodeModel || 'deepseek-v4.1-flash-free',
            message,
            systemContextPrompt,
            tier1Fallback,
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
            tier1Fallback,
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
    tier1Fallback?: MarqueeParsedIntent;
  }): Promise<LlmIntentResolution | null> {
    const {
      usedProvider,
      endpointUrl,
      apiKey,
      model,
      message,
      systemContextPrompt,
      tier1Fallback,
    } = params;
    const toolPolicy = [
      'TOOL USAGE POLICY:',
      '- For casual greetings (hi, halo, thanks) or analytical questions you can answer accurately from the hydrated ERP ledger below (credit cards, contracts, wishlist, savings pockets, subscriptions, routine quotas, snapshots), answer directly in crisp human prose WITHOUT forcing a tool call.',
      '- Invoke `simulate_purchase_cutoff` whenever the user asks when a purchase will bill/fall due (e.g. "gesek permata cc tanggal 26 nov masuk tagihan kapan?", "spaylater 23 nov masuk desember atau januari?"), passing `instrument` (`CREDIT_CARD` or `PAYLATER`), `purchaseDate` in `YYYY-MM-DD`, and `amountRp: 0` if no nominal is stated.',
      '- Invoke `get_paycycle_pulse` when checking today’s safe-to-spend, remaining cash, or cycle countdown.',
      '- You CAN also perform write service actions for the user behind a 1-click confirmation gate: `prepare_quick_transaction` (log cash/paylater/cc expense with optional purchaseDate or explicit billingStartMonth/billingStartYear), `manage_liability_item` (shift bill earlier/later or settle), `revise_budget_or_quota` (update cycle budgets), `manage_savings_pocket_or_goal` (savings deposits/goals), `manage_wishlist_or_subscription` (wishlist add or subscription kill-switch), and `run_what_if_scenario` (12-month simulation).',
      '- STRICT COPY RULE: Never output emojis, generic buzzwords, or artificial terms like Vault, Forward-Borrow, or Outlook. Use Emergency Fund, Savings Reserve, and Temporary Savings Advance.',
    ].join('\n');
    const sys = systemContextPrompt
      ? `${systemContextPrompt}\n\n${toolPolicy}`
      : `You are Marquee, an Indonesian personal finance ERP co-pilot.\n\n${toolPolicy}`;

    const executeRequest = async (url: string, targetModel: string, includeTools: boolean) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: targetModel,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: sys,
            },
            { role: 'user', content: message },
          ],
          ...(includeTools
            ? {
                tools: MARQUEE_TOOL_DEFS.map((t) => ({
                  type: 'function',
                  function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                  },
                })),
                tool_choice: 'auto',
              }
            : {}),
        }),
      });

    let effectiveUrl = endpointUrl;
    let effectiveModel = model;
    let res = await executeRequest(effectiveUrl, effectiveModel, true);

    // If proxy endpoint rejects tools parameter (400/422), retry without tools
    if (!res.ok && (res.status === 400 || res.status === 422)) {
      res = await executeRequest(effectiveUrl, effectiveModel, false);
    }

    // If OPENCODE endpoint returns 401/403/404 with a native DeepSeek sk-... key, bridge to api.deepseek.com
    if (
      !res.ok &&
      usedProvider === 'OPENCODE' &&
      (res.status === 401 || res.status === 403 || res.status === 404) &&
      apiKey.startsWith('sk-') &&
      !endpointUrl.includes('api.deepseek.com')
    ) {
      effectiveUrl = 'https://api.deepseek.com/v1/chat/completions';
      const lower = model.toLowerCase();
      effectiveModel = lower.includes('reason')
        ? 'deepseek-reasoner'
        : lower.includes('pro')
          ? 'deepseek-v4-pro'
          : 'deepseek-flash';
      res = await executeRequest(effectiveUrl, effectiveModel, true);
      if (!res.ok && (res.status === 400 || res.status === 422)) {
        res = await executeRequest(effectiveUrl, effectiveModel, false);
      }
    }

    if (!res.ok) {
      throw new Error(`${usedProvider} HTTP ${res.status}`);
    }
    const payload: any = await res.json();
    const msg = payload?.choices?.[0]?.message;
    const stripped = stripReasoningBlocks(msg?.content);
    const externalReasoning =
      typeof msg?.reasoning_content === 'string' && msg.reasoning_content.trim()
        ? msg.reasoning_content.trim()
        : undefined;
    const reasoning = stripped.reasoning || externalReasoning;
    const assistantPrefix = stripped.cleanText ? stripped.cleanText : undefined;

    const firstToolCall = msg?.tool_calls?.[0];
    const call = firstToolCall?.function;
    if (call?.name && MARQUEE_TOOL_DEFS.some((t) => t.name === call.name)) {
      let parsedArgs: Record<string, any> = {};
      try {
        parsedArgs = call.arguments ? JSON.parse(call.arguments) : {};
      } catch {
        parsedArgs = {};
      }
      return {
        usedProvider,
        model: effectiveModel,
        tool: call.name as MarqueeToolName,
        args: parsedArgs,
        assistantPrefix,
        didCallTool: true,
        toolCallId: String(firstToolCall?.id || 'call_marquee_1'),
        endpointUrlUsed: effectiveUrl,
        apiKeyUsed: apiKey,
        ...(reasoning ? { reasoning } : {}),
      };
    }

    if (assistantPrefix) {
      return {
        usedProvider,
        model: effectiveModel,
        tool: null,
        args: {},
        assistantPrefix,
        didCallTool: false,
        endpointUrlUsed: effectiveUrl,
        apiKeyUsed: apiKey,
        ...(reasoning ? { reasoning } : {}),
      };
    }

    return null;
  }

  async synthesizeToolResult(params: {
    endpointUrl: string;
    apiKey: string;
    model: string;
    message: string;
    systemContextPrompt?: string;
    toolCallId: string;
    toolName: string;
    toolArgs: Record<string, any>;
    toolPayload: Record<string, any>;
  }): Promise<{ reply: string; reasoning?: string } | null> {
    const {
      endpointUrl,
      apiKey,
      model,
      message,
      systemContextPrompt,
      toolCallId,
      toolName,
      toolArgs,
      toolPayload,
    } = params;

    const synthSys = [
      systemContextPrompt || 'You are Marquee, a sharp financial co-pilot.',
      '',
      'Use ONLY exact verified numbers and dates from the tool JSON result below. Do not invent numbers. Write naturally in the same language as the user (EN, ID, or ZH), cleanly formatted with concise Markdown. Never output emojis anywhere.',
    ].join('\n');

    const runTurn2 = async (useToolMessages: boolean) =>
      fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(
          useToolMessages
            ? {
                model,
                temperature: 0.25,
                tools: MARQUEE_TOOL_DEFS.map((t) => ({
                  type: 'function',
                  function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                  },
                })),
                messages: [
                  { role: 'system', content: synthSys },
                  { role: 'user', content: message },
                  {
                    role: 'assistant',
                    content: '',
                    tool_calls: [
                      {
                        id: toolCallId,
                        type: 'function',
                        function: {
                          name: toolName,
                          arguments: JSON.stringify(toolArgs ?? {}),
                        },
                      },
                    ],
                  },
                  {
                    role: 'tool',
                    tool_call_id: toolCallId,
                    content: JSON.stringify(toolPayload),
                  },
                ],
              }
            : {
                model,
                temperature: 0.25,
                messages: [
                  {
                    role: 'system',
                    content: `${synthSys}\n\nVERIFIED_TOOL_RESULT_JSON (${toolName}):\n${JSON.stringify(toolPayload)}`,
                  },
                  { role: 'user', content: message },
                ],
              },
        ),
      });

    try {
      let res = await runTurn2(true);
      if (!res.ok) {
        this.logger.warn(`Turn-2 tool synthesis HTTP ${res.status}, retrying plain synthesis`);
        res = await runTurn2(false);
      }
      if (!res.ok) return null;
      let json: any = await res.json();
      let msg = json?.choices?.[0]?.message;
      let stripped = stripReasoningBlocks(msg?.content);
      if (!stripped.cleanText.trim()) {
        const plainRes = await runTurn2(false);
        if (plainRes.ok) {
          json = await plainRes.json();
          msg = json?.choices?.[0]?.message;
          stripped = stripReasoningBlocks(msg?.content);
        }
      }
      const externalReasoning =
        typeof msg?.reasoning_content === 'string' && msg.reasoning_content.trim()
          ? msg.reasoning_content.trim()
          : undefined;
      const clean = stripped.cleanText.trim();
      if (!clean) return null;
      return {
        reply: clean,
        reasoning: stripped.reasoning || externalReasoning,
      };
    } catch {
      return null;
    }
  }
}
