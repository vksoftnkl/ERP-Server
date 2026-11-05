export type StoredBaseRow = {
    iuc_id: string;
    iuc_unit_id: string;
};
export type BaseUnitFields = {
    iuc_id?: string;
    iuc_unit_id?: string;
    iuc_base_unit_id?: string;
    iuc_is_base_unit?: boolean;
};
export declare function baseUnitChange(base: StoredBaseRow, row: BaseUnitFields): {
    column: string;
    message: string;
} | null;
export declare function refuseBaseUnitChange(code: string, field: string, message: string): never;
