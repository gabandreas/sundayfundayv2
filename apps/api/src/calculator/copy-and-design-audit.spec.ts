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

    const settingsPanel = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'preferences', 'MarqueeAiSettingsPanel.tsx'),
      'utf8',
    );
    const responseCards = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'marquee', 'MarqueeResponseCards.tsx'),
      'utf8',
    );
    for (const [name, src] of [
      ['MarqueeCoPilotDrawer.tsx', drawer],
      ['MarqueeWorkspaceClient.tsx', workspace],
      ['MarqueeResponseCards.tsx', responseCards],
      ['MarqueeAiSettingsPanel.tsx', settingsPanel],
    ] as const) {
      expect({
        file: name,
        leakedModelOrTier:
          src.match(/Gemini 3\.8|Llama 3\.3|DeepSeek-V4\.1|DeepSeek-R1|deepseek-v4\.1-flash-free|Tier 1 Deterministic NLU|Tier 2 ·/)?.[0] ??
          null,
      }).toEqual({
        file: name,
        leakedModelOrTier: null,
      });
    }
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
    expect(sidebar).toContain('PrivacyEyeButton');
    expect(sidebar).not.toContain('SPinjam Tracker');

    const appHeader = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'shell', 'AppHeader.tsx'),
      'utf8',
    );
    expect(appHeader).not.toContain('PrivacyEyeButton');

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

  it('purges Tailwind uppercase utilities and non-acronym ALL-CAPS UI copy across web views and translations', () => {
    const tsxFiles = [
      ...collectFiles(path.join(WEB_DIR, 'app'), ['.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'components'), ['.tsx']),
    ];
    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const rel = path.relative(REPO_ROOT, file);
      const classChunks = content.match(/(?:className|class)\s*=\s*(?:"[^"]*"|'[^']*'|`[^`]*`|\{[^}]*\})/g) ?? [];
      const hasUppercaseClass = classChunks.some((chunk) => /\buppercase\b/.test(chunk));
      expect({ file: rel, hasUppercaseClass }).toEqual({ file: rel, hasUppercaseClass: false });
    }

    const langPath = path.join(WEB_DIR, 'context', 'LanguageContext.tsx');
    const langLines = fs.readFileSync(langPath, 'utf8').split(/\r?\n/);
    const allow = new Set([
      'EN', 'ID', 'ZH', 'ERP', 'IDR', 'THR', 'API', 'SMTP', 'IP', 'MCP', 'BYOK',
      'SQL', 'CSV', 'PDF', 'PIN', 'CC', 'ATM', 'QRIS', 'UI', 'URL', 'HTTP', 'HTTPS',
      'JSON', 'UTC', 'WIB', 'P1', 'P2', 'P3', 'P4', 'AI', 'GO', 'UUID', 'JWT', 'AES',
      'SHA', 'OK', 'FAQ', 'SSO', 'MFA', 'OTP', '2FA',
    ]);
    for (let i = 0; i < langLines.length; i++) {
      const m = langLines[i].match(/^\s*"([^"]+)":\s*"([^"]+)"/);
      if (!m) continue;
      const val = m[2];
      const letters = val.replace(/[^A-Za-z]/g, '');
      if (letters.length >= 4 && letters === letters.toUpperCase()) {
        const words = val.split(/[^A-Za-z0-9]+/).filter(Boolean);
        const bad = words.some((w) => /[A-Z]{4,}/.test(w) && !allow.has(w));
        expect({ key: m[1], val, hasAllCapsCopy: bad }).toEqual({
          key: m[1],
          val,
          hasAllCapsCopy: false,
        });
      }
    }

    const webAllFiles = [
      ...collectFiles(path.join(WEB_DIR, 'app'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'components'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'context'), ['.ts', '.tsx']),
    ];
    const forbiddenLiterals =
      /PERSONAL ERP|BESPOKE CLIENT|STANDARD EDITION|DEMO SANDBOX|WALLET CHECK-IN|AFFORDABILITY CHECK|QUICK ENTRY|SAFE-TO-SPEND TODAY|BURNING FAST|MONTHLY BUDGET OVERVIEW|UPCOMING LIVING POOL|CYCLE COMPLETED|CASHFLOW SUMMARY|LIVING & ROUTINE BILLS|RECENT TRANSACTIONS/;
    for (const file of webAllFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const rel = path.relative(REPO_ROOT, file);
      expect({ file: rel, hasForbiddenAllCaps: forbiddenLiterals.test(content) }).toEqual({
        file: rel,
        hasForbiddenAllCaps: false,
      });
    }

    const miniTrendSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'primitives', 'MiniTrendChart.tsx'),
      'utf8',
    );
    expect(miniTrendSrc).not.toContain('"DAY 1"');
    expect(miniTrendSrc).not.toContain('(DAY 1)');
  });

  it('consolidates PrivacyEyeButton exclusively into Sidebar utility bar and implements a clutter-free native Popover Account Menu', () => {
    const uiFiles = [
      ...collectFiles(path.join(WEB_DIR, 'app'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'components'), ['.ts', '.tsx']),
    ];
    for (const file of uiFiles) {
      const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
      if (
        rel.endsWith('components/shell/Sidebar.tsx') ||
        rel.endsWith('components/shell/PrivacyEyeButton.tsx')
      ) {
        continue;
      }
      const content = fs.readFileSync(file, 'utf8');
      expect({ file: rel, hasCardPrivacyEye: content.includes('<PrivacyEyeButton') }).toEqual({
        file: rel,
        hasCardPrivacyEye: false,
      });
    }

    const sidebarSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'shell', 'Sidebar.tsx'),
      'utf8',
    );
    expect(sidebarSrc).toContain('<PrivacyEyeButton');

    const appHeaderSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'shell', 'AppHeader.tsx'),
      'utf8',
    );
    expect(appHeaderSrc).not.toContain('<PrivacyEyeButton');
    expect(appHeaderSrc).not.toContain('BookOpen');
    expect(appHeaderSrc).not.toContain('href="/guide"');

    const accountBadgeSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'shell', 'AccountHeaderBadge.tsx'),
      'utf8',
    );
    expect(accountBadgeSrc).toContain('popover="auto"');
    expect(accountBadgeSrc).toContain('focusgroup="menu nomemory"');
    expect(accountBadgeSrc).not.toContain('Privacy Stealth');
    expect(accountBadgeSrc).not.toContain('UI Density');
    expect(accountBadgeSrc).not.toContain('Modules & Preferences');
    expect(accountBadgeSrc).not.toContain('ID #');
    const triggerMatch = accountBadgeSrc.match(/id="account-menu-trigger"[\s\S]*?<\/button>/);
    expect(triggerMatch).toBeTruthy();
    const triggerInner = (triggerMatch?.[0] ?? '').split('>').slice(1).join('>');
    expect(triggerInner).not.toContain('{cleanName}');
    expect(triggerInner).toContain('{initials}');
  });

  it('implements unified popover="manual" Toast system with ariaNotify/allow-discrete CSS and mounts Go stress-test workbench in /scenarios', () => {
    const toastCtxPath = path.join(WEB_DIR, 'context', 'ToastContext.tsx');
    const toastViewportPath = path.join(WEB_DIR, 'components', 'primitives', 'ToastViewport.tsx');
    const statusBannerPath = path.join(WEB_DIR, 'components', 'primitives', 'StatusBanner.tsx');

    expect(fs.existsSync(toastCtxPath)).toBe(true);
    expect(fs.existsSync(toastViewportPath)).toBe(true);
    expect(fs.existsSync(statusBannerPath)).toBe(true);

    const toastViewportSrc = fs.readFileSync(toastViewportPath, 'utf8');
    expect(toastViewportSrc).toContain('popover="manual"');
    expect(toastViewportSrc).toContain('role="region"');
    expect(toastViewportSrc).toContain('aria-label="Notifications"');
    expect(toastViewportSrc).toContain('ariaNotify');
    expect(toastViewportSrc).toContain('aria-live');
    expect(toastViewportSrc).toMatch(/onMouseEnter|onFocusCapture/);
    expect(toastViewportSrc).toContain('Close');

    const globalsSrc = fs.readFileSync(path.join(WEB_DIR, 'app', 'globals.css'), 'utf8');
    expect(globalsSrc).toContain('.erp-toast-viewport');
    expect(globalsSrc).toContain('.erp-account-menu-popover');
    expect(globalsSrc).toMatch(/transition:\s*[^;]+;\s*\r?\n\s*transition-behavior:\s*allow-discrete/);
    expect(globalsSrc).toContain(':popover-open,');
    expect(globalsSrc).toContain('.\\:popover-open');
    expect(globalsSrc).toContain('@starting-style');
    expect(globalsSrc).toContain('prefers-reduced-motion');

    const appShellSrc = fs.readFileSync(path.join(WEB_DIR, 'components', 'shell', 'AppShell.tsx'), 'utf8');
    expect(appShellSrc).toContain('<ToastProvider>');
    expect(appShellSrc).toContain('<ToastViewport');

    const sqlAdminSrc = fs.readFileSync(path.join(WEB_DIR, 'app', 'admin', 'sql', 'page.tsx'), 'utf8');
    expect(sqlAdminSrc).toContain('useToast');
    expect(sqlAdminSrc).not.toMatch(/const\s*\[\s*toast\s*,\s*setToast\s*\]/);

    const scenariosSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'scenarios', 'ScenarioLabClient.tsx'),
      'utf8',
    );
    expect(scenariosSrc).toContain('runScenarioStressTest');
    expect(scenariosSrc).toContain('Monte Carlo');
    expect(scenariosSrc).toContain('Surplus Allocation Frontier');
  });

  it('enforces DESIGN.md craft rules: motion tokens, Frequency Gate on Ctrl+K, focus-visible parity, zero prose em-dashes, streamlined navigation, and compact DeficitAlert', () => {
    const designDocPath = path.join(REPO_ROOT, 'DESIGN.md');
    expect(fs.existsSync(designDocPath)).toBe(true);
    const designDoc = fs.readFileSync(designDocPath, 'utf8');
    expect(designDoc).toContain('--ease-out-quint');
    expect(designDoc).toContain('One Signal Per State');
    expect(designDoc).toContain('Frequency Gate');

    const globalsSrc = fs.readFileSync(path.join(WEB_DIR, 'app', 'globals.css'), 'utf8');
    expect(globalsSrc).toContain('--ease-out-quint');
    expect(globalsSrc).toContain(':focus-visible');
    expect(globalsSrc).toContain('transform-origin: top right');
    expect(globalsSrc).toContain(':is(:popover-open, .\\:popover-open)');

    const appShellSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'shell', 'AppShell.tsx'),
      'utf8',
    );
    expect(appShellSrc).toContain('href="#main-content"');
    expect(appShellSrc).toContain('id="main-content"');

    const sidebarSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'shell', 'Sidebar.tsx'),
      'utf8',
    );
    expect(sidebarSrc).toContain('data-testid="sidebar-collapse-toggle"');
    expect(sidebarSrc).toContain('<nav');
    expect(sidebarSrc).toContain('aria-label="Primary"');
    expect(sidebarSrc).not.toContain('Personal Workspace');
    expect(sidebarSrc).not.toContain('sub-modules`');

    const sidebarNavItemSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'primitives', 'SidebarNavItem.tsx'),
      'utf8',
    );
    expect(sidebarNavItemSrc).toContain('aria-current={isActive ? "page" : undefined}');

    const searchModalSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'shell', 'GlobalSearchModal.tsx'),
      'utf8',
    );
    expect(searchModalSrc).not.toContain('animate-in');
    expect(searchModalSrc).not.toContain('zoom-in-95');

    const deficitSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'overview', 'DeficitAlert.tsx'),
      'utf8',
    );
    expect(deficitSrc).toContain('/allocations');
    expect(deficitSrc.match(/formatRupiah\(deficitUncovered/g)?.length ?? 0).toBe(1);
    expect(deficitSrc).not.toContain('flex items-start gap-3.5');

    const overviewClientSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'overview', 'OverviewClientView.tsx'),
      'utf8',
    );
    expect(overviewClientSrc).not.toContain('Automatic recalculation enabled');

    const scenariosSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'scenarios', 'ScenarioLabClient.tsx'),
      'utf8',
    );
    expect(scenariosSrc).toContain('xl:grid-cols-3');
    expect(scenariosSrc).toContain('emergencyMonthsToTarget >= 999');

    const adminSrc = fs.readFileSync(
      path.join(WEB_DIR, 'app', 'admin', 'page.tsx'),
      'utf8',
    );
    expect(adminSrc).not.toContain('"PERMISSIVE"');
    expect(adminSrc).not.toContain('"STRICT"');

    // Enforce zero bare outline-none without focus replacement and zero prose em-dashes across app/components
    const tsxFiles = [
      ...collectFiles(path.join(WEB_DIR, 'app'), ['.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'components'), ['.tsx']),
    ];
    for (const file of tsxFiles) {
      const rel = path.relative(REPO_ROOT, file);
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          continue;
        }
        if (/outline-none|focus:outline-none|focus:outline-hidden/.test(line)) {
          const hasFocusReplacement =
            /focus-visible:ring|focus:ring|focus-visible:outline|focus-within:ring/.test(line) ||
            trimmed.includes('id="main-content"');
          expect({ file: `${rel}:${i + 1}`, bareOutlineNone: !hasFocusReplacement }).toEqual({
            file: `${rel}:${i + 1}`,
            bareOutlineNone: false,
          });
        }
        if (line.includes(' — ')) {
          expect({ file: `${rel}:${i + 1}`, hasProseEmDash: true }).toEqual({
            file: `${rel}:${i + 1}`,
            hasProseEmDash: false,
          });
        }
      }
    }

    const langSrc = fs.readFileSync(path.join(WEB_DIR, 'context', 'LanguageContext.tsx'), 'utf8');
    expect(langSrc).not.toContain(' — ');

    // SAST hygiene: zero dynamic new Function() in client utils & parameterized metadata SQL in SqlStudioService
    const webUtilsSrc = fs.readFileSync(path.join(WEB_DIR, 'lib', 'utils.ts'), 'utf8');
    expect(webUtilsSrc).not.toContain('new Function(');

    const sqlStudioSrc = fs.readFileSync(
      path.join(API_SRC_DIR, 'admin', 'sql-studio', 'sql-studio.service.ts'),
      'utf8',
    );
    expect(sqlStudioSrc).not.toContain("table_name = '${tableName}'");
    expect(sqlStudioSrc).not.toContain("ILIKE '%${s}%'");
  });

  it('replaces all native browser alerts, confirms, prompts, date inputs, and selects with bespoke ERP controls and populates Overview voids', () => {
    const webUiFiles = [
      ...collectFiles(path.join(WEB_DIR, 'app'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'components'), ['.ts', '.tsx']),
      ...collectFiles(path.join(WEB_DIR, 'context'), ['.ts', '.tsx']),
    ];

    const nativeDialogCallPattern = /(?<![A-Za-z0-9_$])(?:window\.)?(?:alert|confirm|prompt)\s*\(/;
    const rawDateInputPattern = /type=["']date["']/;

    for (const file of webUiFiles) {
      const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
          continue;
        }
        expect({
          file: `${rel}:${i + 1}`,
          hasNativeBrowserPopup: nativeDialogCallPattern.test(line),
        }).toEqual({
          file: `${rel}:${i + 1}`,
          hasNativeBrowserPopup: false,
        });
        expect({
          file: `${rel}:${i + 1}`,
          hasRawDateInput: rawDateInputPattern.test(line),
        }).toEqual({
          file: `${rel}:${i + 1}`,
          hasRawDateInput: false,
        });
      }
    }

    const confirmCtxPath = path.join(WEB_DIR, 'context', 'ConfirmDialogContext.tsx');
    const confirmHostPath = path.join(WEB_DIR, 'components', 'primitives', 'ConfirmDialogHost.tsx');
    const datePickerPath = path.join(WEB_DIR, 'components', 'primitives', 'ErpDatePicker.tsx');

    expect(fs.existsSync(confirmCtxPath)).toBe(true);
    expect(fs.existsSync(confirmHostPath)).toBe(true);
    expect(fs.existsSync(datePickerPath)).toBe(true);

    const confirmHostSrc = fs.readFileSync(confirmHostPath, 'utf8');
    expect(confirmHostSrc).toContain('<dialog');
    expect(confirmHostSrc).toContain('showModal()');
    expect(confirmHostSrc).toContain('method="dialog"');
    expect(confirmHostSrc).toContain('returnValue = ""');
    expect(confirmHostSrc).not.toContain('role="dialog"');
    expect(confirmHostSrc).not.toContain('aria-modal');
    expect(confirmHostSrc).toContain('autoFocus');

    const datePickerSrc = fs.readFileSync(datePickerPath, 'utf8');
    expect(datePickerSrc).toContain('popover="auto"');
    expect(datePickerSrc).not.toMatch(/type=["']date["']/);

    const globalsSrc = fs.readFileSync(path.join(WEB_DIR, 'app', 'globals.css'), 'utf8');
    expect(globalsSrc).toContain('@supports (appearance: base-select)');
    expect(globalsSrc).toContain('appearance: base-select');
    expect(globalsSrc).toContain('::picker(select)');
    expect(globalsSrc).toContain('dialog:modal');
    expect(globalsSrc).toContain('overscroll-behavior: contain');
    expect(globalsSrc).toContain('dialog::backdrop');
    expect(globalsSrc).toContain('overflow: hidden');
    expect(globalsSrc).toContain('inset: 3.75rem 1.25rem auto auto');

    const utilsSrc = fs.readFileSync(path.join(WEB_DIR, 'lib', 'utils.ts'), 'utf8');
    const landingFn = utilsSrc.slice(
      utilsSrc.indexOf('export function resolveInstrumentLandingPeriodClient'),
      utilsSrc.indexOf('const JAKARTA_DATE_FORMATTER'),
    );
    expect(landingFn).not.toContain('"JAN"');
    expect(landingFn).not.toContain('"DEC"');
    expect(landingFn).toContain('"Dec"');

    const monthSwitcherSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'shell', 'MonthYearSwitcher.tsx'),
      'utf8',
    );
    expect(monthSwitcherSrc).not.toContain('>MONTH<');
    expect(monthSwitcherSrc).not.toContain('>YEAR<');

    const localeSwitcherSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'shell', 'LanguageSwitcher.tsx'),
      'utf8',
    );
    expect(localeSwitcherSrc).toContain('popover="auto"');
    expect(localeSwitcherSrc).toContain('id="locale-menu-trigger"');

    const pacingCardSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'overview', 'AdaptiveDailyPacingCard.tsx'),
      'utf8',
    );
    expect(pacingCardSrc).toContain('data-testid="cycle-pace-breakdown"');
    expect(pacingCardSrc).toContain('avgDailyBurn');
    expect(pacingCardSrc).toContain('cycleUsedPct');
    expect(pacingCardSrc).toContain('cycleElapsedPct');
    expect(pacingCardSrc).toContain('overview.cycleBudgetUsed');
    expect(pacingCardSrc).toContain('overview.spentLabel');
    expect(pacingCardSrc).toContain('overview.perDay');
    expect(pacingCardSrc).toContain('overview.baselineLabel');
    expect(pacingCardSrc).toContain('flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5');
    expect(pacingCardSrc).toContain('pr-2 min-w-0 overflow-hidden');
    expect(pacingCardSrc).not.toContain('overview.spentToday');
    expect(pacingCardSrc).not.toContain('<span>Spent:</span>');
    expect(pacingCardSrc).not.toContain('>/day<');
    expect(pacingCardSrc).not.toContain('0)} baseline');
    expect(pacingCardSrc).not.toContain('SPIKE (');
    expect(pacingCardSrc).not.toContain('"NORMAL"');
    expect(pacingCardSrc).not.toContain('"CORRECTION"');

    const routineCardSrc = fs.readFileSync(
      path.join(WEB_DIR, 'components', 'overview', 'RoutineBillsQuotaCard.tsx'),
      'utf8',
    );
    expect(routineCardSrc).toContain('data-testid="cycle-allocation-mix"');
  });
});
