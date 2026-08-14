export declare class UnitErrorFieldDto {
    field: string;
    message: string;
}
export declare class UnitErrorResponseDto {
    success: false;
    message: string;
    errors: UnitErrorFieldDto[];
}
export declare class UnitPayloadDto {
    unit_id: number;
    unit_name: string;
    unit_alias: string | null;
    unit_code: string | null;
    unit_description: string | null;
    unit_decimal_count: number;
    unit_weight: number | null;
    unit_loading: number | null;
    unit_unloading: number | null;
    unit_attach_charge: number | null;
    unit_is_pack_unit: boolean;
    unit_base_unit_id: number | null;
    unit_conversion: number | null;
    unit_is_active: boolean;
    unit_is_deleted: boolean;
    unit_sync_date: string | null;
    unit_created_on: string;
    unit_created_by: string | null;
    unit_modified_on: string;
    unit_modified_by: string | null;
}
export declare class UnitListMetaDto {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
}
export declare class UnitDeleteResultDto {
    unit_id: number;
    deleted: true;
}
export declare class UnitSuccessSingleDto {
    success: true;
    message: string;
    data: UnitPayloadDto;
}
export declare class UnitSuccessListDto {
    success: true;
    message: string;
    data: UnitPayloadDto[];
    meta: UnitListMetaDto;
}
export declare class UnitSuccessDeleteDto {
    success: true;
    message: string;
    data: UnitDeleteResultDto;
}
