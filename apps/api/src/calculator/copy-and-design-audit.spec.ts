import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const WEB_DIR = path.join(REPO_ROOT, 'apps', 'web');
const API_SRC_DIR = path.join(REPO_ROOT, 'apps', 'api', 'src');

function collectFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, exts));
    } else if (
      !entry.name.endsWith('.spec.ts') &&
      exts.some((ext) => entry.name.endsWith(ext))
    ) {
      results.push(full);
    }
  }
  return results;
}

describe('System-Wide Anti-AI-Slop Visual Design, Temporal Chart Axis & Human Copywriting Audit', () => {
  const langCtxPath = path.join(WEB_DIR, 'context', 'LanguageContext.tsx');
  const miniTrendPath = path.join(WEB_DIR, 'components', 'primitives', 'MiniTrendChart.tsx');
  const pacingCardPath = path.join(WEB_DIR, 'components', 'overview', 'AdaptiveDailyPacingCard.tsx');
  const debtTimelinePath = path.join(WEB_DIR, 'components', 'credit', 'contracts', 'DebtFreedomTimeline.tsx');
  const overviewWidgetsPath = path.join(WEB_DIR, 'components', 'finance', 'OverviewGoWidgets.tsx');

  it('purges "Reservoir/Vault/Forward-Borrow/Outlook/Amortization" jargon in favor of clear everyday finance terms (EN/ID/ZH)', () => {
    const langCtx = fs.readFileSync(langCtxPath, 'utf8');

    expect(langCtx).toContain('"nav.savings": "Savings & Emergency Fund"');
    expect(langCtx).toContain('"nav.savings": "Tabungan & Dana Darurat"');
    expect(langCtx).toContain('"nav.savings": "储蓄与应急基金"');
    expect(langCtx).not.toMatch(/Reservoirs?/);
    expect(langCtx).not.toMatch(/Burn-Rate Telemetry/);
    expect(langCtx).not.toMatch(/Sinking Fund Amortization/);

    const debtTimeline = fs.readFileSync(debtTimelinePath, 'utf8');
    expect(debtTimeline).toContain('Active Installment Plans');
    expect(debtTimeline).not.toContain('Amortization & Payoff Progress Lanes');

    const activeContractsHub = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'credit', 'contracts', 'ActiveContractsHub.tsx'),
      'utf8',
    );
    expect(activeContractsHub).toContain('Active Installment Plans');

    const uiAndI18nFiles = [
      langCtxPath,
      ...collectFiles(path.join(WEB_DIR, 'app'), ['.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'components'), ['.tsx']),
    ];
    const jargonCopyPatterns = [
      /\basset reservoirs\b/i,
      /\bnet worth reservoirs\b/i,
      /\bpacing telemetry\b/i,
      /\bgovernance dossier\b/i,
      /\bcontract amortization\b/i,
      /\bAmortized periodic goals\b/i,
      /Savings\s*(&|&amp;)\s*Vaults/i,
      /Tabungan\s*&\s*Brankas/i,
      /储蓄与金库/,
      /Forward-Borrow|\bforward[\s-]borrow\b/i,
      /\bP1\s+Vault\b/i,
      /\bInternal\s+P1\s+Vault\b/i,
      /\bWishlist\s+Vault\b/i,
      /\bVault\s+(Transaction|Activity|History|Realization|Inflow|Balance|Drawdown)\b/i,
      /\bDebt\s+Payoff\s+Outlook\b/i,
      /\b12-Month\s+Debt-Free\s+Outlook\b/i,
      /\bBalance\s+Outlook\b/i,
      /\bBrankas\s+P1\b/i,
      /\bPinjam\s+Muka\b/i,
      /\bLump-Sum\s+Override\b/i,
    ];
    for (const file of uiAndI18nFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const rel = path.relative(REPO_ROOT, file);
      for (const rx of jargonCopyPatterns) {
        expect({ file: rel, jargon: content.match(rx)?.[0] ?? null }).toEqual({
          file: rel,
          jargon: null,
        });
      }
    }
  });

  it('bans robotic AI transition phrases, sycophantic filler, and decorative emojis across UI and Marquee source', () => {
    const allSourceFiles = [
      ...collectFiles(path.join(WEB_DIR, 'components'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'app'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'context'), ['.ts', '.tsx']),
      ...collectFiles(path.join(API_SRC_DIR, 'marquee'), ['.ts']),
    ];

    const bannedPhrases = [
      /\bFurthermore\b/i,
      /\bIn conclusion\b/i,
      /\bIt is worth noting\b/i,
      /\bOleh karena itu\b/i,
      /\bSebagai kesimpulan\b/i,
      /\bDelve\b/i,
      /\bTapestry\b/i,
      /\bSupercharge\b/i,
      /\bEffortlessly\b/i,
      /\bGreat question!/i,
      /\bYou're doing amazing/i,
    ];
    const bannedEmojis = /[\u{1F680}\u{2728}\u{1F4A1}\u{1F3AF}\u{1F916}\u{1F4B0}\u{1F389}]/u;

    for (const file of allSourceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const rel = path.relative(REPO_ROOT, file);
      for (const rx of bannedPhrases) {
        expect({ file: rel, match: content.match(rx)?.[0] ?? null }).toEqual({
          file: rel,
          match: null,
        });
      }
      expect({ file: rel, emoji: content.match(bannedEmojis)?.[0] ?? null }).toEqual({
        file: rel,
        emoji: null,
      });
    }
  });

  it('eliminates generic AI cliché icons (Sparkles, Wand2, Bot) and backdrop-blur glassmorphism across all web components', () => {
    const webFiles = [
      ...collectFiles(path.join(WEB_DIR, 'components'), ['.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'app'), ['.tsx']),
    ];

    for (const file of webFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const rel = path.relative(REPO_ROOT, file);

      expect({
        file: rel,
        clicheIcon: content.match(/\b(Sparkles|Wand2|Bot)\b/)?.[0] ?? null,
      }).toEqual({
        file: rel,
        clicheIcon: null,
      });

      expect({
        file: rel,
        backdropBlur: content.match(/\bbackdrop-blur(?:-[a-z0-9[\]px]+)?\b/)?.[0] ?? null,
      }).toEqual({
        file: rel,
        backdropBlur: null,
      });
    }
  });

  it('renders actual cycle boundary dates (e.g. 27 NOV and 28 DEC) on MiniTrendChart in PRE_PAYDAY state and wires pre-payday awareness in Overview widgets', () => {
    const miniTrend = fs.readFileSync(miniTrendPath, 'utf8');
    const pacingCard = fs.readFileSync(pacingCardPath, 'utf8');
    const overviewWidgets = fs.readFileSync(overviewWidgetsPath, 'utf8');

    expect(miniTrend).toContain('cycleStartDate');
    expect(miniTrend).toContain('cycleEndDate');
    expect(miniTrend).toContain('formatAxisBoundaryDate');
    expect(pacingCard).toContain('cycleStartDate={pacing?.cycleStartDate}');
    expect(pacingCard).toContain('cycleEndDate={pacing?.cycleEndDate}');
    expect(overviewWidgets).toContain('PRE_PAYDAY');
  });

  it('enforces single icon-only bottom-right Marquee floating launcher, removes header Alt+M pill, and replaces Sidebar Marquee slot with Spending & Trend Review (/analytics)', () => {
    const sidebarPath = path.join(WEB_DIR, 'components', 'shell', 'Sidebar.tsx');
    const headerPath = path.join(WEB_DIR, 'components', 'shell', 'AppHeader.tsx');
    const launcherPath = path.join(WEB_DIR, 'components', 'marquee', 'MarqueeFloatingLauncher.tsx');

    const sidebar = fs.readFileSync(sidebarPath, 'utf8');
    const header = fs.readFileSync(headerPath, 'utf8');
    const launcher = fs.readFileSync(launcherPath, 'utf8');
    const langCtx = fs.readFileSync(langCtxPath, 'utf8');

    expect(sidebar).not.toContain('href: "/marquee"');
    expect(sidebar).toContain('href: "/analytics"');
    expect(sidebar).toContain('labelKey: "nav.analytics"');

    expect(header).not.toContain('erp:marquee-toggle');
    expect(header).not.toContain('Open Marquee AI Co-Pilot');

    expect(launcher).toContain('rounded-full');
    expect(launcher).toContain('w-11 h-11');
    expect(launcher).not.toContain('<kbd');

    expect(langCtx).toContain('"nav.analytics": "Spending & Trend Review"');
    expect(langCtx).toContain('"nav.analytics": "Tinjauan Belanja & Tren"');
    expect(langCtx).toContain('"nav.analytics": "支出与趋势复盘"');
  });

  it('removes developer tier/tool telemetry labels and Alt+M clutter from Marquee Drawer and Workspace UI', () => {
    const drawer = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'marquee', 'MarqueeCoPilotDrawer.tsx'),
      'utf8',
    );
    const workspace = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'marquee', 'MarqueeWorkspaceClient.tsx'),
      'utf8',
    );

    expect(drawer).not.toContain('m.tierUsed');
    expect(drawer).not.toContain('TIER1_NLU');
    expect(drawer).not.toContain('<kbd');
    expect(workspace).not.toContain('zero-latency Tier 1 NLU fallback');
    expect(workspace).not.toContain('<kbd');
  });

  it('enforces unified highlight/border utilities in globals.css, eliminates loud yellow/white wireframe borders, and wires /calendar to fetchCashRadar', () => {
    const globalsCss = fs.readFileSync(path.join(WEB_DIR, 'app', 'globals.css'), 'utf8');
    expect(globalsCss).toContain('.erp-surface-selected');
    expect(globalsCss).toContain('.erp-callout-caution');
    expect(globalsCss).toContain('.erp-callout-urgency');
    expect(globalsCss).toContain('.erp-callout-positive');

    const calendarClient = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'calendar', 'CashRadarCalendarClient.tsx'),
      'utf8',
    );
    expect(calendarClient).toContain('fetchCashRadar');
    expect(calendarClient).toContain('lowestCashPoint');
    expect(calendarClient).not.toContain('border-text-primary');

    const uiFiles = [
      ...collectFiles(path.join(WEB_DIR, 'components'), ['.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'app'), ['.tsx']),
    ];
    const bannedBorderPatterns = [
      /\bborder-text-primary\b/,
      /\bborder-amber-\d+\/\d+\b/,
      /\bbg-amber-\d+\/\d+\b/,
      /\bborder-caution\/[45]0\b/,
      /\bborder-urgency\/[56]0\b/,
      /bg-\[rgba\(245,158,11/,
      /\bCredit Card \(20th Cutoff\)/,
      /\bPermata CC \(20th Cutoff\)/,
      /\bBank CC 20th\/11th/,
      /<=20th CC/,
    ];
    for (const file of uiFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const rel = path.relative(REPO_ROOT, file);
      for (const rx of bannedBorderPatterns) {
        expect({ file: rel, badBorder: content.match(rx)?.[0] ?? null }).toEqual({
          file: rel,
          badBorder: null,
        });
      }
    }
  });

  it('renders MatrixCellDrawer add form immediately at top above lineItems and anchors /calendar grid from cycleStartIso with itemized subItems', () => {
    const drawerPath = path.join(WEB_DIR, 'components', 'credit', 'matrix', 'MatrixCellDrawer.tsx');
    const drawer = fs.readFileSync(drawerPath, 'utf8');
    const formIdx = drawer.indexOf('{showAddForm &&');
    const listIdx = drawer.indexOf('{lineItems.length === 0 ? (');
    expect(formIdx).toBeGreaterThan(-1);
    expect(listIdx).toBeGreaterThan(-1);
    expect(formIdx).toBeLessThan(listIdx);
    expect(drawer).not.toContain('`${DOMAIN_CONSTANTS.SPAYLATER_CUTOFF_DAY}th`');

    const cal = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'calendar', 'CashRadarCalendarClient.tsx'),
      'utf8',
    );
    expect(cal).toContain('cycleStartIso');
    expect(cal).toContain('SPENDING');
    expect(cal).toContain('subItems');
  });

  it('preserves positive contract remainingPrincipal & freedMilestones on zero-slice cycles and prevents Payroll THR card clipping', () => {
    const hub = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'credit', 'contracts', 'ActiveContractsHub.tsx'),
      'utf8',
    );
    expect(hub).not.toContain('remainingPrincipal: Math.round(activeSliceAmount * remainingMonths)');
    expect(hub).toContain('contractMonthlyInstallment');

    const payrollCards = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'payroll', 'PayrollCashflowHighlights.tsx'),
      'utf8',
    );
    expect(payrollCards).toContain('col-span-4');
    expect(payrollCards).not.toMatch(/col-span-2">\s*<MetricCard[\s\S]*?THR, Bonus/);

    const drawer = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'marquee', 'MarqueeCoPilotDrawer.tsx'),
      'utf8',
    );
    const workspace = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'marquee', 'MarqueeWorkspaceClient.tsx'),
      'utf8',
    );
    expect(drawer).not.toContain('3.4jt Natal THR');
    expect(workspace).not.toContain('3.4jt Natal THR');
  });

  it('enforces dark emerald-slate CTA buttons (no glaring white bg-text-primary text-canvas), Sidebar BrandMark, global PrivacyEyeButton, and route skeletons', () => {
    const globals = fs.readFileSync(path.join(WEB_DIR, 'app', 'globals.css'), 'utf8');
    expect(globals).toContain('.erp-btn-primary');
    expect(globals).toContain('.erp-btn-secondary');

    const uiFiles = collectFiles(path.join(WEB_DIR, 'components'), ['.ts', '.tsx']).concat(
      collectFiles(path.join(WEB_DIR, 'app'), ['.ts', '.tsx']),
    );
    for (const file of uiFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const rel = path.relative(REPO_ROOT, file);
      expect({ file: rel, whiteBtn: content.includes('bg-text-primary text-canvas') }).toEqual({
        file: rel,
        whiteBtn: false,
      });
    }

    const sidebar = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'shell', 'Sidebar.tsx'),
      'utf8',
    );
    expect(sidebar).toContain('<BrandMark');
    expect(sidebar).toContain('/import');
    expect(sidebar).toContain('/scenarios');
    expect(sidebar).not.toContain('SPinjam Tracker');

    const appHeader = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'shell', 'AppHeader.tsx'),
      'utf8',
    );
    expect(appHeader).toContain('PrivacyEyeButton');

    expect(
      fs.existsSync(path.join(WEB_DIR, 'components', 'primitives', 'PageHeader.tsx')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(WEB_DIR, 'components', 'primitives', 'WorkspaceSkeleton.tsx')),
    ).toBe(true);

    const requiredLoadings = [
      'loading.tsx',
      'allocations/loading.tsx',
      'credit/loading.tsx',
      'savings/loading.tsx',
      'reports/loading.tsx',
      'import/loading.tsx',
      'scenarios/loading.tsx',
      'preferences/loading.tsx',
      'analytics/loading.tsx',
      'calendar/loading.tsx',
      'payroll/loading.tsx',
    ];
    for (const lp of requiredLoadings) {
      expect({ loadingFile: lp, exists: fs.existsSync(path.join(WEB_DIR, 'app', lp)) }).toEqual({
        loadingFile: lp,
        exists: true,
      });
    }
  });

  it('purges P1/P2/P3 priority labels & raw enum strings from consumer UI, sets consolidated tabs, and wires visual /reports, /import, /scenarios & 6-tab /preferences', () => {
    const bannedUiCopy = [
      /\bPriority [123]\b/,
      /\((?:P1|P2|P3)\)/,
      /\bCore P1\b/,
      /\bP1 Savings\b/,
      /\bP2 Surplus\b/,
      /\bP1 Refund\b/,
      /Rp\s+Rp\b/,
      /(?<![`"'])DEBT_FIRST_WATERFALL(?![`"'])/,
      /Rp\s*•••••••/,
    ];
    const checkFiles = [
      ...collectFiles(path.join(WEB_DIR, 'components', 'overview'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'components', 'allocations'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'components', 'savings'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'components', 'reports'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'components', 'credit'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'components', 'analytics'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'components', 'preferences'), ['.ts', '.tsx']),
      path.join(WEB_DIR, 'context', 'LanguageContext.tsx'),
    ];
    for (const file of checkFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const rel = path.relative(REPO_ROOT, file);
      for (const rx of bannedUiCopy) {
        expect({ file: rel, badCopy: content.match(rx)?.[0] ?? null }).toEqual({
          file: rel,
          badCopy: null,
        });
      }
    }

    const tabs = fs.readFileSync(path.join(WEB_DIR, 'lib', 'tabs.ts'), 'utf8');
    expect(tabs).toContain('ALLOCATIONS_SUB_KEYS = ["waterfall", "envelopes"]');
    expect(tabs).toContain('CREDIT_SUB_KEYS = ["matrix", "simulator"]');
    expect(tabs).toContain('SAVINGS_SUB_KEYS = ["pockets", "runway"]');
    expect(tabs).toContain('PREFERENCES_TAB_KEYS: readonly PreferencesTabKey[] = [');
    expect(tabs).toContain('"display"');
    expect(tabs).toContain('"backup"');

    expect(
      fs.existsSync(path.join(WEB_DIR, 'components', 'reports', 'ReportsEquityChart.tsx')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(WEB_DIR, 'components', 'reports', 'ReportsSpendingBreakdown.tsx')),
    ).toBe(true);
    expect(fs.existsSync(path.join(WEB_DIR, 'app', 'import', 'page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(WEB_DIR, 'app', 'scenarios', 'page.tsx'))).toBe(true);
  });

  it('prevents Headers spread 401 bugs, compactly masks currency ("Rp •••••"), eliminates all Windows-1252 mojibake & backend/UI P1/enum leaks', () => {
    const apiLib = fs.readFileSync(path.join(WEB_DIR, 'lib', 'api.ts'), 'utf8');
    expect(apiLib).not.toMatch(/\.\.\.\s*\(?\s*await\s+getAuthHeaders/);
    expect(apiLib).not.toContain('P1 Savings -> P2 Reward');

    const utils = fs.readFileSync(path.join(WEB_DIR, 'lib', 'utils.ts'), 'utf8');
    expect(utils).toContain('"Rp •••••"');
    expect(utils).not.toContain('Rp •••••••');

    const mojibakeRx = /[\u00c2\u00c3][\u0080-\u00bf]|\u00e2\u20ac|\u00e2\u2020\u2019|\u00c3\u2014/;
    const scanRoots = [
      ...collectFiles(path.join(WEB_DIR, 'app'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'components'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'lib'), ['.ts', '.tsx']),
      ...collectFiles(path.join(REPO_ROOT, 'apps', 'api', 'src'), ['.ts']),
    ];
    for (const file of scanRoots) {
      if (file.endsWith('.spec.ts')) continue;
      const content = fs.readFileSync(file, 'utf8');
      const rel = path.relative(REPO_ROOT, file);
      expect({ file: rel, mojibake: content.match(mojibakeRx)?.[0] ?? null }).toEqual({
        file: rel,
        mojibake: null,
      });
    }

    const leakChecks: Array<[string, RegExp]> = [
      [path.join(WEB_DIR, 'components', 'savings', 'SavingsGoalsCard.tsx'), /\{goal\.category\}/],
      [path.join(WEB_DIR, 'components', 'preferences', 'CustomRequestStudio.tsx'), /\{profileMode\}/],
      [path.join(REPO_ROOT, 'apps', 'api', 'src', 'config', 'studio.defaults.ts'), /P1 Vault Demo|Internal P1 Reserve/],
      [path.join(REPO_ROOT, 'apps', 'api', 'src', 'finance', 'finance.selectors.ts'), /Active Cycle P1 Reserve/],
      [path.join(REPO_ROOT, 'apps', 'api', 'src', 'calculator', 'hybrid-engine.ts'), /Core Savings Transfer \(P1 Vault\)/],
      [path.join(REPO_ROOT, 'apps', 'api', 'src', 'reports', 'reports.selectors.ts'), /No P1 Savings Funded|Core Savings \(P1\)/],
      [path.join(REPO_ROOT, 'apps', 'api', 'src', 'calculator', 'analytics.ts'), /Funded P1 Savings/],
    ];
    for (const [file, rx] of leakChecks) {
      const content = fs.readFileSync(file, 'utf8');
      const rel = path.relative(REPO_ROOT, file);
      expect({ file: rel, leak: content.match(rx)?.[0] ?? null }).toEqual({
        file: rel,
        leak: null,
      });
    }
  });

  it('mounts animated SVG robot avatar + typing/thinking trace in Marquee UI, manual billing cycle selector in RecordExpenseCard, and modular cutoffFormula editor in Preferences', () => {
    const robotPath = path.join(WEB_DIR, 'components', 'primitives', 'MarqueeRobotAvatar.tsx');
    expect(fs.existsSync(robotPath)).toBe(true);
    const robotSrc = fs.readFileSync(robotPath, 'utf8');
    expect(robotSrc).toMatch(/thinking|analyzing|scanning/i);
    expect(robotSrc).not.toMatch(/\bBot\b|\bSparkles\b|\bWand2\b/);

    const drawerSrc = fs.readFileSync(path.join(WEB_DIR, 'components', 'marquee', 'MarqueeCoPilotDrawer.tsx'), 'utf8');
    expect(drawerSrc).toContain('MarqueeRobotAvatar');
    expect(drawerSrc).toMatch(/Thinking|agentSteps/);

    const recordExpenseSrc = fs.readFileSync(path.join(WEB_DIR, 'components', 'overview', 'RecordExpenseCard.tsx'), 'utf8');
    expect(recordExpenseSrc).toContain('billingStartMonth');

    const studioTablesSrc = fs.readFileSync(path.join(WEB_DIR, 'components', 'preferences', 'StudioTables.tsx'), 'utf8');
    expect(studioTablesSrc).toContain('cutoffFormula');
    expect(studioTablesSrc).toContain('preCutoffOffsetMonths');
  });

  it('forbids new Function dynamic eval in Marquee business tools and enforces complete multi-tenant userId/User relations in Prisma ERD', () => {
    const toolsSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'apps', 'api', 'src', 'marquee', 'marquee-tools.service.ts'),
      'utf8',
    );
    expect(toolsSrc).not.toContain('new Function(');

    const schemaSrc = fs.readFileSync(
      path.join(REPO_ROOT, 'apps', 'api', 'prisma', 'schema.prisma'),
      'utf8',
    );
    const tenantModels = [
      'CreditContract',
      'ScheduledBill',
      'GlobalConfig',
      'MonthlySnapshot',
      'CreditCardTransaction',
      'MonthlyBulkBill',
      'LiabilityLineItem',
      'SavingsManualTransaction',
      'SavingsGoal',
      'WishlistItem',
      'AuditLog',
      'CustomFeatureRequest',
      'TrustedIpAddress',
      'RefreshToken',
      'MobileDevice',
      'BiometricChallenge',
      'UserIdentity',
      'IdempotencyRecord',
      'PasswordResetToken',
    ];
    for (const modelName of tenantModels) {
      const rx = new RegExp(`model\\s+${modelName}\\s+\\{([\\s\\S]*?)\\n\\}`, 'm');
      const block = schemaSrc.match(rx)?.[1] ?? '';
      expect({ modelName, hasUserId: /\buserId\s+Int\b/.test(block), hasUserRel: /\buser\s+User\s+@relation/.test(block) }).toEqual({
        modelName,
        hasUserId: true,
        hasUserRel: true,
      });
    }
  });

  it('removes Switch Account, locked-identity lock screens, and Age Bracket presets from web UI', () => {
    const webUiFiles = [
      ...collectFiles(path.join(WEB_DIR, 'app'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'components'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'context'), ['.ts', '.tsx']),
    ];
    for (const file of webUiFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const rel = path.relative(REPO_ROOT, file);
      expect({
        file: rel,
        hasSwitchOrLock: /Switch Account|erp_locked_identity|lockedIdentity|auth\.switchAccount|Session Locked/.test(content),
      }).toEqual({
        file: rel,
        hasSwitchOrLock: false,
      });
      expect({
        file: rel,
        hasAgePresetCopy: /Ages\s+\d{2}[–-]\d{2}|STUDENT_FIRST_JOBBER|RETIREE_GOLDEN_AGE/.test(content),
      }).toEqual({
        file: rel,
        hasAgePresetCopy: false,
      });
    }
  });
});
