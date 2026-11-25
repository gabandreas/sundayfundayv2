package tripbudget

import "testing"

func TestOptimizeTripBudgetTiersAndConservation(t *testing.T) {
	res := OptimizeTripBudget(TripOptimizeRequest{
		EventType:              "DAY_OUTING",
		DurationDays:           2,
		PrepaidCommittedRp:     100000,
		CycleDiscretionaryRp:   2316084,
		CycleEmergencyBufferRp: 250000,
		CycleCoreSavingsRp:     1000000,
		CashRadarLowestPointRp: 900000,
		RemainingDaysInCycle:   18,
	})

	if res.Conservative.TotalCapRp > res.Balanced.TotalCapRp ||
		res.Balanced.TotalCapRp > res.MaxSafe.TotalCapRp {
		t.Fatalf(
			"tiers must be ordered Conservative <= Balanced <= MaxSafe, got %d / %d / %d",
			res.Conservative.TotalCapRp,
			res.Balanced.TotalCapRp,
			res.MaxSafe.TotalCapRp,
		)
	}

	if res.Conservative.PostTripLowestCashRp < 0 || res.Balanced.PostTripLowestCashRp < 0 {
		t.Fatalf(
			"conservative and balanced lowest cash must stay >= 0, got %d / %d",
			res.Conservative.PostTripLowestCashRp,
			res.Balanced.PostTripLowestCashRp,
		)
	}

	var catSum int64
	for _, c := range res.Balanced.CategorySplit {
		catSum += c.AmountRp
	}
	if catSum != res.Balanced.VariableSpendCapRp {
		t.Fatalf(
			"category split sum %d must exactly match variableSpendCapRp %d",
			catSum,
			res.Balanced.VariableSpendCapRp,
		)
	}

	var daySum int64
	for _, d := range res.Balanced.DailyPlan {
		daySum += d.RecommendedCapRp
	}
	if daySum != res.Balanced.VariableSpendCapRp {
		t.Fatalf(
			"daily plan sum %d must exactly match variableSpendCapRp %d",
			daySum,
			res.Balanced.VariableSpendCapRp,
		)
	}
}

func TestOptimizeTripBudgetTightCycleProtectsSavings(t *testing.T) {
	res := OptimizeTripBudget(TripOptimizeRequest{
		EventType:              "DAY_OUTING",
		DurationDays:           1,
		PrepaidCommittedRp:     100000,
		CycleDiscretionaryRp:   0,
		CycleEmergencyBufferRp: 50000,
		CycleCoreSavingsRp:     1000000,
		CashRadarLowestPointRp: 20000,
		RemainingDaysInCycle:   10,
	})

	if res.Conservative.VariableSpendCapRp > 50000 {
		t.Fatalf("conservative cap %d must not invade core savings on tight cycle", res.Conservative.VariableSpendCapRp)
	}
	if res.MaxSafe.TotalCapRp < res.PrepaidCommittedRp {
		t.Fatalf("total cap %d must include prepaid commitment %d", res.MaxSafe.TotalCapRp, res.PrepaidCommittedRp)
	}
}

func TestOptimizeTripBudgetVacationWeekendWeighting(t *testing.T) {
	res := OptimizeTripBudget(TripOptimizeRequest{
		EventType:              "VACATION",
		DurationDays:           4,
		StartDateIso:           "2026-12-04",
		PrepaidCommittedRp:     500000,
		CycleDiscretionaryRp:   2000000,
		CycleEmergencyBufferRp: 300000,
		CycleCoreSavingsRp:     1000000,
		CashRadarLowestPointRp: 1800000,
		RemainingDaysInCycle:   20,
	})

	if len(res.Balanced.DailyPlan) != 4 {
		t.Fatalf("expected 4 daily caps, got %d", len(res.Balanced.DailyPlan))
	}
	if res.Balanced.DailyPlan[1].RecommendedCapRp < res.Balanced.DailyPlan[0].RecommendedCapRp {
		t.Fatalf("weekend day cap (%d) should be >= weekday arrival cap (%d)",
			res.Balanced.DailyPlan[1].RecommendedCapRp,
			res.Balanced.DailyPlan[0].RecommendedCapRp,
		)
	}
}
