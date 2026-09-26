-- CreateTable
CREATE TABLE "fixed"."form_section" (
    "section_id" SERIAL NOT NULL,
    "section_menu_id" INTEGER NOT NULL,
    "section_name" VARCHAR(255) NOT NULL,
    "section_position" INTEGER NOT NULL DEFAULT 0,
    "section_visibility" BOOLEAN NOT NULL DEFAULT true,
    "section_platform" VARCHAR(255) NOT NULL,

    CONSTRAINT "form_section_pkey" PRIMARY KEY ("section_id")
);

-- CreateTable
CREATE TABLE "fixed"."form_field" (
    "field_id" SERIAL NOT NULL,
    "field_section_id" INTEGER NOT NULL,
    "field_name" VARCHAR(255) NOT NULL,
    "field_gui_name" VARCHAR(255),
    "field_secondary_text" VARCHAR(255),
    "field_position" INTEGER NOT NULL DEFAULT 0,
    "field_visibility" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "form_field_pkey" PRIMARY KEY ("field_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_form_section" ON "fixed"."form_section"("section_menu_id", "section_platform", "section_name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_form_field" ON "fixed"."form_field"("field_section_id", "field_name");

-- CreateIndex
CREATE INDEX "ix_form_field_tree" ON "fixed"."form_field"("field_section_id", "field_position");

-- AddForeignKey
ALTER TABLE "fixed"."form_field" ADD CONSTRAINT "form_field_field_section_id_fkey" FOREIGN KEY ("field_section_id") REFERENCES "fixed"."form_section"("section_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed"."form_section" ADD CONSTRAINT "form_section_section_menu_id_fkey" FOREIGN KEY ("section_menu_id") REFERENCES "fixed"."menu_master"("menu_id") ON DELETE CASCADE ON UPDATE CASCADE;
