import { Injectable, Logger } from '@nestjs/common';
import { MarqueeParsedIntent, MarqueeToolName } from './marquee-nlu';

export type MarqueeAiProvider =
  | 'TIER1_ONLY'
  | 'GEMINI'
  | 'GROQ'
  | 'DEEPSEEK'
  | 'OPENCODE'
  | 'AUTO';

export interface MarqueeLoopHop {
  tool: MarqueeToolName;
  args: Record<string, any>;
  result: any;
  durationMs: number;
}

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
  finalToolResult?: any;
  executedHops?: MarqueeLoopHop[];
  synthesizedInLoop?: boolean;
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
  {
    name: 'manage_user_memory',
    description:
      'Remember, list, or forget user-specific financial rules and merchant payment preferences (e.g. "always log coffee on SPayLater").',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['REMEMBER', 'LIST', 'FORGET'] },
        ruleText: { type: 'string', description: 'Human-readable preference rule to remember' },
        merchantPattern: { type: 'string', description: 'Keyword trigger like kopi or grab' },
        defaultInstrument: { type: 'string', enum: ['CASH', 'PAYLATER', 'CREDIT_CARD'] },
        memoryId: { type: 'string', description: 'ID or keyword to forget when action=FORGET' },
      },
      required: ['action'],
    },
  },
  {
    name: 'search_financial_history',
    description:
      'Search user-scoped historical transactions, credit card charges, and PayLater/loan bills with synonym expansion and exact totals.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keyword e.g. kopi, grab, sepatu, nike' },
      },
      required: ['query'],
    },
  },
  {
    name: 'run_stress_test',
    description:
      'Run a 2,000-path probabilistic cashflow stress test and surplus allocation optimizer over the next 12 months.',
    parameters: {
      type: 'object',
      properties: {
        incomeVolatilityPct: { type: 'number', description: 'Income volatility % (0-40)' },
        expenseShockProbPct: { type: 'number', description: 'Expense shock probability % (0-50)' },
      },
    },
  },
  {
    name: 'refuse_out_of_scope',
    description:
      'Politely refuse requests outside Sunday Funday financial ERP (such as downloads, shell/terminal execution, file access, or raw ExecuteSQL).',
    parameters: {
      type: 'object',
      properties: {
        reasonQuery: { type: 'string' },
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
    history?: Array<{ role: 'user' | 'assistant'; text: string }>;
    tier1Fallback: MarqueeParsedIntent;
    executeTool?: (toolName: MarqueeToolName, args: Record<string, any>) => Promise<any>;
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
      history,
      tier1Fallback,
      executeTool,
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
            history,
            systemContextPrompt,
            tier1Fallback,
            executeTool,
          });
        } catch (err: any) {
          this.logger.warn(`DeepSeek fallback: ${err?.message || err}`);
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
            history,
            systemContextPrompt,
            tier1Fallback,
            executeTool,
          });
        } catch (err: any) {
          this.logger.warn(`OpenCode fallback: ${err?.message || err}`);
        }
      }

      if (target === 'GEMINI' && geminiApiKey) {
        try {
          return await this.callGemini(geminiApiKey, message, systemContextPrompt, history, executeTool);
        } catch (err: any) {
          this.logger.warn(`Gemini fallback: ${err?.message || err}`);
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
            history,
            systemContextPrompt,
            tier1Fallback,
            executeTool,
          });
        } catch (err: any) {
          this.logger.warn(`Groq fallback: ${err?.message || err}`);
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
    history?: Array<{ role: 'user' | 'assistant'; text: string }>,
    executeTool?: (toolName: MarqueeToolName, args: Record<string, any>) => Promise<any>,
  ): Promise<LlmIntentResolution | null> {
    const sys = systemContextPrompt
      ? `${systemContextPrompt}\n\nAlways invoke a financial tool when asked to calculate, search, stress-test, or record ledger entries. Never invent Rupiah figures, and never mention model names or internal tool names to the user. For greetings ("hi", "halo"), reply warmly and concisely without forcing a tool call.`
      : `You are Marquee, a deterministic personal finance ERP assistant (IDR). Never mention AI model names or internal function names.`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const contents: Array<Record<string, any>> = (history ?? [])
      .slice(-8)
      .filter((h) => h && h.text && h.text.trim())
      .map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.text.trim().slice(0, 1200) }],
      }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    const executedHops: MarqueeLoopHop[] = [];
    const reasoningParts: string[] = [];
    let lastToolName: MarqueeToolName | null = null;
    let lastToolArgs: Record<string, any> = {};
    let lastToolResult: any = null;
    const maxHops = executeTool ? 4 : 1;

    for (let hop = 0; hop < maxHops; hop++) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents,
          tools: [
            {
              functionDeclarations: MARQUEE_TOOL_DEFS.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              })),
            },
          ],
          generationConfig: { temperature: 0.2 },
        }),
      });

      if (!res.ok) {
        if (executedHops.length > 0 && lastToolResult) break;
        throw new Error(`GEMINI HTTP ${res.status}`);
      }

      const payload: any = await res.json();
      const parts: any[] = payload?.candidates?.[0]?.content?.parts ?? [];
      const fnCall = parts.find((p) => p?.functionCall?.name)?.functionCall;

      if (fnCall?.name && MARQUEE_TOOL_DEFS.some((t) => t.name === fnCall.name)) {
        const callName = fnCall.name as MarqueeToolName;
        const parsedArgs = typeof fnCall.args === 'object' && fnCall.args ? fnCall.args : {};
        lastToolName = callName;
        lastToolArgs = parsedArgs;

        if (!executeTool) {
          return {
            usedProvider: 'GEMINI',
            model: 'gemini-2.5-flash',
            tool: callName,
            args: parsedArgs,
          };
        }

        const hopT0 = Date.now();
        const hopResult = await executeTool(callName, parsedArgs);
        executedHops.push({
          tool: callName,
          args: parsedArgs,
          result: hopResult,
          durationMs: Math.max(1, Date.now() - hopT0),
        });
        lastToolResult = hopResult;

        contents.push({ role: 'model', parts: [{ functionCall: { name: callName, args: parsedArgs } }] });
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: callName,
                response: {
                  ok: hopResult?.ok ?? true,
                  summary: hopResult?.summary,
                  cards: hopResult?.cards,
                  ...(hopResult?.data ? { data: hopResult.data } : {}),
                },
              },
            },
          ],
        });
        if (hopResult?.pendingAction || callName === 'refuse_out_of_scope') {
          break;
        }
        continue;
      }

      const rawText = parts
        .map((p) => (typeof p?.text === 'string' ? p.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim();
      const stripped = stripReasoningBlocks(rawText);
      if (stripped.reasoning) reasoningParts.push(stripped.reasoning);
      if (executedHops.length > 0 && lastToolName) {
        return {
          usedProvider: 'GEMINI',
          model: 'gemini-2.5-flash',
          tool: lastToolName,
          args: lastToolArgs,
          assistantPrefix: stripped.cleanText || undefined,
          didCallTool: true,
          finalToolResult: lastToolResult,
          executedHops,
          synthesizedInLoop: Boolean(stripped.cleanText),
          ...(reasoningParts.length > 0 ? { reasoning: reasoningParts.join('\n\n') } : {}),
        };
      }
      if (stripped.cleanText) {
        return {
          usedProvider: 'GEMINI',
          model: 'gemini-2.5-flash',
          tool: null,
          args: {},
          assistantPrefix: stripped.cleanText,
          didCallTool: false,
          ...(reasoningParts.length > 0 ? { reasoning: reasoningParts.join('\n\n') } : {}),
        };
      }
      break;
    }

    if (executedHops.length > 0 && lastToolName) {
      return {
        usedProvider: 'GEMINI',
        model: 'gemini-2.5-flash',
        tool: lastToolName,
        args: lastToolArgs,
        didCallTool: true,
        finalToolResult: lastToolResult,
        executedHops,
        synthesizedInLoop: false,
        ...(reasoningParts.length > 0 ? { reasoning: reasoningParts.join('\n\n') } : {}),
      };
    }

    return null;
  }

  private async callOpenAiCompatible(params: {
    usedProvider: 'GROQ' | 'DEEPSEEK' | 'OPENCODE';
    endpointUrl: string;
    apiKey: string;
    model: string;
    message: string;
    history?: Array<{ role: 'user' | 'assistant'; text: string }>;
    systemContextPrompt?: string;
    tier1Fallback?: MarqueeParsedIntent;
    executeTool?: (toolName: MarqueeToolName, args: Record<string, any>) => Promise<any>;
  }): Promise<LlmIntentResolution | null> {
    const {
      usedProvider,
      endpointUrl,
      apiKey,
      model,
      message,
      history,
      systemContextPrompt,
      executeTool,
    } = params;
    const toolPolicy = [
      'TOOL USAGE & DOMAIN POLICY:',
      '- DOMAIN BOUNDARY: You ONLY operate Sunday Funday ERP financial tools. You have NO terminal, shell, OS filesystem, external downloader, or raw SQL (ExecuteSQL) tool. For unrelated or out-of-scope requests, invoke `refuse_out_of_scope` or reply politely stating what financial ERP tasks you can help with.',
      '- IDENTITY & SECRECY: Never reveal or mention underlying LLM model IDs, provider names (DeepSeek, Gemini, Groq, OpenAI, Llama), "Tier 1/Tier 2", or internal snake_case function names to the user.',
      '- MULTI-STEP WORKFLOW: When checking eligibility before acting (e.g. check balance/headroom first, then stage an expense or shift), you may chain read-only tools (`get_paycycle_pulse`, `simulate_purchase_cutoff`, `search_financial_history`, `run_stress_test`) before staging a write confirmation.',
      '- For casual greetings ("hi", "halo", "pagi", "thanks"), respond naturally and concisely in the same language WITHOUT dumping dense multi-card ledgers unless asked.',
      '- Invoke `simulate_purchase_cutoff` whenever asked when a purchase bills/falls due (`instrument`, `purchaseDate` YYYY-MM-DD, `amountRp: 0` if unspecified).',
      '- Invoke `search_financial_history` when searching historical spending across past months (`query`).',
      '- Invoke `run_stress_test` when asked for 12-month survival probability, Monte Carlo simulation, or optimal surplus split.',
      '- Invoke `manage_user_memory` (`REMEMBER` / `LIST` / `FORGET`) when asked to remember or list personal payment defaults or rules.',
      '- Stage write requests behind 1-click confirmation via `prepare_quick_transaction`, `manage_liability_item`, `revise_budget_or_quota`, `manage_savings_pocket_or_goal`, `manage_wishlist_or_subscription`, or `run_what_if_scenario`.',
      '- STRICT COPY RULE: Never output emojis or artificial terms like Vault, Forward-Borrow, or Outlook. Use Emergency Fund, Savings Reserve, and Temporary Savings Advance.',
    ].join('\n');
    const sys = systemContextPrompt
      ? `${systemContextPrompt}\n\n${toolPolicy}`
      : `You are Marquee, a personal finance ERP co-pilot.\n\n${toolPolicy}`;

    const historyMsgs: Array<Record<string, any>> = (history ?? [])
      .slice(-8)
      .filter((h) => h && h.text && h.text.trim())
      .map((h) => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.text.trim().slice(0, 1200),
      }));

    const messages: Array<Record<string, any>> = [
      { role: 'system', content: sys },
      ...historyMsgs,
      { role: 'user', content: message },
    ];

    const sendChat = async (url: string, targetModel: string, includeTools: boolean) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: targetModel,
          temperature: 0.2,
          messages,
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
    const executedHops: MarqueeLoopHop[] = [];
    const reasoningParts: string[] = [];
    let lastToolName: MarqueeToolName | null = null;
    let lastToolArgs: Record<string, any> = {};
    let lastToolCallId: string | undefined;
    let lastToolResult: any = null;
    const MAX_AGENT_HOPS = executeTool ? 4 : 1;

    for (let hop = 0; hop < MAX_AGENT_HOPS; hop++) {
      let res = await sendChat(effectiveUrl, effectiveModel, true);

      if (!res.ok && (res.status === 400 || res.status === 422)) {
        res = await sendChat(effectiveUrl, effectiveModel, false);
      }

      if (
        hop === 0 &&
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
        res = await sendChat(effectiveUrl, effectiveModel, true);
        if (!res.ok && (res.status === 400 || res.status === 422)) {
          res = await sendChat(effectiveUrl, effectiveModel, false);
        }
      }

      if (!res.ok) {
        if (executedHops.length > 0 && lastToolResult) break;
        throw new Error(`${usedProvider} HTTP ${res.status}`);
      }

      const payload: any = await res.json();
      const msg = payload?.choices?.[0]?.message;
      const stripped = stripReasoningBlocks(msg?.content);
      const externalReasoning =
        typeof msg?.reasoning_content === 'string' && msg.reasoning_content.trim()
          ? msg.reasoning_content.trim()
          : undefined;
      if (stripped.reasoning) reasoningParts.push(stripped.reasoning);
      else if (externalReasoning) reasoningParts.push(externalReasoning);
      const assistantText = stripped.cleanText ? stripped.cleanText : undefined;

      const firstToolCall = msg?.tool_calls?.[0];
      const call = firstToolCall?.function;
      if (call?.name && MARQUEE_TOOL_DEFS.some((t) => t.name === call.name)) {
        let parsedArgs: Record<string, any> = {};
        try {
          parsedArgs = call.arguments ? JSON.parse(call.arguments) : {};
        } catch {
          parsedArgs = {};
        }
        const callName = call.name as MarqueeToolName;
        const callId = String(firstToolCall?.id || `call_marquee_${hop + 1}`);
        lastToolName = callName;
        lastToolArgs = parsedArgs;
        lastToolCallId = callId;

        if (!executeTool) {
          return {
            usedProvider,
            model: effectiveModel,
            tool: callName,
            args: parsedArgs,
            assistantPrefix: assistantText,
            didCallTool: true,
            toolCallId: callId,
            endpointUrlUsed: effectiveUrl,
            apiKeyUsed: apiKey,
            ...(reasoningParts.length > 0 ? { reasoning: reasoningParts.join('\n\n') } : {}),
          };
        }

        const hopT0 = Date.now();
        const hopResult = await executeTool(callName, parsedArgs);
        const hopDur = Math.max(1, Date.now() - hopT0);
        executedHops.push({
          tool: callName,
          args: parsedArgs,
          result: hopResult,
          durationMs: hopDur,
        });
        lastToolResult = hopResult;

        messages.push({
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: callId,
              type: 'function',
              function: {
                name: callName,
                arguments: JSON.stringify(parsedArgs ?? {}),
              },
            },
          ],
        });
        messages.push({
          role: 'tool',
          tool_call_id: callId,
          content: JSON.stringify({
            ok: hopResult?.ok ?? true,
            tool: hopResult?.tool ?? callName,
            summary: hopResult?.summary,
            cards: hopResult?.cards,
            ...(hopResult?.data ? { data: hopResult.data } : {}),
          }),
        });

        // Stop immediately once a write confirmation card or explicit domain refusal is reached
        if (hopResult?.pendingAction || callName === 'refuse_out_of_scope') {
          break;
        }
        continue;
      }

      // No tool call in this turn -> either pure conversational reply or synthesized conclusion after hops
      if (executedHops.length > 0 && lastToolName) {
        return {
          usedProvider,
          model: effectiveModel,
          tool: lastToolName,
          args: lastToolArgs,
          assistantPrefix: assistantText,
          didCallTool: true,
          toolCallId: lastToolCallId,
          endpointUrlUsed: effectiveUrl,
          apiKeyUsed: apiKey,
          finalToolResult: lastToolResult,
          executedHops,
          synthesizedInLoop: Boolean(assistantText),
          ...(reasoningParts.length > 0 ? { reasoning: reasoningParts.join('\n\n') } : {}),
        };
      }

      if (assistantText) {
        return {
          usedProvider,
          model: effectiveModel,
          tool: null,
          args: {},
          assistantPrefix: assistantText,
          didCallTool: false,
          endpointUrlUsed: effectiveUrl,
          apiKeyUsed: apiKey,
          ...(reasoningParts.length > 0 ? { reasoning: reasoningParts.join('\n\n') } : {}),
        };
      }

      break;
    }

    if (executedHops.length > 0 && lastToolName) {
      return {
        usedProvider,
        model: effectiveModel,
        tool: lastToolName,
        args: lastToolArgs,
        didCallTool: true,
        toolCallId: lastToolCallId,
        endpointUrlUsed: effectiveUrl,
        apiKeyUsed: apiKey,
        finalToolResult: lastToolResult,
        executedHops,
        synthesizedInLoop: false,
        ...(reasoningParts.length > 0 ? { reasoning: reasoningParts.join('\n\n') } : {}),
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
