import type { ModuleWriteClient } from 'src/common/utils/module-shared.utils';
import {
  MASTER_SHORT_NAME_RULE,
  initialsCode,
  nextFreeCode,
} from 'src/modules/settings/shared/code-from-name';
import { lockCodeSeries, type CodeSeries } from 'src/modules/settings/shared/code-series-lock';

/**
 * Inventory masters review (user, 20/11/2026): an Item Group, Brand, Section,
 * Category or Godown saved with its Short Name left empty gets one made from
 * its name — on a create, and on an edit that sends the Short Name empty. A
 * field an edit leaves out keeps what is stored; old rows are not back-filled.
 */

/** The Short Name came empty: null, or nothing but spaces. undefined (left out) is not empty. */
export function isEmptyShortName(value: string | null | undefined): boolean {
  return value === null || (typeof value === 'string' && value.trim() === '');
}

/**
 * The Short Name for `name`: its initials (MASTER_SHORT_NAME_RULE), else the
 * first of base2, base3 … no LIVE row of the series holds in any case.
 * `takenStartingWith(base)` reads those rows' short names (the caller scopes
 * them: its own row left out, a godown's branch only), under the series lock
 * this takes, so two saves never pick the same one. No unique index backs it
 * (old rows hold duplicates). null when the name holds no A-Z / 0-9.
 */
export async function shortNameFromName(
  tx: ModuleWriteClient,
  series: CodeSeries,
  name: string,
  takenStartingWith: (base: string) => Promise<ReadonlyArray<string | null>>,
): Promise<string | null> {
  const base = initialsCode(name, MASTER_SHORT_NAME_RULE);
  if (!base) {
    return null;
  }
  await lockCodeSeries(tx, series);
  return nextFreeCode(base, takenStartingWith);
}
