export declare class TaxRateIdQueryDto {
    tax_id: string;
}
export declare class DeleteTaxRateQueryDto extends TaxRateIdQueryDto {
    tax_modified_by?: string | null;
}
export declare class ListTaxRateQueryDto {
    search?: string;
    tax_taxability?: string;
    tax_rate_perc?: number;
    active_only?: boolean;
}
export declare class ResolveTaxRateQueryDto extends TaxRateIdQueryDto {
    supply_nature?: string;
    company_id?: string;
    branch_id?: string;
}
