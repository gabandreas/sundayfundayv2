import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PlatformOwnerGuard } from './roles.guard';

function createMockContext(user?: { id: number; role: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        isAuthenticated: Boolean(user),
        headers: user ? { authorization: 'Bearer test-token' } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('PlatformOwnerGuard (USER vs SUPERADMIN Role Isolation)', () => {
  let guard: PlatformOwnerGuard;

  beforeEach(() => {
    guard = new PlatformOwnerGuard();
  });

  it('rejects unauthenticated requests with UnauthorizedException', () => {
    expect(() => guard.canActivate(createMockContext(undefined))).toThrow(UnauthorizedException);
  });

  it('rejects DEMO_SANDBOX (userId = 2) with ForbiddenException', () => {
    expect(() =>
      guard.canActivate(createMockContext({ id: 2, role: 'DEMO_SANDBOX' })),
    ).toThrow(ForbiddenException);
  });

  it('rejects standard USER consumer role even for Gabriel (userId = 1) with ForbiddenException', () => {
    expect(() =>
      guard.canActivate(createMockContext({ id: 1, role: 'USER' })),
    ).toThrow(ForbiddenException);
  });

  it('rejects legacy PLATFORM_OWNER string once strict SUPERADMIN role is enforced', () => {
    expect(() =>
      guard.canActivate(createMockContext({ id: 1, role: 'PLATFORM_OWNER' })),
    ).toThrow(ForbiddenException);
  });

  it('allows dedicated SUPERADMIN account regardless of numeric id (e.g. id != 1)', () => {
    expect(guard.canActivate(createMockContext({ id: 3, role: 'SUPERADMIN' }))).toBe(true);
    expect(guard.canActivate(createMockContext({ id: 99, role: 'SUPERADMIN' }))).toBe(true);
  });
});
