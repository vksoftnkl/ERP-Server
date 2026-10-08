-- ═══════════════════════════════════════════════════════════════════════════
--  Item-related masters, notes 70 (2026-09-30). The data and config half; the
--  service half is in src/modules/Inventory (see plan/notes-70-item-masters.md).
--
--  Re-runnable: every UPDATE is guarded to the rows it repairs, every index is
--  IF NOT EXISTS, the CHECK is dropped-if-exists and re-added NOT VALID.
--  Grid / dropdown / menu rows are matched on id AND on the table their SQL
--  reads, so a database whose ids mean something else is left alone (the live
--  box is seeded separately from dev).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── A1 / A2 / A3 — the three dead list grids ───────────────────────────────
-- 45 and 50 carried `:unit_is_deleted` / `:sec_is_deleted`, which the grid
-- runner cannot bind (every run 400 "syntax error at or near ':'"). 67 had no
-- WHERE at all, so "Show Only Deleted" was inert and a deleted item stayed in
-- the default list. All three take the bare-token convention grid 55 uses;
-- the client sends iunit_is_deleted / isec_is_deleted / iitem_is_deleted.
UPDATE fixed.grid_details
   SET grid_sql = $sql$SELECT
	unit_id,
	unit_name,
	unit_code,
	unit_decimal_count,
	unit_weight,
	unit_is_active
FROM
	inventory.item_unit_master
WHERE
	unit_is_deleted = iunit_is_deleted
ORDER BY
	unit_name$sql$
 WHERE grid_id = 45
   AND grid_sql ILIKE '%inventory.item_unit_master%'
   AND grid_sql NOT LIKE '%iunit_is_deleted%';

UPDATE fixed.grid_details
   SET grid_sql = $sql$SELECT
	sec_id,
	sec_short,
	sec_name,
	sec_alias,
	sec_description,
	sec_sort,
	sec_is_active
FROM inventory.item_section_master
WHERE sec_is_deleted = isec_is_deleted
ORDER BY sec_name$sql$
 WHERE grid_id = 50
   AND grid_sql ILIKE '%inventory.item_section_master%'
   AND grid_sql NOT LIKE '%isec_is_deleted%';

UPDATE fixed.grid_details
   SET grid_sql = $sql$SELECT
	item_id,
	item_code,
	item_name_en,
	item_name_ta
FROM inventory.item_master
WHERE item_is_deleted = iitem_is_deleted
ORDER BY item_name_en$sql$
 WHERE grid_id = 67
   AND grid_sql ILIKE '%inventory.item_master%'
   AND grid_sql NOT LIKE '%iitem_is_deleted%';

-- ── B1 / B2 — every tree master's level is its depth (a root is 1) ─────────
-- Group / brand / category / godown never computed it (null, 0, 2, 45 ...),
-- section computed it only for the saved row. relevelSubtree keeps it right
-- from here on; this puts every existing row right once. A row sitting in a
-- cycle is unreachable from a root and is left as it is.
WITH RECURSIVE t(id, lvl) AS (
  SELECT itg_id, 1 FROM inventory.item_group_master WHERE itg_parent_id IS NULL
  UNION ALL
  SELECT c.itg_id, t.lvl + 1 FROM inventory.item_group_master c JOIN t ON c.itg_parent_id = t.id
   WHERE t.lvl < 64
)
UPDATE inventory.item_group_master x SET itg_level = t.lvl
  FROM t WHERE x.itg_id = t.id AND x.itg_level IS DISTINCT FROM t.lvl;

WITH RECURSIVE t(id, lvl) AS (
  SELECT brand_id, 1 FROM inventory.item_brand_master WHERE brand_parent_id IS NULL
  UNION ALL
  SELECT c.brand_id, t.lvl + 1 FROM inventory.item_brand_master c JOIN t ON c.brand_parent_id = t.id
   WHERE t.lvl < 64
)
UPDATE inventory.item_brand_master x SET brand_level = t.lvl
  FROM t WHERE x.brand_id = t.id AND x.brand_level IS DISTINCT FROM t.lvl;

WITH RECURSIVE t(id, lvl) AS (
  SELECT sec_id, 1 FROM inventory.item_section_master WHERE sec_parent_id IS NULL
  UNION ALL
  SELECT c.sec_id, t.lvl + 1 FROM inventory.item_section_master c JOIN t ON c.sec_parent_id = t.id
   WHERE t.lvl < 64
)
UPDATE inventory.item_section_master x SET sec_level = t.lvl
  FROM t WHERE x.sec_id = t.id AND x.sec_level IS DISTINCT FROM t.lvl;

WITH RECURSIVE t(id, lvl) AS (
  SELECT category_id, 1 FROM inventory.item_category_master WHERE category_parent_id IS NULL
  UNION ALL
  SELECT c.category_id, t.lvl + 1 FROM inventory.item_category_master c JOIN t ON c.category_parent_id = t.id
   WHERE t.lvl < 64
)
UPDATE inventory.item_category_master x SET category_level = t.lvl
  FROM t WHERE x.category_id = t.id AND x.category_level IS DISTINCT FROM t.lvl;

WITH RECURSIVE t(id, lvl) AS (
  SELECT gdl_id, 1 FROM inventory.godown_locations WHERE gdl_parent_id IS NULL
  UNION ALL
  SELECT c.gdl_id, t.lvl + 1 FROM inventory.godown_locations c JOIN t ON c.gdl_parent_id = t.id
   WHERE t.lvl < 64
)
UPDATE inventory.godown_locations x SET gdl_level = t.lvl
  FROM t WHERE x.gdl_id = t.id AND x.gdl_level IS DISTINCT FROM t.lvl;

-- ── B6 — gdl_type is one of the screen's six kinds ─────────────────────────
-- NOT VALID: enforced for every write from now on, without failing this
-- migration over a legacy value on a database nobody has looked at. The DTO
-- refuses the same list with a 400.
ALTER TABLE inventory.godown_locations DROP CONSTRAINT IF EXISTS ck_gdl_type;
ALTER TABLE inventory.godown_locations
  ADD CONSTRAINT ck_gdl_type
  CHECK (gdl_type IN ('WAREHOUSE', 'ZONE', 'AISLE', 'RACK', 'SHELF', 'BIN')) NOT VALID;

-- ── D6 — a section name is unique among live sections ──────────────────────
-- The other item masters already refuse a duplicate name with 409; sections
-- took it (201). Live duplicates are renamed "<name> (2)", "(3)" ... first —
-- the earliest keeps its name — so the index can be built. Partial on live
-- rows, like item names since notes 67: a deleted name is reusable.
WITH d AS (
  SELECT sec_id,
         row_number() OVER (PARTITION BY sec_name ORDER BY sec_created_on, sec_id) AS rn
    FROM inventory.item_section_master
   WHERE sec_is_deleted = false
)
UPDATE inventory.item_section_master s
   SET sec_name        = left(s.sec_name, 140) || ' (' || d.rn || ')',
       sec_modified_on = now(),
       sec_modified_by = 'MIGRATION'
  FROM d
 WHERE d.sec_id = s.sec_id
   AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sec_name
    ON inventory.item_section_master (sec_name)
 WHERE sec_is_deleted = false;

-- ── D7 — one live qty-price slab per key ───────────────────────────────────
-- (item, unit, company, branch, party, level, from, to) plus the effective-from
-- date, so a future-dated replacement slab can still be scheduled while a
-- re-POST of the same slab is refused (and the service's "Duplicate qty price
-- slab" 409 can finally fire). NULLS NOT DISTINCT: an every-branch slab and
-- another every-branch slab are the same slab. Existing duplicates — re-POST
-- artefacts — are soft-deleted first, the earliest kept.
WITH d AS (
  SELECT iqp_id,
         row_number() OVER (
           PARTITION BY iqp_item_id, iqp_item_unit_id, iqp_company_id, iqp_branch_id, iqp_party_id,
                        iqp_price_level, iqp_from_qty, iqp_to_qty, iqp_effective_from
           ORDER BY iqp_created_on, iqp_id) AS rn
    FROM inventory.item_qty_price
   WHERE iqp_is_deleted = false
)
UPDATE inventory.item_qty_price q
   SET iqp_is_deleted  = true,
       iqp_modified_on = now(),
       iqp_modified_by = 'MIGRATION'
  FROM d
 WHERE d.iqp_id = q.iqp_id
   AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_iqp_slab
    ON inventory.item_qty_price (iqp_item_id, iqp_item_unit_id, iqp_company_id, iqp_branch_id,
                                 iqp_party_id, iqp_price_level, iqp_from_qty, iqp_to_qty,
                                 iqp_effective_from)
       NULLS NOT DISTINCT
 WHERE iqp_is_deleted = false;

-- ── D10 — the parent pickers can leave the row being edited out ────────────
-- OPTIONAL dropdown_param keys, inert when absent: an unbound quoted token is
-- the literal 'iexclude_id' / 'ibranch_id', which NULLIF turns into NULL, so a
-- caller that sends nothing (the item form's own pickers) sees exactly the
-- rows it always saw.
--   iexclude_id  the row being edited — it and its whole subtree drop out, so
--                a self-parent or a loop cannot even be picked (17 19 20 26);
--   ibranch_id   GODOWNS (26) lists that branch's locations only; the server
--                refuses a cross-branch parent anyway.
UPDATE fixed.dropdown_details
   SET dropdown_sql = $sql$SELECT
	g.itg_id,
	g.itg_name,
	g.itg_short
FROM inventory.item_group_master g
WHERE g.itg_is_active = true AND g.itg_is_deleted = false
	AND g.itg_id NOT IN (
		WITH RECURSIVE sub(id) AS (
			SELECT s.itg_id FROM inventory.item_group_master s
			 WHERE s.itg_id::text = NULLIF(NULLIF('iexclude_id', ''), 'iexclude' || '_id')
			UNION
			SELECT c.itg_id FROM inventory.item_group_master c JOIN sub ON c.itg_parent_id = sub.id)
		SELECT id FROM sub)
ORDER BY g.itg_name$sql$
 WHERE dropdown_id = 17
   AND dropdown_sql ILIKE '%inventory.item_group_master%'
   AND dropdown_sql NOT LIKE '%iexclude_id%';

UPDATE fixed.dropdown_details
   SET dropdown_sql = $sql$SELECT
	s0.sec_id,
	s0.sec_short,
	s0.sec_name,
	s0.sec_alias
FROM inventory.item_section_master s0
WHERE s0.sec_is_active = true AND s0.sec_is_deleted = false
	AND s0.sec_id NOT IN (
		WITH RECURSIVE sub(id) AS (
			SELECT s.sec_id FROM inventory.item_section_master s
			 WHERE s.sec_id::text = NULLIF(NULLIF('iexclude_id', ''), 'iexclude' || '_id')
			UNION
			SELECT c.sec_id FROM inventory.item_section_master c JOIN sub ON c.sec_parent_id = sub.id)
		SELECT id FROM sub)
ORDER BY s0.sec_name$sql$
 WHERE dropdown_id = 19
   AND dropdown_sql ILIKE '%inventory.item_section_master%'
   AND dropdown_sql NOT LIKE '%iexclude_id%';

UPDATE fixed.dropdown_details
   SET dropdown_sql = $sql$SELECT
	g.category_id,
	g.category_short,
	g.category_name,
	g.category_alias
FROM inventory.item_category_master g
WHERE g.category_is_active = true AND g.category_is_deleted = false
	AND g.category_id NOT IN (
		WITH RECURSIVE sub(id) AS (
			SELECT s.category_id FROM inventory.item_category_master s
			 WHERE s.category_id::text = NULLIF(NULLIF('iexclude_id', ''), 'iexclude' || '_id')
			UNION
			SELECT c.category_id FROM inventory.item_category_master c JOIN sub ON c.category_parent_id = sub.id)
		SELECT id FROM sub)
ORDER BY g.category_name$sql$
 WHERE dropdown_id = 20
   AND dropdown_sql ILIKE '%inventory.item_category_master%'
   AND dropdown_sql NOT LIKE '%iexclude_id%';

UPDATE fixed.dropdown_details
   SET dropdown_sql = $sql$SELECT
	g.gdl_id,
	g.gdl_name,
	g.gdl_short
FROM inventory.godown_locations g
WHERE g.gdl_is_active = true AND g.gdl_is_deleted = false
	AND (NULLIF(NULLIF('ibranch_id', ''), 'ibranch' || '_id') IS NULL
	     OR g.gdl_branch_id::text = NULLIF(NULLIF('ibranch_id', ''), 'ibranch' || '_id'))
	AND g.gdl_id NOT IN (
		WITH RECURSIVE sub(id) AS (
			SELECT s.gdl_id FROM inventory.godown_locations s
			 WHERE s.gdl_id::text = NULLIF(NULLIF('iexclude_id', ''), 'iexclude' || '_id')
			UNION
			SELECT c.gdl_id FROM inventory.godown_locations c JOIN sub ON c.gdl_parent_id = sub.id)
		SELECT id FROM sub)
ORDER BY g.gdl_name$sql$
 WHERE dropdown_id = 26
   AND dropdown_sql ILIKE '%inventory.godown_locations%'
   AND dropdown_sql NOT LIKE '%iexclude_id%';

-- ── D12 — menu 249 is the tracking-preset list ─────────────────────────────
UPDATE fixed.menu_master
   SET menu_name = 'Tracking Presets'
 WHERE menu_id = 249
   AND menu_name = 'Stock Track Policy';

-- ── D1 — unit_uqc is unit_code's derived copy ──────────────────────────────
-- unit_code is an FK to item_gst_units: it IS the GST Unit Quantity Code. The
-- UnitsMasterService now writes unit_uqc from it on every save; this fills the
-- rows saved before, so the e-invoice / GSTR-1 readers that name unit_uqc see
-- the same fact instead of NULL.
UPDATE inventory.item_unit_master
   SET unit_uqc = upper(btrim(unit_code))
 WHERE unit_code ~ '^\s*[A-Za-z]{3}\s*$'
   AND unit_uqc IS DISTINCT FROM upper(btrim(unit_code));
