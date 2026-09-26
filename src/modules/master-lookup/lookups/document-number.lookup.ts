import { MasterErrorDetail, throwMasterNotFound } from '../../../common/utils/module-service.utils';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DocumentNumberQueryDto } from '../dto/document-number-query.dto';
import { DocumentLookupModuleKey, DocumentNumberPayload } from '../types/master-lookup-api.types';
/** What a document resolver hands back, before the acc year is trimmed. */
interface DocumentRow {
  id: string;
  companyId: string;
  branchId: string;
  accYear: string;
}
interface DocumentQuery {
  /** The number as typed, matched against the document's refno column. */
  refno: string;
  /** The same value as a serial when it is all digits, else null. */
  slno: bigint | null;
  companyId: string;
  branchId: string;
}
type DocumentResolver = (
  prisma: PrismaService,
  query: DocumentQuery,
) => Promise<DocumentRow | null>;
/** Label used in the 404 detail, so the message names the table searched. */
const DOCUMENT_LABELS: Record<DocumentLookupModuleKey, string> = {
  saleBill: 'Sale bill',
  saleOrder: 'Sale order',
  saleQuotation: 'Sale quotation',
};
/**
 * Per-module reads. Each is the same shape — refno (plus serial when numeric)
 * within one company/branch, deleted rows excluded — against that module's own
 * columns, ordered newest accounting year first (see {@link DocumentNumberPayload}).
 */
const DOCUMENT_RESOLVERS: Record<DocumentLookupModuleKey, DocumentResolver> = {
  saleBill: async (prisma, { refno, slno, companyId, branchId }) => {
    const row = await prisma.saleBill.findFirst({
      where: {
        sbCompanyId: companyId,
        sbBranchId: branchId,
        sbIsDeleted: false,
        OR: [{ sbBillRefno: refno }, ...(slno === null ? [] : [{ sbBillSlno: slno }])],
      },
      select: { sbId: true, sbCompanyId: true, sbBranchId: true, sbAccYear: true },
      orderBy: [{ sbAccYear: 'desc' }, { sbBillDate: 'desc' }, { sbId: 'desc' }],
    });
    return row
      ? {
          id: row.sbId,
          companyId: row.sbCompanyId,
          branchId: row.sbBranchId,
          accYear: row.sbAccYear,
        }
      : null;
  },
  saleOrder: async (prisma, { refno, slno, companyId, branchId }) => {
    const row = await prisma.saleOrder.findFirst({
      where: {
        soCompanyId: companyId,
        soBranchId: branchId,
        soIsDeleted: false,
        OR: [{ soOrderRefno: refno }, ...(slno === null ? [] : [{ soOrderSlno: slno }])],
      },
      select: { soId: true, soCompanyId: true, soBranchId: true, soAccYear: true },
      orderBy: [{ soAccYear: 'desc' }, { soOrderDate: 'desc' }, { soId: 'desc' }],
    });
    return row
      ? {
          id: row.soId,
          companyId: row.soCompanyId,
          branchId: row.soBranchId,
          accYear: row.soAccYear,
        }
      : null;
  },
  saleQuotation: async (prisma, { refno, slno, companyId, branchId }) => {
    const row = await prisma.saleQuotation.findFirst({
      where: {
        sqCompanyId: companyId,
        sqBranchId: branchId,
        sqIsDeleted: false,
        OR: [{ sqQuoteRefno: refno }, ...(slno === null ? [] : [{ sqQuoteSlno: slno }])],
      },
      // A quotation number is reused across revisions (ux_sq_quote_no keys on
      // sq_revision_no too), so the latest revision is the one meant.
      select: { sqId: true, sqCompanyId: true, sqBranchId: true, sqAccYear: true },
      orderBy: [{ sqAccYear: 'desc' }, { sqRevisionNo: 'desc' }, { sqId: 'desc' }],
    });
    return row
      ? {
          id: row.sqId,
          companyId: row.sqCompanyId,
          branchId: row.sqBranchId,
          accYear: row.sqAccYear,
        }
      : null;
  },
};
/**
 * Resolves a printed sales-document number into the key its row is addressed by.
 *
 * sale_bill, sale_order and sale_quotation are all LIST-partitioned by their
 * accounting year and keyed on (id, acc_year), so a screen that has only the
 * number the user typed cannot open the document without first learning the
 * year — that is what this returns.
 *
 * Matching notes:
 *  - the refno match is exact (case-sensitive), which is what the unique indexes
 *    ux_so_order_no / ux_sq_quote_no are built on; a case-insensitive match would
 *    drop them and scan every partition.
 *  - an all-digits value additionally matches the serial column, because the
 *    entry screens show the bare running number as well as the printed refno.
 *  - the accounting year is NOT a parameter: the number alone is what the user
 *    has. Where a number repeats across years — the same serial in a new year, a
 *    hand-entered refno — the newest year wins.
 */
export class DocumentNumberLookup {
  constructor(private readonly prisma: PrismaService) {}
  async getDocumentByNumber(query: DocumentNumberQueryDto): Promise<DocumentNumberPayload> {
    const { module, orderNo, companyId, branchId } = query;
    const row = await DOCUMENT_RESOLVERS[module](this.prisma, {
      refno: orderNo,
      slno: toSerial(orderNo),
      companyId,
      branchId,
    });
    if (!row) {
      throwMasterNotFound<MasterErrorDetail>(
        `${DOCUMENT_LABELS[module]} not found`,
        'orderNo',
        `No ${DOCUMENT_LABELS[module].toLowerCase()} found for number ${orderNo} in company ${companyId} / branch ${branchId}`,
      );
    }
    return {
      orderId: row.id,
      companyId: row.companyId,
      branchId: row.branchId,
      // acc_year is CHAR(9); Postgres pads it, so it is trimmed before it leaves.
      accYear: row.accYear.trim(),
    };
  }
}
/**
 * The number as a serial, or null when it is not one. Values wider than a signed
 * 64-bit serial are rejected rather than truncated — the column is BIGINT, so
 * nothing outside that range can be stored, and passing one on would make Prisma
 * throw instead of returning a clean 404.
 */
function toSerial(orderNo: string): bigint | null {
  if (!/^\d+$/.test(orderNo)) return null;
  const serial = BigInt(orderNo);
  return serial <= MAX_BIGINT ? serial : null;
}
const MAX_BIGINT = 9223372036854775807n;
