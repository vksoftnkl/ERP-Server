-- Prevent duplicate freight slabs for the same company/branch/km/weight range
-- in sale_freight_charges.
--
-- fr_company_id and fr_branch_id are nullable (a NULL branch/company means
-- the slab applies globally), so NULLS NOT DISTINCT is required -- otherwise
-- Postgres treats every NULL-branch or NULL-company row as non-conflicting
-- and unlimited duplicate slabs could be inserted for the "global" scope.
-- Soft-deleted rows are excluded (WHERE fr_is_deleted = false) so a slab can
-- be deleted and re-created without colliding with its tombstone. That
-- partial predicate is why this is not expressible as @@unique(...) in the
-- Prisma schema.

-- Guard: report offending scopes by name instead of letting CREATE INDEX
-- abort with a bare "could not create unique index".
DO $$
DECLARE
  dup_count integer;
  dup_sample text;
BEGIN
  SELECT count(*), left(string_agg(
           format('(company=%s, branch=%s, from_km=%s, to_km=%s, from_weight=%s, to_weight=%s, n=%s)',
                  coalesce(fr_company_id::text, 'NULL'),
                  coalesce(fr_branch_id::text, 'NULL'),
                  fr_from_km, fr_to_km, fr_from_weight, fr_to_weight, n), ', '), 500)
    INTO dup_count, dup_sample
  FROM (
    SELECT "fr_company_id", "fr_branch_id", "fr_from_km", "fr_to_km", "fr_from_weight", "fr_to_weight", count(*) AS n
    FROM "sales"."sale_freight_charges"
    WHERE "fr_is_deleted" = false
    GROUP BY "fr_company_id", "fr_branch_id", "fr_from_km", "fr_to_km", "fr_from_weight", "fr_to_weight"
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'sale_freight_charges has % (company, branch, from_km, to_km, from_weight, to_weight) slab(s) duplicated among non-deleted rows; resolve before adding uq_fr_slab_scope. Sample: %',
      dup_count, dup_sample;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_fr_slab_scope"
  ON "sales"."sale_freight_charges" (
    "fr_company_id",
    "fr_branch_id",
    "fr_from_km",
    "fr_to_km",
    "fr_from_weight",
    "fr_to_weight"
  )
  NULLS NOT DISTINCT
  WHERE "fr_is_deleted" = false;
