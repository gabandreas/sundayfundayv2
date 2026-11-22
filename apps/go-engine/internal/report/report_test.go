package report

import "testing"

func TestExecutiveHorizonGoldenVector(t *testing.T) {
	res := BuildExecutiveHorizon(HorizonRequest{
		SelectedMonth: 11,
		SelectedYear:  2026,
		Periods: []PeriodMetricInput{
			{Month: 11, Year: 2026, PeriodLabel: "NOV '26", FinalTotalIncome: 5904000, TotalDebt: 4017341, ActualDailyOperational: 1500000, ActualSavings: 86659, DaysInCycle: 31},
			{Month: 12, Year: 2026, PeriodLabel: "DEC '26", FinalTotalIncome: 9840917, TotalDebt: 3171115, ActualDailyOperational: 2850000, ActualSavings: 1000000, SelfReward: 2284802, DaysInCycle: 28},
			{Month: 1, Year: 2027, PeriodLabel: "JAN '27", FinalTotalIncome: 5891000, TotalDebt: 1967159, ActualDailyOperational: 2850000, ActualSavings: 538841, DaysInCycle: 31},
			{Month: 2, Year: 2027, PeriodLabel: "FEB '27", FinalTotalIncome: 5891000, TotalDebt: 835996, ActualDailyOperational: 2850000, ActualSavings: 1000000, SelfReward: 670004, DaysInCycle: 28},
		},
		Contracts: []ContractSummaryInput{
			{ID: "c1", Title: "SPinjam Oct 23", MonthlyInstallment: 73387, RemainingPrincipal: 146774, PayoffMonth: 12, PayoffYear: 2026},
			{ID: "c2", Title: "SPinjam Nov 08", MonthlyInstallment: 335578, RemainingPrincipal: 1006734, PayoffMonth: 1, PayoffYear: 2027},
		},
	})

	if res.DsrPercent != 68.0 {
		t.Fatalf("expected Nov DSR 68.0%%, got %.1f%%", res.DsrPercent)
	}
	if res.DebtBurnDownVelocityRp <= 0 {
		t.Fatalf("expected positive debt burn-down velocity, got %d", res.DebtBurnDownVelocityRp)
	}
	if len(res.FreedUpMilestones) != 2 {
		t.Fatalf("expected 2 freed-up milestones, got %d", len(res.FreedUpMilestones))
	}
	if res.FreedUpMilestones[0].PeriodLabel != "JAN '27" || res.FreedUpMilestones[0].FreedMonthlyRp != 73387 {
		t.Fatalf("unexpected milestone 0: %+v", res.FreedUpMilestones[0])
	}
}
