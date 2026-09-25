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
exports.ChequeReissueService = void 0;
const common_1 = require("@nestjs/common");
const books_reconcile_guard_1 = require("../reconcile/books-reconcile.guard");
const client_1 = require("@prisma/client");
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
const cheque_reversal_helper_1 = require("./cheque-reversal.helper");
const cheque_return_service_1 = require("./cheque-return.service");
const sale_bill_cheque_helper_1 = require("./sale-bill-cheque.helper");
const cheque_enum_1 = require("./types/cheque-enum");
const REISSUE_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 120_000 };
let ChequeReissueService = class ChequeReissueService {
    prisma;
    requestContext;
    recompute;
    returnService;
    constructor(prisma, requestContext, recompute, returnService) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.recompute = recompute;
        this.returnService = returnService;
    }
    async represent(dto) {
        const actor = this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const depositDate = (0, receipt_utils_1.toDateOnly)(dto.depositDate);
        return this.prisma.$transaction(async (tx) => {
            const cheque = await (0, cheques_guards_1.lockChequeOrThrow)(tx, dto);
            (0, cheques_guards_1.assertStatus)(cheque, cheque_enum_1.REPRESENTABLE_STATUSES, 're-presented');
            (0, cheques_guards_1.assertNotInFuture)(depositDate, 'A deposit', 'depositDate');
            (0, cheques_guards_1.assertDateOnOrAfter)(depositDate, cheque.apdInstrumentDate, `Deposit ${cheque.apdInstrumentNo}`, 'the date on the cheque', 'depositDate');
            (0, cheques_guards_1.assertDateOnOrAfter)(depositDate, cheque.apdBounceDate, `Re-present ${cheque.apdInstrumentNo}`, 'the day it bounced', 'depositDate');
            const bank = await (0, cheques_guards_1.loadBankLedger)(tx, cheque.apdCompanyId, dto.bankLedgerId);
            const reissue = await this.reissue(tx, {
                cheque,
                amount: cheque.apdAmount,
                instrumentNo: cheque.apdInstrumentNo,
                instrumentDate: cheque.apdInstrumentDate,
                voucherDate: depositDate,
                againstVoucherId: cheque.apdBounceVoucherId,
                againstAccYear: cheque.apdBounceAccYear,
                allocations: dto.allocations,
                restoreReversedBy: {
                    voucherId: cheque.apdBounceVoucherId,
                    accYear: cheque.apdBounceAccYear,
                },
                registerRow: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear },
                actor,
                what: 're-presented',
            });
            const now = new Date();
            await tx.accPdcRegister.update({
                where: { apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear } },
                data: {
                    apdStatus: receipt_enum_1.PdcStatus.DEPOSITED,
                    apdDepositDate: depositDate,
                    apdDepositSlipNo: dto.slipNo,
                    apdBankLedgerId: bank.ledgerId,
                    apdPresentCount: { increment: 1 },
                    apdRemarks: dto.remarks ?? cheque.apdRemarks,
                    apdStatusOn: now,
                    apdStatusBy: actor,
                    apdModifiedOn: now,
                    apdModifiedBy: actor,
                    apdBounceDate: null,
                },
            });
            await (0, cheques_utils_1.logChequeStatus)(tx, cheque, {
                fromStatus: cheque.apdStatus,
                toStatus: receipt_enum_1.PdcStatus.DEPOSITED,
                remarks: `Re-presented into ${bank.ledgerName} on slip ${dto.slipNo} ` +
                    `(presentation ${cheque.apdPresentCount + 1})`,
                actor,
                changedOn: now,
            });
            await (0, books_reconcile_guard_1.assertBooksReconcile)(tx, {
                companyId: cheque.apdCompanyId,
                accYear: reissue.voucher?.accYear ?? (0, receipt_guards_1.accYearOf)(depositDate),
                ledgerIds: [cheque.apdPartyId],
                cheques: [{ apdId: cheque.apdId, apdAccYear: cheque.apdAccYear }],
                vouchers: reissue.voucher ? [reissue.voucher] : [],
            });
            return {
                cheque: await (0, cheques_utils_1.reloadChequeRow)(tx, cheque.apdId, cheque.apdAccYear),
                reissueVoucher: reissue.voucher,
                legs: reissue.legs,
                billsAllocated: reissue.bills,
                slip: {
                    bankLedgerId: bank.ledgerId,
                    bankLedgerName: bank.ledgerName,
                    depositDate: (0, receipt_utils_1.toDateString)(depositDate) ?? dto.depositDate,
                    slipNo: dto.slipNo,
                    chequeCount: 1,
                    totalAmount: (0, receipt_utils_1.toAmount)(cheque.apdAmount),
                },
            };
        }, REISSUE_TRANSACTION_OPTIONS);
    }
    async replace(dto) {
        const actor = this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const instrumentDate = (0, receipt_utils_1.toDateOnly)(dto.newCheque.instrumentDate);
        const amount = (0, receipt_utils_1.money)(dto.newCheque.amount);
        const today = (0, receipt_utils_1.todayUtc)();
        return this.prisma.$transaction(async (tx) => {
            const old = await (0, cheques_guards_1.lockChequeOrThrow)(tx, dto);
            (0, cheques_guards_1.assertStatus)(old, cheque_enum_1.REPLACEABLE_STATUSES, 'replaced');
            if (amount.lessThanOrEqualTo(0)) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    { field: 'newCheque.amount', message: 'A cheque has to be for more than nothing' },
                ]);
            }
            this.assertInstrumentDateUsable(instrumentDate, today);
            const reason = dto.reason?.trim() ||
                `Replaced by cheque ${dto.newCheque.instrumentNo} dated ${dto.newCheque.instrumentDate}`;
            const reversal = old.apdStatus === receipt_enum_1.PdcStatus.HELD
                ? await this.returnService.unwind(tx, old, { reason, actor, asOf: today })
                : null;
            const now = new Date();
            const newAccYear = (0, receipt_guards_1.accYearOf)(today);
            const isPostDated = instrumentDate.getTime() > today.getTime();
            let created;
            let newCheque;
            const reissue = await this.reissue(tx, {
                cheque: { ...old, apdAmount: amount, apdInstrumentNo: dto.newCheque.instrumentNo },
                amount,
                instrumentNo: dto.newCheque.instrumentNo,
                instrumentDate,
                voucherDate: isPostDated ? instrumentDate : today,
                againstVoucherId: old.apdBounceVoucherId ?? old.apdVoucherId,
                againstAccYear: old.apdBounceAccYear ?? old.apdVoucherAccYear,
                allocations: dto.allocations,
                actor,
                what: 'replaced',
                inHandFrom: old,
                isPostDated,
                onVoucherWritten: async (voucher) => {
                    created = await tx.accPdcRegister.create({
                        data: {
                            apdCompanyId: old.apdCompanyId,
                            apdBranchId: old.apdBranchId,
                            apdTenantId: old.apdTenantId,
                            apdAccYear: newAccYear,
                            apdTraType: receipt_enum_1.PdcTraType.RECEIVED,
                            apdPartyId: old.apdPartyId,
                            apdSalesmanId: old.apdSalesmanId,
                            apdInstrumentType: receipt_enum_1.PdcInstrumentType.CHEQUE,
                            apdInstrumentNo: dto.newCheque.instrumentNo,
                            apdInstrumentDate: instrumentDate,
                            apdAmount: amount,
                            apdBankName: dto.newCheque.bankName ?? old.apdBankName,
                            apdBankBranch: dto.newCheque.bankBranch ?? old.apdBankBranch,
                            apdIfsc: dto.newCheque.ifsc ?? old.apdIfsc,
                            apdMicr: dto.newCheque.micr ?? old.apdMicr,
                            apdDrawerName: dto.newCheque.drawerName ?? old.apdDrawerName,
                            apdReceivedOn: today,
                            apdBankLedgerId: old.apdBankLedgerId,
                            apdPostingMode: old.apdPostingMode,
                            apdVoucherId: voucher.voucherId,
                            apdVoucherAccYear: voucher.accYear,
                            apdTenderId: null,
                            apdStatus: receipt_enum_1.PdcStatus.HELD,
                            apdPresentCount: 0,
                            apdStatusOn: now,
                            apdStatusBy: actor,
                            apdRemarks: `Replaces cheque ${old.apdInstrumentNo}`,
                            apdCreatedBy: actor,
                        },
                        select: { apdId: true, apdAccYear: true },
                    });
                    newCheque = await this.reloadLocked(tx, created.apdId, created.apdAccYear);
                    return { cheque: newCheque, registerRow: created };
                },
            });
            if (!reissue.voucher) {
                created = await tx.accPdcRegister.create({
                    data: {
                        apdCompanyId: old.apdCompanyId,
                        apdBranchId: old.apdBranchId,
                        apdTenantId: old.apdTenantId,
                        apdAccYear: newAccYear,
                        apdTraType: receipt_enum_1.PdcTraType.RECEIVED,
                        apdPartyId: old.apdPartyId,
                        apdSalesmanId: old.apdSalesmanId,
                        apdInstrumentType: receipt_enum_1.PdcInstrumentType.CHEQUE,
                        apdInstrumentNo: dto.newCheque.instrumentNo,
                        apdInstrumentDate: instrumentDate,
                        apdAmount: amount,
                        apdBankName: dto.newCheque.bankName ?? old.apdBankName,
                        apdBankBranch: dto.newCheque.bankBranch ?? old.apdBankBranch,
                        apdIfsc: dto.newCheque.ifsc ?? old.apdIfsc,
                        apdMicr: dto.newCheque.micr ?? old.apdMicr,
                        apdDrawerName: dto.newCheque.drawerName ?? old.apdDrawerName,
                        apdReceivedOn: today,
                        apdBankLedgerId: old.apdBankLedgerId,
                        apdPostingMode: old.apdPostingMode,
                        apdTenderId: null,
                        apdStatus: receipt_enum_1.PdcStatus.HELD,
                        apdPresentCount: 0,
                        apdStatusOn: now,
                        apdStatusBy: actor,
                        apdRemarks: `Replaces cheque ${old.apdInstrumentNo}`,
                        apdCreatedBy: actor,
                    },
                    select: { apdId: true, apdAccYear: true },
                });
                newCheque = await this.reloadLocked(tx, created.apdId, created.apdAccYear);
            }
            await tx.accPdcRegister.update({
                where: { apdId_apdAccYear: { apdId: old.apdId, apdAccYear: old.apdAccYear } },
                data: {
                    apdStatus: receipt_enum_1.PdcStatus.REPLACED,
                    apdReplacedById: created.apdId,
                    apdReplacedByAccYear: created.apdAccYear,
                    apdCancelReason: reason.slice(0, 250),
                    apdStatusOn: now,
                    apdStatusBy: actor,
                    apdModifiedOn: now,
                    apdModifiedBy: actor,
                },
            });
            await (0, cheques_utils_1.logChequeStatus)(tx, old, {
                fromStatus: old.apdStatus,
                toStatus: receipt_enum_1.PdcStatus.REPLACED,
                remarks: reason,
                actor,
                changedOn: now,
            });
            await (0, cheques_utils_1.logChequeStatus)(tx, newCheque, {
                fromStatus: null,
                toStatus: receipt_enum_1.PdcStatus.HELD,
                remarks: `Replaces cheque ${old.apdInstrumentNo} — ${reason}`,
                actor,
                changedOn: now,
            });
            await (0, books_reconcile_guard_1.assertBooksReconcile)(tx, {
                companyId: old.apdCompanyId,
                accYear: newAccYear,
                ledgerIds: [old.apdPartyId],
                cheques: [
                    { apdId: old.apdId, apdAccYear: old.apdAccYear },
                    { apdId: created.apdId, apdAccYear: created.apdAccYear },
                ],
                vouchers: [reversal?.voucher, reissue.voucher],
            });
            return {
                oldCheque: await (0, cheques_utils_1.reloadChequeRow)(tx, old.apdId, old.apdAccYear),
                newCheque: await (0, cheques_utils_1.reloadChequeRow)(tx, created.apdId, created.apdAccYear),
                reversalVoucher: reversal?.voucher ?? null,
                reissueVoucher: reissue.voucher,
                legs: [...(reversal?.legs ?? []), ...reissue.legs],
                billsAllocated: reissue.bills,
                cascade: reversal?.cascade ?? {
                    advanceBillsRemoved: [],
                    advanceApplicationsReversed: 0,
                    advancesLeftMixed: [],
                },
            };
        }, REISSUE_TRANSACTION_OPTIONS);
    }
    async reissue(tx, params) {
        const { cheque } = params;
        if (cheque.apdPostingMode === receipt_enum_1.PdcPostingMode.ON_CLEARING) {
            if (params.allocations.length > 0) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: 'allocations',
                        message: `${params.instrumentNo} is an ON_CLEARING cheque, so its bills are settled when it ` +
                            'clears and not before. Allocate on /cheques/clear.',
                    },
                ]);
            }
            return { voucher: null, legs: [], bills: [] };
        }
        const inHand = await (0, cheques_guards_1.resolveChequesInHand)(tx, params.inHandFrom ?? cheque);
        const voucherAccYear = (0, receipt_guards_1.accYearOf)(params.voucherDate);
        const legs = [
            {
                drCr: receipt_enum_1.DrCr.DR,
                ledgerId: inHand.ledgerId,
                amount: params.amount,
                remarks: `Cheque ${params.instrumentNo} ${params.what}`,
            },
            {
                drCr: receipt_enum_1.DrCr.CR,
                ledgerId: cheque.apdPartyId,
                amount: params.amount,
                remarks: `Cheque ${params.instrumentNo} ${params.what}`,
            },
        ];
        const written = await (0, cheque_voucher_helper_1.writeChequeVoucher)(tx, {
            typeCode: cheque_enum_1.RECEIPT_VOUCHER_TYPE_CODE,
            field: 'apdId',
            companyId: cheque.apdCompanyId,
            branchId: cheque.apdBranchId,
            tenantId: cheque.apdTenantId,
            accYear: voucherAccYear,
            voucherDate: params.voucherDate,
            partyId: cheque.apdPartyId,
            employeeId: cheque.apdSalesmanId ? [cheque.apdSalesmanId] : [],
            docAmount: params.amount,
            remarks: `Cheque ${params.instrumentNo} ${params.what}`,
            againstVoucherId: params.againstVoucherId,
            againstAccYear: params.againstAccYear,
            userId: params.actor,
            actor: params.actor,
            legs,
        });
        const saleBill = params.restoreReversedBy && params.allocations.length === 0 && !params.onVoucherWritten
            ? await (0, sale_bill_cheque_helper_1.findSaleBillOfCheque)(tx, cheque)
            : null;
        if (saleBill && !saleBill.hasCounterRow) {
            await tx.accPdcRegister.update({
                where: {
                    apdId_apdAccYear: {
                        apdId: params.registerRow.apdId,
                        apdAccYear: params.registerRow.apdAccYear,
                    },
                },
                data: { apdVoucherId: written.ref.voucherId, apdVoucherAccYear: voucherAccYear },
            });
            const bill = await (0, sale_bill_cheque_helper_1.moveSaleBillSettlement)(tx, saleBill, params.amount, params.voucherDate, params.actor);
            return {
                voucher: await (0, cheque_voucher_helper_1.loadVoucherRef)(tx, written.ref.voucherId, voucherAccYear),
                legs: written.legs,
                bills: [bill],
            };
        }
        const request = await this.allocationRequest(tx, params);
        const placed = params.onVoucherWritten
            ? await params.onVoucherWritten({
                voucherId: written.ref.voucherId,
                accYear: voucherAccYear,
            })
            : { cheque, registerRow: params.registerRow };
        const outcome = await (0, cheque_allocation_1.allocateChequeMoney)(tx, {
            voucherId: written.ref.voucherId,
            accYear: voucherAccYear,
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
            adjDate: params.voucherDate,
            isPostDated: params.isPostDated ?? false,
            cheque: { ...placed.cheque, apdAmount: params.amount },
            tenderId: cheque.apdTenderId,
            tenderAccYear: cheque.apdTenderId ? cheque.apdAccYear : null,
        }, request);
        if (!params.onVoucherWritten) {
            await tx.accPdcRegister.update({
                where: {
                    apdId_apdAccYear: {
                        apdId: placed.registerRow.apdId,
                        apdAccYear: placed.registerRow.apdAccYear,
                    },
                },
                data: { apdVoucherId: written.ref.voucherId, apdVoucherAccYear: voucherAccYear },
            });
        }
        const recomputed = await this.recompute.recomputeBills(tx, outcome.bills, (0, receipt_utils_1.todayUtc)());
        if (saleBill?.hasCounterRow) {
            const back = outcome.refs.find((ref) => ref.billId === saleBill.ablId && ref.billAccYear === saleBill.ablAccYear);
            if (back && back.settledByThisCheque > 0) {
                await (0, sale_bill_cheque_helper_1.moveSaleBillHeader)(tx, saleBill, new client_1.Prisma.Decimal(back.settledByThisCheque));
            }
        }
        const pendingByBill = new Map(recomputed.map((bill) => [`${bill.billId}|${bill.accYear}`, bill]));
        return {
            voucher: await (0, cheque_voucher_helper_1.loadVoucherRef)(tx, written.ref.voucherId, voucherAccYear),
            legs: written.legs,
            bills: outcome.refs.map((ref) => {
                const bill = pendingByBill.get(`${ref.billId}|${ref.billAccYear}`);
                return {
                    ...ref,
                    billAmount: bill ? (0, receipt_utils_1.toAmount)(bill.billAmount) : 0,
                    pendingAmount: bill ? (0, receipt_utils_1.toAmount)(bill.pendingAmount) : 0,
                };
            }),
        };
    }
    async allocationRequest(tx, params) {
        if (params.allocations.length > 0) {
            return { mode: 'NAMED', rows: params.allocations };
        }
        const bounce = params.restoreReversedBy;
        if (!bounce?.voucherId || !bounce.accYear) {
            return (0, cheque_allocation_1.namedOrAutoFifo)(params.allocations);
        }
        return {
            mode: 'RESTORE',
            rows: await (0, cheque_reversal_helper_1.allocationsReversedBy)(tx, params.cheque, {
                voucherId: bounce.voucherId,
                accYear: bounce.accYear,
            }),
        };
    }
    assertInstrumentDateUsable(instrumentDate, today) {
        const daysBack = (0, receipt_utils_1.daysBetween)(instrumentDate, today);
        if (daysBack > 92) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'newCheque.instrumentDate',
                    message: `${(0, receipt_utils_1.toDateString)(instrumentDate)} is more than three months old, so the bank would ` +
                        'refuse it as stale. Ask for a cheque dated within the last three months.',
                },
            ]);
        }
        if (daysBack < -366) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'newCheque.instrumentDate',
                    message: `${(0, receipt_utils_1.toDateString)(instrumentDate)} is more than a year away. Check the year on the ` +
                        'cheque.',
                },
            ]);
        }
    }
    async reloadLocked(tx, apdId, apdAccYear) {
        const row = await tx.accPdcRegister.findUniqueOrThrow({
            where: { apdId_apdAccYear: { apdId, apdAccYear } },
        });
        return {
            ...row,
            apdAmount: new client_1.Prisma.Decimal(row.apdAmount),
            apdBounceCharges: new client_1.Prisma.Decimal(row.apdBounceCharges),
            apdPostingMode: row.apdPostingMode,
            apdStatus: row.apdStatus,
        };
    }
};
exports.ChequeReissueService = ChequeReissueService;
exports.ChequeReissueService = ChequeReissueService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        bill_balance_recompute_service_1.BillBalanceRecomputeService,
        cheque_return_service_1.ChequeReturnService])
], ChequeReissueService);
//# sourceMappingURL=cheque-reissue.service.js.map