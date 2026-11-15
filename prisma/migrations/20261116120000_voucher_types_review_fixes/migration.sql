-- ═══════════════════════════════════════════════════════════════════════════
--  Voucher Types review fixes S2 / S3 / S5 (DB side)  2026-11-15
--  Folder: prisma/migrations/20261116120000_voucher_types_review_fixes/
--  (share copy: Shared/Prathap/accounts/sql/voucher-types-review-fixes-2026-11-15.sql).
--  Review: Shared/Prathap/accounts/voucher-types-review-2026-11-15.md.
--  Plan:   Shared/Prathap/accounts/plan-voucher-types-2026-11-14.md, decisions 56, 62, 63.
--
--  Order: every check first (1, 2), every write after (3, 4). Prisma runs the
--  file in one transaction, so a refusal leaves nothing of it behind.
--
--  1 · S5 guard (decision 63). The allocator shipped with 20261116100000
--      (src/common/Sequence/voucher-sequence.helper.ts) now:
--        (a) honours Method: a MANUAL type refuses every document with
--            SEQUENCE_NUMBER_REQUIRED (no screen sends a typed number); an
--            AUTO_MANUAL type with no typed number draws from the counter,
--            as AUTO does;
--        (b) refuses a new counter of a GST outward type (vchr_gst_side
--            OUTPUT) whose first number is over 16 characters (GST16): the
--            first bill at a new branch, or on 1 April.
--      The deploy stops here, listing the rows, when it finds:
--        (a) a type whose Method is MANUAL. AUTO_MANUAL is allowed and only
--            listed in a NOTICE: 20261116100000 section 0 tells the operator
--            to set it, so refusing it would stop the deploy that migration
--            asked them to prepare (decision 2026-11-15). Not counted: the
--            base rows whose SCREEN builds the number (SCREEN_NUMBERED_CODES in
--            src/modules/settings/voucher-types/voucher-types.rules.ts): they
--            post with presetRefno and never reach the allocator. Opening
--            Stock (1) and Physical Stock (6) DO reach it (refnoVchrTypeId),
--            and 20261116100000 section 4 already moved them MANUAL -> AUTO,
--            so here they are AUTO; one still MANUAL would refuse, and is
--            listed.
--        (b) a GST outward BASE type whose first number, at any active
--            branch of any live company in its current financial year, is
--            over 16 characters. Built as firstVoucherNumber() builds it:
--            prefix and suffix with {FY} (the year as stored), {YY} ('26-27')
--            and {BR} (the branch's Bill Prefix, else its code, upper-cased)
--            filled in and trimmed, around the starting number padded to
--            vchr_no_width. The year comes from fiscal_years (fy_is_current),
--            else the April-March year of today (IST); {FY} and {YY} are the
--            same length every year, so the answer holds for 1 April too.
--            A branch with no code under a {BR} type counts as '' here; the
--            allocator refuses it anyway (BRANCH_CODE_MISSING, 11-04 rule).
--      Why a migration step is enough to stop a deploy before the new
--      allocator runs:
--        - VPS (deploy/deploy.sh, set -euo pipefail): migrate deploy runs
--          after the build and BEFORE pm2 reload; a failed migration ends the
--          script, so the running process keeps the old code. The rebuilt
--          dist/ is the new code, so do not restart pm2 by hand until this
--          migration has applied.
--        - Site exe (deploy/deploy-manager/erp-deploy.sh): the server is
--          stopped and the DB dumped first; a failed migrate deploy restores
--          the dump and the old exe.
--        - Boot-time DB_AUTO_MIGRATE (off in ecosystem.config.js, the VPS
--          runbook and deploy/exe/.env.example) does NOT stop startup when a
--          migration fails unless DB_SEED_FAIL_FAST is on.
--      On the VPS a refusal here leaves 20261116100000 and 20261116110000
--      applied under the old code. HEAD code reads acc_voucher_types through
--      narrow selects and never reads the column 20261116100000 drops, and
--      sb_vchr_type_id defaults to 3, so the old process keeps working.
--      To go on: fix the rows, then
--        npx prisma migrate resolve --rolled-back 20261116120000_voucher_types_review_fixes
--      and deploy again.
--
--  2 · S3 check: audit screen 163 must be free or already "Voucher Types",
--      and no other row may carry that name (the server files audit rows by
--      name, lowest id first; NexERP voucher_types_end_points.h:68 reads 163).
--      Otherwise the deploy stops and names the rows.
--
--  3 · S2 (decision 62), grid 86 "TXN MAIN LIST - BILLS" print_purpose_code:
--      the 20261116110000 "has a layout" CASE becomes the server's usable rule
--      (PRINT_DESIGN_USABLE_RULE in
--      src/modules/settings/print-template-assignment/print-design-usable.sql.ts),
--      word for word: {P} = cpp (the type's own design) / bpp (its base's),
--      {C} = b.sb_company_id. Own design usable -> its code; else the base's
--      usable -> its code; else 'SALE_INVOICE'. Usable = live and active, a
--      published layout, AND the company / every-company PRINT assignment the
--      resolver picks names a live published template. Nothing else in the
--      grid SQL changes; grid_columns are untouched.
--      Guard: the SQL moves only while grid 86 still holds the 20261116110000
--      text (white space folded). Already the new text: nothing to do. Grid 86
--      absent (a fresh database: grids are seeded after migrations, and
--      prisma/seed/Grid_Details.sql carries the new text): skipped. Any other
--      text: left as is, with a notice. The grid SQL holds no comment marker
--      and no ';', and binds the same 5 tokens.
--
--  4 · S3 pin: audit.audit_screen 163 = 'Voucher Types', type master, when
--      163 is free (as Vehicle Master pins 161 / 162 in 20261112120000);
--      already there (dev: made by the first audit write, 2026-11-15 12:09):
--      nothing to do. The server fills screen_audit_sql on the first write.
--      Then the id sequence is kept ahead.
--
--  Re-runnable. No function, no trigger, no DDL.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · S5 guard: Method and the GST 16-character first number ────────────
DO $s5$
DECLARE
    v_modes text;
    v_soft  text;
    v_long  text[];
    v_n     integer;
BEGIN
    SELECT string_agg(format('type %s %s "%s"', t.vchr_type_id, t.vchr_type_code, t.vchr_type_name),
                      '; ' ORDER BY t.vchr_type_id) FILTER (WHERE t.vchr_numbering_mode::text = 'MANUAL'),
           string_agg(format('type %s %s "%s"', t.vchr_type_id, t.vchr_type_code, t.vchr_type_name),
                      '; ' ORDER BY t.vchr_type_id) FILTER (WHERE t.vchr_numbering_mode::text = 'AUTO_MANUAL')
      INTO v_modes, v_soft
      FROM accounts.acc_voucher_types t
     WHERE t.vchr_numbering_mode::text <> 'AUTO'
       AND NOT (t.vchr_parent_id IS NULL
                AND t.vchr_type_code IN ('SRt', 'GRN', 'PUR', 'PRN', 'SHR', 'PO',
                                         'SV-ADJ', 'SV-ISS', 'SV-DMG', 'SV-EXP', 'SV-TRF', 'SV-TRI'));

    WITH br AS (
        SELECT c.comp_name, b.br_name,
               upper(COALESCE(NULLIF(btrim(b.br_bill_prefix), ''), NULLIF(btrim(b.br_code), ''))) AS br_no_code,
               COALESCE(
                   (SELECT btrim(f.fy_year_name)
                      FROM public.fiscal_years f
                     WHERE f.comp_id = c.comp_id AND f.fy_is_current = true AND f.is_deleted = false
                     ORDER BY f.fy_begin_date DESC
                     LIMIT 1),
                   (SELECT format('%s-%s', y.y, y.y + 1)
                      FROM (SELECT CASE WHEN extract(month FROM d.d) >= 4 THEN extract(year FROM d.d)::int
                                        ELSE extract(year FROM d.d)::int - 1 END AS y
                              FROM (SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date AS d) d) y)
               ) AS acc_year
          FROM public.branch_master b
          JOIN public.companys c ON c.comp_id = b.br_comp_id
         WHERE c.comp_is_deleted = false
           AND b.br_is_deleted = false
           AND b.br_is_active = true
    ), fy AS (
        SELECT br.*,
               CASE WHEN br.acc_year ~ '^\d{4}-\d{4}$'
                    THEN substr(br.acc_year, 3, 2) || '-' || substr(br.acc_year, 8, 2)
                    ELSE '{YY}' END AS yy
          FROM br
    ), firsts AS (
        SELECT t.vchr_type_id, t.vchr_type_code, fy.comp_name, fy.br_name, fy.acc_year,
               regexp_replace(replace(replace(replace(COALESCE(t.vchr_no_prefix, ''),
                                                      '{FY}', fy.acc_year), '{YY}', fy.yy),
                                      '{BR}', COALESCE(fy.br_no_code, '')), '^\s+|\s+$', '', 'g')
               || lpad(greatest(t.vchr_start_no, 1)::text,
                       greatest(t.vchr_no_width, 1, length(greatest(t.vchr_start_no, 1)::text)), '0')
               || regexp_replace(replace(replace(replace(COALESCE(t.vchr_no_suffix, ''),
                                                         '{FY}', fy.acc_year), '{YY}', fy.yy),
                                         '{BR}', COALESCE(fy.br_no_code, '')), '^\s+|\s+$', '', 'g')
               AS first_no
          FROM accounts.acc_voucher_types t
         CROSS JOIN fy
         WHERE t.vchr_parent_id IS NULL
           AND t.vchr_gst_side = 'OUTPUT'
    )
    SELECT count(*),
           (array_agg(format('type %s %s at %s / %s (%s): "%s" = %s characters',
                             f.vchr_type_id, f.vchr_type_code, f.comp_name, f.br_name, f.acc_year,
                             f.first_no, length(f.first_no))
                      ORDER BY f.vchr_type_id, f.comp_name, f.br_name))[1:25]
      INTO v_n, v_long
      FROM firsts f
     WHERE length(f.first_no) > 16;

    IF v_soft IS NOT NULL THEN
        RAISE NOTICE '20261116120000 S5: Method AUTO_MANUAL (Automatic, may be typed over), allowed: no screen sends a typed number, so these draw from the counter as AUTO does: %.', v_soft;
    END IF;

    IF v_modes IS NOT NULL OR v_n > 0 THEN
        RAISE EXCEPTION USING
            MESSAGE = format('Voucher Types review S5: deploy stopped before the new number rules run. %s%s',
                CASE WHEN v_modes IS NULL THEN ''
                     ELSE format('(a) Method MANUAL, every document of these types would be refused with SEQUENCE_NUMBER_REQUIRED (no screen sends a typed number): %s. ', v_modes) END,
                CASE WHEN v_n = 0 THEN ''
                     ELSE format('(b) GST outward first number over 16 characters, the next counter would be refused (GST16), %s case(s): %s%s.',
                                 v_n, array_to_string(v_long, '; '),
                                 CASE WHEN v_n > 25 THEN format('; and %s more', v_n - 25) ELSE '' END) END),
            HINT = 'Set those MANUAL types'' vchr_numbering_mode to AUTO, or AUTO_MANUAL (Automatic, may be typed over); shorten the GST type''s prefix, suffix or width, or the branch''s Bill Prefix where it prints {BR}, to 16 characters at most. Then run: npx prisma migrate resolve --rolled-back 20261116120000_voucher_types_review_fixes, and deploy again.';
    END IF;
    RAISE NOTICE '20261116120000 S5: no type is MANUAL (screen-numbered rows aside), and every GST outward base numbers within 16 characters at every active branch.';
END $s5$;


-- ── 2 · S3 check: audit screen 163 free or already Voucher Types ──────────
DO $s3$
DECLARE
    v_clash text;
BEGIN
    SELECT string_agg(format('audit screen %s is "%s"', s.screen_id, s.screen_name), '; ' ORDER BY s.screen_id)
      INTO v_clash
      FROM audit.audit_screen s
     WHERE (s.screen_id = 163 AND s.screen_name IS DISTINCT FROM 'Voucher Types')
        OR (s.screen_id <> 163 AND s.screen_name = 'Voucher Types');
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION USING
            MESSAGE = format('Voucher Types review S3: audit screen 163 must be "Voucher Types" (NexERP voucher_types_end_points.h pins it), but %s.', v_clash),
            HINT = 'Move the other screen to a free id (audit.audit_log follows by ON UPDATE CASCADE; check NexERP does not pin that id too), or rename the stray "Voucher Types" row. Then run: npx prisma migrate resolve --rolled-back 20261116120000_voucher_types_review_fixes, and deploy again.';
    END IF;
END $s3$;


-- ── 3 · S2: grid 86 print_purpose_code = the server's usable rule ─────────
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
           WHEN (cpp.ppo_id IS NOT NULL AND cpp.ppo_is_deleted = false AND cpp.ppo_is_active = true
 AND EXISTS (SELECT 1 FROM public.print_template dl
              WHERE dl.ptl_purpose_id = cpp.ppo_id
                AND dl.ptl_is_active = true AND dl.ptl_is_deleted = false
                AND dl.ptl_published_rev_id IS NOT NULL
                AND (dl.ptl_company_id IS NULL OR dl.ptl_company_id = b.sb_company_id))
 AND EXISTS (SELECT 1
               FROM (SELECT da.pta_template_id
                       FROM public.print_template_assignment da
                      WHERE da.pta_purpose_id = cpp.ppo_id
                        AND da.pta_output_mode = 'PRINT'
                        AND da.pta_is_active = true AND da.pta_is_deleted = false
                        AND (da.pta_company_id IS NULL OR da.pta_company_id = b.sb_company_id)
                        AND da.pta_branch_id IS NULL AND da.pta_device_id IS NULL
                      ORDER BY da.pta_specificity DESC, da.pta_created_on DESC
                      LIMIT 1) dw
               JOIN public.print_template dwt ON dwt.ptl_id = dw.pta_template_id
              WHERE dwt.ptl_is_active = true AND dwt.ptl_is_deleted = false
                AND dwt.ptl_published_rev_id IS NOT NULL
                AND (dwt.ptl_company_id IS NULL OR dwt.ptl_company_id = b.sb_company_id)))
               THEN cpp.ppo_code
           WHEN (bpp.ppo_id IS NOT NULL AND bpp.ppo_is_deleted = false AND bpp.ppo_is_active = true
 AND EXISTS (SELECT 1 FROM public.print_template dl
              WHERE dl.ptl_purpose_id = bpp.ppo_id
                AND dl.ptl_is_active = true AND dl.ptl_is_deleted = false
                AND dl.ptl_published_rev_id IS NOT NULL
                AND (dl.ptl_company_id IS NULL OR dl.ptl_company_id = b.sb_company_id))
 AND EXISTS (SELECT 1
               FROM (SELECT da.pta_template_id
                       FROM public.print_template_assignment da
                      WHERE da.pta_purpose_id = bpp.ppo_id
                        AND da.pta_output_mode = 'PRINT'
                        AND da.pta_is_active = true AND da.pta_is_deleted = false
                        AND (da.pta_company_id IS NULL OR da.pta_company_id = b.sb_company_id)
                        AND da.pta_branch_id IS NULL AND da.pta_device_id IS NULL
                      ORDER BY da.pta_specificity DESC, da.pta_created_on DESC
                      LIMIT 1) dw
               JOIN public.print_template dwt ON dwt.ptl_id = dw.pta_template_id
              WHERE dwt.ptl_is_active = true AND dwt.ptl_is_deleted = false
                AND dwt.ptl_published_rev_id IS NOT NULL
                AND (dwt.ptl_company_id IS NULL OR dwt.ptl_company_id = b.sb_company_id)))
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
        RAISE NOTICE '20261116120000: grid 86 is not here (fresh database: Grid_Details.sql carries the new SQL). Skipped.';
    ELSIF v_name IS DISTINCT FROM 'TXN MAIN LIST - BILLS' THEN
        RAISE NOTICE '20261116120000: grid 86 is "%", not TXN MAIN LIST - BILLS. Left as is.', v_name;
    ELSIF regexp_replace(v_cur, '\s+', ' ', 'g') = regexp_replace(v_new, '\s+', ' ', 'g') THEN
        RAISE NOTICE '20261116120000: grid 86 already has the usable-design rule. Nothing to do.';
    ELSIF regexp_replace(v_cur, '\s+', ' ', 'g') = regexp_replace(v_old, '\s+', ' ', 'g') THEN
        UPDATE fixed.grid_details
           SET grid_sql         = v_new,
               grid_modified_by = 'system',
               grid_modified_on = now()
         WHERE grid_id = 86;
    ELSE
        RAISE NOTICE '20261116120000: grid 86 SQL is not the 20261116110000 text (edited since?). Left as is; print_purpose_code there ignores Print Assignments.';
    END IF;
END $mig$;


-- ── 4 · S3: pin audit screen 163 'Voucher Types' ───────────────────────────
INSERT INTO audit.audit_screen (screen_id, screen_name, screen_type, screen_status)
SELECT 163, 'Voucher Types', 'master'::audit.audit_screen_type, true
 WHERE NOT EXISTS (SELECT 1 FROM audit.audit_screen s WHERE s.screen_id = 163);

SELECT setval('audit.audit_screen_screen_id_seq',
              GREATEST((SELECT COALESCE(max(screen_id), 1) FROM audit.audit_screen),
                       (SELECT last_value FROM audit.audit_screen_screen_id_seq)));


-- Check after deploy (read-only):
-- SELECT position('pta_output_mode' IN grid_sql) > 0 AS has_assignment_rule,
--        grid_modified_on FROM fixed.grid_details WHERE grid_id = 86;
-- SELECT screen_id, screen_name, screen_type FROM audit.audit_screen WHERE screen_id = 163;
