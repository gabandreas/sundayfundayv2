package forecaster

import (
	"fmt"
	"math"
)

type ForecastPeriod struct {
	Month                int     `json:"month"`
	Year                 int     `json:"year"`
	Label                string  `json:"label"`
	TotalIncomeRp        int64   `json:"totalIncomeRp"`
	TotalDebtDueRp       int64   `json:"totalDebtDueRp"`
	PersonalDebtDueRp    int64   `json:"personalDebtDueRp"`
	DailyLivingRp        int64   `json:"dailyLivingRp"`
	RoutineBillsRp       int64   `json:"routineBillsRp"`
	CoreSavingsP1Rp      int64   `json:"coreSavingsP1Rp"`
	SelfRewardP2Rp       int64   `json:"selfRewardP2Rp"`
	DsrPercent           float64 `json:"dsrPercent"`
}

type ForecasterRequest struct {
	StartingLiquidAssetsRp   int64            `json:"startingLiquidAssetsRp"`
	StartingP1VaultRp        int64            `json:"startingP1VaultRp"`
	EmergencyFundTargetRp    int64            `json:"emergencyFundTargetRp"` // default 15_000_000 (6x living)
	BaselineDailyBurnRp      int64            `json:"baselineDailyBurnRp"`   // default 50_000..95_000
	RdpuAnnualYieldPct       float64          `json:"rdpuAnnualYieldPct"`    // default 4.75
	VariableShockPercent     float64          `json:"variableShockPercent"`  // default 15
	Periods                  []ForecastPeriod `json:"periods"`
}

type ScenarioMonthPoint struct {
	Month                 int     `json:"month"`
	Year                  int     `json:"year"`
	Label                 string  `json:"label"`
	BaselineWealthRp      int64   `json:"baselineWealthRp"`
	DisciplinedWealthRp   int64   `json:"disciplinedWealthRp"`
	ShockWealthRp         int64   `json:"shockWealthRp"`
	DsrPercent            float64 `json:"dsrPercent"`
	RemainingPersonalDebt int64   `json:"remainingPersonalDebtRp"`
}

type ForecasterResult struct {
	SpinjamFreedomDate           string               `json:"spinjamFreedomDate"`
	LowDsrMilestoneDate          string               `json:"lowDsrMilestoneDate"`
	EmergencyFundCompletionDate  string               `json:"emergencyFundCompletionDate"`
	PureSurvivalRunwayDays       int64                `json:"pureSurvivalRunwayDays"`
	Projected6MWealthBaselineRp  int64                `json:"projected6MWealthBaselineRp"`
	Projected12MWealthBaselineRp int64                `json:"projected12MWealthBaselineRp"`
	Projected6MWealthZeroLeakRp  int64                `json:"projected6MWealthZeroLeakRp"`
	Projected12MWealthZeroLeakRp int64                `json:"projected12MWealthZeroLeakRp"`
	Projected12MWealthShockRp    int64                `json:"projected12MWealthShockRp"`
	Series                       []ScenarioMonthPoint `json:"series"`
}

var shortMonths = []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}

func fmtDateLabel(m, y int) string {
	if m >= 1 && m <= 12 {
		return fmt.Sprintf("%s %d", shortMonths[m-1], y)
	}
	return fmt.Sprintf("%02d/%d", m, y)
}

func RunForecast(req ForecasterRequest) ForecasterResult {
	monthlyYieldRate := req.RdpuAnnualYieldPct / 100.0 / 12.0
	if monthlyYieldRate < 0 {
		monthlyYieldRate = 0
	}
	shockFactor := req.VariableShockPercent / 100.0
	if shockFactor <= 0 {
		shockFactor = 0.15
	}
	efTarget := req.EmergencyFundTargetRp
	if efTarget <= 0 {
		efTarget = 15000000
	}

	dailyBurn := req.BaselineDailyBurnRp
	if dailyBurn <= 0 {
		dailyBurn = 95000
	}
	var runwayDays int64
	if req.StartingLiquidAssetsRp > 0 {
		runwayDays = req.StartingLiquidAssetsRp / dailyBurn
	}

	baseWealth := req.StartingLiquidAssetsRp
	discWealth := req.StartingLiquidAssetsRp
	shockWealth := req.StartingLiquidAssetsRp

	var totalPersonalDebtRemaining int64
	for _, p := range req.Periods {
		if p.PersonalDebtDueRp > 0 {
			totalPersonalDebtRemaining += p.PersonalDebtDueRp
		}
	}

	spinjamFreedom := "Paid Off"
	if totalPersonalDebtRemaining > 0 {
		spinjamFreedom = "Beyond 12M"
	}
	lowDsrDate := "Already <15%"
	hasHighDsr := false
	for _, p := range req.Periods {
		dsr := p.DsrPercent
		if dsr == 0 && p.TotalIncomeRp > 0 {
			dsr = float64(p.TotalDebtDueRp) / float64(p.TotalIncomeRp) * 100.0
		}
		if dsr >= 15.0 {
			hasHighDsr = true
			lowDsrDate = "Beyond 12M"
			break
		}
	}

	efDate := "Beyond 12M"
	if baseWealth >= efTarget {
		efDate = "Funded Now"
	}

	series := make([]ScenarioMonthPoint, 0, 12)
	var p6Base, p12Base, p6Disc, p12Disc, p12Shock int64
	p6Base = baseWealth
	p6Disc = discWealth
	p12Base = baseWealth
	p12Disc = discWealth
	p12Shock = shockWealth

	var seenAnyPersonalDebt bool
	for i, p := range req.Periods {
		if i >= 12 {
			break
		}
		dsr := p.DsrPercent
		if dsr == 0 && p.TotalIncomeRp > 0 {
			dsr = math.Round((float64(p.TotalDebtDueRp)/float64(p.TotalIncomeRp))*1000.0) / 10.0
		}

		// Track SPinjam freedom: first month after the last month with PersonalDebtDueRp > 0 (or first month where remaining drops to 0)
		if p.PersonalDebtDueRp > 0 {
			seenAnyPersonalDebt = true
			totalPersonalDebtRemaining -= p.PersonalDebtDueRp
			if totalPersonalDebtRemaining < 0 {
				totalPersonalDebtRemaining = 0
			}
			if totalPersonalDebtRemaining == 0 {
				nextM := p.Month + 1
				nextY := p.Year
				if nextM > 12 {
					nextM = 1
					nextY++
				}
				spinjamFreedom = fmtDateLabel(nextM, nextY)
			}
		} else if seenAnyPersonalDebt && spinjamFreedom == "Beyond 12M" {
			spinjamFreedom = fmtDateLabel(p.Month, p.Year)
		}

		if hasHighDsr && lowDsrDate == "Beyond 12M" && dsr < 15.0 {
			lowDsrDate = fmtDateLabel(p.Month, p.Year)
		}

		// Scenario A (Baseline): saves P1 + 50% of P2 + RDPU yield
		baseYield := int64(math.Round(float64(max0(baseWealth)) * monthlyYieldRate))
		baseWealth += max0(p.CoreSavingsP1Rp) + int64(math.Round(float64(max0(p.SelfRewardP2Rp))*0.5)) + baseYield

		// Scenario B (Disciplined Zero-Leakage): saves P1 + 100% P2 + 10% unspent daily food sweep + RDPU yield
		discYield := int64(math.Round(float64(max0(discWealth)) * monthlyYieldRate))
		foodSweep := int64(math.Round(float64(max0(p.DailyLivingRp)) * 0.10))
		discWealth += max0(p.CoreSavingsP1Rp) + max0(p.SelfRewardP2Rp) + foodSweep + discYield

		// Scenario C (Variable Spend Shock +15% burn): shock eats 15% of living+routine out of surplus/P1
		shockCost := int64(math.Round(float64(max0(p.DailyLivingRp)+max0(p.RoutineBillsRp)) * shockFactor))
		shockNet := max0(p.CoreSavingsP1Rp) + int64(math.Round(float64(max0(p.SelfRewardP2Rp))*0.25)) - shockCost
		shockYield := int64(math.Round(float64(max0(shockWealth)) * monthlyYieldRate))
		shockWealth += shockNet + shockYield
		if shockWealth < 0 {
			shockWealth = 0
		}

		if efDate == "Beyond 12M" && discWealth >= efTarget {
			efDate = fmtDateLabel(p.Month, p.Year)
		}

		if i == 5 {
			p6Base = baseWealth
			p6Disc = discWealth
		}
		p12Base = baseWealth
		p12Disc = discWealth
		p12Shock = shockWealth

		lbl := p.Label
		if lbl == "" {
			lbl = fmtDateLabel(p.Month, p.Year)
		}

		series = append(series, ScenarioMonthPoint{
			Month:                 p.Month,
			Year:                  p.Year,
			Label:                 lbl,
			BaselineWealthRp:      baseWealth,
			DisciplinedWealthRp:   discWealth,
			ShockWealthRp:         shockWealth,
			DsrPercent:            dsr,
			RemainingPersonalDebt: totalPersonalDebtRemaining,
		})
	}

	if len(series) > 0 && len(series) < 6 {
		p6Base = baseWealth
		p6Disc = discWealth
	}

	return ForecasterResult{
		SpinjamFreedomDate:           spinjamFreedom,
		LowDsrMilestoneDate:          lowDsrDate,
		EmergencyFundCompletionDate:  efDate,
		PureSurvivalRunwayDays:       runwayDays,
		Projected6MWealthBaselineRp:  p6Base,
		Projected12MWealthBaselineRp: p12Base,
		Projected6MWealthZeroLeakRp:  p6Disc,
		Projected12MWealthZeroLeakRp: p12Disc,
		Projected12MWealthShockRp:    p12Shock,
		Series:                       series,
	}
}

func max0(v int64) int64 {
	if v < 0 {
		return 0
	}
	return v
}
