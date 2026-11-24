let _isAmountsMasked = true;

export function setGlobalAmountsMasked(val: boolean) {
  _isAmountsMasked = val;
}

export function getGlobalAmountsMasked(): boolean {
  return _isAmountsMasked;
}

/**
 * Formats user typed input with live thousand dots.
 * Example: "1500000" -> "1.500.000"
 */
export function formatCurrencyInput(val: string | number): string {
  const digits = String(val).replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Parses user typed currency input string to a clean integer.
 * Example: "1.500.000" -> 1500000
 */
export function parseCurrencyInput(val: string | number): number {
  const digits = String(val).replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

/**
 * Formats a numeric amount to Indonesian Rupiah currency string.
 * When amounts are masked (privacy mode default), returns compact "Rp •••••" or "-Rp •••••".
 * Example: 18500000 -> "Rp 18.500.000", -45000 -> "-Rp 45.000"
 */
export function formatRupiah(amount: number | null | undefined, forceMasked?: boolean): string {
  const isMasked = forceMasked !== undefined ? forceMasked : _isAmountsMasked;
  if (isMasked) {
    if (amount !== null && amount !== undefined && !isNaN(amount) && amount < 0) {
      return "-Rp •••••";
    }
    return "Rp •••••";
  }
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "Rp 0";
  }
  const isNegative = amount < 0;
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return isNegative ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export const DOMAIN_CONSTANTS = {
  ASIA_JAKARTA_TZ: "Asia/Jakarta",
  DEFAULT_PAYOUT_DAY: 25,
  PAYDAY_CYCLE_START_DAY: 27,
  SPAYLATER_CUTOFF_DAY: 15,
  SPAYLATER_DUE_DAY: 25,
  CC_CUTOFF_DAY: 25,
  CC_DUE_DAY: 11,
  PERSONAL_DEBT_DUE_DAY: 8,
  LAUNCH_YEAR: 2026,
  LAUNCH_MONTH: 7,
  NOTIFICATION_EMAIL: "sundayfundayerp@gmail.com",
} as const;

export function getSpaylaterCutoffDay(month: number, year: number): number {
  const daysInM = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.max(1, daysInM - 15);
}

export interface ClientInstrumentRuleLike {
  type?: string;
  cutoffDay?: number;
  cutoffFormula?: string;
  cutoffBoundaryInclusive?: boolean;
  preCutoffOffsetMonths?: number;
  postCutoffOffsetMonths?: number;
  dueDay?: number;
  active?: boolean;
}

function addMonthsClient(month: number, year: number, offset: number): { month: number; year: number } {
  const total = year * 12 + (month - 1) + offset;
  return {
    month: (total % 12) + 1,
    year: Math.floor(total / 12),
  };
}

interface CutoffTok {
  kind: "EOF" | "NUM" | "IDENT" | "OP" | "LPAREN" | "RPAREN" | "COMMA";
  text: string;
  num?: number;
}

function tokenizeSafeCutoffExpr(expr: string): CutoffTok[] {
  const out: CutoffTok[] = [];
  let i = 0;
  const n = expr.length;
  while (i < n) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(") {
      out.push({ kind: "LPAREN", text: "(" });
      i++;
    } else if (ch === ")") {
      out.push({ kind: "RPAREN", text: ")" });
      i++;
    } else if (ch === ",") {
      out.push({ kind: "COMMA", text: "," });
      i++;
    } else if (/[<>!]/.test(ch)) {
      if (i + 1 < n && expr[i + 1] === "=") {
        out.push({ kind: "OP", text: ch + "=" });
        i += 2;
      } else if (ch === "!") {
        throw new Error("unexpected !");
      } else {
        out.push({ kind: "OP", text: ch });
        i++;
      }
    } else if (ch === "=" && i + 1 < n && expr[i + 1] === "=") {
      out.push({ kind: "OP", text: "==" });
      i += 2;
    } else if ("+-*/".includes(ch)) {
      out.push({ kind: "OP", text: ch });
      i++;
    } else if (/[0-9.]/.test(ch)) {
      const start = i;
      while (i < n && /[0-9.]/.test(expr[i])) i++;
      const num = Number(expr.slice(start, i));
      if (!Number.isFinite(num)) throw new Error("invalid number");
      out.push({ kind: "NUM", text: expr.slice(start, i), num });
    } else if (/[A-Za-z_]/.test(ch)) {
      const start = i;
      while (i < n && /[A-Za-z0-9_]/.test(expr[i])) i++;
      out.push({ kind: "IDENT", text: expr.slice(start, i).toUpperCase() });
    } else {
      throw new Error(`unexpected char ${ch}`);
    }
  }
  out.push({ kind: "EOF", text: "" });
  return out;
}

function evalSafeCutoffExpression(expr: string): number {
  const tokens = tokenizeSafeCutoffExpr(expr);
  let pos = 0;
  const peek = (): CutoffTok => tokens[pos] ?? { kind: "EOF", text: "" };
  const next = (): CutoffTok => tokens[pos++] ?? { kind: "EOF", text: "" };

  const parsePrimary = (): number => {
    const tok = next();
    if (tok.kind === "NUM") return tok.num ?? 0;
    if (tok.kind === "IDENT") {
      if (next().kind !== "LPAREN") throw new Error(`unexpected ident ${tok.text}`);
      const args: number[] = [];
      if (peek().kind !== "RPAREN") {
        while (true) {
          args.push(parseComparison());
          if (peek().kind === "COMMA") {
            next();
            continue;
          }
          break;
        }
      }
      if (next().kind !== "RPAREN") throw new Error(`missing ) after ${tok.text}`);
      switch (tok.text) {
        case "MIN":
          return Math.min(...args);
        case "MAX":
          return Math.max(...args);
        case "CLAMP":
          return Math.max(args[1] ?? 0, Math.min(args[2] ?? 0, args[0] ?? 0));
        case "FLOOR":
          return Math.floor(args[0] ?? 0);
        case "CEIL":
          return Math.ceil(args[0] ?? 0);
        case "ROUND": {
          const s = Math.pow(10, args[1] ?? 0);
          return Math.round((args[0] ?? 0) * s) / s;
        }
        case "IF":
          return (args[0] ?? 0) !== 0 ? (args[1] ?? 0) : (args[2] ?? 0);
        default:
          throw new Error(`unsupported function ${tok.text}`);
      }
    }
    if (tok.kind === "LPAREN") {
      const val = parseComparison();
      if (next().kind !== "RPAREN") throw new Error("missing )");
      return val;
    }
    throw new Error(`unexpected token ${tok.text}`);
  };

  const parseUnary = (): number => {
    const p = peek();
    if (p.kind === "OP" && p.text === "+") {
      next();
      return parseUnary();
    }
    if (p.kind === "OP" && p.text === "-") {
      next();
      return -parseUnary();
    }
    return parsePrimary();
  };

  const parseMulDiv = (): number => {
    let left = parseUnary();
    while (peek().kind === "OP" && (peek().text === "*" || peek().text === "/")) {
      const op = next().text;
      const right = parseUnary();
      if (op === "*") left *= right;
      else {
        if (right === 0) throw new Error("division by zero");
        left /= right;
      }
    }
    return left;
  };

  const parseAddSub = (): number => {
    let left = parseMulDiv();
    while (peek().kind === "OP" && (peek().text === "+" || peek().text === "-")) {
      const op = next().text;
      const right = parseMulDiv();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  };

  const parseComparison = (): number => {
    let left = parseAddSub();
    while (
      peek().kind === "OP" &&
      ["<", ">", "<=", ">=", "==", "!="].includes(peek().text)
    ) {
      const op = next().text;
      const right = parseAddSub();
      if (op === "<") left = left < right ? 1 : 0;
      else if (op === ">") left = left > right ? 1 : 0;
      else if (op === "<=") left = left <= right ? 1 : 0;
      else if (op === ">=") left = left >= right ? 1 : 0;
      else if (op === "==") left = Math.abs(left - right) < 1e-9 ? 1 : 0;
      else left = Math.abs(left - right) >= 1e-9 ? 1 : 0;
    }
    return left;
  };

  const value = parseComparison();
  if (peek().kind !== "EOF" || !Number.isFinite(value)) {
    throw new Error("invalid expression");
  }
  return value;
}

/**
 * Evaluates a modular instrument cutoff expression client-side (supporting DAYS_IN_MONTH,
 * TX_DAY, TX_MONTH, TX_YEAR, IS_LEAP_YEAR, DUE_DAY, PAYDAY_DAY, MIN, MAX, CLAMP, FLOOR, CEIL, ROUND, IF)
 * using a zero-eval recursive-descent parser and clamps the resulting cutoff day cleanly into
 * [1, daysInMonth(month, year)] for Feb 28/29 safety.
 */
export function resolveInstrumentCutoffDayClient(
  inst: ClientInstrumentRuleLike | undefined,
  month: number,
  year: number,
  txDay: number = 1,
  paydayDay: number = 27,
): number {
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const isLeap = new Date(Date.UTC(year, 2, 0)).getUTCDate() === 29 ? 1 : 0;
  const fallbackRaw =
    inst?.cutoffDay && inst.cutoffDay > 0
      ? inst.cutoffDay
      : inst?.type === "CREDIT_CARD"
        ? 25
        : Math.max(1, dim - 15);
  const formula = (inst?.cutoffFormula ?? "").trim();
  if (!formula) {
    if ((inst?.type === "PAYLATER" || !inst) && fallbackRaw === 15) {
      return Math.max(1, dim - 15);
    }
    return Math.max(1, Math.min(dim, fallbackRaw));
  }
  const normalized = formula
    .replace(/\{([A-Z0-9_]+)\}/gi, "$1")
    .replace(/\bDAYS_IN_MONTH\b/gi, String(dim))
    .replace(/\bTX_DAY\b/gi, String(txDay))
    .replace(/\bTX_MONTH\b/gi, String(month))
    .replace(/\bTX_YEAR\b/gi, String(year))
    .replace(/\bIS_LEAP_YEAR\b/gi, String(isLeap))
    .replace(/\bDUE_DAY\b/gi, String(inst?.dueDay ?? 25))
    .replace(/\bPAYDAY_DAY\b/gi, String(paydayDay || 27));
  if (!/^[0-9+\-*/().,<>=!\sMINMAXCLAMPFLOORCEILROUNDIF]+$/i.test(normalized)) {
    return Math.max(1, Math.min(dim, fallbackRaw));
  }
  try {
    const res = evalSafeCutoffExpression(normalized);
    if (!Number.isFinite(res)) return Math.max(1, Math.min(dim, fallbackRaw));
    return Math.max(1, Math.min(dim, Math.round(res)));
  } catch {
    return Math.max(1, Math.min(dim, fallbackRaw));
  }
}

export function resolveInstrumentLandingPeriodClient(
  inst: ClientInstrumentRuleLike | undefined,
  dateIso: string,
  holdPastCutoff: boolean = false,
): {
  cutoffDay: number;
  crossedCutoff: boolean;
  dueDay: number;
  month: number;
  year: number;
  label: string;
} {
  const parts = String(dateIso || "").slice(0, 10).split("-").map(Number);
  const y = parts[0] || 2026;
  const m = parts[1] || 11;
  const d = parts[2] || 15;
  const isCc = inst?.type === "CREDIT_CARD";
  const cutoffDay = resolveInstrumentCutoffDayClient(inst, m, y, d);
  const inclusive =
    typeof inst?.cutoffBoundaryInclusive === "boolean"
      ? inst.cutoffBoundaryInclusive
      : !isCc;
  const crossedCutoff = inclusive ? d >= cutoffDay : d > cutoffDay;
  const preOffset =
    typeof inst?.preCutoffOffsetMonths === "number"
      ? inst.preCutoffOffsetMonths
      : isCc
        ? 1
        : 0;
  const postOffset =
    typeof inst?.postCutoffOffsetMonths === "number"
      ? inst.postCutoffOffsetMonths
      : isCc
        ? 2
        : 1;
  const base = addMonthsClient(m, y, crossedCutoff ? postOffset : preOffset);
  const finalPeriod = holdPastCutoff ? addMonthsClient(base.month, base.year, 1) : base;
  const dueDim = new Date(Date.UTC(finalPeriod.year, finalPeriod.month, 0)).getUTCDate();
  const dueDay = Math.min(dueDim, inst?.dueDay && inst.dueDay > 0 ? inst.dueDay : isCc ? 11 : 25);
  const SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return {
    cutoffDay,
    crossedCutoff: crossedCutoff || holdPastCutoff,
    dueDay,
    month: finalPeriod.month,
    year: finalPeriod.year,
    label: `${SHORT[finalPeriod.month - 1] ?? finalPeriod.month} '${String(finalPeriod.year).slice(-2)}`,
  };
}

const JAKARTA_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: DOMAIN_CONSTANTS.ASIA_JAKARTA_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Extracts year, month (1-12), day (1-31) in Asia/Jakarta (WIB / UTC+7)
 * so client and Vercel UTC SSR agree identically on active cycle and due dates.
 */
export function getJakartaDateParts(refDate: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  isoDate: string;
} {
  const isoDate = JAKARTA_DATE_FORMATTER.format(refDate);
  const [year, month, day] = isoDate.split("-").map(Number);
  return { year, month, day, isoDate };
}

/**
 * Formats a date string to a concise display string anchored to Asia/Jakarta (WIB).
 * Example: "2026-09-11T10:00:00Z" -> "11 Sep 2026"
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const { year, month, day } = getJakartaDateParts(d);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthLabel = months[month - 1];
  return `${String(day).padStart(2, "0")} ${monthLabel} ${year}`;
}

/**
 * Humanized display labels for API enums (Rule: No raw enum strings in UI copy).
 */
export const PACING_STATUS_LABELS: Record<string, string> = {
  ON_TRACK: "On track",
  CAUTION: "Caution",
  BURNING_FAST: "Burning fast",
  DEFICIT_RISK: "Deficit risk",
};

export function formatPacingStatus(status?: string): string {
  if (!status) return "On track";
  return PACING_STATUS_LABELS[status] || status.replace(/_/g, " ").toLowerCase();
}

export function getPacingVariant(status?: string): "default" | "caution" | "urgency" {
  switch (status) {
    case "DEFICIT_RISK":
      return "urgency";
    case "CAUTION":
    case "BURNING_FAST":
      return "caution";
    default:
      return "default";
  }
}

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  CONTRACT: "Installment",
  BULK_BILL: "PayLater",
  PERSONAL_DEBT: "Personal debt",
  CC_TRANSACTION: "Card charge",
  OPERATIONAL_REFUND: "Operational refund",
};

export const FIXED_ESSENTIAL_LABELS: Record<string, string> = {
  TRANSPORT: "Fixed: Transport",
  INTERNET: "Fixed: Internet",
  VAPE: "Fixed: Vape",
  HAIRCUT: "Fixed: Haircut",
};

export function formatSourceType(sourceType?: string): string | null {
  if (!sourceType || sourceType === "MANUAL") return null;
  return SOURCE_TYPE_LABELS[sourceType] || sourceType;
}

export function getSourceBadge(
  sourceType?: string,
  fixedEssentialCategory?: string | null
): { text: string; variant: "default" | "caution" | "positive" | "negative" | "urgency" } | undefined {
  if (fixedEssentialCategory && FIXED_ESSENTIAL_LABELS[fixedEssentialCategory]) {
    return {
      text: FIXED_ESSENTIAL_LABELS[fixedEssentialCategory],
      variant: "default",
    };
  }
  if (!sourceType || sourceType === "MANUAL") {
    // Routine manual expense entries do not get a colored badge
    return undefined;
  }
  if (sourceType === "OPERATIONAL_REFUND") {
    return { text: "Refund offset", variant: "positive" };
  }
  if (sourceType === "BULK_BILL") {
    return { text: "PayLater", variant: "caution" };
  }
  if (sourceType === "PERSONAL_DEBT") {
    return { text: "Personal debt", variant: "caution" };
  }
  if (sourceType === "CONTRACT") {
    return { text: "Installment", variant: "default" };
  }
  if (sourceType === "CC_TRANSACTION") {
    return { text: "Card charge", variant: "default" };
  }
  return { text: sourceType, variant: "default" };
}

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  INCOME: "Income",
  DEDUCTION: "Deduction",
  CREDIT_BILL: "Credit bill",
};

export function formatTransactionType(type?: string): string {
  if (!type) return "";
  return TRANSACTION_TYPE_LABELS[type] || type;
}

export const SNAPSHOT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  LOCKED: "Locked",
};

export function formatSnapshotStatus(status?: string): string {
  if (!status) return "Draft";
  return SNAPSHOT_STATUS_LABELS[status] || status;
}

export const CHARGE_TYPE_LABELS: Record<string, string> = {
  FULL: "Full payment",
  INSTALLMENT: "Installment",
  RECURRING: "Recurring",
};

export function formatChargeType(chargeType?: string): string {
  if (!chargeType) return "";
  return CHARGE_TYPE_LABELS[chargeType] || chargeType;
}

export function getChargeTypeBadge(
  chargeType?: string
): { text: string; variant: "default" | "caution" | "positive" } {
  if (chargeType === "INSTALLMENT") {
    return { text: "Installment", variant: "caution" };
  }
  if (chargeType === "RECURRING") {
    return { text: "Recurring", variant: "positive" };
  }
  return { text: "Full payment", variant: "default" };
}

/**
 * Resolves the default payroll period whose consumption window contains a reference date
 * in Asia/Jakarta (WIB / UTC+7).
 * Under the 28th–26th / 27th–27th payday consumption cycle:
 * - Period M (current calendar month) if Jakarta day >= cycleTransitionDay (default 27)
 * - Period M - 1 (previous calendar month) if Jakarta day < cycleTransitionDay
 * Clamped to the system launch boundary at July 2026 (7/2026).
 */
export function getDefaultPayrollPeriod(
  refDate: Date = new Date(),
  cycleTransitionDay: number = DOMAIN_CONSTANTS.PAYDAY_CYCLE_START_DAY
): { month: number; year: number } {
  const { year: calYear, month: calMonth, day: calDay } = getJakartaDateParts(refDate);

  let month: number;
  let year: number;

  if (calDay >= cycleTransitionDay) {
    if (calMonth === 12) {
      month = 1;
      year = calYear + 1;
    } else {
      month = calMonth + 1;
      year = calYear;
    }
  } else {
    month = calMonth;
    year = calYear;
  }

  // Application launch boundary clamp: July 2026
  if (
    year < DOMAIN_CONSTANTS.LAUNCH_YEAR ||
    (year === DOMAIN_CONSTANTS.LAUNCH_YEAR && month < DOMAIN_CONSTANTS.LAUNCH_MONTH)
  ) {
    return { month: DOMAIN_CONSTANTS.LAUNCH_MONTH, year: DOMAIN_CONSTANTS.LAUNCH_YEAR };
  }

  return { month, year };
}

export const formatIDR = formatRupiah;
export const getDefaultPeriodFromNow = getDefaultPayrollPeriod;

export function formatSavingsInstrumentLabel(
  instrumentType?: string | null,
  profileMode: "SUPERADMIN_BESPOKE" | "STANDARD_GENERAL" = "SUPERADMIN_BESPOKE"
): string {
  if (profileMode === "STANDARD_GENERAL") {
    if (instrumentType === "INVESTMENT_RDPU") {
      return "Investment Portfolio (Mutual Funds / Stocks / Gold)";
    }
    return "Liquid Emergency Fund (Cash / High-Yield Deposit)";
  }
  if (instrumentType === "INVESTMENT_RDPU") return "Investment — RDPU";
  return "Liquid Emergency Cash";
}

export function formatFixedEssentialCategoryLabel(
  category?: string | null,
  profileMode: "SUPERADMIN_BESPOKE" | "STANDARD_GENERAL" = "SUPERADMIN_BESPOKE",
  customLabels?: Record<string, string | undefined> | null
): string {
  if (!category) return "";
  const key = category.toLowerCase();
  if (customLabels && customLabels[key]) {
    return customLabels[key]!;
  }
  if (profileMode === "STANDARD_GENERAL") {
    switch (category.toUpperCase()) {
      case "TRANSPORT":
        return "Housing & Utilities";
      case "INTERNET":
        return "Groceries & Dining";
      case "VAPE":
        return "Transport & Mobility";
      case "HAIRCUT":
        return "Subscriptions & Lifestyle";
      default:
        return category;
    }
  }
  switch (category.toUpperCase()) {
    case "TRANSPORT":
      return "Transport";
    case "INTERNET":
      return "Internet";
    case "VAPE":
      return "Vape";
    case "HAIRCUT":
      return "Haircut";
    default:
      return category;
  }
}

export function getRoutineEnvelopeLabel(
  key: "transport" | "internet" | "vape" | "haircut" | string,
  profileMode: "SUPERADMIN_BESPOKE" | "STANDARD_GENERAL" = "SUPERADMIN_BESPOKE",
  customLabels?: Record<string, string | undefined> | null
): string {
  const normalizedKey = key.toLowerCase();
  if (profileMode === "SUPERADMIN_BESPOKE") {
    switch (normalizedKey) {
      case "transport":
        return "Transport";
      case "internet":
        return "Internet";
      case "vape":
        return "Vape";
      case "haircut":
        return "Haircut";
      default:
        return key.charAt(0).toUpperCase() + key.slice(1);
    }
  }
  if (customLabels && customLabels[normalizedKey]) {
    return customLabels[normalizedKey]!;
  }
  if (profileMode === "STANDARD_GENERAL") {
    switch (normalizedKey) {
      case "transport":
        return "Housing & Utilities";
      case "internet":
        return "Groceries & Dining";
      case "vape":
        return "Transport & Mobility";
      case "haircut":
        return "Subscriptions & Lifestyle";
      default:
        return key.charAt(0).toUpperCase() + key.slice(1);
    }
  }
  switch (normalizedKey) {
    case "transport":
      return "Transport";
    case "internet":
      return "Internet";
    case "vape":
      return "Vape";
    case "haircut":
      return "Haircut";
    default:
      return key.charAt(0).toUpperCase() + key.slice(1);
  }
}

export function getSavingsVaultLabels(
  profileMode: "SUPERADMIN_BESPOKE" | "STANDARD_GENERAL" = "SUPERADMIN_BESPOKE"
): { liquid: string; investment: string } {
  if (profileMode === "STANDARD_GENERAL") {
    return {
      liquid: "Liquid Emergency Fund (Cash / High-Yield Deposit)",
      investment: "Investment Portfolio (Mutual Funds / Stocks / Gold)",
    };
  }
  return {
    liquid: "Liquid Emergency Cash",
    investment: "Investment · RDPU",
  };
}

export function formatSourceTypeLabel(
  sourceType?: string | null,
  type?: string | null
): string {
  if (sourceType === "OPERATIONAL_REFUND") return "Operational Refund";
  if (sourceType === "CC_TRANSACTION") return "Credit Card Statement";
  if (sourceType === "BULK_BILL") return "PayLater Bill";
  if (sourceType === "PERSONAL_DEBT") return "Personal & Informal Debt";
  if (sourceType === "CONTRACT") return "Installment Contract";
  if (type === "INCOME") return "Extra Income";
  return "Manual Operational Spend";
}
