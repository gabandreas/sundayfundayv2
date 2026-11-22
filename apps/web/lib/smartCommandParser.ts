export type ParsedSmartCommand =
  | {
      kind: "ADD_LIABILITY";
      instrument: "SPAYLATER" | "CREDIT_CARD" | "SPINJAM";
      title: string;
      amount: number;
      tenorMonths: number;
      purchaseDateIso: string;
      rawInput: string;
    }
  | {
      kind: "WALLET_CHECKIN";
      actualWalletBalance: number;
      rawInput: string;
    }
  | {
      kind: "SIMULATE_AFFORD";
      instrument: "SPAYLATER" | "CREDIT_CARD" | "SPINJAM" | "CASH";
      title: string;
      amount: number;
      tenorMonths: number;
      purchaseDateIso: string;
      rawInput: string;
    };

const MONTH_TOKEN_MAP: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  may: 5, mei: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  aug: 8, agu: 8, agustus: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, okt: 10, oktober: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, des: 12, desember: 12, december: 12,
};

function parseShortAmount(token: string): number | null {
  const clean = token.toLowerCase().trim().replace(/,/g, "");
  const match = clean.match(/^(\d+(?:\.\d+)?)(k|rb|m|jt)?$/i);
  if (!match) return null;
  let numStr = match[1];
  const suffix = (match[2] ?? "").toLowerCase();

  if (!suffix && /^\d{1,3}(?:\.\d{3})+$/.test(numStr)) {
    numStr = numStr.replace(/\./g, "");
  }
  const val = parseFloat(numStr);
  if (Number.isNaN(val) || val <= 0) return null;

  if (suffix === "k" || suffix === "rb") return Math.round(val * 1000);
  if (suffix === "m" || suffix === "jt") return Math.round(val * 1_000_000);
  return Math.round(val);
}

export function parseSmartCommand(
  input: string,
  defaultYear: number = 2026,
  todayIso: string = "2026-11-18"
): ParsedSmartCommand | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);
  const lowerTokens = tokens.map((t) => t.toLowerCase());

  // 1. Wallet check-in shorthand: `wallet 515000` or `wallet 515k`
  if (
    (lowerTokens[0] === "wallet" || lowerTokens[0] === "saldo" || lowerTokens[0] === "bank") &&
    tokens.length >= 2
  ) {
    const amt = parseShortAmount(tokens[1]);
    if (amt !== null) {
      return {
        kind: "WALLET_CHECKIN",
        actualWalletBalance: amt,
        rawInput: trimmed,
      };
    }
  }

  // 2. Affordability simulation shorthand: `afford claude 350000 cc` or `sim laptop 1.5m spaylater 3x`
  const isAfford = lowerTokens[0] === "afford" || lowerTokens[0] === "sim";
  const workTokens = isAfford ? tokens.slice(1) : tokens;
  const workLower = workTokens.map((t) => t.toLowerCase());

  let instrument: "SPAYLATER" | "CREDIT_CARD" | "SPINJAM" | null = null;
  const consumedIndices = new Set<number>();

  workLower.forEach((tok, idx) => {
    if (["spaylater", "paylater", "spay", "pl"].includes(tok)) {
      instrument = "SPAYLATER";
      consumedIndices.add(idx);
    } else if (["cc", "card", "credit", "creditcard"].includes(tok)) {
      instrument = "CREDIT_CARD";
      consumedIndices.add(idx);
    } else if (["spinjam", "loan", "pinjam", "debt"].includes(tok)) {
      instrument = "SPINJAM";
      consumedIndices.add(idx);
    }
  });

  if (!instrument && !isAfford) {
    return null;
  }

  let tenorMonths = 1;
  workLower.forEach((tok, idx) => {
    const tMatch = tok.match(/^(\d{1,2})x$/i);
    if (tMatch) {
      tenorMonths = Math.max(1, Math.min(60, parseInt(tMatch[1], 10)));
      consumedIndices.add(idx);
    }
  });

  // Extract optional `<day> <monthName>` date like `21 nov`
  let purchaseDateIso = todayIso;
  for (let i = 0; i < workLower.length - 1; i++) {
    const dayNum = parseInt(workLower[i], 10);
    const monNum = MONTH_TOKEN_MAP[workLower[i + 1]];
    if (
      !Number.isNaN(dayNum) &&
      dayNum >= 1 &&
      dayNum <= 31 &&
      /^\d{1,2}$/.test(workLower[i]) &&
      monNum
    ) {
      purchaseDateIso = `${defaultYear}-${String(monNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      consumedIndices.add(i);
      consumedIndices.add(i + 1);
      break;
    }
  }

  // Extract primary amount token (>= 1000 or first numeric token)
  let amount: number | null = null;
  let amountIdx = -1;
  for (let i = 0; i < workTokens.length; i++) {
    if (consumedIndices.has(i)) continue;
    const candidate = parseShortAmount(workTokens[i]);
    if (candidate !== null && candidate >= 100) {
      amount = candidate;
      amountIdx = i;
      consumedIndices.add(i);
      break;
    }
  }

  if (amount === null || amountIdx === -1) {
    return null;
  }

  const titleParts = workTokens.filter((_, i) => !consumedIndices.has(i));
  const title =
    titleParts.length > 0
      ? titleParts
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : instrument === "CREDIT_CARD"
        ? "Quick Card Charge"
        : instrument === "SPINJAM"
          ? "Quick Loan Entry"
          : "Quick PayLater Entry";

  if (isAfford) {
    return {
      kind: "SIMULATE_AFFORD",
      instrument: instrument ?? "SPAYLATER",
      title,
      amount,
      tenorMonths,
      purchaseDateIso,
      rawInput: trimmed,
    };
  }

  return {
    kind: "ADD_LIABILITY",
    instrument: instrument!,
    title,
    amount,
    tenorMonths,
    purchaseDateIso,
    rawInput: trimmed,
  };
}
