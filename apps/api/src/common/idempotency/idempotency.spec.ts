import { BadRequestException, ConflictException } from '@nestjs/common';
import { of, throwError, firstValueFrom } from 'rxjs';
import { applySecurityMiddleware } from '../../main';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('Phase 1 Mobile Idempotency-Key & CORS Header Protection', () => {
  it('allows mobile Idempotency-Key and device headers in applySecurityMiddleware CORS config', () => {
    let capturedCorsOpts: any = null;
    const mockApp: any = {
      use: jest.fn(),
      useGlobalPipes: jest.fn(),
      useGlobalFilters: jest.fn(),
      enableCors: jest.fn((opts: any) => {
        capturedCorsOpts = opts;
      }),
    };

    applySecurityMiddleware(mockApp);

    expect(capturedCorsOpts).toBeTruthy();
    const allowedLower = (capturedCorsOpts.allowedHeaders as string[]).map((h) => h.toLowerCase());
    expect(allowedLower).toContain('idempotency-key');
    expect(allowedLower).toContain('x-device-id');
    expect(allowedLower).toContain('x-device-platform');

    const exposedLower = (capturedCorsOpts.exposedHeaders as string[]).map((h) => h.toLowerCase());
    expect(exposedLower).toContain('x-idempotency-replayed');
    expect(exposedLower).toContain('x-request-id');
  });

  it('deduplicates repeated mobile mutation retries, rejects hash mismatches with 409, isolates tenants, and skips caching failures', async () => {
    const records = new Map<string, any>();
    const prismaMock: any = {
      idempotencyRecord: {
        findUnique: jest.fn(async ({ where }: any) => {
          const k = where.userId_method_path_key;
          return records.get(`${k.userId}:${k.method}:${k.path}:${k.key}`) ?? null;
        }),
        create: jest.fn(async ({ data }: any) => {
          const composite = `${data.userId}:${data.method}:${data.path}:${data.key}`;
          if (records.has(composite)) throw new Error('Unique constraint failed');
          const row = { id: records.size + 1, createdAt: new Date(), ...data };
          records.set(composite, row);
          return row;
        }),
        deleteMany: jest.fn(async ({ where }: any) => {
          let count = 0;
          for (const [ck, row] of records.entries()) {
            if (where?.userId !== undefined && row.userId !== where.userId) continue;
            if (where?.key && row.key !== where.key) continue;
            records.delete(ck);
            count++;
          }
          return { count };
        }),
      },
    };

    const service = new IdempotencyService(prismaMock);
    const interceptor = new IdempotencyInterceptor(service);

    const makeContext = (opts: { userId: number; key?: string; body?: any }) => {
      const responseHeaders: Record<string, string> = {};
      const req = {
        method: 'POST',
        baseUrl: '/api/finance',
        route: { path: '/transactions' },
        originalUrl: '/api/finance/transactions',
        userId: opts.userId,
        isAuthenticated: true,
        headers: opts.key ? { 'idempotency-key': opts.key } : {},
        body: opts.body ?? { label: 'Kopi', amount: 35000, month: 11, year: 2026 },
      };
      const res = {
        statusCode: 201,
        setHeader: jest.fn((k: string, v: string) => {
          responseHeaders[k] = v;
        }),
      };
      const ctx: any = {
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => res,
        }),
      };
      return { ctx, responseHeaders };
    };

    // 1. First mobile POST executes real handler and caches response
    let execCount = 0;
    const call1 = makeContext({ userId: 2, key: 'mob-tx-001', body: { label: 'Kopi', amount: 35000 } });
    const out1 = await firstValueFrom(
      await interceptor.intercept(call1.ctx, {
        handle: () => {
          execCount++;
          return of({ id: 901, label: 'Kopi', amount: 35000 });
        },
      }),
    );
    expect(execCount).toBe(1);
    expect(out1).toEqual({ id: 901, label: 'Kopi', amount: 35000 });
    expect(call1.responseHeaders['X-Idempotency-Replayed']).toBe('false');

    // 2. Identical retry on flaky 4G replays cached result with 0 extra handler executions
    const call2 = makeContext({ userId: 2, key: 'mob-tx-001', body: { amount: 35000, label: 'Kopi' } });
    const out2 = await firstValueFrom(
      await interceptor.intercept(call2.ctx, {
        handle: () => {
          execCount++;
          return of({ id: 999 });
        },
      }),
    );
    expect(execCount).toBe(1);
    expect(out2).toEqual({ id: 901, label: 'Kopi', amount: 35000 });
    expect(call2.responseHeaders['X-Idempotency-Replayed']).toBe('true');

    // 3. Reusing the exact same Idempotency-Key with a DIFFERENT payload throws 409 Conflict
    const call3 = makeContext({ userId: 2, key: 'mob-tx-001', body: { label: 'Kopi', amount: 950000 } });
    await expect(
      interceptor.intercept(call3.ctx, {
        handle: () => of({ id: 902 }),
      }),
    ).rejects.toThrow(ConflictException);

    // 4. Cross-tenant isolation: User #1 using the same key does NOT receive User #2's cache
    const callU1 = makeContext({ userId: 1, key: 'mob-tx-001', body: { label: 'Kopi', amount: 35000 } });
    const outU1 = await firstValueFrom(
      await interceptor.intercept(callU1.ctx, {
        handle: () => {
          execCount++;
          return of({ id: 1001, label: 'Kopi', amount: 35000 });
        },
      }),
    );
    expect(execCount).toBe(2);
    expect(outU1).toEqual({ id: 1001, label: 'Kopi', amount: 35000 });

    // 5. Failed request does NOT poison key cache -> retrying succeeds
    const callFail = makeContext({ userId: 2, key: 'mob-tx-err', body: { amount: 10000 } });
    await expect(
      firstValueFrom(
        await interceptor.intercept(callFail.ctx, {
          handle: () => throwError(() => new BadRequestException('Locked period')),
        }),
      ),
    ).rejects.toThrow(BadRequestException);

    const callRetryAfterFix = makeContext({ userId: 2, key: 'mob-tx-err', body: { amount: 10000 } });
    const outFixed = await firstValueFrom(
      await interceptor.intercept(callRetryAfterFix.ctx, {
        handle: () => of({ id: 1002, amount: 10000 }),
      }),
    );
    expect(outFixed).toEqual({ id: 1002, amount: 10000 });
  });
});
