-- ───────────────────────────────────────────────────────────────────────────
--  public.app_setting_def  —  masters.customer_form_defaults
--                             masters.item_form_defaults
--
--  A setting is a ROW, so this is an INSERT and nothing else — no DDL, no
--  client release (see prisma/public/appSettings.prisma).
--
--  Idempotent on asd_key (ON CONFLICT DO NOTHING), so replaying it on a
--  shadow database, or after somebody has added the key by hand, changes
--  nothing.
--
--  BRANCH scope: a master form is filled at a counter, and two branches may
--  want different starting values, but not two users at the same counter.
--
--  asd_default_value stays NULL — "nothing pre-filled" until a company or a
--  branch says otherwise.
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
     asd_allowed_values, asd_min_value, asd_max_value, asd_max_scope,
     asd_label, asd_description, asd_sort_order, asd_needs_relogin,
     asd_created_by)
VALUES

('masters.customer_form_defaults', 'MASTERS', 'Defaults', 'TEXT', NULL,
 NULL, NULL, NULL, 'BRANCH',
 'Customer form defaults',
 'Values the new-customer form starts with, so a counter that always books the same state, area or price list does not retype it. Free text; the client reads it and pre-fills the form.',
 10, false, 'SYSTEM'),

('masters.item_form_defaults', 'MASTERS', 'Defaults', 'TEXT', NULL,
 NULL, NULL, NULL, 'BRANCH',
 'Item form defaults',
 'Values the new-item form starts with — unit, tax group, category — for a branch that stocks one kind of thing. Free text; the client reads it and pre-fills the form.',
 20, false, 'SYSTEM')

ON CONFLICT (asd_key) DO NOTHING;
