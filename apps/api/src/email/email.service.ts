import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import type { SendMailOptions } from 'nodemailer';
import { AuditCategory, AuditSeverity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ReportsSelectors } from '../reports/reports.selectors';
import { CreditSelectors } from '../credit/credit.selectors';
import {
  CC_CUTOFF_DAY,
  CC_DUE_DAY,
  ERP_NOTIFICATION_EMAIL,
  PERSONAL_DEBT_DUE_DAY,
  SPAYLATER_DUE_DAY,
  getJakartaDateParts,
  getPayrollPeriodForDate,
  getSpaylaterCutoffDay,
} from '../calculator/pacing';
import { resolveCutoffDayForMonthTs } from '../calculator/formula-dsl';
import { resolveStudioConfig } from '../config/studio.defaults';
import { generateExecutiveWorkbookBuffer } from './email.workbook';
import {
  buildKillSwitchEmailHtml,
  formatKillSwitchEmailSubject,
  formatKillSwitchReminderMessage,
} from '../credit/kill-switch-message';
import {
  PLATFORM_EMAIL_FROM,
  PLATFORM_EMAIL_REPLY_TO,
  SmtpSendOutcome,
  SmtpTransportConfig,
  SmtpVerificationOutcome,
  buildEmailMastheadRowHtml,
  buildSmtpTransportConfig,
  isSyntheticProbeIdentifier,
  sendSmtpMailWithFallback,
  verifySmtpConnection,
} from './smtp-transport.util';

export type EmailLocale = 'EN' | 'ID' | 'ZH';

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface EmailDispatchResult {
  status: 'SENT' | 'DRY_RUN_PREVIEW';
  configured: boolean;
  verified?: boolean;
  fallbackUsed?: boolean;
  host?: string;
  port?: number;
  recipientEmail: string;
  locale: EmailLocale;
  subject: string;
  messageId: string | null;
  attachmentNames: string[];
  attachmentSizesBytes: number[];
  checksumSha256?: string;
  htmlPreview: string;
  sentAtIso: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRp(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return amount < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

function daysUntilJakartaDay(targetDay: number): number {
  const jkt = getJakartaDateParts();
  const todayUtc = Date.UTC(jkt.year, jkt.month - 1, jkt.day);
  let targetUtc = Date.UTC(jkt.year, jkt.month - 1, targetDay);
  if (targetUtc < todayUtc) {
    targetUtc = Date.UTC(jkt.year, jkt.month, targetDay);
  }
  return Math.max(0, Math.round((targetUtc - todayUtc) / 86400000));
}

function wrapCorporateHtml(params: {
  kicker: string;
  title: string;
  subtitle: string;
  bodyHtml: string;
  footerNote: string;
  accentColor?: string;
}): string {
  const accent = params.accentColor || '#0F766E';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;color:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F5F9;">
    <tr>
      <td align="center" style="padding:32px 16px 40px 16px;">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:10px;border-collapse:separate;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px 20px 28px;border-bottom:1px solid #E2E8F0;background-color:#FFFFFF;">
              ${buildEmailMastheadRowHtml({ kicker: params.kicker, accentColor: accent })}
              <h1 style="margin:14px 0 6px 0;font-size:21px;line-height:1.3;font-weight:700;color:#0F172A;letter-spacing:-0.015em;">${escapeHtml(params.title)}</h1>
              <div style="font-size:13px;line-height:1.5;color:#475569;">${escapeHtml(params.subtitle)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;font-size:14px;line-height:1.65;color:#334155;background-color:#FFFFFF;">
              ${params.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;border-top:1px solid #E2E8F0;background-color:#F8FAFC;font-size:12px;line-height:1.65;color:#64748B;">
              ${escapeHtml(params.footerNote)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const STATEMENT_COPY: Record<
  EmailLocale,
  {
    kicker: string;
    titlePrefix: string;
    intro: string;
    mIncome: string;
    mDebt: string;
    mRoutine: string;
    mDailyOps: string;
    mRemaining: string;
    mP1: string;
    mP2: string;
    mDeficit: string;
    mDailyLimit: string;
    mScore: string;
    attachedNote: string;
  }
> = {
  EN: {
    kicker: 'SUNDAY FUNDAY ERP · EXECUTIVE STATEMENT',
    titlePrefix: 'Monthly Financial Statement',
    intro: 'Automated payroll waterfall closing summary and 4-sheet Excel ledger statement attached.',
    mIncome: 'Total Money In (Net + Extra)',
    mDebt: 'Total Debt & Bills (Tier 1)',
    mRoutine: 'Fixed Routine Pool',
    mDailyOps: 'Daily Operational Target',
    mRemaining: 'Remaining Living Cash',
    mP1: 'Core Savings (P1)',
    mP2: 'Self-Reward (P2)',
    mDeficit: 'Deficit Uncovered',
    mDailyLimit: 'Safe-to-Spend Daily Limit',
    mScore: 'Discipline Score',
    attachedNote: 'Attachment: 4-Sheet Executive Workbook (.xlsx)',
  },
  ID: {
    kicker: 'SUNDAY FUNDAY ERP · LAPORAN EKSEKUTIF',
    titlePrefix: 'Laporan Keuangan Bulanan',
    intro: 'Ringkasan alokasi waterfall gaji dan file Excel 4-sheet terlampir pada email ini.',
    mIncome: 'Total Pemasukan Bersih',
    mDebt: 'Total Tagihan & Cicilan (Tier 1)',
    mRoutine: 'Pool Kebutuhan Rutin',
    mDailyOps: 'Alokasi Biaya Harian',
    mRemaining: 'Sisa Kas Hidup Tersedia',
    mP1: 'Tabungan Inti (P1)',
    mP2: 'Self-Reward (P2)',
    mDeficit: 'Defisit Tidak Tertutup',
    mDailyLimit: 'Batas Aman Harian',
    mScore: 'Skor Disiplin',
    attachedNote: 'Lampiran: Workbook Eksekutif 4-Sheet (.xlsx)',
  },
  ZH: {
    kicker: 'SUNDAY FUNDAY ERP · 财务月结报告',
    titlePrefix: '月度财务结算报表',
    intro: '以下是薪资瀑布流分配摘要及随附的 4 表联动 Excel 账本。',
    mIncome: '净收入合计',
    mDebt: '债务与账单总额 (第一顺位)',
    mRoutine: '固定日常预算池',
    mDailyOps: '每日生活预算总额',
    mRemaining: '剩余可用生活现金',
    mP1: '核心储蓄 (P1)',
    mP2: '自我奖励 (P2)',
    mDeficit: '未覆盖赤字',
    mDailyLimit: '今日安全消费限额',
    mScore: '纪律评分',
    attachedNote: '附件：4 页管理层财务报表 (.xlsx)',
  },
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly reportsSelectors: ReportsSelectors,
    private readonly creditSelectors: CreditSelectors,
  ) {}

  protected verifySmtpTransport(cfg: SmtpTransportConfig): Promise<SmtpVerificationOutcome> {
    return verifySmtpConnection(cfg);
  }

  protected sendSmtpMail(
    cfg: SmtpTransportConfig,
    mailOptions: SendMailOptions,
  ): Promise<SmtpSendOutcome> {
    return sendSmtpMailWithFallback(cfg, mailOptions);
  }

  private async resolveTransportConfig(
    userId: number,
    overrideRecipient?: string,
  ): Promise<{
    recipientEmail: string;
    configuredRecipient: string;
    profileEmail: string | null;
    smtpUser: string;
    smtpPass: string | null;
    host: string;
    port: number;
    secure: boolean;
  }> {
    const [config, user] = await Promise.all([
      this.prisma.globalConfig.findFirst({ where: { userId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, fullName: true },
      }),
    ]);
    const profileEmail = user?.email?.trim() || null;
    const configuredRecipient =
      profileEmail ||
      config?.killSwitchNotifyEmail?.trim() ||
      process.env.ERP_NOTIFICATION_EMAIL?.trim() ||
      ERP_NOTIFICATION_EMAIL;
    const recipientEmail = overrideRecipient?.trim() || configuredRecipient;
    const built = buildSmtpTransportConfig({
      user: config?.killSwitchSmtpUser?.trim() || process.env.SMTP_USER?.trim() || ERP_NOTIFICATION_EMAIL,
      pass: config?.killSwitchSmtpAppPassword ?? process.env.SMTP_PASS,
    });
    const smtpPass = built.pass.length > 0 ? built.pass : null;

    return {
      recipientEmail,
      configuredRecipient,
      profileEmail,
      smtpUser: built.user,
      smtpPass,
      host: built.host,
      port: built.port,
      secure: built.secure,
    };
  }

  private async dispatchEmail(params: {
    userId: number;
    recipientEmail: string;
    smtpUser: string;
    smtpPass: string | null;
    host?: string;
    port?: number;
    secure?: boolean;
    previewOnly?: boolean;
    dryRun?: boolean;
    locale: EmailLocale;
    subject: string;
    html: string;
    textFallback: string;
    attachments?: EmailAttachment[];
    auditAction: string;
    auditSummary: string;
    checksumSha256?: string;
    month?: number;
    year?: number;
    severity?: AuditSeverity;
  }): Promise<EmailDispatchResult> {
    const attachments = params.attachments ?? [];
    const attachmentNames = attachments.map((a) => a.filename);
    const attachmentSizesBytes = attachments.map((a) => a.content.byteLength);
    const sentAtIso = new Date().toISOString();

    let status: 'SENT' | 'DRY_RUN_PREVIEW' = 'DRY_RUN_PREVIEW';
    let messageId: string | null = null;
    let fallbackUsed = false;
    const configured = Boolean(params.smtpUser && params.smtpPass);
    const effectiveDryRun = Boolean(params.previewOnly || params.dryRun);
    const built = buildSmtpTransportConfig({
      host: params.host,
      port: params.port,
      user: params.smtpUser,
      pass: params.smtpPass,
    });
    let usedHost = built.host;
    let usedPort = built.port;

    if (!effectiveDryRun && configured && params.smtpPass) {
      const outcome = await this.sendSmtpMail(
        {
          ...built,
          secure: params.secure ?? built.secure,
        },
        {
          from: PLATFORM_EMAIL_FROM,
          replyTo: PLATFORM_EMAIL_REPLY_TO,
          to: params.recipientEmail,
          subject: params.subject,
          text: params.textFallback,
          html: params.html,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          })),
        },
      );

      usedHost = outcome.host;
      usedPort = outcome.port;
      fallbackUsed = outcome.fallbackUsed;

      if (!outcome.ok) {
        await this.auditLogService
          .record({
            category: AuditCategory.SETTINGS,
            action: `${params.auditAction}_FAILED`,
            severity: AuditSeverity.WARNING,
            month: params.month ?? null,
            year: params.year ?? null,
            summary: `${params.auditSummary} -> ${params.recipientEmail} [${outcome.errorCode || 'SMTP_DELIVERY_FAILED'}]`,
            details: JSON.stringify({
              errorCode: outcome.errorCode,
              host: outcome.host,
              port: outcome.port,
              fallbackUsed: outcome.fallbackUsed,
              smtpUser: built.user,
              recipientEmail: params.recipientEmail,
              locale: params.locale,
              attachmentNames,
              summary: outcome.summary,
            }),
          })
          .catch((err) => {
            this.logger.warn(`Failed to write failure audit log for ${params.auditAction}: ${err?.message}`);
          });

        throw new UnprocessableEntityException({
          errorCode: outcome.errorCode || 'SMTP_DELIVERY_FAILED',
          message: [outcome.summary, outcome.guidance].filter(Boolean).join(' '),
          guidance: outcome.guidance,
          host: outcome.host,
          port: outcome.port,
          smtpUser: built.user,
        });
      }

      status = 'SENT';
      messageId = outcome.messageId || null;
    }

    if (!params.previewOnly) {
      await this.auditLogService
        .record({
          category: AuditCategory.SETTINGS,
          action: params.auditAction,
          severity: params.severity ?? AuditSeverity.INFO,
          month: params.month ?? null,
          year: params.year ?? null,
          summary: `${params.auditSummary} -> ${params.recipientEmail} [${status}]`,
          details: JSON.stringify({
            status,
            configured,
            dryRun: effectiveDryRun,
            fallbackUsed,
            host: usedHost,
            port: usedPort,
            recipientEmail: params.recipientEmail,
            locale: params.locale,
            attachmentNames,
            attachmentSizesBytes,
            checksumSha256: params.checksumSha256,
            messageId,
          }),
        })
        .catch((err) => {
          this.logger.warn(`Failed to write audit log for ${params.auditAction}: ${err?.message}`);
        });
    }

    return {
      status,
      configured,
      verified: status === 'SENT' ? true : undefined,
      fallbackUsed,
      host: usedHost,
      port: usedPort,
      recipientEmail: params.recipientEmail,
      locale: params.locale,
      subject: params.subject,
      messageId,
      attachmentNames,
      attachmentSizesBytes,
      checksumSha256: params.checksumSha256,
      htmlPreview: params.html,
      sentAtIso,
    };
  }

  async getStatus(userId: number) {
    const cfg = await this.resolveTransportConfig(userId);
    const configured = Boolean(cfg.smtpUser && cfg.smtpPass);

    if (!configured || !cfg.smtpPass) {
      return {
        mode: 'DRY_RUN_PREVIEW' as const,
        configured: false,
        verified: false,
        verificationStatus: 'UNCONFIGURED' as const,
        verifiedAtIso: null,
        fallbackUsed: false,
        errorCode: null,
        verificationError: null,
        verificationGuidance: null,
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        smtpUser: cfg.smtpUser,
        profileEmail: cfg.profileEmail,
        platformFrom: PLATFORM_EMAIL_FROM,
        defaultRecipient: ERP_NOTIFICATION_EMAIL,
        configuredRecipient: cfg.configuredRecipient,
        recipientEmail: cfg.recipientEmail,
        hasSmtpPassword: false,
        hasAppPassword: false,
      };
    }

    const verification = await this.verifySmtpTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      user: cfg.smtpUser,
      pass: cfg.smtpPass,
    });

    return {
      mode: verification.ok ? ('LIVE_SMTP' as const) : ('AUTH_ERROR' as const),
      configured: true,
      verified: verification.ok,
      verificationStatus: verification.ok ? ('VERIFIED' as const) : ('ERROR' as const),
      verifiedAtIso: verification.verifiedAtIso,
      fallbackUsed: verification.fallbackUsed,
      errorCode: verification.errorCode ?? null,
      verificationError: verification.summary ?? null,
      verificationGuidance: verification.guidance ?? null,
      host: verification.host,
      port: verification.port,
      secure: verification.secure,
      smtpUser: cfg.smtpUser,
      profileEmail: cfg.profileEmail,
      platformFrom: PLATFORM_EMAIL_FROM,
      defaultRecipient: ERP_NOTIFICATION_EMAIL,
      configuredRecipient: cfg.configuredRecipient,
      recipientEmail: cfg.recipientEmail,
      hasSmtpPassword: true,
      hasAppPassword: true,
    };
  }

  async verifyConnection(userId: number) {
    const status = await this.getStatus(userId);
    if (status.configured) {
      await this.auditLogService
        .record({
          category: AuditCategory.SETTINGS,
          action: status.verified ? 'SMTP_CONNECTION_VERIFIED' : 'SMTP_CONNECTION_FAILED',
          severity: status.verified ? AuditSeverity.INFO : AuditSeverity.WARNING,
          summary: status.verified
            ? `Verified SMTP handshake for ${status.smtpUser} on ${status.host}:${status.port}`
            : `SMTP handshake failed for ${status.smtpUser}: ${status.verificationError || status.errorCode}`,
          details: JSON.stringify({
            verified: status.verified,
            errorCode: status.errorCode,
            host: status.host,
            port: status.port,
            fallbackUsed: status.fallbackUsed,
            smtpUser: status.smtpUser,
          }),
        })
        .catch(() => {});
    }
    return status;
  }

  async sendMonthlyStatement(params: {
    userId: number;
    month?: number;
    year?: number;
    scope?: 'all' | 'locked';
    locale?: EmailLocale;
    recipientEmail?: string;
    previewOnly?: boolean;
    dryRun?: boolean;
  }): Promise<EmailDispatchResult> {
    const activePeriod = getPayrollPeriodForDate();
    const targetMonth = params.month ?? activePeriod.month;
    const targetYear = params.year ?? activePeriod.year;
    const scope = params.scope ?? 'all';
    const locale: EmailLocale = params.locale ?? 'EN';

    const [transport, report] = await Promise.all([
      this.resolveTransportConfig(params.userId, params.recipientEmail),
      this.reportsSelectors.getExecutiveReport(targetMonth, targetYear, scope, params.userId),
    ]);

    const xlsxBuffer = await generateExecutiveWorkbookBuffer(report);
    const filename = `SundayFunday_Statement_${targetYear}-${String(targetMonth).padStart(2, '0')}.xlsx`;

    const c = STATEMENT_COPY[locale];
    const cs = report.closingStatement;
    const uw = cs.upfrontAndWaterfall;
    const mc = cs.moneyCycle;

    const rows: Array<[string, string, boolean]> = [
      [c.mIncome, formatRp(mc.kpis.totalMoneyIn), false],
      [c.mDebt, formatRp(mc.kpis.totalDebtAndBillsPaid), false],
      [c.mRoutine, formatRp(uw.fixedEssentialsActual), false],
      [c.mDailyOps, formatRp(uw.actualDailyOperational), false],
      [c.mRemaining, formatRp(mc.dailyLiving.remainingOperationalCash), false],
      [c.mP1, formatRp(uw.actualSavings), false],
      [c.mP2, formatRp(uw.actualSelfReward), false],
      [c.mDeficit, formatRp(uw.deficitUncovered), uw.deficitUncovered > 0],
      [c.mDailyLimit, `${formatRp(mc.dailyLiving.safeToSpendToday)}/day`, false],
      [c.mScore, `${cs.governance.disciplineScore}/100`, false],
    ];

    const tableRowsHtml = rows
      .map(([label, val, isUrgent], idx) => {
        const borderStyle = idx < rows.length - 1 ? 'border-bottom:1px solid #E2E8F0;' : '';
        return `
        <tr>
          <td style="padding:10px 14px;${borderStyle}font-size:13px;color:#475569;">${escapeHtml(label)}</td>
          <td style="padding:10px 14px;${borderStyle}text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:${isUrgent ? '#B91C1C' : '#0F172A'};">${escapeHtml(val)}</td>
        </tr>`;
      })
      .join('');

    const bodyHtml = `
      <p style="margin:0 0 18px 0;color:#334155;">${escapeHtml(c.intro)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">
        ${tableRowsHtml}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:16px;border-collapse:collapse;background-color:#F0FDFA;border:1px solid #CCFBF1;border-radius:6px;">
        <tr>
          <td style="padding:10px 14px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:12px;color:#0F766E;">${escapeHtml(c.attachedNote)}: ${escapeHtml(filename)}</td>
        </tr>
      </table>
    `;

    const subject = `[Sunday Funday ERP] ${c.titlePrefix} — ${cs.periodLabel} (${targetMonth}/${targetYear})`;
    const html = wrapCorporateHtml({
      kicker: c.kicker,
      title: `${c.titlePrefix}: ${cs.periodLabel}`,
      subtitle: `${cs.workingDaysWindowLabel} · Status: ${cs.status}`,
      bodyHtml,
      footerNote: `Delivered to ${transport.recipientEmail} from Sunday Funday ERP <sundayfundayerp@gmail.com> · Asia/Jakarta (WIB)`,
      accentColor: '#0F766E',
    });

    return this.dispatchEmail({
      userId: params.userId,
      recipientEmail: transport.recipientEmail,
      smtpUser: transport.smtpUser,
      smtpPass: transport.smtpPass,
      host: transport.host,
      port: transport.port,
      secure: transport.secure,
      previewOnly: params.previewOnly,
      dryRun: params.dryRun,
      locale,
      subject,
      html,
      textFallback: `${subject}\n${rows.map(([l, v]) => `${l}: ${v}`).join('\n')}`,
      attachments: [
        {
          filename,
          content: xlsxBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
      auditAction: 'EMAIL_MONTHLY_STATEMENT',
      auditSummary: `Dispatched ${cs.periodLabel} Executive Statement email`,
      month: targetMonth,
      year: targetYear,
    });
  }

  async sendCutoffDigest(params: {
    userId: number;
    month?: number;
    year?: number;
    locale?: EmailLocale;
    recipientEmail?: string;
    previewOnly?: boolean;
    dryRun?: boolean;
  }): Promise<EmailDispatchResult> {
    const activePeriod = getPayrollPeriodForDate();
    const targetMonth = params.month ?? activePeriod.month;
    const targetYear = params.year ?? activePeriod.year;
    const locale: EmailLocale = params.locale ?? 'EN';
    const jkt = getJakartaDateParts();

    const [transport, matrix, killSwitches, cfgRow] = await Promise.all([
      this.resolveTransportConfig(params.userId, params.recipientEmail),
      this.creditSelectors.getLiabilityMatrix(targetMonth, targetYear, 3, params.userId),
      this.creditSelectors.getKillSwitches(params.userId),
      this.prisma.globalConfig.findFirst({ where: { userId: params.userId } }),
    ]);

    const key = `${targetYear}-${targetMonth}`;
    const lineItems = matrix.lineItemsPerMonth[key] ?? [];
    const unsettled = lineItems.filter((i) => !i.isSettled);
    const activePromos = killSwitches.items.filter((k) => !k.providerCancelConfirmed && k.isActive);

    const studioConfig = resolveStudioConfig(
      params.userId,
      cfgRow?.formulaParamsJson,
      cfgRow,
    );
    const spayInst = studioConfig.instrumentsTable.find(
      (i) => i.active && i.type === 'PAYLATER',
    );
    const ccInst = studioConfig.instrumentsTable.find(
      (i) => i.active && i.type === 'CREDIT_CARD',
    );
    const spayCutoffDay = spayInst
      ? resolveCutoffDayForMonthTs(
          spayInst.cutoffFormula,
          spayInst.cutoffDay || getSpaylaterCutoffDay(jkt.month, jkt.year),
          jkt.day,
          jkt.month,
          jkt.year,
          spayInst.dueDay || SPAYLATER_DUE_DAY,
          studioConfig.paycycleFormulaConfig.paydayAnchorDay,
        ).cutoffDay
      : getSpaylaterCutoffDay(jkt.month, jkt.year);
    const ccCutoffDay = ccInst
      ? resolveCutoffDayForMonthTs(
          ccInst.cutoffFormula,
          ccInst.cutoffDay || CC_CUTOFF_DAY,
          jkt.day,
          jkt.month,
          jkt.year,
          ccInst.dueDay || CC_DUE_DAY,
          studioConfig.paycycleFormulaConfig.paydayAnchorDay,
        ).cutoffDay
      : CC_CUTOFF_DAY;
    const spayDueDayResolved = spayInst?.dueDay || SPAYLATER_DUE_DAY;
    const ccDueDayResolved = ccInst?.dueDay || CC_DUE_DAY;

    const spayCutoffDays = daysUntilJakartaDay(spayCutoffDay);
    const ccCutoffDays = daysUntilJakartaDay(ccCutoffDay);
    const spayDueDays = daysUntilJakartaDay(spayDueDayResolved);
    const ccDueDays = daysUntilJakartaDay(ccDueDayResolved);
    const pDebtDueDays = daysUntilJakartaDay(PERSONAL_DEBT_DUE_DAY);

    const titles: Record<EmailLocale, { kicker: string; title: string; dueHeader: string; emptyUnsettled: string }> = {
      EN: {
        kicker: 'SUNDAY FUNDAY ERP · CUTOFF & DUE-DATE DIGEST',
        title: `Upcoming Cutoffs & Due-Dates (${jkt.isoDate} WIB)`,
        dueHeader: 'Unsettled Itemized Obligations',
        emptyUnsettled: 'All itemized obligations for the current period are settled or auto-paid.',
      },
      ID: {
        kicker: 'SUNDAY FUNDAY ERP · PENGINGAT CUTOFF & JATUH TEMPO',
        title: `Jadwal Cutoff & Jatuh Tempo Terdekat (${jkt.isoDate} WIB)`,
        dueHeader: 'Kewajiban Rinci Belum Lunas',
        emptyUnsettled: 'Seluruh kewajiban periode aktif sudah berstatus lunas / Auto-Paid.',
      },
      ZH: {
        kicker: 'SUNDAY FUNDAY ERP · 账单截数与到期提醒',
        title: `近期截数日与还款到期提醒 (${jkt.isoDate} WIB)`,
        dueHeader: '当前周期未结清明细',
        emptyUnsettled: '当前周期的所有明细账单均已结清或自动记为已付。',
      },
    };

    const copy = titles[locale];

    const scheduleRowsHtml = `
      <tr><td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;">Personal Debt Due (${PERSONAL_DEBT_DUE_DAY}th M+1)</td><td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;">${pDebtDueDays}d</td></tr>
      <tr><td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;">Credit Card Due (${ccDueDayResolved}th M+1)</td><td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;">${ccDueDays}d</td></tr>
      <tr><td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;">SPayLater Cutoff (${spayCutoffDay}th)</td><td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;">${spayCutoffDays}d</td></tr>
      <tr><td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;">Credit Card Statement Cutoff (${ccCutoffDay}th)</td><td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;">${ccCutoffDays}d</td></tr>
      <tr><td style="padding:10px 14px;font-size:13px;color:#475569;">SPayLater / SPinjam Due (${spayDueDayResolved}th)</td><td style="padding:10px 14px;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;">${spayDueDays}d</td></tr>
    `;

    const unsettledHtml =
      unsettled.length === 0
        ? `<p style="margin:8px 0 0 0;font-size:13px;font-weight:600;color:#0F766E;">${escapeHtml(copy.emptyUnsettled)}</p>`
        : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">${unsettled
            .map((u, idx) => {
              const borderStyle =
                idx < unsettled.length - 1 ? 'border-bottom:1px solid #E2E8F0;' : '';
              return `<tr><td style="padding:10px 14px;${borderStyle}font-size:13px;color:#0F172A;">${escapeHtml(u.title)} <span style="color:#64748B;">(${escapeHtml(u.merchantOrPlatform)})</span></td><td style="padding:10px 14px;${borderStyle}text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;">${escapeHtml(formatRp(u.monthlyAmount))} · Due ${escapeHtml(u.dueDateIso)}</td></tr>`;
            })
            .join('')}</table>`;

    const promoHtml =
      activePromos.length > 0
        ? `<h3 style="margin:20px 0 8px 0;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#B45309;">Subscription Kill-Switch Watchlist (${activePromos.length})</h3>
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;">
             ${activePromos
               .map((p, idx) => {
                 const borderStyle =
                   idx < activePromos.length - 1 ? 'border-bottom:1px solid #FDE68A;' : '';
                 return `<tr><td style="padding:9px 14px;${borderStyle}font-size:13px;color:#78350F;">${escapeHtml(p.label)}</td><td style="padding:9px 14px;${borderStyle}text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:12px;font-weight:600;color:#92400E;">${p.daysUntilExpiry !== null ? `${p.daysUntilExpiry}d left` : 'No expiry'} (${escapeHtml(formatRp(p.postPromoNormalAmount ?? p.amount))}/mo)</td></tr>`;
               })
               .join('')}
           </table>`
        : '';

    const html = wrapCorporateHtml({
      kicker: copy.kicker,
      title: copy.title,
      subtitle: `Period ${targetMonth}/${targetYear} · Jakarta Wall-Clock WIB`,
      bodyHtml: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;margin-bottom:18px;">${scheduleRowsHtml}</table>
        <h3 style="margin:18px 0 8px 0;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#475569;">${escapeHtml(copy.dueHeader)} (${unsettled.length})</h3>
        ${unsettledHtml}
        ${promoHtml}
      `,
      footerNote: `Delivered to ${transport.recipientEmail} from Sunday Funday ERP <sundayfundayerp@gmail.com> · Asia/Jakarta (WIB)`,
      accentColor: '#B45309',
    });

    const subject = `[Sunday Funday ERP] ${copy.title}`;
    return this.dispatchEmail({
      userId: params.userId,
      recipientEmail: transport.recipientEmail,
      smtpUser: transport.smtpUser,
      smtpPass: transport.smtpPass,
      host: transport.host,
      port: transport.port,
      secure: transport.secure,
      previewOnly: params.previewOnly,
      dryRun: params.dryRun,
      locale,
      subject,
      html,
      textFallback: `${subject} — Unsettled items: ${unsettled.length}, Promos tracked: ${activePromos.length}`,
      auditAction: 'EMAIL_CUTOFF_DIGEST',
      auditSummary: `Dispatched Cutoff & Due-Date Digest (${unsettled.length} unsettled)`,
      month: targetMonth,
      year: targetYear,
    });
  }

  async sendOffsiteBackup(params: {
    userId: number;
    month?: number;
    year?: number;
    locale?: EmailLocale;
    recipientEmail?: string;
    previewOnly?: boolean;
    dryRun?: boolean;
  }): Promise<EmailDispatchResult> {
    const activePeriod = getPayrollPeriodForDate();
    const targetMonth = params.month ?? activePeriod.month;
    const targetYear = params.year ?? activePeriod.year;
    const locale: EmailLocale = params.locale ?? 'EN';
    const jkt = getJakartaDateParts();

    const [
      transport,
      report,
      userRow,
      config,
      snapshots,
      transactions,
      bulkBills,
      lineItems,
      cards,
      contracts,
      revisions,
      savingsGoals,
    ] = await Promise.all([
      this.resolveTransportConfig(params.userId, params.recipientEmail),
      this.reportsSelectors.getExecutiveReport(targetMonth, targetYear, 'all', params.userId),
      this.prisma.user.findUnique({ where: { id: params.userId } }),
      this.prisma.globalConfig.findFirst({ where: { userId: params.userId } }),
      this.prisma.monthlySnapshot.findMany({ where: { userId: params.userId } }),
      this.prisma.transaction.findMany({ where: { snapshot: { userId: params.userId } } }),
      this.prisma.monthlyBulkBill.findMany({ where: { userId: params.userId } }),
      this.prisma.liabilityLineItem.findMany({ where: { userId: params.userId } }),
      this.prisma.creditCardTransaction.findMany({ where: { userId: params.userId } }),
      this.prisma.creditContract.findMany({}),
      this.prisma.budgetRevision.findMany({ where: { snapshot: { userId: params.userId } } }),
      this.prisma.savingsGoal.findMany({ where: { userId: params.userId } }),
    ]);

    const safeUser = userRow
      ? {
          id: userRow.id,
          username: userRow.username,
          accountName: userRow.accountName,
          fullName: userRow.fullName,
          email: userRow.email,
          role: userRow.role,
          blueprintType: userRow.blueprintType,
        }
      : null;

    const safeConfig = config
      ? {
          ...config,
          killSwitchSmtpAppPassword: config.killSwitchSmtpAppPassword ? '[REDACTED]' : null,
          killSwitchWaApiKey: config.killSwitchWaApiKey ? '[REDACTED]' : null,
        }
      : null;

    const backupPayload = {
      schemaVersion: 'sunday-funday-erp-v2',
      exportedAtWib: `${jkt.isoDate} (Asia/Jakarta)`,
      exportedAtIso: new Date().toISOString(),
      userId: params.userId,
      user: safeUser,
      config: safeConfig,
      counts: {
        snapshots: snapshots.length,
        transactions: transactions.length,
        monthlyBulkBills: bulkBills.length,
        liabilityLineItems: lineItems.length,
        creditCardTransactions: cards.length,
        creditContracts: contracts.length,
        budgetRevisions: revisions.length,
        savingsGoals: savingsGoals.length,
      },
      data: {
        snapshots,
        transactions,
        monthlyBulkBills: bulkBills,
        liabilityLineItems: lineItems,
        creditCardTransactions: cards,
        creditContracts: contracts,
        budgetRevisions: revisions,
        savingsGoals,
      },
    };

    const jsonBuffer = Buffer.from(JSON.stringify(backupPayload, null, 2), 'utf8');
    const checksumSha256 = crypto.createHash('sha256').update(jsonBuffer).digest('hex');
    const xlsxBuffer = await generateExecutiveWorkbookBuffer(report);

    const jsonName = `SundayFunday_Backup_U${params.userId}_${jkt.isoDate}.json`;
    const xlsxName = `SundayFunday_Statement_${targetYear}-${String(targetMonth).padStart(2, '0')}.xlsx`;

    const headers: Record<EmailLocale, { kicker: string; title: string; intro: string }> = {
      EN: {
        kicker: 'SUNDAY FUNDAY ERP · OFF-SITE LEDGER BACKUP',
        title: `Encrypted-Safe Off-Site Ledger Archive (${jkt.isoDate})`,
        intro: 'Full JSON snapshot of live PostgreSQL ledger entities (secrets redacted) and 4-sheet XLSX statement attached.',
      },
      ID: {
        kicker: 'SUNDAY FUNDAY ERP · CADANGAN BUKU BESAR OFF-SITE',
        title: `Arsip Cadangan Ledger Lengkap (${jkt.isoDate})`,
        intro: 'Salinan penuh JSON database PostgreSQL (tanpa password/token sensitif) beserta workbook XLSX 4-sheet terlampir.',
      },
      ZH: {
        kicker: 'SUNDAY FUNDAY ERP · 异地账本备份',
        title: `完整账本异地归档 (${jkt.isoDate})`,
        intro: '随附完整 PostgreSQL 账本 JSON 备份（已脱敏密钥）及 4 页 Excel 报表。',
      },
    };

    const h = headers[locale];
    const html = wrapCorporateHtml({
      kicker: h.kicker,
      title: h.title,
      subtitle: `User #${params.userId} · Checksum ${checksumSha256.slice(0, 16)}...`,
      bodyHtml: `
        <p style="margin:0 0 18px 0;color:#334155;">${escapeHtml(h.intro)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;">Monthly Snapshots</td>
            <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;">${snapshots.length}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;">Ledger Transactions</td>
            <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;">${transactions.length}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;">Monthly Bulk Bills</td>
            <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;">${bulkBills.length}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;">Liability Line Items</td>
            <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;">${lineItems.length}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;">Credit Card Records</td>
            <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;">${cards.length}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-size:13px;color:#475569;">JSON SHA-256</td>
            <td style="padding:10px 14px;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:11px;font-weight:600;color:#0F766E;word-break:break-all;">${checksumSha256}</td>
          </tr>
        </table>
      `,
      footerNote: `Delivered to ${transport.recipientEmail} from Sunday Funday ERP <sundayfundayerp@gmail.com> · ${jsonName} + ${xlsxName}`,
      accentColor: '#0F172A',
    });

    const subject = `[Sunday Funday ERP] Off-Site Ledger Backup — ${jkt.isoDate} WIB`;
    return this.dispatchEmail({
      userId: params.userId,
      recipientEmail: transport.recipientEmail,
      smtpUser: transport.smtpUser,
      smtpPass: transport.smtpPass,
      host: transport.host,
      port: transport.port,
      secure: transport.secure,
      previewOnly: params.previewOnly,
      dryRun: params.dryRun,
      locale,
      subject,
      html,
      textFallback: `${subject}\nSnapshots: ${snapshots.length}\nJSON SHA-256: ${checksumSha256}`,
      attachments: [
        { filename: jsonName, content: jsonBuffer, contentType: 'application/json' },
        {
          filename: xlsxName,
          content: xlsxBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
      checksumSha256,
      auditAction: 'EMAIL_LEDGER_BACKUP',
      auditSummary: `Dispatched off-site JSON+XLSX ledger backup (SHA-256 ${checksumSha256.slice(0, 12)})`,
      month: targetMonth,
      year: targetYear,
    });
  }

  async sendTestEmail(params: {
    userId: number;
    locale?: EmailLocale;
    recipientEmail?: string;
    previewOnly?: boolean;
    dryRun?: boolean;
  }): Promise<EmailDispatchResult> {
    const locale: EmailLocale = params.locale ?? 'EN';
    const jkt = getJakartaDateParts();
    const transport = await this.resolveTransportConfig(params.userId, params.recipientEmail);

    const copy: Record<EmailLocale, { kicker: string; title: string; body: string }> = {
      EN: {
        kicker: 'SUNDAY FUNDAY ERP · SMTP DIAGNOSTIC',
        title: 'Email Notification Channel Verification',
        body: 'Gmail SMTP channel wiring is active for monthly statements, cutoff digests, off-site backups, and security alerts.',
      },
      ID: {
        kicker: 'SUNDAY FUNDAY ERP · VERIFIKASI SMTP',
        title: 'Verifikasi Saluran Notifikasi Email',
        body: 'Konfigurasi saluran email Gmail SMTP aktif untuk laporan bulanan, pengingat jatuh tempo, cadangan ledger, dan peringatan keamanan.',
      },
      ZH: {
        kicker: 'SUNDAY FUNDAY ERP · 邮件通道测试',
        title: 'SMTP 邮件通知通道验证',
        body: 'Gmail SMTP 邮件通道配置成功，可用于发送月度报表、账单提醒、账本备份及安全锁定警报。',
      },
    };
    const c = copy[locale];
    const html = wrapCorporateHtml({
      kicker: c.kicker,
      title: c.title,
      subtitle: `${jkt.isoDate} WIB · Profile Recipient: ${transport.recipientEmail}`,
      bodyHtml: `
        <p style="margin:0 0 18px 0;color:#334155;">${escapeHtml(c.body)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;">Recipient (To)</td>
            <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;">${escapeHtml(transport.recipientEmail)}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;">Platform Sender (From)</td>
            <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F766E;">sundayfundayerp@gmail.com</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-size:13px;color:#475569;">SMTP Auth Account</td>
            <td style="padding:10px 14px;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;color:#475569;">${escapeHtml(transport.smtpUser)} (${escapeHtml(transport.host)}:${transport.port})</td>
          </tr>
        </table>
      `,
      footerNote: `Delivered to ${transport.recipientEmail} from Sunday Funday ERP <sundayfundayerp@gmail.com> · Asia/Jakarta (WIB)`,
      accentColor: '#0F766E',
    });

    return this.dispatchEmail({
      userId: params.userId,
      recipientEmail: transport.recipientEmail,
      smtpUser: transport.smtpUser,
      smtpPass: transport.smtpPass,
      host: transport.host,
      port: transport.port,
      secure: transport.secure,
      previewOnly: params.previewOnly,
      dryRun: params.dryRun,
      locale,
      subject: `[Sunday Funday ERP] ${c.title}`,
      html,
      textFallback: `${c.title}: ${c.body}`,
      auditAction: 'EMAIL_TEST_DISPATCH',
      auditSummary: 'Executed SMTP diagnostic dispatch',
    });
  }

  async previewTemplate(params: {
    userId: number;
    template:
      | 'monthly-statement'
      | 'cutoff-digest'
      | 'ledger-backup'
      | 'test-dispatch'
      | 'kill-switch';
    month?: number;
    year?: number;
    scope?: 'all' | 'locked';
    locale?: EmailLocale;
    recipientEmail?: string;
    killSwitchId?: number;
  }): Promise<EmailDispatchResult> {
    if (params.template === 'monthly-statement') {
      return this.sendMonthlyStatement({ ...params, previewOnly: true });
    }
    if (params.template === 'cutoff-digest') {
      return this.sendCutoffDigest({ ...params, previewOnly: true });
    }
    if (params.template === 'ledger-backup') {
      return this.sendOffsiteBackup({ ...params, previewOnly: true });
    }
    if (params.template === 'test-dispatch') {
      return this.sendTestEmail({ ...params, previewOnly: true });
    }

    const locale: EmailLocale = params.locale ?? 'EN';
    const [transport, config, killSwitches] = await Promise.all([
      this.resolveTransportConfig(params.userId, params.recipientEmail),
      this.prisma.globalConfig.findFirst({ where: { userId: params.userId } }),
      this.creditSelectors.getKillSwitches(params.userId),
    ]);

    const item =
      (params.killSwitchId
        ? killSwitches.items.find((k) => k.id === params.killSwitchId)
        : undefined) ??
      killSwitches.items.find((k) => !k.providerCancelConfirmed && k.isActive) ??
      killSwitches.items[0];

    const name = item
      ? item.promoLabel
        ? `${item.label} (${item.promoLabel})`
        : item.label
      : 'Sample Subscription (Promotional Rate)';
    const deadline = item?.promoEndDate
      ? item.promoEndDate.split('T')[0]
      : getJakartaDateParts().isoDate;
    const daysLeft = item?.daysUntilExpiry ?? 7;
    const currentPrice = item?.amount ?? 0;
    const normalPrice = item?.postPromoNormalAmount ?? item?.amount ?? 309000;
    const cancelUrl = item?.providerCancelUrl ?? 'https://one.google.com/settings';

    const plainMessage = formatKillSwitchReminderMessage(
      config?.killSwitchCustomMessageTemplate,
      {
        name,
        deadline,
        daysLeft,
        normalPrice,
        cancelUrl,
        currentPrice,
      },
    );

    const subject = formatKillSwitchEmailSubject(item?.label || 'Subscription Plan', deadline);
    const html = buildKillSwitchEmailHtml({
      name,
      deadline,
      daysLeft,
      currentPrice,
      normalPrice,
      cancelUrl,
      plainMessage,
      recipientEmail: transport.recipientEmail,
    });

    return this.dispatchEmail({
      userId: params.userId,
      recipientEmail: transport.recipientEmail,
      smtpUser: transport.smtpUser,
      smtpPass: transport.smtpPass,
      host: transport.host,
      port: transport.port,
      secure: transport.secure,
      previewOnly: true,
      locale,
      subject,
      html,
      textFallback: plainMessage,
      auditAction: 'EMAIL_KILL_SWITCH_PREVIEW',
      auditSummary: 'Generated read-only Kill-Switch email preview',
    });
  }

  async sendSecurityLockoutAlert(params: {
    userId?: number;
    attemptedIdentifier: string;
    clientIp: string;
    locale?: EmailLocale;
  }): Promise<EmailDispatchResult | null> {
    if (isSyntheticProbeIdentifier(params.attemptedIdentifier)) {
      this.logger.log(
        `Suppressed synthetic pentest security lockout alert for "${params.attemptedIdentifier}" (${params.clientIp})`,
      );
      return null;
    }

    try {
      const uid = params.userId ?? 1;
      const locale: EmailLocale = params.locale ?? 'EN';
      const jkt = getJakartaDateParts();
      const transport = await this.resolveTransportConfig(uid);

      const copy: Record<EmailLocale, { title: string; detail: string }> = {
        EN: {
          title: 'Security Lockout Notice — Repeated Failed Sign-In Attempts',
          detail:
            'Five consecutive failed authentication attempts triggered a mandatory 15-minute IP lockout on Sunday Funday ERP.',
        },
        ID: {
          title: 'Peringatan Keamanan — Penguncian Akibat Gagal Login Berulang',
          detail:
            'Lima percobaan login gagal berturut-turut memicu pemblokiran IP selama 15 menit pada Sunday Funday ERP.',
        },
        ZH: {
          title: '安全锁定通知 — 连续多次登录失败',
          detail: '系统检测到连续 5 次身份验证失败，已对相关 IP 启动 15 分钟强制锁定。',
        },
      };
      const c = copy[locale];
      const html = wrapCorporateHtml({
        kicker: 'SUNDAY FUNDAY ERP · ACCESS SECURITY',
        title: c.title,
        subtitle: `Event Date: ${jkt.isoDate} WIB · Authentication Rate Limiter`,
        bodyHtml: `
          <p style="margin:0 0 18px 0;color:#334155;">${escapeHtml(c.detail)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;">Attempted Identifier</td>
              <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;">${escapeHtml(params.attemptedIdentifier || 'unknown')}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;">Source IP</td>
              <td style="padding:10px 14px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:600;color:#0F172A;">${escapeHtml(params.clientIp || 'unknown')}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-size:13px;color:#475569;">Lockout Status</td>
              <td style="padding:10px 14px;text-align:right;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;font-weight:700;color:#991B1B;">15 minutes (HTTP 429)</td>
            </tr>
          </table>
        `,
        footerNote: `Delivered to ${transport.recipientEmail} from Sunday Funday ERP <sundayfundayerp@gmail.com> · Authentication Guard`,
        accentColor: '#991B1B',
      });

      return await this.dispatchEmail({
        userId: uid,
        recipientEmail: transport.recipientEmail,
        smtpUser: transport.smtpUser,
        smtpPass: transport.smtpPass,
        host: transport.host,
        port: transport.port,
        secure: transport.secure,
        locale,
        subject: c.title,
        html,
        textFallback: `${c.title} | Identifier=${params.attemptedIdentifier} | IP=${params.clientIp}`,
        auditAction: 'SECURITY_LOGIN_LOCKOUT',
        auditSummary: `5th-attempt login lockout for "${params.attemptedIdentifier}" from IP ${params.clientIp}`,
        severity: AuditSeverity.WARNING,
      });
    } catch (err: any) {
      this.logger.warn(`Security lockout alert dispatch suppressed: ${err?.message}`);
      return null;
    }
  }
}
