export declare class SaveUnitDto {
    unit_id?: number;
    unit_name: string;
    unit_alias?: string | null;
    unit_code?: string | null;
    unit_description?: string | null;
    unit_decimal_count?: number;
    unit_weight?: number | null;
    unit_loading?: number | null;
    unit_unloading?: number | null;
    unit_attach_charge?: number | null;
    unit_is_pack_unit?: boolean;
    unit_base_unit_id?: number | null;
    unit_conversion?: number | null;
    unit_is_active?: boolean;
    unit_created_by?: string | null;
    unit_modified_by?: string | null;
}
