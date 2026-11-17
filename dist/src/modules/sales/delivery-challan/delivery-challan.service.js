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
exports.dcUnitCostOf = dcUnitCostOf;
exports.dcDisposalOf = dcDisposalOf;
exports.dcHeaderSplitOf = dcHeaderSplitOf;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const batch_detail_helper_1 = require("../../stocks/batch-detail/batch-detail.helper");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const charge_detail_service_1 = require("../../master/charge-detail/charge-detail.service");
const tender_detail_service_1 = require("../../accountsModule/tenderDetail/tender-detail.service");
const tender_detail_api_types_1 = require("../../accountsModule/tenderDetail/types/tender-detail-api.types");
const bill_read_service_1 = require("../bill/bill-read.service");
const sale_order_service_1 = require("../sale-order/sale-order.service");
const stock_reservation_service_1 = require("../posting/stock-reservation.service");
const source_lines_1 = require("../posting/source-lines");
const dc_fulfilment_service_1 = require("../posting/dc-fulfilment.service");
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
const dc_common_1 = require("./dc-common");
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
    chargeDocType: null,
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
const DC_HEADER_SPLIT = [
    ['sdcCgstAmt', 'sdiCgstAmt'],
    ['sdcSgstAmt', 'sdiSgstAmt'],
    ['sdcIgstAmt', 'sdiIgstAmt'],
    ['sdcCessAmt', 'sdiCessAmt'],
];
class DryRunRollback extends Error {
}
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
    audit;
    saleOrders;
    reservations;
    store;
    constructor(prisma, salesContext, statutory, legs, register, stock, blocks, transportBand, fulfilment, gst, billRead, audit, charges, tenders, saleOrders, reservations) {
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
        this.audit = audit;
        this.saleOrders = saleOrders;
        this.reservations = reservations;
        this.store = new sales_doc_store_1.SalesDocStore(exports.DC_SPEC, audit, charges, tenders, transportBand);
    }
    async rederiveReservations(tx, items, actor, now) {
        const keys = await (0, dc_common_1.orderLineKeysOf)(tx, items.map((i) => (0, dc_common_1.dcOrderLineOf)(i)));
        for (const [soId, lineNos] of keys) {
            await this.reservations.rederiveOrderLines(tx, soId, lineNos, actor, now);
        }
    }
    async lockOrdersFirst(tx, keys, extra = {}) {
        const [head] = keys
            ? await tx.$queryRaw `
          SELECT sdc_src_doc_type, sdc_src_doc_id FROM sales.sale_dc
           WHERE sdc_id = ${keys.id}::uuid AND sdc_acc_year = ${keys.accYear}::char(9)`
            : [];
        const lines = keys
            ? await tx.$queryRaw `
          SELECT sdi_src_doc_type, sdi_src_doc_id, sdi_src_item_id FROM sales.sale_dc_item
           WHERE sdi_dc_id = ${keys.id}::uuid AND sdi_acc_year = ${keys.accYear}::char(9)
             AND sdi_is_deleted = false`
            : [];
        await lockDcOrders(tx, [
            { sdcSrcDocType: head?.sdc_src_doc_type ?? null, sdcSrcDocId: head?.sdc_src_doc_id ?? null },
            ...(extra.header ? [extra.header] : []),
        ], [
            ...(lines ?? []).map((l) => ({
                sdiSrcDocType: l.sdi_src_doc_type,
                sdiSrcDocId: l.sdi_src_doc_id,
                sdiSrcItemId: l.sdi_src_item_id,
            })),
            ...(extra.lines ?? []),
        ]);
    }
    async syncOrders(tx, items, actor, now, reopenRemark) {
        const refs = await (0, dc_common_1.orderLineRefsOf)(tx, items.map((i) => (0, dc_common_1.dcOrderLineOf)(i)));
        if (refs.length > 0) {
            await this.saleOrders.syncOrderFulfilment(tx, { refs, reopenRemark }, actor, now);
        }
    }
    async assertRight(right, client) {
        const rights = await this.salesContext.rights(exports.DC_SPEC.menuId, client);
        if (!rights[right]) {
            (0, sales_errors_1.throwSalesRight)(`This user may not ${right} on this menu`, RIGHT_CODE[right]);
        }
        return rights;
    }
    async existingKeys(c, sdcId) {
        if (!sdcId) {
            return null;
        }
        const [r] = await c.$queryRaw `
      SELECT sdc_id, sdc_company_id, sdc_branch_id, sdc_acc_year, sdc_status FROM sales.sale_dc
       WHERE sdc_id = ${sdcId}::uuid AND sdc_is_deleted = false`;
        return r
            ? {
                id: r.sdc_id,
                companyId: r.sdc_company_id,
                branchId: r.sdc_branch_id,
                accYear: r.sdc_acc_year.trim(),
                status: r.sdc_status ?? 'DRAFT',
            }
            : null;
    }
    async writeRevision(tx, keys, before, actor, notes) {
        const after = await this.documentOf(tx, keys);
        await this.audit.logDocumentRevision({
            screenName: exports.DC_SPEC.screenName,
            tableName: exports.DC_SPEC.tableName,
            docId: keys.id,
            displayName: after.sdcDcRefno || keys.id,
            before: before === null ? null : dcAuditRecordOf(before),
            after: dcAuditRecordOf(after),
            userId: actor,
            branchId: keys.branchId,
            deviceId: after.sdcDeviceId ?? null,
            notes,
        }, tx);
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
        (0, dc_common_1.assertNoCharges)(dto.charges);
        const actor = this.salesContext.actor();
        const now = new Date();
        const row = await this.prisma.$transaction(async (tx) => {
            const existing = await this.existingKeys(tx, dto.sdcId);
            await this.assertRight(existing ? 'edit' : 'create', tx);
            await (0, source_lines_1.resolveSourceLines)(tx, dto.items, source_lines_1.DC_SOURCE_KEYS, ['SALES_ORDER']);
            await this.freeFromOrders(tx, dto, true);
            (0, dc_common_1.applyDcLineLevels)(dto);
            const before = existing ? await this.documentOf(tx, existing) : null;
            const saved = await this.store.saveDraft(tx, this.draftRow(dto), actor, now, this.draftHooks(tx, dto, now));
            await this.writeRevision(tx, this.store.keysOf(saved), before, actor, before ? 'Challan updated' : 'Challan created');
            return saved;
        }, TX);
        return this.get(this.store.keysOf(row));
    }
    async saveAndPost(dto) {
        (0, dc_common_1.assertNoCharges)(dto.charges);
        const actor = this.salesContext.actor();
        const now = new Date();
        let fire = null;
        let keys = null;
        await this.prisma.$transaction(async (tx) => {
            const existing = await this.existingKeys(tx, dto.sdcId);
            await this.assertRight(existing ? 'edit' : 'create', tx);
            await (0, source_lines_1.resolveSourceLines)(tx, dto.items, source_lines_1.DC_SOURCE_KEYS, ['SALES_ORDER']);
            await this.lockOrdersFirst(tx, existing, {
                header: dto,
                lines: (dto.items ?? []),
            });
            await this.freeFromOrders(tx, dto, false);
            (0, dc_common_1.applyDcLineLevels)(dto);
            const before = existing ? await this.documentOf(tx, existing) : null;
            const saved = await this.store.saveDraft(tx, this.draftRow(dto), actor, now, this.draftHooks(tx, dto, now));
            keys = this.store.keysOf(saved);
            await this.writeRevision(tx, keys, before, actor, before ? 'Challan updated' : 'Challan created');
            const row = await this.store.lock(tx, keys);
            fire = await this.postDraftInTx(tx, row, dto.overrides ?? [], now);
        }, TX);
        this.afterPost(fire);
        return this.get(keys);
    }
    draftRow(dto) {
        const { post: _post, overrides: _overrides, charges: _charges, ...row } = dto;
        void _post;
        void _overrides;
        void _charges;
        const out = { ...row };
        for (const k of dc_common_1.DC_ZERO_CHARGE_FIELDS) {
            out[k] = 0;
        }
        for (const [h] of DC_HEADER_SPLIT) {
            delete out[h];
        }
        return out;
    }
    headerSplitHook(tx, actor, now) {
        return async (row, items) => {
            const split = dcHeaderSplitOf(items);
            if (DC_HEADER_SPLIT.every(([h]) => (0, dc_common_1.dec)(row[h]).equals((0, dc_common_1.dec)(split[h])))) {
                return;
            }
            await this.store.setStatus(tx, row, row.sdcStatus ?? 'DRAFT', split, actor, now);
            Object.assign(row, split);
        };
    }
    async freeFromOrders(tx, dto, refuseNow) {
        const items = dto.items ?? [];
        const sent = items
            .map((i, idx) => {
            const row = { ...i, sdiLineNo: i.sdiLineNo ?? idx + 1 };
            return { item: i, row };
        })
            .filter(({ row }) => typeof row.sdiIsFree === 'boolean' || !row.sdiId);
        if (sent.length === 0) {
            return;
        }
        const orderFree = await (0, dc_common_1.orderLineFreeOf)(tx, sent.map(({ row }) => (0, dc_common_1.dcOrderLineOf)(row)).filter((id) => !!id));
        if (refuseNow) {
            const g = (0, posting_types_1.createGuardContext)({ overrides: [], canOverride: false, throwOnRefusal: false });
            (0, dc_common_1.checkDcFreeLines)(g, sent.map(({ row }) => row), orderFree);
            if (g.refusals.length > 0) {
                (0, sales_errors_1.throwSalesRefusals)('Challan cannot be saved', g.refusals);
            }
        }
        for (const { item, row } of sent) {
            item.sdiFreeType = (0, dc_common_1.dcFreeTypeOf)(row, orderFree);
        }
    }
    draftHooks(tx, dto, now) {
        return {
            afterWrite: this.headerSplitHook(tx, this.salesContext.actor(), now),
            beforeWrite: (data) => {
                if (data.sdcDcDatetime === undefined && !data.sdcId) {
                    data.sdcDcDatetime = now;
                }
            },
            numberFor: (docDate) => (0, dc_common_1.allocateDcDocNumber)(tx, {
                vchrTypeId: exports.DC_SPEC.voucherTypeId,
                companyId: dto.sdcCompanyId,
                branchId: dto.sdcBranchId,
                accYear: dto.sdcAccYear,
                deviceId: dto.sdcDeviceId,
                documentDate: docDate,
                field: 'sdcDeviceId',
            }),
            revision: true,
        };
    }
    async get(keys) {
        const c = this.prisma;
        await this.assertRight('view', c);
        return this.documentOf(c, keys);
    }
    async documentOf(c, keys) {
        const row = await this.store.findOrThrow(c, keys);
        return this.payload(c, row);
    }
    async delete(dto) {
        const actor = this.salesContext.actor();
        await this.prisma.$transaction(async (tx) => {
            await this.assertRight('delete', tx);
            await this.store.deleteDraft(tx, this.keys(dto), actor, new Date());
        }, TX);
        return { sdcId: dto.sdcId, deleted: true };
    }
    async openForBill(q) {
        const rights = await this.salesContext.rights(sales_doc_utils_1.SALES_MENU_ID.SALE_BILL);
        if (!rights.view) {
            (0, sales_errors_1.throwSalesRight)('This user may not view on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_VIEW);
        }
        return this.billRead.openSources({ ...q, kind: 'DC' });
    }
    async payload(c, row) {
        const docDate = (0, sales_doc_utils_1.isoDate)(row.sdcDcDate) ?? (0, sales_doc_utils_1.isoToday)();
        const [items, transport, rights, gdrId, eway] = await Promise.all([
            this.store.loadItems(c, row),
            this.store.loadTransport(c, row),
            this.salesContext.rights(exports.DC_SPEC.menuId, c),
            this.register.registerIdOf(c, row.sdcId, row.sdcAccYear),
            this.ewayOf(c, row, docDate),
        ]);
        const disposal = dcDisposalOf(items);
        const ageing = await (0, dc_common_1.dcAgeing)(this.salesContext, this.statutory, {
            companyId: row.sdcCompanyId,
            branchId: row.sdcBranchId,
            purpose: row.sdcPurpose,
            docDate,
            status: row.sdcStatus,
            today: (0, sales_doc_utils_1.isoToday)(),
            open: disposal.open,
        });
        const nameOf = await (0, dc_common_1.dcLineNames)(c, items.map((i) => ({
            itemId: i.sdiItemId,
            itemUnitId: i.sdiItemUnitId,
            godownId: i.sdiGodownId,
            lotId: i.sdiLotId,
        })));
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
        locks.editable.purpose =
            row.sdcStatus === 'POSTED' &&
                !locks.irnLive &&
                !locks.ewbLive &&
                !disposal.billed &&
                (!disposal.returned ||
                    (disposal.open && (row.sdcPurpose ?? 'SUPPLY').toUpperCase() !== 'SUPPLY'));
        return {
            ...this.store.plain(row),
            items: await (0, batch_detail_helper_1.withBatchDetails)(c, row.sdcCompanyId, 'sdi', items.map((i) => ({
                ...this.store.plain(i),
                ...nameOf({
                    itemId: i.sdiItemId,
                    itemUnitId: i.sdiItemUnitId,
                    godownId: i.sdiGodownId,
                    lotId: i.sdiLotId,
                }),
            }))),
            charges: [],
            transport,
            posting,
            locks,
            rights,
            ageDays: ageing.ageDays,
            ageLevel: ageing.ageLevel,
            eway: {
                ...eway,
                transportMissing: eway.needed &&
                    (0, dc_common_1.dcPartBMissing)(transport, row),
            },
        };
    }
    async ewayOf(c, row, docDate) {
        const [company] = await c.$queryRaw `
      SELECT comp_state_code FROM public.companys WHERE comp_id = ${row.sdcCompanyId}::uuid`;
        return (0, dc_common_1.dcEwayVerdict)(c, this.statutory, {
            companyId: row.sdcCompanyId,
            companyStateCode: company?.comp_state_code,
            posStateCode: row.sdcPosStcd,
            value: row.sdcDcAmt,
            docDate,
        });
    }
    async validate(dto) {
        const ctx = await this.salesContext.resolve({ companyId: dto.sdcCompanyId, branchId: dto.sdcBranchId, deviceId: dto.sdcDeviceId }, exports.DC_SPEC.menuId);
        const existing = await this.existingKeys(this.prisma, dto.sdcId);
        const amending = existing?.status === 'POSTED';
        const right = amending ? 'amend' : existing ? 'edit' : 'create';
        if (!ctx.rights[right]) {
            (0, sales_errors_1.throwSalesRight)(`This user may not ${right} on this menu`, RIGHT_CODE[right]);
        }
        const g = (0, posting_types_1.createGuardContext)({
            overrides: dto.overrides ?? [],
            canOverride: ctx.rights.override,
            throwOnRefusal: false,
            dryRun: true,
        });
        if (Array.isArray(dto.charges) && dto.charges.length > 0) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_CHARGES_NOT_ALLOWED, 'A challan carries no charges: put freight and other charges on the Sales Bill', { field: 'charges' });
        }
        const row = this.draftRow(dto);
        const items = (dto.items ?? []).map((i, idx) => ({
            ...i,
            sdiLineNo: i.sdiLineNo ?? idx + 1,
        }));
        await (0, source_lines_1.resolveSourceLines)(this.prisma, items, source_lines_1.DC_SOURCE_KEYS, ['SALES_ORDER']);
        const band = dto.transport !== undefined
            ? { band: dto.transport ?? null }
            : dto.sdcId
                ? {}
                : { band: null };
        let eway;
        if (amending && existing) {
            eway = await this.amendPreview(existing, row, items, ctx, g, band);
        }
        else {
            ({ eway } = await this.prisma.$transaction((tx) => this.guards(tx, row, items, ctx, g, undefined, band), TX));
            await this.stockDryRun(row, items, ctx, g);
        }
        const c = this.prisma;
        const nameOf = await (0, dc_common_1.dcLineNames)(c, items.map((i) => ({
            itemId: i.sdiItemId,
            itemUnitId: i.sdiItemUnitId,
            godownId: i.sdiGodownId,
            lotId: i.sdiLotId,
        })));
        const totals = (0, dc_common_1.dcTotals)(row, items, (l) => (0, dc_common_1.dec)(nameOf({
            itemId: l.sdiItemId,
            itemUnitId: l.sdiItemUnitId,
            godownId: l.sdiGodownId,
            lotId: l.sdiLotId,
        }).unitKg));
        return {
            ok: g.refusals.length === 0,
            refusals: g.refusals,
            warnings: g.warnings,
            rights: ctx.rights,
            totals,
            load: await this.loadOf(c, dto.sdcVehicleId ?? null, (0, dc_common_1.dec)(totals.weightKg)),
            eway,
        };
    }
    async loadOf(c, vehicleId, weightKg) {
        if (!vehicleId) {
            return null;
        }
        const [v] = await c.$queryRaw `
      SELECT veh_capacity_kg AS cap FROM public.vehicle_master
       WHERE veh_id = ${vehicleId}::uuid AND veh_is_deleted = false`;
        const cap = v?.cap === null || v?.cap === undefined ? null : (0, dc_common_1.dec)(v.cap);
        return {
            capacityKg: cap === null ? null : cap.toFixed(3),
            weightKg: weightKg.toFixed(3),
            percent: cap !== null && cap.greaterThan(0)
                ? weightKg.dividedBy(cap).times(100).toDecimalPlaces(1).toFixed(1)
                : null,
        };
    }
    async amendPreview(keys, row, items, ctx, g, band) {
        let eway = null;
        const now = new Date();
        try {
            await this.prisma.$transaction(async (tx) => {
                await this.lockOrdersFirst(tx, keys, { header: row, lines: items });
                const stored = await this.store.lock(tx, keys);
                await (0, dc_common_1.lockDcLines)(tx, keys.id, keys.accYear);
                const prior = await this.store.loadItems(tx, stored);
                if (!ctx.settings.allowPostedAmend) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.AMEND_OFF, 'Amending a posted document is switched off (sales.allow_posted_amend)', { field: 'sdcId' });
                }
                const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
                if ((await (0, sales_guards_1.loadDeclaredLocks)(tx, gdrId)).ewbLive) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.EWB_LIVE, 'This challan has a live e-way bill and cannot be amended — cancel it and raise a fresh one', { field: 'sdcId' });
                }
                const storedDate = (0, sales_doc_utils_1.isoDate)(stored.sdcDcDate) ?? (0, sales_doc_utils_1.isoToday)();
                const sentDate = (0, sales_doc_utils_1.isoDate)(row.sdcDcDate) ?? (0, sales_doc_utils_1.isoToday)();
                if (storedDate !== sentDate &&
                    (await (0, sales_guards_1.loadDayClosed)(tx, keys.companyId, keys.branchId, storedDate))) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DAY_CLOSED, `The books for ${storedDate} are closed at this branch`, { field: 'sdcDcDate' });
                }
                const { billed, returned } = dcDisposalOf(prior);
                if (billed) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_BILLED, 'A bill has been raised against this challan — cancel the bill first', { field: 'sdcId' });
                }
                if (returned) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_RETURNED, 'Goods have been returned against this challan — cancel the DC return first', { field: 'sdcId' });
                }
                await this.stock.cancel(tx, {
                    docType: 'DELIVERY_CHALLAN',
                    docId: keys.id,
                    accYear: keys.accYear,
                    companyId: keys.companyId,
                    branchId: keys.branchId,
                    direction: 'OUT',
                    txnType: 'DC_ISSUE',
                }, ctx.actor, 'Amend preview (/validate)', now);
                await this.store.setStatus(tx, stored, 'DRAFT', { sdcPostedVoucherId: null }, ctx.actor, now);
                await this.syncOrders(tx, prior, ctx.actor, now);
                ({ eway } = await this.guards(tx, { ...row, sdcId: keys.id }, items, ctx, g, prior, band));
                await this.issueDryRun(tx, row, items, ctx, g, true);
                throw new DryRunRollback();
            }, TX);
        }
        catch (error) {
            if (!(error instanceof DryRunRollback)) {
                throw error;
            }
        }
        return eway;
    }
    async stockDryRun(row, items, ctx, g) {
        try {
            await this.prisma.$transaction(async (tx) => {
                await this.issueDryRun(tx, row, items, ctx, g, false);
                throw new DryRunRollback();
            }, TX);
        }
        catch (error) {
            if (!(error instanceof DryRunRollback)) {
                return;
            }
        }
    }
    async issueDryRun(tx, row, items, ctx, g, freshLineIds) {
        const moving = items.filter((i) => !i.sdiIsService &&
            i.sdiItemId &&
            i.sdiItemUnitId &&
            i.sdiGodownId &&
            (0, dc_common_1.dec)(i.sdiDcQty).plus((0, dc_common_1.dec)(i.sdiFreeQty)).greaterThan(0));
        if (moving.length === 0) {
            return;
        }
        const docId = (0, node_crypto_1.randomUUID)();
        try {
            await this.stock.post(tx, {
                docType: 'DELIVERY_CHALLAN',
                docId,
                accYear: row.sdcAccYear,
                companyId: row.sdcCompanyId,
                branchId: row.sdcBranchId,
                tenantId: row.sdcTenantId ?? null,
                deviceId: row.sdcDeviceId ?? null,
                sessionId: row.sdcSessionId ?? null,
                docDate: (0, sales_doc_utils_1.isoDate)(row.sdcDcDate) ?? (0, sales_doc_utils_1.isoToday)(),
                docDatetime: new Date(),
                refno: `VALIDATE-${docId.slice(0, 8)}`,
                revision: 1,
                partyId: row.sdcCustId ?? null,
                direction: 'OUT',
                txnType: 'DC_ISSUE',
                lines: moving.map((i) => this.stockLineOf(i, !freshLineIds && isUuid(i.sdiId) ? i.sdiId : (0, node_crypto_1.randomUUID)())),
            }, ctx.actor, new Date());
        }
        catch (error) {
            if (error instanceof common_1.HttpException) {
                const body = error.getResponse();
                const first = Array.isArray(body?.errors) ? body.errors[0] : undefined;
                (0, sales_guards_1.refuse)(g, first?.code ?? posting_types_1.SALES_ERROR_CODES.STOCK_NEGATIVE, first?.message ?? body?.message ?? 'Stock would go negative', { field: 'items' });
            }
        }
    }
    stockLineOf(i, lineId) {
        return {
            lineId,
            lineNo: i.sdiLineNo,
            itemId: i.sdiItemId,
            itemUnitId: i.sdiItemUnitId,
            godownId: i.sdiGodownId,
            lotId: i.sdiLotId ?? null,
            bucket: i.sdiBucket ?? null,
            qty: (0, sales_doc_utils_1.num)(i.sdiDcQty),
            freeQty: (0, sales_doc_utils_1.num)(i.sdiFreeQty),
            weightQty: i.sdiWeightQty === null || i.sdiWeightQty === undefined
                ? null
                : (0, sales_doc_utils_1.num)(i.sdiWeightQty),
            toBaseFactor: (0, sales_doc_utils_1.num)(i.sdiToBaseFactor) || null,
            batchNo: i.sdiBatchNo ?? null,
            batchDate: (0, sales_doc_utils_1.isoDate)(i.sdiBatchDate ?? null),
            expiryDate: (0, sales_doc_utils_1.isoDate)(i.sdiExpiryDate ?? null),
            serialNo: i.sdiSerialNo ?? null,
            mrp: i.sdiMaxPrice === null || i.sdiMaxPrice === undefined
                ? null
                : (0, sales_doc_utils_1.num)(i.sdiMaxPrice),
            rate: (0, sales_doc_utils_1.num)(i.sdiRate),
            taxPerc: (0, sales_doc_utils_1.num)(i.sdiTaxPerc),
        };
    }
    async post(dto) {
        let fire = null;
        await this.prisma.$transaction(async (tx) => {
            await this.lockOrdersFirst(tx, this.keys(dto));
            const row = await this.store.lock(tx, this.keys(dto));
            fire = await this.postDraftInTx(tx, row, dto.overrides ?? [], new Date());
        }, TX);
        this.afterPost(fire);
        return this.get(this.keys(dto));
    }
    async postDraftInTx(tx, row, overrides, now) {
        if (row.sdcStatus === 'POSTED') {
            return null;
        }
        if (row.sdcStatus === 'CANCELLED') {
            (0, sales_errors_1.throwSalesLocked)('This challan is CANCELLED', posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED, 'sdcId');
        }
        const ctx = await this.ctxOf(tx, row);
        if (!ctx.rights.post) {
            (0, sales_errors_1.throwSalesRight)('This user may not post on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_POST);
        }
        const items = await this.store.loadItems(tx, row);
        const { changed } = await (0, source_lines_1.resolveSourceLines)(tx, items, source_lines_1.DC_SOURCE_KEYS, ['SALES_ORDER']);
        for (const idx of changed) {
            const i = items[idx];
            await this.store.updateItem(tx, i, {
                sdiSrcItemId: i.sdiSrcItemId,
                sdiSrcDocId: i.sdiSrcDocId,
                sdiSrcLineNo: i.sdiSrcLineNo,
                sdiSrcDocAccYear: i.sdiSrcDocAccYear,
            });
        }
        const g = (0, posting_types_1.createGuardContext)({
            overrides,
            canOverride: ctx.rights.override,
            throwOnRefusal: false,
        });
        await this.guards(tx, row, items, ctx, g);
        if (g.refusals.length > 0) {
            (0, sales_errors_1.throwSalesRefusals)('Challan cannot be posted', g.refusals);
        }
        return this.postCore(tx, row, items, ctx, now, 'DRAFT');
    }
    afterPost(fire) {
        if (fire) {
            this.gst.enqueueAfterPost({ gdrId: fire.gdrId, einvoice: false, ewaybill: fire.ewaybill });
        }
    }
    async ctxOf(tx, row) {
        return this.salesContext.resolve({
            companyId: row.sdcCompanyId,
            branchId: row.sdcBranchId,
            deviceId: row.sdcDeviceId,
        }, exports.DC_SPEC.menuId, tx);
    }
    async guards(tx, row, items, ctx, g, priorItems, opts = {}) {
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
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_CUSTOMER_REQUIRED, 'A challan must name a customer', {
                field: 'sdcCustId',
            });
        }
        if (items.length === 0) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_NO_LINES, 'A challan with no lines cannot be posted', {
                field: 'items',
            });
        }
        if (row.sdcId) {
            const [ch] = await tx.$queryRaw `
        SELECT count(*)::int AS n FROM public.txn_charge_detail
         WHERE cd_doc_type = 'DELIVERY_CHALLAN' AND cd_doc_id = ${row.sdcId}::uuid
           AND cd_is_deleted = false`;
            if ((ch?.n ?? 0) > 0) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_CHARGES_NOT_ALLOWED, 'This challan carries charges: remove them, they belong on the Sales Bill', { field: 'charges' });
            }
        }
        const [company] = await tx.$queryRaw `
      SELECT comp_dc_purposes, comp_state_code FROM public.companys WHERE comp_id = ${companyId}::uuid`;
        (0, dc_common_1.checkDcMoney)(g, row, items, (0, sales_doc_utils_1.supplyNatureOf)(company?.comp_state_code, row.sdcPosStcd));
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
        const heldOrderIds = [
            ...new Set([
                row.sdcSrcDocType === 'SALES_ORDER' ? row.sdcSrcDocId : null,
                ...items.map((i) => i.sdiSrcDocType === 'SALES_ORDER' ? i.sdiSrcDocId : null),
            ].filter((id) => !!id)),
        ];
        const held = (0, sales_guards_1.heldAmong)(await (0, sales_guards_1.lockSourceOrders)(tx, heldOrderIds, items
            .filter((i) => i.sdiSrcDocType === 'SALES_ORDER' && i.sdiSrcItemId)
            .map((i) => i.sdiSrcItemId)));
        (0, sales_guards_1.refuseHeldOrders)(g, priorItems
            ? await (0, sales_guards_1.heldOrdersDrawnMore)(tx, held, dcItemDraws(items), dcItemDraws(priorItems))
            : held);
        for (const [idx, i] of items.entries()) {
            if (i.sdiSrcDocType === 'SALES_ORDER' && !(0, dc_common_1.dcOrderLineOf)(i)) {
                const n = i.sdiLineNo ?? idx + 1;
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_LINE_OVER_ORDER, `Line ${n}: order ${String(i.sdiSrcDocRefno ?? i.sdiSrcDocId ?? '')} has no line ${String(i.sdiSrcLineNo ?? '')} to take`, { field: 'items', line: n });
            }
        }
        const orderLines = items.filter((i) => i.sdiSrcDocType === 'SALES_ORDER' && (0, dc_common_1.dcOrderLineOf)(i));
        if (orderLines.length > 0) {
            const rows = await tx.$queryRaw `
        SELECT soi_id, soi_pending_qty, soi_item_unit_id, soi_to_base_factor
          FROM sales.sale_order_item WHERE soi_id = ANY(${orderLines.map((l) => l.sdiSrcItemId)}::uuid[])`;
            const by = new Map(rows.map((r) => [r.soi_id, r]));
            const taken = new Map();
            for (const l of orderLines) {
                const k = l.sdiSrcItemId;
                const o = by.get(k);
                const qty = o ? (0, dc_common_1.dcQtyInOrderTerms)(l, o) : (0, dc_common_1.dec)(l.sdiDcQty);
                taken.set(k, (taken.get(k) ?? (0, dc_common_1.dec)(0)).plus(qty));
            }
            for (const [k, qty] of taken) {
                const o = by.get(k);
                const pending = o ? (0, dc_common_1.dec)(o.soi_pending_qty) : undefined;
                if (pending === undefined) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_LINE_OVER_ORDER, `Order line ${k} does not exist`, {
                        field: 'items',
                    });
                }
                else if (qty.greaterThan(pending)) {
                    (ctx.settings.allowBillOverOrderQty ? sales_guards_1.warn : sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_LINE_OVER_ORDER, `Order line has ${pending.toString()} pending; this challan takes ${qty.toString()}`, { field: 'items' });
                }
            }
        }
        (0, dc_common_1.checkDcFreeLines)(g, items, await (0, dc_common_1.orderLineFreeOf)(tx, items.map((i) => (0, dc_common_1.dcOrderLineOf)(i)).filter((id) => !!id)));
        const verdict = await (0, dc_common_1.dcEwayVerdict)(tx, this.statutory, {
            companyId,
            companyStateCode: company?.comp_state_code,
            posStateCode: row.sdcPosStcd,
            value: row.sdcDcAmt,
            docDate,
        });
        const inter = verdict.supplyNature === 'INTER_STATE';
        let transportMissing = false;
        if (verdict.needed && (row.sdcId || opts.band !== undefined)) {
            const band = opts.band !== undefined
                ? opts.band
                : (await this.store.loadTransport(tx, row));
            if ((0, dc_common_1.dcPartBMissing)(band, row)) {
                transportMissing = true;
                (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.EWAY_TRANSPORT_MISSING, `An e-way bill is required for this consignment (${(0, sales_doc_utils_1.num)(row.sdcDcAmt)} ${inter ? 'inter' : 'intra'}-state) and there is neither a transporter / LR nor a vehicle number`, { field: 'transport' });
            }
        }
        return { eway: { ...verdict, transportMissing } };
    }
    async postCore(tx, row, items, ctx, now, fromStatus, revisionNo) {
        const actor = ctx.actor;
        const keys = this.store.keysOf(row);
        const refno = row.sdcDcRefno ?? keys.id;
        const docDate = (0, sales_doc_utils_1.isoDate)(row.sdcDcDate) ?? (0, sales_doc_utils_1.isoToday)();
        const moving = items.filter((i) => !i.sdiIsService &&
            (0, dc_common_1.dec)(i.sdiDcQty).plus((0, dc_common_1.dec)(i.sdiFreeQty)).greaterThan(0));
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
            lines: moving.map((i) => this.stockLineOf(i, i.sdiId)),
        }, actor, now);
        for (const i of moving) {
            await this.store.updateItem(tx, i, {
                sdiCostPrice: dcUnitCostOf(i, stock),
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
        void voucherLastNo;
        if (row.sdcCustId) {
            const registerNo = await (0, dc_common_1.nextRegisterVoucherNo)(tx, {
                companyId: keys.companyId,
                branchId: keys.branchId,
                accYear: keys.accYear,
                voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.DELIVERY_CHALLAN,
            });
            const reg = await this.register.write(tx, this.registerDoc(row, items, voucherId, registerNo, nature, actor), {
                interState: nature === 'INTER',
                ewayStateCode: (0, dc_common_1.dcEwayStateOf)(company?.comp_state_code, row.sdcPosStcd)
                    .stateCode,
            });
            gdrId = reg.gdrId;
            ewaybill = reg.ewaybillApplicable;
        }
        await this.store.setStatus(tx, row, 'POSTED', {
            sdcPostedVoucherId: voucherId,
            sdcTotalCost: new client_1.Prisma.Decimal(stock.cogsTotal.toFixed(2)),
            ...dcHeaderSplitOf(items),
            ...(revisionNo ? { sdcRevisionNo: revisionNo } : {}),
        }, actor, now);
        await this.fulfilment.recompute(tx, [{ dcId: keys.id, accYear: keys.accYear }], actor, now);
        await this.syncOrders(tx, items, actor, now);
        await this.rederiveReservations(tx, items, actor, now);
        await this.store.trail(tx, row, txn_status_log_helper_1.TxnStatusEvent.POSTED, fromStatus, 'POSTED', actor, now, revisionNo ? `Re-posted as revision ${revisionNo}` : null);
        await this.store.auditChange(tx, row, 'approve', { sdcStatus: fromStatus }, { sdcStatus: 'POSTED', sdcPostedVoucherId: voucherId, gdrId, cogs }, actor, 'Challan posted');
        return { gdrId, ewaybill };
    }
    registerDoc(row, items, voucherId, voucherNo, nature, actor) {
        const d = (k) => (0, sales_doc_utils_1.num)(row[k]);
        const sumOf = (k) => (0, sales_doc_utils_1.num)(items.reduce((a, i) => a.plus((0, dc_common_1.dec)(i[k])), (0, dc_common_1.dec)(0)));
        const lines = items.map((i) => {
            const n = (k) => (0, sales_doc_utils_1.num)(i[k]);
            const tax = n('sdiCgstAmt') + n('sdiSgstAmt') + n('sdiIgstAmt') + n('sdiCessAmt');
            const gst = {
                totalTaxRate: n('sdiTaxPerc'),
                cgstRate: n('sdiCgstPerc'),
                sgstRate: n('sdiSgstPerc'),
                igstRate: n('sdiIgstPerc'),
                cessRate: n('sdiCessPerc'),
                cgstAmount: n('sdiCgstAmt'),
                sgstAmount: n('sdiSgstAmt'),
                igstAmount: n('sdiIgstAmt'),
                cessAmount: n('sdiCessAmt'),
            };
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
                ...gst,
                otherAmount: 0,
                totalValue: (0, sales_doc_utils_1.round2)(n('sdiTaxableAmt') + tax),
                billValue: n('sdiNetAmt') || (0, sales_doc_utils_1.round2)(n('sdiTaxableAmt') + tax),
                taxability: (0, dc_common_1.registerLineTaxability)(gst),
                supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
            };
        });
        return {
            companyId: row.sdcCompanyId,
            branchId: row.sdcBranchId,
            accYear: row.sdcAccYear,
            voucherId: voucherId ?? row.sdcId,
            voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.DELIVERY_CHALLAN,
            voucherNo: voucherNo ?? (0, sales_doc_utils_1.numericTail)(row.sdcDcRefno, BigInt(0)),
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
            taxability: (0, dc_common_1.registerDocTaxability)(lines),
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
            cgstValue: sumOf('sdiCgstAmt'),
            sgstValue: sumOf('sdiSgstAmt'),
            igstValue: sumOf('sdiIgstAmt'),
            cessValue: sumOf('sdiCessAmt'),
            stateCessValue: 0,
            tcsValue: 0,
            otherCharge: 0,
            roundOff: d('sdcRoundOff'),
            billValue: d('sdcDcAmt'),
            remarks: typeof row.sdcPurpose === 'string' ? row.sdcPurpose : null,
            createdBy: actor,
            lines,
        };
    }
    async cancel(dto) {
        const now = new Date();
        const out = await this.prisma.$transaction(async (tx) => {
            await this.lockOrdersFirst(tx, this.keys(dto));
            const row = await this.store.lock(tx, this.keys(dto));
            await (0, dc_common_1.lockDcLines)(tx, row.sdcId, row.sdcAccYear);
            if (row.sdcStatus === 'CANCELLED') {
                return {
                    reversalVoucherRefno: null,
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
            await lockDcOrders(tx, [row], items);
            const reversal = await this.unwind(tx, row, ctx.actor, dto.reason, now);
            await this.store.setStatus(tx, row, 'CANCELLED', {}, ctx.actor, now);
            await this.fulfilment.recompute(tx, [{ dcId: row.sdcId, accYear: row.sdcAccYear }], ctx.actor, now);
            await this.syncOrders(tx, items, ctx.actor, now, `Reopened: challan ${row.sdcDcRefno ?? row.sdcId} cancelled`);
            await this.rederiveReservations(tx, items, ctx.actor, now);
            await this.store.trail(tx, row, txn_status_log_helper_1.TxnStatusEvent.CANCELLED, 'POSTED', 'CANCELLED', ctx.actor, now, dto.reason);
            await this.store.auditChange(tx, row, 'cancel', { sdcStatus: 'POSTED' }, { sdcStatus: 'CANCELLED' }, ctx.actor, `Challan cancelled: ${dto.reason}`);
            return { reversalVoucherRefno: reversal, cancelledOn: now.toISOString() };
        }, TX);
        return { ...(await this.get(this.keys(dto))), ...out };
    }
    async amend(dto) {
        (0, dc_common_1.assertNoCharges)(dto.charges);
        const now = new Date();
        let fire = null;
        await this.prisma.$transaction(async (tx) => {
            const keys = {
                id: dto.sdcId,
                companyId: dto.sdcCompanyId,
                branchId: dto.sdcBranchId,
                accYear: dto.sdcAccYear,
            };
            await (0, source_lines_1.resolveSourceLines)(tx, dto.items, source_lines_1.DC_SOURCE_KEYS, ['SALES_ORDER']);
            await this.lockOrdersFirst(tx, keys, {
                header: dto,
                lines: (dto.items ?? []),
            });
            const row = await this.store.lock(tx, keys);
            await (0, dc_common_1.lockDcLines)(tx, keys.id, keys.accYear);
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
            const before = await this.documentOf(tx, keys);
            await lockDcOrders(tx, [row, dto], [...items, ...(dto.items ?? [])]);
            await this.unwind(tx, row, ctx.actor, `Amended: ${dto.editRemark}`, now, 'amend');
            const draft = await this.store.setStatus(tx, row, 'DRAFT', { sdcPostedVoucherId: null }, ctx.actor, now);
            await this.syncOrders(tx, items, ctx.actor, now, `Reopened: challan ${row.sdcDcRefno ?? row.sdcId} amended`);
            await this.store.trail(tx, draft, txn_status_log_helper_1.TxnStatusEvent.AMENDED, 'POSTED', 'DRAFT', ctx.actor, now, dto.editRemark);
            const { baseRevision: _b, editRemark: _e, overrides: _o, ...saveDto } = dto;
            void _b;
            void _e;
            void _o;
            await this.freeFromOrders(tx, saveDto, false);
            (0, dc_common_1.applyDcLineLevels)(saveDto);
            const saved = await this.store.saveDraft(tx, { ...this.draftRow(saveDto), sdcId: keys.id }, ctx.actor, now, { revision: true, afterWrite: this.headerSplitHook(tx, ctx.actor, now) });
            const newItems = await this.store.loadItems(tx, saved);
            const g = (0, posting_types_1.createGuardContext)({
                overrides: dto.overrides ?? [],
                canOverride: ctx.rights.override,
                throwOnRefusal: false,
            });
            await this.guards(tx, saved, newItems, ctx, g, items);
            if (g.refusals.length > 0) {
                (0, sales_errors_1.throwSalesRefusals)('Challan cannot be amended', g.refusals);
            }
            fire = await this.postCore(tx, saved, newItems, ctx, now, 'DRAFT', row.sdcRevisionNo + 1);
            await this.rederiveReservations(tx, items, ctx.actor, now);
            await this.writeRevision(tx, keys, before, ctx.actor, `Challan amended to revision ${row.sdcRevisionNo + 1}: ${dto.editRemark}`);
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
        if (items.some((i) => (0, dc_common_1.dec)(i.sdiBilledQty).greaterThan(0))) {
            (0, sales_errors_1.throwSalesLocked)('A bill has been raised against this challan — cancel the bill first', posting_types_1.SALES_ERROR_CODES.DC_BILLED, 'sdcId');
        }
        if (items.some((i) => (0, dc_common_1.dec)(i.sdiReturnedQty).greaterThan(0))) {
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
    async unwind(tx, row, actor, reason, now, mode = 'cancel') {
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
            if (mode === 'amend') {
                await this.register.retire(tx, gdrId, keys.accYear, actor);
            }
            else {
                await this.register.cancel(tx, gdrId, keys.accYear, reason, actor);
            }
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
            if (!ctx.rights.edit) {
                (0, sales_errors_1.throwSalesRight)('This user may not edit on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_EDIT);
            }
            const gdrId = await this.register.registerIdOf(tx, row.sdcId, row.sdcAccYear);
            await (0, sales_guards_1.assertBandWritable)(tx, gdrId);
            await (0, dc_common_1.lockDcLines)(tx, row.sdcId, row.sdcAccYear);
            const items = await this.store.loadItems(tx, row);
            const { billed, returned, open } = dcDisposalOf(items);
            if (billed) {
                (0, sales_errors_1.throwSalesLocked)('This challan has been billed against — its purpose decided what that bill became', posting_types_1.SALES_ERROR_CODES.DC_BILLED, 'purpose');
            }
            if (returned && !open) {
                (0, sales_errors_1.throwSalesLocked)('Everything on this challan has come back: nothing is left to convert', posting_types_1.SALES_ERROR_CODES.DC_RETURNED, 'purpose', { rule: 'NOTHING_OPEN' });
            }
            if (returned && dto.purpose !== 'SUPPLY') {
                (0, sales_errors_1.throwSalesLocked)(`Goods have come back against this challan: only what is left on it converts, and only to SUPPLY (not ${dto.purpose})`, posting_types_1.SALES_ERROR_CODES.DC_RETURNED, 'purpose');
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
        await this.prisma.$transaction(async (tx) => {
            await this.assertRight('edit', tx);
            const row = await this.store.lock(tx, this.keys(dto));
            if (row.sdcStatus === 'CANCELLED') {
                (0, sales_errors_1.throwSalesLocked)('This challan is CANCELLED', posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED, 'sdcId');
            }
            const actor = this.salesContext.actor();
            const gdrId = await this.register.registerIdOf(tx, row.sdcId, row.sdcAccYear);
            await this.transportBand.write(tx, {
                docType: 'DELIVERY_CHALLAN',
                docId: row.sdcId,
                accYear: row.sdcAccYear,
                companyId: row.sdcCompanyId,
                branchId: row.sdcBranchId,
                tenantId: row.sdcTenantId,
                docRefno: row.sdcDcRefno,
            }, dto.transport, actor, { gdrId, now });
            await this.store.trail(tx, row, 'TRANSPORT_EDITED', row.sdcStatus, row.sdcStatus, actor, now, null);
        }, TX);
        return this.get(this.keys(dto));
    }
};
exports.DeliveryChallanService = DeliveryChallanService;
exports.DeliveryChallanService = DeliveryChallanService = __decorate([
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
        bill_read_service_1.BillReadService,
        audit_log_service_1.AuditLogService,
        charge_detail_service_1.ChargeDetailService,
        tender_detail_service_1.TenderDetailService,
        sale_order_service_1.SaleOrderService,
        stock_reservation_service_1.StockReservationService])
], DeliveryChallanService);
function dcUnitCostOf(i, stock) {
    const id = i.sdiId;
    const factor = (0, dc_common_1.dec)(i.sdiToBaseFactor);
    const perBase = stock.rateByLine?.get(id);
    if (perBase !== undefined) {
        return perBase
            .times(factor.isZero() ? 1 : factor)
            .toDecimalPlaces(4, client_1.Prisma.Decimal.ROUND_HALF_UP);
    }
    const units = (0, dc_common_1.dec)(i.sdiDcQty).plus((0, dc_common_1.dec)(i.sdiFreeQty));
    return units.isZero()
        ? new client_1.Prisma.Decimal(0)
        : new client_1.Prisma.Decimal(stock.costByLine.get(id) ?? 0)
            .dividedBy(units)
            .toDecimalPlaces(4, client_1.Prisma.Decimal.ROUND_HALF_UP);
}
function dcAuditRecordOf(doc) {
    const { locks: _locks, rights: _rights, ageDays: _a, ageLevel: _l, ...record } = doc;
    void _locks;
    void _rights;
    void _a;
    void _l;
    const items = Array.isArray(record.items) ? record.items : [];
    return {
        ...record,
        items: items.map((i) => {
            const { itemName: _i, itemCode: _c, unitName: _u, godownName: _g, lotNo: _n, unitKg: _k, ...line } = i;
            void _i;
            void _c;
            void _u;
            void _g;
            void _n;
            void _k;
            return line;
        }),
    };
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) {
    return !!v && UUID.test(v);
}
function dcDisposalOf(items) {
    let billed = false;
    let returned = false;
    let open = false;
    for (const i of items) {
        const b = (0, dc_common_1.dec)(i.sdiBilledQty);
        const r = (0, dc_common_1.dec)(i.sdiReturnedQty);
        billed = billed || b.greaterThan(0);
        returned = returned || r.greaterThan(0);
        open = open || (0, dc_common_1.dec)(i.sdiDcQty).minus(b).minus(r).greaterThan(0);
    }
    return { billed, returned, open };
}
function dcHeaderSplitOf(items) {
    const out = {};
    for (const [h, l] of DC_HEADER_SPLIT) {
        out[h] = items.reduce((a, i) => a.plus((0, dc_common_1.dec)(i[l])), (0, dc_common_1.dec)(0)).toFixed(2);
    }
    return out;
}
function dcItemDraws(items) {
    return items
        .filter((i) => i.sdiSrcDocType === 'SALES_ORDER')
        .map((i) => {
        const factor = new client_1.Prisma.Decimal(i.sdiToBaseFactor ?? 0);
        return {
            soId: i.sdiSrcDocId ?? null,
            soiId: i.sdiSrcItemId ?? null,
            baseQty: new client_1.Prisma.Decimal(i.sdiDcQty ?? 0).times(factor.isZero() ? 1 : factor),
        };
    });
}
async function lockDcOrders(tx, headers, lines) {
    const ids = new Set();
    const lineIds = new Set();
    for (const h of headers) {
        if (h.sdcSrcDocType === 'SALES_ORDER' && h.sdcSrcDocId) {
            ids.add(h.sdcSrcDocId);
        }
    }
    for (const l of lines) {
        if (l.sdiSrcDocType !== 'SALES_ORDER') {
            continue;
        }
        if (l.sdiSrcDocId) {
            ids.add(l.sdiSrcDocId);
        }
        if (l.sdiSrcItemId) {
            lineIds.add(l.sdiSrcItemId);
        }
    }
    await (0, sales_guards_1.lockSourceOrders)(tx, [...ids], [...lineIds]);
}
//# sourceMappingURL=delivery-challan.service.js.map