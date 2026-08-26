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
exports.InvoiceBatchDetailProvider = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../database/prisma/prisma.service");
const report_data_provider_decorator_1 = require("../report-data-provider.decorator");
const provider_utils_1 = require("../provider.utils");
let InvoiceBatchDetailProvider = class InvoiceBatchDetailProvider {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    fields() {
        return [
            { name: '__index', type: 'integer', label: 'Serial number (1-based)' },
            { name: 'lineNo', type: 'integer', label: 'Printed line number' },
            { name: 'splitNo', type: 'integer', label: 'Allocation number within line' },
            { name: 'itemCode', type: 'string', label: 'Item code' },
            { name: 'itemName', type: 'string', label: 'Item name', complexScript: true },
            { name: 'hsnCode', type: 'string', label: 'HSN code' },
            { name: 'batchNo', type: 'string', label: 'Batch number' },
            { name: 'batchDate', type: 'date', label: 'Batch date', format: 'dd-MM-yyyy' },
            { name: 'expiryDate', type: 'date', label: 'Expiry date', format: 'dd-MM-yyyy' },
            { name: 'serialNo', type: 'string', label: 'Serial number' },
            { name: 'godownId', type: 'string', label: 'Godown id' },
            { name: 'qty', type: 'number', label: 'Allocated quantity', format: '0.000' },
            { name: 'rate', type: 'number', label: 'Rate', format: '#,##0.00' },
            { name: 'mrp', type: 'number', label: 'MRP', format: '#,##0.00' },
            { name: 'taxableAmt', type: 'number', label: 'Taxable amount', format: '#,##0.00' },
            { name: 'taxAmt', type: 'number', label: 'Tax amount', format: '#,##0.00' },
            { name: 'netAmount', type: 'number', label: 'Net amount', format: '#,##0.00' },
        ];
    }
    async resolve(context) {
        if (!context.docId) {
            return [];
        }
        const allocations = await this.prisma.saleBillItem.findMany({
            where: {
                sbiBillId: context.docId,
                sbiAccYear: context.accYear,
                sbiCompanyId: context.companyId,
                sbiIsDeleted: false,
            },
            orderBy: [{ sbiLineNo: 'asc' }, { sbiSplitNo: 'asc' }],
            include: {
                item: { select: { itemCode: true, itemNameEn: true, itemNameTa: true } },
            },
        });
        return allocations.map((allocation, index) => ({
            __index: index + 1,
            lineNo: allocation.sbiLineNo,
            splitNo: allocation.sbiSplitNo,
            itemCode: (0, provider_utils_1.toText)(allocation.item?.itemCode),
            itemName: (0, provider_utils_1.toText)(allocation.item?.itemNameTa || allocation.item?.itemNameEn),
            hsnCode: (0, provider_utils_1.toText)(allocation.sbiHsnCode),
            batchNo: (0, provider_utils_1.toText)(allocation.sbiBatchNo),
            batchDate: (0, provider_utils_1.toDateOnly)(allocation.sbiBatchDate),
            expiryDate: (0, provider_utils_1.toDateOnly)(allocation.sbiExpiryDate),
            serialNo: (0, provider_utils_1.toText)(allocation.sbiSerialNo),
            godownId: allocation.sbiGodownId,
            qty: (0, provider_utils_1.toNumber)(allocation.sbiBillQty),
            rate: (0, provider_utils_1.toNumber)(allocation.sbiRate),
            mrp: (0, provider_utils_1.toNumber)(allocation.sbiMaxPrice),
            taxableAmt: (0, provider_utils_1.toNumber)(allocation.sbiTaxableAmt),
            taxAmt: (0, provider_utils_1.toNumber)(allocation.sbiTaxAmt),
            netAmount: (0, provider_utils_1.toNumber)(allocation.sbiNetAmt),
        }));
    }
    sampleData() {
        return [
            {
                __index: 1,
                lineNo: 1,
                splitNo: 1,
                itemCode: 'RICE-PON-25',
                itemName: 'பொன்னி பச்சரிசி 25 கிலோ மூட்டை',
                hsnCode: '10063020',
                batchNo: 'B-2608A',
                batchDate: '2026-08-02',
                expiryDate: '2027-08-01',
                serialNo: '',
                godownId: '01920000-0000-7000-8000-0000000002a1',
                qty: 7,
                rate: 1180,
                mrp: 1250,
                taxableAmt: 8106.8,
                taxAmt: 0,
                netAmount: 8106.8,
            },
            {
                __index: 2,
                lineNo: 1,
                splitNo: 2,
                itemCode: 'RICE-PON-25',
                itemName: 'பொன்னி பச்சரிசி 25 கிலோ மூட்டை',
                hsnCode: '10063020',
                batchNo: 'B-2608B',
                batchDate: '2026-08-14',
                expiryDate: '2027-08-13',
                serialNo: '',
                godownId: '01920000-0000-7000-8000-0000000002a1',
                qty: 5,
                rate: 1180,
                mrp: 1250,
                taxableAmt: 5790,
                taxAmt: 0,
                netAmount: 5790,
            },
            {
                __index: 3,
                lineNo: 2,
                splitNo: 1,
                itemCode: 'OIL-SUN-1L',
                itemName: 'சூரியகாந்தி எண்ணெய் 1 லிட்டர்',
                hsnCode: '15121110',
                batchNo: 'SO-0826',
                batchDate: '2026-08-06',
                expiryDate: '2027-02-05',
                serialNo: '',
                godownId: '01920000-0000-7000-8000-0000000002a1',
                qty: 48,
                rate: 142.5,
                mrp: 160,
                taxableAmt: 6703.2,
                taxAmt: 335.16,
                netAmount: 7038.36,
            },
        ];
    }
};
exports.InvoiceBatchDetailProvider = InvoiceBatchDetailProvider;
exports.InvoiceBatchDetailProvider = InvoiceBatchDetailProvider = __decorate([
    (0, common_1.Injectable)(),
    (0, report_data_provider_decorator_1.ReportDataProvider)('sales.invoice.batchDetail', {
        label: 'Sale invoice — batch allocations',
        cardinality: 'many',
        docTypes: ['SALE_INVOICE', 'TAX_INVOICE', 'RETAIL_INVOICE', 'CASH_BILL'],
    }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InvoiceBatchDetailProvider);
//# sourceMappingURL=invoice-batch-detail.provider.js.map