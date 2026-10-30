-- ═══════════════════════════════════════════════════════════════════════════
--  A new company gets its main branch, notes 78 (2026-10-02). The data half;
--  the service half is in src/modules/settings (see plan/notes-78-main-branch.md).
--
--  Every document hangs off a branch: the login token carries branch_id, and
--  godowns, counters, number series and stock balances are all per branch.
--  Since notes 72 A1 a company created from the screen has books but NO
--  branch. The branch service assumes each company has exactly one default
--  branch (clearDefaultBranch, the delete and move guards, restore) and
--  nothing guaranteed it. The service now seeds 'Main Branch' (and its 'Main
--  Godown') on create; this migration repairs what is already there and adds
--  the invariant.
--
--  1  A live company with NO live branch gets one: 'Main Branch', type
--     'HEAD OFFICE', default, active. Its state, GSTIN, PAN, reg type,
--     address and contacts are copied from the company row. br_code stays
--     NULL (it is unique across ALL companies). No godown is seeded here —
--     the create-time godown is the service's; a backfilled branch gets its
--     godown from the Godown screen.
--  2  A live company whose ONLY live branch is not marked default has that
--     branch marked default.
--  3  A live company with SEVERAL live branches and none default is NOT
--     guessed at (none on the box today); the seed file lists it.
--  4  uq_branch_master_default: at most one live default branch per company.
--     clearDefaultBranch() runs before the write in the same transaction on
--     every service path, so the index never trips there.
--
--  Re-runnable: 1 inserts only where no live branch exists, 2 updates only a
--  lone unflagged branch, and the index is IF NOT EXISTS. The same file is
--  prisma/seed/Main_Branch_Seed.sql (the share's 45_main_branch_seed.sql).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 — a branch for every company that has none ───────────────────────────
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

-- ── 2 — a lone branch with no default flag becomes the default ─────────────
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

-- ── 4 — at most one live default branch per company ────────────────────────
-- Partial, so a deleted branch keeps its flag for restore (notes 72 B1) and
-- is not expressible in schema.prisma (see prisma/public/branchMaster.prisma).
CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_master_default
    ON public.branch_master (br_comp_id)
 WHERE br_is_default AND NOT br_is_deleted;
