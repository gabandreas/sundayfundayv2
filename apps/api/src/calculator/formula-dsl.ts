function goRound(v: number): number {
  return v < 0 ? -Math.round(-v) : Math.round(v);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function daysInMonthCalendarUtc(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addHybridMonths(
  m: number,
  y: number,
  offset: number,
): { month: number; year: number } {
  const total = y * 12 + (m - 1) + offset;
  const newY = Math.floor(total / 12);
  const newM = ((total % 12) + 12) % 12;
  return { month: newM + 1, year: newY };
}

export const RESERVED_WORDS_CATALOG = new Set<string>([
  'BASE_SALARY',
  'WORK_DAYS',
  'DAILY_ALLOWANCE',
  'TRANSPORT_ALLOWANCE',
  'FIXED_ADDITIONS',
  'GROSS_PAY',
  'TAX_AND_BPJS',
  'NET_SALARY',
  'TENURE_MONTHS',
  'THR_MULTIPLIER',
  'THR_AMOUNT',
  'NET_INCOME',
  'PAYLATER_DEBT',
  'CC_DEBT',
  'SPINJAM_DEBT',
  'OTHER_DEBT',
  'TOTAL_DEBT',
  'ROUTINE_BILLS',
  'LIVING_BUDGET',
  'P1_FLOOR',
  'P1_SAVINGS',
  'P2_REWARD',
  'ELAPSED_DAYS',
  'CYCLE_DAYS',
  'REMAINING_DAYS',
  'WEEKEND_WEIGHT',
  'WORK_DAYS_PER_WEEK',
  'WORK_HOURS_PER_DAY',
  'COMMUTE_HOURS_PER_DAY',
  'OPTIMAL_DSR_PCT',
  'MAX_SAFE_DSR_PCT',
  'DAYS_IN_MONTH',
  'TX_DAY',
  'TX_MONTH',
  'TX_YEAR',
  'IS_LEAP_YEAR',
  'DUE_DAY',
  'PAYDAY_DAY',
]);

export interface FormulaEvalResult {
  expression: string;
  valid: boolean;
  valueRp: number;
  valueFloat: number;
  usedTokens: string[];
  error?: string;
}

export interface FormulaSuiteRequest {
  variables: Record<string, number>;
  formulas: Record<string, string>;
}

export interface FormulaSuiteResult {
  allValid: boolean;
  results: Record<string, FormulaEvalResult>;
}

interface DslToken {
  kind:
    | 'EOF'
    | 'NUM'
    | 'VAR'
    | 'IDENT'
    | 'PLUS'
    | 'MINUS'
    | 'MUL'
    | 'DIV'
    | 'LPAREN'
    | 'RPAREN'
    | 'COMMA'
    | 'GT'
    | 'LT'
    | 'GTE'
    | 'LTE'
    | 'EQ'
    | 'NEQ';
  text: string;
  num?: number;
}

function tokenizeDsl(expr: string): DslToken[] {
  const out: DslToken[] = [];
  let i = 0;
  const n = expr.length;
  while (i < n) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '+') {
      out.push({ kind: 'PLUS', text: '+' });
      i++;
    } else if (ch === '-') {
      out.push({ kind: 'MINUS', text: '-' });
      i++;
    } else if (ch === '*') {
      out.push({ kind: 'MUL', text: '*' });
      i++;
    } else if (ch === '/') {
      out.push({ kind: 'DIV', text: '/' });
      i++;
    } else if (ch === '(') {
      out.push({ kind: 'LPAREN', text: '(' });
      i++;
    } else if (ch === ')') {
      out.push({ kind: 'RPAREN', text: ')' });
      i++;
    } else if (ch === ',') {
      out.push({ kind: 'COMMA', text: ',' });
      i++;
    } else if (ch === '>') {
      if (i + 1 < n && expr[i + 1] === '=') {
        out.push({ kind: 'GTE', text: '>=' });
        i += 2;
      } else {
        out.push({ kind: 'GT', text: '>' });
        i++;
      }
    } else if (ch === '<') {
      if (i + 1 < n && expr[i + 1] === '=') {
        out.push({ kind: 'LTE', text: '<=' });
        i += 2;
      } else {
        out.push({ kind: 'LT', text: '<' });
        i++;
      }
    } else if (ch === '=') {
      if (i + 1 < n && expr[i + 1] === '=') {
        out.push({ kind: 'EQ', text: '==' });
        i += 2;
      } else {
        throw new Error(`unexpected '=' at position ${i} (use '==')`);
      }
    } else if (ch === '!') {
      if (i + 1 < n && expr[i + 1] === '=') {
        out.push({ kind: 'NEQ', text: '!=' });
        i += 2;
      } else {
        throw new Error(`unexpected '!' at position ${i}`);
      }
    } else if (ch === '{') {
      const end = expr.indexOf('}', i);
      if (end <= i + 1) {
        throw new Error(`unterminated or empty token at position ${i}`);
      }
      const varName = expr.slice(i + 1, end).trim().toUpperCase();
      out.push({ kind: 'VAR', text: varName });
      i = end + 1;
    } else if (/[0-9.]/.test(ch)) {
      const start = i;
      let seenDot = false;
      while (i < n && /[0-9.]/.test(expr[i])) {
        if (expr[i] === '.') {
          if (seenDot) throw new Error(`invalid number literal near position ${start}`);
          seenDot = true;
        }
        i++;
      }
      const val = Number(expr.slice(start, i));
      if (!Number.isFinite(val)) {
        throw new Error(`invalid number '${expr.slice(start, i)}'`);
      }
      out.push({ kind: 'NUM', text: expr.slice(start, i), num: val });
    } else if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      while (i < n && /[a-zA-Z0-9_]/.test(expr[i])) i++;
      out.push({ kind: 'IDENT', text: expr.slice(start, i).toUpperCase() });
    } else {
      throw new Error(`unexpected character '${ch}' at position ${i}`);
    }
  }
  out.push({ kind: 'EOF', text: '' });
  return out;
}

function evalDslFunc(name: string, args: number[]): number {
  switch (name) {
    case 'ROUND':
      if (args.length === 1) return goRound(args[0]);
      if (args.length === 2) {
        const scale = Math.pow(10, args[1]);
        return goRound(args[0] * scale) / scale;
      }
      throw new Error('ROUND expects 1 or 2 arguments');
    case 'FLOOR':
      if (args.length !== 1) throw new Error('FLOOR expects 1 argument');
      return Math.floor(args[0]);
    case 'CEIL':
      if (args.length !== 1) throw new Error('CEIL expects 1 argument');
      return Math.ceil(args[0]);
    case 'MIN':
      if (args.length < 1) throw new Error('MIN expects at least 1 argument');
      return Math.min(...args);
    case 'MAX':
      if (args.length < 1) throw new Error('MAX expects at least 1 argument');
      return Math.max(...args);
    case 'CLAMP':
      if (args.length !== 3) throw new Error('CLAMP(x, min, max) expects 3 arguments');
      return Math.max(args[1], Math.min(args[2], args[0]));
    case 'IF':
      if (args.length !== 3) throw new Error('IF(cond, thenVal, elseVal) expects 3 arguments');
      return args[0] !== 0 ? args[1] : args[2];
    case 'PCT':
      if (args.length !== 2) throw new Error('PCT(base, pct) expects 2 arguments');
      return args[0] * (args[1] / 100.0);
    default:
      throw new Error(`unsupported function '${name}'`);
  }
}

export function evaluateFormulaDslTs(
  expr: string,
  vars: Record<string, number>,
): FormulaEvalResult {
  const trimmed = (expr || '').trim();
  if (!trimmed) {
    return {
      expression: expr,
      valid: false,
      valueRp: 0,
      valueFloat: 0,
      usedTokens: [],
      error: 'formula expression cannot be empty',
    };
  }
  try {
    const tokens = tokenizeDsl(trimmed);
    const normVars: Record<string, number> = {};
    for (const [k, v] of Object.entries(vars ?? {})) {
      normVars[k.trim().toUpperCase()] = Number(v) || 0;
    }
    const used = new Set<string>();
    let pos = 0;
    const peek = (): DslToken => tokens[pos] ?? { kind: 'EOF', text: '' };
    const next = (): DslToken => tokens[pos++] ?? { kind: 'EOF', text: '' };

    const parsePrimary = (): number => {
      const t = next();
      if (t.kind === 'NUM') return t.num ?? 0;
      if (t.kind === 'VAR') {
        if (!RESERVED_WORDS_CATALOG.has(t.text) && !(t.text in normVars)) {
          throw new Error(`unknown reserved word {${t.text}}`);
        }
        used.add(t.text);
        return normVars[t.text] ?? 0;
      }
      if (t.kind === 'IDENT') {
        if (peek().kind !== 'LPAREN') {
          if (RESERVED_WORDS_CATALOG.has(t.text) || t.text in normVars) {
            used.add(t.text);
            return normVars[t.text] ?? 0;
          }
          throw new Error(`unexpected identifier '${t.text}' (wrap reserved words in {...})`);
        }
        next();
        const args: number[] = [];
        if (peek().kind !== 'RPAREN') {
          while (true) {
            args.push(parseComparison());
            if (peek().kind === 'COMMA') {
              next();
              continue;
            }
            break;
          }
        }
        if (next().kind !== 'RPAREN') {
          throw new Error(`missing closing ')' after ${t.text}(`);
        }
        return evalDslFunc(t.text, args);
      }
      if (t.kind === 'LPAREN') {
        const v = parseComparison();
        if (next().kind !== 'RPAREN') throw new Error("missing closing ')'");
        return v;
      }
      throw new Error(`unexpected token '${t.text}'`);
    };

    const parseUnary = (): number => {
      const k = peek().kind;
      if (k === 'PLUS') {
        next();
        return parseUnary();
      }
      if (k === 'MINUS') {
        next();
        return -parseUnary();
      }
      return parsePrimary();
    };

    const parseMulDiv = (): number => {
      let left = parseUnary();
      while (true) {
        const k = peek().kind;
        if (k === 'MUL') {
          next();
          left *= parseUnary();
        } else if (k === 'DIV') {
          next();
          const right = parseUnary();
          if (right === 0) throw new Error('division by zero');
          left /= right;
        } else {
          return left;
        }
      }
    };

    const parseAddSub = (): number => {
      let left = parseMulDiv();
      while (true) {
        const k = peek().kind;
        if (k === 'PLUS') {
          next();
          left += parseMulDiv();
        } else if (k === 'MINUS') {
          next();
          left -= parseMulDiv();
        } else {
          return left;
        }
      }
    };

    const parseComparison = (): number => {
      let left = parseAddSub();
      while (true) {
        const k = peek().kind;
        if (
          k === 'GT' ||
          k === 'LT' ||
          k === 'GTE' ||
          k === 'LTE' ||
          k === 'EQ' ||
          k === 'NEQ'
        ) {
          next();
          const right = parseAddSub();
          let ok = false;
          if (k === 'GT') ok = left > right;
          else if (k === 'LT') ok = left < right;
          else if (k === 'GTE') ok = left >= right;
          else if (k === 'LTE') ok = left <= right;
          else if (k === 'EQ') ok = Math.abs(left - right) < 1e-9;
          else ok = Math.abs(left - right) >= 1e-9;
          left = ok ? 1 : 0;
        } else {
          return left;
        }
      }
    };

    const val = parseComparison();
    if (peek().kind !== 'EOF') {
      throw new Error(`unexpected trailing token '${peek().text}'`);
    }
    if (!Number.isFinite(val)) {
      throw new Error('result is undefined');
    }
    return {
      expression: expr,
      valid: true,
      valueRp: goRound(val),
      valueFloat: round2(val),
      usedTokens: Array.from(used).sort(),
    };
  } catch (err: any) {
    return {
      expression: expr,
      valid: false,
      valueRp: 0,
      valueFloat: 0,
      usedTokens: [],
      error: err?.message || 'invalid formula expression',
    };
  }
}

export function evaluateFormulaSuiteTs(req: FormulaSuiteRequest): FormulaSuiteResult {
  const results: Record<string, FormulaEvalResult> = {};
  let allValid = true;
  for (const [k, expr] of Object.entries(req.formulas ?? {})) {
    const r = evaluateFormulaDslTs(expr, req.variables ?? {});
    if (!r.valid) allValid = false;
    results[k] = r;
  }
  return { allValid, results };
}

/**
 * Evaluates a modular instrument cutoff expression (e.g. "DAYS_IN_MONTH - 15")
 * and clamps the closing day into [1, daysInMonth(month, year)] so Feb 28/29 never overflows.
 */
export function resolveCutoffDayForMonthTs(
  formulaExpr: string | undefined,
  fallbackDay: number,
  txDay: number,
  month: number,
  year: number,
  dueDay: number,
  paydayDay: number = 27,
): { cutoffDay: number; valid: boolean; error?: string } {
  const dim = daysInMonthCalendarUtc(month, year);
  const clampedFallback = Math.max(1, Math.min(dim, Math.round(fallbackDay || 1)));
  const trimmed = (formulaExpr ?? '').trim();
  if (!trimmed) {
    return { cutoffDay: clampedFallback, valid: true };
  }
  const isLeap = daysInMonthCalendarUtc(2, year) === 29 ? 1 : 0;
  const res = evaluateFormulaDslTs(trimmed, {
    DAYS_IN_MONTH: dim,
    TX_DAY: txDay,
    TX_MONTH: month,
    TX_YEAR: year,
    IS_LEAP_YEAR: isLeap,
    DUE_DAY: dueDay,
    PAYDAY_DAY: paydayDay > 0 ? paydayDay : 27,
  });
  if (!res.valid) {
    return { cutoffDay: clampedFallback, valid: false, error: res.error };
  }
  const day = Math.max(1, Math.min(dim, res.valueRp));
  return { cutoffDay: day, valid: true };
}
