-- Sales Quotation reference numbers print as "Q0001", not "quo00042".
--
-- Two rows carry the format: the voucher type (the template new counters are
-- created from) and every acc_voucher_seq counter already created from it -- the
-- sequence row keeps a format snapshot precisely so editing the type does not
-- silently reformat a live series, so both have to be moved together here.
--
-- Numbers already issued keep the text they were printed and stored with:
-- sq_quote_refno, tsl_src_doc_refno and the acc_voucher rows all reference the
-- old string, and rewriting them would break those links. Only numbers allocated
-- from now on take the new shape.

BEGIN;

UPDATE accounts.acc_voucher_types
SET vchr_no_prefix = 'Q',
    vchr_no_width  = 4
WHERE vchr_type_code = 'Quo';

UPDATE accounts.acc_voucher_seq
SET seq_voucher_prefix = 'Q',
    seq_no_width       = 4,
    seq_modified_on    = now()
WHERE seq_vchr_type_id IN (
    SELECT vchr_type_id FROM accounts.acc_voucher_types WHERE vchr_type_code = 'Quo'
);

COMMIT;
