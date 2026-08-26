import { CompanyProfileProvider } from '../../providers/impl/company-profile.provider';
import { BranchProfileProvider } from '../../providers/impl/branch-profile.provider';
import { InvoiceBatchDetailProvider } from '../../providers/impl/invoice-batch-detail.provider';
import { InvoiceHeaderProvider } from '../../providers/impl/invoice-header.provider';
import { InvoiceLinesProvider } from '../../providers/impl/invoice-lines.provider';
import { InvoiceTaxSummaryProvider } from '../../providers/impl/invoice-tax-summary.provider';
import { PartyOutstandingProvider } from '../../providers/impl/party-outstanding.provider';
import { PrismaService } from '../../../../database/prisma/prisma.service';

/**
 * Sample datasets for gallery previews and the render script.
 *
 * Taken from the PROVIDERS' own `sampleData()`, deliberately, so that what a
 * gallery preview shows is exactly what the designer preview will show. A
 * second hand-written fixture here would drift from the providers within a
 * release and every preview would quietly become a lie.
 *
 * `sampleData()` touches no database, which is why constructing a provider with
 * a null PrismaService is safe. The cast is confined to this file: nothing else
 * builds a provider outside the Nest container.
 */
const noPrisma = null as unknown as PrismaService;

export const SAMPLE_DATASETS: Record<string, unknown> = {
  company: new CompanyProfileProvider(noPrisma).sampleData(),
  branch: new BranchProfileProvider(noPrisma).sampleData(),
  invoice: {
    ...(new InvoiceHeaderProvider(noPrisma).sampleData() as Record<string, unknown>),
    // The header provider does not carry an IRN QR — that comes from the
    // e-invoice module — so the preview supplies a realistic one, since the QR
    // element's size and error-correction level are only meaningful against a
    // payload of the right order of magnitude.
    irnSignedQr: `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${'e30'.repeat(180)}.signature`,
  },
  items: new InvoiceLinesProvider(noPrisma).sampleData(),
  taxes: new InvoiceTaxSummaryProvider(noPrisma).sampleData(),
  batches: new InvoiceBatchDetailProvider(noPrisma).sampleData(),
  outstanding: new PartyOutstandingProvider(noPrisma).sampleData(),
};

/**
 * A long-document variant, for checking pagination in a preview.
 * 60 lines takes an A4 invoice to two pages and a thermal receipt past any
 * plausible single-screen preview.
 */
export const SAMPLE_DATASETS_LONG: Record<string, unknown> = (() => {
  const base = new InvoiceLinesProvider(noPrisma).sampleData() as Array<Record<string, unknown>>;
  const items = Array.from({ length: 60 }, (_unused, index) => {
    const template = base[index % base.length];
    return { ...template, __index: index + 1, lineNo: index + 1 };
  });
  return { ...SAMPLE_DATASETS, items };
})();
