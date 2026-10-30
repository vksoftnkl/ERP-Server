import { InventoryErrorFieldDto, InventoryErrorResponseDto } from "../../../../common/utils/module-response.dto";
export { InventoryErrorFieldDto as TaxRateErrorFieldDto };
export { InventoryErrorResponseDto as TaxRateErrorResponseDto };
export declare class TaxRateLedgerPayloadDto {
    trl_id: string;
    trl_tax_id: string;
    trl_role: string;
    trl_role_label?: string | null;
    trl_supply_nature: string | null;
    trl_ledger_id: string;
    trl_ledger_name?: string | null;
    trl_remarks: string | null;
    trl_is_active: boolean;
    trl_is_deleted: boolean;
    trl_sync_date: string | null;
    trl_created_on: string;
    trl_created_by: string | null;
    trl_modified_on: string | null;
    trl_modified_by: string | null;
}
export declare class TaxRatePayloadDto {
    tax_id: string;
    tax_name: string;
    tax_code: string | null;
    tax_sort_order: number;
    tax_taxability: string;
    tax_is_reverse_charge: boolean;
    tax_rate_perc: number;
    tax_cgst_perc: number | null;
    tax_sgst_perc: number | null;
    tax_igst_perc: number | null;
    tax_cess_basis: string;
    tax_cess_perc: number;
    tax_cess_per_unit: number;
    tax_acess_basis: string;
    tax_acess_perc: number;
    tax_acess_per_unit: number;
    tax_supersedes_id: string | null;
    tax_supersedes_name?: string | null;
    tax_is_active: boolean;
    tax_is_deleted: boolean;
    tax_sync_date: string | null;
    tax_created_on: string;
    tax_created_by: string | null;
    tax_modified_on: string | null;
    tax_modified_by: string | null;
    lines: TaxRateLedgerPayloadDto[];
}
export declare class TaxRateDeleteResultDto {
    tax_id: string;
    deleted: boolean;
    lines_deleted: number;
}
export declare class TaxRateSuccessSingleDto {
    success: true;
    message: string;
    data: TaxRatePayloadDto;
}
export declare class TaxRateSuccessListDto {
    success: true;
    message: string;
    data: TaxRatePayloadDto[];
}
export declare class TaxRateSuccessDeleteDto {
    success: true;
    message: string;
    data: TaxRateDeleteResultDto;
}
export declare class TaxRateResolvedLedgerDto {
    role: string;
    role_label: string;
    role_group: string;
    supply_nature: string | null;
    ledger_id: string | null;
    ledger_name: string | null;
    source: 'OVERRIDE' | 'DEFAULT' | 'UNMAPPED';
    source_row_id: string | null;
}
export declare class TaxRateResolutionDto {
    tax_id: string;
    tax_name: string;
    supply_nature: string | null;
    roles: TaxRateResolvedLedgerDto[];
}
export declare class TaxRateSuccessResolveDto {
    success: true;
    message: string;
    data: TaxRateResolutionDto;
}
