/**
 * Sunday Funday ERP — API & Web Performance Benchmark Suite
 *
 * Strictly read-only against live routes using the isolated Demo Sandbox (`POST /api/auth/demo-login`).
 * Never authenticates as or mutates `userId = 1`.
 *
 * Usage:
 *   npm run erp:benchmark -- --live
 *   npm run erp:benchmark -- --local
 *   npm run erp:benchmark -- --live --runs=5
 */

type BenchmarkTarget = {
  label: string;
  url: string;
  method?: 'GET' | 'POST';
  auth?: boolean;
  body?: unknown;
  expectedContentType?: string;
};

type BenchmarkResult = {
  group: 'API' | 'WEB';
  label: string;
  url: string;
  status: number;
  ok: boolean;
  warmupMs: number;
  minMs: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  bytes: number;
  error?: string;
};

function getArgValue(prefix: string): string | undefined {
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

const isLocal = process.argv.includes('--local');
const runsRaw = Number.parseInt(getArgValue('--runs=') ?? '5', 10);
const runs = Number.isFinite(runsRaw) && runsRaw > 0 ? runsRaw : 5;

const API_BASE = (
  getArgValue('--api-url=') ??
  (isLocal ? 'http://127.0.0.1:3001' : 'https://sundayfunday-api.vercel.app')
).replace(/\/$/, '');

const WEB_BASE = (
  getArgValue('--web-url=') ??
  (isLocal ? 'http://127.0.0.1:3000' : 'https://sundayfunday-erp.vercel.app')
).replace(/\/$/, '');

function percentile95(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx];
}

async function timedRequest(
  group: 'API' | 'WEB',
  target: BenchmarkTarget,
  token: string | null,
): Promise<{ status: number; elapsedMs: number; bytes: number; bodyText: string }> {
  const headers: Record<string, string> = {};
  if (target.auth && token) {
    if (group === 'API') {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['Cookie'] = `erp_auth_token=${token}`;
    }
  }
  if (target.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const start = performance.now();
  const res = await fetch(target.url, {
    method: target.method ?? 'GET',
    headers,
    body: target.body !== undefined ? JSON.stringify(target.body) : undefined,
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  const buf = await res.arrayBuffer();
  const elapsedMs = performance.now() - start;
  const bodyText = new TextDecoder().decode(buf);

  return {
    status: res.status,
    elapsedMs,
    bytes: buf.byteLength,
    bodyText,
  };
}

async function benchmarkTarget(
  group: 'API' | 'WEB',
  target: BenchmarkTarget,
  token: string | null,
): Promise<BenchmarkResult> {
  try {
    const warmup = await timedRequest(group, target, token);
    const samples: number[] = [];
    let lastStatus = warmup.status;
    let lastBytes = warmup.bytes;

    for (let i = 0; i < runs; i += 1) {
      const sample = await timedRequest(group, target, token);
      samples.push(sample.elapsedMs);
      lastStatus = sample.status;
      lastBytes = sample.bytes;
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const sum = samples.reduce((acc, v) => acc + v, 0);

    return {
      group,
      label: target.label,
      url: target.url,
      status: lastStatus,
      ok: lastStatus >= 200 && lastStatus < 400,
      warmupMs: Math.round(warmup.elapsedMs),
      minMs: Math.round(sorted[0] ?? 0),
      avgMs: Math.round(sum / Math.max(1, samples.length)),
      p95Ms: Math.round(percentile95(sorted)),
      maxMs: Math.round(sorted[sorted.length - 1] ?? 0),
      bytes: lastBytes,
    };
  } catch (err) {
    return {
      group,
      label: target.label,
      url: target.url,
      status: 0,
      ok: false,
      warmupMs: 0,
      minMs: 0,
      avgMs: 0,
      p95Ms: 0,
      maxMs: 0,
      bytes: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function padRight(val: string, width: number): string {
  return val.length >= width ? val.slice(0, width) : val + ' '.repeat(width - val.length);
}

function padLeft(val: string, width: number): string {
  return val.length >= width ? val : ' '.repeat(width - val.length) + val;
}

function printTable(title: string, rows: BenchmarkResult[]) {
  console.log(`\n${title}`);
  console.log('-'.repeat(94));
  console.log(
    `${padRight('Endpoint / Route', 36)} | ${padRight('Status', 6)} | ${padLeft('Warmup', 8)} | ${padLeft('Min', 7)} | ${padLeft('Avg', 7)} | ${padLeft('P95', 7)} | ${padLeft('Size', 8)}`,
  );
  console.log('-'.repeat(94));
  for (const row of rows) {
    const statusText = row.ok ? `${row.status}` : row.status ? `${row.status}!` : 'ERR';
    const sizeKb = row.bytes > 0 ? `${(row.bytes / 1024).toFixed(1)} KB` : '0.0 KB';
    console.log(
      `${padRight(row.label, 36)} | ${padRight(statusText, 6)} | ${padLeft(`${row.warmupMs} ms`, 8)} | ${padLeft(`${row.minMs} ms`, 7)} | ${padLeft(`${row.avgMs} ms`, 7)} | ${padLeft(`${row.p95Ms} ms`, 7)} | ${padLeft(sizeKb, 8)}`,
    );
    if (row.error) {
      console.log(`  -> ERROR: ${row.error}`);
    }
  }
  console.log('-'.repeat(94));
}

async function main() {
  console.log('==============================================================================');
  console.log('Sunday Funday ERP — Benchmark Suite');
  console.log(`Mode   : ${isLocal ? 'LOCAL' : 'LIVE REMOTE'} (${runs} warm runs + 1 warmup per route)`);
  console.log(`API    : ${API_BASE}`);
  console.log(`WEB    : ${WEB_BASE}`);
  console.log('==============================================================================');

  // Obtain isolated Demo Sandbox token (strictly non-User-1, read-safe)
  let demoToken: string | null = null;
  try {
    const authRes = await timedRequest(
      'API',
      {
        label: 'POST /api/auth/demo-login',
        url: `${API_BASE}/api/auth/demo-login`,
        method: 'POST',
        body: {},
      },
      null,
    );
    if (authRes.status >= 200 && authRes.status < 300) {
      const parsed = JSON.parse(authRes.bodyText) as { accessToken?: string };
      demoToken = parsed.accessToken ?? null;
    }
    if (!demoToken) {
      console.error(`Failed to obtain Demo Sandbox token (HTTP ${authRes.status}).`);
      process.exitCode = 1;
      return;
    }
  } catch (err) {
    console.error('Demo login error:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
    return;
  }

  const apiTargets: BenchmarkTarget[] = [
    { label: 'GET /', url: `${API_BASE}/` },
    {
      label: 'POST /api/auth/demo-login',
      url: `${API_BASE}/api/auth/demo-login`,
      method: 'POST',
      body: {},
    },
    {
      label: 'GET /api/snapshots?10/2026',
      url: `${API_BASE}/api/snapshots?month=10&year=2026`,
      auth: true,
    },
    {
      label: 'GET /api/snapshots?11/2026',
      url: `${API_BASE}/api/snapshots?month=11&year=2026`,
      auth: true,
    },
    {
      label: 'GET /api/snapshots?12/2026',
      url: `${API_BASE}/api/snapshots?month=12&year=2026`,
      auth: true,
    },
    {
      label: 'GET /api/snapshots?01/2027',
      url: `${API_BASE}/api/snapshots?month=1&year=2027`,
      auth: true,
    },
    {
      label: 'GET /api/snapshots/horizon (12m)',
      url: `${API_BASE}/api/snapshots/horizon?startMonth=7&startYear=2026&count=12`,
      auth: true,
    },
    {
      label: 'GET /api/finance/payroll-horizon',
      url: `${API_BASE}/api/finance/payroll-horizon?startMonth=7&startYear=2026&count=12`,
      auth: true,
    },
    {
      label: 'GET /api/finance/pacing?10/2026',
      url: `${API_BASE}/api/finance/pacing?month=10&year=2026`,
      auth: true,
    },
    {
      label: 'GET /api/finance/transactions',
      url: `${API_BASE}/api/finance/transactions?month=10&year=2026`,
      auth: true,
    },
    {
      label: 'GET /api/credit/matrix?10/2026',
      url: `${API_BASE}/api/credit/matrix?month=10&year=2026`,
      auth: true,
    },
    {
      label: 'GET /api/credit/line-items',
      url: `${API_BASE}/api/credit/line-items?month=10&year=2026`,
      auth: true,
    },
    {
      label: 'GET /api/savings?10/2026',
      url: `${API_BASE}/api/savings?month=10&year=2026`,
      auth: true,
    },
    {
      label: 'GET /api/audit/report',
      url: `${API_BASE}/api/audit/report`,
      auth: true,
    },
    {
      label: 'GET /api/reports?10/2026',
      url: `${API_BASE}/api/reports?month=10&year=2026`,
      auth: true,
    },
    {
      label: 'GET /api/reports/forecast',
      url: `${API_BASE}/api/reports/forecast?month=10&year=2026&horizon=3`,
      auth: true,
    },
    {
      label: 'GET /api/wishlist',
      url: `${API_BASE}/api/wishlist`,
      auth: true,
    },
    {
      label: 'GET /api/credit/cards?10/2026',
      url: `${API_BASE}/api/credit/cards?month=10&year=2026`,
      auth: true,
    },
    {
      label: 'GET /api/credit/kill-switches',
      url: `${API_BASE}/api/credit/kill-switches`,
      auth: true,
    },
    {
      label: 'GET /api/credit/kill-switches/cfg',
      url: `${API_BASE}/api/credit/kill-switches/notification-config`,
      auth: true,
    },
    {
      label: 'GET /api/email/status',
      url: `${API_BASE}/api/email/status`,
      auth: true,
    },
    {
      label: 'POST /api/email/preview (RO)',
      url: `${API_BASE}/api/email/preview`,
      method: 'POST',
      body: { template: 'kill-switch', month: 10, year: 2026, locale: 'EN' },
      auth: true,
    },
    {
      label: 'GET /api/config/routine-cats',
      url: `${API_BASE}/api/config/routine-categories`,
      auth: true,
    },
    {
      label: 'GET /api/config/custom-requests',
      url: `${API_BASE}/api/config/custom-requests`,
      auth: true,
    },
    {
      label: 'GET /api/analytics?scope=cycle',
      url: `${API_BASE}/api/analytics?scope=cycle`,
      auth: true,
    },
  ];

  const webTargets: BenchmarkTarget[] = [
    { label: 'WEB /login', url: `${WEB_BASE}/login` },
    { label: 'WEB / (Overview)', url: `${WEB_BASE}/`, auth: true },
    { label: 'WEB /?11/2026', url: `${WEB_BASE}/?month=11&year=2026`, auth: true },
    { label: 'WEB /payroll', url: `${WEB_BASE}/payroll`, auth: true },
    { label: 'WEB /payroll?12/2026', url: `${WEB_BASE}/payroll?month=12&year=2026`, auth: true },
    { label: 'WEB /allocations', url: `${WEB_BASE}/allocations`, auth: true },
    { label: 'WEB /allocations?01/2027', url: `${WEB_BASE}/allocations?month=1&year=2027`, auth: true },
    { label: 'WEB /credit', url: `${WEB_BASE}/credit`, auth: true },
    { label: 'WEB /credit?tab=card', url: `${WEB_BASE}/credit?tab=card`, auth: true },
    { label: 'WEB /subscriptions', url: `${WEB_BASE}/subscriptions`, auth: true },
    { label: 'WEB /savings', url: `${WEB_BASE}/savings`, auth: true },
    { label: 'WEB /ledger', url: `${WEB_BASE}/ledger`, auth: true },
    { label: 'WEB /wishlist', url: `${WEB_BASE}/wishlist`, auth: true },
    { label: 'WEB /wishlist?tab=planner', url: `${WEB_BASE}/wishlist?tab=planner`, auth: true },
    { label: 'WEB /audit', url: `${WEB_BASE}/audit`, auth: true },
    { label: 'WEB /audit?tab=scorecard', url: `${WEB_BASE}/audit?tab=scorecard`, auth: true },
    { label: 'WEB /analytics', url: `${WEB_BASE}/analytics`, auth: true },
    { label: 'WEB /reports', url: `${WEB_BASE}/reports`, auth: true },
    { label: 'WEB /guide', url: `${WEB_BASE}/guide`, auth: true },
    { label: 'WEB /preferences?tab=killswitch', url: `${WEB_BASE}/preferences?tab=killswitch`, auth: true },
    { label: 'WEB /preferences?tab=modules', url: `${WEB_BASE}/preferences?tab=modules`, auth: true },
    { label: 'WEB /preferences?tab=payroll', url: `${WEB_BASE}/preferences?tab=payroll`, auth: true },
    { label: 'WEB /preferences?tab=buckets', url: `${WEB_BASE}/preferences?tab=buckets`, auth: true },
    { label: 'WEB /preferences?tab=sandbox', url: `${WEB_BASE}/preferences?tab=sandbox`, auth: true },
    { label: 'WEB /preferences?tab=policy', url: `${WEB_BASE}/preferences?tab=policy`, auth: true },
    { label: 'WEB /preferences?tab=requests', url: `${WEB_BASE}/preferences?tab=requests`, auth: true },
    { label: 'WEB /icon.svg', url: `${WEB_BASE}/icon.svg` },
    { label: 'WEB /manifest.webmanifest', url: `${WEB_BASE}/manifest.webmanifest` },
  ];

  const apiResults: BenchmarkResult[] = [];
  for (let i = 0; i < apiTargets.length; i += 1) {
    const target = apiTargets[i];
    const res = await benchmarkTarget('API', target, demoToken);
    apiResults.push(res);
    console.log(`[API ${i + 1}/${apiTargets.length}] ${target.label}: avg=${res.avgMs}ms (${res.status})`);
  }

  printTable('API BENCHMARKS (NestJS)', apiResults);

  const webResults: BenchmarkResult[] = [];
  for (let i = 0; i < webTargets.length; i += 1) {
    const target = webTargets[i];
    const res = await benchmarkTarget('WEB', target, demoToken);
    webResults.push(res);
    console.log(`[WEB ${i + 1}/${webTargets.length}] ${target.label}: avg=${res.avgMs}ms (${res.status})`);
  }

  printTable('WEB BENCHMARKS (Next.js App Router)', webResults);

  const all = [...apiResults, ...webResults];
  const failures = all.filter((r) => !r.ok);
  const avgOverall = Math.round(all.reduce((acc, r) => acc + r.avgMs, 0) / Math.max(1, all.length));
  const maxP95 = Math.max(...all.map((r) => r.p95Ms), 0);

  console.log(`\nSummary: ${all.length - failures.length}/${all.length} routes passed | Mean Warm Avg: ${avgOverall} ms | Worst Warm P95: ${maxP95} ms`);

  if (failures.length > 0) {
    console.error('\nFailed routes:');
    for (const f of failures) {
      console.error(`  - ${f.label}: HTTP ${f.status} ${f.error ?? ''}`);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
