-- ═══════════════════════════════════════════════════════════════════════════
--  accounts.acc_ledger_map — role -> ledger
--
--  Posting has been resolving ledgers by name. This is the table it resolves
--  against instead, keyed on the roles already defined in acc_ledger_role.
--  Also relaxes av_opp_ledger_id, which a multi-leg voucher cannot fill.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE accounts.acc_vouchers
    ALTER COLUMN av_opp_ledger_id DROP NOT NULL;

COMMENT ON COLUMN accounts.acc_vouchers.av_opp_ledger_id IS
    'The other side, for two-leg vouchers only. NULL on a multi-leg voucher such as a sale — there is no single opposite, and inventing one makes the daybook lie.';

CREATE TABLE IF NOT EXISTS accounts.acc_ledger_map
(
    alm_id           uuid          NOT NULL DEFAULT uuidv7(),

    -- ── RESERVED. Always NULL today, and no screen sets them ─────────────
    -- The chart of accounts is shared and the company lives on av_company_id
    -- on the voucher, so a role has one answer for the whole business. These
    -- two exist so that a single company — or one branch — could be given its
    -- own ledger for a role later without a migration: insert a row with the
    -- column set and fn_ledger_for already prefers it.
    --
    -- Nothing pays for them meanwhile: every row has NULL, so the extra terms
    -- in the unique index and the resolver's ORDER BY never change an answer.
    -- Do NOT surface them in the UI until there is a reason to.
    alm_company_id   uuid,
    alm_branch_id    uuid,

    alm_role         varchar(30)   NOT NULL,
    -- NULL = both supply natures, which is the normal case. Set it only where
    -- the chart separates 'Local Sales' from 'Interstate Sales' — a scope
    -- dimension like company and branch, rather than doubling the role list
    -- into SALES / SALES_INTERSTATE and every other pair.
    --
    -- Only the revenue and purchase roles mean anything here. The tax roles
    -- are already nature-specific by which one you use: OUTPUT_CGST/SGST exist
    -- only on an intra-state sale, OUTPUT_IGST only on an inter-state one.
    alm_supply_nature varchar(5),
    alm_ledger_id    uuid          NOT NULL,
    alm_remarks      varchar(250),

    alm_is_active    boolean       NOT NULL DEFAULT true,
    alm_is_deleted   boolean       NOT NULL DEFAULT false,
    alm_sync_date    timestamp(6) with time zone,
    alm_created_on   timestamp(6) with time zone NOT NULL DEFAULT now(),
    alm_created_by   varchar(50),
    alm_modified_on  timestamp(6) with time zone,
    alm_modified_by  varchar(50),

    CONSTRAINT pk_acc_ledger_map PRIMARY KEY (alm_id),

    CONSTRAINT fk_alm_company FOREIGN KEY (alm_company_id)
        REFERENCES public.companys (comp_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_alm_ledger FOREIGN KEY (alm_ledger_id)
        REFERENCES accounts.acc_ledger_master (led_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    -- An FK, not a CHECK listing twenty names. Adding a role is one insert in
    -- accounts.acc_ledger_role; this table and tax_rate_ledger both follow.
    CONSTRAINT fk_alm_role FOREIGN KEY (alm_role)
        REFERENCES accounts.acc_ledger_role (alr_role) ON UPDATE CASCADE ON DELETE RESTRICT,

    -- Which roles MAY carry a nature is not listed here — it is
    -- acc_ledger_role.alr_by_supply, checked by the guard, so the rule lives
    -- with the role rather than being repeated as a CHECK in two tables.
    CONSTRAINT ck_alm_supply_nature CHECK (
        alm_supply_nature IS NULL OR alm_supply_nature IN ('INTRA','INTER'))
);

ALTER TABLE IF EXISTS accounts.acc_ledger_map OWNER to postgres;

-- One live answer per role. NULLS NOT DISTINCT so a second company-wide row
-- for the same role is rejected — a plain UNIQUE would allow it, since
-- NULL <> NULL.
CREATE UNIQUE INDEX IF NOT EXISTS ux_alm_role
    ON accounts.acc_ledger_map (alm_company_id, alm_branch_id, alm_role, alm_supply_nature)
    NULLS NOT DISTINCT
    WHERE alm_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_alm_lookup
    ON accounts.acc_ledger_map (alm_role)
    INCLUDE (alm_ledger_id, alm_supply_nature, alm_company_id, alm_branch_id)
    WHERE alm_is_deleted = false AND alm_is_active = true;

CREATE INDEX IF NOT EXISTS ix_alm_ledger ON accounts.acc_ledger_map (alm_ledger_id);

COMMENT ON TABLE accounts.acc_ledger_map IS
    'Role -> ledger, per company (and optionally per branch). Posting resolves a role here instead of hard-coding a ledger name. Tender and charge ledgers are NOT here: acc_tender_master and charge_master own those.';
