-- AlterTable
ALTER TABLE "app_theme_master" ALTER COLUMN "thm_id" DROP DEFAULT;
DROP SEQUENCE "app_theme_master_thm_id_seq";

-- AddForeignKey
ALTER TABLE "companys" ADD CONSTRAINT "companys_comp_stylesheet_id_fkey" FOREIGN KEY ("comp_stylesheet_id") REFERENCES "app_theme_master"("thm_id") ON DELETE SET NULL ON UPDATE CASCADE;
