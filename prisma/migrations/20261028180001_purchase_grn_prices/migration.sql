-- price_set_at = GRN: Sell B–D keyed on the GRN line (WS4, 2026-10-28). Sell A + MRP already work.
ALTER TABLE purchase.pur_grn_item
  ADD COLUMN IF NOT EXISTS gri_sell_b numeric(15,2),
  ADD COLUMN IF NOT EXISTS gri_sell_c numeric(15,2),
  ADD COLUMN IF NOT EXISTS gri_sell_d numeric(15,2),
  ADD COLUMN IF NOT EXISTS gri_price_update_result varchar(12);
