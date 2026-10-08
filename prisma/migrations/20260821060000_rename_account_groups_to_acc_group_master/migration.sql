-- Rename accounts.account_groups -> accounts.acc_group_master.
-- Pure rename: no DROP/CREATE, every existing row is preserved. Written by hand
-- because `migrate dev` turns an @@map change into a destructive drop+create.

ALTER TABLE accounts.account_groups RENAME TO acc_group_master;

-- Keep the Prisma-owned constraint names in line with the new table name
-- (renaming the PK constraint renames its backing index too). The hand-named
-- idx_acc_group_* / uq_acc_group_tally_guid indexes already carry the new
-- prefix and are left as-is.
ALTER TABLE accounts.acc_group_master
  RENAME CONSTRAINT account_groups_pkey TO acc_group_master_pkey;
ALTER TABLE accounts.acc_group_master
  RENAME CONSTRAINT account_groups_acc_group_company_id_fkey
  TO acc_group_master_acc_group_company_id_fkey;
ALTER TABLE accounts.acc_group_master
  RENAME CONSTRAINT account_groups_acc_group_parent_id_fkey
  TO acc_group_master_acc_group_parent_id_fkey;

-- SQL stored as data (grids, dropdowns, audit screens) still points at the old
-- table name; rewrite those payloads in place.
DO $$
BEGIN
  IF to_regclass('fixed.grid_details') IS NOT NULL THEN
    UPDATE fixed.grid_details
       SET grid_sql = replace(grid_sql, 'accounts.account_groups', 'accounts.acc_group_master')
     WHERE grid_sql LIKE '%accounts.account_groups%';
  END IF;

  IF to_regclass('fixed.dropdown_details') IS NOT NULL THEN
    UPDATE fixed.dropdown_details
       SET dropdown_sql = replace(dropdown_sql, 'accounts.account_groups', 'accounts.acc_group_master')
     WHERE dropdown_sql LIKE '%accounts.account_groups%';
  END IF;

  IF to_regclass('audit.audit_screen') IS NOT NULL THEN
    UPDATE audit.audit_screen
       SET screen_audit_sql = replace(screen_audit_sql, 'accounts.account_groups', 'accounts.acc_group_master')
     WHERE screen_audit_sql LIKE '%accounts.account_groups%';
  END IF;
END $$;
