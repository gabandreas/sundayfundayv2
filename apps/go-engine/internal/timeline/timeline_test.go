package timeline

import "testing"

func TestNov26SplitPaySimulation(t *testing.T) {
	// Golden Nov '26 vector: Net 5,904,000, PayLater 2,613,115, CC 734,256, Personal Debt 669,970
	res := SimulateTimeline(TimelineSimulateRequest{
		PeriodMonth:             11,
		PeriodYear:              2026,
		PaycheckDateIso:         "2026-11-27",
		PaycheckAmount:          5904000,
		ThrDateIso:              "2026-12-18",
		ThrAmount:               3500000,
		NextPaycheckDateIso:     "2026-12-28",
		NextPaycheckAmount:      5904000,
		TotalPaylaterDue:        2613115,
		PaylaterDueDateIso:      "2026-12-25",
		TotalCreditCardDue:      734256,
		CreditCardDueDateIso:    "2026-12-11",
		TotalPersonalDebtDue:    669970,
		PersonalDebtDueDateIso:  "2026-12-08",
		DailyLivingPool:         1500000,
		RoutineBillsPool:        300000,
		CoreSavingsTarget:       86659,
		SpaylaterEarlyPayAmount: 1500000,
	})
	if res.SpaylaterEarlyPayApplied != 1500000 {
		t.Fatalf("expected 1500000 early pay applied, got %d", res.SpaylaterEarlyPayApplied)
	}
	if res.SpaylaterRemainingAfterEarly != 1113115 {
		t.Fatalf("expected 1113115 remaining PayLater, got %d", res.SpaylaterRemainingAfterEarly)
	}
	if !res.BridgeSafe {
		t.Fatalf("expected safe 21-day bridge with 1.5M early pay, got %s (min=%d)", res.BridgeRiskMessage, res.PreThrBridgeMinimumBalance)
	}
}

func TestWalletGuardModes(t *testing.T) {
	surv := EvaluateWalletGuard(WalletGuardRequest{
		RemainingLivingCash:  1000000,
		ActualWalletBalance:  1200000,
		ReservedBillsTotal:   600000,
		DaysRemaining:        10,
		RemainingWeekdays:    8,
		RemainingWeekendDays: 2,
		WeekendMultiplier:    1.5,
	})
	if surv.FreeSpendableCash != 600000 || surv.GuardStatus != "SURVIVAL_GUARD" {
		t.Fatalf("expected SURVIVAL_GUARD, got %+v", surv)
	}

	opt := EvaluateWalletGuard(WalletGuardRequest{
		RemainingLivingCash:  1000000,
		ActualWalletBalance:  1650000,
		ReservedBillsTotal:   600000,
		DaysRemaining:        10,
		RemainingWeekdays:    8,
		RemainingWeekendDays: 2,
		WeekendMultiplier:    1.5,
	})
	if opt.GuardStatus != "OPTIMAL" || opt.FreeSpendableCash != 1050000 {
		t.Fatalf("expected OPTIMAL, got %+v", opt)
	}
}
