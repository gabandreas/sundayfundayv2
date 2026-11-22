package cutoff

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	"sundayfunday.erp/go-engine/internal/format"
)

type Instrument string

const (
	InstrumentSPayLater    Instrument = "SPAYLATER"
	InstrumentCreditCard   Instrument = "CREDIT_CARD"
	InstrumentSPinjam      Instrument = "SPINJAM"
	InstrumentPersonalDebt Instrument = "PERSONAL_DEBT"
	InstrumentCash         Instrument = "CASH"
)

type AmountMode string

const (
	AmountModePrincipalSplit AmountMode = "PRINCIPAL_SPLIT"
	AmountModeFixedMonthly   AmountMode = "FIXED_MONTHLY"
)

type CutoffRequest struct {
	Title                    string     `json:"title"`
	Instrument               Instrument `json:"instrument"`
	AmountMode               AmountMode `json:"amountMode"`
	PrincipalAmount          int64      `json:"principalAmount"`
	MonthlyAmount            int64      `json:"monthlyAmount"`
	TenorMonths              int        `json:"tenorMonths"`
	PurchaseDate             string     `json:"purchaseDate"` // YYYY-MM-DD
	DueDayOverride           int        `json:"dueDayOverride"`
	HoldPastCutoff           bool       `json:"holdPastCutoff"`
	StartMonthOverride       int        `json:"startMonthOverride"`
	StartYearOverride        int        `json:"startYearOverride"`
	PeriodNetIncome          int64      `json:"periodNetIncome"`
	CurrentPeriodObligations int64      `json:"currentPeriodObligations"`
	NextPeriodObligations    int64      `json:"nextPeriodObligations"`
	NextPeriodNetIncome      int64      `json:"nextPeriodNetIncome"`
	SafeHeadroom             int64      `json:"safeHeadroom"`
}

type ScheduleSlice struct {
	Index      int    `json:"index"`
	TotalTenor int    `json:"totalTenor"`
	SliceBadge string `json:"sliceBadge"`
	PeriodMonth int   `json:"periodMonth"`
	PeriodYear  int   `json:"periodYear"`
	PeriodLabel string `json:"periodLabel"`
	DueMonth   int    `json:"dueMonth"`
	DueYear    int    `json:"dueYear"`
	DueDay     int    `json:"dueDay"`
	DueDateIso string `json:"dueDateIso"`
	Amount     int64  `json:"amount"`
}

type CutoffResult struct {
	Instrument            Instrument      `json:"instrument"`
	AmountMode            AmountMode      `json:"amountMode"`
	TotalPrincipal        int64           `json:"totalPrincipal"`
	MonthlySliceFirst     int64           `json:"monthlySliceFirst"`
	MonthlySliceLast      int64           `json:"monthlySliceLast"`
	TenorMonths           int             `json:"tenorMonths"`
	CutoffDay             int             `json:"cutoffDay"`
	DueDay                int             `json:"dueDay"`
	CrossedCutoff         bool            `json:"crossedCutoff"`
	StartPeriodMonth      int             `json:"startPeriodMonth"`
	StartPeriodYear       int             `json:"startPeriodYear"`
	StartPeriodLabel      string          `json:"startPeriodLabel"`
	FirstDueMonth         int             `json:"firstDueMonth"`
	FirstDueYear          int             `json:"firstDueYear"`
	FirstDueDateIso       string          `json:"firstDueDateIso"`
	EndPeriodMonth        int             `json:"endPeriodMonth"`
	EndPeriodYear         int             `json:"endPeriodYear"`
	EndPeriodLabel        string          `json:"endPeriodLabel"`
	DsrBeforePercent      float64         `json:"dsrBeforePercent"`
	DsrAfterPercent       float64         `json:"dsrAfterPercent"`
	NextDsrAfterPercent   float64         `json:"nextDsrAfterPercent"`
	SafeHeadroomRemaining int64           `json:"safeHeadroomRemaining"`
	DaysUntilCutoff       int             `json:"daysUntilCutoff"`
	Verdict               string          `json:"verdict"` // SAFE | CAUTION | WAIT_PAST_CUTOFF | OVER_LIMIT
	Advice                string          `json:"advice"`
	RoutingSummary        string          `json:"routingSummary"`
	Slices                []ScheduleSlice `json:"slices"`
}

var monthShort = []string{
	"JAN", "FEB", "MAR", "APR", "MAY", "JUN",
	"JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
}

func FormatPeriodLabel(m, y int) string {
	if m < 1 || m > 12 {
		return fmt.Sprintf("%02d/%d", m, y)
	}
	return fmt.Sprintf("%s '%02d", monthShort[m-1], y%100)
}

func AddMonths(m, y, offset int) (int, int) {
	total := y*12 + (m - 1) + offset
	newY := total / 12
	newM := (total % 12)
	if newM < 0 {
		newM += 12
		newY--
	}
	return newM + 1, newY
}

func daysInMonth(m, y int) int {
	switch m {
	case 1, 3, 5, 7, 8, 10, 12:
		return 31
	case 4, 6, 9, 11:
		return 30
	case 2:
		if (y%4 == 0 && y%100 != 0) || (y%400 == 0) {
			return 29
		}
		return 28
	default:
		return 30
	}
}

func parseDateParts(iso string) (int, int, int, bool) {
	datePart := strings.Split(strings.TrimSpace(iso), "T")[0]
	parts := strings.Split(datePart, "-")
	if len(parts) != 3 {
		return 0, 0, 0, false
	}
	y, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	d, err3 := strconv.Atoi(parts[2])
	if err1 != nil || err2 != nil || err3 != nil || m < 1 || m > 12 || d < 1 || d > 31 {
		return 0, 0, 0, false
	}
	return y, m, d, true
}

// ComputeSlices performs exact int64 lossless distribution.
// Remainder (+1 Rp) is assigned to the earliest slices so sum(slices) == principalAmount exactly.
func ComputeSlices(principal int64, monthly int64, tenor int, mode AmountMode) ([]int64, int64) {
	if tenor < 1 {
		tenor = 1
	}
	slices := make([]int64, tenor)
	if mode == AmountModeFixedMonthly && monthly > 0 {
		for i := 0; i < tenor; i++ {
			slices[i] = monthly
		}
		return slices, monthly * int64(tenor)
	}

	if principal <= 0 && monthly > 0 {
		for i := 0; i < tenor; i++ {
			slices[i] = monthly
		}
		return slices, monthly * int64(tenor)
	}

	if principal < 0 {
		principal = 0
	}
	base := principal / int64(tenor)
	rem := int(principal % int64(tenor))
	for i := 0; i < tenor; i++ {
		if i < rem {
			slices[i] = base + 1
		} else {
			slices[i] = base
		}
	}
	return slices, principal
}

func round1Decimal(v float64) float64 {
	return math.Round(v*10) / 10
}

func SimulateCutoff(req CutoffRequest) CutoffResult {
	tenor := req.TenorMonths
	if tenor < 1 {
		tenor = 1
	}
	if tenor > 60 {
		tenor = 60
	}

	inst := req.Instrument
	if inst == "" {
		inst = InstrumentSPayLater
	}

	mode := req.AmountMode
	if mode == "" {
		if req.PrincipalAmount > 0 {
			mode = AmountModePrincipalSplit
		} else {
			mode = AmountModeFixedMonthly
		}
	}

	rawAmounts, totalPrincipal := ComputeSlices(req.PrincipalAmount, req.MonthlyAmount, tenor, mode)
	firstSlice := rawAmounts[0]
	lastSlice := rawAmounts[tenor-1]

	pY, pM, pD, hasDate := parseDateParts(req.PurchaseDate)
	if !hasDate {
		pY, pM, pD = 2026, 11, 18
	}

	var cutoffDay int
	var dueDay int
	var crossedCutoff bool
	var startPeriodM, startPeriodY int
	var daysUntilCutoff int

	switch inst {
	case InstrumentCreditCard:
		cutoffDay = 20
		dueDay = 11
		if req.DueDayOverride >= 1 && req.DueDayOverride <= 31 {
			dueDay = req.DueDayOverride
		}
		// Days 1-20 of month M bill 11th of Month M+1 (Period M+1).
		// Days 21-31 cross cutoff and bill 11th of Month M+2 (Period M+2).
		if pD > 20 {
			crossedCutoff = true
			startPeriodM, startPeriodY = AddMonths(pM, pY, 2)
			daysUntilCutoff = (daysInMonth(pM, pY) - pD) + 20
		} else {
			crossedCutoff = false
			startPeriodM, startPeriodY = AddMonths(pM, pY, 1)
			daysUntilCutoff = 20 - pD
		}
	case InstrumentSPinjam, InstrumentPersonalDebt:
		cutoffDay = pD
		if req.DueDayOverride >= 1 && req.DueDayOverride <= 31 {
			dueDay = req.DueDayOverride
		} else {
			dueDay = pD
		}
		crossedCutoff = false
		startPeriodM, startPeriodY = AddMonths(pM, pY, 1)
		daysUntilCutoff = 0
	case InstrumentCash:
		cutoffDay = 0
		dueDay = pD
		crossedCutoff = false
		startPeriodM, startPeriodY = pM, pY
		daysUntilCutoff = 0
	default: // SPAYLATER
		cutoffDay = 15
		dueDay = 25
		if req.DueDayOverride >= 1 && req.DueDayOverride <= 31 {
			dueDay = req.DueDayOverride
		}
		// Days 1-14 of Month M bill 25th of Month M (Period M).
		// Days 15-31 of Month M cross cutoff and bill 25th of Month M+1 (Period M+1).
		if pD >= 15 {
			crossedCutoff = true
			startPeriodM, startPeriodY = AddMonths(pM, pY, 1)
			daysUntilCutoff = (daysInMonth(pM, pY) - pD) + 15
		} else {
			crossedCutoff = false
			startPeriodM, startPeriodY = pM, pY
			daysUntilCutoff = 15 - pD
		}
	}

	if req.StartMonthOverride >= 1 && req.StartMonthOverride <= 12 && req.StartYearOverride >= 2000 {
		startPeriodM = req.StartMonthOverride
		startPeriodY = req.StartYearOverride
	}

	if req.HoldPastCutoff {
		startPeriodM, startPeriodY = AddMonths(startPeriodM, startPeriodY, 1)
		crossedCutoff = true
	}

	slices := make([]ScheduleSlice, tenor)
	for i := 0; i < tenor; i++ {
		pMonth, pYear := AddMonths(startPeriodM, startPeriodY, i)
		// Under Consumption & Bill-Maturity Month = Period M: DueMonth == PeriodMonth
		dMonth, dYear := pMonth, pYear
		clampedDay := dueDay
		dim := daysInMonth(dMonth, dYear)
		if clampedDay > dim {
			clampedDay = dim
		}
		slices[i] = ScheduleSlice{
			Index:       i + 1,
			TotalTenor:  tenor,
			SliceBadge:  fmt.Sprintf("%d/%d", i+1, tenor),
			PeriodMonth: pMonth,
			PeriodYear:  pYear,
			PeriodLabel: FormatPeriodLabel(pMonth, pYear),
			DueMonth:    dMonth,
			DueYear:     dYear,
			DueDay:      clampedDay,
			DueDateIso:  fmt.Sprintf("%04d-%02d-%02d", dYear, dMonth, clampedDay),
			Amount:      rawAmounts[i],
		}
	}

	firstSliceInfo := slices[0]
	lastSliceInfo := slices[tenor-1]

	dsrBefore := 0.0
	dsrAfter := 0.0
	if req.PeriodNetIncome > 0 {
		dsrBefore = round1Decimal((float64(req.CurrentPeriodObligations) / float64(req.PeriodNetIncome)) * 100.0)
		dsrAfter = round1Decimal((float64(req.CurrentPeriodObligations+firstSlice) / float64(req.PeriodNetIncome)) * 100.0)
	}
	nextIncome := req.NextPeriodNetIncome
	if nextIncome <= 0 {
		nextIncome = req.PeriodNetIncome
	}
	nextDsrAfter := 0.0
	if nextIncome > 0 {
		nextDsrAfter = round1Decimal((float64(req.NextPeriodObligations+firstSlice) / float64(nextIncome)) * 100.0)
	}

	safeHeadroomRemaining := req.SafeHeadroom - firstSlice
	verdict := "SAFE"
	advice := "Fits within current period safe debt envelope."

	if inst != InstrumentCash && firstSlice > 0 {
		waitAvailable := !crossedCutoff && daysUntilCutoff > 0 && daysUntilCutoff <= 5
		if req.SafeHeadroom > 0 && firstSlice > req.SafeHeadroom {
			if waitAvailable && (req.NextPeriodObligations+firstSlice) < req.CurrentPeriodObligations {
				verdict = "WAIT_PAST_CUTOFF"
				advice = fmt.Sprintf("Wait %d day(s) until %dth cutoff so the first slice bills into the lighter %s cycle.", daysUntilCutoff+1, cutoffDay, FormatPeriodLabel(firstSliceInfo.PeriodMonth, firstSliceInfo.PeriodYear))
				// Preview shifted period name
				nm, ny := AddMonths(firstSliceInfo.PeriodMonth, firstSliceInfo.PeriodYear, 1)
				advice = fmt.Sprintf("Wait %d day(s) past the %dth cutoff to defer billing into %s.", daysUntilCutoff+1, cutoffDay, FormatPeriodLabel(nm, ny))
			} else {
				verdict = "OVER_LIMIT"
				advice = fmt.Sprintf("Exceeds safe headroom by Rp %s. Defer or extend tenor.", format.Rp(firstSlice-req.SafeHeadroom))
			}
		} else if dsrAfter >= 45.0 {
			if waitAvailable {
				verdict = "WAIT_PAST_CUTOFF"
				nm, ny := AddMonths(firstSliceInfo.PeriodMonth, firstSliceInfo.PeriodYear, 1)
				advice = fmt.Sprintf("DSR reaches %.1f%%. Waiting %d day(s) past the %dth cutoff shifts 1st charge to %s.", dsrAfter, daysUntilCutoff+1, cutoffDay, FormatPeriodLabel(nm, ny))
			} else {
				verdict = "CAUTION"
				advice = fmt.Sprintf("First slice lifts DSR to %.1f%% in %s.", dsrAfter, firstSliceInfo.PeriodLabel)
			}
		} else if dsrAfter >= 32.0 {
			verdict = "CAUTION"
			advice = fmt.Sprintf("Manageable, lifts %s DSR from %.1f%% to %.1f%%.", firstSliceInfo.PeriodLabel, dsrBefore, dsrAfter)
		} else if crossedCutoff {
			verdict = "SAFE"
			advice = fmt.Sprintf("Post-%dth cutoff purchase: bills in %s (due %s).", cutoffDay, firstSliceInfo.PeriodLabel, firstSliceInfo.DueDateIso)
		}
	}

	routingSummary := fmt.Sprintf("%s (%s) · %s -> %s (due %s)",
		firstSliceInfo.PeriodLabel,
		firstSliceInfo.SliceBadge,
		FormatPeriodLabel(pM, pY),
		firstSliceInfo.PeriodLabel,
		firstSliceInfo.DueDateIso,
	)
	if tenor > 1 {
		routingSummary = fmt.Sprintf("%dx slices (%s -> %s), 1st due %s",
			tenor,
			firstSliceInfo.PeriodLabel,
			lastSliceInfo.PeriodLabel,
			firstSliceInfo.DueDateIso,
		)
	}

	return CutoffResult{
		Instrument:            inst,
		AmountMode:            mode,
		TotalPrincipal:        totalPrincipal,
		MonthlySliceFirst:     firstSlice,
		MonthlySliceLast:      lastSlice,
		TenorMonths:           tenor,
		CutoffDay:             cutoffDay,
		DueDay:                dueDay,
		CrossedCutoff:         crossedCutoff,
		StartPeriodMonth:      firstSliceInfo.PeriodMonth,
		StartPeriodYear:       firstSliceInfo.PeriodYear,
		StartPeriodLabel:      firstSliceInfo.PeriodLabel,
		FirstDueMonth:         firstSliceInfo.DueMonth,
		FirstDueYear:          firstSliceInfo.DueYear,
		FirstDueDateIso:       firstSliceInfo.DueDateIso,
		EndPeriodMonth:        lastSliceInfo.PeriodMonth,
		EndPeriodYear:         lastSliceInfo.PeriodYear,
		EndPeriodLabel:        lastSliceInfo.PeriodLabel,
		DsrBeforePercent:      dsrBefore,
		DsrAfterPercent:       dsrAfter,
		NextDsrAfterPercent:   nextDsrAfter,
		SafeHeadroomRemaining: safeHeadroomRemaining,
		DaysUntilCutoff:       daysUntilCutoff,
		Verdict:               verdict,
		Advice:                advice,
		RoutingSummary:        routingSummary,
		Slices:                slices,
	}
}
