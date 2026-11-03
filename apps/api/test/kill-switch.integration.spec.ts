/**
 * kill-switch.integration.spec.ts
 * Integration tests for Subscription Promo & Auto-Renew Kill-Switch Engine.
 * Tests exclusively against isolated test database finance_erp_test.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CreditModule } from '../src/credit/credit.module';
import { CreditService } from '../src/credit/credit.service';
import { CreditSelectors } from '../src/credit/credit.selectors';
import { ConfigModule } from '../src/config/config.module';
import { ConfigService } from '../src/config/config.service';
import { SnapshotsModule } from '../src/snapshots/snapshots.module';
import { AuditModule } from '../src/audit/audit.module';
import { CreditCardChargeType } from '@prisma/client';

async function cleanTestDb(prisma: PrismaService) {
  await prisma.auditLog.deleteMany();
  await prisma.creditCardTransaction.deleteMany();
  await prisma.globalConfig.deleteMany();
  await prisma.user.deleteMany();
}

describe('Subscription Kill-Switch Engine — Integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let creditService: CreditService;
  let creditSelectors: CreditSelectors;
  let configService: ConfigService;
  let testUserId: number;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        PrismaModule,
        AuditModule,
        SnapshotsModule,
        CreditModule,
        ConfigModule,
      ],
    }).compile();

    prisma = module.get(PrismaService);
    creditService = module.get(CreditService);
    creditSelectors = module.get(CreditSelectors);
    configService = module.get(ConfigService);

    await cleanTestDb(prisma);
  });

  afterAll(async () => {
    await cleanTestDb(prisma);
    await module.close();
  });

  beforeEach(async () => {
    await cleanTestDb(prisma);
    const user = await prisma.user.create({
      data: {
        email: 'owner@sundayfunday.local',
        fullName: 'Platform Owner',
        role: 'PLATFORM_OWNER',
        passwordHash: 'hash',
      },
    });
    testUserId = user.id;
    await prisma.globalConfig.create({
      data: {
        userId: testUserId,
        baseSalary: 6000000,
        dailyAllowance: 20000,
        killSwitchLeadDays: 14,
        killSwitchBannerEnabled: true,
      },
    });
  });

  it('retrieves default kill-switch configuration and empty items when none configured', async () => {
    const res = await creditSelectors.getKillSwitches(1);
    expect(res.config.killSwitchLeadDays).toBe(14);
    expect(res.config.killSwitchBannerEnabled).toBe(true);
    expect(res.items).toEqual([]);
  });

  it('creates a tracked promo subscription and evaluates loss penalty delta', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 45); // 45 days in future

    const created = await creditService.createKillSwitch(
      {
        label: 'Gemini AI Pro #1',
        amount: 85470,
        promoLabel: '3-Month Promo',
        promoEndDate: futureDate.toISOString(),
        postPromoNormalAmount: 309000,
        providerCancelUrl: 'https://one.google.com/settings',
        killSwitchEnabled: true,
      },
      1,
    );

    expect(created.id).toBeDefined();
    expect(created.isRecurring).toBe(true);
    expect(created.chargeType).toBe(CreditCardChargeType.RECURRING);
    expect(created.postPromoNormalAmount).toBe(309000);

    const report = await creditSelectors.getKillSwitches(1);
    expect(report.items.length).toBe(1);

    const item = report.items[0];
    expect(item.label).toBe('Gemini AI Pro #1');
    expect(item.amount).toBe(85470);
    expect(item.postPromoNormalAmount).toBe(309000);
    expect(item.monthlyPenaltyDelta).toBe(309000 - 85470); // 223,530
    expect(item.daysUntilExpiry).toBeGreaterThan(30);
    expect(item.alertState).toBe('SILENT');
    expect(item.statusLabel).toBe('ARMED');
  });

  it('triggers ACTION_REQUIRED (CRITICAL) alert state when expiration is within leadDays', async () => {
    const imminentDate = new Date();
    imminentDate.setDate(imminentDate.getDate() + 5); // 5 days left <= 14 lead days

    await creditService.createKillSwitch(
      {
        label: 'Gemini AI Pro #2',
        amount: 0, // Free trial
        promoLabel: '1-Year Free Trial',
        promoEndDate: imminentDate.toISOString(),
        postPromoNormalAmount: 309000,
        providerCancelUrl: 'https://one.google.com/settings',
        killSwitchEnabled: true,
      },
      1,
    );

    const report = await creditSelectors.getKillSwitches(1);
    expect(report.items.length).toBe(1);

    const item = report.items[0];
    expect(item.daysUntilExpiry).toBeLessThanOrEqual(5);
    expect(item.alertState).toBe('ACTION_REQUIRED');
    expect(item.statusLabel).toBe('CRITICAL');
    expect(item.monthlyPenaltyDelta).toBe(309000);
  });

  it('disarms alert and auto-stops subscription when user marks providerCancelConfirmed', async () => {
    const promoEnd = new Date(Date.UTC(2027, 0, 15)); // Jan 15, 2027

    const created = await creditService.createKillSwitch(
      {
        label: 'Coursera Plus',
        amount: 250000,
        promoLabel: 'Holiday Promo',
        promoEndDate: promoEnd.toISOString(),
        postPromoNormalAmount: 500000,
        providerCancelUrl: 'https://coursera.org/settings',
        killSwitchEnabled: true,
      },
      1,
    );

    // Update with confirm cancel and autoStopAfterPromo
    const updated = await creditService.updateKillSwitch(
      created.id,
      {
        providerCancelConfirmed: true,
        autoStopAfterPromo: true,
      },
      1,
    );

    expect(updated.providerCancelConfirmed).toBe(true);
    expect(updated.isActive).toBe(false);
    expect(updated.stoppedAtMonth).toBe(2); // Feb 2027 (month following Jan)
    expect(updated.stoppedAtYear).toBe(2027);

    // Re-check selector output
    const report = await creditSelectors.getKillSwitches(1);
    const item = report.items.find((i) => i.id === created.id);
    expect(item?.alertState).toBe('CONFIRMED_SAFE');
    expect(item?.statusLabel).toBe('SAFE');
  });

  it('updates leadDays via config and immediately reflects in alert evaluation', async () => {
    const tenDaysAway = new Date();
    tenDaysAway.setDate(tenDaysAway.getDate() + 10);

    await creditService.createKillSwitch(
      {
        label: 'Test Subscription',
        amount: 100000,
        promoEndDate: tenDaysAway.toISOString(),
        postPromoNormalAmount: 200000,
        killSwitchEnabled: true,
      },
      1,
    );

    // With leadDays = 14: 10 days away is <= 14 -> ACTION_REQUIRED
    let report = await creditSelectors.getKillSwitches(1);
    expect(report.items[0].alertState).toBe('ACTION_REQUIRED');

    // Tighten leadDays to 7 days via config
    await configService.upsertConfig({ killSwitchLeadDays: 7 }, 1);

    // Now 10 days away > 7 -> SILENT (ARMED)
    report = await creditSelectors.getKillSwitches(1);
    expect(report.config.killSwitchLeadDays).toBe(7);
    expect(report.items[0].alertState).toBe('SILENT');
    expect(report.items[0].statusLabel).toBe('ARMED');
  });

  it('formats casual human-tone messages using default and custom templates', () => {
    const { formatKillSwitchReminderMessage } = require('../src/credit/kill-switch-message');

    // Default template
    const msgDefault = formatKillSwitchReminderMessage(null, {
      name: 'Gemini AI Pro 2',
      deadline: '2027-01-28',
      daysLeft: 88,
      normalPrice: 309000,
      cancelUrl: 'https://one.google.com/settings',
    });

    expect(msgDefault).toContain('Woi Gab, inget batalin langganan Gemini AI Pro 2');
    expect(msgDefault).toContain('2027-01-28');
    expect(msgDefault).toContain('88 hari lagi');
    expect(msgDefault).toContain('Rp 309.000/bln');
    expect(msgDefault).toContain('https://one.google.com/settings');

    // Custom template
    const customTpl =
      'Halo! Reminder untuk {{name}}: deadline {{deadline}} ({{daysLeft}} hari). Harga normal {{normalPrice}}. Link: {{cancelUrl}}';
    const msgCustom = formatKillSwitchReminderMessage(customTpl, {
      name: 'Coursera Plus',
      deadline: '2027-03-01',
      daysLeft: 120,
      normalPrice: 500000,
      cancelUrl: 'https://coursera.org/settings',
    });

    expect(msgCustom).toBe(
      'Halo! Reminder untuk Coursera Plus: deadline 2027-03-01 (120 hari). Harga normal 500.000. Link: https://coursera.org/settings',
    );
  });

  it('saves and retrieves external reminder notification channels config', async () => {
    const configBefore = await creditSelectors.getKillSwitchNotificationConfig(testUserId);
    expect(configBefore.killSwitchNotifyEmail).toBeNull();
    expect(configBefore.hasSmtpPassword).toBe(false);

    const saved = await creditService.updateKillSwitchNotificationConfig(
      {
        killSwitchNotifyEmail: 'owner@gmail.com',
        killSwitchSmtpUser: 'sender@gmail.com',
        killSwitchSmtpAppPassword: 'abcd efgh ijkl mnop',
        killSwitchWaPhone: '6281234567890',
        killSwitchWebhookUrl: 'https://api.fonnte.com/send',
        killSwitchWaApiKey: 'fonnte-secret-key',
        killSwitchCustomMessageTemplate: 'Reminder cancel: {{name}}',
      },
      testUserId,
    );

    expect(saved.killSwitchNotifyEmail).toBe('owner@gmail.com');
    expect(saved.killSwitchSmtpUser).toBe('sender@gmail.com');
    expect(saved.hasSmtpPassword).toBe(true);
    expect(saved.killSwitchWaPhone).toBe('6281234567890');
    expect(saved.killSwitchWebhookUrl).toBe('https://api.fonnte.com/send');
    expect(saved.hasWaApiKey).toBe(true);
    expect(saved.killSwitchCustomMessageTemplate).toBe('Reminder cancel: {{name}}');

    // Verify raw DB has stripped whitespace on app password
    const rawConfig = await prisma.globalConfig.findFirst({ where: { userId: testUserId } });
    expect(rawConfig?.killSwitchSmtpAppPassword).toBe('abcdefghijklmnop');
  });

  it('dispatches reminder, stamps lastKillSwitchNotifiedAt, and outputs whatsappUrl', async () => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 3);

    const card = await creditService.createKillSwitch(
      {
        label: 'Gemini AI Pro 2',
        amount: 85470,
        promoEndDate: deadline.toISOString(),
        postPromoNormalAmount: 309000,
        providerCancelUrl: 'https://one.google.com/settings',
        killSwitchEnabled: true,
      },
      testUserId,
    );

    await creditService.updateKillSwitchNotificationConfig(
      {
        killSwitchWaPhone: '6281234567890',
      },
      testUserId,
    );

    const res = await creditService.sendKillSwitchReminder(card.id, testUserId);
    expect(res.success).toBe(true);
    expect(res.message).toContain('Woi Gab, inget batalin langganan Gemini AI Pro 2');
    expect(res.whatsappUrl).toContain('https://wa.me/6281234567890?text=');
    expect(res.notifiedAt).toBeDefined();

    // Verify timestamp was stamped in DB
    const updatedCard = await prisma.creditCardTransaction.findUnique({
      where: { id: card.id },
    });
    expect(updatedCard?.lastKillSwitchNotifiedAt).toBeDefined();
    expect(updatedCard?.lastKillSwitchNotifiedAt).not.toBeNull();
  });
});
