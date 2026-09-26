/**
 * notes (49) item 2 — gives every POSTED sale bill the ALLOCATION rows for what
 * was paid at the counter, which bills posted before the fix never got.
 *
 *   npx tsx scripts/backfill-bill-counter-allocations.ts            # dry run
 *   npx tsx scripts/backfill-bill-counter-allocations.ts --apply    # write
 *
 * Per bill, the same code /bills/post now runs (syncCounterAllocations: one
 * row per settling tender, naming the bill's own voucher), then the standard
 * recompute — all of it in ONE transaction, with accounts.fn_books_reconcile
 * printed before and after, so the dry run shows whether the books would
 * balance and --apply commits exactly that.
 *
 * The counter rows are capped at what the bill's own voucher took at the
 * counter (sb_paid_amt − sb_advance_amt − sb_note_adj_amt), not at the live
 * tender rows: an older amend could leave tender rows the voucher never posted
 * (bil00320 — a live 472 tender behind a voucher that took 354). A bill cheque
 * BOUNCED before the fix had the header moved by hand too, so the cap leaves it
 * out and that cheque keeps the pre-fix path (sale-bill-cheque.helper).
 *
 * Idempotent: a tender that already has a row is left alone. Every bill whose
 * settled figure moves is marked *; on the test box that is the D1 repair
 * (bil00685 5 → 3,773, bil00695 150 → 250) plus ZT-CUST-CREDIT bills whose
 * receipts had been spread across the wrong bills once their counter payment
 * vanished — the party total does not change.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { syncCounterAllocations } from '../src/modules/sales/bill/bill-counter-allocation.helper';
import { BillBalanceRecomputeService } from '../src/modules/accountsModule/billBalance/bill-balance-recompute.service';

const ACTOR = 'backfill-notes-49';
const ROLLBACK = new Error('dry run');

interface Candidate {
  sb_id: string;
  sb_acc_year: string;
  sb_bill_refno: string | null;
  abl_id: string;
  abl_acc_year: string;
  alloc: Prisma.Decimal;
  pending: Prisma.Decimal;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  const recompute = new BillBalanceRecomputeService(prisma as never);
  let changed = 0;
  let rowsAdded = 0;
  try {
    await prisma.$transaction(
      async (tx) => {
        const bills = await tx.$queryRaw<Candidate[]>`
          SELECT b.sb_id, b.sb_acc_year, b.sb_bill_refno, l.abl_id, l.abl_acc_year,
                 l.abl_alloc_amount AS alloc, l.abl_pending_amount AS pending
            FROM sales.sale_bill b
            JOIN accounts.acc_bill_balance l
              ON l.abl_src_doc_id = b.sb_id AND l.abl_acc_year = b.sb_acc_year
             AND l.abl_src_doc_type = 'SALE_BILL' AND l.abl_is_deleted = false
           WHERE b.sb_status = 'POSTED' AND b.sb_is_deleted = false AND b.sb_cust_id IS NOT NULL
           ORDER BY b.sb_acc_year, b.sb_bill_refno`;
        const scopes = await reconcileScopes(tx, bills);
        console.log(
          `${bills.length} posted bill(s) with a live receivable. ${apply ? 'APPLYING' : 'DRY RUN'}.`,
        );
        await printReconcile(tx, scopes, 'BEFORE');
        const now = new Date();
        for (const c of bills) {
          const bill = await tx.saleBill.findUniqueOrThrow({
            where: { sbId_sbAccYear: { sbId: c.sb_id, sbAccYear: c.sb_acc_year } },
          });
          const posted = bill.sbPostedVoucherId
            ? { voucherId: bill.sbPostedVoucherId, accYear: bill.sbAccYear }
            : null;
          // What the bill's own voucher says was paid at the counter — the
          // header's settled figure, which /post and /retender keep in step
          // with the legs. The live tender rows are NOT trusted over it: an
          // older amend could leave rows the voucher never posted (bil00320:
          // a live 472 tender behind a voucher that took 354).
          const counterPaid = Prisma.Decimal.max(
            new Prisma.Decimal(bill.sbPaidAmt ?? 0)
              .minus(bill.sbAdvanceAmt ?? 0)
              .minus(bill.sbNoteAdjAmt ?? 0),
            0,
          );
          const result = await syncCounterAllocations(tx, {
            bill,
            abl: { ablId: c.abl_id, ablAccYear: c.abl_acc_year },
            partyId: bill.sbCustId!,
            voucherFor: () => posted,
            cap: counterPaid,
            actor: ACTOR,
            now,
          });
          if (result.added.length === 0 && result.dropped === 0) {
            continue;
          }
          // A cheque BOUNCED before the fix: the receivable was reopened by
          // hand and the header moved with it, so the header-based cap above
          // already leaves it out. Nothing else about such a cheque is
          // touched; it keeps the pre-fix path (sale-bill-cheque.helper).
          const [after] = await recompute.recomputeBills(tx, [
            { billId: c.abl_id, accYear: c.abl_acc_year },
          ]);
          rowsAdded += result.added.length;
          const moved = !new Prisma.Decimal(c.alloc).equals(after.allocAmount);
          if (moved) {
            changed += 1;
          }
          const capped = result.capped.length
            ? `  capped ${result.capped.map((x) => `${x.wanted.toFixed(2)}→${x.written.toFixed(2)}`).join(', ')}`
            : '';
          console.log(
            `${moved ? '*' : ' '} ${c.sb_bill_refno ?? c.sb_id}  +${result.added.length} row(s)` +
              (result.dropped ? ` −${result.dropped}` : '') +
              `  alloc ${c.alloc} → ${after.allocAmount}  pending ${c.pending} → ${after.pendingAmount}${capped}`,
          );
        }
        await printReconcile(tx, scopes, 'AFTER');
        console.log(
          `${rowsAdded} row(s) ${apply ? 'written' : 'would be written'}; ${changed} bill(s) whose ` +
            `settled figure ${apply ? 'moved' : 'would move'} (marked *).`,
        );
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
    console.log('Dry run — nothing written. Pass --apply to write.');
  } finally {
    await prisma.$disconnect();
  }
}

/** Every (company, year) the bills belong to — what the reconcile is run over. */
async function reconcileScopes(
  tx: Prisma.TransactionClient,
  bills: Candidate[],
): Promise<{ companyId: string; accYear: string }[]> {
  if (bills.length === 0) {
    return [];
  }
  return tx.$queryRaw`
    SELECT DISTINCT sb_company_id AS "companyId", sb_acc_year AS "accYear"
      FROM sales.sale_bill WHERE sb_id = ANY(${bills.map((b) => b.sb_id)}::uuid[])`;
}

async function printReconcile(
  tx: Prisma.TransactionClient,
  scopes: { companyId: string; accYear: string }[],
  label: string,
): Promise<void> {
  for (const s of scopes) {
    const rows = await tx.$queryRaw<
      {
        check_kind: string;
        ledger_name: string;
        ledger_bal: string;
        other_bal: string;
        diff: string;
      }[]
    >`
      SELECT check_kind, ledger_name, ledger_bal::text, other_bal::text, diff::text
        FROM accounts.fn_books_reconcile(${s.companyId}::uuid, ${s.accYear}::char(9))
       WHERE abs(diff) > 0.005`;
    console.log(
      `${label} reconcile ${s.companyId} ${s.accYear}: ` +
        (rows.length === 0
          ? 'all balanced'
          : rows
              .map((r) => `${r.ledger_name} ${r.ledger_bal} vs ${r.other_bal} (${r.diff})`)
              .join('; ')),
    );
  }
}

void main();
