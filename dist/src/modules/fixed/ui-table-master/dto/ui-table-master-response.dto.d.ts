import { FixedErrorFieldDto, FixedErrorResponseDto } from "../../../../common/utils/module-response.dto";
import { UiTableColumnPayloadDto } from './ui-table-column-response.dto';
export { FixedErrorFieldDto as UiTableMasterErrorFieldDto };
export { FixedErrorResponseDto as UiTableMasterErrorResponseDto };
export declare class UiTableMasterPayloadDto {
    uiTblId: string;
    uiTblName: string | null;
    uiTblEditable: boolean;
    uiTblIsActive: boolean;
    uiTblIsDeleted: boolean;
    uiTblSyncDate: string | null;
    uiTblSyncOn: string | null;
    uiTblCreatedOn: string;
    uiTblCreatedBy: string | null;
    uiTblModifiedOn: string;
    uiTblModifiedBy: string | null;
    uiTblDeviceType: string | null;
    columns: UiTableColumnPayloadDto[];
}
export declare class UiTableMasterDeleteResultDto {
    uiTblId: string;
    deleted: true;
}
export declare class UiTableMasterSuccessSingleDto {
    success: true;
    message: string;
    data: UiTableMasterPayloadDto;
}
export declare class UiTableMasterSuccessListDto {
    success: true;
    message: string;
    data: UiTableMasterPayloadDto[];
}
export declare class UiTableMasterSuccessDeleteDto {
    success: true;
    message: string;
    data: UiTableMasterDeleteResultDto;
}
export declare class UiTableColumnDeleteResultDto {
    uiTblClmId: string;
    deleted: true;
}
export declare class UiTableMasterSuccessColumnDeleteDto {
    success: true;
    message: string;
    data: UiTableColumnDeleteResultDto;
}
export declare class UiTableColumnUpdateResultDto {
    updated: number;
}
export declare class UiTableMasterSuccessColumnUpdateDto {
    success: true;
    message: string;
    data: UiTableColumnUpdateResultDto;
}
