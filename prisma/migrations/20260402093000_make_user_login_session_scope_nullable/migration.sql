ALTER TABLE "audit"."user_login_sessions"
ALTER COLUMN "uls_company_id" DROP NOT NULL,
ALTER COLUMN "uls_branch_id" DROP NOT NULL;
