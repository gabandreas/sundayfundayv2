package tripbudget

import (
	"strings"
	"testing"
)

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

func TestOptimizeTripBudgetShortfallPreservesTiersAndHeadroom(t *testing.T) {
	// Reproduces Nov 2026 condition where CashRadarLowestPointRp is -108633 and Discretionary is 250000:
	// Conservative/Balanced must derive from post-shortfall discretionary pool (250000 - 108633 = 141367),
	// NOT collapse to 0 / 0 / 250000.
	res := OptimizeTripBudget(TripOptimizeRequest{
		EventType:              "VACATION",
		DurationDays:           2,
		StartDateIso:           "2026-12-05",
		PrepaidCommittedRp:     0,
		CycleDiscretionaryRp:   250000,
		CycleEmergencyBufferRp: 0,
		CycleCoreSavingsRp:     6341,
		CashRadarLowestPointRp: -108633,
		RemainingDaysInCycle:   2,
	})

	if res.AvailableHeadroomRp != 141367 {
		t.Fatalf("expected post-shortfall headroom 141367, got %d", res.AvailableHeadroomRp)
	}
	if res.Balanced.VariableSpendCapRp != 141367 {
		t.Fatalf("expected balanced variable cap 141367, got %d", res.Balanced.VariableSpendCapRp)
	}
	if res.Conservative.VariableSpendCapRp != 70684 {
		t.Fatalf("expected conservative 50%% of tight pool (70684), got %d", res.Conservative.VariableSpendCapRp)
	}
	if res.MaxSafe.VariableSpendCapRp != 250000 {
		t.Fatalf("expected max safe cap 250000, got %d", res.MaxSafe.VariableSpendCapRp)
	}
	if res.Conservative.SavingsSafe || res.Balanced.SavingsSafe {
		t.Fatalf("expected SavingsSafe=false during shortfall cycle")
	}
	if !strings.Contains(res.Conservative.Guidance, "Rp 108.633") || strings.Contains(res.Conservative.Guidance, "Rp 108633") {
		t.Fatalf("expected dot-formatted Rp 108.633 in shortfall guidance, got %q", res.Conservative.Guidance)
	}
	if !strings.Contains(res.Balanced.Guidance, "Rp 108.633") || strings.Contains(res.Balanced.Guidance, "Rp 108633") {
		t.Fatalf("expected dot-formatted Rp 108.633 in balanced shortfall guidance, got %q", res.Balanced.Guidance)
	}
}

func TestOptimizeTripBudgetCustomCategoryAndWeekendWeights(t *testing.T) {
	res := OptimizeTripBudget(TripOptimizeRequest{
		EventType:              "DINING_GATHERING",
		DurationDays:           2,
		StartDateIso:           "2026-12-04",
		PrepaidCommittedRp:     0,
		CycleDiscretionaryRp:   1000000,
		CycleEmergencyBufferRp: 200000,
		CycleCoreSavingsRp:     1000000,
		CashRadarLowestPointRp: 1200000,
		RemainingDaysInCycle:   15,
		WeekendWeightPct:       160,
		CustomCategoryWeights: []CategoryWeightInput{
			{Code: "FOOD_DRINK", Label: "Food & Drinks", Pct: 60},
			{Code: "LOCAL_TRANSPORT", Label: "Local Transport", Pct: 15},
			{Code: "ACTIVITIES", Label: "Activities & Hosting", Pct: 15},
			{Code: "CONTINGENCY", Label: "Contingency", Pct: 10},
		},
	})

	if len(res.Balanced.CategorySplit) != 4 || res.Balanced.CategorySplit[0].SharePct != 60 {
		t.Fatalf("expected custom 60%% Food & Drinks split, got %+v", res.Balanced.CategorySplit)
	}
	var sum int64
	for _, c := range res.Balanced.CategorySplit {
		sum += c.AmountRp
	}
	if sum != res.Balanced.VariableSpendCapRp {
		t.Fatalf("custom category split sum %d != variable cap %d", sum, res.Balanced.VariableSpendCapRp)
	}
	if res.Balanced.DailyPlan[1].RecommendedCapRp <= res.Balanced.DailyPlan[0].RecommendedCapRp {
		t.Fatalf("weekend multiplier 160%% should give Saturday (%d) > Friday (%d)",
			res.Balanced.DailyPlan[1].RecommendedCapRp,
			res.Balanced.DailyPlan[0].RecommendedCapRp,
		)
	}
}
