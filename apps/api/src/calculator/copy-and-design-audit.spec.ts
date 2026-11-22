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

  it('purges "Reservoir/Reservoirs" and "Amortization & Payoff Progress Lanes" in favor of human everyday terms (EN/ID/ZH)', () => {
    const langCtx = fs.readFileSync(langCtxPath, 'utf8');

    expect(langCtx).toContain('"nav.savings": "Savings & Vaults"');
    expect(langCtx).toContain('"nav.savings": "Tabungan & Brankas"');
    expect(langCtx).toContain('"nav.savings": "储蓄与金库"');
    expect(langCtx).not.toMatch(/Reservoirs?/);
    expect(langCtx).not.toMatch(/Burn-Rate Telemetry/);
    expect(langCtx).not.toMatch(/Sinking Fund Amortization/);

    const debtTimeline = fs.readFileSync(debtTimelinePath, 'utf8');
    expect(debtTimeline).toContain('Active Installment Plans');
    expect(debtTimeline).not.toContain('Amortization & Payoff Progress Lanes');
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
});
