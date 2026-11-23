package main

import (
	"fmt"
	"math/rand"
	"testing"

	"sundayfunday.erp/go-engine/internal/anomaly"
	"sundayfunday.erp/go-engine/internal/cutoff"
	"sundayfunday.erp/go-engine/internal/debtopt"
	"sundayfunday.erp/go-engine/internal/doctor"
	"sundayfunday.erp/go-engine/internal/envelopes"
	"sundayfunday.erp/go-engine/internal/forecaster"
	"sundayfunday.erp/go-engine/internal/formula"
	"sundayfunday.erp/go-engine/internal/lifeenergy"
	"sundayfunday.erp/go-engine/internal/networth"
	"sundayfunday.erp/go-engine/internal/paycycle"
	"sundayfunday.erp/go-engine/internal/reconciler"
	"sundayfunday.erp/go-engine/internal/report"
	"sundayfunday.erp/go-engine/internal/timeline"
)

func TestAdversarialFuzz600VectorsAll13Packages(t *testing.T) {
	rng := rand.New(rand.NewSource(20261122))
	vectorCount := 0

	// 1. Paycycle Waterfall + Doctor Conservation Fuzz (250 vectors)
	edgeCases := []paycycle.WaterfallConfigRequest{
		// Exact User #1 NOV '26 proportional case
		{
			FinalTotalIncomeRp:     5904000,
			TotalDebtObligationsRp: 4187341,
			RoutineQuotasTotalRp:   300000,
			DailyLivingTargetRp:    1500000,
			BufferTargetRp:         0,
			CoreSavingsP1TargetRp:  500000,
		},
		// Rp 1 shortfall
		{
			FinalTotalIncomeRp:     5999999,
			TotalDebtObligationsRp: 4200000,
			RoutineQuotasTotalRp:   300000,
			DailyLivingTargetRp:    1500000,
			BufferTargetRp:         0,
			CoreSavingsP1TargetRp:  500000,
		},
		// Zero income extreme deficit
		{
			FinalTotalIncomeRp:     0,
			TotalDebtObligationsRp: 4200000,
			RoutineQuotasTotalRp:   300000,
			DailyLivingTargetRp:    1500000,
			BufferTargetRp:         250000,
			CoreSavingsP1TargetRp:  500000,
		},
		// Large int64 values (Rp 100B scale)
		{
			FinalTotalIncomeRp:     100_000_000_000,
			TotalDebtObligationsRp: 65_000_000_000,
			RoutineQuotasTotalRp:   10_000_000_000,
			DailyLivingTargetRp:    30_000_000_000,
			BufferTargetRp:         5_000_000_000,
			CoreSavingsP1TargetRp:  2_000_000_000,
		},
		// Buffer absorbs partial funding after full living cash
		{
			FinalTotalIncomeRp:     6000000,
			TotalDebtObligationsRp: 4000000,
			RoutineQuotasTotalRp:   300000,
			DailyLivingTargetRp:    1500000,
			BufferTargetRp:         500000,
			CoreSavingsP1TargetRp:  500000,
		},
	}

	for i := 0; i < 250; i++ {
		var req paycycle.WaterfallConfigRequest
		if i < len(edgeCases) {
			req = edgeCases[i]
		} else {
			req = paycycle.WaterfallConfigRequest{
				FinalTotalIncomeRp:     rng.Int63n(25_000_000),
				TotalDebtObligationsRp: rng.Int63n(15_000_000),
				RoutineQuotasTotalRp:   rng.Int63n(2_500_000),
				DailyLivingTargetRp:    rng.Int63n(5_000_000),
				BufferTargetRp:         rng.Int63n(1_500_000),
				CoreSavingsP1TargetRp:  rng.Int63n(3_000_000),
				SelfRewardP2TargetRp:   rng.Int63n(1_000_000),
			}
		}

		res := paycycle.EvaluateConfiguredWaterfall(req)

		// Check proportional living cash invariant
		availForLiving := req.FinalTotalIncomeRp - req.TotalDebtObligationsRp - req.RoutineQuotasTotalRp
		if availForLiving > 0 && req.DailyLivingTargetRp > 0 && res.DailyLivingFundedRp <= 0 {
			t.Fatalf("vector %d: expected DailyLivingFundedRp > 0 when avail=%d, target=%d", i, availForLiving, req.DailyLivingTargetRp)
		}
		if (availForLiving <= 0 || req.DailyLivingTargetRp <= 0) && res.DailyLivingFundedRp != 0 {
			t.Fatalf("vector %d: expected DailyLivingFundedRp == 0, got %d", i, res.DailyLivingFundedRp)
		}

		// Conservation Eq 1 when income covers debt + routine
		if res.FinalTotalIncomeRp >= res.DebtObligationsFundedRp+res.RoutineQuotasFundedRp {
			eq1 := res.DebtObligationsFundedRp + res.RoutineQuotasFundedRp + res.DailyLivingFundedRp + res.BufferFundedRp + res.CoreSavingsP1FundedRp + res.SelfRewardP2FundedRp
			if eq1 != res.FinalTotalIncomeRp {
				t.Fatalf("vector %d: Conservation Eq 1 failed: %d != %d", i, eq1, res.FinalTotalIncomeRp)
			}
		}

		// Conservation Eq 2 (always holds)
		plannedNeed := res.DebtObligationsFundedRp + res.RoutineQuotasFundedRp + req.DailyLivingTargetRp + req.BufferTargetRp + res.CoreSavingsP1FundedRp + res.SelfRewardP2FundedRp
		if res.FinalTotalIncomeRp+res.UncoveredDeficitRp != plannedNeed {
			t.Fatalf("vector %d: Conservation Eq 2 failed: %d+%d != %d", i, res.FinalTotalIncomeRp, res.UncoveredDeficitRp, plannedNeed)
		}

		// Feed into doctor
		docRes := doctor.RunAudit(doctor.AuditRequest{
			Snapshots: []doctor.SnapshotBalanceInput{
				{
					Month:                  (i % 12) + 1,
					Year:                   2026 + (i / 12),
					FinalTotalIncome:       res.FinalTotalIncomeRp,
					TotalDeductions:        res.DebtObligationsFundedRp,
					ExpectedBulkDebt:       res.DebtObligationsFundedRp,
					FixedEssentials:        res.RoutineQuotasFundedRp,
					DailyOperationalTarget: req.DailyLivingTargetRp,
					ActualDailyOperational: res.DailyLivingFundedRp,
					BufferPocket:           req.BufferTargetRp,
					ActualSavings:          res.CoreSavingsP1FundedRp,
					SelfReward:             res.SelfRewardP2FundedRp,
					DeficitUncovered:       res.UncoveredDeficitRp,
				},
			},
		})
		if !docRes.IsHealthy {
			t.Fatalf("vector %d: doctor flagged unhealthy on conserved result: %+v", i, docRes.Findings)
		}

		// Horizon test
		h := paycycle.ComputePaycycleHorizon(paycycle.HorizonRequest{
			Month:                (i % 12) + 1,
			Year:                 2026,
			AnchorDay:            27,
			ShiftWeekendToFriday: true,
			WeekendMultiplier:    1.5,
			RemainingBudgetRp:    res.DailyLivingFundedRp,
		})
		if res.DailyLivingFundedRp > 0 && h.RemainingDays > 0 && h.FlatDailyRateRp <= 0 {
			t.Fatalf("vector %d: expected positive flat rate when budget=%d and remDays=%d", i, res.DailyLivingFundedRp, h.RemainingDays)
		}
		vectorCount++
	}

	// 2. Cutoff + Lossless Integer Split Fuzz (100 vectors)
	boundaryDates := []string{
		"2026-11-14", "2026-11-15", "2026-11-23",
		"2026-11-25", "2026-11-26", "2026-12-15",
		"2026-12-16", "2027-02-12", "2027-02-13",
		"2028-02-14", "2026-12-31",
	}
	for i := 0; i < 100; i++ {
		tenor := (i % 24) + 1
		principal := int64(10_000 + rng.Int63n(50_000_000))
		if i == 0 {
			principal = 92000
			tenor = 3
		}
		inst := cutoff.InstrumentSPayLater
		if i%2 == 1 {
			inst = cutoff.InstrumentCreditCard
		}
		dateIso := boundaryDates[i%len(boundaryDates)]
		res := cutoff.SimulateCutoff(cutoff.CutoffRequest{
			Title:           fmt.Sprintf("Fuzz Item %d", i),
			Instrument:      inst,
			AmountMode:      cutoff.AmountModePrincipalSplit,
			PrincipalAmount: principal,
			TenorMonths:     tenor,
			PurchaseDate:    dateIso,
			HoldPastCutoff:  i%5 == 0,
			PeriodNetIncome: 6_000_000,
		})
		var sumSlices int64
		for _, s := range res.Slices {
			sumSlices += s.Amount
		}
		if sumSlices != principal {
			t.Fatalf("cutoff vector %d: lossless split violated: sum=%d != principal=%d (tenor=%d)", i, sumSlices, principal, tenor)
		}
		if !((i % 5) == 0) && inst == cutoff.InstrumentSPayLater && dateIso == "2026-11-14" && res.CrossedCutoff {
			t.Fatalf("Nov 14 SPayLater (< 15) must not cross cutoff")
		}
		if inst == cutoff.InstrumentSPayLater && (dateIso == "2026-11-15" || dateIso == "2026-11-23") && !res.CrossedCutoff {
			t.Fatalf("%s SPayLater (>= 15) must cross cutoff", dateIso)
		}
		if !((i % 5) == 0) && inst == cutoff.InstrumentCreditCard && dateIso == "2026-11-25" && res.CrossedCutoff {
			t.Fatalf("Nov 25 CC (<= 25) must not cross cutoff")
		}
		if inst == cutoff.InstrumentCreditCard && dateIso == "2026-11-26" && !res.CrossedCutoff {
			t.Fatalf("Nov 26 CC (> 25) must cross cutoff")
		}
		vectorCount++
	}

	// 3. Formula DSL Fuzz (70 vectors: valid expressions + div-by-zero + invalid token rejection)
	for i := 0; i < 70; i++ {
		netInc := float64(1_000_000 + rng.Int63n(20_000_000))
		debt := float64(rng.Int63n(10_000_000))
		vars := map[string]float64{
			"NET_INCOME": netInc,
			"TOTAL_DEBT": debt,
		}
		expr := "CLAMP(ROUND(({NET_INCOME} - {TOTAL_DEBT}) * 0.2), 0, 5000000)"
		expectValid := true
		switch i % 7 {
		case 1:
			expr = "IF({NET_INCOME} > {TOTAL_DEBT}, {NET_INCOME} - {TOTAL_DEBT}, 0)"
		case 2:
			expr = "MAX(MIN({NET_INCOME} / 0, 100), 0)"
			expectValid = false
		case 3:
			expr = "{NET_INCOME} / {TOTAL_DEBT}"
			expectValid = debt > 0
		case 4:
			expr = "DROP TABLE users;"
			expectValid = false
		case 5:
			expr = "ROUND(IF({NET_INCOME} >= 5000000, CLAMP({TOTAL_DEBT} * 1.0, 0, {NET_INCOME}), 0))"
		case 6:
			expr = "((({NET_INCOME} + {TOTAL_DEBT})" // unclosed paren
			expectValid = false
		}
		suite := formula.EvaluateFormulaSuite(formula.FormulaSuiteRequest{
			Variables: vars,
			Formulas:  map[string]string{"f": expr},
		})
		res := suite.Results["f"]
		if res.Valid != expectValid {
			t.Fatalf("formula vector %d (%s): expected valid=%v, got %v (err=%s)", i, expr, expectValid, res.Valid, res.Error)
		}
		vectorCount++
	}

	// 4. Remaining 10 Go Packages Adversarial Fuzz (200 vectors: 20 per package)
	for i := 0; i < 20; i++ {
		income := 4_000_000 + int64(rng.Intn(8_000_000))
		debt := int64(rng.Intn(4_500_000))
		living := int64(500_000 + rng.Intn(2_500_000))

		// timeline
		tl := timeline.SimulateTimeline(timeline.TimelineSimulateRequest{
			PeriodMonth:      (i % 12) + 1,
			PeriodYear:       2026,
			PaycheckDateIso:  "2026-11-27",
			PaycheckAmount:   income,
			TotalPaylaterDue: debt,
			DailyLivingPool:  living,
			RoutineBillsPool: 300_000,
		})
		if len(tl.Events) == 0 {
			t.Fatalf("timeline vector %d empty events", i)
		}
		vectorCount++

		// wallet guard in timeline
		wg := timeline.EvaluateWalletGuard(timeline.WalletGuardRequest{
			RemainingLivingCash:  living,
			ActualWalletBalance:  living + 200_000,
			ReservedBillsTotal:   200_000,
			DaysRemaining:        10,
			RemainingWeekdays:    7,
			RemainingWeekendDays: 3,
			WeekendMultiplier:    1.5,
		})
		if wg.FreeSpendableCash < 0 && living > 0 {
			t.Fatalf("wallet guard vector %d unexpected negative free cash: %d", i, wg.FreeSpendableCash)
		}
		vectorCount++

		// networth
		nw := networth.ComputeNetWorth(networth.NetWorthRequest{
			Accounts: []networth.AssetAccount{
				{ID: "a1", Name: "Payroll", AccountType: "OPERATIONAL_BANK", BalanceRp: int64(i * 100_000), IncludeInRunway: true, AnnualYieldPct: 4.5},
			},
			UpcomingPeriods: []networth.MonthlyPeriodFlow{
				{Month: 11, Year: 2026, TotalDebtDueRp: debt, PayLaterDueRp: debt},
			},
		})
		if nw.TotalAssetsRp < 0 || nw.TotalUnpaidDebtRp != debt {
			t.Fatalf("networth vector %d mismatch: %+v", i, nw)
		}
		vectorCount++

		// forecaster
		fc := forecaster.RunForecast(forecaster.ForecasterRequest{
			StartingLiquidAssetsRp: int64(i * 50_000),
			BaselineDailyBurnRp:    75_000,
			Periods: []forecaster.ForecastPeriod{
				{Month: 11, Year: 2026, TotalIncomeRp: income, TotalDebtDueRp: debt, PersonalDebtDueRp: debt / 2, DailyLivingRp: living},
			},
		})
		if len(fc.Series) != 1 {
			t.Fatalf("forecaster vector %d series len mismatch", i)
		}
		vectorCount++

		// anomaly
		an := anomaly.EvaluateAnomalies(anomaly.AnomalyRequest{
			PeriodLabel:         "NOV '26",
			TotalCycleDays:      30,
			ElapsedDays:         (i % 30) + 1,
			DailyLivingBudgetRp: living,
			DailyLivingSpentRp:  int64(i * 100_000),
		})
		if an.VelocityStatus == "" {
			t.Fatalf("anomaly vector %d blank velocity status", i)
		}
		vectorCount++

		// envelopes
		env := envelopes.EvaluateEnvelopes(envelopes.EnvelopesRequest{
			LiquidCashTotalRp:  living,
			DailyAverageBurnRp: int64(i * 5_000),
			Envelopes: []envelopes.EnvelopeQuota{
				{ID: "transport", Name: "Transport", AllocatedRp: 300_000, SpentRp: int64(i * 20_000)},
			},
		})
		if env.AgeOfMoneyDays < 0 {
			t.Fatalf("envelopes vector %d negative age of money", i)
		}
		vectorCount++

		// debtopt
		do := debtopt.OptimizeDebtPayoff(debtopt.DebtOptRequest{
			ExtraLumpSumRp: int64(i * 250_000),
			Contracts: []debtopt.DebtContract{
				{ID: "c1", Name: "SPinjam", Instrument: "SPINJAM", MonthlyInstallment: 335578, RemainingMonths: 2, RemainingBalanceRp: 671156, MonthlyInterestPct: 2.5},
			},
		})
		if len(do.Strategies) == 0 {
			t.Fatalf("debtopt vector %d missing strategies", i)
		}
		vectorCount++

		// lifeenergy
		le := lifeenergy.ComputeLifeEnergy(lifeenergy.LifeEnergyRequest{
			NetMonthlyIncomeRp: income,
			WorkdaysPerMonth:   20 + (i % 3),
			WorkHoursPerDay:    8,
			DailyCommuteHours:  2,
		})
		if le.TrueNetHourlyWageRp <= 0 {
			t.Fatalf("lifeenergy vector %d invalid hourly wage", i)
		}
		vectorCount++

		// reconciler
		rec := reconciler.ParseStatementBatch(reconciler.ParseRequest{
			RawText:       fmt.Sprintf("2026-11-%02d Coffee Shop Rp %d", (i%28)+1, 25000+i*1000),
			DefaultMethod: "CASH",
			DefaultYear:   2026,
		})
		if rec.TotalLines != 1 {
			t.Fatalf("reconciler vector %d line count mismatch", i)
		}
		vectorCount++

		// report
		rep := report.BuildExecutiveHorizon(report.HorizonRequest{
			SelectedMonth: 11,
			SelectedYear:  2026,
			Periods: []report.PeriodMetricInput{
				{Month: 11, Year: 2026, PeriodLabel: "NOV '26", FinalTotalIncome: income, TotalDebt: debt, ActualDailyOperational: living, DaysInCycle: 31},
			},
		})
		if rep.SelectedPeriodLabel == "" {
			t.Fatalf("report vector %d empty selected period label", i)
		}
		vectorCount++
	}

	if vectorCount < 600 {
		t.Fatalf("expected >= 600 fuzz vectors, executed %d", vectorCount)
	}
	t.Logf("Executed %d adversarial Go fuzz & property vectors across all 13 packages with 0 failures.", vectorCount)
}
