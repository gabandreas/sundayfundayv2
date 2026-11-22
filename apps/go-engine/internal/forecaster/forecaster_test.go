package forecaster

import "testing"

func TestRunForecastSpinjamAndRunway(t *testing.T) {
	req := ForecasterRequest{
		StartingLiquidAssetsRp: 4838220,
		StartingP1VaultRp:      1921345,
		EmergencyFundTargetRp:  10000000,
		BaselineDailyBurnRp:    50000,
		RdpuAnnualYieldPct:     4.75,
		VariableShockPercent:   15,
		Periods: []ForecastPeriod{
			{Month: 11, Year: 2026, Label: "NOV '26", TotalIncomeRp: 5904000, TotalDebtDueRp: 4017341, PersonalDebtDueRp: 669970, DailyLivingRp: 1500000, RoutineBillsRp: 300000, CoreSavingsP1Rp: 86659},
			{Month: 12, Year: 2026, Label: "DEC '26", TotalIncomeRp: 9840917, TotalDebtDueRp: 3171115, PersonalDebtDueRp: 919970, DailyLivingRp: 2850000, RoutineBillsRp: 535000, CoreSavingsP1Rp: 1000000, SelfRewardP2Rp: 2284802},
			{Month: 1, Year: 2027, Label: "JAN '27", TotalIncomeRp: 5891000, TotalDebtDueRp: 1967159, PersonalDebtDueRp: 522010, DailyLivingRp: 2850000, RoutineBillsRp: 535000, CoreSavingsP1Rp: 538841},
			{Month: 2, Year: 2027, Label: "FEB '27", TotalIncomeRp: 5891000, TotalDebtDueRp: 835996, PersonalDebtDueRp: 0, DailyLivingRp: 2850000, RoutineBillsRp: 535000, CoreSavingsP1Rp: 1000000, SelfRewardP2Rp: 670004},
			{Month: 3, Year: 2027, Label: "MAR '27", TotalIncomeRp: 5766000, TotalDebtDueRp: 697726, PersonalDebtDueRp: 0, DailyLivingRp: 2850000, RoutineBillsRp: 535000, CoreSavingsP1Rp: 1000000, SelfRewardP2Rp: 683274},
			{Month: 4, Year: 2027, Label: "APR '27", TotalIncomeRp: 5916000, TotalDebtDueRp: 293044, PersonalDebtDueRp: 0, DailyLivingRp: 2850000, RoutineBillsRp: 535000, CoreSavingsP1Rp: 1000000, SelfRewardP2Rp: 1237956},
		},
	}

	res := RunForecast(req)
	if res.SpinjamFreedomDate != "Feb 2027" {
		t.Fatalf("expected SPinjam freedom Feb 2027, got %s", res.SpinjamFreedomDate)
	}
	if res.LowDsrMilestoneDate != "Feb 2027" {
		t.Fatalf("expected Low DSR (<15%%) milestone Feb 2027, got %s", res.LowDsrMilestoneDate)
	}
	if res.PureSurvivalRunwayDays != 96 {
		t.Fatalf("expected 96 runway days, got %d", res.PureSurvivalRunwayDays)
	}
	if res.Projected6MWealthZeroLeakRp <= res.Projected6MWealthBaselineRp {
		t.Fatalf("expected zero-leakage wealth > baseline wealth")
	}
}
