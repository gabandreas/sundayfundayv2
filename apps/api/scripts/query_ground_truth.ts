import { PrismaClient } from '@prisma/client';


async function run() {
  const prisma = new PrismaClient();
  const snapshotsSelectors = {
    getOrCreateDraftSnapshot: async (m, y) => prisma.monthlySnapshot.findUnique({where: {month_year: {month: m, year: y}}})
  };
  
  // Quick manual sync test without Nest DI overhead
  const sep = await prisma.monthlySnapshot.findUnique({where: {id: 3}});
  
  if (sep) {
    // Delete old CC transactions
    await prisma.transaction.deleteMany({
      where: { snapshotId: sep.id, sourceType: 'CC_TRANSACTION' }
    });
    
    // Simulate sync
    const { calculateCardDueAmountForMonth } = require('../src/credit/credit.utils');
    const activeCards = await prisma.creditCardTransaction.findMany({ where: { status: 'ACTIVE' }});
    
    for (const card of activeCards) {
      const due = calculateCardDueAmountForMonth(card, sep.month, sep.year);
      if (due > 0) {
        await prisma.transaction.create({
          data: {
            snapshotId: sep.id,
            type: 'CREDIT_BILL',
            sourceType: 'CC_TRANSACTION',
            sourceId: card.id,
            label: card.label,
            amount: due,
            date: new Date(Date.UTC(sep.year, sep.month - 1, 1))
          }
        });
      }
    }
  }

  // Query ground truth
  const txs = await prisma.transaction.findMany({
    where: { snapshotId: 3, sourceType: 'CC_TRANSACTION' }
  });
  console.log("Materialized CC Transactions for Sept (ID 3):");
  console.log(txs.map(t => `${t.label}: ${t.amount}`).join('\n'));
}

run().catch(console.error);
