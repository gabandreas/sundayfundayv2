package envelopes

import "math"

type EnvelopeQuota struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	AllocatedRp    int64  `json:"allocatedRp"`
	SpentRp        int64  `json:"spentRp"`
	RolloverPolicy string `json:"rolloverPolicy"` // SWEEP_TO_P1 | ROLLOVER_NEXT_MONTH
}

type SinkingFundInput struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	TargetAmountRp   int64  `json:"targetAmountRp"`
	CurrentSavedRp   int64  `json:"currentSavedRp"`
	MonthsRemaining  int    `json:"monthsRemaining"`
}

type EnvelopesRequest struct {
	LiquidCashTotalRp   int64              `json:"liquidCashTotalRp"`
	DailyAverageBurnRp  int64              `json:"dailyAverageBurnRp"`
	MonthlyInflowRp     int64              `json:"monthlyInflowRp"`
	CycleElapsedDays    int                `json:"cycleElapsedDays"`
	CycleTotalDays      int                `json:"cycleTotalDays"`
	Envelopes           []EnvelopeQuota    `json:"envelopes"`
	SinkingFunds        []SinkingFundInput `json:"sinkingFunds"`
}

type EnvelopeRolloverEval struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	AllocatedRp       int64  `json:"allocatedRp"`
	SpentRp           int64  `json:"spentRp"`
	UnspentRp         int64  `json:"unspentRp"`
	RolloverPolicy    string `json:"rolloverPolicy"`
	SweptToP1Rp       int64  `json:"sweptToP1Rp"`
	RolledNextCycleRp int64  `json:"rolledNextCycleRp"`
}

type SinkingFundSchedule struct {
	ID                string  `json:"id"`
	Name              string  `json:"name"`
	TargetAmountRp    int64   `json:"targetAmountRp"`
	CurrentSavedRp    int64   `json:"currentSavedRp"`
	RemainingTargetRp int64   `json:"remainingTargetRp"`
	MonthsRemaining   int     `json:"monthsRemaining"`
	MonthlySetAsideRp int64   `json:"monthlySetAsideRp"`
	DailySetAsideRp   int64   `json:"dailySetAsideRp"`
	ProgressPercent   float64 `json:"progressPercent"`
}

type EnvelopesResult struct {
	AgeOfMoneyDays            int64                  `json:"ageOfMoneyDays"`
	BufferDays                int64                  `json:"bufferDays"`
	TotalUnspentSweepToP1Rp   int64                  `json:"totalUnspentSweepToP1Rp"`
	TotalUnspentRollForwardRp int64                  `json:"totalUnspentRollForwardRp"`
	TotalSinkingMonthlyRp     int64                  `json:"totalSinkingMonthlyRp"`
	EnvelopeEvaluations       []EnvelopeRolloverEval `json:"envelopeEvaluations"`
	SinkingSchedules          []SinkingFundSchedule  `json:"sinkingSchedules"`
}

func EvaluateEnvelopes(req EnvelopesRequest) EnvelopesResult {
	burn := req.DailyAverageBurnRp
	if burn <= 0 {
		burn = 65000
	}
	cash := req.LiquidCashTotalRp
	if cash < 0 {
		cash = 0
	}

	bufferDays := cash / burn
	// Savings Runway equals exact liquid + real savings days at current daily burn
	ageOfMoney := bufferDays

	var sweepP1, rollNext int64
	evals := make([]EnvelopeRolloverEval, 0, len(req.Envelopes))
	for _, env := range req.Envelopes {
		alloc := max0(env.AllocatedRp)
		spent := max0(env.SpentRp)
		unspent := alloc - spent
		if unspent < 0 {
			unspent = 0
		}
		policy := env.RolloverPolicy
		if policy == "" {
			policy = "SWEEP_TO_P1"
		}
		var sP1, rNext int64
		if policy == "ROLLOVER_NEXT_MONTH" {
			rNext = unspent
			rollNext += unspent
		} else {
			sP1 = unspent
			sweepP1 += unspent
		}
		evals = append(evals, EnvelopeRolloverEval{
			ID:                env.ID,
			Name:              env.Name,
			AllocatedRp:       alloc,
			SpentRp:           spent,
			UnspentRp:         unspent,
			RolloverPolicy:    policy,
			SweptToP1Rp:       sP1,
			RolledNextCycleRp: rNext,
		})
	}

	var totalSinkingMonthly int64
	sinking := make([]SinkingFundSchedule, 0, len(req.SinkingFunds))
	for _, sf := range req.SinkingFunds {
		target := max0(sf.TargetAmountRp)
		saved := max0(sf.CurrentSavedRp)
		rem := target - saved
		if rem < 0 {
			rem = 0
		}
		months := sf.MonthsRemaining
		if months <= 0 {
			months = 1
		}
		monthly := int64(math.Round(float64(rem) / float64(months)))
		daily := int64(math.Round(float64(monthly) / 30.0))
		totalSinkingMonthly += monthly
		pct := 100.0
		if target > 0 {
			pct = math.Round((float64(saved)/float64(target))*1000.0) / 10.0
			if pct > 100 {
				pct = 100
			}
		}
		sinking = append(sinking, SinkingFundSchedule{
			ID:                sf.ID,
			Name:              sf.Name,
			TargetAmountRp:    target,
			CurrentSavedRp:    saved,
			RemainingTargetRp: rem,
			MonthsRemaining:   months,
			MonthlySetAsideRp: monthly,
			DailySetAsideRp:   daily,
			ProgressPercent:   pct,
		})
	}

	return EnvelopesResult{
		AgeOfMoneyDays:            ageOfMoney,
		BufferDays:                bufferDays,
		TotalUnspentSweepToP1Rp:   sweepP1,
		TotalUnspentRollForwardRp: rollNext,
		TotalSinkingMonthlyRp:     totalSinkingMonthly,
		EnvelopeEvaluations:       evals,
		SinkingSchedules:          sinking,
	}
}

func max0(v int64) int64 {
	if v < 0 {
		return 0
	}
	return v
}
