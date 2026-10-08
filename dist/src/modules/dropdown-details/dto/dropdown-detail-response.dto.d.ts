import { FixedErrorFieldDto, FixedErrorResponseDto } from '../../../common/utils/module-response.dto';
export { FixedErrorFieldDto as DropdownDetailErrorFieldDto, FixedErrorResponseDto as DropdownDetailErrorResponseDto, };
export declare class DropdownColumnPayloadDto {
    dropdown_columns_id: string;
    dropdown_columns_dropdown_id: string;
    dropdown_columns_no: number;
    dropdown_columns_data_type: string;
    dropdown_columns_name: string;
    dropdown_columns_alias: string | null;
    dropdown_columns_width: number | null;
    dropdown_columns_visiblity: boolean;
    dropdown_columns_allignment: string | null;
    dropdown_columns_filter: boolean;
    dropdown_columns_sql_name: string | null;
    dropdown_columns_created_on: string;
    dropdown_columns_created_by: string | null;
    dropdown_columns_modified_on: string | null;
    dropdown_columns_modified_by: string | null;
    dropdown_columns_sync_on: string | null;
}
export declare class DropdownDetailPayloadDto {
    dropdown_id: string;
    dropdown_name: string;
    dropdown_description: string | null;
    dropdown_sql: string;
    dropdown_sort_order: string | null;
    dropdown_sort_column: string | null;
    dropdown_completion: string | null;
    dropdown_sql_regional: string | null;
    dropdown_max_visible_items: number;
    dropdown_show_header: boolean;
    dropdown_width: number | null;
    dropdown_device_type: string | null;
    dropdown_created_on: string;
    dropdown_created_by: string | null;
    dropdown_modified_on: string | null;
    dropdown_modified_by: string | null;
    dropdown_sync_on: string | null;
    columns: DropdownColumnPayloadDto[];
}
export declare class DropdownDetailDeleteResultDto {
    dropdown_id: string;
    deleted: true;
}
export declare class DropdownDetailSuccessSingleDto {
    success: true;
    message: string;
    data: DropdownDetailPayloadDto;
}
export declare class DropdownDetailSuccessListDto {
    success: true;
    message: string;
    data: DropdownDetailPayloadDto[];
}
export declare class DropdownDetailSuccessDeleteDto {
    success: true;
    message: string;
    data: DropdownDetailDeleteResultDto;
}
export declare class DropdownColumnDeleteResultDto {
    dropdown_columns_id: string;
    deleted: true;
}
export declare class DropdownDetailSuccessColumnDeleteDto {
    success: true;
    message: string;
    data: DropdownColumnDeleteResultDto;
}
export declare class DropdownDetailColumnUpdateResultDto {
    updated: number;
}
export declare class DropdownDetailSuccessColumnUpdateDto {
    success: true;
    message: string;
    data: DropdownDetailColumnUpdateResultDto;
}
