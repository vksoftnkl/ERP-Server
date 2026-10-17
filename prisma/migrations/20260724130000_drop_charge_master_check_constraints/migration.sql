-- Drop the enum-style CHECK constraints added by 20260724120000_create_charge_master.
-- The allowed value sets now live only in the charge-master module: the DTO's
-- @IsIn lists (SaveChargeMasterDto) plus CHARGE_VALUE_GUARDS, enforced on every
-- write by ChargeMasterService.ensureValuesAreAllowed. Keeping them in the DB as
-- well meant every value-set change needed a migration in lock-step with the code.
--
-- The partial unique index uq_charge_role and the chg_ledger_code foreign key are
-- NOT touched — they stay DB-enforced.
ALTER TABLE "public"."charge_master"
    DROP CONSTRAINT IF EXISTS "ck_chg_module",
    DROP CONSTRAINT IF EXISTS "ck_chg_role",
    DROP CONSTRAINT IF EXISTS "ck_chg_method",
    DROP CONSTRAINT IF EXISTS "ck_chg_type",
    DROP CONSTRAINT IF EXISTS "ck_chg_apply_on",
    DROP CONSTRAINT IF EXISTS "ck_chg_cost_alloc";
