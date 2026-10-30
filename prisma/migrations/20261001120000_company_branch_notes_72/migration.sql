-- ═══════════════════════════════════════════════════════════════════════════
--  Company + Branch masters, notes 72 (2026-10-01). The data half; the service
--  half is in src/modules/settings (see plan/notes-72-company-branch.md).
--
--  C1  comp_tds_applicable was TEXT, read by nothing and settable by nothing.
--      It becomes a boolean switch like comp_tcs_applicable: NOT NULL DEFAULT
--      false. 't' / 'true' / 'y' / 'yes' / '1' (any case) read as true.
--  C3  comp_gst_reg_type / br_gst_reg_type held free text ('Regular',
--      'REGULAR', 'Unregistered', ''). They become one of REGULAR /
--      COMPOSITION / UNREGISTERED / SEZ (or NULL), normalised here by what the
--      text says and held there by a CHECK. Anything else reads as NULL.
--      vw_gst_credential reads the column as text and is unaffected.
--  A1  Nothing ever wrote fiscal_years, so a company created through the API
--      had no year: no year list at login, no lock date, and every posting
--      guard ran yearless. The service now seeds the year on create; every
--      live company that has none gets the Indian financial year that contains
--      today (1 Apr – 31 Mar, IST), OPEN and current.
--
--  Re-runnable: C1 converts only while the column is still text, the CHECKs
--  are dropped-if-exists and re-added, and A1 inserts only for a company with
--  no live year at all.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── C1 — comp_tds_applicable becomes a boolean ─────────────────────────────
DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'companys'
           AND column_name = 'comp_tds_applicable') = 'text' THEN
        ALTER TABLE public.companys
            ALTER COLUMN comp_tds_applicable TYPE boolean
            USING (lower(btrim(comp_tds_applicable)) IN ('t', 'true', 'y', 'yes', '1'));
    END IF;
END $$;

UPDATE public.companys SET comp_tds_applicable = false WHERE comp_tds_applicable IS NULL;
ALTER TABLE public.companys ALTER COLUMN comp_tds_applicable SET DEFAULT false;
ALTER TABLE public.companys ALTER COLUMN comp_tds_applicable SET NOT NULL;

-- ── C3 — GST registration type is one of four ─────────────────────────────
UPDATE public.companys
   SET comp_gst_reg_type = CASE
         WHEN upper(comp_gst_reg_type) LIKE '%COMPOSITION%' THEN 'COMPOSITION'
         WHEN upper(comp_gst_reg_type) LIKE '%SEZ%'         THEN 'SEZ'
         WHEN upper(comp_gst_reg_type) LIKE '%UNREG%'       THEN 'UNREGISTERED'
         WHEN upper(comp_gst_reg_type) LIKE '%REGULAR%'     THEN 'REGULAR'
       END
 WHERE comp_gst_reg_type IS NOT NULL
   AND comp_gst_reg_type NOT IN ('REGULAR', 'COMPOSITION', 'UNREGISTERED', 'SEZ');

UPDATE public.branch_master
   SET br_gst_reg_type = CASE
         WHEN upper(br_gst_reg_type) LIKE '%COMPOSITION%' THEN 'COMPOSITION'
         WHEN upper(br_gst_reg_type) LIKE '%SEZ%'         THEN 'SEZ'
         WHEN upper(br_gst_reg_type) LIKE '%UNREG%'       THEN 'UNREGISTERED'
         WHEN upper(br_gst_reg_type) LIKE '%REGULAR%'     THEN 'REGULAR'
       END
 WHERE br_gst_reg_type IS NOT NULL
   AND br_gst_reg_type NOT IN ('REGULAR', 'COMPOSITION', 'UNREGISTERED', 'SEZ');

ALTER TABLE public.companys DROP CONSTRAINT IF EXISTS ck_comp_gst_reg_type;
ALTER TABLE public.companys
    ADD CONSTRAINT ck_comp_gst_reg_type
    CHECK (comp_gst_reg_type IS NULL
           OR comp_gst_reg_type IN ('REGULAR', 'COMPOSITION', 'UNREGISTERED', 'SEZ'));

ALTER TABLE public.branch_master DROP CONSTRAINT IF EXISTS ck_br_gst_reg_type;
ALTER TABLE public.branch_master
    ADD CONSTRAINT ck_br_gst_reg_type
    CHECK (br_gst_reg_type IS NULL
           OR br_gst_reg_type IN ('REGULAR', 'COMPOSITION', 'UNREGISTERED', 'SEZ'));

-- ── A1 — every live company has a current year ─────────────────────────────
-- The Indian financial year that contains today: today minus three months
-- lands in the year the FY began (Jan–Mar fall back to the previous April).
INSERT INTO public.fiscal_years
       (comp_id, fy_year_name, fy_begin_date, fy_end_date, fy_books_begin_date,
        fy_status, fy_is_current, created_by, fy_remarks)
SELECT c.comp_id,
       to_char(y.begin_date, 'YYYY') || '-' || to_char(y.begin_date + interval '1 year', 'YYYY'),
       y.begin_date,
       (y.begin_date + interval '1 year' - interval '1 day')::date,
       y.begin_date,
       'OPEN',
       true,
       '00000000-0000-0000-0000-000000000000'::uuid,
       'Seeded by migration (notes 72 A1): the company had no fiscal year'
  FROM public.companys c
 CROSS JOIN LATERAL (
         SELECT make_date(
                  extract(year FROM ((now() AT TIME ZONE 'Asia/Kolkata')::date - interval '3 months'))::int,
                  4, 1) AS begin_date) y
 WHERE c.comp_is_deleted = false
   AND NOT EXISTS (SELECT 1 FROM public.fiscal_years f
                    WHERE f.comp_id = c.comp_id AND f.is_deleted = false);
