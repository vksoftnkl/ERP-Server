-- ───────────────────────────────────────────────────────────────────────────
--  public.app_setting_def  —  sales.quote_apply_promotion
--
--  A setting is a ROW, so this is an INSERT and nothing else — no DDL, no
--  client release (see prisma/public/appSettings.prisma).
--
--  Idempotent on asd_key (ON CONFLICT DO NOTHING), so replaying it on a
--  shadow database, or after somebody has added the key by hand, changes
--  nothing.
--
--  COMPANY scope: the switch changes what a quotation TOTALS TO, so the
--  business gets one answer, not a per-user one.
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO public.app_setting_def
    (asd_key, asd_module, asd_group, asd_data_type, asd_default_value,
     asd_allowed_values, asd_min_value, asd_max_value, asd_max_scope,
     asd_label, asd_description, asd_sort_order, asd_needs_relogin,
     asd_created_by)
VALUES
('sales.quote_apply_promotion', 'SALES', 'Quotation', 'BOOL', 'true',
 NULL, NULL, NULL, 'COMPANY',
 'Apply promotion schemes on quotations',
 'May the promotion engine price campaigns into a quotation. On, a quotation shows the same scheme discounts and free items the bill would give, so what is offered is what is billed. Off, a quotation is quoted at list price and schemes apply only when the bill is raised — which is what a business wants when a campaign may end before the offer is accepted. Off also retracts any scheme discount and free line already on the screen, and disables the quotation''s own Promotions box. Sale bills are unaffected.',
 20, false, 'SYSTEM')
ON CONFLICT (asd_key) DO NOTHING;
