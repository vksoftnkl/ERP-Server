-- ═══════════════════════════════════════════════════════════════════════════
--  Bills list (grid 86): the print design follows the bill's own rule  2026-11-15
--  Folder: prisma/migrations/20261116110000_bills_list_print_design_layout/
--  (share copy: Shared/Prathap/accounts/sql/voucher-types-p4-bills-list-print-design.sql).
--
--  Voucher Types P4 Qt-test finding. 20261116100000 gave grid 86
--  "TXN MAIN LIST - BILLS" a hidden field print_purpose_code (the list prints
--  with it) as COALESCE(child's design, base's design, 'SALE_INVOICE'). That
--  ignores plan OP-4: a design with no layout yet must not be printed with.
--  /bills/get already obeys it (billVoucherTypeBlock in
--  src/modules/sales/bill/bill-voucher-type.helper.ts), so for a child type
--  whose own design has no layout the list said the design's code while the
--  bill said SALE_INVOICE.
--
--  The field now copies that function's rule exactly:
--    1. the type's own design (print_purpose, not deleted AND active) when it
--       has a layout;
--    2. else the parent type's design (same conditions) when it has a layout;
--    3. else 'SALE_INVOICE' (not itself checked for a layout, as on the server).
--  "Has a layout" = a print_template with ptl_purpose_id = the design,
--  ptl_is_active = true, ptl_is_deleted = false, ptl_published_rev_id IS NOT
--  NULL, and ptl_company_id NULL or the bill's company. Also new: the two
--  print_purpose joins now require ppo_is_active = true (the server's joins
--  do; the 20261116100000 text checked ppo_is_deleted only). Nothing else in
--  the grid SQL changes; grid_columns are untouched (the hidden "Print design"
--  column stays as 20261116100000 registered it).
--
--  Guard: the SQL moves only while grid 86 still holds the 20261116100000
--  text (white space folded). Already the new text: nothing to do. Grid 86
--  absent (a fresh database: grids are seeded after migrations, and
--  prisma/seed/Grid_Details.sql carries the new text): skipped with a notice.
--  Any other text (edited locally since): left as is, with a notice. Re-runnable.
--  The grid SQL holds no comment marker. No function, no trigger, no DDL.
-- ═══════════════════════════════════════════════════════════════════════════

DO $mig$
DECLARE
    v_old  text := $old86$SELECT
       b.sb_id,
       b.sb_company_id,
       b.sb_branch_id,
       b.sb_acc_year,
       b.sb_bill_date,
       b.sb_bill_refno,
       vt.vchr_type_short AS sb_vchr_type,
       b.sb_bill_type,
       c.cus_name,
       b.sb_tot_items,
       b.sb_bill_amt,
       b.sb_status,
       b.sb_print_count,
       b.sb_created_by,
       COALESCE(cpp.ppo_code, bpp.ppo_code, 'SALE_INVOICE') AS print_purpose_code
  FROM
	sales.sale_bill b
	INNER JOIN sales.customers c on c.cus_id = b.sb_cust_id
	INNER JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = b.sb_vchr_type_id
	LEFT JOIN accounts.acc_voucher_types bt ON bt.vchr_type_id = vt.vchr_parent_id
	LEFT JOIN public.print_purpose cpp ON cpp.ppo_id = vt.vchr_print_purpose_id AND cpp.ppo_is_deleted = false
	LEFT JOIN public.print_purpose bpp ON bpp.ppo_id = bt.vchr_print_purpose_id AND bpp.ppo_is_deleted = false
 WHERE
 	b.sb_company_id = 'icompany_id'::uuid
  	AND b.sb_branch_id  = 'ibranch_id'::uuid
  	AND b.sb_acc_year   = 'iacc_year'
  	AND (NULLIF('ifrom_date', '') IS NULL OR b.sb_bill_date >= 'ifrom_date'::date)
  	AND (NULLIF('ito_date',   '') IS NULL OR b.sb_bill_date <= 'ito_date'::date)
ORDER BY
	b.sb_bill_date DESC, b.sb_bill_slno DESC$old86$;
    v_new  text := $new86$SELECT
       b.sb_id,
       b.sb_company_id,
       b.sb_branch_id,
       b.sb_acc_year,
       b.sb_bill_date,
       b.sb_bill_refno,
       vt.vchr_type_short AS sb_vchr_type,
       b.sb_bill_type,
       c.cus_name,
       b.sb_tot_items,
       b.sb_bill_amt,
       b.sb_status,
       b.sb_print_count,
       b.sb_created_by,
       CASE
           WHEN EXISTS (SELECT 1 FROM public.print_template x
                         WHERE x.ptl_purpose_id = cpp.ppo_id AND x.ptl_is_active = true AND x.ptl_is_deleted = false
                           AND x.ptl_published_rev_id IS NOT NULL
                           AND (x.ptl_company_id IS NULL OR x.ptl_company_id = b.sb_company_id))
               THEN cpp.ppo_code
           WHEN EXISTS (SELECT 1 FROM public.print_template x
                         WHERE x.ptl_purpose_id = bpp.ppo_id AND x.ptl_is_active = true AND x.ptl_is_deleted = false
                           AND x.ptl_published_rev_id IS NOT NULL
                           AND (x.ptl_company_id IS NULL OR x.ptl_company_id = b.sb_company_id))
               THEN bpp.ppo_code
           ELSE 'SALE_INVOICE'
       END AS print_purpose_code
  FROM
	sales.sale_bill b
	INNER JOIN sales.customers c on c.cus_id = b.sb_cust_id
	INNER JOIN accounts.acc_voucher_types vt ON vt.vchr_type_id = b.sb_vchr_type_id
	LEFT JOIN accounts.acc_voucher_types bt ON bt.vchr_type_id = vt.vchr_parent_id
	LEFT JOIN public.print_purpose cpp ON cpp.ppo_id = vt.vchr_print_purpose_id AND cpp.ppo_is_deleted = false AND cpp.ppo_is_active = true
	LEFT JOIN public.print_purpose bpp ON bpp.ppo_id = bt.vchr_print_purpose_id AND bpp.ppo_is_deleted = false AND bpp.ppo_is_active = true
 WHERE
 	b.sb_company_id = 'icompany_id'::uuid
  	AND b.sb_branch_id  = 'ibranch_id'::uuid
  	AND b.sb_acc_year   = 'iacc_year'
  	AND (NULLIF('ifrom_date', '') IS NULL OR b.sb_bill_date >= 'ifrom_date'::date)
  	AND (NULLIF('ito_date',   '') IS NULL OR b.sb_bill_date <= 'ito_date'::date)
ORDER BY
	b.sb_bill_date DESC, b.sb_bill_slno DESC$new86$;
    v_name text;
    v_cur  text;
BEGIN
    SELECT g.grid_name, g.grid_sql INTO v_name, v_cur
      FROM fixed.grid_details g
     WHERE g.grid_id = 86;

    IF NOT FOUND THEN
        RAISE NOTICE '20261116110000: grid 86 is not here (fresh database: Grid_Details.sql carries the new SQL). Skipped.';
    ELSIF v_name IS DISTINCT FROM 'TXN MAIN LIST - BILLS' THEN
        RAISE NOTICE '20261116110000: grid 86 is "%", not TXN MAIN LIST - BILLS. Left as is.', v_name;
    ELSIF regexp_replace(v_cur, '\s+', ' ', 'g') = regexp_replace(v_new, '\s+', ' ', 'g') THEN
        RAISE NOTICE '20261116110000: grid 86 already has the new SQL. Nothing to do.';
    ELSIF regexp_replace(v_cur, '\s+', ' ', 'g') = regexp_replace(v_old, '\s+', ' ', 'g') THEN
        UPDATE fixed.grid_details
           SET grid_sql         = v_new,
               grid_modified_by = 'system',
               grid_modified_on = now()
         WHERE grid_id = 86;
    ELSE
        RAISE NOTICE '20261116110000: grid 86 SQL is not the 20261116100000 text (edited since?). Left as is; print_purpose_code still ignores layouts there.';
    END IF;
END $mig$;


-- Check after deploy (read-only):
-- SELECT position('ptl_published_rev_id' IN grid_sql) > 0 AS has_layout_rule,
--        grid_modified_on FROM fixed.grid_details WHERE grid_id = 86;
