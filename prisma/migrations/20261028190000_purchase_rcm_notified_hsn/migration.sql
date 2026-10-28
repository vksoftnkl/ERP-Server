-- ═══════════════════════════════════════════════════════════════════════════
--  R13 (plan addendum 2) — goods under reverse charge when bought from an UNREGISTERED supplier
--  (sec 9(4) CGST, notification 6/2024-CT(R): metal scrap of chapters 72–81 from 10-10-2024).
--  Phase 1 has no RCM self-invoice (DOC-10 → phase 2): a purchase bill line of such goods from an
--  unregistered supplier is REFUSED, with a message. Statutory data, editable: company NULL =
--  every company; an HSN on an item matches when it starts with rnh_hsn_prefix.
--  Seeded with the waste-and-scrap headings of chapters 72–81 that are plain 4-digit headings;
--  the 8101–8113 scrap sub-headings are left for the CA to add.
--  NOT APPLIED (the apply step was refused by the permission check on 2026-10-28). Until it is,
--  src/modules/purchase/common/purchase-rcm.ts uses the same seven headings from code.
--  To apply: copy to prisma/migrations/20261028190000_purchase_rcm_notified_hsn/migration.sql, then
--  npx prisma db execute --file … && npx prisma migrate resolve --applied 20261028190000_purchase_rcm_notified_hsn
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS purchase.pur_rcm_notified_hsn (
    rnh_id             uuid         NOT NULL DEFAULT uuidv7(),
    rnh_company_id     uuid         NULL,
    rnh_hsn_prefix     varchar(8)   NOT NULL,
    rnh_description    varchar(200) NOT NULL,
    rnh_notification   varchar(60)  NULL,
    rnh_effective_from date         NOT NULL,
    rnh_effective_to   date         NULL,
    rnh_is_active      boolean      NOT NULL DEFAULT true,
    rnh_created_on     timestamptz  NOT NULL DEFAULT now(),
    rnh_created_by     varchar(50)  NOT NULL DEFAULT 'SYSTEM',
    CONSTRAINT pk_pur_rcm_notified_hsn PRIMARY KEY (rnh_id),
    CONSTRAINT ck_rnh_prefix CHECK (rnh_hsn_prefix ~ '^[0-9]{2,8}$'),
    CONSTRAINT ck_rnh_dates CHECK (rnh_effective_to IS NULL OR rnh_effective_to >= rnh_effective_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_rnh_scope_prefix_from
    ON purchase.pur_rcm_notified_hsn (COALESCE(rnh_company_id, '00000000-0000-0000-0000-000000000000'::uuid), rnh_hsn_prefix, rnh_effective_from);

INSERT INTO purchase.pur_rcm_notified_hsn (rnh_hsn_prefix, rnh_description, rnh_notification, rnh_effective_from)
SELECT v.p, v.d, '6/2024-CT(R)', DATE '2024-10-10'
  FROM (VALUES ('7204', 'Ferrous waste and scrap'), ('7404', 'Copper waste and scrap'), ('7503', 'Nickel waste and scrap'),
               ('7602', 'Aluminium waste and scrap'), ('7802', 'Lead waste and scrap'), ('7902', 'Zinc waste and scrap'),
               ('8002', 'Tin waste and scrap')) AS v(p, d)
 WHERE NOT EXISTS (SELECT 1 FROM purchase.pur_rcm_notified_hsn x WHERE x.rnh_company_id IS NULL AND x.rnh_hsn_prefix = v.p);
