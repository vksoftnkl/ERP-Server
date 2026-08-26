import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { ReportDataProvider } from '../report-data-provider.decorator';
import {
  FieldMeta,
  IReportDataProvider,
  ReportContext,
  ReportRow,
} from '../report-data-provider.types';
import { round2, toNumber, toText } from '../provider.utils';

/**
 * The HSN-wise tax summary block.
 *
 * Rule 46(c) of the CGST Rules requires a tax invoice to carry the HSN code and
 * the taxable value and tax amount PER RATE. That is what this provider is: one
 * row per (HSN, rate) pair, which is the granularity the summary table on the
 * bottom of every GST invoice is printed at.
 *
 * Aggregating in Node rather than in SQL is deliberate. The rows have already
 * been fetched for the lines provider in the same request, the row count is
 * bounded by the line count, and a groupBy in SQL would need a second
 * round-trip against a partitioned table for no measurable gain.
 */
@Injectable()
@ReportDataProvider('sales.invoice.taxSummary', {
  label: 'Sale invoice — HSN/rate tax summary',
  cardinality: 'many',
  docTypes: ['SALE_INVOICE', 'TAX_INVOICE', 'RETAIL_INVOICE', 'CASH_BILL'],
})
export class InvoiceTaxSummaryProvider implements IReportDataProvider {
  constructor(private readonly prisma: PrismaService) {}

  fields(): readonly FieldMeta[] {
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

    interface Bucket {
      hsnCode: string;
      taxPerc: number;
      cgstPerc: number;
      sgstPerc: number;
      igstPerc: number;
      lines: Set<number>;
      qty: number;
      taxableAmt: number;
      cgstAmt: number;
      sgstAmt: number;
      igstAmt: number;
      cessAmt: number;
      totalTax: number;
    }

    const buckets = new Map<string, Bucket>();

    for (const allocation of allocations) {
      const hsnCode = toText(allocation.sbiHsnCode);
      const taxPerc = toNumber(allocation.sbiTaxPerc);
      // Rate is part of the key, not just HSN: the same HSN can legitimately
      // carry two rates on one invoice when a rate change straddles the
      // billing date, and merging them would misstate both.
      const key = `${hsnCode}|${taxPerc.toFixed(4)}`;

      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          hsnCode,
          taxPerc,
          cgstPerc: toNumber(allocation.sbiCgstPerc),
          sgstPerc: toNumber(allocation.sbiSgstPerc),
          igstPerc: toNumber(allocation.sbiIgstPerc),
          lines: new Set<number>(),
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

      // Counts DISTINCT printed lines, not allocation rows: a three-batch line
      // is one line on the invoice and must count as one here too.
      bucket.lines.add(allocation.sbiLineNo);
      bucket.qty += toNumber(allocation.sbiBillQty);
      bucket.taxableAmt += toNumber(allocation.sbiTaxableAmt);
      bucket.cgstAmt += toNumber(allocation.sbiCgstAmt);
      bucket.sgstAmt += toNumber(allocation.sbiSgstAmt);
      bucket.igstAmt += toNumber(allocation.sbiIgstAmt);
      bucket.cessAmt += toNumber(allocation.sbiCessAmt) + toNumber(allocation.sbiAcessAmt);
      bucket.totalTax += toNumber(allocation.sbiTaxAmt);
    }

    return [...buckets.values()]
      .sort(
        (left, right) => left.hsnCode.localeCompare(right.hsnCode) || left.taxPerc - right.taxPerc,
      )
      .map((bucket, index) => ({
        __index: index + 1,
        hsnCode: bucket.hsnCode,
        taxPerc: bucket.taxPerc,
        lineCount: bucket.lines.size,
        qty: round2(bucket.qty),
        taxableAmt: round2(bucket.taxableAmt),
        cgstPerc: bucket.cgstPerc,
        cgstAmt: round2(bucket.cgstAmt),
        sgstPerc: bucket.sgstPerc,
        sgstAmt: round2(bucket.sgstAmt),
        igstPerc: bucket.igstPerc,
        igstAmt: round2(bucket.igstAmt),
        cessAmt: round2(bucket.cessAmt),
        totalTax: round2(bucket.totalTax),
      }));
  }

  sampleData(): ReportRow[] {
    const buckets = [
      { hsnCode: '07136000', taxPerc: 5, taxableAmt: 12348 },
      { hsnCode: '10063020', taxPerc: 0, taxableAmt: 13876.8 },
      { hsnCode: '15121110', taxPerc: 5, taxableAmt: 6703.2 },
      { hsnCode: '34012000', taxPerc: 18, taxableAmt: 2408.4 },
    ];

    return buckets.map((bucket, index) => {
      const totalTax = round2((bucket.taxableAmt * bucket.taxPerc) / 100);
      const half = round2(totalTax / 2);
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
        sgstAmt: round2(totalTax - half),
        igstPerc: 0,
        igstAmt: 0,
        cessAmt: 0,
        totalTax,
      };
    });
  }
}
