import { PgService } from '../../../database/pg/pg.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { MODULE_DROPDOWN_NAME_ALIASES } from '../master-lookup.constants';
import {
  LOOKUP_MODULE_ALIASES,
  LOOKUP_MODULE_KEYS,
  LookupModuleKey,
  NameIdOption,
} from '../types/master-lookup-api.types';
import {
  DropdownLookupColumnConfig,
  DropdownLookupConfig,
  DropdownRecord,
  LookupRow,
} from '../types/master-lookup-internal.types';
import { resolveConfiguredSqlCandidates } from '../utils/configured-sql.utils';
import {
  normalizeLookupToken,
  readLookupRowValue,
  resolveConfiguredLookupKeys,
  resolveLikelyIdKey,
  resolveLikelyNameKey,
  resolveRowLookupKeys,
} from '../utils/lookup-key.utils';
import { serializeLookupRow, toOption } from '../utils/lookup-option.utils';
/**
 * Runs the dropdowns configured in `dropdown_details`: it matches a stored
 * record to a lookup module by name, executes its SQL, and maps the result rows
 * to lookup options. Every step is best-effort — a record that cannot be matched
 * or whose SQL will not run leaves the caller to fall back to a Prisma query.
 */
export class ConfiguredDropdownLookup {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pg: PgService,
  ) {}
  /** The configured dropdown of every lookup module that has one. */
  async loadConfigsByModule(): Promise<Map<LookupModuleKey, DropdownLookupConfig>> {
    const records = await this.prisma.dropdownDetails.findMany({
      include: {
        dropdownColumns: { orderBy: [{ dropdownColumnsNo: 'asc' }] },
      },
    });
    const configs = new Map<LookupModuleKey, DropdownLookupConfig>();
    for (const moduleKey of LOOKUP_MODULE_KEYS) {
      const record = this.findRecordForModule(moduleKey, records);
      if (record) configs.set(moduleKey, this.toConfig(record));
    }
    return configs;
  }
  /** One configured dropdown by its id, regardless of any module mapping. */
  async loadConfigById(dropdownId: number): Promise<DropdownLookupConfig | null> {
    const record = await this.prisma.dropdownDetails.findUnique({
      where: { dropdownId },
      include: { dropdownColumns: { orderBy: [{ dropdownColumnsNo: 'asc' }] } },
    });
    return record ? this.toConfig(record) : null;
  }
  /**
   * Runs the config's SQL candidates in order and maps the first result set that
   * comes back. Returns null when none of them is runnable, which is the signal
   * to fall back to the module's Prisma query.
   */
  async fetchItems(config: DropdownLookupConfig): Promise<NameIdOption[] | null> {
    for (const sql of resolveConfiguredSqlCandidates(config)) {
      try {
        // Stored dropdown SQL is user-configured — run it on the read-only pool.
        const result = await this.pg.queryReadOnly<LookupRow>(sql);
        return this.mapRowsToOptions(result.rows, config);
      } catch {
        continue;
      }
    }
    return null;
  }
  /** Exact name match first, then a match on the normalized token form. */
  private findRecordForModule(
    module: LookupModuleKey,
    records: DropdownRecord[],
  ): DropdownRecord | undefined {
    const aliases = new Set<string>([
      module,
      ...MODULE_DROPDOWN_NAME_ALIASES[module],
      ...LOOKUP_MODULE_ALIASES[module],
    ]);
    const exactMatch = records.find((record) => aliases.has(record.dropdownName.trim()));
    if (exactMatch) return exactMatch;
    const normalizedAliases = Array.from(aliases).map((alias) => normalizeLookupToken(alias));
    return records.find((record) =>
      normalizedAliases.includes(normalizeLookupToken(record.dropdownName)),
    );
  }
  private toConfig(record: DropdownRecord): DropdownLookupConfig {
    return {
      dropdownId: record.dropdownId,
      dropdownName: record.dropdownName,
      dropdownSql: record.dropdownSql,
      dropdownSqlRegional: record.dropdownSqlRegional,
      dropdownSortColumn: record.dropdownSortColumn,
      dropdownSortOrder: record.dropdownSortOrder,
      dropdownColumns: record.dropdownColumns
        .filter((col) => col.dropdownColumnsVisiblity)
        .map((col) => ({
          name: col.dropdownColumnsName,
          alias: col.dropdownColumnsAlias,
          filter: col.dropdownColumnsFilter,
          visible: true,
        })),
    };
  }
  private mapRowsToOptions(rows: LookupRow[], config: DropdownLookupConfig): NameIdOption[] {
    return rows
      .map((row) => ({ row, option: this.mapRowToOption(row, config.dropdownColumns) }))
      .filter((item): item is { row: LookupRow; option: NameIdOption } => item.option !== null)
      .sort((left, right) => this.compareRows(left, right, config))
      .map((item) => item.option);
  }
  /**
   * The whole row is returned alongside the resolved `{ id, name }`, so callers
   * keep every configured column. Rows without an id column are dropped.
   */
  private mapRowToOption(
    row: LookupRow,
    columns: DropdownLookupColumnConfig[],
  ): NameIdOption | null {
    const rowKeys = resolveRowLookupKeys(row);
    const configuredKeys = resolveConfiguredLookupKeys(columns);
    const idKey = resolveLikelyIdKey(rowKeys) ?? resolveLikelyIdKey(configuredKeys);
    const idValue = idKey ? readLookupRowValue(row, idKey) : undefined;
    if (!idValue) return null;
    const nameKey =
      resolveLikelyNameKey(rowKeys, idKey, false) ??
      resolveLikelyNameKey(configuredKeys, idKey, false);
    const nameValue = nameKey ? readLookupRowValue(row, nameKey) : undefined;
    return {
      ...serializeLookupRow(row),
      ...toOption(idValue, nameValue, { fallbackNameToId: false }),
    };
  }
  /** Sorts by the configured sort column when the rows carry it, else by name. */
  private compareRows(
    left: { row: LookupRow; option: NameIdOption },
    right: { row: LookupRow; option: NameIdOption },
    config: DropdownLookupConfig,
  ): number {
    const sortOrder = config.dropdownSortOrder?.trim().toUpperCase() === 'DESC' ? -1 : 1;
    const sortColumnKey = normalizeLookupToken(config.dropdownSortColumn ?? '');
    const useSortColumn =
      sortColumnKey !== '' &&
      (readLookupRowValue(left.row, sortColumnKey) !== undefined ||
        readLookupRowValue(right.row, sortColumnKey) !== undefined);
    const leftValue = useSortColumn
      ? readLookupRowValue(left.row, sortColumnKey)
      : left.option.name;
    const rightValue = useSortColumn
      ? readLookupRowValue(right.row, sortColumnKey)
      : right.option.name;
    const primary = (leftValue ?? '').localeCompare(rightValue ?? '', undefined, {
      sensitivity: 'base',
      numeric: true,
    });
    if (primary !== 0) return primary * sortOrder;
    return left.option.id.localeCompare(right.option.id, undefined, {
      sensitivity: 'base',
      numeric: true,
    });
  }
}