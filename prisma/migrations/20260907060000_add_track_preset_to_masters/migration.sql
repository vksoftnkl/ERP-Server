-- ═══════════════════════════════════════════════════════════════════════════
--  item_master.item_track_preset_id / item_group_master.itg_track_preset_id
--  — the stock.stock_track_preset an item or a group is configured with, plus
--  the group index stock_track_policy has been missing since 20260902060000.
--
--  HAND-AUTHORED. `prisma migrate` would emit the two columns and their
--  foreign keys, but not ix_stp_group, which carries a WHERE (Prisma ignores
--  partial indexes — which is also why the model must not declare it).
--
--  ── An id, and a real foreign key ────────────────────────────────────────
--  spt_id is the preset's primary key, so unlike spt_code it names exactly one
--  row and can be referenced. The company MERGE — spt_company_id NULL is a
--  preset shared with every company, and a company row of the same spt_code
--  overrides it — is therefore a PICKER concern only: whoever chose the preset
--  already resolved the merge and stored the winner's id.
--
--  ON DELETE RESTRICT: presets are retired with spt_is_deleted, not DELETEd, so
--  this blocks nothing in normal use and catches the one case that would
--  otherwise leave an item pointing at nothing.
--
--  ── What this does NOT do ────────────────────────────────────────────────
--  stock_track_preset's own header refuses link semantics between a POLICY and
--  a preset, because editing a preset would then re-key stock everywhere it was
--  used. That still holds and this does not weaken it: the link is on the
--  MASTER, not on the policy. A stock_track_policy row still owns its thirteen
--  columns outright, and editing a preset changes no policy until somebody
--  explicitly re-saves the item or group that names it. What the id buys is
--  that a later save re-derives the SAME policy instead of falling back to the
--  item's flags and quietly undoing the admin's choice.
--
--  ── ix_stp_group ─────────────────────────────────────────────────────────
--  20260902060000 created ix_stp_item but no group equivalent, and fk_stp_group
--  has no covering index. Nothing wrote a GROUP-scope policy until now, so it
--  never mattered; syncFromItemGroup makes stp_group_id a lookup key and every
--  DELETE on item_group_master a sequential scan of the policy table.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE inventory.item_master
    ADD COLUMN IF NOT EXISTS item_track_preset_id uuid;

ALTER TABLE inventory.item_group_master
    ADD COLUMN IF NOT EXISTS itg_track_preset_id uuid;

COMMENT ON COLUMN inventory.item_master.item_track_preset_id IS
    'stock.stock_track_preset the ITEM-scope policy is derived from. NULL = derive from the item''s own batch/expiry flags instead.';

COMMENT ON COLUMN inventory.item_group_master.itg_track_preset_id IS
    'stock.stock_track_preset the GROUP-scope policy is derived from. NULL = no group policy at all — a group has no tracking flags of its own to fall back to.';

ALTER TABLE inventory.item_master
    DROP CONSTRAINT IF EXISTS fk_item_track_preset;
ALTER TABLE inventory.item_master
    ADD CONSTRAINT fk_item_track_preset FOREIGN KEY (item_track_preset_id)
        REFERENCES stock.stock_track_preset (spt_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE inventory.item_group_master
    DROP CONSTRAINT IF EXISTS fk_itg_track_preset;
ALTER TABLE inventory.item_group_master
    ADD CONSTRAINT fk_itg_track_preset FOREIGN KEY (itg_track_preset_id)
        REFERENCES stock.stock_track_preset (spt_id) MATCH SIMPLE
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- Covering indexes for the two foreign keys above: without them every DELETE
-- on stock_track_preset scans both master tables to prove the RESTRICT holds.
-- Partial, because the columns are overwhelmingly NULL — most items take the
-- flag-derived fallback.
CREATE INDEX IF NOT EXISTS ix_item_track_preset
    ON inventory.item_master USING btree (item_track_preset_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE item_track_preset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_itg_track_preset
    ON inventory.item_group_master USING btree (itg_track_preset_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE itg_track_preset_id IS NOT NULL;

-- The GROUP mirror of ix_stp_item: the reverse lookup syncFromItemGroup does on
-- every group save, and the index fk_stp_group needs so deleting a group does
-- not scan the whole policy table.
CREATE INDEX IF NOT EXISTS ix_stp_group
    ON stock.stock_track_policy USING btree (stp_group_id)
    WITH (fillfactor=100, deduplicate_items=True)
    WHERE stp_group_id IS NOT NULL AND stp_is_deleted = false;

COMMIT;
