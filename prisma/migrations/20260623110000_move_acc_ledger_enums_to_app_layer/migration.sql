-- Move acc_ledger_master allowed-value validation (GST party registration type,
-- opening-balance Dr/Cr) from native Postgres enum types to the module/app layer.
-- The allowed values now live in
-- src/modules/accountsModule/accountLedgerMasters/types/account-ledger-master-enum.ts
-- (LedGstPartyRegType, LedObType). Mirrors the account-groups refactor in migration
-- 20260623100000_remove_acc_group_check_constraints_to_app_layer.
--
-- The enum types were created in 20260223132356_changes; this converts the columns
-- to plain VARCHAR (enum labels round-trip unchanged via ::text) and drops the types.

-- led_gst_party_reg_type: enum -> VARCHAR(20) (nullable, no default)
ALTER TABLE "accounts"."acc_ledger_master"
  ALTER COLUMN "led_gst_party_reg_type" TYPE VARCHAR(20)
  USING "led_gst_party_reg_type"::text;

-- led_ob_type: enum -> VARCHAR(2) (NOT NULL DEFAULT 'DR'). Drop the enum-typed
-- default before the type change, then restore it as a text default.
ALTER TABLE "accounts"."acc_ledger_master"
  ALTER COLUMN "led_ob_type" DROP DEFAULT;
ALTER TABLE "accounts"."acc_ledger_master"
  ALTER COLUMN "led_ob_type" TYPE VARCHAR(2)
  USING "led_ob_type"::text;
ALTER TABLE "accounts"."acc_ledger_master"
  ALTER COLUMN "led_ob_type" SET DEFAULT 'DR';

-- Drop the now-unused enum types.
DROP TYPE "accounts"."LedObType";
DROP TYPE "accounts"."LedGstPartyRegType";
