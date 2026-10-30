-- ════════════════════════════════════════════════════════════════════════════
-- Temp Credits (menu 257) gets CREATE and DELETE back
-- ════════════════════════════════════════════════════════════════════════════
--
-- prisma/seed/Menu_Master.sql narrowed 257 to {VIEW,EDIT,PRINT,EXPORT} on the
-- reading that the register only shows what the bill screen created. The user
-- administration grid then drew no Create / Delete cell on that row, and the
-- business wants both rights grantable there. The seed block is retired in the
-- same change, otherwise its guard would re-narrow the row on the next deploy.
--
-- Guarded on the seeded narrowing so a site that chose its own verbs keeps
-- them; on the default the row is already right and is left alone.

UPDATE fixed.menu_master
   SET menu_verbs = '{VIEW,CREATE,EDIT,DELETE,PRINT,EXPORT}'
 WHERE menu_id = 257
   AND menu_verbs = '{VIEW,EDIT,PRINT,EXPORT}';
