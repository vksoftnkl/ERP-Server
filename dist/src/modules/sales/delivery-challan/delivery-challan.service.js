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
exports.DeliveryChallanService = exports.DC_SPEC = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const charge_detail_service_1 = require("../../master/charge-detail/charge-detail.service");
const charge_enum_1 = require("../../master/charge-master/types/charge-enum");
const tender_detail_service_1 = require("../../accountsModule/tenderDetail/tender-detail.service");
const tender_detail_api_types_1 = require("../../accountsModule/tenderDetail/types/tender-detail-api.types");
const bill_read_service_1 = require("../bill/bill-read.service");
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
const save_delivery_challan_dto_1 = require("./dto/save-delivery-challan.dto");
const save_delivery_challan_item_dto_1 = require("./dto/save-delivery-challan-item.dto");
exports.DC_SPEC = {
    kind: 'DELIVERY_CHALLAN',
    headerDelegate: 'saleDc',
    itemDelegate: 'saleDcItem',
    p: 'sdc',
    ip: 'sdi',
    itemFk: 'sdiDcId',
    refnoField: 'sdcDcRefno',
    slnoField: 'sdcDcSlno',
    dateField: 'sdcDcDate',
    datetimeField: 'sdcDcDatetime',
    custField: 'sdcCustId',
    custNameField: 'sdcCustName',
    revisionField: 'sdcRevisionNo',
    voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.DELIVERY_CHALLAN,
    menuId: sales_doc_utils_1.SALES_MENU_ID.DELIVERY_CHALLAN,
    statusDocType: txn_status_log_helper_1.TxnStatusDocType.DELIVERY_CHALLAN,
    chargeDocType: charge_enum_1.ChargeDocType.DELIVERY_CHALLAN,
    tenderDocType: null,
    tenderDrCr: tender_detail_api_types_1.TenderDrCr.DR,
    transportDocType: 'DELIVERY_CHALLAN',
    transportDirection: 'OUTWARD',
    tableName: 'sale_dc',
    itemTableName: 'sale_dc_item',
    screenName: 'Delivery Challan',
    optionalFields: save_delivery_challan_dto_1.SDC_OPTIONAL_FIELDS,
    dateFields: save_delivery_challan_dto_1.SDC_DATE_FIELDS,
    serverOwned: save_delivery_challan_dto_1.SDC_SERVER_OWNED,
    itemOptionalFields: save_delivery_challan_item_dto_1.SDI_OPTIONAL_FIELDS,
    itemDateFields: save_delivery_challan_item_dto_1.SDI_DATE_FIELDS,
    itemRequired: ['sdiItemId', 'sdiItemUnitId', 'sdiGodownId'],
    headerRequired: ['sdcCounterId'],
    headerWhereUnique: 'sdcId_sdcAccYear',
    itemWhereUnique: 'sdiId_sdiAccYear',
};
const TX = { timeout: 60_000, maxWait: 10_000 };
let DeliveryChallanService = class DeliveryChallanService {
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
    billRead;
    store;
    constructor(prisma, salesContext, statutory, legs, register, stock, blocks, transportBand, fulfilment, gst, billRead, audit, charges, tenders) {
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
        this.billRead = billRead;
        this.store = new sales_doc_store_1.SalesDocStore(exports.DC_SPEC, audit, charges, tenders, transportBand);
    }
    keys(dto) {
        return {
            id: dto.sdcId,
            companyId: dto.sdcCompanyId,
            branchId: dto.sdcBranchId,
            accYear: dto.sdcAccYear,
        };
    }
    async save(dto) {
        const actor = this.salesContext.actor();
        const now = new Date();
        const row = await this.prisma.$transaction(async (tx) => {
            return this.store.saveDraft(tx, dto, actor, now, {
                beforeWrite: (data) => {
                    if (data.sdcDcDatetime === undefined && !data.sdcId) {
                        data.sdcDcDatetime = now;
                    }
                },
            });
        }, TX);
        return this.get(this.store.keysOf(row));
    }
    async get(keys) {
        const row = await this.store.findOrThrow(this.prisma, keys);
        return this.payload(this.prisma, row);
    }
    async delete(dto) {
        const actor = this.salesContext.actor();
        await this.prisma.$transaction((tx) => this.store.deleteDraft(tx, this.keys(dto), actor, new Date()), TX);
        return { sdcId: dto.sdcId, deleted: true };
    }
    async openForBill(q) {
        return this.billRead.openSources({ ...q, kind: 'DC' });
    }
    async payload(c, row) {
        const [items, charges, transport, rights, gdrId] = await Promise.all([
            this.store.loadItems(c, row),
            this.store.loadCharges(row),
            this.store.loadTransport(c, row),
            this.salesContext.rights(exports.DC_SPEC.menuId, c),
            this.register.registerIdOf(c, row.sdcId, row.sdcAccYear),
        ]);
        const { posting, locks } = await this.blocks.build({
            status: row.sdcStatus,
            companyId: row.sdcCompanyId,
            branchId: row.sdcBranchId,
            accYear: row.sdcAccYear,
            docDate: (0, sales_doc_utils_1.isoDate)(row.sdcDcDate) ?? (0, sales_doc_utils_1.isoToday)(),
            voucherId: row.sdcPostedVoucherId ?? null,
            registerId: gdrId,
            cogsAmt: (0, sales_doc_utils_1.num)(row.sdcTotalCost),
        }, c);
        const touched = items.some((i) => (0, sales_doc_utils_1.num)(i.sdiBilledQty) > 0 || (0, sales_doc_utils_1.num)(i.sdiReturnedQty) > 0);
        locks.editable.purpose =
            row.sdcStatus === 'POSTED' && !locks.irnLive && !locks.ewbLive && !touched;
        return {
            ...this.store.plain(row),
            items: items.map((i) => this.store.plain(i)),
            charges,
            transport,
            posting,
            locks,
            rights,
        };
    }
    async validate(dto) {
        const ctx = await this.salesContext.resolve({ companyId: dto.sdcCompanyId, branchId: dto.sdcBranchId, deviceId: dto.sdcDeviceId }, exports.DC_SPEC.menuId);
        const g = (0, posting_types_1.createGuardContext)({
            overrides: dto.overrides ?? [],
            canOverride: ctx.rights.override,
            throwOnRefusal: false,
            dryRun: true,
        });
        const items = (dto.items ?? []).map((i, idx) => ({
            ...i,
            sdiLineNo: i.sdiLineNo ?? idx + 1,
        }));
        await this.prisma.$transaction((tx) => this.guards(tx, dto, items, ctx, g), TX);
        return {
            ok: g.refusals.length === 0,
            refusals: g.refusals,
            warnings: g.warnings,
            rights: ctx.rights,
        };
    }
    async post(dto) {
        let fire = null;
        await this.prisma.$transaction(async (tx) => {
            const row = await this.store.lock(tx, this.keys(dto));
            if (row.sdcStatus === 'POSTED') {
                return;
            }
            if (row.sdcStatus === 'CANCELLED') {
                (0, sales_errors_1.throwSalesLocked)('This challan is CANCELLED', posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED, 'sdcId');
            }
            const ctx = await this.ctxOf(tx, row);
            if (!ctx.rights.post) {
                (0, sales_errors_1.throwSalesRight)('This user may not post on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_POST);
            }
            const items = await this.store.loadItems(tx, row);
            const g = (0, posting_types_1.createGuardContext)({
                overrides: dto.overrides ?? [],
                canOverride: ctx.rights.override,
                throwOnRefusal: false,
            });
            await this.guards(tx, row, items, ctx, g);
            if (g.refusals.length > 0) {
                (0, sales_errors_1.throwSalesRefusals)('Challan cannot be posted', g.refusals);
            }
            fire = await this.postCore(tx, row, items, ctx, new Date(), 'DRAFT');
        }, TX);
        if (fire) {
            const f = fire;
            this.gst.enqueueAfterPost({ gdrId: f.gdrId, einvoice: false, ewaybill: f.ewaybill });
        }
        return this.get(this.keys(dto));
    }
    async ctxOf(tx, row) {
        return this.salesContext.resolve({
            companyId: row.sdcCompanyId,
            branchId: row.sdcBranchId,
            deviceId: row.sdcDeviceId,
        }, exports.DC_SPEC.menuId, tx);
    }
    async guards(tx, row, items, ctx, g) {
        const companyId = row.sdcCompanyId;
        const accYear = row.sdcAccYear;
        const docDate = (0, sales_doc_utils_1.isoDate)(row.sdcDcDate) ?? (0, sales_doc_utils_1.isoToday)();
        const today = (0, sales_doc_utils_1.isoToday)();
        await (0, sales_guards_1.assertAccYearWritable)(tx, companyId, accYear, 'sdcAccYear');
        await (0, sales_guards_1.assertVoucherPartitionExists)(tx, accYear, 'sdcAccYear');
        if (docDate > today) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.BACKDATE, `A challan cannot be dated ${docDate}, in the future`, {
                field: 'sdcDcDate',
            });
        }
        else if (docDate !== today && ctx.settings.backdateMode !== 'ALLOW') {
            (ctx.settings.backdateMode === 'REFUSE' ? sales_guards_1.refuse : sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.BACKDATE, `This challan is dated ${docDate}, before today`, { field: 'sdcDcDate' });
        }
        if (await (0, sales_guards_1.loadDayClosed)(tx, companyId, row.sdcBranchId, docDate)) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DAY_CLOSED, `The books for ${docDate} are closed at this branch`, { field: 'sdcDcDate' });
        }
        const salesmen = row.sdcSalesmanId ?? null;
        await (0, sales_guards_1.assertSalesmen)(tx, companyId, salesmen && salesmen.length ? salesmen : null, {
            field: 'sdcSalesmanId',
        });
        if (!row.sdcCustId) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.PAN_REQUIRED, 'A challan must name a customer', {
                field: 'sdcCustId',
            });
        }
        if (items.length === 0) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.STOCK_QTY_MISMATCH, 'A challan with no lines cannot be posted', {
                field: 'items',
            });
        }
        const [company] = await tx.$queryRaw `
      SELECT comp_dc_purposes, comp_state_code FROM public.companys WHERE comp_id = ${companyId}::uuid`;
        const purpose = (row.sdcPurpose ?? 'SUPPLY').toUpperCase();
        const allowed = company?.comp_dc_purposes ?? ['SUPPLY'];
        if (!allowed.includes(purpose)) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_PURPOSE_NOT_ALLOWED, `Purpose ${purpose} is not enabled for this company (allowed: ${allowed.join(', ')})`, { field: 'sdcPurpose' });
        }
        const requiresOrder = ((await this.salesContext.setting(companyId, row.sdcBranchId, 'sales.dc_requires_order')) ?? '')
            .trim()
            .toLowerCase();
        if ((requiresOrder === 'true' || requiresOrder === '1') &&
            row.sdcSrcDocType !== 'SALES_ORDER') {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_REQUIRES_ORDER, 'This company issues challans only against a sales order (sales.dc_requires_order)', { field: 'sdcSrcDocId' });
        }
        const orderLines = items.filter((i) => i.sdiSrcDocType === 'SALES_ORDER' && i.sdiSrcItemId);
        if (orderLines.length > 0) {
            const rows = await tx.$queryRaw `
        SELECT soi_id, soi_pending_qty FROM sales.sale_order_item WHERE soi_id = ANY(${orderLines.map((l) => l.sdiSrcItemId)}::uuid[])`;
            const by = new Map(rows.map((r) => [r.soi_id, (0, sales_doc_utils_1.num)(r.soi_pending_qty)]));
            const taken = new Map();
            for (const l of orderLines) {
                const k = l.sdiSrcItemId;
                taken.set(k, (taken.get(k) ?? 0) + (0, sales_doc_utils_1.num)(l.sdiDcQty));
            }
            for (const [k, qty] of taken) {
                const pending = by.get(k);
                if (pending === undefined) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_LINE_OVER_ORDER, `Order line ${k} does not exist`, {
                        field: 'items',
                    });
                }
                else if (qty > pending + 0.0005) {
                    (ctx.settings.allowBillOverOrderQty ? sales_guards_1.warn : sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_LINE_OVER_ORDER, `Order line has ${pending} pending; this challan takes ${qty}`, { field: 'items' });
                }
            }
        }
        const inter = (0, sales_doc_utils_1.supplyNatureOf)(company?.comp_state_code, row.sdcPosStcd) === 'INTER';
        const eway = await this.statutory.ewayApplicable(companyId, (0, sales_doc_utils_1.num)(row.sdcDcAmt), docDate, { interState: inter, stateCode: row.sdcPosStcd }, tx);
        if (eway.applicable && row.sdcId) {
            const band = await this.store.loadTransport(tx, row);
            if (!band || (!band.transporterId && !band.transporterName && !band.lrNo)) {
                (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.EWAY_TRANSPORT_MISSING, `An e-way bill is required for this consignment (${(0, sales_doc_utils_1.num)(row.sdcDcAmt)} ${inter ? 'inter' : 'intra'}-state) and the transport band is empty`, { field: 'transport' });
            }
        }
    }
    async postCore(tx, row, items, ctx, now, fromStatus, revisionNo) {
        const actor = ctx.actor;
        const keys = this.store.keysOf(row);
        const refno = row.sdcDcRefno ?? keys.id;
        const docDate = (0, sales_doc_utils_1.isoDate)(row.sdcDcDate) ?? (0, sales_doc_utils_1.isoToday)();
        const moving = items.filter((i) => !i.sdiIsService &&
            (0, sales_doc_utils_1.num)(i.sdiDcQty) + (0, sales_doc_utils_1.num)(i.sdiFreeQty) > 0);
        const stock = await this.stock.post(tx, {
            docType: 'DELIVERY_CHALLAN',
            docId: keys.id,
            accYear: keys.accYear,
            companyId: keys.companyId,
            branchId: keys.branchId,
            tenantId: row.sdcTenantId,
            deviceId: row.sdcDeviceId,
            sessionId: row.sdcSessionId,
            docDate,
            docDatetime: row.sdcDcDatetime ?? now,
            refno,
            revision: revisionNo ?? row.sdcRevisionNo ?? 1,
            partyId: row.sdcCustId,
            direction: 'OUT',
            txnType: 'DC_ISSUE',
            lines: moving.map((i) => ({
                lineId: i.sdiId,
                lineNo: i.sdiLineNo,
                itemId: i.sdiItemId,
                itemUnitId: i.sdiItemUnitId,
                godownId: i.sdiGodownId,
                lotId: i.sdiLotId,
                bucket: i.sdiBucket,
                qty: (0, sales_doc_utils_1.num)(i.sdiDcQty),
                freeQty: (0, sales_doc_utils_1.num)(i.sdiFreeQty),
                weightQty: i.sdiWeightQty === null ? null : (0, sales_doc_utils_1.num)(i.sdiWeightQty),
                toBaseFactor: (0, sales_doc_utils_1.num)(i.sdiToBaseFactor) || null,
                batchNo: i.sdiBatchNo,
                batchDate: (0, sales_doc_utils_1.isoDate)(i.sdiBatchDate),
                expiryDate: (0, sales_doc_utils_1.isoDate)(i.sdiExpiryDate),
                serialNo: i.sdiSerialNo,
                mrp: i.sdiMaxPrice === null ? null : (0, sales_doc_utils_1.num)(i.sdiMaxPrice),
                rate: (0, sales_doc_utils_1.num)(i.sdiRate),
                taxPerc: (0, sales_doc_utils_1.num)(i.sdiTaxPerc),
            })),
        }, actor, now);
        for (const i of moving) {
            await this.store.updateItem(tx, i, {
                sdiCostPrice: new client_1.Prisma.Decimal((stock.costByLine.get(i.sdiId) ?? 0).toFixed(2)),
                sdiLotId: stock.lotByLine.get(i.sdiId) ?? i.sdiLotId ?? null,
            });
        }
        let voucherId = null;
        let voucherLastNo = null;
        const cogs = ctx.cogsMode === 'PERPETUAL' ? stock.cogsTotal : 0;
        if (cogs > 0 && row.sdcCustId) {
            const v = await this.legs.postLegs(tx, {
                header: {
                    companyId: keys.companyId,
                    branchId: keys.branchId,
                    tenantId: row.sdcTenantId,
                    accYear: keys.accYear,
                    voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.DELIVERY_CHALLAN,
                    voucherDate: docDate,
                    srcModule: 'SALES',
                    srcDocType: 'DELIVERY_CHALLAN',
                    srcDocId: keys.id,
                    docRefno: refno,
                    docDate,
                    usrRefno: row.sdcUsrRefno,
                    docAmount: (0, sales_doc_utils_1.num)(row.sdcDcAmt),
                    partyId: row.sdcCustId,
                    userId: isUuid(row.sdcUserId) ? row.sdcUserId : actor,
                    sessionId: row.sdcSessionId,
                    deviceType: row.sdcDeviceType,
                    remarks: row.sdcRemarks,
                    createdBy: actor,
                    presetRefno: row.sdcDcRefno,
                    presetNo: row.sdcDcSlno,
                },
                legs: (0, sales_leg_sources_1.buildCogsLegs)(cogs, 'ISSUE'),
            });
            voucherId = v.voucherId;
            voucherLastNo = v.voucherLastNo;
        }
        const [company] = await tx.$queryRaw `SELECT comp_state_code FROM public.companys WHERE comp_id = ${keys.companyId}::uuid`;
        const nature = (0, sales_doc_utils_1.supplyNatureOf)(company?.comp_state_code, row.sdcPosStcd);
        let gdrId = null;
        let ewaybill = false;
        if (row.sdcCustId) {
            const reg = await this.register.write(tx, this.registerDoc(row, items, voucherId, voucherLastNo, nature, actor), { interState: nature === 'INTER' });
            gdrId = reg.gdrId;
            ewaybill = reg.ewaybillApplicable;
        }
        await this.store.setStatus(tx, row, 'POSTED', {
            sdcPostedVoucherId: voucherId,
            sdcTotalCost: new client_1.Prisma.Decimal(stock.cogsTotal.toFixed(2)),
            ...(revisionNo ? { sdcRevisionNo: revisionNo } : {}),
        }, actor, now);
        await this.fulfilment.recompute(tx, [{ dcId: keys.id, accYear: keys.accYear }], actor, now);
        await this.store.trail(tx, row, txn_status_log_helper_1.TxnStatusEvent.POSTED, fromStatus, 'POSTED', actor, now, revisionNo ? `Re-posted as revision ${revisionNo}` : null);
        await this.store.auditChange(tx, row, 'approve', { sdcStatus: fromStatus }, { sdcStatus: 'POSTED', sdcPostedVoucherId: voucherId, gdrId, cogs }, actor, 'Challan posted');
        return { gdrId, ewaybill };
    }
    registerDoc(row, items, voucherId, voucherNo, nature, actor) {
        const d = (k) => (0, sales_doc_utils_1.num)(row[k]);
        return {
            companyId: row.sdcCompanyId,
            branchId: row.sdcBranchId,
            accYear: row.sdcAccYear,
            voucherId: voucherId ?? row.sdcId,
            voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.DELIVERY_CHALLAN,
            voucherNo: row.sdcDcSlno ??
                voucherNo ??
                (0, sales_doc_utils_1.numericTail)(row.sdcDcRefno, BigInt(0)),
            voucherDate: (0, sales_doc_utils_1.isoDate)(row.sdcDcDate),
            voucherRefno: row.sdcDcRefno,
            sourceDocId: row.sdcId,
            docType: 'DELIVERY_CHALLAN',
            tranNature: 'DELIVERY_CHALLAN',
            docFlow: 'OUTWARD',
            docSign: 1,
            docNo: row.sdcDcRefno,
            docDate: (0, sales_doc_utils_1.isoDate)(row.sdcDcDate),
            docRefNo: row.sdcUsrRefno,
            taxability: d('sdcTaxAmt') > 0 ? 'TAXABLE' : 'EXEMPT',
            supplyClass: 'GOODS',
            supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
            placeOfSupplyCode: row.sdcPosStcd,
            placeOfSupplyName: row.sdcStateName,
            partyId: row.sdcCustId,
            partyName: row.sdcCustName,
            partyAddr1: row.sdcCustAddr,
            partyLocation: row.sdcCustPlace,
            partyPin: row.sdcCustPin,
            partyStateCode: row.sdcCustStcd,
            partyStateName: row.sdcStateName,
            partyGstType: row.sdcCustGstType,
            partyGstin: (row.sdcCustGstin ?? '').trim() || null,
            grossValue: d('sdcGrossAmt'),
            discountValue: d('sdcDiscAmt'),
            taxableValue: d('sdcTaxableAmt'),
            cgstValue: d('sdcCgstAmt'),
            sgstValue: d('sdcSgstAmt'),
            igstValue: d('sdcIgstAmt'),
            cessValue: d('sdcCessAmt'),
            stateCessValue: 0,
            tcsValue: 0,
            otherCharge: d('sdcOtherAmt'),
            roundOff: d('sdcRoundOff'),
            billValue: d('sdcDcAmt'),
            remarks: typeof row.sdcPurpose === 'string' ? row.sdcPurpose : null,
            createdBy: actor,
            lines: items.map((i) => {
                const n = (k) => (0, sales_doc_utils_1.num)(i[k]);
                const tax = n('sdiCgstAmt') + n('sdiSgstAmt') + n('sdiIgstAmt') + n('sdiCessAmt');
                return {
                    rowNo: i.sdiLineNo,
                    itemId: i.sdiItemId,
                    hsnCode: i.sdiHsnCode,
                    unitId: i.sdiItemUnitId,
                    qty: n('sdiDcQty'),
                    rate: n('sdiRate'),
                    discount: n('sdiDiscAmt'),
                    isService: i.sdiIsService ?? false,
                    taxableValue: n('sdiTaxableAmt'),
                    taxId: i.sdiTaxId,
                    totalTaxRate: n('sdiTaxPerc'),
                    cgstRate: n('sdiCgstPerc'),
                    sgstRate: n('sdiSgstPerc'),
                    igstRate: n('sdiIgstPerc'),
                    cessRate: n('sdiCessPerc'),
                    cgstAmount: n('sdiCgstAmt'),
                    sgstAmount: n('sdiSgstAmt'),
                    igstAmount: n('sdiIgstAmt'),
                    cessAmount: n('sdiCessAmt'),
                    otherAmount: 0,
                    totalValue: (0, sales_doc_utils_1.round2)(n('sdiTaxableAmt') + tax),
                    billValue: n('sdiNetAmt') || (0, sales_doc_utils_1.round2)(n('sdiTaxableAmt') + tax),
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
            if (row.sdcStatus === 'CANCELLED') {
                return {
                    ...this.keys(dto),
                    sdcStatus: 'CANCELLED',
                    cancelledOn: row.sdcModifiedOn?.toISOString() ?? null,
                };
            }
            if (row.sdcStatus !== 'POSTED') {
                (0, sales_errors_1.throwSalesLocked)('Only a POSTED challan can be cancelled — a DRAFT is deleted', posting_types_1.SALES_ERROR_CODES.DOC_NOT_DRAFT, 'sdcId');
            }
            const ctx = await this.ctxOf(tx, row);
            if (!ctx.rights.cancel) {
                (0, sales_errors_1.throwSalesRight)('This user may not cancel on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_CANCEL);
            }
            const items = await this.store.loadItems(tx, row);
            await this.assertUnwindable(tx, row, items, dto.reason);
            const reversal = await this.unwind(tx, row, ctx.actor, dto.reason, now);
            await this.store.setStatus(tx, row, 'CANCELLED', {}, ctx.actor, now);
            await this.fulfilment.recompute(tx, [{ dcId: row.sdcId, accYear: row.sdcAccYear }], ctx.actor, now);
            await this.store.trail(tx, row, txn_status_log_helper_1.TxnStatusEvent.CANCELLED, 'POSTED', 'CANCELLED', ctx.actor, now, dto.reason);
            await this.store.auditChange(tx, row, 'cancel', { sdcStatus: 'POSTED' }, { sdcStatus: 'CANCELLED' }, ctx.actor, `Challan cancelled: ${dto.reason}`);
            return {
                ...this.keys(dto),
                sdcStatus: 'CANCELLED',
                reversalVoucherRefno: reversal,
                cancelledOn: now.toISOString(),
            };
        }, TX);
    }
    async amend(dto) {
        const now = new Date();
        let fire = null;
        await this.prisma.$transaction(async (tx) => {
            const keys = {
                id: dto.sdcId,
                companyId: dto.sdcCompanyId,
                branchId: dto.sdcBranchId,
                accYear: dto.sdcAccYear,
            };
            const row = await this.store.lock(tx, keys);
            if (row.sdcStatus !== 'POSTED') {
                (0, sales_errors_1.throwSalesLocked)(row.sdcStatus === 'CANCELLED'
                    ? 'This challan is CANCELLED'
                    : 'This challan is a DRAFT — use /create', row.sdcStatus === 'CANCELLED'
                    ? posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED
                    : posting_types_1.SALES_ERROR_CODES.DOC_NOT_DRAFT, 'sdcId');
            }
            const ctx = await this.ctxOf(tx, row);
            if (!ctx.rights.amend) {
                (0, sales_errors_1.throwSalesRight)('This user may not amend on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_AMEND);
            }
            if (!ctx.settings.allowPostedAmend) {
                (0, sales_errors_1.throwSalesLocked)('Amending a posted document is switched off (sales.allow_posted_amend)', posting_types_1.SALES_ERROR_CODES.AMEND_OFF, 'sdcId');
            }
            if (row.sdcRevisionNo !== dto.baseRevision) {
                (0, sales_errors_1.throwSalesLocked)(`This challan has been amended since you opened it (now revision ${String(row.sdcRevisionNo)}, you sent ${dto.baseRevision})`, posting_types_1.SALES_ERROR_CODES.REVISION_STALE, 'baseRevision');
            }
            const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
            const { ewbLive } = await (0, sales_guards_1.loadDeclaredLocks)(tx, gdrId);
            if (ewbLive) {
                (0, sales_errors_1.throwSalesLocked)('This challan has a live e-way bill and cannot be amended — cancel it and raise a fresh one', posting_types_1.SALES_ERROR_CODES.EWB_LIVE, 'sdcId');
            }
            const items = await this.store.loadItems(tx, row);
            await this.assertUnwindable(tx, row, items, dto.editRemark);
            const before = this.store.plain(row);
            await this.unwind(tx, row, ctx.actor, `Amended: ${dto.editRemark}`, now);
            const draft = await this.store.setStatus(tx, row, 'DRAFT', { sdcPostedVoucherId: null }, ctx.actor, now);
            await this.store.trail(tx, draft, txn_status_log_helper_1.TxnStatusEvent.AMENDED, 'POSTED', 'DRAFT', ctx.actor, now, dto.editRemark);
            const { baseRevision: _b, editRemark: _e, overrides: _o, ...saveDto } = dto;
            void _b;
            void _e;
            void _o;
            const saved = await this.store.saveDraft(tx, { ...saveDto, sdcId: keys.id }, ctx.actor, now);
            const newItems = await this.store.loadItems(tx, saved);
            const g = (0, posting_types_1.createGuardContext)({
                overrides: dto.overrides ?? [],
                canOverride: ctx.rights.override,
                throwOnRefusal: false,
            });
            await this.guards(tx, saved, newItems, ctx, g);
            if (g.refusals.length > 0) {
                (0, sales_errors_1.throwSalesRefusals)('Challan cannot be amended', g.refusals);
            }
            fire = await this.postCore(tx, saved, newItems, ctx, now, 'DRAFT', row.sdcRevisionNo + 1);
            await this.store.auditChange(tx, saved, 'update', before, this.store.plain(saved), ctx.actor, `Challan amended to revision ${row.sdcRevisionNo + 1}: ${dto.editRemark}`);
        }, TX);
        if (fire) {
            const f = fire;
            this.gst.enqueueAfterPost({ gdrId: f.gdrId, einvoice: false, ewaybill: f.ewaybill });
        }
        return this.get({
            id: dto.sdcId,
            companyId: dto.sdcCompanyId,
            branchId: dto.sdcBranchId,
            accYear: dto.sdcAccYear,
        });
    }
    async assertUnwindable(tx, row, items, reason) {
        const keys = this.store.keysOf(row);
        const docDate = (0, sales_doc_utils_1.isoDate)(row.sdcDcDate) ?? (0, sales_doc_utils_1.isoToday)();
        await (0, sales_guards_1.assertAccYearWritable)(tx, keys.companyId, keys.accYear, 'sdcAccYear');
        if (await (0, sales_guards_1.loadDayClosed)(tx, keys.companyId, keys.branchId, docDate)) {
            (0, sales_errors_1.throwSalesLocked)(`The books for ${docDate} are closed at this branch`, posting_types_1.SALES_ERROR_CODES.DAY_CLOSED, 'sdcDcDate');
        }
        if (items.some((i) => (0, sales_doc_utils_1.num)(i.sdiBilledQty) > 0)) {
            (0, sales_errors_1.throwSalesLocked)('A bill has been raised against this challan — cancel the bill first', posting_types_1.SALES_ERROR_CODES.DC_BILLED, 'sdcId');
        }
        if (items.some((i) => (0, sales_doc_utils_1.num)(i.sdiReturnedQty) > 0)) {
            (0, sales_errors_1.throwSalesLocked)('Goods have been returned against this challan — cancel the DC return first', posting_types_1.SALES_ERROR_CODES.DC_RETURNED, 'sdcId');
        }
        const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
        const { ewbLive } = await (0, sales_guards_1.loadDeclaredLocks)(tx, gdrId);
        if (ewbLive) {
            const gst = await this.blocks.gstRows(tx, gdrId, keys.accYear);
            const w = gst.ewbGeneratedOn
                ? await this.statutory.withinCancelWindow(keys.companyId, 'EWAYBILL', gst.ewbGeneratedOn, docDate, new Date(), tx)
                : { within: false };
            if (!w.within) {
                (0, sales_errors_1.throwSalesLocked)("The e-way bill's cancellation window has passed — cancel it at the portal or let it expire first", posting_types_1.SALES_ERROR_CODES.EWB_WINDOW_PASSED, 'posting.ewb');
            }
            await this.gst.cancelEwb({
                gdrId: gdrId,
                accYear: keys.accYear,
                companyId: keys.companyId,
                reason,
            });
        }
    }
    async unwind(tx, row, actor, reason, now) {
        const keys = this.store.keysOf(row);
        let reversalRefno = null;
        if (row.sdcPostedVoucherId) {
            const r = await this.legs.reverseLegs(tx, row.sdcPostedVoucherId, keys.accYear, reason, actor);
            if (r) {
                const [v] = await tx.$queryRaw `SELECT avh_voucher_refno FROM accounts.acc_voucher_header WHERE avh_voucher_id = ${r.voucherId}::uuid AND avh_acc_year = ${keys.accYear}::char(9)`;
                reversalRefno = v?.avh_voucher_refno ?? null;
            }
        }
        await this.stock.cancel(tx, {
            docType: 'DELIVERY_CHALLAN',
            docId: keys.id,
            accYear: keys.accYear,
            companyId: keys.companyId,
            branchId: keys.branchId,
            direction: 'OUT',
            txnType: 'DC_ISSUE',
        }, actor, reason, now);
        const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
        if (gdrId) {
            await this.register.cancel(tx, gdrId, keys.accYear, reason, actor);
        }
        return reversalRefno;
    }
    async convertPurpose(dto) {
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            const row = await this.store.lock(tx, this.keys(dto));
            if (row.sdcStatus !== 'POSTED') {
                (0, sales_errors_1.throwSalesLocked)('Only a POSTED challan changes purpose — edit a DRAFT directly', posting_types_1.SALES_ERROR_CODES.DOC_NOT_DRAFT, 'sdcId');
            }
            const ctx = await this.ctxOf(tx, row);
            const gdrId = await this.register.registerIdOf(tx, row.sdcId, row.sdcAccYear);
            await (0, sales_guards_1.assertBandWritable)(tx, gdrId);
            const items = await this.store.loadItems(tx, row);
            if (items.some((i) => (0, sales_doc_utils_1.num)(i.sdiBilledQty) > 0 ||
                (0, sales_doc_utils_1.num)(i.sdiReturnedQty) > 0)) {
                (0, sales_errors_1.throwSalesLocked)('This challan has been billed or returned against — its purpose decided what those became', posting_types_1.SALES_ERROR_CODES.DC_BILLED, 'purpose');
            }
            const [company] = await tx.$queryRaw `SELECT comp_dc_purposes FROM public.companys WHERE comp_id = ${row.sdcCompanyId}::uuid`;
            if (!(company?.comp_dc_purposes ?? ['SUPPLY']).includes(dto.purpose)) {
                (0, sales_errors_1.throwSalesLocked)(`Purpose ${dto.purpose} is not enabled for this company`, posting_types_1.SALES_ERROR_CODES.DC_PURPOSE_NOT_ALLOWED, 'purpose');
            }
            const from = row.sdcPurpose;
            await this.store.setStatus(tx, row, 'POSTED', { sdcPurpose: dto.purpose }, ctx.actor, now);
            await this.store.trail(tx, row, 'PURPOSE_CONVERTED', 'POSTED', 'POSTED', ctx.actor, now, `${from} → ${dto.purpose}: ${dto.remark}`);
            await this.store.auditChange(tx, row, 'update', { sdcPurpose: from }, { sdcPurpose: dto.purpose }, ctx.actor, `Purpose converted: ${dto.remark}`);
        }, TX);
        return this.get(this.keys(dto));
    }
    async transport(dto) {
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const row = await this.store.lock(tx, this.keys(dto));
            if (row.sdcStatus === 'CANCELLED') {
                (0, sales_errors_1.throwSalesLocked)('This challan is CANCELLED', posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED, 'sdcId');
            }
            const actor = this.salesContext.actor();
            const gdrId = await this.register.registerIdOf(tx, row.sdcId, row.sdcAccYear);
            const band = await this.transportBand.write(tx, {
                docType: 'DELIVERY_CHALLAN',
                docId: row.sdcId,
                accYear: row.sdcAccYear,
                companyId: row.sdcCompanyId,
                branchId: row.sdcBranchId,
                tenantId: row.sdcTenantId,
                docRefno: row.sdcDcRefno,
            }, dto.transport, actor, { gdrId, now });
            await this.store.trail(tx, row, 'TRANSPORT_EDITED', row.sdcStatus, row.sdcStatus, actor, now, null);
            return band;
        });
    }
};
exports.DeliveryChallanService = DeliveryChallanService;
exports.DeliveryChallanService = DeliveryChallanService = __decorate([
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
        bill_read_service_1.BillReadService,
        audit_log_service_1.AuditLogService,
        charge_detail_service_1.ChargeDetailService,
        tender_detail_service_1.TenderDetailService])
], DeliveryChallanService);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) {
    return !!v && UUID.test(v);
}
//# sourceMappingURL=delivery-challan.service.js.map