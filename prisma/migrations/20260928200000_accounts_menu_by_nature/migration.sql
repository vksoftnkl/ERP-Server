-- ═══════════════════════════════════════════════════════════════════════════
--  notes (59): the Accounts menu (&5) — names and order by nature. 2026-09-28.
--
--  fixed.menu_master has no update route, so the rename is this migration.
--  IDS DO NOT CHANGE: the client resolves screens by menu id, so nothing
--  moves on the client and the tree shows the new names as soon as the rows
--  change. A separator (menu_separator) draws its line AFTER the item.
--
--   pos   id   name                       was                    vis  sep
--   ── Masters ─────────────────────────────────────────────────────────────
--    1    54   Ledger Groups              Ledger Group Master     ✓
--    2    53   Ledgers                    Ledger Master           ✓
--    3    55   Opening Balances           Opening Balance         ✓    ✓
--   ── Bill-wise settlement (one party, against bills) ────────────────────
--   10    99   Bill-wise Receipt          Receipt                 ✓
--   11   100   Bill-wise Payment          Payment                 —  until the payment screen is built
--   12    51   Received Cheques                                   ✓
--   13    52   Issued Cheques                                     ✓
--   14   263   Cheque Books                                       ✓    ✓
--   ── Vouchers (the Voucher Register, Tally's F4–F10 order) ──────────────
--   20   104   Contra                                             ✓
--   21   261   Payment Voucher                                    ✓
--   22   260   Receipt Voucher                                    ✓
--   23   103   Journal                                            ✓
--   24   259   Sales (Accounting)                                 ✓
--   25   163   Purchase (Accounting)                              ✓
--   26   102   Credit Note                                        ✓
--   27   101   Debit Note                                         ✓    ✓
--   28   262   Voucher Register                                   ✓
--   ── Retired / not built: at the end, hidden ────────────────────────────
--   90    48   Bill wise Receipt (old)    Bill wise Receipt       —  already inactive (20260915120000)
--   91    49   Bill wise Payment (old)    Bill wise Payment       —  now hidden: 100 retires it
--   92   187   Collection Entry                                   —
--   93   188   Collection Approval                                —
--   94   179   Claim Management                                   —
--   95   185   Third Party Bills                                  —
--
--  Why these names: 99/100 settle ONE party's bills (the Receipt screen), while
--  260/261 are the register's many-party vouchers — "Receipt" beside "Receipt
--  Voucher" read as the same thing. The masters read as plurals of what they
--  hold. 48/49 keep an "(old)" suffix so nobody mistakes them for 99/100 if
--  they are ever switched on. When the payment screen goes live, set
--  menu_visiblity = true on 100.
--
--  Guarded: a row under &5 whose id carries neither the old nor the new name is
--  somebody else's screen, and renaming it would be wrong — the migration
--  refuses. A fresh database has no tree yet: nothing matches, nothing changes,
--  and prisma/seed/Menu_Master.sql carries the same answers. Re-runnable: a row
--  already in its place is left alone (menu_modified_on untouched).
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  bad     text;
  missing text;
  n       int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM fixed.menu_master WHERE menu_id = 5) THEN
    RAISE NOTICE '20260928200000_accounts_menu_by_nature: no menu tree yet (fresh database) — Menu_Master.sql carries the same names and order';
    RETURN;
  END IF;

  CREATE TEMP TABLE _acc_menu ON COMMIT DROP AS
    SELECT * FROM (VALUES
      ( 54, 'Ledger Group Master',   'Ledger Groups',            1.00, false, true ),
      ( 53, 'Ledger Master',         'Ledgers',                  2.00, false, true ),
      ( 55, 'Opening Balance',       'Opening Balances',         3.00, true,  true ),
      ( 99, 'Receipt',               'Bill-wise Receipt',       10.00, false, true ),
      (100, 'Payment',               'Bill-wise Payment',       11.00, false, false),
      ( 51, 'Received Cheques',      'Received Cheques',        12.00, false, true ),
      ( 52, 'Issued Cheques',        'Issued Cheques',          13.00, false, true ),
      (263, 'Cheque Books',          'Cheque Books',            14.00, true,  true ),
      (104, 'Contra',                'Contra',                  20.00, false, true ),
      (261, 'Payment Voucher',       'Payment Voucher',         21.00, false, true ),
      (260, 'Receipt Voucher',       'Receipt Voucher',         22.00, false, true ),
      (103, 'Journal',               'Journal',                 23.00, false, true ),
      (259, 'Sales (Accounting)',    'Sales (Accounting)',      24.00, false, true ),
      (163, 'Purchase (Accounting)', 'Purchase (Accounting)',   25.00, false, true ),
      (102, 'Credit Note',           'Credit Note',             26.00, false, true ),
      (101, 'Debit Note',            'Debit Note',              27.00, true,  true ),
      (262, 'Voucher Register',      'Voucher Register',        28.00, false, true ),
      ( 48, 'Bill wise Receipt',     'Bill wise Receipt (old)', 90.00, false, false),
      ( 49, 'Bill wise Payment',     'Bill wise Payment (old)', 91.00, false, false),
      (187, 'Collection Entry',      'Collection Entry',        92.00, false, false),
      (188, 'Collection Approval',   'Collection Approval',     93.00, false, false),
      (179, 'Claim Management',      'Claim Management',        94.00, false, false),
      (185, 'Third Party Bills',     'Third Party Bills',       95.00, false, false)
    ) AS v(id, was, name, pos, sep, vis);

  -- an id under &5 that carries a name this plan does not know is another screen
  SELECT string_agg(format('%s "%s"', m.menu_id, m.menu_name), ', ' ORDER BY m.menu_id)
    INTO bad
    FROM fixed.menu_master m
    JOIN _acc_menu v ON v.id = m.menu_id
   WHERE m.menu_parent = 5
     AND m.menu_name NOT IN (v.was, v.name);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '20260928200000_accounts_menu_by_nature: under &5 Accounts, % carries a name this migration does not expect — is the menu tree numbered differently here? Nothing was changed.', bad;
  END IF;

  -- an expected id that is not under &5 here is left alone, and said so
  SELECT string_agg(v.id::text, ', ' ORDER BY v.id)
    INTO missing
    FROM _acc_menu v
   WHERE NOT EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_id = v.id AND m.menu_parent = 5);
  IF missing IS NOT NULL THEN
    RAISE NOTICE '20260928200000_accounts_menu_by_nature: menu id(s) % not under &5 Accounts here — left alone', missing;
  END IF;

  UPDATE fixed.menu_master m
     SET menu_name        = v.name,
         menu_position    = v.pos,
         menu_separator   = v.sep,
         menu_visiblity   = v.vis,
         menu_modified_on = now()
    FROM _acc_menu v
   WHERE m.menu_id = v.id
     AND m.menu_parent = 5
     AND (   m.menu_name <> v.name
          OR m.menu_position IS DISTINCT FROM v.pos
          OR m.menu_separator <> v.sep
          OR m.menu_visiblity <> v.vis);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '20260928200000_accounts_menu_by_nature: % Accounts menu row(s) renamed / moved', n;
END $$;
