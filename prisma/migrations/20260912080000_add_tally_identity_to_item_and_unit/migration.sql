-- ═══════════════════════════════════════════════════════════════════════════
--  Tally identity for the item and unit masters
--
--  acc_ledger_master already carries led_tally_name / guid / master_id /
--  alter_id. A Tally export names stock items and units too, so the same four
--  columns go on those masters. All nullable, no defaults — catalogue-only
--  ALTERs, no rewrite.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE inventory.item_master
    ADD COLUMN IF NOT EXISTS item_tally_name      varchar(200),
    ADD COLUMN IF NOT EXISTS item_tally_guid      varchar(64),
    ADD COLUMN IF NOT EXISTS item_tally_master_id bigint,
    ADD COLUMN IF NOT EXISTS item_tally_alter_id  bigint;

ALTER TABLE inventory.item_unit_master
    ADD COLUMN IF NOT EXISTS unit_tally_name      varchar(100),
    ADD COLUMN IF NOT EXISTS unit_tally_guid      varchar(64),
    ADD COLUMN IF NOT EXISTS unit_tally_master_id bigint,
    ADD COLUMN IF NOT EXISTS unit_tally_alter_id  bigint;

-- A Tally GUID identifies one master in one Tally company. Partial unique, so
-- the many rows that are not yet synced do not collide on NULL.
CREATE UNIQUE INDEX IF NOT EXISTS ux_item_tally_guid
    ON inventory.item_master (item_tally_guid)
    WHERE item_tally_guid IS NOT NULL AND item_is_deleted = false;
CREATE UNIQUE INDEX IF NOT EXISTS ux_unit_tally_guid
    ON inventory.item_unit_master (unit_tally_guid)
    WHERE unit_tally_guid IS NOT NULL AND unit_is_deleted = false;

COMMENT ON COLUMN inventory.item_master.item_tally_name IS
    'STOCKITEMNAME as Tally knows it. Falls back to item_name_en when NULL, but then a rename on either side breaks the export.';
