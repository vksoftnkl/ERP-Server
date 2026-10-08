import type { TillApprovalNeed } from '../../../till/types/till-api.types';
import type { VoucherRefusal, VoucherWarning } from '../../vouchers/vouchers.errors';
import type { ExpenseMoneyFrom, ExpenseStatus } from './expense-enum';

/** What a draft keeps in avh_draft_lines: the lines as typed, and the GST bill. */
export interface ExpenseDraftLines {
  version: 1;
  reasonId: string | null;
  lines: ExpenseLineInput[];
  gstBill: ExpenseGstBillInput | null;
}

export interface ExpenseLineInput {
  rowNo: number;
  ledgerId: string;
  /** Without a GST bill: the line's whole amount. With one: its taxable value. */
  amount: number;
  description: string | null;
  costCentreId: string | null;
  /** With a GST bill: inventory.tax_rate_master.tax_id. */
  taxId: string | null;
  hsn: string | null;
  /** With a GST bill: claim the input tax (default). False = the tax is part of the cost. */
  itc: boolean;
}

export interface ExpenseGstBillInput {
  /** Defaults to the supplier ledger's GSTIN. */
  supplierGstin: string | null;
  invoiceNo: string;
  invoiceDate: string;
  /** 2-digit state code. Defaults to the GSTIN's state; INTER when it is not the company's. */
  placeOfSupplyCode: string | null;
}

export interface ExpenseLegPayload {
  rowNo: number;
  drCr: 'DR' | 'CR';
  ledgerId: string | null;
  ledgerName: string | null;
  role: string | null;
  amount: number;
  remarks: string | null;
  /** The expense line it comes from (DR legs). */
  line: number | null;
}

export interface ExpenseLinePayload extends ExpenseLineInput {
  ledgerName: string | null;
  taxName: string | null;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  /** amount + its tax. */
  total: number;
  /** INPUTS · INPUT_SERVICES · CAPITAL_GOODS · INELIGIBLE, with a GST bill. */
  itcEligibility: string | null;
}

export interface ExpenseTenderPayload {
  tdId: string | null;
  rowNo: number;
  tenderId: string;
  tenderName: string;
  tenderTypeId: number;
  tenderTypeName: string;
  amount: number;
  refNo: string | null;
  ledgerId: string;
  ledgerName: string | null;
  moneyFrom: ExpenseMoneyFrom;
}

export interface ExpenseDerivedPayload {
  total: number;
  taxable: number;
  tax: { cgst: number; sgst: number; igst: number; cess: number };
  /** With a GST bill. */
  supplyNature: 'INTRA' | 'INTER' | null;
  placeOfSupplyCode: string | null;
  lines: ExpenseLinePayload[];
  tenders: ExpenseTenderPayload[];
  legs: ExpenseLegPayload[];
  /** The till session the cash moves in, when it does. */
  session: { sessionId: string; accYear: string } | null;
  /** The safe a back-office CASH row comes from. */
  safeName: string | null;
}

export interface ExpenseValidatePayload {
  ok: boolean;
  derived: ExpenseDerivedPayload;
  refusals: VoucherRefusal[];
  /** EXPENSE_GST_BILL_MISSING, STATUTORY_40A3, TILL_APPROVAL_REQUIRED (INFO). */
  warnings: VoucherWarning[];
  /** In a till session: what the EXPENSE approval rule would ask. Reported until phase 3. */
  approval: TillApprovalNeed | null;
}

export interface ExpensePayload {
  voucherId: string;
  companyId: string;
  branchId: string;
  accYear: string;
  status: ExpenseStatus;
  voucherNo: string | null;
  voucherDate: string;
  partyId: string | null;
  partyName: string | null;
  usrRefno: string | null;
  remarks: string | null;
  reasonId: string | null;
  sessionId: string | null;
  gstBill: ExpenseGstBillInput | null;
  amount: number;
  derived: ExpenseDerivedPayload;
  /** POSTED / CANCELLED: the legs as written. */
  postedOn: string | null;
  cancelReason: string | null;
  reversalVoucherId: string | null;
  createdOn: string;
}

/** /post: the voucher, and what the post found without refusing. */
export interface ExpensePostPayload extends ExpensePayload {
  warnings: VoucherWarning[];
  approval: TillApprovalNeed | null;
}

export interface ExpenseQuickReasonPayload {
  reasonId: string;
  code: string;
  name: string;
  ledgerId: string | null;
  ledgerName: string | null;
  needsNote: boolean;
  needsRef: boolean;
  maxAmount: number | null;
}

export interface ExpenseLedgerPickPayload {
  ledgerId: string;
  name: string;
  groupName: string;
  /** The ledger's own GST rate, to pre-fill a line on a GST bill. */
  taxId: string | null;
  itcEligibility: string | null;
}

export interface ExpenseSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}
