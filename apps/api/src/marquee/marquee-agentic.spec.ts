import * as fs from 'fs';
import * as path from 'path';
import {
  applyFollowUpHistory,
  detectCompoundSecondaryIntent,
  parseMarqueeIntent,
} from './marquee-nlu';
import { MarqueeToolsService } from './marquee-tools.service';
import { MarqueeLlmService } from './marquee-llm.service';
import { MarqueeService, MarqueeStreamStatusEvent } from './marquee.service';
import { MarqueeContextHydrator } from './marquee-context.service';

describe('Workstream 2 — Marquee Agentic Co-Pilot Upgrade (TDD)', () => {
  it('routes casual greetings and capability questions to greeting_or_help without dumping financial pulse cards or Standard-user leaks', async () => {
    for (const phrase of ['hi', 'Hello', 'halo marquee', 'hai', 'selamat pagi', 'makasih', '你好', 'bisa apa aja']) {
      const parsed = parseMarqueeIntent(phrase);
      expect(parsed.tool).toBe('greeting_or_help');
    }

    const tools = new MarqueeToolsService(
      {
        getDefaultActivePeriod: jest.fn().mockResolvedValue({ month: 11, year: 2026 }),
        getOrCreateDraftSnapshot: jest.fn().mockResolvedValue({
          id: 40,
          month: 11,
          year: 2026,
          finalTotalIncome: 10_000_000,
          actualDailyOperational: 2_500_000,
          deficitUncovered: 0,
        }),
      } as any,
      {} as any,
      {
        getPacing: jest.fn().mockResolvedValue({
          cycleTemporalState: 'ACTIVE',
          weightedSafeToSpendToday: 95_000,
          safeToSpendToday: 95_000,
          remainingBudget: 760_000,
          daysRemaining: 8,
        }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const stdGreeting = await tools.executeTool(
      'greeting_or_help',
      { query: 'hi', locale: 'en' },
      { userId: 4, month: 11, year: 2026 },
    );
    expect(stdGreeting.ok).toBe(true);
    expect(stdGreeting.cards).toEqual([]);
    expect(stdGreeting.summary).toMatch(/Rp 95\.000/);
    expect(stdGreeting.summary).not.toMatch(/SPayLater|SPinjam|Natal THR|Permata/i);

    const idGreeting = await tools.executeTool(
      'greeting_or_help',
      { query: 'halo pagi', locale: 'id' },
      { userId: 4, month: 11, year: 2026 },
    );
    expect(idGreeting.ok).toBe(true);
    expect(idGreeting.summary).toMatch(/Rp 95\.000/);
    expect(idGreeting.summary).not.toMatch(/Great question/i);
  });

  it('scrubs all model names, provider IDs, and internal tool/enum tags from chatWithProgress responses and streamed status events', async () => {
    const prismaMock: any = {
      globalConfig: {
        findFirst: jest.fn().mockResolvedValue({
          userId: 1,
          financialPolicyJson: {},
        }),
      },
    };
    const toolsSvcMock: any = {
      executeTool: jest.fn().mockResolvedValue({
        ok: true,
        tool: 'prepare_quick_transaction',
        summary: 'Ready to record Kopi Kenangan (Rp 45.000).',
        cards: [{ label: 'Amount', value: 'Rp 45.000' }],
        pendingAction: {
          type: 'CONFIRM_EXPENSE',
          payload: { title: 'Kopi Kenangan', amountRp: 45000 },
        },
      }),
      getUserMemoryRules: jest.fn().mockResolvedValue([]),
    };
    const llmSvcMock: any = {
      resolveWithProvider: jest.fn().mockResolvedValue({
        usedProvider: 'DEEPSEEK',
        model: 'deepseek-flash',
        tool: 'prepare_quick_transaction',
        args: { title: 'Kopi Kenangan', amountRp: 45000 },
        reasoning: 'Calling prepare_quick_transaction and CONFIRM_EXPENSE via deepseek-flash.',
        didCallTool: true,
        synthesizedInLoop: false,
      }),
      synthesizeToolResult: jest.fn().mockResolvedValue(null),
    };

    const marqueeSvc = new MarqueeService(prismaMock, toolsSvcMock, llmSvcMock, {
      hydrateForUser: jest.fn().mockResolvedValue({
        activePeriod: { periodTag: '11/2026', cycleTemporalState: 'ACTIVE', cycleDateLabel: '28 Oct - 26 Nov' },
        dueDayCalendar: { activeCycleItems: [], canonicalDueDays: [8, 11, 17, 23, 24, 25] },
        creditCardsAndContracts: [],
        wishlistItems: [],
        proactiveReminders: [],
        memoryRules: [],
        systemPrompt: 'Hydrated context',
        uiContext: { activeRoute: '/', activeSubTab: null, locale: 'en' },
      }),
    } as any);

    const emitted: MarqueeStreamStatusEvent[] = [];
    const res = await marqueeSvc.chatWithProgress(
      1,
      { message: 'log kopi 45k', month: 11, year: 2026 },
      (ev) => emitted.push(ev),
    );

    const serializedEvents = JSON.stringify(emitted);
    expect(serializedEvents).not.toMatch(/Provider:|DEEPSEEK|GEMINI|GROQ|OPENCODE|deepseek-|gemini-|llama-|CONFIRM_EXPENSE|prepare_quick_transaction/i);

    const serializedReply = JSON.stringify({
      summary: res.summary,
      assistantPrefix: res.assistantPrefix,
      reasoning: res.reasoning,
      agentSteps: res.agentSteps,
    });
    expect(serializedReply).not.toMatch(/deepseek-|gemini-|llama-|TIER1_NLU|TIER2_|prepare_quick_transaction|CONFIRM_EXPENSE/i);
  });

  it('maintains multi-turn conversation history across Tier 1 follow-ups and LLM provider payloads', async () => {
    const history = [
      { role: 'user' as const, text: 'beli kopi kenangan 45rb' },
      { role: 'assistant' as const, text: 'Siap catat Kopi Kenangan sebesar Rp 45.000.' },
    ];
    const followUpMsg = 'pake spaylater aja';
    const rawParsed = parseMarqueeIntent(followUpMsg);
    const enriched = applyFollowUpHistory(rawParsed, followUpMsg, history);
    expect(enriched.tool).toBe('log_quick_expense');
    expect(enriched.amountRp).toBe(45000);
    expect(enriched.instrument).toBe('PAYLATER');
    expect(enriched.title?.toLowerCase()).toContain('kopi');

    const llm = new MarqueeLlmService();
    const origFetch = global.fetch;
    try {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Noted, using SPayLater for Kopi Kenangan Rp 45.000.' } }],
        }),
      });
      global.fetch = fetchMock as any;

      await llm.resolveWithProvider({
        provider: 'DEEPSEEK',
        deepseekApiKey: 'sk-test-123',
        message: followUpMsg,
        history,
        tier1Fallback: enriched,
      });

      const bodySent = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
      expect(bodySent.messages.some((m: any) => m.role === 'user' && m.content === 'beli kopi kenangan 45rb')).toBe(true);
      expect(bodySent.messages.some((m: any) => m.role === 'assistant' && m.content.includes('Rp 45.000'))).toBe(true);
    } finally {
      global.fetch = origFetch;
    }
  });

  it('supports Tier 1 compound multi-step reasoning and routes Go stress-test + returns 16 MCP tools', async () => {
    const compoundMsg = 'cek saldo hari ini dan simulasi sepatu 300rb spaylater';
    const secondary = detectCompoundSecondaryIntent(compoundMsg);
    expect(secondary).toBeDefined();
    expect(secondary?.tool).toBe('evaluate_affordability');
    expect(secondary?.amountRp).toBe(300000);
    expect(secondary?.instrument).toBe('PAYLATER');

    const stressParsed = parseMarqueeIntent('tolong stress test keuangan saya 12 bulan ke depan');
    expect(stressParsed.tool).toBe('run_stress_test');

    const runStressTestMock = jest.fn().mockResolvedValue({
      period: { month: 11, year: 2026 },
      monthlySurplusRp: 2_000_000,
      monteCarlo: {
        trialsRun: 2000,
        workerGoroutines: 8,
        computeDurationUs: 2400,
        survivalProbabilityPct: 91.5,
        emergencyGoalProbabilityPct: 68.0,
        p5WorstCaseCashFloorRp: -120_000,
        p10EndingWealthRp: 8_400_000,
        p50MedianEndingWealthRp: 14_200_000,
        p90EndingWealthRp: 21_500_000,
        recommendedExtraBufferMonthlyRp: 50_000,
        fanSeries: [],
      },
      optimizer: {
        combinationsEvaluated: 1771,
        strategies: [
          {
            code: 'BALANCED_RESILIENCE',
            title: 'Balanced Resilience',
            debtPrepaymentRp: 900_000,
            emergencyFundRp: 700_000,
            goalSavingsRp: 200_000,
            flexibleRp: 200_000,
          },
        ],
      },
    });
    const tools = new MarqueeToolsService(
      { getDefaultActivePeriod: jest.fn().mockResolvedValue({ month: 11, year: 2026 }) } as any,
      {} as any,
      { runStressTestForUser: runStressTestMock } as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const stressOut = await tools.executeTool('run_stress_test', {}, { userId: 4, month: 11, year: 2026 });
    expect(stressOut.ok).toBe(true);
    expect(runStressTestMock).toHaveBeenCalledWith(expect.any(Object), 4);
    expect(stressOut.summary).toContain('91.5%');

    const svc = new MarqueeService({} as any, tools, {} as any);
    const listRes: any = await svc.handleMcpRpc(4, { jsonrpc: '2.0', id: 9, method: 'tools/list' });
    const mcpNames: string[] = listRes.result.tools.map((t: any) => t.name);
    expect(mcpNames).toContain('run_stress_test');
    expect(mcpNames.length).toBe(16);
  });

  it('serves tenant-scoped UI context from GET /api/marquee/context with zero Gabriel prompts for Standard users', async () => {
    const svc = new MarqueeService(
      { globalConfig: { findFirst: jest.fn().mockResolvedValue({ userId: 4 }) } } as any,
      { getUserMemoryRules: jest.fn().mockResolvedValue([]) } as any,
      {} as any,
      new MarqueeContextHydrator(
        {
          monthlySnapshot: { findMany: jest.fn().mockResolvedValue([]) },
          liabilityLineItem: { findMany: jest.fn().mockResolvedValue([]) },
          transaction: { findMany: jest.fn().mockResolvedValue([]) },
          creditCardTransaction: { findMany: jest.fn().mockResolvedValue([]) },
          creditContract: { findMany: jest.fn().mockResolvedValue([]) },
          wishlistItem: { findMany: jest.fn().mockResolvedValue([]) },
          savingsGoal: { findMany: jest.fn().mockResolvedValue([]) },
          globalConfig: { findFirst: jest.fn().mockResolvedValue({ userId: 4, profileMode: 'STANDARD_GENERAL' }) },
        } as any,
        { getDefaultActivePeriod: jest.fn().mockResolvedValue({ month: 11, year: 2026 }) } as any,
        {
          getPacing: jest.fn().mockResolvedValue({
            cycleTemporalState: 'ACTIVE',
            remainingBudget: 1_200_000,
            weightedSafeToSpendToday: 120_000,
            daysRemaining: 8,
            cycleDateLabel: '1 Nov – 30 Nov 2026',
          }),
        } as any,
        { getOverview: jest.fn().mockResolvedValue({ totalBalance: 5_000_000, rdpuBalance: 0 }) } as any,
      ),
    );

    const stdUiCtx = await svc.getHydratedUiContext(4, { month: 11, year: 2026, locale: 'en' });
    expect(stdUiCtx.isBespokeWorkspace).toBe(false);
    expect(stdUiCtx.payoffMilestones).toEqual([]);
    const joined = JSON.stringify(stdUiCtx);
    expect(joined).not.toMatch(/Natal THR|SPayLater|SPinjam|Permata|JAN '27|8th.*11th.*17th/i);
  });
});
