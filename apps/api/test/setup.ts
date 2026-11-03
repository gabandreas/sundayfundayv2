import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || '').trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  }
}

// CRITICAL SAFEGUARD: Force all tests to use the isolated test database, never the live database.
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:password@127.0.0.1:5433/finance_erp_test?schema=public';

process.env.DATABASE_URL = TEST_DB_URL;

if (
  process.env.DATABASE_URL.includes('/finance_erp?') ||
  process.env.DATABASE_URL.endsWith('/finance_erp')
) {
  throw new Error(
    `[CRITICAL DATABASE SAFETY] Integration tests attempted to run against the live database (${process.env.DATABASE_URL}). Tests must target finance_erp_test!`,
  );
}
