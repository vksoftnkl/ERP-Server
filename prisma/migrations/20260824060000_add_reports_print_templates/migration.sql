-- ═══════════════════════════════════════════════════════════════════════════
--  reports schema — print/report template storage.
--
--  §1 reports.print_template            one band-based design
--  §2 reports.print_template_revision   append-only version history
--  §3 reports.printer_profile           per-model escape-command dialect
--
--  HAND-AUTHORED, not generated. `prisma migrate` cannot express two things
--  this file needs:
--
--    * ux_pt_default is UNIQUE NULLS NOT DISTINCT. Prisma emits plain UNIQUE,
--      and plain UNIQUE treats every NULL as distinct -- which would let a
--      second default in for any system template (pt_company_id NULL) or any
--      company-wide template (pt_branch_id NULL). That is exactly the pair of
--      cases the constraint exists to guard. Needs PG15+.
--    * every index here carries a WHERE. Prisma ignores partial indexes, which
--      is also why the models must not declare them.
--
--  NO CHECK CONSTRAINTS on the vocabularies (pt_output_mode, pt_paper_code,
--  pt_doc_type, pp_output_mode). They are enforced in the reporting module --
--  same treatment sales.promotion_scheme already gets -- because the paper and
--  document vocabularies grow with every new report, and a migration per new
--  paper size is not a trade worth making.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS reports;


-- ───────────────────────────────────────────────────────────────────────────
--  §1  reports.print_template
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports.print_template
(
    pt_id            uuid                     NOT NULL DEFAULT uuidv7(),

    -- NULL = system template (shipped with the product, cloned before edit).
    pt_company_id    uuid,
    -- NULL = applies to every branch of pt_company_id.
    pt_branch_id     uuid,

    pt_doc_type      character varying(40)    NOT NULL,
    pt_output_mode   character varying(20)    NOT NULL,
    pt_paper_code    character varying(20)    NOT NULL,
    pt_name          character varying(120)   NOT NULL,

    pt_version       integer                  NOT NULL DEFAULT 1,
    pt_parent_id     uuid,
    pt_schema_ver    integer                  NOT NULL DEFAULT 1,

    pt_definition    jsonb                    NOT NULL,

    pt_is_default    boolean                  NOT NULL DEFAULT false,
    pt_is_active     boolean                  NOT NULL DEFAULT true,
    pt_is_deleted    boolean                  NOT NULL DEFAULT false,

    pt_created_on    timestamptz(6)           NOT NULL DEFAULT now(),
    pt_created_by    uuid,
    pt_modified_on   timestamptz(6),
    pt_modified_by   uuid,

    CONSTRAINT pk_print_template PRIMARY KEY (pt_id),
    CONSTRAINT fk_pt_parent FOREIGN KEY (pt_parent_id)
        REFERENCES reports.print_template (pt_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- One default per (company, branch, doc type, output mode, paper). NULLS NOT
-- DISTINCT is load-bearing -- see the header.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pt_default
    ON reports.print_template (pt_company_id, pt_branch_id, pt_doc_type, pt_output_mode, pt_paper_code)
        NULLS NOT DISTINCT
    WHERE pt_is_default AND NOT pt_is_deleted;

-- A template name is unique within its owning scope, so the designer's template
-- list cannot show two identically named rows.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pt_name
    ON reports.print_template (pt_company_id, pt_branch_id, pt_doc_type, lower(pt_name))
        NULLS NOT DISTINCT
    WHERE NOT pt_is_deleted;

-- The resolver's index: every print request walks
-- (doc_type, output_mode, paper_code) then narrows by company/branch.
CREATE INDEX IF NOT EXISTS ix_pt_lookup
    ON reports.print_template (pt_doc_type, pt_output_mode, pt_paper_code, pt_company_id, pt_branch_id)
    WHERE pt_is_active AND NOT pt_is_deleted;

CREATE INDEX IF NOT EXISTS ix_pt_company
    ON reports.print_template (pt_company_id)
    WHERE pt_company_id IS NOT NULL AND NOT pt_is_deleted;

CREATE INDEX IF NOT EXISTS ix_pt_branch
    ON reports.print_template (pt_branch_id)
    WHERE pt_branch_id IS NOT NULL AND NOT pt_is_deleted;

CREATE INDEX IF NOT EXISTS ix_pt_parent
    ON reports.print_template (pt_parent_id)
    WHERE pt_parent_id IS NOT NULL;


-- ───────────────────────────────────────────────────────────────────────────
--  §2  reports.print_template_revision
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports.print_template_revision
(
    ptr_id          uuid                    NOT NULL DEFAULT uuidv7(),
    ptr_template_id uuid                    NOT NULL,
    ptr_version     integer                 NOT NULL,
    ptr_schema_ver  integer                 NOT NULL DEFAULT 1,
    ptr_definition  jsonb                   NOT NULL,
    ptr_note        character varying(200),
    ptr_created_on  timestamptz(6)          NOT NULL DEFAULT now(),
    ptr_created_by  uuid,

    CONSTRAINT pk_print_template_revision PRIMARY KEY (ptr_id),
    CONSTRAINT fk_ptr_template FOREIGN KEY (ptr_template_id)
        REFERENCES reports.print_template (pt_id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ptr_template_version
    ON reports.print_template_revision (ptr_template_id, ptr_version);

-- Revision listing is always newest-first for one template.
CREATE INDEX IF NOT EXISTS ix_ptr_template_recent
    ON reports.print_template_revision (ptr_template_id, ptr_version DESC);


-- ───────────────────────────────────────────────────────────────────────────
--  §3  reports.printer_profile
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports.printer_profile
(
    pp_id                 uuid                    NOT NULL DEFAULT uuidv7(),
    pp_company_id         uuid,

    pp_code               character varying(40)   NOT NULL,
    pp_name               character varying(120)  NOT NULL,
    pp_output_mode        character varying(20)   NOT NULL,
    pp_family             character varying(40)   NOT NULL,

    pp_columns            integer                 NOT NULL,
    pp_cpi                integer,
    pp_paper_width_mm     integer,
    pp_codepage           character varying(20)   NOT NULL DEFAULT 'CP437',

    pp_supports_bold      boolean                 NOT NULL DEFAULT true,
    pp_supports_underline boolean                 NOT NULL DEFAULT true,
    pp_supports_cut       boolean                 NOT NULL DEFAULT false,
    pp_supports_graphics  boolean                 NOT NULL DEFAULT false,

    -- Capability name -> hex byte string. Sparse; merged over the renderer's
    -- built-in Epson defaults, so a profile only states what differs.
    pp_commands           jsonb,

    pp_is_active          boolean                 NOT NULL DEFAULT true,
    pp_is_deleted         boolean                 NOT NULL DEFAULT false,

    pp_created_on         timestamptz(6)          NOT NULL DEFAULT now(),
    pp_created_by         uuid,
    pp_modified_on        timestamptz(6),
    pp_modified_by        uuid,

    CONSTRAINT pk_printer_profile PRIMARY KEY (pp_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pp_code
    ON reports.printer_profile (lower(pp_code))
    WHERE NOT pp_is_deleted;

CREATE INDEX IF NOT EXISTS ix_pp_lookup
    ON reports.printer_profile (pp_output_mode, pp_company_id)
    WHERE pp_is_active AND NOT pp_is_deleted;


-- ───────────────────────────────────────────────────────────────────────────
--  Ownership. The app connects as the unprivileged erp_app role; migrations
--  run as postgres. deploy/grant-app-privileges.sql iterates every non-system
--  schema, so `reports` is picked up with no change to that file.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE reports.print_template OWNER TO postgres;
ALTER TABLE reports.print_template_revision OWNER TO postgres;
ALTER TABLE reports.printer_profile OWNER TO postgres;
