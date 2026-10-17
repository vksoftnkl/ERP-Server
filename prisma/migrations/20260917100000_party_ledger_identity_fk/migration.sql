-- ═══════════════════════════════════════════════════════════════════════════
--  §1.1 — cus_id / sup_id ARE led_id, and now a foreign key says so
--
--  ── THE CONVENTION ──────────────────────────────────────────────────────
--  A customer and its account ledger are ONE identity: sales.customers.cus_id
--  holds the same uuid as accounts.acc_ledger_master.led_id, and likewise for
--  purchase.suppliers.sup_id. Every module that needs a party's ledger already
--  has it — the receipt takes one partyId and resolves nothing, and
--  bill-balance's credit summary joins sales.customers ON cus_id = abl_party_id
--  on exactly this basis. acc_bill_balance, acc_vouchers and acc_voucher_header
--  all FK their party to led_id.
--
--  Nothing in the database stated it. The convention has held for everything
--  created since auto-provisioning went in (June 2026) and for nothing before
--  it, which left four LIVE parties with no ledger row at all:
--
--    test2                        019cae41-960e-789b-abf4-df9436dc7814  cus
--    SUN ELECTRONICS G            019d85b1-e237-7618-9bac-25f6666a1b9e  cus
--    GOOGLE INDIA PRIVATE LIMITED 019cc2cb-71f6-7f91-9290-f9f56f6d6d44  sup
--    NSD ELECTRICAL               019e6e0a-3c0e-7991-8d62-78852faca9ef  sup
--
--  They cannot be posted to, cannot appear in a trial balance and cannot be
--  exported. Five soft-deleted customers are in the same state; a foreign key
--  does not care about cus_is_deleted, so they are backfilled too — as deleted
--  ledgers, which keeps them out of every partial index and every UI list.
--
--  ── WHY §1 MIRRORS THREE AREAS FIRST ────────────────────────────────────
--  A customer's linked ledger hangs under the account group that shares its id
--  with the customer's AREA (area.service.ts creates the group first and
--  copies acc_group_id onto arm_id). Three legacy areas — ganesapuram,
--  Namakkal (Area), natrajapuram — predate that and have no group, and all the
--  orphan customers sit under ganesapuram. Backfilling their ledgers under some
--  other group would satisfy the FK and still leave the customers unsaveable,
--  because the update path passes cusAreaId as ledGroupId and would 400 on a
--  group that does not exist. So the areas are mirrored first, under the same
--  fixed 'Customers' parent area.service.ts uses, and the invariant holds end
--  to end.
--
--  Verified against localhost/ERP before writing:
--    · 7 orphan parties (2 live customers, 5 deleted customers, 2 live
--      suppliers). No other schema references them.
--    · No backfilled (company_id, name) pair collides with an existing ledger,
--      and none collides with another orphan.
--    · The 3 unmirrored area names collide with no existing shared group.
--
--  Every statement is NOT EXISTS / IF NOT EXISTS guarded and re-runnable.
--  PostgreSQL 18.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
--  1 · Mirror the legacy areas that never got an account group
--
--  Type, company, ledger profile and nature are INHERITED from the parent, the
--  same four area.service.ts copies — never invented here. Sort is truncated to
--  int the same way the service truncates arm_sort. acc_group_child_ids is
--  deliberately not written: §1.4 drops it in 20260917140000, and this file must
--  not depend on a column that is going.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO accounts.acc_group_master (
    acc_group_id, acc_group_company_id, acc_group_name, acc_group_short,
    acc_group_description, acc_group_sort, acc_group_parent_id,
    acc_group_type, acc_ledger_profile, acc_group_nature,
    acc_group_is_active, acc_group_is_deleted,
    acc_group_created_on, acc_group_created_by,
    acc_group_modified_on, acc_group_modified_by)
SELECT a.arm_id,
       p.acc_group_company_id,
       a.arm_name,
       a.arm_short,
       left(a.arm_description, 250),
       trunc(COALESCE(a.arm_sort, 0))::int,
       p.acc_group_id,
       p.acc_group_type,
       p.acc_ledger_profile,
       p.acc_group_nature,
       NOT a.arm_is_deleted,
       a.arm_is_deleted,
       a.arm_created_on,
       'migration:20260917100000',
       now(),
       'migration:20260917100000'
  FROM sales.area_master a
 CROSS JOIN LATERAL (
       SELECT g.acc_group_id, g.acc_group_company_id, g.acc_group_type,
              g.acc_ledger_profile, g.acc_group_nature
         FROM accounts.acc_group_master g
        WHERE g.acc_group_id = '019f081c-6764-73b0-b397-3f30a6efe73e'::uuid  -- 'Customers'
          AND NOT g.acc_group_is_deleted
       ) p
 WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_group_master g
                    WHERE g.acc_group_id = a.arm_id);


-- ═══════════════════════════════════════════════════════════════════════════
--  2 · Backfill the orphan customers' ledgers
--
--  The column list is CUSTOMER_TO_LEDGER_FIELD_MAP in customer.service.ts, so a
--  backfilled row is indistinguishable from one the service would have written.
--  led_ledger_type 'PARTY' is the uppercase domain chk_led_ledger_type permits;
--  led_is_bill_by_bill is true because a customer is always settled bill-wise.
--  led_created_on keeps the CUSTOMER's timestamp — the party really was created
--  then, and dating it now would put a 2026-03 customer's ledger after bills it
--  should predate.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO accounts.acc_ledger_master (
    led_id, led_company_id, led_branch_id, led_group_id, led_name,
    led_short, led_ledger_type, led_is_bill_by_bill,
    led_contact_person, led_email, led_tel, led_phone1, led_phone2,
    led_whatsapp_no, led_addr1, led_addr2, led_addr3, led_city, led_district,
    led_state_name, led_state_code, led_pin, led_country,
    led_region_name, led_region_addr1, led_region_addr2, led_region_addr3,
    led_region_city, led_region_district, led_region_state_name,
    led_region_country,
    led_gstin_no, led_pan_no, led_aadhar_no, led_ecommerce_gstin,
    led_remarks, led_is_active, led_is_deleted,
    led_created_on, led_created_by, led_modified_on, led_modified_by)
SELECT c.cus_id, c.cus_company_id, c.cus_branch_id, c.cus_area_id, c.cus_name,
       c.cus_short, 'PARTY', true,
       c.cus_contact_person, c.cus_email, c.cus_tel, c.cus_phone1, c.cus_phone2,
       c.cus_whatsapp_no, c.cus_addr1, c.cus_addr2, c.cus_addr3, c.cus_city,
       c.cus_district,
       c.cus_state_name, c.cus_state_code, c.cus_pin, c.cus_country,
       c.cus_region_name, c.cus_region_addr1, c.cus_region_addr2,
       c.cus_region_addr3,
       c.cus_region_city, c.cus_region_district, c.cus_region_state_name,
       c.cus_region_country,
       c.cus_gst_no, c.cus_pan_no, c.cus_aadhar_no, c.cus_ecommerce_gstin,
       c.cus_notes, c.cus_is_active AND NOT c.cus_is_deleted, c.cus_is_deleted,
       c.cus_created_on, 'migration:20260917100000',
       now(), 'migration:20260917100000'
  FROM sales.customers c
 WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_ledger_master l
                    WHERE l.led_id = c.cus_id);


-- ═══════════════════════════════════════════════════════════════════════════
--  3 · Backfill the orphan suppliers' ledgers
--
--  Same shape, against SUPPLIER_TO_LEDGER_FIELD_MAP. The group is the fixed
--  'Suppliers' group suppliers.service.ts hard-codes (a supplier has no area).
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO accounts.acc_ledger_master (
    led_id, led_company_id, led_branch_id, led_group_id, led_name,
    led_short, led_ledger_type, led_is_bill_by_bill,
    led_email, led_tel, led_phone1, led_whatsapp_no,
    led_addr1, led_addr2, led_addr3, led_city, led_district,
    led_state_name, led_state_code, led_pin, led_country,
    led_region_name, led_region_addr1, led_region_addr2, led_region_addr3,
    led_region_city, led_region_district, led_region_state_name,
    led_region_country,
    led_gstin_no, led_pan_no,
    led_remarks, led_is_active, led_is_deleted,
    led_created_on, led_created_by, led_modified_on, led_modified_by)
SELECT s.sup_id, s.sup_company_id, s.sup_branch_id,
       '019f081c-98cc-757a-9346-4cfba810c47f'::uuid,             -- 'Suppliers'
       s.sup_name,
       s.sup_short, 'PARTY', true,
       s.sup_mail_id, s.sup_tel, s.sup_phone, s.sup_whatsapp_no,
       s.sup_addr1, s.sup_addr2, s.sup_addr3, s.sup_city, s.sup_district,
       s.sup_state_name, s.sup_state_code, s.sup_pincode, s.sup_country,
       s.sup_region_name, s.sup_region_addr1, s.sup_region_addr2,
       s.sup_region_addr3,
       s.sup_region_city, s.sup_region_district, s.sup_region_state_name,
       s.sup_region_country,
       s.sup_gst_no, s.sup_pan_no,
       s.sup_notes, s.sup_is_active AND NOT s.sup_is_deleted, s.sup_is_deleted,
       s.sup_created_on, 'migration:20260917100000',
       now(), 'migration:20260917100000'
  FROM purchase.suppliers s
 WHERE NOT EXISTS (SELECT 1 FROM accounts.acc_ledger_master l
                    WHERE l.led_id = s.sup_id);


-- ═══════════════════════════════════════════════════════════════════════════
--  4 · The foreign keys
--
--  NOT VALID first, then VALIDATE: the ADD takes only a brief lock and the
--  VALIDATE scan runs without blocking writes. On a box where §2/§3 missed
--  something the VALIDATE is what fails, and it fails NAMING the offending row
--  instead of silently leaving the convention unstated.
--
--  ON DELETE RESTRICT — a ledger with a party on it must not vanish underneath
--  acc_bill_balance / acc_vouchers. ON UPDATE CASCADE so a repointed led_id
--  carries its party with it.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'fk_cus_ledger'
                    AND conrelid = 'sales.customers'::regclass) THEN
    ALTER TABLE sales.customers
      ADD CONSTRAINT fk_cus_ledger FOREIGN KEY (cus_id)
          REFERENCES accounts.acc_ledger_master(led_id)
          ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'fk_sup_ledger'
                    AND conrelid = 'purchase.suppliers'::regclass) THEN
    ALTER TABLE purchase.suppliers
      ADD CONSTRAINT fk_sup_ledger FOREIGN KEY (sup_id)
          REFERENCES accounts.acc_ledger_master(led_id)
          ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

ALTER TABLE sales.customers   VALIDATE CONSTRAINT fk_cus_ledger;
ALTER TABLE purchase.suppliers VALIDATE CONSTRAINT fk_sup_ledger;
