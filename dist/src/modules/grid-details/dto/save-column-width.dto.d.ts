export declare class ColumnWidthItemDto {
    grid_column_id: string;
    grid_column_width?: number | null;
    grid_column_px?: string | null;
}
export declare class SaveColumnWidthDto {
    columns: ColumnWidthItemDto[];
}
