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
    const { month, year } = await this.resolvePeriod(ctx.userId, ctx.month, ctx.year);
    const periodTag = `${String(month).padStart(2, '0')}/${year}`;
    const todayIso = new Date().toISOString().slice(0, 10);

    switch (tool) {
      case 'get_financial_pulse': {
        const [snapshot, pacing] = await Promise.all([
          this.snapshotsSelectors.getOrCreateDraftSnapshot(month, year, ctx.userId),
          this.financeSelectors.getPacing(month, year, undefined, undefined, ctx.userId),
        ]);
        const state = pacing.cycleTemporalState ?? 'ACTIVE';
        const remainingCash = Math.round(pacing.remainingBudget ?? snapshot.actualDailyOperational ?? 0);
        const safeToday = Math.round(pacing.safeToSpendToday ?? 0);
        const deficit = Math.round(snapshot.deficitUncovered ?? 0);
        const summary =
          state === 'PRE_PAYDAY'
            ? `Period ${periodTag} is PRE_PAYDAY (starts in ${pacing.daysUntilCycleStart ?? 0} days on ${pacing.cycleDateLabel}). Projected daily allowance: ${formatRp(pacing.baselineDailyRate)}/day; funded living pool: ${formatRp(remainingCash)}.`
            : state === 'COMPLETED'
              ? `Period ${periodTag} cycle window (${pacing.cycleDateLabel}) is COMPLETED. Remaining cash: ${formatRp(remainingCash)}.`
              : `Period ${periodTag} is ACTIVE. Safe-to-spend today: ${formatRp(safeToday)} (status: ${pacing.pacingStatus}). Remaining living cash: ${formatRp(remainingCash)}.`;

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

      case 'log_quick_expense': {
        const title = String(args.title || 'Quick Expense').trim();
        const amountRp = Math.max(0, Math.round(Number(args.amountRp ?? args.amount ?? 0)));
        const instrument = (args.instrument || 'CASH') as MarqueeInstrument;
        const tenorMonths = Math.max(1, Math.min(36, Math.round(Number(args.tenorMonths ?? 1))));

        if (amountRp <= 0) {
          return {
            ok: false,
            tool,
            summary: 'Specify a valid Rupiah amount to record an expense (e.g. "log coffee 45k").',
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
            summary: `Preview ready: ${title} (${formatRp(amountRp)} · ${instrument}${tenorMonths > 1 ? ` ${tenorMonths}x` : ''}) routes to ${preview.startPeriodLabel} (Verdict: ${preview.verdict}, DSR: ${preview.dsrAfterPercent}%). Confirm to write to ledger.`,
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
            summary: `Recorded CASH expense "${title}" (${formatRp(amountRp)}) into ${periodTag}.`,
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
          summary: `Recorded ${instrument} obligation "${title}" (${formatRp(amountRp)}, ${tenorMonths}x) with cutoff auto-routing.`,
          cards: [
            { label: 'Saved Liability', value: title, tone: 'positive' },
            { label: 'Total Amount', value: formatRp(amountRp) },
            { label: 'Schedule', value: `${tenorMonths}x (${instrument})` },
          ],
          data: { createdSchedule },
        };
      }

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
        const sim = await this.financeSelectors.simulateCutoffForUser(
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
          summary: `Affordability for "${title}" (${formatRp(amountRp)}, ${simInstrument}, ${tenorMonths}x): Verdict is ${sim.verdict} landing in ${sim.startPeriodLabel} (due ${sim.firstDueDateIso}). DSR: ${sim.dsrAfterPercent}%.`,
          cards: [
            { label: 'Target Purchase', value: `${title} (${formatRp(amountRp)})` },
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
          summary: `Total liabilities due under ${periodTag}: ${formatRp(total)} (PayLater ${formatRp(payLater)}, Credit Card ${formatRp(cc)}, Personal Debt ${formatRp(personal)}).`,
          cards: [
            { label: 'PayLater (25th)', value: formatRp(payLater) },
            { label: 'Credit Card (11th)', value: formatRp(cc) },
            { label: 'Personal Debt / SPinjam', value: formatRp(personal) },
            { label: 'Total Debt Cycle', value: formatRp(total), tone: 'caution' },
          ],
          data: { payLater, cc, personal, total },
        };
      }

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
          summary: `Wallet Check-In (${formatRp(actualWalletBalance)}): Free spendable cash is ${formatRp(g?.freeSpendableCash ?? 0)} after holding ${formatRp(g?.reservedBillsTotal ?? 0)} for unpaid bills (Status: ${g?.guardStatus ?? 'SAFE'}).`,
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
          summary: `Active installment burndown: ${activeCount} multi-month contracts (${formatRp(totalRem)} remaining principal, debt-free horizon: ${bd.debtFreedomLabel ?? 'Scheduled'}).`,
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
          summary: `P1 Savings Reservoir holds ${formatRp(totalBal)} (${formatRp(rdpuBal)} in RDPU) across ${goalList.length} tracked goal(s).`,
          cards: [
            { label: 'Total P1 Vault', value: formatRp(totalBal), tone: 'positive' },
            { label: 'Money Market (RDPU)', value: formatRp(rdpuBal) },
            { label: 'Active Goals', value: `${goalList.length}` },
          ],
          data: { overview, goals: goalList },
        };
      }

      case 'simulate_debt_payoff': {
        const lumpSumRp = Math.max(0, Math.round(Number(args.lumpSumRp ?? args.amountRp ?? 1_000_000)));
        const intel: any = await this.financeSelectors.getIntelligenceBundle(
          month,
          year,
          lumpSumRp,
          ctx.userId,
        );
        const strategies: any[] = intel?.debtopt?.strategies ?? [];
        const avalanche = strategies.find((s) => s.strategy === 'AVALANCHE') ?? strategies[0];
        const snowball = strategies.find((s) => s.strategy === 'SNOWBALL') ?? strategies[1];
        return {
          ok: true,
          tool,
          summary: avalanche
            ? `Applying ${formatRp(lumpSumRp)} under Avalanche frees ${formatRp(avalanche.immediateFreedMonthlyRp)}/mo and saves ~${formatRp(avalanche.estimatedInterestSavedRp)} interest (${avalanche.monthsShaved}m shaved).`
            : `Computed debt payoff simulation for ${formatRp(lumpSumRp)}.`,
          cards: [
            { label: 'Extra Prepayment', value: formatRp(lumpSumRp) },
            ...(avalanche
              ? [
                  {
                    label: 'Avalanche Relief',
                    value: `+${formatRp(avalanche.immediateFreedMonthlyRp)}/mo`,
                    tone: 'positive' as const,
                  },
                  {
                    label: 'Avalanche Interest Saved',
                    value: formatRp(avalanche.estimatedInterestSavedRp),
                    tone: 'positive' as const,
                  },
                ]
              : []),
            ...(snowball
              ? [
                  {
                    label: 'Snowball Relief',
                    value: `+${formatRp(snowball.immediateFreedMonthlyRp)}/mo`,
                  },
                ]
              : []),
          ],
          data: { strategies },
        };
      }
    }
  }
}
