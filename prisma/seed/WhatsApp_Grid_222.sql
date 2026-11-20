-- WhatsApp P1 -- grid 222 "MAIN LIST - WHATSAPP LOG", the same rows migration
-- 20261119100000_whatsapp writes (plan Shared/Prathap/whatsapp/whatsapp-plan-v1-2026-11-17.md
-- §3.4, F24). The 309 WhatsApp Log: one row per send try, newest first.
--
-- WHY A TARGETED SEED RATHER THAN AN EDIT TO Grid_Details.sql / Grid_Columns.sql
--   Those two are exports (npm run seed:export:ui-config), and Grid_Columns.sql
--   skips any grid that already has a column (precedent: DC_Grids_219_221.sql,
--   Delivery_Grids_212_218.sql). It runs after both (manifest order).
--
-- The grid_sql text is byte-identical to the migration's and holds no comment
-- marker (the runner refuses one). Tokens p_company_id, p_branch_id, p_from,
-- p_to, p_kind, p_status, p_party_id are compared as text; every caller sends
-- every token ('' = off). Timestamps leave as IST text, 12-hour; sort_key is a
-- sortable IST text for sort_by. grid_column ids are pinned (the migration's),
-- so every database ends up with the same rows.
--
-- Idempotent: ON CONFLICT (grid_id) DO NOTHING keeps a grid a site has edited;
-- a column goes in only under a grid of the expected name with no live column of
-- that number. Safe to re-run.
-- Run: psql "$DATABASE_URL" -f prisma/seed/WhatsApp_Grid_222.sql
--      or: npm run seed:run -- --only=WhatsApp_Grid_222.sql

BEGIN;

INSERT INTO fixed.grid_details
       (grid_id, grid_name, grid_description, grid_sort_column, grid_sort_order, grid_device_type,
        grid_status, grid_is_deleted, grid_created_by, grid_sql)
VALUES
(222, 'MAIN LIST - WHATSAPP LOG',
 'WhatsApp Log (menu 309): one row per send try, newest first. Tokens (send every one; '''' = no filter): p_company_id, p_branch_id, p_from, p_to (yyyy-MM-dd, on the IST send date), p_kind ('''' / BILL / ORDER / RECEIPT / REMINDER / TEST), p_status ('''' / SKIPPED / SENDING / SENT / DELIVERED / READ / FAILED), p_party_id (led_id). Reason = the plain line of wml_error_code (fixed.error_message, en), else the relay / Meta words; with no error, the language note. Note = the document is now cancelled (read at run time).',
 'sort_key', 'Descending', 'Desktop', true, false, 'system',
$g222$SELECT l.wml_id,
       l.wml_acc_year,
       l.wml_company_id,
       l.wml_branch_id,
       to_char(l.wml_created_on AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') AS sent_at,
       CASE l.wml_kind WHEN 'BILL' THEN 'Sale bill'
                       WHEN 'ORDER' THEN 'Sales order'
                       WHEN 'RECEIPT' THEN 'Receipt'
                       WHEN 'REMINDER' THEN 'Payment reminder'
                       WHEN 'TEST' THEN 'Test message'
                       ELSE l.wml_kind END AS kind_text,
       CASE WHEN l.wml_src_doc_refno IS NOT NULL THEN l.wml_src_doc_refno
            WHEN l.wml_kind = 'REMINDER' AND l.wml_as_on IS NOT NULL THEN 'Statement as on ' || to_char(l.wml_as_on, 'DD-MM-YYYY')
            ELSE '' END AS doc_text,
       COALESCE(l.wml_party_name, '') AS party_name,
       COALESCE(l.wml_phone, '') AS phone,
       CASE WHEN l.wml_template_name IS NULL THEN ''
            ELSE l.wml_template_name || ' · ' || COALESCE(l.wml_lang_sent, l.wml_lang_wanted, '') END AS template_text,
       CASE l.wml_status WHEN 'SKIPPED' THEN 'Skipped'
                         WHEN 'SENDING' THEN 'Sending'
                         WHEN 'SENT' THEN 'Sent'
                         WHEN 'DELIVERED' THEN 'Delivered'
                         WHEN 'READ' THEN 'Read'
                         WHEN 'FAILED' THEN 'Failed'
                         ELSE l.wml_status END AS status_text,
       to_char(COALESCE(CASE l.wml_status WHEN 'READ' THEN l.wml_read_on
                                          WHEN 'DELIVERED' THEN l.wml_delivered_on
                                          WHEN 'SENT' THEN l.wml_sent_on
                                          WHEN 'FAILED' THEN l.wml_failed_on
                                          WHEN 'SENDING' THEN l.wml_sending_on END,
                        l.wml_created_on) AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY HH12:MI AM') AS status_at,
       CASE WHEN l.wml_error_code IS NULL THEN COALESCE(l.wml_lang_note, '')
            ELSE COALESCE(e.erm_line, l.wml_error_text, l.wml_error_code) END AS reason_text,
       COALESCE(e.erm_todo, '') AS reason_todo,
       COALESCE(l.wml_error_text, '') AS error_detail,
       CASE l.wml_reply WHEN 'PAID_ALREADY' THEN 'Paid already'
                        WHEN 'STOP_REMINDERS' THEN 'Stop reminders'
                        WHEN 'STOP_ALL' THEN 'STOP'
                        ELSE '' END AS reply_text,
       COALESCE(NULLIF(l.wml_user_name, ''), NULLIF(u.usr_display_name, ''), u.usr_login_name, l.wml_created_by) AS by_name,
       COALESCE(b.br_name, '') AS branch_name,
       l.wml_try_no,
       CASE WHEN COALESCE(sb.sb_status, so.so_status, vh.avh_voucher_status) = 'CANCELLED'
                 AND l.wml_status IN ('SENT', 'DELIVERED', 'READ') THEN 'Cancelled after it was sent'
            WHEN COALESCE(sb.sb_status, so.so_status, vh.avh_voucher_status) = 'CANCELLED' THEN 'Document cancelled'
            ELSE '' END AS note_text,
       l.wml_kind,
       l.wml_status,
       l.wml_trigger,
       l.wml_error_code,
       l.wml_src_doc_type,
       l.wml_src_doc_id,
       l.wml_src_acc_year,
       l.wml_party_id,
       l.wml_retry_of,
       l.wml_batch_id,
       l.wml_gap_override,
       to_char(l.wml_created_on AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS.US') AS sort_key
  FROM public.wa_message_log l
  LEFT JOIN fixed.error_message e ON e.erm_code = l.wml_error_code
                                 AND e.erm_variant = ''
                                 AND e.erm_lang = 'en'
                                 AND e.erm_is_active = true
  LEFT JOIN public.user_master u ON u.usr_id = l.wml_user_id
  LEFT JOIN public.branch_master b ON b.br_id = l.wml_branch_id
  LEFT JOIN sales.sale_bill sb ON l.wml_src_doc_type = 'SALE_BILL'
                              AND sb.sb_id = l.wml_src_doc_id
                              AND sb.sb_acc_year = l.wml_src_acc_year
  LEFT JOIN sales.sale_order so ON l.wml_src_doc_type = 'SALES_ORDER'
                               AND so.so_id = l.wml_src_doc_id
                               AND so.so_acc_year = l.wml_src_acc_year
  LEFT JOIN accounts.acc_voucher_header vh ON l.wml_src_doc_type = 'RECEIPT'
                                          AND vh.avh_voucher_id = l.wml_src_doc_id
                                          AND vh.avh_acc_year = l.wml_src_acc_year
 WHERE l.wml_company_id::text = 'p_company_id'
   AND l.wml_is_deleted = false
   AND ('p_branch_id' = '' OR l.wml_branch_id::text = 'p_branch_id')
   AND (NULLIF('p_from', '') IS NULL OR to_char(l.wml_created_on AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') >= 'p_from')
   AND (NULLIF('p_to', '') IS NULL OR to_char(l.wml_created_on AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') <= 'p_to')
   AND ('p_kind' = '' OR l.wml_kind = 'p_kind')
   AND ('p_status' = '' OR l.wml_status = 'p_status')
   AND ('p_party_id' = '' OR l.wml_party_id::text = 'p_party_id')
 ORDER BY l.wml_created_on DESC, l.wml_try_no DESC$g222$)
ON CONFLICT (grid_id) DO NOTHING;

INSERT INTO fixed.grid_columns
       (grid_column_id, grid_id, grid_column_number, grid_column_name, grid_column_sql_field_name,
        grid_column_data_type, grid_column_width, grid_column_position, grid_column_alignment,
        grid_column_visibility, grid_column_filter, grid_column_group, grid_column_total,
        grid_column_notes, grid_column_is_deleted, grid_column_created_by)
SELECT v.id, v.grid, v.no, v.name, v.fld, v.typ, v.width, v.no, v.align, v.visible, v.filter,
       false, false, v.fld, false, 'system'
  FROM (VALUES
    ('01a1e9b5-2220-7000-8000-000000222001'::uuid, 222::bigint, 1::integer, '#'::text, 'wml_id'::text, 'Text'::text, 0.00::numeric, 'Left'::text, false::boolean, false::boolean),
    ('01a1e9b5-2220-7000-8000-000000222002', 222, 2, 'Year', 'wml_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222003', 222, 3, 'Company', 'wml_company_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222004', 222, 4, 'Branch id', 'wml_branch_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222005', 222, 5, 'Time', 'sent_at', 'Text', 8.00, 'Left', true, false),
    ('01a1e9b5-2220-7000-8000-000000222006', 222, 6, 'Kind', 'kind_text', 'Text', 6.00, 'Left', true, true),
    ('01a1e9b5-2220-7000-8000-000000222007', 222, 7, 'Document', 'doc_text', 'Text', 9.00, 'Left', true, true),
    ('01a1e9b5-2220-7000-8000-000000222008', 222, 8, 'Party', 'party_name', 'Text', 12.00, 'Left', true, true),
    ('01a1e9b5-2220-7000-8000-000000222009', 222, 9, 'Number', 'phone', 'Text', 8.00, 'Left', true, true),
    ('01a1e9b5-2220-7000-8000-000000222010', 222, 10, 'Template · lang', 'template_text', 'Text', 9.00, 'Left', true, false),
    ('01a1e9b5-2220-7000-8000-000000222011', 222, 11, 'Status', 'status_text', 'Text', 5.00, 'Center', true, false),
    ('01a1e9b5-2220-7000-8000-000000222012', 222, 12, 'Status time', 'status_at', 'Text', 8.00, 'Left', true, false),
    ('01a1e9b5-2220-7000-8000-000000222013', 222, 13, 'Reason', 'reason_text', 'Text', 12.00, 'Left', true, true),
    ('01a1e9b5-2220-7000-8000-000000222014', 222, 14, 'To do', 'reason_todo', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222015', 222, 15, 'Detail', 'error_detail', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222016', 222, 16, 'Reply', 'reply_text', 'Text', 5.00, 'Left', true, false),
    ('01a1e9b5-2220-7000-8000-000000222017', 222, 17, 'By', 'by_name', 'Text', 5.00, 'Left', true, true),
    ('01a1e9b5-2220-7000-8000-000000222018', 222, 18, 'Branch', 'branch_name', 'Text', 5.00, 'Left', true, false),
    ('01a1e9b5-2220-7000-8000-000000222019', 222, 19, 'Tries', 'wml_try_no', 'Number', 3.00, 'Right', true, false),
    ('01a1e9b5-2220-7000-8000-000000222020', 222, 20, 'Note', 'note_text', 'Text', 5.00, 'Left', true, false),
    ('01a1e9b5-2220-7000-8000-000000222021', 222, 21, 'Kind code', 'wml_kind', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222022', 222, 22, 'Status code', 'wml_status', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222023', 222, 23, 'Trigger', 'wml_trigger', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222024', 222, 24, 'Error code', 'wml_error_code', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222025', 222, 25, 'Doc type', 'wml_src_doc_type', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222026', 222, 26, 'Doc id', 'wml_src_doc_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222027', 222, 27, 'Doc year', 'wml_src_acc_year', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222028', 222, 28, 'Party id', 'wml_party_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222029', 222, 29, 'Retry of', 'wml_retry_of', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222030', 222, 30, 'Batch', 'wml_batch_id', 'Text', 0.00, 'Left', false, false),
    ('01a1e9b5-2220-7000-8000-000000222031', 222, 31, 'Gap override', 'wml_gap_override', 'Boolean', 0.00, 'Center', false, false),
    ('01a1e9b5-2220-7000-8000-000000222032', 222, 32, 'Sort', 'sort_key', 'Text', 0.00, 'Left', false, false)
       ) v(id, grid, no, name, fld, typ, width, align, visible, filter)
 WHERE EXISTS (SELECT 1 FROM fixed.grid_details d
                WHERE d.grid_id = v.grid AND d.grid_name = 'MAIN LIST - WHATSAPP LOG')
   AND NOT EXISTS (SELECT 1 FROM fixed.grid_columns e
                    WHERE e.grid_id = v.grid AND e.grid_column_number = v.no AND e.grid_column_is_deleted = false)
ON CONFLICT (grid_column_id) DO NOTHING;

COMMIT;
