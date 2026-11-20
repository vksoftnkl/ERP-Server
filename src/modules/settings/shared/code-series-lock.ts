import type { SettingsWriteClient } from 'src/common/utils/module-service.utils';

/** One code series: the table and the column whose codes one save at a time picks. */
export interface CodeSeries {
  readonly table: string;
  readonly column: string;
}

/**
 * Company + Branch master plan C1 / C9a (18/11/2026): company codes and Branch
 * Codes are ONE series — a company create writes its code and its Main
 * Branch's code, and (19/11 review, N2) a branch save that sets a typed brCode
 * takes the same lock, so it cannot take the Main Branch code a company create
 * is about to write.
 */
export const COMPANY_CODE_SERIES: CodeSeries = { table: 'public.companys', column: 'comp_code' };
/** HR masters review step 5 (20/11/2026). */
export const DEPARTMENT_CODE_SERIES: CodeSeries = {
  table: 'public.employee_departments',
  column: 'edpt_code',
};
export const DESIGNATION_CODE_SERIES: CodeSeries = {
  table: 'public.employee_designations',
  column: 'ed_code',
};
export const EMPLOYEE_CODE_SERIES: CodeSeries = {
  table: 'public.employee_master',
  column: 'emp_code',
};
/**
 * Inventory masters review (20/11/2026): the Short Name a blank one is made
 * from the name for (Item Group, Brand, Section, Category, Godown).
 */
export const ITEM_GROUP_SHORT_SERIES: CodeSeries = {
  table: 'inventory.item_group_master',
  column: 'itg_short',
};
export const ITEM_BRAND_SHORT_SERIES: CodeSeries = {
  table: 'inventory.item_brand_master',
  column: 'brand_short',
};
export const ITEM_SECTION_SHORT_SERIES: CodeSeries = {
  table: 'inventory.item_section_master',
  column: 'sec_short',
};
export const ITEM_CATEGORY_SHORT_SERIES: CodeSeries = {
  table: 'inventory.item_category_master',
  column: 'category_short',
};
/** One lock for every branch's godowns; the clash itself is judged per branch. */
export const GODOWN_SHORT_SERIES: CodeSeries = {
  table: 'inventory.godown_locations',
  column: 'gdl_short',
};

/**
 * One transaction at a time reads and takes a code of `series`. Held until the
 * transaction ends; the unique indexes stay the last word. The key is
 * hashtext(table), hashtext(column), so the company series keeps the key it
 * always had.
 */
export async function lockCodeSeries(tx: SettingsWriteClient, series: CodeSeries): Promise<void> {
  await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext(${series.table}::text), hashtext(${series.column}::text)))::int AS locked`;
}
