import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { ReportDataProvider } from '../report-data-provider.decorator';
import {
  FieldMeta,
  IReportDataProvider,
  ReportContext,
  ReportRow,
} from '../report-data-provider.types';
import { round2, round3, toDateOnly, toNullableNumber, toNumber, toText } from '../provider.utils';

/**
 * The printed lines of a sale invoice.
 *
 * ── The batch-allocation collapse ────────────────────────────────────────────
 * sales.sale_bill_item holds ONE ROW PER BATCH ALLOCATION, not per printed
 * line: 30 bags of rice drawn from three batches is three rows sharing one
 * sbi_line_no. The table's own header says so — "Printed line = GROUP BY
 * sbi_line_no".
 *
 * So this provider aggregates by line number. A template that iterated raw rows
 * would print the same item three times with a third of the quantity each, and
 * the customer would count six items on a four-item invoice. The per-allocation
 * detail is still available, deliberately, as `sales.invoice.batchDetail` — a
 * pharmacy invoice has to show batch and expiry per allocation, so both views
 * are first-class rather than one being a workaround for the other.
 *
 * Quantities and amounts SUM across allocations. Rates, percentages and MRP do
 * not: they are identical across a line's allocations by construction, so the
 * first allocation's value is the line's value. Averaging them would introduce
 * a rate the customer never agreed to.
 */
@Injectable()
@ReportDataProvider('sales.invoice.lines', {
  label: 'Sale invoice — printed lines',
  cardinality: 'many',
  docTypes: ['SALE_INVOICE', 'TAX_INVOICE', 'RETAIL_INVOICE', 'CASH_BILL'],
})
export class InvoiceLinesProvider implements IReportDataProvider {
  constructor(private readonly prisma: PrismaService) {}

  fields(): readonly FieldMeta[] {
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

  async resolve(context: ReportContext): Promise<ReportRow[]> {
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

    // Group by printed line, preserving the query's line/split ordering.
    const byLine = new Map<number, typeof allocations>();
    for (const allocation of allocations) {
      const bucket = byLine.get(allocation.sbiLineNo);
      if (bucket) {
        bucket.push(allocation);
      } else {
        byLine.set(allocation.sbiLineNo, [allocation]);
      }
    }

    const lines: ReportRow[] = [];
    let serial = 0;

    for (const [lineNo, group] of [...byLine.entries()].sort(([left], [right]) => left - right)) {
      // The first allocation carries every per-line attribute: item, rate,
      // percentages, MRP. They are identical across the group by construction.
      const first = group[0];
      serial += 1;

      const sum = (pick: (allocation: (typeof group)[number]) => number): number =>
        group.reduce((total, allocation) => total + pick(allocation), 0);

      const batchNos = group
        .map((allocation) => toText(allocation.sbiBatchNo).trim())
        .filter(Boolean);

      const expiryDates = group
        .map((allocation) => allocation.sbiExpiryDate)
        .filter((value): value is Date => value instanceof Date);

      const grossAmt = round2(sum((allocation) => toNumber(allocation.sbiGrossAmt)));
      const discAmt = round2(
        sum(
          (allocation) =>
            toNumber(allocation.sbiItemDiscAmt) +
            toNumber(allocation.sbiSplDiscAmt) +
            toNumber(allocation.sbiAddlDisc1Amt) +
            toNumber(allocation.sbiAddlDisc2Amt) +
            toNumber(allocation.sbiCashDiscAmt),
        ),
      );

      const unitName = toText(
        first.itemUnitConversion?.unit?.unit_alias || first.itemUnitConversion?.unit?.unit_name,
      );

      const itemNameEn = toText(first.item?.itemNameEn);
      const itemNameTa = toText(first.item?.itemNameTa);

      lines.push({
        __index: serial,
        lineNo,
        itemId: first.sbiItemId,
        itemCode: toText(first.item?.itemCode),
        itemName: itemNameEn,
        itemNameTamil: itemNameTa,
        // What a template should bind by default: the Tamil name when the item
        // has one, else English. Keeping both available means a bilingual
        // invoice can print them on two lines.
        itemPrintName: itemNameTa || itemNameEn,
        hsnCode: toText(first.sbiHsnCode),
        eanCode: toText(first.sbiEanCode),
        unitName,
        size: toText(first.sbiSize),
        sizeUom: toText(first.sbiSizeUom),

        batchCount: group.length,
        batchNos: batchNos.join(', '),
        earliestExpiry:
          expiryDates.length > 0
            ? toDateOnly(new Date(Math.min(...expiryDates.map((date) => date.getTime()))))
            : null,

        caseQty: round3(sum((allocation) => toNumber(allocation.sbiCaseQty))),
        qty: round3(sum((allocation) => toNumber(allocation.sbiBillQty))),
        netQty: round3(sum((allocation) => toNumber(allocation.sbiNetQty))),
        weightQty: round3(sum((allocation) => toNumber(allocation.sbiWeightQty))),
        // A free line's quantity IS its free quantity; there is no separate
        // column on the item table.
        freeQty: round3(
          sum((allocation) => (allocation.sbiIsFree ? toNumber(allocation.sbiBillQty) : 0)),
        ),

        rate: toNumber(first.sbiRate),
        ratePreTax: toNumber(first.sbiRatePreTax),
        mrp: toNullableNumber(first.sbiMaxPrice) ?? 0,

        grossAmt,
        discPerc: toNumber(first.sbiItemDiscPerc),
        discAmt,
        schDiscAmt: round2(
          sum(
            (allocation) => toNumber(allocation.sbiSchDiscAmt) + toNumber(allocation.sbiBillSchAmt),
          ),
        ),
        taxableAmt: round2(sum((allocation) => toNumber(allocation.sbiTaxableAmt))),
        taxPerc: toNumber(first.sbiTaxPerc),
        cgstPerc: toNumber(first.sbiCgstPerc),
        cgstAmt: round2(sum((allocation) => toNumber(allocation.sbiCgstAmt))),
        sgstPerc: toNumber(first.sbiSgstPerc),
        sgstAmt: round2(sum((allocation) => toNumber(allocation.sbiSgstAmt))),
        igstPerc: toNumber(first.sbiIgstPerc),
        igstAmt: round2(sum((allocation) => toNumber(allocation.sbiIgstAmt))),
        cessAmt: round2(
          sum((allocation) => toNumber(allocation.sbiCessAmt) + toNumber(allocation.sbiAcessAmt)),
        ),
        taxAmt: round2(sum((allocation) => toNumber(allocation.sbiTaxAmt))),
        freightAmt: round2(sum((allocation) => toNumber(allocation.sbiFreightAmt))),
        netAmount: round2(sum((allocation) => toNumber(allocation.sbiNetAmt))),

        isFree: group.every((allocation) => allocation.sbiIsFree),
        isPromo: group.some((allocation) => allocation.sbiIsPromo),
        isService: first.sbiIsService,
        schemeName: toText(first.sbiSchemeName),
        remarks: toText(first.sbiRemarks),
        mrpSavings: round2(sum((allocation) => toNumber(allocation.sbiMrpSavings))),
      });
    }

    return lines;
  }

  sampleData(): ReportRow[] {
    // Deliberately awkward sample data: a long Tamil item name to exercise
    // autoGrow and the font-fallback path, a multi-batch line, a free line, a
    // negative-discount line, and two HSN codes so grouping has something to
    // group. A tidy sample makes a template look correct that is not.
    const rows: Array<Partial<ReportRow> & { itemName: string }> = [
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
        itemName:
          'Toor Dal Premium — extra long descriptive name to force the wrap and autoGrow path',
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
      const grossAmt = round2(qty * rate);
      const discAmt = row.isFree ? 0 : round2(grossAmt * 0.02);
      const taxableAmt = round2(grossAmt - discAmt);
      const taxAmt = round2((taxableAmt * taxPerc) / 100);
      const halfTax = round2(taxAmt / 2);

      return {
        __index: index + 1,
        lineNo: index + 1,
        itemId: `01920000-0000-7000-8000-00000000010${index}`,
        itemCode: row.itemCode ?? '',
        itemName: row.itemName,
        itemNameTamil: row.itemNameTamil ?? '',
        itemPrintName: (row.itemNameTamil as string) || row.itemName,
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
        ratePreTax: round2(rate / (1 + taxPerc / 100)),
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
        sgstAmt: round2(taxAmt - halfTax),
        igstPerc: 0,
        igstAmt: 0,
        cessAmt: 0,
        taxAmt,
        freightAmt: 0,
        netAmount: round2(taxableAmt + taxAmt),
        isFree: Boolean(row.isFree),
        isPromo: Boolean(row.isPromo),
        isService: false,
        schemeName: row.schemeName ?? '',
        remarks: '',
        mrpSavings: round2(Math.max(0, (Number(row.mrp ?? 0) - rate) * qty)),
      };
    });
  }
}
