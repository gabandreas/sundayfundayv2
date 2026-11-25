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
import { ConfigSelectors } from '../config/config.selectors';
import {
  DEFAULT_EVENT_CATEGORIES,
  EventCategoryConfigRow,
} from '../config/studio.defaults';
import {
  CreateTripEventDto,
  CreateTripExpenseDto,
  OptimizeTripEventDto,
  UpdateTripEventDto,
  UpdateTripExpenseDto,
} from './dto/event.dto';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getJakartaTodayIso(): string {
  const nowJakarta = new Date(Date.now() + 7 * 3600 * 1000);
  return nowJakarta.toISOString().slice(0, 10);
}

function normalizeEventTypeCode(raw?: string): string {
  const clean = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!clean) return 'DAY_OUTING';
  const aliases: Record<string, string> = {
    OUTING: 'DAY_OUTING',
    WEEKEND: 'WEEKEND_TRIP',
    DINNER: 'DINING_GATHERING',
    CONCERT: 'CONCERT_EVENT',
    OTHER: 'GENERAL_EVENT',
  };
  return aliases[clean] ?? clean;
}

function diffIsoDays(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${toIso.slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly goBridge: GoBridgeService,
    private readonly snapshotsService: SnapshotsService,
    private readonly auditService: AuditLogService,
    private readonly financeSelectors?: FinanceSelectors,
    private readonly configSelectors?: ConfigSelectors,
  ) {}

  private async resolveTargetPeriodForDate(
    userId: number,
    dateIso: string,
    fallbackMonth: number,
    fallbackYear: number,
  ): Promise<{ month: number; year: number; snapshot: any | null }> {
    const snapshots =
      typeof this.prisma.monthlySnapshot?.findMany === 'function'
        ? await this.prisma.monthlySnapshot.findMany({
            where: { userId },
            orderBy: [{ year: 'asc' }, { month: 'asc' }],
          })
        : [];

    if (snapshots.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      const sorted = snapshots.map((s) => ({
        ...s,
        startIso: s.payrollPayoutDate
          ? new Date(s.payrollPayoutDate).toISOString().slice(0, 10)
          : `${s.year}-${String(s.month).padStart(2, '0')}-01`,
      }));

      for (let i = 0; i < sorted.length; i++) {
        const cur = sorted[i];
        const next = sorted[i + 1];
        if (dateIso >= cur.startIso && (!next || dateIso < next.startIso)) {
          if (!next) {
            const daysBeyond = diffIsoDays(cur.startIso, dateIso);
            if (daysBeyond > 35) {
              break;
            }
          }
          return { month: cur.month, year: cur.year, snapshot: cur };
        }
      }

      const [calY, calM] = dateIso.split('-').map(Number);
      const byCal = sorted.find((s) => s.year === calY && s.month === calM);
      if (byCal) return { month: byCal.month, year: byCal.year, snapshot: byCal };
    }

    const snap = await this.prisma.monthlySnapshot.findFirst({
      where: { userId, month: fallbackMonth, year: fallbackYear },
    });
    return { month: fallbackMonth, year: fallbackYear, snapshot: snap };
  }

  private async resolveEventCategoryConfig(
    userId: number,
    eventTypeCode: string,
  ): Promise<EventCategoryConfigRow> {
    let table: EventCategoryConfigRow[] = DEFAULT_EVENT_CATEGORIES;
    if (this.configSelectors) {
      try {
        const cfg: any = await this.configSelectors.getConfig(userId);
        const rawTable = cfg?.studioConfig?.eventCategoriesTable;
        if (Array.isArray(rawTable) && rawTable.length > 0) {
          table = rawTable;
        }
      } catch {
        table = DEFAULT_EVENT_CATEGORIES;
      }
    }
    const found =
      table.find((r) => String(r.code).toUpperCase() === eventTypeCode) ??
      DEFAULT_EVENT_CATEGORIES.find((r) => r.code === eventTypeCode);
    if (found) return found;
    return {
      id: `evt_${eventTypeCode.toLowerCase()}`,
      code: eventTypeCode,
      label: eventTypeCode,
      foodPct: 40,
      transportPct: 20,
      activitiesPct: 25,
      contingencyPct: 15,
      weekendWeightPct: 120,
      active: true,
    };
  }

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
    const todayIso = getJakartaTodayIso();
    const startIso =
      dto.startDateIso && /^\d{4}-\d{2}-\d{2}$/.test(dto.startDateIso.slice(0, 10))
        ? dto.startDateIso.slice(0, 10)
        : todayIso;
    const timingMode: 'PAST' | 'TODAY' | 'UPCOMING' =
      startIso < todayIso ? 'PAST' : startIso === todayIso ? 'TODAY' : 'UPCOMING';
    const daysUntilEvent = Math.max(0, diffIsoDays(todayIso, startIso));

    const resolved = await this.resolveTargetPeriodForDate(
      userId,
      startIso,
      dto.month,
      dto.year,
    );
    const targetMonth = resolved.month;
    const targetYear = resolved.year;
    const snap = resolved.snapshot;

    const radar = this.financeSelectors
      ? await this.financeSelectors.getCashRadarProjection(targetMonth, targetYear, userId)
      : null;

    const cycleDiscretionaryRp = Math.max(0, Math.round(snap?.selfReward ?? 0));
    const cycleEmergencyBufferRp = Math.max(0, Math.round(snap?.bufferPocket ?? 0));
    const cycleCoreSavingsRp = Math.max(0, Math.round(snap?.actualSavings ?? 0));
    const cycleShortfallRp = Math.max(0, Math.round(snap?.deficitUncovered ?? 0));
    const cashRadarLowestPointRp = radar
      ? Math.round(radar.lowestCashPoint?.balanceRp ?? 0)
      : cycleShortfallRp > 0
        ? -cycleShortfallRp
        : cycleDiscretionaryRp + cycleEmergencyBufferRp;
    const remainingDaysInCycle = Math.max(
      1,
      Math.round((radar as any)?.daysRemaining ?? 30),
    );

    const normalizedType = normalizeEventTypeCode(dto.eventType);
    const catCfg = await this.resolveEventCategoryConfig(userId, normalizedType);
    const customCategoryWeights = [
      { code: 'FOOD_DRINK', label: 'Food & Drinks', pct: Math.max(1, Math.round(catCfg.foodPct || 40)) },
      { code: 'LOCAL_TRANSPORT', label: 'Local Transport', pct: Math.max(1, Math.round(catCfg.transportPct || 20)) },
      { code: 'ACTIVITIES', label: 'Activities & Entry', pct: Math.max(1, Math.round(catCfg.activitiesPct || 25)) },
      { code: 'CONTINGENCY', label: 'Contingency', pct: Math.max(1, Math.round(catCfg.contingencyPct || 15)) },
    ];

    const opt = await this.goBridge.optimizeTripBudget({
      eventType: normalizedType,
      durationDays: dto.durationDays,
      startDateIso: startIso,
      prepaidCommittedRp: Math.max(0, Math.round(dto.prepaidCommittedRp ?? 0)),
      cycleDiscretionaryRp,
      cycleEmergencyBufferRp,
      cycleCoreSavingsRp,
      cashRadarLowestPointRp,
      remainingDaysInCycle,
      weekendWeightPct: Math.round(catCfg.weekendWeightPct || 120),
      customCategoryWeights,
    });

    const targetPeriodLabel = `${SHORT_MONTHS[(targetMonth - 1) % 12]} ${targetYear}`;
    const prepDailySetAsideRp =
      daysUntilEvent > 0 && opt?.balanced?.variableSpendCapRp > 0
        ? Math.round(opt.balanced.variableSpendCapRp / daysUntilEvent)
        : 0;

    return {
      ...opt,
      targetMonth,
      targetYear,
      targetPeriodLabel,
      timingMode,
      daysUntilEvent,
      isPastDate: timingMode === 'PAST',
      cycleDiscretionaryRp,
      cycleEmergencyBufferRp,
      cycleShortfallRp,
      prepDailySetAsideRp,
    };
  }

  async create(dto: CreateTripEventDto, userId: number) {
    const startIso = String(dto.startDate || '').slice(0, 10);
    const endIso = String(dto.endDate || '').slice(0, 10);
    const startDate = new Date(`${startIso}T00:00:00.000Z`);
    const endDate = new Date(`${endIso}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startIso) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endIso) ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      throw new BadRequestException('Invalid startDate or endDate.');
    }

    const todayIso = getJakartaTodayIso();
    if (startIso < todayIso) {
      throw new BadRequestException(
        'Event start date cannot be in the past. Select today or a future date.',
      );
    }
    if (endIso < startIso) {
      throw new BadRequestException('End date cannot be earlier than start date.');
    }

    const resolved = await this.resolveTargetPeriodForDate(
      userId,
      startIso,
      dto.month,
      dto.year,
    );
    const targetMonth = resolved.month;
    const targetYear = resolved.year;
    const snap = resolved.snapshot;

    if (snap && snap.status === 'LOCKED') {
      throw new BadRequestException(`Period ${targetMonth}/${targetYear} is locked.`);
    }

    const initialStatus = startIso === todayIso ? 'ACTIVE' : 'PLANNING';
    const normalizedType = normalizeEventTypeCode(dto.eventType);
    const prepaidAmountRp = Math.max(0, Math.round(dto.prepaidAmountRp ?? 0));
    const created = await this.prisma.tripEventPlan.create({
      data: {
        userId,
        month: targetMonth,
        year: targetYear,
        title: dto.title.trim(),
        eventType: normalizedType,
        startDate,
        endDate,
        plannedCapRp: Math.max(0, Math.round(dto.plannedCapRp)),
        recommendedTier: dto.recommendedTier ?? 'BALANCED',
        fundingSource: dto.fundingSource ?? 'DISCRETIONARY',
        prepaidAmountRp,
        status: initialStatus,
        notes: dto.notes?.trim() || null,
      },
    });

    if (dto.createPrepaidCommitment && prepaidAmountRp > 0) {
      await this.prisma.periodCommitment.create({
        data: {
          userId,
          month: targetMonth,
          year: targetYear,
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
      summary: `Created event budget "${created.title}" with cap Rp ${Math.round(created.plannedCapRp).toLocaleString('id-ID')}`,
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
