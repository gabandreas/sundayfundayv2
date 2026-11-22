package lifeenergy

import "math"

type LifeEnergyRequest struct {
	NetMonthlyIncomeRp   int64   `json:"netMonthlyIncomeRp"`
	WorkdaysPerMonth     int     `json:"workdaysPerMonth"`     // default 20
	WorkHoursPerDay      float64 `json:"workHoursPerDay"`      // default 8
	DailyCommuteHours    float64 `json:"dailyCommuteHours"`    // default 2 (KRL commute)
	MonthlyWorkExpenseRp int64   `json:"monthlyWorkExpenseRp"` // e.g. KRL commuter + lunches
	SampleAmountsRp      []int64 `json:"sampleAmountsRp,omitempty"`
}

type AmountConversion struct {
	AmountRp             int64   `json:"amountRp"`
	WorkHoursRequired    float64 `json:"workHoursRequired"`
	WorkDaysRequired     float64 `json:"workDaysRequired"`
	PctOfMonthlyLifePct  float64 `json:"pctOfMonthlyLifePct"`
}

type LifeEnergyResult struct {
	NominalHourlyWageRp     int64              `json:"nominalHourlyWageRp"`
	TrueNetHourlyWageRp     int64              `json:"trueNetHourlyWageRp"`
	TotalMonthlyWorkHours   float64            `json:"totalMonthlyWorkHours"`
	TotalMonthlyCommuteHrs  float64            `json:"totalMonthlyCommuteHours"`
	TotalLifeEnergyHours    float64            `json:"totalLifeEnergyHours"`
	NetIncomeAfterWorkCostRp int64             `json:"netIncomeAfterWorkCostRp"`
	Conversions             []AmountConversion `json:"conversions"`
}

func ComputeLifeEnergy(req LifeEnergyRequest) LifeEnergyResult {
	days := req.WorkdaysPerMonth
	if days <= 0 {
		days = 20
	}
	hrsPerDay := req.WorkHoursPerDay
	if hrsPerDay <= 0 {
		hrsPerDay = 8
	}
	commute := req.DailyCommuteHours
	if commute < 0 {
		commute = 0
	}

	workHrs := float64(days) * hrsPerDay
	commuteHrs := float64(days) * commute
	totalLifeHrs := workHrs + commuteHrs
	if totalLifeHrs <= 0 {
		totalLifeHrs = 160
	}

	netAfterWork := req.NetMonthlyIncomeRp - req.MonthlyWorkExpenseRp
	if netAfterWork < 0 {
		netAfterWork = 0
	}

	nominalHourly := int64(math.Round(float64(max0(req.NetMonthlyIncomeRp)) / workHrs))
	trueHourly := int64(math.Round(float64(netAfterWork) / totalLifeHrs))

	hoursPerDayInclCommute := hrsPerDay + commute
	samples := req.SampleAmountsRp
	if len(samples) == 0 {
		samples = []int64{35000, 150000, 350000, 1000000, 4017341}
	}
	convs := make([]AmountConversion, 0, len(samples))
	for _, amt := range samples {
		var hReq, dReq, pct float64
		if trueHourly > 0 && amt > 0 {
			hReq = math.Round((float64(amt)/float64(trueHourly))*10.0) / 10.0
			dReq = math.Round((hReq/hoursPerDayInclCommute)*10.0) / 10.0
			pct = math.Round((hReq/totalLifeHrs)*1000.0) / 10.0
		}
		convs = append(convs, AmountConversion{
			AmountRp:            amt,
			WorkHoursRequired:   hReq,
			WorkDaysRequired:    dReq,
			PctOfMonthlyLifePct: pct,
		})
	}

	return LifeEnergyResult{
		NominalHourlyWageRp:      nominalHourly,
		TrueNetHourlyWageRp:      trueHourly,
		TotalMonthlyWorkHours:    workHrs,
		TotalMonthlyCommuteHrs:   commuteHrs,
		TotalLifeEnergyHours:     totalLifeHrs,
		NetIncomeAfterWorkCostRp: netAfterWork,
		Conversions:              convs,
	}
}

func max0(v int64) int64 {
	if v < 0 {
		return 0
	}
	return v
}
