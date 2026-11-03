import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Phase 12 — Privacy Masking & General Sandbox (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superadminToken: string;
  let demoToken: string;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      'postgresql://postgres:password@127.0.0.1:5433/finance_erp_test?schema=public';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Authenticate superadmin
    const saLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        accountName: 'cheeseburger',
        username: 'cheeseburger',
        password: 'Djakarta2026Nov!@#',
      });
    superadminToken = saLogin.body.accessToken;

    // Authenticate demo sandbox
    const recLogin = await request(app.getHttpServer())
      .post('/api/auth/demo-login');
    demoToken = recLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Part 1: Password Verification Endpoint (POST /api/auth/verify-password)', () => {
    it('returns 401 Unauthorized when unauthenticated', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-password')
        .send({ password: 'any' });
      expect(res.status).toBe(401);
    });

    it('returns 400 Bad Request when password is empty', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-password')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ password: '' });
      expect(res.status).toBe(400);
    });

    it('returns 401 Unauthorized on incorrect password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-password')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ password: 'WrongPassword123!' });
      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid account password');
    });

    it('returns 200 { verified: true } on correct superadmin password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-password')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ password: 'Djakarta2026Nov!@#' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ verified: true });
    });
  });

  describe('Part 2: General Sandbox Authentication & Isolation', () => {
    it('authenticates via 3 fields (demo / guest / Sandbox2026!)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          accountName: 'demo',
          username: 'guest',
          password: 'Sandbox2026!',
        });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('DEMO_SANDBOX');
      expect(res.body.user.fullName).toBe('General Sandbox (Demo)');
    });

    it('verifies sandbox password successfully via /api/auth/verify-password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-password')
        .set('Authorization', `Bearer ${demoToken}`)
        .send({ password: 'Sandbox2026!' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ verified: true });
    });

    it('strictly forbids demo sandbox from accessing /api/admin/sql/*', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/sql/tables')
        .set('Authorization', `Bearer ${demoToken}`);
      expect(res.status).toBe(403);
    });
  });
});
