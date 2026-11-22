package networth

import "testing"

func TestComputeNetWorthAndTrajectory(t *testing.T) {
	req := NetWorthRequest{
		Accounts: []AssetAccount{
			{ID: "bca", Name: "BCA Payroll", AccountType: "OPERATIONAL_BANK", BalanceRp: 1886659, AnnualYieldPct: 0.1, IncludeInRunway: true},
			{ID: "rdpu", Name: "blu Batavia RDPU", AccountType: "MONEY_MARKET_RDPU", BalanceRp: 2651561, AnnualYieldPct: 4.75, IncludeInRunway: true},
			{ID: "cash", Name: "Daily Cash", AccountType: "CASH_WALLET", BalanceRp: 300000, AnnualYieldPct: 0, IncludeInRunway: true},
			{ID: "p1", Name: "Core P1 Vault", AccountType: "SAVINGS_VAULT", BalanceRp: 1921345, AnnualYieldPct: 4.75, IncludeInRunway: true},
		},
		UpcomingPeriods: []MonthlyPeriodFlow{
			{Month: 11, Year: 2026, Label: "NOV '26", ProjectedSavingsP1Rp: 86659, TotalDebtDueRp: 4017341, PayLaterDueRp: 2613115, CreditCardDueRp: 734256, PersonalDebtDueRp: 669970},
			{Month: 12, Year: 2026, Label: "DEC '26", ProjectedSavingsP1Rp: 1000000, ProjectedSurplusP2Rp: 2284802, TotalDebtDueRp: 3171115, PayLaterDueRp: 1622889, CreditCardDueRp: 628256, PersonalDebtDueRp: 919970},
			{Month: 1, Year: 2027, Label: "JAN '27", ProjectedSavingsP1Rp: 538841, TotalDebtDueRp: 1967159, PayLaterDueRp: 816893, CreditCardDueRp: 628256, PersonalDebtDueRp: 522010},
			{Month: 2, Year: 2027, Label: "FEB '27", ProjectedSavingsP1Rp: 1000000, ProjectedSurplusP2Rp: 670004, TotalDebtDueRp: 835996, PayLaterDueRp: 207740, CreditCardDueRp: 628256, PersonalDebtDueRp: 0},
		},
	}

	res := ComputeNetWorth(req)
	expectedAssets := int64(1886659 + 2651561 + 300000 + 1921345)
	if res.TotalAssetsRp != expectedAssets {
		t.Fatalf("expected total assets %d, got %d", expectedAssets, res.TotalAssetsRp)
	}
	expectedDebt := int64(4017341 + 3171115 + 1967159 + 835996)
	if res.TotalUnpaidDebtRp != expectedDebt {
		t.Fatalf("expected total debt %d, got %d", expectedDebt, res.TotalUnpaidDebtRp)
	}
	if res.CurrentCycleDebtRp != 4017341 {
		t.Fatalf("expected current cycle debt 4017341, got %d", res.CurrentCycleDebtRp)
	}
	expectedFuture := int64(3171115 + 1967159 + 835996)
	if res.FutureInstallmentPrincipalRp != expectedFuture {
		t.Fatalf("expected future installment principal %d, got %d", expectedFuture, res.FutureInstallmentPrincipalRp)
	}
	if len(res.Trajectory) != 4 {
		t.Fatalf("expected 4 trajectory points, got %d", len(res.Trajectory))
	}
	last := res.Trajectory[3]
	if last.RemainingDebtRp != 0 {
		t.Fatalf("expected 0 remaining debt after Feb 2027, got %d", last.RemainingDebtRp)
	}
	if last.NetWorthRp <= 0 {
		t.Fatalf("expected positive net worth after Feb 2027, got %d", last.NetWorthRp)
	}
}
