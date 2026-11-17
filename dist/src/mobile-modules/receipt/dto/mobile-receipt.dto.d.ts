import { SaveDraftReceiptDto, SaveReceiptTenderDto } from "../../../modules/accountsModule/receipt/dto/save-receipt.dto";
declare const MobileReceiptTenderDto_base: import("@nestjs/common").Type<Pick<SaveReceiptTenderDto, "tdAmount" | "tdRefNo" | "tdBankName" | "tdInstrumentDate" | "tdTenderTypeId" | "tdTenderId" | "cheque">>;
export declare class MobileReceiptTenderDto extends MobileReceiptTenderDto_base {
}
declare const CreateMobileReceiptDto_base: import("@nestjs/common").Type<Pick<SaveDraftReceiptDto, "avhCompanyId" | "avhUsrRefno" | "avhPartyId" | "avhRemarks">>;
export declare class CreateMobileReceiptDto extends CreateMobileReceiptDto_base {
    avhClientUuid: string;
    deviceUid: string;
    avhVoucherDate?: string;
    tenders: MobileReceiptTenderDto[];
}
export declare class MobileReceiptOptionsQueryDto {
    companyId: string;
    deviceUid: string;
}
export declare const MOBILE_OPEN_BILLS_DEFAULT_PAGE_SIZE = 200;
export declare const MOBILE_OPEN_BILLS_MAX_PAGE_SIZE = 500;
export declare class MobileOpenBillsQueryDto {
    companyId: string;
    page?: number;
    pageSize?: number;
}
export {};
