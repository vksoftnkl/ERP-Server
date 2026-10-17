-- Enforce: a unit may appear at most once per item in item_unit_conversion.
--
-- NOTE: on any database that has run 20260324131000_add_item_unit_conversion_constraints
-- this index already exists and this migration is a no-op. It is restated here so the
-- constraint is greppable from the current migration tail rather than only from a
-- migration four months back. IF NOT EXISTS keeps it idempotent.
--
-- The index is PARTIAL (WHERE iuc_is_deleted = false) on purpose. Soft-deleted rows are
-- excluded so a unit can be removed from an item and later re-added without colliding
-- with the tombstone. A total unique constraint would block that re-add, which is why
-- this cannot be expressed as @@unique([iucItemId, iucUnitId]) in the Prisma schema.

-- Guard: fail loudly if live duplicates exist rather than letting CREATE INDEX abort
-- with a bare "could not create unique index" and no indication of which item.
DO $$
DECLARE
  dup_count integer;
  dup_sample text;
BEGIN
  SELECT count(*), left(string_agg(format('(item=%s, unit=%s, n=%s)', iuc_item_id, iuc_unit_id, n), ', '), 500)
    INTO dup_count, dup_sample
  FROM (
    SELECT "iuc_item_id", "iuc_unit_id", count(*) AS n
    FROM "inventory"."item_unit_conversion"
    WHERE "iuc_is_deleted" = false
    GROUP BY "iuc_item_id", "iuc_unit_id"
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'item_unit_conversion has % (item, unit) pair(s) duplicated among non-deleted rows; resolve before adding uq_item_unit_conversion. Sample: %',
      dup_count, dup_sample;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_item_unit_conversion"
  ON "inventory"."item_unit_conversion" (
    "iuc_item_id",
    "iuc_unit_id"
  )
  WHERE "iuc_is_deleted" = false;
