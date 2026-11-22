package cutoff

import (
	"strings"
	"testing"
)

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
	// 1. 30-day Nov (30 - 15 = 15th cutoff): Nov 15 -> day <= 15 -> due Dec 25 -> Period DEC '26 (12/2026)
	resNov15 := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 75000,
		TenorMonths:     1,
		PurchaseDate:    "2026-11-15",
	})
	if resNov15.CrossedCutoff || resNov15.CutoffDay != 15 {
		t.Fatalf("Nov 15 should be on/before 15th cutoff (got crossed=%v cutoff=%d)", resNov15.CrossedCutoff, resNov15.CutoffDay)
	}
	if resNov15.StartPeriodMonth != 12 || resNov15.StartPeriodYear != 2026 || resNov15.FirstDueDateIso != "2026-12-25" {
		t.Fatalf("unexpected routing for Nov 15: period %d/%d due %s", resNov15.StartPeriodMonth, resNov15.StartPeriodYear, resNov15.FirstDueDateIso)
	}

	// 2. 30-day Nov: Nov 16 -> day > 15 -> crosses cutoff -> due Jan 25 -> Period JAN '27 (01/2027)
	resNov16 := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 34200,
		TenorMonths:     1,
		PurchaseDate:    "2026-11-16",
	})
	if !resNov16.CrossedCutoff || resNov16.CutoffDay != 15 {
		t.Fatalf("Nov 16 should cross 15th cutoff")
	}
	if resNov16.StartPeriodMonth != 1 || resNov16.StartPeriodYear != 2027 || resNov16.FirstDueDateIso != "2027-01-25" {
		t.Fatalf("unexpected routing after Nov 15 cutoff: period %d/%d due %s", resNov16.StartPeriodMonth, resNov16.StartPeriodYear, resNov16.FirstDueDateIso)
	}

	// 3. 31-day Oct (31 - 15 = 16th cutoff): Oct 16 -> day <= 16 -> due Nov 25 (11/2026); Oct 17 -> due Dec 25 (12/2026)
	resOct16 := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 100000,
		TenorMonths:     1,
		PurchaseDate:    "2026-10-16",
	})
	if resOct16.CrossedCutoff || resOct16.CutoffDay != 16 || resOct16.StartPeriodMonth != 11 || resOct16.FirstDueDateIso != "2026-11-25" {
		t.Fatalf("Oct 16 should respect 16th cutoff and bill 2026-11-25, got %+v", resOct16)
	}
	resOct17 := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 100000,
		TenorMonths:     1,
		PurchaseDate:    "2026-10-17",
	})
	if !resOct17.CrossedCutoff || resOct17.CutoffDay != 16 || resOct17.StartPeriodMonth != 12 || resOct17.FirstDueDateIso != "2026-12-25" {
		t.Fatalf("Oct 17 should cross 16th cutoff and bill 2026-12-25, got %+v", resOct17)
	}

	// 4. 28-day Feb 2027 (28 - 15 = 13th cutoff) & 29-day leap Feb 2028 (29 - 15 = 14th cutoff)
	resFeb27 := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 100000,
		TenorMonths:     1,
		PurchaseDate:    "2027-02-14",
	})
	if !resFeb27.CrossedCutoff || resFeb27.CutoffDay != 13 || resFeb27.StartPeriodMonth != 4 {
		t.Fatalf("Feb 14 2027 should cross 13th cutoff into 04/2027, got %+v", resFeb27)
	}
	resFeb28 := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 100000,
		TenorMonths:     1,
		PurchaseDate:    "2028-02-14",
	})
	if resFeb28.CrossedCutoff || resFeb28.CutoffDay != 14 || resFeb28.StartPeriodMonth != 3 {
		t.Fatalf("Feb 14 2028 (leap year) should NOT cross 14th cutoff, got %+v", resFeb28)
	}
}

func TestCreditCardCutoffRouting(t *testing.T) {
	// Bank Permata CC: statement closes 25th, due 11th of following month
	// 1. Nov 25 -> <= 25th -> due Dec 11 -> DEC '26 (12/2026)
	resBefore := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentCreditCard,
		PrincipalAmount: 77000,
		TenorMonths:     1,
		PurchaseDate:    "2026-11-25",
	})
	if resBefore.CrossedCutoff || resBefore.CutoffDay != 25 || resBefore.DueDay != 11 || resBefore.StartPeriodMonth != 12 || resBefore.FirstDueDateIso != "2026-12-11" {
		t.Fatalf("unexpected Nov 25 Permata CC route: %+v", resBefore)
	}

	// 2. Nov 26 -> >= 26th -> crosses 25th cutoff -> due Jan 11 -> JAN '27 (01/2027)
	resAfter := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentCreditCard,
		PrincipalAmount: 350000,
		TenorMonths:     1,
		PurchaseDate:    "2026-11-26",
	})
	if !resAfter.CrossedCutoff || resAfter.CutoffDay != 25 || resAfter.StartPeriodMonth != 1 || resAfter.StartPeriodYear != 2027 || resAfter.FirstDueDateIso != "2027-01-11" {
		t.Fatalf("unexpected Nov 26 Permata CC route: %+v", resAfter)
	}

	// 3. Weekend 11th due date (2027-03-10 -> due 2027-04-11 Sunday -> H-1 working day Friday 2027-04-09 advisory)
	resWeekendDue := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentCreditCard,
		PrincipalAmount: 250000,
		TenorMonths:     1,
		PurchaseDate:    "2027-03-10",
	})
	if resWeekendDue.FirstDueDateIso != "2027-04-11" || !strings.Contains(resWeekendDue.Advice, "2027-04-09") {
		t.Fatalf("expected H-1 working day advisory (2027-04-09) when 11th falls on Sunday 2027-04-11, got: %s", resWeekendDue.Advice)
	}
}

func TestWaitPastCutoffAdvice(t *testing.T) {
	res := SimulateCutoff(CutoffRequest{
		Instrument:               InstrumentCreditCard,
		PrincipalAmount:          500000,
		TenorMonths:              1,
		PurchaseDate:             "2026-11-22",
		PeriodNetIncome:          5904000,
		CurrentPeriodObligations: 4017341,
		NextPeriodNetIncome:      9840917,
		NextPeriodObligations:    3171115,
		SafeHeadroom:             86659,
	})
	if res.Verdict != "WAIT_PAST_CUTOFF" {
		t.Fatalf("expected WAIT_PAST_CUTOFF on Nov 22 (3d before 25th Permata CC cutoff), got %s (%s)", res.Verdict, res.Advice)
	}
}
