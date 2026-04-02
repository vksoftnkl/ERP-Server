-- CreateEnum
CREATE TYPE "WidgetPlatform" AS ENUM ('mobile', 'desktop', 'web');
-- CreateTable
CREATE TABLE "widget" (
    "widget_no" SERIAL NOT NULL,
    "widget_group_id" INTEGER NOT NULL,
    "widget_name" VARCHAR(255) NOT NULL,
    "widget_position" INTEGER NOT NULL DEFAULT 0,
    "widget_visibility" BOOLEAN NOT NULL DEFAULT true,
    "widget_gui_name" VARCHAR(255) NOT NULL,
    "widget_type" "WidgetPlatform" NOT NULL,
    "widget_secondary_text" TEXT,
    CONSTRAINT "widget_pkey" PRIMARY KEY ("widget_no")
);
