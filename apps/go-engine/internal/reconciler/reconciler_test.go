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
	if res.Rows[0].DuplicateStatus != "AMOUNT_DATE_MATCH" || res.Rows[0].TargetPeriodCode != "12/2026" {
		t.Fatalf("expected row 0 duplicate match in 12/2026, got %+v", res.Rows[0])
	}
	if res.Rows[1].TargetPeriodCode != "11/2026" {
		t.Fatalf("expected Nov 14 SPayLater (< 15th cutoff -> due Nov 25) routed to 11/2026, got %s", res.Rows[1].TargetPeriodCode)
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

func TestParseKlikBcaCsvAndPermataPasteSecurity(t *testing.T) {
	klikBcaCsv := `No. Rekening,"1234567890"
Nama,"GABRIEL ANDREAS"
Periode,"01/11/2026 - 30/11/2026"
Mata Uang,"IDR"
Tanggal Transaksi,Keterangan,Cabang,Jumlah,Saldo
'18/11,"TRSF E-BANKING DB
18/11 QRIS KOPI KENANGAN REK 9955278221",0000,"48,000.00 DB","1,250,000.00"
'19/11,"BYR E-BANKING DB 19/11 LISTRIK TOKEN 123456789012",0000,"102.500,00 DB","1,147,500.00"
'25/11,"TRSF E-BANKING CR 25/11 GAJI PERMATA",0000,"5,543,500.00 CR","6,691,000.00"
Saldo Awal,"1,298,000.00"
Mutasi Kredit,"5,543,500.00"
Mutasi Debet,"150,500.00"
Saldo Akhir,"6,691,000.00"`

	res := ParseStatementBatch(ParseRequest{
		DefaultMethod: "CASH",
		AnchorDay:     27,
		DefaultYear:   2026,
		RawText:       klikBcaCsv,
	})

	if res.ParsedCount != 2 {
		t.Fatalf("expected strictly 2 DEBIT transaction rows (skipping headers, footers, CR inflow), got %d (%+v)", res.ParsedCount, res.Rows)
	}
	if res.SkippedCreditCount != 1 {
		t.Fatalf("expected SkippedCreditCount = 1, got %d", res.SkippedCreditCount)
	}
	if res.Rows[0].DateIso != "2026-11-18" || res.Rows[0].AmountRp != 48000 {
		t.Fatalf("expected row 0 2026-11-18 Rp 48000 (not Saldo 1,250,000 and not 4,800,000), got %+v", res.Rows[0])
	}
	if res.Rows[0].InferredCategory != "FOOD_DINING" {
		t.Fatalf("expected row 0 category FOOD_DINING, got %s", res.Rows[0].InferredCategory)
	}
	if res.Rows[1].DateIso != "2026-11-19" || res.Rows[1].AmountRp != 102500 {
		t.Fatalf("expected row 1 2026-11-19 Rp 102500, got %+v", res.Rows[1])
	}
	if res.TotalAmountRp != 150500 {
		t.Fatalf("expected TotalAmountRp = 150500, got %d", res.TotalAmountRp)
	}
	if containsUnmaskedAccount(res.Rows[0].Description, "9955278221") || containsUnmaskedAccount(res.Rows[1].Description, "123456789012") {
		t.Fatalf("expected 10-16 digit account numbers masked in description, got row0=%q row1=%q", res.Rows[0].Description, res.Rows[1].Description)
	}

	// Permata / myBCA tab-separated paste with DB/CR
	permataRes := ParseStatementBatch(ParseRequest{
		DefaultMethod: "CASH",
		AnchorDay:     27,
		DefaultYear:   2026,
		RawText: "16/11/2026\tQRIS WARUNG NASI\t35.000 DB\n" +
			"17/11/2026\tTRANSFER MASUK PAYROLL\t5.000.000 CR",
	})
	if permataRes.ParsedCount != 1 || permataRes.Rows[0].AmountRp != 35000 || permataRes.SkippedCreditCount != 1 {
		t.Fatalf("expected Permata TSV 1 debit Rp 35000 + 1 skipped credit, got %+v", permataRes)
	}
}

func containsUnmaskedAccount(s, acct string) bool {
	return len(acct) >= 10 && len(s) >= len(acct) && (stringContains(s, acct))
}

func stringContains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
