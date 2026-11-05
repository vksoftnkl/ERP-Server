import type { TillApprovalNeed } from '../../../till/types/till-api.types';
import type { VoucherRefusal, VoucherWarning } from '../../vouchers/vouchers.errors';
import type { ExpenseMoneyFrom, ExpenseStatus } from './expense-enum';
export interface ExpenseDraftLines {
    version: 1;
    reasonId: string | null;
    lines: ExpenseLineInput[];
    gstBill: ExpenseGstBillInput | null;
}
export interface ExpenseLineInput {
    rowNo: number;
    ledgerId: string;
    amount: number;
    description: string | null;
    costCentreId: string | null;
    taxId: string | null;
    hsn: string | null;
    itc: boolean;
}
export interface ExpenseGstBillInput {
    supplierGstin: string | null;
    invoiceNo: string;
    invoiceDate: string;
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
    line: number | null;
}
export interface ExpenseLinePayload extends ExpenseLineInput {
    ledgerName: string | null;
    taxName: string | null;
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    total: number;
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
    tax: {
        cgst: number;
        sgst: number;
        igst: number;
        cess: number;
    };
    supplyNature: 'INTRA' | 'INTER' | null;
    placeOfSupplyCode: string | null;
    lines: ExpenseLinePayload[];
    tenders: ExpenseTenderPayload[];
    legs: ExpenseLegPayload[];
    session: {
        sessionId: string;
        accYear: string;
    } | null;
    safeName: string | null;
}
export interface ExpenseValidatePayload {
    ok: boolean;
    derived: ExpenseDerivedPayload;
    refusals: VoucherRefusal[];
    warnings: VoucherWarning[];
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
    postedOn: string | null;
    cancelReason: string | null;
    reversalVoucherId: string | null;
    createdOn: string;
}
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
    taxId: string | null;
    itcEligibility: string | null;
}
export interface ExpenseSuccessResponse<T> {
    success: true;
    message: string;
    data: T;
}
