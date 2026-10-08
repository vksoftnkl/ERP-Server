-- ═══════════════════════════════════════════════════════════════════════════
--  Item-related masters, notes 70 D2 / D4 / D5 (2026-10-01) — the contract
--  gaps left open on 2026-09-30, decided by the user. The service half is in
--  src/modules/Inventory (see plan/notes-70-item-masters.md).
--
--  D2  item_category_master gets the four defaults its DTO always accepted
--      and the service silently dropped — the React category form sends them
--      on every save. Same names, types and (absent) FKs as the group's
--      itg_tax_claim / itg_default_tax_id / itg_default_hsn / itg_default_uom_id.
--  D3  no DDL: a NEW item takes its group's — else its category's — default
--      tax, HSN and base unit for whichever its payload leaves blank
--      (ItemsMasterService.inheritClassDefaults).
--  D4  brands are a tree: dropdown 18 is the React client's parent-brand
--      picker and the server already applies the tree rules to brands. It
--      gets the optional iexclude_id the other four parent pickers got in D10.
--  D5  sec_sort is a section's position: grid 50 and dropdown 19 order by it,
--      then by name. sec_position is kept equal to it (backfilled here; the
--      service writes both from then on).
--
--  Re-runnable, and like notes 70 every grid / dropdown row is matched on id
--  AND on the table its SQL reads, so a database whose ids mean something
--  else is left alone (the live box is seeded separately from dev).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── D2 — the category's four defaults ──────────────────────────────────────
ALTER TABLE inventory.item_category_master
    ADD COLUMN IF NOT EXISTS category_tax_claim      boolean,
    ADD COLUMN IF NOT EXISTS category_default_tax_id uuid,
    ADD COLUMN IF NOT EXISTS category_default_hsn    varchar(20),
    ADD COLUMN IF NOT EXISTS category_default_uom_id uuid;

-- ── D4 — the parent-brand picker can leave the row being edited out ───────
-- Optional dropdown_param key, inert when absent: an unbound quoted token is
-- the literal 'iexclude_id', which NULLIF turns into NULL, so a caller that
-- sends nothing (the item form's brand picker) sees exactly the rows it
-- always saw.
UPDATE fixed.dropdown_details
   SET dropdown_sql = $sql$SELECT
	b.brand_id,
	b.brand_name,
	b.brand_short
FROM inventory.item_brand_master b
WHERE b.brand_is_active = true AND b.brand_is_deleted = false
	AND b.brand_id NOT IN (
		WITH RECURSIVE sub(id) AS (
			SELECT s.brand_id FROM inventory.item_brand_master s
			 WHERE s.brand_id::text = NULLIF(NULLIF('iexclude_id', ''), 'iexclude' || '_id')
			UNION
			SELECT c.brand_id FROM inventory.item_brand_master c JOIN sub ON c.brand_parent_id = sub.id)
		SELECT id FROM sub)
ORDER BY b.brand_name$sql$
 WHERE dropdown_id = 18
   AND dropdown_sql ILIKE '%inventory.item_brand_master%'
   AND dropdown_sql NOT LIKE '%iexclude_id%';

-- ── D5 — sections are listed in their own order ────────────────────────────
-- A section with no sort value goes last rather than first.
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
ORDER BY sec_sort NULLS LAST, sec_name$sql$
 WHERE grid_id = 50
   AND grid_sql ILIKE '%inventory.item_section_master%'
   AND grid_sql NOT ILIKE '%ORDER BY sec_sort%';

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
ORDER BY s0.sec_sort NULLS LAST, s0.sec_name$sql$
 WHERE dropdown_id = 19
   AND dropdown_sql ILIKE '%inventory.item_section_master%'
   AND dropdown_sql NOT ILIKE '%ORDER BY s0.sec_sort%';

-- One fact, two columns: sec_position follows sec_sort.
UPDATE inventory.item_section_master
   SET sec_position = sec_sort
 WHERE sec_position IS DISTINCT FROM sec_sort;
