import { WidgetPlatform } from '../types/widget-master-api.types';
export declare class SaveWidgetFieldDto {
    fieldId?: number;
    fieldName: string;
    fieldGuiName?: string | null;
    fieldSecondaryText?: string | null;
    fieldPosition?: number;
    fieldVisibility?: boolean;
}
export declare class SaveWidgetDto {
    sectionId?: number;
    sectionMenuId: number;
    sectionName: string;
    sectionGuiName: string;
    sectionPosition?: number;
    sectionVisibility?: boolean;
    sectionPlatform: WidgetPlatform;
    fields?: SaveWidgetFieldDto[];
}
