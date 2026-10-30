-- Purchase Order (menu 23): Agent becomes a real type-to-search dropdown (NexDropdownSingle),
-- like Salesman on the sale bill. Dropdown 45 SALES AGENTS reads sales.sale_agents, not the
-- purchase agents (purchase.pur_agent, grid 194 AGENTS, menu 28), so a purchase one is registered.
--
-- Id 74 where it is free (73 = PO TERMS is the highest on dev); elsewhere the next id from the
-- sequence. The live DB is seeded apart from dev, so a hard-coded id must never fail the deploy
-- (P3009): the desktop finds the dropdown by NAME through /dropdown-details/get?search=, 74 is
-- only its fallback. Param icompany_id, always sent by the screen. Idempotent by name. No sync
-- calls (fixed.dropdown_* carry no sync triggers).

-- The sequence first, so nextval below can never hand out an id that is already taken.
SELECT setval(pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id'),
              GREATEST((SELECT max(dropdown_id) FROM fixed.dropdown_details),
                       (SELECT last_value FROM fixed.dropdown_details_dropdown_id_seq)));

INSERT INTO fixed.dropdown_details
       (dropdown_id, dropdown_name, dropdown_description, dropdown_sql,
        dropdown_sort_order, dropdown_sort_column, dropdown_completion,
        dropdown_max_visible_items, dropdown_show_header, dropdown_width,
        dropdown_device_type, dropdown_created_by)
SELECT CASE WHEN EXISTS (SELECT 1 FROM fixed.dropdown_details WHERE dropdown_id = 74)
            THEN nextval(pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id'))
            ELSE 74 END,
       'PURCHASE AGENTS',
       'Purchase agents / brokers (purchase.pur_agent): live and active, this company''s and the shared ones, by name. Param icompany_id, always sent.',
$d$SELECT pag_id,
       pag_code,
       pag_name
  FROM purchase.pur_agent
 WHERE pag_is_deleted = false
   AND pag_is_active = true
   AND (pag_company_id IS NULL OR pag_company_id::text = 'icompany_id')
 ORDER BY pag_name$d$,
       'asc', 'pag_name', 'pag_name', 10, false, 0, 'Desktop', 'system'
 WHERE NOT EXISTS (SELECT 1 FROM fixed.dropdown_details WHERE dropdown_name = 'PURCHASE AGENTS');

SELECT setval(pg_get_serial_sequence('fixed.dropdown_details', 'dropdown_id'),
              GREATEST((SELECT max(dropdown_id) FROM fixed.dropdown_details),
                       (SELECT last_value FROM fixed.dropdown_details_dropdown_id_seq)));

INSERT INTO fixed.dropdown_columns
       (dropdown_columns_dropdown_id, dropdown_columns_no, dropdown_columns_data_type,
        dropdown_columns_name, dropdown_columns_alias, dropdown_columns_width,
        dropdown_columns_visiblity, dropdown_columns_allignment, dropdown_columns_filter,
        dropdown_columns_sql_name, dropdown_columns_created_by)
SELECT d.dropdown_id, v.no, 'text', v.name, v.name, v.width, v.visible, 'Left', v.filter, v.field, 'system'
  FROM fixed.dropdown_details d
 CROSS JOIN (VALUES
    (0, '#',     10.00, false, false, 'pag_id'),
    (1, 'Code',  20.00, true,  true,  'pag_code'),
    (2, 'Agent', 80.00, true,  true,  'pag_name')
  ) AS v(no, name, width, visible, filter, field)
 WHERE d.dropdown_name = 'PURCHASE AGENTS'
   AND NOT EXISTS (SELECT 1 FROM fixed.dropdown_columns c WHERE c.dropdown_columns_dropdown_id = d.dropdown_id);
