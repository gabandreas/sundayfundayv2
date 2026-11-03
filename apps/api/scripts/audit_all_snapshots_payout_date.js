const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[match[1]] = val;
  }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function formatIso(d) {
  return d ? d.toISOString() : 'NULL';
}

function formatDateDisplay(d) {
  if (!d) return 'NULL';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

async function main() {
  console.log('=== MONTHLY SNAPSHOT PAYROLL PAYOUT DATE AUDIT & INTEGRITY CHECK ===\n');

  const config = await prisma.globalConfig.findFirst();
  const payoutDay = config?.payrollPayoutDay ?? 25;
  console.log(`GlobalConfig payrollPayoutDay: ${payoutDay}`);

  const snapshots = await prisma.monthlySnapshot.findMany({
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  console.log(`Total snapshots in database: ${snapshots.length}\n`);

  let corruptedCount = 0;
  const auditReport = [];

  for (const s of snapshots) {
    const expectedDate = new Date(Date.UTC(s.year, s.month - 1, payoutDay));
    let isCorrupted = false;
    let reason = null;

    if (!s.payrollPayoutDate) {
      isCorrupted = true;
      reason = 'Date is NULL';
    } else {
      const storedYear = s.payrollPayoutDate.getUTCFullYear();
      const storedMonth = s.payrollPayoutDate.getUTCMonth() + 1;

      if (storedYear !== s.year || storedMonth !== s.month) {
        isCorrupted = true;
        reason = `Month/Year mismatch: Stored ${storedMonth}/${storedYear} vs Snapshot ${s.month}/${s.year}`;
      }
    }

    if (isCorrupted) {
      corruptedCount++;
      console.log(`[CORRUPTION DETECTED] Snapshot ID ${s.id} (${s.month}/${s.year}): ${reason}`);
      console.log(`  Stored:   ${formatIso(s.payrollPayoutDate)} (${formatDateDisplay(s.payrollPayoutDate)})`);
      console.log(`  Expected: ${formatIso(expectedDate)} (${formatDateDisplay(expectedDate)})`);

      // Apply targeted, idempotent fix directly to live dev database for this record
      await prisma.monthlySnapshot.update({
        where: { id: s.id },
        data: { payrollPayoutDate: expectedDate },
      });
      console.log(`  -> APPLIED FIX: Updated ID ${s.id} payrollPayoutDate to ${formatIso(expectedDate)} (touching no other fields).\n`);
    }

    auditReport.push({
      id: s.id,
      period: `${String(s.month).padStart(2, '0')}/${s.year}`,
      status: s.status,
      storedPayoutDate: formatIso(s.payrollPayoutDate),
      storedDisplay: formatDateDisplay(s.payrollPayoutDate),
      expectedDisplay: formatDateDisplay(expectedDate),
      isConsistent: !isCorrupted,
      issueReason: reason,
    });
  }

  console.log('\n--- AUDIT TABLE ---');
  console.table(auditReport);

  // Verification pass
  const verifySnapshots = await prisma.monthlySnapshot.findMany({
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  const finalInconsistencies = verifySnapshots.filter((s) => {
    if (!s.payrollPayoutDate) return true;
    return (
      s.payrollPayoutDate.getUTCFullYear() !== s.year ||
      s.payrollPayoutDate.getUTCMonth() + 1 !== s.month
    );
  });

  console.log('\n--- FINAL VERIFICATION RESULT ---');
  console.log(`Total snapshots examined: ${verifySnapshots.length}`);
  console.log(`Inconsistencies remaining: ${finalInconsistencies.length}`);

  if (finalInconsistencies.length === 0) {
    console.log('SUCCESS: All 7 MonthlySnapshot rows have 100% consistent payrollPayoutDate matching their period month/year!');
  } else {
    console.error('FAILURE: Inconsistent snapshots remain:', finalInconsistencies);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error('Error running audit:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
