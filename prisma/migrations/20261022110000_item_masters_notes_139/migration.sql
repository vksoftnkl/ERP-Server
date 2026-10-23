-- Notes 139 (2026-10-22) — item masters, findings of the full live test.
--
-- A2 / B6: a master's name is unique among its LIVE rows, ignoring case — the
-- rule notes 137 set for item names. The old indexes counted deleted rows, so a
-- deleted "X" kept "X" taken for ever behind a 409 the user could not explain,
-- and they compared case-sensitively ("ZT-…" beside "zt-…"). Section's
-- uq_sec_name was already partial; it now ignores case as well. Names are
-- trimmed before they are stored (A1), so lower(name) is the whole comparison.
--
-- B2: the godown index compares a NULL parent as one value (NULLS NOT DISTINCT),
-- so two top-level godowns of one branch can no longer share a name.
--
-- Units: item_unit_master_unit_name_key counted deleted rows too, so the unit
-- name becomes partial here. It stays case-SENSITIVE because the box holds two
-- live, used units "Box" and "BOX"; UnitsMasterService refuses a new or renamed
-- unit whose name clashes ignoring case. Swap the index to lower(unit_name) once
-- that pair is merged.
--
-- None of these is declared in the Prisma fragments: Prisma cannot express a
-- partial or expression index, and declaring one reads as drift.

DROP INDEX IF EXISTS inventory.item_brand_master_brand_name_key;
CREATE UNIQUE INDEX uq_brand_name
    ON inventory.item_brand_master (lower(brand_name))
 WHERE brand_is_deleted = false;

DROP INDEX IF EXISTS inventory.uq_itg_name;
CREATE UNIQUE INDEX uq_itg_name
    ON inventory.item_group_master (lower(itg_name))
 WHERE itg_is_deleted = false;

DROP INDEX IF EXISTS inventory.uq_sec_name;
CREATE UNIQUE INDEX uq_sec_name
    ON inventory.item_section_master (lower(sec_name))
 WHERE sec_is_deleted = false;

DROP INDEX IF EXISTS inventory.uq_category_name;
CREATE UNIQUE INDEX uq_category_name
    ON inventory.item_category_master (lower(category_name))
 WHERE category_is_deleted = false;

DROP INDEX IF EXISTS inventory.uq_gdl_unique_name_per_parent;
CREATE UNIQUE INDEX uq_gdl_unique_name_per_parent
    ON inventory.godown_locations (gdl_branch_id, gdl_parent_id, lower(gdl_name))
       NULLS NOT DISTINCT
 WHERE gdl_is_deleted = false;

DROP INDEX IF EXISTS inventory.item_unit_master_unit_name_key;
CREATE UNIQUE INDEX uq_unit_name
    ON inventory.item_unit_master (unit_name)
 WHERE unit_is_deleted = false;

-- B4: a godown's level is its depth, root = 1. The company-create seed wrote its
-- Main Godown at the column default 0 while every other create re-levels to 1;
-- re-level every row once from the roots down.
WITH RECURSIVE tree (id, lvl) AS (
    SELECT gdl_id, 1
      FROM inventory.godown_locations
     WHERE gdl_parent_id IS NULL
    UNION ALL
    SELECT c.gdl_id, tree.lvl + 1
      FROM inventory.godown_locations c
      JOIN tree ON c.gdl_parent_id = tree.id
     WHERE tree.lvl < 64
)
UPDATE inventory.godown_locations g
   SET gdl_level = tree.lvl
  FROM tree
 WHERE g.gdl_id = tree.id
   AND g.gdl_level IS DISTINCT FROM tree.lvl;

-- B7: a cleared alias / short name / description is NULL, not ''. The DTOs now
-- store a blank as NULL; this clears what earlier saves left behind.
UPDATE inventory.item_brand_master
   SET brand_alias       = CASE WHEN btrim(brand_alias) = '' THEN NULL ELSE brand_alias END,
       brand_short       = CASE WHEN btrim(brand_short) = '' THEN NULL ELSE brand_short END,
       brand_description = CASE WHEN btrim(brand_description) = '' THEN NULL ELSE brand_description END
 WHERE btrim(brand_alias) = '' OR btrim(brand_short) = '' OR btrim(brand_description) = '';

UPDATE inventory.item_group_master
   SET itg_alias       = CASE WHEN btrim(itg_alias) = '' THEN NULL ELSE itg_alias END,
       itg_short       = CASE WHEN btrim(itg_short) = '' THEN NULL ELSE itg_short END,
       itg_description = CASE WHEN btrim(itg_description) = '' THEN NULL ELSE itg_description END
 WHERE btrim(itg_alias) = '' OR btrim(itg_short) = '' OR btrim(itg_description) = '';

UPDATE inventory.item_section_master
   SET sec_alias       = CASE WHEN btrim(sec_alias) = '' THEN NULL ELSE sec_alias END,
       sec_short       = CASE WHEN btrim(sec_short) = '' THEN NULL ELSE sec_short END,
       sec_description = CASE WHEN btrim(sec_description) = '' THEN NULL ELSE sec_description END
 WHERE btrim(sec_alias) = '' OR btrim(sec_short) = '' OR btrim(sec_description) = '';

UPDATE inventory.item_category_master
   SET category_alias       = CASE WHEN btrim(category_alias) = '' THEN NULL ELSE category_alias END,
       category_short       = CASE WHEN btrim(category_short) = '' THEN NULL ELSE category_short END,
       category_description = CASE WHEN btrim(category_description) = '' THEN NULL ELSE category_description END
 WHERE btrim(category_alias) = '' OR btrim(category_short) = '' OR btrim(category_description) = '';
