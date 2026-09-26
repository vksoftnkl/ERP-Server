-- Converting a sale order to a bill makes the order re-derive its fulfilment
-- caches from every bill line raised against it:
--
--   SELECT ... FROM sales.sale_bill_item
--    WHERE sbi_src_doc_type = 'SALES_ORDER'
--      AND sbi_src_doc_id    = $1
--      AND sbi_src_doc_year  = $2
--
-- That read deliberately does NOT constrain sbi_acc_year — an order taken in
-- one accounting year is routinely billed in the next, so the sum has to reach
-- across partitions — which without this index makes it a sequential scan of
-- every sale_bill_item partition on every converted bill save.
--
-- Declared on the partitioned parent, so Postgres attaches a matching index to
-- each partition (and to any partition ensure_acc_year_partitions adds later).
-- Non-partial and non-unique, which is why SaleBillItem CAN carry the matching
-- @@index and `migrate dev` will not try to recreate it.
CREATE INDEX IF NOT EXISTS "ix_sbi_src_doc"
    ON "sales"."sale_bill_item" ("sbi_src_doc_id", "sbi_src_doc_year", "sbi_src_doc_line_no");
