-- ═══════════════════════════════════════════════════════════════════════════
--  §1.4 — acc_group_child_ids goes
--
--  ── WHY IT CANNOT BE SAVED ──────────────────────────────────────────────
--  The array was a denormalised copy of a group's subtree that ONLY
--  acc-group-master.service.ts maintained (appendChildIds / removeChildIds /
--  ensureSelfInChildIds). Every row written by anything else — the seeds, the
--  three sales masters that mirror into this table, a Tally import, a fix typed
--  into psql — was born stale and stayed stale. On the live box 21 of 48 groups
--  held NULL and 14 held {}; where it was populated it disagreed with reality:
--  Customers claimed 1 child against 11, Current Assets 3 against 6, Office
--  accounts 6 against 1.
--
--  And AccGroupMasterPayloadDto marked accGroupChildIds REQUIRED, so any
--  consumer that trusted it built the wrong tree — including an export, which
--  has to emit parents before children.
--
--  Maintaining it in tr_acc_group_inherit_nature was the alternative. It is
--  more machinery guarding a value that is already derivable:
--  acc_group_parent_id is indexed (idx_acc_group_parent_id) and a recursive CTE
--  over it cannot go stale. Nothing outside the service reads the array —
--  checked across the server and the client — so nothing loses a field.
--
--  IRREVERSIBLE. The array holds no information that parent_id does not.
--  PostgreSQL 18.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE accounts.acc_group_master
    DROP COLUMN IF EXISTS acc_group_child_ids;
