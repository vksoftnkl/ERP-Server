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
exports.PaymentAmendService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const bill_balance_recompute_service_1 = require("../billBalance/bill-balance-recompute.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const receipt_utils_1 = require("../receipt/receipt.utils");
const payment_open_items_service_1 = require("./payment-open-items.service");
const payment_service_1 = require("./payment.service");
const payment_posting_service_1 = require("./payment-posting.service");
const payment_unwind_guards_1 = require("./payment-unwind.guards");
const payment_cheque_links_1 = require("./payment-cheque-links");
const payment_guards_1 = require("./payment.guards");
const payment_enum_1 = require("./types/payment-enum");
const AMEND_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 120_000 };
const AMEND_AUDIT_SCREEN = 'Payment';
let PaymentAmendService = class PaymentAmendService {
    prisma;
    requestContext;
    paymentService;
    postingService;
    openItemsService;
    recompute;
    auditLogService;
    constructor(prisma, requestContext, paymentService, postingService, openItemsService, recompute, auditLogService) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.paymentService = paymentService;
        this.postingService = postingService;
        this.openItemsService = openItemsService;
        this.recompute = recompute;
        this.auditLogService = auditLogService;
    }
    async amend(dto) {
        const actor = this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        try {
            return await this.prisma.$transaction((tx) => this.amendInTransaction(tx, dto, actor), AMEND_TRANSACTION_OPTIONS);
        }
        catch (error) {
            throw (0, payment_posting_service_1.rethrowAllocationError)(error);
        }
    }
    async amendInTransaction(tx, dto, actor) {
        await tx.$queryRaw `
      SELECT avh_voucher_id FROM accounts.acc_voucher_header
       WHERE avh_voucher_id = ${dto.avhVoucherId}::uuid AND avh_acc_year = ${dto.avhAccYear}::bpchar
         FOR UPDATE`;
        const header = await this.paymentService.loadHeaderOrThrow(tx, dto.avhVoucherId, dto.avhAccYear);
        (0, payment_guards_1.assertHeaderScope)(header, {
            companyId: dto.avhCompanyId,
            branchId: dto.avhBranchId,
            accYear: dto.avhAccYear,
            voucherId: dto.avhVoucherId,
        });
        const settings = await this.openItemsService.loadSettings(header.avhCompanyId, header.avhBranchId);
        this.assertAmendPermitted(settings.allowPostedAmend);
        this.assertStatusMayAmend(header);
        await this.assertPartyUnchanged(tx, header, dto.avhPartyId);
        this.assertRevisionIsCurrent(header, dto.baseRevision);
        const pdcHeaders = (await tx.accVoucherHeader.findMany({
            where: (0, payment_cheque_links_1.paymentPdcVoucherWhere)(header),
            select: payment_service_1.STORED_HEADER_SELECT,
        })).map((row) => ({ ...row, avhPartyId: row.avhPartyId ?? header.avhPartyId }));
        const vouchers = [header, ...pdcHeaders];
        const voucherIds = vouchers.map((voucher) => voucher.avhVoucherId);
        const years = [...new Set(vouchers.map((voucher) => voucher.avhAccYear))];
        for (const voucher of vouchers) {
            await (0, payment_guards_1.assertAccYearWritable)(tx, voucher.avhCompanyId, voucher.avhAccYear, 'avhAccYear');
        }
        await (0, payment_unwind_guards_1.assertIssuedChequesStillHeld)(tx, { receiptVoucherId: header.avhVoucherId, voucherIds }, 'amended');
        await (0, payment_unwind_guards_1.assertNoSettledTransfer)(tx, header.avhVoucherId, 'amended');
        const advanceBills = await (0, payment_unwind_guards_1.assertAdvancesUntouched)(tx, voucherIds, years, 'amended');
        const before = await this.paymentService.loadFullPayment(tx, header);
        const tendersBefore = await tx.accTenderDetail.findMany({
            where: { tdSrcDocId: header.avhVoucherId, tdIsDeleted: false },
            select: { tdId: true },
        });
        const unwound = await this.unwind(tx, {
            header,
            vouchers,
            advanceBills,
            editRemark: dto.editRemark,
            actor,
        });
        await this.recompute.recomputeBills(tx, unwound.touchedBills, (0, receipt_utils_1.todayUtc)());
        await this.paymentService.saveInTransaction(tx, { ...dto, replace: true }, actor);
        const posted = await this.postingService.postInTransaction(tx, dto, actor);
        const tendersRemoved = await tx.accTenderDetail.count({
            where: { tdId: { in: tendersBefore.map((row) => row.tdId) }, tdIsDeleted: true },
        });
        const now = new Date();
        const toRevision = header.avhRevisionNo + 1;
        await tx.accVoucherHeader.update({
            where: {
                avhVoucherId_avhAccYear: {
                    avhVoucherId: header.avhVoucherId,
                    avhAccYear: header.avhAccYear,
                },
            },
            data: { avhRevisionNo: toRevision, avhModifiedOn: now, avhModifiedBy: actor },
        });
        await this.writeTrail(tx, { header, dto, actor, now, toRevision });
        const after = await this.paymentService.loadHeaderOrThrow(tx, header.avhVoucherId, header.avhAccYear);
        const tally = { ...unwound.tally, tendersRemoved };
        await this.writeAuditRows(tx, { header, after, before, dto, actor, tally, toRevision });
        return {
            ...posted,
            header: await this.paymentService.toHeaderPayload(tx, after),
            fromRevision: dto.baseRevision,
            toRevision,
            editRemark: dto.editRemark,
            unwound: tally,
        };
    }
    assertAmendPermitted(allowed) {
        if (allowed) {
            return;
        }
        (0, module_service_utils_1.throwAccountsConflict)('Payment cannot be amended', [
            {
                field: payment_enum_1.PaymentSettingKey.ALLOW_POSTED_AMEND,
                message: 'Editing a posted payment is switched off for this company ' +
                    `(${payment_enum_1.PaymentSettingKey.ALLOW_POSTED_AMEND} is false). Cancel the payment and re-enter it, ` +
                    'or switch the setting on if the person who keys a payment is also the person accountable for it.',
            },
        ]);
    }
    assertStatusMayAmend(header) {
        const status = (0, payment_service_1.statusOf)(header);
        if (status !== payment_enum_1.VoucherStatus.POSTED) {
            (0, module_service_utils_1.throwAccountsConflict)('Payment cannot be amended', [
                {
                    field: 'avhVoucherId',
                    message: `${header.avhVoucherRefno ?? header.avhVoucherId} is ${status}. Only a POSTED payment is amended` +
                        (status === payment_enum_1.VoucherStatus.DRAFT
                            ? ' — a draft is edited with /payments/create.'
                            : status === payment_enum_1.VoucherStatus.CANCELLED
                                ? ' — a cancelled payment is history, and re-entering is the way back.'
                                : '.'),
                },
            ]);
        }
        if (header.avhAgainstVoucherId) {
            (0, module_service_utils_1.throwAccountsConflict)('Payment cannot be amended', [
                {
                    field: 'avhVoucherId',
                    message: 'This is a post-dated cheque voucher, not a payment. Amend the payment it belongs to and its ' +
                        'cheques are rewritten with it.',
                },
            ]);
        }
    }
    async assertPartyUnchanged(tx, header, partyId) {
        if (header.avhPartyId === partyId) {
            return;
        }
        const names = await tx.accLedgerMaster.findMany({
            where: { ledId: { in: [header.avhPartyId, partyId] } },
            select: { ledId: true, ledName: true },
        });
        const nameOf = (id) => names.find((row) => row.ledId === id)?.ledName ?? id;
        (0, module_service_utils_1.throwAccountsConflict)('Payment cannot be amended', [
            {
                field: 'avhPartyId',
                message: `${header.avhVoucherRefno ?? header.avhVoucherId} was paid to "${nameOf(header.avhPartyId)}" and an amend ` +
                    `cannot move it to "${nameOf(partyId)}". The payment keeps its number and the supplier's advice ` +
                    'carries it — cancel this payment and enter a new one for the right party.',
            },
        ]);
    }
    assertRevisionIsCurrent(header, baseRevision) {
        if (header.avhRevisionNo === baseRevision) {
            return;
        }
        (0, module_service_utils_1.throwAccountsConflict)('Payment cannot be amended', [
            {
                field: 'baseRevision',
                message: `This payment has been amended since you opened it (now revision ${header.avhRevisionNo}, ` +
                    `you sent ${baseRevision}). Reload it and make the change again.`,
            },
        ]);
    }
    async unwind(tx, params) {
        const { header, vouchers, actor } = params;
        const now = new Date();
        const voucherIds = vouchers.map((voucher) => voucher.avhVoucherId);
        for (const voucher of vouchers) {
            await tx.accVoucherHeader.update({
                where: {
                    avhVoucherId_avhAccYear: {
                        avhVoucherId: voucher.avhVoucherId,
                        avhAccYear: voucher.avhAccYear,
                    },
                },
                data: { avhVoucherStatus: payment_enum_1.VoucherStatus.DRAFT },
            });
        }
        const adjustmentsReversed = await this.reverseAdjustments(tx, {
            header,
            voucherIds,
            years: [...new Set(vouchers.map((voucher) => voucher.avhAccYear))],
            editRemark: params.editRemark,
            actor,
        });
        if (params.advanceBills.length > 0) {
            await tx.accBillBalance.updateMany({
                where: {
                    OR: params.advanceBills.map((bill) => ({
                        ablId: bill.ablId,
                        ablAccYear: bill.ablAccYear,
                    })),
                },
                data: { ablIsDeleted: true, ablIsActive: false, ablModifiedOn: now, ablModifiedBy: actor },
            });
        }
        const chequesRemoved = await tx.accPdcRegister.updateMany({
            where: {
                ...(await (0, payment_cheque_links_1.paymentChequeFilter)(tx, { receiptVoucherId: header.avhVoucherId, voucherIds })),
                apdIsDeleted: false,
                apdStatus: payment_enum_1.PdcStatus.HELD,
            },
            data: {
                apdStatus: payment_enum_1.PdcStatus.CANCELLED,
                apdAmendedIntoRevision: header.avhRevisionNo + 1,
                apdCancelReason: `Amended into revision ${header.avhRevisionNo + 1}`,
                apdCancelDate: now,
                apdStatusOn: now,
                apdStatusBy: actor,
                apdModifiedOn: now,
                apdModifiedBy: actor,
            },
        });
        const legsRemoved = await tx.accVoucher.updateMany({
            where: { avVoucherId: { in: voucherIds }, avIsDeleted: false },
            data: { avIsDeleted: true, avModifiedOn: now, avModifiedBy: actor },
        });
        let pdcVouchersRemoved = 0;
        for (const voucher of vouchers) {
            if (voucher.avhVoucherId === header.avhVoucherId) {
                continue;
            }
            await tx.accVoucherHeader.update({
                where: {
                    avhVoucherId_avhAccYear: {
                        avhVoucherId: voucher.avhVoucherId,
                        avhAccYear: voucher.avhAccYear,
                    },
                },
                data: { avhIsDeleted: true, avhModifiedOn: now, avhModifiedBy: actor },
            });
            pdcVouchersRemoved += 1;
        }
        const tdsReversed = await this.reverseTds(tx, header, params.editRemark, actor);
        const touched = await this.billsTouchedBy(tx, voucherIds);
        return {
            tally: {
                adjustmentsReversed,
                legsRemoved: legsRemoved.count,
                pdcVouchersRemoved,
                chequesRemoved: chequesRemoved.count,
                advanceBillsRemoved: params.advanceBills.length,
                tdsReversed,
            },
            touchedBills: touched,
        };
    }
    async reverseAdjustments(tx, params) {
        const rows = await tx.accBillAdjustment.findMany({
            where: {
                abjVoucherId: { in: [...params.voucherIds] },
                abjVoucherAccYear: { in: [...params.years] },
                abjIsDeleted: false,
            },
            orderBy: { abjRowNo: 'asc' },
        });
        const alreadyReversed = new Set(rows.map((row) => row.abjReversalOfId).filter((id) => id !== null));
        const live = rows.filter((row) => row.abjReversalOfId === null && !alreadyReversed.has(row.abjId));
        if (live.length === 0) {
            return 0;
        }
        const highest = rows.reduce((max, row) => Math.max(max, row.abjRowNo), 0);
        await tx.accBillAdjustment.createMany({
            data: live.map((row, index) => ({
                abjCompanyId: row.abjCompanyId,
                abjBranchId: row.abjBranchId,
                abjTenantId: row.abjTenantId,
                abjAccYear: row.abjAccYear,
                abjBillId: row.abjBillId,
                abjBillAccYear: row.abjBillAccYear,
                abjPartyId: row.abjPartyId,
                abjRowNo: highest + index + 1,
                abjAgainstBillId: row.abjAgainstBillId,
                abjAgainstBillAccYear: row.abjAgainstBillAccYear,
                abjVoucherId: params.header.avhVoucherId,
                abjVoucherAccYear: params.header.avhAccYear,
                abjAdjType: row.abjAdjType,
                abjAdjDate: row.abjAdjDate,
                abjIsPostDated: row.abjIsPostDated,
                abjDrCr: (0, receipt_utils_1.flipSide)(row.abjDrCr, payment_enum_1.DrCr.DR, payment_enum_1.DrCr.CR),
                abjAmount: row.abjAmount.negated(),
                abjSettlementMode: row.abjSettlementMode,
                abjSettlementLedgerId: row.abjSettlementLedgerId,
                abjTenderId: row.abjTenderId,
                abjTenderAccYear: row.abjTenderAccYear,
                abjChequeId: row.abjChequeId,
                abjChequeAccYear: row.abjChequeAccYear,
                abjApprovedBy: row.abjApprovedBy,
                abjReversalOfId: row.abjId,
                abjReversalReason: `Amended: ${params.editRemark}`.slice(0, 250),
                abjUserId: row.abjUserId,
                abjSessionId: row.abjSessionId,
                abjCreatedBy: params.actor,
            })),
        });
        return live.length;
    }
    async reverseTds(tx, header, editRemark, actor) {
        const rows = await tx.$queryRaw `
      SELECT t.atd_id, t.atd_challan_no
        FROM accounts.acc_tds_register t
       WHERE t.atd_voucher_id = ${header.avhVoucherId}::uuid
         AND t.atd_voucher_acc_year = ${header.avhAccYear}::char(9)
         AND t.atd_is_deleted = false
         AND t.atd_reversal_of_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM accounts.acc_tds_register r
                          WHERE r.atd_reversal_of_id = t.atd_id AND r.atd_is_deleted = false)`;
        const deposited = rows.find((row) => row.atd_challan_no);
        if (deposited) {
            (0, module_service_utils_1.throwAccountsConflict)('Payment cannot be amended', [
                {
                    field: 'avhVoucherId',
                    message: `The TDS on ${header.avhVoucherRefno} was deposited under challan ${deposited.atd_challan_no} — ` +
                        'correct it with a 26Q revision, not an amend',
                },
            ]);
        }
        for (const row of rows) {
            await tx.$executeRaw `
        INSERT INTO accounts.acc_tds_register (
          atd_company_id, atd_branch_id, atd_tenant_id, atd_acc_year, atd_quarter, atd_direction,
          atd_party_id, atd_pan, atd_party_name, atd_deductee_type, atd_section, atd_rate,
          atd_rate_source, atd_base_amount, atd_tax_amount, atd_voucher_id, atd_voucher_acc_year,
          atd_doc_refno, atd_doc_date, atd_bill_id, atd_bill_acc_year, atd_reversal_of_id,
          atd_remarks, atd_created_by
        )
        SELECT o.atd_company_id, o.atd_branch_id, o.atd_tenant_id, o.atd_acc_year, o.atd_quarter, o.atd_direction,
               o.atd_party_id, o.atd_pan, o.atd_party_name, o.atd_deductee_type, o.atd_section, o.atd_rate,
               o.atd_rate_source, o.atd_base_amount, -o.atd_tax_amount,
               o.atd_voucher_id, o.atd_voucher_acc_year,
               o.atd_doc_refno, o.atd_doc_date, NULL, NULL, o.atd_id,
               ${`Amended: ${editRemark}`.slice(0, 250)}, ${actor}
          FROM accounts.acc_tds_register o WHERE o.atd_id = ${row.atd_id}::uuid`;
        }
        return rows.length;
    }
    async billsTouchedBy(tx, voucherIds) {
        const rows = await tx.accBillAdjustment.findMany({
            where: { abjVoucherId: { in: [...voucherIds] }, abjIsDeleted: false },
            select: { abjBillId: true, abjBillAccYear: true },
        });
        const seen = new Map();
        for (const row of rows) {
            seen.set(`${row.abjBillId}|${row.abjBillAccYear}`, {
                billId: row.abjBillId,
                accYear: row.abjBillAccYear,
            });
        }
        return [...seen.values()];
    }
    async writeTrail(tx, params) {
        const { header, dto, actor, now } = params;
        const common = {
            companyId: header.avhCompanyId,
            branchId: header.avhBranchId,
            tenantId: header.avhTenantId,
            accYear: header.avhAccYear,
            srcModule: txn_status_log_helper_1.TxnStatusSrcModule.ACCOUNTS,
            srcDocType: txn_status_log_helper_1.TxnStatusDocType.PAYMENT,
            srcDocId: header.avhVoucherId,
            srcDocRefno: header.avhVoucherRefno,
            changedBy: actor,
            changedOn: now,
            deviceId: header.avhDeviceId,
            sessionId: header.avhSessionId,
        };
        await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
            ...common,
            event: txn_status_log_helper_1.TxnStatusEvent.AMENDED,
            fromStatus: payment_enum_1.VoucherStatus.POSTED,
            toStatus: txn_status_log_helper_1.TxnStatusEvent.AMENDED,
            remarks: dto.editRemark,
        });
        await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
            ...common,
            event: txn_status_log_helper_1.TxnStatusEvent.POSTED,
            fromStatus: txn_status_log_helper_1.TxnStatusEvent.AMENDED,
            toStatus: payment_enum_1.VoucherStatus.POSTED,
            remarks: `Re-posted as revision ${params.toRevision}`,
        });
    }
    async writeAuditRows(tx, params) {
        const { header, dto, actor, tally } = params;
        const after = await this.paymentService.loadFullPayment(tx, params.after);
        const displayName = header.avhVoucherRefno ?? header.avhVoucherId;
        const notes = `Payment amended to revision ${params.toRevision}: ${dto.editRemark} ` +
            `(${tally.adjustmentsReversed} adjustment(s) reversed, ${tally.legsRemoved} leg(s), ` +
            `${tally.chequesRemoved} cheque(s), ${tally.pdcVouchersRemoved} PDC voucher(s), ` +
            `${tally.advanceBillsRemoved} advance bill(s), ${tally.tdsReversed} TDS row(s), ${tally.tendersRemoved} tender row(s) replaced)`;
        const tables = [
            { tableName: 'acc_voucher_header', original: params.before.header, modified: after.header },
            {
                tableName: 'acc_vouchers',
                original: { legs: params.before.legs, pdcVouchers: params.before.pdcVouchers },
                modified: { legs: after.legs, pdcVouchers: after.pdcVouchers },
            },
            {
                tableName: 'acc_bill_adjustment',
                original: {
                    allocations: params.before.allocations,
                    creditsApplied: params.before.creditsApplied,
                    advanceBills: params.before.advanceBills,
                },
                modified: {
                    allocations: after.allocations,
                    creditsApplied: after.creditsApplied,
                    advanceBills: after.advanceBills,
                },
            },
            {
                tableName: 'acc_pdc_register',
                original: { cheques: params.before.chequesIssued, tenders: params.before.tenders },
                modified: { cheques: after.chequesIssued, tenders: after.tenders },
            },
        ];
        for (const table of tables) {
            await this.auditLogService.logEntityChange({
                action: 'update',
                tableName: table.tableName,
                screenName: AMEND_AUDIT_SCREEN,
                screenType: 'transaction',
                pk: header.avhVoucherId,
                displayName,
                accYear: header.avhAccYear,
                originalRecord: table.original,
                modifiedRecord: table.modified,
                userId: actor,
                branchId: header.avhBranchId,
                notes,
            }, tx);
        }
    }
};
exports.PaymentAmendService = PaymentAmendService;
exports.PaymentAmendService = PaymentAmendService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        payment_service_1.PaymentService,
        payment_posting_service_1.PaymentPostingService,
        payment_open_items_service_1.PaymentOpenItemsService,
        bill_balance_recompute_service_1.BillBalanceRecomputeService,
        audit_log_service_1.AuditLogService])
], PaymentAmendService);
//# sourceMappingURL=payment-amend.service.js.map