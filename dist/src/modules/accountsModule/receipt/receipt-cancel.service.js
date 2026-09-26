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
exports.ReceiptCancelService = void 0;
const common_1 = require("@nestjs/common");
const books_reconcile_guard_1 = require("../reconcile/books-reconcile.guard");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const bill_balance_recompute_service_1 = require("../billBalance/bill-balance-recompute.service");
const voucher_totals_helper_1 = require("../accountVoucherHeader/voucher-totals.helper");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const receipt_service_1 = require("./receipt.service");
const receipt_guards_1 = require("./receipt.guards");
const receipt_unwind_guards_1 = require("./receipt-unwind.guards");
const receipt_cheque_links_1 = require("./receipt-cheque-links");
const receipt_utils_1 = require("./receipt.utils");
const receipt_enum_1 = require("./types/receipt-enum");
const CANCEL_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 120_000 };
let ReceiptCancelService = class ReceiptCancelService {
    prisma;
    requestContext;
    receiptService;
    recompute;
    constructor(prisma, requestContext, receiptService, recompute) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.receiptService = receiptService;
        this.recompute = recompute;
    }
    async cancel(dto) {
        const actor = this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `
        SELECT avh_voucher_id
          FROM accounts.acc_voucher_header
         WHERE avh_voucher_id = ${dto.avhVoucherId}::uuid
           AND avh_acc_year   = ${dto.avhAccYear}::bpchar
           FOR UPDATE`;
            const header = await this.receiptService.loadHeaderOrThrow(tx, dto.avhVoucherId, dto.avhAccYear);
            (0, receipt_guards_1.assertHeaderScope)(header, {
                companyId: dto.avhCompanyId,
                branchId: dto.avhBranchId,
                accYear: dto.avhAccYear,
                voucherId: dto.avhVoucherId,
            });
            if ((0, receipt_service_1.statusOf)(header) !== receipt_enum_1.VoucherStatus.POSTED) {
                (0, module_service_utils_1.throwAccountsConflict)('Receipt cannot be cancelled', [
                    {
                        field: 'avhVoucherId',
                        message: `${header.avhVoucherRefno ?? dto.avhVoucherId} is ${header.avhVoucherStatus}. ` +
                            'Only a POSTED receipt is cancelled; a DRAFT is simply not posted.',
                    },
                ]);
            }
            if (header.avhAgainstVoucherId) {
                (0, module_service_utils_1.throwAccountsConflict)('Receipt cannot be cancelled', [
                    {
                        field: 'avhVoucherId',
                        message: 'This is a post-dated cheque voucher, not a receipt. Cancel the receipt it belongs ' +
                            'to and both are reversed together.',
                    },
                ]);
            }
            const pdcVouchers = (await tx.accVoucherHeader.findMany({
                where: (0, receipt_cheque_links_1.receiptPdcVoucherWhere)(header),
                select: receipt_service_1.STORED_HEADER_SELECT,
            }))
                .map((row) => ({ ...row, avhPartyId: row.avhPartyId ?? header.avhPartyId }));
            const vouchers = [header, ...pdcVouchers];
            for (const voucher of vouchers) {
                await (0, receipt_guards_1.assertAccYearWritable)(tx, voucher.avhCompanyId, voucher.avhAccYear, 'avhAccYear');
            }
            const voucherIds = vouchers.map((voucher) => voucher.avhVoucherId);
            const years = [...new Set(vouchers.map((voucher) => voucher.avhAccYear))];
            await (0, receipt_unwind_guards_1.assertChequesStillHeld)(tx, { receiptVoucherId: header.avhVoucherId, voucherIds }, 'cancelled');
            const advanceBills = await (0, receipt_unwind_guards_1.assertAdvancesUntouched)(tx, voucherIds, years, 'cancelled');
            const reversals = [];
            const touchedBills = [];
            for (const voucher of vouchers) {
                const result = await this.reverseVoucher(tx, voucher, dto.reason, actor);
                reversals.push(result.summary);
                touchedBills.push(...result.bills);
            }
            const now = new Date();
            if (advanceBills.length > 0) {
                await tx.accBillBalance.updateMany({
                    where: {
                        OR: advanceBills.map((bill) => ({ ablId: bill.ablId, ablAccYear: bill.ablAccYear })),
                    },
                    data: {
                        ablIsDeleted: true,
                        ablIsActive: false,
                        ablModifiedOn: now,
                        ablModifiedBy: actor,
                    },
                });
            }
            const cancelledCheques = await this.cancelCheques(tx, { receiptVoucherId: header.avhVoucherId, voucherIds }, dto.reason, actor, now);
            await this.softDeleteTenders(tx, header.avhVoucherId, actor, now);
            const recomputed = await this.recompute.recomputeBills(tx, touchedBills, (0, receipt_utils_1.todayUtc)());
            for (const voucher of vouchers) {
                const reversal = reversals.find((row) => row.ofVoucherId === voucher.avhVoucherId);
                await tx.accVoucherHeader.update({
                    where: {
                        avhVoucherId_avhAccYear: {
                            avhVoucherId: voucher.avhVoucherId,
                            avhAccYear: voucher.avhAccYear,
                        },
                    },
                    data: {
                        avhVoucherStatus: receipt_enum_1.VoucherStatus.CANCELLED,
                        avhCancelReason: dto.reason,
                        avhReversalVoucherId: reversal.reversalVoucherId,
                        avhReversalAccYear: reversal.accYear,
                        avhStatusOn: now,
                        avhStatusBy: actor,
                        avhModifiedOn: now,
                        avhModifiedBy: actor,
                    },
                });
                await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                    companyId: voucher.avhCompanyId,
                    branchId: voucher.avhBranchId,
                    tenantId: voucher.avhTenantId,
                    accYear: voucher.avhAccYear,
                    srcModule: txn_status_log_helper_1.TxnStatusSrcModule.ACCOUNTS,
                    srcDocType: txn_status_log_helper_1.TxnStatusDocType.RECEIPT,
                    srcDocId: voucher.avhVoucherId,
                    srcDocRefno: voucher.avhVoucherRefno,
                    event: txn_status_log_helper_1.TxnStatusEvent.CANCELLED,
                    fromStatus: receipt_enum_1.VoucherStatus.POSTED,
                    toStatus: receipt_enum_1.VoucherStatus.CANCELLED,
                    changedBy: actor,
                    changedOn: now,
                    remarks: dto.reason,
                });
            }
            await (0, books_reconcile_guard_1.assertBooksReconcile)(tx, {
                companyId: header.avhCompanyId,
                accYear: header.avhAccYear,
                ledgerIds: [header.avhPartyId],
                vouchers: vouchers.map((voucher) => ({
                    voucherId: voucher.avhVoucherId,
                    accYear: voucher.avhAccYear,
                })),
            });
            return {
                avhVoucherId: header.avhVoucherId,
                avhAccYear: header.avhAccYear,
                avhVoucherRefno: header.avhVoucherRefno,
                fromStatus: receipt_enum_1.VoucherStatus.POSTED,
                toStatus: receipt_enum_1.VoucherStatus.CANCELLED,
                avhStatusOn: now.toISOString(),
                avhStatusBy: actor,
                reversals,
                billsReopened: recomputed.map((bill) => ({
                    billId: bill.billId,
                    billAccYear: bill.accYear,
                    docRefno: '',
                    pendingAmount: (0, receipt_utils_1.toAmount)(bill.pendingAmount),
                })),
                chequesCancelled: cancelledCheques,
                advanceBillsRemoved: advanceBills.map((bill) => bill.ablId),
            };
        }, CANCEL_TRANSACTION_OPTIONS);
    }
    async reverseVoucher(tx, voucher, reason, actor) {
        const now = new Date();
        const number = await this.receiptService.allocateNumber(tx, {
            companyId: voucher.avhCompanyId,
            branchId: voucher.avhBranchId,
            accYear: voucher.avhAccYear,
            voucherTypeId: voucher.avhVoucherTypeId,
            voucherDate: voucher.avhVoucherDate,
        });
        const reversal = await tx.accVoucherHeader.create({
            data: {
                avhCompanyId: voucher.avhCompanyId,
                avhBranchId: voucher.avhBranchId,
                avhTenantId: voucher.avhTenantId,
                avhAccYear: voucher.avhAccYear,
                avhVoucherTypeId: voucher.avhVoucherTypeId,
                avhVoucherNo: number.voucherNo,
                avhVoucherSlno: number.voucherSlno,
                avhVoucherRefno: number.voucherRefno,
                avhVoucherDate: voucher.avhVoucherDate,
                avhPartyId: voucher.avhPartyId,
                avhEmployeeId: voucher.avhEmployeeId,
                avhDocAmount: voucher.avhDocAmount,
                avhAdjustAmount: voucher.avhAdjustAmount,
                avhRemarks: `Reversal of ${voucher.avhVoucherRefno}: ${reason}`,
                avhAgainstVoucherId: voucher.avhVoucherId,
                avhAgainstAccYear: voucher.avhAccYear,
                avhDeviceType: voucher.avhDeviceType,
                avhDeviceId: voucher.avhDeviceId,
                avhSessionId: voucher.avhSessionId,
                avhUserId: voucher.avhUserId,
                avhVoucherStatus: receipt_enum_1.VoucherStatus.DRAFT,
                avhCreatedBy: actor,
            },
            select: { avhVoucherId: true },
        });
        const legs = await tx.accVoucher.findMany({
            where: {
                avVoucherId: voucher.avhVoucherId,
                avAccYear: voucher.avhAccYear,
                avIsDeleted: false,
            },
            orderBy: { avRowNo: 'asc' },
        });
        if (legs.length > 0) {
            await tx.accVoucher.createMany({
                data: legs.map((leg, index) => ({
                    avVoucherId: reversal.avhVoucherId,
                    avCompanyId: leg.avCompanyId,
                    avBranchId: leg.avBranchId,
                    avTenantId: leg.avTenantId,
                    avAccYear: voucher.avhAccYear,
                    avVoucherTypeId: leg.avVoucherTypeId,
                    avVoucherNo: number.voucherNo,
                    avRowNo: index + 1,
                    avVoucherDate: leg.avVoucherDate,
                    avVoucherRefno: number.voucherRefno,
                    avDrCr: (0, receipt_utils_1.flipSide)(leg.avDrCr, receipt_enum_1.DrCr.DR, receipt_enum_1.DrCr.CR),
                    avLedgerId: leg.avLedgerId,
                    avOppLedgerId: leg.avOppLedgerId,
                    avAmount: leg.avAmount,
                    avRole: leg.avRole,
                    avRemarks: `Reversal of ${voucher.avhVoucherRefno}`,
                    avSessionId: leg.avSessionId,
                    avUserId: leg.avUserId,
                    avCreatedBy: actor,
                })),
            });
        }
        const forward = await tx.accBillAdjustment.findMany({
            where: {
                abjVoucherId: voucher.avhVoucherId,
                abjVoucherAccYear: voucher.avhAccYear,
                abjIsDeleted: false,
                abjReversalOfId: null,
            },
        });
        const reversed = await tx.accBillAdjustment.findMany({
            where: {
                abjReversalOfId: { in: forward.map((row) => row.abjId) },
                abjIsDeleted: false,
            },
            select: { abjReversalOfId: true },
        });
        const alreadyReversed = new Set(reversed.map((row) => row.abjReversalOfId).filter((id) => id !== null));
        const adjustments = forward.filter((row) => !alreadyReversed.has(row.abjId));
        if (adjustments.length > 0) {
            await tx.accBillAdjustment.createMany({
                data: adjustments.map((row, index) => ({
                    abjCompanyId: row.abjCompanyId,
                    abjBranchId: row.abjBranchId,
                    abjTenantId: row.abjTenantId,
                    abjAccYear: row.abjAccYear,
                    abjBillId: row.abjBillId,
                    abjBillAccYear: row.abjBillAccYear,
                    abjPartyId: row.abjPartyId,
                    abjRowNo: index + 1,
                    abjAgainstBillId: row.abjAgainstBillId,
                    abjAgainstBillAccYear: row.abjAgainstBillAccYear,
                    abjVoucherId: reversal.avhVoucherId,
                    abjVoucherAccYear: voucher.avhAccYear,
                    abjAdjType: row.abjAdjType,
                    abjAdjDate: row.abjAdjDate,
                    abjIsPostDated: row.abjIsPostDated,
                    abjDrCr: (0, receipt_utils_1.flipSide)(row.abjDrCr, receipt_enum_1.DrCr.DR, receipt_enum_1.DrCr.CR),
                    abjAmount: row.abjAmount.negated(),
                    abjSettlementMode: row.abjSettlementMode,
                    abjSettlementLedgerId: row.abjSettlementLedgerId,
                    abjTenderId: row.abjTenderId,
                    abjTenderAccYear: row.abjTenderAccYear,
                    abjChequeId: row.abjChequeId,
                    abjChequeAccYear: row.abjChequeAccYear,
                    abjApprovedBy: row.abjApprovedBy,
                    abjReversalOfId: row.abjId,
                    abjReversalReason: reason.slice(0, 250),
                    abjUserId: row.abjUserId,
                    abjSessionId: row.abjSessionId,
                    abjCreatedBy: actor,
                })),
            });
        }
        const totals = await (0, voucher_totals_helper_1.deriveVoucherTotals)(tx, reversal.avhVoucherId, voucher.avhAccYear);
        if (!totals.difference.isZero()) {
            (0, module_service_utils_1.throwAccountsBadRequest)('The reversal does not balance', [
                {
                    field: 'avhVoucherId',
                    message: `The reversal of ${voucher.avhVoucherRefno} is out by ${totals.difference.toFixed(2)}. ` +
                        'The original voucher is unbalanced; nothing has been changed.',
                },
            ]);
        }
        await tx.accVoucherHeader.update({
            where: {
                avhVoucherId_avhAccYear: {
                    avhVoucherId: reversal.avhVoucherId,
                    avhAccYear: voucher.avhAccYear,
                },
            },
            data: {
                avhVoucherStatus: receipt_enum_1.VoucherStatus.POSTED,
                avhStatusOn: now,
                avhStatusBy: actor,
                avhPostedOn: now,
            },
        });
        return {
            summary: {
                ofVoucherId: voucher.avhVoucherId,
                reversalVoucherId: reversal.avhVoucherId,
                accYear: voucher.avhAccYear,
                voucherRefno: number.voucherRefno,
                legCount: legs.length,
                adjustmentCount: adjustments.length,
            },
            bills: forward.map((row) => ({
                billId: row.abjBillId,
                accYear: row.abjBillAccYear,
            })),
        };
    }
    async cancelCheques(tx, scope, reason, actor, now) {
        const cheques = await tx.accPdcRegister.findMany({
            where: {
                ...(await (0, receipt_cheque_links_1.receiptChequeFilter)(tx, scope)),
                apdIsDeleted: false,
                apdStatus: receipt_enum_1.PdcStatus.HELD,
            },
            select: { apdId: true, apdAccYear: true },
        });
        for (const cheque of cheques) {
            await tx.accPdcRegister.update({
                where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
                data: {
                    apdStatus: receipt_enum_1.PdcStatus.CANCELLED,
                    apdCancelReason: reason.slice(0, 250),
                    apdCancelDate: now,
                    apdStatusOn: now,
                    apdStatusBy: actor,
                    apdModifiedOn: now,
                    apdModifiedBy: actor,
                },
            });
        }
        return cheques.map((cheque) => cheque.apdId);
    }
    async softDeleteTenders(tx, voucherId, actor, now) {
        await tx.accTenderDetail.updateMany({
            where: { tdSrcDocId: voucherId, tdIsDeleted: false },
            data: { tdIsDeleted: true, tdModifiedOn: now, tdModifiedBy: actor },
        });
    }
};
exports.ReceiptCancelService = ReceiptCancelService;
exports.ReceiptCancelService = ReceiptCancelService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        receipt_service_1.ReceiptService,
        bill_balance_recompute_service_1.BillBalanceRecomputeService])
], ReceiptCancelService);
//# sourceMappingURL=receipt-cancel.service.js.map