import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillsSelectors {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists all active ScheduledBills.
   * No month/year filter — scheduled bills are global standing entries;
   * the credit/finance modules handle per-month materialization into transactions.
   * isProcessed is never mutated here.
   */
  async listBills(userId: number = 1) {
    return this.prisma.scheduledBill.findMany({
      where: { userId },
      orderBy: { dueDayOfMonth: 'asc' },
    });
  }

  async getBillById(id: number, userId: number = 1) {
    return this.prisma.scheduledBill.findFirst({ where: { id, userId } });
  }
}
