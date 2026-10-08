/**
 * notes (47) — the whole-company books check, nightly during the trial.
 *
 *   npx tsx scripts/reconcile-books.ts                 # every company, current FY
 *   npx tsx scripts/reconcile-books.ts 2026-2027       # a given FY
 *   npx tsx scripts/reconcile-books.ts 2026-2027 --all # print the balanced rows too
 *
 * Runs accounts.fn_books_reconcile — the same functions the per-post guard
 * calls — over every bill-by-bill party (C1) and every Cheques In Hand ledger
 * (C2). Catches drift from paths the per-post call does not cover (carry
 * forward, imports, hand fixes). Read-only.
 *
 * Exit code 1 when anything is out by more than 0.005, so cron can alert:
 *   30 1 * * *  cd /opt/erp-server/app && npx tsx scripts/reconcile-books.ts >> logs/reconcile.log 2>&1
 */
import { PrismaClient, Prisma } from '@prisma/client';

interface Row {
  check_kind: string;
  ledger_id: string;
  ledger_name: string;
  ledger_bal: Prisma.Decimal;
  other_bal: Prisma.Decimal;
  diff: Prisma.Decimal;
}

// April–March, the house fiscal year (ck_*_acc_year: 'YYYY-YYYY+1').
function currentAccYear(now = new Date()): string {
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const accYear = args.find((a) => /^\d{4}-\d{4}$/.test(a)) ?? currentAccYear();
  const showAll = args.includes('--all');
  const prisma = new PrismaClient();
  let outOfBalance = 0;
  try {
    const companies = await prisma.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT abl_company_id AS id FROM accounts.acc_bill_balance
      UNION
      SELECT DISTINCT av_company_id FROM accounts.acc_vouchers WHERE av_acc_year = ${accYear}::char(9)`;
    console.log(
      `${new Date().toISOString()}  books check ${accYear}, ${companies.length} company(ies)`,
    );
    for (const { id } of companies) {
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT * FROM accounts.fn_books_reconcile(${id}::uuid, ${accYear}::char(9))
         ORDER BY abs(diff) DESC, ledger_name`;
      const bad = rows.filter((r) => new Prisma.Decimal(r.diff).abs().greaterThan('0.005'));
      outOfBalance += bad.length;
      console.log(`company ${id}: ${rows.length} ledger(s) checked, ${bad.length} out of balance`);
      for (const r of showAll ? rows : bad) {
        const other = r.check_kind === 'PARTY' ? 'bills' : 'register';
        console.log(
          `  ${r.check_kind.padEnd(15)} ${r.ledger_name.padEnd(40)} ledger ${String(r.ledger_bal).padStart(14)}` +
            `  ${other} ${String(r.other_bal).padStart(14)}  diff ${String(r.diff).padStart(12)}`,
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }
  process.exitCode = outOfBalance > 0 ? 1 : 0;
}

void main();
