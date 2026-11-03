const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let v = (m[2] || '').trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const row = await prisma.monthlySnapshot.findUnique({
    where: { month_year: { month: 8, year: 2026 } },
  });
  console.log('CURRENT_AUGUST_2026_RAW:');
  console.log(JSON.stringify(row, null, 2));
}

main().finally(() => prisma.$disconnect());
