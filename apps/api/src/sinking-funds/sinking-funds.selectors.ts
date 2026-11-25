import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export function computeMonthlySetAside(
  targetAmountRp: number,
  savedAmountRp: number,
  targetMonth: number,
  targetYear: number,
  refDate: Date = new Date(),
): { remainingRp: number; monthsRemaining: number; monthlySetAsideRp: number; progressPct: number } {
  const remainingRp = Math.max(0, Math.round(targetAmountRp - savedAmountRp));
  const curMonth = refDate.getUTCMonth() + 1;
  const curYear = refDate.getUTCFullYear();
  const monthsRemaining = Math.max(
    1,
    (targetYear - curYear) * 12 + (targetMonth - curMonth) + 1,
  );
  const monthlySetAsideRp =
    remainingRp > 0 ? Math.ceil(remainingRp / monthsRemaining) : 0;
  const progressPct =
    targetAmountRp > 0
      ? Math.min(100, Math.round((savedAmountRp / targetAmountRp) * 100))
      : 100;
  return { remainingRp, monthsRemaining, monthlySetAsideRp, progressPct };
}

@Injectable()
export class SinkingFundsSelectors {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: number) {
    const rows = await this.prisma.sinkingFundItem.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { targetYear: 'asc' }, { targetMonth: 'asc' }, { id: 'asc' }],
    });
    const items = rows.map((row) => ({
      ...row,
      ...computeMonthlySetAside(
        row.targetAmountRp,
        row.savedAmountRp,
        row.targetMonth,
        row.targetYear,
      ),
    }));
    const totalMonthlySetAsideRp = items
      .filter((i) => i.isActive)
      .reduce((s, i) => s + i.monthlySetAsideRp, 0);
    const totalTargetRp = items
      .filter((i) => i.isActive)
      .reduce((s, i) => s + Math.round(i.targetAmountRp), 0);
    const totalSavedRp = items
      .filter((i) => i.isActive)
      .reduce((s, i) => s + Math.round(i.savedAmountRp), 0);
    return { items, totalMonthlySetAsideRp, totalTargetRp, totalSavedRp };
  }
}
