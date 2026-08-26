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
exports.InvoiceLinesProvider = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../../database/prisma/prisma.service");
const report_data_provider_decorator_1 = require("../report-data-provider.decorator");
const provider_utils_1 = require("../provider.utils");
let InvoiceLinesProvider = class InvoiceLinesProvider {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    fields() {
        return [
            { name: '__index', type: 'integer', label: 'Serial number (1-based)' },
            { name: 'lineNo', type: 'integer', label: 'Line number' },
            { name: 'itemId', type: 'string', label: 'Item id' },
            { name: 'itemCode', type: 'string', label: 'Item code' },
            { name: 'itemName', type: 'string', label: 'Item name', complexScript: true },
            { name: 'itemNameTamil', type: 'string', label: 'Item name (Tamil)', complexScript: true },
            {
                name: 'itemPrintName',
                type: 'string',
                label: 'Item name for printing',
                complexScript: true,
            },
            { name: 'hsnCode', type: 'string', label: 'HSN code' },
            { name: 'eanCode', type: 'string', label: 'EAN / barcode' },
            { name: 'unitName', type: 'string', label: 'Unit' },
            { name: 'size', type: 'string', label: 'Size (as typed)' },
            { name: 'sizeUom', type: 'string', label: 'Size UOM' },
            { name: 'batchCount', type: 'integer', label: 'Batch allocations in this line' },
            { name: 'batchNos', type: 'string', label: 'Batch numbers (comma separated)' },
            { name: 'earliestExpiry', type: 'date', label: 'Earliest expiry', format: 'dd-MM-yyyy' },
            { name: 'caseQty', type: 'number', label: 'Case quantity', format: '0.000' },
            { name: 'qty', type: 'number', label: 'Billed quantity', format: '0.000' },
            { name: 'netQty', type: 'number', label: 'Net quantity', format: '0.000' },
            { name: 'weightQty', type: 'number', label: 'Weight', format: '0.000' },
            { name: 'freeQty', type: 'number', label: 'Free quantity', format: '0.000' },
            { name: 'rate', type: 'number', label: 'Rate', format: '#,##0.00' },
            { name: 'ratePreTax', type: 'number', label: 'Rate (pre-tax)', format: '#,##0.00' },
            { name: 'mrp', type: 'number', label: 'MRP', format: '#,##0.00' },
            { name: 'grossAmt', type: 'number', label: 'Gross amount', format: '#,##0.00' },
            { name: 'discPerc', type: 'number', label: 'Discount %', format: '0.00' },
            { name: 'discAmt', type: 'number', label: 'Discount amount', format: '#,##0.00' },
            { name: 'schDiscAmt', type: 'number', label: 'Scheme discount', format: '#,##0.00' },
            { name: 'taxableAmt', type: 'number', label: 'Taxable amount', format: '#,##0.00' },
            { name: 'taxPerc', type: 'number', label: 'Tax %', format: '0.00' },
            { name: 'cgstPerc', type: 'number', label: 'CGST %', format: '0.00' },
            { name: 'cgstAmt', type: 'number', label: 'CGST amount', format: '#,##0.00' },
            { name: 'sgstPerc', type: 'number', label: 'SGST %', format: '0.00' },
            { name: 'sgstAmt', type: 'number', label: 'SGST amount', format: '#,##0.00' },
            { name: 'igstPerc', type: 'number', label: 'IGST %', format: '0.00' },
            { name: 'igstAmt', type: 'number', label: 'IGST amount', format: '#,##0.00' },
            { name: 'cessAmt', type: 'number', label: 'Cess amount', format: '#,##0.00' },
            { name: 'taxAmt', type: 'number', label: 'Total tax', format: '#,##0.00' },
            { name: 'freightAmt', type: 'number', label: 'Freight share', format: '#,##0.00' },
            { name: 'netAmount', type: 'number', label: 'Net amount', format: '#,##0.00' },
            { name: 'isFree', type: 'boolean', label: 'Free line' },
            { name: 'isPromo', type: 'boolean', label: 'Promotion applied' },
            { name: 'isService', type: 'boolean', label: 'Service line' },
            { name: 'schemeName', type: 'string', label: 'Scheme name' },
            { name: 'remarks', type: 'string', label: 'Line remarks' },
            { name: 'mrpSavings', type: 'number', label: 'MRP savings', format: '#,##0.00' },
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
                item: {
                    select: { itemCode: true, itemNameEn: true, itemNameTa: true },
                },
                itemUnitConversion: {
                    select: { unit: { select: { unit_name: true, unit_alias: true } } },
                },
            },
        });
        const byLine = new Map();
        for (const allocation of allocations) {
            const bucket = byLine.get(allocation.sbiLineNo);
            if (bucket) {
                bucket.push(allocation);
            }
            else {
                byLine.set(allocation.sbiLineNo, [allocation]);
            }
        }
        const lines = [];
        let serial = 0;
        for (const [lineNo, group] of [...byLine.entries()].sort(([left], [right]) => left - right)) {
            const first = group[0];
            serial += 1;
            const sum = (pick) => group.reduce((total, allocation) => total + pick(allocation), 0);
            const batchNos = group
                .map((allocation) => (0, provider_utils_1.toText)(allocation.sbiBatchNo).trim())
                .filter(Boolean);
            const expiryDates = group
                .map((allocation) => allocation.sbiExpiryDate)
                .filter((value) => value instanceof Date);
            const grossAmt = (0, provider_utils_1.round2)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiGrossAmt)));
            const discAmt = (0, provider_utils_1.round2)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiItemDiscAmt) +
                (0, provider_utils_1.toNumber)(allocation.sbiSplDiscAmt) +
                (0, provider_utils_1.toNumber)(allocation.sbiAddlDisc1Amt) +
                (0, provider_utils_1.toNumber)(allocation.sbiAddlDisc2Amt) +
                (0, provider_utils_1.toNumber)(allocation.sbiCashDiscAmt)));
            const unitName = (0, provider_utils_1.toText)(first.itemUnitConversion?.unit?.unit_alias || first.itemUnitConversion?.unit?.unit_name);
            const itemNameEn = (0, provider_utils_1.toText)(first.item?.itemNameEn);
            const itemNameTa = (0, provider_utils_1.toText)(first.item?.itemNameTa);
            lines.push({
                __index: serial,
                lineNo,
                itemId: first.sbiItemId,
                itemCode: (0, provider_utils_1.toText)(first.item?.itemCode),
                itemName: itemNameEn,
                itemNameTamil: itemNameTa,
                itemPrintName: itemNameTa || itemNameEn,
                hsnCode: (0, provider_utils_1.toText)(first.sbiHsnCode),
                eanCode: (0, provider_utils_1.toText)(first.sbiEanCode),
                unitName,
                size: (0, provider_utils_1.toText)(first.sbiSize),
                sizeUom: (0, provider_utils_1.toText)(first.sbiSizeUom),
                batchCount: group.length,
                batchNos: batchNos.join(', '),
                earliestExpiry: expiryDates.length > 0
                    ? (0, provider_utils_1.toDateOnly)(new Date(Math.min(...expiryDates.map((date) => date.getTime()))))
                    : null,
                caseQty: (0, provider_utils_1.round3)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiCaseQty))),
                qty: (0, provider_utils_1.round3)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiBillQty))),
                netQty: (0, provider_utils_1.round3)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiNetQty))),
                weightQty: (0, provider_utils_1.round3)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiWeightQty))),
                freeQty: (0, provider_utils_1.round3)(sum((allocation) => (allocation.sbiIsFree ? (0, provider_utils_1.toNumber)(allocation.sbiBillQty) : 0))),
                rate: (0, provider_utils_1.toNumber)(first.sbiRate),
                ratePreTax: (0, provider_utils_1.toNumber)(first.sbiRatePreTax),
                mrp: (0, provider_utils_1.toNullableNumber)(first.sbiMaxPrice) ?? 0,
                grossAmt,
                discPerc: (0, provider_utils_1.toNumber)(first.sbiItemDiscPerc),
                discAmt,
                schDiscAmt: (0, provider_utils_1.round2)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiSchDiscAmt) + (0, provider_utils_1.toNumber)(allocation.sbiBillSchAmt))),
                taxableAmt: (0, provider_utils_1.round2)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiTaxableAmt))),
                taxPerc: (0, provider_utils_1.toNumber)(first.sbiTaxPerc),
                cgstPerc: (0, provider_utils_1.toNumber)(first.sbiCgstPerc),
                cgstAmt: (0, provider_utils_1.round2)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiCgstAmt))),
                sgstPerc: (0, provider_utils_1.toNumber)(first.sbiSgstPerc),
                sgstAmt: (0, provider_utils_1.round2)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiSgstAmt))),
                igstPerc: (0, provider_utils_1.toNumber)(first.sbiIgstPerc),
                igstAmt: (0, provider_utils_1.round2)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiIgstAmt))),
                cessAmt: (0, provider_utils_1.round2)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiCessAmt) + (0, provider_utils_1.toNumber)(allocation.sbiAcessAmt))),
                taxAmt: (0, provider_utils_1.round2)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiTaxAmt))),
                freightAmt: (0, provider_utils_1.round2)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiFreightAmt))),
                netAmount: (0, provider_utils_1.round2)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiNetAmt))),
                isFree: group.every((allocation) => allocation.sbiIsFree),
                isPromo: group.some((allocation) => allocation.sbiIsPromo),
                isService: first.sbiIsService,
                schemeName: (0, provider_utils_1.toText)(first.sbiSchemeName),
                remarks: (0, provider_utils_1.toText)(first.sbiRemarks),
                mrpSavings: (0, provider_utils_1.round2)(sum((allocation) => (0, provider_utils_1.toNumber)(allocation.sbiMrpSavings))),
            });
        }
        return lines;
    }
    sampleData() {
        const rows = [
            {
                itemName: 'Ponni Raw Rice 25kg Bag',
                itemNameTamil: 'பொன்னி பச்சரிசி 25 கிலோ மூட்டை',
                itemCode: 'RICE-PON-25',
                hsnCode: '10063020',
                unitName: 'BAG',
                qty: 12,
                rate: 1180,
                mrp: 1250,
                taxPerc: 0,
                batchCount: 2,
                batchNos: 'B-2608A, B-2608B',
            },
            {
                itemName: 'Sunflower Oil 1L Pouch',
                itemNameTamil: 'சூரியகாந்தி எண்ணெய் 1 லிட்டர்',
                itemCode: 'OIL-SUN-1L',
                hsnCode: '15121110',
                unitName: 'PKT',
                qty: 48,
                rate: 142.5,
                mrp: 160,
                taxPerc: 5,
                batchCount: 1,
                batchNos: 'SO-0826',
            },
            {
                itemName: 'Toor Dal Premium — extra long descriptive name to force the wrap and autoGrow path',
                itemNameTamil: 'துவரம் பருப்பு பிரீமியம் தரம் ஒன்று',
                itemCode: 'DAL-TOOR-P',
                hsnCode: '07136000',
                unitName: 'KG',
                qty: 75,
                rate: 168,
                mrp: 185,
                taxPerc: 5,
                batchCount: 3,
                batchNos: 'TD-01, TD-02, TD-03',
            },
            {
                itemName: 'Detergent Bar 250g',
                itemCode: 'DET-BAR-250',
                hsnCode: '34012000',
                unitName: 'PCS',
                qty: 120,
                rate: 22,
                mrp: 25,
                taxPerc: 18,
                batchCount: 1,
            },
            {
                itemName: 'Detergent Bar 250g (scheme free)',
                itemCode: 'DET-BAR-250',
                hsnCode: '34012000',
                unitName: 'PCS',
                qty: 10,
                rate: 0,
                mrp: 25,
                taxPerc: 18,
                isFree: true,
                isPromo: true,
                schemeName: 'Buy 12 get 1',
                batchCount: 1,
            },
            {
                itemName: 'Rate difference adjustment',
                itemCode: 'ADJ-RATE',
                hsnCode: '34012000',
                unitName: 'PCS',
                qty: 1,
                rate: -180,
                mrp: 0,
                taxPerc: 18,
                batchCount: 1,
            },
        ];
        return rows.map((row, index) => {
            const qty = Number(row.qty ?? 0);
            const rate = Number(row.rate ?? 0);
            const taxPerc = Number(row.taxPerc ?? 0);
            const grossAmt = (0, provider_utils_1.round2)(qty * rate);
            const discAmt = row.isFree ? 0 : (0, provider_utils_1.round2)(grossAmt * 0.02);
            const taxableAmt = (0, provider_utils_1.round2)(grossAmt - discAmt);
            const taxAmt = (0, provider_utils_1.round2)((taxableAmt * taxPerc) / 100);
            const halfTax = (0, provider_utils_1.round2)(taxAmt / 2);
            return {
                __index: index + 1,
                lineNo: index + 1,
                itemId: `01920000-0000-7000-8000-00000000010${index}`,
                itemCode: row.itemCode ?? '',
                itemName: row.itemName,
                itemNameTamil: row.itemNameTamil ?? '',
                itemPrintName: row.itemNameTamil || row.itemName,
                hsnCode: row.hsnCode ?? '',
                eanCode: '',
                unitName: row.unitName ?? 'PCS',
                size: '',
                sizeUom: '',
                batchCount: row.batchCount ?? 1,
                batchNos: row.batchNos ?? '',
                earliestExpiry: null,
                caseQty: 0,
                qty,
                netQty: qty,
                weightQty: 0,
                freeQty: row.isFree ? qty : 0,
                rate,
                ratePreTax: (0, provider_utils_1.round2)(rate / (1 + taxPerc / 100)),
                mrp: Number(row.mrp ?? 0),
                grossAmt,
                discPerc: row.isFree ? 0 : 2,
                discAmt,
                schDiscAmt: 0,
                taxableAmt,
                taxPerc,
                cgstPerc: taxPerc / 2,
                cgstAmt: halfTax,
                sgstPerc: taxPerc / 2,
                sgstAmt: (0, provider_utils_1.round2)(taxAmt - halfTax),
                igstPerc: 0,
                igstAmt: 0,
                cessAmt: 0,
                taxAmt,
                freightAmt: 0,
                netAmount: (0, provider_utils_1.round2)(taxableAmt + taxAmt),
                isFree: Boolean(row.isFree),
                isPromo: Boolean(row.isPromo),
                isService: false,
                schemeName: row.schemeName ?? '',
                remarks: '',
                mrpSavings: (0, provider_utils_1.round2)(Math.max(0, (Number(row.mrp ?? 0) - rate) * qty)),
            };
        });
    }
};
exports.InvoiceLinesProvider = InvoiceLinesProvider;
exports.InvoiceLinesProvider = InvoiceLinesProvider = __decorate([
    (0, common_1.Injectable)(),
    (0, report_data_provider_decorator_1.ReportDataProvider)('sales.invoice.lines', {
        label: 'Sale invoice — printed lines',
        cardinality: 'many',
        docTypes: ['SALE_INVOICE', 'TAX_INVOICE', 'RETAIL_INVOICE', 'CASH_BILL'],
    }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InvoiceLinesProvider);
//# sourceMappingURL=invoice-lines.provider.js.map