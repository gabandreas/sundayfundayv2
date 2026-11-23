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
	RawText           string                        `json:"rawText"`
	DefaultMethod     string                        `json:"defaultMethod"` // CASH | PAYLATER | CREDIT_CARD
	AnchorDay         int                           `json:"anchorDay"`
	CutoffRules       []paycycle.InstrumentCutoffRule `json:"cutoffRules,omitempty"`
	ExistingItems     []ExistingLedgerItem          `json:"existingItems,omitempty"`
	DefaultYear       int                           `json:"defaultYear"`
	LockedPeriodCodes []string                      `json:"lockedPeriodCodes,omitempty"`
	EarliestOpenMonth int                           `json:"earliestOpenMonth,omitempty"`
	EarliestOpenYear  int                           `json:"earliestOpenYear,omitempty"`
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
	TotalLines     int         `json:"totalLines"`
	ParsedCount    int         `json:"parsedCount"`
	NewEntryCount  int         `json:"newEntryCount"`
	DuplicateCount int         `json:"duplicateCount"`
	TotalAmountRp  int64       `json:"totalAmountRp"`
	Rows           []ParsedRow `json:"rows"`
}

var (
	isoDateRx   = regexp.MustCompile(`\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b`)
	dmyDateRx   = regexp.MustCompile(`\b(\d{1,2})[-/](\d{1,2})(?:[-/](20\d{2}))?\b`)
	amountRx    = regexp.MustCompile(`(?:Rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{4,9})\b`)
	rpPrefixRx  = regexp.MustCompile(`(?i)\brp\.?\s*[\d.,]+`)
)

func parseAmountRp(token string) int64 {
	clean := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, token)
	if clean == "" {
		return 0
	}
	v, err := strconv.ParseInt(clean, 10, 64)
	if err != nil {
		return 0
	}
	return v
}

func inferInstrument(line, defaultInst string) string {
	lower := strings.ToLower(line)
	switch {
	case strings.Contains(lower, "spaylater") || strings.Contains(lower, "paylater") || strings.Contains(lower, "bnpl"):
		return "PAYLATER"
	case strings.Contains(lower, "permata") || strings.Contains(lower, "credit card") || strings.Contains(lower, "kartu kredit") || strings.Contains(lower, " cc "):
		return "CREDIT_CARD"
	case strings.Contains(lower, "spinjam"):
		return "CASH_LOAN"
	case strings.Contains(lower, "qris") || strings.Contains(lower, "bca") || strings.Contains(lower, "cash") || strings.Contains(lower, "transfer"):
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

	lines := strings.Split(req.RawText, "\n")
	rows := make([]ParsedRow, 0, len(lines))
	var totalAmt int64
	var newCount, dupCount int

	for idx, raw := range lines {
		line := strings.TrimSpace(raw)
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(strings.ToLower(line), "date,") || strings.HasPrefix(strings.ToLower(line), "tanggal") {
			continue
		}

		// Extract date
		dateIso := time.Now().Format("2006-01-02")
		dateMatchStr := ""
		if m := isoDateRx.FindStringSubmatch(line); len(m) == 4 {
			yr, _ := strconv.Atoi(m[1])
			mo, _ := strconv.Atoi(m[2])
			dy, _ := strconv.Atoi(m[3])
			dateIso = fmt.Sprintf("%04d-%02d-%02d", yr, mo, dy)
			dateMatchStr = m[0]
		} else if m := dmyDateRx.FindStringSubmatch(line); len(m) >= 3 {
			dy, _ := strconv.Atoi(m[1])
			mo, _ := strconv.Atoi(m[2])
			yr := defYear
			if len(m) == 4 && m[3] != "" {
				yr, _ = strconv.Atoi(m[3])
			}
			if mo >= 1 && mo <= 12 && dy >= 1 && dy <= 31 {
				dateIso = fmt.Sprintf("%04d-%02d-%02d", yr, mo, dy)
				dateMatchStr = m[0]
			}
		}

		// Extract amount (prefer last numeric money match)
		cleanedForAmount := line
		if dateMatchStr != "" {
			cleanedForAmount = strings.Replace(cleanedForAmount, dateMatchStr, " ", 1)
		}
		amtMatches := amountRx.FindAllStringSubmatch(cleanedForAmount, -1)
		var amountRp int64
		amtToken := ""
		if len(amtMatches) > 0 {
			last := amtMatches[len(amtMatches)-1]
			amountRp = parseAmountRp(last[1])
			amtToken = last[0]
		}
		if amountRp <= 0 {
			continue
		}

		// Extract description by stripping CSV delimiters, date, amount, and instrument keywords
		desc := cleanedForAmount
		if amtToken != "" {
			desc = rpPrefixRx.ReplaceAllString(desc, " ")
			desc = strings.Replace(desc, amtToken, " ", 1)
		}
		desc = strings.NewReplacer(",", " ", ";", " ", "|", " ", "\t", " ").Replace(desc)
		desc = strings.Join(strings.Fields(desc), " ")
		if desc == "" {
			desc = "Imported Statement Entry"
		}

		inst := inferInstrument(line, defMethod)
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
			RawLine:            line,
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
		TotalLines:     len(lines),
		ParsedCount:    len(rows),
		NewEntryCount:  newCount,
		DuplicateCount: dupCount,
		TotalAmountRp:  totalAmt,
		Rows:           rows,
	}
}
