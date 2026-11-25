export type UiLocale = "en" | "id" | "zh";

const AUDIT_CATEGORY_MAP: Record<string, { en: string; id: string; zh: string }> = {
  OPERATIONAL_BUDGET: {
    en: "Daily Living Budget",
    id: "Anggaran Harian",
    zh: "日常支出预算",
  },
  DAILY_OPERATIONAL: {
    en: "Daily Living Budget",
    id: "Anggaran Harian",
    zh: "日常支出预算",
  },
  SELF_REWARD: {
    en: "Discretionary Allocation",
    id: "Alokasi Bebas",
    zh: "弹性自由支配",
  },
  DEBT_BURDEN: {
    en: "Debt Load Check",
    id: "Beban Cicilan",
    zh: "债务负担检查",
  },
  INFORMAL_DEBT: {
    en: "Personal Loan Check",
    id: "Pinjaman Personal",
    zh: "个人借款核查",
  },
  BUDGET: {
    en: "Budget Plan",
    id: "Rencana Anggaran",
    zh: "预算方案",
  },
  TRANSACTIONS: {
    en: "Transactions",
    id: "Transaksi",
    zh: "交易流水",
  },
  SAVINGS: {
    en: "Savings",
    id: "Tabungan",
    zh: "储蓄记录",
  },
  PAYROLL: {
    en: "Payroll",
    id: "Gaji & Slip",
    zh: "薪酬发放",
  },
  SECURITY: {
    en: "Account Security",
    id: "Keamanan Akun",
    zh: "账户安全",
  },
};

const STATUS_MAP: Record<string, { en: string; id: string; zh: string }> = {
  HEALTHY: { en: "Healthy", id: "Sehat", zh: "健康" },
  GOOD: { en: "Good", id: "Baik", zh: "良好" },
  CAUTION: { en: "Caution", id: "Waspada", zh: "注意" },
  CRITICAL: { en: "Attention Needed", id: "Perlu Perhatian", zh: "需关注" },
  TIGHT: { en: "Tight", id: "Ketat", zh: "偏紧" },
  DEFICIT: { en: "Shortfall", id: "Kurang", zh: "缺口" },
  DRAFT: { en: "Active Draft", id: "Draf Aktif", zh: "草稿中" },
  LOCKED: { en: "Closed", id: "Terkunci", zh: "已结账" },
  PLANNING: { en: "Scheduled", id: "Terjadwal", zh: "计划中" },
  ACTIVE: { en: "Active", id: "Aktif", zh: "进行中" },
  COMPLETED: { en: "Completed", id: "Selesai", zh: "已完成" },
  FUNDED: { en: "Funded", id: "Terpenuhi", zh: "已足额" },
  SKIPPED: { en: "Skipped", id: "Terlewati", zh: "已跳过" },
  HEAVY_BURDEN: { en: "Above Safe Ceiling", id: "Melebihi Batas Aman", zh: "超出安全上限" },
  LIMIT_BREACHED: { en: "Limit Exceeded", id: "Melebihi Limit", zh: "超出额度" },
  UNPAID: { en: "Unpaid", id: "Belum Dibayar", zh: "待支付" },
  RESERVED: { en: "Reserved", id: "Disisihkan", zh: "已预留" },
  PAID: { en: "Paid", id: "Lunas", zh: "已结清" },
};

const ACTION_MAP: Record<string, { en: string; id: string; zh: string }> = {
  TRIP_EVENT_CREATED: {
    en: "Event Budget Created",
    id: "Anggaran Acara Dibuat",
    zh: "创建活动预算",
  },
  TRIP_EVENT_CLOSED_SWEPT: {
    en: "Event Closed & Swept",
    id: "Acara Ditutup & Sisa Disapu",
    zh: "活动结账并归集结余",
  },
  PERIOD_CLOSED: {
    en: "Cycle Closed & Locked",
    id: "Siklus Ditutup & Dikunci",
    zh: "周期已结账锁定",
  },
  SAVINGS_DEPOSIT_CONFIRMED: {
    en: "Savings Transfer Confirmed",
    id: "Setoran Tabungan Dikonfirmasi",
    zh: "核心储蓄已确认",
  },
  CROSS_BUCKET_PAYLATER_ROUTE: {
    en: "PayLater Expense Scheduled",
    id: "Belanja PayLater Dijadwalkan",
    zh: "先买后付账单已入账",
  },
};

const STRATEGY_MAP: Record<string, { en: string; id: string; zh: string }> = {
  CONTRACTUAL: { en: "Scheduled Minimum", id: "Jadwal Reguler", zh: "按期正常还款" },
  AVALANCHE: { en: "Highest Interest First", id: "Bunga Tertinggi Dulu", zh: "雪崩法（高息优先）" },
  SNOWBALL: { en: "Smallest Balance First", id: "Saldo Terkecil Dulu", zh: "雪球法（小额优先）" },
};

const EVENT_EXPENSE_CATEGORY_MAP: Record<string, { en: string; id: string; zh: string }> = {
  FOOD_DRINK: { en: "Food & Drinks", id: "Makan & Minum", zh: "餐饮茶水" },
  LOCAL_TRANSPORT: { en: "Local Transport", id: "Transportasi Lokal", zh: "当地交通" },
  ACTIVITIES: { en: "Activities & Stay", id: "Aktivitas & Penginapan", zh: "活动与住宿" },
  CONTINGENCY: { en: "Contingency", id: "Dana Tak Terduga", zh: "应急备用" },
  STAY: { en: "Lodging & Stay", id: "Penginapan", zh: "住宿" },
  TRANSPORT: { en: "Transport", id: "Transportasi", zh: "交通" },
  FOOD: { en: "Food & Drinks", id: "Makan & Minum", zh: "餐饮" },
  OTHER: { en: "Other", id: "Lainnya", zh: "其他" },
};

const TIER_MAP: Record<string, { en: string; id: string; zh: string }> = {
  CONSERVATIVE: { en: "Conservative", id: "Hemat", zh: "稳健低耗" },
  BALANCED: { en: "Balanced", id: "Seimbang", zh: "均衡推荐" },
  MAX_SAFE: { en: "Max Safe", id: "Maksimal Aman", zh: "安全上限" },
};

export function titleCaseCode(code: string): string {
  return String(code || "")
    .trim()
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function lookupLabel(
  table: Record<string, { en: string; id: string; zh: string }>,
  raw: string,
  locale: UiLocale = "en",
): string {
  const key = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  const hit = table[key];
  if (hit) return hit[locale] ?? hit.en;
  return titleCaseCode(raw);
}

export function formatAuditCategoryLabel(raw: string, locale: UiLocale = "en"): string {
  return lookupLabel(AUDIT_CATEGORY_MAP, raw, locale);
}

export function formatHumanStatus(raw: string, locale: UiLocale = "en"): string {
  return lookupLabel(STATUS_MAP, raw, locale);
}

export function formatAuditActionLabel(raw: string, locale: UiLocale = "en"): string {
  return lookupLabel(ACTION_MAP, raw, locale);
}

export function formatDebtStrategyLabel(raw: string, locale: UiLocale = "en"): string {
  return lookupLabel(STRATEGY_MAP, raw, locale);
}

export function formatEventExpenseCategoryLabel(raw: string, locale: UiLocale = "en"): string {
  return lookupLabel(EVENT_EXPENSE_CATEGORY_MAP, raw, locale);
}

export function formatEventTierLabel(raw: string, locale: UiLocale = "en"): string {
  return lookupLabel(TIER_MAP, raw, locale);
}
