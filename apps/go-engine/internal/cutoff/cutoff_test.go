package cutoff

import "testing"

func TestLosslessSplit92kOver3(t *testing.T) {
	slices, total := ComputeSlices(92000, 0, 3, AmountModePrincipalSplit)
	if total != 92000 {
		t.Fatalf("expected total 92000, got %d", total)
	}
	if len(slices) != 3 {
		t.Fatalf("expected 3 slices, got %d", len(slices))
	}
	if slices[0] != 30667 || slices[1] != 30667 || slices[2] != 30666 {
		t.Fatalf("expected [30667 30667 30666], got %v", slices)
	}
	var sum int64
	for _, s := range slices {
		sum += s
	}
	if sum != 92000 {
		t.Fatalf("lossy sum: %d", sum)
	}
}

func TestSPayLaterCutoffRouting(t *testing.T) {
	// Nov 14 -> before 15th cutoff -> due Nov 25 -> Period NOV '26 (11/2026)
	resBefore := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 75000,
		TenorMonths:     1,
		PurchaseDate:    "2026-11-14",
	})
	if resBefore.CrossedCutoff {
		t.Fatalf("Nov 14 should not cross 15th cutoff")
	}
	if resBefore.StartPeriodMonth != 11 || resBefore.StartPeriodYear != 2026 || resBefore.FirstDueDateIso != "2026-11-25" {
		t.Fatalf("unexpected routing before cutoff: period %d/%d due %s", resBefore.StartPeriodMonth, resBefore.StartPeriodYear, resBefore.FirstDueDateIso)
	}

	// Nov 16 -> on/after 15th cutoff -> due Dec 25 -> Period DEC '26 (12/2026)
	resAfter := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 34200,
		TenorMonths:     1,
		PurchaseDate:    "2026-11-16",
	})
	if !resAfter.CrossedCutoff {
		t.Fatalf("Nov 16 should cross 15th cutoff")
	}
	if resAfter.StartPeriodMonth != 12 || resAfter.StartPeriodYear != 2026 || resAfter.FirstDueDateIso != "2026-12-25" {
		t.Fatalf("unexpected routing after cutoff: period %d/%d due %s", resAfter.StartPeriodMonth, resAfter.StartPeriodYear, resAfter.FirstDueDateIso)
	}
}

func TestCreditCardCutoffRouting(t *testing.T) {
	// Nov 15 -> <= 20th -> due Dec 11 -> DEC '26 (12/2026)
	resBefore := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentCreditCard,
		PrincipalAmount: 77000,
		TenorMonths:     1,
		PurchaseDate:    "2026-11-15",
	})
	if resBefore.CrossedCutoff || resBefore.StartPeriodMonth != 12 || resBefore.FirstDueDateIso != "2026-12-11" {
		t.Fatalf("unexpected Nov 15 CC route: %+v", resBefore)
	}

	// Nov 21 -> > 20th -> due Jan 11 -> JAN '27 (01/2027)
	resAfter := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentCreditCard,
		PrincipalAmount: 350000,
		TenorMonths:     1,
		PurchaseDate:    "2026-11-21",
	})
	if !resAfter.CrossedCutoff || resAfter.StartPeriodMonth != 1 || resAfter.StartPeriodYear != 2027 || resAfter.FirstDueDateIso != "2027-01-11" {
		t.Fatalf("unexpected Nov 21 CC route: %+v", resAfter)
	}
}

func TestWaitPastCutoffAdvice(t *testing.T) {
	res := SimulateCutoff(CutoffRequest{
		Instrument:               InstrumentCreditCard,
		PrincipalAmount:          500000,
		TenorMonths:              1,
		PurchaseDate:             "2026-11-18",
		PeriodNetIncome:          5904000,
		CurrentPeriodObligations: 4017341,
		NextPeriodNetIncome:      9840917,
		NextPeriodObligations:    3171115,
		SafeHeadroom:             86659,
	})
	if res.Verdict != "WAIT_PAST_CUTOFF" {
		t.Fatalf("expected WAIT_PAST_CUTOFF, got %s (%s)", res.Verdict, res.Advice)
	}
}
