-- notes (49) item 1 — D3: cancelling a sales document burned a number in its
-- own series.
--
-- SalesPostingService.reverseLegs gave the cancel's mirror voucher the
-- ORIGINAL's voucher type and drew its number from that type's counter — so
-- every bill cancel consumed a sale-bill number (bil00694 was bil00687's
-- mirror, and no sale bill 694 exists). The GST invoice series must be
-- continuous; each such gap would need an explanation in GSTR-1.
--
-- The mirror cannot keep type 3 with a number of its own: ux_avh_voucher_no
-- (company, branch, TYPE, year, no) counts the CANCELLED original too, and a
-- second counter inside type 3 would collide with bill numbers. So every sales
-- reversal (bill, sale return, delivery challan, challan return) is its own
-- voucher type with its own series: rev00001, rev00002, … The link to the
-- original stays avh_reversal_voucher_id / avh_against_voucher_id, and the
-- narration says "Reversal of <original refno>".
--
-- The sequence row is created on first use by allocateVoucherNumber.
INSERT INTO accounts.acc_voucher_types
    (vchr_type_code, vchr_type_name, vchr_type_short, vchr_category, vchr_nature, vchr_numbering_mode,
     vchr_no_prefix, vchr_no_suffix, vchr_no_width, vchr_reset_freq, vchr_allow_manual_no,
     vchr_affects_accounts, vchr_affects_inventory, vchr_is_cash_voucher, vchr_is_bank_voucher,
     vchr_print_title, vchr_sort_order, vchr_is_active,
     vchr_tally_export_enabled, vchr_tally_voucher_type_name, vchr_tally_base_voucher_type, vchr_created_by)
SELECT * FROM (VALUES
 ('Rev', 'Reversal', 'Rev', 'ACCOUNTING'::accounts."VoucherCategory", 'JOURNAL'::accounts."VoucherNature",
         'AUTO'::accounts."VoucherNumberingMode",
         'rev', '', 5, 'YEARLY'::accounts."VoucherResetFreq", false, true, false, false, false,
         'REVERSAL', 340, true, true, 'Journal', 'Journal', 'system')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_voucher_types t WHERE t.vchr_type_code = v.column1);
