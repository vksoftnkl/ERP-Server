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
exports.DcReturnService = exports.DCR_SPEC = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const charge_detail_service_1 = require("../../master/charge-detail/charge-detail.service");
const tender_detail_service_1 = require("../../accountsModule/tenderDetail/tender-detail.service");
const tender_detail_api_types_1 = require("../../accountsModule/tenderDetail/types/tender-detail-api.types");
const dc_fulfilment_service_1 = require("../posting/dc-fulfilment.service");
const doc_register_service_1 = require("../posting/doc-register.service");
const gst_gateway_service_1 = require("../posting/gst-gateway.service");
const sales_context_service_1 = require("../posting/sales-context.service");
const sales_doc_blocks_service_1 = require("../posting/sales-doc-blocks.service");
const sales_doc_store_1 = require("../posting/sales-doc-store");
const sales_leg_sources_1 = require("../posting/sales-leg.sources");
const sales_posting_service_1 = require("../posting/sales-posting.service");
const sales_stock_service_1 = require("../posting/sales-stock.service");
const statutory_service_1 = require("../posting/statutory.service");
const transport_band_service_1 = require("../posting/transport-band.service");
const sales_guards_1 = require("../posting/sales.guards");
const sales_errors_1 = require("../posting/sales.errors");
const posting_types_1 = require("../posting/types/posting.types");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
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
    statusDocType: txn_status_log_helper_1.TxnStatusDocType.OTHER,
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
const BUCKET_BY_CONDITION = {
    RESTOCK: 'SALEABLE',
    DAMAGED: 'DAMAGED',
    EXPIRED: 'EXPIRED',
    SCRAP: 'QUARANTINE',
};
const TX = { timeout: 60_000, maxWait: 10_000 };
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
    store;
    constructor(prisma, salesContext, statutory, legs, register, stock, blocks, transportBand, fulfilment, gst, audit, charges, tenders) {
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
        this.store = new sales_doc_store_1.SalesDocStore(exports.DCR_SPEC, audit, charges, tenders, transportBand);
    }
    keys(dto) {
        return {
            id: dto.sdrId,
            companyId: dto.sdrCompanyId,
            branchId: dto.sdrBranchId,
            accYear: dto.sdrAccYear,
        };
    }
    async save(dto) {
        const actor = this.salesContext.actor();
        const now = new Date();
        const row = await this.prisma.$transaction(async (tx) => {
            const [dc] = await tx.$queryRaw `
        SELECT sdc_dc_refno, sdc_dc_date, sdc_cust_id, sdc_cust_name, sdc_cust_gstin, sdc_cust_stcd, sdc_pos_stcd, sdc_status
          FROM sales.sale_dc WHERE sdc_id = ${dto.sdrDcId}::uuid AND sdc_acc_year = ${dto.sdrDcAccYear}::char(9) AND sdc_is_deleted = false`;
            if (!dc) {
                (0, sales_errors_1.throwSalesLocked)('The challan this return is against does not exist', posting_types_1.SALES_ERROR_CODES.DCR_DC_NOT_POSTED, 'sdrDcId');
            }
            const body = {
                ...dto,
                sdrDcRefno: dc.sdc_dc_refno,
                sdrDcDate: (0, sales_doc_utils_1.isoDate)(dc.sdc_dc_date),
                sdrCustId: dto.sdrCustId ?? dc.sdc_cust_id,
                sdrCustName: dto.sdrCustName ?? dc.sdc_cust_name,
                sdrCustGstin: dto.sdrCustGstin ?? dc.sdc_cust_gstin,
                sdrCustStcd: dto.sdrCustStcd ?? dc.sdc_cust_stcd,
                sdrPosStcd: dto.sdrPosStcd ?? dc.sdc_pos_stcd,
            };
            return this.store.saveDraft(tx, body, actor, now, {
                beforeWrite: (data) => {
                    if (data.sdrReturnDatetime === undefined) {
                        data.sdrReturnDatetime = now;
                    }
                },
            });
        }, TX);
        return this.get(this.store.keysOf(row));
    }
    async get(keys) {
        const c = this.prisma;
        const row = await this.store.findOrThrow(c, keys);
        const [items, transport, rights, gdrId] = await Promise.all([
            this.store.loadItems(c, row),
            this.store.loadTransport(c, row),
            this.salesContext.rights(exports.DCR_SPEC.menuId, c),
            this.register.registerIdOf(c, keys.id, keys.accYear),
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
        return {
            ...this.store.plain(row),
            items: items.map((i) => this.store.plain(i)),
            transport,
            posting,
            locks,
            rights: { ...rights, amend: false },
        };
    }
    async delete(dto) {
        const actor = this.salesContext.actor();
        await this.prisma.$transaction((tx) => this.store.deleteDraft(tx, this.keys(dto), actor, new Date()), TX);
        return { sdrId: dto.sdrId, deleted: true };
    }
    async openLines(sdcId, sdcAccYear) {
        const rows = await this.prisma.$queryRaw `
      SELECT d.sdi_id AS "dcItemId", d.sdi_line_no AS "lineNo", im.item_name_en AS "itemName", u.unit_name AS "unitName",
             d.sdi_item_id AS "itemId", d.sdi_item_unit_id AS "itemUnitId",
             d.sdi_dc_qty AS "dcQty", d.sdi_billed_qty AS "billedQty", d.sdi_returned_qty AS "returnedQty", d.sdi_open_qty AS "openQty",
             d.sdi_lot_id AS "lotId", d.sdi_batch_no AS "batchNo", d.sdi_godown_id AS "godownId", d.sdi_rate AS "rate",
             d.sdi_tax_perc AS "taxPerc", d.sdi_tax_id AS "taxId", d.sdi_hsn_code AS "hsnCode", d.sdi_cost_price AS "costPrice"
        FROM sales.sale_dc_item d
        JOIN inventory.item_master im ON im.item_id = d.sdi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = d.sdi_item_unit_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
       WHERE d.sdi_dc_id = ${sdcId}::uuid AND d.sdi_acc_year = ${sdcAccYear}::char(9) AND d.sdi_is_deleted = false
       ORDER BY d.sdi_line_no`;
        return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [
            k,
            v instanceof client_1.Prisma.Decimal ? Number(v.toString()) : v,
        ])));
    }
    async post(dto) {
        let fire = null;
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
            const g = (0, posting_types_1.createGuardContext)({ canOverride: ctx.rights.override, throwOnRefusal: false });
            await this.guards(tx, row, items, ctx, g);
            if (g.refusals.length > 0) {
                (0, sales_errors_1.throwSalesRefusals)('DC return cannot be posted', g.refusals);
            }
            fire = await this.postCore(tx, row, items, ctx, new Date());
        }, TX);
        if (fire) {
            const f = fire;
            this.gst.enqueueAfterPost({ gdrId: f.gdrId, einvoice: false, ewaybill: f.ewaybill });
        }
        return this.get(this.keys(dto));
    }
    async guards(tx, row, items, ctx, g) {
        const keys = this.store.keysOf(row);
        const docDate = (0, sales_doc_utils_1.isoDate)(row.sdrReturnDate) ?? (0, sales_doc_utils_1.isoToday)();
        await (0, sales_guards_1.assertAccYearWritable)(tx, keys.companyId, keys.accYear, 'sdrAccYear');
        await (0, sales_guards_1.assertVoucherPartitionExists)(tx, keys.accYear, 'sdrAccYear');
        if (docDate > (0, sales_doc_utils_1.isoToday)()) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.BACKDATE, `A return cannot be dated ${docDate}, in the future`, {
                field: 'sdrReturnDate',
            });
        }
        if (await (0, sales_guards_1.loadDayClosed)(tx, keys.companyId, keys.branchId, docDate)) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DAY_CLOSED, `The books for ${docDate} are closed at this branch`, { field: 'sdrReturnDate' });
        }
        const [dc] = await tx.$queryRaw `
      SELECT sdc_status FROM sales.sale_dc WHERE sdc_id = ${row.sdrDcId}::uuid AND sdc_acc_year = ${row.sdrDcAccYear}::char(9) AND sdc_is_deleted = false`;
        if (!dc || dc.sdc_status !== 'POSTED') {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DCR_DC_NOT_POSTED, 'The challan this return is against is not POSTED', { field: 'sdrDcId' });
        }
        if (items.length === 0) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.STOCK_QTY_MISMATCH, 'A return with no lines cannot be posted', {
                field: 'items',
            });
        }
        const dcLines = await tx.$queryRaw `
      SELECT sdi_id, sdi_open_qty FROM sales.sale_dc_item WHERE sdi_id = ANY(${items.map((i) => i.sdriDcItemId)}::uuid[])`;
        const open = new Map(dcLines.map((l) => [l.sdi_id, (0, sales_doc_utils_1.num)(l.sdi_open_qty)]));
        const taken = new Map();
        for (const i of items) {
            const k = i.sdriDcItemId;
            taken.set(k, (taken.get(k) ?? 0) +
                (0, sales_doc_utils_1.num)(i.sdriReturnQty) +
                (0, sales_doc_utils_1.num)(i.sdriFreeQty));
        }
        for (const [k, qty] of taken) {
            const o = open.get(k);
            if (o === undefined) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DCR_OVER_OPEN, `Challan line ${k} does not exist`, {
                    field: 'items',
                });
            }
            else if (qty > o + 0.0005) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DCR_OVER_OPEN, `Challan line has ${o} open; this return takes ${qty}`, { field: 'items' });
            }
        }
        void ctx;
    }
    async postCore(tx, row, items, ctx, now) {
        const keys = this.store.keysOf(row);
        const actor = ctx.actor;
        const refno = row.sdrReturnRefno ?? keys.id;
        const docDate = (0, sales_doc_utils_1.isoDate)(row.sdrReturnDate) ?? (0, sales_doc_utils_1.isoToday)();
        const moving = items.filter((i) => !i.sdriIsService &&
            (0, sales_doc_utils_1.num)(i.sdriReturnQty) + (0, sales_doc_utils_1.num)(i.sdriFreeQty) > 0);
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
                bucket: i.sdriBucket ??
                    BUCKET_BY_CONDITION[i.sdriCondition ?? 'RESTOCK'] ??
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
                costRate: (0, sales_doc_utils_1.num)(i.sdriCostPrice) || null,
                taxPerc: (0, sales_doc_utils_1.num)(i.sdriTaxPerc),
            })),
        }, actor, now);
        for (const i of moving) {
            await this.store.updateItem(tx, i, {
                sdriLotId: stock.lotByLine.get(i.sdriId) ?? i.sdriLotId ?? null,
            });
        }
        let voucherId = null;
        let voucherLastNo = null;
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
                    presetNo: row.sdrReturnSlno,
                },
                legs: (0, sales_leg_sources_1.buildCogsLegs)(cogs, 'RETURN'),
            });
            voucherId = v.voucherId;
            voucherLastNo = v.voucherLastNo;
        }
        const [company] = await tx.$queryRaw `SELECT comp_state_code FROM public.companys WHERE comp_id = ${keys.companyId}::uuid`;
        const nature = (0, sales_doc_utils_1.supplyNatureOf)(company?.comp_state_code, row.sdrPosStcd);
        let gdrId = null;
        let ewaybill = false;
        if (row.sdrCustId) {
            const reg = await this.register.write(tx, this.registerDoc(row, items, voucherId, voucherLastNo, nature, actor), { interState: nature === 'INTER' });
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
        return {
            companyId: row.sdrCompanyId,
            branchId: row.sdrBranchId,
            accYear: row.sdrAccYear,
            voucherId: voucherId ?? row.sdrId,
            voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.DC_RETURN,
            voucherNo: row.sdrReturnSlno ??
                voucherNo ??
                (0, sales_doc_utils_1.numericTail)(row.sdrReturnRefno, BigInt(0)),
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
            taxability: d('sdrTaxAmt') > 0 ? 'TAXABLE' : 'EXEMPT',
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
            cgstValue: 0,
            sgstValue: 0,
            igstValue: 0,
            cessValue: 0,
            stateCessValue: 0,
            tcsValue: 0,
            otherCharge: 0,
            roundOff: 0,
            billValue: d('sdrReturnAmt'),
            remarks: row.sdrReturnReason,
            createdBy: actor,
            lines: items.map((i) => {
                const n = (k) => (0, sales_doc_utils_1.num)(i[k]);
                const tax = n('sdriCgstAmt') + n('sdriSgstAmt') + n('sdriIgstAmt') + n('sdriCessAmt');
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
                    totalTaxRate: n('sdriTaxPerc'),
                    cgstRate: n('sdriCgstPerc'),
                    sgstRate: n('sdriSgstPerc'),
                    igstRate: n('sdriIgstPerc'),
                    cessRate: n('sdriCessPerc'),
                    cgstAmount: n('sdriCgstAmt'),
                    sgstAmount: n('sdriSgstAmt'),
                    igstAmount: n('sdriIgstAmt'),
                    cessAmount: n('sdriCessAmt'),
                    otherAmount: 0,
                    totalValue: (0, sales_doc_utils_1.round2)(n('sdriTaxableAmt') + tax),
                    billValue: n('sdriNetAmt') || (0, sales_doc_utils_1.round2)(n('sdriTaxableAmt') + tax),
                    taxability: tax > 0 ? 'TAXABLE' : 'EXEMPT',
                    supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
                };
            }),
        };
    }
    async cancel(dto) {
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const row = await this.store.lock(tx, this.keys(dto));
            if (row.sdrStatus === 'CANCELLED') {
                return { ...this.keys(dto), sdrStatus: 'CANCELLED' };
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
            await this.store.trail(tx, row, txn_status_log_helper_1.TxnStatusEvent.CANCELLED, 'POSTED', 'CANCELLED', ctx.actor, now, dto.reason);
            await this.store.auditChange(tx, row, 'cancel', { sdrStatus: 'POSTED' }, { sdrStatus: 'CANCELLED' }, ctx.actor, `DC return cancelled: ${dto.reason}`);
            return {
                ...this.keys(dto),
                sdrStatus: 'CANCELLED',
                reversalVoucherRefno: reversal,
                cancelledOn: now.toISOString(),
            };
        }, TX);
    }
    async transport(dto) {
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const row = await this.store.lock(tx, this.keys(dto));
            if (row.sdrStatus === 'CANCELLED') {
                (0, sales_errors_1.throwSalesLocked)('This DC return is CANCELLED', posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED, 'sdrId');
            }
            const actor = this.salesContext.actor();
            const gdrId = await this.register.registerIdOf(tx, row.sdrId, row.sdrAccYear);
            const band = await this.transportBand.write(tx, {
                docType: 'DC_RETURN',
                docId: row.sdrId,
                accYear: row.sdrAccYear,
                companyId: row.sdrCompanyId,
                branchId: row.sdrBranchId,
                tenantId: row.sdrTenantId,
                docRefno: row.sdrReturnRefno,
            }, { ...dto.transport, direction: 'INWARD' }, actor, { gdrId, now });
            await this.store.trail(tx, row, 'TRANSPORT_EDITED', row.sdrStatus, row.sdrStatus, actor, now, null);
            return band;
        });
    }
};
exports.DcReturnService = DcReturnService;
exports.DcReturnService = DcReturnService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sales_context_service_1.SalesContextService,
        statutory_service_1.StatutoryService,
        sales_posting_service_1.SalesPostingService,
        doc_register_service_1.DocRegisterService,
        sales_stock_service_1.SalesStockService,
        sales_doc_blocks_service_1.SalesDocBlocksService,
        transport_band_service_1.TransportBandService,
        dc_fulfilment_service_1.DcFulfilmentService,
        gst_gateway_service_1.GstGatewayService,
        audit_log_service_1.AuditLogService,
        charge_detail_service_1.ChargeDetailService,
        tender_detail_service_1.TenderDetailService])
], DcReturnService);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) {
    return !!v && UUID.test(v);
}
//# sourceMappingURL=dc-return.service.js.map