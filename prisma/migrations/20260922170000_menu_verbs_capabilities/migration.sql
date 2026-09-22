-- ════════════════════════════════════════════════════════════════════════════
-- menu_verbs — what a screen can DO
-- ════════════════════════════════════════════════════════════════════════════
--
-- THE PROBLEM THIS SOLVES. `user_menus` carries eleven permission flags and
-- `menu_master` said nothing about what a screen IS, so the permissions grid
-- had no way to tell a posting document from a master. It rendered eleven
-- checkboxes against all 197 active leaf menus — 2,167 cells, of which the
-- four transaction rights can mean something on about twenty screens and
-- Re-tender on exactly one (12, Sales Entry).
--
-- A grid that offers "Re-tender" against Tax Master is not granular, it is
-- lying, and an administrator cannot tell the meaningful cells from the noise.
--
-- THE RULE: a verb exists on a menu if the menu can do it. The client renders
-- a cell only for a verb the menu holds — no checkbox at all rather than a
-- greyed one, because an UNCHECKED box says "denied" and that is a different
-- statement from "this screen has nothing to post".
--
-- WHY text[] and not a bitmask or a join table: it reads in psql, a new verb
-- is an UPDATE rather than a migration, and `menu_verbs @> '{POST}'` takes a
-- GIN index if it ever needs one.
--
-- THE VOCABULARY (uppercase, one token per verb):
--   VIEW CREATE EDIT DELETE PRINT EXPORT   every screen
--   POST CANCEL AMEND OVERRIDE             documents that reach the ledger
--   RETENDER                               Sales Entry alone
--
-- Deliberately NOT constrained to that list: a screen type nobody has thought
-- of yet should not need a migration to describe itself.

ALTER TABLE fixed.menu_master
  ADD COLUMN IF NOT EXISTS menu_verbs text[] NOT NULL
      DEFAULT '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}';

COMMENT ON COLUMN fixed.menu_master.menu_verbs IS
  'What this screen can do. The permissions grid renders a cell only for a verb listed here. '
  'Vocabulary: VIEW CREATE EDIT DELETE PRINT EXPORT POST CANCEL AMEND OVERRIDE RETENDER.';

-- ── the posting documents ───────────────────────────────────────────────────
-- Every screen that raises a voucher, and so can be posted, cancelled, amended
-- and overridden. Twenty of them, checked against menu_master on 2026-09-22.
-- (The handover also listed 251; no such menu exists — 250 is the highest.)
UPDATE fixed.menu_master
   SET menu_verbs = menu_verbs || '{POST,CANCEL,AMEND,OVERRIDE}'
 WHERE menu_id IN (
         11,  -- Sales Order
         12,  -- Sales Entry
         13,  -- Sales Return
         14,  -- Quotation
         182, -- Deliver Note  (delivery challan AND DC return)
         23,  -- Purchase Order
         24,  -- Purchase Entry
         25,  -- Purchase Return
         41,  -- Stock Transfer
         44,  -- Opening Stock
         45,  -- Physical Stock Update
         51,  -- Received Cheques
         52,  -- Issued Cheques
         55,  -- Opening Balance
         99,  -- Receipt
         100, -- Payment
         101, -- Debit Note
         102, -- Credit Note
         103, -- Journal
         104  -- Contra
       )
   AND NOT menu_verbs @> '{POST}';

-- ── re-tender is ONE screen ─────────────────────────────────────────────────
-- Changing how a POSTED bill was paid. It exists nowhere else in the product,
-- and offering it on 196 other menus is what started this.
UPDATE fixed.menu_master
   SET menu_verbs = menu_verbs || '{RETENDER}'
 WHERE menu_id = 12
   AND NOT menu_verbs @> '{RETENDER}';

-- ── read-only screens should say so ─────────────────────────────────────────
-- Offering Create / Edit / Delete on a screen that only shows a policy is the
-- same lie in the other direction.
UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,PRINT}'
 WHERE menu_id IN (
         249, -- Stock Track Policy
         250  -- Ledger mapping
       );
