import * as fs from "node:fs";
import * as path from "node:path";
import puppeteer from "puppeteer-core";

type Edition = "gabriel" | "standard";
type GuideLang = "id" | "en";

interface TocEntry {
  num: string;
  title: string;
  desc: string;
  page: number;
}

interface GuideBookSpec {
  filename: string;
  edition: Edition;
  lang: GuideLang;
  eyebrow: string;
  title: string;
  subtitle: string;
  editionBadge: string;
  audienceLabel: string;
  versionLabel: string;
  sheetsHtml: string[];
}

const BRAND_MARK_SVG = `
<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="1.5" y="1.5" width="21" height="21" rx="4.5" fill="#11141c" stroke="#282e3d" stroke-width="1.25" />
  <polygon points="6,6.5 18,6.5 15.5,9.5 6,9.5" fill="#f3f4f6" />
  <polygon points="8.5,10.75 18,10.75 15.5,13.75 6,13.75" fill="#10b78d" />
  <polygon points="6,15 15.5,15 13,18 6,18" fill="#9ca3af" />
</svg>`;

function resolveChromeExecutable(): string {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("No Chrome or Edge executable found for PDF rendering.");
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSheet(
  lang: GuideLang,
  runningTitle: string,
  chapterTag: string,
  pageNum: number,
  totalPages: number,
  bodyHtml: string,
): string {
  const pageWord = lang === "id" ? `Halaman ${pageNum} dari ${totalPages}` : `Page ${pageNum} of ${totalPages}`;
  return `
  <section class="sheet">
    <header class="sheet-header">
      <div class="sheet-brand">
        <span class="sheet-logo">${BRAND_MARK_SVG}</span>
        <span class="sheet-brand-name">Sunday Funday ERP</span>
        <span class="sep">/</span>
        <span class="sheet-running">${escapeHtml(runningTitle)}</span>
      </div>
      <span class="tag-pill">${escapeHtml(chapterTag)}</span>
    </header>
    <div class="sheet-body">
      ${bodyHtml}
    </div>
    <footer class="sheet-footer">
      <span>Sunday Funday ERP · ${escapeHtml(runningTitle)}</span>
      <span class="mono">${pageWord}</span>
    </footer>
  </section>`;
}

function renderWaterfallSvg(lang: GuideLang): string {
  const t =
    lang === "id"
      ? {
          income: "Total Pemasukan Bersih",
          incomeSub: "Gaji + Tunjangan / Extra",
          stage1: "1. Kewajiban & Pos Wajib Dulu",
          debt: "Tagihan Utang Jatuh Tempo",
          debtSub: "PayLater, Kartu Kredit, Pinjaman",
          routine: "Pos Rutin & Kuota Tetap",
          routineSub: "Transport, Internet, Langganan",
          living: "2. Dana Hidup Harian",
          livingSub: "Belanja makan, kopi, harian",
          rem: "Sisa Dana Bebas (Disposable)",
          remSub: "Diteruskan ke 2 Prioritas",
          p1: "Prioritas 1: Core Savings",
          p1Sub: "Mengisi target tabungan utama dulu",
          p2: "Prioritas 2: Surplus & Buffer",
          p2Sub: "Flexible Surplus & Emergency Buffer",
          shortfall: "Jika Pemasukan Kurang: Prioritas 1 & 2 otomatis Rp 0 agar Dana Hidup Harian tetap positif semaksimal mungkin.",
        }
      : {
          income: "Final Net Income",
          incomeSub: "Take-home pay + Extra inflows",
          stage1: "1. Upfront Obligations & Quotas",
          debt: "Maturing Debt & Bills",
          debtSub: "PayLater, Credit Cards, Loans",
          routine: "Fixed Routine Envelopes",
          routineSub: "Transport, Internet, Subscriptions",
          living: "2. Daily Living Cash Pool",
          livingSub: "Food, coffee, day-to-day spend",
          rem: "Remaining Disposable Pool",
          remSub: "Flows down to 2 Priorities",
          p1: "Priority 1: Core Savings",
          p1Sub: "Fills main savings reserve up to target",
          p2: "Priority 2: Surplus & Buffer",
          p2Sub: "Flexible Surplus + Emergency Buffer",
          shortfall: "On Income Shortfall: Priority 1 & 2 automatically drop to Rp 0 so Daily Living Cash stays positive first.",
        };

  return `
  <div class="diagram-box">
    <svg viewBox="0 0 680 184" width="100%" height="184" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="142" height="58" rx="6" fill="#161922" stroke="#10b78d" stroke-width="1.2"/>
      <text x="16" y="29" fill="#10b78d" font-family="Inter,sans-serif" font-size="10" font-weight="600">${t.income}</text>
      <text x="16" y="45" fill="#9ca3af" font-family="Inter,sans-serif" font-size="8.6">${t.incomeSub}</text>
      <path d="M150 37 L170 37" stroke="#384054" stroke-width="1.5" marker-end="url(#arrowGray)"/>

      <rect x="172" y="4" width="298" height="108" rx="6" fill="#11141c" stroke="#282e3d" stroke-width="1"/>
      <text x="182" y="21" fill="#e59b2c" font-family="Inter,sans-serif" font-size="9.5" font-weight="600">${t.stage1}</text>
      <rect x="182" y="28" width="136" height="36" rx="4" fill="#161922" stroke="#282e3d"/>
      <text x="190" y="43" fill="#f3f4f6" font-family="Inter,sans-serif" font-size="9" font-weight="600">${t.debt}</text>
      <text x="190" y="56" fill="#9ca3af" font-family="Inter,sans-serif" font-size="7.8">${t.debtSub}</text>

      <rect x="326" y="28" width="136" height="36" rx="4" fill="#161922" stroke="#282e3d"/>
      <text x="334" y="43" fill="#f3f4f6" font-family="Inter,sans-serif" font-size="9" font-weight="600">${t.routine}</text>
      <text x="334" y="56" fill="#9ca3af" font-family="Inter,sans-serif" font-size="7.8">${t.routineSub}</text>

      <rect x="182" y="70" width="280" height="34" rx="4" fill="#161922" stroke="#e59b2c" stroke-opacity="0.6"/>
      <text x="191" y="85" fill="#f3f4f6" font-family="Inter,sans-serif" font-size="9.5" font-weight="600">${t.living}</text>
      <text x="191" y="97" fill="#9ca3af" font-family="Inter,sans-serif" font-size="8">${t.livingSub}</text>

      <path d="M470 58 L492 58" stroke="#10b78d" stroke-width="1.5" marker-end="url(#arrowGreen)"/>

      <rect x="494" y="6" width="178" height="48" rx="6" fill="#161922" stroke="#10b78d" stroke-width="1.2"/>
      <text x="504" y="25" fill="#10b78d" font-family="Inter,sans-serif" font-size="10" font-weight="600">${t.p1}</text>
      <text x="504" y="40" fill="#9ca3af" font-family="Inter,sans-serif" font-size="8.2">${t.p1Sub}</text>

      <path d="M583 54 L583 66" stroke="#384054" stroke-width="1.3"/>
      <rect x="494" y="68" width="178" height="44" rx="6" fill="#161922" stroke="#38bdf8" stroke-opacity="0.7"/>
      <text x="504" y="86" fill="#38bdf8" font-family="Inter,sans-serif" font-size="10" font-weight="600">${t.p2}</text>
      <text x="504" y="100" fill="#9ca3af" font-family="Inter,sans-serif" font-size="8.2">${t.p2Sub}</text>

      <rect x="8" y="128" width="664" height="42" rx="5" fill="#161922" stroke="#282e3d"/>
      <line x1="8" y1="128" x2="8" y2="170" stroke="#e59b2c" stroke-width="3"/>
      <text x="22" y="146" fill="#f3f4f6" font-family="Inter,sans-serif" font-size="9.5" font-weight="600">${t.rem}: ${t.remSub}</text>
      <text x="22" y="160" fill="#9ca3af" font-family="Inter,sans-serif" font-size="8.8">${t.shortfall}</text>

      <defs>
        <marker id="arrowGray" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#384054"/>
        </marker>
        <marker id="arrowGreen" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#10b78d"/>
        </marker>
      </defs>
    </svg>
  </div>`;
}

function renderWalletSyncDiagramSvg(lang: GuideLang): string {
  const t =
    lang === "id"
      ? {
          s1t: "1. Cek Saldo Riil",
          s1b: "Buka m-Banking / e-wallet",
          s1c: "Tanpa catat kopi harian",
          s2t: "2. Isi Kolom 'Cash Rp'",
          s2b: "Pilih mode Total Bank /",
          s2c: "Living Cash sesuai saldo",
          s3t: "3. Klik 'Guard' / 'Sync'",
          s3b: "Guard: cek aman saja",
          s3c: "Sync: catat selisih saldo",
          s4t: "4. Semua Angka Sinkron",
          s4b: "Cycle Budget Used & Burn",
          s4c: "serta Audit otomatis update",
        }
      : {
          s1t: "1. Check Real Wallet",
          s1b: "Open bank / e-wallet total",
          s1c: "Skip logging daily coffees",
          s2t: "2. Enter 'Cash Rp'",
          s2b: "Pick Total Bank or Living",
          s2c: "Cash Only to match balance",
          s3t: "3. Click 'Guard' / 'Sync'",
          s3b: "Guard: inspect safety only",
          s3c: "Sync: logs unrecorded gap",
          s4t: "4. Cockpit Auto-Updates",
          s4b: "Cycle Budget Used & Daily Burn",
          s4c: "& Safe-to-Spend recalculate clean",
        };

  return `
  <div class="diagram-box">
    <svg viewBox="0 0 680 96" width="100%" height="96" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="10" width="146" height="74" rx="6" fill="#161922" stroke="#282e3d"/>
      <text x="15" y="30" fill="#10b78d" font-family="Inter,sans-serif" font-size="9.6" font-weight="600">${t.s1t}</text>
      <text x="15" y="47" fill="#f3f4f6" font-family="Inter,sans-serif" font-size="8.3">${t.s1b}</text>
      <text x="15" y="62" fill="#9ca3af" font-family="Inter,sans-serif" font-size="8.1">${t.s1c}</text>
      <path d="M152 47 L164 47" stroke="#384054" stroke-width="1.5"/>

      <rect x="166" y="10" width="152" height="74" rx="6" fill="#161922" stroke="#282e3d"/>
      <text x="175" y="30" fill="#10b78d" font-family="Inter,sans-serif" font-size="9.6" font-weight="600">${t.s2t}</text>
      <text x="175" y="47" fill="#f3f4f6" font-family="Inter,sans-serif" font-size="8.3">${t.s2b}</text>
      <text x="175" y="62" fill="#9ca3af" font-family="Inter,sans-serif" font-size="8.1">${t.s2c}</text>
      <path d="M318 47 L330 47" stroke="#384054" stroke-width="1.5"/>

      <rect x="332" y="10" width="152" height="74" rx="6" fill="#161922" stroke="#e59b2c" stroke-opacity="0.7"/>
      <text x="341" y="30" fill="#e59b2c" font-family="Inter,sans-serif" font-size="9.6" font-weight="600">${t.s3t}</text>
      <text x="341" y="47" fill="#f3f4f6" font-family="Inter,sans-serif" font-size="8.3">${t.s3b}</text>
      <text x="341" y="62" fill="#9ca3af" font-family="Inter,sans-serif" font-size="8.1">${t.s3c}</text>
      <path d="M484 47 L496 47" stroke="#10b78d" stroke-width="1.5"/>

      <rect x="498" y="10" width="176" height="74" rx="6" fill="#12352c" stroke="#10b78d" stroke-opacity="0.65"/>
      <text x="508" y="30" fill="#ecfdf5" font-family="Inter,sans-serif" font-size="9.6" font-weight="600">${t.s4t}</text>
      <text x="508" y="47" fill="#f3f4f6" font-family="Inter,sans-serif" font-size="8.2">${t.s4b}</text>
      <text x="508" y="62" fill="#d1fae5" font-family="Inter,sans-serif" font-size="8.1">${t.s4c}</text>
    </svg>
  </div>`;
}

function renderCutoffDiagramSvg(lang: GuideLang, edition: Edition): string {
  const isG = edition === "gabriel";
  const t =
    lang === "id"
      ? {
          hdr: isG
            ? "Contoh Siklus Nov 2026 (28 Okt s.d. 26 Nov 2026) -> Membayar Tagihan Bulan Nov 2026"
            : "Konvensi Periode M: Gajian Akhir Bulan M-1 -> Sehari Sebelum Gajian Bulan M",
          pLeft: isG ? "Payday 28 Okt (M-1)" : "Gajian Bulan M-1",
          pMid: "Masa Konsumsi & Hidup Harian Periode M",
          pRight: isG ? "26 Nov (Sebelum Gajian Des)" : "H-1 Gajian Bulan M",
          c1Title: "PayLater (Cutoff Dinamis M-15d)",
          c1L1: "Tgl <= 15/16 -> Tagih bulan M+1 (Tempo tgl 25).",
          c1L2: "Tgl > 15/16 atau centang +1 cycle -> Geser ke M+2.",
          c2Title: isG ? "Kartu Kredit Permata (Cutoff tgl 25)" : "Kartu Kredit (Cutoff Tagihan Konfigurasi)",
          c2L1: isG
            ? "Transaksi <= 25 -> M+1 (Tempo 11, Jumat jika libur)."
            : "Transaksi <= tanggal cutoff masuk tagihan siklus M+1.",
          c2L2: isG
            ? "Transaksi > tgl 25 -> Masuk tagihan siklus M+2."
            : "Transaksi lewat cutoff otomatis geser ke siklus M+2.",
        }
      : {
          hdr: isG
            ? "Example: Nov 2026 Cycle (28 Oct to 26 Nov 2026) -> Pays Bills Maturing in Nov 2026"
            : "Period M Convention: Payday(M-1) through Day Before Payday(M) Pays Month M Bills",
          pLeft: isG ? "28 Oct Payday (M-1)" : "Payday(M-1)",
          pMid: "Period M Daily Living & Bill Settlement Window",
          pRight: isG ? "26 Nov (H-1 Next Payday)" : "Day before Payday(M)",
          c1Title: "PayLater (Dynamic Cutoff M-15d)",
          c1L1: "Day <= 15/16th -> Bills in M+1 (Due on the 25th).",
          c1L2: "After cutoff or +1 cycle -> Rolls to M+2 bill.",
          c2Title: isG ? "Permata Credit Card (25th Cutoff)" : "Credit Card (Configurable Statement Cutoff)",
          c2L1: isG
            ? "Day <= 25th -> M+1 (Due 11th, Friday if weekend)."
            : "Purchases <= cutoff bill inside cycle M+1.",
          c2L2: isG
            ? "Day > 25th -> Rolls forward into cycle M+2 bill."
            : "Post-cutoff purchases roll automatically into M+2.",
        };

  return `
  <div class="diagram-box">
    <svg viewBox="0 0 680 144" width="100%" height="144" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="664" height="50" rx="6" fill="#161922" stroke="#282e3d"/>
      <text x="18" y="25" fill="#10b78d" font-family="Inter,sans-serif" font-size="9.5" font-weight="600">${t.hdr}</text>
      <rect x="18" y="34" width="142" height="18" rx="3" fill="#12352c" stroke="#10b78d" stroke-opacity="0.5"/>
      <text x="25" y="46" fill="#ecfdf5" font-family="JetBrains Mono,monospace" font-size="8.2">${t.pLeft}</text>
      <rect x="166" y="34" width="342" height="18" rx="3" fill="#1d222e" stroke="#384054"/>
      <text x="220" y="46" fill="#f3f4f6" font-family="Inter,sans-serif" font-size="8.5">${t.pMid}</text>
      <rect x="514" y="34" width="148" height="18" rx="3" fill="#11141c" stroke="#e59b2c" stroke-opacity="0.6"/>
      <text x="521" y="46" fill="#e59b2c" font-family="JetBrains Mono,monospace" font-size="8.2">${t.pRight}</text>

      <rect x="8" y="68" width="326" height="66" rx="6" fill="#161922" stroke="#282e3d"/>
      <text x="18" y="87" fill="#38bdf8" font-family="Inter,sans-serif" font-size="10" font-weight="600">${t.c1Title}</text>
      <text x="18" y="104" fill="#9ca3af" font-family="Inter,sans-serif" font-size="8.4">${t.c1L1}</text>
      <text x="18" y="118" fill="#9ca3af" font-family="Inter,sans-serif" font-size="8.4">${t.c1L2}</text>

      <rect x="346" y="68" width="326" height="66" rx="6" fill="#161922" stroke="#282e3d"/>
      <text x="356" y="87" fill="#e59b2c" font-family="Inter,sans-serif" font-size="10" font-weight="600">${t.c2Title}</text>
      <text x="356" y="104" fill="#9ca3af" font-family="Inter,sans-serif" font-size="8.4">${t.c2L1}</text>
      <text x="356" y="118" fill="#9ca3af" font-family="Inter,sans-serif" font-size="8.4">${t.c2L2}</text>
    </svg>
  </div>`;
}

function renderTocHtml(lang: GuideLang, items: TocEntry[], introTitle: string, introBody: string): string {
  const heading = lang === "id" ? "Daftar Isi & Cara Pakai Cepat" : "Table of Contents & Fast Orientation";
  const sub =
    lang === "id"
      ? "Seluruh modul, tombol, dan angka yang tersedia di sistem Anda, dijelaskan secara runtut."
      : "Complete coverage of every workspace route, card metric, action button, and formula.";
  const rows = items
    .map(
      (item) => `
      <div class="toc-row">
        <div class="toc-left">
          <span class="toc-num mono">${item.num}</span>
          <div>
            <div class="toc-title">${escapeHtml(item.title)}</div>
            <div class="toc-desc">${escapeHtml(item.desc)}</div>
          </div>
        </div>
        <span class="toc-page mono">p.${item.page}</span>
      </div>`,
    )
    .join("");

  return `
    <h2 class="chapter-title">${escapeHtml(heading)}</h2>
    <p class="chapter-sub">${escapeHtml(sub)}</p>
    <div class="callout emerald">
      <div class="callout-title">${escapeHtml(introTitle)}</div>
      <p>${escapeHtml(introBody)}</p>
    </div>
    <div class="toc-grid">${rows}</div>
  `;
}

function buildCoverSheet(spec: GuideBookSpec): string {
  const pillars =
    spec.lang === "id"
      ? [
          ["Siklus Payday-ke-Payday", "Uang gaji dikawal penuh dari tanggal cair hingga H-1 gajian berikutnya."],
          ["Zero-Friction Wallet Sync", "Tidak wajib catat transaksi kecil harian; samakan saldo real kapan saja dalam 10 detik."],
          ["Angka Deterministik (Go + TS)", "Semua kuota, cutoff tagihan, dan simulasi utang dihitung dari satu sumber kebenaran."],
        ]
      : [
          ["Payday-to-Payday Horizon", "Every cycle tracks cashflow from actual payday through the day before the next payday."],
          ["Zero-Friction Wallet Sync", "No manual entry needed for small daily buys; sync real wallet balance in 10 seconds."],
          ["Deterministic Ledger Math", "All allocations, cutoffs, and debt schedules come from one verified calculation engine."],
        ];

  return `
  <section class="sheet cover-sheet">
    <div class="cover-top">
      <div class="cover-brand">
        <div class="cover-logo">${BRAND_MARK_SVG}</div>
        <div>
          <div class="cover-brand-name">Sunday Funday</div>
          <div class="cover-brand-sub">Personal Finance ERP · Knowledge Base</div>
        </div>
      </div>
      <span class="badge emerald">${escapeHtml(spec.editionBadge)}</span>
    </div>

    <div class="cover-hero">
      <div class="eyebrow mono">${escapeHtml(spec.eyebrow)}</div>
      <h1 class="cover-title">${escapeHtml(spec.title)}</h1>
      <p class="cover-subtitle">${escapeHtml(spec.subtitle)}</p>

      <div class="cover-meta-grid">
        <div class="meta-card">
          <span class="meta-k">${spec.lang === "id" ? "Target Pengguna" : "Target Workspace"}</span>
          <span class="meta-v">${escapeHtml(spec.audienceLabel)}</span>
        </div>
        <div class="meta-card">
          <span class="meta-k">${spec.lang === "id" ? "Bahasa & Versi" : "Language & Edition"}</span>
          <span class="meta-v mono">${escapeHtml(spec.versionLabel)}</span>
        </div>
        <div class="meta-card">
          <span class="meta-k">${spec.lang === "id" ? "Desain & Cakupan" : "Coverage"}</span>
          <span class="meta-v">${spec.lang === "id" ? "Panduan End-to-End Lengkap" : "Full End-to-End Manual"}</span>
        </div>
      </div>
    </div>

    <div class="cover-pillars">
      ${pillars
        .map(
          ([t, b]) => `
        <div class="pillar-card">
          <div class="pillar-title">${escapeHtml(t)}</div>
          <div class="pillar-body">${escapeHtml(b)}</div>
        </div>`,
        )
        .join("")}
    </div>

    <div class="cover-bottom">
      <span>sundayfunday-erp.vercel.app</span>
      <span class="mono">Obsidian-Slate Manual · Newsreader + Inter + JetBrains Mono</span>
    </div>
  </section>`;
}

function buildGabrielPages(lang: GuideLang): GuideBookSpec {
  const isId = lang === "id";
  const runningTitle = isId ? "Panduan Lengkap (Gabriel + Superadmin)" : "Complete User Manual (Gabriel + Superadmin)";

  const toc: TocEntry[] = isId
    ? [
        { num: "01", title: "Cara Pakai Anti-Ribet & Konsep Waterfall", desc: "Payday cycle, Flexible Surplus, Emergency Buffer, Shortfall", page: 3 },
        { num: "02", title: "Login, PIN, Password & Navigasi Global", desc: "Auth flow, Privacy Alt+H di Sidebar, Header, Ctrl+K", page: 4 },
        { num: "03", title: "Overview Kolom 1: Safe-to-Spend & Wallet Sync", desc: "Cycle Budget Used, Avg Burn, Expected Bank vs Cash Rp", page: 5 },
        { num: "04", title: "Overview Kolom 2, Kolom 3 & Panel Bawah", desc: "Routine Bills, Mix 4 Pos, Record Expense, Checklist", page: 6 },
        { num: "05", title: "Payday Wizard, Cash Radar & Payroll", desc: "Ritual gajian, penutupan siklus, THR Prorated & Work-Hours", page: 7 },
        { num: "06", title: "Monthly Plan & Statement Import", desc: "Simulasi kuota, Rollover amplop, impor mutasi anti-duplikat", page: 8 },
        { num: "07", title: "Installments & Bills (Hukum Cutoff & Matrix)", desc: "SPayLater M-15d, Permata CC 25th, 12-Month Matrix & Optimizer", page: 9 },
        { num: "08", title: "Savings & Emergency Fund + Scenario Lab", desc: "Milestone dana darurat, Net Worth, Go Monte Carlo Stress Test", page: 10 },
        { num: "09", title: "Analytics, Financial Reports & Subscriptions", desc: "Audit disiplin, Ekspor Excel/PDF, Email, Promo Kill-Switch", page: 11 },
        { num: "10", title: "Marquee AI Co-Pilot, Ctrl+K & Preferences 6-Tab", desc: "Stage-Commit aman, Memory, Formula DSL, SMTP, BYOK AES-256", page: 12 },
        { num: "11", title: "Superadmin Console & SQL Query Studio", desc: "Buat akun user + temp password, Audit Log, Safe SQL Browser", page: 13 },
        { num: "12", title: "Playbook Rutin, Glosarium Istilah & Shortcuts", desc: "Jadwal pakai 2 menit/minggu dan kamus semua istilah ERP", page: 14 },
      ]
    : [
        { num: "01", title: "Two-Minute Habit & Waterfall Philosophy", desc: "Payday cycle, Flexible Surplus, Emergency Buffer, Shortfall", page: 3 },
        { num: "02", title: "Auth, 6-Digit PIN, Privacy & Global Shell", desc: "Sign-in flow, Alt+H Sidebar privacy toggle, Header, Ctrl+K", page: 4 },
        { num: "03", title: "Overview Col 1: Safe-to-Spend & Wallet Sync", desc: "Cycle Budget Used, Avg Burn, Guard vs Sync reconciliation", page: 5 },
        { num: "04", title: "Overview Col 2, Col 3 & Activity Tables", desc: "Routine Bills, Allocation Mix, Record Expense, Settlement List", page: 6 },
        { num: "05", title: "Payday Wizard, Cash Radar & Payroll", desc: "Payday ritual, cycle lock, THR engine, True Hourly Wage", page: 7 },
        { num: "06", title: "Monthly Plan & Statement Import", desc: "Quota simulator, envelope rollover, lock-safe bulk reconciler", page: 8 },
        { num: "07", title: "Installments & Bills (Cutoff Law & Matrix)", desc: "SPayLater M-15d, Permata CC 25th, 12-Month Matrix & Optimizer", page: 9 },
        { num: "08", title: "Savings & Emergency Fund + Scenario Lab", desc: "Emergency milestones, Net Worth, Go Monte Carlo stress testing", page: 10 },
        { num: "09", title: "Analytics, Financial Reports & Subscriptions", desc: "Discipline audit, Excel/PDF exports, Email & Promo Kill-Switch", page: 11 },
        { num: "10", title: "Marquee AI Co-Pilot, Ctrl+K & Preferences", desc: "Stage-Commit confirmation, syntax shortcuts, Formula DSL & SMTP", page: 12 },
        { num: "11", title: "Superadmin Console & SQL Query Studio", desc: "User provisioning + temp password, IP whitelist, SQL Studio", page: 13 },
        { num: "12", title: "Practical Playbook, Glossary & Shortcuts", desc: "2-minute weekly routine and plain definitions for every term", page: 14 },
      ];

  const sheets: string[] = [];

  // Sheet 2: TOC
  sheets.push(
    renderTocHtml(
      lang,
      toc,
      isId ? "Kunci Utama: Anda Tidak Perlu Input Kopi Setiap Hari" : "Core Takeaway: You Never Need to Log Every Daily Coffee",
      isId
        ? "Banyak aplikasi keuangan gagal dipakai karena memaksa input tiap kali jajan Rp 25.000. Di Sunday Funday, pengeluaran besar/cicilan/tagihan cukup dicatat sekali (atau diimpor). Untuk jajan harian, cukup buka bank Anda 2-3 hari sekali, ketik total saldo ke Wallet Reconciliation, lalu klik Sync. Sistem otomatis menghitung belanja tak tercatat, memperbarui Cycle Budget Used, dan menjaga Safe-to-Spend tetap akurat."
        : "Personal finance tools fail when they demand manual entry for every small coffee. In Sunday Funday, log bills and installments once, and handle everyday cash with 10-second Wallet Reconciliation: enter your current bank/e-wallet total every few days and hit Sync. The engine computes the unrecorded gap, updates Cycle Budget Used, and recalibrates Safe-to-Spend automatically.",
    ),
  );

  // Sheet 3: Core Financial Philosophy & Waterfall Diagram
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">01 · Filosofi Waterfall & Arti Setiap Pos Anggaran</h2>
      <p class="chapter-sub">Bagaimana setiap rupiah gaji Anda dibagi berurutan sebelum boleh dipakai jajan.</p>
      ${renderWaterfallSvg("id")}
      <div class="two-col">
        <div class="card">
          <h3>Core Savings (Tabungan Inti)</h3>
          <p>Target tabungan wajib bulan ini yang tidak boleh diganggu untuk jajan biasa. Diisi terlebih dahulu setelah seluruh kewajiban utang, tagihan rutin, dan dana hidup harian aman terpenuhi.</p>
        </div>
        <div class="card">
          <h3>Flexible Surplus (Surplus Fleksibel / Dana Bebas)</h3>
          <p>Uang sisa <strong>bersih setelah seluruh utang lunas, pos rutin aman, dana hidup cukup, dan Core Savings terpenuhi</strong>. Misalnya di gambar Anda tertera <span class="mono">Rp 250.000</span>: ini dana fleksibel halal untuk self-reward, hobi, ekstra jajan akhir pekan, atau dipindah manual ke tabungan ekstra saat tutup periode.</p>
        </div>
        <div class="card">
          <h3>Emergency Buffer (Penyangga Darurat)</h3>
          <p>Bantalan pengaman khusus di dalam siklus aktif (terpisah dari Dana Darurat jangka panjang) agar lonjakan biaya mendadak seperti servis motor atau obat tidak langsung merusak alokasi hidup harian.</p>
        </div>
        <div class="card">
          <h3>Temporary Savings Advance & Budget Shortfall</h3>
          <p><strong>Temporary Savings Advance:</strong> Pinjaman sementara dari kantong tabungan saat kas siklus kurang, dengan pengingat jadwal pengembalian. <strong>Budget Shortfall:</strong> Selisih saat total target melebihi gaji. Sistem menerapkan <em>Proportional Living Cash Law</em>: Core Savings & Flexible Surplus otomatis turun ke Rp 0 terlebih dahulu agar uang makan harian tetap positif.</p>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">01 · Paycycle Law & Two-Priority Waterfall</h2>
      <p class="chapter-sub">How every cycle paycheck flows through fixed obligations before funding savings and discretionary surplus.</p>
      ${renderWaterfallSvg("en")}
      <div class="two-col">
        <div class="card">
          <h3>Core Savings</h3>
          <p>Your primary monthly savings commitment protected from daily spending. Funded first once maturing debt bills, routine quotas, and Daily Living Cash are reserved.</p>
        </div>
        <div class="card">
          <h3>Flexible Surplus (e.g. Rp 250.000)</h3>
          <p>True leftover cash remaining <strong>only after debt, routine bills, daily living budget, and Core Savings target are 100% covered</strong>. You can spend it guilt-free on self-reward, hobbies, weekend outings, or sweep it into long-term savings when closing the period.</p>
        </div>
        <div class="card">
          <h3>Emergency Buffer</h3>
          <p>An active-cycle shock absorber (separate from your long-term Emergency Fund pockets) that absorbs small unexpected bills without instantly shrinking daily food allowances.</p>
        </div>
        <div class="card">
          <h3>Temporary Savings Advance & Budget Shortfall</h3>
          <p><strong>Temporary Savings Advance:</strong> Cash temporarily borrowed from your own savings pockets when cashflow dips, tracked for repayment. <strong>Budget Shortfall:</strong> Occurs when planned targets exceed paycheck inflow; Core Savings and Flexible Surplus compress to Rp 0 first so Daily Living Cash stays funded proportionally.</p>
        </div>
      </div>`,
  );

  // Sheet 4: Auth, Security, Privacy & Shell
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">02 · Login, Keamanan PIN, Privasi & Navigasi Global</h2>
      <p class="chapter-sub">Arsitektur login multi-tenant aman dan kontrol global yang selalu menemani di header dan sidebar.</p>
      <div class="two-col">
        <div class="card">
          <h3>Alur Login End-to-End</h3>
          <ul>
            <li><strong>/login:</strong> Masukkan username (mis. akun utama Anda atau akun <code>superadmin</code> terpisah) atau email beserta kata sandi (hash <code>scrypt</code> + rate limiter anti brute-force).</li>
            <li><strong>Verifikasi PIN 6-Digit:</strong> Jika akun memakai PIN keamanan, layar otomatis meminta 6 digit PIN. Centang <strong>Remember this network IP</strong> (dan opsional <em>Device Label</em>) agar jaringan rumah tidak terus diminta ulang.</li>
            <li><strong>Force Password Change:</strong> Akun baru buatan Superadmin memakai kata sandi sementara dan wajib membuat kata sandi pribadi 2x pada login pertama sebelum masuk workspace.</li>
            <li><strong>Forgot & Reset Password:</strong> Tautan pemulihan sekali pakai dikirim ke email terdaftar lewat <code>/forgot-password</code>.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Navbar Atas & Kontrol Privasi Sidebar</h3>
          <ul>
            <li><strong>Breadcrumb & Search (Ctrl+K):</strong> Menampilkan lokasi halaman aktif dan membuka Command Search untuk mencari transaksi atau menjalankan perintah cepat.</li>
            <li><strong>Period Switcher (&lt; Nov 2026 &gt;):</strong> Berpindah bulan siklus gaji atau klik <em>Initialize New Period</em> untuk menyiapkan bulan draft baru.</li>
            <li><strong>Locale Popover (EN / ID / 中文):</strong> Mengganti bahasa seluruh antarmuka seketika tanpa kehilangan konteks halaman.</li>
            <li><strong>Menu Akun Monogram (G):</strong> Buka <em>Profile Settings</em> atau <em>Sign Out</em> bersih yang langsung mencabut sesi aktif.</li>
            <li><strong>Tombol Privasi Global (Sidebar Bawah + Alt+H):</strong> Menyembunyikan/membuka angka Rupiah (<code>Rp •••••</code>). Membuka angka pertama kali di tab baru wajib verifikasi password akun agar aman dari pengintip.</li>
          </ul>
        </div>
      </div>
      <div class="callout info">
        <div class="callout-title">Pemisahan Role Akun Anda</div>
        <p>Gunakan akun konsumer <code>cheeseburger</code> (role <code>USER</code>, blueprint <code>SUPERADMIN_BESPOKE</code>) untuk mengelola keuangan pribadi harian, sedangkan login terpisah <code>superadmin</code> (role <code>SUPERADMIN</code>) hanya dibuka saat mengelola pengguna, backup seluruh tenant, atau SQL Studio.</p>
      </div>`
      : `
      <h2 class="chapter-title">02 · Authentication, PIN Guard, Privacy & Shell</h2>
      <p class="chapter-sub">Secure login lifecycle, per-session balance masking, and global navigation controls.</p>
      <div class="two-col">
        <div class="card">
          <h3>End-to-End Authentication Flow</h3>
          <ul>
            <li><strong>/login:</strong> Sign in with username or email and password (backed by scrypt password hashing and Postgres brute-force lockouts).</li>
            <li><strong>6-Digit Security PIN & Trusted IP:</strong> When enabled, prompts for your 6-digit PIN. Checking <strong>Remember this network IP</strong> with an optional Device Label skips repeated challenges on home networks.</li>
            <li><strong>First-Login Password Setup:</strong> Any user provisioned by Superadmin with a temporary password must set a permanent 10+ character password twice at <code>/change-password</code> before accessing data.</li>
            <li><strong>Forgot & Reset Password:</strong> Single-use tokenized email recovery via <code>/forgot-password</code> and <code>/reset-password</code>.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Top Navbar & Sidebar Privacy Utility</h3>
          <ul>
            <li><strong>Search (Ctrl+K):</strong> Opens global transaction lookup and instant smart commands from anywhere in the app.</li>
            <li><strong>Period Switcher (&lt; Nov 2026 &gt;):</strong> Steps across paycycles or opens <em>Initialize New Period</em> to generate a new draft cycle.</li>
            <li><strong>Locale Menu (EN / ID / 中文):</strong> Switches UI translations dynamically in one popover without leaving the active route.</li>
            <li><strong>Account Monogram (G):</strong> Opens Profile Settings or executes clean Sign Out.</li>
            <li><strong>Global Balance Toggle (Sidebar Footer / Alt+H):</strong> Masks all currency outputs as <code>Rp •••••</code>. Unmasking for the first time in a tab requires account password verification.</li>
          </ul>
        </div>
      </div>
      <div class="callout info">
        <div class="callout-title">Two Dedicated Accounts for Daily Use vs Administration</div>
        <p>Use your primary personal workspace (<code>cheeseburger</code>, role <code>USER</code>, bespoke blueprint) for daily financial tracking. Sign in to the separate <code>superadmin</code> account solely for user provisioning, platform security policies, and SQL diagnostics.</p>
      </div>`,
  );

  // Sheet 5: Overview Col 1 + Wallet Sync Diagram
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">03 · Overview Kolom 1: Safe-to-Spend & Wallet Reconciliation</h2>
      <p class="chapter-sub">Penjelasan angka di screenshot Anda dan cara menggunakan Sync tanpa repot mencatat kopi harian.</p>
      ${renderWalletSyncDiagramSvg("id")}
      <div class="two-col">
        <div class="card">
          <h3>Safe-to-Spend, Mode Bobot & Cycle Budget Used</h3>
          <ul>
            <li><strong>Safe-to-Spend Today:</strong> Batas jajan aman hari ini agar sisa kas hidup cukup sampai H-1 gajian berikutnya.</li>
            <li><strong>Weighted 1.5x vs Flat Daily:</strong> Mode <em>Weighted 1.5x</em> memberi jatah akhir pekan (Sabtu-Minggu) 1,5x lebih longgar dibanding Senin-Jumat. <em>Flat Daily</em> membagi rata tanpa bobot.</li>
            <li><strong>7-Day Runway:</strong> Estimasi jatah total aman selama 7 hari ke depan.</li>
            <li><strong>Cycle Budget Used (Pengganti Spent Today):</strong> Menunjukkan <code>% terpakai</code> terhadap <code>% hari siklus berjalan</code> (penanda garis putih vertikal). Jadi walaupun tidak pernah input kopi hari itu, bar tetap jujur memperhitungkan seluruh belanja dan hasil Wallet Sync.</li>
            <li><strong>Avg Daily Burn & Projected Cycle-End:</strong> Rata-rata keluarnya kas hidup per hari vs baseline. Jika di screenshot bernilai <code>-Rp 15.724</code>, artinya pada laju saat ini akhir siklus berpotensi selisih Rp 15.724 di atas target awal.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Wallet Reconciliation: Arti Living Cash, Unpaid Bills & Guard/Sync</h3>
          <ul>
            <li><strong>Living Cash (mis. Rp 100.000):</strong> Sisa kas bebas murni khusus makan/jajan harian Anda di pembukuan sistem saat ini.</li>
            <li><strong>+ Unpaid Bills (mis. Rp 0):</strong> Total kuota pos rutin/tagihan bulan ini yang uangnya masih mengendap di rekening (belum dibayar keluar). Jika <code>Rp 0</code>, berarti pos rutin sudah lunas/ter-cover penuh.</li>
            <li><strong>Expected Bank (= Living Cash + Unpaid Bills):</strong> Jumlah total uang yang seharusnya ada di rekening/e-wallet gabungan Anda sekarang.</li>
            <li><strong>Tombol Guard vs Sync:</strong> Ketik total saldo nyata di <code>Cash Rp</code>. Klik <strong>Guard</strong> jika hanya ingin mengecek apakah saldo cukup menahan tagihan yang belum lunas (<em>Survival Guard</em>). Klik <strong>Sync</strong> untuk menyamakan catatan sistem ke saldo bank real; selisih otomatis tercatat ke <strong>Checkpoint & Burn Audit Trail</strong> (ada deteksi <em>Spike</em> jika > 2x jatah harian, dan tombol <strong>Undo</strong> jika salah ketik).</li>
          </ul>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">03 · Overview Col 1: Safe-to-Spend & Wallet Reconciliation</h2>
      <p class="chapter-sub">Exact meaning of every pacing telemetry figure and the 10-second Wallet Sync workflow.</p>
      ${renderWalletSyncDiagramSvg("en")}
      <div class="two-col">
        <div class="card">
          <h3>Safe-to-Spend, Weighting Modes & Cycle Budget Used</h3>
          <ul>
            <li><strong>Safe-to-Spend Today:</strong> Maximum recommended daily spending so your remaining living cash lasts smoothly until the day before next payday.</li>
            <li><strong>Weighted 1.5x vs Flat Daily:</strong> <em>Weighted 1.5x</em> gives Saturdays and Sundays 1.5x budget weight versus weekdays; <em>Flat Daily</em> splits remaining cash evenly.</li>
            <li><strong>7-Day Runway:</strong> Rolling 7-day living envelope at current weighted pacing.</li>
            <li><strong>Cycle Budget Used:</strong> Compares <code>% budget consumed</code> directly against <code>% cycle time elapsed</code> (vertical white tick mark). Automatically captures both manual logs and Wallet Sync deductions.</li>
            <li><strong>Avg Daily Burn & Projected Cycle-End:</strong> Real burn per elapsed day compared against baseline daily target; negative <code>Projected Cycle-End</code> warns you early if the current pace will slightly overrun by cycle end.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Wallet Reconciliation: Guard vs Sync Explained</h3>
          <ul>
            <li><strong>Living Cash:</strong> System-tracked remaining operational cash reserved strictly for daily living.</li>
            <li><strong>+ Unpaid Bills:</strong> Unspent routine/bill reserve still sitting inside your bank balance (<code>Rp 0</code> once routine bills for the cycle are settled).</li>
            <li><strong>Expected Bank:</strong> Exact total cash (Living Cash + Unpaid Bills) that should sit across your spending bank/e-wallets right now.</li>
            <li><strong>Guard vs Sync:</strong> Type your real bank/wallet balance into <code>Cash Rp</code>. Click <strong>Guard</strong> for a non-destructive Survival Guard check, or click <strong>Sync</strong> to post a single <code>Balance Checkpoint</code> into <strong>Checkpoint & Burn Audit Trail</strong> (flags > 2x daily spikes automatically and includes <strong>Undo</strong> on the latest checkpoint).</li>
          </ul>
        </div>
      </div>`,
  );

  // Sheet 6: Overview Col 2, Col 3 & Lower Sections
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">04 · Overview Kolom 2, Kolom 3 & Panel Aktivitas Bawah</h2>
      <p class="chapter-sub">Mengelola pos rutin bulanan, mencatat pengeluaran tunai/kredit, dan memantau kelunasan tagihan.</p>
      <div class="two-col">
        <div class="card">
          <h3>Kolom 2: Living & Routine Bills + Allocation Mix</h3>
          <ul>
            <li><strong>Daily Food & Living Budget:</strong> Plafon uang makan/jajan satu siklus penuh. Klik ikon pensil untuk mengubah target bulan aktif (tercatat di Audit Revisi).</li>
            <li><strong>Daftar Pos Rutin (Transport, Internet / Tagihan khusus):</strong> Setiap pos punya progres penggunaan dan tiga aksi cepat: <strong>Pay Full</strong> (lunas tunai dari kuota), <strong>Roll to PayLater</strong> (lempar sisa kuota ke Matrix bulan depan agar kas tunai selamat), dan <strong>Log Partial</strong> (bayar cicil/sebagian).</li>
            <li><strong>+ Enable / Adjust Routine Quota:</strong> Membuka pos bernilai Rp 0 (misal <em>Vape</em> atau <em>Haircut</em>) agar aktif saat bulan tertentu dibutuhkan.</li>
            <li><strong>Cycle Allocation Mix:</strong> Bar 4 warna yang merangkum proporsi gaji bulan ini ke Tagihan Tetap & Utang, Kas Hidup, Core Savings, serta Surplus & Buffer, lengkap dengan link langsung ke <code>Full Plan</code> dan <code>Due Calendar</code>.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Kolom 3: Core Savings, Surplus & Record Expense</h3>
          <ul>
            <li><strong>Core Savings & Flexible Surplus Cards:</strong> Menunjukkan realisasi tabungan wajib serta sisa dana bebas dan buffer (<code>Rp 250.000</code> di gambar Anda = jatah surplus fleksibel siap pakai bulan ini).</li>
            <li><strong>Mode Input Record Expense (Pintasan N):</strong> Pilih <em>Daily Spend</em> (jajan harian), <em>Routine Bill</em> (potong kuota rutin), atau <em>Refund / Split</em> (mengembalikan jatah harian saat patungan dibayar teman tanpa menggembungkan gaji).</li>
            <li><strong>Metode Bayar & Rute Cutoff:</strong> Pilih <code>Living Cash</code>, <code>PayLater</code>, atau <code>Credit Card</code>. Saat kredit dipilih, atur <em>Tenor</em> (1x/3x/6x/12x), pilih tanggal di kalender gelap <em>ErpDatePicker</em>, dan cek pratinjau <code>Billing Cycle</code> (Auto mengikuti aturan cutoff atau override manual ke bulan pilihan; centang <code>+1 cycle</code> jika ingin digeser 1 siklus ekstra).</li>
            <li><strong>Work-Hours Cost:</strong> Otomatis menampilkan berapa jam kerja riil yang setara dengan nominal yang Anda ketik.</li>
          </ul>
        </div>
      </div>
      <div class="card tight">
        <h3>Bar Status Atas & Panel Bawah Overview</h3>
        <p><strong>Active Cycle Bar:</strong> Tombol <code>Recalculate</code> menyinkronkan ulang rumus waterfall; <code>Close Period</code> mengunci siklus bila semua sudah final. <strong>Bill Settlement Checklist:</strong> Daftar ceklis tagihan jatuh tempo yang harus ditahan di rekening. <strong>Cashflow Summary & Recent Transactions:</strong> Ringkasan Pemasukan Bersih dikurangi Tagihan Terjadwal serta daftar transaksi terbaru lengkap dengan aksi edit/hapus (hanya saat status siklus masih <em>Draft</em>).</p>
      </div>`
      : `
      <h2 class="chapter-title">04 · Overview Col 2, Col 3 & Lower Ledger Panels</h2>
      <p class="chapter-sub">Managing routine monthly envelopes, logging cash or credit entries, and tracking settlement checklists.</p>
      <div class="two-col">
        <div class="card">
          <h3>Col 2: Living & Routine Bills + Cycle Allocation Mix</h3>
          <ul>
            <li><strong>Daily Food & Living Budget:</strong> Full-cycle allowance for everyday expenses; click the inline pencil to edit the target (logged with revision history).</li>
            <li><strong>Routine Quotas:</strong> Track utilization per category and act in one click with <strong>Pay Full</strong> (settle cash from quota), <strong>Roll to PayLater</strong> (defer onto the Debt Matrix without spending cash today), or <strong>Log Partial</strong>.</li>
            <li><strong>+ Enable / Adjust Routine Quota:</strong> Expand zero-target categories (such as supplies or grooming) only during months you activate them.</li>
            <li><strong>Cycle Allocation Mix:</strong> Four-segment proportional strip comparing Fixed Bills & Debt, Daily Living Pool, Core Savings, and Surplus & Buffer with quick links to <code>Full Plan</code> and <code>Due Calendar</code>.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Col 3: Core Savings, Surplus & Record Expense (Key N)</h3>
          <ul>
            <li><strong>Savings & Buffer Cards:</strong> Display funded Core Savings reserve alongside Flexible Surplus and Emergency Buffer (both editable when the cycle is Draft).</li>
            <li><strong>Expense Modes:</strong> Switch between <em>Daily Spend</em>, <em>Routine Bill</em> (deducts selected envelope), and <em>Refund / Split</em> (restores Daily Living budget directly when reimbursed by friends).</li>
            <li><strong>Cash vs Credit Routing:</strong> Selecting <code>PayLater</code> or <code>Credit Card</code> unlocks Tenor pills, the dark obsidian <em>ErpDatePicker</em>, <code>Billing Cycle</code> (Auto cutoff routing or manual period override, plus <code>+1 cycle</code> toggle), quick-tap amount presets, and live <code>Work Hours</code> cost feedback.</li>
          </ul>
        </div>
      </div>
      <div class="card tight">
        <h3>Top Period Actions & Bottom Overview Tables</h3>
        <p><strong>Active Cycle Bar:</strong> <code>Recalculate</code> refreshes all waterfall figures cleanly; <code>Close Period</code> locks a finished cycle into immutable history. Below the cockpit sit the <strong>Outlook Projection Strip</strong>, <strong>Bill Settlement Checklist & Bank Reservation</strong>, <strong>Cashflow Summary</strong>, and <strong>Recent Transactions</strong>.</p>
      </div>`,
  );

  // Sheet 7: Payday Wizard, Cash Radar & Payroll
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">05 · Payday & Closing Wizard, Cash Radar & Payroll</h2>
      <p class="chapter-sub">Mengawal hari gajian, melihat titik kas terendah di kalender, dan menghitung gaji bersih + upah riil.</p>
      <div class="stack">
        <div class="card">
          <h3>Payday & Closing Wizard (<code>/payday-wizard</code>)</h3>
          <p>Halaman panduan langkah-demi-langkah setiap kali gaji cair maupun saat menutup periode. Memverifikasi tanggal cair aktual (<code>payrollPayoutDate</code>), menampilkan daftar tagihan jatuh tempo siklus tersebut dalam urutan kronologis, mengecek kecukupan saldo bank untuk melunasi kewajiban, serta menjalankan penutupan siklus (<strong>Close Period -> Status LOCKED</strong>) dengan konfirmasi transfer Core Savings ke buku tabungan.</p>
        </div>
        <div class="two-col">
          <div class="card">
            <h3>Cash Radar & Calendar (<code>/calendar</code>)</h3>
            <ul>
              <li>Memproyeksikan saldo kas harian dari tanggal awal hingga akhir siklus gaji secara kronologis.</li>
              <li><strong>Lowest Cash Point:</strong> Menyoroti tanggal spesifik di mana saldo kas berada di titik paling tipis sehingga Anda tahu kapan harus menahan jajan sebelum gajian berikutnya.</li>
              <li>Menampilkan rincian per tanggal jatuh tempo (tgl <code>11, 17, 23, 24, 25</code>) lengkap dengan item tagihan individual.</li>
            </ul>
          </div>
          <div class="card">
            <h3>Payroll & Income (<code>/payroll</code> — 3 Sub-Tab)</h3>
            <ul>
              <li><strong>Salary & Payslip:</strong> Menghitung gaji bersih berdasarkan jendela absensi <em>(16th M-2 s.d. 15th M-1)</em>, total hari kerja, uang makan/transport, potongan kafetaria, bonus, penyesuaian manual, <strong>THR Engine</strong> (No THR / Prorated <code>264/365</code> Des / Full / Custom), dan tanggal cair aktual.</li>
              <li><strong>Payday Split-Bill Planner:</strong> Simulasi cepat membagi arus kas gaji langsung ke tagihan dan tabungan.</li>
              <li><strong>Hourly Wage & Work-Cost:</strong> Menghitung <em>True Net Hourly Wage</em> (gaji bersih dibagi jam kerja plus waktu komuter) sebagai dasar kalkulator harga dalam jam kerja.</li>
            </ul>
          </div>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">05 · Payday & Closing Wizard, Cash Radar & Payroll</h2>
      <p class="chapter-sub">Step-by-step payday activation, daily calendar cash-floor tracking, and payroll/THR modeling.</p>
      <div class="stack">
        <div class="card">
          <h3>Payday & Closing Wizard (<code>/payday-wizard</code>)</h3>
          <p>Structured workflow used both when a paycheck arrives and when closing out a cycle. Confirms your actual payout date, aligns chronological maturing obligations (<code>11th / 17th / 23rd / 24th / 25th</code>), checks remaining cash coverage, and locks completed cycles (<code>DRAFT -> LOCKED</code>) while recording final Core Savings transfers.</p>
        </div>
        <div class="two-col">
          <div class="card">
            <h3>Cash Radar & Calendar (<code>/calendar</code>)</h3>
            <ul>
              <li>Maps projected bank cash day by day across the full payday-to-payday horizon.</li>
              <li><strong>Lowest Cash Point:</strong> Pinpoints the exact calendar day when liquidity reaches its tightest point before the next paycheck arrives.</li>
              <li>Displays itemized maturing charges on every due date within the selected period.</li>
            </ul>
          </div>
          <div class="card">
            <h3>Payroll & Income (<code>/payroll</code> — 3 Sub-Tabs)</h3>
            <ul>
              <li><strong>Salary & Payslip:</strong> Computes take-home pay from the attendance cutoff window (<code>16th M-2 to 15th M-1</code>), working days, cafeteria deductions, salary adjustments, bonuses, <strong>THR Engine</strong> (None / Prorated <code>264/365</code> / Full / Custom), and confirmed <code>payrollPayoutDate</code>.</li>
              <li><strong>Payday Split-Bill Planner:</strong> Plans immediate post-payday disbursements across debt and reserves.</li>
              <li><strong>Hourly Wage & Work-Cost:</strong> Calculates <em>True Net Hourly Wage</em> factoring commute hours so expenses can be weighed in work hours.</li>
            </ul>
          </div>
        </div>
      </div>`,
  );

  // Sheet 8: Monthly Plan & Statement Import
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">06 · Monthly Plan (Allocations) & Statement Import</h2>
      <p class="chapter-sub">Merancang alokasi gaji bulanan serta mengimpor mutasi tagihan sekaligus tanpa duplikat.</p>
      <div class="two-col">
        <div class="card">
          <h3>Monthly Plan / Allocations (<code>/allocations</code>)</h3>
          <ul>
            <li><strong>Plan & Quota Simulator:</strong> Menguji perubahan target <em>Daily Food & Living Quota</em> maupun target tabungan dengan grafik efek langsung ke <em>Projected Savings</em>, <em>Projected Surplus</em>, dan status defisit sebelum mengklik <strong>Apply Quota</strong>.</li>
            <li><strong>Routine & Sinking Reserve:</strong> Mengatur kebijakan akhir siklus tiap amplop rutin (<em>Sweep Unspent to Core Savings</em> agar sisa kuota masuk tabungan otomatis, atau biarkan mengendap).</li>
            <li><strong>Periodic Bill Set-Asides:</strong> Jadwal cadangan dana berkala (misal pajak tahunan, servis, perpanjangan domain) supaya biaya besar yang jarang muncul tetap terdanai rata per bulan.</li>
            <li><strong>Quota History:</strong> Rekam jejak lengkap setiap revisi target beserta alasan perubahannya.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Statement Import / Reconciler (<code>/import</code>)</h3>
          <ul>
            <li><strong>Paste & Parse Statement Batch:</strong> Tempel salinan daftar belanja PayLater atau tagihan Kartu Kredit dari aplikasi bank/marketplace ke kotak parser.</li>
            <li><strong>Parse & Auto-Route:</strong> Mesin Go langsung membaca tanggal, nominal, dan tipe instrumen, lalu menentukan periode jatuh tempo sesuai hukum cutoff.</li>
            <li><strong>Lock-Safe Guard:</strong> Jika tanggal transaksi secara alami jatuh ke periode yang sudah dikunci (<code>LOCKED</code>, misal <code>10/2026</code>), sistem otomatis menggesernya maju ke periode terbuka terdekat (<code>11/2026</code>) dengan penanda <em>Advanced from Locked</em> dan memblokir baris yang terdeteksi duplikat.</li>
            <li><strong>Commit Selected Rows:</strong> Hanya baris yang Anda centang yang masuk ke database secara atomik.</li>
          </ul>
        </div>
      </div>
      <div class="callout emerald">
        <div class="callout-title">Kapan Memakai Statement Import vs Record Expense</div>
        <p>Gunakan <strong>Record Expense</strong> untuk 1-2 belanja baru saat itu juga, dan gunakan <strong>Statement Import</strong> setiap akhir minggu atau sebelum tutup buku bila ingin memasukkan banyak rincian PayLater / Kartu Kredit sekaligus dengan cepat.</p>
      </div>`
      : `
      <h2 class="chapter-title">06 · Monthly Plan (Allocations) & Statement Import</h2>
      <p class="chapter-sub">Interactive quota modeling, sinking fund schedules, and lock-safe batch statement reconciliation.</p>
      <div class="two-col">
        <div class="card">
          <h3>Monthly Plan / Allocations (<code>/allocations</code>)</h3>
          <ul>
            <li><strong>Plan & Quota Simulator:</strong> Interactive sliders/inputs previewing how Daily Living or Savings target adjustments affect <em>Projected Savings</em>, <em>Projected Surplus</em>, and any shortfall before committing via <strong>Apply Quota</strong>.</li>
            <li><strong>Routine & Sinking Reserve:</strong> Configures end-of-cycle rollover behavior (such as <em>Sweep Unspent to Core Savings</em>) per routine bucket.</li>
            <li><strong>Periodic Bill Set-Asides:</strong> Accumulates monthly reserves for irregular multi-month obligations so annual bills never shock a single cycle.</li>
            <li><strong>Quota History:</strong> Audit list preserving every target revision and user note.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Statement Import / Reconciler (<code>/import</code>)</h3>
          <ul>
            <li><strong>Paste & Parse Statement:</strong> Drop copied statement lines from PayLater apps or credit card portals for instant structured parsing.</li>
            <li><strong>Parse & Auto-Route:</strong> Uses the Go reconciler engine to assign each row to its exact maturity cycle under dynamic cutoff rules while deduplicating existing entries.</li>
            <li><strong>Lock-Safe Period Protection:</strong> Any row whose natural cutoff points into an already-locked historical cycle automatically advances to the earliest open draft period with an explicit notice banner.</li>
            <li><strong>Commit Selected Rows:</strong> Commits checked rows atomically and triggers live snapshot recalculation.</li>
          </ul>
        </div>
      </div>
      <div class="callout emerald">
        <div class="callout-title">Choosing Between Record Expense and Statement Import</div>
        <p>Use <strong>Record Expense</strong> for single quick purchases and <strong>Statement Import</strong> weekly or before closing a period whenever reconciling multiple PayLater or Card lines in one pass.</p>
      </div>`,
  );

  // Sheet 9: Installments & Bills + Cutoff Diagram
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">07 · Installments & Bills (Hukum Cutoff & Matrix 12 Bulan)</h2>
      <p class="chapter-sub">Kontrol menyeluruh untuk seluruh kewajiban PayLater, Kartu Kredit, SPinjam, dan KSM.</p>
      ${renderCutoffDiagramSvg("id", "gabriel")}
      <div class="two-col">
        <div class="card">
          <h3>Limit Kredit, 12-Month Matrix & Cell Drawer</h3>
          <ul>
            <li><strong>Credit & Debt Ceiling Control:</strong> Memantau batas aman rasio cicilan maksimal <code>35%</code> dari take-home pay (<code>Use Optimal Ceiling</code> / <code>Use Safe Ceiling</code> / <code>Configure Period Limits</code>).</li>
            <li><strong>12-Month Rolling Debt Matrix:</strong> Klik angka sel bulan mana saja di baris PayLater atau Utang Pribadi untuk mengedit cepat atau membuka <strong>Matrix Cell Drawer</strong>.</li>
            <li><strong>Aksi di Matrix Cell Drawer:</strong> Tambah item baru (<code>Add Item</code>), geser 1 bulan maju/mundur (<code>Earlier</code> / <code>Later</code>), pecah satu tagihan melewati batas cutoff (<code>Split</code>), ubah total langsung (<code>Manual Bill Total</code>), dan tandai lunas per item (<code>Paid</code> / <code>Unpaid</code>) atau lunas serentak.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Safe-Spend Simulator, Bridge Loan & Credit Tabs</h3>
          <ul>
            <li><strong>Safe-Spend Simulator:</strong> Masukkan rencana belanja beserta tanggal beli & tenor untuk mendapat vonis warna (<code>OK / Wait Past Cutoff / Over Limit</code>) serta apakah transaksi akan menembus batas 35%.</li>
            <li><strong>Record Bridge Loan:</strong> Catat dana pinjaman/talangan agar uang masuk menambah saldo siklus ini tanpa merusak hitungan gaji bulanan, sambil menjadwalkan pengembaliannya di masa depan.</li>
            <li><strong>Credit Cards & Payoff Optimizer:</strong> Kelola tagihan berulang/cicilan kartu (atur bulan berakhir <em>End Date</em> atau pelunasan dipercepat) dan bandingkan skenario <em>Contractual</em> vs <em>Avalanche</em> vs <em>Snowball</em>.</li>
          </ul>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">07 · Installments & Bills (Cutoff Law & 12-Month Matrix)</h2>
      <p class="chapter-sub">Deterministic statement routing, 35% debt ceiling governance, and itemized liability editing.</p>
      ${renderCutoffDiagramSvg("en", "gabriel")}
      <div class="two-col">
        <div class="card">
          <h3>Credit Ceiling, Debt Matrix & Drawer Actions</h3>
          <ul>
            <li><strong>Credit & Debt Ceiling Control:</strong> Enforces a safe 35% Debt Service Ratio ceiling over take-home pay (<strong>Use Optimal Ceiling</strong>, <strong>Use Safe Ceiling</strong>, or per-period custom caps).</li>
            <li><strong>12-Month Rolling Debt Matrix:</strong> Click any PayLater or Personal Debt cell for inline adjustment or to launch the <strong>Matrix Cell Drawer</strong>.</li>
            <li><strong>Drawer Controls:</strong> Add charges/installments, shift slices <code>Earlier</code> or <code>Later</code>, <code>Split</code> partial obligations across cutoff dates, override totals, and mark individual items settled.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Safe-Spend Simulator, Bridge Loan & Optimizer</h3>
          <ul>
            <li><strong>Safe-Spend Simulator:</strong> Pre-screens planned purchases by date and tenor, displaying routing cycle and DSR verdict before you buy.</li>
            <li><strong>Record Bridge Loan:</strong> Credits temporary bridge cash inflow directly into the active cycle without distorting recurring payroll income while scheduling future repayments.</li>
            <li><strong>Card Management & Payoff Optimizer:</strong> Set end dates or early settlements on recurring card charges and compare <em>Contractual</em>, <em>Avalanche</em>, and <em>Snowball</em> repayment schedules.</li>
          </ul>
        </div>
      </div>`,
  );

  // Sheet 10: Savings & Scenario Lab
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">08 · Savings & Emergency Fund + What-If Scenario Lab</h2>
      <p class="chapter-sub">Membangun ketahanan dana darurat dan menguji ketahanan kas 12 bulan dengan mesin Go.</p>
      <div class="two-col">
        <div class="card">
          <h3>Savings & Emergency Fund (<code>/savings</code> — 2 Sub-Tab)</h3>
          <ul>
            <li><strong>Savings Pockets & Goals:</strong> Catat setoran atau penarikan manual (<em>Liquid Cash</em> atau instrumen lain), pantau target tabungan per tujuan dengan tanggal target memakai <em>ErpDatePicker</em>, serta lihat <strong>Monthly Savings Transfer Tracker</strong> untuk mencocokkan transfer Core Savings antar periode terkunci.</li>
            <li><strong>Emergency Fund Milestones:</strong> Melacak tonggak pembebasan kewajiban (seperti lunasnya SPinjam di awal 2027 hingga status bebas utang di Okt 2027).</li>
            <li><strong>Emergency Runway & Net Worth:</strong> Membandingkan total kas + tabungan terhadap total sisa pokok utang aktif (hanya hutang eksternal riil), disertai sakelar opsional <em>External Asset Portfolio</em> yang dapat dinyalakan hanya jika diperlukan.</li>
          </ul>
        </div>
        <div class="card">
          <h3>What-If Scenario Lab (<code>/scenarios</code>)</h3>
          <ul>
            <li><strong>Scenario Inputs & 3 Preset Cepat:</strong> Geser slider <em>Extra Monthly Savings</em>, <em>One-Time Bonus / THR</em>, <em>Monthly Living Adjustment</em>, <em>Extra Debt Prepayment</em>, dan <em>Variable Expense Shock (%)</em>, atau gunakan preset instan <strong>Debt-Free Sprint</strong>, <strong>Bonus Prepayment</strong>, dan <strong>+15% Burn Shock</strong>.</li>
            <li><strong>Baseline vs Simulated 12-Month Curve:</strong> Membandingkan kurva kekayaan bersih dan tanggal bebas utang (DSR &lt; 15%).</li>
            <li><strong>Go Monte Carlo Cashflow Stress Test & Allocation Frontier:</strong> Menjalankan ribuan simulasi stokastik lintas skenario untuk menghitung <em>12-Month Survival Rate (%)</em> serta batas optimal alokasi surplus.</li>
          </ul>
        </div>
      </div>
      <div class="callout info">
        <div class="callout-title">Akurasi Saldo Tabungan (Epoch Isolation)</div>
        <p>Saldo Core Savings P1 dihitung murni dari catatan mutasi nyata sejak periode epoch aktif (<code>10/2026</code>), bebas dari aset fiktif maupun pengembalian internal antar-kantong.</p>
      </div>`
      : `
      <h2 class="chapter-title">08 · Savings & Emergency Fund + What-If Scenario Lab</h2>
      <p class="chapter-sub">Tracking verified cash reserves, debt milestones, and stochastic Go-engine stress simulations.</p>
      <div class="two-col">
        <div class="card">
          <h3>Savings & Emergency Fund (<code>/savings</code> — 2 Sub-Tabs)</h3>
          <ul>
            <li><strong>Savings Pockets & Goals:</strong> Log manual top-ups and emergency withdrawals, manage target-dated savings goals with <em>ErpDatePicker</em>, and reconcile Core Savings transfers via the <strong>Monthly Savings Transfer Tracker</strong>.</li>
            <li><strong>Emergency Fund Milestones:</strong> Tracks upcoming debt-payoff relief steps as installment tranches mature into debt-free cycles.</li>
            <li><strong>Emergency Runway & Net Worth:</strong> Compares real cash and Core Savings against external unpaid debt principal (optionally toggling external investment assets).</li>
          </ul>
        </div>
        <div class="card">
          <h3>What-If Scenario Lab (<code>/scenarios</code>)</h3>
          <ul>
            <li><strong>Scenario Inputs & Presets:</strong> Test <em>Extra Monthly Savings</em>, <em>Bonus / THR Inflows</em>, <em>Living Adjustments</em>, <em>Extra Debt Prepayments</em>, and <em>Burn Shocks</em>, or trigger <strong>Debt-Free Sprint</strong>, <strong>Bonus Prepayment</strong>, and <strong>+15% Burn Shock</strong> presets.</li>
            <li><strong>Wealth Trajectory Curve:</strong> Overlays simulated 12-month net cash accumulation and DSR &lt; 15% milestones over baseline.</li>
            <li><strong>Monte Carlo Stress Test & Allocation Frontier:</strong> Go-powered stochastic engine computing 12-month cashflow survival rates and debt vs savings frontier curves.</li>
          </ul>
        </div>
      </div>
      <div class="callout info">
        <div class="callout-title">True Ledger Vault Accounting</div>
        <p>Core Savings reserves track only real verified transfers since your active ledger epoch without inflated placeholder yields or double-counted internal transfers.</p>
      </div>`,
  );

  // Sheet 11: Analytics, Reports & Subscriptions
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">09 · Spending & Trend Review, Financial Reports & Subscriptions</h2>
      <p class="chapter-sub">Evaluasi tren pengeluaran, ekspor laporan profesional, dan cegah langganan promo naik harga diam-diam.</p>
      <div class="two-col">
        <div class="card">
          <h3>Spending & Trend Review (<code>/analytics</code>)</h3>
          <p>Menyajikan grafik perbandingan tren antar bulan, sebaran kategori belanja harian maupun rutin, skor disiplin keuangan (<code>/audit</code>), serta mendeteksi anomali seperti belanja melebihi kecepatan normal atau lonjakan tagihan baru pasca-cutoff.</p>
        </div>
        <div class="card">
          <h3>Financial Reports (<code>/reports</code> — 3 Sub-Tab)</h3>
          <ul>
            <li><strong>Visual Money Summary:</strong> Diagram donat <em>Where Your Money Went</em>, proporsi alokasi gaji, dan kurva akumulasi modal tertahan.</li>
            <li><strong>Trend & Comparisons:</strong> Proyeksi arus kas 3 bulan ke depan dan perbandingan delta antar periode.</li>
            <li><strong>Excel & Email Export:</strong> Unduh workbook Excel (<code>Download Excel (.xlsx)</code>), cetak atau simpan PDF bersih hitam-putih (<code>Print / Save PDF</code>), serta kirim ringkasan ke email.</li>
          </ul>
        </div>
      </div>
      <div class="card">
        <h3>Subscriptions & Recurring + Promo Kill-Switch Deadline Guard (<code>/subscriptions</code>)</h3>
        <p>Mencatat seluruh langganan bulanan berulang (cloud storage, tools AI, musik, dll.) beserta status perpanjangan kartu kredit. <strong>Promo Kill-Switch:</strong> Bila Anda berlangganan tarif promo sementara (misal diskon 3 bulan lalu naik ke harga normal), cukup masukkan tanggal batas (<em>Deadline Date</em>) dan tarif pasca-promo. Sistem menyalakan banner pengingat sebelum batas waktu lewat, lengkap dengan tautan langsung ke halaman pembatalan penyedia dan tombol pengiriman email pengingat.</p>
      </div>`
      : `
      <h2 class="chapter-title">09 · Analytics, Financial Reports & Subscriptions</h2>
      <p class="chapter-sub">Cross-cycle trend audits, spreadsheet/PDF reporting, and Promo Kill-Switch renewal protection.</p>
      <div class="two-col">
        <div class="card">
          <h3>Spending & Trend Review (<code>/analytics</code>)</h3>
          <p>Visualizes cross-cycle expense ratios, routine vs discretionary burn comparisons, cycle discipline health scores (<code>/audit</code>), and automated detection of post-cutoff charge creep.</p>
        </div>
        <div class="card">
          <h3>Financial Reports (<code>/reports</code> — 3 Sub-Tabs)</h3>
          <ul>
            <li><strong>Visual Money Summary:</strong> Donut chart of <em>Where Your Money Went</em>, paycheck allocation bars, and cumulative retained capital curve.</li>
            <li><strong>Trend & Comparisons:</strong> Multi-month cashflow projections and variance breakdown.</li>
            <li><strong>Excel & Email Export:</strong> One-click <strong>Download Excel (.xlsx)</strong>, print-clean black-on-white <strong>Print / Save PDF</strong>, and direct formatted email dispatch.</li>
          </ul>
        </div>
      </div>
      <div class="card">
        <h3>Subscriptions & Recurring + Promo Kill-Switch Guard (<code>/subscriptions</code>)</h3>
        <p>Centralizes recurring charges and card-linked plans. <strong>Promo Kill-Switch:</strong> Whenever signing up for a discounted promo tier that renews at a higher standard rate later, log its <em>Deadline Date</em>, post-promo rate, and cancellation portal URL. Active alert banners and optional SMTP email reminders warn you days before renewal hits.</p>
      </div>`,
  );

  // Sheet 12: Marquee AI, Ctrl+K & Preferences
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">10 · Marquee AI Co-Pilot, Ctrl+K & Preferences 6-Tab</h2>
      <p class="chapter-sub">Asisten AI deterministik (anti-ngarang angka), bar perintah kilat, dan studio konfigurasi lengkap.</p>
      <div class="two-col">
        <div class="card">
          <h3>Marquee AI Co-Pilot (Orb Kanan Bawah / <code>Alt+M</code> / <code>/marquee</code>)</h3>
          <ul>
            <li><strong>Tanpa Angka Mengarang:</strong> Setiap angka saldo, tagihan, dan simulasi dihitung langsung oleh mesin backend dari ledger akun Anda, bukan ditebak LLM.</li>
            <li><strong>Stage-Commit Aman (Preview 1-Klik):</strong> Saat Anda mengetik <em>"catat kopi 35k pakai spaylater"</em>, Marquee menampilkan kartu konfirmasi terlebih dahulu dan baru menulis ke database setelah Anda menekan tombol konfirmasi.</li>
            <li><strong>Memori & Riset:</strong> Mendukung pengenalan kebiasaan merchant, pencarian histori arsip, serta analisis varians antar periode dalam EN/ID/ZH.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Sintaks Cepat Command Search (<code>Ctrl+K</code>)</h3>
          <ul>
            <li><code>kopken 34200 spaylater</code> : catat PayLater otomatis rute cutoff.</li>
            <li><code>claude 350000 cc 21 nov</code> : catat Kartu Kredit pada tanggal spesifik.</li>
            <li><code>wallet 515000</code> : evaluasi cepat <em>Wallet Check-In / Guard</em>.</li>
            <li><code>afford 1.5m spaylater 3x</code> : buka simulasi kelayakan belanja kredit.</li>
            <li><code>sql</code> (khusus Superadmin) : lompat langsung ke SQL Studio.</li>
          </ul>
        </div>
      </div>
      <div class="card tight">
        <h3>Preferences 6-Tab (<code>/preferences</code>)</h3>
        <p><strong>1. Paycycle & Priorities:</strong> Engine formula gaji & DSL (variabel <code>DAYS_IN_MONTH</code>, <code>PAYDAY_DAY</code>, dst.) plus aturan hari gajian. <strong>2. Payment Methods & Cutoffs:</strong> Atur cutoff kartu kredit/PayLater memakai formula aman serta daftar akun kas/aset eksternal. <strong>3. Routine & Savings Pockets:</strong> Template pos rutin dan target tabungan. <strong>4. Account, Privacy & Display:</strong> Visibilitas modul sidebar, pintasan custom, & key API AI. <strong>5. Notifications & Promo Watch:</strong> Konfigurasi SMTP terenkripsi. <strong>6. Backup, Restore & Data:</strong> Ekspor/pulihkan backup JSON pribadi.</p>
      </div>`
      : `
      <h2 class="chapter-title">10 · Marquee AI Co-Pilot, Ctrl+K & 6-Tab Preferences</h2>
      <p class="chapter-sub">Zero-hallucination deterministic AI co-pilot, smart command bar syntax, and system configuration studio.</p>
      <div class="two-col">
        <div class="card">
          <h3>Marquee AI Co-Pilot (Bottom-Right Orb / <code>Alt+M</code> / <code>/marquee</code>)</h3>
          <ul>
            <li><strong>Zero Hallucinated Math:</strong> Every Rp balance, cutoff date, and DSR projection comes straight from live backend tools hydrated per user session.</li>
            <li><strong>Safe Stage-Commit Card:</strong> Action requests preview the exact cycle routing and amounts first, committing writes only when you explicitly confirm.</li>
            <li><strong>Trilingual & Archive Search:</strong> Understands EN/ID/ZH shorthand amounts, searches your ledger history, and remembers merchant defaults.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Ctrl+K Smart Command Syntax</h3>
          <ul>
            <li><code>kopken 34200 spaylater</code> : quick PayLater entry with cutoff routing.</li>
            <li><code>claude 350000 cc 21 nov</code> : credit card entry dated 21 Nov.</li>
            <li><code>wallet 515000</code> : instant Wallet Guard liquidity check.</li>
            <li><code>afford 1.5m spaylater 3x</code> : jump to credit affordability simulator.</li>
            <li><code>sql</code> (Superadmin) : jump straight to Superadmin SQL Studio.</li>
          </ul>
        </div>
      </div>
      <div class="card tight">
        <h3>6-Tab Preferences Studio (<code>/preferences</code>)</h3>
        <p><strong>1. Formula:</strong> Payday & allocation priority rules using safe formula DSL tokens. <strong>2. Instruments & Accounts:</strong> Custom cutoff expressions and external asset accounts. <strong>3. Templates:</strong> Routine & savings pocket defaults. <strong>4. Display & AI:</strong> Sidebar module overrides, custom shortcuts, and AES-256-GCM BYOK AI provider keys. <strong>5. Notifications:</strong> Encrypted SMTP and Kill-Switch alert thresholds. <strong>6. Backup:</strong> Tenant-scoped JSON backup & restore.</p>
      </div>`,
  );

  // Sheet 13: Superadmin Console & SQL Studio
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">11 · Panduan Superadmin Console (<code>/admin</code> & <code>/admin/sql</code>)</h2>
      <p class="chapter-sub">Hanya tampil saat masuk memakai akun Superadmin untuk mengelola user lain, keamanan jaringan, dan database.</p>
      <div class="two-col">
        <div class="card">
          <h3>Membuat Akun User Baru & Kelola Akses</h3>
          <ul>
            <li><strong>Provision Client Account:</strong> Buat akun user baru untuk orang lain beserta <strong>Password Sementara (Temp Password)</strong> yang dibuat otomatis atau kustom.</li>
            <li><strong>Wajib Ganti Password Pertama:</strong> Saat user tersebut login memakai password sementara itu, sistem mengunci workspace dan mewajibkan mereka membuat password pribadi baru 2x di <code>/change-password</code>.</li>
            <li><strong>Kontrol User & Feature Requests:</strong> Tangguhkan (<em>Suspend</em>) / aktifkan kembali user, paksa reset password, putuskan sesi aktif (<em>Revoke Sessions</em>), ubah daftar modul aktif per akun, serta review pengajuan rule custom user.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Security, IP Whitelist & SQL Query Studio</h3>
          <ul>
            <li><strong>IP Whitelist (Permissive vs Strict):</strong> Di mode <em>Strict</em>, hanya alamat IP terdaftar yang diizinkan mengakses jalur sensitif.</li>
            <li><strong>Security & Admin Audit Log:</strong> Rekam jejak seluruh aksi login gagal, reset password, dan perubahan konfigurasi.</li>
            <li><strong>Platform Backup & Dry-Run Restore:</strong> Validasi isi berkas JSON cadangan lewat ringkasan dry-run sebelum dipulihkan.</li>
            <li><strong>SQL Query Studio (<code>/admin/sql</code>):</strong> Mendukung preset kueri cepat, <em>Visual Table Browser</em>, serta 3 tingkat keamanan eksekusi: <code>READ_ONLY</code>, <code>DRY_RUN_ROLLBACK</code> (tes dampak kueri tanpa menyimpan permanen), dan <code>EXECUTE_COMMIT</code>.</li>
          </ul>
        </div>
      </div>
      <div class="callout warn" style="margin-top: 12px;">
        <strong>Disiplin Operasional Superadmin:</strong> Gunakan akun harian pribadi Anda untuk pemakaian rutin dan masuk sebagai <code>SUPERADMIN</code> hanya saat mengelola tenant, audit keamanan, atau perbaikan darurat. Untuk perubahan lewat SQL Studio, jalankan selalu mode <code>DRY_RUN_ROLLBACK</code> terlebih dahulu sebelum memilih <code>EXECUTE_COMMIT</code>, dan jangan pernah mengubah data periode berstatus <code>LOCKED</code> secara manual jika tersedia jalur resmi API/Recalculate.
      </div>`
      : `
      <h2 class="chapter-title">11 · Superadmin Console Guide (<code>/admin</code> & <code>/admin/sql</code>)</h2>
      <p class="chapter-sub">Platform administration tools visible only when signed in with the SUPERADMIN role.</p>
      <div class="two-col">
        <div class="card">
          <h3>Provisioning Users & Tenant Access</h3>
          <ul>
            <li><strong>Provision Client Account:</strong> Create new Standard or Bespoke client accounts with an automatically generated strong temporary password.</li>
            <li><strong>Mandatory First-Login Password Rotation:</strong> Provisioned users are routed to <code>/change-password</code> upon first login and cannot access any dashboard until they confirm a permanent personal password twice.</li>
            <li><strong>Lifecycle & Feature Queue:</strong> Suspend or activate accounts, trigger password resets, revoke live sessions, customize module visibility per tenant, and review custom rule requests.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Security Whitelist, Backups & SQL Studio</h3>
          <ul>
            <li><strong>IP Whitelist (Permissive / Strict):</strong> Restrict sensitive admin/workspace access exclusively to approved network IPs when Strict mode is active.</li>
            <li><strong>Security Audit Log & Platform Backup:</strong> Review immutable authentication events and run Dry-Run restore summaries before applying backups.</li>
            <li><strong>SQL Query Studio (<code>/admin/sql</code>):</strong> Browse database tables directly or run PostgreSQL queries under explicit execution safety modes: <code>READ_ONLY</code>, <code>DRY_RUN_ROLLBACK</code> (tests transactions without persisting), and <code>EXECUTE_COMMIT</code>.</li>
          </ul>
        </div>
      </div>
      <div class="callout warn" style="margin-top: 12px;">
        <strong>Superadmin Operational Discipline:</strong> Keep daily budgeting inside your personal client account and sign into the <code>SUPERADMIN</code> console only for tenant management, security audits, or recovery work. In SQL Studio, verify row counts with <code>READ_ONLY</code> and simulate writes with <code>DRY_RUN_ROLLBACK</code> before committing, and never patch <code>LOCKED</code> ledger periods manually outside official engine workflows.
      </div>`,
  );

  // Sheet 14: Playbook + Glossary + Shortcuts
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">12 · Playbook Rutinitas, Kamus Istilah & Shortcut</h2>
      <p class="chapter-sub">Panduan cepat sehari-hari supaya aplikasi ini bekerja untuk Anda, bukan menambah beban catatan.</p>
      <div class="two-col">
        <div class="card">
          <h3>Playbook 2 Menit (Tanpa Wajib Catat Kopi)</h3>
          <ul>
            <li><strong>2-3 Hari Sekali (1 Menit):</strong> Cek total saldo rekening jajan Anda -> ketik ke <code>Cash Rp</code> -> klik <strong>Sync</strong>. Selesai. Lihat apakah <code>Cycle Budget Used</code> masih sejajar dengan garis hari berjalan.</li>
            <li><strong>Saat Belanja Kredit / PayLater:</strong> Catat 1x di tab <code>PayLater / Credit Card</code> agar jatuh tempo bulan depan & batas aman 35% langsung tercatat.</li>
            <li><strong>Tgl 15/16 & 25 (Cek Cutoff):</strong> Sebelum checkout barang besar, pakai <code>Safe-Spend Simulator</code> supaya tahu jatuh di tagihan bulan mana.</li>
            <li><strong>Hari Gajian & Akhir Siklus:</strong> Buka <code>/payday-wizard</code> -> sahkan pemasukan gaji -> lunasi pos rutin -> tutup periode (<em>Close Period</em>) agar tabungan bersih tersimpan.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Kamus Singkat Istilah & Pintasan Keyboard</h3>
          <table class="mini-tbl">
            <tr><td class="mono k">Flexible Surplus</td><td>Sisa gaji bebas pakai setelah utang, tagihan, living & Core Savings beres.</td></tr>
            <tr><td class="mono k">Emergency Buffer</td><td>Cadangan darurat mini aktif di dalam siklus berjalan.</td></tr>
            <tr><td class="mono k">Cycle Budget Used</td><td>Persen kas hidup terpakai vs persen hari siklus berjalan (tahan Sync).</td></tr>
            <tr><td class="mono k">Unpaid Bills</td><td>Uang pos rutin yang masih mengendap di bank sebelum dibayar.</td></tr>
            <tr><td class="mono k">Temporary Advance</td><td>Dana pinjam sementara dari Core Savings untuk menutup kurang kas.</td></tr>
            <tr><td class="mono k">N / Ctrl+K</td><td>Fokus catat pengeluaran / Buka Command Search & Smart Entry.</td></tr>
            <tr><td class="mono k">Alt+M / Alt+H / [</td><td>Buka Marquee AI / Sembunyikan saldo / Lipat menu Sidebar.</td></tr>
          </table>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">12 · Zero-Friction Routine Playbook, Glossary & Shortcuts</h2>
      <p class="chapter-sub">How to run Sunday Funday smoothly in minutes per week without manual micro-logging.</p>
      <div class="two-col">
        <div class="card">
          <h3>Practical 2-Minute Weekly Workflow</h3>
          <ul>
            <li><strong>Every 2-3 Days (60 Seconds):</strong> Open your bank app -> type real cash balance into <code>Cash Rp</code> -> hit <strong>Sync</strong>. Watch <code>Cycle Budget Used</code> against the elapsed day marker.</li>
            <li><strong>On Credit / PayLater Purchases:</strong> Log once in <code>Record Expense</code> (PayLater / Credit Card tab) or batch-import weekly via <code>/import</code> so future due cycles and 35% limits update immediately.</li>
            <li><strong>Before Big Purchases:</strong> Run <code>Safe-Spend Simulator</code> around cutoff days (15th/16th & 25th) to decide whether waiting shifts the bill a month forward.</li>
            <li><strong>On Payday & Cycle End:</strong> Open <code>/payday-wizard</code> to confirm salary payout, settle bills, and click <code>Close Period</code> to lock history cleanly.</li>
          </ul>
        </div>
        <div class="card">
          <h3>A-Z Glossary & Keyboard Shortcuts</h3>
          <table class="mini-tbl">
            <tr><td class="mono k">Flexible Surplus</td><td>Free cash leftover after debt, routine bills, living & Core Savings are funded.</td></tr>
            <tr><td class="mono k">Emergency Buffer</td><td>Active-cycle shock reserve shielding daily cash from surprise minor costs.</td></tr>
            <tr><td class="mono k">Cycle Budget Used</td><td>% of living budget spent vs % of cycle days elapsed (works seamlessly with Sync).</td></tr>
            <tr><td class="mono k">Unpaid Bills</td><td>Routine bill reserve still sitting inside your bank awaiting payment.</td></tr>
            <tr><td class="mono k">Temporary Advance</td><td>Short-term cash borrowed from your savings pockets with scheduled payback.</td></tr>
            <tr><td class="mono k">N / Ctrl+K</td><td>Focus Record Expense / Open Global Command Search & quick entry.</td></tr>
            <tr><td class="mono k">Alt+M / Alt+H / [</td><td>Toggle Marquee AI Drawer / Toggle Balance Privacy / Collapse Sidebar.</td></tr>
          </table>
        </div>
      </div>`,
  );

  const pageBodies = [
    ...sheets.map((body, idx) => renderSheet(lang, runningTitle, idx === 0 ? (isId ? "Daftar Isi" : "Contents") : `Section ${String(idx).padStart(2, "0")}`, idx + 2, sheets.length + 1, body)),
  ];

  const spec: GuideBookSpec = {
    filename: isId
      ? "Sunday-Funday-ERP-User-Guide-Gabriel-ID.pdf"
      : "Sunday-Funday-ERP-User-Guide-Gabriel-EN.pdf",
    edition: "gabriel",
    lang,
    eyebrow: isId ? "Dokumentasi Sistem Keuangan Pribadi · Edisi Utama" : "Personal Finance Operating System · Flagship Reference",
    title: isId ? "Panduan Lengkap Sunday Funday ERP" : "Sunday Funday ERP User Manual",
    subtitle: isId
      ? "Referensi menyeluruh seluruh fitur, logika siklus gajian, manajemen utang & tabungan, asisten AI Marquee, hingga kendali Superadmin."
      : "End-to-end documentation covering paycycle logic, zero-friction wallet syncing, cutoff routing, scenario testing, Marquee AI, and Superadmin controls.",
    editionBadge: isId ? "Edisi Khusus Gabriel + Superadmin" : "Gabriel Bespoke + Superadmin Edition",
    audienceLabel: isId ? "Gabriel (Bespoke Client) & Superadmin" : "Gabriel (Bespoke Client) & Platform Admin",
    versionLabel: "v2.8 · Nov 2026 · ID/EN",
    sheetsHtml: [],
  };
  spec.sheetsHtml = [buildCoverSheet(spec), ...pageBodies];
  return spec;
}

function buildStandardPages(lang: GuideLang): GuideBookSpec {
  const isId = lang === "id";
  const runningTitle = isId ? "Panduan Pengguna (Edisi Standar)" : "User Manual (Standard Edition)";

  const toc: TocEntry[] = isId
    ? [
        { num: "01", title: "Cara Pakai Anti-Ribet & Sistem Waterfall", desc: "Siklus gajian, Core Savings, Flexible Surplus, Emergency Buffer", page: 3 },
        { num: "02", title: "Aktivasi Password Baru, Keamanan PIN & Privasi", desc: "Login pertama (/change-password), lupa sandi, Sidebar Alt+H", page: 4 },
        { num: "03", title: "Overview Kolom 1: Safe-to-Spend & Wallet Sync", desc: "Cycle Budget Used, Avg Burn, Expected Bank vs Guard/Sync", page: 5 },
        { num: "04", title: "Overview Kolom 2 & 3: Pos Kustom & Catat Cepat", desc: "Tambah/ubah pos rutin, Mix 4 Pos, Record Expense, Checklist", page: 6 },
        { num: "05", title: "Transactions Ledger, Payday Wizard & Bills Calendar", desc: "Filter buku transaksi, ekspor Excel, ritual gaji & titik kas terendah", page: 7 },
        { num: "06", title: "Income & Cash Flow, Budgets & Statement Import", desc: "Atur pemasukan, simulasi amplop & Rollover, impor mutasi", page: 8 },
        { num: "07", title: "Installments & Bills (Cutoff & Debt Matrix)", desc: "Aturan cutoff kartu/PayLater, Matrix 12 bulan & Payoff Optimizer", page: 9 },
        { num: "08", title: "Accounts & Goals, Wishlist & Scenario Planner", desc: "Kantong tabungan, simulasi wishlist vs jam kerja, Go Stress Test", page: 10 },
        { num: "09", title: "Analytics, Reports, Subscriptions, Marquee & Preferences", desc: "Laporan XLSX/PDF, Promo Kill-Switch, AI Co-Pilot & Setup Wizard", page: 11 },
        { num: "10", title: "Playbook 2 Menit/Minggu, Glosarium & Shortcuts", desc: "Kebiasaan ringan tanpa mencatat tiap kopi + kamus istilah", page: 12 },
      ]
    : [
        { num: "01", title: "Two-Minute Workflow & Waterfall System", desc: "Paycycle rhythm, Core Savings, Flexible Surplus, Buffer", page: 3 },
        { num: "02", title: "First-Login Password Setup, PIN & Privacy", desc: "Mandatory password rotation, Forgot/Reset, Alt+H Privacy", page: 4 },
        { num: "03", title: "Overview Col 1: Safe-to-Spend & Wallet Sync", desc: "Cycle Budget Used, Avg Burn, Guard vs Sync checkpointing", page: 5 },
        { num: "04", title: "Overview Col 2 & 3: Custom Categories & Expense Log", desc: "Add/rename routine bills, Allocation Mix, Cash/Credit logging", page: 6 },
        { num: "05", title: "Transactions Ledger, Payday Wizard & Bills Calendar", desc: "Ledger filtering/edits, payday closing, Lowest Cash Point", page: 7 },
        { num: "06", title: "Income & Cash Flow, Budgets & Statement Import", desc: "Income entries, envelope rollover rules, batch statement import", page: 8 },
        { num: "07", title: "Installments & Bills (Cutoffs & Matrix)", desc: "Configurable cutoff routing, 12-Month Matrix & Safe-Spend", page: 9 },
        { num: "08", title: "Accounts & Goals, Wishlist & Scenario Planner", desc: "Savings goals, wishlist work-hour check, Monte Carlo lab", page: 10 },
        { num: "09", title: "Analytics, Reports, Subscriptions, Marquee & Preferences", desc: "XLSX/PDF exports, Kill-Switch, Marquee AI & Setup Wizard", page: 11 },
        { num: "10", title: "2-Minute Routine Playbook, Glossary & Shortcuts", desc: "Stress-free habit loop, A-Z definitions & keyboard keys", page: 12 },
      ];

  const sheets: string[] = [];

  sheets.push(
    renderTocHtml(
      lang,
      toc,
      isId ? "Cara Termudah Pakai Aplikasi Ini (Tanpa Catat Setiap Jajan)" : "The Easiest Way to Use Sunday Funday (Without Logging Every Coffee)",
      isId
        ? "Anda sama sekali tidak harus menginput setiap pengeluaran kecil seperti kopi atau parkir setiap hari. Catat saja tagihan rutin dan cicilan Anda, lalu 2 atau 3 hari sekali buka aplikasi bank Anda, masukkan total saldo real ke kolom Cash Rp di Wallet Reconciliation, dan klik Sync. Sistem langsung menyesuaikan Cycle Budget Used, rata-rata belanja harian, dan sisa jajan aman Anda."
        : "You never have to type in every small coffee or snack each day. Record recurring bills and credit installments once, then every 2 or 3 days enter your real bank/wallet balance into Wallet Reconciliation and click Sync. The dashboard automatically accounts for unrecorded spend and updates Cycle Budget Used and Safe-to-Spend cleanly.",
    ),
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">01 · Cara Kerja Siklus & Pembagian Gaji (Waterfall)</h2>
      <p class="chapter-sub">Urutan perlindungan uang Anda agar tagihan selalu terbayar sebelum dana bebas digunakan.</p>
      ${renderWaterfallSvg("id")}
      <div class="two-col">
        <div class="card">
          <h3>Core Savings (Tabungan Utama)</h3>
          <p>Pos tabungan prioritas yang langsung diisi segera setelah kewajiban cicilan, tagihan rutin bulanan, dan dana hidup harian terpenuhi. Terlindungi dari belanja impulsif.</p>
        </div>
        <div class="card">
          <h3>Flexible Surplus (Surplus Fleksibel)</h3>
          <p>Uang ekstra tersisa sesudah seluruh tagihan, dana makan/hidup, dan target Core Savings aman 100%. Bisa dipakai bebas untuk self-reward, hiburan, atau ditabung ekstra saat tutup siklus.</p>
        </div>
        <div class="card">
          <h3>Emergency Buffer & Temporary Savings Advance</h3>
          <p><strong>Emergency Buffer</strong> menyerap pengeluaran kejutan kecil di tengah bulan tanpa merusak jatah harian. <strong>Temporary Savings Advance</strong> melacak pinjaman sementara dari kantong tabungan saat ada kekurangan kas.</p>
        </div>
        <div class="card">
          <h3>Budget Shortfall (Jika Pemasukan Sedang Ketat)</h3>
          <p>Saat total target melebihi pemasukan siklus ini, <em>Core Savings</em> dan <em>Flexible Surplus</em> otomatis turun ke Rp 0 lebih dulu (<em>Proportional Living Cash Law</em>) agar dana hidup harian tetap positif.</p>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">01 · Paycycles & Waterfall Capital Flow</h2>
      <p class="chapter-sub">How your income protects bills and daily living expenses before filling savings and discretionary funds.</p>
      ${renderWaterfallSvg("en")}
      <div class="two-col">
        <div class="card">
          <h3>Core Savings</h3>
          <p>Your protected monthly savings goal allocated immediately after upcoming credit bills, routine quotas, and Daily Living cash are covered.</p>
        </div>
        <div class="card">
          <h3>Flexible Surplus</h3>
          <p>True disposable surplus remaining only after fixed bills, living cash, and your Core Savings target are 100% funded. Spend it freely on rewards or transfer it into savings at period close.</p>
        </div>
        <div class="card">
          <h3>Emergency Buffer & Temporary Savings Advance</h3>
          <p><strong>Emergency Buffer</strong> absorbs small mid-cycle surprises. <strong>Temporary Savings Advance</strong> tracks short-term draws borrowed from savings reserves so repayments remain transparent.</p>
        </div>
        <div class="card">
          <h3>Budget Shortfall Protection</h3>
          <p>If planned allocations exceed net income in a cycle, Core Savings and Flexible Surplus compress to Rp 0 first so your Daily Living cash pool remains positive proportionally.</p>
        </div>
      </div>`,
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">02 · Login Pertama, Keamanan PIN, Privasi & Navigasi</h2>
      <p class="chapter-sub">Menjaga keamanan akun pribadi dan menguasai kontrol global di Header maupun Sidebar.</p>
      <div class="two-col">
        <div class="card">
          <h3>Masuk Akun & Ganti Password Pertama</h3>
          <ul>
            <li><strong>Login Pertama (/change-password):</strong> Akun yang dibuat oleh administrator dibekali password sementara. Saat login pertama kali, Anda wajib membuat kata sandi baru minimal 10 karakter (huruf besar, huruf kecil, angka) dua kali sebelum masuk ke workspace.</li>
            <li><strong>Verifikasi PIN 6-Digit:</strong> Jika akun diaktifkan PIN keamanan, centang <em>Remember this network IP</em> di perangkat pribadi agar jaringan rumah dipercaya.</li>
            <li><strong>Lupa Password (/forgot-password):</strong> Masukkan username atau email akun Anda untuk menerima link pemulihan sekali pakai via email.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Header Atas & Kontrol Privasi Sidebar</h3>
          <ul>
            <li><strong>Search (Ctrl+K):</strong> Mencari transaksi apa pun atau menulis perintah entri cepat dari halaman mana saja.</li>
            <li><strong>Pemilih Periode (&lt; Nov 2026 &gt;):</strong> Melihat siklus lampau, siklus aktif, atau membuat periode draft baru via <em>Initialize New Period</em>.</li>
            <li><strong>Bahasa (EN / ID / 中文):</strong> Mengganti bahasa tampilan seketika melalui menu popover kanan atas.</li>
            <li><strong>Saldo Tersembunyi (Sidebar Bawah / Alt+H):</strong> Mengubah seluruh nominal menjadi <code>Rp •••••</code>; membuka angka pertama kali pada suatu sesi memerlukan konfirmasi kata sandi akun Anda.</li>
          </ul>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">02 · First Login, Security PIN, Privacy & Navigation</h2>
      <p class="chapter-sub">Account onboarding security, password recovery, and global shell controls.</p>
      <div class="two-col">
        <div class="card">
          <h3>Sign-In & Mandatory First-Login Setup</h3>
          <ul>
            <li><strong>First Login Password Change:</strong> Accounts provisioned with a temporary password automatically route to <code>/change-password</code> where you must confirm a personal 10+ character password (upper, lower, number) twice.</li>
            <li><strong>6-Digit Security PIN:</strong> Optional extra check on sign-in with <em>Remember this network IP</em> and Device Label support for trusted devices.</li>
            <li><strong>Password Recovery (/forgot-password):</strong> Sends a single-use reset link to your registered email address.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Top Navbar & Sidebar Controls</h3>
          <ul>
            <li><strong>Command Search (Ctrl+K):</strong> Searches transactions across periods and supports instant quick-entry commands.</li>
            <li><strong>Period Switcher (&lt; Nov 2026 &gt;):</strong> Navigates across historical, active, or newly initialized draft periods.</li>
            <li><strong>Locale Menu (EN / ID / 中文):</strong> Compact popover switching English, Indonesian, and Chinese labels cleanly.</li>
            <li><strong>Global Balance Toggle (Sidebar Footer / Alt+H):</strong> Masks all currency displays; first reveal in each session verifies your account password.</li>
          </ul>
        </div>
      </div>`,
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">03 · Overview Kolom 1: Safe-to-Spend & Wallet Sync</h2>
      <p class="chapter-sub">Cara membaca batas belanja aman harian dan menyinkronkan saldo bank tanpa catat transaksi kecil.</p>
      ${renderWalletSyncDiagramSvg("id")}
      <div class="two-col">
        <div class="card">
          <h3>Metrik Pacing & Proyeksi</h3>
          <ul>
            <li><strong>Safe-to-Spend Today:</strong> Batas belanja harian agar dana hidup cukup sampai gajian berikutnya.</li>
            <li><strong>Weighted 1.5x vs Flat Daily:</strong> Mode <em>Weighted 1.5x</em> memberi ruang akhir pekan lebih lega 1,5x dibanding hari kerja.</li>
            <li><strong>Cycle Budget Used:</strong> Progress bar ganda yang membandingkan <code>% anggaran terpakai</code> dengan garis penanda vertikal <code>% hari berjalan</code>. Selalu akurat baik dari entri manual maupun Wallet Sync.</li>
            <li><strong>Avg Daily Burn & Projected Cycle-End:</strong> Laju rata-rata keluar per hari dibandingkan target baseline dan proyeksi sisa/kelebihan di akhir siklus.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Wallet Reconciliation (Sync 10 Detik)</h3>
          <ul>
            <li><strong>Living Cash + Unpaid Bills = Expected Bank:</strong> Saldo kas hidup ditambah sisa dana tagihan rutin yang masih tersimpan di rekening Anda.</li>
            <li><strong>Guard vs Sync:</strong> Ketik saldo rekening aktual Anda di <code>Cash Rp</code>. Pilih mode perbandingan (<em>Total Bank</em> atau <em>Living Cash Only</em>). Klik <strong>Guard</strong> sekadar cek keamanan tanpa mengubah buku kas, atau klik <strong>Sync</strong> untuk langsung menyesuaikan saldo sistem ke saldo bank nyata lewat satu entri checkpoint (dilengkapi tombol <strong>Undo</strong>).</li>
          </ul>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">03 · Overview Col 1: Safe-to-Spend & Wallet Sync</h2>
      <p class="chapter-sub">Daily spending guidance and 10-second bank reconciliation with zero micro-logging fatigue.</p>
      ${renderWalletSyncDiagramSvg("en")}
      <div class="two-col">
        <div class="card">
          <h3>Pacing Metrics & Projections</h3>
          <ul>
            <li><strong>Safe-to-Spend Today:</strong> Recommended daily spending limit through the end of the current paycycle.</li>
            <li><strong>Weighted 1.5x vs Flat Daily:</strong> Allocates 1.5x daily allowance on weekends versus weekdays, or splits cash flatly.</li>
            <li><strong>Cycle Budget Used:</strong> Dual-indicator progress bar comparing <code>% budget used</code> directly against <code>% cycle time elapsed</code> (vertical tick marker). Stays accurate from both itemized entries and Wallet Sync.</li>
            <li><strong>Avg Daily Burn & Projected Cycle-End:</strong> Live average daily burn vs baseline target and projected cycle-end variance.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Wallet Reconciliation (Guard vs Sync)</h3>
          <ul>
            <li><strong>Expected Bank Formula:</strong> Sums Remaining Living Cash plus any Unpaid Routine Bill reserves still sitting in your account.</li>
            <li><strong>Guard vs Sync:</strong> Type your real bank total into <code>Cash Rp</code>. Choose <em>Total Bank</em> or <em>Living Cash Only</em> comparison. Use <strong>Guard</strong> for a read-only Survival Guard check, or <strong>Sync</strong> to record one Balance Checkpoint reconciling any unlogged spend (with <strong>Undo</strong> on the latest checkpoint).</li>
          </ul>
        </div>
      </div>`,
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">04 · Overview Kolom 2 & Kolom 3 (Pos Kustom & Catat Pengeluaran)</h2>
      <p class="chapter-sub">Menyesuaikan kategori rutin sesuai gaya hidup Anda sendiri dan mencatat belanja tunai maupun kredit.</p>
      <div class="two-col">
        <div class="card">
          <h3>Kolom 2: Living & Routine Bills Kustom</h3>
          <ul>
            <li><strong>Pos Rutin Dinamis:</strong> Di edisi Standar, Anda bisa menambah kategori sendiri lewat <strong>+ Add Routine Category</strong>, mengganti namanya (ikon pensil), maupun menghapus pos kustom yang tidak dipakai lagi.</li>
            <li><strong>Aksi Cepat per Pos:</strong> Gunakan <strong>Pay Full</strong> (lunas tunai), <strong>Roll to PayLater</strong> (pindah ke tagihan kredit bulan depan), atau <strong>Log Partial</strong> (bayar sebagian).</li>
            <li><strong>Cycle Allocation Mix:</strong> Bar 4 segmen memetakan porsi pengeluaran tetap, kas hidup harian, tabungan utama, serta surplus/buffer beserta tautan ke <em>Budgets & Envelopes</em> dan <em>Bills & Recurring</em>.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Kolom 3: Core Savings, Surplus & Record Expense (N)</h3>
          <ul>
            <li><strong>Core Savings & Surplus:</strong> Pantau target tabungan utama dan sisa <em>Flexible Surplus</em> + <em>Emergency Buffer</em> Anda.</li>
            <li><strong>Mode Record Expense:</strong> <em>Daily Spend</em> (kas harian), <em>Routine Bill</em> (pos rutin pilihan Anda), dan <em>Refund / Split</em> (mencatat penggantian patungan teman langsung memulihkan kuota harian).</li>
            <li><strong>Tunai / PayLater / Credit Card:</strong> Pilih metode bayar, tenor, tanggal beli di kalender gelap <em>ErpDatePicker</em>, dan target <code>Billing Cycle</code> (otomatis cutoff atau pilih manual) dengan pratinjau biaya dalam jam kerja.</li>
          </ul>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">04 · Overview Col 2 & Col 3 (Custom Categories & Expense Entry)</h2>
      <p class="chapter-sub">Personalizing routine envelopes, reviewing cycle allocation mix, and recording cash or credit entries.</p>
      <div class="two-col">
        <div class="card">
          <h3>Col 2: Custom Living & Routine Envelopes</h3>
          <ul>
            <li><strong>Manage Categories Dynamically:</strong> Add your own custom expense categories via <strong>+ Add Routine Category</strong>, rename labels inline, or remove unused custom pockets cleanly.</li>
            <li><strong>One-Click Settlement Actions:</strong> Pay remaining quota with <strong>Pay Full</strong>, defer onto the debt schedule with <strong>Roll to PayLater</strong>, or record partial payments via <strong>Log Partial</strong>.</li>
            <li><strong>Cycle Allocation Mix:</strong> Summarizes your cycle paycheck split across Fixed Bills & Debt, Daily Living Pool, Core Savings, and Surplus & Buffer.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Col 3: Core Savings, Surplus & Record Expense (Key N)</h3>
          <ul>
            <li><strong>Savings & Buffer Cards:</strong> Show real-time funded Core Savings and Flexible Surplus + Emergency Buffer targets.</li>
            <li><strong>Expense Modes:</strong> Log <em>Daily Spend</em>, <em>Routine Bill</em> (from your custom routine list), or <em>Refund / Split</em> when splitting shared bills with friends.</li>
            <li><strong>Payment Methods:</strong> Switch cleanly between <em>Living Cash</em>, <em>PayLater</em>, and <em>Credit Card</em> with Tenor buttons, dark <em>ErpDatePicker</em> calendar, <em>Billing Cycle</em> selector, and work-hour conversion.</li>
          </ul>
        </div>
      </div>`,
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">05 · Transactions Ledger, Payday Wizard & Bills Calendar</h2>
      <p class="chapter-sub">Kelola seluruh histori transaksi di satu buku besar, jalankan ritual gajian, dan pantau kalender tagihan.</p>
      <div class="stack">
        <div class="card">
          <h3>Transactions Ledger (<code>/ledger</code> — Khusus Edisi Standar)</h3>
          <p>Menampilkan daftar transaksi lengkap untuk periode terpilih beserta pencarian teks, filter tipe (<em>All Activity</em>, <em>Inflows</em>, <em>Daily Spend</em>, <em>Bills</em>), aksi edit nominal/tanggal/pos (memakai <em>ErpDatePicker</em>), hapus baris, serta tombol ekspor transaksi ke Excel maupun akses cepat ke rekonsiliasi kas.</p>
        </div>
        <div class="two-col">
          <div class="card">
            <h3>Payday & Closing Wizard (<code>/payday-wizard</code>)</h3>
            <p>Checklist terstruktur setiap hari gajian dan saat menutup bulan. Mengonfirmasi tanggal masuk gaji aktual, memverifikasi kecukupan kas untuk seluruh tagihan jatuh tempo, dan mengunci siklus yang telah selesai menjadi <code>LOCKED</code> agar riwayat masa lalu aman dari edit tak sengaja.</p>
          </div>
          <div class="card">
            <h3>Bills & Recurring / Cash Radar (<code>/calendar</code>)</h3>
            <p>Menampilkan garis waktu proyeksi kas harian dan menyorot <strong>Lowest Cash Point</strong> (hari dengan saldo kas paling ketat) supaya Anda bisa mengatur tempo transaksi sebelum tanggal gajian berikutnya tiba.</p>
          </div>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">05 · Transactions Ledger, Payday Wizard & Bills Calendar</h2>
      <p class="chapter-sub">Full transaction management, guided payday activation, and daily liquidity calendar tracking.</p>
      <div class="stack">
        <div class="card">
          <h3>Transactions Ledger (<code>/ledger</code> — Standard Workspace)</h3>
          <p>Browse every inflow, deduction, bill settlement, and wallet checkpoint in the selected period. Supports instant search, category/source filters, inline edits (via custom <em>ErpDatePicker</em> and bucket selectors) while the cycle is open, and Excel ledger export.</p>
        </div>
        <div class="two-col">
          <div class="card">
            <h3>Payday & Closing Wizard (<code>/payday-wizard</code>)</h3>
            <p>Interactive checklist validating your paycheck payout date, reviewing chronological upcoming due bills, confirming cash coverage, and cleanly locking completed cycles into read-only history.</p>
          </div>
          <div class="card">
            <h3>Bills & Recurring Calendar (<code>/calendar</code>)</h3>
            <p>Day-by-day liquidity radar highlighting your <strong>Lowest Cash Point</strong> and itemized maturing obligations across the full paycycle window.</p>
          </div>
        </div>
      </div>`,
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">06 · Income & Cash Flow, Budgets & Statement Import</h2>
      <p class="chapter-sub">Mengatur sumber pemasukan, simulasi anggaran & rollover amplop, serta impor mutasi bank sekaligus.</p>
      <div class="two-col">
        <div class="card">
          <h3>Income & Cash Flow (<code>/payroll</code>)</h3>
          <ul>
            <li>Atur gaji pokok, hari kerja/penyesuaian, potongan, bonus/THR, serta tanggal masuk gaji aktual agar batas hari siklus akurat.</li>
            <li>Simulasi pembagian tagihan hari gajian dan hitung upah bersih per jam kerja (memasukkan durasi perjalanan kerja bila diisi).</li>
          </ul>
        </div>
        <div class="card">
          <h3>Budgets & Envelopes (<code>/allocations</code>)</h3>
          <ul>
            <li>Uji skenario perubahan kuota makan harian maupun tabungan sebelum menekan <strong>Apply Quota</strong>.</li>
            <li>Pilih kebijakan akhir bulan tiap pos rutin (sisa amplop disapu otomatis ke Core Savings atau dibiarkan) dan jadwalkan dana berkala (<em>Periodic Bill Set-Asides</em>).</li>
          </ul>
        </div>
      </div>
      <div class="card">
        <h3>Statement Import (<code>/import</code>)</h3>
        <p>Tempel salinan baris mutasi PayLater atau kartu kredit, klik <strong>Parse & Auto-Route</strong> agar mesin Go otomatis merutekan ke periode jatuh tempo berdasarkan tanggal cutoff instrumen Anda dan menyaring duplikat. Baris yang mengarah ke bulan yang sudah <em>LOCKED</em> aman digeser otomatis ke periode terbuka terawal sebelum Anda klik <strong>Commit Selected Rows</strong>.</p>
      </div>`
      : `
      <h2 class="chapter-title">06 · Income & Cash Flow, Budgets & Statement Import</h2>
      <p class="chapter-sub">Configuring inflows, simulating envelope budgets, and importing multi-line statements safely.</p>
      <div class="two-col">
        <div class="card">
          <h3>Income & Cash Flow (<code>/payroll</code>)</h3>
          <ul>
            <li>Configure monthly base income, adjustments, deductions, bonuses/THR modes, and confirmed payout date to anchor cycle start/end boundaries.</li>
            <li>Compute true net hourly wage to evaluate purchases in real work hours.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Budgets & Envelopes (<code>/allocations</code>)</h3>
          <ul>
            <li>Interactive quota simulator showing live impact on Projected Savings, Surplus, and any budget shortfall before applying changes.</li>
            <li>Set envelope rollover behavior (sweep unspent amounts to Core Savings or keep) and create monthly reserves for periodic multi-month bills.</li>
          </ul>
        </div>
      </div>
      <div class="card">
        <h3>Statement Import (<code>/import</code>)</h3>
        <p>Paste raw statement text, run <strong>Parse & Auto-Route</strong> to let the Go reconciler route lines across cutoffs and deduplicate entries, verify automatically advanced rows away from locked periods, and commit checked items atomically.</p>
      </div>`,
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">07 · Installments & Bills (Hukum Cutoff & Matrix 12 Bulan)</h2>
      <p class="chapter-sub">Mengelola jadwal tagihan kredit, cicilan multi-bulan, simulasi batas aman 35%, dan strategi pelunasan.</p>
      ${renderCutoffDiagramSvg("id", "standard")}
      <div class="two-col">
        <div class="card">
          <h3>Debt Matrix & Matrix Cell Drawer (<code>/credit</code>)</h3>
          <ul>
            <li>Pantau plafon utang sehat di batas maksimal <strong>35%</strong> dari pemasukan bersih lewat tombol <em>Optimal Ceiling</em> dan <em>Safe Ceiling</em>.</li>
            <li>Klik sel bulan mana saja pada tabel 12 bulan untuk mengedit angka langsung atau membuka <strong>Matrix Cell Drawer</strong>: tambah cicilan, geser bulan (<code>Earlier/Later</code>), pecah tagihan melewati cutoff (<code>Split</code>), serta tandai lunas.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Safe-Spend Simulator, Bridge Loan & Optimizer</h3>
          <ul>
            <li><strong>Safe-Spend Simulator:</strong> Menguji transaksi kredit sebelum membeli guna melihat periode penagihan dan dampaknya ke rasio utang.</li>
            <li><strong>Record Bridge Loan:</strong> Mencatat pinjaman dana talangan agar kas siklus berjalan bertambah tanpa merusak laporan gaji rutin.</li>
            <li><strong>Cards & Payoff Optimizer:</strong> Kelola langganan kartu kredit (termasuk tanggal akhir kontrak) dan bandingkan strategi lunas <em>Contractual</em> vs <em>Avalanche</em> vs <em>Snowball</em>.</li>
          </ul>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">07 · Installments & Bills (Cutoffs & 12-Month Matrix)</h2>
      <p class="chapter-sub">Configurable statement cutoff routing, 35% safe debt governance, and payoff optimization.</p>
      ${renderCutoffDiagramSvg("en", "standard")}
      <div class="two-col">
        <div class="card">
          <h3>12-Month Matrix & Cell Drawer (<code>/credit</code>)</h3>
          <ul>
            <li>Maintain healthy Debt Service Ratios below your configurable 35% safe threshold via <em>Optimal Ceiling</em> and <em>Safe Ceiling</em> controls.</li>
            <li>Click any PayLater or Personal Debt cell to edit inline or open the <strong>Matrix Cell Drawer</strong> to add items, shift periods, split bills across cutoffs, or mark settlements paid.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Safe-Spend Simulator, Bridge Loan & Payoff Plans</h3>
          <ul>
            <li><strong>Safe-Spend Simulator:</strong> Pre-checks planned purchases by date and tenor to confirm landing period and DSR safety.</li>
            <li><strong>Bridge Loan:</strong> Logs short-term liquidity injections separately from recurring income while scheduling repayments.</li>
            <li><strong>Card Controls & Optimizer:</strong> Manage recurring end-dates, early settlements, and compare <em>Contractual</em>, <em>Avalanche</em>, and <em>Snowball</em> payoff paths.</li>
          </ul>
        </div>
      </div>`,
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">08 · Accounts & Goals, Wishlist Simulator & Scenario Planner</h2>
      <p class="chapter-sub">Mengelola kantong tabungan, menimbang kelayakan wishlist, dan menjalankan stress-test masa depan.</p>
      <div class="stack">
        <div class="two-col">
          <div class="card">
            <h3>Accounts & Goals (<code>/savings</code>)</h3>
            <ul>
              <li>Catat setoran dan penarikan tabungan manual di buku log tabungan, pantau transfer Core Savings antar bulan di <em>Transfer Tracker</em>.</li>
              <li>Buat target tujuan tabungan lengkap dengan tanggal target memakai <em>ErpDatePicker</em>.</li>
              <li>Pantau <strong>Savings Runway</strong> (berapa hari cadangan bertahan) dan grafik Net Worth (Kas + Tabungan vs Pokok Utang aktif) beserta portofolio aset eksternal opsional.</li>
            </ul>
          </div>
          <div class="card">
            <h3>Wishlist Simulator (<code>/wishlist</code> — Khusus Edisi Standar)</h3>
            <ul>
              <li>Tambahkan barang incaran Anda beserta harga dan target bulan beli.</li>
              <li>Sistem menghitung harga barang dalam satuan <strong>Jam Kerja Riil</strong>, menguji dampaknya terhadap rasio utang bila dicicil, dan memungkinkan Anda menautkan barang wishlist langsung menjadi <em>Savings Goal</em> atau mengonversinya menjadi rencana cicilan.</li>
            </ul>
          </div>
        </div>
        <div class="card">
          <h3>Scenario & Goal Planner (<code>/scenarios</code>)</h3>
          <p>Uji skenario <em>what-if</em> selama 12 bulan ke depan memakai tuas tabungan ekstra, bonus, penghematan living, atau simulasi guncangan biaya <code>+15% Burn Shock</code>. Mesin Go menjalankan simulasi <strong>Monte Carlo Stress Test</strong> (tingkat ketahanan kas 12 bulan) dan menampilkan kurva perbandingan kekayaan bersih antara <em>Baseline</em> vs <em>Simulated</em>.</p>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">08 · Accounts & Goals, Wishlist Simulator & Scenario Planner</h2>
      <p class="chapter-sub">Building goal-oriented savings reserves, testing wishlist purchases against work hours, and running Go stress tests.</p>
      <div class="stack">
        <div class="two-col">
          <div class="card">
            <h3>Accounts & Goals (<code>/savings</code>)</h3>
            <ul>
              <li>Record manual savings deposits and withdrawals, reconcile period transfers in the <em>Monthly Savings Transfer Tracker</em>, and track goal completion dates via <em>ErpDatePicker</em>.</li>
              <li>Review live <strong>Savings Runway</strong> and liquid cash & savings vs external unpaid debt principal (with optional external portfolio toggle).</li>
            </ul>
          </div>
          <div class="card">
            <h3>Wishlist Simulator (<code>/wishlist</code> — Standard Workspace)</h3>
            <ul>
              <li>Catalog target purchases with expected prices and timing.</li>
              <li>Evaluates affordability impact in real <strong>Work Hours</strong> and Debt Service Ratio, letting you track items as Savings Goals or convert into structured installment plans.</li>
            </ul>
          </div>
        </div>
        <div class="card">
          <h3>Scenario & Goal Planner (<code>/scenarios</code>)</h3>
          <p>Model 12-month projections using adjustments for extra savings, bonuses, living changes, debt prepayments, or expense shocks (with 1-click <em>Debt-Free Sprint</em>, <em>Bonus Prepayment</em>, and <em>+15% Burn Shock</em> presets). Powered by the Go <strong>Monte Carlo Cashflow Stress Test</strong> and Surplus Allocation Frontier.</p>
        </div>
      </div>`,
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">09 · Analytics, Reports, Subscriptions, Marquee AI & Preferences</h2>
      <p class="chapter-sub">Ekspor laporan, pengaman langganan promo, asisten AI, serta personalisasi lengkap untuk workspace Anda.</p>
      <div class="two-col">
        <div class="card">
          <h3>Analytics, Reports & Promo Kill-Switch</h3>
          <ul>
            <li><strong>Spending & Trend Review (<code>/analytics</code>):</strong> Analisis perubahan belanja bulanan, tren disiplin, dan deteksi lonjakan pasca-cutoff.</li>
            <li><strong>Reports & Trends (<code>/reports</code>):</strong> Diagram alokasi dana, proyeksi 3 bulan, ekspor <strong>Excel (.xlsx)</strong>, <strong>Print / Save PDF</strong>, dan kirim email laporan.</li>
            <li><strong>Subscriptions (<code>/subscriptions</code>):</strong> Kelola langganan berulang plus aktifkan <em>Promo Kill-Switch</em> untuk memperingatkan sebelum tarif promo berakhir dan naik harga.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Marquee AI Co-Pilot & Preferences Studio</h3>
          <ul>
            <li><strong>Marquee AI (Orb / <code>Alt+M</code> / <code>/marquee</code>):</strong> Tanya kondisi saldo, uji simulasi cutoff, atau catat belanja lewat chat EN/ID/ZH dengan konfirmasi kartu 1-klik yang aman.</li>
            <li><strong>Preferences (<code>/preferences</code>):</strong> Atur formula gajian/prioritas, cutoff metode bayar, template pos, kunci AI pribadi (terenkripsi AES-256-GCM), notifikasi email, serta backup JSON akun Anda sendiri.</li>
            <li><strong>Setup Wizard & Request Rule:</strong> Luncurkan wizard pengaturan cepat 60 detik atau kirim permintaan fitur/rule khusus ke administrator.</li>
          </ul>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">09 · Analytics, Reports, Subscriptions, Marquee AI & Preferences</h2>
      <p class="chapter-sub">Reporting exports, renewal alerts, AI quick capture, and full workspace customization.</p>
      <div class="two-col">
        <div class="card">
          <h3>Analytics, Reports & Subscriptions</h3>
          <ul>
            <li><strong>Spending & Trend Review (<code>/analytics</code>):</strong> Tracks month-over-month spending velocity, discipline score, and anomaly alerts.</li>
            <li><strong>Reports & Trends (<code>/reports</code>):</strong> Visual allocation donut, 3-month liquidity forecast, <strong>Excel (.xlsx)</strong> export, <strong>Print / Save PDF</strong>, and email delivery.</li>
            <li><strong>Subscriptions & Kill-Switch (<code>/subscriptions</code>):</strong> Tracks recurring plans and warns you days before promotional pricing auto-renews at higher standard rates.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Marquee AI Co-Pilot & Preferences</h3>
          <ul>
            <li><strong>Marquee AI (Orb / <code>Alt+M</code> / <code>/marquee</code>):</strong> Context-aware financial assistant using deterministic backend tools and safe 1-click preview confirmation before any write.</li>
            <li><strong>Preferences (<code>/preferences</code>):</strong> 6-tab studio to tune paycycle rules, custom instrument cutoffs, routine templates, display/module toggles, AES-256-GCM AI keys, email alerts, and JSON backup/restore.</li>
            <li><strong>Setup Wizard & Request Rule:</strong> Re-run the 60-second setup wizard anytime or submit custom rule requests to your platform admin.</li>
          </ul>
        </div>
      </div>`,
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">10 · Playbook 2 Menit/Minggu, Kamus Istilah & Shortcuts</h2>
      <p class="chapter-sub">Rutinitas paling ringan menjaga keuangan tetap terkendali tanpa lelah mencatat setiap jajan.</p>
      <div class="two-col">
        <div class="card">
          <h3>Playbook Hemat Waktu</h3>
          <ul>
            <li><strong>2-3 Hari Sekali (1 Menit):</strong> Cek total rekening/e-wallet jajan -> masukkan ke <code>Cash Rp</code> -> tekan <strong>Sync</strong>.</li>
            <li><strong>Belanja Cicilan / Kredit:</strong> Catat 1x di <code>Record Expense</code> atau tempel daftar akhir minggu ke <code>/import</code>.</li>
            <li><strong>Setiap Hari Gajian:</strong> Buka <code>/payday-wizard</code> -> sahkan tanggal gaji cair -> cek daftar tagihan bulan berjalan -> tutup periode sebelumnya agar history bersih.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Glosarium Istilah & Shortcut Keyboard</h3>
          <table class="mini-tbl">
            <tr><td class="mono k">Flexible Surplus</td><td>Dana sisa bersih setelah tagihan, hidup harian, dan tabungan utama lunas.</td></tr>
            <tr><td class="mono k">Emergency Buffer</td><td>Penyangga tak terduga aktif selama siklus berjalan.</td></tr>
            <tr><td class="mono k">Cycle Budget Used</td><td>Persentase dana hidup terpakai vs hari siklus berjalan (sinkron via Sync).</td></tr>
            <tr><td class="mono k">Unpaid Bills</td><td>Dana tagihan/pos rutin yang masih berada di rekening sebelum dibayar.</td></tr>
            <tr><td class="mono k">Temporary Advance</td><td>Pinjaman sementara dari kantong tabungan saat kas menipis.</td></tr>
            <tr><td class="mono k">N / Ctrl+K</td><td>Fokus input Record Expense / Buka Command Search & Smart Entry.</td></tr>
            <tr><td class="mono k">Alt+M / Alt+H / [</td><td>Buka Marquee AI / Masking saldo / Lipat Sidebar kiri.</td></tr>
          </table>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">10 · Two-Minute Weekly Routine, Glossary & Shortcuts</h2>
      <p class="chapter-sub">How to stay completely on top of cashflow in minutes per week without manual receipt fatigue.</p>
      <div class="two-col">
        <div class="card">
          <h3>Two-Minute Routine Playbook</h3>
          <ul>
            <li><strong>Every 2-3 Days (60 Seconds):</strong> Enter your actual bank balance into <code>Cash Rp</code> on Overview and hit <strong>Sync</strong>. Review <code>Cycle Budget Used</code> vs elapsed timeline.</li>
            <li><strong>Credit / PayLater Activity:</strong> Log purchases once via <code>Record Expense</code> or import statement lines weekly on <code>/import</code>.</li>
            <li><strong>On Payday:</strong> Run <code>/payday-wizard</code> to confirm salary date, fund obligations, and close completed cycles.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Glossary & Keyboard Shortcuts</h3>
          <table class="mini-tbl">
            <tr><td class="mono k">Flexible Surplus</td><td>Leftover disposable funds once bills, living cash & Core Savings are funded.</td></tr>
            <tr><td class="mono k">Emergency Buffer</td><td>Mid-cycle reserve absorbing minor surprise outlays.</td></tr>
            <tr><td class="mono k">Cycle Budget Used</td><td>% of living budget spent vs % of cycle elapsed (synced automatically).</td></tr>
            <tr><td class="mono k">Unpaid Bills</td><td>Routine reserve still resting inside your bank waiting for settlement.</td></tr>
            <tr><td class="mono k">Temporary Advance</td><td>Cash drawn temporarily from savings pockets with tracked payback.</td></tr>
            <tr><td class="mono k">N / Ctrl+K</td><td>Jump to Record Expense / Open Global Command Search.</td></tr>
            <tr><td class="mono k">Alt+M / Alt+H / [</td><td>Toggle Marquee AI / Toggle Privacy Masking / Collapse Sidebar.</td></tr>
          </table>
        </div>
      </div>`,
  );

  const pageBodies = sheets.map((body, idx) =>
    renderSheet(lang, runningTitle, idx === 0 ? (isId ? "Daftar Isi" : "Contents") : `Section ${String(idx).padStart(2, "0")}`, idx + 2, sheets.length + 1, body),
  );

  const spec: GuideBookSpec = {
    filename: isId
      ? "Sunday-Funday-ERP-User-Guide-Standard-ID.pdf"
      : "Sunday-Funday-ERP-User-Guide-Standard-EN.pdf",
    edition: "standard",
    lang,
    eyebrow: isId ? "Dokumentasi Pengguna · Workspace Standar" : "Workspace Documentation · Standard Edition",
    title: isId ? "Panduan Pengguna Sunday Funday ERP" : "Sunday Funday ERP User Manual",
    subtitle: isId
      ? "Panduan lengkap penggunaan harian tanpa ribet: cara kerja anggaran, Wallet Sync 10 detik, cicilan, tabungan, wishlist, dan asisten Marquee."
      : "Complete end-to-end guide to zero-friction Wallet Syncing, custom budgets, cutoff routing, savings goals, wishlist simulations, and Marquee AI.",
    editionBadge: isId ? "Edisi Pengguna Standar" : "Standard Client Edition",
    audienceLabel: isId ? "Pengguna Standar (Standard General)" : "Standard General Workspace Users",
    versionLabel: "v2.8 · Nov 2026 · ID/EN",
    sheetsHtml: [],
  };
  spec.sheetsHtml = [buildCoverSheet(spec), ...pageBodies];
  return spec;
}

function wrapHtmlDocument(spec: GuideBookSpec): string {
  return `<!DOCTYPE html>
<html lang="${spec.lang}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(spec.title)} — ${escapeHtml(spec.editionBadge)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet" />
<style>
  @page {
    size: A4 portrait;
    margin: 0;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #0c0e14;
    color: #f3f4f6;
    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 9.4pt;
    line-height: 1.48;
  }
  .mono, code {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
  }
  code {
    background: #1d222e;
    border: 1px solid #282e3d;
    border-radius: 4px;
    padding: 1px 4px;
    font-size: 8.1pt;
    color: #10b78d;
  }
  .sheet {
    width: 210mm;
    height: 297mm;
    overflow: hidden;
    background: #0c0e14;
    color: #f3f4f6;
    padding: 12.5mm 15mm 12mm 15mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    page-break-after: always;
    break-after: page;
  }
  .sheet:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 7px;
    border-bottom: 1px solid #1f2430;
    margin-bottom: 11px;
    flex-shrink: 0;
  }
  .sheet-brand {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 8.2pt;
    color: #9ca3af;
  }
  .sheet-logo {
    width: 15px;
    height: 15px;
    display: inline-block;
  }
  .sheet-brand-name {
    color: #f3f4f6;
    font-weight: 600;
  }
  .sep { color: #384054; }
  .tag-pill {
    font-family: 'JetBrains Mono', monospace;
    font-size: 7.5pt;
    padding: 2px 7px;
    border-radius: 4px;
    background: #161922;
    border: 1px solid #282e3d;
    color: #9ca3af;
  }
  .sheet-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sheet-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 7px;
    border-top: 1px solid #1f2430;
    margin-top: 10px;
    font-size: 7.6pt;
    color: #6b7280;
    flex-shrink: 0;
  }
  /* Cover Page */
  .cover-sheet {
    justify-content: space-between;
    padding: 18mm 18mm 16mm 18mm;
  }
  .cover-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 14px;
    border-bottom: 1px solid #1f2430;
  }
  .cover-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .cover-logo {
    width: 38px;
    height: 38px;
  }
  .cover-brand-name {
    font-size: 13pt;
    font-weight: 600;
    color: #f3f4f6;
    letter-spacing: -0.01em;
  }
  .cover-brand-sub {
    font-size: 8.2pt;
    color: #9ca3af;
    margin-top: 1px;
  }
  .badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt;
    padding: 4px 10px;
    border-radius: 5px;
    border: 1px solid #282e3d;
    background: #161922;
    color: #f3f4f6;
  }
  .badge.emerald {
    background: #12352c;
    border-color: rgba(16, 183, 141, 0.5);
    color: #10b78d;
    font-weight: 600;
  }
  .cover-hero {
    margin: 22mm 0 10mm 0;
  }
  .eyebrow {
    font-size: 8.5pt;
    color: #10b78d;
    letter-spacing: 0.02em;
    margin-bottom: 10px;
  }
  .cover-title {
    font-family: 'Newsreader', Georgia, serif;
    font-size: 32pt;
    line-height: 1.12;
    font-weight: 400;
    letter-spacing: -0.02em;
    color: #f3f4f6;
    margin: 0 0 14px 0;
  }
  .cover-subtitle {
    font-size: 11pt;
    line-height: 1.58;
    color: #9ca3af;
    max-width: 158mm;
    margin: 0 0 22px 0;
  }
  .cover-meta-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .meta-card {
    background: #161922;
    border: 1px solid #282e3d;
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .meta-k { font-size: 7.8pt; color: #6b7280; }
  .meta-v { font-size: 9pt; font-weight: 600; color: #f3f4f6; }
  .cover-pillars {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: auto;
    margin-bottom: 14px;
  }
  .pillar-card {
    background: #11141c;
    border: 1px solid #1f2430;
    border-top: 2px solid #10b78d;
    border-radius: 6px;
    padding: 11px 12px;
  }
  .pillar-title {
    font-size: 9pt;
    font-weight: 600;
    color: #f3f4f6;
    margin-bottom: 4px;
  }
  .pillar-body {
    font-size: 8.2pt;
    line-height: 1.45;
    color: #9ca3af;
  }
  .cover-bottom {
    display: flex;
    justify-content: space-between;
    padding-top: 10px;
    border-top: 1px solid #1f2430;
    font-size: 7.8pt;
    color: #6b7280;
  }
  /* Chapters */
  .chapter-title {
    font-family: 'Newsreader', Georgia, serif;
    font-size: 16.5pt;
    font-weight: 500;
    line-height: 1.2;
    color: #f3f4f6;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .chapter-sub {
    font-size: 8.8pt;
    color: #9ca3af;
    margin: -4px 0 2px 0;
  }
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-items: stretch;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .card {
    background: #161922;
    border: 1px solid #282e3d;
    border-radius: 7px;
    padding: 11px 13px;
  }
  .card.tight {
    padding: 9px 12px;
  }
  .card h3 {
    font-size: 9.6pt;
    font-weight: 600;
    color: #f3f4f6;
    margin: 0 0 6px 0;
    padding-bottom: 5px;
    border-bottom: 1px solid #1f2430;
  }
  .card p {
    margin: 0;
    font-size: 8.6pt;
    line-height: 1.48;
    color: #d1d5db;
  }
  .card ul {
    margin: 0;
    padding-left: 14px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .card li {
    font-size: 8.5pt;
    line-height: 1.45;
    color: #d1d5db;
  }
  .card li strong {
    color: #f3f4f6;
  }
  .callout {
    background: #11141c;
    border: 1px solid #282e3d;
    border-left: 3px solid #10b78d;
    border-radius: 6px;
    padding: 9px 12px;
  }
  .callout.info {
    border-left-color: #38bdf8;
  }
  .callout-title {
    font-size: 9pt;
    font-weight: 600;
    color: #f3f4f6;
    margin-bottom: 3px;
  }
  .callout p {
    margin: 0;
    font-size: 8.4pt;
    line-height: 1.46;
    color: #9ca3af;
  }
  .diagram-box {
    background: #11141c;
    border: 1px solid #282e3d;
    border-radius: 7px;
    padding: 7px 9px;
  }
  .toc-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7px 12px;
  }
  .toc-row {
    background: #161922;
    border: 1px solid #1f2430;
    border-radius: 6px;
    padding: 8px 10px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }
  .toc-left {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
  }
  .toc-num {
    font-size: 8.5pt;
    font-weight: 600;
    color: #10b78d;
    flex-shrink: 0;
  }
  .toc-title {
    font-size: 8.8pt;
    font-weight: 600;
    color: #f3f4f6;
  }
  .toc-desc {
    font-size: 7.7pt;
    color: #9ca3af;
    margin-top: 2px;
  }
  .toc-page {
    font-size: 8pt;
    color: #6b7280;
    flex-shrink: 0;
  }
  .mini-tbl {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.1pt;
  }
  .mini-tbl td {
    padding: 4.5px 4px;
    border-bottom: 1px solid #1f2430;
    vertical-align: top;
    color: #d1d5db;
  }
  .mini-tbl tr:last-child td {
    border-bottom: none;
  }
  .mini-tbl td.k {
    width: 36%;
    color: #10b78d;
    font-weight: 600;
    white-space: nowrap;
    padding-right: 8px;
  }
</style>
</head>
<body>
${spec.sheetsHtml.join("\n")}
</body>
</html>`;
}

async function main() {
  const outDir = path.resolve(process.cwd(), "docs", "guides");
  fs.mkdirSync(outDir, { recursive: true });

  const specs: GuideBookSpec[] = [
    buildGabrielPages("id"),
    buildGabrielPages("en"),
    buildStandardPages("id"),
    buildStandardPages("en"),
  ];

  const executablePath = resolveChromeExecutable();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    for (const spec of specs) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
      const html = wrapHtmlDocument(spec);
      await page.setContent(html, { waitUntil: "networkidle2", timeout: 30000 });
      await page.evaluate(async () => {
        await (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready;
      });
      const outPath = path.join(outDir, spec.filename);
      await page.pdf({
        path: outPath,
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
      await page.close();
      const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
      console.log(`GENERATED: ${outPath} (${sizeKb} KB, ${spec.sheetsHtml.length} pages)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Failed generating user guides:", err);
  process.exit(1);
});
