-- Two related changes, both finishing the move to item_unit_conversion as the
-- single owner of per-item unit data.
--
-- (1) Rename the three FK columns that already point at item_unit_conversion
--     (iuc_id) so their names stop implying they hold an item_unit_master
--     unit_id. The retarget itself already happened:
--       - ean_unit_id / ir_unit_id in 20260711141604_retarget_ean_ir_unit_to_iuc
--       - ipm_unit_id  in 20260718055209_changed_the_unit_id_in_price_master_table
--     RENAME COLUMN carries the existing FKs (fk_ean_item_unit, fk_ir_item_unit,
--     fk_ipm_unit) and every index over these columns along with it — including
--     the partial uniques uq_item_price_master_branch and
--     uq_item_price_master_item_unit_global (created by the migration that runs
--     immediately before this one). No index or constraint is recreated, so all
--     names stay as the schema expects.
--
-- (2) Drop the unit-shape columns item_price_master duplicated from
--     item_unit_conversion. A price row now reaches all of these through its
--     ipm_uc_unit_id -> item_unit_conversion join:
--       ipm_base_unit_id    -> iuc_base_unit_id
--       ipm_to_base_factor  -> iuc_to_base_factor
--       ipm_unit_slno       -> iuc_unit_slno
--       ipm_unit_factor     -> iuc_unit_factor
--       ipm_is_default_unit -> iuc_is_default_unit
--       ipm_is_big_unit     -> iuc_is_big_unit
--       ipm_is_base_unit    -> iuc_is_base_unit
--     This is destructive: the dropped values are not copied anywhere, because
--     the conversion row they were duplicated from already holds them.

-- 1) Rename to the uc_ prefix.
ALTER TABLE "inventory"."item_ean_codes"    RENAME COLUMN "ean_unit_id" TO "ean_uc_unit_id";
ALTER TABLE "inventory"."item_reorders"     RENAME COLUMN "ir_unit_id"  TO "ir_uc_unit_id";
ALTER TABLE "inventory"."item_price_master" RENAME COLUMN "ipm_unit_id" TO "ipm_uc_unit_id";

-- 2) Drop the duplicated unit shape from item_price_master.
--    fk_ipm_base_unit is dropped explicitly; chk_ipm_to_base_factor references
--    only ipm_to_base_factor, so Postgres drops it with the column.
ALTER TABLE "inventory"."item_price_master" DROP CONSTRAINT IF EXISTS "fk_ipm_base_unit";

ALTER TABLE "inventory"."item_price_master"
  DROP COLUMN IF EXISTS "ipm_base_unit_id",
  DROP COLUMN IF EXISTS "ipm_to_base_factor",
  DROP COLUMN IF EXISTS "ipm_unit_slno",
  DROP COLUMN IF EXISTS "ipm_unit_factor",
  DROP COLUMN IF EXISTS "ipm_is_default_unit",
  DROP COLUMN IF EXISTS "ipm_is_big_unit",
  DROP COLUMN IF EXISTS "ipm_is_base_unit";
