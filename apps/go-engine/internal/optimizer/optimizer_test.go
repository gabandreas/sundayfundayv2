package optimizer

import "testing"

func TestOptimizeAllocationFrontierIndebtedAndDebtFree(t *testing.T) {
	indebted := OptimizeAllocationFrontier(AllocationOptRequest{
		MonthlySurplusRp:      2000000,
		CurrentSavingsRp:      1500000,
		EmergencyFundTargetRp: 15000000,
		MonthlyEssentialsRp:   2000000,
		Debts: []DebtSlice{
			{Title: "SPinjam Loan", RemainingRp: 1200000, MonthlyInstallmentRp: 400000, MonthlyInterestPct: 3.95, RemainingMonths: 3},
			{Title: "PayLater 3x", RemainingRp: 900000, MonthlyInstallmentRp: 300000, MonthlyInterestPct: 2.95, RemainingMonths: 3},
		},
		Goals: []GoalSlice{
			{Title: "Laptop Upgrade", TargetRp: 12000000, AllocatedRp: 2000000},
		},
	})

	if indebted.CombinationsEvaluated < 1000 {
		t.Fatalf("expected >= 1000 evaluated frontier points, got %d", indebted.CombinationsEvaluated)
	}
	if len(indebted.Strategies) != 3 {
		t.Fatalf("expected 3 pareto strategies, got %d", len(indebted.Strategies))
	}
	for _, s := range indebted.Strategies {
		sum := s.DebtPrepaymentRp + s.EmergencyFundRp + s.GoalSavingsRp + s.FlexibleRp
		if sum != 2000000 {
			t.Fatalf("strategy %s splits do not sum to surplus 2000000 (got %d)", s.Code, sum)
		}
	}

	// Zero-debt Standard user profile must never crash and keeps DebtPrepaymentRp == 0
	debtFree := OptimizeAllocationFrontier(AllocationOptRequest{
		MonthlySurplusRp:      3000000,
		CurrentSavingsRp:      2000000,
		EmergencyFundTargetRp: 12000000,
		MonthlyEssentialsRp:   2500000,
		Debts:                 nil,
		Goals: []GoalSlice{
			{Title: "Travel Reserve", TargetRp: 10000000, AllocatedRp: 1000000},
		},
	})
	if len(debtFree.Strategies) != 3 {
		t.Fatalf("expected 3 strategies for debt-free standard user, got %d", len(debtFree.Strategies))
	}
	for _, s := range debtFree.Strategies {
		if s.DebtPrepaymentRp != 0 {
			t.Fatalf("expected 0 debt prepayment when user has no debts, got %d", s.DebtPrepaymentRp)
		}
		sum := s.DebtPrepaymentRp + s.EmergencyFundRp + s.GoalSavingsRp + s.FlexibleRp
		if sum != 3000000 {
			t.Fatalf("debt-free strategy %s splits do not sum to 3000000 (got %d)", s.Code, sum)
		}
	}
}
