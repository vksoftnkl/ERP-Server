import { Prisma } from '@prisma/client';

/**
 * notes (55) — our cheque books (accounts.acc_cheque_book).
 *
 * A Payment Voucher's cheque names a BOOK, never a leaf. `/validate` shows the
 * leaf the book would hand out next (shown, not promised); `/post` takes it
 * with `takeNextLeaf` under FOR UPDATE, so two concurrent payments on one book
 * get consecutive leaves and neither sees the other's. A leaf once taken stays
 * taken: nothing here ever moves `acb_next_leaf` back.
 */

type Client = Prisma.TransactionClient;

export interface ChequeBookFacts {
  chequeBookId: string;
  companyId: string;
  branchId: string | null;
  bankLedgerId: string;
  bankName: string;
  bookNo: string;
  leafFrom: number;
  leafTo: number;
  nextLeaf: number;
  leafWidth: number;
  format: string | null;
  status: 'ACTIVE' | 'FINISHED' | 'CLOSED';
  remarks: string | null;
  isDeleted: boolean;
}

interface BookRow {
  acb_id: string;
  acb_company_id: string;
  acb_branch_id: string | null;
  acb_bank_ledger_id: string;
  led_name: string;
  acb_book_no: string;
  acb_leaf_from: bigint;
  acb_leaf_to: bigint;
  acb_next_leaf: bigint;
  acb_leaf_width: number;
  acb_format: string | null;
  acb_status: string;
  acb_remarks: string | null;
  acb_is_deleted: boolean;
}

const BOOK_SELECT = Prisma.sql`
  SELECT b.acb_id, b.acb_company_id, b.acb_branch_id, b.acb_bank_ledger_id, l.led_name,
         b.acb_book_no, b.acb_leaf_from, b.acb_leaf_to, b.acb_next_leaf, b.acb_leaf_width,
         b.acb_format, b.acb_status, b.acb_remarks, b.acb_is_deleted
    FROM accounts.acc_cheque_book b
    JOIN accounts.acc_ledger_master l ON l.led_id = b.acb_bank_ledger_id`;

function toFacts(r: BookRow): ChequeBookFacts {
  return {
    chequeBookId: r.acb_id,
    companyId: r.acb_company_id,
    branchId: r.acb_branch_id,
    bankLedgerId: r.acb_bank_ledger_id,
    bankName: r.led_name,
    bookNo: r.acb_book_no,
    leafFrom: Number(r.acb_leaf_from),
    leafTo: Number(r.acb_leaf_to),
    nextLeaf: Number(r.acb_next_leaf),
    leafWidth: r.acb_leaf_width,
    format: r.acb_format,
    status: r.acb_status as ChequeBookFacts['status'],
    remarks: r.acb_remarks,
    isDeleted: r.acb_is_deleted,
  };
}

/** A leaf as it prints: zero-padded to the book's width. */
export function formatLeaf(leaf: number, width: number): string {
  return String(leaf).padStart(width, '0');
}

/** Leaves still to hand out (0 once finished). */
export function leavesLeft(b: Pick<ChequeBookFacts, 'leafTo' | 'nextLeaf'>): number {
  return Math.max(0, b.leafTo - b.nextLeaf + 1);
}

export async function loadChequeBooks(
  tx: Client,
  ids: readonly string[],
): Promise<Map<string, ChequeBookFacts>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await tx.$queryRaw<BookRow[]>`
    ${BOOK_SELECT}
     WHERE b.acb_id = ANY(${unique}::uuid[])`;
  return new Map(rows.map((r) => [r.acb_id, toFacts(r)]));
}

export async function loadChequeBook(tx: Client, id: string): Promise<ChequeBookFacts | null> {
  return (await loadChequeBooks(tx, [id])).get(id) ?? null;
}

/**
 * The books a payment may take a leaf from: ACTIVE, not deleted, with a leaf
 * left, usable from the branch (a branch-less book serves every branch).
 */
export async function listOpenChequeBooks(
  tx: Client,
  q: { companyId: string; branchId?: string | null; bankLedgerId?: string | null },
): Promise<ChequeBookFacts[]> {
  const rows = await tx.$queryRaw<BookRow[]>`
    ${BOOK_SELECT}
     WHERE b.acb_company_id = ${q.companyId}::uuid
       AND b.acb_is_deleted = false
       AND b.acb_is_active = true
       AND b.acb_status = 'ACTIVE'
       AND b.acb_next_leaf <= b.acb_leaf_to
       AND (${q.branchId ?? null}::uuid IS NULL OR b.acb_branch_id IS NULL
            OR b.acb_branch_id = ${q.branchId ?? null}::uuid)
       AND (${q.bankLedgerId ?? null}::uuid IS NULL OR b.acb_bank_ledger_id = ${q.bankLedgerId ?? null}::uuid)
     ORDER BY l.led_name, b.acb_leaf_from`;
  return rows.map(toFacts);
}

export interface TakenLeaf {
  chequeBookId: string;
  bookNo: string;
  leaf: string;
  leafNo: number;
}

/**
 * §5.2 step 6 — hand out the book's next leaf. The row is locked FOR UPDATE,
 * so a concurrent post on the same book waits here and then takes the leaf
 * after this one. The book goes FINISHED as its last leaf leaves. `null` =
 * nothing left to take (finished, closed or gone since /validate): the caller
 * refuses with VCH_BOOK_FINISHED.
 */
export async function takeNextLeaf(
  tx: Client,
  chequeBookId: string,
  actor: string,
): Promise<TakenLeaf | null> {
  const [book] = await tx.$queryRaw<BookRow[]>`
    ${BOOK_SELECT}
     WHERE b.acb_id = ${chequeBookId}::uuid
       FOR UPDATE OF b`;
  if (
    !book ||
    book.acb_is_deleted ||
    book.acb_status !== 'ACTIVE' ||
    book.acb_next_leaf > book.acb_leaf_to
  ) {
    return null;
  }
  const leafNo = Number(book.acb_next_leaf);
  const finished = book.acb_next_leaf + 1n > book.acb_leaf_to;
  await tx.$executeRaw`
    UPDATE accounts.acc_cheque_book
       SET acb_next_leaf   = acb_next_leaf + 1,
           acb_status      = ${finished ? 'FINISHED' : 'ACTIVE'},
           acb_modified_on = now(),
           acb_modified_by = ${actor}
     WHERE acb_id = ${chequeBookId}::uuid`;
  return {
    chequeBookId,
    bookNo: book.acb_book_no,
    leaf: formatLeaf(leafNo, book.acb_leaf_width),
    leafNo,
  };
}
