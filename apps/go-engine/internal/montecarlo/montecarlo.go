package montecarlo

import (
	"math"
	"runtime"
	"sort"
	"sync"
	"time"
)

type MonteCarloPeriodInput struct {
	Label           string `json:"label"`
	IncomeRp        int64  `json:"incomeRp"`
	DebtDueRp       int64  `json:"debtDueRp"`
	FixedBillsRp    int64  `json:"fixedBillsRp"`
	LivingTargetRp  int64  `json:"livingTargetRp"`
	SavingsTargetRp int64  `json:"savingsTargetRp"`
}

type MonteCarloRequest struct {
	StartingLiquidAssetsRp     int64                   `json:"startingLiquidAssetsRp"`
	StartingSavingsRp          int64                   `json:"startingSavingsRp"`
	EmergencyFundTargetRp      int64                   `json:"emergencyFundTargetRp"`
	IncomeVolatilityPct        float64                 `json:"incomeVolatilityPct"`
	ExpenseShockProbPct        float64                 `json:"expenseShockProbPct"`
	ExpenseShockMagnitudePct   float64                 `json:"expenseShockMagnitudePct"`
	UnexpectedEmergencyProbPct float64                 `json:"unexpectedEmergencyProbPct"`
	UnexpectedEmergencyCostRp  int64                   `json:"unexpectedEmergencyCostRp"`
	Trials                     int                     `json:"trials"`
	Seed                       uint64                  `json:"seed"`
	Periods                    []MonteCarloPeriodInput `json:"periods"`
}

type MonteCarloFanPoint struct {
	Label            string  `json:"label"`
	P10Rp            int64   `json:"p10Rp"`
	P50Rp            int64   `json:"p50Rp"`
	P90Rp            int64   `json:"p90Rp"`
	ShortfallRiskPct float64 `json:"shortfallRiskPct"`
}

type MonteCarloResult struct {
	TrialsRun                     int                  `json:"trialsRun"`
	WorkerGoroutines              int                  `json:"workerGoroutines"`
	ComputeDurationUs             int64                `json:"computeDurationUs"`
	SurvivalProbabilityPct        float64              `json:"survivalProbabilityPct"`
	EmergencyGoalProbabilityPct   float64              `json:"emergencyGoalProbabilityPct"`
	P5WorstCaseCashFloorRp        int64                `json:"p5WorstCaseCashFloorRp"`
	P10EndingWealthRp             int64                `json:"p10EndingWealthRp"`
	P50MedianEndingWealthRp       int64                `json:"p50MedianEndingWealthRp"`
	P90EndingWealthRp             int64                `json:"p90EndingWealthRp"`
	RecommendedExtraBufferMonthlyRp int64              `json:"recommendedExtraBufferMonthlyRp"`
	FanSeries                     []MonteCarloFanPoint `json:"fanSeries"`
}

func nextU64(state *uint64) uint64 {
	*state += 0x9e3779b97f4a7c15
	z := *state
	z = (z ^ (z >> 30)) * 0xbf58476d1ce4e5b9
	z = (z ^ (z >> 27)) * 0x94d049bb133111eb
	return z ^ (z >> 31)
}

func nextUnit(state *uint64) float64 {
	return float64(nextU64(state)>>11) / float64(uint64(1)<<53)
}

func goRoundF(v float64) int64 {
	if v < 0 {
		return -int64(math.Round(-v))
	}
	return int64(math.Round(v))
}

func round1(v float64) float64 {
	return math.Round(v*10) / 10
}

func quantileInt64(sorted []int64, pct float64) int64 {
	if len(sorted) == 0 {
		return 0
	}
	idx := int(float64(len(sorted)-1) * pct)
	if idx < 0 {
		idx = 0
	}
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	return sorted[idx]
}

// RunMonteCarlo executes parallel Monte Carlo cashflow trajectories across GOMAXPROCS goroutines.
// Each trial is deterministically seeded from (Seed, trialIdx) so output is independent of goroutine scheduling.
func RunMonteCarlo(req MonteCarloRequest) MonteCarloResult {
	started := time.Now()

	trials := req.Trials
	if trials <= 0 {
		trials = 2000
	}
	if trials < 200 {
		trials = 200
	}
	if trials > 10000 {
		trials = 10000
	}

	seed := req.Seed
	if seed == 0 {
		seed = 20261123
	}

	periods := req.Periods
	if len(periods) == 0 {
		periods = []MonteCarloPeriodInput{
			{Label: "M1"},
		}
	}

	volPct := math.Max(0, math.Min(40, req.IncomeVolatilityPct))
	shockProb := math.Max(0, math.Min(50, req.ExpenseShockProbPct))
	shockMag := math.Max(0, math.Min(50, req.ExpenseShockMagnitudePct))
	emProb := math.Max(0, math.Min(25, req.UnexpectedEmergencyProbPct))
	emCost := req.UnexpectedEmergencyCostRp
	if emCost < 0 {
		emCost = 0
	}

	numMonths := len(periods)
	numWorkers := runtime.GOMAXPROCS(0)
	if numWorkers < 1 {
		numWorkers = 1
	}
	if numWorkers > trials {
		numWorkers = trials
	}

	// Per-trial and per-month outputs indexed safely by trialIdx without locks
	wealthByMonth := make([][]int64, numMonths)
	shortfallCounts := make([][]int, numMonths)
	for m := 0; m < numMonths; m++ {
		wealthByMonth[m] = make([]int64, trials)
		shortfallCounts[m] = make([]int, trials)
	}
	survived := make([]int, trials)
	emergencyMet := make([]int, trials)
	cashFloors := make([]int64, trials)

	var wg sync.WaitGroup
	chunk := (trials + numWorkers - 1) / numWorkers
	for w := 0; w < numWorkers; w++ {
		startIdx := w * chunk
		endIdx := startIdx + chunk
		if endIdx > trials {
			endIdx = trials
		}
		if startIdx >= endIdx {
			continue
		}
		wg.Add(1)
		go func(from, to int) {
			defer wg.Done()
			const sqrt3 = 1.7320508075688772
			for t := from; t < to; t++ {
				s := seed ^ (uint64(t+1) * 0x9e3779b97f4a7c15)
				liquid := req.StartingLiquidAssetsRp
				savings := req.StartingSavingsRp
				minCashFloor := liquid
				hadDeficit := false

				for m, p := range periods {
					z := (nextUnit(&s) + nextUnit(&s) + nextUnit(&s) + nextUnit(&s) - 2.0) * sqrt3
					mult := 1.0 + z*(volPct/100.0)
					if mult < 0.25 {
						mult = 0.25
					} else if mult > 1.75 {
						mult = 1.75
					}
					simIncome := goRoundF(float64(p.IncomeRp) * mult)
					if simIncome < 0 {
						simIncome = 0
					}

					livingRoll := nextUnit(&s)
					shockMult := 1.0
					if shockProb > 0 && livingRoll < (shockProb/100.0) {
						magDraw := nextUnit(&s)
						shockMult = 1.0 + (shockMag/100.0)*(0.5+0.5*magDraw)
					}
					simLiving := goRoundF(float64(p.LivingTargetRp) * shockMult)

					emRoll := nextUnit(&s)
					var emergencyHit int64
					if emProb > 0 && emRoll < (emProb/100.0) {
						emergencyHit = emCost
					}

					liquid = liquid + simIncome - p.DebtDueRp - p.FixedBillsRp - simLiving - emergencyHit
					if p.SavingsTargetRp > 0 && liquid >= p.SavingsTargetRp {
						savings += p.SavingsTargetRp
						liquid -= p.SavingsTargetRp
					}
					if liquid < 0 {
						need := -liquid
						draw := savings
						if need < draw {
							draw = need
						}
						if draw > 0 {
							savings -= draw
							liquid += draw
						}
					}
					if liquid < 0 {
						hadDeficit = true
						shortfallCounts[m][t] = 1
					}
					if liquid < minCashFloor {
						minCashFloor = liquid
					}
					wealthByMonth[m][t] = liquid + savings
				}

				if !hadDeficit {
					survived[t] = 1
				}
				if req.EmergencyFundTargetRp > 0 {
					if savings >= req.EmergencyFundTargetRp {
						emergencyMet[t] = 1
					}
				} else if liquid+savings >= 0 {
					emergencyMet[t] = 1
				}
				cashFloors[t] = minCashFloor
			}
		}(startIdx, endIdx)
	}
	wg.Wait()

	survCount := 0
	emCount := 0
	for t := 0; t < trials; t++ {
		survCount += survived[t]
		emCount += emergencyMet[t]
	}

	fanSeries := make([]MonteCarloFanPoint, numMonths)
	for m := 0; m < numMonths; m++ {
		monthSlice := make([]int64, trials)
		copy(monthSlice, wealthByMonth[m])
		sort.Slice(monthSlice, func(i, j int) bool { return monthSlice[i] < monthSlice[j] })

		sfSum := 0
		for t := 0; t < trials; t++ {
			sfSum += shortfallCounts[m][t]
		}
		fanSeries[m] = MonteCarloFanPoint{
			Label:            periods[m].Label,
			P10Rp:            quantileInt64(monthSlice, 0.10),
			P50Rp:            quantileInt64(monthSlice, 0.50),
			P90Rp:            quantileInt64(monthSlice, 0.90),
			ShortfallRiskPct: round1(float64(sfSum) / float64(trials) * 100),
		}
	}

	sort.Slice(cashFloors, func(i, j int) bool { return cashFloors[i] < cashFloors[j] })
	p5Floor := quantileInt64(cashFloors, 0.05)

	lastMonth := fanSeries[numMonths-1]
	survPct := round1(float64(survCount) / float64(trials) * 100)
	emPct := round1(float64(emCount) / float64(trials) * 100)

	var recBuffer int64
	if survPct < 95 && p5Floor < 0 {
		rawPerMonth := math.Ceil(float64(-p5Floor)/float64(numMonths)/10000.0) * 10000.0
		recBuffer = int64(rawPerMonth)
		if recBuffer < 50000 {
			recBuffer = 50000
		}
	} else if survPct < 95 {
		recBuffer = 100000
	}

	elapsedUs := time.Since(started).Microseconds()
	if elapsedUs <= 0 {
		elapsedUs = 1
	}

	return MonteCarloResult{
		TrialsRun:                       trials,
		WorkerGoroutines:                numWorkers,
		ComputeDurationUs:               elapsedUs,
		SurvivalProbabilityPct:          survPct,
		EmergencyGoalProbabilityPct:     emPct,
		P5WorstCaseCashFloorRp:          p5Floor,
		P10EndingWealthRp:               lastMonth.P10Rp,
		P50MedianEndingWealthRp:         lastMonth.P50Rp,
		P90EndingWealthRp:               lastMonth.P90Rp,
		RecommendedExtraBufferMonthlyRp: recBuffer,
		FanSeries:                       fanSeries,
	}
}
