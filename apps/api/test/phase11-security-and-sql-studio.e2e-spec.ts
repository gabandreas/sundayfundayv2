import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Phase 11 — Pre-Deployment Enterprise Auth Gate & Superadmin SQL Studio (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superadminToken: string;
  let memberToken: string;
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
    // Clean up any test users created during this test run
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

    // Clean up any test trusted IP addresses on owner
    await prisma.trustedIpAddress.deleteMany({
      where: { userId: 1, label: { in: ['Test E2E IP', 'Updated E2E IP'] } },
    });

    await app.close();
  });

  describe('Part 1: Strict Unauthenticated Access Protection (401)', () => {
    it('Test 1: Unauthenticated requests to protected SQL Studio endpoints return 401', async () => {
      // 1. Missing Authorization header
      await request(app.getHttpServer())
        .get('/api/admin/sql/tables')
        .expect(401);

      // 2. Missing Authorization header on query execution
      await request(app.getHttpServer())
        .post('/api/admin/sql/query')
        .send({ sql: 'SELECT 1;' })
        .expect(401);

      // 3. Invalid / malformed bearer token
      await request(app.getHttpServer())
        .get('/api/admin/sql/tables')
        .set('Authorization', 'Bearer invalid.bogus.token')
        .expect(401);
    });
  });

  describe('Part 2: 3-Field Superadmin Login & Session Management', () => {
    it('Test 2: 3-Field Superadmin login succeeds and returns valid JWT with 1800s session timer', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          accountName: 'cheeseburger',
          username: 'cheeseburger',
          password: 'Djakarta2026Nov!@#',
        })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.expiresIn).toBe(1800);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.accountName).toBe('cheeseburger');
      expect(res.body.user.username).toBe('cheeseburger');
      expect(res.body.user.role).toBe('PLATFORM_OWNER');
      expect(res.body.user.id).toBe(1);

      superadminToken = res.body.accessToken;

      // Verify session status endpoint
      const sessionRes = await request(app.getHttpServer())
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(sessionRes.body.valid).toBe(true);
      expect(sessionRes.body.remainingSeconds).toBeGreaterThan(1700);

      // Verify session refresh endpoint
      const refreshRes = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.expiresIn).toBe(1800);
      superadminToken = refreshRes.body.accessToken;
    });

    it('Test 3: Login with wrong accountName, username, or password fails with 401', async () => {
      // Wrong accountName
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          accountName: 'wrong_account',
          username: 'cheeseburger',
          password: 'Djakarta2026Nov!@#',
        })
        .expect(401);

      // Wrong username
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          accountName: 'cheeseburger',
          username: 'wrong_user',
          password: 'Djakarta2026Nov!@#',
        })
        .expect(401);

      // Wrong password
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          accountName: 'cheeseburger',
          username: 'cheeseburger',
          password: 'WrongPassword#123',
        })
        .expect(401);
    });
  });

  describe('Part 3: Closed Provisioning & Tenant Isolation', () => {
    it('Test 4: Superadmin provisions new user via /api/admin/users, who can authenticate via 3 fields', async () => {
      const timestamp = Date.now().toString().slice(-4);
      const acc = `tenant_${timestamp}`;
      const usr = `member_${timestamp}`;
      const email = `member.${timestamp}@example.com`;
      const pass = 'BespokePass#2026';

      const createRes = await request(app.getHttpServer())
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          accountName: acc,
          username: usr,
          email,
          fullName: `Tenant Member ${timestamp}`,
          password: pass,
          role: 'STANDARD_MEMBER',
          blueprintType: 'STANDARD_GENERAL',
          lifeStagePreset: 'CORPORATE_PROFESSIONAL',
        })
        .expect(201);

      expect(createRes.body.id).toBeDefined();
      newMemberId = createRes.body.id;

      // New user logs in using 3-field credentials
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          accountName: acc,
          username: usr,
          password: pass,
        })
        .expect(200);

      expect(loginRes.body.accessToken).toBeDefined();
      expect(loginRes.body.user.role).toBe('STANDARD_MEMBER');
      expect(loginRes.body.user.accountName).toBe(acc);
      expect(loginRes.body.user.username).toBe(usr);

      memberToken = loginRes.body.accessToken;

      // Isolated user config exists
      const configRes = await request(app.getHttpServer())
        .get('/api/config')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(configRes.body.userId).toBe(newMemberId);
    });

    it('Test 5: Non-superadmin user (STANDARD_MEMBER) is blocked from SQL Studio with 403 Forbidden', async () => {
      // 1. Attempt to list tables
      await request(app.getHttpServer())
        .get('/api/admin/sql/tables')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);

      // 2. Attempt to execute raw SQL
      await request(app.getHttpServer())
        .post('/api/admin/sql/query')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ sql: 'SELECT 1;' })
        .expect(403);

      // 3. Attempt to browse records
      await request(app.getHttpServer())
        .get('/api/admin/sql/records/User')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });
  });

  describe('Part 4: Superadmin SQL Studio Execution & E2E CRUD', () => {
    it('Test 6a: Superadmin executes SELECT query with telemetry in READ_ONLY mode', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/sql/query')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          sql: 'SELECT 42 AS answer, \'hello\' AS greeting;',
          mode: 'READ_ONLY',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.mode).toBe('READ_ONLY');
      expect(res.body.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(res.body.rowCount).toBe(1);
      expect(res.body.rows[0].answer).toBe(42);
      expect(res.body.rows[0].greeting).toBe('hello');
    });

    it('Test 6b: READ_ONLY mode guard rejects mutating statements with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/sql/query')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          sql: 'DELETE FROM "Transaction" WHERE id = 999999;',
          mode: 'READ_ONLY',
        })
        .expect(400);

      expect(res.body.message).toContain('Database mutation is forbidden in READ_ONLY mode');
    });

    it('Test 6c: DRY_RUN_ROLLBACK mode runs query and safely rolls back changes', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/admin/sql/query')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          sql: 'INSERT INTO "TrustedIpAddress" ("userId", "ipAddress", "label") VALUES (1, \'192.168.1.200\', \'DryRunTest\');',
          mode: 'DRY_RUN_ROLLBACK',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.mode).toBe('DRY_RUN_ROLLBACK');
      expect(res.body.rolledBack).toBe(true);

      // Verify the record was NOT committed to the database
      const check = await prisma.trustedIpAddress.findFirst({
        where: { ipAddress: '192.168.1.200' },
      });
      expect(check).toBeNull();
    });

    it('Test 6d: Superadmin inspects tables catalog and row metadata', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/sql/tables')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const userTable = res.body.find((t: any) => t.tableName === 'User');
      expect(userTable).toBeDefined();
      expect(userTable.primaryKey).toBe('id');
      expect(userTable.columns.some((c: any) => c.columnName === 'accountName')).toBe(true);
      expect(userTable.columns.some((c: any) => c.columnName === 'username')).toBe(true);
    });

    it('Test 6e: Superadmin browses and executes full E2E CRUD via /api/admin/sql/records/*', async () => {
      // 1. Browse records
      const browseRes = await request(app.getHttpServer())
        .get('/api/admin/sql/records/User?page=1&limit=10')
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(browseRes.body.tableName).toBe('User');
      expect(browseRes.body.rows.length).toBeGreaterThan(0);

      // 2. Insert record via SQL Studio endpoint
      const insertRes = await request(app.getHttpServer())
        .post('/api/admin/sql/records/TrustedIpAddress')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          userId: 1,
          ipAddress: '10.200.0.50',
          label: 'Test E2E IP',
          isActive: true,
        })
        .expect(201);

      expect(insertRes.body.id).toBeDefined();
      const createdId = insertRes.body.id;

      // 3. Update record via SQL Studio endpoint
      const updateRes = await request(app.getHttpServer())
        .patch(`/api/admin/sql/records/TrustedIpAddress/${createdId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          label: 'Updated E2E IP',
        })
        .expect(200);

      expect(updateRes.body.label).toBe('Updated E2E IP');

      // 4. Delete record via SQL Studio endpoint
      const deleteRes = await request(app.getHttpServer())
        .delete(`/api/admin/sql/records/TrustedIpAddress/${createdId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);

      expect(deleteRes.body.success).toBe(true);

      // Verify deletion in database
      const deletedCheck = await prisma.trustedIpAddress.findUnique({
        where: { id: createdId },
      });
      expect(deletedCheck).toBeNull();
    });
  });
});
