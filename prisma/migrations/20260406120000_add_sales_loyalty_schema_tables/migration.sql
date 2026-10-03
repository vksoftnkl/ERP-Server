CREATE SCHEMA IF NOT EXISTS sales;

CREATE TABLE IF NOT EXISTS sales.loyalty_sch_list
(
    ls_id                                uuid PRIMARY KEY DEFAULT uuidv7(),
    ls_code                              varchar(30),
    ls_name                              varchar(150) NOT NULL,
    ls_type                              varchar(20) NOT NULL,
    ls_status                            varchar(20) NOT NULL DEFAULT 'DRAFT',
    ls_auto_apply                        boolean NOT NULL DEFAULT true,
    ls_apply_on                          varchar(20) NOT NULL DEFAULT 'BILL_AMOUNT',
    ls_calc_on_amount_type               varchar(20) NOT NULL DEFAULT 'NET_AMOUNT',
    ls_bill_type                         varchar(20) NOT NULL DEFAULT 'ALL',
    ls_cust_type                         varchar(20) NOT NULL DEFAULT 'ALL',
    ls_item_type                         varchar(20) NOT NULL DEFAULT 'ALL',
    ls_start_date                        date NOT NULL,
    ls_end_date                          date NOT NULL,
    ls_valid_from_time                   time,
    ls_valid_to_time                     time,
    ls_valid_weekdays                    varchar(30),
    ls_comp_id                           uuid NOT NULL,
    ls_branch_id                         uuid,
    ls_include_tax_for_points            boolean NOT NULL DEFAULT false,
    ls_rounding_method                   varchar(10) NOT NULL DEFAULT 'FLOOR',
    ls_recur_apl                         boolean NOT NULL DEFAULT false,
    ls_bal_apl                           boolean NOT NULL DEFAULT false,
    ls_allow_point_redeem                boolean NOT NULL DEFAULT false,
    ls_allow_gift_redeem                 boolean NOT NULL DEFAULT false,
    ls_redeem_value_per_point            numeric(18,4) NOT NULL DEFAULT 0,
    ls_min_redeem_points                 numeric(18,4) NOT NULL DEFAULT 0,
    ls_max_redeem_points_per_bill        numeric(18,4) NOT NULL DEFAULT 0,
    ls_max_redeem_percent_per_bill       numeric(18,4) NOT NULL DEFAULT 0,
    ls_redeem_min_bill_amount            numeric(18,2) NOT NULL DEFAULT 0,
    ls_points_valid_days                 integer NOT NULL DEFAULT 0,
    ls_expiry_basis                      varchar(20) NOT NULL DEFAULT 'EARN_DATE',
    ls_remarks                           text,
    ls_is_active                         boolean NOT NULL DEFAULT true,
    ls_is_deleted                        boolean NOT NULL DEFAULT false,
    ls_sync_date                         timestamptz,
    ls_created_on                        timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ls_created_by                        uuid,
    ls_updated_on                        timestamptz,
    ls_updated_by                        uuid,
    ls_approved_on                       timestamptz,
    ls_approved_by                       uuid,

    CONSTRAINT chk_loyalty_sch_list_type
        CHECK (ls_type IN ('REDEEM','BOTH','GIFT')),
    CONSTRAINT chk_loyalty_sch_list_status
        CHECK (ls_status IN ('DRAFT','APPROVED','ACTIVE','CLOSED','CANCELLED')),
    CONSTRAINT chk_loyalty_sch_list_apply_on
        CHECK (ls_apply_on IN ('BILL_AMOUNT','ITEM_AMOUNT','BILL_QTY','ITEM_QTY','MASTER_PV')),
    CONSTRAINT chk_loyalty_sch_list_calc_on_amount_type
        CHECK (ls_calc_on_amount_type IN ('NET_AMOUNT','GROSS_AMOUNT','TAXABLE_AMOUNT')),
    CONSTRAINT chk_loyalty_sch_list_bill_type
        CHECK (ls_bill_type IN ('ALL','CASH','CREDIT')),
    CONSTRAINT chk_loyalty_sch_list_cust_type
        CHECK (ls_cust_type IN ('ALL','CUSTOMER_GROUP','CUSTOMER')),
    CONSTRAINT chk_loyalty_sch_list_item_type
        CHECK (ls_item_type IN ('ALL','ITEM_GROUP','ITEM_BRAND','ITEM_CATEGORY','ITEM_SECTION','ITEM')),
    CONSTRAINT chk_loyalty_sch_list_rounding_method
        CHECK (ls_rounding_method IN ('FLOOR','ROUND','CEIL')),
    CONSTRAINT chk_loyalty_sch_list_expiry_basis
        CHECK (ls_expiry_basis IN ('EARN_DATE','SCHEME_END_DATE','MONTH_END','YEAR_END','NONE')),
    CONSTRAINT chk_loyalty_sch_list_date_range
        CHECK (ls_end_date >= ls_start_date),
    CONSTRAINT chk_loyalty_sch_list_redeem_value_per_point
        CHECK (ls_redeem_value_per_point >= 0),
    CONSTRAINT chk_loyalty_sch_list_min_redeem_points
        CHECK (ls_min_redeem_points >= 0),
    CONSTRAINT chk_loyalty_sch_list_max_redeem_points_per_bill
        CHECK (ls_max_redeem_points_per_bill >= 0),
    CONSTRAINT chk_loyalty_sch_list_max_redeem_percent_per_bill
        CHECK (ls_max_redeem_percent_per_bill >= 0),
    CONSTRAINT chk_loyalty_sch_list_redeem_min_bill_amount
        CHECK (ls_redeem_min_bill_amount >= 0),
    CONSTRAINT chk_loyalty_sch_list_points_valid_days
        CHECK (ls_points_valid_days >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_loyalty_sch_list_code
    ON sales.loyalty_sch_list (ls_comp_id, lower(ls_code))
    WHERE ls_code IS NOT NULL AND ls_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_loyalty_sch_list_active_dates
    ON sales.loyalty_sch_list
    (ls_comp_id, ls_branch_id, ls_is_active, ls_is_deleted, ls_start_date, ls_end_date);

CREATE TABLE IF NOT EXISTS sales.loyalty_sch_party
(
    lps_id                               uuid PRIMARY KEY DEFAULT uuidv7(),
    lps_ls_id                            uuid NOT NULL,
    lps_slno                             integer NOT NULL,
    lps_scope_type                       varchar(20) NOT NULL,
    lps_scope_id                         uuid NOT NULL,
    lps_is_exclude                       boolean NOT NULL DEFAULT false,
    lps_notes                            text,
    lps_is_active                        boolean NOT NULL DEFAULT true,
    lps_is_deleted                       boolean NOT NULL DEFAULT false,
    lps_sync_date                        timestamptz,
    lps_created_on                       timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lps_created_by                       uuid,
    lps_updated_on                       timestamptz,
    lps_updated_by                       uuid,

    CONSTRAINT fk_loyalty_sch_party_ls_id
        FOREIGN KEY (lps_ls_id)
        REFERENCES sales.loyalty_sch_list (ls_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_loyalty_sch_party_slno
        CHECK (lps_slno > 0),
    CONSTRAINT chk_loyalty_sch_party_type
        CHECK (lps_scope_type IN ('CUSTOMER_GROUP','CUSTOMER'))
);

CREATE INDEX IF NOT EXISTS ix_loyalty_sch_party_scheme
    ON sales.loyalty_sch_party (lps_ls_id);

CREATE TABLE IF NOT EXISTS sales.loyalty_sch_points
(
    lspt_id                              uuid PRIMARY KEY DEFAULT uuidv7(),
    lspt_ls_id                           uuid NOT NULL,
    lspt_slno                            integer NOT NULL,
    lspt_item_id                         uuid,
    lspt_unit_id                         uuid,
    lspt_exceeds                         numeric(18,3) NOT NULL DEFAULT 0,
    lspt_each                            numeric(18,3) NOT NULL DEFAULT 1,
    lspt_factor                          numeric(18,4) NOT NULL DEFAULT 1,
    lspt_points                          numeric(18,2) NOT NULL DEFAULT 0,
    lspt_notes                           text,
    lspt_is_active                       boolean NOT NULL DEFAULT true,
    lspt_is_deleted                      boolean NOT NULL DEFAULT false,
    lspt_sync_date                       timestamptz,
    lspt_created_on                      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lspt_created_by                      uuid,
    lspt_updated_on                      timestamptz,
    lspt_updated_by                      uuid,

    CONSTRAINT fk_loyalty_sch_points_ls_id
        FOREIGN KEY (lspt_ls_id)
        REFERENCES sales.loyalty_sch_list (ls_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_loyalty_sch_points_slno
        CHECK (lspt_slno > 0),
    CONSTRAINT chk_loyalty_sch_points_exceeds
        CHECK (lspt_exceeds >= 0),
    CONSTRAINT chk_loyalty_sch_points_each
        CHECK (lspt_each > 0),
    CONSTRAINT chk_loyalty_sch_points_factor
        CHECK (lspt_factor > 0),
    CONSTRAINT chk_loyalty_sch_points_points
        CHECK (lspt_points >= 0)
);

CREATE INDEX IF NOT EXISTS ix_loyalty_sch_points_scheme
    ON sales.loyalty_sch_points (lspt_ls_id);

CREATE TABLE IF NOT EXISTS sales.loyalty_sch_gift
(
    lsg_id                               uuid PRIMARY KEY DEFAULT uuidv7(),
    lsg_ls_id                            uuid NOT NULL,
    lsg_slno                             integer NOT NULL,
    lsg_item_id                          uuid NOT NULL,
    lsg_unit_id                          uuid NOT NULL,
    lsg_item_qty                         numeric(18,3) NOT NULL DEFAULT 1,
    lsg_redeem_points                    numeric(18,2) NOT NULL DEFAULT 0,
    lsg_repeat                           boolean NOT NULL DEFAULT false,
    lsg_notes                            text,
    lsg_is_active                        boolean NOT NULL DEFAULT true,
    lsg_is_deleted                       boolean NOT NULL DEFAULT false,
    lsg_sync_date                        timestamptz,
    lsg_created_on                       timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lsg_created_by                       uuid,
    lsg_updated_on                       timestamptz,
    lsg_updated_by                       uuid,

    CONSTRAINT fk_loyalty_sch_gift_ls_id
        FOREIGN KEY (lsg_ls_id)
        REFERENCES sales.loyalty_sch_list (ls_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT chk_loyalty_sch_gift_slno
        CHECK (lsg_slno > 0),
    CONSTRAINT chk_loyalty_sch_gift_item_qty
        CHECK (lsg_item_qty > 0),
    CONSTRAINT chk_loyalty_sch_gift_redeem_points
        CHECK (lsg_redeem_points >= 0)
);

CREATE INDEX IF NOT EXISTS ix_loyalty_sch_gift_scheme
    ON sales.loyalty_sch_gift (lsg_ls_id);
