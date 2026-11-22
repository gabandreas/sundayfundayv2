package timeline

import "testing"

func TestBuildCashRadarDec2026(t *testing.T) {
	res := BuildCashRadar(CashRadarRequest{
		PeriodMonth:         12,
		PeriodYear:          2026,
		PaydayDateIso:       "2026-11-27",
		LivingEndDateIso:    "2026-12-27",
		NextPaydayIso:       "2026-12-28",
		PaycheckAmountRp:    5904000,
		ThrAmountRp:         0,
		DailyLivingPoolRp:   1416659,
		RoutineBillsPoolRp:  300000,
		CoreSavingsTargetRp: 0,
		PaylaterDueRp:       2783115,
		CreditCardDueRp:     734256,
		PersonalDebtItems: []CashRadarItemInput{
			{DateIso: "2026-12-08", Title: "SPinjam Rp 200k — Oct 23 Loan", Category: "PERSONAL_DEBT", AmountRp: 73387, DueDay: 8, SliceLabel: "2/3", IsFinalSlice: false},
			{DateIso: "2026-12-17", Title: "SPinjam Bridge Rp 500k — Nov 17 Loan", Category: "PERSONAL_DEBT", AmountRp: 186432, DueDay: 17, SliceLabel: "1/3", IsFinalSlice: false},
			{DateIso: "2026-12-23", Title: "SPinjam Rp 900k — Nov 08 Loan", Category: "PERSONAL_DEBT", AmountRp: 335578, DueDay: 23, SliceLabel: "1/3", IsFinalSlice: false},
			{DateIso: "2026-12-24", Title: "SPinjam Rp 200k — Oct 24 Loan", Category: "PERSONAL_DEBT", AmountRp: 74573, DueDay: 24, SliceLabel: "2/3", IsFinalSlice: false},
		},
		HolidaysIso:      []string{"2026-12-25", "2027-01-01"},
		ReferenceDateIso: "2026-11-22",
	})

	if res.PaydayInflowsRp != 5904000 {
		t.Fatalf("expected payday inflows 5904000, got %d", res.PaydayInflowsRp)
	}
	if res.TotalScheduledBillsRp != 4487341 {
		t.Fatalf("expected total scheduled bills 4487341 (debt 4187341 + routine 300000), got %d", res.TotalScheduledBillsRp)
	}
	if len(res.DailySeries) < 31 {
		t.Fatalf("expected >= 31 daily points across cycle + month, got %d", len(res.DailySeries))
	}

	hasDec16SpayCutoff := false
	hasDec25PermataCutoff := false
	hasDec11PermataDue := false
	for _, ev := range res.Events {
		if ev.Category == "CUTOFF" && ev.DateIso == "2026-12-16" {
			hasDec16SpayCutoff = true
		}
		if ev.Category == "CUTOFF" && ev.DateIso == "2026-12-25" {
			hasDec25PermataCutoff = true
		}
		if ev.Category == "CREDIT_CARD" && ev.DateIso == "2026-12-11" {
			hasDec11PermataDue = true
		}
	}
	if !hasDec16SpayCutoff {
		t.Fatalf("expected SPayLater dynamic Dec 16 (31-15=16) cutoff event in 12/2026 radar")
	}
	if !hasDec25PermataCutoff {
		t.Fatalf("expected Permata CC Dec 25 cutoff event in 12/2026 radar")
	}
	if !hasDec11PermataDue {
		t.Fatalf("expected Permata CC Dec 11 due event in 12/2026 radar")
	}
	if res.LowestCashPoint.DateIso == "" {
		t.Fatalf("expected lowestCashPoint date to be populated")
	}
}

func TestBuildCashRadarApr2027HolidayShiftAndFebFinalSlice(t *testing.T) {
	// 2027-04-11 is Sunday -> Bank Permata CC due date must shift H-1 working day to Friday 2027-04-09
	apr := BuildCashRadar(CashRadarRequest{
		PeriodMonth:      4,
		PeriodYear:       2027,
		PaydayDateIso:    "2027-03-29",
		LivingEndDateIso: "2027-04-26",
		NextPaydayIso:    "2027-04-27",
		PaycheckAmountRp: 5766000,
		DailyLivingPoolRp: 1500000,
		RoutineBillsPoolRp: 535000,
		CoreSavingsTargetRp: 1000000,
		PaylaterDueRp:    88182,
		CreditCardDueRp:  609544,
		HolidaysIso:      []string{"2026-12-25", "2027-01-01"},
		ReferenceDateIso: "2027-04-01",
	})
	foundShiftedCc := false
	for _, ev := range apr.Events {
		if ev.Category == "CREDIT_CARD" {
			if ev.DateIso != "2027-04-09" || !ev.IsBusinessDayShifted || ev.NominalDateIso != "2027-04-11" {
				t.Fatalf("expected Apr 2027 Permata CC H-1 shift 2027-04-11 -> 2027-04-09, got %+v", ev)
			}
			foundShiftedCc = true
		}
	}
	if !foundShiftedCc {
		t.Fatalf("expected shifted CREDIT_CARD event in 04/2027")
	}

	// 02/2027 final 3/3 SPinjam slice preservation
	feb := BuildCashRadar(CashRadarRequest{
		PeriodMonth:      2,
		PeriodYear:       2027,
		PaydayDateIso:    "2027-01-27",
		LivingEndDateIso: "2027-02-25",
		NextPaydayIso:    "2027-02-26",
		PaycheckAmountRp: 5891000,
		PaylaterDueRp:    816893,
		CreditCardDueRp:  628256,
		PersonalDebtItems: []CashRadarItemInput{
			{DateIso: "2027-02-08", Title: "SPinjam Rp 900k — Nov 08 Loan", Category: "PERSONAL_DEBT", AmountRp: 335578, DueDay: 8, SliceLabel: "3/3", IsFinalSlice: true},
		},
		ReferenceDateIso: "2027-02-01",
	})
	hasFinalFlag := false
	for _, ev := range feb.Events {
		if ev.Category == "PERSONAL_DEBT" && ev.IsFinalSlice && ev.SliceLabel == "3/3" {
			hasFinalFlag = true
		}
	}
	if !hasFinalFlag {
		t.Fatalf("expected final slice payoff flag on 02/2027 SPinjam 3/3 item")
	}
}

func TestCashRadarIncludesThrAndRealTransactionsWithoutDoubleCounting(t *testing.T) {
	res := BuildCashRadar(CashRadarRequest{
		PeriodMonth:         12,
		PeriodYear:          2026,
		PaydayDateIso:       "2026-11-27",
		LivingEndDateIso:    "2026-12-27",
		NextPaydayIso:       "2026-12-28",
		PaycheckAmountRp:    5904000,
		ThrDateIso:          "2026-12-18",
		ThrAmountRp:         3833425,
		DailyLivingPoolRp:   1500000,
		RoutineBillsPoolRp:  300000,
		CoreSavingsTargetRp: 1000000,
		PaylaterDueRp:       2783115,
		CreditCardDueRp:     657256,
		LoggedTransactions: []CashRadarTxInput{
			{Id: 101, DateIso: "2026-12-03", Label: "Lunch & Coffee", Type: "DEDUCTION", SourceType: "MANUAL", AmountRp: 65000, InsideAllocatedPool: true},
			{Id: 102, DateIso: "2026-12-10", Label: "Freelance Bonus", Type: "INCOME", SourceType: "MANUAL", AmountRp: 250000, InsideAllocatedPool: false},
		},
		PaylaterBreakdown: []CashRadarSubItem{
			{Title: "SPayLater Baseline Installments", AmountRp: 1942344, SliceLabel: "1/1"},
			{Title: "11.11 Promo Checkout (3x 0%)", AmountRp: 159904, SliceLabel: "1/3"},
		},
		HolidaysIso:      []string{"2026-12-25", "2027-01-01"},
		ReferenceDateIso: "2026-12-05",
	})

	if res.PaydayInflowsRp != 5904000+3833425+250000 {
		t.Fatalf("expected PaydayInflowsRp = paycheck+THR+extraIncome (9987425), got %d", res.PaydayInflowsRp)
	}
	// Living pool 1,500,000 already subtracted at payday; Lunch Rp 65,000 is inside living pool so EndingCashBufferRp stays 9987425 - 3740371 - 1500000 - 1000000 = 3747054
	expectedBuffer := int64(5904000 + 3833425 + 250000 - (2783115 + 657256 + 300000) - 1500000 - 1000000)
	if res.EndingCashBufferRp != expectedBuffer {
		t.Fatalf("expected EndingCashBufferRp=%d without double counting inside-pool spend, got %d", expectedBuffer, res.EndingCashBufferRp)
	}
	hasTxEvent := false
	hasSpaySubItems := false
	for _, ev := range res.Events {
		if ev.Category == "LIVING_SPEND" && ev.DateIso == "2026-12-03" && ev.SignedAmountRp == -65000 {
			hasTxEvent = true
		}
		if ev.Id == "bill-spaylater" && len(ev.SubItems) == 2 {
			hasSpaySubItems = true
		}
	}
	if !hasTxEvent || !hasSpaySubItems {
		t.Fatalf("expected logged spend transaction event and SPayLater sub-items breakdown, got tx=%v sub=%v", hasTxEvent, hasSpaySubItems)
	}
}
