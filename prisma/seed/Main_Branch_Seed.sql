-- =============================================================================
-- 45_main_branch_seed.sql — every live company gets exactly one default branch
-- (notes 78, 2026-10-02)
-- =============================================================================
--
-- WHY
--   Every document hangs off a branch: the login token carries branch_id, and
--   godowns, counters, number series and stock balances are all per branch.
--   /company-masters/create seeds the company and its first fiscal year
--   (notes 72 A1) but NO branch, so a company created from the screen is
--   still unusable until somebody opens Branch master and adds one by hand.
--   The branch service already assumes that each company has exactly one
--   default branch (clearDefaultBranch, the delete and move guards, restore),
--   but nothing guarantees it.
--   On the box today:
--     LEAPSWITCH NETWORKS PRIVATE LIMITED   0 live branches
--     HAP Solutions / THE SCM SILK /
--     CHANDRA SAW MILL                      1 live branch, none marked default
--     Acme Foods Pvt Ltd                    3 live branches, 1 default (ok)
--
-- WHAT THIS FILE DOES (one transaction, idempotent)
--   1. A live company with NO live branch gets one: 'Main Branch', type
--      'HEAD OFFICE', default, active. Its state, GSTIN, PAN, reg type,
--      address and contacts are copied from the company row.
--   2. A live company whose ONLY live branch is not marked default has that
--      branch marked default.
--   3. A live company with SEVERAL live branches and none default is NOT
--      guessed at. It is listed in the final SELECT for someone to pick.
--      (None on the box today.)
--   4. Adds uq_branch_master_default: at most one live default branch per
--      company. This is a one-row-set invariant, so it belongs in the DB
--      (the SQL-vs-NestJS rule). The service's clearDefaultBranch() runs
--      before the write in the same transaction, so it never trips this index.
--   A re-run inserts and updates nothing, and the index is created only when
--   pg_indexes does not already list it (see 3 below for why not IF NOT EXISTS).
--
-- WHAT THIS FILE DOES NOT DO (yours, in NestJS; see notes 78)
--   No trigger. The create-time seed is a unit of work and belongs in
--   CompanyMasterService.createCompany(), inside the same $transaction as
--   the fiscal-year seed. See "NestJS equivalent" at the bottom.
--   No godown is seeded here. The existing branches' godowns are their own
--   data. The create-time godown is notes 78 item 2.
--
-- COPY RULES (the same here and in the service)
--   br_name          'Main Branch'
--   br_type          'HEAD OFFICE'   (the value already on the box)
--   br_code          NULL            (br_code is unique across ALL companies)
--   br_gst_reg_type  upper(comp_gst_reg_type) when it is one of
--                    REGULAR/COMPOSITION/UNREGISTERED/SEZ, else NULL
--                    (ck_br_gst_reg_type)
--   br_created_by    comp_created_by, else the nil uuid (DEFAULT_ACTOR)
--   Everything else is copied column for column: addr1-3, city, district,
--   state, state_code, pin, country, region_*, tel, phone, mail, gstin_no,
--   pan_no.
--
-- RUN
--   psql -d ERP -f 45_main_branch_seed.sql
--   The preview SELECT prints what will change. The final SELECT prints every
--   live company with its live-branch count and its default branch, so a
--   company that is still wrong shows at a glance.
--   Dry-ran on erp_dry (schema-only clone + synthetic rows), 2026-10-02,
--   rolled back.
-- =============================================================================

BEGIN;

-- ---- preview ---------------------------------------------------------------
SELECT c.comp_name,
       count(b.br_id)                         AS live_branches,
       count(b.br_id) FILTER (WHERE b.br_is_default) AS defaults,
       CASE
         WHEN count(b.br_id) = 0 THEN 'INSERT Main Branch'
         WHEN count(b.br_id) = 1
          AND count(b.br_id) FILTER (WHERE b.br_is_default) = 0
           THEN 'MARK ' || min(b.br_name) || ' default'
         WHEN count(b.br_id) FILTER (WHERE b.br_is_default) = 0
           THEN 'MANUAL: several branches, none default'
         ELSE 'ok'
       END                                    AS action
  FROM public.companys c
  LEFT JOIN public.branch_master b
         ON b.br_comp_id = c.comp_id
        AND NOT b.br_is_deleted
 WHERE NOT coalesce(c.comp_is_deleted, false)
 GROUP BY c.comp_id, c.comp_name
 ORDER BY c.comp_name;

-- ---- 1. a branch for every company that has none ----------------------------
INSERT INTO public.branch_master (
    br_comp_id, br_name, br_type, br_is_default, br_is_active,
    br_addr1, br_addr2, br_addr3, br_city, br_district,
    br_state, br_state_code, br_pin, br_country,
    br_region_addr1, br_region_addr2, br_region_addr3,
    br_region_city, br_region_district, br_region_state, br_region_country,
    br_tel, br_phone, br_mail,
    br_gstin_no, br_gst_reg_type, br_pan_no,
    br_created_on, br_created_by, br_modified_on, br_modified_by)
SELECT c.comp_id, 'Main Branch', 'HEAD OFFICE', true, true,
       c.comp_addr1, c.comp_addr2, c.comp_addr3, c.comp_city, c.comp_district,
       c.comp_state, c.comp_state_code, c.comp_pin, c.comp_country,
       c.comp_region_addr1, c.comp_region_addr2, c.comp_region_addr3,
       c.comp_region_city, c.comp_region_district, c.comp_region_state,
       c.comp_region_country,
       c.comp_tel, c.comp_phone, c.comp_mail,
       c.comp_gstin_no,
       CASE WHEN upper(c.comp_gst_reg_type)
                 IN ('REGULAR', 'COMPOSITION', 'UNREGISTERED', 'SEZ')
            THEN upper(c.comp_gst_reg_type) END,
       c.comp_pan_no,
       now(), coalesce(c.comp_created_by, '00000000-0000-0000-0000-000000000000'),
       now(), coalesce(c.comp_created_by, '00000000-0000-0000-0000-000000000000')
  FROM public.companys c
 WHERE NOT coalesce(c.comp_is_deleted, false)
   AND NOT EXISTS (SELECT 1
                     FROM public.branch_master b
                    WHERE b.br_comp_id = c.comp_id
                      AND NOT b.br_is_deleted);

-- ---- 2. a lone branch with no default flag becomes the default ---------------
UPDATE public.branch_master b
   SET br_is_default  = true,
       br_modified_on = now(),
       br_modified_by = '00000000-0000-0000-0000-000000000000'
 WHERE NOT b.br_is_deleted
   AND NOT b.br_is_default
   AND (SELECT count(*)
          FROM public.branch_master o
         WHERE o.br_comp_id = b.br_comp_id
           AND NOT o.br_is_deleted) = 1
   AND EXISTS (SELECT 1
                 FROM public.companys c
                WHERE c.comp_id = b.br_comp_id
                  AND NOT coalesce(c.comp_is_deleted, false));

-- ---- 3. at most one live default branch per company -------------------------
-- Migration 20261002100000 creates this index as the table owner. Where the
-- app runs as an unprivileged role (the VPS: tables are owned by postgres, the
-- seed runs as erp_app) a bare CREATE INDEX IF NOT EXISTS still fails with
-- "must be owner of table branch_master" -- the ownership check runs before the
-- IF NOT EXISTS short-circuit -- so look the index up first and create it only
-- when it is genuinely missing.
DO $do$
BEGIN
    IF NOT EXISTS (SELECT 1
                     FROM pg_indexes
                    WHERE schemaname = 'public'
                      AND tablename  = 'branch_master'
                      AND indexname  = 'uq_branch_master_default') THEN
        CREATE UNIQUE INDEX uq_branch_master_default
            ON public.branch_master (br_comp_id)
         WHERE br_is_default AND NOT br_is_deleted;
    END IF;
END
$do$;

-- ---- result ----------------------------------------------------------------
SELECT c.comp_name,
       count(b.br_id)                                         AS live_branches,
       string_agg(b.br_name, ', ') FILTER (WHERE b.br_is_default) AS default_branch
  FROM public.companys c
  LEFT JOIN public.branch_master b
         ON b.br_comp_id = c.comp_id
        AND NOT b.br_is_deleted
 WHERE NOT coalesce(c.comp_is_deleted, false)
 GROUP BY c.comp_id, c.comp_name
 ORDER BY c.comp_name;

COMMIT;

-- =============================================================================
-- NestJS equivalent — CompanyMasterService.createCompany()
-- =============================================================================
-- Inside the SAME $transaction, right after the fiscal-year create:
--
--   const branch = await tx.branchMaster.create({
--     data: {
--       brCompId: created.compId,
--       brName: 'Main Branch',
--       brType: 'HEAD OFFICE',
--       brIsDefault: true,
--       brIsActive: true,
--       brStateCode: created.compStateCode,
--       brState: created.compState,
--       brCountry: created.compCountry,
--       brAddr1: created.compAddr1,  brAddr2: created.compAddr2,
--       brAddr3: created.compAddr3,  brCity: created.compCity,
--       brDistrict: created.compDistrict, brPin: created.compPin,
--       brRegionAddr1: created.compRegionAddr1, /* …region_* likewise… */
--       brTel: created.compTel, brPhone: created.compPhone,
--       brMail: created.compMail,
--       brGstinNo: created.compGstinNo,
--       brGstRegType: created.compGstRegType,   // already normalised upper
--       brPanNo: created.compPanNo,
--       brCreatedOn: now, brCreatedBy: actor,
--     },
--   });
--   // notes 78 item 2 (optional): seed the godown, then point the branch at it
--   const godown = await tx.godownLocation.create({
--     data: { gdlBranchId: branch.brId, gdlName: 'Main Godown',
--             gdlType: 'WAREHOUSE', gdlCreatedBy: actor },
--   });
--   await tx.branchMaster.update({
--     where: { brId: branch.brId },
--     data: { brDefaultGodownId: godown.gdlId },
--   });
--
-- Audit-log the branch (and the godown) with notes 'Seeded on company create',
-- and return brId in the create payload so the client can open it if wanted.
-- =============================================================================
