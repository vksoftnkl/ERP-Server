import { FreightType, LoadingType } from '../types/master-lookup-api.types';
export declare class ItemPriceLookupQueryDto {
    item_id: string;
    unit_id?: string;
    company_id?: string;
    branch_id?: string;
    customer_id?: string;
    godown_id?: string;
    acccyear?: string;
    regional?: boolean;
    loading_type?: LoadingType;
    freight_type?: FreightType;
    price_level: number;
}
