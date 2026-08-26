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
exports.PartyOutstandingProvider = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../database/prisma/prisma.service");
const report_data_provider_decorator_1 = require("../report-data-provider.decorator");
const provider_utils_1 = require("../provider.utils");
let PartyOutstandingProvider = class PartyOutstandingProvider {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    fields() {
        return [
            { name: '__index', type: 'integer', label: 'Serial number (1-based)' },
            { name: 'accYear', type: 'string', label: 'Accounting year the bill started in' },
            { name: 'docRefNo', type: 'string', label: 'Bill / voucher number' },
            { name: 'docDate', type: 'date', label: 'Document date', format: 'dd-MM-yyyy' },
            { name: 'dueDate', type: 'date', label: 'Due date', format: 'dd-MM-yyyy' },
            { name: 'srcDocType', type: 'string', label: 'Source document type' },
            { name: 'billType', type: 'string', label: 'Bill type' },
            { name: 'drCr', type: 'string', label: 'DR / CR' },
            { name: 'narration', type: 'string', label: 'Narration' },
            { name: 'billAmount', type: 'number', label: 'Bill amount', format: '#,##0.00' },
            { name: 'allocAmount', type: 'number', label: 'Amount received', format: '#,##0.00' },
            { name: 'discAmount', type: 'number', label: 'Discount allowed', format: '#,##0.00' },
            {
                name: 'pendingAmount',
                type: 'number',
                label: 'Pending amount (CR negative)',
                format: '#,##0.00',
            },
            {
                name: 'pendingAbs',
                type: 'number',
                label: 'Pending amount (unsigned)',
                format: '#,##0.00',
            },
            { name: 'creditDays', type: 'integer', label: 'Credit days' },
            { name: 'overdueDays', type: 'integer', label: 'Days overdue' },
            { name: 'ageBucket', type: 'string', label: 'Ageing bucket' },
            { name: 'status', type: 'string', label: 'OPEN / PARTIAL / CLOSED' },
            { name: 'isOverdue', type: 'boolean', label: 'Overdue' },
            { name: 'runningTotal', type: 'number', label: 'Running signed total', format: '#,##0.00' },
        ];
    }
    async resolve(context) {
        const partyId = (0, provider_utils_1.toText)(context.params?.partyId) || context.docId;
        if (!partyId) {
            return [];
        }
        const asOnParam = (0, provider_utils_1.toText)(context.params?.asOn);
        const asOn = asOnParam ? new Date(asOnParam) : new Date();
        const asOnValid = Number.isNaN(asOn.getTime()) ? new Date() : asOn;
        const rows = await this.prisma.accBillBalance.findMany({
            where: {
                ablPartyId: partyId,
                ablCompanyId: context.companyId,
                ablIsDeleted: false,
                ablIsActive: true,
                ablStatus: { in: ['OPEN', 'PARTIAL'] },
                ...(context.branchId ? { ablBranchId: context.branchId } : {}),
            },
            orderBy: [{ ablDocDate: 'asc' }, { ablDocRefno: 'asc' }],
            select: {
                ablAccYear: true,
                ablDocRefno: true,
                ablDocDate: true,
                ablDueDate: true,
                ablSrcDocType: true,
                ablBillType: true,
                ablDrCr: true,
                ablNarration: true,
                ablBillAmount: true,
                ablAllocAmount: true,
                ablDiscAmount: true,
                ablPendingAmount: true,
                ablCreditDays: true,
                ablGraceDays: true,
                ablStatus: true,
            },
        });
        let runningTotal = 0;
        return rows.map((row, index) => {
            const isCredit = (0, provider_utils_1.toText)(row.ablDrCr).trim().toUpperCase() === 'CR';
            const pendingAbs = (0, provider_utils_1.round2)((0, provider_utils_1.toNumber)(row.ablPendingAmount));
            const pendingSigned = isCredit ? -pendingAbs : pendingAbs;
            runningTotal = (0, provider_utils_1.round2)(runningTotal + pendingSigned);
            const dueDate = row.ablDueDate;
            const graceMs = row.ablGraceDays * 24 * 60 * 60 * 1000;
            const overdueDays = dueDate
                ? Math.max(0, Math.floor((asOnValid.getTime() - (dueDate.getTime() + graceMs)) / (24 * 60 * 60 * 1000)))
                : 0;
            return {
                __index: index + 1,
                accYear: row.ablAccYear,
                docRefNo: (0, provider_utils_1.toText)(row.ablDocRefno),
                docDate: (0, provider_utils_1.toDateOnly)(row.ablDocDate),
                dueDate: (0, provider_utils_1.toDateOnly)(row.ablDueDate),
                srcDocType: (0, provider_utils_1.toText)(row.ablSrcDocType),
                billType: (0, provider_utils_1.toText)(row.ablBillType),
                drCr: isCredit ? 'CR' : 'DR',
                narration: (0, provider_utils_1.toText)(row.ablNarration),
                billAmount: (0, provider_utils_1.round2)((0, provider_utils_1.toNumber)(row.ablBillAmount)),
                allocAmount: (0, provider_utils_1.round2)((0, provider_utils_1.toNumber)(row.ablAllocAmount)),
                discAmount: (0, provider_utils_1.round2)((0, provider_utils_1.toNumber)(row.ablDiscAmount)),
                pendingAmount: pendingSigned,
                pendingAbs,
                creditDays: row.ablCreditDays,
                overdueDays,
                ageBucket: bucketFor(overdueDays),
                status: (0, provider_utils_1.toText)(row.ablStatus),
                isOverdue: overdueDays > 0,
                runningTotal,
            };
        });
    }
    sampleData() {
        const rows = [
            {
                docRefNo: 'SLM/26-27/000091',
                docDate: '2026-05-14',
                dueDate: '2026-06-13',
                billAmount: 18400,
                allocAmount: 0,
                drCr: 'DR',
                overdueDays: 72,
            },
            {
                docRefNo: 'SLM/26-27/000112',
                docDate: '2026-06-28',
                dueDate: '2026-07-28',
                billAmount: 24600,
                allocAmount: 10000,
                drCr: 'DR',
                overdueDays: 27,
            },
            {
                docRefNo: 'SLM/26-27/000133',
                docDate: '2026-08-02',
                dueDate: '2026-09-01',
                billAmount: 31250,
                allocAmount: 0,
                drCr: 'DR',
                overdueDays: 0,
            },
            {
                docRefNo: 'RCP/26-27/000418',
                docDate: '2026-08-18',
                dueDate: null,
                billAmount: 5000,
                allocAmount: 0,
                drCr: 'CR',
                overdueDays: 0,
            },
        ];
        let runningTotal = 0;
        return rows.map((row, index) => {
            const pendingAbs = (0, provider_utils_1.round2)(row.billAmount - row.allocAmount);
            const pendingSigned = row.drCr === 'CR' ? -pendingAbs : pendingAbs;
            runningTotal = (0, provider_utils_1.round2)(runningTotal + pendingSigned);
            return {
                __index: index + 1,
                accYear: '2026-2027',
                docRefNo: row.docRefNo,
                docDate: row.docDate,
                dueDate: row.dueDate,
                srcDocType: row.drCr === 'CR' ? 'RECEIPT' : 'SALE_BILL',
                billType: 'CREDIT',
                drCr: row.drCr,
                narration: row.drCr === 'CR' ? 'Advance received' : '',
                billAmount: row.billAmount,
                allocAmount: row.allocAmount,
                discAmount: 0,
                pendingAmount: pendingSigned,
                pendingAbs,
                creditDays: 30,
                overdueDays: row.overdueDays,
                ageBucket: bucketFor(row.overdueDays),
                status: row.allocAmount > 0 ? 'PARTIAL' : 'OPEN',
                isOverdue: row.overdueDays > 0,
                runningTotal,
            };
        });
    }
};
exports.PartyOutstandingProvider = PartyOutstandingProvider;
exports.PartyOutstandingProvider = PartyOutstandingProvider = __decorate([
    (0, common_1.Injectable)(),
    (0, report_data_provider_decorator_1.ReportDataProvider)('accounts.party.outstanding', {
        label: 'Party outstanding — open bills',
        cardinality: 'many',
        docTypes: ['PARTY_STATEMENT', 'OUTSTANDING_STATEMENT'],
    }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PartyOutstandingProvider);
const bucketFor = (overdueDays) => {
    if (overdueDays <= 0) {
        return 'Current';
    }
    if (overdueDays <= 30) {
        return '1-30';
    }
    if (overdueDays <= 60) {
        return '31-60';
    }
    if (overdueDays <= 90) {
        return '61-90';
    }
    if (overdueDays <= 180) {
        return '91-180';
    }
    return '180+';
};
//# sourceMappingURL=party-outstanding.provider.js.map