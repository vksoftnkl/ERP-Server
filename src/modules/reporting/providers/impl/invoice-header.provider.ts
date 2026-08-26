import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { ReportDataProvider } from '../report-data-provider.decorator';
import {
  FieldMeta,
  IReportDataProvider,
  ReportContext,
  ReportRow,
} from '../report-data-provider.types';
import { toBigIntText, toDateOnly, toIsoDateTime, toNumber, toText } from '../provider.utils';

/**
 * The sale invoice header.
 *
 * Reads sales.sale_bill, which is PARTITIONED BY sb_acc_year and carries the
 * composite key (sb_id, sb_acc_year). Both halves are required: querying on
 * sb_id alone forces a scan of every partition, and on a customer with five
 * years of history that turns a 2ms header read into a sequential scan per
 * print. ctx.accYear supplies the second half.
 *
 * The customer block comes from the SNAPSHOT columns on the bill, not from a
 * join to sales.customer. A reprint of a two-year-old invoice must show the
 * name, address and GSTIN as they were when the document was raised — that is
 * what makes it a legal record rather than a report.
 */
@Injectable()
@ReportDataProvider('sales.invoice.header', {
  label: 'Sale invoice — header',
  cardinality: 'one',
  docTypes: ['SALE_INVOICE', 'TAX_INVOICE', 'RETAIL_INVOICE', 'CASH_BILL'],
})
export class InvoiceHeaderProvider implements IReportDataProvider {
  constructor(private readonly prisma: PrismaService) {}

  fields(): readonly FieldMeta[] {
    return [
      { name: 'billId', type: 'string', label: 'Bill id' },
      { name: 'accYear', type: 'string', label: 'Accounting year' },
      { name: 'docType', type: 'string', label: 'Document type' },
      { name: 'billType', type: 'string', label: 'Bill type (CASH/CREDIT)' },
      { name: 'billNo', type: 'string', label: 'Bill number' },
      { name: 'billSerial', type: 'string', label: 'Bill serial number' },
      { name: 'userRefNo', type: 'string', label: 'User reference number' },
      { name: 'billDate', type: 'date', label: 'Bill date', format: 'dd-MM-yyyy' },
      {
        name: 'billDateTime',
        type: 'datetime',
        label: 'Bill date and time',
        format: 'dd-MM-yyyy HH:mm',
      },
      { name: 'dueDate', type: 'date', label: 'Due date', format: 'dd-MM-yyyy' },
      { name: 'dueDays', type: 'integer', label: 'Credit days' },
      { name: 'srcDocType', type: 'string', label: 'Source document type' },
      { name: 'srcDocRefNo', type: 'string', label: 'Source document reference' },
      { name: 'srcDocDate', type: 'date', label: 'Source document date', format: 'dd-MM-yyyy' },

      { name: 'custName', type: 'string', label: 'Customer name', complexScript: true },
      { name: 'custAddress', type: 'string', label: 'Customer address', complexScript: true },
      { name: 'custPlace', type: 'string', label: 'Customer place' },
      { name: 'custPin', type: 'string', label: 'Customer PIN' },
      { name: 'custPhone', type: 'string', label: 'Customer phone' },
      { name: 'custGstin', type: 'string', label: 'Customer GSTIN' },
      { name: 'custGstType', type: 'string', label: 'Customer GST type' },
      { name: 'custStateCode', type: 'string', label: 'Customer state code' },
      { name: 'posStateCode', type: 'string', label: 'Place of supply state code' },
      { name: 'stateName', type: 'string', label: 'State name' },
      { name: 'interState', type: 'boolean', label: 'Inter-state supply (IGST)' },

      { name: 'vehicleNo', type: 'string', label: 'Vehicle number' },
      { name: 'totItems', type: 'integer', label: 'Total line count' },
      { name: 'totWeight', type: 'number', label: 'Total weight', format: '0.000' },
      { name: 'totBags', type: 'number', label: 'Total bags', format: '0.000' },

      { name: 'grossAmt', type: 'number', label: 'Gross amount', format: '#,##0.00' },
      { name: 'itemDisc', type: 'number', label: 'Item discount', format: '#,##0.00' },
      { name: 'splDisc', type: 'number', label: 'Special discount', format: '#,##0.00' },
      { name: 'schDisc', type: 'number', label: 'Scheme discount', format: '#,##0.00' },
      { name: 'cashDisc', type: 'number', label: 'Cash discount', format: '#,##0.00' },
      { name: 'totalDisc', type: 'number', label: 'Total discount', format: '#,##0.00' },
      { name: 'taxableAmt', type: 'number', label: 'Taxable amount', format: '#,##0.00' },
      { name: 'cgstAmt', type: 'number', label: 'CGST amount', format: '#,##0.00' },
      { name: 'sgstAmt', type: 'number', label: 'SGST amount', format: '#,##0.00' },
      { name: 'igstAmt', type: 'number', label: 'IGST amount', format: '#,##0.00' },
      { name: 'cessAmt', type: 'number', label: 'Cess amount', format: '#,##0.00' },
      { name: 'taxAmt', type: 'number', label: 'Total tax', format: '#,##0.00' },
      { name: 'freightAmt', type: 'number', label: 'Freight', format: '#,##0.00' },
      { name: 'loadAmt', type: 'number', label: 'Loading charges', format: '#,##0.00' },
      { name: 'unloadAmt', type: 'number', label: 'Unloading charges', format: '#,##0.00' },
      { name: 'roundOff', type: 'number', label: 'Round off', format: '#,##0.00' },
      { name: 'billAmt', type: 'number', label: 'Bill amount', format: '#,##0.00' },

      { name: 'paidAmt', type: 'number', label: 'Paid amount', format: '#,##0.00' },
      { name: 'balanceAmt', type: 'number', label: 'Balance amount', format: '#,##0.00' },
      { name: 'creditAmt', type: 'number', label: 'Credit amount', format: '#,##0.00' },
      { name: 'payMode', type: 'string', label: 'Payment mode' },
      { name: 'payStatus', type: 'string', label: 'Payment status' },
      { name: 'mrpSavings', type: 'number', label: 'MRP savings', format: '#,##0.00' },

      { name: 'paymentTerms', type: 'string', label: 'Payment terms' },
      { name: 'deliveryTerms', type: 'string', label: 'Delivery terms' },
      { name: 'termsConditions', type: 'string', label: 'Terms and conditions' },
      { name: 'remarks', type: 'string', label: 'Remarks' },
      { name: 'status', type: 'string', label: 'Document status' },
      { name: 'isCancelled', type: 'boolean', label: 'Cancelled' },
      { name: 'printCount', type: 'integer', label: 'Times printed' },
      { name: 'isReprint', type: 'boolean', label: 'Is a reprint' },
    ];
  }

  async resolve(context: ReportContext): Promise<ReportRow> {
    if (!context.docId) {
      throw new NotFoundException('sales.invoice.header requires a document id');
    }

    const bill = await this.prisma.saleBill.findFirst({
      where: {
        sbId: context.docId,
        sbAccYear: context.accYear,
        sbCompanyId: context.companyId,
        sbIsDeleted: false,
      },
    });

    if (!bill) {
      throw new NotFoundException(
        `Sale invoice ${context.docId} not found in accounting year ${context.accYear}`,
      );
    }

    const totalDisc =
      toNumber(bill.sbItemDisc) +
      toNumber(bill.sbSplDisc) +
      toNumber(bill.sbSchDisc) +
      toNumber(bill.sbBillSchDisc) +
      toNumber(bill.sbAddlDisc1) +
      toNumber(bill.sbAddlDisc2) +
      toNumber(bill.sbCashDisc);

    // The place-of-supply test, decided once here so no template has to. IGST
    // having been charged is the authoritative signal — it is what the document
    // actually did — with the state-code comparison as the fallback for a
    // zero-rated or exempt bill where no tax was charged either way.
    const igstAmount = toNumber(bill.sbIgstAmt);
    const posStateCode = toText(bill.sbPosStcd);
    const custStateCode = toText(bill.sbCustStcd);
    const interState =
      igstAmount > 0 ||
      (posStateCode !== '' && custStateCode !== '' && posStateCode !== custStateCode);

    return {
      billId: bill.sbId,
      accYear: bill.sbAccYear,
      docType: toText(bill.sbDocType),
      billType: toText(bill.sbBillType),
      billNo: toText(bill.sbBillRefno),
      billSerial: toBigIntText(bill.sbBillSlno),
      userRefNo: toText(bill.sbUsrRefno),
      billDate: toDateOnly(bill.sbBillDate),
      billDateTime: toIsoDateTime(bill.sbBillDatetime),
      dueDate: toDateOnly(bill.sbDueDate),
      dueDays: bill.sbDueDays ?? 0,
      srcDocType: toText(bill.sbSrcDocType),
      srcDocRefNo: toText(bill.sbSrcDocRefno),
      srcDocDate: toDateOnly(bill.sbSrcDocDate),

      custName: toText(bill.sbCustName),
      custAddress: toText(bill.sbCustAddr),
      custPlace: toText(bill.sbCustPlace),
      custPin: toText(bill.sbCustPin),
      custPhone: toText(bill.sbCustPhone),
      custGstin: toText(bill.sbCustGstin),
      custGstType: toText(bill.sbCustGstType),
      custStateCode,
      posStateCode,
      stateName: toText(bill.sbStateName),
      interState,

      vehicleNo: toText(bill.sbVehicleNo),
      totItems: bill.sbTotItems,
      totWeight: toNumber(bill.sbTotWeight),
      totBags: toNumber(bill.sbTotBags),

      grossAmt: toNumber(bill.sbGrossAmt),
      itemDisc: toNumber(bill.sbItemDisc),
      splDisc: toNumber(bill.sbSplDisc),
      schDisc: toNumber(bill.sbSchDisc),
      cashDisc: toNumber(bill.sbCashDisc),
      totalDisc,
      taxableAmt: toNumber(bill.sbTaxableAmt),
      cgstAmt: toNumber(bill.sbCgstAmt),
      sgstAmt: toNumber(bill.sbSgstAmt),
      igstAmt: igstAmount,
      cessAmt: toNumber(bill.sbCessAmt),
      taxAmt: toNumber(bill.sbTaxAmt),
      freightAmt: toNumber(bill.sbFreightAmt),
      loadAmt: toNumber(bill.sbLoadAmt),
      unloadAmt: toNumber(bill.sbUnloadAmt),
      roundOff: toNumber(bill.sbRoundOff),
      billAmt: toNumber(bill.sbBillAmt),

      paidAmt: toNumber(bill.sbPaidAmt),
      balanceAmt: toNumber(bill.sbBalanceAmt),
      creditAmt: toNumber(bill.sbCreditAmt),
      payMode: toText(bill.sbPayMode),
      payStatus: toText(bill.sbPayStatus),
      mrpSavings: toNumber(bill.sbMrpSavings),

      paymentTerms: toText(bill.sbPaymentTerms),
      deliveryTerms: toText(bill.sbDeliveryTerms),
      termsConditions: toText(bill.sbTermsConditions),
      remarks: toText(bill.sbRemarks),
      status: toText(bill.sbStatus),
      isCancelled: bill.sbCancelledOn !== null,
      printCount: bill.sbPrintCount,
      isReprint: bill.sbPrintCount > 0,
    };
  }

  sampleData(): ReportRow {
    return {
      billId: '01920000-0000-7000-8000-000000000001',
      accYear: '2026-2027',
      docType: 'TAX_INVOICE',
      billType: 'CREDIT',
      billNo: 'SLM/26-27/000148',
      billSerial: '148',
      userRefNo: 'PO-8821',
      billDate: '2026-08-24',
      billDateTime: '2026-08-24T05:32:00.000Z',
      dueDate: '2026-09-23',
      dueDays: 30,
      srcDocType: 'SALE_ORDER',
      srcDocRefNo: 'SO/26-27/000091',
      srcDocDate: '2026-08-20',

      custName: 'Anand Provision Stores',
      custAddress: '18, Bazaar Street, Attur',
      custPlace: 'Attur',
      custPin: '636102',
      custPhone: '9445566778',
      custGstin: '33AAFCA1234D1Z9',
      custGstType: 'REGULAR',
      custStateCode: '33',
      posStateCode: '33',
      stateName: 'Tamil Nadu',
      interState: false,

      vehicleNo: 'TN 30 BC 4471',
      totItems: 6,
      totWeight: 148.5,
      totBags: 12,

      grossAmt: 24800,
      itemDisc: 496,
      splDisc: 0,
      schDisc: 150,
      cashDisc: 0,
      totalDisc: 646,
      taxableAmt: 24154,
      cgstAmt: 1811.55,
      sgstAmt: 1811.55,
      igstAmt: 0,
      cessAmt: 0,
      taxAmt: 3623.1,
      freightAmt: 300,
      loadAmt: 120,
      unloadAmt: 0,
      roundOff: -0.1,
      billAmt: 28197,

      paidAmt: 0,
      balanceAmt: 28197,
      creditAmt: 28197,
      payMode: 'CREDIT',
      payStatus: 'UNPAID',
      mrpSavings: 1240,

      paymentTerms: '30 days from invoice date',
      deliveryTerms: 'Ex-godown',
      termsConditions:
        '1. Goods once sold will not be taken back.\n2. Interest @18% p.a. on overdue bills.\n3. Subject to Salem jurisdiction.',
      remarks: 'Handle rice bags with care',
      status: 'POSTED',
      isCancelled: false,
      printCount: 0,
      isReprint: false,
    };
  }
}
