-- ═══════════════════════════════════════════════════════════════════════════
--  stock.stock_track_preset — named flag combinations + policy defaults for
--  the tracking-policy screen.
--
--  HAND-AUTHORED, not generated. `prisma migrate` cannot express two of the
--  things this file has to create:
--
--    * spt_track_signature, a GENERATED ALWAYS ... STORED column — Prisma has
--      no generated-column concept and would emit it as a plain nullable
--      column that nothing ever fills;
--    * both indexes carry a WHERE — Prisma ignores indexes with predicates,
--      which is also why the model must not declare them, and ux_spt_code is
--      additionally an EXPRESSION index.
--
--  Requires 20260902060000_add_stock_track_policy only for the schema; nothing
--  here references that table (see below — that is the point).
--
--  ── What this is, and what it is NOT ─────────────────────────────────────
--  Nobody configuring an item thinks in six booleans; they think "this is a
--  pharma item", "this is a batch item". A preset is that sentence stored as
--  data: a name, the six tracking flags, and the policy defaults that go with
--  them — so the policy screen offers a combo of trades instead of a wall of
--  checkboxes, and adding a preset for a new trade is an INSERT, not a client
--  release.
--
--  THE ENGINE NEVER READS THIS TABLE. fn_stp_effective, fn_slt_resolve and
--  everything downstream read stock_track_policy's own six flags. A preset is
--  a STENCIL:
--
--      picking one COPIES its values into the policy form;
--      Save writes an ordinary stock_track_policy row that owns its flags;
--      after that the preset is irrelevant to that policy for ever.
--
--  There is deliberately NO foreign key from stock_track_policy to this table
--  and no spt_id stored on the policy. Link semantics — where editing a preset
--  re-keys every policy that used it — would silently re-identify stock across
--  every company at a stroke: exactly the accident the policy's effective
--  dates and the lot's stamped signature exist to prevent. If a screen wants
--  to show "which preset is this policy?", match on the GENERATED signature
--  (stp_track_signature = spt_track_signature); when nothing matches, the
--  answer is "Custom", which is the truth.
--
--  The MASTERS do point here — item_master.item_track_preset_id and
--  item_group_master.itg_track_preset_id, added in 20260907060000 — and saving
--  either copies this row's values into a stock_track_policy row. That is a
--  different thing from the link refused above: the foreign key is on the
--  MASTER, the policy still owns its own thirteen columns, and editing a preset
--  moves no policy until the item or group naming it is explicitly re-saved.
--
--  ── Company scoping: MERGE, like reasons ─────────────────────────────────
--  spt_company_id NULL = a SHARED preset, offered to every company. Same rule
--  as the adjustment reasons and for the same cause: the user is choosing one
--  from a list, and more choices are not a contradiction. A company row with a
--  shared row's code overrides it in the picker (see the query at the bottom).
--  Nothing here has to be copied per company.
--
--  ── The CHECKs are the same as the policy's, on purpose ──────────────────
--  A preset that cannot be saved as a policy is a trap waiting in a combo. So
--  expiry-needs-batch and FEFO-needs-expiry are enforced HERE too — an admin
--  cannot author "Batch, FEFO, no expiry", because the day somebody picked it
--  the policy save would refuse it with a message the admin never sees.
--
--  The shared preset ROWS are not inserted here: they are master data, so they
--  live with the other seeds in prisma/seed/Stock_Track_Presets.sql (run by
--  `npm run seed:run`, idempotent, re-runnable).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stock.stock_track_preset
(
    spt_id                   uuid           NOT NULL DEFAULT uuidv7(),
    -- NULL = shared with every company; a company row with the same code
    -- overrides the shared one in the picker.
    spt_company_id           uuid,
    spt_code                 character varying(30)  NOT NULL,
    -- Named by TRADE, not by flags: "Pharma" tells the user more than
    -- "batch+expiry+MRP+supplier" ever will. The flags live in the tooltip.
    spt_name                 character varying(150) NOT NULL,
    spt_description          character varying(250),

    -- ── The six flags the preset stamps into the policy form ─────────────
    spt_track_batch          boolean NOT NULL DEFAULT false,
    spt_track_mrp            boolean NOT NULL DEFAULT false,
    spt_track_sale_price     boolean NOT NULL DEFAULT false,
    spt_track_expiry         boolean NOT NULL DEFAULT false,
    spt_track_serial         boolean NOT NULL DEFAULT false,
    spt_track_supplier       boolean NOT NULL DEFAULT false,

    -- Same expression as stp_track_signature, so a screen can match a saved
    -- policy back to a preset by comparing the two generated columns.
    spt_track_signature      character varying(8) GENERATED ALWAYS AS (
        COALESCE(NULLIF(
            (CASE WHEN spt_track_batch      THEN 'B' ELSE '' END) ||
            (CASE WHEN spt_track_mrp        THEN 'M' ELSE '' END) ||
            (CASE WHEN spt_track_sale_price THEN 'S' ELSE '' END) ||
            (CASE WHEN spt_track_expiry     THEN 'E' ELSE '' END) ||
            (CASE WHEN spt_track_serial     THEN 'R' ELSE '' END) ||
            (CASE WHEN spt_track_supplier   THEN 'P' ELSE '' END)
        , ''), 'N') ) STORED,

    -- ── The policy defaults that travel with the trade ───────────────────
    -- A preset carries the WHOLE sensible policy, not only the flags: a pharma
    -- item is not just "BEMP", it is also FEFO, blocked-when-expired and
    -- 90-day near-expiry. All of it is copied, all of it stays editable on the
    -- form before Save.
    spt_valuation_method     character varying(20) NOT NULL DEFAULT 'WAVG',
    spt_issue_strategy       character varying(20) NOT NULL DEFAULT 'FEFO',
    spt_allow_negative       character varying(10) NOT NULL DEFAULT 'ALLOW',
    spt_shelf_life_days      integer,
    spt_near_expiry_days     integer        NOT NULL DEFAULT 30,
    spt_block_expired_sale   boolean        NOT NULL DEFAULT false,
    spt_ageing_basis         character varying(20) NOT NULL DEFAULT 'INWARD_DATE',

    spt_sort_order           integer        NOT NULL DEFAULT 0,
    spt_remarks              character varying(250),
    spt_is_active            boolean NOT NULL DEFAULT true,
    spt_is_deleted           boolean NOT NULL DEFAULT false,
    spt_sync_date            timestamp with time zone,
    spt_created_on           timestamp with time zone NOT NULL DEFAULT now(),
    spt_created_by           uuid,
    spt_modified_on          timestamp with time zone,
    spt_modified_by          uuid,

    CONSTRAINT pk_stock_track_preset PRIMARY KEY (spt_id),

    CONSTRAINT fk_spt_company FOREIGN KEY (spt_company_id)
        REFERENCES public.companys (comp_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_spt_created_by FOREIGN KEY (spt_created_by)
        REFERENCES public.user_master (usr_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT,

    -- The policy's own rulebook, verbatim (see the header for why).
    CONSTRAINT ck_spt_valuation CHECK (
        spt_valuation_method::text = ANY (ARRAY['WAVG'::text, 'FIFO'::text,
                                                'LOT_ACTUAL'::text])),
    CONSTRAINT ck_spt_issue_strategy CHECK (
        spt_issue_strategy::text = ANY (ARRAY['FIFO'::text, 'FEFO'::text,
                                              'LIFO'::text, 'MANUAL'::text])),
    CONSTRAINT ck_spt_allow_negative CHECK (
        spt_allow_negative::text = ANY (ARRAY['ALLOW'::text, 'WARN'::text,
                                              'BLOCK'::text])),
    CONSTRAINT ck_spt_ageing_basis CHECK (
        spt_ageing_basis::text = ANY (ARRAY['INWARD_DATE'::text, 'MFG_DATE'::text,
                                            'LAST_IN_DATE'::text])),
    CONSTRAINT ck_spt_near_expiry CHECK (spt_near_expiry_days >= 0),
    CONSTRAINT ck_spt_shelf_life CHECK (
        spt_shelf_life_days IS NULL OR spt_shelf_life_days > 0),
    -- Expiry tracking without batch tracking cannot be keyed.
    CONSTRAINT ck_spt_expiry_needs_batch CHECK (
        spt_track_expiry = false OR spt_track_batch = true),
    -- FEFO can only order lots that have an expiry date to order by.
    CONSTRAINT ck_spt_fefo_needs_expiry CHECK (
        spt_issue_strategy::text <> 'FEFO' OR spt_track_expiry = true
        OR spt_track_batch = false),
    CONSTRAINT ck_spt_code_shape CHECK (spt_code ~ '^[A-Za-z0-9_-]+$')
);

ALTER TABLE IF EXISTS stock.stock_track_preset OWNER to postgres;

-- COALESCEd because a plain unique index treats every NULL as distinct, which
-- would let the seed insert PHARMA twice. Same construction as the reason
-- master's code index, and the same override rule rides on it.
CREATE UNIQUE INDEX IF NOT EXISTS ux_spt_code
    ON stock.stock_track_preset USING btree
    ((COALESCE(spt_company_id, '00000000-0000-0000-0000-000000000000'::uuid)), spt_code)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE spt_is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_spt_list
    ON stock.stock_track_preset USING btree (spt_company_id, spt_sort_order)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE spt_is_active = true AND spt_is_deleted = false;


-- ═══════════════════════════════════════════════════════════════════════════
--  The two queries a screen needs. Documentation, not DDL.
--
--  The PICKER — shared and own merged, a company row hiding a shared row with
--  the same code (the reason-master rule, verbatim):
--
--      SELECT spt_id, spt_code, spt_name, spt_description, spt_track_signature,
--             spt_track_batch, spt_track_mrp, spt_track_sale_price,
--             spt_track_expiry, spt_track_serial, spt_track_supplier,
--             spt_valuation_method, spt_issue_strategy, spt_allow_negative,
--             spt_shelf_life_days, spt_near_expiry_days,
--             spt_block_expired_sale, spt_ageing_basis,
--             (spt_company_id IS NULL) AS is_shared
--        FROM stock.stock_track_preset s
--       WHERE s.spt_is_active = true AND s.spt_is_deleted = false
--         AND (s.spt_company_id = :company_id
--              OR (s.spt_company_id IS NULL AND NOT EXISTS (
--                    SELECT 1 FROM stock.stock_track_preset o
--                     WHERE o.spt_company_id = :company_id
--                       AND o.spt_code       = s.spt_code
--                       AND o.spt_is_deleted = false)))
--       ORDER BY spt_sort_order, spt_name;
--
--  WHICH PRESET IS THIS POLICY? — display only, matched on the signature; no
--  match means the policy is Custom, which is the truth:
--
--      SELECT p.stp_id, COALESCE(s.spt_name, 'Custom') AS preset_name
--        FROM stock.stock_track_policy p
--        LEFT JOIN stock.stock_track_preset s
--               ON s.spt_track_signature = p.stp_track_signature
--              AND s.spt_company_id IS NULL
--              AND s.spt_is_active = true AND s.spt_is_deleted = false
--       WHERE p.stp_id = :policy_id;
--
--  APPLYING one is the CLIENT copying fields into the policy form before Save.
--  There is no server-side "apply" and there must never be one: the user may
--  still adjust any field, and the saved policy owns its values.
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE stock.stock_track_preset IS
    'Named tracking-flag combinations plus policy defaults, offered by the policy screen as a combo of trades ("Pharma", "Perishables") instead of six checkboxes. A STENCIL: picking one copies its values into the form, Save writes an ordinary stock_track_policy row, and there is deliberately no FK back — editing a preset must never re-key existing stock. The engine never reads this table. Shared rows (company NULL) merge with a company''s own; a company row overrides a shared code, exactly like the stock adjustment reasons.';
COMMENT ON COLUMN stock.stock_track_preset.spt_track_signature IS
    'Generated, same expression as stp_track_signature. A screen labels a saved policy by matching the two signatures; no match reads "Custom".';
COMMENT ON COLUMN stock.stock_track_preset.spt_company_id IS
    'NULL = shared preset, offered to every company; a company row with the same code hides the shared one in the picker.';
