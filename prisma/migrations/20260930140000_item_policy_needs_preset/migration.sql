-- ═══════════════════════════════════════════════════════════════════════════
--  An item follows its group unless it names its own preset (notes 68).
--  2026-09-30.
--
--  StockTrackPolicyService.syncFromItem now writes an ITEM-scope policy ONLY
--  for an item with item_track_preset_id set; with no preset it retires the
--  derived row the item had. Until today the item's own flags (batch / expiry /
--  MRP / negative stock off) also derived one, and an ITEM row outranks the
--  GROUP row in the resolver, so it hid the group's "Tracked as".
--
--  This retires the derived ITEM rows already there for items with no preset
--  (on 192.168.0.106: one, CHILLI POWDER, signature M). Exactly what
--  retireDerived writes — inactive AND deleted, so the row leaves
--  ex_stp_overlap / ix_stp_resolve — never a DELETE. The service would also
--  append an audit row; a migration cannot, and stp_modified_by says who did it.
--  "Derived" is the service's own test (isDerivedRemark): the bare marker, or
--  the marker followed by " [preset …]". Hand-authored rows are untouched.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE stock.stock_track_policy p
   SET stp_is_active   = false,
       stp_is_deleted  = true,
       stp_modified_on = now(),
       stp_modified_by = 'MIGRATION'
  FROM inventory.item_master i
 WHERE p.stp_scope = 'ITEM'
   AND p.stp_item_id = i.item_id
   AND p.stp_is_deleted = false
   AND i.item_track_preset_id IS NULL
   AND (p.stp_remarks = 'Auto-derived from item master'
        OR p.stp_remarks LIKE 'Auto-derived from item master [%');
