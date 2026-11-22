package timeline

import (
	"fmt"
	"math"
	"sort"

	"sundayfunday.erp/go-engine/internal/format"
)

type CashflowWaveInput struct {
	DateIso    string `json:"dateIso"`
	Label      string `json:"label"`
	Category   string `json:"category"` // INFLOW | LIABILITY | ROUTINE | LIVING | SAVINGS
	Amount     int64  `json:"amount"`   // positive = inflow, negative = outflow
	IsConfirmed bool  `json:"isConfirmed"`
}

type TimelineSimulateRequest struct {
	PeriodMonth             int                 `json:"periodMonth"`
	PeriodYear              int                 `json:"periodYear"`
	PaycheckDateIso         string              `json:"paycheckDateIso"`
	PaycheckAmount          int64               `json:"paycheckAmount"`
	ThrDateIso              string              `json:"thrDateIso"`
	ThrAmount               int64               `json:"thrAmount"`
	NextPaycheckDateIso     string              `json:"nextPaycheckDateIso"`
	NextPaycheckAmount      int64               `json:"nextPaycheckAmount"`
	TotalPaylaterDue        int64               `json:"totalPaylaterDue"`
	PaylaterDueDateIso      string              `json:"paylaterDueDateIso"`
	TotalCreditCardDue      int64               `json:"totalCreditCardDue"`
	CreditCardDueDateIso    string              `json:"creditCardDueDateIso"`
	TotalPersonalDebtDue    int64               `json:"totalPersonalDebtDue"`
	PersonalDebtDueDateIso  string              `json:"personalDebtDueDateIso"`
	PersonalDebtItems       []CashflowWaveInput `json:"personalDebtItems,omitempty"`
	DailyLivingPool         int64               `json:"dailyLivingPool"`
	RoutineBillsPool        int64               `json:"routineBillsPool"`
	CoreSavingsTarget       int64               `json:"coreSavingsTarget"`
	SpaylaterEarlyPayAmount int64               `json:"spaylaterEarlyPayAmount"`
	CustomEvents            []CashflowWaveInput `json:"customEvents"`
}

type TimelineEvent struct {
	Sequence       int    `json:"sequence"`
	DateIso        string `json:"dateIso"`
	Label          string `json:"label"`
	Category       string `json:"category"`
	WaveGroup      string `json:"waveGroup"`
	SignedAmount   int64  `json:"signedAmount"`
	RunningBalance int64  `json:"runningBalance"`
	IsBridgeWindow bool   `json:"isBridgeWindow"`
	Notes          string `json:"notes"`
}

type TimelineSimulateResult struct {
	Events                      []TimelineEvent `json:"events"`
	Wave1AvailableCash          int64           `json:"wave1AvailableCash"`
	PreThrBridgeMinimumBalance  int64           `json:"preThrBridgeMinimumBalance"`
	PostThrBalance              int64           `json:"postThrBalance"`
	PostPaylaterRemainingBalance int64          `json:"postPaylaterRemainingBalance"`
	SpaylaterEarlyPayApplied    int64           `json:"spaylaterEarlyPayApplied"`
	SpaylaterRemainingAfterEarly int64          `json:"spaylaterRemainingAfterEarly"`
	BridgeSafe                  bool            `json:"bridgeSafe"`
	BridgeRiskMessage           string          `json:"bridgeRiskMessage"`
}

type WalletGuardRequest struct {
	RemainingLivingCash   int64   `json:"remainingLivingCash"`
	ActualWalletBalance   int64   `json:"actualWalletBalance"`
	ReservedBillsTotal    int64   `json:"reservedBillsTotal"`
	DaysRemaining         int     `json:"daysRemaining"`
	RemainingWeekdays     int     `json:"remainingWeekdays"`
	RemainingWeekendDays  int     `json:"remainingWeekendDays"`
	WeekendMultiplier     float64 `json:"weekendMultiplier"`
	IsWeekendToday        bool    `json:"isWeekendToday"`
}

type WalletGuardResult struct {
	RemainingLivingCash   int64   `json:"remainingLivingCash"`
	ActualWalletBalance   int64   `json:"actualWalletBalance"`
	ReservedBillsTotal    int64   `json:"reservedBillsTotal"`
	FreeSpendableCash     int64   `json:"freeSpendableCash"`
	VarianceVsLedger      int64   `json:"varianceVsLedger"`
	GuardStatus           string  `json:"guardStatus"` // OPTIMAL | WATCH | SURVIVAL_GUARD
	EffectiveLivingBase   int64   `json:"effectiveLivingBase"`
	DailySafeFlat         int64   `json:"dailySafeFlat"`
	DailySafeWeekday      int64   `json:"dailySafeWeekday"`
	DailySafeWeekend      int64   `json:"dailySafeWeekend"`
	SafeToSpendToday      int64   `json:"safeToSpendToday"`
	Guidance              string  `json:"guidance"`
}

func SimulateTimeline(req TimelineSimulateRequest) TimelineSimulateResult {
	var events []CashflowWaveInput
	if len(req.CustomEvents) > 0 {
		events = append(events, req.CustomEvents...)
	} else {
		earlyPay := req.SpaylaterEarlyPayAmount
		if earlyPay < 0 {
			earlyPay = 0
		}
		if earlyPay > req.TotalPaylaterDue {
			earlyPay = req.TotalPaylaterDue
		}
		remPaylater := req.TotalPaylaterDue - earlyPay

		events = append(events, CashflowWaveInput{
			DateIso:    req.PaycheckDateIso,
			Label:      "Wave 1: Monthly Salary Payroll",
			Category:   "INFLOW",
			Amount:     req.PaycheckAmount,
			IsConfirmed: true,
		})
		if req.RoutineBillsPool > 0 {
			events = append(events, CashflowWaveInput{
				DateIso:  req.PaycheckDateIso,
				Label:    "Reserve Routine Bills Pool",
				Category: "ROUTINE",
				Amount:   -req.RoutineBillsPool,
			})
		}
		if req.DailyLivingPool > 0 {
			events = append(events, CashflowWaveInput{
				DateIso:  req.PaycheckDateIso,
				Label:    "Allocate 21-Day Living Bridge Allowance",
				Category: "LIVING",
				Amount:   -req.DailyLivingPool,
			})
		}
		if earlyPay > 0 {
			events = append(events, CashflowWaveInput{
				DateIso:  req.PaycheckDateIso,
				Label:    "Split-Pay Wave 1: Early SPayLater Set-Aside",
				Category: "LIABILITY",
				Amount:   -earlyPay,
			})
		}
		if len(req.PersonalDebtItems) > 0 {
			events = append(events, req.PersonalDebtItems...)
		} else if req.TotalPersonalDebtDue > 0 {
			events = append(events, CashflowWaveInput{
				DateIso:  req.PersonalDebtDueDateIso,
				Label:    "Personal Debt & SPinjam Maturities",
				Category: "LIABILITY",
				Amount:   -req.TotalPersonalDebtDue,
			})
		}
		if req.TotalCreditCardDue > 0 {
			events = append(events, CashflowWaveInput{
				DateIso:  req.CreditCardDueDateIso,
				Label:    "Credit Card Statement Due (11th)",
				Category: "LIABILITY",
				Amount:   -req.TotalCreditCardDue,
			})
		}
		if req.ThrAmount > 0 && req.ThrDateIso != "" {
			events = append(events, CashflowWaveInput{
				DateIso:  req.ThrDateIso,
				Label:    "Wave 2: December Natal THR / Windfall",
				Category: "INFLOW",
				Amount:   req.ThrAmount,
			})
		}
		if remPaylater > 0 {
			events = append(events, CashflowWaveInput{
				DateIso:  req.PaylaterDueDateIso,
				Label:    "SPayLater Final Settlement (25th)",
				Category: "LIABILITY",
				Amount:   -remPaylater,
			})
		}
		if req.CoreSavingsTarget > 0 {
			saveDate := req.ThrDateIso
			if saveDate == "" {
				saveDate = req.PaylaterDueDateIso
			}
			events = append(events, CashflowWaveInput{
				DateIso:  saveDate,
				Label:    "Core Savings Transfer (P1 Vault)",
				Category: "SAVINGS",
				Amount:   -req.CoreSavingsTarget,
			})
		}
		if req.NextPaycheckAmount > 0 && req.NextPaycheckDateIso != "" {
			events = append(events, CashflowWaveInput{
				DateIso:  req.NextPaycheckDateIso,
				Label:    "Next Cycle Paycheck Arrival",
				Category: "INFLOW",
				Amount:   req.NextPaycheckAmount,
			})
		}
	}

	sort.SliceStable(events, func(i, j int) bool {
		if events[i].DateIso == events[j].DateIso {
			return events[i].Amount > events[j].Amount
		}
		return events[i].DateIso < events[j].DateIso
	})

	var running int64
	minBridge := int64(math.MaxInt64)
	postThr := int64(0)
	postPaylater := int64(0)
	wave1Available := req.PaycheckAmount

	out := make([]TimelineEvent, 0, len(events))
	for i, ev := range events {
		running += ev.Amount
		inBridge := req.ThrDateIso != "" && ev.DateIso <= req.ThrDateIso
		if inBridge && running < minBridge {
			minBridge = running
		}
		if ev.DateIso == req.ThrDateIso && ev.Amount > 0 {
			postThr = running
		}
		if ev.DateIso == req.PaylaterDueDateIso {
			postPaylater = running
		}

		waveGroup := "WAVE_1"
		if req.ThrDateIso != "" && ev.DateIso >= req.ThrDateIso {
			waveGroup = "WAVE_2"
		}
		if req.NextPaycheckDateIso != "" && ev.DateIso >= req.NextPaycheckDateIso {
			waveGroup = "NEXT_CYCLE"
		}

		out = append(out, TimelineEvent{
			Sequence:       i + 1,
			DateIso:        ev.DateIso,
			Label:          ev.Label,
			Category:       ev.Category,
			WaveGroup:      waveGroup,
			SignedAmount:   ev.Amount,
			RunningBalance: running,
			IsBridgeWindow: inBridge,
			Notes:          fmt.Sprintf("Running cash: Rp %s", format.Rp(running)),
		})
	}
	if minBridge == math.MaxInt64 {
		minBridge = running
	}

	earlyApplied := req.SpaylaterEarlyPayAmount
	if earlyApplied < 0 {
		earlyApplied = 0
	}
	if earlyApplied > req.TotalPaylaterDue {
		earlyApplied = req.TotalPaylaterDue
	}

	bridgeSafe := minBridge >= 0
	msg := fmt.Sprintf("21-day bridge stays liquid with minimum cash cushion Rp %s.", format.Rp(minBridge))
	if !bridgeSafe {
		msg = fmt.Sprintf("Bridge shortage of Rp %s detected before THR wave. Reduce Wave 1 early PayLater paydown.", format.Rp(-minBridge))
	}

	return TimelineSimulateResult{
		Events:                       out,
		Wave1AvailableCash:           wave1Available,
		PreThrBridgeMinimumBalance:   minBridge,
		PostThrBalance:               postThr,
		PostPaylaterRemainingBalance: postPaylater,
		SpaylaterEarlyPayApplied:     earlyApplied,
		SpaylaterRemainingAfterEarly: req.TotalPaylaterDue - earlyApplied,
		BridgeSafe:                   bridgeSafe,
		BridgeRiskMessage:            msg,
	}
}

func EvaluateWalletGuard(req WalletGuardRequest) WalletGuardResult {
	freeCash := req.ActualWalletBalance - req.ReservedBillsTotal
	variance := freeCash - req.RemainingLivingCash

	effectiveBase := req.RemainingLivingCash
	if req.ActualWalletBalance > 0 && freeCash < effectiveBase {
		effectiveBase = freeCash
	}
	if effectiveBase < 0 {
		effectiveBase = 0
	}

	days := req.DaysRemaining
	if days < 1 {
		days = 1
	}
	mult := req.WeekendMultiplier
	if mult <= 0 {
		mult = 1.5
	}

	flat := effectiveBase / int64(days)
	weightedUnits := float64(req.RemainingWeekdays) + float64(req.RemainingWeekendDays)*mult
	if weightedUnits <= 0 {
		weightedUnits = float64(days)
	}
	weekdaySafe := int64(math.Round(float64(effectiveBase) / weightedUnits))
	weekendSafe := int64(math.Round((float64(effectiveBase) * mult) / weightedUnits))
	todaySafe := weekdaySafe
	if req.IsWeekendToday {
		todaySafe = weekendSafe
	}

	guardStatus := "OPTIMAL"
	guidance := "Actual free cash aligns with your planned living runway."

	if freeCash < 0 {
		guardStatus = "SURVIVAL_GUARD"
		guidance = fmt.Sprintf("Free spendable cash is Rp %s below reserved bills. Pause discretionary spending immediately.", format.Rp(-freeCash))
	} else if req.RemainingLivingCash > 0 {
		ratio := float64(freeCash) / float64(req.RemainingLivingCash)
		if ratio < 0.75 || variance <= -(todaySafe*2) {
			guardStatus = "SURVIVAL_GUARD"
			guidance = fmt.Sprintf("Wallet is Rp %s behind ledger plan. Cap daily spend at Rp %s.", format.Rp(-variance), format.Rp(todaySafe))
		} else if ratio < 0.92 || variance < 0 {
			guardStatus = "WATCH"
			guidance = fmt.Sprintf("Slight slippage of Rp %s vs ledger plan. Target <= Rp %s today.", format.Rp(-variance), format.Rp(todaySafe))
		} else if variance > 0 {
			guardStatus = "OPTIMAL"
			guidance = fmt.Sprintf("Surplus Rp %s above plan after bill reservations.", format.Rp(variance))
		}
	}

	return WalletGuardResult{
		RemainingLivingCash: req.RemainingLivingCash,
		ActualWalletBalance: req.ActualWalletBalance,
		ReservedBillsTotal:  req.ReservedBillsTotal,
		FreeSpendableCash:   freeCash,
		VarianceVsLedger:    variance,
		GuardStatus:         guardStatus,
		EffectiveLivingBase: effectiveBase,
		DailySafeFlat:       flat,
		DailySafeWeekday:    weekdaySafe,
		DailySafeWeekend:    weekendSafe,
		SafeToSpendToday:    todaySafe,
		Guidance:            guidance,
	}
}
