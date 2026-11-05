import { SalesErrorFieldDto, SalesErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { SalesErrorFieldDto as AreaErrorFieldDto };
export { SalesErrorResponseDto as AreaErrorResponseDto };
export declare class AreaPayloadDto {
    armId: string;
    armName: string;
    armAlias: string | null;
    armShort: string | null;
    armCityId: string;
    armCityName?: string | null;
    armSort: number;
    armDistanceKm: number | null;
    armCollectionDays: number[];
    armDescription: string | null;
    armIsActive: boolean;
    armIsDeleted: boolean;
    armSyncDate: string | null;
    armCreatedOn: string;
    armCreatedBy: string | null;
    armModifiedOn: string;
    armModifiedBy: string | null;
}
export declare class AreaDeleteResultDto {
    armId: string;
    deleted: true;
}
export declare class AreaSuccessSingleDto {
    success: true;
    message: string;
    data: AreaPayloadDto;
}
export declare class AreaSuccessDeleteDto {
    success: true;
    message: string;
    data: AreaDeleteResultDto;
}
export declare class AreaMasterCreateResultDto {
    areaMaster: AreaPayloadDto;
    accGroupId: string;
}
export declare class AreaMasterCreateSuccessDto {
    success: true;
    message: string;
    data: AreaMasterCreateResultDto;
}
