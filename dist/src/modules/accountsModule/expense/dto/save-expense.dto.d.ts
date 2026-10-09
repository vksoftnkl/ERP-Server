export declare class ExpenseKeyDto {
    companyId: string;
    branchId: string;
    accYear: string;
    voucherId: string;
}
export declare class CancelExpenseDto extends ExpenseKeyDto {
    reason: string;
}
export declare class ExpenseLineDto {
    rowNo: number;
    ledgerId: string;
    amount: number;
    description?: string | null;
    costCentreId?: string | null;
    taxId?: string | null;
    hsn?: string | null;
    itc?: boolean;
}
export declare class ExpenseTenderDto {
    tdId?: string;
    tdRowNo: number;
    tdTenderId: string;
    tdTenderTypeId: number;
    tdTenderLedgerId?: string;
    tdAmount: number;
    tdReceivedAmt?: number;
    tdChangeAmt?: number;
    tdRefNo?: string | null;
    tdBankName?: string | null;
    tdPayerVpa?: string | null;
    tdNotes?: string | null;
}
export declare class ExpenseGstBillDto {
    supplierGstin?: string | null;
    invoiceNo: string;
    invoiceDate: string;
    placeOfSupplyCode?: string | null;
}
export declare class SaveExpenseDto {
    voucherId?: string;
    companyId: string;
    branchId: string;
    tenantId?: string | null;
    accYear: string;
    voucherDate: string;
    partyId?: string | null;
    usrRefno?: string | null;
    remarks?: string | null;
    reasonId?: string | null;
    sessionId?: string | null;
    lines: ExpenseLineDto[];
    tenders: ExpenseTenderDto[];
    gstBill?: ExpenseGstBillDto | null;
}
export declare class ExpenseLedgerPickQueryDto {
    companyId: string;
    search?: string | null;
}
export declare class ExpenseReasonQueryDto {
    companyId: string;
}
