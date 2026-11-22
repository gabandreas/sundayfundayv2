package formula

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"unicode"
)

var ReservedWordsCatalog = map[string]bool{
	"BASE_SALARY":          true,
	"WORK_DAYS":            true,
	"DAILY_ALLOWANCE":      true,
	"TRANSPORT_ALLOWANCE":  true,
	"FIXED_ADDITIONS":      true,
	"GROSS_PAY":            true,
	"TAX_AND_BPJS":         true,
	"NET_SALARY":           true,
	"TENURE_MONTHS":        true,
	"THR_MULTIPLIER":       true,
	"THR_AMOUNT":           true,
	"NET_INCOME":           true,
	"PAYLATER_DEBT":        true,
	"CC_DEBT":              true,
	"SPINJAM_DEBT":         true,
	"OTHER_DEBT":           true,
	"TOTAL_DEBT":           true,
	"ROUTINE_BILLS":        true,
	"LIVING_BUDGET":        true,
	"P1_FLOOR":             true,
	"P1_SAVINGS":           true,
	"P2_REWARD":            true,
	"ELAPSED_DAYS":         true,
	"CYCLE_DAYS":           true,
	"REMAINING_DAYS":       true,
	"WEEKEND_WEIGHT":       true,
	"WORK_DAYS_PER_WEEK":   true,
	"WORK_HOURS_PER_DAY":   true,
	"COMMUTE_HOURS_PER_DAY": true,
	"OPTIMAL_DSR_PCT":      true,
	"MAX_SAFE_DSR_PCT":     true,
}

type FormulaEvalResult struct {
	Expression string   `json:"expression"`
	Valid      bool     `json:"valid"`
	ValueRp    int64    `json:"valueRp"`
	ValueFloat float64  `json:"valueFloat"`
	UsedTokens []string `json:"usedTokens"`
	Error      string   `json:"error,omitempty"`
}

type FormulaSuiteRequest struct {
	Variables map[string]float64 `json:"variables"`
	Formulas  map[string]string  `json:"formulas"`
}

type FormulaSuiteResult struct {
	AllValid bool                         `json:"allValid"`
	Results  map[string]FormulaEvalResult `json:"results"`
}

type tokenKind int

const (
	tokEOF tokenKind = iota
	tokNumber
	tokVar
	tokIdent
	tokPlus
	tokMinus
	tokMul
	tokDiv
	tokLParen
	tokRParen
	tokComma
	tokGt
	tokLt
	tokGte
	tokLte
	tokEq
	tokNeq
)

type token struct {
	kind tokenKind
	text string
	num  float64
}

func tokenize(expr string) ([]token, error) {
	var out []token
	i := 0
	n := len(expr)
	for i < n {
		r := rune(expr[i])
		if unicode.IsSpace(r) {
			i++
			continue
		}
		switch expr[i] {
		case '+':
			out = append(out, token{kind: tokPlus, text: "+"})
			i++
		case '-':
			out = append(out, token{kind: tokMinus, text: "-"})
			i++
		case '*':
			out = append(out, token{kind: tokMul, text: "*"})
			i++
		case '/':
			out = append(out, token{kind: tokDiv, text: "/"})
			i++
		case '(':
			out = append(out, token{kind: tokLParen, text: "("})
			i++
		case ')':
			out = append(out, token{kind: tokRParen, text: ")"})
			i++
		case ',':
			out = append(out, token{kind: tokComma, text: ","})
			i++
		case '>':
			if i+1 < n && expr[i+1] == '=' {
				out = append(out, token{kind: tokGte, text: ">="})
				i += 2
			} else {
				out = append(out, token{kind: tokGt, text: ">"})
				i++
			}
		case '<':
			if i+1 < n && expr[i+1] == '=' {
				out = append(out, token{kind: tokLte, text: "<="})
				i += 2
			} else {
				out = append(out, token{kind: tokLt, text: "<"})
				i++
			}
		case '=':
			if i+1 < n && expr[i+1] == '=' {
				out = append(out, token{kind: tokEq, text: "=="})
				i += 2
			} else {
				return nil, fmt.Errorf("unexpected '=' at position %d (use '==')", i)
			}
		case '!':
			if i+1 < n && expr[i+1] == '=' {
				out = append(out, token{kind: tokNeq, text: "!="})
				i += 2
			} else {
				return nil, fmt.Errorf("unexpected '!' at position %d", i)
			}
		case '{':
			end := strings.IndexByte(expr[i:], '}')
			if end <= 1 {
				return nil, fmt.Errorf("unterminated or empty token at position %d", i)
			}
			varName := strings.TrimSpace(expr[i+1 : i+end])
			out = append(out, token{kind: tokVar, text: strings.ToUpper(varName)})
			i += end + 1
		default:
			if unicode.IsDigit(r) || expr[i] == '.' {
				start := i
				seenDot := false
				for i < n && (unicode.IsDigit(rune(expr[i])) || expr[i] == '.') {
					if expr[i] == '.' {
						if seenDot {
							return nil, fmt.Errorf("invalid number literal near position %d", start)
						}
						seenDot = true
					}
					i++
				}
				val, err := strconv.ParseFloat(expr[start:i], 64)
				if err != nil {
					return nil, fmt.Errorf("invalid number '%s'", expr[start:i])
				}
				out = append(out, token{kind: tokNumber, text: expr[start:i], num: val})
			} else if unicode.IsLetter(r) || expr[i] == '_' {
				start := i
				for i < n && (unicode.IsLetter(rune(expr[i])) || unicode.IsDigit(rune(expr[i])) || expr[i] == '_') {
					i++
				}
				out = append(out, token{kind: tokIdent, text: strings.ToUpper(expr[start:i])})
			} else {
				return nil, fmt.Errorf("unexpected character '%c' at position %d", expr[i], i)
			}
		}
	}
	out = append(out, token{kind: tokEOF})
	return out, nil
}

type parser struct {
	tokens     []token
	pos        int
	vars       map[string]float64
	usedTokens map[string]bool
}

func (p *parser) peek() token {
	if p.pos >= len(p.tokens) {
		return token{kind: tokEOF}
	}
	return p.tokens[p.pos]
}

func (p *parser) next() token {
	t := p.peek()
	if p.pos < len(p.tokens) {
		p.pos++
	}
	return t
}

func (p *parser) parseComparison() (float64, error) {
	left, err := p.parseAddSub()
	if err != nil {
		return 0, err
	}
	for {
		t := p.peek()
		switch t.kind {
		case tokGt, tokLt, tokGte, tokLte, tokEq, tokNeq:
			p.next()
			right, err := p.parseAddSub()
			if err != nil {
				return 0, err
			}
			var ok bool
			switch t.kind {
			case tokGt:
				ok = left > right
			case tokLt:
				ok = left < right
			case tokGte:
				ok = left >= right
			case tokLte:
				ok = left <= right
			case tokEq:
				ok = math.Abs(left-right) < 1e-9
			case tokNeq:
				ok = math.Abs(left-right) >= 1e-9
			}
			if ok {
				left = 1
			} else {
				left = 0
			}
		default:
			return left, nil
		}
	}
}

func (p *parser) parseAddSub() (float64, error) {
	left, err := p.parseMulDiv()
	if err != nil {
		return 0, err
	}
	for {
		t := p.peek()
		if t.kind == tokPlus {
			p.next()
			right, err := p.parseMulDiv()
			if err != nil {
				return 0, err
			}
			left += right
		} else if t.kind == tokMinus {
			p.next()
			right, err := p.parseMulDiv()
			if err != nil {
				return 0, err
			}
			left -= right
		} else {
			return left, nil
		}
	}
}

func (p *parser) parseMulDiv() (float64, error) {
	left, err := p.parseUnary()
	if err != nil {
		return 0, err
	}
	for {
		t := p.peek()
		if t.kind == tokMul {
			p.next()
			right, err := p.parseUnary()
			if err != nil {
				return 0, err
			}
			left *= right
		} else if t.kind == tokDiv {
			p.next()
			right, err := p.parseUnary()
			if err != nil {
				return 0, err
			}
			if right == 0 {
				return 0, fmt.Errorf("division by zero")
			}
			left /= right
		} else {
			return left, nil
		}
	}
}

func (p *parser) parseUnary() (float64, error) {
	t := p.peek()
	if t.kind == tokPlus {
		p.next()
		return p.parseUnary()
	}
	if t.kind == tokMinus {
		p.next()
		v, err := p.parseUnary()
		return -v, err
	}
	return p.parsePrimary()
}

func (p *parser) parsePrimary() (float64, error) {
	t := p.next()
	switch t.kind {
	case tokNumber:
		return t.num, nil
	case tokVar:
		if !ReservedWordsCatalog[t.text] {
			if _, ok := p.vars[t.text]; !ok {
				return 0, fmt.Errorf("unknown reserved word {%s}", t.text)
			}
		}
		p.usedTokens[t.text] = true
		return p.vars[t.text], nil
	case tokIdent:
		if p.peek().kind != tokLParen {
			return 0, fmt.Errorf("unexpected identifier '%s' (wrap reserved words in {...})", t.text)
		}
		p.next() // '('
		var args []float64
		if p.peek().kind != tokRParen {
			for {
				v, err := p.parseComparison()
				if err != nil {
					return 0, err
				}
				args = append(args, v)
				if p.peek().kind == tokComma {
					p.next()
					continue
				}
				break
			}
		}
		if p.next().kind != tokRParen {
			return 0, fmt.Errorf("missing closing ')' after %s(", t.text)
		}
		return evalFunction(t.text, args)
	case tokLParen:
		v, err := p.parseComparison()
		if err != nil {
			return 0, err
		}
		if p.next().kind != tokRParen {
			return 0, fmt.Errorf("missing closing ')'")
		}
		return v, nil
	default:
		return 0, fmt.Errorf("unexpected token '%s'", t.text)
	}
}

func evalFunction(name string, args []float64) (float64, error) {
	switch name {
	case "ROUND":
		if len(args) == 1 {
			return math.Round(args[0]), nil
		}
		if len(args) == 2 {
			scale := math.Pow(10, args[1])
			return math.Round(args[0]*scale) / scale, nil
		}
		return 0, fmt.Errorf("ROUND expects 1 or 2 arguments")
	case "FLOOR":
		if len(args) != 1 {
			return 0, fmt.Errorf("FLOOR expects 1 argument")
		}
		return math.Floor(args[0]), nil
	case "CEIL":
		if len(args) != 1 {
			return 0, fmt.Errorf("CEIL expects 1 argument")
		}
		return math.Ceil(args[0]), nil
	case "MIN":
		if len(args) < 1 {
			return 0, fmt.Errorf("MIN expects at least 1 argument")
		}
		best := args[0]
		for _, a := range args[1:] {
			if a < best {
				best = a
			}
		}
		return best, nil
	case "MAX":
		if len(args) < 1 {
			return 0, fmt.Errorf("MAX expects at least 1 argument")
		}
		best := args[0]
		for _, a := range args[1:] {
			if a > best {
				best = a
			}
		}
		return best, nil
	case "CLAMP":
		if len(args) != 3 {
			return 0, fmt.Errorf("CLAMP(x, min, max) expects 3 arguments")
		}
		v, lo, hi := args[0], args[1], args[2]
		if v < lo {
			return lo, nil
		}
		if v > hi {
			return hi, nil
		}
		return v, nil
	case "IF":
		if len(args) != 3 {
			return 0, fmt.Errorf("IF(cond, thenVal, elseVal) expects 3 arguments")
		}
		if args[0] != 0 {
			return args[1], nil
		}
		return args[2], nil
	case "PCT":
		if len(args) != 2 {
			return 0, fmt.Errorf("PCT(base, pct) expects 2 arguments")
		}
		return args[0] * (args[1] / 100.0), nil
	default:
		return 0, fmt.Errorf("unsupported function '%s'", name)
	}
}

func EvaluateFormula(expr string, vars map[string]float64) FormulaEvalResult {
	trimmed := strings.TrimSpace(expr)
	if trimmed == "" {
		return FormulaEvalResult{
			Expression: expr,
			Valid:      false,
			UsedTokens: []string{},
			Error:      "formula expression cannot be empty",
		}
	}
	tokens, err := tokenize(trimmed)
	if err != nil {
		return FormulaEvalResult{
			Expression: expr,
			Valid:      false,
			UsedTokens: []string{},
			Error:      err.Error(),
		}
	}
	normalizedVars := make(map[string]float64, len(vars))
	for k, v := range vars {
		normalizedVars[strings.ToUpper(strings.TrimSpace(k))] = v
	}
	p := &parser{
		tokens:     tokens,
		pos:        0,
		vars:       normalizedVars,
		usedTokens: map[string]bool{},
	}
	val, err := p.parseComparison()
	if err != nil {
		return FormulaEvalResult{
			Expression: expr,
			Valid:      false,
			UsedTokens: []string{},
			Error:      err.Error(),
		}
	}
	if p.peek().kind != tokEOF {
		return FormulaEvalResult{
			Expression: expr,
			Valid:      false,
			UsedTokens: []string{},
			Error:      fmt.Sprintf("unexpected trailing token '%s'", p.peek().text),
		}
	}
	if math.IsNaN(val) || math.IsInf(val, 0) {
		return FormulaEvalResult{
			Expression: expr,
			Valid:      false,
			UsedTokens: []string{},
			Error:      "result is undefined",
		}
	}
	used := make([]string, 0, len(p.usedTokens))
	for k := range p.usedTokens {
		used = append(used, k)
	}
	sort.Strings(used)
	roundedFloat := math.Round(val*100) / 100
	return FormulaEvalResult{
		Expression: expr,
		Valid:      true,
		ValueRp:    int64(math.Round(val)),
		ValueFloat: roundedFloat,
		UsedTokens: used,
	}
}

func EvaluateFormulaSuite(req FormulaSuiteRequest) FormulaSuiteResult {
	results := make(map[string]FormulaEvalResult, len(req.Formulas))
	allValid := true
	for k, expr := range req.Formulas {
		res := EvaluateFormula(expr, req.Variables)
		if !res.Valid {
			allValid = false
		}
		results[k] = res
	}
	return FormulaSuiteResult{
		AllValid: allValid,
		Results:  results,
	}
}
