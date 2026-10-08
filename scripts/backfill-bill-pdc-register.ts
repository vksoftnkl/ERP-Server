/**
 * notes (46), item 5 — registers the cheques of sale bills posted before
 * /bills/post learned to (bil00696 and anything like it).
 *
 *   npx tsx scripts/backfill-bill-pdc-register.ts            # dry run: lists them
 *   npx tsx scripts/backfill-bill-pdc-register.ts --apply    # writes the rows
 *
 * Runs each bill through syncBillPdcRegister — the exact code /bills/post now
 * runs — in a transaction of its own, so one bad cheque (no number, a date
 * outside ck_apd_dates, a number already registered) is reported and skipped
 * without holding up the rest. Idempotent: a bill whose cheques are already
 * registered is not selected again.
 */
import { PrismaClient } from '@prisma/client';
import { syncBillPdcRegister } from '../src/modules/sales/bill/bill-pdc-posting.helper';

const ACTOR = 'backfill-notes-46';

interface Candidate {
  sb_id: string;
  sb_acc_year: string;
  sb_bill_refno: string | null;
  td_id: string;
  td_amount: string;
  td_ref_no: string | null;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw<Candidate[]>`
      SELECT b.sb_id, b.sb_acc_year, b.sb_bill_refno, t.td_id, t.td_amount::text AS td_amount, t.td_ref_no
        FROM accounts.acc_tender_detail t
        JOIN sales.sale_bill b ON b.sb_id = t.td_src_doc_id AND b.sb_acc_year = t.td_acc_year
       WHERE t.td_src_module = 'SALES' AND t.td_src_doc_type = 'SALE_BILL'
         AND t.td_tender_type_id = 5
         AND NOT t.td_is_deleted AND NOT t.td_is_voided
         AND b.sb_status = 'POSTED'
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_pdc_register p
                          WHERE p.apd_tender_id = t.td_id AND NOT p.apd_is_deleted)
       ORDER BY b.sb_acc_year, b.sb_bill_refno`;
    for (const row of rows) {
      console.log(
        `${row.sb_bill_refno ?? row.sb_id}  ${row.sb_acc_year}  cheque ${row.td_ref_no ?? '(no number)'}  ${row.td_amount}`,
      );
    }
    console.log(`${rows.length} unregistered cheque tender(s) on posted bills.`);
    if (!apply || rows.length === 0) {
      if (!apply && rows.length > 0) {
        console.log('Dry run — pass --apply to register them.');
      }
      return;
    }
    const bills = new Map(rows.map((row) => [`${row.sb_id}|${row.sb_acc_year}`, row]));
    let done = 0;
    for (const row of bills.values()) {
      try {
        const ids = await prisma.$transaction(async (tx) => {
          const bill = await tx.saleBill.findUniqueOrThrow({
            where: { sbId_sbAccYear: { sbId: row.sb_id, sbAccYear: row.sb_acc_year } },
          });
          if (!bill.sbPostedVoucherId) {
            throw new Error('POSTED but carries no sb_posted_voucher_id');
          }
          return syncBillPdcRegister(
            tx,
            bill,
            { voucherId: bill.sbPostedVoucherId, accYear: bill.sbAccYear },
            ACTOR,
            new Date(),
          );
        });
        done += 1;
        console.log(`  ✓ ${row.sb_bill_refno ?? row.sb_id}: ${ids.join(', ')}`);
      } catch (error) {
        const detail =
          (error as { response?: { errors?: { message: string }[] } }).response?.errors
            ?.map((e) => e.message)
            .join('; ') ?? (error as Error).message;
        console.log(`  ✗ ${row.sb_bill_refno ?? row.sb_id}: ${detail}`);
      }
    }
    console.log(`Registered the cheques of ${done} of ${bills.size} bill(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
