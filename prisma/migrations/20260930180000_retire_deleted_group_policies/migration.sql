-- ═══════════════════════════════════════════════════════════════════════════
--  Notes 71 B3 (2026-09-30). Deleting an item group did not retire its derived
--  GROUP-scope stock track policy: the row stayed live and active under a
--  deleted group. ItemsGroupMasterService now calls retireForGroup on delete
--  (and syncFromItemGroup on restore); this retires the rows left behind
--  before that, exactly as retireDerived writes it — inactive AND deleted, so
--  the row leaves ex_stp_overlap / ix_stp_resolve. Hand-authored GROUP rows (no
--  derived marker) are untouched, as the service leaves them. Re-runnable.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE stock.stock_track_policy p
   SET stp_is_active   = false,
       stp_is_deleted  = true,
       stp_modified_on = now(),
       stp_modified_by = 'MIGRATION'
  FROM inventory.item_group_master g
 WHERE p.stp_scope = 'GROUP'
   AND p.stp_group_id = g.itg_id
   AND g.itg_is_deleted = true
   AND p.stp_is_deleted = false
   AND (p.stp_remarks = 'Auto-derived from item group master'
        OR p.stp_remarks LIKE 'Auto-derived from item group master [%');
