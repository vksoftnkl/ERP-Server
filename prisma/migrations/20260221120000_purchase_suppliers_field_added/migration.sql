-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "purchase";

-- CreateTable
CREATE TABLE "purchase"."suppliers" (
    "supId" UUID NOT NULL DEFAULT uuidv7(),
    "supBranchId" UUID,
    "supGroupId" UUID NOT NULL,
    "supPurchaseType" VARCHAR(20) NOT NULL,
    "supName" VARCHAR(200) NOT NULL,
    "supShort" VARCHAR(50),
    "supAddr1" VARCHAR(250),
    "supAddr2" VARCHAR(250),
    "supAddr3" VARCHAR(250),
    "supCity" VARCHAR(250),
    "supDistrict" VARCHAR(250),
    "supStateName" VARCHAR(100) NOT NULL,
    "supCountry" VARCHAR(60) DEFAULT 'India',
    "supPincode" VARCHAR(10),
    "supTel" VARCHAR(20),
    "supPhone" VARCHAR(20),
    "supMailId" VARCHAR(120),
    "supWhatsappNo" VARCHAR(20),
    "supWebsiteAddress" VARCHAR(200),
    "supChequePreName" VARCHAR(200),
    "supNotes" VARCHAR(250),
    "supCreditDays" INTEGER NOT NULL DEFAULT 0,
    "supCashDiscPerc" DECIMAL(7,3) NOT NULL DEFAULT 0,
    "supCollectionDays" INTEGER[],
    "supGstNo" VARCHAR(15),
    "supStateCode" CHAR(2) NOT NULL,
    "supPanNo" VARCHAR(10),
    "supGstType" VARCHAR(30) NOT NULL,
    "supSupCst" VARCHAR(25),
    "supDrugLiscenceNo" VARCHAR(100),
    "supRegionName" VARCHAR(200),
    "supRegionAddr1" VARCHAR(250),
    "supRegionAddr2" VARCHAR(250),
    "supRegionAddr3" VARCHAR(250),
    "supRegionCity" VARCHAR(250),
    "supRegionDistrict" VARCHAR(250),
    "supRegionStateName" VARCHAR(100),
    "supRegionCountry" VARCHAR(60) DEFAULT 'India',
    "supBilledDate" DATE,
    "supSortOrder" INTEGER DEFAULT 0,
    "supIsActive" BOOLEAN NOT NULL DEFAULT true,
    "supIsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "supSyncDate" TIMESTAMPTZ,
    "supCreatedOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supCreatedBy" VARCHAR(100),
    "supModifiedOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supModifiedBy" VARCHAR(100),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("supId")
);

-- CreateTable
CREATE TABLE "purchase"."supplier_groups" (
    "spgId" UUID NOT NULL DEFAULT uuidv7(),
    "spgName" TEXT NOT NULL,
    "spgAlias" TEXT,
    "spgShort" VARCHAR(50),
    "spgDesc" TEXT,
    "spgIsActive" BOOLEAN NOT NULL DEFAULT true,
    "spgIsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "spgSyncDate" TIMESTAMPTZ,
    "spgCreatedOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spgCreatedBy" VARCHAR(100),
    "spgModifiedOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spgModifiedBy" VARCHAR(100),

    CONSTRAINT "supplier_groups_pkey" PRIMARY KEY ("spgId")
);

-- CreateIndex
CREATE INDEX "idx_sup_group" ON "purchase"."suppliers"("supGroupId");

-- CreateIndex
CREATE INDEX "idx_sup_gst" ON "purchase"."suppliers"("supGstNo");

-- CreateIndex
CREATE INDEX "idx_sup_active" ON "purchase"."suppliers"("supIsActive");

-- CreateIndex
CREATE INDEX "idx_spg_active" ON "purchase"."supplier_groups"("spgIsActive");

-- AddForeignKey
ALTER TABLE "purchase"."suppliers" ADD CONSTRAINT "suppliers_supGroupId_fkey" FOREIGN KEY ("supGroupId") REFERENCES "purchase"."supplier_groups"("spgId") ON DELETE RESTRICT ON UPDATE CASCADE;
