import { SaveDropdownColumnDto } from './save-dropdown-column.dto';
export declare class SaveDropdownDetailDto {
    dropdown_id?: string;
    dropdown_name: string;
    dropdown_sql: string;
    dropdown_description?: string | null;
    dropdown_sort_order?: string | null;
    dropdown_sort_column?: string | null;
    dropdown_completion?: string | null;
    dropdown_sql_regional?: string | null;
    dropdown_max_visible_items?: number;
    dropdown_show_header?: boolean;
    dropdown_width?: number | null;
    dropdown_device_type?: string | null;
    dropdown_columns?: SaveDropdownColumnDto[];
    replace_columns?: boolean;
}
