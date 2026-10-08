-- Make account ledger company & branch optional.
-- led_company_id / led_branch_id were NOT NULL foreign keys; the app layer now
-- allows ledgers to be saved without a company and/or branch.
ALTER TABLE "accounts"."acc_ledger_master" ALTER COLUMN "led_company_id" DROP NOT NULL;
ALTER TABLE "accounts"."acc_ledger_master" ALTER COLUMN "led_branch_id" DROP NOT NULL;
