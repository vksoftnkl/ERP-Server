-- A bill's set-offs, split by the liability they relieve (Qt bill report
-- 2026-09-24, item 4).
--
-- sb_advance_amt was the total of EVERY set-off, advances and credit notes
-- alike, so a client that kept the two apart could not save a bill that set
-- off a credit note. It now holds ADVANCE set-offs only; sb_note_adj_amt holds
-- the credit-note ones, each checked against its own adjustment type.
--
-- sale_bill is partitioned by acc_year: a column added to the parent reaches
-- every partition.

ALTER TABLE sales.sale_bill
  ADD COLUMN IF NOT EXISTS sb_note_adj_amt numeric(15, 2) NOT NULL DEFAULT 0;

-- Backfill: a POSTED bill's own live credit-note set-offs move out of
-- sb_advance_amt. "Its own" = NOTE_ADJUST rows on the bill's receivable that
-- no voucher wrote (bill-adjustment.helper writes none) and whose credit note
-- is not a return OF THIS BILL — a return settled ADJUST writes the same shape
-- against its source bill, and that is the return's set-off, not the bill's.
-- Reversal rows are negative, so the SUM is what is still live.
WITH own AS (
  SELECT sb.sb_id, sb.sb_acc_year, SUM(j.abj_amount) AS note
    FROM sales.sale_bill sb
    JOIN accounts.acc_bill_balance b
      ON b.abl_src_doc_id = sb.sb_id AND b.abl_acc_year = sb.sb_acc_year
     AND b.abl_src_doc_type = 'SALE_BILL' AND b.abl_is_deleted = false
    JOIN accounts.acc_bill_adjustment j
      ON j.abj_bill_id = b.abl_id AND j.abj_bill_acc_year = b.abl_acc_year
    JOIN accounts.acc_bill_balance cn
      ON cn.abl_id = j.abj_against_bill_id AND cn.abl_acc_year = j.abj_against_bill_acc_year
    LEFT JOIN sales.sale_return r ON r.sr_id = cn.abl_src_doc_id
   WHERE sb.sb_status = 'POSTED'
     AND j.abj_adj_type = 'NOTE_ADJUST' AND j.abj_voucher_id IS NULL AND j.abj_is_deleted = false
     AND r.sr_bill_id IS DISTINCT FROM sb.sb_id
   GROUP BY sb.sb_id, sb.sb_acc_year
  HAVING SUM(j.abj_amount) > 0
)
UPDATE sales.sale_bill sb
   SET sb_note_adj_amt = LEAST(own.note, sb.sb_advance_amt),
       sb_advance_amt  = sb.sb_advance_amt - LEAST(own.note, sb.sb_advance_amt)
  FROM own
 WHERE sb.sb_id = own.sb_id AND sb.sb_acc_year = own.sb_acc_year;
