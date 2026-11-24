package reconciler

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"sundayfunday.erp/go-engine/internal/paycycle"
)

type ExistingLedgerItem struct {
	ID         int    `json:"id"`
	Label      string `json:"label"`
	AmountRp   int64  `json:"amountRp"`
	DateIso    string `json:"dateIso"`
	Instrument string `json:"instrument"`
}

type ParseRequest struct {
	RawText           string                          `json:"rawText"`
	DefaultMethod     string                          `json:"defaultMethod"` // CASH | PAYLATER | CREDIT_CARD
	AnchorDay         int                             `json:"anchorDay"`
	CutoffRules       []paycycle.InstrumentCutoffRule `json:"cutoffRules,omitempty"`
	ExistingItems     []ExistingLedgerItem            `json:"existingItems,omitempty"`
	DefaultYear       int                             `json:"defaultYear"`
	LockedPeriodCodes []string                        `json:"lockedPeriodCodes,omitempty"`
	EarliestOpenMonth int                             `json:"earliestOpenMonth,omitempty"`
	EarliestOpenYear  int                             `json:"earliestOpenYear,omitempty"`
}

type ParsedRow struct {
	LineNumber         int    `json:"lineNumber"`
	RawLine            string `json:"rawLine"`
	DateIso            string `json:"dateIso"`
	Description        string `json:"description"`
	AmountRp           int64  `json:"amountRp"`
	Instrument         string `json:"instrument"`
	InferredCategory   string `json:"inferredCategory"`
	TargetPeriodMonth  int    `json:"targetPeriodMonth"`
	TargetPeriodYear   int    `json:"targetPeriodYear"`
	TargetPeriodCode   string `json:"targetPeriodCode"`
	OriginalPeriodCode string `json:"originalPeriodCode,omitempty"`
	AdvancedFromLocked bool   `json:"advancedFromLocked"`
	CrossedCutoff      bool   `json:"crossedCutoff"`
	DuplicateStatus    string `json:"duplicateStatus"` // NEW_ENTRY | AMOUNT_DATE_MATCH | EXACT_MATCH
	MatchedItemID      int    `json:"matchedItemId,omitempty"`
	MatchedItemLabel   string `json:"matchedItemLabel,omitempty"`
}

type ParseResult struct {
	TotalLines         int         `json:"totalLines"`
	ParsedCount        int         `json:"parsedCount"`
	NewEntryCount      int         `json:"newEntryCount"`
	DuplicateCount     int         `json:"duplicateCount"`
	SkippedCreditCount int         `json:"skippedCreditCount"`
	TotalAmountRp      int64       `json:"totalAmountRp"`
	Rows               []ParsedRow `json:"rows"`
}

var (
	isoDateRx         = regexp.MustCompile(`\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b`)
	dmyDateRx         = regexp.MustCompile(`\b(\d{1,2})[-/](\d{1,2})(?:[-/](20\d{2}))?\b`)
	amountRx          = regexp.MustCompile(`(?:Rp\.?\s*|IDR\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{4,9}(?:[.,]\d{2})?)\b(?:\s*(?:DB|CR))?`)
	rpPrefixRx        = regexp.MustCompile(`(?i)\b(?:rp|idr)\.?\s*[\d.,]+`)
	creditMarkerRx    = regexp.MustCompile(`(?i)(?:^\s*(?:rp\.?\s*|idr\s*)?\d[\d.,]*\s*(?:CR|KREDIT|CREDIT)\s*$|\d\s*CR\b|\bCR\s*$|\bTRSF E-BANKING CR\b|\bBI-FAST CR\b|\bMUTASI KREDIT\b)`)
	debitCellRx       = regexp.MustCompile(`(?i)^\s*(?:rp\.?\s*|idr\s*)?\d[\d.,]*\s*(?:DB|DEBET|DEBIT)\s*$`)
	accountMaskRx     = regexp.MustCompile(`\b\d{10,16}\b`)
	trailingCentsRx   = regexp.MustCompile(`[.,]\d{2}$`)
	branchCodeZeroRx  = regexp.MustCompile(`^\d{4}$`)
)

const maxReconcilerRows = 500

func maskAccountNumbers(text string) string {
	return accountMaskRx.ReplaceAllStringFunc(text, func(m string) string {
		return "****" + m[len(m)-4:]
	})
}

func parseAmountRp(token string) int64 {
	trimmed := strings.TrimSpace(token)
	upper := strings.ToUpper(trimmed)
	upper = strings.TrimSpace(strings.TrimSuffix(strings.TrimSuffix(upper, "DB"), "CR"))
	upper = strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(upper, "IDR"), "RP"))
	upper = strings.TrimSpace(strings.TrimPrefix(upper, "."))

	// Strip trailing decimal cents (.00 or ,00) before removing thousand separators
	if trailingCentsRx.MatchString(upper) {
		upper = upper[:len(upper)-3]
	}

	clean := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, upper)
	if clean == "" {
		return 0
	}
	v, err := strconv.ParseInt(clean, 10, 64)
	if err != nil {
		return 0
	}
	return v
}

func splitLogicalRecords(rawText string) []string {
	normalized := strings.ReplaceAll(strings.ReplaceAll(rawText, "\r\n", "\n"), "\r", "\n")
	var records []string
	var cur strings.Builder
	inQuotes := false

	for i := 0; i < len(normalized); i++ {
		ch := normalized[i]
		if ch == '"' {
			inQuotes = !inQuotes
			cur.WriteByte(ch)
			continue
		}
		if ch == '\n' {
			if inQuotes {
				cur.WriteByte(' ')
			} else {
				records = append(records, cur.String())
				cur.Reset()
			}
			continue
		}
		cur.WriteByte(ch)
	}
	if cur.Len() > 0 {
		records = append(records, cur.String())
	}
	return records
}

func parseCsvCells(line string) []string {
	var cells []string
	var cur strings.Builder
	inQuotes := false

	for i := 0; i < len(line); i++ {
		ch := line[i]
		if ch == '"' {
			if inQuotes && i+1 < len(line) && line[i+1] == '"' {
				cur.WriteByte('"')
				i++
			} else {
				inQuotes = !inQuotes
			}
			continue
		}
		if ch == ',' && !inQuotes {
			cells = append(cells, strings.TrimSpace(cur.String()))
			cur.Reset()
			continue
		}
		cur.WriteByte(ch)
	}
	cells = append(cells, strings.TrimSpace(cur.String()))
	return cells
}

func splitRowCells(line string) ([]string, string) {
	if strings.Contains(line, "|") {
		raw := strings.Split(line, "|")
		cells := make([]string, len(raw))
		for i, c := range raw {
			cells[i] = strings.TrimSpace(c)
		}
		return cells, "PIPE"
	}
	if strings.Contains(line, "\t") {
		raw := strings.Split(line, "\t")
		cells := make([]string, len(raw))
		for i, c := range raw {
			cells[i] = strings.TrimSpace(c)
		}
		return cells, "TSV"
	}
	if strings.Contains(line, ",") {
		cells := parseCsvCells(line)
		if len(cells) >= 2 {
			return cells, "CSV"
		}
	}
	return nil, "PLAIN"
}

func isMetadataOrFooterRow(line string, cells []string) bool {
	lower := strings.ToLower(strings.TrimSpace(line))
	firstCell := lower
	if len(cells) > 0 {
		firstCell = strings.ToLower(strings.Trim(strings.TrimSpace(cells[0]), `"'`))
	}
	prefixes := []string{
		"#",
		"date,",
		"tanggal",
		"no. rekening",
		"no rekening",
		"account number",
		"account no",
		"nama",
		"periode",
		"mata uang",
		"currency",
		"saldo awal",
		"mutasi kredit",
		"mutasi debet",
		"mutasi debit",
		"saldo akhir",
		"starting balance",
		"ending balance",
		"total debet",
		"total debit",
		"total kredit",
		"total credit",
	}
	for _, p := range prefixes {
		if strings.HasPrefix(lower, p) || strings.HasPrefix(firstCell, p) {
			return true
		}
	}
	return false
}

func extractDateIso(text string, defYear int) (string, string) {
	cleaned := strings.TrimLeft(strings.TrimSpace(text), "'")
	if m := isoDateRx.FindStringSubmatch(cleaned); len(m) == 4 {
		yr, _ := strconv.Atoi(m[1])
		mo, _ := strconv.Atoi(m[2])
		dy, _ := strconv.Atoi(m[3])
		return fmt.Sprintf("%04d-%02d-%02d", yr, mo, dy), m[0]
	}
	if m := dmyDateRx.FindStringSubmatch(cleaned); len(m) >= 3 {
		dy, _ := strconv.Atoi(m[1])
		mo, _ := strconv.Atoi(m[2])
		yr := defYear
		if len(m) == 4 && m[3] != "" {
			yr, _ = strconv.Atoi(m[3])
		}
		if mo >= 1 && mo <= 12 && dy >= 1 && dy <= 31 {
			return fmt.Sprintf("%04d-%02d-%02d", yr, mo, dy), m[0]
		}
	}
	return time.Now().Format("2006-01-02"), ""
}

func inferInstrument(line, defaultInst string) string {
	lower := strings.ToLower(line)
	switch {
	case strings.Contains(lower, "spaylater") || strings.Contains(lower, "paylater") || strings.Contains(lower, "bnpl"):
		return "PAYLATER"
	case strings.Contains(lower, "permata credit") || strings.Contains(lower, "credit card") || strings.Contains(lower, "kartu kredit") || strings.Contains(lower, " cc "):
		return "CREDIT_CARD"
	case strings.Contains(lower, "spinjam"):
		return "CASH_LOAN"
	case strings.Contains(lower, "qris") || strings.Contains(lower, "bca") || strings.Contains(lower, "permata") || strings.Contains(lower, "cash") || strings.Contains(lower, "transfer"):
		if defaultInst != "" {
			return defaultInst
		}
		return "CASH"
	}
	if defaultInst != "" {
		return defaultInst
	}
	return "CASH"
}

func inferCategory(desc string) string {
	lower := strings.ToLower(desc)
	switch {
	case strings.Contains(lower, "kopi") || strings.Contains(lower, "coffee") || strings.Contains(lower, "sate") || strings.Contains(lower, "nasi") || strings.Contains(lower, "grabfood") || strings.Contains(lower, "gofood"):
		return "FOOD_DINING"
	case strings.Contains(lower, "krl") || strings.Contains(lower, "commuter") || strings.Contains(lower, "gojek") || strings.Contains(lower, "grab") || strings.Contains(lower, "transport"):
		return "TRANSPORT"
	case strings.Contains(lower, "listrik") || strings.Contains(lower, "pln") || strings.Contains(lower, "pdam") || strings.Contains(lower, "token"):
		return "UTILITIES"
	case strings.Contains(lower, "vape") || strings.Contains(lower, "liquid") || strings.Contains(lower, "rokok") || strings.Contains(lower, "cigar"):
		return "LIFESTYLE_VAPE"
	case strings.Contains(lower, "telkomsel") || strings.Contains(lower, "kuota") || strings.Contains(lower, "internet") || strings.Contains(lower, "data"):
		return "INTERNET"
	case strings.Contains(lower, "haircut") || strings.Contains(lower, "cukur") || strings.Contains(lower, "barber"):
		return "HAIRCUT"
	case strings.Contains(lower, "claude") || strings.Contains(lower, "gemini") || strings.Contains(lower, "apple") || strings.Contains(lower, "vidio"):
		return "SUBSCRIPTION"
	default:
		return "GENERAL"
	}
}

func ParseStatementBatch(req ParseRequest) ParseResult {
	defYear := req.DefaultYear
	if defYear < 2020 {
		defYear = time.Now().Year()
	}
	anchor := req.AnchorDay
	if anchor <= 0 {
		anchor = 27
	}
	defMethod := strings.ToUpper(strings.TrimSpace(req.DefaultMethod))
	if defMethod == "" {
		defMethod = "CASH"
	}

	lockedMap := make(map[string]bool, len(req.LockedPeriodCodes))
	maxLockedSerial := 0
	for _, code := range req.LockedPeriodCodes {
		trimmed := strings.TrimSpace(code)
		lockedMap[trimmed] = true
		if parts := strings.Split(trimmed, "/"); len(parts) == 2 {
			lm, errM := strconv.Atoi(parts[0])
			ly, errY := strconv.Atoi(parts[1])
			if errM == nil && errY == nil && lm >= 1 && lm <= 12 {
				if ser := ly*12 + lm; ser > maxLockedSerial {
					maxLockedSerial = ser
				}
			}
		}
	}

	lines := splitLogicalRecords(req.RawText)
	rows := make([]ParsedRow, 0, len(lines))
	var totalAmt int64
	var newCount, dupCount, skippedCreditCount int

	for idx, raw := range lines {
		if len(rows) >= maxReconcilerRows {
			break
		}
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}

		cells, formatKind := splitRowCells(line)
		if isMetadataOrFooterRow(line, cells) {
			continue
		}

		var dateIso string
		var dateMatchStr string
		var amountRp int64
		var desc string
		isCreditInflow := false

		if formatKind != "PLAIN" && len(cells) >= 2 {
			dateColIdx := -1
			for ci, c := range cells {
				cClean := strings.TrimLeft(strings.TrimSpace(c), "'")
				if strings.EqualFold(cClean, "PEND") {
					dateColIdx = ci
					dateIso = time.Now().Format("2006-01-02")
					break
				}
				if d, tok := extractDateIso(cClean, defYear); tok != "" {
					dateColIdx = ci
					dateIso = d
					dateMatchStr = tok
					break
				}
			}
			if dateColIdx == -1 {
				dateIso = time.Now().Format("2006-01-02")
			}

			// Locate the true transaction amount column, preferring an explicit DB/CR amount cell
			// and ignoring trailing Saldo columns (like KlikBCA col 5 after DB/CR col 4).
			amountColIdx := -1
			for ci := 0; ci < len(cells); ci++ {
				if ci == dateColIdx {
					continue
				}
				cellTrim := strings.TrimSpace(cells[ci])
				if creditMarkerRx.MatchString(cellTrim) {
					isCreditInflow = true
					amountColIdx = ci
					break
				}
				if debitCellRx.MatchString(cellTrim) && amountRx.MatchString(cellTrim) {
					if m := amountRx.FindAllStringSubmatch(cellTrim, -1); len(m) > 0 {
						last := m[len(m)-1]
						if parsed := parseAmountRp(last[1]); parsed > 0 {
							amountRp = parsed
							amountColIdx = ci
							break
						}
					}
				}
			}

			if isCreditInflow {
				skippedCreditCount++
				continue
			}

			// Fallback scan for standard CSV / TSV / PIPE without explicit DB/CR marker
			if amountColIdx == -1 {
				for ci := len(cells) - 1; ci >= 0; ci-- {
					if ci == dateColIdx {
						continue
					}
					cellTrim := strings.TrimSpace(cells[ci])
					if branchCodeZeroRx.MatchString(cellTrim) {
						continue
					}
					if m := amountRx.FindAllStringSubmatch(cellTrim, -1); len(m) > 0 {
						last := m[len(m)-1]
						if parsed := parseAmountRp(last[1]); parsed > 0 {
							amountRp = parsed
							amountColIdx = ci
							break
						}
					}
				}
			}

			if amountRp <= 0 {
				continue
			}

			var descParts []string
			for ci, c := range cells {
				if ci == dateColIdx || ci == amountColIdx {
					continue
				}
				// Skip trailing Saldo column immediately after KlikBCA DB/CR column
				if amountColIdx != -1 && ci > amountColIdx && amountRx.MatchString(strings.TrimSpace(c)) {
					continue
				}
				// Skip numeric 4-digit branch codes (e.g. 0000) in KlikBCA exports
				trimmedCell := strings.TrimSpace(c)
				if branchCodeZeroRx.MatchString(trimmedCell) {
					continue
				}
				if trimmedCell != "" {
					descParts = append(descParts, trimmedCell)
				}
			}
			desc = strings.Join(strings.Fields(maskAccountNumbers(strings.Join(descParts, " "))), " ")
			if desc == "" {
				desc = "Imported Statement Entry"
			}
		} else {
			if creditMarkerRx.MatchString(line) {
				skippedCreditCount++
				continue
			}
			dateIso, dateMatchStr = extractDateIso(line, defYear)

			cleanedForAmount := maskAccountNumbers(line)
			if dateMatchStr != "" {
				cleanedForAmount = strings.Replace(cleanedForAmount, dateMatchStr, " ", 1)
			}
			amtMatches := amountRx.FindAllStringSubmatch(cleanedForAmount, -1)
			amtToken := ""
			if len(amtMatches) > 0 {
				last := amtMatches[len(amtMatches)-1]
				amountRp = parseAmountRp(last[1])
				amtToken = last[0]
			}
			if amountRp <= 0 {
				continue
			}

			desc = cleanedForAmount
			if amtToken != "" {
				desc = rpPrefixRx.ReplaceAllString(desc, " ")
				desc = strings.Replace(desc, amtToken, " ", 1)
			}
			desc = strings.NewReplacer(",", " ", ";", " ", "|", " ", "\t", " ").Replace(desc)
			desc = strings.Join(strings.Fields(desc), " ")
			if desc == "" {
				desc = "Imported Statement Entry"
			}
		}

		safeRawLine := maskAccountNumbers(line)
		inst := inferInstrument(safeRawLine, defMethod)
		cat := inferCategory(desc)

		routed := paycycle.RouteTransactionToPaycycle(paycycle.RouteTxRequest{
			TxDateIso:      dateIso,
			InstrumentType: inst,
			AnchorDay:      anchor,
			Rules:          req.CutoffRules,
		})

		targetM := routed.TargetPeriodMonth
		targetY := routed.TargetPeriodYear
		targetCode := routed.TargetPeriodCode
		advFromLocked := false
		origPeriodCode := ""

		isBeforeEarliest := req.EarliestOpenYear > 0 && req.EarliestOpenMonth > 0 &&
			(targetY*12+targetM < req.EarliestOpenYear*12+req.EarliestOpenMonth)
		isBeforeOrAtMaxLocked := maxLockedSerial > 0 && (targetY*12+targetM <= maxLockedSerial)
		if lockedMap[targetCode] || isBeforeEarliest || isBeforeOrAtMaxLocked {
			origPeriodCode = targetCode
			advFromLocked = true
			if isBeforeEarliest && !(maxLockedSerial > 0 && (req.EarliestOpenYear*12+req.EarliestOpenMonth <= maxLockedSerial)) {
				targetM = req.EarliestOpenMonth
				targetY = req.EarliestOpenYear
			}
			for steps := 0; steps < 24 && (lockedMap[fmt.Sprintf("%02d/%d", targetM, targetY)] || (maxLockedSerial > 0 && (targetY*12+targetM <= maxLockedSerial))); steps++ {
				targetM++
				if targetM > 12 {
					targetM = 1
					targetY++
				}
			}
			targetCode = fmt.Sprintf("%02d/%d", targetM, targetY)
		}

		dupStatus := "NEW_ENTRY"
		matchedID := 0
		matchedLabel := ""
		for _, ex := range req.ExistingItems {
			sameAmt := ex.AmountRp == amountRp
			sameDate := len(ex.DateIso) >= 10 && ex.DateIso[:10] == dateIso
			if sameAmt && strings.Contains(strings.ToLower(ex.Label), strings.ToLower(desc)) {
				dupStatus = "EXACT_MATCH"
				matchedID = ex.ID
				matchedLabel = ex.Label
				break
			}
			if sameAmt && sameDate {
				dupStatus = "AMOUNT_DATE_MATCH"
				matchedID = ex.ID
				matchedLabel = ex.Label
				break
			}
		}

		if dupStatus == "NEW_ENTRY" {
			newCount++
		} else {
			dupCount++
		}
		totalAmt += amountRp

		rows = append(rows, ParsedRow{
			LineNumber:         idx + 1,
			RawLine:            safeRawLine,
			DateIso:            dateIso,
			Description:        desc,
			AmountRp:           amountRp,
			Instrument:         inst,
			InferredCategory:   cat,
			TargetPeriodMonth:  targetM,
			TargetPeriodYear:   targetY,
			TargetPeriodCode:   targetCode,
			OriginalPeriodCode: origPeriodCode,
			AdvancedFromLocked: advFromLocked,
			CrossedCutoff:      routed.CrossedCutoff,
			DuplicateStatus:    dupStatus,
			MatchedItemID:      matchedID,
			MatchedItemLabel:   matchedLabel,
		})
	}

	return ParseResult{
		TotalLines:         len(lines),
		ParsedCount:        len(rows),
		NewEntryCount:      newCount,
		DuplicateCount:     dupCount,
		SkippedCreditCount: skippedCreditCount,
		TotalAmountRp:      totalAmt,
		Rows:               rows,
	}
}
