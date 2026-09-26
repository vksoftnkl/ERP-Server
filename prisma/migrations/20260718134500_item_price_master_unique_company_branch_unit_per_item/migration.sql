-- Make (company, branch, unit) unique per item in item_price_master.
--
-- Replaces two overlapping partial uniques with one index that is the single
-- authority on price-row identity:
--
--   uq_item_price_master_branch
--     (ipm_company_id, ipm_branch_id, ipm_item_id, ipm_uc_unit_id)
--     WHERE ipm_branch_id IS NOT NULL AND ipm_is_deleted = false
--   -> Already the requested key, but its "branch IS NOT NULL" predicate let
--      every NULL-branch row escape enforcement entirely. One such row exists
--      (ipm_id 019da0a8-8f04-7304-94ba-5492fa9512fb). Superseded below.
--
--   uq_item_price_master_item_unit_global
--     (ipm_item_id, ipm_uc_unit_id) WHERE ipm_godown_id IS NULL AND ipm_is_deleted = false
--   -> Scoped by godown while ignoring company and branch, so it would forbid
--      two DIFFERENT branches from each holding a godown-NULL price for the same
--      item+unit. That contradicts the branch-scoped key this migration
--      establishes. It currently matches zero live rows (no row has a NULL
--      godown), so dropping it removes no active enforcement -- but left in
--      place it would start rejecting legitimate per-branch prices as soon as
--      any godown-NULL row was written. Dropped deliberately.
--
-- NULLS NOT DISTINCT (Postgres 15+; this cluster runs 18.1) is what closes the
-- NULL-branch gap. Under default NULLS DISTINCT semantics a NULL company or
-- branch makes the whole tuple non-conflicting, so unlimited duplicate rows
-- could be inserted with branch NULL -- exactly the hole the old predicate was
-- papering over. With NULLS NOT DISTINCT, NULL compares equal to NULL and those
-- rows are constrained like any other.
--
-- Soft-deleted rows stay excluded (WHERE ipm_is_deleted = false) so a price can
-- be deleted and re-created for the same scope without colliding with its
-- tombstone. That partial predicate is why this is not expressible as
-- @@unique(...) in the Prisma schema.
--
-- NOTE: godown is intentionally NOT part of the key. Two godowns cannot hold
-- different prices for the same item+unit+branch; ipm_godown_id no longer
-- participates in row identity.

-- Guard: report offending scopes by name instead of letting CREATE INDEX abort
-- with a bare "could not create unique index". Mirrors NULLS NOT DISTINCT by
-- grouping on the raw columns (GROUP BY already treats NULLs as equal).
DO $$
DECLARE
  dup_count integer;
  dup_sample text;
BEGIN
  SELECT count(*), left(string_agg(
           format('(company=%s, branch=%s, item=%s, unit=%s, n=%s)',
                  coalesce(ipm_company_id::text, 'NULL'),
                  coalesce(ipm_branch_id::text, 'NULL'),
                  ipm_item_id, ipm_uc_unit_id, n), ', '), 500)
    INTO dup_count, dup_sample
  FROM (
    SELECT "ipm_company_id", "ipm_branch_id", "ipm_item_id", "ipm_uc_unit_id", count(*) AS n
    FROM "inventory"."item_price_master"
    WHERE "ipm_is_deleted" = false
    GROUP BY "ipm_company_id", "ipm_branch_id", "ipm_item_id", "ipm_uc_unit_id"
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'item_price_master has % (company, branch, item, unit) scope(s) duplicated among non-deleted rows; resolve before adding uq_item_price_master_scope. Sample: %',
      dup_count, dup_sample;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_item_price_master_scope"
  ON "inventory"."item_price_master" (
    "ipm_company_id",
    "ipm_branch_id",
    "ipm_item_id",
    "ipm_uc_unit_id"
  )
  NULLS NOT DISTINCT
  WHERE "ipm_is_deleted" = false;

-- Dropped only after the replacement exists, so the table is never unprotected.
DROP INDEX IF EXISTS "inventory"."uq_item_price_master_branch";
DROP INDEX IF EXISTS "inventory"."uq_item_price_master_item_unit_global";
