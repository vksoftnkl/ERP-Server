-- ═══════════════════════════════════════════════════════════════════════════
--  Party master rules, phase 1 (Shared/Prathap/party/plan-party-master-rules.md
--  §3.2, §3.6, §4.2, §9 step 1; user answers decisions-party-master-rules-
--  2026-10-29.md: every recommendation taken, Q9 = B, Q7 = a).
--
--  1. Ledgers. For every acc_ledger_master row that backs a customer or a
--     supplier: led_gst_party_reg_type + led_is_sez from the party's cleaned
--     GST type (REGULAR / COMPOSITION -> same; SEZ -> REGULAR + is_sez;
--     OVERSEAS / UNREGISTERED -> UNREGISTERED). On a shared ledger the role
--     whose raw type is not blank wins, then the customer. Runs BEFORE step 2,
--     so it still sees the raw values. Skipped: a row that already breaks the
--     NOT VALID ck_led_tds_pair (an UPDATE would re-check it); led_is_sez is
--     set only when the ledger has a GSTIN (chk_led_sez_consistency). Ledgers
--     with led_is_sez = true and no party are not touched.
--  2. sales.customers.cus_gst_type and purchase.suppliers.sup_gst_type to the
--     five codes. Key = upper(x) with spaces, '_' and '-' removed. A key that
--     is one of the five codes (or SEZUNIT) -> that code. Anything else, or
--     blank / NULL -> REGULAR when the GSTIN looks like one
--     (^[0-9]{2}[0-9A-Z]{10}[0-9A-Z]{3}$), else UNREGISTERED. The type the
--     operator picked is kept even where it contradicts the GSTIN (UNREGISTERED
--     with a GSTIN, COMPOSITION without one): the new rule applies at their
--     next save (plan §3.2, user Q5).
--  3. fixed.state_codes '96' Other Country (GST portal code for a foreign
--     party, user Q6). Dropdowns 9 / 21 and the stateCodes lookup list every
--     active row, so it shows there with no other change.
--  4. ix_sb_cust_posted on sales.sale_bill for the read-time "last billed"
--     (Q9 = B). Created on the LIST-partitioned parent: Postgres creates the
--     matching index on every sale_bill_YYYY_YYYY partition and on every
--     partition made later by ensure_acc_year_partitions. Partial, so it is
--     NOT declared in the Prisma model.
--     No back-fill from bills (Q9 = B). Instead a one-time reset (user OK
--     2026-10-29): every value in cus_billed_date / cus_billed_count /
--     sup_billed_date came from master saves, never from a bill, so they go to
--     NULL / 0 (cus_billed_count is NOT NULL DEFAULT 0; suppliers have no count
--     column). Nothing writes them after this build; they are dropped in P2.
--  5. Plain wording rows (notes 120) for the new §4.2 codes, the customer bug
--     batch codes and the existing CUSTOMER_ / CUSTOMER_GROUP_ / LOOKUP_ /
--     PURCHASE_SUPPLIER_ codes. Same rows as prisma/seed/Error_Messages.json
--     version 2026-10-29.1; ON CONFLICT DO NOTHING, so an existing row keeps
--     its words. The catalogue version is raised so a running server reloads.
--
--  NOT here (plan §3.3 / D2-8, phase 2): ck_cus_gst_type, ck_sup_gst_type,
--  cus_gst_type NOT NULL DEFAULT. No new table, menu, grid or dropdown.
--  Every statement is idempotent: a second run changes 0 rows.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Ledger GST registration type + SEZ flag ─────────────────────────────
WITH p AS (
    SELECT l.led_id,
           c.cus_id IS NOT NULL                    AS has_c,
           s.sup_id IS NOT NULL                    AS has_s,
           NULLIF(btrim(c.cus_gst_type), '')       AS c_raw,
           CASE upper(regexp_replace(coalesce(c.cus_gst_type, ''), '[[:space:]_-]', '', 'g'))
                WHEN 'REGULAR'      THEN 'REGULAR'
                WHEN 'COMPOSITION'  THEN 'COMPOSITION'
                WHEN 'SEZ'          THEN 'SEZ'
                WHEN 'SEZUNIT'      THEN 'SEZ'
                WHEN 'OVERSEAS'     THEN 'OVERSEAS'
                WHEN 'UNREGISTERED' THEN 'UNREGISTERED'
                ELSE CASE WHEN c.cus_gst_no ~ '^[0-9]{2}[0-9A-Z]{10}[0-9A-Z]{3}$'
                          THEN 'REGULAR' ELSE 'UNREGISTERED' END
           END                                     AS c_new,
           CASE upper(regexp_replace(coalesce(s.sup_gst_type, ''), '[[:space:]_-]', '', 'g'))
                WHEN 'REGULAR'      THEN 'REGULAR'
                WHEN 'COMPOSITION'  THEN 'COMPOSITION'
                WHEN 'SEZ'          THEN 'SEZ'
                WHEN 'SEZUNIT'      THEN 'SEZ'
                WHEN 'OVERSEAS'     THEN 'OVERSEAS'
                WHEN 'UNREGISTERED' THEN 'UNREGISTERED'
                ELSE CASE WHEN s.sup_gst_no ~ '^[0-9]{2}[0-9A-Z]{10}[0-9A-Z]{3}$'
                          THEN 'REGULAR' ELSE 'UNREGISTERED' END
           END                                     AS s_new
      FROM accounts.acc_ledger_master l
      LEFT JOIN sales.customers    c ON c.cus_id = l.led_id
      LEFT JOIN purchase.suppliers s ON s.sup_id = l.led_id
     WHERE c.cus_id IS NOT NULL OR s.sup_id IS NOT NULL
), t AS (
    SELECT led_id,
           CASE WHEN has_c AND (c_raw IS NOT NULL OR NOT has_s) THEN c_new ELSE s_new END AS party_type
      FROM p
), v AS (
    SELECT t.led_id,
           CASE t.party_type WHEN 'SEZ'      THEN 'REGULAR'
                             WHEN 'OVERSEAS' THEN 'UNREGISTERED'
                             ELSE t.party_type END                   AS reg_type,
           (t.party_type = 'SEZ'
            AND NULLIF(btrim(l.led_gstin_no), '') IS NOT NULL)      AS is_sez
      FROM t
      JOIN accounts.acc_ledger_master l ON l.led_id = t.led_id
)
UPDATE accounts.acc_ledger_master l
   SET led_gst_party_reg_type = v.reg_type,
       led_is_sez             = v.is_sez
  FROM v
 WHERE l.led_id = v.led_id
   AND (l.led_gst_party_reg_type IS DISTINCT FROM v.reg_type
        OR l.led_is_sez IS DISTINCT FROM v.is_sez)
   AND (l.led_is_tds_applicable = false
        OR (l.led_tds_deductee_type IS NOT NULL AND l.led_tds_nature_of_payment IS NOT NULL));

-- ── 2. Customer and supplier GST type to the five codes ────────────────────
UPDATE sales.customers c
   SET cus_gst_type = x.new_type
  FROM (
    SELECT cus_id,
           CASE upper(regexp_replace(coalesce(cus_gst_type, ''), '[[:space:]_-]', '', 'g'))
                WHEN 'REGULAR'      THEN 'REGULAR'
                WHEN 'COMPOSITION'  THEN 'COMPOSITION'
                WHEN 'SEZ'          THEN 'SEZ'
                WHEN 'SEZUNIT'      THEN 'SEZ'
                WHEN 'OVERSEAS'     THEN 'OVERSEAS'
                WHEN 'UNREGISTERED' THEN 'UNREGISTERED'
                ELSE CASE WHEN cus_gst_no ~ '^[0-9]{2}[0-9A-Z]{10}[0-9A-Z]{3}$'
                          THEN 'REGULAR' ELSE 'UNREGISTERED' END
           END AS new_type
      FROM sales.customers
  ) x
 WHERE c.cus_id = x.cus_id
   AND c.cus_gst_type IS DISTINCT FROM x.new_type;

UPDATE purchase.suppliers s
   SET sup_gst_type = x.new_type
  FROM (
    SELECT sup_id,
           CASE upper(regexp_replace(coalesce(sup_gst_type, ''), '[[:space:]_-]', '', 'g'))
                WHEN 'REGULAR'      THEN 'REGULAR'
                WHEN 'COMPOSITION'  THEN 'COMPOSITION'
                WHEN 'SEZ'          THEN 'SEZ'
                WHEN 'SEZUNIT'      THEN 'SEZ'
                WHEN 'OVERSEAS'     THEN 'OVERSEAS'
                WHEN 'UNREGISTERED' THEN 'UNREGISTERED'
                ELSE CASE WHEN sup_gst_no ~ '^[0-9]{2}[0-9A-Z]{10}[0-9A-Z]{3}$'
                          THEN 'REGULAR' ELSE 'UNREGISTERED' END
           END AS new_type
      FROM purchase.suppliers
  ) x
 WHERE s.sup_id = x.sup_id
   AND s.sup_gst_type IS DISTINCT FROM x.new_type;

-- ── 3. State code 96 Other Country ─────────────────────────────────────────
INSERT INTO fixed.state_codes
    (state_code, state_name, state_ut, tin_code, is_active, is_deleted, created_by, modified_by)
VALUES ('96', 'Other Country', false, '96', true, false, 'system', 'system')
ON CONFLICT (state_code) DO NOTHING;

-- ── 4. Read-time last billed: posted bills of a customer ───────────────────
CREATE INDEX IF NOT EXISTS ix_sb_cust_posted
    ON sales.sale_bill USING btree (sb_cust_id, sb_bill_date DESC)
    WHERE sb_status = 'POSTED' AND sb_is_deleted = false;

-- ── 4b. One-time reset of the master-save billed columns (Q9 = B) ─────────
UPDATE sales.customers
   SET cus_billed_date = NULL,
       cus_billed_count = 0
 WHERE cus_billed_date IS NOT NULL
    OR cus_billed_count <> 0;

UPDATE purchase.suppliers
   SET sup_billed_date = NULL
 WHERE sup_billed_date IS NOT NULL;

-- ── 5. Plain wording rows (notes 120), catalogue 2026-10-29.1 ──────────────
INSERT INTO fixed.error_message
    (erm_code, erm_variant, erm_lang, erm_title, erm_line, erm_todo)
VALUES
     ('CUSTOMER_HAS_BALANCE', '', 'en', 'Cannot delete customer', 'This customer''s balance is not zero.', 'Settle it to zero first, then delete.')
    ,('PURCHASE_SUPPLIER_HAS_BALANCE', '', 'en', 'Cannot delete supplier', 'This supplier''s balance is not zero.', 'Settle it to zero first, then delete.')
    ,('CUSTOMER_HAS_CHEQUE_IN_HAND', '', 'en', 'Cannot delete customer', 'A cheque from this customer is not cleared yet.', 'Clear or return the cheque first.')
    ,('PURCHASE_SUPPLIER_HAS_CHEQUE_IN_HAND', '', 'en', 'Cannot delete supplier', 'A cheque to this supplier is not cleared yet.', 'Clear or cancel the cheque first.')
    ,('CUSTOMER_GST_TYPE_INVALID', '', 'en', 'Wrong GST type', 'GST type must be Regular, Composition, SEZ, Overseas or Unregistered.', 'Pick one from the list.')
    ,('PURCHASE_SUPPLIER_GST_TYPE_INVALID', '', 'en', 'Wrong GST type', 'GST type must be Regular, Composition, SEZ, Overseas or Unregistered.', 'Pick one from the list.')
    ,('CUSTOMER_GST_TYPE_REQUIRED', '', 'en', 'GST type missing', 'This customer has a GST No but no GST type.', 'Pick the GST type.')
    ,('CUSTOMER_GSTIN_REQUIRED', '', 'en', 'GST No needed', 'A Regular, Composition or SEZ customer must have a GST No.', 'Type the GST No, or choose Unregistered.')
    ,('PURCHASE_SUPPLIER_GSTIN_REQUIRED', '', 'en', 'GST No needed', 'A Regular, Composition or SEZ supplier must have a GST No.', 'Type the GST No, or choose Unregistered.')
    ,('CUSTOMER_GSTIN_NOT_ALLOWED', '', 'en', 'GST No not allowed', 'An Unregistered or Overseas customer has no GST No.', 'Clear the GST No, or choose Regular.')
    ,('PURCHASE_SUPPLIER_GSTIN_NOT_ALLOWED', '', 'en', 'GST No not allowed', 'An Unregistered or Overseas supplier has no GST No.', 'Clear the GST No, or choose Regular.')
    ,('CUSTOMER_OVERSEAS_STATE', '', 'en', 'Wrong state', 'An overseas customer''s state must be "Other Country".', 'Choose Other Country as the state.')
    ,('PURCHASE_SUPPLIER_OVERSEAS_STATE', '', 'en', 'Wrong state', 'An overseas supplier''s state must be "Other Country".', 'Choose Other Country as the state.')
    ,('PURCHASE_SUPPLIER_GSTIN_STATE_MISMATCH', '', 'en', 'GST No and state differ', 'This GST No is from another state.', 'Correct the GST No or the state.')
    ,('CUSTOMER_COMPANY_HAS_BOOKS', '', 'en', 'Cannot change company', 'This party has entries in its company.', 'Keep the company. Make a new party for the other company.')
    ,('PURCHASE_SUPPLIER_COMPANY_HAS_BOOKS', '', 'en', 'Cannot change company', 'This party has entries in its company.', 'Keep the company. Make a new party for the other company.')
    ,('CUSTOMER_PRICE_LEVEL_NOT_FOUND', '', 'en', 'Price level not found', 'This price level is not there.', 'Pick the price level again.')
    ,('CUSTOMER_BRANCH_NOT_FOUND', '', 'en', 'Branch not found', 'This branch is not there.', 'Pick the branch again.')
    ,('CUSTOMER_GSTIN_STATE_MISMATCH', '', 'en', 'GST No and state differ', 'This GST No is from another state.', 'Correct the GST No or the state.')
    ,('LOOKUP_COMPANY_NOT_FOUND', '', 'en', 'Company not found', 'This company is not there.', 'Pick the company again.')
    ,('VALIDATION_IS_GSTIN', '', 'en', 'Wrong GST No', 'This GST No / UIN is not in the right form.', 'Check the 15 letters and numbers.')
    ,('VALIDATION_IS_GSTIN', 'field=cusEcommerceGstin', 'en', 'Wrong GST No', 'The e-commerce GST No is not in the right form.', 'Check the 15 letters and numbers.')
    ,('VALIDATION_IS_PAN', '', 'en', 'Wrong PAN', 'The PAN is not in the right form.', 'Type it like ABCDE1234F.')
    ,('VALIDATION_IS_EMAIL', '', 'en', 'Wrong e-mail', 'The e-mail address is not right.', 'Type it like name@example.com.')
    ,('CUSTOMER_NAME_REQUIRED', '', 'en', 'Name needed', 'The customer name is empty.', 'Type the customer name.')
    ,('CUSTOMER_STATE_NAME_REQUIRED', '', 'en', 'State needed', 'The state is empty.', 'Pick the state.')
    ,('CUSTOMER_STATE_CODE_INVALID', '', 'en', 'Wrong state', 'The state code is wrong.', 'Pick the state again.')
    ,('CUSTOMER_INVALID_DATE', '', 'en', 'Wrong date', 'A date is not right.', 'Check the dates.')
    ,('CUSTOMER_NOT_FOUND', '', 'en', 'Not found', 'This customer is not there now.', 'Refresh the list.')
    ,('CUSTOMER_DUPLICATE', '', 'en', 'Already there', 'A customer with the same details is already saved.', 'Check the name, or refresh the list.')
    ,('CUSTOMER_NAME_EXISTS', '', 'en', 'Name already used', 'Another account already has this name.', 'Type a different name.')
    ,('CUSTOMER_LINK_LEDGER_ON_UPDATE', '', 'en', 'Something went wrong', 'The app sent a wrong request.', 'Send a photo of this to support.')
    ,('CUSTOMER_LINK_LEDGER_NOT_FOUND', '', 'en', 'Account not found', 'This account is not there now.', 'Pick the account again.')
    ,('CUSTOMER_LINK_LEDGER_NOT_PARTY', '', 'en', 'Not a party account', 'Only a party account can become a customer.', 'Pick a party account.')
    ,('CUSTOMER_LINK_LEDGER_ALREADY_CUSTOMER', '', 'en', 'Already a customer', 'This account is already a customer.', 'Open that customer instead.')
    ,('CUSTOMER_AREA_NOT_FOUND', '', 'en', 'Area not found', 'This area is not there.', 'Pick the area again.')
    ,('CUSTOMER_COMPANY_NOT_FOUND', '', 'en', 'Company not found', 'This company is not there.', 'Pick the company again.')
    ,('CUSTOMER_STATE_NOT_FOUND', '', 'en', 'State not found', 'This state is not in the list.', 'Pick the state again.')
    ,('CUSTOMER_UNKNOWN_GROUP', '', 'en', 'Group not found', 'This customer group is not there.', 'Pick the group again.')
    ,('CUSTOMER_GROUP_NAME_REQUIRED', '', 'en', 'Name needed', 'The group name is empty.', 'Type the group name.')
    ,('CUSTOMER_GROUP_NAME_EXISTS', '', 'en', 'Name already used', 'Another customer group has this name.', 'Type a different name.')
    ,('CUSTOMER_GROUP_NOT_FOUND', '', 'en', 'Not found', 'This customer group is not there now.', 'Refresh the list.')
    ,('CUSTOMER_GROUP_COMPANY_NOT_FOUND', '', 'en', 'Company not found', 'This company is not there.', 'Pick the company again.')
    ,('CUSTOMER_GROUP_HAS_CUSTOMERS', '', 'en', 'Cannot delete group', 'Some customers are still in this group.', 'Move them to another group first.')
    ,('LOOKUP_CUSTOMER_NOT_FOUND', '', 'en', 'Customer not found', 'This customer is not there now.', 'Pick the customer again.')
    ,('LOOKUP_ITEM_NOT_FOUND', '', 'en', 'Item not found', 'This item is not there now.', 'Pick the item again.')
    ,('LOOKUP_LOT_NOT_FOUND', '', 'en', 'Lot not found', 'This lot is not there for this item.', 'Pick the lot again.')
    ,('LOOKUP_PRICE_NOT_FOUND', '', 'en', 'No price', 'This item has no price.', 'Set the price in the item master.')
    ,('LOOKUP_BUCKET_PRICE_NOT_FOUND', '', 'en', 'No price', 'This item has no price at this MRP.', 'Pick another MRP, or set the price.')
    ,('LOOKUP_LOADING_SCOPE_REQUIRED', '', 'en', 'Something went wrong', 'The app sent a wrong request.', 'Send a photo of this to support.')
    ,('LOOKUP_LOADING_WEIGHT_MISSING', '', 'en', 'Weight missing', 'This item''s unit has no weight, so loading cannot be worked out.', 'Set the weight in the item''s units.')
    ,('LOOKUP_BARCODE_NOT_FOUND', '', 'en', 'Barcode not found', 'No item has this barcode.', 'Check the barcode, or add it to the item.')
    ,('LOOKUP_BARCODE_ITEM_NOT_FOUND', '', 'en', 'Item not here', 'This barcode''s item is not in this company or branch.', 'Check the barcode.')
    ,('LOOKUP_DOCUMENT_NOT_FOUND', '', 'en', 'Not found', 'No document has this number here.', 'Check the number.')
    ,('PURCHASE_SUPPLIER_NAME_REQUIRED', '', 'en', 'Name needed', 'The supplier name is empty.', 'Type the supplier name.')
    ,('PURCHASE_SUPPLIER_PURCHASE_TYPE_REQUIRED', '', 'en', 'Purchase type needed', 'The purchase type is empty.', 'Pick the purchase type.')
    ,('PURCHASE_SUPPLIER_STATE_NAME_REQUIRED', '', 'en', 'State needed', 'The state is empty.', 'Pick the state.')
    ,('PURCHASE_SUPPLIER_GST_TYPE_REQUIRED', '', 'en', 'GST type missing', 'The GST type is empty.', 'Pick the GST type.')
    ,('PURCHASE_SUPPLIER_STATE_CODE_INVALID', '', 'en', 'Wrong state', 'The state code is wrong.', 'Pick the state again.')
    ,('PURCHASE_SUPPLIER_NOT_FOUND', '', 'en', 'Not found', 'This supplier is not there now.', 'Refresh the list.')
    ,('PURCHASE_SUPPLIER_NAME_EXISTS', '', 'en', 'Name already used', 'Another supplier or account already has this name.', 'Type a different name.')
    ,('PURCHASE_SUPPLIER_UNKNOWN_GROUP', '', 'en', 'Group not found', 'This supplier group is not there.', 'Pick the group again.')
    ,('PURCHASE_SUPPLIER_LINK_LEDGER_ON_UPDATE', '', 'en', 'Something went wrong', 'The app sent a wrong request.', 'Send a photo of this to support.')
    ,('PURCHASE_SUPPLIER_LINK_LEDGER_NOT_FOUND', '', 'en', 'Account not found', 'This account is not there now.', 'Pick the account again.')
    ,('PURCHASE_SUPPLIER_LINK_LEDGER_NOT_PARTY', '', 'en', 'Not a party account', 'Only a party account can become a supplier.', 'Pick a party account.')
    ,('PURCHASE_SUPPLIER_LINK_LEDGER_ALREADY_SUPPLIER', '', 'en', 'Already a supplier', 'This account is already a supplier.', 'Open that supplier instead.')
    ,('PURCHASE_SUPPLIER_BANK_WITH_LINK_LEDGER', '', 'en', 'Save first', 'Bank details cannot go in the same save.', 'Save the supplier, then add the bank details.')
    ,('PURCHASE_SUPPLIER_GROUP_NAME_REQUIRED', '', 'en', 'Name needed', 'The group name is empty.', 'Type the group name.')
    ,('PURCHASE_SUPPLIER_GROUP_NAME_EXISTS', '', 'en', 'Name already used', 'Another supplier group has this name.', 'Type a different name.')
    ,('PURCHASE_SUPPLIER_GROUP_NOT_FOUND', '', 'en', 'Not found', 'This supplier group is not there now.', 'Refresh the list.')
    ,('PURCHASE_SUPPLIER_GROUP_HAS_SUPPLIERS', '', 'en', 'Cannot delete group', 'Some suppliers are still in this group.', 'Move them to another group first.')
    ,('VALIDATION_MIN', 'field=cusDiscPerc', 'en', 'Wrong discount', 'Discount must be 0 to 100.', 'Type a discount from 0 to 100.')
    ,('VALIDATION_MAX', 'field=cusDiscPerc', 'en', 'Wrong discount', 'Discount must be 0 to 100.', 'Type a discount from 0 to 100.')
    ,('VALIDATION_MIN', 'field=cgrDiscPerc', 'en', 'Wrong discount', 'Discount must be 0 to 100.', 'Type a discount from 0 to 100.')
    ,('VALIDATION_MAX', 'field=cgrDiscPerc', 'en', 'Wrong discount', 'Discount must be 0 to 100.', 'Type a discount from 0 to 100.')
ON CONFLICT (erm_code, erm_variant, erm_lang) DO NOTHING;

UPDATE fixed.error_message_catalogue
   SET emc_version   = '2026-10-29.1',
       emc_row_count = (SELECT count(*) FROM fixed.error_message WHERE erm_is_active),
       emc_loaded_on = now()
 WHERE emc_id = 1
   AND emc_version < '2026-10-29.1';
