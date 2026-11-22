package anomaly

import "testing"

func TestEvaluateAnomaliesVelocityAndCreep(t *testing.T) {
	req := AnomalyRequest{
		PeriodLabel:         "NOV '26",
		TotalCycleDays:      30,
		ElapsedDays:         10,
		DailyLivingBudgetRp: 1500000,
		DailyLivingSpentRp:  750000, // 50% consumed in 33.3% days = 1.5x BURNING_FAST
		BaselineDailyRateRp: 50000,
		PostCutoffItems: []PostCutoffItem{
			{Title: "Vape Cartridge & Liquid", Instrument: "SPAYLATER", PurchaseDay: 15, AmountRp: 141000},
			{Title: "Mobile Data Quota", Instrument: "SPAYLATER", PurchaseDay: 15, AmountRp: 125000},
		},
		RecurringCharges: []RecurringCharge{
			{Label: "Gemini AI Pro", Category: "ai", AmountRp: 85470},
			{Label: "Gemini AI Pro 2", Category: "ai", AmountRp: 85470},
		},
	}

	res := EvaluateAnomalies(req)
	if res.VelocityStatus != "BURNING_FAST" {
		t.Fatalf("expected BURNING_FAST, got %s (velocity=%.2f)", res.VelocityStatus, res.BurnVelocityIndex)
	}
	if res.PostCutoffCreepRp != 266000 {
		t.Fatalf("expected 266000 post-cutoff creep, got %d", res.PostCutoffCreepRp)
	}
	if res.AlertCount < 3 {
		t.Fatalf("expected >= 3 anomaly alerts, got %d", res.AlertCount)
	}
}
