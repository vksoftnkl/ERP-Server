-- CreateTable
CREATE TABLE "transaction_hold" (
    "th_id" UUID NOT NULL DEFAULT uuidv7(),
    "th_company_id" UUID NOT NULL,
    "th_branch_id" UUID NOT NULL,
    "th_acc_year" SMALLINT NOT NULL,
    "th_hold_no" VARCHAR(30) NOT NULL,
    "th_hold_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "th_doc_type" VARCHAR(20) NOT NULL DEFAULT 'SALE_INVOICE',
    "th_counter_id" UUID,
    "th_session_id" UUID,
    "th_user_id" UUID,
    "th_device_id" VARCHAR(64) NOT NULL,
    "th_device_type" VARCHAR(20) NOT NULL,
    "th_customer_name" VARCHAR(150),
    "th_item_count" INTEGER NOT NULL DEFAULT 0,
    "th_total_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "th_total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "th_status" VARCHAR(15) NOT NULL DEFAULT 'HELD',
    "th_hold_reason" VARCHAR(100),
    "th_remarks" VARCHAR(255),
    "th_expires_at" TIMESTAMPTZ(6),
    "th_locked_by" VARCHAR(50),
    "th_locked_at" TIMESTAMPTZ(6),
    "th_resumed_by" VARCHAR(50),
    "th_resumed_at" TIMESTAMPTZ(6),
    "th_resume_count" INTEGER NOT NULL DEFAULT 0,
    "th_converted_doc_type" VARCHAR(20),
    "th_converted_doc_id" UUID,
    "th_converted_no" VARCHAR(30),
    "th_converted_at" TIMESTAMPTZ(6),
    "th_converted_by" VARCHAR(50),
    "th_is_stock_reserved" BOOLEAN NOT NULL DEFAULT false,
    "th_ui_state" JSONB,
    "th_is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "th_created_by" VARCHAR(50),
    "th_created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "th_modified_by" VARCHAR(50),
    "th_modified_at" TIMESTAMPTZ(6),

    CONSTRAINT "pk_transaction_hold" PRIMARY KEY ("th_id")
);

-- Partial indexes: Prisma cannot express a WHERE predicate, so these stay
-- DB-only and are documented in prisma/public/transactionHold.prisma rather
-- than declared on the model (a declared copy would drift into a non-partial
-- CREATE INDEX on the same name).

-- hold number unique per company + branch + acc year, per document type
CREATE UNIQUE INDEX "ux_th_hold_no"
    ON public.transaction_hold (th_company_id, th_branch_id, th_acc_year, th_doc_type, th_hold_no)
    WHERE th_is_deleted = false;

-- main recall-list index
CREATE INDEX "ix_th_list"
    ON public.transaction_hold (th_company_id, th_branch_id, th_doc_type, th_status, th_hold_date DESC)
    WHERE th_is_deleted = false;

CREATE INDEX "ix_th_counter_session"
    ON public.transaction_hold (th_counter_id, th_session_id)
    WHERE th_is_deleted = false;

CREATE INDEX "ix_th_device"
    ON public.transaction_hold (th_company_id, th_branch_id, th_device_id)
    WHERE th_is_deleted = false;

-- for the expiry / purge job
CREATE INDEX "ix_th_expiry"
    ON public.transaction_hold (th_expires_at)
    WHERE th_status IN ('HELD','LOCKED') AND th_is_deleted = false;

-- reverse lookup: which hold produced this document
CREATE INDEX "ix_th_converted_doc"
    ON public.transaction_hold (th_converted_doc_id)
    WHERE th_converted_doc_id IS NOT NULL;
