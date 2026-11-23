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
	// User-confirmed Shopee SPayLater H-15 convention:
	// cutoffFormula = DAYS_IN_MONTH - 15 (15th in 30d, 16th in 31d, 13th in non-leap Feb, 14th in leap Feb)
	// >= cutoff rolls +1 month; < cutoff stays in current maturity month (0 offset)

	// 1. 30-day Nov (cutoff = 15): Nov 14 (< 15) -> 11/2026 (due Nov 25); Nov 15 & Nov 23 (>= 15) -> 12/2026 (due Dec 25)
	resNov14 := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 75000,
		TenorMonths:     1,
		PurchaseDate:    "2026-11-14",
	})
	if resNov14.CrossedCutoff || resNov14.CutoffDay != 15 || resNov14.StartPeriodMonth != 11 || resNov14.StartPeriodYear != 2026 || resNov14.FirstDueDateIso != "2026-11-25" {
		t.Fatalf("Nov 14 (< 15) should stay in 11/2026 (due 2026-11-25), got %+v", resNov14)
	}

	resNov15 := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 75000,
		TenorMonths:     1,
		PurchaseDate:    "2026-11-15",
	})
	if !resNov15.CrossedCutoff || resNov15.CutoffDay != 15 || resNov15.StartPeriodMonth != 12 || resNov15.FirstDueDateIso != "2026-12-25" {
		t.Fatalf("Nov 15 (>= 15) should cross cutoff into 12/2026 (due 2026-12-25), got %+v", resNov15)
	}

	resNov23 := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 52000,
		TenorMonths:     1,
		PurchaseDate:    "2026-11-23",
	})
	if !resNov23.CrossedCutoff || resNov23.CutoffDay != 15 || resNov23.StartPeriodMonth != 12 || resNov23.StartPeriodYear != 2026 || resNov23.FirstDueDateIso != "2026-12-25" {
		t.Fatalf("Nov 23 (>= 15) must route to 12/2026 (due 2026-12-25), got %+v", resNov23)
	}

	// 2. 31-day Dec (31 - 15 = 16th cutoff): Dec 15 (< 16) -> 12/2026; Dec 16 (>= 16) -> 01/2027
	resDec15 := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 100000,
		TenorMonths:     1,
		PurchaseDate:    "2026-12-15",
	})
	if resDec15.CrossedCutoff || resDec15.CutoffDay != 16 || resDec15.StartPeriodMonth != 12 || resDec15.FirstDueDateIso != "2026-12-25" {
		t.Fatalf("Dec 15 (< 16) should stay in 12/2026 (due 2026-12-25), got %+v", resDec15)
	}
	resDec16 := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 100000,
		TenorMonths:     1,
		PurchaseDate:    "2026-12-16",
	})
	if !resDec16.CrossedCutoff || resDec16.CutoffDay != 16 || resDec16.StartPeriodMonth != 1 || resDec16.StartPeriodYear != 2027 || resDec16.FirstDueDateIso != "2027-01-25" {
		t.Fatalf("Dec 16 (>= 16) should cross into 01/2027 (due 2027-01-25), got %+v", resDec16)
	}

	// 3. 28-day Feb 2027 (28 - 15 = 13th cutoff) & 29-day leap Feb 2028 (29 - 15 = 14th cutoff)
	resFeb27Pre := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 100000,
		TenorMonths:     1,
		PurchaseDate:    "2027-02-12",
	})
	if resFeb27Pre.CrossedCutoff || resFeb27Pre.CutoffDay != 13 || resFeb27Pre.StartPeriodMonth != 2 || resFeb27Pre.FirstDueDateIso != "2027-02-25" {
		t.Fatalf("Feb 12 2027 (< 13) should stay 02/2027 (due 2027-02-25), got %+v", resFeb27Pre)
	}
	resFeb27Post := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 100000,
		TenorMonths:     1,
		PurchaseDate:    "2027-02-13",
	})
	if !resFeb27Post.CrossedCutoff || resFeb27Post.CutoffDay != 13 || resFeb27Post.StartPeriodMonth != 3 || resFeb27Post.FirstDueDateIso != "2027-03-25" {
		t.Fatalf("Feb 13 2027 (>= 13) should cross 13th cutoff into 03/2027, got %+v", resFeb27Post)
	}
	resFeb28Leap := SimulateCutoff(CutoffRequest{
		Instrument:      InstrumentSPayLater,
		PrincipalAmount: 100000,
		TenorMonths:     1,
		PurchaseDate:    "2028-02-13",
	})
	if resFeb28Leap.CrossedCutoff || resFeb28Leap.CutoffDay != 14 || resFeb28Leap.StartPeriodMonth != 2 {
		t.Fatalf("Feb 13 2028 (leap year, < 14) should stay in 02/2028, got %+v", resFeb28Leap)
	}

	// 4. Modular UI CutoffFormula + DueDay 31 clamping in Feb 2027 (28) & Leap Feb 2028 (29)
	preOff := 0
	postOff := 1
	incFalse := false
	customRes := SimulateCutoff(CutoffRequest{
		Instrument:              InstrumentSPayLater,
		PrincipalAmount:         200000,
		TenorMonths:             1,
		PurchaseDate:            "2027-01-20",
		CutoffFormula:           "MIN(20, DAYS_IN_MONTH - 8)",
		CutoffBoundaryInclusive: &incFalse,
		PreCutoffOffsetMonths:   &preOff,
		PostCutoffOffsetMonths:  &postOff,
		DueDayOverride:          31,
	})
	if customRes.CutoffDay != 20 || customRes.CrossedCutoff || customRes.StartPeriodMonth != 1 || customRes.FirstDueDateIso != "2027-01-31" {
		t.Fatalf("custom formula non-inclusive day 20 <= 20 should stay 01/2027, got %+v", customRes)
	}
	customFeb := SimulateCutoff(CutoffRequest{
		Instrument:              InstrumentSPayLater,
		PrincipalAmount:         200000,
		TenorMonths:             1,
		PurchaseDate:            "2027-02-15",
		CutoffFormula:           "MIN(20, DAYS_IN_MONTH - 8)",
		CutoffBoundaryInclusive: &incFalse,
		PreCutoffOffsetMonths:   &preOff,
		PostCutoffOffsetMonths:  &postOff,
		DueDayOverride:          31,
	})
	if customFeb.CutoffDay != 20 || customFeb.FirstDueDateIso != "2027-02-28" {
		t.Fatalf("Feb 2027 should compute cutoff=20 and clamp dueDay 31 -> 2027-02-28, got %+v", customFeb)
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
