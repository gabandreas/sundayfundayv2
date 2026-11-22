package doctor

import "fmt"

type LineItemInput struct {
	ID       int64  `json:"id"`
	Month    int    `json:"month"`
	Year     int    `json:"year"`
	Category string `json:"category"` // PAYLATER | CREDIT_CARD | PERSONAL_DEBT | P1_VAULT_REFUND
	Amount   int64  `json:"amount"`
}

type BulkBillInput struct {
	Month              int   `json:"month"`
	Year               int   `json:"year"`
	PaylaterAmount     int64 `json:"paylaterAmount"`
	PersonalDebtAmount int64 `json:"personalDebtAmount"`
	CreditCardAmount   int64 `json:"creditCardAmount"`
	TotalAmount        int64 `json:"totalAmount"`
}

type SnapshotBalanceInput struct {
	Month                  int   `json:"month"`
	Year                   int   `json:"year"`
	FinalTotalIncome       int64 `json:"finalTotalIncome"`
	TotalDeductions        int64 `json:"totalDeductions"`
	FixedEssentials        int64 `json:"fixedEssentials"`
	DailyOperationalTarget int64 `json:"dailyOperationalTarget,omitempty"`
	ActualDailyOperational int64 `json:"actualDailyOperational"`
	BufferPocket           int64 `json:"bufferPocket"`
	ActualSavings          int64 `json:"actualSavings"`
	SelfReward             int64 `json:"selfReward"`
	DeficitUncovered       int64 `json:"deficitUncovered"`
	ManualDeductions       int64 `json:"manualDeductions"`
	ExpectedBulkDebt       int64 `json:"expectedBulkDebt"`
	IsManualOverride       bool  `json:"isManualOverride,omitempty"`
}

type AuditRequest struct {
	LineItems []LineItemInput        `json:"lineItems"`
	BulkBills []BulkBillInput        `json:"bulkBills"`
	Snapshots []SnapshotBalanceInput `json:"snapshots"`
}

type PeriodDriftFinding struct {
	Month         int    `json:"month"`
	Year          int    `json:"year"`
	SubLedgerDrift int64 `json:"subLedgerDrift"`
	DeductionDrift int64 `json:"deductionDrift"`
	WaterfallDrift int64 `json:"waterfallDrift"`
	Message       string `json:"message"`
}

type AuditResult struct {
	IsHealthy            bool                 `json:"isHealthy"`
	TotalSubLedgerDrift  int64                `json:"totalSubLedgerDrift"`
	TotalDeductionDrift  int64                `json:"totalDeductionDrift"`
	TotalWaterfallDrift  int64                `json:"totalWaterfallDrift"`
	Findings             []PeriodDriftFinding `json:"findings"`
}

func RunAudit(req AuditRequest) AuditResult {
	type key struct{ Y, M int }
	plSums := make(map[key]int64)
	pdSums := make(map[key]int64)

	for _, li := range req.LineItems {
		k := key{li.Year, li.Month}
		switch li.Category {
		case "PAYLATER":
			plSums[k] += li.Amount
		case "PERSONAL_DEBT", "P1_VAULT_REFUND":
			pdSums[k] += li.Amount
		}
	}

	bulkMap := make(map[key]BulkBillInput)
	for _, b := range req.BulkBills {
		bulkMap[key{b.Year, b.Month}] = b
	}

	var findings []PeriodDriftFinding
	var totalSub, totalDed, totalWat int64

	for _, b := range req.BulkBills {
		k := key{b.Year, b.Month}
		if _, hasPl := plSums[k]; hasPl && plSums[k] != b.PaylaterAmount {
			d := b.PaylaterAmount - plSums[k]
			if d < 0 {
				d = -d
			}
			totalSub += d
			findings = append(findings, PeriodDriftFinding{
				Month:          b.Month,
				Year:           b.Year,
				SubLedgerDrift: d,
				Message:        fmt.Sprintf("%d/%d PayLater bulk=%d != lineItems=%d", b.Month, b.Year, b.PaylaterAmount, plSums[k]),
			})
		}
		if _, hasPd := pdSums[k]; hasPd && pdSums[k] != b.PersonalDebtAmount {
			d := b.PersonalDebtAmount - pdSums[k]
			if d < 0 {
				d = -d
			}
			totalSub += d
			findings = append(findings, PeriodDriftFinding{
				Month:          b.Month,
				Year:           b.Year,
				SubLedgerDrift: d,
				Message:        fmt.Sprintf("%d/%d PersonalDebt bulk=%d != lineItems=%d", b.Month, b.Year, b.PersonalDebtAmount, pdSums[k]),
			})
		}
	}

	for _, s := range req.Snapshots {
		expectedDed := s.ManualDeductions + s.ExpectedBulkDebt
		dedDrift := s.TotalDeductions - expectedDed
		if dedDrift < 0 {
			dedDrift = -dedDrift
		}

		var watDrift int64
		if s.IsManualOverride {
			watDrift = 0
		} else if s.DeficitUncovered == 0 {
			allocated := s.TotalDeductions + s.FixedEssentials + s.BufferPocket + s.ActualDailyOperational + s.ActualSavings + s.SelfReward
			watDrift = s.FinalTotalIncome - allocated
			if watDrift < 0 {
				watDrift = -watDrift
			}
		} else {
			var eq1Drift, eq2Drift int64
			if s.FinalTotalIncome >= s.TotalDeductions+s.FixedEssentials {
				remAfterDaily := s.FinalTotalIncome - s.TotalDeductions - s.FixedEssentials - s.ActualDailyOperational
				fundedBuffer := int64(0)
				if remAfterDaily > 0 {
					fundedBuffer = s.BufferPocket
					if remAfterDaily < fundedBuffer {
						fundedBuffer = remAfterDaily
					}
				}
				cashAllocated := s.TotalDeductions + s.FixedEssentials + fundedBuffer + s.ActualDailyOperational + s.ActualSavings + s.SelfReward
				eq1Drift = s.FinalTotalIncome - cashAllocated
				if eq1Drift < 0 {
					eq1Drift = -eq1Drift
				}
			}
			if s.DailyOperationalTarget > 0 {
				plannedNeed := s.TotalDeductions + s.FixedEssentials + s.BufferPocket + s.DailyOperationalTarget + s.ActualSavings + s.SelfReward
				eq2Drift = (s.FinalTotalIncome + s.DeficitUncovered) - plannedNeed
				if eq2Drift < 0 {
					eq2Drift = -eq2Drift
				}
			}
			watDrift = eq1Drift
			if eq2Drift > watDrift {
				watDrift = eq2Drift
			}
		}

		totalDed += dedDrift
		totalWat += watDrift
		if dedDrift > 0 || watDrift > 0 {
			findings = append(findings, PeriodDriftFinding{
				Month:          s.Month,
				Year:           s.Year,
				DeductionDrift: dedDrift,
				WaterfallDrift: watDrift,
				Message:        fmt.Sprintf("%d/%d deductionDrift=%d waterfallDrift=%d", s.Month, s.Year, dedDrift, watDrift),
			})
		}
	}

	return AuditResult{
		IsHealthy:           totalSub == 0 && totalDed == 0 && totalWat == 0,
		TotalSubLedgerDrift: totalSub,
		TotalDeductionDrift: totalDed,
		TotalWaterfallDrift: totalWat,
		Findings:            findings,
	}
}
