import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WishlistSelectors } from './wishlist.selectors';
import { AuditLogService } from '../audit/audit-log.service';
import { ConfigSelectors } from '../config/config.selectors';
import {
  WishlistItem,
  WishlistStatus,
  WishlistFundingType,
  CreditContract,
  CreditCardChargeType,
  CreditCardStatus,
  AuditCategory,
  AuditSeverity,
} from '@prisma/client';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';
import { UpdateWishlistItemDto } from './dto/update-wishlist-item.dto';
import { AnalyzeWishlistDraftDto } from './dto/analyze-wishlist-draft.dto';
import {
  calculateWishlistAnalysis,
  WishlistAnalysisResult,
  ExistingLiabilityPeriod,
} from '../calculator/wishlist';
import { calculatePayroll } from '../calculator/payroll';

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly selectors: WishlistSelectors,
    private readonly auditLogService: AuditLogService,
    private readonly configSelectors: ConfigSelectors,
  ) {}

  async createItem(dto: CreateWishlistItemDto): Promise<WishlistItem> {
    return this.prisma.wishlistItem.create({
      data: {
        name: dto.name,
        price: dto.price,
        fundingType: dto.fundingType ?? WishlistFundingType.CASH,
        provider: dto.provider ?? null,
        tenor: dto.tenor ?? null,
        monthlyPayment: dto.monthlyPayment ?? null,
        interestPercent: dto.interestPercent ?? 0,
        targetMonth: dto.targetMonth ?? null,
        targetYear: dto.targetYear ?? null,
        status: dto.status ?? WishlistStatus.PLANNING,
        notes: dto.notes ?? null,
        priority: dto.priority ?? 0,
      },
    });
  }

  async updateItem(
    id: number,
    dto: UpdateWishlistItemDto,
  ): Promise<WishlistItem> {
    const existing = await this.selectors.getItemById(id);
    if (!existing) {
      throw new NotFoundException(`WishlistItem #${id} not found`);
    }

    return this.prisma.wishlistItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.fundingType !== undefined ? { fundingType: dto.fundingType } : {}),
        ...(dto.provider !== undefined ? { provider: dto.provider } : {}),
        ...(dto.tenor !== undefined ? { tenor: dto.tenor } : {}),
        ...(dto.monthlyPayment !== undefined ? { monthlyPayment: dto.monthlyPayment } : {}),
        ...(dto.interestPercent !== undefined ? { interestPercent: dto.interestPercent } : {}),
        ...(dto.targetMonth !== undefined ? { targetMonth: dto.targetMonth } : {}),
        ...(dto.targetYear !== undefined ? { targetYear: dto.targetYear } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      },
    });
  }

  async deleteItem(id: number): Promise<WishlistItem> {
    const existing = await this.selectors.getItemById(id);
    if (!existing) {
      throw new NotFoundException(`WishlistItem #${id} not found`);
    }
    return this.prisma.wishlistItem.delete({ where: { id } });
  }

  async analyzePurchase(
    itemIdOrDraft: number | AnalyzeWishlistDraftDto,
    month?: number,
    year?: number,
  ): Promise<WishlistAnalysisResult> {
    let price: number;
    let fundingType: WishlistFundingType;
    let tenor: number | null | undefined;
    let monthlyPayment: number | null | undefined;
    let targetMonth: number | null | undefined;
    let targetYear: number | null | undefined;

    if (typeof itemIdOrDraft === 'number') {
      const item = await this.selectors.getItemById(itemIdOrDraft);
      if (!item) {
        throw new NotFoundException(`WishlistItem #${itemIdOrDraft} not found`);
      }
      price = item.price;
      fundingType = item.fundingType;
      tenor = item.tenor;
      monthlyPayment = item.monthlyPayment;
      targetMonth = item.targetMonth;
      targetYear = item.targetYear;
    } else {
      price = itemIdOrDraft.price;
      fundingType = itemIdOrDraft.fundingType ?? WishlistFundingType.CASH;
      tenor = itemIdOrDraft.tenor;
      monthlyPayment = itemIdOrDraft.monthlyPayment;
    }

    const now = new Date();
    const startMonth = month ?? targetMonth ?? now.getMonth() + 1;
    const startYear = year ?? targetYear ?? now.getFullYear();

    // 1. Financial Context
    let snapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId: 1, month: startMonth, year: startYear } },
    });

    if (!snapshot) {
      snapshot = await this.prisma.monthlySnapshot.findFirst({
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });
    }

    const config = await this.configSelectors.getConfig();
    const currentSelfReward = snapshot?.selfReward ?? 0;
    const selfRewardTarget = snapshot?.selfRewardTarget ?? 0;

    let baseIncome =
      snapshot?.finalTotalIncome && snapshot.finalTotalIncome > 0
        ? snapshot.finalTotalIncome
        : snapshot?.netSalaryIncome && snapshot.netSalaryIncome > 0
        ? snapshot.netSalaryIncome
        : 0;

    if (baseIncome <= 0 && config) {
      const payroll = calculatePayroll({
        baseSalary: config.baseSalary,
        totalWorkingDays: 20,
        dailyAllowance: config.dailyAllowance,
        laptopAllowance: config.laptopAllowance,
      });
      baseIncome = payroll.netSalaryIncome;
    }

    // 2. Existing Liabilities 6-month projection with per-month income
    const existingLiabilities = await this.getProjectedLiabilities(
      startMonth,
      startYear,
      baseIncome,
    );

    // 3. Pure Calculation
    return calculateWishlistAnalysis({
      price,
      fundingType,
      tenor,
      monthlyPayment,
      currentSelfReward,
      selfRewardTarget,
      baseThp: baseIncome,
      existingLiabilities,
    });
  }

  async convertToContract(
    itemId: number,
  ): Promise<{ contract: CreditContract; item: WishlistItem }> {
    const item = await this.selectors.getItemById(itemId);
    if (!item) {
      throw new NotFoundException(`WishlistItem #${itemId} not found`);
    }

    if (item.fundingType === WishlistFundingType.CASH) {
      throw new BadRequestException(
        'Cannot convert a cash wishlist item into a credit contract',
      );
    }

    if (item.status === WishlistStatus.PURCHASED) {
      throw new BadRequestException(
        `WishlistItem #${itemId} has already been purchased`,
      );
    }

    const effectiveTenor = item.tenor && item.tenor > 0 ? item.tenor : 1;
    const effectiveMonthlyPayment =
      item.monthlyPayment !== null && item.monthlyPayment !== undefined
        ? item.monthlyPayment
        : item.price / effectiveTenor;

    const now = new Date();
    const startMonth = item.targetMonth ?? now.getMonth() + 1;
    const startYear = item.targetYear ?? now.getFullYear();

    const result = await this.prisma.$transaction(async (tx) => {
      const contract = await tx.creditContract.create({
        data: {
          label: item.name,
          principalAmount: item.price,
          monthlyInstallment: effectiveMonthlyPayment,
          totalTenor: effectiveTenor,
          remainingTenor: effectiveTenor,
          startMonth,
          startYear,
          isActive: true,
        },
      });

      const updatedItem = await tx.wishlistItem.update({
        where: { id: itemId },
        data: { status: WishlistStatus.PURCHASED },
      });

      return { contract, item: updatedItem };
    });

    await this.auditLogService.record({
      action: 'WISHLIST_CONVERTED',
      category: AuditCategory.LIABILITIES,
      summary: `Converted wishlist item "${item.name}" (#${itemId}) to credit contract #${result.contract.id}`,
      details: JSON.stringify({
        wishlistItemId: itemId,
        creditContractId: result.contract.id,
        monthlyInstallment: result.contract.monthlyInstallment,
        tenor: result.contract.totalTenor,
      }),
      month: result.contract.startMonth,
      year: result.contract.startYear,
      severity: AuditSeverity.INFO,
    });

    return result;
  }

  async getProjectedLiabilities(
    startMonth: number,
    startYear: number,
    defaultBaseIncome?: number,
  ): Promise<ExistingLiabilityPeriod[]> {
    const contracts = await this.prisma.creditContract.findMany({
      where: {
        isActive: true,
        remainingTenor: { gt: 0 },
      },
    });

    const cardTxs = await this.prisma.creditCardTransaction.findMany({
      where: { status: CreditCardStatus.ACTIVE },
    });

    const periods: ExistingLiabilityPeriod[] = [];

    for (let i = 0; i < 6; i++) {
      const month = ((startMonth - 1 + i) % 12) + 1;
      const year = startYear + Math.floor((startMonth - 1 + i) / 12);

      // 1. Credit Contracts
      let monthContractSum = 0;
      for (const c of contracts) {
        const isStarted =
          c.startYear < year || (c.startYear === year && c.startMonth <= month);
        if (isStarted && i < c.remainingTenor) {
          monthContractSum += c.monthlyInstallment;
        }
      }

      // 2. Monthly Bulk Bills
      const bulkBills = await this.prisma.monthlyBulkBill.findMany({
        where: { month, year },
      });
      const bulkBillSum = bulkBills.reduce((acc, b) => acc + b.amount, 0);

      // 3. Credit Card Transactions
      let cardSum = 0;
      for (const card of cardTxs) {
        if (card.chargeType === CreditCardChargeType.FULL) {
          if (card.billingMonth === month && card.billingYear === year) {
            cardSum += card.amount;
          }
        } else if (card.chargeType === CreditCardChargeType.INSTALLMENT) {
          const monthsElapsed =
            (year - card.billingYear) * 12 + (month - card.billingMonth);
          if (monthsElapsed >= 0 && monthsElapsed < (card.tenor || 1)) {
            const installmentAmount =
              card.monthlyAmount ?? card.amount / (card.tenor || 1);
            cardSum += installmentAmount;
          }
        } else if (card.chargeType === CreditCardChargeType.RECURRING) {
          const isStarted =
            year > card.billingYear ||
            (year === card.billingYear && month >= card.billingMonth);
          if (isStarted) {
            cardSum += card.amount;
          }
        }
      }

      // 4. Per-month income lookup (falls back to defaultBaseIncome for future months without snapshot)
      const monthSnapshot = await this.prisma.monthlySnapshot.findUnique({
        where: { userId_month_year: { userId: 1, month, year } },
      });
      const monthIncome =
        monthSnapshot?.finalTotalIncome && monthSnapshot.finalTotalIncome > 0
          ? monthSnapshot.finalTotalIncome
          : monthSnapshot?.netSalaryIncome && monthSnapshot.netSalaryIncome > 0
          ? monthSnapshot.netSalaryIncome
          : defaultBaseIncome && defaultBaseIncome > 0
          ? defaultBaseIncome
          : 0;

      periods.push({
        month,
        year,
        amount: monthContractSum + bulkBillSum + cardSum,
        baseIncome: monthIncome,
      });
    }

    return periods;
  }

  async trackAsSavingsGoal(id: number) {
    const item = await this.prisma.wishlistItem.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException(`Wishlist item #${id} not found`);
    }

    // Check if already linked
    let goal = await this.prisma.savingsGoal.findFirst({
      where: { wishlistItemId: id },
    });

    if (!goal) {
      goal = await this.prisma.savingsGoal.create({
        data: {
          userId: item.userId ?? 1,
          name: item.name,
          targetAmount: item.price,
          currentAllocatedAmount: 0,
          targetMonth: item.targetMonth ?? 12,
          targetYear: item.targetYear ?? 2026,
          category: 'WISHLIST',
          wishlistItemId: item.id,
        },
      });

      await this.prisma.wishlistItem.update({
        where: { id: item.id },
        data: { savingsGoalId: goal.id },
      });

      await this.auditLogService.record({
        action: 'WISHLIST_TRACKED_AS_SAVINGS_GOAL',
        category: AuditCategory.SAVINGS,
        summary: `Linked wishlist item "${item.name}" as savings goal for Rp ${item.price}`,
        details: JSON.stringify({ wishlistItemId: item.id, savingsGoalId: goal.id }),
        severity: AuditSeverity.INFO,
      });
    } else if (!item.savingsGoalId) {
      await this.prisma.wishlistItem.update({
        where: { id: item.id },
        data: { savingsGoalId: goal.id },
      });
    }

    return goal;
  }
}
