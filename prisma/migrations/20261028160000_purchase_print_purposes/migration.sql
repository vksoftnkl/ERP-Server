-- ═══════════════════════════════════════════════════════════════════════════
--  Purchase print purposes — Print · Ctrl+P on the five purchase screens
--  (plan-purchase-frontend.md §4, ENT-27). One purpose per document, shared by
--  every company (ppo_company_id NULL), as the sales ones are. The designs are
--  data made through /print-templates (share print/purchase_doc_templates.py).
--  Data only; re-runnable: a code already there is left alone.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.print_purpose (ppo_id, ppo_company_id, ppo_code, ppo_name, ppo_src_module, ppo_doc_type,
                                  ppo_copy_count, ppo_copy_labels, ppo_allow_reprint, ppo_sort_order, ppo_notes,
                                  ppo_is_active, ppo_is_deleted, ppo_created_on)
SELECT v.id::uuid, NULL, v.code, v.name, 'PURCHASE', v.doc_type, v.copies, v.labels, true, v.sort, v.notes, true, false, now()
  FROM (VALUES
    ('01a18300-0000-7000-8000-000000000001', 'PURCHASE_ORDER',   'Purchase Order',          'PURCHASE_ORDER',   1, 'NA', 300,
     'A purchase order to the supplier: lines with qty, rate, discount, tax, totals. docId = po_id, accYear = po_acc_year.'),
    ('01a18300-0000-7000-8000-000000000002', 'GRN',              'Goods Received Note',     'GRN',              1, 'NA', 310,
     'What came in: challan / received / damaged / free per line, batches, the loadmen. docId = grn_id, accYear = grn_acc_year.'),
    ('01a18300-0000-7000-8000-000000000003', 'PURCHASE_INVOICE', 'Purchase Invoice',        'PURCHASE_BILL',    1, 'NA', 320,
     'The supplier bill as entered: lines, taxes, charges, net payable. docId = pi_id, accYear = pi_acc_year.'),
    ('01a18300-0000-7000-8000-000000000004', 'PURCHASE_RETURN',  'Purchase Return / Debit Note', 'PURCHASE_RETURN', 2, 'ORIGINAL,DUPLICATE', 330,
     'Goods going back or claimed: rows, tax, the debit note value. docId = pr_id, accYear = pr_acc_year.'),
    ('01a18300-0000-7000-8000-000000000005', 'SHORTAGE_RECEIPT', 'Shortage Receipt',        'SHORTAGE_RECEIPT', 1, 'NA', 340,
     'Short goods received later: rows against the original bill / GRN. docId = psr_id, accYear = psr_acc_year.')
  ) AS v(id, code, name, doc_type, copies, labels, sort, notes)
 WHERE NOT EXISTS (SELECT 1 FROM public.print_purpose p WHERE p.ppo_code = v.code AND p.ppo_company_id IS NULL AND NOT p.ppo_is_deleted);
