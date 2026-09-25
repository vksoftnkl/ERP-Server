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
exports.ChequeDepositService = void 0;
exports.buildSlipSummary = buildSlipSummary;
const common_1 = require("@nestjs/common");
const books_reconcile_guard_1 = require("../reconcile/books-reconcile.guard");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const receipt_enum_1 = require("../receipt/types/receipt-enum");
const receipt_guards_1 = require("../receipt/receipt.guards");
const receipt_utils_1 = require("../receipt/receipt.utils");
const cheques_guards_1 = require("./cheques.guards");
const cheques_utils_1 = require("./cheques.utils");
const cheque_enum_1 = require("./types/cheque-enum");
const DEPOSIT_TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 60_000 };
let ChequeDepositService = class ChequeDepositService {
    prisma;
    requestContext;
    constructor(prisma, requestContext) {
        this.prisma = prisma;
        this.requestContext = requestContext;
    }
    async deposit(dto) {
        const actor = this.requestContext.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        const depositDate = (0, receipt_utils_1.toDateOnly)(dto.depositDate);
        return this.prisma.$transaction(async (tx) => {
            (0, cheques_guards_1.assertNotInFuture)(depositDate, 'A deposit', 'depositDate');
            const locked = await (0, cheques_guards_1.lockCheques)(tx, dto.cheques);
            const cheques = dto.cheques.map((key, index) => this.pick(locked, key, index, dto.apdCompanyId, dto.apdBranchId));
            const bank = await (0, cheques_guards_1.loadBankLedger)(tx, dto.apdCompanyId, dto.bankLedgerId);
            for (const [index, cheque] of cheques.entries()) {
                if (cheque.apdStatus === receipt_enum_1.PdcStatus.BOUNCED) {
                    (0, module_service_utils_1.throwAccountsBadRequest)('Use re-present instead', [
                        {
                            field: `cheques.${index}`,
                            message: `${cheque.apdInstrumentNo} has already bounced once. Send it back to the bank ` +
                                'through /cheques/re-present, which re-issues it to the party first.',
                        },
                    ]);
                }
                (0, cheques_guards_1.assertStatus)(cheque, cheque_enum_1.DEPOSITABLE_STATUSES, 'deposited', `cheques.${index}`);
                (0, cheques_guards_1.assertDateOnOrAfter)(depositDate, cheque.apdInstrumentDate, `Deposit ${cheque.apdInstrumentNo}`, 'the date on the cheque', `cheques.${index}`);
                await (0, receipt_guards_1.assertAccYearWritable)(tx, cheque.apdCompanyId, cheque.apdAccYear, `cheques.${index}`);
            }
            const now = new Date();
            for (const cheque of cheques) {
                await tx.accPdcRegister.update({
                    where: {
                        apdId_apdAccYear: { apdId: cheque.apdId, apdAccYear: cheque.apdAccYear },
                    },
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
                    },
                });
                await (0, cheques_utils_1.logChequeStatus)(tx, cheque, {
                    fromStatus: cheque.apdStatus,
                    toStatus: receipt_enum_1.PdcStatus.DEPOSITED,
                    remarks: `Deposited into ${bank.ledgerName} on slip ${dto.slipNo}` +
                        (dto.remarks ? ` — ${dto.remarks}` : ''),
                    actor,
                    changedOn: now,
                });
            }
            await (0, books_reconcile_guard_1.assertBooksReconcile)(tx, {
                companyId: dto.apdCompanyId,
                accYear: (0, receipt_guards_1.accYearOf)(depositDate),
                cheques: cheques.map((cheque) => ({ apdId: cheque.apdId, apdAccYear: cheque.apdAccYear })),
            });
            const rows = await Promise.all(cheques.map((cheque) => (0, cheques_utils_1.reloadChequeRow)(tx, cheque.apdId, cheque.apdAccYear)));
            return {
                rows,
                slip: {
                    bankLedgerId: bank.ledgerId,
                    bankLedgerName: bank.ledgerName,
                    depositDate: (0, receipt_utils_1.toDateString)(depositDate) ?? dto.depositDate,
                    slipNo: dto.slipNo,
                    chequeCount: cheques.length,
                    totalAmount: (0, receipt_utils_1.toAmount)((0, receipt_utils_1.sum)(cheques.map((cheque) => cheque.apdAmount))),
                },
            };
        }, DEPOSIT_TRANSACTION_OPTIONS);
    }
    pick(locked, key, index, companyId, branchId) {
        const cheque = locked.get((0, cheques_guards_1.chequeKey)(key.apdId, key.apdAccYear));
        if (!cheque ||
            cheque.apdIsDeleted ||
            cheque.apdCompanyId !== companyId ||
            cheque.apdBranchId !== branchId) {
            (0, module_service_utils_1.throwAccountsNotFound)('Cheque not found', `cheques.${index}`, `No live cheque ${key.apdId} at this company / branch in ${key.apdAccYear}`);
        }
        if (cheque.apdTraType !== 'R') {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: `cheques.${index}`,
                    message: `${cheque.apdInstrumentNo} is an ISSUED cheque, not a received one. ` +
                        'It belongs to the Issued Cheques screen.',
                },
            ]);
        }
        return cheque;
    }
};
exports.ChequeDepositService = ChequeDepositService;
exports.ChequeDepositService = ChequeDepositService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], ChequeDepositService);
function buildSlipSummary(bank, depositDate, slipNo, amounts) {
    return {
        bankLedgerId: bank.ledgerId,
        bankLedgerName: bank.ledgerName,
        depositDate: (0, receipt_utils_1.toDateString)(depositDate) ?? '',
        slipNo,
        chequeCount: amounts.length,
        totalAmount: (0, receipt_utils_1.toAmount)((0, receipt_utils_1.sum)(amounts)),
    };
}
//# sourceMappingURL=cheque-deposit.service.js.map