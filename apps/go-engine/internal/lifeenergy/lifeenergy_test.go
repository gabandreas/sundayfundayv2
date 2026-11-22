package lifeenergy

import "testing"

func TestComputeLifeEnergyWithCommute(t *testing.T) {
	res := ComputeLifeEnergy(LifeEnergyRequest{
		NetMonthlyIncomeRp:   5904000,
		WorkdaysPerMonth:     20,
		WorkHoursPerDay:      8,
		DailyCommuteHours:    2,
		MonthlyWorkExpenseRp: 300000,
		SampleAmountsRp:      []int64{280200, 1000000},
	})
	// Net after work = 5,604,000; life hrs = 200 -> 28,020 Rp/hr
	if res.TrueNetHourlyWageRp != 28020 {
		t.Fatalf("expected 28020 true hourly wage, got %d", res.TrueNetHourlyWageRp)
	}
	if len(res.Conversions) != 2 || res.Conversions[0].WorkHoursRequired != 10.0 {
		t.Fatalf("expected 10.0 work hours for 280,200, got %+v", res.Conversions)
	}
}
