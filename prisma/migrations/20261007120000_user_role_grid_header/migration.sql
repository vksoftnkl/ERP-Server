-- ════════════════════════════════════════════════════════════════════════════
-- User list (grid 62): the usr_type column is headed "Role" (notes 96)
-- ════════════════════════════════════════════════════════════════════════════
--
-- User Administration now labels usr_type "User Role" and adds SUPERVISOR to
-- UserType (enum-only, usr_type has no CHECK). The column is still usr_type; only
-- the heading changes. prisma/seed/Grid_Columns.sql carries the same heading, so
-- a fresh database agrees with this one.
--
-- Guarded on the seeded heading so a site that named the column itself keeps it;
-- on a fresh database the grid is seeded after migrations and this is a no-op.

UPDATE fixed.grid_columns
   SET grid_column_name = 'Role',
       grid_column_modified_by = 'system',
       grid_column_modified_on = CURRENT_TIMESTAMP
 WHERE grid_id = 62
   AND grid_column_sql_field_name = 'usr_type'
   AND grid_column_name = 'Type';
