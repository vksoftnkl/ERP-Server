-- AlterTable
ALTER TABLE "fixed"."grid_columns" ADD COLUMN     "gridColumn_sql_field_name" TEXT;

-- RenameForeignKey
ALTER TABLE "user_menus" RENAME CONSTRAINT "user_menus_umMenuId_fkey" TO "user_menus_um_menu_id_fkey";

-- RenameForeignKey
ALTER TABLE "user_menus" RENAME CONSTRAINT "user_menus_umUserId_fkey" TO "user_menus_um_user_id_fkey";
-- RenameIndex
ALTER INDEX "user_menus_umUserId_idx" RENAME TO "user_menus_um_user_id_idx";
-- RenameIndex
ALTER INDEX "user_menus_umUserId_umCanView_umVisibility_idx" RENAME TO "user_menus_um_user_id_um_can_view_um_visibility_idx";
-- RenameIndex
ALTER INDEX "user_menus_umUserId_umIsFavourite_umIsPinned_idx" RENAME TO "user_menus_um_user_id_um_is_favourite_um_is_pinned_idx";
-- RenameIndex
ALTER INDEX "user_menus_umUserId_umMenuId_key" RENAME TO "user_menus_um_user_id_um_menu_id_key";
