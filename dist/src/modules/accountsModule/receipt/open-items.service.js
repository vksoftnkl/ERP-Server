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
exports.OpenItemsService = void 0;
exports.creditRouting = creditRouting;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const app_setting_value_service_1 = require("../../settings/appSettings/app-setting-value.service");
const receipt_enum_1 = require("./types/receipt-enum");
const receipt_guards_1 = require("./receipt.guards");
const receipt_settings_1 = require("./receipt.settings");
const ppd_slab_1 = require("./ppd-slab");
const receipt_utils_1 = require("./receipt.utils");
let OpenItemsService = class OpenItemsService {
    prisma;
    appSettingValueService;
    constructor(prisma, appSettingValueService) {
        this.prisma = prisma;
        this.appSettingValueService = appSettingValueService;
    }
    async listOpenItems(query) {
        const partyId = query.partyId;
        const onDate = query.onDate ? (0, receipt_utils_1.toDateOnly)(query.onDate) : (0, receipt_utils_1.todayUtc)();
        const [party, settings] = await Promise.all([
            (0, receipt_guards_1.loadParty)(this.prisma, query.companyId, partyId, 'partyId'),
            this.loadSettings(query.companyId),
        ]);
        const [bills, credits] = await Promise.all([
            this.loadBills(query.companyId, partyId, onDate, settings),
            this.loadCredits(query.companyId, partyId),
        ]);
        const partyPayload = {
            ledId: party.ledId,
            ledName: party.ledName,
            groupName: party.groupName,
            isBillByBill: party.ledIsBillByBill,
            isTdsApplicable: party.ledIsTdsApplicable,
            tdsDeducteeType: party.ledTdsDeducteeType,
            isTcsApplicable: party.ledIsTcsApplicable,
            tcsBasis: settings.tcsBasis,
            tanNo: party.ledTanNo,
        };
        return {
            bills,
            credits,
            summary: {
                totalPending: (0, receipt_utils_1.toAmount)((0, receipt_utils_1.sum)(bills.map((bill) => (0, receipt_utils_1.money)(bill.pendingAmount)))),
                billCount: bills.length,
                overdueCount: bills.filter((bill) => bill.daysOverdue > 0).length,
                creditsHeld: (0, receipt_utils_1.toAmount)((0, receipt_utils_1.sum)(credits.map((credit) => (0, receipt_utils_1.money)(credit.pendingAmount)))),
                pdcHeld: (0, receipt_utils_1.toAmount)((0, receipt_utils_1.sum)(bills.map((bill) => (0, receipt_utils_1.money)(bill.pdcHeld)))),
            },
            party: partyPayload,
        };
    }
    async loadBills(companyId, partyId, onDate, settings) {
        const bills = await this.prisma.accBillBalance.findMany({
            where: {
                ablCompanyId: companyId,
                ablPartyId: partyId,
                ablIsDeleted: false,
                ablIsActive: true,
                ablDrCr: 'DR',
                ablBillType: { in: [...receipt_enum_1.RECEIVABLE_BILL_TYPES] },
                ablPendingAmount: { gt: 0 },
            },
            select: {
                ablId: true,
                ablAccYear: true,
                ablBillType: true,
                ablDocRefno: true,
                ablDocDate: true,
                ablDueDate: true,
                ablBillAmount: true,
                ablPendingAmount: true,
                ablStatus: true,
            },
        });
        const pdcByBill = await this.loadPostDatedHeld(bills.map((bill) => ({ billId: bill.ablId, accYear: bill.ablAccYear })), onDate);
        const rows = bills.map((bill) => {
            const pending = bill.ablPendingAmount ?? receipt_utils_1.ZERO;
            return {
                billId: bill.ablId,
                billAccYear: bill.ablAccYear,
                billType: bill.ablBillType,
                docRefno: bill.ablDocRefno,
                docDate: (0, receipt_utils_1.toDateString)(bill.ablDocDate),
                dueDate: (0, receipt_utils_1.toDateString)(bill.ablDueDate),
                billAmount: (0, receipt_utils_1.toAmount)(bill.ablBillAmount),
                pendingAmount: (0, receipt_utils_1.toAmount)(pending),
                status: (bill.ablStatus ?? 'OPEN'),
                daysOverdue: (0, receipt_utils_1.daysOverdue)(bill.ablDueDate, onDate),
                pdcHeld: (0, receipt_utils_1.toAmount)(pdcByBill.get(`${bill.ablId}|${bill.ablAccYear}`) ?? receipt_utils_1.ZERO),
                ppdSuggested: (0, receipt_utils_1.toAmount)((0, ppd_slab_1.suggestPpdDiscount)({
                    docDate: bill.ablDocDate,
                    onDate,
                    pendingAmount: (0, receipt_utils_1.money)(pending),
                    slabs: settings.ppdSlabs,
                })),
            };
        });
        const sortKeys = new Map(bills.map((bill) => [
            `${bill.ablId}|${bill.ablAccYear}`,
            { due: bill.ablDueDate ?? bill.ablDocDate, doc: bill.ablDocDate },
        ]));
        const byBillDate = settings.billSort === receipt_enum_1.ReceiptBillSort.BILL_DATE;
        const primary = (row) => {
            const keys = sortKeys.get(`${row.billId}|${row.billAccYear}`);
            return (byBillDate ? keys.doc : keys.due).getTime();
        };
        rows.sort((left, right) => primary(left) - primary(right) || left.docRefno.localeCompare(right.docRefno));
        return rows;
    }
    async loadPostDatedHeld(bills, onDate) {
        if (bills.length === 0) {
            return new Map();
        }
        const rows = await this.prisma.accBillAdjustment.findMany({
            where: {
                abjIsDeleted: false,
                abjIsPostDated: true,
                abjAdjDate: { gt: onDate },
                OR: bills.map((bill) => ({ abjBillId: bill.billId, abjBillAccYear: bill.accYear })),
            },
            select: { abjBillId: true, abjBillAccYear: true, abjAmount: true },
        });
        const held = new Map();
        for (const row of rows) {
            const key = `${row.abjBillId}|${row.abjBillAccYear}`;
            held.set(key, (held.get(key) ?? receipt_utils_1.ZERO).plus(row.abjAmount));
        }
        return held;
    }
    async loadCredits(companyId, partyId, side = 'CR') {
        const credits = await this.prisma.accBillBalance.findMany({
            where: {
                ablCompanyId: companyId,
                ablPartyId: partyId,
                ablIsDeleted: false,
                ablIsActive: true,
                ablDrCr: side,
                ablBillType: { in: [...receipt_enum_1.CREDIT_BILL_TYPES] },
                ablPendingAmount: { gt: 0 },
            },
            select: {
                ablId: true,
                ablAccYear: true,
                ablBillType: true,
                ablDocRefno: true,
                ablDocDate: true,
                ablBillAmount: true,
                ablPendingAmount: true,
                ablStatus: true,
                ablDrCr: true,
                ablSrcModule: true,
                ablSrcDocType: true,
                ablSrcDocId: true,
                ablSrcAccYear: true,
                ablNarration: true,
            },
            orderBy: [{ ablDocDate: 'asc' }, { ablDocRefno: 'asc' }],
        });
        return credits.map((credit) => {
            const routing = creditRouting(credit.ablBillType);
            return {
                billId: credit.ablId,
                billAccYear: credit.ablAccYear,
                billType: credit.ablBillType,
                docRefno: credit.ablDocRefno,
                docDate: (0, receipt_utils_1.toDateString)(credit.ablDocDate),
                billAmount: (0, receipt_utils_1.toAmount)(credit.ablBillAmount),
                pendingAmount: (0, receipt_utils_1.toAmount)(credit.ablPendingAmount),
                srcModule: credit.ablSrcModule,
                srcDocType: credit.ablSrcDocType,
                srcDocId: credit.ablSrcDocId,
                srcAccYear: credit.ablSrcAccYear,
                narration: credit.ablNarration,
                status: (credit.ablStatus ?? 'OPEN'),
                drCr: credit.ablDrCr,
                adjType: routing.adjType,
                settlementMode: routing.settlementMode,
            };
        });
    }
    async partyContext(query) {
        const [receipts, cheques] = await Promise.all([
            this.loadRecentReceipts(query.companyId, query.partyId),
            this.loadPendingCheques(query.companyId, query.partyId),
        ]);
        return { partyId: query.partyId, lastReceipts: receipts, pendingCheques: cheques };
    }
    async loadRecentReceipts(companyId, partyId) {
        const headers = await this.prisma.accVoucherHeader.findMany({
            where: {
                avhCompanyId: companyId,
                avhPartyId: partyId,
                avhIsDeleted: false,
                avhVoucherStatus: 'POSTED',
                voucherType: { vchrTypeCode: receipt_enum_1.RECEIPT_VOUCHER_TYPE_CODE },
                avhAgainstVoucherId: null,
            },
            select: {
                avhVoucherId: true,
                avhAccYear: true,
                avhVoucherRefno: true,
                avhVoucherDate: true,
                avhDocAmount: true,
                avhAdjustAmount: true,
            },
            orderBy: [{ avhVoucherDate: 'desc' }, { avhVoucherSlno: 'desc' }],
            take: 10,
        });
        if (headers.length === 0) {
            return [];
        }
        const tenders = await this.prisma.accTenderDetail.findMany({
            where: {
                tdSrcDocId: { in: headers.map((header) => header.avhVoucherId) },
                tdIsDeleted: false,
            },
            select: { tdSrcDocId: true, tenderType: { select: { ttmDisplayName: true } } },
        });
        const instrumentsByVoucher = new Map();
        for (const tender of tenders) {
            const name = tender.tenderType?.ttmDisplayName;
            if (!name) {
                continue;
            }
            const set = instrumentsByVoucher.get(tender.tdSrcDocId) ?? new Set();
            set.add(name);
            instrumentsByVoucher.set(tender.tdSrcDocId, set);
        }
        return headers.map((header) => ({
            voucherId: header.avhVoucherId,
            accYear: header.avhAccYear,
            voucherRefno: header.avhVoucherRefno,
            voucherDate: (0, receipt_utils_1.toDateString)(header.avhVoucherDate),
            docAmount: (0, receipt_utils_1.toAmount)(header.avhDocAmount),
            adjustAmount: (0, receipt_utils_1.toAmount)(header.avhAdjustAmount),
            instruments: [...(instrumentsByVoucher.get(header.avhVoucherId) ?? [])].sort().join(', ') || null,
        }));
    }
    async loadPendingCheques(companyId, partyId) {
        const cheques = await this.prisma.accPdcRegister.findMany({
            where: {
                apdCompanyId: companyId,
                apdPartyId: partyId,
                apdIsDeleted: false,
                apdStatus: { in: ['HELD', 'DEPOSITED'] },
            },
            select: {
                apdId: true,
                apdAccYear: true,
                apdInstrumentNo: true,
                apdInstrumentDate: true,
                apdAmount: true,
                apdBankName: true,
                apdStatus: true,
                apdVoucherId: true,
                receiptVoucher: { select: { avhVoucherRefno: true } },
            },
            orderBy: [{ apdInstrumentDate: 'asc' }, { apdInstrumentNo: 'asc' }],
        });
        return cheques.map((cheque) => ({
            pdcId: cheque.apdId,
            accYear: cheque.apdAccYear,
            instrumentNo: cheque.apdInstrumentNo,
            instrumentDate: (0, receipt_utils_1.toDateString)(cheque.apdInstrumentDate),
            amount: (0, receipt_utils_1.toAmount)(cheque.apdAmount),
            bankName: cheque.apdBankName,
            status: cheque.apdStatus,
            voucherId: cheque.apdVoucherId,
            voucherRefno: cheque.receiptVoucher?.avhVoucherRefno ?? null,
        }));
    }
    async loadSettings(companyId, branchId) {
        const effective = await this.appSettingValueService.resolveEffective({
            companyId,
            branchId: branchId ?? undefined,
        });
        return (0, receipt_settings_1.readReceiptSettings)(effective);
    }
};
exports.OpenItemsService = OpenItemsService;
exports.OpenItemsService = OpenItemsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        app_setting_value_service_1.AppSettingValueService])
], OpenItemsService);
function creditRouting(billType) {
    return billType === receipt_enum_1.BillType.SALES_RETURN
        ? { adjType: receipt_enum_1.BillAdjType.NOTE_ADJUST, settlementMode: receipt_enum_1.BillSettlementMode.CREDIT_NOTE }
        : { adjType: receipt_enum_1.BillAdjType.ADVANCE_ADJUST, settlementMode: receipt_enum_1.BillSettlementMode.ADVANCE };
}
//# sourceMappingURL=open-items.service.js.map