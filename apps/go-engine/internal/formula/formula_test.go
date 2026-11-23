package formula

import "testing"

func TestProratedThrAndReservedWords(t *testing.T) {
	vars := map[string]float64{
		"BASE_SALARY":    5300000,
		"TENURE_MONTHS":  8.83,
		"NET_INCOME":     5904000,
		"LIVING_BUDGET":  1500000,
		"ROUTINE_BILLS":  300000,
		"SPINJAM_DEBT":   669970,
		"OTHER_DEBT":     0,
		"TOTAL_DEBT":     4017341,
		"OPTIMAL_DSR_PCT": 20,
		"MAX_SAFE_DSR_PCT": 35,
	}

	thr := EvaluateFormula("ROUND(({TENURE_MONTHS} / 12) * {BASE_SALARY})", vars)
	if !thr.Valid {
		t.Fatalf("expected valid THR formula, got error: %s", thr.Error)
	}
	if thr.ValueRp != 3899917 {
		t.Fatalf("expected 3899917, got %d", thr.ValueRp)
	}

	safeCeil := EvaluateFormula("MAX(0, {NET_INCOME} - {LIVING_BUDGET} - {ROUTINE_BILLS} - {SPINJAM_DEBT} - {OTHER_DEBT})", vars)
	if !safeCeil.Valid || safeCeil.ValueRp != 3434030 {
		t.Fatalf("expected safe ceiling 3434030, got %+v", safeCeil)
	}
}

func TestSafeFunctionsAndComparisons(t *testing.T) {
	vars := map[string]float64{
		"TOTAL_DEBT": 4017341,
		"NET_INCOME": 5904000,
	}

	r := EvaluateFormula("IF({TOTAL_DEBT} > PCT({NET_INCOME}, 50), CLAMP(FLOOR(12.9) + CEIL(1.2), 5, 13), MIN(1, 2, 3))", vars)
	if !r.Valid || r.ValueRp != 13 {
		t.Fatalf("expected 13, got %+v", r)
	}

	bad := EvaluateFormula("ROUND({UNKNOWN_TOKEN} / 0)", vars)
	if bad.Valid || bad.Error == "" {
		t.Fatalf("expected syntax/validation error for unknown token, got %+v", bad)
	}
}

func TestCalendarCutoffFormulaTokensAndFebruary(t *testing.T) {
	novRes := EvaluateFormula("DAYS_IN_MONTH - 15", map[string]float64{
		"DAYS_IN_MONTH": 30, "TX_DAY": 23, "TX_MONTH": 11, "TX_YEAR": 2026, "IS_LEAP_YEAR": 0, "DUE_DAY": 25,
	})
	if !novRes.Valid || novRes.ValueRp != 15 {
		t.Fatalf("expected 15 for 30-day Nov cutoff, got %+v", novRes)
	}

	feb27 := EvaluateFormula("{DAYS_IN_MONTH} - 15", map[string]float64{
		"DAYS_IN_MONTH": 28, "TX_DAY": 13, "TX_MONTH": 2, "TX_YEAR": 2027, "IS_LEAP_YEAR": 0, "DUE_DAY": 25,
	})
	if !feb27.Valid || feb27.ValueRp != 13 {
		t.Fatalf("expected 13 for non-leap Feb 2027, got %+v", feb27)
	}

	feb28Leap := EvaluateFormula("MIN(20, {DAYS_IN_MONTH} - 15)", map[string]float64{
		"DAYS_IN_MONTH": 29, "TX_DAY": 14, "TX_MONTH": 2, "TX_YEAR": 2028, "IS_LEAP_YEAR": 1, "DUE_DAY": 25,
	})
	if !feb28Leap.Valid || feb28Leap.ValueRp != 14 {
		t.Fatalf("expected 14 for leap Feb 2028, got %+v", feb28Leap)
	}
}
