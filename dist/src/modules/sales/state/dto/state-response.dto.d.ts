import { SalesErrorFieldDto, SalesErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { SalesErrorFieldDto as StateErrorFieldDto };
export { SalesErrorResponseDto as StateErrorResponseDto };
export declare class StatePayloadDto {
    stmId: string;
    stmName: string;
    stmAlias: string | null;
    stmShort: string | null;
    stmOrder: number;
    stmDescription: string | null;
    stmIsActive: boolean;
    stmIsDeleted: boolean;
    stmSyncDate: string | null;
    stmCreatedOn: string;
    stmCreatedBy: string | null;
    stmModifiedOn: string;
    stmModifiedBy: string | null;
}
export declare class StateDeleteResultDto {
    stmId: string;
    deleted: true;
}
export declare class StateSuccessSingleDto {
    success: true;
    message: string;
    data: StatePayloadDto;
}
export declare class StateSuccessDeleteDto {
    success: true;
    message: string;
    data: StateDeleteResultDto;
}
export declare class StateMasterCreateResultDto {
    stateMaster: StatePayloadDto;
    accGroupId: string;
}
export declare class StateMasterCreateSuccessDto {
    success: true;
    message: string;
    data: StateMasterCreateResultDto;
}
