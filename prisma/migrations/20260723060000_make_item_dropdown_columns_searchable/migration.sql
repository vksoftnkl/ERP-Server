-- The configured "items" dropdown (fixed.dropdown_details id 6, used by every
-- item-picker combobox on the client via GET /dropdown-details/run) has all
-- three of its fixed.dropdown_columns rows seeded with
-- dropdown_columns_filter = false and no dropdown_columns_sql_name.
--
-- ConfiguredGridSqlService.deriveSearchableFieldNames() returns an empty
-- array when no column is filterable, and buildSearchSql() then forces
-- `WHERE 1 = 0` onto the wrapped query for ANY non-empty `search` param --
-- so typing into an item search box always returns zero results, while
-- omitting `search` works fine (matches the reported symptom). Compare
-- against dropdown_id 22 (company), where comp_code/comp_short/comp_name are
-- all filter = true with dropdown_columns_sql_name set to the matching
-- SELECT alias from the dropdown's base SQL -- that's the working pattern
-- this migration replicates for items.
--
-- dropdown_sql for id 6 is:
--   SELECT item_id, item_branch_id, item_code, item_sku, item_name_en,
--          item_name_ta, item_alias FROM inventory.item_master
-- so item_name_en / item_alias are valid SELECT aliases to filter on.
-- "Item id" (the item_id UUID column) is intentionally left
-- non-filterable -- a UUID isn't something a user types to search by.

UPDATE "fixed"."dropdown_columns"
SET "dropdown_columns_filter" = true,
    "dropdown_columns_sql_name" = 'item_name_en'
WHERE "dropdown_columns_id" = '019ebb95-1a0f-7a66-a704-381915eb4972';

UPDATE "fixed"."dropdown_columns"
SET "dropdown_columns_filter" = true,
    "dropdown_columns_sql_name" = 'item_alias'
WHERE "dropdown_columns_id" = '019ebb95-1a0f-7a6b-8974-16c23ef4fe37';
