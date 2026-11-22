import { UnauthorizedException } from '@nestjs/common';
import { parseMarqueeIntent } from './marquee-nlu';
import { MarqueeToolsService } from './marquee-tools.service';
import { MarqueeService } from './marquee.service';
import { hashSecretToken } from '../common/crypto.util';

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
});
