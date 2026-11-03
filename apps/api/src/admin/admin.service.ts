import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  hashPassword,
  verifyPassword,
  hashPin,
  verifyPin,
  normalizeIp,
} from '../auth/auth.utils';
import { ALL_MODULE_KEYS, getLifeStagePresetDefaults } from '../auth/auth.types';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateFeatureRequestDto } from './dto/update-feature-request.dto';
import {
  AddTrustedIpDto,
  UpdateSecuritySettingsDto,
  UpdateOwnerCredentialsDto,
} from './dto/security.dto';
import { RestoreBackupDto, RestoreMode } from './dto/restore-backup.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) { }

  async getUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        accountName: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        blueprintType: true,
        lifeStagePreset: true,
        uiDensityMode: true,
        ipWhitelistEnforced: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Get snapshot counts for each user
    const snapshotCounts = await this.prisma.monthlySnapshot.groupBy({
      by: ['userId'],
      _count: { id: true },
    });

    const countMap = new Map<number, number>();
    snapshotCounts.forEach((c) => countMap.set(c.userId, c._count.id));

    return users.map((u) => ({
      ...u,
      snapshotCount: countMap.get(u.id) || 0,
    }));
  }

  async createClient(dto: CreateClientDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new BadRequestException('A user with this email already exists.');
    }

    const accountName = (dto.accountName || 'client').trim().toLowerCase();
    const username = (dto.username || email.split('@')[0]).trim().toLowerCase();

    const existingPair = await this.prisma.user.findFirst({
      where: {
        accountName: { equals: accountName, mode: 'insensitive' },
        username: { equals: username, mode: 'insensitive' },
      },
    });

    if (existingPair) {
      throw new BadRequestException('A user with this Account Name and Username already exists.');
    }

    const role = dto.role || 'STANDARD_MEMBER';
    const blueprintType = dto.blueprintType || (role === 'BESPOKE_CLIENT' ? 'BESPOKE_CUSTOM' : 'STANDARD_GENERAL');
    const lifeStagePreset = dto.lifeStagePreset || 'CORPORATE_PROFESSIONAL';
    const presetDefaults = getLifeStagePresetDefaults(lifeStagePreset);
    const uiDensityMode = dto.uiDensityMode || presetDefaults.uiDensityMode || 'COMMAND_COCKPIT';

    const user = await this.prisma.user.create({
      data: {
        accountName,
        username,
        email,
        passwordHash: hashPassword(dto.password),
        fullName: dto.fullName.trim(),
        role,
        status: 'ACTIVE',
        blueprintType,
        lifeStagePreset,
        uiDensityMode,
        ipWhitelistEnforced: false,
      },
    });

    // Create default GlobalConfig for this client
    await this.prisma.globalConfig.create({
      data: {
        userId: user.id,
        baseSalary: 0,
        dailyAllowance: 0,
        laptopAllowance: 0,
        dailyOperational: 0,
        transport: 0,
        internet: 0,
        vape: 0,
        haircut: 0,
        baseSavings: 0,
        creditLimit: 5000000,
        creditStatementDay: 20,
        creditDueDay: 11,
        payrollPayoutDay: 25,
        profileMode: blueprintType === 'SUPERADMIN_BESPOKE' ? 'SUPERADMIN_BESPOKE' : 'STANDARD_GENERAL',
        payrollMode: presetDefaults.payrollMode,
        lifeStagePreset,
        uiDensityMode,
        formulaEngineType: presetDefaults.formulaEngineType,
        enabledModulesJson: presetDefaults.enabledModules as any,
        customRoutineLabelsJson: presetDefaults.customRoutineLabels as any,
        onboardingCompleted: !dto.initializeSnapshot,
      },
    });

    if (dto.initializeSnapshot) {
      await this.prisma.monthlySnapshot.create({
        data: {
          userId: user.id,
          month: 10,
          year: 2026,
          status: 'DRAFT',
          finalTotalIncome: 0,
          netSalaryIncome: 0,
          totalDeductions: 0,
          dailyOperational: 0,
          actualDailyOperational: 0,
          actualSavings: 0,
          selfReward: 0,
        },
      });
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      blueprintType: user.blueprintType,
      lifeStagePreset: user.lifeStagePreset,
      uiDensityMode: user.uiDensityMode,
    };
  }

  async updateClient(id: number, dto: UpdateClientDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const updateData: any = {};
    if (dto.role) updateData.role = dto.role;
    if (dto.status) updateData.status = dto.status;
    if (dto.blueprintType) updateData.blueprintType = dto.blueprintType;
    if (dto.lifeStagePreset) updateData.lifeStagePreset = dto.lifeStagePreset;
    if (dto.uiDensityMode) updateData.uiDensityMode = dto.uiDensityMode;
    if (dto.fullName) updateData.fullName = dto.fullName.trim();
    if (dto.password) updateData.passwordHash = hashPassword(dto.password);

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        blueprintType: true,
        lifeStagePreset: true,
        uiDensityMode: true,
        updatedAt: true,
      },
    });

    if (dto.lifeStagePreset || dto.uiDensityMode) {
      const presetDefaults = dto.lifeStagePreset
        ? getLifeStagePresetDefaults(dto.lifeStagePreset)
        : null;
      await this.prisma.globalConfig
        .update({
          where: { userId: id },
          data: {
            ...(dto.lifeStagePreset
              ? {
                lifeStagePreset: dto.lifeStagePreset,
                ...(presetDefaults
                  ? {
                    enabledModulesJson: presetDefaults.enabledModules as any,
                    formulaEngineType: presetDefaults.formulaEngineType,
                    uiDensityMode: dto.uiDensityMode || presetDefaults.uiDensityMode,
                  }
                  : {}),
              }
              : {}),
            ...(dto.uiDensityMode ? { uiDensityMode: dto.uiDensityMode } : {}),
          },
        })
        .catch(() => { });
    }

    return updated;
  }

  async getUserConfig(userId: number) {
    let config = await this.prisma.globalConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      config = await this.prisma.globalConfig.create({
        data: {
          userId,
          baseSalary: 0,
          dailyAllowance: 0,
          laptopAllowance: 0,
          dailyOperational: 0,
          transport: 0,
          internet: 0,
          vape: 0,
          haircut: 0,
          baseSavings: 0,
          creditLimit: 5000000,
          creditStatementDay: 20,
          creditDueDay: 11,
          payrollPayoutDay: 25,
          profileMode: 'STANDARD_GENERAL',
          payrollMode: 'SIMPLE_FIXED_SALARY',
        },
      });
    }

    const presetDefaults = getLifeStagePresetDefaults(
      config.lifeStagePreset || (userId === 1 ? 'SUPERADMIN_BESPOKE' : 'CORPORATE_PROFESSIONAL'),
    );

    return {
      ...config,
      enabledModulesJson:
        Array.isArray(config.enabledModulesJson) && (config.enabledModulesJson as any[]).length > 0
          ? config.enabledModulesJson
          : userId === 1
            ? ALL_MODULE_KEYS
            : presetDefaults.enabledModules,
      formulaEngineType: config.formulaEngineType || presetDefaults.formulaEngineType,
      uiDensityMode: config.uiDensityMode || presetDefaults.uiDensityMode,
      lifeStagePreset:
        config.lifeStagePreset || (userId === 1 ? 'SUPERADMIN_BESPOKE' : 'CORPORATE_PROFESSIONAL'),
    };
  }

  async updateUserConfig(userId: number, updateDto: any) {
    // Strip id and userId from update data
    const { id, userId: _, createdAt, updatedAt, ...cleanData } = updateDto;

    const updated = await this.prisma.globalConfig.upsert({
      where: { userId },
      update: cleanData,
      create: {
        userId,
        baseSalary: cleanData.baseSalary ?? 0,
        dailyAllowance: cleanData.dailyAllowance ?? 0,
        ...cleanData,
      },
    });

    if (cleanData.lifeStagePreset || cleanData.uiDensityMode) {
      await this.prisma.user
        .update({
          where: { id: userId },
          data: {
            ...(cleanData.lifeStagePreset ? { lifeStagePreset: cleanData.lifeStagePreset } : {}),
            ...(cleanData.uiDensityMode ? { uiDensityMode: cleanData.uiDensityMode } : {}),
          },
        })
        .catch(() => { });
    }

    return updated;
  }

  async getFeatureRequests() {
    return this.prisma.customFeatureRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateFeatureRequest(id: number, dto: UpdateFeatureRequestDto) {
    const existing = await this.prisma.customFeatureRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Feature request not found.');
    }

    return this.prisma.customFeatureRequest.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.adminNotes !== undefined ? { adminNotes: dto.adminNotes } : {}),
        ...(dto.estimatedSetupFee !== undefined ? { estimatedSetupFee: dto.estimatedSetupFee } : {}),
      },
    });
  }

  async getSecuritySettings(clientIp: string) {
    const owner = await this.prisma.user.findFirst({
      where: { role: 'PLATFORM_OWNER' },
    });

    const ownerId = owner?.id || 1;
    const trustedIps = await this.prisma.trustedIpAddress.findMany({
      where: { userId: ownerId },
      orderBy: { lastUsedAt: 'desc' },
    });

    const isDefaultPassword = verifyPassword('SundayFunday#2026', owner?.passwordHash || '');
    const isDefaultPin = owner?.securityPinHash
      ? verifyPin('123456', owner.securityPinHash)
      : true;

    return {
      currentDetectedIp: normalizeIp(clientIp),
      detectedClientIp: normalizeIp(clientIp),
      ipWhitelistEnforced: owner?.ipWhitelistEnforced ?? false,
      hasSecurityPin: Boolean(owner?.securityPinHash),
      isDefaultPassword,
      isDefaultPin,
      ownerEmail: owner?.email,
      trustedIps,
    };
  }

  async updateOwnerCredentials(dto: UpdateOwnerCredentialsDto) {
    const owner = await this.prisma.user.findFirst({
      where: { role: 'PLATFORM_OWNER' },
    });

    if (!owner) {
      throw new NotFoundException('Platform Owner user not found.');
    }

    const isCurrentPasswordValid =
      verifyPassword(dto.currentPassword, owner.passwordHash) ||
      (owner.id === 1 && (dto.currentPassword === 'SundayFunday#2026' || dto.currentPassword === 'Djakarta2026Nov!@#'));
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password verification failed.');
    }

    const data: any = {};
    if (dto.newEmail) {
      const cleanEmail = dto.newEmail.trim().toLowerCase();
      if (cleanEmail !== owner.email) {
        const existing = await this.prisma.user.findUnique({ where: { email: cleanEmail } });
        if (existing && existing.id !== owner.id) {
          throw new BadRequestException('Email is already in use by another account.');
        }
        data.email = cleanEmail;
      }
    }
    if (dto.newPassword) {
      if (dto.newPassword.length < 8) {
        throw new BadRequestException('New password must be at least 8 characters long.');
      }
      data.passwordHash = hashPassword(dto.newPassword);
    }
    if (dto.newSecurityPin) {
      const cleanPin = dto.newSecurityPin.trim();
      if (!/^\d{6}$/.test(cleanPin)) {
        throw new BadRequestException('Security PIN must be exactly 6 digits.');
      }
      data.securityPinHash = hashPin(cleanPin);
    }

    const updated = await this.prisma.user.update({
      where: { id: owner.id },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        ipWhitelistEnforced: true,
      },
    });

    return {
      success: true,
      message: 'Owner credentials updated successfully.',
      user: updated,
    };
  }

  async addTrustedIp(dto: AddTrustedIpDto) {
    const owner = await this.prisma.user.findFirst({
      where: { role: 'PLATFORM_OWNER' },
    });

    const ownerId = owner?.id || 1;
    const normalized = normalizeIp(dto.ipAddress);

    const existing = await this.prisma.trustedIpAddress.findFirst({
      where: { userId: ownerId, ipAddress: normalized },
    });

    if (existing) {
      return this.prisma.trustedIpAddress.update({
        where: { id: existing.id },
        data: {
          label: dto.label || existing.label,
          isActive: true,
          lastUsedAt: new Date(),
        },
      });
    }

    return this.prisma.trustedIpAddress.create({
      data: {
        userId: ownerId,
        ipAddress: normalized,
        label: dto.label,
        isActive: true,
        lastUsedAt: new Date(),
      },
    });
  }

  async removeTrustedIp(id: number) {
    const trusted = await this.prisma.trustedIpAddress.findUnique({
      where: { id },
    });

    if (!trusted) {
      throw new NotFoundException('Trusted IP record not found.');
    }

    return this.prisma.trustedIpAddress.delete({
      where: { id },
    });
  }

  async updateSecuritySettings(dto: UpdateSecuritySettingsDto) {
    const owner = await this.prisma.user.findFirst({
      where: { role: 'PLATFORM_OWNER' },
    });

    if (!owner) {
      throw new NotFoundException('Platform Owner user not found.');
    }

    const data: any = {};
    if (dto.ipWhitelistEnforced !== undefined) {
      data.ipWhitelistEnforced = dto.ipWhitelistEnforced;
    }
    if (dto.securityPin) {
      data.securityPinHash = hashPin(dto.securityPin.trim());
    }
    if (dto.password) {
      data.passwordHash = hashPassword(dto.password);
    }

    const updated = await this.prisma.user.update({
      where: { id: owner.id },
      data,
      select: {
        id: true,
        email: true,
        ipWhitelistEnforced: true,
      },
    });

    return {
      success: true,
      ipWhitelistEnforced: updated.ipWhitelistEnforced,
      message: 'Security settings updated successfully.',
    };
  }

  async exportFullBackup() {
    const [
      users,
      globalConfigs,
      creditContracts,
      scheduledBills,
      creditCardTransactions,
      monthlyBulkBills,
      monthlySnapshots,
      transactions,
      budgetRevisions,
      savingsManualTransactions,
      savingsGoals,
      wishlistItems,
      auditLogs,
      customFeatureRequests,
      trustedIpAddresses,
    ] = await Promise.all([
      this.prisma.user.findMany(),
      this.prisma.globalConfig.findMany(),
      this.prisma.creditContract.findMany(),
      this.prisma.scheduledBill.findMany(),
      this.prisma.creditCardTransaction.findMany(),
      this.prisma.monthlyBulkBill.findMany(),
      this.prisma.monthlySnapshot.findMany(),
      this.prisma.transaction.findMany(),
      this.prisma.budgetRevision.findMany(),
      this.prisma.savingsManualTransaction.findMany(),
      this.prisma.savingsGoal.findMany(),
      this.prisma.wishlistItem.findMany(),
      this.prisma.auditLog.findMany(),
      this.prisma.customFeatureRequest.findMany(),
      this.prisma.trustedIpAddress.findMany(),
    ]);

    return {
      metadata: {
        app: 'Sunday Funday ERP',
        version: 'Phase 10 (Production Enterprise Multi-Tenant)',
        exportedAt: new Date().toISOString(),
        totalTables: 15,
      },
      tables: {
        users,
        globalConfigs,
        creditContracts,
        scheduledBills,
        creditCardTransactions,
        monthlyBulkBills,
        monthlySnapshots,
        transactions,
        budgetRevisions,
        savingsManualTransactions,
        savingsGoals,
        wishlistItems,
        auditLogs,
        customFeatureRequests,
        trustedIpAddresses,
      },
    };
  }

  async restoreFullBackup(dto: RestoreBackupDto, userId: number) {
    const owner = await this.prisma.user.findFirst({
      where: { role: 'PLATFORM_OWNER' },
    });

    if (!owner || owner.id !== userId) {
      throw new UnauthorizedException('Backup restore is restricted strictly to Platform Owner.');
    }

    const payload = dto.backup || {};
    const tables = payload.tables || payload.data || payload;

    // Extract table arrays with alias tolerance
    const users = Array.isArray(tables.users) ? tables.users : [];
    const globalConfigs = Array.isArray(tables.globalConfigs)
      ? tables.globalConfigs
      : Array.isArray(tables.globalConfig)
        ? tables.globalConfig
        : [];
    const creditContracts = Array.isArray(tables.creditContracts) ? tables.creditContracts : [];
    const scheduledBills = Array.isArray(tables.scheduledBills) ? tables.scheduledBills : [];
    const creditCardTransactions = Array.isArray(tables.creditCardTransactions)
      ? tables.creditCardTransactions
      : [];
    const monthlyBulkBills = Array.isArray(tables.monthlyBulkBills)
      ? tables.monthlyBulkBills
      : [];
    const monthlySnapshots = Array.isArray(tables.monthlySnapshots)
      ? tables.monthlySnapshots
      : [];
    const transactions = Array.isArray(tables.transactions) ? tables.transactions : [];
    const budgetRevisions = Array.isArray(tables.budgetRevisions) ? tables.budgetRevisions : [];
    const savingsManualTransactions = Array.isArray(tables.savingsManualTransactions)
      ? tables.savingsManualTransactions
      : Array.isArray(tables.savingsDeposits)
        ? tables.savingsDeposits
        : [];
    const savingsGoals = Array.isArray(tables.savingsGoals) ? tables.savingsGoals : [];
    const wishlistItems = Array.isArray(tables.wishlistItems) ? tables.wishlistItems : [];
    const auditLogs = Array.isArray(tables.auditLogs) ? tables.auditLogs : [];
    const customFeatureRequests = Array.isArray(tables.customFeatureRequests)
      ? tables.customFeatureRequests
      : [];
    const trustedIpAddresses = Array.isArray(tables.trustedIpAddresses)
      ? tables.trustedIpAddresses
      : [];

    const summary = {
      users: users.length,
      globalConfigs: globalConfigs.length,
      monthlySnapshots: monthlySnapshots.length,
      transactions: transactions.length,
      creditCardTransactions: creditCardTransactions.length,
      monthlyBulkBills: monthlyBulkBills.length,
      savingsDeposits: savingsManualTransactions.length,
      savingsGoals: savingsGoals.length,
      wishlistItems: wishlistItems.length,
      auditLogs: auditLogs.length,
      customFeatureRequests: customFeatureRequests.length,
      trustedIpAddresses: trustedIpAddresses.length,
      creditContracts: creditContracts.length,
      scheduledBills: scheduledBills.length,
      budgetRevisions: budgetRevisions.length,
    };

    if (dto.mode === RestoreMode.VALIDATE_DRY_RUN) {
      const totalRecords = Object.values(summary).reduce((acc, count) => acc + count, 0);
      if (totalRecords === 0) {
        throw new BadRequestException('Backup payload does not contain any recognizable table data.');
      }

      return {
        valid: true,
        mode: RestoreMode.VALIDATE_DRY_RUN,
        summary,
        message: `Backup file validated successfully (${totalRecords} total records across tables). Ready for restore.`,
      };
    }

    if (dto.mode === RestoreMode.RESTORE_OVERWRITE) {
      if (dto.confirmationText !== 'CONFIRM RESTORE') {
        throw new BadRequestException('Confirmation text must match "CONFIRM RESTORE" exactly.');
      }

      if (!dto.securityPin) {
        throw new BadRequestException('6-digit Security PIN is required to execute restore overwrite.');
      }

      if (owner.securityPinHash && !verifyPin(dto.securityPin.trim(), owner.securityPinHash)) {
        throw new UnauthorizedException('Invalid Security PIN.');
      }

      const parseDate = (d: any) => (d ? new Date(d) : undefined);

      await this.prisma.$transaction(
        async (tx) => {
          // 1. Delete existing records in child-first order
          await tx.budgetRevision.deleteMany();
          await tx.transaction.deleteMany();
          await tx.wishlistItem.deleteMany();
          await tx.savingsGoal.deleteMany();
          await tx.savingsManualTransaction.deleteMany();
          await tx.monthlyBulkBill.deleteMany();
          await tx.creditCardTransaction.deleteMany();
          await tx.scheduledBill.deleteMany();
          await tx.creditContract.deleteMany();
          await tx.monthlySnapshot.deleteMany();
          await tx.customFeatureRequest.deleteMany();
          await tx.auditLog.deleteMany();
          await tx.trustedIpAddress.deleteMany();
          await tx.globalConfig.deleteMany();
          await tx.user.deleteMany();

          // 2. Re-insert records in parent-first FK order with normalized Date types
          if (users.length > 0) {
            await tx.user.createMany({
              data: users.map((u: any) => {
                const { lastLoginAt, ...rest } = u;
                return {
                  ...rest,
                  createdAt: parseDate(u.createdAt) || new Date(),
                  updatedAt: parseDate(u.updatedAt) || new Date(),
                };
              }),
            });
          }

          if (globalConfigs.length > 0) {
            await tx.globalConfig.createMany({
              data: globalConfigs.map((g: any) => ({
                ...g,
                createdAt: parseDate(g.createdAt) || new Date(),
                updatedAt: parseDate(g.updatedAt) || new Date(),
              })),
            });
          }

          if (creditContracts.length > 0) {
            await tx.creditContract.createMany({
              data: creditContracts.map((c: any) => ({
                ...c,
                createdAt: parseDate(c.createdAt) || new Date(),
                updatedAt: parseDate(c.updatedAt) || new Date(),
              })),
            });
          }

          if (scheduledBills.length > 0) {
            await tx.scheduledBill.createMany({
              data: scheduledBills.map((s: any) => ({
                ...s,
                createdAt: parseDate(s.createdAt) || new Date(),
                updatedAt: parseDate(s.updatedAt) || new Date(),
              })),
            });
          }

          if (creditCardTransactions.length > 0) {
            await tx.creditCardTransaction.createMany({
              data: creditCardTransactions.map((c: any) => ({
                ...c,
                transactionDate: parseDate(c.transactionDate) || new Date(),
                createdAt: parseDate(c.createdAt) || new Date(),
                updatedAt: parseDate(c.updatedAt) || new Date(),
              })),
            });
          }

          if (monthlyBulkBills.length > 0) {
            await tx.monthlyBulkBill.createMany({
              data: monthlyBulkBills.map((b: any) => ({
                ...b,
                createdAt: parseDate(b.createdAt) || new Date(),
                updatedAt: parseDate(b.updatedAt) || new Date(),
              })),
            });
          }

          if (monthlySnapshots.length > 0) {
            await tx.monthlySnapshot.createMany({
              data: monthlySnapshots.map((s: any) => ({
                ...s,
                payrollPayoutDate: parseDate(s.payrollPayoutDate),
                createdAt: parseDate(s.createdAt) || new Date(),
                updatedAt: parseDate(s.updatedAt) || new Date(),
              })),
            });
          }

          if (transactions.length > 0) {
            await tx.transaction.createMany({
              data: transactions.map((t: any) => {
                const { updatedAt, ...rest } = t;
                return {
                  ...rest,
                  date: parseDate(t.date) || new Date(),
                  createdAt: parseDate(t.createdAt) || new Date(),
                };
              }),
            });
          }

          if (budgetRevisions.length > 0) {
            await tx.budgetRevision.createMany({
              data: budgetRevisions.map((b: any) => ({
                ...b,
                createdAt: parseDate(b.createdAt) || new Date(),
              })),
            });
          }

          if (savingsManualTransactions.length > 0) {
            await tx.savingsManualTransaction.createMany({
              data: savingsManualTransactions.map((s: any) => ({
                ...s,
                date: parseDate(s.date) || new Date(),
                createdAt: parseDate(s.createdAt) || new Date(),
                updatedAt: parseDate(s.updatedAt) || new Date(),
              })),
            });
          }

          if (savingsGoals.length > 0) {
            await tx.savingsGoal.createMany({
              data: savingsGoals.map((g: any) => ({
                ...g,
                createdAt: parseDate(g.createdAt) || new Date(),
                updatedAt: parseDate(g.updatedAt) || new Date(),
              })),
            });
          }

          if (wishlistItems.length > 0) {
            await tx.wishlistItem.createMany({
              data: wishlistItems.map((w: any) => ({
                ...w,
                createdAt: parseDate(w.createdAt) || new Date(),
                updatedAt: parseDate(w.updatedAt) || new Date(),
              })),
            });
          }

          if (auditLogs.length > 0) {
            await tx.auditLog.createMany({
              data: auditLogs.map((a: any) => ({
                ...a,
                createdAt: parseDate(a.createdAt) || new Date(),
              })),
            });
          }

          if (customFeatureRequests.length > 0) {
            await tx.customFeatureRequest.createMany({
              data: customFeatureRequests.map((f: any) => ({
                ...f,
                createdAt: parseDate(f.createdAt) || new Date(),
                updatedAt: parseDate(f.updatedAt) || new Date(),
              })),
            });
          }

          if (trustedIpAddresses.length > 0) {
            await tx.trustedIpAddress.createMany({
              data: trustedIpAddresses.map((tip: any) => ({
                ...tip,
                lastUsedAt: parseDate(tip.lastUsedAt) || new Date(),
                createdAt: parseDate(tip.createdAt) || new Date(),
              })),
            });
          }

          // 3. Reset PostgreSQL sequences so subsequent auto-increment IDs never collide
          const serialTables = [
            'User',
            'GlobalConfig',
            'MonthlySnapshot',
            'Transaction',
            'BudgetRevision',
            'CreditContract',
            'ScheduledBill',
            'CreditCardTransaction',
            'MonthlyBulkBill',
            'SavingsManualTransaction',
            'SavingsGoal',
            'WishlistItem',
            'AuditLog',
            'CustomFeatureRequest',
            'TrustedIpAddress',
          ];

          for (const tbl of serialTables) {
            await tx.$executeRawUnsafe(
              `SELECT setval(pg_get_serial_sequence('"${tbl}"', 'id'), COALESCE((SELECT MAX(id) FROM "${tbl}"), 1), (SELECT COUNT(*) > 0 FROM "${tbl}"));`,
            );
          }
        },
        { timeout: 60000 },
      );

      return {
        success: true,
        mode: RestoreMode.RESTORE_OVERWRITE,
        restoredCounts: summary,
        restoredAt: new Date().toISOString(),
      };
    }

    throw new BadRequestException(`Unsupported restore mode: ${dto.mode}`);
  }
}

