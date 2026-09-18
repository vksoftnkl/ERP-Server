-- ═══════════════════════════════════════════════════════════════════════════
--  §2.1 + §2.2 — ITC eligibility and reverse charge, on the ledger
--
--  ── §2.1 · THERE IS NO ITC FLAG ANYWHERE IN THE DATABASE ────────────────
--  Every column in every schema was grepped for itc|input_credit|eligib and
--  nothing came back. (sales.customers.cus_itcoll_exempted / cus_itcoll_type
--  are income-tax TCS, not input tax credit — different statute, different
--  return.)
--
--  Without it no purchase or expense ledger can be marked blocked credit under
--  s.17(5) — motor vehicles, food and beverage, works contract, personal
--  consumption. GSTR-3B table 4(D) "Ineligible ITC" cannot be produced at all,
--  and 4(A) is overstated by exactly those amounts. That is not a reporting
--  gap; it is a wrong return.
--
--  The five values are Tally's own list under the ledger's GST details
--  ("Eligibility for input credit"), so an export maps one to one.
--
--  ── §2.2 · REVERSE CHARGE IS ON THE WRONG LEVEL TODAY ───────────────────
--  inventory.tax_rate_master.tax_is_reverse_charge exists, and
--  acc_voucher_doc_register.gdr_is_reverse_charge exists on the document. What
--  does not exist is anything saying THIS SUPPLIER or THIS EXPENSE is RCM.
--
--  The rate row is the wrong home: RCM is decided by who you buy from and what
--  — unregistered purchase, GTA, legal services, director's fees, import of
--  services — and an 18% rate row is shared with ordinary forward-charge sales
--  at 18%. Flagging the rate makes every sale at that rate reverse-charge.
--
--  So the flag goes on the ledger, and the document flag defaults from it.
--
--  Both columns are additive and nullable/defaulted; no existing row changes.
--  PostgreSQL 18.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE accounts.acc_ledger_master
    ADD COLUMN IF NOT EXISTS led_itc_eligibility  varchar(20),
    ADD COLUMN IF NOT EXISTS led_is_reverse_charge boolean NOT NULL DEFAULT false;

-- NULL is "not stated" and stays legal: most ledgers (bank, cash, party,
-- income) have no ITC question to answer, and forcing a value on them would
-- make the column meaningless on the ones that do.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'chk_led_itc_eligibility'
                    AND conrelid = 'accounts.acc_ledger_master'::regclass) THEN
    ALTER TABLE accounts.acc_ledger_master
      ADD CONSTRAINT chk_led_itc_eligibility CHECK (
        led_itc_eligibility IS NULL
        OR led_itc_eligibility IN ('ELIGIBLE', 'INELIGIBLE_17_5',
                                   'INELIGIBLE_OTHER', 'CAPITAL_GOODS',
                                   'INPUT_SERVICES'));
  END IF;
END $$;

COMMENT ON COLUMN accounts.acc_ledger_master.led_itc_eligibility IS
  'GST input tax credit eligibility. Drives GSTR-3B 4(A) vs 4(D). NULL = not stated (bank/cash/party/income ledgers). Tally: ledger GST details -> Eligibility for input credit.';

COMMENT ON COLUMN accounts.acc_ledger_master.led_is_reverse_charge IS
  'This party or expense attracts reverse charge (s.9(3)/9(4)). The document flag acc_voucher_doc_register.gdr_is_reverse_charge defaults from it. NOT on tax_rate_master: a rate is shared with forward-charge sales at the same percentage.';
