import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { execFileSync, execSync } from 'node:child_process';
import * as path from 'node:path';

const ROOT_DIR = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT_DIR, 'apps', 'api');

const NEON_URL =
  process.env.NEON_DATABASE_URL ||
  'postgresql://neondb_owner:npg_kLTO3alGm2RE@ep-nameless-bird-b30zfam7-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30';

process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = NEON_URL;

async function main() {
  console.log('=== SUNDAY FUNDAY ERP — ZERO-DEFECT VERIFICATION HARNESS ===\n');

  // 1. Go Engine Unit Suite
  console.log('[1/9] Running Go Engine tests (npm run erp:go:test)...');
  execSync('npm run erp:go:test', { cwd: ROOT_DIR, stdio: 'inherit' });

  // 2. NestJS API Jest & Parity Suite
  console.log('\n[2/9] Running NestJS Jest parity suite (npx jest --no-cache)...');
  execSync('npx jest --no-cache', { cwd: API_DIR, stdio: 'inherit' });

  // Boot NestJS AppContext against Neon Cloud (strictly READ-ONLY for User #1)
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../apps/api/dist/src/app.module');
  const { PrismaService } = await import('../apps/api/dist/src/prisma/prisma.service');
  const { CreditSelectors } = await import('../apps/api/dist/src/credit/credit.selectors');
  const { FinanceSelectors } = await import('../apps/api/dist/src/finance/finance.selectors');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  try {
    const prisma = app.get(PrismaService);
    const creditSelectors = app.get(CreditSelectors);
    const financeSelectors = app.get(FinanceSelectors);

    // 3. Verify User #1 Golden Ledger Baseline + 0 Rp Drift across all 12 snapshots
    console.log('\n[3/9] Verifying User #1 Neon Cloud 12 snapshots & Golden Ledger Baseline...');
    const snapshots = await prisma.monthlySnapshot.findMany({
      where: { userId: 1 },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
    assert.ok(snapshots.length >= 12, `Expected >= 12 snapshots for User #1, got ${snapshots.length}`);

    const snapMap = new Map(snapshots.map((s: any) => [`${s.month}/${s.year}`, s]));
    const oct26: any = snapMap.get('10/2026');
    const nov26: any = snapMap.get('11/2026');
    const dec26: any = snapMap.get('12/2026');
    const jan27: any = snapMap.get('1/2027');
    const feb27: any = snapMap.get('2/2027');
    const mar27: any = snapMap.get('3/2027');

    assert.equal(oct26?.status, 'LOCKED', '10/2026 must be LOCKED');
    assert.equal(Math.round(oct26?.totalDeductions ?? -1), 4082655, '10/2026 Total Debt must be 4,082,655');
    assert.equal(Math.round(oct26?.deficitUncovered ?? -1), 0, '10/2026 deficit must be 0');

    // Active period today (22 Nov 2026): 11/2026 (28 Oct – 26 Nov 2026, Day 26 of 30, 5 days remaining)
    assert.equal(nov26?.status, 'DRAFT', '11/2026 must be DRAFT (active cycle)');
    assert.equal(nov26?.isManualOverride, true, '11/2026 isManualOverride must be true');
    assert.equal(Math.round(nov26?.finalTotalIncome ?? -1), 5891000, '11/2026 finalTotalIncome must be 5,891,000 (never inflated by bridgeInflowAmount)');
    assert.equal(Math.round(nov26?.bridgeInflowAmount ?? -1), 900000, '11/2026 bridgeInflowAmount must be 900,000');
    assert.equal(Math.round(nov26?.totalDeductions ?? -1), 4522976, '11/2026 Total Debt must be 4,522,976');
    assert.equal(Math.round(nov26?.actualDailyOperational ?? -1), 1720316, '11/2026 actualDailyOperational must be 1,720,316');
    assert.equal(Math.round(nov26?.actualSavings ?? -1), 6341, '11/2026 Core Savings P1 must be 6,341');
    assert.equal(Math.round(nov26?.selfReward ?? -1), 250000, '11/2026 Self-Reward P2 must be 250,000');
    assert.equal(Math.round(nov26?.deficitUncovered ?? -1), 108633, '11/2026 deficitUncovered must reflect 6,899,633 - 6,791,000 = 108,633');

    const novPacing = await financeSelectors.getPacing(
      11,
      2026,
      new Date('2026-11-22T03:00:00.000Z'),
      undefined,
      1,
    );
    assert.equal(novPacing.cycleTemporalState, 'ACTIVE', '11/2026 on Nov 22 must be ACTIVE');
    assert.equal(novPacing.currentDayIndex, 26, '11/2026 on Nov 22 must be Day 26');
    assert.equal(novPacing.daysInCycle, 30, '11/2026 must be 30 days (28 Oct – 26 Nov)');
    assert.equal(novPacing.daysRemaining, 5, '11/2026 on Nov 22 must have 5 days remaining');
    assert.equal(Math.round(novPacing.totalOperationalBudget), 1720316, '11/2026 pacing totalOperationalBudget must be 1,720,316');
    assert.equal(Math.round(novPacing.totalDailySpent), 1620316, '11/2026 pacing totalDailySpent must be 1,620,316 (with Nov 22 Rp 140k + Nov 23 Rp 60k cash syncs)');
    assert.equal(Math.round(novPacing.remainingBudget), 100000, '11/2026 pacing remainingBudget must be Rp 100,000');

    // Upcoming period (22 Nov 2026): 12/2026 (27 Nov – 27 Dec 2026, PRE_PAYDAY Day 0, starts in 5 days) with Natal THR H-7 Dec 18 & Nov 25 Benefit EWA (-Rp 360.500)
    assert.equal(Math.round(dec26?.finalTotalIncome ?? -1), 9376925, '12/2026 finalTotalIncome (Bank Salary 5,543,500 + Natal THR 3,833,425) must be 9,376,925');
    assert.equal(Math.round(dec26?.totalDeductions ?? -1), 4260841, '12/2026 Total Debt (incl. Nov 23 Americano & Dunhill Rp 52k + Cigar Rp 27k & Nov 24 Ayam Gepuk Rp 38.5k + Dunhill Rp 33k routed to 12/2026) must be 4,260,841');
    assert.equal(Math.round(dec26?.actualDailyOperational ?? -1), 1500000, '12/2026 actualDailyOperational must be 1,500,000');
    assert.equal(Math.round(dec26?.actualSavings ?? -1), 1000000, '12/2026 P1 must be 1,000,000 funded with Natal THR');
    assert.equal(Math.round(dec26?.selfReward ?? -1), 2316084, '12/2026 P2 must be 2,316,084');
    assert.equal(Math.round(dec26?.deficitUncovered ?? -1), 0, '12/2026 deficitUncovered must be 0 with Natal THR');

    const decPacing = await financeSelectors.getPacing(
      12,
      2026,
      new Date('2026-11-22T03:00:00.000Z'),
      undefined,
      1,
    );
    assert.equal(decPacing.cycleTemporalState, 'PRE_PAYDAY', '12/2026 on Nov 22 must be PRE_PAYDAY');
    assert.equal(decPacing.currentDayIndex, 0, '12/2026 on Nov 22 must be Day 0');
    assert.equal(decPacing.daysUntilCycleStart, 5, '12/2026 on Nov 22 must start in 5 days');
    assert.equal(Math.round(decPacing.totalOperationalBudget), 1500000, '12/2026 pacing totalOperationalBudget must be 1,500,000');

    assert.equal(Math.round(jan27?.finalTotalIncome ?? -1), 5941000, '01/2027 Total Income (THR moved to 12/2026) must be 5,941,000');
    assert.equal(Math.round(jan27?.totalDeductions ?? -1), 3171115, '01/2027 Total Debt (after Nov 23 Americano & Dunhill Rp 52k relocated to 12/2026) must be 3,171,115');
    assert.equal(Math.round(jan27?.dailyOperational ?? -1), 1500000, '01/2027 dailyOperational must be 1,500,000');
    assert.equal(Math.round(jan27?.actualSavings ?? -1), 734885, '01/2027 P1 must be 734,885');
    assert.equal(Math.round(jan27?.selfReward ?? -1), 0, '01/2027 P2 must be 0');

    assert.equal(Math.round(feb27?.totalDeductions ?? -1), 1967159, '02/2027 Total Debt must be 1,967,159');
    assert.equal(Math.round(feb27?.dailyOperational ?? -1), 1500000, '02/2027 dailyOperational must be 1,500,000');
    assert.equal(Math.round(feb27?.actualSavings ?? -1), 1000000, '02/2027 P1 must be 1,000,000');
    assert.equal(Math.round(feb27?.selfReward ?? -1), 888841, '02/2027 P2 must be 888,841');
    assert.equal(Math.round(mar27?.totalDeductions ?? -1), 835996, '03/2027 Total Debt must be 835,996');

    const jul27: any = snapMap.get('7/2027');
    const aug27: any = snapMap.get('8/2027');
    const sep27: any = snapMap.get('9/2027');
    assert.equal(Math.round(jul27?.totalDeductions ?? -1), 293044, '07/2027 Total Debt must be 293,044');
    assert.equal(Math.round(aug27?.totalDeductions ?? -1), 293044, '08/2027 Total Debt must be 293,044');
    assert.equal(Math.round(sep27?.totalDeductions ?? -1), 293044, '09/2027 Total Debt must be 293,044');
    assert.equal(Math.round(sep27?.finalTotalIncome ?? -1), 5916000, '09/2027 Total Income (21 wd) must be 5,916,000');
    for (const s of [jul27, aug27]) {
      const ccTxs = await prisma.transaction.findMany({
        where: { snapshotId: s.id, sourceType: 'CC_TRANSACTION' },
      });
      const seen = new Set<string>();
      for (const tx of ccTxs) {
        const key = `${tx.sourceType}:${tx.sourceId}`;
        assert.equal(seen.has(key), false, `Duplicate ${key} in ${s.month}/${s.year}`);
        seen.add(key);
      }
    }

    const bulkBills = await prisma.monthlyBulkBill.findMany({ where: { userId: 1 } });
    const lineItems = await prisma.liabilityLineItem.findMany({ where: { userId: 1 } });
    for (const b of bulkBills) {
      const items = lineItems.filter((li: any) => li.month === b.month && li.year === b.year);
      if (items.length === 0) continue;
      const pl = items
        .filter((li: any) => li.category === 'PAYLATER')
        .reduce((sum: number, li: any) => sum + Math.round(li.monthlyAmount), 0);
      const pd = items
        .filter((li: any) => li.category === 'PERSONAL_DEBT' || li.category === 'P1_VAULT_REFUND')
        .reduce((sum: number, li: any) => sum + Math.round(li.monthlyAmount), 0);
      assert.equal(
        Math.round(b.paylaterAmount) === pl && Math.round(b.personalDebtAmount) === pd,
        true,
        `Sub-ledger mismatch in ${b.month}/${b.year}: Bulk(${b.paylaterAmount}/${b.personalDebtAmount}) vs Items(${pl}/${pd})`,
      );
    }
    const { calculateCardDueAmountForMonth } = await import('../apps/api/dist/src/credit/credit.utils');
    const fullSnaps = await prisma.monthlySnapshot.findMany({
      where: { userId: 1 },
      include: {
        transactions: true,
        budgetRevisions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });
    const cardTxs = await prisma.creditCardTransaction.findMany({
      where: { userId: 1, status: { in: ['ACTIVE', 'SETTLED'] } },
    });
    const bulkMap = new Map(bulkBills.map((b: any) => [`${b.month}/${b.year}`, b]));
    const activeSnaps = fullSnaps.filter(
      (s: any) => s.year > 2026 || (s.year === 2026 && s.month >= 10),
    );
    const doctorBin = path.join(
      ROOT_DIR,
      'apps',
      'go-engine',
      'bin',
      process.platform === 'win32' ? 'go-engine.exe' : 'go-engine',
    );
    const doctorReq = {
      lineItems: lineItems.map((li: any) => ({
        id: li.id,
        month: li.month,
        year: li.year,
        category: li.category,
        amount: Math.round(li.monthlyAmount),
      })),
      bulkBills: bulkBills.map((b: any) => ({
        month: b.month,
        year: b.year,
        paylaterAmount: Math.round(b.paylaterAmount),
        personalDebtAmount: Math.round(b.personalDebtAmount),
        creditCardAmount: Math.round(b.creditCardAmount),
        totalAmount: Math.round(b.totalAmount),
      })),
      snapshots: activeSnaps.map((s: any) => {
        const bulk: any = bulkMap.get(`${s.month}/${s.year}`);
        const ccSum = cardTxs.reduce(
          (sum: number, c: any) =>
            sum + Math.round(calculateCardDueAmountForMonth(c, s.month, s.year)),
          0,
        );
        const oneOffBills = Array.isArray(s.oneOffBillsJson) ? s.oneOffBillsJson : [];
        const oneOffSum = oneOffBills.reduce(
          (sum: number, b: any) => sum + Math.max(0, Math.round(Number(b?.amount) || 0)),
          0,
        );
        const fixedEssentials =
          Math.round(s.transport ?? 0) +
          Math.round(s.internet ?? 0) +
          Math.round(s.vape ?? 0) +
          Math.round(s.haircut ?? 0) +
          oneOffSum;
        let dailyTarget = Math.round(s.dailyOperational ?? 0);
        if (Array.isArray(s.budgetRevisions) && s.budgetRevisions.length > 0) {
          const revs = [...s.budgetRevisions].reverse();
          const dRev = revs.find(
            (r: any) =>
              r.category === 'DAILY_OPERATIONAL' ||
              r.bucketKey?.toLowerCase() === 'daily_operational',
          );
          if (dRev) dailyTarget = Math.round(dRev.newValue);
        }
        const expectedBulkDebt =
          Math.round(bulk?.paylaterAmount ?? 0) +
          Math.round(bulk?.personalDebtAmount ?? 0) +
          ccSum;
        return {
          month: s.month,
          year: s.year,
          finalTotalIncome: Math.round(s.finalTotalIncome),
          totalDeductions: Math.round(s.totalDeductions),
          fixedEssentials,
          dailyOperationalTarget: dailyTarget,
          actualDailyOperational: Math.round(s.actualDailyOperational),
          bufferPocket: Math.round(s.bufferPocket ?? 0),
          actualSavings: Math.round(s.actualSavings),
          selfReward: Math.round(s.selfReward),
          deficitUncovered: Math.round(s.deficitUncovered),
          manualDeductions: Math.round(s.totalDeductions) - expectedBulkDebt,
          expectedBulkDebt,
          isManualOverride: Boolean(s.isManualOverride),
        };
      }),
    };
    const doctorRes = JSON.parse(
      execFileSync(doctorBin, ['-cmd', 'doctor-audit'], {
        input: JSON.stringify(doctorReq),
        encoding: 'utf8',
      }),
    );
    assert.equal(doctorRes.isHealthy, true, `Go doctor failed: ${JSON.stringify(doctorRes)}`);
    assert.equal(doctorRes.totalSubLedgerDrift, 0);
    assert.equal(doctorRes.totalDeductionDrift, 0);
    assert.equal(doctorRes.totalWaterfallDrift, 0);
    console.log(`  PASS: ${snapshots.length} snapshots, ${bulkBills.length} bulk bills & Go doctor (${activeSnaps.length} active) verified with 0 Rp drift.`);

    // 4. Verify User #1 Intelligence Bundle: no fabricated assets + Age of Money + Unlock Milestones
    console.log('\n[4/11] Verifying User #1 real-life data truth (no fake RDPU assets) & 11/2026 + 12/2026 metrics...');
    const intelNov = await financeSelectors.getIntelligenceBundle(11, 2026, 1, 0);
    const intelDec = await financeSelectors.getIntelligenceBundle(12, 2026, 1, 0);
    assert.equal(
      intelNov.studioConfig.enableExternalAssetPortfolio,
      false,
      'User #1 enableExternalAssetPortfolio must default to false',
    );
    assert.equal(intelNov.networth.monthlyRdpuYieldRp, 0, 'User #1 monthly RDPU yield must be 0 Rp');
    const fakeIds = new Set(['acc_blu_rdpu', 'acc_bca_payroll', 'acc_cash_wallet', 'acc_p1_vault']);
    for (const acc of intelNov.effectiveAssetAccounts ?? []) {
      assert.equal(fakeIds.has(acc.id), false, `Fabricated asset ${acc.id} leaked into effectiveAssetAccounts`);
    }
    assert.equal(
      intelNov.envelopes.ageOfMoneyDays,
      intelNov.envelopes.bufferDays,
      'Age of Money / Savings Runway must equal bufferDays',
    );
    console.log(
      `  PASS: External portfolio OFF, RDPU yield = Rp 0, Savings Runway = ${intelNov.envelopes.bufferDays}d.`,
    );

    // 5. Verify 12/2026 Credit & Debt Ceiling Control
    console.log('\n[5/11] Verifying 12/2026 Credit Ceiling formula & direct period maturity dates...');
    const creditDec = await creditSelectors.getCreditUsageLimit(12, 2026, 1);
    assert.equal(creditDec.isSafeCeilingExceeded, false, '12/2026 isSafeCeilingExceeded must be false with Natal THR & CC #31 deleted');
    assert.equal(
      creditDec.ceilingBreakdown.recommendedSafeCombinedCeiling,
      6906955,
      `12/2026 Safe Ceiling must be Rp 6,906,955, got ${creditDec.ceilingBreakdown.recommendedSafeCombinedCeiling}`,
    );
    assert.equal(creditDec.maturityMonth, 12, '12/2026 credit usage card must map directly to 12/2026 maturity');
    assert.equal(creditDec.maturityYear, 2026, '12/2026 credit usage maturity year must be 2026');
    console.log(
      `  PASS: 12/2026 Safe Ceiling = Rp 6,906,955, isSafeCeilingExceeded = ${creditDec.isSafeCeilingExceeded}, Maturity = 12/2026.`,
    );

    // 6. Verify Debt Optimizer excludes P1_VAULT_REFUND & matches exact SPinjam unlocks
    console.log('\n[6/11] Verifying Next Cashflow Unlock excludes P1_VAULT_REFUND...');
    const janUnlock = intelDec.debtopt.unlockMilestones.find(
      (m: any) => m.unlockMonth === 1 && m.unlockYear === 2027,
    );
    const febUnlock = intelDec.debtopt.unlockMilestones.find(
      (m: any) => m.unlockMonth === 2 && m.unlockYear === 2027,
    );
    assert.ok(janUnlock, 'Expected JAN 27 unlock milestone');
    assert.ok(febUnlock, 'Expected FEB 27 unlock milestone');
    for (const ms of intelDec.debtopt.unlockMilestones) {
      assert.equal(
        ms.finishedContracts.some((n: string) => /hoodie|p1 vault/i.test(n)),
        false,
        `P1_VAULT_REFUND leaked into unlock milestone ${ms.unlockLabel}`,
      );
    }
    assert.equal(janUnlock.freedMonthlyRp, 147960, `JAN 27 unlock must be 147960, got ${janUnlock.freedMonthlyRp}`);
    assert.equal(
      febUnlock.spinjamOnlyFreedRp,
      522010,
      `FEB 27 SPinjam unlock must be 522010, got ${febUnlock.spinjamOnlyFreedRp}`,
    );
    assert.equal(
      janUnlock.freedMonthlyRp + febUnlock.spinjamOnlyFreedRp,
      669970,
      'Total SPinjam freed across JAN + FEB must equal 669,970',
    );
    console.log('  PASS: JAN 27 = +Rp 147,960 (SPinjam #1+#2), FEB 27 SPinjam = +Rp 522,010 (Total 669,970).');

    // 7. Verify Itemized December SPinjam Timeline Dates on 12/2026
    console.log('\n[7/11] Verifying 12/2026 Payday Timeline individual December SPinjam due dates...');
    const timelineDec = await financeSelectors.simulateTimelineForUser(
      { month: 12, year: 2026 },
      1,
    );
    const eventDates = new Set(timelineDec.events.map((e: any) => e.dateIso));
    for (const expectedDate of ['2026-12-08', '2026-12-17', '2026-12-23', '2026-12-24']) {
      assert.ok(
        eventDates.has(expectedDate),
        `Timeline missing SPinjam due date ${expectedDate}. Found: ${Array.from(eventDates).join(', ')}`,
      );
    }
    console.log('  PASS: Timeline events render chronological 2026-12-08, 12-17, 12-23, 2026-12-24 dates.');

    // 8. Verify Lock-Safe Bulk Reconciler (10/2026 LOCKED -> advances to 11/2026) & Formula DSL
    console.log('\n[8/11] Verifying Lock-Safe Bulk Statement Reconciler & Formula DSL endpoint...');
    const parsed = await financeSelectors.parseStatementForUser(
      {
        rawText: '2026-09-12, Kopi SPayLater, Rp 34.200\n2026-10-18, GrabRide Cash, Rp 28.500',
        defaultMethod: 'CASH',
        defaultYear: 2026,
      },
      1,
    );
    assert.equal(parsed.rows.length, 2, 'Expected 2 parsed statement rows');
    assert.equal(parsed.rows[0].originalPeriodCode, '09/2026', 'Expected row 0 pre-cutoff SPayLater originalPeriodCode === 09/2026');
    assert.equal(parsed.rows[1].originalPeriodCode, '10/2026', 'Expected row 1 Cash originalPeriodCode === 10/2026');
    for (const r of parsed.rows) {
      assert.equal(r.targetPeriodCode, '11/2026', `Expected lock-safe 11/2026, got ${r.targetPeriodCode}`);
      assert.equal(r.advancedFromLocked, true, 'Expected advancedFromLocked === true');
    }
    const formulaRes = await financeSelectors.evaluateFormulaSuiteForUser(
      12,
      2026,
      { tenPctIncome: 'ROUND(PCT({NET_INCOME}, 10))' },
      {},
      1,
    );
    assert.equal(formulaRes.evaluation.allValid, true);
    assert.equal(formulaRes.evaluation.results.tenPctIncome.valueRp, 937693);
    console.log('  PASS: Reconciler locks 10/2026 safely into 11/2026 & Formula DSL evaluates accurately.');

    // 9. Verify Dynamic Milestone Progression in 03/2027 (SPINJAM_ZERO -> PAYLATER_INSTALLMENTS_ZERO)
    console.log('\n[9/11] Verifying Dynamic Milestone progression from 11/2026 & 12/2026 to 03/2027...');
    const intelMar27 = await financeSelectors.getIntelligenceBundle(3, 2027, 1, 0);
    assert.equal(intelNov.dynamicMilestone.code, 'SPINJAM_ZERO', '11/2026 milestone must be SPINJAM_ZERO');
    assert.equal(intelDec.dynamicMilestone.code, 'SPINJAM_ZERO', '12/2026 milestone must be SPINJAM_ZERO');
    assert.equal(
      intelMar27.dynamicMilestone.code,
      'PAYLATER_INSTALLMENTS_ZERO',
      `03/2027 milestone must transition to PAYLATER_INSTALLMENTS_ZERO, got ${intelMar27.dynamicMilestone.code}`,
    );
    console.log('  PASS: Milestone transitions cleanly from SPINJAM_ZERO (11/2026..02/2027) -> PAYLATER_INSTALLMENTS_ZERO (03/2027).');

    // 10. Verify Strict Period-Scoped Contracts, Direct Maturity Labels, and External Debt Principal
    console.log('\n[10/11] Verifying strict period scoping, direct maturity labels, P1 epoch isolation, and external debt principal...');
    const matrix = await creditSelectors.getLiabilityMatrix(10, 2026, 12, 1);
    const hoodieInContractRows = matrix.contractRows.some((c: any) =>
      /hoodie|p1 vault/i.test(c.label || ''),
    );
    assert.equal(
      hoodieInContractRows,
      false,
      'Single-period Hoodie P1 Vault Refund (1/1) must NOT appear in multi-month contractRows',
    );
    assert.equal(
      (matrix.personalDebtRow.cells['2026-12']?.items ?? []).some((i: any) =>
        /hoodie|p1 vault/i.test(i.title || ''),
      ),
      false,
      'Hoodie P1 must NOT appear in 12/2026 personalDebtRow',
    );
    assert.equal(
      (matrix.personalDebtRow.cells['2027-1']?.items ?? []).some((i: any) =>
        /hoodie|p1 vault/i.test(i.title || ''),
      ),
      true,
      'Hoodie P1 must appear in 01/2027 personalDebtRow',
    );
    const mar27ActiveContracts = matrix.contractRows.filter(
      (c: any) => (c.totalTenor ?? 1) > 1 && (c.cells?.['2027-3']?.amount ?? 0) > 0,
    );
    for (const fc of mar27ActiveContracts) {
      assert.equal(
        /spinjam|11\.11/i.test(fc.label || ''),
        false,
        `Expired SPinjam/11.11 plan "${fc.label}" leaked into 03/2027 active contracts`,
      );
    }
    const anthropicContract = matrix.contractRows.find((c: any) =>
      /anthropic|claude/i.test(c.label || ''),
    );
    assert.equal(
      anthropicContract?.payoffDateLabel,
      'Mar 2027',
      `Expected Anthropic Claude (6/6 in 03/2027) maturity Mar 2027, got ${anthropicContract?.payoffDateLabel}`,
    );

    assert.equal(
      intelNov.networth.currentCycleDebtRp,
      4522976,
      `11/2026 currentCycleDebtRp must be 4,522,976, got ${intelNov.networth.currentCycleDebtRp}`,
    );
    assert.equal(
      intelDec.networth.currentCycleDebtRp,
      4260841,
      `12/2026 currentCycleDebtRp must be 4,260,841, got ${intelDec.networth.currentCycleDebtRp}`,
    );
    const p1AccountsTotal = (intelNov.effectiveAssetAccounts ?? [])
      .filter((a: any) => a.accountType === 'SAVINGS_VAULT')
      .reduce((s: number, a: any) => s + a.balanceRp, 0);
    assert.ok(
      p1AccountsTotal < 1_000_000,
      `User #1 11/2026 P1 vault (${p1AccountsTotal}) must exclude pre-epoch phantom backfill`,
    );
    console.log(
      `  PASS: Zero Hoodie P1 leak, 03/2027 contracts = ${mar27ActiveContracts.length} (CC only), 11/2026 currentCycleDebtRp = Rp 4,522,976, 12/2026 currentCycleDebtRp = Rp 4,260,841, P1 vault = Rp ${p1AccountsTotal}.`,
    );

    // 11. Verify Two-Stage 02/2027 Payday Date (Jan 27, 2027) & Non-Double-Counted Dec 2026 Natal THR Timeline
    console.log('\n[11/11] Verifying Two-Stage 02/2027 payday & 12/2026 non-double-counted Natal THR timeline...');
    const intelFeb27 = await financeSelectors.getIntelligenceBundle(2, 2027, 1, 0);
    assert.equal(
      intelFeb27.paycycle.paydayIso,
      '2027-01-27',
      `02/2027 Two-Stage funding payday must be 2027-01-27 (not 25th), got ${intelFeb27.paycycle.paydayIso}`,
    );
    const timelineDec26 = await financeSelectors.simulateTimelineForUser(
      { month: 12, year: 2026 },
      1,
    );
    assert.equal(
      timelineDec26.baseline.paycheckAmount + timelineDec26.baseline.thrAmount,
      9376925,
      `12/2026 combined Bank Paycheck + Natal THR must equal 9,376,925 without double counting, got ${timelineDec26.baseline.paycheckAmount} + ${timelineDec26.baseline.thrAmount}`,
    );
    const timelineJan27 = await financeSelectors.simulateTimelineForUser(
      { month: 1, year: 2027 },
      1,
    );
    assert.equal(
      timelineJan27.baseline.paycheckAmount + timelineJan27.baseline.thrAmount,
      5941000,
      `01/2027 Salary (THR moved to 12/2026) must equal 5,941,000, got ${timelineJan27.baseline.paycheckAmount} + ${timelineJan27.baseline.thrAmount}`,
    );
    console.log('  PASS: 02/2027 funding payday = 2027-01-27, 12/2026 timeline inflows = Rp 9,376,925, 01/2027 = Rp 5,941,000.');

    console.log('\n=== ALL 11 ZERO-DEFECT VERIFICATION CHECKS PASSED ===');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('\nVERIFICATION FAILED:', err);
  process.exit(1);
});
