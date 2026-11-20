-- ═══════════════════════════════════════════════════════════════════════════
--  Users & Rights (menu 58), review list 11-19 build step 6 — the DATABASE half.
--  Analysis: Shared/Prathap/admin/review-users-rights-2026-11-19.md (F4, F6, F15;
--  points 3, 6, 10, 15). Answers: review-answers-needed-2026-11-19.md (U6, U8, U10, U11)
--  and the user's answers on the step-6 dry run (11-20): NO automatic lockout for wrong
--  passwords (an account already locked stays refused, Unlock stays), NO rights presets,
--  D1 / D4 / D5-D12 as recommended.
--  Dry run: Shared/Prathap/admin/users-step6-migration-dryrun-2026-11-20.md.
--
--  1 · public.user_master.usr_max_disc_perc numeric(5,2) + ck_usr_max_disc_perc (NULL or
--      0 … 100). The user's highest discount %, for each line AND for the bill-level
--      discount, on the Sale Bill. NULL = no limit (every user after the apply, D6).
--      Only discounts the user types count (D7); % of the value before the discount (D8);
--      over the limit = refused (D9). "Allow rate / discount change" = the EXISTING
--      usr_edit_rate (screen label only; no data change, D5), documented by a column
--      comment.
--
--  2 · ONE-OFF, only in the run that adds usr_max_disc_perc (so a re-run never undoes a
--      flag the new reset flow sets): usr_must_change_password back to false (D1).
--      Nothing ever set or enforced it on purpose (F4; the Qt app never sends it), yet 10
--      live users carry true, VKPOS (every test's login) among them; once the server
--      enforces U8 each would be forced to a new password at the next login.
--      All DDL comes BEFORE this UPDATE: user_master's zz_sync_mark_dirty trigger rebuilds
--      NEW with jsonb_populate_record, which keeps the row shape it first saw for the rest
--      of the transaction, so an UPDATE before an ADD COLUMN would make later UPDATEs in
--      the same transaction drop the new column's value.
--
--  3 · Grid 62 MAIN LIST - COMPUTER USERS, "Show deleted" (point 15, U10). Same idea as
--      Units (grid 45, iunit_is_deleted) with one difference: the token iusr_is_deleted is
--      read as TEXT and an unsent or odd value means "live users", so the list keeps
--      working for a client that does not send it yet (today's Qt list):
--        usr_is_deleted = COALESCE(substring(lower('iusr_is_deleted'::text)
--                                  FROM '^(true|false)$')::boolean, false)
--      Last Login is emitted as IST 12-hour text (D4: it left as a UTC instant and the Qt
--      grid showed the UTC clock face); its grid_columns row becomes Text. No comment of
--      any kind inside the grid SQL (the runner refuses one). prisma/seed/Grid_Details.sql
--      and Grid_Columns.sql carry the same values.
--
--  4 · Point 6 (iii): um_can_retender = true on the till menus 271-287 means nothing
--      (only the Sales Bill, menu 12, has the RETENDER verb and is checked by the server);
--      leftovers of the old "All" button. Cleared only where the menu's verbs lack
--      RETENDER, so menu 12 is never touched.
--
--  Not here: automatic lockout (dropped by the user 11-20: no window column, no lockout
--  settings, usr_failed_login_count left as it is), rights presets (dropped), back-date
--  days, company / branch lock (step 7), email, valid from / to.
--  No function, no trigger. Re-runnable: every block is guarded.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · pre-check: the columns this step relies on ──
DO $$
DECLARE
    v_missing text;
BEGIN
    SELECT string_agg(c.col, ', ' ORDER BY c.col)
      INTO v_missing
      FROM (VALUES ('usr_must_change_password'), ('usr_edit_rate'),
                   ('usr_is_deleted'), ('usr_last_login_on')) AS c(col)
     WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a
                        WHERE a.attrelid = 'public.user_master'::regclass
                          AND a.attname = c.col AND NOT a.attisdropped);
    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'Users step 6: public.user_master lacks %', v_missing;
    END IF;
END $$;


-- ── 1 + 2 · the discount-limit column (DDL first), then the one-off must-change reset ──
DO $$
DECLARE
    v_new   boolean;
    v_flags integer;
BEGIN
    v_new := NOT EXISTS (SELECT 1 FROM pg_attribute a
                          WHERE a.attrelid = 'public.user_master'::regclass
                            AND a.attname = 'usr_max_disc_perc' AND NOT a.attisdropped);

    IF v_new THEN
        ALTER TABLE public.user_master ADD COLUMN usr_max_disc_perc numeric(5,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'public.user_master'::regclass AND conname = 'ck_usr_max_disc_perc') THEN
        ALTER TABLE public.user_master
            ADD CONSTRAINT ck_usr_max_disc_perc
            CHECK (usr_max_disc_perc IS NULL OR (usr_max_disc_perc >= 0 AND usr_max_disc_perc <= 100));
    END IF;

    IF NOT v_new THEN
        RAISE NOTICE 'Users step 6: usr_max_disc_perc was already there; the one-off must-change reset is skipped.';
        RETURN;
    END IF;

    UPDATE public.user_master
       SET usr_must_change_password = false
     WHERE usr_must_change_password;
    GET DIAGNOSTICS v_flags = ROW_COUNT;

    RAISE NOTICE 'Users step 6: usr_max_disc_perc added; % stale must-change flag(s) cleared.', v_flags;
END $$;

COMMENT ON COLUMN public.user_master.usr_max_disc_perc IS
    'Highest discount % this user may give (review step 6, U6): each line''s typed discount and the '
    'typed bill-level discount, as a % of the value before that discount, on the Sale Bill. '
    'NULL = no limit; 0 = no discount at all. Over it the server refuses the save / post.';

COMMENT ON COLUMN public.user_master.usr_edit_rate IS
    'Allow rate / discount change (review step 6, U6; the screen label since 2026-11-20): without it '
    'the user may not type a rate other than the one the server works out (price master / qty slab / '
    'customer rate), nor type a discount. Checked by the server on the Sale Bill.';


-- ── 3 · grid 62: Show deleted + Last Login in IST ──
UPDATE fixed.grid_details
   SET grid_sql = $sql$SELECT
    usr_id,
    usr_login_name,
    usr_full_name,
    usr_mobile_no,
    usr_type,
    usr_is_active,
    usr_is_locked,
    to_char(usr_last_login_on AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') AS usr_last_login_on
FROM public.user_master
WHERE usr_is_deleted = COALESCE(substring(lower('iusr_is_deleted'::text) FROM '^(true|false)$')::boolean, false)
ORDER BY usr_display_name$sql$,
       grid_modified_by = 'system',
       grid_modified_on = now()
 WHERE grid_id = 62
   AND grid_sql ILIKE '%public.user_master%'
   AND grid_sql NOT LIKE '%iusr_is_deleted%';

UPDATE fixed.grid_columns
   SET grid_column_data_type   = 'Text',
       grid_column_modified_by = 'system',
       grid_column_modified_on = now()
 WHERE grid_id = 62
   AND grid_column_sql_field_name = 'usr_last_login_on'
   AND grid_column_data_type = 'DateTime'
   AND EXISTS (SELECT 1 FROM fixed.grid_details d
                WHERE d.grid_id = 62 AND d.grid_sql LIKE '%iusr_is_deleted%');


-- ── 4 · point 6 (iii): Re-tender ticks on the till menus ──
DO $$
DECLARE
    v_before integer;
    v_done   integer;
BEGIN
    SELECT count(*) INTO v_before
      FROM public.user_menus um
      JOIN fixed.menu_master m ON m.menu_id = um.um_menu_id
     WHERE um.um_can_retender
       AND um.um_menu_id BETWEEN 271 AND 287
       AND NOT ('RETENDER' = ANY (m.menu_verbs));

    UPDATE public.user_menus um
       SET um_can_retender = false,
           um_modified_on  = now()
      FROM fixed.menu_master m
     WHERE m.menu_id = um.um_menu_id
       AND um.um_can_retender
       AND um.um_menu_id BETWEEN 271 AND 287
       AND NOT ('RETENDER' = ANY (m.menu_verbs));
    GET DIAGNOSTICS v_done = ROW_COUNT;

    IF v_done <> v_before THEN
        RAISE EXCEPTION 'Users step 6: expected % Re-tender row(s) on the till menus, cleared %', v_before, v_done;
    END IF;
    RAISE NOTICE 'Users step 6: Re-tender cleared on % till-menu right row(s).', v_done;
END $$;
