import { SaveSaleOrderDto } from './save-sale-order.dto';
export declare class SaleOrderKeysDto {
    soId: string;
    soCompanyId: string;
    soBranchId: string;
    soAccYear: string;
}
export declare class PostSaleOrderDto extends SaleOrderKeysDto {
}
export declare class CancelSaleOrderDto extends SaleOrderKeysDto {
    reason: string;
}
declare const AmendSaleOrderDto_base: import("@nestjs/common").Type<Omit<SaveSaleOrderDto, "soId">>;
export declare class AmendSaleOrderDto extends AmendSaleOrderDto_base {
    soId: string;
    baseRevision: number;
    editRemark: string;
}
export {};
