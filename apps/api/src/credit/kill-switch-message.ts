export const DEFAULT_KILL_SWITCH_MESSAGE_TEMPLATE =
  'Woi Gab, inget batalin langganan {{name}} sebelum {{deadline}} ({{daysLeft}} hari lagi) biar CC lu ga ke-charge normal Rp {{normalPrice}}/bln! Langsung klik cancel sekarang di: {{cancelUrl}}';

export interface KillSwitchMessagePayload {
  name: string;
  deadline: string; // YYYY-MM-DD
  daysLeft: number;
  normalPrice: number;
  cancelUrl?: string | null;
  currentPrice?: number | null;
}

export function formatKillSwitchReminderMessage(
  template: string | null | undefined,
  payload: KillSwitchMessagePayload,
): string {
  const tpl =
    template && template.trim().length > 0
      ? template.trim()
      : DEFAULT_KILL_SWITCH_MESSAGE_TEMPLATE;

  const daysText = payload.daysLeft <= 0 ? 'HARI INI' : `${payload.daysLeft}`;
  const formattedNormal = Math.round(payload.normalPrice).toLocaleString('id-ID');
  const formattedCurrent = Math.round(payload.currentPrice ?? 0).toLocaleString('id-ID');
  const cancelUrl = payload.cancelUrl || 'Settings Provider';

  return tpl
    .replace(/\{\{\s*name\s*\}\}/g, payload.name)
    .replace(/\{\{\s*deadline\s*\}\}/g, payload.deadline)
    .replace(/\{\{\s*daysLeft\s*\}\}/g, daysText)
    .replace(/\{\{\s*normalPrice\s*\}\}/g, formattedNormal)
    .replace(/\{\{\s*cancelUrl\s*\}\}/g, cancelUrl)
    .replace(/\{\{\s*currentPrice\s*\}\}/g, formattedCurrent);
}
