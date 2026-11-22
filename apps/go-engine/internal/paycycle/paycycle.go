package paycycle

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

type InstrumentCutoffRule struct {
	ID                 string  `json:"id"`
	Name               string  `json:"name"`
	Type               string  `json:"type"` // PAYLATER | CREDIT_CARD | CASH_LOAN
	CutoffDay          int     `json:"cutoffDay"`
	DueDay             int     `json:"dueDay"`
	DueRule            string  `json:"dueRule"` // FIXED_DAY | DISBURSEMENT_DAY
	MonthlyInterestPct float64 `json:"monthlyInterestPct"`
	AdminFeePct        float64 `json:"adminFeePct"`
	Active             bool    `json:"active"`
}

type HorizonRequest struct {
	Month                int      `json:"month"`
	Year                 int      `json:"year"`
	AnchorDay            int      `json:"anchorDay"` // default 27 (legacy fallback)
	ShiftWeekendToFriday bool     `json:"shiftWeekendToFriday"`
	ExplicitStartIso     string   `json:"explicitStartIso,omitempty"`
	ExplicitNextPayday   string   `json:"explicitNextPaydayIso,omitempty"`
	WeekendMultiplier    float64  `json:"weekendMultiplier"` // default 1.5
	RemainingBudgetRp    int64    `json:"remainingBudgetRp"`
	ReferenceDateIso     string   `json:"referenceDateIso,omitempty"` // default today
	PayslipAnchorDay     int      `json:"payslipAnchorDay,omitempty"`
	PayslipShiftRule     string   `json:"payslipShiftRule,omitempty"` // SHIFT_PREVIOUS_FRIDAY | SHIFT_NEXT_WEEKDAY | EXACT_DAY
	ReviewLagWorkingDays int      `json:"reviewLagWorkingDays,omitempty"`
	HolidaysIso          []string `json:"holidaysIso,omitempty"`
	ExplicitPayslipIso   string   `json:"explicitPayslipIso,omitempty"`
	OverrideNote         string   `json:"overrideNote,omitempty"`
}

type HorizonResult struct {
	PeriodMonth          int     `json:"periodMonth"`
	PeriodYear           int     `json:"periodYear"`
	PeriodCode           string  `json:"periodCode"`
	PayslipDropIso       string  `json:"payslipDropIso"`
	PayslipShifted       bool    `json:"payslipShifted"`
	ReviewLagWorkingDays int     `json:"reviewLagWorkingDays"`
	ShiftRule            string  `json:"shiftRule"`
	OverrideApplied      bool    `json:"overrideApplied"`
	OverrideNote         string  `json:"overrideNote,omitempty"`
	PaydayIso            string  `json:"paydayIso"`
	PaydayShiftedFromWk  bool    `json:"paydayShiftedFromWeekend"`
	LivingStartIso       string  `json:"livingStartIso"`
	LivingEndIso         string  `json:"livingEndIso"`
	NextPaydayIso        string  `json:"nextPaydayIso"`
	CycleTemporalState   string  `json:"cycleTemporalState"`
	DaysUntilCycleStart  int     `json:"daysUntilCycleStart"`
	CurrentDayIndex      int     `json:"currentDayIndex"`
	MaturityMonth        int     `json:"maturityMonth"`
	MaturityYear         int     `json:"maturityYear"`
	TotalCycleDays       int     `json:"totalCycleDays"`
	RemainingDays        int     `json:"remainingDays"`
	ElapsedDays          int     `json:"elapsedDays"`
	RemainingWeekdays    int     `json:"remainingWeekdays"`
	RemainingWeekends    int     `json:"remainingWeekends"`
	WeekdaySafeRateRp    int64   `json:"weekdaySafeRateRp"`
	WeekendSafeRateRp    int64   `json:"weekendSafeRateRp"`
	FlatDailyRateRp      int64   `json:"flatDailyRateRp"`
	WeekendMultiplier    float64 `json:"weekendMultiplier"`
}

type WaterfallConfigRequest struct {
	FinalTotalIncomeRp     int64    `json:"finalTotalIncomeRp"`
	TotalDebtObligationsRp int64    `json:"totalDebtObligationsRp"`
	RoutineQuotasTotalRp   int64    `json:"routineQuotasTotalRp"`
	DailyLivingTargetRp    int64    `json:"dailyLivingTargetRp"`
	BufferTargetRp         int64    `json:"bufferTargetRp"`
	CoreSavingsP1TargetRp  int64    `json:"coreSavingsP1TargetRp"`
	SelfRewardP2TargetRp   int64    `json:"selfRewardP2TargetRp"`
	PriorityOrder          []string `json:"priorityOrder,omitempty"`
}

type WaterfallConfigResult struct {
	FinalTotalIncomeRp       int64  `json:"finalTotalIncomeRp"`
	DebtObligationsFundedRp  int64  `json:"debtObligationsFundedRp"`
	RoutineQuotasFundedRp    int64  `json:"routineQuotasFundedRp"`
	DailyLivingFundedRp      int64  `json:"dailyLivingFundedRp"`
	BufferFundedRp           int64  `json:"bufferFundedRp"`
	CoreSavingsP1FundedRp    int64  `json:"coreSavingsP1FundedRp"`
	SelfRewardP2FundedRp     int64  `json:"selfRewardP2FundedRp"`
	UncoveredDeficitRp       int64  `json:"uncoveredDeficitRp"`
	AvailableAfterEssentialRp int64 `json:"availableAfterEssentialRp"`
}

type RouteTxRequest struct {
	TxDateIso      string                 `json:"txDateIso"`
	InstrumentType string                 `json:"instrumentType"` // PAYLATER | CREDIT_CARD | CASH_LOAN | CASH
	InstrumentName string                 `json:"instrumentName,omitempty"`
	AnchorDay      int                    `json:"anchorDay"`
	Rules          []InstrumentCutoffRule `json:"rules,omitempty"`
}

type RouteTxResult struct {
	TargetPeriodMonth int    `json:"targetPeriodMonth"`
	TargetPeriodYear  int    `json:"targetPeriodYear"`
	TargetPeriodCode  string `json:"targetPeriodCode"`
	MaturityMonth     int    `json:"maturityMonth"`
	MaturityYear      int    `json:"maturityYear"`
	DueDay            int    `json:"dueDay"`
	CutoffDay         int    `json:"cutoffDay"`
	CrossedCutoff     bool   `json:"crossedCutoff"`
	Explanation       string `json:"explanation"`
}

func addMonths(m, y, delta int) (int, int) {
	total := y*12 + (m - 1) + delta
	newY := total / 12
	newM := total % 12
	if newM < 0 {
		newM += 12
		newY--
	}
	return newM + 1, newY
}

func daysInMonth(m, y int) int {
	return time.Date(y, time.Month(m+1), 0, 0, 0, 0, 0, time.UTC).Day()
}

func resolvePaydayDate(month, year, anchorDay int, shiftWeekend bool) (time.Time, bool) {
	if anchorDay <= 0 || anchorDay > 31 {
		anchorDay = 27
	}
	maxD := daysInMonth(month, year)
	day := anchorDay
	if day > maxD {
		day = maxD
	}
	d := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	shifted := false
	if shiftWeekend {
		switch d.Weekday() {
		case time.Saturday:
			d = d.AddDate(0, 0, -1)
			shifted = true
		case time.Sunday:
			d = d.AddDate(0, 0, -2)
			shifted = true
		}
	}
	return d, shifted
}

func parseIsoDate(raw string) (time.Time, bool) {
	trimmed := strings.TrimSpace(raw)
	if len(trimmed) >= 10 {
		trimmed = trimmed[:10]
	}
	t, err := time.Parse("2006-01-02", trimmed)
	if err != nil {
		return time.Time{}, false
	}
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC), true
}

func isWorkingDay(d time.Time, holidays map[string]bool) bool {
	if d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
		return false
	}
	if len(holidays) > 0 && holidays[d.Format("2006-01-02")] {
		return false
	}
	return true
}

func resolvePayslipDate(month, year, anchorDay int, shiftRule string, holidays map[string]bool) (time.Time, bool) {
	if anchorDay <= 0 || anchorDay > 31 {
		anchorDay = 25
	}
	maxD := daysInMonth(month, year)
	day := anchorDay
	if day > maxD {
		day = maxD
	}
	d := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	shifted := false
	switch strings.ToUpper(strings.TrimSpace(shiftRule)) {
	case "EXACT_DAY":
		return d, false
	case "SHIFT_NEXT_WEEKDAY":
		for !isWorkingDay(d, holidays) {
			d = d.AddDate(0, 0, 1)
			shifted = true
		}
	default: // SHIFT_PREVIOUS_FRIDAY
		for !isWorkingDay(d, holidays) {
			d = d.AddDate(0, 0, -1)
			shifted = true
		}
	}
	return d, shifted
}

func addWorkingDays(start time.Time, lag int, holidays map[string]bool) time.Time {
	d := start
	if lag > 0 {
		remaining := lag
		for remaining > 0 {
			d = d.AddDate(0, 0, 1)
			if isWorkingDay(d, holidays) {
				remaining--
			}
		}
	} else if lag < 0 {
		remaining := -lag
		for remaining > 0 {
			d = d.AddDate(0, 0, -1)
			if isWorkingDay(d, holidays) {
				remaining--
			}
		}
	}
	return d
}

func ComputePaycycleHorizon(req HorizonRequest) HorizonResult {
	m := req.Month
	if m < 1 || m > 12 {
		m = 11
	}
	y := req.Year
	if y < 2020 {
		y = 2026
	}
	anchor := req.AnchorDay
	if anchor <= 0 {
		anchor = 27
	}
	mult := req.WeekendMultiplier
	if mult <= 0 {
		mult = 1.5
	}

	holidays := make(map[string]bool, len(req.HolidaysIso))
	for _, h := range req.HolidaysIso {
		if parsedH, ok := parseIsoDate(h); ok {
			holidays[parsedH.Format("2006-01-02")] = true
		}
	}

	shiftRule := strings.ToUpper(strings.TrimSpace(req.PayslipShiftRule))
	if shiftRule == "" {
		if req.ShiftWeekendToFriday {
			shiftRule = "SHIFT_PREVIOUS_FRIDAY"
		} else {
			shiftRule = "EXACT_DAY"
		}
	}

	useTwoStage := req.PayslipAnchorDay > 0 || req.ReviewLagWorkingDays > 0 || req.ExplicitPayslipIso != "" || req.PayslipShiftRule != ""
	lagDays := req.ReviewLagWorkingDays
	if useTwoStage && lagDays <= 0 && req.PayslipAnchorDay > 0 {
		// Default corporate review lag when explicitly configured is 2, or 0 if explicitly 0 via anchor > 0
		lagDays = req.ReviewLagWorkingDays
	}

	var payslipDrop, payday, nextPayday time.Time
	var payslipShifted, shifted, overrideApplied bool

	nextM, nextY := addMonths(m, y, 1)
	if useTwoStage {
		pAnchor := req.PayslipAnchorDay
		if pAnchor <= 0 {
			pAnchor = 25
		}
		payslipDrop, payslipShifted = resolvePayslipDate(m, y, pAnchor, shiftRule, holidays)
		if expPayslip, ok := parseIsoDate(req.ExplicitPayslipIso); ok {
			payslipDrop = expPayslip
			overrideApplied = true
		}
		payday = addWorkingDays(payslipDrop, lagDays, holidays)
		shifted = payslipShifted

		nextPayslip, _ := resolvePayslipDate(nextM, nextY, pAnchor, shiftRule, holidays)
		nextPayday = addWorkingDays(nextPayslip, lagDays, holidays)
	} else {
		payday, shifted = resolvePaydayDate(m, y, anchor, req.ShiftWeekendToFriday)
		payslipDrop = addWorkingDays(payday, -2, holidays)
		payslipShifted = shifted
		lagDays = 2
		nextPayday, _ = resolvePaydayDate(nextM, nextY, anchor, req.ShiftWeekendToFriday)
	}

	if expStart, ok := parseIsoDate(req.ExplicitStartIso); ok {
		payday = expStart
		overrideApplied = true
	}
	if expNext, ok := parseIsoDate(req.ExplicitNextPayday); ok && expNext.After(payday) {
		nextPayday = expNext
	}

	livingStart := payday.AddDate(0, 0, 1)
	livingEnd := nextPayday
	totalDays := int(nextPayday.Sub(payday).Hours() / 24)
	if totalDays < 1 {
		totalDays = 1
	}

	refDate := time.Now().UTC()
	refDate = time.Date(refDate.Year(), refDate.Month(), refDate.Day(), 0, 0, 0, 0, time.UTC)
	if r, ok := parseIsoDate(req.ReferenceDateIso); ok {
		refDate = r
	}

	var remDays, elapsedDays, daysUntilStart, currentDayIndex int
	var temporalState string
	if refDate.Before(payday) {
		temporalState = "PRE_PAYDAY"
		daysUntilStart = int(payday.Sub(refDate).Hours() / 24)
		elapsedDays = 0
		remDays = totalDays
		currentDayIndex = 0
	} else if refDate.After(livingEnd) {
		temporalState = "COMPLETED"
		daysUntilStart = 0
		elapsedDays = totalDays
		remDays = 0
		currentDayIndex = totalDays
	} else {
		temporalState = "ACTIVE"
		daysUntilStart = 0
		if refDate.Before(livingStart) {
			elapsedDays = 0
			remDays = totalDays
		} else {
			elapsedDays = int(refDate.Sub(livingStart).Hours()/24) + 1
			if elapsedDays > totalDays {
				elapsedDays = totalDays
			}
			remDays = totalDays - elapsedDays
			if remDays < 0 {
				remDays = 0
			}
		}
		currentDayIndex = int(refDate.Sub(payday).Hours()/24) + 1
		if currentDayIndex < 1 {
			currentDayIndex = 1
		}
		if currentDayIndex > totalDays {
			currentDayIndex = totalDays
		}
	}

	// Count remaining weekdays/weekends from effective cursor day through livingEnd
	cursorStart := livingStart
	if !refDate.Before(livingStart) && !refDate.After(livingEnd) {
		cursorStart = refDate.AddDate(0, 0, 1)
	}
	remWeekdays := 0
	remWeekends := 0
	if !refDate.After(livingEnd) {
		for d := cursorStart; !d.After(livingEnd); d = d.AddDate(0, 0, 1) {
			wd := d.Weekday()
			if wd == time.Saturday || wd == time.Sunday {
				remWeekends++
			} else {
				remWeekdays++
			}
		}
	}

	budget := req.RemainingBudgetRp
	if budget < 0 {
		budget = 0
	}

	var flatRate, weekdayRate, weekendRate int64
	if remDays > 0 {
		flatRate = int64(math.Round(float64(budget) / float64(remDays)))
		weightedUnits := float64(remWeekdays)*1.0 + float64(remWeekends)*mult
		if weightedUnits > 0 {
			weekdayRate = int64(math.Round(float64(budget) / weightedUnits))
			weekendRate = int64(math.Round(float64(weekdayRate) * mult))
		}
	}

	return HorizonResult{
		PeriodMonth:          m,
		PeriodYear:           y,
		PeriodCode:           fmt.Sprintf("%02d/%d", m, y),
		PayslipDropIso:       payslipDrop.Format("2006-01-02"),
		PayslipShifted:       payslipShifted,
		ReviewLagWorkingDays: lagDays,
		ShiftRule:            shiftRule,
		OverrideApplied:      overrideApplied,
		OverrideNote:         req.OverrideNote,
		PaydayIso:            payday.Format("2006-01-02"),
		PaydayShiftedFromWk:  shifted,
		LivingStartIso:       livingStart.Format("2006-01-02"),
		LivingEndIso:         livingEnd.Format("2006-01-02"),
		NextPaydayIso:        nextPayday.Format("2006-01-02"),
		CycleTemporalState:   temporalState,
		DaysUntilCycleStart:  daysUntilStart,
		CurrentDayIndex:      currentDayIndex,
		MaturityMonth:        nextM,
		MaturityYear:         nextY,
		TotalCycleDays:       totalDays,
		RemainingDays:        remDays,
		ElapsedDays:          elapsedDays,
		RemainingWeekdays:    remWeekdays,
		RemainingWeekends:    remWeekends,
		WeekdaySafeRateRp:    weekdayRate,
		WeekendSafeRateRp:    weekendRate,
		FlatDailyRateRp:      flatRate,
		WeekendMultiplier:    mult,
	}
}

func EvaluateConfiguredWaterfall(req WaterfallConfigRequest) WaterfallConfigResult {
	income := req.FinalTotalIncomeRp
	if income < 0 {
		income = 0
	}
	debt := req.TotalDebtObligationsRp
	if debt < 0 {
		debt = 0
	}
	routine := req.RoutineQuotasTotalRp
	if routine < 0 {
		routine = 0
	}
	dailyTarget := req.DailyLivingTargetRp
	if dailyTarget < 0 {
		dailyTarget = 0
	}
	bufferTarget := req.BufferTargetRp
	if bufferTarget < 0 {
		bufferTarget = 0
	}
	p1Target := req.CoreSavingsP1TargetRp
	if p1Target < 0 {
		p1Target = 0
	}

	// Proportional Living Cash Law (int64 exact arithmetic):
	// Debt -> Routine -> Proportional Living Cash -> Buffer -> P1 Savings -> P2 Self-Reward
	availableForLiving := income - debt - routine
	if availableForLiving < 0 {
		availableForLiving = 0
	}
	dailyFunded := dailyTarget
	if availableForLiving < dailyFunded {
		dailyFunded = availableForLiving
	}
	remainingAfterLiving := availableForLiving - dailyFunded
	bufferFunded := bufferTarget
	if remainingAfterLiving < bufferFunded {
		bufferFunded = remainingAfterLiving
	}
	surplus := remainingAfterLiving - bufferFunded
	if surplus < 0 {
		surplus = 0
	}

	mandatory := debt + routine + dailyTarget + bufferTarget
	available := income - mandatory

	var deficit, p1Funded, p2Funded int64
	if available < 0 {
		deficit = -available
	} else {
		if surplus >= p1Target {
			p1Funded = p1Target
			p2Funded = surplus - p1Target
		} else {
			p1Funded = surplus
			p2Funded = 0
		}
	}

	return WaterfallConfigResult{
		FinalTotalIncomeRp:        income,
		DebtObligationsFundedRp:   debt,
		RoutineQuotasFundedRp:     routine,
		DailyLivingFundedRp:       dailyFunded,
		BufferFundedRp:            bufferFunded,
		CoreSavingsP1FundedRp:     p1Funded,
		SelfRewardP2FundedRp:      p2Funded,
		UncoveredDeficitRp:        deficit,
		AvailableAfterEssentialRp: available,
	}
}

func RouteTransactionToPaycycle(req RouteTxRequest) RouteTxResult {
	txDate, ok := parseIsoDate(req.TxDateIso)
	if !ok {
		txDate = time.Now().UTC()
	}
	day := txDate.Day()
	m := int(txDate.Month())
	y := txDate.Year()
	instUpper := strings.ToUpper(strings.TrimSpace(req.InstrumentType))

	cutoffDay := 0
	dueDay := 0
	dueRule := "FIXED_DAY"
	for _, r := range req.Rules {
		if !r.Active {
			continue
		}
		if strings.EqualFold(r.Type, instUpper) || (req.InstrumentName != "" && strings.EqualFold(r.Name, req.InstrumentName)) {
			cutoffDay = r.CutoffDay
			dueDay = r.DueDay
			if r.DueRule != "" {
				dueRule = r.DueRule
			}
			break
		}
	}
	if cutoffDay == 0 && dueDay == 0 {
		switch instUpper {
		case "PAYLATER", "SPAYLATER":
			cutoffDay = 15
			dueDay = 25
		case "CREDIT_CARD", "CC":
			cutoffDay = 20
			dueDay = 11
		case "CASH_LOAN", "SPINJAM":
			dueRule = "DISBURSEMENT_DAY"
			dueDay = day
		}
	}

	if instUpper == "CASH" {
		anchor := req.AnchorDay
		if anchor <= 0 {
			anchor = 27
		}
		// If txDate >= anchor, it belongs to Cycle(m,y); if < anchor, Cycle(m-1,y)
		targetM, targetY := m, y
		if day < anchor {
			targetM, targetY = addMonths(m, y, -1)
		}
		matM, matY := addMonths(targetM, targetY, 1)
		return RouteTxResult{
			TargetPeriodMonth: targetM,
			TargetPeriodYear:  targetY,
			TargetPeriodCode:  fmt.Sprintf("%02d/%d", targetM, targetY),
			MaturityMonth:     matM,
			MaturityYear:      matY,
			DueDay:            day,
			CutoffDay:         0,
			CrossedCutoff:     false,
			Explanation:       fmt.Sprintf("Cash transaction on %s falls inside Paycycle %02d/%d.", txDate.Format("2006-01-02"), targetM, targetY),
		}
	}

	if dueRule == "DISBURSEMENT_DAY" || instUpper == "CASH_LOAN" || instUpper == "SPINJAM" {
		// First installment matures in M+1 on disbursement day, funded by Paycycle(M) if dueDay < anchor, else Paycycle(M) still covers M+1 due dates < 25th
		firstDueM, firstDueY := addMonths(m, y, 1)
		targetM, targetY := addMonths(firstDueM, firstDueY, -1)
		return RouteTxResult{
			TargetPeriodMonth: targetM,
			TargetPeriodYear:  targetY,
			TargetPeriodCode:  fmt.Sprintf("%02d/%d", targetM, targetY),
			MaturityMonth:     firstDueM,
			MaturityYear:      firstDueY,
			DueDay:            dueDay,
			CutoffDay:         0,
			CrossedCutoff:     false,
			Explanation:       fmt.Sprintf("Disbursement-day loan on day %d matures %02d/%d on day %d, funded by Paycycle %02d/%d.", day, firstDueM, firstDueY, dueDay, targetM, targetY),
		}
	}

	if instUpper == "CREDIT_CARD" || instUpper == "CC" {
		// <= cutoff (20th): due 11th of M+1 -> funded by Paycycle M
		// > cutoff (21st+): due 11th of M+2 -> funded by Paycycle M+1
		crossed := day > cutoffDay
		offset := 0
		if crossed {
			offset = 1
		}
		targetM, targetY := addMonths(m, y, offset)
		matM, matY := addMonths(targetM, targetY, 1)
		return RouteTxResult{
			TargetPeriodMonth: targetM,
			TargetPeriodYear:  targetY,
			TargetPeriodCode:  fmt.Sprintf("%02d/%d", targetM, targetY),
			MaturityMonth:     matM,
			MaturityYear:      matY,
			DueDay:            dueDay,
			CutoffDay:         cutoffDay,
			CrossedCutoff:     crossed,
			Explanation:       fmt.Sprintf("Credit Card tx on day %d (cutoff %d) matures %d/%02d/%d -> funded by Paycycle %02d/%d.", day, cutoffDay, dueDay, matM, matY, targetM, targetY),
		}
	}

	// Default PAYLATER (15th cutoff, 25th due):
	// Before 15th (days 1..14) -> due 25th of M -> funded by Paycycle M-1!
	// On/after 15th (days 15..31) -> due 25th of M+1 -> funded by Paycycle M!
	crossed := day >= cutoffDay
	var targetM, targetY, matM, matY int
	if crossed {
		targetM, targetY = m, y
		matM, matY = addMonths(m, y, 1)
	} else {
		targetM, targetY = addMonths(m, y, -1)
		matM, matY = m, y
	}
	_ = strconv.Itoa(targetM)
	return RouteTxResult{
		TargetPeriodMonth: targetM,
		TargetPeriodYear:  targetY,
		TargetPeriodCode:  fmt.Sprintf("%02d/%d", targetM, targetY),
		MaturityMonth:     matM,
		MaturityYear:      matY,
		DueDay:            dueDay,
		CutoffDay:         cutoffDay,
		CrossedCutoff:     crossed,
		Explanation:       fmt.Sprintf("PayLater tx on day %d (cutoff %d) matures %d/%02d/%d -> funded by Paycycle %02d/%d.", day, cutoffDay, dueDay, matM, matY, targetM, targetY),
	}
}
