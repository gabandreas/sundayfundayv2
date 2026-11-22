import { UnprocessableEntityException } from '@nestjs/common';
import { EmailService } from './email.service';
import {
  formatKillSwitchEmailSubject,
  formatKillSwitchReminderMessage,
} from '../credit/kill-switch-message';
import {
  PLATFORM_EMAIL_FROM,
  classifySmtpError,
  isSyntheticProbeIdentifier,
  normalizeSmtpAppPassword,
  sanitizeSmtpMessage,
} from './smtp-transport.util';

import ExcelJS from 'exceljs';
import { generateExecutiveWorkbookBuffer } from './email.workbook';

describe('EmailService (Trilingual Templates, Dry-Run Fallback, 4-Sheet Workbook & Backup)', () => {
  const mockAuditRecord = jest.fn().mockResolvedValue({ id: 1 });
  const mockGetExecutiveReport = jest.fn();
  const mockGetLiabilityMatrix = jest.fn();
  const mockGetKillSwitches = jest.fn();

  const mockPrisma: any = {
    globalConfig: {
      findFirst: jest.fn().mockResolvedValue({
        killSwitchNotifyEmail: null,
        killSwitchSmtpUser: null,
        killSwitchSmtpAppPassword: null,
      }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        username: 'cheeseburger',
        accountName: 'cheeseburger',
        fullName: 'Gabriel',
        email: 'gabandreas22@gmail.com',
        role: 'PLATFORM_OWNER',
        blueprintType: 'SUPERADMIN_BESPOKE',
        passwordHash: 'SECRET_HASH_MUST_NOT_LEAK',
      }),
    },
    monthlySnapshot: { findMany: jest.fn().mockResolvedValue([{ id: 1, month: 11, year: 2026 }]) },
    transaction: { findMany: jest.fn().mockResolvedValue([]) },
    monthlyBulkBill: { findMany: jest.fn().mockResolvedValue([]) },
    liabilityLineItem: { findMany: jest.fn().mockResolvedValue([]) },
    creditCardTransaction: { findMany: jest.fn().mockResolvedValue([]) },
    creditContract: { findMany: jest.fn().mockResolvedValue([]) },
    budgetRevision: { findMany: jest.fn().mockResolvedValue([]) },
    savingsGoal: { findMany: jest.fn().mockResolvedValue([]) },
  };

  const sampleReport: any = {
    selectedMonth: 11,
    selectedYear: 2026,
    scope: 'all',
    closingStatement: {
      month: 11,
      year: 2026,
      periodLabel: 'Nov 2026',
      workingDaysWindowLabel: '27 Nov - 27 Dec 2026',
      status: 'DRAFT',
      payroll: { incomeTransactions: [] },
      upfrontAndWaterfall: {
        paylaterBills: 2742391,
        creditCardBills: 734256,
        personalDebtBills: 996498,
        contractInstallments: 0,
        fixedEssentialsActual: 300000,
        actualDailyOperational: 1500000,
        actualBufferPocket: 0,
        actualSavings: 0,
        actualSelfReward: 0,
        deficitUncovered: 369145,
        isDeficit: true,
      },
      governance: {
        disciplineScore: 78,
        greenCount: 2,
        yellowCount: 1,
        redCount: 1,
      },
      moneyCycle: {
        kpis: {
          totalMoneyIn: 5904000,
          netPaycheck: 5904000,
          totalDebtAndBillsPaid: 4473145,
          debtShareOfIncomePercent: 75.8,
        },
        itemizedCreditCardCharges: [],
        dailyLiving: {
          remainingOperationalCash: 1500000,
          safeToSpendToday: 48387,
          daysRemaining: 31,
          pacingStatus: 'ON_TRACK',
          itemizedDailyExpenses: [],
        },
        savingsBottomLine: {
          realizedInVaultTotal: 0,
        },
      },
    },
    comparativeStatement: {
      scope: 'all',
      periodCount: 1,
      periods: [
        {
          periodLabel: 'Nov 2026',
          status: 'DRAFT',
          finalTotalIncome: 5904000,
          creditBillsAmount: 4473145,
          fixedEssentialsAmount: 300000,
          actualDailyOperational: 1500000,
          actualSavings: 0,
          selfReward: 0,
          deficitUncovered: 369145,
          creditDebtRatioPercent: 75.8,
          disciplineScore: 78,
        },
      ],
      totals: {
        totalIncome: 5904000,
        totalCreditBills: 4473145,
        totalFixedEssentials: 300000,
        totalDailyOperational: 1500000,
        totalSavings: 0,
        totalSelfReward: 0,
        averageCreditDebtRatioPercent: 75.8,
        averageDisciplineScore: 78,
      },
    },
    amortizationSchedule: {
      months: [],
      summary: {
        total12MonthObligations: 18000000,
        totalPaylater12M: 10000000,
        totalCreditCard12M: 5000000,
        totalPersonalDebt12M: 3000000,
        totalContracts12M: 0,
        peakMonthLabel: "Nov '26",
        firstDebtFreeMonthLabel: null,
      },
    },
    dossier: {
      revisions: [],
      recentGovernanceLogs: [],
    },
  };

  let service: EmailService;

  beforeEach(() => {
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_USER;
    mockAuditRecord.mockClear();
    mockGetExecutiveReport.mockResolvedValue(sampleReport);
    mockGetLiabilityMatrix.mockResolvedValue({
      lineItemsPerMonth: {
        '2026-11': [
          {
            id: 1,
            title: '11.11 PayLater',
            merchantOrPlatform: 'SPayLater',
            monthlyAmount: 159904,
            isSettled: false,
            dueDateIso: '2026-12-25',
          },
        ],
      },
    });
    mockGetKillSwitches.mockResolvedValue({ items: [] });

    service = new EmailService(
      mockPrisma,
      { record: mockAuditRecord } as any,
      { getExecutiveReport: mockGetExecutiveReport } as any,
      {
        getLiabilityMatrix: mockGetLiabilityMatrix,
        getKillSwitches: mockGetKillSwitches,
      } as any,
    );
  });

  it('builds a 4-sheet XLSX statement attachment and renders ID/ZH/EN dry-run preview without SMTP secrets', async () => {
    const resId = await service.sendMonthlyStatement({
      userId: 1,
      month: 11,
      year: 2026,
      locale: 'ID',
    });

    expect(resId.status).toBe('DRY_RUN_PREVIEW');
    expect(resId.configured).toBe(false);
    expect(resId.recipientEmail).toBe('gabandreas22@gmail.com');
    expect(resId.subject).toContain('Laporan Keuangan Bulanan');
    expect(resId.attachmentNames).toEqual(['SundayFunday_Statement_2026-11.xlsx']);
    expect(resId.attachmentSizesBytes[0]).toBeGreaterThan(2000);
    expect(resId.htmlPreview).toContain('Rp 369.145');
    expect(resId.htmlPreview).toContain('#F1F5F9');
    expect(resId.htmlPreview).toContain('#FFFFFF');
    expect(resId.htmlPreview).toContain('brand-mark.png');
    expect(resId.htmlPreview).not.toContain('#0c0e14');

    const resZh = await service.sendMonthlyStatement({
      userId: 1,
      month: 11,
      year: 2026,
      locale: 'ZH',
    });
    expect(resZh.subject).toContain('月度财务结算报表');
    expect(mockAuditRecord).toHaveBeenCalledTimes(2);
  });

  it('packages JSON + XLSX off-site backup with SHA-256 checksum and scrubs credential hashes', async () => {
    const res = await service.sendOffsiteBackup({
      userId: 1,
      month: 11,
      year: 2026,
      locale: 'EN',
    });

    expect(res.status).toBe('DRY_RUN_PREVIEW');
    expect(res.attachmentNames.length).toBe(2);
    expect(res.attachmentNames[0]).toMatch(/\.json$/);
    expect(res.attachmentNames[1]).toMatch(/\.xlsx$/);
    expect(res.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates exact 4-sheet XLSX workbook structure with SUM formulas and IDR format', async () => {
    const report = await mockGetExecutiveReport();
    const buf = await generateExecutiveWorkbookBuffer(report);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Executive Summary',
      'Due-Date & Settlement Schedule',
      'Active Contracts Burn-Down',
      'Line-Item Audit Ledger',
    ]);
  });

  it('dispatches security lockout alert cleanly for real identifiers and suppresses synthetic pentest probes', async () => {
    const res = await service.sendSecurityLockoutAlert({
      userId: 1,
      attemptedIdentifier: 'cheeseburger',
      clientIp: '203.0.113.42',
      locale: 'EN',
    });

    expect(res).not.toBeNull();
    expect(res!.subject).toBe('Security Lockout Notice — Repeated Failed Sign-In Attempts');
    expect(res!.subject).not.toContain('[SECURITY]');
    expect(res!.recipientEmail).toBe('gabandreas22@gmail.com');
    expect(res!.htmlPreview).toContain('203.0.113.42');
    expect(res!.htmlPreview).toContain('#F1F5F9');
    expect(res!.htmlPreview).not.toContain('#ff3838');

    expect(isSyntheticProbeIdentifier('nonexistent-pentest-target-12345')).toBe(true);
    expect(isSyntheticProbeIdentifier('cheeseburger')).toBe(false);

    const suppressed = await service.sendSecurityLockoutAlert({
      userId: 1,
      attemptedIdentifier: 'nonexistent-pentest-target-1763210000',
      clientIp: '203.0.113.99',
      locale: 'EN',
    });
    expect(suppressed).toBeNull();
  });

  it('decouples From system identity from authenticated SMTP user and delivers To user profile email', async () => {
    process.env.SMTP_USER = 'gabandreas22@gmail.com';
    process.env.SMTP_PASS = 'abcdefghijklmnop';
    const sendSpy = jest.spyOn(service as any, 'sendSmtpMail').mockResolvedValueOnce({
      ok: true,
      messageId: '<decoupled-test@gmail.com>',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      fallbackUsed: false,
    });

    const dispatched = await service.sendTestEmail({ userId: 1, locale: 'EN' });
    expect(dispatched.status).toBe('SENT');
    expect(dispatched.recipientEmail).toBe('gabandreas22@gmail.com');
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'gabandreas22@gmail.com' }),
      expect.objectContaining({
        from: PLATFORM_EMAIL_FROM,
        to: 'gabandreas22@gmail.com',
      }),
    );

    sendSpy.mockRestore();
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  it('reports DRY_RUN_PREVIEW / LIVE_SMTP / AUTH_ERROR transport metadata honestly based on live verification', async () => {
    const dryStatus = await service.getStatus(1);
    expect(dryStatus.mode).toBe('DRY_RUN_PREVIEW');
    expect(dryStatus.configured).toBe(false);
    expect(dryStatus.verified).toBe(false);
    expect(dryStatus.verificationStatus).toBe('UNCONFIGURED');
    expect(dryStatus.host).toBe('smtp.gmail.com');
    expect(dryStatus.port).toBe(465);
    expect(dryStatus.secure).toBe(true);
    expect(dryStatus.smtpUser).toBe('sundayfundayerp@gmail.com');
    expect(dryStatus.defaultRecipient).toBe('sundayfundayerp@gmail.com');

    process.env.SMTP_PASS = 'abcd efgh ijkl mnop';
    const verifySpy = jest
      .spyOn(service as any, 'verifySmtpTransport')
      .mockResolvedValueOnce({
        ok: true,
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        fallbackUsed: false,
        verifiedAtIso: '2026-11-15T10:00:00.000Z',
      })
      .mockResolvedValueOnce({
        ok: false,
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        fallbackUsed: false,
        verifiedAtIso: '2026-11-15T10:01:00.000Z',
        errorCode: 'SMTP_AUTH_FAILED',
        summary: 'SMTP authentication failed (535).',
        guidance: 'Confirm SMTP Sender Account matches your Google App Password.',
      });

    const liveStatus = await service.getStatus(1);
    expect(liveStatus.mode).toBe('LIVE_SMTP');
    expect(liveStatus.configured).toBe(true);
    expect(liveStatus.verified).toBe(true);
    expect(liveStatus.verificationStatus).toBe('VERIFIED');
    expect(liveStatus.hasAppPassword).toBe(true);

    const errStatus = await service.getStatus(1);
    expect(errStatus.mode).toBe('AUTH_ERROR');
    expect(errStatus.configured).toBe(true);
    expect(errStatus.verified).toBe(false);
    expect(errStatus.verificationStatus).toBe('ERROR');
    expect(errStatus.errorCode).toBe('SMTP_AUTH_FAILED');
    expect(errStatus.verificationGuidance).toContain('SMTP Sender Account');

    verifySpy.mockRestore();
    delete process.env.SMTP_PASS;
  });

  it('normalizes 16-digit App Passwords, classifies SMTP 535/534/network errors, and never throws HTTP 500', async () => {
    expect(normalizeSmtpAppPassword('abcd efgh ijkl mnop')).toBe('abcdefghijklmnop');
    expect(sanitizeSmtpMessage('AUTH PLAIN dGVzdA== 535 BadCredentials')).toContain('AUTH [REDACTED]');

    const auth535 = classifySmtpError(
      { responseCode: 535, message: 'Invalid login: 535-5.7.8 BadCredentials' },
      { host: 'smtp.gmail.com', port: 465, user: 'sundayfundayerp@gmail.com' },
    );
    expect(auth535.errorCode).toBe('SMTP_AUTH_FAILED');
    expect(auth535.retryableWithStartTls).toBe(false);
    expect(auth535.guidance).toContain('SMTP Sender Account');

    const netTimeout = classifySmtpError(
      { code: 'ETIMEDOUT', message: 'Connection timeout' },
      { host: 'smtp.gmail.com', port: 465, user: 'gabandreas22@gmail.com' },
    );
    expect(netTimeout.errorCode).toBe('SMTP_CONNECTION_FAILED');
    expect(netTimeout.retryableWithStartTls).toBe(true);

    process.env.SMTP_PASS = 'abcdefghijklmnop';
    const sendSpy = jest.spyOn(service as any, 'sendSmtpMail').mockResolvedValueOnce({
      ok: false,
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      fallbackUsed: false,
      errorCode: 'SMTP_AUTH_FAILED',
      summary: 'SMTP authentication failed (535) for sender "sundayfundayerp@gmail.com".',
      guidance: 'Confirm "SMTP Sender Account" matches your Google App Password.',
    });

    await expect(
      service.sendTestEmail({ userId: 1, locale: 'EN' }),
    ).rejects.toThrow(UnprocessableEntityException);

    // Explicit dryRun fallback succeeds cleanly without triggering live SMTP send
    const dryFallback = await service.sendTestEmail({
      userId: 1,
      locale: 'EN',
      dryRun: true,
    });
    expect(dryFallback.status).toBe('DRY_RUN_PREVIEW');
    expect(dryFallback.configured).toBe(true);
    expect(sendSpy).toHaveBeenCalledTimes(1);

    sendSpy.mockRestore();
    delete process.env.SMTP_PASS;
  });

  it('generates read-only previews without writing audit logs and enforces formal English Kill-Switch notices', async () => {
    mockAuditRecord.mockClear();
    const preview = await service.previewTemplate({
      userId: 1,
      template: 'kill-switch',
      locale: 'EN',
    });
    expect(preview.subject).toContain('[Action Required] Subscription Cancellation Notice');
    expect(preview.subject.toLowerCase()).not.toContain('batalin');
    expect(preview.htmlPreview).toContain('brand-mark.png');
    expect(preview.htmlPreview.toLowerCase()).not.toContain('woi gab');
    expect(mockAuditRecord).not.toHaveBeenCalled();

    const formatted = formatKillSwitchReminderMessage(undefined, {
      name: 'Gemini AI Pro',
      deadline: '2027-01-27',
      daysLeft: 5,
      normalPrice: 309000,
      cancelUrl: 'https://one.google.com/settings',
      currentPrice: 0,
    });
    expect(formatted).toContain('Promotional pricing for Gemini AI Pro expires on 2027-01-27');
    expect(formatted.toLowerCase()).not.toContain('woi gab');
    expect(formatKillSwitchEmailSubject('Gemini AI Pro', '2027-01-27')).toBe(
      '[Action Required] Subscription Cancellation Notice: Gemini AI Pro (Deadline 2027-01-27)',
    );
  });
});
