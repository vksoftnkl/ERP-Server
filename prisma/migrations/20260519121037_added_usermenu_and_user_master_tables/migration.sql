-- CreateTable
CREATE TABLE "user_master" (
    "usrId" UUID NOT NULL DEFAULT uuidv7(),
    "usrCompanyId" UUID,
    "usrBranchId" UUID,
    "usrEmployeeId" UUID,
    "usrLoginName" VARCHAR(50) NOT NULL,
    "usrDisplayName" VARCHAR(100) NOT NULL,
    "usrFullName" VARCHAR(150),
    "usrMobileNo" VARCHAR(20),
    "usrEmail" VARCHAR(150),
    "usrAvatarUrl" VARCHAR(500),
    "usrTimezone" VARCHAR(60) NOT NULL DEFAULT 'UTC',
    "usrLanguage" VARCHAR(10) NOT NULL DEFAULT 'en',
    "usrPasswordHash" TEXT NOT NULL,
    "usrPinHash" TEXT,
    "usrMustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "usrPasswordExpiresOn" TIMESTAMPTZ,
    "usrPasswordChangedOn" TIMESTAMPTZ,
    "usrType" TEXT DEFAULT 'USER',
    "usrEditDate" BOOLEAN NOT NULL DEFAULT false,
    "usrEditEntry" BOOLEAN NOT NULL DEFAULT false,
    "usrEditRate" BOOLEAN NOT NULL DEFAULT false,
    "usrDesktopLogin" BOOLEAN NOT NULL DEFAULT true,
    "usrWebLogin" BOOLEAN NOT NULL DEFAULT true,
    "usrMobileLogin" BOOLEAN NOT NULL DEFAULT false,
    "usrIsActive" BOOLEAN NOT NULL DEFAULT true,
    "usrIsLocked" BOOLEAN NOT NULL DEFAULT false,
    "usrFailedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "usrLastFailedLoginOn" TIMESTAMPTZ,
    "usrLockedOn" TIMESTAMPTZ,
    "usrLockedBy" UUID,
    "usrLastLoginOn" TIMESTAMPTZ,
    "usrIsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "usrNotes" TEXT,
    "usrSyncDate" TIMESTAMPTZ,
    "usrCreatedOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usrCreatedBy" UUID,
    "usrModifiedOn" TIMESTAMPTZ,
    "usrModifiedBy" UUID,

    CONSTRAINT "user_master_pkey" PRIMARY KEY ("usrId")
);

-- CreateTable
CREATE TABLE "user_menus" (
    "umId" UUID NOT NULL DEFAULT uuidv7(),
    "umUserId" UUID NOT NULL,
    "umMenuId" INTEGER NOT NULL,
    "umCanView" BOOLEAN NOT NULL DEFAULT true,
    "umCanCreate" BOOLEAN NOT NULL DEFAULT false,
    "umCanEdit" BOOLEAN NOT NULL DEFAULT false,
    "umCanDelete" BOOLEAN NOT NULL DEFAULT false,
    "umCanPrint" BOOLEAN NOT NULL DEFAULT false,
    "umCanExport" BOOLEAN NOT NULL DEFAULT false,
    "umVisibility" BOOLEAN NOT NULL DEFAULT true,
    "umIsFavourite" BOOLEAN NOT NULL DEFAULT false,
    "umIsPinned" BOOLEAN NOT NULL DEFAULT false,
    "umSortOrder" INTEGER NOT NULL DEFAULT 0,
    "umIsDeleted" BOOLEAN NOT NULL DEFAULT false,
    "umSyncDate" TIMESTAMPTZ,
    "umCreatedOn" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "umCreatedBy" UUID NOT NULL,
    "umModifiedOn" TIMESTAMPTZ,
    "umModifiedBy" UUID,

    CONSTRAINT "user_menus_pkey" PRIMARY KEY ("umId")
);

-- CreateIndex
CREATE INDEX "user_menus_umUserId_idx" ON "user_menus"("umUserId");

-- CreateIndex
CREATE INDEX "user_menus_umUserId_umCanView_umVisibility_idx" ON "user_menus"("umUserId", "umCanView", "umVisibility");

-- CreateIndex
CREATE INDEX "user_menus_umUserId_umIsFavourite_umIsPinned_idx" ON "user_menus"("umUserId", "umIsFavourite", "umIsPinned");

-- CreateIndex
CREATE UNIQUE INDEX "user_menus_umUserId_umMenuId_key" ON "user_menus"("umUserId", "umMenuId");

-- AddForeignKey
ALTER TABLE "user_menus" ADD CONSTRAINT "user_menus_umUserId_fkey" FOREIGN KEY ("umUserId") REFERENCES "user_master"("usrId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_menus" ADD CONSTRAINT "user_menus_umMenuId_fkey" FOREIGN KEY ("umMenuId") REFERENCES "fixed"."menu_master"("menu_id") ON DELETE RESTRICT ON UPDATE CASCADE;
