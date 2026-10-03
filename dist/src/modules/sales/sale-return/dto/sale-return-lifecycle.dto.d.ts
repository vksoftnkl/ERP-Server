import { TransportBandDto } from '../../bill/dto/bill-lifecycle.dto';
import { SaveSaleReturnDto } from './save-sale-return.dto';
export declare class SaleReturnKeysDto {
    srId: string;
    srCompanyId: string;
    srBranchId: string;
    srAccYear: string;
}
export declare class ValidateSaleReturnDto extends SaveSaleReturnDto {
    overrides?: string[];
}
export declare class PostSaleReturnDto extends SaleReturnKeysDto {
    overrides?: string[];
    printAfter?: boolean;
}
export declare class CancelSaleReturnDto extends SaleReturnKeysDto {
    reason: string;
}
export declare class AmendSaleReturnDto extends ValidateSaleReturnDto {
    srId: string;
    baseRevision: number;
    editRemark: string;
}
export declare class SaleReturnTransportDto extends SaleReturnKeysDto {
    transport: TransportBandDto;
}
