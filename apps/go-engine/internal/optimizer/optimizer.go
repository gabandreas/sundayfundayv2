package optimizer

import (
	"fmt"
	"math"
	"runtime"
	"sort"
	"sync"
	"time"
)

type DebtSlice struct {
	Title                string  `json:"title"`
	RemainingRp          int64   `json:"remainingRp"`
	MonthlyInstallmentRp int64   `json:"monthlyInstallmentRp"`
	MonthlyInterestPct   float64 `json:"monthlyInterestPct"`
	RemainingMonths      int     `json:"remainingMonths"`
}

type GoalSlice struct {
	Title       string `json:"title"`
	TargetRp    int64  `json:"targetRp"`
	AllocatedRp int64  `json:"allocatedRp"`
}

type AllocationOptRequest struct {
	MonthlySurplusRp      int64       `json:"monthlySurplusRp"`
	CurrentSavingsRp      int64       `json:"currentSavingsRp"`
	EmergencyFundTargetRp int64       `json:"emergencyFundTargetRp"`
	MonthlyEssentialsRp   int64       `json:"monthlyEssentialsRp"`
	Debts                 []DebtSlice `json:"debts"`
	Goals                 []GoalSlice `json:"goals"`
}

type OptimalAllocationStrategy struct {
	Code                    string `json:"code"`
	Title                   string `json:"title"`
	DebtPrepaymentRp        int64  `json:"debtPrepaymentRp"`
	EmergencyFundRp         int64  `json:"emergencyFundRp"`
	GoalSavingsRp           int64  `json:"goalSavingsRp"`
	FlexibleRp              int64  `json:"flexibleRp"`
	Projected12MNetWorthRp  int64  `json:"projected12MNetWorthRp"`
	EstimatedInterestSavedRp int64 `json:"estimatedInterestSavedRp"`
	DebtMonthsShaved        int    `json:"debtMonthsShaved"`
	EmergencyMonthsToTarget int    `json:"emergencyMonthsToTarget"`
	Rationale               string `json:"rationale"`
}

type AllocationOptResult struct {
	CombinationsEvaluated int                         `json:"combinationsEvaluated"`
	WorkerGoroutines      int                         `json:"workerGoroutines"`
	ComputeDurationUs     int64                       `json:"computeDurationUs"`
	Strategies            []OptimalAllocationStrategy `json:"strategies"`
}

type gridWeights struct {
	dPct int64
	ePct int64
	gPct int64
	fPct int64
}

type candidateEval struct {
	debtRp           int64
	emergRp          int64
	goalRp           int64
	flexRp           int64
	netWorth12MRp    int64
	interestSavedRp  int64
	monthsShaved     int
	emergMonths      int
	compositeScore   float64
	dPct, ePct, gPct int64
}

func simulateDebtHorizon(debts []DebtSlice, extraMonthlyPrepayRp int64) (monthsToZero int, totalInterestRp int64, debtAfter12MRp int64) {
	if len(debts) == 0 {
		return 0, 0, 0
	}
	type remDebt struct {
		bal     float64
		inst    float64
		ratePct float64
	}
	active := make([]remDebt, 0, len(debts))
	for _, d := range debts {
		if d.RemainingRp > 0 {
			inst := float64(d.MonthlyInstallmentRp)
			if inst <= 0 && d.RemainingMonths > 0 {
				inst = float64(d.RemainingRp) / float64(d.RemainingMonths)
			}
			active = append(active, remDebt{
				bal:     float64(d.RemainingRp),
				inst:    inst,
				ratePct: math.Max(0, d.MonthlyInterestPct),
			})
		}
	}
	if len(active) == 0 {
		return 0, 0, 0
	}
	// Avalanche order: highest monthly interest first
	sort.Slice(active, func(i, j int) bool {
		if active[i].ratePct == active[j].ratePct {
			return active[i].bal < active[j].bal
		}
		return active[i].ratePct > active[j].ratePct
	})

	var totalInterest float64
	maxMonths := 60
	for m := 1; m <= maxMonths; m++ {
		totalRem := 0.0
		for i := range active {
			if active[i].bal <= 0.5 {
				active[i].bal = 0
				continue
			}
			interest := active[i].bal * (active[i].ratePct / 100.0)
			totalInterest += interest
			active[i].bal += interest
			pay := active[i].inst
			if pay > active[i].bal {
				pay = active[i].bal
			}
			active[i].bal -= pay
		}
		extra := float64(extraMonthlyPrepayRp)
		for i := range active {
			if extra <= 0 {
				break
			}
			if active[i].bal > 0 {
				apply := extra
				if apply > active[i].bal {
					apply = active[i].bal
				}
				active[i].bal -= apply
				extra -= apply
			}
		}
		for i := range active {
			totalRem += active[i].bal
		}
		if m == 12 {
			debtAfter12MRp = int64(math.Round(totalRem))
		}
		if totalRem <= 1.0 && monthsToZero == 0 {
			monthsToZero = m
			if m <= 12 {
				debtAfter12MRp = 0
			}
			break
		}
	}
	if monthsToZero == 0 {
		monthsToZero = maxMonths
	}
	return monthsToZero, int64(math.Round(totalInterest)), debtAfter12MRp
}

// OptimizeAllocationFrontier searches the 4-way surplus allocation simplex in parallel across GOMAXPROCS workers.
func OptimizeAllocationFrontier(req AllocationOptRequest) AllocationOptResult {
	started := time.Now()
	surplus := req.MonthlySurplusRp
	if surplus < 0 {
		surplus = 0
	}

	hasDebt := false
	for _, d := range req.Debts {
		if d.RemainingRp > 0 {
			hasDebt = true
			break
		}
	}

	grid := make([]gridWeights, 0, 1800)
	if hasDebt {
		const step int64 = 5
		for d := int64(0); d <= 100; d += step {
			for e := int64(0); e <= 100-d; e += step {
				for g := int64(0); g <= 100-d-e; g += step {
					f := 100 - d - e - g
					grid = append(grid, gridWeights{dPct: d, ePct: e, gPct: g, fPct: f})
				}
			}
		}
	} else {
		const step int64 = 2
		for e := int64(0); e <= 100; e += step {
			for g := int64(0); g <= 100-e; g += step {
				f := 100 - e - g
				grid = append(grid, gridWeights{dPct: 0, ePct: e, gPct: g, fPct: f})
			}
		}
	}

	baseDebtMonths, baseInterest, _ := simulateDebtHorizon(req.Debts, 0)
	emergGap := req.EmergencyFundTargetRp - req.CurrentSavingsRp
	if emergGap < 0 {
		emergGap = 0
	}

	var goalGap int64
	for _, g := range req.Goals {
		rem := g.TargetRp - g.AllocatedRp
		if rem > 0 {
			goalGap += rem
		}
	}

	totalCombos := len(grid)
	evals := make([]candidateEval, totalCombos)
	numWorkers := runtime.GOMAXPROCS(0)
	if numWorkers < 1 {
		numWorkers = 1
	}
	if numWorkers > totalCombos {
		numWorkers = totalCombos
	}

	var wg sync.WaitGroup
	chunk := (totalCombos + numWorkers - 1) / numWorkers
	for w := 0; w < numWorkers; w++ {
		from := w * chunk
		to := from + chunk
		if to > totalCombos {
			to = totalCombos
		}
		if from >= to {
			continue
		}
		wg.Add(1)
		go func(start, end int) {
			defer wg.Done()
			for idx := start; idx < end; idx++ {
				wt := grid[idx]
				debtRp := (surplus * wt.dPct) / 100
				emergRp := (surplus * wt.ePct) / 100
				goalRp := (surplus * wt.gPct) / 100
				flexRp := surplus - debtRp - emergRp - goalRp

				mZero, simInt, debtAfter12M := simulateDebtHorizon(req.Debts, debtRp)
				intSaved := baseInterest - simInt
				if intSaved < 0 {
					intSaved = 0
				}
				shaved := baseDebtMonths - mZero
				if shaved < 0 {
					shaved = 0
				}

				emergMonths := 0
				if emergGap > 0 {
					if emergRp <= 0 {
						emergMonths = 999
					} else {
						emergMonths = int(math.Ceil(float64(emergGap) / float64(emergRp)))
					}
				}

				// 12M liquid + savings accumulation net of ending debt remaining
				accumSavings := req.CurrentSavingsRp + 12*(emergRp+goalRp+flexRp)
				netWorth12M := accumSavings - debtAfter12M

				// Balanced score: rewards debt interest saved, reaching emergency fund without neglecting goals & flex liquidity
				flexScore := math.Min(1.0, float64(wt.fPct)/20.0) * 15.0
				emergScore := 0.0
				if emergGap > 0 {
					progress := math.Min(1.0, float64(12*emergRp)/float64(emergGap))
					emergScore = progress * 40.0
				} else {
					emergScore = math.Min(1.0, float64(wt.ePct)/30.0) * 20.0
				}
				debtScore := 0.0
				if hasDebt && baseInterest > 0 {
					debtScore = (float64(intSaved) / float64(baseInterest)) * 45.0
				} else if hasDebt {
					debtScore = (float64(shaved) / float64(maxInt(1, baseDebtMonths))) * 35.0
				}
				goalScore := 0.0
				if goalGap > 0 {
					goalScore = math.Min(1.0, float64(12*goalRp)/float64(goalGap)) * 30.0
				} else {
					goalScore = math.Min(1.0, float64(wt.gPct)/40.0) * 25.0
				}

				evals[idx] = candidateEval{
					debtRp:          debtRp,
					emergRp:         emergRp,
					goalRp:          goalRp,
					flexRp:          flexRp,
					netWorth12MRp:   netWorth12M,
					interestSavedRp: intSaved,
					monthsShaved:    shaved,
					emergMonths:     emergMonths,
					compositeScore:  debtScore + emergScore + goalScore + flexScore,
					dPct:            wt.dPct,
					ePct:            wt.ePct,
					gPct:            wt.gPct,
				}
			}
		}(from, to)
	}
	wg.Wait()

	bestBalanced := evals[0]
	bestDebt := evals[0]
	bestReserve := evals[0]

	for _, c := range evals {
		if c.compositeScore > bestBalanced.compositeScore {
			bestBalanced = c
		}
		if hasDebt {
			if c.monthsShaved > bestDebt.monthsShaved ||
				(c.monthsShaved == bestDebt.monthsShaved && c.interestSavedRp > bestDebt.interestSavedRp) ||
				(c.monthsShaved == bestDebt.monthsShaved && c.interestSavedRp == bestDebt.interestSavedRp && c.dPct < bestDebt.dPct) {
				bestDebt = c
			}
		} else {
			if c.goalRp > bestDebt.goalRp || (c.goalRp == bestDebt.goalRp && c.emergRp > bestDebt.emergRp) {
				bestDebt = c
			}
		}
		if c.emergMonths < bestReserve.emergMonths ||
			(c.emergMonths == bestReserve.emergMonths && c.emergRp > bestReserve.emergRp) {
			bestReserve = c
		}
	}

	strategies := []OptimalAllocationStrategy{
		{
			Code:                     "BALANCED_RESILIENCE",
			Title:                    "Balanced Resilience",
			DebtPrepaymentRp:         bestBalanced.debtRp,
			EmergencyFundRp:          bestBalanced.emergRp,
			GoalSavingsRp:            bestBalanced.goalRp,
			FlexibleRp:               bestBalanced.flexRp,
			Projected12MNetWorthRp:   bestBalanced.netWorth12MRp,
			EstimatedInterestSavedRp: bestBalanced.interestSavedRp,
			DebtMonthsShaved:         bestBalanced.monthsShaved,
			EmergencyMonthsToTarget:  bestBalanced.emergMonths,
			Rationale:                formatBalancedRationale(bestBalanced, hasDebt, emergGap),
		},
		func() OptimalAllocationStrategy {
			if hasDebt {
				return OptimalAllocationStrategy{
					Code:                     "FASTEST_DEBT_FREE",
					Title:                    "Fastest Debt Payoff",
					DebtPrepaymentRp:         bestDebt.debtRp,
					EmergencyFundRp:          bestDebt.emergRp,
					GoalSavingsRp:            bestDebt.goalRp,
					FlexibleRp:               bestDebt.flexRp,
					Projected12MNetWorthRp:   bestDebt.netWorth12MRp,
					EstimatedInterestSavedRp: bestDebt.interestSavedRp,
					DebtMonthsShaved:         bestDebt.monthsShaved,
					EmergencyMonthsToTarget:  bestDebt.emergMonths,
					Rationale:                fmt.Sprintf("Directs %d%% of monthly surplus to highest-rate debt, cutting %d months off payoff.", bestDebt.dPct, bestDebt.monthsShaved),
				}
			}
			return OptimalAllocationStrategy{
				Code:                     "GOAL_ACCELERATOR",
				Title:                    "Goal Accelerator",
				DebtPrepaymentRp:         bestDebt.debtRp,
				EmergencyFundRp:          bestDebt.emergRp,
				GoalSavingsRp:            bestDebt.goalRp,
				FlexibleRp:               bestDebt.flexRp,
				Projected12MNetWorthRp:   bestDebt.netWorth12MRp,
				EstimatedInterestSavedRp: 0,
				DebtMonthsShaved:         0,
				EmergencyMonthsToTarget:  bestDebt.emergMonths,
				Rationale:                fmt.Sprintf("Debt-free allocation channeling %d%% directly toward active savings goals.", bestDebt.gPct),
			}
		}(),
		{
			Code:                     "FASTEST_RESERVE",
			Title:                    "Fastest Emergency Reserve",
			DebtPrepaymentRp:         bestReserve.debtRp,
			EmergencyFundRp:          bestReserve.emergRp,
			GoalSavingsRp:            bestReserve.goalRp,
			FlexibleRp:               bestReserve.flexRp,
			Projected12MNetWorthRp:   bestReserve.netWorth12MRp,
			EstimatedInterestSavedRp: bestReserve.interestSavedRp,
			DebtMonthsShaved:         bestReserve.monthsShaved,
			EmergencyMonthsToTarget:  bestReserve.emergMonths,
			Rationale:                formatReserveRationale(bestReserve, emergGap),
		},
	}

	elapsedUs := time.Since(started).Microseconds()
	if elapsedUs <= 0 {
		elapsedUs = 1
	}

	return AllocationOptResult{
		CombinationsEvaluated: totalCombos,
		WorkerGoroutines:      numWorkers,
		ComputeDurationUs:     elapsedUs,
		Strategies:            strategies,
	}
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func formatBalancedRationale(c candidateEval, hasDebt bool, emergGap int64) string {
	if hasDebt && emergGap > 0 {
		return fmt.Sprintf("Balances %d%% debt reduction with %d%% emergency reserve funding and flexible headroom.", c.dPct, c.ePct)
	}
	if hasDebt {
		return fmt.Sprintf("Combines %d%% interest-saving prepayment with steady goal accumulation.", c.dPct)
	}
	return fmt.Sprintf("Splits surplus across %d%% reserve protection and %d%% personal goals.", c.ePct, c.gPct)
}

func formatReserveRationale(c candidateEval, emergGap int64) string {
	if emergGap <= 0 {
		return "Emergency fund target already met; keeps liquidity topped up while compounding net savings."
	}
	return fmt.Sprintf("Closes your emergency fund gap in ~%d months at %d%% reserve allocation.", c.emergMonths, c.ePct)
}
