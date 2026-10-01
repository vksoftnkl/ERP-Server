import { WidgetPlatform } from '../types/widget-master-api.types';
export declare class WidgetMasterErrorFieldDto {
    field: string;
    message: string;
}
export declare class WidgetMasterErrorResponseDto {
    success: false;
    message: string;
    errors: WidgetMasterErrorFieldDto[];
}
export declare class WidgetFieldPayloadDto {
    fieldId: number;
    fieldSectionId: number;
    fieldName: string;
    fieldGuiName: string | null;
    fieldSecondaryText: string | null;
    fieldPosition: number;
    fieldVisibility: boolean;
}
export declare class WidgetMasterPayloadDto {
    sectionId: number;
    sectionMenuId: number;
    sectionName: string;
    sectionGuiName: string;
    sectionPosition: number;
    sectionVisibility: boolean;
    sectionPlatform: WidgetPlatform;
    fields: WidgetFieldPayloadDto[];
}
export declare class WidgetMasterDeleteResultDto {
    sectionId: number;
    deleted: true;
}
export declare class WidgetMasterSuccessSingleDto {
    success: true;
    message: string;
    data: WidgetMasterPayloadDto;
}
export declare class WidgetMasterSuccessListDto {
    success: true;
    message: string;
    data: WidgetMasterPayloadDto[];
}
export declare class WidgetMasterSuccessDeleteDto {
    success: true;
    message: string;
    data: WidgetMasterDeleteResultDto;
}
