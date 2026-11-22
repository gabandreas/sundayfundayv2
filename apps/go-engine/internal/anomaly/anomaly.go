package anomaly

import (
	"fmt"
	"math"
	"strings"

	"sundayfunday.erp/go-engine/internal/format"
)

type CashTxSample struct {
	ID       int    `json:"id"`
	Label    string `json:"label"`
	Category string `json:"category"`
	AmountRp int64  `json:"amountRp"`
	DateIso  string `json:"dateIso"`
}

type PostCutoffItem struct {
	Title          string `json:"title"`
	Instrument     string `json:"instrument"` // SPAYLATER | CREDIT_CARD
	PurchaseDay    int    `json:"purchaseDay"`
	AmountRp       int64  `json:"amountRp"`
	NextPeriodLabel string `json:"nextPeriodLabel"`
}

type RecurringCharge struct {
	Label       string `json:"label"`
	Category    string `json:"category"`
	AmountRp    int64  `json:"amountRp"`
	PrevAmountRp int64 `json:"prevAmountRp"`
}

type AnomalyRequest struct {
	PeriodLabel          string            `json:"periodLabel"`
	TotalCycleDays       int               `json:"totalCycleDays"`
	ElapsedDays          int               `json:"elapsedDays"`
	DailyLivingBudgetRp  int64             `json:"dailyLivingBudgetRp"`
	DailyLivingSpentRp   int64             `json:"dailyLivingSpentRp"`
	BaselineDailyRateRp  int64             `json:"baselineDailyRateRp"`
	CashTransactions     []CashTxSample    `json:"cashTransactions"`
	PostCutoffItems      []PostCutoffItem  `json:"postCutoffItems"`
	RecurringCharges     []RecurringCharge `json:"recurringCharges"`
}

type AnomalyAlert struct {
	Code        string `json:"code"`     // DAILY_BURN_SPIKE | POST_CUTOFF_DEBT_CREEP | SUBSCRIPTION_CREEP
	Severity    string `json:"severity"` // INFO | CAUTION | CRITICAL
	Title       string `json:"title"`
	Description string `json:"description"`
	AmountRp    int64  `json:"amountRp"`
}

type AnomalyResult struct {
	BurnVelocityIndex   float64        `json:"burnVelocityIndex"`
	PctBudgetConsumed   float64        `json:"pctBudgetConsumed"`
	PctCycleElapsed     float64        `json:"pctCycleElapsed"`
	VelocityStatus      string         `json:"velocityStatus"` // SAFE | CAUTION | BURNING_FAST
	PostCutoffCreepRp   int64          `json:"postCutoffCreepRp"`
	SubscriptionCreepRp int64          `json:"subscriptionCreepRp"`
	AlertCount          int            `json:"alertCount"`
	Alerts              []AnomalyAlert `json:"alerts"`
}

func EvaluateAnomalies(req AnomalyRequest) AnomalyResult {
	totalDays := req.TotalCycleDays
	if totalDays <= 0 {
		totalDays = 30
	}
	elapsed := req.ElapsedDays
	if elapsed < 1 {
		elapsed = 1
	}
	if elapsed > totalDays {
		elapsed = totalDays
	}

	pctElapsed := float64(elapsed) / float64(totalDays) * 100.0
	var pctConsumed float64
	if req.DailyLivingBudgetRp > 0 {
		pctConsumed = float64(req.DailyLivingSpentRp) / float64(req.DailyLivingBudgetRp) * 100.0
	}

	velocity := 0.0
	if pctElapsed > 0 {
		velocity = math.Round((pctConsumed/pctElapsed)*100.0) / 100.0
	}

	status := "SAFE"
	if velocity > 1.25 {
		status = "BURNING_FAST"
	} else if velocity > 1.05 {
		status = "CAUTION"
	}

	alerts := make([]AnomalyAlert, 0)

	// 1. Daily Burn & Category Velocity Spikes
	dailyRate := req.BaselineDailyRateRp
	if dailyRate <= 0 && req.DailyLivingBudgetRp > 0 {
		dailyRate = req.DailyLivingBudgetRp / int64(totalDays)
	}
	if status == "BURNING_FAST" && req.DailyLivingSpentRp > 0 {
		alerts = append(alerts, AnomalyAlert{
			Code:        "DAILY_BURN_SPIKE",
			Severity:    "CRITICAL",
			Title:       "Daily Burn Exceeding Cycle Pace",
			Description: fmt.Sprintf("Living cash consumed %.1f%% of budget with %.1f%% of cycle elapsed (%.2fx pace).", pctConsumed, pctElapsed, velocity),
			AmountRp:    req.DailyLivingSpentRp,
		})
	} else if status == "CAUTION" {
		alerts = append(alerts, AnomalyAlert{
			Code:        "DAILY_BURN_SPIKE",
			Severity:    "CAUTION",
			Title:       "Elevated Living Spend Pace",
			Description: fmt.Sprintf("Living spend velocity is %.2fx above even daily pace.", velocity),
			AmountRp:    req.DailyLivingSpentRp,
		})
	}

	if dailyRate > 0 {
		for _, tx := range req.CashTransactions {
			if tx.AmountRp > dailyRate*2 && tx.AmountRp >= 100000 {
				alerts = append(alerts, AnomalyAlert{
					Code:        "DAILY_BURN_SPIKE",
					Severity:    "CAUTION",
					Title:       fmt.Sprintf("Single-Day Spend Spike: %s", tx.Label),
					Description: fmt.Sprintf("Transaction of Rp %s exceeds 2x daily baseline (Rp %s).", format.Rp(tx.AmountRp), format.Rp(dailyRate)),
					AmountRp:    tx.AmountRp,
				})
			}
		}
	}

	// 2. Silent Post-Cutoff Debt Creep
	var postCutoffTotal int64
	for _, item := range req.PostCutoffItems {
		isPost := false
		if strings.EqualFold(item.Instrument, "SPAYLATER") && item.PurchaseDay >= 15 {
			isPost = true
		} else if strings.EqualFold(item.Instrument, "CREDIT_CARD") && item.PurchaseDay > 20 {
			isPost = true
		}
		if isPost && item.AmountRp > 0 {
			postCutoffTotal += item.AmountRp
		}
	}
	if postCutoffTotal > 0 {
		alerts = append(alerts, AnomalyAlert{
			Code:        "POST_CUTOFF_DEBT_CREEP",
			Severity:    "CAUTION",
			Title:       "Post-Cutoff BNPL / Card Creep",
			Description: fmt.Sprintf("Rp %s of post-cutoff charges silently stacked into upcoming due horizon.", format.Rp(postCutoffTotal)),
			AmountRp:    postCutoffTotal,
		})
	}

	// 3. Subscription / Recurring Creep
	catCounts := map[string]int{}
	catSums := map[string]int64{}
	var subCreepTotal int64
	for _, rc := range req.RecurringCharges {
		cat := strings.ToLower(strings.TrimSpace(rc.Category))
		if cat == "" {
			cat = "general"
		}
		catCounts[cat]++
		catSums[cat] += rc.AmountRp
		if rc.PrevAmountRp > 0 && rc.AmountRp > rc.PrevAmountRp {
			subCreepTotal += rc.AmountRp - rc.PrevAmountRp
		}
	}
	for cat, cnt := range catCounts {
		if cnt >= 2 && cat != "general" {
			alerts = append(alerts, AnomalyAlert{
				Code:        "SUBSCRIPTION_CREEP",
				Severity:    "INFO",
				Title:       fmt.Sprintf("Multiple Recurring Charges (%s)", strings.ToUpper(cat[:1])+cat[1:]),
				Description: fmt.Sprintf("%d active charges totaling Rp %s in the same category this cycle.", cnt, format.Rp(catSums[cat])),
				AmountRp:    catSums[cat],
			})
		}
	}
	if subCreepTotal > 0 {
		alerts = append(alerts, AnomalyAlert{
			Code:        "SUBSCRIPTION_CREEP",
			Severity:    "CAUTION",
			Title:       "Recurring Price / Tier Creep",
			Description: fmt.Sprintf("Recurring bills increased by +Rp %s versus prior cycle.", format.Rp(subCreepTotal)),
			AmountRp:    subCreepTotal,
		})
	}

	return AnomalyResult{
		BurnVelocityIndex:   velocity,
		PctBudgetConsumed:   math.Round(pctConsumed*10.0) / 10.0,
		PctCycleElapsed:     math.Round(pctElapsed*10.0) / 10.0,
		VelocityStatus:      status,
		PostCutoffCreepRp:   postCutoffTotal,
		SubscriptionCreepRp: subCreepTotal,
		AlertCount:          len(alerts),
		Alerts:              alerts,
	}
}
