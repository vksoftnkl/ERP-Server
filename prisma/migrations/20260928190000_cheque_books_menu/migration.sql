-- ═══════════════════════════════════════════════════════════════════════════
--  notes (58): Cheque Books as their own menu under &5 Accounts. 2026-09-28.
--
--  The cheque-book master used to be reached only through Issued Cheques
--  (menu 52) and judged on 52's rights. The Qt screen is registered on menu
--  263; /cheque-books/* is now judged on 263 (cheque-books.service.ts):
--  get = VIEW, create = CREATE, edit / close = EDIT. A book is closed, never
--  deleted, and nothing here posts or prints, so the verbs are the three.
--  Same pattern as 259-262 (20260925160000): a PINNED id, guarded, and the
--  serial kept ahead of it. Menu_Master.sql carries the same row for a
--  fresh database.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  taken text;
BEGIN
  SELECT menu_name INTO taken FROM fixed.menu_master WHERE menu_id = 263;
  IF taken IS NOT NULL AND taken <> 'Cheque Books' THEN
    RAISE EXCEPTION '20260928190000_cheque_books_menu: menu id 263 is already "%" — the client is registered on 263; pick another id and tell the client', taken;
  END IF;
END $$;

INSERT INTO fixed.menu_master
       (menu_id, menu_parent, menu_name, menu_visiblity, menu_position, menu_is_active, menu_separator, menu_verbs)
SELECT 263, 5, 'Cheque Books', true, 13.10, true, false, '{VIEW,CREATE,EDIT}'::text[]
 WHERE EXISTS (SELECT 1 FROM fixed.menu_master p WHERE p.menu_id = 5)                    -- no tree yet = fresh database
   AND NOT EXISTS (SELECT 1 FROM fixed.menu_master m WHERE m.menu_parent = 5 AND m.menu_name = 'Cheque Books')
ON CONFLICT (menu_id) DO NOTHING;

-- A row that came in earlier under the default verbs (a seed) gets the three.
UPDATE fixed.menu_master
   SET menu_verbs       = '{VIEW,CREATE,EDIT}',
       menu_position    = 13.10,
       menu_modified_on = now()
 WHERE menu_id = 263
   AND menu_name = 'Cheque Books'
   AND (menu_verbs <> '{VIEW,CREATE,EDIT}' OR menu_position IS DISTINCT FROM 13.10);

DO $$
BEGIN
  PERFORM setval(pg_get_serial_sequence('fixed.menu_master', 'menu_id'),
                 (SELECT GREATEST(COALESCE(MAX(menu_id), 0), 1) FROM fixed.menu_master), true);
END $$;
