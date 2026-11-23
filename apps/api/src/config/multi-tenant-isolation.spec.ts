import * as fs from 'fs';
import * as path from 'path';
import { buildDefaultStudioConfig } from './studio.defaults';
import { MarqueeContextHydrator } from '../marquee/marquee-context.service';
import {
  DEFAULT_STANDARD_ROUTINE_LABELS,
  SUNDAY_FUNDAY_STANDARD_MODULES,
} from '../auth/auth.types';

const API_SRC = path.resolve(__dirname, '..');

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('Multi-Tenant Isolation & Sunday Funday Standard Defaults (TDD)', () => {
  it('forbids falling back to userId = 1 GlobalConfig queries across all domain modules', () => {
    const domains = ['credit', 'finance', 'reports', 'savings', 'snapshots'];
    for (const domain of domains) {
      const files = collectTsFiles(path.join(API_SRC, domain));
      for (const file of files) {
        const src = fs.readFileSync(file, 'utf8');
        expect({
          file: path.relative(API_SRC, file),
          hasUser1Fallback: /findFirst\(\s*\{\s*where:\s*\{\s*userId:\s*1\s*\}/.test(src),
        }).toEqual({
          file: path.relative(API_SRC, file),
          hasUser1Fallback: false,
        });
      }
    }
  });

  it('isolates standard users (userId = 4) and Demo Sandbox (userId = 2) from User #1 personal payday schedule, credit instruments, and routine labels', () => {
    const ownerCfg = buildDefaultStudioConfig(1);
    const sandboxCfg = buildDefaultStudioConfig(2);
    const standardCfg = buildDefaultStudioConfig(4);

    // Preserve User #1 Golden Ledger bespoke defaults untouched
    expect(ownerCfg.paycycleFormulaConfig.periodOverrides['11/2026']?.paydayDateIso).toBe('2026-10-28');
    expect(ownerCfg.paycycleFormulaConfig.laptopAllowanceRp).toBe(250_000);
    expect(ownerCfg.paycycleFormulaConfig.bpjsRatePercent).toBe(3);
    expect(ownerCfg.paycycleFormulaConfig.thrJoinDateIso).toBe('2026-04-06');
    expect(ownerCfg.instrumentsTable.some((i) => i.name.includes('SPayLater'))).toBe(true);
    expect(ownerCfg.routineTemplatesTable.some((r) => r.name.includes('Vape'))).toBe(true);

    // Verify User #4 & Sandbox have zero User #1 personal data leakage
    for (const cfg of [sandboxCfg, standardCfg]) {
      expect(Object.keys(cfg.paycycleFormulaConfig.periodOverrides)).toHaveLength(0);
      expect(cfg.paycycleFormulaConfig.laptopAllowanceRp).toBe(0);
      expect(cfg.paycycleFormulaConfig.bpjsRatePercent).toBe(0);
      expect(cfg.paycycleFormulaConfig.defaultDailyAllowanceRp).toBe(0);
      expect(cfg.paycycleFormulaConfig.thrJoinDateIso).toBe('');
      expect(cfg.paycycleFormulaConfig.thrHolidayDateIso).toBe('');
      expect(cfg.instrumentsTable.some((i) => /SPayLater|Permata|SPinjam/i.test(i.name))).toBe(false);
      expect(cfg.routineTemplatesTable.some((r) => /KRL|Vape|Haircut/i.test(r.name))).toBe(false);
      expect(cfg.routineTemplatesTable.map((r) => r.name)).toEqual([
        DEFAULT_STANDARD_ROUTINE_LABELS.transport,
        DEFAULT_STANDARD_ROUTINE_LABELS.internet,
        DEFAULT_STANDARD_ROUTINE_LABELS.vape,
        DEFAULT_STANDARD_ROUTINE_LABELS.haircut,
      ]);
    }

    expect(standardCfg.instrumentsTable).toEqual([]);
    expect(standardCfg.paycycleFormulaConfig.sinkingFunds).toEqual([]);
  });

  it('defines US-standard default module set while keeping debt & corporate payroll opt-in', () => {
    expect(SUNDAY_FUNDAY_STANDARD_MODULES).toEqual([
      'overview',
      'ledger',
      'allocations',
      'income',
      'savings_vault',
      'cash_radar',
      'executive_reports',
      'scenarios',
      'wishlist_simulator',
      'preferences',
    ]);
    expect(SUNDAY_FUNDAY_STANDARD_MODULES).not.toContain('credit_liabilities');
    expect(SUNDAY_FUNDAY_STANDARD_MODULES).not.toContain('corporate_payroll');
    expect(SUNDAY_FUNDAY_STANDARD_MODULES).not.toContain('payday_wizard');
    expect(SUNDAY_FUNDAY_STANDARD_MODULES).not.toContain('statement_import');
    expect(SUNDAY_FUNDAY_STANDARD_MODULES).not.toContain('advanced_analytics');
  });

  it('never leaks User #1 personal SPinjam/SPayLater/Permata/KSM milestones or prompts into Marquee context for standard users', async () => {
    const prismaMock: any = {
      monthlySnapshot: { findMany: jest.fn().mockResolvedValue([]) },
      liabilityLineItem: { findMany: jest.fn().mockResolvedValue([]) },
      transaction: { findMany: jest.fn().mockResolvedValue([]) },
      creditCardTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      creditContract: { findMany: jest.fn().mockResolvedValue([]) },
      wishlistItem: { findMany: jest.fn().mockResolvedValue([]) },
      savingsGoal: { findMany: jest.fn().mockResolvedValue([]) },
      globalConfig: {
        findFirst: jest.fn().mockResolvedValue({
          userId: 4,
          profileMode: 'STANDARD_GENERAL',
          payrollMode: 'SIMPLE_FIXED_SALARY',
          baseSalary: 10_000_000,
        }),
      },
    };
    const snapshotsSelectorsMock: any = {
      getDefaultActivePeriod: jest.fn().mockResolvedValue({ month: 11, year: 2026 }),
    };
    const financeSelectorsMock: any = {
      getPacing: jest.fn().mockResolvedValue({
        cycleTemporalState: 'ACTIVE',
        daysUntilCycleStart: 0,
        currentDayIndex: 23,
        daysInCycle: 30,
        daysRemaining: 8,
        cycleDateLabel: '1 Nov – 30 Nov 2026',
        baselineDailyRate: 100_000,
        weightedSafeToSpendToday: 100_000,
        safeToSpendToday: 100_000,
        remainingBudget: 800_000,
      }),
    };
    const savingsSelectorsMock: any = {
      getOverview: jest.fn().mockResolvedValue({ totalBalance: 0, rdpuBalance: 0 }),
    };

    const hydrator = new MarqueeContextHydrator(
      prismaMock,
      snapshotsSelectorsMock,
      financeSelectorsMock,
      savingsSelectorsMock,
    );

    const ctx = await hydrator.hydrateForUser(4, { month: 11, year: 2026, locale: 'en' });
    expect(ctx.payoffMilestones).toEqual([]);
    expect(ctx.systemPrompt).not.toMatch(/SPinjam|11\.11 Promo|Anthropic Claude|Mandiri KSM|Permata|SPayLater|Vape Supplies/i);
    expect(ctx.proactiveReminders.some((r) => /SPayLater|Permata/i.test(r.text))).toBe(false);
  });
});
