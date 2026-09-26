-- Follows 20260729070445, which made sale_quotation.sq_tenant_id nullable. A
-- line inherits its tenant from the header (sqi_tenant_id := sq_tenant_id), so
-- leaving the child NOT NULL turns a tenant-less quotation into a constraint
-- violation on the first item insert.
ALTER TABLE "sales"."sale_quotation_item" ALTER COLUMN "sqi_tenant_id" DROP NOT NULL;
