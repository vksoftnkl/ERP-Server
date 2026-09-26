-- ═══════════════════════════════════════════════════════════════════════════
--  §5 CORRECTION — print_template_assignment, drop and recreate.
--
--  20260827121000_add_printing_engine built this table from a RECONSTRUCTION,
--  because §5 of 17_printing.sql had not arrived. The authoritative §5 has
--  since arrived and proves the reconstruction wrong on eight counts:
--
--    applied                          | actual
--    ---------------------------------+--------------------------------------
--    pta_company_id NOT NULL          | NULLABLE — NULL = every company
--    —                                | pta_template_company_key NOT NULL
--    —                                | pta_printer_name, the bare-queue
--                                     |   fallback
--    fk_pta_template single-column    | COMPOSITE (id, owner) against
--                                     |   ux_ptl_id_company_key
--    —                                | ck_pta_template_scope, the
--                                     |   cross-company lock
--    —                                | ck_pta_branch_needs_company
--    —                                | ck_pta_printer_one_of
--    specificity CASE 2/1/0           | 3/2/1/0 — four rungs
--    ux_pta_scope NULLS NOT DISTINCT  | COALESCE to the nil uuid
--    modes PRINT/PREVIEW/EMAIL/FILE   | + PDF, WHATSAPP, ESCPOS; no FILE
--
--  A drop-and-recreate rather than an ALTER dance, because the table is empty
--  everywhere this has been applied — it was created two days ago and nothing
--  writes to it yet. The guard below refuses to run if that is not true of
--  this database, so the correction cannot silently destroy live assignments.
--
--  §6 printer_profile and §7 print_log remain RECONSTRUCTED; their
--  authoritative sections have not arrived. See
--  prisma/staging/README-17-printing-correction.md.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    row_count bigint;
BEGIN
    IF to_regclass('public.print_template_assignment') IS NULL THEN
        RETURN;
    END IF;
    EXECUTE 'SELECT count(*) FROM public.print_template_assignment' INTO row_count;
    IF row_count > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'data_exception',
            MESSAGE = format(
                'print_template_assignment holds %s row(s); the §5 correction is a drop-and-recreate and expects an empty table',
                row_count),
            HINT = 'Export the rows, re-point them at the corrected shape (pta_template_company_key is new and NOT NULL), then re-run.';
    END IF;
END $$;

DROP TABLE IF EXISTS public.print_template_assignment;


-- ═══════════════════════════════════════════════════════════════════════════
--  §5  print_template_assignment (pta_) — WHICH design wins, and WHERE.
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
--  Narrowest wins: counter -> branch -> company -> every company, via
--  pta_specificity.
--  PAPER IS NOT IN THE KEY. Output mode is: a 3-inch thermal receipt genuinely
--  is a different artifact from an A4 tax invoice.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.print_template_assignment
(
    pta_id                   uuid           NOT NULL DEFAULT uuidv7(),
    -- NULL = EVERY COMPANY. The ladder's widest rung, and the reason the
    -- specificity CASE below has four values rather than three.
    --
    -- A global row can only ever name a SHIPPED design, and that is enforced
    -- rather than trusted: pta_template_company_id carries the template's
    -- owner and ck_pta_template_scope ties the two together. Without it a
    -- global assignment could point at one company's private design and every
    -- other company's till would render it -- their logo, their address, on
    -- somebody else's paper.
    pta_company_id           uuid,
    pta_branch_id            uuid,                       -- NULL = every branch
    pta_device_id            uuid,                       -- NULL = every counter

    pta_purpose_id           uuid           NOT NULL,
    pta_template_id          uuid           NOT NULL,
    -- The owner of pta_template_id, carried so the composite foreign key
    -- below can exist. Same idiom as the promotion schema's benefit lock: a
    -- fact a single-column key cannot check is made checkable by carrying the
    -- second half of the parent's identity.
    --
    -- NOT NULL, and the nil uuid means "a shipped design" -- matching
    -- ptl_company_key rather than ptl_company_id, so no NULL ever reaches the
    -- key and MATCH SIMPLE cannot quietly stop checking. There is no DEFAULT:
    -- the writer must state which design's owner this is, because defaulting
    -- it to the sentinel would mean defaulting to "shipped", and that is the
    -- one answer that must never be assumed.
    pta_template_company_key uuid           NOT NULL,
    pta_output_mode          character varying(15) NOT NULL DEFAULT 'PRINT',

    -- Where the paper comes out for this scope. NULL = the server's default
    -- queue for the device.
    pta_printer_id           uuid,
    -- The same answer given as a bare queue or share name, for a scope whose
    -- printer nobody has registered as a profile.
    --
    -- A FALLBACK, never a copy of the profile's name: ck_pta_printer_one_of
    -- refuses it alongside pta_printer_id. Two columns answering "which
    -- printer" is the same defect §5 spent its whole argument removing from
    -- 3.0's default handling, and a denormalised name on a MASTER goes stale
    -- the day the profile is renamed -- unlike plg_printer_name, which is a
    -- snapshot on an immutable log and is meant to be frozen.
    --
    -- What it costs: a registered profile carries the family, the codepage,
    -- the column count and what the device can physically do. A bare name
    -- carries none of that, so a render through this column falls back to the
    -- counter's defaults for all of it and prf_paper_code cannot assert
    -- anything -- which is exactly the check that stops an A4 invoice going to
    -- an 80mm roll. Use it to get a branch printing today; register a profile
    -- before it matters.
    pta_printer_name         character varying(150),
    -- Overrides the purpose's copy count for this scope. NULL = use it.
    pta_copies               smallint,

    -- Specificity, DERIVED not typed:
    --      0  every company        pta_company_id IS NULL
    --      1  one company
    --      2  one branch
    --      3  one counter
    --
    -- A single CASE rather than added weights. The obvious version -- device 4
    -- plus branch 2 -- makes a counter row score SIX, because a counter row
    -- must also name its branch (ck_pta_device_needs_branch). Anything reading
    -- the value back then has to know that 6, not 4, means counter, and the
    -- first thing written against it during testing got exactly that wrong.
    -- Consecutive values cost nothing and cannot be misread.
    --
    -- Rung 0 exists because pta_company_id is nullable: a shipped design can
    -- be the default for every company that has not said otherwise. It MUST be
    -- its own rung -- if a global row and a company row both scored 0 the
    -- resolver would have a tie it cannot break, and ux_pta_scope would let
    -- both exist.
    pta_specificity          smallint GENERATED ALWAYS AS (
        CASE WHEN pta_device_id  IS NOT NULL THEN 3
             WHEN pta_branch_id  IS NOT NULL THEN 2
             WHEN pta_company_id IS NOT NULL THEN 1
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
    CONSTRAINT fk_pta_purpose FOREIGN KEY (pta_purpose_id)
        REFERENCES public.print_purpose (ppo_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    -- Composite, not single-column: it carries the template's OWNER as well as
    -- its id, which is what lets ck_pta_template_scope be enforceable. Both
    -- columns are NOT NULL on this side and generated non-null on the other,
    -- so the key always fires. Its target is ux_ptl_id_company_key in §2, and
    -- it subsumes the plain existence check a single-column key would give.
    CONSTRAINT fk_pta_template FOREIGN KEY (pta_template_id, pta_template_company_key)
        REFERENCES public.print_template (ptl_id, ptl_company_key) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    -- fk_pta_printer is added after §6, which creates the table it points at.
    CONSTRAINT fk_pta_created_by FOREIGN KEY (pta_created_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pta_modified_by FOREIGN KEY (pta_modified_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT ck_pta_output_mode CHECK (pta_output_mode::text = ANY (ARRAY[
        'PRINT'::text, 'PREVIEW'::text, 'PDF'::text,
        'EMAIL'::text, 'WHATSAPP'::text, 'ESCPOS'::text])),
    -- A counter belongs to a branch, so a device row with no branch is a rung
    -- of the ladder nobody can ever reach. A branch belongs to a company, so
    -- the same argument applies one rung up -- and it only became statable
    -- when pta_company_id stopped being NOT NULL.
    CONSTRAINT ck_pta_device_needs_branch CHECK (
        pta_device_id IS NULL OR pta_branch_id IS NOT NULL),
    CONSTRAINT ck_pta_branch_needs_company CHECK (
        pta_branch_id IS NULL OR pta_company_id IS NOT NULL),

    -- THE CROSS-COMPANY LOCK.
    --   pta_company_id IS NULL  -> a GLOBAL assignment, and it may name only a
    --                              SHIPPED design.
    --   pta_company_id = A      -> the design is shipped (sentinel) or is A's.
    --                              B's private design is refused.
    --
    -- Without it, a row with pta_company_id IS NULL could point at one
    -- company's private design and every other company's till would render it
    -- -- their logo, their address, on somebody else's paper. The composite key
    -- above is what makes this column true rather than merely present.
    --
    -- BOTH SIDES ARE FOLDED TO THE SENTINEL, and that is not decoration. The
    -- obvious form compares the key against pta_company_id directly:
    --     key = nil OR key = pta_company_id
    -- and on a global row that reads  false OR (acme = NULL)  ->  false OR NULL
    -- ->  NULL  --  and a CHECK CONSTRAINT IS SATISFIED BY NULL. The one case
    -- the lock exists for was the one case it let through. Caught in testing,
    -- and only because each case was run in its own transaction: run after a
    -- global row already existed, ux_pta_scope refused it first and the hole
    -- stayed hidden behind a passing test.
    --
    -- COALESCE on both sides removes the three-valued logic entirely. Same
    -- expression ux_pta_scope and ix_pta_resolve use, for the same reason.
    CONSTRAINT ck_pta_template_scope CHECK (
        pta_template_company_key = '00000000-0000-0000-0000-000000000000'::uuid
        OR pta_template_company_key = COALESCE(pta_company_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    CONSTRAINT ck_pta_copies CHECK (
        pta_copies IS NULL OR pta_copies BETWEEN 1 AND 9),
    -- One answer, or none. Never two.
    CONSTRAINT ck_pta_printer_one_of CHECK (
        pta_printer_id IS NULL OR pta_printer_name IS NULL)
);

ALTER TABLE IF EXISTS public.print_template_assignment OWNER to postgres;

-- THE constraint 3.0 did not have. One choice per scope key.
--
-- COALESCE to the nil uuid rather than NULLS NOT DISTINCT, because it is the
-- same expression the resolver uses and a btree unique index would otherwise
-- treat two company-wide rows as distinct — which is exactly the live-data
-- defect. The nil uuid as a sentinel inside a unique expression is the house
-- idiom (ex_prm_exclusive_clash).
--
-- If this table ever gains pta_effective_from/_to ("the new bill format
-- starts on 1 April"), this becomes EXCLUDE USING gist with a daterange and
-- WITH &&, identical in shape to ex_prm_exclusive_clash.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pta_scope
    ON public.print_template_assignment USING btree (
        (COALESCE(pta_company_id, '00000000-0000-0000-0000-000000000000'::uuid)),
        pta_purpose_id,
        (COALESCE(pta_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)),
        (COALESCE(pta_device_id, '00000000-0000-0000-0000-000000000000'::uuid)),
        pta_output_mode)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_is_deleted = false;

-- The resolver's exact shape, covering: the render path must not touch heap.
--
-- It leads with the SAME COALESCE expression ux_pta_scope uses, because the
-- resolver now has to fetch two companies' worth of rows -- this company's and
-- the global ones -- and a plain column here would not serve
--     COALESCE(pta_company_id, nil) IN (nil, :company_id)
-- with an index scan. One expression, used by the uniqueness rule, the lookup
-- and the resolver alike.
CREATE INDEX IF NOT EXISTS ix_pta_resolve
    ON public.print_template_assignment USING btree
        ((COALESCE(pta_company_id, '00000000-0000-0000-0000-000000000000'::uuid)),
         pta_purpose_id, pta_output_mode, pta_specificity DESC)
    INCLUDE (pta_company_id, pta_branch_id, pta_device_id, pta_template_id,
             pta_printer_id, pta_copies)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_is_active = true AND pta_is_deleted = false;

-- FK-covering indexes, one per foreign key declared above.
CREATE INDEX IF NOT EXISTS ix_pta_company ON public.print_template_assignment
    USING btree (pta_company_id) WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_company_id IS NOT NULL AND pta_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pta_branch ON public.print_template_assignment
    USING btree (pta_branch_id) WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_branch_id IS NOT NULL AND pta_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pta_device ON public.print_template_assignment
    USING btree (pta_device_id) WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_device_id IS NOT NULL AND pta_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pta_purpose ON public.print_template_assignment
    USING btree (pta_purpose_id) WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_is_deleted = false;
-- Leads with both columns of the composite fk_pta_template, per the house
-- rule that a foreign key's covering index starts with the key's columns.
CREATE INDEX IF NOT EXISTS ix_pta_template ON public.print_template_assignment
    USING btree (pta_template_id, pta_template_company_key)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pta_printer ON public.print_template_assignment
    USING btree (pta_printer_id) WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_printer_id IS NOT NULL AND pta_is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_pta_created_by ON public.print_template_assignment
    USING btree (pta_created_by) WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_pta_modified_by ON public.print_template_assignment
    USING btree (pta_modified_by) WITH (fillfactor=100, deduplicate_items=True)
    WHERE pta_modified_by IS NOT NULL;

-- §5's deferred half. printer_profile (§6) already exists by the time this
-- correction runs, so this is a re-add of the key the DROP above took with it,
-- in the same guarded shape 20260827121000 used.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pta_printer') THEN
        ALTER TABLE public.print_template_assignment
            ADD CONSTRAINT fk_pta_printer FOREIGN KEY (pta_printer_id)
                REFERENCES public.printer_profile (prf_id) MATCH SIMPLE
                ON UPDATE CASCADE ON DELETE RESTRICT;
    END IF;
END $$;
