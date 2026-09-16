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
exports.ChequesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const receipt_enum_1 = require("../receipt/types/receipt-enum");
const receipt_utils_1 = require("../receipt/receipt.utils");
const cheques_utils_1 = require("./cheques.utils");
const cheque_voucher_helper_1 = require("./cheque-voucher.helper");
const cheque_enum_1 = require("./types/cheque-enum");
let ChequesService = class ChequesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(query) {
        const where = this.buildWhere(query);
        const [rows, total, summaryRows] = await Promise.all([
            this.prisma.accPdcRegister.findMany({
                where,
                orderBy: [{ apdInstrumentDate: 'asc' }, { apdCreatedOn: 'asc' }],
                skip: query.offset ?? 0,
                take: query.limit ?? 200,
                include: {
                    party: { select: { ledName: true } },
                    bankLedger: { select: { ledName: true } },
                },
            }),
            this.prisma.accPdcRegister.count({ where }),
            this.prisma.accPdcRegister.groupBy({
                by: ['apdStatus'],
                where: {
                    apdCompanyId: query.apdCompanyId,
                    apdBranchId: query.apdBranchId,
                    apdAccYear: query.apdAccYear,
                    apdTraType: 'R',
                    apdIsDeleted: false,
                },
                _count: { _all: true },
                _sum: { apdAmount: true },
            }),
        ]);
        const byStatus = new Map(summaryRows.map((row) => [
            row.apdStatus,
            { count: row._count._all, amount: row._sum.apdAmount ?? receipt_utils_1.ZERO },
        ]));
        const pick = (status) => byStatus.get(status) ?? { count: 0, amount: receipt_utils_1.ZERO };
        return {
            rows: rows.map((row) => this.toRow(row)),
            total,
            summary: {
                inHandCount: pick(receipt_enum_1.PdcStatus.HELD).count,
                inHandAmount: (0, receipt_utils_1.toAmount)(pick(receipt_enum_1.PdcStatus.HELD).amount),
                withBankCount: pick(receipt_enum_1.PdcStatus.DEPOSITED).count,
                withBankAmount: (0, receipt_utils_1.toAmount)(pick(receipt_enum_1.PdcStatus.DEPOSITED).amount),
                bouncedCount: pick(receipt_enum_1.PdcStatus.BOUNCED).count,
                bouncedAmount: (0, receipt_utils_1.toAmount)(pick(receipt_enum_1.PdcStatus.BOUNCED).amount),
                clearedCount: pick(receipt_enum_1.PdcStatus.CLEARED).count,
                clearedAmount: (0, receipt_utils_1.toAmount)(pick(receipt_enum_1.PdcStatus.CLEARED).amount),
            },
        };
    }
    buildWhere(query) {
        const statuses = (query.status ?? '')
            .split(',')
            .map((token) => token.trim().toUpperCase())
            .filter((token) => token.length > 0);
        const search = query.search?.trim();
        return {
            apdCompanyId: query.apdCompanyId,
            apdBranchId: query.apdBranchId,
            apdAccYear: query.apdAccYear,
            apdTraType: 'R',
            apdIsDeleted: false,
            ...(statuses.length > 0 ? { apdStatus: { in: statuses } } : {}),
            ...(query.from || query.to
                ? {
                    apdInstrumentDate: {
                        ...(query.from ? { gte: (0, receipt_utils_1.toDateOnly)(query.from) } : {}),
                        ...(query.to ? { lte: (0, receipt_utils_1.toDateOnly)(query.to) } : {}),
                    },
                }
                : {}),
            ...(query.bankLedgerId ? { apdBankLedgerId: query.bankLedgerId } : {}),
            ...(query.partyId ? { apdPartyId: query.partyId } : {}),
            ...(search
                ? {
                    OR: [
                        { apdInstrumentNo: { contains: search, mode: 'insensitive' } },
                        { apdDrawerName: { contains: search, mode: 'insensitive' } },
                        { apdBankName: { contains: search, mode: 'insensitive' } },
                        { party: { ledName: { contains: search, mode: 'insensitive' } } },
                    ],
                }
                : {}),
        };
    }
    async get(query) {
        return this.prisma.$transaction(async (tx) => {
            const row = await tx.accPdcRegister.findFirst({
                where: {
                    apdId: query.apdId,
                    apdAccYear: query.apdAccYear,
                    apdCompanyId: query.apdCompanyId,
                    apdBranchId: query.apdBranchId,
                    apdIsDeleted: false,
                },
                include: {
                    party: { select: { ledName: true } },
                    bankLedger: { select: { ledName: true } },
                },
            });
            if (!row) {
                (0, module_service_utils_1.throwAccountsNotFound)('Cheque not found', 'apdId', `No live cheque ${query.apdId} at this company / branch in ${query.apdAccYear}`);
            }
            const cheque = this.toRow(row);
            const tender = row.apdTenderId
                ? await tx.accTenderDetail.findFirst({
                    where: { tdId: row.apdTenderId, tdIsDeleted: false },
                    select: { tdTenderLedgerId: true, ledger: { select: { ledName: true } } },
                })
                : null;
            const [receiptVoucher, clearVoucher, bounceVoucher] = await Promise.all([
                (0, cheque_voucher_helper_1.loadVoucherRef)(tx, row.apdVoucherId, row.apdVoucherAccYear),
                (0, cheque_voucher_helper_1.loadVoucherRef)(tx, row.apdClearVoucherId, row.apdClearAccYear),
                (0, cheque_voucher_helper_1.loadVoucherRef)(tx, row.apdBounceVoucherId, row.apdBounceAccYear),
            ]);
            const reissue = row.apdBounceVoucherId
                ? await tx.accVoucherHeader.findFirst({
                    where: {
                        avhAgainstVoucherId: row.apdBounceVoucherId,
                        avhIsDeleted: false,
                    },
                    orderBy: { avhCreatedOn: 'desc' },
                    select: { avhVoucherId: true, avhAccYear: true },
                })
                : null;
            const bills = await this.loadTouchedBills(tx, row.apdId, row.apdAccYear);
            const chargeBillRow = await tx.accBillBalance.findFirst({
                where: {
                    ablSrcDocType: cheque_enum_1.BOUNCE_CHARGE_SRC_DOC_TYPE,
                    ablSrcDocId: row.apdId,
                    ablBillType: receipt_enum_1.BillType.JOURNAL,
                    ablIsDeleted: false,
                },
            });
            const [replaces, replacedBy] = await Promise.all([
                this.loadChainRow(tx, { replacedById: row.apdId, accYear: row.apdAccYear }),
                row.apdReplacedById && row.apdReplacedByAccYear
                    ? this.loadRowByKey(tx, row.apdReplacedById, row.apdReplacedByAccYear)
                    : Promise.resolve(null),
            ]);
            return {
                cheque,
                chequesInHandLedgerId: tender?.tdTenderLedgerId ?? null,
                chequesInHandLedgerName: tender?.ledger?.ledName ?? null,
                receiptVoucher,
                clearVoucher,
                bounceVoucher,
                reissueVoucher: reissue
                    ? await (0, cheque_voucher_helper_1.loadVoucherRef)(tx, reissue.avhVoucherId, reissue.avhAccYear)
                    : null,
                bills,
                chargeBill: chargeBillRow
                    ? {
                        billId: chargeBillRow.ablId,
                        billAccYear: chargeBillRow.ablAccYear,
                        billType: chargeBillRow.ablBillType,
                        docRefno: chargeBillRow.ablDocRefno,
                        docDate: (0, receipt_utils_1.toDateString)(chargeBillRow.ablDocDate) ?? '',
                        dueDate: (0, receipt_utils_1.toDateString)(chargeBillRow.ablDueDate),
                        billAmount: (0, receipt_utils_1.toAmount)(chargeBillRow.ablBillAmount),
                        pendingAmount: (0, receipt_utils_1.toAmount)(chargeBillRow.ablPendingAmount ?? receipt_utils_1.ZERO),
                        settledByThisCheque: 0,
                    }
                    : null,
                replaces,
                replacedBy,
            };
        });
    }
    async loadTouchedBills(tx, apdId, apdAccYear) {
        const rows = await tx.accBillAdjustment.findMany({
            where: { abjChequeId: apdId, abjChequeAccYear: apdAccYear, abjIsDeleted: false },
            select: { abjBillId: true, abjBillAccYear: true, abjAmount: true },
        });
        if (rows.length === 0) {
            return [];
        }
        const netByBill = new Map();
        for (const row of rows) {
            const key = `${row.abjBillId}|${row.abjBillAccYear}`;
            const found = netByBill.get(key);
            netByBill.set(key, {
                billId: row.abjBillId,
                accYear: row.abjBillAccYear,
                net: (found?.net ?? receipt_utils_1.ZERO).plus(row.abjAmount),
            });
        }
        const bills = await tx.accBillBalance.findMany({
            where: {
                OR: [...netByBill.values()].map((entry) => ({
                    ablId: entry.billId,
                    ablAccYear: entry.accYear,
                })),
            },
        });
        return bills.map((bill) => ({
            billId: bill.ablId,
            billAccYear: bill.ablAccYear,
            billType: bill.ablBillType,
            docRefno: bill.ablDocRefno,
            docDate: (0, receipt_utils_1.toDateString)(bill.ablDocDate) ?? '',
            dueDate: (0, receipt_utils_1.toDateString)(bill.ablDueDate),
            billAmount: (0, receipt_utils_1.toAmount)(bill.ablBillAmount),
            pendingAmount: (0, receipt_utils_1.toAmount)(bill.ablPendingAmount ?? receipt_utils_1.ZERO),
            settledByThisCheque: (0, receipt_utils_1.toAmount)(netByBill.get(`${bill.ablId}|${bill.ablAccYear}`)?.net ?? receipt_utils_1.ZERO),
        }));
    }
    async loadChainRow(tx, key) {
        const row = await tx.accPdcRegister.findFirst({
            where: {
                apdReplacedById: key.replacedById,
                apdReplacedByAccYear: key.accYear,
                apdIsDeleted: false,
            },
            include: {
                party: { select: { ledName: true } },
                bankLedger: { select: { ledName: true } },
            },
        });
        return row ? this.toRow(row) : null;
    }
    async loadRowByKey(tx, apdId, apdAccYear) {
        const row = await tx.accPdcRegister.findFirst({
            where: { apdId, apdAccYear, apdIsDeleted: false },
            include: {
                party: { select: { ledName: true } },
                bankLedger: { select: { ledName: true } },
            },
        });
        return row ? this.toRow(row) : null;
    }
    async history(query) {
        const cheque = await this.prisma.accPdcRegister.findFirst({
            where: {
                apdId: query.apdId,
                apdAccYear: query.apdAccYear,
                apdCompanyId: query.apdCompanyId,
                apdBranchId: query.apdBranchId,
                apdIsDeleted: false,
            },
            select: { apdId: true, apdAccYear: true, apdInstrumentNo: true },
        });
        if (!cheque) {
            (0, module_service_utils_1.throwAccountsNotFound)('Cheque not found', 'apdId', `No live cheque ${query.apdId} at this company / branch in ${query.apdAccYear}`);
        }
        const entries = await this.prisma.txnStatusLog.findMany({
            where: {
                tslSrcDocType: txn_status_log_helper_1.TxnStatusDocType.OTHER,
                tslSrcDocId: cheque.apdId,
                tslAccYear: cheque.apdAccYear,
            },
            orderBy: { tslSeqNo: 'desc' },
            select: {
                tslSeqNo: true,
                tslEvent: true,
                tslFromStatus: true,
                tslToStatus: true,
                tslChangedOn: true,
                tslChangedBy: true,
                tslRemarks: true,
            },
        });
        return {
            apdId: cheque.apdId,
            apdAccYear: cheque.apdAccYear,
            apdInstrumentNo: cheque.apdInstrumentNo,
            entries: entries.map((entry) => ({
                seqNo: entry.tslSeqNo,
                event: entry.tslEvent,
                fromStatus: entry.tslFromStatus,
                toStatus: entry.tslToStatus,
                changedOn: (0, receipt_utils_1.toIsoString)(entry.tslChangedOn) ?? '',
                changedBy: entry.tslChangedBy,
                remarks: entry.tslRemarks,
            })),
        };
    }
    async depositSlip(query) {
        const depositDate = (0, receipt_utils_1.toDateOnly)(query.depositDate);
        const [ledger, account, cheques] = await Promise.all([
            this.prisma.accLedgerMaster.findFirst({
                where: {
                    ledId: query.bankLedgerId,
                    ledIsDeleted: false,
                    OR: [{ ledCompanyId: null }, { ledCompanyId: query.apdCompanyId }],
                },
                select: { ledId: true, ledName: true },
            }),
            this.prisma.accLedgerBankAccount.findFirst({
                where: {
                    lbaLedgerId: query.bankLedgerId,
                    lbaIsDeleted: false,
                    lbaIsActive: true,
                    OR: [{ lbaCompanyId: null }, { lbaCompanyId: query.apdCompanyId }],
                },
                orderBy: [{ lbaIsDefault: 'desc' }, { lbaCreatedOn: 'asc' }],
            }),
            this.prisma.accPdcRegister.findMany({
                where: {
                    apdCompanyId: query.apdCompanyId,
                    apdBranchId: query.apdBranchId,
                    apdBankLedgerId: query.bankLedgerId,
                    apdDepositDate: depositDate,
                    apdDepositSlipNo: query.slipNo,
                    apdTraType: 'R',
                    apdIsDeleted: false,
                },
                orderBy: [{ apdInstrumentNo: 'asc' }],
                include: { party: { select: { ledName: true } } },
            }),
        ]);
        if (!ledger) {
            (0, module_service_utils_1.throwAccountsNotFound)('Bank ledger not found', 'bankLedgerId', `No ledger ${query.bankLedgerId} is visible to this company`);
        }
        return {
            companyId: query.apdCompanyId,
            branchId: query.apdBranchId,
            depositDate: (0, receipt_utils_1.toDateString)(depositDate) ?? query.depositDate,
            slipNo: query.slipNo,
            bankAccount: {
                ledgerId: ledger.ledId,
                ledgerName: ledger.ledName,
                accountHolder: account?.lbaAccountHolder ?? null,
                bankName: account?.lbaBankName ?? null,
                branchName: account?.lbaBranchName ?? null,
                accountNo: account?.lbaAccountNo ?? null,
                ifscCode: account?.lbaIfscCode ?? null,
                micrCode: account?.lbaMicrCode ?? null,
            },
            lines: cheques.map((cheque, index) => ({
                lineNo: index + 1,
                apdId: cheque.apdId,
                apdAccYear: cheque.apdAccYear,
                instrumentType: cheque.apdInstrumentType,
                instrumentNo: cheque.apdInstrumentNo,
                instrumentDate: (0, receipt_utils_1.toDateString)(cheque.apdInstrumentDate) ?? '',
                drawnOnBank: cheque.apdBankName,
                drawnOnBranch: cheque.apdBankBranch,
                micr: cheque.apdMicr,
                drawerName: cheque.apdDrawerName,
                partyName: cheque.party?.ledName ?? '',
                amount: (0, receipt_utils_1.toAmount)(cheque.apdAmount),
            })),
            chequeCount: cheques.length,
            totalAmount: (0, receipt_utils_1.toAmount)((0, receipt_utils_1.sum)(cheques.map((cheque) => new client_1.Prisma.Decimal(cheque.apdAmount)))),
        };
    }
    toRow(row) {
        return (0, cheques_utils_1.toChequeRow)({
            ...row,
            apdAmount: new client_1.Prisma.Decimal(row.apdAmount),
            apdBounceCharges: new client_1.Prisma.Decimal(row.apdBounceCharges),
            apdPostingMode: row.apdPostingMode,
            apdStatus: row.apdStatus,
        }, {
            partyName: row.party?.ledName ?? '',
            bankLedgerName: row.bankLedger?.ledName ?? null,
            apdStatusOn: row.apdStatusOn,
            apdStatusBy: row.apdStatusBy,
        });
    }
};
exports.ChequesService = ChequesService;
exports.ChequesService = ChequesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ChequesService);
//# sourceMappingURL=cheques.service.js.map