import { OutputMode, TemplateDefinitionInput } from '../dto/template-definition.schema';
import { GST_INVOICE_A4_NAME, buildGstInvoiceA4 } from './gst-invoice-a4.template';
import { GST_INVOICE_A5_NAME, buildGstInvoiceA5 } from './gst-invoice-a5.template';
import {
  DOTMATRIX_INVOICE_DM80_NAME,
  buildDotMatrixInvoiceDm80,
} from './dotmatrix-invoice-dm80.template';
import { THERMAL_RECEIPT_T80_NAME, buildThermalReceiptT80 } from './thermal-receipt-t80.template';
import { THERMAL_RECEIPT_T58_NAME, buildThermalReceiptT58 } from './thermal-receipt-t58.template';
import { PARTY_STATEMENT_A4_NAME, buildPartyStatementA4 } from './party-statement-a4.template';

/**
 * The shipped template gallery.
 *
 * A blank canvas is never used. Customers customise a starting point, and a
 * designer opened onto an empty A4 page is a designer nobody adopts — so the
 * gallery is not a nice-to-have on top of the designer, it is the thing that
 * makes the designer usable.
 *
 * It also carries the Fast Path: until the designer UI exists, these ARE the
 * templates. They are seeded as system templates (pt_company_id NULL) and a
 * tenant clones one before editing.
 */

export interface GalleryTemplate {
  /** Stable key. Used as the seed identity and the render script's argument. */
  readonly key: string;
  readonly name: string;
  readonly docType: string;
  readonly outputMode: OutputMode;
  readonly paperCode: string;
  /** True for the design a fresh install should resolve to by default. */
  readonly isDefault: boolean;
  readonly build: () => TemplateDefinitionInput;
}

export const GALLERY_TEMPLATES: readonly GalleryTemplate[] = [
  {
    key: 'gst-invoice-a4',
    name: GST_INVOICE_A4_NAME,
    docType: 'SALE_INVOICE',
    outputMode: 'PDF',
    paperCode: 'A4',
    isDefault: true,
    build: buildGstInvoiceA4,
  },
  {
    key: 'gst-invoice-a5',
    name: GST_INVOICE_A5_NAME,
    docType: 'SALE_INVOICE',
    outputMode: 'PDF',
    paperCode: 'A5',
    isDefault: true,
    build: buildGstInvoiceA5,
  },
  {
    key: 'thermal-receipt-t80',
    name: THERMAL_RECEIPT_T80_NAME,
    docType: 'SALE_INVOICE',
    outputMode: 'ESCPOS',
    paperCode: 'T80',
    isDefault: true,
    build: buildThermalReceiptT80,
  },
  {
    key: 'thermal-receipt-t58',
    name: THERMAL_RECEIPT_T58_NAME,
    docType: 'SALE_INVOICE',
    outputMode: 'ESCPOS',
    paperCode: 'T58',
    isDefault: true,
    build: buildThermalReceiptT58,
  },
  {
    key: 'dotmatrix-invoice-dm80',
    name: DOTMATRIX_INVOICE_DM80_NAME,
    docType: 'SALE_INVOICE',
    outputMode: 'ESCP_DOTMATRIX',
    paperCode: 'DM80',
    isDefault: true,
    build: buildDotMatrixInvoiceDm80,
  },
  {
    key: 'party-statement-a4',
    name: PARTY_STATEMENT_A4_NAME,
    docType: 'PARTY_STATEMENT',
    outputMode: 'PDF',
    paperCode: 'A4',
    isDefault: true,
    build: buildPartyStatementA4,
  },
];

export const findGalleryTemplate = (key: string): GalleryTemplate | undefined =>
  GALLERY_TEMPLATES.find((entry) => entry.key === key);
