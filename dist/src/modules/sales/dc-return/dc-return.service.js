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
exports.DcReturnService = exports.BUCKET_BY_CONDITION = exports.DCR_SPEC = void 0;
exports.postedReturnSums = postedReturnSums;
exports.settleLastReturn = settleLastReturn;
exports.costPerBaseOf = costPerBaseOf;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const batch_detail_helper_1 = require("../../stocks/batch-detail/batch-detail.helper");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const charge_detail_service_1 = require("../../master/charge-detail/charge-detail.service");
const tender_detail_service_1 = require("../../accountsModule/tenderDetail/tender-detail.service");
const tender_detail_api_types_1 = require("../../accountsModule/tenderDetail/types/tender-detail-api.types");
const dc_fulfilment_service_1 = require("../posting/dc-fulfilment.service");
const sale_order_service_1 = require("../sale-order/sale-order.service");
const stock_reservation_service_1 = require("../posting/stock-reservation.service");
const doc_register_service_1 = require("../../../common/posting/doc-register.service");
const gst_gateway_service_1 = require("../posting/gst-gateway.service");
const sales_context_service_1 = require("../posting/sales-context.service");
const sales_doc_blocks_service_1 = require("../posting/sales-doc-blocks.service");
const sales_doc_store_1 = require("../posting/sales-doc-store");
const sales_leg_sources_1 = require("../posting/sales-leg.sources");
const voucher_posting_service_1 = require("../../../common/posting/voucher-posting.service");
const sales_stock_service_1 = require("../posting/sales-stock.service");
const statutory_service_1 = require("../../../common/posting/statutory.service");
const transport_band_service_1 = require("../posting/transport-band.service");
const sales_guards_1 = require("../posting/sales.guards");
const sales_errors_1 = require("../posting/sales.errors");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const posting_types_1 = require("../posting/types/posting.types");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const dc_common_1 = require("../delivery-challan/dc-common");
const save_dc_return_dto_1 = require("./dto/save-dc-return.dto");
const save_dc_return_item_dto_1 = require("./dto/save-dc-return-item.dto");
exports.DCR_SPEC = {
    kind: 'DC_RETURN',
    headerDelegate: 'saleDcReturn',
    itemDelegate: 'saleDcReturnItem',
    p: 'sdr',
    ip: 'sdri',
    itemFk: 'sdriReturnId',
    refnoField: 'sdrReturnRefno',
    slnoField: 'sdrReturnSlno',
    dateField: 'sdrReturnDate',
    datetimeField: 'sdrReturnDatetime',
    custField: 'sdrCustId',
    custNameField: 'sdrCustName',
    revisionField: null,
    voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.DC_RETURN,
    menuId: sales_doc_utils_1.SALES_MENU_ID.DC_RETURN,
    statusDocType: txn_status_log_helper_1.TxnStatusDocType.DC_RETURN,
    chargeDocType: null,
    tenderDocType: null,
    tenderDrCr: tender_detail_api_types_1.TenderDrCr.CR,
    transportDocType: 'DC_RETURN',
    transportDirection: 'INWARD',
    tableName: 'sale_dc_return',
    itemTableName: 'sale_dc_return_item',
    screenName: 'DC Return',
    optionalFields: save_dc_return_dto_1.SDR_OPTIONAL_FIELDS,
    dateFields: save_dc_return_dto_1.SDR_DATE_FIELDS,
    serverOwned: save_dc_return_dto_1.SDR_SERVER_OWNED,
    itemOptionalFields: save_dc_return_item_dto_1.SDRI_OPTIONAL_FIELDS,
    itemDateFields: save_dc_return_item_dto_1.SDRI_DATE_FIELDS,
    itemRequired: ['sdriDcItemId', 'sdriItemId', 'sdriItemUnitId', 'sdriGodownId'],
    headerRequired: ['sdrCounterId', 'sdrDcId', 'sdrDcAccYear'],
    itemDefaults: (h) => ({ sdriPriceLevel: 1, sdriDcAccYear: h.sdrDcAccYear }),
    headerWhereUnique: 'sdrId_sdrAccYear',
    itemWhereUnique: 'sdriId_sdriAccYear',
};
exports.BUCKET_BY_CONDITION = {
    RESTOCK: 'SALEABLE',
    DAMAGED: 'DAMAGED',
    EXPIRED: 'EXPIRED',
    SCRAP: 'QUARANTINE',
};
const CONDITIONS = Object.keys(exports.BUCKET_BY_CONDITION);
const TX = { timeout: 60_000, maxWait: 10_000 };
const RIGHT_CODE = {
    view: posting_types_1.SALES_ERROR_CODES.RIGHT_VIEW,
    create: posting_types_1.SALES_ERROR_CODES.RIGHT_CREATE,
    edit: posting_types_1.SALES_ERROR_CODES.RIGHT_EDIT,
    delete: posting_types_1.SALES_ERROR_CODES.RIGHT_DELETE,
    print: posting_types_1.SALES_ERROR_CODES.RIGHT_PRINT,
    export: posting_types_1.SALES_ERROR_CODES.RIGHT_EXPORT,
    post: posting_types_1.SALES_ERROR_CODES.RIGHT_POST,
    cancel: posting_types_1.SALES_ERROR_CODES.RIGHT_CANCEL,
    amend: posting_types_1.SALES_ERROR_CODES.RIGHT_AMEND,
    override: posting_types_1.SALES_ERROR_CODES.RIGHT_OVERRIDE,
    retender: posting_types_1.SALES_ERROR_CODES.RIGHT_RETENDER,
};
const ZERO = new client_1.Prisma.Decimal(0);
const ofReturnScope = (challan, companyId, branchId) => challan.sdcCompanyId === companyId && challan.sdcBranchId === branchId;
const SHARED_FIGURES = [
    ['sdriGrossAmt', 'sdiGrossAmt', 2],
    ['sdriItemDiscAmt', 'sdiItemDiscAmt', 2],
    ['sdriSchDiscAmt', 'sdiSchDiscAmt', 2],
    ['sdriTaxableAmt', 'sdiTaxableAmt', 2],
    ['sdriCgstAmt', 'sdiCgstAmt', 2],
    ['sdriSgstAmt', 'sdiSgstAmt', 2],
    ['sdriIgstAmt', 'sdiIgstAmt', 2],
    ['sdriCessAmt', 'sdiCessAmt', 2],
    ['sdriWeightQty', 'sdiWeightQty', 3],
];
const SETTLED_FIGURES = SHARED_FIGURES.map(([k]) => k);
const TAX_PARTS = ['sdriCgstAmt', 'sdriSgstAmt', 'sdriIgstAmt', 'sdriCessAmt'];
async function postedReturnSums(c, sdiIds) {
    const ids = [...new Set(sdiIds.filter((v) => typeof v === 'string' && v.length === 36))];
    if (ids.length === 0) {
        return new Map();
    }
    const rows = await c.$queryRaw `
    SELECT r.sdri_dc_item_id AS dc_item_id, SUM(r.sdri_return_qty) AS qty,
           SUM(r.sdri_gross_amt) AS gross, SUM(r.sdri_item_disc_amt) AS item_disc, SUM(r.sdri_sch_disc_amt) AS sch_disc,
           SUM(r.sdri_taxable_amt) AS taxable, SUM(r.sdri_cgst_amt) AS cgst, SUM(r.sdri_sgst_amt) AS sgst,
           SUM(r.sdri_igst_amt) AS igst, SUM(r.sdri_cess_amt) AS cess, SUM(r.sdri_weight_qty) AS weight
      FROM sales.sale_dc_return_item r
      JOIN sales.sale_dc_return h ON h.sdr_id = r.sdri_return_id AND h.sdr_acc_year = r.sdri_acc_year
     WHERE r.sdri_dc_item_id = ANY(${ids}::uuid[])
       AND r.sdri_is_deleted = false AND h.sdr_is_deleted = false AND h.sdr_status = 'POSTED'
     GROUP BY r.sdri_dc_item_id`;
    return new Map((rows ?? []).map((r) => [
        r.dc_item_id,
        {
            qty: r.qty,
            sdriGrossAmt: r.gross,
            sdriItemDiscAmt: r.item_disc,
            sdriSchDiscAmt: r.sch_disc,
            sdriTaxableAmt: r.taxable,
            sdriCgstAmt: r.cgst,
            sdriSgstAmt: r.sgst,
            sdriIgstAmt: r.igst,
            sdriCessAmt: r.cess,
            sdriWeightQty: r.weight,
        },
    ]));
}
function settleLastReturn(items, dcLines, posted) {
    const groups = new Map();
    items.forEach((it, idx) => {
        const k = it.sdriDcItemId;
        groups.set(k, [...(groups.get(k) ?? []), idx]);
    });
    const changed = [];
    for (const [k, idxs] of groups) {
        const d = dcLines.get(k);
        const dcQty = (0, dc_common_1.dec)(d?.sdiDcQty);
        if (!d || dcQty.isZero()) {
            continue;
        }
        const p = posted.get(k);
        const took = idxs
            .reduce((a, i) => a.plus((0, dc_common_1.dec)(items[i].sdriReturnQty)), ZERO)
            .plus((0, dc_common_1.dec)(p?.qty));
        if (!took.equals(dcQty)) {
            continue;
        }
        const last = idxs[idxs.length - 1];
        const others = idxs.slice(0, -1);
        const next = {};
        let negative = false;
        for (const [rk, dk, dp] of SHARED_FIGURES) {
            if (rk === 'sdriWeightQty' && !(0, dc_common_1.dec)(d.sdiWeightQty).greaterThan(0)) {
                continue;
            }
            const rest = (0, dc_common_1.dec)(d[dk])
                .minus((0, dc_common_1.dec)(p?.[rk]))
                .minus(others.reduce((a, i) => a.plus((0, dc_common_1.dec)(items[i][rk])), ZERO));
            if (rest.isNegative()) {
                negative = true;
                break;
            }
            next[rk] = rest.toFixed(dp);
        }
        if (negative) {
            continue;
        }
        const tax = TAX_PARTS.reduce((a, t) => a.plus((0, dc_common_1.dec)(next[t])), ZERO);
        next.sdriTaxAmt = tax.toFixed(2);
        next.sdriNetAmt = (0, dc_common_1.dec)(next.sdriTaxableAmt).plus(tax).toFixed(2);
        const it = items[last];
        if (Object.entries(next).some(([key, v]) => !(0, dc_common_1.dec)(it[key]).equals((0, dc_common_1.dec)(v)))) {
            Object.assign(it, next);
            changed.push(last);
        }
    }
    return changed;
}
const factorOf = (v) => {
    const f = (0, dc_common_1.dec)(v);
    return f.isZero() ? new client_1.Prisma.Decimal(1) : f;
};
let DcReturnService = class DcReturnService {
    prisma;
    salesContext;
    statutory;
    legs;
    register;
    stock;
    blocks;
    transportBand;
    fulfilment;
    gst;
    audit;
    saleOrders;
    reservations;
    store;
    constructor(prisma, salesContext, statutory, legs, register, stock, blocks, transportBand, fulfilment, gst, audit, charges, tenders, saleOrders, reservations) {
        this.prisma = prisma;
        this.salesContext = salesContext;
        this.statutory = statutory;
        this.legs = legs;
        this.register = register;
        this.stock = stock;
        this.blocks = blocks;
        this.transportBand = transportBand;
        this.fulfilment = fulfilment;
        this.gst = gst;
        this.audit = audit;
        this.saleOrders = saleOrders;
        this.reservations = reservations;
        this.store = new sales_doc_store_1.SalesDocStore(exports.DCR_SPEC, audit, charges, tenders, transportBand);
    }
    async lockOrdersOf(tx, items) {
        const src = await (0, dc_common_1.dcSourceOrdersOfLines)(tx, items.map((i) => i.sdriDcItemId));
        await (0, sales_guards_1.lockSourceOrders)(tx, src.orderIds, src.orderLineIds);
        return src.orderLineIds;
    }
    async syncOrders(tx, soiIds, actor, now, reopenRemark) {
        const refs = await (0, dc_common_1.orderLineRefsOf)(tx, soiIds);
        if (refs.length > 0) {
            await this.saleOrders.syncOrderFulfilment(tx, { refs, reopenRemark }, actor, now);
        }
        for (const [soId, lineNos] of await (0, dc_common_1.orderLineKeysOf)(tx, soiIds)) {
            await this.reservations.rederiveOrderLines(tx, soId, lineNos, actor, now);
        }
    }
    keys(dto) {
        return {
            id: dto.sdrId,
            companyId: dto.sdrCompanyId,
            branchId: dto.sdrBranchId,
            accYear: dto.sdrAccYear,
        };
    }
    async assertRight(right, client) {
        const rights = await this.salesContext.rights(exports.DCR_SPEC.menuId, client);
        if (!rights[right]) {
            (0, sales_errors_1.throwSalesRight)(`This user may not ${right} on this menu`, RIGHT_CODE[right]);
        }
        return rights;
    }
    async existingKeys(c, sdrId) {
        if (!sdrId) {
            return null;
        }
        const [r] = await c.$queryRaw `
      SELECT sdr_id, sdr_company_id, sdr_branch_id, sdr_acc_year FROM sales.sale_dc_return
       WHERE sdr_id = ${sdrId}::uuid AND sdr_is_deleted = false`;
        return r
            ? {
                id: r.sdr_id,
                companyId: r.sdr_company_id,
                branchId: r.sdr_branch_id,
                accYear: r.sdr_acc_year.trim(),
            }
            : null;
    }
    async writeRevision(tx, keys, before, actor, notes) {
        const after = await this.documentOf(tx, keys);
        await this.audit.logDocumentRevision({
            screenName: exports.DCR_SPEC.screenName,
            tableName: exports.DCR_SPEC.tableName,
            docId: keys.id,
            displayName: after.sdrReturnRefno || keys.id,
            before: before === null ? null : dcrAuditRecordOf(before),
            after: dcrAuditRecordOf(after),
            userId: actor,
            branchId: keys.branchId,
            deviceId: after.sdrDeviceId ?? null,
            notes,
        }, tx);
    }
    async challanOf(c, sdcId, sdcAccYear) {
        const row = (await c.saleDc.findFirst({
            where: { sdcId, sdcAccYear: sdcAccYear.trim(), sdcIsDeleted: false },
            select: {
                sdcId: true,
                sdcAccYear: true,
                sdcCompanyId: true,
                sdcBranchId: true,
                sdcDcRefno: true,
                sdcDcDate: true,
                sdcStatus: true,
                sdcPurpose: true,
                sdcCustId: true,
                sdcCustName: true,
                sdcCustGstin: true,
                sdcCustStcd: true,
                sdcPosStcd: true,
                sdcDcAmt: true,
            },
        }));
        return row;
    }
    async buildBody(c, dto) {
        const problems = [];
        const challan = await this.challanOf(c, dto.sdrDcId, dto.sdrDcAccYear);
        if (!challan || !ofReturnScope(challan, dto.sdrCompanyId, dto.sdrBranchId)) {
            problems.push({
                code: posting_types_1.SALES_ERROR_CODES.NOT_FOUND,
                message: `No live challan ${challan?.sdcDcRefno ?? dto.sdrDcId} in this company and branch`,
                field: 'sdrDcId',
            });
        }
        const input = dto.items ?? [];
        const ids = [...new Set(input.map((i) => i.sdriDcItemId).filter((v) => !!v))];
        const dcLines = ids.length
            ? (await c.saleDcItem.findMany({
                where: { sdiId: { in: ids }, sdiIsDeleted: false },
            }))
            : [];
        const byId = new Map(dcLines.map((l) => [l.sdiId, l]));
        const items = [];
        for (const [idx, it] of input.entries()) {
            const lineNo = it.sdriLineNo ?? idx + 1;
            const d = byId.get(it.sdriDcItemId);
            if (!d ||
                !challan ||
                d.sdiDcId !== challan.sdcId ||
                String(d.sdiAccYear).trim() !== challan.sdcAccYear.trim()) {
                problems.push({
                    code: posting_types_1.SALES_ERROR_CODES.DCR_LINE_NOT_ON_DC,
                    message: `Line ${lineNo} is not a line of challan ${challan?.sdcDcRefno ?? dto.sdrDcId}`,
                    field: 'items',
                    line: lineNo,
                    params: { n: lineNo, dc: challan?.sdcDcRefno ?? '' },
                });
                continue;
            }
            items.push(this.lineFrom(it, d, lineNo));
        }
        settleLastReturn(items, byId, await postedReturnSums(c, ids));
        const sum = (k) => items.reduce((a, i) => a.plus((0, dc_common_1.dec)(i[k])), ZERO);
        const { items: _items, charges: _charges, tenders: _tenders, ...header } = dto;
        void _items;
        void _charges;
        void _tenders;
        const body = {
            ...header,
            ...(challan
                ? {
                    sdrDcRefno: challan.sdcDcRefno,
                    sdrDcDate: (0, sales_doc_utils_1.isoDate)(challan.sdcDcDate),
                    sdrCustId: challan.sdcCustId,
                    sdrCustName: challan.sdcCustName,
                    sdrCustGstin: challan.sdcCustGstin,
                    sdrCustStcd: challan.sdcCustStcd,
                    sdrPosStcd: challan.sdcPosStcd,
                }
                : {}),
            sdrTotItems: items.filter((i) => (0, dc_common_1.dec)(i.sdriReturnQty).greaterThan(0)).length,
            sdrTotWeight: sum('sdriWeightQty').toFixed(3),
            sdrGrossAmt: sum('sdriGrossAmt').toFixed(2),
            sdrTaxableAmt: sum('sdriTaxableAmt').toFixed(2),
            sdrTaxAmt: sum('sdriTaxAmt').toFixed(2),
            sdrReturnAmt: sum('sdriNetAmt').toFixed(2),
            sdrTotalCost: items
                .reduce((a, i) => a.plus((0, dc_common_1.dec)(i.sdriReturnQty).times((0, dc_common_1.dec)(i.sdriCostPrice))), ZERO)
                .toFixed(2),
            items,
        };
        return { body, items, challan, problems };
    }
    lineFrom(it, d, lineNo) {
        const qty = (0, dc_common_1.dec)(it.sdriReturnQty);
        const dcQty = (0, dc_common_1.dec)(d.sdiDcQty);
        const share = (k, dp) => dcQty.isZero()
            ? '0'
            : (0, dc_common_1.dec)(d[k])
                .times(qty)
                .dividedBy(dcQty)
                .toDecimalPlaces(dp, client_1.Prisma.Decimal.ROUND_HALF_UP)
                .toFixed(dp);
        const condition = ((it.sdriCondition ?? 'RESTOCK').trim().toUpperCase() ||
            'RESTOCK');
        const taxable = (0, dc_common_1.dec)(share('sdiTaxableAmt', 2));
        const parts = ['sdiCgstAmt', 'sdiSgstAmt', 'sdiIgstAmt', 'sdiCessAmt'].map((k) => (0, dc_common_1.dec)(share(k, 2)));
        const tax = parts.reduce((a, p) => a.plus(p), ZERO);
        const weight = (0, dc_common_1.dec)(d.sdiWeightQty);
        return {
            ...(it.sdriId ? { sdriId: it.sdriId } : {}),
            sdriLineNo: lineNo,
            sdriDcItemId: d.sdiId,
            sdriDcAccYear: String(d.sdiAccYear).trim(),
            sdriDcLineNo: d.sdiLineNo,
            sdriItemId: d.sdiItemId,
            sdriItemUnitId: d.sdiItemUnitId,
            sdriToBaseFactor: d.sdiToBaseFactor,
            sdriHsnCode: d.sdiHsnCode,
            sdriGodownId: (it.sdriGodownId ?? '') || d.sdiGodownId,
            sdriLotId: d.sdiLotId,
            sdriCondition: CONDITIONS.includes(condition) ? condition : 'RESTOCK',
            sdriBucket: exports.BUCKET_BY_CONDITION[condition] ?? 'SALEABLE',
            sdriBatchNo: d.sdiBatchNo,
            sdriExpiryDate: d.sdiExpiryDate,
            sdriSerialNo: d.sdiSerialNo,
            sdriReturnQty: qty.toFixed(3),
            sdriFreeQty: '0',
            sdriNetQty: qty.toFixed(3),
            sdriWeightQty: weight.greaterThan(0) ? share('sdiWeightQty', 3) : null,
            sdriRate: d.sdiRate,
            sdriCostPrice: d.sdiCostPrice,
            sdriTaxId: d.sdiTaxId,
            sdriTaxPerc: d.sdiTaxPerc,
            sdriCgstPerc: d.sdiCgstPerc,
            sdriSgstPerc: d.sdiSgstPerc,
            sdriIgstPerc: d.sdiIgstPerc,
            sdriCessPerc: d.sdiCessPerc,
            sdriCessPerUnit: d.sdiCessPerUnit,
            sdriPriceLevel: d.sdiPriceLevel ?? 1,
            sdriEanCode: d.sdiEanCode,
            sdriIsTaxIncl: d.sdiIsTaxIncl ?? false,
            sdriIsService: d.sdiIsService ?? false,
            sdriRatePreTax: d.sdiRatePreTax,
            sdriMaxPrice: d.sdiMaxPrice,
            sdriItemDiscPerc: d.sdiItemDiscPerc,
            sdriItemDiscAmt: share('sdiItemDiscAmt', 2),
            sdriSchDiscAmt: share('sdiSchDiscAmt', 2),
            sdriGrossAmt: share('sdiGrossAmt', 2),
            sdriTaxableAmt: taxable.toFixed(2),
            sdriCgstAmt: parts[0].toFixed(2),
            sdriSgstAmt: parts[1].toFixed(2),
            sdriIgstAmt: parts[2].toFixed(2),
            sdriCessAmt: parts[3].toFixed(2),
            sdriTaxAmt: tax.toFixed(2),
            sdriNetAmt: taxable.plus(tax).toFixed(2),
            sdriSize: d.sdiSize,
            sdriSizeUom: d.sdiSizeUom,
            sdriRemarks: it.sdriRemarks ?? null,
        };
    }
    async save(dto) {
        (0, dc_common_1.assertNoCharges)(dto.charges);
        const actor = this.salesContext.actor();
        const now = new Date();
        const row = await this.prisma.$transaction(async (tx) => {
            const existing = await this.existingKeys(tx, dto.sdrId);
            await this.assertRight(existing ? 'edit' : 'create', tx);
            const before = existing ? await this.documentOf(tx, existing) : null;
            const { body, challan, problems } = await this.buildBody(tx, dto);
            if (challan &&
                challan.sdcStatus !== 'POSTED' &&
                !problems.some((p) => p.code === posting_types_1.SALES_ERROR_CODES.DCR_DC_NOT_POSTED || p.code === posting_types_1.SALES_ERROR_CODES.NOT_FOUND)) {
                problems.push({
                    code: posting_types_1.SALES_ERROR_CODES.DCR_DC_NOT_POSTED,
                    message: `Challan ${challan.sdcDcRefno} is ${challan.sdcStatus}: only a POSTED challan takes a return`,
                    field: 'sdrDcId',
                });
            }
            if (problems.length > 0) {
                (0, sales_errors_1.throwSalesRefusals)('This return cannot be saved', problems);
            }
            const saved = await this.store.saveDraft(tx, body, actor, now, {
                beforeWrite: (data) => {
                    if (data.sdrReturnDatetime === undefined && !existing) {
                        data.sdrReturnDatetime = now;
                    }
                },
                numberFor: (docDate) => (0, dc_common_1.allocateDcDocNumber)(tx, {
                    vchrTypeId: exports.DCR_SPEC.voucherTypeId,
                    companyId: dto.sdrCompanyId,
                    branchId: dto.sdrBranchId,
                    accYear: dto.sdrAccYear,
                    deviceId: dto.sdrDeviceId,
                    documentDate: docDate,
                    field: 'sdrDeviceId',
                }),
                revision: true,
            });
            await this.writeRevision(tx, this.store.keysOf(saved), before, actor, before ? 'Challan return updated' : 'Challan return created');
            return saved;
        }, TX);
        return this.get(this.store.keysOf(row));
    }
    async validate(dto) {
        const ctx = await this.salesContext.resolve({ companyId: dto.sdrCompanyId, branchId: dto.sdrBranchId, deviceId: dto.sdrDeviceId }, exports.DCR_SPEC.menuId);
        const c = this.prisma;
        const existing = await this.existingKeys(c, dto.sdrId);
        const right = existing ? 'edit' : 'create';
        if (!ctx.rights[right]) {
            (0, sales_errors_1.throwSalesRight)(`This user may not ${right} on this menu`, RIGHT_CODE[right]);
        }
        const g = (0, posting_types_1.createGuardContext)({
            canOverride: ctx.rights.override,
            throwOnRefusal: false,
            dryRun: true,
        });
        if (Array.isArray(dto.charges) && dto.charges.length > 0) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_CHARGES_NOT_ALLOWED, 'A challan return carries no charges', { field: 'charges' });
        }
        const { body, items, problems } = await this.buildBody(c, dto);
        for (const p of problems) {
            (0, sales_guards_1.refuse)(g, p.code, p.message, { field: p.field, line: p.line, params: p.params });
        }
        const row = { ...body, sdrId: dto.sdrId ?? null };
        await this.prisma.$transaction((tx) => this.guards(tx, row, items, ctx, g, false), TX);
        const nameOf = await (0, dc_common_1.dcLineNames)(c, items.map((i) => ({
            itemId: i.sdriItemId,
            itemUnitId: i.sdriItemUnitId,
            godownId: i.sdriGodownId,
            lotId: i.sdriLotId,
        })));
        let qty = ZERO;
        let kg = ZERO;
        let costBack = ZERO;
        for (const i of items) {
            const q = (0, dc_common_1.dec)(i.sdriReturnQty);
            qty = qty.plus(q);
            const w = (0, dc_common_1.dec)(i.sdriWeightQty);
            kg = kg.plus(w.greaterThan(0)
                ? w
                : q.times((0, dc_common_1.dec)(nameOf({
                    itemId: i.sdriItemId,
                    itemUnitId: i.sdriItemUnitId,
                    godownId: i.sdriGodownId,
                    lotId: i.sdriLotId,
                }).unitKg)));
            costBack = costBack.plus(q.times((0, dc_common_1.dec)(i.sdriCostPrice)));
        }
        return {
            ok: g.refusals.length === 0,
            refusals: g.refusals,
            warnings: g.warnings,
            rights: ctx.rights,
            totals: {
                lines: items.filter((i) => (0, dc_common_1.dec)(i.sdriReturnQty).greaterThan(0)).length,
                qty: qty.toFixed(3),
                weightKg: kg.toFixed(3),
                costBack: costBack.toFixed(2),
            },
        };
    }
    async get(keys) {
        const c = this.prisma;
        await this.assertRight('view', c);
        return this.documentOf(c, keys);
    }
    async documentOf(c, keys) {
        const row = await this.store.findOrThrow(c, keys);
        const [items, transport, rights, gdrId, challan] = await Promise.all([
            this.store.loadItems(c, row),
            this.store.loadTransport(c, row),
            this.salesContext.rights(exports.DCR_SPEC.menuId, c),
            this.register.registerIdOf(c, keys.id, keys.accYear),
            this.challanOf(c, row.sdrDcId, row.sdrDcAccYear),
        ]);
        const { posting, locks } = await this.blocks.build({
            status: row.sdrStatus,
            companyId: keys.companyId,
            branchId: keys.branchId,
            accYear: keys.accYear,
            docDate: (0, sales_doc_utils_1.isoDate)(row.sdrReturnDate) ?? (0, sales_doc_utils_1.isoToday)(),
            voucherId: row.sdrPostedVoucherId ?? null,
            registerId: gdrId,
            cogsAmt: (0, sales_doc_utils_1.num)(row.sdrTotalCost),
            amendable: row.sdrStatus === 'DRAFT',
        }, c);
        locks.editable.document = row.sdrStatus === 'DRAFT';
        const nameOf = await (0, dc_common_1.dcLineNames)(c, items.map((i) => ({
            itemId: i.sdriItemId,
            itemUnitId: i.sdriItemUnitId,
            godownId: i.sdriGodownId,
            lotId: i.sdriLotId,
        })));
        const ageing = challan
            ? await (0, dc_common_1.dcAgeing)(this.salesContext, this.statutory, {
                companyId: challan.sdcCompanyId,
                branchId: challan.sdcBranchId,
                purpose: challan.sdcPurpose,
                docDate: (0, sales_doc_utils_1.isoDate)(challan.sdcDcDate) ?? (0, sales_doc_utils_1.isoToday)(),
                status: challan.sdcStatus,
                today: (0, sales_doc_utils_1.isoToday)(),
                open: (await this.challanOpen(c, row)).greaterThan(0),
            })
            : { ageDays: 0, ageLevel: '', returnWindow: null, pastWindow: false };
        return {
            ...this.store.plain(row),
            items: await (0, batch_detail_helper_1.withBatchDetails)(c, row.sdrCompanyId, 'sdri', items.map((i) => ({
                ...this.store.plain(i),
                ...nameOf({
                    itemId: i.sdriItemId,
                    itemUnitId: i.sdriItemUnitId,
                    godownId: i.sdriGodownId,
                    lotId: i.sdriLotId,
                }),
                dcLineNo: i.sdriDcLineNo ?? null,
                bucketFromCondition: exports.BUCKET_BY_CONDITION[i.sdriCondition ?? 'RESTOCK'] ?? null,
            }))),
            charges: [],
            transport,
            posting,
            locks,
            rights: { ...rights, amend: false },
            challan: challan
                ? {
                    sdcId: challan.sdcId,
                    sdcAccYear: challan.sdcAccYear.trim(),
                    refno: challan.sdcDcRefno,
                    date: (0, sales_doc_utils_1.isoDate)(challan.sdcDcDate),
                    purpose: challan.sdcPurpose,
                    ageDays: ageing.ageDays,
                    ageLevel: ageing.ageLevel,
                    returnWindow: ageing.returnWindow,
                    pastWindow: ageing.pastWindow,
                    value: (0, dc_common_1.dec)(challan.sdcDcAmt).toFixed(2),
                }
                : null,
        };
    }
    async delete(dto) {
        const actor = this.salesContext.actor();
        await this.prisma.$transaction(async (tx) => {
            await this.assertRight('delete', tx);
            await this.store.deleteDraft(tx, this.keys(dto), actor, new Date());
        }, TX);
        return { sdrId: dto.sdrId, deleted: true };
    }
    async openLines(q) {
        const c = this.prisma;
        await this.assertRight('view', c);
        const challan = await this.challanOf(c, q.sdcId, q.sdcAccYear);
        if (!challan || challan.sdcCompanyId !== q.companyId || challan.sdcBranchId !== q.branchId) {
            (0, module_service_utils_1.throwSalesNotFound)('Challan not found', 'sdcId', `No live challan ${q.sdcId} in this company and branch`, posting_types_1.SALES_ERROR_CODES.NOT_FOUND);
        }
        const accYear = challan.sdcAccYear.trim();
        const [lines, bills, ageing] = await Promise.all([
            c.$queryRaw `
        SELECT d.sdi_id AS dc_item_id, d.sdi_line_no AS line_no, d.sdi_item_id AS item_id,
               d.sdi_item_unit_id AS item_unit_id, d.sdi_to_base_factor AS to_base_factor,
               d.sdi_godown_id AS godown_id, d.sdi_lot_id AS lot_id, d.sdi_batch_no AS batch_no,
               d.sdi_bucket AS bucket, d.sdi_dc_qty AS dc_qty, d.sdi_billed_qty AS billed_qty,
               d.sdi_returned_qty AS returned_qty, d.sdi_open_qty AS open_qty,
               COALESCE((SELECT SUM(r.sdri_return_qty)
                           FROM sales.sale_dc_return_item r
                           JOIN sales.sale_dc_return rh ON rh.sdr_id = r.sdri_return_id AND rh.sdr_acc_year = r.sdri_acc_year
                          WHERE r.sdri_dc_item_id = d.sdi_id AND r.sdri_is_deleted = false
                            AND rh.sdr_is_deleted = false AND rh.sdr_status = 'DRAFT'), 0) AS on_drafts,
               d.sdi_rate AS rate, d.sdi_cost_price AS cost_price, d.sdi_tax_perc AS tax_perc
          FROM sales.sale_dc_item d
         WHERE d.sdi_dc_id = ${challan.sdcId}::uuid AND d.sdi_acc_year = ${accYear}::char(9)
           AND d.sdi_is_deleted = false
         ORDER BY d.sdi_line_no`,
            c.$queryRaw `
        SELECT h.sb_id, h.sb_acc_year AS acc_year, h.sb_bill_refno AS refno, h.sb_bill_date AS bill_date,
               SUM(b.sbi_bill_qty) AS qty
          FROM sales.sale_bill_item b
          JOIN sales.sale_bill h ON h.sb_id = b.sbi_bill_id AND h.sb_acc_year = b.sbi_acc_year
          JOIN sales.sale_dc_item d ON d.sdi_id = b.sbi_src_item_id
         WHERE b.sbi_src_doc_type = 'DELIVERY_CHALLAN' AND d.sdi_dc_id = ${challan.sdcId}::uuid
           AND b.sbi_is_deleted = false AND h.sb_is_deleted = false AND h.sb_status = 'POSTED'
         GROUP BY h.sb_id, h.sb_acc_year, h.sb_bill_refno, h.sb_bill_date
         ORDER BY h.sb_bill_date, h.sb_bill_refno`,
            (0, dc_common_1.dcAgeing)(this.salesContext, this.statutory, {
                companyId: challan.sdcCompanyId,
                branchId: challan.sdcBranchId,
                purpose: challan.sdcPurpose,
                docDate: (0, sales_doc_utils_1.isoDate)(challan.sdcDcDate) ?? (0, sales_doc_utils_1.isoToday)(),
                status: challan.sdcStatus,
                today: (0, sales_doc_utils_1.isoToday)(),
                open: (await this.challanOpen(c, { sdrDcId: challan.sdcId, sdrDcAccYear: accYear })).greaterThan(0),
            }),
        ]);
        const nameOf = await (0, dc_common_1.dcLineNames)(c, lines.map((l) => ({
            itemId: l.item_id,
            itemUnitId: l.item_unit_id,
            godownId: l.godown_id,
            lotId: l.lot_id,
        })));
        const q3 = (v) => (0, dc_common_1.dec)(v).toFixed(3);
        return {
            challan: {
                sdcId: challan.sdcId,
                sdcAccYear: accYear,
                refno: challan.sdcDcRefno,
                date: (0, sales_doc_utils_1.isoDate)(challan.sdcDcDate),
                status: challan.sdcStatus,
                purpose: challan.sdcPurpose,
                custId: challan.sdcCustId,
                custName: challan.sdcCustName,
                ageDays: ageing.ageDays,
                ageLevel: ageing.ageLevel,
                returnWindow: ageing.returnWindow,
                pastWindow: ageing.pastWindow,
                value: (0, dc_common_1.dec)(challan.sdcDcAmt).toFixed(2),
                bills: bills.map((b) => ({
                    sbId: b.sb_id,
                    accYear: b.acc_year.trim(),
                    refno: b.refno,
                    date: (0, sales_doc_utils_1.isoDate)(b.bill_date),
                    qty: q3(b.qty),
                })),
            },
            lines: lines.map((l) => {
                const n = nameOf({
                    itemId: l.item_id,
                    itemUnitId: l.item_unit_id,
                    godownId: l.godown_id,
                    lotId: l.lot_id,
                });
                return {
                    dcItemId: l.dc_item_id,
                    lineNo: l.line_no,
                    itemId: l.item_id,
                    itemCode: n.itemCode,
                    itemName: n.itemName,
                    itemUnitId: l.item_unit_id,
                    unitName: n.unitName,
                    toBaseFactor: (0, dc_common_1.dec)(l.to_base_factor).toFixed(6),
                    unitKg: n.unitKg,
                    godownId: l.godown_id,
                    godownName: n.godownName,
                    lotId: l.lot_id,
                    lotNo: n.lotNo,
                    batchNo: l.batch_no,
                    bucket: l.bucket,
                    dcQty: q3(l.dc_qty),
                    billedQty: q3(l.billed_qty),
                    returnedQty: q3(l.returned_qty),
                    openQty: q3(l.open_qty),
                    onDrafts: q3(l.on_drafts),
                    rate: (0, dc_common_1.dec)(l.rate).toFixed(4),
                    costPrice: (0, dc_common_1.dec)(l.cost_price).toFixed(4),
                    taxPerc: (0, dc_common_1.dec)(l.tax_perc).toFixed(4),
                };
            }),
        };
    }
    async post(dto) {
        let fire = null;
        let challan = null;
        await this.prisma.$transaction(async (tx) => {
            const row = await this.store.lock(tx, this.keys(dto));
            if (row.sdrStatus === 'POSTED') {
                return;
            }
            if (row.sdrStatus === 'CANCELLED') {
                (0, sales_errors_1.throwSalesLocked)('This DC return is CANCELLED', posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED, 'sdrId');
            }
            const ctx = await this.salesContext.resolve({
                companyId: row.sdrCompanyId,
                branchId: row.sdrBranchId,
                deviceId: row.sdrDeviceId,
            }, exports.DCR_SPEC.menuId, tx);
            if (!ctx.rights.post) {
                (0, sales_errors_1.throwSalesRight)('This user may not post on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_POST);
            }
            const items = await this.store.loadItems(tx, row);
            const g = (0, posting_types_1.createGuardContext)({
                overrides: dto.overrides ?? [],
                canOverride: ctx.rights.override,
                throwOnRefusal: false,
            });
            const soiIds = await this.lockOrdersOf(tx, items);
            const openBefore = await this.lockChallanOpen(tx, row);
            await this.settleAtPost(tx, row, items, ctx.actor);
            await this.guards(tx, row, items, ctx, g, true);
            if (g.refusals.length > 0) {
                (0, sales_errors_1.throwSalesRefusals)('DC return cannot be posted', g.refusals);
            }
            const now = new Date();
            fire = await this.postCore(tx, row, items, ctx, now);
            await this.syncOrders(tx, soiIds, ctx.actor, now, `Reopened: DC return ${row.sdrReturnRefno ?? row.sdrId} posted`);
            challan = {
                sdcId: row.sdrDcId,
                sdcAccYear: String(row.sdrDcAccYear).trim(),
                refno: row.sdrDcRefno ?? null,
                openBefore: openBefore.toFixed(3),
                openAfter: (await this.challanOpen(tx, row)).toFixed(3),
            };
        }, TX);
        if (fire) {
            const f = fire;
            this.gst.enqueueAfterPost({ gdrId: f.gdrId, einvoice: false, ewaybill: f.ewaybill });
        }
        const doc = await this.get(this.keys(dto));
        return challan ? { ...doc, challan: { ...doc.challan, ...challan } } : doc;
    }
    async settleAtPost(tx, row, items, actor) {
        const ids = [...new Set(items.map((i) => i.sdriDcItemId).filter((v) => !!v))];
        if (ids.length === 0) {
            return;
        }
        const dcLines = (await tx.saleDcItem.findMany({
            where: { sdiId: { in: ids }, sdiIsDeleted: false },
        }));
        const changed = settleLastReturn(items, new Map(dcLines.map((l) => [l.sdiId, l])), await postedReturnSums(tx, ids));
        if (changed.length === 0) {
            return;
        }
        const now = new Date();
        for (const idx of changed) {
            const i = items[idx];
            await this.store.updateItem(tx, i, Object.fromEntries([...SETTLED_FIGURES, 'sdriTaxAmt', 'sdriNetAmt'].filter((k) => i[k] !== undefined).map((k) => [k, i[k]])));
        }
        const sum = (k) => items.reduce((a, i) => a.plus((0, dc_common_1.dec)(i[k])), ZERO);
        const totals = {
            sdrTotWeight: sum('sdriWeightQty').toFixed(3),
            sdrGrossAmt: sum('sdriGrossAmt').toFixed(2),
            sdrTaxableAmt: sum('sdriTaxableAmt').toFixed(2),
            sdrTaxAmt: sum('sdriTaxAmt').toFixed(2),
            sdrReturnAmt: sum('sdriNetAmt').toFixed(2),
        };
        await this.store.setStatus(tx, row, row.sdrStatus ?? 'DRAFT', totals, actor, now);
        Object.assign(row, totals);
    }
    async lockChallanOpen(tx, row) {
        await tx.$queryRaw `
      SELECT sdc_id FROM sales.sale_dc
       WHERE sdc_id = ${row.sdrDcId}::uuid AND sdc_acc_year = ${String(row.sdrDcAccYear).trim()}::char(9)
       FOR UPDATE`;
        const rows = await tx.$queryRaw `
      SELECT sdi_open_qty AS open_qty FROM sales.sale_dc_item
       WHERE sdi_dc_id = ${row.sdrDcId}::uuid AND sdi_acc_year = ${String(row.sdrDcAccYear).trim()}::char(9)
         AND sdi_is_deleted = false
       ORDER BY sdi_id
       FOR UPDATE`;
        return rows.reduce((a, r) => a.plus((0, dc_common_1.dec)(r.open_qty)), ZERO);
    }
    async challanOpen(tx, row) {
        const [r] = await tx.$queryRaw `
      SELECT SUM(sdi_open_qty) AS open_qty FROM sales.sale_dc_item
       WHERE sdi_dc_id = ${row.sdrDcId}::uuid AND sdi_acc_year = ${String(row.sdrDcAccYear).trim()}::char(9)
         AND sdi_is_deleted = false`;
        return (0, dc_common_1.dec)(r?.open_qty);
    }
    async guards(tx, row, items, ctx, g, stored) {
        const companyId = row.sdrCompanyId;
        const branchId = row.sdrBranchId;
        const accYear = row.sdrAccYear;
        const docDate = (0, sales_doc_utils_1.isoDate)(row.sdrReturnDate) ?? (0, sales_doc_utils_1.isoToday)();
        await (0, sales_guards_1.assertAccYearWritable)(tx, companyId, accYear, 'sdrAccYear');
        await (0, sales_guards_1.assertVoucherPartitionExists)(tx, accYear, 'sdrAccYear');
        if (docDate > (0, sales_doc_utils_1.isoToday)()) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.BACKDATE, `A return cannot be dated ${docDate}, in the future`, {
                field: 'sdrReturnDate',
            });
        }
        else if (docDate !== (0, sales_doc_utils_1.isoToday)() && ctx.settings.backdateMode !== 'ALLOW') {
            (ctx.settings.backdateMode === 'REFUSE' ? sales_guards_1.refuse : sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.BACKDATE, `This return is dated ${docDate}, before today`, { field: 'sdrReturnDate' });
        }
        if (await (0, sales_guards_1.loadDayClosed)(tx, companyId, branchId, docDate)) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DAY_CLOSED, `The books for ${docDate} are closed at this branch`, { field: 'sdrReturnDate' });
        }
        const challan = row.sdrDcId
            ? await this.challanOf(tx, row.sdrDcId, String(row.sdrDcAccYear))
            : null;
        if (challan && !ofReturnScope(challan, companyId, branchId)) {
            if (stored) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.NOT_FOUND, `No live challan ${challan.sdcDcRefno} in this company and branch`, { field: 'sdrDcId' });
            }
        }
        else if (challan && challan.sdcStatus !== 'POSTED') {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DCR_DC_NOT_POSTED, 'The challan this return is against is not POSTED', { field: 'sdrDcId' });
        }
        const taking = items.filter((i) => (0, dc_common_1.dec)(i.sdriReturnQty).greaterThan(0));
        if (taking.length === 0 &&
            !g.refusals.some((r) => r.code === posting_types_1.SALES_ERROR_CODES.DCR_LINE_NOT_ON_DC)) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DCR_NO_LINES, 'No line has a quantity to take back', {
                field: 'items',
            });
        }
        await this.guardReason(tx, row, g);
        const ids = [...new Set(taking.map((i) => i.sdriDcItemId))];
        const dcLines = ids.length
            ? await tx.$queryRaw `
          SELECT sdi_id, sdi_dc_id, sdi_acc_year, sdi_line_no, sdi_open_qty, sdi_to_base_factor
            FROM sales.sale_dc_item
           WHERE sdi_id = ANY(${ids}::uuid[]) AND sdi_is_deleted = false`
            : [];
        const byId = new Map(dcLines.map((l) => [l.sdi_id, l]));
        const takenBase = new Map();
        for (const i of taking) {
            const k = i.sdriDcItemId;
            const d = byId.get(k);
            const lineNo = i.sdriLineNo;
            if (stored &&
                (!d || d.sdi_dc_id !== row.sdrDcId || d.sdi_acc_year.trim() !== String(row.sdrDcAccYear).trim())) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DCR_LINE_NOT_ON_DC, `Line ${lineNo} is not a line of challan ${row.sdrDcRefno ?? ''}`, { field: 'items', line: lineNo, params: { n: lineNo, dc: row.sdrDcRefno ?? '' } });
                continue;
            }
            if (!d) {
                continue;
            }
            takenBase.set(k, (takenBase.get(k) ?? ZERO).plus((0, dc_common_1.dec)(i.sdriReturnQty).times(factorOf(i.sdriToBaseFactor))));
        }
        for (const [k, base] of takenBase) {
            const d = byId.get(k);
            const openBase = (0, dc_common_1.dec)(d.sdi_open_qty).times(factorOf(d.sdi_to_base_factor));
            if (base.greaterThan(openBase)) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DCR_OVER_OPEN, `Challan line ${d.sdi_line_no} has ${(0, dc_common_1.dec)(d.sdi_open_qty).toString()} open; this return takes ${base.dividedBy(factorOf(d.sdi_to_base_factor)).toString()}`, { field: 'items', line: d.sdi_line_no });
            }
        }
        const nameOf = await (0, dc_common_1.dcLineNames)(tx, taking.map((i) => ({
            itemId: i.sdriItemId,
            itemUnitId: i.sdriItemUnitId,
            godownId: i.sdriGodownId,
            lotId: i.sdriLotId,
        })));
        for (const i of taking) {
            const condition = (i.sdriCondition ?? 'RESTOCK').toUpperCase();
            if (condition === 'RESTOCK') {
                continue;
            }
            const unit = nameOf({
                itemId: i.sdriItemId,
                itemUnitId: i.sdriItemUnitId,
                godownId: i.sdriGodownId,
                lotId: i.sdriLotId,
            }).unitName ?? '';
            const qty = (0, dc_common_1.dec)(i.sdriReturnQty).toString();
            (0, sales_guards_1.info)(g, posting_types_1.SALES_ERROR_CODES.DCR_DAMAGED_BUCKET, `${qty} ${unit} come back ${condition}: into ${exports.BUCKET_BY_CONDITION[condition] ?? 'SALEABLE'}, not for sale`, { field: 'items', line: i.sdriLineNo, params: { qty, unit, condition } });
        }
    }
    async guardReason(tx, row, g) {
        const reasonId = row.sdrReasonId ?? null;
        if (!reasonId) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DCR_REASON_REQUIRED, 'Say why the goods came back', {
                field: 'sdrReasonId',
            });
            return;
        }
        const [r] = await tx.$queryRaw `
      SELECT srm_require_remarks AS remarks FROM stock.stock_reason_master
       WHERE srm_id = ${reasonId}::uuid AND srm_is_deleted = false
         AND 'DC_RETURN' = ANY(srm_allowed_txn_types)
         AND (srm_company_id IS NULL OR srm_company_id = ${row.sdrCompanyId}::uuid)`;
        if (!r) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DCR_REASON_REQUIRED, 'That is not a challan-return reason', {
                field: 'sdrReasonId',
            });
        }
        else if (r.remarks === true && !(row.sdrReturnReason ?? '').trim()) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DCR_REASON_REQUIRED, 'This reason needs a remark', {
                field: 'sdrReturnReason',
            });
        }
    }
    async postCore(tx, row, items, ctx, now) {
        const keys = this.store.keysOf(row);
        const actor = ctx.actor;
        const refno = row.sdrReturnRefno ?? keys.id;
        const docDate = (0, sales_doc_utils_1.isoDate)(row.sdrReturnDate) ?? (0, sales_doc_utils_1.isoToday)();
        const moving = items.filter((i) => !i.sdriIsService &&
            (0, dc_common_1.dec)(i.sdriReturnQty).plus((0, dc_common_1.dec)(i.sdriFreeQty)).greaterThan(0));
        const stock = await this.stock.post(tx, {
            docType: 'DC_RETURN',
            docId: keys.id,
            accYear: keys.accYear,
            companyId: keys.companyId,
            branchId: keys.branchId,
            tenantId: row.sdrTenantId,
            deviceId: row.sdrDeviceId,
            sessionId: row.sdrSessionId,
            docDate,
            docDatetime: row.sdrReturnDatetime ?? now,
            refno,
            revision: 1,
            partyId: row.sdrCustId,
            direction: 'IN',
            txnType: 'DC_RETURN',
            lines: moving.map((i) => ({
                lineId: i.sdriId,
                lineNo: i.sdriLineNo,
                itemId: i.sdriItemId,
                itemUnitId: i.sdriItemUnitId,
                godownId: i.sdriGodownId,
                lotId: i.sdriLotId,
                bucket: exports.BUCKET_BY_CONDITION[i.sdriCondition ?? 'RESTOCK'] ??
                    i.sdriBucket ??
                    'SALEABLE',
                qty: (0, sales_doc_utils_1.num)(i.sdriReturnQty),
                freeQty: (0, sales_doc_utils_1.num)(i.sdriFreeQty),
                weightQty: i.sdriWeightQty === null ? null : (0, sales_doc_utils_1.num)(i.sdriWeightQty),
                toBaseFactor: (0, sales_doc_utils_1.num)(i.sdriToBaseFactor) || null,
                batchNo: i.sdriBatchNo,
                expiryDate: (0, sales_doc_utils_1.isoDate)(i.sdriExpiryDate),
                serialNo: i.sdriSerialNo,
                mrp: i.sdriMaxPrice === null ? null : (0, sales_doc_utils_1.num)(i.sdriMaxPrice),
                rate: (0, sales_doc_utils_1.num)(i.sdriRate),
                costRate: costPerBaseOf(i),
                taxPerc: (0, sales_doc_utils_1.num)(i.sdriTaxPerc),
            })),
        }, actor, now);
        for (const i of moving) {
            await this.store.updateItem(tx, i, {
                sdriLotId: stock.lotByLine.get(i.sdriId) ?? i.sdriLotId ?? null,
            });
        }
        let voucherId = null;
        const cogs = ctx.cogsMode === 'PERPETUAL' ? stock.cogsTotal : 0;
        if (cogs > 0 && row.sdrCustId) {
            const v = await this.legs.postLegs(tx, {
                header: {
                    companyId: keys.companyId,
                    branchId: keys.branchId,
                    tenantId: row.sdrTenantId,
                    accYear: keys.accYear,
                    voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.DC_RETURN,
                    voucherDate: docDate,
                    srcModule: 'SALES',
                    srcDocType: 'DC_RETURN',
                    srcDocId: keys.id,
                    docRefno: refno,
                    docDate,
                    usrRefno: row.sdrUsrRefno,
                    docAmount: (0, sales_doc_utils_1.num)(row.sdrReturnAmt),
                    partyId: row.sdrCustId,
                    userId: isUuid(row.sdrUserId) ? row.sdrUserId : actor,
                    sessionId: row.sdrSessionId,
                    deviceType: row.sdrDeviceType,
                    remarks: row.sdrRemarks,
                    createdBy: actor,
                    presetRefno: row.sdrReturnRefno,
                },
                legs: (0, sales_leg_sources_1.buildCogsLegs)(cogs, 'RETURN'),
            });
            voucherId = v.voucherId;
        }
        const [company] = await tx.$queryRaw `SELECT comp_state_code FROM public.companys WHERE comp_id = ${keys.companyId}::uuid`;
        const nature = (0, sales_doc_utils_1.supplyNatureOf)(company?.comp_state_code, row.sdrPosStcd);
        let gdrId = null;
        let ewaybill = false;
        if (row.sdrCustId) {
            const registerNo = await (0, dc_common_1.nextRegisterVoucherNo)(tx, {
                companyId: keys.companyId,
                branchId: keys.branchId,
                accYear: keys.accYear,
                voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.DC_RETURN,
            });
            const reg = await this.register.write(tx, this.registerDoc(row, items, voucherId, registerNo, nature, actor), {
                interState: nature === 'INTER',
                ewayStateCode: (0, dc_common_1.dcEwayStateOf)(company?.comp_state_code, row.sdrPosStcd)
                    .stateCode,
            });
            gdrId = reg.gdrId;
            ewaybill = reg.ewaybillApplicable;
        }
        await this.store.setStatus(tx, row, 'POSTED', {
            sdrPostedVoucherId: voucherId,
            sdrTotalCost: new client_1.Prisma.Decimal(stock.cogsTotal.toFixed(2)),
        }, actor, now);
        await this.fulfilment.recompute(tx, [{ dcId: row.sdrDcId, accYear: row.sdrDcAccYear.trim() }], actor, now);
        await this.store.trail(tx, row, txn_status_log_helper_1.TxnStatusEvent.POSTED, 'DRAFT', 'POSTED', actor, now, null);
        await this.store.auditChange(tx, row, 'approve', { sdrStatus: 'DRAFT' }, { sdrStatus: 'POSTED', sdrPostedVoucherId: voucherId, gdrId, cogs }, actor, 'DC return posted');
        return { gdrId, ewaybill };
    }
    registerDoc(row, items, voucherId, voucherNo, nature, actor) {
        const d = (k) => (0, sales_doc_utils_1.num)(row[k]);
        const sumOf = (k) => (0, sales_doc_utils_1.num)(items.reduce((a, i) => a.plus((0, dc_common_1.dec)(i[k])), (0, dc_common_1.dec)(0)));
        const lines = items.map((i) => {
            const n = (k) => (0, sales_doc_utils_1.num)(i[k]);
            const tax = n('sdriCgstAmt') + n('sdriSgstAmt') + n('sdriIgstAmt') + n('sdriCessAmt');
            const gst = {
                totalTaxRate: n('sdriTaxPerc'),
                cgstRate: n('sdriCgstPerc'),
                sgstRate: n('sdriSgstPerc'),
                igstRate: n('sdriIgstPerc'),
                cessRate: n('sdriCessPerc'),
                cgstAmount: n('sdriCgstAmt'),
                sgstAmount: n('sdriSgstAmt'),
                igstAmount: n('sdriIgstAmt'),
                cessAmount: n('sdriCessAmt'),
            };
            return {
                rowNo: i.sdriLineNo,
                itemId: i.sdriItemId,
                hsnCode: i.sdriHsnCode,
                unitId: i.sdriItemUnitId,
                qty: n('sdriReturnQty'),
                rate: n('sdriRate'),
                discount: n('sdriItemDiscAmt'),
                isService: i.sdriIsService ?? false,
                taxableValue: n('sdriTaxableAmt'),
                taxId: i.sdriTaxId,
                ...gst,
                otherAmount: 0,
                totalValue: (0, sales_doc_utils_1.round2)(n('sdriTaxableAmt') + tax),
                billValue: n('sdriNetAmt') || (0, sales_doc_utils_1.round2)(n('sdriTaxableAmt') + tax),
                taxability: (0, dc_common_1.registerLineTaxability)(gst),
                supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
            };
        });
        return {
            companyId: row.sdrCompanyId,
            branchId: row.sdrBranchId,
            accYear: row.sdrAccYear,
            voucherId: voucherId ?? row.sdrId,
            voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.DC_RETURN,
            voucherNo: voucherNo ?? (0, sales_doc_utils_1.numericTail)(row.sdrReturnRefno, BigInt(0)),
            voucherDate: (0, sales_doc_utils_1.isoDate)(row.sdrReturnDate),
            voucherRefno: row.sdrReturnRefno,
            sourceDocId: row.sdrId,
            docType: 'CHALLAN',
            tranNature: 'DELIVERY_CHALLAN',
            docFlow: 'INWARD',
            docSign: -1,
            docNo: row.sdrReturnRefno,
            docDate: (0, sales_doc_utils_1.isoDate)(row.sdrReturnDate),
            docRefNo: row.sdrDcRefno,
            taxability: (0, dc_common_1.registerDocTaxability)(lines),
            supplyClass: 'GOODS',
            supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
            placeOfSupplyCode: row.sdrPosStcd,
            partyId: row.sdrCustId,
            partyName: row.sdrCustName,
            partyStateCode: row.sdrCustStcd,
            partyGstin: (row.sdrCustGstin ?? '').trim() || null,
            grossValue: d('sdrGrossAmt'),
            discountValue: 0,
            taxableValue: d('sdrTaxableAmt'),
            cgstValue: sumOf('sdriCgstAmt'),
            sgstValue: sumOf('sdriSgstAmt'),
            igstValue: sumOf('sdriIgstAmt'),
            cessValue: sumOf('sdriCessAmt'),
            stateCessValue: 0,
            tcsValue: 0,
            otherCharge: 0,
            roundOff: 0,
            billValue: d('sdrReturnAmt'),
            remarks: row.sdrReturnReason,
            createdBy: actor,
            lines,
        };
    }
    async cancel(dto) {
        const now = new Date();
        const out = await this.prisma.$transaction(async (tx) => {
            const row = await this.store.lock(tx, this.keys(dto));
            if (row.sdrStatus === 'CANCELLED') {
                return { reversalVoucherRefno: null, cancelledOn: null, challan: null };
            }
            if (row.sdrStatus !== 'POSTED') {
                (0, sales_errors_1.throwSalesLocked)('Only a POSTED DC return can be cancelled — a DRAFT is deleted', posting_types_1.SALES_ERROR_CODES.DOC_NOT_DRAFT, 'sdrId');
            }
            const ctx = await this.salesContext.resolve({ companyId: row.sdrCompanyId, branchId: row.sdrBranchId }, exports.DCR_SPEC.menuId, tx);
            if (!ctx.rights.cancel) {
                (0, sales_errors_1.throwSalesRight)('This user may not cancel on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_CANCEL);
            }
            const keys = this.store.keysOf(row);
            const docDate = (0, sales_doc_utils_1.isoDate)(row.sdrReturnDate) ?? (0, sales_doc_utils_1.isoToday)();
            await (0, sales_guards_1.assertAccYearWritable)(tx, keys.companyId, keys.accYear, 'sdrAccYear');
            if (await (0, sales_guards_1.loadDayClosed)(tx, keys.companyId, keys.branchId, docDate)) {
                (0, sales_errors_1.throwSalesLocked)(`The books for ${docDate} are closed at this branch`, posting_types_1.SALES_ERROR_CODES.DAY_CLOSED, 'sdrReturnDate');
            }
            const soiIds = await this.lockOrdersOf(tx, await this.store.loadItems(tx, row));
            const openBefore = await this.lockChallanOpen(tx, row);
            const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
            const { ewbLive } = await (0, sales_guards_1.loadDeclaredLocks)(tx, gdrId);
            if (ewbLive) {
                const gst = await this.blocks.gstRows(tx, gdrId, keys.accYear);
                const w = gst.ewbGeneratedOn
                    ? await this.statutory.withinCancelWindow(keys.companyId, 'EWAYBILL', gst.ewbGeneratedOn, docDate, new Date(), tx)
                    : { within: false };
                if (!w.within) {
                    (0, sales_errors_1.throwSalesLocked)("The e-way bill's cancellation window has passed — cancel it at the portal first", posting_types_1.SALES_ERROR_CODES.EWB_WINDOW_PASSED, 'posting.ewb');
                }
                await this.gst.cancelEwb({
                    gdrId: gdrId,
                    accYear: keys.accYear,
                    companyId: keys.companyId,
                    reason: dto.reason,
                });
            }
            let reversal = null;
            if (row.sdrPostedVoucherId) {
                const r = await this.legs.reverseLegs(tx, row.sdrPostedVoucherId, keys.accYear, dto.reason, ctx.actor);
                if (r) {
                    const [v] = await tx.$queryRaw `SELECT avh_voucher_refno FROM accounts.acc_voucher_header WHERE avh_voucher_id = ${r.voucherId}::uuid AND avh_acc_year = ${keys.accYear}::char(9)`;
                    reversal = v?.avh_voucher_refno ?? null;
                }
            }
            await this.stock.cancel(tx, {
                docType: 'DC_RETURN',
                docId: keys.id,
                accYear: keys.accYear,
                companyId: keys.companyId,
                branchId: keys.branchId,
                direction: 'IN',
                txnType: 'DC_RETURN',
            }, ctx.actor, dto.reason, now);
            if (gdrId) {
                await this.register.cancel(tx, gdrId, keys.accYear, dto.reason, ctx.actor);
            }
            await this.store.setStatus(tx, row, 'CANCELLED', {}, ctx.actor, now);
            await this.fulfilment.recompute(tx, [{ dcId: row.sdrDcId, accYear: row.sdrDcAccYear.trim() }], ctx.actor, now);
            await this.syncOrders(tx, soiIds, ctx.actor, now, `Reopened: DC return ${row.sdrReturnRefno ?? row.sdrId} cancelled`);
            await this.store.trail(tx, row, txn_status_log_helper_1.TxnStatusEvent.CANCELLED, 'POSTED', 'CANCELLED', ctx.actor, now, dto.reason);
            await this.store.auditChange(tx, row, 'cancel', { sdrStatus: 'POSTED' }, { sdrStatus: 'CANCELLED' }, ctx.actor, `DC return cancelled: ${dto.reason}`);
            return {
                reversalVoucherRefno: reversal,
                cancelledOn: now.toISOString(),
                challan: {
                    sdcId: row.sdrDcId,
                    sdcAccYear: String(row.sdrDcAccYear).trim(),
                    refno: row.sdrDcRefno ?? null,
                    openBefore: openBefore.toFixed(3),
                    openAfter: (await this.challanOpen(tx, row)).toFixed(3),
                },
            };
        }, TX);
        const doc = await this.get(this.keys(dto));
        return {
            ...doc,
            reversalVoucherRefno: out.reversalVoucherRefno,
            cancelledOn: out.cancelledOn,
            ...(out.challan ? { challan: { ...doc.challan, ...out.challan } } : {}),
        };
    }
    async transport(dto) {
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            await this.assertRight('edit', tx);
            const row = await this.store.lock(tx, this.keys(dto));
            if (row.sdrStatus === 'CANCELLED') {
                (0, sales_errors_1.throwSalesLocked)('This DC return is CANCELLED', posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED, 'sdrId');
            }
            const actor = this.salesContext.actor();
            const gdrId = await this.register.registerIdOf(tx, row.sdrId, row.sdrAccYear);
            await this.transportBand.write(tx, {
                docType: 'DC_RETURN',
                docId: row.sdrId,
                accYear: row.sdrAccYear,
                companyId: row.sdrCompanyId,
                branchId: row.sdrBranchId,
                tenantId: row.sdrTenantId,
                docRefno: row.sdrReturnRefno,
            }, { ...dto.transport, direction: 'INWARD' }, actor, { gdrId, now });
            await this.store.trail(tx, row, 'TRANSPORT_EDITED', row.sdrStatus, row.sdrStatus, actor, now, null);
        }, TX);
        return this.get(this.keys(dto));
    }
};
exports.DcReturnService = DcReturnService;
exports.DcReturnService = DcReturnService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sales_context_service_1.SalesContextService,
        statutory_service_1.StatutoryService,
        voucher_posting_service_1.VoucherPostingService,
        doc_register_service_1.DocRegisterService,
        sales_stock_service_1.SalesStockService,
        sales_doc_blocks_service_1.SalesDocBlocksService,
        transport_band_service_1.TransportBandService,
        dc_fulfilment_service_1.DcFulfilmentService,
        gst_gateway_service_1.GstGatewayService,
        audit_log_service_1.AuditLogService,
        charge_detail_service_1.ChargeDetailService,
        tender_detail_service_1.TenderDetailService,
        sale_order_service_1.SaleOrderService,
        stock_reservation_service_1.StockReservationService])
], DcReturnService);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) {
    return !!v && UUID.test(v);
}
function costPerBaseOf(i) {
    const cost = (0, dc_common_1.dec)(i.sdriCostPrice);
    if (!cost.greaterThan(0)) {
        return null;
    }
    return cost
        .dividedBy(factorOf(i.sdriToBaseFactor))
        .toDecimalPlaces(6, client_1.Prisma.Decimal.ROUND_HALF_UP)
        .toNumber();
}
function dcrAuditRecordOf(doc) {
    const { locks: _locks, rights: _rights, challan: _challan, ...record } = doc;
    void _locks;
    void _rights;
    void _challan;
    const items = Array.isArray(record.items) ? record.items : [];
    return {
        ...record,
        items: items.map((i) => {
            const { itemName: _i, itemCode: _c, unitName: _u, godownName: _g, lotNo: _n, unitKg: _k, bucketFromCondition: _b, ...line } = i;
            void _i;
            void _c;
            void _u;
            void _g;
            void _n;
            void _k;
            void _b;
            return line;
        }),
    };
}
//# sourceMappingURL=dc-return.service.js.map