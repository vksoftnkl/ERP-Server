-- "Which bills were raised from this document?"
--
-- sales.sale_bill_item has carried ix_sbi_src_doc since it was created, but the
-- HEADER's own reference had no index: nothing read sale_bill by it. The
-- quotation conversion back-write does — every save of a bill whose header names
-- a quotation asks whether a live bill still names that quote — and without an
-- index that is a sequential scan of every sale_bill partition.
--
-- sale_bill is LIST-partitioned by sb_acc_year, so this creates the index on the
-- partitioned parent; Postgres builds a matching child index on every existing
-- partition and on every partition created afterwards.
CREATE INDEX IF NOT EXISTS ix_sb_src_doc
    ON sales.sale_bill (sb_src_doc_id, sb_src_doc_year);
