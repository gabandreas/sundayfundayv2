import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildDefaultPayrollRules,
  buildDefaultAllocationBuckets,
  buildDefaultSurplusSplitRules,
  buildDefaultFinancialPolicy,
} from '../calculator/modular-engine';
import { ALL_MODULE_KEYS, getLifeStagePresetDefaults } from '../auth/auth.types';
import { resolveStudioConfig } from './studio.defaults';

@Injectable()
export class ConfigSelectors {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the singleton GlobalConfig row with modular rules populated with safe defaults.
   */
  async getConfig(userId: number = 1) {
    let existing =
      (await this.prisma.globalConfig.findUnique({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId } }));
    if (!existing) {
      const isBespokeOwner = userId === 1;
      existing = await this.prisma.globalConfig.create({
        data: {
          ...(isBespokeOwner ? { id: 1 } : {}),
          userId,
          baseSalary: 0,
          dailyAllowance: 0,
          laptopAllowance: isBespokeOwner ? 250000 : 0,
          dailyOperational: 0,
          transport: 0,
          internet: 0,
          vape: 0,
          haircut: 0,
          baseSavings: 0,
          creditLimit: isBespokeOwner ? 7000000 : 0,
          creditStatementDay: isBespokeOwner ? 20 : 25,
          creditDueDay: 11,
          payrollPayoutDay: isBespokeOwner ? 25 : 1,
        },
      });
    }

    const payrollRules =
      existing.payrollRulesJson ??
      buildDefaultPayrollRules(existing.dailyAllowance, existing.laptopAllowance);

    const allocationBuckets =
      existing.allocationBucketsJson ??
      buildDefaultAllocationBuckets({
        transport: existing.transport,
        internet: existing.internet,
        vape: existing.vape,
        haircut: existing.haircut,
        dailyOperational: existing.dailyOperational,
        savings: existing.baseSavings,
        bufferPocket: 0,
      });

    const surplusSplitRules =
      existing.surplusSplitRulesJson ?? buildDefaultSurplusSplitRules();

    const financialPolicy =
      existing.financialPolicyJson ?? buildDefaultFinancialPolicy();

    const lifeStagePreset =
      existing.lifeStagePreset ||
      (userId === 1 ? 'SUPERADMIN_BESPOKE' : 'CORPORATE_PROFESSIONAL');
    const presetDefaults = getLifeStagePresetDefaults(lifeStagePreset);

    const enabledModulesJson =
      Array.isArray(existing.enabledModulesJson) &&
      (existing.enabledModulesJson as any[]).length > 0
        ? existing.enabledModulesJson
        : userId === 1
          ? ALL_MODULE_KEYS
          : presetDefaults.enabledModules;

    const formulaEngineType =
      existing.formulaEngineType || presetDefaults.formulaEngineType || 'DEBT_FIRST_WATERFALL';

    const uiDensityMode =
      existing.uiDensityMode || presetDefaults.uiDensityMode || 'COMMAND_COCKPIT';

    const studioConfig = resolveStudioConfig(userId, existing.formulaParamsJson, existing);

    return {
      ...existing,
      lifeStagePreset,
      uiDensityMode,
      enabledModulesJson,
      formulaEngineType,
      payrollRules,
      allocationBuckets,
      surplusSplitRules,
      financialPolicy,
      studioConfig,
    };
  }

  /**
   * Read-only tenant-scoped ERP Database Snapshot Backup across all 11 domain tables.
   */
  async exportFullBackup(userId: number = 1) {
    const [
      globalConfig,
      monthlySnapshots,
      transactions,
      budgetRevisions,
      creditContracts,
      scheduledBills,
      creditCardTransactions,
      monthlyBulkBills,
      savingsManualTransactions,
      wishlistItems,
      auditLogs,
    ] = await Promise.all([
      this.prisma.globalConfig.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      this.prisma.monthlySnapshot.findMany({
        where: { userId },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
      this.prisma.transaction.findMany({
        where: { snapshot: { userId } },
        orderBy: { id: 'asc' },
      }),
      this.prisma.budgetRevision.findMany({
        where: { snapshot: { userId } },
        orderBy: { id: 'asc' },
      }),
      this.prisma.creditContract.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      this.prisma.scheduledBill.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      this.prisma.creditCardTransaction.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      this.prisma.monthlyBulkBill.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      this.prisma.savingsManualTransaction.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      this.prisma.wishlistItem.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      this.prisma.auditLog.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
    ]);

    const redactedGlobalConfig = globalConfig.map((cfg) => ({
      ...cfg,
      killSwitchSmtpAppPassword: cfg.killSwitchSmtpAppPassword ? '[REDACTED]' : null,
      killSwitchWaApiKey: cfg.killSwitchWaApiKey ? '[REDACTED]' : null,
    }));

    return {
      schemaVersion: '2.0',
      application: 'Sunday Funday V2 — Personal Finance ERP',
      exportedAt: new Date().toISOString(),
      counts: {
        globalConfig: globalConfig.length,
        monthlySnapshots: monthlySnapshots.length,
        transactions: transactions.length,
        budgetRevisions: budgetRevisions.length,
        creditContracts: creditContracts.length,
        scheduledBills: scheduledBills.length,
        creditCardTransactions: creditCardTransactions.length,
        monthlyBulkBills: monthlyBulkBills.length,
        savingsManualTransactions: savingsManualTransactions.length,
        wishlistItems: wishlistItems.length,
        auditLogs: auditLogs.length,
      },
      data: {
        globalConfig: redactedGlobalConfig,
        monthlySnapshots,
        transactions,
        budgetRevisions,
        creditContracts,
        scheduledBills,
        creditCardTransactions,
        monthlyBulkBills,
        savingsManualTransactions,
        wishlistItems,
        auditLogs,
      },
    };
  }
}
