import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from "../../../../common/types/module-api.types";
export type WidgetMasterErrorDetail = ModuleApiErrorDetail;
export type WidgetMasterErrorResponse = ModuleApiErrorResponse<WidgetMasterErrorDetail>;
export type WidgetMasterSuccessResponse<T, TMeta = Record<string, unknown>> = ModuleApiSuccessResponse<T, TMeta, never>;
export declare enum WidgetPlatform {
    Mobile = "Mobile",
    Desktop = "Desktop",
    Web = "Web"
}
export declare enum WidgetVisibilityFilter {
    False = "false",
    All = "all"
}
export interface WidgetFieldPayload {
    fieldId: number;
    fieldSectionId: number;
    fieldName: string;
    fieldGuiName: string | null;
    fieldSecondaryText: string | null;
    fieldPosition: number;
    fieldVisibility: boolean;
    fieldSyncDate: string;
    fieldCreatedOn: string;
    fieldCreatedBy: string | null;
    fieldUpdatedOn: string;
    fieldUpdatedBy: string | null;
}
export interface WidgetMasterPayload {
    sectionId: number;
    sectionMenuId: number;
    sectionName: string;
    sectionGuiName: string;
    sectionPosition: number;
    sectionVisibility: boolean;
    sectionPlatform: WidgetPlatform;
    sectionSyncDate: string;
    sectionCreatedOn: string;
    sectionCreatedBy: string | null;
    sectionUpdatedOn: string;
    sectionUpdatedBy: string | null;
    fields: WidgetFieldPayload[];
}
