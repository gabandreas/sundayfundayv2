package reconciler

import "testing"

func TestParseStatementBatchAutoRoutingAndDedup(t *testing.T) {
	req := ParseRequest{
		DefaultMethod: "PAYLATER",
		AnchorDay:     27,
		DefaultYear:   2026,
		RawText: `Date,Description,Amount
2026-11-16,Kopi Kenangan QRIS SPayLater,Rp 34.200
2026-11-14,Haircut Barbershop SPayLater,75000
2026-11-26,Claude API Permata Credit Card,185000`,
		ExistingItems: []ExistingLedgerItem{
			{ID: 29, Label: "Kopi Kenangan QRIS", AmountRp: 34200, DateIso: "2026-11-16", Instrument: "PAYLATER"},
		},
	}

	res := ParseStatementBatch(req)
	if res.ParsedCount != 3 {
		t.Fatalf("expected 3 parsed rows, got %d", res.ParsedCount)
	}
	if res.Rows[0].DuplicateStatus != "AMOUNT_DATE_MATCH" {
		t.Fatalf("expected row 0 duplicate match, got %s", res.Rows[0].DuplicateStatus)
	}
	if res.Rows[1].TargetPeriodCode != "12/2026" {
		t.Fatalf("expected Nov 14 SPayLater (<=15th cutoff -> due Dec 25) routed to 12/2026, got %s", res.Rows[1].TargetPeriodCode)
	}
	if res.Rows[2].Instrument != "CREDIT_CARD" || res.Rows[2].TargetPeriodCode != "01/2027" {
		t.Fatalf("expected Nov 26 Permata CC (>25th cutoff -> due Jan 11) routed to 01/2027, got %+v", res.Rows[2])
	}

	lockedRes := ParseStatementBatch(ParseRequest{
		DefaultMethod:     "CASH",
		AnchorDay:         27,
		DefaultYear:       2026,
		LockedPeriodCodes: []string{"10/2026"},
		EarliestOpenMonth: 11,
		EarliestOpenYear:  2026,
		RawText: `2026-09-12 | Kopi Fore | 38000 | SPayLater
2026-10-18 | Warung Nasi | 45000 | Cash`,
	})
	if len(lockedRes.Rows) != 2 || !lockedRes.Rows[0].AdvancedFromLocked || lockedRes.Rows[0].TargetPeriodCode != "11/2026" || !lockedRes.Rows[1].AdvancedFromLocked || lockedRes.Rows[1].TargetPeriodCode != "11/2026" {
		t.Fatalf("expected locked period rows to advance cleanly to 11/2026, got %+v", lockedRes.Rows)
	}

	// Never step backward into older DRAFT stubs when EarliestOpen precedes locked 10/2026
	monotonicRes := ParseStatementBatch(ParseRequest{
		DefaultMethod:     "CASH",
		AnchorDay:         27,
		DefaultYear:       2026,
		LockedPeriodCodes: []string{"10/2026"},
		EarliestOpenMonth: 6,
		EarliestOpenYear:  2026,
		RawText:           `2026-09-12 | Kopi Fore | 38000 | SPayLater`,
	})
	if len(monotonicRes.Rows) != 1 || monotonicRes.Rows[0].TargetPeriodCode != "11/2026" || !monotonicRes.Rows[0].AdvancedFromLocked {
		t.Fatalf("expected monotonic forward step from locked 10/2026 -> 11/2026 even with 06/2026 stub, got %+v", monotonicRes.Rows)
	}
}
