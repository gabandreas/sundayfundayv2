package paycycle

import "testing"

func TestComputePaycycleHorizonWeekendShift(t *testing.T) {
	// Period 12/2026 (Dec 2026 consumption & maturity): funded by Nov 27 2026 Friday; ends before Dec 25 2026 Friday (shifted from Dec 27 Sunday)
	res := ComputePaycycleHorizon(HorizonRequest{
		Month:                12,
		Year:                 2026,
		AnchorDay:            27,
		ShiftWeekendToFriday: true,
		WeekendMultiplier:    1.5,
		RemainingBudgetRp:    1500000,
		ReferenceDateIso:     "2026-11-27",
	})
	if res.PaydayIso != "2026-11-27" {
		t.Fatalf("expected Nov 27 payday funding 12/2026, got %s", res.PaydayIso)
	}
	if res.NextPaydayIso != "2026-12-25" {
		t.Fatalf("expected Dec 25 Friday shift for Dec 27 Sunday, got %s", res.NextPaydayIso)
	}
	if res.MaturityMonth != 12 || res.MaturityYear != 2026 {
		t.Fatalf("expected maturity 12/2026, got %02d/%d", res.MaturityMonth, res.MaturityYear)
	}
}

func TestComputePaycycleHorizonWeighted(t *testing.T) {
	req := HorizonRequest{
		Month:                12,
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
	// SPayLater Nov 14 -> matures Nov 25 -> Period 11/2026 (Nov 2026)
	plBefore := RouteTransactionToPaycycle(RouteTxRequest{
		TxDateIso:      "2026-11-14",
		InstrumentType: "PAYLATER",
	})
	if plBefore.TargetPeriodCode != "11/2026" || plBefore.CrossedCutoff || plBefore.MaturityMonth != 11 {
		t.Fatalf("expected 11/2026 pre-cutoff for Nov 14, got %+v", plBefore)
	}

	// SPayLater Nov 15 -> matures Dec 25 -> Period 12/2026 (Dec 2026)
	plAfter := RouteTransactionToPaycycle(RouteTxRequest{
		TxDateIso:      "2026-11-15",
		InstrumentType: "PAYLATER",
	})
	if plAfter.TargetPeriodCode != "12/2026" || !plAfter.CrossedCutoff || plAfter.MaturityMonth != 12 {
		t.Fatalf("expected 12/2026 post-cutoff for Nov 15, got %+v", plAfter)
	}

	// CC Nov 21 -> crossed 20th cutoff -> matures Jan 11 -> Period 01/2027 (Jan 2027)
	ccAfter := RouteTransactionToPaycycle(RouteTxRequest{
		TxDateIso:      "2026-11-21",
		InstrumentType: "CREDIT_CARD",
	})
	if ccAfter.TargetPeriodCode != "01/2027" || !ccAfter.CrossedCutoff || ccAfter.MaturityMonth != 1 || ccAfter.MaturityYear != 2027 {
		t.Fatalf("expected 01/2027 post-cutoff for Nov 21 CC, got %+v", ccAfter)
	}

	// Cash Nov 18 (< 27th payday) -> Period 11/2026 (28 Oct - 26 Nov)
	cashNov := RouteTransactionToPaycycle(RouteTxRequest{
		TxDateIso:      "2026-11-18",
		InstrumentType: "CASH",
		AnchorDay:      27,
	})
	if cashNov.TargetPeriodCode != "11/2026" {
		t.Fatalf("expected 11/2026 for Cash Nov 18, got %+v", cashNov)
	}
}

func TestTwoStageCorporatePaycycleNov2026(t *testing.T) {
	// Period 12/2026 (Dec 2026): funded by Nov 2026 corporate payroll (Payslip Wed Nov 25 -> +2 working days -> Payday Fri Nov 27)
	res := ComputePaycycleHorizon(HorizonRequest{
		Month:                12,
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
		t.Fatalf("expected Nov 25 payslip drop for 12/2026, got %s", res.PayslipDropIso)
	}
	if res.PaydayIso != "2026-11-27" {
		t.Fatalf("expected Nov 27 payday (+2 working days) for 12/2026, got %s", res.PaydayIso)
	}
	// Period 11/2026 (Nov 2026 — ACTIVE on Nov 22): funded by Oct 2026 payroll (Oct 25 Sun -> Fri Oct 23 -> explicit override Oct 28 -> Next Payday Nov 27)
	nov := ComputePaycycleHorizon(HorizonRequest{
		Month:                11,
		Year:                 2026,
		PayslipAnchorDay:     25,
		PayslipShiftRule:     "SHIFT_PREVIOUS_FRIDAY",
		ReviewLagWorkingDays: 2,
		ExplicitStartIso:     "2026-10-28",
		OverrideNote:         "Corporate Oct Adjustment",
		ReferenceDateIso:     "2026-11-22",
	})
	if nov.PayslipDropIso != "2026-10-23" {
		t.Fatalf("expected Oct 23 Friday shift for Sun Oct 25 payslip funding 11/2026, got %s", nov.PayslipDropIso)
	}
	if nov.PaydayIso != "2026-10-28" || !nov.OverrideApplied || nov.NextPaydayIso != "2026-11-27" {
		t.Fatalf("expected explicit Oct 28 -> Nov 27 for 11/2026, got %+v", nov)
	}
	if nov.CycleTemporalState != "ACTIVE" || nov.CurrentDayIndex != 26 || nov.TotalCycleDays != 30 || nov.RemainingDays != 5 {
		t.Fatalf("expected 11/2026 ACTIVE Day 26 of 30 (5 days remaining) on Nov 22, got %+v", nov)
	}
}

func TestHorizonThreeTemporalStatesPreActiveCompleted(t *testing.T) {
	// Period 12/2026 (Dec 2026): Payslip Nov 25 -> Payday Nov 27 -> Next Payday Dec 28 (31 days)
	pre := ComputePaycycleHorizon(HorizonRequest{
		Month:                12,
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
		Month:                12,
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
		Month:                12,
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
