import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertMenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { looseSearchSql } from 'src/common/search/loose-search';
import {
  throwBadRequest,
  throwNotFound,
  type ModuleErrorDetail,
} from 'src/common/utils/module-shared.utils';
import { PrismaService } from 'src/database/prisma/prisma.service';
import type {
  GetItemPriceLogQueryDto,
  ItemPriceHistoryQueryDto,
  ItemPriceLogFilterDto,
  ItemPriceLogGapsQueryDto,
  ListItemPriceLogQueryDto,
  PriceTableFilter,
} from './dto/item-price-log-query.dto';
import { DELETED_COLUMN, IGNORED_COLUMNS } from './price-change-diff';
import { labelOf, orderColumns } from './price-field-labels';
import { IPCL, IPCL_RIGHT_PREFIX } from './types/item-price-log-error-codes';
import {
  PRICE_MENU_ID,
  type PriceChangeAction,
  type PriceChangeApp,
  type PriceChangeSource,
  type PriceRowSnapshot,
  type PriceTable,
} from './types/price-change-log.types';

/** The longest range /list and /days read in one call. */
const MAX_RANGE_DAYS = 366;
const DEFAULT_LIMIT = 100;
const DEFAULT_HISTORY_LIMIT = 200;
const GAP_SAMPLE = 50;
const DELETED_FLAGS = new Set(Object.values(DELETED_COLUMN));

/** One log row as the report shows it. */
export interface PriceLogRow {
  ipclId: string;
  /** IST, with its offset. */
  changedOn: string;
  /** YYYY-MM-DD, the day the report files it under. */
  day: string;
  changeSetId: string;
  priceTable: PriceTable;
  rowId: string;
  action: PriceChangeAction;
  source: PriceChangeSource;
  menuId: number | null;
  companyId: string | null;
  branchId: string | null;
  branchName: string | null;
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  unitId: string | null;
  unitName: string | null;
  godownId: string | null;
  godownName: string | null;
  partyId: string | null;
  partyName: string | null;
  priceLevel: number | null;
  priceLevelName: string | null;
  bucketMrp: number | null;
  bucketSp: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  userId: string | null;
  userName: string | null;
  deviceId: string | null;
  deviceName: string | null;
  ip: string | null;
  app: PriceChangeApp | null;
  reason: string | null;
  /** The columns the change touched, and their report labels. */
  changed: string[];
  changedLabels: string[];
  /**
   * Notes 145 — every changed column with its label and its value before and
   * after (null where the row had none: a create's before, a delete's after).
   */
  fields: PriceLogField[];
  oldPriceA: number | null;
  newPriceA: number | null;
  oldMrp: number | null;
  newMrp: number | null;
  oldCost: number | null;
  newCost: number | null;
  oldSlabPrice: number | null;
  newSlabPrice: number | null;
  slabFromQty: number | null;
  slabToQty: number | null;
  /** The headline figure's move, % of the old: price A for a price row, the slab price for a slab. */
  changePct: number | null;
}

export interface PriceLogField {
  column: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface PriceLogDetail extends PriceLogRow {
  before: PriceRowSnapshot | null;
  after: PriceRowSnapshot | null;
}

export interface PriceLogDay {
  day: string;
  changes: number;
  priceChanges: number;
  slabChanges: number;
  items: number;
  users: number;
  saves: number;
}

export interface PriceLogGap {
  priceTable: PriceTable;
  rowId: string;
  itemId: string;
  /** NOT_LOGGED: changed since the log began, never logged. DIFFERS: the row is not what its last log row says. */
  reason: 'NOT_LOGGED' | 'DIFFERS';
}

export interface PriceLogGaps {
  /** When the log's first row was written; null while it is empty (nothing to compare yet). */
  since: string | null;
  total: number;
  priceRows: number;
  slabRows: number;
  sample: PriceLogGap[];
}

interface RawLogRow extends Omit<PriceLogRow, 'changedLabels' | 'changePct' | 'fields'> {
  before?: PriceRowSnapshot | null;
  after?: PriceRowSnapshot | null;
  /** { column: [before, after] } for the changed columns only — see ROW_COLUMNS. */
  changedValues: Record<string, [unknown, unknown]> | null;
  totalCount?: bigint;
}

/**
 * Notes 144 / plan §3 — the Price Change Log report's four reads, and the gap
 * count (plan §2.6). Read-only: nothing here writes the log, and nothing
 * anywhere updates or deletes it.
 *
 * ACCESS IS A MENU RIGHT: `um_can_view` on menu 290, Price Change Log (the
 * plan's default; notes 144 left the question open).
 */
@Injectable()
export class ItemPriceLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async list(
    q: ListItemPriceLogQueryDto,
  ): Promise<{ items: PriceLogRow[]; meta: { page: number; limit: number; total: number } }> {
    await this.assertCanView();
    this.assertRange(q);
    const limit = q.limit ?? DEFAULT_LIMIT;
    const page = q.page ?? 1;
    const rows = await this.prisma.$queryRaw<RawLogRow[]>`
      SELECT ${ROW_COLUMNS}, count(*) OVER () AS "totalCount"
        FROM inventory.item_price_change_log l
        ${ROW_JOINS}
       WHERE ${this.filterSql(q)}
       ORDER BY l.ipcl_changed_on DESC, l.ipcl_id DESC
       LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
    return {
      items: rows.map(toRow),
      meta: { page, limit, total: Number(rows[0]?.totalCount ?? 0) },
    };
  }

  async get(q: GetItemPriceLogQueryDto): Promise<PriceLogDetail> {
    await this.assertCanView();
    const [row] = await this.prisma.$queryRaw<RawLogRow[]>`
      SELECT ${ROW_COLUMNS}, l.ipcl_before AS before, l.ipcl_after AS after
        FROM inventory.item_price_change_log l
        ${ROW_JOINS}
       WHERE l.ipcl_id = ${q.ipclId}::uuid`;
    if (!row) {
      throwNotFound<ModuleErrorDetail>(
        'Price change not found',
        'ipclId',
        `No price change log row ${q.ipclId}`,
        IPCL.NOT_FOUND,
      );
    }
    return { ...toRow(row), before: row.before ?? null, after: row.after ?? null };
  }

  /** Per day: how many changes, of which kind, on how many items, by how many users, in how many saves. */
  async days(q: ItemPriceLogFilterDto): Promise<PriceLogDay[]> {
    await this.assertCanView();
    this.assertRange(q);
    return this.prisma.$queryRaw<PriceLogDay[]>`
      SELECT to_char(l.ipcl_changed_on, 'YYYY-MM-DD')                         AS day,
             count(*)::int                                                     AS changes,
             (count(*) FILTER (WHERE l.ipcl_price_table = 'IPM'))::int         AS "priceChanges",
             (count(*) FILTER (WHERE l.ipcl_price_table = 'IQP'))::int         AS "slabChanges",
             count(DISTINCT l.ipcl_item_id)::int                               AS items,
             count(DISTINCT l.ipcl_user_id)::int                               AS users,
             count(DISTINCT l.ipcl_change_set_id)::int                         AS saves
        FROM inventory.item_price_change_log l
       WHERE ${this.filterSql(q)}
       GROUP BY 1
       ORDER BY 1 DESC`;
  }

  /** One item's every change, newest first, across its scopes unless narrowed. */
  async itemHistory(q: ItemPriceHistoryQueryDto): Promise<PriceLogRow[]> {
    await this.assertCanView();
    const filters: Prisma.Sql[] = [Prisma.sql`l.ipcl_item_id = ${q.itemId}::uuid`];
    if (q.companyId) {
      filters.push(
        Prisma.sql`(l.ipcl_company_id = ${q.companyId}::uuid OR l.ipcl_company_id IS NULL)`,
      );
    }
    if (q.branchId) {
      filters.push(
        Prisma.sql`(l.ipcl_branch_id = ${q.branchId}::uuid OR l.ipcl_branch_id IS NULL)`,
      );
    }
    filters.push(...tableFilter(q.priceTable));
    const rows = await this.prisma.$queryRaw<RawLogRow[]>`
      SELECT ${ROW_COLUMNS}
        FROM inventory.item_price_change_log l
        ${ROW_JOINS}
       WHERE ${Prisma.join(filters, ' AND ')}
       ORDER BY l.ipcl_changed_on DESC, l.ipcl_id DESC
       LIMIT ${q.limit ?? DEFAULT_HISTORY_LIMIT}`;
    return rows.map(toRow);
  }

  /**
   * Plan §2.6 — THE GAP COUNT: price rows that changed without the log seeing
   * it. Every row touched since the log's first row is compared with its
   * latest log row: none at all is NOT_LOGGED; one whose state (after, or
   * before + deleted for a DELETE) is not the row's business columns now is
   * DIFFERS. Either is a write that went round PriceMasterWriter — the build's
   * guard test should make it 0, and this is the check on a live database.
   */
  async gaps(q: ItemPriceLogGapsQueryDto): Promise<PriceLogGaps> {
    await this.assertCanView();
    const company = q.companyId ?? null;
    const rows = await this.prisma.$queryRaw<PriceLogGap[]>`
      WITH since AS (
        SELECT min(ipcl_changed_on) AS t FROM inventory.item_price_change_log
      ),
      touched AS (
        SELECT 'IPM'::text AS tbl, p.ipm_id AS row_id, p.ipm_item_id AS item_id,
               to_jsonb(p) - ${[...IGNORED_COLUMNS.IPM]}::text[] AS now_row
          FROM inventory.item_price_master p, since
         WHERE since.t IS NOT NULL
           AND COALESCE(p.ipm_updated_on, p.ipm_created_on) >= since.t
           AND (${company}::uuid IS NULL OR p.ipm_company_id = ${company}::uuid
                OR p.ipm_company_id IS NULL)
        UNION ALL
        SELECT 'IQP'::text, q.iqp_id, q.iqp_item_id,
               to_jsonb(q) - ${[...IGNORED_COLUMNS.IQP]}::text[]
          FROM inventory.item_qty_price q, since
         WHERE since.t IS NOT NULL
           AND COALESCE(q.iqp_modified_on, q.iqp_created_on) >= since.t
           AND (${company}::uuid IS NULL OR q.iqp_company_id = ${company}::uuid
                OR q.iqp_company_id IS NULL)
      )
      SELECT t.tbl AS "priceTable", t.row_id::text AS "rowId", t.item_id::text AS "itemId",
             CASE WHEN lg.action IS NULL THEN 'NOT_LOGGED' ELSE 'DIFFERS' END AS reason
        FROM touched t
        LEFT JOIN LATERAL (
          SELECT l.ipcl_action AS action,
                 CASE WHEN l.ipcl_action = 'DELETE'
                      THEN l.ipcl_before || jsonb_build_object(
                             CASE t.tbl WHEN 'IPM' THEN 'ipm_is_deleted' ELSE 'iqp_is_deleted' END, true)
                      ELSE l.ipcl_after END AS expected
            FROM inventory.item_price_change_log l
           WHERE l.ipcl_item_id     = t.item_id
             AND l.ipcl_price_table = t.tbl
             AND l.ipcl_row_id      = t.row_id
           ORDER BY l.ipcl_changed_on DESC, l.ipcl_id DESC
           LIMIT 1
        ) lg ON true
       WHERE lg.action IS NULL
          OR (lg.expected - ${[...IGNORED_COLUMNS.IPM, ...IGNORED_COLUMNS.IQP]}::text[])
             IS DISTINCT FROM t.now_row
       ORDER BY 1, 2`;
    const [since] = await this.prisma.$queryRaw<Array<{ since: string | null }>>`
      SELECT to_char(min(ipcl_changed_on), 'YYYY-MM-DD"T"HH24:MI:SS.MSTZH:TZM') AS since
        FROM inventory.item_price_change_log`;
    return {
      since: since?.since ?? null,
      total: rows.length,
      priceRows: rows.filter((row) => row.priceTable === 'IPM').length,
      slabRows: rows.filter((row) => row.priceTable === 'IQP').length,
      sample: rows.slice(0, GAP_SAMPLE),
    };
  }

  private async assertCanView(): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: PRICE_MENU_ID.PRICE_CHANGE_LOG,
      right: 'view',
      codePrefix: IPCL_RIGHT_PREFIX,
      action: 'view the price change log',
    });
  }

  private assertRange(q: ItemPriceLogFilterDto): void {
    const days = (Date.parse(q.toDate) - Date.parse(q.fromDate)) / 86_400_000;
    if (!(days >= 0) || days > MAX_RANGE_DAYS) {
      const message =
        days < 0
          ? `toDate ${q.toDate} is before fromDate ${q.fromDate}`
          : `A range of at most ${MAX_RANGE_DAYS} days is read at once`;
      throwBadRequest<ModuleErrorDetail>(message, [
        { field: 'toDate', message, code: IPCL.BAD_RANGE },
      ]);
    }
  }

  /**
   * The report's WHERE. Each optional filter is added only when set: a
   * `$x IS NULL OR …` form turns slow once Postgres moves the prepared
   * statement onto a generic plan. The day bounds are dates in the session's
   * zone (Asia/Kolkata), so a day is an IST day.
   */
  private filterSql(q: ItemPriceLogFilterDto): Prisma.Sql {
    const filters: Prisma.Sql[] = [
      Prisma.sql`(l.ipcl_company_id = ${q.companyId}::uuid OR l.ipcl_company_id IS NULL)`,
      Prisma.sql`l.ipcl_changed_on >= ${q.fromDate}::date`,
      Prisma.sql`l.ipcl_changed_on <  ${q.toDate}::date + 1`,
    ];
    if (q.branchId) {
      filters.push(
        Prisma.sql`(l.ipcl_branch_id = ${q.branchId}::uuid OR l.ipcl_branch_id IS NULL)`,
      );
    }
    filters.push(...tableFilter(q.priceTable));
    if (q.itemId) {
      filters.push(Prisma.sql`l.ipcl_item_id = ${q.itemId}::uuid`);
    }
    if (q.userId) {
      filters.push(Prisma.sql`l.ipcl_user_id = ${q.userId}::uuid`);
    }
    if (q.deviceId) {
      filters.push(Prisma.sql`l.ipcl_device_id = ${q.deviceId}::uuid`);
    }
    if (q.field) {
      filters.push(Prisma.sql`${q.field}::text = ANY (l.ipcl_changed)`);
    }
    if (q.source) {
      filters.push(Prisma.sql`l.ipcl_source = ${q.source}`);
    }
    if (q.action) {
      filters.push(Prisma.sql`l.ipcl_action = ${q.action}`);
    }
    if (q.search) {
      filters.push(looseSearchSql(['l.ipcl_item_code', 'l.ipcl_item_name'], q.search));
    }
    return Prisma.join(filters, ' AND ');
  }
}

function tableFilter(priceTable: PriceTableFilter | undefined): Prisma.Sql[] {
  return priceTable && priceTable !== 'BOTH'
    ? [Prisma.sql`l.ipcl_price_table = ${priceTable}`]
    : [];
}

/** Every column the report reads, in the shape of PriceLogRow; numerics as float8. */
const ROW_COLUMNS = Prisma.sql`
  l.ipcl_id::text                                                    AS "ipclId",
  to_char(l.ipcl_changed_on, 'YYYY-MM-DD"T"HH24:MI:SS.MSTZH:TZM')    AS "changedOn",
  to_char(l.ipcl_changed_on, 'YYYY-MM-DD')                           AS day,
  l.ipcl_change_set_id::text                                         AS "changeSetId",
  l.ipcl_price_table                                                 AS "priceTable",
  l.ipcl_row_id::text                                                AS "rowId",
  l.ipcl_action                                                      AS action,
  l.ipcl_source                                                      AS source,
  l.ipcl_menu_id                                                     AS "menuId",
  l.ipcl_company_id::text                                            AS "companyId",
  l.ipcl_branch_id::text                                             AS "branchId",
  l.ipcl_branch_name                                                 AS "branchName",
  l.ipcl_item_id::text                                               AS "itemId",
  l.ipcl_item_code                                                   AS "itemCode",
  l.ipcl_item_name                                                   AS "itemName",
  l.ipcl_unit_id::text                                               AS "unitId",
  l.ipcl_unit_name                                                   AS "unitName",
  l.ipcl_godown_id::text                                             AS "godownId",
  l.ipcl_godown_name                                                 AS "godownName",
  l.ipcl_party_id::text                                              AS "partyId",
  l.ipcl_party_name                                                  AS "partyName",
  l.ipcl_price_level::int                                            AS "priceLevel",
  ipl.ipl_name                                                       AS "priceLevelName",
  l.ipcl_bucket_mrp::float8                                          AS "bucketMrp",
  l.ipcl_bucket_sp::float8                                           AS "bucketSp",
  l.ipcl_effective_from::text                                        AS "effectiveFrom",
  l.ipcl_effective_to::text                                          AS "effectiveTo",
  l.ipcl_user_id::text                                               AS "userId",
  l.ipcl_user_name                                                   AS "userName",
  l.ipcl_device_id::text                                             AS "deviceId",
  l.ipcl_device_name                                                 AS "deviceName",
  l.ipcl_ip                                                          AS ip,
  l.ipcl_app                                                         AS app,
  l.ipcl_reason                                                      AS reason,
  l.ipcl_changed                                                     AS changed,
  -- Notes 145: before / after of the CHANGED columns only, so a list row reads
  -- "Price B 118 → 119" without shipping either whole row.
  (SELECT jsonb_object_agg(c.col, jsonb_build_array(l.ipcl_before -> c.col, l.ipcl_after -> c.col))
     FROM unnest(l.ipcl_changed) AS c(col))                          AS "changedValues",
  l.ipcl_old_price_a::float8                                         AS "oldPriceA",
  l.ipcl_new_price_a::float8                                         AS "newPriceA",
  l.ipcl_old_mrp::float8                                             AS "oldMrp",
  l.ipcl_new_mrp::float8                                             AS "newMrp",
  l.ipcl_old_cost::float8                                            AS "oldCost",
  l.ipcl_new_cost::float8                                            AS "newCost",
  l.ipcl_old_slab_price::float8                                      AS "oldSlabPrice",
  l.ipcl_new_slab_price::float8                                      AS "newSlabPrice",
  l.ipcl_slab_from_qty::float8                                       AS "slabFromQty",
  l.ipcl_slab_to_qty::float8                                         AS "slabToQty"`;

/** The price level's name is read live: the log keeps the level, a level is not renamed per change. */
const ROW_JOINS = Prisma.sql`
  LEFT JOIN inventory.item_price_levels ipl ON ipl.ipl_id = l.ipcl_price_level`;

function toRow(raw: RawLogRow): PriceLogRow {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { before, after, totalCount, changedValues, ...stored } = raw;
  // Rows logged before notes 145 kept jsonb's key order (and a create its id).
  const row = { ...stored, changed: orderColumns(stored.changed) };
  const [oldValue, newValue] =
    row.priceTable === 'IQP'
      ? [row.oldSlabPrice, row.newSlabPrice]
      : [row.oldPriceA, row.newPriceA];
  return {
    ...row,
    changedLabels: row.changed.map(labelOf),
    fields: row.changed.map((column) => ({
      column,
      label: labelOf(column),
      before: changedValues?.[column]?.[0] ?? null,
      // A DELETE keeps only the row before it (ck_ipcl_shape); its deleted
      // flag is what it set, so the field reads false → true, not → null.
      after:
        row.action === 'DELETE' && DELETED_FLAGS.has(column)
          ? true
          : (changedValues?.[column]?.[1] ?? null),
    })),
    changePct:
      oldValue !== null && newValue !== null && oldValue !== 0
        ? Math.round(((newValue - oldValue) / oldValue) * 10_000) / 100
        : null,
  };
}
