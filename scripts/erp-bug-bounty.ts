import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { execFileSync, execSync } from 'node:child_process';
import * as path from 'node:path';

const ROOT_DIR = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT_DIR, 'apps', 'api');
const GO_BIN = path.join(
  ROOT_DIR,
  'apps',
  'go-engine',
  'bin',
  process.platform === 'win32' ? 'go-engine.exe' : 'go-engine',
);

const urlArg = process.argv.find((a) => a.startsWith('--url='))?.slice(6);
const isLiveFlag = process.argv.includes('--live');
const externalBaseUrl =
  urlArg ||
  process.env.BUG_BOUNTY_BASE_URL ||
  (isLiveFlag ? 'https://sundayfunday-api.vercel.app' : '');

if (!externalBaseUrl) {
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL =
    process.env.NEON_DATABASE_URL ||
    'postgresql://neondb_owner:npg_kLTO3alGm2RE@ep-nameless-bird-b30zfam7-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30';
}

interface AuthSession {
  cookieHeader: string;
  bearerToken?: string;
}

function runGoBinary<T>(cmd: string, payload: unknown): T {
  const out = execFileSync(GO_BIN, ['-cmd', cmd], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  return JSON.parse(out) as T;
}

function lcgNext(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

async function login(
  baseUrl: string,
  username: string,
  password: string,
): Promise<AuthSession> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Login failed for ${username} (${res.status}): ${text}`);
  }
  const setCookies =
    typeof (res.headers as any).getSetCookie === 'function'
      ? ((res.headers as any).getSetCookie() as string[])
      : [];
  const cookiePairs = setCookies
    .map((c) => c.split(';')[0]?.trim())
    .filter(Boolean);
  let body: any = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = {};
  }
  return {
    cookieHeader: cookiePairs.join('; '),
    bearerToken: body?.accessToken || undefined,
  };
}

async function apiReq(
  baseUrl: string,
  session: AuthSession,
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<{ status: number; data: any; rawText: string }> {
  const headers: Record<string, string> = {};
  if (session.cookieHeader) headers.Cookie = session.cookieHeader;
  if (session.bearerToken) headers.Authorization = `Bearer ${session.bearerToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const rawText = await res.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText;
  }
  return { status: res.status, data, rawText };
}

async function runLayer1GoAndParity(): Promise<void> {
  console.log('\n[LAYER 1] Go Engine Adversarial Fuzz Suite (620+ vectors) & 60 Go<->TS Parity Vectors...');
  execSync('npm run erp:go:test', { cwd: ROOT_DIR, stdio: 'inherit' });

  const { evaluateConfiguredWaterfallTs, evaluateFormulaSuiteTs } = await import(
    '../apps/api/dist/src/calculator/erp-engines'
  );
  const { simulateCutoffTs } = await import(
    '../apps/api/dist/src/calculator/hybrid-engine'
  );

  let seed = 20261122;

  // 20 randomized paycycle-waterfall parity vectors
  for (let i = 0; i < 20; i++) {
    seed = lcgNext(seed);
    const income = i === 0 ? 0 : 2_000_000 + (seed % 12_000_000);
    seed = lcgNext(seed);
    const debt = seed % 7_500_000;
    seed = lcgNext(seed);
    const routine = seed % 1_500_000;
    seed = lcgNext(seed);
    const daily = 500_000 + (seed % 3_000_000);
    seed = lcgNext(seed);
    const buffer = seed % 600_000;
    seed = lcgNext(seed);
    const p1 = 500_000 + (seed % 1_500_000);
    seed = lcgNext(seed);
    const p2 = seed % 2_000_000;

    const req = {
      finalTotalIncomeRp: income,
      totalDebtObligationsRp: debt,
      routineQuotasTotalRp: routine,
      dailyLivingTargetRp: daily,
      bufferTargetRp: buffer,
      coreSavingsP1TargetRp: p1,
      selfRewardP2TargetRp: p2,
    };

    const goRes = runGoBinary<any>('paycycle-waterfall', req);
    const tsRes = evaluateConfiguredWaterfallTs(req);
    assert.deepEqual(goRes, tsRes, `Waterfall Go<->TS parity mismatch on vector #${i}`);
  }

  // 20 randomized cutoff-simulate parity vectors
  const instruments: Array<'SPAYLATER' | 'CREDIT_CARD' | 'SPINJAM' | 'PERSONAL_DEBT' | 'CASH'> = [
    'SPAYLATER',
    'CREDIT_CARD',
    'SPINJAM',
    'PERSONAL_DEBT',
    'CASH',
  ];
  for (let i = 0; i < 20; i++) {
    seed = lcgNext(seed);
    const inst = instruments[i % instruments.length];
    const day = 1 + (seed % 28);
    seed = lcgNext(seed);
    const month = 1 + (seed % 12);
    const year = 2026 + (i % 2);
    seed = lcgNext(seed);
    const principal = 50_000 + (seed % 3_500_000);
    const tenor = inst === 'CASH' ? 1 : 1 + (seed % 6);
    const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const req = {
      title: `Parity Item ${i}`,
      instrument: inst,
      amountMode: 'PRINCIPAL_SPLIT' as const,
      principalAmount: principal,
      tenorMonths: tenor,
      purchaseDate: dateIso,
      holdPastCutoff: i % 4 === 0,
      periodNetIncome: 6_000_000,
      currentPeriodObligations: 3_000_000,
      nextPeriodNetIncome: 6_000_000,
      nextPeriodObligations: 2_500_000,
      safeHeadroom: 1_500_000,
    };

    const goRes = runGoBinary<any>('cutoff-simulate', req);
    const tsRes = simulateCutoffTs(req);
    assert.deepEqual(goRes, tsRes, `Cutoff Go<->TS parity mismatch on vector #${i}`);
  }

  // 20 randomized formula-eval parity vectors (including divide-by-zero edge case)
  for (let i = 0; i < 20; i++) {
    seed = lcgNext(seed);
    const netIncome = 3_000_000 + (seed % 10_000_000);
    seed = lcgNext(seed);
    const totalDebt = seed % 5_000_000;
    const req = {
      variables: {
        NET_INCOME: netIncome,
        TOTAL_DEBT: totalDebt,
        ZERO_VAL: 0,
      },
      formulas: {
        tenPct: 'ROUND(PCT({NET_INCOME}, 10))',
        headroom: 'MAX(0, MIN(3000000, ({NET_INCOME} - {TOTAL_DEBT})))',
        clamped: 'CLAMP(({NET_INCOME} / 10), 400000, 900000)',
        divZero: '({NET_INCOME} / {ZERO_VAL})',
      },
    };
    const goRes = runGoBinary<any>('formula-eval', req);
    const tsRes = evaluateFormulaSuiteTs(req);
    assert.deepEqual(goRes, tsRes, `Formula Go<->TS parity mismatch on vector #${i}`);
    assert.equal(goRes.results.divZero.valid, false, 'Division by zero must mark valid=false');
  }

  console.log('  PASS: Go unit/fuzz suite & 60 randomized Go<->TS parity vectors passed with 0 Rp drift.');
}

async function assertPeriodConservation(
  baseUrl: string,
  session: AuthSession,
  month: number,
  year: number,
  stepLabel: string,
): Promise<{ snap: any; pacing: any }> {
  const snapRes = await apiReq(baseUrl, session, 'GET', `/api/snapshots?month=${month}&year=${year}`);
  assert.equal(snapRes.status, 200, `[${stepLabel}] GET snapshot failed (${snapRes.status}): ${snapRes.rawText}`);
  const pacingRes = await apiReq(baseUrl, session, 'GET', `/api/finance/pacing?month=${month}&year=${year}`);
  assert.equal(pacingRes.status, 200, `[${stepLabel}] GET pacing failed (${pacingRes.status}): ${pacingRes.rawText}`);

  const s = snapRes.data;
  const p = pacingRes.data;

  const finalTotalIncome = Math.round(s.finalTotalIncome);
  const totalDeductions = Math.round(s.totalDeductions);
  const actualDailyOperational = Math.round(s.actualDailyOperational);
  const actualSavings = Math.round(s.actualSavings);
  const selfReward = Math.round(s.selfReward);
  const deficitUncovered = Math.round(s.deficitUncovered);

  const buckets: any[] = Array.isArray(s.bucketRealizationsJson) ? s.bucketRealizationsJson : [];
  let fixedEssentials = 0;
  let dailyOperationalTarget = Math.round(s.dailyOperational ?? 0);
  let bufferPocketTarget = Math.round(s.bufferPocket ?? 0);
  let fundedBuffer = Math.round(s.bufferPocket ?? 0);

  if (buckets.length > 0) {
    fixedEssentials = buckets
      .filter((b) => b.group === 'FIXED_ESSENTIAL')
      .reduce((sum, b) => sum + Math.round(Number(b.revisedTarget) || 0), 0);
    const dailyBucket = buckets.find((b) => b.group === 'DAILY_OPERATIONAL');
    if (dailyBucket) {
      dailyOperationalTarget = Math.round(Number(dailyBucket.revisedTarget) || 0);
    }
    const bufBucket = buckets.find((b) => b.group === 'BUFFER');
    if (bufBucket) {
      bufferPocketTarget = Math.round(Number(bufBucket.revisedTarget) || 0);
      fundedBuffer = Math.round(Number(bufBucket.fundedAmount) || 0);
    }
  } else {
    const oneOffBills = Array.isArray(s.oneOffBillsJson) ? s.oneOffBillsJson : [];
    const oneOffSum = oneOffBills.reduce(
      (sum: number, b: any) => sum + Math.max(0, Math.round(Number(b?.amount) || 0)),
      0,
    );
    fixedEssentials =
      Math.round(s.transport ?? 0) +
      Math.round(s.internet ?? 0) +
      Math.round(s.vape ?? 0) +
      Math.round(s.haircut ?? 0) +
      oneOffSum;
  }

  // Eq 1: Cash Conservation (when Income >= Debt + Routine)
  if (!s.isManualOverride && finalTotalIncome >= totalDeductions + fixedEssentials) {
    const allocatedCash =
      totalDeductions +
      fixedEssentials +
      fundedBuffer +
      actualDailyOperational +
      actualSavings +
      selfReward;
    assert.equal(
      allocatedCash,
      finalTotalIncome,
      `[${stepLabel}] Eq 1 Cash Conservation drift: allocated=${allocatedCash} != income=${finalTotalIncome}`,
    );
  }

  // Eq 2: Shortfall Identity when deficitUncovered > 0
  if (deficitUncovered > 0 && !s.isManualOverride) {
    const plannedNeed =
      totalDeductions +
      fixedEssentials +
      bufferPocketTarget +
      dailyOperationalTarget +
      actualSavings +
      selfReward;
    assert.equal(
      finalTotalIncome + deficitUncovered,
      plannedNeed,
      `[${stepLabel}] Eq 2 Shortfall Identity drift: income+deficit=${finalTotalIncome + deficitUncovered} != need=${plannedNeed}`,
    );
  }

  // Eq 3: Proportional Living Cash Law
  if (!s.isManualOverride && dailyOperationalTarget > 0) {
    const availableForLiving = Math.max(0, finalTotalIncome - totalDeductions - fixedEssentials);
    const expectedFundedLiving = Math.min(dailyOperationalTarget, availableForLiving);
    assert.equal(
      actualDailyOperational,
      expectedFundedLiving,
      `[${stepLabel}] Eq 3 Proportional Living mismatch: actualDaily=${actualDailyOperational} != expected=${expectedFundedLiving}`,
    );
    assert.equal(
      Math.round(p.totalOperationalBudget),
      actualDailyOperational,
      `[${stepLabel}] Eq 3 Pacing budget mismatch: pacing=${p.totalOperationalBudget} != snapshot=${actualDailyOperational}`,
    );
  }

  // Eq 4: Pacing Integrity
  assert.ok(p.safeToSpendToday >= 0, `[${stepLabel}] Eq 4 safeToSpendToday < 0: ${p.safeToSpendToday}`);
  if (actualDailyOperational > 0 && p.remainingBudget > 0 && p.daysRemainingInCycle > 0) {
    assert.ok(
      p.safeToSpendToday > 0,
      `[${stepLabel}] Eq 4 safeToSpendToday must be > 0 when funded living & remaining days > 0`,
    );
  }

  return { snap: s, pacing: p };
}

async function runLayer2DemoSandboxFuzz(baseUrl: string): Promise<void> {
  console.log('\n[LAYER 2] Demo Sandbox (userId=2) Exhaustive Mutation Fuzzing & Cross-Tenant Isolation...');

  const guestSession = await login(baseUrl, 'guest', 'Sandbox2026!');
  const reset1 = await apiReq(baseUrl, guestSession, 'POST', '/api/config/reset-sandbox', {});
  assert.equal(reset1.status, 201, `reset-sandbox failed (${reset1.status}): ${reset1.rawText}`);

  const { snap: novInit } = await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'Init 11/2026');

  // 1. Record Expense: Cash, Routine, Refund, PayLater, CC
  const cashTx = await apiReq(baseUrl, guestSession, 'POST', '/api/finance/transactions', {
    month: 11,
    year: 2026,
    type: 'DEDUCTION',
    label: 'Bounty Coffee Cash',
    amount: 45000,
    date: '2026-11-28T12:00:00.000Z',
    paymentMethod: 'CASH',
  });
  assert.ok(cashTx.status === 200 || cashTx.status === 201, `Cash tx failed: ${cashTx.rawText}`);
  await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'After Record Cash');

  const routineTx = await apiReq(baseUrl, guestSession, 'POST', '/api/finance/transactions', {
    month: 11,
    year: 2026,
    type: 'DEDUCTION',
    label: 'Bounty Ride',
    amount: 75000,
    date: '2026-11-28T12:00:00.000Z',
    fixedEssentialCategory: 'TRANSPORT',
    paymentMethod: 'CASH',
  });
  assert.ok(routineTx.status === 200 || routineTx.status === 201, `Routine tx failed: ${routineTx.rawText}`);
  await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'After Record Routine');

  const refundTx = await apiReq(baseUrl, guestSession, 'POST', '/api/finance/transactions', {
    month: 11,
    year: 2026,
    type: 'INCOME',
    label: 'Bounty Split Refund',
    amount: 20000,
    date: '2026-11-28T12:00:00.000Z',
    isOperationalRefund: true,
  });
  assert.ok(refundTx.status === 200 || refundTx.status === 201, `Refund tx failed: ${refundTx.rawText}`);
  await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'After Record Refund');

  const plTx = await apiReq(baseUrl, guestSession, 'POST', '/api/finance/transactions', {
    month: 11,
    year: 2026,
    type: 'DEDUCTION',
    label: 'Bounty PayLater Expense',
    amount: 120000,
    date: '2026-11-28T12:00:00.000Z',
    paymentMethod: 'PAYLATER',
    paylaterTenor: 1,
    holdPastCutoff: false,
  });
  assert.ok(plTx.status === 200 || plTx.status === 201, `PayLater tx failed: ${plTx.rawText}`);
  await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'After Record PayLater');

  const ccTx = await apiReq(baseUrl, guestSession, 'POST', '/api/finance/transactions', {
    month: 11,
    year: 2026,
    type: 'DEDUCTION',
    label: 'Bounty CC Expense',
    amount: 90000,
    date: '2026-11-28T12:00:00.000Z',
    paymentMethod: 'CC',
    holdPastCutoff: false,
  });
  assert.ok(ccTx.status === 200 || ccTx.status === 201, `CC tx failed: ${ccTx.rawText}`);
  await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'After Record CC');

  // 2. MatrixCellDrawer: Create, Settle, Shift, Delete line item
  const createdItem = await apiReq(baseUrl, guestSession, 'POST', '/api/credit/line-items', {
    title: 'Bounty Matrix Split',
    category: 'PAYLATER',
    merchantOrPlatform: 'SPayLater',
    totalAmount: 300000,
    amountMode: 'PRINCIPAL_SPLIT',
    tenorMonths: 2,
    startMonth: 11,
    startYear: 2026,
  });
  assert.ok(createdItem.status === 200 || createdItem.status === 201, `Create line item failed: ${createdItem.rawText}`);
  const itemList = createdItem.data?.items ?? (Array.isArray(createdItem.data) ? createdItem.data : [createdItem.data]);
  const firstItemId = itemList?.[0]?.id;
  assert.ok(firstItemId, `Expected created line item id, got ${createdItem.rawText}`);
  await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'After LineItem Create');

  const settleRes = await apiReq(
    baseUrl,
    guestSession,
    'PATCH',
    `/api/credit/line-items/${firstItemId}/settlement-state`,
    { settlementState: 'RESERVED' },
  );
  assert.equal(settleRes.status, 200, `Settlement toggle failed: ${settleRes.rawText}`);
  await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'After LineItem Settle');

  const shiftRes = await apiReq(
    baseUrl,
    guestSession,
    'POST',
    `/api/credit/line-items/${firstItemId}/shift`,
    { direction: 'LATER', shiftAllRemainingInContract: false },
  );
  assert.ok(shiftRes.status === 200 || shiftRes.status === 201, `Shift line item failed: ${shiftRes.rawText}`);
  await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'After LineItem Shift');
  await assertPeriodConservation(baseUrl, guestSession, 12, 2026, 'After LineItem Shift 12/2026');

  for (const li of itemList) {
    if (li?.id) {
      const delItem = await apiReq(baseUrl, guestSession, 'DELETE', `/api/credit/line-items/${li.id}`);
      assert.ok(delItem.status === 200 || delItem.status === 204, `Delete line item #${li.id} failed: ${delItem.rawText}`);
    }
  }
  await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'After LineItem Delete');

  // 3. Ctrl+K Quick CC charge + delete
  const quickCc = await apiReq(baseUrl, guestSession, 'POST', '/api/credit/cards', {
    label: 'Bounty Quick CC',
    amount: 450000,
    chargeType: 'INSTALLMENT',
    category: 'Quick Entry',
    tenor: 3,
    monthlyAmount: 150000,
    transactionDate: '2026-11-10T12:00:00.000Z',
  });
  assert.ok(quickCc.status === 200 || quickCc.status === 201, `Quick CC create failed: ${quickCc.rawText}`);
  const ccId = quickCc.data?.id ?? quickCc.data?.transaction?.id;
  assert.ok(ccId, `Expected CC id, got ${quickCc.rawText}`);
  await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'After Quick CC Create');

  const delCc = await apiReq(baseUrl, guestSession, 'DELETE', `/api/credit/cards/${ccId}`);
  assert.ok(delCc.status === 200 || delCc.status === 204, `Delete CC failed: ${delCc.rawText}`);
  await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'After Quick CC Delete');

  // 4. BudgetRevision on Daily Operational
  const revRes = await apiReq(baseUrl, guestSession, 'POST', `/api/snapshots/${novInit.id}/budget-revision`, {
    category: 'DAILY_OPERATIONAL',
    newValue: 2600000,
    reason: 'Bug bounty test budget revision',
  });
  assert.ok(revRes.status === 200 || revRes.status === 201, `BudgetRevision failed: ${revRes.rawText}`);
  await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'After BudgetRevision');

  // 5. Wallet Reconciliation Preview & Execute + Wallet Guard
  const prevRec = await apiReq(baseUrl, guestSession, 'POST', '/api/finance/reconcile/preview', {
    month: 11,
    year: 2026,
    actualRealBalance: 2400000,
  });
  assert.ok(prevRec.status === 200 || prevRec.status === 201, `Reconcile preview failed: ${prevRec.rawText}`);

  const execRec = await apiReq(baseUrl, guestSession, 'POST', '/api/finance/reconcile', {
    month: 11,
    year: 2026,
    actualRealBalance: 2400000,
    note: 'Bug bounty reconcile checkpoint',
  });
  assert.ok(execRec.status === 200 || execRec.status === 201, `Reconcile execute failed: ${execRec.rawText}`);
  await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'After Reconcile');

  const wgRes = await apiReq(baseUrl, guestSession, 'POST', '/api/finance/wallet-guard', {
    month: 11,
    year: 2026,
    actualWalletBalance: 2400000,
    persist: true,
    note: 'Bug bounty wallet guard check-in',
  });
  assert.ok(wgRes.status === 200 || wgRes.status === 201, `Wallet guard failed: ${wgRes.rawText}`);
  await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'After Wallet Guard');

  // 6. Explicit Recalculate
  const recalcRes = await apiReq(baseUrl, guestSession, 'POST', `/api/snapshots/${novInit.id}/recalculate`, {});
  assert.ok(recalcRes.status === 200 || recalcRes.status === 201, `Recalculate failed: ${recalcRes.rawText}`);
  await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'After Recalculate');

  // 7. Studio Config toggle & verify
  const studioPatch = await apiReq(baseUrl, guestSession, 'PATCH', '/api/config/studio', {
    enableExternalAssetPortfolio: true,
  });
  assert.equal(studioPatch.status, 200, `Studio patch failed: ${studioPatch.rawText}`);
  const cfgCheck = await apiReq(baseUrl, guestSession, 'GET', '/api/config');
  assert.equal(cfgCheck.status, 200);
  assert.equal(cfgCheck.data?.studioConfig?.enableExternalAssetPortfolio, true);

  // 8. Lock/Unlock earliest balanced DRAFT period (10/2026) and assert write-rejection (HTTP 400)
  const octSnapRes = await apiReq(baseUrl, guestSession, 'GET', '/api/snapshots?month=10&year=2026');
  assert.equal(octSnapRes.status, 200);
  const octSnap = octSnapRes.data;
  if (octSnap.status === 'DRAFT' && Math.round(octSnap.deficitUncovered) === 0) {
    const closeRes = await apiReq(baseUrl, guestSession, 'POST', `/api/snapshots/${octSnap.id}/close`, {});
    assert.ok(closeRes.status === 200 || closeRes.status === 201, `Close 10/2026 failed: ${closeRes.rawText}`);

    const lockedWrite = await apiReq(baseUrl, guestSession, 'POST', '/api/finance/transactions', {
      month: 10,
      year: 2026,
      type: 'DEDUCTION',
      label: 'Must Reject On Locked',
      amount: 10000,
      date: '2026-10-28T12:00:00.000Z',
      paymentMethod: 'CASH',
    });
    assert.equal(lockedWrite.status, 400, `Expected 400 writing to LOCKED period, got ${lockedWrite.status}`);

    const reopenRes = await apiReq(baseUrl, guestSession, 'POST', `/api/snapshots/${octSnap.id}/reopen`, {});
    assert.ok(reopenRes.status === 200 || reopenRes.status === 201, `Reopen 10/2026 failed: ${reopenRes.rawText}`);
  }

  // 9. Partial Living Cash Deficit Fuzz on 11/2026
  const { snap: beforePartial } = await assertPeriodConservation(baseUrl, guestSession, 11, 2026, 'Before Partial Fuzz');
  const buckets: any[] = Array.isArray(beforePartial.bucketRealizationsJson)
    ? beforePartial.bucketRealizationsJson
    : [];
  const fixedSum = buckets
    .filter((b) => b.group === 'FIXED_ESSENTIAL')
    .reduce((s, b) => s + Math.round(Number(b.revisedTarget) || 0), 0);
  const dailyTarget = Math.round(
    buckets.find((b) => b.group === 'DAILY_OPERATIONAL')?.revisedTarget ?? beforePartial.dailyOperational,
  );
  // Leave exactly half of dailyTarget available for living cash
  const desiredLiving = Math.floor(dailyTarget / 2);
  const targetDebt = Math.round(beforePartial.finalTotalIncome) - fixedSum - desiredLiving;
  const extraPaylaterNeeded = targetDebt - Math.round(beforePartial.totalDeductions);
  assert.ok(extraPaylaterNeeded > 0, `Expected positive extraPaylaterNeeded, got ${extraPaylaterNeeded}`);

  const partialTrigger = await apiReq(baseUrl, guestSession, 'POST', '/api/credit/line-items', {
    title: 'Bounty Partial Living Stress',
    category: 'PAYLATER',
    merchantOrPlatform: 'SPayLater',
    monthlyAmount: extraPaylaterNeeded,
    amountMode: 'FIXED_MONTHLY',
    tenorMonths: 1,
    startMonth: 11,
    startYear: 2026,
  });
  assert.ok(
    partialTrigger.status === 200 || partialTrigger.status === 201,
    `Partial trigger line item failed: ${partialTrigger.rawText}`,
  );
  const { snap: partialSnap, pacing: partialPacing } = await assertPeriodConservation(
    baseUrl,
    guestSession,
    11,
    2026,
    'Partial Living Cash Fuzz',
  );
  assert.ok(
    partialSnap.actualDailyOperational > 0 && partialSnap.actualDailyOperational < dailyTarget,
    `Expected 0 < actualDailyOperational (${partialSnap.actualDailyOperational}) < ${dailyTarget}`,
  );
  assert.equal(Math.round(partialSnap.actualSavings), 0, 'Partial living shortfall must leave P1=0');
  assert.equal(Math.round(partialSnap.selfReward), 0, 'Partial living shortfall must leave P2=0');
  assert.ok(partialPacing.safeToSpendToday > 0, `Partial living SafeToSpend must be > 0, got ${partialPacing.safeToSpendToday}`);
  console.log(
    `  PASS Partial Living Fuzz: Funded=${partialSnap.actualDailyOperational}/${dailyTarget}, Shortfall=${partialSnap.deficitUncovered}, SafeToSpend=${partialPacing.safeToSpendToday}`,
  );

  // 10. Cross-Tenant IDOR Isolation (userId=2 attempting User #1 reads/mutations -> 403/404)
  const u1Session = await login(baseUrl, 'cheeseburger', 'Djakarta2026Nov!@#');
  const u1Nov = await apiReq(baseUrl, u1Session, 'GET', '/api/snapshots?month=11&year=2026');
  assert.equal(u1Nov.status, 200);
  const u1SnapId = u1Nov.data.id;

  const idorCalls = await Promise.all([
    apiReq(baseUrl, guestSession, 'POST', `/api/snapshots/${u1SnapId}/recalculate`, {}),
    apiReq(baseUrl, guestSession, 'PATCH', `/api/snapshots/${u1SnapId}`, { salaryAdjustment: 999999 }),
    apiReq(baseUrl, guestSession, 'POST', `/api/snapshots/${u1SnapId}/budget-revision`, {
      category: 'DAILY_OPERATIONAL',
      newValue: 999,
      reason: 'IDOR probe',
    }),
    apiReq(baseUrl, guestSession, 'DELETE', '/api/credit/line-items/48'),
  ]);
  for (const r of idorCalls) {
    assert.ok(
      r.status === 403 || r.status === 404,
      `IDOR breach! Sandbox user received HTTP ${r.status}: ${r.rawText}`,
    );
  }
  const u1NovAfter = await apiReq(baseUrl, u1Session, 'GET', '/api/snapshots?month=11&year=2026');
  assert.equal(Math.round(u1NovAfter.data.totalDeductions), 4187341, 'User #1 data altered after IDOR test!');

  // 11. Regression test for POST /api/auth/reset-demo (must wipe LiabilityLineItems & restore full Rp 1,805,000+ baseline)
  const wipeProbe = await apiReq(baseUrl, guestSession, 'POST', '/api/credit/line-items', {
    title: 'Reset Demo Wipe Check',
    category: 'PAYLATER',
    merchantOrPlatform: 'SPayLater',
    monthlyAmount: 50000,
    amountMode: 'FIXED_MONTHLY',
    tenorMonths: 1,
    startMonth: 11,
    startYear: 2026,
  });
  assert.ok(wipeProbe.status === 200 || wipeProbe.status === 201, `Wipe probe create failed: ${wipeProbe.rawText}`);

  const authReset = await apiReq(baseUrl, guestSession, 'POST', '/api/auth/reset-demo', {});
  assert.equal(authReset.status, 200, `POST /api/auth/reset-demo failed (${authReset.status}): ${authReset.rawText}`);

  const itemsAfterAuthReset = await apiReq(
    baseUrl,
    guestSession,
    'GET',
    '/api/credit/line-items?month=11&year=2026',
  );
  assert.equal(itemsAfterAuthReset.status, 200);
  const leakedProbe = (Array.isArray(itemsAfterAuthReset.data) ? itemsAfterAuthReset.data : []).some(
    (li: any) => /Reset Demo Wipe Check/i.test(li?.title || ''),
  );
  assert.equal(leakedProbe, false, 'POST /api/auth/reset-demo failed to wipe created LiabilityLineItem!');

  const { snap: postResetNov } = await assertPeriodConservation(
    baseUrl,
    guestSession,
    11,
    2026,
    'After Auth Reset Demo 11/2026',
  );
  assert.ok(
    Math.round(postResetNov.totalDeductions) >= 1_800_000,
    `Expected full restored baseline debt >= 1,800,000 after reset-demo, got ${postResetNov.totalDeductions}`,
  );
  console.log('  PASS: All Demo Sandbox mutations, Eq 1-4 conservation, Partial Living fuzz, IDOR isolation, & reset-demo cleanup verified.');
}

async function runLayer3User1ReadOnlyParity(baseUrl: string): Promise<void> {
  console.log('\n[LAYER 3] User #1 Strictly Read-Only Cross-Route & Sub-Module Parity (10/2026..02/2027)...');
  const u1Session = await login(baseUrl, 'cheeseburger', 'Djakarta2026Nov!@#');

  const [matrixRes, savingsRes, analyticsRes, auditRes, billsRes, cfgRes, execRes, payHorizonRes] =
    await Promise.all([
      apiReq(baseUrl, u1Session, 'GET', '/api/credit/matrix?startMonth=10&startYear=2026&count=12'),
      apiReq(baseUrl, u1Session, 'GET', '/api/savings'),
      apiReq(baseUrl, u1Session, 'GET', '/api/analytics'),
      apiReq(baseUrl, u1Session, 'GET', '/api/audit/report'),
      apiReq(baseUrl, u1Session, 'GET', '/api/bills'),
      apiReq(baseUrl, u1Session, 'GET', '/api/config'),
      apiReq(baseUrl, u1Session, 'GET', '/api/reports/executive-horizon'),
      apiReq(baseUrl, u1Session, 'GET', '/api/finance/payroll-horizon?startMonth=10&startYear=2026&count=5'),
    ]);

  for (const [label, res] of [
    ['credit/matrix', matrixRes],
    ['savings', savingsRes],
    ['analytics', analyticsRes],
    ['audit/report', auditRes],
    ['bills', billsRes],
    ['config', cfgRes],
    ['reports/executive-horizon', execRes],
    ['finance/payroll-horizon', payHorizonRes],
  ] as const) {
    assert.equal(res.status, 200, `User #1 GET ${label} returned ${res.status}: ${res.rawText}`);
  }

  assert.equal(
    matrixRes.data.contractRows.some((c: any) => /hoodie|p1 vault/i.test(c.label || '')),
    false,
    'Hoodie P1 Vault leaked into /credit contractRows',
  );

  const periods: Array<[number, number]> = [
    [10, 2026],
    [11, 2026],
    [12, 2026],
    [1, 2027],
    [2, 2027],
  ];

  for (const [m, y] of periods) {
    const [snapRes, pacRes, txRes, payRes, limRes, savOvRes, wishRes, intelRes, repRes] =
      await Promise.all([
        apiReq(baseUrl, u1Session, 'GET', `/api/snapshots?month=${m}&year=${y}`),
        apiReq(baseUrl, u1Session, 'GET', `/api/finance/pacing?month=${m}&year=${y}`),
        apiReq(baseUrl, u1Session, 'GET', `/api/finance/transactions?month=${m}&year=${y}`),
        apiReq(baseUrl, u1Session, 'GET', `/api/finance/payroll?month=${m}&year=${y}`),
        apiReq(baseUrl, u1Session, 'GET', `/api/credit/usage-limit?month=${m}&year=${y}`),
        apiReq(baseUrl, u1Session, 'GET', `/api/savings/overview?month=${m}&year=${y}`),
        apiReq(baseUrl, u1Session, 'GET', `/api/wishlist?month=${m}&year=${y}`),
        apiReq(baseUrl, u1Session, 'GET', `/api/finance/intelligence?month=${m}&year=${y}`),
        apiReq(baseUrl, u1Session, 'GET', `/api/reports?month=${m}&year=${y}`),
      ]);

    for (const [name, r] of [
      ['snapshots', snapRes],
      ['pacing', pacRes],
      ['transactions', txRes],
      ['payroll', payRes],
      ['usage-limit', limRes],
      ['savings/overview', savOvRes],
      ['wishlist', wishRes],
      ['intelligence', intelRes],
      ['reports', repRes],
    ] as const) {
      assert.equal(r.status, 200, `User #1 ${m}/${y} GET ${name} returned ${r.status}: ${r.rawText}`);
    }

    const s = snapRes.data;
    const p = pacRes.data;
    const intel = intelRes.data;
    const pay = payRes.data;

    const periodKey = `${y}-${m}`;
    const p1VaultRefundInPeriod = (
      matrixRes.data.personalDebtRow?.cells?.[periodKey]?.items ?? []
    )
      .filter((li: any) => li.category === 'P1_VAULT_REFUND')
      .reduce((sum: number, li: any) => sum + Math.round(li.monthlyAmount ?? 0), 0);

    assert.equal(
      Math.round(matrixRes.data.totalsPerMonth?.[periodKey] ?? 0),
      Math.round(s.totalDeductions),
      `${m}/${y} matrix totalsPerMonth != snapshot.totalDeductions`,
    );
    assert.equal(
      Math.round(intel.networth.currentCycleDebtRp + p1VaultRefundInPeriod),
      Math.round(s.totalDeductions),
      `${m}/${y} intelligence currentCycleDebtRp (${intel.networth.currentCycleDebtRp}) + P1 refund (${p1VaultRefundInPeriod}) != snapshot.totalDeductions (${s.totalDeductions})`,
    );
    assert.equal(
      Math.round(p.totalOperationalBudget),
      Math.round(s.actualDailyOperational),
      `${m}/${y} pacing budget (${p.totalOperationalBudget}) != snapshot.actualDailyOperational (${s.actualDailyOperational})`,
    );
    assert.equal(
      Math.round(pay.finalTotalIncome + (s.bridgeInflowAmount ?? 0)),
      Math.round(s.finalTotalIncome),
      `${m}/${y} payroll income mismatch vs snapshot`,
    );
    assert.equal(intel.networth.monthlyRdpuYieldRp, 0, `${m}/${y} User #1 must have 0 Rp RDPU yield`);

    if (m === 11 && y === 2026) {
      assert.equal(Math.round(s.totalDeductions), 4187341);
      assert.equal(Math.round(s.actualDailyOperational), 1416659);
      assert.equal(Math.round(s.deficitUncovered), 83341);
      assert.equal(Math.round(s.actualSavings), 0);
      assert.ok(p.safeToSpendToday > 0, `User #1 11/2026 safeToSpendToday must be > 0, got ${p.safeToSpendToday}`);
      assert.ok(
        ['PRE_PAYDAY', 'ACTIVE', 'COMPLETED'].includes(p.cycleTemporalState),
        `User #1 11/2026 must report valid cycleTemporalState, got ${p.cycleTemporalState}`,
      );
    }
  }

  // Verify Smart Default Active Period & Role Isolation + Marquee Security
  const defPeriodRes = await apiReq(baseUrl, u1Session, 'GET', '/api/snapshots/default-period');
  assert.equal(defPeriodRes.status, 200, 'GET /api/snapshots/default-period must return 200');
  assert.equal(defPeriodRes.data.month, 11, 'Default open period on User #1 must skip LOCKED 10/2026 to 11/2026');
  assert.equal(defPeriodRes.data.year, 2026);

  // User #1 (consumer role USER) must be strictly forbidden from /api/admin/users
  const u1AdminRes = await apiReq(baseUrl, u1Session, 'GET', '/api/admin/users');
  assert.equal(u1AdminRes.status, 403, `User #1 (role=USER) must get 403 on /api/admin/users, got ${u1AdminRes.status}`);

  // Dedicated superadmin account must have full access to /api/admin/users
  const superSession = await login(
    baseUrl,
    'superadmin',
    process.env.SYS_ADMIN_PASSWORD || 'SuperAdmin#2026!',
  );
  const superAdminRes = await apiReq(baseUrl, superSession, 'GET', '/api/admin/users');
  assert.equal(superAdminRes.status, 200, `Dedicated superadmin must get 200 on /api/admin/users, got ${superAdminRes.status}`);

  // Verify Marquee Tier 1 deterministic pulse on User #1 (read-only), Hydrated Context, DeepSeek/OpenCode config & Webhook 401 gate
  const mrqPulseRes = await apiReq(baseUrl, u1Session, 'POST', '/api/marquee/chat', {
    message: 'Safe to spend today?',
    month: 11,
    year: 2026,
    activeRoute: '/credit',
    activeSubTab: 'contracts',
  });
  assert.equal(mrqPulseRes.status, 201, `POST /api/marquee/chat failed: ${mrqPulseRes.rawText}`);
  assert.ok(
    ['get_financial_pulse', 'get_paycycle_pulse'].includes(mrqPulseRes.data.tool),
    `Unexpected pulse tool: ${mrqPulseRes.data.tool}`,
  );
  assert.equal(mrqPulseRes.data.hydratedContext?.periodTag, '11/2026');
  assert.equal(mrqPulseRes.data.hydratedContext?.activeRoute, '/credit');
  assert.equal(mrqPulseRes.data.hydratedContext?.activeSubTab, 'contracts');

  const mrqVarianceRes = await apiReq(baseUrl, u1Session, 'POST', '/api/marquee/chat', {
    message: 'Compare 11/2026 vs 12/2026 variance',
    month: 11,
    year: 2026,
  });
  assert.equal(mrqVarianceRes.status, 201);
  assert.equal(mrqVarianceRes.data.tool, 'explain_period_variance');

  const mrqConfigRes = await apiReq(baseUrl, u1Session, 'GET', '/api/marquee/config');
  assert.equal(mrqConfigRes.status, 200);
  assert.ok('hasDeepseekKey' in mrqConfigRes.data && 'hasOpencodeKey' in mrqConfigRes.data);

  const badWebhookRes = await fetch(`${baseUrl}/api/marquee/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Marquee-Token': 'mrq_invalid_spoofed_token',
      'x-user-id': '1',
    },
    body: JSON.stringify({ message: 'log coffee 45k', autoConfirm: true }),
  });
  assert.equal(badWebhookRes.status, 401, 'Invalid X-Marquee-Token must be rejected with 401');

  console.log('  PASS: All 13 routes, Smart Default Period, USER/SUPERADMIN isolation, and Marquee 3-Tier guards verified.');
}

async function main() {
  console.log('=== SUNDAY FUNDAY ERP — 5-LAYER BUG BOUNTY HARNESS ===');

  await runLayer1GoAndParity();

  let app: any = null;
  let baseUrl = '';
  if (externalBaseUrl) {
    baseUrl = externalBaseUrl.replace(/\/$/, '');
    console.log(`\nTarget API: LIVE (${baseUrl})`);
  } else {
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../apps/api/dist/src/app.module');
    const { applySecurityMiddleware } = await import('../apps/api/dist/src/main');
    app = await NestFactory.create(AppModule, { logger: ['error'] });
    applySecurityMiddleware(app);
    await app.listen(0, '127.0.0.1');
    const addr = app.getHttpServer().address();
    const port = typeof addr === 'object' && addr ? addr.port : 3098;
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`\nTarget API: LOCAL IN-PROCESS (${baseUrl})`);
  }

  try {
    await runLayer2DemoSandboxFuzz(baseUrl);
    await runLayer3User1ReadOnlyParity(baseUrl);
    console.log('\n=== LAYERS 1, 2, AND 3 PASSED WITH ZERO DEFECTS ===');
  } finally {
    if (app) {
      await app.close();
    }
  }
}

main().catch((err) => {
  console.error('\nBUG BOUNTY SUITE FAILED:', err);
  process.exit(1);
});
