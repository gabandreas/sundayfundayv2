import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduledBillDto } from './dto/create-scheduled-bill.dto';

@Injectable()
export class BillsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new ScheduledBill entry.
   * isActive defaults to true; isProcessed is not set here — processing is an
   * explicit, separate action. Do not auto-process on creation.
   */
  async createBill(dto: CreateScheduledBillDto) {
    return this.prisma.scheduledBill.create({
      data: {
        label: dto.label,
        amount: dto.amount,
        dueDayOfMonth: dto.dueDayOfMonth,
        isActive: true,
      },
    });
  }

  async deleteBill(id: number) {
    const existing = await this.prisma.scheduledBill.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`ScheduledBill #${id} not found`);
    }

    return this.prisma.scheduledBill.delete({ where: { id } });
  }
}
