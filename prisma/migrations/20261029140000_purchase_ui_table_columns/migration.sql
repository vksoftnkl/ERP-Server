-- ═══════════════════════════════════════════════════════════════════════════
--  Purchase screens: register the columns of today's rebuilds in the ui_table
--  registry (2026-10-29)
--
--  The Qt grids (NexTable) read fixed.ui_table_columns by COLUMN NUMBER
--  (ui_tbl_clm_no = the screen's *Cols enum value). A column the registry does
--  not name stays hidden after loadLayout() until the screen shows it itself,
--  and the count mismatch logs "layout has N columns but the entity declares
--  M". Every new column below is APPENDED at its enum number: nothing is
--  renumbered (the index-shift trap of the receipt, 2026-09-16), so every
--  stored width / title stays on its own column.
--
--  Positions are the screen's order (applyColumns), ranked 0..n; the columns
--  the screen never shows come after, by number. Widths are the screens'
--  ColumnWeights as a percentage of the default set (every optional column
--  off); optional columns use the same scale; never-shown columns are 0.
--  Visibility: false only for columns the screen never shows and for the
--  invoice's "More columns" (chooser, default off); a column that a setting or
--  the data switches (textile, Sell A-D, Markup, Excess) is true, the screen
--  hides it.
--  Titles are the mockup headings the screens set in code today.
--
--   56 PURCHASE INVOICE - LINES   45 rows kept (0..44); retitled Disc, GST%,
--      Cost w/o, Markup%, PO / GRN ref, Model / design; re-ranked, widths.
--      Not registered: Gross, Disc Rs, Cess %, Cess / unit, Mfg date, Godown,
--      Weight, Old prices, Remarks. The server has them (pii_gross_amt,
--      pii_disc_amt, pii_cess_pct, pii_cess_per_unit, pii_weight,
--      pii_old_prices, pii_remarks; mfg date and godown per alloc row) but
--      PurchaseInvoiceCols has no slot for them; a registered row past
--      Count is the very warning this fixes. A later migration appends them
--      at 45.. once the enum does.
--   62 PURCHASE INVOICE - CHARGES  Net (7) titled "Into cost", ranked before
--      GST. The PO and GRN read 62 too; both hide GST / Net and title their
--      own columns, so neither changes.
--   57 PURCHASE ORDER - LINES      + 17..22 Sch%, Short-closed, Last rate,
--      Stock, Reorder, Status; Qty->Ordered, Total->Amount, Recd->Received,
--      Disc %->Disc%, GST %->GST%; Taxable hidden (the screen hides it).
--   58 GRN - LINES                 + 32..38 Dmg reason, DmgReasonId, Shelf
--      life, Labels, Check, CheckJson, PoAccYear; PO pend., Received, Prov.
--      rate, Model / design; PO (3) and Value (11) hidden.
--   59 PURCHASE RETURN - LINES     + 18..25 Billed, Returned, Reason,
--      ReasonId, Credit to, Writes, Expiry, MRP; Batch · Exp, Bucket, GST;
--      Bill Ln, Unit, Can Return, Claim On, GST %, Total hidden.
--   65 SUPPLIER DUES - CLAIMS      new, read-only (DuesClaimCols, 24 rows)
--   66 SUPPLIER DUES - SHORTAGES   new, read-only (DuesShortageCols, 23 rows)
--      Menu 297's two grids (NexTable filled from
--      /purchase/supplier-dues/open), shaped like the read-only registry
--      tables 45-50. The page lays them out locally until it calls
--      loadLayout(65 / 66).
--
--  Tables 56-62 were registered through the API (share grids/*.py), so a
--  fresh database has none of them while migrations run: every row here is
--  guarded on its parent and prisma/seed/Ui_Tables.sql +
--  Ui_Table_Columns.sql carry the same rows (column ids pinned, 2229-2296).
--  Shortage Receipt (61) is being rebuilt; a second pass follows.
--  Re-runnable: updates touch only rows that differ, inserts skip a number
--  that is already live.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0 · pinned ids must be free (or already ours) ──────────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(x, ', ') INTO v_clash FROM (
        SELECT format('ui_table %s (%s)', t.ui_tbl_id, t.ui_tbl_name) AS x
          FROM fixed.ui_tables t
          JOIN (VALUES
                (56::bigint, 'PURCHASE INVOICE - LINES'),
                (57, 'PURCHASE ORDER - LINES'),
                (58, 'GRN - LINES'),
                (59, 'PURCHASE RETURN - LINES'),
                (62, 'PURCHASE INVOICE - CHARGES'),
                (65, 'SUPPLIER DUES - CLAIMS'),
                (66, 'SUPPLIER DUES - SHORTAGES')
               ) v(id, name) ON v.id = t.ui_tbl_id
         WHERE t.ui_tbl_name IS DISTINCT FROM v.name
        UNION ALL
        SELECT format('ui_table_column %s (table %s no %s)', c.ui_tbl_clm_id, c.ui_tbl_clm_table_id, c.ui_tbl_clm_no)
          FROM fixed.ui_table_columns c
          JOIN (VALUES
                (2229::bigint, 57::bigint, 17::bigint),
                (2230, 57, 18),
                (2231, 57, 19),
                (2232, 57, 20),
                (2233, 57, 21),
                (2234, 57, 22),
                (2235, 58, 32),
                (2236, 58, 33),
                (2237, 58, 34),
                (2238, 58, 35),
                (2239, 58, 36),
                (2240, 58, 37),
                (2241, 58, 38),
                (2242, 59, 18),
                (2243, 59, 19),
                (2244, 59, 20),
                (2245, 59, 21),
                (2246, 59, 22),
                (2247, 59, 23),
                (2248, 59, 24),
                (2249, 59, 25),
                (2250, 65, 0),
                (2251, 65, 1),
                (2252, 65, 2),
                (2253, 65, 3),
                (2254, 65, 4),
                (2255, 65, 5),
                (2256, 65, 6),
                (2257, 65, 7),
                (2258, 65, 8),
                (2259, 65, 9),
                (2260, 65, 10),
                (2261, 65, 11),
                (2262, 65, 12),
                (2263, 65, 13),
                (2264, 65, 14),
                (2265, 65, 15),
                (2266, 65, 16),
                (2267, 65, 17),
                (2268, 65, 18),
                (2269, 65, 19),
                (2270, 65, 20),
                (2271, 65, 21),
                (2272, 65, 22),
                (2273, 65, 23),
                (2274, 66, 0),
                (2275, 66, 1),
                (2276, 66, 2),
                (2277, 66, 3),
                (2278, 66, 4),
                (2279, 66, 5),
                (2280, 66, 6),
                (2281, 66, 7),
                (2282, 66, 8),
                (2283, 66, 9),
                (2284, 66, 10),
                (2285, 66, 11),
                (2286, 66, 12),
                (2287, 66, 13),
                (2288, 66, 14),
                (2289, 66, 15),
                (2290, 66, 16),
                (2291, 66, 17),
                (2292, 66, 18),
                (2293, 66, 19),
                (2294, 66, 20),
                (2295, 66, 21),
                (2296, 66, 22)
               ) v(id, tbl, no) ON v.id = c.ui_tbl_clm_id
         WHERE (c.ui_tbl_clm_table_id, c.ui_tbl_clm_no) IS DISTINCT FROM (v.tbl, v.no)) c;
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'Purchase ui_tables: ids already taken: %. Pick free ids here and in the seed files.', v_clash;
    END IF;
END $$;


-- ── 1 · the two Supplier Dues tables ───────────────────────────────────────
INSERT INTO fixed.ui_tables
       (ui_tbl_id, ui_tbl_name, ui_tbl_editable, ui_tbl_device_type, ui_tbl_is_active, ui_tbl_is_deleted, ui_tbl_created_by)
VALUES (65, 'SUPPLIER DUES - CLAIMS',    false, 'Desktop', true, false, 'system'),
       (66, 'SUPPLIER DUES - SHORTAGES', false, 'Desktop', true, false, 'system')
ON CONFLICT (ui_tbl_id) DO NOTHING;


-- ── 2 · registered columns: titles, widths, visibility, positions ─────────
UPDATE fixed.ui_table_columns c
   SET ui_tbl_clm_name              = v.name,
       ui_tbl_clm_column_width      = v.width,
       ui_tbl_clm_column_visibility = v.visible,
       ui_tbl_clm_column_position   = v.pos,
       ui_tbl_clm_modified_on       = now()
  FROM (VALUES
        (56::bigint, 0::bigint, 'Barcode'::text, 7.58::numeric, true::boolean, 0::integer),
        (56, 1, 'Item', 10.61, true, 1),
        (56, 2, 'Unit', 3.79, true, 2),
        (56, 3, 'Batch / Serial', 7.58, true, 6),
        (56, 4, 'Expiry', 6.06, true, 7),
        (56, 5, 'Billed', 3.79, true, 8),
        (56, 6, 'Recd', 3.79, true, 9),
        (56, 7, 'Dmg', 3.03, true, 10),
        (56, 8, 'Short', 3.03, true, 11),
        (56, 9, 'Free', 3.03, true, 12),
        (56, 10, 'Rate', 5.30, true, 13),
        (56, 11, 'Disc', 3.79, true, 14),
        (56, 12, 'Taxable', 5.30, true, 17),
        (56, 13, 'GST%', 3.03, true, 18),
        (56, 14, 'Tax', 4.55, true, 20),
        (56, 15, 'Total', 5.30, true, 21),
        (56, 16, 'Cost w/o', 4.55, true, 22),
        (56, 17, 'MRP', 3.79, true, 29),
        (56, 18, 'Check', 7.58, true, 31),
        (56, 19, 'ItemId', 0, false, 32),
        (56, 20, 'UomId', 0, false, 33),
        (56, 21, 'Factor', 0, false, 34),
        (56, 22, 'Signature', 0, false, 35),
        (56, 23, 'LineId', 0, false, 36),
        (56, 24, 'PO / GRN ref', 4.55, false, 30),
        (56, 25, 'GrnItemId', 0, false, 37),
        (56, 26, 'GrnYear', 0, false, 38),
        (56, 27, 'Allocs', 0, false, 39),
        (56, 28, 'Size', 3.03, true, 4),
        (56, 29, 'SizeId', 0, false, 40),
        (56, 30, 'Colour', 3.79, true, 5),
        (56, 31, 'ColourId', 0, false, 41),
        (56, 32, 'Model / design', 5.30, true, 3),
        (56, 33, 'Sell A', 4.55, true, 25),
        (56, 34, 'Sell B', 3.79, false, 26),
        (56, 35, 'Sell C', 3.79, false, 27),
        (56, 36, 'Sell D', 3.79, false, 28),
        (56, 37, 'PoItemId', 0, false, 42),
        (56, 38, 'PoYear', 0, false, 43),
        (56, 39, 'Sch %', 3.03, false, 15),
        (56, 40, 'Extra disc', 3.79, false, 16),
        (56, 41, 'Cost incl.', 4.55, false, 23),
        (56, 42, 'CostTyped', 0, false, 44),
        (56, 43, 'Markup%', 4.55, true, 24),
        (56, 44, 'ITC', 4.55, true, 19),
        (62, 0, 'Charge', 17.02, true, 0),
        (62, 1, 'On bill', 7.45, true, 1),
        (62, 2, 'Basis', 18.09, true, 2),
        (62, 3, 'Rate', 7.45, true, 3),
        (62, 4, 'Amount', 9.57, true, 4),
        (62, 5, 'Payee', 24.47, true, 5),
        (62, 6, 'GST', 7.45, true, 7),
        (62, 7, 'Into cost', 8.51, true, 6),
        (62, 8, 'ChgId', 0, false, 8),
        (62, 9, 'Typed', 0, false, 9),
        (62, 10, 'PayeeIds', 0, false, 10),
        (62, 11, 'OnBillFlag', 0, false, 11),
        (62, 12, 'Method', 0, false, 12),
        (57, 0, 'Barcode', 5.88, true, 0),
        (57, 1, 'Item', 12.61, true, 1),
        (57, 2, 'Unit', 5.04, true, 2),
        (57, 3, 'Ordered', 5.04, true, 3),
        (57, 4, 'Free', 3.36, true, 4),
        (57, 5, 'Rate', 5.04, true, 5),
        (57, 6, 'Disc%', 4.20, true, 6),
        (57, 7, 'Taxable', 0, false, 19),
        (57, 8, 'GST%', 3.36, true, 8),
        (57, 9, 'Tax', 5.04, true, 10),
        (57, 10, 'Amount', 5.88, true, 11),
        (57, 11, 'Received', 5.04, true, 12),
        (57, 12, 'Pending', 5.04, true, 14),
        (57, 13, 'MRP', 4.20, true, 9),
        (57, 14, 'ItemId', 0, false, 20),
        (57, 15, 'UomId', 0, false, 21),
        (57, 16, 'LineId', 0, false, 22),
        (58, 0, 'Barcode', 6.48, true, 0),
        (58, 1, 'Item', 12.04, true, 1),
        (58, 2, 'Unit', 4.63, true, 2),
        (58, 3, 'PO', 0, false, 26),
        (58, 4, 'PO pend.', 5.56, true, 3),
        (58, 5, 'Challan', 4.63, true, 4),
        (58, 6, 'Received', 5.56, true, 5),
        (58, 7, 'Dmg', 3.70, true, 6),
        (58, 8, 'Free', 3.70, true, 8),
        (58, 9, 'Short', 3.70, true, 9),
        (58, 10, 'Prov. rate', 5.56, true, 12),
        (58, 11, 'Value', 0, false, 27),
        (58, 12, 'Batch / Serial', 7.41, true, 16),
        (58, 13, 'Expiry', 7.41, true, 17),
        (58, 14, 'MRP', 4.63, true, 18),
        (58, 15, 'ItemId', 0, false, 28),
        (58, 16, 'UomId', 0, false, 29),
        (58, 17, 'PoItemId', 0, false, 30),
        (58, 18, 'LineId', 0, false, 31),
        (58, 19, 'Signature', 0, false, 32),
        (58, 20, 'Allocs', 0, false, 33),
        (58, 21, 'Size', 3.70, true, 14),
        (58, 22, 'SizeId', 0, false, 34),
        (58, 23, 'Colour', 4.63, true, 15),
        (58, 24, 'ColourId', 0, false, 35),
        (58, 25, 'Model / design', 7.41, true, 13),
        (58, 26, 'Sell A', 4.63, true, 20),
        (58, 27, 'Excess', 4.63, true, 10),
        (58, 28, 'Excess action', 6.48, true, 11),
        (58, 29, 'Sell B', 4.63, true, 21),
        (58, 30, 'Sell C', 4.63, true, 22),
        (58, 31, 'Sell D', 4.63, true, 23),
        (59, 0, 'Bill Ln', 0, false, 13),
        (59, 1, 'Item', 14.71, true, 0),
        (59, 2, 'Unit', 0, false, 14),
        (59, 3, 'Batch · Exp', 8.82, true, 1),
        (59, 4, 'Bucket', 6.86, true, 2),
        (59, 5, 'Can Return', 0, false, 15),
        (59, 6, 'Qty', 4.90, true, 5),
        (59, 7, 'Outcome', 11.76, true, 9),
        (59, 8, 'Claim On', 0, false, 16),
        (59, 9, 'Rate', 4.90, true, 6),
        (59, 10, 'GST %', 0, false, 17),
        (59, 11, 'Value', 5.88, true, 7),
        (59, 12, 'GST', 4.90, true, 8),
        (59, 13, 'Total', 0, false, 18),
        (59, 14, 'SrcItemId', 0, false, 19),
        (59, 15, 'LotId', 0, false, 20),
        (59, 16, 'UnitTax', 0, false, 21),
        (59, 17, 'LineId', 0, false, 22)
       ) v(tbl, no, name, width, visible, pos)
 WHERE c.ui_tbl_clm_table_id = v.tbl
   AND c.ui_tbl_clm_no       = v.no
   AND c.ui_tbl_clm_is_deleted = false
   AND (c.ui_tbl_clm_name, c.ui_tbl_clm_column_width, c.ui_tbl_clm_column_visibility, c.ui_tbl_clm_column_position)
       IS DISTINCT FROM (v.name, v.width, v.visible, v.pos);


-- ── 3 · new columns, appended at their enum numbers ───────────────────────
INSERT INTO fixed.ui_table_columns
       (ui_tbl_clm_id, ui_tbl_clm_table_id, ui_tbl_clm_no, ui_tbl_clm_name, ui_tbl_clm_column_width,
        ui_tbl_clm_column_visibility, ui_tbl_clm_column_focus, ui_tbl_clm_column_position,
        ui_tbl_clm_column_necessity, ui_tbl_clm_is_active, ui_tbl_clm_is_deleted, ui_tbl_clm_created_by)
SELECT v.id, v.tbl, v.no, v.name, v.width, v.visible, false, v.pos, false, true, false,
       COALESCE((SELECT e.ui_tbl_clm_created_by FROM fixed.ui_table_columns e
                  WHERE e.ui_tbl_clm_table_id = v.tbl ORDER BY e.ui_tbl_clm_no, e.ui_tbl_clm_id LIMIT 1), 'system')
  FROM (VALUES
        (2229::bigint, 57::bigint, 17::bigint, 'Sch%'::text, 4.20::numeric, true::boolean, 7::integer),
        (2230, 57, 18, 'Short-closed', 5.88, true, 13),
        (2231, 57, 19, 'Last rate', 5.04, true, 15),
        (2232, 57, 20, 'Stock', 4.20, true, 16),
        (2233, 57, 21, 'Reorder', 4.20, true, 17),
        (2234, 57, 22, 'Status', 6.72, true, 18),
        (2235, 58, 32, 'Dmg reason', 6.48, true, 7),
        (2236, 58, 33, 'DmgReasonId', 0, false, 36),
        (2237, 58, 34, 'Shelf life', 5.56, true, 19),
        (2238, 58, 35, 'Labels', 4.63, true, 24),
        (2239, 58, 36, 'Check', 8.33, true, 25),
        (2240, 58, 37, 'CheckJson', 0, false, 37),
        (2241, 58, 38, 'PoAccYear', 0, false, 38),
        (2242, 59, 18, 'Billed', 4.90, true, 3),
        (2243, 59, 19, 'Returned', 4.90, true, 4),
        (2244, 59, 20, 'Reason', 8.82, true, 10),
        (2245, 59, 21, 'ReasonId', 0, false, 23),
        (2246, 59, 22, 'Credit to', 9.80, true, 11),
        (2247, 59, 23, 'Writes', 8.82, true, 12),
        (2248, 59, 24, 'Expiry', 0, false, 24),
        (2249, 59, 25, 'MRP', 0, false, 25),
        (2250, 65, 0, '', 2.08, true, 0),
        (2251, 65, 1, 'Claim', 10.42, true, 1),
        (2252, 65, 2, 'Date', 6.25, true, 2),
        (2253, 65, 3, 'Age', 3.47, true, 3),
        (2254, 65, 4, 'Item', 10.42, true, 4),
        (2255, 65, 5, 'Kind', 7.64, true, 5),
        (2256, 65, 6, 'Against', 7.64, true, 6),
        (2257, 65, 7, 'Reason', 7.64, true, 7),
        (2258, 65, 8, 'Value', 6.25, true, 8),
        (2259, 65, 9, 'Credited', 6.25, true, 9),
        (2260, 65, 10, 'Written off', 6.25, true, 10),
        (2261, 65, 11, 'Open', 6.25, true, 11),
        (2262, 65, 12, 'Status', 6.94, true, 12),
        (2263, 65, 13, 'Last action', 12.50, true, 13),
        (2264, 65, 14, 'Source', 0, false, 14),
        (2265, 65, 15, 'ReturnItemId', 0, false, 15),
        (2266, 65, 16, 'ShortageCloseId', 0, false, 16),
        (2267, 65, 17, 'AccYear', 0, false, 17),
        (2268, 65, 18, 'PartyId', 0, false, 18),
        (2269, 65, 19, 'PartyName', 0, false, 19),
        (2270, 65, 20, 'ClaimAgainst', 0, false, 20),
        (2271, 65, 21, 'LastSettlementId', 0, false, 21),
        (2272, 65, 22, 'LastAccYear', 0, false, 22),
        (2273, 65, 23, 'Refno', 0, false, 23),
        (2274, 66, 0, '', 2.42, true, 0),
        (2275, 66, 1, 'From', 11.29, true, 1),
        (2276, 66, 2, 'Date', 6.45, true, 2),
        (2277, 66, 3, 'Age', 3.23, true, 3),
        (2278, 66, 4, 'Item', 12.90, true, 4),
        (2279, 66, 5, 'Why', 8.06, true, 5),
        (2280, 66, 6, 'Short', 4.03, true, 6),
        (2281, 66, 7, 'Recd', 4.03, true, 7),
        (2282, 66, 8, 'Closed', 4.03, true, 8),
        (2283, 66, 9, 'Open', 4.03, true, 9),
        (2284, 66, 10, 'Cost', 5.65, true, 10),
        (2285, 66, 11, 'GST held', 5.65, true, 11),
        (2286, 66, 12, 'Status', 6.45, true, 12),
        (2287, 66, 13, 'Outcome', 8.87, true, 13),
        (2288, 66, 14, 'Last action', 12.90, true, 14),
        (2289, 66, 15, 'ShortageId', 0, false, 15),
        (2290, 66, 16, 'AccYear', 0, false, 16),
        (2291, 66, 17, 'Reason', 0, false, 17),
        (2292, 66, 18, 'LastCloseId', 0, false, 18),
        (2293, 66, 19, 'LastAccYear', 0, false, 19),
        (2294, 66, 20, 'OpenQty', 0, false, 20),
        (2295, 66, 21, 'Refno', 0, false, 21),
        (2296, 66, 22, 'Unit', 0, false, 22)
       ) v(id, tbl, no, name, width, visible, pos)
 WHERE EXISTS (SELECT 1 FROM fixed.ui_tables t WHERE t.ui_tbl_id = v.tbl)
   AND NOT EXISTS (SELECT 1 FROM fixed.ui_table_columns e
                    WHERE e.ui_tbl_clm_table_id = v.tbl AND e.ui_tbl_clm_no = v.no AND e.ui_tbl_clm_is_deleted = false)
ON CONFLICT (ui_tbl_clm_id) DO NOTHING;


-- ── 4 · keep both sequences ahead of the pinned ids ───────────────────────
SELECT setval('fixed.ui_tables_ui_tbl_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_tables_ui_tbl_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_id), 1) FROM fixed.ui_tables)), true);
SELECT setval('fixed.ui_table_columns_ui_tbl_clm_id_seq',
              GREATEST((SELECT last_value FROM fixed.ui_table_columns_ui_tbl_clm_id_seq),
                       (SELECT COALESCE(MAX(ui_tbl_clm_id), 1) FROM fixed.ui_table_columns)), true);
