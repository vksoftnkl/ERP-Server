-- =============================================================================
-- 43_fiscal_year_seed.sql — give every live company its current fiscal year
-- (notes 72 A1, 2026-10-01)
-- =============================================================================
--
-- WHY
--   The accounting-year combo after login (MenuWindow → GET
--   /master-lookups/fiscal-years/by-company/{companyId}) lists fiscal_years
--   rows only. Nothing ever writes that table: /company-masters/create does
--   not seed a row, and there is no route that can add one. A company created
--   from the screen therefore logs in with an EMPTY year combo, AppSession has
--   no accYear, and every document screen is dead for it.
--   On the box today: LEAPSWITCH NETWORKS PRIVATE LIMITED has no row.
--
-- WHAT THIS FILE DOES
--   A one-off BACKFILL. For every live company that has no live fiscal_years
--   row at all, it inserts one row: the current year, OPEN.
--   It is idempotent. A company that already has any live row is never
--   touched, so a re-run inserts nothing.
--
-- WHAT THIS FILE DOES NOT DO (yours, in NestJS)
--   No trigger and no function. 34/37 took the DB logic out, and a seed is a
--   unit of work, so it belongs in the service (the SQL-vs-NestJS rule).
--   The going-forward fix is in CompanyMasterService.createCompany(): inside
--   the SAME $transaction, right after tx.company.create, insert the row with
--   exactly the derivation below. The Qt form already sends the keys it needs:
--   compFinYearFrom / compFinYearTo / compBooksBeginFrom, defaulted to the
--   current 1 Apr – 31 Mar. See "NestJS equivalent" at the bottom.
--
-- DERIVATION (the same in this file and in the service)
--   1. Anchor date = comp_books_begin_from, else comp_fin_year_from, else
--      CURRENT_DATE.
--   2. The year is ALWAYS 1 April – 31 March: the April-start year that
--      contains the anchor. comp_fin_year_from/to are NOT copied as-is. Every
--      fy_year_name / accYear check in the system (ck_caa_fin_year, receipt
--      isValidAccYear, …) assumes 'YYYY-YYYY' with the second year = the
--      first + 1, and the box holds values such as 2026-03-20 .. 2026-03-28
--      that would break it.
--   3. fy_books_begin_date = comp_books_begin_from when it falls inside that
--      year, else the year's begin date (mid-year onboarding is kept;
--      nonsense is not).
--   4. fy_status 'OPEN', fy_is_current TRUE. This is safe against
--      uq_fiscal_years_current, because only companies with NO live row are
--      seeded.
--   5. created_by = comp_created_by when it is a uuid, else the nil uuid,
--      which is NestJS's DEFAULT_ACTOR. created_by is a NOT NULL uuid and
--      'system' is not one.
--   fy_lock_date is left NULL on purpose. comp_books_lock_date is not
--   carried over, because the lock belongs to the year (notes 72 C2), and no
--   company on the box has it set.
--
-- RUN
--   psql -d ERP -f 43_fiscal_year_seed.sql
--   It runs in one transaction. The preview SELECT prints what will be
--   inserted, and the final SELECT prints every company with its year (or
--   NULL), so a missed company shows at a glance.
--   Dry-ran on erp_dry, 2026-10-01: a schema-only clone with two synthetic
--   companies, rolled back.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Preview: what will be inserted
-- ---------------------------------------------------------------------------
WITH todo AS (
    SELECT c.comp_id,
           c.comp_name,
           c.comp_books_begin_from,
           c.comp_created_by,
           COALESCE(c.comp_books_begin_from, c.comp_fin_year_from, CURRENT_DATE) AS anchor
      FROM public.companys c
     WHERE c.comp_is_deleted = false
       AND NOT EXISTS (SELECT 1
                         FROM public.fiscal_years f
                        WHERE f.comp_id = c.comp_id
                          AND f.is_deleted = false)
), yr AS (
    SELECT t.*,
           make_date(CASE WHEN EXTRACT(MONTH FROM t.anchor) >= 4
                          THEN EXTRACT(YEAR FROM t.anchor)::int
                          ELSE EXTRACT(YEAR FROM t.anchor)::int - 1 END, 4, 1) AS begin_date
      FROM todo t
)
SELECT comp_name,
       to_char(begin_date, 'YYYY') || '-' || to_char(begin_date + INTERVAL '1 year', 'YYYY') AS fy_year_name,
       begin_date                                                     AS fy_begin_date,
       (begin_date + INTERVAL '1 year' - INTERVAL '1 day')::date      AS fy_end_date,
       CASE WHEN comp_books_begin_from BETWEEN begin_date
                 AND (begin_date + INTERVAL '1 year' - INTERVAL '1 day')::date
            THEN comp_books_begin_from ELSE begin_date END            AS fy_books_begin_date
  FROM yr
 ORDER BY comp_name;

-- ---------------------------------------------------------------------------
-- 2. Insert: one OPEN, current year per company that has none
-- ---------------------------------------------------------------------------
WITH todo AS (
    SELECT c.comp_id,
           c.comp_books_begin_from,
           c.comp_created_by,
           COALESCE(c.comp_books_begin_from, c.comp_fin_year_from, CURRENT_DATE) AS anchor
      FROM public.companys c
     WHERE c.comp_is_deleted = false
       AND NOT EXISTS (SELECT 1
                         FROM public.fiscal_years f
                        WHERE f.comp_id = c.comp_id
                          AND f.is_deleted = false)
), yr AS (
    SELECT t.*,
           make_date(CASE WHEN EXTRACT(MONTH FROM t.anchor) >= 4
                          THEN EXTRACT(YEAR FROM t.anchor)::int
                          ELSE EXTRACT(YEAR FROM t.anchor)::int - 1 END, 4, 1) AS begin_date
      FROM todo t
)
INSERT INTO public.fiscal_years
       (comp_id, fy_year_name, fy_begin_date, fy_end_date, fy_books_begin_date,
        fy_status, fy_is_current, fy_remarks, created_by)
SELECT y.comp_id,
       to_char(y.begin_date, 'YYYY') || '-' || to_char(y.begin_date + INTERVAL '1 year', 'YYYY'),
       y.begin_date,
       (y.begin_date + INTERVAL '1 year' - INTERVAL '1 day')::date,
       CASE WHEN y.comp_books_begin_from BETWEEN y.begin_date
                 AND (y.begin_date + INTERVAL '1 year' - INTERVAL '1 day')::date
            THEN y.comp_books_begin_from ELSE y.begin_date END,
       'OPEN',
       true,
       'Seeded by 43_fiscal_year_seed.sql',
       CASE WHEN y.comp_created_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN y.comp_created_by::uuid
            ELSE '00000000-0000-0000-0000-000000000000'::uuid END
  FROM yr y;

-- ---------------------------------------------------------------------------
-- 3. Check: every live company and its current year (NULL = still missing)
-- ---------------------------------------------------------------------------
SELECT c.comp_name,
       f.fy_year_name,
       f.fy_status,
       f.fy_books_begin_date
  FROM public.companys c
  LEFT JOIN public.fiscal_years f
         ON f.comp_id = c.comp_id
        AND f.is_deleted = false
        AND f.fy_is_current = true
 WHERE c.comp_is_deleted = false
 ORDER BY c.comp_name;

COMMIT;

-- =============================================================================
-- NestJS equivalent — CompanyMasterService.createCompany(), same $transaction,
-- right after `const created = await tx.company.create({ data });`
-- =============================================================================
--
--   const anchor = created.compBooksBeginFrom ?? created.compFinYearFrom ?? new Date();
--   const y      = anchor.getUTCMonth() >= 3 ? anchor.getUTCFullYear() : anchor.getUTCFullYear() - 1;
--   const begin  = new Date(Date.UTC(y, 3, 1));        // 1 April
--   const end    = new Date(Date.UTC(y + 1, 2, 31));   // 31 March
--   const books  = created.compBooksBeginFrom
--                  && created.compBooksBeginFrom >= begin && created.compBooksBeginFrom <= end
--                  ? created.compBooksBeginFrom : begin;
--   await tx.fiscalYear.create({
--     data: {
--       compId: created.compId,
--       fyYearName: `${y}-${y + 1}`,
--       fyBeginDate: begin,
--       fyEndDate: end,
--       fyBooksBeginDate: books,
--       fyStatus: 'OPEN',
--       fyIsCurrent: true,
--       createdBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
--     },
--   });
--
-- Optionally refuse (400) a compFinYearFrom that is not 1 April, or a
-- compFinYearTo that is not the following 31 March, instead of silently
-- normalising them. The Qt form never sends any other value.
--
-- Not in scope here, and still owed (notes 72 A1): /fiscal-years
-- get|save|close routes for a year screen (next year, lock date, close).
-- =============================================================================
