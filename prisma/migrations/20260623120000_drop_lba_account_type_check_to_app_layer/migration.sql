-- Move acc_ledger_bank_accounts.lba_account_type allowed-value validation from the
-- DB CHECK constraint to the module/app layer. The allowed values now live in
-- src/modules/accountsModule/accountLedgerMasters/types/account-ledger-master-enum.ts
-- (BankAccountType) and are enforced by the SaveAccountLedgerMaster/LedgerBankAccountItem
-- DTOs via @IsEnum(BankAccountType). Mirrors the account-groups refactor in migration
-- 20260623100000_remove_acc_group_check_constraints_to_app_layer.
--
-- The old constraint (added in 20260622123550) allowed Title-Case labels
-- ('Savings','Current','Cash Credit','Overdraft','Fixed Deposit'), which never matched
-- the UPPERCASE enum values the app sends ('SAVINGS','CURRENT','CASH_CREDIT','OVERDRAFT'),
-- so any bank account with an account type failed the ledger save with a 23514 check
-- violation. IF EXISTS keeps a fresh replay / shadow DB safe.
ALTER TABLE "accounts"."acc_ledger_bank_accounts"
    DROP CONSTRAINT IF EXISTS "chk_lba_account_type";
