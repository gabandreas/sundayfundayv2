import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommitmentsSelectors {
  constructor(private readonly prisma: PrismaService) {}

  async listForPeriod(userId: number, month?: number, year?: number) {
    const where: any = { userId };
    if (month && year) {
      where.month = month;
      where.year = year;
    }
    const items = await this.prisma.periodCommitment.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    });

    const summary = items.reduce(
      (acc, item) => {
        const amt = Math.round(Number(item.amount) || 0);
        acc.totalRp += amt;
        if (item.fundingSource === 'PAYCHECK_UPFRONT') acc.paycheckUpfrontRp += amt;
        else if (item.fundingSource === 'EMERGENCY_BUFFER') acc.bufferRp += amt;
        else acc.discretionaryRp += amt;

        if (item.status === 'PAID') acc.paidRp += amt;
        else if (item.status === 'RESERVED') acc.reservedRp += amt;
        else acc.unpaidRp += amt;
        return acc;
      },
      {
        totalRp: 0,
        paycheckUpfrontRp: 0,
        discretionaryRp: 0,
        bufferRp: 0,
        paidRp: 0,
        reservedRp: 0,
        unpaidRp: 0,
      },
    );

    return { items, summary };
  }
}
