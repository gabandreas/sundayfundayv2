package timeline

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"
)

type CashRadarSubItem struct {
	Title      string `json:"title"`
	AmountRp   int64  `json:"amountRp"`
	SliceLabel string `json:"sliceLabel"`
}

type CashRadarTxInput struct {
	Id                  int    `json:"id"`
	DateIso             string `json:"dateIso"`
	Label               string `json:"label"`
	Type                string `json:"type"`
	SourceType          string `json:"sourceType"`
	AmountRp            int64  `json:"amountRp"`
	InsideAllocatedPool bool   `json:"insideAllocatedPool"`
}

type CashRadarItemInput struct {
	DateIso      string `json:"dateIso"`
	Title        string `json:"title"`
	Category     string `json:"category"`
	AmountRp     int64  `json:"amountRp"`
	DueDay       int    `json:"dueDay"`
	SliceLabel   string `json:"sliceLabel"`
	IsFinalSlice bool   `json:"isFinalSlice"`
}

type CashRadarRequest struct {
	PeriodMonth         int                  `json:"periodMonth"`
	PeriodYear          int                  `json:"periodYear"`
	PaydayDateIso       string               `json:"paydayDateIso"`
	LivingEndDateIso    string               `json:"livingEndDateIso"`
	NextPaydayIso       string               `json:"nextPaydayIso"`
	PaycheckAmountRp    int64                `json:"paycheckAmountRp"`
	ThrDateIso          string               `json:"thrDateIso"`
	ThrAmountRp         int64                `json:"thrAmountRp"`
	DailyLivingPoolRp   int64                `json:"dailyLivingPoolRp"`
	RoutineBillsPoolRp  int64                `json:"routineBillsPoolRp"`
	CoreSavingsTargetRp int64                `json:"coreSavingsTargetRp"`
	PaylaterDueRp       int64                `json:"paylaterDueRp"`
	CreditCardDueRp     int64                `json:"creditCardDueRp"`
	PersonalDebtItems   []CashRadarItemInput `json:"personalDebtItems"`
	LoggedTransactions  []CashRadarTxInput   `json:"loggedTransactions"`
	PaylaterBreakdown   []CashRadarSubItem   `json:"paylaterBreakdown"`
	CreditCardBreakdown []CashRadarSubItem   `json:"creditCardBreakdown"`
	HolidaysIso         []string             `json:"holidaysIso"`
	ReferenceDateIso    string               `json:"referenceDateIso"`
}

type CashRadarEvent struct {
	Id                   string             `json:"id"`
	DateIso              string             `json:"dateIso"`
	NominalDateIso       string             `json:"nominalDateIso"`
	IsBusinessDayShifted bool               `json:"isBusinessDayShifted"`
	Label                string             `json:"label"`
	Category             string             `json:"category"`
	SignedAmountRp       int64              `json:"signedAmountRp"`
	SliceLabel           string             `json:"sliceLabel"`
	IsFinalSlice         bool               `json:"isFinalSlice"`
	Notes                string             `json:"notes"`
	InsideAllocatedPool  bool               `json:"insideAllocatedPool"`
	SubItems             []CashRadarSubItem `json:"subItems"`
}

type CashRadarDayPoint struct {
	DateIso          string           `json:"dateIso"`
	DayOfMonth       int              `json:"dayOfMonth"`
	InActiveCycle    bool             `json:"inActiveCycle"`
	IsToday          bool             `json:"isToday"`
	IsWeekend        bool             `json:"isWeekend"`
	OpeningBalanceRp int64            `json:"openingBalanceRp"`
	InflowsRp        int64            `json:"inflowsRp"`
	OutflowsRp       int64            `json:"outflowsRp"`
	ClosingBalanceRp int64            `json:"closingBalanceRp"`
	Events           []CashRadarEvent `json:"events"`
}

type CashRadarTrough struct {
	DateIso          string `json:"dateIso"`
	BalanceRp        int64  `json:"balanceRp"`
	ContextLabel     string `json:"contextLabel"`
	IsTightOrDeficit bool   `json:"isTightOrDeficit"`
}

type CashRadarResult struct {
	PeriodMonth           int                 `json:"periodMonth"`
	PeriodYear            int                 `json:"periodYear"`
	CycleStartIso         string              `json:"cycleStartIso"`
	CycleEndIso           string              `json:"cycleEndIso"`
	NextPaydayIso         string              `json:"nextPaydayIso"`
	PaydayInflowsRp       int64               `json:"paydayInflowsRp"`
	TotalScheduledBillsRp int64               `json:"totalScheduledBillsRp"`
	EndingCashBufferRp    int64               `json:"endingCashBufferRp"`
	LowestCashPoint       CashRadarTrough     `json:"lowestCashPoint"`
	Events                []CashRadarEvent    `json:"events"`
	DailySeries           []CashRadarDayPoint `json:"dailySeries"`
}

func daysInMonthRadar(month, year int) int {
	return time.Date(year, time.Month(month+1), 0, 0, 0, 0, 0, time.UTC).Day()
}

func parseDateIsoRadar(raw string) (time.Time, bool) {
	trimmed := strings.TrimSpace(raw)
	if len(trimmed) < 10 {
		return time.Time{}, false
	}
	parts := strings.Split(trimmed[:10], "-")
	if len(parts) != 3 {
		return time.Time{}, false
	}
	y, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	d, err3 := strconv.Atoi(parts[2])
	if err1 != nil || err2 != nil || err3 != nil || m < 1 || m > 12 || d < 1 || d > 31 {
		return time.Time{}, false
	}
	return time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC), true
}

func isHolidayRadar(iso string, custom map[string]bool) bool {
	if custom[iso] {
		return true
	}
	return iso == "2026-12-25" || iso == "2027-01-01"
}

func resolvePreviousBusinessDayRadar(year, month, day int, holidays map[string]bool) (string, bool) {
	maxD := daysInMonthRadar(month, year)
	if day > maxD {
		day = maxD
	}
	dt := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	iso := dt.Format("2006-01-02")
	dow := dt.Weekday()
	if dow != time.Saturday && dow != time.Sunday && !isHolidayRadar(iso, holidays) {
		return iso, false
	}
	for {
		dt = dt.AddDate(0, 0, -1)
		candIso := dt.Format("2006-01-02")
		candDow := dt.Weekday()
		if candDow != time.Saturday && candDow != time.Sunday && !isHolidayRadar(candIso, holidays) {
			return candIso, true
		}
	}
}

func BuildCashRadar(req CashRadarRequest) CashRadarResult {
	m := req.PeriodMonth
	if m < 1 || m > 12 {
		m = 11
	}
	y := req.PeriodYear
	if y < 2020 {
		y = 2026
	}

	holidays := make(map[string]bool, len(req.HolidaysIso))
	for _, h := range req.HolidaysIso {
		if len(h) >= 10 {
			holidays[h[:10]] = true
		}
	}

	monthFirst := time.Date(y, time.Month(m), 1, 0, 0, 0, 0, time.UTC)
	monthLast := time.Date(y, time.Month(m), daysInMonthRadar(m, y), 0, 0, 0, 0, time.UTC)

	cycleStart, okStart := parseDateIsoRadar(req.PaydayDateIso)
	if !okStart {
		cycleStart = monthFirst
	}
	cycleEnd, okEnd := parseDateIsoRadar(req.LivingEndDateIso)
	if !okEnd || cycleEnd.Before(cycleStart) {
		cycleEnd = monthLast
	}

	cycleStartIso := cycleStart.Format("2006-01-02")
	cycleEndIso := cycleEnd.Format("2006-01-02")

	gridStart := monthFirst
	if cycleStart.Before(gridStart) {
		gridStart = cycleStart
	}
	gridEnd := monthLast
	if cycleEnd.After(gridEnd) {
		gridEnd = cycleEnd
	}
	gridStartIso := gridStart.Format("2006-01-02")
	gridEndIso := gridEnd.Format("2006-01-02")

	refIso := strings.TrimSpace(req.ReferenceDateIso)
	if len(refIso) >= 10 {
		refIso = refIso[:10]
	}

	events := make([]CashRadarEvent, 0, 16)

	if req.PaycheckAmountRp > 0 {
		events = append(events, CashRadarEvent{
			Id:                   "inflow-payday",
			DateIso:              cycleStartIso,
			NominalDateIso:       "",
			IsBusinessDayShifted: false,
			Label:                "Cycle Funded · Net Payroll",
			Category:             "INFLOW",
			SignedAmountRp:       req.PaycheckAmountRp,
			SliceLabel:           "",
			IsFinalSlice:         false,
			Notes:                "Corporate payday credit",
			InsideAllocatedPool:  false,
			SubItems:             []CashRadarSubItem{},
		})
	}
	if req.RoutineBillsPoolRp > 0 {
		events = append(events, CashRadarEvent{
			Id:                   "routine-bills",
			DateIso:              cycleStartIso,
			NominalDateIso:       "",
			IsBusinessDayShifted: false,
			Label:                "Routine Bills Reserve",
			Category:             "ROUTINE",
			SignedAmountRp:       -req.RoutineBillsPoolRp,
			SliceLabel:           "",
			IsFinalSlice:         false,
			Notes:                "Transport, internet & routine essentials",
			InsideAllocatedPool:  false,
			SubItems:             []CashRadarSubItem{},
		})
	}
	if req.DailyLivingPoolRp > 0 {
		events = append(events, CashRadarEvent{
			Id:                   "living-pool",
			DateIso:              cycleStartIso,
			NominalDateIso:       "",
			IsBusinessDayShifted: false,
			Label:                "Daily Living Cash Pool",
			Category:             "LIVING",
			SignedAmountRp:       -req.DailyLivingPoolRp,
			SliceLabel:           "",
			IsFinalSlice:         false,
			Notes:                "Dedicated day-by-day living runway",
			InsideAllocatedPool:  false,
			SubItems:             []CashRadarSubItem{},
		})
	}
	if req.ThrAmountRp > 0 && strings.TrimSpace(req.ThrDateIso) != "" {
		thrIso := strings.TrimSpace(req.ThrDateIso)[:10]
		events = append(events, CashRadarEvent{
			Id:                   "inflow-thr",
			DateIso:              thrIso,
			NominalDateIso:       "",
			IsBusinessDayShifted: false,
			Label:                "December Natal THR Inflow",
			Category:             "INFLOW",
			SignedAmountRp:       req.ThrAmountRp,
			SliceLabel:           "",
			IsFinalSlice:         false,
			Notes:                "Pro-rated statutory allowance",
			InsideAllocatedPool:  false,
			SubItems:             []CashRadarSubItem{},
		})
	}

	// Dynamic statement closing/cutoff markers for every month spanned by grid
	curYM := time.Date(gridStart.Year(), gridStart.Month(), 1, 0, 0, 0, 0, time.UTC)
	endYM := time.Date(gridEnd.Year(), gridEnd.Month(), 1, 0, 0, 0, 0, time.UTC)
	for !curYM.After(endYM) {
		cm := int(curYM.Month())
		cy := curYM.Year()
		dim := daysInMonthRadar(cm, cy)
		spayCutoffDay := dim - 15
		spayCutIso := fmt.Sprintf("%04d-%02d-%02d", cy, cm, spayCutoffDay)
		if spayCutIso >= gridStartIso && spayCutIso <= gridEndIso {
			events = append(events, CashRadarEvent{
				Id:                   fmt.Sprintf("cutoff-spay-%04d-%02d", cy, cm),
				DateIso:              spayCutIso,
				NominalDateIso:       "",
				IsBusinessDayShifted: false,
				Label:                fmt.Sprintf("SPayLater Statement Cutoff (%dth of %dd mo)", spayCutoffDay, dim),
				Category:             "CUTOFF",
				SignedAmountRp:       0,
				SliceLabel:           "",
				IsFinalSlice:         false,
				Notes:                "Charges after today defer to M+2 (due 25th)",
				InsideAllocatedPool:  false,
				SubItems:             []CashRadarSubItem{},
			})
		}

		ccCutIso := fmt.Sprintf("%04d-%02d-25", cy, cm)
		if ccCutIso >= gridStartIso && ccCutIso <= gridEndIso {
			events = append(events, CashRadarEvent{
				Id:                   fmt.Sprintf("cutoff-permata-%04d-%02d", cy, cm),
				DateIso:              ccCutIso,
				NominalDateIso:       "",
				IsBusinessDayShifted: false,
				Label:                "Bank Permata CC Statement Closing (25th)",
				Category:             "CUTOFF",
				SignedAmountRp:       0,
				SliceLabel:           "",
				IsFinalSlice:         false,
				Notes:                "Swipes from 26th onward bill due 11th of M+2",
				InsideAllocatedPool:  false,
				SubItems:             []CashRadarSubItem{},
			})
		}

		curYM = curYM.AddDate(0, 1, 0)
	}

	var totalPersonalDebtRp int64
	for idx, item := range req.PersonalDebtItems {
		if item.AmountRp <= 0 {
			continue
		}
		amt := item.AmountRp
		totalPersonalDebtRp += amt
		cat := item.Category
		if cat == "" {
			cat = "PERSONAL_DEBT"
		}
		dIso := strings.TrimSpace(item.DateIso)
		if len(dIso) >= 10 {
			dIso = dIso[:10]
		} else {
			dueD := item.DueDay
			if dueD < 1 {
				dueD = 8
			}
			maxD := daysInMonthRadar(m, y)
			if dueD > maxD {
				dueD = maxD
			}
			dIso = fmt.Sprintf("%04d-%02d-%02d", y, m, dueD)
		}
		note := "Scheduled installment payment"
		if item.IsFinalSlice {
			note = "Final installment — monthly commitment clears after payment"
		}
		events = append(events, CashRadarEvent{
			Id:                   fmt.Sprintf("pd-%d-%s", idx+1, dIso),
			DateIso:              dIso,
			NominalDateIso:       "",
			IsBusinessDayShifted: false,
			Label:                item.Title,
			Category:             cat,
			SignedAmountRp:       -amt,
			SliceLabel:           item.SliceLabel,
			IsFinalSlice:         item.IsFinalSlice,
			Notes:                note,
			InsideAllocatedPool:  false,
			SubItems:             []CashRadarSubItem{},
		})
	}

	if req.CreditCardDueRp > 0 {
		nominalCcIso := fmt.Sprintf("%04d-%02d-11", y, m)
		effectiveCcIso, ccShifted := resolvePreviousBusinessDayRadar(y, m, 11, holidays)
		note := "Bank Permata full statement settlement (0% retail interest)"
		nomOut := ""
		if ccShifted {
			note = fmt.Sprintf("Nominal due %s falls on weekend/holiday — settle H-1 working day early by %s", nominalCcIso, effectiveCcIso)
			nomOut = nominalCcIso
		}
		ccSub := req.CreditCardBreakdown
		if ccSub == nil {
			ccSub = []CashRadarSubItem{}
		}
		events = append(events, CashRadarEvent{
			Id:                   "bill-permata-cc",
			DateIso:              effectiveCcIso,
			NominalDateIso:       nomOut,
			IsBusinessDayShifted: ccShifted,
			Label:                "Bank Permata Credit Card Due (11th)",
			Category:             "CREDIT_CARD",
			SignedAmountRp:       -req.CreditCardDueRp,
			SliceLabel:           "",
			IsFinalSlice:         false,
			Notes:                note,
			InsideAllocatedPool:  false,
			SubItems:             ccSub,
		})
	}

	if req.PaylaterDueRp > 0 {
		plDueIso := fmt.Sprintf("%04d-%02d-25", y, m)
		plSub := req.PaylaterBreakdown
		if plSub == nil {
			plSub = []CashRadarSubItem{}
		}
		events = append(events, CashRadarEvent{
			Id:                   "bill-spaylater",
			DateIso:              plDueIso,
			NominalDateIso:       "",
			IsBusinessDayShifted: false,
			Label:                "SPayLater Monthly Due (25th)",
			Category:             "PAYLATER",
			SignedAmountRp:       -req.PaylaterDueRp,
			SliceLabel:           "",
			IsFinalSlice:         false,
			Notes:                "Consolidated Shopee SPayLater cycle due",
			InsideAllocatedPool:  false,
			SubItems:             plSub,
		})
	}

	if req.CoreSavingsTargetRp > 0 {
		saveIso := cycleEndIso
		if req.ThrAmountRp > 0 && strings.TrimSpace(req.ThrDateIso) != "" {
			saveIso = strings.TrimSpace(req.ThrDateIso)[:10]
		}
		events = append(events, CashRadarEvent{
			Id:                   "savings-p1",
			DateIso:              saveIso,
			NominalDateIso:       "",
			IsBusinessDayShifted: false,
			Label:                "Priority 1 Core Savings Sweep",
			Category:             "SAVINGS",
			SignedAmountRp:       -req.CoreSavingsTargetRp,
			SliceLabel:           "",
			IsFinalSlice:         false,
			Notes:                "Protected Priority 1 savings sweep",
			InsideAllocatedPool:  false,
			SubItems:             []CashRadarSubItem{},
		})
	}

	var extraIncomeSum int64
	var directOutflows int64
	for idx, tx := range req.LoggedTransactions {
		if tx.AmountRp <= 0 {
			continue
		}
		dIso := strings.TrimSpace(tx.DateIso)
		if len(dIso) < 10 {
			continue
		}
		dIso = dIso[:10]
		if dIso < gridStartIso || dIso > gridEndIso {
			continue
		}
		txType := strings.ToUpper(strings.TrimSpace(tx.Type))
		srcType := strings.ToUpper(strings.TrimSpace(tx.SourceType))
		if txType == "INCOME" {
			extraIncomeSum += tx.AmountRp
			note := "Additional income logged in cycle"
			if srcType == "OPERATIONAL_REFUND" {
				note = "Balance adjustment or operational credit"
			}
			events = append(events, CashRadarEvent{
				Id:                   fmt.Sprintf("tx-inc-%d-%d", idx+1, tx.Id),
				DateIso:              dIso,
				NominalDateIso:       "",
				IsBusinessDayShifted: false,
				Label:                tx.Label,
				Category:             "EXTRA_INCOME",
				SignedAmountRp:       tx.AmountRp,
				SliceLabel:           srcType,
				IsFinalSlice:         false,
				Notes:                note,
				InsideAllocatedPool:  false,
				SubItems:             []CashRadarSubItem{},
			})
		} else {
			cat := "LIVING_SPEND"
			note := "Drawn from Daily Living Cash Pool (no double-subtraction)"
			if !tx.InsideAllocatedPool {
				cat = "DIRECT_DEDUCTION"
				note = "Direct unpooled deduction outside living envelope"
				directOutflows += tx.AmountRp
			} else if srcType == "CHECKPOINT" || strings.Contains(strings.ToLower(tx.Label), "checkpoint") || strings.Contains(strings.ToLower(tx.Label), "unitemized") {
				note = "Reconciled balance checkpoint (within living cash pool)"
			}
			events = append(events, CashRadarEvent{
				Id:                   fmt.Sprintf("tx-exp-%d-%d", idx+1, tx.Id),
				DateIso:              dIso,
				NominalDateIso:       "",
				IsBusinessDayShifted: false,
				Label:                tx.Label,
				Category:             cat,
				SignedAmountRp:       -tx.AmountRp,
				SliceLabel:           srcType,
				IsFinalSlice:         false,
				Notes:                note,
				InsideAllocatedPool:  tx.InsideAllocatedPool,
				SubItems:             []CashRadarSubItem{},
			})
		}
	}

	sort.SliceStable(events, func(i, j int) bool {
		if events[i].DateIso != events[j].DateIso {
			return events[i].DateIso < events[j].DateIso
		}
		if events[i].SignedAmountRp != events[j].SignedAmountRp {
			return events[i].SignedAmountRp > events[j].SignedAmountRp
		}
		return events[i].Id < events[j].Id
	})

	eventsByDate := make(map[string][]CashRadarEvent)
	for _, ev := range events {
		eventsByDate[ev.DateIso] = append(eventsByDate[ev.DateIso], ev)
	}

	dailySeries := make([]CashRadarDayPoint, 0, 40)
	var running int64
	minBal := int64(math.MaxInt64)
	minDate := cycleStartIso
	minCtx := "Payday Start"

	for d := gridStart; !d.After(gridEnd); d = d.AddDate(0, 0, 1) {
		dIso := d.Format("2006-01-02")
		inCycle := dIso >= cycleStartIso && dIso <= cycleEndIso
		dow := d.Weekday()
		isWknd := dow == time.Saturday || dow == time.Sunday

		opening := running
		dayEvents := eventsByDate[dIso]
		if dayEvents == nil {
			dayEvents = []CashRadarEvent{}
		}
		var inflows, outflows int64
		for _, ev := range dayEvents {
			if ev.InsideAllocatedPool {
				continue
			}
			if ev.SignedAmountRp > 0 {
				inflows += ev.SignedAmountRp
			} else if ev.SignedAmountRp < 0 {
				outflows += -ev.SignedAmountRp
			}
			running += ev.SignedAmountRp
		}
		closing := running

		if (inCycle || dIso >= cycleStartIso) && closing < minBal {
			minBal = closing
			minDate = dIso
			if len(dayEvents) > 0 {
				lastLbl := dayEvents[len(dayEvents)-1].Label
				minCtx = lastLbl
			} else {
				minCtx = "Post-Outflow Trough"
			}
		}

		dailySeries = append(dailySeries, CashRadarDayPoint{
			DateIso:          dIso,
			DayOfMonth:       d.Day(),
			InActiveCycle:    inCycle,
			IsToday:          refIso != "" && dIso == refIso,
			IsWeekend:        isWknd,
			OpeningBalanceRp: opening,
			InflowsRp:        inflows,
			OutflowsRp:       outflows,
			ClosingBalanceRp: closing,
			Events:           dayEvents,
		})
	}

	if minBal == int64(math.MaxInt64) {
		minBal = running
	}

	paydayInflows := req.PaycheckAmountRp + req.ThrAmountRp + extraIncomeSum
	totalScheduledBills := totalPersonalDebtRp + req.CreditCardDueRp + req.PaylaterDueRp + req.RoutineBillsPoolRp + directOutflows
	endingBuffer := paydayInflows - totalScheduledBills - req.DailyLivingPoolRp - req.CoreSavingsTargetRp

	return CashRadarResult{
		PeriodMonth:           m,
		PeriodYear:            y,
		CycleStartIso:         cycleStartIso,
		CycleEndIso:           cycleEndIso,
		NextPaydayIso:         req.NextPaydayIso,
		PaydayInflowsRp:       paydayInflows,
		TotalScheduledBillsRp: totalScheduledBills,
		EndingCashBufferRp:    endingBuffer,
		LowestCashPoint: CashRadarTrough{
			DateIso:          minDate,
			BalanceRp:        minBal,
			ContextLabel:     minCtx,
			IsTightOrDeficit: minBal <= 0,
		},
		Events:      events,
		DailySeries: dailySeries,
	}
}
