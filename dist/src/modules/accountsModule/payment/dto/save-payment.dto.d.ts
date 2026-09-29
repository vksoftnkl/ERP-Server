import { TenderChequeDetailDto } from '../../tenderDetail/dto/save-tender-detail.dto';
import { PostReceiptAllocationDto, PostReceiptCreditDto, ReceiptKeysDto } from '../../receipt/dto/post-receipt.dto';
import { DrCr, VoucherDeviceType } from '../types/payment-enum';
export declare class SavePaymentChequeDto extends TenderChequeDetailDto {
    chequeBookId: string;
    favouring?: string | null;
    acPayee?: boolean;
}
export declare class PaymentBeneficiaryDto {
    name?: string | null;
    accountNo?: string | null;
    ifsc?: string | null;
}
export declare class SavePaymentTenderDto {
    tdId?: string;
    tdRowNo: number;
    tdTenderId: string;
    tdTenderTypeId: number;
    tdTenderLedgerId?: string;
    tdAmount: number;
    tdReceivedAmt?: number;
    tdChangeAmt?: number;
    tdMdrAmt?: number;
    tdRefNo?: string | null;
    tdBankName?: string | null;
    tdPayerVpa?: string | null;
    tdInstrumentDate?: string | null;
    tdNotes?: string | null;
    cheque?: SavePaymentChequeDto;
    beneficiary?: PaymentBeneficiaryDto;
}
export declare class SavePaymentOtherLineDto {
    role?: string;
    ledgerId?: string;
    drCr: DrCr;
    amount: number;
    settlesBill?: boolean;
    narration?: string | null;
    approvedBy?: string | null;
}
export declare class SavePaymentDto {
    avhVoucherId?: string;
    avhCompanyId: string;
    avhBranchId: string;
    avhAccYear: string;
    avhTenantId?: string | null;
    avhVoucherDate: string;
    avhPartyId: string;
    avhEmployeeId?: string[];
    avhUsrRefno?: string | null;
    avhDocRefno?: string | null;
    avhDocDate?: string | null;
    avhRemarks?: string | null;
    avhDeviceType?: VoucherDeviceType;
    avhDeviceId?: string | null;
    avhSessionId?: string | null;
    avhUserId?: string;
    tenders: SavePaymentTenderDto[];
    otherLines?: SavePaymentOtherLineDto[];
    replace?: boolean;
}
export declare class SaveDraftPaymentDto extends SavePaymentDto {
    allocations?: PostReceiptAllocationDto[];
    creditsApplied?: PostReceiptCreditDto[];
}
export declare class UpdatePaymentHeaderDto extends ReceiptKeysDto {
    avhRemarks?: string | null;
    avhUsrRefno?: string | null;
    avhDocRefno?: string | null;
    avhDocDate?: string | null;
    avhEmployeeId?: string[];
    editRemark: string;
}
