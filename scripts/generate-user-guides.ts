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
          p1: "Core Savings Reserve",
          p1Sub: "Mengisi target tabungan utama dulu",
          p2: "Discretionary & Buffer",
          p2Sub: "Dana Bebas & Emergency Buffer",
          shortfall: "Jika Pemasukan Kurang: Tabungan & Discretionary otomatis Rp 0 agar Dana Hidup Harian tetap positif semaksimal mungkin.",
        }
      : {
          income: "Final Net Income",
          incomeSub: "Take-home pay + Extra inflows",
          stage1: "1. Upfront Obligations & Quotas",
          debt: "Maturing Debt & Bills",
          debtSub: "PayLater, Credit Cards, Loans",
          routine: "Fixed Routine Envelopes",
          routineSub: "Transport, Internet, Subscriptions",
          living: "2. Daily Spending Pool",
          livingSub: "Food, coffee, day-to-day spend",
          rem: "Remaining Disposable Pool",
          remSub: "Flows down to Reserves",
          p1: "Core Savings Reserve",
          p1Sub: "Fills main savings reserve up to target",
          p2: "Discretionary & Buffer",
          p2Sub: "Discretionary + Emergency Buffer",
          shortfall: "On Income Shortfall: Reserves & Discretionary automatically drop to Rp 0 so Daily Spending Pool stays positive first.",
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
          s2t: "2. Update Bank Balance",
          s2b: "Masukkan saldo rekening",
          s2c: "saat ini (termasuk tagihan)",
          s3t: "3. Klik 'Sync Balance'",
          s3b: "Sistem hitung selisih kas",
          s3c: "masuk ke Balance History",
          s4t: "4. Saldo & Laju Sinkron",
          s4b: "Cycle Budget Used & Daily",
          s4c: "Average otomatis akurat",
        }
      : {
          s1t: "1. Check Real Bank Balance",
          s1b: "Open bank / e-wallet total",
          s1c: "Skip logging daily coffees",
          s2t: "2. Update Bank Balance",
          s2b: "Enter current actual balance",
          s2c: "and optionally save check-in",
          s3t: "3. Click 'Sync Balance'",
          s3b: "Logs unrecorded spend gap",
          s3c: "into clean Balance History",
          s4t: "4. Overview Auto-Updates",
          s4b: "Cycle Budget Used, Daily",
          s4c: "Average & Spending Balance",
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
          ["Angka Deterministik & Konsisten", "Semua kuota, cutoff tagihan, dan simulasi utang dihitung dari satu sumber kebenaran."],
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
        { num: "01", title: "Cara Pakai Anti-Ribet & Konsep Waterfall", desc: "Payday cycle, Core Savings, Discretionary, Buffer", page: 3 },
        { num: "02", title: "Login, PIN, Password & Navigasi Global", desc: "Auth flow, Privacy Alt+H di Sidebar, Header, Ctrl+K", page: 4 },
        { num: "03", title: "Overview Kolom 1: Spending Balance & Bank Sync", desc: "Days to Payday, Daily Average, Bank Balance Sync", page: 5 },
        { num: "04", title: "Overview Kolom 2, Kolom 3 & Panel Bawah", desc: "Routine Bills, Bank / QRIS, Record Expense, Checklist", page: 6 },
        { num: "05", title: "Income & Payday + Cashflow Calendar (8-Hub IA)", desc: "Payday Closing (/payroll?sub=closing), Ledger, THR & Cash Radar", page: 7 },
        { num: "06", title: "Plan & Events + Sinking Funds + Anggaran Acara & Kegiatan", desc: "Sinking Funds, Penasihat 3-Tier Anggaran Acara & Shared Advance, KlikBCA Import", page: 8 },
        { num: "07", title: "Bills & Credit (Hukum Cutoff, One-Off Bills & Matrix)", desc: "One-Off Commitments (0% DSR), SPayLater M-15d, CC 25th, Optimizer", page: 9 },
        { num: "08", title: "Savings & Net Worth + Skenario What-If (/allocations)", desc: "Milestone dana darurat, Net Worth, Simulasi Stress Test 12 Bulan", page: 10 },
        { num: "09", title: "Reports & Insights (Statement, Trends, Audit & Export)", desc: "Audit disiplin, Multi-Period Analytics, Excel/PDF & Email", page: 11 },
        { num: "10", title: "Marquee AI Co-Pilot, Ctrl+K & Preferences 6-Tab", desc: "Stage-Commit aman, Template GreatDay, THR & Pacing Mode", page: 12 },
        { num: "11", title: "Superadmin Console & SQL Query Studio", desc: "Buat akun user + temp password, Audit Log, Safe SQL Browser", page: 13 },
        { num: "12", title: "Playbook Rutin, Glosarium Istilah & Shortcuts", desc: "Jadwal pakai 2 menit/minggu dan kamus semua istilah ERP", page: 14 },
      ]
    : [
        { num: "01", title: "Two-Minute Habit & Waterfall Philosophy", desc: "Payday cycle, Core Savings, Discretionary, Buffer", page: 3 },
        { num: "02", title: "Auth, 6-Digit PIN, Privacy & Global Shell", desc: "Sign-in flow, Alt+H Sidebar privacy toggle, Header, Ctrl+K", page: 4 },
        { num: "03", title: "Overview Col 1: Spending Balance & Bank Sync", desc: "Days to Payday, Daily Average, Bank Balance Sync", page: 5 },
        { num: "04", title: "Overview Col 2, Col 3 & Activity Tables", desc: "Routine Bills, Allocation Mix, Bank / QRIS, Checklist", page: 6 },
        { num: "05", title: "Income & Payday + Cashflow & Ledger (8-Hub IA)", desc: "Payday Closing (/payroll?sub=closing), Cash Radar, Ledger & THR", page: 7 },
        { num: "06", title: "Plan & Events + Sinking Funds + Event & Activity Budgets", desc: "Active Sinking Funds, 3-Tier Event Budget Advisor, KlikBCA Import", page: 8 },
        { num: "07", title: "Bills & Credit (Cutoff Law, One-Off Bills & Matrix)", desc: "One-Off Commitments (0% DSR), SPayLater M-15d, Permata CC 25th", page: 9 },
        { num: "08", title: "Savings & Net Worth + What-If Scenarios (/allocations)", desc: "Emergency milestones, Net Worth, 12-Month Cashflow Stress Testing", page: 10 },
        { num: "09", title: "Reports & Insights (Statement, Trends, Audit & Export)", desc: "Discipline audit, Multi-Period Trends, Excel/PDF & Email", page: 11 },
        { num: "10", title: "Marquee AI Co-Pilot, Ctrl+K & Preferences", desc: "Stage-Commit confirmation, Direct Deductions, THR & Pacing", page: 12 },
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
        ? "Banyak aplikasi keuangan gagal dipakai karena memaksa input tiap kali jajan Rp 25.000. Di Sunday Funday, pengeluaran besar/cicilan/tagihan cukup dicatat sekali (atau diimpor). Untuk jajan harian, cukup buka bank Anda 2-3 hari sekali, klik Update Bank Balance di kartu Spending Balance, lalu klik Sync Balance. Sistem otomatis menghitung selisih tak tercatat ke Balance History dan menjaga angka tetap akurat."
        : "Personal finance tools fail when they demand manual entry for every small coffee. In Sunday Funday, log bills and installments once (or import a statement), then open your bank every few days, click Update Bank Balance, enter your actual total, and hit Sync Balance. The engine logs the unrecorded gap cleanly into Balance History and updates Daily Average and Spending Balance automatically.",
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
          <h3>Discretionary (Dana Bebas)</h3>
          <p>Uang sisa <strong>bersih setelah seluruh utang lunas, pos rutin aman, dana hidup cukup, dan Core Savings terpenuhi</strong>. Misalnya tertera <span class="mono">Rp 250.000</span>: ini dana bebas yang aman untuk self-reward, hobi, ekstra jajan akhir pekan, atau dipindah manual ke tabungan ekstra saat tutup periode.</p>
        </div>
        <div class="card">
          <h3>Emergency Buffer (Penyangga Darurat)</h3>
          <p>Bantalan pengaman khusus di dalam siklus aktif (terpisah dari Dana Darurat jangka panjang) agar lonjakan biaya mendadak seperti servis motor atau obat tidak langsung merusak alokasi hidup harian.</p>
        </div>
        <div class="card">
          <h3>Temporary Savings Advance & Budget Shortfall</h3>
          <p><strong>Temporary Savings Advance:</strong> Pinjaman sementara dari kantong tabungan saat kas siklus kurang, dengan pengingat jadwal pengembalian. <strong>Budget Shortfall:</strong> Selisih saat total target melebihi gaji. Sistem menerapkan aturan perlindungan belanja harian: Core Savings & Discretionary otomatis turun ke Rp 0 terlebih dahulu agar anggaran hidup harian tetap positif.</p>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">01 · Paycycle Law & Two-Priority Waterfall</h2>
      <p class="chapter-sub">How every cycle paycheck flows through fixed obligations before funding savings and discretionary funds.</p>
      ${renderWaterfallSvg("en")}
      <div class="two-col">
        <div class="card">
          <h3>Core Savings</h3>
          <p>Your primary monthly savings commitment protected from daily spending. Funded first once maturing debt bills, routine quotas, and Daily Spending Pool are reserved.</p>
        </div>
        <div class="card">
          <h3>Discretionary (e.g. Rp 250.000)</h3>
          <p>True leftover cash remaining <strong>only after debt, routine bills, daily living budget, and Core Savings target are 100% covered</strong>. You can spend it guilt-free on hobbies, weekend outings, or sweep it into long-term savings when closing the period.</p>
        </div>
        <div class="card">
          <h3>Emergency Buffer</h3>
          <p>An active-cycle shock absorber (separate from your long-term Emergency Fund pockets) that absorbs small unexpected bills without instantly shrinking daily food allowances.</p>
        </div>
        <div class="card">
          <h3>Temporary Savings Advance & Budget Shortfall</h3>
          <p><strong>Temporary Savings Advance:</strong> Cash temporarily borrowed from your own savings pockets when cashflow dips, tracked for repayment. <strong>Budget Shortfall:</strong> Occurs when planned targets exceed paycheck inflow; Core Savings and Discretionary compress to Rp 0 first so Daily Spending Pool stays funded proportionally.</p>
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
            <li><strong>Tombol Privasi Global (Sidebar Bawah + Alt+H):</strong> Menyembunyikan/membuka angka Rupiah (<code>Rp •••••</code>). Membuka angka pertama kali di tab baru wajib verifikasi password akun, dan selama saldo tersembunyi sistem otomatis mengunci aksi ubah target/saldo sambil memunculkan Toast satu-klik <em>Tampilkan Saldo</em>.</li>
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
            <li><strong>Global Balance Toggle (Sidebar Footer / Alt+H):</strong> Masks all currency outputs as <code>Rp •••••</code>. Unmasking for the first time in a tab requires account password verification, and while masked any budget edit or sync action pauses cleanly with a Toast prompt offering a one-click <em>Reveal Balances</em> action.</li>
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
      <h2 class="chapter-title">03 · Overview Kolom 1: Spending Balance & Bank Balance Sync</h2>
      <p class="chapter-sub">Penjelasan angka belanja harian, hari menuju gajian, dan sinkronisasi saldo bank.</p>
      ${renderWalletSyncDiagramSvg("id")}
      <div class="two-col">
        <div class="card">
          <h3>Spending Balance, Mode Harian & Cycle Budget Used</h3>
          <ul>
            <li><strong>Spending Balance & Days to Payday:</strong> Sisa jatah belanja harian aman sampai H-1 gajian berikutnya. Bawaan memakai <em>Flat Daily</em> agar angka mudah dibaca, dengan opsi <em>Weekend 1.5x</em> bila dibutuhkan.</li>
            <li><strong>Cycle Budget Used:</strong> Menunjukkan <code>% anggaran terpakai</code> terhadap penanda waktu siklus berjalan. Otomatis terbarui dari pencatatan manual maupun Bank Balance Sync.</li>
            <li><strong>Daily Average & Unsettled Cycle Bills:</strong> Rata-rata belanja per hari dibanding target awal, serta sisa tagihan rutin bulan berjalan yang masih perlu ditahan di rekening bank.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Bank Balance Sync & Balance History</h3>
          <ul>
            <li><strong>Expected Balance:</strong> Satu angka utuh saldo bank yang diharapkan (otomatis mencakup dana jajan ditambah sisa tagihan rutin belum lunas).</li>
            <li><strong>Update Bank Balance & Import Statement:</strong> Klik tombol <strong>Update Bank Balance</strong> untuk menyamakan catatan sistem dengan saldo bank nyata, atau langsung klik <strong>Import Statement</strong> untuk unggah mutasi KlikBCA/myBCA/Permata. Selisih tercatat rapi ke <strong>Balance History</strong> lengkap dengan tombol <strong>Undo</strong>.</li>
          </ul>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">03 · Overview Col 1: Spending Balance & Bank Balance Sync</h2>
      <p class="chapter-sub">Daily allowance clarity, days to payday, and a unified Bank Balance Sync workflow.</p>
      ${renderWalletSyncDiagramSvg("en")}
      <div class="two-col">
        <div class="card">
          <h3>Spending Balance, Pacing Mode & Cycle Budget Used</h3>
          <ul>
            <li><strong>Spending Balance & Days to Payday:</strong> Recommended daily spending allowance until the day before next payday. Uses <em>Flat Daily</em> by default (configurable in Preferences), with optional <em>Weekend 1.5x</em> weighting.</li>
            <li><strong>Cycle Budget Used:</strong> Compares <code>% budget consumed</code> directly against <code>% cycle time elapsed</code>. Captures both itemized entries and Bank Balance Sync updates automatically.</li>
            <li><strong>Daily Average & Unsettled Cycle Bills:</strong> Actual daily spend rate vs target alongside any unpaid routine bills still reserved inside your bank account.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Bank Balance Sync & Balance History</h3>
          <ul>
            <li><strong>Expected Balance:</strong> Single unified figure showing what your bank/wallet balance should hold right now (including reserved unpaid routine bills when applicable).</li>
            <li><strong>Update Bank Balance & Import Statement:</strong> Expand <strong>Update Bank Balance</strong> to reconcile real bank balances in one step (or open <strong>Import Statement</strong> directly). All adjustments record cleanly in <strong>Balance History</strong> with one-click <strong>Undo</strong> on the latest entry.</li>
          </ul>
        </div>
      </div>`,
  );

  // Sheet 6: Overview Col 2, Col 3 & Lower Sections
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">04 · Overview Kolom 2, Kolom 3 & Panel Aktivitas Bawah</h2>
      <p class="chapter-sub">Mengelola pos rutin bulanan, mencatat pengeluaran Bank / QRIS atau kredit, dan memantau kelunasan tagihan.</p>
      <div class="two-col">
        <div class="card">
          <h3>Kolom 2: Living & Routine Bills + Allocation Mix</h3>
          <ul>
            <li><strong>Daily Food & Living Budget:</strong> Plafon uang makan/jajan satu siklus penuh. Klik ikon pensil untuk mengubah target bulan aktif (tercatat di Audit Revisi).</li>
            <li><strong>Daftar Pos Rutin (Transport, Internet / Tagihan khusus):</strong> Setiap pos punya progres penggunaan dan tiga aksi cepat: <strong>Pay Full</strong> (lunas dari kuota), <strong>Roll to PayLater</strong> (lempar sisa kuota ke Matrix bulan depan agar kas tunai selamat), dan <strong>Log Partial</strong> (bayar cicil/sebagian). Bila sudah berstatus <em>Settled in full</em>, target kuota otomatis terkunci agar pencatatan tidak selisih (ubah/batalkan via Ledger bila perlu revisi).</li>
            <li><strong>+ Enable / Adjust Routine Quota:</strong> Membuka pos bernilai Rp 0 hanya pada bulan tertentu saat siklus masih aktif.</li>
            <li><strong>Cycle Allocation Mix:</strong> Bar 4 warna yang merangkum proporsi gaji bulan ini ke Tagihan Tetap & Utang, Kas Hidup, Core Savings, serta Discretionary & Buffer, lengkap dengan link ke <code>Full Plan</code> dan <code>Due Calendar</code>.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Kolom 3: Core Savings, Discretionary & Record Expense</h3>
          <ul>
            <li><strong>Core Savings & Discretionary Cards:</strong> Menunjukkan realisasi tabungan wajib serta sisa dana bebas dan buffer (visibilitas kartu Discretionary dapat diatur di Preferences).</li>
            <li><strong>Mode Input Record Expense (Pintasan N):</strong> Pilih <em>Daily Spend</em> (jajan harian), <em>Routine Bill</em> (potong kuota rutin), atau <em>Refund / Split</em> (mengembalikan jatah harian saat patungan dibayar teman tanpa menggembungkan gaji).</li>
            <li><strong>Metode Bayar & Rute Cutoff:</strong> Pilih <code>Bank / QRIS</code>, <code>PayLater</code>, atau <code>Credit Card</code>. Saat kredit dipilih, atur <em>Tenor</em>, pilih tanggal di kalender gelap <em>ErpDatePicker</em>, dan cek pratinjau <code>Billing Cycle</code>.</li>
            <li><strong>Work-Hours Cost:</strong> Otomatis menampilkan berapa jam kerja riil yang setara dengan nominal yang Anda ketik.</li>
          </ul>
        </div>
      </div>
      <div class="card tight">
        <h3>Bar Status Atas & Panel Bawah Overview</h3>
        <p><strong>Active Cycle Bar:</strong> Tombol <code>Recalculate</code> menyinkronkan ulang rumus waterfall; <code>Close Period</code> mengunci siklus bila semua sudah final. <strong>Bill Settlement Checklist:</strong> Daftar ceklis tagihan jatuh tempo yang harus ditahan di rekening. <strong>Cashflow Summary & Recent Transactions:</strong> Ringkasan Pemasukan Bersih dikurangi Tagihan Terjadwal serta daftar transaksi terbaru.</p>
      </div>`
      : `
      <h2 class="chapter-title">04 · Overview Col 2, Col 3 & Lower Ledger Panels</h2>
      <p class="chapter-sub">Managing routine monthly envelopes, logging Bank / QRIS or credit entries, and tracking settlement checklists.</p>
      <div class="two-col">
        <div class="card">
          <h3>Col 2: Living & Routine Bills + Cycle Allocation Mix</h3>
          <ul>
            <li><strong>Daily Food & Living Budget:</strong> Full-cycle allowance for everyday expenses; click the inline pencil to edit the target (logged with revision history).</li>
            <li><strong>Routine Quotas:</strong> Track utilization per category and act in one click with <strong>Pay Full</strong>, <strong>Roll to PayLater</strong> (defer onto the Debt Matrix without spending cash today), or <strong>Log Partial</strong>. Settled-in-full items lock their revision button safely so settled balances stay intact unless adjusted in Ledger.</li>
            <li><strong>+ Enable / Adjust Routine Quota:</strong> Expand zero-target categories only when active cycles are open.</li>
            <li><strong>Cycle Allocation Mix:</strong> Four-segment proportional strip comparing Fixed Bills & Debt, Daily Living Pool, Core Savings, and Surplus & Buffer with quick links to <code>Full Plan</code> and <code>Due Calendar</code>.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Col 3: Core Savings, Discretionary & Record Expense (Key N)</h3>
          <ul>
            <li><strong>Savings & Discretionary Cards:</strong> Display funded Core Savings reserve alongside Discretionary and Emergency Buffer (visibility configurable in Preferences).</li>
            <li><strong>Expense Modes:</strong> Switch between <em>Daily Spend</em>, <em>Routine Bill</em> (deducts selected envelope), and <em>Refund / Split</em> (restores spending budget directly when reimbursed by friends).</li>
            <li><strong>Bank / QRIS vs Credit Routing:</strong> Selecting <code>PayLater</code> or <code>Credit Card</code> unlocks Tenor pills, the dark obsidian <em>ErpDatePicker</em>, <code>Billing Cycle</code>, quick-tap amount presets, and live <code>Work Hours</code> cost feedback.</li>
          </ul>
        </div>
      </div>
      <div class="card tight">
        <h3>Top Period Actions & Bottom Overview Tables</h3>
        <p><strong>Active Cycle Bar:</strong> <code>Recalculate</code> refreshes all allocation figures cleanly; <code>Close Period</code> locks a finished cycle into immutable history. Below sit the projection strip, <strong>Bill Settlement Checklist</strong>, <strong>Cashflow Summary</strong>, and <strong>Recent Transactions</strong>.</p>
      </div>`,
  );

  // Sheet 7: Payday & Closing, Cash Calendar & Payroll
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">05 · Payday & Closing, Cash Calendar & Payroll</h2>
      <p class="chapter-sub">Konfirmasi setoran tabungan permanen, kalender arus kas, serta Direct Payroll Deductions (Benefit by GreatDay).</p>
      <div class="stack">
        <div class="card">
          <h3>Payday & Closing (<code>/payday-wizard</code>)</h3>
          <p>Checklist 4 langkah setiap hari gajian & penutupan periode: memverifikasi gaji, mengunci siklus sebelumnya, melunasi tagihan jatuh tempo, dan menekan <strong>Confirm Savings Deposit</strong>. Status konfirmasi kini tersimpan persisten di database (memakai instrumen <code>LIQUID_CASH</code> secara bawaan bila portofolio eksternal tidak aktif) sehingga tetap berstatus <em>Deposit Confirmed</em> saat halaman di-refresh.</p>
        </div>
        <div class="two-col">
          <div class="card">
            <h3>Cash Calendar (<code>/calendar</code>)</h3>
            <ul>
              <li>Memproyeksikan kurva kas harian dari awal hingga akhir siklus dengan <strong>tooltip interaktif saat kursor diarah</strong> pada tiap titik hari plus <strong>Lowest Cash Point</strong>.</li>
              <li><strong>Navigasi Tunggal & Strip Filter Terpisah:</strong> Pindah bulan terpusat di bar atas dan filter jenis aktivitas rapi di atas kisi tanggal, lengkap rincian item jatuh tempo (tgl <code>11, 17, 23, 24, 25</code>) serta <em>Core Savings Transfer</em>.</li>
            </ul>
          </div>
          <div class="card">
            <h3>Payroll & Income (<code>/payroll</code>)</h3>
            <ul>
              <li><strong>Slip Net Pay vs Transferred to Bank:</strong> Memisahkan gaji bersih slip (mis. Des '26 <code>Rp 5.904.000</code>), <strong>Direct Payroll Deductions</strong> (<code>Benefit by GreatDay -Rp 360.500</code> = pelunasan Rp 350.000 + fee Rp 10.500), menjadi transfer rekening Permata <code>Rp 5.543.500</code>, ditambah THR Des tepat <code>264/365</code> hari = <code>Rp 3.833.425</code> (<code>Total Cycle Inflow Rp 9.376.925</code>).</li>
              <li><strong>Panel Kerja 2-Kartu & Kontras Segmented:</strong> Area kanan memisahkan <em>Cycle Parameters & Payout</em> dan <em>Direct Payroll Deductions</em> lengkap dengan tombol pemilih modern (tanpa dropdown kaku) serta grid bawah yang simetris.</li>
            </ul>
          </div>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">05 · Payday & Closing, Cash Calendar & Payroll</h2>
      <p class="chapter-sub">Persistent savings deposit confirmation, daily cash calendar, and Direct Payroll Deductions.</p>
      <div class="stack">
        <div class="card">
          <h3>Payday & Closing (<code>/payday-wizard</code>)</h3>
          <p>4-step payday checklist verifying income and payout date, locking completed cycles, settling scheduled obligations, and recording Core Savings transfers. Clicking <strong>Confirm Savings Deposit</strong> writes idempotently to PostgreSQL (<code>LIQUID_CASH</code> when external portfolio is off) and hydrates persistently on every reload as <em>Deposit Confirmed</em>.</p>
        </div>
        <div class="two-col">
          <div class="card">
            <h3>Cash Calendar (<code>/calendar</code>)</h3>
            <ul>
              <li>Maps projected bank balance day by day with an <strong>interactive hover tooltip curve</strong> showing exact balance, daily net delta, and <strong>Lowest Cash Point</strong>.</li>
              <li><strong>Single Topbar Switcher & Filter Strip:</strong> Period navigation stays unified in the header bar while category pills sit cleanly above the date grid with itemized obligations and <em>Core Savings Transfer</em> entries.</li>
            </ul>
          </div>
          <div class="card">
            <h3>Payroll & Income (<code>/payroll</code>)</h3>
            <ul>
              <li><strong>Slip Net Pay to Bank Transfer:</strong> Separates regular <em>Slip Net Pay</em> (e.g. Dec '26 <code>Rp 5.904.000</code>) minus itemized <strong>Direct Payroll Deductions</strong> (<em>Benefit by GreatDay</em> <code>-Rp 360.500</code>) into exact <strong>Transferred to Bank</strong> (<code>Rp 5.543.500</code>) plus exact <code>264/365</code> prorated THR (<code>Rp 3.833.425</code> = <code>Rp 9.376.925</code> total cycle inflow).</li>
              <li><strong>Two-Card Executive Workbench:</strong> Separates <em>Cycle Parameters & Payout Schedule</em> from <em>Direct Payroll Deductions</em> with segmented toggle pills and a balanced lower grid.</li>
            </ul>
          </div>
        </div>
      </div>`,
  );

  // Sheet 8: Monthly Plan & Statement Import
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">06 · Monthly Plan (Allocations) & Impor Mutasi Bank Aman</h2>
      <p class="chapter-sub">Merancang alokasi gaji bulanan serta mengimpor CSV KlikBCA / tempel mutasi myBCA & Permata tanpa password bank.</p>
      <div class="two-col">
        <div class="card">
          <h3>Monthly Plan / Allocations (<code>/allocations</code>)</h3>
          <ul>
            <li><strong>Plan & Quota Simulator:</strong> Menguji perubahan target <em>Daily Food & Living Quota</em> maupun target tabungan dengan efek langsung ke <em>Projected Savings</em> dan status defisit sebelum mengklik <strong>Apply Quota</strong>.</li>
            <li><strong>Routine & Sinking Reserve:</strong> Mengatur kebijakan akhir siklus tiap amplop rutin (<em>Sweep Unspent to Core Savings</em> atau biarkan).</li>
            <li><strong>Periodic Bill Set-Asides:</strong> Jadwal cadangan dana berkala agar pengeluaran tahunan tetap terdanai rata.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Safe Statement Import (<code>/import</code>)</h3>
          <ul>
            <li><strong>Monthly Plan &amp; Active Sinking Funds (<code>/allocations?sub=plan</code>):</strong> Mengatur simulasi kuota, perilaku rollover amplop, dan membuat target dana berkala dengan tombol <strong>+ Contribute</strong>.</li>
            <li><strong>Anggaran Acara &amp; Kegiatan (<code>/allocations?sub=events</code>):</strong> Merencanakan budget acara, jalan-jalan, atau outing dengan default tanggal hari ini, rekomendasi 3 tingkat (<em>Conservative</em>, <em>Balanced</em>, <em>Max Safe</em>) yang menyesuaikan siklus tanggal acara, catatan talangan teman (<em>Shared Advance</em>), dan <strong>Close &amp; Sweep</strong> ke Core Savings/Discretionary.</li>
            <li><strong>Statement Import (<code>/calendar?sub=import</code>):</strong> Terpadu rapi di tab ke-3 hub <em>Cashflow &amp; Ledger</em>.</li>
          </ul>
        </div>
      </div>
      <div class="callout emerald">
        <div class="callout-title">Keamanan Ekspor Offline (Tanpa Akses Login Bank)</div>
        <p>Sistem tidak pernah meminta PIN m-Banking atau kredensial KlikBCA. Gunakan berkas CSV resmi atau tempel teks mutasi biasa; seluruh nomor rekening disamarkan menjadi <code>****XXXX</code> sebelum masuk ke buku transaksi.</p>
      </div>`
      : `
      <h2 class="chapter-title">06 · Monthly Plan (Allocations) & Safe Statement Import</h2>
      <p class="chapter-sub">Interactive quota modeling plus safe KlikBCA CSV and myBCA / Permata statement parsing with zero bank credentials.</p>
      <div class="two-col">
        <div class="card">
          <h3>Monthly Plan / Allocations (<code>/allocations</code>)</h3>
          <ul>
            <li><strong>Monthly Plan &amp; Active Sinking Funds (<code>/allocations?sub=plan</code>):</strong> Previews Daily Living or Savings targets before applying and manages active sinking fund goals with instant <strong>+ Contribute</strong> deposits.</li>
            <li><strong>Event &amp; Activity Budgets (<code>/allocations?sub=events</code>):</strong> Defaults to today's date, resolves the exact paycycle containing your event date, computes 3 deterministic tiers (<em>Conservative</em>, <em>Balanced</em>, <em>Max Safe</em>) using modular category weights, isolates friend advances, and sweeps unused balance cleanly via <strong>Close &amp; Sweep</strong>.</li>
            <li><strong>Statement Import (<code>/calendar?sub=import</code>):</strong> Consolidated directly inside <em>Cashflow &amp; Ledger</em> alongside the Cash Calendar and Transaction Ledger.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Safe Statement Import (<code>/import</code>)</h3>
          <ul>
            <li><strong>KlikBCA CSV & myBCA/Permata Paste:</strong> Upload official KlikBCA CSV exports (<em>Informasi Rekening -> Mutasi Rekening -> Download CSV</em>) or paste myBCA/Permata/PayLater lines (up to 2 MB / 500 rows).</li>
            <li><strong>Smart Debit Filter & PII Masking:</strong> Skips incoming <code>CR</code> deposits, ignores running <code>Saldo</code> balance columns, handles <code>48,000.00 DB</code> decimals accurately, and masks 10 to 16 digit account numbers into <code>****XXXX</code>.</li>
            <li><strong>Lock-Safe Protection:</strong> Deduplicates against existing ledger rows and shifts locked-cycle rows safely forward before committing.</li>
          </ul>
        </div>
      </div>
      <div class="callout emerald">
        <div class="callout-title">Credential-Free Banking Workflow</div>
        <p>Sunday Funday never asks for banking logins, m-PINs, or scraping tokens. Offline CSV and clipboard parsing keep your account credentials completely isolated on your bank portal.</p>
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
            <li><strong>One-Off Commitments (<code>/credit?sub=commitments</code>):</strong> Catat kewajiban satu kali (misalnya penalti bus outing Rp 100.000 pasca-gajian) dengan pilihan <em>Paycheck Upfront</em>, <em>Discretionary</em>, atau <em>Emergency Buffer</em> — berstatus <code>0% DSR</code> (bukan cicilan) dan tampil otomatis di Cash Calendar &amp; Bill Checklist.</li>
            <li><strong>Safe-Spend Simulator, Bridge Loan &amp; Optimizer:</strong> Menguji transaksi sebelum membeli, mencatat talangan sementara, dan membandingkan pelunasan <em>Contractual</em> vs <em>Avalanche</em> vs <em>Snowball</em>.</li>
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
            <li><strong>One-Off Commitments (<code>/credit?sub=commitments</code>):</strong> Track non-recurring bills (for example, an outing bus fee payable after payday) funded via <em>Paycheck Upfront</em>, <em>Discretionary</em>, or <em>Emergency Buffer</em> with zero DSR debt-ratio penalty, plotted automatically onto Cash Calendar and Bill Checklist.</li>
            <li><strong>Safe-Spend Simulator, Bridge Loan &amp; Optimizer:</strong> Pre-screens planned purchases by date and tenor, logs short-term liquidity bridge inflows, and compares <em>Contractual</em>, <em>Avalanche</em>, and <em>Snowball</em> payoff plans.</li>
          </ul>
        </div>
      </div>`,
  );

  // Sheet 10: Savings & Scenario Lab
  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">08 · Savings & Net Worth + Cashflow What-If Lab</h2>
      <p class="chapter-sub">Membangun ketahanan dana darurat dan menguji ketahanan kas 12 bulan lintas skenario.</p>
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
          <h3>Cashflow What-If Lab &amp; Wishlist (<code>/allocations?sub=scenarios</code>)</h3>
          <ul>
            <li><strong>Scenario Inputs & 3 Preset Cepat:</strong> Geser slider <em>Extra Monthly Savings</em>, <em>One-Time Bonus / THR</em>, <em>Monthly Living Adjustment</em>, <em>Extra Debt Prepayment</em>, dan <em>Variable Expense Shock (%)</em>, atau gunakan preset instan <strong>Debt-Free Sprint</strong>, <strong>Bonus Prepayment</strong>, dan <strong>+15% Expense Shock</strong>.</li>
            <li><strong>Baseline vs Simulated 12-Month Curve:</strong> Membandingkan kurva kekayaan bersih dan tanggal bebas utang (DSR &lt; 15%).</li>
            <li><strong>12-Month Cashflow Resilience &amp; Surplus Split Advisor:</strong> Menguji ribuan simulasi fluktuasi pemasukan/pengeluaran untuk menghitung <em>12-Month Survival Rate (%)</em> serta rekomendasi pembagian surplus bulanan terbaik.</li>
          </ul>
        </div>
      </div>
      <div class="callout info">
        <div class="callout-title">Akurasi Saldo Tabungan (Epoch Isolation)</div>
        <p>Saldo Core Savings Reserve dihitung murni dari catatan mutasi nyata sejak periode epoch aktif (<code>10/2026</code>), bebas dari aset fiktif maupun pengembalian internal antar-kantong.</p>
      </div>`
      : `
      <h2 class="chapter-title">08 · Savings & Net Worth + Cashflow What-If Lab</h2>
      <p class="chapter-sub">Tracking verified cash reserves, debt milestones, and 12-month cashflow stress simulations.</p>
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
          <h3>Cashflow What-If Lab &amp; Wishlist (<code>/allocations?sub=scenarios</code>)</h3>
          <ul>
            <li><strong>Scenario Inputs & Presets:</strong> Test <em>Extra Monthly Savings</em>, <em>Bonus / THR Inflows</em>, <em>Living Adjustments</em>, <em>Extra Debt Prepayments</em>, and <em>Expense Shocks</em>, or trigger <strong>Debt-Free Sprint</strong>, <strong>Bonus Prepayment</strong>, and <strong>+15% Expense Shock</strong> presets.</li>
            <li><strong>Wealth Trajectory Curve:</strong> Overlays simulated 12-month net cash accumulation and DSR &lt; 15% milestones over baseline.</li>
            <li><strong>Cashflow Resilience &amp; Surplus Split Advisor:</strong> Computes 12-month cashflow survival probabilities under volatility and optimal monthly surplus split strategies.</li>
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
        <h3>Subscriptions &amp; Recurring + Pengingat Perpanjangan Promo (<code>/subscriptions</code>)</h3>
        <p>Mencatat seluruh langganan bulanan berulang (cloud storage, tools AI, musik, dll.) beserta status perpanjangan kartu kredit. <strong>Pengingat Perpanjangan Promo:</strong> Bila Anda berlangganan tarif promo sementara (misal diskon 3 bulan lalu naik ke harga normal), cukup masukkan tanggal batas (<em>Deadline Date</em>) dan tarif pasca-promo. Sistem menyalakan banner pengingat sebelum batas waktu lewat, lengkap dengan tautan langsung ke halaman pembatalan penyedia dan tombol pengiriman email pengingat.</p>
      </div>`
      : `
      <h2 class="chapter-title">09 · Analytics, Financial Reports & Subscriptions</h2>
      <p class="chapter-sub">Cross-cycle trend audits, spreadsheet/PDF reporting, and Renewal Notice protection.</p>
      <div class="two-col">
        <div class="card">
          <h3>Spending & Trend Review (<code>/analytics</code>)</h3>
          <p>Visualizes cross-cycle expense ratios, routine vs discretionary spending comparisons, cycle discipline health scores (<code>/audit</code>), and automated detection of post-cutoff charge creep.</p>
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
        <h3>Subscriptions & Recurring + Renewal Notice Guard (<code>/subscriptions</code>)</h3>
        <p>Centralizes recurring charges and card-linked plans. <strong>Renewal Notice:</strong> Whenever signing up for a discounted promo tier that renews at a higher standard rate later, log its <em>Deadline Date</em>, post-promo rate, and cancellation portal URL. Active alert banners and optional SMTP email reminders warn you days before renewal hits.</p>
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
        <p><strong>1. Paycycle & Priorities:</strong> Rumus gaji & DSL (variabel <code>DAYS_IN_MONTH</code>, <code>PAYDAY_DAY</code>, dst.) plus aturan hari gajian. <strong>2. Payment Methods & Cutoffs:</strong> Atur cutoff kartu kredit/PayLater memakai formula aman serta daftar akun kas/aset eksternal. <strong>3. Templates & Category Master Data:</strong> Template pos rutin, kategori kustom Acara/Komitmen/Dana Berkala (<code>CategoryMasterTableCard</code>), &amp; target tabungan. <strong>4. Account, Privacy & Display:</strong> UI Density, visibilitas modul sidebar, pintasan custom, &amp; key API AI. <strong>5. Notifications & Promo Watch:</strong> Konfigurasi SMTP terenkripsi. <strong>6. Backup, Restore & Data:</strong> Ekspor/pulihkan backup JSON pribadi.</p>
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
            <li><code>wallet 515000</code> : instant bank liquidity check.</li>
            <li><code>afford 1.5m spaylater 3x</code> : jump to credit affordability simulator.</li>
            <li><code>sql</code> (Superadmin) : jump straight to Superadmin SQL Studio.</li>
          </ul>
        </div>
      </div>
      <div class="card tight">
        <h3>6-Tab Preferences Studio (<code>/preferences</code>)</h3>
        <p><strong>1. Formula:</strong> Payday & allocation priority rules using safe formula DSL tokens. <strong>2. Instruments & Accounts:</strong> Custom cutoff expressions and external asset accounts. <strong>3. Templates & Categories:</strong> Routine bills, savings pockets, and custom Category Master Data tables (Event, Commitment, and Sinking Fund categories). <strong>4. Display & AI:</strong> UI Density mode, sidebar module overrides, custom shortcuts, and AES-256-GCM BYOK AI provider keys. <strong>5. Notifications:</strong> Encrypted SMTP and Renewal Notice alert thresholds. <strong>6. Backup:</strong> Tenant-scoped JSON backup & restore.</p>
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
            <li><strong>2-3 Hari Sekali (1 Menit):</strong> Cek total saldo rekening jajan Anda -> klik <strong>Update Bank Balance</strong> -> klik <strong>Sync Balance</strong>. Lihat perbandingan <code>Cycle Budget Used</code> dan <code>Daily Average</code> terhadap garis waktu berjalan.</li>
            <li><strong>Saat Belanja Kredit / Komitmen / Event:</strong> Catat 1x di Overview atau <code>/credit?sub=commitments</code> (One-Off) / <code>/allocations?sub=events</code> (Outing) — seluruh tab langsung terbarui <strong>real-time tanpa perlu refresh browser</strong>.</li>
            <li><strong>Tgl 15/16 &amp; 25 (Cek Cutoff):</strong> Sebelum checkout barang besar, pakai <code>Safe-Spend Simulator</code> supaya tahu jatuh di tagihan bulan mana.</li>
            <li><strong>Hari Gajian &amp; Akhir Siklus:</strong> Buka <code>/payroll?sub=closing</code> (<em>Income &amp; Payday -&gt; Payday &amp; Closing</em>) -> sahkan pemasukan gaji &amp; konfirmasi deposit tabungan -> lunasi pos rutin -> tutup periode (<em>Close Period</em>) agar tabungan bersih tersimpan.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Kamus Singkat Istilah &amp; Pintasan Keyboard</h3>
          <table class="mini-tbl">
            <tr><td class="mono k">Discretionary</td><td>Sisa gaji bebas pakai setelah utang, tagihan, dana hidup &amp; Core Savings beres.</td></tr>
            <tr><td class="mono k">Emergency Buffer</td><td>Cadangan darurat mini aktif di dalam siklus berjalan.</td></tr>
            <tr><td class="mono k">Cycle Budget Used</td><td>Persen kas hidup terpakai vs persen hari siklus berjalan.</td></tr>
            <tr><td class="mono k">Unsettled Bills</td><td>Sisa tagihan/pos rutin yang masih berada di rekening sebelum dibayar.</td></tr>
            <tr><td class="mono k">Temporary Advance</td><td>Dana pinjam sementara dari Core Savings untuk menutup kurang kas.</td></tr>
            <tr><td class="mono k">N / Ctrl+K</td><td>Fokus catat pengeluaran / Buka Command Search &amp; Smart Entry.</td></tr>
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
            <li><strong>Every 2-3 Days (60 Seconds):</strong> Open your bank app -> click <strong>Update Bank Balance</strong> on Overview -> hit <strong>Sync Balance</strong>. Review <code>Cycle Budget Used</code> and <code>Daily Average</code> against the elapsed marker.</li>
            <li><strong>On Credit, One-Off Bills or Events:</strong> Log once via Overview, <code>/credit?sub=commitments</code>, or <code>/allocations?sub=events</code> (or import statements in <code>/calendar?sub=import</code>). Live SWR + BroadcastChannel reactivity updates every hub automatically without refreshing the page.</li>
            <li><strong>Before Big Purchases:</strong> Run <code>Safe-Spend Simulator</code> around cutoff days (15th/16th &amp; 25th) to decide whether waiting shifts the bill a month forward.</li>
            <li><strong>On Payday &amp; Cycle End:</strong> Open <code>/payroll?sub=closing</code> (<em>Payday &amp; Closing</em>) to confirm payout, record savings deposit persistently, settle bills, and lock the finished cycle.</li>
          </ul>
        </div>
        <div class="card">
          <h3>A-Z Glossary & Keyboard Shortcuts</h3>
          <table class="mini-tbl">
            <tr><td class="mono k">Discretionary</td><td>Free cash leftover after debt, routine bills, living &amp; Core Savings are funded.</td></tr>
            <tr><td class="mono k">Emergency Buffer</td><td>Active-cycle shock reserve shielding daily cash from surprise minor costs.</td></tr>
            <tr><td class="mono k">Cycle Budget Used</td><td>% of spending budget used vs % of cycle days elapsed.</td></tr>
            <tr><td class="mono k">Unsettled Bills</td><td>Routine bill reserve still sitting inside your bank awaiting payment.</td></tr>
            <tr><td class="mono k">Temporary Advance</td><td>Short-term cash borrowed from your savings pockets with scheduled payback.</td></tr>
            <tr><td class="mono k">N / Ctrl+K</td><td>Focus Record Expense / Open Global Command Search &amp; quick entry.</td></tr>
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
      ? "Referensi menyeluruh seluruh fitur, logika siklus gajian, Benefit by GreatDay, Bank Balance Sync, impor KlikBCA, hingga kendali Superadmin."
      : "End-to-end documentation covering paycycle logic, Bank Balance Sync, Benefit by GreatDay payroll deductions, KlikBCA CSV import, and Superadmin controls.",
    editionBadge: isId ? "Edisi Khusus Gabriel + Superadmin" : "Gabriel Bespoke + Superadmin Edition",
    audienceLabel: isId ? "Gabriel (Bespoke Client) & Superadmin" : "Gabriel (Bespoke Client) & Platform Admin",
    versionLabel: "v3.1 · Nov 2026 · ID/EN",
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
        { num: "01", title: "Cara Pakai Anti-Ribet & Sistem Waterfall", desc: "Siklus gajian, Core Savings, Discretionary, Emergency Buffer", page: 3 },
        { num: "02", title: "Aktivasi Password Baru, Keamanan PIN & Privasi", desc: "Login pertama (/change-password), lupa sandi, Sidebar Alt+H", page: 4 },
        { num: "03", title: "Overview Kolom 1: Spending Balance & Bank Sync", desc: "Days to Payday, Daily Average, Bank Balance Sync", page: 5 },
        { num: "04", title: "Overview Kolom 2 & 3: Pos Kustom & Catat Cepat", desc: "Tambah/ubah pos rutin, Bank / QRIS, Record Expense", page: 6 },
        { num: "05", title: "Transactions Ledger, Payday & Closing & Calendar", desc: "Filter buku transaksi, ekspor Excel, titik kas terendah", page: 7 },
        { num: "06", title: "Income & Cash Flow, Budgets & Impor Mutasi", desc: "Potongan langsung gaji, Rollover amplop, KlikBCA CSV", page: 8 },
        { num: "07", title: "Installments & Bills (Cutoff & Debt Matrix)", desc: "Aturan cutoff kartu/PayLater, Matrix 12 bulan & Payoff Optimizer", page: 9 },
        { num: "08", title: "Accounts & Goals, Wishlist & Cashflow What-If", desc: "Kantong tabungan, simulasi wishlist vs jam kerja, Simulasi Ketahanan 12 Bulan", page: 10 },
        { num: "09", title: "Analytics, Reports, Subscriptions & Preferences", desc: "Laporan XLSX/PDF, Renewal Alerts, AI Co-Pilot & Setup", page: 11 },
        { num: "10", title: "Playbook 2 Menit/Minggu, Glosarium & Shortcuts", desc: "Kebiasaan ringan tanpa mencatat tiap kopi + kamus istilah", page: 12 },
      ]
    : [
        { num: "01", title: "Two-Minute Workflow & Waterfall System", desc: "Paycycle rhythm, Core Savings, Discretionary, Buffer", page: 3 },
        { num: "02", title: "First-Login Password Setup, PIN & Privacy", desc: "Mandatory password rotation, Forgot/Reset, Alt+H Privacy", page: 4 },
        { num: "03", title: "Overview Col 1: Spending Balance & Bank Sync", desc: "Days to Payday, Daily Average, Bank Balance Sync", page: 5 },
        { num: "04", title: "Overview Col 2 & 3: Custom Categories & Expense Log", desc: "Add/rename routine bills, Allocation Mix, Bank / QRIS", page: 6 },
        { num: "05", title: "Cashflow & Ledger (/calendar) & Payday Closing (/payroll)", desc: "Ledger filtering, integrated Payday Closing & Lowest Cash Point", page: 7 },
        { num: "06", title: "Plan & Events (/allocations): Sinking Funds & Event Budgets", desc: "Active Sinking Funds, 3-Tier Event Budget Advisor & KlikBCA CSV Import", page: 8 },
        { num: "07", title: "Bills & Credit (/credit): One-Off Bills, Cutoffs & Matrix", desc: "One-Off Commitments (0% DSR), 12-Month Matrix & Safe-Spend", page: 9 },
        { num: "08", title: "Savings & Net Worth (/savings) + Wishlist & What-If", desc: "Savings goals, wishlist work-hour check, Cashflow Resilience Lab", page: 10 },
        { num: "09", title: "Reports & Insights (/reports) & Preferences (6-Tab)", desc: "Trends, audit, XLSX/PDF exports, Marquee AI & Setup", page: 11 },
        { num: "10", title: "2-Minute Routine Playbook, Glossary & Shortcuts", desc: "Stress-free habit loop, A-Z definitions & keyboard keys", page: 12 },
      ];

  const sheets: string[] = [];

  sheets.push(
    renderTocHtml(
      lang,
      toc,
      isId ? "Cara Termudah Pakai Aplikasi Ini (Tanpa Catat Setiap Jajan)" : "The Easiest Way to Use Sunday Funday (Without Logging Every Coffee)",
      isId
        ? "Anda sama sekali tidak harus menginput setiap pengeluaran kecil seperti kopi atau parkir setiap hari. Catat saja tagihan rutin dan cicilan Anda, lalu 2 atau 3 hari sekali buka aplikasi bank Anda, klik Update Bank Balance di kartu Spending Balance, masukkan saldo rekening aktual, dan klik Sync Balance."
        : "You never have to type in every small coffee or snack each day. Record recurring bills and credit installments once (or import CSV statements), then open your bank app every few days, click Update Bank Balance on Overview, and hit Sync Balance.",
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
          <h3>Discretionary (Dana Bebas)</h3>
          <p>Uang ekstra tersisa sesudah seluruh tagihan, dana makan/hidup, dan target Core Savings aman 100%. Bisa dipakai bebas untuk self-reward, hiburan, atau ditabung ekstra saat tutup siklus.</p>
        </div>
        <div class="card">
          <h3>Emergency Buffer & Temporary Savings Advance</h3>
          <p><strong>Emergency Buffer</strong> menyerap pengeluaran kejutan kecil di tengah bulan tanpa merusak jatah harian. <strong>Temporary Savings Advance</strong> melacak pinjaman sementara dari kantong tabungan saat ada kekurangan kas.</p>
        </div>
        <div class="card">
          <h3>Budget Shortfall (Jika Pemasukan Sedang Ketat)</h3>
          <p>Saat total target melebihi pemasukan siklus ini, <em>Core Savings</em> dan <em>Discretionary</em> otomatis turun ke Rp 0 lebih dulu agar dana hidup harian tetap positif secara proporsional.</p>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">01 · Paycycles & Waterfall Capital Flow</h2>
      <p class="chapter-sub">How your income protects bills and daily living expenses before filling savings and discretionary funds.</p>
      ${renderWaterfallSvg("en")}
      <div class="two-col">
        <div class="card">
          <h3>Core Savings</h3>
          <p>Your protected monthly savings goal allocated immediately after upcoming credit bills, routine quotas, and Daily Spending Pool are covered.</p>
        </div>
        <div class="card">
          <h3>Discretionary</h3>
          <p>True disposable surplus remaining only after fixed bills, daily spending budget, and your Core Savings target are 100% funded. Spend it freely on rewards or transfer it into savings at period close.</p>
        </div>
        <div class="card">
          <h3>Emergency Buffer & Temporary Savings Advance</h3>
          <p><strong>Emergency Buffer</strong> absorbs small mid-cycle surprises. <strong>Temporary Savings Advance</strong> tracks short-term draws borrowed from savings reserves so repayments remain transparent.</p>
        </div>
        <div class="card">
          <h3>Budget Shortfall Protection</h3>
          <p>If planned allocations exceed net income in a cycle, Core Savings and Discretionary compress to Rp 0 first so your Daily Spending Pool remains positive proportionally.</p>
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
            <li><strong>Saldo Tersembunyi (Sidebar Bawah / Alt+H):</strong> Mengubah seluruh nominal menjadi <code>Rp •••••</code>; membuka angka pertama kali pada suatu sesi memerlukan konfirmasi kata sandi, dan selama saldo disembunyikan setiap aksi ubah nominal/tarik data otomatis terkunci dengan Toast <em>Tampilkan Saldo</em>.</li>
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
            <li><strong>Global Balance Toggle (Sidebar Footer / Alt+H):</strong> Masks all currency displays; first reveal verifies your password, and while masked any edit or sync trigger shows a protective Toast with a one-click <em>Reveal Balances</em> action.</li>
          </ul>
        </div>
      </div>`,
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">03 · Overview Kolom 1: Spending Balance &amp; Bank Balance Sync</h2>
      <p class="chapter-sub">Cara membaca batas belanja harian dan menyinkronkan saldo bank tanpa catat transaksi kecil.</p>
      ${renderWalletSyncDiagramSvg("id")}
      <div class="two-col">
        <div class="card">
          <h3>Spending Balance &amp; Days to Payday</h3>
          <ul>
            <li><strong>Spending Balance:</strong> Batas belanja harian agar dana hidup cukup sampai H-1 gajian (bawaan <em>Flat Daily</em>, atau pilih <em>Weekend 1.5x</em>).</li>
            <li><strong>Cycle Budget Used:</strong> Progress bar ganda yang membandingkan <code>% anggaran terpakai</code> dengan garis penanda waktu berjalan.</li>
            <li><strong>Daily Average &amp; Unsettled Cycle Bills:</strong> Rata-rata belanja per hari dibanding target awal dan total tagihan rutin yang masih harus dibayar.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Bank Balance Sync</h3>
          <ul>
            <li><strong>Expected Balance:</strong> Satu saldo utuh rekening Anda saat ini (mencakup dana jajan plus sisa tagihan rutin belum lunas).</li>
            <li><strong>Update Bank Balance &amp; Import Statement:</strong> Klik <strong>Update Bank Balance</strong> lalu tekan <strong>Sync Balance</strong> agar selisih masuk ke <strong>Balance History</strong> (dengan tombol <strong>Undo</strong>), atau langsung buka <code>/import</code>.</li>
          </ul>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">03 · Overview Col 1: Spending Balance &amp; Bank Balance Sync</h2>
      <p class="chapter-sub">Daily spending guidance and streamlined bank balance sync with zero micro-logging fatigue.</p>
      ${renderWalletSyncDiagramSvg("en")}
      <div class="two-col">
        <div class="card">
          <h3>Spending Balance, Pacing Mode &amp; Daily Average</h3>
          <ul>
            <li><strong>Spending Balance &amp; Days to Payday:</strong> Recommended daily spending limit through the day before next payday (<em>Flat Daily</em> by default, or optional <em>Weekend 1.5x</em>).</li>
            <li><strong>Cycle Budget Used:</strong> Compares <code>% budget used</code> directly against <code>% cycle time elapsed</code> cleanly.</li>
            <li><strong>Daily Average &amp; Unsettled Cycle Bills:</strong> Actual daily spend rate vs target alongside any pending routine bills still reserved in bank.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Bank Balance Sync &amp; Balance History</h3>
          <ul>
            <li><strong>Expected Balance:</strong> Unified figure showing what your bank balance should hold today (including unpaid routine bill reserves).</li>
            <li><strong>Update Bank Balance &amp; Import Statement:</strong> Expand <strong>Update Bank Balance</strong> to check coverage or hit <strong>Sync Balance</strong> to record adjustments in <strong>Balance History</strong> (with <strong>Undo</strong>).</li>
          </ul>
        </div>
      </div>`,
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">04 · Overview Kolom 2 &amp; Kolom 3 (Pos Kustom &amp; Catat Pengeluaran)</h2>
      <p class="chapter-sub">Menyesuaikan kategori rutin sesuai gaya hidup Anda sendiri dan mencatat belanja Bank / QRIS maupun kredit.</p>
      <div class="two-col">
        <div class="card">
          <h3>Kolom 2: Living &amp; Routine Bills Kustom</h3>
          <ul>
            <li><strong>Pos Rutin Dinamis:</strong> Di edisi Standar, Anda bisa menambah kategori sendiri lewat <strong>+ Add Routine Category</strong>, mengganti namanya (ikon pensil), maupun menghapus pos kustom yang tidak dipakai lagi.</li>
            <li><strong>Aksi Cepat & Kunci Lunas:</strong> Gunakan <strong>Pay Full</strong>, <strong>Roll to PayLater</strong> (pindah ke tagihan kredit bulan depan), atau <strong>Log Partial</strong> (bayar sebagian). Pos berstatus <em>Settled in full</em> otomatis mengunci edit kuota agar pembukuan tetap konsisten.</li>
            <li><strong>Cycle Allocation Mix:</strong> Bar 4 segmen memetakan porsi pengeluaran tetap, kas hidup harian, tabungan utama, serta discretionary &amp; buffer.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Kolom 3: Core Savings, Discretionary &amp; Record Expense (N)</h3>
          <ul>
            <li><strong>Core Savings &amp; Discretionary:</strong> Pantau target tabungan utama dan sisa <em>Discretionary</em> + <em>Emergency Buffer</em> Anda (dapat disembunyikan di Preferences).</li>
            <li><strong>Mode Record Expense:</strong> <em>Daily Spend</em>, <em>Routine Bill</em>, dan <em>Refund / Split</em> (patungan teman langsung memulihkan jatah belanja harian).</li>
            <li><strong>Bank / QRIS / PayLater / Credit Card:</strong> Pilih metode bayar, tenor, tanggal beli di kalender gelap <em>ErpDatePicker</em>, dan target <code>Billing Cycle</code> dengan pratinjau biaya dalam jam kerja.</li>
          </ul>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">04 · Overview Col 2 &amp; Col 3 (Custom Categories &amp; Expense Entry)</h2>
      <p class="chapter-sub">Personalizing routine envelopes, reviewing cycle allocation mix, and recording Bank / QRIS or credit entries.</p>
      <div class="two-col">
        <div class="card">
          <h3>Col 2: Custom Living &amp; Routine Envelopes</h3>
          <ul>
            <li><strong>Manage Categories Dynamically:</strong> Add your own custom expense categories via <strong>+ Add Routine Category</strong>, rename labels inline, or remove unused custom pockets cleanly.</li>
            <li><strong>One-Click Actions &amp; Settled Lock:</strong> Pay remaining quota with <strong>Pay Full</strong>, defer onto the debt schedule with <strong>Roll to PayLater</strong>, or record partial payments via <strong>Log Partial</strong>. Settled-in-full items lock quota edits until undone in Ledger.</li>
            <li><strong>Cycle Allocation Mix:</strong> Summarizes your cycle paycheck split across Fixed Bills &amp; Debt, Daily Living Pool, Core Savings, and Surplus &amp; Buffer.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Col 3: Core Savings, Discretionary &amp; Record Expense (Key N)</h3>
          <ul>
            <li><strong>Savings &amp; Discretionary Cards:</strong> Show real-time funded Core Savings and Discretionary + Emergency Buffer (visibility configurable in Preferences).</li>
            <li><strong>Expense Modes:</strong> Log <em>Daily Spend</em>, <em>Routine Bill</em> (from your custom routine list), or <em>Refund / Split</em> when splitting shared bills with friends.</li>
            <li><strong>Payment Methods:</strong> Switch cleanly between <em>Bank / QRIS</em>, <em>PayLater</em>, and <em>Credit Card</em> with Tenor buttons, dark <em>ErpDatePicker</em> calendar, <em>Billing Cycle</em> selector, and work-hour conversion.</li>
          </ul>
        </div>
      </div>`,
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">05 · Transactions Ledger, Payday &amp; Closing &amp; Cash Calendar</h2>
      <p class="chapter-sub">Kelola seluruh histori transaksi di satu buku besar, jalankan penutupan gaji persisten, dan pantau kalender tagihan.</p>
      <div class="stack">
        <div class="card">
          <h3>Transactions Ledger (<code>/ledger</code> — Khusus Edisi Standar)</h3>
          <p>Menampilkan daftar transaksi lengkap untuk periode terpilih beserta pencarian teks, filter tipe (<em>All Activity</em>, <em>Inflows</em>, <em>Daily Spend</em>, <em>Bills</em>), aksi edit nominal/tanggal/pos (memakai <em>ErpDatePicker</em>), hapus baris, serta tombol ekspor transaksi ke Excel maupun akses cepat ke rekonsiliasi saldo bank.</p>
        </div>
        <div class="two-col">
          <div class="card">
            <h3>Payday &amp; Closing (<code>/payday-wizard</code>)</h3>
            <p>Checklist 4-langkah saat gajian &amp; akhir siklus. Mengonfirmasi tanggal gaji, memverifikasi kelunasan tagihan, mengunci siklus selesai (<code>LOCKED</code>), serta mencatat konfirmasi transfer Core Savings secara persisten (<code>LIQUID_CASH</code> sebagai bawaan bila investasi eksternal nonaktif).</p>
          </div>
          <div class="card">
            <h3>Bills &amp; Cash Calendar (<code>/calendar</code>)</h3>
            <p>Menampilkan kurva proyeksi kas harian dengan tooltip interaktif saat kursor diarah, filter aktivitas terpisah di atas kalender, serta sorotan <strong>Lowest Cash Point</strong> dan <em>Core Savings Transfer</em> agar tempo belanja tetap terkendali.</p>
          </div>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">05 · Transactions Ledger, Payday &amp; Closing &amp; Bills Calendar</h2>
      <p class="chapter-sub">Full transaction management, persistent payday closing, and daily liquidity calendar tracking.</p>
      <div class="stack">
        <div class="card">
          <h3>Transactions Ledger (<code>/ledger</code> — Standard Workspace)</h3>
          <p>Browse every inflow, deduction, bill settlement, and balance adjustment in the selected period. Supports instant search, category/source filters, inline edits (via custom <em>ErpDatePicker</em> and bucket selectors) while the cycle is open, and Excel ledger export.</p>
        </div>
        <div class="two-col">
          <div class="card">
            <h3>Payday &amp; Closing (<code>/payday-wizard</code>)</h3>
            <p>Interactive 4-step checklist validating payout date, locking finished cycles, settling bills, and persisting <strong>Confirm Savings Deposit</strong> cleanly across reloads.</p>
          </div>
          <div class="card">
            <h3>Cash Calendar (<code>/calendar</code>)</h3>
            <p>Interactive daily liquidity curve with hover tooltips, a dedicated activity filter strip above the date grid, <strong>Lowest Cash Point</strong> highlighting, and itemized maturing obligations across the paycycle window.</p>
          </div>
        </div>
      </div>`,
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">06 · Income &amp; Cash Flow, Budgets &amp; Safe Statement Import</h2>
      <p class="chapter-sub">Mengatur gaji &amp; potongan langsung slip, simulasi amplop, serta impor CSV KlikBCA &amp; tempel myBCA/Permata.</p>
      <div class="two-col">
        <div class="card">
          <h3>Income &amp; Cash Flow (<code>/payroll</code>)</h3>
          <ul>
            <li>Panel kerja 2-kartu memisahkan pengaturan siklus/gaji pokok/THR (termasuk tombol pemilih segmen tanpa dropdown kaku) dari daftar potongan langsung slip.</li>
            <li>Simulasi pembagian tagihan hari gajian dan hitung upah bersih per jam kerja secara sejajar pada grid bawah.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Budgets &amp; Envelopes (<code>/allocations</code>)</h3>
          <ul>
            <li>Uji skenario perubahan kuota makan harian maupun tabungan sebelum menekan <strong>Apply Quota</strong>.</li>
            <li>Pilih kebijakan akhir bulan tiap pos rutin (<em>Sweep Unspent to Core Savings</em> atau simpan) dan jadwalkan dana berkala.</li>
          </ul>
        </div>
      </div>
      <div class="card">
        <h3>Safe Statement Import (<code>/import</code>)</h3>
        <p>Unggah CSV ekspor resmi KlikBCA (<code>.csv</code> / <code>.txt</code> maks 2 MB / 500 baris) atau tempel mutasi myBCA/Permata/PayLater tanpa login bank. Baris <code>CR</code> (pemasukan) dan kolom <code>Saldo</code> otomatis dilewati, angka desimal <code>48,000.00 DB</code> dibaca presisi, nomor rekening 10-16 digit disamarkan menjadi <code>****XXXX</code>, dan baris bulan <code>LOCKED</code> digeser maju sebelum disimpan.</p>
      </div>`
      : `
      <h2 class="chapter-title">06 · Income &amp; Cash Flow, Budgets &amp; Safe Statement Import</h2>
      <p class="chapter-sub">Configuring inflows &amp; direct payroll deductions, simulating budgets, and importing KlikBCA/myBCA statements safely.</p>
      <div class="two-col">
        <div class="card">
          <h3>Income &amp; Cash Flow (<code>/payroll</code>)</h3>
          <ul>
            <li>Two-card right workbench cleanly separates cycle parameters, payout schedule, and segmented bonus/THR controls from direct post-net payroll deductions.</li>
            <li>Compare contractual base rates against quick inflow entries side by side while checking hourly net wages.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Plan &amp; Events: Sinking Funds &amp; Event Budgets (<code>/allocations</code>)</h3>
          <ul>
            <li>Preview Daily Living or Savings quota shifts with real-time impact before applying, and manage persistent Active Sinking Funds with instant <strong>+ Contribute</strong> progress tracking and modular categories from Preferences.</li>
            <li>Use <strong>Event &amp; Activity Budgets</strong> (<code>?sub=events</code>) for outings/travel: defaults to today's date, resolves the exact paycycle window, gives 3 deterministic tiers (<em>Conservative</em>, <em>Balanced</em>, <em>Max Safe</em>), tracks shared friend advances, and sweeps unused balances cleanly.</li>
          </ul>
        </div>
      </div>
      <div class="card">
        <h3>Safe Statement Import (<code>/calendar?sub=import</code>)</h3>
        <p>Upload KlikBCA CSV exports or paste myBCA / Permata / PayLater lines safely without sharing bank credentials (up to 2 MB / 500 rows). Credit (<code>CR</code>) inflows and trailing <code>Saldo</code> columns are ignored, <code>48,000.00 DB</code> decimals parse cleanly, 10 to 16 digit account numbers mask into <code>****XXXX</code>, and locked-period rows shift forward automatically.</p>
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
            <li><strong>Komitmen Sekali Bayar (<code>/credit?sub=commitments</code>):</strong> Catat biaya insidental pasca-gajian (misalnya denda pembatalan bus outing) tanpa menghitungnya sebagai utang/cicilan (<code>0% DSR</code>), terhubung langsung dengan Cash Calendar &amp; Checklist.</li>
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
            <li><strong>One-Off Commitments (<code>/credit?sub=commitments</code>):</strong> Track non-recurring post-payday commitments (e.g. outing deposits/penalties) with 0% DSR debt impact alongside Cash Calendar &amp; Bill Checklist settlement toggles.</li>
            <li><strong>Card Controls &amp; Optimizer:</strong> Manage recurring end-dates, early settlements, and compare <em>Contractual</em>, <em>Avalanche</em>, and <em>Snowball</em> payoff paths.</li>
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
            <h3>Wishlist Simulator (<code>/allocations?sub=scenarios&amp;tool=wishlist</code>)</h3>
            <ul>
              <li>Tambahkan barang incaran Anda beserta harga dan target bulan beli.</li>
              <li>Sistem menghitung harga barang dalam satuan <strong>Jam Kerja Riil</strong>, menguji dampaknya terhadap rasio utang bila dicicil, dan memungkinkan Anda menautkan barang wishlist langsung menjadi <em>Savings Goal</em> atau mengonversinya menjadi rencana cicilan.</li>
            </ul>
          </div>
        </div>
        <div class="card">
          <h3>Cashflow What-If Lab (<code>/allocations?sub=scenarios</code>)</h3>
          <p>Uji skenario <em>what-if</em> selama 12 bulan ke depan memakai tuas tabungan ekstra, bonus, penghematan living, atau simulasi guncangan biaya <code>+15% Expense Shock</code>. Jalankan <strong>Simulasi Ketahanan Kas 12 Bulan</strong> (tingkat ketahanan kas &amp; opsi pembagian surplus optimal) sambil membandingkan kurva kekayaan bersih <em>Baseline</em> vs <em>Simulated</em>.</p>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">08 · Accounts & Goals, Wishlist Simulator & Cashflow What-If</h2>
      <p class="chapter-sub">Building goal-oriented savings reserves, testing wishlist purchases against work hours, and running 12-month stress tests.</p>
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
            <h3>Wishlist Simulator (<code>/allocations?sub=scenarios&amp;tool=wishlist</code>)</h3>
            <ul>
              <li>Catalog target purchases with expected prices and timing.</li>
              <li>Evaluates affordability impact in real <strong>Work Hours</strong> and Debt Service Ratio, letting you track items as Savings Goals or convert into structured installment plans.</li>
            </ul>
          </div>
        </div>
        <div class="card">
          <h3>Cashflow What-If Lab (<code>/allocations?sub=scenarios</code>)</h3>
          <p>Model 12-month projections using adjustments for extra savings, bonuses, living changes, debt prepayments, or expense shocks (with 1-click <em>Debt-Free Sprint</em>, <em>Bonus Prepayment</em>, and <em>+15% Expense Shock</em> presets) paired with our <strong>Cashflow Resilience &amp; Surplus Split Advisor</strong>.</p>
        </div>
      </div>`,
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">09 · Analytics, Reports, Subscriptions, Marquee AI &amp; Preferences</h2>
      <p class="chapter-sub">Ekspor laporan, pengaman langganan promo, asisten AI, serta personalisasi lengkap untuk workspace Anda.</p>
      <div class="two-col">
        <div class="card">
          <h3>Analytics, Reports &amp; Renewal Alerts</h3>
          <ul>
            <li><strong>Spending &amp; Trend Review (<code>/analytics</code>):</strong> Analisis perubahan belanja bulanan, tren disiplin, dan deteksi lonjakan pasca-cutoff.</li>
            <li><strong>Reports &amp; Trends (<code>/reports</code>):</strong> Diagram alokasi dana, proyeksi 3 bulan, ekspor <strong>Excel (.xlsx)</strong>, <strong>Print / Save PDF</strong>, dan kirim email laporan.</li>
            <li><strong>Subscriptions (<code>/subscriptions</code>):</strong> Kelola langganan berulang plus aktifkan <em>Renewal Notices</em> untuk memperingatkan sebelum tarif promo berakhir dan naik harga.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Marquee AI Co-Pilot &amp; Preferences Studio</h3>
          <ul>
            <li><strong>Marquee AI (Orb / <code>Alt+M</code> / <code>/marquee</code>):</strong> Tanya kondisi saldo, uji simulasi cutoff, atau catat belanja lewat chat EN/ID/ZH dengan konfirmasi kartu 1-klik yang aman.</li>
            <li><strong>Preferences (<code>/preferences</code>):</strong> Atur formula gajian/prioritas, template potongan slip, mode THR &amp; Pacing Overview, cutoff metode bayar, kunci AI pribadi (AES-256-GCM), notifikasi email, serta backup JSON akun Anda sendiri.</li>
            <li><strong>Workspace Setup &amp; Request Rule:</strong> Jalankan panduan pengaturan cepat 60 detik atau kirim permintaan rule khusus ke administrator.</li>
          </ul>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">09 · Analytics, Reports, Subscriptions, Marquee AI &amp; Preferences</h2>
      <p class="chapter-sub">Reporting exports, renewal alerts, AI quick capture, and full workspace customization.</p>
      <div class="two-col">
        <div class="card">
          <h3>Analytics, Reports &amp; Subscriptions</h3>
          <ul>
            <li><strong>Spending &amp; Trend Review (<code>/analytics</code>):</strong> Tracks month-over-month spending velocity, discipline score, and anomaly alerts.</li>
            <li><strong>Reports &amp; Trends (<code>/reports</code>):</strong> Visual allocation donut, 3-month liquidity forecast, <strong>Excel (.xlsx)</strong> export, <strong>Print / Save PDF</strong>, and email delivery.</li>
            <li><strong>Subscriptions &amp; Renewal Notices (<code>/subscriptions</code>):</strong> Tracks recurring plans and warns you days before promotional pricing auto-renews at higher standard rates.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Marquee AI Co-Pilot &amp; Preferences</h3>
          <ul>
            <li><strong>Marquee AI (Orb / <code>Alt+M</code> / <code>/marquee</code>):</strong> Context-aware financial assistant using deterministic backend tools and safe 1-click preview confirmation before any write.</li>
            <li><strong>Preferences (<code>/preferences</code>):</strong> 6-tab studio to tune paycycle rules, direct payroll deduction templates, conditional THR &amp; Overview defaults, custom cutoffs, AES-256-GCM AI keys, email alerts, and JSON backup/restore.</li>
            <li><strong>Workspace Setup &amp; Request Rule:</strong> Re-run the 60-second setup anytime or submit custom rule requests to your platform admin.</li>
          </ul>
        </div>
      </div>`,
  );

  sheets.push(
    isId
      ? `
      <h2 class="chapter-title">10 · Playbook 2 Menit/Minggu, Kamus Istilah &amp; Shortcuts</h2>
      <p class="chapter-sub">Rutinitas paling ringan menjaga keuangan tetap terkendali tanpa lelah mencatat setiap jajan.</p>
      <div class="two-col">
        <div class="card">
          <h3>Playbook Hemat Waktu</h3>
          <ul>
            <li><strong>2-3 Hari Sekali (1 Menit):</strong> Cek total rekening/e-wallet jajan -> klik <strong>Update Bank Balance</strong> -> tekan <strong>Sync Balance</strong>.</li>
            <li><strong>Belanja, Komitmen &amp; Acara (Real-Time):</strong> Catat sekali di <code>Record Expense</code>, <code>/credit?sub=commitments</code>, atau <code>/allocations?sub=events</code> — tampilan antarmenu terbarui otomatis tanpa perlu muat ulang.</li>
            <li><strong>Setiap Hari Gajian:</strong> Buka <code>/payroll?sub=closing</code> (<em>Payday &amp; Closing</em>) -> sahkan tanggal gaji cair &amp; konfirmasi deposit tabungan -> tutup periode sebelumnya agar history bersih.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Glosarium Istilah &amp; Shortcut Keyboard</h3>
          <table class="mini-tbl">
            <tr><td class="mono k">Discretionary</td><td>Dana sisa bersih setelah tagihan, hidup harian, dan tabungan utama lunas.</td></tr>
            <tr><td class="mono k">Emergency Buffer</td><td>Penyangga tak terduga aktif selama siklus berjalan.</td></tr>
            <tr><td class="mono k">Cycle Budget Used</td><td>Persentase dana hidup terpakai vs hari siklus berjalan.</td></tr>
            <tr><td class="mono k">Unsettled Bills</td><td>Dana tagihan/pos rutin yang masih berada di rekening sebelum dibayar.</td></tr>
            <tr><td class="mono k">Temporary Advance</td><td>Pinjaman sementara dari kantong tabungan saat kas menipis.</td></tr>
            <tr><td class="mono k">N / Ctrl+K</td><td>Fokus input Record Expense / Buka Command Search &amp; Smart Entry.</td></tr>
            <tr><td class="mono k">Alt+M / Alt+H / [</td><td>Buka Marquee AI / Masking saldo / Lipat Sidebar kiri.</td></tr>
          </table>
        </div>
      </div>`
      : `
      <h2 class="chapter-title">10 · Two-Minute Weekly Routine, Glossary &amp; Shortcuts</h2>
      <p class="chapter-sub">How to stay completely on top of cashflow in minutes per week without manual receipt fatigue.</p>
      <div class="two-col">
        <div class="card">
          <h3>Two-Minute Routine Playbook</h3>
          <ul>
            <li><strong>Every 2-3 Days (60 Seconds):</strong> Click <strong>Update Bank Balance</strong> on Overview, type your real total, and hit <strong>Sync Balance</strong>. Review <code>Cycle Budget Used</code> vs elapsed timeline.</li>
            <li><strong>Real-Time Credit, One-Off &amp; Trip Logging:</strong> Log once via <code>Record Expense</code>, <code>/credit?sub=commitments</code>, or <code>/allocations?sub=events</code> (or import KlikBCA CSV via <code>/calendar?sub=import</code>) and cross-route data updates live without refreshing.</li>
            <li><strong>On Payday:</strong> Run <code>/payroll?sub=closing</code> (<em>Payday &amp; Closing</em>) to confirm salary date, confirm deposit, settle obligations, and close completed cycles.</li>
          </ul>
        </div>
        <div class="card">
          <h3>Glossary &amp; Keyboard Shortcuts</h3>
          <table class="mini-tbl">
            <tr><td class="mono k">Discretionary</td><td>Leftover disposable funds once bills, spending pool &amp; Core Savings are funded.</td></tr>
            <tr><td class="mono k">Emergency Buffer</td><td>Mid-cycle reserve absorbing minor surprise outlays.</td></tr>
            <tr><td class="mono k">Cycle Budget Used</td><td>% of spending budget used vs % of cycle elapsed.</td></tr>
            <tr><td class="mono k">Unsettled Bills</td><td>Routine reserve still resting inside your bank waiting for settlement.</td></tr>
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
    versionLabel: "v3.1 · Nov 2026 · ID/EN",
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
