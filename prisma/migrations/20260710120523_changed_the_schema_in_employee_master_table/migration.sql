/*
  Warnings:

  - You are about to drop the `employee_departments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `employee_designations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `emp_master` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "sales"."emp_master" DROP CONSTRAINT "emp_master_emp_company_id_fkey";

-- DropForeignKey
ALTER TABLE "sales"."emp_master" DROP CONSTRAINT "emp_master_emp_department_id_fkey";

-- DropForeignKey
ALTER TABLE "sales"."emp_master" DROP CONSTRAINT "emp_master_emp_designation_id_fkey";

-- DropTable
DROP TABLE "accounts"."employee_departments";

-- DropTable
DROP TABLE "accounts"."employee_designations";

-- DropTable
DROP TABLE "sales"."emp_master";

-- CreateTable
CREATE TABLE "employee_departments" (
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

-- CreateTable
CREATE TABLE "employee_designations" (
    "ed_id" UUID NOT NULL DEFAULT uuidv7(),
    "ed_name" VARCHAR(150) NOT NULL,
    "ed_code" VARCHAR(50),
    "ed_is_default" BOOLEAN NOT NULL DEFAULT false,
    "ed_remarks" VARCHAR(250),
    "ed_is_active" BOOLEAN NOT NULL DEFAULT true,
    "ed_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "ed_sync_date" TIMESTAMPTZ,
    "ed_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ed_created_by" VARCHAR(100),
    "ed_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ed_modified_by" VARCHAR(100),

    CONSTRAINT "employee_designations_pkey" PRIMARY KEY ("ed_id")
);

-- CreateTable
CREATE TABLE "employee_master" (
    "emp_id" UUID NOT NULL DEFAULT uuidv7(),
    "emp_company_id" UUID NOT NULL,
    "emp_branch_id" UUID,
    "emp_code" VARCHAR(60),
    "emp_name" VARCHAR(200) NOT NULL,
    "emp_alias" VARCHAR(200),
    "emp_mobile1" VARCHAR(20),
    "emp_mobile2" VARCHAR(20),
    "emp_email" VARCHAR(150),
    "emp_addr1" VARCHAR(250),
    "emp_addr2" VARCHAR(250),
    "emp_addr3" VARCHAR(250),
    "emp_city" VARCHAR(120),
    "emp_district" VARCHAR(120),
    "emp_state" VARCHAR(120),
    "emp_pincode" VARCHAR(10),
    "emp_gender" VARCHAR(10),
    "emp_marital_status" VARCHAR(20),
    "emp_blood_group" VARCHAR(10),
    "emp_dob" DATE,
    "emp_department_id" UUID,
    "emp_designation_id" UUID,
    "emp_employment_type" VARCHAR(20),
    "emp_status" VARCHAR(20),
    "emp_joined_on" DATE,
    "emp_probation_end_on" DATE,
    "emp_confirmation_on" DATE,
    "emp_left_on" DATE,
    "emp_shift_id" UUID,
    "emp_att_constraint_id" UUID,
    "emp_holiday_group_id" UUID,
    "emp_overtime_allowed" BOOLEAN NOT NULL DEFAULT false,
    "emp_has_commission" BOOLEAN NOT NULL DEFAULT false,
    "emp_commission_type" VARCHAR(20),
    "emp_commission_value" DECIMAL(12,3),
    "emp_salary_type" VARCHAR(10) NOT NULL,
    "emp_salary_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "emp_bata_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "emp_km_bata_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "emp_pan_no" VARCHAR(20),
    "emp_aadhar_no" VARCHAR(20),
    "emp_pf_no" VARCHAR(30),
    "emp_esi_no" VARCHAR(30),
    "emp_loan_ledger_id" UUID,
    "emp_photo_url" TEXT,
    "emp_photo" BYTEA,
    "emp_remarks" VARCHAR(500),
    "emp_is_active" BOOLEAN NOT NULL DEFAULT true,
    "emp_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "emp_sync_date" TIMESTAMPTZ,
    "emp_created_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emp_created_by" VARCHAR(100),
    "emp_modified_on" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emp_modified_by" VARCHAR(100),

    CONSTRAINT "employee_master_pkey" PRIMARY KEY ("emp_id")
);

-- CreateIndex
CREATE INDEX "idx_edpt_active" ON "employee_departments"("edpt_is_active");

-- CreateIndex
CREATE INDEX "idx_ed_active" ON "employee_designations"("ed_is_active");

-- CreateIndex
CREATE INDEX "idx_emp_company" ON "employee_master"("emp_company_id");

-- CreateIndex
CREATE INDEX "idx_emp_active" ON "employee_master"("emp_is_active");

-- CreateIndex
CREATE INDEX "idx_emp_department" ON "employee_master"("emp_department_id");

-- CreateIndex
CREATE INDEX "idx_emp_designation" ON "employee_master"("emp_designation_id");

-- AddForeignKey
ALTER TABLE "employee_master" ADD CONSTRAINT "employee_master_emp_company_id_fkey" FOREIGN KEY ("emp_company_id") REFERENCES "companys"("comp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_master" ADD CONSTRAINT "employee_master_emp_designation_id_fkey" FOREIGN KEY ("emp_designation_id") REFERENCES "employee_designations"("ed_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_master" ADD CONSTRAINT "employee_master_emp_department_id_fkey" FOREIGN KEY ("emp_department_id") REFERENCES "employee_departments"("edpt_id") ON DELETE SET NULL ON UPDATE CASCADE;
