import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SnapshotStatus } from '@prisma/client';
import { CreditService } from '../credit/credit.service';
import { calculateWorkingDaysForPeriod } from '../calculator/payroll';
import {
  buildDefaultSandboxState,
  SandboxState,
} from '../config/sandbox.defaults';
import {
  buildDefaultPayrollRules,
  buildDefaultAllocationBuckets,
  buildDefaultSurplusSplitRules,
  buildDefaultFinancialPolicy,
} from '../calculator/modular-engine';

@Injectable()
export class SnapshotsSelectors {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => CreditService))
    private readonly creditService?: CreditService,
  ) {}

  buildSandboxSnapshot(sandbox: any, month: number, year: number): any {
    const routineCategories = sandbox.routineCategories || [
      { id: 'housing', label: 'Housing & Rent', target: 2000000, isCustom: true },
      { id: 'transport', label: 'Transport & Fuel', target: 600000 },
      { id: 'internet', label: 'Internet & Utilities', target: 450000 },
      { id: 'vape', label: 'Subscriptions & Lifestyle', target: 300000 },
    ];
    const routineTotal = routineCategories.reduce(
      (sum: number, c: any) => sum + (c.target || 0),
      0,
    );
    const creditTotal = (sandbox.creditItems || []).reduce(
      (sum: number, c: any) => sum + (c.monthlyAmount || c.amount || 0),
      0,
    );

    const netSalary = sandbox.persona?.netSalary ?? 10_000_000;
    const dailyLiving = sandbox.persona?.dailyLivingBudget ?? 3_000_000;
    const savingsP1 = sandbox.persona?.coreSavingsTarget ?? 1_500_000;
    const selfRewardP2 = Math.max(
      0,
      netSalary - (routineTotal + creditTotal + dailyLiving + savingsP1),
    );

    const totalDeductions = routineTotal + creditTotal;

    const transportCat = routineCategories.find((c: any) => c.id === 'transport');
    const internetCat = routineCategories.find((c: any) => c.id === 'internet');
    const vapeCat = routineCategories.find(
      (c: any) => c.id === 'vape' || c.id === 'subscriptions',
    );
    const haircutCat = routineCategories.find((c: any) => c.id === 'haircut');

    return {
      id: 999999,
      userId: 2,
      isSandbox: true,
      month,
      year,
      status: 'DRAFT',
      salaryAdjustment: 0,
      totalWorkingDays: 21,
      cafeteriaDeduction: 0,
      bonusAmount: 0,
      thrAmount: 0,
      payrollPayoutDate: new Date(
        Date.UTC(year, month - 1, sandbox.persona?.paydayAnchor ?? 25),
      ),
      isPayoutDateConfirmed: false,
      dailyOperational: dailyLiving,
      actualDailyOperational: dailyLiving,
      transport: transportCat?.target ?? 600000,
      internet: internetCat?.target ?? 450000,
      vape: vapeCat?.target ?? 300000,
      haircut: haircutCat?.target ?? 0,
      savings: savingsP1,
      actualSavings: savingsP1,
      selfReward: selfRewardP2,
      selfRewardTarget: selfRewardP2,
      deficitUncovered: 0,
      finalTotalIncome: netSalary,
      netSalaryIncome: netSalary,
      totalIncome: netSalary,
      totalDeductions,
      paylaterBills: 0,
      personalDebtBills: 0,
      contractInstallments: 0,
      creditCardBills: creditTotal,
      extraIncome: 0,
      ccUsageLimit: 0,
      paylaterUsageLimit: 0,
      bufferPocket: 0,
      frozenRulesJson: null,
      bucketRealizationsJson: null,
      pacingRealizationJson: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      transactions: (sandbox.transactions || []).map((t: any) => ({
        ...t,
        snapshotId: 999999,
        createdAt: new Date().toISOString(),
      })),
      budgetRevisions: [],
    };
  }

  /**
   * Retrieves an existing snapshot for (month, year) or initializes a new DRAFT snapshot
   * by copying baseline targets from GlobalConfig and idempotently provisioning liabilities.
   *
   * ARCHITECTURE.md §3 & §4:
   * This read path MUST NEVER mutate CreditContract.remainingTenor or cross-period state.
   * Initial provisioning triggers syncLiabilitiesToSnapshot and recalculateSnapshot which
   * are idempotent and scoped strictly to the newly created snapshot.
   */
  async getOrCreateDraftSnapshot(month: number, year: number, userId: number = 1) {
    const config =
      (await this.prisma.globalConfig.findUnique({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } }));

    if (userId === 2) {
      const sandbox =
        (config?.sandboxStateJson as any) || buildDefaultSandboxState(month, year);
      return this.buildSandboxSnapshot(sandbox, month, year);
    }

    const existing = await this.prisma.monthlySnapshot.findUnique({
      where: {
        userId_month_year: {
          userId,
          month,
          year,
        },
      },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
        },
        budgetRevisions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (existing) {
      return existing;
    }

    if (!config) {
      throw new BadRequestException(
        'Global configuration has not been initialized',
      );
    }

    const frozenRulesJson = {
      payrollRules:
        config.payrollRulesJson ??
        buildDefaultPayrollRules(config.dailyAllowance, config.laptopAllowance),
      allocationBuckets:
        config.allocationBucketsJson ??
        buildDefaultAllocationBuckets({
          transport: config.transport,
          internet: config.internet,
          vape: config.vape,
          haircut: config.haircut,
          dailyOperational: config.dailyOperational,
          savings: config.baseSavings,
          bufferPocket: 0,
        }),
      surplusSplitRules:
        config.surplusSplitRulesJson ?? buildDefaultSurplusSplitRules(),
      financialPolicy:
        config.financialPolicyJson ?? buildDefaultFinancialPolicy(),
    };

    const snapshot = await this.prisma.monthlySnapshot
      .create({
        data: {
          userId,
          month,
          year,
          status: SnapshotStatus.DRAFT,
          dailyOperational: config.dailyOperational,
          transport: config.transport,
          internet: config.internet,
          vape: config.vape,
          haircut: config.haircut,
          savings: config.baseSavings,
          ccUsageLimit: config.ccUsageLimit ?? 0,
          paylaterUsageLimit: config.paylaterUsageLimit ?? 0,
          totalWorkingDays: calculateWorkingDaysForPeriod(month, year),
          salaryAdjustment: 0,
          cafeteriaDeduction: 0,
          thrAmount: 0,
          bonusAmount: 0,
          selfRewardTarget: 0,
          bufferPocket: 0,
          payrollPayoutDate: new Date(Date.UTC(year, month - 1, config.payrollPayoutDay ?? 25)),
          isPayoutDateConfirmed: false,
          frozenRulesJson: frozenRulesJson as any,
        },
        include: {
          transactions: true,
          budgetRevisions: true,
        },
      })
      .catch(async (err: any) => {
        if (err?.code === 'P2002') {
          return this.prisma.monthlySnapshot.findUniqueOrThrow({
            where: { userId_month_year: { userId, month, year } },
            include: {
              transactions: true,
              budgetRevisions: true,
            },
          });
        }
        throw err;
      });

    // Idempotent first-view provisioning exception (ARCHITECTURE.md §4):
    // Sync due liabilities and recalculate initial snapshot figures
    if (this.creditService) {
      await this.creditService.syncLiabilitiesToSnapshot(month, year, undefined, userId);
      return this.prisma.monthlySnapshot.findUniqueOrThrow({
        where: { id: snapshot.id },
        include: {
          transactions: {
            orderBy: { date: 'desc' },
          },
          budgetRevisions: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    return snapshot;
  }

  async getSnapshotById(id: number) {
    if (id === 999999) {
      const config = await this.prisma.globalConfig.findFirst({
        where: { userId: 1 },
      });
      const sandbox =
        (config?.sandboxStateJson as any) || buildDefaultSandboxState();
      return this.buildSandboxSnapshot(
        sandbox,
        sandbox.month || 10,
        sandbox.year || 2026,
      );
    }

    const snapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
        },
        budgetRevisions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!snapshot) {
      throw new NotFoundException(`Snapshot #${id} not found`);
    }

    return snapshot;
  }

  /**
   * Retrieves budget revisions for a snapshot ordered chronologically.
   */
  async listBudgetRevisions(snapshotId: number) {
    return this.prisma.budgetRevision.findMany({
      where: { snapshotId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
