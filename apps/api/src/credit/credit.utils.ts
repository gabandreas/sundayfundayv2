import { CreditCardChargeType, LiabilityCategory } from '@prisma/client';
import {
  getJakartaDateParts,
  SPAYLATER_DUE_DAY,
  CC_DUE_DAY,
  PERSONAL_DEBT_DUE_DAY,
} from '../calculator/pacing';

export const MANUAL_UNPAID_MARKER = '[MANUAL_UNPAID]';

export interface ObligationSettlementResult {
  isSettled: boolean;
  isAutoSettled: boolean;
  isPastDueDate: boolean;
  dueDateIso: string;
  dueMonth: number;
  dueYear: number;
  dueDay: number;
}

export function getDefaultDueDayForCategory(
  category: LiabilityCategory | string,
  configuredCcDueDay: number = CC_DUE_DAY,
): number {
  if (category === 'CREDIT_CARD' || category === 'CC_TRANSACTION') {
    return configuredCcDueDay;
  }
  if (category === LiabilityCategory.PERSONAL_DEBT || category === 'PERSONAL_DEBT') {
    return PERSONAL_DEBT_DUE_DAY;
  }
  return SPAYLATER_DUE_DAY;
}

export function stripManualUnpaidMarker(notes?: string | null): string | null {
  if (!notes) return null;
  const cleaned = notes.replace(/\[MANUAL_UNPAID(?::\d{4}-\d{1,2})?\]/g, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function setManualUnpaidMarker(
  notes: string | null | undefined,
  manualUnpaid: boolean,
  periodScope?: string,
): string | null {
  const cleaned = stripManualUnpaidMarker(notes);
  if (!manualUnpaid) {
    return cleaned;
  }
  const tag = periodScope ? `[MANUAL_UNPAID:${periodScope}]` : MANUAL_UNPAID_MARKER;
  return cleaned ? `${cleaned} ${tag}` : tag;
}

/**
 * Evaluates settlement status deterministically without mutating DB state on read.
 * Under the payday-to-bill cycle convention, obligations for period M/YYYY are due
 * on `dueDay` of calendar month M+1 in Asia/Jakarta (WIB). Once Jakarta wall-clock
 * date >= dueDate, items are surfaced as Auto-Paid unless explicitly overridden Unpaid.
 */
export function evaluateObligationSettlement(params: {
  periodMonth: number;
  periodYear: number;
  dueDay: number;
  dbIsSettled: boolean;
  notes?: string | null;
  now?: Date;
  periodScope?: string;
}): ObligationSettlementResult {
  const dueMonth = params.periodMonth;
  const dueYear = params.periodYear;
  const lastDayOfDueMonth = new Date(Date.UTC(dueYear, dueMonth, 0)).getUTCDate();
  const clampedDueDay = Math.min(Math.max(1, Math.round(params.dueDay)), lastDayOfDueMonth);

  const dueDateIso = `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(clampedDueDay).padStart(2, '0')}`;
  const jkt = getJakartaDateParts(params.now);

  const isPastDueDate =
    jkt.year > dueYear ||
    (jkt.year === dueYear &&
      (jkt.month > dueMonth || (jkt.month === dueMonth && jkt.day >= clampedDueDay)));

  const hasManualUnpaid = params.periodScope
    ? Boolean(params.notes?.includes(`[MANUAL_UNPAID:${params.periodScope}]`))
    : Boolean(params.notes?.includes(MANUAL_UNPAID_MARKER));

  if (hasManualUnpaid) {
    return {
      isSettled: false,
      isAutoSettled: false,
      isPastDueDate,
      dueDateIso,
      dueMonth,
      dueYear,
      dueDay: clampedDueDay,
    };
  }

  const isSettled = Boolean(params.dbIsSettled) || isPastDueDate;
  const isAutoSettled = !params.dbIsSettled && isPastDueDate;

  return {
    isSettled,
    isAutoSettled,
    isPastDueDate,
    dueDateIso,
    dueMonth,
    dueYear,
    dueDay: clampedDueDay,
  };
}

export interface CreditCardDueLike {
  amount: number;
  totalAmount?: number | null;
  monthlyAmount?: number | null;
  chargeType: CreditCardChargeType | string;
  tenor?: number | null;
  billingMonth: number;
  billingYear: number;
  endedAtMonth?: number | null;
  endedAtYear?: number | null;
  stoppedAtMonth?: number | null;
  stoppedAtYear?: number | null;
  isActive?: boolean | null;
  status?: string | null;
}

export interface CardInstallmentProgress {
  isInstallment: boolean;
  currentSliceIndex: number | null;
  totalTenor: number;
  paidSlicesThroughTarget: number;
  remainingSlicesAfterTarget: number;
  remainingSlicesIncludingTarget: number;
  monthlyInstallmentAmount: number;
  totalPrincipalAmount: number;
  remainingPrincipalIncludingTarget: number;
  remainingPrincipalAfterTarget: number;
  badgeLabel: string | null;
  canSettleEarly: boolean;
}

export function calculateCardDueAmountForMonth(
  card: CreditCardDueLike,
  targetMonth: number,
  targetYear: number,
): number {
  if (card.status === 'CANCELLED') {
    return 0;
  }

  const targetSerial = targetYear * 12 + targetMonth;
  const startSerial = card.billingYear * 12 + card.billingMonth;

  if (card.status === 'SETTLED') {
    if (
      card.chargeType === CreditCardChargeType.INSTALLMENT &&
      card.endedAtMonth != null &&
      card.endedAtYear != null
    ) {
      const endSerial = card.endedAtYear * 12 + card.endedAtMonth;
      const tenor = Math.max(1, card.tenor || 1);
      const monthlySlice = card.monthlyAmount ?? card.amount / tenor;
      const totalPrincipal = card.totalAmount ?? monthlySlice * tenor;
      const monthsElapsed = targetSerial - startSerial;

      if (targetSerial >= startSerial && targetSerial < endSerial && monthsElapsed < tenor) {
        return monthlySlice;
      }
      if (targetSerial === endSerial && monthsElapsed >= 0 && monthsElapsed < tenor) {
        return Math.max(0, totalPrincipal - monthlySlice * monthsElapsed);
      }
    }
    return 0;
  }

  if (card.chargeType === CreditCardChargeType.FULL) {
    if (card.billingMonth === targetMonth && card.billingYear === targetYear) {
      return card.amount;
    }
  } else if (card.chargeType === CreditCardChargeType.INSTALLMENT) {
    const monthsElapsed = targetSerial - startSerial;
    const tenor = card.tenor || 1;
    if (monthsElapsed >= 0 && monthsElapsed < tenor) {
      return card.monthlyAmount ?? card.amount / tenor;
    }
  } else if (card.chargeType === CreditCardChargeType.RECURRING) {
    if (card.isActive === false && card.stoppedAtMonth == null && card.stoppedAtYear == null) {
      return 0;
    }
    if (targetSerial < startSerial) {
      return 0;
    }
    if (card.stoppedAtMonth != null && card.stoppedAtYear != null) {
      const stopSerial = card.stoppedAtYear * 12 + card.stoppedAtMonth;
      if (targetSerial >= stopSerial) {
        return 0;
      }
    }
    if (card.endedAtMonth != null && card.endedAtYear != null) {
      const endSerial = card.endedAtYear * 12 + card.endedAtMonth;
      if (targetSerial > endSerial) {
        return 0;
      }
    }
    return card.amount;
  }
  return 0;
}

export function calculateCardInstallmentProgress(
  card: CreditCardDueLike,
  targetMonth: number,
  targetYear: number,
): CardInstallmentProgress {
  const totalTenor = Math.max(1, card.tenor || 1);
  const monthlyInstallmentAmount = Math.round(
    card.monthlyAmount ?? card.amount / totalTenor,
  );
  const totalPrincipalAmount = Math.round(
    card.totalAmount ?? monthlyInstallmentAmount * totalTenor,
  );

  if (card.chargeType !== CreditCardChargeType.INSTALLMENT) {
    return {
      isInstallment: false,
      currentSliceIndex: null,
      totalTenor: 1,
      paidSlicesThroughTarget: 1,
      remainingSlicesAfterTarget: 0,
      remainingSlicesIncludingTarget: 0,
      monthlyInstallmentAmount: card.amount,
      totalPrincipalAmount: card.amount,
      remainingPrincipalIncludingTarget: 0,
      remainingPrincipalAfterTarget: 0,
      badgeLabel: null,
      canSettleEarly: false,
    };
  }

  if (card.status === 'SETTLED') {
    return {
      isInstallment: true,
      currentSliceIndex: null,
      totalTenor,
      paidSlicesThroughTarget: totalTenor,
      remainingSlicesAfterTarget: 0,
      remainingSlicesIncludingTarget: 0,
      monthlyInstallmentAmount,
      totalPrincipalAmount,
      remainingPrincipalIncludingTarget: 0,
      remainingPrincipalAfterTarget: 0,
      badgeLabel: `${totalTenor}/${totalTenor} (Settled)`,
      canSettleEarly: false,
    };
  }

  const targetSerial = targetYear * 12 + targetMonth;
  const startSerial = card.billingYear * 12 + card.billingMonth;
  const monthsElapsed = targetSerial - startSerial;

  if (monthsElapsed < 0) {
    return {
      isInstallment: true,
      currentSliceIndex: null,
      totalTenor,
      paidSlicesThroughTarget: 0,
      remainingSlicesAfterTarget: totalTenor,
      remainingSlicesIncludingTarget: totalTenor,
      monthlyInstallmentAmount,
      totalPrincipalAmount,
      remainingPrincipalIncludingTarget: totalPrincipalAmount,
      remainingPrincipalAfterTarget: totalPrincipalAmount,
      badgeLabel: `0/${totalTenor}`,
      canSettleEarly: card.status !== 'CANCELLED',
    };
  }

  if (monthsElapsed >= totalTenor) {
    return {
      isInstallment: true,
      currentSliceIndex: null,
      totalTenor,
      paidSlicesThroughTarget: totalTenor,
      remainingSlicesAfterTarget: 0,
      remainingSlicesIncludingTarget: 0,
      monthlyInstallmentAmount,
      totalPrincipalAmount,
      remainingPrincipalIncludingTarget: 0,
      remainingPrincipalAfterTarget: 0,
      badgeLabel: `${totalTenor}/${totalTenor}`,
      canSettleEarly: false,
    };
  }

  const currentSliceIndex = monthsElapsed + 1;
  const remainingSlicesAfterTarget = Math.max(0, totalTenor - currentSliceIndex);
  const remainingSlicesIncludingTarget = Math.max(
    0,
    totalTenor - monthsElapsed,
  );
  const remainingPrincipalIncludingTarget = Math.max(
    0,
    Math.round(totalPrincipalAmount - monthlyInstallmentAmount * monthsElapsed),
  );
  const remainingPrincipalAfterTarget = Math.max(
    0,
    Math.round(
      totalPrincipalAmount - monthlyInstallmentAmount * currentSliceIndex,
    ),
  );

  return {
    isInstallment: true,
    currentSliceIndex,
    totalTenor,
    paidSlicesThroughTarget: currentSliceIndex,
    remainingSlicesAfterTarget,
    remainingSlicesIncludingTarget,
    monthlyInstallmentAmount,
    totalPrincipalAmount,
    remainingPrincipalIncludingTarget,
    remainingPrincipalAfterTarget,
    badgeLabel: `${currentSliceIndex}/${totalTenor}`,
    canSettleEarly:
      card.status !== 'CANCELLED' && remainingSlicesIncludingTarget > 0,
  };
}

export const RESERVED_MARKER = '[RESERVED]';

export function hasReservedMarker(
  notes: string | null | undefined,
  periodScope?: string,
): boolean {
  if (!notes) return false;
  if (periodScope && notes.includes(`[RESERVED:${periodScope}]`)) {
    return true;
  }
  return notes.includes(RESERVED_MARKER);
}

export function stripReservedMarker(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const cleaned = notes.replace(/\[RESERVED(?::\d{4}-\d{1,2})?\]/g, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

export function setReservedMarker(
  notes: string | null | undefined,
  reserved: boolean,
  periodScope?: string,
): string | null {
  const base = stripReservedMarker(notes);
  if (!reserved) return base;
  const tag = periodScope ? `[RESERVED:${periodScope}]` : RESERVED_MARKER;
  return base ? `${base} ${tag}` : tag;
}

export function stripAllSettlementMarkers(
  notes: string | null | undefined,
): string | null {
  if (!notes) return null;
  const cleaned = notes
    .replace(/\[MANUAL_UNPAID(?::\d{4}-\d{1,2})?\]/g, '')
    .replace(/\[RESERVED(?::\d{4}-\d{1,2})?\]/g, '')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

export type DerivedBillSettlementState = 'UNPAID' | 'RESERVED' | 'PAID';

export function resolveBillSettlementState(params: {
  isSettled: boolean;
  notes: string | null | undefined;
  periodScope?: string;
}): DerivedBillSettlementState {
  if (params.isSettled) return 'PAID';
  if (hasReservedMarker(params.notes, params.periodScope)) return 'RESERVED';
  return 'UNPAID';
}
