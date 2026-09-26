import { SalesErrorFieldDto, SalesErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { SalesErrorFieldDto as CustomerGroupErrorFieldDto };
export { SalesErrorResponseDto as CustomerGroupErrorResponseDto };
export declare class CustomerGroupPayloadDto {
    cgrId: string;
    cgrCompanyId: string | null;
    cgrBranchId: string | null;
    cgrName: string;
    cgrAlias: string | null;
    cgrShort: string | null;
    cgrNarration: string | null;
    cgrOrder: number;
    cgrDiscPerc: number;
    cgrCollectionDays: number[];
    cgrDebitAllowed: boolean;
    cgrDebitDays: number;
    cgrDebitLimit: number;
    cgrBillsLimit: number;
    cgrOverdueBilling: boolean;
    cgrIsActive: boolean;
    cgrIsDeleted: boolean;
    cgrCreatedOn: string;
    cgrModifiedOn: string;
}
export declare class CustomerGroupDeleteResultDto {
    cgrId: string;
    deleted: true;
}
export declare class CustomerGroupSuccessSingleDto {
    success: true;
    message: string;
    data: CustomerGroupPayloadDto;
}
export declare class CustomerGroupSuccessDeleteDto {
    success: true;
    message: string;
    data: CustomerGroupDeleteResultDto;
}
