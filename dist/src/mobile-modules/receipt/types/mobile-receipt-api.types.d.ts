export interface MobileReceiptTender {
    tenderId: string;
    typeId: number;
    typeCode: string;
    name: string;
    shortName: string | null;
    needsRef: boolean;
    refLabel: string | null;
    isDefault: boolean;
    surchargePerc: string;
    surchargeAmount: string;
}
export interface MobileReceiptOptions {
    companyId: string;
    branchId: string;
    tenders: MobileReceiptTender[];
}
export interface MobileReceiptAllocation {
    billId: string;
    billAccYear: string;
    docRefno: string;
    amount: string;
    pendingAmount: string | null;
}
export interface MobileReceiptCreateResult {
    avhVoucherId: string;
    avhCompanyId: string;
    avhBranchId: string;
    avhAccYear: string;
    avhVoucherRefno: string | null;
    avhUsrRefno: string | null;
    avhVoucherDate: string;
    avhDocAmount: string;
    avhVoucherStatus: string;
    allocations: MobileReceiptAllocation[];
    onAccount: string;
    duplicate: boolean;
    avhIsDeleted: boolean;
}
export interface MobileOpenBill {
    partyId: string;
    billId: string;
    billAccYear: string;
    billType: string;
    docRefno: string;
    docDate: string;
    dueDate: string | null;
    billAmount: string;
    pendingAmount: string;
    daysOverdue: number;
}
export interface MobileOpenBillsPayload {
    items: MobileOpenBill[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    companyId: string;
    onDate: string;
}
