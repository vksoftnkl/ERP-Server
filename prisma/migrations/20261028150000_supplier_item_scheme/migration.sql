-- ENT-07 buy N get M on the supplier–item map (WS1, 2026-10-28). Purchase Entry fills Free from it.
ALTER TABLE purchase.pur_supplier_item
  ADD COLUMN IF NOT EXISTS psi_scheme_buy_qty numeric(18,3),
  ADD COLUMN IF NOT EXISTS psi_scheme_free_qty numeric(18,3);
ALTER TABLE purchase.pur_supplier_item ADD CONSTRAINT ck_psi_scheme CHECK (
  (psi_scheme_buy_qty IS NULL) = (psi_scheme_free_qty IS NULL)
  AND (psi_scheme_buy_qty IS NULL OR (psi_scheme_buy_qty > 0 AND psi_scheme_free_qty > 0)));
