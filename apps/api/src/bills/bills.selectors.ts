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
  async listBills() {
    return this.prisma.scheduledBill.findMany({
      orderBy: { dueDayOfMonth: 'asc' },
    });
  }

  async getBillById(id: number) {
    return this.prisma.scheduledBill.findUnique({ where: { id } });
  }
}
