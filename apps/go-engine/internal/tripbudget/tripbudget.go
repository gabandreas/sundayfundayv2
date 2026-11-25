package tripbudget

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

type TripOptimizeRequest struct {
	EventType              string `json:"eventType"`
	DurationDays           int    `json:"durationDays"`
	StartDateIso           string `json:"startDateIso"`
	PrepaidCommittedRp     int64  `json:"prepaidCommittedRp"`
	CycleDiscretionaryRp   int64  `json:"cycleDiscretionaryRp"`
	CycleEmergencyBufferRp int64  `json:"cycleEmergencyBufferRp"`
	CycleCoreSavingsRp     int64  `json:"cycleCoreSavingsRp"`
	CashRadarLowestPointRp int64  `json:"cashRadarLowestPointRp"`
	RemainingDaysInCycle   int    `json:"remainingDaysInCycle"`
}

type TripCategoryCap struct {
	Category string `json:"category"`
	Label    string `json:"label"`
	AmountRp int64  `json:"amountRp"`
	SharePct int    `json:"sharePct"`
}

type TripDayCap struct {
	DayIndex         int    `json:"dayIndex"`
	DateIso          string `json:"dateIso"`
	IsWeekend        bool   `json:"isWeekend"`
	RecommendedCapRp int64  `json:"recommendedCapRp"`
}

type TripTierRecommendation struct {
	TierCode             string            `json:"tierCode"`
	Label                string            `json:"label"`
	VariableSpendCapRp   int64             `json:"variableSpendCapRp"`
	TotalCapRp           int64             `json:"totalCapRp"`
	DailyAverageCapRp    int64             `json:"dailyAverageCapRp"`
	PostTripLowestCashRp int64             `json:"postTripLowestCashRp"`
	UsesBufferRp         int64             `json:"usesBufferRp"`
	SavingsSafe          bool              `json:"savingsSafe"`
	Guidance             string            `json:"guidance"`
	CategorySplit        []TripCategoryCap `json:"categorySplit"`
	DailyPlan            []TripDayCap      `json:"dailyPlan"`
}

type TripOptimizeResult struct {
	EventType          string                 `json:"eventType"`
	DurationDays       int                    `json:"durationDays"`
	PrepaidCommittedRp int64                  `json:"prepaidCommittedRp"`
	RecommendedTier    string                 `json:"recommendedTier"`
	Conservative       TripTierRecommendation `json:"conservative"`
	Balanced           TripTierRecommendation `json:"balanced"`
	MaxSafe            TripTierRecommendation `json:"maxSafe"`
}

type categoryWeight struct {
	code  string
	label string
	pct   int
}

func resolveCategoryWeights(eventType string) []categoryWeight {
	switch strings.ToUpper(strings.TrimSpace(eventType)) {
	case "WEEKEND_TRIP":
		return []categoryWeight{
			{code: "FOOD_DRINK", label: "Food & Drinks", pct: 38},
			{code: "LOCAL_TRANSPORT", label: "Local Transport", pct: 22},
			{code: "ACTIVITIES", label: "Activities & Stay", pct: 28},
			{code: "CONTINGENCY", label: "Contingency", pct: 12},
		}
	case "VACATION":
		return []categoryWeight{
			{code: "FOOD_DRINK", label: "Food & Drinks", pct: 34},
			{code: "LOCAL_TRANSPORT", label: "Local Transport", pct: 24},
			{code: "ACTIVITIES", label: "Activities & Stay", pct: 30},
			{code: "CONTINGENCY", label: "Contingency", pct: 12},
		}
	case "CONCERT_EVENT":
		return []categoryWeight{
			{code: "FOOD_DRINK", label: "Food & Drinks", pct: 30},
			{code: "LOCAL_TRANSPORT", label: "Local Transport", pct: 20},
			{code: "ACTIVITIES", label: "Tickets & Merch", pct: 38},
			{code: "CONTINGENCY", label: "Contingency", pct: 12},
		}
	default:
		return []categoryWeight{
			{code: "FOOD_DRINK", label: "Food & Drinks", pct: 45},
			{code: "LOCAL_TRANSPORT", label: "Local Transport", pct: 20},
			{code: "ACTIVITIES", label: "Activities & Entry", pct: 20},
			{code: "CONTINGENCY", label: "Contingency", pct: 15},
		}
	}
}

func allocateLossless(total int64, weights []int64) []int64 {
	n := len(weights)
	out := make([]int64, n)
	if n == 0 || total <= 0 {
		return out
	}
	var sumW int64
	for _, w := range weights {
		if w > 0 {
			sumW += w
		}
	}
	if sumW <= 0 {
		out[0] = total
		return out
	}

	type remPair struct {
		idx int
		rem int64
	}
	rems := make([]remPair, n)
	var assigned int64
	for i, w := range weights {
		safeW := w
		if safeW < 0 {
			safeW = 0
		}
		num := total * safeW
		q := num / sumW
		out[i] = q
		assigned += q
		rems[i] = remPair{idx: i, rem: num % sumW}
	}

	leftover := total - assigned
	sort.Slice(rems, func(i, j int) bool {
		if rems[i].rem != rems[j].rem {
			return rems[i].rem > rems[j].rem
		}
		return rems[i].idx < rems[j].idx
	})
	for i := int64(0); i < leftover && int(i) < n; i++ {
		out[rems[i].idx]++
	}
	return out
}

func buildTier(
	code string,
	label string,
	variableCap int64,
	prepaid int64,
	durationDays int,
	dayInfos []struct {
		iso     string
		weekend bool
		weight  int64
	},
	catWeights []categoryWeight,
	disc int64,
	lowestCash int64,
	guidance string,
) TripTierRecommendation {
	catW := make([]int64, len(catWeights))
	for i, c := range catWeights {
		catW[i] = int64(c.pct)
	}
	catAmts := allocateLossless(variableCap, catW)
	cats := make([]TripCategoryCap, len(catWeights))
	for i, c := range catWeights {
		cats[i] = TripCategoryCap{
			Category: c.code,
			Label:    c.label,
			AmountRp: catAmts[i],
			SharePct: c.pct,
		}
	}

	dayW := make([]int64, len(dayInfos))
	for i, d := range dayInfos {
		dayW[i] = d.weight
	}
	dayAmts := allocateLossless(variableCap, dayW)
	days := make([]TripDayCap, len(dayInfos))
	for i, d := range dayInfos {
		days[i] = TripDayCap{
			DayIndex:         i + 1,
			DateIso:          d.iso,
			IsWeekend:        d.weekend,
			RecommendedCapRp: dayAmts[i],
		}
	}

	usesBuf := int64(0)
	if variableCap > disc {
		usesBuf = variableCap - disc
	}
	postLowest := lowestCash - variableCap
	dailyAvg := int64(0)
	if durationDays > 0 {
		dailyAvg = (variableCap + int64(durationDays)/2) / int64(durationDays)
	}

	return TripTierRecommendation{
		TierCode:             code,
		Label:                label,
		VariableSpendCapRp:   variableCap,
		TotalCapRp:           variableCap + prepaid,
		DailyAverageCapRp:    dailyAvg,
		PostTripLowestCashRp: postLowest,
		UsesBufferRp:         usesBuf,
		SavingsSafe:          usesBuf == 0 && postLowest >= 0,
		Guidance:             guidance,
		CategorySplit:        cats,
		DailyPlan:            days,
	}
}

func OptimizeTripBudget(req TripOptimizeRequest) TripOptimizeResult {
	dur := req.DurationDays
	if dur < 1 {
		dur = 1
	}
	if dur > 30 {
		dur = 30
	}

	eventType := strings.ToUpper(strings.TrimSpace(req.EventType))
	if eventType == "" {
		eventType = "DAY_OUTING"
	}

	prepaid := req.PrepaidCommittedRp
	if prepaid < 0 {
		prepaid = 0
	}
	disc := req.CycleDiscretionaryRp
	if disc < 0 {
		disc = 0
	}
	buf := req.CycleEmergencyBufferRp
	if buf < 0 {
		buf = 0
	}
	lowest := req.CashRadarLowestPointRp
	headroom := lowest
	if headroom < 0 {
		headroom = 0
	}

	startStr := strings.TrimSpace(req.StartDateIso)
	if len(startStr) > 10 {
		startStr = startStr[:10]
	}
	startTime, err := time.Parse("2006-01-02", startStr)
	if err != nil {
		startTime = time.Date(2026, 12, 5, 0, 0, 0, 0, time.UTC)
	}

	weekendBoost := int64(120)
	if eventType == "VACATION" || eventType == "WEEKEND_TRIP" {
		weekendBoost = 135
	}

	dayInfos := make([]struct {
		iso     string
		weekend bool
		weight  int64
	}, dur)
	for i := 0; i < dur; i++ {
		dt := startTime.AddDate(0, 0, i)
		wd := dt.Weekday()
		isWknd := wd == time.Saturday || wd == time.Sunday
		w := int64(100)
		if isWknd && dur > 1 {
			w = weekendBoost
		}
		dayInfos[i] = struct {
			iso     string
			weekend bool
			weight  int64
		}{
			iso:     dt.Format("2006-01-02"),
			weekend: isWknd,
			weight:  w,
		}
	}

	catWeights := resolveCategoryWeights(eventType)

	rawCons := (disc*45 + 50) / 100
	var consVar int64
	if lowest >= 0 {
		if rawCons < headroom {
			consVar = rawCons
		} else {
			consVar = headroom
		}
	} else {
		consVar = 0
	}

	rawBal := (disc*75 + 50) / 100
	var balVar int64
	if lowest >= 0 {
		if rawBal < headroom {
			balVar = rawBal
		} else {
			balVar = headroom
		}
		if balVar < consVar {
			balVar = consVar
		}
	} else {
		balVar = consVar
	}

	rawMax := disc + (buf*50+50)/100
	maxVar := rawMax
	if maxVar < balVar {
		maxVar = balVar
	}

	recTier := "BALANCED"
	if balVar == 0 && consVar == 0 {
		recTier = "CONSERVATIVE"
	}

	cons := buildTier(
		"CONSERVATIVE",
		"Conservative",
		consVar,
		prepaid,
		dur,
		dayInfos,
		catWeights,
		disc,
		lowest,
		fmt.Sprintf("Uses 45%% of cycle discretionary cash while keeping Rp %d headroom before next payday.", lowest-consVar),
	)
	bal := buildTier(
		"BALANCED",
		"Optimal Recommended",
		balVar,
		prepaid,
		dur,
		dayInfos,
		catWeights,
		disc,
		lowest,
		fmt.Sprintf("Uses up to 75%% of discretionary surplus cleanly without touching Core Savings or dropping cycle lowest cash below zero."),
	)
	maxT := buildTier(
		"MAX_SAFE",
		"Max Safe Cap",
		maxVar,
		prepaid,
		dur,
		dayInfos,
		catWeights,
		disc,
		lowest,
		"Upper limit combining full discretionary surplus and half of cycle emergency buffer before risking core savings.",
	)

	return TripOptimizeResult{
		EventType:          eventType,
		DurationDays:       dur,
		PrepaidCommittedRp: prepaid,
		RecommendedTier:    recTier,
		Conservative:       cons,
		Balanced:           bal,
		MaxSafe:            maxT,
	}
}
