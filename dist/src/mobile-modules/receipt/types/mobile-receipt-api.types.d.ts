import type { MobileReceiptAdjusted } from '../mobile-receipt-plan';
import type { MobilePpdStep } from '../mobile-receipt-ppd';
export type { MobileReceiptAdjusted, MobilePpdStep };
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
    requiresBank: boolean;
}
export interface MobileReceiptSettings {
    receiptBillSort: string;
    salesmanMandatory: boolean;
    pdcPostingMode: string;
    ppdEnabled: boolean;
}
export interface MobileReceiptOptions {
    companyId: string;
    branchId: string;
    tenders: MobileReceiptTender[];
    settings: MobileReceiptSettings;
}
export interface MobileReceiptAllocation {
    billId: string;
    billAccYear: string;
    docRefno: string;
    amount: string;
    discount: string;
    roundoff: string;
    pendingAmount: string | null;
}
export interface MobileReceiptCreditApplied {
    billId: string;
    billAccYear: string;
    docRefno: string;
    amount: string;
    pendingAmount: string | null;
}
export interface MobileReceiptPdcVoucher {
    voucherId: string;
    voucherRefno: string | null;
    chequeDate: string;
    amount: string;
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
    creditsApplied: MobileReceiptCreditApplied[];
    pdcVouchers: MobileReceiptPdcVoucher[];
    adjusted: MobileReceiptAdjusted[];
    employeeId: string | null;
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
    kind: MobileOpenItemKind;
    paidAmount: string;
    pdcHeld: string;
    ppdSchedule: MobilePpdStep[];
}
export type MobileOpenItemKind = 'BILL' | 'ADVANCE' | 'SALES_RETURN' | 'OPENING_CR' | 'JOURNAL_CR';
export interface MobileReceiptCheque {
    voucherId: string | null;
    voucherRefno: string | null;
    instrumentNo: string;
    chequeDate: string;
    amount: string;
    status: string;
    houseStatus: string;
    isPostDated: boolean;
}
export interface MobileReceiptStatus {
    avhClientUuid: string;
    avhVoucherId: string;
    avhAccYear: string;
    avhVoucherRefno: string | null;
    avhVoucherStatus: string;
    cancelledOn: string | null;
    cancelReason: string | null;
    pdc: MobileReceiptCheque[];
    updatedOn: string;
}
export interface MobileReceiptStatusPayload {
    items: MobileReceiptStatus[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    companyId: string;
    asOf: string;
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
