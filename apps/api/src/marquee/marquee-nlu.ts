export type MarqueeToolName =
  // Canonical & V3 Service Tool Names
  | 'get_paycycle_pulse'
  | 'simulate_purchase_cutoff'
  | 'optimize_payday_thr_split'
  | 'analyze_debt_burndown'
  | 'evaluate_custom_formula'
  | 'prepare_quick_transaction'
  | 'prepare_wallet_checkin'
  | 'explain_period_variance'
  | 'manage_liability_item'
  | 'revise_budget_or_quota'
  | 'manage_savings_pocket_or_goal'
  | 'manage_wishlist_or_subscription'
  | 'run_what_if_scenario'
  | 'manage_user_memory'
  | 'search_financial_history'
  | 'run_stress_test'
  | 'greeting_or_help'
  | 'refuse_out_of_scope'
  // Legacy Aliases (preserved 1:1 for backward compatibility)
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
  expression?: string;
  action?: string;
  itemQuery?: string;
  category?: string;
  purchaseDateIso?: string;
  merchantPattern?: string;
  defaultInstrument?: MarqueeInstrument;
  ruleText?: string;
  searchQuery?: string;
  confidence: number;
}

export function detectLocale(message: string): MarqueeLocale {
  if (/[\u4e00-\u9fff]/.test(message)) return 'zh';
  const lower = message.toLowerCase();
  if (
    /\b(halo|hai|pagi|siang|sore|malam|makasih|terima\s*kasih|apa\s*kabar|bisa\s*apa|keuangan|catat|beli|bayar|aman|berapa|tabungan|tagihan|dompet|sisa|cicilan|lunas|simulasi|belanja|gaji|pake|pakai|buat|hari|ini|saya|aku|kamu|ga|gak|nggak|bulan|ribu|juta|jt|rb|tolong|tolongin|dong|sekarang|kenapa|cari|ingat|lupakan|pindah|pindahin|ubah|siapkan)\b/.test(
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

  // 0.0 Strict Domain Boundary Guardrail: reject OS/terminal/download/raw-SQL/non-finance prompts cleanly
  if (
    /\b(download|install|kimi\s*web\s*bridge|executesql|execute_sql|run_shell|powershell|bash|terminal|curl|wget|drop\s+table|select\s+\*\s+from|sudo|pip\s+install|npm\s+install|cuaca|weather|resep\s+masakan)\b/.test(
      lower,
    )
  ) {
    return {
      tool: 'refuse_out_of_scope',
      locale,
      instrument,
      tenorMonths,
      title: message.slice(0, 120),
      confidence: 0.99,
    };
  }

  // 0.0A Natural Greetings, Gratitude & Help Inquiries (never dump boilerplate financial pulse cards)
  const isGreetingOrHelp =
    amountRp === undefined &&
    (/^(?:hi|hello|hey|yo|sup|halo|hai|pagi|siang|sore|malam|selamat\s+(?:pagi|siang|sore|malam)|thanks|thank\s+you|thx|makasih|terima\s+kasih|ok|okay|oke|siap|mantap|good\s+(?:morning|afternoon|evening)|who\s+are\s+you|help)(?:\s+(?:marquee|bot|there))?[!?.~\s]*$/i.test(
      lower,
    ) ||
      /^(?:你好|您好|早|早上好|谢谢|帮助|你能做什么)[!！?？。.\s]*$/.test(message.trim()) ||
      /\b(bisa\s+apa(?:\s+aja)?|kamu\s+siapa|what\s+can\s+you\s+do|how\s+can\s+you\s+help|apa\s+fitur)\b/i.test(
        lower,
      ));
  if (isGreetingOrHelp) {
    return {
      tool: 'greeting_or_help',
      locale,
      instrument,
      tenorMonths,
      title: message.slice(0, 120),
      confidence: 0.98,
    };
  }

  // 0.0A2 Concurrent Go Stress Test & Allocation Frontier Optimization
  if (
    /\b(stress\s*test|monte\s*carlo|survival\s*(?:prob|rate|odds)|peluang\s*bertahan|ketahanan\s*kas|alokasi\s*surplus|optimasi\s*surplus|pareto)\b/i.test(
      lower,
    ) ||
    /压力测试|蒙特卡洛|最优分配/.test(message)
  ) {
    return {
      tool: 'run_stress_test',
      locale,
      amountRp,
      instrument,
      tenorMonths,
      title: 'Monte Carlo & Allocation Stress Test',
      confidence: 0.95,
    };
  }

  // 0.0B User Financial Preference Memory (REMEMBER / LIST / FORGET)
  if (
    /\b(ingat(?:kan)?|remember|simpan\s+aturan|lupakan|forget\s+rule|hapus\s+memori|daftar\s+memori|list\s+memory|aturan\s+saya)\b/.test(
      lower,
    )
  ) {
    const isList = /\b(daftar|list|apa\s+aja|lihat)\b/.test(lower) && !/\b(ingat|remember)\b/.test(lower);
    const isForget = /\b(lupakan|forget|hapus|delete)\b/.test(lower);
    const patternCleanup = message
      .replace(
        /\b(tolong|hey|ingat|ingatkan|remember|kalau|jika|bila|beli|bayar|selalu|catat|pake|pakai|ke|spaylater|paylater|credit\s*card|kartu\s*kredit|cc|cash|tunai|aturan|memori|rule|lupakan|forget|hapus|delete|mesti|harus|default|nya)\b/gi,
        ' ',
      )
      .replace(/[:"'?!.,]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    return {
      tool: 'manage_user_memory',
      locale,
      action: isForget ? 'FORGET' : isList ? 'LIST' : 'REMEMBER',
      ruleText: message.trim(),
      ...(patternCleanup ? { merchantPattern: patternCleanup.split(' ').slice(0, 3).join(' ') } : {}),
      ...(/(spaylater|paylater|cc|credit\s*card|kartu\s*kredit|cash|tunai)/.test(lower)
        ? { defaultInstrument: instrument }
        : {}),
      instrument,
      tenorMonths,
      confidence: 0.94,
    };
  }

  // 0.0C Scoped Historical Archive Search (Hybrid RAG tool)
  if (
    /\b(cari\s+histori|search\s+history|riwayat\s+belanja|histori\s+transaksi|rekam\s+jejak|pernah\s+beli|kapan\s+terakhir|total\s+pengeluaran)\b/.test(
      lower,
    )
  ) {
    const cleanedSearch = message
      .replace(
        /\b(cari|search|histori|history|riwayat|transaksi|belanja|pengeluaran|rekam|jejak|pernah|beli|kapan|terakhir|kali|berapa|total|selama|bulan|tahun)\b/gi,
        ' ',
      )
      .replace(/[?!.,]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      tool: 'search_financial_history',
      locale,
      searchQuery: cleanedSearch || title,
      title: cleanedSearch || title,
      instrument,
      tenorMonths,
      confidence: 0.93,
    };
  }

  // 0A. Shift / Settle liability item (e.g. "pindahkan Americano ke desember", "shift Americano earlier", "lunasi")
  if (
    /(shift|move|geser|pindah|undurkan|majukan|split|settle|lunasi|mark\s*paid)/.test(
      lower,
    ) &&
    !/(tax|pajak|payroll|thr)/.test(lower)
  ) {
    const isSettle = /(settle|lunasi|mark\s*paid)/.test(lower);
    const isEarlier = /(earlier|majukan|sebelum|des|dec|nov|mundur\s*maju|maju)/.test(lower);
    const cleanedQuery = message
      .replace(
        /\b(tolong|bisa|ga|gak|pindahin|pindahkan|geser|shift|move|earlier|later|majukan|undurkan|ke|bulan|periode|settle|lunasi|mark|paid|tagihan|bill|item|spaylater|paylater|desember|december|januari|january|november)\b/gi,
        ' ',
      )
      .replace(/\b20\d{2}\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      tool: 'manage_liability_item',
      locale,
      amountRp,
      action: isSettle ? 'SETTLE' : isEarlier ? 'SHIFT_EARLIER' : 'SHIFT_LATER',
      itemQuery: cleanedQuery || title,
      instrument,
      tenorMonths,
      confidence: 0.93,
    };
  }

  // 0B. Budget / Routine Quota Revision
  if (
    /(ubah|ganti|revisi|naikkan|turunkan|set|update|revise|adjust)\s+.*?(budget|anggaran|kuota|quota|harian|daily|living|transport|internet|vape|haircut|grooming|p1|tabungan)/.test(
      lower,
    ) &&
    amountRp !== undefined
  ) {
    let category = 'DAILY_OPERATIONAL';
    if (/(transport)/.test(lower)) category = 'TRANSPORT';
    else if (/(internet|kuota|data)/.test(lower)) category = 'INTERNET';
    else if (/(vape|liquid|rokok|supplies)/.test(lower)) category = 'VAPE';
    else if (/(haircut|cukur|grooming)/.test(lower)) category = 'HAIRCUT';
    else if (/(p1|tabungan|savings)/.test(lower)) category = 'SAVINGS';
    return {
      tool: 'revise_budget_or_quota',
      locale,
      amountRp,
      category,
      instrument,
      tenorMonths,
      confidence: 0.93,
    };
  }

  // 0C. Wishlist Add or Subscription / Promo Kill-Switch Toggle
  if (
    /(wishlist|pingin|pengen\s*beli|matikan|batalkan|cancel\s*sub|kill\s*switch|langganan|subscription|promo)/.test(
      lower,
    )
  ) {
    const isSub = /(matikan|batalkan|cancel|kill\s*switch|langganan|subscription|promo)/.test(lower);
    return {
      tool: 'manage_wishlist_or_subscription',
      locale,
      amountRp,
      title,
      action: isSub ? 'TOGGLE_KILL_SWITCH' : 'ADD_WISHLIST',
      instrument,
      tenorMonths,
      confidence: 0.92,
    };
  }

  // 0D. What-If 12M Scenario
  if (
    /(what\s*if|kalau\s*misal|andai|jika\s*nabung|simulasi\s*12\s*bulan|runway\s*kalau)/.test(
      lower,
    )
  ) {
    return {
      tool: 'run_what_if_scenario',
      locale,
      amountRp: amountRp ?? 500_000,
      instrument,
      tenorMonths,
      confidence: 0.92,
    };
  }

  // 0E. THR / Bonus / Payday Split optimization
  if (/\b(thr|bonus|natal|lebaran|split\s*bonus|alokasi\s*thr|年终奖|奖金)\b/.test(lower)) {
    return {
      tool: 'optimize_payday_thr_split',
      locale,
      amountRp: amountRp ?? 3_400_000,
      instrument,
      tenorMonths,
      confidence: 0.94,
    };
  }

  // 0B. Custom formula evaluation
  if (
    /\b(formula|evaluate|net_income|total_debt|living_pool|shortfall|p1_savings|p2_buffer|daily_rate)\b/.test(
      lower,
    )
  ) {
    return {
      tool: 'evaluate_custom_formula',
      locale,
      amountRp,
      instrument,
      tenorMonths,
      expression: message,
      confidence: 0.93,
    };
  }

  // 0C. Period variance / shortfall comparison
  if (/\b(variance|selisih|bedanya|compare\s*period|why\s*shortfall|kenapa\s*defisit|对比|差异)\b/.test(lower)) {
    return {
      tool: 'explain_period_variance',
      locale,
      amountRp,
      instrument,
      tenorMonths,
      confidence: 0.92,
    };
  }

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
  if (
    /(burndown|installments?|contracts?|spinjam|bridge\s*loan|cicilan|utang\s*aktif|分期|债务)/.test(
      lower,
    ) &&
    !amountRp
  ) {
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

/**
 * Enriches short multi-turn follow-up prompts (e.g. "pake spaylater aja", "3x cicilan")
 * using prior conversation turns so users don't have to re-type the item & price.
 */
export function applyFollowUpHistory(
  parsed: MarqueeParsedIntent,
  message: string,
  history?: Array<{ role: 'user' | 'assistant'; text: string }>,
): MarqueeParsedIntent {
  if (!history || history.length === 0 || parsed.amountRp !== undefined) {
    return parsed;
  }
  const lower = message.toLowerCase().trim();
  const hasInstrumentOrTenorCue =
    /\b(spaylater|paylater|pay\s*later|cc|credit\s*card|kartu\s*kredit|permata|cash|tunai|pake|pakai|use|via|aja)\b/.test(
      lower,
    ) || /\b\d{1,2}\s*(?:x|bulan|bln|months?|cicilan|期)\b/i.test(lower);

  if (!hasInstrumentOrTenorCue || lower.length > 72) {
    return parsed;
  }

  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn.role !== 'user') continue;
    const prev = parseMarqueeIntent(turn.text);
    if (prev.amountRp !== undefined) {
      const prevIsAfford =
        prev.tool === 'evaluate_affordability' || prev.tool === 'simulate_purchase_cutoff';
      return {
        ...parsed,
        tool: prevIsAfford ? 'evaluate_affordability' : 'log_quick_expense',
        amountRp: prev.amountRp,
        title: prev.title && prev.title !== 'Quick Entry' ? prev.title : parsed.title,
        instrument:
          /\b(spaylater|paylater|cc|credit\s*card|kartu\s*kredit|permata|cash|tunai)\b/.test(lower)
            ? parsed.instrument
            : prev.instrument,
        tenorMonths:
          /\b\d{1,2}\s*(?:x|bulan|bln|months?|cicilan|期)\b/i.test(lower)
            ? parsed.tenorMonths
            : prev.tenorMonths,
        confidence: 0.92,
      };
    }
  }
  return parsed;
}

/**
 * Detects a distinct secondary clause in compound prompts (e.g. "cek saldo hari ini dan simulasi sepatu 300rb spaylater")
 * so Tier 1 can chain multi-step analysis transparently even offline.
 */
export function detectCompoundSecondaryIntent(message: string): MarqueeParsedIntent | null {
  const parts = message.split(/\s+(?:dan|and|lalu|then|sama|plus)\s+|同时|并且/i);
  if (parts.length < 2) return null;
  const firstParsed = parseMarqueeIntent(parts[0].trim());
  const secondClause = parts.slice(1).join(' ').trim();
  if (!secondClause || secondClause.length < 4) return null;
  const secondParsed = parseMarqueeIntent(secondClause);
  if (
    secondParsed.tool === firstParsed.tool ||
    secondParsed.tool === 'greeting_or_help' ||
    secondParsed.tool === 'get_financial_pulse'
  ) {
    return null;
  }
  return secondParsed;
}
