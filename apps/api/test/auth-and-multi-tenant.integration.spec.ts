import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Phase 9 — Multi-Tenant SaaS & Auth Guard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let newMemberToken: string;
  let newMemberId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up test users created during this test (id > 2)
    const testUsers = await prisma.user.findMany({
      where: { id: { gt: 2 } },
      select: { id: true },
    });
    const ids = testUsers.map((u) => u.id);
    if (ids.length > 0) {
      await prisma.monthlySnapshot.deleteMany({ where: { userId: { in: ids } } });
      await prisma.globalConfig.deleteMany({ where: { userId: { in: ids } } });
      await prisma.trustedIpAddress.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }

    // Reset Owner security settings
    await prisma.user.update({
      where: { id: 1 },
      data: { ipWhitelistEnforced: false },
    });

    await app.close();
  });

  describe('Part 1: Authentication & Role Verification', () => {
    it('should log in as Platform Owner and return token with SUPERADMIN_BESPOKE blueprint', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'owner@sundayfunday.id',
          password: 'SundayFunday#2026',
        })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('PLATFORM_OWNER');
      expect(res.body.user.blueprintType).toBe('SUPERADMIN_BESPOKE');
      ownerToken = res.body.accessToken;
    });

    it('should log in into Demo Sandbox and return isolated DEMO_SANDBOX account', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/demo-login')
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.role).toBe('DEMO_SANDBOX');
      expect(res.body.user.blueprintType).toBe('STANDARD_GENERAL');
    });

    it('should register a new STANDARD_MEMBER account with independent empty workspace', async () => {
      const testEmail = `test.member.${Date.now()}@example.com`;
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'Password123!',
          fullName: 'Test Corporate Member',
        })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.role).toBe('STANDARD_MEMBER');
      expect(res.body.user.blueprintType).toBe('STANDARD_GENERAL');
      newMemberToken = res.body.accessToken;
      newMemberId = res.body.user.id;

      // Verify new user has 0 snapshots in DB
      const snapshots = await prisma.monthlySnapshot.findMany({
        where: { userId: newMemberId },
      });
      expect(snapshots.length).toBe(0);
    });
  });

  describe('Part 2: Multi-Tenant Data Isolation Guard', () => {
    it('should not allow standard member to see owner snapshots', async () => {
      // Owner has snapshots, query with newMember token should return a fresh draft under newMember's userId
      const res = await request(app.getHttpServer())
        .get('/api/snapshots?month=11&year=2026')
        .set('Authorization', `Bearer ${newMemberToken}`)
        .expect(200);

      expect(res.body.userId).toBe(newMemberId);
      // New member's fresh draft has zero salary
      expect(res.body.finalTotalIncome).toBe(0);
    });
  });

  describe('Part 3: Smart IP Whitelist & Security PIN Guard', () => {
    beforeEach(async () => {
      // Ensure test external IP is not pre-whitelisted
      await prisma.trustedIpAddress.deleteMany({
        where: { ipAddress: '203.0.113.42' },
      });
    });

    it('should require Security PIN when ipWhitelistEnforced is enabled from untrusted IP', async () => {
      // 1. Enable IP whitelist on owner
      await prisma.user.update({
        where: { id: 1 },
        data: { ipWhitelistEnforced: true },
      });

      // 2. Attempt login from an external untrusted IP
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', '203.0.113.42')
        .send({
          email: 'owner@sundayfunday.id',
          password: 'SundayFunday#2026',
        })
        .expect(200);

      expect(res.body.requiresPin).toBe(true);
      expect(res.body.detectedIp).toBe('203.0.113.42');
    });

    it('should reject invalid PIN when logging in from untrusted IP', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', '203.0.113.42')
        .send({
          email: 'owner@sundayfunday.id',
          password: 'SundayFunday#2026',
          securityPin: '000000',
        })
        .expect(401);
    });

    it('should accept valid PIN (271026) and whitelist the IP if trustIp is true', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', '203.0.113.42')
        .send({
          email: 'owner@sundayfunday.id',
          password: 'SundayFunday#2026',
          securityPin: '271026',
          trustIp: true,
          ipLabel: 'Office Remote IP',
        })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();

      // Verify IP was added to TrustedIpAddress
      const trusted = await prisma.trustedIpAddress.findFirst({
        where: { userId: 1, ipAddress: '203.0.113.42' },
      });
      expect(trusted).toBeDefined();
      expect(trusted?.label).toBe('Office Remote IP');
    });
  });

  describe('Part 4: Platform Admin Console (/api/admin)', () => {
    it('should forbid standard member from accessing /api/admin/users', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${newMemberToken}`)
        .expect(403);
    });

    it('should allow Platform Owner to list all clients and accounts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const owner = res.body.find((u: any) => u.id === 1);
      expect(owner).toBeDefined();
      expect(owner.role).toBe('PLATFORM_OWNER');
    });

    it('should allow Platform Owner to create a new client and configure blueprint', async () => {
      const clientEmail = `client.${Date.now()}@bespoke.com`;
      const res = await request(app.getHttpServer())
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          fullName: 'Bespoke Corporate Client',
          email: clientEmail,
          password: 'TempPassword#2026',
          role: 'BESPOKE_CLIENT',
          blueprintType: 'BESPOKE_CUSTOM',
          initializeSnapshot: true,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.role).toBe('BESPOKE_CLIENT');
      expect(res.body.blueprintType).toBe('BESPOKE_CUSTOM');

      // Update their blueprint config via /api/admin/users/:id/config
      const configRes = await request(app.getHttpServer())
        .put(`/api/admin/users/${res.body.id}/config`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          baseSalary: 18000000,
          payrollMode: 'VARIABLE_FREELANCE',
        })
        .expect(200);

      expect(configRes.body.baseSalary).toBe(18000000);
      expect(configRes.body.payrollMode).toBe('VARIABLE_FREELANCE');
    });

    it('should allow Platform Owner to export full JSON database backup', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/backup/export')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.header['content-type']).toContain('application/json');
      expect(res.header['content-disposition']).toContain('sunday-funday-erp-backup');
      expect(res.body.metadata).toBeDefined();
      expect(res.body.tables.users).toBeDefined();
      expect(res.body.tables.monthlySnapshots).toBeDefined();
    });
  });

  describe('Part 5: Odoo-Style Module Registry, Life-Stage Presets & Formula Engines', () => {
    it('should initialize RETIREE_GOLDEN_AGE preset with SIMPLE_CLARITY density and RETIREMENT_DRAWDOWN formula', async () => {
      const retireeEmail = `retiree.${Date.now()}@example.com`;
      const regRes = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: retireeEmail,
          password: 'Password123!',
          fullName: 'Golden Age Retiree',
          lifeStagePreset: 'RETIREE_GOLDEN_AGE',
        })
        .expect(201);

      expect(regRes.body.user.lifeStagePreset).toBe('RETIREE_GOLDEN_AGE');
      expect(regRes.body.user.uiDensityMode).toBe('SIMPLE_CLARITY');

      const cfgRes = await request(app.getHttpServer())
        .get('/api/config')
        .set('Authorization', `Bearer ${regRes.body.accessToken}`)
        .expect(200);

      expect(cfgRes.body.lifeStagePreset).toBe('RETIREE_GOLDEN_AGE');
      expect(cfgRes.body.uiDensityMode).toBe('SIMPLE_CLARITY');
      expect(cfgRes.body.formulaEngineType).toBe('RETIREMENT_DRAWDOWN');
      expect(cfgRes.body.enabledModulesJson).toEqual([
        'overview',
        'income',
        'allocations',
        'ledger',
        'preferences',
        'savings_vault',
        'advanced_analytics',
      ]);
    });

    it('should allow tenant to switch Formula Engine and Module Registry via POST /api/config', async () => {
      const updateRes = await request(app.getHttpServer())
        .post('/api/config')
        .set('Authorization', `Bearer ${newMemberToken}`)
        .send({
          baseSalary: 10000000,
          dailyAllowance: 0,
          medicalInsurance: 0,
          tax: 0,
          transport: 500000,
          backhome: 0,
          internet: 400000,
          vape: 200000,
          dailyOperational: 2000000,
          baseSavings: 2000000,
          motherDebt: 0,
          formulaEngineType: 'SAVINGS_FIRST_LOCK',
          formulaParamsJson: { lockedSavingsMode: 'PERCENT', lockedSavingsPercent: 20 },
          enabledModulesJson: ['overview', 'allocations', 'savings_vault', 'ledger'],
          uiDensityMode: 'COMMAND_COCKPIT',
        })
        .expect(201);

      expect(updateRes.body.formulaEngineType).toBe('SAVINGS_FIRST_LOCK');
      expect(updateRes.body.enabledModulesJson).toEqual([
        'overview',
        'allocations',
        'savings_vault',
        'ledger',
      ]);
    });
  });
});
