/**
 * notes (49) item 1 — moves the mirror vouchers that sales cancels wrote BEFORE
 * the fix out of their document's series and into the Reversal series.
 *
 *   npx tsx scripts/renumber-sales-reversals.ts            # dry run: lists them
 *   npx tsx scripts/renumber-sales-reversals.ts --apply    # renumber
 *
 * A mirror is a header some other header names in avh_reversal_voucher_id,
 * whose original came from SALES and which is not already type 'Rev'. Each gets
 * the next rev number for its company / branch / year (oldest first), and its
 * legs follow (type, number, refno). Ids, dates, amounts and the links are
 * untouched, so every total, the ledger statement and the reconcile read the
 * same before and after.
 *
 * What it does NOT do: give the document series its numbers back. The bill
 * numbers those mirrors consumed stay consumed — on a live GSTIN they are
 * gaps, declared in GSTR-1 Table 13 as cancelled numbers. On the test box that
 * does not matter; after this the note's check (refnos like 'bil%' with no
 * sale bill) returns nothing.
 */
import { PrismaClient } from '@prisma/client';
import { allocateVoucherNumber } from '../src/common/Sequence/voucher-sequence.helper';

const ROLLBACK = new Error('dry run');

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(
      async (tx) => {
        const [rev] = await tx.$queryRaw<{ id: number }[]>`
          SELECT vchr_type_id AS id FROM accounts.acc_voucher_types WHERE vchr_type_code = 'Rev'`;
        if (!rev) {
          throw new Error("Voucher type 'Rev' is missing — apply migration 20260925150000 first");
        }
        const mirrors = await tx.$queryRaw<
          {
            id: string;
            yr: string;
            company: string;
            branch: string;
            vdate: Date;
            refno: string | null;
            orig_refno: string | null;
          }[]
        >`
          SELECT m.avh_voucher_id AS id, m.avh_acc_year AS yr, m.avh_company_id AS company,
                 m.avh_branch_id AS branch, m.avh_voucher_date AS vdate,
                 m.avh_voucher_refno AS refno, o.avh_voucher_refno AS orig_refno
            FROM accounts.acc_voucher_header o
            JOIN accounts.acc_voucher_header m
              ON m.avh_voucher_id = o.avh_reversal_voucher_id AND m.avh_acc_year = o.avh_reversal_acc_year
           WHERE o.avh_src_module = 'SALES'
             AND m.avh_voucher_type_id <> ${rev.id}::int
             AND m.avh_is_deleted = false
           ORDER BY m.avh_created_on, m.avh_voucher_id`;
        console.log(
          `${mirrors.length} sales mirror(s) outside the Reversal series. ${apply ? 'APPLYING' : 'DRY RUN'}.`,
        );
        for (const m of mirrors) {
          const number = await allocateVoucherNumber(tx, {
            vchrTypeId: rev.id,
            companyId: m.company,
            branchId: m.branch,
            accYear: m.yr.trim(),
            deviceCode: null,
            documentDate: m.vdate,
          });
          await tx.$executeRaw`
            UPDATE accounts.acc_voucher_header
               SET avh_voucher_type_id = ${rev.id}::int, avh_voucher_no = ${number.lastNo}::bigint,
                   avh_voucher_refno = ${number.refno}, avh_modified_on = now(),
                   avh_modified_by = 'renumber-notes-49'
             WHERE avh_voucher_id = ${m.id}::uuid AND avh_acc_year = ${m.yr}::char(9)`;
          await tx.$executeRaw`
            UPDATE accounts.acc_vouchers
               SET av_voucher_type_id = ${rev.id}::int, av_voucher_no = ${number.lastNo}::bigint,
                   av_voucher_refno = ${number.refno}
             WHERE av_voucher_id = ${m.id}::uuid AND av_acc_year = ${m.yr}::char(9)`;
          console.log(`  ${m.refno} → ${number.refno}   (reversal of ${m.orig_refno})`);
        }
        const [left] = await tx.$queryRaw<{ n: bigint }[]>`
          SELECT COUNT(*) AS n FROM accounts.acc_voucher_header h
           WHERE h.avh_voucher_refno LIKE 'bil%'
             AND NOT EXISTS (SELECT 1 FROM sales.sale_bill b WHERE b.sb_bill_refno = h.avh_voucher_refno)`;
        console.log(`'bil…' vouchers with no sale bill afterwards: ${Number(left.n)}`);
        if (!apply) {
          throw ROLLBACK;
        }
      },
      { timeout: 600_000, maxWait: 30_000 },
    );
  } catch (error) {
    if (error !== ROLLBACK) {
      throw error;
    }
    console.log('Dry run — nothing written. Pass --apply to renumber.');
  } finally {
    await prisma.$disconnect();
  }
}

void main();
