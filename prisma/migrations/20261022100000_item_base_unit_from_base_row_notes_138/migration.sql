-- Notes 138 A2 — item_master.item_base_unit_id is a copy of the unit on the
-- item's base unit conversion row, and ItemsMasterService now takes it from
-- that row on every save. Until now create and update stored whatever the
-- payload sent, and only the Qt card sent one: 322 items on the dev box
-- carried a NULL header beside a base row (item 001 among them), so every
-- reader that falls back to the header saw no unit. Filled from the base row,
-- once; headers that already agree are left alone.
UPDATE inventory.item_master i
   SET item_base_unit_id = c.iuc_unit_id
  FROM inventory.item_unit_conversion c
 WHERE c.iuc_item_id = i.item_id
   AND c.iuc_is_base_unit = true
   AND c.iuc_is_deleted = false
   AND i.item_base_unit_id IS DISTINCT FROM c.iuc_unit_id;
