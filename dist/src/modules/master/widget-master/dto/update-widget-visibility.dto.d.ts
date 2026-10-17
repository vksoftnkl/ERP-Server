export declare class UpdateWidgetVisibilityFieldDto {
    fieldId: number;
    fieldSecondaryText: string;
    fieldVisibility: boolean;
}
export declare class UpdateWidgetVisibilitySectionDto {
    sectionId: number;
    sectionGuiName: string;
    sectionVisibility: boolean;
    fields: UpdateWidgetVisibilityFieldDto[];
}
export declare class UpdateWidgetVisibilityDto {
    data: UpdateWidgetVisibilitySectionDto[];
}
