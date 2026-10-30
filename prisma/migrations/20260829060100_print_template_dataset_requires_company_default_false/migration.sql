-- print_template_dataset.ptd_requires_company defaults to false: a dataset is
-- company-scoped only when it says so, matching the seeded datasets.
ALTER TABLE public.print_template_dataset
  ALTER COLUMN ptd_requires_company SET DEFAULT false;
