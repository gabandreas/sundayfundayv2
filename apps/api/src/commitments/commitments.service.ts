import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { AuditLogService } from '../audit/audit-log.service';
import {
  CreateCommitmentDto,
  UpdateCommitmentDto,
} from './dto/commitment.dto';

@Injectable()
export class CommitmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotsService: SnapshotsService,
    private readonly auditService: AuditLogService,
  ) {}

  private async ensureOpenSnapshot(month: number, year: number, userId: number) {
    const snap = await this.prisma.monthlySnapshot.findFirst({
      where: { userId, month, year },
    });
    if (snap && snap.status === 'LOCKED') {
      throw new BadRequestException(
        `Period ${month}/${year} is locked. Reopen the period before modifying commitments.`,
      );
    }
    return snap;
  }

  private async assertOwnership(id: number, userId: number) {
    const row = await this.prisma.periodCommitment.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Commitment #${id} not found.`);
    }
    if (row.userId !== userId) {
      throw new ForbiddenException('Access denied to commitment record.');
    }
    return row;
  }

  async create(dto: CreateCommitmentDto, userId: number) {
    const snap = await this.ensureOpenSnapshot(dto.month, dto.year, userId);
    const parsedDate = new Date(dto.dueDate);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Invalid commitment dueDate.');
    }

    const row = await this.prisma.periodCommitment.create({
      data: {
        userId,
        month: dto.month,
        year: dto.year,
        title: dto.title.trim(),
        category: dto.category ?? 'FORCE_MAJEURE',
        amount: Math.round(dto.amount),
        dueDate: parsedDate,
        fundingSource: dto.fundingSource ?? 'PAYCHECK_UPFRONT',
        status: 'UNPAID',
        tripEventId: dto.tripEventId ?? null,
        notes: dto.notes?.trim() || null,
      },
    });

    if (snap?.id) {
      await this.snapshotsService.recalculateSnapshot(snap.id);
    }

    await this.auditService.record({
      userId,
      action: 'COMMITMENT_CREATED',
      category: 'LIABILITIES',
      summary: `Created non-debt commitment "${row.title}" (Rp ${Math.round(row.amount).toLocaleString('id-ID')})`,
      month: row.month,
      year: row.year,
    });

    return row;
  }

  async update(id: number, dto: UpdateCommitmentDto, userId: number) {
    const existing = await this.assertOwnership(id, userId);
    const snap = await this.ensureOpenSnapshot(existing.month, existing.year, userId);

    const nextDate = dto.dueDate ? new Date(dto.dueDate) : undefined;
    if (nextDate && Number.isNaN(nextDate.getTime())) {
      throw new BadRequestException('Invalid commitment dueDate.');
    }

    const updated = await this.prisma.periodCommitment.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.amount !== undefined ? { amount: Math.round(dto.amount) } : {}),
        ...(nextDate ? { dueDate: nextDate } : {}),
        ...(dto.fundingSource !== undefined ? { fundingSource: dto.fundingSource } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
      },
    });

    if (snap?.id) {
      await this.snapshotsService.recalculateSnapshot(snap.id);
    }

    return updated;
  }

  async setStatus(id: number, status: string, userId: number) {
    const existing = await this.assertOwnership(id, userId);
    await this.ensureOpenSnapshot(existing.month, existing.year, userId);

    const updated = await this.prisma.periodCommitment.update({
      where: { id },
      data: { status },
    });

    await this.auditService.record({
      userId,
      action: 'COMMITMENT_STATUS_UPDATED',
      category: 'LIABILITIES',
      summary: `Marked commitment "${updated.title}" as ${status}`,
      month: updated.month,
      year: updated.year,
    });

    return updated;
  }

  async remove(id: number, userId: number) {
    const existing = await this.assertOwnership(id, userId);
    const snap = await this.ensureOpenSnapshot(existing.month, existing.year, userId);

    await this.prisma.periodCommitment.delete({ where: { id } });

    if (snap?.id) {
      await this.snapshotsService.recalculateSnapshot(snap.id);
    }

    return { deleted: true, id };
  }
}
