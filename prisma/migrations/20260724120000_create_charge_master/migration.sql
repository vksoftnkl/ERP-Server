-- Shared "additional charges" master for both Sales and Purchase.
CREATE TABLE IF NOT EXISTS "public"."charge_master" (
    "chg_id"            uuid          NOT NULL DEFAULT gen_random_uuid(),  -- surrogate key
    "chg_name"          varchar(100)  NOT NULL,                            -- "Freight", "Packing", "Insurance"...
    "chg_code"          varchar(50),                                       -- business code

    "chg_module"        char(1)       NOT NULL,                            -- 'P'urchase / 'S'ales / 'B'oth
    "chg_role"          varchar(15),                                       -- 'FREIGHT' | 'LOADING' | 'UNLOADING' | 'CASH_DISC' | 'OTHERS' | 'NONE'
    "chg_method"        varchar(10)   NOT NULL,                            -- 'FIXED' | 'PERCENT'
    "chg_type"          varchar(10)   NOT NULL DEFAULT 'ADD',              -- 'ADD' | 'DEDUCT'  (charge vs discount)
    "chg_apply_on"      varchar(10)   NOT NULL,                            -- 'FLAT' | 'QTY' | 'VALUE' | 'WEIGHT'
    "chg_default_rate"  numeric(14,4)          DEFAULT 0,                  -- optional default rate/%

    "chg_landing_cost"  boolean       NOT NULL DEFAULT false,             -- purchase only
    "chg_cost_alloc"    varchar(10),                                       -- 'VALUE' | 'QTY' | 'WEIGHT' (only when landing_cost)

    "chg_ledger_code"   uuid          NOT NULL,                            -- GL ledger mapping
    "chg_tax_apl"       boolean       NOT NULL DEFAULT false,             -- charge itself taxable
    "chg_before_tax"    boolean       NOT NULL DEFAULT false,             -- deduct/add before tax calc?
    "chg_sep_post"      boolean       NOT NULL DEFAULT false,             -- post to own ledger vs absorb
    "chg_man_party"     boolean       NOT NULL DEFAULT false,             -- requires a party (e.g. freight vendor)

    "chg_disp_order"    integer                DEFAULT 0,                  -- grid ordering
    "chg_auto_apply"    boolean       NOT NULL DEFAULT false,             -- auto-load into new entry
    "chg_is_active"     boolean       NOT NULL DEFAULT true,
    "chg_is_deleted"    boolean       NOT NULL DEFAULT false,

    "chg_sync_date"     timestamptz,                                       -- last sync timestamp
    "chg_created_on"    timestamptz   NOT NULL DEFAULT now(),
    "chg_created_by"    uuid,
    "chg_modified_on"   timestamptz,
    "chg_modified_by"   uuid,

    CONSTRAINT "charge_master_pkey"  PRIMARY KEY ("chg_id"),
    CONSTRAINT "uq_charge_code"      UNIQUE ("chg_code"),
    CONSTRAINT "ck_chg_module"       CHECK ("chg_module"   IN ('P','S','B')),
    CONSTRAINT "ck_chg_role"         CHECK ("chg_role" IS NULL OR "chg_role" IN ('FREIGHT','LOADING','UNLOADING','CASH_DISC','OTHERS','NONE')),
    CONSTRAINT "ck_chg_method"       CHECK ("chg_method"   IN ('FIXED','PERCENT')),
    CONSTRAINT "ck_chg_type"         CHECK ("chg_type"     IN ('ADD','DEDUCT')),
    CONSTRAINT "ck_chg_apply_on"     CHECK ("chg_apply_on" IN ('FLAT','QTY','VALUE','WEIGHT')),
    CONSTRAINT "ck_chg_cost_alloc"   CHECK ("chg_cost_alloc" IS NULL OR "chg_cost_alloc" IN ('VALUE','QTY','WEIGHT'))
);

-- One FREIGHT / LOADING / UNLOADING / CASH_DISC / OTHERS per module
-- (generic NULL / NONE roles are not constrained). Soft-deleted rows are
-- excluded so a role can be deleted and re-created. This partial predicate is
-- why it is not expressible as @@unique(...) in the Prisma schema.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_charge_role"
    ON "public"."charge_master" ("chg_role", "chg_module")
    WHERE "chg_role" IN ('FREIGHT','LOADING','UNLOADING','CASH_DISC','OTHERS')
      AND "chg_is_deleted" = false;

-- GL ledger mapping: each charge posts to an accounts.acc_ledger_master row.
-- RESTRICT so a ledger in use by a charge cannot be deleted out from under it.
CREATE INDEX IF NOT EXISTS "idx_chg_ledger_code"
    ON "public"."charge_master" ("chg_ledger_code");

ALTER TABLE "public"."charge_master"
    ADD CONSTRAINT "charge_master_chg_ledger_code_fkey"
    FOREIGN KEY ("chg_ledger_code")
    REFERENCES "accounts"."acc_ledger_master" ("led_id")
    ON UPDATE CASCADE ON DELETE RESTRICT;
