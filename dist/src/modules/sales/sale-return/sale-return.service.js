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
var SaleReturnService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleReturnService = exports.SR_SPEC = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const batch_detail_helper_1 = require("../../stocks/batch-detail/batch-detail.helper");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const charge_detail_service_1 = require("../../master/charge-detail/charge-detail.service");
const charge_enum_1 = require("../../master/charge-master/types/charge-enum");
const tender_detail_service_1 = require("../../accountsModule/tenderDetail/tender-detail.service");
const tender_detail_api_types_1 = require("../../accountsModule/tenderDetail/types/tender-detail-api.types");
const bill_adjustment_helper_1 = require("../../../common/posting/bill-adjustment.helper");
const doc_register_service_1 = require("../../../common/posting/doc-register.service");
const gst_gateway_service_1 = require("../posting/gst-gateway.service");
const loyalty_ledger_service_1 = require("../posting/loyalty-ledger.service");
const promotion_usage_service_1 = require("../posting/promotion-usage.service");
const sales_context_service_1 = require("../posting/sales-context.service");
const sales_doc_blocks_service_1 = require("../posting/sales-doc-blocks.service");
const sales_doc_store_1 = require("../posting/sales-doc-store");
const till_session_service_1 = require("../../till/services/till-session.service");
const till_approval_service_1 = require("../../till/services/till-approval.service");
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
const sale_return_bill_reader_1 = require("./sale-return-bill-reader");
const sale_return_money_1 = require("./sale-return-money");
const sale_return_numbering_1 = require("./sale-return-numbering");
const delivery_pending_service_1 = require("../delivery/core/delivery-pending.service");
const delivery_status_service_1 = require("../delivery/core/delivery-status.service");
const delivery_constants_1 = require("../delivery/core/delivery.constants");
const sale_return_delivery_1 = require("./sale-return-delivery");
const sale_return_preview_1 = require("./sale-return-preview");
const sale_return_register_1 = require("./sale-return-register");
const sale_return_money_2 = require("./sale-return-money");
const sale_return_settlement_1 = require("./sale-return-settlement");
const save_sale_return_dto_1 = require("./dto/save-sale-return.dto");
const save_sale_return_item_dto_1 = require("./dto/save-sale-return-item.dto");
exports.SR_SPEC = {
    kind: 'SALE_RETURN',
    headerDelegate: 'saleReturn',
    itemDelegate: 'saleReturnItem',
    p: 'sr',
    ip: 'sri',
    itemFk: 'sriReturnId',
    refnoField: 'srReturnRefno',
    slnoField: 'srReturnSlno',
    dateField: 'srReturnDate',
    datetimeField: 'srReturnDatetime',
    custField: 'srCustId',
    custNameField: 'srCustName',
    revisionField: 'srRevisionNo',
    voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.SALE_RETURN,
    menuId: sales_doc_utils_1.SALES_MENU_ID.SALE_RETURN,
    statusDocType: txn_status_log_helper_1.TxnStatusDocType.SALE_RETURN,
    chargeDocType: charge_enum_1.ChargeDocType.SALE_RETURN,
    tenderDocType: tender_detail_api_types_1.TenderSrcDocType.SALE_RETURN,
    tenderDrCr: tender_detail_api_types_1.TenderDrCr.CR,
    transportDocType: 'SALE_RETURN',
    transportDirection: 'INWARD',
    tableName: 'sale_return',
    itemTableName: 'sale_return_item',
    screenName: 'Sale Return',
    optionalFields: save_sale_return_dto_1.SR_OPTIONAL_FIELDS,
    dateFields: save_sale_return_dto_1.SR_DATE_FIELDS,
    serverOwned: save_sale_return_dto_1.SR_SERVER_OWNED,
    itemOptionalFields: save_sale_return_item_dto_1.SRI_OPTIONAL_FIELDS,
    itemDateFields: save_sale_return_item_dto_1.SRI_DATE_FIELDS,
    itemRequired: ['sriItemId', 'sriItemUnitId', 'sriGodownId'],
    headerRequired: ['srCounterId'],
    itemDefaults: (h) => ({ sriPriceLevel: h.srPriceLevel ?? 1 }),
    headerWhereUnique: 'srId_srAccYear',
    itemWhereUnique: 'sriId_sriAccYear',
};
const TX = { timeout: 60_000, maxWait: 10_000 };
const MONEY_SETTING_KEYS = [
    'sales.freight_calc_type',
    'sales.loading_calc_type',
    'sales.return_expired_lot_days',
    'sales.return_settle_default',
    'accounts.receipt_bill_sort',
];
const RIGHT_CODES = {
    view: posting_types_1.SALES_ERROR_CODES.RIGHT_VIEW,
    create: posting_types_1.SALES_ERROR_CODES.RIGHT_CREATE,
    edit: posting_types_1.SALES_ERROR_CODES.RIGHT_EDIT,
    delete: posting_types_1.SALES_ERROR_CODES.RIGHT_DELETE,
};
function calcOf(saved, ms) {
    return saved
        ? {
            freight: saved.freight ?? ms.freightCalcType,
            loading: saved.loading ?? ms.loadingCalcType,
        }
        : undefined;
}
let SaleReturnService = SaleReturnService_1 = class SaleReturnService {
    prisma;
    salesContext;
    statutory;
    legs;
    register;
    stock;
    blocks;
    transportBand;
    loyalty;
    promo;
    gst;
    audit;
    till;
    approvals;
    deliveryPending;
    deliveryStatus;
    store;
    reader = new sale_return_bill_reader_1.SaleReturnBillReader();
    chargeDetail;
    tenderDetail;
    constructor(prisma, salesContext, statutory, legs, register, stock, blocks, transportBand, loyalty, promo, gst, audit, charges, tenders, till, approvals, deliveryPending, deliveryStatus) {
        this.prisma = prisma;
        this.salesContext = salesContext;
        this.statutory = statutory;
        this.legs = legs;
        this.register = register;
        this.stock = stock;
        this.blocks = blocks;
        this.transportBand = transportBand;
        this.loyalty = loyalty;
        this.promo = promo;
        this.gst = gst;
        this.audit = audit;
        this.till = till;
        this.approvals = approvals;
        this.deliveryPending = deliveryPending;
        this.deliveryStatus = deliveryStatus;
        this.store = new sales_doc_store_1.SalesDocStore(exports.SR_SPEC, audit, charges, tenders, transportBand);
        this.chargeDetail = charges;
        this.tenderDetail = tenders;
    }
    keys(dto) {
        return {
            id: dto.srId,
            companyId: dto.srCompanyId,
            branchId: dto.srBranchId,
            accYear: dto.srAccYear,
        };
    }
    async assertRight(right, client) {
        const rights = await this.salesContext.rights(exports.SR_SPEC.menuId, client);
        if (!rights[right]) {
            (0, sales_errors_1.throwSalesRight)(`This user may not ${right} on this menu`, RIGHT_CODES[right]);
        }
        return rights;
    }
    async moneySettings(companyId, branchId, deviceId, settings) {
        const [s, values] = await Promise.all([
            settings
                ? Promise.resolve(settings)
                : this.salesContext.settings(companyId, branchId, deviceId),
            this.salesContext.values(companyId, branchId, deviceId, MONEY_SETTING_KEYS),
        ]);
        const days = Number(values['sales.return_expired_lot_days'] ?? 0);
        return {
            settings: s,
            freightCalcType: values['sales.freight_calc_type'] ?? null,
            loadingCalcType: values['sales.loading_calc_type'] ?? null,
            expiredLotDays: Number.isFinite(days) && days > 0 ? Math.trunc(days) : 0,
            settleDefault: values['sales.return_settle_default'] ?? null,
            billSort: values['accounts.receipt_bill_sort'] ?? null,
        };
    }
    async moneyOf(tx, header, items, chargeAsks, ms, calc) {
        return (0, sale_return_preview_1.buildReturnMoney)(this.reader, tx, {
            srId: header.srId ?? null,
            companyId: header.srCompanyId,
            branchId: header.srBranchId,
            custId: header.srCustId ?? null,
            returnDate: (0, sales_doc_utils_1.isoDate)(header.srReturnDate) ?? (0, sales_doc_utils_1.isoToday)(),
            againstBill: header.srIsAgainstBill !== false && !!header.srBillId,
            billId: header.srBillId ?? null,
            billAccYear: (header.srBillAccYear ?? null)?.trim() ?? null,
            priceLevel: header.srPriceLevel ?? null,
            posStcd: header.srPosStcd ?? null,
            reasonId: header.srReasonId ?? null,
            items,
            chargeAsks,
            settings: {
                returnWindowDays: ms.settings.returnWindowDays,
                roundOffStep: ms.settings.roundOffStep,
                freeReturnAllowed: ms.settings.freeReturnAllowed,
                freightCalcType: calc ? calc.freight : ms.freightCalcType,
                loadingCalcType: calc ? calc.loading : ms.loadingCalcType,
                expiredLotDays: ms.expiredLotDays,
            },
        });
    }
    async fillFromBill(tx, body) {
        if (body.srIsAgainstBill === false || !body.srBillId || !body.srBillAccYear) {
            await this.fillFromCustomer(tx, body);
            return;
        }
        const bill = await this.reader.billHeader(tx, body.srBillId, body.srBillAccYear.trim());
        if (!bill) {
            return;
        }
        body.srIsAgainstBill = true;
        body.srBillRefno = body.srBillRefno ?? bill.refno;
        body.srBillDate = body.srBillDate ?? bill.date;
        body.srCustId = bill.custId ?? body.srCustId;
        body.srCustName = body.srCustName ?? bill.custName;
        body.srBillMode = bill.billMode ?? body.srBillMode;
        if (body.srAgentId === undefined || body.srAgentId === null) {
            body.srAgentId = bill.agentId;
        }
        for (const [k, v] of [
            ['srCustAddr', bill.custAddr],
            ['srCustPlace', bill.custPlace],
            ['srCustPin', bill.custPin],
            ['srCustPhone', bill.custPhone],
            ['srCustGstin', bill.custGstin],
            ['srCustGstType', bill.custGstType],
            ['srCustStcd', bill.custStcd],
            ['srPosStcd', bill.posStcd],
            ['srStateName', bill.stateName],
            ['srPriceLevel', bill.priceLevel],
        ]) {
            if (body[k] === undefined || body[k] === null) {
                body[k] = v;
            }
        }
    }
    async fillFromCustomer(tx, body) {
        const custId = body.srCustId;
        if (!custId || !isUuid(custId)) {
            return;
        }
        const [cus] = await tx.$queryRaw `
      SELECT c.cus_name, c.cus_addr1, c.cus_addr2, c.cus_addr3, c.cus_city, c.cus_pin, c.cus_phone1,
             c.cus_gst_no, c.cus_gst_type, c.cus_state_code, c.cus_state_name,
             EXISTS (SELECT 1 FROM fixed.state_codes s WHERE s.state_code = c.cus_state_code) AS pos_ok
        FROM sales.customers c
       WHERE c.cus_id = ${custId}::uuid`;
        if (!cus) {
            return;
        }
        const text = (v) => (v ?? '').trim() || null;
        const addr = [cus.cus_addr1, cus.cus_addr2, cus.cus_addr3]
            .map((a) => text(a))
            .filter((a) => !!a)
            .join(', ');
        const stcd = text(cus.cus_state_code);
        for (const [k, v] of [
            ['srCustName', text(cus.cus_name)],
            ['srCustAddr', addr || null],
            ['srCustPlace', text(cus.cus_city)],
            ['srCustPin', text(cus.cus_pin)],
            ['srCustPhone', text(cus.cus_phone1)],
            ['srCustGstin', text(cus.cus_gst_no)],
            ['srCustGstType', text(cus.cus_gst_type)],
            ['srCustStcd', stcd],
            ['srPosStcd', cus.pos_ok ? stcd : null],
            ['srStateName', text(cus.cus_state_name)],
        ]) {
            if (body[k] === undefined || body[k] === null || body[k] === '') {
                body[k] = v;
            }
        }
    }
    async applyMoneyToBody(tx, body, items, money) {
        Object.assign(body, (0, sale_return_preview_1.headerFieldsOf)(money), { srAgentCommAmt: agentCommOf(money) });
        const claim = (body.srReturnKind ?? 'RETURN').toUpperCase() === 'CLAIM';
        body.items = items.map((item, i) => ({
            ...item,
            ...(0, sale_return_preview_1.lineFieldsOf)(money.lines[i], item, body.srPriceLevel ?? null),
            ...claimFieldsOf(item, claim),
        }));
        body.charges = (0, sale_return_preview_1.chargeRowsOf)(money, await this.storedChargeIds(tx, body.srId));
    }
    async assertNoPendingApproval(tx, srId) {
        const pending = (await this.reader.approvalsOf(tx, srId)).find((a) => a.status === 'PENDING');
        if (pending) {
            (0, sales_errors_1.throwSalesLocked)(`This return waits for approval (${pending.event}, requested ${pending.requestedOn?.toISOString() ?? ''}): ` +
                'withdraw the request (/till/approvals/cancel) to change it', posting_types_1.SALES_ERROR_CODES.RETURN_APPROVAL_PENDING, 'srId', { status: pending.status });
        }
    }
    async savedFacts(c, srId) {
        if (!isUuid(srId)) {
            return null;
        }
        const [r] = await c.$queryRaw `
      SELECT sr_cust_id AS cust, sr_freight_calc_type AS f, sr_loading_calc_type AS l, sr_settle_mode AS m,
             sr_status AS s
        FROM sales.sale_return
       WHERE sr_id = ${srId}::uuid AND sr_is_deleted = false`;
        return r ? { custId: r.cust, freight: r.f, loading: r.l, settleMode: r.m, status: r.s ?? null } : null;
    }
    async storedChargeIds(tx, srId) {
        const rows = await this.reader.returnCharges(tx, srId);
        return new Map(rows.filter((r) => r.cdSrcCdId).map((r) => [r.cdSrcCdId, r.cdId]));
    }
    async saveBody(tx, dto, actor, now, ms, opts = {}) {
        const body = { ...dto };
        if (dto.srId && !opts.amend) {
            await this.assertNoPendingApproval(tx, dto.srId);
        }
        const savedRow = dto.srId ? await this.savedFacts(tx, dto.srId) : null;
        if ((body.srCustId === undefined || body.srCustId === null) && savedRow?.custId) {
            body.srCustId = savedRow.custId;
        }
        await this.fillFromBill(tx, body);
        if (savedRow?.custId &&
            typeof body.srCustId === 'string' &&
            body.srCustId !== '' &&
            body.srCustId !== savedRow.custId) {
            const viaBill = body.srIsAgainstBill !== false && !!body.srBillId;
            (0, sales_errors_1.throwSalesRefused)(viaBill
                ? `Bill ${body.srBillRefno ?? body.srBillId} belongs to another customer: a saved return keeps the customer it was saved with`
                : 'A saved return keeps the customer it was saved with: start a new return for another customer', posting_types_1.SALES_ERROR_CODES.RETURN_CUSTOMER_LOCKED, viaBill ? 'srBillId' : 'srCustId');
        }
        const stored = dto.srId && (dto.items === undefined || dto.charges === undefined)
            ? await this.store.find(tx, {
                id: dto.srId,
                companyId: dto.srCompanyId,
                branchId: dto.srBranchId,
                accYear: dto.srAccYear,
            })
            : null;
        const items = (dto.items !== undefined
            ? dto.items
            : stored
                ? await this.store.loadItems(tx, stored)
                : []).map((i, idx) => ({
            ...i,
            sriLineNo: i.sriLineNo ?? idx + 1,
        }));
        const asks = dto.charges !== undefined || !stored
            ? (0, sale_return_preview_1.chargeAsksOfBody)(dto.charges)
            : (0, sale_return_preview_1.chargeAsksOfStored)(await this.reader.returnCharges(tx, dto.srId));
        const money = await this.moneyOf(tx, { ...body, srReturnDate: body.srReturnDate ?? stored?.srReturnDate ?? (0, sales_doc_utils_1.isoToday)() }, items, asks, ms, calcOf(savedRow, ms));
        await this.applyMoneyToBody(tx, body, items, money);
        await this.applyNotTaken(tx, body, money, { amend: opts.amend === true });
        if (!dto.srId && (body.srSettleMode === undefined || body.srSettleMode === null)) {
            const due = money.bill ? await this.reader.billDue(tx, money.bill) : sale_return_money_1.ZERO;
            body.srSettleMode = (0, sale_return_settlement_1.defaultSettleMode)(ms.settleDefault, {
                adjustable: !!money.bill && money.bill.branchId === body.srBranchId,
                billDue: due,
            });
        }
        return this.store.saveDraft(tx, body, actor, now, {
            revision: true,
            beforeWrite: (data) => {
                if (data.srReturnDatetime === undefined) {
                    data.srReturnDatetime = now;
                }
            },
            numberFor: () => (0, sale_return_numbering_1.allocateSaleReturnNumber)(tx, {
                companyId: body.srCompanyId,
                branchId: body.srBranchId,
                accYear: body.srAccYear,
                deviceId: body.srDeviceId,
            }),
        });
    }
    async save(dto) {
        const keys = await this.prisma.$transaction((tx) => this.saveInTx(tx, dto), TX);
        return this.get(keys);
    }
    async saveInTx(tx, dto, opts = {}) {
        const actor = this.salesContext.actor();
        const now = new Date();
        const ms = await this.moneySettings(dto.srCompanyId, dto.srBranchId, dto.srDeviceId);
        const existing = dto.srId
            ? await tx.$queryRaw `
          SELECT sr_id, sr_company_id, sr_branch_id, sr_acc_year FROM sales.sale_return
           WHERE sr_id = ${dto.srId}::uuid AND sr_is_deleted = false`
            : [];
        if (opts.skipSaveRight !== true) {
            await this.assertRight(existing.length > 0 ? 'edit' : 'create', tx);
        }
        const before = existing[0]
            ? await this.documentOf(tx, {
                id: existing[0].sr_id,
                companyId: existing[0].sr_company_id,
                branchId: existing[0].sr_branch_id,
                accYear: existing[0].sr_acc_year.trim(),
            })
            : null;
        const saved = await this.saveBody(tx, dto, actor, now, ms);
        const keys = this.store.keysOf(saved);
        const fromPhone = opts.origin === 'PHONE' ? ' from the phone' : '';
        await this.writeRevision(tx, keys, before, actor, (before ? 'Sale return updated' : 'Sale return created') + fromPhone);
        return keys;
    }
    async get(keys) {
        const c = this.prisma;
        const rights = await this.assertRight('view', c);
        const doc = await this.documentOf(c, keys);
        return { ...(await this.withDeliveryOnGet(c, doc)), rights };
    }
    async documentOf(c, keys) {
        const row = await this.store.findOrThrow(c, keys);
        const [items, chargeRows, carry, tenders, transport, gdrId, cnApplied, approvals, note] = await Promise.all([
            this.store.loadItems(c, row),
            this.store.loadCharges(row, c),
            this.reader.returnCharges(c, keys.id),
            this.store.loadTenders(row, c),
            this.store.loadTransport(c, row),
            this.register.registerIdOf(c, keys.id, keys.accYear),
            this.creditApplied(c, row),
            this.reader.approvalsOf(c, keys.id),
            c.$queryRaw `
        SELECT abl_pending_amount AS pending FROM accounts.acc_bill_balance
         WHERE abl_src_doc_type = 'SALE_RETURN' AND abl_src_doc_id = ${keys.id}::uuid
           AND abl_acc_year = ${keys.accYear}::char(9) AND abl_is_deleted = false
         LIMIT 1`,
        ]);
        const carryById = new Map(carry.map((r) => [r.cdId, r]));
        const charges = chargeRows.map((ch) => {
            const k = carryById.get(ch.cdId);
            return {
                ...ch,
                cdSrcCdId: k?.cdSrcCdId ?? null,
                cdSrcAccYear: k?.cdSrcAccYear ?? null,
                cdCarryBasis: k?.cdCarryBasis ?? null,
                giveBack: k ? k.cdCarryBasis !== 'NONE' : null,
            };
        });
        const { posting, locks } = await this.blocks.build({
            status: row.srStatus,
            companyId: keys.companyId,
            branchId: keys.branchId,
            accYear: keys.accYear,
            docDate: (0, sales_doc_utils_1.isoDate)(row.srReturnDate) ?? (0, sales_doc_utils_1.isoToday)(),
            voucherId: row.srPostedVoucherId ?? null,
            registerId: gdrId,
            cogsAmt: (0, sales_doc_utils_1.num)(row.srTotalCost),
            allocations: cnApplied,
        }, c);
        const names = await this.reader.lineNames(c, items.map((i) => ({
            itemId: i.sriItemId,
            itemUnitId: i.sriItemUnitId,
            godownId: i.sriGodownId,
        })));
        return {
            ...this.store.plain(row),
            items: await (0, batch_detail_helper_1.withBatchDetails)(c, row.srCompanyId, 'sri', items.map((i) => ({
                ...this.store.plain(i),
                sriItemName: names.items.get(i.sriItemId) ?? null,
                sriUnitName: names.units.get(i.sriItemUnitId) ?? null,
                sriGodownName: names.godowns.get(i.sriGodownId) ?? null,
            }))),
            charges,
            tenders,
            transport,
            posting: {
                ...posting,
                settlement: {
                    refunded: (0, sales_doc_utils_1.num)(row.srRefundAmt),
                    adjusted: (0, sales_doc_utils_1.num)(row.srAdjustedAmt),
                    credited: (0, sales_doc_utils_1.num)(row.srCreditAmt),
                    adjustedBills: await this.adjustedBills(c, row),
                },
                loyaltyReversed: (0, sales_doc_utils_1.num)(row.srLoyaltyReversePoints),
                promoClawback: (0, sales_doc_utils_1.num)(row.srPromoClawbackAmt),
            },
            locks: row.srStatus === 'DRAFT' && approvals.some((a) => a.status === 'PENDING')
                ? { ...locks, editable: { ...locks.editable, document: false } }
                : locks,
            approvals: approvals.map((a) => ({
                tapId: a.tapId,
                tapAccYear: a.accYear,
                event: a.event,
                status: a.status,
                amount: (0, sale_return_money_1.n)(a.amount),
                requestedBy: a.requestedByName ?? a.requestedBy,
                requestedOn: a.requestedOn?.toISOString() ?? null,
                requestNote: a.requestNote,
                decidedBy: a.decidedByName ?? a.decidedBy,
                decidedOn: a.decidedOn?.toISOString() ?? null,
                decisionNote: a.decisionNote,
                used: !!a.usedOn,
            })),
            creditLeft: note[0] ? (0, sale_return_money_1.n)((0, sale_return_money_1.D)(note[0].pending ?? 0)) : row.srStatus === 'POSTED' ? 0 : null,
        };
    }
    async writeRevision(tx, keys, before, actor, notes) {
        const after = await this.documentOf(tx, keys);
        const { revNo } = await this.audit.logDocumentRevision({
            screenName: exports.SR_SPEC.screenName,
            tableName: exports.SR_SPEC.tableName,
            docId: keys.id,
            displayName: after.srReturnRefno || keys.id,
            before: before === null ? null : auditRecordOf(before),
            after: auditRecordOf(after),
            userId: actor,
            branchId: keys.branchId,
            deviceId: after.srDeviceId ?? null,
            notes,
        }, tx);
        return revNo;
    }
    async delete(dto) {
        await this.prisma.$transaction((tx) => this.deleteInTx(tx, this.keys(dto)), TX);
        return { srId: dto.srId, deleted: true };
    }
    async deleteInTx(tx, keys, opts = {}) {
        const actor = this.salesContext.actor();
        await this.assertRight('delete', tx);
        if (opts.withdrawPendingNote) {
            const row = await this.store.lock(tx, keys);
            if (row.srStatus === 'DRAFT') {
                await this.approvals.withdrawForDocument(tx, {
                    companyId: keys.companyId,
                    srcDocType: 'SALE_RETURN',
                    srcDocId: keys.id,
                    userId: actor,
                    deviceId: isUuid(row.srDeviceId) ? row.srDeviceId : null,
                    note: opts.withdrawPendingNote,
                });
            }
        }
        await this.assertNoPendingApproval(tx, keys.id);
        await this.store.deleteDraft(tx, keys, actor, new Date());
    }
    async billLines(q) {
        const c = this.prisma;
        await this.assertRight('view', c);
        const accYear = q.sbAccYear.trim();
        const bill = await this.reader.billHeader(c, q.sbId, accYear);
        if (!bill ||
            bill.companyId !== q.companyId ||
            (!q.allBranches && bill.branchId !== q.branchId)) {
            (0, module_service_utils_1.throwSalesNotFound)('Bill not found', 'sbId', `No bill ${q.sbId} (${accYear}) in this ${bill && bill.companyId === q.companyId ? 'branch — tick All branches' : 'company'}`, posting_types_1.SALES_ERROR_CODES.NOT_FOUND);
        }
        if (bill.status !== 'POSTED') {
            (0, sales_errors_1.throwSalesRefused)(`Bill ${bill.refno ?? bill.sbId} is ${bill.status}: only a posted bill takes a return`, posting_types_1.SALES_ERROR_CODES.RETURN_BILL_NOT_POSTED, 'sbId');
        }
        const exclude = q.srId ?? null;
        const unwound = await this.reader.unwindAddBack(c, exclude);
        const [lines, prior, drafts, charges, tenders, due, priorHeader, receivedLater] = await Promise.all([
            this.reader.billLines(c, bill),
            this.reader.priorBack(c, bill, exclude),
            this.reader.onDrafts(c, bill, exclude),
            this.reader.billCharges(c, bill, exclude),
            this.reader.billTenders(c, bill),
            this.reader.billDue(c, bill, unwound?.bills),
            this.reader.priorHeader(c, bill, exclude),
            this.reader.receivedLater(c, bill),
        ]);
        const itemIds = lines.map((l) => l.itemId);
        const [itemUnits, barcodes] = await Promise.all([
            this.reader.itemUnits(c, itemIds),
            this.reader.barcodes(c, itemIds),
        ]);
        const zero = { qtyBase: sale_return_money_1.ZERO, weight: sale_return_money_1.ZERO, value: sale_return_money_1.ZERO };
        const chargeRows = (0, sale_return_money_2.mirrorCharges)({
            charges,
            asks: new Map(),
            billBasis: zero,
            returnBasis: zero,
            emptiesBill: false,
            manual: { freight: false, loading: false },
            defaultGiveBack: true,
        }).map((ch) => {
            const j = (0, sale_return_preview_1.chargeJson)(ch);
            return {
                cdId: j.cdSrcCdId,
                accYear: j.cdSrcAccYear,
                chgId: j.chgId,
                name: j.name,
                type: j.type,
                kind: j.kind,
                sign: j.sign,
                role: j.role,
                method: j.method,
                basis: j.basis,
                beforeTax: j.beforeTax,
                sepPost: j.sepPost,
                taxApl: j.taxApl,
                ledgerId: j.ledgerId,
                ledgerName: j.ledgerName,
                locked: j.locked,
                onBill: j.onBill,
                onBillGst: j.onBillGst,
                backBefore: j.backBefore,
                left: j.cap,
            };
        });
        const pendingByLine = await this.billPendingOf(c, lines, exclude);
        const json = (0, sale_return_preview_1.billLinesJson)({
            bill,
            lines,
            prior,
            drafts,
            itemUnits,
            barcodes,
            charges: chargeRows,
            tenders,
            due,
            receivedLater,
            refundCap: client_1.Prisma.Decimal.max(sale_return_money_1.ZERO, tenders.money.plus(receivedLater).minus(priorHeader.refund)),
        });
        return {
            ...json,
            lines: json.lines.map((l) => {
                const p = pendingByLine.get(l.billItemId);
                return {
                    ...l,
                    billPendingQty: p ? (0, sale_return_money_1.n)(p.qty) : 0,
                    billPendingBase: p ? (0, sale_return_money_1.n)(p.base) : 0,
                };
            }),
        };
    }
    async validate(dto) {
        const ctx = await this.salesContext.resolve({ companyId: dto.srCompanyId, branchId: dto.srBranchId, deviceId: dto.srDeviceId }, exports.SR_SPEC.menuId);
        if (!ctx.rights.create) {
            (0, sales_errors_1.throwSalesRight)('This user may not create on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_CREATE);
        }
        const g = (0, posting_types_1.createGuardContext)({
            overrides: dto.overrides ?? [],
            canOverride: ctx.rights.override,
            throwOnRefusal: false,
            dryRun: true,
        });
        const items = (dto.items ?? []).map((i, idx) => ({
            ...i,
            sriLineNo: i.sriLineNo ?? idx + 1,
        }));
        const ms = await this.moneySettings(dto.srCompanyId, dto.srBranchId, dto.srDeviceId, ctx.settings);
        const preview = await this.prisma.$transaction(async (tx) => {
            const body = { ...dto, srSessionId: null };
            const saved = dto.srId ? await this.savedFacts(tx, dto.srId) : null;
            if ((body.srCustId === undefined || body.srCustId === null) && saved?.custId) {
                body.srCustId = saved.custId;
            }
            await this.fillFromBill(tx, body);
            if (saved?.custId &&
                typeof body.srCustId === 'string' &&
                body.srCustId !== '' &&
                body.srCustId !== saved.custId) {
                const viaBill = body.srIsAgainstBill !== false && !!body.srBillId;
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.RETURN_CUSTOMER_LOCKED, viaBill
                    ? 'This bill belongs to another customer: a saved return keeps the customer it was saved with'
                    : 'A saved return keeps the customer it was saved with: start a new return for another customer', { field: viaBill ? 'srBillId' : 'srCustId' });
            }
            const money = await this.moneyOf(tx, body, items, (0, sale_return_preview_1.chargeAsksOfBody)(dto.charges), ms, calcOf(saved, ms));
            const unwound = await this.reader.unwindAddBack(tx, dto.srId);
            const mode = body.srSettleMode ??
                saved?.settleMode ??
                (0, sale_return_settlement_1.defaultSettleMode)(ms.settleDefault, {
                    adjustable: !!money.bill && money.bill.branchId === dto.srBranchId,
                    billDue: money.bill ? await this.reader.billDue(tx, money.bill, unwound?.bills) : sale_return_money_1.ZERO,
                });
            body.srSettleMode = mode;
            const verdict = await this.guards(tx, body, items, ctx, g, money);
            const posted = saved?.status === 'POSTED' ? (0, sale_return_delivery_1.postedNotTakenOf)(await this.store.loadItems(tx, body)) : null;
            const notTaken = await this.deliveryGuards(tx, body, items, money, g, posted);
            const plan = await (0, sale_return_settlement_1.buildSettlement)(this.reader, tx, money, {
                mode,
                companyId: dto.srCompanyId,
                branchId: dto.srBranchId,
                custId: body.srCustId ?? null,
                tenders: await this.refundTendersOf(tx, (dto.tenders ?? [])),
                adjustments: adjustAsksOf(dto.adjustments),
                billSort: ms.billSort,
                lock: false,
                unwound,
            });
            for (const issue of plan.issues) {
                this.raise(g, issue);
            }
            if (dto.srReturnAmt !== undefined &&
                dto.srReturnAmt !== null &&
                !(0, sale_return_money_1.D)(dto.srReturnAmt).equals(money.totals.creditNote)) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.AMOUNT_MISMATCH, `The return now comes to ${money.totals.creditNote.toString()}, not the ${String(dto.srReturnAmt)} sent — refresh the figures`, { field: 'srReturnAmt' });
            }
            const asks = this.gateAsks(body, money, plan, ctx, dto.approvalIds ?? {});
            const approvals = await this.gatePreview(tx, asks, body.srId ?? null, unwound !== null);
            const claim = (body.srReturnKind ?? 'RETURN').toUpperCase() === 'CLAIM';
            return {
                ...(await this.withDeliveryPreview(tx, (0, sale_return_preview_1.previewOf)(money, items, claim), items, money, notTaken, claim)),
                ...this.extrasJson(plan),
                gstMode: verdict.financial ? 'FINANCIAL' : 'GST',
                cutoffPassed: verdict.cutoffPassed,
                settlement: (0, sale_return_settlement_1.settlementJson)(plan),
                approvals,
            };
        }, TX);
        return {
            ok: g.refusals.length === 0,
            refusals: g.refusals,
            warnings: g.warnings,
            rights: ctx.rights,
            preview,
        };
    }
    async post(dto) {
        const fire = await this.prisma.$transaction((tx) => this.postInTx(tx, dto), TX);
        this.afterPostCommit(fire);
        return this.get(this.keys(dto));
    }
    async postInTx(tx, dto, opts = {}) {
        const row = await this.store.lock(tx, this.keys(dto));
        if (row.srStatus === 'POSTED') {
            return null;
        }
        if (row.srStatus === 'CANCELLED') {
            (0, sales_errors_1.throwSalesLocked)('This sale return is CANCELLED', posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED, 'srId');
        }
        const ctx = await this.ctxOf(tx, row);
        if (!ctx.rights.post) {
            (0, sales_errors_1.throwSalesRight)('This user may not post on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_POST);
        }
        if (dto.tenders !== undefined) {
            await this.writeRefundTenders(tx, row, dto.tenders);
        }
        await this.dropRefundRowsUnlessCash(tx, row);
        await this.tillForPost(tx, row, ctx);
        return this.postPipeline(tx, row, ctx, {
            overrides: dto.overrides ?? [],
            adjustments: dto.adjustments,
            approvalIds: dto.approvalIds ?? {},
            now: new Date(),
            revisionNo: undefined,
            title: 'Sale return cannot be posted',
            replanAdjust: opts.replanAdjust ?? null,
            onWarnings: opts.onWarnings,
            onGateRefused: opts.onGateRefused,
        });
    }
    afterPostCommit(fire) {
        if (fire) {
            this.gst.enqueueAfterPost(fire);
        }
    }
    async fileGateRequestsInTx(tx, refused, note) {
        const ids = [];
        for (const { ask, rule } of refused) {
            const open = await tx.tillApproval.findFirst({
                where: {
                    tapCompanyId: ask.companyId,
                    tapBranchId: ask.branchId,
                    tapEventCode: ask.event,
                    tapSrcDocType: ask.srcDocType,
                    tapSrcDocId: ask.srcDocId,
                    tapStatus: 'PENDING',
                    tapIsDeleted: false,
                },
                select: { tapId: true },
            });
            ids.push(open?.tapId ??
                (await this.approvals.fileRequest(tx, {
                    companyId: ask.companyId,
                    branchId: ask.branchId,
                    tenantId: ask.tenantId,
                    accYear: ask.accYear,
                    event: ask.event,
                    rule,
                    amount: ask.amount,
                    requesterId: ask.requesterId,
                    deviceId: ask.deviceId,
                    sessionId: ask.sessionId,
                    counterId: ask.counterId,
                    srcDocType: ask.srcDocType,
                    srcDocId: ask.srcDocId,
                    srcRefno: ask.srcRefno,
                    reasonId: null,
                    note,
                    payload: { filedBy: 'phone' },
                })));
        }
        return ids;
    }
    async postPipeline(tx, row0, ctx, opts) {
        let row = row0;
        const mode = (row.srSettleMode ?? 'ADJUST').toUpperCase();
        const { items, money, ms } = await this.lockAndWorkOut(tx, row, ctx);
        const g = (0, posting_types_1.createGuardContext)({
            overrides: opts.overrides,
            canOverride: ctx.rights.override,
            throwOnRefusal: false,
        });
        const verdict = await this.guards(tx, row, items, ctx, g, money);
        await this.deliveryGuards(tx, row, items, money, g);
        this.refuseStale(g, row, money);
        if (opts.expectReturnAmt !== undefined &&
            opts.expectReturnAmt !== null &&
            opts.expectReturnAmt !== '' &&
            !(0, sale_return_money_1.D)(opts.expectReturnAmt).equals(money.totals.creditNote)) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.AMOUNT_MISMATCH, `The return now comes to ${money.totals.creditNote.toString()}, not the ${String(opts.expectReturnAmt)} sent — refresh the figures`, { field: 'srReturnAmt' });
        }
        const refundRows = mode === 'CASH' ? await this.store.loadTenders(row, tx) : [];
        const plan = await (0, sale_return_settlement_1.buildSettlement)(this.reader, tx, money, {
            mode,
            companyId: row.srCompanyId,
            branchId: row.srBranchId,
            custId: row.srCustId ?? null,
            tenders: refundTendersFromRows(refundRows),
            adjustments: adjustAsksOf(opts.adjustments),
            replan: opts.replanAdjust ?? null,
            billSort: ms.billSort,
            lock: true,
            unwound: null,
        });
        const stale = plan.issues.find((i) => i.code === posting_types_1.SALES_ERROR_CODES.RETURN_ADJUST_STALE);
        if (stale) {
            (0, sales_errors_1.throwSalesLocked)(stale.message, stale.code, stale.field ?? 'adjustments');
        }
        for (const issue of plan.issues) {
            this.raise(g, issue);
        }
        if (g.refusals.length > 0) {
            (0, sales_errors_1.throwSalesRefusals)(opts.title, g.refusals);
        }
        const asks = await this.withLatestApprovals(tx, this.gateAsks(row, money, plan, ctx, opts.approvalIds), row.srId);
        const verdicts = [];
        for (const ask of asks) {
            const v = await this.approvals.assessGate(tx, ask);
            if (v.state === 'REFUSE') {
                opts.onGateRefused?.({ ask, rule: v.rule });
                this.approvals.throwApprovalRequired(v.need, ask);
            }
            verdicts.push({ ask, verdict: v });
        }
        if (verdict.financial) {
            row = { ...row, srGstMode: 'FINANCIAL' };
        }
        const fresh = await this.writeMoney(tx, row, items, money);
        const fire = await this.postCore(tx, fresh.row, fresh.items, ctx, opts.now, 'DRAFT', opts.revisionNo, money, plan);
        await this.writeReturnEvents(tx, fresh.row, fresh.items, money, ctx.actor, opts.now);
        for (const { ask, verdict: v } of verdicts) {
            await this.approvals.settleGate(tx, ask, v);
        }
        opts.onWarnings?.(g.warnings);
        return fire;
    }
    async lockAndWorkOut(tx, row, ctx) {
        if (row.srIsAgainstBill !== false && row.srBillId && row.srBillAccYear) {
            const bill = { sbId: row.srBillId, accYear: row.srBillAccYear.trim() };
            await this.reader.lockBillHeader(tx, bill);
            await this.reader.lockBillLines(tx, bill);
            await this.reader.lockBillCharges(tx, bill);
        }
        const items = await this.store.loadItems(tx, row);
        const stored = await this.reader.returnCharges(tx, row.srId);
        const ms = await this.moneySettings(row.srCompanyId, row.srBranchId, row.srDeviceId, ctx.settings);
        const money = await this.moneyOf(tx, row, items, (0, sale_return_preview_1.chargeAsksOfStored)(stored), ms, {
            freight: row.srFreightCalcType ?? ms.freightCalcType,
            loading: row.srLoadingCalcType ?? ms.loadingCalcType,
        });
        return { items, money, ms };
    }
    gateAsks(row, money, plan, ctx, approvalIds) {
        const events = [
            { event: 'SALE_RETURN', amount: money.totals.creditNote },
        ];
        if ((row.srReturnKind ?? 'RETURN').toUpperCase() === 'CLAIM') {
            events.push({ event: 'SALE_CLAIM', amount: money.totals.creditNote });
        }
        if (!money.bill) {
            events.push({ event: 'RETURN_NO_RECEIPT', amount: money.totals.creditNote });
        }
        if (plan.refund && plan.refund.cashOut.gt(0)) {
            events.push({ event: 'REFUND_CASH', amount: plan.refund.cashOut });
        }
        const deviceId = row.srDeviceId;
        return events.map(({ event, amount }) => ({
            companyId: row.srCompanyId,
            branchId: row.srBranchId,
            tenantId: row.srTenantId ?? null,
            accYear: row.srAccYear,
            event,
            onDate: (0, sales_doc_utils_1.isoDate)(row.srReturnDate) ?? (0, sales_doc_utils_1.isoToday)(),
            amount: amount.toDecimalPlaces(2),
            requesterId: ctx.actor,
            deviceId: isUuid(deviceId) ? deviceId : null,
            sessionId: isUuid(row.srSessionId) ? row.srSessionId : null,
            counterId: isUuid(row.srCounterId) ? row.srCounterId : null,
            srcDocType: 'SALE_RETURN',
            srcDocId: row.srId ?? '00000000-0000-0000-0000-000000000000',
            srcRefno: row.srReturnRefno ?? null,
            approvalId: approvalIds[event] ?? null,
            field: 'approvalIds',
        }));
    }
    async withLatestApprovals(c, asks, srId) {
        const rows = await this.reader.approvalsOf(c, srId);
        return asks.map((a) => {
            if (a.approvalId) {
                return a;
            }
            const ok = rows.find((r) => r.event === a.event && r.status === 'APPROVED' && !r.usedOn && (0, sale_return_money_1.D)(r.amount).gte(a.amount));
            return ok ? { ...a, approvalId: ok.tapId } : a;
        });
    }
    async gatePreview(c, asks, srId, pendingWithdrawn = false) {
        const rows = (await this.reader.approvalsOf(c, srId)).filter((r) => !(pendingWithdrawn && r.status === 'PENDING'));
        const withIds = await this.withLatestApprovals(c, asks, srId);
        const out = [];
        for (const ask of withIds) {
            const latest = rows.find((r) => r.event === ask.event);
            let verdict;
            try {
                verdict = await this.approvals.assessGate(c, ask);
            }
            catch (e) {
                verdict = { state: 'INVALID', message: e instanceof Error ? e.message : String(e) };
            }
            const need = 'need' in verdict ? verdict.need : null;
            const state = latest?.status === 'PENDING'
                ? 'PENDING'
                : latest?.status === 'REJECTED' && verdict.state !== 'APPROVED'
                    ? 'REJECTED'
                    : verdict.state;
            if (verdict.state === 'NONE' && !latest) {
                continue;
            }
            out.push({
                event: ask.event,
                state,
                amount: (0, sale_return_money_1.n)(ask.amount),
                need: need
                    ? {
                        threshold: (0, sale_return_money_1.n)(new client_1.Prisma.Decimal(need.threshold)),
                        minRole: need.minRole,
                        channel: need.channel,
                        twoPerson: need.twoPerson,
                        enforced: need.enforced ?? false,
                    }
                    : null,
                tapId: latest?.tapId ?? ask.approvalId ?? null,
                tapAccYear: latest?.accYear ?? null,
                requestedOn: latest?.requestedOn?.toISOString() ?? null,
                decidedBy: latest?.decidedByName ?? null,
                decidedOn: latest?.decidedOn?.toISOString() ?? null,
                decisionNote: latest?.decisionNote ?? null,
                ...(verdict.state === 'INVALID' ? { message: verdict.message } : {}),
            });
        }
        return out;
    }
    async writeRefundTenders(tx, row, tenders) {
        await this.tenderDetail.syncDocumentTenders(tx, {
            tdSrcModule: tender_detail_api_types_1.TenderSrcModule.SALES,
            tdSrcDocType: tender_detail_api_types_1.TenderSrcDocType.SALE_RETURN,
            tdSrcDocId: row.srId,
            tdCompanyId: row.srCompanyId,
            tdBranchId: row.srBranchId,
            tdTenantId: row.srTenantId ?? null,
            tdAccYear: row.srAccYear,
            tdDocDate: row.srReturnDate,
            tdPartyLedgerId: row.srCustId ?? null,
            tdUserId: row.srUserId,
            tdSessionId: row.srSessionId ?? null,
            tdDeviceId: row.srDeviceId ?? null,
            tdDrCr: tender_detail_api_types_1.TenderDrCr.CR,
        }, tenders, this.salesContext.actor(), {
            tableName: 'acc_tender_detail',
            screenName: 'Sale Return',
            entityName: 'Sale Return tender',
        });
    }
    async dropRefundRowsUnlessCash(tx, row) {
        const mode = (row.srSettleMode ?? 'ADJUST').toUpperCase();
        if (mode === 'CASH') {
            return;
        }
        const live = await this.store.loadTenders(row, tx);
        if (live.length > 0) {
            await this.writeRefundTenders(tx, row, []);
        }
    }
    async refundTendersOf(c, rows) {
        const missing = rows
            .filter((r) => (r.tdTenderTypeId === undefined || r.tdTenderTypeId === null) && r.tdTenderId)
            .map((r) => r.tdTenderId);
        const types = missing.length
            ? new Map((await c.$queryRaw `
              SELECT tnd_id, tnd_type_id FROM accounts.acc_tender_master WHERE tnd_id = ANY(${missing}::uuid[])`).map((t) => [t.tnd_id, Number(t.tnd_type_id)]))
            : new Map();
        return rows.map((r, index) => ({
            index,
            tenderId: r.tdTenderId ?? null,
            tenderTypeId: r.tdTenderTypeId !== undefined && r.tdTenderTypeId !== null
                ? Number(r.tdTenderTypeId)
                : (types.get(r.tdTenderId) ?? 0),
            amount: (0, sale_return_money_1.D)(r.tdAmount),
            refNo: r.tdRefNo ?? null,
        }));
    }
    extrasJson(plan) {
        return {
            loyaltyReverse: { points: (0, sale_return_money_1.n)(plan.loyaltyReverse) },
            pointsBack: {
                points: (0, sale_return_money_1.n)(plan.shares.points),
                amount: (0, sale_return_money_1.n)(plan.shares.pointsBackAmt),
                rate: (0, sale_return_money_1.n)(plan.shares.rate),
                memberId: plan.memberId,
            },
            voucherShare: (0, sale_return_money_1.n)(plan.shares.voucherShare),
            agentCommBack: (0, sale_return_money_1.n)(plan.agentCommBack),
            promoCheck: plan.promoCheck.map((p) => ({
                schemeId: p.schemeId,
                kind: p.kind,
                keptValue: (0, sale_return_money_1.n)(p.keptValue),
                text: p.text,
            })),
            customerBalance: plan.customerBalance
                ? { before: (0, sale_return_money_1.n)(plan.customerBalance.before), after: (0, sale_return_money_1.n)(plan.customerBalance.after) }
                : null,
        };
    }
    refuseStale(g, row, money) {
        const saved = (0, sale_return_money_1.D)(row.srReturnAmt);
        if (!saved.equals(money.totals.creditNote)) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.AMOUNT_MISMATCH, `The return was saved at ${saved.toString()} but now comes to ${money.totals.creditNote.toString()} ` +
                '(another return of this bill posted, or the bill changed) — open it and save again', { field: 'srReturnAmt' });
        }
    }
    async writeMoney(tx, row, items, money) {
        const priceLevel = row.srPriceLevel ?? null;
        const written = [];
        for (let i = 0; i < items.length; i++) {
            written.push(await this.store.updateItem(tx, items[i], (0, sale_return_preview_1.lineFieldsOf)(money.lines[i], items[i], priceLevel)));
        }
        await this.chargeDetail.syncDocumentCharges(tx, {
            cdDocType: charge_enum_1.ChargeDocType.SALE_RETURN,
            cdDocId: row.srId,
            cdCompId: row.srCompanyId,
            cdBranchId: row.srBranchId,
            cdAccYear: row.srAccYear,
            cdVoucherNo: row.srReturnSlno ?? null,
        }, (0, sale_return_preview_1.chargeRowsOf)(money, await this.storedChargeIds(tx, row.srId)), this.salesContext.actor(), {
            tableName: 'txn_charge_detail',
            screenName: 'Sale Return',
            entityName: 'Sale Return charge',
        });
        return { row: { ...row, ...(0, sale_return_preview_1.headerFieldsOf)(money) }, items: written.length ? written : items };
    }
    async tillForPost(tx, row, ctx) {
        const mode = (row.srSettleMode ?? 'ADJUST').toUpperCase();
        const refundRows = mode === 'CASH' ? await this.store.loadTenders(row, tx) : [];
        const till = await this.till.resolveForMoney(tx, {
            companyId: row.srCompanyId,
            branchId: row.srBranchId,
            sessionId: null,
            field: 'srSessionId',
            cashOut: refundRows
                .filter((t) => Number(t.tdTenderTypeId) === sales_doc_utils_1.TENDER_TYPE.CASH)
                .reduce((sum, t) => sum.plus(t.tdAmount ?? 0), new client_1.Prisma.Decimal(0)),
        });
        if (till) {
            await this.stampTillSession(tx, row, till, ctx.actorName);
        }
        else if (row.srSessionId) {
            await this.clearTillSession(tx, row, ctx.actorName);
        }
    }
    async clearTillSession(tx, row, actorName) {
        await tx.$executeRaw `
      UPDATE sales.sale_return
         SET sr_session_id = NULL, sr_modified_on = now(), sr_modified_by = ${actorName}
       WHERE sr_id = ${row.srId}::uuid
         AND sr_acc_year = ${row.srAccYear}::char(9)`;
        await tx.$executeRaw `
      UPDATE accounts.acc_tender_detail
         SET td_session_id = NULL, td_modified_on = now(), td_modified_by = ${actorName}
       WHERE td_src_doc_type = 'SALE_RETURN'
         AND td_src_doc_id   = ${row.srId}::uuid
         AND td_acc_year     = ${row.srAccYear}::char(9)
         AND td_is_deleted   = false
         AND td_session_id IS NOT NULL`;
        row.srSessionId = null;
    }
    async stampTillSession(tx, row, till, actorName) {
        if (row.srSessionId !== till.tssId || row.srCounterId !== till.tssCounterId) {
            await tx.$executeRaw `
        UPDATE sales.sale_return
           SET sr_session_id  = ${till.tssId}::uuid,
               sr_counter_id  = ${till.tssCounterId}::uuid,
               sr_modified_on = now(),
               sr_modified_by = ${actorName}
         WHERE sr_id = ${row.srId}::uuid
           AND sr_acc_year = ${row.srAccYear}::char(9)`;
            row.srSessionId = till.tssId;
            row.srCounterId = till.tssCounterId;
        }
        await this.till.stampTenderRows(tx, till, { srcDocType: 'SALE_RETURN', srcDocId: row.srId, accYear: row.srAccYear }, actorName);
    }
    async ctxOf(tx, row) {
        return this.salesContext.resolve({
            companyId: row.srCompanyId,
            branchId: row.srBranchId,
            deviceId: row.srDeviceId,
        }, exports.SR_SPEC.menuId, tx);
    }
    async guards(tx, row, items, ctx, g, money) {
        let financial = false;
        let cutoffPassed = false;
        const companyId = row.srCompanyId;
        const branchId = row.srBranchId;
        const accYear = row.srAccYear;
        const docDate = (0, sales_doc_utils_1.isoDate)(row.srReturnDate) ?? (0, sales_doc_utils_1.isoToday)();
        const today = (0, sales_doc_utils_1.isoToday)();
        await (0, sales_guards_1.assertAccYearWritable)(tx, companyId, accYear, 'srAccYear');
        await (0, sales_guards_1.assertVoucherPartitionExists)(tx, accYear, 'srAccYear');
        if (docDate > today) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.BACKDATE, `A return cannot be dated ${docDate}, in the future`, {
                field: 'srReturnDate',
            });
        }
        else if (docDate !== today && ctx.settings.backdateMode !== 'ALLOW') {
            (ctx.settings.backdateMode === 'REFUSE' ? sales_guards_1.refuse : sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.BACKDATE, `This return is dated ${docDate}, before today`, { field: 'srReturnDate' });
        }
        if (await (0, sales_guards_1.loadDayClosed)(tx, companyId, branchId, docDate)) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DAY_CLOSED, `The books for ${docDate} are closed at this branch`, { field: 'srReturnDate' });
        }
        const salesmen = row.srSalesmanId ?? null;
        await (0, sales_guards_1.assertSalesmen)(tx, companyId, salesmen && salesmen.length ? salesmen : null, {
            field: 'srSalesmanId',
        });
        if (!row.srCustId) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.CUSTOMER_REQUIRED, 'A sale return must name a customer — the credit note is raised against the customer ledger', { field: 'srCustId' });
        }
        if (!money.lines.some((l) => l.qty.gt(0))) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.RETURN_NO_LINES, 'No line of this return has a quantity', {
                field: 'items',
            });
        }
        const mode = (row.srSettleMode ?? 'ADJUST').toUpperCase();
        if (!['CASH', 'ADJUST', 'ADVANCE'].includes(mode)) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.AMOUNT_MISMATCH, `srSettleMode must be CASH, ADJUST or ADVANCE (got ${mode})`, { field: 'srSettleMode' });
        }
        const itemIds = [...new Set(items.map((i) => i.sriItemId))];
        const masters = itemIds.length
            ? await tx.$queryRaw `
          SELECT item_id, item_allow_sales_return, item_name_en FROM inventory.item_master WHERE item_id = ANY(${itemIds}::uuid[])`
            : [];
        const allow = new Map(masters.map((m) => [m.item_id, m]));
        for (const i of items) {
            const m = allow.get(i.sriItemId);
            if (m && !m.item_allow_sales_return) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.RETURN_ITEM_NOT_ALLOWED, `Line ${String(i.sriLineNo)}: ${m.item_name_en} does not accept sales returns`, { field: 'items', line: i.sriLineNo });
            }
        }
        const against = row.srIsAgainstBill !== false && row.srBillId;
        const bill = money.bill;
        if (against) {
            if (!bill || bill.status !== 'POSTED' || bill.companyId !== companyId) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.RETURN_BILL_NOT_POSTED, 'The bill this return is against is not a POSTED bill of this company', { field: 'srBillId' });
            }
            else {
                const billDate = bill.date;
                if (ctx.settings.returnWindowDays > 0 &&
                    (0, sales_doc_utils_1.daysBetween)(billDate, docDate) > ctx.settings.returnWindowDays) {
                    (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.RETURN_WINDOW, `The bill is ${(0, sales_doc_utils_1.daysBetween)(billDate, docDate)} days old; the return window is ${ctx.settings.returnWindowDays} days`, { field: 'srBillId' });
                }
                const cutoff = await this.statutory.creditNoteCutoff(companyId, billDate, docDate, tx);
                cutoffPassed = cutoff.passed;
                if (cutoff.passed &&
                    ctx.rights.override &&
                    g.overrides.includes(posting_types_1.SALES_ERROR_CODES.RETURN_FINANCIAL)) {
                    financial = true;
                }
                else if (cutoff.passed && cutoff.limit) {
                    const st = {
                        code: cutoff.limit.code,
                        value: cutoff.limit.valueText,
                        effectiveFrom: cutoff.limit.effectiveFrom,
                        isCompanyOverride: cutoff.limit.isCompanyOverride,
                    };
                    const msg = `A credit note for a ${billDate} invoice had to be declared by ${cutoff.cutoff}`;
                    (cutoff.limit.enforce === 'REFUSE' ? sales_guards_1.refuse : sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.CREDIT_NOTE_CUTOFF, msg, { field: 'srReturnDate', statutory: st });
                }
            }
        }
        if ((row.srReturnKind ?? 'RETURN').toUpperCase() === 'CLAIM') {
            money.lines.forEach((l, i) => {
                const goods = (items[i]?.sriClaimGoods ?? '').toUpperCase();
                if (l.qty.gt(0) && goods !== 'BACK' && goods !== 'DESTROYED') {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.RETURN_CLAIM_GOODS, `Line ${l.lineNo}: a claim line must say BACK or DESTROYED (sriClaimGoods)`, { field: 'sriClaimGoods', line: l.lineNo });
                }
            });
        }
        for (const issue of money.issues) {
            this.raise(g, issue);
        }
        if (money.totals.creditNote.lt(0)) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.RETURN_NEGATIVE, `The return comes to ${money.totals.creditNote.toFixed(2)}: the deductions it gives back are more than the goods coming back`, { field: 'srReturnAmt', params: { value: money.totals.creditNote.toFixed(2) } });
        }
        return { financial, cutoffPassed };
    }
    raise(g, issue) {
        const opts = {
            field: issue.field,
            line: issue.line,
            ...(issue.params ? { params: issue.params } : {}),
        };
        if (issue.level === 'REFUSE') {
            (0, sales_guards_1.refuse)(g, issue.code, issue.message, opts);
        }
        else if (issue.level === 'WARN') {
            (0, sales_guards_1.warn)(g, issue.code, issue.message, opts);
        }
        else {
            (0, sales_guards_1.info)(g, issue.code, issue.message, opts);
        }
    }
    async postCore(tx, row, items, ctx, now, fromStatus, revisionNo, money, plan) {
        const actor = ctx.actor;
        const keys = this.store.keysOf(row);
        const partyId = row.srCustId;
        const refno = row.srReturnRefno ?? keys.id;
        const docDate = (0, sales_doc_utils_1.isoDate)(row.srReturnDate) ?? (0, sales_doc_utils_1.isoToday)();
        const t = money.totals;
        const returnAmt = t.creditNote;
        const financial = (row.srGstMode ?? 'GST') === 'FINANCIAL';
        const tenders = plan.refund ? await this.store.loadTenders(row, tx) : [];
        const company = await this.reader.company(tx, keys.companyId);
        const nature = money.nature;
        const byId = new Map(items.map((i) => [i.sriId, i]));
        const claim = (row.srReturnKind ?? 'RETURN').toUpperCase() === 'CLAIM';
        const moving = money.lines
            .map((l, i) => ({ l, i: items[i] }))
            .filter(({ l, i }) => !!i && !i.sriIsService && l.qtyBase.gt(0) && (0, sale_return_preview_1.bringsStock)(i, claim));
        const stock = await this.stock.post(tx, {
            docType: 'SALE_RETURN',
            docId: keys.id,
            accYear: keys.accYear,
            companyId: keys.companyId,
            branchId: keys.branchId,
            tenantId: row.srTenantId,
            deviceId: row.srDeviceId,
            sessionId: row.srSessionId,
            docDate,
            docDatetime: row.srReturnDatetime ?? now,
            refno,
            revision: revisionNo ?? row.srRevisionNo ?? 1,
            partyId,
            direction: 'IN',
            txnType: 'SALE_RETURN',
            lines: moving.map(({ l, i }) => ({
                lineId: i.sriId,
                lineNo: i.sriLineNo,
                itemId: i.sriItemId,
                itemUnitId: i.sriItemUnitId,
                godownId: i.sriGodownId,
                lotId: i.sriLotId,
                bucket: (0, sale_return_preview_1.lineBucketOf)(i, claim),
                qty: (0, sales_doc_utils_1.num)(i.sriReturnQty),
                freeQty: (0, sales_doc_utils_1.num)(i.sriFreeQty),
                weightQty: i.sriWeightQty === null ? null : (0, sales_doc_utils_1.num)(i.sriWeightQty),
                toBaseFactor: (0, sale_return_money_1.n)(l.factor),
                batchNo: i.sriBatchNo,
                batchDate: (0, sales_doc_utils_1.isoDate)(i.sriBatchDate),
                expiryDate: (0, sales_doc_utils_1.isoDate)(i.sriExpiryDate),
                serialNo: i.sriSerialNo,
                mrp: i.sriMaxPrice === null ? null : (0, sales_doc_utils_1.num)(i.sriMaxPrice),
                rate: (0, sales_doc_utils_1.num)(i.sriRate),
                costRate: l.costPerBase && l.parts.cogsAmt.gt(0)
                    ? (0, sale_return_money_1.n)((0, sale_return_money_1.r6)(l.parts.cogsAmt.dividedBy(l.qtyBase)))
                    : null,
                taxPerc: (0, sales_doc_utils_1.num)(i.sriTaxPerc),
            })),
        }, actor, now);
        let cogsTotal = sale_return_money_1.ZERO;
        const movedIds = new Set(moving.map(({ i }) => i.sriId));
        for (const i of items) {
            const id = i.sriId;
            const cost = movedIds.has(id) ? (0, sale_return_money_1.D)(stock.costByLine.get(id) ?? 0) : sale_return_money_1.ZERO;
            cogsTotal = cogsTotal.plus(cost);
            await this.store.updateItem(tx, byId.get(id) ?? i, {
                sriLotId: movedIds.has(id)
                    ? (stock.lotByLine.get(id) ?? i.sriLotId ?? null)
                    : (i.sriLotId ?? null),
                sriCogsAmt: cost,
            });
        }
        const cogs = ctx.cogsMode === 'PERPETUAL' ? cogsTotal : sale_return_money_1.ZERO;
        const legCharges = money.charges.filter(sale_return_preview_1.storesCharge).map((c) => ({
            ledgerId: c.bill.ledgerId,
            amount: (0, sale_return_money_1.n)((0, sale_return_money_1.signed)(c, c.back.amount)),
            cgst: (0, sale_return_money_1.n)((0, sale_return_money_1.signed)(c, c.back.cgst)),
            sgst: (0, sale_return_money_1.n)((0, sale_return_money_1.signed)(c, c.back.sgst)),
            igst: (0, sale_return_money_1.n)((0, sale_return_money_1.signed)(c, c.back.igst)),
            cess: (0, sale_return_money_1.n)((0, sale_return_money_1.signed)(c, c.back.cess)),
            taxId: c.bill.taxApl && !c.bill.beforeTax ? c.bill.taxCode : null,
            separatelyPosted: true,
            name: c.bill.name,
        }));
        const salesAmount = t.taxable.minus(money.charges
            .filter((c) => (0, sale_return_preview_1.storesCharge)(c) && (c.bill.beforeTax || c.bill.taxApl))
            .reduce((s, c) => s.plus((0, sale_return_money_1.signed)(c, c.back.amount)), sale_return_money_1.ZERO));
        const refundLegTenders = plan.refund
            ? tenders
                .filter((td) => [1, 3, 6].includes(Number(td.tdTenderTypeId)) && (0, sale_return_money_1.D)(td.tdAmount ?? 0).gt(0))
                .map((td) => ({
                tenderTypeId: Number(td.tdTenderTypeId),
                tenderLedgerId: td.tdTenderLedgerId,
                amount: (0, sales_doc_utils_1.num)(td.tdAmount),
                isLoyalty: false,
                isCredit: false,
                name: td.tdTenderName,
            }))
            : [];
        const pointsLeg = plan.shares.pointsBackAmt.gt(0)
            ? [
                {
                    tenderTypeId: sales_doc_utils_1.TENDER_TYPE.LOYALTY,
                    tenderLedgerId: null,
                    amount: (0, sale_return_money_1.n)(plan.shares.pointsBackAmt),
                    isLoyalty: true,
                    isCredit: false,
                    name: 'Points back',
                },
            ]
            : [];
        const built = (0, sales_leg_sources_1.buildReturnLegs)({
            partyLedgerId: partyId,
            supplyNature: nature,
            salesAmount: (0, sale_return_money_1.n)(salesAmount),
            taxes: (0, sales_doc_utils_1.bucketTaxes)(money.lines.map((l) => ({
                taxId: l.copy?.taxId ?? null,
                cgst: (0, sale_return_money_1.n)(l.parts.cgstAmt),
                sgst: (0, sale_return_money_1.n)(l.parts.sgstAmt),
                igst: (0, sale_return_money_1.n)(l.parts.igstAmt),
                cess: (0, sale_return_money_1.n)(l.parts.cessAmt),
                acess: (0, sale_return_money_1.n)(l.parts.acessAmt),
            }))),
            charges: legCharges,
            cashDiscount: (0, sale_return_money_1.n)(t.cashDisc),
            schemeDiscount: ctx.settings.postSchemeDiscSeparately ? (0, sale_return_money_1.n)(t.schDisc.plus(t.billSchDisc)) : 0,
            roundOff: (0, sale_return_money_1.n)(t.roundOff),
            tenders: [...refundLegTenders, ...pointsLeg],
            cogsAmount: (0, sale_return_money_1.n)(cogs),
        });
        const legs = financial ? financialLegs(built) : built;
        const zeroNote = returnAmt.isZero();
        const voucher = !legs.some((l) => Math.round(Math.abs(l.amount) * 100) !== 0)
            ? null
            : await this.legs.postLegs(tx, {
                header: {
                    companyId: keys.companyId,
                    branchId: keys.branchId,
                    tenantId: row.srTenantId,
                    accYear: keys.accYear,
                    voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.SALE_RETURN,
                    voucherDate: docDate,
                    srcModule: 'SALES',
                    srcDocType: 'SALE_RETURN',
                    srcDocId: keys.id,
                    docRefno: refno,
                    docDate,
                    usrRefno: row.srUsrRefno,
                    docAmount: (0, sale_return_money_1.n)(returnAmt),
                    roundOff: (0, sale_return_money_1.n)(t.roundOff),
                    partyId,
                    userId: isUuid(row.srUserId) ? row.srUserId : actor,
                    sessionId: row.srSessionId,
                    deviceType: row.srDeviceType,
                    remarks: row.srReturnReason,
                    deviceCode: null,
                    createdBy: actor,
                    presetRefno: row.srReturnRefno,
                },
                legs,
            });
        const reg = financial || zeroNote || !voucher
            ? { gdrId: null, einvoiceApplicable: false, ewaybillApplicable: false }
            : await this.register.write(tx, (0, sale_return_register_1.returnRegisterDoc)(row, money, voucher.voucherId, voucher.voucherLastNo, actor), {
                companyEinvoiceFlag: company.einvoice,
                interState: nature === 'INTER',
            });
        const refunded = zeroNote ? sale_return_money_1.ZERO : (plan.refund?.refunded ?? sale_return_money_1.ZERO);
        const pointsBackAmt = zeroNote ? sale_return_money_1.ZERO : plan.shares.pointsBackAmt;
        const cnAbl = zeroNote || !voucher
            ? null
            : await tx.accBillBalance.create({
                data: {
                    ablCompanyId: keys.companyId,
                    ablBranchId: keys.branchId,
                    ablTenantId: row.srTenantId,
                    ablAccYear: keys.accYear,
                    ablPartyId: partyId,
                    ablSalesmanId: (row.srSalesmanId ?? [])[0] ?? null,
                    ablAgentId: row.srAgentId,
                    ablBillType: 'SALES_RETURN',
                    ablSrcModule: 'SALES',
                    ablSrcDocType: 'SALE_RETURN',
                    ablSrcDocId: keys.id,
                    ablSrcAccYear: keys.accYear,
                    ablParentBillId: null,
                    ablVoucherId: voucher.voucherId,
                    ablVoucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.SALE_RETURN,
                    ablVoucherNo: voucher.voucherLastNo,
                    ablVoucherDate: row.srReturnDate,
                    ablVoucherRefno: refno,
                    ablDocRefno: refno,
                    ablDocDate: row.srReturnDate,
                    ablDrCr: 'CR',
                    ablBillAmount: returnAmt,
                    ablAllocAmount: refunded.plus(pointsBackAmt),
                    ablNarration: row.srReturnReason,
                    ablCreatedOn: now,
                    ablCreatedBy: actor,
                },
                select: { ablId: true },
            });
        let adjusted = sale_return_money_1.ZERO;
        const noteAblId = cnAbl?.ablId ?? null;
        for (const line of noteAblId ? (plan.adjust?.lines ?? []) : []) {
            if (line.amount.lte(0)) {
                continue;
            }
            adjusted = adjusted.plus(await this.adjustBill(tx, row, line.bill, noteAblId, line.amount, actor, now));
        }
        const credited = returnAmt.minus(refunded).minus(adjusted).minus(pointsBackAmt);
        const settleStatus = settleStatusOf({ refunded, adjusted, pointsBackAmt, credited });
        let loyaltyReversed = 0;
        let promoClawback = sale_return_money_1.ZERO;
        let pointsBack = sale_return_money_1.ZERO;
        if (money.bill) {
            const bill = money.bill;
            promoClawback = t.schDisc.plus(t.billSchDisc);
            const retDoc = {
                docId: keys.id,
                accYear: keys.accYear,
                companyId: keys.companyId,
                branchId: keys.branchId,
                docDate,
                docRefno: refno,
                memberId: bill.loyaltyMemberId ?? '',
            };
            if (bill.loyaltyMemberId && plan.loyaltyReverse.gt(0)) {
                const cb = await this.loyalty.clawbackForReturn(tx, retDoc, 1, {
                    earnedOnBill: (0, sale_return_money_1.n)(plan.loyaltyReverse),
                    createdBy: actor,
                });
                loyaltyReversed = cb.clawedBack;
            }
            if (bill.loyaltyMemberId && plan.shares.points.gt(0)) {
                const r = await this.loyalty.restoreRedeemForReturn(tx, retDoc, { billId: bill.sbId, billAccYear: bill.accYear, refno: bill.refno }, (0, sale_return_money_1.n)(plan.shares.points), { approvedBy: actor, createdBy: actor });
                pointsBack = (0, sale_return_money_1.D)(r.pointsRestored);
            }
        }
        await this.store.setStatus(tx, row, 'POSTED', {
            ...(0, sale_return_preview_1.headerFieldsOf)(money),
            srPostedVoucherId: voucher?.voucherId ?? null,
            srTotalCost: cogsTotal,
            srRefundAmt: refunded,
            srAdjustedAmt: adjusted,
            srCreditAmt: credited,
            srPointsBack: pointsBack,
            srPointsBackAmt: pointsBackAmt,
            srVoucherShareAmt: plan.shares.voucherShare,
            srAgentCommAmt: plan.agentCommBack.gt(0) ? plan.agentCommBack : null,
            srGstMode: financial ? 'FINANCIAL' : 'GST',
            srSettleStatus: settleStatus,
            srLoyaltyReversePoints: new client_1.Prisma.Decimal(loyaltyReversed),
            srPromoClawbackAmt: promoClawback,
            ...(revisionNo ? { srRevisionNo: revisionNo } : {}),
        }, actor, now);
        if (money.bill) {
            await this.refreshBillReturnFields(tx, money.bill, ctx.actorName, now);
        }
        await this.store.trail(tx, row, txn_status_log_helper_1.TxnStatusEvent.POSTED, fromStatus, 'POSTED', actor, now, revisionNo ? `Re-posted as revision ${revisionNo}` : null);
        await this.store.auditChange(tx, row, 'approve', { srStatus: fromStatus }, {
            srStatus: 'POSTED',
            srPostedVoucherId: voucher?.voucherId ?? null,
            gdrId: reg.gdrId,
            refunded: (0, sale_return_money_1.n)(refunded),
            adjusted: (0, sale_return_money_1.n)(adjusted),
            credited: (0, sale_return_money_1.n)(credited),
            pointsBackAmt: (0, sale_return_money_1.n)(pointsBackAmt),
        }, actor, voucher
            ? `Sale return posted (voucher ${voucher.voucherRefno})`
            : 'Sale return posted at 0.00 (stock only, no voucher)');
        return reg.gdrId
            ? { gdrId: reg.gdrId, einvoice: reg.einvoiceApplicable, ewaybill: reg.ewaybillApplicable }
            : null;
    }
    async adjustBill(tx, row, target, noteAblId, amount, actor, now) {
        const [billAbl] = await tx.$queryRaw `
      SELECT abl_id, abl_acc_year, abl_pending_amount, abl_bill_amount, abl_alloc_amount, abl_branch_id
        FROM accounts.acc_bill_balance
       WHERE abl_id = ${target.ablId}::uuid AND abl_acc_year = ${target.ablAccYear}::char(9)
         AND abl_is_deleted = false AND abl_is_active = true FOR UPDATE`;
        if (!billAbl) {
            return sale_return_money_1.ZERO;
        }
        const take = client_1.Prisma.Decimal.min(amount, client_1.Prisma.Decimal.max(sale_return_money_1.ZERO, (0, sale_return_money_1.D)(billAbl.abl_pending_amount ?? 0)));
        if (take.lte(0)) {
            return sale_return_money_1.ZERO;
        }
        const accYear = billAbl.abl_acc_year.trim();
        await (0, bill_adjustment_helper_1.addBillAdjustment)(tx, this.adjustCtx(row, billAbl, accYear, actor), {
            againstBillId: noteAblId,
            againstBillAccYear: row.srAccYear,
            amount: take,
            remarks: `Adjusted at post of return ${row.srReturnRefno ?? ''}`,
        }, actor, now);
        return take;
    }
    adjustCtx(row, billAbl, accYear, actor) {
        return {
            billId: billAbl.abl_id,
            billAccYear: accYear,
            billAmount: billAbl.abl_bill_amount,
            paidAmount: billAbl.abl_alloc_amount,
            companyId: row.srCompanyId,
            branchId: billAbl.abl_branch_id,
            tenantId: row.srTenantId,
            accYear,
            partyId: row.srCustId,
            adjDate: row.srReturnDate,
            userId: isUuid(row.srUserId) ? row.srUserId : actor,
            sessionId: row.srSessionId,
        };
    }
    async refreshBillReturnFields(tx, bill, actorName, now) {
        const [lines, prior, charges] = await Promise.all([
            this.reader.billLines(tx, bill),
            this.reader.priorBack(tx, bill, null),
            this.reader.billCharges(tx, bill, null),
        ]);
        let anyBack = false;
        let allBack = lines.length > 0;
        for (const l of lines) {
            const base = prior.get(l.billItemId)?.base ?? sale_return_money_1.ZERO;
            const billBase = l.qty.times(l.factor);
            anyBack = anyBack || base.gt(0);
            allBack = allBack && base.gte(billBase);
            const qty = l.factor.gt(0)
                ? base.dividedBy(l.factor).toDecimalPlaces(3, client_1.Prisma.Decimal.ROUND_HALF_UP)
                : base;
            await tx.$executeRaw `
        UPDATE sales.sale_bill_item SET sbi_return_qty = ${qty}::numeric
         WHERE sbi_id = ${l.billItemId}::uuid AND sbi_acc_year = ${l.accYear}::char(9)
           AND sbi_return_qty IS DISTINCT FROM ${qty}::numeric`;
        }
        for (const c of charges) {
            await tx.$executeRaw `
        UPDATE public.txn_charge_detail SET cd_carried_amt = ${c.backBefore.amount}::numeric, cd_modified_on = now()
         WHERE cd_id = ${c.cdId}::uuid AND cd_acc_year = ${c.accYear}::char(9)
           AND COALESCE(cd_carried_amt, 0) <> ${c.backBefore.amount}::numeric`;
        }
        const [sum] = await tx.$queryRaw `
      SELECT SUM(sr_return_amt) AS amt FROM sales.sale_return
       WHERE sr_bill_id = ${bill.sbId}::uuid AND sr_bill_acc_year = ${bill.accYear}::char(9)
         AND sr_status = 'POSTED' AND sr_is_deleted = false`;
        const returnedAmt = (0, sale_return_money_1.D)(sum?.amt ?? 0);
        const status = allBack ? 'FULL' : anyBack || returnedAmt.gt(0) ? 'PARTIAL' : null;
        await tx.$executeRaw `
      UPDATE sales.sale_bill SET sb_returned_amt = ${returnedAmt}::numeric, sb_return_status = ${status},
             sb_modified_on = ${now}, sb_modified_by = ${actorName}
       WHERE sb_id = ${bill.sbId}::uuid AND sb_acc_year = ${bill.accYear}::char(9)`;
    }
    async cancel(dto) {
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const row = await this.store.lock(tx, this.keys(dto));
            if (row.srStatus === 'CANCELLED') {
                return { ...this.keys(dto), srStatus: 'CANCELLED' };
            }
            if (row.srStatus !== 'POSTED') {
                (0, sales_errors_1.throwSalesLocked)('Only a POSTED sale return can be cancelled — a DRAFT is deleted', posting_types_1.SALES_ERROR_CODES.DOC_NOT_DRAFT, 'srId');
            }
            const ctx = await this.ctxOf(tx, row);
            if (!ctx.rights.cancel) {
                (0, sales_errors_1.throwSalesRight)('This user may not cancel on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_CANCEL);
            }
            await this.lockBillOf(tx, row);
            await this.assertRefundSessionOpen(tx, row);
            await this.assertUnwindable(tx, row, dto.reason, 'cancel');
            const reversal = await this.unwind(tx, row, ctx.actor, ctx.actorName, dto.reason, now);
            await this.store.setStatus(tx, row, 'CANCELLED', {}, ctx.actor, now);
            await this.cancelReturnEvents(tx, row, ctx.actor, now, dto.reason);
            await this.refreshBillOf(tx, row, ctx.actorName, now);
            await this.store.trail(tx, row, txn_status_log_helper_1.TxnStatusEvent.CANCELLED, 'POSTED', 'CANCELLED', ctx.actor, now, dto.reason);
            if ((await this.reader.approvalsOf(tx, row.srId)).some((a) => a.status === 'PENDING')) {
                await this.approvals.withdrawForDocument(tx, {
                    companyId: row.srCompanyId,
                    srcDocType: 'SALE_RETURN',
                    srcDocId: row.srId,
                    userId: ctx.actor,
                    deviceId: isUuid(row.srDeviceId) ? row.srDeviceId : null,
                    note: `Withdrawn by ${ctx.actorName}: the return was cancelled`,
                });
            }
            await this.store.auditChange(tx, row, 'cancel', { srStatus: 'POSTED' }, { srStatus: 'CANCELLED' }, ctx.actor, `Sale return cancelled: ${dto.reason}`);
            return {
                ...this.keys(dto),
                srStatus: 'CANCELLED',
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
                id: dto.srId,
                companyId: dto.srCompanyId,
                branchId: dto.srBranchId,
                accYear: dto.srAccYear,
            };
            const row = await this.store.lock(tx, keys);
            if (row.srStatus !== 'POSTED') {
                (0, sales_errors_1.throwSalesLocked)(row.srStatus === 'CANCELLED'
                    ? 'This sale return is CANCELLED'
                    : 'This sale return is a DRAFT — use /create', row.srStatus === 'CANCELLED'
                    ? posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED
                    : posting_types_1.SALES_ERROR_CODES.DOC_NOT_DRAFT, 'srId');
            }
            const ctx = await this.ctxOf(tx, row);
            if (!ctx.rights.amend) {
                (0, sales_errors_1.throwSalesRight)('This user may not amend on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_AMEND);
            }
            if (!ctx.settings.allowPostedAmend) {
                (0, sales_errors_1.throwSalesLocked)('Amending a posted document is switched off (sales.allow_posted_amend)', posting_types_1.SALES_ERROR_CODES.AMEND_OFF, 'srId');
            }
            if (row.srRevisionNo !== dto.baseRevision) {
                (0, sales_errors_1.throwSalesLocked)(`This sale return has been amended since you opened it (now revision ${String(row.srRevisionNo)}, you sent ${dto.baseRevision})`, posting_types_1.SALES_ERROR_CODES.REVISION_STALE, 'baseRevision');
            }
            await this.lockBillOf(tx, row);
            const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
            await (0, sales_guards_1.assertAmendable)(tx, gdrId);
            await this.assertRefundSessionOpen(tx, row);
            await this.assertUnwindable(tx, row, dto.editRemark, 'amend');
            const before = await this.documentOf(tx, keys);
            await this.unwind(tx, row, ctx.actor, ctx.actorName, `Amended: ${dto.editRemark}`, now, 'amend');
            const draft = await this.store.setStatus(tx, row, 'DRAFT', {
                srPostedVoucherId: null,
                srRefundAmt: 0,
                srAdjustedAmt: 0,
                srCreditAmt: 0,
                srSettleStatus: 'PENDING',
                srLoyaltyReversePoints: 0,
                srPromoClawbackAmt: 0,
                srPointsBackAmt: 0,
            }, ctx.actor, now);
            await this.refreshBillOf(tx, draft, ctx.actorName, now);
            await this.store.trail(tx, draft, txn_status_log_helper_1.TxnStatusEvent.AMENDED, 'POSTED', 'DRAFT', ctx.actor, now, dto.editRemark);
            const revisionNo = row.srRevisionNo + 1;
            if ((await this.reader.approvalsOf(tx, keys.id)).some((a) => a.status === 'PENDING')) {
                await this.approvals.withdrawForDocument(tx, {
                    companyId: keys.companyId,
                    srcDocType: 'SALE_RETURN',
                    srcDocId: keys.id,
                    userId: ctx.actor,
                    deviceId: isUuid(row.srDeviceId) ? row.srDeviceId : null,
                    note: `Withdrawn by ${ctx.actorName}: the return was amended to revision ${revisionNo}`,
                });
            }
            const { baseRevision: _b, editRemark: _e, overrides: _o, ...saveDto } = dto;
            void _b;
            void _e;
            void _o;
            const ms = await this.moneySettings(keys.companyId, keys.branchId, row.srDeviceId, ctx.settings);
            const saved = await this.saveBody(tx, { ...saveDto, srId: keys.id }, ctx.actor, now, ms, { amend: true });
            await this.dropRefundRowsUnlessCash(tx, saved);
            await this.tillForPost(tx, saved, ctx);
            fire = await this.postPipeline(tx, saved, ctx, {
                overrides: dto.overrides ?? [],
                adjustments: dto.adjustments,
                approvalIds: dto.approvalIds ?? {},
                now,
                revisionNo,
                title: 'Sale return cannot be amended',
                expectReturnAmt: dto.srReturnAmt,
            });
            await this.writeRevision(tx, keys, before, ctx.actor, `Sale return amended to revision ${revisionNo}: ${dto.editRemark}`);
        }, TX);
        if (fire) {
            this.gst.enqueueAfterPost(fire);
        }
        return this.get({
            id: dto.srId,
            companyId: dto.srCompanyId,
            branchId: dto.srBranchId,
            accYear: dto.srAccYear,
        });
    }
    async creditApplied(c, row) {
        const [r] = await c.$queryRaw `
      SELECT COUNT(*) AS n
        FROM accounts.acc_bill_adjustment j
        JOIN accounts.acc_bill_balance b ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year
        LEFT JOIN accounts.acc_bill_balance k ON k.abl_id = j.abj_against_bill_id AND k.abl_acc_year = j.abj_against_bill_acc_year
       WHERE b.abl_src_doc_id = ${row.srId}::uuid AND b.abl_acc_year = ${row.srAccYear}::char(9)
         AND b.abl_src_doc_type = 'SALE_RETURN' AND b.abl_is_deleted = false
         AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x WHERE x.abj_reversal_of_id = j.abj_id AND x.abj_is_deleted = false)
         AND NOT (j.abj_adj_type = 'NOTE_ADJUST' AND j.abj_voucher_id IS NULL AND k.abl_dr_cr = 'DR'
                  AND k.abl_created_on < b.abl_created_on)`;
        return Number(r?.n ?? 0);
    }
    async assertRefundSessionOpen(tx, row) {
        if ((0, sale_return_money_1.D)(row.srRefundAmt).lte(0)) {
            return;
        }
        const session = await this.reader.sessionOf(tx, row.srSessionId);
        if (!session || ['OPEN', 'SUSPENDED'].includes(session.status)) {
            return;
        }
        (0, sales_errors_1.throwSalesLocked)(`This return refunded ${String(row.srRefundAmt)} out of till session ${session.sessionNo ?? ''}, which is ` +
            `${session.status}: take the money back with a Receipt instead`, posting_types_1.SALES_ERROR_CODES.RETURN_REFUND_SESSION_CLOSED, 'srId', { status: session.status });
    }
    async assertAdjustedBillsWritable(tx, row, noteAblId, verb) {
        if (!noteAblId) {
            return;
        }
        const targets = await this.adjustedAtPost(tx, noteAblId, row.srAccYear);
        if (targets.length === 0) {
            return;
        }
        const shut = await this.reader.closedYears(tx, row.srCompanyId, targets.map((t) => t.ablAccYear));
        const blocked = targets.find((t) => shut.has(t.ablAccYear));
        if (blocked) {
            (0, sales_errors_1.throwSalesLocked)(`This return set off bill ${blocked.refno ?? blocked.ablId} of ${blocked.ablAccYear}, a closed year: ` +
                `that set-off cannot be taken back, so the return cannot be ${verb === 'cancel' ? 'cancelled' : 'amended'} now`, posting_types_1.SALES_ERROR_CODES.YEAR_LOCKED, 'adjustedBills', { params: { bill: blocked.refno ?? '', year: blocked.ablAccYear } });
        }
    }
    async lockBillOf(tx, row) {
        if (row.srBillId && row.srBillAccYear) {
            const bill = { sbId: row.srBillId, accYear: row.srBillAccYear.trim() };
            await this.reader.lockBillHeader(tx, bill);
            await this.reader.lockBillLines(tx, bill);
            await this.reader.lockBillCharges(tx, bill);
        }
    }
    async refreshBillOf(tx, row, actorName, now) {
        if (row.srBillId && row.srBillAccYear) {
            await this.refreshBillReturnFields(tx, { sbId: row.srBillId, accYear: row.srBillAccYear.trim() }, actorName, now);
        }
    }
    async adjustedAtPost(tx, noteAblId, noteAccYear) {
        return (await tx.$queryRaw `
        SELECT DISTINCT k.abl_id, k.abl_acc_year, k.abl_doc_refno
          FROM accounts.acc_bill_adjustment j
          JOIN accounts.acc_bill_balance n ON n.abl_id = j.abj_bill_id AND n.abl_acc_year = j.abj_bill_acc_year
          JOIN accounts.acc_bill_balance k ON k.abl_id = j.abj_against_bill_id AND k.abl_acc_year = j.abj_against_bill_acc_year
         WHERE j.abj_bill_id = ${noteAblId}::uuid AND j.abj_bill_acc_year = ${noteAccYear}::char(9)
           AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL
           AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x WHERE x.abj_reversal_of_id = j.abj_id AND x.abj_is_deleted = false)
           AND j.abj_adj_type = 'NOTE_ADJUST' AND j.abj_voucher_id IS NULL
           AND k.abl_dr_cr = 'DR' AND k.abl_created_on < n.abl_created_on`).map((r) => ({
            ablId: r.abl_id,
            ablAccYear: r.abl_acc_year.trim(),
            refno: r.abl_doc_refno ?? null,
        }));
    }
    async adjustedBills(c, row) {
        const rows = await c.$queryRaw `
      SELECT k.abl_id, k.abl_doc_refno, j.abj_amount AS amount
        FROM accounts.acc_bill_adjustment j
        JOIN accounts.acc_bill_balance b ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year
        JOIN accounts.acc_bill_balance k ON k.abl_id = j.abj_against_bill_id AND k.abl_acc_year = j.abj_against_bill_acc_year
       WHERE b.abl_src_doc_id = ${row.srId}::uuid AND b.abl_acc_year = ${row.srAccYear}::char(9)
         AND b.abl_src_doc_type = 'SALE_RETURN' AND b.abl_is_deleted = false
         AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL AND j.abj_dr_cr = 'DR'
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x WHERE x.abj_reversal_of_id = j.abj_id AND x.abj_is_deleted = false)
         -- OWN_ADJUST_AT_POST (adjustedAtPost): what the return itself set off.
         AND j.abj_adj_type = 'NOTE_ADJUST' AND j.abj_voucher_id IS NULL
         AND k.abl_dr_cr = 'DR' AND k.abl_created_on < b.abl_created_on`;
        return rows.map((r) => ({ ablId: r.abl_id, refno: r.abl_doc_refno, amount: (0, sales_doc_utils_1.num)(r.amount) }));
    }
    async assertUnwindable(tx, row, reason, verb) {
        const keys = this.store.keysOf(row);
        const docDate = (0, sales_doc_utils_1.isoDate)(row.srReturnDate) ?? (0, sales_doc_utils_1.isoToday)();
        await (0, sales_guards_1.assertAccYearWritable)(tx, keys.companyId, keys.accYear, 'srAccYear');
        if (await (0, sales_guards_1.loadDayClosed)(tx, keys.companyId, keys.branchId, docDate)) {
            (0, sales_errors_1.throwSalesLocked)(`The books for ${docDate} are closed at this branch`, posting_types_1.SALES_ERROR_CODES.DAY_CLOSED, 'srReturnDate');
        }
        const [note] = await tx.$queryRaw `
      SELECT abl_id FROM accounts.acc_bill_balance
       WHERE abl_src_doc_type = 'SALE_RETURN' AND abl_src_doc_id = ${row.srId}::uuid
         AND abl_acc_year = ${row.srAccYear}::char(9) AND abl_is_deleted = false
       FOR UPDATE`;
        if ((await this.creditApplied(tx, row)) > 0) {
            (0, sales_errors_1.throwSalesLocked)('This credit note has been set off against a bill or refunded — money has moved; reverse it with a document, not by un-doing this one', posting_types_1.SALES_ERROR_CODES.CN_APPLIED, 'srId');
        }
        await this.assertAdjustedBillsWritable(tx, row, note?.abl_id ?? null, verb);
        const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
        const { irnLive, ewbLive } = await (0, sales_guards_1.loadDeclaredLocks)(tx, gdrId);
        if (irnLive || ewbLive) {
            const gst = await this.blocks.gstRows(tx, gdrId, keys.accYear);
            if (irnLive) {
                const w = gst.irnGeneratedOn
                    ? await this.statutory.withinCancelWindow(keys.companyId, 'IRN', gst.irnGeneratedOn, docDate, new Date(), tx)
                    : { within: false };
                if (!w.within) {
                    (0, sales_errors_1.throwSalesLocked)(`The credit note IRN's cancellation window has passed — it cannot be ${verb === 'cancel' ? 'cancelled' : 'amended'} now`, posting_types_1.SALES_ERROR_CODES.IRN_WINDOW_PASSED, 'posting.irn');
                }
                await this.gst.cancelIrn({
                    gdrId: gdrId,
                    accYear: keys.accYear,
                    companyId: keys.companyId,
                    reason,
                });
            }
            if (ewbLive) {
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
                    reason,
                });
            }
        }
    }
    async unwind(tx, row, actor, actorName, reason, now, verb = 'cancel') {
        const keys = this.store.keysOf(row);
        let reversal = null;
        if (row.srPostedVoucherId) {
            const r = await this.legs.reverseLegs(tx, row.srPostedVoucherId, keys.accYear, reason, actor);
            if (r) {
                const [v] = await tx.$queryRaw `SELECT avh_voucher_refno FROM accounts.acc_voucher_header WHERE avh_voucher_id = ${r.voucherId}::uuid AND avh_acc_year = ${keys.accYear}::char(9)`;
                reversal = v?.avh_voucher_refno ?? null;
            }
        }
        await this.stock.cancel(tx, {
            docType: 'SALE_RETURN',
            docId: keys.id,
            accYear: keys.accYear,
            companyId: keys.companyId,
            branchId: keys.branchId,
            direction: 'IN',
            txnType: 'SALE_RETURN',
        }, actor, reason, now);
        const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
        if (gdrId) {
            if (verb === 'amend') {
                await this.register.retire(tx, gdrId, keys.accYear, actor);
            }
            else {
                await this.register.cancel(tx, gdrId, keys.accYear, reason, actor);
            }
        }
        const cn = await tx.accBillBalance.findFirst({
            where: {
                ablSrcDocId: keys.id,
                ablAccYear: keys.accYear,
                ablSrcDocType: 'SALE_RETURN',
                ablIsDeleted: false,
            },
            select: { ablId: true },
        });
        if (cn && row.srCustId) {
            for (const target of await this.adjustedAtPost(tx, cn.ablId, keys.accYear)) {
                const [billAbl] = await tx.$queryRaw `
          SELECT abl_id, abl_acc_year, abl_bill_amount, abl_alloc_amount, abl_branch_id FROM accounts.acc_bill_balance
           WHERE abl_id = ${target.ablId}::uuid AND abl_acc_year = ${target.ablAccYear}::char(9) AND abl_is_deleted = false
             FOR UPDATE`;
                if (!billAbl) {
                    continue;
                }
                const year = billAbl.abl_acc_year.trim();
                await (0, bill_adjustment_helper_1.reverseBillAdjustmentsWith)(tx, this.adjustCtx(row, billAbl, year, actor), { ablId: cn.ablId, ablAccYear: keys.accYear }, `Sale return ${row.srReturnRefno ?? keys.id} ${verb === 'amend' ? 'amended' : 'cancelled'}`, actor, now);
            }
        }
        if (cn) {
            await tx.accBillBalance.update({
                where: { ablId_ablAccYear: { ablId: cn.ablId, ablAccYear: keys.accYear } },
                data: {
                    ablIsActive: false,
                    ablIsDeleted: true,
                    ablNarration: reason,
                    ablModifiedOn: now,
                    ablModifiedBy: actor,
                },
            });
        }
        await this.loyalty.reverseForCancel(tx, {
            docId: keys.id,
            accYear: keys.accYear,
            docType: 'SALE_RETURN',
            docRefno: row.srReturnRefno,
        }, { reason, createdBy: actor });
        await this.promo.reverse(tx, { docId: keys.id, accYear: keys.accYear }, reason, actor);
        return reversal;
    }
    async notTakenOf(tx, header, items, money, opts = {}) {
        const claim = (header.srReturnKind ?? 'RETURN').toUpperCase() === 'CLAIM';
        const srId = header.srId ?? null;
        let rows = (0, sale_return_delivery_1.notTakenRowsOf)(items, money, new Map());
        const lines = await (0, sale_return_delivery_1.loadNotTakenLines)(tx, this.deliveryPending, rows, isUuid(srId) ? srId : null);
        if (lines.size > 0 || rows.some((r) => r.typed !== null && r.typed.gt(0))) {
            rows = (0, sale_return_delivery_1.notTakenRowsOf)(items, money, await (0, sale_return_delivery_1.unitNamesOf)(tx, items.map((i) => i.sriItemUnitId)));
        }
        if (opts.posted && opts.posted.size > 0) {
            rows = (0, sale_return_delivery_1.withKeptNotTaken)(rows, opts.posted);
        }
        return { rows, lines, verdict: (0, sale_return_delivery_1.resolveNotTaken)(rows, lines, claim), claim };
    }
    static refusalsOf(issues) {
        return issues.map((i) => ({
            code: i.code,
            message: i.message,
            field: i.field,
            line: i.line,
            params: i.params,
        }));
    }
    async applyNotTaken(tx, body, money, opts = {}) {
        const items = body.items ?? [];
        if (items.length === 0) {
            return;
        }
        const posted = opts.amend && isUuid(body.srId)
            ? (0, sale_return_delivery_1.postedNotTakenOf)(await this.store.loadItems(tx, body))
            : null;
        const nt = await this.notTakenOf(tx, body, items, money, { posted });
        const rowRules = nt.verdict.issues.filter((i) => i.code === delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_RETURN_OVER_QTY ||
            i.code === delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_RETURN_CLAIM);
        if (rowRules.length > 0) {
            (0, sales_errors_1.throwSalesRefusals)('Sale return not saved', SaleReturnService_1.refusalsOf(rowRules));
        }
        body.items = items.map((item, i) => ({
            ...item,
            sriUndeliveredQty: nt.verdict.rows[i]?.resolvedQty ?? sale_return_money_1.ZERO,
        }));
    }
    async deliveryGuards(tx, header, items, money, g, posted = null) {
        const nt = await this.notTakenOf(tx, header, items, money, { posted });
        const issues = [...nt.verdict.issues];
        const srId = header.srId ?? null;
        if (isUuid(srId) && nt.lines.size > 0) {
            issues.push(...(0, sale_return_delivery_1.amendLockIssues)(nt.rows, nt.verdict, await (0, sale_return_delivery_1.returnEventsOf)(tx, srId)));
        }
        for (const i of issues) {
            (0, sales_guards_1.refuse)(g, i.code, i.message, { field: i.field, line: i.line, params: i.params });
        }
        return nt;
    }
    async writeReturnEvents(tx, row, items, money, actor, now) {
        const srId = row.srId;
        const nt = await this.notTakenOf(tx, row, items, money);
        const moved = nt.verdict.issues.filter((i) => i.code === delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_RETURN_OVER ||
            i.code === delivery_constants_1.DELIVERY_ERROR_CODES.DELIVERY_RETURN_NOT_GIVEN);
        if (moved.length > 0) {
            (0, sales_errors_1.throwSalesRefusals)('Sale return cannot be posted', SaleReturnService_1.refusalsOf(moved));
        }
        const events = nt.lines.size > 0 ? await (0, sale_return_delivery_1.returnEventsOf)(tx, srId) : null;
        if (!events) {
            return;
        }
        const at = row.srReturnDatetime ?? now;
        const accYear = row.srAccYear.trim();
        const refno = row.srReturnRefno ?? null;
        const deviceId = row.srDeviceId ?? null;
        const bills = new Map();
        const kept = new Set();
        nt.rows.forEach((r, i) => {
            const res = nt.verdict.rows[i];
            const bl = r.billItemId && r.billAccYear ? nt.lines.get(`${r.billItemId}|${r.billAccYear}`) : undefined;
            if (!r.sriId || !bl || !bl.eligible || !res || res.resolvedBase.lte(0)) {
                return;
            }
            kept.add(r.sriId);
        });
        for (let i = 0; i < nt.rows.length; i++) {
            const r = nt.rows[i];
            const res = nt.verdict.rows[i];
            if (!r.sriId || !kept.has(r.sriId)) {
                continue;
            }
            const bl = nt.lines.get(`${r.billItemId}|${r.billAccYear}`);
            bills.set(`${bl.billId}|${bl.billAccYear}`, { billId: bl.billId, billAccYear: bl.billAccYear });
            if (events.live.has(r.sriId)) {
                continue;
            }
            const blFactor = bl.factor.gt(0) ? bl.factor : (0, sale_return_money_1.D)(1);
            const base = res.resolvedBase.toDecimalPlaces(6, client_1.Prisma.Decimal.ROUND_HALF_UP);
            const qty = res.resolvedBase.dividedBy(blFactor).toDecimalPlaces(3, client_1.Prisma.Decimal.ROUND_HALF_UP);
            await tx.$executeRaw `
        INSERT INTO sales.sale_delivery_event (
          sde_company_id, sde_branch_id, sde_tenant_id, sde_acc_year, sde_kind,
          sde_bill_id, sde_bill_acc_year, sde_bill_item_id, sde_bill_line_no, sde_item_id,
          sde_godown_id, sde_lot_id,
          sde_settle_qty, sde_settle_base_qty, sde_out_qty, sde_out_base_qty,
          sde_src_doc_type, sde_src_doc_id, sde_src_acc_year, sde_src_line_id, sde_src_refno,
          sde_event_datetime, sde_reason, sde_device_id, sde_created_on, sde_created_by
        ) VALUES (
          ${row.srCompanyId}::uuid, ${row.srBranchId}::uuid,
          ${row.srTenantId ?? null}::uuid, ${accYear}::bpchar, 'RETURN',
          ${bl.billId}::uuid, ${bl.billAccYear}::bpchar, ${bl.billItemId}::uuid, ${bl.lineNo}::int,
          ${bl.itemId}::uuid, ${bl.godownId}::uuid, ${bl.lotId}::uuid,
          ${qty}::numeric, ${base}::numeric, 0, 0,
          'SALE_RETURN', ${srId}::uuid, ${accYear}::bpchar, ${r.sriId}::uuid, ${refno},
          ${at}::timestamptz, ${'Sale return: goods never taken'}, ${deviceId}, ${now}::timestamptz, ${actor}
        )`;
        }
        for (const [sriId, ev] of events.live) {
            bills.set(`${ev.billId}|${ev.billAccYear}`, { billId: ev.billId, billAccYear: ev.billAccYear });
            if (!kept.has(sriId)) {
                await this.insertReturnCancel(tx, row, ev, sriId, actor, now, 'Sale return amended: not taken cleared');
            }
        }
        await this.deliveryStatus.recompute(tx, [...bills.values()]);
    }
    async cancelReturnEvents(tx, row, actor, now, reason) {
        if (!row.srBillId) {
            return;
        }
        const events = await (0, sale_return_delivery_1.returnEventsOf)(tx, row.srId);
        const bills = new Map();
        for (const [sriId, ev] of events.live) {
            bills.set(`${ev.billId}|${ev.billAccYear}`, { billId: ev.billId, billAccYear: ev.billAccYear });
            await this.insertReturnCancel(tx, row, ev, sriId, actor, now, reason);
        }
        if (bills.size > 0) {
            await this.deliveryStatus.recompute(tx, [...bills.values()]);
        }
    }
    async insertReturnCancel(tx, row, ev, sriId, actor, now, reason) {
        await tx.$executeRaw `
      INSERT INTO sales.sale_delivery_event (
        sde_company_id, sde_branch_id, sde_tenant_id, sde_acc_year, sde_kind,
        sde_bill_id, sde_bill_acc_year, sde_bill_item_id, sde_bill_line_no, sde_item_id,
        sde_godown_id, sde_lot_id,
        sde_settle_qty, sde_settle_base_qty, sde_out_qty, sde_out_base_qty,
        sde_src_doc_type, sde_src_doc_id, sde_src_acc_year, sde_src_line_id, sde_src_refno,
        sde_reverses_id, sde_event_datetime, sde_reason, sde_device_id, sde_created_on, sde_created_by
      )
      SELECT e.sde_company_id, e.sde_branch_id, e.sde_tenant_id, e.sde_acc_year, 'RETURN_CANCEL',
             e.sde_bill_id, e.sde_bill_acc_year, e.sde_bill_item_id, e.sde_bill_line_no, e.sde_item_id,
             e.sde_godown_id, e.sde_lot_id,
             -e.sde_settle_qty, -e.sde_settle_base_qty, 0, 0,
             e.sde_src_doc_type, e.sde_src_doc_id, e.sde_src_acc_year, e.sde_src_line_id, e.sde_src_refno,
             e.sde_id, ${now}::timestamptz, ${reason.slice(0, 200)},
             ${row.srDeviceId ?? null}, ${now}::timestamptz, ${actor}
        FROM sales.sale_delivery_event e
       WHERE e.sde_id = ${ev.sdeId}::uuid AND e.sde_acc_year = ${ev.accYear}::bpchar`;
        void sriId;
    }
    async withDeliveryPreview(tx, preview, items, money, nt, claim) {
        const lines = preview.lines.map((l, i) => {
            const r = nt.verdict.rows[i];
            return {
                ...l,
                sriUndeliveredQty: r ? (0, sale_return_money_1.n)(r.resolvedQty) : 0,
                undeliveredDefaultQty: r ? (0, sale_return_money_1.n)(r.defaultQty) : 0,
                billPendingQty: r ? (0, sale_return_money_1.n)(r.billPendingQty) : 0,
                billPendingBase: r ? (0, sale_return_money_1.n)(r.billPendingBase) : 0,
            };
        });
        const byBucket = new Map();
        money.lines.forEach((l, i) => {
            if (l.qtyBase.lte(0) || l.copy?.isService || !(0, sale_return_preview_1.bringsStock)(items[i], claim)) {
                return;
            }
            const bucket = (0, sale_return_preview_1.lineBucketOf)(items[i], claim);
            byBucket.set(bucket, (byBucket.get(bucket) ?? sale_return_money_1.ZERO).plus(nt.verdict.rows[i]?.resolvedBase ?? sale_return_money_1.ZERO));
        });
        const stockByBucket = preview.stockByBucket.map((b) => ({
            ...b,
            undeliveredBase: (0, sale_return_money_1.n)((0, sale_return_money_1.r6)(byBucket.get(b.bucket) ?? sale_return_money_1.ZERO)),
        }));
        return {
            ...preview,
            lines,
            stockByBucket,
            ...(await this.deliveryAfterJson(tx, nt.verdict)),
        };
    }
    async deliveryAfterJson(tx, verdict) {
        const delivery = verdict.delivery.map((d) => ({
            billId: d.billId,
            billAccYear: d.billAccYear,
            billRefno: d.billRefno,
            billItemId: d.billItemId,
            billLineNo: d.billLineNo,
            unitName: d.unitName,
            pendingBefore: (0, sale_return_money_1.n)(d.pendingBefore),
            pendingAfter: (0, sale_return_money_1.n)(d.pendingAfter),
        }));
        if (verdict.delivery.length === 0) {
            return { delivery, deliveryStatusAfter: null };
        }
        const first = verdict.delivery[0];
        const facts = await this.deliveryPending.linesOfBills(tx, [
            { billId: first.billId, billAccYear: first.billAccYear },
        ]);
        const settle = new Map(verdict.delivery.map((d) => [d.billItemId, d]));
        const status = (0, sale_return_delivery_1.deliveryStatusOf)(facts.map((f) => {
            const s = settle.get(f.billItemId);
            const settled = s ? f.billedQty.minus(s.pendingBefore).plus(s.settleQty) : f.settledQty;
            return {
                eligible: f.eligible,
                settled,
                pending: f.billedQty.minus(settled),
                given: f.givenQty,
            };
        }), facts.length > 0 && facts[0].billStatus === 'POSTED' && !facts[0].billDeleted);
        return { delivery, deliveryStatusAfter: status };
    }
    async withDeliveryOnGet(c, doc) {
        const items = doc.items ?? [];
        if (items.length === 0) {
            return doc;
        }
        const money = {
            lines: items.map((i) => ({
                qty: (0, sale_return_money_1.D)(i.sriReturnQty).plus((0, sale_return_money_1.D)(i.sriFreeQty)),
                factor: (0, sale_return_money_1.D)(i.sriToBaseFactor || 1),
                billItemId: i.sriBillItemId ?? null,
                billAccYear: (i.sriBillAccYear ?? null)?.trim() ?? null,
            })),
        };
        const draft = doc.srStatus === 'DRAFT';
        const posted = doc.srStatus === 'POSTED';
        const nt = await this.notTakenOf(c, doc, items, money, {
            posted: posted ? (0, sale_return_delivery_1.postedNotTakenOf)(items) : null,
        });
        const withDefault = draft || posted;
        return {
            ...doc,
            items: items.map((i, idx) => {
                const r = nt.verdict.rows[idx];
                return {
                    ...i,
                    billPendingQty: r ? (0, sale_return_money_1.n)(r.billPendingQty) : 0,
                    billPendingBase: r ? (0, sale_return_money_1.n)(r.billPendingBase) : 0,
                    ...(withDefault ? { undeliveredDefaultQty: r ? (0, sale_return_money_1.n)(r.defaultQty) : 0 } : {}),
                };
            }),
            ...(draft ? await this.deliveryAfterJson(c, nt.verdict) : {}),
        };
    }
    async billPendingOf(c, lines, srId) {
        const rows = lines.map((l, i) => ({
            index: i,
            lineNo: i + 1,
            sriId: null,
            billItemId: l.billItemId,
            billAccYear: l.accYear.trim(),
            godownId: null,
            lotId: null,
            condition: null,
            qty: sale_return_money_1.ZERO,
            factor: (0, sale_return_money_1.D)(1),
            typed: null,
            unitName: null,
        }));
        const facts = await (0, sale_return_delivery_1.loadNotTakenLines)(c, this.deliveryPending, rows, isUuid(srId) ? srId : null);
        const out = new Map();
        for (const f of facts.values()) {
            const base = f.eligible ? client_1.Prisma.Decimal.max(sale_return_money_1.ZERO, f.pendingBase) : sale_return_money_1.ZERO;
            const factor = f.factor.gt(0) ? f.factor : (0, sale_return_money_1.D)(1);
            out.set(f.billItemId, {
                base: (0, sale_return_money_1.r6)(base),
                qty: base.dividedBy(factor).toDecimalPlaces(3, client_1.Prisma.Decimal.ROUND_DOWN),
            });
        }
        return out;
    }
    async transport(dto) {
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            await this.assertRight('edit', tx);
            const row = await this.store.lock(tx, this.keys(dto));
            if (row.srStatus === 'CANCELLED') {
                (0, sales_errors_1.throwSalesLocked)('This sale return is CANCELLED', posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED, 'srId');
            }
            const actor = this.salesContext.actor();
            const gdrId = await this.register.registerIdOf(tx, row.srId, row.srAccYear);
            const band = await this.transportBand.write(tx, {
                docType: 'SALE_RETURN',
                docId: row.srId,
                accYear: row.srAccYear,
                companyId: row.srCompanyId,
                branchId: row.srBranchId,
                tenantId: row.srTenantId,
                docRefno: row.srReturnRefno,
            }, { ...dto.transport, direction: 'INWARD' }, actor, { gdrId, now });
            await this.store.trail(tx, row, 'TRANSPORT_EDITED', row.srStatus, row.srStatus, actor, now, null);
            return band;
        });
    }
};
exports.SaleReturnService = SaleReturnService;
exports.SaleReturnService = SaleReturnService = SaleReturnService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sales_context_service_1.SalesContextService,
        statutory_service_1.StatutoryService,
        voucher_posting_service_1.VoucherPostingService,
        doc_register_service_1.DocRegisterService,
        sales_stock_service_1.SalesStockService,
        sales_doc_blocks_service_1.SalesDocBlocksService,
        transport_band_service_1.TransportBandService,
        loyalty_ledger_service_1.LoyaltyLedgerService,
        promotion_usage_service_1.PromotionUsageService,
        gst_gateway_service_1.GstGatewayService,
        audit_log_service_1.AuditLogService,
        charge_detail_service_1.ChargeDetailService,
        tender_detail_service_1.TenderDetailService,
        till_session_service_1.TillSessionService,
        till_approval_service_1.TillApprovalService,
        delivery_pending_service_1.DeliveryPendingService,
        delivery_status_service_1.DeliveryStatusService])
], SaleReturnService);
function agentCommOf(money) {
    if (!money.bill || !money.priorHeader || money.bill.agentCommAmt.lte(0)) {
        return null;
    }
    return (0, sale_return_settlement_1.proRataBack)({
        onBill: money.bill.agentCommAmt,
        prior: money.priorHeader.agentComm,
        part: money.lines.reduce((t, l) => t.plus(l.parts.taxableAmt), sale_return_money_1.ZERO),
        whole: money.billLines.reduce((t, l) => t.plus(l.parts.taxableAmt), sale_return_money_1.ZERO),
        emptiesBill: money.emptiesBill,
    });
}
function auditRecordOf(doc) {
    const { locks: _locks, rights: _rights, ...record } = doc;
    void _locks;
    void _rights;
    const items = Array.isArray(record.items) ? record.items : [];
    return {
        ...record,
        items: items.map((i) => {
            const { sriItemName: _i, sriUnitName: _u, sriGodownName: _g, ...line } = i;
            void _i;
            void _u;
            void _g;
            return line;
        }),
    };
}
function claimFieldsOf(item, claim) {
    const sriBucket = (0, sale_return_preview_1.lineBucketOf)(item, claim);
    if (!claim) {
        return { sriClaimGoods: null, sriSupplierClaim: false, sriBucket };
    }
    const goods = (item.sriClaimGoods ?? '').toUpperCase() || null;
    if (goods === 'BACK') {
        return { sriClaimGoods: 'BACK', sriSupplierClaim: true, sriBucket };
    }
    return { sriClaimGoods: goods, sriSupplierClaim: false, sriBucket };
}
function settleStatusOf(f) {
    const ways = [f.refunded, f.adjusted, f.pointsBackAmt, f.credited].filter((v) => v.gt(0)).length;
    if (ways <= 1) {
        if (f.refunded.gt(0)) {
            return 'REFUNDED';
        }
        if (f.adjusted.gt(0)) {
            return 'ADJUSTED';
        }
        return 'CREDITED';
    }
    return 'PARTIAL';
}
function financialLegs(legs) {
    const isTax = (l) => (l.roleTag ?? '').startsWith('OUTPUT_');
    const dr = legs.filter((l) => isTax(l) && l.drCr === 'DR').reduce((t, l) => t + l.amount, 0);
    const cr = legs.filter((l) => isTax(l) && l.drCr === 'CR').reduce((t, l) => t + l.amount, 0);
    const rest = legs.filter((l) => !isTax(l));
    const net = Math.round((dr - cr) * 100) / 100;
    if (net !== 0) {
        rest.push({
            role: 'CLAIMS_ALLOWED',
            roleTag: 'CLAIMS_ALLOWED',
            drCr: net > 0 ? 'DR' : 'CR',
            amount: Math.abs(net),
            field: 'taxes',
        });
    }
    return rest;
}
function adjustAsksOf(rows) {
    if (rows === undefined) {
        return null;
    }
    return rows.map((r, index) => ({
        index,
        ablId: r.ablId,
        ablAccYear: r.ablAccYear,
        amount: (0, sale_return_money_1.D)(r.amount),
        dueNow: r.dueNow === undefined || r.dueNow === null ? null : (0, sale_return_money_1.D)(r.dueNow),
    }));
}
function refundTendersFromRows(rows) {
    return rows.map((r, index) => ({
        index,
        tenderId: r.tdTenderId ?? null,
        tenderTypeId: Number(r.tdTenderTypeId ?? 0),
        amount: (0, sale_return_money_1.D)((r.tdAmount ?? 0)),
        refNo: r.tdRefNo ?? null,
    }));
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) {
    return !!v && UUID.test(v);
}
//# sourceMappingURL=sale-return.service.js.map