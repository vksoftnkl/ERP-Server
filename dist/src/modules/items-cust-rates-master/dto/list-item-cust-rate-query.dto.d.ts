import { ModuleListQueryBaseDto } from '../../../common/utils/module-list-query.base.dto';
export declare class ListItemCustRateQueryDto extends ModuleListQueryBaseDto {
    search?: string;
    csr_branch_id?: string;
    csr_customer_id?: string;
    csr_unit_rate_id?: string;
    csr_rate_type?: string;
    csr_price_level?: string;
    csr_is_active?: boolean;
}
