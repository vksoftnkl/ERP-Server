"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatLeaf = formatLeaf;
exports.leavesLeft = leavesLeft;
exports.loadChequeBooks = loadChequeBooks;
exports.loadChequeBook = loadChequeBook;
exports.listOpenChequeBooks = listOpenChequeBooks;
exports.takeNextLeaf = takeNextLeaf;
const client_1 = require("@prisma/client");
const BOOK_SELECT = client_1.Prisma.sql `
  SELECT b.acb_id, b.acb_company_id, b.acb_branch_id, b.acb_bank_ledger_id, l.led_name,
         b.acb_book_no, b.acb_leaf_from, b.acb_leaf_to, b.acb_next_leaf, b.acb_leaf_width,
         b.acb_format, b.acb_status, b.acb_remarks, b.acb_is_deleted
    FROM accounts.acc_cheque_book b
    JOIN accounts.acc_ledger_master l ON l.led_id = b.acb_bank_ledger_id`;
function toFacts(r) {
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
        status: r.acb_status,
        remarks: r.acb_remarks,
        isDeleted: r.acb_is_deleted,
    };
}
function formatLeaf(leaf, width) {
    return String(leaf).padStart(width, '0');
}
function leavesLeft(b) {
    return Math.max(0, b.leafTo - b.nextLeaf + 1);
}
async function loadChequeBooks(tx, ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0)
        return new Map();
    const rows = await tx.$queryRaw `
    ${BOOK_SELECT}
     WHERE b.acb_id = ANY(${unique}::uuid[])`;
    return new Map(rows.map((r) => [r.acb_id, toFacts(r)]));
}
async function loadChequeBook(tx, id) {
    return (await loadChequeBooks(tx, [id])).get(id) ?? null;
}
async function listOpenChequeBooks(tx, q) {
    const rows = await tx.$queryRaw `
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
async function takeNextLeaf(tx, chequeBookId, actor) {
    const [book] = await tx.$queryRaw `
    ${BOOK_SELECT}
     WHERE b.acb_id = ${chequeBookId}::uuid
       FOR UPDATE OF b`;
    if (!book ||
        book.acb_is_deleted ||
        book.acb_status !== 'ACTIVE' ||
        book.acb_next_leaf > book.acb_leaf_to) {
        return null;
    }
    const leafNo = Number(book.acb_next_leaf);
    const finished = book.acb_next_leaf + 1n > book.acb_leaf_to;
    await tx.$executeRaw `
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
//# sourceMappingURL=cheque-book.helper.js.map