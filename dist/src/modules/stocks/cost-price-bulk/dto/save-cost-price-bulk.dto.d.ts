import { PROFIT_TYPES } from '../types/cost-price-bulk.types';
export declare class CostBulkLevelInputDto {
    level: number;
    price: number;
}
export declare class CostBulkRowInputDto {
    lineNo: number;
    ipmId: string;
    rowToken: string;
    costPrice: number;
    mrp?: number | null;
    minPrice?: number | null;
    profitType?: (typeof PROFIT_TYPES)[number] | null;
    levels?: CostBulkLevelInputDto[];
}
export declare class CostBulkOverrideDto {
    code: string;
    line?: number | null;
}
export declare class SaveCostPriceBulkDto {
    companyId: string;
    branchId: string;
    overrides?: CostBulkOverrideDto[];
    rows: CostBulkRowInputDto[];
}
