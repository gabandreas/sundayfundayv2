package paycycle

import "testing"

func TestComputePaycycleHorizonWeekendShift(t *testing.T) {
	// Nov 2026: Nov 27 2026 is Friday; Dec 27 2026 is Sunday -> shifts to Dec 25 Friday
	res := ComputePaycycleHorizon(HorizonRequest{
		Month:                11,
		Year:                 2026,
		AnchorDay:            27,
		ShiftWeekendToFriday: true,
		WeekendMultiplier:    1.5,
		RemainingBudgetRp:    1500000,
		ReferenceDateIso:     "2026-11-27",
	})
	if res.PaydayIso != "2026-11-27" {
		t.Fatalf("expected Nov 27 payday, got %s", res.PaydayIso)
	}
	if res.NextPaydayIso != "2026-12-25" {
		t.Fatalf("expected Dec 25 Friday shift for Dec 27 Sunday, got %s", res.NextPaydayIso)
	}
}

func TestComputePaycycleHorizonWeighted(t *testing.T) {
	req := HorizonRequest{
		Month:                11,
		Year:                 2026,
		AnchorDay:            27,
		ShiftWeekendToFriday: true,
		ExplicitStartIso:     "2026-11-27",
		ExplicitNextPayday:   "2026-12-28",
		WeekendMultiplier:    1.5,
		RemainingBudgetRp:    1500000,
		ReferenceDateIso:     "2026-11-27",
	}
	res := ComputePaycycleHorizon(req)
	if res.TotalCycleDays != 31 {
		t.Fatalf("expected 31 days Nov 27 -> Dec 28, got %d", res.TotalCycleDays)
	}
	if res.MaturityMonth != 12 || res.MaturityYear != 2026 {
		t.Fatalf("expected maturity 12/2026, got %02d/%d", res.MaturityMonth, res.MaturityYear)
	}
	if res.WeekendSafeRateRp < res.WeekdaySafeRateRp {
		t.Fatalf("expected weekend rate >= weekday rate")
	}
}

func TestRouteTransactionToPaycycleCutoffs(t *testing.T) {
	// SPayLater Nov 14 -> matures Nov 25 -> funded by Oct 2026 (10/2026)
	plBefore := RouteTransactionToPaycycle(RouteTxRequest{
		TxDateIso:      "2026-11-14",
		InstrumentType: "PAYLATER",
	})
	if plBefore.TargetPeriodCode != "10/2026" || plBefore.CrossedCutoff {
		t.Fatalf("expected 10/2026 pre-cutoff for Nov 14, got %+v", plBefore)
	}

	// SPayLater Nov 15 -> matures Dec 25 -> funded by Nov 2026 (11/2026)
	plAfter := RouteTransactionToPaycycle(RouteTxRequest{
		TxDateIso:      "2026-11-15",
		InstrumentType: "PAYLATER",
	})
	if plAfter.TargetPeriodCode != "11/2026" || !plAfter.CrossedCutoff {
		t.Fatalf("expected 11/2026 post-cutoff for Nov 15, got %+v", plAfter)
	}

	// CC Nov 21 -> crossed 20th cutoff -> funded by Dec 2026 (12/2026)
	ccAfter := RouteTransactionToPaycycle(RouteTxRequest{
		TxDateIso:      "2026-11-21",
		InstrumentType: "CREDIT_CARD",
	})
	if ccAfter.TargetPeriodCode != "12/2026" || !ccAfter.CrossedCutoff {
		t.Fatalf("expected 12/2026 post-cutoff for Nov 21 CC, got %+v", ccAfter)
	}
}

func TestTwoStageCorporatePaycycleNov2026(t *testing.T) {
	// Real Nov 2026 corporate payroll: Payslip drops Wed Nov 25 -> +2 working days review (Thu 26, Fri 27) -> Payday Fri Nov 27
	res := ComputePaycycleHorizon(HorizonRequest{
		Month:                11,
		Year:                 2026,
		PayslipAnchorDay:     25,
		PayslipShiftRule:     "SHIFT_PREVIOUS_FRIDAY",
		ReviewLagWorkingDays: 2,
		HolidaysIso:          []string{"2026-12-25"},
		WeekendMultiplier:    1.5,
		RemainingBudgetRp:    1500000,
		ReferenceDateIso:     "2026-11-28",
	})
	if res.PayslipDropIso != "2026-11-25" {
		t.Fatalf("expected Nov 25 payslip drop, got %s", res.PayslipDropIso)
	}
	if res.PaydayIso != "2026-11-27" {
		t.Fatalf("expected Nov 27 payday (+2 working days), got %s", res.PaydayIso)
	}
	// Oct 2026: Oct 25 is Sunday -> SHIFT_PREVIOUS_FRIDAY gives Fri Oct 23 -> +2 working days (Mon 26, Tue 27) -> Tue Oct 27
	oct := ComputePaycycleHorizon(HorizonRequest{
		Month:                10,
		Year:                 2026,
		PayslipAnchorDay:     25,
		PayslipShiftRule:     "SHIFT_PREVIOUS_FRIDAY",
		ReviewLagWorkingDays: 2,
		ExplicitStartIso:     "2026-10-28",
		OverrideNote:         "Corporate Oct Adjustment",
	})
	if oct.PayslipDropIso != "2026-10-23" {
		t.Fatalf("expected Oct 23 Friday shift for Sun Oct 25 payslip, got %s", oct.PayslipDropIso)
	}
	if oct.PaydayIso != "2026-10-28" || !oct.OverrideApplied {
		t.Fatalf("expected explicit Oct 28 override applied, got %+v", oct)
	}
}

func TestHorizonThreeTemporalStatesPreActiveCompleted(t *testing.T) {
	// 11/2026: Payslip Nov 25 -> Payday Nov 27 -> Next Payday Dec 28 (31 days)
	pre := ComputePaycycleHorizon(HorizonRequest{
		Month:                11,
		Year:                 2026,
		PayslipAnchorDay:     25,
		PayslipShiftRule:     "SHIFT_PREVIOUS_FRIDAY",
		ReviewLagWorkingDays: 2,
		ExplicitNextPayday:   "2026-12-28",
		WeekendMultiplier:    1.5,
		RemainingBudgetRp:    1416659,
		ReferenceDateIso:     "2026-11-22",
	})
	if pre.CycleTemporalState != "PRE_PAYDAY" {
		t.Fatalf("expected PRE_PAYDAY on Nov 22 before Nov 27 payday, got %q", pre.CycleTemporalState)
	}
	if pre.DaysUntilCycleStart != 5 {
		t.Fatalf("expected 5 days until Nov 27 payday, got %d", pre.DaysUntilCycleStart)
	}
	if pre.CurrentDayIndex != 0 {
		t.Fatalf("expected CurrentDayIndex=0 in PRE_PAYDAY, got %d", pre.CurrentDayIndex)
	}

	active := ComputePaycycleHorizon(HorizonRequest{
		Month:                11,
		Year:                 2026,
		PayslipAnchorDay:     25,
		PayslipShiftRule:     "SHIFT_PREVIOUS_FRIDAY",
		ReviewLagWorkingDays: 2,
		ExplicitNextPayday:   "2026-12-28",
		WeekendMultiplier:    1.5,
		RemainingBudgetRp:    1416659,
		ReferenceDateIso:     "2026-12-01",
	})
	if active.CycleTemporalState != "ACTIVE" {
		t.Fatalf("expected ACTIVE on Dec 1, got %q", active.CycleTemporalState)
	}
	if active.DaysUntilCycleStart != 0 || active.CurrentDayIndex <= 0 {
		t.Fatalf("expected DaysUntilCycleStart=0 and positive CurrentDayIndex in ACTIVE, got %d / %d", active.DaysUntilCycleStart, active.CurrentDayIndex)
	}

	done := ComputePaycycleHorizon(HorizonRequest{
		Month:                11,
		Year:                 2026,
		PayslipAnchorDay:     25,
		PayslipShiftRule:     "SHIFT_PREVIOUS_FRIDAY",
		ReviewLagWorkingDays: 2,
		ExplicitNextPayday:   "2026-12-28",
		WeekendMultiplier:    1.5,
		RemainingBudgetRp:    1416659,
		ReferenceDateIso:     "2026-12-30",
	})
	if done.CycleTemporalState != "COMPLETED" {
		t.Fatalf("expected COMPLETED on Dec 30, got %q", done.CycleTemporalState)
	}
	if done.RemainingDays != 0 || done.CurrentDayIndex != done.TotalCycleDays {
		t.Fatalf("expected RemainingDays=0 and CurrentDayIndex==TotalCycleDays in COMPLETED, got rem=%d idx=%d total=%d", done.RemainingDays, done.CurrentDayIndex, done.TotalCycleDays)
	}
}
