import { buildEmailMastheadRowHtml } from '../email/smtp-transport.util';

export const DEFAULT_KILL_SWITCH_MESSAGE_TEMPLATE =
  'Notice: Promotional pricing for {{name}} expires on {{deadline}} ({{daysLeft}} remaining). To avoid automatic renewal at the standard rate of Rp {{normalPrice}}/month, cancel through your provider portal prior to cutoff: {{cancelUrl}}';

export interface KillSwitchMessagePayload {
  name: string;
  deadline: string; // YYYY-MM-DD
  daysLeft: number;
  normalPrice: number;
  cancelUrl?: string | null;
  currentPrice?: number | null;
}

export function formatKillSwitchEmailSubject(
  label: string,
  deadline: string,
): string {
  return `[Action Required] Subscription Cancellation Notice: ${label} (Deadline ${deadline})`;
}

export function formatKillSwitchReminderMessage(
  template: string | null | undefined,
  payload: KillSwitchMessagePayload,
): string {
  const trimmed = template?.trim() ?? '';
  const isLegacyInformal =
    trimmed.length === 0 || trimmed.toLowerCase().startsWith('woi gab');
  const tpl = isLegacyInformal ? DEFAULT_KILL_SWITCH_MESSAGE_TEMPLATE : trimmed;

  const daysText =
    payload.daysLeft < 0
      ? `${Math.abs(payload.daysLeft)} day${Math.abs(payload.daysLeft) === 1 ? '' : 's'} overdue`
      : payload.daysLeft === 0
        ? 'due today (0 days)'
        : `${payload.daysLeft} day${payload.daysLeft === 1 ? '' : 's'}`;
  const formattedNormal = Math.round(payload.normalPrice).toLocaleString('id-ID');
  const formattedCurrent = Math.round(payload.currentPrice ?? 0).toLocaleString('id-ID');
  const cancelUrl = payload.cancelUrl || 'Provider Account Settings';

  return tpl
    .replace(/\{\{\s*name\s*\}\}/g, payload.name)
    .replace(/\{\{\s*deadline\s*\}\}/g, payload.deadline)
    .replace(/\{\{\s*daysLeft\s*\}\}/g, daysText)
    .replace(/\{\{\s*normalPrice\s*\}\}/g, formattedNormal)
    .replace(/\{\{\s*cancelUrl\s*\}\}/g, cancelUrl)
    .replace(/\{\{\s*currentPrice\s*\}\}/g, formattedCurrent);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildKillSwitchEmailHtml(params: {
  name: string;
  deadline: string;
  daysLeft: number;
  currentPrice: number;
  normalPrice: number;
  cancelUrl?: string | null;
  plainMessage: string;
  recipientEmail: string;
}): string {
  const formattedCurrent = `Rp ${Math.round(params.currentPrice).toLocaleString('id-ID')}`;
  const formattedNormal = `Rp ${Math.round(params.normalPrice).toLocaleString('id-ID')}`;
  const isCritical = params.daysLeft <= 7;
  const accentColor = isCritical ? '#B91C1C' : '#B45309';
  const badgeBg = isCritical ? '#FEF2F2' : '#FFFBEB';
  const badgeBorder = isCritical ? '#FECACA' : '#FDE68A';
  const statusText =
    params.daysLeft < 0
      ? `${Math.abs(params.daysLeft)} day(s) overdue`
      : params.daysLeft === 0
        ? 'Due today'
        : `${params.daysLeft} day(s) remaining`;

  const actionButtonHtml = params.cancelUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 4px 0;">
        <tr>
          <td align="center" style="border-radius:6px;background-color:#0F172A;">
            <a href="${escapeHtml(params.cancelUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:6px;">Open Provider Portal</a>
          </td>
        </tr>
      </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(params.name)} Cancellation Notice</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;color:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F5F9;">
    <tr>
      <td align="center" style="padding:32px 16px 40px 16px;">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:10px;border-collapse:separate;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px 20px 28px;border-bottom:1px solid #E2E8F0;background-color:#FFFFFF;">
              ${buildEmailMastheadRowHtml({
                kicker: 'SUNDAY FUNDAY ERP · SUBSCRIPTION NOTICE',
                accentColor,
                rightBadgeHtml: `<span style="display:inline-block;padding:3px 9px;border-radius:999px;background-color:${badgeBg};border:1px solid ${badgeBorder};font-size:11px;font-weight:600;color:${accentColor};">${escapeHtml(statusText)}</span>`,
              })}
              <h1 style="margin:14px 0 6px 0;font-size:20px;line-height:1.3;font-weight:700;color:#0F172A;letter-spacing:-0.01em;">Cancellation Deadline: ${escapeHtml(params.name)}</h1>
              <div style="font-size:13px;line-height:1.5;color:#475569;">Scheduled cutoff date <strong style="color:#0F172A;">${escapeHtml(params.deadline)}</strong> · Asia/Jakarta (WIB)</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;font-size:14px;line-height:1.65;color:#334155;background-color:#FFFFFF;">
              <p style="margin:0 0 18px 0;color:#334155;">${escapeHtml(params.plainMessage)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">
                <tr>
                  <td style="padding:11px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;">Current Promotional Charge</td>
                  <td style="padding:11px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;">${escapeHtml(formattedCurrent)}/mo</td>
                </tr>
                <tr>
                  <td style="padding:11px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;">Standard Post-Promo Renewal</td>
                  <td style="padding:11px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:700;color:#B91C1C;">${escapeHtml(formattedNormal)}/mo</td>
                </tr>
                <tr>
                  <td style="padding:11px 14px;font-size:13px;color:#475569;">Cancellation Portal</td>
                  <td style="padding:11px 14px;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:12px;color:#0F172A;">${params.cancelUrl ? `<a href="${escapeHtml(params.cancelUrl)}" target="_blank" rel="noopener noreferrer" style="color:#0F766E;text-decoration:underline;">${escapeHtml(params.cancelUrl)}</a>` : 'Not Specified'}</td>
                </tr>
              </table>
              ${actionButtonHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;border-top:1px solid #E2E8F0;background-color:#F8FAFC;font-size:12px;line-height:1.65;color:#64748B;">
              Delivered to <strong style="color:#334155;">${escapeHtml(params.recipientEmail)}</strong> from Sunday Funday ERP &lt;sundayfundayerp@gmail.com&gt; · Asia/Jakarta (WIB)
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
