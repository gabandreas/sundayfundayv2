package debtopt

import (
	"fmt"
	"math"
	"sort"
)

type DebtContract struct {
	ID                 string  `json:"id"`
	Name               string  `json:"name"`
	Instrument         string  `json:"instrument"` // SPINJAM | SPAYLATER | CREDIT_CARD | PERSONAL_DEBT
	MonthlyInstallment int64   `json:"monthlyInstallmentRp"`
	RemainingMonths    int     `json:"remainingMonths"`
	RemainingBalanceRp int64   `json:"remainingBalanceRp"`
	MonthlyInterestPct float64 `json:"monthlyInterestPct"`
	PayoffMonth        int     `json:"payoffMonth"` // month after last installment
	PayoffYear         int     `json:"payoffYear"`
	PayoffLabel        string  `json:"payoffLabel"`
}

type DebtOptRequest struct {
	Contracts       []DebtContract `json:"contracts"`
	ExtraLumpSumRp  int64          `json:"extraLumpSumRp"`
}

type CashflowUnlockMilestone struct {
	UnlockMonth        int      `json:"unlockMonth"`
	UnlockYear         int      `json:"unlockYear"`
	UnlockLabel        string   `json:"unlockLabel"`
	FreedMonthlyRp     int64    `json:"freedMonthlyRp"`
	SpinjamOnlyFreedRp int64    `json:"spinjamOnlyFreedRp"`
	CumulativeFreed    int64    `json:"cumulativeFreedRp"`
	FinishedContracts  []string `json:"finishedContracts"`
}

type StrategyPlan struct {
	Strategy               string   `json:"strategy"` // CONTRACTUAL | AVALANCHE | SNOWBALL
	PriorityOrderNames     []string `json:"priorityOrderNames"`
	EstimatedInterestSaved int64    `json:"estimatedInterestSavedRp"`
	MonthsShaved           int      `json:"monthsShaved"`
	ImmediateFreedMonthly  int64    `json:"immediateFreedMonthlyRp"`
	Summary                string   `json:"summary"`
}

type DebtOptResult struct {
	TotalRemainingBalanceRp  int64                     `json:"totalRemainingBalanceRp"`
	TotalCurrentMonthlyRp    int64                     `json:"totalCurrentMonthlyRp"`
	ExtraLumpSumRp           int64                     `json:"extraLumpSumRp"`
	Strategies               []StrategyPlan            `json:"strategies"`
	UnlockMilestones         []CashflowUnlockMilestone `json:"unlockMilestones"`
	SpinjamMonthlyTotalRp    int64                     `json:"spinjamMonthlyTotalRp"`
	SpinjamFreedomLabel      string                    `json:"spinjamFreedomLabel"`
}

func simulateLumpSum(ordered []DebtContract, lumpSum int64, strategy string) StrategyPlan {
	rem := lumpSum
	var interestSaved, freedMonthly int64
	var monthsShaved int
	names := make([]string, 0, len(ordered))

	for _, c := range ordered {
		names = append(names, c.Name)
		bal := c.RemainingBalanceRp
		if bal <= 0 {
			bal = c.MonthlyInstallment * int64(c.RemainingMonths)
		}
		if rem > 0 && bal > 0 {
			applied := bal
			if rem < applied {
				applied = rem
			}
			rem -= applied
			ratio := float64(applied) / float64(bal)
			savedHere := int64(math.Round(float64(bal) * (c.MonthlyInterestPct / 100.0) * float64(c.RemainingMonths) * 0.55 * ratio))
			interestSaved += savedHere
			if applied >= bal {
				freedMonthly += c.MonthlyInstallment
				monthsShaved += c.RemainingMonths
			} else if c.MonthlyInstallment > 0 {
				monthsShaved += int(applied / c.MonthlyInstallment)
			}
		}
	}

	var summary string
	switch strategy {
	case "AVALANCHE":
		summary = "Prioritizes highest monthly APR contracts (SPinjam ~3.95%/mo) to minimize cumulative interest charges."
	case "SNOWBALL":
		summary = "Targets smallest remaining balances first to unlock immediate monthly cashflow relief fastest."
	default:
		summary = "Follows exact contractual maturity dates without prepaying principal."
	}

	return StrategyPlan{
		Strategy:               strategy,
		PriorityOrderNames:     names,
		EstimatedInterestSaved: interestSaved,
		MonthsShaved:           monthsShaved,
		ImmediateFreedMonthly:  freedMonthly,
		Summary:                summary,
	}
}

func OptimizeDebtPayoff(req DebtOptRequest) DebtOptResult {
	var totalBal, totalMonthly, spinjamMonthly int64
	unlockMap := map[string]*CashflowUnlockMilestone{}
	var latestSpinjamYM int
	latestSpinjamLabel := "Paid Off"
	eligibleContracts := make([]DebtContract, 0, len(req.Contracts))

	for _, c := range req.Contracts {
		if c.Instrument == "P1_VAULT_REFUND" {
			continue
		}
		bal := c.RemainingBalanceRp
		if bal <= 0 {
			bal = c.MonthlyInstallment * int64(c.RemainingMonths)
		}
		if bal <= 0 {
			continue
		}
		eligibleContracts = append(eligibleContracts, c)
		totalBal += bal
		totalMonthly += c.MonthlyInstallment
		isSpinjamOrPersonal := c.Instrument == "SPINJAM" || c.Instrument == "PERSONAL_DEBT"
		if isSpinjamOrPersonal {
			spinjamMonthly += c.MonthlyInstallment
			ym := c.PayoffYear*12 + c.PayoffMonth
			if ym > latestSpinjamYM {
				latestSpinjamYM = ym
				latestSpinjamLabel = c.PayoffLabel
			}
		}

		if c.PayoffYear > 0 && c.PayoffMonth > 0 && c.MonthlyInstallment > 0 {
			key := fmt.Sprintf("%04d-%02d", c.PayoffYear, c.PayoffMonth)
			ms, ok := unlockMap[key]
			if !ok {
				lbl := c.PayoffLabel
				if lbl == "" {
					lbl = fmt.Sprintf("%02d/%d", c.PayoffMonth, c.PayoffYear)
				}
				ms = &CashflowUnlockMilestone{
					UnlockMonth: c.PayoffMonth,
					UnlockYear:  c.PayoffYear,
					UnlockLabel: lbl,
				}
				unlockMap[key] = ms
			}
			ms.FreedMonthlyRp += c.MonthlyInstallment
			if isSpinjamOrPersonal {
				ms.SpinjamOnlyFreedRp += c.MonthlyInstallment
			}
			ms.FinishedContracts = append(ms.FinishedContracts, c.Name)
		}
	}

	keys := make([]string, 0, len(unlockMap))
	for k := range unlockMap {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var cumulative int64
	milestones := make([]CashflowUnlockMilestone, 0, len(keys))
	for _, k := range keys {
		ms := unlockMap[k]
		cumulative += ms.FreedMonthlyRp
		ms.CumulativeFreed = cumulative
		milestones = append(milestones, *ms)
	}

	avalancheOrder := append([]DebtContract(nil), eligibleContracts...)
	sort.SliceStable(avalancheOrder, func(i, j int) bool {
		if avalancheOrder[i].MonthlyInterestPct != avalancheOrder[j].MonthlyInterestPct {
			return avalancheOrder[i].MonthlyInterestPct > avalancheOrder[j].MonthlyInterestPct
		}
		return avalancheOrder[i].MonthlyInstallment > avalancheOrder[j].MonthlyInstallment
	})

	snowballOrder := append([]DebtContract(nil), eligibleContracts...)
	sort.SliceStable(snowballOrder, func(i, j int) bool {
		bi := snowballOrder[i].RemainingBalanceRp
		if bi <= 0 {
			bi = snowballOrder[i].MonthlyInstallment * int64(snowballOrder[i].RemainingMonths)
		}
		bj := snowballOrder[j].RemainingBalanceRp
		if bj <= 0 {
			bj = snowballOrder[j].MonthlyInstallment * int64(snowballOrder[j].RemainingMonths)
		}
		return bi < bj
	})

	strategies := []StrategyPlan{
		simulateLumpSum(eligibleContracts, 0, "CONTRACTUAL"),
		simulateLumpSum(avalancheOrder, req.ExtraLumpSumRp, "AVALANCHE"),
		simulateLumpSum(snowballOrder, req.ExtraLumpSumRp, "SNOWBALL"),
	}

	return DebtOptResult{
		TotalRemainingBalanceRp: totalBal,
		TotalCurrentMonthlyRp:   totalMonthly,
		ExtraLumpSumRp:          req.ExtraLumpSumRp,
		Strategies:              strategies,
		UnlockMilestones:        milestones,
		SpinjamMonthlyTotalRp:   spinjamMonthly,
		SpinjamFreedomLabel:     latestSpinjamLabel,
	}
}
