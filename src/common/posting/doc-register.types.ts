/**
 * What `DocRegisterService` needs to write one `acc_voucher_doc_register` row
 * and its detail lines (flow §5.7, §4 step 4, §6.1 step 6).
 *
 * The register is the GST view of a document, and it is deliberately a
 * SNAPSHOT: the party's name, address and GSTIN are copied off the document,
 * not joined from the master. A walk-in types a GSTIN onto the bill and that
 * typed GSTIN is what makes the sale B2B — joining to `customers` would show a
 * blank, and editing the master later would silently rewrite a filed return.
 */

export type RegisterDocType =
  | 'INVOICE'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'BILL_OF_SUPPLY'
  | 'DELIVERY_CHALLAN'
  | 'CHALLAN'
  | 'ADVANCE'
  | 'ADV_ADJUSTMENT'
  | 'EXPORT_DOC'
  | 'IMPORT_DOC'
  | 'OTHER';

export type RegisterTranNature =
  | 'SALE'
  | 'SALES_RETURN'
  | 'DELIVERY_CHALLAN'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'STOCK_TRANSFER'
  | 'OTHER';

export type RegisterTaxability = 'TAXABLE' | 'EXEMPT' | 'NIL_RATED' | 'NON_GST' | 'MIXED';
export type RegisterSupplyNature =
  | 'INTRA_STATE'
  | 'INTER_STATE'
  | 'IMPORT'
  | 'EXPORT'
  | 'SEZ'
  | 'OTHER';
export type RegisterSupplyClass = 'GOODS' | 'SERVICES' | 'MIXED';
export type RegisterDocFlow = 'OUTWARD' | 'INWARD' | 'INTERNAL';

/** One taxable line, as the GST detail rows record it. */
export interface RegisterDetailLine {
  rowNo: number;
  itemId?: string | null;
  itemCode?: string | null;
  itemName?: string | null;
  description?: string | null;
  hsnCode?: string | null;
  unitId?: string | null;
  qty: number;
  rate: number;
  discount: number;
  isService: boolean;
  taxableValue: number;
  taxId?: string | null;
  totalTaxRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cessRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  otherAmount: number;
  totalValue: number;
  billValue: number;
  taxability: RegisterTaxability;
  supplyNature: RegisterSupplyNature;
}

export interface RegisterDoc {
  companyId: string;
  branchId: string;
  accYear: string;
  voucherId: string;
  voucherTypeId: number;
  /** `gdr_voucher_no` is a BigInt — the running serial, not the printed refno. */
  voucherNo: bigint;
  voucherDate: string;
  voucherRefno?: string | null;

  sourceDocId: string;
  docType: RegisterDocType;
  tranNature: RegisterTranNature;
  docFlow: RegisterDocFlow;
  /** +1 outward, -1 for a return. `chk_gdr_doc_sign` allows only those two. */
  docSign: 1 | -1;
  docNo: string;
  docDate: string;
  docRefNo?: string | null;

  taxability: RegisterTaxability;
  supplyClass?: RegisterSupplyClass | null;
  supplyNature?: RegisterSupplyNature | null;
  placeOfSupplyCode?: string | null;
  placeOfSupplyName?: string | null;
  isReverseCharge?: boolean;
  igstOnIntra?: boolean;

  /** The party ledger. `gdr_party_id` is NOT NULL: a register row is raised
   *  against somebody, and a walk-in uses the default customer's ledger. */
  partyId: string;
  partyName?: string | null;
  partyAddr1?: string | null;
  partyAddr2?: string | null;
  partyAddr3?: string | null;
  partyLocation?: string | null;
  partyPin?: string | null;
  partyStateCode?: string | null;
  partyStateName?: string | null;
  partyGstType?: string | null;
  /** NULL means B2C. The snapshot, never the master. */
  partyGstin?: string | null;

  grossValue: number;
  discountValue: number;
  taxableValue: number;
  cgstValue: number;
  sgstValue: number;
  igstValue: number;
  cessValue: number;
  stateCessValue: number;
  tcsValue: number;
  otherCharge: number;
  roundOff: number;
  billValue: number;

  remarks?: string | null;
  createdBy?: string;
  lines: RegisterDetailLine[];
}

export interface RegisterWriteResult {
  gdrId: string;
  /** Computed through `StatutoryService`, never taken from the client. */
  einvoiceApplicable: boolean;
  ewaybillApplicable: boolean;
  lineCount: number;
}
