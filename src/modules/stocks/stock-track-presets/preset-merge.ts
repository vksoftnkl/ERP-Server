import { Prisma, StockTrackPreset } from '@prisma/client';
/**
 * The company MERGE rule for stock.stock_track_preset, in one place.
 *
 * `spt_company_id NULL` is a preset SHARED with every company; a company row
 * carrying the same `spt_code` overrides it. `ux_spt_code` is unique on
 * `(COALESCE(spt_company_id, nil uuid), spt_code)`, so at most two rows can
 * ever compete for one code: the company's and the shared one.
 *
 * This is a PICKER concern only. The masters store the chosen preset's spt_id,
 * which names exactly one row, so nothing downstream has to merge again — the
 * person who picked already resolved it. Keeping the rule here rather than
 * inline in the controller is so the day a second caller lists presets, it
 * lists the same ones.
 *
 * Deliberately not expressed as an `orderBy`: in PostgreSQL `ORDER BY x DESC`
 * defaults to NULLS FIRST, so the obvious `{ sptCompanyId: 'desc' }` returns
 * the SHARED row first — the exact opposite of the rule.
 */
export const PRESET_VISIBLE = {
  sptIsActive: true,
  sptIsDeleted: false,
} satisfies Prisma.StockTrackPresetWhereInput;
/** Rows a company may pick from: its own, plus the shared ones. */
export function presetScopeFilter(companyId: string | null): Prisma.StockTrackPresetWhereInput {
  return {
    ...PRESET_VISIBLE,
    OR: [{ sptCompanyId: companyId }, { sptCompanyId: null }],
  };
}
/**
 * One preset per code — the company's where it has one, the shared row
 * otherwise. Input order is preserved for the codes that survive, so the
 * caller's `sptSortOrder` ordering carries through.
 */
export function mergePresets<T extends Pick<StockTrackPreset, 'sptCode' | 'sptCompanyId'>>(
  rows: readonly T[],
): T[] {
  const byCode = new Map<string, T>();
  for (const row of rows) {
    const held = byCode.get(row.sptCode);
    // A company row displaces the shared row it overrides; two rows for one
    // code cannot both be company rows (ux_spt_code), so this cannot thrash.
    if (!held || row.sptCompanyId !== null) {
      byCode.set(row.sptCode, row);
    }
  }
  return [...byCode.values()];
}
