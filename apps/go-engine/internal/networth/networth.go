package networth

import (
	"fmt"
	"math"
)

type AssetAccount struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Institution      string  `json:"institution"`
	AccountType      string  `json:"accountType"` // OPERATIONAL_BANK | MONEY_MARKET_RDPU | CASH_WALLET | SAVINGS_VAULT
	BalanceRp        int64   `json:"balanceRp"`
	AnnualYieldPct   float64 `json:"annualYieldPct"`
	IncludeInRunway  bool    `json:"includeInRunway"`
	IsPrimaryPayroll bool    `json:"isPrimaryPayroll"`
}

type MonthlyPeriodFlow struct {
	Month                int    `json:"month"`
	Year                 int    `json:"year"`
	Label                string `json:"label"`
	ProjectedSavingsP1Rp int64  `json:"projectedSavingsP1Rp"`
	ProjectedSurplusP2Rp int64  `json:"projectedSurplusP2Rp"`
	TotalDebtDueRp       int64  `json:"totalDebtDueRp"`
	PayLaterDueRp        int64  `json:"payLaterDueRp"`
	CreditCardDueRp      int64  `json:"creditCardDueRp"`
	PersonalDebtDueRp    int64  `json:"personalDebtDueRp"`
}

type NetWorthRequest struct {
	Accounts        []AssetAccount      `json:"accounts"`
	UpcomingPeriods []MonthlyPeriodFlow `json:"upcomingPeriods"`
}

type TrajectoryPoint struct {
	Month             int    `json:"month"`
	Year              int    `json:"year"`
	Label             string `json:"label"`
	ProjectedAssetsRp int64  `json:"projectedAssetsRp"`
	RemainingDebtRp   int64  `json:"remainingDebtRp"`
	NetWorthRp        int64  `json:"netWorthRp"`
	MonthlyYieldRp    int64  `json:"monthlyYieldRp"`
}

type NetWorthResult struct {
	LiquidAssetsRp               int64             `json:"liquidAssetsRp"`
	TotalAssetsRp                int64             `json:"totalAssetsRp"`
	TotalUnpaidDebtRp            int64             `json:"totalUnpaidDebtRp"`
	CurrentCycleDebtRp           int64             `json:"currentCycleDebtRp"`
	FutureInstallmentPrincipalRp int64             `json:"futureInstallmentPrincipalRp"`
	PayLaterPrincipalRp          int64             `json:"payLaterPrincipalRp"`
	CreditCardPrincipalRp        int64             `json:"creditCardPrincipalRp"`
	PersonalDebtPrincipalRp      int64             `json:"personalDebtPrincipalRp"`
	LiquidNetWorthRp             int64             `json:"liquidNetWorthRp"`
	TotalNetWorthRp              int64             `json:"totalNetWorthRp"`
	AssetToDebtCoveragePct       float64           `json:"assetToDebtCoveragePct"`
	DebtToAssetLeveragePct       float64           `json:"debtToAssetLeveragePct"`
	MonthlyRdpuYieldRp           int64             `json:"monthlyRdpuYieldRp"`
	Trajectory                   []TrajectoryPoint `json:"trajectory"`
}

func ComputeNetWorth(req NetWorthRequest) NetWorthResult {
	var liquidAssets, totalAssets, monthlyYield int64
	var weightedYieldSum float64
	var yieldEligibleBalance int64

	for _, acc := range req.Accounts {
		bal := acc.BalanceRp
		if bal < 0 {
			bal = 0
		}
		totalAssets += bal
		if acc.IncludeInRunway || acc.AccountType == "OPERATIONAL_BANK" || acc.AccountType == "MONEY_MARKET_RDPU" || acc.AccountType == "CASH_WALLET" {
			liquidAssets += bal
		}
		if acc.AnnualYieldPct > 0 && bal > 0 {
			y := int64(math.Round(float64(bal) * (acc.AnnualYieldPct / 100.0) / 12.0))
			monthlyYield += y
			weightedYieldSum += float64(bal) * (acc.AnnualYieldPct / 100.0) / 12.0
			yieldEligibleBalance += bal
		}
	}

	var plTotal, ccTotal, pdTotal, totalDebt, currentCycleDebt, futureInstallmentPrincipal int64
	for idx, p := range req.UpcomingPeriods {
		plTotal += max0(p.PayLaterDueRp)
		ccTotal += max0(p.CreditCardDueRp)
		pdTotal += max0(p.PersonalDebtDueRp)
		periodDebt := p.TotalDebtDueRp
		if periodDebt <= 0 {
			periodDebt = max0(p.PayLaterDueRp) + max0(p.CreditCardDueRp) + max0(p.PersonalDebtDueRp)
		}
		totalDebt += periodDebt
		if idx == 0 {
			currentCycleDebt += periodDebt
		} else {
			futureInstallmentPrincipal += periodDebt
		}
	}

	var avgMonthlyRate float64
	if yieldEligibleBalance > 0 {
		avgMonthlyRate = weightedYieldSum / float64(yieldEligibleBalance)
	}
	if avgMonthlyRate < 0 {
		avgMonthlyRate = 0
	}

	coveragePct := 100.0
	if totalDebt > 0 {
		coveragePct = math.Round((float64(totalAssets)/float64(totalDebt))*1000.0) / 10.0
	}
	leveragePct := 0.0
	if totalAssets > 0 {
		leveragePct = math.Round((float64(totalDebt)/float64(totalAssets))*1000.0) / 10.0
	} else if totalDebt > 0 {
		leveragePct = 100.0
	}

	runningAssets := totalAssets
	remainingDebt := totalDebt
	trajectory := make([]TrajectoryPoint, 0, len(req.UpcomingPeriods))
	limit := len(req.UpcomingPeriods)
	if limit > 12 {
		limit = 12
	}
	for i := 0; i < limit; i++ {
		p := req.UpcomingPeriods[i]
		periodYield := int64(math.Round(float64(runningAssets) * avgMonthlyRate))
		if runningAssets <= 0 {
			periodYield = 0
		}
		runningAssets += max0(p.ProjectedSavingsP1Rp) + max0(p.ProjectedSurplusP2Rp) + periodYield
		debtPaid := p.TotalDebtDueRp
		if debtPaid <= 0 {
			debtPaid = max0(p.PayLaterDueRp) + max0(p.CreditCardDueRp) + max0(p.PersonalDebtDueRp)
		}
		remainingDebt -= debtPaid
		if remainingDebt < 0 {
			remainingDebt = 0
		}
		label := p.Label
		if label == "" {
			label = fmt.Sprintf("%02d/%d", p.Month, p.Year)
		}
		trajectory = append(trajectory, TrajectoryPoint{
			Month:             p.Month,
			Year:              p.Year,
			Label:             label,
			ProjectedAssetsRp: runningAssets,
			RemainingDebtRp:   remainingDebt,
			NetWorthRp:        runningAssets - remainingDebt,
			MonthlyYieldRp:    periodYield,
		})
	}

	return NetWorthResult{
		LiquidAssetsRp:               liquidAssets,
		TotalAssetsRp:                totalAssets,
		TotalUnpaidDebtRp:            totalDebt,
		CurrentCycleDebtRp:           currentCycleDebt,
		FutureInstallmentPrincipalRp: futureInstallmentPrincipal,
		PayLaterPrincipalRp:          plTotal,
		CreditCardPrincipalRp:        ccTotal,
		PersonalDebtPrincipalRp:      pdTotal,
		LiquidNetWorthRp:             liquidAssets - totalDebt,
		TotalNetWorthRp:              totalAssets - totalDebt,
		AssetToDebtCoveragePct:       coveragePct,
		DebtToAssetLeveragePct:       leveragePct,
		MonthlyRdpuYieldRp:           monthlyYield,
		Trajectory:                   trajectory,
	}
}

func max0(v int64) int64 {
	if v < 0 {
		return 0
	}
	return v
}
