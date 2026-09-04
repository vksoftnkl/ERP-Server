-- ═══════════════════════════════════════════════════════════════════════════
--  NexERP backend — 17: PRINTING
--
--      public.print_purpose              what can be printed       (ppo_)
--      public.print_template             the design                (ptl_)
--      public.print_template_version     its history, append-only  (ptv_)
--      public.print_template_dataset     where the data comes from (ptd_)
--      public.print_template_assignment  which design wins, where  (pta_)
--      public.printer_profile            the physical device       (prf_)
--      public.print_log                  every render, immutable   (plg_)
--
--  Requires PostgreSQL 18+ (uuidv7(), IS JSON, NULLS NOT DISTINCT).
--
--  The printing engine, built so that printing is never controlled by code.
--  A new bill format, a new slip, a different layout for one counter, a
--  different query behind a report — all of it is a row, and none of it is a
--  release. The LAYOUT has always been data, even in 3.0; what was never data
--  is the DATA: which query feeds the layout, and which layout a given till
--  reaches for. §4 and §5 are this migration's real subject.
--
--  These tables live in PUBLIC alongside the rest of the masters this chain
--  keeps there. There is no printing schema. 20260827060000_drop_reports_schema
--  removed the previous generation (reports.print_template, ...), so all seven
--  names below are free.
--
--  ── PROVENANCE, read before trusting §5 §6 §7 ────────────────────────────
--  §0 §1 §2 §3 §4 are transcribed from 17_printing.sql.
--  §5 is transcribed as far as fk_pta_device; everything after that point in
--     §5, and the whole of §6 and §7, is RECONSTRUCTED from what the rest of
--     the file states about them plus the house conventions. Reconcile against
--     17_printing.sql and correct with a follow-up migration if they differ.
--     The specific reconstructions are marked ‹RECONSTRUCTED› below.
--
--  ── Rules the schema cannot enforce, written down instead ────────────────
--  1. STORED SQL IS EXECUTED AS A READ-ONLY ROLE. The ck_ptd_sql_* guards
--     refuse a second statement, a non-SELECT, a DML keyword and 3.0's quoted
--     ':param'. They cannot refuse a cartesian join, a sequential scan of a
--     partitioned fact table, or a volatile function. Those need a role with
--     no write privilege, a statement_timeout, and an EXPLAIN before the row
--     is allowed to save. The CHECK is the floor, not the guarantee.
--  2. PARAMETERS ARE BOUND, NEVER SUBSTITUTED. CONTEXT (:company_id,
--     :branch_id, :acc_year, :doc_id, :user_id, :device_id) is a closed set
--     the server finds by reading the query; USER prompts are declared once,
--     on ptv_params.
--  3. A REPRINT IS NOT A STATUS TRANSITION. print_log is the record of
--     printing; sale_bill.sb_print_count and its siblings stay a denormalised
--     cache of COUNT(*) over it, never the truth.
--  4. THE COPY LABEL IS THE SERVICE LAYER'S. plg_copy_label records what was
--     printed on the paper; deciding that the second print of a tax invoice
--     is a DUPLICATE is a rule about GST, not about this table.
--  5. print_log GROWS WITHOUT BOUND. It is partitioned by accounting year so
--     that retiring a year is a DROP of one partition. Decide the retention
--     period as policy; the schema will not decide it for you.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  §0  fn_create_printing_partitions — one accounting year of partitions.
--
--  print_log is in public, so public.fn_create_year_partitions — which scans
--  public, sales and accounts — WOULD find it. This helper exists anyway
--  because that function is not present on every live database (it is not
--  present on this one). A file that ends in a call to a function that is not
--  there creates every table and then aborts, leaving a partitioned table with
--  no partitions, and the failure surfaces at the first insert of the new
--  year, at a till, in April.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_create_printing_partitions(p_acc_year character(9))
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
    IF p_acc_year !~ '^[0-9]{4}-[0-9]{4}$'
       OR RIGHT(p_acc_year, 4)::int <> LEFT(p_acc_year, 4)::int + 1 THEN
        RAISE EXCEPTION 'acc_year must be YYYY-YYYY with consecutive years, got %', p_acc_year;
    END IF;

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.print_log FOR VALUES IN (%L)',
        'print_log_' || replace(p_acc_year, '-', '_'), p_acc_year);
END
$fn$;

ALTER FUNCTION public.fn_create_printing_partitions(character(9)) OWNER to postgres;


-- ═══════════════════════════════════════════════════════════════════════════
--  §1  print_purpose (ppo_) — WHAT can be printed.
--
--  3.0 kept this list in C++, as an integer typed at ten call sites:
--  PrintUtil(this, 2) meant Session Settlement, PrintUtil(this, 7) meant Dairy
--  Payment, and nothing anywhere said so. It is a table now, and that is the
--  first half of "never controlled by code".
--
--  A purpose is (document type, what you want printed OF it). The same sale
--  bill is a tax invoice, a delivery slip and a godown slip — three purposes,
--  one document.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.print_purpose
(
    ppo_id                   uuid           NOT NULL DEFAULT uuidv7(),
    -- NULL = shipped with the product, visible to every company.
    ppo_company_id           uuid,

    ppo_code                 character varying(40)  NOT NULL,
    ppo_name                 character varying(120) NOT NULL,

    -- The document this prints. Free-form on purpose: a purpose may name a
    -- transaction (SALE_BILL), a master (ITEM_LABEL) or a report
    -- (STOCK_AGEING), and this file must not have an opinion about which
    -- modules will exist.
    ppo_src_module           character varying(20)  NOT NULL DEFAULT 'SALES',
    ppo_doc_type             character varying(40)  NOT NULL,

    -- How many copies the paper normally carries, and what they are called.
    -- A tax invoice is three in India; a delivery slip is one.
    ppo_copy_count           smallint       NOT NULL DEFAULT 1,
    ppo_copy_labels          character varying(120),

    ppo_allow_reprint        boolean        NOT NULL DEFAULT true,

    ppo_sort_order           smallint       NOT NULL DEFAULT 100,
    ppo_notes                text,

    ppo_is_active            boolean        NOT NULL DEFAULT true,
    ppo_is_deleted           boolean        NOT NULL DEFAULT false,
    ppo_sync_date            timestamp with time zone,
    ppo_created_on           timestamp with time zone NOT NULL DEFAULT now(),
    ppo_created_by           uuid,
    ppo_modified_on          timestamp with time zone,
    ppo_modified_by          uuid,

    CONSTRAINT pk_print_purpose PRIMARY KEY (ppo_id),

    CONSTRAINT fk_ppo_company FOREIGN KEY (ppo_company_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ppo_created_by FOREIGN KEY (ppo_created_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ppo_modified_by FOREIGN KEY (ppo_modified_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_ppo_code_shape CHECK (ppo_code ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT ck_ppo_src_module CHECK (
        ppo_src_module::text = ANY (ARRAY['SALES'::text, 'PURCHASE'::text,
            'INVENTORY'::text, 'ACCOUNTS'::text, 'STOCK'::text,
            'LOYALTY'::text, 'REPORT'::text, 'OTHER'::text])),
    CONSTRAINT ck_ppo_copies CHECK (ppo_copy_count BETWEEN 1 AND 9),
    CONSTRAINT ck_ppo_sort CHECK (ppo_sort_order >= 0)
);

ALTER TABLE IF EXISTS public.print_purpose OWNER to postgres;

-- One code per company. NULLS NOT DISTINCT dedupes the SHIPPED set against
-- itself; a shipped SALE_INVOICE and a company's own SALE_INVOICE still
-- coexist, which is what makes forking (§2) possible.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ppo_code
    ON public.print_purpose USING btree (ppo_company_id, lower(ppo_code::text))
    NULLS NOT DISTINCT
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ppo_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_ppo_doc
    ON public.print_purpose USING btree (ppo_src_module, ppo_doc_type, ppo_sort_order)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ppo_is_deleted = false AND ppo_is_active = true;

CREATE INDEX IF NOT EXISTS ix_ppo_company
    ON public.print_purpose USING btree (ppo_company_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ppo_company_id IS NOT NULL AND ppo_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_ppo_created_by
    ON public.print_purpose USING btree (ppo_created_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ppo_created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_ppo_modified_by
    ON public.print_purpose USING btree (ppo_modified_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ppo_modified_by IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  §2  print_template (ptl_) — the design's IDENTITY, and nothing else.
--
--  A name, an owner and a pointer to the revision that is currently published.
--  Everything editable — the body, the page, the datasets — lives in §3 and §4,
--  because it is versioned and this row is not.
--
--  No branch. No counter. No is_default. Every one of those is a RESOLUTION
--  question and lives in §5. Two places to say which design wins is one place
--  too many.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.print_template
(
    ptl_id                   uuid           NOT NULL DEFAULT uuidv7(),
    -- NULL = shipped with the product. The only scope column here.
    ptl_company_id           uuid,

    ptl_purpose_id           uuid           NOT NULL,
    ptl_code                 character varying(60)  NOT NULL,
    ptl_name                 character varying(120) NOT NULL,
    ptl_description          text,

    -- The revision a render actually uses. NULL until something is published,
    -- so a template with only a draft simply does not resolve. Circular with
    -- ptv_template_id, so the FK is added by the ALTER at the end of §3.
    ptl_published_rev_id     uuid,

    ptl_forked_from_id       uuid,
    ptl_forked_from_rev      integer,

    ptl_sort_order           smallint       NOT NULL DEFAULT 100,

    -- GENERATED: the owner with NULL folded to the nil uuid, so that a
    -- composite foreign key can point at (id, owner).
    --
    -- It exists because MATCH SIMPLE treats a composite key as satisfied the
    -- moment ANY of its columns is NULL. A key pointing at (ptl_id,
    -- ptl_company_id) would therefore stop checking anything at all for a
    -- shipped design -- exactly the case the check is FOR.
    ptl_company_key          uuid GENERATED ALWAYS AS (
        COALESCE(ptl_company_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,

    ptl_is_active            boolean        NOT NULL DEFAULT true,
    ptl_is_deleted           boolean        NOT NULL DEFAULT false,
    ptl_sync_date            timestamp with time zone,
    ptl_created_on           timestamp with time zone NOT NULL DEFAULT now(),
    ptl_created_by           uuid,
    ptl_modified_on          timestamp with time zone,
    ptl_modified_by          uuid,

    CONSTRAINT pk_print_template PRIMARY KEY (ptl_id),

    CONSTRAINT fk_ptl_company FOREIGN KEY (ptl_company_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ptl_purpose FOREIGN KEY (ptl_purpose_id)
        REFERENCES public.print_purpose (ppo_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ptl_forked_from FOREIGN KEY (ptl_forked_from_id)
        REFERENCES public.print_template (ptl_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ptl_created_by FOREIGN KEY (ptl_created_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ptl_modified_by FOREIGN KEY (ptl_modified_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_ptl_code_shape CHECK (ptl_code ~ '^[A-Za-z0-9_-]+$'),
    CONSTRAINT ck_ptl_not_own_fork CHECK (ptl_forked_from_id IS DISTINCT FROM ptl_id),
    CONSTRAINT ck_ptl_fork_pair CHECK (
        (ptl_forked_from_id IS NULL) = (ptl_forked_from_rev IS NULL)),
    CONSTRAINT ck_ptl_sort CHECK (ptl_sort_order >= 0)
);

ALTER TABLE IF EXISTS public.print_template OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_ptl_code
    ON public.print_template USING btree (ptl_company_id, lower(ptl_code::text))
    NULLS NOT DISTINCT
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptl_is_deleted = false;

-- The target of §5's composite fk_pta_template. ptl_id alone is already the
-- primary key, so this index constrains nothing new; it exists so that a
-- foreign key can name (id, owner) as a pair.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ptl_id_company_key
    ON public.print_template USING btree (ptl_id, ptl_company_key)
    WITH (fillfactor=100, deduplicate_items=True);

-- "What can this company print for this purpose" — the Print-in-format list.
CREATE INDEX IF NOT EXISTS ix_ptl_purpose
    ON public.print_template USING btree (ptl_purpose_id, ptl_company_id, ptl_sort_order)
    INCLUDE (ptl_code, ptl_name, ptl_published_rev_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptl_is_active = true AND ptl_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_ptl_company
    ON public.print_template USING btree (ptl_company_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptl_company_id IS NOT NULL AND ptl_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_ptl_forked_from
    ON public.print_template USING btree (ptl_forked_from_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptl_forked_from_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_ptl_published_rev
    ON public.print_template USING btree (ptl_published_rev_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptl_published_rev_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_ptl_created_by
    ON public.print_template USING btree (ptl_created_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptl_created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_ptl_modified_by
    ON public.print_template USING btree (ptl_modified_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptl_modified_by IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  §3  print_template_version (ptv_) — the design itself, frozen once published.
--
--  THE BODY LIVES HERE, not on the template:
--    * print_log.plg_version_id is a real FOREIGN KEY to the exact bytes that
--      were rendered.
--    * Publishing and rolling back are a POINTER MOVE on ptl_published_rev_id
--      — one row, atomic. Rollback writes FORWARD, so history is append-only.
--    * A render in flight cannot see a half-saved template, because a
--      published version is never UPDATEd.
--
--  ptv_engine declares what ptv_body IS. 3.0 had no such column, so moving off
--  QtRPT would have been a flag day for every customer at once.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.print_template_version
(
    ptv_id                   uuid           NOT NULL DEFAULT uuidv7(),
    ptv_template_id          uuid           NOT NULL,
    ptv_rev_no               integer        NOT NULL,

    ptv_status               character varying(15) NOT NULL DEFAULT 'DRAFT',

    -- ── What the body IS ─────────────────────────────────────────────────
    ptv_engine               character varying(20) NOT NULL DEFAULT 'JSON_BANDS',
    ptv_body                 text           NOT NULL,
    ptv_schema_ver           integer        NOT NULL DEFAULT 1,

    -- ── The page ─────────────────────────────────────────────────────────
    -- Authoritative here, unlike 3.0 where pstyl_size sat beside an XML that
    -- actually decided. The renderer reads these; printer_profile asserts
    -- compatibility against them (§6).
    ptv_paper_code           character varying(20) NOT NULL DEFAULT 'A4',
    ptv_orientation          character varying(10) NOT NULL DEFAULT 'PORTRAIT',
    ptv_width_mm             numeric(8,2),
    ptv_height_mm            numeric(8,2),
    ptv_margin_top_mm        numeric(6,2)   NOT NULL DEFAULT 0,
    ptv_margin_bottom_mm     numeric(6,2)   NOT NULL DEFAULT 0,
    ptv_margin_left_mm       numeric(6,2)   NOT NULL DEFAULT 0,
    ptv_margin_right_mm      numeric(6,2)   NOT NULL DEFAULT 0,
    -- Characters per line for the text engines. Meaningless for a page one.
    ptv_columns              smallint,

    -- ── Language ─────────────────────────────────────────────────────────
    -- The DEFAULT, not a resolution key. Language must never fork a template
    -- the way pstyl_platform forked every one of 3.0's.
    ptv_lang                 character varying(5)  NOT NULL DEFAULT 'en-IN',
    ptv_font_family          character varying(80),

    -- ── What the OPERATOR is asked, once, for the whole render ───────────
    --   [{"name":"from_date","type":"DATE","required":true,
    --     "label":"From date"}]
    --
    -- ON THE VERSION, not on the dataset. The operator is asked ONCE -- if
    -- dataset 1 declared from_date as DATE required and dataset 3 declared it
    -- as TEXT optional there is no answer to what the screen should ask -- and
    -- print_log.plg_params is one jsonb object per render, not one per
    -- dataset.
    --
    -- CONTEXT PARAMETERS ARE NOT DECLARED ANYWHERE. :company_id, :branch_id,
    -- :acc_year, :doc_id, :user_id, :device_id are a closed set, and the
    -- server finds which of them a query uses by reading the query -- exactly
    -- as ck_ptd_sql_company_scoped already reads ptd_sql_norm for :company_id.
    ptv_params               jsonb,

    -- There is deliberately no sample-document pointer here. Which bill a
    -- designer previews against is a property of the EDITING SESSION, not of
    -- the published design.
    ptv_note                 character varying(250),

    ptv_approved_on          timestamp with time zone,
    ptv_approved_by          uuid,

    ptv_is_deleted           boolean        NOT NULL DEFAULT false,
    ptv_sync_date            timestamp with time zone,
    ptv_created_on           timestamp with time zone NOT NULL DEFAULT now(),
    ptv_created_by           uuid,
    ptv_modified_on          timestamp with time zone,
    ptv_modified_by          uuid,

    CONSTRAINT pk_print_template_version PRIMARY KEY (ptv_id),

    -- A child of its own template: CASCADE, per the house FK policy.
    CONSTRAINT fk_ptv_template FOREIGN KEY (ptv_template_id)
        REFERENCES public.print_template (ptl_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_ptv_approved_by FOREIGN KEY (ptv_approved_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ptv_created_by FOREIGN KEY (ptv_created_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ptv_modified_by FOREIGN KEY (ptv_modified_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_ptv_status CHECK (ptv_status::text = ANY (
        ARRAY['DRAFT'::text, 'PUBLISHED'::text, 'RETIRED'::text])),
    CONSTRAINT ck_ptv_engine CHECK (ptv_engine::text = ANY (ARRAY[
        'JSON_BANDS'::text, 'HTML_CSS'::text, 'QTRPT_XML'::text,
        'ESCPOS_TEXT'::text, 'RAW'::text])),
    -- A JSON_BANDS body must actually be a JSON object. PostgreSQL 16+ gives
    -- this as a predicate, so no cast that throws and no helper function.
    CONSTRAINT ck_ptv_body_is_json CHECK (
        ptv_engine::text <> 'JSON_BANDS' OR ptv_body IS JSON OBJECT),
    CONSTRAINT ck_ptv_body_size CHECK (char_length(ptv_body) BETWEEN 1 AND 4000000),
    CONSTRAINT ck_ptv_rev_no CHECK (ptv_rev_no > 0),
    CONSTRAINT ck_ptv_orientation CHECK (ptv_orientation::text = ANY (
        ARRAY['PORTRAIT'::text, 'LANDSCAPE'::text])),
    CONSTRAINT ck_ptv_geometry CHECK (
        (ptv_width_mm  IS NULL OR ptv_width_mm  > 0)
    AND (ptv_height_mm IS NULL OR ptv_height_mm > 0)
    AND ptv_margin_top_mm >= 0 AND ptv_margin_bottom_mm >= 0
    AND ptv_margin_left_mm >= 0 AND ptv_margin_right_mm >= 0
    AND (ptv_columns IS NULL OR ptv_columns BETWEEN 20 AND 250)),
    -- Publishing needs a signature, exactly as ck_prm_approved requires one
    -- before a promotion may give money away.
    CONSTRAINT ck_ptv_published CHECK (
        ptv_status::text <> 'PUBLISHED' OR ptv_approved_by IS NOT NULL),
    CONSTRAINT ck_ptv_lang_shape CHECK (ptv_lang ~ '^[a-z]{2}(-[A-Z]{2})?$'),
    CONSTRAINT ck_ptv_params_is_array CHECK (
        ptv_params IS NULL OR jsonb_typeof(ptv_params) = 'array')
);

ALTER TABLE IF EXISTS public.print_template_version OWNER to postgres;

-- Version numbers are dense and unique per template. Rollback writes forward,
-- so this is never reused and the history cannot be rewritten.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ptv_template_rev
    ON public.print_template_version USING btree (ptv_template_id, ptv_rev_no)
    WITH (fillfactor=100, deduplicate_items=True);

CREATE INDEX IF NOT EXISTS ix_ptv_template_recent
    ON public.print_template_version USING btree (ptv_template_id, ptv_rev_no DESC)
    INCLUDE (ptv_status, ptv_engine, ptv_paper_code)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptv_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_ptv_approved_by
    ON public.print_template_version USING btree (ptv_approved_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptv_approved_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_ptv_created_by
    ON public.print_template_version USING btree (ptv_created_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptv_created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_ptv_modified_by
    ON public.print_template_version USING btree (ptv_modified_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptv_modified_by IS NOT NULL;

-- The circular half: print_template points at the version it publishes. Added
-- here because neither table can be created with a foreign key to the other.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ptl_published_rev') THEN
        ALTER TABLE public.print_template
            ADD CONSTRAINT fk_ptl_published_rev FOREIGN KEY (ptl_published_rev_id)
                REFERENCES public.print_template_version (ptv_id) MATCH SIMPLE
                ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
--  §4  print_template_dataset (ptd_) — where the rows come from.
--
--  This section and §5 are the whole point of the file. A layout has been data
--  since 3.0; what was never data is WHICH QUERY feeds it.
--
--  It hangs off the VERSION, not the template. If it hung off the template,
--  editing a query would silently change what every past version rendered, and
--  it would make print_log's version reference a lie.
--
--  THE 3.0 FIX, in two columns:
--      ptd_dataset_no   THE BINDING. The body's bands reference this number.
--      ptd_sort_order   Display order in the designer. Binds nothing.
--  pssql_slno was both jobs at once, so reordering the rows in the editor
--  silently rebound every band to the wrong query.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.print_template_dataset
(
    ptd_id                   uuid           NOT NULL DEFAULT uuidv7(),
    ptd_version_id           uuid           NOT NULL,

    -- MASTER: exactly one, the header context, one row read. 3.0's pstyl_sql.
    -- DETAIL: the repeating bands. 3.0's printing_style_sql rows.
    ptd_role                 character varying(10) NOT NULL DEFAULT 'DETAIL',

    ptd_dataset_no           smallint       NOT NULL,   -- THE BINDING
    ptd_sort_order           smallint       NOT NULL DEFAULT 0,
    ptd_name                 character varying(40) NOT NULL,
    ptd_label                character varying(120),

    ptd_source_kind          character varying(10) NOT NULL DEFAULT 'PROVIDER',
    ptd_provider_code        character varying(80),
    ptd_sql                  text,

    -- ── The normalised query, for the guards below ───────────────────────
    -- Comments removed, string literals and quoted identifiers replaced by
    -- tokens, casts flattened, lowercased. EVERY guard reads this and not
    -- ptd_sql, so a keyword inside a literal is neither a false positive nor
    -- a way through.
    --
    -- Comments are stripped BEFORE literals deliberately: a stray quote in a
    -- comment would otherwise mispair the literal scanner. The reverse case,
    -- a '--' inside a literal, mangles the residue -- which can only FAIL a
    -- good query, never pass a bad one. Failing closed is the right direction.
    ptd_sql_norm             text GENERATED ALWAYS AS (
        lower(
          regexp_replace(                                        -- 5. casts
            regexp_replace(                                      -- 4. "ident"
              regexp_replace(                                    -- 3. 'literal'
                regexp_replace(                                  -- 2. -- to EOL
                  regexp_replace(COALESCE(ptd_sql, ''),          -- 1. /* block */
                    '/\*.*?\*/', ' ', 'g'),
                  '--.*$', ' ', 'gn'),
                '''(?:[^'']|'''')*''', ' @lit ', 'g'),
              '"[^"]*"', ' @id ', 'g'),
            '::', ' ', 'g'))) STORED,

    -- A report that is not company-scoped shows one company another's numbers.
    ptd_requires_company     boolean        NOT NULL DEFAULT true,

    -- ── Nested detail, which 3.0 could not express at all ────────────────
    -- ptd_link_fields says HOW they match, as parent=child pairs, comma
    -- separated for a composite:
    --     sbi_id=line_id                 one key
    --     sb_id=bill_id,sbi_slno=slno    two
    -- LEFT of the = is a column the PARENT dataset returns; RIGHT is a column
    -- THIS dataset returns. Both are output columns.
    --
    --   THE CHILD QUERY RUNS ONCE FOR THE WHOLE RENDER, NOT ONCE PER PARENT
    --   ROW. It is bound with the same context every other dataset gets,
    --   returns the parent's key as an ordinary column, and the RENDERER
    --   groups on it. A 14-line bill costs one query, not fifteen.
    --
    -- Written down because the alternative reading is the natural one and it
    -- is wrong twice over: it is N+1 against partitioned tables, and it makes
    -- ptd_row_limit and ptd_timeout_ms measure a single child execution
    -- instead of the whole band.
    ptd_parent_no            smallint,
    ptd_link_fields          character varying(200),

    ptd_row_limit            integer        NOT NULL DEFAULT 5000,
    ptd_timeout_ms           integer        NOT NULL DEFAULT 15000,

    ptd_remarks              character varying(250),
    ptd_is_deleted           boolean        NOT NULL DEFAULT false,
    ptd_sync_date            timestamp with time zone,
    ptd_created_on           timestamp with time zone NOT NULL DEFAULT now(),
    ptd_created_by           uuid,
    ptd_modified_on          timestamp with time zone,
    ptd_modified_by          uuid,

    CONSTRAINT pk_print_template_dataset PRIMARY KEY (ptd_id),

    -- A child of its own version: CASCADE, per the house FK policy.
    CONSTRAINT fk_ptd_version FOREIGN KEY (ptd_version_id)
        REFERENCES public.print_template_version (ptv_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_ptd_created_by FOREIGN KEY (ptd_created_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_ptd_modified_by FOREIGN KEY (ptd_modified_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_ptd_role CHECK (ptd_role::text = ANY (
        ARRAY['MASTER'::text, 'DETAIL'::text])),
    CONSTRAINT ck_ptd_source_kind CHECK (ptd_source_kind::text = ANY (
        ARRAY['PROVIDER'::text, 'SQL'::text])),

    -- Two biconditionals. Together they already forbid both-set and
    -- neither-set, so no third constraint is needed.
    CONSTRAINT ck_ptd_source_biconditional CHECK (
        (ptd_source_kind::text = 'PROVIDER') = (ptd_provider_code IS NOT NULL)
    AND (ptd_source_kind::text = 'SQL')      = (ptd_sql           IS NOT NULL)),

    -- THE 3.0 FIX. The master is dataset 0, and nothing else is.
    CONSTRAINT ck_ptd_master_is_zero CHECK (
        (ptd_role::text = 'MASTER') = (ptd_dataset_no = 0)),
    CONSTRAINT ck_ptd_dataset_no CHECK (ptd_dataset_no BETWEEN 0 AND 99),
    CONSTRAINT ck_ptd_name_shape CHECK (ptd_name ~ '^[a-z][a-z0-9_]*$'),
    CONSTRAINT ck_ptd_provider_shape CHECK (
        ptd_provider_code IS NULL
        OR ptd_provider_code ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),

    CONSTRAINT ck_ptd_parent CHECK (
        ptd_parent_no IS NULL
        OR (ptd_parent_no <> ptd_dataset_no AND ptd_role::text <> 'MASTER')),
    CONSTRAINT ck_ptd_parent_pair CHECK (
        (ptd_parent_no IS NULL) = (ptd_link_fields IS NULL)),
    -- parent=child, comma separated, no spaces. Same identifier shape as
    -- ck_ptd_name_shape, because both sides name a column of a result set. A
    -- format nothing enforces is a format that drifts between the designer,
    -- the renderer and whoever writes the next engine.
    CONSTRAINT ck_ptd_link_fields_shape CHECK (
        ptd_link_fields IS NULL
        OR ptd_link_fields ~ '^[a-z][a-z0-9_]*=[a-z][a-z0-9_]*(,[a-z][a-z0-9_]*=[a-z][a-z0-9_]*)*$'),

    CONSTRAINT ck_ptd_limits CHECK (
        ptd_row_limit BETWEEN 1 AND 200000
    AND ptd_timeout_ms BETWEEN 100 AND 120000),

    -- ══ Stored-SQL guards ════════════════════════════════════════════════
    -- READ THIS BEFORE TRUSTING THEM. These are an AUTHORING LINT, so that a
    -- template author gets a clear refusal when they save rather than a
    -- mystery when a customer prints. They are NOT the security boundary.
    -- The boundary is three runtime facts, stated as rule 1 in the header:
    -- parameters bound over the extended protocol (which makes a second
    -- statement structurally impossible, not merely filtered), the query run
    -- in a READ ONLY transaction, and a role with no write privilege. A CHECK
    -- cannot parse SQL and never will.
    --
    -- Every one of these is a no-op for a PROVIDER dataset.

    -- Nothing may survive the normaliser. A quote left in the residue means
    -- the scanner mispaired something, so refuse rather than guess.
    CONSTRAINT ck_ptd_sql_normalised CHECK (
        ptd_source_kind::text <> 'SQL'
        OR (ptd_sql_norm !~ '''' AND ptd_sql_norm !~ '"')),

    -- Dollar quoting defeats the literal scanner outright, and PostgreSQL
    -- allows NESTED block comments which a non-greedy strip mishandles.
    CONSTRAINT ck_ptd_sql_no_dollar_quote CHECK (
        ptd_source_kind::text <> 'SQL' OR ptd_sql !~ '\$[A-Za-z_0-9]*\$'),
    CONSTRAINT ck_ptd_sql_no_residual_comment CHECK (
        ptd_source_kind::text <> 'SQL' OR ptd_sql_norm !~ '/\*|\*/'),

    -- ONE statement. Literals are already tokens by now, so a semicolon inside
    -- a string cannot reach this. A single trailing ; is allowed.
    CONSTRAINT ck_ptd_sql_single_statement CHECK (
        ptd_source_kind::text <> 'SQL'
        OR regexp_replace(ptd_sql_norm, '\s*;\s*$', '') !~ ';'),

    -- SELECT or WITH only. A leading ( allows (SELECT …) UNION (SELECT …).
    CONSTRAINT ck_ptd_sql_read_only_start CHECK (
        ptd_source_kind::text <> 'SQL'
        OR btrim(ptd_sql_norm) ~ '^\(*\s*(select|with)\y'),

    -- With one-statement and SELECT-only already enforced, the only remaining
    -- way to write is a data-modifying CTE. The list is short on purpose: a
    -- long blacklist is a false-positive machine, and every false refusal
    -- teaches somebody to work around the guard.
    CONSTRAINT ck_ptd_sql_no_write CHECK (
        ptd_source_kind::text <> 'SQL'
        OR ptd_sql_norm !~ '\y(insert|update|delete|merge|truncate|copy|grant|revoke)\y'),

    -- Server-side escapes into the filesystem, the network and the catalog.
    -- A blacklist, and blacklists lose; this exists to make the common mistake
    -- loud. The read-only role is what makes it not matter.
    CONSTRAINT ck_ptd_sql_no_escape CHECK (
        ptd_source_kind::text <> 'SQL'
        OR ptd_sql_norm !~ '\y(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|dblink|dblink_exec|pg_sleep|pg_terminate_backend|pg_cancel_backend|set_config|current_setting|pg_authid|pg_shadow)\y'),

    -- Parameters are :name and nothing else. Known false positive, accepted:
    -- an array slice arr[2:5].
    CONSTRAINT ck_ptd_sql_param_shape CHECK (
        ptd_source_kind::text <> 'SQL' OR ptd_sql_norm !~ ':(?![a-z_])'),

    -- THE 3.0 BUG, named. Its stored SQL contained ':iacc_year' WITH the
    -- quotes inside the SQL, because parameters were a string replace rather
    -- than a binding.
    --
    -- Stated as a COUNT rather than a pattern, deliberately. The obvious regex
    -- -- a quote, then anything, then :name -- also matches a perfectly good
    -- query that merely has a literal somewhere BEFORE a real parameter:
    --     SELECT a FROM t WHERE note = 'last updated' AND x = :company_id
    -- The count is exact instead: normalisation replaces every literal and
    -- comment with a token, so any :name present in the raw text but ABSENT
    -- from ptd_sql_norm was inside one.
    --
    -- KNOWN FALSE POSITIVE, verified: a :name inside a '--' comment also trips
    -- this, and the error names literals. The service layer should say so.
    CONSTRAINT ck_ptd_sql_no_quoted_param CHECK (
        ptd_source_kind::text <> 'SQL'
        OR regexp_count(replace(ptd_sql, '::', ' '), ':[A-Za-z_]')
         = regexp_count(ptd_sql_norm, ':[A-Za-z_]')),

    -- THE CHECK 3.0 MOST NEEDED AND NOBODY WROTE. In a chain, a query that is
    -- not company-scoped shows one company another company's numbers.
    CONSTRAINT ck_ptd_sql_company_scoped CHECK (
        ptd_source_kind::text <> 'SQL' OR ptd_requires_company = false
        OR ptd_sql_norm ~ ':company_id\y'),

    CONSTRAINT ck_ptd_sql_size CHECK (
        ptd_source_kind::text <> 'SQL'
        OR char_length(ptd_sql) BETWEEN 20 AND 20000)
);

ALTER TABLE IF EXISTS public.print_template_dataset OWNER to postgres;

-- The binding is unique per version. This is what a band actually points at.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ptd_dataset_no
    ON public.print_template_dataset USING btree (ptd_version_id, ptd_dataset_no)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptd_is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS ux_ptd_name
    ON public.print_template_dataset USING btree (ptd_version_id, ptd_name)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptd_is_deleted = false;

-- Exactly one master per version. ck_ptd_master_is_zero with ux_ptd_dataset_no
-- would nearly do it; this states it in the shape the error message needs.
CREATE UNIQUE INDEX IF NOT EXISTS ux_ptd_one_master
    ON public.print_template_dataset USING btree (ptd_version_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptd_role::text = 'MASTER' AND ptd_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_ptd_version
    ON public.print_template_dataset USING btree (ptd_version_id, ptd_sort_order)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptd_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_ptd_created_by
    ON public.print_template_dataset USING btree (ptd_created_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptd_created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_ptd_modified_by
    ON public.print_template_dataset USING btree (ptd_modified_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE ptd_modified_by IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  §5  print_template_assignment (pta_) — WHICH design wins, and WHERE.
--
--  ‹PARTLY RECONSTRUCTED› The column list and the first four foreign keys are
--  transcribed. Everything from fk_pta_purpose onward -- the remaining keys,
--  the CHECKs and every index -- is reconstructed from the section's own prose
--  plus the house conventions. See the PROVENANCE note at the top.
--
--  ── There is deliberately no is_default column ───────────────────────────
--  Default-ness is the ROW'S EXISTENCE. A pta_ row is the choice for one
--  scope; templates that are merely available are ptl_ rows matching the
--  purpose, which is what the "print in format" list shows.
--
--  That removes three defects at once:
--    * "exactly one default" becomes a plain unique index on the scope key,
--      with no flag anyone can forget to clear.
--    * THERE IS NO CLEAR STEP. Changing the default is an UPDATE of ONE row.
--      3.0's clear-then-set was scope-unaware, so on a mixed site setting the
--      Windows default silently unset the Linux one.
--    * A partial unique index on a boolean cannot be DEFERRED, so flipping two
--      rows in one UPDATE can fail on row order alone. With no boolean there
--      is no swap to get wrong.
--
--  Narrowest wins: counter -> branch -> company, via pta_specificity.
--  PAPER IS NOT IN THE KEY. Output mode is: a 3-inch thermal receipt genuinely
--  is a different artifact from an A4 tax invoice.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.print_template_assignment
(
    pta_id                   uuid           NOT NULL DEFAULT uuidv7(),
    pta_company_id           uuid           NOT NULL,
    pta_branch_id            uuid,                       -- NULL = every branch
    pta_device_id            uuid,                       -- NULL = every counter

    pta_purpose_id           uuid           NOT NULL,
    pta_template_id          uuid           NOT NULL,
    pta_output_mode          character varying(15) NOT NULL DEFAULT 'PRINT',

    -- Where the paper comes out for this scope. NULL = the server's default
    -- queue for the device.
    pta_printer_id           uuid,
    -- Overrides the purpose's copy count for this scope. NULL = use it.
    pta_copies               smallint,

    -- Specificity, DERIVED not typed: 0 company, 1 branch, 2 counter.
    --
    -- A single CASE rather than added weights. The obvious version -- device 4
    -- plus branch 2 -- makes a counter row score SIX, because a counter row
    -- must also name its branch (ck_pta_device_needs_branch). Anything reading
    -- the value back then has to know that 6, not 4, means counter.
    pta_specificity          smallint GENERATED ALWAYS AS (
        CASE WHEN pta_device_id IS NOT NULL THEN 2
             WHEN pta_branch_id IS NOT NULL THEN 1
             ELSE 0 END) STORED,

    pta_remarks              character varying(250),
    pta_is_active            boolean        NOT NULL DEFAULT true,
    pta_is_deleted           boolean        NOT NULL DEFAULT false,
    pta_sync_date            timestamp with time zone,
    pta_created_on           timestamp with time zone NOT NULL DEFAULT now(),
    pta_created_by           uuid,
    pta_modified_on          timestamp with time zone,
    pta_modified_by          uuid,

    CONSTRAINT pk_print_template_assignment PRIMARY KEY (pta_id),

    CONSTRAINT fk_pta_company FOREIGN KEY (pta_company_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pta_branch FOREIGN KEY (pta_branch_id)
        REFERENCES public.branch_master (br_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pta_device FOREIGN KEY (pta_device_id)
        REFERENCES fixed.device_master (dev_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    -- ‹RECONSTRUCTED from here to the end of the table› ───────────────────
    CONSTRAINT fk_pta_purpose FOREIGN KEY (pta_purpose_id)
        REFERENCES public.print_purpose (ppo_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    -- SIMPLE, not composite. §2 creates ux_ptl_id_company_key expressly so
    -- that this key can be (pta_template_id, <owner>) REFERENCES
    -- print_template (ptl_id, ptl_company_key) -- the constraint that stops a
    -- company assigning another company's private template. The pta_ side of
    -- that pair is in the part of §5 that has not reached me, so the simple
    -- key is used here and the composite one is a follow-up migration.
    CONSTRAINT fk_pta_template FOREIGN KEY (pta_template_id)
        REFERENCES public.print_template (ptl_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    -- fk_pta_printer is NOT declared here: printer_profile is created by §6,
    -- below. It is added by the guarded ALTER at the end of §6, the same shape
    -- fk_ptl_published_rev uses for the same reason.
    CONSTRAINT fk_pta_created_by FOREIGN KEY (pta_created_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pta_modified_by FOREIGN KEY (pta_modified_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_pta_output_mode CHECK (pta_output_mode::text = ANY (
        ARRAY['PRINT'::text, 'PREVIEW'::text, 'EMAIL'::text, 'FILE'::text])),
    -- A counter row must also name its branch, which is why pta_specificity is
    -- a CASE and not a sum of weights.
    CONSTRAINT ck_pta_device_needs_branch CHECK (
        pta_device_id IS NULL OR pta_branch_id IS NOT NULL),
    CONSTRAINT ck_pta_copies CHECK (
        pta_copies IS NULL OR pta_copies BETWEEN 1 AND 9)
);

ALTER TABLE IF EXISTS public.print_template_assignment OWNER to postgres;

-- ‹RECONSTRUCTED› "Exactly one default per scope", as an index rather than as
-- care. NULLS NOT DISTINCT is what makes the company-wide row (branch and
-- device NULL) collide with itself rather than multiply.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pta_scope
    ON public.print_template_assignment USING btree
        (pta_company_id, pta_branch_id, pta_device_id, pta_purpose_id, pta_output_mode)
    NULLS NOT DISTINCT
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_is_deleted = false;

-- ‹RECONSTRUCTED› The render-time resolver: narrowest wins.
CREATE INDEX IF NOT EXISTS ix_pta_resolve
    ON public.print_template_assignment USING btree
        (pta_company_id, pta_purpose_id, pta_output_mode, pta_specificity DESC)
    INCLUDE (pta_branch_id, pta_device_id, pta_template_id, pta_printer_id, pta_copies)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_is_active = true AND pta_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_pta_company
    ON public.print_template_assignment USING btree (pta_company_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_pta_branch
    ON public.print_template_assignment USING btree (pta_branch_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_branch_id IS NOT NULL AND pta_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_pta_device
    ON public.print_template_assignment USING btree (pta_device_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_device_id IS NOT NULL AND pta_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_pta_purpose
    ON public.print_template_assignment USING btree (pta_purpose_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_pta_template
    ON public.print_template_assignment USING btree (pta_template_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_pta_printer
    ON public.print_template_assignment USING btree (pta_printer_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_printer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_pta_created_by
    ON public.print_template_assignment USING btree (pta_created_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_pta_modified_by
    ON public.print_template_assignment USING btree (pta_modified_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_modified_by IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  §6  printer_profile (prf_) — the physical device.
--
--  ‹RECONSTRUCTED IN FULL› §6 of 17_printing.sql has not reached me. What is
--  load-bearing and taken from the rest of the file:
--    * prefix prf_, table public.printer_profile
--    * a foreign key to fixed.device_master(dev_id) -- "the counter, and its
--      printer"
--    * it "asserts compatibility against" §3's page geometry, so it carries a
--      paper code and dimensions of its own to assert with
--    * the full audit block, _is_active included, because it is a master
--    * NO is_default boolean. §5 owns that question, and this file is emphatic
--      that a second place to say which one wins is one place too many.
--  The connection and capability block below is inference. Reconcile it.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.printer_profile
(
    prf_id                   uuid           NOT NULL DEFAULT uuidv7(),
    prf_company_id           uuid           NOT NULL,
    prf_branch_id            uuid,                       -- NULL = every branch
    -- The counter this printer hangs off. NULL = a shared server-side queue.
    prf_device_id            uuid,

    prf_code                 character varying(40)  NOT NULL,
    prf_name                 character varying(120) NOT NULL,

    -- ── How the server reaches it ────────────────────────────────────────
    prf_conn_kind            character varying(15)  NOT NULL DEFAULT 'CUPS',
    -- The OS print queue, share name, or device path.
    prf_queue_name           character varying(120),
    prf_host                 character varying(120),
    prf_port                 integer,

    -- ── What it understands ──────────────────────────────────────────────
    -- ptv_engine says what a template body IS; this says what the hardware can
    -- consume. The renderer is what reconciles the two.
    prf_emulation            character varying(20)  NOT NULL DEFAULT 'ESCPOS',
    prf_codepage             character varying(20),

    -- ── The paper actually loaded ────────────────────────────────────────
    -- Asserted against ptv_paper_code / ptv_width_mm / ptv_columns at render
    -- time. This is the check §5 deliberately does NOT put in the assignment
    -- key: paper is a property of the version and of the device, never a
    -- resolution axis.
    prf_paper_code           character varying(20)  NOT NULL DEFAULT 'A4',
    prf_width_mm             numeric(8,2),
    prf_height_mm            numeric(8,2),
    -- Characters per line. The text-engine counterpart of ptv_columns.
    prf_columns              smallint,
    prf_dpi                  smallint,

    -- ── Capabilities ─────────────────────────────────────────────────────
    prf_supports_cut         boolean        NOT NULL DEFAULT false,
    prf_supports_drawer      boolean        NOT NULL DEFAULT false,
    prf_supports_color       boolean        NOT NULL DEFAULT false,
    -- Raw escape sequences, hex or the printer's own notation.
    prf_init_sequence        text,
    prf_cut_sequence         text,

    prf_sort_order           smallint       NOT NULL DEFAULT 100,
    prf_remarks              character varying(250),

    prf_is_active            boolean        NOT NULL DEFAULT true,
    prf_is_deleted           boolean        NOT NULL DEFAULT false,
    prf_sync_date            timestamp with time zone,
    prf_created_on           timestamp with time zone NOT NULL DEFAULT now(),
    prf_created_by           uuid,
    prf_modified_on          timestamp with time zone,
    prf_modified_by          uuid,

    CONSTRAINT pk_printer_profile PRIMARY KEY (prf_id),

    CONSTRAINT fk_prf_company FOREIGN KEY (prf_company_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_prf_branch FOREIGN KEY (prf_branch_id)
        REFERENCES public.branch_master (br_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_prf_device FOREIGN KEY (prf_device_id)
        REFERENCES fixed.device_master (dev_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_prf_created_by FOREIGN KEY (prf_created_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_prf_modified_by FOREIGN KEY (prf_modified_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_prf_code_shape CHECK (prf_code ~ '^[A-Za-z0-9_-]+$'),
    CONSTRAINT ck_prf_conn_kind CHECK (prf_conn_kind::text = ANY (ARRAY[
        'LOCAL'::text, 'NETWORK'::text, 'CUPS'::text, 'WINDOWS'::text,
        'RAW_TCP'::text, 'FILE'::text])),
    CONSTRAINT ck_prf_emulation CHECK (prf_emulation::text = ANY (ARRAY[
        'ESCPOS'::text, 'ESCP2'::text, 'PCL'::text, 'PDF'::text, 'RAW'::text])),
    -- A network printer needs somewhere to go.
    CONSTRAINT ck_prf_network_pair CHECK (
        prf_conn_kind::text NOT IN ('NETWORK', 'RAW_TCP') OR prf_host IS NOT NULL),
    CONSTRAINT ck_prf_port CHECK (prf_port IS NULL OR prf_port BETWEEN 1 AND 65535),
    CONSTRAINT ck_prf_geometry CHECK (
        (prf_width_mm  IS NULL OR prf_width_mm  > 0)
    AND (prf_height_mm IS NULL OR prf_height_mm > 0)
    AND (prf_columns  IS NULL OR prf_columns BETWEEN 20 AND 250)
    AND (prf_dpi      IS NULL OR prf_dpi BETWEEN 60 AND 1200)),
    CONSTRAINT ck_prf_sort CHECK (prf_sort_order >= 0)
);

ALTER TABLE IF EXISTS public.printer_profile OWNER to postgres;

CREATE UNIQUE INDEX IF NOT EXISTS ux_prf_code
    ON public.printer_profile USING btree (prf_company_id, lower(prf_code::text))
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prf_is_deleted = false;

-- "Which printers hang off this counter" — the resolver's second lookup.
CREATE INDEX IF NOT EXISTS ix_prf_device
    ON public.printer_profile USING btree (prf_device_id, prf_sort_order)
    INCLUDE (prf_code, prf_name, prf_paper_code)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prf_device_id IS NOT NULL AND prf_is_active = true AND prf_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_prf_company
    ON public.printer_profile USING btree (prf_company_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prf_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_prf_branch
    ON public.printer_profile USING btree (prf_branch_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prf_branch_id IS NOT NULL AND prf_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_prf_created_by
    ON public.printer_profile USING btree (prf_created_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prf_created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_prf_modified_by
    ON public.printer_profile USING btree (prf_modified_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE prf_modified_by IS NOT NULL;

-- §5's deferred half, now that printer_profile exists.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pta_printer') THEN
        ALTER TABLE public.print_template_assignment
            ADD CONSTRAINT fk_pta_printer FOREIGN KEY (pta_printer_id)
                REFERENCES public.printer_profile (prf_id) MATCH SIMPLE
                ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
--  §7  print_log (plg_) — every render, immutable.
--
--  ‹RECONSTRUCTED IN FULL› §7 of 17_printing.sql has not reached me. What is
--  load-bearing and taken from the rest of the file:
--    * prefix plg_, table public.print_log
--    * PARTITIONED BY LIST (plg_acc_year). Retiring a year is a DROP of one
--      partition; retention is policy, not schema.
--    * plg_version_id is a REAL foreign key to print_template_version. "What
--      did this bill look like when it was printed" is enforced by the
--      database, not snapshotted and hoped for -- this is the entire reason
--      the body lives on the version rather than the template.
--    * NO foreign key to any document. The subject is named by the POLYMORPHIC
--      SOURCE QUAD, because the documents are themselves partitioned by their
--      own accounting year and a purpose may name a master or a report.
--    * plg_copy_label records what was printed on the paper. Deciding that the
--      second print of a tax invoice is a DUPLICATE is a rule about GST.
--    * plg_params is ONE jsonb object per render -- the answers to ptv_params
--      -- not one per dataset. §3 cites this table as the reason the
--      declaration moved to the version.
--    * A REPRINT IS NOT A STATUS TRANSITION. sale_bill.sb_print_count and its
--      siblings stay a denormalised cache of COUNT(*) over this table.
--  The outcome block (plg_status … plg_duration_ms) is inference.
--
--  IMMUTABLE MEANS IMMUTABLE: there is no _is_deleted, no _modified_on and no
--  _sync_date here, which is a deliberate departure from the audit block every
--  other table in this migration carries. Append-only is not enforced by the
--  schema -- add a REVOKE UPDATE, DELETE on the application role, and a BEFORE
--  UPDATE OR DELETE trigger if you want it in the database.
--
--  The composite primary key is the house shape for a partitioned fact table
--  (sale_bill does the same), because PostgreSQL requires the partition key to
--  be part of every unique constraint.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.print_log
(
    plg_id                   uuid           NOT NULL DEFAULT uuidv7(),
    -- THE PARTITION KEY.
    plg_acc_year             character(9)   NOT NULL,

    plg_company_id           uuid           NOT NULL,
    plg_branch_id            uuid,
    -- The counter the render came from.
    plg_device_id            uuid,

    -- ── The subject, as the polymorphic source quad ──────────────────────
    plg_src_module           character varying(20)  NOT NULL DEFAULT 'SALES',
    plg_src_doc_type         character varying(40)  NOT NULL,
    plg_src_doc_id           uuid,
    -- The DOCUMENT's accounting year, which is not necessarily the year the
    -- render happened in: a reprint of last year's bill is logged this year.
    plg_src_acc_year         character(9),

    -- ── What was rendered, and with what ─────────────────────────────────
    plg_purpose_id           uuid           NOT NULL,
    plg_template_id          uuid           NOT NULL,
    -- The exact bytes. A real FK, and the point of the whole versioning design.
    plg_version_id           uuid           NOT NULL,
    plg_printer_id           uuid,

    plg_output_mode          character varying(15) NOT NULL DEFAULT 'PRINT',
    plg_copy_no              smallint       NOT NULL DEFAULT 1,
    -- ORIGINAL / DUPLICATE / TRIPLICATE — what the paper actually said.
    plg_copy_label           character varying(20),
    plg_lang                 character varying(5),

    -- The answers to ptv_params, ONE object for the whole render.
    plg_params               jsonb,

    -- ── Outcome ──────────────────────────────────────────────────────────
    plg_status               character varying(15) NOT NULL DEFAULT 'SUCCESS',
    plg_error                text,
    plg_page_count           smallint,
    plg_byte_count           integer,
    plg_duration_ms          integer,

    plg_printed_on           timestamp with time zone NOT NULL DEFAULT now(),
    plg_printed_by           uuid,

    CONSTRAINT pk_print_log PRIMARY KEY (plg_id, plg_acc_year),

    CONSTRAINT fk_plg_company FOREIGN KEY (plg_company_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_plg_branch FOREIGN KEY (plg_branch_id)
        REFERENCES public.branch_master (br_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_plg_device FOREIGN KEY (plg_device_id)
        REFERENCES fixed.device_master (dev_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_plg_purpose FOREIGN KEY (plg_purpose_id)
        REFERENCES public.print_purpose (ppo_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_plg_template FOREIGN KEY (plg_template_id)
        REFERENCES public.print_template (ptl_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_plg_version FOREIGN KEY (plg_version_id)
        REFERENCES public.print_template_version (ptv_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_plg_printer FOREIGN KEY (plg_printer_id)
        REFERENCES public.printer_profile (prf_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_plg_printed_by FOREIGN KEY (plg_printed_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    -- The same rule fn_create_printing_partitions enforces, so a row can never
    -- name a year that could not have a partition.
    CONSTRAINT ck_plg_acc_year_shape CHECK (
        plg_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
        AND RIGHT(plg_acc_year, 4)::int = LEFT(plg_acc_year, 4)::int + 1),
    CONSTRAINT ck_plg_src_acc_year_shape CHECK (
        plg_src_acc_year IS NULL
        OR (plg_src_acc_year ~ '^[0-9]{4}-[0-9]{4}$'
            AND RIGHT(plg_src_acc_year, 4)::int = LEFT(plg_src_acc_year, 4)::int + 1)),
    CONSTRAINT ck_plg_src_module CHECK (
        plg_src_module::text = ANY (ARRAY['SALES'::text, 'PURCHASE'::text,
            'INVENTORY'::text, 'ACCOUNTS'::text, 'STOCK'::text,
            'LOYALTY'::text, 'REPORT'::text, 'OTHER'::text])),
    CONSTRAINT ck_plg_output_mode CHECK (plg_output_mode::text = ANY (
        ARRAY['PRINT'::text, 'PREVIEW'::text, 'EMAIL'::text, 'FILE'::text])),
    CONSTRAINT ck_plg_status CHECK (plg_status::text = ANY (
        ARRAY['SUCCESS'::text, 'FAILED'::text, 'QUEUED'::text, 'CANCELLED'::text])),
    -- A failure says why; a success does not pretend to have one.
    CONSTRAINT ck_plg_error_pair CHECK (
        (plg_status::text = 'FAILED') OR plg_error IS NULL),
    CONSTRAINT ck_plg_copy_no CHECK (plg_copy_no BETWEEN 1 AND 9),
    CONSTRAINT ck_plg_lang_shape CHECK (
        plg_lang IS NULL OR plg_lang ~ '^[a-z]{2}(-[A-Z]{2})?$'),
    CONSTRAINT ck_plg_counts CHECK (
        (plg_page_count   IS NULL OR plg_page_count   >= 0)
    AND (plg_byte_count   IS NULL OR plg_byte_count   >= 0)
    AND (plg_duration_ms  IS NULL OR plg_duration_ms  >= 0))
) PARTITION BY LIST (plg_acc_year);

ALTER TABLE IF EXISTS public.print_log OWNER to postgres;

-- "How many times was this printed" — the query sb_print_count caches.
CREATE INDEX IF NOT EXISTS ix_plg_subject
    ON public.print_log USING btree
        (plg_src_module, plg_src_doc_type, plg_src_doc_id, plg_src_acc_year)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE plg_src_doc_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_plg_recent
    ON public.print_log USING btree (plg_company_id, plg_printed_on DESC)
    WITH (fillfactor=100, deduplicate_items=True);

CREATE INDEX IF NOT EXISTS ix_plg_version
    ON public.print_log USING btree (plg_version_id)
    WITH (fillfactor=100, deduplicate_items=True);

CREATE INDEX IF NOT EXISTS ix_plg_purpose
    ON public.print_log USING btree (plg_purpose_id)
    WITH (fillfactor=100, deduplicate_items=True);

CREATE INDEX IF NOT EXISTS ix_plg_template
    ON public.print_log USING btree (plg_template_id)
    WITH (fillfactor=100, deduplicate_items=True);

CREATE INDEX IF NOT EXISTS ix_plg_printer
    ON public.print_log USING btree (plg_printer_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE plg_printer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_plg_device
    ON public.print_log USING btree (plg_device_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE plg_device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_plg_branch
    ON public.print_log USING btree (plg_branch_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE plg_branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_plg_printed_by
    ON public.print_log USING btree (plg_printed_by)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE plg_printed_by IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════════════
--  §8  Partitions for the accounting years this database already knows.
--
--  A partitioned table with no partitions accepts no rows, and the failure
--  surfaces at a till. The years are read from the sale_bill partitions rather
--  than hard-coded, so this migration lands correctly on a database at any
--  point in its life. A NEW YEAR STILL NEEDS AN EXPLICIT CALL:
--      SELECT public.fn_create_printing_partitions('2027-2028');
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    r         record;
    v_found   int := 0;
    v_year    int;
BEGIN
    FOR r IN
        SELECT DISTINCT
               replace(substring(c.relname from '^sale_bill_(\d{4}_\d{4})$'), '_', '-') AS acc_year
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relkind = 'r'
           AND c.relname ~ '^sale_bill_\d{4}_\d{4}$'
         ORDER BY 1
    LOOP
        PERFORM public.fn_create_printing_partitions(r.acc_year::character(9));
        v_found := v_found + 1;
    END LOOP;

    -- No sale_bill partitions to learn from: fall back to the Indian fiscal
    -- year containing today, so the table is never left unusable.
    IF v_found = 0 THEN
        v_year := CASE WHEN EXTRACT(month FROM CURRENT_DATE) >= 4
                       THEN EXTRACT(year FROM CURRENT_DATE)::int
                       ELSE EXTRACT(year FROM CURRENT_DATE)::int - 1 END;
        PERFORM public.fn_create_printing_partitions(
            (v_year::text || '-' || (v_year + 1)::text)::character(9));
        v_found := 1;
    END IF;

    RAISE NOTICE 'print_log: % accounting-year partition(s) ensured', v_found;
END $$;
