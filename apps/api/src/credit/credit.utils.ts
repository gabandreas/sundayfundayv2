import { CreditCardChargeType } from '@prisma/client';

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
