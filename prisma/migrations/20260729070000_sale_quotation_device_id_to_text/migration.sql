-- sq_device_id held a uuid, but clients identify the originating device with a
-- fingerprint / hostname string that is not a uuid at all. Widen the column to
-- text; every existing uuid value casts cleanly, so no data is lost and the
-- change is a plain USING cast (Postgres cannot do uuid -> text implicitly).
ALTER TABLE "sales"."sale_quotation"
  ALTER COLUMN "sq_device_id" TYPE text USING "sq_device_id"::text;
