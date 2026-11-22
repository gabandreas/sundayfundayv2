import { Injectable } from '@nestjs/common';
import { SnapshotsSelectors } from '../snapshots/snapshots.selectors';
import { FinanceService } from '../finance/finance.service';
import { FinanceSelectors } from '../finance/finance.selectors';
import { CreditService } from '../credit/credit.service';
import { CreditSelectors } from '../credit/credit.selectors';
import { SavingsSelectors } from '../savings/savings.selectors';
import { MarqueeInstrument, MarqueeToolName } from './marquee-nlu';

export interface MarqueeCardItem {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'caution' | 'urgency';
}

export interface MarqueePendingAction {
  type: 'CONFIRM_EXPENSE';
  payload: {
    title: string;
    amountRp: number;
    instrument: MarqueeInstrument;
    tenorMonths: number;
    month: number;
    year: number;
  };
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
 * Safe deterministic evaluator for custom financial formulas over live snapshot tokens.
 * Supports +, -, *, /, parentheses, numbers, and reserved identifiers.
 */
function evaluateSafeFormulaExpression(
  rawExpr: string,
  vars: Record<string, number>,
): { valueRp: number; substituted: string } {
  let expr = rawExpr.trim();
  const eqIdx = expr.indexOf('=');
  if (eqIdx >= 0 && eqIdx < expr.length - 1) {
    expr = expr.slice(eqIdx + 1).trim();
  }

  let substituted = expr;
  for (const [key, val] of Object.entries(vars)) {
    const re = new RegExp(`\\b${key}\\b`, 'gi');
    substituted = substituted.replace(re, String(Math.round(val)));
  }

  // Strip everything except digits, whitespace, decimal points, +, -, *, /, (, )
  const sanitized = substituted.replace(/[^0-9+\-*/().\s]/g, '').trim();
  if (!sanitized || !/\d/.test(sanitized)) {
    return { valueRp: vars.net_income - vars.total_debt - vars.living_pool, substituted };
  }

  try {
    const fn = new Function(`return (${sanitized});`);
    const out = Number(fn());
    return {
      valueRp: Number.isFinite(out) ? Math.round(out) : 0,
      substituted: sanitized,
    };
  } catch {
    return { valueRp: 0, substituted: sanitized };
  }
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
  ) {}

  private async resolvePeriod(
    userId: number,
    month?: number,
    year?: number,
  ): Promise<{ month: number; year: number }> {
    if (month && year) return { month, year };
    const def = await this.snapshotsSelectors.getDefaultActivePeriod(userId);
    return { month: def.month, year: def.year };
  }

  async executeTool(
    tool: MarqueeToolName,
    args: Record<string, any>,
    ctx: MarqueeExecutionContext,
  ): Promise<MarqueeToolResult> {
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
              purchaseDate: todayIso,
            },
            ctx.userId,
          );
          return {
            ok: true,
            tool,
            summary: `Staged ${title} (${formatRp(amountRp)} via ${instrument}${tenorMonths > 1 ? ` ${tenorMonths}x` : ''}) into ${preview.startPeriodLabel}. Verdict is ${preview.verdict} at ${preview.dsrAfterPercent}% DSR. Confirm below to commit this entry.`,
            cards: [
              { label: 'Item', value: title },
              { label: 'Amount', value: formatRp(amountRp) },
              { label: 'Routed Cycle', value: `${preview.startPeriodLabel} (${instrument})` },
              {
                label: 'Verdict',
                value: `${preview.verdict} (DSR ${preview.dsrAfterPercent}%)`,
                tone: preview.verdict === 'SAFE' ? 'positive' : 'caution',
              },
            ],
            pendingAction: {
              type: 'CONFIRM_EXPENSE',
              payload: { title, amountRp, instrument, tenorMonths, month, year },
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
              date: todayIso,
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

        const createdSchedule = await this.creditService.createLineItemSchedule(
          {
            title,
            category: instrument === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PAYLATER',
            merchantOrPlatform: instrument === 'CREDIT_CARD' ? 'Credit Card' : 'SPayLater',
            totalAmount: amountRp,
            tenorMonths,
            purchaseDate: todayIso,
            autoRouteByCutoff: true,
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
          summary: `For a ${formatRp(bonusRp)} THR or bonus in ${periodTag}: clear ${formatRp(coverShortfall)} in living shortfall first, lock ${formatRp(p1Allocation)} into your P1 Core Vault, direct ${formatRp(debtPrepay)} toward high-cost SPinjam/PayLater debt, and keep ${formatRp(livingAndReward)} for holiday living and P2 self-reward.`,
          cards: [
            { label: 'Bonus / THR Pool', value: formatRp(bonusRp), tone: 'positive' },
            { label: '1. Shortfall Cover', value: formatRp(coverShortfall) },
            { label: '2. P1 Core Vault', value: formatRp(p1Allocation), tone: 'positive' },
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
          data: { expression: rawExpr, evaluated, vars },
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
          summary: `P1 Savings Vault holds ${formatRp(totalBal)} (${formatRp(rdpuBal)} in RDPU) across ${goalList.length} tracked goal(s).`,
          cards: [
            { label: 'Total P1 Vault', value: formatRp(totalBal), tone: 'positive' },
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
    }
  }
}
