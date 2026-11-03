import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function inspectAll() {
  const bulkBills = await p.monthlyBulkBill.findMany({
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  const snapshots = await p.monthlySnapshot.findMany({
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
    include: {
      transactions: {
        where: { sourceType: { not: 'MANUAL' } },
      },
    },
  });

  console.log('--- MONTHLY BULK BILLS IN DB ---');
  for (const b of bulkBills) {
    console.log(
      `${b.month}/${b.year}: PayLater=${b.paylaterAmount} Personal=${b.personalDebtAmount} CC=${b.creditCardAmount} Total=${b.amount}`
    );
  }

  console.log('\n--- SNAPSHOTS TOTAL DEDUCTIONS VS MATERIALIZED TRANSACTIONS ---');
  for (const s of snapshots) {
    const txSum = s.transactions.reduce((sum, t) => sum + t.amount, 0);
    console.log(
      `${s.month}/${s.year} [${s.status}]: totalDeductions=${s.totalDeductions} (sum of ${s.transactions.length} credit txs: ${txSum})`
    );
    for (const t of s.transactions) {
      console.log(`   - ${t.label}: ${t.amount} (${t.sourceType})`);
    }
  }

  console.log('\n--- CREDIT CARD TRANSACTIONS IN DB ---');
  const ccTxs = await p.creditCardTransaction.findMany();
  for (const c of ccTxs) {
    console.log(
      `ID=${c.id} "${c.label}" amount=${c.amount} monthlyAmount=${c.monthlyAmount} type=${c.chargeType} tenor=${c.tenor} billing=${c.billingMonth}/${c.billingYear} status=${c.status}`
    );
  }

  await p.$disconnect();
}

inspectAll();
