package debtopt

import "testing"

func TestOptimizeDebtPayoffMilestones(t *testing.T) {
	req := DebtOptRequest{
		ExtraLumpSumRp: 1000000,
		Contracts: []DebtContract{
			{ID: "sp1", Name: "SPinjam Oct 23", Instrument: "SPINJAM", MonthlyInstallment: 73387, RemainingMonths: 2, RemainingBalanceRp: 146774, MonthlyInterestPct: 3.95, PayoffMonth: 1, PayoffYear: 2027, PayoffLabel: "Jan 2027"},
			{ID: "sp2", Name: "SPinjam Oct 24", Instrument: "SPINJAM", MonthlyInstallment: 74573, RemainingMonths: 2, RemainingBalanceRp: 149146, MonthlyInterestPct: 3.95, PayoffMonth: 1, PayoffYear: 2027, PayoffLabel: "Jan 2027"},
			{ID: "sp3", Name: "SPinjam Nov 08", Instrument: "SPINJAM", MonthlyInstallment: 335578, RemainingMonths: 3, RemainingBalanceRp: 1006734, MonthlyInterestPct: 3.95, PayoffMonth: 2, PayoffYear: 2027, PayoffLabel: "Feb 2027"},
			{ID: "sp4", Name: "SPinjam Nov 17", Instrument: "SPINJAM", MonthlyInstallment: 186432, RemainingMonths: 3, RemainingBalanceRp: 559296, MonthlyInterestPct: 3.95, PayoffMonth: 2, PayoffYear: 2027, PayoffLabel: "Feb 2027"},
			{ID: "p1r", Name: "Hoodie P1 Vault Forward-Borrow Refund", Instrument: "P1_VAULT_REFUND", MonthlyInstallment: 250000, RemainingMonths: 1, RemainingBalanceRp: 250000, MonthlyInterestPct: 0, PayoffMonth: 1, PayoffYear: 2027, PayoffLabel: "Jan 2027"},
		},
	}

	res := OptimizeDebtPayoff(req)
	if len(res.UnlockMilestones) != 2 {
		t.Fatalf("expected 2 unlock milestones, got %d", len(res.UnlockMilestones))
	}
	if res.UnlockMilestones[0].FreedMonthlyRp != 147960 {
		t.Fatalf("expected +147960 Jan 2027 unlock, got %d", res.UnlockMilestones[0].FreedMonthlyRp)
	}
	if res.UnlockMilestones[1].FreedMonthlyRp != 522010 {
		t.Fatalf("expected +522010 Feb 2027 unlock, got %d", res.UnlockMilestones[1].FreedMonthlyRp)
	}
	if res.SpinjamMonthlyTotalRp != 669970 {
		t.Fatalf("expected 669970 total SPinjam monthly, got %d", res.SpinjamMonthlyTotalRp)
	}
}
