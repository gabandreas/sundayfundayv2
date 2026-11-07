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
 * When amounts are masked (privacy mode default), returns "Rp •••••••" or "-Rp •••••••".
 * Example: 18500000 -> "Rp 18.500.000", -45000 -> "-Rp 45.000"
 */
export function formatRupiah(amount: number | null | undefined, forceMasked?: boolean): string {
  const isMasked = forceMasked !== undefined ? forceMasked : _isAmountsMasked;
  if (isMasked) {
    if (amount !== null && amount !== undefined && !isNaN(amount) && amount < 0) {
      return "-Rp •••••••";
    }
    return "Rp •••••••";
  }
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "Rp 0";
  }
  const isNegative = amount < 0;
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return isNegative ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

/**
 * Formats a date string to a concise display string.
 * Example: "2026-09-11T10:00:00Z" -> "11 Sep 2026"
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const day = d.getDate().toString().padStart(2, "0");
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
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
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
 * Resolves the default payroll period whose consumption window contains a reference date.
 * Under the payday-to-payday consumption cycle, a calendar date belongs to:
 * - Period M (current calendar month) if reference date >= payroll payout day (default 25)
 * - Period M - 1 (previous calendar month) if reference date < payroll payout day
 * Clamped to the system launch boundary at July 2026 (7/2026).
 */
export function getDefaultPayrollPeriod(
  refDate: Date = new Date(),
  payoutDay: number = 25
): { month: number; year: number } {
  const calDay = refDate.getDate();
  const calMonth = refDate.getMonth() + 1; // 1-indexed (1..12)
  const calYear = refDate.getFullYear();

  let month: number;
  let year: number;

  if (calDay >= payoutDay) {
    month = calMonth;
    year = calYear;
  } else {
    if (calMonth === 1) {
      month = 12;
      year = calYear - 1;
    } else {
      month = calMonth - 1;
      year = calYear;
    }
  }

  // Application launch boundary clamp: July 2026
  if (year < 2026 || (year === 2026 && month < 7)) {
    return { month: 7, year: 2026 };
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
        return "Transport & Fuel";
      case "INTERNET":
        return "Internet & Utilities";
      case "VAPE":
        return "Subscriptions & Lifestyle";
      case "HAIRCUT":
        return "Personal Care & Health";
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
        return "Transport & Fuel";
      case "internet":
        return "Internet & Utilities";
      case "vape":
        return "Subscriptions & Lifestyle";
      case "haircut":
        return "Personal Care & Health";
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
    investment: "Investment — RDPU",
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
