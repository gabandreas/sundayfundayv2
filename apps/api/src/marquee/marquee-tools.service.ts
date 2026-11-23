import { Injectable, Optional } from '@nestjs/common';
import { SnapshotsSelectors } from '../snapshots/snapshots.selectors';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { FinanceService } from '../finance/finance.service';
import { FinanceSelectors } from '../finance/finance.selectors';
import { CreditService } from '../credit/credit.service';
import { CreditSelectors } from '../credit/credit.selectors';
import { SavingsSelectors } from '../savings/savings.selectors';
import { SavingsService } from '../savings/savings.service';
import { WishlistService } from '../wishlist/wishlist.service';
import { PrismaService } from '../prisma/prisma.service';
import { MarqueeInstrument, MarqueeToolName } from './marquee-nlu';
import { evaluateFormulaDslTs } from '../calculator/formula-dsl';

export interface MarqueeCardItem {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'caution' | 'urgency';
}

export type MarqueePendingActionType =
  | 'CONFIRM_EXPENSE'
  | 'CONFIRM_SHIFT_LIABILITY'
  | 'CONFIRM_SETTLE_LIABILITY'
  | 'CONFIRM_BUDGET_REVISION'
  | 'CONFIRM_SAVINGS_ACTION'
  | 'CONFIRM_WISHLIST_ADD'
  | 'CONFIRM_SUBSCRIPTION_ACTION';

export interface MarqueePendingAction {
  type: MarqueePendingActionType;
  title?: string;
  payload: Record<string, any>;
}

function formatInstrumentLabel(inst: string): string {
  const up = (inst || '').toUpperCase();
  if (up === 'PAYLATER' || up === 'SPAYLATER') return 'SPayLater';
  if (up === 'CREDIT_CARD' || up === 'CC') return 'Credit Card';
  if (up === 'SPINJAM') return 'SPinjam';
  if (up === 'CASH_LOAN') return 'Cash Loan';
  if (up === 'CASH') return 'Living Cash';
  return inst;
}

export interface MarqueeToolResult {
  ok: boolean;
  tool: MarqueeToolName;
  summary: string;
  cards: MarqueeCardItem[];
  pendingAction?: MarqueePendingAction;
  data?: Record<string, unknown>;
}

export interface MarqueeExecutionContext {
  userId: number;
  confirm?: boolean;
  month?: number;
  year?: number;
}

function formatRp(amount: number): string {
  const abs = Math.round(Math.abs(amount));
  const sign = amount < 0 ? '-' : '';
  return `${sign}Rp ${abs.toLocaleString('id-ID')}`;
}

/**
 * Evaluates custom financial formulas using the unified recursive-descent AST DSL engine
 * without dynamic eval. Supports lowercase & uppercase tokens.
 */
function evaluateSafeFormulaExpression(
  rawExpr: string,
  vars: Record<string, number>,
): { valueRp: number; substituted: string } {
  let expr = rawExpr.trim();
  const eqIdx = expr.indexOf('=');
  const eqPrefix = eqIdx > 0 ? expr.slice(0, eqIdx).trim() : '';
  if (eqPrefix && /^[a-zA-Z_][a-zA-Z0-9_\s]*$/.test(eqPrefix) && !/[<>!]/.test(expr.slice(eqIdx - 1, eqIdx + 2))) {
    expr = expr.slice(eqIdx + 1).trim();
  }

  const upperVars: Record<string, number> = {};
  let substituted = expr;
  for (const [key, val] of Object.entries(vars)) {
    const rounded = Math.round(val);
    upperVars[key.toUpperCase()] = rounded;
    const re = new RegExp(`\\b${key}\\b`, 'gi');
    substituted = substituted.replace(re, String(rounded));
  }

  const astResult = evaluateFormulaDslTs(expr, upperVars);
  if (!astResult.valid) {
    const fallbackExpr = 'NET_INCOME - TOTAL_DEBT - LIVING_POOL';
    const fb = evaluateFormulaDslTs(fallbackExpr, upperVars);
    return {
      valueRp: fb.valid ? fb.valueRp : 0,
      substituted: astResult.error ? `Invalid syntax (${astResult.error})` : substituted,
    };
  }
  return {
    valueRp: astResult.valueRp,
    substituted,
  };
}

const HISTORY_SYNONYM_GROUPS: string[][] = [
  ['kopi', 'coffee', 'americano', 'espresso', 'latte', 'kenangan', 'starbucks', 'fore', 'tuku', 'cafe'],
  ['grab', 'gojek', 'ojek', 'transport', 'krl', 'commuter', 'mrt', 'taxi', 'bensin', 'fuel', 'parkir'],
  ['rokok', 'dunhill', 'vape', 'liquid', 'cartridge', 'pod', 'cigarette'],
  ['makan', 'food', 'lunch', 'dinner', 'sate', 'warteg', 'gofood', 'grabfood', 'shopeefood', 'bakmi'],
  ['sepatu', 'shoes', 'nike', 'dunk', 'new balance', 'sneakers'],
  ['ai', 'claude', 'anthropic', 'gemini', 'google', 'deepseek', 'openai', 'chatgpt'],
  ['internet', 'kuota', 'wifi', 'biznet', 'telkomsel', 'indihome'],
  ['cukur', 'haircut', 'barber', 'grooming'],
];

function expandSearchTerms(query: string): string[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
  const expanded = new Set<string>(tokens);
  for (const tok of tokens) {
    for (const grp of HISTORY_SYNONYM_GROUPS) {
      if (grp.some((word) => word.includes(tok) || tok.includes(word))) {
        for (const word of grp) expanded.add(word);
      }
    }
  }
  return Array.from(expanded);
}

@Injectable()
export class MarqueeToolsService {
  constructor(
    private readonly snapshotsSelectors: SnapshotsSelectors,
    private readonly financeService: FinanceService,
    private readonly financeSelectors: FinanceSelectors,
    private readonly creditService: CreditService,
    private readonly creditSelectors: CreditSelectors,
    private readonly savingsSelectors: SavingsSelectors,
    @Optional() private readonly snapshotsService?: SnapshotsService,
    @Optional() private readonly wishlistService?: WishlistService,
    @Optional() private readonly savingsService?: SavingsService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  private async resolvePeriod(
    userId: number,
    month?: number,
    year?: number,
  ): Promise<{ month: number; year: number }> {
    if (month && year) return { month, year };
    try {
      const def = await this.snapshotsSelectors.getDefaultActivePeriod(userId);
      return { month: def.month, year: def.year };
    } catch {
      const now = new Date();
      return { month: now.getMonth() + 1, year: now.getFullYear() };
    }
  }

  async getUserMemoryRules(userId: number): Promise<
    Array<{
      id: string;
      ruleText: string;
      merchantPattern?: string;
      defaultInstrument?: 'CASH' | 'PAYLATER' | 'CREDIT_CARD';
      createdAt: string;
    }>
  > {
    if (!this.prisma?.globalConfig || typeof this.prisma.globalConfig.findFirst !== 'function') {
      return [];
    }
    const cfg = await this.prisma.globalConfig.findFirst({ where: { userId } });
    const policy =
      cfg?.financialPolicyJson && typeof cfg.financialPolicyJson === 'object'
        ? (cfg.financialPolicyJson as Record<string, any>)
        : {};
    const list = Array.isArray(policy.marqueeMemory) ? policy.marqueeMemory : [];
    return list
      .filter((r: any) => r && typeof r.ruleText === 'string')
      .map((r: any) => ({
        id: String(r.id || ''),
        ruleText: String(r.ruleText),
        ...(r.merchantPattern ? { merchantPattern: String(r.merchantPattern) } : {}),
        ...(r.defaultInstrument ? { defaultInstrument: r.defaultInstrument } : {}),
        createdAt: String(r.createdAt || ''),
      }));
  }

  async deleteUserMemoryRule(userId: number, memoryId: string): Promise<{ removed: number; remaining: number }> {
    if (!this.prisma?.globalConfig) return { removed: 0, remaining: 0 };
    const cfg = await this.prisma.globalConfig.findFirst({ where: { userId } });
    if (!cfg) return { removed: 0, remaining: 0 };
    const policy =
      cfg.financialPolicyJson && typeof cfg.financialPolicyJson === 'object'
        ? { ...(cfg.financialPolicyJson as Record<string, any>) }
        : {};
    const existing = await this.getUserMemoryRules(userId);
    const q = memoryId.toLowerCase().trim();
    const filtered = existing.filter(
      (r) =>
        r.id !== memoryId &&
        !(q && (r.merchantPattern?.toLowerCase().includes(q) || r.ruleText.toLowerCase().includes(q))),
    );
    policy.marqueeMemory = filtered;
    await this.prisma.globalConfig.update({
      where: { id: cfg.id },
      data: { financialPolicyJson: policy as any },
    });
    return { removed: existing.length - filtered.length, remaining: filtered.length };
  }

  async executeTool(
    tool: MarqueeToolName,
    args: Record<string, any>,
    ctx: MarqueeExecutionContext,
  ): Promise<MarqueeToolResult> {
    if (tool === 'refuse_out_of_scope') {
      const reqText = String(args.reasonQuery ?? args.query ?? '').toLowerCase();
      const isId =
        /\b(tolong|dong|buat|unduh|pasang|unduh|saya|aku|kamu|gimana|tolongin|sekarang)\b/.test(reqText) ||
        args.locale === 'id';
      const summary = isId
        ? 'Maaf, saya adalah asisten keuangan Sunday Funday ERP dan hanya memiliki akses ke fungsi finansial terdaftar (cek saldo harian, simulasi cutoff kartu/PayLater, catat pengeluaran, ubah jadwal tagihan, revisi kuota, tabungan, riwayat transaksi, dan memori aturan). Saya tidak memiliki akses terminal, shell OS, unduhan web, maupun query SQL langsung.'
        : 'Sorry, I am the Sunday Funday ERP financial co-pilot and only have access to registered financial functions (daily safe-to-spend, PayLater/card cutoff simulation, expense staging, bill shifting, budget revisions, savings goals, transaction history search, and preference memory). I cannot run OS/terminal commands, download external software, or execute raw SQL.';
      return {
        ok: true,
        tool,
        summary,
        cards: [
          { label: 'Scope', value: 'Sunday Funday Financial ERP Only', tone: 'caution' },
          { label: 'Restricted', value: 'No OS / Shell / Download / Raw SQL' },
        ],
      };
    }

    const { month, year } = await this.resolvePeriod(
      ctx.userId,
      Number(args.month || ctx.month || 0) || undefined,
      Number(args.year || ctx.year || 0) || undefined,
    );
    const periodTag = `${String(month).padStart(2, '0')}/${year}`;
    const todayIso = new Date().toISOString().slice(0, 10);

    switch (tool) {
      case 'get_paycycle_pulse':
      case 'get_financial_pulse': {
        const [snapshot, pacing] = await Promise.all([
          this.snapshotsSelectors.getOrCreateDraftSnapshot(month, year, ctx.userId),
          this.financeSelectors.getPacing(month, year, undefined, undefined, ctx.userId),
        ]);
        const state = pacing.cycleTemporalState ?? 'ACTIVE';
        const remainingCash = Math.round(
          pacing.remainingBudget ?? snapshot.actualDailyOperational ?? 0,
        );
        const safeToday = Math.round(
          pacing.weightedSafeToSpendToday ?? pacing.safeToSpendToday ?? 0,
        );
        const weekdayRate = Math.round(pacing.weekdaySafeRate ?? safeToday);
        const weekendRate = Math.round(pacing.weekendSafeRate ?? safeToday);
        const deficit = Math.round(snapshot.deficitUncovered ?? 0);
        const pacingBreakdown =
          weekdayRate !== weekendRate
            ? ` (weekday ${formatRp(weekdayRate)}/day · weekend ${formatRp(weekendRate)}/day)`
            : '';
        const summary =
          state === 'PRE_PAYDAY'
            ? `Cycle ${periodTag} starts in ${pacing.daysUntilCycleStart ?? 0} days (${pacing.cycleDateLabel}). Your funded living pool is ${formatRp(remainingCash)} at a ${formatRp(pacing.baselineDailyRate)}/day baseline${deficit > 0 ? `, with a ${formatRp(deficit)} budget shortfall against the Rp 1.500.000 target` : ''}.`
            : state === 'COMPLETED'
              ? `Cycle ${periodTag} (${pacing.cycleDateLabel}) has closed with ${formatRp(remainingCash)} remaining in the living pool.`
              : `Cycle ${periodTag} is active. Safe to spend today is ${formatRp(safeToday)}${pacingBreakdown}, with ${formatRp(remainingCash)} remaining in your living pool.`;

        return {
          ok: true,
          tool,
          summary,
          cards: [
            { label: 'Active Period', value: `${periodTag} (${state})` },
            {
              label: state === 'PRE_PAYDAY' ? 'Projected Daily Rate' : 'Safe-to-Spend Today',
              value: formatRp(state === 'PRE_PAYDAY' ? pacing.baselineDailyRate : safeToday),
              tone: state === 'ACTIVE' && safeToday > 0 ? 'positive' : 'default',
            },
            {
              label: 'Funded Living Pool',
              value: formatRp(remainingCash),
              tone: remainingCash > 0 ? 'positive' : 'urgency',
            },
            ...(deficit > 0
              ? [{ label: 'Budget Shortfall', value: formatRp(deficit), tone: 'urgency' as const }]
              : []),
          ],
          data: { month, year, pacing, snapshot },
        };
      }

      case 'prepare_quick_transaction':
      case 'log_quick_expense': {
        const title = String(args.title || 'Quick Expense').trim();
        const amountRp = Math.max(0, Math.round(Number(args.amountRp ?? args.amount ?? 0)));
        const instrument = (args.instrument || 'CASH') as MarqueeInstrument;
        const tenorMonths = Math.max(1, Math.min(36, Math.round(Number(args.tenorMonths ?? 1))));
        const requestedDate =
          typeof args.purchaseDate === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(args.purchaseDate.trim())
            ? args.purchaseDate.trim()
            : todayIso;
        const explicitMonth =
          Number.isInteger(Number(args.billingStartMonth)) && Number(args.billingStartMonth) >= 1 && Number(args.billingStartMonth) <= 12
            ? Number(args.billingStartMonth)
            : undefined;
        const explicitYear =
          Number.isInteger(Number(args.billingStartYear)) && Number(args.billingStartYear) >= 2000
            ? Number(args.billingStartYear)
            : undefined;

        if (amountRp <= 0) {
          return {
            ok: false,
            tool,
            summary: 'Include a Rupiah amount to stage an expense (for example: "log coffee 45k").',
            cards: [],
          };
        }

        if (!ctx.confirm) {
          const simInstrument =
            instrument === 'PAYLATER'
              ? 'SPAYLATER'
              : instrument === 'CREDIT_CARD'
                ? 'CREDIT_CARD'
                : 'CASH';
          const preview = await this.financeSelectors.simulateCutoffForUser(
            {
              title,
              instrument: simInstrument,
              amountMode: 'PRINCIPAL_SPLIT',
              principalAmount: amountRp,
              tenorMonths,
              purchaseDate: requestedDate,
              ...(explicitMonth && explicitYear
                ? { startMonthOverride: explicitMonth, startYearOverride: explicitYear }
                : {}),
            },
            ctx.userId,
          );
          const instLabel = formatInstrumentLabel(instrument);
          return {
            ok: true,
            tool,
            summary: `Staged ${title} (${formatRp(amountRp)} via ${instLabel}${tenorMonths > 1 ? ` ${tenorMonths}x` : ''}) into ${preview.startPeriodLabel}. Verdict is ${preview.verdict} at ${preview.dsrAfterPercent}% DSR. Confirm below to commit this entry.`,
            cards: [
              { label: 'Item', value: title },
              { label: 'Amount', value: formatRp(amountRp) },
              { label: 'Routed Cycle', value: `${preview.startPeriodLabel} (${instLabel})` },
              {
                label: 'Verdict',
                value: `${preview.verdict} (DSR ${preview.dsrAfterPercent}%)`,
                tone: preview.verdict === 'SAFE' ? 'positive' : 'caution',
              },
            ],
            pendingAction: {
              type: 'CONFIRM_EXPENSE',
              payload: {
                title,
                amountRp,
                instrument,
                tenorMonths,
                month,
                year,
                purchaseDate: requestedDate,
                ...(explicitMonth && explicitYear
                  ? { billingStartMonth: explicitMonth, billingStartYear: explicitYear }
                  : {}),
              },
            },
            data: { preview },
          };
        }

        if (instrument === 'CASH') {
          const created = await this.financeService.createTransaction(
            {
              month,
              year,
              type: 'DEDUCTION',
              label: title,
              amount: amountRp,
              date: requestedDate,
              paymentMethod: 'CASH',
            } as any,
            ctx.userId,
          );
          return {
            ok: true,
            tool,
            summary: `Logged CASH expense "${title}" (${formatRp(amountRp)}) in ${periodTag}.`,
            cards: [
              { label: 'Saved Ledger Row', value: title, tone: 'positive' },
              { label: 'Amount Deducted', value: formatRp(amountRp) },
              { label: 'Period', value: periodTag },
            ],
            data: { created },
          };
        }

        const hasExplicit = Boolean(explicitMonth && explicitYear);
        const createdSchedule = await this.creditService.createLineItemSchedule(
          {
            title,
            category: instrument === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PAYLATER',
            merchantOrPlatform: instrument === 'CREDIT_CARD' ? 'Credit Card' : 'SPayLater',
            totalAmount: amountRp,
            tenorMonths,
            ...(hasExplicit ? { startMonth: explicitMonth, startYear: explicitYear } : {}),
            purchaseDate: requestedDate,
            autoRouteByCutoff: !hasExplicit,
          } as any,
          ctx.userId,
        );
        return {
          ok: true,
          tool,
          summary: `Logged ${instrument} charge "${title}" (${formatRp(amountRp)}, ${tenorMonths}x) using cutoff routing.`,
          cards: [
            { label: 'Saved Liability', value: title, tone: 'positive' },
            { label: 'Total Amount', value: formatRp(amountRp) },
            { label: 'Schedule', value: `${tenorMonths}x (${instrument})` },
          ],
          data: { createdSchedule },
        };
      }

      case 'simulate_purchase_cutoff':
      case 'evaluate_affordability': {
        const title = String(args.title || 'Planned Purchase').trim();
        const amountRp = Math.max(0, Math.round(Number(args.amountRp ?? args.amount ?? 0)));
        const instrument = (args.instrument || 'PAYLATER') as MarqueeInstrument;
        const tenorMonths = Math.max(1, Math.min(36, Math.round(Number(args.tenorMonths ?? 1))));
        const simInstrument =
          instrument === 'CREDIT_CARD'
            ? 'CREDIT_CARD'
            : instrument === 'CASH'
              ? 'CASH'
              : 'SPAYLATER';
        const requestedDate =
          typeof args.purchaseDate === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(args.purchaseDate.trim())
            ? args.purchaseDate.trim()
            : todayIso;
        const sim = await this.financeSelectors.simulateCutoffForUser(
          {
            title,
            instrument: simInstrument,
            amountMode: 'PRINCIPAL_SPLIT',
            principalAmount: amountRp,
            tenorMonths,
            purchaseDate: requestedDate,
          },
          ctx.userId,
        );
        const simSummary =
          amountRp > 0
            ? `Checking "${title}" (${formatRp(amountRp)} on ${simInstrument}, ${tenorMonths}x on ${requestedDate}): bills first in ${sim.startPeriodLabel} (due ${sim.firstDueDateIso}). Verdict is ${sim.verdict} with post-purchase DSR at ${sim.dsrAfterPercent}%.`
            : `${simInstrument} cutoff simulation for ${requestedDate}: closes ${sim.cutoffDay}th, bills first in ${sim.startPeriodLabel} (due ${sim.firstDueDateIso}).`;
        return {
          ok: true,
          tool,
          summary: simSummary,
          cards: [
            {
              label: 'Target Purchase',
              value: amountRp > 0 ? `${title} (${formatRp(amountRp)})` : `${simInstrument} · ${requestedDate}`,
            },
            { label: 'First Billed Cycle', value: sim.startPeriodLabel },
            { label: 'First Due Date', value: sim.firstDueDateIso },
            {
              label: 'Verdict',
              value: `${sim.verdict} · DSR ${sim.dsrAfterPercent}%`,
              tone: sim.verdict === 'SAFE' ? 'positive' : 'caution',
            },
          ],
          data: { sim },
        };
      }

      case 'optimize_payday_thr_split': {
        const snapshot = await this.snapshotsSelectors.getOrCreateDraftSnapshot(
          month,
          year,
          ctx.userId,
        );
        const bonusRp = Math.max(
          0,
          Math.round(Number(args.bonusRp ?? args.amountRp ?? 3_400_000)),
        );
        const shortfall = Math.round(Number(snapshot.deficitUncovered ?? 0));
        const coverShortfall = Math.min(bonusRp, shortfall);
        const afterShortfall = bonusRp - coverShortfall;
        const p1Allocation = Math.min(1_000_000, Math.round(afterShortfall * 0.4));
        const debtPrepay = Math.round((afterShortfall - p1Allocation) * 0.5);
        const livingAndReward = Math.max(0, afterShortfall - p1Allocation - debtPrepay);

        return {
          ok: true,
          tool,
          summary: `For a ${formatRp(bonusRp)} THR or bonus in ${periodTag}: clear ${formatRp(coverShortfall)} in living shortfall first, lock ${formatRp(p1Allocation)} into your Emergency Fund / P1 Savings Reserve, direct ${formatRp(debtPrepay)} toward high-cost SPinjam/PayLater debt, and keep ${formatRp(livingAndReward)} for holiday living and P2 flexibility.`,
          cards: [
            { label: 'Bonus / THR Pool', value: formatRp(bonusRp), tone: 'positive' },
            { label: '1. Shortfall Cover', value: formatRp(coverShortfall) },
            { label: '2. P1 Savings Reserve', value: formatRp(p1Allocation), tone: 'positive' },
            {
              label: '3. Debt + Holiday Buffer',
              value: `${formatRp(debtPrepay)} debt · ${formatRp(livingAndReward)} buffer`,
            },
          ],
          data: {
            bonusRp,
            coverShortfall,
            p1Allocation,
            debtPrepay,
            livingAndReward,
          },
        };
      }

      case 'evaluate_custom_formula': {
        const [snapshot, pacing] = await Promise.all([
          this.snapshotsSelectors.getOrCreateDraftSnapshot(month, year, ctx.userId),
          this.financeSelectors.getPacing(month, year, undefined, undefined, ctx.userId),
        ]);
        const vars: Record<string, number> = {
          net_income: Math.round(Number(snapshot.finalTotalIncome ?? 0)),
          total_debt: Math.round(Number(snapshot.totalDeductions ?? 0)),
          living_pool: Math.round(Number(snapshot.actualDailyOperational ?? 0)),
          shortfall: Math.round(Number(snapshot.deficitUncovered ?? 0)),
          p1_savings: Math.round(Number(snapshot.actualSavings ?? 0)),
          p2_buffer: Math.round(Number(snapshot.selfReward ?? 0)),
          daily_rate: Math.round(Number(pacing.baselineDailyRate ?? 0)),
        };
        const rawExpr = String(
          args.expression || 'net_income - total_debt - living_pool',
        ).trim();
        const evaluated = evaluateSafeFormulaExpression(rawExpr, vars);

        return {
          ok: true,
          tool,
          summary: `Formula "${rawExpr}" evaluates to ${formatRp(evaluated.valueRp)} on ${periodTag} (${evaluated.substituted}).`,
          cards: [
            { label: 'Formula Expression', value: rawExpr },
            {
              label: 'Computed Output',
              value: formatRp(evaluated.valueRp),
              tone: evaluated.valueRp >= 0 ? 'positive' : 'urgency',
            },
            { label: 'Net Income Token', value: formatRp(vars.net_income) },
            { label: 'Total Debt Token', value: formatRp(vars.total_debt) },
          ],
          data: {
            expression: rawExpr,
            valueRp: evaluated.valueRp,
            substituted: evaluated.substituted,
            evaluated,
            vars,
          },
        };
      }

      case 'explain_period_variance': {
        const compareMonth =
          Number(args.compareMonth) || (month === 12 ? 1 : month + 1);
        const compareYear =
          Number(args.compareYear) || (month === 12 ? year + 1 : year);
        const compareTag = `${String(compareMonth).padStart(2, '0')}/${compareYear}`;

        const [currSnap, nextSnap, matrix] = await Promise.all([
          this.snapshotsSelectors.getOrCreateDraftSnapshot(month, year, ctx.userId),
          this.snapshotsSelectors.getOrCreateDraftSnapshot(
            compareMonth,
            compareYear,
            ctx.userId,
          ),
          this.creditSelectors.getLiabilityMatrix(month, year, 3, ctx.userId),
        ]);

        const incomeDelta = Math.round(
          Number(nextSnap.finalTotalIncome ?? 0) - Number(currSnap.finalTotalIncome ?? 0),
        );
        const debtDelta = Math.round(
          Number(nextSnap.totalDeductions ?? 0) - Number(currSnap.totalDeductions ?? 0),
        );
        const livingDelta = Math.round(
          Number(nextSnap.actualDailyOperational ?? 0) -
            Number(currSnap.actualDailyOperational ?? 0),
        );

        return {
          ok: true,
          tool,
          summary: `Comparing ${periodTag} to ${compareTag}: take-home pay shifts by ${formatRp(incomeDelta)} (${formatRp(currSnap.finalTotalIncome ?? 0)} to ${formatRp(nextSnap.finalTotalIncome ?? 0)}), total debt changes by ${formatRp(debtDelta)} (${formatRp(currSnap.totalDeductions ?? 0)} to ${formatRp(nextSnap.totalDeductions ?? 0)}), and funded living pool moves by ${formatRp(livingDelta)}.`,
          cards: [
            { label: `${periodTag} vs ${compareTag} Income`, value: formatRp(incomeDelta), tone: incomeDelta >= 0 ? 'positive' : 'caution' },
            { label: `${periodTag} vs ${compareTag} Debt`, value: formatRp(debtDelta), tone: debtDelta <= 0 ? 'positive' : 'caution' },
            { label: `${periodTag} Shortfall`, value: formatRp(currSnap.deficitUncovered ?? 0), tone: (currSnap.deficitUncovered ?? 0) > 0 ? 'urgency' : 'default' },
            { label: `${compareTag} Funded P1`, value: formatRp(nextSnap.actualSavings ?? 0), tone: 'positive' },
          ],
          data: { currSnap, nextSnap, matrix, incomeDelta, debtDelta, livingDelta },
        };
      }

      case 'get_upcoming_bills': {
        const matrix = await this.creditSelectors.getLiabilityMatrix(month, year, 3, ctx.userId);
        const key = `${year}-${month}`;
        const payLater = Math.round(matrix.payLaterRow?.cells?.[key]?.amount ?? 0);
        const cc = Math.round(matrix.creditCardRow?.cells?.[key]?.amount ?? 0);
        const personal = Math.round(matrix.personalDebtRow?.cells?.[key]?.amount ?? 0);
        const total = Math.round(matrix.totalsPerMonth?.[key] ?? payLater + cc + personal);
        return {
          ok: true,
          tool,
          summary: `Obligations due under ${periodTag} total ${formatRp(total)}: PayLater ${formatRp(payLater)} (due 24th/25th), Credit Card ${formatRp(cc)} (due 11th), and Personal Debt ${formatRp(personal)} (SPinjam due 8th/17th/23rd/24th).`,
          cards: [
            { label: 'PayLater (24th/25th)', value: formatRp(payLater) },
            { label: 'Credit Card (11th)', value: formatRp(cc) },
            { label: 'Personal Debt / SPinjam', value: formatRp(personal) },
            { label: 'Total Cycle Debt', value: formatRp(total), tone: 'caution' },
          ],
          data: { payLater, cc, personal, total },
        };
      }

      case 'prepare_wallet_checkin':
      case 'wallet_checkin_guard': {
        const actualWalletBalance = Math.max(
          0,
          Math.round(Number(args.amountRp ?? args.actualWalletBalance ?? 0)),
        );
        const guardRes = await this.financeService.evaluateAndPersistWalletGuard(
          {
            month,
            year,
            actualWalletBalance,
            persist: Boolean(ctx.confirm),
            note: 'Marquee Wallet Check-In',
          },
          ctx.userId,
        );
        const g = guardRes?.guard;
        return {
          ok: true,
          tool,
          summary: `Wallet check-in at ${formatRp(actualWalletBalance)}: ${formatRp(g?.freeSpendableCash ?? 0)} is free to spend after holding ${formatRp(g?.reservedBillsTotal ?? 0)} for unpaid bills (${g?.guardStatus ?? 'SAFE'}).`,
          cards: [
            { label: 'Wallet Cash', value: formatRp(actualWalletBalance) },
            { label: 'Hold for Unpaid Bills', value: formatRp(g?.reservedBillsTotal ?? 0), tone: 'caution' },
            {
              label: 'Free Spendable Cash',
              value: formatRp(g?.freeSpendableCash ?? 0),
              tone: (g?.freeSpendableCash ?? 0) >= 0 ? 'positive' : 'urgency',
            },
            { label: 'Guard Status', value: String(g?.guardStatus ?? 'SAFE') },
          ],
          data: { guardRes },
        };
      }

      case 'analyze_debt_burndown':
      case 'get_debt_burndown': {
        const bd: any = await this.financeSelectors.getContractsBurndown(month, year, ctx.userId);
        const activeCount = bd.activeCount ?? bd.plans?.length ?? 0;
        const monthlyTotal = bd.totalMonthlyCommitmentRp ?? 0;
        const totalRem =
          bd.totalRemainingPrincipalRp ??
          (Array.isArray(bd.plans)
            ? bd.plans.reduce((s: number, p: any) => s + Number(p.remainingPrincipal ?? 0), 0)
            : 0);
        return {
          ok: true,
          tool,
          summary: `You have ${activeCount} active installment plans carrying ${formatRp(totalRem)} in remaining principal (${formatRp(monthlyTotal)}/mo). Milestones: 11.11 3x plans finish in JAN '27, SPinjam reaches Rp 0 in FEB '27, and your final card installment matures in ${bd.debtFreedomLabel ?? "SEP '27"}.`,
          cards: [
            { label: 'Active Plans', value: `${activeCount}` },
            { label: 'Monthly Commitment', value: `${formatRp(monthlyTotal)}/mo` },
            { label: 'Remaining Principal', value: formatRp(totalRem), tone: 'caution' },
            { label: 'Debt Freedom Horizon', value: String(bd.debtFreedomLabel ?? 'Scheduled'), tone: 'positive' },
          ],
          data: { bd },
        };
      }

      case 'get_savings_and_goals': {
        const [overview, goals] = await Promise.all([
          this.savingsSelectors.getOverview(undefined, ctx.userId),
          this.savingsSelectors.getGoals(undefined, ctx.userId),
        ]);
        const ov: any = overview ?? {};
        const totalBal = Math.round(ov.totalBalance ?? ov.totalNetSavings ?? 0);
        const rdpuBal = Math.round(ov.rdpuBalance ?? ov.investmentBalance ?? 0);
        const goalList = Array.isArray(goals) ? goals : [];
        return {
          ok: true,
          tool,
          summary: `P1 Savings Reserve holds ${formatRp(totalBal)} (${formatRp(rdpuBal)} in RDPU) across ${goalList.length} tracked goal(s).`,
          cards: [
            { label: 'Total Savings Reserve', value: formatRp(totalBal), tone: 'positive' },
            { label: 'Money Market (RDPU)', value: formatRp(rdpuBal) },
            { label: 'Active Goals', value: `${goalList.length}` },
          ],
          data: { overview, goals: goalList },
        };
      }

      case 'simulate_debt_payoff': {
        const lumpSumRp = Math.max(
          0,
          Math.round(Number(args.lumpSumRp ?? args.amountRp ?? 1_000_000)),
        );
        const intel: any = await this.financeSelectors.getIntelligenceBundle(
          month,
          year,
          lumpSumRp,
          ctx.userId,
        );
        const strategies: any[] = intel?.debtopt?.strategies ?? [];
        const top = strategies[0];
        return {
          ok: true,
          tool,
          summary: top
            ? `Applying ${formatRp(lumpSumRp)} via ${top.strategy} frees ${formatRp(top.immediateFreedMonthlyRp ?? 0)}/mo immediately and saves ${formatRp(top.estimatedInterestSavedRp ?? 0)} in interest.`
            : `Prepayment simulation for ${formatRp(lumpSumRp)} completed on ${periodTag}.`,
          cards: [
            { label: 'Extra Prepayment', value: formatRp(lumpSumRp) },
            { label: 'Top Strategy', value: String(top?.strategy ?? 'AVALANCHE'), tone: 'positive' },
            { label: 'Monthly Cashflow Freed', value: `${formatRp(top?.immediateFreedMonthlyRp ?? 0)}/mo` },
            { label: 'Estimated Interest Saved', value: formatRp(top?.estimatedInterestSavedRp ?? 0), tone: 'positive' },
          ],
          data: { debtopt: intel?.debtopt },
        };
      }

      case 'manage_liability_item': {
        const rawAction = String(args.action || 'SHIFT_EARLIER').toUpperCase();
        const isSettle = rawAction === 'SETTLE' || rawAction === 'UNSETTLE';
        const direction: 'EARLIER' | 'LATER' =
          rawAction === 'SHIFT_LATER' ? 'LATER' : 'EARLIER';
        const splitAmount =
          args.splitAmount && Number(args.splitAmount) > 0
            ? Math.round(Number(args.splitAmount))
            : undefined;

        let targetItem: any = null;
        if (args.itemId) {
          if (typeof (this.prisma as any)?.liabilityLineItem?.findUnique === 'function') {
            targetItem = await (this.prisma as any).liabilityLineItem.findUnique({
              where: { id: Number(args.itemId) },
            });
          } else if (typeof (this.prisma as any)?.liabilityLineItem?.findMany === 'function') {
            const list = await (this.prisma as any).liabilityLineItem.findMany({
              where: { userId: ctx.userId },
            });
            targetItem = (list ?? []).find((x: any) => Number(x.id) === Number(args.itemId)) ?? null;
          }
          if (!targetItem) {
            targetItem = {
              id: Number(args.itemId),
              title: String(args.title || `Item #${args.itemId}`),
              month,
              year,
            };
          }
        } else if (typeof (this.prisma as any)?.liabilityLineItem?.findMany === 'function') {
          const items: any[] = await (this.prisma as any).liabilityLineItem.findMany({
            where: { userId: ctx.userId },
            orderBy: [{ year: 'asc' }, { month: 'asc' }],
            take: 60,
          });
          const q = String(args.itemQuery || args.title || '').toLowerCase().trim();
          targetItem =
            items.find((i) => !q || String(i.title || '').toLowerCase().includes(q)) ??
            items[0] ??
            null;
        }

        if (!targetItem) {
          return {
            ok: false,
            tool,
            summary: 'No matching PayLater or installment item was found in your schedule.',
            cards: [],
          };
        }

        const itemId = Number(targetItem.id);
        const itemTitle = String(targetItem.title || `Item #${itemId}`);
        const itemAmt = Math.round(Number(targetItem.monthlyAmount ?? 0));

        if (!ctx.confirm) {
          if (isSettle) {
            const nextPaid = rawAction === 'SETTLE';
            return {
              ok: true,
              tool,
              summary: `Staged ${nextPaid ? 'settlement' : 'reopen'} for "${itemTitle}" (${formatRp(itemAmt)}). Confirm below to update the ledger.`,
              cards: [
                { label: 'Target Item', value: itemTitle },
                { label: 'Amount', value: formatRp(itemAmt) },
                { label: 'Action', value: nextPaid ? 'Mark Paid' : 'Mark Unpaid', tone: 'caution' },
              ],
              pendingAction: {
                type: 'CONFIRM_SETTLE_LIABILITY',
                title: itemTitle,
                payload: {
                  itemId,
                  title: itemTitle,
                  action: rawAction,
                  isSettled: nextPaid,
                  month: Number(targetItem.month ?? month),
                  year: Number(targetItem.year ?? year),
                },
              },
              data: { targetItem },
            };
          }

          return {
            ok: true,
            tool,
            summary: `Staged shift ${direction.toLowerCase()} for "${itemTitle}" (${formatRp(itemAmt)}). Confirm below to move its billing period.`,
            cards: [
              { label: 'Target Item', value: itemTitle },
              { label: 'Amount', value: formatRp(itemAmt) },
              { label: 'Move Direction', value: direction, tone: 'caution' },
            ],
            pendingAction: {
              type: 'CONFIRM_SHIFT_LIABILITY',
              title: itemTitle,
              payload: {
                itemId,
                title: itemTitle,
                action: rawAction,
                direction,
                ...(splitAmount ? { splitAmount } : {}),
                month: Number(targetItem.month ?? month),
                year: Number(targetItem.year ?? year),
              },
            },
            data: { targetItem },
          };
        }

        if (isSettle) {
          const updated = await this.creditService.toggleLineItemSettled(
            itemId,
            rawAction === 'SETTLE',
            ctx.userId,
          );
          return {
            ok: true,
            tool,
            summary: `Updated "${itemTitle}" settlement state cleanly.`,
            cards: [
              { label: 'Updated Item', value: itemTitle, tone: 'positive' },
              { label: 'Status', value: rawAction === 'SETTLE' ? 'Paid' : 'Unpaid' },
            ],
            data: { updated },
          };
        }

        const shiftDto: any = { direction };
        if (splitAmount) shiftDto.splitAmount = splitAmount;
        const shifted = await this.creditService.shiftLineItem(
          itemId,
          shiftDto,
          ctx.userId,
        );
        return {
          ok: true,
          tool,
          summary: `Moved "${itemTitle}" ${direction.toLowerCase()} across paycycles and recalculated totals.`,
          cards: [
            { label: 'Moved Item', value: itemTitle, tone: 'positive' },
            { label: 'Direction', value: direction },
            {
              label: 'Periods Updated',
              value: Array.isArray((shifted as any)?.affectedPeriods)
                ? (shifted as any).affectedPeriods
                    .map((p: any) => `${String(p.month).padStart(2, '0')}/${p.year}`)
                    .join(' -> ')
                : periodTag,
            },
          ],
          data: { shifted },
        };
      }

      case 'revise_budget_or_quota': {
        const category = String(args.category || 'DAILY_OPERATIONAL').toUpperCase();
        const newValueRp = Math.max(
          0,
          Math.round(Number(args.newValueRp ?? args.amountRp ?? 0)),
        );
        const reason = String(args.reason || `Updated via Marquee for ${periodTag}`).trim();

        if (!ctx.confirm) {
          return {
            ok: true,
            tool,
            summary: `Staged ${category} budget revision to ${formatRp(newValueRp)} for ${periodTag}. Confirm below to apply.`,
            cards: [
              { label: 'Target Bucket', value: category },
              { label: 'New Quota', value: formatRp(newValueRp), tone: 'caution' },
              { label: 'Period', value: periodTag },
            ],
            pendingAction: {
              type: 'CONFIRM_BUDGET_REVISION',
              title: `${category} -> ${formatRp(newValueRp)}`,
              payload: { category, newValueRp, month, year, reason },
            },
          };
        }

        let snapId = 0;
        if (typeof (this.snapshotsSelectors as any)?.getOrCreateDraftSnapshot === 'function') {
          const snap = await this.snapshotsSelectors.getOrCreateDraftSnapshot(
            month,
            year,
            ctx.userId,
          );
          snapId = Number((snap as any)?.id ?? 0);
        }

        let revision: any = null;
        if (typeof (this.snapshotsService as any)?.createBudgetRevision === 'function') {
          revision = await this.snapshotsService!.createBudgetRevision(
            snapId,
            { category: category as any, newValue: newValueRp, reason },
            ctx.userId,
          );
        } else if (typeof (this.snapshotsService as any)?.createRevision === 'function') {
          revision = await (this.snapshotsService as any).createRevision(
            month,
            year,
            { category, newValue: newValueRp, reason },
            ctx.userId,
          );
        }

        return {
          ok: true,
          tool,
          summary: `Revised ${category} in ${periodTag} to ${formatRp(newValueRp)} and recalculated allocations.`,
          cards: [
            { label: 'Updated Bucket', value: category, tone: 'positive' },
            { label: 'New Target', value: formatRp(newValueRp), tone: 'positive' },
            { label: 'Period', value: periodTag },
          ],
          data: { revision },
        };
      }

      case 'manage_savings_pocket_or_goal': {
        const action = String(args.action || 'TOPUP').toUpperCase();
        const amountRp = Math.max(0, Math.round(Number(args.amountRp ?? args.amount ?? 0)));
        const label = String(args.label || args.title || 'Savings Contribution').trim();
        const instrumentType = String(args.instrumentType || 'LIQUID_CASH').toUpperCase();

        if (!ctx.confirm) {
          return {
            ok: true,
            tool,
            summary: `Staged ${action.toLowerCase()} "${label}" (${formatRp(amountRp)}) in Savings Reserve. Confirm below to commit.`,
            cards: [
              { label: 'Action', value: action },
              { label: 'Label', value: label },
              { label: 'Amount', value: formatRp(amountRp), tone: 'positive' },
            ],
            pendingAction: {
              type: 'CONFIRM_SAVINGS_ACTION',
              title: label,
              payload: { action, label, amountRp, instrumentType, month, year },
            },
          };
        }

        let saved: any = null;
        if (action === 'CREATE_GOAL' && this.savingsService) {
          saved = await this.savingsService.createGoal(
            {
              title: label,
              targetAmount: amountRp,
              currentAllocatedAmount: 0,
            } as any,
            ctx.userId,
          );
        } else if (this.savingsService) {
          saved = await this.savingsService.createTransaction(
            {
              type: action === 'WITHDRAWAL' ? 'WITHDRAWAL' : 'TOPUP',
              label,
              amount: amountRp,
              instrumentType,
              date: todayIso,
              periodMonth: month,
              periodYear: year,
            } as any,
            ctx.userId,
          );
        }

        return {
          ok: true,
          tool,
          summary: `Saved ${action.toLowerCase()} "${label}" (${formatRp(amountRp)}) into your Savings Reserve.`,
          cards: [
            { label: 'Saved Action', value: label, tone: 'positive' },
            { label: 'Amount', value: formatRp(amountRp), tone: 'positive' },
          ],
          data: { saved },
        };
      }

      case 'manage_wishlist_or_subscription': {
        const action = String(args.action || 'ADD_WISHLIST').toUpperCase();
        const title = String(args.title || args.label || 'New Item').trim();
        const amountRp = Math.max(0, Math.round(Number(args.amountRp ?? args.price ?? 0)));

        if (action === 'TOGGLE_KILL_SWITCH') {
          const itemId = Number(args.itemId ?? 0);
          if (!ctx.confirm) {
            return {
              ok: true,
              tool,
              summary: `Staged subscription kill-switch update for "${title}". Confirm below to apply.`,
              cards: [
                { label: 'Subscription', value: title },
                { label: 'Action', value: 'Confirm Cancel / Auto-Stop', tone: 'caution' },
              ],
              pendingAction: {
                type: 'CONFIRM_SUBSCRIPTION_ACTION',
                title,
                payload: { action, itemId, title, confirmCancel: Boolean(args.confirmCancel ?? true), month, year },
              },
            };
          }
          const updated =
            itemId > 0
              ? await this.creditService.updateKillSwitch(
                  itemId,
                  {
                    providerCancelConfirmed: Boolean(args.confirmCancel ?? true),
                    autoStopAfterPromo: true,
                  } as any,
                  ctx.userId,
                )
              : null;
          return {
            ok: true,
            tool,
            summary: `Updated kill-switch for "${title}".`,
            cards: [{ label: 'Updated', value: title, tone: 'positive' }],
            data: { updated },
          };
        }

        if (!ctx.confirm) {
          return {
            ok: true,
            tool,
            summary: `Staged wishlist item "${title}" (${formatRp(amountRp)}). Confirm below to save it.`,
            cards: [
              { label: 'Wishlist Target', value: title },
              { label: 'Estimated Price', value: formatRp(amountRp), tone: 'positive' },
            ],
            pendingAction: {
              type: 'CONFIRM_WISHLIST_ADD',
              title,
              payload: { action, title, amountRp, month, year },
            },
          };
        }

        const createdWish =
          this.wishlistService &&
          (typeof (this.wishlistService as any).createWishlist === 'function'
            ? await (this.wishlistService as any).createWishlist(
                { name: title, price: amountRp, targetMonth: month, targetYear: year },
                ctx.userId,
              )
            : await this.wishlistService.createItem(
                { name: title, price: amountRp, targetMonth: month, targetYear: year } as any,
                ctx.userId,
              ));

        return {
          ok: true,
          tool,
          summary: `Added "${title}" (${formatRp(amountRp)}) to your Wishlist.`,
          cards: [
            { label: 'Saved Target', value: title, tone: 'positive' },
            { label: 'Target Price', value: formatRp(amountRp) },
          ],
          data: { createdWish },
        };
      }

      case 'run_what_if_scenario': {
        const extraMonthlySavingsRp = Math.max(
          0,
          Math.round(Number(args.extraMonthlySavingsRp ?? args.amountRp ?? 500_000)),
        );
        const oneTimeBonusRp = Math.max(
          0,
          Math.round(Number(args.oneTimeBonusRp ?? 0)),
        );
        const extraDebtPrepaymentRp = Math.max(
          0,
          Math.round(Number(args.extraDebtPrepaymentRp ?? args.reduceMonthlyDebtRp ?? 0)),
        );
        const scenario: any = await this.financeSelectors.simulateScenarioForUser(
          {
            month,
            year,
            extraMonthlySavingsRp,
            oneTimeBonusRp,
            extraDebtPrepaymentRp,
          },
          ctx.userId,
        );
        const delta = Math.round(Number(scenario?.net12MDeltaRp ?? 0));
        const runwayDelta = Math.round(Number(scenario?.runwayDeltaDays ?? 0));
        return {
          ok: true,
          tool,
          summary: `Running 12-month simulation (+${formatRp(extraMonthlySavingsRp)}/mo savings): projected wealth shifts by +${formatRp(delta)} with ${runwayDelta >= 0 ? '+' : ''}${runwayDelta} runway days.`,
          cards: [
            { label: 'Extra Monthly Savings', value: `${formatRp(extraMonthlySavingsRp)}/mo` },
            { label: '12M Wealth Impact', value: `+${formatRp(delta)}`, tone: 'positive' },
            { label: 'Runway Gain', value: `+${runwayDelta}d`, tone: 'positive' },
          ],
          data: { scenario },
        };
      }

      case 'manage_user_memory': {
        const action = String(args.action || 'LIST').toUpperCase();
        if (action === 'LIST') {
          const rules = await this.getUserMemoryRules(ctx.userId);
          return {
            ok: true,
            tool,
            summary:
              rules.length > 0
                ? `Active preference rules (${rules.length}):\n${rules.map((r) => `- ${r.ruleText}`).join('\n')}`
                : 'No custom financial preference rules saved yet.',
            cards: [{ label: 'Saved Rules', value: String(rules.length) }],
            data: { rules },
          };
        }

        if (action === 'FORGET') {
          const idOrQuery = String(args.memoryId ?? args.merchantPattern ?? args.ruleText ?? '').trim();
          const res = await this.deleteUserMemoryRule(ctx.userId, idOrQuery);
          return {
            ok: true,
            tool,
            summary:
              res.removed > 0
                ? `Removed ${res.removed} saved rule (${res.remaining} remaining).`
                : 'No matching saved rule was found to remove.',
            cards: [
              { label: 'Removed', value: String(res.removed) },
              { label: 'Remaining Rules', value: String(res.remaining) },
            ],
            data: res,
          };
        }

        const ruleText = String(args.ruleText ?? args.rule ?? '').trim();
        if (!ruleText) {
          return {
            ok: false,
            tool,
            summary: 'Specify the preference or rule you want Marquee to remember.',
            cards: [],
          };
        }
        const merchantPattern = args.merchantPattern
          ? String(args.merchantPattern).trim().toLowerCase()
          : undefined;
        const defaultInstrument =
          args.defaultInstrument && ['CASH', 'PAYLATER', 'CREDIT_CARD'].includes(String(args.defaultInstrument).toUpperCase())
            ? (String(args.defaultInstrument).toUpperCase() as 'CASH' | 'PAYLATER' | 'CREDIT_CARD')
            : undefined;

        const existing = await this.getUserMemoryRules(ctx.userId);
        const newRule = {
          id: `mem_${Date.now()}`,
          ruleText,
          ...(merchantPattern ? { merchantPattern } : {}),
          ...(defaultInstrument ? { defaultInstrument } : {}),
          createdAt: new Date().toISOString(),
        };
        const updated = [
          ...existing.filter((r) => !merchantPattern || r.merchantPattern !== merchantPattern),
          newRule,
        ].slice(-25);

        if (this.prisma?.globalConfig) {
          const cfg = await this.prisma.globalConfig.findFirst({ where: { userId: ctx.userId } });
          if (cfg) {
            const policy =
              cfg.financialPolicyJson && typeof cfg.financialPolicyJson === 'object'
                ? { ...(cfg.financialPolicyJson as Record<string, any>) }
                : {};
            policy.marqueeMemory = updated;
            await this.prisma.globalConfig.update({
              where: { id: cfg.id },
              data: { financialPolicyJson: policy as any },
            });
          }
        }

        return {
          ok: true,
          tool,
          summary: `Remembered rule: "${ruleText}"${defaultInstrument ? ` (defaults to ${formatInstrumentLabel(defaultInstrument)})` : ''}.`,
          cards: [
            { label: 'Memory Rule', value: merchantPattern || 'General Policy', tone: 'positive' },
            ...(defaultInstrument ? [{ label: 'Default Method', value: formatInstrumentLabel(defaultInstrument) }] : []),
            { label: 'Total Saved Rules', value: String(updated.length) },
          ],
          data: { rule: newRule, rules: updated },
        };
      }

      case 'search_financial_history': {
        const query = String(args.query ?? args.searchQuery ?? args.title ?? '').trim();
        if (!this.prisma) {
          return {
            ok: false,
            tool,
            summary: 'Historical ledger search requires database access.',
            cards: [],
          };
        }

        const terms = expandSearchTerms(query);
        const [txs, ccTxs, lineItems] = await Promise.all([
          typeof this.prisma.transaction?.findMany === 'function'
            ? this.prisma.transaction
                .findMany({
                  where: { snapshot: { userId: ctx.userId } },
                  orderBy: { date: 'desc' },
                  take: 300,
                })
                .catch(() => [])
            : Promise.resolve([]),
          typeof this.prisma.creditCardTransaction?.findMany === 'function'
            ? this.prisma.creditCardTransaction
                .findMany({
                  where: { userId: ctx.userId },
                  orderBy: { transactionDate: 'desc' },
                  take: 200,
                })
                .catch(() => [])
            : Promise.resolve([]),
          typeof this.prisma.liabilityLineItem?.findMany === 'function'
            ? this.prisma.liabilityLineItem
                .findMany({
                  where: { userId: ctx.userId },
                  orderBy: [{ year: 'desc' }, { month: 'desc' }],
                  take: 300,
                })
                .catch(() => [])
            : Promise.resolve([]),
        ]);

        interface HistoryMatch {
          source: string;
          label: string;
          amountRp: number;
          period: string;
          score: number;
        }
        const candidates: HistoryMatch[] = [
          ...(Array.isArray(txs) ? txs : []).map((t: any) => {
            const d = t.date ? new Date(t.date) : null;
            return {
              source: 'Transaction',
              label: String(t.label ?? ''),
              amountRp: Math.round(Number(t.amount ?? 0)),
              period: d ? `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}` : periodTag,
              score: 0,
            };
          }),
          ...(Array.isArray(ccTxs) ? ccTxs : []).map((c: any) => ({
            source: 'Credit Card',
            label: String(c.label ?? ''),
            amountRp: Math.round(Number(c.amount ?? c.monthlyAmount ?? 0)),
            period: `${String(c.billingMonth ?? c.startMonth ?? month).padStart(2, '0')}/${c.billingYear ?? c.startYear ?? year}`,
            score: 0,
          })),
          ...(Array.isArray(lineItems) ? lineItems : []).map((li: any) => ({
            source: formatInstrumentLabel(String(li.category ?? 'Bill')),
            label: String(li.title ?? ''),
            amountRp: Math.round(Number(li.monthlyAmount ?? 0)),
            period: `${String(li.month ?? month).padStart(2, '0')}/${li.year ?? year}`,
            score: 0,
          })),
        ];

        const lowerQ = query.toLowerCase();
        const matches = candidates
          .map((item) => {
            const hay = item.label.toLowerCase();
            let score = lowerQ && hay.includes(lowerQ) ? 3 : 0;
            for (const t of terms) {
              if (hay.includes(t)) score += 1;
            }
            return { ...item, score };
          })
          .filter((item) => (terms.length > 0 ? item.score > 0 : true))
          .sort((a, b) => b.score - a.score || b.amountRp - a.amountRp);

        const totalMatchedRp = matches.reduce((s, m) => s + m.amountRp, 0);
        const topPreview = matches
          .slice(0, 8)
          .map((m) => `- [${m.period}] ${m.label} (${m.source}): ${formatRp(m.amountRp)}`)
          .join('\n');

        return {
          ok: true,
          tool,
          summary:
            matches.length > 0
              ? `Found ${matches.length} matching entries for "${query}" totaling ${formatRp(totalMatchedRp)}:\n${topPreview}`
              : `No matching entries found for "${query}" across your ledger history.`,
          cards: [
            { label: 'Query', value: query || 'All History' },
            { label: 'Matches', value: `${matches.length} entries` },
            { label: 'Matched Total', value: formatRp(totalMatchedRp), tone: matches.length > 0 ? 'positive' : 'default' },
          ],
          data: {
            query,
            expandedTerms: terms,
            matchCount: matches.length,
            totalMatchedRp,
            matches: matches.slice(0, 20),
          },
        };
      }
    }
  }
}
