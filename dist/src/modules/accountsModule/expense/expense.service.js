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
exports.ExpenseService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const doc_register_service_1 = require("../../../common/posting/doc-register.service");
const voucher_posting_service_1 = require("../../../common/posting/voucher-posting.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const app_setting_value_service_1 = require("../../settings/appSettings/app-setting-value.service");
const till_approval_service_1 = require("../../till/services/till-approval.service");
const till_session_service_1 = require("../../till/services/till-session.service");
const till_enum_1 = require("../../till/types/till-enum");
const voucher_facts_1 = require("../vouchers/voucher-facts");
const vouchers_errors_1 = require("../vouchers/vouchers.errors");
const cash_payment_limit_1 = require("../payment/cash-payment-limit");
const payment_lines_1 = require("../payment/payment-lines");
const receipt_guards_1 = require("../receipt/receipt.guards");
const tender_detail_service_1 = require("../tenderDetail/tender-detail.service");
const tender_detail_api_types_1 = require("../tenderDetail/types/tender-detail-api.types");
const expense_derive_1 = require("./expense-derive");
const expense_enum_1 = require("./types/expense-enum");
const SAVE_TX = { maxWait: 10_000, timeout: 30_000 };
const POST_TX = { maxWait: 15_000, timeout: 120_000 };
const CASH_TENDER_TYPE_ID = 1;
const isoDate = (d) => d.toISOString().slice(0, 10);
let ExpenseService = class ExpenseService {
    prisma;
    requestContext;
    tenderDetail;
    posting;
    register;
    till;
    approvals;
    appSettings;
    constructor(prisma, requestContext, tenderDetail, posting, register, till, approvals, appSettings) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.tenderDetail = tenderDetail;
        this.posting = posting;
        this.register = register;
        this.till = till;
        this.approvals = approvals;
        this.appSettings = appSettings;
    }
    async save(dto) {
        const actor = this.actor();
        const voucherId = await this.prisma.$transaction(async (tx) => {
            if ((0, receipt_guards_1.accYearOf)(new Date(`${dto.voucherDate}T00:00:00Z`)) !== dto.accYear) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    { field: 'voucherDate', message: `${dto.voucherDate} is not in the year ${dto.accYear}` },
                ]);
            }
            await (0, receipt_guards_1.assertAccYearWritable)(tx, dto.companyId, dto.accYear, 'accYear');
            this.assertUniqueRows(dto);
            const type = await this.voucherType(tx);
            const existing = dto.voucherId
                ? await this.load(tx, {
                    companyId: dto.companyId,
                    branchId: dto.branchId,
                    accYear: dto.accYear,
                    voucherId: dto.voucherId,
                })
                : null;
            if (existing && existing.avhVoucherStatus !== expense_enum_1.ExpenseStatus.DRAFT) {
                (0, module_service_utils_1.throwAccountsConflict)('Expense voucher is not a draft', [
                    {
                        field: 'voucherId',
                        message: `Voucher ${existing.avhVoucherRefno ?? dto.voucherId} is ${existing.avhVoucherStatus}: only a DRAFT is edited`,
                    },
                ]);
            }
            const date = new Date(`${dto.voucherDate}T00:00:00Z`);
            const party = dto.partyId
                ? await tx.accLedgerMaster.findFirst({
                    where: { ledId: dto.partyId, ledIsDeleted: false },
                    select: { ledName: true },
                })
                : null;
            const tenders = await (0, payment_lines_1.normalisePaymentTenders)(tx, {
                tenders: dto.tenders,
                companyId: dto.companyId,
                branchId: dto.branchId,
                paymentDate: date,
                partyName: party?.ledName ?? dto.remarks ?? 'expense',
            });
            const draft = {
                version: 1,
                reasonId: dto.reasonId ?? null,
                lines: dto.lines.map((l) => ({
                    rowNo: l.rowNo,
                    ledgerId: l.ledgerId,
                    amount: Number(new client_1.Prisma.Decimal(String(l.amount)).toFixed(2)),
                    description: l.description ?? null,
                    costCentreId: l.costCentreId ?? null,
                    taxId: dto.gstBill ? (l.taxId ?? null) : null,
                    hsn: l.hsn ?? null,
                    itc: l.itc ?? true,
                })),
                gstBill: dto.gstBill
                    ? {
                        supplierGstin: dto.gstBill.supplierGstin?.trim().toUpperCase() || null,
                        invoiceNo: dto.gstBill.invoiceNo,
                        invoiceDate: dto.gstBill.invoiceDate.slice(0, 10),
                        placeOfSupplyCode: dto.gstBill.placeOfSupplyCode ?? null,
                    }
                    : null,
            };
            const docAmount = draft.lines.reduce((s, l) => s.plus(new client_1.Prisma.Decimal(String(l.amount))), new client_1.Prisma.Decimal(0));
            const now = new Date();
            const common = {
                avhCompanyId: dto.companyId,
                avhBranchId: dto.branchId,
                avhTenantId: dto.tenantId ?? null,
                avhVoucherTypeId: type.vchrTypeId,
                avhVoucherDate: date,
                avhPartyId: dto.partyId ?? null,
                avhUsrRefno: dto.usrRefno ?? null,
                avhDocRefno: draft.gstBill?.invoiceNo ?? null,
                avhDocDate: draft.gstBill ? new Date(`${draft.gstBill.invoiceDate}T00:00:00Z`) : null,
                avhDocAmount: docAmount,
                avhRemarks: dto.remarks ?? null,
                avhSessionId: dto.sessionId ?? null,
                avhDeviceId: this.requestContext.getDeviceId() ?? null,
                avhUserId: actor,
                avhDraftLines: draft,
            };
            const id = existing
                ? (await tx.accVoucherHeader.update({
                    where: {
                        avhVoucherId_avhAccYear: {
                            avhVoucherId: existing.avhVoucherId,
                            avhAccYear: dto.accYear,
                        },
                    },
                    data: { ...common, avhModifiedOn: now, avhModifiedBy: actor },
                    select: { avhVoucherId: true },
                })).avhVoucherId
                : (await tx.accVoucherHeader.create({
                    data: {
                        ...common,
                        avhAccYear: dto.accYear,
                        avhVoucherStatus: expense_enum_1.ExpenseStatus.DRAFT,
                        avhCreatedOn: now,
                        avhCreatedBy: actor,
                    },
                    select: { avhVoucherId: true },
                })).avhVoucherId;
            const scope = {
                tdSrcModule: tender_detail_api_types_1.TenderSrcModule.ACCOUNTS,
                tdSrcDocType: tender_detail_api_types_1.TenderSrcDocType.EXPENSE,
                tdSrcDocId: id,
                tdCompanyId: dto.companyId,
                tdBranchId: dto.branchId,
                tdTenantId: dto.tenantId ?? null,
                tdAccYear: dto.accYear,
                tdDocDate: date,
                tdPartyLedgerId: dto.partyId ?? dto.lines[0].ledgerId,
                tdUserId: actor,
                tdSessionId: dto.sessionId ?? null,
                tdDeviceId: this.requestContext.getDeviceId() ?? null,
                tdDrCr: tender_detail_api_types_1.TenderDrCr.CR,
            };
            await this.tenderDetail.syncDocumentTenders(tx, scope, tenders.map((t) => ({
                ...(t.tdId ? { tdId: t.tdId } : {}),
                tdRowNo: t.rowNo,
                tdTenderId: t.tenderId,
                tdTenderTypeId: t.tenderTypeId,
                tdTenderLedgerId: t.tenderLedgerId,
                tdAmount: t.amount.toFixed(2),
                tdReceivedAmt: t.receivedAmt.toFixed(2),
                tdChangeAmt: t.changeAmt.toFixed(2),
                tdMdrAmt: t.mdrAmt.toFixed(2),
                tdRefNo: t.refNo,
                tdBankName: t.bankName,
                tdPayerVpa: t.payerVpa,
                tdInstrumentDate: t.instrumentDate ? isoDate(t.instrumentDate) : null,
                tdIsPdc: t.isPdc,
                tdSettleLedgerId: t.clearingLedgerId,
                tdNotes: t.notes,
                tdVoucherId: null,
            })), actor, {
                tableName: 'expense tender',
                screenName: 'Expense Voucher',
                entityName: 'Expense tender',
            });
            if (!existing) {
                await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                    companyId: dto.companyId,
                    branchId: dto.branchId,
                    tenantId: dto.tenantId ?? null,
                    accYear: dto.accYear,
                    srcModule: txn_status_log_helper_1.TxnStatusSrcModule.ACCOUNTS,
                    srcDocType: txn_status_log_helper_1.TxnStatusDocType.EXPENSE,
                    srcDocId: id,
                    event: txn_status_log_helper_1.TxnStatusEvent.CREATED,
                    toStatus: expense_enum_1.ExpenseStatus.DRAFT,
                    changedBy: actor,
                    deviceId: this.requestContext.getDeviceId() ?? null,
                    sessionId: dto.sessionId ?? null,
                });
            }
            return id;
        }, SAVE_TX);
        return this.get({
            companyId: dto.companyId,
            branchId: dto.branchId,
            accYear: dto.accYear,
            voucherId,
        });
    }
    async validate(dto) {
        return this.prisma.$transaction(async (tx) => {
            const ctx = (0, vouchers_errors_1.newGuardContext)({ dryRun: true, canOverride: false });
            const tenders = await (0, payment_lines_1.normalisePaymentTenders)(tx, {
                tenders: dto.tenders,
                companyId: dto.companyId,
                branchId: dto.branchId,
                paymentDate: new Date(`${dto.voucherDate}T00:00:00Z`),
                partyName: 'expense',
            });
            const draft = {
                version: 1,
                reasonId: dto.reasonId ?? null,
                lines: dto.lines.map((l) => ({
                    rowNo: l.rowNo,
                    ledgerId: l.ledgerId,
                    amount: l.amount,
                    description: l.description ?? null,
                    costCentreId: l.costCentreId ?? null,
                    taxId: dto.gstBill ? (l.taxId ?? null) : null,
                    hsn: l.hsn ?? null,
                    itc: l.itc ?? true,
                })),
                gstBill: dto.gstBill
                    ? {
                        supplierGstin: dto.gstBill.supplierGstin?.trim().toUpperCase() || null,
                        invoiceNo: dto.gstBill.invoiceNo,
                        invoiceDate: dto.gstBill.invoiceDate.slice(0, 10),
                        placeOfSupplyCode: dto.gstBill.placeOfSupplyCode ?? null,
                    }
                    : null,
            };
            let route = {
                ref: null,
                cashLedgerId: null,
                safeName: null,
            };
            try {
                route = await this.till.routeMoneyDoc(tx, {
                    companyId: dto.companyId,
                    branchId: dto.branchId,
                    sessionId: dto.sessionId ?? null,
                    field: 'sessionId',
                    hasCash: tenders.some((t) => t.tenderTypeId === CASH_TENDER_TYPE_ID),
                });
            }
            catch (error) {
                this.refusalFromTill(ctx, error);
            }
            const derived = await this.derive(tx, {
                companyId: dto.companyId,
                branchId: dto.branchId,
                partyId: dto.partyId ?? null,
                draft,
                tenders,
                route,
                ctx,
            });
            const checks = await this.moneyChecks(tx, {
                companyId: dto.companyId,
                branchId: dto.branchId,
                accYear: dto.accYear,
                voucherDate: dto.voucherDate,
                voucherId: dto.voucherId ?? null,
                partyId: dto.partyId ?? null,
                tenders,
                total: derived.payload.total,
                inSession: !!route.ref,
                ctx,
            });
            return {
                ok: ctx.refusals.length === 0,
                derived: {
                    ...derived.payload,
                    session: route.ref ? { sessionId: route.ref.tssId, accYear: route.ref.tssAccYear } : null,
                    safeName: route.safeName,
                },
                refusals: ctx.refusals,
                warnings: ctx.warnings,
                approval: checks.approval,
            };
        }, SAVE_TX);
    }
    async post(key) {
        const actor = this.actor();
        const ctx = (0, vouchers_errors_1.newGuardContext)({ dryRun: false, canOverride: false });
        let approval = null;
        await this.prisma.$transaction(async (tx) => {
            await this.lockHeader(tx, key);
            const header = await this.load(tx, key);
            if (header.avhVoucherStatus !== expense_enum_1.ExpenseStatus.DRAFT) {
                (0, module_service_utils_1.throwAccountsConflict)('Expense voucher cannot be posted', [
                    {
                        field: 'voucherId',
                        message: `Voucher ${header.avhVoucherRefno ?? key.voucherId} is ${header.avhVoucherStatus}: only a DRAFT posts`,
                    },
                ]);
            }
            await (0, receipt_guards_1.assertAccYearWritable)(tx, key.companyId, key.accYear, 'accYear');
            await (0, receipt_guards_1.assertVoucherPartitionExists)(tx, key.accYear, 'accYear');
            const draft = this.draftOf(header);
            const tenders = await this.storedTenders(tx, header);
            const route = await this.till.routeMoneyDoc(tx, {
                companyId: key.companyId,
                branchId: key.branchId,
                sessionId: header.avhSessionId,
                field: 'sessionId',
                hasCash: tenders.some((t) => t.tenderTypeId === CASH_TENDER_TYPE_ID),
            });
            const derived = await this.derive(tx, {
                companyId: key.companyId,
                branchId: key.branchId,
                partyId: header.avhPartyId,
                draft,
                tenders,
                route,
                ctx,
            });
            const checks = await this.moneyChecks(tx, {
                companyId: key.companyId,
                branchId: key.branchId,
                accYear: key.accYear,
                voucherDate: isoDate(header.avhVoucherDate),
                voucherId: key.voucherId,
                partyId: header.avhPartyId,
                tenders,
                total: derived.payload.total,
                inSession: !!route.ref,
                ctx,
            });
            approval = checks.approval;
            if (ctx.refusals.length > 0) {
                (0, vouchers_errors_1.throwRefusals)('Expense voucher cannot be posted', ctx.refusals);
            }
            const actorName = await this.actorName(tx, actor);
            if (route.ref) {
                await this.till.stampVoucher(tx, route.ref, { voucherId: key.voucherId, accYear: key.accYear, srcDocType: expense_enum_1.EXPENSE_SRC_DOC_TYPE }, actorName);
            }
            if (route.cashLedgerId) {
                await this.till.routeCashToLedger(tx, {
                    srcDocType: expense_enum_1.EXPENSE_SRC_DOC_TYPE,
                    srcDocId: key.voucherId,
                    accYear: key.accYear,
                    ledgerId: route.cashLedgerId,
                    actor,
                });
            }
            const voucherDate = isoDate(header.avhVoucherDate);
            const posted = await this.posting.postLegs(tx, {
                header: {
                    companyId: key.companyId,
                    branchId: key.branchId,
                    tenantId: header.avhTenantId,
                    accYear: key.accYear,
                    voucherTypeId: header.avhVoucherTypeId,
                    voucherDate,
                    docLabel: 'Expense voucher',
                    docRefno: header.avhDocRefno,
                    docDate: header.avhDocDate ? isoDate(header.avhDocDate) : null,
                    usrRefno: header.avhUsrRefno,
                    docAmount: derived.payload.total,
                    partyId: header.avhPartyId,
                    userId: actor,
                    sessionId: route.ref?.tssId ?? header.avhSessionId,
                    deviceId: header.avhDeviceId,
                    remarks: header.avhRemarks,
                    createdBy: actorName,
                    draftVoucherId: key.voucherId,
                },
                legs: derived.legs,
            });
            await tx.accTenderDetail.updateMany({
                where: {
                    tdSrcDocType: expense_enum_1.EXPENSE_SRC_DOC_TYPE,
                    tdSrcDocId: key.voucherId,
                    tdAccYear: key.accYear,
                    tdIsDeleted: false,
                },
                data: { tdVoucherId: key.voucherId, tdModifiedOn: new Date(), tdModifiedBy: actor },
            });
            for (const c of derived.costCentres) {
                await tx.$executeRaw `
          UPDATE accounts.acc_vouchers SET av_cost_centre_id = ${c.costCentreId}::uuid
           WHERE av_voucher_id = ${key.voucherId}::uuid AND av_acc_year = ${key.accYear}::char(9)
             AND av_row_no = ${c.rowNo}::int AND av_is_deleted = false`;
            }
            if (derived.gst) {
                await this.register.write(tx, await this.registerDoc(tx, header, derived, posted, voucherDate, actorName), { interState: derived.gst.supplyNature === 'INTER' });
            }
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: key.companyId,
                branchId: key.branchId,
                tenantId: header.avhTenantId,
                accYear: key.accYear,
                srcModule: txn_status_log_helper_1.TxnStatusSrcModule.ACCOUNTS,
                srcDocType: txn_status_log_helper_1.TxnStatusDocType.EXPENSE,
                srcDocId: key.voucherId,
                srcDocRefno: posted.voucherRefno,
                event: txn_status_log_helper_1.TxnStatusEvent.POSTED,
                fromStatus: expense_enum_1.ExpenseStatus.DRAFT,
                toStatus: expense_enum_1.ExpenseStatus.POSTED,
                changedBy: actor,
                deviceId: this.requestContext.getDeviceId() ?? null,
                sessionId: route.ref?.tssId ?? null,
            });
            if (route.ref) {
                await this.till.logMoneyDoc(tx, {
                    sessionId: route.ref.tssId,
                    code: till_enum_1.TillEventCode.EXPENSE_POSTED,
                    srcDocType: 'EXPENSE',
                    srcDocId: key.voucherId,
                    srcRefno: posted.voucherRefno,
                    amount: derived.payload.total,
                    payload: {
                        cash: derived.payload.tenders
                            .filter((t) => t.moneyFrom === expense_enum_1.ExpenseMoneyFrom.DRAWER)
                            .reduce((s, t) => s + t.amount, 0),
                        ...(checks.approval ? { approval: { ...checks.approval } } : {}),
                        ...(checks.limit40A3 ? { statutory: { ...checks.limit40A3.statutory } } : {}),
                    },
                });
            }
        }, POST_TX);
        return { ...(await this.get(key)), warnings: ctx.warnings, approval };
    }
    async cancel(key) {
        const actor = this.actor();
        await this.prisma.$transaction(async (tx) => {
            await this.lockHeader(tx, key);
            const header = await this.load(tx, key);
            if (header.avhVoucherStatus !== expense_enum_1.ExpenseStatus.POSTED) {
                (0, module_service_utils_1.throwAccountsConflict)('Expense voucher cannot be cancelled', [
                    {
                        field: 'voucherId',
                        message: `Voucher ${header.avhVoucherRefno ?? key.voucherId} is ${header.avhVoucherStatus}: only a POSTED voucher is cancelled`,
                    },
                ]);
            }
            await (0, receipt_guards_1.assertAccYearWritable)(tx, key.companyId, key.accYear, 'accYear');
            await this.till.assertMoneyDocCancellable(tx, {
                sessionId: header.avhSessionId,
                field: 'voucherId',
            });
            const actorName = await this.actorName(tx, actor);
            const mirror = await this.posting.reverseLegs(tx, key.voucherId, key.accYear, key.reason, actorName);
            if (!mirror) {
                (0, module_service_utils_1.throwAccountsConflict)('Expense voucher cannot be cancelled', [
                    { field: 'voucherId', message: 'There is no live posted voucher to reverse' },
                ]);
            }
            await tx.accTenderDetail.updateMany({
                where: {
                    tdSrcDocType: expense_enum_1.EXPENSE_SRC_DOC_TYPE,
                    tdSrcDocId: key.voucherId,
                    tdAccYear: key.accYear,
                    tdIsDeleted: false,
                },
                data: { tdIsDeleted: true, tdModifiedOn: new Date(), tdModifiedBy: actor },
            });
            const gdrId = await this.register.registerIdOfVoucher(tx, key.voucherId, key.accYear);
            if (gdrId) {
                await this.register.cancel(tx, gdrId, key.accYear, key.reason, actorName);
            }
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: key.companyId,
                branchId: key.branchId,
                tenantId: header.avhTenantId,
                accYear: key.accYear,
                srcModule: txn_status_log_helper_1.TxnStatusSrcModule.ACCOUNTS,
                srcDocType: txn_status_log_helper_1.TxnStatusDocType.EXPENSE,
                srcDocId: key.voucherId,
                srcDocRefno: header.avhVoucherRefno,
                event: txn_status_log_helper_1.TxnStatusEvent.CANCELLED,
                fromStatus: expense_enum_1.ExpenseStatus.POSTED,
                toStatus: expense_enum_1.ExpenseStatus.CANCELLED,
                changedBy: actor,
                deviceId: this.requestContext.getDeviceId() ?? null,
                remarks: key.reason,
            });
            if (header.avhSessionId) {
                await this.till.logMoneyDoc(tx, {
                    sessionId: header.avhSessionId,
                    code: till_enum_1.TillEventCode.MONEY_DOC_CANCELLED,
                    srcDocType: 'EXPENSE',
                    srcDocId: key.voucherId,
                    srcRefno: header.avhVoucherRefno,
                    amount: header.avhDocAmount,
                    payload: { reason: key.reason, reversalVoucherId: mirror.voucherId },
                });
            }
        }, POST_TX);
        return this.get(key);
    }
    async get(key) {
        return this.prisma.$transaction(async (tx) => {
            const header = await this.load(tx, key);
            const draft = this.draftOf(header);
            const tenders = await this.storedTenders(tx, header, true);
            const ctx = (0, vouchers_errors_1.newGuardContext)({ dryRun: true, canOverride: false });
            const posted = header.avhVoucherStatus !== expense_enum_1.ExpenseStatus.DRAFT;
            const derived = await this.derive(tx, {
                companyId: key.companyId,
                branchId: key.branchId,
                partyId: header.avhPartyId,
                draft,
                tenders,
                route: { ref: null, cashLedgerId: null, safeName: null },
                ctx,
            });
            const party = header.avhPartyId
                ? await tx.accLedgerMaster.findFirst({
                    where: { ledId: header.avhPartyId },
                    select: { ledName: true },
                })
                : null;
            if (posted) {
                derived.payload.legs = await this.storedLegs(tx, key);
                await this.markMoneyFrom(tx, header, derived);
            }
            return {
                voucherId: header.avhVoucherId,
                companyId: header.avhCompanyId,
                branchId: header.avhBranchId,
                accYear: header.avhAccYear,
                status: header.avhVoucherStatus,
                voucherNo: header.avhVoucherRefno,
                voucherDate: isoDate(header.avhVoucherDate),
                partyId: header.avhPartyId,
                partyName: party?.ledName ?? null,
                usrRefno: header.avhUsrRefno,
                remarks: header.avhRemarks,
                reasonId: draft.reasonId,
                sessionId: header.avhSessionId,
                gstBill: draft.gstBill,
                amount: derived.payload.total,
                derived: { ...derived.payload, session: null, safeName: null },
                postedOn: header.avhPostedOn?.toISOString() ?? null,
                cancelReason: header.avhCancelReason,
                reversalVoucherId: header.avhReversalVoucherId,
                createdOn: header.avhCreatedOn.toISOString(),
            };
        });
    }
    async quickReasons(companyId) {
        const rows = await this.prisma.$queryRaw `
      SELECT r.trs_id, r.trs_code, r.trs_name, r.trs_ledger_id, l.led_name,
             r.trs_needs_note, r.trs_needs_ref, r.trs_max_amount
        FROM accounts.till_reason r
        LEFT JOIN accounts.acc_ledger_master l
               ON l.led_id = r.trs_ledger_id AND l.led_is_deleted = false
       WHERE r.trs_category = ${expense_enum_1.EXPENSE_REASON_CATEGORY}
         AND r.trs_is_active AND NOT r.trs_is_deleted
         AND (r.trs_company_id IS NULL OR r.trs_company_id = ${companyId}::uuid)
       ORDER BY r.trs_sort_order, r.trs_name`;
        return rows.map((r) => ({
            reasonId: r.trs_id,
            code: r.trs_code,
            name: r.trs_name,
            ledgerId: r.led_name ? r.trs_ledger_id : null,
            ledgerName: r.led_name,
            needsNote: r.trs_needs_note,
            needsRef: r.trs_needs_ref,
            maxAmount: r.trs_max_amount === null ? null : Number(r.trs_max_amount),
        }));
    }
    async ledgerPick(companyId, search) {
        const like = search?.trim() ? `%${search.trim()}%` : null;
        const rows = await this.prisma.$queryRaw `
      WITH RECURSIVE g AS (
        SELECT acc_group_id FROM accounts.acc_group_master
         WHERE acc_group_nature = ${expense_enum_1.EXPENSE_GROUP_NATURE} AND acc_group_is_deleted = false
           AND (acc_group_company_id IS NULL OR acc_group_company_id = ${companyId}::uuid)
        UNION
        SELECT c.acc_group_id FROM accounts.acc_group_master c JOIN g ON c.acc_group_parent_id = g.acc_group_id
         WHERE c.acc_group_is_deleted = false
      )
      SELECT l.led_id, l.led_name, grp.acc_group_name, l.led_tax_id, l.led_itc_eligibility
        FROM accounts.acc_ledger_master l
        JOIN accounts.acc_group_master grp ON grp.acc_group_id = l.led_group_id
       WHERE l.led_group_id IN (SELECT acc_group_id FROM g)
         AND l.led_is_active AND NOT l.led_is_deleted
         AND (l.led_company_id IS NULL OR l.led_company_id = ${companyId}::uuid)
         AND (${like}::text IS NULL OR l.led_name ILIKE ${like}::text)
       ORDER BY l.led_name
       LIMIT 500`;
        return rows.map((r) => ({
            ledgerId: r.led_id,
            name: r.led_name,
            groupName: r.acc_group_name,
            taxId: r.led_tax_id,
            itcEligibility: r.led_itc_eligibility,
        }));
    }
    async derive(tx, input) {
        const company = await (0, voucher_facts_1.loadCompanyFacts)(tx, input.companyId);
        if (!company) {
            (0, module_service_utils_1.throwAccountsNotFound)('Company not found', 'companyId', `No company ${input.companyId}`);
        }
        const lineLedgerIds = input.draft.lines.map((l) => l.ledgerId);
        const ledgers = await (0, voucher_facts_1.loadLedgerFacts)(tx, input.companyId, [
            ...lineLedgerIds,
            ...(input.partyId ? [input.partyId] : []),
        ]);
        const party = input.partyId ? (ledgers.get(input.partyId) ?? null) : null;
        if (input.partyId && (!party || !party.isActive || party.isDeleted || !party.isParty)) {
            input.ctx.refusals.push({
                code: expense_enum_1.ExpenseErrorCode.PARTY_INVALID,
                message: 'The supplier named is not a live party ledger (Sundry Creditors / Debtors) of this company',
                field: 'partyId',
            });
        }
        const expenseLedgerIds = await this.expenseLedgerIds(tx, lineLedgerIds);
        const bill = input.draft.gstBill;
        const taxIds = bill
            ? input.draft.lines.map((l) => l.taxId).filter((t) => !!t)
            : [];
        const taxRates = await (0, voucher_facts_1.loadTaxRates)(tx, taxIds);
        const asks = [];
        for (const taxId of new Set(taxIds)) {
            for (const nature of ['INTRA', 'INTER']) {
                for (const c of ['CGST', 'SGST', 'IGST', 'CESS']) {
                    asks.push({ role: `INPUT_${c}`, taxId, supplyNature: nature });
                }
            }
        }
        const roleLedgers = await (0, voucher_facts_1.resolveRoleLedgerMap)(tx, input.companyId, input.branchId, asks);
        const tenders = input.tenders;
        const ledgerIds = new Set();
        for (const t of tenders) {
            ledgerIds.add(t.clearingLedgerId ?? t.tenderLedgerId);
        }
        if (input.route.cashLedgerId)
            ledgerIds.add(input.route.cashLedgerId);
        for (const hit of roleLedgers.values())
            if (hit)
                ledgerIds.add(hit.ledgerId);
        const named = await tx.accLedgerMaster.findMany({
            where: { ledId: { in: [...ledgerIds] } },
            select: { ledId: true, ledName: true },
        });
        const facts = {
            company,
            ledgers,
            expenseLedgerIds,
            party,
            taxRates,
            roleLedgers,
            tenders,
            ledgerNames: new Map(named.map((n) => [n.ledId, n.ledName])),
            cash: {
                moneyFrom: input.route.ref
                    ? expense_enum_1.ExpenseMoneyFrom.DRAWER
                    : input.route.cashLedgerId
                        ? expense_enum_1.ExpenseMoneyFrom.SAFE
                        : expense_enum_1.ExpenseMoneyFrom.LEDGER,
                ledgerId: input.route.cashLedgerId,
            },
        };
        const derived = (0, expense_derive_1.deriveExpense)(input.draft, facts, input.ctx);
        await this.warnNoGstBill(tx, input, derived);
        return derived;
    }
    async moneyChecks(tx, input) {
        const cash = input.tenders
            .filter((t) => t.tenderTypeId === CASH_TENDER_TYPE_ID)
            .reduce((sum, t) => sum.plus(t.amount), new client_1.Prisma.Decimal(0));
        const limit40A3 = await (0, cash_payment_limit_1.checkCashPaymentLimit)(tx, {
            companyId: input.companyId,
            accYear: input.accYear,
            onDate: input.voucherDate,
            payeeLedgerId: input.partyId,
            cash,
            excludeDocId: input.voucherId,
            field: 'tenders',
        });
        if (limit40A3?.enforce === 'REFUSE') {
            input.ctx.refusals.push({
                code: limit40A3.code,
                message: limit40A3.message,
                field: limit40A3.field,
            });
        }
        else if (limit40A3) {
            input.ctx.warnings.push({
                code: limit40A3.code,
                level: limit40A3.enforce === 'INFO' ? 'INFO' : 'WARN',
                overridable: false,
                message: limit40A3.message,
                field: limit40A3.field,
            });
        }
        const approval = input.inSession
            ? await this.approvals.assess(tx, {
                companyId: input.companyId,
                branchId: input.branchId,
                event: 'EXPENSE',
                onDate: input.voucherDate,
                amount: new client_1.Prisma.Decimal(input.total),
            })
            : null;
        if (approval) {
            input.ctx.warnings.push({
                code: till_enum_1.TillErrorCode.APPROVAL_REQUIRED,
                level: 'INFO',
                overridable: false,
                message: `An expense of ${input.total.toFixed(2)} at a till is above the EXPENSE threshold of ` +
                    `${approval.threshold.toFixed(2)} (${approval.minRole}): recorded for review — ` +
                    'the approval gate is not built yet',
                field: 'tenders',
            });
        }
        return { approval, limit40A3 };
    }
    async warnNoGstBill(_tx, input, derived) {
        if (input.draft.gstBill) {
            return;
        }
        const effective = await this.appSettings.resolveEffective({
            companyId: input.companyId,
            branchId: input.branchId,
            deviceId: null,
            userId: null,
        });
        const raw = effective.find((e) => e.asdKey === expense_enum_1.EXPENSE_GST_BILL_ABOVE_KEY)?.value;
        const above = Number(raw ?? 0);
        if (Number.isFinite(above) && above > 0 && derived.payload.total > above) {
            input.ctx.warnings.push({
                code: expense_enum_1.ExpenseErrorCode.GST_BILL_MISSING,
                level: 'WARN',
                overridable: false,
                message: `An expense of ${derived.payload.total.toFixed(2)} with no GST bill (asked above ${above.toFixed(2)}): enter the supplier's bill to claim the input tax`,
                field: 'gstBill',
            });
        }
    }
    async expenseLedgerIds(tx, ids) {
        if (ids.length === 0) {
            return new Set();
        }
        const rows = await tx.$queryRaw `
      WITH RECURSIVE up AS (
        SELECT l.led_id, g.acc_group_parent_id, g.acc_group_nature, 0 AS d
          FROM accounts.acc_ledger_master l
          JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
         WHERE l.led_id = ANY(${[...new Set(ids)]}::uuid[])
        UNION ALL
        SELECT up.led_id, p.acc_group_parent_id, p.acc_group_nature, up.d + 1
          FROM up JOIN accounts.acc_group_master p ON p.acc_group_id = up.acc_group_parent_id
         WHERE up.d < 24
      )
      SELECT DISTINCT led_id::text AS led_id FROM up WHERE acc_group_nature = ${expense_enum_1.EXPENSE_GROUP_NATURE}`;
        return new Set(rows.map((r) => r.led_id));
    }
    async storedTenders(tx, header, keepLedger = false) {
        const stored = await tx.accTenderDetail.findMany({
            where: {
                tdSrcDocType: expense_enum_1.EXPENSE_SRC_DOC_TYPE,
                tdSrcDocId: header.avhVoucherId,
                tdAccYear: header.avhAccYear,
                ...(header.avhVoucherStatus === expense_enum_1.ExpenseStatus.CANCELLED ? {} : { tdIsDeleted: false }),
            },
            orderBy: { tdRowNo: 'asc' },
        });
        if (stored.length === 0) {
            return [];
        }
        const inputs = stored.map((row) => ({
            tdId: row.tdId,
            tdRowNo: row.tdRowNo,
            tdTenderId: row.tdTenderId,
            tdTenderTypeId: row.tdTenderTypeId,
            tdTenderLedgerId: keepLedger ? undefined : row.tdTenderLedgerId,
            tdAmount: row.tdAmount,
            tdReceivedAmt: row.tdReceivedAmt,
            tdChangeAmt: row.tdChangeAmt,
            tdMdrAmt: row.tdMdrAmt,
            tdRefNo: row.tdRefNo,
            tdBankName: row.tdBankName,
            tdPayerVpa: row.tdPayerVpa,
            tdInstrumentDate: row.tdInstrumentDate ? isoDate(row.tdInstrumentDate) : null,
            tdNotes: row.tdNotes,
        }));
        const tenders = await (0, payment_lines_1.normalisePaymentTenders)(tx, {
            tenders: inputs,
            companyId: header.avhCompanyId,
            branchId: header.avhBranchId,
            paymentDate: header.avhVoucherDate,
            partyName: 'expense',
        });
        if (!keepLedger) {
            return tenders;
        }
        const byRow = new Map(stored.map((r) => [r.tdRowNo, r.tdTenderLedgerId]));
        return tenders.map((t) => ({
            ...t,
            tenderLedgerId: byRow.get(t.rowNo) ?? t.tenderLedgerId,
        }));
    }
    async storedLegs(tx, key) {
        const legs = await tx.$queryRaw `
      SELECT v.av_row_no, v.av_dr_cr, v.av_ledger_id, l.led_name, v.av_role, v.av_amount, v.av_remarks
        FROM accounts.acc_vouchers v
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = v.av_ledger_id
       WHERE v.av_voucher_id = ${key.voucherId}::uuid AND v.av_acc_year = ${key.accYear}::char(9)
         AND v.av_is_deleted = false
       ORDER BY v.av_row_no`;
        return legs.map((l) => ({
            rowNo: l.av_row_no,
            drCr: l.av_dr_cr.trim(),
            ledgerId: l.av_ledger_id,
            ledgerName: l.led_name,
            role: l.av_role,
            amount: Number(new client_1.Prisma.Decimal(l.av_amount).toFixed(2)),
            remarks: l.av_remarks,
            line: null,
        }));
    }
    async registerDoc(tx, header, derived, posted, voucherDate, actorName) {
        const g = derived.gst;
        const [party] = await tx.$queryRaw `
      SELECT led_name, led_addr1, led_addr2, led_addr3, led_city, led_pin, led_state_code, led_state_name,
             led_gst_party_reg_type
        FROM accounts.acc_ledger_master WHERE led_id = ${header.avhPartyId}::uuid`;
        const supplyNature = g.supplyNature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE';
        const n = (v) => Number(v.toFixed(2));
        const tax = g.cgst.plus(g.sgst).plus(g.igst).plus(g.cess);
        const services = g.lines.filter((l) => l.isService).length;
        const lines = g.lines.map((l) => {
            const lineTax = l.cgst.plus(l.sgst).plus(l.igst).plus(l.cess);
            return {
                rowNo: l.rowNo,
                description: l.ledgerName,
                hsnCode: l.hsn,
                qty: 1,
                rate: n(l.taxable),
                discount: 0,
                isService: l.isService,
                taxableValue: n(l.taxable),
                taxId: l.rate.taxId,
                totalTaxRate: Number(l.rate.ratePerc.toString()),
                cgstRate: Number(l.rate.cgstPerc.toString()),
                sgstRate: Number(l.rate.sgstPerc.toString()),
                igstRate: Number(l.rate.igstPerc.toString()),
                cessRate: Number(l.rate.cessPerc.toString()),
                cgstAmount: n(l.cgst),
                sgstAmount: n(l.sgst),
                igstAmount: n(l.igst),
                cessAmount: n(l.cess),
                otherAmount: 0,
                totalValue: n(l.taxable.plus(lineTax)),
                billValue: n(l.taxable.plus(lineTax)),
                taxability: taxabilityOf(l.rate.taxability),
                supplyNature,
                taxableLedgerId: l.ledgerId,
                cgstLedgerId: l.taxLedgers.CGST,
                sgstLedgerId: l.taxLedgers.SGST,
                igstLedgerId: l.taxLedgers.IGST,
                cessLedgerId: l.taxLedgers.CESS,
                itcEligibility: l.itcEligibility,
            };
        });
        return {
            companyId: header.avhCompanyId,
            branchId: header.avhBranchId,
            accYear: header.avhAccYear,
            voucherId: header.avhVoucherId,
            voucherTypeId: header.avhVoucherTypeId,
            voucherNo: posted.voucherLastNo,
            voucherDate,
            voucherRefno: posted.voucherRefno ?? '',
            sourceModule: 'ACCOUNTS',
            sourceDocId: header.avhVoucherId,
            docType: 'INVOICE',
            tranNature: 'PURCHASE',
            docFlow: 'INWARD',
            docSign: 1,
            docNo: g.invoiceNo,
            docDate: g.invoiceDate,
            docRefNo: posted.voucherRefno,
            taxability: lines.every((l) => l.taxability === lines[0].taxability)
                ? lines[0].taxability
                : 'MIXED',
            supplyClass: services === 0 ? 'GOODS' : services === lines.length ? 'SERVICES' : 'MIXED',
            supplyNature,
            placeOfSupplyCode: g.placeOfSupplyCode,
            placeOfSupplyName: null,
            isReverseCharge: false,
            igstOnIntra: false,
            partyType: 'VENDOR',
            partyId: header.avhPartyId,
            partyName: party?.led_name ?? '',
            partyAddr1: party?.led_addr1 ?? null,
            partyAddr2: party?.led_addr2 ?? null,
            partyAddr3: party?.led_addr3 ?? null,
            partyLocation: party?.led_city ?? null,
            partyPin: party?.led_pin ?? null,
            partyStateCode: g.supplierGstin.slice(0, 2) || (party?.led_state_code ?? null),
            partyStateName: party?.led_state_name ?? null,
            partyGstType: party?.led_gst_party_reg_type ?? 'REGULAR',
            partyGstin: g.supplierGstin,
            grossValue: n(g.taxable),
            discountValue: 0,
            taxableValue: n(g.taxable),
            cgstValue: n(g.cgst),
            sgstValue: n(g.sgst),
            igstValue: n(g.igst),
            cessValue: n(g.cess),
            stateCessValue: 0,
            tcsValue: 0,
            otherCharge: 0,
            roundOff: 0,
            billValue: n(g.taxable.plus(tax)),
            remarks: header.avhRemarks,
            createdBy: actorName,
            lines,
        };
    }
    async markMoneyFrom(tx, header, derived) {
        const session = header.avhSessionId
            ? await tx.tillSession.findFirst({
                where: { tssId: header.avhSessionId, tssIsDeleted: false },
                select: { tssId: true, tssAccYear: true },
            })
            : null;
        const cash = derived.payload.tenders.filter((t) => t.tenderTypeId === CASH_TENDER_TYPE_ID);
        const safes = await tx.tillSafe.findMany({
            where: { tsfLedgerId: { in: cash.map((t) => t.ledgerId) }, tsfIsDeleted: false },
            select: { tsfLedgerId: true },
        });
        const safeLedgers = new Set(safes.map((s) => s.tsfLedgerId));
        for (const t of cash) {
            t.moneyFrom = session
                ? expense_enum_1.ExpenseMoneyFrom.DRAWER
                : safeLedgers.has(t.ledgerId)
                    ? expense_enum_1.ExpenseMoneyFrom.SAFE
                    : expense_enum_1.ExpenseMoneyFrom.LEDGER;
        }
    }
    refusalFromTill(ctx, error) {
        if (!(error instanceof common_1.HttpException)) {
            throw error;
        }
        const body = error.getResponse();
        const detail = body?.errors?.[0];
        ctx.refusals.push({
            code: detail?.code ?? 'TILL',
            message: detail?.message ?? error.message,
            field: detail?.field ?? 'sessionId',
        });
    }
    assertUniqueRows(dto) {
        const dup = (rows) => rows.find((r, i) => rows.indexOf(r) !== i);
        const line = dup(dto.lines.map((l) => l.rowNo));
        const tender = dup(dto.tenders.map((t) => t.tdRowNo));
        if (line !== undefined || tender !== undefined) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                line !== undefined
                    ? { field: 'lines', message: `Line row ${line} appears twice` }
                    : { field: 'tenders', message: `Tender row ${tender} appears twice` },
            ]);
        }
    }
    draftOf(header) {
        const raw = header.avhDraftLines;
        if (!raw || raw.version !== 1 || !Array.isArray(raw.lines)) {
            (0, module_service_utils_1.throwAccountsConflict)('Expense voucher has no lines', [
                { field: 'voucherId', message: 'The voucher carries no expense lines (avh_draft_lines)' },
            ]);
        }
        return raw;
    }
    async voucherType(tx) {
        const type = await tx.accVoucherType.findFirst({
            where: { vchrTypeCode: expense_enum_1.EXPENSE_VOUCHER_TYPE_CODE },
            select: { vchrTypeId: true, vchrIsActive: true },
        });
        if (!type || !type.vchrIsActive) {
            (0, module_service_utils_1.throwAccountsNotFound)('Voucher type not found', 'voucherType', `The ${expense_enum_1.EXPENSE_VOUCHER_TYPE_CODE} voucher type is missing or inactive`);
        }
        return type;
    }
    async load(tx, key) {
        const header = await tx.accVoucherHeader.findFirst({
            where: {
                avhVoucherId: key.voucherId,
                avhAccYear: key.accYear,
                avhIsDeleted: false,
                voucherType: { vchrTypeCode: expense_enum_1.EXPENSE_VOUCHER_TYPE_CODE },
            },
            include: { voucherType: { select: { vchrTypeCode: true } } },
        });
        if (!header || header.avhCompanyId !== key.companyId || header.avhBranchId !== key.branchId) {
            (0, module_service_utils_1.throwAccountsNotFound)('Expense voucher not found', 'voucherId', `No expense voucher ${key.voucherId} in ${key.accYear} for this branch`);
        }
        return header;
    }
    async lockHeader(tx, key) {
        await tx.$queryRaw `
      SELECT avh_voucher_id FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${key.voucherId}::uuid AND avh_acc_year = ${key.accYear}::char(9)
       FOR UPDATE`;
    }
    actor() {
        return this.requestContext.getUserId() ?? module_shared_utils_1.DEFAULT_ACTOR;
    }
    async actorName(tx, userId) {
        const user = await tx.userMaster.findUnique({
            where: { usrId: userId },
            select: { usrLoginName: true },
        });
        return user?.usrLoginName ?? userId;
    }
};
exports.ExpenseService = ExpenseService;
exports.ExpenseService = ExpenseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        tender_detail_service_1.TenderDetailService,
        voucher_posting_service_1.VoucherPostingService,
        doc_register_service_1.DocRegisterService,
        till_session_service_1.TillSessionService,
        till_approval_service_1.TillApprovalService,
        app_setting_value_service_1.AppSettingValueService])
], ExpenseService);
function taxabilityOf(rate) {
    switch (rate.toUpperCase()) {
        case 'EXEMPT':
            return 'EXEMPT';
        case 'NIL_RATED':
            return 'NIL_RATED';
        case 'NON_GST':
            return 'NON_GST';
        default:
            return 'TAXABLE';
    }
}
//# sourceMappingURL=expense.service.js.map