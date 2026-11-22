package report

import (
	"fmt"
	"math"

	"sundayfunday.erp/go-engine/internal/format"
)

type PeriodMetricInput struct {
	Month                  int    `json:"month"`
	Year                   int    `json:"year"`
	PeriodLabel            string `json:"periodLabel"`
	FinalTotalIncome       int64  `json:"finalTotalIncome"`
	TotalDebt              int64  `json:"totalDebt"`
	FixedEssentials        int64  `json:"fixedEssentials"`
	ActualDailyOperational int64  `json:"actualDailyOperational"`
	BufferPocket           int64  `json:"bufferPocket"`
	ActualSavings          int64  `json:"actualSavings"`
	SelfReward             int64  `json:"selfReward"`
	DeficitUncovered       int64  `json:"deficitUncovered"`
	DaysInCycle            int    `json:"daysInCycle"`
}

type ContractSummaryInput struct {
	ID                  string `json:"id"`
	Title               string `json:"title"`
	Category            string `json:"category"`
	MerchantOrPlatform  string `json:"merchantOrPlatform"`
	MonthlyInstallment  int64  `json:"monthlyInstallment"`
	PrincipalAmount     int64  `json:"principalAmount"`
	RemainingPrincipal  int64  `json:"remainingPrincipal"`
	RemainingSlices     int    `json:"remainingSlices"`
	TotalTenor          int    `json:"totalTenor"`
	PayoffMonth         int    `json:"payoffMonth"`
	PayoffYear          int    `json:"payoffYear"`
	PayoffDateLabel     string `json:"payoffDateLabel"`
}

type HorizonRequest struct {
	SelectedMonth int                    `json:"selectedMonth"`
	SelectedYear  int                    `json:"selectedYear"`
	Periods       []PeriodMetricInput    `json:"periods"`
	Contracts     []ContractSummaryInput `json:"contracts"`
}

type FreedCashflowMilestone struct {
	Month             int      `json:"month"`
	Year              int      `json:"year"`
	PeriodLabel       string   `json:"periodLabel"`
	FreedMonthlyRp    int64    `json:"freedMonthlyRp"`
	CumulativeFreedRp int64    `json:"cumulativeFreedRp"`
	EndingContracts   []string `json:"endingContracts"`
}

type HorizonPeriodDriver struct {
	Month              int     `json:"month"`
	Year               int     `json:"year"`
	PeriodLabel        string  `json:"periodLabel"`
	DsrPercent         float64 `json:"dsrPercent"`
	NetSavingsRatePct  float64 `json:"netSavingsRatePct"`
	EffectiveDailyRate int64   `json:"effectiveDailyRate"`
	MomDebtDelta       int64   `json:"momDebtDelta"`
	MomIncomeDelta     int64   `json:"momIncomeDelta"`
	NarrativeDriver    string  `json:"narrativeDriver"`
}

type ExecutiveHorizonResult struct {
	SelectedPeriodLabel        string                   `json:"selectedPeriodLabel"`
	DsrPercent                 float64                  `json:"dsrPercent"`
	NetSavingsRatePercent      float64                  `json:"netSavingsRatePercent"`
	DebtBurnDownVelocityRp     int64                    `json:"debtBurnDownVelocityRp"`
	EffectiveDailyLivingRate   int64                    `json:"effectiveDailyLivingRate"`
	TotalActiveContracts       int                      `json:"totalActiveContracts"`
	TotalRemainingPrincipalRp  int64                    `json:"totalRemainingPrincipalRp"`
	NextMilestoneLabel         string                   `json:"nextMilestoneLabel"`
	FreedUpMilestones          []FreedCashflowMilestone `json:"freedUpMilestones"`
	PeriodDrivers              []HorizonPeriodDriver    `json:"periodDrivers"`
}

func round1(v float64) float64 {
	return math.Round(v*10) / 10
}

func nextPeriod(m, y int) (int, int) {
	if m == 12 {
		return 1, y + 1
	}
	return m + 1, y
}

var mNames = []string{"JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"}

func labelMY(m, y int) string {
	if m < 1 || m > 12 {
		return fmt.Sprintf("%02d/%d", m, y)
	}
	return fmt.Sprintf("%s '%02d", mNames[m-1], y%100)
}

func BuildExecutiveHorizon(req HorizonRequest) ExecutiveHorizonResult {
	selectedLabel := labelMY(req.SelectedMonth, req.SelectedYear)
	var sel PeriodMetricInput
	found := false
	for _, p := range req.Periods {
		if p.Month == req.SelectedMonth && p.Year == req.SelectedYear {
			sel = p
			found = true
			selectedLabel = p.PeriodLabel
			break
		}
	}
	if !found && len(req.Periods) > 0 {
		sel = req.Periods[0]
		selectedLabel = sel.PeriodLabel
	}

	dsr := 0.0
	netSavingsRate := 0.0
	if sel.FinalTotalIncome > 0 {
		dsr = round1((float64(sel.TotalDebt) / float64(sel.FinalTotalIncome)) * 100.0)
		netSavingsRate = round1((float64(sel.ActualSavings+sel.SelfReward) / float64(sel.FinalTotalIncome)) * 100.0)
	}

	days := sel.DaysInCycle
	if days <= 0 {
		days = 30
	}
	effDaily := sel.ActualDailyOperational / int64(days)

	// Debt burn-down velocity across available periods starting at or near selected period
	var selIdx int = -1
	for i, p := range req.Periods {
		if p.Month == sel.Month && p.Year == sel.Year {
			selIdx = i
			break
		}
	}
	var velocity int64
	if selIdx >= 0 && len(req.Periods)-selIdx > 1 {
		endIdx := selIdx + 3
		if endIdx >= len(req.Periods) {
			endIdx = len(req.Periods) - 1
		}
		steps := int64(endIdx - selIdx)
		if steps > 0 {
			velocity = (req.Periods[selIdx].TotalDebt - req.Periods[endIdx].TotalDebt) / steps
		}
	}

	drivers := make([]HorizonPeriodDriver, 0, len(req.Periods))
	for i, p := range req.Periods {
		pDsr := 0.0
		pSave := 0.0
		if p.FinalTotalIncome > 0 {
			pDsr = round1((float64(p.TotalDebt) / float64(p.FinalTotalIncome)) * 100.0)
			pSave = round1((float64(p.ActualSavings+p.SelfReward) / float64(p.FinalTotalIncome)) * 100.0)
		}
		pDays := p.DaysInCycle
		if pDays <= 0 {
			pDays = 30
		}
		var debtDelta, incDelta int64
		driverText := "Baseline cycle structure"
		if i > 0 {
			prev := req.Periods[i-1]
			debtDelta = p.TotalDebt - prev.TotalDebt
			incDelta = p.FinalTotalIncome - prev.FinalTotalIncome
			if debtDelta < 0 && incDelta > 0 {
				driverText = fmt.Sprintf("Income +Rp %s & debt -Rp %s", format.Rp(incDelta), format.Rp(-debtDelta))
			} else if debtDelta < 0 {
				driverText = fmt.Sprintf("Debt step-down (-Rp %s vs %s)", format.Rp(-debtDelta), prev.PeriodLabel)
			} else if debtDelta > 0 {
				driverText = fmt.Sprintf("Debt step-up (+Rp %s vs %s)", format.Rp(debtDelta), prev.PeriodLabel)
			} else if incDelta != 0 {
				driverText = fmt.Sprintf("Income shift (%+d vs %s)", incDelta, prev.PeriodLabel)
			}
		}

		drivers = append(drivers, HorizonPeriodDriver{
			Month:              p.Month,
			Year:               p.Year,
			PeriodLabel:        p.PeriodLabel,
			DsrPercent:         pDsr,
			NetSavingsRatePct:  pSave,
			EffectiveDailyRate: p.ActualDailyOperational / int64(pDays),
			MomDebtDelta:       debtDelta,
			MomIncomeDelta:     incDelta,
			NarrativeDriver:    driverText,
		})
	}

	// Freed up cashflow milestone in period AFTER contract payoffMonth/Year
	type mKey struct{ Y, M int }
	freedMap := make(map[mKey]*FreedCashflowMilestone)
	var orderedKeys []mKey
	var totalRemPrincipal int64

	for _, c := range req.Contracts {
		totalRemPrincipal += c.RemainingPrincipal
		if c.PayoffMonth >= 1 && c.PayoffMonth <= 12 && c.PayoffYear >= 2000 {
			fm, fy := nextPeriod(c.PayoffMonth, c.PayoffYear)
			k := mKey{fy, fm}
			if _, ok := freedMap[k]; !ok {
				freedMap[k] = &FreedCashflowMilestone{
					Month:           fm,
					Year:            fy,
					PeriodLabel:     labelMY(fm, fy),
					FreedMonthlyRp:  0,
					EndingContracts: []string{},
				}
				orderedKeys = append(orderedKeys, k)
			}
			freedMap[k].FreedMonthlyRp += c.MonthlyInstallment
			freedMap[k].EndingContracts = append(freedMap[k].EndingContracts, c.Title)
		}
	}

	// Sort milestones chronologically
	for i := 0; i < len(orderedKeys); i++ {
		for j := i + 1; j < len(orderedKeys); j++ {
			a, b := orderedKeys[i], orderedKeys[j]
			if b.Y < a.Y || (b.Y == a.Y && b.M < a.M) {
				orderedKeys[i], orderedKeys[j] = b, a
			}
		}
	}

	var milestones []FreedCashflowMilestone
	var cumulative int64
	nextLabel := "Debt-Free / All Settled"
	for idx, k := range orderedKeys {
		entry := freedMap[k]
		cumulative += entry.FreedMonthlyRp
		entry.CumulativeFreedRp = cumulative
		if idx == 0 {
			nextLabel = fmt.Sprintf("+Rp %s/mo freed in %s", format.Rp(entry.FreedMonthlyRp), entry.PeriodLabel)
		}
		milestones = append(milestones, *entry)
	}

	return ExecutiveHorizonResult{
		SelectedPeriodLabel:       selectedLabel,
		DsrPercent:                dsr,
		NetSavingsRatePercent:     netSavingsRate,
		DebtBurnDownVelocityRp:    velocity,
		EffectiveDailyLivingRate:  effDaily,
		TotalActiveContracts:      len(req.Contracts),
		TotalRemainingPrincipalRp: totalRemPrincipal,
		NextMilestoneLabel:        nextLabel,
		FreedUpMilestones:         milestones,
		PeriodDrivers:             drivers,
	}
}
