import nodemailer, { SendMailOptions } from 'nodemailer';

export const PLATFORM_EMAIL_FROM = `"Sunday Funday ERP" <sundayfundayerp@gmail.com>`;
export const PLATFORM_EMAIL_REPLY_TO = `"Sunday Funday ERP" <sundayfundayerp@gmail.com>`;
export const BRAND_MARK_IMAGE_URL = `${(process.env.WEB_PUBLIC_URL || 'https://sundayfunday-erp.vercel.app').replace(/\/$/, '')}/brand-mark.png`;

function escapeMastheadHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders the shared table-based email masthead pairing the hosted 96x96
 * rasterized BrandMark emblem (matching BrandMark.tsx / icon.svg across Gmail
 * Desktop, Mobile, and the in-app Preview HTML iframe) with an uppercase kicker.
 */
export function buildEmailMastheadRowHtml(params: {
  kicker: string;
  accentColor: string;
  rightBadgeHtml?: string;
}): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="vertical-align:middle;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;padding-right:10px;">
            <img src="${BRAND_MARK_IMAGE_URL}" width="26" height="26" alt="SF" style="display:block;width:26px;height:26px;border-radius:6px;border:0;outline:none;text-decoration:none;background-color:#11141c;color:#10b78d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:10px;font-weight:700;line-height:26px;text-align:center;" />
          </td>
          <td style="vertical-align:middle;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${params.accentColor};">${escapeMastheadHtml(params.kicker)}</td>
        </tr>
      </table>
    </td>${
      params.rightBadgeHtml
        ? `\n    <td align="right" style="vertical-align:middle;">${params.rightBadgeHtml}</td>`
        : ''
    }
  </tr>
</table>`;
}

export function isSyntheticProbeIdentifier(identifier?: string | null): boolean {
  const normalized = String(identifier ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.startsWith('nonexistent-pentest-target-') ||
    normalized.startsWith('e2e-probe-') ||
    normalized.startsWith('pentest-') ||
    normalized.includes('nonexistent-pentest-target')
  );
}

export interface SmtpTransportConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export type SmtpErrorCategory =
  | 'AUTH_CREDENTIALS'
  | 'AUTH_SECURITY'
  | 'NETWORK_TIMEOUT'
  | 'TLS_HANDSHAKE'
  | 'RECIPIENT_REJECTED'
  | 'SMTP_ERROR';

export interface ClassifiedSmtpError {
  errorCode: string;
  category: SmtpErrorCategory;
  smtpResponseCode?: number;
  summary: string;
  guidance: string;
  retryableWithStartTls: boolean;
  host: string;
  port: number;
}

export interface SmtpVerificationOutcome {
  ok: boolean;
  host: string;
  port: number;
  secure: boolean;
  fallbackUsed: boolean;
  verifiedAtIso: string;
  errorCode?: string;
  summary?: string;
  guidance?: string;
}

export interface SmtpSendOutcome {
  ok: boolean;
  messageId?: string;
  host: string;
  port: number;
  secure: boolean;
  fallbackUsed: boolean;
  errorCode?: string;
  summary?: string;
  guidance?: string;
}

const SMTP_TIMEOUTS = {
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 12000,
};

export function normalizeSmtpAppPassword(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/\s+/g, '')
    .trim();
}

export function sanitizeSmtpMessage(raw: unknown): string {
  const str = String(raw ?? '')
    .replace(/AUTH\s+(?:PLAIN|LOGIN)\s+[A-Za-z0-9+/=]+/gi, 'AUTH [REDACTED]')
    .replace(/\s+/g, ' ')
    .trim();
  return str.length > 360 ? `${str.slice(0, 357)}...` : str;
}

export function buildSmtpTransportConfig(params: {
  host?: string | null;
  port?: number | string | null;
  user?: string | null;
  pass?: string | null;
}): SmtpTransportConfig {
  const host = (params.host || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const parsedPort = Number(params.port ?? process.env.SMTP_PORT ?? 465);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? Math.trunc(parsedPort) : 465;
  const user = (params.user || process.env.SMTP_USER || '').trim();
  const pass = normalizeSmtpAppPassword(params.pass ?? process.env.SMTP_PASS);

  return {
    host,
    port,
    secure: port === 465,
    user,
    pass,
  };
}

export function classifySmtpError(
  err: unknown,
  cfg: Pick<SmtpTransportConfig, 'host' | 'port' | 'user'>,
): ClassifiedSmtpError {
  const record = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code.toUpperCase() : '';
  const responseCode =
    typeof record.responseCode === 'number' && Number.isFinite(record.responseCode)
      ? record.responseCode
      : undefined;
  const rawMessage = sanitizeSmtpMessage(
    [record.message, record.response].filter(Boolean).join(' '),
  );
  const senderLabel = cfg.user || '(unset)';

  if (
    responseCode === 535 ||
    /535[- ]5\.7\.8|BadCredentials|Username and Password not accepted|Invalid login/i.test(
      rawMessage,
    )
  ) {
    return {
      errorCode: 'SMTP_AUTH_FAILED',
      category: 'AUTH_CREDENTIALS',
      smtpResponseCode: responseCode ?? 535,
      summary: `SMTP authentication failed (535) for sender "${senderLabel}" on ${cfg.host}:${cfg.port}.`,
      guidance:
        'Google rejected the sender address or 16-digit App Password. Confirm "SMTP Sender Account" matches the exact Google account that generated the App Password (enter your personal Gmail here if created under it; Target Recipient can remain separate), or generate a fresh 16-digit App Password and save again.',
      retryableWithStartTls: false,
      host: cfg.host,
      port: cfg.port,
    };
  }

  if (
    responseCode === 534 ||
    /534[- ]5\.7\.(9|14)|Application-specific password required|WebLoginRequired|InvalidSecondFactor/i.test(
      rawMessage,
    )
  ) {
    return {
      errorCode: 'SMTP_SECURITY_CHALLENGE',
      category: 'AUTH_SECURITY',
      smtpResponseCode: responseCode ?? 534,
      summary: `Google SMTP rejected standard login (${responseCode ?? 534}) for sender "${senderLabel}".`,
      guidance:
        'Enable 2-Step Verification on the Gmail sender account and use a 16-digit Google App Password rather than a normal Gmail password.',
      retryableWithStartTls: false,
      host: cfg.host,
      port: cfg.port,
    };
  }

  if (
    ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ESOCKET', 'ENOTFOUND', 'EHOSTUNREACH'].includes(
      code,
    ) ||
    /ETIMEDOUT|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENOTFOUND|ESOCKET|Greeting never received|Connection timeout/i.test(
      rawMessage,
    )
  ) {
    return {
      errorCode: 'SMTP_CONNECTION_FAILED',
      category: 'NETWORK_TIMEOUT',
      smtpResponseCode: responseCode,
      summary: `Unable to reach SMTP server ${cfg.host}:${cfg.port} (${code || 'network timeout'}).`,
      guidance: `Check SMTP host (${cfg.host}) and port (${cfg.port}). If implicit TLS on port 465 is blocked, port 587 with STARTTLS is recommended.`,
      retryableWithStartTls: cfg.port === 465,
      host: cfg.host,
      port: cfg.port,
    };
  }

  if (
    /SELF_SIGNED_CERT|DEPTH_ZERO_SELF_SIGNED_CERT|CERT_|SSL|TLS|wrong version number|handshake/i.test(
      rawMessage,
    )
  ) {
    return {
      errorCode: 'SMTP_TLS_ERROR',
      category: 'TLS_HANDSHAKE',
      smtpResponseCode: responseCode,
      summary: `TLS/SSL negotiation failed on ${cfg.host}:${cfg.port}.`,
      guidance:
        'Port 465 requires implicit SSL/TLS and port 587 requires STARTTLS. Verify host and port pairing.',
      retryableWithStartTls: cfg.port === 465,
      host: cfg.host,
      port: cfg.port,
    };
  }

  if (
    (responseCode !== undefined && [550, 551, 552, 553, 554].includes(responseCode)) ||
    code === 'EENVELOPE' ||
    /NoSuchUser|recipient address rejected|550[- ]5\.1\.1/i.test(rawMessage)
  ) {
    return {
      errorCode: 'SMTP_RECIPIENT_REJECTED',
      category: 'RECIPIENT_REJECTED',
      smtpResponseCode: responseCode,
      summary: `Mail server rejected recipient or envelope (${responseCode ?? code ?? 'EENVELOPE'}).`,
      guidance:
        'Confirm the Target Recipient Email address is spelled accurately and able to receive messages.',
      retryableWithStartTls: false,
      host: cfg.host,
      port: cfg.port,
    };
  }

  return {
    errorCode: 'SMTP_DELIVERY_FAILED',
    category: 'SMTP_ERROR',
    smtpResponseCode: responseCode,
    summary: `SMTP request failed on ${cfg.host}:${cfg.port}: ${rawMessage || 'Unknown SMTP error.'}`,
    guidance:
      'Review SMTP Sender Account, 16-digit App Password, and recipient address in Preferences, or switch to Dry-Run Mode.',
    retryableWithStartTls: false,
    host: cfg.host,
    port: cfg.port,
  };
}

export function createNodemailerTransport(cfg: SmtpTransportConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    ...(cfg.port === 587 ? { requireTLS: true } : {}),
    ...SMTP_TIMEOUTS,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  });
}

function buildStartTlsFallback(cfg: SmtpTransportConfig): SmtpTransportConfig {
  return {
    ...cfg,
    port: 587,
    secure: false,
  };
}

export async function verifySmtpConnection(
  cfg: SmtpTransportConfig,
): Promise<SmtpVerificationOutcome> {
  const verifiedAtIso = new Date().toISOString();

  if (!cfg.user || !cfg.pass) {
    return {
      ok: false,
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      fallbackUsed: false,
      verifiedAtIso,
      errorCode: 'SMTP_UNCONFIGURED',
      summary: 'SMTP sender account or 16-digit App Password is not configured.',
      guidance: 'Enter an SMTP sender account and 16-digit App Password to verify live delivery.',
    };
  }

  try {
    const transporter = createNodemailerTransport(cfg);
    await transporter.verify();
    return {
      ok: true,
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      fallbackUsed: false,
      verifiedAtIso,
    };
  } catch (primaryErr) {
    const primaryClassified = classifySmtpError(primaryErr, cfg);
    if (primaryClassified.retryableWithStartTls && cfg.port === 465) {
      const fallbackCfg = buildStartTlsFallback(cfg);
      try {
        const fallbackTransporter = createNodemailerTransport(fallbackCfg);
        await fallbackTransporter.verify();
        return {
          ok: true,
          host: fallbackCfg.host,
          port: fallbackCfg.port,
          secure: fallbackCfg.secure,
          fallbackUsed: true,
          verifiedAtIso: new Date().toISOString(),
        };
      } catch (fallbackErr) {
        const fallbackClassified = classifySmtpError(fallbackErr, fallbackCfg);
        return {
          ok: false,
          host: fallbackCfg.host,
          port: fallbackCfg.port,
          secure: fallbackCfg.secure,
          fallbackUsed: true,
          verifiedAtIso: new Date().toISOString(),
          errorCode: fallbackClassified.errorCode,
          summary: fallbackClassified.summary,
          guidance: fallbackClassified.guidance,
        };
      }
    }

    return {
      ok: false,
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      fallbackUsed: false,
      verifiedAtIso,
      errorCode: primaryClassified.errorCode,
      summary: primaryClassified.summary,
      guidance: primaryClassified.guidance,
    };
  }
}

export async function sendSmtpMailWithFallback(
  cfg: SmtpTransportConfig,
  mailOptions: SendMailOptions,
): Promise<SmtpSendOutcome> {
  if (!cfg.user || !cfg.pass) {
    return {
      ok: false,
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      fallbackUsed: false,
      errorCode: 'SMTP_UNCONFIGURED',
      summary: 'SMTP sender account or 16-digit App Password is not configured.',
      guidance: 'Configure your SMTP sender and App Password or trigger Dry-Run Preview Mode.',
    };
  }

  try {
    const transporter = createNodemailerTransport(cfg);
    const info = await transporter.sendMail(mailOptions);
    return {
      ok: true,
      messageId: info.messageId,
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      fallbackUsed: false,
    };
  } catch (primaryErr) {
    const primaryClassified = classifySmtpError(primaryErr, cfg);
    if (primaryClassified.retryableWithStartTls && cfg.port === 465) {
      const fallbackCfg = buildStartTlsFallback(cfg);
      try {
        const fallbackTransporter = createNodemailerTransport(fallbackCfg);
        const info = await fallbackTransporter.sendMail(mailOptions);
        return {
          ok: true,
          messageId: info.messageId,
          host: fallbackCfg.host,
          port: fallbackCfg.port,
          secure: fallbackCfg.secure,
          fallbackUsed: true,
        };
      } catch (fallbackErr) {
        const fallbackClassified = classifySmtpError(fallbackErr, fallbackCfg);
        return {
          ok: false,
          host: fallbackCfg.host,
          port: fallbackCfg.port,
          secure: fallbackCfg.secure,
          fallbackUsed: true,
          errorCode: fallbackClassified.errorCode,
          summary: fallbackClassified.summary,
          guidance: fallbackClassified.guidance,
        };
      }
    }

    return {
      ok: false,
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      fallbackUsed: false,
      errorCode: primaryClassified.errorCode,
      summary: primaryClassified.summary,
      guidance: primaryClassified.guidance,
    };
  }
}
