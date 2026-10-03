-- Drop unique constraints on form_section and form_field.
-- Duplicate section names (per menu/platform) and duplicate field names within a
-- section are now allowed; uniqueness is no longer enforced at any layer.

DROP INDEX IF EXISTS "fixed"."uq_form_section";
DROP INDEX IF EXISTS "fixed"."uq_form_field";
