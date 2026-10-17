-- ═══════════════════════════════════════════════════════════════════════════
--  GSTR register: the business-document key — notes 104 (2026-10-12)
--
--  uq_acc_voucher_doc_register_doc said "one register row per (company,
--  branch, year, doc type, doc no, doc date)" for EVERY row not soft-deleted.
--  Two things were wrong with that on the purchase side, where gdr_doc_no is
--  the SUPPLIER's number (the expense voucher's GST bill,
--  ExpenseService.registerDoc):
--
--    1. A cancel leaves its row CANCELED and not deleted — right for the
--       register, which must still answer for the cancelled document — but
--       the row kept holding the key. The voucher re-entered after a
--       "Cancel & re-enter" (the Qt Expense Voucher, menu 277; the README's
--       "no amend") could never post: the copy keeps the supplier's invoice no
--       and date, because it IS the same supplier bill, and its register row
--       answered 23505 — which /expenses/post surfaced as a bare 500.
--    2. The key had no party. Two suppliers who both number an invoice "101"
--       on one date could not both be booked in a branch.
--
--  The one index becomes two, split on gdr_doc_flow:
--
--    uq_acc_voucher_doc_register_doc_in   INWARD rows: + gdr_party_id, and a
--         CANCELED row no longer holds the key. A supplier's number is unique
--         per supplier, and once cancelled the document may be booked again.
--    uq_acc_voucher_doc_register_doc_out  OUTWARD and INTERNAL rows: the old
--         key as it was. gdr_doc_no is OUR number there (bill, return, DC,
--         register voucher refno); the series never re-issues a cancelled
--         number, and a CANCELED row keeps holding it, so a second document
--         under a cancelled number is still refused. An amend refiles the
--         same number through DocRegisterService.retire() (soft delete),
--         which this key skips as before.
--
--  Both carry gdr_acc_year: a unique index on this partitioned table must
--  contain the partition key (20260922100000). Declared on the parent, so
--  every partition — present and future — inherits them.
--
--  Checked on the dev box before writing: no live row set collides under
--  either new key (the INWARD key is strictly looser than the old one, the
--  OUTWARD key is the old one narrowed to its flows).
-- ═══════════════════════════════════════════════════════════════════════════

DROP INDEX accounts.uq_acc_voucher_doc_register_doc;

CREATE UNIQUE INDEX uq_acc_voucher_doc_register_doc_in
    ON accounts.acc_voucher_doc_register
       (gdr_company_id, gdr_branch_id, gdr_acc_year, gdr_doc_type,
        gdr_party_id, gdr_doc_no, gdr_doc_date)
    WHERE gdr_is_deleted = false
      AND gdr_doc_flow = 'INWARD'::accounts."GdrDocFlow"
      AND gdr_doc_status <> 'CANCELED'::accounts."GdrDocStatus";

CREATE UNIQUE INDEX uq_acc_voucher_doc_register_doc_out
    ON accounts.acc_voucher_doc_register
       (gdr_company_id, gdr_branch_id, gdr_acc_year, gdr_doc_type,
        gdr_doc_no, gdr_doc_date)
    WHERE gdr_is_deleted = false
      AND gdr_doc_flow <> 'INWARD'::accounts."GdrDocFlow";
