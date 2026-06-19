-- Rename supplier_groups columns from camelCase to snake_case (@map) to preserve existing data.
-- Renaming propagates to the primary key, foreign key (from suppliers) and the idx_spg_active index automatically.
ALTER TABLE "purchase"."supplier_groups" RENAME COLUMN "spgId" TO "spg_id";
ALTER TABLE "purchase"."supplier_groups" RENAME COLUMN "spgName" TO "spg_name";
ALTER TABLE "purchase"."supplier_groups" RENAME COLUMN "spgAlias" TO "spg_alias";
ALTER TABLE "purchase"."supplier_groups" RENAME COLUMN "spgShort" TO "spg_short";
ALTER TABLE "purchase"."supplier_groups" RENAME COLUMN "spgDesc" TO "spg_desc";
ALTER TABLE "purchase"."supplier_groups" RENAME COLUMN "spgIsActive" TO "spg_is_active";
ALTER TABLE "purchase"."supplier_groups" RENAME COLUMN "spgIsDeleted" TO "spg_is_deleted";
ALTER TABLE "purchase"."supplier_groups" RENAME COLUMN "spgSyncDate" TO "spg_sync_date";
ALTER TABLE "purchase"."supplier_groups" RENAME COLUMN "spgCreatedOn" TO "spg_created_on";
ALTER TABLE "purchase"."supplier_groups" RENAME COLUMN "spgCreatedBy" TO "spg_created_by";
ALTER TABLE "purchase"."supplier_groups" RENAME COLUMN "spgModifiedOn" TO "spg_modified_on";
ALTER TABLE "purchase"."supplier_groups" RENAME COLUMN "spgModifiedBy" TO "spg_modified_by";
