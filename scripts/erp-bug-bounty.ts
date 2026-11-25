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

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const rawText = await res.text();
    if (res.status === 503 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 600 * attempt));
      continue;
    }
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = rawText;
    }
    return { status: res.status, data, rawText };
  }
  throw new Error(`Unreachable retry exit for ${endpoint}`);
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
  assert.equal(Math.round(u1NovAfter.data.totalDeductions), 4522976, 'User #1 data altered after IDOR test!');

  // 10b. Phase 3 (V3.0): One-Off Commitments, Trip & Event Planner + Go 3-Tier Optimizer, and Active Sinking Funds + Cross-Tenant IDOR
  const preCommitSnap = await apiReq(baseUrl, guestSession, 'GET', '/api/snapshots?month=11&year=2026');
  assert.equal(preCommitSnap.status, 200);
  const baseDeductionsNov = Math.round(preCommitSnap.data.totalDeductions);

  const createCommitRes = await apiReq(baseUrl, guestSession, 'POST', '/api/commitments', {
    month: 11,
    year: 2026,
    title: 'QA Bus Outing Penalty',
    category: 'EVENT_OUTING',
    amount: 100000,
    dueDate: '2026-11-28',
    fundingSource: 'PAYCHECK_UPFRONT',
  });
  assert.ok(
    createCommitRes.status === 200 || createCommitRes.status === 201,
    `Failed creating commitment: ${createCommitRes.rawText}`,
  );
  const commitId = createCommitRes.data.id;
  assert.ok(Number.isInteger(commitId), 'Commitment id must be returned');

  // Verify 0% DSR impact on totalDeductions while listed in commitments and Cash Radar
  const postCommitSnap = await apiReq(baseUrl, guestSession, 'GET', '/api/snapshots?month=11&year=2026');
  assert.equal(
    Math.round(postCommitSnap.data.totalDeductions),
    baseDeductionsNov,
    'PAYCHECK_UPFRONT PeriodCommitment must never inflate Debt/DSR totalDeductions!',
  );
  const commitListRes = await apiReq(baseUrl, guestSession, 'GET', '/api/commitments?month=11&year=2026');
  assert.equal(commitListRes.status, 200);
  assert.ok(
    (commitListRes.data?.items ?? []).some((c: any) => c.id === commitId),
    'Created commitment must appear in GET /api/commitments',
  );
  const radarCommitRes = await apiReq(baseUrl, guestSession, 'GET', '/api/finance/cash-radar?month=11&year=2026');
  assert.equal(radarCommitRes.status, 200);
  assert.ok(
    (radarCommitRes.data?.events ?? []).some((ev: any) => ev.category === 'COMMITMENT' && String(ev.id).includes(String(commitId))),
    'Cash Radar must emit COMMITMENT event for PeriodCommitment',
  );
  const markCommitPaidRes = await apiReq(baseUrl, guestSession, 'PATCH', `/api/commitments/${commitId}/status`, {
    status: 'PAID',
  });
  assert.equal(markCommitPaidRes.status, 200);
  assert.equal(markCommitPaidRes.data.status, 'PAID');

  const idorCommitDel = await apiReq(baseUrl, u1Session, 'DELETE', `/api/commitments/${commitId}`);
  assert.ok(
    idorCommitDel.status === 403 || idorCommitDel.status === 404,
    `Cross-tenant IDOR on commitment expected 403/404, got ${idorCommitDel.status}`,
  );
  const delCommitRes = await apiReq(baseUrl, guestSession, 'DELETE', `/api/commitments/${commitId}`);
  assert.equal(delCommitRes.status, 200);

  // Trip & Event Planner + Go 3-tier optimizer + Shared Advance + Close & Sweep
  const optRes = await apiReq(baseUrl, guestSession, 'POST', '/api/events/optimize', {
    month: 11,
    year: 2026,
    eventType: 'DAY_OUTING',
    durationDays: 2,
    startDateIso: '2026-12-05',
    prepaidCommittedRp: 100000,
  });
  assert.ok(optRes.status === 200 || optRes.status === 201, `Event optimize failed: ${optRes.rawText}`);
  assert.ok(
    optRes.data.conservative.totalCapRp <= optRes.data.balanced.totalCapRp &&
      optRes.data.balanced.totalCapRp <= optRes.data.maxSafe.totalCapRp,
    'Trip optimizer caps must preserve Conservative <= Balanced <= Max Safe monotonicity',
  );

  const evCreateRes = await apiReq(baseUrl, guestSession, 'POST', '/api/events', {
    month: 11,
    year: 2026,
    title: 'QA Dec Outing',
    eventType: 'DAY_OUTING',
    startDate: '2026-12-05',
    endDate: '2026-12-06',
    plannedCapRp: 600000,
    recommendedTier: 'BALANCED',
  });
  assert.ok(evCreateRes.status === 200 || evCreateRes.status === 201, `Create event failed: ${evCreateRes.rawText}`);
  const evId = evCreateRes.data.id;

  const expCreateRes = await apiReq(baseUrl, guestSession, 'POST', `/api/events/${evId}/expenses`, {
    date: '2026-12-05',
    label: 'Group Dinner Advance',
    category: 'FOOD_DRINK',
    amountRp: 300000,
    isSharedAdvance: true,
    counterpartyName: 'Budi',
  });
  assert.ok(expCreateRes.status === 200 || expCreateRes.status === 201, `Create event expense failed: ${expCreateRes.rawText}`);
  const expId = expCreateRes.data.id;

  const expPatchRes = await apiReq(baseUrl, guestSession, 'PATCH', `/api/events/${evId}/expenses/${expId}`, {
    reimbursedAmountRp: 200000,
    isSettled: false,
  });
  assert.equal(expPatchRes.status, 200);

  const evListRes = await apiReq(baseUrl, guestSession, 'GET', '/api/events?month=11&year=2026');
  assert.equal(evListRes.status, 200);
  const foundEv = (evListRes.data ?? []).find((e: any) => e.id === evId);
  assert.ok(foundEv, 'Created event missing in GET /api/events');
  assert.equal(Math.round(foundEv.metrics.netPersonalSpentRp), 100000, 'Expected netPersonalSpentRp = 100000 after 200k reimbursement');
  assert.equal(Math.round(foundEv.metrics.pendingAdvanceRp), 100000, 'Expected pendingAdvanceRp = 100000');

  const sweepRes = await apiReq(baseUrl, guestSession, 'POST', `/api/events/${evId}/close-sweep`, {
    destination: 'CORE_SAVINGS',
  });
  assert.ok(sweepRes.status === 200 || sweepRes.status === 201, `Close-sweep failed: ${sweepRes.rawText}`);
  assert.equal(Math.round(sweepRes.data.unusedAmountRp), 500000);

  const idorEvDel = await apiReq(baseUrl, u1Session, 'DELETE', `/api/events/${evId}`);
  assert.ok(
    idorEvDel.status === 403 || idorEvDel.status === 404,
    `Cross-tenant IDOR on event expected 403/404, got ${idorEvDel.status}`,
  );
  const delEvRes = await apiReq(baseUrl, guestSession, 'DELETE', `/api/events/${evId}`);
  assert.equal(delEvRes.status, 200);

  // Active Sinking Funds CRUD + Contribution + Intelligence telemetry link
  const sfCreateRes = await apiReq(baseUrl, guestSession, 'POST', '/api/sinking-funds', {
    name: 'QA Sinking Reserve',
    category: 'TRAVEL',
    targetAmountRp: 1200000,
    savedAmountRp: 200000,
    targetMonth: 6,
    targetYear: 2027,
  });
  assert.ok(sfCreateRes.status === 200 || sfCreateRes.status === 201, `Create sinking fund failed: ${sfCreateRes.rawText}`);
  const sfId = sfCreateRes.data.id;

  const sfContribRes = await apiReq(baseUrl, guestSession, 'POST', `/api/sinking-funds/${sfId}/contribute`, {
    amountRp: 250000,
  });
  assert.ok(sfContribRes.status === 200 || sfContribRes.status === 201, `Contribute sinking fund failed: ${sfContribRes.rawText}`);
  assert.equal(Math.round(sfContribRes.data.savedAmountRp), 450000);

  const intelSfRes = await apiReq(baseUrl, guestSession, 'GET', '/api/finance/intelligence?month=11&year=2026');
  assert.equal(intelSfRes.status, 200);
  assert.ok(
    (intelSfRes.data?.envelopes?.sinkingSchedules ?? []).some((s: any) => s.id === `db-${sfId}`),
    'Intelligence envelopes.sinkingSchedules must reflect active DB SinkingFundItem',
  );
  const delSfRes = await apiReq(baseUrl, guestSession, 'DELETE', `/api/sinking-funds/${sfId}`);
  assert.equal(delSfRes.status, 200);

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

  // Verify historical 10/2026 LOCKED baseline
  const oct26SnapRes = await apiReq(baseUrl, u1Session, 'GET', '/api/snapshots?month=10&year=2026');
  assert.equal(oct26SnapRes.status, 200);
  assert.equal(oct26SnapRes.data.status, 'LOCKED');
  assert.equal(Math.round(oct26SnapRes.data.finalTotalIncome), 5791000);
  assert.equal(Math.round(oct26SnapRes.data.actualSavings), 328345);

  const periods: Array<[number, number]> = [
    [11, 2026],
    [12, 2026],
    [1, 2027],
    [2, 2027],
    [3, 2027],
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
      Math.round(pay.finalTotalIncome),
      Math.round(s.finalTotalIncome),
      `${m}/${y} payroll income mismatch vs snapshot`,
    );
    assert.equal(intel.networth.monthlyRdpuYieldRp, 0, `${m}/${y} User #1 must have 0 Rp RDPU yield`);

    if (m === 11 && y === 2026) {
      assert.equal(Math.round(s.finalTotalIncome), 5891000);
      assert.equal(Math.round(s.totalDeductions), 4522976);
      assert.equal(Math.round(s.actualDailyOperational), 1720316);
      assert.equal(Math.round(s.deficitUncovered), 108633);
      assert.equal(Math.round(s.actualSavings), 6341);
      assert.equal(Math.round(s.selfReward), 250000);
      assert.equal(Math.round(p.remainingBudget), 84838);
      assert.ok(p.safeToSpendToday > 0, `User #1 11/2026 safeToSpendToday must be > 0, got ${p.safeToSpendToday}`);
    }
    if (m === 12 && y === 2026) {
      assert.equal(Math.round(s.finalTotalIncome), 9376925);
      assert.equal(Math.round(s.totalDeductions), 4260841);
      assert.equal(Math.round(s.actualDailyOperational), 1500000);
      assert.equal(Math.round(s.deficitUncovered), 0);
      assert.equal(Math.round(s.actualSavings), 1000000);
      assert.ok(p.safeToSpendToday > 0, `User #1 12/2026 safeToSpendToday must be > 0, got ${p.safeToSpendToday}`);
      assert.ok(
        ['PRE_PAYDAY', 'ACTIVE', 'COMPLETED'].includes(p.cycleTemporalState),
        `User #1 12/2026 must report valid cycleTemporalState, got ${p.cycleTemporalState}`,
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

  // Verify NDJSON /api/marquee/chat/stream emits status phases + final result with human agentSteps
  const streamRes = await fetch(`${baseUrl}/api/marquee/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(u1Session.cookieHeader ? { Cookie: u1Session.cookieHeader } : {}),
      ...(u1Session.bearerToken ? { Authorization: `Bearer ${u1Session.bearerToken}` } : {}),
    },
    body: JSON.stringify({
      message: 'Safe to spend today?',
      month: 11,
      year: 2026,
      activeRoute: '/',
    }),
  });
  assert.equal(streamRes.status, 201, `POST /api/marquee/chat/stream returned ${streamRes.status}`);
  const streamLines = (await streamRes.text())
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  assert.ok(streamLines.some((e) => e.type === 'status'), 'Stream must emit at least one status event');
  const finalEv = streamLines.find((e) => e.type === 'final');
  assert.ok(finalEv?.data?.ok === true, 'Stream must end with final response payload');
  assert.ok(
    Array.isArray(finalEv.data.agentSteps) && finalEv.data.agentSteps.length >= 2,
    'Final streamed response must attach human-readable agentSteps trace',
  );

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

  // Verify Marquee V4 out-of-scope guardrail & MCP JSON-RPC 2.0 endpoint security
  const badMcpRes = await fetch(`${baseUrl}/api/marquee/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': '1' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  assert.equal(badMcpRes.status, 401, 'Unauthenticated MCP request must return 401');

  const mcpListRes = await apiReq(baseUrl, u1Session, 'POST', '/api/marquee/mcp', {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
  });
  assert.ok(mcpListRes.status === 200 || mcpListRes.status === 201, `Authenticated MCP tools/list failed: ${mcpListRes.rawText}`);
  const mcpToolNames = (mcpListRes.data?.result?.tools ?? []).map((t: any) => t.name);
  assert.ok(mcpToolNames.includes('get_paycycle_pulse'), 'MCP tools/list must include get_paycycle_pulse');
  assert.ok(mcpToolNames.includes('search_financial_history'), 'MCP tools/list must include search_financial_history');
  assert.ok(!mcpToolNames.includes('execute_sql'), 'MCP tools/list must NEVER expose execute_sql');

  const mcpBlockedCall = await apiReq(baseUrl, u1Session, 'POST', '/api/marquee/mcp', {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'execute_sql', arguments: { query: 'SELECT 1' } },
  });
  assert.equal(mcpBlockedCall.data?.result?.isError, true, 'MCP must reject disallowed execute_sql tool');

  console.log('  PASS: All 13 routes, Smart Default Period, USER/SUPERADMIN isolation, Marquee V4 guardrails & MCP server verified.');
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
