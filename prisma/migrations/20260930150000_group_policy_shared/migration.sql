-- ═══════════════════════════════════════════════════════════════════════════
--  A group's derived "Tracked as" is SHARED by every company (notes 69).
--  2026-09-30.
--
--  StockTrackPolicyService.syncFromItemGroup filed the GROUP-scope row under
--  the request context's company — the LOGIN token's company, not the one the
--  user works in — so an item of any other company never saw it (VKPOS logs in
--  as CHANDRA SAW MILL; an Acme Foods item in the group resolved N, not BE).
--  item_group_master has no company, so the row is now filed with
--  stp_company_id = NULL (shared), stp_branch_id = NULL.
--
--  Existing derived GROUP rows filed under a company are re-filed the way the
--  service now does it: per group, the earliest moves to the shared slot when
--  that is free, and every other one is retired (inactive AND deleted, as
--  retireDerived writes it) so no stale company row overrides the shared one.
--  Hand-authored GROUP rows (no derived marker) are untouched — a
--  company-specific row authored on purpose still overrides the shared one.
--  Two statements, in this order: ex_stp_overlap allows one active shared row
--  per group, and the second statement only retires what the first left.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. re-file one derived row per group into the free shared slot ────────
UPDATE stock.stock_track_policy p
   SET stp_company_id  = NULL,
       stp_branch_id   = NULL,
       stp_modified_on = now(),
       stp_modified_by = 'MIGRATION'
 WHERE p.stp_id IN (
         SELECT DISTINCT ON (s.stp_group_id) s.stp_id
           FROM stock.stock_track_policy s
          WHERE s.stp_scope = 'GROUP'
            AND s.stp_is_deleted = false
            AND s.stp_company_id IS NOT NULL
            AND (s.stp_remarks = 'Auto-derived from item group master'
                 OR s.stp_remarks LIKE 'Auto-derived from item group master [%')
            AND NOT EXISTS (
                  SELECT 1 FROM stock.stock_track_policy q
                   WHERE q.stp_scope = 'GROUP'
                     AND q.stp_group_id = s.stp_group_id
                     AND q.stp_company_id IS NULL
                     AND q.stp_branch_id IS NULL
                     AND q.stp_is_deleted = false)
          ORDER BY s.stp_group_id, s.stp_created_on, s.stp_id);

-- ── 2. retire every derived GROUP row still filed under a company ─────────
UPDATE stock.stock_track_policy
   SET stp_is_active   = false,
       stp_is_deleted  = true,
       stp_modified_on = now(),
       stp_modified_by = 'MIGRATION'
 WHERE stp_scope = 'GROUP'
   AND stp_is_deleted = false
   AND stp_company_id IS NOT NULL
   AND (stp_remarks = 'Auto-derived from item group master'
        OR stp_remarks LIKE 'Auto-derived from item group master [%');
