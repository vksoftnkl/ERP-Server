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
var BillLifecycleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillLifecycleService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const sale_order_service_1 = require("../sale-order/sale-order.service");
const charge_carry_service_1 = require("../posting/charge-carry.service");
const dc_fulfilment_service_1 = require("../posting/dc-fulfilment.service");
const doc_register_service_1 = require("../posting/doc-register.service");
const gst_gateway_service_1 = require("../posting/gst-gateway.service");
const loyalty_ledger_service_1 = require("../posting/loyalty-ledger.service");
const promotion_usage_service_1 = require("../posting/promotion-usage.service");
const sales_context_service_1 = require("../posting/sales-context.service");
const sales_doc_blocks_service_1 = require("../posting/sales-doc-blocks.service");
const sales_leg_sources_1 = require("../posting/sales-leg.sources");
const sales_posting_service_1 = require("../posting/sales-posting.service");
const sales_stock_service_1 = require("../posting/sales-stock.service");
const stock_reservation_service_1 = require("../posting/stock-reservation.service");
const statutory_service_1 = require("../posting/statutory.service");
const transport_band_service_1 = require("../posting/transport-band.service");
const sales_guards_1 = require("../posting/sales.guards");
const sales_errors_1 = require("../posting/sales.errors");
const posting_types_1 = require("../posting/types/posting.types");
const sales_doc_utils_1 = require("../posting/sales-doc.utils");
const bill_service_1 = require("./bill.service");
const bill_adjustment_helper_1 = require("./bill-adjustment.helper");
const bill_snapshot_1 = require("./bill-snapshot");
const bill_api_types_1 = require("./types/bill-api.types");
const POST_TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 };
let BillLifecycleService = BillLifecycleService_1 = class BillLifecycleService {
    prisma;
    bills;
    salesContext;
    statutory;
    legs;
    register;
    stock;
    reservations;
    loyalty;
    promo;
    chargeCarry;
    dcFulfilment;
    saleOrders;
    transportBand;
    docBlocks;
    gst;
    audit;
    logger = new common_1.Logger(BillLifecycleService_1.name);
    constructor(prisma, bills, salesContext, statutory, legs, register, stock, reservations, loyalty, promo, chargeCarry, dcFulfilment, saleOrders, transportBand, docBlocks, gst, audit) {
        this.prisma = prisma;
        this.bills = bills;
        this.salesContext = salesContext;
        this.statutory = statutory;
        this.legs = legs;
        this.register = register;
        this.stock = stock;
        this.reservations = reservations;
        this.loyalty = loyalty;
        this.promo = promo;
        this.chargeCarry = chargeCarry;
        this.dcFulfilment = dcFulfilment;
        this.saleOrders = saleOrders;
        this.transportBand = transportBand;
        this.docBlocks = docBlocks;
        this.gst = gst;
        this.audit = audit;
    }
    async validate(dto) {
        const ctx = await this.salesContext.resolve({ companyId: dto.sbCompanyId, branchId: dto.sbBranchId, deviceId: dto.sbDeviceId }, sales_doc_utils_1.SALES_MENU_ID.SALE_BILL);
        const masters = await this.tenderMasters(this.prisma, (dto.tenders ?? []).map((t) => t.tdTenderId));
        const snap = (0, bill_snapshot_1.snapshotFromDto)(dto, masters);
        const guard = (0, posting_types_1.createGuardContext)({
            overrides: dto.overrides ?? [],
            canOverride: ctx.rights.override,
            throwOnRefusal: false,
            dryRun: true,
        });
        await this.prisma.$transaction(async (tx) => {
            await this.runGuards(tx, snap, ctx, guard, { adjustments: dto.adjustments });
        });
        const proposals = await this.proposals(snap, ctx);
        return {
            ok: guard.refusals.length === 0,
            refusals: guard.refusals,
            warnings: guard.warnings,
            rights: ctx.rights,
            proposals,
        };
    }
    async post(dto) {
        let posted = null;
        await this.prisma.$transaction(async (tx) => {
            const bill = await this.bills.lockHeader(tx, dto);
            if (bill.sbStatus === bill_api_types_1.BILL_STATUS_POSTED) {
                return;
            }
            if (bill.sbStatus === bill_api_types_1.BILL_STATUS_CANCELLED) {
                (0, sales_errors_1.throwSalesLocked)('This bill is CANCELLED', posting_types_1.SALES_ERROR_CODES.BILL_CANCELLED, 'sbId');
            }
            const ctx = await this.salesContext.resolve({ companyId: bill.sbCompanyId, branchId: bill.sbBranchId, deviceId: bill.sbDeviceId }, sales_doc_utils_1.SALES_MENU_ID.SALE_BILL, tx);
            if (!ctx.rights.post) {
                (0, sales_errors_1.throwSalesRight)('This user may not post on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_POST);
            }
            const parts = await this.bills.loadParts(tx, bill);
            const snap = (0, bill_snapshot_1.snapshotFromRows)(bill, parts.items, parts.charges, parts.tenders);
            const guard = (0, posting_types_1.createGuardContext)({
                overrides: dto.overrides ?? [],
                canOverride: ctx.rights.override,
                throwOnRefusal: false,
            });
            await this.runGuards(tx, snap, ctx, guard, { adjustments: dto.adjustments });
            if (guard.refusals.length > 0) {
                (0, sales_errors_1.throwSalesRefusals)('Bill cannot be posted', guard.refusals);
            }
            posted = await this.postCore(tx, bill, parts.items, snap, ctx, {
                adjustments: dto.adjustments,
                now: new Date(),
                fromStatus: bill_api_types_1.BILL_STATUS_DRAFT,
            });
        }, POST_TX_OPTIONS);
        if (posted) {
            const p = posted;
            this.gst.enqueueAfterPost({ gdrId: p.gdrId, einvoice: p.einvoice, ewaybill: p.ewaybill });
        }
        return this.bills.getById(dto.sbId, dto.sbCompanyId, dto.sbBranchId, dto.sbAccYear);
    }
    async cancel(dto) {
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const bill = await this.bills.lockHeader(tx, dto);
            if (bill.sbStatus === bill_api_types_1.BILL_STATUS_CANCELLED) {
                return this.cancelResponse(tx, bill, now);
            }
            if (bill.sbStatus !== bill_api_types_1.BILL_STATUS_POSTED) {
                (0, sales_errors_1.throwSalesLocked)('Only a POSTED bill can be cancelled — a DRAFT is deleted', posting_types_1.SALES_ERROR_CODES.DOC_NOT_DRAFT, 'sbId');
            }
            const ctx = await this.salesContext.resolve({ companyId: bill.sbCompanyId, branchId: bill.sbBranchId, deviceId: bill.sbDeviceId }, sales_doc_utils_1.SALES_MENU_ID.SALE_BILL, tx);
            if (!ctx.rights.cancel) {
                (0, sales_errors_1.throwSalesRight)('This user may not cancel on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_CANCEL);
            }
            await this.assertUnwindable(tx, bill, ctx, dto.reason, 'cancel');
            const items = await tx.saleBillItem.findMany({
                where: { sbiBillId: bill.sbId, sbiAccYear: bill.sbAccYear, sbiIsDeleted: false },
            });
            const reversal = await this.unwind(tx, bill, items, ctx, dto.reason, now);
            const cancelled = await tx.saleBill.update({
                where: { sbId_sbAccYear: { sbId: bill.sbId, sbAccYear: bill.sbAccYear } },
                data: { sbStatus: bill_api_types_1.BILL_STATUS_CANCELLED, sbModifiedOn: now, sbModifiedBy: ctx.actorName },
            });
            await this.afterStatusChange(tx, cancelled, items, ctx.actor, now);
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: bill.sbCompanyId,
                branchId: bill.sbBranchId,
                tenantId: bill.sbTenantId,
                accYear: bill.sbAccYear,
                srcModule: bill_api_types_1.BILL_STATUS_SRC_MODULE,
                srcDocType: bill_api_types_1.BILL_STATUS_SRC_DOC_TYPE,
                srcDocId: bill.sbId,
                srcDocRefno: bill.sbBillRefno,
                event: txn_status_log_helper_1.TxnStatusEvent.CANCELLED,
                fromStatus: bill_api_types_1.BILL_STATUS_POSTED,
                toStatus: bill_api_types_1.BILL_STATUS_CANCELLED,
                changedOn: now,
                changedBy: ctx.actor,
                remarks: dto.reason,
                deviceId: bill.sbDeviceId,
                sessionId: bill.sbSessionId,
            });
            await this.audit.logEntityChange({
                action: 'cancel',
                tableName: 'sale_bill',
                screenName: 'Sale Bill',
                screenType: 'transaction',
                pk: bill.sbId,
                displayName: bill.sbBillRefno || bill.sbId,
                originalRecord: { sbStatus: bill_api_types_1.BILL_STATUS_POSTED },
                modifiedRecord: { sbStatus: bill_api_types_1.BILL_STATUS_CANCELLED },
                userId: ctx.actor,
                notes: `Bill cancelled: ${dto.reason}`,
            }, tx);
            return {
                sbId: bill.sbId,
                sbCompanyId: bill.sbCompanyId,
                sbBranchId: bill.sbBranchId,
                sbAccYear: bill.sbAccYear,
                sbStatus: bill_api_types_1.BILL_STATUS_CANCELLED,
                reversalVoucherRefno: reversal.reversalRefno,
                cancelledOn: now.toISOString(),
            };
        }, POST_TX_OPTIONS);
    }
    async cancelResponse(tx, bill, now) {
        const [row] = bill.sbPostedVoucherId
            ? await tx.$queryRaw `
          SELECT r.avh_voucher_refno AS refno, o.avh_status_on AS "on"
            FROM accounts.acc_voucher_header o
            LEFT JOIN accounts.acc_voucher_header r
                   ON r.avh_voucher_id = o.avh_reversal_voucher_id AND r.avh_acc_year = o.avh_reversal_acc_year
           WHERE o.avh_voucher_id = ${bill.sbPostedVoucherId}::uuid AND o.avh_acc_year = ${bill.sbAccYear}::char(9)`
            : [];
        return {
            sbId: bill.sbId,
            sbCompanyId: bill.sbCompanyId,
            sbBranchId: bill.sbBranchId,
            sbAccYear: bill.sbAccYear,
            sbStatus: bill_api_types_1.BILL_STATUS_CANCELLED,
            reversalVoucherRefno: row?.refno ?? null,
            cancelledOn: (row?.on ?? bill.sbModifiedOn ?? now).toISOString(),
        };
    }
    async amend(dto) {
        const now = new Date();
        let posted = null;
        await this.prisma.$transaction(async (tx) => {
            const bill = await this.bills.lockHeader(tx, {
                sbId: dto.sbId,
                sbCompanyId: dto.sbCompanyId,
                sbBranchId: dto.sbBranchId,
                sbAccYear: dto.sbAccYear,
            });
            if (bill.sbStatus !== bill_api_types_1.BILL_STATUS_POSTED) {
                (0, sales_errors_1.throwSalesLocked)(bill.sbStatus === bill_api_types_1.BILL_STATUS_CANCELLED
                    ? 'This bill is CANCELLED'
                    : 'This bill is a DRAFT — use /bills/create', bill.sbStatus === bill_api_types_1.BILL_STATUS_CANCELLED
                    ? posting_types_1.SALES_ERROR_CODES.BILL_CANCELLED
                    : posting_types_1.SALES_ERROR_CODES.DOC_NOT_DRAFT, 'sbId');
            }
            const ctx = await this.salesContext.resolve({ companyId: bill.sbCompanyId, branchId: bill.sbBranchId, deviceId: bill.sbDeviceId }, sales_doc_utils_1.SALES_MENU_ID.SALE_BILL, tx);
            if (!ctx.rights.amend) {
                (0, sales_errors_1.throwSalesRight)('This user may not amend on this menu', posting_types_1.SALES_ERROR_CODES.RIGHT_AMEND);
            }
            if (!ctx.settings.allowPostedAmend) {
                (0, sales_errors_1.throwSalesLocked)('Amending a posted bill is switched off (sales.allow_posted_amend)', posting_types_1.SALES_ERROR_CODES.AMEND_OFF, 'sbId');
            }
            if (bill.sbRevisionNo !== dto.baseRevision) {
                (0, sales_errors_1.throwSalesLocked)(`This bill has been amended since you opened it (now revision ${bill.sbRevisionNo}, you sent ${dto.baseRevision}). Reload it and make the change again.`, posting_types_1.SALES_ERROR_CODES.REVISION_STALE, 'baseRevision');
            }
            await (0, sales_guards_1.assertAmendable)(tx, bill.sbDocRegisterId);
            await this.assertUnwindable(tx, bill, ctx, dto.editRemark, 'amend');
            const priorItems = await tx.saleBillItem.findMany({
                where: { sbiBillId: bill.sbId, sbiAccYear: bill.sbAccYear, sbiIsDeleted: false },
            });
            const before = await this.bills.getById(bill.sbId, bill.sbCompanyId, bill.sbBranchId, bill.sbAccYear);
            const { restateVoucherId } = await this.unwind(tx, bill, priorItems, ctx, `Amended: ${dto.editRemark}`, now, 'amend');
            const draft = await tx.saleBill.update({
                where: { sbId_sbAccYear: { sbId: bill.sbId, sbAccYear: bill.sbAccYear } },
                data: {
                    sbStatus: bill_api_types_1.BILL_STATUS_DRAFT,
                    sbPostedVoucherId: null,
                    sbDocRegisterId: null,
                    sbCogsAmt: 0,
                    sbLoyaltyEarned: 0,
                    sbLoyaltyRedeemed: 0,
                    sbLoyaltyEarnPoints: 0,
                    sbLoyaltyRedeemPoints: 0,
                    sbModifiedOn: now,
                    sbModifiedBy: ctx.actorName,
                },
            });
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: bill.sbCompanyId,
                branchId: bill.sbBranchId,
                tenantId: bill.sbTenantId,
                accYear: bill.sbAccYear,
                srcModule: bill_api_types_1.BILL_STATUS_SRC_MODULE,
                srcDocType: bill_api_types_1.BILL_STATUS_SRC_DOC_TYPE,
                srcDocId: bill.sbId,
                srcDocRefno: bill.sbBillRefno,
                event: txn_status_log_helper_1.TxnStatusEvent.AMENDED,
                fromStatus: bill_api_types_1.BILL_STATUS_POSTED,
                toStatus: bill_api_types_1.BILL_STATUS_DRAFT,
                changedOn: now,
                changedBy: ctx.actor,
                remarks: dto.editRemark,
                deviceId: bill.sbDeviceId,
                sessionId: bill.sbSessionId,
            });
            const { baseRevision: _b, editRemark: _e, overrides: _o, printAfter: _p, ...saveDto } = dto;
            void _b;
            void _e;
            void _o;
            void _p;
            const { updated, items } = await this.bills.applySaveInTx(tx, draft, saveDto, ctx.actor, now, {
                notes: `Bill amended (revision ${bill.sbRevisionNo} → ${bill.sbRevisionNo + 1}): ${dto.editRemark}`,
            });
            const parts = await this.bills.loadParts(tx, updated);
            const snap = (0, bill_snapshot_1.snapshotFromRows)(updated, items, parts.charges, parts.tenders);
            const guard = (0, posting_types_1.createGuardContext)({
                overrides: dto.overrides ?? [],
                canOverride: ctx.rights.override,
                throwOnRefusal: false,
            });
            await this.runGuards(tx, snap, ctx, guard, { adjustments: dto.adjustments });
            if (guard.refusals.length > 0) {
                (0, sales_errors_1.throwSalesRefusals)('Bill cannot be amended', guard.refusals);
            }
            posted = await this.postCore(tx, updated, items, snap, ctx, {
                adjustments: dto.adjustments,
                now,
                fromStatus: bill_api_types_1.BILL_STATUS_DRAFT,
                revisionNo: bill.sbRevisionNo + 1,
                restateVoucherId,
            });
            await this.audit.logEntityChange({
                action: 'update',
                tableName: 'sale_bill',
                screenName: 'Sale Bill',
                screenType: 'transaction',
                pk: bill.sbId,
                displayName: bill.sbBillRefno || bill.sbId,
                originalRecord: before,
                modifiedRecord: {
                    ...saveDto,
                    sbRevisionNo: bill.sbRevisionNo + 1,
                },
                userId: ctx.actor,
                notes: `Bill amended to revision ${bill.sbRevisionNo + 1}: ${dto.editRemark}`,
            }, tx);
        }, POST_TX_OPTIONS);
        if (posted) {
            const p = posted;
            this.gst.enqueueAfterPost({ gdrId: p.gdrId, einvoice: p.einvoice, ewaybill: p.ewaybill });
        }
        return this.bills.getById(dto.sbId, dto.sbCompanyId, dto.sbBranchId, dto.sbAccYear);
    }
    async runGuards(tx, snap, ctx, g, opts) {
        const s = ctx.settings;
        const today = (0, sales_doc_utils_1.isoToday)();
        await (0, sales_guards_1.assertAccYearWritable)(tx, snap.companyId, snap.accYear, 'sbAccYear');
        await (0, sales_guards_1.assertVoucherPartitionExists)(tx, snap.accYear, 'sbAccYear');
        if (snap.billDate > today) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.BACKDATE, `A bill cannot be dated ${snap.billDate}, which is in the future`, { field: 'sbBillDate' });
        }
        else if (snap.billDate !== today && s.backdateMode !== 'ALLOW') {
            const msg = `This bill is dated ${snap.billDate}, before today (${today})`;
            if (s.backdateMode === 'REFUSE') {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.BACKDATE, msg, { field: 'sbBillDate' });
            }
            else {
                (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.BACKDATE, msg, { field: 'sbBillDate' });
            }
        }
        if (await (0, sales_guards_1.loadDayClosed)(tx, snap.companyId, snap.branchId, snap.billDate)) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DAY_CLOSED, `The books for ${snap.billDate} are closed at this branch`, { field: 'sbBillDate' });
        }
        if (!snap.custId) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.PAN_REQUIRED, 'A bill must name a customer to post: its voucher and receivable are raised against the customer ledger (the walk-in customer has one too)', { field: 'sbCustId' });
        }
        if (snap.items.length === 0) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.STOCK_QTY_MISMATCH, 'A bill with no lines cannot be posted', {
                field: 'items',
            });
        }
        await (0, sales_guards_1.assertSalesmen)(tx, snap.companyId, snap.salesmanId.length ? snap.salesmanId : null, {
            field: 'sbSalesmanId',
        });
        if (s.salesmanMandatory && snap.salesmanId.length === 0) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.SALESMAN_INVALID, 'A salesman is mandatory on every bill (sales.salesman_mandatory)', { field: 'sbSalesmanId' });
        }
        const cash = (0, bill_snapshot_1.cashTendered)(snap);
        if (cash > 0 && snap.custId) {
            const [row] = await tx.$queryRaw `
        SELECT SUM(t.td_amount) AS cash
          FROM accounts.acc_tender_detail t
          JOIN sales.sale_bill b ON b.sb_id = t.td_src_doc_id AND b.sb_acc_year = t.td_acc_year
         WHERE t.td_party_ledger_id = ${snap.custId}::uuid AND t.td_tender_type_id = ${sales_doc_utils_1.TENDER_TYPE.CASH}
           AND t.td_doc_date = ${snap.billDate}::date AND t.td_is_deleted = false AND t.td_is_voided = false
           AND t.td_src_module = 'SALES' AND t.td_src_doc_type = 'SALE_BILL'
           AND b.sb_status = 'POSTED' AND b.sb_id <> ${snap.sbId ?? '00000000-0000-0000-0000-000000000000'}::uuid`;
            const cashToday = (0, sales_doc_utils_1.num)(row?.cash);
            const isWalkIn = snap.custId === s.defaultCustomerId;
            const limit = await this.statutory.assertCashLimit(snap.companyId, isWalkIn ? cash : cash + cashToday, snap.billDate, tx);
            if (limit.exceeded && limit.limit) {
                const st = {
                    code: limit.limit.code,
                    value: limit.limit.value,
                    effectiveFrom: limit.limit.effectiveFrom,
                    isCompanyOverride: limit.limit.isCompanyOverride,
                };
                const msg = `Cash received from this party today (${(0, sales_doc_utils_1.round2)(cash + (isWalkIn ? 0 : cashToday))}) reaches the ${limit.limit.label} limit of ${limit.limit.value}`;
                if (limit.limit.enforce === 'REFUSE') {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.CASH_LIMIT, msg, { field: 'tenders', statutory: st });
                }
                else {
                    (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.CASH_LIMIT, msg, { field: 'tenders', statutory: st });
                }
            }
            const pan = await this.statutory.assertPanOrForm60(snap.companyId, cash, snap.billDate, tx);
            if (pan.required && pan.limit && !snap.custPan && !snap.form60Ref) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.PAN_REQUIRED, `A cash sale above ${pan.limit.value} needs the customer's PAN or a Form 60 reference`, {
                    field: 'sbCustPan',
                    statutory: {
                        code: pan.limit.code,
                        value: pan.limit.value,
                        effectiveFrom: pan.limit.effectiveFrom,
                        isCompanyOverride: pan.limit.isCompanyOverride,
                    },
                });
            }
        }
        const hsn = await this.statutory.hsnDigits(snap.companyId, snap.billDate, tx);
        if (hsn.digits) {
            for (const i of snap.items) {
                if (!i.isService && (i.hsnCode ?? '').trim().length < hsn.digits) {
                    g.warnings.push({
                        code: posting_types_1.SALES_ERROR_CODES.HSN_DIGITS,
                        level: 'INFO',
                        message: `Line ${i.lineNo}: HSN ${i.hsnCode ?? '(blank)'} is shorter than the ${hsn.digits} digits this company must report`,
                        line: i.lineNo,
                        overridable: false,
                    });
                }
            }
        }
        const separately = s.postSchemeDiscSeparately;
        const debit = (0, bill_snapshot_1.partyDebitOf)(snap, separately);
        if (Math.abs(debit - snap.billAmt) > 0.01) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.AMOUNT_MISMATCH, `The bill does not add up: taxable + tax + charges + round-off + TCS − discounts make ${debit.toFixed(2)}, the bill says ${snap.billAmt.toFixed(2)}`, { field: 'sbBillAmt' });
        }
        const lineTax = (0, sales_doc_utils_1.round2)(snap.items.reduce((t, i) => t + i.cgstAmt + i.sgstAmt + i.igstAmt + i.cessAmt + i.acessAmt, 0));
        if (Math.abs(lineTax - snap.taxAmt) > 0.01) {
            (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.AMOUNT_MISMATCH, `Line taxes total ${lineTax.toFixed(2)} but sbTaxAmt says ${snap.taxAmt.toFixed(2)}`, { field: 'sbTaxAmt' });
        }
        const tendered = (0, sales_doc_utils_1.round2)(snap.tenders.reduce((t, x) => t + x.amount, 0));
        (0, sales_guards_1.assertTenderTotal)(g, tendered + (0, bill_snapshot_1.setOffAmtOf)(snap), snap.billAmt, s);
        const settled = (0, bill_snapshot_1.settledByTenders)(snap) + (0, bill_snapshot_1.setOffAmtOf)(snap);
        const outstanding = (0, sales_doc_utils_1.round2)(snap.billAmt - settled);
        if (outstanding > 0.01 && snap.custId) {
            if (snap.custId === s.defaultCustomerId &&
                !snap.tenders.some((t) => t.tenderTypeId === sales_doc_utils_1.TENDER_TYPE.TEMP_CREDIT)) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.TEMP_CREDIT_DETAILS_MISSING, `The walk-in customer cannot owe ${outstanding.toFixed(2)} — add a TEMP_CR tender with the person's name and mobile, or collect it`, { field: 'tenders' });
            }
            await (0, sales_guards_1.assertCreditLimit)(tx, g, { custId: snap.custId, partyLedgerId: snap.custId }, snap.companyId, outstanding, s, snap.billDate);
        }
        for (const i of snap.items) {
            if (s.maxLineDiscPerc < 100 && i.itemDiscPerc > s.maxLineDiscPerc + 0.001) {
                (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.DISC_CAP, `Line ${i.lineNo}: ${i.itemDiscPerc}% discount exceeds the ${s.maxLineDiscPerc}% line cap`, { field: 'items', line: i.lineNo });
            }
            if (s.rateBelowMinMode !== 'ALLOW' &&
                i.minPrice !== null &&
                i.minPrice > 0 &&
                !i.isFree &&
                i.rate < i.minPrice - 0.001) {
                const msg = `Line ${i.lineNo}: rate ${i.rate} is below the minimum ${i.minPrice}`;
                if (s.rateBelowMinMode === 'REFUSE') {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.RATE_BELOW_MIN, msg, { field: 'items', line: i.lineNo });
                }
                else {
                    (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.RATE_BELOW_MIN, msg, { field: 'items', line: i.lineNo });
                }
            }
        }
        if (s.maxBillDiscPerc < 100 && snap.grossAmt > 0) {
            const disc = snap.itemDisc + snap.splDisc + snap.schDisc + snap.billSchDisc + snap.cashDisc;
            const perc = (disc / snap.grossAmt) * 100;
            if (perc > s.maxBillDiscPerc + 0.001) {
                (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.DISC_CAP, `Discounts of ${(0, sales_doc_utils_1.round2)(disc)} are ${perc.toFixed(2)}% of the bill, over the ${s.maxBillDiscPerc}% cap`, { field: 'sbCashDisc' });
            }
        }
        const masters = await this.tenderMasters(tx, snap.tenders.map((t) => t.tenderId));
        for (const t of snap.tenders) {
            const m = t.tenderId ? masters.get(t.tenderId) : undefined;
            if (!m) {
                continue;
            }
            if (m.tnd_min_amount !== null &&
                (0, sales_doc_utils_1.num)(m.tnd_min_amount) > 0 &&
                t.amount < (0, sales_doc_utils_1.num)(m.tnd_min_amount)) {
                (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.TENDER_MIN_MAX, `${m.tnd_name ?? 'Tender'} ${t.amount} is below its minimum ${(0, sales_doc_utils_1.num)(m.tnd_min_amount)}`, { field: 'tenders' });
            }
            if (m.tnd_max_amount !== null &&
                (0, sales_doc_utils_1.num)(m.tnd_max_amount) > 0 &&
                t.amount > (0, sales_doc_utils_1.num)(m.tnd_max_amount)) {
                (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.TENDER_MIN_MAX, `${m.tnd_name ?? 'Tender'} ${t.amount} is above its maximum ${(0, sales_doc_utils_1.num)(m.tnd_max_amount)}`, { field: 'tenders' });
            }
            if (m.tnd_daily_limit !== null && (0, sales_doc_utils_1.num)(m.tnd_daily_limit) > 0) {
                const [d] = await tx.$queryRaw `
          SELECT SUM(td_amount) AS used FROM accounts.acc_tender_detail
           WHERE td_tender_id = ${t.tenderId}::uuid AND td_doc_date = ${snap.billDate}::date
             AND td_branch_id = ${snap.branchId}::uuid AND td_is_deleted = false AND td_is_voided = false
             AND td_src_doc_id <> ${snap.sbId ?? '00000000-0000-0000-0000-000000000000'}::uuid`;
                if ((0, sales_doc_utils_1.num)(d?.used) + t.amount > (0, sales_doc_utils_1.num)(m.tnd_daily_limit)) {
                    (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.TENDER_DAILY_LIMIT, `${m.tnd_name ?? 'Tender'} would exceed its daily limit of ${(0, sales_doc_utils_1.num)(m.tnd_daily_limit)}`, { field: 'tenders' });
                }
            }
        }
        await this.guardSources(tx, snap, g, s.allowBillOverOrderQty);
        const schemeIds = [
            ...new Set(snap.items.map((i) => i.schemeId).filter((x) => !!x)),
        ];
        if (schemeIds.length > 0) {
            const issues = await this.promo.validateApplied(tx, this.promoDoc(snap), schemeIds, {
                throwOnFirst: false,
            });
            for (const issue of issues) {
                (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.PROMO_NOT_LIVE, issue.message, { field: 'items' });
            }
        }
        const loyaltyTenders = snap.tenders.filter((t) => t.tenderTypeId === sales_doc_utils_1.TENDER_TYPE.LOYALTY);
        if (loyaltyTenders.length > 0) {
            const memberId = snap.loyaltyMemberId;
            if (!memberId) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'This bill redeems points but names no loyalty member', { field: 'sbLoyaltyMemberId' });
            }
            else {
                const preview = await this.loyalty.preview(this.loyaltySource(snap, [], memberId), tx);
                const points = loyaltyTenders.reduce((t, x) => t + x.unitsUsed, 0);
                const amount = loyaltyTenders.reduce((t, x) => t + x.amount, 0);
                if (!preview.allowPointRedeem) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'The scheme does not allow point redemption', {
                        field: 'tenders',
                    });
                }
                if (points > preview.redeemable + 0.0001) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, `Redeeming ${points} points but only ${preview.redeemable} are redeemable today`, { field: 'tenders' });
                }
                if (preview.minPoints > 0 && points < preview.minPoints) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, `At least ${preview.minPoints} points must be redeemed at a time`, { field: 'tenders' });
                }
                if (preview.maxPoints !== null && points > preview.maxPoints) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, `At most ${preview.maxPoints} points may be redeemed on one bill`, { field: 'tenders' });
                }
                if (preview.maxRedeemAmount !== null && amount > preview.maxRedeemAmount + 0.01) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, `Redemption ${amount} exceeds the scheme's cap of ${preview.maxRedeemAmount} on this bill`, { field: 'tenders' });
                }
                if (preview.rate > 0 && Math.abs(points * preview.rate - amount) > 0.01) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, `${points} points at ${preview.rate} per point is ${(0, sales_doc_utils_1.round2)(points * preview.rate)}, not ${amount}`, { field: 'tenders' });
                }
            }
        }
        for (const t of snap.tenders.filter((x) => x.tenderTypeId === sales_doc_utils_1.TENDER_TYPE.TEMP_CREDIT)) {
            if (!t.tempCredit?.name || !t.tempCredit.mobile) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.TEMP_CREDIT_DETAILS_MISSING, 'A temporary credit needs the name and mobile of the person who owes it', { field: 'tenders' });
                continue;
            }
            if (s.tempCreditMaxDays > 0 && t.tempCredit.days > s.tempCreditMaxDays) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.TEMP_CREDIT_DAYS, `A temporary credit may run at most ${s.tempCreditMaxDays} days`, { field: 'tenders' });
            }
            if (s.tempCreditMaxAmount > 0 && t.amount > s.tempCreditMaxAmount) {
                (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.TEMP_CREDIT_AMOUNT, `A temporary credit may be at most ${s.tempCreditMaxAmount}`, { field: 'tenders' });
            }
            if (s.tempCreditBlockOpen !== 'OFF') {
                const [open] = await tx.$queryRaw `
          SELECT COUNT(*) AS n, SUM(atc_balance_amount) AS bal FROM accounts.acc_temp_credit
           WHERE atc_company_id = ${snap.companyId}::uuid AND atc_mobile = ${t.tempCredit.mobile}
             AND atc_status IN ('OPEN', 'PARTIAL') AND atc_is_deleted = false
             AND atc_src_doc_id <> ${snap.sbId ?? '00000000-0000-0000-0000-000000000000'}::uuid`;
                if (Number(open?.n ?? 0) > 0) {
                    const msg = `${t.tempCredit.mobile} already has ${Number(open?.n)} open temporary credit(s) totalling ${(0, sales_doc_utils_1.num)(open?.bal)}`;
                    if (s.tempCreditBlockOpen === 'REFUSE') {
                        (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.TEMP_CREDIT_OPEN, msg, { field: 'tenders' });
                    }
                    else {
                        (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.TEMP_CREDIT_OPEN, msg, { field: 'tenders' });
                    }
                }
            }
        }
        if (opts.adjustments && opts.adjustments.length > 0 && snap.custId) {
            const split = (0, bill_adjustment_helper_1.splitSetOffs)(opts.adjustments, await (0, bill_adjustment_helper_1.loadSetOffCredits)(tx, opts.adjustments));
            for (const [field, total, declared, kind] of [
                ['sbAdvanceAmt', (0, sales_doc_utils_1.round2)(split.advance), snap.advanceAmt, 'advance'],
                ['sbNoteAdjAmt', (0, sales_doc_utils_1.round2)(split.note), snap.noteAdjAmt, 'credit-note'],
            ]) {
                if (Math.abs(total - declared) > 0.01) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.AMOUNT_MISMATCH, `${kind} adjustments total ${total} but ${field} says ${declared}`, { field });
                }
            }
        }
        const company = await this.company(tx, snap.companyId);
        const inter = (0, sales_doc_utils_1.supplyNatureOf)(company?.comp_state_code, snap.posStcd) === 'INTER';
        const eway = await this.statutory.ewayApplicable(snap.companyId, snap.billAmt, snap.billDate, { interState: inter, stateCode: snap.posStcd }, tx);
        if (eway.applicable && snap.billMode !== 'POS') {
            const band = snap.sbId
                ? await this.transportBand.read({ docType: 'SALE_BILL', docId: snap.sbId, accYear: snap.accYear }, tx)
                : null;
            if (!band || (!band.transporterId && !band.transporterName && !band.lrNo)) {
                (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.EWAY_TRANSPORT_MISSING, `An e-way bill is required for this consignment (${snap.billAmt} ${inter ? 'inter' : 'intra'}-state) and the transport band is empty`, { field: 'transport' });
            }
        }
        for (const i of snap.items) {
            if (i.isService || i.srcDocType === 'DELIVERY_CHALLAN' || i.qty <= 0) {
                continue;
            }
            const [row] = await tx.$queryRaw `
        SELECT SUM(sbl_available_qty) AS on_hand FROM stock.stock_balance
         WHERE sbl_company_id = ${snap.companyId}::uuid AND sbl_branch_id = ${snap.branchId}::uuid
           AND sbl_godown_id = ${i.godownId}::uuid AND sbl_item_id = ${i.itemId}::uuid
           AND sbl_bucket = ${i.bucket} AND sbl_is_deleted = false`;
            const factor = i.toBaseFactor ?? 1;
            if ((0, sales_doc_utils_1.num)(row?.on_hand) < i.qty * factor - 0.0005) {
                g.warnings.push({
                    code: posting_types_1.SALES_ERROR_CODES.STOCK_NEGATIVE,
                    level: 'INFO',
                    message: `Line ${i.lineNo}: ${(0, sales_doc_utils_1.num)(row?.on_hand)} on hand in this godown against ${(0, sales_doc_utils_1.round2)(i.qty * factor)} billed — the item's negative-stock policy decides at post`,
                    line: i.lineNo,
                    overridable: false,
                });
            }
        }
    }
    async guardSources(tx, snap, g, allowOverOrder) {
        const orderLines = snap.items.filter((i) => i.srcDocType === 'SALES_ORDER' && i.srcItemId);
        const dcLines = snap.items.filter((i) => i.srcDocType === 'DELIVERY_CHALLAN' && i.srcItemId);
        const orderIds = [
            ...new Set([
                snap.srcDocType === 'SALES_ORDER' ? snap.srcDocId : null,
                ...snap.items.map((i) => (i.srcDocType === 'SALES_ORDER' ? i.srcDocId : null)),
            ].filter((id) => !!id)),
        ];
        if (orderIds.length > 0) {
            const orders = await tx.$queryRaw `
        SELECT so_id, so_order_refno, so_status FROM sales.sale_order
         WHERE so_id = ANY(${orderIds}::uuid[]) AND so_is_deleted = false`;
            const byId = new Map(orders.map((o) => [o.so_id, o]));
            for (const id of orderIds) {
                const o = byId.get(id);
                if (!o || !['CONFIRMED', 'PARTIAL'].includes(o.so_status)) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.ORDER_NOT_OPEN, o
                        ? `Order ${o.so_order_refno ?? id} is ${o.so_status} — only a CONFIRMED or PARTIAL order can be billed`
                        : `Order ${id} does not exist`, { field: 'items' });
                }
            }
        }
        if (orderLines.length > 0) {
            const rows = await tx.$queryRaw `
        SELECT d.soi_id, d.soi_pending_qty, h.so_status
          FROM sales.sale_order_item d JOIN sales.sale_order h ON h.so_id = d.soi_order_id AND h.so_acc_year = d.soi_acc_year
         WHERE d.soi_id = ANY(${orderLines.map((l) => l.srcItemId)}::uuid[])`;
            const by = new Map(rows.map((r) => [r.soi_id, r]));
            const taken = new Map();
            for (const l of orderLines) {
                taken.set(l.srcItemId, (taken.get(l.srcItemId) ?? 0) + l.qty);
            }
            for (const [soiId, qty] of taken) {
                const r = by.get(soiId);
                if (!r) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.ORDER_LINE_OVER, `Order line ${soiId} does not exist`, {
                        field: 'items',
                    });
                    continue;
                }
                if (qty > (0, sales_doc_utils_1.num)(r.soi_pending_qty) + 0.0005) {
                    const msg = `Order line has ${(0, sales_doc_utils_1.num)(r.soi_pending_qty)} pending; this bill takes ${qty}`;
                    if (allowOverOrder) {
                        (0, sales_guards_1.warn)(g, posting_types_1.SALES_ERROR_CODES.ORDER_LINE_OVER, msg, { field: 'items' });
                    }
                    else {
                        (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.ORDER_LINE_OVER, msg, { field: 'items' });
                    }
                }
            }
        }
        if (dcLines.length > 0) {
            const rows = await tx.$queryRaw `
        SELECT d.sdi_id, d.sdi_open_qty, h.sdc_purpose, h.sdc_status
          FROM sales.sale_dc_item d JOIN sales.sale_dc h ON h.sdc_id = d.sdi_dc_id AND h.sdc_acc_year = d.sdi_acc_year
         WHERE d.sdi_id = ANY(${dcLines.map((l) => l.srcItemId)}::uuid[])`;
            const by = new Map(rows.map((r) => [r.sdi_id, r]));
            const taken = new Map();
            for (const l of dcLines) {
                taken.set(l.srcItemId, (taken.get(l.srcItemId) ?? 0) + l.qty);
            }
            for (const [sdiId, qty] of taken) {
                const r = by.get(sdiId);
                if (!r || r.sdc_status !== 'POSTED') {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_LINE_OVER, `Challan line ${sdiId} is not on a POSTED challan`, { field: 'items' });
                    continue;
                }
                if (r.sdc_purpose !== 'SUPPLY') {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_PURPOSE_NOT_ALLOWED, `The challan's purpose is ${r.sdc_purpose} — convert it to SUPPLY before billing against it`, { field: 'items' });
                }
                if (qty > (0, sales_doc_utils_1.num)(r.sdi_open_qty) + 0.0005) {
                    (0, sales_guards_1.refuse)(g, posting_types_1.SALES_ERROR_CODES.DC_LINE_OVER, `Challan line has ${(0, sales_doc_utils_1.num)(r.sdi_open_qty)} open; this bill takes ${qty}`, { field: 'items' });
                }
            }
        }
    }
    async postCore(tx, bill, items, snap, ctx, opts) {
        const { now } = opts;
        const actor = ctx.actor;
        const partyId = snap.custId;
        const company = await this.company(tx, snap.companyId);
        const supplyNature = (0, sales_doc_utils_1.supplyNatureOf)(company?.comp_state_code, snap.posStcd);
        const refno = snap.refno ?? bill.sbBillRefno ?? bill.sbId;
        const moving = snap.items.filter((i) => !i.isService && i.srcDocType !== 'DELIVERY_CHALLAN' && i.qty > 0);
        const stock = await this.stock.post(tx, {
            docType: 'SALE_BILL',
            docId: bill.sbId,
            accYear: bill.sbAccYear,
            companyId: bill.sbCompanyId,
            branchId: bill.sbBranchId,
            tenantId: bill.sbTenantId,
            deviceId: bill.sbDeviceId,
            sessionId: bill.sbSessionId,
            docDate: snap.billDate,
            docDatetime: bill.sbBillDatetime ?? now,
            refno,
            revision: opts.revisionNo ?? bill.sbRevisionNo,
            partyId,
            direction: 'OUT',
            txnType: 'SALE',
            lines: moving.map((i) => ({
                lineId: i.sbiId,
                lineNo: i.lineNo,
                itemId: i.itemId,
                itemUnitId: i.itemUnitId,
                godownId: i.godownId,
                lotId: i.lotId,
                bucket: i.bucket,
                qty: i.isFree ? 0 : i.qty,
                freeQty: i.isFree ? i.qty : 0,
                weightQty: i.weightQty,
                toBaseFactor: i.toBaseFactor,
                batchNo: i.batchNo,
                batchDate: i.batchDate,
                expiryDate: i.expiryDate,
                serialNo: i.serialNo,
                mrp: i.maxPrice,
                rate: i.rate,
                taxPerc: i.taxPerc,
            })),
        }, actor, now);
        for (const i of moving) {
            const cost = stock.costByLine.get(i.sbiId) ?? 0;
            const lot = stock.lotByLine.get(i.sbiId) ?? i.lotId ?? null;
            await tx.saleBillItem.update({
                where: { sbiId_sbiAccYear: { sbiId: i.sbiId, sbiAccYear: bill.sbAccYear } },
                data: { sbiCogsAmt: (0, bill_snapshot_1.decimal)(cost), sbiLotId: lot },
            });
        }
        const cogsAmt = ctx.cogsMode === 'PERPETUAL' ? stock.cogsTotal : 0;
        const adjustments = await this.resolveAdjustments(tx, snap, partyId, opts.adjustments);
        const credits = await (0, bill_adjustment_helper_1.loadSetOffCredits)(tx, adjustments);
        const split = (0, bill_adjustment_helper_1.splitSetOffs)(adjustments, credits);
        const advanceAdjusted = (0, sales_doc_utils_1.round2)(split.advance);
        const noteAdjusted = (0, sales_doc_utils_1.round2)(split.note);
        const setOffs = new Map();
        for (const a of adjustments) {
            const credit = credits.get((0, bill_adjustment_helper_1.setOffKey)(a.againstBillId, a.againstBillAccYear));
            if (credit && credit.holdingLedgerId !== partyId) {
                setOffs.set(credit.holdingLedgerId, (0, sales_doc_utils_1.round2)((setOffs.get(credit.holdingLedgerId) ?? 0) + (0, sales_doc_utils_1.num)(a.amount)));
            }
        }
        const legs = (0, sales_leg_sources_1.buildBillLegs)({
            partyLedgerId: partyId,
            supplyNature,
            salesAmount: snap.taxableAmt,
            taxes: (0, sales_doc_utils_1.bucketTaxes)(snap.items.map((i) => ({
                taxId: i.taxId,
                cgst: i.cgstAmt,
                sgst: i.sgstAmt,
                igst: i.igstAmt,
                cess: i.cessAmt,
                acess: i.acessAmt,
            }))),
            charges: snap.charges.map((c) => ({
                ledgerId: c.ledgerId,
                amount: c.amount,
                separatelyPosted: c.separatelyPosted,
                cgst: c.cgst,
                sgst: c.sgst,
                igst: c.igst,
                cess: c.cess,
                name: c.name,
            })),
            cashDiscount: snap.cashDisc,
            schemeDiscount: ctx.settings.postSchemeDiscSeparately ? snap.schDisc + snap.billSchDisc : 0,
            roundOff: snap.roundOff,
            tcsAmount: snap.tcsAmt,
            setOffs: [...setOffs].map(([ledgerId, amount]) => ({ ledgerId, amount })),
            tenders: snap.tenders.map((t) => ({
                tenderTypeId: t.tenderTypeId,
                tenderLedgerId: t.tenderLedgerId,
                amount: t.amount,
                isLoyalty: t.tenderTypeId === sales_doc_utils_1.TENDER_TYPE.LOYALTY,
                isCredit: (0, bill_snapshot_1.isCreditTender)(t),
                name: t.name,
            })),
            cogsAmount: cogsAmt,
        });
        const voucher = await this.legs.postLegs(tx, {
            header: {
                companyId: bill.sbCompanyId,
                branchId: bill.sbBranchId,
                tenantId: bill.sbTenantId,
                accYear: bill.sbAccYear,
                voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.BILL,
                voucherDate: snap.billDate,
                srcModule: 'SALES',
                srcDocType: 'SALE_BILL',
                srcDocId: bill.sbId,
                docRefno: refno,
                docDate: snap.billDate,
                usrRefno: snap.usrRefno,
                docAmount: snap.billAmt,
                roundOff: snap.roundOff,
                partyId,
                userId: isUuid(snap.userId) ? snap.userId : actor,
                sessionId: snap.sessionId,
                deviceType: snap.deviceType,
                deviceId: isUuid(snap.deviceId) ? snap.deviceId : null,
                remarks: snap.remarks,
                deviceCode: snap.billMode === 'POS' ? snap.deviceId : null,
                createdBy: actor,
                presetRefno: bill.sbBillRefno,
                presetNo: bill.sbBillSlno,
                restateVoucherId: opts.restateVoucherId ?? null,
            },
            legs,
        });
        const reg = await this.register.write(tx, this.registerDoc(bill, snap, voucher.voucherId, voucher.voucherLastNo, supplyNature, actor), {
            companyEinvoiceFlag: company?.comp_einvoice_applicable ?? false,
            interState: supplyNature === 'INTER',
        });
        const settled = (0, bill_snapshot_1.settledByTenders)(snap);
        const ablId = await this.writeBalanceRow(tx, bill, snap, partyId, voucher.voucherId, voucher.voucherLastNo, settled, actor, now);
        if (adjustments.length > 0) {
            await (0, bill_adjustment_helper_1.syncBillAdjustments)(tx, {
                billId: ablId,
                billAccYear: bill.sbAccYear,
                billAmount: (0, bill_snapshot_1.decimal)(snap.billAmt),
                paidAmount: (0, bill_snapshot_1.decimal)(settled),
                companyId: bill.sbCompanyId,
                branchId: bill.sbBranchId,
                tenantId: bill.sbTenantId,
                accYear: bill.sbAccYear,
                partyId,
                adjDate: bill.sbBillDate,
                userId: isUuid(snap.userId) ? snap.userId : actor,
                sessionId: snap.sessionId,
            }, adjustments, actor, now);
        }
        for (const t of snap.tenders.filter((x) => x.tenderTypeId === sales_doc_utils_1.TENDER_TYPE.TEMP_CREDIT && x.tempCredit)) {
            const tc = t.tempCredit;
            await tx.accTempCredit.create({
                data: {
                    atcCompanyId: bill.sbCompanyId,
                    atcBranchId: bill.sbBranchId,
                    atcTenantId: bill.sbTenantId,
                    atcAccYear: bill.sbAccYear,
                    atcPartyId: partyId,
                    atcSrcDocType: 'SALE_BILL',
                    atcSrcDocId: bill.sbId,
                    atcBillRefno: refno,
                    atcBillDate: bill.sbBillDate,
                    atcBillAmount: (0, bill_snapshot_1.decimal)(snap.billAmt),
                    atcAblId: ablId,
                    atcAblAccYear: bill.sbAccYear,
                    atcTenderId: t.tdId,
                    atcTenderAccYear: t.tdId ? bill.sbAccYear : null,
                    atcName: tc.name,
                    atcMobile: tc.mobile,
                    atcPlace: tc.place,
                    atcAddr: tc.addr,
                    atcIdRef: tc.idRef,
                    atcDays: tc.days,
                    atcDueDate: new Date(`${(0, sales_doc_utils_1.addDays)(snap.billDate, tc.days)}T00:00:00Z`),
                    atcCreditAmount: (0, bill_snapshot_1.decimal)(t.amount),
                    atcBalanceAmount: (0, bill_snapshot_1.decimal)(t.amount),
                    atcStatus: 'OPEN',
                    atcRemarks: tc.notes,
                    atcUserId: isUuid(snap.userId) ? snap.userId : null,
                    atcCounterId: bill.sbCounterId,
                    atcSessionId: snap.sessionId,
                    atcCreatedOn: now,
                    atcCreatedBy: actor,
                },
            });
        }
        let earned = 0;
        let earnPoints = 0;
        let redeemed = 0;
        let redeemPoints = 0;
        let lscId = null;
        if (partyId !== ctx.settings.defaultCustomerId || snap.loyaltyMemberId) {
            const lines = await this.loyaltyLines(tx, snap);
            const source = this.loyaltySource(snap, lines, snap.loyaltyMemberId);
            const memberId = await this.loyalty.resolveMember(tx, source, {
                autoEnrol: ctx.settings.loyaltyAutoEnrol,
                isWalkIn: partyId === ctx.settings.defaultCustomerId,
                createdBy: actor,
            });
            if (memberId) {
                for (const t of snap.tenders.filter((x) => x.tenderTypeId === sales_doc_utils_1.TENDER_TYPE.LOYALTY && x.tdId)) {
                    const r = await this.loyalty.redeem(tx, { ...source, memberId }, {
                        tenderId: t.tdId,
                        tenderAccYear: bill.sbAccYear,
                        points: t.unitsUsed,
                        amount: t.amount,
                    }, { memberId, createdBy: actor });
                    redeemed += r.amount;
                    redeemPoints += r.points;
                }
                const e = await this.loyalty.earn(tx, { ...source, memberId, redeemedAmount: redeemed }, { memberId, createdBy: actor });
                earnPoints = e.points;
                earned = e.points;
                lscId = e.schemeId;
                for (const l of e.lines) {
                    const item = items.find((x) => x.sbiLineNo === l.lineNo);
                    if (item) {
                        await tx.saleBillItem.update({
                            where: { sbiId_sbiAccYear: { sbiId: item.sbiId, sbiAccYear: bill.sbAccYear } },
                            data: {
                                sbiLoyaltyPoints: new client_1.Prisma.Decimal(l.points),
                                sbiLoyaltyPv: new client_1.Prisma.Decimal(l.pv),
                            },
                        });
                    }
                }
                if (memberId !== snap.loyaltyMemberId) {
                    snap.loyaltyMemberId = memberId;
                }
            }
        }
        const applied = this.promoApplied(snap);
        if (applied.length > 0) {
            await this.promo.record(tx, this.promoDoc(snap, refno), applied);
        }
        await this.chargeCarry.consume(tx, snap.charges.map((c) => ({
            srcChargeId: c.srcChargeId,
            srcAccYear: c.srcAccYear,
            amount: c.amount,
            basis: (c.carryBasis ?? undefined),
        })), { canOverride: ctx.rights.override });
        const paid = (0, sales_doc_utils_1.round2)(settled + advanceAdjusted + noteAdjusted);
        const balance = (0, sales_doc_utils_1.round2)(snap.billAmt - paid);
        const revisionNo = opts.revisionNo ?? bill.sbRevisionNo;
        const posted = await tx.saleBill.update({
            where: { sbId_sbAccYear: { sbId: bill.sbId, sbAccYear: bill.sbAccYear } },
            data: {
                sbStatus: bill_api_types_1.BILL_STATUS_POSTED,
                sbPostedVoucherId: voucher.voucherId,
                sbDocRegisterId: reg.gdrId,
                sbCogsAmt: (0, bill_snapshot_1.decimal)(cogsAmt),
                sbTotalCost: (0, bill_snapshot_1.decimal)(stock.cogsTotal),
                sbLoyaltyMemberId: snap.loyaltyMemberId,
                sbLoyaltyEarned: (0, bill_snapshot_1.decimal)(earned),
                sbLoyaltyRedeemed: (0, bill_snapshot_1.decimal)(redeemed),
                sbLoyaltyEarnPoints: new client_1.Prisma.Decimal(earnPoints),
                sbLoyaltyRedeemPoints: new client_1.Prisma.Decimal(redeemPoints),
                sbLscId: lscId,
                sbAdvanceAmt: (0, bill_snapshot_1.decimal)(advanceAdjusted),
                sbNoteAdjAmt: (0, bill_snapshot_1.decimal)(noteAdjusted),
                sbPaidAmt: (0, bill_snapshot_1.decimal)(paid),
                sbBalanceAmt: (0, bill_snapshot_1.decimal)(balance),
                sbPayStatus: balance <= 0.005 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID',
                sbDeliveryStatus: snap.billMode === 'POS' ? 'NA' : 'PENDING',
                sbRevisionNo: revisionNo,
                sbHasDc: snap.items.some((i) => i.srcDocType === 'DELIVERY_CHALLAN'),
                sbModifiedOn: now,
                sbModifiedBy: ctx.actorName,
            },
        });
        await this.afterStatusChange(tx, posted, items, actor, now);
        await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
            companyId: bill.sbCompanyId,
            branchId: bill.sbBranchId,
            tenantId: bill.sbTenantId,
            accYear: bill.sbAccYear,
            srcModule: bill_api_types_1.BILL_STATUS_SRC_MODULE,
            srcDocType: bill_api_types_1.BILL_STATUS_SRC_DOC_TYPE,
            srcDocId: bill.sbId,
            srcDocRefno: refno,
            event: txn_status_log_helper_1.TxnStatusEvent.POSTED,
            fromStatus: opts.fromStatus,
            toStatus: bill_api_types_1.BILL_STATUS_POSTED,
            changedOn: now,
            changedBy: actor,
            remarks: opts.revisionNo ? `Re-posted as revision ${opts.revisionNo}` : null,
            deviceId: bill.sbDeviceId,
            sessionId: bill.sbSessionId,
        });
        await this.audit.logEntityChange({
            action: 'update',
            tableName: 'sale_bill',
            screenName: 'Sale Bill',
            screenType: 'transaction',
            pk: bill.sbId,
            displayName: refno,
            originalRecord: { sbStatus: opts.fromStatus },
            modifiedRecord: {
                sbStatus: bill_api_types_1.BILL_STATUS_POSTED,
                sbPostedVoucherId: voucher.voucherId,
                sbDocRegisterId: reg.gdrId,
                sbCogsAmt: cogsAmt,
            },
            userId: actor,
            notes: `Bill posted (voucher ${voucher.voucherRefno})`,
        }, tx);
        return {
            bill: posted,
            gdrId: reg.gdrId,
            einvoice: reg.einvoiceApplicable,
            ewaybill: reg.ewaybillApplicable,
        };
    }
    async assertUnwindable(tx, bill, ctx, reason, verb) {
        const docDate = (0, sales_doc_utils_1.isoDate)(bill.sbBillDate) ?? (0, sales_doc_utils_1.isoToday)();
        await (0, sales_guards_1.assertAccYearWritable)(tx, bill.sbCompanyId, bill.sbAccYear, 'sbAccYear');
        if (await (0, sales_guards_1.loadDayClosed)(tx, bill.sbCompanyId, bill.sbBranchId, docDate)) {
            (0, sales_errors_1.throwSalesLocked)(`The books for ${docDate} are closed at this branch`, posting_types_1.SALES_ERROR_CODES.DAY_CLOSED, 'sbBillDate');
        }
        await (0, sales_guards_1.assertCancellable)(tx, {
            billId: bill.sbId,
            accYear: bill.sbAccYear,
            companyId: bill.sbCompanyId,
        });
        const { irnLive, ewbLive } = await (0, sales_guards_1.loadDeclaredLocks)(tx, bill.sbDocRegisterId);
        if (irnLive || ewbLive) {
            const gst = await this.docBlocks.gstRows(tx, bill.sbDocRegisterId, bill.sbAccYear);
            if (irnLive) {
                const w = gst.irnGeneratedOn
                    ? await this.statutory.withinCancelWindow(bill.sbCompanyId, 'IRN', gst.irnGeneratedOn, docDate, new Date(), tx)
                    : { within: false };
                if (!w.within) {
                    (0, sales_errors_1.throwSalesLocked)(`The IRN's cancellation window has passed — a posted invoice is now corrected by a credit note, not by ${verb === 'cancel' ? 'cancelling it' : 'an amendment'}`, posting_types_1.SALES_ERROR_CODES.IRN_WINDOW_PASSED, 'posting.irn');
                }
                await this.gst.cancelIrn({
                    gdrId: bill.sbDocRegisterId,
                    accYear: bill.sbAccYear,
                    companyId: bill.sbCompanyId,
                    reason,
                });
            }
            if (ewbLive) {
                const w = gst.ewbGeneratedOn
                    ? await this.statutory.withinCancelWindow(bill.sbCompanyId, 'EWAYBILL', gst.ewbGeneratedOn, docDate, new Date(), tx)
                    : { within: false };
                if (!w.within) {
                    (0, sales_errors_1.throwSalesLocked)("The e-way bill's cancellation window has passed — cancel it at the portal or let it expire first", posting_types_1.SALES_ERROR_CODES.EWB_WINDOW_PASSED, 'posting.ewb');
                }
                await this.gst.cancelEwb({
                    gdrId: bill.sbDocRegisterId,
                    accYear: bill.sbAccYear,
                    companyId: bill.sbCompanyId,
                    reason,
                });
            }
        }
        void ctx;
    }
    async unwind(tx, bill, items, ctx, reason, now, mode = 'cancel') {
        const actor = ctx.actor;
        let reversalRefno = null;
        let restateVoucherId = null;
        if (bill.sbPostedVoucherId && mode === 'amend') {
            if (await this.legs.retireForRestate(tx, bill.sbPostedVoucherId, bill.sbAccYear, actor)) {
                restateVoucherId = bill.sbPostedVoucherId;
            }
        }
        else if (bill.sbPostedVoucherId) {
            const r = await this.legs.reverseLegs(tx, bill.sbPostedVoucherId, bill.sbAccYear, reason, actor);
            if (r) {
                const [row] = await tx.$queryRaw `
          SELECT avh_voucher_refno FROM accounts.acc_voucher_header
           WHERE avh_voucher_id = ${r.voucherId}::uuid AND avh_acc_year = ${bill.sbAccYear}::char(9)`;
                reversalRefno = row?.avh_voucher_refno ?? null;
            }
        }
        await this.stock.cancel(tx, {
            docType: 'SALE_BILL',
            docId: bill.sbId,
            accYear: bill.sbAccYear,
            companyId: bill.sbCompanyId,
            branchId: bill.sbBranchId,
            direction: 'OUT',
            txnType: 'SALE',
        }, actor, reason, now);
        if (bill.sbDocRegisterId && mode === 'amend') {
            await this.register.retire(tx, bill.sbDocRegisterId, bill.sbAccYear, actor);
        }
        else if (bill.sbDocRegisterId) {
            await this.register.cancel(tx, bill.sbDocRegisterId, bill.sbAccYear, reason, actor);
        }
        await this.loyalty.reverseForCancel(tx, {
            docId: bill.sbId,
            accYear: bill.sbAccYear,
            docType: 'SALE_BILL',
            docRefno: bill.sbBillRefno,
        }, { reason, createdBy: actor });
        await this.promo.reverse(tx, { docId: bill.sbId, accYear: bill.sbAccYear }, reason, actor);
        const charges = await this.prismaChargesOf(tx, bill);
        await this.chargeCarry.release(tx, charges);
        const abl = await tx.accBillBalance.findFirst({
            where: {
                ablSrcDocId: bill.sbId,
                ablAccYear: bill.sbAccYear,
                ablSrcDocType: 'SALE_BILL',
                ablIsDeleted: false,
            },
            select: { ablId: true },
        });
        if (abl && bill.sbCustId) {
            await (0, bill_adjustment_helper_1.syncBillAdjustments)(tx, {
                billId: abl.ablId,
                billAccYear: bill.sbAccYear,
                billAmount: bill.sbBillAmt ?? new client_1.Prisma.Decimal(0),
                paidAmount: bill.sbPaidAmt ?? new client_1.Prisma.Decimal(0),
                companyId: bill.sbCompanyId,
                branchId: bill.sbBranchId,
                tenantId: bill.sbTenantId,
                accYear: bill.sbAccYear,
                partyId: bill.sbCustId,
                adjDate: bill.sbBillDate,
                userId: isUuid(bill.sbUserId) ? bill.sbUserId : actor,
                sessionId: bill.sbSessionId,
            }, [], actor, now);
            await tx.accBillBalance.update({
                where: { ablId_ablAccYear: { ablId: abl.ablId, ablAccYear: bill.sbAccYear } },
                data: {
                    ablIsActive: false,
                    ablIsDeleted: true,
                    ablNarration: reason,
                    ablModifiedOn: now,
                    ablModifiedBy: actor,
                },
            });
        }
        await tx.accTempCredit.updateMany({
            where: { atcSrcDocId: bill.sbId, atcAccYear: bill.sbAccYear, atcIsDeleted: false },
            data: {
                atcStatus: 'CANCELLED',
                atcBalanceAmount: 0,
                atcRemarks: reason,
                atcModifiedOn: now,
                atcModifiedBy: actor,
            },
        });
        void items;
        return { reversalRefno, restateVoucherId };
    }
    async afterStatusChange(tx, bill, items, actor, now) {
        const sign = bill.sbStatus === bill_api_types_1.BILL_STATUS_POSTED ? 1 : -1;
        for (const i of items) {
            if (i.sbiSrcDocType !== 'SALES_ORDER' || !i.sbiSrcDocId || i.sbiSrcDocLineNo === null) {
                continue;
            }
            const factor = (0, sales_doc_utils_1.num)(i.sbiToBaseFactor) || 1;
            await this.reservations.consume(tx, { docId: i.sbiSrcDocId, lineNo: i.sbiSrcDocLineNo }, sign * (0, sales_doc_utils_1.num)(i.sbiBillQty) * factor, actor, now);
        }
        await this.saleOrders.syncOrderFulfilment(tx, { refs: this.bills.orderRefsOf(bill, items) }, actor, now);
        const dcs = await this.dcFulfilment.dcRefsOfBill(tx, bill.sbId, bill.sbAccYear);
        await this.dcFulfilment.recompute(tx, dcs, actor, now);
    }
    async resolveAdjustments(tx, snap, partyId, named) {
        if (named && named.length > 0) {
            return named;
        }
        const out = [];
        for (const [billType, field, asked] of [
            ['ADVANCE', 'sbAdvanceAmt', (0, sales_doc_utils_1.round2)(snap.advanceAmt)],
            ['SALES_RETURN', 'sbNoteAdjAmt', (0, sales_doc_utils_1.round2)(snap.noteAdjAmt)],
        ]) {
            let want = asked;
            if (want <= 0) {
                continue;
            }
            const credits = await tx.$queryRaw `
        SELECT abl_id, abl_acc_year, abl_pending_amount
          FROM accounts.acc_bill_balance
         WHERE abl_company_id = ${snap.companyId}::uuid AND abl_party_id = ${partyId}::uuid
           AND abl_dr_cr = 'CR' AND abl_pending_amount > 0 AND abl_is_deleted = false AND abl_is_active = true
           AND abl_bill_type = ${billType}
         ORDER BY (abl_src_doc_id = ${snap.srcDocId ?? '00000000-0000-0000-0000-000000000000'}::uuid) DESC,
                  abl_doc_date, abl_created_on
         FOR UPDATE`;
            for (const c of credits) {
                if (want <= 0.005) {
                    break;
                }
                const take = Math.min(want, (0, sales_doc_utils_1.num)(c.abl_pending_amount));
                if (take <= 0) {
                    continue;
                }
                out.push({
                    againstBillId: c.abl_id,
                    againstBillAccYear: c.abl_acc_year.trim(),
                    amount: (0, sales_doc_utils_1.round2)(take),
                });
                want = (0, sales_doc_utils_1.round2)(want - take);
            }
            if (want > 0.005) {
                (0, sales_guards_1.refuse)((0, posting_types_1.createGuardContext)(), posting_types_1.SALES_ERROR_CODES.AMOUNT_MISMATCH, `${field} asks to set off ${asked} but the customer holds only ${(0, sales_doc_utils_1.round2)(asked - want)} in open ${billType === 'ADVANCE' ? 'advances' : 'credit notes'}`, { field });
            }
        }
        return out;
    }
    registerDoc(bill, snap, voucherId, voucherNo, supplyNature, actor) {
        const lines = snap.items.map((i) => {
            const tax = i.cgstAmt + i.sgstAmt + i.igstAmt + i.cessAmt;
            const taxable = i.taxableAmt;
            return {
                rowNo: i.lineNo,
                itemId: i.itemId,
                hsnCode: i.hsnCode,
                unitId: i.itemUnitId,
                qty: i.qty,
                rate: i.rate,
                discount: i.itemDiscAmt + i.splDiscAmt + i.schDiscAmt + i.billSchAmt,
                isService: i.isService,
                taxableValue: taxable,
                taxId: i.taxId,
                totalTaxRate: i.taxPerc,
                cgstRate: i.cgstPerc,
                sgstRate: i.sgstPerc,
                igstRate: i.igstPerc,
                cessRate: i.cessPerc,
                cgstAmount: i.cgstAmt,
                sgstAmount: i.sgstAmt,
                igstAmount: i.igstAmt,
                cessAmount: i.cessAmt,
                otherAmount: 0,
                totalValue: (0, sales_doc_utils_1.round2)(taxable + tax),
                billValue: i.netAmt || (0, sales_doc_utils_1.round2)(taxable + tax),
                taxability: tax > 0 || i.taxPerc > 0 ? 'TAXABLE' : 'EXEMPT',
                supplyNature: supplyNature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
            };
        });
        const taxed = lines.filter((l) => l.taxability === 'TAXABLE').length;
        const services = snap.items.filter((i) => i.isService).length;
        const other = snap.charges
            .filter((c) => c.separatelyPosted)
            .reduce((t, c) => t + c.amount + c.cgst + c.sgst + c.igst + c.cess, 0);
        return {
            companyId: bill.sbCompanyId,
            branchId: bill.sbBranchId,
            accYear: bill.sbAccYear,
            voucherId,
            voucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.BILL,
            voucherNo: bill.sbBillSlno ?? (0, sales_doc_utils_1.numericTail)(bill.sbBillRefno, voucherNo),
            voucherDate: snap.billDate,
            voucherRefno: bill.sbBillRefno,
            sourceDocId: bill.sbId,
            docType: snap.docType === 'BILL_OF_SUPPLY' ? 'BILL_OF_SUPPLY' : 'INVOICE',
            tranNature: 'SALE',
            docFlow: 'OUTWARD',
            docSign: 1,
            docNo: bill.sbBillRefno ?? bill.sbId,
            docDate: snap.billDate,
            docRefNo: snap.usrRefno,
            taxability: taxed === 0 ? 'EXEMPT' : taxed === lines.length ? 'TAXABLE' : 'MIXED',
            supplyClass: services === 0 ? 'GOODS' : services === snap.items.length ? 'SERVICES' : 'MIXED',
            supplyNature: supplyNature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
            placeOfSupplyCode: snap.posStcd,
            placeOfSupplyName: snap.stateName,
            partyId: snap.custId,
            partyName: snap.custName,
            partyAddr1: snap.custAddr,
            partyLocation: snap.custPlace,
            partyPin: snap.custPin,
            partyStateCode: snap.custStcd,
            partyStateName: snap.stateName,
            partyGstType: snap.custGstType,
            partyGstin: snap.custGstin?.trim() || null,
            grossValue: snap.grossAmt,
            discountValue: snap.itemDisc + snap.splDisc + snap.schDisc + snap.billSchDisc + snap.cashDisc,
            taxableValue: snap.taxableAmt,
            cgstValue: snap.cgstAmt,
            sgstValue: snap.sgstAmt,
            igstValue: snap.igstAmt,
            cessValue: snap.cessAmt,
            stateCessValue: 0,
            tcsValue: snap.tcsAmt,
            otherCharge: (0, sales_doc_utils_1.round2)(other),
            roundOff: snap.roundOff,
            billValue: snap.billAmt,
            remarks: snap.remarks,
            createdBy: actor,
            lines,
        };
    }
    async writeBalanceRow(tx, bill, snap, partyId, voucherId, voucherNo, settled, actor, now) {
        const alloc = Math.min(settled, snap.billAmt);
        const created = await tx.accBillBalance.create({
            data: {
                ablCompanyId: bill.sbCompanyId,
                ablBranchId: bill.sbBranchId,
                ablTenantId: bill.sbTenantId,
                ablAccYear: bill.sbAccYear,
                ablPartyId: partyId,
                ablSalesmanId: snap.salesmanId[0] ?? null,
                ablAgentId: bill.sbAgentId,
                ablBillType: 'SALES',
                ablSrcModule: 'SALES',
                ablSrcDocType: 'SALE_BILL',
                ablSrcDocId: bill.sbId,
                ablSrcAccYear: bill.sbAccYear,
                ablVoucherId: voucherId,
                ablVoucherTypeId: sales_doc_utils_1.SALES_VOUCHER_TYPE.BILL,
                ablVoucherNo: bill.sbBillSlno ?? voucherNo,
                ablVoucherDate: bill.sbBillDate,
                ablVoucherRefno: bill.sbBillRefno,
                ablDocRefno: bill.sbBillRefno ?? bill.sbId,
                ablDocDate: bill.sbBillDate,
                ablDueDate: bill.sbDueDate,
                ablCreditDays: bill.sbDueDays ?? 0,
                ablDrCr: 'DR',
                ablBillAmount: (0, bill_snapshot_1.decimal)(snap.billAmt),
                ablAllocAmount: (0, bill_snapshot_1.decimal)(alloc),
                ablTcsAmount: (0, bill_snapshot_1.decimal)(snap.tcsAmt),
                ablNarration: bill.sbRemarks,
                ablCreatedOn: now,
                ablCreatedBy: actor,
            },
            select: { ablId: true },
        });
        return created.ablId;
    }
    promoDoc(snap, refno) {
        return {
            docId: snap.sbId ?? '00000000-0000-0000-0000-000000000000',
            accYear: snap.accYear,
            companyId: snap.companyId,
            branchId: snap.branchId,
            custId: snap.custId,
            docDate: snap.billDate,
            docRefno: refno ?? snap.refno,
            docType: 'SALE_BILL',
            billType: snap.billType,
            srcModule: 'SALES',
            userId: isUuid(snap.userId) ? snap.userId : null,
            deviceId: snap.deviceId,
        };
    }
    promoApplied(snap) {
        const by = new Map();
        for (const i of snap.items) {
            if (!i.schemeId) {
                continue;
            }
            const a = by.get(i.schemeId) ?? {
                schemeId: i.schemeId,
                baseAmount: 0,
                baseQty: 0,
                benefitAmt: 0,
                freeQty: 0,
                lineCount: 0,
            };
            a.baseAmount = (0, sales_doc_utils_1.round2)(a.baseAmount + i.taxableAmt);
            a.baseQty += i.qty;
            a.benefitAmt = (0, sales_doc_utils_1.round2)(a.benefitAmt + i.schDiscAmt + i.billSchAmt);
            if (i.isFree && i.freeType === 'SCHEME') {
                a.freeQty += i.qty;
            }
            a.lineCount += 1;
            by.set(i.schemeId, a);
        }
        return [...by.values()];
    }
    async loyaltyLines(tx, snap) {
        const ids = [...new Set(snap.items.map((i) => i.itemId))];
        const rows = ids.length
            ? await tx.itemMaster.findMany({
                where: { itemId: { in: ids } },
                select: {
                    itemId: true,
                    itemAllowLoyalty: true,
                    itemGroupId: true,
                    itemCategoryId: true,
                    itemBrandId: true,
                    itemSectionId: true,
                },
            })
            : [];
        const by = new Map(rows.map((r) => [r.itemId, r]));
        return snap.items.map((i) => {
            const m = by.get(i.itemId);
            return {
                lineNo: i.lineNo,
                itemId: i.itemId,
                unitId: i.itemUnitId,
                qty: i.qty,
                grossAmt: i.grossAmt,
                netAmt: i.netAmt,
                taxableAmt: i.taxableAmt,
                isFree: i.isFree,
                allowLoyalty: m?.itemAllowLoyalty ?? false,
                groupId: m?.itemGroupId ?? null,
                categoryId: m?.itemCategoryId ?? null,
                brandId: m?.itemBrandId ?? null,
                sectionId: m?.itemSectionId ?? null,
            };
        });
    }
    loyaltySource(snap, lines, memberId) {
        return {
            docId: snap.sbId ?? '00000000-0000-0000-0000-000000000000',
            accYear: snap.accYear,
            companyId: snap.companyId,
            branchId: snap.branchId,
            custId: snap.custId ?? '00000000-0000-0000-0000-000000000000',
            docDate: snap.billDate,
            docRefno: snap.refno,
            docType: 'SALE_BILL',
            billType: snap.billType,
            memberId,
            chargesAmt: (0, sales_doc_utils_1.round2)(snap.charges.reduce((t, c) => t + c.amount, 0)),
            redeemedAmount: (0, sales_doc_utils_1.round2)(snap.tenders
                .filter((t) => t.tenderTypeId === sales_doc_utils_1.TENDER_TYPE.LOYALTY)
                .reduce((t, x) => t + x.amount, 0)),
            lines,
        };
    }
    async prismaChargesOf(tx, bill) {
        const rows = await tx.$queryRaw `
      SELECT cd_src_cd_id, cd_src_acc_year, cd_amount, cd_carry_basis FROM public.txn_charge_detail
       WHERE cd_doc_type = 'INVOICE' AND cd_doc_id = ${bill.sbId}::uuid AND cd_is_deleted = false`;
        return rows.map((r) => ({
            srcChargeId: r.cd_src_cd_id,
            srcAccYear: r.cd_src_acc_year?.trim() ?? null,
            amount: (0, sales_doc_utils_1.num)(r.cd_amount),
            basis: (r.cd_carry_basis ?? undefined),
        }));
    }
    async tenderMasters(c, ids) {
        const uniq = [...new Set(ids.filter((x) => !!x))];
        if (uniq.length === 0) {
            return new Map();
        }
        const rows = await c.$queryRaw `
      SELECT tnd_id, tnd_name, tnd_type_id, tnd_ledger_id, tnd_min_amount, tnd_max_amount, tnd_daily_limit
        FROM accounts.acc_tender_master WHERE tnd_id = ANY(${uniq}::uuid[])`;
        return new Map(rows.map((r) => [r.tnd_id, r]));
    }
    async company(tx, companyId) {
        const [row] = await tx.$queryRaw `
      SELECT comp_state_code, comp_einvoice_applicable, comp_dc_purposes FROM public.companys WHERE comp_id = ${companyId}::uuid`;
        return row ?? null;
    }
    async proposals(snap, ctx) {
        const out = {
            charges: [],
            advances: [],
            creditNotes: [],
            loyalty: null,
            tempCredit: { openOnMobile: [] },
        };
        await this.prisma.$transaction(async (tx) => {
            if (snap.srcDocType === 'SALES_ORDER' && snap.srcDocId && snap.srcDocYear) {
                const props = await this.chargeCarry.propose(tx, { orderId: snap.srcDocId, accYear: snap.srcDocYear }, snap.items
                    .filter((i) => i.srcItemId)
                    .map((i) => ({ srcLineId: i.srcItemId, taxableAmt: i.taxableAmt })));
                out.charges = props.map((p) => ({
                    cdSrcCdId: p.srcChargeId,
                    cdSrcAccYear: p.srcAccYear,
                    chgName: p.chargeName,
                    orderAmount: p.amount,
                    carriedSoFar: p.alreadyCarried,
                    proposed: p.proposed,
                    basis: p.basis,
                    isFinalBill: p.completesOrder,
                }));
            }
            if (snap.custId) {
                const credits = await tx.$queryRaw `
          SELECT abl_id, abl_acc_year, abl_doc_refno, abl_pending_amount, abl_bill_type, abl_src_doc_id
            FROM accounts.acc_bill_balance
           WHERE abl_company_id = ${snap.companyId}::uuid AND abl_party_id = ${snap.custId}::uuid
             AND abl_dr_cr = 'CR' AND abl_pending_amount > 0 AND abl_is_deleted = false AND abl_is_active = true
             AND abl_bill_type IN ('ADVANCE', 'SALES_RETURN')
           ORDER BY (abl_src_doc_id = ${snap.srcDocId ?? '00000000-0000-0000-0000-000000000000'}::uuid) DESC, abl_doc_date`;
                let want = snap.advanceAmt;
                out.advances = credits
                    .filter((c) => c.abl_bill_type === 'ADVANCE')
                    .map((c) => {
                    const proposed = Math.min(Math.max(want, 0), (0, sales_doc_utils_1.num)(c.abl_pending_amount));
                    want = (0, sales_doc_utils_1.round2)(want - proposed);
                    return {
                        ablId: c.abl_id,
                        ablAccYear: c.abl_acc_year.trim(),
                        refno: c.abl_doc_refno,
                        pending: (0, sales_doc_utils_1.num)(c.abl_pending_amount),
                        proposed: (0, sales_doc_utils_1.round2)(proposed),
                    };
                });
                let wantNote = snap.noteAdjAmt;
                out.creditNotes = credits
                    .filter((c) => c.abl_bill_type === 'SALES_RETURN')
                    .map((c) => {
                    const proposed = Math.min(Math.max(wantNote, 0), (0, sales_doc_utils_1.num)(c.abl_pending_amount));
                    wantNote = (0, sales_doc_utils_1.round2)(wantNote - proposed);
                    return {
                        ablId: c.abl_id,
                        ablAccYear: c.abl_acc_year.trim(),
                        refno: c.abl_doc_refno,
                        pending: (0, sales_doc_utils_1.num)(c.abl_pending_amount),
                        proposed: (0, sales_doc_utils_1.round2)(proposed),
                    };
                });
                if (snap.loyaltyMemberId || snap.custId !== ctx.settings.defaultCustomerId) {
                    const lines = await this.loyaltyLines(tx, snap);
                    const source = this.loyaltySource(snap, lines, snap.loyaltyMemberId);
                    const memberId = snap.loyaltyMemberId ??
                        (await this.loyalty.resolveMember(tx, source, {
                            autoEnrol: false,
                            isWalkIn: snap.custId === ctx.settings.defaultCustomerId,
                        }));
                    if (memberId) {
                        const p = await this.loyalty.preview({ ...source, memberId }, tx);
                        out.loyalty = {
                            memberId,
                            balance: p.balance,
                            redeemable: p.redeemable,
                            rate: p.rate,
                            minPoints: p.minPoints,
                            maxPoints: p.maxPoints,
                            maxRedeemAmount: p.maxRedeemAmount,
                            multiple: p.multiple,
                            earnPreview: p.earnPreview,
                            schemeId: p.schemeId,
                        };
                    }
                }
            }
            const mobiles = snap.tenders.map((t) => t.tempCredit?.mobile).filter((m) => !!m);
            if (mobiles.length > 0) {
                const rows = await tx.$queryRaw `
          SELECT atc_id, atc_bill_refno, atc_balance_amount, atc_due_date, atc_mobile FROM accounts.acc_temp_credit
           WHERE atc_company_id = ${snap.companyId}::uuid AND atc_mobile = ANY(${mobiles}::text[])
             AND atc_status IN ('OPEN', 'PARTIAL') AND atc_is_deleted = false ORDER BY atc_due_date`;
                out.tempCredit = {
                    openOnMobile: rows.map((r) => ({
                        atcId: r.atc_id,
                        billRefno: r.atc_bill_refno,
                        balance: (0, sales_doc_utils_1.num)(r.atc_balance_amount),
                        dueDate: (0, sales_doc_utils_1.isoDate)(r.atc_due_date),
                        mobile: r.atc_mobile,
                    })),
                };
            }
        });
        return out;
    }
};
exports.BillLifecycleService = BillLifecycleService;
exports.BillLifecycleService = BillLifecycleService = BillLifecycleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bill_service_1.BillService,
        sales_context_service_1.SalesContextService,
        statutory_service_1.StatutoryService,
        sales_posting_service_1.SalesPostingService,
        doc_register_service_1.DocRegisterService,
        sales_stock_service_1.SalesStockService,
        stock_reservation_service_1.StockReservationService,
        loyalty_ledger_service_1.LoyaltyLedgerService,
        promotion_usage_service_1.PromotionUsageService,
        charge_carry_service_1.ChargeCarryService,
        dc_fulfilment_service_1.DcFulfilmentService,
        sale_order_service_1.SaleOrderService,
        transport_band_service_1.TransportBandService,
        sales_doc_blocks_service_1.SalesDocBlocksService,
        gst_gateway_service_1.GstGatewayService,
        audit_log_service_1.AuditLogService])
], BillLifecycleService);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) {
    return !!v && UUID.test(v);
}
void sales_guards_1.assertBandWritable;
//# sourceMappingURL=bill-lifecycle.service.js.map