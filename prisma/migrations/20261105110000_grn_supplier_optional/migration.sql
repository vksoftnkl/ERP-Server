-- ═══════════════════════════════════════════════════════════════════════════
--  GRN rework phase 6, #13 (Shared/Prathap/purchase/plan-grn-rework-2026-11-04.md,
--  decision D2, user 2026-11-04): a GRN DRAFT may be saved without a supplier;
--  Post (and an amend) refuse until one is picked (PUR_SUPPLIER_REQUIRED, the
--  server). Plus the wording of the amend refusals (#15 / #16, D3 / D4).
--
--  1. purchase.pur_grn.grn_supplier_id DROP NOT NULL (partitioned: the
--     partitions follow). Nothing else needs a change: fk_grn_supplier lets a
--     NULL through, ix_grn_supplier (partial on grn_is_deleted) indexes NULLs,
--     no CHECK names the column, and the table's only triggers are the sync
--     ones (zz_sync_log_delete / zz_sync_mark_dirty). A POSTED GRN always has
--     its supplier (the server refuses a post without one).
--  2. Grid 'MAIN LIST - GRN' (191 on .106; registered through the API by share
--     grids/purchase_po_grn_registration.py, kept in step; not in
--     prisma/seed/Grid_Details.sql) — the same config serves the menu list and
--     the screen's Show List / Ctrl+O: the supplier is LEFT JOINed, so a draft
--     with no supplier is listed (Supplier blank) instead of vanishing.
--     Matched by NAME and guarded on the old text.
--  3. Print template GoodsReceivedNoteA4 (purpose GRN; posted through the API
--     by share print/purchase_doc_templates.py, kept in step): the 'header'
--     dataset of each revision LEFT JOINs the supplier, so a supplier-less
--     draft still prints (DRAFT watermark, supplier blank) instead of an empty
--     master band. ptd_sql_norm is generated and follows. Guarded on the old
--     text; on a database without the template it does nothing.
--     Looked at and left alone (no inner join a supplier-less draft reaches):
--     grid 198 POPUP - PURCHASE RETURN GRNS (POSTED GRNs of one supplier only),
--     grid 192 MAIN LIST - PURCHASE RETURN (no GRN supplier join), the
--     /txn/adjacent GRN walk (no supplier join), txn_hold (party optional),
--     the shortage readers (LEFT JOIN pur_grn).
--  4. Plain wording (notes 120), catalogue 2026-11-05.1:
--       PUR_SUPPLIER_REQUIRED  variant field=header.supplierId (the GRN's; the
--                              plain row stays the reorder screen's "Every ticked
--                              row needs a supplier")
--       PUR_GRN_AMEND_BILLED       a purchase bill line names the GRN (drafts too, D4)
--       PUR_GRN_AMEND_STOCK_MOVED  its goods have gone out (D3)
--     prisma/seed/Error_Messages.json carries the same rows.
--
--  No new table, no function, no trigger. Grid SQL holds no comments (the
--  runner refuses "--" and "/*"). Re-runnable: every statement is guarded or
--  idempotent; the existing zz_sync_mark_dirty triggers mark updated rows.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · the supplier may wait on a draft ───────────────────────────────────
ALTER TABLE purchase.pur_grn ALTER COLUMN grn_supplier_id DROP NOT NULL;


-- ── 2 · grid MAIN LIST - GRN: a supplier-less draft is listed ──────────────
UPDATE fixed.grid_details
   SET grid_sql = replace(grid_sql,
$mig$  JOIN purchase.suppliers s ON s.sup_id = g.grn_supplier_id$mig$,
$mig$  LEFT JOIN purchase.suppliers s ON s.sup_id = g.grn_supplier_id$mig$),
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE grid_name = 'MAIN LIST - GRN'
   AND grid_is_deleted = false
   AND position('  JOIN purchase.suppliers s ON s.sup_id = g.grn_supplier_id' IN grid_sql) > 0
   AND position('LEFT JOIN purchase.suppliers s ON s.sup_id = g.grn_supplier_id' IN grid_sql) = 0;


-- ── 3 · print GoodsReceivedNoteA4: a supplier-less draft prints ────────────
UPDATE public.print_template_dataset d
   SET ptd_sql = replace(d.ptd_sql,
$mig$  JOIN purchase.suppliers   s ON s.sup_id = h.grn_supplier_id$mig$,
$mig$  LEFT JOIN purchase.suppliers s ON s.sup_id = h.grn_supplier_id$mig$),
       ptd_modified_on = now()
  FROM public.print_template_version v
  JOIN public.print_template t ON t.ptl_id = v.ptv_template_id
 WHERE v.ptv_id = d.ptd_version_id
   AND t.ptl_code = 'GoodsReceivedNoteA4'
   AND d.ptd_name = 'header'
   AND d.ptd_is_deleted = false
   AND position('FROM purchase.pur_grn h' IN d.ptd_sql) > 0
   AND position('  JOIN purchase.suppliers   s ON s.sup_id = h.grn_supplier_id' IN d.ptd_sql) > 0
   AND position('LEFT JOIN purchase.suppliers s ON s.sup_id = h.grn_supplier_id' IN d.ptd_sql) = 0;


-- ── 4 · plain wording rows (notes 120), catalogue 2026-11-05.1 ─────────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('PUR_SUPPLIER_REQUIRED', 'field=header.supplierId', 'en', 'Supplier needed', 'A GRN posts against its supplier, and none is picked yet.', 'Pick the supplier, then post.')
    ,('PUR_GRN_AMEND_BILLED', '', 'en', 'GRN already billed', 'A purchase bill (a draft too) already takes this GRN, so it can''t be changed.', 'Cancel or change that bill first.')
    ,('PUR_GRN_AMEND_STOCK_MOVED', '', 'en', 'Goods already gone out', 'Some of this GRN''s goods have already been sold, moved or adjusted, so it can''t be changed.', 'Bill it as it is, or enter a purchase return for the difference.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-11-05.1',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-11-05.1';
