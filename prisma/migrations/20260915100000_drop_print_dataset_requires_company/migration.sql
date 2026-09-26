-- Retire the company-scope guard on print template datasets.
--
-- ck_ptd_sql_company_scoped refused any SQL dataset that did not bind
-- :company_id unless ptd_requires_company was false. The flag existed only to
-- switch that check off, so both go together: the constraint first, then the
-- column it read. The remaining ten SQL guards are untouched, and the actual
-- security boundary is unchanged -- bound parameters, a READ ONLY transaction
-- and a role with no write privilege.

ALTER TABLE public.print_template_dataset
  DROP CONSTRAINT IF EXISTS ck_ptd_sql_company_scoped;

ALTER TABLE public.print_template_dataset
  DROP COLUMN IF EXISTS ptd_requires_company;
