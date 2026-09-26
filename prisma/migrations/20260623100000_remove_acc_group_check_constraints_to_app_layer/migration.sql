-- Move account group allowed-value validation (group type, nature, ledger profile)
-- from DB CHECK constraints to the module/app layer. The allowed values now live in
-- src/modules/accountsModule/accountsGroup/types/account-group-enum.ts
-- (AccountGroupType, AccountGroupNature, AccLedgerProfile).
--
-- IF EXISTS: these constraints were added out-of-band to the live database and are
-- not created by any migration, so on a fresh replay / shadow DB they do not exist.
ALTER TABLE "accounts"."account_groups" DROP CONSTRAINT IF EXISTS "chk_acc_group_type";
ALTER TABLE "accounts"."account_groups" DROP CONSTRAINT IF EXISTS "chk_acc_group_nature";
ALTER TABLE "accounts"."account_groups" DROP CONSTRAINT IF EXISTS "chk_acc_ledger_profile";
