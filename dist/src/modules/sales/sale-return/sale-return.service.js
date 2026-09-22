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
exports.SaleReturnService = exports.SR_SPEC = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const charge_detail_service_1 = require("../../master/charge-detail/charge-detail.service");
const charge_enum_1 = require("../../master/charge-master/types/charge-enum");
const tender_detail_service_1 = require("../../accountsModule/tenderDetail/tender-detail.service");
const tender_detail_api_types_1 = require("../../accountsModule/tenderDetail/types/tender-detail-api.types");
const bill_adjustment_helper_1 = require("../bill/bill-adjustment.helper");
const doc_register_service_1 = require("../posting/doc-register.service");
const gst_gateway_service_1 = require("../posting/gst-gateway.service");
const loyalty_ledger_service_1 = require("../posting/loyalty-ledger.service");
const promotion_usage_service_1 = require("../posting/promotion-usage.service");
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
    headerWhereUnique: 'srId_srAccYear',
    itemWhereUnique: 'sriId_sriAccYear',
};
const BUCKET_BY_CONDITION = {
    RESTOCK: 'SALEABLE',
    DAMAGED: 'DAMAGED',
    EXPIRED: 'EXPIRED',
    SCRAP: 'QUARANTINE',
};
const TX = { timeout: 60_000, maxWait: 10_000 };
let SaleReturnService = class SaleReturnService {
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
    store;
    constructor(prisma, salesContext, statutory, legs, register, stock, blocks, transportBand, loyalty, promo, gst, audit, charges, tenders) {
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
        this.store = new sales_doc_store_1.SalesDocStore(exports.SR_SPEC, audit, charges, tenders, transportBand);
    }
    keys(dto) {
        return {
            id: dto.srId,
            companyId: dto.srCompanyId,
            branchId: dto.srBranchId,
            accYear: dto.srAccYear,
        };
    }
    async save(dto) {
        const actor = this.salesContext.actor();
        const now = new Date();
        const row = await this.prisma.$transaction(async (tx) => {
            const body = { ...dto };
            if (dto.srIsAgainstBill !== false && dto.srBillId && dto.srBillAccYear) {
                const bill = await this.bill(tx, dto.srBillId, dto.srBillAccYear);
                if (bill) {
                    body.srIsAgainstBill = true;
                    body.srBillRefno = body.srBillRefno ?? bill.sb_bill_refno;
                    body.srBillDate = body.srBillDate ?? (0, sales_doc_utils_1.isoDate)(bill.sb_bill_date);
                    body.srCustId = body.srCustId ?? bill.sb_cust_id;
                }
            }
            return this.store.saveDraft(tx, body, actor, now, {
                beforeWrite: (data) => {
                    if (data.srReturnDatetime === undefined) {
                        data.srReturnDatetime = now;
                    }
                },
            });
        }, TX);
        return this.get(this.store.keysOf(row));
    }
    async get(keys) {
        const c = this.prisma;
        const row = await this.store.findOrThrow(c, keys);
        const [items, charges, tenders, transport, rights, gdrId, cnApplied] = await Promise.all([
            this.store.loadItems(c, row),
            this.store.loadCharges(row),
            this.store.loadTenders(row),
            this.store.loadTransport(c, row),
            this.salesContext.rights(exports.SR_SPEC.menuId, c),
            this.register.registerIdOf(c, keys.id, keys.accYear),
            this.creditApplied(c, row),
        ]);
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
        return {
            ...this.store.plain(row),
            items: items.map((i) => this.store.plain(i)),
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
            locks,
            rights,
        };
    }
    async delete(dto) {
        const actor = this.salesContext.actor();
        await this.prisma.$transaction((tx) => this.store.deleteDraft(tx, this.keys(dto), actor, new Date()), TX);
        return { srId: dto.srId, deleted: true };
    }
    async billLines(sbId, sbAccYear) {
        const rows = await this.prisma.$queryRaw `
      SELECT b.sbi_id AS "billItemId", b.sbi_line_no AS "lineNo", im.item_name_en AS "itemName", u.unit_name AS "unitName",
             b.sbi_item_id AS "itemId", b.sbi_item_unit_id AS "itemUnitId", b.sbi_godown_id AS "godownId",
             b.sbi_bill_qty AS "billQty",
             COALESCE((SELECT SUM(r.sri_return_qty + r.sri_free_qty) FROM sales.sale_return_item r
                         JOIN sales.sale_return h ON h.sr_id = r.sri_return_id AND h.sr_acc_year = r.sri_acc_year
                        WHERE r.sri_bill_item_id = b.sbi_id AND r.sri_is_deleted = false AND h.sr_is_deleted = false
                          AND h.sr_status = 'POSTED'), 0) AS "returnedQty",
             im.item_allow_sales_return AS "returnable",
             b.sbi_is_free AS "isFree", b.sbi_free_type AS "freeType", b.sbi_lot_id AS "lotId", b.sbi_batch_no AS "batchNo",
             b.sbi_rate AS "rate", b.sbi_tax_perc AS "taxPerc", b.sbi_tax_id AS "taxId", b.sbi_hsn_code AS "hsnCode",
             b.sbi_cogs_amt AS "cost", b.sbi_scheme_id AS "schemeId", b.sbi_taxable_amt AS "taxableAmt"
        FROM sales.sale_bill_item b
        JOIN inventory.item_master im ON im.item_id = b.sbi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = b.sbi_item_unit_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
       WHERE b.sbi_bill_id = ${sbId}::uuid AND b.sbi_acc_year = ${sbAccYear}::char(9) AND b.sbi_is_deleted = false
       ORDER BY b.sbi_line_no`;
        return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [
            k,
            v instanceof client_1.Prisma.Decimal ? Number(v.toString()) : v,
        ])));
    }
    async validate(dto) {
        const ctx = await this.salesContext.resolve({ companyId: dto.srCompanyId, branchId: dto.srBranchId, deviceId: dto.srDeviceId }, exports.SR_SPEC.menuId);
        const g = (0, posting_types_1.createGuardContext)({
            overrides: dto.overrides ?? [],
            canOverride: ctx.rights.override,
            throwOnRefusal: false,
        });
        const items = (dto.items ?? []).map((i, idx) => ({
            ...i,
            sriLineNo: i.sriLineNo ?? idx + 1,
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
            if (row.srStatus === 'POSTED') {
                return;
            }
            if (row.srStatus === 'CANCELLED') {
                (0, sales_errors_1.throwSalesLocked)('This sale return is CANCELLED', posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED, 'srId');
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
                (0, sales_errors_1.throwSalesRefusals)('Sale return cannot be posted', g.refusals);
            }
            fire = await this.postCore(tx, row, items, ctx, new Date(), 'DRAFT');
        }, TX);
        if (fire) {
            this.gst.enqueueAfterPost(fire);
        }
        return this.get(this.keys(dto));
    }
    async ctxOf(tx, row) {
        return this.salesContext.resolve({
            companyId: row.srCompanyId,
            branchId: row.srBranchId,
            deviceId: row.srDeviceId,
        }, exports.SR_SPEC.menuId, tx);
    }
    async bill(tx, sbId, sbAccYear) {
        const [b] = await tx.$queryRaw `
      SELECT sb_id, sb_acc_year, sb_status, sb_bill_refno, sb_bill_date, sb_bill_amt, sb_taxable_amt, sb_cust_id,
             sb_loyalty_member_id, sb_loyalty_earn_points, sb_returned_amt
        FROM sales.sale_bill WHERE sb_id = ${sbId}::uuid AND sb_acc_year = ${sbAccYear}::char(9) AND sb_is_deleted = false`;
        return b ?? null;
    }
    async guards(tx, row, items, ctx, g) {
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
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.PAN_REQUIRED, 'A sale return must name a customer — the credit note is raised against the customer ledger', { field: 'srCustId' });
        }
        if (items.length === 0) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.STOCK_QTY_MISMATCH, 'A return with no lines cannot be posted', {
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
            if (i.sriIsFree && !ctx.settings.freeReturnAllowed) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.FREE_RETURN_OFF, `Line ${String(i.sriLineNo)}: free goods cannot be returned (sales.free_return_allowed)`, { field: 'items', line: i.sriLineNo });
            }
        }
        const against = row.srIsAgainstBill !== false && row.srBillId;
        if (against) {
            const bill = await this.bill(tx, row.srBillId, row.srBillAccYear.trim());
            if (!bill || bill.sb_status !== 'POSTED') {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.RETURN_BILL_NOT_POSTED, 'The bill this return is against is not POSTED', { field: 'srBillId' });
            }
            else {
                const billDate = (0, sales_doc_utils_1.isoDate)(bill.sb_bill_date);
                if (ctx.settings.returnWindowDays > 0 &&
                    (0, sales_doc_utils_1.daysBetween)(billDate, docDate) > ctx.settings.returnWindowDays) {
                    (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.RETURN_WINDOW, `The bill is ${(0, sales_doc_utils_1.daysBetween)(billDate, docDate)} days old; the return window is ${ctx.settings.returnWindowDays} days`, { field: 'srBillId' });
                }
                const cutoff = await this.statutory.creditNoteCutoff(companyId, billDate, docDate, tx);
                if (cutoff.passed && cutoff.limit) {
                    const st = {
                        code: cutoff.limit.code,
                        value: cutoff.limit.valueText,
                        effectiveFrom: cutoff.limit.effectiveFrom,
                        isCompanyOverride: cutoff.limit.isCompanyOverride,
                    };
                    const msg = `A credit note for a ${billDate} invoice had to be declared by ${cutoff.cutoff}`;
                    (cutoff.limit.enforce === 'REFUSE' ? sales_guards_1.refuse : sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.CREDIT_NOTE_CUTOFF, msg, { field: 'srReturnDate', statutory: st });
                }
                const lines = await tx.$queryRaw `
          SELECT b.sbi_id, b.sbi_bill_qty AS sold,
                 (SELECT SUM(r.sri_return_qty + r.sri_free_qty) FROM sales.sale_return_item r
                    JOIN sales.sale_return h ON h.sr_id = r.sri_return_id AND h.sr_acc_year = r.sri_acc_year
                   WHERE r.sri_bill_item_id = b.sbi_id AND r.sri_is_deleted = false AND h.sr_is_deleted = false
                     AND h.sr_status = 'POSTED' AND h.sr_id <> ${row.srId ?? '00000000-0000-0000-0000-000000000000'}::uuid) AS returned
            FROM sales.sale_bill_item b
           WHERE b.sbi_bill_id = ${bill.sb_id}::uuid AND b.sbi_acc_year = ${bill.sb_acc_year}::char(9) AND b.sbi_is_deleted = false`;
                const by = new Map(lines.map((l) => [l.sbi_id, (0, sales_doc_utils_1.num)(l.sold) - (0, sales_doc_utils_1.num)(l.returned)]));
                const taken = new Map();
                for (const i of items) {
                    const k = i.sriBillItemId;
                    if (!k) {
                        continue;
                    }
                    taken.set(k, (taken.get(k) ?? 0) +
                        (0, sales_doc_utils_1.num)(i.sriReturnQty) +
                        (0, sales_doc_utils_1.num)(i.sriFreeQty));
                }
                for (const [k, qty] of taken) {
                    const open = by.get(k);
                    if (open === undefined) {
                        (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.RETURN_OVER_QTY, `Bill line ${k} is not on this bill`, {
                            field: 'items',
                        });
                    }
                    else if (qty > open + 0.0005) {
                        (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.RETURN_OVER_QTY, `Bill line has ${open} returnable; this return takes ${qty}`, { field: 'items' });
                    }
                }
                if (mode === 'ADJUST') {
                    const [abl] = await tx.$queryRaw `
            SELECT abl_pending_amount FROM accounts.acc_bill_balance
             WHERE abl_src_doc_id = ${bill.sb_id}::uuid AND abl_acc_year = ${bill.sb_acc_year}::char(9) AND abl_src_doc_type = 'SALE_BILL'
               AND abl_is_deleted = false AND abl_is_active = true`;
                    if ((0, sales_doc_utils_1.num)(abl?.abl_pending_amount) <= 0) {
                        (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.CN_APPLIED, 'The bill is already settled — nothing to adjust against; the balance will be left as an open credit', { field: 'srSettleMode' });
                    }
                }
            }
        }
        else if (mode === 'ADJUST') {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.AMOUNT_MISMATCH, 'ADJUST needs a bill to adjust against — this return is not against a bill', { field: 'srSettleMode' });
        }
        if (mode === 'CASH') {
            const tenders = await this.store.loadTenders(row);
            const total = (0, sales_doc_utils_1.round2)(tenders.reduce((t, x) => t + (0, sales_doc_utils_1.num)(x.tdAmount), 0));
            if (Math.abs(total - (0, sales_doc_utils_1.num)(row.srReturnAmt)) > 0.01) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.AMOUNT_MISMATCH, `CASH settlement: tenders total ${total} against a return of ${(0, sales_doc_utils_1.num)(row.srReturnAmt)}`, { field: 'tenders' });
            }
        }
    }
    async postCore(tx, row, items, ctx, now, fromStatus, revisionNo) {
        const actor = ctx.actor;
        const keys = this.store.keysOf(row);
        const partyId = row.srCustId;
        const refno = row.srReturnRefno ?? keys.id;
        const docDate = (0, sales_doc_utils_1.isoDate)(row.srReturnDate) ?? (0, sales_doc_utils_1.isoToday)();
        const returnAmt = (0, sales_doc_utils_1.num)(row.srReturnAmt);
        const mode = (row.srSettleMode ?? 'ADJUST').toUpperCase();
        const tenders = await this.store.loadTenders(row);
        const charges = await this.store.loadCharges(row);
        const [company] = await tx.$queryRaw `
      SELECT comp_state_code, comp_einvoice_applicable FROM public.companys WHERE comp_id = ${keys.companyId}::uuid`;
        const nature = (0, sales_doc_utils_1.supplyNatureOf)(company?.comp_state_code, row.srPosStcd);
        const moving = items.filter((i) => !i.sriIsService &&
            (0, sales_doc_utils_1.num)(i.sriReturnQty) + (0, sales_doc_utils_1.num)(i.sriFreeQty) > 0);
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
            lines: moving.map((i) => ({
                lineId: i.sriId,
                lineNo: i.sriLineNo,
                itemId: i.sriItemId,
                itemUnitId: i.sriItemUnitId,
                godownId: i.sriGodownId,
                lotId: i.sriLotId,
                bucket: i.sriBucket ??
                    BUCKET_BY_CONDITION[i.sriCondition ?? 'RESTOCK'] ??
                    'SALEABLE',
                qty: (0, sales_doc_utils_1.num)(i.sriReturnQty),
                freeQty: (0, sales_doc_utils_1.num)(i.sriFreeQty),
                weightQty: i.sriWeightQty === null ? null : (0, sales_doc_utils_1.num)(i.sriWeightQty),
                toBaseFactor: (0, sales_doc_utils_1.num)(i.sriToBaseFactor) || null,
                batchNo: i.sriBatchNo,
                batchDate: (0, sales_doc_utils_1.isoDate)(i.sriBatchDate),
                expiryDate: (0, sales_doc_utils_1.isoDate)(i.sriExpiryDate),
                serialNo: i.sriSerialNo,
                mrp: i.sriMaxPrice === null ? null : (0, sales_doc_utils_1.num)(i.sriMaxPrice),
                rate: (0, sales_doc_utils_1.num)(i.sriRate),
                costRate: (0, sales_doc_utils_1.num)(i.sriCostPrice) || null,
                taxPerc: (0, sales_doc_utils_1.num)(i.sriTaxPerc),
            })),
        }, actor, now);
        for (const i of moving) {
            await this.store.updateItem(tx, i, {
                sriLotId: stock.lotByLine.get(i.sriId) ?? i.sriLotId ?? null,
            });
        }
        const cogs = ctx.cogsMode === 'PERPETUAL' ? stock.cogsTotal : 0;
        const n = (k) => (0, sales_doc_utils_1.num)(row[k]);
        const legs = (0, sales_leg_sources_1.buildReturnLegs)({
            partyLedgerId: partyId,
            supplyNature: nature,
            salesAmount: n('srTaxableAmt'),
            taxes: (0, sales_doc_utils_1.bucketTaxes)(items.map((i) => ({
                taxId: i.sriTaxId,
                cgst: (0, sales_doc_utils_1.num)(i.sriCgstAmt),
                sgst: (0, sales_doc_utils_1.num)(i.sriSgstAmt),
                igst: (0, sales_doc_utils_1.num)(i.sriIgstAmt),
                cess: (0, sales_doc_utils_1.num)(i.sriCessAmt),
            }))),
            charges: charges.map((c) => ({
                ledgerId: c.cdLedgerCode,
                amount: (0, sales_doc_utils_1.num)(c.cdAmount),
                separatelyPosted: c.cdSepPost,
                cgst: (0, sales_doc_utils_1.num)(c.cdCgstAmt),
                sgst: (0, sales_doc_utils_1.num)(c.cdSgstAmt),
                igst: (0, sales_doc_utils_1.num)(c.cdIgstAmt),
                cess: (0, sales_doc_utils_1.num)(c.cdCessAmt),
                name: c.cdChgName,
            })),
            cashDiscount: n('srCashDisc'),
            schemeDiscount: ctx.settings.postSchemeDiscSeparately
                ? n('srSchDisc') + n('srBillSchDisc')
                : 0,
            roundOff: n('srRoundOff'),
            tenders: mode === 'CASH'
                ? tenders.map((t) => ({
                    tenderTypeId: Number(t.tdTenderTypeId),
                    tenderLedgerId: t.tdTenderLedgerId,
                    amount: (0, sales_doc_utils_1.num)(t.tdAmount),
                    isLoyalty: Number(t.tdTenderTypeId) === sales_doc_utils_1.TENDER_TYPE.LOYALTY,
                    isCredit: [sales_doc_utils_1.TENDER_TYPE.CREDIT, sales_doc_utils_1.TENDER_TYPE.TEMP_CREDIT].includes(Number(t.tdTenderTypeId)),
                    name: t.tdTenderName,
                }))
                : [],
            cogsAmount: cogs,
        });
        const voucher = await this.legs.postLegs(tx, {
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
                docAmount: returnAmt,
                roundOff: n('srRoundOff'),
                partyId,
                userId: isUuid(row.srUserId) ? row.srUserId : actor,
                sessionId: row.srSessionId,
                deviceType: row.srDeviceType,
                remarks: row.srReturnReason,
                deviceCode: row.srBillMode === 'POS' ? row.srDeviceId : null,
                createdBy: actor,
                presetRefno: row.srReturnRefno,
                presetNo: row.srReturnSlno,
            },
            legs,
        });
        const reg = await this.register.write(tx, this.registerDoc(row, items, charges, voucher.voucherId, voucher.voucherLastNo, nature, actor), {
            companyEinvoiceFlag: company?.comp_einvoice_applicable ?? false,
            interState: nature === 'INTER',
        });
        const refunded = mode === 'CASH'
            ? (0, sales_doc_utils_1.round2)(tenders
                .filter((t) => ![sales_doc_utils_1.TENDER_TYPE.CREDIT, sales_doc_utils_1.TENDER_TYPE.TEMP_CREDIT].includes(Number(t.tdTenderTypeId)))
                .reduce((t, x) => t + (0, sales_doc_utils_1.num)(x.tdAmount), 0))
            : 0;
        const cnAbl = await tx.accBillBalance.create({
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
                ablVoucherNo: row.srReturnSlno ?? voucher.voucherLastNo,
                ablVoucherDate: row.srReturnDate,
                ablVoucherRefno: refno,
                ablDocRefno: refno,
                ablDocDate: row.srReturnDate,
                ablDrCr: 'CR',
                ablBillAmount: new client_1.Prisma.Decimal(returnAmt.toFixed(2)),
                ablAllocAmount: new client_1.Prisma.Decimal(Math.min(refunded, returnAmt).toFixed(2)),
                ablNarration: row.srReturnReason,
                ablCreatedOn: now,
                ablCreatedBy: actor,
            },
            select: { ablId: true },
        });
        let adjusted = 0;
        if (mode === 'ADJUST' && row.srBillId) {
            const bill = await this.bill(tx, row.srBillId, row.srBillAccYear.trim());
            const [billAbl] = bill
                ? await tx.$queryRaw `
            SELECT abl_id, abl_pending_amount, abl_bill_amount, abl_alloc_amount FROM accounts.acc_bill_balance
             WHERE abl_src_doc_id = ${bill.sb_id}::uuid AND abl_acc_year = ${bill.sb_acc_year}::char(9) AND abl_src_doc_type = 'SALE_BILL'
               AND abl_is_deleted = false AND abl_is_active = true FOR UPDATE`
                : [];
            const pending = (0, sales_doc_utils_1.num)(billAbl?.abl_pending_amount);
            adjusted = (0, sales_doc_utils_1.round2)(Math.min(pending, returnAmt));
            if (bill && billAbl && adjusted > 0) {
                const live = await this.liveAdjustments(tx, billAbl.abl_id, bill.sb_acc_year);
                await (0, bill_adjustment_helper_1.syncBillAdjustments)(tx, {
                    billId: billAbl.abl_id,
                    billAccYear: bill.sb_acc_year,
                    billAmount: billAbl.abl_bill_amount,
                    paidAmount: billAbl.abl_alloc_amount,
                    companyId: keys.companyId,
                    branchId: keys.branchId,
                    tenantId: row.srTenantId,
                    accYear: bill.sb_acc_year,
                    partyId,
                    adjDate: row.srReturnDate,
                    userId: isUuid(row.srUserId) ? row.srUserId : actor,
                    sessionId: row.srSessionId,
                }, [
                    ...live,
                    {
                        againstBillId: cnAbl.ablId,
                        againstBillAccYear: keys.accYear,
                        amount: adjusted,
                    },
                ], actor, now);
            }
        }
        const credited = (0, sales_doc_utils_1.round2)(returnAmt - refunded - adjusted);
        const settleStatus = refunded >= returnAmt - 0.005
            ? 'REFUNDED'
            : adjusted >= returnAmt - 0.005
                ? 'ADJUSTED'
                : refunded + adjusted <= 0.005
                    ? 'CREDITED'
                    : 'PARTIAL';
        let loyaltyReversed = 0;
        let promoClawback = (0, sales_doc_utils_1.round2)(items.reduce((t, i) => t + (0, sales_doc_utils_1.num)(i.sriSchDiscAmt) + (0, sales_doc_utils_1.num)(i.sriBillSchAmt), 0));
        if (row.srBillId) {
            const bill = await this.bill(tx, row.srBillId, row.srBillAccYear.trim());
            if (bill?.sb_loyalty_member_id &&
                (0, sales_doc_utils_1.num)(bill.sb_loyalty_earn_points) > 0 &&
                (0, sales_doc_utils_1.num)(bill.sb_taxable_amt) > 0) {
                const share = n('srTaxableAmt') / (0, sales_doc_utils_1.num)(bill.sb_taxable_amt);
                const cb = await this.loyalty.clawbackForReturn(tx, {
                    docId: keys.id,
                    accYear: keys.accYear,
                    companyId: keys.companyId,
                    branchId: keys.branchId,
                    docDate,
                    docRefno: refno,
                    memberId: bill.sb_loyalty_member_id,
                }, share, { earnedOnBill: (0, sales_doc_utils_1.num)(bill.sb_loyalty_earn_points), createdBy: actor });
                loyaltyReversed = cb.clawedBack;
            }
            if (bill) {
                const returnedAmt = (0, sales_doc_utils_1.round2)((0, sales_doc_utils_1.num)(bill.sb_returned_amt) + returnAmt);
                await tx.$executeRaw `
          UPDATE sales.sale_bill SET sb_returned_amt = ${returnedAmt}::numeric,
                 sb_return_status = CASE WHEN ${returnedAmt}::numeric >= sb_bill_amt - 0.005 THEN 'FULL' ELSE 'PARTIAL' END,
                 sb_modified_on = ${now}, sb_modified_by = ${actor}
           WHERE sb_id = ${bill.sb_id}::uuid AND sb_acc_year = ${bill.sb_acc_year}::char(9)`;
            }
        }
        else {
            promoClawback = 0;
        }
        await this.store.setStatus(tx, row, 'POSTED', {
            srPostedVoucherId: voucher.voucherId,
            srTotalCost: new client_1.Prisma.Decimal(stock.cogsTotal.toFixed(2)),
            srRefundAmt: new client_1.Prisma.Decimal(refunded.toFixed(2)),
            srAdjustedAmt: new client_1.Prisma.Decimal(adjusted.toFixed(2)),
            srCreditAmt: new client_1.Prisma.Decimal(credited.toFixed(2)),
            srSettleStatus: settleStatus,
            srLoyaltyReversePoints: new client_1.Prisma.Decimal(loyaltyReversed),
            srPromoClawbackAmt: new client_1.Prisma.Decimal(promoClawback.toFixed(2)),
            ...(revisionNo ? { srRevisionNo: revisionNo } : {}),
        }, actor, now);
        await this.store.trail(tx, row, txn_status_log_helper_1.TxnStatusEvent.POSTED, fromStatus, 'POSTED', actor, now, revisionNo ? `Re-posted as revision ${revisionNo}` : null);
        await this.store.auditChange(tx, row, 'approve', { srStatus: fromStatus }, {
            srStatus: 'POSTED',
            srPostedVoucherId: voucher.voucherId,
            gdrId: reg.gdrId,
            refunded,
            adjusted,
            credited,
        }, actor, `Sale return posted (voucher ${voucher.voucherRefno})`);
        return { gdrId: reg.gdrId, einvoice: reg.einvoiceApplicable, ewaybill: reg.ewaybillApplicable };
    }
    async liveAdjustments(tx, ablId, accYear) {
        const rows = await tx.$queryRaw `
      SELECT j.abj_against_bill_id, j.abj_against_bill_acc_year, j.abj_amount
        FROM accounts.acc_bill_adjustment j
       WHERE j.abj_bill_id = ${ablId}::uuid AND j.abj_bill_acc_year = ${accYear}::char(9)
         AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL AND j.abj_dr_cr = 'CR'
         AND j.abj_adj_type IN ('ADVANCE_ADJUST', 'NOTE_ADJUST')
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment r WHERE r.abj_reversal_of_id = j.abj_id AND r.abj_is_deleted = false)`;
        return rows.map((r) => ({
            againstBillId: r.abj_against_bill_id,
            againstBillAccYear: r.abj_against_bill_acc_year.trim(),
            amount: (0, sales_doc_utils_1.num)(r.abj_amount),
        }));
    }
    registerDoc(row, items, charges, voucherId, voucherNo, nature, actor) {
        const d = (k) => (0, sales_doc_utils_1.num)(row[k]);
        const other = charges
            .filter((c) => c.cdSepPost)
            .reduce((t, c) => t +
            (0, sales_doc_utils_1.num)(c.cdAmount) +
            (0, sales_doc_utils_1.num)(c.cdCgstAmt) +
            (0, sales_doc_utils_1.num)(c.cdSgstAmt) +
            (0, sales_doc_utils_1.num)(c.cdIgstAmt) +
            (0, sales_doc_utils_1.num)(c.cdCessAmt), 0);
        const lines = items.map((i) => {
            const n = (k) => (0, sales_doc_utils_1.num)(i[k]);
            const tax = n('sriCgstAmt') + n('sriSgstAmt') + n('sriIgstAmt') + n('sriCessAmt');
            return {
                rowNo: i.sriLineNo,
                itemId: i.sriItemId,
                hsnCode: i.sriHsnCode,
                unitId: i.sriItemUnitId,
                qty: n('sriReturnQty'),
                rate: n('sriRate'),
                discount: n('sriItemDiscAmt') + n('sriSplDiscAmt') + n('sriSchDiscAmt') + n('sriBillSchAmt'),
                isService: i.sriIsService ?? false,
                taxableValue: n('sriTaxableAmt'),
                taxId: i.sriTaxId,
                totalTaxRate: n('sriTaxPerc'),
                cgstRate: n('sriCgstPerc'),
                sgstRate: n('sriSgstPerc'),
                igstRate: n('sriIgstPerc'),
                cessRate: n('sriCessPerc'),
                cgstAmount: n('sriCgstAmt'),
                sgstAmount: n('sriSgstAmt'),
                igstAmount: n('sriIgstAmt'),
                cessAmount: n('sriCessAmt'),
                otherAmount: 0,
                totalValue: (0, sales_doc_utils_1.round2)(n('sriTaxableAmt') + tax),
                billValue: n('sriNetAmt') || (0, sales_doc_utils_1.round2)(n('sriTaxableAmt') + tax),
                taxability: tax > 0 || n('sriTaxPerc') > 0 ? 'TAXABLE' : 'EXEMPT',
                supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
            };
        });
        const taxed = lines.filter((l) => l.taxability === 'TAXABLE').length;
        return {
            companyId: row.srCompanyId,
            branchId: row.srBranchId,
            accYear: row.srAccYear,
            voucherId,
            voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.SALE_RETURN,
            voucherNo: row.srReturnSlno ?? (0, sales_doc_utils_1.numericTail)(row.srReturnRefno, voucherNo),
            voucherDate: (0, sales_doc_utils_1.isoDate)(row.srReturnDate),
            voucherRefno: row.srReturnRefno,
            sourceDocId: row.srId,
            docType: 'CREDIT_NOTE',
            tranNature: 'SALES_RETURN',
            docFlow: 'OUTWARD',
            docSign: -1,
            docNo: row.srReturnRefno,
            docDate: (0, sales_doc_utils_1.isoDate)(row.srReturnDate),
            docRefNo: row.srBillRefno ?? row.srUsrRefno,
            taxability: taxed === 0 ? 'EXEMPT' : taxed === lines.length ? 'TAXABLE' : 'MIXED',
            supplyClass: 'GOODS',
            supplyNature: nature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
            placeOfSupplyCode: row.srPosStcd,
            placeOfSupplyName: row.srStateName,
            partyId: row.srCustId,
            partyName: row.srCustName,
            partyAddr1: row.srCustAddr,
            partyLocation: row.srCustPlace,
            partyPin: row.srCustPin,
            partyStateCode: row.srCustStcd,
            partyStateName: row.srStateName,
            partyGstType: row.srCustGstType,
            partyGstin: (row.srCustGstin ?? '').trim() || null,
            grossValue: d('srGrossAmt'),
            discountValue: d('srDiscAmt') ||
                d('srItemDisc') + d('srSplDisc') + d('srSchDisc') + d('srBillSchDisc') + d('srCashDisc'),
            taxableValue: d('srTaxableAmt'),
            cgstValue: d('srCgstAmt'),
            sgstValue: d('srSgstAmt'),
            igstValue: d('srIgstAmt'),
            cessValue: d('srCessAmt'),
            stateCessValue: 0,
            tcsValue: 0,
            otherCharge: (0, sales_doc_utils_1.round2)(other),
            roundOff: d('srRoundOff'),
            billValue: d('srReturnAmt'),
            remarks: row.srReturnReason,
            createdBy: actor,
            lines,
        };
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
            await this.assertUnwindable(tx, row, dto.reason, 'cancel');
            const reversal = await this.unwind(tx, row, ctx.actor, dto.reason, now);
            await this.store.setStatus(tx, row, 'CANCELLED', {}, ctx.actor, now);
            await this.store.trail(tx, row, txn_status_log_helper_1.TxnStatusEvent.CANCELLED, 'POSTED', 'CANCELLED', ctx.actor, now, dto.reason);
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
            const gdrId = await this.register.registerIdOf(tx, keys.id, keys.accYear);
            await (0, sales_guards_1.assertAmendable)(tx, gdrId);
            await this.assertUnwindable(tx, row, dto.editRemark, 'amend');
            const before = this.store.plain(row);
            await this.unwind(tx, row, ctx.actor, `Amended: ${dto.editRemark}`, now);
            const draft = await this.store.setStatus(tx, row, 'DRAFT', {
                srPostedVoucherId: null,
                srRefundAmt: 0,
                srAdjustedAmt: 0,
                srCreditAmt: 0,
                srSettleStatus: 'PENDING',
                srLoyaltyReversePoints: 0,
                srPromoClawbackAmt: 0,
            }, ctx.actor, now);
            await this.store.trail(tx, draft, txn_status_log_helper_1.TxnStatusEvent.AMENDED, 'POSTED', 'DRAFT', ctx.actor, now, dto.editRemark);
            const { baseRevision: _b, editRemark: _e, overrides: _o, ...saveDto } = dto;
            void _b;
            void _e;
            void _o;
            const saved = await this.store.saveDraft(tx, { ...saveDto, srId: keys.id }, ctx.actor, now);
            const items = await this.store.loadItems(tx, saved);
            const g = (0, posting_types_1.createGuardContext)({
                overrides: dto.overrides ?? [],
                canOverride: ctx.rights.override,
                throwOnRefusal: false,
            });
            await this.guards(tx, saved, items, ctx, g);
            if (g.refusals.length > 0) {
                (0, sales_errors_1.throwSalesRefusals)('Sale return cannot be amended', g.refusals);
            }
            fire = await this.postCore(tx, saved, items, ctx, now, 'DRAFT', row.srRevisionNo + 1);
            await this.store.auditChange(tx, saved, 'update', before, this.store.plain(saved), ctx.actor, `Sale return amended to revision ${row.srRevisionNo + 1}: ${dto.editRemark}`);
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
       WHERE b.abl_src_doc_id = ${row.srId}::uuid AND b.abl_acc_year = ${row.srAccYear}::char(9)
         AND b.abl_src_doc_type = 'SALE_RETURN' AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x WHERE x.abj_reversal_of_id = j.abj_id AND x.abj_is_deleted = false)
         -- Its own ADJUST settlement against the original bill is not somebody else's use.
         AND NOT (j.abj_adj_type = 'NOTE_ADJUST' AND j.abj_against_bill_id IN (
               SELECT abl_id FROM accounts.acc_bill_balance WHERE abl_src_doc_id = ${row.srBillId ?? '00000000-0000-0000-0000-000000000000'}::uuid))`;
        return Number(r?.n ?? 0);
    }
    async adjustedBills(c, row) {
        const rows = await c.$queryRaw `
      SELECT k.abl_id, k.abl_doc_refno, j.abj_amount AS amount
        FROM accounts.acc_bill_adjustment j
        JOIN accounts.acc_bill_balance b ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year
        JOIN accounts.acc_bill_balance k ON k.abl_id = j.abj_against_bill_id AND k.abl_acc_year = j.abj_against_bill_acc_year
       WHERE b.abl_src_doc_id = ${row.srId}::uuid AND b.abl_acc_year = ${row.srAccYear}::char(9)
         AND b.abl_src_doc_type = 'SALE_RETURN' AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL AND j.abj_dr_cr = 'DR'
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x WHERE x.abj_reversal_of_id = j.abj_id AND x.abj_is_deleted = false)`;
        return rows.map((r) => ({ ablId: r.abl_id, refno: r.abl_doc_refno, amount: (0, sales_doc_utils_1.num)(r.amount) }));
    }
    async assertUnwindable(tx, row, reason, verb) {
        const keys = this.store.keysOf(row);
        const docDate = (0, sales_doc_utils_1.isoDate)(row.srReturnDate) ?? (0, sales_doc_utils_1.isoToday)();
        await (0, sales_guards_1.assertAccYearWritable)(tx, keys.companyId, keys.accYear, 'srAccYear');
        if (await (0, sales_guards_1.loadDayClosed)(tx, keys.companyId, keys.branchId, docDate)) {
            (0, sales_errors_1.throwSalesLocked)(`The books for ${docDate} are closed at this branch`, posting_types_1.SALES_ERROR_CODES.DAY_CLOSED, 'srReturnDate');
        }
        if ((await this.creditApplied(tx, row)) > 0) {
            (0, sales_errors_1.throwSalesLocked)('This credit note has been set off against a bill or refunded — money has moved; reverse it with a document, not by un-doing this one', posting_types_1.SALES_ERROR_CODES.CN_APPLIED, 'srId');
        }
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
    async unwind(tx, row, actor, reason, now) {
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
            await this.register.cancel(tx, gdrId, keys.accYear, reason, actor);
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
        if (cn && row.srBillId && row.srCustId) {
            const bill = await this.bill(tx, row.srBillId, row.srBillAccYear.trim());
            const [billAbl] = bill
                ? await tx.$queryRaw `
            SELECT abl_id, abl_bill_amount, abl_alloc_amount FROM accounts.acc_bill_balance
             WHERE abl_src_doc_id = ${bill.sb_id}::uuid AND abl_acc_year = ${bill.sb_acc_year}::char(9) AND abl_src_doc_type = 'SALE_BILL' AND abl_is_deleted = false FOR UPDATE`
                : [];
            if (bill && billAbl) {
                const live = (await this.liveAdjustments(tx, billAbl.abl_id, bill.sb_acc_year)).filter((a) => a.againstBillId !== cn.ablId);
                await (0, bill_adjustment_helper_1.syncBillAdjustments)(tx, {
                    billId: billAbl.abl_id,
                    billAccYear: bill.sb_acc_year,
                    billAmount: billAbl.abl_bill_amount,
                    paidAmount: billAbl.abl_alloc_amount,
                    companyId: keys.companyId,
                    branchId: keys.branchId,
                    tenantId: row.srTenantId,
                    accYear: bill.sb_acc_year,
                    partyId: row.srCustId,
                    adjDate: row.srReturnDate,
                    userId: isUuid(row.srUserId) ? row.srUserId : actor,
                    sessionId: row.srSessionId,
                }, live, actor, now);
                const returnedAmt = Math.max(0, (0, sales_doc_utils_1.round2)((0, sales_doc_utils_1.num)(bill.sb_returned_amt) - (0, sales_doc_utils_1.num)(row.srReturnAmt)));
                await tx.$executeRaw `
          UPDATE sales.sale_bill SET sb_returned_amt = ${returnedAmt}::numeric,
                 sb_return_status = CASE WHEN ${returnedAmt}::numeric <= 0.005 THEN NULL WHEN ${returnedAmt}::numeric >= sb_bill_amt - 0.005 THEN 'FULL' ELSE 'PARTIAL' END,
                 sb_modified_on = ${now}, sb_modified_by = ${actor}
           WHERE sb_id = ${bill.sb_id}::uuid AND sb_acc_year = ${bill.sb_acc_year}::char(9)`;
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
    async transport(dto) {
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
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
exports.SaleReturnService = SaleReturnService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sales_context_service_1.SalesContextService,
        statutory_service_1.StatutoryService,
        sales_posting_service_1.SalesPostingService,
        doc_register_service_1.DocRegisterService,
        sales_stock_service_1.SalesStockService,
        sales_doc_blocks_service_1.SalesDocBlocksService,
        transport_band_service_1.TransportBandService,
        loyalty_ledger_service_1.LoyaltyLedgerService,
        promotion_usage_service_1.PromotionUsageService,
        gst_gateway_service_1.GstGatewayService,
        audit_log_service_1.AuditLogService,
        charge_detail_service_1.ChargeDetailService,
        tender_detail_service_1.TenderDetailService])
], SaleReturnService);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) {
    return !!v && UUID.test(v);
}
//# sourceMappingURL=sale-return.service.js.map