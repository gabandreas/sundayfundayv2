import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeFakeSnapshot() {
  const snapshot = await prisma.monthlySnapshot.findUnique({
    where: { month_year: { month: 1, year: 2028 } }
  });
  if (snapshot) {
    await prisma.transaction.deleteMany({ where: { snapshotId: snapshot.id } });
    await prisma.monthlySnapshot.delete({ where: { id: snapshot.id } });
    console.log("Deleted 1/2028 snapshot.");
  } else {
    console.log("Snapshot 1/2028 not found.");
  }
}

removeFakeSnapshot().catch(console.error).finally(() => prisma.$disconnect());
