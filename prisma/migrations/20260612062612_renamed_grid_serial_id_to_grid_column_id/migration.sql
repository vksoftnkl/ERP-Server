-- Rename grid_columns primary key column to match the model field gridColumnId (@map("grid_column_id"))
ALTER TABLE "fixed"."grid_columns" RENAME COLUMN "grid_serial_id" TO "grid_column_id";
