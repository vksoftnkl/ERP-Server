ALTER TABLE "widget"
DROP CONSTRAINT IF EXISTS "widget_widget_parent_id_fkey";

DROP INDEX IF EXISTS "widget_widget_parent_id_idx";

ALTER TABLE "widget"
DROP COLUMN IF EXISTS "widget_parent_id";
