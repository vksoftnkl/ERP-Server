-- ───────────────────────────────────────────────────────────────────────────
--  Covering index for the party credit summary
--  (GET /api/v1/master-lookups/party-credit → BillBalanceService.getCreditSummary)
--
--  The credit check runs on every sale bill and sales order entry, so it has to
--  come off the index alone. ix_abl_open already leads with
--  (abl_company_id, abl_party_id, ...) but INCLUDEs abl_doc_refno /
--  abl_bill_amount instead of abl_due_date, so the overdue FILTER clauses would
--  send it back to the heap for every open bill of the party — and it carries
--  no branch column, so the branch-scoped variant of the check cannot prune.
--
--  Key order: PARTY FIRST. It is the endpoint's only required parameter —
--  company and branch merely narrow — so it is the only column guaranteed to be
--  in the predicate, and therefore the only one that can always lead the scan.
--  Leading with abl_company_id (as ix_abl_open does) would leave the
--  company-less call with no usable prefix at all. Company then branch follow in
--  the order a caller is likely to supply them.
--
--  No abl_acc_year anywhere. A bill is never carried forward — it stays open in
--  the partition of the year it was RAISED in — so the credit check reads every
--  partition on purpose. Filtering it on the entry screen's year would drop
--  real prior-year debt, which is exactly the year-end carry-forward gap.
--  This matches ix_abl_open / ix_abl_overdue, which are year-blind for the same
--  reason (see the header of 20260811090000).
--
--  Predicate mirrors the query's WHERE exactly (`> 0`, not the `<> 0` its
--  siblings use) so index usability needs no proof step from the planner.
--
--  NOT DECLARED IN THE PRISMA SCHEMA, and must not be: Prisma cannot express a
--  partial index or an INCLUDE clause, so a matching @@index in the model would
--  make every `migrate diff` see phantom drift and emit an unpredicated
--  CREATE INDEX that fails 42P07 on this name.
--
--  Built without CONCURRENTLY, unlike the usual advice for a hot table: neither
--  form is available here. Postgres rejects CREATE INDEX CONCURRENTLY on a
--  partitioned table, and Prisma wraps each migration in a transaction, where
--  CONCURRENTLY is illegal regardless. The index is created on the partitioned
--  parent, which cascades to every existing partition and is picked up
--  automatically by the CREATE TABLE ... PARTITION OF in
--  public.ensure_acc_year_partitions when a new year is opened.
-- ───────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS ix_abl_party_credit
    ON accounts.acc_bill_balance USING btree
    (abl_party_id, abl_company_id, abl_branch_id)
    INCLUDE (abl_pending_amount, abl_due_date, abl_dr_cr)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE abl_is_deleted = false AND abl_pending_amount > 0;

COMMENT ON INDEX accounts.ix_abl_party_credit IS
    'Party credit summary: one party''s open bills across all years, with the pending amount, due date and DR/CR flag INCLUDEd so the aggregate never touches the heap. Party leads the key because it is the endpoint''s only required filter.';
