-- Add acc_voucher_doc_ewaybill checks and ensure the expected FK/unique names exist.

CREATE UNIQUE INDEX IF NOT EXISTS "uq_gdw_gdr"
ON "accounts"."acc_voucher_doc_ewaybill" ("gdw_gdr_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_doc_ewaybill'
      AND constraint_name = 'uq_gdw_gdr'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_ewaybill"
      ADD CONSTRAINT "uq_gdw_gdr"
      UNIQUE USING INDEX "uq_gdw_gdr";
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'accounts'
      AND table_name = 'acc_voucher_doc_ewaybill'
      AND constraint_name = 'fk_gdw_gdr'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_ewaybill"
      ADD CONSTRAINT "fk_gdw_gdr"
      FOREIGN KEY ("gdw_gdr_id")
      REFERENCES "accounts"."acc_voucher_doc_register"("gdr_id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_ewaybill'
      AND c.conname = 'chk_gdw_status'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_ewaybill"
      ADD CONSTRAINT "chk_gdw_status"
      CHECK (
        "gdw_status" IN (
          'NA'::"accounts"."GdwStatus",
          'PENDING'::"accounts"."GdwStatus",
          'GENERATED'::"accounts"."GdwStatus",
          'FAILED'::"accounts"."GdwStatus",
          'CANCELED'::"accounts"."GdwStatus",
          'EXPIRED'::"accounts"."GdwStatus"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_ewaybill'
      AND c.conname = 'chk_gdw_transport_mode'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_ewaybill"
      ADD CONSTRAINT "chk_gdw_transport_mode"
      CHECK (
        "gdw_transport_mode" IS NULL
        OR "gdw_transport_mode" IN (
          'ROAD'::"accounts"."GdwTransportMode",
          'RAIL'::"accounts"."GdwTransportMode",
          'AIR'::"accounts"."GdwTransportMode",
          'SHIP'::"accounts"."GdwTransportMode",
          'OTHER'::"accounts"."GdwTransportMode"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_ewaybill'
      AND c.conname = 'chk_gdw_vehicle_type'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_ewaybill"
      ADD CONSTRAINT "chk_gdw_vehicle_type"
      CHECK (
        "gdw_vehicle_type" IS NULL
        OR "gdw_vehicle_type" IN (
          'REGULAR'::"accounts"."GdwVehicleType",
          'ODC'::"accounts"."GdwVehicleType",
          'OTHER'::"accounts"."GdwVehicleType"
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_ewaybill'
      AND c.conname = 'chk_gdw_generated_no'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_ewaybill"
      ADD CONSTRAINT "chk_gdw_generated_no"
      CHECK (
        "gdw_status" <> 'GENERATED'::"accounts"."GdwStatus"
        OR "gdw_no" IS NOT NULL
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_ewaybill'
      AND c.conname = 'chk_gdw_canceled_date'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_ewaybill"
      ADD CONSTRAINT "chk_gdw_canceled_date"
      CHECK (
        "gdw_status" <> 'CANCELED'::"accounts"."GdwStatus"
        OR "gdw_canceled_on" IS NOT NULL
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_ewaybill'
      AND c.conname = 'chk_gdw_distance'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_ewaybill"
      ADD CONSTRAINT "chk_gdw_distance"
      CHECK (COALESCE("gdw_distance_km", 0) >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'accounts'
      AND t.relname = 'acc_voucher_doc_ewaybill'
      AND c.conname = 'chk_gdw_transporter_id_len'
  ) THEN
    ALTER TABLE "accounts"."acc_voucher_doc_ewaybill"
      ADD CONSTRAINT "chk_gdw_transporter_id_len"
      CHECK (
        "gdw_transporter_id" IS NULL
        OR char_length("gdw_transporter_id") <= 15
      );
  END IF;
END $$;
