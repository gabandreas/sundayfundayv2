import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getJakartaTodayIso } from './events.service';

@Injectable()
export class EventsSelectors {
  constructor(private readonly prisma: PrismaService) {}

  async listForPeriod(userId: number, month?: number, year?: number) {
    const todayIso = getJakartaTodayIso();
    const todayUtcStart = new Date(`${todayIso}T00:00:00.000Z`);
    const where: any =
      month && year
        ? {
            OR: [
              { userId, month, year },
              {
                userId,
                status: { in: ['PLANNING', 'ACTIVE'] },
                endDate: { gte: todayUtcStart },
              },
            ],
          }
        : { userId };

    const events = await this.prisma.tripEventPlan.findMany({
      where,
      include: {
        expenses: { orderBy: [{ date: 'asc' }, { id: 'asc' }] },
        commitments: { orderBy: [{ dueDate: 'asc' }, { id: 'asc' }] },
      },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
    });

    return events.map((ev) => {
      const totalGrossSpentRp = ev.expenses.reduce(
        (s, e) => s + Math.round(Number(e.amountRp) || 0),
        0,
      );
      const totalReimbursedRp = ev.expenses.reduce(
        (s, e) =>
          s + (e.isSharedAdvance ? Math.round(Number(e.reimbursedAmountRp) || 0) : 0),
        0,
      );
      const pendingAdvanceRp = ev.expenses.reduce(
        (s, e) =>
          e.isSharedAdvance
            ? s + Math.max(0, Math.round(e.amountRp - e.reimbursedAmountRp))
            : s,
        0,
      );
      const netPersonalSpentRp = Math.max(0, totalGrossSpentRp - totalReimbursedRp);
      const prepaidLinkedRp =
        ev.commitments.length > 0
          ? ev.commitments.reduce((s, c) => s + Math.round(Number(c.amount) || 0), 0)
          : Math.round(Number(ev.prepaidAmountRp) || 0);
      const remainingCapRp = Math.round(Number(ev.plannedCapRp) || 0) - netPersonalSpentRp;
      return {
        ...ev,
        metrics: {
          totalGrossSpentRp,
          totalReimbursedRp,
          pendingAdvanceRp,
          netPersonalSpentRp,
          prepaidLinkedRp,
          remainingCapRp,
        },
      };
    });
  }
}
