-- ═══════════════════════════════════════════════════════════════════════════
--  WhatsApp review S7: "WhatsApp on Post" becomes a PER-COMPANY setting
--                                                                 2026-11-18
--  Folder: prisma/migrations/20261119190000_whatsapp_on_post_company/ (share
--  copy: Shared/Prathap/whatsapp/sql/whatsapp-s7-migration.sql).
--
--  Review Shared/Prathap/whatsapp/review-2026-11-17.md item S7: P1
--  (20261119100000_whatsapp) put the tick on the voucher type,
--  accounts.acc_voucher_types.vchr_whatsapp_after_post. Sales Order (4) is a
--  shared base type (vchr_company_id NULL), so one company's admin on menu 307
--  switched WhatsApp on Post for every company on the server. User decision
--  (2026-11-18): PER COMPANY. Sorts after 20261119180000_app_theme_template_v66.
--
--   0 · guard: whatsapp.on_post_types is free, or already ours (JSON, COMPANY).
--   1 · setting def whatsapp.on_post_types (module WHATSAPP, group Messages,
--       JSON, default [], max scope COMPANY, sort 55): a JSON array of the
--       voucher type ids (ints) that send on post, e.g. [4].
--   2 · carry-over: every type ticked today becomes a COMPANY-scope
--       app_setting_value row: a shared type (vchr_company_id NULL) for every
--       active company (comp_is_active, not comp_is_deleted), a company's own
--       (child) type for that company only. A live row already there is merged
--       (union, sorted). Then every (company, type) pair is proved present
--       before the column goes; a gap aborts the migration.
--   3 · ALTER TABLE accounts.acc_voucher_types DROP COLUMN
--       vchr_whatsapp_after_post. Only its default and its NOT NULL constraint
--       depend on it (pg_depend, 2026-11-18): no view, function, trigger, index,
--       CHECK, grid / dropdown SQL or seed names it, and v_sync_tables carries
--       the table, its sync column and key only (no column list).
--
--  The server reads and writes the new key (nestjs-backend, same change); the
--  column's Prisma field is removed from prisma/accounts/AccountVoucherType.prisma.
--  No business-logic function or trigger. Re-runnable: the def is ON CONFLICT
--  DO NOTHING, the carry-over runs only while the column still exists, the
--  drop is IF EXISTS. On dev, 0 of 69 types were ticked when this was written.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0 · the key is free, or already ours ──────────────────────────────────
DO $$
DECLARE
    v_clash text;
BEGIN
    SELECT format('setting %s is %s / %s', s.asd_key, s.asd_data_type, s.asd_max_scope)
      INTO v_clash
      FROM public.app_setting_def s
     WHERE s.asd_key = 'whatsapp.on_post_types'
       AND (s.asd_data_type::text, s.asd_max_scope::text) IS DISTINCT FROM ('JSON'::text, 'COMPANY'::text);
    IF v_clash IS NOT NULL THEN
        RAISE EXCEPTION 'WhatsApp S7: % (expected JSON / COMPANY). Pick another key here and in the server code.', v_clash;
    END IF;
END $$;


-- ── 1 · setting def whatsapp.on_post_types ────────────────────────────────
-- Same columns as P1's whatsapp.* defs. Sort 55: between Message language
-- for new parties (50) and the click-to-chat fallback (60), group Messages.
INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values,
     asd_min_value, asd_max_value, asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
VALUES
    ('whatsapp.on_post_types', 'WHATSAPP', 'Messages', 'JSON', '[]', NULL,
     NULL, NULL, 'COMPANY', 'Send WhatsApp on Post for these voucher types',
     'A list of voucher type ids, e.g. [4]. After a post of one of these types commits, the server sends the document on WhatsApp unless the post said not to (waOnPost = false). Set on WhatsApp (menu 307). Per company: it replaced the voucher type''s own tick (review S7), which one company switched for all.',
     55, 'system')
ON CONFLICT (asd_key) DO NOTHING;


-- ── 2 · carry the ticks over, prove them, then 3 · drop the column ─────────
DO $$
DECLARE
    v_ticked  integer;
    v_pairs   integer;
    v_written integer;
    v_missing text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_attribute a
                    WHERE a.attrelid = 'accounts.acc_voucher_types'::regclass
                      AND a.attname = 'vchr_whatsapp_after_post' AND NOT a.attisdropped) THEN
        RAISE NOTICE 'WhatsApp S7: vchr_whatsapp_after_post is already gone, nothing to carry over.';
        RETURN;
    END IF;

    SELECT count(*) INTO v_ticked
      FROM accounts.acc_voucher_types t
     WHERE t.vchr_whatsapp_after_post;

    -- Every (company, type) pair the old tick meant.
    CREATE TEMP TABLE s7_on_post_pair ON COMMIT DROP AS
    SELECT c.comp_id AS company_id, t.vchr_type_id AS type_id
      FROM accounts.acc_voucher_types t
      JOIN public.companys c
        ON (t.vchr_company_id IS NULL AND c.comp_is_active AND NOT c.comp_is_deleted)
        OR c.comp_id = t.vchr_company_id
     WHERE t.vchr_whatsapp_after_post;

    SELECT count(*) INTO v_pairs FROM s7_on_post_pair;

    -- A live COMPANY row already there: merge (union of both lists, sorted).
    -- A stored value that is not a JSON array counts as [].
    UPDATE public.app_setting_value v
       SET asv_value = (SELECT jsonb_agg(DISTINCT u.x ORDER BY u.x)::text
                          FROM (SELECT to_jsonb(p.type_id) AS x
                                  FROM s7_on_post_pair p
                                 WHERE p.company_id = v.asv_company_id
                                UNION
                                SELECT e.x
                                  FROM jsonb_array_elements(
                                         CASE WHEN jsonb_typeof(v.asv_value::jsonb) = 'array'
                                              THEN v.asv_value::jsonb ELSE '[]'::jsonb END) AS e(x)) u),
           asv_modified_on = now(),
           asv_modified_by = 'system'
     WHERE v.asv_setting_key = 'whatsapp.on_post_types'
       AND v.asv_scope = 'COMPANY'
       AND v.asv_branch_id IS NULL AND v.asv_device_id IS NULL AND v.asv_user_id IS NULL
       AND v.asv_is_deleted = false
       AND v.asv_company_id IN (SELECT p.company_id FROM s7_on_post_pair p);
    GET DIAGNOSTICS v_written = ROW_COUNT;

    -- No live row: a new one (sync date NULL, so it is pending a push).
    INSERT INTO public.app_setting_value
           (asv_setting_key, asv_scope, asv_company_id, asv_value, asv_remarks, asv_created_by)
    SELECT 'whatsapp.on_post_types', 'COMPANY', p.company_id,
           jsonb_agg(DISTINCT p.type_id ORDER BY p.type_id)::text,
           'WhatsApp on Post, moved from the voucher type tick (S7, 20261119190000)', 'system'
      FROM s7_on_post_pair p
     WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_value v
                        WHERE v.asv_setting_key = 'whatsapp.on_post_types'
                          AND v.asv_scope = 'COMPANY'
                          AND v.asv_company_id = p.company_id
                          AND v.asv_branch_id IS NULL AND v.asv_device_id IS NULL AND v.asv_user_id IS NULL
                          AND v.asv_is_deleted = false)
     GROUP BY p.company_id;

    -- Proof before the drop: every pair is in its company's live list.
    SELECT string_agg(format('type %s for company %s', p.type_id, p.company_id), '; ')
      INTO v_missing
      FROM s7_on_post_pair p
     WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_value v
                        WHERE v.asv_setting_key = 'whatsapp.on_post_types'
                          AND v.asv_scope = 'COMPANY'
                          AND v.asv_company_id = p.company_id
                          AND v.asv_branch_id IS NULL AND v.asv_device_id IS NULL AND v.asv_user_id IS NULL
                          AND v.asv_is_deleted = false
                          AND CASE WHEN v.asv_setting_key = 'whatsapp.on_post_types'
                                   THEN v.asv_value::jsonb @> to_jsonb(p.type_id) END);
    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION 'WhatsApp S7: the on-post ticks did not all carry over (%); the column is kept.', v_missing;
    END IF;

    RAISE NOTICE 'WhatsApp S7: % ticked type(s) = % (company, type) pair(s); % existing row(s) merged; all carried over.',
                 v_ticked, v_pairs, v_written;

    DROP TABLE s7_on_post_pair;
END $$;

ALTER TABLE accounts.acc_voucher_types
    DROP COLUMN IF EXISTS vchr_whatsapp_after_post;
