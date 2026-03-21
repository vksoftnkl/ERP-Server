-- CreateTable
CREATE TABLE "accounts"."employee_departments" (
    "edpt_id" UUID NOT NULL DEFAULT uuidv7(),
    "edpt_name" VARCHAR(150) NOT NULL,
    "edpt_code" VARCHAR(50),
    "edpt_alias" TEXT,
    "edpt_remarks" VARCHAR(250),
    "edpt_is_active" BOOLEAN NOT NULL DEFAULT true,
    "edpt_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "edpt_sync_date" TIMESTAMPTZ,
    "edpt_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edpt_created_by" VARCHAR(100),
    "edpt_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edpt_modified_by" VARCHAR(100),

    CONSTRAINT "employee_departments_pkey" PRIMARY KEY ("edpt_id")
);

-- CreateIndex
CREATE INDEX "idx_edpt_active" ON "accounts"."employee_departments"("edpt_is_active");

-- AddForeignKey
ALTER TABLE "sales"."emp_master" ADD CONSTRAINT "emp_master_emp_department_id_fkey" FOREIGN KEY ("emp_department_id") REFERENCES "accounts"."employee_departments"("edpt_id") ON DELETE SET NULL ON UPDATE CASCADE;
