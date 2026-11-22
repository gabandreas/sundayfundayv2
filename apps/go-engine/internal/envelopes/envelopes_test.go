package envelopes

import "testing"

func TestEvaluateEnvelopesAndAgeOfMoney(t *testing.T) {
	req := EnvelopesRequest{
		LiquidCashTotalRp:  4838220,
		DailyAverageBurnRp: 65000,
		CycleElapsedDays:   12,
		CycleTotalDays:     30,
		Envelopes: []EnvelopeQuota{
			{ID: "transport", Name: "KRL Commuter Transport", AllocatedRp: 300000, SpentRp: 220000, RolloverPolicy: "SWEEP_TO_P1"},
			{ID: "vape", Name: "Vape Supplies", AllocatedRp: 150000, SpentRp: 100000, RolloverPolicy: "ROLLOVER_NEXT_MONTH"},
		},
		SinkingFunds: []SinkingFundInput{
			{ID: "laptop", Name: "Laptop Service Reserve", TargetAmountRp: 1200000, CurrentSavedRp: 300000, MonthsRemaining: 6},
		},
	}

	res := EvaluateEnvelopes(req)
	if res.BufferDays != 74 {
		t.Fatalf("expected 74 buffer days, got %d", res.BufferDays)
	}
	if res.AgeOfMoneyDays != 74 {
		t.Fatalf("expected 74 savings runway days, got %d", res.AgeOfMoneyDays)
	}
	if res.TotalUnspentSweepToP1Rp != 80000 {
		t.Fatalf("expected 80000 sweep to P1, got %d", res.TotalUnspentSweepToP1Rp)
	}
	if res.TotalUnspentRollForwardRp != 50000 {
		t.Fatalf("expected 50000 roll forward, got %d", res.TotalUnspentRollForwardRp)
	}
	if res.TotalSinkingMonthlyRp != 150000 {
		t.Fatalf("expected 150000 sinking monthly, got %d", res.TotalSinkingMonthlyRp)
	}
}
