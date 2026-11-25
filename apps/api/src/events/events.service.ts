import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SavingsInstrumentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GoBridgeService } from '../calculator/go-bridge.service';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { AuditLogService } from '../audit/audit-log.service';
import { FinanceSelectors } from '../finance/finance.selectors';
import {
  CreateTripEventDto,
  CreateTripExpenseDto,
  OptimizeTripEventDto,
  UpdateTripEventDto,
  UpdateTripExpenseDto,
} from './dto/event.dto';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly goBridge: GoBridgeService,
    private readonly snapshotsService: SnapshotsService,
    private readonly auditService: AuditLogService,
    private readonly financeSelectors?: FinanceSelectors,
  ) {}

  private async assertEventOwnership(id: number, userId: number) {
    const row = await this.prisma.tripEventPlan.findUnique({
      where: { id },
      include: { expenses: true },
    });
    if (!row) {
      throw new NotFoundException(`Event plan #${id} not found.`);
    }
    if (row.userId !== userId) {
      throw new ForbiddenException('Access denied to trip event plan.');
    }
    return row;
  }

  async optimizeForPeriod(dto: OptimizeTripEventDto, userId: number) {
    const [snap, radar] = await Promise.all([
      this.prisma.monthlySnapshot.findFirst({
        where: { userId, month: dto.month, year: dto.year },
      }),
      this.financeSelectors
        ? this.financeSelectors.getCashRadarProjection(dto.month, dto.year, userId)
        : Promise.resolve(null),
    ]);

    const cycleDiscretionaryRp = Math.max(0, Math.round(snap?.selfReward ?? 0));
    const cycleEmergencyBufferRp = Math.max(0, Math.round(snap?.bufferPocket ?? 0));
    const cycleCoreSavingsRp = Math.max(0, Math.round(snap?.actualSavings ?? 0));
    const cashRadarLowestPointRp = radar
      ? Math.round(radar.lowestCashPoint.balanceRp)
      : cycleDiscretionaryRp + cycleEmergencyBufferRp;

    return this.goBridge.optimizeTripBudget({
      eventType: dto.eventType,
      durationDays: dto.durationDays,
      startDateIso: dto.startDateIso,
      prepaidCommittedRp: Math.max(0, Math.round(dto.prepaidCommittedRp ?? 0)),
      cycleDiscretionaryRp,
      cycleEmergencyBufferRp,
      cycleCoreSavingsRp,
      cashRadarLowestPointRp,
      remainingDaysInCycle: 15,
    });
  }

  async create(dto: CreateTripEventDto, userId: number) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid startDate or endDate.');
    }

    const snap = await this.prisma.monthlySnapshot.findFirst({
      where: { userId, month: dto.month, year: dto.year },
    });
    if (snap && snap.status === 'LOCKED') {
      throw new BadRequestException(`Period ${dto.month}/${dto.year} is locked.`);
    }

    const prepaidAmountRp = Math.max(0, Math.round(dto.prepaidAmountRp ?? 0));
    const created = await this.prisma.tripEventPlan.create({
      data: {
        userId,
        month: dto.month,
        year: dto.year,
        title: dto.title.trim(),
        eventType: dto.eventType ?? 'DAY_OUTING',
        startDate,
        endDate,
        plannedCapRp: Math.max(0, Math.round(dto.plannedCapRp)),
        recommendedTier: dto.recommendedTier ?? 'BALANCED',
        fundingSource: dto.fundingSource ?? 'DISCRETIONARY',
        prepaidAmountRp,
        status: 'ACTIVE',
        notes: dto.notes?.trim() || null,
      },
    });

    if (dto.createPrepaidCommitment && prepaidAmountRp > 0) {
      await this.prisma.periodCommitment.create({
        data: {
          userId,
          month: dto.month,
          year: dto.year,
          title: `${dto.title.trim()} Prepaid`,
          category: 'EVENT_OUTING',
          amount: prepaidAmountRp,
          dueDate: startDate,
          fundingSource: 'PAYCHECK_UPFRONT',
          status: 'UNPAID',
          tripEventId: created.id,
        },
      });
      if (snap?.id) {
        await this.snapshotsService.recalculateSnapshot(snap.id);
      }
    }

    await this.auditService.record({
      userId,
      action: 'TRIP_EVENT_CREATED',
      category: 'BUDGET',
      summary: `Created event pod "${created.title}" with cap Rp ${Math.round(created.plannedCapRp).toLocaleString('id-ID')}`,
      month: created.month,
      year: created.year,
    });

    return created;
  }

  async update(id: number, dto: UpdateTripEventDto, userId: number) {
    await this.assertEventOwnership(id, userId);
    return this.prisma.tripEventPlan.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.eventType !== undefined ? { eventType: dto.eventType } : {}),
        ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate ? { endDate: new Date(dto.endDate) } : {}),
        ...(dto.plannedCapRp !== undefined
          ? { plannedCapRp: Math.max(0, Math.round(dto.plannedCapRp)) }
          : {}),
        ...(dto.recommendedTier !== undefined ? { recommendedTier: dto.recommendedTier } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
      },
    });
  }

  async remove(id: number, userId: number) {
    const existing = await this.assertEventOwnership(id, userId);
    const linked = await this.prisma.periodCommitment.findMany({
      where: { tripEventId: id, userId },
    });
    if (linked.length > 0) {
      await this.prisma.periodCommitment.deleteMany({
        where: { tripEventId: id, userId },
      });
    }
    await this.prisma.tripEventPlan.delete({ where: { id } });

    const snap = await this.prisma.monthlySnapshot.findFirst({
      where: { userId, month: existing.month, year: existing.year },
    });
    if (snap?.id && linked.length > 0 && snap.status !== 'LOCKED') {
      await this.snapshotsService.recalculateSnapshot(snap.id);
    }

    return { deleted: true, id };
  }

  async addExpense(eventId: number, dto: CreateTripExpenseDto, userId: number) {
    await this.assertEventOwnership(eventId, userId);
    const parsedDate = new Date(dto.date);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Invalid trip expense date.');
    }
    const amt = Math.round(dto.amountRp);
    const reimbursed = Math.min(amt, Math.max(0, Math.round(dto.reimbursedAmountRp ?? 0)));
    return this.prisma.tripExpenseItem.create({
      data: {
        userId,
        tripEventId: eventId,
        date: parsedDate,
        label: dto.label.trim(),
        category: dto.category ?? 'FOOD_DRINK',
        amountRp: amt,
        isSharedAdvance: Boolean(dto.isSharedAdvance),
        counterpartyName: dto.counterpartyName?.trim() || null,
        reimbursedAmountRp: reimbursed,
        isSettled: Boolean(dto.isSharedAdvance) ? reimbursed >= amt : true,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async updateExpense(
    eventId: number,
    expenseId: number,
    dto: UpdateTripExpenseDto,
    userId: number,
  ) {
    await this.assertEventOwnership(eventId, userId);
    const row = await this.prisma.tripExpenseItem.findUnique({ where: { id: expenseId } });
    if (!row || row.tripEventId !== eventId) {
      throw new NotFoundException(`Expense #${expenseId} not found.`);
    }
    if (row.userId !== userId) {
      throw new ForbiddenException('Access denied.');
    }
    const nextAmt = dto.amountRp !== undefined ? Math.round(dto.amountRp) : Math.round(row.amountRp);
    const nextReimb =
      dto.reimbursedAmountRp !== undefined
        ? Math.min(nextAmt, Math.max(0, Math.round(dto.reimbursedAmountRp)))
        : Math.round(row.reimbursedAmountRp);
    const nextShared = dto.isSharedAdvance !== undefined ? dto.isSharedAdvance : row.isSharedAdvance;
    return this.prisma.tripExpenseItem.update({
      where: { id: expenseId },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        amountRp: nextAmt,
        isSharedAdvance: nextShared,
        ...(dto.counterpartyName !== undefined
          ? { counterpartyName: dto.counterpartyName.trim() || null }
          : {}),
        reimbursedAmountRp: nextReimb,
        isSettled:
          dto.isSettled !== undefined
            ? dto.isSettled
            : nextShared
              ? nextReimb >= nextAmt
              : true,
      },
    });
  }

  async deleteExpense(eventId: number, expenseId: number, userId: number) {
    await this.assertEventOwnership(eventId, userId);
    const row = await this.prisma.tripExpenseItem.findUnique({ where: { id: expenseId } });
    if (!row || row.tripEventId !== eventId) {
      throw new NotFoundException(`Expense #${expenseId} not found.`);
    }
    if (row.userId !== userId) {
      throw new ForbiddenException('Access denied.');
    }
    await this.prisma.tripExpenseItem.delete({ where: { id: expenseId } });
    return { deleted: true, id: expenseId };
  }

  async closeAndSweep(
    eventId: number,
    destination: 'CORE_SAVINGS' | 'DISCRETIONARY',
    userId: number,
  ) {
    const existing = await this.assertEventOwnership(eventId, userId);
    const totalGross = (existing.expenses ?? []).reduce(
      (s: number, e: any) => s + Math.round(Number(e.amountRp) || 0),
      0,
    );
    const totalReimbursed = (existing.expenses ?? []).reduce(
      (s: number, e: any) =>
        s + (e.isSharedAdvance ? Math.round(Number(e.reimbursedAmountRp) || 0) : 0),
      0,
    );
    const netPersonalSpent = Math.max(0, totalGross - totalReimbursed);
    const unusedAmountRp = Math.max(0, Math.round(existing.plannedCapRp) - netPersonalSpent);

    if (destination === 'CORE_SAVINGS' && unusedAmountRp > 0) {
      await this.prisma.savingsManualTransaction.create({
        data: {
          userId,
          label: `Unused Event Sweep: ${existing.title} (${existing.month}/${existing.year})`,
          amount: unusedAmountRp,
          instrumentType: SavingsInstrumentType.LIQUID_CASH,
          date: new Date(),
        },
      });
    }

    const updated = await this.prisma.tripEventPlan.update({
      where: { id: eventId },
      data: {
        status: 'COMPLETED',
        sweptAmountRp: unusedAmountRp,
        sweptDestination: destination,
      },
    });

    await this.auditService.record({
      userId,
      action: 'TRIP_EVENT_CLOSED_SWEPT',
      category: 'BUDGET',
      summary: `Closed "${existing.title}" and swept Rp ${unusedAmountRp.toLocaleString('id-ID')} to ${destination}`,
      month: existing.month,
      year: existing.year,
    });

    return {
      event: updated,
      unusedAmountRp,
      netPersonalSpent,
      destination,
    };
  }
}
