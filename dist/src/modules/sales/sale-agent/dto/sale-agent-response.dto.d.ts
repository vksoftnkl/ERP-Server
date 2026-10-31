import { SalesErrorFieldDto, SalesErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { SalesErrorFieldDto as SaleAgentErrorFieldDto };
export { SalesErrorResponseDto as SaleAgentErrorResponseDto };
export declare class SaleAgentPayloadDto {
    saId: string;
    saCompanyId: string;
    saCompanyName: string | null;
    saBranchId: string | null;
    saBranchName: string | null;
    saGroupId: string;
    saGroupName: string | null;
    saCode: string | null;
    saName: string;
    saAlias: string | null;
    saMobile1: string | null;
    saMobile2: string | null;
    saAddr1: string | null;
    saAddr2: string | null;
    saCity: string | null;
    saDistrict: string | null;
    saState: string | null;
    saPincode: string | null;
    saPanNo: string | null;
    saGstin: string | null;
    saRemarks: string | null;
    saIsActive: boolean;
    saIsDeleted: boolean;
    saSyncDate: string | null;
    saCreatedOn: string;
    saCreatedBy: string | null;
    saModifiedOn: string;
    saModifiedBy: string | null;
}
export declare class SaleAgentDeleteResultDto {
    saId: string;
    deleted: true;
}
export declare class SaleAgentSuccessSingleDto {
    success: true;
    message: string;
    data: SaleAgentPayloadDto;
}
export declare class SaleAgentSuccessDeleteDto {
    success: true;
    message: string;
    data: SaleAgentDeleteResultDto;
}
