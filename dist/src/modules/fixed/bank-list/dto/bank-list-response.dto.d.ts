import { FixedErrorFieldDto, FixedErrorResponseDto, FixedListMetaDto } from "../../../../common/utils/module-response.dto";
export { FixedErrorFieldDto as BankListErrorFieldDto };
export { FixedErrorResponseDto as BankListErrorResponseDto };
export { FixedListMetaDto as BankListMetaDto };
export declare class BankListPayloadDto {
    bnkId: string;
    bnkName: string;
    bnkShortName: string | null;
    bnkAlias: string | null;
    bnkRbiCode: string | null;
    bnkIbanSupported: boolean;
    bnkIsActive: boolean;
    bnkIsDeleted: boolean;
    bnkSyncDate: string | null;
    bnkCreatedOn: string;
    bnkCreatedBy: string | null;
    bnkModifiedOn: string;
    bnkModifiedBy: string | null;
}
export declare class BankListDeleteResultDto {
    bnkId: string;
    deleted: true;
}
export declare class BankListSuccessSingleDto {
    success: true;
    message: string;
    data: BankListPayloadDto;
}
export declare class BankListSuccessListDto {
    success: true;
    message: string;
    data: BankListPayloadDto[];
    meta: FixedListMetaDto;
}
export declare class BankListSuccessDeleteDto {
    success: true;
    message: string;
    data: BankListDeleteResultDto;
}
