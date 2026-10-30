-- Stop overlapping weight slabs from being saved in sale_loading_charges.
--
-- The item-price lookup resolves a loading charge by matching a weight against
-- one slab. With two slabs covering the same weight for one scope the API has
-- to pick one arbitrarily, so the same line silently gets a different charge
-- depending on row order. This is the constraint that makes the match unique;
-- the lookup's own tie-break is only a fallback for data predating it.
--
-- The range is half-open '[)' -- exactly how the lookup matches
-- (from_weight <= weight < to_weight) -- so slabs may meet on a boundary
-- (0-100, 100-200) without overlapping. A row where from = to is an empty
-- range and conflicts with nothing, which is what an unconfigured default
-- (0, 0) row should do.
--
-- Both scope columns are nullable (NULL company = a global default, NULL
-- branch = every branch of the company). Plain `=` never conflicts on NULL, so
-- unlimited duplicate global slabs would slip through; each is COALESCEd to the
-- nil UUID, which conflicts with itself and with no real company or branch.
--
-- Soft-deleted rows are excluded, so a slab can be deleted and re-created
-- without colliding with its own tombstone. Neither an EXCLUDE constraint nor
-- that predicate is expressible in the Prisma schema -- see the fragment
-- prisma/sales/saleLoadingCharges.prisma.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Guard 1: a reversed slab (from > to) cannot be turned into a numrange at all,
-- so the ALTER below would abort with a bare range error naming no row.
DO $$
DECLARE
  bad_count integer;
  bad_sample text;
BEGIN
  SELECT count(*), left(string_agg(format('(ilc_id=%s, from_weight=%s, to_weight=%s)',
                                          "ilc_id", "ilc_from_weight", "ilc_to_weight"), ', '), 500)
    INTO bad_count, bad_sample
  FROM "sales"."sale_loading_charges"
  WHERE "ilc_is_deleted" = false
    AND coalesce("ilc_from_weight", 0) > "ilc_to_weight";

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'sale_loading_charges has % non-deleted slab(s) whose from_weight exceeds to_weight; correct them before adding excl_ilc_slab_overlap. Sample: %',
      bad_count, bad_sample;
  END IF;
END $$;

-- Guard 2: report the overlapping scopes by name instead of letting ADD
-- CONSTRAINT abort with a bare "conflicting key value violates exclusion
-- constraint".
DO $$
DECLARE
  overlap_count integer;
  overlap_sample text;
BEGIN
  SELECT count(*), left(string_agg(format('(company=%s, branch=%s, %s-%s vs %s-%s)',
                                          coalesce(a."ilc_comp_id"::text, 'NULL'),
                                          coalesce(a."ilc_branch_id"::text, 'NULL'),
                                          a."ilc_from_weight", a."ilc_to_weight",
                                          b."ilc_from_weight", b."ilc_to_weight"), ', '), 500)
    INTO overlap_count, overlap_sample
  FROM "sales"."sale_loading_charges" a
  JOIN "sales"."sale_loading_charges" b
    ON b."ilc_id" > a."ilc_id"
   AND coalesce(b."ilc_comp_id", '00000000-0000-0000-0000-000000000000'::uuid)
     = coalesce(a."ilc_comp_id", '00000000-0000-0000-0000-000000000000'::uuid)
   AND coalesce(b."ilc_branch_id", '00000000-0000-0000-0000-000000000000'::uuid)
     = coalesce(a."ilc_branch_id", '00000000-0000-0000-0000-000000000000'::uuid)
   AND numrange(coalesce(b."ilc_from_weight", 0), b."ilc_to_weight", '[)')
    && numrange(coalesce(a."ilc_from_weight", 0), a."ilc_to_weight", '[)')
   AND b."ilc_is_deleted" = false
  WHERE a."ilc_is_deleted" = false;

  IF overlap_count > 0 THEN
    RAISE EXCEPTION
      'sale_loading_charges has % overlapping weight slab(s) among non-deleted rows; resolve before adding excl_ilc_slab_overlap. Sample: %',
      overlap_count, overlap_sample;
  END IF;
END $$;

ALTER TABLE "sales"."sale_loading_charges"
  ADD CONSTRAINT "excl_ilc_slab_overlap"
  EXCLUDE USING gist (
    (coalesce("ilc_comp_id", '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    (coalesce("ilc_branch_id", '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
    (numrange(coalesce("ilc_from_weight", 0), "ilc_to_weight", '[)')) WITH &&
  )
  WHERE ("ilc_is_deleted" = false);
