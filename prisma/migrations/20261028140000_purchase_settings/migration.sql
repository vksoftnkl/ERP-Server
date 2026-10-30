-- ═══════════════════════════════════════════════════════════════════════════
--  Purchase settings — purchase.* (plan-purchase-backend.md §8, addendum 2 B3 / B6)
--  Catalog rows only (app_setting_def), per company. The App Settings screen lists
--  them under PURCHASE by itself. The cash limit is NOT here: s.40A(3) is a statutory limit
--  per company (statutory_limits, CASH_PAYMENT_LIMIT_40A3), which the payment of a cash bill
--  already checks. A purchase bill snapshots the money-steering ones
--  in pi_policy. Re-runnable: a key already in the catalog is left alone.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value, asd_allowed_values, asd_min_value, asd_max_value,
     asd_max_scope, asd_label, asd_description, asd_sort_order, asd_created_by)
SELECT v.key, 'PURCHASE', v.grp, v.typ, v.dflt, v.allowed::jsonb, v.mn, v.mx, 'COMPANY', v.label, v.descr, v.sort, 'SYSTEM'
  FROM (VALUES
    ('purchase.default_entry',            'Entry',  'TEXT',    'DIRECT',        '["DIRECT", "GRN"]', NULL::numeric, NULL::numeric,
     'Default entry',            'DIRECT: goods come with the bill (Purchase Entry). GRN: goods are received first on a GRN and billed later.', 10),
    ('purchase.inv_amount_check',         'Entry',  'TEXT',    'REFUSE',        '["REFUSE", "WARN"]', NULL, NULL,
     'Invoice amount check',     'The amount printed on the supplier''s bill against the net payable. REFUSE: Post is refused until they match. WARN: Post goes through, the bill keeps the difference on record.', 20),
    ('purchase.duplicate_bill_mode',      'Entry',  'TEXT',    'REFUSE',        '["REFUSE", "WARN"]', NULL, NULL,
     'Duplicate supplier bill',  'The same supplier invoice number entered twice in a year (any branch). REFUSE: refused online. WARN: saved, with a warning.', 30),
    ('purchase.labels_after_post',        'Entry',  'TEXT',    'ASK',           '["ASK", "ALWAYS", "NEVER"]', NULL, NULL,
     'Labels after post',        'Barcode labels for the received goods after a bill or GRN is posted.', 40),
    ('purchase.allow_price_update',       'Prices', 'BOOL',    'false',         NULL, NULL, NULL,
     'Purchase may change selling prices', 'Off (chains): a purchase never writes selling prices or MRP rows; pricing stays with Change Selling. On (a single shop): the bill''s selling prices are written as Purchase price update says.', 10),
    ('purchase.price_update',             'Prices', 'TEXT',    'UPDATE_PRICES', '["UPDATE_PRICES", "COST_ONLY", "OPEN_CHANGE_SELLING", "NONE"]', NULL, NULL,
     'Purchase price update',    'Only when "Purchase may change selling prices" is on. UPDATE_PRICES: the bill''s selling prices / MRP are written to the price rows. COST_ONLY: only the cost. OPEN_CHANGE_SELLING: nothing written, Change Selling opens after post. NONE: nothing. A price changed later than the bill (business time) is kept.', 20),
    ('purchase.price_set_at',             'Prices', 'TEXT',    'INVOICE',       '["INVOICE", "GRN"]', NULL, NULL,
     'Prices set at',            'Whether selling prices are keyed on the bill or already on the GRN.', 30),
    ('purchase.rate_tolerance_pct',       'Checks', 'DECIMAL', '2',             NULL, 0, 100,
     'Rate tolerance vs PO %',   'A bill rate above the PO rate by more than this puts the bill on payment hold (it is not refused).', 10),
    ('purchase.shelf_life_mode',          'Checks', 'TEXT',    'WARN',          '["OFF", "WARN", "REFUSE"]', NULL, NULL,
     'Shelf-life check',         'Goods received with less than the minimum shelf life left.', 20),
    ('purchase.min_shelf_life_pct',       'Checks', 'INT',     '60',            NULL, 0, 100,
     'Minimum shelf life %',     'The company default; an item may carry its own.', 30),
    ('purchase.close_po_on_first_bill',   'Orders & returns', 'BOOL', 'false',  NULL, NULL, NULL,
     'Close PO on first bill',   'On: the PO''s unbilled rest is short-closed by its first bill.', 10),
    ('purchase.po_approval_above',        'Orders & returns', 'DECIMAL', '0',   NULL, 0, NULL,
     'PO approval above',        'A PO above this value needs approval before it can feed a GRN or a bill. 0 = off.', 20),
    ('purchase.return_settlement_default','Orders & returns', 'TEXT', 'ADJUST', '["ADJUST", "ADVANCE", "CASH"]', NULL, NULL,
     'Return settlement default','How a purchase return is settled unless the return says otherwise.', 30)
  ) AS v(key, grp, typ, dflt, allowed, mn, mx, label, descr, sort)
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting_def d WHERE d.asd_key = v.key);
