import { PostReceiptAllocationDto, PostReceiptCreditDto } from "../../../modules/accountsModule/receipt/dto/post-receipt.dto";
import { SaveDraftReceiptDto, SaveReceiptTenderDto } from "../../../modules/accountsModule/receipt/dto/save-receipt.dto";
declare const MobileReceiptTenderDto_base: import("@nestjs/common").Type<Pick<SaveReceiptTenderDto, "tdAmount" | "tdRefNo" | "tdBankName" | "tdInstrumentDate" | "tdTenderTypeId" | "tdTenderId" | "cheque">>;
export declare class MobileReceiptTenderDto extends MobileReceiptTenderDto_base {
}
declare const MobileReceiptAllocationDto_base: import("@nestjs/common").Type<Pick<PostReceiptAllocationDto, "amount" | "billId" | "billAccYear" | "discount" | "roundoff">>;
export declare class MobileReceiptAllocationDto extends MobileReceiptAllocationDto_base {
}
declare const MobileReceiptCreditDto_base: import("@nestjs/common").Type<Pick<PostReceiptCreditDto, "amount" | "billId" | "billAccYear">>;
export declare class MobileReceiptCreditDto extends MobileReceiptCreditDto_base {
}
declare const CreateMobileReceiptDto_base: import("@nestjs/common").Type<Pick<SaveDraftReceiptDto, "avhCompanyId" | "avhUsrRefno" | "avhDocRefno" | "avhDocDate" | "avhPartyId" | "avhRemarks">>;
export declare class CreateMobileReceiptDto extends CreateMobileReceiptDto_base {
    avhBranchId?: string;
    allocations?: MobileReceiptAllocationDto[];
    creditsApplied?: MobileReceiptCreditDto[];
    onAccount?: number;
    avhClientUuid: string;
    deviceUid: string;
    avhVoucherDate?: string;
    tenders: MobileReceiptTenderDto[];
}
export declare class MobileReceiptOptionsQueryDto {
    companyId: string;
    deviceUid: string;
    branchId?: string;
}
export declare const MOBILE_OPEN_BILLS_DEFAULT_PAGE_SIZE = 200;
export declare const MOBILE_OPEN_BILLS_MAX_PAGE_SIZE = 500;
export declare class MobileOpenBillsQueryDto {
    companyId: string;
    page?: number;
    pageSize?: number;
    withCredits?: boolean;
}
export declare const MOBILE_RECEIPT_STATUS_DEFAULT_PAGE_SIZE = 200;
export declare const MOBILE_RECEIPT_STATUS_MAX_PAGE_SIZE = 500;
export declare class MobileReceiptStatusQueryDto {
    companyId: string;
    deviceUid: string;
    since?: string;
    page?: number;
    pageSize?: number;
}
export {};
