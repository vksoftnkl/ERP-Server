-- ═══════════════════════════════════════════════════════════════════════════
--  reports.report_dataset — runtime-defined report datasets.
--
--  The compiled providers under modules/reporting/providers/impl are the same
--  contract expressed in TypeScript. This table is what lets a new dataset be
--  an INSERT instead of a deploy.
--
--  HAND-AUTHORED. Both indexes are partial on NOT rds_is_deleted, which Prisma
--  cannot emit — and ux_rds_token is on lower(rds_token), because token lookup
--  is case-insensitive and a soft-deleted token has to be reusable.
--
--  NO CHECK CONSTRAINT on rds_cardinality or rds_doc_types. Same reasoning as
--  print_template: the document vocabulary grows with every new report, and a
--  migration per new document type is not a trade worth making. The reporting
--  module is the enforcement point.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS reports;


CREATE TABLE IF NOT EXISTS reports.report_dataset
(
    rds_id            uuid                     NOT NULL DEFAULT uuidv7(),

    -- Namespaced (custom.*) so a runtime dataset can never shadow a compiled
    -- provider token. Enforced in the service, not here.
    rds_token         character varying(120)   NOT NULL,
    rds_label         character varying(160)   NOT NULL,
    rds_cardinality   character varying(10)    NOT NULL,
    rds_doc_types     character varying(40)[]  NOT NULL DEFAULT '{}',

    -- Validated SELECT. p_* tokens are bound as $n at run time, never
    -- interpolated, and always executed on the read-only pool.
    rds_sql           text                     NOT NULL,
    rds_params        jsonb                    NOT NULL DEFAULT '[]'::jsonb,
    -- Introspected at save time from the pg field descriptors.
    rds_fields        jsonb                    NOT NULL DEFAULT '[]'::jsonb,
    -- NULL = synthesise preview rows from rds_fields. Never holds live rows:
    -- a sample is visible to every tenant that opens the designer.
    rds_sample_rows   jsonb,

    rds_max_rows      integer                  NOT NULL DEFAULT 5000,
    rds_notes         character varying(500),

    rds_version       integer                  NOT NULL DEFAULT 1,
    rds_is_active     boolean                  NOT NULL DEFAULT true,
    rds_is_deleted    boolean                  NOT NULL DEFAULT false,

    rds_created_on    timestamptz(6)           NOT NULL DEFAULT now(),
    rds_created_by    uuid,
    rds_modified_on   timestamptz(6),
    rds_modified_by   uuid,

    CONSTRAINT pk_report_dataset PRIMARY KEY (rds_id)
);

-- Token lookup is case-insensitive, and a soft-deleted token must be reusable.
CREATE UNIQUE INDEX IF NOT EXISTS ux_rds_token
    ON reports.report_dataset (lower(rds_token))
    WHERE NOT rds_is_deleted;

-- The registry's warm-load and its refresh probe both read exactly this set.
CREATE INDEX IF NOT EXISTS ix_rds_active
    ON reports.report_dataset (rds_is_active)
    WHERE NOT rds_is_deleted;


-- ───────────────────────────────────────────────────────────────────────────
--  Ownership. The app connects as the unprivileged erp_app role; migrations
--  run as postgres. deploy/grant-app-privileges.sql iterates every non-system
--  schema, so `reports` is picked up with no change to that file.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE reports.report_dataset OWNER TO postgres;
