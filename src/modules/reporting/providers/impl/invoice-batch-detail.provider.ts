import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { ReportDataProvider } from '../report-data-provider.decorator';
import {
  FieldMeta,
  IReportDataProvider,
  ReportContext,
  ReportRow,
} from '../report-data-provider.types';
import { toDateOnly, toNumber, toText } from '../provider.utils';

/**
 * Per-allocation batch detail — the raw sale_bill_item rows.
 *
 * The counterpart to sales.invoice.lines, which collapses these into printed
 * lines. Both exist because both are legitimate: a grocery invoice wants one
 * line per item, and a pharmacy or agri-input invoice must show batch number
 * and expiry per allocation because that is a drug-rules requirement.
 *
 * A template binds a DETAIL band to whichever it needs, or nests: lines as the
 * outer group with batchDetail underneath. That nesting is what the two-level
 * group support in the layout engine is for.
 */
@Injectable()
@ReportDataProvider('sales.invoice.batchDetail', {
  label: 'Sale invoice — batch allocations',
  cardinality: 'many',
  docTypes: ['SALE_INVOICE', 'TAX_INVOICE', 'RETAIL_INVOICE', 'CASH_BILL'],
})
export class InvoiceBatchDetailProvider implements IReportDataProvider {
  constructor(private readonly prisma: PrismaService) {}

  fields(): readonly FieldMeta[] {
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
        item: { select: { itemCode: true, itemNameEn: true, itemNameTa: true } },
      },
    });

    return allocations.map((allocation, index) => ({
      __index: index + 1,
      lineNo: allocation.sbiLineNo,
      splitNo: allocation.sbiSplitNo,
      itemCode: toText(allocation.item?.itemCode),
      itemName: toText(allocation.item?.itemNameTa || allocation.item?.itemNameEn),
      hsnCode: toText(allocation.sbiHsnCode),
      batchNo: toText(allocation.sbiBatchNo),
      batchDate: toDateOnly(allocation.sbiBatchDate),
      expiryDate: toDateOnly(allocation.sbiExpiryDate),
      serialNo: toText(allocation.sbiSerialNo),
      godownId: allocation.sbiGodownId,
      qty: toNumber(allocation.sbiBillQty),
      rate: toNumber(allocation.sbiRate),
      mrp: toNumber(allocation.sbiMaxPrice),
      taxableAmt: toNumber(allocation.sbiTaxableAmt),
      taxAmt: toNumber(allocation.sbiTaxAmt),
      netAmount: toNumber(allocation.sbiNetAmt),
    }));
  }

  sampleData(): ReportRow[] {
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
}
