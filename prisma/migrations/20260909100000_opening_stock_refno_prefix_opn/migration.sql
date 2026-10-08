-- Opening Stock reference numbers print as "OPN0001", not "opn000000000001st".
--
-- Two rows carry the format: the voucher type (the template new counters are
-- created from) and every acc_voucher_seq counter already created from it -- the
-- sequence row keeps a format snapshot precisely so editing the type does not
-- silently reformat a live series, so both have to be moved together here.
--
-- Row 1 is pinned by id: OPENING_VCHR_TYPE_ID in
-- opening-stock-voucher.controller.ts names vchr_type_id 1, and the code column
-- differs between databases ('Opn' from the seed, 'OPENING' where it was edited).
--
-- Numbers already issued keep the text they were printed and stored with:
-- svh_refno and txn_status_log reference the old string, and rewriting them
-- would break those links. Only numbers allocated from now on take the new shape.

BEGIN;

UPDATE accounts.acc_voucher_types
SET vchr_no_prefix = 'OPN',
    vchr_no_suffix = '',
    vchr_no_width  = 4
WHERE vchr_type_id = 1;

UPDATE accounts.acc_voucher_seq
SET seq_voucher_prefix = 'OPN',
    seq_voucher_suffix = '',
    seq_no_width       = 4,
    seq_modified_on    = now()
WHERE seq_vchr_type_id = 1;

COMMIT;
