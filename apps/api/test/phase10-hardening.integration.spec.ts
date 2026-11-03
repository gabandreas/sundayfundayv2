import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { extractClientIp, verifyPin } from '../src/auth/auth.utils';
import { RestoreMode } from '../src/admin/dto/restore-backup.dto';

describe('Phase 10 — Production Hardening, Rate Limiting & Transactional Restore (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let ownerToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);

    // Ensure rate limiter is clear
    authService.getRateLimiter().clearAll();

    // Log in as Platform Owner
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'owner@sundayfunday.id',
        password: 'SundayFunday#2026',
      });
    ownerToken = res.body.accessToken;
  });

  afterAll(async () => {
    authService.getRateLimiter().clearAll();
    await app.close();
  });

  describe('Part 1: Reverse Proxy IP Extraction Utility', () => {
    it('should prioritize cf-connecting-ip header', () => {
      const mockReq: any = {
        headers: {
          'cf-connecting-ip': '203.0.113.195',
          'x-forwarded-for': '198.51.100.1, 192.0.2.1',
          'x-real-ip': '192.0.2.55',
        },
        socket: { remoteAddress: '127.0.0.1' },
      };
      expect(extractClientIp(mockReq)).toBe('203.0.113.195');
    });

    it('should extract first IP from x-forwarded-for header when cf-connecting-ip is missing', () => {
      const mockReq: any = {
        headers: {
          'x-forwarded-for': '198.51.100.42, 10.0.0.1, 172.16.0.1',
          'x-real-ip': '10.0.0.1',
        },
        socket: { remoteAddress: '127.0.0.1' },
      };
      expect(extractClientIp(mockReq)).toBe('198.51.100.42');
    });

    it('should use x-real-ip when preceding headers are missing', () => {
      const mockReq: any = {
        headers: {
          'x-real-ip': '192.0.2.99',
        },
        socket: { remoteAddress: '127.0.0.1' },
      };
      expect(extractClientIp(mockReq)).toBe('192.0.2.99');
    });

    it('should strip IPv6 mapped IPv4 prefix (::ffff:)', () => {
      const mockReq: any = {
        headers: {},
        socket: { remoteAddress: '::ffff:192.168.1.50' },
      };
      expect(extractClientIp(mockReq)).toBe('192.168.1.50');
    });
  });

  describe('Part 2: Brute-Force Rate Limiting Guard', () => {
    beforeEach(() => {
      authService.getRateLimiter().clearAll();
    });

    it('should lock out an (email, ip) after 5 consecutive failed attempts with HTTP 429', async () => {
      const targetEmail = 'victim@sundayfunday.id';
      const clientIp = '103.20.15.5';

      // Attempts 1 to 4 should return 401 Unauthorized
      for (let i = 1; i <= 4; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/auth/login')
          .set('x-forwarded-for', clientIp)
          .send({
            email: targetEmail,
            password: `WrongPassword${i}`,
          })
          .expect(401);

        expect(res.body.message).toContain('Invalid email or password');
      }

      // 5th attempt must trigger 429 Too Many Requests
      const lockedRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('x-forwarded-for', clientIp)
        .send({
          email: targetEmail,
          password: 'WrongPassword5',
        })
        .expect(429);

      expect(lockedRes.body.message).toContain('Too many failed login attempts');
      expect(lockedRes.body.message).toContain('15 minutes');

      // Subsequent attempt remains locked
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('x-forwarded-for', clientIp)
        .send({
          email: targetEmail,
          password: 'AnyPassword',
        })
        .expect(429);
    });

    it('should reset failed attempt counter after a successful login', async () => {
      const clientIp = '103.20.15.6';

      // 2 failed attempts
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .set('x-forwarded-for', clientIp)
          .send({
            email: 'owner@sundayfunday.id',
            password: 'BadPassword',
          })
          .expect(401);
      }

      // Successful login resets counter
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('x-forwarded-for', clientIp)
        .send({
          email: 'owner@sundayfunday.id',
          password: 'SundayFunday#2026',
        })
        .expect(200);

      // Now 4 more failures should NOT trigger 429 because count was reset to 0
      for (let i = 0; i < 4; i++) {
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .set('x-forwarded-for', clientIp)
          .send({
            email: 'owner@sundayfunday.id',
            password: `BadPassword${i}`,
          })
          .expect(401);
      }
    });
  });

  describe('Part 3: Transactional Database Backup Restore', () => {
    let exportedBackup: any;

    beforeAll(async () => {
      // Export current state to use as payload
      const exportRes = await request(app.getHttpServer())
        .get('/api/admin/backup/export')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      exportedBackup = exportRes.body;
      if (!exportedBackup || !exportedBackup.tables) {
        try {
          exportedBackup = JSON.parse(exportRes.text);
        } catch {}
      }
      expect(exportedBackup.tables).toBeDefined();
    });

    it('should perform VALIDATE_DRY_RUN without writing any changes', async () => {
      const dryRunRes = await request(app.getHttpServer())
        .post('/api/admin/backup/restore')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          backup: exportedBackup,
          mode: RestoreMode.VALIDATE_DRY_RUN,
        })
        .expect(200);

      expect(dryRunRes.body.valid).toBe(true);
      expect(dryRunRes.body.summary).toBeDefined();
      expect(dryRunRes.body.message).toContain('validated successfully');
      expect(dryRunRes.body.summary.users).toBeGreaterThanOrEqual(1);
    });

    it('should reject RESTORE_OVERWRITE if confirm text or security PIN is missing or invalid', async () => {
      // Missing / invalid confirmation text
      await request(app.getHttpServer())
        .post('/api/admin/backup/restore')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          backup: exportedBackup,
          mode: RestoreMode.RESTORE_OVERWRITE,
          confirmationText: 'wrong text',
          securityPin: '271026',
        })
        .expect(400);

      // Invalid PIN
      await request(app.getHttpServer())
        .post('/api/admin/backup/restore')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          backup: exportedBackup,
          mode: RestoreMode.RESTORE_OVERWRITE,
          confirmationText: 'CONFIRM RESTORE',
          securityPin: '000000',
        })
        .expect(401);
    });

    it('should execute atomic RESTORE_OVERWRITE inside transaction and reset sequences on test DB', async () => {
      const restoreRes = await request(app.getHttpServer())
        .post('/api/admin/backup/restore')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          backup: exportedBackup,
          mode: RestoreMode.RESTORE_OVERWRITE,
          confirmationText: 'CONFIRM RESTORE',
          securityPin: '271026',
        });

      if (restoreRes.status !== 200) {
        console.error('RESTORE_OVERWRITE FAILED:', restoreRes.status, restoreRes.body);
      }
      expect(restoreRes.status).toBe(200);

      expect(restoreRes.body.success).toBe(true);
      expect(restoreRes.body.restoredCounts).toBeDefined();

      // Verify that after sequence reset, inserting a new record works with auto-increment
      const newBill = await prisma.scheduledBill.create({
        data: {
          label: 'Sequence Test Bill',
          amount: 50000,
          dueDayOfMonth: 1,
        },
      });
      expect(newBill.id).toBeGreaterThan(0);

      // Clean up test record
      await prisma.scheduledBill.delete({ where: { id: newBill.id } });
    });
  });

  describe('Part 4: Owner Credentials & Security Hardening Self-Service', () => {
    it('should reject credential update if current password is incorrect', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/security/credentials')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          currentPassword: 'WrongCurrentPassword',
          newSecurityPin: '123456',
        })
        .expect(401);
    });

    it('should successfully update security PIN when current password matches', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/security/credentials')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          currentPassword: 'SundayFunday#2026',
          newSecurityPin: '987654',
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify PIN updated in DB via verifyPin
      const owner = await prisma.user.findUnique({ where: { id: 1 } });
      expect(owner?.securityPinHash).toBeDefined();
      expect(verifyPin('987654', owner!.securityPinHash!)).toBe(true);

      // Restore default PIN for test idempotency
      await request(app.getHttpServer())
        .post('/api/admin/security/credentials')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          currentPassword: 'SundayFunday#2026',
          newSecurityPin: '271026',
        })
        .expect(200);
    });
  });
});

