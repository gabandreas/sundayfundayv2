package doctor

import "testing"

func TestGoldenBaselineAuditZeroDrift(t *testing.T) {
	// Golden Baseline for NOV '26, DEC '26, JAN '27, FEB '27
	res := RunAudit(AuditRequest{
		Snapshots: []SnapshotBalanceInput{
			{
				Month:                  11,
				Year:                   2026,
				FinalTotalIncome:       5904000,
				TotalDeductions:        4017341,
				ExpectedBulkDebt:       4017341,
				FixedEssentials:        300000,
				ActualDailyOperational: 1500000,
				ActualSavings:          86659,
			},
			{
				Month:                  12,
				Year:                   2026,
				FinalTotalIncome:       9840917,
				TotalDeductions:        3171115,
				ExpectedBulkDebt:       3171115,
				FixedEssentials:        535000,
				ActualDailyOperational: 2850000,
				ActualSavings:          1000000,
				SelfReward:             2284802,
			},
			{
				Month:                  1,
				Year:                   2027,
				FinalTotalIncome:       5891000,
				TotalDeductions:        1967159,
				ExpectedBulkDebt:       1967159,
				FixedEssentials:        535000,
				ActualDailyOperational: 2850000,
				ActualSavings:          538841,
			},
			{
				Month:                  2,
				Year:                   2027,
				FinalTotalIncome:       5891000,
				TotalDeductions:        835996,
				ExpectedBulkDebt:       835996,
				FixedEssentials:        535000,
				ActualDailyOperational: 2850000,
				ActualSavings:          1000000,
				SelfReward:             670004,
			},
		},
	})
	if !res.IsHealthy {
		t.Fatalf("expected 0 Rp Golden Baseline drift, got findings: %+v", res.Findings)
	}
}

func TestProportionalLivingCashShortfallZeroDrift(t *testing.T) {
	// User #1 NOV '26 proportional living cash conservation:
	// NetIncome=5,904,000, TotalDebt=4,187,341, Routine=300,000, PlannedLiving=1,500,000
	// FundedLivingCash=1,416,659, Deficit=83,341, P1=0, P2=0
	res := RunAudit(AuditRequest{
		Snapshots: []SnapshotBalanceInput{
			{
				Month:                  11,
				Year:                   2026,
				FinalTotalIncome:       5904000,
				TotalDeductions:        4187341,
				ExpectedBulkDebt:       4187341,
				FixedEssentials:        300000,
				DailyOperationalTarget: 1500000,
				ActualDailyOperational: 1416659,
				DeficitUncovered:       83341,
			},
		},
	})
	if !res.IsHealthy {
		t.Fatalf("expected 0 Rp proportional conservation drift, got findings: %+v", res.Findings)
	}

	// Detect deliberate 1 Rp violation
	bad := RunAudit(AuditRequest{
		Snapshots: []SnapshotBalanceInput{
			{
				Month:                  11,
				Year:                   2026,
				FinalTotalIncome:       5904000,
				TotalDeductions:        4187341,
				ExpectedBulkDebt:       4187341,
				FixedEssentials:        300000,
				DailyOperationalTarget: 1500000,
				ActualDailyOperational: 0, // Cliff bug!
				DeficitUncovered:       83341,
			},
		},
	})
	if bad.IsHealthy || bad.TotalWaterfallDrift != 1416659 {
		t.Fatalf("expected cliff bug detection with drift=1416659, got %+v", bad)
	}
}
