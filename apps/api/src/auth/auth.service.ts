import * as crypto from 'crypto';
import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimiterService } from './rate-limiter.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '../config/config.service';
import { SsoService } from './sso.service';
import { isSyntheticProbeIdentifier } from '../email/smtp-transport.util';
import {
  hashPassword,
  verifyPassword,
  verifyPasswordWithStatus,
  isPasswordHashV2,
  hashPin,
  verifyPin,
  isWeakPin,
  hashOpaqueToken,
  generateOpaqueRefreshToken,
  generatePasswordResetToken,
  generateSecureTemporaryPassword,
  validatePasswordStrength,
  normalizeAndValidatePublicKeyPem,
  verifyBiometricSignature,
  signToken,
  verifyToken,
  normalizeIp,
  isLocalhost,
  DUMMY_SCRYPT_HASH,
} from './auth.utils';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CompleteFirstLoginPasswordDto } from './dto/complete-first-login-password.dto';
import {
  RefreshTokenDto,
  SetupPinDto,
  VerifyPinDto,
  EnrollBiometricDto,
  BiometricChallengeDto,
  VerifyBiometricDto,
  SsoExchangeDto,
} from './dto/mobile-auth.dto';
import {
  AuthenticatedUser,
  BlueprintType,
  DEFAULT_STANDARD_ROUTINE_LABELS,
  LifeStagePreset,
  SUNDAY_FUNDAY_STANDARD_MODULES,
  UiDensityMode,
  UserRole,
  UserStatus,
  getLifeStagePresetDefaults,
} from './auth.types';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  private readonly BIOMETRIC_CHALLENGE_TTL_MS = 120 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimiter: RateLimiterService,
    @Optional() private readonly emailService?: EmailService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly ssoService?: SsoService,
  ) {}

  private hasMobileAuthStore(): boolean {
    return typeof (this.prisma as any)?.refreshToken?.create === 'function';
  }

  private async recordSecurityAudit(params: {
    userId: number;
    action: string;
    severity?: 'INFO' | 'WARNING' | 'DEFICIT' | 'ADJUSTMENT';
    summary: string;
    details?: Record<string, any>;
  }) {
    if (typeof (this.prisma as any)?.auditLog?.create !== 'function') return;
    await (this.prisma as any).auditLog
      .create({
        data: {
          userId: params.userId,
          category: 'SETTINGS',
          action: params.action,
          severity: params.severity ?? 'INFO',
          summary: params.summary,
          details: params.details ? JSON.stringify(params.details) : undefined,
        },
      })
      .catch(() => {});
  }

  private async issueSessionBundle(
    user: any,
    meta?: {
      deviceId?: string;
      deviceName?: string;
      platform?: string;
      appVersion?: string;
      clientIp?: string;
      familyId?: string;
      rotatedFromId?: string;
    },
  ) {
    let refreshToken: string | undefined;
    let sessionId: string | undefined;

    if (this.hasMobileAuthStore()) {
      const platform = meta?.platform || (meta?.deviceId ? 'ANDROID' : 'WEB');
      if (
        meta?.deviceId &&
        typeof (this.prisma as any)?.mobileDevice?.upsert === 'function'
      ) {
        await (this.prisma as any).mobileDevice.upsert({
          where: {
            userId_deviceId: { userId: user.id, deviceId: meta.deviceId },
          },
          create: {
            userId: user.id,
            deviceId: meta.deviceId,
            deviceName: meta.deviceName || meta.deviceId,
            platform,
            appVersion: meta.appVersion,
            biometricEnabled: false,
            lastActiveAt: new Date(),
          },
          update: {
            deviceName: meta.deviceName || undefined,
            platform,
            appVersion: meta.appVersion || undefined,
            lastActiveAt: new Date(),
            revokedAt: null,
          },
        });
      }

      const opaque = generateOpaqueRefreshToken();
      const familyId = meta?.familyId || crypto.randomUUID();
      const expiresAt = new Date(Date.now() + this.REFRESH_TTL_MS);

      const created = await (this.prisma as any).refreshToken.create({
        data: {
          userId: user.id,
          familyId,
          tokenHash: opaque.hash,
          deviceId: meta?.deviceId ?? null,
          deviceName: meta?.deviceName ?? null,
          platform,
          clientIp: meta?.clientIp ?? null,
          expiresAt,
        },
      });

      if (meta?.rotatedFromId) {
        await (this.prisma as any).refreshToken.update({
          where: { id: meta.rotatedFromId },
          data: {
            revokedAt: new Date(),
            revokeReason: 'ROTATED',
            replacedById: created.id,
          },
        });
      }

      refreshToken = opaque.raw;
      sessionId = created.id;
    }

    const accessToken = signToken(
      {
        sub: user.id,
        sid: sessionId,
        tv: user.tokenVersion ?? 0,
        mcp: Boolean(user.mustChangePassword),
        accountName: user.accountName || 'cheeseburger',
        username: user.username || 'cheeseburger',
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        blueprintType: user.blueprintType,
      },
      1800,
    );

    return {
      accessToken,
      ...(refreshToken ? { refreshToken } : {}),
      ...(sessionId ? { sessionId } : {}),
      expiresIn: 1800,
      hasSecurityPin: Boolean(user.securityPinHash),
      mustChangePassword: Boolean(user.mustChangePassword),
      user: this.toAuthenticatedUser(user),
    };
  }

  private async checkRateLimit(rateLimitKey: string, clientIp: string): Promise<void> {
    if (typeof (this.rateLimiter as any).checkAsync === 'function') {
      await this.rateLimiter.checkAsync(rateLimitKey, clientIp);
      return;
    }
    this.rateLimiter.check(rateLimitKey, clientIp);
  }

  private async recordRateLimitFailure(rateLimitKey: string, clientIp: string): Promise<void> {
    if (typeof (this.rateLimiter as any).recordFailureAsync === 'function') {
      await this.rateLimiter.recordFailureAsync(rateLimitKey, clientIp);
      return;
    }
    this.rateLimiter.recordFailure(rateLimitKey, clientIp);
  }

  private async recordRateLimitSuccess(rateLimitKey: string, clientIp: string): Promise<void> {
    if (typeof (this.rateLimiter as any).recordSuccessAsync === 'function') {
      await this.rateLimiter.recordSuccessAsync(rateLimitKey, clientIp);
      return;
    }
    if (typeof this.rateLimiter.recordSuccess === 'function') {
      this.rateLimiter.recordSuccess(rateLimitKey, clientIp);
    }
  }

  private async recordLoginFailureWithAlert(
    rateLimitKey: string,
    clientIp: string,
    userId?: number,
  ): Promise<void> {
    try {
      await this.recordRateLimitFailure(rateLimitKey, clientIp);
    } catch (err) {
      if (
        err instanceof HttpException &&
        err.getStatus() === HttpStatus.TOO_MANY_REQUESTS &&
        !isSyntheticProbeIdentifier(rateLimitKey)
      ) {
        void this.emailService?.sendSecurityLockoutAlert({
          userId: userId ?? 1,
          attemptedIdentifier: rateLimitKey || 'unknown',
          clientIp,
        });
      }
      throw err;
    }
  }

  async onModuleInit() {
    await this.bootstrapDefaultAccounts();
  }

  /**
   * Idempotently seeds User #1 (Primary Consumer), User #2 (Demo Sandbox), and System Superadmin
   * on an empty database without ever overwriting existing credentials or financial rows.
   */
  async bootstrapDefaultAccounts() {
    try {
      // 1. Ensure User #1 (Primary Consumer) exists without altering existing credentials
      const ownerEmail = process.env.OWNER_EMAIL || process.env.SUPERADMIN_EMAIL || 'gabandreas22@gmail.com';
      let owner = await this.prisma.user.findFirst({
        where: { OR: [{ id: 1 }, { email: ownerEmail }] },
      });

      if (!owner) {
        const initialOwnerPass =
          process.env.OWNER_INITIAL_PASSWORD || generateSecureTemporaryPassword(16);
        const initialOwnerPin = process.env.OWNER_INITIAL_PIN;
        owner = await this.prisma.user.create({
          data: {
            id: 1,
            accountName: 'cheeseburger',
            username: 'cheeseburger',
            email: ownerEmail,
            passwordHash: hashPassword(initialOwnerPass),
            fullName: 'Gabriel',
            role: 'USER',
            status: 'ACTIVE',
            blueprintType: 'SUPERADMIN_BESPOKE',
            lifeStagePreset: 'SUPERADMIN_BESPOKE',
            uiDensityMode: 'COMMAND_COCKPIT',
            ...(initialOwnerPin ? { securityPinHash: hashPin(initialOwnerPin) } : {}),
            ipWhitelistEnforced: false,
          },
        });
      } else {
        const updates: any = {};
        if (owner.role !== 'USER') updates.role = 'USER';
        if (owner.blueprintType !== 'SUPERADMIN_BESPOKE') updates.blueprintType = 'SUPERADMIN_BESPOKE';
        if (owner.lifeStagePreset !== 'SUPERADMIN_BESPOKE') updates.lifeStagePreset = 'SUPERADMIN_BESPOKE';
        if (owner.accountName !== 'cheeseburger') updates.accountName = 'cheeseburger';
        if (owner.username !== 'cheeseburger') updates.username = 'cheeseburger';
        if (!owner.fullName) updates.fullName = 'Gabriel';

        if (Object.keys(updates).length > 0) {
          await this.prisma.user.update({
            where: { id: owner.id },
            data: updates,
          });
        }
      }

      await this.prisma.$executeRawUnsafe(
        'SELECT setval(\'"User_id_seq"\', (SELECT GREATEST(MAX(id), 1) FROM "User"))',
      ).catch(() => {});

      // Pre-whitelist localhost for Owner
      const localhostIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
      for (const ip of localhostIps) {
        const existing = await this.prisma.trustedIpAddress.findFirst({
          where: { userId: owner.id, ipAddress: ip },
        });
        if (!existing) {
          await this.prisma.trustedIpAddress.create({
            data: {
              userId: owner.id,
              ipAddress: ip,
              label: 'Localhost / Dev',
              isActive: true,
            },
          });
        }
      }

      // 2. Ensure User #2 (General Sandbox Demo Account) exists using Sunday Funday Standard modules
      const demoEmail = 'demo@sundayfunday.id';
      let demoUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { id: 2 },
            { email: demoEmail },
            { accountName: 'demo', username: 'guest' },
            { accountName: 'portfolio', username: 'recruiter' },
          ],
        },
      });

      if (!demoUser) {
        const initialDemoPass =
          process.env.DEMO_INITIAL_PASSWORD || generateSecureTemporaryPassword(16);
        demoUser = await this.prisma.user.create({
          data: {
            id: 2,
            accountName: 'demo',
            username: 'guest',
            email: demoEmail,
            passwordHash: hashPassword(initialDemoPass),
            fullName: 'General Sandbox (Demo)',
            role: 'DEMO_SANDBOX',
            status: 'ACTIVE',
            blueprintType: 'STANDARD_GENERAL',
            lifeStagePreset: 'CORPORATE_PROFESSIONAL',
            uiDensityMode: 'COMMAND_COCKPIT',
            ipWhitelistEnforced: false,
          },
        });
      } else {
        const demoUpdates: any = {};
        if (demoUser.accountName !== 'demo') demoUpdates.accountName = 'demo';
        if (demoUser.username !== 'guest') demoUpdates.username = 'guest';
        if (demoUser.fullName !== 'General Sandbox (Demo)') demoUpdates.fullName = 'General Sandbox (Demo)';
        if (demoUser.role !== 'DEMO_SANDBOX') demoUpdates.role = 'DEMO_SANDBOX';
        if (Object.keys(demoUpdates).length > 0) {
          demoUser = await this.prisma.user.update({
            where: { id: demoUser.id },
            data: demoUpdates,
          });
        }
      }

      // Ensure Demo user has their own isolated GlobalConfig aligned with Sunday Funday Standard
      const demoConfig = await this.prisma.globalConfig.findUnique({
        where: { userId: demoUser.id },
      });

      if (!demoConfig) {
        await this.prisma.globalConfig.create({
          data: {
            userId: demoUser.id,
            baseSalary: 10000000,
            dailyAllowance: 0,
            laptopAllowance: 0,
            dailyOperational: 2500000,
            transport: 500000,
            internet: 350000,
            vape: 500000,
            haircut: 150000,
            baseSavings: 1500000,
            creditLimit: 15000000,
            creditStatementDay: 25,
            creditDueDay: 11,
            payrollPayoutDay: 25,
            profileMode: 'STANDARD_GENERAL',
            payrollMode: 'SIMPLE_FIXED_SALARY',
            lifeStagePreset: 'CORPORATE_PROFESSIONAL',
            uiDensityMode: 'COMMAND_COCKPIT',
            formulaEngineType: 'DEBT_FIRST_WATERFALL',
            enabledModulesJson: SUNDAY_FUNDAY_STANDARD_MODULES as any,
            customRoutineLabelsJson: DEFAULT_STANDARD_ROUTINE_LABELS as any,
          },
        });
      }

      // Ensure Demo user has at least one initial sample snapshot
      const demoSnapshot = await this.prisma.monthlySnapshot.findFirst({
        where: { userId: demoUser.id },
      });

      if (!demoSnapshot) {
        await this.seedDemoWorkspace(demoUser.id);
      }

      // 3. Dedicated System SUPERADMIN Account (never overwrites existing credentials)
      const superadminUsername = 'superadmin';
      const superadminEmail = process.env.SYS_ADMIN_EMAIL || 'superadmin@sundayfunday.erp';
      const existingSuperadmin = await this.prisma.user.findFirst({
        where: { OR: [{ username: superadminUsername }, { role: 'SUPERADMIN' }] },
      });

      if (!existingSuperadmin) {
        const initialAdminPass =
          process.env.SYS_ADMIN_PASSWORD || generateSecureTemporaryPassword(16);
        const initialAdminPin = process.env.SYS_ADMIN_INITIAL_PIN;
        await this.prisma.user.create({
          data: {
            accountName: superadminUsername,
            username: superadminUsername,
            email: superadminEmail,
            passwordHash: hashPassword(initialAdminPass),
            fullName: 'System Superadmin',
            role: 'SUPERADMIN',
            status: 'ACTIVE',
            blueprintType: 'SUPERADMIN_BESPOKE',
            lifeStagePreset: 'SUPERADMIN_BESPOKE',
            uiDensityMode: 'COMMAND_COCKPIT',
            ...(initialAdminPin ? { securityPinHash: hashPin(initialAdminPin) } : {}),
            ipWhitelistEnforced: false,
          },
        });
      }
    } catch (err) {
      console.error('[AuthService] Error in bootstrapDefaultAccounts:', err);
    }
  }

  async seedDemoWorkspace(userId: number) {
    const createdSnapshot = await this.prisma.monthlySnapshot.create({
      data: {
        userId,
        month: 10,
        year: 2026,
        status: 'DRAFT',
        finalTotalIncome: 10000000,
        netSalaryIncome: 10000000,
        totalDeductions: 3500000,
        dailyOperational: 2500000,
        actualDailyOperational: 2500000,
        transport: 500000,
        internet: 350000,
        vape: 500000,
        haircut: 150000,
        savings: 1500000,
        actualSavings: 1500000,
        selfRewardTarget: 0,
        selfReward: 0,
        deficitUncovered: 0,
      },
    });

    // Add sample transactions for Demo user
    await this.prisma.transaction.createMany({
      data: [
        {
          snapshotId: createdSnapshot.id,
          type: 'DEDUCTION',
          sourceType: 'BULK_BILL',
          label: 'Apartment Rent & Utilities',
          amount: 2500000,
          date: new Date('2026-10-01'),
        },
        {
          snapshotId: createdSnapshot.id,
          type: 'CREDIT_BILL',
          sourceType: 'CC_TRANSACTION',
          label: 'Cloud & SaaS Subscriptions',
          amount: 1000000,
          date: new Date('2026-10-05'),
        },
      ],
    });
  }

  getRateLimiter(): RateLimiterService {
    return this.rateLimiter;
  }

  async login(dto: LoginDto, clientIp: string) {
    let user: any = null;
    let rateLimitKey = '';

    const acc = dto.accountName?.trim();
    const usr = dto.username?.trim();

    // 1. Authenticate via Account Name + Username or Username fallback (Enterprise 3-field flow)
    if (acc && usr) {
      rateLimitKey = `${acc}:${usr}`.toLowerCase();
      await this.checkRateLimit(rateLimitKey, clientIp);

      user = await this.prisma.user.findFirst({
        where: {
          accountName: { equals: acc, mode: 'insensitive' },
          username: { equals: usr, mode: 'insensitive' },
        },
      });
    } else if (usr) {
      rateLimitKey = usr.toLowerCase();
      await this.checkRateLimit(rateLimitKey, clientIp);

      user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: usr, mode: 'insensitive' } },
            { email: { equals: usr, mode: 'insensitive' } },
            { accountName: { equals: usr, mode: 'insensitive' } },
          ],
        },
      });
    } else if (dto.email) {
      // 2. Legacy / test-mode fallback via email
      const email = dto.email.trim().toLowerCase();
      rateLimitKey = email;
      await this.checkRateLimit(rateLimitKey, clientIp);

      user = await this.prisma.user.findUnique({
        where: { email },
      });
    } else {
      throw new UnauthorizedException('Username or email is required.');
    }

    const failureMessage = dto.accountName
      ? 'Invalid account name, username, or password.'
      : 'Invalid email or password.';

    if (!user) {
      // Constant-time dummy scrypt hash verification to prevent user enumeration timing leaks
      verifyPasswordWithStatus(dto.password || '', DUMMY_SCRYPT_HASH);
      await this.recordLoginFailureWithAlert(rateLimitKey || 'unknown', clientIp);
      throw new UnauthorizedException(failureMessage);
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Your account has been suspended. Contact support.');
    }

    const pwStatus = verifyPasswordWithStatus(dto.password, user.passwordHash);
    if (!pwStatus.isValid) {
      await this.recordLoginFailureWithAlert(rateLimitKey || user.email, clientIp, user.id);
      throw new UnauthorizedException(failureMessage);
    }

    // Auto-upgrade legacy hash to scryptv2 upon successful verification
    if (pwStatus.needsUpgrade || !isPasswordHashV2(user.passwordHash)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(dto.password) },
      }).catch(() => {});
    }

    const normalizedClientIp = normalizeIp(clientIp);

    // Smart IP Whitelist Guard for SUPERADMIN / protected accounts
    if ((user.role === 'SUPERADMIN' || user.id === 1) && user.ipWhitelistEnforced) {
      const isLocal = isLocalhost(normalizedClientIp);
      if (!isLocal) {
        const trusted = await this.prisma.trustedIpAddress.findFirst({
          where: {
            userId: user.id,
            ipAddress: normalizedClientIp,
            isActive: true,
          },
        });

        if (!trusted) {
          // Untrusted IP detected
          if (!dto.securityPin) {
            return {
              requiresPin: true,
              detectedIp: normalizedClientIp,
              message: `Unrecognized IP address (${normalizedClientIp}). Enter your 6-digit Security PIN to proceed.`,
            };
          }

          if (!user.securityPinHash || !verifyPin(dto.securityPin, user.securityPinHash)) {
            await this.recordLoginFailureWithAlert(rateLimitKey || user.email, clientIp, user.id);
            throw new UnauthorizedException('Invalid Security PIN.');
          }

          // If valid and user chose to trust this IP
          if (dto.trustIp) {
            await this.prisma.trustedIpAddress.create({
              data: {
                userId: user.id,
                ipAddress: normalizedClientIp,
                label: dto.ipLabel || `Trusted Device (${normalizedClientIp})`,
                isActive: true,
                lastUsedAt: new Date(),
              },
            });
          }
        } else {
          // Update last used timestamp
          await this.prisma.trustedIpAddress.update({
            where: { id: trusted.id },
            data: { lastUsedAt: new Date() },
          });
        }
      }
    }

    // Authentication succeeded: reset failed attempts counter for this key
    await this.recordRateLimitSuccess(rateLimitKey || user.email, clientIp);

    return this.issueSessionBundle(user, {
      deviceId: dto.deviceId,
      deviceName: dto.deviceName,
      platform: dto.platform,
      appVersion: dto.appVersion,
      clientIp: normalizedClientIp,
    });
  }

  async demoLogin() {
    let demoUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { role: 'DEMO_SANDBOX' },
          { id: 2 },
          { email: 'demo@sundayfunday.id' },
          { accountName: 'demo', username: 'guest' },
          { accountName: 'portfolio', username: 'recruiter' },
        ],
      },
    });

    if (!demoUser) {
      await this.bootstrapDefaultAccounts();
      demoUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { role: 'DEMO_SANDBOX' },
            { id: 2 },
            { email: 'demo@sundayfunday.id' },
            { accountName: 'demo', username: 'guest' },
            { accountName: 'portfolio', username: 'recruiter' },
          ],
        },
      });
    }

    if (!demoUser) {
      throw new NotFoundException('Demo user not found.');
    }

    return this.issueSessionBundle(demoUser, { platform: 'WEB' });
  }

  async verifyPassword(userId: number, password: string, clientIp: string = '127.0.0.1') {
    if (!password) {
      throw new BadRequestException('Password is required.');
    }

    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }

    const rateLimitKey = `verify_pw:${userId}`;
    await this.checkRateLimit(rateLimitKey, clientIp);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const pwStatus = verifyPasswordWithStatus(password, user.passwordHash);
    if (!pwStatus.isValid) {
      await this.recordLoginFailureWithAlert(rateLimitKey, clientIp, userId);
      throw new UnauthorizedException('Invalid account password.');
    }

    // Auto-upgrade legacy hash to scryptv2 upon successful verification
    if (pwStatus.needsUpgrade || !isPasswordHashV2(user.passwordHash)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(password) },
      }).catch(() => {});
    }

    await this.recordRateLimitSuccess(rateLimitKey, clientIp);
    return { verified: true };
  }

  async refreshToken(rawToken: string | null, userId?: number) {
    let user: any = null;
    if (rawToken) {
      const payload = verifyToken(rawToken);
      if (payload?.sub) {
        user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      }
    }
    if (!user && userId) {
      user = await this.prisma.user.findUnique({ where: { id: userId } });
    }
    if (!user || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Session invalid or expired. Please re-authenticate.');
    }

    const token = signToken(
      {
        sub: user.id,
        tv: user.tokenVersion ?? 0,
        mcp: Boolean(user.mustChangePassword),
        accountName: user.accountName || 'cheeseburger',
        username: user.username || 'cheeseburger',
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        blueprintType: user.blueprintType,
      },
      1800,
    );

    return {
      accessToken: token,
      expiresIn: 1800,
      mustChangePassword: Boolean(user.mustChangePassword),
      user: this.toAuthenticatedUser(user),
    };
  }

  async getSession(rawToken: string | null) {
    if (!rawToken) {
      throw new UnauthorizedException('No active session.');
    }
    const payload = verifyToken(rawToken);
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid or expired session token.');
    }
    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = payload.exp ? Math.max(0, payload.exp - now) : 1800;
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('User account suspended or not found.');
    }

    return {
      valid: true,
      remainingSeconds,
      exp: payload.exp,
      user: this.toAuthenticatedUser(user),
    };
  }

  async register(dto: RegisterDto) {
    // In production, public registration is closed. Only superadmin provisions accounts from /admin
    if (process.env.NODE_ENV !== 'test') {
      throw new BadRequestException('Public registration is closed. Contact the platform administrator.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    if (existing) {
      throw new BadRequestException('An account with this email already exists.');
    }

    const preset = getLifeStagePresetDefaults(
      dto.lifeStagePreset || 'CORPORATE_PROFESSIONAL',
    );
    const uiDensity = (dto.uiDensityMode as UiDensityMode) || preset.uiDensityMode;

    const baseUsername = dto.email.split('@')[0].trim().toLowerCase();
    const uniqueSuffix = Date.now().toString().slice(-6);
    const derivedAccountName = `client_${uniqueSuffix}`;
    const derivedUsername = `${baseUsername}_${uniqueSuffix}`;

    const user = await this.prisma.user.create({
      data: {
        accountName: derivedAccountName,
        username: derivedUsername,
        email: dto.email.trim().toLowerCase(),
        passwordHash: hashPassword(dto.password),
        fullName: dto.fullName.trim(),
        role: 'STANDARD_MEMBER',
        status: 'ACTIVE',
        blueprintType: 'STANDARD_GENERAL',
        lifeStagePreset: preset.lifeStagePreset,
        uiDensityMode: uiDensity,
        ipWhitelistEnforced: false,
      },
    });

    // Create initial GlobalConfig for the new member using preset defaults
    await this.prisma.globalConfig.create({
      data: {
        userId: user.id,
        baseSalary: dto.initialSalary ?? 0,
        dailyAllowance: 0,
        laptopAllowance: 0,
        dailyOperational: dto.dailyLivingBudget ?? 0,
        transport: 0,
        internet: 0,
        vape: 0,
        haircut: 0,
        baseSavings: dto.coreSavingsTarget ?? 0,
        creditLimit: 5000000,
        creditStatementDay: 20,
        creditDueDay: 11,
        payrollPayoutDay: 25,
        profileMode: 'STANDARD_GENERAL',
        lifeStagePreset: preset.lifeStagePreset,
        uiDensityMode: uiDensity,
        payrollMode: preset.payrollMode,
        enabledModulesJson: preset.enabledModules as any,
        formulaEngineType: preset.formulaEngineType,
        formulaParamsJson: preset.formulaParamsJson as any,
        customRoutineLabelsJson: preset.customRoutineLabels as any,
        onboardingCompleted: false, // New member triggers 60s wizard on first login
      },
    });

    const token = signToken({
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      blueprintType: user.blueprintType,
    });

    return {
      accessToken: token,
      user: this.toAuthenticatedUser(user),
    };
  }

  async getMe(userId: number): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.toAuthenticatedUser(user);
  }

  async updateProfile(
    userId: number,
    dto: UpdateProfileDto,
  ): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      throw new NotFoundException('User not found.');
    }

    const nextEmail =
      dto.email !== undefined ? dto.email.trim().toLowerCase() : existing.email;
    const nextFullName =
      dto.fullName !== undefined ? dto.fullName.trim() : existing.fullName;

    if (!nextEmail) {
      throw new BadRequestException('Email address cannot be empty.');
    }
    if (!nextFullName) {
      throw new BadRequestException('Display name cannot be empty.');
    }

    if (nextEmail !== existing.email.toLowerCase()) {
      const duplicate = await this.prisma.user.findFirst({
        where: {
          email: nextEmail,
          id: { not: userId },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(
          'An account with that email address already exists.',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: nextEmail,
        fullName: nextFullName,
      },
    });

    await this.prisma.auditLog
      .create({
        data: {
          userId,
          category: 'SETTINGS',
          action: 'UPDATE_USER_PROFILE',
          severity: 'INFO',
          summary: `Updated profile settings (email: ${updated.email}, name: ${updated.fullName})`,
          details: JSON.stringify({
            previousEmail: existing.email,
            newEmail: updated.email,
            previousFullName: existing.fullName,
            newFullName: updated.fullName,
          }),
        },
      })
      .catch(() => {});

    const accessToken = signToken({
      sub: updated.id,
      tv: updated.tokenVersion ?? 0,
      mcp: Boolean(updated.mustChangePassword),
      email: updated.email,
      accountName: updated.accountName,
      username: updated.username,
      fullName: updated.fullName,
      role: updated.role,
      blueprintType: updated.blueprintType,
    });

    return {
      accessToken,
      user: this.toAuthenticatedUser(updated),
    };
  }

  async resetDemoSandbox(): Promise<{ success: boolean; message: string }> {
    const demoUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: 'demo@sundayfunday.id' },
          { id: 2, username: 'guest' },
        ],
      },
    });

    if (!demoUser) {
      throw new NotFoundException('Demo user not found.');
    }
    if (demoUser.id !== 2) {
      throw new BadRequestException(
        'Demo reset is restricted strictly to sandbox userId = 2.',
      );
    }

    if (
      demoUser.email !== 'demo@sundayfunday.id' ||
      demoUser.fullName !== 'General Sandbox (Demo)'
    ) {
      await this.prisma.user.update({
        where: { id: demoUser.id },
        data: {
          email: 'demo@sundayfunday.id',
          fullName: 'General Sandbox (Demo)',
        },
      });
    }

    if (this.configService) {
      await this.configService.resetSandbox(demoUser.id);
    } else {
      await this.prisma.liabilityLineItem.deleteMany({
        where: { userId: demoUser.id },
      });
      await this.seedDemoWorkspace(demoUser.id);
    }

    return {
      success: true,
      message: 'Demo Sandbox successfully restored to pristine corporate defaults.',
    };
  }

  async changePassword(
    userId: number,
    dto: { currentPassword: string; newPassword: string; confirmPassword?: string },
    clientIp: string = '127.0.0.1',
  ) {
    if (userId === 2) {
      throw new BadRequestException(
        'Demo Sandbox uses fixed demonstration credentials and cannot change password.',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User account not found.');
    }
    const check = verifyPasswordWithStatus(dto.currentPassword || '', user.passwordHash);
    if (!check.isValid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    if (
      dto.confirmPassword !== undefined &&
      dto.confirmPassword !== dto.newPassword
    ) {
      throw new BadRequestException('New password and confirmation do not match.');
    }
    const strength = validatePasswordStrength(dto.newPassword);
    if (!strength.valid) {
      throw new BadRequestException(
        strength.message ||
          'New password must be at least 10 characters with uppercase, lowercase, and numbers.',
      );
    }
    if (verifyPassword(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException(
        'New password must be different from your current password.',
      );
    }

    const updatedRaw = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashPassword(dto.newPassword),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
    });
    const nextUser = updatedRaw?.id
      ? updatedRaw
      : {
          ...user,
          mustChangePassword: false,
          tokenVersion: (user.tokenVersion ?? 0) + 1,
        };

    if (typeof (this.prisma as any)?.refreshToken?.updateMany === 'function') {
      await (this.prisma as any).refreshToken
        .updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date(), revokeReason: 'PASSWORD_CHANGED' },
        })
        .catch(() => {});
    }

    await this.recordSecurityAudit({
      userId,
      action: 'PASSWORD_CHANGED',
      summary: 'Updated account password and rotated active session.',
      details: { clientIp: normalizeIp(clientIp) },
    });

    if (user.email) {
      void this.emailService?.sendPasswordChangedAlert({
        userId,
        recipientEmail: user.email,
        fullName: user.fullName || user.username,
        clientIp: normalizeIp(clientIp),
        reason: 'USER_CHANGE',
      });
    }

    const session = await this.issueSessionBundle(nextUser, {
      platform: 'WEB',
      clientIp: normalizeIp(clientIp),
    });

    return {
      success: true,
      message: 'Account password updated cleanly.',
      ...session,
    };
  }

  async completeFirstLoginPassword(
    userId: number,
    dto: CompleteFirstLoginPasswordDto,
    clientIp: string = '127.0.0.1',
  ) {
    if (userId === 2) {
      throw new BadRequestException(
        'Demo Sandbox does not require first-login password setup.',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User account not found.');
    }
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirmation do not match.');
    }
    const strength = validatePasswordStrength(dto.newPassword);
    if (!strength.valid) {
      throw new BadRequestException(
        strength.message ||
          'New password must be at least 10 characters with uppercase, lowercase, and numbers.',
      );
    }
    if (verifyPassword(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException(
        'Choose a new permanent password different from your temporary password.',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashPassword(dto.newPassword),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
    });
    const nextUser = updated?.id
      ? updated
      : {
          ...user,
          mustChangePassword: false,
          tokenVersion: (user.tokenVersion ?? 0) + 1,
        };

    if (typeof (this.prisma as any)?.refreshToken?.updateMany === 'function') {
      await (this.prisma as any).refreshToken
        .updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date(), revokeReason: 'FIRST_LOGIN_PASSWORD_SET' },
        })
        .catch(() => {});
    }

    await this.recordSecurityAudit({
      userId,
      action: 'FIRST_LOGIN_PASSWORD_COMPLETED',
      summary: 'Replaced temporary password with a permanent personal password.',
      details: { clientIp: normalizeIp(clientIp) },
    });

    if (user.email) {
      void this.emailService?.sendPasswordChangedAlert({
        userId,
        recipientEmail: user.email,
        fullName: user.fullName || user.username,
        clientIp: normalizeIp(clientIp),
        reason: 'FIRST_LOGIN',
        locale: dto.locale,
      });
    }

    const session = await this.issueSessionBundle(nextUser, {
      platform: 'WEB',
      clientIp: normalizeIp(clientIp),
    });

    return {
      success: true,
      ...session,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto, clientIp: string = '127.0.0.1') {
    const clean = (dto.identifier || '').trim().toLowerCase();
    const genericMessage =
      'If an active account matches that identifier, password reset instructions have been sent.';

    if (!clean) {
      throw new BadRequestException('Username or email is required.');
    }

    await this.checkRateLimit(`forgot_pw:${clean}`, clientIp);

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: clean, mode: 'insensitive' } },
          { username: { equals: clean, mode: 'insensitive' } },
        ],
      },
    });

    if (
      !user ||
      user.status === 'SUSPENDED' ||
      user.role === 'DEMO_SANDBOX' ||
      user.id === 2 ||
      !(this.prisma as any)?.passwordResetToken?.create
    ) {
      return { accepted: true, message: genericMessage };
    }

    await this.recordRateLimitFailure(`forgot_pw:${clean}`, clientIp).catch(() => {});

    // Invalidate previous unredeemed reset tokens for this user
    await (this.prisma as any).passwordResetToken
      .updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      })
      .catch(() => {});

    const reset = generatePasswordResetToken();
    const expiresMinutes = 30;
    const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

    await (this.prisma as any).passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: reset.hash,
        expiresAt,
        requestedIp: normalizeIp(clientIp),
      },
    });

    const webBase = (
      process.env.WEB_PUBLIC_URL || 'https://sundayfunday-erp.vercel.app'
    ).replace(/\/$/, '');
    const resetUrl = `${webBase}/reset-password?token=${encodeURIComponent(reset.raw)}`;

    await this.recordSecurityAudit({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      summary: 'Issued single-use 30-minute password recovery link.',
      details: { clientIp: normalizeIp(clientIp) },
    });

    if (user.email) {
      void this.emailService?.sendPasswordResetEmail({
        userId: user.id,
        recipientEmail: user.email,
        fullName: user.fullName || user.username,
        resetUrl,
        expiresMinutes,
        locale: dto.locale,
      });
    }

    return { accepted: true, message: genericMessage };
  }

  async validatePasswordResetToken(rawToken: string) {
    const clean = (rawToken || '').trim();
    if (!clean || !(this.prisma as any)?.passwordResetToken?.findUnique) {
      throw new BadRequestException('Invalid or expired password reset link.');
    }

    const tokenHash = hashOpaqueToken(clean);
    const record = await (this.prisma as any).passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !record ||
      record.usedAt !== null ||
      new Date(record.expiresAt).getTime() <= Date.now() ||
      !record.user ||
      record.user.status === 'SUSPENDED'
    ) {
      throw new BadRequestException(
        'This password reset link is invalid or has expired.',
      );
    }

    return {
      valid: true,
      expiresAt: record.expiresAt,
    };
  }

  async resetPasswordWithToken(
    dto: ResetPasswordDto,
    clientIp: string = '127.0.0.1',
  ) {
    const cleanToken = (dto.token || '').trim();
    if (!cleanToken || !(this.prisma as any)?.passwordResetToken?.findUnique) {
      throw new BadRequestException('Invalid or expired password reset link.');
    }
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirmation do not match.');
    }
    const strength = validatePasswordStrength(dto.newPassword);
    if (!strength.valid) {
      throw new BadRequestException(
        strength.message ||
          'New password must be at least 10 characters with uppercase, lowercase, and numbers.',
      );
    }

    const tokenHash = hashOpaqueToken(cleanToken);
    const record = await (this.prisma as any).passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !record ||
      record.usedAt !== null ||
      new Date(record.expiresAt).getTime() <= Date.now() ||
      !record.user ||
      record.user.status === 'SUSPENDED'
    ) {
      throw new BadRequestException(
        'This password reset link is invalid or has expired.',
      );
    }

    // Atomic single-use redemption guard
    const claimed = await (this.prisma as any).passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (!claimed || claimed.count === 0) {
      throw new BadRequestException(
        'This password reset link has already been used.',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: record.user.id },
      data: {
        passwordHash: hashPassword(dto.newPassword),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
    });

    if (typeof (this.prisma as any)?.refreshToken?.updateMany === 'function') {
      await (this.prisma as any).refreshToken
        .updateMany({
          where: { userId: record.user.id, revokedAt: null },
          data: { revokedAt: new Date(), revokeReason: 'PASSWORD_RESET' },
        })
        .catch(() => {});
    }

    await this.recordSecurityAudit({
      userId: record.user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      summary: 'Reset password via single-use recovery token and revoked all sessions.',
      details: { clientIp: normalizeIp(clientIp) },
    });

    if (record.user.email) {
      void this.emailService?.sendPasswordChangedAlert({
        userId: record.user.id,
        recipientEmail: record.user.email,
        fullName: record.user.fullName || record.user.username,
        clientIp: normalizeIp(clientIp),
        reason: 'RESET_TOKEN',
        locale: dto.locale,
      });
    }

    return {
      success: true,
      message: 'Your password has been updated. Sign in with your new password.',
      tokenVersion: updated?.tokenVersion,
    };
  }

  async rotateRefreshToken(dto: RefreshTokenDto, clientIp: string = '127.0.0.1') {
    if (!dto?.refreshToken || !this.hasMobileAuthStore()) {
      throw new UnauthorizedException('Valid refresh token is required.');
    }

    const tokenHash = hashOpaqueToken(dto.refreshToken.trim());
    const existing = await (this.prisma as any).refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    // Theft / replay protection: presenting an already-rotated or revoked refresh token kills the entire session family
    if (existing.revokedAt !== null) {
      await (this.prisma as any).refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'REUSE_DETECTED' },
      });
      await this.recordSecurityAudit({
        userId: existing.userId,
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        severity: 'WARNING',
        summary: `Revoked refresh token family (${existing.familyId}) after token reuse attempt from ${normalizeIp(clientIp)}.`,
        details: { familyId: existing.familyId, deviceId: existing.deviceId, clientIp: normalizeIp(clientIp) },
      });
      throw new UnauthorizedException(
        'Session revoked due to refresh token reuse. Sign in again to restore access.',
      );
    }

    if (
      new Date(existing.expiresAt).getTime() <= Date.now() ||
      !existing.user ||
      existing.user.status === 'SUSPENDED'
    ) {
      await (this.prisma as any).refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), revokeReason: 'EXPIRED' },
      });
      throw new UnauthorizedException('Refresh session expired. Sign in again.');
    }

    if (dto.deviceId && existing.deviceId && dto.deviceId !== existing.deviceId) {
      await (this.prisma as any).refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'DEVICE_MISMATCH' },
      });
      throw new UnauthorizedException('Device mismatch detected for refresh session.');
    }

    return this.issueSessionBundle(existing.user, {
      familyId: existing.familyId,
      rotatedFromId: existing.id,
      deviceId: dto.deviceId || existing.deviceId || undefined,
      deviceName: dto.deviceName || existing.deviceName || undefined,
      platform: dto.platform || existing.platform || undefined,
      clientIp: normalizeIp(clientIp),
    });
  }

  async listSessions(userId: number, currentSessionId?: string) {
    if (!this.hasMobileAuthStore()) return [];
    const rows = await (this.prisma as any).refreshToken.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastUsedAt: 'desc' },
    });
    const now = Date.now();
    return rows
      .filter((r: any) => new Date(r.expiresAt).getTime() > now)
      .map((r: any) => ({
        sessionId: r.id,
        deviceId: r.deviceId,
        deviceName: r.deviceName || r.deviceId || 'Web Browser',
        platform: r.platform,
        clientIp: r.clientIp,
        lastUsedAt: r.lastUsedAt,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        isCurrent: Boolean(currentSessionId && r.id === currentSessionId),
      }));
  }

  async revokeSession(userId: number, sessionId: string) {
    if (!this.hasMobileAuthStore()) {
      throw new NotFoundException('Session store unavailable.');
    }
    const existing = await (this.prisma as any).refreshToken.findFirst({
      where: { id: sessionId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Session not found.');
    }
    await (this.prisma as any).refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), revokeReason: 'USER_REVOKED' },
    });
    return { success: true, revokedSessionId: sessionId };
  }

  async logoutSession(params: {
    userId?: number;
    sessionId?: string;
    refreshToken?: string;
  }) {
    if (this.hasMobileAuthStore()) {
      if (params.refreshToken) {
        const tokenHash = hashOpaqueToken(params.refreshToken.trim());
        const existing = await (this.prisma as any).refreshToken.findUnique({
          where: { tokenHash },
        });
        if (existing && (!params.userId || existing.userId === params.userId)) {
          await (this.prisma as any).refreshToken.updateMany({
            where: { familyId: existing.familyId, revokedAt: null },
            data: { revokedAt: new Date(), revokeReason: 'LOGOUT' },
          });
        }
      } else if (params.sessionId) {
        await (this.prisma as any).refreshToken
          .updateMany({
            where: {
              id: params.sessionId,
              ...(params.userId ? { userId: params.userId } : {}),
              revokedAt: null,
            },
            data: { revokedAt: new Date(), revokeReason: 'LOGOUT' },
          })
          .catch(() => {});
      }
    }
    return { success: true, message: 'Logged out successfully.' };
  }

  async logoutAll(userId: number) {
    if (typeof (this.prisma as any)?.refreshToken?.updateMany === 'function') {
      await (this.prisma as any).refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'USER_LOGOUT_ALL' },
      });
    }
    if (typeof this.prisma?.user?.update === 'function') {
      await this.prisma.user
        .update({
          where: { id: userId },
          data: { tokenVersion: { increment: 1 } },
        })
        .catch(() => {});
    }
    if (typeof (this.prisma as any)?.biometricChallenge?.updateMany === 'function') {
      await (this.prisma as any).biometricChallenge
        .updateMany({
          where: { userId, consumedAt: null },
          data: { consumedAt: new Date() },
        })
        .catch(() => {});
    }
    return { success: true, message: 'All sessions signed out.' };
  }

  async setupSecurityPin(
    userId: number,
    dto: SetupPinDto,
    clientIp: string = '127.0.0.1',
  ) {
    if (!dto?.newPin || isWeakPin(dto.newPin)) {
      throw new BadRequestException(
        'Security PIN must be 6 digits and cannot be sequential or repeated (e.g. 123456, 111111).',
      );
    }

    await this.verifyPassword(userId, dto.currentPassword, clientIp);

    await this.prisma.user.update({
      where: { id: userId },
      data: { securityPinHash: hashPin(dto.newPin) },
    });

    await this.recordRateLimitSuccess(`pin_verify:${userId}`, clientIp);
    await this.recordSecurityAudit({
      userId,
      action: 'SECURITY_PIN_UPDATED',
      summary: 'Configured 6-digit mobile app Security PIN.',
    });

    return { success: true, hasSecurityPin: true };
  }

  async verifySecurityPin(
    params: VerifyPinDto & { userId?: number },
    clientIp: string = '127.0.0.1',
  ) {
    let targetUserId = params.userId;

    if (!targetUserId && params.refreshToken && params.deviceId && this.hasMobileAuthStore()) {
      const tokenHash = hashOpaqueToken(params.refreshToken.trim());
      const rt = await (this.prisma as any).refreshToken.findUnique({
        where: { tokenHash },
      });
      if (
        rt &&
        rt.revokedAt === null &&
        rt.deviceId === params.deviceId &&
        new Date(rt.expiresAt).getTime() > Date.now()
      ) {
        targetUserId = rt.userId;
      }
    }

    if (!targetUserId) {
      throw new UnauthorizedException(
        'Active session or bound device token is required to verify PIN.',
      );
    }

    const rateKey = `pin_verify:${targetUserId}`;
    await this.checkRateLimit(rateKey, clientIp);

    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('User account is inactive.');
    }
    if (!user.securityPinHash) {
      throw new BadRequestException('Security PIN is not configured for this account.');
    }

    const ok = verifyPin(params.pin || '', user.securityPinHash);
    if (!ok) {
      await this.recordLoginFailureWithAlert(rateKey, clientIp, user.id);
      throw new UnauthorizedException('Invalid Security PIN.');
    }

    await this.recordRateLimitSuccess(rateKey, clientIp);
    if (params.rotateSession && params.refreshToken) {
      const session = await this.rotateRefreshToken(
        { refreshToken: params.refreshToken, deviceId: params.deviceId },
        clientIp,
      );
      return { verified: true, ...session };
    }

    return { verified: true };
  }

  async enrollBiometricDevice(userId: number, dto: EnrollBiometricDto) {
    if (!dto?.deviceId?.trim()) {
      throw new BadRequestException('Device ID is required.');
    }
    const normalized = normalizeAndValidatePublicKeyPem(
      dto.publicKeyPem,
      dto.keyAlgorithm || 'ECDSA_P256',
    );
    if (!normalized) {
      throw new BadRequestException(
        'Invalid hardware biometric public key (expected valid SPKI PEM ECDSA_P256 or ED25519).',
      );
    }

    const saved = await (this.prisma as any).mobileDevice.upsert({
      where: {
        userId_deviceId: { userId, deviceId: dto.deviceId.trim() },
      },
      create: {
        userId,
        deviceId: dto.deviceId.trim(),
        deviceName: dto.deviceName?.trim() || dto.deviceId.trim(),
        platform: dto.platform || 'ANDROID',
        appVersion: dto.appVersion,
        publicKeyPem: normalized.pem,
        keyAlgorithm: normalized.keyAlgorithm,
        biometricEnabled: true,
        lastActiveAt: new Date(),
      },
      update: {
        deviceName: dto.deviceName?.trim() || undefined,
        platform: dto.platform || undefined,
        appVersion: dto.appVersion || undefined,
        publicKeyPem: normalized.pem,
        keyAlgorithm: normalized.keyAlgorithm,
        biometricEnabled: true,
        revokedAt: null,
        lastActiveAt: new Date(),
      },
    });

    await this.recordSecurityAudit({
      userId,
      action: 'BIOMETRIC_DEVICE_ENROLLED',
      summary: `Enrolled biometric key (${normalized.keyAlgorithm}) for ${saved.deviceName}.`,
      details: { deviceId: saved.deviceId, platform: saved.platform, keyAlgorithm: normalized.keyAlgorithm },
    });

    return {
      success: true,
      deviceId: saved.deviceId,
      biometricEnabled: true,
      keyAlgorithm: normalized.keyAlgorithm,
    };
  }

  async disableBiometricDevice(userId: number, deviceId: string) {
    const res = await (this.prisma as any).mobileDevice.updateMany({
      where: { userId, deviceId },
      data: { biometricEnabled: false, publicKeyPem: null },
    });
    if (!res?.count) {
      throw new NotFoundException('Mobile device not found.');
    }
    return { success: true, deviceId, biometricEnabled: false };
  }

  async createBiometricChallenge(dto: BiometricChallengeDto) {
    if (!dto?.deviceId || !dto?.refreshToken || !this.hasMobileAuthStore()) {
      throw new UnauthorizedException('Device binding and active refresh token required.');
    }

    const rtHash = hashOpaqueToken(dto.refreshToken.trim());
    const rt = await (this.prisma as any).refreshToken.findUnique({
      where: { tokenHash: rtHash },
    });

    if (
      !rt ||
      rt.revokedAt !== null ||
      new Date(rt.expiresAt).getTime() <= Date.now() ||
      rt.deviceId !== dto.deviceId
    ) {
      throw new UnauthorizedException('Active session for this device was not found.');
    }

    const device = await (this.prisma as any).mobileDevice.findFirst({
      where: {
        userId: rt.userId,
        deviceId: dto.deviceId,
        revokedAt: null,
      },
    });

    if (!device || !device.biometricEnabled || !device.publicKeyPem) {
      throw new BadRequestException('Biometric unlock is not enrolled on this device.');
    }

    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.BIOMETRIC_CHALLENGE_TTL_MS);

    const row = await (this.prisma as any).biometricChallenge.create({
      data: {
        userId: rt.userId,
        deviceId: dto.deviceId,
        nonce,
        expiresAt,
      },
    });

    return {
      challengeId: row.id,
      nonce,
      signingPayload: `${nonce}:${dto.deviceId}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async verifyBiometricChallenge(
    dto: VerifyBiometricDto,
    clientIp: string = '127.0.0.1',
  ) {
    const rateKey = `biometric:${dto.deviceId}`;
    await this.checkRateLimit(rateKey, clientIp);

    const challenge = await (this.prisma as any).biometricChallenge.findUnique({
      where: { id: dto.challengeId },
    });

    if (
      !challenge ||
      challenge.deviceId !== dto.deviceId ||
      challenge.consumedAt !== null ||
      new Date(challenge.expiresAt).getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Biometric challenge invalid or expired.');
    }

    // Atomic single-use claim prevents concurrent challenge replay races
    const claimed = await (this.prisma as any).biometricChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (!claimed?.count) {
      throw new UnauthorizedException('Biometric challenge already consumed.');
    }

    const device = await (this.prisma as any).mobileDevice.findFirst({
      where: {
        userId: challenge.userId,
        deviceId: dto.deviceId,
        revokedAt: null,
      },
    });

    if (!device || !device.biometricEnabled || !device.publicKeyPem) {
      throw new UnauthorizedException('Biometric device enrollment disabled.');
    }

    const signatureOk = verifyBiometricSignature({
      publicKeyPem: device.publicKeyPem,
      keyAlgorithm: device.keyAlgorithm || 'ECDSA_P256',
      payload: `${challenge.nonce}:${dto.deviceId}`,
      signatureBase64: dto.signatureBase64,
    });

    if (!signatureOk) {
      await this.recordLoginFailureWithAlert(rateKey, clientIp, challenge.userId);
      throw new UnauthorizedException('Invalid biometric signature.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: challenge.userId } });
    if (!user || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('User account suspended or unavailable.');
    }

    await this.recordRateLimitSuccess(rateKey, clientIp);

    // Rotate active refresh token if one is open for this device
    let familyId: string | undefined;
    let rotatedFromId: string | undefined;
    if (this.hasMobileAuthStore()) {
      const openRt = await (this.prisma as any).refreshToken.findFirst({
        where: { userId: user.id, deviceId: dto.deviceId, revokedAt: null },
      });
      if (openRt) {
        familyId = openRt.familyId;
        rotatedFromId = openRt.id;
      }
    }

    return this.issueSessionBundle(user, {
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      platform: device.platform,
      appVersion: dto.appVersion || device.appVersion || undefined,
      clientIp: normalizeIp(clientIp),
      familyId,
      rotatedFromId,
    });
  }

  listSsoProviders() {
    if (!this.ssoService) return [];
    return this.ssoService.listProviders();
  }

  async loginWithSso(dto: SsoExchangeDto, clientIp: string = '127.0.0.1') {
    if (!this.ssoService) {
      throw new BadRequestException('SSO service is not enabled on this server.');
    }

    const claims = await this.ssoService.verifyIdToken(dto.provider, dto.idToken);
    let user: any = null;

    if (typeof (this.prisma as any)?.userIdentity?.findUnique === 'function') {
      const identity = await (this.prisma as any).userIdentity.findUnique({
        where: {
          provider_subject: { provider: claims.provider, subject: claims.subject },
        },
        include: { user: true },
      });
      if (identity?.user) {
        user = identity.user;
      }
    }

    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { email: claims.email },
      });
    }

    if (!user || user.status === 'SUSPENDED') {
      throw new UnauthorizedException(
        'No active Sunday Funday account is associated with this SSO email.',
      );
    }

    if (typeof (this.prisma as any)?.userIdentity?.upsert === 'function') {
      await (this.prisma as any).userIdentity.upsert({
        where: {
          provider_subject: { provider: claims.provider, subject: claims.subject },
        },
        create: {
          userId: user.id,
          provider: claims.provider,
          subject: claims.subject,
          email: claims.email,
          lastLoginAt: new Date(),
        },
        update: {
          email: claims.email,
          lastLoginAt: new Date(),
        },
      });
    }

    const session = await this.issueSessionBundle(user, {
      deviceId: dto.deviceId,
      deviceName: dto.deviceName,
      platform: dto.platform,
      appVersion: dto.appVersion,
      clientIp: normalizeIp(clientIp),
    });

    return {
      ...session,
      ssoProvider: claims.provider,
    };
  }

  async linkSsoIdentity(userId: number, dto: SsoExchangeDto) {
    if (!this.ssoService) {
      throw new BadRequestException('SSO service is not enabled.');
    }
    const claims = await this.ssoService.verifyIdToken(dto.provider, dto.idToken);
    const existing = await (this.prisma as any).userIdentity.findUnique({
      where: {
        provider_subject: { provider: claims.provider, subject: claims.subject },
      },
    });
    if (existing && existing.userId !== userId) {
      throw new ConflictException(
        'This external SSO identity is already linked to another account.',
      );
    }
    const saved = await (this.prisma as any).userIdentity.upsert({
      where: {
        provider_subject: { provider: claims.provider, subject: claims.subject },
      },
      create: {
        userId,
        provider: claims.provider,
        subject: claims.subject,
        email: claims.email,
      },
      update: {
        email: claims.email,
      },
    });
    return {
      id: saved.id,
      provider: saved.provider,
      email: saved.email,
      linked: true,
    };
  }

  async unlinkSsoIdentity(userId: number, identityId: number) {
    const res = await (this.prisma as any).userIdentity.deleteMany({
      where: { id: identityId, userId },
    });
    if (!res?.count) {
      throw new NotFoundException('Linked SSO identity not found.');
    }
    return { success: true };
  }

  toAuthenticatedUser(user: any): AuthenticatedUser {
    return {
      id: user.id,
      accountName: user.accountName || 'cheeseburger',
      username: user.username || 'cheeseburger',
      email: user.email,
      fullName: user.fullName,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      blueprintType: user.blueprintType as BlueprintType,
      lifeStagePreset: (user.lifeStagePreset ||
        (user.id === 1 ? 'SUPERADMIN_BESPOKE' : 'CORPORATE_PROFESSIONAL')) as LifeStagePreset,
      uiDensityMode: (user.uiDensityMode || 'COMMAND_COCKPIT') as UiDensityMode,
      ipWhitelistEnforced: user.ipWhitelistEnforced,
      mustChangePassword: Boolean(user.mustChangePassword),
      passwordChangedAt: user.passwordChangedAt ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
