import {
  calculateCardDueAmountForMonth,
  calculateCardInstallmentProgress,
} from './credit.utils';

describe('credit.utils calculator', () => {
  describe('calculateCardDueAmountForMonth with RECURRING endedAtMonth/endedAtYear', () => {
    it('bills RECURRING charges from start month up through endedAtMonth/endedAtYear inclusive, and 0 afterward', () => {
      const recurringCard = {
        amount: 186000,
        chargeType: 'RECURRING',
        billingMonth: 7,
        billingYear: 2026,
        endedAtMonth: 10,
        endedAtYear: 2026,
        status: 'ACTIVE',
      };

      expect(calculateCardDueAmountForMonth(recurringCard, 6, 2026)).toBe(0);
      expect(calculateCardDueAmountForMonth(recurringCard, 7, 2026)).toBe(186000);
      expect(calculateCardDueAmountForMonth(recurringCard, 9, 2026)).toBe(186000);
      expect(calculateCardDueAmountForMonth(recurringCard, 10, 2026)).toBe(186000);
      expect(calculateCardDueAmountForMonth(recurringCard, 11, 2026)).toBe(0);
      expect(calculateCardDueAmountForMonth(recurringCard, 1, 2027)).toBe(0);
    });
  });

  describe('calculateCardInstallmentProgress', () => {
    it('computes dynamic slice index, badgeLabel ("2/12"), and remaining principal for active INSTALLMENT charges', () => {
      const installmentCard = {
        amount: 500000,
        totalAmount: 6000000,
        monthlyAmount: 500000,
        chargeType: 'INSTALLMENT',
        tenor: 12,
        billingMonth: 9,
        billingYear: 2026,
        status: 'ACTIVE',
      };

      const progressOct = calculateCardInstallmentProgress(
        installmentCard,
        10,
        2026,
      );
      expect(progressOct.isInstallment).toBe(true);
      expect(progressOct.currentSliceIndex).toBe(2);
      expect(progressOct.totalTenor).toBe(12);
      expect(progressOct.badgeLabel).toBe('2/12');
      expect(progressOct.remainingSlicesIncludingTarget).toBe(11);
      expect(progressOct.remainingPrincipalIncludingTarget).toBe(5500000);
      expect(progressOct.remainingPrincipalAfterTarget).toBe(5000000);
      expect(progressOct.canSettleEarly).toBe(true);
    });

    it('returns lump-sum remaining principal in the settlement month and 0 afterward when status is SETTLED with endedAtMonth/endedAtYear', () => {
      const settledCard = {
        amount: 500000,
        totalAmount: 6000000,
        monthlyAmount: 500000,
        chargeType: 'INSTALLMENT',
        tenor: 12,
        billingMonth: 9,
        billingYear: 2026,
        endedAtMonth: 10,
        endedAtYear: 2026,
        status: 'SETTLED',
      };

      expect(calculateCardDueAmountForMonth(settledCard, 9, 2026)).toBe(500000);
      expect(calculateCardDueAmountForMonth(settledCard, 10, 2026)).toBe(5500000);
      expect(calculateCardDueAmountForMonth(settledCard, 11, 2026)).toBe(0);
      const progress = calculateCardInstallmentProgress(settledCard, 10, 2026);
      expect(progress.remainingPrincipalIncludingTarget).toBe(0);
      expect(progress.canSettleEarly).toBe(false);
      expect(progress.badgeLabel).toBe('12/12 (Settled)');
    });
  });
});
