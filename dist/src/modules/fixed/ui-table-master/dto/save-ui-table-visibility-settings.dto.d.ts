export declare class UiTableVisibilitySettingItemDto {
    uiTblClmId: string;
    uiTblClmColumnWidth?: number | null;
    uiTblClmColumnVisibility?: boolean;
    uiTblClmColumnFocus?: boolean;
    uiTblClmColumnPosition?: number;
    uiTblClmColumnNecessity?: boolean;
    uiTblClmNextColumn?: number | null;
    uiTblClmPreviousColumn?: number | null;
    uiTblClmPx?: string | null;
}
export declare class SaveUiTableVisibilitySettingsDto {
    columns: UiTableVisibilitySettingItemDto[];
}
