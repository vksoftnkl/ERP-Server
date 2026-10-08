-- CreateTable
CREATE TABLE "app_theme_master" (
    "thm_id" SERIAL NOT NULL,
    "thm_name" VARCHAR(100) NOT NULL,
    "thm_is_active" BOOLEAN NOT NULL DEFAULT true,
    "thm_is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "app_theme_master_pkey" PRIMARY KEY ("thm_id")
);
