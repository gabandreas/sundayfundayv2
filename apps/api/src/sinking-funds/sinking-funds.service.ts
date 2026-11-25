import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import {
  CreateSinkingFundDto,
  UpdateSinkingFundDto,
} from './dto/sinking-fund.dto';

@Injectable()
export class SinkingFundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditLogService,
  ) {}

  private async assertOwnership(id: number, userId: number) {
    const row = await this.prisma.sinkingFundItem.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Sinking fund #${id} not found.`);
    }
    if (row.userId !== userId) {
      throw new ForbiddenException('Access denied to sinking fund item.');
    }
    return row;
  }

  async create(dto: CreateSinkingFundDto, userId: number) {
    const created = await this.prisma.sinkingFundItem.create({
      data: {
        userId,
        name: dto.name.trim(),
        category: dto.category?.trim() || 'ANNUAL_TAX',
        targetAmountRp: Math.max(1, Math.round(dto.targetAmountRp)),
        savedAmountRp: Math.max(0, Math.round(dto.savedAmountRp ?? 0)),
        targetMonth: dto.targetMonth,
        targetYear: dto.targetYear,
        isActive: true,
        notes: dto.notes?.trim() || null,
      },
    });
    await this.auditService.record({
      userId,
      action: 'SINKING_FUND_CREATED',
      category: 'SAVINGS',
      summary: `Created sinking fund "${created.name}" targeting Rp ${Math.round(created.targetAmountRp).toLocaleString('id-ID')}`,
    });
    return created;
  }

  async update(id: number, dto: UpdateSinkingFundDto, userId: number) {
    await this.assertOwnership(id, userId);
    return this.prisma.sinkingFundItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category.trim() } : {}),
        ...(dto.targetAmountRp !== undefined
          ? { targetAmountRp: Math.max(1, Math.round(dto.targetAmountRp)) }
          : {}),
        ...(dto.savedAmountRp !== undefined
          ? { savedAmountRp: Math.max(0, Math.round(dto.savedAmountRp)) }
          : {}),
        ...(dto.targetMonth !== undefined ? { targetMonth: dto.targetMonth } : {}),
        ...(dto.targetYear !== undefined ? { targetYear: dto.targetYear } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
      },
    });
  }

  async contribute(id: number, amountRp: number, userId: number) {
    const existing = await this.assertOwnership(id, userId);
    const nextSaved = Math.min(
      Math.round(existing.targetAmountRp),
      Math.max(0, Math.round(existing.savedAmountRp) + Math.round(amountRp)),
    );
    const updated = await this.prisma.sinkingFundItem.update({
      where: { id },
      data: { savedAmountRp: nextSaved },
    });
    await this.auditService.record({
      userId,
      action: 'SINKING_FUND_CONTRIBUTION',
      category: 'SAVINGS',
      summary: `Added Rp ${Math.round(amountRp).toLocaleString('id-ID')} to "${existing.name}"`,
    });
    return updated;
  }

  async remove(id: number, userId: number) {
    await this.assertOwnership(id, userId);
    await this.prisma.sinkingFundItem.delete({ where: { id } });
    return { deleted: true, id };
  }
}
