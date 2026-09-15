import { DrCr, VoucherDeviceType } from '../types/receipt-enum';
import { ReceiptKeysDto } from './post-receipt.dto';
export declare class SaveReceiptChequeDto {
    bankBranch?: string | null;
    ifsc?: string | null;
    micr?: string | null;
    drawerName?: string | null;
    bankLedgerId?: string | null;
}
export declare class SaveReceiptTenderDto {
    tdId?: string;
    tdRowNo: number;
    tdTenderId: string;
    tdTenderTypeId: number;
    tdTenderLedgerId?: string;
    tdAmount: number;
    tdReceivedAmt?: number;
    tdChangeAmt?: number;
    tdMdrAmt?: number;
    tdSurchargePerc?: number;
    tdSurchargeAmt?: number;
    tdRefNo?: string | null;
    tdAuthCode?: string | null;
    tdCardLast4?: string | null;
    tdBankName?: string | null;
    tdPayerVpa?: string | null;
    tdInstrumentDate?: string | null;
    tdNotes?: string | null;
    cheque?: SaveReceiptChequeDto;
}
export declare class SaveReceiptOtherLineDto {
    role?: string;
    ledgerId?: string;
    drCr: DrCr;
    amount: number;
    settlesBill?: boolean;
    narration?: string | null;
}
export declare class SaveReceiptDto {
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
    tenders: SaveReceiptTenderDto[];
    otherLines?: SaveReceiptOtherLineDto[];
    replace?: boolean;
}
export declare class UpdateReceiptHeaderDto extends ReceiptKeysDto {
    avhRemarks?: string | null;
    avhUsrRefno?: string | null;
    avhDocRefno?: string | null;
    avhDocDate?: string | null;
    avhEmployeeId?: string[];
    editRemark: string;
}
export declare class RegularisePdcDto {
    asOf?: string;
}
