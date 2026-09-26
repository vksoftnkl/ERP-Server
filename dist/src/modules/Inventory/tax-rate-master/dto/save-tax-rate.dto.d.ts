import { SaveTaxRateLedgerDto } from './save-tax-rate-ledger.dto';
export declare class SaveTaxRateDto {
    tax_id?: string;
    tax_name: string;
    tax_code?: string | null;
    tax_sort_order?: number;
    tax_taxability?: string;
    tax_is_reverse_charge?: boolean;
    tax_rate_perc?: number;
    tax_cess_basis?: string;
    tax_cess_perc?: number;
    tax_cess_per_unit?: number;
    tax_acess_basis?: string;
    tax_acess_perc?: number;
    tax_acess_per_unit?: number;
    tax_supersedes_id?: string | null;
    tax_is_active?: boolean;
    lines?: SaveTaxRateLedgerDto[];
    tax_created_by?: string | null;
    tax_modified_by?: string | null;
}
