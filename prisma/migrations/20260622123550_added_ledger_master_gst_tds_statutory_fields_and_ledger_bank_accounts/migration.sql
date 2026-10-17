BEGIN;

-- #############################################################################
-- PART B : accounts.acc_ledger_master
-- #############################################################################

-- B1. Tally sync identity (led_tally_guid / led_tally_name already exist) --------
ALTER TABLE accounts.acc_ledger_master
    ADD COLUMN IF NOT EXISTS led_tally_master_id bigint,   -- Tally <MASTERID>
    ADD COLUMN IF NOT EXISTS led_tally_alter_id  bigint;   -- Tally <ALTERID>

-- B2. Role classifier + mailing name --------------------------------------------
ALTER TABLE accounts.acc_ledger_master
    ADD COLUMN IF NOT EXISTS led_ledger_type  character varying(20),  -- PARTY/BANK/CASH/TAX/ROUNDOFF/DISCOUNT/EXPENSE/INCOME/GENERAL
    ADD COLUMN IF NOT EXISTS led_mailing_name character varying(200); -- Tally LEDGERMAILINGNAME

-- B4. GST at ledger level -------------------------------------------------------
ALTER TABLE accounts.acc_ledger_master
    ADD COLUMN IF NOT EXISTS led_type_of_supply character varying(10), -- Goods/Services (TYPEOFSUPPLY)
    ADD COLUMN IF NOT EXISTS led_hsn_sac        character varying(10), -- HSN/SAC (verify)
    ADD COLUMN IF NOT EXISTS led_gst_rate       numeric,               -- ledger GST % (GSTDETAILS.LIST, verify)
    ADD COLUMN IF NOT EXISTS led_taxability     character varying(15), -- Taxable/Exempt/Nil Rated/Non-GST (verify)
    ADD COLUMN IF NOT EXISTS led_gst_party_type character varying(30); -- Regular/Composition/SEZ/Deemed Export/... (complements reg_type+is_sez)

-- B5. Tax / duty ledgers (CGST/SGST/IGST/Cess + round-off) ----------------------
ALTER TABLE accounts.acc_ledger_master
    ADD COLUMN IF NOT EXISTS led_gst_duty_head   character varying(20),-- Central Tax/State Tax/Integrated Tax/Cess/State Cess (GSTDUTYHEAD)
    ADD COLUMN IF NOT EXISTS led_tax_rate        numeric,              -- percentage of calculation
    ADD COLUMN IF NOT EXISTS led_rounding_method character varying(15),-- Not Applicable/Upward/Downward/Normal (LEDGERROUNDTYPE, verify)
    ADD COLUMN IF NOT EXISTS led_rounding_limit  numeric;              -- LEDGERROUNDLIMIT (verify)

-- B6. TDS / TCS -----------------------------------------------------------------
ALTER TABLE accounts.acc_ledger_master
    ADD COLUMN IF NOT EXISTS led_is_tds_applicable     boolean NOT NULL DEFAULT false,-- ISTDSAPPLICABLE (verify)
    ADD COLUMN IF NOT EXISTS led_tds_deductee_type     character varying(40),         -- DEDUCTEETYPE (verify)
    ADD COLUMN IF NOT EXISTS led_tds_nature_of_payment character varying(80),         -- TDS nature-of-payment ref (verify)
    ADD COLUMN IF NOT EXISTS led_is_tcs_applicable     boolean NOT NULL DEFAULT false;

-- B7. Statutory identifiers (led_pan_no / led_aadhar_no already exist) -----------
ALTER TABLE accounts.acc_ledger_master
    ADD COLUMN IF NOT EXISTS led_tan_no    character varying(10), -- TAN
    ADD COLUMN IF NOT EXISTS led_cin       character varying(21), -- CIN
    ADD COLUMN IF NOT EXISTS led_udyam_no  character varying(25), -- Udyam/MSME (43B(h))
    ADD COLUMN IF NOT EXISTS led_msme_type character varying(10); -- Micro/Small/Medium

-- B8. Currency + display order (bank fields now live in PART C) ------------------
ALTER TABLE accounts.acc_ledger_master
    ADD COLUMN IF NOT EXISTS led_sort_order    integer;

-- B9. Drop now-redundant inline bank columns (bank data -> PART C child table) ----
ALTER TABLE accounts.acc_ledger_master
    DROP COLUMN IF EXISTS led_bank_name,
    DROP COLUMN IF EXISTS led_bank_branch,
    DROP COLUMN IF EXISTS led_bank_ac_no,
    DROP COLUMN IF EXISTS led_bank_ifsc,
    DROP COLUMN IF EXISTS led_upi_id,
    DROP COLUMN IF EXISTS led_holder_name;

-- B10. Domain constraints (allow NULL -> safe on existing rows) ------------------
ALTER TABLE accounts.acc_ledger_master
    DROP CONSTRAINT IF EXISTS chk_led_ledger_type,
    ADD  CONSTRAINT chk_led_ledger_type CHECK (
        led_ledger_type IS NULL OR led_ledger_type IN
        ('PARTY','BANK','CASH','TAX','ROUNDOFF','DISCOUNT','EXPENSE','INCOME','GENERAL'));

ALTER TABLE accounts.acc_ledger_master
    DROP CONSTRAINT IF EXISTS chk_led_type_of_supply,
    ADD  CONSTRAINT chk_led_type_of_supply CHECK (
        led_type_of_supply IS NULL OR led_type_of_supply IN ('Goods','Services'));

ALTER TABLE accounts.acc_ledger_master
    DROP CONSTRAINT IF EXISTS chk_led_taxability,
    ADD  CONSTRAINT chk_led_taxability CHECK (
        led_taxability IS NULL OR led_taxability IN ('Taxable','Exempt','Nil Rated','Non-GST'));

ALTER TABLE accounts.acc_ledger_master
    DROP CONSTRAINT IF EXISTS chk_led_gst_duty_head,
    ADD  CONSTRAINT chk_led_gst_duty_head CHECK (
        led_gst_duty_head IS NULL OR led_gst_duty_head IN
        ('Central Tax','State Tax','Integrated Tax','Cess','State Cess'));

ALTER TABLE accounts.acc_ledger_master
    DROP CONSTRAINT IF EXISTS chk_led_rounding_method,
    ADD  CONSTRAINT chk_led_rounding_method CHECK (
        led_rounding_method IS NULL OR led_rounding_method IN
        ('Not Applicable','Upward','Downward','Normal'));

ALTER TABLE accounts.acc_ledger_master
    DROP CONSTRAINT IF EXISTS chk_led_msme_type,
    ADD  CONSTRAINT chk_led_msme_type CHECK (
        led_msme_type IS NULL OR led_msme_type IN ('Micro','Small','Medium'));

-- B11. Identity + lookup indexes ------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_led_tally_guid
    ON accounts.acc_ledger_master (led_tally_guid)
    WHERE led_tally_guid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_led_tally_master_id
    ON accounts.acc_ledger_master (led_company_id, led_tally_master_id)
    WHERE led_tally_master_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_led_ledger_type
    ON accounts.acc_ledger_master (led_ledger_type);


-- #############################################################################
-- PART C : accounts.acc_ledger_bank_accounts
-- #############################################################################

-- C1. Create the child table if it does not already exist -----------------------
CREATE TABLE IF NOT EXISTS accounts.acc_ledger_bank_accounts
(
    lba_id             uuid NOT NULL DEFAULT uuidv7(),
    lba_ledger_id      uuid NOT NULL,
    lba_account_holder character varying(200) NOT NULL,
    lba_bank_name      character varying(200) NOT NULL,
    lba_branch_name    character varying(200),
    lba_account_no     character varying(50)  NOT NULL,
    lba_ifsc_code      character varying(11),
    lba_micr_code      character varying(15),
    lba_account_type   character varying(20),
    lba_upi_id         character varying(100),
    lba_cheque_name    character varying(200),
    lba_is_default     boolean NOT NULL DEFAULT false,
    lba_is_active      boolean NOT NULL DEFAULT true,
    lba_is_deleted     boolean NOT NULL DEFAULT false,
    lba_sync_date      timestamp with time zone,
    lba_created_on     timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lba_created_by     character varying(100),
    lba_modified_on    timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lba_modified_by    character varying(100),
    lba_remarks        character varying(250),
    lba_company_id     uuid,
    CONSTRAINT acc_ledger_bank_accounts_pkey PRIMARY KEY (lba_id),
    CONSTRAINT acc_ledger_bank_accounts_lba_company_id_fkey FOREIGN KEY (lba_company_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT acc_ledger_bank_accounts_lba_ledger_id_fkey FOREIGN KEY (lba_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) MATCH SIMPLE ON UPDATE CASCADE ON DELETE RESTRICT
)
TABLESPACE pg_default;

-- C3. Indexes -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lba_company ON accounts.acc_ledger_bank_accounts (lba_company_id);
CREATE INDEX IF NOT EXISTS idx_lba_ledger  ON accounts.acc_ledger_bank_accounts (lba_ledger_id);

-- at most ONE active default bank per ledger
CREATE UNIQUE INDEX IF NOT EXISTS uq_lba_default_per_ledger
    ON accounts.acc_ledger_bank_accounts (lba_ledger_id)
    WHERE lba_is_default AND NOT lba_is_deleted;

-- no duplicate account number under the same ledger (ignoring soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS uq_lba_ledger_account_no
    ON accounts.acc_ledger_bank_accounts (lba_ledger_id, lba_account_no)
    WHERE NOT lba_is_deleted;

-- C4. Account-type domain (optional, aligns with led_bank_account_type values) ---
ALTER TABLE accounts.acc_ledger_bank_accounts
    DROP CONSTRAINT IF EXISTS chk_lba_account_type,
    ADD  CONSTRAINT chk_lba_account_type CHECK (
        lba_account_type IS NULL OR lba_account_type IN
        ('Savings','Current','Cash Credit','Overdraft','Fixed Deposit'));

COMMIT;
