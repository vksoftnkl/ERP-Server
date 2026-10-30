-- Restructure accounts.acc_ship_addrs and move its value/format checks to the app layer.
--
-- Structural changes:
--   * add saa_branch_id (nullable FK -> public.branch_master)
--   * add saa_country_code (CHAR(2) NOT NULL DEFAULT 'IN') for export ship-to support
--   * rename saa_trdnm     -> saa_trade_name   (RENAME preserves data; not a drop+create)
--   * rename saa_loc       -> saa_location
--   * rename saa_sync_date -> saa_synced_on
--   * drop saa_pan         (PAN is embedded in the GSTIN)
--   * saa_gstin -> NOT NULL (GSTIN is now mandatory)
--
-- The four CHECK constraints from the source DDL (acc_ship_addrs_addr_type_chk,
-- acc_ship_addrs_pin_chk, acc_ship_addrs_state_code_chk, acc_ship_addrs_gstin_chk)
-- are intentionally NOT created here. They cannot be expressed in the Prisma schema
-- and are enforced in the app layer instead:
--   src/modules/accountsModule/ledgerShippingAddress/types/ledger-shipping-address-enum.ts (SaaAddrType)
--   src/modules/accountsModule/ledgerShippingAddress/ledger-shipping-address.validation.ts (pin/state/gstin)
-- Mirrors the acc_ledger_master enum refactor in
-- 20260623110000_move_acc_ledger_enums_to_app_layer.

-- Renames first (data-preserving).
ALTER TABLE "accounts"."acc_ship_addrs" RENAME COLUMN "saa_trdnm" TO "saa_trade_name";
ALTER TABLE "accounts"."acc_ship_addrs" RENAME COLUMN "saa_loc" TO "saa_location";
ALTER TABLE "accounts"."acc_ship_addrs" RENAME COLUMN "saa_sync_date" TO "saa_synced_on";

-- New columns.
ALTER TABLE "accounts"."acc_ship_addrs" ADD COLUMN "saa_branch_id" UUID;
ALTER TABLE "accounts"."acc_ship_addrs" ADD COLUMN "saa_country_code" CHAR(2) NOT NULL DEFAULT 'IN';

-- Drop the now-redundant PAN column.
ALTER TABLE "accounts"."acc_ship_addrs" DROP COLUMN "saa_pan";

-- GSTIN is now mandatory. Assumes existing rows already carry a GSTIN; backfill
-- before deploying if any saa_gstin values are NULL.
ALTER TABLE "accounts"."acc_ship_addrs" ALTER COLUMN "saa_gstin" SET NOT NULL;

-- Branch foreign key + supporting index. Constraint/index names follow Prisma's
-- conventions so `prisma migrate dev` does not report drift.
ALTER TABLE "accounts"."acc_ship_addrs"
  ADD CONSTRAINT "acc_ship_addrs_saa_branch_id_fkey" FOREIGN KEY ("saa_branch_id")
  REFERENCES "public"."branch_master" ("br_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_saa_branch" ON "accounts"."acc_ship_addrs" ("saa_branch_id");
