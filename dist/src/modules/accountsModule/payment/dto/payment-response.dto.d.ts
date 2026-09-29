import { AdjacentVoucherSuccessDto, DuplicateCheckSuccessDto, OpenCreditDto, ReceiptAdvanceBillDto, ReceiptAllocationDto, ReceiptBillAfterDto, ReceiptBillReopenedDto, ReceiptErrorResponseDto, ReceiptHeaderDto, ReceiptLegDto, ReceiptNumberedVoucherDto, ReceiptOtherLineDto, ReceiptPdcVoucherDto, ReceiptReversalDto, ReceiptStatusPayloadDto, ReceiptTenderDto } from '../../receipt/dto/receipt-response.dto';
import { BillStatus, BillType, PdcStatus, VoucherStatus } from '../types/payment-enum';
import type { PayableBill, PartyChequeOut, PartyRecentPayment, PaymentAmendPayload, PaymentBeneficiary, PaymentCancelPayload, PaymentCheque, PaymentDeletePayload, PaymentDraftPayload, PaymentOpenItemsParty, PaymentOpenItemsPayload, PaymentOpenItemsSummary, PaymentOtherLine, PaymentPartyContextPayload, PaymentPartyContextSummary, PaymentPayload, PaymentPostPayload, PaymentTender, PaymentTenderCheque } from '../types/payment-api.types';
export { AdjacentVoucherSuccessDto, DuplicateCheckSuccessDto, ReceiptErrorResponseDto as PaymentErrorResponseDto, ReceiptHeaderDto as PaymentHeaderDto, };
export declare class PayableBillDto implements PayableBill {
    billId: string;
    billAccYear: string;
    billType: BillType;
    docRefno: string;
    usrRefno: string | null;
    docDate: string;
    dueDate: string | null;
    billAmount: number;
    pendingAmount: number;
    status: BillStatus;
    daysOverdue: number;
    pdcHeld: number;
    ppdSuggested: number;
}
export declare class PaymentBankDto {
    name: string;
    accountNo: string;
    ifsc: string | null;
}
export declare class PaymentOpenItemsPartyDto implements PaymentOpenItemsParty {
    ledId: string;
    ledName: string;
    groupName: string | null;
    isBillByBill: boolean;
    isMoneyLedger: boolean;
    isTdsApplicable: boolean;
    tdsSection: string | null;
    tdsDeducteeType: string | null;
    tdsRate: number | null;
    tdsRateSource: 'MASTER' | 'NO_PAN' | null;
    tdsThresholdSingle: number | null;
    tdsThresholdAnnual: number | null;
    tdsPaidThisYear: number;
    panPresent: boolean;
    bank: PaymentBankDto | null;
    favouringName: string;
}
export declare class PaymentOpenItemsSummaryDto implements PaymentOpenItemsSummary {
    totalPending: number;
    billCount: number;
    overdueCount: number;
    creditsHeld: number;
    pdcHeld: number;
}
export declare class PaymentOpenItemsPayloadDto implements PaymentOpenItemsPayload {
    bills: PayableBillDto[];
    credits: OpenCreditDto[];
    summary: PaymentOpenItemsSummaryDto;
    party: PaymentOpenItemsPartyDto;
}
export declare class PaymentOpenItemsSuccessDto {
    success: true;
    message: string;
    data: PaymentOpenItemsPayloadDto;
}
export declare class PartyRecentPaymentDto implements PartyRecentPayment {
    voucherId: string;
    accYear: string;
    voucherRefno: string | null;
    voucherDate: string;
    docAmount: number;
    adjustAmount: number;
    instruments: string | null;
}
export declare class PartyChequeOutDto implements PartyChequeOut {
    pdcId: string;
    accYear: string;
    instrumentNo: string;
    instrumentDate: string;
    amount: number;
    bankName: string | null;
    bookNo: string | null;
    status: PdcStatus;
    voucherId: string | null;
    voucherRefno: string | null;
}
export declare class PaymentPartyContextSummaryDto implements PaymentPartyContextSummary {
    totalBalance: number;
    totalOutstanding: number;
    totalCredits: number;
    chequesOutstanding: number;
}
export declare class PaymentPartyContextPayloadDto implements PaymentPartyContextPayload {
    partyId: string;
    partyName: string;
    summary: PaymentPartyContextSummaryDto;
    lastPayments: PartyRecentPaymentDto[];
    ourChequesOut: PartyChequeOutDto[];
}
export declare class PaymentPartyContextSuccessDto {
    success: true;
    message: string;
    data: PaymentPartyContextPayloadDto;
}
export declare class PaymentBeneficiaryResponseDto implements PaymentBeneficiary {
    name: string | null;
    accountNo: string | null;
    ifsc: string | null;
}
export declare class PaymentTenderChequeDto implements PaymentTenderCheque {
    chequeBookId: string;
    bookNo: string | null;
    favouring: string | null;
    acPayee: boolean;
    bankBranch: string | null;
    ifsc: string | null;
    micr: string | null;
    drawerName: string | null;
}
export declare class PaymentTenderDto extends ReceiptTenderDto implements PaymentTender {
    beneficiary: PaymentBeneficiaryResponseDto | null;
    cheque: PaymentTenderChequeDto | null;
}
export declare class PaymentOtherLineDto extends ReceiptOtherLineDto implements PaymentOtherLine {
    approvedBy: string | null;
}
export declare class PaymentChequeDto implements PaymentCheque {
    pdcId: string;
    accYear: string;
    tenderRowNo: number | null;
    instrumentType: string;
    instrumentNo: string;
    instrumentDate: string;
    amount: number;
    bankName: string | null;
    bankLedgerId: string | null;
    chequeBookId: string | null;
    bookNo: string | null;
    favouring: string | null;
    acPayee: boolean;
    printed: boolean;
    printCount: number;
    status: PdcStatus;
    voucherId: string | null;
}
export declare class PaymentDraftPayloadDto implements PaymentDraftPayload {
    header: ReceiptHeaderDto;
    tenders: PaymentTenderDto[];
    otherLines: PaymentOtherLineDto[];
    expectedRoles: string[];
}
export declare class PaymentDraftSuccessDto {
    success: true;
    message: string;
    data: PaymentDraftPayloadDto;
}
export declare class PaymentPayloadDto implements PaymentPayload {
    header: ReceiptHeaderDto;
    tenders: PaymentTenderDto[];
    otherLines: PaymentOtherLineDto[];
    legs: ReceiptLegDto[];
    allocations: ReceiptAllocationDto[];
    creditsApplied: ReceiptAllocationDto[];
    chequesIssued: PaymentChequeDto[];
    pdcVouchers: ReceiptPdcVoucherDto[];
    advanceBills: ReceiptAdvanceBillDto[];
}
export declare class PaymentSuccessDto {
    success: true;
    message: string;
    data: PaymentPayloadDto;
}
export declare class PaymentHeaderSuccessDto {
    success: true;
    message: string;
    data: ReceiptHeaderDto;
}
export declare class PaymentIssuedLeafDto {
    tdRowNo: number;
    apdId: string;
    apdAccYear: string;
    leaf: string;
    bookNo: string;
}
export declare class PaymentPostPayloadDto extends PaymentPayloadDto implements PaymentPostPayload {
    numberedVouchers: ReceiptNumberedVoucherDto[];
    billsAfter: ReceiptBillAfterDto[];
    totalOnAccount: number;
    cheques: PaymentIssuedLeafDto[];
}
export declare class PaymentPostSuccessDto {
    success: true;
    message: string;
    data: PaymentPostPayloadDto;
}
export declare class PaymentAmendUnwoundDto {
    adjustmentsReversed: number;
    legsRemoved: number;
    pdcVouchersRemoved: number;
    chequesRemoved: number;
    advanceBillsRemoved: number;
    tendersRemoved: number;
    tdsReversed: number;
}
export declare class PaymentAmendPayloadDto extends PaymentPostPayloadDto implements PaymentAmendPayload {
    fromRevision: number;
    toRevision: number;
    editRemark: string;
    unwound: PaymentAmendUnwoundDto;
}
export declare class PaymentAmendSuccessDto {
    success: true;
    message: string;
    data: PaymentAmendPayloadDto;
}
export declare class PaymentCancelPayloadDto extends ReceiptStatusPayloadDto implements PaymentCancelPayload {
    reversals: ReceiptReversalDto[];
    billsReopened: ReceiptBillReopenedDto[];
    chequesCancelled: string[];
    advanceBillsRemoved: string[];
    tdsReversed: number;
}
export declare class PaymentCancelSuccessDto {
    success: true;
    message: string;
    data: PaymentCancelPayloadDto;
}
export declare class PaymentDeletePayloadDto implements PaymentDeletePayload {
    avhVoucherId: string;
    avhAccYear: string;
    avhVoucherRefno: string | null;
    status: VoucherStatus;
    deletedOn: string;
    deletedBy: string;
    tendersDeleted: number;
    otherLinesDeleted: number;
}
export declare class PaymentDeleteSuccessDto {
    success: true;
    message: string;
    data: PaymentDeletePayloadDto;
}
