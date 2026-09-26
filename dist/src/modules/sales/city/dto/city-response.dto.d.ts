import { SalesErrorFieldDto, SalesErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { SalesErrorFieldDto as CityErrorFieldDto };
export { SalesErrorResponseDto as CityErrorResponseDto };
export declare class CityPayloadDto {
    ctmId: string;
    ctmName: string;
    ctmAlias: string | null;
    ctmShort: string | null;
    ctmStateId: string;
    ctmStateName?: string | null;
    ctmOrder: number;
    ctmDescription: string | null;
    ctmIsActive: boolean;
    ctmIsDeleted: boolean;
    ctmSyncDate: string | null;
    ctmCreatedOn: string;
    ctmCreatedBy: string | null;
    ctmModifiedOn: string;
    ctmModifiedBy: string | null;
}
export declare class CityDeleteResultDto {
    ctmId: string;
    deleted: true;
}
export declare class CitySuccessSingleDto {
    success: true;
    message: string;
    data: CityPayloadDto;
}
export declare class CitySuccessDeleteDto {
    success: true;
    message: string;
    data: CityDeleteResultDto;
}
export declare class CityMasterCreateResultDto {
    cityMaster: CityPayloadDto;
    accGroupId: string;
}
export declare class CityMasterCreateSuccessDto {
    success: true;
    message: string;
    data: CityMasterCreateResultDto;
}
