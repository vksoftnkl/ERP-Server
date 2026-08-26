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
exports.InvoiceTaxSummaryProvider = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../database/prisma/prisma.service");
const report_data_provider_decorator_1 = require("../report-data-provider.decorator");
const provider_utils_1 = require("../provider.utils");
let InvoiceTaxSummaryProvider = class InvoiceTaxSummaryProvider {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    fields() {
        return [
            { name: '__index', type: 'integer', label: 'Serial number (1-based)' },
            { name: 'hsnCode', type: 'string', label: 'HSN code' },
            { name: 'taxPerc', type: 'number', label: 'Total tax %', format: '0.00' },
            { name: 'lineCount', type: 'integer', label: 'Lines in this bucket' },
            { name: 'qty', type: 'number', label: 'Quantity', format: '0.000' },
            { name: 'taxableAmt', type: 'number', label: 'Taxable value', format: '#,##0.00' },
            { name: 'cgstPerc', type: 'number', label: 'CGST %', format: '0.00' },
            { name: 'cgstAmt', type: 'number', label: 'CGST amount', format: '#,##0.00' },
            { name: 'sgstPerc', type: 'number', label: 'SGST %', format: '0.00' },
            { name: 'sgstAmt', type: 'number', label: 'SGST amount', format: '#,##0.00' },
            { name: 'igstPerc', type: 'number', label: 'IGST %', format: '0.00' },
            { name: 'igstAmt', type: 'number', label: 'IGST amount', format: '#,##0.00' },
            { name: 'cessAmt', type: 'number', label: 'Cess amount', format: '#,##0.00' },
            { name: 'totalTax', type: 'number', label: 'Total tax', format: '#,##0.00' },
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
            select: {
                sbiLineNo: true,
                sbiHsnCode: true,
                sbiTaxPerc: true,
                sbiCgstPerc: true,
                sbiSgstPerc: true,
                sbiIgstPerc: true,
                sbiBillQty: true,
                sbiTaxableAmt: true,
                sbiCgstAmt: true,
                sbiSgstAmt: true,
                sbiIgstAmt: true,
                sbiCessAmt: true,
                sbiAcessAmt: true,
                sbiTaxAmt: true,
            },
        });
        const buckets = new Map();
        for (const allocation of allocations) {
            const hsnCode = (0, provider_utils_1.toText)(allocation.sbiHsnCode);
            const taxPerc = (0, provider_utils_1.toNumber)(allocation.sbiTaxPerc);
            const key = `${hsnCode}|${taxPerc.toFixed(4)}`;
            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = {
                    hsnCode,
                    taxPerc,
                    cgstPerc: (0, provider_utils_1.toNumber)(allocation.sbiCgstPerc),
                    sgstPerc: (0, provider_utils_1.toNumber)(allocation.sbiSgstPerc),
                    igstPerc: (0, provider_utils_1.toNumber)(allocation.sbiIgstPerc),
                    lines: new Set(),
                    qty: 0,
                    taxableAmt: 0,
                    cgstAmt: 0,
                    sgstAmt: 0,
                    igstAmt: 0,
                    cessAmt: 0,
                    totalTax: 0,
                };
                buckets.set(key, bucket);
            }
            bucket.lines.add(allocation.sbiLineNo);
            bucket.qty += (0, provider_utils_1.toNumber)(allocation.sbiBillQty);
            bucket.taxableAmt += (0, provider_utils_1.toNumber)(allocation.sbiTaxableAmt);
            bucket.cgstAmt += (0, provider_utils_1.toNumber)(allocation.sbiCgstAmt);
            bucket.sgstAmt += (0, provider_utils_1.toNumber)(allocation.sbiSgstAmt);
            bucket.igstAmt += (0, provider_utils_1.toNumber)(allocation.sbiIgstAmt);
            bucket.cessAmt += (0, provider_utils_1.toNumber)(allocation.sbiCessAmt) + (0, provider_utils_1.toNumber)(allocation.sbiAcessAmt);
            bucket.totalTax += (0, provider_utils_1.toNumber)(allocation.sbiTaxAmt);
        }
        return [...buckets.values()]
            .sort((left, right) => left.hsnCode.localeCompare(right.hsnCode) || left.taxPerc - right.taxPerc)
            .map((bucket, index) => ({
            __index: index + 1,
            hsnCode: bucket.hsnCode,
            taxPerc: bucket.taxPerc,
            lineCount: bucket.lines.size,
            qty: (0, provider_utils_1.round2)(bucket.qty),
            taxableAmt: (0, provider_utils_1.round2)(bucket.taxableAmt),
            cgstPerc: bucket.cgstPerc,
            cgstAmt: (0, provider_utils_1.round2)(bucket.cgstAmt),
            sgstPerc: bucket.sgstPerc,
            sgstAmt: (0, provider_utils_1.round2)(bucket.sgstAmt),
            igstPerc: bucket.igstPerc,
            igstAmt: (0, provider_utils_1.round2)(bucket.igstAmt),
            cessAmt: (0, provider_utils_1.round2)(bucket.cessAmt),
            totalTax: (0, provider_utils_1.round2)(bucket.totalTax),
        }));
    }
    sampleData() {
        const buckets = [
            { hsnCode: '07136000', taxPerc: 5, taxableAmt: 12348 },
            { hsnCode: '10063020', taxPerc: 0, taxableAmt: 13876.8 },
            { hsnCode: '15121110', taxPerc: 5, taxableAmt: 6703.2 },
            { hsnCode: '34012000', taxPerc: 18, taxableAmt: 2408.4 },
        ];
        return buckets.map((bucket, index) => {
            const totalTax = (0, provider_utils_1.round2)((bucket.taxableAmt * bucket.taxPerc) / 100);
            const half = (0, provider_utils_1.round2)(totalTax / 2);
            return {
                __index: index + 1,
                hsnCode: bucket.hsnCode,
                taxPerc: bucket.taxPerc,
                lineCount: 1,
                qty: 0,
                taxableAmt: bucket.taxableAmt,
                cgstPerc: bucket.taxPerc / 2,
                cgstAmt: half,
                sgstPerc: bucket.taxPerc / 2,
                sgstAmt: (0, provider_utils_1.round2)(totalTax - half),
                igstPerc: 0,
                igstAmt: 0,
                cessAmt: 0,
                totalTax,
            };
        });
    }
};
exports.InvoiceTaxSummaryProvider = InvoiceTaxSummaryProvider;
exports.InvoiceTaxSummaryProvider = InvoiceTaxSummaryProvider = __decorate([
    (0, common_1.Injectable)(),
    (0, report_data_provider_decorator_1.ReportDataProvider)('sales.invoice.taxSummary', {
        label: 'Sale invoice — HSN/rate tax summary',
        cardinality: 'many',
        docTypes: ['SALE_INVOICE', 'TAX_INVOICE', 'RETAIL_INVOICE', 'CASH_BILL'],
    }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InvoiceTaxSummaryProvider);
//# sourceMappingURL=invoice-tax-summary.provider.js.map