import { UnauthorizedException } from '@nestjs/common';
import { parseMarqueeIntent } from './marquee-nlu';
import { MarqueeToolsService } from './marquee-tools.service';
import { MarqueeService } from './marquee.service';
import { MarqueeLlmService, stripReasoningBlocks } from './marquee-llm.service';
import { MarqueeContextHydrator } from './marquee-context.service';
import { encryptSecret, hashSecretToken } from '../common/crypto.util';

describe('Marquee NLU, 8 Deterministic Tools & Webhook Token Auth', () => {
  describe('Tier 1 Trilingual NLU (EN / ID / ZH)', () => {
    it('parses Rupiah shorthands k, rb, jt, juta cleanly across instruments', () => {
      const cashCoffee = parseMarqueeIntent('log coffee 45k');
      expect(cashCoffee.tool).toBe('log_quick_expense');
      expect(cashCoffee.amountRp).toBe(45000);
      expect(cashCoffee.instrument).toBe('CASH');

      const idPaylater = parseMarqueeIntent('catat spaylater shopee 1.5jt 3x');
      expect(idPaylater.tool).toBe('log_quick_expense');
      expect(idPaylater.locale).toBe('id');
      expect(idPaylater.amountRp).toBe(1500000);
      expect(idPaylater.instrument).toBe('PAYLATER');
      expect(idPaylater.tenorMonths).toBe(3);

      const idRb = parseMarqueeIntent('beli bensin 85rb cash');
      expect(idRb.tool).toBe('log_quick_expense');
      expect(idRb.amountRp).toBe(85000);
      expect(idRb.instrument).toBe('CASH');
    });

    it('parses affordability, upcoming bills, pulse, wallet guard, burndown, savings, and payoff in EN/ID/ZH', () => {
      expect(parseMarqueeIntent('aman ga belanja 350k pake cc?').tool).toBe('evaluate_affordability');
      expect(parseMarqueeIntent('can I afford shoes 450k 3x paylater?').tool).toBe('evaluate_affordability');
      expect(parseMarqueeIntent('今天还能花多少钱？').tool).toBe('get_financial_pulse');
      expect(parseMarqueeIntent('berapa aman belanja hari ini?').tool).toBe('get_financial_pulse');
      expect(parseMarqueeIntent('upcoming bills due this cycle').tool).toBe('get_upcoming_bills');
      expect(parseMarqueeIntent('dompet saya ada 350rb aman?').tool).toBe('wallet_checkin_guard');
      expect(parseMarqueeIntent('cek sisa cicilan aktif spinjam').tool).toBe('get_debt_burndown');
      expect(parseMarqueeIntent('progress tabungan P1 dan goal?').tool).toBe('get_savings_and_goals');
      const opt = parseMarqueeIntent('simulasi pelunasan dipercepat 1jt snowball vs avalanche');
      expect(opt.tool).toBe('simulate_debt_payoff');
      expect(opt.amountRp).toBe(1000000);
    });
  });

  describe('8 Deterministic Tool Handlers & Confirmation Gate', () => {
    const createMockToolsService = () => {
      const snapshotsSelectors = {
        getDefaultActivePeriod: jest.fn().mockResolvedValue({
          month: 11,
          year: 2026,
          strategy: 'EARLIEST_OPEN_ACTIVE',
          cycleTemporalState: 'PRE_PAYDAY',
        }),
        getOrCreateDraftSnapshot: jest.fn().mockResolvedValue({
          id: 11,
          month: 11,
          year: 2026,
          status: 'DRAFT',
          finalTotalIncome: 5904000,
          actualDailyOperational: 1416659,
          deficitUncovered: 83341,
          actualSavings: 0,
          totalDeductions: 4187341,
        }),
      };
      const financeService = {
        createTransaction: jest.fn().mockResolvedValue({ id: 901, label: 'Coffee', amount: 45000 }),
        evaluateAndPersistWalletGuard: jest.fn().mockResolvedValue({
          guard: { freeSpendableCash: 250000, reservedBillsTotal: 100000, guardStatus: 'SAFE' },
        }),
      };
      const financeSelectors = {
        getPacing: jest.fn().mockResolvedValue({
          cycleTemporalState: 'PRE_PAYDAY',
          daysUntilCycleStart: 5,
          safeToSpendToday: 0,
          baselineDailyRate: 45700,
          remainingBudget: 1416659,
          cycleDateLabel: '27 Nov 2026 - 27 Dec 2026',
        }),
        simulateCutoffForUser: jest.fn().mockResolvedValue({
          startPeriodLabel: "DEC '26",
          firstDueDateIso: '2027-01-25',
          verdict: 'SAFE',
          dsrAfterPercent: 28.4,
        }),
        getContractsBurndown: jest.fn().mockResolvedValue({
          activeCount: 4,
          totalRemainingPrincipalRp: 2500000,
          items: [{ title: 'SPinjam Bridge Loan', remainingMonths: 2, remainingRp: 671156 }],
        }),
        getIntelligenceBundle: jest.fn().mockResolvedValue({
          debtopt: {
            strategies: [
              { strategy: 'AVALANCHE', immediateFreedMonthlyRp: 335578, estimatedInterestSavedRp: 92000, monthsShaved: 1 },
            ],
          },
        }),
      };
      const creditService = {
        createLineItemSchedule: jest.fn().mockResolvedValue({ createdCount: 3 }),
      };
      const creditSelectors = {
        getLiabilityMatrix: jest.fn().mockResolvedValue({
          columns: [{ month: 11, year: 2026, key: '2026-11', label: "NOV '26" }],
          payLaterRow: { cells: { '2026-11': { amount: 2783115, items: [] } } },
          creditCardRow: { cells: { '2026-11': { amount: 734256, items: [] } } },
          personalDebtRow: { cells: { '2026-11': { amount: 669970, items: [] } } },
          lineItemsPerMonth: { '2026-11': [] },
          totalsPerMonth: { '2026-11': 4187341 },
        }),
      };
      const savingsSelectors = {
        getOverview: jest.fn().mockResolvedValue({ totalBalance: 3500000, rdpuBalance: 3500000, liquidBalance: 0 }),
        getGoals: jest.fn().mockResolvedValue([{ id: 1, name: 'Emergency Reserve', progressPercent: 70 }]),
      };

      const tools = new MarqueeToolsService(
        snapshotsSelectors as any,
        financeService as any,
        financeSelectors as any,
        creditService as any,
        creditSelectors as any,
        savingsSelectors as any,
      );

      return { tools, snapshotsSelectors, financeService, financeSelectors, creditService, creditSelectors, savingsSelectors };
    };

    it('holds expense mutations behind confirmation preview unless confirm=true', async () => {
      const { tools, financeService, creditService } = createMockToolsService();

      const preview = await tools.executeTool(
        'log_quick_expense',
        { title: 'Kopi', amountRp: 45000, instrument: 'CASH', tenorMonths: 1 },
        { userId: 2, confirm: false, month: 11, year: 2026 },
      );
      expect(preview.pendingAction).toBeDefined();
      expect(financeService.createTransaction).not.toHaveBeenCalled();

      const committedCash = await tools.executeTool(
        'log_quick_expense',
        { title: 'Kopi', amountRp: 45000, instrument: 'CASH', tenorMonths: 1 },
        { userId: 2, confirm: true, month: 11, year: 2026 },
      );
      expect(committedCash.pendingAction).toBeUndefined();
      expect(financeService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Kopi', amount: 45000, paymentMethod: 'CASH' }),
        2,
      );

      await tools.executeTool(
        'log_quick_expense',
        { title: 'Shoes', amountRp: 900000, instrument: 'PAYLATER', tenorMonths: 3 },
        { userId: 2, confirm: true, month: 11, year: 2026 },
      );
      expect(creditService.createLineItemSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Shoes', tenorMonths: 3, category: 'PAYLATER', autoRouteByCutoff: true }),
        2,
      );
    });

    it('executes all remaining 7 deterministic read/simulation tools scoped by userId', async () => {
      const { tools, financeSelectors, creditSelectors, savingsSelectors } = createMockToolsService();

      const pulse = await tools.executeTool('get_financial_pulse', {}, { userId: 2, month: 11, year: 2026 });
      expect(pulse.ok).toBe(true);
      expect(financeSelectors.getPacing).toHaveBeenCalledWith(11, 2026, undefined, undefined, 2);

      const afford = await tools.executeTool(
        'evaluate_affordability',
        { title: 'Watch', amountRp: 450000, instrument: 'PAYLATER', tenorMonths: 3 },
        { userId: 2, month: 11, year: 2026 },
      );
      expect(afford.ok).toBe(true);
      expect(financeSelectors.simulateCutoffForUser).toHaveBeenCalled();

      const bills = await tools.executeTool('get_upcoming_bills', {}, { userId: 2, month: 11, year: 2026 });
      expect(bills.ok).toBe(true);
      expect(creditSelectors.getLiabilityMatrix).toHaveBeenCalledWith(11, 2026, 3, 2);

      const wallet = await tools.executeTool(
        'wallet_checkin_guard',
        { actualWalletBalance: 350000 },
        { userId: 2, month: 11, year: 2026 },
      );
      expect(wallet.ok).toBe(true);

      const burndown = await tools.executeTool('get_debt_burndown', {}, { userId: 2, month: 11, year: 2026 });
      expect(burndown.ok).toBe(true);
      expect(financeSelectors.getContractsBurndown).toHaveBeenCalledWith(11, 2026, 2);

      const savings = await tools.executeTool('get_savings_and_goals', {}, { userId: 2 });
      expect(savings.ok).toBe(true);
      expect(savingsSelectors.getOverview).toHaveBeenCalledWith(undefined, 2);

      const opt = await tools.executeTool('simulate_debt_payoff', { lumpSumRp: 1000000 }, { userId: 2, month: 11, year: 2026 });
      expect(opt.ok).toBe(true);
      expect(financeSelectors.getIntelligenceBundle).toHaveBeenCalledWith(11, 2026, 1000000, 2);
    });
  });

  describe('Tier 3 Headless Webhook Authentication (X-Marquee-Token)', () => {
    it('resolves exact owning userId for valid token and rejects missing/invalid tokens with UnauthorizedException', async () => {
      const validRawToken = 'mrq_test_secret_token_991122';
      const tokenHash = hashSecretToken(validRawToken);
      const mockPrisma = {
        globalConfig: {
          findMany: jest.fn().mockResolvedValue([
            {
              userId: 2,
              financialPolicyJson: {
                marqueeAi: { webhookTokenHash: tokenHash },
              },
            },
          ]),
        },
      };

      const service = new MarqueeService(
        mockPrisma as any,
        {} as any,
        {} as any,
      );

      await expect(service.resolveUserIdFromWebhookToken(undefined)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.resolveUserIdFromWebhookToken('mrq_wrong_token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.resolveUserIdFromWebhookToken(validRawToken)).resolves.toBe(2);
    });
  });

  describe('DeepSeek & OpenCode Provider Configuration, Routing & Tool-Calling', () => {
    it('encrypts DeepSeek and OpenCode API keys at rest via AES-256-GCM and returns masked previews', async () => {
      let persistedPolicy: Record<string, any> = {};
      const mockPrisma = {
        globalConfig: {
          findFirst: jest.fn().mockImplementation(async () => ({
            id: 2,
            userId: 2,
            financialPolicyJson: persistedPolicy,
          })),
          update: jest.fn().mockImplementation(async ({ data }: any) => {
            persistedPolicy = data.financialPolicyJson;
            return { id: 2, userId: 2, financialPolicyJson: persistedPolicy };
          }),
        },
      };

      const service = new MarqueeService(mockPrisma as any, {} as any, {} as any, {} as any);
      const updated = await service.updateConfig(2, {
        provider: 'DEEPSEEK',
        deepseekApiKey: 'sk-deepseek-live-9876543210abcdef',
        deepseekModel: 'deepseek-reasoner',
        opencodeApiKey: 'oc-opencode-live-1122334455667788',
        opencodeBaseUrl: 'https://opencode.ai/zen/v1',
        opencodeModel: 'opencode-chat',
      });

      expect(updated.provider).toBe('DEEPSEEK');
      expect(updated.hasDeepseekKey).toBe(true);
      expect(updated.deepseekKeyPreview).not.toContain('9876543210');
      expect(updated.deepseekModel).toBe('deepseek-reasoner');
      expect(updated.hasOpencodeKey).toBe(true);
      expect(updated.opencodeKeyPreview).not.toContain('1122334455');
      expect(updated.opencodeBaseUrl).toBe('https://opencode.ai/zen/v1');
      expect(JSON.stringify(persistedPolicy)).not.toContain('sk-deepseek-live-9876543210abcdef');
      expect(JSON.stringify(persistedPolicy)).not.toContain('oc-opencode-live-1122334455667788');
    });

    it('routes tool calls through DeepSeek and OpenCode OpenAI-compatible endpoints and falls back cleanly on HTTP error', async () => {
      const llm = new MarqueeLlmService();
      const origFetch = global.fetch;

      try {
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: 'Your 11/2026 cycle starts 27 Nov with Rp 1.416.659 living cash.',
                  tool_calls: [
                    {
                      function: {
                        name: 'get_paycycle_pulse',
                        arguments: JSON.stringify({ month: 11, year: 2026 }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        }) as any;

        const dsRes = await llm.resolveWithProvider({
          provider: 'DEEPSEEK',
          deepseekApiKey: 'sk-test-ds',
          deepseekModel: 'deepseek-chat',
          message: 'how is my Nov 2026 paycycle looking?',
          systemContextPrompt: 'ACTIVE PERIOD: 11/2026 PRE_PAYDAY',
          tier1Fallback: parseMarqueeIntent('how is my Nov 2026 paycycle looking?'),
        });

        expect(dsRes?.usedProvider).toBe('DEEPSEEK');
        expect(dsRes?.model).toBe('deepseek-chat');
        expect(dsRes?.tool).toBe('get_paycycle_pulse');

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  tool_calls: [
                    {
                      function: {
                        name: 'optimize_payday_thr_split',
                        arguments: JSON.stringify({ bonusRp: 3500000 }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        }) as any;

        const ocRes = await llm.resolveWithProvider({
          provider: 'OPENCODE',
          opencodeApiKey: 'oc-test-key',
          opencodeBaseUrl: 'https://api.opencode.ai/v1',
          opencodeModel: 'opencode-chat',
          message: 'split my 3.5jt Natal THR bonus',
          systemContextPrompt: 'ACTIVE PERIOD: 12/2026',
          tier1Fallback: parseMarqueeIntent('split my 3.5jt Natal THR bonus'),
        });

        expect(ocRes?.usedProvider).toBe('OPENCODE');
        expect(ocRes?.tool).toBe('optimize_payday_thr_split');
        expect(ocRes?.args.bonusRp).toBe(3500000);

        // Verify <think>...</think> stripping, 400 tool-less retry, and 401 sk-... DeepSeek bridge
        const stripped = stripReasoningBlocks('<think>Calculating daily burn</think>You have Rp 300.000 left for 5 days.');
        expect(stripped.cleanText).toBe('You have Rp 300.000 left for 5 days.');
        expect(stripped.reasoning).toBe('Calculating daily burn');

        global.fetch = jest
          .fn()
          .mockResolvedValueOnce({ ok: false, status: 400 })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: '<think>Check pacing</think>You have Rp 300.000 left across 5 days.',
                  },
                },
              ],
            }),
          }) as any;

        const retryRes = await llm.resolveWithProvider({
          provider: 'OPENCODE',
          opencodeApiKey: 'oc-zen-key',
          opencodeBaseUrl: 'https://opencode.ai/zen/v1',
          opencodeModel: 'deepseek-v4.1-flash-free',
          message: 'safe to spend today?',
          systemContextPrompt: 'ACTIVE PERIOD: 11/2026 ACTIVE',
          tier1Fallback: parseMarqueeIntent('safe to spend today?'),
        });
        expect(retryRes?.usedProvider).toBe('OPENCODE');
        expect(retryRes?.assistantPrefix).toBe('You have Rp 300.000 left across 5 days.');
        expect(retryRes?.reasoning).toBe('Check pacing');
      } finally {
        global.fetch = origFetch;
      }
    });
  });

  describe('MarqueeContextHydrator & 8 Canonical Deterministic Tools', () => {
    it('hydrates full userId-scoped financial context and active UI route without cross-tenant leakage', async () => {
      const mockPrisma = {
        monthlySnapshot: {
          findMany: jest.fn().mockResolvedValue([
            {
              month: 11,
              year: 2026,
              status: 'DRAFT',
              finalTotalIncome: 5904000,
              totalDeductions: 4187341,
              actualDailyOperational: 1416659,
              deficitUncovered: 83341,
              actualSavings: 0,
              selfReward: 0,
              payrollPayoutDate: new Date('2026-11-27T00:00:00.000Z'),
            },
            {
              month: 12,
              year: 2026,
              status: 'DRAFT',
              finalTotalIncome: 9305917,
              totalDeductions: 3171115,
              actualDailyOperational: 2850000,
              deficitUncovered: 0,
              actualSavings: 1000000,
              selfReward: 2284802,
              payrollPayoutDate: new Date('2026-12-28T00:00:00.000Z'),
            },
          ]),
        },
        liabilityLineItem: {
          findMany: jest.fn().mockResolvedValue([
            { id: 1, month: 11, year: 2026, category: 'PAYLATER', title: 'SPayLater 24th', monthlyAmount: 1084112, isSettled: false },
            { id: 2, month: 11, year: 2026, category: 'PERSONAL_DEBT', title: 'SPinjam 8th', monthlyAmount: 73387, isSettled: false },
          ]),
        },
        transaction: {
          findMany: jest.fn().mockResolvedValue([
            { id: 10, month: 11, year: 2026, label: 'Haircut', amount: 75000, paymentMethod: 'PAYLATER' },
          ]),
        },
      };
      const mockSnapshotsSelectors = {
        getDefaultActivePeriod: jest.fn().mockResolvedValue({
          month: 11,
          year: 2026,
          strategy: 'EARLIEST_OPEN_ACTIVE',
          cycleTemporalState: 'PRE_PAYDAY',
        }),
      };
      const mockFinanceSelectors = {
        getPacing: jest.fn().mockResolvedValue({
          cycleTemporalState: 'PRE_PAYDAY',
          daysUntilCycleStart: 5,
          cycleStartDate: '2026-11-27',
          cycleEndDate: '2026-12-28',
          cycleDateLabel: '27 Nov 2026 - 27 Dec 2026',
          baselineDailyRate: 45700,
          remainingBudget: 1416659,
          safeToSpendToday: 0,
        }),
      };
      const mockSavingsSelectors = {
        getOverview: jest.fn().mockResolvedValue({ totalBalance: 0, rdpuBalance: 0 }),
      };

      const hydrator = new MarqueeContextHydrator(
        mockPrisma as any,
        mockSnapshotsSelectors as any,
        mockFinanceSelectors as any,
        mockSavingsSelectors as any,
      );

      const ctx = await hydrator.hydrateForUser(1, {
        month: 11,
        year: 2026,
        activeRoute: '/credit',
        activeSubTab: 'contracts',
        locale: 'en',
      });

      expect(ctx.userId).toBe(1);
      expect(ctx.activePeriod.periodTag).toBe('11/2026');
      expect(ctx.activePeriod.cycleTemporalState).toBe('PRE_PAYDAY');
      expect(ctx.dueDayCalendar.canonicalDueDays).toEqual([8, 11, 17, 23, 24, 25]);
      expect(ctx.payoffMilestones.map((m) => m.periodLabel)).toEqual(["JAN '27", "FEB '27", "MAR '27", "SEP '27"]);
      expect(ctx.proactiveReminders.length).toBeGreaterThan(0);
      expect(ctx.uiContext.activeRoute).toBe('/credit');
      expect(ctx.uiContext.activeSubTab).toBe('contracts');
      expect(ctx.systemPrompt).toContain('Rp 5.904.000');
      expect(ctx.systemPrompt).toContain('Rp 83.341');
      expect(ctx.systemPrompt).toContain('/analytics');
      expect(mockPrisma.monthlySnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 1 }) }),
      );
    });

    it('executes all 8 canonical tool names and produces human-centric responses without banned AI filler', async () => {
      const snapshotsSelectors = {
        getDefaultActivePeriod: jest.fn().mockResolvedValue({
          month: 11,
          year: 2026,
          strategy: 'EARLIEST_OPEN_ACTIVE',
          cycleTemporalState: 'PRE_PAYDAY',
        }),
        getOrCreateDraftSnapshot: jest.fn().mockImplementation(async (m: number) =>
          m === 12
            ? {
                month: 12,
                year: 2026,
                finalTotalIncome: 9305917,
                totalDeductions: 3171115,
                actualDailyOperational: 2850000,
                deficitUncovered: 0,
                actualSavings: 1000000,
                selfReward: 2284802,
              }
            : {
                month: 11,
                year: 2026,
                finalTotalIncome: 5904000,
                totalDeductions: 4187341,
                actualDailyOperational: 1416659,
                deficitUncovered: 83341,
                actualSavings: 0,
                selfReward: 0,
              },
        ),
      };
      const financeService = {
        createTransaction: jest.fn().mockResolvedValue({ id: 901 }),
        evaluateAndPersistWalletGuard: jest.fn().mockResolvedValue({
          guard: { freeSpendableCash: 250000, reservedBillsTotal: 100000, guardStatus: 'SAFE' },
        }),
      };
      const financeSelectors = {
        getPacing: jest.fn().mockResolvedValue({
          cycleTemporalState: 'PRE_PAYDAY',
          daysUntilCycleStart: 5,
          cycleStartDate: '2026-11-27',
          cycleEndDate: '2026-12-28',
          cycleDateLabel: '27 Nov 2026 - 27 Dec 2026',
          baselineDailyRate: 45700,
          remainingBudget: 1416659,
          safeToSpendToday: 0,
        }),
        simulateCutoffForUser: jest.fn().mockResolvedValue({
          startPeriodLabel: "DEC '26",
          firstDueDateIso: '2027-01-25',
          verdict: 'SAFE',
          dsrAfterPercent: 28.4,
        }),
        getContractsBurndown: jest.fn().mockResolvedValue({
          activeCount: 4,
          totalMonthlyCommitmentRp: 917409,
          totalRemainingPrincipalRp: 2500000,
          debtFreedomLabel: 'Sep 2027',
        }),
        getIntelligenceBundle: jest.fn().mockResolvedValue({
          debtopt: {
            strategies: [
              { strategy: 'AVALANCHE', immediateFreedMonthlyRp: 335578, estimatedInterestSavedRp: 92000, monthsShaved: 1 },
            ],
          },
        }),
      };
      const creditService = { createLineItemSchedule: jest.fn() };
      const creditSelectors = {
        getLiabilityMatrix: jest.fn().mockResolvedValue({
          payLaterRow: { cells: { '2026-11': { amount: 2783115 }, '2026-12': { amount: 1622889 } } },
          creditCardRow: { cells: { '2026-11': { amount: 734256 }, '2026-12': { amount: 628256 } } },
          personalDebtRow: { cells: { '2026-11': { amount: 669970 }, '2026-12': { amount: 919970 } } },
          totalsPerMonth: { '2026-11': 4187341, '2026-12': 3171115 },
        }),
      };
      const savingsSelectors = {
        getOverview: jest.fn().mockResolvedValue({ totalBalance: 0, rdpuBalance: 0 }),
        getGoals: jest.fn().mockResolvedValue([]),
      };

      const tools = new MarqueeToolsService(
        snapshotsSelectors as any,
        financeService as any,
        financeSelectors as any,
        creditService as any,
        creditSelectors as any,
        savingsSelectors as any,
      );

      const canonicalCalls: Array<[any, Record<string, any>]> = [
        ['get_paycycle_pulse', {}],
        ['simulate_purchase_cutoff', { title: 'Headphones', amountRp: 600000, instrument: 'PAYLATER', tenorMonths: 3 }],
        ['optimize_payday_thr_split', { bonusRp: 3400000 }],
        ['analyze_debt_burndown', { lumpSumRp: 1000000 }],
        ['evaluate_custom_formula', { expression: 'net_income - total_debt - living_pool' }],
        ['prepare_quick_transaction', { title: 'Lunch', amountRp: 55000, instrument: 'CASH' }],
        ['prepare_wallet_checkin', { actualWalletBalance: 450000 }],
        ['explain_period_variance', { compareMonth: 12, compareYear: 2026 }],
      ];

      for (const [toolName, args] of canonicalCalls) {
        const res = await tools.executeTool(toolName, args, { userId: 2, month: 11, year: 2026, confirm: false });
        expect(res.ok).toBe(true);
        expect(res.summary).not.toMatch(/\b(Furthermore|In conclusion|It is worth noting|Delve|Tapestry)\b/i);
      }
    });
  });

  describe('Live LLM Conversation, 2-Turn Tool Synthesis & Weighted Safe-to-Spend', () => {
    it('uses weightedSafeToSpendToday (Rp 81.818 / Rp 54.545) and forwards args.purchaseDate into simulateCutoffForUser', async () => {
      const snapshotsSelectors = {
        getDefaultActivePeriod: jest.fn().mockResolvedValue({ month: 11, year: 2026, cycleTemporalState: 'ACTIVE' }),
        getOrCreateDraftSnapshot: jest.fn().mockResolvedValue({
          month: 11,
          year: 2026,
          finalTotalIncome: 5891000,
          actualDailyOperational: 1720316,
          deficitUncovered: 0,
          actualSavings: 6341,
          totalDeductions: 4522976,
        }),
      };
      const financeSelectors = {
        getPacing: jest.fn().mockResolvedValue({
          cycleTemporalState: 'ACTIVE',
          daysRemaining: 5,
          remainingBudget: 300000,
          safeToSpendToday: 60000,
          weightedSafeToSpendToday: 81818,
          weekendSafeRate: 81818,
          weekdaySafeRate: 54545,
          isTodayWeekend: true,
          cycleDateLabel: '28 Oct – 26 Nov 2026',
        }),
        simulateCutoffForUser: jest.fn().mockResolvedValue({
          startPeriodLabel: "JAN '27",
          firstDueDateIso: '2027-01-11',
          verdict: 'SAFE',
          dsrAfterPercent: 32.0,
        }),
      };
      const tools = new MarqueeToolsService(
        snapshotsSelectors as any,
        {} as any,
        financeSelectors as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const pulseRes = await tools.executeTool('get_paycycle_pulse', {}, { userId: 1, month: 11, year: 2026 });
      expect(pulseRes.ok).toBe(true);
      expect(pulseRes.summary).toContain('81.818');
      expect(pulseRes.summary).not.toContain('60.000/day');

      await tools.executeTool(
        'simulate_purchase_cutoff',
        {
          title: 'Permata CC Swipe',
          amountRp: 500000,
          instrument: 'CREDIT_CARD',
          purchaseDate: '2026-11-26',
        },
        { userId: 1, month: 11, year: 2026 },
      );
      expect(financeSelectors.simulateCutoffForUser).toHaveBeenCalledWith(
        expect.objectContaining({
          purchaseDate: '2026-11-26',
          instrument: 'CREDIT_CARD',
        }),
        1,
      );
    });

    it('lets casual greetings respond naturally via DeepSeek without forcing Tier 1 tool boilerplate and synthesizes 2-turn tool results', async () => {
      const encryptedDs = encryptSecret('sk-test-live-ds-mock');
      const mockPrisma = {
        globalConfig: {
          findFirst: jest.fn().mockResolvedValue({
            id: 1,
            userId: 1,
            financialPolicyJson: {
              marqueeAi: {
                provider: 'DEEPSEEK',
                deepseekApiKeyEnc: encryptedDs,
                deepseekKeyPreview: '****mock',
                deepseekModel: 'deepseek-flash',
              },
            },
          }),
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };
      const mockTools = {
        executeTool: jest.fn().mockResolvedValue({
          ok: true,
          tool: 'simulate_purchase_cutoff',
          summary: 'Simulasi: Permata CC jatuh tempo 2027-01-11 (periode 01/2027).',
          data: { firstDueDateIso: '2027-01-11', startPeriodCode: '01/2027', cutoffDay: 25, dueDay: 11 },
        }),
      };
      const mockHydrator = {
        hydrateForUser: jest.fn().mockResolvedValue({
          activePeriod: {
            periodTag: '11/2026',
            cycleTemporalState: 'ACTIVE',
            cycleDateLabel: '28 Oct – 26 Nov 2026',
          },
          proactiveReminders: [],
          systemPrompt: 'ACTIVE PERIOD: 11/2026 | Remaining Rp 300.000 | Weighted today Rp 81.818',
        }),
      };

      const service = new MarqueeService(
        mockPrisma as any,
        mockTools as any,
        new MarqueeLlmService(),
        mockHydrator as any,
      );

      const origFetch = global.fetch;
      try {
        // Case 1: Casual greeting -> no tool call, direct LLM answer, executeTool NOT forced
        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: 'Hey Gabriel. Remaining living cash is Rp 300.000 (Rp 81.818 today). What do you want to check?',
                },
              },
            ],
          }),
        }) as any;

        const hiRes = await service.chat(1, { message: 'hi', month: 11, year: 2026 });
        expect(hiRes.tierUsed).toBe('TIER2_DEEPSEEK');
        expect(hiRes.model).toBe('deepseek-flash');
        expect(hiRes.summary).toContain('Rp 300.000');
        expect(mockTools.executeTool).not.toHaveBeenCalled();

        // Case 2: 2-turn tool synthesis
        global.fetch = jest
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: '',
                    tool_calls: [
                      {
                        id: 'tc_permata_26nov',
                        type: 'function',
                        function: {
                          name: 'simulate_purchase_cutoff',
                          arguments: JSON.stringify({
                            title: 'Permata CC Swipe',
                            amountRp: 500000,
                            instrument: 'CREDIT_CARD',
                            purchaseDate: '2026-11-26',
                          }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: {
                    content:
                      '<think>Nov 26 crosses Permata cutoff on 25th so it bills in 01/2027 due Jan 11.</think>Swipe tanggal **26 Nov 2026** lewat cutoff tanggal 25 Bank Permata, jadi masuk tagihan **01/2027** (jatuh tempo **11 Jan 2027**).',
                  },
                },
              ],
            }),
          }) as any;

        const ccRes = await service.chat(1, {
          message: 'kalau gua gesek permata cc tanggal 26 nov masuk tagihan kapan?',
          month: 11,
          year: 2026,
        });
        expect((global.fetch as jest.Mock).mock.calls).toHaveLength(2);
        const secondCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
        expect(secondCallBody.messages.some((m: any) => m.role === 'tool' && m.tool_call_id === 'tc_permata_26nov')).toBe(true);
        expect(mockTools.executeTool).toHaveBeenCalledWith(
          'simulate_purchase_cutoff',
          expect.objectContaining({ purchaseDate: '2026-11-26', instrument: 'CREDIT_CARD' }),
          expect.objectContaining({ userId: 1 }),
        );
        expect(ccRes.tierUsed).toBe('TIER2_DEEPSEEK');
        expect(ccRes.summary).toContain('11 Jan 2027');
        expect(ccRes.summary).not.toContain('<think>');
        expect(ccRes.reasoning).toContain('Nov 26 crosses Permata cutoff');
      } finally {
        global.fetch = origFetch;
      }
    });

    it('maps deepseek-v4.1-flash-free to deepseek-flash on api.deepseek.com bridge and documents exact cutoff law in system prompt', async () => {
      const llm = new MarqueeLlmService();
      const origFetch = global.fetch;
      try {
        global.fetch = jest
          .fn()
          .mockResolvedValueOnce({ ok: false, status: 401 })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              choices: [{ message: { content: 'Cycle 11/2026 has Rp 81.818 weighted weekend allowance today.' } }],
            }),
          }) as any;

        const bridged = await llm.resolveWithProvider({
          provider: 'OPENCODE',
          opencodeApiKey: 'sk-test-bridge-key',
          opencodeBaseUrl: 'https://opencode.ai/zen/v1',
          opencodeModel: 'deepseek-v4.1-flash-free',
          message: 'safe to spend today?',
          systemContextPrompt: 'ACTIVE PERIOD: 11/2026',
          tier1Fallback: parseMarqueeIntent('safe to spend today?'),
        });
        expect(bridged?.model).toBe('deepseek-flash');
        const secondUrl = (global.fetch as jest.Mock).mock.calls[1][0];
        const secondPayload = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
        expect(secondUrl).toContain('api.deepseek.com');
        expect(secondPayload.model).toBe('deepseek-flash');
      } finally {
        global.fetch = origFetch;
      }

      const hydrator = new MarqueeContextHydrator(
        {
          monthlySnapshot: { findMany: jest.fn().mockResolvedValue([]) },
          liabilityLineItem: { findMany: jest.fn().mockResolvedValue([]) },
          transaction: { findMany: jest.fn().mockResolvedValue([]) },
        } as any,
        {
          getDefaultActivePeriod: jest.fn().mockResolvedValue({ month: 11, year: 2026, cycleTemporalState: 'ACTIVE' }),
        } as any,
        {
          getPacing: jest.fn().mockResolvedValue({
            cycleTemporalState: 'ACTIVE',
            daysUntilCycleStart: 0,
            cycleStartDate: '2026-10-28',
            cycleEndDate: '2026-11-26',
            cycleDateLabel: '28 Oct – 26 Nov 2026',
            baselineDailyRate: 57344,
            remainingBudget: 300000,
            safeToSpendToday: 60000,
            weightedSafeToSpendToday: 81818,
            weekendSafeRate: 81818,
            weekdaySafeRate: 54545,
          }),
        } as any,
        { getOverview: jest.fn().mockResolvedValue({ totalBalance: 0, rdpuBalance: 0 }) } as any,
      );
      const ctx = await hydrator.hydrateForUser(1, { month: 11, year: 2026, locale: 'id' });
      expect(ctx.systemPrompt).toMatch(/daysInMonth\s*-\s*15|daysInMonth\(M\)\s*-\s*15/i);
      expect(ctx.systemPrompt).toContain('25th');
      expect(ctx.systemPrompt).toContain('81.818');
    });

    it('hydrates full ERP modules (CC contracts, routines, savings pockets, wishlist, subscriptions) and stages/executes multi-module service actions + agentSteps', async () => {
      const prismaMock: any = {
        monthlySnapshot: {
          findMany: jest.fn().mockResolvedValue([
            { id: 1, month: 11, year: 2026, status: 'DRAFT', finalTotalIncome: 5891000, totalDeductions: 4522976, actualDailyOperational: 1720316, deficitUncovered: 0, actualSavings: 6341, selfReward: 250000, payrollPayoutDate: new Date('2026-10-28') },
            { id: 2, month: 12, year: 2026, status: 'DRAFT', finalTotalIncome: 9737425, totalDeductions: 4162341, actualDailyOperational: 1500000, deficitUncovered: 0, actualSavings: 1000000, selfReward: 2775084, payrollPayoutDate: new Date('2026-11-27') },
          ]),
        },
        liabilityLineItem: {
          findMany: jest.fn().mockResolvedValue([
            { id: 318, month: 1, year: 2027, category: 'PAYLATER', title: 'Americano & Dunhill', monthlyAmount: 52000, isSettled: false },
          ]),
        },
        transaction: { findMany: jest.fn().mockResolvedValue([]) },
        creditCardTransaction: {
          findMany: jest.fn().mockResolvedValue([
            { id: 4, label: 'Nike Dunk SE IB6399001', monthlyAmount: 122104, totalTenor: 12, startMonth: 10, startYear: 2026, isActive: true },
          ]),
        },
        creditContract: { findMany: jest.fn().mockResolvedValue([]) },
        wishlistItem: {
          findMany: jest.fn().mockResolvedValue([
            { id: 1, name: 'Mac Mini M4', targetPrice: 9000000, isPurchased: false },
          ]),
        },
        savingsGoal: {
          findMany: jest.fn().mockResolvedValue([
            { id: 1, title: 'Emergency Fund', targetAmount: 12000000, currentAllocatedAmount: 272541 },
          ]),
        },
        subscriptionItem: { findMany: jest.fn().mockResolvedValue([]) },
        globalConfig: { findFirst: jest.fn().mockResolvedValue({ userId: 1, promoKillSwitchesJson: [], formulaParamsJson: {} }) },
      };
      const creditServiceMock: any = {
        shiftLineItem: jest.fn().mockResolvedValue({ shiftedCount: 1, affectedPeriods: [{ month: 12, year: 2026 }, { month: 1, year: 2027 }] }),
      };
      const snapshotsServiceMock: any = {
        createRevision: jest.fn().mockResolvedValue({ id: 99, category: 'DAILY_OPERATIONAL', newValue: 1800000 }),
      };
      const wishlistServiceMock: any = {
        createWishlist: jest.fn().mockResolvedValue({ id: 7, name: 'Monitor 4K', targetPrice: 4500000 }),
      };

      const tools = new MarqueeToolsService(
        { getDefaultActivePeriod: jest.fn().mockResolvedValue({ month: 11, year: 2026 }) } as any,
        {} as any,
        {
          simulateCutoffForUser: jest.fn().mockResolvedValue({
            startPeriodLabel: "DEC '26",
            startPeriodMonth: 12,
            startPeriodYear: 2026,
            firstDueDateIso: '2026-12-25',
            verdict: 'SAFE',
            dsrAfterPercent: 31.2,
          }),
          simulateScenarioForUser: jest.fn().mockResolvedValue({
            net12MDeltaRp: 3500000,
            runwayDeltaDays: 14,
            baseline: { projected12MWealthRp: 10000000, freedomDate: 'Feb 2027' },
            simulated: { projected12MWealthRp: 13500000, freedomDate: 'Jan 2027' },
          }),
        } as any,
        creditServiceMock,
        {} as any,
        {} as any,
        snapshotsServiceMock,
        wishlistServiceMock,
        undefined,
        prismaMock,
      );

      // 1. Staged confirmation for shifting Americano & Dunhill earlier to Dec 2026
      const stagedShift = await tools.executeTool(
        'manage_liability_item' as any,
        { action: 'SHIFT_EARLIER', itemQuery: 'Americano' },
        { userId: 1, confirm: false, month: 1, year: 2027 },
      );
      expect(stagedShift.ok).toBe(true);
      expect(stagedShift.pendingAction?.type).toBe('CONFIRM_SHIFT_LIABILITY');

      // 2. Confirmed shift executes CreditService.shiftLineItem cleanly
      const execShift = await tools.executeTool(
        'manage_liability_item' as any,
        { action: 'SHIFT_EARLIER', itemId: 318 },
        { userId: 1, confirm: true, month: 1, year: 2027 },
      );
      expect(execShift.ok).toBe(true);
      expect(creditServiceMock.shiftLineItem).toHaveBeenCalledWith(318, { direction: 'EARLIER' }, 1);

      // 3. Budget revision stages then confirms via SnapshotsService
      const stagedRev = await tools.executeTool(
        'revise_budget_or_quota' as any,
        { category: 'DAILY_OPERATIONAL', newValueRp: 1800000, month: 12, year: 2026 },
        { userId: 1, confirm: false, month: 12, year: 2026 },
      );
      expect(stagedRev.pendingAction?.type).toBe('CONFIRM_BUDGET_REVISION');

      // 4. Hydrator includes end-to-end wishlist & CC context
      const hydrator = new MarqueeContextHydrator(
        prismaMock,
        { getDefaultActivePeriod: jest.fn().mockResolvedValue({ month: 11, year: 2026, cycleTemporalState: 'ACTIVE' }) } as any,
        { getPacing: jest.fn().mockResolvedValue({ remainingBudget: 160000, weightedSafeToSpendToday: 40000 }) } as any,
        { getOverview: jest.fn().mockResolvedValue({ totalBalance: 272541, rdpuBalance: 0 }) } as any,
      );
      const ctx = await hydrator.hydrateForUser(1, { month: 11, year: 2026, locale: 'id' });
      expect(ctx.systemPrompt).toContain('Mac Mini M4');
      expect(ctx.systemPrompt).toContain('Nike Dunk SE IB6399001');

      // 5. Staged PayLater entry uses human "SPayLater" label instead of raw enum "PAYLATER"
      const stagedExp = await tools.executeTool(
        'prepare_quick_transaction',
        {
          title: 'Kopi',
          amountRp: 34000,
          instrument: 'PAYLATER',
          purchaseDate: '2026-11-23',
        },
        { userId: 1, confirm: false, month: 11, year: 2026 },
      );
      expect(stagedExp.summary).toContain('SPayLater');
      expect(stagedExp.summary).not.toContain('PAYLATER');
      expect(stagedExp.cards?.find((c) => c.label === 'Routed Cycle')?.value).toBe("DEC '26 (SPayLater)");
    });
  });
});
