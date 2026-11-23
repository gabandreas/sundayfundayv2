package montecarlo

import "testing"

func samplePeriods() []MonteCarloPeriodInput {
	return []MonteCarloPeriodInput{
		{Label: "DEC '26", IncomeRp: 9737425, DebtDueRp: 4189341, FixedBillsRp: 300000, LivingTargetRp: 1500000, SavingsTargetRp: 1000000},
		{Label: "JAN '27", IncomeRp: 5941000, DebtDueRp: 3171115, FixedBillsRp: 535000, LivingTargetRp: 1500000, SavingsTargetRp: 1000000},
		{Label: "FEB '27", IncomeRp: 5891000, DebtDueRp: 1967159, FixedBillsRp: 535000, LivingTargetRp: 1500000, SavingsTargetRp: 1000000},
		{Label: "MAR '27", IncomeRp: 5891000, DebtDueRp: 835996, FixedBillsRp: 535000, LivingTargetRp: 1500000, SavingsTargetRp: 1000000},
		{Label: "APR '27", IncomeRp: 5766000, DebtDueRp: 697726, FixedBillsRp: 535000, LivingTargetRp: 1500000, SavingsTargetRp: 1000000},
		{Label: "MAY '27", IncomeRp: 5916000, DebtDueRp: 293044, FixedBillsRp: 535000, LivingTargetRp: 1500000, SavingsTargetRp: 1000000},
	}
}

func TestMonteCarloDeterministicAcrossWorkers(t *testing.T) {
	req := MonteCarloRequest{
		StartingLiquidAssetsRp:     500000,
		StartingSavingsRp:          2000000,
		EmergencyFundTargetRp:      15000000,
		IncomeVolatilityPct:        10,
		ExpenseShockProbPct:        20,
		ExpenseShockMagnitudePct:   25,
		UnexpectedEmergencyProbPct: 10,
		UnexpectedEmergencyCostRp:  1500000,
		Trials:                     2000,
		Seed:                       20261123,
		Periods:                    samplePeriods(),
	}

	r1 := RunMonteCarlo(req)
	r2 := RunMonteCarlo(req)

	if r1.TrialsRun != 2000 {
		t.Fatalf("expected 2000 trials, got %d", r1.TrialsRun)
	}
	if r1.WorkerGoroutines < 1 {
		t.Fatalf("expected >= 1 worker goroutine, got %d", r1.WorkerGoroutines)
	}
	if len(r1.FanSeries) != len(req.Periods) {
		t.Fatalf("expected %d fan points, got %d", len(req.Periods), len(r1.FanSeries))
	}
	if r1.P10EndingWealthRp != r2.P10EndingWealthRp || r1.P50MedianEndingWealthRp != r2.P50MedianEndingWealthRp || r1.P90EndingWealthRp != r2.P90EndingWealthRp {
		t.Fatalf("monte carlo results must be deterministic across concurrent runs: %+v vs %+v", r1, r2)
	}
	if !(r1.P10EndingWealthRp <= r1.P50MedianEndingWealthRp && r1.P50MedianEndingWealthRp <= r1.P90EndingWealthRp) {
		t.Fatalf("quantile ordering invariant violated: P10=%d P50=%d P90=%d", r1.P10EndingWealthRp, r1.P50MedianEndingWealthRp, r1.P90EndingWealthRp)
	}
}

func TestMonteCarloZeroShockMatchesBaselineAndDetectsFragility(t *testing.T) {
	zeroShock := RunMonteCarlo(MonteCarloRequest{
		StartingLiquidAssetsRp:     1000000,
		StartingSavingsRp:          2000000,
		EmergencyFundTargetRp:      5000000,
		IncomeVolatilityPct:        0,
		ExpenseShockProbPct:        0,
		ExpenseShockMagnitudePct:   0,
		UnexpectedEmergencyProbPct: 0,
		UnexpectedEmergencyCostRp:  0,
		Trials:                     500,
		Seed:                       99,
		Periods:                    samplePeriods(),
	})
	if zeroShock.SurvivalProbabilityPct != 100 {
		t.Fatalf("expected 100%% survival with zero volatility and healthy surplus, got %v", zeroShock.SurvivalProbabilityPct)
	}
	if zeroShock.P10EndingWealthRp != zeroShock.P90EndingWealthRp {
		t.Fatalf("expected zero spread under 0 volatility, got P10=%d P90=%d", zeroShock.P10EndingWealthRp, zeroShock.P90EndingWealthRp)
	}

	fragile := RunMonteCarlo(MonteCarloRequest{
		StartingLiquidAssetsRp:     100000,
		StartingSavingsRp:          100000,
		EmergencyFundTargetRp:      15000000,
		IncomeVolatilityPct:        25,
		ExpenseShockProbPct:        40,
		ExpenseShockMagnitudePct:   35,
		UnexpectedEmergencyProbPct: 20,
		UnexpectedEmergencyCostRp:  3500000,
		Trials:                     1000,
		Seed:                       42,
		Periods: []MonteCarloPeriodInput{
			{Label: "M1", IncomeRp: 4000000, DebtDueRp: 2500000, FixedBillsRp: 500000, LivingTargetRp: 1200000, SavingsTargetRp: 0},
			{Label: "M2", IncomeRp: 4000000, DebtDueRp: 2500000, FixedBillsRp: 500000, LivingTargetRp: 1200000, SavingsTargetRp: 0},
		},
	})
	if fragile.SurvivalProbabilityPct >= 80 {
		t.Fatalf("expected degraded survival under tight cashflow + emergency shocks, got %v", fragile.SurvivalProbabilityPct)
	}
	if fragile.RecommendedExtraBufferMonthlyRp <= 0 {
		t.Fatalf("expected positive recommended extra buffer for fragile profile, got %d", fragile.RecommendedExtraBufferMonthlyRp)
	}
}
