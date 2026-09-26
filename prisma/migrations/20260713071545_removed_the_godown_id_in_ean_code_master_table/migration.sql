-- Drop item_ean_codes.ean_godown_id.
--
-- The default-barcode rule is no longer scoped by godown: it is now scoped per
-- (ean_item_id, ean_unit_id) and enforced in the service layer
-- (ItemsEanCodeMasterService.enforceSingleDefaultInScope). No index or FK
-- referenced this column, so the drop is unconditional.

-- 1) Drop the column
ALTER TABLE "inventory"."item_ean_codes" DROP COLUMN "ean_godown_id";

-- 2) The audit screen's stored SELECT still projects the dropped column, and the
--    audit log reads that stored SQL for existing screens (the TS constants only
--    seed newly created ones). Re-point it at the surviving columns.
UPDATE audit.audit_screen
SET screen_audit_sql = $$SELECT
    ean_item_id AS "Item ID",
    ean_unit_id AS "Unit ID",
    ean_code AS "EAN / Barcode",
    ean_is_default AS "Is Default",
    ean_is_active AS "Is Active",
    ean_is_deleted AS "Is Deleted",
    ean_created_on AS "Created On",
    ean_created_by AS "Created By",
    ean_modified_on AS "Modified On",
    ean_modified_by AS "Modified By",
    ean_remarks AS "Remarks"
FROM inventory.item_ean_codes;$$
WHERE screen_name = 'Item EAN Code Master';
