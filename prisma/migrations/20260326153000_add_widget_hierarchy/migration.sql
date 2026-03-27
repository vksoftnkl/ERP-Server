ALTER TABLE "widget"
ADD COLUMN "widget_parent_id" INTEGER;

CREATE INDEX "widget_widget_parent_id_idx" ON "widget"("widget_parent_id");

ALTER TABLE "widget"
ADD CONSTRAINT "widget_widget_parent_id_fkey"
FOREIGN KEY ("widget_parent_id") REFERENCES "widget"("widget_no")
ON DELETE SET NULL
ON UPDATE CASCADE;
