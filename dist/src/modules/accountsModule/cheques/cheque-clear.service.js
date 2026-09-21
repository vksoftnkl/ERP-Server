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
exports.ChequeClearService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const bill_balance_recompute_service_1 = require("../billBalance/bill-balance-recompute.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const receipt_enum_1 = require("../receipt/types/receipt-enum");
const receipt_guards_1 = require("../receipt/receipt.guards");
const receipt_utils_1 = require("../receipt/receipt.utils");
const cheques_guards_1 = require("./cheques.guards");
const cheques_utils_1 = require("./cheques.utils");
const cheque_voucher_helper_1 = require("./cheque-voucher.helper");
const cheque_allocation_1 = require("./cheque-allocation");
const cheque_enum_1 = require("./types/cheque-enum");
const CLEAR_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 60_000 };
let ChequeClearService = class ChequeClearService {
    prisma;
    requestContext;
    recompute;
    constructor(prisma, requestContext, recompute) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.recompute = recompute;
    }
    async clear(dto) {
        const actor = this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const clearDate = (0, receipt_utils_1.toDateOnly)(dto.clearDate);
        const bankDate = dto.bankDate ? (0, receipt_utils_1.toDateOnly)(dto.bankDate) : clearDate;
        return this.prisma.$transaction(async (tx) => {
            const cheque = await (0, cheques_guards_1.lockChequeOrThrow)(tx, dto);
            (0, cheques_guards_1.assertStatus)(cheque, cheque_enum_1.CLEARABLE_STATUSES, 'cleared');
            (0, cheques_guards_1.assertNotInFuture)(clearDate, 'A clearing', 'clearDate');
            (0, cheques_guards_1.assertDateOnOrAfter)(clearDate, cheque.apdDepositDate, `Clear ${cheque.apdInstrumentNo}`, 'the day it was deposited', 'clearDate');
            if (!cheque.apdBankLedgerId) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Cheque has no deposit bank', [
                    {
                        field: 'apdId',
                        message: `${cheque.apdInstrumentNo} is DEPOSITED but names no bank ledger, so there is ` +
                            'nowhere to credit the money. Re-deposit it to record which bank took it.',
                    },
                ]);
            }
            const bank = await (0, cheques_guards_1.loadBankLedger)(tx, cheque.apdCompanyId, cheque.apdBankLedgerId, 'apdId');
            const voucherAccYear = (0, receipt_guards_1.accYearOf)(clearDate);
            const payload = cheque.apdPostingMode === receipt_enum_1.PdcPostingMode.ON_CLEARING
                ? await this.clearOnClearing(tx, { cheque, dto, clearDate, voucherAccYear, bank, actor })
                : await this.clearOnReceipt(tx, {
                    cheque,
                    dto,
                    clearDate,
                    bankDate,
                    voucherAccYear,
                    bank,
                    actor,
                });
            const now = new Date();
            await tx.accPdcRegister.update({
                where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
                data: {
                    apdStatus: receipt_enum_1.PdcStatus.CLEARED,
                    apdClearDate: clearDate,
                    apdClearVoucherId: payload.voucher.voucherId,
                    apdClearAccYear: payload.voucher.accYear,
                    apdRemarks: dto.remarks ?? cheque.apdRemarks,
                    apdStatusOn: now,
                    apdStatusBy: actor,
                    apdModifiedOn: now,
                    apdModifiedBy: actor,
                },
            });
            await (0, cheques_utils_1.logChequeStatus)(tx, cheque, {
                fromStatus: cheque.apdStatus,
                toStatus: receipt_enum_1.PdcStatus.CLEARED,
                remarks: `Cleared into ${bank.ledgerName} — ${payload.voucher.voucherRefno ?? ''}` +
                    (dto.remarks ? ` — ${dto.remarks}` : ''),
                actor,
                changedOn: now,
            });
            return {
                ...payload,
                cheque: await (0, cheques_utils_1.reloadChequeRow)(tx, cheque.apdId, cheque.apdAccYear),
            };
        }, CLEAR_TRANSACTION_OPTIONS);
    }
    async clearOnReceipt(tx, params) {
        const { cheque, bank } = params;
        if (params.dto.allocations.length > 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'allocations',
                    message: `${cheque.apdInstrumentNo} was posted ON_RECEIPT, so its bills were already settled ` +
                        'by the receipt. A clearing under this mode allocates nothing.',
                },
            ]);
        }
        const inHand = await (0, cheques_guards_1.resolveChequesInHand)(tx, cheque);
        const written = await (0, cheque_voucher_helper_1.writeChequeVoucher)(tx, {
            typeCode: cheque_enum_1.CLEARING_VOUCHER_TYPE_CODE,
            field: 'apdId',
            companyId: cheque.apdCompanyId,
            branchId: cheque.apdBranchId,
            tenantId: cheque.apdTenantId,
            accYear: params.voucherAccYear,
            voucherDate: params.clearDate,
            partyId: cheque.apdPartyId,
            employeeId: cheque.apdSalesmanId ? [cheque.apdSalesmanId] : [],
            docAmount: cheque.apdAmount,
            remarks: `Cheque ${cheque.apdInstrumentNo} cleared into ${bank.ledgerName}` +
                (params.dto.remarks ? ` — ${params.dto.remarks}` : ''),
            srcDocId: cheque.apdId,
            duplicateMessage: `${cheque.apdInstrumentNo} has already been cleared. ` +
                'A cheque clears once; if the bank reversed it, record a bounce.',
            userId: params.actor,
            actor: params.actor,
            legs: [
                {
                    drCr: receipt_enum_1.DrCr.DR,
                    ledgerId: bank.ledgerId,
                    amount: cheque.apdAmount,
                    remarks: `Cheque ${cheque.apdInstrumentNo}`,
                    reconDate: params.bankDate,
                },
                {
                    drCr: receipt_enum_1.DrCr.CR,
                    ledgerId: inHand.ledgerId,
                    amount: cheque.apdAmount,
                    remarks: `Cheque ${cheque.apdInstrumentNo} cleared`,
                },
            ],
        });
        return { voucher: written.ref, legs: written.legs, billsSettled: [] };
    }
    async clearOnClearing(tx, params) {
        const { cheque, bank } = params;
        const written = await (0, cheque_voucher_helper_1.writeChequeVoucher)(tx, {
            typeCode: cheque_enum_1.RECEIPT_VOUCHER_TYPE_CODE,
            field: 'apdId',
            companyId: cheque.apdCompanyId,
            branchId: cheque.apdBranchId,
            tenantId: cheque.apdTenantId,
            accYear: params.voucherAccYear,
            voucherDate: params.clearDate,
            partyId: cheque.apdPartyId,
            employeeId: cheque.apdSalesmanId ? [cheque.apdSalesmanId] : [],
            docAmount: cheque.apdAmount,
            remarks: `Cheque ${cheque.apdInstrumentNo} cleared into ${bank.ledgerName} (ON_CLEARING)` +
                (params.dto.remarks ? ` — ${params.dto.remarks}` : ''),
            srcDocId: cheque.apdId,
            duplicateMessage: `${cheque.apdInstrumentNo} has already been cleared. ` +
                'A cheque clears once; if the bank reversed it, record a bounce.',
            userId: params.actor,
            actor: params.actor,
            legs: [
                {
                    drCr: receipt_enum_1.DrCr.DR,
                    ledgerId: bank.ledgerId,
                    amount: cheque.apdAmount,
                    remarks: `Cheque ${cheque.apdInstrumentNo}`,
                    reconDate: params.clearDate,
                },
                {
                    drCr: receipt_enum_1.DrCr.CR,
                    ledgerId: cheque.apdPartyId,
                    amount: cheque.apdAmount,
                    remarks: `Cheque ${cheque.apdInstrumentNo} cleared`,
                },
            ],
        });
        const outcome = await (0, cheque_allocation_1.allocateChequeMoney)(tx, {
            voucherId: written.ref.voucherId,
            accYear: params.voucherAccYear,
            voucherTypeId: written.voucherTypeId,
            voucherNo: written.voucherNo,
            voucherRefno: written.ref.voucherRefno,
            companyId: cheque.apdCompanyId,
            branchId: cheque.apdBranchId,
            tenantId: cheque.apdTenantId,
            partyId: cheque.apdPartyId,
            salesmanId: cheque.apdSalesmanId,
            userId: params.actor,
            sessionId: null,
            actor: params.actor,
            adjDate: params.clearDate,
            isPostDated: false,
            cheque,
            tenderId: cheque.apdTenderId,
            tenderAccYear: cheque.apdTenderId ? cheque.apdAccYear : null,
        }, (0, cheque_allocation_1.namedOrAutoFifo)(params.dto.allocations));
        const recomputed = await this.recompute.recomputeBills(tx, outcome.bills, (0, receipt_utils_1.todayUtc)());
        const pendingByBill = new Map(recomputed.map((bill) => [`${bill.billId}|${bill.accYear}`, bill]));
        await tx.accPdcRegister.update({
            where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
            data: {
                apdVoucherId: written.ref.voucherId,
                apdVoucherAccYear: params.voucherAccYear,
            },
        });
        return {
            voucher: written.ref,
            legs: written.legs,
            billsSettled: outcome.refs.map((ref) => {
                const bill = pendingByBill.get(`${ref.billId}|${ref.billAccYear}`);
                return {
                    ...ref,
                    billAmount: bill ? (0, receipt_utils_1.toAmount)(bill.billAmount) : 0,
                    pendingAmount: bill ? (0, receipt_utils_1.toAmount)(bill.pendingAmount) : 0,
                };
            }),
        };
    }
};
exports.ChequeClearService = ChequeClearService;
exports.ChequeClearService = ChequeClearService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        bill_balance_recompute_service_1.BillBalanceRecomputeService])
], ChequeClearService);
//# sourceMappingURL=cheque-clear.service.js.map