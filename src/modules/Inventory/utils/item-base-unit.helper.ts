import { throwInventoryConflict } from 'src/common/utils/module-service.utils';
import type { InventoryErrorDetail } from 'src/common/utils/module-service.utils';

/**
 * Notes 138 — stock is counted in the item's base unit (stock_ledger.sml_base_qty),
 * so ONCE AN ITEM HAS A BASE UNIT ROW, ITS BASE UNIT NEVER CHANGES, stock or no
 * stock. "Block only while it has stock" cannot be trusted: an offline till's
 * sale is not on the server yet, a base change from PCS to BOX in between is
 * allowed, and when the till syncs its 5 PCS read as 5 BOX. The lock reads only
 * the stored base row, so every device gets the same answer at every moment.
 *
 * Still open on a saved item: both factors of any row (every txn line keeps
 * the factor it was made with), weight, remarks, the default / big-unit flags,
 * and adding or removing non-base rows. An item with no base row yet is not
 * locked — its first save sets the base. A wrong base unit is fixed by making
 * the item inactive and creating a new one.
 */

/** The item's stored base row, as the lock reads it. */
export type StoredBaseRow = { iuc_id: string; iuc_unit_id: string };

/** What a save states about one conversion row; iuc_id names the stored row it writes. */
export type BaseUnitFields = {
  iuc_id?: string;
  iuc_unit_id?: string;
  iuc_base_unit_id?: string;
  iuc_is_base_unit?: boolean;
};

const HOW_TO_FIX =
  'A saved item keeps its base unit: to count it in another unit, make this item inactive ' +
  'and create a new one.';

/**
 * The first column of `row` that would change the base unit fixed by `base`,
 * with why, or null when the row leaves it alone: the base row re-pointed at
 * another unit or un-marked, any other row marked base, or any row naming
 * another base unit.
 */
export function baseUnitChange(
  base: StoredBaseRow,
  row: BaseUnitFields,
): { column: string; message: string } | null {
  const isBaseRow = row.iuc_id === base.iuc_id;
  if (isBaseRow && row.iuc_unit_id !== undefined && row.iuc_unit_id !== base.iuc_unit_id) {
    return {
      column: 'iuc_unit_id',
      message: `Unit conversion ${base.iuc_id} is the item's base row; its unit stays ${base.iuc_unit_id}.`,
    };
  }
  if (isBaseRow && row.iuc_is_base_unit === false) {
    return {
      column: 'iuc_is_base_unit',
      message: `Unit conversion ${base.iuc_id} is the item's base row and stays marked as base.`,
    };
  }
  if (!isBaseRow && row.iuc_is_base_unit === true) {
    return {
      column: 'iuc_is_base_unit',
      message: `Only the item's base row (${base.iuc_id}, unit ${base.iuc_unit_id}) is marked as base.`,
    };
  }
  if (row.iuc_base_unit_id !== undefined && row.iuc_base_unit_id !== base.iuc_unit_id) {
    return {
      column: 'iuc_base_unit_id',
      message: `iuc_base_unit_id stays ${base.iuc_unit_id}, the item's base unit.`,
    };
  }
  return null;
}

/** 409 `code` on `field`: the save would change a saved item's base unit. */
export function refuseBaseUnitChange(code: string, field: string, message: string): never {
  return throwInventoryConflict<InventoryErrorDetail>("A saved item's base unit cannot change", [
    { field, code, message: `${message} ${HOW_TO_FIX}` },
  ]);
}
