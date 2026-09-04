ALTER TABLE "fixed"."grid_columns"
ADD COLUMN IF NOT EXISTS "gridColumn_position" DECIMAL(12, 2);
