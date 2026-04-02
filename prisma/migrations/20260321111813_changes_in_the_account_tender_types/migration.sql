-- Move existing tables to their new schemas without dropping data.
-- Prisma generated DROP/CREATE statements for these schema changes, but these
-- tables already exist and are referenced elsewhere.

ALTER TABLE "accounts"."companys" SET SCHEMA "public";
ALTER TABLE "accounts"."branch_master" SET SCHEMA "public";
ALTER TABLE "accounts"."company_group_master" SET SCHEMA "public";

ALTER TABLE "accounts"."gsp_provider_master" SET SCHEMA "fixed";
ALTER TABLE "accounts"."gsp_company_service" SET SCHEMA "fixed";

ALTER TABLE "fixed"."user_login_sessions" SET SCHEMA "audit";
