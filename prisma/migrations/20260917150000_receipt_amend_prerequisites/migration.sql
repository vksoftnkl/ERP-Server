-- ═══════════════════════════════════════════════════════════════════════════
--  R20 — correcting a POSTED receipt in place
--
--  Taken 2026-09-17, after a client request. The existing model assumes the
--  person who keys a receipt is not the person who approves it, so a mistake
--  is corrected by cancelling and re-entering. That is right for a client with
--  an accounts department and wrong for a one-person shop: the owner keys the
--  receipt, spots a wrong cheque number a minute later, and has to unmake and
--  re-key the whole document — party, tenders, allocations — to change six
--  characters.
--
--  POST /receipts/amend restates the document instead. This migration is
--  everything it needs from the database, and it is two things:
--
--    1 · acc_voucher_header.avh_revision_no — the counter that carries the
--        change in place of a second number, and the optimistic lock.
--    2 · accounts.allow_posted_amend        — the switch, default OFF.
--
--  NOT in here, deliberately: no new table, no new voucher type, no schema
--  change to any money table, and no new value in ck_avh_status. An amended
--  receipt is POSTED before and POSTED after; AMENDED is a step in
--  public.txn_status_log, which has no value CHECK on tsl_event, and never a
--  status the voucher itself carries.
--
--  The audit trail the route depends on needs nothing here either:
--  audit.audit_log resolves (and creates) its screen row by NAME on first
--  write, so registering acc_vouchers, acc_bill_adjustment and
--  acc_pdc_register is a matter of the service calling logEntityChange.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  1 · The revision counter
--
--  One column, no back-fill: NOT NULL DEFAULT 0 means every row that already
--  exists is revision 0, which is exactly what it is — as first posted.
--
--  It is on the HEADER and not on a log table because two things read it on
--  every request and both want it beside the voucher: the print template
--  ("rev 2" on the slip, so a customer holding an older copy can be answered)
--  and /receipts/amend itself, which compares it with the baseRevision the
--  client sends under the same row lock it is about to write through.
--
--  ALTER on the partitioned parent reaches every partition; acc_voucher_header
--  is LIST-partitioned on avh_acc_year.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE accounts.acc_voucher_header
    ADD COLUMN IF NOT EXISTS avh_revision_no integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN accounts.acc_voucher_header.avh_revision_no IS
    'R20. How many times this POSTED voucher has been restated in place by /receipts/amend; 0 = as first posted. The client sends the value it LOADED back as baseRevision and /receipts/amend refuses a mismatch — an amend carries the whole document, so without that check the second of two clients silently undoes the first one''s correction. Never re-numbered: a receipt is not a GST document and the customer is holding a slip with that number on it.';

-- The counter only ever moves forward, and only by the amend route.
ALTER TABLE accounts.acc_voucher_header
    DROP CONSTRAINT IF EXISTS ck_avh_revision_no;
ALTER TABLE accounts.acc_voucher_header
    ADD CONSTRAINT ck_avh_revision_no CHECK (avh_revision_no >= 0);


-- ───────────────────────────────────────────────────────────────────────────
--  2 · accounts.allow_posted_amend
--
--  asd_max_scope COMPANY, and not BRANCH like §2.8's seven.
--
--  Every one of those is a branch-level OPERATING decision (this branch takes
--  post-dated cheques, that one insists a collection names its salesman).
--  This is not an operating decision, it is a decision about how the business
--  is controlled: whether the person who keys money may restate it afterwards.
--  A company whose branch A may amend and whose branch B may not is a company
--  that has not decided, and the resolver's precedence is
--  GLOBAL < COMPANY < BRANCH < DEVICE < USER — so a BRANCH ceiling would let a
--  branch manager switch on for their own branch what head office turned off.
--  COMPANY is the narrowest scope that cannot be overridden from below.
--
--  Default FALSE, which is the current model unchanged. A client that never
--  touches this setting keeps cancel-and-re-enter and never sees the route.
--
--  What the setting CANNOT do is make any of the refusals in §4 negotiable —
--  a deposited cheque, a spent advance, a stale baseRevision and a locked
--  period are refused whether it is on or off, because they are facts about
--  the world rather than rules about the software.
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO public.app_setting_def
       (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
        asd_allowed_values, asd_min_value, asd_max_value, asd_max_scope,
        asd_label, asd_description, asd_sort_order, asd_is_active,
        asd_needs_relogin, asd_created_by)
SELECT v.key, 'ACCOUNTS', v.grp, v.data_type, v.default_value,
       v.allowed::jsonb, v.min_value, v.max_value, 'COMPANY',
       v.label, v.description, v.sort_order, true,
       false, 'system'
  FROM (VALUES
        ('accounts.allow_posted_amend', 'Receipt', 'BOOL', 'false',
         NULL::text, NULL::numeric, NULL::numeric, 50,
         'Allow editing a posted receipt',
         'OFF (the default): a mistake on a POSTED receipt is corrected by cancelling and re-entering, which is right where the person who keys a receipt is not the person who approves it. ON: POST /receipts/amend restates the document in place, keeping its number and its identity, and audit.audit_log carries the before and after of every row touched. For the owner-operator who keys the receipt themselves and spots a wrong cheque number a minute later. It does NOT relax any refusal: a receipt whose cheque has been deposited, or whose on-account balance has been spent, cannot be amended any more than it can be cancelled.')
       ) AS v(key, grp, data_type, default_value, allowed, min_value, max_value,
              sort_order, label, description)
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_def d
                    WHERE d.asd_key = v.key);


-- ═══════════════════════════════════════════════════════════════════════════
--  Read-back: paste this after running
--
--  SELECT column_name, data_type, column_default, is_nullable
--    FROM information_schema.columns
--   WHERE table_schema = 'accounts' AND table_name = 'acc_voucher_header'
--     AND column_name = 'avh_revision_no';
--
--  -- every existing voucher is revision 0
--  SELECT avh_revision_no, count(*) FROM accounts.acc_voucher_header
--   GROUP BY 1 ORDER BY 1;
--
--  SELECT asd_key, asd_data_type, asd_default_value, asd_max_scope
--    FROM public.app_setting_def WHERE asd_key = 'accounts.allow_posted_amend';
--
--  -- the partitions picked the column up
--  SELECT c.relname, a.attname
--    FROM pg_inherits i
--    JOIN pg_class c ON c.oid = i.inhrelid
--    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'avh_revision_no'
--   WHERE i.inhparent = 'accounts.acc_voucher_header'::regclass;
-- ═══════════════════════════════════════════════════════════════════════════
