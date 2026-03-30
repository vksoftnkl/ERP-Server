-- Replace opening-stock enum columns with VARCHAR(20) columns while preserving data.

ALTER TABLE "inventory"."opening_stock_header"
  ALTER COLUMN "osh_status" DROP DEFAULT,
  ALTER COLUMN "osh_status" TYPE VARCHAR(20) USING ("osh_status"::text),
  ALTER COLUMN "osh_status" SET DEFAULT 'DRAFT',
  ALTER COLUMN "osh_device_type" TYPE VARCHAR(20) USING ("osh_device_type"::text);

ALTER TABLE "inventory"."opening_stock_detail"
  ALTER COLUMN "osl_tracking_type" DROP DEFAULT,
  ALTER COLUMN "osl_tracking_type" TYPE VARCHAR(20) USING ("osl_tracking_type"::text),
  ALTER COLUMN "osl_tracking_type" SET DEFAULT 'NONE',
  ALTER COLUMN "osl_cess_type" DROP DEFAULT,
  ALTER COLUMN "osl_cess_type" TYPE VARCHAR(20) USING ("osl_cess_type"::text),
  ALTER COLUMN "osl_cess_type" SET DEFAULT 'NONE';

DROP TYPE "inventory"."OpeningStockDeviceType";
DROP TYPE "inventory"."OpeningStockStatus";
DROP TYPE "inventory"."OpeningStockDetailCessType";
DROP TYPE "inventory"."OpeningStockDetailTrackingType";
