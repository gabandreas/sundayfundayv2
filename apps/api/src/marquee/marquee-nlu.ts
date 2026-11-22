export type MarqueeToolName =
  | 'get_financial_pulse'
  | 'log_quick_expense'
  | 'evaluate_affordability'
  | 'get_upcoming_bills'
  | 'wallet_checkin_guard'
  | 'get_debt_burndown'
  | 'get_savings_and_goals'
  | 'simulate_debt_payoff';

export type MarqueeInstrument = 'CASH' | 'PAYLATER' | 'CREDIT_CARD';
export type MarqueeLocale = 'en' | 'id' | 'zh';

export interface MarqueeParsedIntent {
  tool: MarqueeToolName;
  locale: MarqueeLocale;
  amountRp?: number;
  title?: string;
  instrument: MarqueeInstrument;
  tenorMonths: number;
  confidence: number;
}

export function detectLocale(message: string): MarqueeLocale {
  if (/[\u4e00-\u9fff]/.test(message)) return 'zh';
  const lower = message.toLowerCase();
  if (
    /\b(catat|beli|bayar|aman|berapa|tabungan|tagihan|dompet|sisa|cicilan|lunas|simulasi|belanja|gaji|pake|pakai|buat|hari|ini|saya|ga|gak|nggak|bulan|ribu|juta|jt|rb)\b/.test(
      lower,
    )
  ) {
    return 'id';
  }
  return 'en';
}

/**
 * Extracts Rupiah monetary amounts across EN / ID / ZH formats:
 * - "45k", "1.5k" -> 45000, 1500
 * - "85rb", "85 ribu" -> 85000
 * - "1.5jt", "1,5 juta" -> 1500000
 * - "Rp 75.000", "75.000", "250000" -> 75000, 250000
 */
export function extractAmountRp(message: string): number | undefined {
  const clean = message.trim();

  // Handle juta / jt
  const jtMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:juta|jt)\b/i);
  if (jtMatch) {
    const val = parseFloat(jtMatch[1].replace(',', '.'));
    if (Number.isFinite(val)) return Math.round(val * 1_000_000);
  }

  // Handle k / rb / ribu / 千
  const kMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)\b/i);
  if (kMatch) {
    const val = parseFloat(kMatch[1].replace(',', '.'));
    if (Number.isFinite(val)) return Math.round(val * 1_000);
  }

  // Handle Chinese wan (万 = 10,000) or qian (千 = 1,000)
  const zhWanMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*万/);
  if (zhWanMatch) {
    const val = parseFloat(zhWanMatch[1].replace(',', '.'));
    if (Number.isFinite(val)) return Math.round(val * 10_000);
  }

  // Handle explicit IDR / Rp formatted or plain large integers (exclude 15th/20th/3x/year 2026)
  const rpMatch = clean.match(/(?:rp\.?\s*)([\d.,]+)/i);
  if (rpMatch) {
    const digits = rpMatch[1].replace(/[.,](?=\d{3}(?:\D|$))/g, '').replace(/[^\d]/g, '');
    const val = parseInt(digits, 10);
    if (Number.isFinite(val) && val >= 100) return val;
  }

  // Fallback raw number >= 1000 (not followed by x)
  const numMatches = clean.matchAll(/(?<![a-zA-Z0-9])(\d{1,3}(?:\.\d{3})+|\d{4,})(?!x\b)/gi);
  for (const m of numMatches) {
    const val = parseInt(m[1].replace(/\./g, ''), 10);
    if (Number.isFinite(val) && val >= 1000 && val !== 2025 && val !== 2026 && val !== 2027) {
      return val;
    }
  }

  return undefined;
}

export function extractTenorMonths(message: string): number {
  const match = message.match(/(\d{1,2})\s*(?:x|bulan|bln|mo|months?|cicilan|installments?|期)\b/i);
  if (!match) return 1;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n >= 1 && n <= 36 ? n : 1;
}

export function detectInstrument(message: string): MarqueeInstrument {
  const lower = message.toLowerCase();
  if (/\b(spaylater|paylater|pay later|shopee)\b|先享后付|花呗/.test(lower)) {
    return 'PAYLATER';
  }
  if (/\b(cc|credit\s*card|kartu\s*kredit|permata)\b|信用卡/.test(lower)) {
    return 'CREDIT_CARD';
  }
  return 'CASH';
}

function extractTitleFromMessage(message: string): string {
  const stripped = message
    .replace(/(?:rp\.?\s*[\d.,]+|\d+(?:[.,]\d+)?\s*(?:juta|jt|rb|ribu|k|万))/gi, ' ')
    .replace(/\b\d{1,2}\s*(?:x|bulan|bln|mo|months?|cicilan|installments?|期)\b/gi, ' ')
    .replace(
      /\b(log|add|record|spend|bought|buy|catat|beli|bayar|input|simulate|afford|can i afford|aman ga|aman|belanja|pake|pakai|spaylater|paylater|pay later|cc|credit card|kartu kredit|cash|tunai|for|di|ke)\b/gi,
      ' ',
    )
    .replace(/[?!.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped) return 'Quick Entry';
  return stripped
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .slice(0, 64);
}

/**
 * Tier 1 deterministic trilingual NLU parser (EN / ID / ZH) executing with <5ms latency.
 */
export function parseMarqueeIntent(message: string): MarqueeParsedIntent {
  const lower = message.toLowerCase().trim();
  const locale = detectLocale(message);
  const amountRp = extractAmountRp(message);
  const tenorMonths = extractTenorMonths(message);
  const instrument = detectInstrument(message);
  const title = extractTitleFromMessage(message);

  // 1. Debt payoff optimizer simulation
  if (
    /(snowball|avalanche|early\s*payoff|pelunasan|lunasin|percepat|prepay|提前还款|雪崩|雪球)/.test(
      lower,
    )
  ) {
    return {
      tool: 'simulate_debt_payoff',
      locale,
      amountRp: amountRp ?? 1_000_000,
      instrument,
      tenorMonths,
      confidence: 0.94,
    };
  }

  // 2. Wallet check-in & hold guard
  if (
    /(wallet|dompet|saldo|cash\s*in\s*hand|pegang\s*uang|guard|钱包|现金余额)/.test(lower) &&
    amountRp !== undefined
  ) {
    return {
      tool: 'wallet_checkin_guard',
      locale,
      amountRp,
      instrument: 'CASH',
      tenorMonths: 1,
      confidence: 0.93,
    };
  }

  // 3. Affordability / cutoff simulation
  if (
    /(afford|can i buy|should i buy|aman\s*ga|aman\s*tidak|bisa\s*beli|mampu|simulasi|kelayakan|买得起|划算)/.test(
      lower,
    ) &&
    amountRp !== undefined
  ) {
    return {
      tool: 'evaluate_affordability',
      locale,
      amountRp,
      title,
      instrument,
      tenorMonths,
      confidence: 0.93,
    };
  }

  // 4. Upcoming bills & obligations
  if (/(upcoming|bills?\s*due|tagihan|jatuh\s*tempo|paylater\s*bills?|账单|到期)/.test(lower)) {
    return {
      tool: 'get_upcoming_bills',
      locale,
      instrument,
      tenorMonths,
      confidence: 0.92,
    };
  }

  // 5. Debt burndown / active contracts
  if (/(burndown|installments?|contracts?|spinjam|bridge\s*loan|cicilan|utang\s*aktif|分期|债务)/.test(lower) && !amountRp) {
    return {
      tool: 'get_debt_burndown',
      locale,
      instrument,
      tenorMonths,
      confidence: 0.9,
    };
  }

  // 6. Savings & P1 vault goals
  if (/(savings?|vault|rdpu|tabungan|brankas|goal|target\s*tabung|储蓄|目标)/.test(lower)) {
    return {
      tool: 'get_savings_and_goals',
      locale,
      instrument,
      tenorMonths,
      confidence: 0.91,
    };
  }

  // 7. Quick expense / liability capture (explicit verb OR amount present without pure pulse query)
  if (
    amountRp !== undefined &&
    (/(log|add|record|spend|bought|buy|catat|beli|bayar|input|记录|记账|花了)/.test(lower) ||
      !/\b(safe|status|pulse|today|hari\s*ini|今天|还能花)\b/.test(lower))
  ) {
    return {
      tool: 'log_quick_expense',
      locale,
      amountRp,
      title,
      instrument,
      tenorMonths,
      confidence: 0.91,
    };
  }

  // 8. Default: Daily pacing & live financial pulse
  return {
    tool: 'get_financial_pulse',
    locale,
    amountRp,
    instrument,
    tenorMonths,
    confidence: 0.9,
  };
}
