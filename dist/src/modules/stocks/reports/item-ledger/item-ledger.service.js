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
exports.ItemLedgerService = exports.EXPORT_ROW_CAP = void 0;
exports.assertRange = assertRange;
exports.headOf = headOf;
exports.openingBlock = openingBlock;
exports.summaryOf = summaryOf;
exports.closingBlock = closingBlock;
exports.totalsOf = totalsOf;
exports.tilesOf = tilesOf;
exports.byTypeOf = byTypeOf;
exports.stockNowBlock = stockNowBlock;
exports.tieOf = tieOf;
exports.periodTieOf = periodTieOf;
exports.toRow = toRow;
exports.openingBase = openingBase;
exports.detailOf = detailOf;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../../common/request-context/request-context.service");
const rights_1 = require("../../../../common/posting/rights");
const module_shared_utils_1 = require("../../../../common/utils/module-shared.utils");
const app_setting_value_service_1 = require("../../../settings/appSettings/app-setting-value.service");
const sales_settings_1 = require("../../../sales/posting/sales.settings");
const item_tax_rate_helper_1 = require("../../../Inventory/utils/item-tax-rate.helper");
const cost_price_bulk_rules_1 = require("../../cost-price-bulk/cost-price-bulk.rules");
const item_ledger_query_dto_1 = require("./dto/item-ledger-query.dto");
const item_ledger_rules_1 = require("./item-ledger.rules");
const item_ledger_sql_1 = require("./item-ledger.sql");
const item_ledger_types_1 = require("./types/item-ledger.types");
exports.EXPORT_ROW_CAP = 20_000;
const DOC_NO_CAP = 50;
const LOT_CAP = 500;
const TX_OPTIONS = {
    isolationLevel: client_1.Prisma.TransactionIsolationLevel.RepeatableRead,
    maxWait: 10_000,
    timeout: 60_000,
};
let ItemLedgerService = class ItemLedgerService {
    prisma;
    requestContext;
    appSettings;
    constructor(prisma, requestContext, appSettings) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.appSettings = appSettings;
    }
    async options(q) {
        const rights = await this.assertView();
        return this.snapshot(async (db) => {
            await this.lookupScope(db, q);
            const today = await this.today(db);
            const [facts] = await db.$queryRaw `
        SELECT i.item_id, NULLIF(btrim(i.item_code), '') AS item_code, i.item_name_en AS item_name,
               g.itg_name AS group_name, br.brand_name, NULLIF(btrim(i.item_hsn_code), '') AS hsn,
               i.item_is_service AS is_service, spt.spt_name AS preset_name,
               um.unit_name AS base_unit_name
          FROM inventory.item_master i
          LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
          LEFT JOIN inventory.item_brand_master br ON br.brand_id = i.item_brand_id
          LEFT JOIN stock.stock_track_preset spt
                 ON spt.spt_id = COALESCE(i.item_track_preset_id, g.itg_track_preset_id)
          LEFT JOIN inventory.item_unit_master um ON um.unit_id = i.item_base_unit_id
         WHERE i.item_id = ${q.itemId}::uuid`;
            const units = await db.$queryRaw `
        SELECT u.iuc_id, m.unit_name, u.iuc_to_base_factor AS factor,
               COALESCE(u.iuc_is_base_unit, false) AS is_base
          FROM inventory.item_unit_conversion u
          LEFT JOIN inventory.item_unit_master m ON m.unit_id = u.iuc_unit_id
         WHERE u.iuc_item_id = ${q.itemId}::uuid AND u.iuc_is_deleted = false
         ORDER BY u.iuc_unit_slno NULLS LAST, u.iuc_to_base_factor DESC, u.iuc_id`;
            const [reorder] = await db.$queryRaw `
        SELECT r.srp_reorder_level * COALESCE(u.iuc_to_base_factor, 1) AS lvl
          FROM stock.stock_reorder_policy r
          LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = r.srp_uom_id
         WHERE r.srp_company_id = ${q.companyId}::uuid AND r.srp_branch_id = ${q.branchId}::uuid
           AND r.srp_item_id = ${q.itemId}::uuid AND r.srp_godown_id IS NULL
           AND r.srp_is_deleted = false AND r.srp_is_active = true
         ORDER BY r.srp_modified_on DESC NULLS LAST, r.srp_created_on DESC
         LIMIT 1`;
            const godowns = await db.$queryRaw `
        SELECT gdl_id, gdl_name, NULLIF(btrim(gdl_short), '') AS gdl_short
          FROM inventory.godown_locations
         WHERE gdl_branch_id = ${q.branchId}::uuid AND gdl_is_deleted = false
         ORDER BY gdl_sort NULLS LAST, lower(gdl_name), gdl_id`;
            const lots = await db.$queryRaw `
        WITH ll AS (
          SELECT DISTINCT l.sml_lot_id AS lot
            FROM stock.stock_ledger l
           WHERE l.sml_company_id = ${q.companyId}::uuid AND l.sml_branch_id = ${q.branchId}::uuid
             AND l.sml_item_id = ${q.itemId}::uuid AND l.sml_is_deleted = false)
        SELECT lt.slt_id AS lot_id, NULLIF(btrim(lt.slt_batch_no), '') AS batch_no,
               lt.slt_expiry_date::text AS expiry, lt.slt_mrp AS mrp,
               COALESCE((SELECT SUM(b.sbl_on_hand_qty) FROM stock.stock_balance b
                          WHERE b.sbl_company_id = ${q.companyId}::uuid
                            AND b.sbl_branch_id = ${q.branchId}::uuid
                            AND b.sbl_item_id = ${q.itemId}::uuid
                            AND b.sbl_lot_id = lt.slt_id AND b.sbl_is_deleted = false), 0) AS on_hand
          FROM ll JOIN stock.stock_lot lt ON lt.slt_id = ll.lot
         ORDER BY lt.slt_expiry_date DESC NULLS LAST, lt.slt_batch_no NULLS LAST, lt.slt_id
         LIMIT ${LOT_CAP}`;
            const typeRows = await db.$queryRaw((0, item_ledger_sql_1.optionTypesSql)(q.companyId, q.branchId, q.itemId));
            const [count] = await db.$queryRaw `
        SELECT MAX(v.svh_doc_date)::text AS d
          FROM stock.stock_voucher_item i
          JOIN stock.stock_voucher v ON v.svh_id = i.svi_voucher_id AND v.svh_acc_year = i.svi_acc_year
         WHERE i.svi_company_id = ${q.companyId}::uuid AND i.svi_branch_id = ${q.branchId}::uuid
           AND i.svi_item_id = ${q.itemId}::uuid AND i.svi_is_deleted = false
           AND v.svh_voucher_type = 'PHYSICAL' AND v.svh_status = 'POSTED' AND v.svh_is_deleted = false`;
            const fy = await this.fiscalYear(db, q.companyId, today);
            const taxes = await (0, item_tax_rate_helper_1.resolveItemTaxRates)(db, [q.itemId], new Date(`${today}T00:00:00Z`));
            const tax = taxes.get(q.itemId);
            const types = new Map();
            for (const t of typeRows) {
                const codes = t.is_reval
                    ? ['REVALUED']
                    : t.txn === 'TRANSFER_OUT' && t.src_type === 'TRANSFER_OUT'
                        ? [
                            ...(t.has_branch_out ? ['BRANCH_OUT'] : []),
                            ...(t.has_godown_out ? ['GODOWN_TRANSFER'] : []),
                        ]
                        : [(0, item_ledger_rules_1.reportTypeOf)(t.txn, t.src_type)];
                for (const code of codes) {
                    const def = item_ledger_rules_1.REPORT_TYPES[code];
                    types.set(code, { type: code, label: def?.label ?? code, kind: def?.kind ?? 'MIXED' });
                }
            }
            const base = units.find((u) => u.is_base);
            return {
                item: {
                    itemId: facts.item_id,
                    code: facts.item_code,
                    name: facts.item_name,
                    group: facts.group_name,
                    brand: facts.brand_name,
                    hsn: facts.hsn,
                    gstRate: tax?.taxId ? new client_1.Prisma.Decimal(tax.taxPerc).toFixed(2) : null,
                    trackedAs: (0, cost_price_bulk_rules_1.trackedAsOf)(facts.preset_name),
                    isService: facts.is_service ?? false,
                    baseUnit: {
                        unitId: base?.iuc_id ?? null,
                        name: base?.unit_name ?? facts.base_unit_name ?? '',
                    },
                    units: units.map((u) => ({
                        unitId: u.iuc_id,
                        name: u.unit_name ?? '',
                        factor: (0, item_ledger_rules_1.dec)(u.factor).toFixed(6),
                        isBase: u.is_base,
                    })),
                    reorderLevel: reorder ? (0, item_ledger_rules_1.dec)(reorder.lvl).toFixed(3) : null,
                },
                godowns: godowns.map((g) => ({ godownId: g.gdl_id, name: g.gdl_name, short: g.gdl_short })),
                lots: lots.map((l) => ({
                    lotId: l.lot_id,
                    batchNo: l.batch_no,
                    expiry: l.expiry,
                    mrp: l.mrp === null ? null : (0, item_ledger_rules_1.money)(l.mrp),
                    onHand: (0, item_ledger_rules_1.dec)(l.on_hand).toFixed(3),
                })),
                types: [...types.values()].sort((a, b) => (0, item_ledger_rules_1.reportTypeOrder)(a.type) - (0, item_ledger_rules_1.reportTypeOrder)(b.type)),
                lastCountDate: count?.d ?? null,
                fy,
                rights: rightsOf(rights),
            };
        });
    }
    async ledger(q) {
        const rights = await this.assertView();
        assertRange(q.from, q.to);
        const walkIn = await this.walkIn(q.companyId, q.branchId);
        const order = q.order ?? 'asc';
        const page = q.page ?? 1;
        const limit = q.limit ?? item_ledger_query_dto_1.ITEM_LEDGER_DEFAULT_LIMIT;
        return this.snapshot(async (db) => {
            const scope = await this.resolveScope(db, q);
            const today = await this.today(db);
            const tieChecked = scope.sql.to >= today;
            const [open] = await db.$queryRaw((0, item_ledger_sql_1.openingSql)(scope.sql, tieChecked));
            const agg = await db.$queryRaw((0, item_ledger_sql_1.summarySql)(scope.sql));
            const rows = await db.$queryRaw((0, item_ledger_sql_1.pageSql)(scope.sql, { order, limit, offset: (page - 1) * limit }));
            const stock = await db.$queryRaw((0, item_ledger_sql_1.stockNowSql)(scope.sql));
            const leftOut = await this.revaluationsLeftOut(db, scope);
            const walk = await this.walkInName(db, walkIn);
            const s = summaryOf(agg);
            const f = scope.unit.factor;
            const opening = openingBlock(scope, open);
            const closing = closingBlock(scope, open, s);
            const stockNow = stockNowBlock(today, stock, f);
            return {
                head: headOf(scope, { order, rights, leftOut, showReversed: scope.sql.showReversed }),
                opening,
                closing,
                totals: totalsOf(s, f),
                tiles: tilesOf(agg),
                tie: tieOf(tieChecked, open, s, stock, f),
                periodTie: periodTieOf(open, s),
                rows: rows.map((r) => toRow(r, scope, walk, openingBase(open))),
                page: {
                    page,
                    limit,
                    totalRows: s.n_shown,
                    hasMore: (page - 1) * limit + rows.length < s.n_shown,
                },
                byType: byTypeOf(agg, f),
                stockNow,
            };
        });
    }
    async days(q) {
        const rights = await this.assertView();
        assertRange(q.from, q.to);
        return this.snapshot(async (db) => {
            const scope = await this.resolveScope(db, q);
            const [open] = await db.$queryRaw((0, item_ledger_sql_1.openingSql)(scope.sql, false));
            const agg = await db.$queryRaw((0, item_ledger_sql_1.summarySql)(scope.sql));
            const rows = await db.$queryRaw((0, item_ledger_sql_1.periodSql)(scope.sql, 'day'));
            const leftOut = await this.revaluationsLeftOut(db, scope);
            const s = summaryOf(agg);
            const f = scope.unit.factor;
            let runQ = (0, item_ledger_rules_1.dec)(open.q);
            let runV = (0, item_ledger_rules_1.dec)(open.v).plus(open.rv);
            return {
                head: headOf(scope, {
                    order: 'asc',
                    rights,
                    leftOut,
                    showReversed: scope.sql.showReversed,
                }),
                opening: openingBlock(scope, open),
                closing: closingBlock(scope, open, s),
                days: rows.map((r) => {
                    const openingQty = runQ;
                    runQ = runQ.plus(r.q_all);
                    runV = runV.plus(r.v_all);
                    return {
                        date: r.k,
                        docs: r.docs,
                        openingQty: (0, item_ledger_rules_1.qtyIn)(openingQty, f),
                        receivedQty: (0, item_ledger_rules_1.qtyIn)(r.q_in, f),
                        issuedQty: (0, item_ledger_rules_1.qtyIn)(r.q_out, f),
                        closingQty: (0, item_ledger_rules_1.qtyIn)(runQ, f),
                        valueIn: (0, item_ledger_rules_1.money)(r.v_in),
                        valueOut: (0, item_ledger_rules_1.money)(r.v_out),
                        closingValue: (0, item_ledger_rules_1.money)(runV),
                    };
                }),
                totals: totalsOf(s, f),
                periodTie: periodTieOf(open, s),
            };
        });
    }
    async months(q) {
        const rights = await this.assertView();
        return this.snapshot(async (db) => {
            const row = await this.lookupScope(db, q);
            const fy = await this.fiscalYear(db, q.companyId, q.to);
            if (!fy) {
                refuse(item_ledger_types_1.ITEM_LEDGER_ERROR.NO_FISCAL_YEAR, 'to', `${q.to} is outside every financial year of this company.`);
            }
            const scope = scopeOf(row, { ...q, from: fy.begin });
            const [open] = await db.$queryRaw((0, item_ledger_sql_1.openingSql)(scope.sql, false));
            const rows = await db.$queryRaw((0, item_ledger_sql_1.periodSql)(scope.sql, 'month'));
            const leftOut = await this.revaluationsLeftOut(db, scope);
            const f = scope.unit.factor;
            const byMonth = new Map(rows.map((r) => [r.k, r]));
            const all = (0, item_ledger_rules_1.monthsBetween)(fy.begin, q.to);
            let runQ = (0, item_ledger_rules_1.dec)(open.q);
            let runV = (0, item_ledger_rules_1.dec)(open.v).plus(open.rv);
            let docs = 0;
            let inward = (0, item_ledger_rules_1.dec)(0);
            let outward = (0, item_ledger_rules_1.dec)(0);
            const months = all.map((m, i) => {
                const r = byMonth.get(m);
                const openingQty = runQ;
                runQ = runQ.plus(r?.q_all ?? 0);
                runV = runV.plus(r?.v_all ?? 0);
                docs += r?.docs ?? 0;
                inward = inward.plus(r?.q_in ?? 0);
                outward = outward.plus(r?.q_out ?? 0);
                return {
                    month: m,
                    label: (0, item_ledger_rules_1.monthLabel)(m),
                    docs: r?.docs ?? 0,
                    openingQty: (0, item_ledger_rules_1.qtyIn)(openingQty, f),
                    inwardQty: (0, item_ledger_rules_1.qtyIn)(r?.q_in ?? 0, f),
                    outwardQty: (0, item_ledger_rules_1.qtyIn)(r?.q_out ?? 0, f),
                    closingQty: (0, item_ledger_rules_1.qtyIn)(runQ, f),
                    valueIn: (0, item_ledger_rules_1.money)(r?.v_in ?? 0),
                    valueOut: (0, item_ledger_rules_1.money)(r?.v_out ?? 0),
                    closingValue: (0, item_ledger_rules_1.money)(runV),
                    partial: i === all.length - 1 && q.to < (0, item_ledger_rules_1.monthEnd)(m),
                };
            });
            return {
                head: headOf(scope, {
                    order: 'asc',
                    rights,
                    leftOut,
                    showReversed: scope.sql.showReversed,
                }),
                fy,
                opening: openingBlock(scope, open),
                months,
                yearToDate: {
                    docs,
                    inwardQty: (0, item_ledger_rules_1.qtyIn)(inward, f),
                    outwardQty: (0, item_ledger_rules_1.qtyIn)(outward, f),
                    closingQty: (0, item_ledger_rules_1.qtyIn)(runQ, f),
                    closingValue: (0, item_ledger_rules_1.money)(runV),
                },
            };
        });
    }
    async export(q) {
        const rights = await this.assertView();
        assertRange(q.from, q.to);
        const walkIn = await this.walkIn(q.companyId, q.branchId);
        const order = q.order ?? 'asc';
        return this.snapshot(async (db) => {
            const scope = await this.resolveScope(db, q);
            const [open] = await db.$queryRaw((0, item_ledger_sql_1.openingSql)(scope.sql, false));
            const agg = await db.$queryRaw((0, item_ledger_sql_1.summarySql)(scope.sql));
            const s = summaryOf(agg);
            if (s.n_shown > exports.EXPORT_ROW_CAP) {
                (0, module_shared_utils_1.throwUnprocessable)('Item Ledger request refused', [
                    {
                        field: 'to',
                        code: item_ledger_types_1.ITEM_LEDGER_ERROR.TOO_MANY_ROWS,
                        count: s.n_shown,
                        message: `${s.n_shown} rows — Print and Excel take up to ${exports.EXPORT_ROW_CAP}. Pick a shorter period.`,
                    },
                ]);
            }
            const rows = await db.$queryRaw((0, item_ledger_sql_1.pageSql)(scope.sql, { order, limit: exports.EXPORT_ROW_CAP, offset: 0 }));
            const leftOut = await this.revaluationsLeftOut(db, scope);
            const walk = await this.walkInName(db, walkIn);
            const head = headOf(scope, { order, rights, leftOut, showReversed: scope.sql.showReversed });
            return {
                head,
                printedAs: (0, item_ledger_rules_1.printedAsOf)({
                    itemName: [scope.itemCode, scope.itemName].filter(Boolean).join(' '),
                    branchName: scope.branchName,
                    from: scope.sql.from,
                    to: scope.sql.to,
                    godownName: scope.godownName,
                    bucket: scope.bucket,
                    batchNo: scope.batchNo,
                    unitName: scope.unit.name,
                    valueAt: scope.valueAt,
                    types: scope.sql.types,
                    showReversed: scope.sql.showReversed,
                }),
                opening: openingBlock(scope, open),
                closing: closingBlock(scope, open, s),
                totals: totalsOf(s, scope.unit.factor),
                rows: rows.map((r) => toRow(r, scope, walk, openingBase(open))),
                totalRows: rows.length,
            };
        });
    }
    assertView() {
        return (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId: item_ledger_types_1.ITEM_LEDGER_MENU_ID,
            right: 'view',
            codePrefix: item_ledger_types_1.ITEM_LEDGER_CODE_PREFIX,
            action: 'open the Item Ledger',
        });
    }
    snapshot(work) {
        return this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SET TRANSACTION READ ONLY`;
            await tx.$executeRaw `SET LOCAL plan_cache_mode = force_custom_plan`;
            await tx.$executeRaw `SET LOCAL jit = off`;
            return work(tx);
        }, TX_OPTIONS);
    }
    async today(db) {
        const [row] = await db.$queryRaw `
      SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS d`;
        return row.d;
    }
    async fiscalYear(db, companyId, on) {
        const [fy] = await db.$queryRaw `
      SELECT btrim(fy_year_name) AS name, fy_begin_date::text AS begin, fy_end_date::text AS "end"
        FROM public.fiscal_years
       WHERE comp_id = ${companyId}::uuid AND is_deleted = false
         AND ${on}::date BETWEEN fy_begin_date AND fy_end_date
       ORDER BY fy_begin_date DESC
       LIMIT 1`;
        return fy ?? null;
    }
    async lookupScope(db, q) {
        const [row] = await db.$queryRaw `
      SELECT b.br_comp_id, b.br_name, c.comp_name,
             i.item_id, NULLIF(btrim(i.item_code), '') AS item_code, i.item_name_en AS item_name,
             i.item_company_id, i.item_is_deleted,
             g.gdl_branch_id, g.gdl_name,
             lt.slt_item_id, NULLIF(btrim(lt.slt_batch_no), '') AS slt_batch_no,
             u.iuc_item_id, u.iuc_is_deleted, u.iuc_to_base_factor, u.iuc_is_base_unit,
             um.unit_name,
             bu.iuc_id AS base_iuc_id, bum.unit_name AS base_unit_name
        FROM (SELECT 1) x
        LEFT JOIN public.branch_master b ON b.br_id = ${q.branchId}::uuid
        LEFT JOIN public.companys c ON c.comp_id = ${q.companyId}::uuid
        LEFT JOIN inventory.item_master i ON i.item_id = ${q.itemId}::uuid
        LEFT JOIN inventory.godown_locations g ON g.gdl_id = ${q.godownId ?? null}::uuid
        LEFT JOIN stock.stock_lot lt ON lt.slt_id = ${q.lotId ?? null}::uuid
        LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = ${q.unitId ?? null}::uuid
        LEFT JOIN inventory.item_unit_master um ON um.unit_id = u.iuc_unit_id
        LEFT JOIN LATERAL (
          SELECT x.iuc_id, x.iuc_unit_id
            FROM inventory.item_unit_conversion x
           WHERE x.iuc_item_id = ${q.itemId}::uuid AND x.iuc_is_base_unit = true
             AND x.iuc_is_deleted = false
           ORDER BY x.iuc_unit_slno NULLS LAST, x.iuc_id
           LIMIT 1) bu ON true
        LEFT JOIN inventory.item_unit_master bum ON bum.unit_id = COALESCE(bu.iuc_unit_id, i.item_base_unit_id)`;
        if (!row.br_comp_id || row.br_comp_id !== q.companyId) {
            refuse(item_ledger_types_1.ITEM_LEDGER_ERROR.BRANCH_NOT_IN_COMPANY, 'branchId', 'That branch is not part of this company.');
        }
        if (!row.item_id ||
            row.item_is_deleted === true ||
            (row.item_company_id !== null && row.item_company_id !== q.companyId)) {
            refuse(item_ledger_types_1.ITEM_LEDGER_ERROR.ITEM_NOT_FOUND, 'itemId', 'This item is not there now, or it belongs to another company.');
        }
        if (q.godownId && row.gdl_branch_id !== q.branchId) {
            refuse(item_ledger_types_1.ITEM_LEDGER_ERROR.GODOWN_NOT_IN_BRANCH, 'godownId', 'That godown is not in this branch.');
        }
        if (q.lotId && row.slt_item_id !== q.itemId) {
            refuse(item_ledger_types_1.ITEM_LEDGER_ERROR.LOT_NOT_OF_ITEM, 'lotId', 'That batch is not one of this item’s.');
        }
        if (q.unitId && (row.iuc_item_id !== q.itemId || row.iuc_is_deleted !== false)) {
            refuse(item_ledger_types_1.ITEM_LEDGER_ERROR.UNIT_NOT_OF_ITEM, 'unitId', 'That unit is not one of this item’s units.');
        }
        return row;
    }
    async resolveScope(db, q) {
        return scopeOf(await this.lookupScope(db, q), q);
    }
    async revaluationsLeftOut(db, scope) {
        if (scope.sql.withRevaluations)
            return 0;
        const [row] = await db.$queryRaw((0, item_ledger_sql_1.revaluationsLeftOutSql)(scope.sql));
        return row?.n ?? 0;
    }
    async walkIn(companyId, branchId) {
        const effective = await this.appSettings.resolveEffective({
            companyId,
            branchId,
            deviceId: null,
            userId: null,
        });
        const id = (0, sales_settings_1.readSalesSettings)(effective).defaultCustomerId;
        return { id: id && UUID.test(id) ? id.toLowerCase() : null, name: null };
    }
    async walkInName(db, walkIn) {
        if (!walkIn.id)
            return walkIn;
        const [row] = await db.$queryRaw `
      SELECT led_name FROM accounts.acc_ledger_master WHERE led_id = ${walkIn.id}::uuid`;
        return { id: walkIn.id, name: row?.led_name ?? null };
    }
};
exports.ItemLedgerService = ItemLedgerService;
exports.ItemLedgerService = ItemLedgerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        app_setting_value_service_1.AppSettingValueService])
], ItemLedgerService);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function scopeOf(row, q) {
    const bucket = q.bucket ?? 'SALEABLE';
    const valueAt = q.valueAt ?? 'WITHOUT_TAX';
    const godownId = q.godownId ?? null;
    const unit = q.unitId
        ? {
            unitId: q.unitId,
            name: row.unit_name ?? '',
            factor: (0, item_ledger_rules_1.dec)(row.iuc_to_base_factor ?? 1),
            isBase: row.iuc_is_base_unit === true,
        }
        : {
            unitId: row.base_iuc_id,
            name: row.base_unit_name ?? '',
            factor: (0, item_ledger_rules_1.dec)(1),
            isBase: true,
        };
    if (unit.factor.lessThanOrEqualTo(0))
        unit.factor = (0, item_ledger_rules_1.dec)(1);
    return {
        sql: {
            companyId: q.companyId,
            branchId: q.branchId,
            itemId: q.itemId,
            from: q.from,
            to: q.to,
            godownId,
            bucket: bucket === 'ALL' ? null : bucket,
            lotId: q.lotId ?? null,
            wot: valueAt === 'WITHOUT_TAX',
            withRevaluations: godownId === null && (bucket === 'ALL' || bucket === 'SALEABLE'),
            types: q.types ?? [],
            showReversed: q.showReversed ?? true,
        },
        companyName: row.comp_name,
        branchName: row.br_name,
        itemCode: row.item_code,
        itemName: row.item_name ?? '',
        godownName: godownId ? row.gdl_name : null,
        batchNo: q.lotId ? row.slt_batch_no : null,
        bucket,
        valueAt,
        unit,
    };
}
function refuse(code, field, message) {
    (0, module_shared_utils_1.throwUnprocessable)('Item Ledger request refused', [{ field, message, code }]);
}
function assertRange(from, to) {
    if (!(0, item_ledger_rules_1.isRealIsoDate)(from) || !(0, item_ledger_rules_1.isRealIsoDate)(to) || from > to) {
        refuse(item_ledger_types_1.ITEM_LEDGER_ERROR.RANGE_REVERSED, 'from', `${from} is after ${to}.`);
    }
}
function rightsOf(rights) {
    return { print: rights.print, export: rights.export };
}
function headOf(scope, opts) {
    return {
        companyId: scope.sql.companyId,
        companyName: scope.companyName,
        branchId: scope.sql.branchId,
        branchName: scope.branchName,
        itemId: scope.sql.itemId,
        itemCode: scope.itemCode,
        itemName: scope.itemName,
        from: scope.sql.from,
        to: scope.sql.to,
        godownId: scope.sql.godownId,
        godownName: scope.godownName,
        bucket: scope.bucket,
        lotId: scope.sql.lotId,
        batchNo: scope.batchNo,
        unit: {
            unitId: scope.unit.unitId,
            name: scope.unit.name,
            factor: scope.unit.factor.toFixed(6),
            isBase: scope.unit.isBase,
        },
        valueAt: scope.valueAt,
        order: opts.order,
        showReversed: opts.showReversed,
        types: scope.sql.types,
        revaluationsLeftOut: opts.leftOut,
        rights: rightsOf(opts.rights),
    };
}
function openingBlock(scope, open) {
    const q = (0, item_ledger_rules_1.dec)(open.q);
    const v = (0, item_ledger_rules_1.dec)(open.v).plus(open.rv);
    return {
        date: scope.sql.from,
        closingOf: (0, item_ledger_rules_1.dayBefore)(scope.sql.from),
        qty: (0, item_ledger_rules_1.qtyIn)(q, scope.unit.factor),
        value: (0, item_ledger_rules_1.money)(v),
        rate: (0, item_ledger_rules_1.rateOf)(v, q, scope.unit.factor),
        lots: Number(open.lots),
    };
}
function summaryOf(agg) {
    const s = agg.find((r) => r.part === 'S');
    if (!s)
        throw new Error('Item Ledger summary row missing');
    return s;
}
function closingBlock(scope, open, s) {
    const q = (0, item_ledger_rules_1.dec)(open.q).plus(s.q_all);
    const v = (0, item_ledger_rules_1.dec)(open.v).plus(open.rv).plus(s.v_all);
    return {
        date: scope.sql.to,
        qty: (0, item_ledger_rules_1.qtyIn)(q, scope.unit.factor),
        value: (0, item_ledger_rules_1.money)(v),
        rate: (0, item_ledger_rules_1.rateOf)(v, q, scope.unit.factor),
    };
}
function totalsOf(s, factor) {
    return {
        receivedQty: (0, item_ledger_rules_1.qtyIn)(s.q_in ?? 0, factor),
        issuedQty: (0, item_ledger_rules_1.qtyIn)(s.q_out ?? 0, factor),
        valueIn: (0, item_ledger_rules_1.money)(s.v_in ?? 0),
        valueOut: (0, item_ledger_rules_1.money)(s.v_out ?? 0),
        rows: Number(s.n_all),
        rowsShown: Number(s.n_shown),
        docs: Number(s.docs),
        internalMoves: Number(s.n_internal),
        reversedPairs: Number(s.n_pairs),
        revaluations: Number(s.n_reval),
    };
}
function tilesOf(agg) {
    const tile = (kind) => agg
        .filter((r) => r.part === 'T' && r.kind === kind && r.rtype)
        .map((r) => ({
        type: r.rtype,
        label: (0, item_ledger_rules_1.tileLabel)(r.rtype, kind, r.ob),
        count: Number(r.docs),
    }))
        .sort((a, b) => b.count - a.count || (0, item_ledger_rules_1.reportTypeOrder)(a.type) - (0, item_ledger_rules_1.reportTypeOrder)(b.type));
    const docNos = (state) => agg
        .filter((r) => r.part === 'C' && r.cls === state && r.doc_no)
        .map((r) => r.doc_no)
        .sort();
    const cancelled = docNos('CANCELLED');
    const amended = docNos('AMENDED');
    return {
        receivedDocs: tile('IN'),
        issuedDocs: tile('OUT'),
        cancelled: { count: cancelled.length, docNos: cancelled.slice(0, DOC_NO_CAP) },
        amended: { count: amended.length, docNos: amended.slice(0, DOC_NO_CAP) },
    };
}
const PAIR_ORDER = { LIVE: 0, CANCELLED: 1, AMENDED: 2 };
function byTypeOf(agg, factor) {
    const opt = (v, f) => (v === null ? null : f(v));
    return agg
        .filter((r) => r.part === 'B' && r.rtype)
        .map((r) => {
        const cls = (r.cls ?? 'LIVE');
        const kinds = r.kinds ?? [];
        const moved = r.moved !== null && !(0, item_ledger_rules_1.dec)(r.moved).isZero() ? r.moved : null;
        return {
            type: r.rtype,
            label: (0, item_ledger_rules_1.byTypeLabel)(r.rtype, cls),
            kind: (kinds.length === 1 ? kinds[0] : 'MIXED'),
            pairClass: cls,
            docs: Number(r.docs),
            qtyIn: opt(r.q_in, (x) => (0, item_ledger_rules_1.qtyIn)(x, factor)),
            qtyOut: opt(r.q_out, (x) => (0, item_ledger_rules_1.qtyIn)(x, factor)),
            valueIn: opt(r.v_in, item_ledger_rules_1.money),
            valueOut: opt(r.v_out, item_ledger_rules_1.money),
            movedQty: opt(moved, (x) => (0, item_ledger_rules_1.qtyIn)(x, factor)),
            pairQty: cls === 'LIVE' ? null : opt(r.pair_q, (x) => (0, item_ledger_rules_1.qtyIn)(x, factor)),
            netsToZero: cls !== 'LIVE' && (0, item_ledger_rules_1.dec)(r.q_all).isZero() && (0, item_ledger_rules_1.dec)(r.v_all).isZero(),
        };
    })
        .sort((a, b) => (0, item_ledger_rules_1.reportTypeOrder)(a.type) - (0, item_ledger_rules_1.reportTypeOrder)(b.type) ||
        PAIR_ORDER[a.pairClass] - PAIR_ORDER[b.pairClass]);
}
function stockNowBlock(today, rows, factor) {
    let onHand = (0, item_ledger_rules_1.dec)(0);
    let reserved = (0, item_ledger_rules_1.dec)(0);
    let transit = (0, item_ledger_rules_1.dec)(0);
    let value = (0, item_ledger_rules_1.dec)(0);
    for (const r of rows) {
        if (!r.in_scope)
            continue;
        onHand = onHand.plus(r.on_hand);
        reserved = reserved.plus(r.reserved);
        transit = transit.plus(r.transit_in);
        value = value.plus(r.value);
    }
    return {
        asOf: today,
        rows: rows.map((r) => ({
            godownId: r.godown_id,
            godownName: r.godown_name,
            bucket: r.bucket,
            lotId: r.lot_id,
            batchNo: r.batch_no,
            expiry: r.expiry,
            onHand: (0, item_ledger_rules_1.qtyIn)(r.on_hand, factor),
            reserved: (0, item_ledger_rules_1.qtyIn)(r.reserved, factor),
            inTransitIn: (0, item_ledger_rules_1.qtyIn)(r.transit_in, factor),
            costRate: (0, item_ledger_rules_1.dec)(r.cost_rate).times(factor).toFixed(2),
            value: (0, item_ledger_rules_1.money)(r.value),
            inScope: r.in_scope,
        })),
        totalInScope: {
            onHand: (0, item_ledger_rules_1.qtyIn)(onHand, factor),
            reserved: (0, item_ledger_rules_1.qtyIn)(reserved, factor),
            inTransitIn: (0, item_ledger_rules_1.qtyIn)(transit, factor),
            value: (0, item_ledger_rules_1.money)(value),
        },
    };
}
function tieOf(checked, open, s, stock, factor) {
    if (!checked) {
        return { checked: false, ledgerQty: null, stockNowQty: null, equal: null, difference: null };
    }
    const ledgerQty = (0, item_ledger_rules_1.dec)(open.q).plus(s.q_all).plus(open.after_q);
    const stockNowQty = stock
        .filter((r) => r.in_scope)
        .reduce((sum, r) => sum.plus(r.on_hand), (0, item_ledger_rules_1.dec)(0));
    const diff = ledgerQty.minus(stockNowQty);
    return {
        checked: true,
        ledgerQty: (0, item_ledger_rules_1.qtyIn)(ledgerQty, factor),
        stockNowQty: (0, item_ledger_rules_1.qtyIn)(stockNowQty, factor),
        equal: diff.isZero(),
        difference: (0, item_ledger_rules_1.qtyIn)(diff, factor),
    };
}
function periodTieOf(open, s) {
    if (Number(s.n_shown) !== Number(s.n_all))
        return { qtyEqual: null, valueEqual: null };
    const openQ = (0, item_ledger_rules_1.dec)(open.q);
    const openV = (0, item_ledger_rules_1.dec)(open.v).plus(open.rv);
    const closeQ = openQ.plus(s.q_all);
    const closeV = openV.plus(s.v_all);
    return {
        qtyEqual: openQ.plus((0, item_ledger_rules_1.dec)(s.q_in)).minus((0, item_ledger_rules_1.dec)(s.q_out)).equals(closeQ),
        valueEqual: openV.plus((0, item_ledger_rules_1.dec)(s.v_in)).minus((0, item_ledger_rules_1.dec)(s.v_out)).equals(closeV),
    };
}
function toRow(r, scope, walkIn, base) {
    const f = scope.unit.factor;
    const neg = r.is_rev ? -1 : 1;
    const docKind = r.src_kind === 'R'
        ? (0, item_ledger_rules_1.docKindOf)({
            linkDocType: r.src_type,
            voucherType: null,
            toBranchId: null,
            srcDocType: r.src_type,
        })
        : (0, item_ledger_rules_1.docKindOf)({
            linkDocType: r.link_type,
            voucherType: r.voucher_type,
            toBranchId: r.to_branch,
            srcDocType: r.src_type,
        });
    const viaLink = r.src_kind === 'L' && !!r.link_id && docKind === r.link_type;
    const party = (0, item_ledger_rules_1.partyOf)({
        docKind,
        srcModule: r.src_module,
        partyId: r.party_id,
        ledgerName: r.party_name,
        billCustomerId: r.sb_cust_id,
        billCustomerName: r.sb_cust_name,
        walkInId: walkIn.id,
        walkInName: walkIn.name,
    });
    const internal = r.kind === 'INTERNAL';
    const otherBucket = r.rtype === 'BUCKET_MOVE' && !internal ? r.other_bucket : null;
    const revKind = r.amended ? 'AMENDED' : 'CANCELLED';
    const priced = r.src_module === 'SALES' || r.src_module === 'PURCHASE';
    return {
        rowId: r.row_id,
        seq: Number(r.seq),
        date: r.d,
        time: r.state === 'REVERSAL' ? r.t_post : r.t_doc,
        postedAt: r.posted_at,
        type: r.rtype,
        typeLabel: (0, item_ledger_rules_1.rowTypeLabel)(r.rtype, r.kind, otherBucket),
        kind: r.kind,
        state: r.state,
        docNo: r.refno,
        revision: r.src_kind === 'L' && viaLink ? (0, item_ledger_rules_1.revisionOf)(r.voucher_refno) : null,
        doc: {
            kind: docKind,
            id: viaLink ? r.link_id : r.doc_id,
            accYear: viaLink ? r.link_year : r.src_year,
            branchId: r.voucher_branch ?? scope.sql.branchId,
        },
        party,
        detail: detailOf(r),
        godownId: internal ? r.from_godown : r.gdown,
        godownName: internal ? r.from_godown_name : r.gdown_name,
        toGodownName: internal && r.rtype === 'GODOWN_TRANSFER'
            ? r.to_godown_name
            : r.rtype === 'GODOWN_TRANSFER' && r.kind === 'OUT'
                ? r.other_godown_name
                : null,
        bucket: internal ? r.from_bucket : r.gbucket,
        toBucket: internal && r.rtype === 'BUCKET_MOVE'
            ? r.to_bucket
            : r.rtype === 'BUCKET_MOVE' && r.kind === 'OUT'
                ? r.other_bucket
                : null,
        lotId: r.lot,
        batchNo: r.batch_no,
        expiry: r.expiry,
        receivedQty: r.kind === 'IN' ? (0, item_ledger_rules_1.qtyIn)(r.sq, f) : null,
        issuedQty: r.kind === 'OUT' ? (0, item_ledger_rules_1.qtyIn)((0, item_ledger_rules_1.dec)(r.sq).negated(), f) : null,
        movedQty: internal ? (0, item_ledger_rules_1.qtyIn)((0, item_ledger_rules_1.dec)(r.moved).times(neg), f) : null,
        freeQty: r.kind === 'VALUE' ? null : (0, item_ledger_rules_1.qtyIn)((0, item_ledger_rules_1.dec)(r.fq).times(neg), f),
        balanceQty: (0, item_ledger_rules_1.qtyIn)(base.q.plus(r.run_q), f),
        balanceValue: (0, item_ledger_rules_1.money)(base.v.plus(r.run_v)),
        costRate: r.kind === 'VALUE' ? null : (0, item_ledger_rules_1.rateOf)(r.gv, r.gq, f),
        costValue: (0, item_ledger_rules_1.money)(r.sv),
        docRate: priced && r.doc_amt !== null && !(0, item_ledger_rules_1.dec)(r.doc_amt).isZero() && !(0, item_ledger_rules_1.dec)(r.bq).isZero()
            ? (0, item_ledger_rules_1.dec)(r.doc_amt).dividedBy(r.bq).times(f).abs().toFixed(2)
            : null,
        user: r.by_login,
        reversal: r.state === 'CANCELLED' || r.state === 'AMENDED'
            ? { kind: revKind, at: r.r_posted_at, user: r.r_by_login, reason: clean(r.r_narr) }
            : null,
        reverses: r.state === 'REVERSAL'
            ? { kind: revKind, docNo: r.o_refno, postedAt: r.o_posted_at, reason: clean(r.narration) }
            : null,
    };
}
function openingBase(open) {
    return { q: (0, item_ledger_rules_1.dec)(open.q), v: (0, item_ledger_rules_1.dec)(open.v).plus(open.rv) };
}
function clean(v) {
    const t = v?.trim();
    return t ? t : null;
}
function detailOf(r) {
    const parts = [];
    if (r.src_kind === 'R') {
        return clean(r.narration) ?? '';
    }
    switch (r.rtype) {
        case 'GRN':
        case 'PURCHASE':
        case 'SHORTAGE_RECEIPT':
        case 'PURCHASE_RETURN': {
            const inv = clean(r.pi_supplier_inv_no) ?? clean(r.grn_supplier_inv_no);
            parts.push(inv ? `inv ${inv}` : null);
            break;
        }
        case 'GODOWN_TRANSFER':
            if (r.kind === 'INTERNAL') {
                parts.push(`${r.from_godown_name ?? '?'} → ${r.to_godown_name ?? '?'}`);
            }
            else if (r.kind === 'OUT') {
                parts.push(`${r.gdown_name ?? '?'} → ${r.other_godown_name ?? '?'}`);
            }
            else {
                parts.push(`${r.other_godown_name ?? '?'} → ${r.gdown_name ?? '?'}`);
            }
            break;
        case 'BUCKET_MOVE':
            if (r.kind === 'INTERNAL') {
                parts.push(`${(0, item_ledger_rules_1.bucketLabel)(r.from_bucket)} → ${(0, item_ledger_rules_1.bucketLabel)(r.to_bucket)}`);
            }
            else if (r.kind === 'OUT') {
                parts.push(`${(0, item_ledger_rules_1.bucketLabel)(r.gbucket)} → ${(0, item_ledger_rules_1.bucketLabel)(r.other_bucket)}`);
            }
            else {
                parts.push(`${(0, item_ledger_rules_1.bucketLabel)(r.other_bucket)} → ${(0, item_ledger_rules_1.bucketLabel)(r.gbucket)}`);
            }
            break;
        case 'BRANCH_OUT':
            parts.push(`→ ${r.to_branch_name ?? 'another branch'}`);
            parts.push((0, item_ledger_rules_1.transitText)(r.transit_status, r.transit_received_on));
            break;
        case 'BRANCH_IN':
            parts.push(`← ${r.from_branch_name ?? 'another branch'}`);
            break;
        default:
            break;
    }
    if (r.src_module === 'STOCK') {
        parts.push(clean(r.reason_name));
        parts.push(clean(r.remarks));
    }
    return parts.filter(Boolean).join(' · ');
}
//# sourceMappingURL=item-ledger.service.js.map