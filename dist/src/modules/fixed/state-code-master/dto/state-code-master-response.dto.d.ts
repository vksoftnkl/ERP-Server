import { FixedErrorFieldDto, FixedErrorResponseDto, FixedListMetaDto } from "../../../../common/utils/module-response.dto";
export { FixedErrorFieldDto as StateCodeMasterErrorFieldDto };
export { FixedErrorResponseDto as StateCodeMasterErrorResponseDto };
export { FixedListMetaDto as StateCodeMasterListMetaDto };
export declare class StateCodeMasterPayloadDto {
    stateCode: string;
    stateName: string;
    stateUt: boolean;
    tinCode: string | null;
    isActive: boolean;
    isDeleted: boolean;
    stateSyncDate: string | null;
    createdOn: string;
    createdBy: string | null;
    modifiedOn: string;
    modifiedBy: string | null;
}
export declare class StateCodeMasterDeleteResultDto {
    stateCode: string;
    deleted: true;
}
export declare class StateCodeMasterSuccessSingleDto {
    success: true;
    message: string;
    data: StateCodeMasterPayloadDto;
}
export declare class StateCodeMasterSuccessListDto {
    success: true;
    message: string;
    data: StateCodeMasterPayloadDto[];
    meta: FixedListMetaDto;
}
export declare class StateCodeMasterSuccessDeleteDto {
    success: true;
    message: string;
    data: StateCodeMasterDeleteResultDto;
}
