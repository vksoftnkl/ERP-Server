"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemPriceLogService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const loose_search_1 = require("../../../common/search/loose-search");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const price_change_diff_1 = require("./price-change-diff");
const price_field_labels_1 = require("./price-field-labels");
const item_price_log_error_codes_1 = require("./types/item-price-log-error-codes");
const price_change_log_types_1 = require("./types/price-change-log.types");
const MAX_RANGE_DAYS = 366;
const DEFAULT_LIMIT = 100;
const DEFAULT_HISTORY_LIMIT = 200;
const GAP_SAMPLE = 50;
const DELETED_FLAGS = new Set(Object.values(price_change_diff_1.DELETED_COLUMN));
let ItemPriceLogService = class ItemPriceLogService {
    prisma;
    requestContext;
    constructor(prisma, requestContext) {
        this.prisma = prisma;
        this.requestContext = requestContext;
    }
    async list(q) {
        await this.assertCanView();
        this.assertRange(q);
        const limit = q.limit ?? DEFAULT_LIMIT;
        const page = q.page ?? 1;
        const rows = await this.prisma.$queryRaw `
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
    async get(q) {
        await this.assertCanView();
        const [row] = await this.prisma.$queryRaw `
      SELECT ${ROW_COLUMNS}, l.ipcl_before AS before, l.ipcl_after AS after
        FROM inventory.item_price_change_log l
        ${ROW_JOINS}
       WHERE l.ipcl_id = ${q.ipclId}::uuid`;
        if (!row) {
            (0, module_shared_utils_1.throwNotFound)('Price change not found', 'ipclId', `No price change log row ${q.ipclId}`, item_price_log_error_codes_1.IPCL.NOT_FOUND);
        }
        return { ...toRow(row), before: row.before ?? null, after: row.after ?? null };
    }
    async days(q) {
        await this.assertCanView();
        this.assertRange(q);
        return this.prisma.$queryRaw `
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
    async itemHistory(q) {
        await this.assertCanView();
        const filters = [client_1.Prisma.sql `l.ipcl_item_id = ${q.itemId}::uuid`];
        if (q.companyId) {
            filters.push(client_1.Prisma.sql `(l.ipcl_company_id = ${q.companyId}::uuid OR l.ipcl_company_id IS NULL)`);
        }
        if (q.branchId) {
            filters.push(client_1.Prisma.sql `(l.ipcl_branch_id = ${q.branchId}::uuid OR l.ipcl_branch_id IS NULL)`);
        }
        filters.push(...tableFilter(q.priceTable));
        const rows = await this.prisma.$queryRaw `
      SELECT ${ROW_COLUMNS}
        FROM inventory.item_price_change_log l
        ${ROW_JOINS}
       WHERE ${client_1.Prisma.join(filters, ' AND ')}
       ORDER BY l.ipcl_changed_on DESC, l.ipcl_id DESC
       LIMIT ${q.limit ?? DEFAULT_HISTORY_LIMIT}`;
        return rows.map(toRow);
    }
    async gaps(q) {
        await this.assertCanView();
        const company = q.companyId ?? null;
        const rows = await this.prisma.$queryRaw `
      WITH since AS (
        SELECT min(ipcl_changed_on) AS t FROM inventory.item_price_change_log
      ),
      touched AS (
        SELECT 'IPM'::text AS tbl, p.ipm_id AS row_id, p.ipm_item_id AS item_id,
               to_jsonb(p) - ${[...price_change_diff_1.IGNORED_COLUMNS.IPM]}::text[] AS now_row
          FROM inventory.item_price_master p, since
         WHERE since.t IS NOT NULL
           AND COALESCE(p.ipm_updated_on, p.ipm_created_on) >= since.t
           AND (${company}::uuid IS NULL OR p.ipm_company_id = ${company}::uuid
                OR p.ipm_company_id IS NULL)
        UNION ALL
        SELECT 'IQP'::text, q.iqp_id, q.iqp_item_id,
               to_jsonb(q) - ${[...price_change_diff_1.IGNORED_COLUMNS.IQP]}::text[]
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
          OR (lg.expected - ${[...price_change_diff_1.IGNORED_COLUMNS.IPM, ...price_change_diff_1.IGNORED_COLUMNS.IQP]}::text[])
             IS DISTINCT FROM t.now_row
       ORDER BY 1, 2`;
        const [since] = await this.prisma.$queryRaw `
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
    async assertCanView() {
        await (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId: price_change_log_types_1.PRICE_MENU_ID.PRICE_CHANGE_LOG,
            right: 'view',
            codePrefix: item_price_log_error_codes_1.IPCL_RIGHT_PREFIX,
            action: 'view the price change log',
        });
    }
    assertRange(q) {
        const days = (Date.parse(q.toDate) - Date.parse(q.fromDate)) / 86_400_000;
        if (!(days >= 0) || days > MAX_RANGE_DAYS) {
            const message = days < 0
                ? `toDate ${q.toDate} is before fromDate ${q.fromDate}`
                : `A range of at most ${MAX_RANGE_DAYS} days is read at once`;
            (0, module_shared_utils_1.throwBadRequest)(message, [
                { field: 'toDate', message, code: item_price_log_error_codes_1.IPCL.BAD_RANGE },
            ]);
        }
    }
    filterSql(q) {
        const filters = [
            client_1.Prisma.sql `(l.ipcl_company_id = ${q.companyId}::uuid OR l.ipcl_company_id IS NULL)`,
            client_1.Prisma.sql `l.ipcl_changed_on >= ${q.fromDate}::date`,
            client_1.Prisma.sql `l.ipcl_changed_on <  ${q.toDate}::date + 1`,
        ];
        if (q.branchId) {
            filters.push(client_1.Prisma.sql `(l.ipcl_branch_id = ${q.branchId}::uuid OR l.ipcl_branch_id IS NULL)`);
        }
        filters.push(...tableFilter(q.priceTable));
        if (q.itemId) {
            filters.push(client_1.Prisma.sql `l.ipcl_item_id = ${q.itemId}::uuid`);
        }
        if (q.userId) {
            filters.push(client_1.Prisma.sql `l.ipcl_user_id = ${q.userId}::uuid`);
        }
        if (q.deviceId) {
            filters.push(client_1.Prisma.sql `l.ipcl_device_id = ${q.deviceId}::uuid`);
        }
        if (q.field) {
            filters.push(client_1.Prisma.sql `${q.field}::text = ANY (l.ipcl_changed)`);
        }
        if (q.source) {
            filters.push(client_1.Prisma.sql `l.ipcl_source = ${q.source}`);
        }
        if (q.action) {
            filters.push(client_1.Prisma.sql `l.ipcl_action = ${q.action}`);
        }
        if (q.search) {
            filters.push((0, loose_search_1.looseSearchSql)(['l.ipcl_item_code', 'l.ipcl_item_name'], q.search));
        }
        return client_1.Prisma.join(filters, ' AND ');
    }
};
exports.ItemPriceLogService = ItemPriceLogService;
exports.ItemPriceLogService = ItemPriceLogService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], ItemPriceLogService);
function tableFilter(priceTable) {
    return priceTable && priceTable !== 'BOTH'
        ? [client_1.Prisma.sql `l.ipcl_price_table = ${priceTable}`]
        : [];
}
const ROW_COLUMNS = client_1.Prisma.sql `
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
const ROW_JOINS = client_1.Prisma.sql `
  LEFT JOIN inventory.item_price_levels ipl ON ipl.ipl_id = l.ipcl_price_level`;
function toRow(raw) {
    const { before, after, totalCount, changedValues, ...stored } = raw;
    const row = { ...stored, changed: (0, price_field_labels_1.orderColumns)(stored.changed) };
    const [oldValue, newValue] = row.priceTable === 'IQP'
        ? [row.oldSlabPrice, row.newSlabPrice]
        : [row.oldPriceA, row.newPriceA];
    return {
        ...row,
        changedLabels: row.changed.map(price_field_labels_1.labelOf),
        fields: row.changed.map((column) => ({
            column,
            label: (0, price_field_labels_1.labelOf)(column),
            before: changedValues?.[column]?.[0] ?? null,
            after: row.action === 'DELETE' && DELETED_FLAGS.has(column)
                ? true
                : (changedValues?.[column]?.[1] ?? null),
        })),
        changePct: oldValue !== null && newValue !== null && oldValue !== 0
            ? Math.round(((newValue - oldValue) / oldValue) * 10_000) / 100
            : null,
    };
}
//# sourceMappingURL=item-price-log.service.js.map