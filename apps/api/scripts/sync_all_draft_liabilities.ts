import { SnapshotStatus } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CreditService } from '../src/credit/credit.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const creditService = app.get(CreditService);

  console.log('=== 1. CLEANING UP LEGACY creditCardAmount ON MonthlyBulkBill ===');
  const bulkBillsWithCC = await prisma.monthlyBulkBill.findMany({
    where: {
      creditCardAmount: { gt: 0 },
    },
  });

  for (const b of bulkBillsWithCC) {
    const paylater = b.paylaterAmount ?? 0;
    const personal = b.personalDebtAmount ?? 0;
    const newAmount = paylater + personal;
    console.log(
      `Updating BulkBill #${b.id} (${b.month}/${b.year}): PayLater=${paylater}, Personal=${personal}, Old CC=${b.creditCardAmount}, Old Amount=${b.amount} -> New Amount=${newAmount}, New CC=0`
    );
    await prisma.monthlyBulkBill.update({
      where: { id: b.id },
      data: {
        creditCardAmount: 0,
        amount: newAmount,
      },
    });
  }

  console.log('\n=== 2. SYNCING LIABILITIES TO ALL DRAFT SNAPSHOTS ===');
  const draftSnapshots = await prisma.monthlySnapshot.findMany({
    where: {
      status: SnapshotStatus.DRAFT,
    },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  for (const s of draftSnapshots) {
    console.log(`\nSyncing liabilities for ${s.month}/${s.year} (Snapshot #${s.id})...`);
    const result = await creditService.syncLiabilitiesToSnapshot(s.month, s.year);
    console.log(`Result: Materialized ${result.materializedCount} transactions.`);

    const updatedSnapshot = await prisma.monthlySnapshot.findUnique({
      where: { id: s.id },
      include: {
        transactions: {
          where: { sourceType: { not: 'MANUAL' } },
        },
      },
    });

    if (updatedSnapshot) {
      const sumTxs = updatedSnapshot.transactions.reduce((acc, t) => acc + t.amount, 0);
      console.log(
        `Updated Snapshot ${s.month}/${s.year}: totalDeductions=${updatedSnapshot.totalDeductions} (sum of ${updatedSnapshot.transactions.length} txs = ${sumTxs})`
      );
      for (const t of updatedSnapshot.transactions) {
        console.log(`   [${t.sourceType}] ${t.label}: Rp ${t.amount.toLocaleString('id-ID')}`);
      }
    }
  }

  console.log('\n=== ALL SYNC COMPLETE ===');
  await app.close();
}

main().catch((err) => {
  console.error('Error during sync:', err);
  process.exit(1);
});
