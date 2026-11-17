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
exports.StockSummaryService = void 0;
exports.assertRange = assertRange;
exports.assertItemCap = assertItemCap;
exports.capRows = capRows;
exports.transitOutOf = transitOutOf;
exports.godownTab = godownTab;
exports.lotsBlock = lotsBlock;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../../common/request-context/request-context.service");
const rights_1 = require("../../../../common/posting/rights");
const module_shared_utils_1 = require("../../../../common/utils/module-shared.utils");
const item_tax_rate_helper_1 = require("../../../Inventory/utils/item-tax-rate.helper");
const cost_price_bulk_rules_1 = require("../../cost-price-bulk/cost-price-bulk.rules");
const item_ledger_rules_1 = require("../item-ledger/item-ledger.rules");
const item_ledger_sql_1 = require("../item-ledger/item-ledger.sql");
const item_ledger_service_1 = require("../item-ledger/item-ledger.service");
const stock_valuation_sql_1 = require("../common/stock-valuation.sql");
const stock_summary_run_store_1 = require("./stock-summary-run.store");
const stock_summary_sql_1 = require("./stock-summary.sql");
const stock_summary_rules_1 = require("./stock-summary.rules");
const stock_summary_types_1 = require("./types/stock-summary.types");
const TX_OPTIONS = {
    isolationLevel: client_1.Prisma.TransactionIsolationLevel.RepeatableRead,
    maxWait: 10_000,
    timeout: 120_000,
};
const PRINT_RUN_REUSE_MS = 60_000;
let StockSummaryService = class StockSummaryService {
    prisma;
    requestContext;
    runs;
    printRuns = new Map();
    constructor(prisma, requestContext, runs) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.runs = runs;
    }
    async options(q) {
        const rights = await this.assertView();
        return this.snapshot(async (db) => {
            const row = await this.lookup(db, q);
            const m = await this.moment(db);
            const godowns = await db.$queryRaw `
        SELECT gdl_id, gdl_name, NULLIF(btrim(gdl_short), '') AS gdl_short
          FROM inventory.godown_locations
         WHERE gdl_branch_id = ${q.branchId}::uuid AND gdl_is_deleted = false
         ORDER BY gdl_sort NULLS LAST, lower(gdl_name), gdl_id`;
            const fy = await this.fiscalYear(db, q.companyId, m.today);
            return {
                company: { companyId: q.companyId, name: row.comp_name },
                branch: { branchId: q.branchId, name: row.br_name },
                godowns: godowns.map((g) => ({ godownId: g.gdl_id, name: g.gdl_name, short: g.gdl_short })),
                buckets: [...stock_summary_rules_1.SUMMARY_BUCKET_CHOICES],
                today: m.today,
                fy,
                defaults: {
                    from: (0, stock_summary_rules_1.monthStart)(m.today),
                    to: m.today,
                    bucket: 'SALEABLE',
                    valueAt: 'WITHOUT_TAX',
                    qtyIn: 'BASE',
                    hideZero: true,
                    onlyNegative: false,
                    noSaleDays: stock_summary_rules_1.DEFAULT_NO_SALE_DAYS,
                },
                rights: rightsOf(rights),
            };
        });
    }
    async show(q) {
        const rights = await this.assertView();
        assertRange(q.from, q.to);
        const view = (0, stock_summary_rules_1.viewOf)(q);
        const run = await this.buildItemsRun(q, rights, view.hideZero);
        return this.itemsAnswer(run, view);
    }
    itemsAnswer(run, view) {
        const shown = (0, stock_summary_rules_1.itemView)(run.rows, view);
        const { slice, page } = (0, stock_summary_rules_1.pageOf)(shown, view);
        return {
            head: this.headNow(run),
            tiles: run.tiles,
            totals: { rows: run.rows.length, rowsShown: shown.length, ...(0, stock_summary_rules_1.sumValues)(run.rows) },
            totalsShown: { rows: shown.length, ...(0, stock_summary_rules_1.sumValues)(shown) },
            tie: run.tie,
            transitOut: run.transitOut,
            rows: slice.map((r) => r.wire),
            page,
            view: (0, stock_summary_rules_1.viewEcho)(view),
        };
    }
    async rows(q) {
        await this.assertView();
        const run = this.runOf(q.runId, q.companyId);
        const view = (0, stock_summary_rules_1.viewOf)(q);
        if (run.kind === 'ITEMS') {
            const shown = (0, stock_summary_rules_1.itemView)(run.rows, view);
            const { slice, page } = (0, stock_summary_rules_1.pageOf)(shown, view);
            return {
                runId: run.runId,
                kind: 'ITEMS',
                expiresAt: (0, stock_summary_rules_1.istInstant)(this.runs.expiresAt(run)),
                rows: slice.map((r) => r.wire),
                page,
                view: (0, stock_summary_rules_1.viewEcho)(view),
                totalsShown: { rows: shown.length, ...(0, stock_summary_rules_1.sumValues)(shown) },
            };
        }
        const shown = (0, stock_summary_rules_1.branchView)(run.rows, view);
        const { slice, page } = (0, stock_summary_rules_1.pageOf)(shown, view);
        const chain = shown.reduce((s, r) => s.plus(r.chainValue), stock_summary_rules_1.D0);
        return {
            runId: run.runId,
            kind: 'BRANCHES',
            expiresAt: (0, stock_summary_rules_1.istInstant)(this.runs.expiresAt(run)),
            rows: slice.map((r) => r.wire),
            page,
            view: (0, stock_summary_rules_1.viewEcho)(view),
            totalsShown: {
                rows: shown.length,
                openingValue: '0.00',
                inwardValue: '0.00',
                outwardValue: '0.00',
                costAdj: '0.00',
                closingValue: (0, stock_summary_rules_1.money)(chain),
            },
        };
    }
    async groups(q) {
        await this.assertView();
        const run = this.itemRunOf(q.runId, q.companyId);
        const by = q.groupBy ?? 'GROUP';
        const kept = (0, stock_summary_rules_1.filterItemRows)(run.rows, {
            hideZero: q.hideZero ?? true,
            onlyNegative: q.onlyNegative ?? false,
            show: q.show ?? 'ALL',
            find: '',
            groupBy: null,
            groupKey: null,
        });
        const g = (0, stock_summary_rules_1.groupRows)(kept, by);
        return { runId: run.runId, groupBy: by, rows: g.rows, total: g.total };
    }
    async godowns(q) {
        await this.assertView();
        const run = this.itemRunOf(q.runId, q.companyId);
        const view = (0, stock_summary_rules_1.viewOf)(q);
        const data = godownTab(run, view);
        const { slice, page } = (0, stock_summary_rules_1.pageOf)(data.rows, view);
        return {
            runId: run.runId,
            godowns: data.columns,
            rows: slice.map((r) => (0, stock_summary_rules_1.godownRow)(r, data.columns)),
            totals: (0, stock_summary_rules_1.godownTotals)(data.rows, data.columns),
            page,
            view: (0, stock_summary_rules_1.viewEcho)(view),
        };
    }
    async branches(q) {
        const rights = await this.assertView();
        assertRange(q.from, q.to);
        const view = (0, stock_summary_rules_1.viewOf)(q);
        const userId = this.userId();
        const built = await this.snapshot(async (db) => {
            const r = await this.resolve(db, q);
            const m = await this.moment(db);
            const todayOnly = r.sql.to >= m.today;
            const cells = await db.$queryRaw(todayOnly ? (0, stock_summary_sql_1.branchesNowSql)(r.sql) : (0, stock_summary_sql_1.branchesReplaySql)(r.sql));
            const transit = await db.$queryRaw(todayOnly ? (0, stock_summary_sql_1.transitNowSql)(r.sql, 'all') : (0, stock_summary_sql_1.transitReplaySql)(r.sql, null));
            const items = [...new Set([...cells.map((c) => c.item), ...transit.map((t) => t.item)])];
            assertItemCap(items.length);
            const facts = items.length ? await db.$queryRaw((0, stock_summary_sql_1.factsSql)(items)) : [];
            const all = await db.$queryRaw((0, stock_summary_sql_1.companyBranchesSql)(r.sql.companyId));
            return { r, m, todayOnly, cells, transit, facts, all };
        });
        const { r, m, todayOnly, cells, transit, facts, all } = built;
        const used = new Set(cells.filter((c) => !(0, stock_summary_rules_1.dec)(c.q).isZero() || !(0, stock_summary_rules_1.dec)(c.v).isZero()).map((c) => c.branch));
        const branches = all
            .filter((b) => used.has(b.branch_id))
            .map((b) => ({ branchId: b.branch_id, name: b.name }));
        const leftOut = all.filter((b) => !used.has(b.branch_id)).map((b) => b.name);
        const rows = (0, stock_summary_rules_1.buildBranchRows)({
            cells,
            transit,
            facts,
            columns: branches,
            qtyIn: r.qtyIn,
            companyId: r.sql.companyId,
        });
        const head = {
            ...this.headOf(r, m, todayOnly, rights, 'BRANCHES'),
            source: todayOnly ? 'STOCK_BALANCE' : 'LEDGER',
        };
        const run = this.runs.put(userId, r.sql.companyId, {
            kind: 'BRANCHES',
            head,
            rows,
            branches,
            leftOut,
            transfers: new Set(transit.map((t) => t.out_id)).size,
        });
        head.runId = run.runId;
        return this.branchesAnswer(run, view);
    }
    branchesAnswer(run, view) {
        const shown = (0, stock_summary_rules_1.branchView)(run.rows, view);
        const { slice, page } = (0, stock_summary_rules_1.pageOf)(shown, view);
        return {
            head: { ...run.head, expiresAt: (0, stock_summary_rules_1.istInstant)(this.runs.expiresAt(run)) },
            branches: [...run.branches],
            leftOut: [...run.leftOut],
            rows: slice.map((x) => x.wire),
            totals: (0, stock_summary_rules_1.branchTotals)(shown, run.branches, run.transfers),
            page,
            view: (0, stock_summary_rules_1.viewEcho)(view),
        };
    }
    async item(q) {
        await this.assertView();
        assertRange(q.from, q.to);
        const userId = this.userId();
        return this.snapshot(async (db) => {
            const r = await this.resolve(db, q, q.itemId);
            const m = await this.moment(db);
            const s = r.sql;
            const todayOnly = s.to >= m.today;
            const [facts] = await db.$queryRaw((0, stock_summary_sql_1.factsSql)([q.itemId]));
            const [extra] = await db.$queryRaw `
        SELECT NULLIF(btrim(i.item_hsn_code), '') AS hsn, spt.spt_name AS preset_name,
               (SELECT rp.srp_reorder_level * COALESCE(u.iuc_to_base_factor, 1)
                  FROM stock.stock_reorder_policy rp
                  LEFT JOIN inventory.item_unit_conversion u ON u.iuc_id = rp.srp_uom_id
                 WHERE rp.srp_company_id = ${s.companyId}::uuid AND rp.srp_branch_id = ${s.branchId}::uuid
                   AND rp.srp_item_id = i.item_id AND rp.srp_godown_id IS NULL
                   AND rp.srp_is_deleted = false AND rp.srp_is_active = true
                 ORDER BY rp.srp_modified_on DESC NULLS LAST, rp.srp_created_on DESC
                 LIMIT 1) AS reorder
          FROM inventory.item_master i
          LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
          LEFT JOIN stock.stock_track_preset spt
                 ON spt.spt_id = COALESCE(i.item_track_preset_id, g.itg_track_preset_id)
         WHERE i.item_id = ${q.itemId}::uuid`;
            const taxes = await (0, item_tax_rate_helper_1.resolveItemTaxRates)(db, [q.itemId], new Date(`${m.today}T00:00:00Z`));
            const tax = taxes.get(q.itemId);
            const [lastSale] = await db.$queryRaw((0, stock_summary_sql_1.lastSaleSql)(s, [q.itemId]));
            const [lastPurchase] = await db.$queryRaw((0, stock_summary_sql_1.lastPurchaseSql)(s, q.itemId));
            const closingHold = await db.$queryRaw((0, stock_valuation_sql_1.itemValuationSql)({
                companyId: s.companyId,
                branchId: s.branchId,
                itemId: q.itemId,
                asOf: s.to,
                wot: s.wot,
            }));
            const openingHold = await db.$queryRaw((0, stock_valuation_sql_1.itemValuationSql)({
                companyId: s.companyId,
                branchId: s.branchId,
                itemId: q.itemId,
                asOf: s.openingAsOf,
                wot: s.wot,
            }));
            const scopeOf = { godownId: s.godownId, bucket: s.bucket, lotId: null };
            const closing = (0, stock_valuation_sql_1.valueInScope)(closingHold, scopeOf);
            const opening = (0, stock_valuation_sql_1.valueInScope)(openingHold, scopeOf);
            const ls = {
                companyId: s.companyId,
                branchId: s.branchId,
                itemId: q.itemId,
                from: s.from,
                to: s.to,
                godownId: s.godownId,
                bucket: s.bucket,
                lotId: null,
                wot: s.wot,
                withRevaluations: s.godownId === null && (s.bucket === null || s.bucket === 'SALEABLE'),
                types: [],
                showReversed: true,
            };
            const [open] = await db.$queryRaw((0, item_ledger_sql_1.openingSql)(ls, false));
            const agg = await db.$queryRaw((0, item_ledger_sql_1.summarySql)(ls));
            const sum = (0, item_ledger_service_1.summaryOf)(agg);
            const { unit, factor } = (0, stock_summary_rules_1.unitOf)(facts, r.qtyIn);
            let lots;
            if (todayOnly) {
                const now = await db.$queryRaw((0, stock_summary_sql_1.lotsNowSql)(s, q.itemId));
                lots = lotsBlock('STOCK_BALANCE', m.today, now.map((x) => ({
                    godownId: x.godown_id,
                    godownName: x.godown_name,
                    bucket: x.bucket,
                    lotId: x.lot_id,
                    batchNo: x.batch_no,
                    mrp: x.mrp === null ? null : (0, stock_summary_rules_1.money)(x.mrp),
                    expiry: x.expiry,
                    supplier: x.supplier,
                    onHand: (0, stock_summary_rules_1.dec)(x.on_hand),
                    reserved: (0, stock_summary_rules_1.dec)(x.reserved),
                    available: (0, stock_summary_rules_1.dec)(x.available),
                    rate: (0, stock_summary_rules_1.dec)(x.cost_rate),
                    value: (0, stock_summary_rules_1.dec)(x.value),
                    inScope: (0, stock_summary_rules_1.holdingInScope)({ godown: x.godown_id, bucket: x.bucket }, s),
                })), factor);
            }
            else {
                const held = closingHold.filter((h) => !(0, stock_summary_rules_1.dec)(h.q).isZero());
                const names = held.length
                    ? await db.$queryRaw((0, stock_summary_sql_1.lotNamesSql)([...new Set(held.map((h) => h.lot))], [...new Set(held.map((h) => h.godown))]))
                    : [];
                const lot = new Map(names.filter((n) => n.k === 'L').map((n) => [n.id, n]));
                const gd = new Map(names.filter((n) => n.k === 'G').map((n) => [n.id, n]));
                const ordered = [...held].sort((a, b) => {
                    const ga = gd.get(a.godown);
                    const gb = gd.get(b.godown);
                    return ((ga?.sort ?? 1e9) - (gb?.sort ?? 1e9) ||
                        (ga?.name ?? '').localeCompare(gb?.name ?? '') ||
                        a.bucket.localeCompare(b.bucket) ||
                        (lot.get(a.lot)?.expiry ?? '9999').localeCompare(lot.get(b.lot)?.expiry ?? '9999') ||
                        a.lot.localeCompare(b.lot));
                });
                lots = lotsBlock('LEDGER', s.to, ordered.map((h) => {
                    const l = lot.get(h.lot);
                    return {
                        godownId: h.godown,
                        godownName: gd.get(h.godown)?.name ?? null,
                        bucket: h.bucket,
                        lotId: h.lot,
                        batchNo: l?.batch_no ?? null,
                        mrp: l?.mrp === null || l?.mrp === undefined ? null : (0, stock_summary_rules_1.money)(l.mrp),
                        expiry: l?.expiry ?? null,
                        supplier: l?.supplier ?? null,
                        onHand: (0, stock_summary_rules_1.dec)(h.q),
                        reserved: null,
                        available: null,
                        rate: (0, stock_summary_rules_1.dec)(h.rate),
                        value: (0, stock_summary_rules_1.dec)(h.value),
                        inScope: (0, stock_summary_rules_1.holdingInScope)(h, s),
                    };
                }), factor);
            }
            const ilClosingQty = (0, stock_summary_rules_1.dec)(open.q).plus(sum.q_all);
            const valueIn = (0, stock_summary_rules_1.dec)(sum.v_in ?? 0);
            const valueOut = (0, stock_summary_rules_1.dec)(sum.v_out ?? 0);
            const costAdj = closing.value.minus(opening.value.plus(valueIn).minus(valueOut));
            const qtyEqual = ilClosingQty.equals(closing.qty);
            const valueEqual = (0, stock_summary_rules_1.dec)(lots.totalInScope.value).equals(closing.value.toDecimalPlaces(2));
            let row = null;
            if (q.runId) {
                const run = this.runs.get(q.runId, userId, {
                    companyId: s.companyId,
                    kind: 'ITEMS',
                });
                const rr = run?.rows.find((x) => x.itemId === q.itemId);
                if (rr) {
                    row = rr.num.closing.equals(ilClosingQty) && rr.vals.value.equals(closing.value);
                }
            }
            const reorder = extra?.reorder === null || extra?.reorder === undefined ? null : (0, stock_summary_rules_1.dec)(extra.reorder);
            const vm = closingHold[0]?.vm ?? openingHold[0]?.vm ?? 'WAVG';
            return {
                item: {
                    itemId: q.itemId,
                    code: facts?.code ?? null,
                    name: facts?.name ?? '',
                    group: facts?.group_name ?? null,
                    brand: facts?.brand_name ?? null,
                    hsn: extra?.hsn ?? null,
                    gstRate: tax?.taxId ? new client_1.Prisma.Decimal(tax.taxPerc).toFixed(2) : null,
                    trackedAs: (0, cost_price_bulk_rules_1.trackedAsOf)(extra?.preset_name),
                    valuation: vm,
                    baseUnit: facts?.base_unit ?? '',
                    unit,
                    reorderLevel: reorder ? (0, stock_summary_rules_1.qty)(reorder, factor) : null,
                    belowReorder: reorder ? closing.qty.lessThan(reorder) : null,
                    lastPurchase: lastPurchase
                        ? {
                            date: lastPurchase.d,
                            docNo: lastPurchase.doc_no,
                            rate: (0, stock_summary_rules_1.dec)(lastPurchase.rate).times(factor).toFixed(2),
                        }
                        : null,
                    lastSale: lastSale?.last_sale ?? null,
                },
                lots,
                movement: {
                    opening: { date: s.from, qty: (0, stock_summary_rules_1.qty)(open.q, factor), value: (0, stock_summary_rules_1.money)(opening.value) },
                    byType: (0, item_ledger_service_1.byTypeOf)(agg, factor).map((b) => ({ ...b, detail: '' })),
                    totals: {
                        qtyIn: (0, stock_summary_rules_1.qty)(sum.q_in ?? 0, factor),
                        qtyOut: (0, stock_summary_rules_1.qty)(sum.q_out ?? 0, factor),
                        valueIn: (0, stock_summary_rules_1.money)(valueIn),
                        valueOut: (0, stock_summary_rules_1.money)(valueOut),
                    },
                    costAdj: (0, stock_summary_rules_1.money)(costAdj),
                    closing: { date: s.to, qty: (0, stock_summary_rules_1.qty)(ilClosingQty, factor), value: (0, stock_summary_rules_1.money)(closing.value) },
                    ties: { qtyEqual, valueEqual, row },
                },
            };
        });
    }
    async export(q) {
        const rights = await this.assertView();
        this.assertAlso(rights, 'export', 'export the Stock Summary');
        if (q.tab === 'BRANCHES') {
            const run = this.runOf(q.runId, q.companyId, 'BRANCHES');
            return this.exportBranches(run, (0, stock_summary_rules_1.viewOf)(q));
        }
        const run = this.itemRunOf(q.runId, q.companyId);
        return this.exportItems(run, q.tab, (0, stock_summary_rules_1.viewOf)(q), q.groupBy ?? null);
    }
    exportItems(run, tab, view, groupBy) {
        const head = this.headNow(run);
        const printedAs = (0, stock_summary_rules_1.printedAsOf)({
            branchName: head.branchName,
            from: head.from,
            to: head.to,
            godownName: tab === 'GODOWNS' ? null : head.godownName,
            groupName: head.groupName,
            brandName: head.brandName,
            bucket: head.bucket,
            valueAt: head.valueAt,
            qtyIn: head.qtyIn,
            hideZero: view.hideZero,
            onlyNegative: view.onlyNegative,
            show: view.show,
            find: tab === 'GROUPS' ? '' : view.find,
            drill: tab === 'GROUPS' ? null : (0, stock_summary_rules_1.drillText)(run.rows, view.groupBy, view.groupKey),
        });
        if (tab === 'GROUPS') {
            const kept = (0, stock_summary_rules_1.filterItemRows)(run.rows, { ...view, find: '', groupBy: null, groupKey: null });
            const g = (0, stock_summary_rules_1.groupRows)(kept, groupBy ?? 'GROUP');
            capRows(g.rows.length);
            return {
                head,
                printedAs,
                tab,
                rows: g.rows,
                totals: g.total,
                transitOut: null,
                tie: null,
                totalRows: g.rows.length,
            };
        }
        if (tab === 'GODOWNS') {
            const data = godownTab(run, view);
            capRows(data.rows.length);
            return {
                head,
                printedAs,
                tab,
                rows: data.rows.map((r) => (0, stock_summary_rules_1.godownRow)(r, data.columns)),
                totals: (0, stock_summary_rules_1.godownTotals)(data.rows, data.columns),
                transitOut: null,
                tie: null,
                godowns: data.columns,
                totalRows: data.rows.length,
            };
        }
        const shown = (0, stock_summary_rules_1.itemView)(run.rows, view);
        capRows(shown.length);
        return {
            head,
            printedAs,
            tab,
            rows: shown.map((r) => r.wire),
            totals: { rows: run.rows.length, rowsShown: shown.length, ...(0, stock_summary_rules_1.sumValues)(shown) },
            transitOut: run.transitOut,
            tie: run.tie,
            totalRows: shown.length,
        };
    }
    exportBranches(run, view) {
        const shown = (0, stock_summary_rules_1.branchView)(run.rows, view);
        capRows(shown.length);
        const head = { ...run.head, expiresAt: (0, stock_summary_rules_1.istInstant)(this.runs.expiresAt(run)) };
        return {
            head,
            printedAs: (0, stock_summary_rules_1.printedAsOf)({
                branchName: 'All branches',
                from: head.from,
                to: head.to,
                godownName: null,
                groupName: head.groupName,
                brandName: head.brandName,
                bucket: head.bucket,
                valueAt: head.valueAt,
                qtyIn: head.qtyIn,
                hideZero: view.hideZero,
                onlyNegative: view.onlyNegative,
                show: view.show,
                find: view.find,
            }),
            tab: 'BRANCHES',
            rows: shown.map((r) => r.wire),
            totals: (0, stock_summary_rules_1.branchTotals)(shown, run.branches, run.transfers),
            transitOut: null,
            tie: null,
            branches: [...run.branches],
            totalRows: shown.length,
        };
    }
    async printData(input) {
        const rights = await this.assertView();
        this.assertAlso(rights, 'print', 'print the Stock Summary');
        const userId = this.userId();
        const view = (0, stock_summary_rules_1.viewOf)(input.view ?? input.query ?? {});
        let run = null;
        if (input.runId) {
            run = this.runs.get(input.runId, userId, { kind: 'ITEMS' });
        }
        if (!run && input.query) {
            run = await this.printRun(input.query, rights, view.hideZero, userId);
        }
        if (!run)
            return this.gone(input.runId ?? '');
        return this.exportItems(run, 'ITEMS', view, null);
    }
    async printRun(query, rights, hideZero, userId) {
        const key = `${userId}|${JSON.stringify(query)}`;
        const t = Date.now();
        for (const [k, v] of this.printRuns) {
            if (t - v.at > PRINT_RUN_REUSE_MS)
                this.printRuns.delete(k);
        }
        let known = this.printRuns.get(key);
        while (known) {
            const built = await known.run;
            const live = this.runs.get(built.runId, userId, { kind: 'ITEMS' });
            if (live)
                return live;
            if (this.printRuns.get(key) === known)
                this.printRuns.delete(key);
            known = this.printRuns.get(key);
        }
        assertRange(query.from, query.to);
        const entry = {
            run: this.buildItemsRun(query, rights, hideZero),
            at: t,
        };
        this.printRuns.set(key, entry);
        entry.run.then(() => {
            entry.at = Date.now();
        }, () => {
            if (this.printRuns.get(key) === entry)
                this.printRuns.delete(key);
        });
        return entry.run;
    }
    async buildItemsRun(q, rights, hideZero) {
        const userId = this.userId();
        const built = await this.snapshot(async (db) => {
            const r = await this.resolve(db, q);
            const m = await this.moment(db);
            const s = r.sql;
            const todayOnly = s.to >= m.today;
            const pass = (0, stock_summary_rules_1.mergePass)(await db.$queryRaw((0, stock_summary_sql_1.passSql)(s)));
            let balance = [];
            let after = [];
            let transitIn = [];
            let bnd = [];
            if (todayOnly) {
                balance = await db.$queryRaw((0, stock_summary_sql_1.balanceNowSql)(s));
                after = await db.$queryRaw((0, stock_summary_sql_1.rowsAfterSql)(s));
                transitIn = await db.$queryRaw((0, stock_summary_sql_1.transitNowSql)(s, 'in'));
                bnd = await db.$queryRaw((0, stock_summary_sql_1.bndNowSql)(s));
            }
            const items = [
                ...new Set([
                    ...pass.map((p) => p.item),
                    ...transitIn.map((t) => t.item),
                    ...bnd.map((b) => b.item),
                ]),
            ];
            assertItemCap(items.length);
            const facts = items.length ? await db.$queryRaw((0, stock_summary_sql_1.factsSql)(items)) : [];
            const sales = items.length
                ? await db.$queryRaw((0, stock_summary_sql_1.lastSaleSql)(s, items))
                : [];
            const transitOut = await db.$queryRaw(todayOnly ? (0, stock_summary_sql_1.transitNowSql)(s, 'out') : (0, stock_summary_sql_1.transitReplaySql)(s, s.branchId));
            const godownIds = [...new Set(pass.map((p) => p.godown))];
            const godowns = await db.$queryRaw `
        SELECT gdl_id, gdl_name
          FROM inventory.godown_locations
         WHERE gdl_branch_id = ${s.branchId}::uuid OR gdl_id = ANY(${godownIds}::uuid[])
         ORDER BY (gdl_branch_id = ${s.branchId}::uuid) DESC, gdl_is_deleted, gdl_sort NULLS LAST,
                  lower(gdl_name), gdl_id`;
            return {
                r,
                m,
                todayOnly,
                pass,
                facts,
                sales,
                balance,
                after,
                transitIn,
                transitOut,
                godowns,
                bnd,
            };
        });
        const { r, m, todayOnly } = built;
        const rows = (0, stock_summary_rules_1.buildItemRows)({
            scope: {
                companyId: r.sql.companyId,
                godownId: r.sql.godownId,
                bucket: r.sql.bucket,
                qtyIn: r.qtyIn,
                to: r.sql.to,
                today: m.today,
                todayOnly,
                noSaleDays: r.noSaleDays,
            },
            pass: built.pass,
            facts: built.facts,
            lastSale: new Map(built.sales.map((x) => [x.item, x.last_sale])),
            balance: built.balance,
            after: built.after,
            transitIn: built.transitIn,
            bnd: built.bnd,
        });
        const head = this.headOf(r, m, todayOnly, rights, 'ITEMS');
        const run = this.runs.put(userId, r.sql.companyId, {
            kind: 'ITEMS',
            head,
            tiles: (0, stock_summary_rules_1.tilesOf)(rows, todayOnly, hideZero),
            tie: (0, stock_summary_rules_1.tieOfRun)(rows, todayOnly),
            transitOut: transitOutOf(built.transitOut, todayOnly),
            rows,
            branchGodowns: built.godowns.map((g) => ({ godownId: g.gdl_id, name: g.gdl_name })),
        });
        head.runId = run.runId;
        return run;
    }
    headOf(r, m, todayOnly, rights, kind) {
        return {
            runId: '',
            kind,
            asOf: m.at,
            expiresAt: '',
            companyId: r.sql.companyId,
            companyName: r.companyName,
            branchId: r.sql.branchId,
            branchName: r.branchName,
            from: r.sql.from,
            to: r.sql.to,
            todayOnly,
            godownId: r.sql.godownId,
            godownName: r.godownName,
            groupId: r.sql.groupId,
            groupName: r.groupName,
            brandId: r.sql.brandId,
            brandName: r.brandName,
            bucket: r.bucket,
            valueAt: r.valueAt,
            qtyIn: r.qtyIn,
            noSaleDays: r.noSaleDays,
            rights: rightsOf(rights),
        };
    }
    headNow(run) {
        return { ...run.head, expiresAt: (0, stock_summary_rules_1.istInstant)(this.runs.expiresAt(run)) };
    }
    userId() {
        return this.requestContext.getUserId() ?? '';
    }
    assertView() {
        return (0, rights_1.assertMenuRight)(this.prisma, {
            userId: this.requestContext.getUserId(),
            menuId: stock_summary_types_1.STOCK_SUMMARY_MENU_ID,
            right: 'view',
            codePrefix: stock_summary_types_1.STOCK_SUMMARY_CODE_PREFIX,
            action: 'open the Stock Summary',
        });
    }
    assertAlso(rights, right, action) {
        if (rights[right])
            return;
        const message = `This user may not ${action} (menu ${stock_summary_types_1.STOCK_SUMMARY_MENU_ID}: ` +
            `${rights_1.RIGHT_COLUMN[right]} is not granted)`;
        (0, module_shared_utils_1.throwForbidden)(message, [
            {
                field: 'userId',
                message,
                code: `${stock_summary_types_1.STOCK_SUMMARY_CODE_PREFIX}_RIGHT_${right.toUpperCase()}`,
            },
        ]);
    }
    gone(runId) {
        const message = 'This report run is gone (expired, restarted, another user’s, or another tab’s). Show again.';
        throw new common_1.GoneException((0, module_shared_utils_1.buildErrorResponse)('Stock Summary run expired', [
            { field: 'runId', message: `${message} (${runId})`, code: stock_summary_types_1.STOCK_SUMMARY_ERROR.RUN_EXPIRED },
        ]));
    }
    runOf(runId, companyId, kind) {
        const run = this.runs.get(runId, this.userId(), { companyId: companyId ?? null, kind });
        if (!run)
            this.gone(runId);
        return run;
    }
    itemRunOf(runId, companyId) {
        return this.runOf(runId, companyId, 'ITEMS');
    }
    snapshot(work) {
        return this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SET TRANSACTION READ ONLY`;
            await tx.$executeRaw `SET LOCAL plan_cache_mode = force_custom_plan`;
            await tx.$executeRaw `SET LOCAL jit = off`;
            return work(tx);
        }, TX_OPTIONS);
    }
    async moment(db) {
        const [row] = await db.$queryRaw `
      SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS d,
             to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') AS at`;
        return { today: row.d, at: row.at };
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
    async lookup(db, q, itemId = null) {
        const [row] = await db.$queryRaw `
      SELECT b.br_comp_id, b.br_name, b.br_is_deleted, c.comp_name,
             g.gdl_branch_id, g.gdl_name, g.gdl_is_deleted,
             gr.itg_id, gr.itg_name, gr.itg_is_deleted,
             bd.brand_id, bd.brand_name, bd.brand_is_deleted,
             i.item_id, i.item_company_id, i.item_is_deleted
        FROM (SELECT 1) x
        LEFT JOIN public.branch_master b ON b.br_id = ${q.branchId}::uuid
        LEFT JOIN public.companys c ON c.comp_id = ${q.companyId}::uuid
        LEFT JOIN inventory.godown_locations g ON g.gdl_id = ${q.godownId ?? null}::uuid
        LEFT JOIN inventory.item_group_master gr ON gr.itg_id = ${q.groupId ?? null}::uuid
        LEFT JOIN inventory.item_brand_master bd ON bd.brand_id = ${q.brandId ?? null}::uuid
        LEFT JOIN inventory.item_master i ON i.item_id = ${itemId}::uuid`;
        if (!row.br_comp_id || row.br_comp_id !== q.companyId || row.br_is_deleted === true) {
            refuse(stock_summary_types_1.STOCK_SUMMARY_ERROR.BRANCH_NOT_IN_COMPANY, 'branchId', 'That branch is not part of this company.');
        }
        if (q.godownId && (row.gdl_branch_id !== q.branchId || row.gdl_is_deleted === true)) {
            refuse(stock_summary_types_1.STOCK_SUMMARY_ERROR.GODOWN_NOT_IN_BRANCH, 'godownId', 'That godown is not in this branch.');
        }
        if (q.groupId && (!row.itg_id || row.itg_is_deleted === true)) {
            refuse(stock_summary_types_1.STOCK_SUMMARY_ERROR.GROUP_NOT_FOUND, 'groupId', 'That item group is not there now.');
        }
        if (q.brandId && (!row.brand_id || row.brand_is_deleted === true)) {
            refuse(stock_summary_types_1.STOCK_SUMMARY_ERROR.BRAND_NOT_FOUND, 'brandId', 'That brand is not there now.');
        }
        if (itemId &&
            (!row.item_id ||
                row.item_is_deleted === true ||
                (row.item_company_id !== null && row.item_company_id !== q.companyId))) {
            refuse(stock_summary_types_1.STOCK_SUMMARY_ERROR.ITEM_NOT_FOUND, 'itemId', 'This item is not there now, or it belongs to another company.');
        }
        return row;
    }
    async resolve(db, q, itemId = null) {
        const row = await this.lookup(db, q, itemId);
        const bucket = q.bucket ?? 'SALEABLE';
        const valueAt = q.valueAt ?? 'WITHOUT_TAX';
        return {
            sql: {
                companyId: q.companyId,
                branchId: q.branchId,
                from: q.from,
                to: q.to,
                openingAsOf: (0, item_ledger_rules_1.dayBefore)(q.from),
                godownId: q.godownId ?? null,
                bucket: bucket === 'ALL' ? null : bucket,
                groupId: q.groupId ?? null,
                brandId: q.brandId ?? null,
                wot: valueAt === 'WITHOUT_TAX',
            },
            companyName: row.comp_name,
            branchName: row.br_name,
            godownName: q.godownId ? row.gdl_name : null,
            groupName: q.groupId ? row.itg_name : null,
            brandName: q.brandId ? row.brand_name : null,
            bucket,
            valueAt,
            qtyIn: q.qtyIn ?? 'BASE',
            noSaleDays: q.noSaleDays ?? stock_summary_rules_1.DEFAULT_NO_SALE_DAYS,
        };
    }
};
exports.StockSummaryService = StockSummaryService;
exports.StockSummaryService = StockSummaryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        stock_summary_run_store_1.StockSummaryRunStore])
], StockSummaryService);
function refuse(code, field, message) {
    (0, module_shared_utils_1.throwUnprocessable)('Stock Summary request refused', [{ field, message, code }]);
}
function assertRange(from, to) {
    if (!(0, item_ledger_rules_1.isRealIsoDate)(from) || !(0, item_ledger_rules_1.isRealIsoDate)(to) || from > to) {
        refuse(stock_summary_types_1.STOCK_SUMMARY_ERROR.RANGE_REVERSED, 'from', `${from} is after ${to}.`);
    }
}
function assertItemCap(items) {
    if (items > stock_summary_rules_1.ITEM_CAP) {
        (0, module_shared_utils_1.throwUnprocessable)('Stock Summary request refused', [
            {
                field: 'groupId',
                code: stock_summary_types_1.STOCK_SUMMARY_ERROR.TOO_MANY_ITEMS,
                message: `${items} items — one Show takes up to ${stock_summary_rules_1.ITEM_CAP}. Pick a group or a brand.`,
            },
        ]);
    }
}
function capRows(n) {
    if (n > stock_summary_rules_1.EXPORT_ROW_CAP) {
        (0, module_shared_utils_1.throwUnprocessable)('Stock Summary request refused', [
            {
                field: 'runId',
                code: stock_summary_types_1.STOCK_SUMMARY_ERROR.TOO_MANY_ROWS,
                message: `${n} rows — Print and Excel take up to ${stock_summary_rules_1.EXPORT_ROW_CAP}. Pick a group or a brand.`,
            },
        ]);
    }
}
function rightsOf(rights) {
    return { print: rights.print, export: rights.export };
}
function transitOutOf(rows, todayOnly) {
    let value = stock_summary_rules_1.D0;
    const transfers = new Map();
    const items = new Set();
    for (const t of rows) {
        value = value.plus(t.v);
        items.add(t.item);
        if (!transfers.has(t.out_id)) {
            transfers.set(t.out_id, { docNo: t.doc_no, toBranch: t.to_branch_name });
        }
    }
    return {
        checked: true,
        source: todayOnly ? 'STOCK_TRANSIT' : 'LEDGER',
        transfers: transfers.size,
        items: items.size,
        value: (0, stock_summary_rules_1.money)(value),
        docs: [...transfers.values()].sort((a, b) => (a.docNo ?? '').localeCompare(b.docNo ?? '')),
    };
}
function godownTab(run, view) {
    const columns = (0, stock_summary_rules_1.godownColumns)(run.rows, run.branchGodowns);
    const shown = (0, stock_summary_rules_1.itemView)(run.rows, { ...view, hideZero: false }).filter((r) => !view.hideZero ||
        r.godowns.some((g) => !g.qty.isZero() || !g.value.isZero() || (g.bnd !== null && !g.bnd.isZero())));
    return { columns, rows: shown };
}
function lotsBlock(source, asOf, rows, factor) {
    let onHand = stock_summary_rules_1.D0;
    let reserved = stock_summary_rules_1.D0;
    let available = stock_summary_rules_1.D0;
    let value = stock_summary_rules_1.D0;
    for (const r of rows) {
        if (!r.inScope)
            continue;
        onHand = onHand.plus(r.onHand);
        reserved = reserved.plus(r.reserved ?? stock_summary_rules_1.D0);
        available = available.plus(r.available ?? stock_summary_rules_1.D0);
        value = value.plus(r.value);
    }
    const live = source === 'STOCK_BALANCE';
    const ordered = [...rows.filter((r) => r.inScope), ...rows.filter((r) => !r.inScope)];
    const out = ordered.map((r) => ({
        godownId: r.godownId,
        godownName: r.godownName,
        bucket: r.bucket,
        lotId: r.lotId,
        batchNo: r.batchNo,
        mrp: r.mrp,
        expiry: r.expiry,
        supplier: r.supplier,
        onHand: (0, stock_summary_rules_1.qty)(r.onHand, factor),
        reserved: r.reserved === null ? null : (0, stock_summary_rules_1.qty)(r.reserved, factor),
        available: r.available === null ? null : (0, stock_summary_rules_1.qty)(r.available, factor),
        costRate: (0, stock_summary_rules_1.dec)(r.rate).times(factor).toFixed(2),
        value: (0, stock_summary_rules_1.money)(r.value),
        inScope: r.inScope,
    }));
    return {
        source,
        asOf,
        rows: out,
        totalInScope: {
            onHand: (0, stock_summary_rules_1.qty)(onHand, factor),
            reserved: live ? (0, stock_summary_rules_1.qty)(reserved, factor) : null,
            available: live ? (0, stock_summary_rules_1.qty)(available, factor) : null,
            value: (0, stock_summary_rules_1.money)(value),
        },
    };
}
//# sourceMappingURL=stock-summary.service.js.map